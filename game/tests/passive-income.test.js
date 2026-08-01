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
  avatar: { created: true, level: 5, raceId: "human" },
  totals: { tries: 0, fails: 0, earned: 0 },
  passiveIncome: { lastCollectAt: 0, warehouseLv: 0 },
};
global.tune = (k, fb) => fb;
global.tuneInt = (k, fb) => fb;

loadScripts([
  "src/data/economy-balance.js",
  "src/data/passive-income-balance.js",
  "src/data/json/passive-skills.json",
  "src/passive-skills-core.js",
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

  test("passiveCapSec is 0 until warehouse bought", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: 0, warehouseLv: 0 };
    assert.strictEqual(passiveCapSec(), 0);
    assert.strictEqual(passiveWarehouseUnlocked(), false);
  });

  test("passiveCapSec base after first warehouse", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: 0, warehouseLv: 1 };
    assert.strictEqual(passiveCapSec(), 2 * 3600 + 1 * 2 * 3600);
    assert.strictEqual(passiveWarehouseUnlocked(), true);
  });

  test("passiveCapSec grows with completed chapters", () => {
    global._done = new Set(["banana_mine", "elven_ruins"]);
    state.passiveIncome = { lastCollectAt: 0, warehouseLv: 1 };
    assert.strictEqual(passiveCapSec(), 2 * 3600 + 2 * 3600 + 1 * 2 * 3600);
  });

  test("passiveCapSec grows with warehouse levels", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: 0, warehouseLv: 2 };
    assert.strictEqual(passiveCapSec(), 2 * 3600 + 2 * 2 * 3600);
  });

  test("no pending without warehouse", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: Date.now() - 10 * 3600 * 1000, warehouseLv: 0 };
    assert.strictEqual(passivePendingSec(), 0);
    assert.strictEqual(passivePendingAdena(), 0);
    const res = collectPassiveIncome({ queueNotice: true });
    assert.strictEqual(res.amount, 0);
    assert.strictEqual(peekPassiveIncomeNotice(), null);
  });

  test("passivePendingSec clamps to cap", () => {
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: Date.now() - 10 * 3600 * 1000, warehouseLv: 1 };
    const sec = passivePendingSec();
    assert.strictEqual(sec, passiveCapSec());
  });

  test("collectPassiveIncome grants adena and resets pending", () => {
    global._done = new Set();
    state.adena = 0;
    state.totals = { tries: 0, fails: 0, earned: 0 };
    state.passiveIncome = { lastCollectAt: Date.now() - 3600 * 1000, warehouseLv: 1 };
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
    state.passiveIncome = { lastCollectAt: Date.now() - 3600 * 1000, warehouseLv: 1 };
    const res = collectPassiveIncome({ queueNotice: true });
    assert.ok(res.amount > 0);
    const notice = peekPassiveIncomeNotice();
    assert.ok(notice && notice.amount === res.amount);
    const taken = takePassiveIncomeNotice();
    assert.strictEqual(taken.amount, res.amount);
    assert.strictEqual(peekPassiveIncomeNotice(), null);
  });

  test("queueNotice does not stack hours beyond cap", () => {
    takePassiveIncomeNotice();
    global._done = new Set();
    state.passiveIncome = { lastCollectAt: Date.now() - 10 * 3600 * 1000, warehouseLv: 1 };
    const cap = passiveCapSec();
    collectPassiveIncome({ queueNotice: true });
    // Симулируем повторный collect после «отката» якоря (как после cloud apply).
    state.passiveIncome.lastCollectAt = Date.now() - 10 * 3600 * 1000;
    collectPassiveIncome({ queueNotice: true });
    const notice = peekPassiveIncomeNotice();
    assert.ok(notice);
    assert.ok(notice.sec <= cap, "sec=" + notice.sec + " cap=" + cap);
    takePassiveIncomeNotice();
  });

  test("warehouseNextPrice follows ladder", () => {
    state.passiveIncome = { lastCollectAt: Date.now(), warehouseLv: 0 };
    assert.strictEqual(warehouseNextPrice(), 5_000_000);
    state.passiveIncome.warehouseLv = 4;
    assert.strictEqual(warehouseNextPrice(), null);
  });

  test("P1: passive rate ≈ 10% of ch1 farm anchor at power 0", () => {
    global.avatarFarmPower = () => 0;
    state.avatar.level = 1;
    state.farmZone = "banana_mine";
    state.passiveIncome = { lastCollectAt: Date.now(), warehouseLv: 1 };
    // Без mineProgressAdenaScale — fallback chapter mult (=1 для гл.I).
    delete global.mineProgressAdenaScale;
    const rate = passiveRatePerSec();
    const expected = economyPassiveAdenaPerSec(1);
    assert.ok(Math.abs(rate - expected) < 0.05, "rate=" + rate + " expected=" + expected);
  });

  test("P1: passive scales with chapter farm mult", () => {
    global.avatarFarmPower = () => 0;
    state.avatar.level = 1;
    state.farmZone = "e"; // chapter 5
    state.passiveIncome = { lastCollectAt: Date.now(), warehouseLv: 1 };
    delete global.mineProgressAdenaScale;
    const rate = passiveRatePerSec();
    assert.ok(Math.abs(rate - economyPassiveAdenaPerSec(5)) < 0.1, "rate=" + rate);
  });

  test("P0: hunting passive follows mineProgressAdenaScale, not zone.chapter", () => {
    global.avatarFarmPower = () => 0;
    state.avatar.level = 1;
    state.passiveIncome = { lastCollectAt: Date.now(), warehouseLv: 1 };
    global.FARM_ZONES.push({ id: "blazing_swamp", active: true, side: true, chapter: 1, reqLevel: 36 });
    global.mineProgressAdenaScale = (zoneId) => (zoneId === "blazing_swamp" ? 8 : 1);
    state.farmZone = "blazing_swamp";
    const rate = passiveRatePerSec();
    const expected = economyPassiveAdenaPerSec(1) * 8;
    assert.ok(Math.abs(rate - expected) < 0.1, "rate=" + rate + " expected=" + expected);
    // chapter=1 на охоте больше не ломает пассив
    delete global.mineProgressAdenaScale;
    state.farmZone = "banana_mine";
  });

  test("P2: dwarf offlineIncomeMult +8%", () => {
    global.avatarFarmPower = () => 0;
    state.avatar.level = 1;
    state.farmZone = "banana_mine";
    state.passiveIncome = { lastCollectAt: Date.now(), warehouseLv: 1 };
    delete global.mineProgressAdenaScale;
    state.avatar.raceId = "human";
    const base = passiveRatePerSec();
    state.avatar.raceId = "dwarf";
    const dwarf = passiveRatePerSec();
    assert.ok(Math.abs(dwarf - base * 1.08) < 0.01, "dwarf=" + dwarf + " base=" + base);
    state.avatar.raceId = "human";
  });

  test("rate is 0 without warehouse", () => {
    global.avatarFarmPower = () => 0;
    state.passiveIncome = { lastCollectAt: Date.now() - 3600 * 1000, warehouseLv: 0 };
    assert.strictEqual(passiveRatePerSec(), 0);
  });
  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
