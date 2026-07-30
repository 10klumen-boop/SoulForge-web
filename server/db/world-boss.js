"use strict";

const path = require("path");
const balance = require(path.join(
  __dirname,
  "..",
  "..",
  "game",
  "src",
  "data",
  "party-content-data.js"
));

const WORLD_BOSSES = Array.isArray(balance.WORLD_BOSSES) && balance.WORLD_BOSSES.length
  ? balance.WORLD_BOSSES
  : [
      balance.WORLD_BOSS || {
        id: "world_zaken",
        name: "Закен",
        hourParity: "odd",
        windowMs: 5 * 60 * 1000,
        cooldownMs: 55 * 60 * 1000,
        mob: "zaken",
        reqLevel: 3,
        cosmeticHp: 10_000_000,
        loot: {
          places: {
            1: { accessoryId: "zaken_earring" },
            2: { shards: { id: "zaken_earring_shard", qty: 1 } },
            3: { shards: { id: "zaken_earring_shard", qty: 1 } },
          },
        },
      },
    ];

const WORLD_BOSS = WORLD_BOSSES[0];

const CLICK_THROTTLE_MS = 150;
const crypto = require("crypto");

function swipeCfg() {
  return (
    balance.WORLD_BOSS_SWIPE || {
      minClicks: 100,
      maxClicks: 150,
      maxFails: 3,
      timeLimitMs: 6500,
    }
  );
}

function rollSwipeGap() {
  const cfg = swipeCfg();
  const min = Math.max(1, Math.floor(Number(cfg.minClicks) || 100));
  const max = Math.max(min, Math.floor(Number(cfg.maxClicks) || 150));
  return min + Math.floor(Math.random() * (max - min + 1));
}

function ensureSwipeRow(row) {
  if (!row) return row;
  if (row.damage == null) row.damage = Number(row.clicks) || 0;
  if (row.hits == null) row.hits = Number(row.clicks) || 0;
  if (row.clicks == null) row.clicks = Number(row.damage) || 0;
  if (row.swipeNextAt == null) row.swipeNextAt = rollSwipeGap();
  if (row.swipeFails == null) row.swipeFails = 0;
  if (!row.swipePending) row.swipePending = false;
  if (!row.swipeDir) row.swipeDir = "ltr";
  if (!row.swipeToken) row.swipeToken = "";
  return row;
}

function beginSwipeChallenge(row) {
  row.swipePending = true;
  row.swipeDir = Math.random() < 0.5 ? "ltr" : "rtl";
  row.swipeToken = crypto.randomBytes(8).toString("hex");
  row.swipeIssuedAt = Date.now();
}

function clearSwipeChallenge(row, scheduleNext) {
  row.swipePending = false;
  row.swipeToken = "";
  row.swipeIssuedAt = 0;
  if (scheduleNext) {
    row.swipeNextAt = (Number(row.hits) || 0) + rollSwipeGap();
  }
}

function hitDmgMax() {
  const cfg = swipeCfg();
  return Math.max(1, Math.floor(Number(cfg.hitDmgMax) || 50000));
}

function normalizeHitDamage(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(hitDmgMax(), n);
}

function resolveBoss(id) {
  if (typeof balance.worldBossById === "function") {
    return balance.worldBossById(id) || WORLD_BOSS;
  }
  return WORLD_BOSSES.find((b) => b.id === id) || WORLD_BOSS;
}

function bossForNow(now) {
  if (typeof balance.worldBossForNow === "function") {
    return balance.worldBossForNow(now) || WORLD_BOSS;
  }
  return WORLD_BOSS;
}

function hourStartMs(now) {
  if (typeof balance.worldBossHourStartMs === "function") {
    return balance.worldBossHourStartMs(now);
  }
  const d = new Date(Number(now) || Date.now());
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function nextStartMs(bossId, now) {
  if (typeof balance.worldBossNextStartMs === "function") {
    return balance.worldBossNextStartMs(bossId, now);
  }
  return hourStartMs(now) + 60 * 60 * 1000;
}

function attachWorldBossMethods(db, store) {
  let cycle = null;

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS world_boss_cycle (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cycle_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        next_at INTEGER NOT NULL,
        winner_user_id INTEGER,
        payload TEXT
      );
    `);
  } catch (_) {}

  function loadPersisted() {
    try {
      const row = db.prepare("SELECT * FROM world_boss_cycle WHERE id = 1").get();
      if (!row) return null;
      let payload = {};
      try {
        payload = JSON.parse(row.payload || "{}");
      } catch (_) {}
      const clicks = new Map();
      for (const e of payload.clicks || []) {
        clicks.set(Number(e.userId), ensureSwipeRow({
          damage: Number(e.damage != null ? e.damage : e.clicks) || 0,
          hits: Number(e.hits != null ? e.hits : e.clicks) || 0,
          clicks: Number(e.damage != null ? e.damage : e.clicks) || 0, // legacy alias
          characterId: String(e.characterId || ""),
          charName: String(e.charName || ""),
          nick: String(e.nick || ""),
          firstAt: Number(e.firstAt) || 0,
          lastAt: Number(e.lastAt) || 0,
          swipeNextAt: e.swipeNextAt != null ? Number(e.swipeNextAt) : null,
          swipeFails: Number(e.swipeFails) || 0,
          swipePending: !!e.swipePending,
          swipeDir: e.swipeDir === "rtl" ? "rtl" : "ltr",
          swipeToken: String(e.swipeToken || ""),
          swipeIssuedAt: Number(e.swipeIssuedAt) || 0,
        }));
      }
      return {
        cycleId: String(row.cycle_id),
        bossId: String(payload.bossId || WORLD_BOSS.id),
        status: String(row.status),
        startedAt: Number(row.started_at),
        endsAt: Number(row.ends_at),
        nextAt: Number(row.next_at),
        clicks,
        arena: new Set((payload.arena || []).map(Number)),
        winnerUserId: row.winner_user_id != null ? Number(row.winner_user_id) : null,
        claimed: new Set((payload.claimed || []).map(Number)),
        places: Array.isArray(payload.places) ? payload.places : [],
        forced: !!payload.forced,
      };
    } catch (_) {
      return null;
    }
  }

  function persist() {
    if (!cycle) return;
    const payload = JSON.stringify({
      bossId: cycle.bossId,
      forced: !!cycle.forced,
      clicks: [...cycle.clicks.entries()].map(([userId, v]) => ({
        userId,
        damage: Number(v.damage) || 0,
        hits: Number(v.hits) || 0,
        clicks: Number(v.damage) || 0,
        characterId: v.characterId,
        charName: v.charName,
        nick: v.nick,
        firstAt: v.firstAt,
        lastAt: v.lastAt,
        swipeNextAt: v.swipeNextAt,
        swipeFails: v.swipeFails || 0,
        swipePending: !!v.swipePending,
        swipeDir: v.swipeDir || "ltr",
        swipeToken: v.swipeToken || "",
        swipeIssuedAt: v.swipeIssuedAt || 0,
      })),
      arena: [...cycle.arena],
      claimed: [...cycle.claimed],
      places: cycle.places || [],
    });
    try {
      db.prepare(
        `INSERT INTO world_boss_cycle (id, cycle_id, status, started_at, ends_at, next_at, winner_user_id, payload)
         VALUES (1, @cycleId, @status, @startedAt, @endsAt, @nextAt, @winnerUserId, @payload)
         ON CONFLICT(id) DO UPDATE SET
           cycle_id=excluded.cycle_id,
           status=excluded.status,
           started_at=excluded.started_at,
           ends_at=excluded.ends_at,
           next_at=excluded.next_at,
           winner_user_id=excluded.winner_user_id,
           payload=excluded.payload`
      ).run({
        cycleId: cycle.cycleId,
        status: cycle.status,
        startedAt: cycle.startedAt,
        endsAt: cycle.endsAt,
        nextAt: cycle.nextAt,
        winnerUserId: cycle.winnerUserId,
        payload,
      });
    } catch (_) {}
  }

  function activeBoss() {
    return resolveBoss(cycle && cycle.bossId);
  }

  function slotFor(now) {
    const hourStart = hourStartMs(now);
    const boss = bossForNow(now);
    const windowMs = boss.windowMs || 5 * 60 * 1000;
    const endsAt = hourStart + windowMs;
    const nextAt = hourStart + 60 * 60 * 1000;
    const cycleId = "wb_" + boss.id + "_" + hourStart;
    return {
      boss,
      hourStart,
      endsAt,
      nextAt,
      cycleId,
      inWindow: now >= hourStart && now < endsAt,
    };
  }

  function startSlot(slot) {
    cycle = {
      cycleId: slot.cycleId,
      bossId: slot.boss.id,
      status: "active",
      startedAt: slot.hourStart,
      endsAt: slot.endsAt,
      nextAt: slot.nextAt,
      clicks: new Map(),
      arena: new Set(),
      winnerUserId: null,
      claimed: new Set(),
      places: [],
      forced: false,
    };
    persist();
  }

  function startIdle(slot) {
    cycle = {
      cycleId: slot.cycleId + "_idle",
      bossId: slot.boss.id,
      status: "idle",
      startedAt: slot.hourStart,
      endsAt: slot.endsAt,
      nextAt: slot.nextAt,
      clicks: new Map(),
      arena: new Set(),
      winnerUserId: null,
      claimed: new Set(),
      places: [],
      forced: false,
    };
    persist();
  }

  function startForced(now, boss) {
    const windowMs = boss.windowMs || 5 * 60 * 1000;
    cycle = {
      cycleId: "wb_" + boss.id + "_force_" + now,
      bossId: boss.id,
      status: "active",
      startedAt: now,
      endsAt: now + windowMs,
      nextAt: now + windowMs + 60 * 1000,
      clicks: new Map(),
      arena: new Set(),
      winnerUserId: null,
      claimed: new Set(),
      places: [],
      forced: true,
    };
    persist();
  }

  function rankedPlaces(limit) {
    return topDamage(limit || 3).map((row, idx) => ({
      place: idx + 1,
      userId: row.userId,
      damage: row.damage,
      clicks: row.damage,
      charName: row.charName,
      nick: row.nick,
      firstAt: row.firstAt,
    }));
  }

  function placeOfUser(userId) {
    if (userId == null || !cycle) return null;
    const places = cycle.places || rankedPlaces(3);
    const hit = places.find((p) => p.userId === userId);
    return hit ? hit.place : null;
  }

  function lootForPlace(place) {
    const boss = activeBoss();
    const places = (boss.loot && boss.loot.places) || {};
    const row = places[place] || places[String(place)];
    if (!row) return null;
    return JSON.parse(JSON.stringify(row));
  }

  function finalizeWinner() {
    if (!cycle || cycle.status !== "active") return;
    const boss = activeBoss();
    const places = rankedPlaces(3);
    cycle.status = "ended";
    cycle.places = places;
    cycle.winnerUserId = places.length ? places[0].userId : null;
    cycle.arena.clear();
    if (!cycle.nextAt || cycle.nextAt < cycle.endsAt) {
      cycle.nextAt = cycle.forced
        ? cycle.endsAt + 60 * 1000
        : cycle.endsAt - (boss.windowMs || 5 * 60 * 1000) + 60 * 60 * 1000;
    }
    persist();
  }

  function ensureCycle(now) {
    now = Number(now) || Date.now();
    if (!cycle) cycle = loadPersisted();

    // Forced windows keep their own timeline until end / nextAt.
    if (cycle && cycle.forced) {
      if (cycle.status === "active" && now >= cycle.endsAt) finalizeWinner();
      if ((cycle.status === "ended" || cycle.status === "idle") && now >= cycle.nextAt) {
        cycle.forced = false;
        // fall through to natural slot
      } else {
        return cycle;
      }
    }

    const slot = slotFor(now);

    if (cycle && cycle.status === "active" && !cycle.forced) {
      if (cycle.cycleId !== slot.cycleId) {
        // Слот сменился — закрываем старое окно.
        if (now >= cycle.endsAt) finalizeWinner();
        else {
          cycle.endsAt = Math.min(cycle.endsAt, now);
          finalizeWinner();
        }
      } else if (now >= cycle.endsAt) {
        finalizeWinner();
      }
    }

    if (slot.inWindow) {
      if (
        cycle &&
        (cycle.cycleId === slot.cycleId || cycle.cycleId === slot.cycleId + "_idle") &&
        cycle.status === "ended" &&
        cycle.bossId === slot.boss.id &&
        cycle.startedAt === slot.hourStart
      ) {
        // Уже завершён этот час — ждём nextAt.
        return cycle;
      }
      if (!cycle || cycle.cycleId !== slot.cycleId || cycle.status !== "active") {
        startSlot(slot);
      }
      return cycle;
    }

    // Вне окна текущего часа.
    if (cycle && cycle.status === "active" && now >= cycle.endsAt) finalizeWinner();

    if (
      cycle &&
      cycle.status === "ended" &&
      cycle.bossId === slot.boss.id &&
      (cycle.cycleId === slot.cycleId || cycle.startedAt === slot.hourStart) &&
      now < cycle.nextAt
    ) {
      return cycle;
    }

    if (!cycle || cycle.nextAt <= now || (cycle.status === "idle" && cycle.cycleId !== slot.cycleId + "_idle")) {
      startIdle(slot);
    } else if (cycle.status !== "ended" && cycle.status !== "idle") {
      startIdle(slot);
    }
    return cycle;
  }

  function topDamage(limit) {
    return [...cycle.clicks.entries()]
      .map(([userId, v]) => ({
        userId,
        damage: Number(v.damage) || 0,
        hits: Number(v.hits) || 0,
        clicks: Number(v.damage) || 0,
        charName: v.charName || v.nick || "?",
        nick: v.nick || "",
        firstAt: v.firstAt,
      }))
      .filter((r) => r.damage > 0)
      .sort((a, b) => b.damage - a.damage || a.firstAt - b.firstAt)
      .slice(0, limit || 5);
  }

  /** Публичный топ без чужих цифр — счёт виден только в state.my. */
  function publicTop(limit) {
    return topDamage(limit).map((row, idx) => ({
      place: idx + 1,
      userId: row.userId,
      charName: row.charName,
      nick: row.nick,
    }));
  }

  function publicPlaces(list) {
    return (list || []).map((p) => ({
      place: p.place,
      userId: p.userId,
      charName: p.charName,
      nick: p.nick || "",
    }));
  }

  function publicBoss(boss) {
    if (!boss) return null;
    return {
      id: boss.id,
      name: boss.name,
      reqLevel: boss.reqLevel || 1,
      cosmeticHp: boss.cosmeticHp || 10000,
      mob: boss.mob,
      mine: boss.mine || null,
      loot: boss.loot || {},
      lootBlurb: boss.lootBlurb || "",
      windowMs: boss.windowMs,
      cooldownMs: boss.cooldownMs,
      hourParity: boss.hourParity || null,
      ui: boss.ui || null,
    };
  }

  function publicState(user) {
    const now = Date.now();
    ensureCycle(now);
    const boss = activeBoss();
    const myPlace = user ? placeOfUser(user.id) : null;
    const myRow = user && cycle.clicks.has(user.id) ? ensureSwipeRow(cycle.clicks.get(user.id)) : null;
    const cfg = swipeCfg();
    const my =
      myRow
        ? {
            damage: Number(myRow.damage) || 0,
            hits: Number(myRow.hits) || 0,
            clicks: Number(myRow.damage) || 0,
            inArena: cycle.arena.has(user.id),
            place: myPlace,
            isWinner: myPlace === 1,
            canClaim: cycle.status === "ended" && myPlace >= 1 && myPlace <= 3 && !cycle.claimed.has(user.id),
            claimed: cycle.claimed.has(user.id),
            swipeRequired: !!myRow.swipePending,
            swipeFails: myRow.swipeFails || 0,
            swipeMaxFails: Math.max(1, Math.floor(Number(cfg.maxFails) || 3)),
            swipeDir: myRow.swipePending ? myRow.swipeDir || "ltr" : null,
            swipeToken: myRow.swipePending ? myRow.swipeToken || "" : null,
            swipeTimeLimitMs: Math.max(2000, Math.floor(Number(cfg.timeLimitMs) || 6500)),
          }
        : {
            damage: 0,
            hits: 0,
            clicks: 0,
            inArena: !!(user && cycle.arena.has(user.id)),
            place: myPlace,
            isWinner: myPlace === 1,
            canClaim: !!(
              user &&
              cycle.status === "ended" &&
              myPlace >= 1 &&
              myPlace <= 3 &&
              !cycle.claimed.has(user.id)
            ),
            claimed: !!(user && cycle.claimed.has(user.id)),
            swipeRequired: false,
            swipeFails: 0,
            swipeMaxFails: Math.max(1, Math.floor(Number(cfg.maxFails) || 3)),
            swipeDir: null,
            swipeToken: null,
            swipeTimeLimitMs: Math.max(2000, Math.floor(Number(cfg.timeLimitMs) || 6500)),
          };
    const winnerRow =
      cycle.winnerUserId != null && cycle.clicks.has(cycle.winnerUserId)
        ? cycle.clicks.get(cycle.winnerUserId)
        : null;
    const places =
      cycle.status === "ended"
        ? cycle.places && cycle.places.length
          ? cycle.places
          : rankedPlaces(3)
        : [];
    const bosses = WORLD_BOSSES.map((b) => {
      const nextAt = nextStartMs(b.id, now);
      const isCurrent = boss && boss.id === b.id;
      let cardStatus = "idle";
      // Всегда отсчёт до следующего слота ЭТОГО босса (чётный/нечётный час).
      // Не подменять cycle.nextAt — там ближайший любой слот (другой босс).
      let remainingMs = Math.max(0, nextAt - now);
      if (isCurrent && cycle.status === "active") {
        cardStatus = "active";
        remainingMs = Math.max(0, cycle.endsAt - now);
      } else if (isCurrent && cycle.status === "ended") {
        cardStatus = "ended";
      }
      return Object.assign(publicBoss(b), {
        cardStatus,
        nextAt,
        remainingMs,
      });
    });
    return {
      ok: true,
      bosses,
      boss: publicBoss(boss),
      schedule: {
        tz: balance.WORLD_BOSS_TZ_LABEL || "МСК",
        hourParity:
          typeof balance.worldBossParityForHour === "function"
            ? balance.worldBossParityForHour(balance.worldBossMskParts(now).hour)
            : null,
      },
      state: {
        cycleId: cycle.cycleId,
        bossId: cycle.bossId,
        status: cycle.status,
        startedAt: cycle.startedAt,
        endsAt: cycle.endsAt,
        nextAt: cycle.nextAt,
        now,
        remainingMs:
          cycle.status === "active"
            ? Math.max(0, cycle.endsAt - now)
            : Math.max(0, cycle.nextAt - now),
        top: publicTop(5),
        places: publicPlaces(places),
        winner: cycle.winnerUserId
          ? {
              userId: cycle.winnerUserId,
              charName: (winnerRow && (winnerRow.charName || winnerRow.nick)) || "?",
              place: 1,
            }
          : null,
        my,
      },
    };
  }

  function fail(user, error, message) {
    return Object.assign(publicState(user), { ok: false, error: error, message: message });
  }

  store.worldBossState = function worldBossState(user, opts) {
    opts = opts || {};
    if (opts.now) ensureCycle(opts.now);
    return publicState(user);
  };

  store.worldBossEnter = function worldBossEnter(user, opts) {
    opts = opts || {};
    const now = Number(opts.now) || Date.now();
    ensureCycle(now);
    if (cycle.status !== "active") return fail(user, "inactive", "Окно босса закрыто");
    const boss = activeBoss();
    const level = Math.max(1, Math.floor(Number(opts.level) || 1));
    if (level < (boss.reqLevel || 1)) {
      return fail(user, "level", "Нужен уровень " + (boss.reqLevel || 1));
    }
    if (opts.bossId && String(opts.bossId) !== cycle.bossId) {
      return fail(user, "boss", "Сейчас активен другой босс");
    }
    const characterId = String(opts.characterId || "");
    const charName = String(opts.charName || opts.name || "").trim() || user.nick;
    if (!cycle.clicks.has(user.id)) {
      cycle.clicks.set(
        user.id,
        ensureSwipeRow({
          damage: 0,
          hits: 0,
          clicks: 0,
          characterId: characterId,
          charName: charName,
          nick: user.nick,
          firstAt: 0,
          lastAt: 0,
        })
      );
    } else {
      const row = ensureSwipeRow(cycle.clicks.get(user.id));
      row.characterId = characterId || row.characterId;
      row.charName = charName || row.charName;
      row.nick = user.nick;
    }
    cycle.arena.add(user.id);
    persist();
    return publicState(user);
  };

  store.worldBossLeave = function worldBossLeave(user) {
    ensureCycle(Date.now());
    if (cycle) cycle.arena.delete(user.id);
    persist();
    return publicState(user);
  };

  store.worldBossClick = function worldBossClick(user, opts) {
    opts = opts || {};
    const now = Number(opts.now) || Date.now();
    ensureCycle(now);
    if (cycle.status !== "active") return fail(user, "inactive", "Окно босса закрыто");
    if (opts.autoClicker || opts.bySkill || opts.skillMult) {
      return fail(user, "invalid", "Только ручные клики");
    }
    if (!cycle.arena.has(user.id)) return fail(user, "arena", "Сначала войди на арену");
    let row = cycle.clicks.get(user.id);
    if (!row) {
      row = ensureSwipeRow({
        damage: 0,
        hits: 0,
        clicks: 0,
        characterId: String(opts.characterId || ""),
        charName: String(opts.charName || user.nick),
        nick: user.nick,
        firstAt: 0,
        lastAt: 0,
      });
      cycle.clicks.set(user.id, row);
    } else {
      ensureSwipeRow(row);
      if (row.damage == null) row.damage = Number(row.clicks) || 0;
      if (row.hits == null) row.hits = Number(row.clicks) || 0;
    }
    if (opts._testSwipeNextAt != null) {
      row.swipeNextAt = Math.max(1, Math.floor(Number(opts._testSwipeNextAt)));
    }
    if (row.swipePending) {
      return Object.assign(publicState(user), {
        ok: false,
        error: "swipe",
        message: "Проведи по полосе, чтобы продолжить",
        swipeRequired: true,
      });
    }
    if (row.lastAt && now - row.lastAt < CLICK_THROTTLE_MS) {
      return Object.assign(publicState(user), { ok: true, throttled: true });
    }
    const dmg = normalizeHitDamage(opts.damage != null ? opts.damage : 1);
    row.damage = (Number(row.damage) || 0) + dmg;
    row.hits = (Number(row.hits) || 0) + 1;
    row.clicks = row.damage;
    if (!row.firstAt) row.firstAt = now;
    row.lastAt = now;
    if (opts.charName) row.charName = String(opts.charName);
    if (opts.characterId) row.characterId = String(opts.characterId);
    let swipeRequired = false;
    if (row.hits >= (row.swipeNextAt || 0)) {
      beginSwipeChallenge(row);
      swipeRequired = true;
      persist();
    } else if (row.hits % 10 === 0) {
      persist();
    }
    return Object.assign(publicState(user), {
      ok: true,
      swipeRequired: swipeRequired,
      hitDamage: dmg,
    });
  };

  store.worldBossSwipe = function worldBossSwipe(user, opts) {
    opts = opts || {};
    const now = Number(opts.now) || Date.now();
    ensureCycle(now);
    if (cycle.status !== "active") return fail(user, "inactive", "Окно босса закрыто");
    if (!cycle.arena.has(user.id)) return fail(user, "arena", "Сначала войди на арену");
    const row = cycle.clicks.get(user.id);
    if (!row || !row.swipePending) {
      return fail(user, "swipe", "Проверка не требуется");
    }
    ensureSwipeRow(row);
    const token = String(opts.token || "");
    if (!row.swipeToken || token !== row.swipeToken) {
      return fail(user, "token", "Устаревшая проверка — обнови арену");
    }
    const cfg = swipeCfg();
    const maxFails = Math.max(1, Math.floor(Number(cfg.maxFails) || 3));
    const success = !!opts.success;
    if (success) {
      clearSwipeChallenge(row, true);
      persist();
      return Object.assign(publicState(user), { ok: true, swipeOk: true });
    }
    row.swipeFails = (Number(row.swipeFails) || 0) + 1;
    if (row.swipeFails >= maxFails) {
      row.damage = 0;
      row.hits = 0;
      row.clicks = 0;
      row.swipeFails = 0;
      row.firstAt = 0;
      row.lastAt = 0;
      clearSwipeChallenge(row, false);
      row.swipeNextAt = rollSwipeGap();
      persist();
      return Object.assign(publicState(user), {
        ok: true,
        swipeOk: false,
        wiped: true,
        message: "3 провала — урон сброшен",
      });
    }
    beginSwipeChallenge(row);
    persist();
    return Object.assign(publicState(user), {
      ok: true,
      swipeOk: false,
      wiped: false,
      message: "Свайп не засчитан · попытка " + row.swipeFails + "/" + maxFails,
    });
  };

  store.worldBossClaim = function worldBossClaim(user, opts) {
    opts = opts || {};
    const now = Number(opts.now) || Date.now();
    ensureCycle(now);
    if (cycle.status === "active" && now >= cycle.endsAt) finalizeWinner();
    if (cycle.status !== "ended") return fail(user, "active", "Окно ещё идёт");
    if (!cycle.places || !cycle.places.length) {
      cycle.places = rankedPlaces(3);
      if (cycle.places.length) cycle.winnerUserId = cycle.places[0].userId;
      persist();
    }
    const place = placeOfUser(user.id);
    if (!(place >= 1 && place <= 3)) {
      return fail(user, "place", "Лут только топ-3");
    }
    if (cycle.claimed.has(user.id)) return fail(user, "claimed", "Уже забрано");
    const loot = lootForPlace(place);
    if (!loot) return fail(user, "loot", "Нет награды за это место");
    cycle.claimed.add(user.id);
    persist();
    return Object.assign(publicState(user), { ok: true, loot: loot, place: place });
  };

  store.worldBossForceStart = function worldBossForceStart(opts) {
    opts = opts || {};
    const now = Number(opts.now) || Date.now();
    const boss = resolveBoss(opts.bossId || WORLD_BOSS.id);
    startForced(now, boss);
    return publicState(null);
  };

  store.worldBossForceEnd = function worldBossForceEnd(opts) {
    opts = opts || {};
    const now = Number(opts.now) || Date.now();
    if (!cycle) cycle = loadPersisted();
    // Не гоняем ensureCycle(future) до finalize — иначе forced nextAt истечёт и слот уйдёт в idle.
    if (cycle && cycle.status === "active") {
      cycle.endsAt = now;
      finalizeWinner();
    } else {
      ensureCycle(now);
    }
    return publicState(null);
  };

  ensureCycle(Date.now());
}

module.exports = { attachWorldBossMethods, WORLD_BOSS, WORLD_BOSSES };
