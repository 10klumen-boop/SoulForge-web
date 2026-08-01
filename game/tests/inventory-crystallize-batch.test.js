// ===== Unit: массовая кристаллизация — сумма yield =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [];
global.WMAP = {};
global.AMAP = {};
global.COLLECTIBLES = {};
global.CRYSTAL_ICON = { D: "d.png", C: "c.png", B: "b.png", A: "a.png" };
global.CRYSTALLIZE_ICON = { normal: "n.png", over: "o.png", drag: "d.png" };
global.INV_TABS = [{ id: "all", label: "Все" }];
global.state = { inventory: [], crystals: { D: 0, C: 0, B: 0, A: 0 }, invTab: "all" };
global.ProgressStore = {
  set(k, v) {
    state[k] = v;
  },
  update(k, fn) {
    state[k] = fn(state[k]);
  },
};
global.Audio2 = { click() {}, coin() {}, open() {} };
global.$ = () => null;
global.$$ = () => [];
global.isAccessoryItem = () => false;
global.isArmorItem = () => false;
global.invItemDef = () => null;
global.inventoryTabId = () => "all";
global.isInvResourceTab = () => false;
global.inventoryItemMatchesTab = () => true;
global.crystalYield = (_def, plus) => 10 + (plus || 0);
global.showConfirm = async () => false;
global.save = () => {};
global.toast = () => {};

loadScripts(["src/inventory-ui.js"]);

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

  console.log("\n--- inventory crystallize batch ---");

  test("aggregateCrystalYields sums by grade", () => {
    const { byGrade, count } = aggregateCrystalYields([
      { grade: "D", yld: 5 },
      { grade: "D", yld: 7 },
      { grade: "C", yld: 12 },
      { grade: "A", yld: 0 },
      null,
    ]);
    assert.strictEqual(count, 4);
    assert.strictEqual(byGrade.D, 12);
    assert.strictEqual(byGrade.C, 12);
    assert.strictEqual(byGrade.A, 0);
    assert.strictEqual(byGrade.B, 0);
  });

  test("aggregateCrystalYields empty", () => {
    const { byGrade, count } = aggregateCrystalYields([]);
    assert.strictEqual(count, 0);
    assert.strictEqual(byGrade.D, 0);
  });

  test("exitInvCrySelectMode clears selection", () => {
    invCrySelectMode = true;
    invCrySelected.add("u1");
    exitInvCrySelectMode();
    assert.strictEqual(isInvCrySelectMode(), false);
    assert.strictEqual(invCrySelected.size, 0);
  });

  console.log("\ninventory crystallize batch: " + passed + " passed, " + failed + " failed");
  if (failed) process.exitCode = 1;
}

run();
