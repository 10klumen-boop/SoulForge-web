// ===== Unit-тесты: data-loader / JSON-контент =====
const assert = require("assert");
const { loadGameJsonDataSync, loadScripts } = require("./setup");

loadGameJsonDataSync();
loadScripts(["src/data/quest-data.js", "src/data/achievement-data.js"]);
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

  console.log("\n--- game json content ---");

  test("FARM_ZONES loaded from JSON", () => {
    assert.ok(Array.isArray(FARM_ZONES));
    assert.ok(FARM_ZONES.length >= 5);
    assert.strictEqual(FARM_ZONES[0].id, "banana_mine");
  });

  test("STORY_ARC and ZONE_BOSSES present", () => {
    assert.ok(STORY_ARC && STORY_ARC.title);
    assert.ok(ZONE_BOSSES.banana_mine.name);
  });

  test("ZONE_CHAPTER_REWARDS calibrated ch1", () => {
    assert.strictEqual(ZONE_CHAPTER_REWARDS.banana_mine.adena, 112_500);
  });

  test("quest formula helpers still work", () => {
    assert.deepStrictEqual(zoneQuestKillTargets(1), [22, 14, 24]);
    assert.strictEqual(zoneQuestGoldenTarget(1), 2);
  });

  test("achievements hybrid: meta + logic", () => {
    assert.ok(ACHIEVEMENTS.length >= 40);
    assert.ok(HIDDEN_ACHIEVEMENTS.length >= 5);
    const a = ACHIEVEMENTS.find((x) => x.id === "miner10");
    assert.ok(a && a.reward && a.reward.adena === 2000);
    assert.strictEqual(typeof a.test, "function");
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
