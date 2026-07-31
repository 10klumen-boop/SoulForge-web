// ===== Unit-тесты: enchant successChance, exportGameData, avatar math =====
const assert = require("assert");
const { loadScripts, loadGameJsonDataSync } = require("./setup");

// Моки для avatar-math.js (зависимости от gear/UI модулей)
global.isMysticArchetype = (classId) => classId === "mystic" || classId === "shaman";
global.iterEquippedGear = () => [];
global.avatarGearMineAdenaMult = () => 1;
global.zoneBossDef = () => ({ hpMult: 14 });
global.farmZoneById = (id) => FARM_ZONES.find((z) => z.id === id) || FARM_ZONES[0];

loadGameJsonDataSync();
loadScripts([
  "src/01-constants.js",
  "src/data/enchant-balance.js",
  "src/data/farm-balance.js",
  "src/data/professions-data.js",
  "src/data/avatar-stats-data.js",
  "src/professions-core.js",
  "src/06-rules.js",
  "src/02-state.js",
  "src/passive-skills-core.js",
  "src/avatar-math.js",
]);

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
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

  console.log("\n--- successChance ---");

  test("safe level returns 1", () => {
    assert.strictEqual(successChance(0, "regular"), 1);
    assert.strictEqual(successChance(1, "regular"), 1);
    assert.strictEqual(successChance(2, "regular"), 1);
    assert.strictEqual(successChance(SAFE_LEVEL - 1, "regular"), 1);
  });

  test("guarantee behavior always returns 1", () => {
    assert.strictEqual(successChance(0, "guarantee"), 1);
    assert.strictEqual(successChance(15, "guarantee"), 1);
  });

  test("regular chance decreases with plus", () => {
    const ch3 = successChance(SAFE_LEVEL, "regular");
    const ch4 = successChance(SAFE_LEVEL + 1, "regular");
    const ch5 = successChance(SAFE_LEVEL + 2, "regular");
    assert.ok(ch3 > ch4, "+3 > +4");
    assert.ok(ch4 > ch5, "+4 > +5");
  });

  test("regular chance at safe is base", () => {
    const ch = successChance(SAFE_LEVEL, "regular");
    const base = tune("ench.chanceBase", 0.72);
    assert.ok(approx(ch, base), "expected base chance " + base + ", got " + ch);
  });

  test("destruction chance is lower than regular", () => {
    const reg = successChance(SAFE_LEVEL + 5, "regular");
    const dest = successChance(SAFE_LEVEL + 5, "destruction");
    assert.ok(dest < reg, "destruction < regular");
  });

  test("chance respects min cap", () => {
    const ch = successChance(20, "regular");
    const min = tune("ench.chanceMin", 0.12);
    assert.ok(ch >= min, "chance >= min cap");
  });

  console.log("\n--- exportGameData / snapshot ---");

  test("exportGameData keeps known keys", () => {
    const sample = { adena: 12345, records: { a: 3 }, farmZone: "elven_ruins" };
    const exported = exportGameData(Object.assign({}, defaultState(), sample));
    assert.strictEqual(exported.adena, 12345);
    assert.deepStrictEqual(exported.records, { a: 3 });
    assert.strictEqual(exported.farmZone, "elven_ruins");
  });

  test("exportGameData strips devTune", () => {
    const sample = { adena: 100, devTune: { foo: 1 } };
    const exported = exportGameData(Object.assign({}, defaultState(), sample));
    assert.strictEqual(exported.devTune, undefined);
  });

  test("exportGameData does not include unknown keys", () => {
    const sample = { adena: 100, __secret: 42 };
    const exported = exportGameData(Object.assign({}, defaultState(), sample));
    assert.strictEqual(exported.__secret, undefined);
  });

  test("defaultState has required progress keys", () => {
    const d = defaultState();
    assert.ok(typeof d.adena === "number");
    assert.ok(Array.isArray(d.inventory));
    assert.ok(typeof d.records === "object");
    assert.ok(typeof d.totals === "object");
    assert.ok(typeof d.questProgress === "object");
  });

  console.log("\n--- avatar math ---");

  test("bow PATK normalized via WEAPON_CAT_POWER_MULT", () => {
    const prevM = global.avatarWeaponMasteryMult;
    global.avatarWeaponMasteryMult = () => 1;
    const bow = { cat: "Bow", patk: 191, ps: 8, weaponKind: "physical" };
    const sword = { cat: "Sword", patk: 96, ps: 4, weaponKind: "physical" };
    const bowP = fighterWeaponPower(bow, 0);
    const swordP = fighterWeaponPower(sword, 0);
    assert.strictEqual(WEAPON_CAT_POWER_MULT.Bow, 0.58);
    assert.strictEqual(bowP, Math.round(191 * 0.58));
    assert.strictEqual(swordP, 96);
    assert.ok(bowP < swordP * 1.25, "лук после нормы не в 2 раза сильнее меча");
    global.avatarWeaponMasteryMult = prevM;
  });

  test("dual/fist PATK softcapped toward sword", () => {
    const prevM = global.avatarWeaponMasteryMult;
    global.avatarWeaponMasteryMult = () => 1;
    const sword = { cat: "Sword", patk: 96, ps: 4, weaponKind: "physical" };
    const dual = { cat: "Dualsword", patk: 107, ps: 4, weaponKind: "physical" };
    const fist = { cat: "Fist", patk: 112, ps: 4, weaponKind: "physical" };
    const dualBlunt = { cat: "Dualblunt", patk: 107, ps: 4, weaponKind: "physical" };
    assert.strictEqual(WEAPON_CAT_POWER_MULT.Dualsword, 0.9);
    assert.strictEqual(WEAPON_CAT_POWER_MULT.Fist, 0.86);
    const s = fighterWeaponPower(sword, 0);
    const d = fighterWeaponPower(dual, 0);
    const f = fighterWeaponPower(fist, 0);
    const db = fighterWeaponPower(dualBlunt, 0);
    assert.strictEqual(d, Math.round(107 * 0.9));
    assert.strictEqual(f, Math.round(112 * 0.86));
    assert.strictEqual(db, Math.round(107 * 0.9));
    assert.ok(d <= s * 1.05, "dual не должен заметно обгонять меч");
    assert.ok(f <= s * 1.05, "fist не должен заметно обгонять меч");
    global.avatarWeaponMasteryMult = prevM;
  });

  test("overgrade weapon applies stepped grade penalty to gear patk", () => {
    const prevM = global.avatarWeaponMasteryMult;
    const prevIter = global.iterEquippedGear;
    global.avatarWeaponMasteryMult = () => 1;
    WMAP.c_sword = {
      id: "c_sword",
      cat: "Sword",
      patk: 100,
      matk: 0,
      ps: 0,
      ms: 0,
      grade: "C",
      weaponKind: "physical",
    };
    global.iterEquippedGear = () => [
      { slot: "weapon", item: { kind: "weapon", id: "c_sword", plus: 0 } },
    ];
    // lv 10 → D allowed, C is +1 rank → ×0.6
    state.avatar = { raceId: "human", classId: "fighter", level: 10, gear: {} };
    const soft = avatarStatBonusesFromGear().patk;
    // lv 1 → NG, C is +2 → ×0.2
    state.avatar.level = 1;
    const hard = avatarStatBonusesFromGear().patk;
    state.avatar.level = 40;
    const full = avatarStatBonusesFromGear().patk;
    assert.strictEqual(full, 100);
    assert.strictEqual(soft, 60);
    assert.strictEqual(hard, 20);
    delete WMAP.c_sword;
    global.iterEquippedGear = prevIter;
    global.avatarWeaponMasteryMult = prevM;
  });

  test("avatarLevelStatBonus scales with level", () => {
    const b1 = avatarLevelStatBonus(1);
    assert.deepStrictEqual(b1, { atk: 0, def: 0 });
    const b5 = avatarLevelStatBonus(5);
    assert.deepStrictEqual(b5, { atk: 4, def: 3 }); // floor(4*1.15), floor(4*0.85)
    const b10 = avatarLevelStatBonus(10);
    assert.deepStrictEqual(b10, { atk: 10, def: 7 }); // floor(9*1.15), floor(9*0.85)
  });

  test("classStatBonus picks correct archetype", () => {
    assert.deepStrictEqual(classStatBonus("fighter"), CLASS_STAT_BONUS.fighter);
    assert.deepStrictEqual(classStatBonus("mystic"), CLASS_STAT_BONUS.mystic);
    assert.deepStrictEqual(classStatBonus("shaman"), CLASS_STAT_BONUS.mystic);
    assert.deepStrictEqual(classStatBonus("unknown"), CLASS_STAT_BONUS.fighter);
  });

  test("avatarStats sums race, class and level bonuses", () => {
    state.avatar = { raceId: "human", classId: "fighter", level: 1, gear: { weapon: null } };
    const s = avatarStats();
    assert.strictEqual(s.patk, 23); // 19 + 4 + 0
    assert.strictEqual(s.pdef, 22); // 19 + 3 + 0
    assert.strictEqual(s.matk, 16);
    assert.strictEqual(s.mdef, 19);
    assert.strictEqual(s.farmBonus, 0);
  });

  test("avatarStats: orc farm damage %, dwarf no mine flat, elf fighter no matk racial", () => {
    state.avatar = { raceId: "orc", classId: "fighter", level: 1, gear: { weapon: null } };
    assert.strictEqual(avatarStats().farmBonus, 0);
    assert.strictEqual(passiveEffectMult("farmDamageMult", state.avatar), 1.03);
    state.avatar = { raceId: "dwarf", classId: "fighter", level: 1, gear: { weapon: null } };
    assert.strictEqual(avatarStats().farmBonus, 0);
    state.avatar = { raceId: "elf", classId: "fighter", level: 1, gear: { weapon: null } };
    const lb = avatarLevelStatBonus(1);
    const cls = classStatBonus("fighter");
    // Воин-эльф: Лезвие рощи (+3% урон), не Песнь леса (MATK)
    const expected = RACE_BASE_STATS.elf.matk + cls.matk + lb.atk;
    assert.strictEqual(avatarStats().matk, expected);
    assert.strictEqual(passiveEffectMult("farmDamageMult", state.avatar), 1.03);
    assert.ok(passiveSkillIdsGrantedToAvatar(state.avatar).indexOf("elf_blade") >= 0);
    assert.ok(passiveSkillIdsGrantedToAvatar(state.avatar).indexOf("elf_song") < 0);
  });

  test("elf mystic gets song, not blade", () => {
    const a = { raceId: "elf", classId: "mystic", level: 1, created: true };
    const ids = passiveSkillIdsGrantedToAvatar(a);
    assert.ok(ids.indexOf("elf_glade") >= 0);
    assert.ok(ids.indexOf("elf_song") >= 0);
    assert.ok(ids.indexOf("elf_blade") < 0);
    assert.strictEqual(passiveEffectMult("farmDamageMult", a), 1.03);
  });

  test("elf scout / knight / ranger: fighter racials only", () => {
    ["elven_scout", "elven_knight", "silver_ranger", "plainswalker"].forEach((pid) => {
      const a = {
        created: true,
        raceId: "elf",
        classId: "fighter",
        level: 40,
        professionId: pid,
        professionTier: pid === "elven_scout" || pid === "elven_knight" ? 1 : 2,
      };
      const ids = passiveSkillIdsGrantedToAvatar(a);
      assert.ok(ids.indexOf("elf_blade") >= 0, pid + " should have elf_blade");
      assert.ok(ids.indexOf("elf_song") < 0, pid + " must not have elf_song");
      assert.ok(ids.indexOf("elf_glade") >= 0, pid + " should have elf_glade");
    });
  });

  test("passiveEffectMult: race handwriting numbers", () => {
    assert.strictEqual(passiveEffectMult("farmAdenaMult", "human"), 1.03);
    assert.strictEqual(passiveEffectMult("normalAdenaMult", "elf"), 1.06);
    assert.strictEqual(passiveEffectMult("goldenAdenaMult", "dark_elf"), 1.1);
    assert.strictEqual(passiveEffectMult("normalAdenaMult", "dark_elf"), 0.96);
    assert.strictEqual(passiveEffectMult("mineXpMult", "dwarf"), 1.12);
    assert.strictEqual(passiveEffectMult("offlineIncomeMult", "dwarf"), 1.08);
    assert.strictEqual(passiveEffectSum("enchantChanceAdd", "dwarf"), 0.004);
    assert.strictEqual(passiveEffectSum("enchantChanceAdd", "human"), 0);
    assert.strictEqual(passiveEffectSum("zoneRaceBonusFloor", "human"), 0.04);
    assert.strictEqual(passiveEffectSum("farmBonus", "orc"), 0);
    assert.strictEqual(passiveEffectMult("farmDamageMult", "orc"), 1.03);
  });

  test("avatarIsMystic reflects classId", () => {
    state.avatar = { classId: "mystic" };
    assert.strictEqual(avatarIsMystic(), true);
    state.avatar = { classId: "fighter" };
    assert.strictEqual(avatarIsMystic(), false);
  });

  test("avatarFarmPower is positive for fresh avatar", () => {
    state.avatar = { raceId: "human", classId: "fighter", level: 1, gear: { weapon: null } };
    const p = avatarFarmPower();
    assert.ok(p > 0, "power should be positive, got " + p);
  });

  test("mineWeaponDamageScale grows with chapter", () => {
    const s1 = mineWeaponDamageScale(1);
    const s2 = mineWeaponDamageScale(2);
    assert.ok(s2 > s1, "chapter 2 scale > chapter 1");
  });

  test("mineHitsToKill scales with chapter and respects minimum", () => {
    state.farmZone = "banana_mine";
    state.avatar = { raceId: "human", classId: "fighter", level: 1, gear: { weapon: null } };
    const h1 = mineHitsToKill("normal", "banana_mine");
    const h2 = mineHitsToKill("normal", "elven_ruins");
    assert.ok(h1 >= 4, "normal hits >= 4");
    assert.ok(h2 >= h1, "chapter 2 hits >= chapter 1 hits");
    const g1 = mineHitsToKill("golden", "banana_mine");
    assert.ok(g1 >= 8, "golden hits >= 8");
    // underpower больше не раздувает бюджет hits — TTK идёт через урон игрока
    state.avatar.level = 1;
    assert.strictEqual(mineHitsToKill("normal", "banana_mine"), h1);
  });

  test("mineMobMaxHp is positive and scales with chapter", () => {
    state.avatar = { raceId: "human", classId: "fighter", level: 1, gear: { weapon: null } };
    state.farmZone = "banana_mine";
    const hp1 = mineMobMaxHp("normal", "banana_mine");
    state.farmZone = "elven_ruins";
    const hp2 = mineMobMaxHp("normal", "elven_ruins");
    assert.ok(hp1 > 0, "chapter 1 hp positive");
    assert.ok(hp2 > hp1, "chapter 2 hp > chapter 1 hp");
  });

  test("mineMobMaxHp anchors to zone targetPower, not player gear", () => {
    state.farmZone = "banana_mine";
    state.avatar = { raceId: "human", classId: "fighter", level: 1, gear: { weapon: null } };
    global.iterEquippedGear = () => [];
    const hpBare = mineMobMaxHp("normal", "banana_mine");
    const dmgBare = avatarMineClickDamage();
    WMAP.cal_sword = {
      id: "cal_sword",
      grade: "D",
      patk: 80,
      matk: 20,
      ps: 4,
      ms: 3,
      cat: "Sword",
      weaponKind: "physical",
    };
    state.avatar.gear.weapon = { id: "cal_sword", plus: 6, kind: "weapon" };
    global.iterEquippedGear = () => [{ slot: "weapon", item: state.avatar.gear.weapon }];
    const hpGeared = mineMobMaxHp("normal", "banana_mine");
    const dmgGeared = avatarMineClickDamage();
    assert.strictEqual(hpGeared, hpBare, "mob HP independent of player weapon");
    assert.ok(dmgGeared > dmgBare, "player damage still grows with gear");
    delete WMAP.cal_sword;
    global.iterEquippedGear = () => [];
  });

  test("mineZoneRefClickDamage grows with targetPower", () => {
    const r1 = mineZoneRefClickDamage("banana_mine");
    const r2 = mineZoneRefClickDamage("elven_ruins");
    assert.ok(r1 >= 4, "ref dmg >= 4");
    assert.ok(r2 > r1, "higher targetPower → higher ref dmg");
  });

  test("expectedFarmPowerAtLevel grows with level", () => {
    const p1 = expectedFarmPowerAtLevel(1);
    const p5 = expectedFarmPowerAtLevel(5);
    assert.ok(p5 > p1, "level 5 power > level 1");
  });

  test("farmZoneTargetPower matches zone data", () => {
    const t = farmZoneTargetPower(farmZoneById("banana_mine"));
    assert.strictEqual(t, 62);
  });

  console.log("\n--- enchant balance ---");

  test("scrollFor returns correct behavior and tier", () => {
    const regular = scrollFor("D", "regular");
    assert.strictEqual(regular.behavior, "break");
    assert.strictEqual(regular.tier, 1);
    const blessed = scrollFor("D", "blessed");
    assert.strictEqual(blessed.behavior, "reset");
    assert.strictEqual(blessed.tier, 2);
    const destruction = scrollFor("D", "destruction");
    assert.strictEqual(destruction.behavior, "destruction");
    assert.strictEqual(destruction.tier, 3);
    const crystal = scrollFor("D", "crystal");
    assert.strictEqual(crystal.behavior, "guarantee");
    assert.strictEqual(crystal.tier, 4);
  });

  test("scrollFor costs scale with grade and type", () => {
    const d = scrollFor("D", "regular");
    const c = scrollFor("C", "regular");
    assert.ok(c.cost > d.cost, "C regular cost > D regular cost");
    const blessedD = scrollFor("D", "blessed");
    assert.ok(blessedD.cost > d.cost, "blessed D cost > regular D cost");
    const crystalD = scrollFor("D", "crystal");
    assert.ok(crystalD.cost > blessedD.cost, "crystal D cost > blessed D cost");
  });

  test("successChance is 1 for safe levels and guarantee", () => {
    assert.strictEqual(successChance(0, "regular"), 1);
    assert.strictEqual(successChance(SAFE_LEVEL - 1, "regular"), 1);
    assert.strictEqual(successChance(15, "guarantee"), 1);
    assert.strictEqual(successChance(0, "destruction"), 1);
  });

  test("successChance respects minimum cap at high plus", () => {
    const ch = successChance(30, "regular");
    const min = tune("ench.chanceMin", 0.12);
    assert.ok(ch >= min - 1e-9, "high plus chance >= min cap");
  });

  console.log("\n--- sell economy ---");

  test("sellValue at +4 covers ~2.7x cost of 4 regular scrolls", () => {
    for (const g of ["D", "C", "B", "A"]) {
      const scrollCost = 4 * scrollFor(g, "regular").cost;
      const sell = sellValue({ grade: g, name: "test" }, 4);
      assert.ok(sell >= scrollCost * 2.5, g + "+4 sell " + sell + " should be >= 2.5x scrolls " + scrollCost);
      assert.ok(sell <= scrollCost * 2.9, g + "+4 sell " + sell + " should be <= 2.9x scrolls " + scrollCost);
    }
  });

  test("sellValue grows with plus", () => {
    const w = { grade: "D", name: "test" };
    assert.ok(sellValue(w, 8) > sellValue(w, 4));
    assert.ok(sellValue(w, 12) > sellValue(w, 8));
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
