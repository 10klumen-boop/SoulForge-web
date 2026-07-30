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
  WORLD_BOSSES,
  worldBossById,
  worldBossForParity,
  worldBossParityForHour,
  worldBossNextStartMs,
  worldBossHourStartMs,
  worldBossUpcoming,
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

assert.ok(PARTY_DUNGEONS.length >= 4);
assert.ok(PARTY_DUNGEONS[0].waves.length >= 5, "5 waves");
assert.ok((PARTY_DUNGEONS[0].waves[0].count || 1) >= 2, "multi-mob waves");
assert.ok(PARTY_DUNGEONS[0].loot.weaponGrade);
assert.ok(PARTY_DUNGEONS[0].loot.xp);

const catacomb = partyDungeonById("dungeon_catacomb");
assert.ok(catacomb, "catacomb dungeon");
assert.strictEqual(catacomb.reqLevel, 20);
assert.ok(catacomb.boss.phases.some((p) => p.mechanic === "adds"), "adds mechanic");
assert.strictEqual(catacomb.loot.weaponGrade, "D");
assert.ok(catacomb.loot.armorSetPool.includes("mithril"));

const spire = partyDungeonById("dungeon_spire");
assert.ok(spire, "spire dungeon");
assert.strictEqual(spire.reqLevel, 35);
assert.ok(spire.boss.phases.some((p) => p.mechanic === "channel"), "channel mechanic");
assert.ok(spire.loot.armorSetPool.includes("full_plate"));

assert.strictEqual(partyDungeonById("dungeon_alpha").reqLevel, 15);
assert.strictEqual(partyDungeonById("dungeon_depths").reqLevel, 30);
assert.ok(PARTY_DUNGEONS[0].id === "dungeon_alpha");
assert.ok(PARTY_DUNGEONS[1].id === "dungeon_catacomb");
assert.ok(PARTY_DUNGEONS[2].id === "dungeon_depths");
assert.ok(PARTY_DUNGEONS[3].id === "dungeon_spire");

assert.strictEqual(PARTY_CONTENT.maxMembers, 4);
assert.ok(partyUtcDayKey(Date.UTC(2026, 6, 26)).includes("2026"));
assert.ok(/^20\d{2}-W\d{2}$/.test(partyUtcWeekKey(Date.now())));

assert.ok(WORLD_BOSS && WORLD_BOSS.id);
assert.strictEqual(WORLD_BOSS.id, "world_zaken");
assert.strictEqual(WORLD_BOSS.windowMs, 5 * 60 * 1000);
assert.strictEqual(WORLD_BOSS.cosmeticHp, 10_000_000);
assert.ok(WORLD_BOSS.loot && WORLD_BOSS.loot.places && WORLD_BOSS.loot.places[1].accessoryId);

assert.ok(Array.isArray(WORLD_BOSSES) && WORLD_BOSSES.length >= 2);
assert.strictEqual(worldBossById("world_queen_ant")?.name, "Королева Муравьёв");
assert.strictEqual(worldBossForParity("even").id, "world_queen_ant");
assert.strictEqual(worldBossForParity("odd").id, "world_zaken");
assert.strictEqual(worldBossParityForHour(0), "even");
assert.strictEqual(worldBossParityForHour(1), "odd");
assert.ok(WORLD_BOSSES.find((b) => b.id === "world_queen_ant").loot.places[1].accessoryId === "queen_ant_ring");
assert.ok(typeof worldBossNextStartMs === "function");
assert.ok(typeof worldBossHourStartMs === "function");
assert.ok(worldBossNextStartMs("world_zaken", Date.now()) > Date.now() - 60 * 1000);

// Чётный час МСК → Queen Ant (окно 0–5 мин).
{
  const evenHour = Date.UTC(2026, 6, 30, 10, 1, 0) - 3 * 60 * 60 * 1000; // 10:01 МСК
  const up = worldBossUpcoming(evenHour);
  assert.strictEqual(up.status, "active");
  assert.strictEqual(up.boss.id, "world_queen_ant");
}
{
  const evenPast = Date.UTC(2026, 6, 30, 10, 30, 0) - 3 * 60 * 60 * 1000; // 10:30 МСК
  const up = worldBossUpcoming(evenPast);
  assert.strictEqual(up.status, "upcoming");
  assert.strictEqual(up.boss.id, "world_zaken");
}
{
  const oddHour = Date.UTC(2026, 6, 30, 11, 1, 0) - 3 * 60 * 60 * 1000; // 11:01 МСК
  const up = worldBossUpcoming(oddHour);
  assert.strictEqual(up.status, "active");
  assert.strictEqual(up.boss.id, "world_zaken");
}

// formulas still work with a stub zone shape
const stubZone = { farmHpHits: null };
assert.ok(partyFarmMobMaxHp("normal", stubZone, 2) >= 1);

console.log("party-content-data.test.js OK");
