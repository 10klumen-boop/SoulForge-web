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

const WORLD_BOSS = balance.WORLD_BOSS || {
  id: "world_zaken",
  name: "Закен",
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
};

const CLICK_THROTTLE_MS = 150;

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
        clicks.set(Number(e.userId), {
          clicks: Number(e.clicks) || 0,
          characterId: String(e.characterId || ""),
          charName: String(e.charName || ""),
          nick: String(e.nick || ""),
          firstAt: Number(e.firstAt) || 0,
          lastAt: Number(e.lastAt) || 0,
        });
      }
      return {
        cycleId: String(row.cycle_id),
        status: String(row.status),
        startedAt: Number(row.started_at),
        endsAt: Number(row.ends_at),
        nextAt: Number(row.next_at),
        clicks,
        arena: new Set((payload.arena || []).map(Number)),
        winnerUserId: row.winner_user_id != null ? Number(row.winner_user_id) : null,
        claimed: new Set((payload.claimed || []).map(Number)),
        places: Array.isArray(payload.places) ? payload.places : [],
      };
    } catch (_) {
      return null;
    }
  }

  function persist() {
    if (!cycle) return;
    const payload = JSON.stringify({
      clicks: [...cycle.clicks.entries()].map(([userId, v]) => ({
        userId,
        clicks: v.clicks,
        characterId: v.characterId,
        charName: v.charName,
        nick: v.nick,
        firstAt: v.firstAt,
        lastAt: v.lastAt,
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

  function newCycleId(now) {
    return "wb_" + WORLD_BOSS.id + "_" + now;
  }

  function startActive(now) {
    const windowMs = WORLD_BOSS.windowMs || 5 * 60 * 1000;
    const cooldownMs = WORLD_BOSS.cooldownMs || 55 * 60 * 1000;
    cycle = {
      cycleId: newCycleId(now),
      status: "active",
      startedAt: now,
      endsAt: now + windowMs,
      nextAt: now + windowMs + cooldownMs,
      clicks: new Map(),
      arena: new Set(),
      winnerUserId: null,
      claimed: new Set(),
      places: [],
    };
    persist();
  }

  function rankedPlaces(limit) {
    return topClicks(limit || 3).map((row, idx) => ({
      place: idx + 1,
      userId: row.userId,
      clicks: row.clicks,
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
    const places = (WORLD_BOSS.loot && WORLD_BOSS.loot.places) || {};
    const row = places[place] || places[String(place)];
    if (!row) return null;
    return JSON.parse(JSON.stringify(row));
  }

  function finalizeWinner() {
    if (!cycle || cycle.status !== "active") return;
    const places = rankedPlaces(3);
    cycle.status = "ended";
    cycle.places = places;
    cycle.winnerUserId = places.length ? places[0].userId : null;
    cycle.arena.clear();
    if (!cycle.nextAt || cycle.nextAt < cycle.endsAt) {
      cycle.nextAt = cycle.endsAt + (WORLD_BOSS.cooldownMs || 55 * 60 * 1000);
    }
    persist();
  }

  function ensureCycle(now) {
    now = Number(now) || Date.now();
    if (!cycle) cycle = loadPersisted();
    if (!cycle) {
      startActive(now);
      return cycle;
    }
    if (cycle.status === "active" && now >= cycle.endsAt) finalizeWinner();
    if ((cycle.status === "ended" || cycle.status === "idle") && now >= cycle.nextAt) {
      startActive(now);
    }
    return cycle;
  }

  function topClicks(limit) {
    return [...cycle.clicks.entries()]
      .map(([userId, v]) => ({
        userId,
        clicks: v.clicks,
        charName: v.charName || v.nick || "?",
        nick: v.nick || "",
        firstAt: v.firstAt,
      }))
      .filter((r) => r.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks || a.firstAt - b.firstAt)
      .slice(0, limit || 5);
  }

  /** Публичный топ без чужих кликов — счёт виден только в state.my. */
  function publicTop(limit) {
    return topClicks(limit).map((row, idx) => ({
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

  function publicState(user) {
    const now = Date.now();
    ensureCycle(now);
    const myPlace = user ? placeOfUser(user.id) : null;
    const my =
      user && cycle.clicks.has(user.id)
        ? {
            clicks: cycle.clicks.get(user.id).clicks,
            inArena: cycle.arena.has(user.id),
            place: myPlace,
            isWinner: myPlace === 1,
            canClaim: cycle.status === "ended" && myPlace >= 1 && myPlace <= 3 && !cycle.claimed.has(user.id),
            claimed: cycle.claimed.has(user.id),
          }
        : {
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
    return {
      ok: true,
      boss: {
        id: WORLD_BOSS.id,
        name: WORLD_BOSS.name,
        reqLevel: WORLD_BOSS.reqLevel || 1,
        cosmeticHp: WORLD_BOSS.cosmeticHp || 10000,
        mob: WORLD_BOSS.mob,
        mine: WORLD_BOSS.mine || null,
        loot: WORLD_BOSS.loot || {},
        windowMs: WORLD_BOSS.windowMs,
        cooldownMs: WORLD_BOSS.cooldownMs,
        ui: WORLD_BOSS.ui || null,
      },
      state: {
        cycleId: cycle.cycleId,
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
    const level = Math.max(1, Math.floor(Number(opts.level) || 1));
    if (level < (WORLD_BOSS.reqLevel || 1)) {
      return fail(user, "level", "Нужен уровень " + (WORLD_BOSS.reqLevel || 1));
    }
    const characterId = String(opts.characterId || "");
    const charName = String(opts.charName || opts.name || "").trim() || user.nick;
    if (!cycle.clicks.has(user.id)) {
      cycle.clicks.set(user.id, {
        clicks: 0,
        characterId: characterId,
        charName: charName,
        nick: user.nick,
        firstAt: 0,
        lastAt: 0,
      });
    } else {
      const row = cycle.clicks.get(user.id);
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
      row = {
        clicks: 0,
        characterId: String(opts.characterId || ""),
        charName: String(opts.charName || user.nick),
        nick: user.nick,
        firstAt: 0,
        lastAt: 0,
      };
      cycle.clicks.set(user.id, row);
    }
    if (row.lastAt && now - row.lastAt < CLICK_THROTTLE_MS) {
      return Object.assign(publicState(user), { ok: true, throttled: true });
    }
    row.clicks += 1;
    if (!row.firstAt) row.firstAt = now;
    row.lastAt = now;
    if (opts.charName) row.charName = String(opts.charName);
    if (opts.characterId) row.characterId = String(opts.characterId);
    if (row.clicks % 10 === 0) persist();
    return Object.assign(publicState(user), { ok: true });
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
    startActive(Number(opts.now) || Date.now());
    return publicState(null);
  };

  store.worldBossForceEnd = function worldBossForceEnd(opts) {
    opts = opts || {};
    ensureCycle(Number(opts.now) || Date.now());
    if (cycle && cycle.status === "active") {
      cycle.endsAt = Number(opts.now) || Date.now();
      finalizeWinner();
    }
    return publicState(null);
  };

  ensureCycle(Date.now());
}

module.exports = { attachWorldBossMethods, WORLD_BOSS };
