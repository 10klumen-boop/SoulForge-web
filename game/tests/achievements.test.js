// ===== Unit-тесты: achievements-core.js (минимальный набор) =====
const assert = require("assert");
const { loadScripts, loadGameJsonDataSync } = require("./setup");

global.state = { achievements: { unlocked: {}, stats: {} } };
global.save = () => {};
global.gameLog = () => {};
global.toast = () => {};
global.playtestIncome = (n) => n;
global.inventoryCount = () => 0;
global.ProgressStore = {
  set: (k, v) => { global.state[k] = v; },
  update: (k, fn) => { global.state[k] = fn(global.state[k]); },
};

loadScripts([
  "src/data/achievement-data.js",
  "src/data/economy-balance.js",
  "src/achievements-core.js",
]);
loadGameJsonDataSync();
rebuildAchievementsFromMeta();

function runTests() {
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

  console.log("\n--- achievements core ---");

  test("ensureAchievementsState initializes stats", () => {
    state.achievements = { unlocked: {} };
    ensureAchievementsState();
    assert.ok(typeof state.achievements.stats === "object");
  });

  test("achStat increments a stat", () => {
    state.achievements = { unlocked: {}, stats: {} };
    achStat("clicks", 1);
    assert.strictEqual(state.achievements.stats.clicks, 1);
    achStat("clicks", 3);
    assert.strictEqual(state.achievements.stats.clicks, 4);
  });

  test("achStatMax tracks maximum", () => {
    state.achievements = { unlocked: {}, stats: {} };
    achStatMax("plus", 5);
    assert.strictEqual(state.achievements.stats.plus, 5);
    achStatMax("plus", 3);
    assert.strictEqual(state.achievements.stats.plus, 5);
    achStatMax("plus", 8);
    assert.strictEqual(state.achievements.stats.plus, 8);
  });

  test("achRecordsCount returns 0 initially", () => {
    assert.strictEqual(achRecordsCount(), 0);
  });

  test("hybrid: achievements meta bound with test()", () => {
    assert.ok(ACHIEVEMENTS.length > 40);
    assert.ok(ACH_CATEGORIES.length >= 5, "categories hydrated from JSON");
    assert.ok(typeof ACH_SECRET_ICON === "string" && ACH_SECRET_ICON.length > 0);
    assert.ok(Object.keys(ACH_ICON_MAP).length > 10);
    const first = ACHIEVEMENTS.find((a) => a.id === "first_field");
    assert.ok(first && first.title && first.reward);
    assert.strictEqual(typeof first.test, "function");
    assert.strictEqual(first.test({ mineVisits: 1 }), true);
    assert.strictEqual(first.test({ mineVisits: 0 }), false);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
