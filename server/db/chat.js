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
/** Парти-контент: группа 2–4 (раньше было 8 для чата). */
const PARTY_MAX_MEMBERS = 4;

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

  const PARTY_INVITE_TTL_MS = 5 * 60 * 1000;
  /** @type {Map<string, object>} inviteId → pending invite */
  const partyPendingInvites = new Map();

  function prunePartyInvites(now) {
    const t = Number(now) || Date.now();
    for (const [id, inv] of partyPendingInvites) {
      if (!inv || inv.expiresAt < t) partyPendingInvites.delete(id);
    }
  }

  function clearPartyInvitesForParty(partyId) {
    for (const [id, inv] of partyPendingInvites) {
      if (inv && inv.partyId === partyId) partyPendingInvites.delete(id);
    }
  }

  function clearPartyInvitesForUser(userId) {
    for (const [id, inv] of partyPendingInvites) {
      if (inv && (inv.toUserId === userId || inv.fromUserId === userId)) {
        partyPendingInvites.delete(id);
      }
    }
  }

  function listPartyInvitesFor(userId) {
    prunePartyInvites(Date.now());
    return [...partyPendingInvites.values()]
      .filter((inv) => inv.toUserId === userId)
      .map((inv) => ({
        id: inv.id,
        partyId: inv.partyId,
        fromUserId: inv.fromUserId,
        fromNick: inv.fromNick,
        fromName: inv.fromName,
        toName: inv.toName,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      }));
  }

  function listOutgoingPartyInvites(partyId) {
    prunePartyInvites(Date.now());
    return [...partyPendingInvites.values()]
      .filter((inv) => inv.partyId === partyId)
      .map((inv) => ({
        id: inv.id,
        toUserId: inv.toUserId,
        toName: inv.toName,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      }));
  }

  function getPartyId(userId) {
    return stmtPartyOf.get(userId)?.party_id || null;
  }

  function getClanId(userId) {
    return stmtClanOf.get(userId)?.clan_id || null;
  }

  function memberDisplayName(userId, nick) {
    try {
      const save = db.prepare(`SELECT active_name FROM player_saves WHERE user_id = ?`).get(userId);
      if (save?.active_name) return String(save.active_name);
      const row = db
        .prepare(
          `SELECT name FROM player_characters
           WHERE user_id = ? AND created = 1 AND name IS NOT NULL AND name != ''
           ORDER BY level DESC, slot_id ASC LIMIT 1`
        )
        .get(userId);
      if (row?.name) return String(row.name);
    } catch (_) {}
    return nick;
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
        members: members.map((m) => ({
          userId: m.user_id,
          nick: m.nick,
          name: memberDisplayName(m.user_id, m.nick),
        })),
      };
      if (typeof store.partyAnnotateReady === "function") {
        party = store.partyAnnotateReady(party);
      }
    }
    if (clanId) {
      const c = stmtClanGet.get(clanId);
      const members = stmtClanMembers.all(clanId);
      clan = {
        id: clanId,
        name: c?.name || null,
        leaderUserId: c?.leader_user_id || null,
        members: members.map((m) => ({
          userId: m.user_id,
          nick: m.nick,
          name: memberDisplayName(m.user_id, m.nick),
        })),
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
        clearPartyInvitesForParty(partyId);
      } else if (party && party.leader_user_id === user.id) {
        const next = stmtPartyMembers.all(partyId)[0];
        if (next) stmtPartySetLeader.run(next.user_id, partyId);
      }
    });
    tx();
    clearPartyInvitesForUser(user.id);
    // Выход из группы = выход из инстанса/фарма группы
    if (typeof store.instanceLeave === "function") {
      try {
        store.instanceLeave(user, { now });
      } catch (_) {}
    }
    if (typeof store.partyFarmLeave === "function") {
      try {
        store.partyFarmLeave(user, { now });
      } catch (_) {}
    }
    if (typeof store.partyLfgOnPartyChange === "function") {
      store.partyLfgOnPartyChange(partyId);
    }
    logChatAudit(user, "chat_party_leave", { partyId }, opts.charName);
    return { ok: true, leftAt: now, ...socialSnapshot(user.id) };
  };

  /** Приглашение — pending, пока цель не примет / отклонит. */
  store.chatInviteParty = function chatInviteParty(user, opts = {}) {
    const raw =
      String(opts.charName || opts.name || opts.nick || "").trim().slice(0, 48);
    if (raw.length < 2) {
      return { ok: false, error: "name", message: "Укажи имя персонажа (2–16)" };
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

    let targetUser = null;
    let invitedLabel = raw;
    if (typeof store.mailResolveName === "function") {
      const dest = store.mailResolveName(raw);
      if (dest.ok) {
        targetUser = store.getUserById(dest.userId);
        invitedLabel = dest.name || raw;
      }
    }
    if (!targetUser) {
      return { ok: false, error: "not_found", message: "Персонаж «" + raw + "» не найден" };
    }
    if (targetUser.id === user.id) {
      return { ok: false, error: "self", message: "Нельзя пригласить себя" };
    }
    if (getPartyId(targetUser.id)) {
      return { ok: false, error: "busy", message: "Игрок уже в группе" };
    }
    const count = Number(stmtPartyCount.get(partyId)?.n || 0);
    const pendingToParty = listOutgoingPartyInvites(partyId).length;
    if (count + pendingToParty >= PARTY_MAX_MEMBERS) {
      return { ok: false, error: "full", message: "Группа полна (" + PARTY_MAX_MEMBERS + ")" };
    }
    prunePartyInvites(opts.now || Date.now());
    for (const [id, inv] of partyPendingInvites) {
      if (inv && inv.partyId === partyId && inv.toUserId === targetUser.id) {
        partyPendingInvites.delete(id);
      }
    }
    const now = Number(opts.now) || Date.now();
    const wall = Date.now();
    const inviteId = newSocialId("pi");
    const fromName = memberDisplayName(user.id, user.nick);
    partyPendingInvites.set(inviteId, {
      id: inviteId,
      partyId,
      fromUserId: user.id,
      fromNick: user.nick,
      fromName,
      toUserId: targetUser.id,
      toName: invitedLabel,
      createdAt: now,
      expiresAt: wall + PARTY_INVITE_TTL_MS,
    });
    logChatAudit(
      user,
      "chat_party_invite",
      {
        partyId,
        invited: invitedLabel,
        invitedUserId: targetUser.id,
        invitedNick: targetUser.nick,
        inviteId,
        pending: true,
      },
      opts.charName
    );
    return {
      ok: true,
      pending: true,
      invited: invitedLabel,
      inviteId,
      invitesOutgoing: listOutgoingPartyInvites(partyId),
      ...socialSnapshot(user.id),
    };
  };

  store.chatListPartyInvites = function chatListPartyInvites(user) {
    return { ok: true, invites: listPartyInvitesFor(user.id) };
  };

  store.chatListOutgoingPartyInvites = function chatListOutgoingPartyInvites(user) {
    const partyId = getPartyId(user.id);
    if (!partyId) return { ok: true, invites: [] };
    const party = stmtPartyGet.get(partyId);
    if (!party || party.leader_user_id !== user.id) return { ok: true, invites: [] };
    return { ok: true, invites: listOutgoingPartyInvites(partyId) };
  };

  store.chatRespondPartyInvite = function chatRespondPartyInvite(user, opts = {}) {
    const inviteId = String(opts.inviteId || opts.id || "").trim();
    const accept = opts.accept !== false && opts.accept !== 0 && opts.accept !== "0";
    prunePartyInvites(opts.now || Date.now());
    const inv = inviteId ? partyPendingInvites.get(inviteId) : null;
    if (!inv || inv.toUserId !== user.id) {
      return { ok: false, error: "invite", message: "Приглашение не найдено или истекло" };
    }
    partyPendingInvites.delete(inviteId);
    if (!accept) {
      logChatAudit(user, "chat_party_invite_decline", { inviteId, partyId: inv.partyId }, opts.charName);
      return { ok: true, accepted: false, ...socialSnapshot(user.id) };
    }
    if (getPartyId(user.id)) {
      return { ok: false, error: "busy", message: "Вы уже в группе" };
    }
    const party = stmtPartyGet.get(inv.partyId);
    if (!party) {
      return { ok: false, error: "party", message: "Группа больше не существует" };
    }
    const count = Number(stmtPartyCount.get(inv.partyId)?.n || 0);
    if (count >= PARTY_MAX_MEMBERS) {
      return { ok: false, error: "full", message: "Группа уже полна" };
    }
    const now = Number(opts.now) || Date.now();
    stmtPartyMemberInsert.run(inv.partyId, user.id, now);
    clearPartyInvitesForUser(user.id);
    logChatAudit(
      user,
      "chat_party_invite_accept",
      { inviteId, partyId: inv.partyId, fromUserId: inv.fromUserId },
      opts.charName
    );
    return { ok: true, accepted: true, ...socialSnapshot(user.id) };
  };

  /** Прямой вход в party (LFG-доска) — без pending invite. */
  store.chatJoinPartyDirect = function chatJoinPartyDirect(user, opts = {}) {
    const partyId = String(opts.partyId || "").trim();
    if (!partyId) return { ok: false, error: "party", message: "Группа не указана" };
    if (getPartyId(user.id)) {
      return { ok: false, error: "busy", message: "Вы уже в группе" };
    }
    const party = stmtPartyGet.get(partyId);
    if (!party) {
      return { ok: false, error: "party", message: "Группа больше не существует" };
    }
    const count = Number(stmtPartyCount.get(partyId)?.n || 0);
    if (count >= PARTY_MAX_MEMBERS) {
      return { ok: false, error: "full", message: "Группа уже полна" };
    }
    const now = Number(opts.now) || Date.now();
    stmtPartyMemberInsert.run(partyId, user.id, now);
    clearPartyInvitesForUser(user.id);
    logChatAudit(user, "chat_party_lfg_join", { partyId }, opts.charName);
    return { ok: true, ...socialSnapshot(user.id) };
  };

  store.chatKickParty = function chatKickParty(user, opts = {}) {
    const raw =
      String(opts.charName || opts.name || opts.nick || "").trim().slice(0, 48);
    if (raw.length < 2) {
      return { ok: false, error: "name", message: "Укажи имя персонажа" };
    }
    const partyId = getPartyId(user.id);
    if (!partyId) return { ok: false, error: "none", message: "Вы не в группе" };
    const party = stmtPartyGet.get(partyId);
    if (!party || party.leader_user_id !== user.id) {
      return { ok: false, error: "leader", message: "Исключать может только лидер" };
    }

    let targetUser = null;
    let kickedLabel = raw;
    if (typeof store.mailResolveName === "function") {
      const dest = store.mailResolveName(raw);
      if (dest.ok) {
        targetUser = store.getUserById(dest.userId);
        kickedLabel = dest.name || raw;
      }
    }
    // Fallback: match by character name among party members (or nick as last resort)
    if (!targetUser) {
      const members = stmtPartyMembers.all(partyId);
      const hit = members.find((m) => {
        const cn = String(memberDisplayName(m.user_id, m.nick) || "").toLowerCase();
        const nk = String(m.nick || "").toLowerCase();
        const needle = raw.toLowerCase();
        return cn === needle || nk === needle;
      });
      if (hit) {
        targetUser = store.getUserById(hit.user_id);
        kickedLabel = memberDisplayName(hit.user_id, hit.nick);
      }
    }
    if (!targetUser) {
      // Try resolving as char among current party via mailResolve only failed above
      return { ok: false, error: "not_found", message: "Персонаж не найден в группе" };
    }
    if (targetUser.id === user.id) {
      return { ok: false, error: "self", message: "Нельзя исключить себя — выйдите из группы" };
    }
    const targetParty = getPartyId(targetUser.id);
    if (targetParty !== partyId) {
      return { ok: false, error: "member", message: "Игрок не в вашей группе" };
    }
    stmtPartyMemberDelete.run(targetUser.id);
    if (typeof store.instanceLeave === "function") {
      try {
        store.instanceLeave({ id: targetUser.id, nick: targetUser.nick }, { now: Date.now() });
      } catch (_) {}
    }
    if (typeof store.partyFarmLeave === "function") {
      try {
        store.partyFarmLeave({ id: targetUser.id, nick: targetUser.nick }, {});
      } catch (_) {}
    }
    if (typeof store.partyLfgOnPartyChange === "function") {
      store.partyLfgOnPartyChange(partyId);
    }
    logChatAudit(
      user,
      "chat_party_kick",
      {
        partyId,
        kicked: kickedLabel,
        kickedUserId: targetUser.id,
        kickedNick: targetUser.nick,
      },
      opts.charName
    );
    return { ok: true, kicked: kickedLabel, ...socialSnapshot(user.id) };
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
