// ===== Unit: opened hunting zones ≤40 =====
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadScripts } = require("./setup");

loadScripts([
  "src/data/farm-zones-balance.js",
  "src/data/economy-balance.js",
  "src/avatar-math.js",
]);

const storyPath = path.join(__dirname, "..", "src", "data", "json", "story-zones.json");
const data = JSON.parse(fs.readFileSync(storyPath, "utf8"));
const sides = (data.FARM_ZONES || []).filter((z) => z.side && !z.party);
const storyZones = (data.FARM_ZONES || []).filter((z) => !z.side);

const EXPECTED = [
  "windmill_hill",
  "fellmere_harvesting",
  "neutral_zone",
  "langk_lizardman",
  "maille_lizardman",
  "ruins_despair",
  "evil_hunting_grounds",
  "orc_barracks_hunt",
  "dion_hills",
  "bee_hive",
  "plains_of_dion",
  "partisans_hideaway",
  "floran_agricultural",
  "cruma_marshlands",
  "ant_nest",
  "cruma_tower_entrance",
  "school_of_dark_arts",
  "elven_ruins_hunt",
  "death_pass",
  "gorgon_flower_garden",
  "breka_stronghold",
  "dragon_valley_entrance",
  "enchanted_valley",
  "sea_of_spores",
  "alligator_island",
  "blazing_swamp",
];

for (const id of EXPECTED) {
  const z = sides.find((x) => x.id === id);
  assert.ok(z, "missing side farm " + id);
  assert.strictEqual(z.active, true, id + " not active");
  assert.ok(z.reqLevel >= 1, id + " reqLevel");
  assert.ok(typeof z.reqPower === "number", id + " reqPower");
  assert.ok(z.raceSkin && z.raceSkin.human, id + " raceSkin");
}

assert.ok(sides.length >= 32, "expected ≥32 side farms, got " + sides.length);
assert.strictEqual(resolveFarmZoneId("scrap_field"), "wasteland");

assert.strictEqual(farmZoneProgressChapter({ chapter: 3 }), 3, "story uses chapter");
assert.strictEqual(farmZoneProgressChapter({ side: true, lvlMin: 1, lvlMax: 15 }), 1, "L2≤20 → ch1");
assert.strictEqual(farmZoneProgressChapter({ side: true, lvlMin: 20, lvlMax: 30 }), 2, "L2 20–30 → ch2");
assert.strictEqual(farmZoneProgressChapter({ side: true, lvlMin: 30, lvlMax: 40 }), 3, "L2 30–40 → ch3");
assert.strictEqual(farmZoneProgressChapter({ side: true, lvlMin: 40, lvlMax: 50 }), 5, "L2 40+ → ch5");

global.state = { avatar: { level: 10 }, farmZone: "race_outskirts" };
global.farmZoneById = (id) =>
  sides.find((z) => z.id === id) || storyZones.find((z) => z.id === id) || { id, chapter: 1 };

const low = mineProgressAdenaScale("race_outskirts");
const mid = mineProgressAdenaScale("floran_agricultural");
const high = mineProgressAdenaScale("blazing_swamp");
assert.ok(mid > low * 1.5, "floran adena > outskirts (" + mid + " vs " + low + ")");
assert.ok(high > mid * 1.4, "blazing adena > floran (" + high + " vs " + mid + ")");

const dark = storyZones.find((z) => z.id === "dark_cavern");
const dwarf = storyZones.find((z) => z.id === "dwarven_depths");
assert.strictEqual(dark.reqLevel, 8, "ch IV gate lvl8");
assert.strictEqual(dwarf.reqLevel, 10, "ch V gate lvl10");

const armorZones = sides.filter((z) => (z.lootTags || []).some((t) => t.startsWith("armor_")));
const jewZones = sides.filter((z) => (z.lootTags || []).some((t) => t.startsWith("jewelry_")));
assert.ok(armorZones.length >= 18, "armor tags on many hunt zones, got " + armorZones.length);
assert.ok(jewZones.length >= 10, "jewelry tags on many hunt zones, got " + jewZones.length);

// Story: only D weapons
assert.deepStrictEqual(mineDropWeights("banana_mine"), { D: 100, C: 0, B: 0, A: 0 });
assert.deepStrictEqual(mineDropWeights("dwarven_depths"), { D: 100, C: 0, B: 0, A: 0 });

// L2 loot bands: ≤20/20–30 = D, 30–40/40+ = C
assert.strictEqual(farmZoneLootBand(sides.find((z) => z.id === "school_of_dark_arts")), "d20");
assert.strictEqual(farmZoneLootBand(sides.find((z) => z.id === "langk_lizardman")), "d30");
assert.strictEqual(farmZoneLootBand(sides.find((z) => z.id === "floran_agricultural")), "c40");
assert.strictEqual(farmZoneLootBand(sides.find((z) => z.id === "blazing_swamp")), "c40p");
assert.strictEqual(farmZoneLootGrade(sides.find((z) => z.id === "wasteland")), "D");
assert.strictEqual(farmZoneLootGrade(sides.find((z) => z.id === "abandoned_coal_low")), "D");
assert.strictEqual(farmZoneLootBand(sides.find((z) => z.id === "abandoned_coal_low")), "d20");
assert.deepStrictEqual(mineDropWeights("wasteland"), { D: 100, C: 0, B: 0, A: 0 });
assert.deepStrictEqual(mineDropWeights("abandoned_coal_low"), { D: 100, C: 0, B: 0, A: 0 });
assert.deepStrictEqual(mineDropWeights("floran_agricultural"), { D: 0, C: 100, B: 0, A: 0 });
assert.ok(mineDropWeights("floran_agricultural").C === 100);
assert.strictEqual(mineDropWeights("blazing_swamp").B, 0);
assert.strictEqual(mineDropWeights("blazing_swamp").A, 0);
assert.strictEqual(mineDropWeights("blazing_swamp").D, 0);

// P0: бой охоты эскалирует от банды, не zone.chapter(=1)
assert.strictEqual(mineCombatProgressChapter(sides.find((z) => z.id === "race_outskirts")), 1);
assert.strictEqual(mineCombatProgressChapter(sides.find((z) => z.id === "langk_lizardman")), 2);
assert.strictEqual(mineCombatProgressChapter(sides.find((z) => z.id === "floran_agricultural")), 3);
assert.strictEqual(mineCombatProgressChapter(sides.find((z) => z.id === "blazing_swamp")), 5);
assert.strictEqual(mineHitsToKill("normal", "race_outskirts"), 7);
assert.strictEqual(mineHitsToKill("normal", "blazing_swamp"), 11);
assert.ok(
  mineZoneRefClickDamage("blazing_swamp") > mineZoneRefClickDamage("race_outskirts"),
  "c40p ref dmg > d20"
);

// SF 20 не входит в L2 30–40 / 40+
const openAt20 = sides.filter((z) => z.reqLevel <= 20);
assert.ok(openAt20.every((z) => ((z.lvlMin || 0) + (z.lvlMax || 0)) / 2 < 30));
assert.ok(sides.find((z) => z.id === "floran_agricultural").reqLevel >= 22);
assert.ok(sides.find((z) => z.id === "dragon_valley_entrance").reqLevel >= 30);
assert.ok(sides.find((z) => z.id === "blazing_swamp").reqLevel >= 34);

console.log("hunting-zones-open: ok (" + EXPECTED.length + " opened live)");
