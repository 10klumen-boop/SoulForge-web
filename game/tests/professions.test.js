// ===== Unit-тесты: профессии, shaman kit, class passives, armor affinity =====
const assert = require("assert");
const { loadScripts, loadGameJsonDataSync } = require("./setup");

loadGameJsonDataSync();

global.ProgressStore = {
  set(key, val) {
    state[key] = val;
  },
  update(key, fn) {
    state[key] = fn(state[key]);
  },
};
global.save = () => {};
global.toast = () => {};
global.gameLog = () => {};
global.renderAvatarScreen = () => {};
global.renderAvatarHub = () => {};
global.renderMenu = () => {};
global.renderAvatarSkillsPanel = () => {};
global.renderCharacterRoster = () => {};
global.isMysticArchetype = (classId) => classId === "mystic" || classId === "shaman";

global.state = {
  avatar: {
    created: true,
    raceId: "human",
    classId: "fighter",
    level: 10,
    professionId: null,
    professionTier: 0,
    gear: {},
  },
};

loadScripts([
  "src/data/combat-skills-data.js",
  "src/data/combat-skills-kits-data.js",
  "src/data/professions-data.js",
  "src/passive-skills-core.js",
  "src/professions-core.js",
  "src/combat-skills-core.js",
]);

function test(name, fn) {
  try {
    fn();
    console.log("  ok  " + name);
  } catch (e) {
    console.error("  FAIL  " + name);
    throw e;
  }
}

console.log("professions.test.js");

test("shaman has dedicated combat kit", () => {
  const shaman = combatSkillsForClass("shaman");
  const mystic = combatSkillsForClass("mystic");
  assert.ok(shaman.length >= 4);
  assert.notStrictEqual(shaman[0].id, mystic[0].id);
  assert.strictEqual(shaman[0].id, "totem_strike");
});

test("CLASS_PASSIVE_SKILL_IDS filled for starters", () => {
  assert.ok(CLASS_PASSIVE_SKILL_IDS.fighter.length >= 1);
  assert.ok(CLASS_PASSIVE_SKILL_IDS.mystic.length >= 1);
  assert.ok(CLASS_PASSIVE_SKILL_IDS.shaman.length >= 1);
});

test("class passives grant at level", () => {
  const a = { raceId: "human", classId: "fighter", level: 1, created: true };
  const ids = passiveSkillIdsGrantedToAvatar(a);
  assert.ok(ids.indexOf("fighter_heavy_armor") >= 0);
  assert.ok(ids.indexOf("fighter_weapon_mastery") >= 0);
  assert.ok(ids.indexOf("fighter_blade") < 0, "старые novice-пассивки сняты с T0");
  assert.ok(ids.indexOf("fighter_guard") < 0);
  assert.ok(ids.indexOf("human_steady") >= 0);
  const skills = passiveSkillsForAvatar(a);
  assert.ok(skills.some((s) => s.id === "fighter_heavy_armor"));
});

test("starter armor pref", () => {
  assert.strictEqual(professionArmorPref({ classId: "fighter" }), "heavy");
  assert.strictEqual(professionArmorPref({ classId: "mystic" }), "robe");
  assert.strictEqual(professionArmorPref({ classId: "shaman" }), "robe");
});

test("human fighter 1st choices at lvl 10", () => {
  state.avatar = {
    created: true,
    raceId: "human",
    classId: "fighter",
    level: 10,
    professionId: null,
    professionTier: 0,
  };
  const choices = availableProfessionChoices(state.avatar);
  const ids = choices.map((c) => c.id).sort();
  assert.deepStrictEqual(ids, ["knight", "rogue", "warrior"]);
});

test("no 1st choice below level 10", () => {
  state.avatar.level = 9;
  assert.strictEqual(availableProfessionChoices(state.avatar).length, 0);
});

test("choose warrior then 2nd gladiator/warlord", () => {
  state.avatar.level = 10;
  assert.ok(chooseProfession("warrior", { silent: true }));
  assert.strictEqual(state.avatar.professionId, "warrior");
  assert.strictEqual(state.avatar.professionTier, 1);
  state.avatar.level = 40;
  const second = availableProfessionChoices(state.avatar).map((c) => c.id).sort();
  assert.deepStrictEqual(second, ["gladiator", "warlord"]);
  assert.ok(chooseProfession("gladiator", { silent: true }));
  assert.strictEqual(state.avatar.professionId, "gladiator");
  assert.strictEqual(state.avatar.professionTier, 2);
  assert.strictEqual(availableProfessionChoices(state.avatar).length, 0);
});

test("no 2nd profession below level 40", () => {
  state.avatar = {
    created: true,
    raceId: "human",
    classId: "fighter",
    level: 20,
    professionId: "warrior",
    professionTier: 1,
  };
  assert.strictEqual(availableProfessionChoices(state.avatar).length, 0);
  state.avatar.level = 39;
  assert.strictEqual(availableProfessionChoices(state.avatar).length, 0);
  state.avatar.level = 40;
  assert.ok(availableProfessionChoices(state.avatar).length >= 1);
});

test("grade unlock D@10 C@40", () => {
  assert.strictEqual(avatarAllowedGrade(1), "NG");
  assert.strictEqual(avatarAllowedGrade(9), "NG");
  assert.strictEqual(avatarAllowedGrade(10), "D");
  assert.strictEqual(avatarAllowedGrade(39), "D");
  assert.strictEqual(avatarAllowedGrade(40), "C");
  assert.ok(isGradeOverLevel("D", 9));
  assert.ok(!isGradeOverLevel("D", 10));
  assert.ok(isGradeOverLevel("C", 10));
  assert.ok(!isGradeOverLevel("C", 40));
});

test("grade penalty scales with rank gap", () => {
  // NG allowed: D +1 → 0.60, C +2 → 0.20, B+ → floor 0.1
  assert.strictEqual(avatarGradePenaltyMult("D", 1), 0.6);
  assert.strictEqual(avatarGradePenaltyMult("C", 1), 0.2);
  assert.strictEqual(avatarGradePenaltyMult("B", 1), GRADE_OVERLEVEL_FLOOR);
  assert.strictEqual(avatarGradePenaltyMult("A", 1), GRADE_OVERLEVEL_FLOOR);
  // D allowed (lv10): C +1 → 0.60, B +2 → 0.20
  assert.strictEqual(avatarGradePenaltyMult("C", 10), 0.6);
  assert.strictEqual(avatarGradePenaltyMult("B", 10), 0.2);
  assert.strictEqual(avatarGradePenaltyMult("C", 40), 1);
  assert.strictEqual(gradeOverLevelGap("C", 10), 1);
  assert.strictEqual(gradeOverLevelGap("C", 40), 0);
});

test("weapon mastery by role cats", () => {
  const fighter = { classId: "fighter", professionId: null };
  assert.ok(avatarWeaponMasteryActive({ cat: "Sword" }, fighter));
  assert.strictEqual(avatarWeaponMasteryMult({ cat: "Sword" }, fighter), WEAPON_MASTERY_MULT);
  assert.ok(!avatarWeaponMasteryActive({ cat: "Bow" }, fighter), "стартовый воин без mastery на лук");
  const hawkeye = { classId: "fighter", professionId: "hawkeye", professionTier: 2 };
  assert.ok(professionWeaponCats(hawkeye).indexOf("Bow") >= 0);
  assert.ok(avatarWeaponMasteryActive({ cat: "Bow" }, hawkeye));
  const mage = { classId: "mystic", professionId: "wizard", professionTier: 1 };
  // wizard: Blunt + MagicalSword (меч с маг. сродством)
  assert.ok(professionWeaponCats(mage).indexOf("Blunt") >= 0);
  assert.ok(
    professionWeaponCats(mage).indexOf("MagicalSword") >= 0 ||
      professionWeaponCats(mage).indexOf("Sword") >= 0
  );
  assert.ok(avatarWeaponMasteryActive({ cat: "Blunt" }, mage));
  assert.ok(avatarWeaponMasteryActive({ cat: "Sword", weaponKind: "magical" }, mage));
  assert.ok(!avatarWeaponMasteryActive({ cat: "Sword", weaponKind: "physical" }, mage));
  assert.ok(!avatarWeaponMasteryActive({ cat: "Bow" }, mage));
});

test("overgrade hint includes weapon-only overgrade", () => {
  global.state = {
    avatar: {
      created: true,
      classId: "mystic",
      level: 10,
      raceId: "human",
      gear: {
        weapon: { kind: "weapon", id: "dummy_c", grade: "C" },
      },
    },
  };
  global.iterEquippedGear = () => [
    { slot: "weapon", item: state.avatar.gear.weapon },
  ];
  global.avatarGearItemDef = (it) => (it ? { grade: it.grade, name: "C sword" } : null);
  assert.ok(avatarHasOvergradeGear(state.avatar));
  const line = gradePenaltyHintLine(state.avatar);
  assert.ok(/штраф грейда/i.test(line));
  assert.ok(!/оружие без штрафа|оружие свободно/i.test(line));
});

test("weapon grade penalty halves fighter power when overgrade", () => {
  assert.strictEqual(weaponGradePowerMult({ grade: "C" }, 10), 0.6);
  assert.strictEqual(weaponGradePowerMult({ grade: "C" }, 1), 0.2);
  assert.strictEqual(weaponGradePowerMult({ grade: "C" }, 40), 1);
  assert.strictEqual(weaponGradePowerMult({ grade: "D" }, 9), 0.6);
  assert.strictEqual(weaponGradePowerMult({ grade: "D" }, 10), 1);
});

test("2nd profession passives replace 1st (only leaf)", () => {
  const a = {
    raceId: "human",
    classId: "fighter",
    level: 40,
    professionId: "gladiator",
    professionTier: 2,
    created: true,
  };
  const ids = passiveSkillIdsGrantedToAvatar(a);
  assert.ok(ids.indexOf("prof_gladiator") >= 0);
  assert.ok(ids.indexOf("prof_warrior") < 0);
});

test("skill overlay on gladiator", () => {
  state.avatar = {
    created: true,
    raceId: "human",
    classId: "fighter",
    level: 40,
    professionId: "gladiator",
    professionTier: 2,
  };
  const skills = combatSkillsForAvatar();
  assert.ok(skills.some((s) => s.id === "gladiator_r"));
  assert.ok(!skills.some((s) => s.id === "power_strike"));
  assert.ok(!skills.some((s) => s.id === "blood_rage"));
  assert.ok(!PROFESSIONS.gladiator.skillOverlay);
});

test("destroyer prefers TwoHandSword", () => {
  assert.deepStrictEqual(professionWeaponCats({ professionId: "destroyer", classId: "fighter" }), ["TwoHandSword"]);
});

test("T2 unique passives from kits (not generics)", () => {
  assert.deepStrictEqual(PROFESSIONS.swordsinger.passiveIds, ["prof_swordsinger"]);
  assert.deepStrictEqual(PROFESSIONS.destroyer.passiveIds, ["prof_destroyer"]);
  assert.ok(PASSIVE_SKILLS.prof_hawkeye.effects.some((e) => e.type === "arrowCostMult"));
  assert.ok(PASSIVE_SKILLS.prof_warsmith.effects.some((e) => e.type === "materialsMult"));
  assert.ok(PASSIVE_SKILLS.prof_bladedancer.effects.some((e) => e.type === "skillCdMult"));
});

test("T1 unique passives — no prof_generic leftovers", () => {
  Object.values(PROFESSIONS).forEach((p) => {
    (p.passiveIds || []).forEach((id) => {
      assert.ok(!String(id).startsWith("prof_generic_"), p.id + " still uses " + id);
      assert.ok(PASSIVE_SKILLS[id], "missing passive " + id + " for " + p.id);
    });
  });
  assert.deepStrictEqual(PROFESSIONS.dark_wizard.passiveIds, ["prof_dark_wizard"]);
  assert.strictEqual(PASSIVE_SKILLS.prof_dark_wizard.name, "Каркас тёмного мага");
  assert.ok(PASSIVE_SKILLS.prof_dark_wizard.icon.indexOf("class-skills/dark_wizard_passive") >= 0);
  assert.ok(!PASSIVE_SKILLS.prof_generic_1st_mage);
});

test("gear affinity: weaponCats and armorPref from planner", () => {
  assert.deepStrictEqual(PROFESSIONS.gladiator.weaponCats, ["Dualsword"]);
  assert.deepStrictEqual(PROFESSIONS.destroyer.weaponCats, ["TwoHandSword"]);
  assert.strictEqual(PROFESSIONS.bladedancer.armorPref, "light");
  assert.deepStrictEqual(PROFESSIONS.hawkeye.weaponCats, ["Bow"]);
  assert.ok(!PROFESSIONS.rogue.weaponCats.includes("Bow"));
  assert.ok(PROFESSIONS.elven_scout.weaponCats.includes("Bow"));
  assert.ok(PROFESSIONS.elven_scout.weaponCats.includes("Dagger"));
});

test("elven scout gets bow mastery passive", () => {
  const a = {
    created: true,
    raceId: "elf",
    classId: "fighter",
    level: 10,
    professionId: "elven_scout",
    professionTier: 1,
  };
  const ids = passiveSkillIdsGrantedToAvatar(a);
  assert.ok(ids.indexOf("weapon_mastery_bow") >= 0);
  assert.ok(ids.indexOf("weapon_mastery_dagger") >= 0);
  assert.ok(ids.indexOf("prof_elven_scout") >= 0);
});

test("weapon mastery passives granted per profession cats", () => {
  const a = {
    created: true,
    raceId: "human",
    classId: "fighter",
    level: 40,
    professionId: "hawkeye",
    professionTier: 2,
  };
  const ids = passiveSkillIdsGrantedToAvatar(a);
  assert.ok(ids.indexOf("weapon_mastery_bow") >= 0);
  assert.ok(ids.indexOf("fighter_weapon_mastery") < 0);
  assert.ok(ids.indexOf("fighter_light_armor") >= 0);
  assert.ok(ids.indexOf("fighter_blade") < 0, "новичок уходит после профессии");
  assert.ok(ids.indexOf("fighter_guard") < 0);
  assert.ok(PASSIVE_SKILLS.weapon_mastery_bow.icon.indexOf("class-skills/") >= 0);
  assert.ok(PASSIVE_SKILLS.fighter_light_armor.icon.indexOf("class-skills/") >= 0);
});

test("bladedancer gets dualsword mastery, not novice passives", () => {
  const a = {
    created: true,
    raceId: "dark_elf",
    classId: "fighter",
    level: 40,
    professionId: "bladedancer",
    professionTier: 2,
  };
  const ids = passiveSkillIdsGrantedToAvatar(a);
  assert.ok(ids.indexOf("weapon_mastery_dualsword") >= 0);
  assert.ok(ids.indexOf("fighter_light_armor") >= 0);
  assert.ok(ids.indexOf("prof_bladedancer") >= 0);
  assert.ok(ids.indexOf("fighter_blade") < 0);
  assert.ok(ids.indexOf("fighter_guard") < 0);
  const skills = passiveSkillsForAvatar(a);
  assert.ok(skills.some((s) => s.id === "weapon_mastery_dualsword"));
});

test("passive descriptions use percent, not multipliers", () => {
  assert.strictEqual(formatPassiveEffectPct({ type: "farmAdenaMult", value: 1.05 }), "адена с фарма +5%");
  assert.strictEqual(formatPassiveEffectPct({ type: "skillCdMult", value: 0.92 }), "КД скиллов -8%");
  assert.ok(!/×/.test(convertMultiplierTextToPct("адена ×1.05, КД ×0.92.")));
  assert.ok(/\+5%/.test(convertMultiplierTextToPct("адена ×1.05.")));
  assert.ok(/−8%|\-8%/.test(convertMultiplierTextToPct("расход стрел ×0.92.")));
  const line = passiveSkillGameplayLine(PASSIVE_SKILLS.fighter_light_armor);
  assert.ok(/\+6%/.test(line));
  assert.ok(!/×/.test(line));
});

test("elf / dwarf / orc shaman trees exist", () => {
  state.avatar = {
    created: true,
    raceId: "elf",
    classId: "fighter",
    level: 10,
    professionId: null,
    professionTier: 0,
  };
  assert.ok(availableProfessionChoices(state.avatar).some((p) => p.id === "elven_knight"));

  state.avatar = {
    created: true,
    raceId: "dwarf",
    classId: "fighter",
    level: 10,
    professionId: null,
    professionTier: 0,
  };
  const dwarf = availableProfessionChoices(state.avatar).map((p) => p.id).sort();
  assert.deepStrictEqual(dwarf, ["artisan", "scavenger"]);

  state.avatar = {
    created: true,
    raceId: "orc",
    classId: "shaman",
    level: 10,
    professionId: null,
    professionTier: 0,
  };
  assert.deepStrictEqual(
    availableProfessionChoices(state.avatar).map((p) => p.id),
    ["orc_shaman"]
  );
  chooseProfession("orc_shaman", { silent: true });
  state.avatar.level = 40;
  assert.deepStrictEqual(
    availableProfessionChoices(state.avatar).map((p) => p.id).sort(),
    ["overlord", "warcryer"]
  );
});

test("migrateAvatarProfessionFields clears unknown id", () => {
  const next = migrateAvatarProfessionFields({
    professionId: "nope",
    professionTier: 2,
  });
  assert.strictEqual(next.professionId, null);
  assert.strictEqual(next.professionTier, 0);
});

test("armor affinity active when kind matches", () => {
  global.ARMOR_SETS = {
    mithril: { id: "mithril", kind: "heavy", pieces: [] },
    manticore: { id: "manticore", kind: "light", pieces: [] },
  };
  global.isArmorItem = (it) => !!it && it.kind === "armor";
  global.armorItemDef = (it) => ({ setId: it.setId });
  const fiveHeavy = () =>
    Array.from({ length: 5 }, () => ({ item: { kind: "armor", setId: "mithril" } }));
  global.iterEquippedGear = fiveHeavy;
  const a = { classId: "fighter", professionId: null };
  assert.strictEqual(avatarEquippedArmorKind(), "heavy");
  assert.ok(avatarArmorAffinityActive(a));
  assert.strictEqual(avatarArmorAffinityMult(a), ARMOR_AFFINITY_MULT);

  global.iterEquippedGear = () => [
    { item: { kind: "armor", setId: "mithril" } },
    { item: { kind: "armor", setId: "mithril" } },
  ];
  assert.strictEqual(avatarEquippedArmorKind(), null, "2/5 не достаточно");
  assert.ok(!avatarArmorAffinityActive(a));

  global.iterEquippedGear = () => [
    { item: { kind: "armor", setId: "mithril" } },
  ];
  assert.strictEqual(avatarEquippedArmorKind(), null);
  assert.ok(!avatarArmorAffinityActive(a));
});

test("rogue / hawkeye prefer light armor", () => {
  assert.strictEqual(PROFESSIONS.rogue.armorPref, "light");
  assert.strictEqual(PROFESSIONS.hawkeye.armorPref, "light");
  assert.strictEqual(PROFESSIONS.silver_ranger.armorPref, "light");
  assert.strictEqual(PROFESSIONS.phantom_ranger.armorPref, "light");
  assert.strictEqual(
    professionArmorPref({ classId: "fighter", professionId: "rogue", professionTier: 1 }),
    "light"
  );
  assert.strictEqual(
    professionArmorPref({ classId: "fighter", professionId: "hawkeye", professionTier: 2 }),
    "light"
  );
  global.ARMOR_SETS = {
    manticore: { id: "manticore", kind: "light", pieces: [] },
    mithril: { id: "mithril", kind: "heavy", pieces: [] },
  };
  global.isArmorItem = (it) => !!it && it.kind === "armor";
  global.armorItemDef = (it) => ({ setId: it.setId });
  global.iterEquippedGear = () =>
    Array.from({ length: 5 }, () => ({ item: { kind: "armor", setId: "manticore" } }));
  const rogue = { classId: "fighter", professionId: "rogue", professionTier: 1 };
  assert.ok(avatarArmorAffinityActive(rogue));
  global.iterEquippedGear = () =>
    Array.from({ length: 5 }, () => ({ item: { kind: "armor", setId: "mithril" } }));
  assert.ok(!avatarArmorAffinityActive(rogue));
  const ids = passiveSkillIdsGrantedToAvatar({
    raceId: "human",
    classId: "fighter",
    level: 10,
    professionId: "rogue",
    professionTier: 1,
    created: true,
  });
  assert.ok(ids.indexOf("fighter_light_armor") >= 0);
  assert.ok(ids.indexOf("fighter_heavy_armor") < 0);
});

test("human mystic wizard→sorcerer path", () => {
  state.avatar = {
    created: true,
    raceId: "human",
    classId: "mystic",
    level: 10,
    professionId: null,
    professionTier: 0,
  };
  const first = availableProfessionChoices(state.avatar).map((p) => p.id).sort();
  assert.deepStrictEqual(first, ["cleric", "wizard"]);
  chooseProfession("wizard", { silent: true });
  state.avatar.level = 40;
  const second = availableProfessionChoices(state.avatar).map((p) => p.id).sort();
  assert.deepStrictEqual(second, ["necromancer", "sorcerer", "warlock"]);
});

test("profession preview ids for create UI", () => {
  const ids = professionPreviewIds("human", "fighter");
  assert.ok(ids.indexOf("warrior") >= 0);
  assert.ok(ids.indexOf("knight") >= 0);
});

console.log("All professions tests passed.");
