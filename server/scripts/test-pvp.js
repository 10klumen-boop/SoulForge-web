"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const assert = require("assert");
const { createSqliteStore } = require("../db/sqlite");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-pvp-"));
const store = createSqliteStore({ dataDir: tmpDir, dbPath: path.join(tmpDir, "t.db") });

function makeSheet(name, classId) {
  return {
    name,
    level: 12,
    raceId: "human",
    classId,
    atkType: classId === "mystic" ? "magical" : "physical",
    patk: classId === "mystic" ? 30 : 90,
    matk: classId === "mystic" ? 95 : 25,
    pdef: 50,
    mdef: 45,
    hpMax: 500,
    shotArmed: false,
    skills: [],
  };
}

function makeSave(name, slot) {
  slot = slot || "c1";
  return {
    activeCharacterId: slot,
    characters: [
      {
        id: slot,
        progress: {
          avatar: { created: true, name, level: 12, raceId: "human", classId: "fighter", gear: {} },
          adena: 1000,
          inventory: [],
          crystals: { D: 0, C: 0, B: 0, A: 0 },
          materials: { soul: 0, spirit: 0 },
          shots: { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } },
          totals: { tries: 0, fails: 0, earned: 0 },
        },
      },
    ],
  };
}

const now = Date.now();
const alice = { id: store.insertUser("AlicePvp", "hashhashhash", now).id, nick: "AlicePvp" };
const bob = { id: store.insertUser("BobPvpxx", "hashhashhash", now + 1).id, nick: "BobPvpxx" };

store.persistPlayerSave(alice, 1, now, "0.46", makeSave("HeroAlice"));
store.persistPlayerSave(bob, 1, now, "0.46", makeSave("HeroBob"));

const sheetA = makeSheet("HeroAlice", "fighter");
const sheetB = makeSheet("HeroBob", "mystic");

let r = store.pvpPublishSheet(alice, { characterId: "c1", sheet: sheetA }, now);
assert.ok(r.ok, r.error);

r = store.pvpPublishSheet(bob, { characterId: "c1", sheet: sheetB }, now + 1);
assert.ok(r.ok, r.error);

r = store.pvpLookupSheet("HeroBob");
assert.ok(r.ok, r.error);

r = store.pvpChallenge(alice, { characterId: "c1", toName: "HeroBob", sheet: sheetA }, now + 2);
assert.ok(r.ok, r.error);
const challengeId = r.challenge.id;

r = store.pvpRespondChallenge(
  bob,
  challengeId,
  { characterId: "c1", accept: true, sheet: sheetB },
  now + 4
);
assert.ok(r.ok, r.error);
const matchId = r.matchId;

r = store.pvpMatchAction(alice, matchId, { characterId: "c1", action: { type: "attack" } }, now + 5);
assert.ok(r.ok, r.error);

r = store.pvpMatchAction(bob, matchId, { characterId: "c1", action: { type: "guard" } }, now + 6);
assert.ok(r.ok, r.error);
assert.ok(r.match.round >= 1);

r = store.pvpAsyncAttack(alice, { characterId: "c1", toName: "HeroBob", sheet: sheetA }, now + 10);
assert.ok(r.ok, r.error);

r = store.pvpAsyncInbox(bob, { characterId: "c1" });
assert.ok(r.ok && r.rows.length >= 1);

console.log("pvp server tests ok");
try {
  if (typeof store.close === "function") store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (_) {}
