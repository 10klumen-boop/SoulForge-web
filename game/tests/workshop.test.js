// ===== Unit-тесты: workshop-core.js (руда, заряды, автозаряды) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

// Моки для workshop-core.js (UI и зависимости от других модулей)
global.$ = (sel) => {
  if (sel === "#screen-inv") return { classList: { contains: () => false } };
  if (sel === "#adena") return { textContent: "" };
  return { textContent: "", classList: { contains: () => false } };
};
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.toast = () => {};
global.save = () => {};
global.renderWorkshop = () => {};
global.renderInventory = () => {};
global.achStat = () => {};
global.checkAchievements = () => {};
global.isMysticArchetype = (classId) => classId === "mystic" || classId === "shaman";
global.equippedWeaponItem = () => null;
global.Audio2 = { click: () => {}, success: () => {}, coin: () => {} };

loadScripts([
  "src/01-constants.js",
  "src/data/enchant-balance.js",
  "src/06-rules.js",
  "src/data/workshop-balance.js",
  "src/workshop-core.js",
  "src/data/farm-balance.js",
  "src/17-dev-tune.js",
  "src/progress-store.js",
]);

function resetState() {
  state.adena = 1_000_000;
  state.materials = { soul: 0, spirit: 0 };
  state.crystals = { D: 100, C: 100, B: 100, A: 100 };
  state.shots = { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } };
  state.autoShots = true;
  state.avatar = { created: true, classId: "fighter" };
}

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

  console.log("\n--- workshop core ---");

  test("orePrice returns base price by default", () => {
    assert.strictEqual(orePrice("soul"), 120);
    assert.strictEqual(orePrice("spirit"), 120);
  });

  test("shotBatchSize returns default batch", () => {
    assert.strictEqual(shotBatchSize(), 1000);
  });

  test("shotRecipeVal returns base recipe values", () => {
    assert.strictEqual(shotRecipeVal("D", "cry"), 6);
    assert.strictEqual(shotRecipeVal("D", "ore"), 18);
    assert.ok(shotRecipeVal("D", "sell") > 0);
  });

  test("ensureWorkshopState initializes materials and shots", () => {
    delete state.materials;
    delete state.shots;
    ensureWorkshopState();
    assert.deepStrictEqual(state.materials, { soul: 0, spirit: 0 });
    assert.deepStrictEqual(state.shots, { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } });
  });

  test("mineShotKind picks spirit for mystic and soul for fighter", () => {
    resetState();
    state.avatar.classId = "fighter";
    assert.strictEqual(mineShotKind(), "soul");
    state.avatar.classId = "mystic";
    assert.strictEqual(mineShotKind(), "spirit");
  });

  test("mineShotGrade defaults to D without weapon", () => {
    resetState();
    assert.strictEqual(mineShotGrade(), "D");
  });

  test("buyOre subtracts adena and adds material", () => {
    resetState();
    buyOre("soul", 10);
    assert.strictEqual(state.materials.soul, 10);
    assert.strictEqual(state.adena, 1_000_000 - 10 * orePrice("soul"));
  });

  test("craftShot consumes crystals and ore and produces shots", () => {
    resetState();
    state.materials.soul = 100;
    state.crystals.D = 100;
    craftShot("soul", "D");
    const recipe = { cry: shotRecipeVal("D", "cry"), ore: shotRecipeVal("D", "ore") };
    assert.strictEqual(state.crystals.D, 100 - recipe.cry);
    assert.strictEqual(state.materials.soul, 100 - recipe.ore);
    assert.strictEqual(state.shots.soul.D, shotBatchSize());
  });

  test("applyMineShotDamageMult consumes shot with auto on", () => {
    resetState();
    state.shots.soul.D = 5;
    state.avatar.classId = "fighter";
    const dmg = applyMineShotDamageMult(100);
    assert.strictEqual(state.shots.soul.D, 4);
    assert.strictEqual(dmg, 100);
  });

  test("applyMineShotDamageMult halves damage when out of shots", () => {
    resetState();
    state.shots.soul.D = 0;
    state.avatar.classId = "fighter";
    const dmg = applyMineShotDamageMult(100);
    assert.strictEqual(state.shots.soul.D, 0);
    assert.strictEqual(dmg, 50);
  });

  test("sellShots converts shots to adena", () => {
    resetState();
    state.shots.soul.D = 1000;
    sellShots("soul", "D");
    assert.strictEqual(state.shots.soul.D, 0);
    assert.ok(state.adena > 1_000_000);
  });

  test("shotsTotalValue sums all shot stocks", () => {
    resetState();
    state.shots.soul.D = 1000;
    state.shots.soul.C = 1000;
    const v = shotsTotalValue();
    assert.ok(v > 0);
    assert.strictEqual(v, 1000 * shotRecipeVal("D", "sell") + 1000 * shotRecipeVal("C", "sell"));
  });

  test("shot craft-to-sell is profitable for all grades", () => {
    for (const g of GRADES4) {
      const cryCost = shotRecipeVal(g, "cry") * crystalUnitValue(g);
      const oreCost = shotRecipeVal(g, "ore") * orePrice("soul");
      const cost = cryCost + oreCost;
      const sell = shotBatchSize() * shotRecipeVal(g, "sell");
      assert.ok(sell > cost, g + " sell " + sell + " should exceed cost " + cost);
      assert.ok(sell / cost >= 1.3, g + " margin should be >= 30%");
    }
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
