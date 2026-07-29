#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { createStore } = require("../db");
const { clanBossHpHits, CLAN_BOSS } = require("../db/clan-boss");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-clan-boss-"));
const store = createStore({ dataDir: tmpDir, dbPath: path.join(tmpDir, "test.db") });

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

assert(clanBossHpHits(1) === 1_000_000, "hp1");
assert(clanBossHpHits(3) === 1_000_000, "hp3 flat");
assert(CLAN_BOSS.weeklyClears === 0, "no weekly lock");

const now = Date.now();
const u = store.insertUser("BossLead", bcrypt.hashSync("pass1234", 4), now);
const lead = { id: u.id, nick: "BossLead" };
store.persistPlayerSave(lead, 1, now, "0.58", {
  activeCharacterId: "c1",
  characters: [
    {
      id: "c1",
      progress: {
        adena: 0,
        materials: { soul: 0, spirit: 0, oath_symbol: 0 },
        avatar: { created: true, name: "B", level: 10 },
        inventory: [],
        totals: {},
      },
    },
  ],
  adena: 0,
  materials: { soul: 0, spirit: 0, oath_symbol: 0 },
});
assert(store.chatCreateClan(lead, { name: "BossClan", now: now + 1 }).ok, "clan");

const start = store.clanBossStart(lead, { now: now + 2 });
assert(start.ok && start.run && start.run.status === "active", "start");
assert(start.run.hp === 1_000_000 && start.run.maxHp === 1_000_000, "full 1m hp");

const st0 = store.clanBossState(lead, { now: now + 3 });
assert(st0.locked === false, "unlocked");

// Урон, выход, возврат — HP не сбрасывается (рейд клана живёт).
const hitPartial = store.clanBossHit(lead, { dmg: 50000, now: now + 4 });
assert(hitPartial.ok && hitPartial.run.hp === 950000, "partial hp " + hitPartial.run.hp);
const left = store.clanBossLeave(lead, { now: now + 5 });
assert(left.ok, "leave");
const afterLeave = store.clanBossState(lead, { now: now + 6 });
assert(afterLeave.run && afterLeave.run.status === "active", "run still active after leave");
assert(afterLeave.run.hp === 950000, "hp preserved " + afterLeave.run.hp);
assert(afterLeave.run.inRun === false, "not in run after leave");
const rejoined = store.clanBossStart(lead, { now: now + 7 });
assert(rejoined.ok && rejoined.run.inRun === true, "rejoin via start");
assert(rejoined.run.hp === 950000, "hp after rejoin " + rejoined.run.hp);

let cleared = false;
for (let i = 0; i < 40; i++) {
  const hit = store.clanBossHit(lead, { dmg: 50000, now: now + 10 + i * 200 });
  assert(hit.ok, "hit " + i);
  if (hit.run && hit.run.status === "cleared") {
    assert(hit.run.reward && hit.run.reward.warehouseAdena === 250000, "reward adena");
    assert(hit.run.reward.raidMarksEach === 50, "reward marks each");
    assert(hit.myOathSymbols === 50 || hit.myRaidMarks === 50, "leader got symbols");
    const save = store.getSave(lead.id);
    const data = JSON.parse(save.payload);
    assert(
      data.characters[0].progress.materials.oath_symbol === 50,
      "inventory symbols " + data.characters[0].progress.materials.oath_symbol
    );
    cleared = true;
    break;
  }
}
assert(cleared, "must clear with big hits");

const again = store.clanBossStart(lead, { now: now + 999999 });
assert(again.ok && again.run && again.run.status === "active", "restart without lockout");

const wh = store.clanGetWarehouse(lead, { now: now + 1000000 });
assert(wh.ok && wh.adena >= 250000, "warehouse got reward " + wh.adena);

const stMarks = store.clanBossState(lead, { now: now + 1000001 });
assert(stMarks.myOathSymbols === 50 || stMarks.myRaidMarks === 50, "symbols persist in state");

console.log("clan-boss: ok");
