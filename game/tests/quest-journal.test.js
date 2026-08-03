// ===== Unit-тесты: quest-journal-core.js (награды за шаги и главы) =====
const assert = require("assert");
const { loadScripts, loadGameJsonDataSync } = require("./setup");

// Моки для quest-journal-core.js
global.$ = () => ({ textContent: "" });
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.gameLog = () => {};
global.ensureWorkshopState = () => {};
global.save = () => {};
global.farmZoneById = (id) => (global.FARM_ZONES || []).find((z) => z.id === id) || { chapter: 1 };
global.zoneRaceView = (id) => ({ name: id, storyTag: "Глава I" });

loadGameJsonDataSync();
loadScripts([
  "src/data/economy-balance.js",
  "src/01-constants.js",
  "src/progress-store.js",
  "src/data/quest-data.js",
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

  test("P1 calibration: ch1 steps follow economyStepAdena", () => {
    assert.strictEqual(zoneQuestStepRewardDef("banana_mine", 1).adena, economyStepAdena(1, 1));
    assert.strictEqual(zoneQuestStepRewardDef("banana_mine", 2).adena, economyStepAdena(1, 2));
    assert.strictEqual(zoneQuestStepRewardDef("banana_mine", 3).adena, economyStepAdena(1, 3));
    assert.ok(economyStepAdena(1, 1) >= 25_000);
  });

  test("P1 calibration: ch1 chapter clear from ZONE_CHAPTER_REWARDS", () => {
    assert.strictEqual(zoneChapterRewardDef("banana_mine").adena, 112_500);
    assert.ok(economyChapterAdena(1) >= 112_500);
  });

  test("P1 calibration: later chapters outpace earlier", () => {
    assert.ok(economyStepAdena(5, 1) > economyStepAdena(1, 1));
    assert.ok(economyChapterAdena(5) > economyChapterAdena(1));
    assert.ok(zoneChapterRewardDef("dwarven_depths").adena >= 900_000);
  });

  test("zoneQuestStepRewardDef grants story XP on early chapters", () => {
    assert.strictEqual(zoneQuestStepRewardDef("banana_mine", 1).xp, 1);
    assert.strictEqual(zoneQuestStepRewardDef("elven_ruins", 2).xp, 1);
    assert.strictEqual(zoneQuestStepRewardDef("orc_barracks", 3).xp, 5);
  });

  test("zoneChapterRewardDef includes XP for ch1–3", () => {
    assert.strictEqual(zoneChapterRewardDef("banana_mine").xp, 1);
    assert.strictEqual(zoneChapterRewardDef("elven_ruins").xp, 1);
    assert.strictEqual(zoneChapterRewardDef("orc_barracks").xp, 5);
  });

  test("formatQuestStepLootLines includes XP when present", () => {
    const lines = formatQuestStepLootLines("banana_mine", 1);
    assert.ok(lines.some((ln) => /XP/.test(ln)));
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
