// ===== Unit-тесты: achievements-core.js (минимальный набор) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.ALL_ACHIEVEMENTS = [
  { id: "first_click", category: "progress", reward: {} },
  { id: "first_enchant", category: "progress", reward: {} },
];
global.HIDDEN_ACHIEVEMENTS = [];
global.PLAYTEST_CHECKLIST = [];
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

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
