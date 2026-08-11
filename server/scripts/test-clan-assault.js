#!/usr/bin/env node
"use strict";

/**
 * Штурм узлов по силе: weak не покупает, elite только осада, resolve по power+печати.
 * Run: node server/scripts/test-clan-assault.js
 */
const path = require("path");
const os = require("os");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { createStore } = require("../db");
const {
  DEFENDER_BONUS_PCT,
  ASSAULT_WINDOW_MS,
  ASSAULT_POWER_GATE_MIN,
  ASSAULT_SEAL_SCORE_CAP,
} = require("../db/clan-war");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

function makeSave(adena, name, charId) {
  const id = charId || "c1";
  return {
    activeCharacterId: id,
    characters: [
      {
        id,
        progress: {
          adena,
          avatar: { created: true, name: name || "Hero" },
          inventory: [],
          totals: { tries: 0, fails: 0, earned: 0 },
        },
      },
    ],
    adena,
  };
}

assert(DEFENDER_BONUS_PCT >= 0.25, "defender bonus 25%");
assert(ASSAULT_SEAL_SCORE_CAP <= 40, "seal cap limited");
assert(ASSAULT_POWER_GATE_MIN === 0.5, "power gate");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-clan-assault-"));
const dbPath = path.join(tmpDir, "test.db");
const store = createStore({ dataDir: tmpDir, dbPath });

const now = Date.now();
const hash = bcrypt.hashSync("pass1234", 4);
const uLead = store.insertUser("ALead", hash, now);
const uMem = store.insertUser("AMem", hash, now + 1);
const uRiv = store.insertUser("ARival", hash, now + 2);
const lead = { id: uLead.id, nick: "ALead" };
const mem = { id: uMem.id, nick: "AMem" };
const rival = { id: uRiv.id, nick: "ARival" };

store.persistPlayerSave(lead, 1, now, "0.61", makeSave(80_000_000, "Lead", "lead1"));
store.persistPlayerSave(mem, 1, now + 1, "0.61", makeSave(1_000_000, "Mem", "mem1"));
store.persistPlayerSave(rival, 1, now + 2, "0.61", makeSave(200_000_000, "Riv", "riv1"));

const c1 = store.chatCreateClan(lead, { name: "StrongHold", now: now + 3 });
assert(c1.ok, "create strong");
const c2 = store.chatCreateClan(rival, { name: "WeakHold", now: now + 4 });
assert(c2.ok, "create weak");

const inv = store.chatInviteClan(lead, { nick: "AMem", now: now + 5 });
assert(inv.ok, "invite");
assert(
  store.chatRespondClanInvite(mem, { inviteId: inv.inviteId, accept: true, now: now + 6 }).ok,
  "join"
);

assert(
  store.clanWarehouseDeposit(lead, { amount: 10_000_000, characterId: "lead1", now: now + 7 }).ok,
  "lead wh"
);
assert(
  store.clanWarehouseDeposit(rival, { amount: 100_000_000, characterId: "riv1", now: now + 8 }).ok,
  "riv wh"
);

// Free normal claim
const claim = store.clanClaimTerritory(lead, {
  territoryId: "abandoned_camp",
  now: now + 9,
});
assert(claim.ok, "claim camp: " + (claim.message || claim.error));

const claimElite = store.clanClaimTerritory(lead, {
  territoryId: "wasteland",
  now: now + 9.5,
});
assert(claimElite.ok, "claim elite: " + (claimElite.message || claimElite.error));

// Elite cannot assault/eco
const elite = store.clanContestTerritory(rival, {
  territoryId: "wasteland",
  now: now + 10,
});
assert(!elite.ok && elite.error === "siege_only", "elite siege_only: " + JSON.stringify(elite));

// Need free farm slot for rival later — release elite from lead so only camp held
assert(
  store.clanReleaseTerritory(lead, { territoryId: "wasteland", now: now + 10.5 }).ok,
  "release elite"
);

// Lock 24h
const locked = store.clanStartAssault(rival, {
  territoryId: "abandoned_camp",
  now: now + 10,
});
assert(!locked.ok && locked.error === "lock", "24h lock: " + JSON.stringify(locked));

const afterLock = now + 9 + 24 * 60 * 60 * 1000 + 1000;

// Strong holder (2) vs weak (1): gate may allow (>=50%) — start ok or too_weak
const start = store.clanStartAssault(rival, {
  territoryId: "abandoned_camp",
  now: afterLock,
});
assert(start.ok, "assault start: " + (start.message || start.error));
assert(start.assault && start.assault.status === "active", "active assault");
assert(start.assault.defPower > start.assault.atkPower, "defender effective >= raw atk");

// Early resolve blocked
const early = store.clanResolveAssault(rival, {
  territoryId: "abandoned_camp",
  now: afterLock + 1000,
});
assert(!early.ok && early.error === "early", "early resolve");

// After window: defender wins (higher power)
const resolved = store.clanResolveAssault(rival, {
  territoryId: "abandoned_camp",
  now: afterLock + ASSAULT_WINDOW_MS + 1000,
});
assert(resolved.ok, "resolve: " + (resolved.message || resolved.error));
assert(!resolved.attackerWins, "weak attacker loses");
const holders = store.clanListTerritories({ skipResolve: true }).holders;
assert(
  holders.some((h) => h.territoryId === "abandoned_camp" && h.clanId === c1.clan.id),
  "strong still holds"
);

// Contest alias = assault (now on CD after lose)
const alias = store.clanContestTerritory(rival, {
  territoryId: "abandoned_camp",
  now: afterLock + ASSAULT_WINDOW_MS + 2000,
});
assert(!alias.ok && (alias.error === "cooldown" || alias.error === "lock"), "cd after lose");

console.log("test-clan-assault: ok");
