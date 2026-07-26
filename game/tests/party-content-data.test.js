// ===== Unit: party balance formulas + world boss data =====
const path = require("path");
const assert = require("assert");

const {
  partyAdenaMult,
  partyHitIntervalMs,
  partyFarmMobMaxHp,
  partyInstanceMobMaxHp,
  partyUtcDayKey,
  partyUtcWeekKey,
  partyFarmZoneById,
  partyDungeonById,
  PARTY_CONTENT,
  PARTY_FARM_ZONES,
  PARTY_DUNGEONS,
  WORLD_BOSS,
} = require(path.join(__dirname, "..", "src", "data", "party-content-data.js"));

assert.strictEqual(partyAdenaMult(1), 1);
assert.ok(Math.abs(partyAdenaMult(2) - 1.08) < 1e-9);
assert.ok(Math.abs(partyAdenaMult(4) - 1.24) < 1e-9);
assert.strictEqual(partyAdenaMult(9), partyAdenaMult(4)); // cap
assert.strictEqual(partyHitIntervalMs(), 150);

assert.strictEqual(PARTY_FARM_ZONES.length, 0, "party farm zones removed");
assert.strictEqual(partyFarmZoneById("party_raiders_trail"), null);

const dungeon = partyDungeonById("dungeon_alpha");
assert.ok(dungeon);
const hp1 = partyInstanceMobMaxHp(dungeon.boss, dungeon, 2, [100, 100]);
const hp2 = partyInstanceMobMaxHp(dungeon.boss, dungeon, 4, [100, 100, 100, 100]);
assert.ok(hp2 > hp1);

assert.ok(PARTY_DUNGEONS.length >= 2);
assert.ok(PARTY_DUNGEONS[0].waves.length >= 5, "5 waves");
assert.ok((PARTY_DUNGEONS[0].waves[0].count || 1) >= 2, "multi-mob waves");
assert.ok(PARTY_DUNGEONS[0].loot.weaponGrade);
assert.ok(PARTY_DUNGEONS[0].loot.xp);
assert.strictEqual(PARTY_CONTENT.maxMembers, 4);
assert.ok(partyUtcDayKey(Date.UTC(2026, 6, 26)).includes("2026"));
assert.ok(/^20\d{2}-W\d{2}$/.test(partyUtcWeekKey(Date.now())));

assert.ok(WORLD_BOSS && WORLD_BOSS.id);
assert.strictEqual(WORLD_BOSS.id, "world_zaken");
assert.strictEqual(WORLD_BOSS.windowMs, 5 * 60 * 1000);
assert.strictEqual(WORLD_BOSS.cooldownMs, 55 * 60 * 1000);
assert.strictEqual(WORLD_BOSS.cosmeticHp, 10_000_000);
assert.ok(WORLD_BOSS.loot && WORLD_BOSS.loot.places && WORLD_BOSS.loot.places[1].accessoryId);

// formulas still work with a stub zone shape
const stubZone = { farmHpHits: null };
assert.ok(partyFarmMobMaxHp("normal", stubZone, 2) >= 1);

console.log("party-content-data.test.js OK");
