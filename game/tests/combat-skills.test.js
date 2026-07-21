// ===== Unit-тесты: combat-skills-core.js (cd, buffs, skill helpers) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

// Моки для combat-skills-core.js
global.mineGnomes = {
  *[Symbol.iterator]() {
    for (const g of global._mockMobs) yield g;
  },
  has(g) { return global._mockMobs.includes(g); },
};
global._mockMobs = [];
global.mineActive = true;
global.isGamePaused = () => false;
global.isMysticArchetype = (classId) => classId === "mystic" || classId === "shaman";
global.toast = () => {};
global.Audio2 = { click: () => {} };
global.avatarMineClickDamage = () => 10;
global.applyMineShotDamageMult = (d) => d;
global.applyMobShieldDamage = (g, d) => d;
global.gnomeDropPoint = () => ({ x: 0, y: 0 });
global.updateMobHpBar = () => {};
global.renderMineSkillBar = () => {};
global.renderAvatarSkillsPanel = () => {};
global.floatText = () => {};
global.mineBurst = () => {};
global.checkMobEnrage = () => {};
global.finishMobKill = () => {};
global.fmtCombat = (n) => String(n);
global.tune = (k, fb) => fb;
global.state = { avatar: { created: true, classId: "fighter", level: 10 } };

loadScripts([
  "src/data/combat-skills-data.js",
  "src/combat-skills-core.js",
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

  console.log("\n--- combat skills core ---");

  test("combatSkillsForClass picks fighter for fighter", () => {
    const skills = combatSkillsForClass("fighter");
    assert.ok(Array.isArray(skills));
    assert.ok(skills.length > 0);
    assert.strictEqual(skills[0].id, "power_strike");
  });

  test("combatSkillsForClass picks mystic for mystic/shaman", () => {
    const m = combatSkillsForClass("mystic");
    assert.strictEqual(m[0].id, "soul_burst");
    const s = combatSkillsForClass("shaman");
    assert.strictEqual(s[0].id, "soul_burst");
  });

  test("combatSkillsForAvatar returns empty if no avatar", () => {
    state.avatar = null;
    assert.deepStrictEqual(combatSkillsForAvatar(), []);
    state.avatar = { created: true, classId: "fighter", level: 10 };
  });

  test("isCombatSkillUnlocked checks level", () => {
    state.avatar.level = 10;
    const skill = combatSkillsForClass("fighter").find((s) => s.id === "power_strike");
    assert.strictEqual(isCombatSkillUnlocked(skill), true);
    state.avatar.level = 1;
    assert.strictEqual(isCombatSkillUnlocked(skill), false);
    state.avatar.level = 10;
  });

  test("combatSkillCooldownLeft returns 0 when no cooldown", () => {
    resetMineSkillRuntime();
    assert.strictEqual(combatSkillCooldownLeft("power_strike"), 0);
  });

  test("combatSkillCooldownLeft returns positive during cooldown", () => {
    resetMineSkillRuntime();
    mineSkillRuntime.cds.power_strike = Date.now() + 5000;
    assert.ok(combatSkillCooldownLeft("power_strike") > 0);
    assert.ok(combatSkillCooldownLeft("power_strike") <= 5000);
  });

  test("mineSkillClickMult applies nextHit buff once", () => {
    resetMineSkillRuntime();
    mineSkillRuntime.buffs.nextHitMult = 2.5;
    assert.strictEqual(mineSkillClickMult(), 2.5);
    assert.strictEqual(mineSkillRuntime.buffs.nextHitMult, 1);
    assert.strictEqual(mineSkillClickMult(), 1);
  });

  test("mineSkillClickMult applies damage buff while active", () => {
    resetMineSkillRuntime();
    mineSkillRuntime.buffs.damageMult = 1.85;
    mineSkillRuntime.buffs.damageUntil = Date.now() + 5000;
    assert.strictEqual(mineSkillClickMult(), 1.85);
  });

  test("mineSkillTimerFreezeActive reflects freeze buff", () => {
    resetMineSkillRuntime();
    assert.strictEqual(mineSkillTimerFreezeActive(), false);
    mineSkillRuntime.buffs.timerFreezeUntil = Date.now() + 5000;
    assert.strictEqual(mineSkillTimerFreezeActive(), true);
  });

  test("mineSkillTimerDrainAdjust returns slow when active", () => {
    resetMineSkillRuntime();
    assert.strictEqual(mineSkillTimerDrainAdjust(), 0);
    mineSkillRuntime.buffs.timerSlowUntil = Date.now() + 5000;
    assert.strictEqual(mineSkillTimerDrainAdjust(), -0.42);
    mineSkillRuntime.buffs.timerFreezeUntil = Date.now() + 5000;
    assert.strictEqual(mineSkillTimerDrainAdjust(), 0);
  });

  test("useCombatSkill returns false when skill not found", () => {
    resetMineSkillRuntime();
    assert.strictEqual(useCombatSkill("missing"), false);
  });

  test("useCombatSkill returns false when skill locked", () => {
    resetMineSkillRuntime();
    state.avatar.level = 1;
    assert.strictEqual(useCombatSkill("power_strike"), false);
    state.avatar.level = 10;
  });

  test("useCombatSkill returns false when mine inactive", () => {
    resetMineSkillRuntime();
    mineActive = false;
    assert.strictEqual(useCombatSkill("power_strike"), false);
    mineActive = true;
  });

  test("useCombatSkill returns false when game paused", () => {
    resetMineSkillRuntime();
    global.isGamePaused = () => true;
    assert.strictEqual(useCombatSkill("power_strike"), false);
    global.isGamePaused = () => false;
  });

  test("useCombatSkill applies cooldown for valid target", () => {
    resetMineSkillRuntime();
    const mob = { _type: "normal", _hp: 100, _maxHp: 100, classList: { add: () => {}, remove: () => {} } };
    global._mockMobs = [mob];
    const result = useCombatSkill("power_strike");
    assert.strictEqual(result, true);
    assert.ok(combatSkillCooldownLeft("power_strike") > 0);
    assert.strictEqual(mineSkillRuntime.buffs.nextHitMult, 2.5);
    global._mockMobs = [];
  });

  test("useCombatSkill applies timerSlow without target", () => {
    resetMineSkillRuntime();
    global._mockMobs = [];
    const result = useCombatSkill("iron_shell");
    assert.strictEqual(result, true);
    assert.ok(mineSkillRuntime.buffs.timerSlowUntil > Date.now());
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
