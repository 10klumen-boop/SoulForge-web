"use strict";

const crypto = require("crypto");

const CHAT_MAX_LEN = 200;
const CHAT_MIN_LEN = 1;
const CHAT_RATE_MS = 2500;
const CHAT_HISTORY_DEFAULT = 60;
const CHAT_HISTORY_MAX = 100;
const CHAT_KEEP_ROWS = 5000;
const CHAT_CHANNELS = new Set(["world", "trade", "party", "clan", "whisper"]);
const CHAT_PUBLIC = new Set(["world", "trade"]);
const CLAN_NAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9][a-zA-Zа-яА-ЯёЁ0-9 _-]{1,22}[a-zA-Zа-яА-ЯёЁ0-9]$/;
const NICK_RE = /^[a-zA-Z]{2,16}$/;

function ensureChatSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nick TEXT NOT NULL,
      char_name TEXT,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      channel TEXT NOT NULL DEFAULT 'world',
      target_user_id INTEGER,
      target_nick TEXT,
      scope_id TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_parties (
      id TEXT PRIMARY KEY,
      leader_user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(leader_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_party_members (
      party_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (user_id),
      FOREIGN KEY(party_id) REFERENCES chat_parties(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_clans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      leader_user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(leader_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_members (
      clan_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (user_id),
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Миграция старых БД без колонок канала (до индексов!)
  const cols = db.prepare("PRAGMA table_info(chat_messages)").all().map((c) => c.name);
  const addCol = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE chat_messages ADD COLUMN ${name} ${ddl}`);
  };
  addCol("channel", "TEXT NOT NULL DEFAULT 'world'");
  addCol("target_user_id", "INTEGER");
  addCol("target_nick", "TEXT");
  addCol("scope_id", "TEXT");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created
      ON chat_messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_channel
      ON chat_messages(channel, id);
    CREATE INDEX IF NOT EXISTS idx_chat_whisper
      ON chat_messages(channel, user_id, target_user_id, id);
    CREATE INDEX IF NOT EXISTS idx_chat_scope
      ON chat_messages(channel, scope_id, id);
    CREATE INDEX IF NOT EXISTS idx_chat_party_members_party
      ON chat_party_members(party_id);
    CREATE INDEX IF NOT EXISTS idx_chat_clan_members_clan
      ON chat_clan_members(clan_id);
  `);
}

function sanitizeChatBody(raw) {
  let text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (text.length > CHAT_MAX_LEN) text = text.slice(0, CHAT_MAX_LEN);
  return text;
}

function sanitizeCharName(raw) {
  const name = String(raw || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 24);
  return name || null;
}

function normalizeChannel(raw) {
  const ch = String(raw || "world").toLowerCase().trim();
  return CHAT_CHANNELS.has(ch) ? ch : null;
}

function newSocialId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function attachChatMethods(db, store) {
  ensureChatSchema(db);

  const stmtInsert = db.prepare(`
    INSERT INTO chat_messages (
      user_id, nick, char_name, body, created_at,
      channel, target_user_id, target_nick, scope_id
    ) VALUES (
      @user_id, @nick, @char_name, @body, @created_at,
      @channel, @target_user_id, @target_nick, @scope_id
    )
  `);
  const stmtLastByUser = db.prepare(`
    SELECT created_at FROM chat_messages
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 1
  `);
  const stmtCount = db.prepare(`SELECT COUNT(*) AS n FROM chat_messages`);
  const stmtMaxId = db.prepare(`SELECT MAX(id) AS max_id FROM chat_messages`);
  const stmtMaxIdChannel = db.prepare(`
    SELECT MAX(id) AS max_id FROM chat_messages WHERE channel = ?
  `);
  const stmtPrune = db.prepare(`
    DELETE FROM chat_messages
    WHERE id < (SELECT MAX(id) - ? FROM chat_messages)
  `);

  const stmtPublicAfter = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = ? AND id > ?
    ORDER BY id ASC LIMIT ?
  `);
  const stmtPublicRecent = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = ?
    ORDER BY id DESC LIMIT ?
  `);

  const stmtScopeAfter = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = ? AND scope_id = ? AND id > ?
    ORDER BY id ASC LIMIT ?
  `);
  const stmtScopeRecent = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = ? AND scope_id = ?
    ORDER BY id DESC LIMIT ?
  `);

  const stmtWhisperAfter = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = 'whisper'
      AND id > ?
      AND (user_id = ? OR target_user_id = ?)
    ORDER BY id ASC LIMIT ?
  `);
  const stmtWhisperRecent = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = 'whisper'
      AND (user_id = ? OR target_user_id = ?)
    ORDER BY id DESC LIMIT ?
  `);

  const stmtPartyOf = db.prepare(`SELECT party_id FROM chat_party_members WHERE user_id = ?`);
  const stmtPartyGet = db.prepare(`SELECT * FROM chat_parties WHERE id = ?`);
  const stmtPartyInsert = db.prepare(`
    INSERT INTO chat_parties (id, leader_user_id, created_at) VALUES (?, ?, ?)
  `);
  const stmtPartyMemberInsert = db.prepare(`
    INSERT INTO chat_party_members (party_id, user_id, joined_at) VALUES (?, ?, ?)
  `);
  const stmtPartyMemberDelete = db.prepare(`DELETE FROM chat_party_members WHERE user_id = ?`);
  const stmtPartyMembers = db.prepare(`
    SELECT m.user_id, u.nick, m.joined_at
    FROM chat_party_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.party_id = ?
    ORDER BY m.joined_at ASC
  `);
  const stmtPartyDeleteIfEmpty = db.prepare(`
    DELETE FROM chat_parties
    WHERE id = ? AND NOT EXISTS (
      SELECT 1 FROM chat_party_members WHERE party_id = ?
    )
  `);
  const stmtPartyCount = db.prepare(`SELECT COUNT(*) AS n FROM chat_party_members WHERE party_id = ?`);
  const stmtPartySetLeader = db.prepare(`UPDATE chat_parties SET leader_user_id = ? WHERE id = ?`);

  const stmtClanOf = db.prepare(`SELECT clan_id FROM chat_clan_members WHERE user_id = ?`);
  const stmtClanGet = db.prepare(`SELECT * FROM chat_clans WHERE id = ?`);
  const stmtClanByName = db.prepare(`SELECT * FROM chat_clans WHERE name = ? COLLATE NOCASE`);
  const stmtClanInsert = db.prepare(`
    INSERT INTO chat_clans (id, name, leader_user_id, created_at) VALUES (?, ?, ?, ?)
  `);
  const stmtClanMemberInsert = db.prepare(`
    INSERT INTO chat_clan_members (clan_id, user_id, joined_at) VALUES (?, ?, ?)
  `);
  const stmtClanMemberDelete = db.prepare(`DELETE FROM chat_clan_members WHERE user_id = ?`);
  const stmtClanMembers = db.prepare(`
    SELECT m.user_id, u.nick, m.joined_at
    FROM chat_clan_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.clan_id = ?
    ORDER BY m.joined_at ASC
  `);
  const stmtClanDeleteIfEmpty = db.prepare(`
    DELETE FROM chat_clans
    WHERE id = ? AND NOT EXISTS (
      SELECT 1 FROM chat_clan_members WHERE clan_id = ?
    )
  `);
  const stmtClanCount = db.prepare(`SELECT COUNT(*) AS n FROM chat_clan_members WHERE clan_id = ?`);
  const stmtClanSetLeader = db.prepare(`UPDATE chat_clans SET leader_user_id = ? WHERE id = ?`);

  function mapRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      nick: row.nick,
      charName: row.char_name || null,
      body: row.body,
      createdAt: row.created_at,
      channel: row.channel || "world",
      targetUserId: row.target_user_id || null,
      targetNick: row.target_nick || null,
      scopeId: row.scope_id || null,
    };
  }

  function pruneIfNeeded() {
    const n = Number(stmtCount.get()?.n || 0);
    if (n <= CHAT_KEEP_ROWS + 200) return;
    stmtPrune.run(CHAT_KEEP_ROWS);
  }

  function getPartyId(userId) {
    return stmtPartyOf.get(userId)?.party_id || null;
  }

  function getClanId(userId) {
    return stmtClanOf.get(userId)?.clan_id || null;
  }

  function socialSnapshot(userId) {
    const partyId = getPartyId(userId);
    const clanId = getClanId(userId);
    let party = null;
    let clan = null;
    if (partyId) {
      const p = stmtPartyGet.get(partyId);
      const members = stmtPartyMembers.all(partyId);
      party = {
        id: partyId,
        leaderUserId: p?.leader_user_id || null,
        members: members.map((m) => ({ userId: m.user_id, nick: m.nick })),
      };
    }
    if (clanId) {
      const c = stmtClanGet.get(clanId);
      const members = stmtClanMembers.all(clanId);
      clan = {
        id: clanId,
        name: c?.name || null,
        leaderUserId: c?.leader_user_id || null,
        members: members.map((m) => ({ userId: m.user_id, nick: m.nick })),
      };
    }
    return { party, clan };
  }

  function logChatAudit(user, event, payload, charName) {
    try {
      if (typeof store.insertCharacterEvents !== "function") return;
      store.insertCharacterEvents(user.id, [
        {
          event,
          characterId: "chat",
          charName: charName || null,
          payload: payload || {},
          at: Date.now(),
        },
      ]);
    } catch (e) {
      console.error("chat audit", event, e);
    }
  }

  store.chatGetSocial = function chatGetSocial(userId) {
    return { ok: true, ...socialSnapshot(userId) };
  };

  store.chatCreateParty = function chatCreateParty(user, opts = {}) {
    if (getPartyId(user.id)) {
      return { ok: false, error: "already", message: "Вы уже в группе" };
    }
    const now = Number(opts.now) || Date.now();
    const id = newSocialId("p");
    const tx = db.transaction(() => {
      stmtPartyInsert.run(id, user.id, now);
      stmtPartyMemberInsert.run(id, user.id, now);
    });
    tx();
    const snap = socialSnapshot(user.id);
    logChatAudit(user, "chat_party_create", { partyId: id }, opts.charName);
    return { ok: true, ...snap };
  };

  store.chatLeaveParty = function chatLeaveParty(user, opts = {}) {
    const partyId = getPartyId(user.id);
    if (!partyId) return { ok: false, error: "none", message: "Вы не в группе" };
    const party = stmtPartyGet.get(partyId);
    const now = Number(opts.now) || Date.now();
    const tx = db.transaction(() => {
      stmtPartyMemberDelete.run(user.id);
      const left = Number(stmtPartyCount.get(partyId)?.n || 0);
      if (left === 0) {
        stmtPartyDeleteIfEmpty.run(partyId, partyId);
      } else if (party && party.leader_user_id === user.id) {
        const next = stmtPartyMembers.all(partyId)[0];
        if (next) stmtPartySetLeader.run(next.user_id, partyId);
      }
    });
    tx();
    logChatAudit(user, "chat_party_leave", { partyId }, opts.charName);
    return { ok: true, leftAt: now, ...socialSnapshot(user.id) };
  };

  store.chatInviteParty = function chatInviteParty(user, opts = {}) {
    const nick = String(opts.nick || "").trim();
    if (!NICK_RE.test(nick)) {
      return { ok: false, error: "nick", message: "Ник: 2–16 латинских букв" };
    }
    let partyId = getPartyId(user.id);
    if (!partyId) {
      const created = store.chatCreateParty(user, { now: opts.now });
      if (!created.ok) return created;
      partyId = created.party?.id;
    }
    const party = stmtPartyGet.get(partyId);
    if (!party || party.leader_user_id !== user.id) {
      return { ok: false, error: "leader", message: "Приглашать может только лидер" };
    }
    const target = store.getUserByNick(nick);
    if (!target) return { ok: false, error: "not_found", message: "Игрок не найден" };
    if (target.id === user.id) {
      return { ok: false, error: "self", message: "Нельзя пригласить себя" };
    }
    if (getPartyId(target.id)) {
      return { ok: false, error: "busy", message: "Игрок уже в группе" };
    }
    const count = Number(stmtPartyCount.get(partyId)?.n || 0);
    if (count >= 8) return { ok: false, error: "full", message: "Группа полна (8)" };
    const now = Number(opts.now) || Date.now();
    stmtPartyMemberInsert.run(partyId, target.id, now);
    logChatAudit(
      user,
      "chat_party_invite",
      { partyId, invited: target.nick, invitedUserId: target.id },
      opts.charName
    );
    return { ok: true, invited: target.nick, ...socialSnapshot(user.id) };
  };

  store.chatCreateClan = function chatCreateClan(user, opts = {}) {
    if (getClanId(user.id)) {
      return { ok: false, error: "already", message: "Вы уже в клане" };
    }
    const name = String(opts.name || "").trim().replace(/\s+/g, " ");
    if (!CLAN_NAME_RE.test(name)) {
      return { ok: false, error: "name", message: "Имя клана: 3–24 символа" };
    }
    if (stmtClanByName.get(name)) {
      return { ok: false, error: "taken", message: "Имя клана занято" };
    }
    const now = Number(opts.now) || Date.now();
    const id = newSocialId("c");
    const tx = db.transaction(() => {
      stmtClanInsert.run(id, name, user.id, now);
      stmtClanMemberInsert.run(id, user.id, now);
    });
    tx();
    logChatAudit(user, "chat_clan_create", { clanId: id, name }, opts.charName);
    return { ok: true, ...socialSnapshot(user.id) };
  };

  store.chatLeaveClan = function chatLeaveClan(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "none", message: "Вы не в клане" };
    const clan = stmtClanGet.get(clanId);
    const now = Number(opts.now) || Date.now();
    const tx = db.transaction(() => {
      stmtClanMemberDelete.run(user.id);
      const left = Number(stmtClanCount.get(clanId)?.n || 0);
      if (left === 0) {
        stmtClanDeleteIfEmpty.run(clanId, clanId);
      } else if (clan && clan.leader_user_id === user.id) {
        const next = stmtClanMembers.all(clanId)[0];
        if (next) stmtClanSetLeader.run(next.user_id, clanId);
      }
    });
    tx();
    logChatAudit(user, "chat_clan_leave", { clanId, name: clan?.name || null }, opts.charName);
    return { ok: true, leftAt: now, ...socialSnapshot(user.id) };
  };

  store.chatInviteClan = function chatInviteClan(user, opts = {}) {
    const nick = String(opts.nick || "").trim();
    if (!NICK_RE.test(nick)) {
      return { ok: false, error: "nick", message: "Ник: 2–16 латинских букв" };
    }
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "none", message: "Сначала создайте клан" };
    const clan = stmtClanGet.get(clanId);
    if (!clan || clan.leader_user_id !== user.id) {
      return { ok: false, error: "leader", message: "Приглашать может только лидер" };
    }
    const target = store.getUserByNick(nick);
    if (!target) return { ok: false, error: "not_found", message: "Игрок не найден" };
    if (target.id === user.id) {
      return { ok: false, error: "self", message: "Нельзя пригласить себя" };
    }
    if (getClanId(target.id)) {
      return { ok: false, error: "busy", message: "Игрок уже в клане" };
    }
    const count = Number(stmtClanCount.get(clanId)?.n || 0);
    if (count >= 40) return { ok: false, error: "full", message: "Клан полон (40)" };
    const now = Number(opts.now) || Date.now();
    stmtClanMemberInsert.run(clanId, target.id, now);
    logChatAudit(
      user,
      "chat_clan_invite",
      { clanId, name: clan.name, invited: target.nick, invitedUserId: target.id },
      opts.charName
    );
    return { ok: true, invited: target.nick, ...socialSnapshot(user.id) };
  };

  store.chatListMessages = function chatListMessages(user, opts = {}) {
    const channel = normalizeChannel(opts.channel) || "world";
    const after = Math.max(0, Math.floor(Number(opts.after) || 0));
    const limit = Math.min(
      CHAT_HISTORY_MAX,
      Math.max(1, Math.floor(Number(opts.limit) || CHAT_HISTORY_DEFAULT))
    );
    const social = socialSnapshot(user.id);
    let rows = [];
    let canSend = true;
    let reason = null;
    let scopeId = null;

    if (CHAT_PUBLIC.has(channel)) {
      rows = after > 0 ? stmtPublicAfter.all(channel, after, limit) : stmtPublicRecent.all(channel, limit).reverse();
    } else if (channel === "whisper") {
      rows =
        after > 0
          ? stmtWhisperAfter.all(after, user.id, user.id, limit)
          : stmtWhisperRecent.all(user.id, user.id, limit).reverse();
    } else if (channel === "party") {
      scopeId = social.party?.id || null;
      if (!scopeId) {
        canSend = false;
        reason = "no_party";
      } else {
        rows =
          after > 0
            ? stmtScopeAfter.all(channel, scopeId, after, limit)
            : stmtScopeRecent.all(channel, scopeId, limit).reverse();
      }
    } else if (channel === "clan") {
      scopeId = social.clan?.id || null;
      if (!scopeId) {
        canSend = false;
        reason = "no_clan";
      } else {
        rows =
          after > 0
            ? stmtScopeAfter.all(channel, scopeId, after, limit)
            : stmtScopeRecent.all(channel, scopeId, limit).reverse();
      }
    }

    let latestId = 0;
    if (CHAT_PUBLIC.has(channel)) {
      latestId = Number(stmtMaxIdChannel.get(channel)?.max_id || 0);
    } else if (rows.length) {
      latestId = Math.max(...rows.map((r) => r.id));
    } else if (after > 0) {
      latestId = after;
    }

    return {
      ok: true,
      channel,
      messages: rows.map(mapRow),
      latestId,
      canSend,
      reason,
      scopeId,
      party: social.party,
      clan: social.clan,
    };
  };

  store.chatPostMessage = function chatPostMessage(user, opts = {}) {
    let channel = normalizeChannel(opts.channel) || "world";
    let body = sanitizeChatBody(opts.body);
    let toNick = String(opts.toNick || opts.targetNick || "").trim();

    // /w Nick text или /whisper Nick text
    const whisperCmd = /^\/(?:w|whisper)\s+([a-zA-Z]{2,16})\s+(.+)$/is.exec(body);
    if (whisperCmd) {
      channel = "whisper";
      toNick = whisperCmd[1];
      body = sanitizeChatBody(whisperCmd[2]);
    }

    if (!CHAT_CHANNELS.has(channel)) {
      return { ok: false, error: "channel", message: "Неизвестный канал" };
    }
    if (body.length < CHAT_MIN_LEN) {
      return { ok: false, error: "empty", message: "Пустое сообщение" };
    }

    const now = Number(opts.now) || Date.now();
    const last = stmtLastByUser.get(user.id);
    if (last && now - Number(last.created_at || 0) < CHAT_RATE_MS) {
      return { ok: false, error: "rate", message: "Подождите пару секунд" };
    }

    const nick = String(user.nick || "").slice(0, 16);
    const charName = sanitizeCharName(opts.charName);
    let targetUserId = null;
    let targetNick = null;
    let scopeId = null;

    if (channel === "whisper") {
      if (!NICK_RE.test(toNick)) {
        return { ok: false, error: "target", message: "Укажите ник получателя" };
      }
      const target = store.getUserByNick(toNick);
      if (!target) return { ok: false, error: "not_found", message: "Игрок не найден" };
      if (target.id === user.id) {
        return { ok: false, error: "self", message: "Нельзя писать себе" };
      }
      targetUserId = target.id;
      targetNick = target.nick;
    } else if (channel === "party") {
      scopeId = getPartyId(user.id);
      if (!scopeId) return { ok: false, error: "no_party", message: "Сначала создайте или вступите в группу" };
    } else if (channel === "clan") {
      scopeId = getClanId(user.id);
      if (!scopeId) return { ok: false, error: "no_clan", message: "Сначала создайте или вступите в клан" };
    }

    const info = stmtInsert.run({
      user_id: user.id,
      nick,
      char_name: charName,
      body,
      created_at: now,
      channel,
      target_user_id: targetUserId,
      target_nick: targetNick,
      scope_id: scopeId,
    });
    pruneIfNeeded();
    const message = {
      id: Number(info.lastInsertRowid),
      userId: user.id,
      nick,
      charName,
      body,
      createdAt: now,
      channel,
      targetUserId,
      targetNick,
      scopeId,
    };
    logChatAudit(
      user,
      "chat_message",
      {
        messageId: message.id,
        channel,
        body,
        targetNick,
        targetUserId,
        scopeId,
      },
      charName
    );
    return { ok: true, message };
  };

  const stmtAdminChatCount = db.prepare(`
    SELECT COUNT(*) AS n FROM chat_messages m
    WHERE (? IS NULL OR m.channel = ?)
      AND (? IS NULL OR m.nick LIKE ? COLLATE NOCASE OR IFNULL(m.char_name,'') LIKE ? COLLATE NOCASE
           OR IFNULL(m.target_nick,'') LIKE ? COLLATE NOCASE)
      AND (? IS NULL OR m.body LIKE ? COLLATE NOCASE)
      AND (? IS NULL OR m.created_at >= ?)
      AND (? IS NULL OR m.created_at <= ?)
      AND (? IS NULL OR m.id > ?)
  `);
  const stmtAdminChatList = db.prepare(`
    SELECT m.*, u.nick AS account_nick
    FROM chat_messages m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE (? IS NULL OR m.channel = ?)
      AND (? IS NULL OR m.nick LIKE ? COLLATE NOCASE OR IFNULL(m.char_name,'') LIKE ? COLLATE NOCASE
           OR IFNULL(m.target_nick,'') LIKE ? COLLATE NOCASE)
      AND (? IS NULL OR m.body LIKE ? COLLATE NOCASE)
      AND (? IS NULL OR m.created_at >= ?)
      AND (? IS NULL OR m.created_at <= ?)
      AND (? IS NULL OR m.id > ?)
    ORDER BY m.id DESC
    LIMIT ? OFFSET ?
  `);
  const stmtAdminChatDelete = db.prepare(`DELETE FROM chat_messages WHERE id = ?`);
  const stmtAdminChatGet = db.prepare(`SELECT id FROM chat_messages WHERE id = ?`);

  store.adminListChat = function adminListChat(opts = {}) {
    const channel = opts.channel ? String(opts.channel).slice(0, 16) : null;
    const nickRaw = opts.nick ? String(opts.nick).replace(/[%_]/g, "").trim() : "";
    const nickLike = nickRaw ? "%" + nickRaw + "%" : null;
    const qRaw = opts.q ? String(opts.q).replace(/[%_]/g, "").trim() : "";
    const qLike = qRaw ? "%" + qRaw + "%" : null;
    const since = opts.since != null && Number.isFinite(Number(opts.since)) ? Number(opts.since) : null;
    const until = opts.until != null && Number.isFinite(Number(opts.until)) ? Number(opts.until) : null;
    const after = opts.after != null && Number(opts.after) > 0 ? Math.floor(Number(opts.after)) : null;
    const limit = Math.min(200, Math.max(1, Math.floor(Number(opts.limit) || 80)));
    const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));

    const args = [
      channel, channel,
      nickLike, nickLike, nickLike, nickLike,
      qLike, qLike,
      since, since,
      until, until,
      after, after,
    ];
    const total = Number(stmtAdminChatCount.get(...args)?.n || 0);
    const rows = stmtAdminChatList.all(...args, limit, offset).map((row) => ({
      id: row.id,
      userId: row.user_id,
      nick: row.account_nick || row.nick,
      charName: row.char_name || null,
      body: row.body,
      channel: row.channel || "world",
      targetNick: row.target_nick || null,
      targetUserId: row.target_user_id || null,
      scopeId: row.scope_id || null,
      createdAt: row.created_at,
    }));
    const latestId = rows.length ? Math.max(...rows.map((r) => r.id)) : after || 0;
    return { ok: true, rows, total, latestId, limit, offset };
  };

  store.adminDeleteChat = function adminDeleteChat(messageId) {
    const id = Math.floor(Number(messageId));
    if (!Number.isInteger(id) || id < 1) return { ok: false, error: "bad_id" };
    if (!stmtAdminChatGet.get(id)) return { ok: false, error: "not_found" };
    stmtAdminChatDelete.run(id);
    return { ok: true, id };
  };
}

module.exports = {
  attachChatMethods,
  ensureChatSchema,
  sanitizeChatBody,
  CHAT_MAX_LEN,
  CHAT_RATE_MS,
  CHAT_CHANNELS,
};
