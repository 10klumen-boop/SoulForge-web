"use strict";

const path = require("path");
const { clanUtcWeekId } = require("./clan-buffs");
const { parseSavePayload, resolveActiveCharacterId } = require("./save-utils");

let OATH_SYMBOL;
try {
  OATH_SYMBOL = require(path.join(
    __dirname,
    "..",
    "..",
    "game",
    "src",
    "data",
    "oath-symbol-data.js"
  )).OATH_SYMBOL;
} catch (_) {
  OATH_SYMBOL = { materialKey: "oath_symbol", nameRu: "Символ Клятвы" };
}
const OATH_MAT = OATH_SYMBOL.materialKey || "oath_symbol";
const OATH_LABEL = () =>
  (CLAN_BOSS && CLAN_BOSS.rewardRaidMarksLabelRu) || OATH_SYMBOL.nameRu || "Символ Клятвы";

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function getCharacterSlot(data, characterId) {
  data = data && typeof data === "object" ? data : {};
  const cid = String(characterId || "").slice(0, 64);
  const chars = Array.isArray(data.characters) ? data.characters : [];
  if (cid) {
    const hit = chars.find((c) => c && String(c.id) === cid);
    if (hit) return hit;
  }
  const active = resolveActiveCharacterId(data);
  if (active) {
    const hit = chars.find((c) => c && String(c.id) === String(active));
    if (hit) return hit;
  }
  return chars[0] || null;
}

function ensureProgress(slot) {
  if (!slot.progress || typeof slot.progress !== "object") slot.progress = {};
  const p = slot.progress;
  if (!p.materials || typeof p.materials !== "object") p.materials = {};
  return p;
}

function syncActiveRoot(data) {
  const activeId = resolveActiveCharacterId(data);
  const slot = getCharacterSlot(data, activeId);
  if (!slot?.progress) return data;
  const p = slot.progress;
  if (p.adena !== undefined) data.adena = p.adena;
  if (p.materials) data.materials = p.materials;
  data.activeCharacterId = activeId;
  return data;
}


let CLAN_BOSS;
try {
  CLAN_BOSS = require(path.join(
    __dirname,
    "..",
    "..",
    "game",
    "src",
    "data",
    "clan-boss-data.js"
  )).CLAN_BOSS;
} catch (_) {
  CLAN_BOSS = null;
}

if (!CLAN_BOSS) {
  CLAN_BOSS = {
    id: "clan_oathkeeper",
    name: "Хранитель Клятвы",
    reqLevel: 5,
    membersMin: 1,
    membersMax: 15,
    weeklyClears: 1,
    runTimeoutMs: 10 * 60 * 1000,
    hitIntervalMs: 150,
    baseHpHits: 100,
    hpPerExtraMember: 35,
    rewardAdenaWarehouse: 250000,
    rewardActivityScore: 80,
    rewardRaidMarks: 50,
    rewardRaidMarksLabelRu: "Символ Клятвы",
  };
}

function clanBossHpHits(memberCount) {
  const n = Math.max(1, Math.min(CLAN_BOSS.membersMax, Math.floor(Number(memberCount) || 1)));
  return Math.max(
    CLAN_BOSS.baseHpHits,
    CLAN_BOSS.baseHpHits + (CLAN_BOSS.hpPerExtraMember || 0) * (n - 1)
  );
}

function attachClanBossMethods(db, store, deps) {
  deps = deps || {};
  /** @type {Map<string, object>} clanId → run */
  const runs = new Map();

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_clan_boss_locks (
      clan_id TEXT NOT NULL,
      boss_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      clears INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (clan_id, boss_id, week_id),
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
  `);

  const stmtMemberClan = db.prepare("SELECT clan_id FROM chat_clan_members WHERE user_id = ?");
  const stmtClanGet = db.prepare("SELECT * FROM chat_clans WHERE id = ?");
  const stmtMemberRole = db.prepare(
    "SELECT role FROM chat_clan_members WHERE clan_id = ? AND user_id = ?"
  );
  const stmtLockGet = db.prepare(
    "SELECT clears FROM chat_clan_boss_locks WHERE clan_id = ? AND boss_id = ? AND week_id = ?"
  );
  const stmtLockUpsert = db.prepare(`
    INSERT INTO chat_clan_boss_locks (clan_id, boss_id, week_id, clears, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(clan_id, boss_id, week_id) DO UPDATE SET
      clears = chat_clan_boss_locks.clears + 1,
      updated_at = excluded.updated_at
  `);
  const stmtWhGet = db.prepare("SELECT adena FROM chat_clan_warehouse WHERE clan_id = ?");
  const stmtWhUpsert = db.prepare(`
    INSERT INTO chat_clan_warehouse (clan_id, adena, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(clan_id) DO UPDATE SET adena = excluded.adena, updated_at = excluded.updated_at
  `);
  const stmtWhLog = db.prepare(`
    INSERT INTO chat_clan_warehouse_log (clan_id, user_id, kind, amount, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_user_raid_marks (
      user_id INTEGER NOT NULL PRIMARY KEY,
      marks INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);
  const stmtMarksGet = db.prepare("SELECT marks FROM chat_user_raid_marks WHERE user_id = ?");
  const stmtMarksUpsert = db.prepare(`
    INSERT INTO chat_user_raid_marks (user_id, marks, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      marks = chat_user_raid_marks.marks + excluded.marks,
      updated_at = excluded.updated_at
  `);
  const stmtUserNick = db.prepare("SELECT id, nick FROM users WHERE id = ?");

  function getRaidMarks(userId) {
    return Math.max(0, Math.floor(Number(stmtMarksGet.get(userId)?.marks) || 0));
  }

  const stmtMarksSet = db.prepare(`
    INSERT INTO chat_user_raid_marks (user_id, marks, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET marks = excluded.marks, updated_at = excluded.updated_at
  `);

  function creditOathSymbolToUser(userId, amount, now) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (!add || !userId || !deps.persistPlayerSaveInternal) return { ok: false, total: getRaidMarks(userId) };
    const row = store.getSave(userId);
    if (!row) return { ok: false, total: 0 };
    const data = parseSavePayload(row);
    if (!data) return { ok: false, total: 0 };
    const dataClone = cloneJson(data);
    const slot = getCharacterSlot(dataClone, null);
    if (!slot) return { ok: false, total: 0 };
    const progress = ensureProgress(slot);
    const legacy = getRaidMarks(userId);
    if (legacy > 0) {
      progress.materials[OATH_MAT] =
        Math.max(0, Math.floor(Number(progress.materials[OATH_MAT]) || 0)) + legacy;
      stmtMarksSet.run(userId, 0, now);
    }
    progress.materials[OATH_MAT] =
      Math.max(0, Math.floor(Number(progress.materials[OATH_MAT]) || 0)) + add;
    const total = Math.max(0, Math.floor(Number(progress.materials[OATH_MAT]) || 0));
    syncActiveRoot(dataClone);
    const nextSeq = Math.max(1, (row.seq || 0) + 1);
    const savedAt = Date.now();
    const urow = stmtUserNick.get(userId);
    deps.persistPlayerSaveInternal(
      { id: userId, nick: urow?.nick || row.nick || "" },
      nextSeq,
      savedAt,
      null,
      dataClone
    );
    return { ok: true, total, save: { seq: nextSeq, savedAt, data: dataClone } };
  }

  function readOathSymbolBalance(userId) {
    const row = store.getSave(userId);
    let inv = 0;
    if (row) {
      const data = parseSavePayload(row);
      if (data) {
        const slot = getCharacterSlot(data, null);
        if (slot) {
          const progress = ensureProgress(slot);
          inv = Math.max(0, Math.floor(Number(progress.materials[OATH_MAT]) || 0));
        }
      }
    }
    return inv + getRaidMarks(userId);
  }

  function getClanId(userId) {
    return stmtMemberClan.get(userId)?.clan_id || null;
  }

  function clanRole(clanId, userId) {
    const clan = stmtClanGet.get(clanId);
    if (clan && clan.leader_user_id === userId) return "leader";
    return stmtMemberRole.get(clanId, userId)?.role || "member";
  }

  function weekClears(clanId, now) {
    const weekId = clanUtcWeekId(now);
    const row = stmtLockGet.get(clanId, CLAN_BOSS.id, weekId);
    return Math.max(0, Math.floor(Number(row?.clears) || 0));
  }

  function publicRun(run, userId) {
    if (!run) return null;
    const members = [...run.members.values()].map((m) => ({
      userId: m.userId,
      nick: m.nick,
      hits: m.hits || 0,
    }));
    const me = run.members.get(userId);
    return {
      runId: run.id,
      bossId: CLAN_BOSS.id,
      bossName: CLAN_BOSS.name,
      status: run.status,
      hp: run.hp,
      maxHp: run.maxHp,
      hpPct: run.maxHp > 0 ? Math.max(0, Math.round((run.hp / run.maxHp) * 1000) / 10) : 0,
      members,
      memberCount: members.length,
      endsAt: run.endsAt,
      remainingMs: Math.max(0, run.endsAt - Date.now()),
      myHits: me ? me.hits || 0 : 0,
      inRun: !!me,
      rewardAdena: CLAN_BOSS.rewardAdenaWarehouse,
      mob: CLAN_BOSS.mob,
      mine: CLAN_BOSS.mine,
      reward: run.reward
        ? {
            warehouseAdena: run.reward.warehouseAdena,
            warehouseTotal: run.reward.warehouseTotal,
            activity: run.reward.activity,
            raidMarksEach: run.reward.raidMarksEach,
            raidMarksLabelRu: run.reward.raidMarksLabelRu,
            myRaidMarksTotal:
              run.reward.raidMarksByUser && run.reward.raidMarksByUser[userId] != null
                ? run.reward.raidMarksByUser[userId]
                : null,
            myOathSymbols:
              run.reward.raidMarksByUser && run.reward.raidMarksByUser[userId] != null
                ? run.reward.raidMarksByUser[userId]
                : null,
            mySave:
              run.reward.savesByUser && run.reward.savesByUser[userId]
                ? run.reward.savesByUser[userId]
                : null,
          }
        : null,
    };
  }

  function expireIfNeeded(run, now) {
    if (!run || run.status !== "active") return run;
    if (now >= run.endsAt) {
      run.status = "failed";
      run.hp = Math.max(0, run.hp);
    }
    return run;
  }

  function creditWarehouse(clanId, amount, userId, now) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (!add) return 0;
    const row = stmtWhGet.get(clanId);
    const have = Math.max(0, Math.floor(Number(row?.adena) || 0));
    const next = have + add;
    stmtWhUpsert.run(clanId, next, now);
    stmtWhLog.run(clanId, userId || null, "clan_boss", add, CLAN_BOSS.id, now);
    return next;
  }

  function finishClear(run, userId, now) {
    run.status = "cleared";
    run.hp = 0;
    const weekId = clanUtcWeekId(now);
    stmtLockUpsert.run(run.clanId, CLAN_BOSS.id, weekId, now);
    const whAdena = creditWarehouse(
      run.clanId,
      CLAN_BOSS.rewardAdenaWarehouse,
      userId,
      now
    );
    let activity = null;
    if (typeof store.clanAddActivityScore === "function") {
      activity = store.clanAddActivityScore(
        run.clanId,
        CLAN_BOSS.rewardActivityScore || 0,
        { now }
      );
    }
    const marksEach = Math.max(
      0,
      Math.floor(Number(CLAN_BOSS.rewardOathSymbol ?? CLAN_BOSS.rewardRaidMarks) || 0)
    );
    const marksByUser = {};
    const savesByUser = {};
    if (marksEach > 0) {
      for (const m of run.members.values()) {
        if (!m || !m.userId) continue;
        const credited = creditOathSymbolToUser(m.userId, marksEach, now);
        marksByUser[m.userId] = credited.total || 0;
        if (credited.save) savesByUser[m.userId] = credited.save;
      }
    }
    run.reward = {
      warehouseAdena: CLAN_BOSS.rewardAdenaWarehouse,
      warehouseTotal: whAdena,
      activity,
      raidMarksEach: marksEach,
      raidMarksLabelRu: OATH_LABEL(),
      raidMarksByUser: marksByUser,
      savesByUser,
    };
    return run;
  }

  function scaleHp(run) {
    const n = run.members.size;
    const newMax = clanBossHpHits(n);
    if (newMax === run.maxHp) return;
    const ratio = run.maxHp > 0 ? run.hp / run.maxHp : 1;
    run.maxHp = newMax;
    run.hp = Math.max(1, Math.min(newMax, Math.round(newMax * ratio)));
  }

  store.clanBossMeta = function clanBossMeta() {
    return {
      ok: true,
      boss: {
        id: CLAN_BOSS.id,
        name: CLAN_BOSS.name,
        reqLevel: CLAN_BOSS.reqLevel,
        membersMin: CLAN_BOSS.membersMin,
        membersMax: CLAN_BOSS.membersMax,
        weeklyClears: CLAN_BOSS.weeklyClears,
        rewardAdenaWarehouse: CLAN_BOSS.rewardAdenaWarehouse,
        rewardActivityScore: CLAN_BOSS.rewardActivityScore,
        rewardRaidMarks: CLAN_BOSS.rewardRaidMarks,
        rewardRaidMarksLabelRu: CLAN_BOSS.rewardRaidMarksLabelRu || "Символ Клятвы",
        mine: CLAN_BOSS.mine,
        mob: CLAN_BOSS.mob,
      },
    };
  };

  store.clanBossState = function clanBossState(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const now = Number(opts.now) || Date.now();
    let run = runs.get(clanId);
    if (run) expireIfNeeded(run, now);
    if (run && (run.status === "failed" || run.status === "cleared")) {
      // keep briefly for client result, then drop after leave
    }
    const clears = weekClears(clanId, now);
    const maxClears = CLAN_BOSS.weeklyClears != null ? CLAN_BOSS.weeklyClears : 1;
    return {
      ok: true,
      weekId: clanUtcWeekId(now),
      clears,
      maxClears,
      locked: maxClears > 0 && clears >= maxClears,
      role: clanRole(clanId, user.id),
      run: publicRun(run, user.id),
      boss: store.clanBossMeta().boss,
      myRaidMarks: readOathSymbolBalance(user.id),
      myOathSymbols: readOathSymbolBalance(user.id),
      raidMarksLabelRu: OATH_LABEL(),
      oathSymbolLabelRu: OATH_LABEL(),
    };
  };

  store.clanBossStart = function clanBossStart(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const now = Number(opts.now) || Date.now();
    const clears = weekClears(clanId, now);
    const maxClears = CLAN_BOSS.weeklyClears != null ? CLAN_BOSS.weeklyClears : 1;
    if (maxClears > 0 && clears >= maxClears) {
      return { ok: false, error: "lockout", message: "Клан-босс уже пройден на этой неделе" };
    }
    let run = runs.get(clanId);
    if (run) expireIfNeeded(run, now);
    if (run && run.status === "active") {
      // Уже идёт рейд клана (даже если все вышли) — входим в тот же HP.
      return store.clanBossJoin(user, opts);
    }
    if (run && (run.status === "cleared" || run.status === "failed")) {
      runs.delete(clanId);
    }
    const maxHp = clanBossHpHits(1);
    run = {
      id: "cb_" + clanId.slice(0, 8) + "_" + now.toString(36),
      clanId,
      status: "active",
      hp: maxHp,
      maxHp,
      members: new Map(),
      createdAt: now,
      endsAt: now + (CLAN_BOSS.runTimeoutMs || 600000),
      lastHitAt: Object.create(null),
      reward: null,
    };
    run.members.set(user.id, {
      userId: user.id,
      nick: user.nick,
      hits: 0,
      joinedAt: now,
    });
    runs.set(clanId, run);
    return { ok: true, ...store.clanBossState(user, { now }) };
  };

  store.clanBossJoin = function clanBossJoin(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const now = Number(opts.now) || Date.now();
    let run = runs.get(clanId);
    if (!run) return { ok: false, error: "none", message: "Нет активного боя — начни его" };
    expireIfNeeded(run, now);
    if (run.status !== "active") {
      return { ok: false, error: "ended", message: "Бой уже закончен" };
    }
    if (!run.members.has(user.id)) {
      if (run.members.size >= CLAN_BOSS.membersMax) {
        return { ok: false, error: "full", message: "Лимит " + CLAN_BOSS.membersMax + " участников" };
      }
      run.members.set(user.id, {
        userId: user.id,
        nick: user.nick,
        hits: 0,
        joinedAt: now,
      });
      scaleHp(run);
    }
    return { ok: true, ...store.clanBossState(user, { now }) };
  };

  store.clanBossHit = function clanBossHit(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const now = Number(opts.now) || Date.now();
    let run = runs.get(clanId);
    if (!run) return { ok: false, error: "none", message: "Нет боя" };
    expireIfNeeded(run, now);
    if (run.status !== "active") {
      return { ok: true, ended: true, ...store.clanBossState(user, { now }) };
    }
    if (!run.members.has(user.id)) {
      return { ok: false, error: "join", message: "Сначала войди в бой" };
    }
    const throttle = CLAN_BOSS.hitIntervalMs || 150;
    const last = run.lastHitAt[user.id] || 0;
    if (now - last < throttle) {
      return { ok: true, throttled: true, ...store.clanBossState(user, { now }) };
    }
    run.lastHitAt[user.id] = now;
    const dmgCap = CLAN_BOSS.hitDmgMax != null ? CLAN_BOSS.hitDmgMax : 50000;
    const dmg = Math.max(1, Math.min(dmgCap, Math.floor(Number(opts.dmg) || 1)));
    run.hp = Math.max(0, run.hp - dmg);
    const m = run.members.get(user.id);
    m.hits = (m.hits || 0) + 1;
    if (run.hp <= 0) {
      finishClear(run, user.id, now);
    }
    return { ok: true, ...store.clanBossState(user, { now }) };
  };

  store.clanBossLeave = function clanBossLeave(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: true };
    const now = Number(opts.now) || Date.now();
    const run = runs.get(clanId);
    if (!run) return { ok: true, ...store.clanBossState(user, { now }) };
    expireIfNeeded(run, now);
    run.members.delete(user.id);
    // Активный рейд клана живёт до таймера/клира — выход не сбрасывает HP.
    if (run.status !== "active" && run.members.size === 0) {
      runs.delete(clanId);
    }
    return { ok: true, ...store.clanBossState(user, { now }) };
  };
}

module.exports = { attachClanBossMethods, CLAN_BOSS, clanBossHpHits };
