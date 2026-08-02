// ===== Unit-тесты: бижутерия D/C — сеты, CDR, resist, крафт =====
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
global.Audio2 = { success: () => {}, click: () => {}, open: () => {} };
global.$ = () => null;
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.safeLevel = () => 3;
global.isInventoryFull = () => false;
global.isGradeOverLevel = () => false;
global.avatarLevelForGrade = (a) => a?.level || 1;
global.passiveEffectMult = () => 1;

loadScripts([
  "src/progress-store.js",
  "src/data/enchant-balance.js",
  "src/data/jewelry-sets-data.js",
  "src/jewelry-sets-core.js",
  "src/avatar-gear-core.js",
  "src/09-inventory.js",
  "src/workshop-core.js",
]);

assert.ok(JEWELRY.length === 24, "24 jewelry pieces");
assert.ok(Object.keys(JEWELRY_SETS).length === 8, "8 jewelry sets");
assert.ok(COLLECTIBLES.elven_necklace, "elven merged into COLLECTIBLES");
assert.ok(COLLECTIBLES.elven_necklace.epic === false, "graded not epic");
assert.ok(COLLECTIBLES.zaken_blessed_earring.epic === true, "epic stays epic");
assert.ok(COLLECTIBLES.zaken_blessed_earring.canEnchant === true, "blessed zaken enchantable");
assert.ok(COLLECTIBLES.zaken_blessed_earring.grade === "C", "blessed zaken uses C scrolls");
assert.ok(Math.abs(COLLECTIBLES.zaken_blessed_earring.bonuses.pvpCritChance - 0.1) < 1e-9, "blessed zaken +10% pvp crit");
assert.ok(jewelryCanEnchant(COLLECTIBLES.zaken_blessed_earring), "jewelryCanEnchant allows blessed zaken");
assert.ok(!jewelryCanEnchant(COLLECTIBLES.antharas_earring), "other epics still locked");
assert.ok(ACCESSORY_FRAGS.elven_necklace_piece, "frag merged");
assert.ok(ACCESSORY_CRAFT.some((r) => r.accessoryId === "elven_necklace" && r.graded), "graded craft");

global.state = {
  adena: 100000,
  crystals: { D: 20, C: 20, B: 0, A: 0 },
  materials: { soul: 50, spirit: 0 },
  inventory: [],
  avatar: {
    created: true,
    level: 40,
    raceId: "human",
    classId: "fighter",
    gear: {
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
    },
  },
  characters: [{ id: "c1", progress: {} }],
  activeCharacterId: "c1",
};

ProgressStore.set("inventory", [
  { uid: "s1", id: "elven_necklace_piece", kind: "shard", qty: 10 },
  { uid: "s2", id: "elven_earring_piece", kind: "shard", qty: 10 },
  { uid: "s3", id: "elven_ring_piece", kind: "shard", qty: 10 },
]);

assert.ok(canCraftAccessory("elven_necklace").ok, "can craft elven necklace");
const crafted = craftAccessory("elven_necklace");
assert.ok(crafted, "crafted elven necklace");
assert.ok(
  (state.inventory || []).some((it) => it.id === "elven_necklace" && it.kind === "accessory"),
  "necklace in inventory"
);

// Equip full Elven set (1 neck + 2 ear + 2 ring)
function equipAcc(id, slot) {
  const it = { uid: uid(), id, kind: "accessory" };
  state.avatar.gear[slot] = it;
}
equipAcc("elven_necklace", "necklace");
equipAcc("elven_earring", "earring_l");
equipAcc("elven_earring", "earring_r");
equipAcc("elven_ring", "ring_l");
equipAcc("elven_ring", "ring_r");

const counts = equippedJewelrySetCounts();
assert.strictEqual(counts.elven, 5, "5 elven pieces equipped");

const cd = avatarJewelrySkillCdMult();
assert.ok(cd < 1, "CDR active: " + cd);
assert.ok(cd >= JEWELRY_SKILL_CD_FLOOR, "CDR floor");

const setB = avatarJewelrySetBonuses();
assert.ok(setB.sets.some((s) => s.id === "elven" && s.tiers.includes(5)), "elven 5-set");

// Darkness resist mix
state.avatar.gear = {
  weapon: null,
  helmet: null,
  chest: null,
  legs: null,
  gloves: null,
  boots: null,
  earring_l: { uid: uid(), id: "darkness_earring", kind: "accessory" },
  earring_r: { uid: uid(), id: "darkness_earring", kind: "accessory" },
  necklace: { uid: uid(), id: "darkness_necklace", kind: "accessory" },
  ring_l: { uid: uid(), id: "darkness_ring", kind: "accessory" },
  ring_r: { uid: uid(), id: "darkness_ring", kind: "accessory" },
};
const resist = avatarJewelryDebuffResist();
assert.ok(resist > 0.1, "darkness resist: " + resist);
assert.ok(resist <= JEWELRY_DEBUFF_RESIST_CAP, "resist cap");

assert.strictEqual(inventoryItemGradeKey({ id: "elven_ring", kind: "accessory" }), "D");
assert.strictEqual(inventoryItemGradeKey({ id: "zaken_blessed_earring", kind: "accessory" }), "epic");

const dFrags = jewelryFragIdsForZone("wasteland");
assert.ok(dFrags.length > 0, "D zone frags");
const cFrags = jewelryFragIdsForZone("cruma_marshlands");
assert.ok(cFrags.length > 0, "C zone frags aquastone");
assert.ok(!jewelryFragIdsForZone("abandoned_coal_low").length, "coal is D — no C jewelry");
assert.ok(jewelryFragIdsForZone("alligator_island").length > 0, "mermaid home");
assert.ok(jewelryFragIdsForZone("school_of_dark_arts").length > 0, "darkness home");
assert.ok(!jewelryFragIdsForZone("banana_mine").length, "no jewelry in banana_mine");

console.log("jewelry-sets.test.js: OK");
