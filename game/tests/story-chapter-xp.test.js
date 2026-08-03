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
  "src/data/quest-data.js",
  "src/avatar-core.js",
  "src/quest-core.js",
  "src/quest-journal-core.js",
  "src/avatar-stats-core.js",
  "src/story-zones-core.js",
]);

function xpNeed(level) {
  return Math.floor(AVATAR_XP_BASE * Math.pow(1.32, Math.max(0, level - 1)));
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
  const nk = Math.max(1, Math.ceil((2 + ch) / 12));
  const gk = Math.max(1, Math.round((8 + ch * 2) / 12));
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

  test("story XP per chapter lands near next reqLevel", () => {
    const chain = storyFarmZones().filter((z) => z.active).sort((a, b) => a.chapter - b.chapter);
    for (let i = 0; i < chain.length - 1; i++) {
      const cur = chain[i];
      const next = chain[i + 1];
      const need = xpToReach(next.reqLevel, cur.reqLevel);
      const got = expectedChapterKillXp(cur.chapter) + expectedChapterQuestXp(cur.chapter, cur.id);
      const ratio = got / Math.max(1, need);
      // ~1/12 XP/килл + −35%: глава ≈ 0.08–0.3 гейта
      assert.ok(ratio >= 0.08 && ratio <= 0.35, cur.id + " XP ratio " + ratio.toFixed(2) + " (got " + got + " need " + need + ")");
    }
  });

  console.log("\nStory gate/XP: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
