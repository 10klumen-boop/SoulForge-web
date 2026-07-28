// ===== Unit: кристаллизация graded jewelry; epic blocked =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [];
global.WMAP = {};
global.INV_CAP = 64;
global.uid = () => "uid-" + Math.random().toString(16).slice(2);
global.toast = () => {};
global.save = () => {};
global.renderInventory = () => {};
global.renderMenu = () => {};
global.checkAchievements = () => {};
global.logCharacterEvent = () => {};
global.Audio2 = { coin() {}, click() {}, open() {}, success() {} };
global.$ = () => ({ textContent: "", classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
global.$$ = () => [];
global.showConfirm = async () => true;
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.isItemEquipped = () => false;
global.CRYSTAL_ICON = { D: "d.png", C: "c.png", B: "b.png", A: "a.png" };
global.CRYSTAL_PLUS_MULT = 1.08;
global.CRYSTAL_VALUE = { D: 50, C: 150, B: 400, A: 900 };
global.playtestIncome = (n) => n;

loadScripts([
  "src/progress-store.js",
  "src/data/enchant-balance.js",
  "src/data/jewelry-sets-data.js",
  "src/jewelry-sets-core.js",
  "src/06-rules.js",
  "src/09-inventory.js",
  "src/inventory-ui.js",
]);

global.renderInventory = () => {};
global.$ = () => ({ textContent: "", classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
global.$$ = () => [];

global.state = {
  inventory: [],
  crystals: { D: 0, C: 0, B: 0, A: 0 },
  materials: { soul: 0, spirit: 0 },
  avatar: { created: true, gear: {} },
  characters: [{ id: "c1", progress: {} }],
  activeCharacterId: "c1",
};

assert.ok(COLLECTIBLES.elven_necklace.cc > 0, "elven has cc");
assert.strictEqual(crystalYield(COLLECTIBLES.elven_necklace, 0), COLLECTIBLES.elven_necklace.cc);

assert.ok(canCrystallizeInventoryItem({ uid: "1", id: "elven_necklace", kind: "accessory" }));
assert.ok(!canCrystallizeInventoryItem({ uid: "2", id: "zaken_blessed_earring", kind: "accessory" }));

(async () => {
  state.inventory = [{ uid: "j1", id: "elven_necklace", kind: "accessory" }];
  state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  await crystallizeAt(0);
  assert.strictEqual(state.inventory.length, 0);
  assert.strictEqual(state.crystals.D, COLLECTIBLES.elven_necklace.cc);

  state.inventory = [{ uid: "z1", id: "zaken_blessed_earring", kind: "accessory" }];
  const before = state.crystals.D;
  await crystallizeAt(0);
  assert.strictEqual(state.inventory.length, 1, "epic stays");
  assert.strictEqual(state.crystals.D, before, "epic no crystals");

  // Frag tab stacks include jewelry shards
  state.inventory = [{ uid: "s1", id: "elven_necklace_piece", kind: "shard", qty: 3 }];
  const frags = listFragStacks();
  assert.ok(frags.some((r) => r.id === "elven_necklace_piece" && r.qty === 3 && r.kind === "jewelry"));

  console.log("jewelry-crystallize.test.js OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
