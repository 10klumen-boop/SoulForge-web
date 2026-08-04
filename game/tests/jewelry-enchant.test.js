// ===== Unit: jewelry enchant uses armor scrolls, cap +12 =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [];
global.WMAP = {};
global.toast = () => {};
global.save = () => {};
global.tune = (_k, fb) => fb;
global.MAX_PLUS = 16;
global.DESTRUCTION_MAX_PLUS = 15;
global.ARMOR_MAX_PLUS = 12;
global.JEWELRY_MAX_PLUS = 12;
global.GRADE_BASE_PRICE = { D: 50000, C: 280000, B: 1100000, A: 4500000 };
global.SCROLL_TIER = { regular: 1, blessed: 2, destruction: 3, crystal: 4 };
global.SCROLL_TYPES = [
  {
    id: "regular",
    name: "W",
    nameArmor: "Armor scroll",
    mult: 1,
    behavior: "break",
    desc: "x",
    descArmor: "armor/jew fail",
  },
  { id: "blessed", name: "Wb", nameArmor: "Ab", mult: 4, behavior: "reset", desc: "x" },
  { id: "destruction", name: "Wd", nameArmor: "Ad", mult: 30, behavior: "destruction", desc: "x" },
  { id: "crystal", name: "Wc", nameArmor: "Ac", mult: 150, behavior: "guarantee", desc: "x" },
];
global.scrollTierIcon = (t, g, target) => "icons/" + (target || "w") + "_" + t + "_" + g + ".png";

loadScripts(["src/progress-store.js", "src/data/scroll-drop-balance.js", "src/scroll-core.js", "src/06-rules.js"]);

global.accessoryDef = (it) =>
  it && it.id === "jew_d"
    ? { id: "jew_d", name: "Elven Necklace", grade: "D", setId: "elven", epic: false, mdef: 5, bonuses: { mdef: 5 } }
    : it && it.id === "epic_z"
      ? { id: "epic_z", name: "Zaken", epic: true, bonuses: { mdef: 2 } }
      : null;
function jewelryCanEnchant(itemOrDef) {
  let def = itemOrDef;
  if (def && (def.uid || (def.id && !def.name))) def = accessoryDef(def);
  if (!def || def.epic) return false;
  return !!(def.grade && def.grade !== "NG");
}
function jewelryEnchantMdefBonus(plus) {
  return Math.max(0, plus | 0);
}
global.jewelryCanEnchant = jewelryCanEnchant;
global.jewelryEnchantMdefBonus = jewelryEnchantMdefBonus;

global.state = {
  scrolls: emptyScrollsState(),
  characters: [{ id: "c1", progress: {} }],
  activeCharacterId: "c1",
};

assert.ok(!state.scrolls.jewelry, "no separate jewelry stack");
assert.ok(state.scrolls.armor);

// jewelry alias → armor
assert.strictEqual(normalizeScrollTarget("jewelry"), "armor");
assert.strictEqual(normalizeScrollTarget("accessory"), "armor");
assert.ok(addScroll("jewelry", "regular", "D", 5));
assert.strictEqual(scrollQty("armor", "regular", "D"), 5);
assert.ok(consumeScroll("armor", "regular", "D", 2));
assert.strictEqual(scrollQty("armor", "regular", "D"), 3);

const def = scrollDef("armor", "D", "regular");
assert.strictEqual(def.target, "armor");
assert.strictEqual(def.name, "Armor scroll");
assert.strictEqual(def.desc, "armor/jew fail");

// migrate leftover jewelry bucket into armor
ProgressStore.set("scrolls", {
  weapon: emptyScrollTypeMap(),
  armor: emptyScrollTypeMap(),
  jewelry: { regular: { D: 4, C: 0, B: 0, A: 0 }, blessed: emptyScrollGradeMap(), destruction: emptyScrollGradeMap(), crystal: emptyScrollGradeMap() },
});
ensureScrollsState();
assert.ok(!state.scrolls.jewelry);
assert.strictEqual(scrollQty("armor", "regular", "D"), 4);

assert.strictEqual(enchantItemCapPlus("accessory", "regular"), 12);
assert.strictEqual(enchantItemCapPlus("accessory", "destruction"), 12);
assert.strictEqual(enchantItemCapPlus("armor", "regular"), 12);
assert.strictEqual(enchantItemCapPlus("armor", "crystal"), 12);
assert.strictEqual(enchantItemCapPlus("armor", "destruction"), 12);
assert.strictEqual(enchantItemCapPlus("weapon", "destruction"), 15);
assert.strictEqual(enchantItemCapPlus("weapon", "regular"), 16);

assert.ok(jewelryCanEnchant({ id: "jew_d" }));
assert.ok(!jewelryCanEnchant({ id: "epic_z" }));
assert.ok(!SCROLL_DROP_TARGET_WEIGHTS.jewelry);
assert.ok(SCROLL_DROP_TARGET_WEIGHTS.armor > 0);

console.log("jewelry-enchant.test.js OK");
