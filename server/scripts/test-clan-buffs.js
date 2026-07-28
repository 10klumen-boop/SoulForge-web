#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { createStore } = require("../db");
const { clanOnlineBuffFromCount, clanUtcWeekId } = require("../db/clan-buffs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-clan-buff-"));
const store = createStore({ dataDir: tmpDir, dbPath: path.join(tmpDir, "test.db") });

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

function makeSave(adena) {
  return {
    activeCharacterId: "c1",
    characters: [
      {
        id: "c1",
        progress: {
          adena,
          avatar: { created: true, name: "BuffHero" },
          inventory: [],
          totals: { tries: 0, fails: 0, earned: 0 },
        },
      },
    ],
    adena,
  };
}

assert(clanOnlineBuffFromCount(0).tier === 0, "t0");
assert(clanOnlineBuffFromCount(2).adenaPct === 1, "t1");
assert(clanOnlineBuffFromCount(7).tier === 3, "t3");
assert(/^\d{4}-W\d{2}$/.test(clanUtcWeekId(Date.now())), "week id");

const now = Date.now();
const u = store.insertUser("BuffLead", bcrypt.hashSync("pass1234", 4), now);
const lead = { id: u.id, nick: "BuffLead" };
store.persistPlayerSave(lead, 1, now, "0.58", makeSave(250_000_000));
assert(store.chatCreateClan(lead, { name: "BuffClan", now: now + 1 }).ok, "clan");

// Claim pays from warehouse — fund first, then claim for activity score.
const depClaim = store.clanWarehouseDeposit(lead, {
  amount: 10_000_000,
  characterId: "c1",
  now: now + 2,
});
assert(depClaim.ok, "seed claim funds");
const claim = store.clanClaimTerritory(lead, { territoryId: "wasteland", now: now + 3 });
assert(claim.ok, "claim " + (claim.message || claim.error));

let buffs = store.clanGetBuffs(lead, { now: now + 4 });
// claim +50; deposit also accrues activity score
assert(buffs.ok && buffs.score >= 50, "claim score " + buffs.score);
assert(buffs.adenaPct === 0, "no online buff alone at 0–1");
assert(Array.isArray(buffs.catalog) && buffs.catalog.length >= 6, "catalog");
assert(buffs.catalog.some((c) => c.branch === "farm"), "farm branch");
assert(buffs.catalog.some((c) => c.branch === "xp"), "xp branch");
assert(buffs.catalog.some((c) => c.branch === "pvp"), "pvp branch");
assert(buffs.catalog.some((c) => c.branch === "pvp_def"), "pvp_def branch");
assert(buffs.pvpPct === 0, "no pvp yet");
assert(buffs.pvpDefPct === 0, "no pvp def yet");

// Deposit to warehouse for study (I+II farm)
const dep = store.clanWarehouseDeposit(lead, {
  amount: 80_000_000,
  characterId: "c1",
  now: now + 5,
});
assert(dep.ok, "deposit");

buffs = store.clanGetBuffs(lead, { now: now + 6 });
assert(buffs.warehouseAdena >= 80_000_000, "wh funded");
assert(buffs.level === 1, "start level 1");
assert(typeof buffs.xp === "number", "xp field");

const study = store.clanStudyBuff(lead, { buffId: "greed_1", now: now + 7 });
assert(study.ok, "study greed_1 " + (study.message || ""));
assert(study.studiedId === "greed_1", "studied id");
assert(study.adenaPct === 2, "studied adena buff " + study.adenaPct);

const failDup = store.clanStudyBuff(lead, { buffId: "greed_1", now: now + 8 });
assert(!failDup.ok, "no duplicate");

const failLvl = store.clanStudyBuff(lead, { buffId: "greed_2", now: now + 8.5 });
assert(!failLvl.ok && failLvl.error === "clan_level", "greed_2 locked by level " + (failLvl.error || ""));

const clanId = study.clanId;
assert(clanId, "clan id");
const boost = store.clanAddActivityScore(clanId, 200, { now: now + 9 });
assert(boost.ok && boost.level >= 2, "boost to level 2 " + boost.level);

const greed2 = store.clanStudyBuff(lead, { buffId: "greed_2", now: now + 10 });
assert(greed2.ok, "greed_2 after level 2 " + (greed2.message || ""));
assert(greed2.adenaPct === 5, "2+3 studied " + greed2.adenaPct);
assert(greed2.level >= 2, "still level 2+");

const xp1 = store.clanStudyBuff(lead, { buffId: "wisdom_1", now: now + 11 });
assert(xp1.ok, "wisdom_1 " + (xp1.message || ""));
assert(xp1.xpPct === 2, "xp buff");

const valor1 = store.clanStudyBuff(lead, { buffId: "valor_1", now: now + 12 });
assert(valor1.ok, "valor_1 " + (valor1.message || ""));
assert(valor1.pvpPct === 2, "pvp buff " + valor1.pvpPct);

const dep2 = store.clanWarehouseDeposit(lead, {
  amount: 20_000_000,
  characterId: "c1",
  now: now + 12.5,
});
assert(dep2.ok, "deposit for aegis");

const aegis1 = store.clanStudyBuff(lead, { buffId: "aegis_1", now: now + 13 });
assert(aegis1.ok, "aegis_1 " + (aegis1.message || ""));
assert(aegis1.pvpDefPct === 2, "pvp def " + aegis1.pvpDefPct);

console.log("clan-buffs: ok");
