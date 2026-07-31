// ===== Unit: сортировка инвентаря по типу =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [
  { id: "w_a", name: "A Sword", grade: "A", patk: 100, matk: 10, ps: 1, ms: 1, icon: "a.png" },
  { id: "w_d", name: "D Sword", grade: "D", patk: 40, matk: 10, ps: 1, ms: 1, icon: "d.png" },
];
global.WMAP = {};
WEAPONS.forEach((w) => {
  WMAP[w.id] = w;
});
global.AMAP = {
  mithril_boots: {
    id: "mithril_boots",
    name: "Mithril Boots",
    grade: "C",
    slot: "boots",
    pdef: 20,
    mdef: 10,
    icon: "b.png",
  },
};
global.COLLECTIBLES = {
  epic_ring: { id: "epic_ring", name: "Epic Ring", icon: "r.png" },
};
global.ARMOR_FRAGS = {
  mithril_boots_piece: {
    id: "mithril_boots_piece",
    name: "Boots Material",
    armorId: "mithril_boots",
    icon: "bp.png",
  },
};
global.ORE = { soul: { name: "Soul Ore", icon: "s.png" }, spirit: { name: "Spirit Ore", icon: "p.png" } };
global.CRYSTAL_ICON = { D: "d.png", C: "c.png", B: "b.png", A: "a.png" };
global.CRYSTAL_COLOR = { D: "#5aa8e8", C: "#6ecf78", B: "#a878e8", A: "#c9a050" };
global.SHOT_ICON = {
  soul: { D: "ss.png", C: "ss.png", B: "ss.png", A: "ss.png" },
  spirit: { D: "sp.png", C: "sp.png", B: "sp.png", A: "sp.png" },
};
global.INV_CAP = 64;
global.uid = () => "u" + Math.random();
global.save = () => {};
global.fmt = (n) => String(n);
global.statAt = (b, s, p) => (b || 0) + (s || 0) * (p || 0);
global.fighterWeaponPower = (w, plus) => (w.patk || 0) + (w.ps || 0) * (plus || 0);
global.mysticWeaponPower = (w, plus) => (w.matk || 0) + (w.ms || 0) * (plus || 0);
global.avatarIsMystic = () => false;
global.isNoGradeWeapon = () => false;

global.state = {
  inventory: [],
  materials: { soul: 5, spirit: 0, mithril_boots_piece: 3 },
  crystals: { D: 2, C: 0, B: 0, A: 0 },
  shots: { soul: { D: 10, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } },
  invTab: "A",
};

global.ProgressStore = {
  set(k, v) {
    state[k] = v;
  },
  update(k, fn) {
    state[k] = fn(state[k]);
  },
};

loadScripts(["src/armor-sets-core.js", "src/09-inventory.js"]);

function run() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try {
      fn();
      console.log("  ✓ " + name);
      passed++;
    } catch (e) {
      console.log("  ✗ " + name);
      console.log("    " + (e && e.message ? e.message : e));
      failed++;
    }
  }

  console.log("\n--- inventory sort ---");

  test("ensureInvTab migrates grade tab to all", () => {
    state.invTab = "C";
    ensureInvTab();
    assert.strictEqual(state.invTab, "all");
  });

  test("sort: weapon → armor → accessory, grade inside", () => {
    state.inventory = [
      { uid: "1", id: "epic_ring", kind: "accessory" },
      { uid: "2", id: "mithril_boots", kind: "armor" },
      { uid: "3", id: "w_d", plus: 0 },
      { uid: "4", id: "w_a", plus: 2 },
    ];
    applyInventorySort("kind");
    assert.strictEqual(state.inventory[0].id, "w_a");
    assert.strictEqual(state.inventory[1].id, "w_d");
    assert.strictEqual(state.inventory[2].id, "mithril_boots");
    assert.strictEqual(state.inventory[3].id, "epic_ring");
    assert.strictEqual(inventorySortMode(), "kind");
  });

  test("sort power: higher weapon power first within weapons", () => {
    state.inventory = [
      { uid: "1", id: "w_d", plus: 0 },
      { uid: "2", id: "w_a", plus: 0 },
      { uid: "3", id: "mithril_boots", kind: "armor" },
    ];
    applyInventorySort("power");
    assert.strictEqual(state.inventory[0].id, "w_a", "A sword stronger than D");
    assert.strictEqual(state.inventory[1].id, "w_d");
    assert.strictEqual(state.inventory[2].id, "mithril_boots");
    assert.strictEqual(inventorySortMode(), "power");
  });

  test("sort power: same grade, higher plus (power) first", () => {
    state.inventory = [
      { uid: "1", id: "w_a", plus: 0 },
      { uid: "2", id: "w_a", plus: 5 },
    ];
    applyInventorySort("power");
    assert.strictEqual(state.inventory[0].plus, 5);
    assert.strictEqual(state.inventory[1].plus, 0);
  });

  test("sort grade: A before D before armor of lower grade", () => {
    state.inventory = [
      { uid: "1", id: "mithril_boots", kind: "armor" },
      { uid: "2", id: "w_d", plus: 0 },
      { uid: "3", id: "w_a", plus: 0 },
    ];
    applyInventorySort("grade");
    assert.strictEqual(state.inventory[0].id, "w_a");
    assert.strictEqual(state.inventory[1].id, "mithril_boots", "C armor above D weapon");
    assert.strictEqual(state.inventory[2].id, "w_d");
    assert.strictEqual(inventorySortMode(), "grade");
  });

  test("setInvSort persists mode", () => {
    setInvSort("power");
    assert.strictEqual(inventorySortMode(), "power");
    setInvSort("grade");
    assert.strictEqual(inventorySortMode(), "grade");
    setInvSort("kind");
    assert.strictEqual(inventorySortMode(), "kind");
  });

  test("tabs filter by kind", () => {
    assert.strictEqual(inventoryItemMatchesTab({ id: "w_a" }, "weapon"), true);
    assert.strictEqual(inventoryItemMatchesTab({ id: "mithril_boots", kind: "armor" }, "armor"), true);
    assert.strictEqual(inventoryItemMatchesTab({ id: "w_a" }, "armor"), false);
    assert.strictEqual(inventoryItemMatchesTab({ id: "w_a" }, "frag"), false);
  });

  test("resource stacks listed", () => {
    assert.strictEqual(listArmorFragStacks().length, 1);
    assert.strictEqual(listShotStacks().length, 1);
    assert.strictEqual(listCrystalStacks().length, 1);
    assert.strictEqual(listOreStacks().length, 1);
    assert.ok(isInvResourceTab("shot"));
  });

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

run();
