// ===== Unit-тесты: auto-clicker-core.js =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.FARM_ZONES = [{ id: "banana_mine", active: true, chapter: 1 }];
global.farmZoneById = (id) => global.FARM_ZONES.find((z) => z.id === id) || global.FARM_ZONES[0];
global.toast = () => {};
global.save = () => {};
global.$ = () => ({ textContent: "" });
global.Audio2 = { success: () => {}, click: () => {} };
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.ProgressStore = {
  set: (k, v) => { global.state[k] = v; },
  update: (k, fn) => { global.state[k] = fn(global.state[k]); },
};
global.state = {
  adena: 1_000_000,
  farmZone: "banana_mine",
  autoClicker: { until: 0, enabled: true, pauseStartedAt: 0 },
};
global.tune = (k, fb) => fb;
global.tuneInt = (k, fb) => fb;
global.mineActive = false;
global.mineGnomes = { *[Symbol.iterator]() {} };
global.isGamePaused = () => false;

loadScripts([
  "src/data/auto-clicker-balance.js",
  "src/auto-clicker-core.js",
]);

function runTests() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try { fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { failed++; console.error("  ✗ " + name); console.error("    " + e.message); }
  }

  console.log("\n--- auto clicker ---");

  test("packs have expected prices", () => {
    const short = autoClickerPackById("short");
    const mid = autoClickerPackById("mid");
    const long = autoClickerPackById("long");
    assert.strictEqual(short.price, 80_000);
    assert.strictEqual(mid.price, 180_000);
    assert.strictEqual(long.price, 380_000);
  });

  test("chapter price mult is 1 on chapter 1", () => {
    assert.ok(Math.abs(autoClickerChapterPriceMult() - 1) < 1e-9);
    assert.strictEqual(autoClickerPackPrice(autoClickerPackById("short")), 80_000);
  });

  test("buyAutoClickerPack extends until and spends adena", () => {
    state.adena = 1_000_000;
    state.autoClicker = { until: 0, enabled: true, pauseStartedAt: 0 };
    const ok = buyAutoClickerPack("short");
    assert.strictEqual(ok, true);
    assert.strictEqual(state.adena, 1_000_000 - 80_000);
    assert.ok(autoClickerRemainingMs() > 14 * 60 * 1000);
    assert.ok(autoClickerIsActive());
  });

  test("buying again stacks duration", () => {
    const before = autoClickerRemainingMs();
    buyAutoClickerPack("short");
    const after = autoClickerRemainingMs();
    assert.ok(after > before + 14 * 60 * 1000);
  });

  test("pause freezes timer", () => {
    state.autoClicker.pauseStartedAt = 0;
    const rem0 = autoClickerRemainingMs();
    autoClickerFreezeForPause();
    assert.ok(state.autoClicker.pauseStartedAt > 0);
    // simulate 5s of pause without advancing until
    state.autoClicker.pauseStartedAt = Date.now() - 5000;
    const remPaused = autoClickerRemainingMs();
    assert.ok(remPaused >= rem0 + 4000);
    autoClickerResumeFromPause();
    assert.strictEqual(state.autoClicker.pauseStartedAt, 0);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
