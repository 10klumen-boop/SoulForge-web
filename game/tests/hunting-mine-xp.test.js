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

  test("story kill XP is flat for prelude chapters", () => {
    assert.strictEqual(farmZoneMineXp({ chapter: 1, side: false }, false), 5);
    assert.strictEqual(farmZoneMineXp({ chapter: 3, side: false }, true), 5);
    assert.strictEqual(farmZoneMineXp({ chapter: 5, side: false }, false), 5);
  });

  test("high hunting zones grant much more XP than low", () => {
    const low = farmZoneMineXp({ side: true, reqLevel: 5, lvlMin: 1, lvlMax: 15 }, false);
    const mid = farmZoneMineXp({ side: true, reqLevel: 16, lvlMin: 20, lvlMax: 30 }, false);
    const midHigh = farmZoneMineXp({ side: true, reqLevel: 18, lvlMin: 25, lvlMax: 35 }, false);
    const hi = farmZoneMineXp({ side: true, reqLevel: 25, lvlMin: 30, lvlMax: 40 }, false);
    const top = farmZoneMineXp({ side: true, reqLevel: 32, lvlMin: 40, lvlMax: 50 }, false);
    assert.ok(low >= HUNTING_XP_MIN);
    assert.ok(mid >= low, "mid " + mid + " vs low " + low);
    assert.ok(midHigh > mid, "midHigh " + midHigh + " vs mid " + mid);
    // req≥24: XP ×0.25 — хай всё ещё выше mid soft, но не раздувается
    assert.ok(hi > mid, "hi " + hi + " vs mid " + mid);
    assert.ok(top >= hi, "top " + top + " vs hi " + hi);
  });

  test("high loc XP is quartered vs raw curve", () => {
    const need = farmZoneMineXpNeedAtGate({ reqLevel: 32 });
    const raw = Math.max(HUNTING_XP_MIN, Math.round(need / HUNTING_XP_KILLS_PER_LEVEL));
    const got = farmZoneMineXp({ side: true, reqLevel: 32 }, false);
    assert.strictEqual(got, Math.max(HUNTING_XP_MIN, Math.round(raw * HUNTING_XP_HIGH_MULT)));
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
    assert.ok(got > oldLinear * 5, "got " + got + " old " + oldLinear);
  });

  console.log("\nHunting mine XP: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
