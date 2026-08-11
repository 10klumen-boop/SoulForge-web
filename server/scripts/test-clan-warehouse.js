#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { createStore } = require("../db");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-clan-wh-"));
const dbPath = path.join(tmpDir, "test.db");
const store = createStore({ dataDir: tmpDir, dbPath });

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

const now = Date.now();
const u1 = store.insertUser("ClanLead", bcrypt.hashSync("pass1234", 4), now);
const u2 = store.insertUser("ClanMem", bcrypt.hashSync("pass1234", 4), now);
const u3 = store.insertUser("ClanRival", bcrypt.hashSync("pass1234", 4), now);
const lead = { id: u1.id, nick: "ClanLead" };
const mem = { id: u2.id, nick: "ClanMem" };
const rival = { id: u3.id, nick: "ClanRival" };

store.persistPlayerSave(lead, 1, now, "0.58", makeSave(50_000_000, "LeadHero", "lead1"));
store.persistPlayerSave(mem, 1, now + 1, "0.58", makeSave(500_000, "MemHero", "mem1"));
store.persistPlayerSave(rival, 1, now + 2, "0.58", makeSave(200_000_000, "RivalHero", "riv1"));

const created = store.chatCreateClan(lead, { name: "IronHold", now: now + 3 });
assert(created.ok && created.clan && created.clan.id, "create clan");
assert(store.chatCreateClan(rival, { name: "RivalHold", now: now + 4 }).ok, "rival clan");

const depSeed = store.clanWarehouseDeposit(lead, {
  amount: 10_000_000,
  characterId: "lead1",
  now: now + 5,
});
assert(depSeed.ok && depSeed.adena === 10_000_000, "seed warehouse " + JSON.stringify(depSeed));
assert(depSeed.save.data.characters[0].progress.adena === 40_000_000, "char paid seed");
assert(depSeed.xpGained === 120, "seed donation xp " + depSeed.xpGained);

const claim = store.clanClaimTerritory(lead, { territoryId: "abandoned_camp", now: now + 6 });
assert(claim.ok, "claim abandoned_camp: " + (claim.message || claim.error));
assert(claim.warehouseAdena === 5_000_000, "wh after claim " + claim.warehouseAdena);

const list = store.clanListTerritories();
assert(
  list.holders.some((h) => h.territoryId === "abandoned_camp" && h.clanId === created.clan.id),
  "holder listed"
);

// Contest/assault lock: right after claim
const rivDep = store.clanWarehouseDeposit(rival, {
  amount: 100_000_000,
  characterId: "riv1",
  now: now + 7,
});
assert(rivDep.ok, "rival seed wh");
const locked = store.clanContestTerritory(rival, {
  territoryId: "abandoned_camp",
  now: now + 8,
});
assert(!locked.ok && locked.error === "lock", "assault lock right after claim: " + JSON.stringify(locked));

const badAmt = store.clanWarehouseDeposit(lead, {
  amount: 100_000,
  characterId: "lead1",
  now: now + 9,
});
assert(!badAmt.ok && badAmt.error === "amount", "reject free amount " + JSON.stringify(badAmt));

const dep = store.clanWarehouseDeposit(lead, {
  amount: 1_000_000,
  characterId: "lead1",
  now: now + 9,
});
assert(dep.ok && dep.adena === 6_000_000, "deposit " + JSON.stringify(dep));
assert(dep.save.data.characters[0].progress.adena === 39_000_000, "char paid");
assert(dep.xpGained === 10, "1kk donation xp");

const inv = store.chatInviteClan(lead, { nick: "MemHero", now: now + 10 });
assert(inv.ok && inv.inviteId, "invite");
const join = store.chatRespondClanInvite(mem, { inviteId: inv.inviteId, accept: true, now: now + 11 });
assert(join.ok, "join " + JSON.stringify(join));

const stillNo = store.clanWarehouseWithdraw(mem, {
  amount: 10_000,
  characterId: "mem1",
  now: now + 12,
});
assert(!stillNo.ok, "member still cannot withdraw");

const wh = store.clanGetWarehouse(lead, { now: now + 13 });
assert(wh.ok && wh.adena === 6_000_000, "warehouse get");
assert(wh.canWithdraw === false, "withdraw disabled");
assert(Array.isArray(wh.donations) && wh.donations.length >= 4, "donation tiers");
assert(wh.holdings.some((h) => h.territoryId === "abandoned_camp"), "holdings");

const rentNow = now + 13 + 24 * 60 * 60 * 1000;
const wh2 = store.clanGetWarehouse(lead, { now: rentNow });
assert(wh2.ok && wh2.rentAdded === 45000, "rent day " + wh2.rentAdded);
assert(wh2.adena === 6_045_000, "adena after rent " + wh2.adena);

const wd = store.clanWarehouseWithdraw(lead, {
  amount: 25_000,
  characterId: "lead1",
  now: rentNow + 5,
});
assert(!wd.ok && wd.error === "disabled", "withdraw permanently disabled");

const already = store.clanClaimTerritory(lead, { territoryId: "abandoned_camp", now: rentNow + 6 });
assert(already.ok, "already owned abandoned_camp ok");
const cap2 = store.clanClaimTerritory(lead, { territoryId: "wasteland", now: rentNow + 7 });
assert(cap2.ok, "second farm wasteland: " + (cap2.message || cap2.error));
const cap3 = store.clanClaimTerritory(lead, { territoryId: "ruins_agony", now: rentNow + 8 });
assert(!cap3.ok && cap3.error === "cap", "farm cap 2 blocks third");
const city = store.clanClaimTerritory(lead, { territoryId: "gludio", now: rentNow + 9 });
assert(!city.ok && (city.error === "siege_off" || city.error === "zone"), "city hub not claimable in MVP");
const execFree = store.clanClaimTerritory(lead, { territoryId: "execution_grounds", now: rentNow + 10 });
assert(!execFree.ok && execFree.error === "cap", "cannot take 3rd while holding 2");

// Elite → siege_only; assault normal farm after 24h shield
const unlockedAt = rentNow + 11 + 24 * 60 * 60 * 1000;
const eliteBlock = store.clanContestTerritory(rival, {
  territoryId: "wasteland",
  now: unlockedAt,
});
assert(
  !eliteBlock.ok && eliteBlock.error === "siege_only",
  "elite no eco: " + JSON.stringify(eliteBlock)
);

const rel = store.clanReleaseTerritory(lead, {
  territoryId: "wasteland",
  now: unlockedAt + 1,
});
assert(rel.ok, "release wasteland for assault test");

const assaulted = store.clanStartAssault(rival, {
  territoryId: "abandoned_camp",
  now: unlockedAt + 2,
});
assert(assaulted.ok && assaulted.started, "assault start: " + (assaulted.message || assaulted.error));
assert(assaulted.assault && assaulted.assault.status === "active", "assault active");

const { ASSAULT_WINDOW_MS } = require("../db/clan-war");
const resolved = store.clanResolveAssault(rival, {
  territoryId: "abandoned_camp",
  now: unlockedAt + 2 + ASSAULT_WINDOW_MS + 1000,
});
assert(resolved.ok, "assault resolve: " + (resolved.message || resolved.error));
assert(!resolved.attackerWins, "weak rival loses assault");
const holders2 = store.clanListTerritories({ skipResolve: true }).holders;
assert(
  holders2.some((h) => h.territoryId === "abandoned_camp" && h.clanId === created.clan.id),
  "holder kept after failed assault"
);

console.log("clan-warehouse: ok");
