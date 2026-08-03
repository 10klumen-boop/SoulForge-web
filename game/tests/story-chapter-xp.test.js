// ===== Story: prev-chapter gate + XP lands on next reqLevel =====
const assert = require("assert");
const { loadScripts, loadGameJsonDataSync } = require("./setup");

loadGameJsonDataSync();

global.farmZoneById = (id) => (FARM_ZONES || []).find((z) => z.id === id);
global.ProgressStore = {
  set: (k, v) => { state[k] = v; },
  update: (k, fn) => { state[k] = fn(state[k]); },
};
global.save = () => {};
global.toast = () => {};
global.gameLog = () => {};
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.avatarFarmPower = () => 9999;
global.$ = () => ({ textContent: "" });

global.state = {
  avatar: { created: true, raceId: "human", level: 10, xp: 0 },
  farmZone: "banana_mine",
  farmNotify: {},
  questProgress: {
    completed: {},
    kills: {},
    goldenKills: {},
    bosses: {},
    briefings: {},
    chapterRewards: {},
    stepRewards: {},
    bossQueued: {},
    bossGrind: {},
  },
};

loadScripts([
  "src/data/farm-zones-balance.js",
  "src/data/quest-data.js",
  "src/avatar-core.js",
  "src/quest-core.js",
  "src/quest-journal-core.js",
  "src/avatar-stats-core.js",
  "src/story-zones-core.js",
]);

function xpNeed(level) {
  return typeof avatarXpToLevel === "function"
    ? avatarXpToLevel(level)
    : Math.floor(AVATAR_XP_BASE * Math.pow(1.32, Math.max(0, level - 1)));
}

function xpToReach(target, start) {
  let t = 0;
  for (let lv = start; lv < target; lv++) t += xpNeed(lv);
  return t;
}

function expectedChapterKillXp(ch) {
  const kills = typeof zoneQuestKillTargets === "function" ? zoneQuestKillTargets(ch) : [20, 14, 20];
  const k = kills.reduce((a, b) => a + b, 0);
  const g = typeof zoneQuestGoldenTarget === "function" ? zoneQuestGoldenTarget(ch) : 2;
  const gIn = Math.min(g, kills[1] || 0);
  const grind = typeof ZONE_BOSS_GRIND_KILLS === "number" ? ZONE_BOSS_GRIND_KILLS : 16;
  const z = { chapter: ch, side: false };
  const nk = farmZoneMineXp(z, false);
  const gk = farmZoneMineXp(z, true);
  return (k - gIn) * nk + gIn * gk + grind * nk + gk;
}

function expectedChapterQuestXp(ch, zoneId) {
  let xp = 0;
  for (let s = 1; s <= 3; s++) xp += zoneQuestStepRewardDef(zoneId, s).xp || 0;
  const chap = (ZONE_CHAPTER_REWARDS && ZONE_CHAPTER_REWARDS[zoneId] && ZONE_CHAPTER_REWARDS[zoneId].xp) || 0;
  return xp + chap;
}

function runTests() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try { fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { failed++; console.error("  ✗ " + name); console.error("    " + e.message); }
  }

  console.log("\n--- story chapter gate + XP ---");

  test("prevFarmZone follows chapter chain, skips sides", () => {
    assert.strictEqual(prevFarmZone("banana_mine"), null);
    assert.strictEqual(prevFarmZone("elven_ruins")?.id, "banana_mine");
    assert.strictEqual(prevFarmZone("orc_barracks")?.id, "elven_ruins");
    assert.strictEqual(prevFarmZone("dark_cavern")?.id, "orc_barracks");
    assert.strictEqual(prevFarmZone("dwarven_depths")?.id, "dark_cavern");
  });

  test("next story zone locked until previous chapter closed", () => {
    state.avatar.level = 20;
    state.questProgress = {
      completed: {}, kills: {}, goldenKills: {}, bosses: {}, briefings: {},
      chapterRewards: {}, stepRewards: {}, bossQueued: {}, bossGrind: {},
    };
    assert.strictEqual(canEnterFarmZone(farmZoneById("banana_mine")), true);
    assert.strictEqual(canEnterFarmZone(farmZoneById("elven_ruins")), false);
    assert.strictEqual(isPrevZoneChapterComplete(farmZoneById("elven_ruins")), false);

    // close ch1
    zoneQuestSteps("banana_mine").forEach((q) => markQuestStepComplete(q.id));
    markZoneBossDefeated("banana_mine");
    assert.strictEqual(isZoneChapterComplete("banana_mine"), true);
    assert.strictEqual(canEnterFarmZone(farmZoneById("banana_mine")), false, "completed chapter closed");
    assert.strictEqual(canEnterFarmZone(farmZoneById("elven_ruins")), true);
    assert.strictEqual(canEnterFarmZone(farmZoneById("orc_barracks")), false);
  });

  test("completed story zone status is chapterDone", () => {
    assert.strictEqual(canEnterFarmZone(farmZoneById("banana_mine")), false);
    if (typeof farmZoneTargetPower !== "function") {
      global.farmZoneTargetPower = (z) => z?.targetPower || 100;
    }
    const st = farmZoneStatus(farmZoneById("banana_mine"));
    assert.strictEqual(st.chapterDone, true);
    assert.strictEqual(st.ok, false);
  });

  test("migrateFarmZone leaves completed chapter for next open", () => {
    state.farmZone = "banana_mine";
    state.avatar.level = 20;
    migrateFarmZone();
    assert.notStrictEqual(state.farmZone, "banana_mine");
    assert.strictEqual(canEnterFarmZone(farmZoneById(state.farmZone)), true);
  });

  test("full story XP reaches about level 10 without hunting", () => {
    const need = xpToReach(10, 1);
    const chain = storyFarmZones().filter((z) => z.active).sort((a, b) => a.chapter - b.chapter);
    let got = 0;
    chain.forEach((z) => {
      got += expectedChapterKillXp(z.chapter) + expectedChapterQuestXp(z.chapter, z.id);
    });
    const ratio = got / Math.max(1, need);
    // Prelude без охоты → уверенный Lv10 (не улетая далеко в 11).
    assert.ok(
      ratio >= 0.95 && ratio <= 1.25,
      "story XP ratio to Lv10 " + ratio.toFixed(2) + " (got " + got + " need " + need + ")"
    );
  });

  console.log("\nStory gate/XP: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
