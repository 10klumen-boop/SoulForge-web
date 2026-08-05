// ===== Rare craft + set-material migration =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [];
global.WMAP = {};
global.INV_CAP = 64;
global.uid = () => "uid-" + Math.random().toString(16).slice(2);
global.toast = () => {};
global.save = () => {};
global.renderMenu = () => {};
global.renderWorkshop = () => {};
global.renderInventory = () => {};
global.checkAchievements = () => {};
global.logCharacterEvent = () => {};
global.Audio2 = { success: () => {} };
global.$ = () => null;
global.fmt = (n) => String(n);
global.isInventoryFull = () => false;
global.ensureWorkshopState = () => {
  if (!state.materials) state.materials = { soul: 0, spirit: 0 };
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
};
global.iterEquippedGear = () => {
  const g = state.avatar?.gear || {};
  return Object.keys(g)
    .filter((k) => g[k])
    .map((slot) => ({ slot, item: g[slot] }));
};
global.isArmorItem = (it) => it && it.kind === "armor";
global.isAccessoryItem = (it) => it && it.kind === "accessory";
global.armorItemDef = (it) => (typeof AMAP !== "undefined" ? AMAP[it.id] : null);
global.armorPiecePowerMult = () => 1;
global.armorEnchantPdefBonus = (p) => (p || 0) * 2;
global.armorEnchantMdefBonus = (p) => p || 0;
global.defaultAvatarGear = () => ({
  weapon: null,
  helmet: null,
  chest: null,
  legs: null,
  gloves: null,
  boots: null,
  earring_l: null,
  earring_r: null,
  necklace: null,
  ring_l: null,
  ring_r: null,
});

loadScripts([
  "src/progress-store.js",
  "src/data/enchant-balance.js",
  "src/data/armor-sets-data.js",
  "src/data/jewelry-sets-data.js",
  "src/data/craft-quality-balance.js",
  "src/armor-sets-core.js",
  "src/jewelry-sets-core.js",
  "src/09-inventory.js",
  "src/workshop-core.js",
]);

global.state = {
  adena: 100000,
  crystals: { D: 50, C: 20, B: 0, A: 0 },
  materials: { soul: 100, spirit: 0 },
  inventory: [],
  avatar: { created: true, level: 20, gear: defaultAvatarGear() },
  characters: [{ id: "c1", progress: {} }],
  activeCharacterId: "c1",
};

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    console.error("  ✗ " + name);
    console.error("    " + e.message);
  }
}

console.log("\n--- craft quality / set materials ---");

test("formatCraftOpt labels", () => {
  assert.ok(formatCraftOpt({ key: "pdef", value: 6 }).includes("P.Def"));
  assert.ok(formatCraftOpt({ key: "skillCdMult", value: 0.99 }).includes("КД"));
});

test("rollCraftOpt common when rng high", () => {
  let i = 0;
  const rng = () => {
    i++;
    return 0.99; // miss rare chance
  };
  assert.strictEqual(rollCraftOpt("armor", rng), null);
});

test("rollCraftOpt rare returns craftOpt", () => {
  const seq = [0.001, 0.1, 0.5]; // hit rare (0.5%), pick first-ish, mid value
  let i = 0;
  const rng = () => seq[Math.min(i++, seq.length - 1)];
  const opt = rollCraftOpt("armor", rng);
  assert.ok(opt);
  assert.strictEqual(opt.rarity, "rare");
  assert.ok(["pdef", "mdef", "pvpHp", "armorSustain"].indexOf(opt.key) >= 0);
});

test("CRAFT_RARE_CHANCE is 0.5%", () => {
  assert.ok(Math.abs(CRAFT_RARE_CHANCE - 0.005) < 1e-9);
});

test("migrateArmorSetMaterials merges legacy pieces", () => {
  state.materials = {
    soul: 1,
    spirit: 0,
    bone_helmet_piece: 3,
    bone_boots_piece: 5,
    mithril_breastplate_piece: 2,
  };
  migrateArmorSetMaterials();
  assert.strictEqual(state.materials.bone_material, 8);
  assert.strictEqual(state.materials.mithril_material, 2);
  assert.strictEqual(state.materials.bone_helmet_piece, undefined);
});

test("migrateJewelrySetPieces merges legacy shards", () => {
  state.inventory = [
    { uid: "a", id: "elven_necklace_piece", kind: "shard", qty: 4 },
    { uid: "b", id: "elven_ring_piece", kind: "shard", qty: 2 },
    { uid: "c", id: "zaken_earring_shard", kind: "shard", qty: 1 },
  ];
  migrateJewelrySetPieces();
  const elven = state.inventory.find((it) => it.id === "elven_piece" && it.kind === "shard");
  assert.ok(elven);
  assert.strictEqual(elven.qty, 6);
  assert.ok(state.inventory.some((it) => it.id === "zaken_earring_shard"));
  assert.ok(!state.inventory.some((it) => it.id === "elven_necklace_piece"));
});

test("craftArmor can attach craftOpt", () => {
  state.inventory = [];
  state.materials = { soul: 50, spirit: 0, bone_material: 20 };
  state.crystals = { D: 10, C: 0, B: 0, A: 0 };
  state.adena = 50000;
  const orig = Math.random;
  // Force rare: first roll chance, then weight, then value
  const seq = [0.001, 0.0, 0.5];
  let i = 0;
  Math.random = () => seq[Math.min(i++, seq.length - 1)];
  try {
    const it = craftArmor("bone_boots");
    assert.ok(it);
    assert.ok(it.craftOpt);
    assert.strictEqual(it.craftOpt.rarity, "rare");
  } finally {
    Math.random = orig;
  }
});

test("avatarArmorDefBonuses includes craftOpt pdef", () => {
  state.avatar.gear = defaultAvatarGear();
  state.avatar.gear.boots = {
    uid: "b1",
    id: "bone_boots",
    kind: "armor",
    craftOpt: { key: "pdef", value: 8, rarity: "rare" },
  };
  const def = avatarArmorDefBonuses();
  const bare = AMAP.bone_boots.pdef;
  assert.ok(def.pdef >= bare + 8, "got " + def.pdef + " expected >=" + (bare + 8));
});

test("sumEquippedCraftOpt jewelry skillCd", () => {
  state.avatar.gear = defaultAvatarGear();
  state.avatar.gear.necklace = {
    uid: "n1",
    id: "elven_necklace",
    kind: "accessory",
    craftOpt: { key: "skillCdMult", value: 0.99, rarity: "rare" },
  };
  const m = sumEquippedCraftOpt("skillCdMult", "jewelry");
  assert.ok(Math.abs(m - 0.99) < 1e-9, "got " + m);
});

console.log("\nCraft quality: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
