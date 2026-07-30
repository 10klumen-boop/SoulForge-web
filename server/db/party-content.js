"use strict";

const path = require("path");
const crypto = require("crypto");
const balance = require(path.join(
  __dirname,
  "..",
  "..",
  "game",
  "src",
  "data",
  "party-content-data.js"
));

const {
  PARTY_CONTENT,
  PARTY_FARM_ZONES,
  PARTY_DUNGEONS,
  partyAdenaMult,
  partyHitIntervalMs,
  partyFarmDailyCapMs,
  partyFarmZoneById,
  partyDungeonById,
  partyFarmMobMaxHp,
  partyInstanceMobMaxHp,
  partyInstanceStoneHits,
  partyInstanceAnvilGoal,
  partyInstanceAnvilFailMax,
  partyAnvilPlayerColor,
  ANVIL_PLAYER_COLORS,
  partyRollAdena,
  partyRollRange,
  instanceArmorPiecesForSet,
  instancePickArmorPieces,
  partyShuffle,
  partyUtcDayKey,
  partyUtcWeekKey,
} = balance;

/** @type {Map<string, object>} partyId -> farm session */
const farmSessions = new Map();
/** @type {Map<string, object>} runId -> instance run */
const instanceRuns = new Map();
/** @type {Map<string, Map<number, boolean>>} partyId -> userId -> ready */
const partyReady = new Map();

function newId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {object} store
 */
function attachPartyContentMethods(db, store) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS party_farm_caps (
      user_id INTEGER NOT NULL,
      day_key TEXT NOT NULL,
      used_ms INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, day_key),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS instance_locks (
      user_id INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      dungeon_id TEXT NOT NULL,
      period_key TEXT NOT NULL,
      clears INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, character_id, dungeon_id, period_key),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const stmtCapGet = db.prepare(
    `SELECT used_ms FROM party_farm_caps WHERE user_id = ? AND day_key = ?`
  );
  const stmtCapUpsert = db.prepare(`
    INSERT INTO party_farm_caps (user_id, day_key, used_ms, updated_at)
    VALUES (@user_id, @day_key, @used_ms, @updated_at)
    ON CONFLICT(user_id, day_key) DO UPDATE SET
      used_ms = excluded.used_ms,
      updated_at = excluded.updated_at
  `);

  const stmtLockGet = db.prepare(`
    SELECT clears FROM instance_locks
    WHERE user_id = ? AND character_id = ? AND dungeon_id = ? AND period_key = ?
  `);
  const stmtLockUpsert = db.prepare(`
    INSERT INTO instance_locks (
      user_id, character_id, dungeon_id, period_key, clears, updated_at
    ) VALUES (
      @user_id, @character_id, @dungeon_id, @period_key, @clears, @updated_at
    )
    ON CONFLICT(user_id, character_id, dungeon_id, period_key) DO UPDATE SET
      clears = excluded.clears,
      updated_at = excluded.updated_at
  `);

  function getPartyId(userId) {
    if (typeof store.chatGetSocial !== "function") return null;
    const snap = store.chatGetSocial(userId);
    return snap?.party?.id || null;
  }

  function getPartySnap(userId) {
    if (typeof store.chatGetSocial !== "function") return null;
    return store.chatGetSocial(userId)?.party || null;
  }

  function ensureReadyMap(partyId) {
    if (!partyReady.has(partyId)) partyReady.set(partyId, new Map());
    return partyReady.get(partyId);
  }

  function publicPartyWithReady(party) {
    if (!party) return null;
    const readyMap = ensureReadyMap(party.id);
    return {
      ...party,
      members: (party.members || []).map((m) => ({
        ...m,
        ready: !!readyMap.get(m.userId),
      })),
    };
  }

  /** Для chat socialSnapshot / сообщений — не сбрасывать Ready при полле чата. */
  store.partyAnnotateReady = function partyAnnotateReady(party) {
    return publicPartyWithReady(party);
  };

  store.partyGetMe = function partyGetMe(user) {
    const party = getPartySnap(user.id);
    const invites =
      typeof store.chatListPartyInvites === "function"
        ? store.chatListPartyInvites(user).invites || []
        : [];
    const outgoing =
      typeof store.chatListOutgoingPartyInvites === "function"
        ? store.chatListOutgoingPartyInvites(user).invites || []
        : [];
    let farmZoneId = null;
    let farmMemberCount = 0;
    if (party) {
      const session = farmSessions.get(party.id);
      if (session) {
        farmZoneId = session.zoneId;
        farmMemberCount = session.members.size;
      }
    }
    let instance = null;
    if (party) {
      for (const run of instanceRuns.values()) {
        if (
          run.partyId === party.id &&
          run.members.has(user.id) &&
          (run.status === "ready" || run.status === "active")
        ) {
          instance = publicInstanceState(run, user.id);
          break;
        }
      }
    }
    return {
      ok: true,
      party: publicPartyWithReady(party),
      invites,
      outgoingInvites: outgoing,
      farm: null,
      instance,
    };
  };

  store.partySetReady = function partySetReady(user, opts = {}) {
    const party = getPartySnap(user.id);
    if (!party) return { ok: false, error: "none", message: "Вы не в группе" };
    const ready = opts.ready !== false;
    ensureReadyMap(party.id).set(user.id, ready);
    return { ok: true, party: publicPartyWithReady(getPartySnap(user.id)) };
  };

  store.partyContentMeta = function partyContentMeta() {
    return {
      ok: true,
      zones: PARTY_FARM_ZONES.map((z) => ({
        id: z.id,
        name: z.name,
        desc: z.desc,
        reqPower: z.reqPower,
        reqLevel: z.reqLevel,
        dailyCapMin: z.dailyCapMin,
        minMembers: z.minMembers || PARTY_CONTENT.minMembers,
        maxMembers: z.maxMembers || PARTY_CONTENT.maxMembers,
      })),
      dungeons: PARTY_DUNGEONS.map((d) => ({
        id: d.id,
        name: d.name,
        desc: d.desc,
        reqPower: d.reqPower,
        reqLevel: d.reqLevel,
        weeklyClears:
          d.weeklyClears != null ? d.weeklyClears : PARTY_CONTENT.instance.weeklyClears ?? 3,
      })),
      balance: {
        adenaBonusPerExtra: PARTY_CONTENT.adenaBonusPerExtra,
        hitIntervalMs: PARTY_CONTENT.hitIntervalMs,
        farmDailyCapMs: PARTY_CONTENT.farmDailyCapMs,
        maxMembers: PARTY_CONTENT.maxMembers,
        minMembers: PARTY_CONTENT.minMembers,
      },
    };
  };

  function farmCapUsed(userId, now) {
    const day = partyUtcDayKey(now);
    return Number(stmtCapGet.get(userId, day)?.used_ms || 0);
  }

  function addFarmCap(userId, ms, now) {
    const day = partyUtcDayKey(now);
    const used = farmCapUsed(userId, now) + Math.max(0, Math.floor(ms));
    stmtCapUpsert.run({
      user_id: userId,
      day_key: day,
      used_ms: used,
      updated_at: now,
    });
    return used;
  }

  function instanceClears(userId, characterId, dungeonId, now) {
    const period = partyUtcWeekKey(now);
    return Number(
      stmtLockGet.get(userId, String(characterId || ""), dungeonId, period)?.clears || 0
    );
  }

  function addInstanceClear(userId, characterId, dungeonId, now) {
    const period = partyUtcWeekKey(now);
    const clears = instanceClears(userId, characterId, dungeonId, now) + 1;
    stmtLockUpsert.run({
      user_id: userId,
      character_id: String(characterId || ""),
      dungeon_id: dungeonId,
      period_key: period,
      clears,
      updated_at: now,
    });
    return clears;
  }

  function spawnFarmEncounter(session) {
    const zone = partyFarmZoneById(session.zoneId);
    if (!zone) return null;
    const members = [...session.members.values()];
    let n = members.length;
    try {
      const snap = typeof store.chatGetSocial === "function" ? store.chatGetSocial(members[0]?.userId) : null;
      if (snap?.party?.members?.length) n = Math.max(n, snap.party.members.length);
    } catch (_) {}
    n = Math.max(1, n);
    const r = Math.random();
    let type = "normal";
    if (r < 0.08) type = "elite";
    else if (r < 0.08 + (zone.mine?.goldenChance || 0.06)) type = "golden";
    const pool =
      type === "elite" || type === "golden"
        ? zone.elitePool || zone.mobPool
        : zone.mobPool;
    const mob = pool[Math.floor(Math.random() * pool.length)] || "orc";
    const maxHp = partyFarmMobMaxHp(type === "golden" ? "golden" : type === "elite" ? "elite" : "normal", zone, n);
    session.encounter = {
      id: newId("enc"),
      type,
      mob,
      name: type === "elite" ? "Элита налётчиков" : type === "golden" ? "Золотой налётчик" : "Налётчик",
      hp: maxHp,
      maxHp,
      spawnedAt: Date.now(),
      expireAt: Date.now() + (type === "elite" ? 28000 : type === "golden" ? 22000 : 18000),
      contributions: {},
    };
    return session.encounter;
  }

  function publicFarmState(session, userId) {
    if (!session) return null;
    const zone = partyFarmZoneById(session.zoneId);
    const cap = partyFarmDailyCapMs(zone);
    const now = Date.now();
    const used = farmCapUsed(userId, now);
    const members = [...session.members.values()].map((m) => ({
      userId: m.userId,
      nick: m.nick,
      power: m.power,
      characterId: m.characterId,
    }));
    const partySnap = getPartySnap(userId);
    const partySize = Math.max(members.length, (partySnap?.members || []).length);
    return {
      sessionId: session.id,
      partyId: session.partyId,
      zoneId: session.zoneId,
      members,
      memberCount: partySize,
      adenaMult: partyAdenaMult(partySize),
      encounter: session.encounter
        ? {
            id: session.encounter.id,
            type: session.encounter.type,
            mob: session.encounter.mob,
            name: session.encounter.name,
            hp: session.encounter.hp,
            maxHp: session.encounter.maxHp,
            expireAt: session.encounter.expireAt,
          }
        : null,
      cap: { usedMs: used, capMs: cap, remainingMs: Math.max(0, cap - used) },
      hitIntervalMs: partyHitIntervalMs(),
    };
  }

  store.partyFarmJoin = function partyFarmJoin() {
    return {
      ok: false,
      error: "disabled",
      message: "Групповой фарм отключён. В группе доступны только инстансы.",
    };
  };

  store.partyFarmJoin_legacy = function partyFarmJoinLegacy(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const party = getPartySnap(user.id);
    if (!party) return { ok: false, error: "party", message: "Нужна группа" };
    const zoneId = String(opts.zoneId || "");
    const zone = partyFarmZoneById(zoneId);
    if (!zone || !zone.active) return { ok: false, error: "zone", message: "Зона недоступна" };
    if ((party.members || []).length < (zone.minMembers || PARTY_CONTENT.minMembers)) {
      return {
        ok: false,
        error: "size",
        message: "Нужно минимум " + (zone.minMembers || 2) + " в группе",
      };
    }
    const used = farmCapUsed(user.id, now);
    const cap = partyFarmDailyCapMs(zone);
    if (used >= cap) {
      return { ok: false, error: "cap", message: "Дневной лимит групповой охоты исчерпан" };
    }
    const power = Math.max(1, Math.floor(Number(opts.power) || 1));
    const characterId = String(opts.characterId || "");
    let session = farmSessions.get(party.id);
    if (session && session.zoneId !== zoneId) {
      // Пока сессия жива (даже без людей в поле) — зона группы зафиксирована
      const activeZone = partyFarmZoneById(session.zoneId);
      return {
        ok: false,
        error: "zone_mismatch",
        message:
          "Группа закреплена за «" +
          (activeZone?.name || session.zoneId) +
          "». Зайдите туда же или дождитесь, пока все выйдут.",
        activeZoneId: session.zoneId,
      };
    }
    if (!session) {
      session = {
        id: newId("pf"),
        partyId: party.id,
        zoneId,
        members: new Map(),
        encounter: null,
        createdAt: now,
      };
      farmSessions.set(party.id, session);
    }
    session.members.set(user.id, {
      userId: user.id,
      nick: user.nick,
      power,
      characterId,
      lastHitAt: 0,
      joinedAt: now,
    });
    // Prune members no longer in party
    const partyIds = new Set((party.members || []).map((m) => m.userId));
    for (const uid of [...session.members.keys()]) {
      if (!partyIds.has(uid)) session.members.delete(uid);
    }
    if (!session.encounter || session.encounter.hp <= 0 || session.encounter.expireAt < now) {
      spawnFarmEncounter(session);
    }
    return { ok: true, state: publicFarmState(session, user.id) };
  };

  store.partyFarmLeave = function partyFarmLeave(user) {
    const partyId = getPartyId(user.id);
    if (!partyId) return { ok: true };
    const session = farmSessions.get(partyId);
    if (!session) return { ok: true };
    session.members.delete(user.id);
    if (session.members.size === 0) farmSessions.delete(partyId);
    return { ok: true };
  };

  store.partyFarmState = function partyFarmState(user) {
    const partyId = getPartyId(user.id);
    if (!partyId) return { ok: false, error: "party", message: "Нужна группа" };
    const session = farmSessions.get(partyId);
    if (!session || !session.members.has(user.id)) {
      return { ok: false, error: "session", message: "Сначала войдите в зону" };
    }
    const now = Date.now();
    if (session.encounter && session.encounter.expireAt < now && session.encounter.hp > 0) {
      session.encounter = null;
      spawnFarmEncounter(session);
    }
    return { ok: true, state: publicFarmState(session, user.id) };
  };

  store.partyFarmHit = function partyFarmHit(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const partyId = getPartyId(user.id);
    if (!partyId) return { ok: false, error: "party", message: "Нужна группа" };
    const session = farmSessions.get(partyId);
    if (!session || !session.members.has(user.id)) {
      return { ok: false, error: "session", message: "Нет сессии охоты" };
    }
    const member = session.members.get(user.id);
    const zone = partyFarmZoneById(session.zoneId);
    const used = farmCapUsed(user.id, now);
    const cap = partyFarmDailyCapMs(zone);
    if (used >= cap) {
      return { ok: false, error: "cap", message: "Дневной лимит исчерпан", state: publicFarmState(session, user.id) };
    }
    const interval = partyHitIntervalMs();
    if (now - (member.lastHitAt || 0) < interval - 20) {
      return { ok: true, throttled: true, state: publicFarmState(session, user.id) };
    }
    member.lastHitAt = now;
    addFarmCap(user.id, interval, now);

    let enc = session.encounter;
    if (!enc || enc.hp <= 0 || enc.expireAt < now) {
      enc = spawnFarmEncounter(session);
    }
    if (!enc) return { ok: false, error: "spawn", message: "Нет цели" };

    const power = Math.max(1, member.power || 1);
    const click = Math.max(1, Math.round(power / 4.2));
    const dmg = Math.max(1, Math.min(click * 3, Math.floor(Number(opts.dmg) || click)));
    enc.hp = Math.max(0, enc.hp - dmg);
    enc.contributions[user.id] = (enc.contributions[user.id] || 0) + dmg;

    let loot = null;
    let killed = false;
    if (enc.hp <= 0) {
      killed = true;
      const partySnap = getPartySnap(user.id);
      const n = Math.max(session.members.size, (partySnap?.members || []).length);
      const mult = partyAdenaMult(n);
      const rs = zone?.mine?.rewardScale || 1;
      const table = PARTY_CONTENT.farmAdena[enc.type] || PARTY_CONTENT.farmAdena.normal;
      const adena = partyRollAdena(table, mult, rs);
      loot = { adena, soul: 0, spirit: 0 };
      if (Math.random() < PARTY_CONTENT.farmSoulOreChance) {
        const q = PARTY_CONTENT.farmSoulOreQty;
        loot.soul = q.min + Math.floor(Math.random() * (q.max - q.min + 1));
      }
      // Personal loot for hitter; others get via their own hits/kills share on next — each kill awards the last hitter + small share to contributors
      const contribUsers = Object.keys(enc.contributions).map(Number);
      loot.shareNicks = contribUsers.length;
      session.lastKill = { encounterId: enc.id, at: now, loot: clone(loot) };
      session.encounter = null;
      spawnFarmEncounter(session);
    }

    return {
      ok: true,
      killed,
      dmg,
      loot: killed ? loot : null,
      state: publicFarmState(session, user.id),
    };
  };

  function publicInstanceState(run, userId) {
    if (!run) return null;
    const dungeon = partyDungeonById(run.dungeonId);
    const members = [...run.members.values()].map((m) => ({
      userId: m.userId,
      nick: m.nick,
      power: m.power,
      characterId: m.characterId,
      ready: !!m.ready,
    }));
    return {
      runId: run.id,
      dungeonId: run.dungeonId,
      dungeonName: dungeon?.name || run.dungeonId,
      status: run.status,
      phase: run.phase,
      waveIndex: run.waveIndex,
      lives: run.lives,
      expiresAt: run.expiresAt,
      members,
      memberCount: members.length,
      lastEvent: run.lastEvent || null,
      lastRegenHeal: run.lastRegenHeal || 0,
      partyDamageBuff: (() => {
        const b = run.partyDamageBuff;
        const now = Date.now();
        if (!b || !(b.until > now) || !(b.mult > 1)) return null;
        return {
          mult: b.mult,
          until: b.until,
          byUserId: b.byUserId || null,
          skillId: b.skillId || null,
          name: b.name || null,
        };
      })(),
      encounter: run.encounter
        ? {
            id: run.encounter.id,
            kind: run.encounter.kind,
            name: run.encounter.name,
            phaseLabel: run.encounter.phaseLabel || null,
            mechanic: run.encounter.mechanic || null,
            shieldActive: !!run.encounter.shieldActive,
            shieldStones: Array.isArray(run.encounter.shieldStones)
              ? run.encounter.shieldStones.map((s) => ({
                  id: s.id,
                  name: s.name,
                  hits: s.hits || 0,
                  maxHits: s.maxHits || 40,
                  dead: !!s.dead,
                }))
              : [],
            anvilActive: !!run.encounter.anvilActive,
            anvilProgress: Math.max(0, Math.floor(Number(run.encounter.anvilProgress) || 0)),
            anvilGoal: Math.max(0, Math.floor(Number(run.encounter.anvilGoal) || 0)),
            anvilFails: Math.max(0, Math.floor(Number(run.encounter.anvilFails) || 0)),
            anvilFailMax: Math.max(0, Math.floor(Number(run.encounter.anvilFailMax) || 0)),
            anvilPlayers: Array.isArray(run.encounter.anvilPlayers)
              ? run.encounter.anvilPlayers.map((p) => ({
                  userId: p.userId,
                  nick: p.nick,
                  color: p.color,
                }))
              : [],
            anvilMarks: Array.isArray(run.encounter.anvilMarks)
              ? run.encounter.anvilMarks.map((m) => ({
                  id: m.id,
                  windowOpen: !!m.windowOpen,
                  openEndsAt: m.windowOpen ? Math.max(0, Number(m.nextToggleAt) || 0) : 0,
                  opensAt: !m.windowOpen ? Math.max(0, Number(m.nextToggleAt) || 0) : 0,
                  ownerUserId: m.ownerUserId || null,
                  color: m.color || null,
                  left: Number.isFinite(Number(m.left)) ? Number(m.left) : null,
                  top: Number.isFinite(Number(m.top)) ? Number(m.top) : null,
                }))
              : [],
            anvilWindowMs: Math.max(0, Math.floor(Number(run.encounter.anvilWindowMs) || 0)),
            anvilCycleMs: Math.max(0, Math.floor(Number(run.encounter.anvilCycleMs) || 0)),
            addsActive: !!run.encounter.addsActive,
            addsDeadlineAt: run.encounter.addsDeadlineAt || 0,
            addsDeadlineMs: Math.max(0, Math.floor(Number(run.encounter.addsDeadlineMs) || 0)),
            addsInMs:
              run.encounter.addsActive && run.encounter.addsDeadlineAt && run.status === "active"
                ? Math.max(0, Number(run.encounter.addsDeadlineAt) - Date.now())
                : null,
            adds: Array.isArray(run.encounter.adds)
              ? run.encounter.adds.map((a) => ({
                  id: a.id,
                  name: a.name,
                  mob: a.mob,
                  hp: a.hp,
                  maxHp: a.maxHp,
                  dead: !!a.dead,
                  left: Number.isFinite(Number(a.left)) ? Number(a.left) : null,
                  top: Number.isFinite(Number(a.top)) ? Number(a.top) : null,
                }))
              : [],
            channelActive: !!run.encounter.channelActive,
            channelEndsAt: run.encounter.channelEndsAt || 0,
            channelWindowMs: Math.max(0, Math.floor(Number(run.encounter.channelWindowMs) || 0)),
            channelCycleMs: Math.max(0, Math.floor(Number(run.encounter.channelCycleMs) || 0)),
            channelFails: Math.max(0, Math.floor(Number(run.encounter.channelFails) || 0)),
            channelFailMax: Math.max(0, Math.floor(Number(run.encounter.channelFailMax) || 0)),
            channelInMs:
              run.encounter.channelActive && run.encounter.channelEndsAt && run.status === "active"
                ? Math.max(0, Number(run.encounter.channelEndsAt) - Date.now())
                : null,
            channelArmed: !!run.encounter.channelArmed,
            enrageInMs:
              run.encounter.enrageAt && run.status === "active"
                ? Math.max(0, run.encounter.enrageAt - Date.now())
                : null,
            enrageTotalMs: run.encounter.enrageMs || null,
            idleInMs: (function () {
              if (run.encounter.kind !== "wave" || run.status !== "active") return null;
              const idleMs = dungeon?.waveIdleMs || 22000;
              const deadline =
                Number(run.encounter.idleDeadlineAt) ||
                (Number(run.encounter.lastHitAt) || Date.now()) + idleMs;
              return Math.max(0, deadline - Date.now());
            })(),
            idleTotalMs:
              run.encounter.kind === "wave" ? dungeon?.waveIdleMs || 22000 : null,
            alive: (run.encounter.mobs || []).filter((m) => !m.dead).length,
            total: (run.encounter.mobs || []).length,
            mobs: (run.encounter.mobs || []).map((m) => ({
              id: m.id,
              name: m.name,
              mob: m.mob,
              hp: m.hp,
              maxHp: m.maxHp,
              dead: !!m.dead,
              shieldHp: m.shieldHp || 0,
              shieldMax: m.shieldMax || 0,
            })),
            // legacy single-target fields (first alive)
            ...(function () {
              const live = (run.encounter.mobs || []).find((m) => !m.dead);
              return live
                ? {
                    mob: live.mob,
                    hp: live.hp,
                    maxHp: live.maxHp,
                    targetId: live.id,
                  }
                : { mob: null, hp: 0, maxHp: 0, targetId: null };
            })(),
          }
        : null,
      lootByUser: run.lootByUser?.[userId] || null,
      hitIntervalMs: partyHitIntervalMs(),
      youUserId: userId,
    };
  }

  function buildInstanceEncounter(run, def, kind) {
    const powers = [...run.members.values()].map((m) => m.power);
    const dungeon = partyDungeonById(run.dungeonId);
    const count = Math.max(1, Math.min(4, Math.floor(Number(def.count) || 1)));
    const packId = newId("ie");
    const mobs = [];
    for (let i = 0; i < count; i++) {
      const unitDef = {
        hpHits: def.hpHits,
        name: def.name,
        mob: def.mob,
      };
      let maxHp = partyInstanceMobMaxHp(unitDef, dungeon, run.members.size, powers);
      if (count > 1) maxHp = Math.max(40, Math.round(maxHp * (0.72 + 0.08 * (count - 1))));
      mobs.push({
        id: packId + "_" + i,
        name: count > 1 ? def.name + " #" + (i + 1) : def.name,
        mob: def.mob || "orc",
        hp: maxHp,
        maxHp,
        dead: false,
        shieldHp: 0,
        shieldMax: 0,
      });
    }
    const now = Date.now();
    const waveIdleMs = kind === "wave" ? dungeon?.waveIdleMs || 22000 : 0;
    return {
      id: packId,
      kind,
      name: def.name,
      phaseLabel: null,
      mechanic: null,
      toughness: 1,
      regen: false,
      phases: def.phases || null,
      enrageMs: def.enrageMs || 0,
      enrageAt: kind === "boss" && def.enrageMs ? now + def.enrageMs : 0,
      regenPulseMs: def.regenPulseMs || 0,
      regenPct: def.regenPct || 0,
      nextRegenAt: kind === "boss" && def.regenPulseMs ? now + def.regenPulseMs : 0,
      lastHitAt: now,
      // Жёсткий дедлайн волны: не сбрасывается ударами (иначе UI 21↔20).
      idleDeadlineAt: kind === "wave" ? now + waveIdleMs : 0,
      lastSkillHitAt: 0,
      mobs,
    };
  }

  function encounterAlive(enc) {
    return (enc?.mobs || []).filter((m) => !m.dead);
  }

  /** Добирает шары наковальни до anvilMarkCap (после клика шар исчезает). */
  function refillAnvilMarks(enc, nowMs) {
    if (!enc || !enc.anvilActive) return;
    if ((enc.anvilProgress || 0) >= (enc.anvilGoal || 1)) return;
    if (!Array.isArray(enc.anvilMarks)) enc.anvilMarks = [];
    if (!Array.isArray(enc.anvilPlayers) || !enc.anvilPlayers.length) return;
    const cap = Math.max(1, Math.min(8, Math.floor(Number(enc.anvilMarkCap) || 6)));
    const windowMs = Math.max(600, Math.floor(Number(enc.anvilWindowMs) || 1400));
    const cycleMs = Math.max(windowMs + 200, Math.floor(Number(enc.anvilCycleMs) || 2200));
    const now = Number(nowMs) || Date.now();
    const leftMin = 14;
    const leftMax = 86;
    const topMin = 38;
    const topMax = 74;
    const minDist = 16;
    // Босс стоит примерно в центре поля — шары не кладём поверх него.
    const bossL = 50;
    const bossT = 42;
    const bossClear = 24;
    let guard = 0;
    while (enc.anvilMarks.length < cap && guard++ < 32) {
      let left = leftMin + 8;
      let top = topMin + 8;
      for (let tryN = 0; tryN < 64; tryN++) {
        // Чаще по бокам / снизу, реже у центра
        let candL;
        let candT;
        const lane = Math.random();
        if (lane < 0.42) {
          candL = leftMin + Math.random() * (36 - leftMin);
          candT = topMin + Math.random() * (topMax - topMin);
        } else if (lane < 0.84) {
          candL = 64 + Math.random() * (leftMax - 64);
          candT = topMin + Math.random() * (topMax - topMin);
        } else {
          candL = 22 + Math.random() * 56;
          candT = 60 + Math.random() * (topMax - 60);
        }
        const dbx = candL - bossL;
        const dby = candT - bossT;
        if (dbx * dbx + dby * dby < bossClear * bossClear) continue;
        let ok = true;
        for (const s of enc.anvilMarks) {
          if (!s) continue;
          const dx = candL - Number(s.left);
          const dy = candT - Number(s.top);
          if (dx * dx + dy * dy < minDist * minDist) {
            ok = false;
            break;
          }
        }
        if (ok) {
          left = candL;
          top = candT;
          break;
        }
      }
      // Финальный отжим от босса, если рандом не нашёл идеальную точку
      {
        const dbx = left - bossL;
        const dby = top - bossT;
        const d2 = dbx * dbx + dby * dby;
        if (d2 < bossClear * bossClear) {
          const d = Math.sqrt(Math.max(0.01, d2));
          const push = bossClear / d;
          left = bossL + dbx * push;
          top = bossT + dby * push;
          if (Math.abs(dbx) < 0.1 && Math.abs(dby) < 0.1) {
            left = Math.random() < 0.5 ? leftMin + 6 : leftMax - 6;
            top = 58 + Math.random() * 12;
          }
        }
      }
      left = Math.max(leftMin, Math.min(leftMax, left));
      top = Math.max(topMin, Math.min(topMax, top));
      // Владелец с наименьшим числом шаров на поле (чтобы после клика свой цвет не пропадал).
      const counts = new Map();
      for (const p of enc.anvilPlayers) counts.set(String(p.userId), 0);
      for (const m of enc.anvilMarks) {
        const key = String(m.ownerUserId);
        if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
      }
      let owner = enc.anvilPlayers[0];
      let bestN = Infinity;
      for (const p of enc.anvilPlayers) {
        const n = counts.get(String(p.userId)) || 0;
        if (n < bestN) {
          bestN = n;
          owner = p;
        }
      }
      enc.anvilSpawnSeq = Math.max(0, Math.floor(Number(enc.anvilSpawnSeq) || 0)) + 1;
      const seq = enc.anvilSpawnSeq;
      const stagger = 200 + Math.floor(Math.random() * Math.max(400, Math.floor(cycleMs * 0.45)));
      enc.anvilMarks.push({
        id: (enc.id || "boss") + "_anvil_" + seq,
        windowOpen: false,
        openEndsAt: 0,
        nextToggleAt: now + stagger,
        ownerUserId: owner.userId,
        color: owner.color,
        left: Math.round(left * 10) / 10,
        top: Math.round(top * 10) / 10,
      });
    }
  }

  function consumeAnvilMark(enc, mark) {
    if (!enc || !mark || !Array.isArray(enc.anvilMarks)) return false;
    const idx = enc.anvilMarks.findIndex((m) => m && m.id === mark.id);
    if (idx < 0) return false;
    enc.anvilMarks.splice(idx, 1);
    return true;
  }

  /** Позиции аддов вокруг босса (слева/справа/снизу). */
  function spawnBossAdds(enc, ph, run, nowMs) {
    const dungeon = partyDungeonById(run?.dungeonId);
    const powers = [...(run?.members?.values?.() || [])].map((m) => m.power);
    const n = Math.max(1, Math.min(4, Math.floor(Number(ph.addCount) || 3)));
    const addHpHits = Math.max(8, Math.floor(Number(ph.addHpHits) || 24));
    const addMob = String(ph.addMob || "whisper-shade");
    const addName = String(ph.addName || "Тень");
    const deadlineMs = Math.max(6000, Math.floor(Number(ph.addsDeadlineMs) || 18000));
    const slots = [
      { left: 22, top: 48 },
      { left: 78, top: 48 },
      { left: 50, top: 72 },
      { left: 35, top: 68 },
    ];
    const unitDef = { hpHits: addHpHits, name: addName, mob: addMob };
    let maxHp = partyInstanceMobMaxHp(unitDef, dungeon, run.members.size, powers);
    maxHp = Math.max(30, Math.round(maxHp * 0.55));
    const phKey = String(ph.label || "adds");
    enc.adds = [];
    for (let i = 0; i < n; i++) {
      const slot = slots[i % slots.length];
      enc.adds.push({
        id: (enc.id || "boss") + "_add_" + i + "_" + phKey.replace(/\s+/g, ""),
        name: n > 1 ? addName + " #" + (i + 1) : addName,
        mob: addMob,
        hp: maxHp,
        maxHp,
        dead: false,
        left: slot.left,
        top: slot.top,
      });
    }
    enc.addsActive = true;
    enc.addsDeadlineMs = deadlineMs;
    enc.addsDeadlineAt = (Number(nowMs) || Date.now()) + deadlineMs;
    enc.addsSpawnedFor = phKey;
  }

  function armBossChannel(enc, ph, nowMs, resetFails) {
    const windowMs = Math.max(800, Math.floor(Number(ph.channelWindowMs) || 2800));
    const cycleMs = Math.max(windowMs + 400, Math.floor(Number(ph.channelCycleMs) || 7000));
    const failMax = Math.max(1, Math.floor(Number(ph.channelFailMax) || 3));
    enc.channelArmed = true;
    enc.channelWindowMs = windowMs;
    enc.channelCycleMs = cycleMs;
    enc.channelFailMax = failMax;
    if (resetFails) enc.channelFails = 0;
    enc.channelActive = false;
    enc.channelEndsAt = 0;
    // Первый канал чуть позже входа в фазу
    enc.nextChannelAt = (Number(nowMs) || Date.now()) + Math.floor(cycleMs * 0.35);
  }

  function applyBossPhase(enc, nowMs, run) {
    if (!enc || enc.kind !== "boss" || !Array.isArray(enc.phases) || !enc.phases.length) return;
    const boss = enc.mobs && enc.mobs[0];
    if (!boss || boss.dead) return;
    const now = Number(nowMs) || Date.now();
    const ratio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
    // Выбираем фазу по HP, но не откатываемся назад (реген не возвращает щит)
    let activeIdx = 0;
    for (let i = 0; i < enc.phases.length; i++) {
      if (ratio <= Number(enc.phases[i].at)) activeIdx = i;
    }
    const prevIdx = Math.max(0, Math.floor(Number(enc.phaseIndex) || 0));
    if (activeIdx < prevIdx) activeIdx = prevIdx;
    enc.phaseIndex = activeIdx;
    const active = enc.phases[activeIdx];
    enc.phaseLabel = active.label || null;
    enc.toughness = Math.max(1, Number(active.toughness || active.dmgMult || 1));
    // Реген «липкий»: раз вошли в фазу с regen — держим до смерти (иначе Бешенство сбрасывает)
    if (active.regen) {
      enc.regenLatched = true;
      if (!enc.regenArmed) {
        enc.regenArmed = true;
        enc.nextRegenAt = now;
      }
    }
    enc.regen = !!(active.regen || enc.regenLatched);
    if (!enc.anvilDoneLabels) enc.anvilDoneLabels = {};
    if (!enc.shieldDoneLabels) enc.shieldDoneLabels = {};
    if (!enc.addsDoneLabels) enc.addsDoneLabels = {};
    if (!enc.channelDoneLabels) enc.channelDoneLabels = {};
    // Одноразовые механики — по всем фазам до activeIdx (не пропускать при огромном уроне / testHpScale)
    if (!enc.anvilActive && !enc.shieldActive && !enc.addsActive) {
      for (let i = 0; i <= activeIdx; i++) {
        const ph = enc.phases[i];
        if (!ph) continue;
        const phKey = String(ph.label || i);
        const wantsAnvil = ph.mechanic === "anvil" || !!(ph.anvilGoal || ph.anvilMarks);
        if (wantsAnvil && !enc.anvilDoneLabels[phKey]) {
          enc.anvilDoneLabels[phKey] = true;
          const partyMembers = run && run.members ? [...run.members.values()] : [];
          const nPlayers = Math.max(1, partyMembers.length);
          const n = Math.max(4, Math.min(8, Math.floor(Number(ph.anvilMarks) || 6)));
          const goal =
            typeof partyInstanceAnvilGoal === "function"
              ? partyInstanceAnvilGoal(ph)
              : Math.max(4, Math.floor(Number(ph.anvilGoal) || 48));
          const windowMs = Math.max(600, Math.floor(Number(ph.anvilWindowMs) || 1400));
          const cycleMs = Math.max(windowMs + 200, Math.floor(Number(ph.anvilCycleMs) || 2200));
          const failMax =
            typeof partyInstanceAnvilFailMax === "function"
              ? partyInstanceAnvilFailMax(ph, nPlayers)
              : Math.max(6, Math.floor(Number(ph.anvilFailMax) || 10));
          enc.anvilActive = true;
          enc.anvilProgress = 0;
          enc.anvilGoal = goal;
          enc.anvilWindowMs = windowMs;
          enc.anvilCycleMs = cycleMs;
          enc.anvilFails = 0;
          enc.anvilFailMax = failMax;
          enc.anvilMarkCap = n;
          enc.anvilSpawnSeq = 0;
          // Цвета и владельцы меток — рандом на каждую фазу наковальни
          const colorPool = partyShuffle(
            (typeof ANVIL_PLAYER_COLORS !== "undefined" ? ANVIL_PLAYER_COLORS : []).slice()
          );
          const palette =
            colorPool.length > 0
              ? colorPool
              : ["#ff5a5a", "#4da3ff", "#5dff8a", "#ffd24a", "#d48cff", "#ff9a3c"];
          const shuffledMembers = partyShuffle(partyMembers.slice());
          enc.anvilPlayers = shuffledMembers.map((m, idx) => ({
            userId: m.userId,
            nick: m.nick,
            color: palette[idx % palette.length],
          }));
          if (!enc.anvilPlayers.length) {
            enc.anvilPlayers = [
              { userId: "solo", nick: "Игрок", color: palette[0] || partyAnvilPlayerColor(0) },
            ];
          }
          enc.anvilMarks = [];
          refillAnvilMarks(enc, now);
          enc.phaseLabel = ph.label || enc.phaseLabel;
          boss.shieldHp = 0;
          boss.shieldMax = 0;
          break;
        }
        const wantsShield = !!(ph.shieldStones || ph.shieldHits);
        if (wantsShield && !enc.shieldDoneLabels[phKey]) {
          enc.shieldDoneLabels[phKey] = true;
          const n = Math.max(1, Math.min(4, Math.floor(Number(ph.shieldStones) || 3)));
          const need =
            typeof partyInstanceStoneHits === "function"
              ? partyInstanceStoneHits(ph)
              : Math.max(5, Math.floor(Number(ph.stoneHits || ph.shieldHits) || 40));
          enc.shieldActive = true;
          enc.shieldSpawnedFor = phKey;
          enc.shieldStones = [];
          for (let si = 0; si < n; si++) {
            enc.shieldStones.push({
              id: (enc.id || "boss") + "_stone_" + si + "_" + phKey.replace(/\s+/g, ""),
              name: "Кристалл щита",
              hits: 0,
              maxHits: need,
              dead: false,
            });
          }
          enc.phaseLabel = ph.label || enc.phaseLabel;
          boss.shieldHp = 0;
          boss.shieldMax = 0;
          break;
        }
        const wantsAdds = ph.mechanic === "adds" || !!(ph.addCount || ph.addHpHits);
        if (wantsAdds && !enc.addsDoneLabels[phKey]) {
          enc.addsDoneLabels[phKey] = true;
          spawnBossAdds(enc, ph, run, now);
          enc.phaseLabel = ph.label || enc.phaseLabel;
          boss.shieldHp = 0;
          boss.shieldMax = 0;
          break;
        }
      }
    }
    // Channel: вооружаем при проходе фазы (как anvil — не скипнуть огромным уроном)
    {
      let armedThisPass = false;
      for (let i = 0; i <= activeIdx; i++) {
        const ph = enc.phases[i];
        if (!ph) continue;
        const phKey = String(ph.label || i);
        const wantsChannel = ph.mechanic === "channel" || !!(ph.channelWindowMs || ph.channelCycleMs);
        if (wantsChannel && !enc.channelDoneLabels[phKey]) {
          enc.channelDoneLabels[phKey] = true;
          armBossChannel(enc, ph, now, !armedThisPass);
          enc.phaseLabel = ph.label || enc.phaseLabel;
          armedThisPass = true;
        }
      }
      // Не снимаем channelArmed при уходе в финальную non-channel фазу —
      // иначе скип уроном мгновенно обезоруживает только что вооружённый канал.
    }
    if (enc.anvilActive) {
      boss.shieldHp = 0;
      boss.shieldMax = 0;
      if ((enc.anvilProgress || 0) >= (enc.anvilGoal || 1)) {
        enc.anvilActive = false;
        enc.anvilMarks = [];
        enc.anvilProgress = enc.anvilGoal || 0;
      }
    }
    if (enc.shieldActive && Array.isArray(enc.shieldStones)) {
      const alive = enc.shieldStones.filter((s) => !s.dead).length;
      boss.shieldHp = 0;
      boss.shieldMax = 0;
      if (alive <= 0) {
        enc.shieldActive = false;
        enc.shieldStones = [];
        boss.shieldHp = 0;
        boss.shieldMax = 0;
      }
    }
    if (enc.addsActive && Array.isArray(enc.adds)) {
      const aliveAdds = enc.adds.filter((a) => a && !a.dead).length;
      boss.shieldHp = 0;
      boss.shieldMax = 0;
      if (aliveAdds <= 0) {
        enc.addsActive = false;
        enc.adds = [];
        enc.addsDeadlineAt = 0;
      }
    }
    enc.mechanic = enc.anvilActive
      ? "anvil"
      : enc.shieldActive
        ? "shield"
        : enc.addsActive
          ? "adds"
          : enc.channelActive
            ? "channel"
            : enc.channelArmed
              ? "channel"
              : enc.regen
                ? "regen"
                : enc.toughness > 1.05
                  ? "tough"
                  : null;
  }

  function tickAnvilMarks(enc, now) {
    if (!enc || !enc.anvilActive || !Array.isArray(enc.anvilMarks)) return;
    const windowMs = Math.max(600, Math.floor(Number(enc.anvilWindowMs) || 1400));
    const cycleMs = Math.max(windowMs + 200, Math.floor(Number(enc.anvilCycleMs) || 2200));
    const closedMs = Math.max(200, cycleMs - windowMs);
    now = Number(now) || Date.now();
    for (const mark of enc.anvilMarks) {
      if (!mark) continue;
      while ((mark.nextToggleAt || 0) <= now) {
        if (mark.windowOpen) {
          mark.windowOpen = false;
          mark.openEndsAt = 0;
          mark.nextToggleAt = (mark.nextToggleAt || now) + closedMs;
        } else {
          mark.windowOpen = true;
          mark.openEndsAt = (mark.nextToggleAt || now) + windowMs;
          mark.nextToggleAt = mark.openEndsAt;
        }
      }
    }
  }

  function instanceMinMembers() {
    return Math.max(2, Math.floor(Number(PARTY_CONTENT.minMembers) || 2));
  }

  /** Если в ране меньше minMembers — лобби сбрасываем, бой фейлим. */
  function enforceInstancePartySize(run) {
    if (!run) return false;
    const min = instanceMinMembers();
    if (run.members.size >= min) return false;
    if (run.members.size <= 0) {
      instanceRuns.delete(run.id);
      return true;
    }
    if (run.status === "ready") {
      instanceRuns.delete(run.id);
      return true;
    }
    if (run.status === "active") {
      run.status = "failed";
      run.phase = "undersized";
      run.encounter = null;
      run.lastEvent = "party_broke";
      return true;
    }
    return false;
  }

  function rollInstanceLoot(run, dungeon) {
    const lootDef = dungeon.loot || {};
    const members = [...run.members.values()];
    const mult = partyAdenaMult(members.length);
    const pool = Array.isArray(lootDef.armorSetPool) ? lootDef.armorSetPool : [];
    const maxArmor = Math.max(
      0,
      Math.min(2, Math.floor(Number(lootDef.armorPiecesMax != null ? lootDef.armorPiecesMax : 2)))
    );
    run.lootByUser = {};
    for (const m of members) {
      run.lootByUser[m.userId] = {
        adena: partyRollAdena(lootDef.adena, mult, 1),
        soul: partyRollRange(lootDef.soul),
        spirit: partyRollRange(lootDef.spirit),
        xp: partyRollRange(lootDef.xp),
        weaponGrade: null,
        armorSetId: null,
        armorIds: [],
      };
    }
    if (!members.length) return;

    // Оружие: 1..N штук грейда инста, случайные получатели (без дублей)
    const grade = lootDef.weaponGrade || null;
    if (grade) {
      const weaponDrops = Math.max(1, Math.min(members.length, 1 + Math.floor(Math.random() * members.length)));
      const order = typeof partyShuffle === "function" ? partyShuffle(members) : members.slice();
      for (let i = 0; i < weaponDrops; i++) {
        run.lootByUser[order[i].userId].weaponGrade = grade;
      }
    }

    // Броня: пул кусков на пати, раздача с капом maxArmor на игрока (не полный сет)
    if (pool.length && maxArmor > 0) {
      const minPieces = Math.max(1, members.length);
      const maxPieces = members.length * maxArmor;
      const totalPieces = Math.min(
        maxPieces,
        minPieces + Math.floor(Math.random() * (maxPieces - minPieces + 1))
      );
      const counts = {};
      for (const m of members) counts[m.userId] = 0;
      for (let i = 0; i < totalPieces; i++) {
        const eligible = members.filter((m) => counts[m.userId] < maxArmor);
        if (!eligible.length) break;
        const m = eligible[Math.floor(Math.random() * eligible.length)];
        const bag = run.lootByUser[m.userId];
        const pick =
          typeof instancePickArmorPieces === "function"
            ? instancePickArmorPieces(pool, 1)
            : { setId: null, armorIds: [] };
        let pid = pick.armorIds && pick.armorIds[0];
        if (pid && bag.armorIds.indexOf(pid) >= 0) {
          const alt = (instanceArmorPiecesForSet(pick.setId) || []).filter((id) => bag.armorIds.indexOf(id) < 0);
          pid = alt.length ? alt[Math.floor(Math.random() * alt.length)] : null;
        }
        if (!pid) continue;
        bag.armorIds.push(pid);
        counts[m.userId]++;
        if (!bag.armorSetId && pick.setId) bag.armorSetId = pick.setId;
      }
    }

    const now = Date.now();
    for (const m of members) {
      addInstanceClear(m.userId, m.characterId, run.dungeonId, now);
    }
  }

  function advanceInstance(run) {
    const dungeon = partyDungeonById(run.dungeonId);
    if (!dungeon) {
      run.status = "failed";
      return;
    }
    if (run.phase === "ready") {
      run.phase = "wave";
      run.waveIndex = 0;
      run.encounter = buildInstanceEncounter(run, dungeon.waves[0], "wave");
      run.encounter._powersCache = [...run.members.values()].map((m) => m.power);
      run.status = "active";
      return;
    }
    if (run.phase === "wave") {
      const next = run.waveIndex + 1;
      if (next < dungeon.waves.length) {
        run.waveIndex = next;
        run.encounter = buildInstanceEncounter(run, dungeon.waves[next], "wave");
        run.encounter._powersCache = [...run.members.values()].map((m) => m.power);
        return;
      }
      run.phase = "boss";
      run.encounter = buildInstanceEncounter(run, dungeon.boss, "boss");
      run.encounter._powersCache = [...run.members.values()].map((m) => m.power);
      applyBossPhase(run.encounter, Date.now(), run);
      return;
    }
    if (run.phase === "boss") {
      run.status = "cleared";
      run.phase = "done";
      run.encounter = null;
      run.finishedAt = Date.now();
      rollInstanceLoot(run, dungeon);
    }
  }

  function tickInstanceMechanics(run, now) {
    if (!run || run.status !== "active" || !run.encounter) return;
    const enc = run.encounter;
    const dungeon = partyDungeonById(run.dungeonId);
    now = Number(now) || Date.now();

    // Wave timer — жёсткий дедлайн с спавна пака (не от lastHit).
    if (enc.kind === "wave") {
      const idleMs = dungeon?.waveIdleMs || 22000;
      const deadline =
        Number(enc.idleDeadlineAt) ||
        (Number(enc.lastHitAt) || now) + idleMs;
      if (!enc.idleDeadlineAt) enc.idleDeadlineAt = deadline;
      if (now >= deadline) {
        run.lives = Math.max(0, (run.lives || 0) - 1);
        run.lastEvent = "idle_rampage";
        if (run.lives <= 0) {
          run.status = "failed";
          run.phase = "wipe";
          run.encounter = null;
          return;
        }
        // refresh current wave
        const def = dungeon.waves[run.waveIndex];
        if (def) {
          run.encounter = buildInstanceEncounter(run, def, "wave");
          run.encounter._powersCache = [...run.members.values()].map((m) => m.power);
        }
      }
      return;
    }

    if (enc.kind === "boss") {
      const boss = enc.mobs && enc.mobs[0];
      if (!boss || boss.dead) return;

      if (enc.enrageAt && now >= enc.enrageAt) {
        run.lives = Math.max(0, (run.lives || 0) - 1);
        run.lastEvent = "enrage";
        enc.enrageAt = enc.enrageMs ? now + enc.enrageMs : 0;
        if (run.lives <= 0) {
          run.status = "failed";
          run.phase = "wipe";
          run.encounter = null;
          return;
        }
      }

      applyBossPhase(enc, now, run);
      tickAnvilMarks(enc, now);

      // Адды: дедлайн → −life и респавн; 0 lives → wipe
      if (enc.addsActive && Array.isArray(enc.adds) && enc.addsDeadlineAt && now >= enc.addsDeadlineAt) {
        const aliveAdds = enc.adds.filter((a) => a && !a.dead);
        if (aliveAdds.length > 0) {
          run.lives = Math.max(0, (run.lives || 0) - 1);
          run.lastEvent = "adds_fail";
          if (run.lives <= 0) {
            run.status = "failed";
            run.phase = "wipe";
            run.encounter = null;
            return;
          }
          // Респавн аддов с тем же дедлайном
          const ph =
            (enc.phases || []).find((p) => String(p.label) === String(enc.addsSpawnedFor)) ||
            (enc.phases || []).find((p) => p.mechanic === "adds") ||
            { addCount: enc.adds.length, addHpHits: 28, addMob: "whisper-shade", addsDeadlineMs: enc.addsDeadlineMs };
          spawnBossAdds(enc, { ...ph, label: enc.addsSpawnedFor || ph.label }, run, now);
        }
      }

      // Канал: старт окна / провал окна
      if (enc.channelArmed) {
        if (!enc.channelActive && enc.nextChannelAt && now >= enc.nextChannelAt) {
          enc.channelActive = true;
          enc.channelEndsAt = now + Math.max(800, enc.channelWindowMs || 2800);
          enc.nextChannelAt = 0;
          run.lastEvent = "channel_start";
          enc.mechanic = "channel";
        } else if (enc.channelActive && enc.channelEndsAt && now >= enc.channelEndsAt) {
          enc.channelActive = false;
          enc.channelEndsAt = 0;
          enc.channelFails = Math.max(0, (enc.channelFails || 0) + 1);
          run.lastEvent = "channel_fail";
          const failMax = Math.max(1, enc.channelFailMax || 3);
          if ((enc.channelFails || 0) >= failMax) {
            run.status = "failed";
            run.phase = "wipe";
            run.encounter = null;
            return;
          }
          run.lives = Math.max(0, (run.lives || 0) - 1);
          if (run.lives <= 0) {
            run.status = "failed";
            run.phase = "wipe";
            run.encounter = null;
            return;
          }
          enc.nextChannelAt = now + Math.max(1200, Math.floor((enc.channelCycleMs || 7000) * 0.55));
        }
      }

      if (enc.regen && enc.regenPulseMs && enc.nextRegenAt && now >= enc.nextRegenAt) {
        // Один скилл гасит один тик регена (не всё окно 8с)
        const skillOk = enc.lastSkillHitAt && enc.lastSkillHitAt > (enc.lastRegenAt || 0);
        if (!skillOk) {
          const heal = Math.max(1, Math.round(boss.maxHp * (enc.regenPct || 0.04)));
          const before = boss.hp;
          boss.hp = Math.min(boss.maxHp, boss.hp + heal);
          if (boss.hp > before) {
            run.lastEvent = "boss_regen";
            run.lastRegenHeal = boss.hp - before;
          }
        } else {
          run.lastEvent = "boss_regen_blocked";
          run.lastRegenHeal = 0;
        }
        enc.lastRegenAt = now;
        enc.nextRegenAt = now + enc.regenPulseMs;
      }
      applyBossPhase(enc, now, run);
    }
  }

  function updateBossPhase(enc, run) {
    applyBossPhase(enc, Date.now(), run);
  }

  store.instanceActive = function instanceActive(user) {
    const partyId = getPartyId(user.id);
    if (!partyId) return { ok: true, state: null };
    for (const run of instanceRuns.values()) {
      if (
        run.partyId === partyId &&
        run.members.has(user.id) &&
        (run.status === "ready" || run.status === "active")
      ) {
        return { ok: true, state: publicInstanceState(run, user.id) };
      }
    }
    return { ok: true, state: null };
  };

  store.instanceStart = function instanceStart(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const party = getPartySnap(user.id);
    if (!party) return { ok: false, error: "party", message: "Нужна группа" };
    if (party.leaderUserId !== user.id) {
      return { ok: false, error: "leader", message: "Запускает только лидер" };
    }
    const dungeonId = String(opts.dungeonId || "");
    const dungeon = partyDungeonById(dungeonId);
    if (!dungeon) return { ok: false, error: "dungeon", message: "Инстанс не найден" };
    if ((party.members || []).length < instanceMinMembers()) {
      return { ok: false, error: "size", message: "Нужно минимум " + instanceMinMembers() + " в группе" };
    }
    const reqLevel = Math.max(1, Math.floor(Number(dungeon.reqLevel) || 1));
    const reqPower = Math.max(0, Math.floor(Number(dungeon.reqPower) || 0));
    // Уровень/сила — у ВСЕХ членов группы (save.active_level + opts.levels/powers)
    for (const m of party.members || []) {
      const save = typeof store.getSave === "function" ? store.getSave(m.userId) : null;
      let levelFromSave = Math.max(1, Math.floor(Number(save?.active_level) || 1));
      try {
        const row = db
          .prepare(
            `SELECT level FROM player_characters
             WHERE user_id = ? AND created = 1
             ORDER BY level DESC, slot_id ASC LIMIT 1`
          )
          .get(m.userId);
        if (row && row.level != null) {
          levelFromSave = Math.max(levelFromSave, Math.floor(Number(row.level) || 1));
        }
      } catch (_) {}
      const levelFromOpts = Math.max(0, Math.floor(Number(opts.levels?.[m.userId]) || 0));
      const level = Math.max(levelFromSave, levelFromOpts);
      if (level < reqLevel) {
        return {
          ok: false,
          error: "level",
          message: "У " + (m.nick || "игрока") + " ур. " + level + " (нужен " + reqLevel + ")",
        };
      }
      const power = Math.max(
        1,
        Math.floor(Number(opts.powers?.[m.userId]) || (m.userId === user.id ? Number(opts.power) : 0) || 0)
      );
      // Если сила не передана для мембера — не блокируем по силе (лидер проверит свой power ниже)
      if (opts.powers && opts.powers[m.userId] != null && power < reqPower) {
        return {
          ok: false,
          error: "power",
          message: "У " + (m.nick || "игрока") + " сила " + power + " (нужна " + reqPower + ")",
        };
      }
    }
    if (Math.max(1, Math.floor(Number(opts.power) || 0)) < reqPower) {
      return {
        ok: false,
        error: "power",
        message: "Недостаточно силы лидера (нужна " + reqPower + ")",
      };
    }
    // Clear existing run for party
    for (const [rid, run] of instanceRuns) {
      if (run.partyId === party.id && run.status === "active") {
        return { ok: false, error: "busy", message: "Уже есть активный инстанс" };
      }
      if (run.partyId === party.id && (run.status === "cleared" || run.status === "failed")) {
        instanceRuns.delete(rid);
      }
    }
    const members = new Map();
    for (const m of party.members || []) {
      members.set(m.userId, {
        userId: m.userId,
        nick: m.nick,
        power: Math.max(1, Math.floor(Number(opts.powers?.[m.userId]) || Number(opts.power) || 80)),
        characterId: String(opts.characterIds?.[m.userId] || opts.characterId || ""),
        ready: false,
        lastHitAt: 0,
      });
    }
    // Apply starter power for leader from opts
    if (members.has(user.id)) {
      members.get(user.id).power = Math.max(1, Math.floor(Number(opts.power) || members.get(user.id).power));
      members.get(user.id).characterId = String(opts.characterId || members.get(user.id).characterId);
    }

    for (const m of members.values()) {
      const clears = instanceClears(m.userId, m.characterId, dungeonId, now);
      const maxClears =
        dungeon.weeklyClears != null
          ? dungeon.weeklyClears
          : PARTY_CONTENT.instance.weeklyClears ?? 3;
      // 0 = безлимит (тест)
      if (maxClears > 0 && clears >= maxClears) {
        return {
          ok: false,
          error: "lockout",
          message: "У " + m.nick + " исчерпан weekly-лимит инстанса",
        };
      }
    }

    // Clear ready lobby runs
    for (const [rid, run] of instanceRuns) {
      if (run.partyId === party.id && run.status === "ready") {
        instanceRuns.delete(rid);
      }
    }

    const run = {
      id: newId("ir"),
      partyId: party.id,
      dungeonId,
      status: "ready",
      phase: "ready",
      waveIndex: 0,
      lives: dungeon.lives || PARTY_CONTENT.instance.lives,
      members,
      encounter: null,
      createdAt: now,
      expiresAt: now + (dungeon.runTimeoutMs || PARTY_CONTENT.instance.runTimeoutMs),
      lootByUser: {},
      lastEvent: null,
    };
    instanceRuns.set(run.id, run);
    if (typeof store.partyLfgClearParty === "function") {
      store.partyLfgClearParty(party.id);
    }
    // Бой стартует только когда ВСЕ нажали Ready в инстансе
    return { ok: true, state: publicInstanceState(run, user.id) };
  };

  store.instanceReady = function instanceReady(user, opts = {}) {
    const runId = String(opts.runId || "");
    let run = instanceRuns.get(runId);
    if (!run) {
      // Find by party
      const partyId = getPartyId(user.id);
      for (const r of instanceRuns.values()) {
        if (r.partyId === partyId && (r.status === "ready" || r.status === "active")) {
          run = r;
          break;
        }
      }
    }
    if (!run || !run.members.has(user.id)) {
      return { ok: false, error: "run", message: "Инстанс не найден" };
    }
    const m = run.members.get(user.id);
    m.ready = opts.ready !== false;
    if (opts.power != null) m.power = Math.max(1, Math.floor(Number(opts.power) || m.power));
    if (opts.characterId) m.characterId = String(opts.characterId);
    if (run.status === "ready" && run.members.size < instanceMinMembers()) {
      instanceRuns.delete(run.id);
      return {
        ok: false,
        error: "size",
        message: "В инстансе осталось меньше " + instanceMinMembers() + " игроков",
      };
    }
    if (
      run.status === "ready" &&
      run.members.size >= instanceMinMembers() &&
      [...run.members.values()].every((x) => x.ready)
    ) {
      advanceInstance(run);
    }
    return { ok: true, state: publicInstanceState(run, user.id) };
  };

  store.instanceState = function instanceState(user, opts = {}) {
    const runId = String(opts.runId || "");
    let run = runId ? instanceRuns.get(runId) : null;
    if (!run) {
      const partyId = getPartyId(user.id);
      for (const r of instanceRuns.values()) {
        if (r.partyId === partyId && r.members.has(user.id)) {
          run = r;
          break;
        }
      }
    }
    if (!run || !run.members.has(user.id)) {
      return { ok: false, error: "run", message: "Нет активного инстанса" };
    }
    const now = Number(opts.now) || Date.now();
    if (run.status === "active" && run.expiresAt < now) {
      run.status = "failed";
      run.phase = "timeout";
      run.encounter = null;
    } else if (run.status === "active") {
      tickInstanceMechanics(run, now);
    }
    return { ok: true, state: publicInstanceState(run, user.id) };
  };

  store.instanceHit = function instanceHit(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const runId = String(opts.runId || "");
    let run = runId ? instanceRuns.get(runId) : null;
    if (!run) {
      const partyId = getPartyId(user.id);
      for (const r of instanceRuns.values()) {
        if (r.partyId === partyId && r.status === "active" && r.members.has(user.id)) {
          run = r;
          break;
        }
      }
    }
    if (!run || !run.members.has(user.id)) {
      return { ok: false, error: "run", message: "Нет активного инстанса" };
    }
    if (run.status !== "active") {
      return { ok: true, state: publicInstanceState(run, user.id) };
    }
    tickInstanceMechanics(run, now);
    if (run.status !== "active") {
      return { ok: true, state: publicInstanceState(run, user.id) };
    }
    if (run.expiresAt < now) {
      run.status = "failed";
      run.phase = "timeout";
      run.encounter = null;
      return { ok: true, state: publicInstanceState(run, user.id) };
    }
    const member = run.members.get(user.id);
    const interval = partyHitIntervalMs();
    if (now - (member.lastHitAt || 0) < interval - 20) {
      return { ok: true, throttled: true, state: publicInstanceState(run, user.id) };
    }
    member.lastHitAt = now;
    const enc = run.encounter;
    if (!enc) {
      return { ok: true, state: publicInstanceState(run, user.id) };
    }
    const mobId = String(opts.mobId || "");
    const bySkill = !!(opts.bySkill || opts.skillMult);

    // Минимальный интервал между скилл-ударами с множителем (мс)
    if (opts.skillMult && member.lastSkillHitAt) {
      const MIN_SKILL_INTERVAL = 800;
      if (now - member.lastSkillHitAt < MIN_SKILL_INTERVAL) {
        return { ok: true, state: publicInstanceState(run, user.id), skillThrottled: true };
      }
    }
    if (opts.skillMult) member.lastSkillHitAt = now;

    // Наковальня: бей СВОЙ цвет в окне. Чужой цвет / мимо окна — штраф → вайп.
    if (enc.kind === "boss" && enc.anvilActive && Array.isArray(enc.anvilMarks)) {
      tickAnvilMarks(enc, now);
      const mark = enc.anvilMarks.find((m) => m && m.id === mobId);
      if (mark) {
        const windowHit = !!mark.windowOpen;
        const ownColor = String(mark.ownerUserId) === String(user.id);
        const good = windowHit && ownColor;
        // Один клик — шар пропадает.
        consumeAnvilMark(enc, mark);
        if (good) {
          const add = bySkill ? 2 : 1;
          enc.anvilProgress = Math.min(
            enc.anvilGoal || 1,
            (enc.anvilProgress || 0) + add
          );
          enc.lastHitAt = now;
          if (bySkill) enc.lastSkillHitAt = now;
          applyBossPhase(enc, now, run);
          if (enc.anvilActive) refillAnvilMarks(enc, now);
          return {
            ok: true,
            killed: false,
            anvilHit: true,
            markId: mark.id,
            markConsumed: true,
            windowHit: true,
            colorOk: true,
            score: add,
            anvilDone: !enc.anvilActive,
            dmg: 0,
            state: publicInstanceState(run, user.id),
          };
        }
        enc.anvilFails = Math.max(0, (enc.anvilFails || 0) + 1);
        enc.lastHitAt = now;
        if (bySkill) enc.lastSkillHitAt = now;
        const wiped = (enc.anvilFails || 0) >= Math.max(1, enc.anvilFailMax || 10);
        if (wiped) {
          run.status = "failed";
          run.phase = "wipe";
          run.lastEvent = "anvil_fail";
          run.encounter = null;
          return {
            ok: true,
            killed: false,
            anvilHit: true,
            markId: mark.id,
            markConsumed: true,
            windowHit,
            colorOk: ownColor,
            score: 0,
            anvilWiped: true,
            dmg: 0,
            state: publicInstanceState(run, user.id),
          };
        }
        applyBossPhase(enc, now, run);
        if (enc.anvilActive) refillAnvilMarks(enc, now);
        return {
          ok: true,
          killed: false,
          anvilHit: true,
          markId: mark.id,
          markConsumed: true,
          windowHit,
          colorOk: ownColor,
          score: 0,
          anvilFail: true,
          anvilFails: enc.anvilFails,
          anvilFailMax: enc.anvilFailMax,
          anvilDone: false,
          dmg: 0,
          state: publicInstanceState(run, user.id),
        };
      }
      enc.lastHitAt = now;
      return {
        ok: true,
        blocked: true,
        dmg: 0,
        state: publicInstanceState(run, user.id),
      };
    }

    // Щит: клики по камням (40 ударов каждый). Урон в босса блокируется.
    if (enc.kind === "boss" && enc.shieldActive && Array.isArray(enc.shieldStones)) {
      const stone = enc.shieldStones.find((s) => s.id === mobId && !s.dead);
      if (stone) {
        const add = bySkill ? 2 : 1;
        stone.hits = Math.min(stone.maxHits, (stone.hits || 0) + add);
        if (stone.hits >= stone.maxHits) {
          stone.hits = stone.maxHits;
          stone.dead = true;
        }
        enc.lastHitAt = now;
        if (bySkill) enc.lastSkillHitAt = now;
        applyBossPhase(enc, now, run);
        return {
          ok: true,
          killed: false,
          stoneHit: true,
          stoneId: stone.id,
          stoneBroken: !!stone.dead,
          shieldDown: !enc.shieldActive,
          dmg: 0,
          state: publicInstanceState(run, user.id),
        };
      }
      // клик по боссу / мимо — щит держит
      enc.lastHitAt = now;
      return {
        ok: true,
        blocked: true,
        dmg: 0,
        state: publicInstanceState(run, user.id),
      };
    }

    // Адды: бей теней. Урон в босса блокируется, пока живы адды.
    if (enc.kind === "boss" && enc.addsActive && Array.isArray(enc.adds)) {
      const addTarget = enc.adds.find((a) => a && a.id === mobId && !a.dead);
      if (addTarget) {
        const power = Math.max(1, member.power || 1);
        const click = Math.max(1, Math.round(power / 4.2));
        let dmg = Math.max(1, Math.min(click * 3, Math.floor(Number(opts.dmg) || click)));
        if (bySkill) {
          enc.lastSkillHitAt = now;
          const MAX_SKILL_MULT = 4.0;
          const sm = Math.min(MAX_SKILL_MULT, Math.max(1, Number(opts.skillMult) || 1.15));
          dmg = Math.max(1, Math.round(dmg * sm));
        }
        const partyBuff = run.partyDamageBuff;
        if (partyBuff && partyBuff.until > now && partyBuff.mult > 1) {
          const pm = Math.min(1.5, Math.max(1, Number(partyBuff.mult) || 1));
          dmg = Math.max(1, Math.round(dmg * pm));
        }
        addTarget.hp = Math.max(0, addTarget.hp - dmg);
        enc.lastHitAt = now;
        if (addTarget.hp <= 0) {
          addTarget.hp = 0;
          addTarget.dead = true;
        }
        applyBossPhase(enc, now, run);
        return {
          ok: true,
          killed: !!addTarget.dead,
          addHit: true,
          addId: addTarget.id,
          addDead: !!addTarget.dead,
          addsDown: !enc.addsActive,
          dmg,
          state: publicInstanceState(run, user.id),
        };
      }
      // клик по боссу / мимо — адды держат
      enc.lastHitAt = now;
      if (bySkill) enc.lastSkillHitAt = now;
      return {
        ok: true,
        blocked: true,
        dmg: 0,
        state: publicInstanceState(run, user.id),
      };
    }

    let target =
      (enc.mobs || []).find((m) => m.id === mobId && !m.dead) ||
      (enc.mobs || []).find((m) => !m.dead);
    if (!target) {
      return { ok: true, state: publicInstanceState(run, user.id) };
    }
    const power = Math.max(1, member.power || 1);
    const click = Math.max(1, Math.round(power / 4.2));
    let dmg = Math.max(1, Math.min(click * 3, Math.floor(Number(opts.dmg) || click)));
    if (bySkill) {
      enc.lastSkillHitAt = now;
      const MAX_SKILL_MULT = 4.0;
      const sm = Math.min(MAX_SKILL_MULT, Math.max(1, Number(opts.skillMult) || 1.15));
      dmg = Math.max(1, Math.round(dmg * sm));
      // Канал: skill-hit в окне прерывает каст
      if (enc.kind === "boss" && enc.channelActive) {
        enc.channelActive = false;
        enc.channelEndsAt = 0;
        enc.nextChannelAt = now + Math.max(1200, Math.floor((enc.channelCycleMs || 7000) * 0.65));
        run.lastEvent = "channel_interrupted";
      }
    }
    const partyBuff = run.partyDamageBuff;
    if (partyBuff && partyBuff.until > now && partyBuff.mult > 1) {
      const pm = Math.min(1.5, Math.max(1, Number(partyBuff.mult) || 1));
      dmg = Math.max(1, Math.round(dmg * pm));
    }
    const tough = Math.max(1, Number(enc.toughness) || 1);
    dmg = Math.max(1, Math.round(dmg / tough));

    if (dmg > 0) target.hp = Math.max(0, target.hp - dmg);
    enc.lastHitAt = now;
    if (enc.kind === "boss") applyBossPhase(enc, now, run);
    // Убийственный удар не должен сносить босса до старта/закрытия щита/наковальни/аддов
    if (enc.kind === "boss" && (enc.anvilActive || enc.shieldActive || enc.addsActive) && target.hp <= 0) {
      target.hp = 1;
      target.dead = false;
    }

    let killed = false;
    if (target.hp <= 0) {
      target.dead = true;
      target.hp = 0;
      target.shieldHp = 0;
      killed = true;
    }
    if (encounterAlive(enc).length === 0) {
      advanceInstance(run);
    }

    return {
      ok: true,
      killed,
      dmg,
      loot: run.status === "cleared" ? run.lootByUser[user.id] || null : null,
      state: publicInstanceState(run, user.id),
    };
  };

  store.instancePartyBuff = function instancePartyBuff(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const runId = String(opts.runId || "");
    let run = runId ? instanceRuns.get(runId) : null;
    if (!run) {
      const partyId = getPartyId(user.id);
      for (const r of instanceRuns.values()) {
        if (r.partyId === partyId && r.status === "active" && r.members.has(user.id)) {
          run = r;
          break;
        }
      }
    }
    if (!run || !run.members.has(user.id)) {
      return { ok: false, error: "run", message: "Нет активного инстанса" };
    }
    if (run.status !== "active") {
      return { ok: false, error: "status", message: "Инстанс не активен" };
    }
    const mult = Math.min(1.5, Math.max(1, Number(opts.mult) || 1));
    const durationMs = Math.min(15000, Math.max(1000, Number(opts.durationMs) || 6000));
    if (!(mult > 1)) {
      return { ok: false, error: "mult", message: "Слабый бафф" };
    }
    const prev = run.partyDamageBuff;
    const until = now + durationMs;
    if (prev && prev.until > now) {
      run.partyDamageBuff = {
        mult: Math.max(Number(prev.mult) || 1, mult),
        until: Math.max(Number(prev.until) || 0, until),
        byUserId: user.id,
        skillId: opts.skillId || prev.skillId || null,
        name: opts.name || prev.name || null,
      };
    } else {
      run.partyDamageBuff = {
        mult,
        until,
        byUserId: user.id,
        skillId: opts.skillId || null,
        name: opts.name || null,
      };
    }
    run.lastEvent = "party_damage_buff";
    return { ok: true, state: publicInstanceState(run, user.id) };
  };

  store.instanceLeave = function instanceLeave(user, opts = {}) {
    const runId = String(opts.runId || "");
    let run = runId ? instanceRuns.get(runId) : null;
    if (!run) {
      const partyId = getPartyId(user.id);
      for (const r of instanceRuns.values()) {
        if (r.members.has(user.id) && (r.partyId === partyId || r.status === "ready" || r.status === "active")) {
          run = r;
          break;
        }
      }
    }
    // Фоллбек: искать по membership без party (после leave party)
    if (!run) {
      for (const r of instanceRuns.values()) {
        if (r.members.has(user.id) && (r.status === "ready" || r.status === "active" || r.status === "cleared")) {
          run = r;
          break;
        }
      }
    }
    if (!run) return { ok: true };
    run.members.delete(user.id);
    if (run.members.size === 0) {
      instanceRuns.delete(run.id);
      return { ok: true, dissolved: true };
    }
    // Нельзя продолжать / стартовать соло
    if (enforceInstancePartySize(run)) {
      return { ok: true, undersized: true, state: run.status === "failed" ? publicInstanceState(run, user.id) : null };
    }
    if (run.status === "active") {
      run.lives = Math.max(0, (run.lives || 1) - 1);
      if (run.lives <= 0) {
        run.status = "failed";
        run.phase = "wipe";
        run.encounter = null;
      }
    }
    return { ok: true };
  };

  store.instanceLocksFor = function instanceLocksFor(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const characterId = String(opts.characterId || "");
    const period = partyUtcWeekKey(now);
    const locks = {};
    for (const d of PARTY_DUNGEONS) {
      const clears = instanceClears(user.id, characterId, d.id, now);
      locks[d.id] = {
        clears,
        max: d.weeklyClears != null ? d.weeklyClears : PARTY_CONTENT.instance.weeklyClears ?? 3,
        periodKey: period,
      };
    }
    return { ok: true, locks, dayKey: partyUtcDayKey(now), weekKey: period };
  };

  // Expose for tests
  store._partyFarmSessions = farmSessions;
  store._instanceRuns = instanceRuns;
  store._partyReady = partyReady;
}

module.exports = { attachPartyContentMethods, PARTY_CONTENT, PARTY_FARM_ZONES, PARTY_DUNGEONS };
