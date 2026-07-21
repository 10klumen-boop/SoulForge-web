// ===== Unit-тесты: passive-income-core.js =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.FARM_ZONES = [
  { id: "banana_mine", active: true, chapter: 1 },
  { id: "elven_ruins", active: true, chapter: 2 },
  { id: "c", active: true, chapter: 3 },
  { id: "d", active: true, chapter: 4 },
  { id: "e", active: true, chapter: 5 },
];
global._done = new Set();
global.isZoneChapterComplete = (id) => global._done.has(id);
global.farmZoneById = (id) => global.FARM_ZONES.find((z) => z.id === id) || global.FARM_ZONES[0];
global.avatarFarmPower = () => 50;
global.playtestIncome = (n) => n;
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.toast = () => {};
global.gameLog = () => {};
global.save = () => {};
global.$ = () => ({ textContent: "" });
global.ProgressStore = {
  set: (k, v) => { global.state[k] = v; },
  update: (k, fn) => { global.state[k] = fn(global.state[k]); },
};
global.state = {
  adena: 1_000_000,
  farmZone: "banana_mine",
  avatar: { created: true, level: 5 },
  totals: { tries: 0, fails: 0, earned: 0 },
  passiveIncome: { lastCollectAt: 0, warehouseLv: 0 },
};
global.tune = (k, fb) => fb;
global.tuneInt = (k, fb) => fb;

loadScripts([
  "src/data/passive-income-balance.js",
  "src/passive-income-core.js",
]);

function runTests() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try { fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { failed++; console.error("  ✗ " + name); console.error("    " + e.message); }
  }

  console.log("\n--- passive income ---");

  test("passiveCapSec base is 2 hours", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: 0, warehouseLv: 0 };
    assert.strictEqual(passiveCapSec(), 2 * 3600);
  });

  test("passiveCapSec grows with completed chapters", () => {
    global._done = new Set(["banana_mine", "elven_ruins"]);
    state.passiveIncome = { lastCollectAt: 0, warehouseLv: 0 };
    assert.strictEqual(passiveCapSec(), 2 * 3600 + 2 * 3600);
  });

  test("passiveCapSec grows with warehouse levels", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: 0, warehouseLv: 2 };
    assert.strictEqual(passiveCapSec(), 2 * 3600 + 2 * 2 * 3600);
  });

  test("passivePendingSec clamps to cap", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: Date.now() - 10 * 3600 * 1000, warehouseLv: 0 };
    const sec = passivePendingSec();
    assert.strictEqual(sec, passiveCapSec());
  });

  test("collectPassiveIncome grants adena and resets pending", () => {
    global._done = new Set();
    state.adena = 0;
    state.totals = { tries: 0, fails: 0, earned: 0 };
    state.passiveIncome = { lastCollectAt: Date.now() - 3600 * 1000, warehouseLv: 0 };
    const before = state.adena;
    const res = collectPassiveIncome({ queueNotice: false });
    assert.ok(res.amount > 0);
    assert.ok(state.adena > before);
    assert.strictEqual(passivePendingAdena(), 0);
  });

  test("queueNotice stores offline reward for entry modal", () => {
    takePassiveIncomeNotice();
    global._done = new Set();
    state.adena = 0;
    state.totals = { tries: 0, fails: 0, earned: 0 };
    state.passiveIncome = { lastCollectAt: Date.now() - 3600 * 1000, warehouseLv: 0 };
    const res = collectPassiveIncome({ queueNotice: true });
    assert.ok(res.amount > 0);
    const notice = peekPassiveIncomeNotice();
    assert.ok(notice && notice.amount === res.amount);
    const taken = takePassiveIncomeNotice();
    assert.strictEqual(taken.amount, res.amount);
    assert.strictEqual(peekPassiveIncomeNotice(), null);
  });

  test("warehouseNextPrice follows ladder", () => {
    state.passiveIncome = { lastCollectAt: Date.now(), warehouseLv: 0 };
    assert.strictEqual(warehouseNextPrice(), 150_000);
    state.passiveIncome.warehouseLv = 4;
    assert.strictEqual(warehouseNextPrice(), null);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
