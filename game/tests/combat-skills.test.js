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
  "src/data/combat-skills-kits-data.js",
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

  test("combatSkillsForClass picks mystic and shaman kits", () => {
    const m = combatSkillsForClass("mystic");
    assert.strictEqual(m[0].id, "soul_burst");
    const s = combatSkillsForClass("shaman");
    assert.strictEqual(s[0].id, "totem_strike");
    assert.notStrictEqual(s[0].id, m[0].id);
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

  test("T0 unlocks 2/4/6/8; profession kit unlocks all at once", () => {
    state.avatar = { created: true, raceId: "human", classId: "fighter", level: 1, professionId: null };
    const t0 = combatSkillsForAvatar();
    assert.deepStrictEqual(
      t0.map((s) => s.unlockLevel),
      [2, 4, 6, 8]
    );
    state.avatar.level = 1;
    assert.strictEqual(isCombatSkillUnlocked(t0[0]), false);
    state.avatar.level = 2;
    assert.strictEqual(isCombatSkillUnlocked(t0[0]), true);

    state.avatar.professionId = "warrior";
    state.avatar.level = 10;
    const t1 = combatSkillsForAvatar();
    assert.deepStrictEqual(
      t1.map((s) => s.unlockLevel),
      [1, 1, 1, 1]
    );
    assert.ok(t1.every((s) => isCombatSkillUnlocked(s)));

    state.avatar.professionId = "gladiator";
    state.avatar.level = 40;
    const t2 = combatSkillsForAvatar();
    assert.deepStrictEqual(
      t2.map((s) => s.unlockLevel),
      [1, 1, 1, 1]
    );
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
    state.avatar = { created: true, classId: "fighter", raceId: "human", level: 1 };
    assert.strictEqual(useCombatSkill("human_fighter_q"), false);
    state.avatar.level = 10;
  });

  test("useCombatSkill returns false when mine inactive", () => {
    resetMineSkillRuntime();
    state.avatar = { created: true, classId: "fighter", raceId: "human", level: 10 };
    mineActive = false;
    assert.strictEqual(useCombatSkill("human_fighter_q"), false);
    mineActive = true;
  });

  test("useCombatSkill returns false when game paused", () => {
    resetMineSkillRuntime();
    state.avatar = { created: true, classId: "fighter", raceId: "human", level: 10 };
    global.isGamePaused = () => true;
    assert.strictEqual(useCombatSkill("human_fighter_q"), false);
    global.isGamePaused = () => false;
  });

  test("useCombatSkill applies cooldown for valid target", () => {
    resetMineSkillRuntime();
    state.avatar = { created: true, classId: "fighter", raceId: "human", level: 10 };
    const mob = { _type: "normal", _hp: 100, _maxHp: 100, classList: { add: () => {}, remove: () => {} } };
    global._mockMobs = [mob];
    const result = useCombatSkill("human_fighter_q");
    assert.strictEqual(result, true);
    assert.ok(combatSkillCooldownLeft("human_fighter_q") > 0);
    assert.strictEqual(mineSkillRuntime.buffs.nextHitMult, 2.2);
    global._mockMobs = [];
  });

  test("useCombatSkill applies timerSlow without target", () => {
    resetMineSkillRuntime();
    state.avatar = { created: true, classId: "fighter", raceId: "human", level: 10 };
    global._mockMobs = [];
    const result = useCombatSkill("human_fighter_e");
    assert.strictEqual(result, true);
    assert.ok(mineSkillRuntime.buffs.timerSlowUntil > Date.now());
  });

  test("combatSkillsForAvatar uses profession kit when set", () => {
    state.avatar = { created: true, classId: "fighter", level: 40, professionId: "gladiator" };
    const skills = combatSkillsForAvatar();
    assert.ok(skills.some((s) => s.id === "gladiator_q"));
    assert.ok(!skills.some((s) => s.id === "power_strike"));
    state.avatar = { created: true, classId: "fighter", level: 10 };
  });

  test("T0 kit by race for starter without profession", () => {
    state.avatar = { created: true, classId: "fighter", raceId: "dark_elf", level: 10, professionId: null };
    const skills = combatSkillsForAvatar();
    assert.ok(skills.some((s) => s.id === "de_fighter_q"));
    assert.ok(skills[0].icon.indexOf("class-skills/") >= 0);
    assert.ok(!skills.some((s) => s.id === "power_strike"));
  });

  test("T1 kit by professionId warrior", () => {
    state.avatar = {
      created: true,
      classId: "fighter",
      raceId: "human",
      level: 20,
      professionId: "warrior",
      professionTier: 1,
    };
    const skills = combatSkillsForAvatar();
    assert.ok(skills.some((s) => s.id === "warrior_q"));
    assert.strictEqual(skills.find((s) => s.hotkey === "Q").name, "Прямой удар");
  });

  test("mineApplySkillAdenaBonus applies farm and hit bonuses", () => {
    resetMineSkillRuntime();
    mineSkillRuntime.buffs.farmAdenaMult = 1.15;
    mineSkillRuntime.buffs.farmAdenaUntil = Date.now() + 5000;
    mineSkillRuntime.buffs.pendingAdenaHitBonus = 0.08;
    assert.strictEqual(mineApplySkillAdenaBonus(1000), 1242);
    assert.strictEqual(mineSkillRuntime.buffs.pendingAdenaHitBonus, 0);
  });

  test("partyDamageBuff applies only in party/instance context", () => {
    resetMineSkillRuntime();
    state.avatar = { created: true, classId: "shaman", level: 40, professionId: "warcryer" };
    global.mineActive = true;
    global.isGamePaused = () => false;
    global.isInstanceSessionActive = () => false;
    global.isMineInstanceMode = () => false;
    const okSolo = useCombatSkill("warcryer_f");
    assert.strictEqual(okSolo, true);
    assert.strictEqual(minePartyDamageMult(), 1);
    global.isInstanceSessionActive = () => true;
    resetMineSkillRuntime();
    const okInst = useCombatSkill("warcryer_f");
    assert.strictEqual(okInst, true);
    assert.strictEqual(minePartyDamageMult(), 1.18);
    state.avatar = { created: true, classId: "fighter", level: 10 };
    delete global.isInstanceSessionActive;
    delete global.isMineInstanceMode;
  });

  test("combatSkillGameplayDesc covers core effects", () => {
    assert.ok(
      /следующий клик/i.test(
        combatSkillGameplayDesc({ effect: "nextHit", mult: 2.5 })
      )
    );
    assert.ok(
      /вдвое медленнее/i.test(
        combatSkillGameplayDesc({ effect: "timerSlow", duration: 4000 })
      )
    );
    const multi = combatSkillGameplayDesc({ effect: "multiHit", hits: 5, mult: 0.5 });
    assert.ok(/5 ударов/.test(multi));
    assert.ok(/×2,5/.test(multi) || /×2.5/.test(multi) || /≈×2,5/.test(multi));
    assert.ok(
      /мгновенный удар/i.test(
        combatSkillGameplayDesc({ effect: "directHit", mult: 3 })
      )
    );
    assert.ok(
      /к таймеру/i.test(
        combatSkillGameplayDesc({ effect: "drainHit", mult: 2.2, healMs: 3500 })
      )
    );
    assert.ok(
      /группе/i.test(
        combatSkillGameplayDesc({ effect: "partyDamageBuff", mult: 1.18, duration: 6000 })
      )
    );
  });

  test("combatSkillEffectLabel and plain tip", () => {
    assert.strictEqual(combatSkillEffectLabel("multiHit"), "Серия ударов");
    const skill = { id: "t", name: "Тест", hotkey: "Q", effect: "directHit", mult: 2, unlockLevel: 1 };
    state.avatar = { created: true, level: 10 };
    const tip = combatSkillPlainTip(skill);
    assert.ok(tip.indexOf("Тест") >= 0);
    assert.ok(tip.indexOf("[Q]") >= 0);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
