// ===== Профессии (мягкий ladder 1st/2nd поверх starter classId) =====
// Имена — Interlude RU; механика упрощена под SoulForge.

const PROFESSION_TIER_LEVELS = { 1: 10, 2: 40 };

/** Soft affinity: стартовый класс → предпочтительный kind брони. */
const STARTER_ARMOR_PREF = {
  fighter: "heavy",
  mystic: "robe",
  shaman: "robe",
};

const ROLE_ARMOR_PREF = {
  tank: "heavy",
  melee: "heavy",
  dagger: "light",
  archer: "light",
  mage: "robe",
  support: "robe",
  craft: "light",
};

/** Предпочтительные категории оружия (weapons-data cat) по роли. */
const ROLE_WEAPON_CATS = {
  tank: ["Sword", "Blunt"],
  melee: ["Sword", "Dualsword", "Polearm", "Blunt", "Dualblunt", "Fist"],
  dagger: ["Dagger", "Dualdagger"],
  archer: ["Bow"],
  mage: ["Blunt", "Sword"],
  support: ["Blunt", "Sword"],
  craft: ["Blunt", "Sword", "Polearm", "Dualsword"],
};

const STARTER_WEAPON_CATS = {
  fighter: ["Sword", "Dualsword", "Polearm", "Blunt", "Dualblunt", "Fist", "Dagger", "Dualdagger", "Bow"],
  mystic: ["Blunt", "Sword"],
  shaman: ["Blunt"],
};

/** Множитель урона/DEF при совпадении armorPref (≥2 куска нужного kind). */
const ARMOR_AFFINITY_MULT = 1.06;

/** Бонус силы оружия при совпадении категории с классом/ролью. */
const WEAPON_MASTERY_MULT = 1.06;

/**
 * Грейд экипа по уровню (можно носить без штрафа):
 * <20 — только NG; ≥20 — D; ≥40 — C.
 */
const GRADE_UNLOCK_LEVEL = { NG: 1, D: 20, C: 40 };
const GRADE_RANK = { NG: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
/** Множитель статов куска/оружия выше дозволенного грейда. */
const GRADE_OVERLEVEL_MULT = 0.5;

const ARMOR_KIND_LABELS = {
  heavy: "тяжёлая",
  light: "лёгкая",
  robe: "роба",
};

const WEAPON_CAT_LABELS = {
  Sword: "меч",
  Dualsword: "парные клинки",
  Polearm: "древковое",
  Blunt: "дубина/жезл",
  Dualblunt: "парное дробящее",
  Fist: "кастеты",
  Dagger: "кинжал",
  Dualdagger: "парные кинжалы",
  Bow: "лук",
};

/**
 * @typedef {object} ProfessionDef
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {1|2} tier
 * @property {string} baseClass fighter|mystic|shaman
 * @property {string[]} races
 * @property {string[]|null} from null = 1st от starter; иначе id 1st-профессий
 * @property {string} role
 * @property {string} [armorPref]
 * @property {string[]} [passiveIds]
 * @property {Array<{replaceId?:string,replaceHotkey?:string,skill:object}>} [skillOverlay]
 * @property {string} [icon]
 */

function _prof(p) {
  if (!p.armorPref && p.role && ROLE_ARMOR_PREF[p.role]) p.armorPref = ROLE_ARMOR_PREF[p.role];
  if (!p.icon) {
    const mark = PROFESSION_MARK_ICONS[p.id];
    if (mark) p.icon = mark;
    else if (p.baseClass === "mystic" || p.baseClass === "shaman") p.icon = "icons/class_mystic.png?v=3";
    else p.icon = "icons/class_fighter.png?v=3";
  }
  return p;
}

/** Характерные skill-иконки профессий (masterwork.wiki → 256). */
const PROFESSION_MARK_ICONS = {
  warrior: "icons/skill0003.png?v=3",
  knight: "icons/skill0028.png?v=3",
  rogue: "icons/skill0016.png?v=3",
  gladiator: "icons/skill0005.png?v=3",
  warlord: "icons/skill0048.png?v=3",
  paladin: "icons/skill1126.png?v=3",
  dark_avenger: "icons/skill0092.png?v=3",
  treasure_hunter: "icons/skill0016.png?v=3",
  hawkeye: "icons/skill0019.png?v=3",
  wizard: "icons/skill1184.png?v=3",
  cleric: "icons/skill1011.png?v=3",
  sorcerer: "icons/skill1230.png?v=3",
  necromancer: "icons/skill1148.png?v=3",
  warlock: "icons/skill1128.png?v=3",
  bishop: "icons/skill1218.png?v=3",
  prophet: "icons/skill1204.png?v=3",
  elven_knight: "icons/skill0028.png?v=3",
  elven_scout: "icons/skill0019.png?v=3",
  temple_knight: "icons/skill1126.png?v=3",
  swordsinger: "icons/skill0142.png?v=3",
  plainswalker: "icons/skill0016.png?v=3",
  silver_ranger: "icons/skill0019.png?v=3",
  elven_wizard: "icons/skill1235.png?v=3",
  oracle: "icons/skill1011.png?v=3",
  spellsinger: "icons/skill1235.png?v=3",
  elemental_summoner: "icons/skill1128.png?v=3",
  elder: "icons/skill1218.png?v=3",
  palus_knight: "icons/skill0028.png?v=3",
  assassin: "icons/skill0016.png?v=3",
  shillien_knight: "icons/skill0092.png?v=3",
  bladedancer: "icons/skill0142.png?v=3",
  abyss_walker: "icons/skill0016.png?v=3",
  phantom_ranger: "icons/skill0019.png?v=3",
  dark_wizard: "icons/skill1148.png?v=3",
  shillien_oracle: "icons/skill1011.png?v=3",
  spellhowler: "icons/skill1235.png?v=3",
  phantom_summoner: "icons/skill1128.png?v=3",
  shillien_elder: "icons/skill1218.png?v=3",
  orc_raider: "icons/skill0100.png?v=3",
  orc_monk: "icons/skill0029.png?v=3",
  destroyer: "icons/skill0176.png?v=3",
  tyrant: "icons/skill0056.png?v=3",
  orc_shaman: "icons/skill1090.png?v=3",
  overlord: "icons/skill1101.png?v=3",
  warcryer: "icons/skill1258.png?v=3",
  scavenger: "icons/skill0254.png?v=3",
  artisan: "icons/skill0172.png?v=3",
  bounty_hunter: "icons/skill0254.png?v=3",
  warsmith: "icons/skill0172.png?v=3",
};

const PROFESSIONS = {};

function _reg(p) {
  PROFESSIONS[p.id] = _prof(p);
}

// —— Human fighter ——
_reg({
  id: "warrior", name: "Воин", tier: 1, baseClass: "fighter", races: ["human"], from: null,
  role: "melee", passiveIds: ["prof_warrior"],
  desc: "Путь двуручного клинка. Позже — Гладиатор или Полководец.",
});
_reg({
  id: "knight", name: "Рыцарь", tier: 1, baseClass: "fighter", races: ["human"], from: null,
  role: "tank", passiveIds: ["prof_knight"],
  desc: "Щит и клятва. Позже — Паладин или Мститель.",
});
_reg({
  id: "rogue", name: "Разбойник", tier: 1, baseClass: "fighter", races: ["human"], from: null,
  role: "dagger", armorPref: "light", passiveIds: ["prof_rogue"],
  desc: "Кинжал, тень и лёгкая броня. Позже — Искатель сокровищ или Стрелок.",
});
_reg({
  id: "gladiator", name: "Гладиатор", tier: 2, baseClass: "fighter", races: ["human"], from: ["warrior"],
  role: "melee", passiveIds: ["prof_gladiator"],
  desc: "Арена и ярость двуручника.",
  skillOverlay: [{
    replaceId: "blood_rage",
    skill: {
      id: "whirlwind",
      name: "Вихрь",
      icon: "icons/skill0008.png?v=2",
      desc: "9 сек: +95% урона от кликов.",
      effect: "damageBuff",
      duration: 9000,
      mult: 1.95,
      fxColor: "#ff7a40",
      cdMs: 17000,
    },
  }],
});
_reg({
  id: "warlord", name: "Полководец", tier: 2, baseClass: "fighter", races: ["human"], from: ["warrior"],
  role: "melee", passiveIds: ["prof_warlord"],
  desc: "Копьё и клич полка.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "polearm_sweep",
      name: "Размах копья",
      icon: "icons/skill0048.png?v=2",
      desc: "Шесть ударов по цели (45% каждый).",
      effect: "multiHit",
      hits: 6,
      mult: 0.45,
      fxColor: "#e8c070",
      cdMs: 10500,
    },
  }],
});
_reg({
  id: "paladin", name: "Паладин", tier: 2, baseClass: "fighter", races: ["human"], from: ["knight"],
  role: "tank", passiveIds: ["prof_paladin"],
  desc: "Свет и стойкость.",
  skillOverlay: [{
    replaceId: "iron_shell",
    skill: {
      id: "holy_armor",
      name: "Святой доспех",
      icon: "icons/skill1126.png?v=2",
      desc: "5 сек: таймер врага течёт вдвое медленнее.",
      effect: "timerSlow",
      duration: 5000,
      fxColor: "#f0e0a0",
      cdMs: 12500,
    },
  }],
});
_reg({
  id: "dark_avenger", name: "Мститель", tier: 2, baseClass: "fighter", races: ["human"], from: ["knight"],
  role: "tank", passiveIds: ["prof_dark_avenger"],
  desc: "Тёмная клятва и жажда добычи.",
  skillOverlay: [{
    replaceId: "power_strike",
    skill: {
      id: "vengeance_strike",
      name: "Удар возмездия",
      icon: "icons/skill1147.png?v=2",
      desc: "Следующий удар ×2.8.",
      effect: "nextHit",
      mult: 2.8,
      fxColor: "#a060c0",
      cdMs: 8000,
    },
  }],
});
_reg({
  id: "treasure_hunter", name: "Искатель сокровищ", tier: 2, baseClass: "fighter", races: ["human"], from: ["rogue"],
  role: "dagger", armorPref: "light", passiveIds: ["prof_treasure_hunter"],
  desc: "Кинжалы, лёгкая броня и полные карманы.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "backstab",
      name: "Удар в спину",
      icon: "icons/skill0016.png?v=2",
      desc: "Прямой удар ×3.2.",
      effect: "directHit",
      mult: 3.2,
      fxColor: "#90c070",
      cdMs: 10000,
    },
  }],
});
_reg({
  id: "hawkeye", name: "Стрелок", tier: 2, baseClass: "fighter", races: ["human"], from: ["rogue"],
  role: "archer", armorPref: "light", passiveIds: ["prof_hawkeye"],
  desc: "Лук, точный глаз и лёгкая броня.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "double_shot",
      name: "Двойной выстрел",
      icon: "icons/skill0019.png?v=2",
      desc: "Два залпа (×1.4 каждый).",
      effect: "multiHit",
      hits: 2,
      mult: 1.4,
      fxColor: "#70b0e0",
      cdMs: 10000,
    },
  }],
});

// —— Human mystic ——
_reg({
  id: "wizard", name: "Маг", tier: 1, baseClass: "mystic", races: ["human"], from: null,
  role: "mage", passiveIds: ["prof_wizard"],
  desc: "Школа стихий. Позже — Чародей, Некромант или Колдун.",
});
_reg({
  id: "cleric", name: "Клерик", tier: 1, baseClass: "mystic", races: ["human"], from: null,
  role: "support", passiveIds: ["prof_cleric"],
  desc: "Свет и поддержка. Позже — Епископ или Пророк.",
});
_reg({
  id: "sorcerer", name: "Чародей", tier: 2, baseClass: "mystic", races: ["human"], from: ["wizard"],
  role: "mage", passiveIds: ["prof_sorcerer"],
  desc: "Пламя и разрушение.",
  skillOverlay: [{
    replaceId: "soul_burst",
    skill: {
      id: "prominence",
      name: "Протуберанец",
      icon: "icons/skill1230.png?v=2",
      desc: "Магический залп ×3.4.",
      effect: "directHit",
      mult: 3.4,
      fxColor: "#ff7040",
      cdMs: 8500,
    },
  }],
});
_reg({
  id: "necromancer", name: "Некромант", tier: 2, baseClass: "mystic", races: ["human"], from: ["wizard"],
  role: "mage", passiveIds: ["prof_necromancer"],
  desc: "Смерть служит добыче.",
  skillOverlay: [{
    replaceId: "soul_drain",
    skill: {
      id: "death_spike",
      name: "Шип смерти",
      icon: "icons/skill1148.png?v=2",
      desc: "Удар ×2.5 и +3 сек к таймеру.",
      effect: "drainHit",
      mult: 2.5,
      healMs: 3000,
      fxColor: "#8050a0",
      cdMs: 15000,
    },
  }],
});
_reg({
  id: "warlock", name: "Колдун", tier: 2, baseClass: "mystic", races: ["human"], from: ["wizard"],
  role: "mage", passiveIds: ["prof_warlock"],
  desc: "Узы и призванные силы.",
  skillOverlay: [{
    replaceId: "arcane_focus",
    skill: {
      id: "summon_bond",
      name: "Узы призвания",
      icon: "icons/skill1128.png?v=2",
      desc: "8 сек: +85% урона от кликов.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.85,
      fxColor: "#a080ff",
      cdMs: 12000,
    },
  }],
});
_reg({
  id: "bishop", name: "Епископ", tier: 2, baseClass: "mystic", races: ["human"], from: ["cleric"],
  role: "support", passiveIds: ["prof_bishop"],
  desc: "Высшее благословение.",
  skillOverlay: [{
    replaceId: "soul_drain",
    skill: {
      id: "greater_heal_pulse",
      name: "Пульс исцеления",
      icon: "icons/skill1218.png?v=2",
      desc: "Удар ×1.8 и +5 сек к таймеру цели.",
      effect: "drainHit",
      mult: 1.8,
      healMs: 5000,
      fxColor: "#f0e8c0",
      cdMs: 15000,
    },
  }],
});
_reg({
  id: "prophet", name: "Пророк", tier: 2, baseClass: "mystic", races: ["human"], from: ["cleric"],
  role: "support", passiveIds: ["prof_prophet"],
  desc: "Песни силы для добычи.",
  skillOverlay: [{
    replaceId: "arcane_focus",
    skill: {
      id: "chant_of_battle",
      name: "Песнь битвы",
      icon: "icons/skill1204.png?v=2",
      desc: "8 сек: +90% урона от кликов.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.9,
      fxColor: "#e0c070",
      cdMs: 12000,
    },
  }],
});

// —— Elf fighter ——
_reg({
  id: "elven_knight", name: "Светлый рыцарь", tier: 1, baseClass: "fighter", races: ["elf"], from: null,
  role: "tank", passiveIds: ["prof_generic_1st_tank"],
  desc: "Щит Древа. Позже — Храмовый рыцарь или Певец меча.",
});
_reg({
  id: "elven_scout", name: "Разведчик", tier: 1, baseClass: "fighter", races: ["elf"], from: null,
  role: "dagger", armorPref: "light", passiveIds: ["prof_generic_1st_light"],
  desc: "Лёгкая броня, кинжал и лес. Позже — Следопыт или Серебряный рейнджер.",
});
_reg({
  id: "temple_knight", name: "Храмовый рыцарь", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_knight"],
  role: "tank", passiveIds: ["prof_generic_2nd_tank"],
  desc: "Страж храма Евы.",
  skillOverlay: [{
    replaceId: "iron_shell",
    skill: {
      id: "temple_guard",
      name: "Стража храма",
      icon: "icons/skill0279.png?v=2",
      desc: "5 сек: таймер замедлен.",
      effect: "timerSlow",
      duration: 5000,
      fxColor: "#a0e0b0",
      cdMs: 12500,
    },
  }],
});
_reg({
  id: "swordsinger", name: "Певец меча", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_knight"],
  role: "melee", passiveIds: ["prof_generic_2nd_melee"],
  desc: "Клинок под песнь леса.",
  skillOverlay: [{
    replaceId: "blood_rage",
    skill: {
      id: "sword_muse",
      name: "Муза клинка",
      icon: "icons/skill0176.png?v=2",
      desc: "8 сек: +90% урона.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.9,
      fxColor: "#80d0a0",
      cdMs: 17000,
    },
  }],
});
_reg({
  id: "plainswalker", name: "Следопыт", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_scout"],
  role: "dagger", armorPref: "light", passiveIds: ["prof_generic_2nd_light"],
  desc: "Тропы, кинжалы и лёгкая броня опушки.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "forest_strike",
      name: "Удар опушки",
      icon: "icons/skill0016.png?v=2",
      desc: "Прямой удар ×3.1.",
      effect: "directHit",
      mult: 3.1,
      fxColor: "#70c080",
      cdMs: 10000,
    },
  }],
});
_reg({
  id: "silver_ranger", name: "Серебряный рейнджер", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_scout"],
  role: "archer", armorPref: "light", passiveIds: ["prof_generic_2nd_light"],
  desc: "Серебряная стрела Евы · лёгкая броня.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "silver_arrow",
      name: "Серебряная стрела",
      icon: "icons/skill0019.png?v=2",
      desc: "Два залпа (×1.35).",
      effect: "multiHit",
      hits: 2,
      mult: 1.35,
      fxColor: "#c0e0ff",
      cdMs: 10000,
    },
  }],
});

// —— Elf mystic ——
_reg({
  id: "elven_wizard", name: "Светлый маг", tier: 1, baseClass: "mystic", races: ["elf"], from: null,
  role: "mage", passiveIds: ["prof_generic_1st_mage"],
  desc: "Магия воды и воздуха.",
});
_reg({
  id: "oracle", name: "Оракул", tier: 1, baseClass: "mystic", races: ["elf"], from: null,
  role: "support", passiveIds: ["prof_generic_1st_support"],
  desc: "Песни и исцеление леса.",
});
_reg({
  id: "spellsinger", name: "Певец заклинаний", tier: 2, baseClass: "mystic", races: ["elf"], from: ["elven_wizard"],
  role: "mage", passiveIds: ["prof_generic_2nd_mage"],
  desc: "Стихии в голосе.",
  skillOverlay: [{
    replaceId: "soul_burst",
    skill: {
      id: "hydro_blast",
      name: "Гидроудар",
      icon: "icons/skill1235.png?v=2",
      desc: "Залп ×3.3.",
      effect: "directHit",
      mult: 3.3,
      fxColor: "#60c0ff",
      cdMs: 8500,
    },
  }],
});
_reg({
  id: "elemental_summoner", name: "Призыватель стихий", tier: 2, baseClass: "mystic", races: ["elf"], from: ["elven_wizard"],
  role: "mage", passiveIds: ["prof_generic_2nd_mage"],
  desc: "Духи стихий на поле.",
  skillOverlay: [{
    replaceId: "arcane_focus",
    skill: {
      id: "elemental_bond",
      name: "Узы стихий",
      icon: "icons/skill1128.png?v=2",
      desc: "8 сек: +85% урона.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.85,
      fxColor: "#80e0c0",
      cdMs: 12000,
    },
  }],
});
_reg({
  id: "elder", name: "Старейшина", tier: 2, baseClass: "mystic", races: ["elf"], from: ["oracle"],
  role: "support", passiveIds: ["prof_generic_2nd_support"],
  desc: "Мудрость Древа.",
  skillOverlay: [{
    replaceId: "soul_drain",
    skill: {
      id: "elder_blessing",
      name: "Благословение старейшины",
      icon: "icons/skill1218.png?v=2",
      desc: "Удар ×1.9 и +4.5 сек к таймеру.",
      effect: "drainHit",
      mult: 1.9,
      healMs: 4500,
      fxColor: "#e0f0c0",
      cdMs: 15000,
    },
  }],
});

// —— Dark Elf fighter ——
_reg({
  id: "palus_knight", name: "Рыцарь Палуса", tier: 1, baseClass: "fighter", races: ["dark_elf"], from: null,
  role: "tank", passiveIds: ["prof_generic_1st_tank"],
  desc: "Тёмный щит. Позже — Рыцарь Шилен или Танцор клинка.",
});
_reg({
  id: "assassin", name: "Убийца", tier: 1, baseClass: "fighter", races: ["dark_elf"], from: null,
  role: "dagger", armorPref: "light", passiveIds: ["prof_generic_1st_light"],
  desc: "Тень Шилен и лёгкая броня. Позже — Странник бездны или Призрачный рейнджер.",
});
_reg({
  id: "shillien_knight", name: "Рыцарь Шилен", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["palus_knight"],
  role: "tank", passiveIds: ["prof_generic_2nd_tank"],
  desc: "Клятва богине тьмы.",
  skillOverlay: [{
    replaceId: "iron_shell",
    skill: {
      id: "shillien_guard",
      name: "Стража Шилен",
      icon: "icons/skill0279.png?v=2",
      desc: "5 сек: таймер замедлен.",
      effect: "timerSlow",
      duration: 5000,
      fxColor: "#9060c0",
      cdMs: 12500,
    },
  }],
});
_reg({
  id: "bladedancer", name: "Танцор клинка", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["palus_knight"],
  role: "melee", passiveIds: ["prof_generic_2nd_melee"],
  desc: "Танец смерти.",
  skillOverlay: [{
    replaceId: "blood_rage",
    skill: {
      id: "blade_dance",
      name: "Танец клинков",
      icon: "icons/skill0176.png?v=2",
      desc: "8 сек: +90% урона.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.9,
      fxColor: "#c060a0",
      cdMs: 17000,
    },
  }],
});
_reg({
  id: "abyss_walker", name: "Странник бездны", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["assassin"],
  role: "dagger", armorPref: "light", passiveIds: ["prof_generic_2nd_light"],
  desc: "Кинжалы бездны · лёгкая броня.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "abyss_stab",
      name: "Укол бездны",
      icon: "icons/skill0016.png?v=2",
      desc: "Прямой удар ×3.2.",
      effect: "directHit",
      mult: 3.2,
      fxColor: "#7050a0",
      cdMs: 10000,
    },
  }],
});
_reg({
  id: "phantom_ranger", name: "Призрачный рейнджер", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["assassin"],
  role: "archer", armorPref: "light", passiveIds: ["prof_generic_2nd_light"],
  desc: "Стрелы из мглы · лёгкая броня.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "phantom_shot",
      name: "Призрачный выстрел",
      icon: "icons/skill0019.png?v=2",
      desc: "Два залпа (×1.4).",
      effect: "multiHit",
      hits: 2,
      mult: 1.4,
      fxColor: "#a080c0",
      cdMs: 10000,
    },
  }],
});

// —— Dark Elf mystic ——
_reg({
  id: "dark_wizard", name: "Тёмный маг", tier: 1, baseClass: "mystic", races: ["dark_elf"], from: null,
  role: "mage", passiveIds: ["prof_generic_1st_mage"],
  desc: "Магия ветра и тьмы.",
});
_reg({
  id: "shillien_oracle", name: "Оракул Шилен", tier: 1, baseClass: "mystic", races: ["dark_elf"], from: null,
  role: "support", passiveIds: ["prof_generic_1st_support"],
  desc: "Молитвы тёмной богине.",
});
_reg({
  id: "spellhowler", name: "Заклинатель бури", tier: 2, baseClass: "mystic", races: ["dark_elf"], from: ["dark_wizard"],
  role: "mage", passiveIds: ["prof_generic_2nd_mage"],
  desc: "Буря на кончиках пальцев.",
  skillOverlay: [{
    replaceId: "soul_burst",
    skill: {
      id: "tempest",
      name: "Буря",
      icon: "icons/skill1235.png?v=2",
      desc: "Залп ×3.3.",
      effect: "directHit",
      mult: 3.3,
      fxColor: "#8060ff",
      cdMs: 8500,
    },
  }],
});
_reg({
  id: "phantom_summoner", name: "Призрачный призыватель", tier: 2, baseClass: "mystic", races: ["dark_elf"], from: ["dark_wizard"],
  role: "mage", passiveIds: ["prof_generic_2nd_mage"],
  desc: "Тени служат охоте.",
  skillOverlay: [{
    replaceId: "arcane_focus",
    skill: {
      id: "phantom_bond",
      name: "Узы призрака",
      icon: "icons/skill1128.png?v=2",
      desc: "8 сек: +85% урона.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.85,
      fxColor: "#a070d0",
      cdMs: 12000,
    },
  }],
});
_reg({
  id: "shillien_elder", name: "Старейшина Шилен", tier: 2, baseClass: "mystic", races: ["dark_elf"], from: ["shillien_oracle"],
  role: "support", passiveIds: ["prof_generic_2nd_support"],
  desc: "Тёмное благословение.",
  skillOverlay: [{
    replaceId: "soul_drain",
    skill: {
      id: "shillien_blessing",
      name: "Благо Шилен",
      icon: "icons/skill1218.png?v=2",
      desc: "Удар ×1.9 и +4.5 сек к таймеру.",
      effect: "drainHit",
      mult: 1.9,
      healMs: 4500,
      fxColor: "#c0a0e0",
      cdMs: 15000,
    },
  }],
});

// —— Orc fighter ——
_reg({
  id: "orc_raider", name: "Налётчик", tier: 1, baseClass: "fighter", races: ["orc"], from: null,
  role: "melee", passiveIds: ["prof_generic_1st_melee"],
  desc: "Топоры плато. Позже — Разрушитель.",
});
_reg({
  id: "orc_monk", name: "Монах", tier: 1, baseClass: "fighter", races: ["orc"], from: null,
  role: "melee", armorPref: "light", passiveIds: ["prof_generic_1st_melee"],
  desc: "Кулаки Паагрио. Позже — Тиран.",
});
_reg({
  id: "destroyer", name: "Разрушитель", tier: 2, baseClass: "fighter", races: ["orc"], from: ["orc_raider"],
  role: "melee", passiveIds: ["prof_generic_2nd_melee"],
  desc: "Крушитель врагов.",
  skillOverlay: [{
    replaceId: "blood_rage",
    skill: {
      id: "frenzy",
      name: "Безумие",
      icon: "icons/skill0176.png?v=2",
      desc: "9 сек: +95% урона.",
      effect: "damageBuff",
      duration: 9000,
      mult: 1.95,
      fxColor: "#e05030",
      cdMs: 17000,
    },
  }],
});
_reg({
  id: "tyrant", name: "Тиран", tier: 2, baseClass: "fighter", races: ["orc"], from: ["orc_monk"],
  role: "melee", armorPref: "light", passiveIds: ["prof_generic_2nd_melee"],
  desc: "Кулак, крушащий скалы.",
  skillOverlay: [{
    replaceId: "power_strike",
    skill: {
      id: "fist_of_fury",
      name: "Кулак ярости",
      icon: "icons/skill0029.png?v=2",
      desc: "Следующий удар ×2.8.",
      effect: "nextHit",
      mult: 2.8,
      fxColor: "#e08040",
      cdMs: 8000,
    },
  }],
});

// —— Orc shaman ——
_reg({
  id: "orc_shaman", name: "Шаман орков", tier: 1, baseClass: "shaman", races: ["orc"], from: null,
  role: "support", armorPref: "robe", passiveIds: ["prof_orc_shaman"],
  desc: "Голос Паагрио. Позже — Властитель или Крикун.",
});
_reg({
  id: "overlord", name: "Властитель", tier: 2, baseClass: "shaman", races: ["orc"], from: ["orc_shaman"],
  role: "support", armorPref: "robe", passiveIds: ["prof_overlord"],
  desc: "Вождь клана.",
  skillOverlay: [{
    replaceId: "paagrio_gift",
    skill: {
      id: "seal_of_binding",
      name: "Печать уз",
      icon: "icons/skill1101.png?v=2",
      desc: "Удар ×2.2 и +4.5 сек к таймеру.",
      effect: "drainHit",
      mult: 2.2,
      healMs: 4500,
      fxColor: "#ff7040",
      cdMs: 16000,
    },
  }],
});
_reg({
  id: "warcryer", name: "Крикун", tier: 2, baseClass: "shaman", races: ["orc"], from: ["orc_shaman"],
  role: "support", armorPref: "robe", passiveIds: ["prof_warcryer"],
  desc: "Крик, поднимающий ярость.",
  skillOverlay: [{
    replaceId: "ancestral_guard",
    skill: {
      id: "war_cry",
      name: "Боевой клич",
      icon: "icons/skill1258.png?v=2",
      desc: "8 сек: +88% урона от кликов.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.88,
      fxColor: "#ff9050",
      cdMs: 12000,
    },
  }],
});

// —— Dwarf ——
_reg({
  id: "scavenger", name: "Собиратель", tier: 1, baseClass: "fighter", races: ["dwarf"], from: null,
  role: "craft", passiveIds: ["prof_scavenger"],
  desc: "Жила и мешок. Позже — Охотник за головами.",
});
_reg({
  id: "artisan", name: "Ремесленник", tier: 1, baseClass: "fighter", races: ["dwarf"], from: null,
  role: "craft", passiveIds: ["prof_artisan"],
  desc: "Наковальня гильдии. Позже — Кузнец войны.",
});
_reg({
  id: "bounty_hunter", name: "Охотник за головами", tier: 2, baseClass: "fighter", races: ["dwarf"], from: ["scavenger"],
  role: "craft", passiveIds: ["prof_bounty_hunter"],
  desc: "Контракты и добыча.",
  skillOverlay: [{
    replaceId: "cleave",
    skill: {
      id: "spoil_strike",
      name: "Удар сбора",
      icon: "icons/skill0254.png?v=2",
      desc: "Прямой удар ×3.0.",
      effect: "directHit",
      mult: 3.0,
      fxColor: "#c0a060",
      cdMs: 10000,
    },
  }],
});
_reg({
  id: "warsmith", name: "Кузнец войны", tier: 2, baseClass: "fighter", races: ["dwarf"], from: ["artisan"],
  role: "craft", passiveIds: ["prof_warsmith"],
  desc: "Молот войны и заточки.",
  skillOverlay: [{
    replaceId: "iron_shell",
    skill: {
      id: "summon_siege_golem",
      name: "Стойка голема",
      icon: "icons/skill0172.png?v=2",
      desc: "5 сек: таймер замедлен.",
      effect: "timerSlow",
      duration: 5000,
      fxColor: "#b09060",
      cdMs: 12500,
    },
  }],
});

/** 1st-профессии для превью при создании (по race + starter class). */
function professionPreviewIds(raceId, classId) {
  return Object.keys(PROFESSIONS).filter((id) => {
    const p = PROFESSIONS[id];
    return p.tier === 1 && p.baseClass === classId && p.races.indexOf(raceId) >= 0;
  });
}
