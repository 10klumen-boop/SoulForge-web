// ===== Unit: свитки — add/consume + roll grade =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [];
global.WMAP = {};
global.toast = () => {};
global.save = () => {};
global.tune = (_k, fb) => fb;
global.GRADE_BASE_PRICE = { D: 50000, C: 280000, B: 1100000, A: 4500000 };
global.SCROLL_TIER = { regular: 1, blessed: 2, destruction: 3, crystal: 4 };
global.SCROLL_TYPES = [
  { id: "regular", name: "Свиток заточки", nameArmor: "Свиток брони", mult: 1, behavior: "break", desc: "x" },
  { id: "blessed", name: "Blessed", nameArmor: "Blessed armor", mult: 4, behavior: "reset", desc: "x" },
  { id: "destruction", name: "Dest", nameArmor: "Dest a", mult: 30, behavior: "destruction", desc: "x" },
  { id: "crystal", name: "Crystal", nameArmor: "Crystal a", mult: 150, behavior: "guarantee", desc: "x" },
];
global.scrollTierIcon = (t, g, target) => "icons/scrolls/" + (target || "w") + "_" + t + "_" + g + ".png";
global.FARM_ZONES = [
  { id: "banana_mine", chapter: 1 },
  { id: "wasteland", chapter: 1, side: true, lootTags: ["armor_d", "jewelry_d", "scroll_d"] },
  { id: "abandoned_coal_low", chapter: 1, side: true, lootTags: ["armor_d", "scroll_d"] },
  { id: "floran_agricultural", chapter: 1, side: true, reqLevel: 10, lootTags: ["scroll_d", "scroll_c"] },
  { id: "blazing_swamp", chapter: 1, side: true, reqLevel: 22, lootTags: ["scroll_c"] },
];

loadScripts([
  "src/progress-store.js",
  "src/data/scroll-drop-balance.js",
  "src/scroll-core.js",
]);

global.state = {
  scrolls: emptyScrollsState(),
  characters: [{ id: "c1", progress: {} }],
  activeCharacterId: "c1",
};

assert.ok(addScroll("weapon", "regular", "D", 3));
assert.strictEqual(scrollQty("weapon", "regular", "D"), 3);
assert.ok(hasScroll("weapon", "regular", "D", 2));
assert.ok(consumeScroll("weapon", "regular", "D", 2));
assert.strictEqual(scrollQty("weapon", "regular", "D"), 1);
assert.ok(!consumeScroll("weapon", "regular", "D", 5));

assert.strictEqual(scrollDropGradeForZone("wasteland"), "D");
assert.strictEqual(scrollDropGradeForZone("abandoned_coal_low"), "D");
assert.strictEqual(scrollDropGradeForZone("banana_mine"), "D");
assert.strictEqual(scrollDropGradeForZone("floran_agricultural"), "C", "lootTags scroll_c wins over chapter:1");
assert.strictEqual(scrollDropGradeForZone("blazing_swamp"), "C", "lootTags scroll_c");

const def = scrollDef("armor", "C", "blessed");
assert.strictEqual(def.target, "armor");
assert.strictEqual(def.behavior, "reset");
assert.ok(def.estimate > 0);
assert.strictEqual(def.cost, 0);

// Forced drop roll
const origRandom = Math.random;
Math.random = () => 0; // always pass chance + first weighted
const drop = rollScrollDrop("wasteland", "boss");
Math.random = origRandom;
assert.ok(drop, "boss drop");
assert.strictEqual(drop.grade, "D");
assert.ok(drop.target === "weapon" || drop.target === "armor");

console.log("scroll-core.test.js OK");
