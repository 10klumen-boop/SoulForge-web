// ===== Unit-тесты: quest-journal-core.js (награды за шаги и главы) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

// Моки для quest-journal-core.js
global.$ = () => ({ textContent: "" });
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.gameLog = () => {};
global.ensureWorkshopState = () => {};
global.save = () => {};
global.farmZoneById = (id) => (global.FARM_ZONES || []).find((z) => z.id === id) || { chapter: 1 };
global.zoneRaceView = (id) => ({ name: id, storyTag: "Глава I" });

loadScripts([
  "src/data/story-zones-data.js",
  "src/data/zone-chapter-rewards.js",
  "src/01-constants.js",
  "src/progress-store.js",
  "src/quest-core.js",
  "src/quest-journal-core.js",
]);

function resetState() {
  state.adena = 0;
  state.totals = { tries: 0, fails: 0, earned: 0 };
  state.materials = { soul: 0, spirit: 0 };
  state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  state.questProgress = { stepRewards: {}, chapterRewards: {} };
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

  console.log("\n--- quest journal core ---");

  test("zoneQuestStepRewardDef scales with chapter and step", () => {
    const r1 = zoneQuestStepRewardDef("banana_mine", 1);
    assert.ok(r1.adena > 0);
    assert.ok(r1.soul > 0);
    const r2 = zoneQuestStepRewardDef("banana_mine", 3);
    assert.ok(r2.adena >= r1.adena);
    assert.ok(r2.soul >= r1.soul);
  });

  test("zoneQuestStepRewardDef gives crystal on step 3", () => {
    const r = zoneQuestStepRewardDef("banana_mine", 3);
    assert.ok(Object.keys(r.crystals).length > 0);
  });

  test("formatQuestStepLootLines returns non-empty array", () => {
    const lines = formatQuestStepLootLines("banana_mine", 1);
    assert.ok(Array.isArray(lines));
    assert.ok(lines.length > 0);
  });

  test("ensureStepRewardsState initializes stepRewards", () => {
    resetState();
    delete state.questProgress.stepRewards;
    ensureStepRewardsState();
    assert.ok(state.questProgress.stepRewards);
    assert.deepStrictEqual(state.questProgress.stepRewards, {});
  });

  test("isQuestStepRewardClaimed returns correct state", () => {
    resetState();
    state.questProgress.stepRewards.q1 = true;
    assert.strictEqual(isQuestStepRewardClaimed("q1"), true);
    assert.strictEqual(isQuestStepRewardClaimed("q2"), false);
  });

  test("applyQuestStepReward grants adena and materials", () => {
    resetState();
    const result = applyQuestStepReward("banana_mine", 1, "quest_1");
    assert.ok(result.adena > 0);
    assert.strictEqual(state.adena, result.adena);
    assert.strictEqual(state.questProgress.stepRewards.quest_1, true);
    assert.ok(state.totals.earned > 0);
    assert.ok(state.materials.soul > 0);
  });

  test("applyQuestStepReward skips already claimed", () => {
    resetState();
    applyQuestStepReward("banana_mine", 1, "quest_1");
    const before = state.adena;
    const result = applyQuestStepReward("banana_mine", 1, "quest_1");
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(state.adena, before);
  });

  test("zoneChapterRewardDef returns known or default reward", () => {
    const rw = zoneChapterRewardDef("unknown_zone");
    assert.ok(rw.adena > 0);
    assert.ok(rw.soul > 0);
    assert.ok(rw.crystals);
  });

  test("applyChapterReward grants adena and materials", () => {
    resetState();
    const result = applyChapterReward("banana_mine", { silent: true });
    assert.ok(result.adena > 0);
    assert.strictEqual(state.questProgress.chapterRewards.banana_mine, true);
    assert.ok(state.totals.earned > 0);
  });

  test("isChapterRewardClaimed tracks state", () => {
    resetState();
    assert.strictEqual(isChapterRewardClaimed("banana_mine"), false);
    applyChapterReward("banana_mine", { silent: true });
    assert.strictEqual(isChapterRewardClaimed("banana_mine"), true);
  });

  test("grantChapterReward silent mode returns true", () => {
    resetState();
    assert.strictEqual(grantChapterReward("banana_mine", { silent: true }), true);
    assert.strictEqual(isChapterRewardClaimed("banana_mine"), true);
  });

  test("grantChapterReward returns false for already claimed", () => {
    resetState();
    grantChapterReward("banana_mine", { silent: true });
    assert.strictEqual(grantChapterReward("banana_mine"), false);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
