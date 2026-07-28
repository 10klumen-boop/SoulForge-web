// ===== Unit: заточка на свитках + crystalYield брони с plus =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [];
global.WMAP = {};
global.AMAP = {
  bone_helmet: {
    id: "bone_helmet",
    name: "Bone Helmet",
    grade: "D",
    slot: "helmet",
    pdef: 5,
    mdef: 2,
    cc: 56,
    icon: "a.png",
  },
};
global.CRYSTAL_PLUS_MULT = 1.08;
global.CRYSTAL_VALUE = { D: 50, C: 150, B: 400, A: 900 };
global.GRADE_BASE_PRICE = { D: 50000, C: 280000 };
global.SCROLL_TIER = { regular: 1, blessed: 2, destruction: 3, crystal: 4 };
global.SCROLL_TYPES = [
  { id: "regular", name: "Reg", nameArmor: "RegA", mult: 1, behavior: "break", desc: "b" },
  { id: "blessed", name: "Bl", nameArmor: "BlA", mult: 4, behavior: "reset", desc: "r" },
  { id: "destruction", name: "De", nameArmor: "DeA", mult: 30, behavior: "destruction", desc: "d" },
  { id: "crystal", name: "Cr", nameArmor: "CrA", mult: 150, behavior: "guarantee", desc: "g" },
];
global.scrollTierIcon = (t, g) => t + "_" + g + ".png";
global.toast = () => {};
global.save = () => {};
global.tune = (_k, fb) => fb;
global.playtestIncome = (n) => n;

loadScripts([
  "src/progress-store.js",
  "src/data/scroll-drop-balance.js",
  "src/scroll-core.js",
  "src/06-rules.js",
]);

global.state = {
  adena: 999999,
  scrolls: emptyScrollsState(),
  crystals: { D: 0, C: 0, B: 0, A: 0 },
  characters: [{ id: "c1", progress: {} }],
  activeCharacterId: "c1",
};

addScroll("weapon", "regular", "D", 5);
const adena0 = state.adena;
assert.ok(hasScroll("weapon", "regular", "D", 1));
assert.ok(consumeScroll("weapon", "regular", "D", 1));
assert.strictEqual(scrollQty("weapon", "regular", "D"), 4);
assert.strictEqual(state.adena, adena0, "enchant path does not spend adena via consumeScroll");

const y0 = crystalYield(AMAP.bone_helmet, 0);
const y4 = crystalYield(AMAP.bone_helmet, 4);
assert.strictEqual(y0, 56);
assert.ok(y4 > y0, "armor plus increases crystal yield");

addScroll("armor", "blessed", "C", 2);
assert.ok(consumeScroll("armor", "blessed", "C", 2));
assert.strictEqual(scrollQty("armor", "blessed", "C"), 0);

const stacks = listScrollStacks();
assert.ok(stacks.some((s) => s.target === "weapon" && s.typeId === "regular"));

console.log("enchant-scrolls.test.js OK");
