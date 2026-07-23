// ===== Unit-тесты: economy-balance.js (P1 якоря дохода) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts(["src/data/economy-balance.js"]);

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

  console.log("\n--- economy balance ---");

  test("farm anchors match roadmap midpoints", () => {
    assert.deepStrictEqual(ECONOMY.farmAdenaPerHour, [9_600_000, 19_200_000, 33_600_000, 52_800_000, 76_800_000]);
  });

  test("step adena is minutes/60 of farm/hour", () => {
    assert.strictEqual(economyStepAdena(1, 1), 1_600_000);
    assert.strictEqual(economyStepAdena(1, 2), 1_920_000);
    assert.strictEqual(economyStepAdena(1, 3), 2_560_000);
    assert.strictEqual(economyStepAdena(2, 1), 3_200_000);
  });

  test("chapter adena is 45 min of farm/hour", () => {
    assert.strictEqual(economyChapterAdena(1), 7_200_000);
    assert.strictEqual(economyChapterAdena(5), 57_600_000);
  });

  test("passive is 10% of farm/hour", () => {
    assert.ok(Math.abs(economyPassiveAdenaPerSec(1) - 9_600_000 / 3600 * 0.1) < 1e-9);
    assert.ok(Math.abs(economyChapterFarmMult(5) - 8) < 1e-9);
  });

  test("ach adena scaler grows early/mid without exploding prestige", () => {
    assert.strictEqual(economyScaleAchAdena(500), 1_000);
    assert.strictEqual(economyScaleAchAdena(8_000), 24_000);
    assert.strictEqual(economyScaleAchAdena(25_000), 100_000);
    assert.strictEqual(economyScaleAchAdena(50_000), 200_000);
    assert.strictEqual(economyScaleAchAdena(150_000), 375_000);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
