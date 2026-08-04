"use strict";

/**
 * Clan land war: seals, leaderboard, scheduled siege bids, flagship arena resolve.
 * Extends clan-warehouse territory meta (warTier / siegeSlotUtc / xp%).
 */

/**
 * Тест: окна осады каждые 2 часа (UTC).
 * Перед продом → false (зеркало клиента: CLAN_SIEGE_DAILY_TEST).
 */
const CLAN_SIEGE_DAILY_TEST = false;
const CLAN_SIEGE_TEST_PERIOD_MS = 2 * 60 * 60 * 1000;
const CLAN_SIEGE_TEST_WINDOW_MS = 60 * 60 * 1000;

const SIEGE_SLOT_META = {
  sat_16: { dow: 6, hour: 16, windowMin: 60 },
  sat_18: { dow: 6, hour: 18, windowMin: 60 },
  sat_20: { dow: 6, hour: 20, windowMin: 60 },
  sun_16: { dow: 0, hour: 16, windowMin: 60 },
  sun_18: { dow: 0, hour: 18, windowMin: 60 },
  sun_20: { dow: 0, hour: 20, windowMin: 60 },
};

function siegePeriodMs() {
  if (CLAN_SIEGE_DAILY_TEST) return CLAN_SIEGE_TEST_PERIOD_MS;
  return 7 * 24 * 60 * 60 * 1000;
}

const SIEGE_BID_FLOOR = 5_000_000;
const SIEGE_BID_RENT_DAYS = 50;
const SIEGE_REFUND_PCT = 0.5;
const ARENA_GRACE_MS = 2 * 60 * 60 * 1000;
const SEAL_PER_HIT = 1;
const SEAL_HIT_BATCH_MAX = 40;
const SEAL_HOUR_CAP = 120;
/** +15% силы текущему держателю при resolve осады. */
const DEFENDER_BONUS_PCT = 0.15;

const RANK_POINTS = {
  holdHourNormal: 2,
  holdHourElite: 5,
  holdHourFlagship: 8,
  claim: 25,
  contest: 40,
  siegeWin: 80,
  raid: 15,
  rentPer10k: 1,
  weekTask: 25,
  sealBanner: 0, // dynamic floor(amount/5)
};

const WEEK_TASK = {
  sealsTarget: 40,
  rewardPts: 25,
  labelRu: "Неделя клана: нафармить 40 печатей на своих угодьях",
};

function warTierOf(meta) {
  const w = meta && meta.warTier ? String(meta.warTier) : "normal";
  if (w === "flagship" || w === "elite" || w === "normal") return w;
  return "normal";
}

function isEliteWar(meta) {
  const w = warTierOf(meta);
  return w === "elite" || w === "flagship";
}

function isFlagship(meta) {
  return warTierOf(meta) === "flagship";
}

function siegeWindow(meta, now) {
  if (!meta || !isEliteWar(meta)) return null;
  const slot = SIEGE_SLOT_META[String(meta.siegeSlotUtc || "")];
  if (!slot) return null;
  now = Number(now) || Date.now();

  if (CLAN_SIEGE_DAILY_TEST) {
    const period = siegePeriodMs();
    const winMs = CLAN_SIEGE_TEST_WINDOW_MS || Math.floor(period / 2);
    let startAt = Math.floor(now / period) * period;
    let endAt = startAt + winMs;
    if (now >= endAt) {
      startAt += period;
      endAt = startAt + winMs;
    }
    return {
      open: now >= startAt && now < endAt,
      startAt,
      endAt,
      slotId: meta.siegeSlotUtc,
      dailyTest: true,
      windowMs: winMs,
    };
  }

  const d = new Date(now);
  const period = siegePeriodMs();
  const day = d.getUTCDay();
  let delta = slot.dow - day;
  if (delta > 3) delta -= 7;
  if (delta < -3) delta += 7;
  const windowMs = (slot.windowMin || 60) * 60 * 1000;
  let startAt = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + delta,
    slot.hour,
    0,
    0,
    0
  );
  let endAt = startAt + windowMs;
  if (now > endAt + Math.min(period / 2, 12 * 3600 * 1000)) {
    startAt += period;
    endAt += period;
  }
  return {
    open: now >= startAt && now < endAt,
    startAt,
    endAt,
    slotId: meta.siegeSlotUtc,
    dailyTest: false,
    windowMs,
  };
}

/** Длительность окна заявок для слота. */
function siegeWindowMs(meta) {
  if (CLAN_SIEGE_DAILY_TEST) {
    return CLAN_SIEGE_TEST_WINDOW_MS || Math.floor(siegePeriodMs() / 2);
  }
  const slot = SIEGE_SLOT_META[String(meta?.siegeSlotUtc || "")];
  return (slot?.windowMin || 60) * 60 * 1000;
}

/**
 * Слот, который пора резолвить: последнее полностью закрытое окно заявок.
 * siegeWindow() после закрытия прыгает на следующий startAt — поэтому берём startAt − period.
 */
function siegeClosedSlotStart(meta, now) {
  const win = siegeWindow(meta, now);
  if (!win) return null;
  now = Number(now) || Date.now();
  const period = siegePeriodMs();
  const winMs = win.windowMs || siegeWindowMs(meta);
  const closedStart = win.startAt - period;
  // Окно заявок [closedStart, closedStart+winMs) должно уже закончиться
  if (now < closedStart + winMs) return null;
  return closedStart;
}

function bidCostFor(meta) {
  const rent = Math.max(0, Math.floor(Number(meta?.rentPerDay) || 0));
  return Math.max(SIEGE_BID_FLOOR, rent * SIEGE_BID_RENT_DAYS);
}

/** Port of client computeClanSiegePower (server copy). */
function computeSiegePower(input) {
  const perMember = 12;
  const professionTier = { 0: 0, 1: 18, 2: 42 };
  const roleWeight = {
    tank: 1.25,
    melee: 1.1,
    dagger: 1.05,
    archer: 1.1,
    mage: 1.1,
    support: 1.2,
    craft: 0.65,
    unknown: 1,
  };
  const members = Math.max(0, Math.floor(Number(input?.memberCount) || 0));
  let professionPts = 0;
  (input?.professions || []).forEach((p) => {
    const t = Math.max(0, Math.min(2, Math.floor(Number(p?.tier) || 0)));
    const base = professionTier[t] || 0;
    const rw = roleWeight[p?.role] != null ? roleWeight[p.role] : roleWeight.unknown;
    professionPts += Math.round(base * rw);
  });
  const deposit = Math.max(0, Math.floor(Number(input?.weekDepositAdena) || 0));
  const investPts = Math.min(180, Math.floor(deposit / 20000));
  const score = Math.max(0, Math.floor(Number(input?.weekScore) || 0));
  const activityPts = Math.min(120, Math.floor(score * 0.25));
  const total = members * perMember + professionPts + investPts + activityPts;
  return { total, members, professionPts, investPts, activityPts };
}

function attachClanWarMethods(db, store, deps) {
  deps = deps || {};

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_clan_seals (
      clan_id TEXT NOT NULL,
      territory_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (clan_id, territory_id),
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_seal_ticks (
      clan_id TEXT NOT NULL,
      territory_id TEXT NOT NULL,
      hour_key TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (clan_id, territory_id, hour_key)
    );
    CREATE TABLE IF NOT EXISTS chat_clan_rating (
      clan_id TEXT PRIMARY KEY,
      points INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_siege_bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      territory_id TEXT NOT NULL,
      clan_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      bid_adena INTEGER NOT NULL,
      slot_start INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      refunded INTEGER NOT NULL DEFAULT 0,
      UNIQUE(territory_id, clan_id, slot_start),
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_siege_rounds (
      territory_id TEXT NOT NULL,
      slot_start INTEGER NOT NULL,
      status TEXT NOT NULL,
      defender_clan_id TEXT,
      challenger_clan_id TEXT,
      winner_clan_id TEXT,
      resolve_mode TEXT,
      arena_deadline INTEGER,
      resolved_at INTEGER,
      PRIMARY KEY (territory_id, slot_start)
    );
    CREATE TABLE IF NOT EXISTS chat_clan_rating_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_clan_rating_log
      ON chat_clan_rating_log(clan_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS chat_clan_week_task (
      clan_id TEXT NOT NULL,
      week_key TEXT NOT NULL,
      seals INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (clan_id, week_key),
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_territory_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      territory_id TEXT NOT NULL,
      event TEXT NOT NULL,
      clan_id TEXT,
      clan_name TEXT,
      prev_clan_id TEXT,
      prev_clan_name TEXT,
      note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clan_terr_log
      ON chat_clan_territory_log(territory_id, id DESC);
    CREATE TABLE IF NOT EXISTS chat_clan_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      territory_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_clan_notices
      ON chat_clan_notices(clan_id, id DESC);
  `);

  const stmtClanGet = db.prepare(`SELECT * FROM chat_clans WHERE id = ?`);
  const stmtMemberClan = db.prepare(
    `SELECT clan_id FROM chat_clan_members WHERE user_id = ?`
  );
  const stmtMemberRole = db.prepare(
    `SELECT role FROM chat_clan_members WHERE clan_id = ? AND user_id = ?`
  );
  const stmtClanMembers = db.prepare(
    `SELECT m.user_id, m.role, u.nick FROM chat_clan_members m
     JOIN users u ON u.id = m.user_id WHERE m.clan_id = ?`
  );
  const stmtTerrGet = db.prepare(
    `SELECT * FROM chat_clan_territories WHERE territory_id = ?`
  );
  const stmtTerrAll = db.prepare(`SELECT * FROM chat_clan_territories`);
  const stmtTerrUpsert = db.prepare(`
    INSERT INTO chat_clan_territories (territory_id, clan_id, claimed_at, last_rent_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(territory_id) DO UPDATE SET
      clan_id = excluded.clan_id,
      claimed_at = excluded.claimed_at,
      last_rent_at = excluded.last_rent_at
  `);
  const stmtWhGet = db.prepare(`SELECT * FROM chat_clan_warehouse WHERE clan_id = ?`);
  const stmtWhUpsert = db.prepare(`
    INSERT INTO chat_clan_warehouse (clan_id, adena, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(clan_id) DO UPDATE SET adena = excluded.adena, updated_at = excluded.updated_at
  `);
  const stmtWhLog = db.prepare(`
    INSERT INTO chat_clan_warehouse_log (clan_id, user_id, kind, amount, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const stmtSealGet = db.prepare(
    `SELECT amount FROM chat_clan_seals WHERE clan_id = ? AND territory_id = ?`
  );
  const stmtSealUpsert = db.prepare(`
    INSERT INTO chat_clan_seals (clan_id, territory_id, amount, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clan_id, territory_id) DO UPDATE SET
      amount = excluded.amount, updated_at = excluded.updated_at
  `);
  const stmtSealList = db.prepare(
    `SELECT territory_id, amount FROM chat_clan_seals WHERE clan_id = ? AND amount > 0`
  );
  const stmtTickGet = db.prepare(
    `SELECT hits FROM chat_clan_seal_ticks WHERE clan_id = ? AND territory_id = ? AND hour_key = ?`
  );
  const stmtTickUpsert = db.prepare(`
    INSERT INTO chat_clan_seal_ticks (clan_id, territory_id, hour_key, hits)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clan_id, territory_id, hour_key) DO UPDATE SET hits = excluded.hits
  `);
  const stmtRatingGet = db.prepare(`SELECT * FROM chat_clan_rating WHERE clan_id = ?`);
  const stmtRatingUpsert = db.prepare(`
    INSERT INTO chat_clan_rating (clan_id, points, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(clan_id) DO UPDATE SET points = excluded.points, updated_at = excluded.updated_at
  `);
  const stmtRatingTop = db.prepare(`
    SELECT r.clan_id, r.points, r.updated_at, c.name AS clan_name
    FROM chat_clan_rating r
    JOIN chat_clans c ON c.id = r.clan_id
    ORDER BY r.points DESC, r.updated_at ASC
    LIMIT ?
  `);
  const stmtBidUpsert = db.prepare(`
    INSERT INTO chat_clan_siege_bids (
      territory_id, clan_id, user_id, bid_adena, slot_start, created_at, refunded
    ) VALUES (?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(territory_id, clan_id, slot_start) DO UPDATE SET
      bid_adena = chat_clan_siege_bids.bid_adena + excluded.bid_adena,
      user_id = excluded.user_id,
      created_at = excluded.created_at
  `);
  const stmtBidsForSlot = db.prepare(`
    SELECT * FROM chat_clan_siege_bids
    WHERE territory_id = ? AND slot_start = ? AND refunded = 0
  `);
  const stmtBidSlotsOpen = db.prepare(`
    SELECT DISTINCT slot_start FROM chat_clan_siege_bids
    WHERE territory_id = ? AND refunded = 0
  `);
  const stmtBidRefund = db.prepare(
    `UPDATE chat_clan_siege_bids SET refunded = 1 WHERE id = ?`
  );
  const stmtRoundGet = db.prepare(
    `SELECT * FROM chat_clan_siege_rounds WHERE territory_id = ? AND slot_start = ?`
  );
  const stmtRoundUpsert = db.prepare(`
    INSERT INTO chat_clan_siege_rounds (
      territory_id, slot_start, status, defender_clan_id, challenger_clan_id,
      winner_clan_id, resolve_mode, arena_deadline, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(territory_id, slot_start) DO UPDATE SET
      status = excluded.status,
      defender_clan_id = excluded.defender_clan_id,
      challenger_clan_id = excluded.challenger_clan_id,
      winner_clan_id = excluded.winner_clan_id,
      resolve_mode = excluded.resolve_mode,
      arena_deadline = excluded.arena_deadline,
      resolved_at = excluded.resolved_at
  `);
  const stmtMatchById = db.prepare(`SELECT * FROM duel_matches WHERE id = ?`);
  const stmtRecentFinishedMatches = db.prepare(`
    SELECT * FROM duel_matches
    WHERE status = 'finished' AND finished_at IS NOT NULL AND finished_at >= ?
    ORDER BY finished_at DESC
    LIMIT 40
  `);
  const stmtRatingLogIns = db.prepare(`
    INSERT INTO chat_clan_rating_log (clan_id, kind, points, created_at) VALUES (?, ?, ?, ?)
  `);
  const stmtRatingLogSum = db.prepare(`
    SELECT kind, SUM(points) AS pts FROM chat_clan_rating_log
    WHERE clan_id = ? GROUP BY kind
  `);
  const stmtWeekTaskGet = db.prepare(
    `SELECT * FROM chat_clan_week_task WHERE clan_id = ? AND week_key = ?`
  );
  const stmtWeekTaskUpsert = db.prepare(`
    INSERT INTO chat_clan_week_task (clan_id, week_key, seals, claimed)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(clan_id, week_key) DO UPDATE SET seals = excluded.seals
  `);
  const stmtWeekTaskClaim = db.prepare(`
    UPDATE chat_clan_week_task SET claimed = 1 WHERE clan_id = ? AND week_key = ? AND claimed = 0
  `);
  const stmtTerrLogIns = db.prepare(`
    INSERT INTO chat_clan_territory_log (
      territory_id, event, clan_id, clan_name, prev_clan_id, prev_clan_name, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stmtTerrLogList = db.prepare(`
    SELECT * FROM chat_clan_territory_log
    WHERE territory_id = ?
    ORDER BY id DESC
    LIMIT ?
  `);
  const stmtNoticeIns = db.prepare(`
    INSERT INTO chat_clan_notices (clan_id, kind, message, territory_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const stmtNoticeList = db.prepare(`
    SELECT * FROM chat_clan_notices
    WHERE clan_id = ? AND id > ?
    ORDER BY id ASC
    LIMIT 40
  `);

  const { CLAN_TERRITORIES } = require("./clan-warehouse");

  function isoWeekKey(now) {
    const d = new Date(Number(now) || Date.now());
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
    return utc.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
  }

  function getClanId(userId) {
    return stmtMemberClan.get(userId)?.clan_id || null;
  }

  function clanRole(clanId, userId) {
    const clan = stmtClanGet.get(clanId);
    const uid = Number(userId);
    if (clan && Number(clan.leader_user_id) === uid) return "leader";
    return stmtMemberRole.get(clanId, userId)?.role || "member";
  }

  function ensureWh(clanId, now) {
    let row = stmtWhGet.get(clanId);
    if (!row) {
      stmtWhUpsert.run(clanId, 0, now);
      row = stmtWhGet.get(clanId);
    }
    return row;
  }

  function addRating(clanId, delta, now, kind) {
    if (!clanId || !delta) return;
    const row = stmtRatingGet.get(clanId);
    const pts = Math.max(0, (row?.points || 0) + Math.floor(delta));
    stmtRatingUpsert.run(clanId, pts, now);
    if (kind && Math.floor(delta) !== 0) {
      try {
        stmtRatingLogIns.run(clanId, String(kind).slice(0, 32), Math.floor(delta), now);
      } catch (_) {}
    }
  }

  function bumpWeekSeals(clanId, gained, now) {
    if (!clanId || !(gained > 0)) return;
    const key = isoWeekKey(now);
    const row = stmtWeekTaskGet.get(clanId, key);
    const next = Math.max(0, (row?.seals || 0) + Math.floor(gained));
    stmtWeekTaskUpsert.run(clanId, key, next);
  }

  function clanNameOf(clanId) {
    if (!clanId) return null;
    return stmtClanGet.get(clanId)?.name || "?";
  }

  function logTerritory(territoryId, event, clanId, prevClanId, note, now) {
    try {
      stmtTerrLogIns.run(
        territoryId,
        String(event || "").slice(0, 32),
        clanId || null,
        clanNameOf(clanId),
        prevClanId || null,
        clanNameOf(prevClanId),
        note ? String(note).slice(0, 200) : null,
        Number(now) || Date.now()
      );
    } catch (_) {}
  }

  function emitNotice(clanId, kind, message, territoryId, now) {
    if (!clanId || !message) return;
    try {
      stmtNoticeIns.run(
        clanId,
        String(kind || "info").slice(0, 32),
        String(message).slice(0, 240),
        territoryId || null,
        Number(now) || Date.now()
      );
    } catch (_) {}
  }

  function weekScore(clanId, now) {
    if (typeof store.clanGetWeekScore === "function") {
      try {
        return Math.max(0, Math.floor(Number(store.clanGetWeekScore(clanId, { now })) || 0));
      } catch (_) {}
    }
    return 0;
  }

  function professionsForClan(clanId) {
    const members = stmtClanMembers.all(clanId);
    const out = [];
    for (const m of members) {
      try {
        const save = store.getSave(m.user_id);
        if (!save) continue;
        const { parseSavePayload, resolveActiveCharacterId } = require("./save-utils");
        const data = parseSavePayload(save);
        if (!data) continue;
        const cid = resolveActiveCharacterId(data);
        const chars = Array.isArray(data.characters) ? data.characters : [];
        const slot = chars.find((c) => c && String(c.id) === String(cid)) || chars[0];
        const av = slot?.progress?.avatar || data.avatar || null;
        if (!av) {
          out.push({ tier: 0, role: "unknown" });
          continue;
        }
        let tier = 0;
        let role = "unknown";
        if (av.professionId) {
          // Soft parse: professionId like "gladiator" / tier from avatar.professionTier
          tier = Math.max(0, Math.min(2, Math.floor(Number(av.professionTier) || Number(av.profTier) || 1)));
          role = String(av.professionRole || av.combatRole || "melee");
        } else if (av.classId === "mystic" || av.classId === "shaman") {
          role = "mage";
        } else if (av.classId) {
          role = "melee";
        }
        out.push({ tier, role });
      } catch (_) {
        out.push({ tier: 0, role: "unknown" });
      }
    }
    return out;
  }

  function siegePowerForClan(clanId, now) {
    const members = stmtClanMembers.all(clanId);
    const professions = professionsForClan(clanId);
    const score = weekScore(clanId, now);
    // Approximate week deposits from warehouse log if available — soft: score*10k
    const weekDepositAdena = score * 10000;
    return computeSiegePower({
      memberCount: members.length,
      professions,
      weekDepositAdena,
      weekScore: score,
    });
  }

  store.clanWarMeta = function clanWarMeta() {
    return {
      ok: true,
      sealPerHit: SEAL_PER_HIT,
      sealHourCap: SEAL_HOUR_CAP,
      bidFloor: SIEGE_BID_FLOOR,
      refundPct: SIEGE_REFUND_PCT,
      arenaGraceMs: ARENA_GRACE_MS,
    };
  };

  store.clanAddRatingPoints = function clanAddRatingPoints(clanId, delta, now) {
    addRating(clanId, delta, Number(now) || Date.now());
  };

  store.clanGetSeals = function clanGetSeals(user) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const rows = stmtSealList.all(clanId);
    return {
      ok: true,
      clanId,
      seals: rows.map((r) => ({
        territoryId: r.territory_id,
        amount: r.amount,
        labelRu: CLAN_TERRITORIES[r.territory_id]?.labelRu || r.territory_id,
      })),
    };
  };

  store.clanAccrueSeals = function clanAccrueSeals(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const territoryId = String(opts.territoryId || "").slice(0, 64);
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta || !meta.siegeEnabled) {
      return { ok: false, error: "zone", message: "Нет угодья" };
    }
    const hold = stmtTerrGet.get(territoryId);
    if (!hold || hold.clan_id !== clanId) {
      return { ok: false, error: "holder", message: "Угодье не ваше" };
    }
    let hits = Math.max(0, Math.min(SEAL_HIT_BATCH_MAX, Math.floor(Number(opts.hits) || 0)));
    if (!hits) return { ok: true, gained: 0, amount: stmtSealGet.get(clanId, territoryId)?.amount || 0 };

    const hourKey = new Date(now).toISOString().slice(0, 13);
    const tick = stmtTickGet.get(clanId, territoryId, hourKey);
    const used = tick?.hits || 0;
    const room = Math.max(0, SEAL_HOUR_CAP - used);
    hits = Math.min(hits, room);
    if (!hits) {
      return {
        ok: true,
        gained: 0,
        capped: true,
        amount: stmtSealGet.get(clanId, territoryId)?.amount || 0,
      };
    }
    stmtTickUpsert.run(clanId, territoryId, hourKey, used + hits);
    const gain = hits * SEAL_PER_HIT;
    const cur = stmtSealGet.get(clanId, territoryId)?.amount || 0;
    const next = cur + gain;
    stmtSealUpsert.run(clanId, territoryId, next, now);
    bumpWeekSeals(clanId, gain, now);
    return { ok: true, gained: gain, amount: next };
  };

  store.clanSpendSeals = function clanSpendSeals(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const role = clanRole(clanId, user.id);
    if (role !== "leader" && role !== "officer") {
      return { ok: false, error: "role", message: "Лидер или офицер" };
    }
    const territoryId = String(opts.territoryId || "").slice(0, 64);
    const amount = Math.max(0, Math.floor(Number(opts.amount) || 0));
    const purpose = String(opts.purpose || "banner").slice(0, 32);
    if (!amount) return { ok: false, error: "amount", message: "Укажи число печатей" };
    const cur = stmtSealGet.get(clanId, territoryId)?.amount || 0;
    if (cur < amount) return { ok: false, error: "seals", message: "Недостаточно печатей" };
    stmtSealUpsert.run(clanId, territoryId, cur - amount, now);
    // banner / study_boost: convert to clan XP via activity
    if (purpose === "study_boost" || purpose === "banner") {
      if (typeof store.clanAddActivityScore === "function") {
        try {
          store.clanAddActivityScore(clanId, amount * 2, { now });
        } catch (_) {}
      }
      addRating(clanId, Math.floor(amount / 5), now, "seals");
    }
    return {
      ok: true,
      amount: cur - amount,
      purpose,
      message: purpose === "banner" ? "Печати вложены в знамя клана" : "Печати потрачены",
    };
  };

  store.clanLeaderboard = function clanLeaderboard(opts = {}) {
    const now = Number(opts.now) || Date.now();
    // Soft accrual: hold hours since last update (lazy, on read)
    const holds = stmtTerrAll.all();
    for (const h of holds) {
      const meta = CLAN_TERRITORIES[h.territory_id];
      if (!meta) continue;
      const tier = warTierOf(meta);
      const perHour =
        tier === "flagship"
          ? RANK_POINTS.holdHourFlagship
          : tier === "elite"
            ? RANK_POINTS.holdHourElite
            : RANK_POINTS.holdHourNormal;
      const rating = stmtRatingGet.get(h.clan_id);
      const last = rating?.updated_at || h.claimed_at || now;
      const hours = Math.min(24, Math.floor((now - last) / 3600000));
      if (hours > 0) addRating(h.clan_id, hours * perHour, now, "hold");
    }
    const limit = Math.max(1, Math.min(100, Math.floor(Number(opts.limit) || 50)));
    const rows = stmtRatingTop.all(limit);
    const entries = rows.map((r, i) => ({
      rank: i + 1,
      clanId: r.clan_id,
      clanName: r.clan_name,
      points: r.points,
    }));
    let mine = null;
    const user = opts.user;
    if (user && user.id) {
      const myClanId = getClanId(user.id);
      if (myClanId) {
        const sums = stmtRatingLogSum.all(myClanId);
        const breakdown = {};
        let logged = 0;
        for (const s of sums) {
          breakdown[s.kind] = Math.floor(Number(s.pts) || 0);
          logged += breakdown[s.kind];
        }
        const myEntry = entries.find((e) => e.clanId === myClanId) || null;
        const total = stmtRatingGet.get(myClanId)?.points || myEntry?.points || 0;
        mine = {
          clanId: myClanId,
          points: total,
          rank: myEntry ? myEntry.rank : null,
          breakdown,
          logged,
          legend: {
            hold: "владение угодьями",
            claim: "захваты",
            contest: "отбития",
            siege: "победы в осадах",
            seals: "печати → знамя",
            week: "недельное задание",
            raid: "рейд",
          },
        };
      }
    }
    return {
      ok: true,
      entries,
      mine,
      legend: {
        hold: "владение (в час)",
        claim: "+" + RANK_POINTS.claim + " захват",
        contest: "+" + RANK_POINTS.contest + " отбитие",
        siege: "+" + RANK_POINTS.siegeWin + " осада",
        week: "+" + WEEK_TASK.rewardPts + " нед. задание",
      },
    };
  };

  store.clanSiegeWindowInfo = function clanSiegeWindowInfo(territoryId, now) {
    const meta = CLAN_TERRITORIES[territoryId];
    return siegeWindow(meta, now);
  };

  store.clanIsSiegeWindowOpen = function clanIsSiegeWindowOpen(territoryId, now) {
    const w = siegeWindow(CLAN_TERRITORIES[territoryId], now);
    return !!(w && w.open);
  };

  store.clanPlaceSiegeBid = function clanPlaceSiegeBid(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const role = clanRole(clanId, user.id);
    if (role !== "leader" && role !== "officer") {
      return { ok: false, error: "role", message: "Лидер или офицер" };
    }
    const territoryId = String(opts.territoryId || "").slice(0, 64);
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta || !meta.siegeEnabled || !isEliteWar(meta)) {
      return { ok: false, error: "zone", message: "Узел без недельной осады" };
    }
    const win = siegeWindow(meta, now);
    if (!win || !win.open) {
      return { ok: false, error: "window", message: "Окно осады закрыто" };
    }
    const cost = bidCostFor(meta);
    const wh = ensureWh(clanId, now);
    if ((wh.adena || 0) < cost) {
      return { ok: false, error: "adena", message: "Недостаточно адены на складе" };
    }
    const nextAdena = (wh.adena || 0) - cost;
    const tx = db.transaction(() => {
      stmtWhUpsert.run(clanId, nextAdena, now);
      stmtWhLog.run(
        clanId,
        user.id,
        "siege_bid",
        -cost,
        JSON.stringify({ territoryId, slotStart: win.startAt }),
        now
      );
      stmtBidUpsert.run(territoryId, clanId, user.id, cost, win.startAt, now);
    });
    tx();
    return {
      ok: true,
      message: "Заявка на осаду принята",
      bidAdena: cost,
      warehouseAdena: nextAdena,
      window: win,
      holders: typeof store.clanListTerritories === "function" ? store.clanListTerritories().holders : [],
    };
  };

  function refundBid(bid, now) {
    if (bid.refunded) return;
    const refund = Math.floor(bid.bid_adena * SIEGE_REFUND_PCT);
    const wh = ensureWh(bid.clan_id, now);
    stmtWhUpsert.run(bid.clan_id, (wh.adena || 0) + refund, now);
    stmtWhLog.run(
      bid.clan_id,
      null,
      "siege_refund",
      refund,
      JSON.stringify({ territoryId: bid.territory_id, bidId: bid.id }),
      now
    );
    stmtBidRefund.run(bid.id);
  }

  function assignTerritory(territoryId, clanId, now, opts) {
    opts = opts || {};
    const prev = stmtTerrGet.get(territoryId);
    const prevId = prev?.clan_id || null;
    stmtTerrUpsert.run(territoryId, clanId, now, now);
    if (opts.event) {
      logTerritory(territoryId, opts.event, clanId, prevId, opts.note || null, now);
    }
    if (prevId && prevId !== clanId) {
      const label = CLAN_TERRITORIES[territoryId]?.labelRu || territoryId;
      emitNotice(
        prevId,
        "lost",
        "Узел «" + label + "» потерян" + (opts.note ? " (" + opts.note + ")" : ""),
        territoryId,
        now
      );
    }
    if (clanId && clanId !== prevId) {
      const label = CLAN_TERRITORIES[territoryId]?.labelRu || territoryId;
      emitNotice(
        clanId,
        "gain",
        "Узел «" + label + "» ваш" + (opts.note ? " (" + opts.note + ")" : ""),
        territoryId,
        now
      );
    }
  }

  function resolveByPower(territoryId, slotStart, now) {
    const meta = CLAN_TERRITORIES[territoryId];
    const hold = stmtTerrGet.get(territoryId);
    const bids = stmtBidsForSlot.all(territoryId, slotStart);
    const candidates = [];
    if (hold) {
      candidates.push({
        clanId: hold.clan_id,
        power: Math.floor(siegePowerForClan(hold.clan_id, now).total * (1 + DEFENDER_BONUS_PCT)),
        isDefender: true,
        bid: null,
      });
    }
    for (const b of bids) {
      if (hold && b.clan_id === hold.clan_id) continue;
      candidates.push({
        clanId: b.clan_id,
        power: siegePowerForClan(b.clan_id, now).total + Math.floor(b.bid_adena / 100000),
        isDefender: false,
        bid: b,
      });
    }
    if (!candidates.length) {
      stmtRoundUpsert.run(
        territoryId,
        slotStart,
        "resolved",
        hold?.clan_id || null,
        null,
        hold?.clan_id || null,
        "none",
        null,
        now
      );
      return { ok: true, winnerClanId: hold?.clan_id || null, mode: "none" };
    }
    candidates.sort((a, b) => b.power - a.power || (a.isDefender ? -1 : 1));
    const winner = candidates[0];

    if (isFlagship(meta) && candidates.length >= 2) {
      const challenger = candidates.find((c) => c.clanId !== winner.clanId) || candidates[1];
      stmtRoundUpsert.run(
        territoryId,
        slotStart,
        "awaiting_arena",
        hold?.clan_id || winner.clanId,
        challenger.clanId,
        null,
        "arena",
        now + ARENA_GRACE_MS,
        null
      );
      return {
        ok: true,
        mode: "arena",
        status: "awaiting_arena",
        defenderClanId: hold?.clan_id || winner.clanId,
        challengerClanId: challenger.clanId,
        arenaDeadline: now + ARENA_GRACE_MS,
      };
    }

    // Apply winner
    if (!hold || hold.clan_id !== winner.clanId) {
      assignTerritory(territoryId, winner.clanId, now, {
        event: "siege",
        note: "осада · сила",
      });
    } else {
      logTerritory(territoryId, "siege_hold", winner.clanId, hold.clan_id, "удержали осаду", now);
      emitNotice(
        winner.clanId,
        "siege",
        "Удержали «" + (meta?.labelRu || territoryId) + "» в осаде",
        territoryId,
        now
      );
    }
    for (const b of bids) {
      if (b.clan_id === winner.clanId) {
        stmtBidRefund.run(b.id); // mark spent, no refund
      } else {
        refundBid(b, now);
      }
    }
    addRating(winner.clanId, RANK_POINTS.siegeWin, now, "siege");
    stmtRoundUpsert.run(
      territoryId,
      slotStart,
      "resolved",
      hold?.clan_id || null,
      candidates[1]?.clanId || null,
      winner.clanId,
      "power",
      null,
      now
    );
    return {
      ok: true,
      winnerClanId: winner.clanId,
      mode: "power",
      defenderBonusPct: DEFENDER_BONUS_PCT,
    };
  }

  store.clanResolveSiegeSlot = function clanResolveSiegeSlot(territoryId, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta || !isEliteWar(meta)) {
      return { ok: false, error: "zone", message: "Не siege-узел" };
    }
    const win = siegeWindow(meta, now);
    if (!win) return { ok: false, error: "slot", message: "Нет слота" };
    const winMs = win.windowMs || siegeWindowMs(meta);

    let resolveStart =
      opts.slotStart != null ? Math.floor(Number(opts.slotStart)) : null;
    if (resolveStart == null) {
      // По умолчанию — последнее закрытое окно (не «следующее», на которое прыгает siegeWindow)
      resolveStart = siegeClosedSlotStart(meta, now);
      if (resolveStart == null && opts.force && win.open) {
        resolveStart = win.startAt;
      }
    }
    if (resolveStart == null || !Number.isFinite(resolveStart)) {
      return { ok: false, error: "slot", message: "Нет закрытого окна для resolve" };
    }

    const bidEnd = resolveStart + winMs;
    if (now < bidEnd && !opts.force) {
      return { ok: false, error: "open", message: "Окно ещё открыто" };
    }

    const existing = stmtRoundGet.get(territoryId, resolveStart);
    if (existing && existing.status === "resolved") {
      return { ok: true, already: true, round: existing, slotStart: resolveStart };
    }
    if (existing && existing.status === "awaiting_arena") {
      if (now < (existing.arena_deadline || 0) && !opts.forcePower) {
        return { ok: true, status: "awaiting_arena", round: existing, slotStart: resolveStart };
      }
      // Grace expired → power fallback between defender/challenger
      const hold = stmtTerrGet.get(territoryId);
      const a = existing.defender_clan_id;
      const b = existing.challenger_clan_id;
      const pa = a ? siegePowerForClan(a, now).total : 0;
      const pb = b ? siegePowerForClan(b, now).total : 0;
      const winner = pa >= pb ? a : b;
      if (winner && (!hold || hold.clan_id !== winner)) {
        assignTerritory(territoryId, winner, now, {
          event: "siege",
          note: "осада · сила (fallback)",
        });
      }
      const bids = stmtBidsForSlot.all(territoryId, resolveStart);
      for (const bid of bids) {
        if (bid.clan_id === winner) stmtBidRefund.run(bid.id);
        else refundBid(bid, now);
      }
      if (winner) addRating(winner, RANK_POINTS.siegeWin, now, "siege");
      stmtRoundUpsert.run(
        territoryId,
        resolveStart,
        "resolved",
        a,
        b,
        winner,
        "power_fallback",
        existing.arena_deadline,
        now
      );
      return {
        ok: true,
        winnerClanId: winner,
        mode: "power_fallback",
        slotStart: resolveStart,
      };
    }
    return { ...resolveByPower(territoryId, resolveStart, now), slotStart: resolveStart };
  };

  store.clanResolveDueSieges = function clanResolveDueSieges(opts = {}) {
    const now = Number(opts.now) || Date.now();
    const results = [];
    for (const id of Object.keys(CLAN_TERRITORIES)) {
      const meta = CLAN_TERRITORIES[id];
      if (!isEliteWar(meta)) continue;
      const win = siegeWindow(meta, now);
      if (!win) continue;
      const winMs = win.windowMs || siegeWindowMs(meta);
      const targets = new Set();

      const closed = siegeClosedSlotStart(meta, now);
      if (closed != null) targets.add(closed);

      // Catch-up: незакрытые заявки на уже прошедших слотах
      try {
        for (const row of stmtBidSlotsOpen.all(id)) {
          const s = Math.floor(Number(row.slot_start) || 0);
          if (s > 0 && now >= s + winMs) targets.add(s);
        }
      } catch (_) {}

      if (opts.force && win.open) targets.add(win.startAt);

      for (const slotStart of targets) {
        results.push({
          territoryId: id,
          ...store.clanResolveSiegeSlot(id, {
            now,
            slotStart,
            force: opts.force,
            forcePower: !!opts.forcePower || !!opts.force,
          }),
        });
      }
    }
    return { ok: true, results };
  };

  store.clanReportSiegeArenaResult = function clanReportSiegeArenaResult(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const territoryId = String(opts.territoryId || "").slice(0, 64);
    let matchId = Math.floor(Number(opts.matchId) || 0);
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta || !isFlagship(meta)) {
      return { ok: false, error: "zone", message: "Только флагман" };
    }
    const win = siegeWindow(meta, now);
    if (!win) return { ok: false, error: "slot", message: "Нет слота" };
    // Find awaiting round (current or previous)
    let round = stmtRoundGet.get(territoryId, win.startAt);
    if (!round || round.status !== "awaiting_arena") {
      round = stmtRoundGet.get(territoryId, win.startAt - siegePeriodMs());
    }
    if (!round || round.status !== "awaiting_arena") {
      return { ok: false, error: "round", message: "Нет ожидания арены" };
    }

    function matchFitsRound(m) {
      if (!m || m.status !== "finished") return false;
      const clanA = getClanId(m.a_user_id);
      const clanB = getClanId(m.b_user_id);
      const set = new Set([round.defender_clan_id, round.challenger_clan_id]);
      return set.has(clanA) && set.has(clanB) && clanA !== clanB;
    }

    let match = null;
    if (matchId) {
      try {
        match = stmtMatchById.get(matchId);
      } catch (_) {
        return { ok: false, error: "match", message: "Матч не найден" };
      }
      if (!matchFitsRound(match)) {
        return {
          ok: false,
          error: "roster",
          message: "Матч не между кланами этой осады",
        };
      }
    } else {
      // Авто: последний завершённый дуэль между defender/challenger за окно арены
      const since = Math.max(
        0,
        Number(round.arena_deadline || now) - ARENA_GRACE_MS - 30 * 60 * 1000
      );
      let candidates = [];
      try {
        candidates = stmtRecentFinishedMatches.all(since);
      } catch (_) {
        candidates = [];
      }
      match = candidates.find((m) => matchFitsRound(m)) || null;
      if (!match) {
        return {
          ok: false,
          error: "match",
          message:
            "Нет подходящего дуэля — сыграйте на арене (разные кланы осады) или укажите matchId",
        };
      }
      matchId = match.id;
    }

    if (!match || match.status !== "finished") {
      return { ok: false, error: "match", message: "Матч не завершён" };
    }
    const side = String(match.winner || "").toLowerCase();
    let winnerUserId = null;
    if (side === "a" || side === "challenger") winnerUserId = match.a_user_id;
    else if (side === "b" || side === "defender" || side === "target") winnerUserId = match.b_user_id;
    else if (Number(match.winner) > 0) winnerUserId = Number(match.winner);
    if (!winnerUserId) return { ok: false, error: "match", message: "Нет победителя" };
    const winnerClan = getClanId(winnerUserId);
    const allowed = [round.defender_clan_id, round.challenger_clan_id];
    if (!allowed.includes(winnerClan)) {
      return { ok: false, error: "clan", message: "Победитель не из кланов осады" };
    }
    assignTerritory(territoryId, winnerClan, now, {
      event: "siege",
      note: "осада · арена",
    });
    const bids = stmtBidsForSlot.all(territoryId, round.slot_start);
    for (const bid of bids) {
      if (bid.clan_id === winnerClan) stmtBidRefund.run(bid.id);
      else refundBid(bid, now);
    }
    addRating(winnerClan, RANK_POINTS.siegeWin, now, "siege");
    stmtRoundUpsert.run(
      territoryId,
      round.slot_start,
      "resolved",
      round.defender_clan_id,
      round.challenger_clan_id,
      winnerClan,
      "arena",
      round.arena_deadline,
      now
    );
    return {
      ok: true,
      winnerClanId: winnerClan,
      mode: "arena",
      matchId,
      holders:
        typeof store.clanListTerritories === "function"
          ? store.clanListTerritories().holders
          : [],
      message: "Флагман захвачен по арене (матч #" + matchId + ")",
    };
  };

  store.clanSiegeStatus = function clanSiegeStatus(territoryId, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta) return { ok: false, error: "zone" };
    const win = siegeWindow(meta, now);
    const bids = win ? stmtBidsForSlot.all(territoryId, win.startAt) : [];
    let round = win ? stmtRoundGet.get(territoryId, win.startAt) : null;
    if (!round && win) {
      round = stmtRoundGet.get(territoryId, win.startAt - siegePeriodMs());
    }
    return {
      ok: true,
      territoryId,
      warTier: warTierOf(meta),
      window: win,
      bidCost: bidCostFor(meta),
      bids: bids.map((b) => ({
        clanId: b.clan_id,
        clanName: stmtClanGet.get(b.clan_id)?.name || "?",
        bidAdena: b.bid_adena,
      })),
      round: round || null,
    };
  };

  // Hook helpers for claim/contest rating (called from warehouse after success)
  store.clanOnTerritoryClaimed = function clanOnTerritoryClaimed(clanId, territoryId, now) {
    addRating(clanId, RANK_POINTS.claim, now, "claim");
    logTerritory(territoryId, "claim", clanId, null, "захват казной", now);
    const label = CLAN_TERRITORIES[territoryId]?.labelRu || territoryId;
    emitNotice(clanId, "claim", "Захвачен узел «" + label + "»", territoryId, now);
  };
  store.clanOnTerritoryContested = function clanOnTerritoryContested(
    clanId,
    territoryId,
    now,
    prevClanId
  ) {
    addRating(clanId, RANK_POINTS.contest, now, "contest");
    logTerritory(territoryId, "contest", clanId, prevClanId || null, "отбитие казной", now);
    const label = CLAN_TERRITORIES[territoryId]?.labelRu || territoryId;
    emitNotice(clanId, "contest", "Отбит узел «" + label + "»", territoryId, now);
    if (prevClanId) {
      emitNotice(prevClanId, "lost", "Узел «" + label + "» отбит другим кланом", territoryId, now);
    }
  };
  store.clanOnTerritoryReleased = function clanOnTerritoryReleased(clanId, territoryId, now) {
    logTerritory(territoryId, "release", null, clanId, "снят захват", now);
    const label = CLAN_TERRITORIES[territoryId]?.labelRu || territoryId;
    emitNotice(clanId, "release", "Снят узел «" + label + "»", territoryId, now);
  };

  store.clanTerritoryHistory = function clanTerritoryHistory(territoryId, opts = {}) {
    const tid = String(territoryId || "").slice(0, 64);
    if (!tid || !CLAN_TERRITORIES[tid]) return { ok: false, error: "zone" };
    const limit = Math.max(1, Math.min(50, Math.floor(Number(opts.limit) || 20)));
    const rows = stmtTerrLogList.all(tid, limit);
    return {
      ok: true,
      territoryId: tid,
      labelRu: CLAN_TERRITORIES[tid].labelRu || tid,
      entries: rows.map((r) => ({
        id: r.id,
        event: r.event,
        clanId: r.clan_id,
        clanName: r.clan_name,
        prevClanId: r.prev_clan_id,
        prevClanName: r.prev_clan_name,
        note: r.note,
        createdAt: r.created_at,
      })),
    };
  };

  store.clanListNotices = function clanListNotices(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: true, notices: [], lastId: 0 };
    const after = Math.max(0, Math.floor(Number(opts.after) || 0));
    const rows = stmtNoticeList.all(clanId, after);
    const notices = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      territoryId: r.territory_id,
      createdAt: r.created_at,
    }));
    const lastId = notices.length ? notices[notices.length - 1].id : after;
    return { ok: true, notices, lastId };
  };

  store.clanGetWeekTask = function clanGetWeekTask(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const key = isoWeekKey(now);
    const row = stmtWeekTaskGet.get(clanId, key);
    const seals = Math.max(0, Number(row?.seals) || 0);
    const claimed = !!(row && row.claimed);
    const target = WEEK_TASK.sealsTarget;
    return {
      ok: true,
      weekKey: key,
      labelRu: WEEK_TASK.labelRu,
      seals,
      target,
      progress: Math.min(1, seals / target),
      ready: seals >= target && !claimed,
      claimed,
      rewardPts: WEEK_TASK.rewardPts,
    };
  };

  store.clanClaimWeekTask = function clanClaimWeekTask(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const role = clanRole(clanId, user.id);
    if (role !== "leader" && role !== "officer") {
      return { ok: false, error: "role", message: "Лидер или офицер" };
    }
    const key = isoWeekKey(now);
    const row = stmtWeekTaskGet.get(clanId, key);
    const seals = Math.max(0, Number(row?.seals) || 0);
    if (row && row.claimed) {
      return { ok: false, error: "claimed", message: "Награда уже получена на этой неделе" };
    }
    if (seals < WEEK_TASK.sealsTarget) {
      return {
        ok: false,
        error: "progress",
        message: "Нужно " + WEEK_TASK.sealsTarget + " печатей (сейчас " + seals + ")",
      };
    }
    const updated = stmtWeekTaskClaim.run(clanId, key);
    if (!updated.changes) {
      stmtWeekTaskUpsert.run(clanId, key, seals);
      stmtWeekTaskClaim.run(clanId, key);
    }
    addRating(clanId, WEEK_TASK.rewardPts, now, "week");
    return {
      ok: true,
      message: "Недельное задание выполнено · +" + WEEK_TASK.rewardPts + " к рейтингу",
      rewardPts: WEEK_TASK.rewardPts,
      task: store.clanGetWeekTask(user, { now }),
    };
  };
}

module.exports = {
  attachClanWarMethods,
  warTierOf,
  isEliteWar,
  isFlagship,
  siegeWindow,
  siegeWindowMs,
  siegeClosedSlotStart,
  bidCostFor,
  computeSiegePower,
  RANK_POINTS,
  WEEK_TASK,
  DEFENDER_BONUS_PCT,
  CLAN_SIEGE_DAILY_TEST,
  siegePeriodMs,
};
