// ===== Hunting mine XP scales with zone reqLevel =====
const assert = require("assert");
const { loadScripts, loadGameJsonDataSync } = require("./setup");

loadGameJsonDataSync();
loadScripts([
  "src/data/farm-zones-balance.js",
  "src/avatar-core.js",
  "src/story-zones-core.js",
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

  console.log("\n--- hunting mine XP ---");

  test("story kill XP stays chapter-linear", () => {
    assert.strictEqual(farmZoneMineXp({ chapter: 1, side: false }, false), 1);
    assert.strictEqual(farmZoneMineXp({ chapter: 3, side: false }, false), 1);
    assert.strictEqual(farmZoneMineXp({ chapter: 5, side: false }, true), 2);
  });

  test("high hunting zones grant much more XP than low", () => {
    const low = farmZoneMineXp({ side: true, reqLevel: 5, lvlMin: 1, lvlMax: 15 }, false);
    const mid = farmZoneMineXp({ side: true, reqLevel: 16, lvlMin: 20, lvlMax: 30 }, false);
    const hi = farmZoneMineXp({ side: true, reqLevel: 25, lvlMin: 30, lvlMax: 40 }, false);
    const top = farmZoneMineXp({ side: true, reqLevel: 32, lvlMin: 40, lvlMax: 50 }, false);
    assert.ok(low >= HUNTING_XP_MIN);
    assert.ok(mid >= low * 2, "mid " + mid + " vs low " + low);
    assert.ok(hi > mid * 4, "hi " + hi + " vs mid " + mid);
    assert.ok(top > hi * 2, "top " + top + " vs hi " + hi);
  });

  test("golden hunting XP > normal at same gate", () => {
    const z = { side: true, reqLevel: 25, lvlMin: 30, lvlMax: 40 };
    assert.ok(farmZoneMineXp(z, true) > farmZoneMineXp(z, false));
  });

  test("live high zones beat old linear chapter formula", () => {
    const swamp = farmZoneById("blazing_swamp") || farmZoneById("sea_of_spores");
    assert.ok(swamp && swamp.side, "need a high side zone");
    const got = farmZoneMineXp(swamp, false);
    const oldLinear = 3 + farmZoneProgressChapter(swamp) * 2;
    assert.ok(got > oldLinear * 10, "got " + got + " old " + oldLinear);
  });

  console.log("\nHunting mine XP: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
