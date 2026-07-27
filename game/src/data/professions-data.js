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
  // Лук только у роли archer — иначе L2-PATK лука ломает farm power у любого воина.
  fighter: ["Sword", "Dualsword", "Polearm", "Blunt", "Dualblunt", "Fist", "Dagger", "Dualdagger"],
  mystic: ["Blunt", "Sword"],
  shaman: ["Blunt"],
};

/** Множитель урона/DEF при совпадении armorPref (≥2 куска нужного kind). */
const ARMOR_AFFINITY_MULT = 1.06;
/** Множитель DEF кусков/листа при чужом kind брони (фарм + арена). */
const OFF_ARMOR_DEF_MULT = 0.42;

/** Бонус силы оружия при совпадении категории с классом/ролью. */
const WEAPON_MASTERY_MULT = 1.06;

/**
 * Нормализация PATK по категории под кликер SoulForge.
 * В L2 dual/fist/лук берут скорость атаки; здесь клик один — режем вклад к мечу.
 */
const WEAPON_CAT_POWER_MULT = {
  Bow: 0.58,
  Dualsword: 0.9,
  Dualblunt: 0.9,
  Fist: 0.86,
};

/**
 * Грейд экипа по уровню (можно носить без штрафа):
 * <10 — только NG; ≥10 — D; ≥40 — C.
 * Выше дозволенного — штраф растёт с разрывом рангов (−STEP за ранг, не ниже FLOOR).
 */
const GRADE_UNLOCK_LEVEL = { NG: 1, D: 10, C: 40 };
const GRADE_RANK = { NG: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
/** − к множителю статов за каждый ранг грейда выше дозволенного. */
const GRADE_OVERLEVEL_STEP = 0.4;
/** Нижняя граница множителя при большом разрыве. */
const GRADE_OVERLEVEL_FLOOR = 0.1;
/** Множитель при разрыве в 2 ранга (для атласа / legacy). */
const GRADE_OVERLEVEL_MULT = 0.2;

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
  role: "melee", armorPref: "heavy", weaponCats: ["Sword", "Dualsword", "Polearm"], passiveIds: ["prof_warrior"],
  desc: "Путь двуручного клинка. Позже — Гладиатор или Полководец.",
});
_reg({
  id: "knight", name: "Рыцарь", tier: 1, baseClass: "fighter", races: ["human"], from: null,
  role: "tank", armorPref: "heavy", weaponCats: ["Sword", "Blunt", "Dualblunt"], passiveIds: ["prof_knight"],
  desc: "Щит и клятва. Позже — Паладин или Мститель.",
});
_reg({
  id: "rogue", name: "Разбойник", tier: 1, baseClass: "fighter", races: ["human"], from: null,
  role: "dagger", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_rogue"],
  desc: "Кинжал, тень и лёгкая броня. Позже — Искатель сокровищ или Стрелок.",
});
_reg({
  id: "gladiator", name: "Гладиатор", tier: 2, baseClass: "fighter", races: ["human"], from: ["warrior"],
  role: "melee", armorPref: "heavy", weaponCats: ["Dualsword"], passiveIds: ["prof_gladiator"],
  desc: "Арена и ярость двуручника."
});
_reg({
  id: "warlord", name: "Полководец", tier: 2, baseClass: "fighter", races: ["human"], from: ["warrior"],
  role: "melee", armorPref: "heavy", weaponCats: ["Polearm"], passiveIds: ["prof_warlord"],
  desc: "Копьё и клич полка."
});
_reg({
  id: "paladin", name: "Паладин", tier: 2, baseClass: "fighter", races: ["human"], from: ["knight"],
  role: "tank", armorPref: "heavy", weaponCats: ["Sword", "Blunt", "Dualblunt"], passiveIds: ["prof_paladin"],
  desc: "Свет и стойкость."
});
_reg({
  id: "dark_avenger", name: "Мститель", tier: 2, baseClass: "fighter", races: ["human"], from: ["knight"],
  role: "tank", armorPref: "heavy", weaponCats: ["Sword", "Blunt", "Dualblunt"], passiveIds: ["prof_dark_avenger"],
  desc: "Тёмная клятва и жажда добычи."
});
_reg({
  id: "treasure_hunter", name: "Искатель сокровищ", tier: 2, baseClass: "fighter", races: ["human"], from: ["rogue"],
  role: "dagger", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_treasure_hunter"],
  desc: "Кинжалы, лёгкая броня и полные карманы."
});
_reg({
  id: "hawkeye", name: "Стрелок", tier: 2, baseClass: "fighter", races: ["human"], from: ["rogue"],
  role: "archer", armorPref: "light", weaponCats: ["Bow"], passiveIds: ["prof_hawkeye"],
  desc: "Лук, точный глаз и лёгкая броня."
});

// —— Human mystic ——
_reg({
  id: "wizard", name: "Маг", tier: 1, baseClass: "mystic", races: ["human"], from: null,
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_wizard"],
  desc: "Школа стихий. Позже — Чародей, Некромант или Колдун.",
});
_reg({
  id: "cleric", name: "Клерик", tier: 1, baseClass: "mystic", races: ["human"], from: null,
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_cleric"],
  desc: "Свет и поддержка. Позже — Епископ или Пророк.",
});
_reg({
  id: "sorcerer", name: "Чародей", tier: 2, baseClass: "mystic", races: ["human"], from: ["wizard"],
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_sorcerer"],
  desc: "Пламя и разрушение."
});
_reg({
  id: "necromancer", name: "Некромант", tier: 2, baseClass: "mystic", races: ["human"], from: ["wizard"],
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_necromancer"],
  desc: "Смерть служит добыче."
});
_reg({
  id: "warlock", name: "Колдун", tier: 2, baseClass: "mystic", races: ["human"], from: ["wizard"],
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_warlock"],
  desc: "Узы и призванные силы."
});
_reg({
  id: "bishop", name: "Епископ", tier: 2, baseClass: "mystic", races: ["human"], from: ["cleric"],
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_bishop"],
  desc: "Высшее благословение."
});
_reg({
  id: "prophet", name: "Пророк", tier: 2, baseClass: "mystic", races: ["human"], from: ["cleric"],
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_prophet"],
  desc: "Песни силы для добычи."
});

// —— Elf fighter ——
_reg({
  id: "elven_knight", name: "Светлый рыцарь", tier: 1, baseClass: "fighter", races: ["elf"], from: null,
  role: "tank", armorPref: "heavy", weaponCats: ["Sword", "Blunt", "Dualblunt", "Dagger", "Dualdagger"], passiveIds: ["prof_elven_knight"],
  desc: "Щит Древа. Позже — Храмовый рыцарь или Певец меча.",
});
_reg({
  id: "elven_scout", name: "Разведчик", tier: 1, baseClass: "fighter", races: ["elf"], from: null,
  role: "dagger", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_elven_scout"],
  desc: "Лёгкая броня, кинжал и лес. Позже — Следопыт или Серебряный рейнджер.",
});
_reg({
  id: "temple_knight", name: "Храмовый рыцарь", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_knight"],
  role: "tank", armorPref: "heavy", weaponCats: ["Sword", "Blunt", "Dualblunt"], passiveIds: ["prof_temple_knight"],
  desc: "Страж храма Евы."
});
_reg({
  id: "swordsinger", name: "Певец меча", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_knight"],
  role: "melee", armorPref: "heavy", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_swordsinger"],
  desc: "Клинок под песнь леса."
});
_reg({
  id: "plainswalker", name: "Следопыт", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_scout"],
  role: "dagger", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_plainswalker"],
  desc: "Тропы, кинжалы и лёгкая броня опушки."
});
_reg({
  id: "silver_ranger", name: "Серебряный рейнджер", tier: 2, baseClass: "fighter", races: ["elf"], from: ["elven_scout"],
  role: "archer", armorPref: "light", weaponCats: ["Bow"], passiveIds: ["prof_silver_ranger"],
  desc: "Серебряная стрела Евы · лёгкая броня."
});

// —— Elf mystic ——
_reg({
  id: "elven_wizard", name: "Светлый маг", tier: 1, baseClass: "mystic", races: ["elf"], from: null,
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_elven_wizard"],
  desc: "Магия воды и воздуха.",
});
_reg({
  id: "oracle", name: "Оракул", tier: 1, baseClass: "mystic", races: ["elf"], from: null,
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_oracle"],
  desc: "Песни и исцеление леса.",
});
_reg({
  id: "spellsinger", name: "Певец заклинаний", tier: 2, baseClass: "mystic", races: ["elf"], from: ["elven_wizard"],
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_spellsinger"],
  desc: "Стихии в голосе."
});
_reg({
  id: "elemental_summoner", name: "Призыватель стихий", tier: 2, baseClass: "mystic", races: ["elf"], from: ["elven_wizard"],
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_elemental_summoner"],
  desc: "Духи стихий на поле."
});
_reg({
  id: "elder", name: "Старейшина", tier: 2, baseClass: "mystic", races: ["elf"], from: ["oracle"],
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_elder"],
  desc: "Мудрость Древа."
});

// —— Dark Elf fighter ——
_reg({
  id: "palus_knight", name: "Рыцарь Палуса", tier: 1, baseClass: "fighter", races: ["dark_elf"], from: null,
  role: "tank", armorPref: "heavy", weaponCats: ["Sword", "Blunt", "Dualblunt", "Dualsword"], passiveIds: ["prof_palus_knight"],
  desc: "Тёмный щит. Позже — Рыцарь Шилен или Танцор клинка.",
});
_reg({
  id: "assassin", name: "Убийца", tier: 1, baseClass: "fighter", races: ["dark_elf"], from: null,
  role: "dagger", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_assassin"],
  desc: "Тень Шилен и лёгкая броня. Позже — Странник бездны или Призрачный рейнджер.",
});
_reg({
  id: "shillien_knight", name: "Рыцарь Шилен", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["palus_knight"],
  role: "tank", armorPref: "heavy", weaponCats: ["Sword", "Blunt", "Dualblunt"], passiveIds: ["prof_shillien_knight"],
  desc: "Клятва богине тьмы."
});
_reg({
  id: "bladedancer", name: "Танцор клинка", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["palus_knight"],
  role: "melee", armorPref: "light", weaponCats: ["Dualsword"], passiveIds: ["prof_bladedancer"],
  desc: "Танец смерти."
});
_reg({
  id: "abyss_walker", name: "Странник бездны", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["assassin"],
  role: "dagger", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_abyss_walker"],
  desc: "Кинжалы бездны · лёгкая броня."
});
_reg({
  id: "phantom_ranger", name: "Призрачный рейнджер", tier: 2, baseClass: "fighter", races: ["dark_elf"], from: ["assassin"],
  role: "archer", armorPref: "light", weaponCats: ["Bow"], passiveIds: ["prof_phantom_ranger"],
  desc: "Стрелы из мглы · лёгкая броня."
});

// —— Dark Elf mystic ——
_reg({
  id: "dark_wizard", name: "Тёмный маг", tier: 1, baseClass: "mystic", races: ["dark_elf"], from: null,
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_dark_wizard"],
  desc: "Магия ветра и тьмы.",
});
_reg({
  id: "shillien_oracle", name: "Оракул Шилен", tier: 1, baseClass: "mystic", races: ["dark_elf"], from: null,
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_shillien_oracle"],
  desc: "Молитвы тёмной богине.",
});
_reg({
  id: "spellhowler", name: "Заклинатель бури", tier: 2, baseClass: "mystic", races: ["dark_elf"], from: ["dark_wizard"],
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_spellhowler"],
  desc: "Буря на кончиках пальцев."
});
_reg({
  id: "phantom_summoner", name: "Призрачный призыватель", tier: 2, baseClass: "mystic", races: ["dark_elf"], from: ["dark_wizard"],
  role: "mage", armorPref: "robe", weaponCats: ["Blunt", "MagicalSword"], passiveIds: ["prof_phantom_summoner"],
  desc: "Тени служат охоте."
});
_reg({
  id: "shillien_elder", name: "Старейшина Шилен", tier: 2, baseClass: "mystic", races: ["dark_elf"], from: ["shillien_oracle"],
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_shillien_elder"],
  desc: "Тёмное благословение."
});

// —— Orc fighter ——
_reg({
  id: "orc_raider", name: "Налётчик", tier: 1, baseClass: "fighter", races: ["orc"], from: null,
  role: "melee", armorPref: "heavy", weaponCats: ["TwoHandSword"], passiveIds: ["prof_orc_raider"],
  desc: "Топоры плато. Позже — Разрушитель.",
});
_reg({
  id: "orc_monk", name: "Монах", tier: 1, baseClass: "fighter", races: ["orc"], from: null,
  role: "melee", armorPref: "light", weaponCats: ["Fist"], passiveIds: ["prof_orc_monk"],
  desc: "Кулаки Паагрио. Позже — Тиран.",
});
_reg({
  id: "destroyer", name: "Разрушитель", tier: 2, baseClass: "fighter", races: ["orc"], from: ["orc_raider"],
  role: "melee", armorPref: "heavy", weaponCats: ["TwoHandSword"], passiveIds: ["prof_destroyer"],
  desc: "Крушитель врагов."
});
_reg({
  id: "tyrant", name: "Тиран", tier: 2, baseClass: "fighter", races: ["orc"], from: ["orc_monk"],
  role: "melee", armorPref: "light", weaponCats: ["Fist"], passiveIds: ["prof_tyrant"],
  desc: "Кулак, крушащий скалы."
});

// —— Orc shaman ——
_reg({
  id: "orc_shaman", name: "Шаман орков", tier: 1, baseClass: "shaman", races: ["orc"], from: null,
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_orc_shaman"],
  desc: "Голос Паагрио. Позже — Властитель или Крикун.",
});
_reg({
  id: "overlord", name: "Властитель", tier: 2, baseClass: "shaman", races: ["orc"], from: ["orc_shaman"],
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_overlord"],
  desc: "Вождь клана."
});
_reg({
  id: "warcryer", name: "Крикун", tier: 2, baseClass: "shaman", races: ["orc"], from: ["orc_shaman"],
  role: "support", armorPref: "robe", weaponCats: ["Blunt"], passiveIds: ["prof_warcryer"],
  desc: "Крик, поднимающий ярость."
});

// —— Dwarf ——
_reg({
  id: "scavenger", name: "Собиратель", tier: 1, baseClass: "fighter", races: ["dwarf"], from: null,
  role: "craft", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_scavenger"],
  desc: "Жила и мешок. Позже — Охотник за головами.",
});
_reg({
  id: "artisan", name: "Ремесленник", tier: 1, baseClass: "fighter", races: ["dwarf"], from: null,
  role: "craft", armorPref: "light", weaponCats: ["Blunt", "Dualblunt", "Sword"], passiveIds: ["prof_artisan"],
  desc: "Наковальня гильдии. Позже — Кузнец войны.",
});
_reg({
  id: "bounty_hunter", name: "Охотник за головами", tier: 2, baseClass: "fighter", races: ["dwarf"], from: ["scavenger"],
  role: "craft", armorPref: "light", weaponCats: ["Dagger", "Dualdagger"], passiveIds: ["prof_bounty_hunter"],
  desc: "Контракты и добыча."
});
_reg({
  id: "warsmith", name: "Кузнец войны", tier: 2, baseClass: "fighter", races: ["dwarf"], from: ["artisan"],
  role: "craft", armorPref: "light", weaponCats: ["Blunt", "Dualblunt", "Sword"], passiveIds: ["prof_warsmith"],
  desc: "Молот войны и заточки."
});

/** 1st-профессии для превью при создании (по race + starter class). */
function professionPreviewIds(raceId, classId) {
  return Object.keys(PROFESSIONS).filter((id) => {
    const p = PROFESSIONS[id];
    return p.tier === 1 && p.baseClass === classId && p.races.indexOf(raceId) >= 0;
  });
}
