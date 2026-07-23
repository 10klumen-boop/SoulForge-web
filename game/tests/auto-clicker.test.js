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
    assert.strictEqual(short.price, 1_750_000);
    assert.strictEqual(mid.price, 3_500_000);
    assert.strictEqual(long.price, 6_900_000);
  });

  test("chapter price mult is 1 on chapter 1", () => {
    assert.ok(Math.abs(autoClickerChapterPriceMult() - 1) < 1e-9);
    assert.strictEqual(autoClickerPackPrice(autoClickerPackById("short")), 1_750_000);
  });

  test("buyAutoClickerPack extends until and spends adena", () => {
    state.adena = 10_000_000;
    state.autoClicker = { until: 0, enabled: true, pauseStartedAt: 0 };
    const ok = buyAutoClickerPack("short");
    assert.strictEqual(ok, true);
    assert.strictEqual(state.adena, 10_000_000 - 1_750_000);
    assert.ok(autoClickerRemainingMs() > 14 * 60 * 1000);
    assert.ok(autoClickerIsActive());
  });

  test("buying again stacks duration", () => {
    const before = autoClickerRemainingMs();
    buyAutoClickerPack("short");
    const after = autoClickerRemainingMs();
    assert.ok(after > before + 14 * 60 * 1000);
  });

  test("max stack is 3 hours — refuse over-cap buy", () => {
    state.adena = 10_000_000;
    const maxMs = autoClickerMaxStackMs();
    assert.strictEqual(maxMs, 3 * 60 * 60 * 1000);
    state.autoClicker = {
      until: Date.now() + maxMs - 20 * 60 * 1000,
      enabled: true,
      pauseStartedAt: 0,
    };
    const adenaBefore = state.adena;
    const ok = buyAutoClickerPack("long"); // 60 мин не влезает в ~20 мин
    assert.strictEqual(ok, false);
    assert.strictEqual(state.adena, adenaBefore);
    assert.ok(autoClickerCanBuyPack(autoClickerPackById("short")).ok); // 15 мин влезет
    assert.ok(buyAutoClickerPack("short"));
    assert.ok(autoClickerRemainingMs() <= maxMs + 1000);
    assert.ok(!autoClickerCanBuyPack(autoClickerPackById("short")).ok);
  });

  test("clamp cuts over-cap remaining from old saves", () => {
    const maxMs = autoClickerMaxStackMs();
    state.autoClicker = {
      until: Date.now() + 10 * 60 * 60 * 1000,
      enabled: true,
      pauseStartedAt: 0,
    };
    assert.ok(clampAutoClickerToMax());
    assert.ok(autoClickerRemainingMs() <= maxMs + 1000);
    assert.ok(autoClickerRemainingMs() > maxMs - 5000);
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
