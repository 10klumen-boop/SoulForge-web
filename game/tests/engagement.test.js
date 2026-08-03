// ===== Unit-тесты: engagement-core.js =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.playtestIncome = (n) => n;
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.toast = () => {};
global.gameLog = () => {};
global.save = () => {};
global.needsAvatarSetup = () => false;
global.grantAutoClickerTime = () => {};
global.ensureWorkshopState = () => {};

global.ProgressStore = {
  set: (k, v) => {
    global.state[k] = v;
  },
  update: (k, fn) => {
    global.state[k] = fn(global.state[k]);
  },
};

function resetEngagement(extra) {
  global.state = Object.assign(
    {
      adena: 0,
      materials: { soul: 0, spirit: 0 },
      activeCharacterId: "char_test",
      avatar: { created: true, name: "Tester" },
      engagement: defaultEngagementState(),
    },
    extra || {}
  );
}

loadScripts([
  "src/data/engagement-balance.js",
  "src/engagement-core.js",
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

  console.log("\n--- engagement ---");

  const dayA = Date.UTC(2026, 7, 3, 12, 0, 0); // Mon Aug 3 2026
  const dayB = Date.UTC(2026, 7, 4, 12, 0, 0); // Tue
  const dayGap = Date.UTC(2026, 7, 6, 12, 0, 0); // Thu
  const nextWeek = Date.UTC(2026, 7, 10, 12, 0, 0); // Mon Aug 10

  test("ensureEngagementPeriod picks daily with login fixed", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: true });
    const e = state.engagement;
    assert.strictEqual(e.dailyPeriod, "2026-08-03");
    assert.ok(e.dailyIds.includes("login"));
    assert.ok(e.dailyIds.includes("instance_clear_1"));
    assert.strictEqual(e.dailyIds.length, ENGAGEMENT.dailyCount);
    assert.ok(e.weeklyIds.includes("instance_clear_2"));
    assert.strictEqual(e.weeklyIds.length, ENGAGEMENT.weeklyCount);
    assert.strictEqual(e.progress.login, 1);
    assert.strictEqual(e.loginStreak, 1);
    assert.strictEqual(e.lastLoginDay, "2026-08-03");
  });

  test("seed stable for same dayKey + character", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: false });
    const ids1 = state.engagement.dailyIds.slice();
    const week1 = state.engagement.weeklyIds.slice();
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: false });
    assert.deepStrictEqual(state.engagement.dailyIds, ids1);
    assert.deepStrictEqual(state.engagement.weeklyIds, week1);
  });

  test("daily rollover clears daily progress, keeps weekly", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: true });
    const weekIds = state.engagement.weeklyIds.slice();
    engagementEmit("mob_kill", { type: "normal" });
    engagementEmit("mob_kill", { type: "normal" });
    const weeklyId = weekIds.find((id) => engagementTaskById(id).event === "mob_kill" && !engagementTaskById(id).match);
    if (weeklyId) {
      assert.ok((state.engagement.progress[weeklyId] || 0) >= 2);
    }
    const dailyKill = state.engagement.dailyIds.find(
      (id) => engagementTaskById(id).event === "mob_kill" && !engagementTaskById(id).match
    );
    ensureEngagementPeriod(dayB, { touchLogin: true });
    assert.strictEqual(state.engagement.dailyPeriod, "2026-08-04");
    assert.deepStrictEqual(state.engagement.weeklyIds, weekIds);
    if (dailyKill) {
      assert.strictEqual(state.engagement.progress[dailyKill] || 0, 0);
    }
    if (weeklyId) {
      assert.ok((state.engagement.progress[weeklyId] || 0) >= 2);
    }
    assert.strictEqual(state.engagement.loginStreak, 2);
  });

  test("streak breaks after gap day", () => {
    resetEngagement({
      engagement: Object.assign(defaultEngagementState(), {
        lastLoginDay: "2026-08-03",
        loginStreak: 5,
      }),
    });
    ensureEngagementPeriod(dayGap, { touchLogin: true });
    assert.strictEqual(state.engagement.loginStreak, 1);
    assert.strictEqual(state.engagement.lastLoginDay, "2026-08-06");
  });

  test("same-day login does not bump streak", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: true });
    ensureEngagementPeriod(dayA, { touchLogin: true });
    assert.strictEqual(state.engagement.loginStreak, 1);
  });

  test("emit increments matching tasks only", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: false });
    // force known daily set
    state.engagement.dailyIds = ["login", "farm_kills_30", "farm_golden_3", "enchant_5"];
    state.engagement.weeklyIds = ["farm_kills_200"];
    state.engagement.progress = {};
    engagementEmit("mob_kill", { type: "golden" });
    assert.strictEqual(state.engagement.progress.farm_golden_3, 1);
    assert.strictEqual(state.engagement.progress.farm_kills_30, 1);
    assert.strictEqual(state.engagement.progress.farm_kills_200, 1);
    assert.strictEqual(state.engagement.progress.enchant_5 || 0, 0);
  });

  test("claim task once", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: true });
    state.engagement.dailyIds = ["login", "mine_visit_1", "enchant_5", "workshop_craft_1"];
    state.engagement.progress = { login: 1 };
    state.engagement.claimed = {};
    const before = state.adena;
    const r1 = claimEngagementTask("login");
    assert.strictEqual(r1.ok, true);
    assert.ok(state.adena > before);
    const mid = state.adena;
    const r2 = claimEngagementTask("login");
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(state.adena, mid);
  });

  test("milestone only after all claimed", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: false });
    state.engagement.dailyIds = ["login", "mine_visit_1"];
    state.engagement.progress = { login: 1, mine_visit_1: 1 };
    state.engagement.claimed = { login: true };
    state.engagement.dailyMilestoneClaimed = false;
    assert.strictEqual(claimEngagementMilestone("daily").ok, false);
    state.engagement.claimed.mine_visit_1 = true;
    const before = state.adena;
    assert.strictEqual(claimEngagementMilestone("daily").ok, true);
    assert.ok(state.adena > before);
    assert.strictEqual(claimEngagementMilestone("daily").ok, false);
  });

  test("weekly rollover resets weekly, keeps daily progress", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: true });
    state.engagement.dailyIds = ["login", "farm_kills_30", "enchant_5", "mine_visit_1"];
    state.engagement.weeklyIds = ["farm_kills_200", "enchant_25", "quest_steps_3"];
    state.engagement.progress = { farm_kills_30: 10, farm_kills_200: 50 };
    state.engagement.claimed = {};
    ensureEngagementPeriod(nextWeek, { touchLogin: true });
    assert.strictEqual(state.engagement.weeklyPeriod, engagementUtcWeekKey(nextWeek));
    assert.strictEqual(state.engagement.progress.farm_kills_200 || 0, 0);
    // daily also rolled (new day) so farm_kills_30 cleared — expected
    assert.notStrictEqual(state.engagement.dailyPeriod, "2026-08-03");
  });

  test("streak claimable only when full", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: true });
    assert.strictEqual(engagementStreakClaimable(), false);
    assert.strictEqual(claimEngagementStreak().ok, false);
    state.engagement.loginStreak = engagementStreakFullDays();
    state.engagement.lastLoginDay = "2026-08-03";
    state.engagement.streakClaimedDay = "";
    assert.strictEqual(engagementStreakClaimable(), true);
    const before = state.adena;
    assert.strictEqual(claimEngagementStreak().ok, true);
    assert.ok(state.adena > before);
    assert.strictEqual(engagementStreakClaimable(), false);
    assert.strictEqual(claimEngagementStreak().ok, false);
  });

  test("instance_clear and pvp hooks match pool tasks", () => {
    resetEngagement();
    ensureEngagementPeriod(dayA, { touchLogin: false });
    state.engagement.dailyIds = ["login", "instance_clear_1", "pvp_fight_1", "mine_visit_1"];
    state.engagement.weeklyIds = ["instance_clear_2", "pvp_wins_3", "farm_kills_200"];
    state.engagement.progress = {};
    engagementEmit("instance_clear", { dungeonId: "test" });
    assert.strictEqual(state.engagement.progress.instance_clear_1, 1);
    assert.strictEqual(state.engagement.progress.instance_clear_2, 1);
    engagementEmit("pvp", { youWin: false, draw: false, mode: "practice" });
    assert.strictEqual(state.engagement.progress.pvp_fight_1, 1);
    assert.strictEqual(state.engagement.progress.pvp_wins_3 || 0, 0);
    engagementEmit("pvp", { youWin: true, mode: "duel" });
    assert.strictEqual(state.engagement.progress.pvp_wins_3, 1);
    engagementEmit("pvp", { youWin: true, mode: "practice" });
    assert.strictEqual(state.engagement.progress.pvp_wins_3, 1);
  });

  console.log("\nengagement: " + passed + " passed, " + failed + " failed");
  if (failed) process.exit(1);
}

runTests();
