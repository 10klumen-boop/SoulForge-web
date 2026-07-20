// ===== Достижения: curated-набор + QA-чеклист плейтеста (только dev) =====
const ACH_ICON = "assets/ui/bloodhood_icon02_crop.png";
const ACH_ICON_VER = 3;

/** AI badge icons — py game/tools/fetch_achievement_icons.py --from-assets */
const ACH_ICON_MAP = {
  first_field: "mine_tier1", first_kill: "mine_tier1",
  miner10: "mine_tier2", miner25: "mine_tier2",
  miner50: "mine_veteran", golden_gnome: "mine_gold", golden5: "mine_gold",
  banan_hunter: "mine_rare", boss_slayer: "mine_boss",
  first_enchant: "enchant_start", first_plus4: "enchant_risk", plus6: "enchant_steady",
  plus8: "enchant_lucky", plus12: "enchant_glory", legend16: "enchant_legend",
  enchanter100: "enchant_grind", stubborn50: "enchant_stubborn",
  seller: "eco_trade", sell_plus4: "eco_risk", sell_high: "eco_premium",
  rich1m: "eco_million", rich10m: "eco_wealthy", rich100m: "eco_magnate",
  crystal_merchant: "eco_crystal",
  soul_awake: "story_soul", first_quest: "story_quest", level5: "story_growth",
  story_arc_half: "story_arc", prelude_quests_complete: "story_prelude",
  story_arc_complete: "story_finale",
  first_craft: "craft_apprentice", crafter100: "craft_master",
  coll_d_1: "coll_d_first", coll_d_10: "coll_d_hunter", coll_d_25: "coll_d_arsenal",
  coll_c_1: "coll_c_first", coll_c_10: "coll_c_hunter", coll_c_25: "coll_c_arsenal",
  coll_b_1: "coll_b_first", coll_b_10: "coll_b_hunter", coll_b_25: "coll_b_arsenal",
  coll_a_1: "coll_a_first", coll_a_10: "coll_a_hunter", coll_a_25: "coll_a_arsenal",
  hidden_autoclicker: "secret_iron", hidden_phantom_click: "secret_phantom",
  hidden_spectator: "secret_spectator", hidden_night_smith: "secret_night",
  hidden_banan_escape: "secret_escape", hidden_completionist: "secret_complete",
};

const ACH_ICON_WIKI = new Set([
  "chapter1_done", "story_elven_ruins", "story_orc_barracks", "story_dark_cavern",
  "zaken_earring", "hidden_a_arsenal",
]);

function achIconPath(stem) {
  return "icons/achievements/" + stem + ".png?v=" + ACH_ICON_VER;
}

function resolveAchIcon(ach) {
  if (!ach) return ACH_ICON;
  if (ACH_ICON_WIKI.has(ach.id) && ach.icon) return ach.icon;
  const stem = ACH_ICON_MAP[ach.id];
  if (stem) return achIconPath(stem);
  if (ach.hidden) return achIconPath("secret_complete");
  return ach.icon || ACH_ICON;
}

const ACH_CATEGORIES = [
  { id: "all", label: "Все" },
  { id: "mine", label: "Задания" },
  { id: "enchant", label: "Заточка" },
  { id: "economy", label: "Экономика" },
  { id: "story", label: "Сюжет" },
  { id: "craft", label: "Мастерская" },
  { id: "collection", label: "Коллекции" },
  { id: "secret", label: "Секретные" },
];

let achUiFilter = "all";

function achProg(cur, max) {
  max = Math.max(1, max || 1);
  return { current: Math.min(Math.max(0, cur || 0), max), max };
}

/** QA-чеклист: только FEATURE_DEV_PANEL, без наград игроку. */
const PLAYTEST_CHECKLIST = [
  {
    id: "pt_soul",
    category: "playtest",
    title: "Душа пробуждена",
    desc: "Создай персонажа",
    icon: "icons/skill1921.png",
    test: (c) => c.avatarCreated,
    progress: (c) => achProg(c.avatarCreated ? 1 : 0, 1),
  },
  {
    id: "pt_field",
    category: "playtest",
    title: "Первый выход",
    desc: "Зайди в задание (шахту)",
    icon: "assets/ui/menubutton2_crop.png",
    test: (c) => c.mineVisits >= 1,
    progress: (c) => achProg(c.mineVisits, 1),
  },
  {
    id: "pt_strike",
    category: "playtest",
    title: "Первый удар",
    desc: "Убей 1 цель в задании",
    icon: "icons/weapon_long_sword_i00.png",
    test: (c) => c.gnomesCaught >= 1,
    progress: (c) => achProg(c.gnomesCaught, 1),
  },
  {
    id: "pt_hammer",
    category: "playtest",
    title: "На наковальню",
    desc: "Сделай 1 попытку заточки",
    icon: "icons/etc_scroll_of_enchant_weapon_i01.png",
    test: (c) => c.tries >= 1,
    progress: (c) => achProg(c.tries, 1),
  },
  {
    id: "pt_trade",
    category: "playtest",
    title: "Первый лот",
    desc: "Продай заточенное оружие",
    icon: "icons/weapon_elven_sword_i00.png",
    test: (c) => c.weaponsSold >= 1,
    progress: (c) => achProg(c.weaponsSold, 1),
  },
  {
    id: "pt_grow",
    category: "playtest",
    title: "Рост души",
    desc: "Достигни 5 уровня персонажа",
    icon: "icons/etc_feather_gold_i00.png",
    test: (c) => c.avatarLevel >= 5,
    progress: (c) => achProg(c.avatarLevel, 5),
  },
  {
    id: "pt_boss",
    category: "playtest",
    title: "Поверженный страж",
    desc: "Победи босса локации",
    icon: "icons/etc_scroll_of_enchant_weapon_i03.png",
    test: (c) => c.bossKills >= 1,
    progress: (c) => achProg(c.bossKills, 1),
  },
  {
    id: "pt_chapter",
    category: "playtest",
    title: "Глава завершена",
    desc: "Закрой первую главу (квесты + босс)",
    icon: "icons/etc_scroll_of_enchant_weapon_i02.png",
    test: (c) => c.chapter1Complete,
    progress: (c) => achProg(c.chapter1Complete ? 1 : 0, 1),
  },
];

const ACHIEVEMENTS = [
  // —— mine ——
  {
    id: "first_field",
    category: "mine",
    title: "Первый выход",
    desc: "Зайди в задание",
    icon: "assets/ui/menubutton2_crop.png",
    test: (c) => c.mineVisits >= 1,
    progress: (c) => achProg(c.mineVisits, 1),
    reward: { adena: 500 },
  },
  {
    id: "first_kill",
    category: "mine",
    title: "Первая кровь",
    desc: "Убей 1 цель в задании",
    icon: "icons/weapon_long_sword_i00.png",
    test: (c) => c.gnomesCaught >= 1,
    progress: (c) => achProg(c.gnomesCaught, 1),
    reward: { adena: 500 },
  },
  {
    id: "miner10",
    category: "mine",
    title: "Охотник задания",
    desc: "Убей 10 целей",
    icon: "icons/quest_journal.png",
    test: (c) => c.gnomesCaught >= 10,
    progress: (c) => achProg(c.gnomesCaught, 10),
    reward: { adena: 2_000 },
  },
  {
    id: "miner25",
    category: "mine",
    title: "След на поле",
    desc: "Убей 25 целей",
    icon: "icons/skill1903.png",
    test: (c) => c.gnomesCaught >= 25,
    progress: (c) => achProg(c.gnomesCaught, 25),
    reward: { adena: 8_000, ore: { soul: 20 } },
  },
  {
    id: "miner50",
    category: "mine",
    title: "Полевой боец",
    desc: "Убей 50 целей",
    icon: "icons/skill1902.png",
    test: (c) => c.gnomesCaught >= 50,
    progress: (c) => achProg(c.gnomesCaught, 50),
    reward: { adena: 15_000, ore: { soul: 40 } },
  },
  {
    id: "golden_gnome",
    category: "mine",
    title: "Золотая лихорадка",
    desc: "Поймай золотую цель",
    icon: "icons/etc_crystal_gold_i00.png",
    test: (c) => c.goldenGnomes >= 1,
    progress: (c) => achProg(c.goldenGnomes, 1),
    reward: { adena: 8_000, ore: { soul: 30 } },
  },
  {
    id: "golden5",
    category: "mine",
    title: "Золотая серия",
    desc: "Поймай 5 золотых целей",
    icon: "icons/etc_coins_gold_i00.png",
    test: (c) => c.goldenGnomes >= 5,
    progress: (c) => achProg(c.goldenGnomes, 5),
    reward: { adena: 25_000, ore: { soul: 80 } },
  },
  {
    id: "banan_hunter",
    category: "mine",
    title: "Укротитель редкого",
    desc: "Победи редкого гнома",
    icon: "icons/etc_mineral_special_i00.png",
    test: (c) => c.bananWins >= 1,
    reward: { adena: 50_000, ore: { soul: 100, spirit: 40 } },
  },
  {
    id: "boss_slayer",
    category: "mine",
    title: "Страж пал",
    desc: "Победи босса локации",
    icon: "icons/skill0279.png",
    test: (c) => c.bossKills >= 1,
    reward: { adena: 20_000, ore: { soul: 50 } },
  },
  // —— enchant ——
  {
    id: "first_enchant",
    category: "enchant",
    title: "Первый удар молота",
    desc: "Сделай 1 попытку заточки",
    icon: "icons/etc_scroll_of_enchant_weapon_i01.png",
    test: (c) => c.tries >= 1,
    progress: (c) => achProg(c.tries, 1),
    reward: { adena: 500 },
  },
  {
    id: "first_plus4",
    category: "enchant",
    title: "Рискованный кузнец",
    desc: "Заточи оружие до +4",
    icon: "icons/etc_scroll_of_enchant_weapon_i02.png",
    test: (c) => c.maxPlus >= 4,
    progress: (c) => achProg(c.maxPlus, 4),
    reward: { adena: 2_500, ore: { soul: 15 } },
  },
  {
    id: "plus6",
    category: "enchant",
    title: "Твёрдая рука",
    desc: "Заточи оружие до +6",
    icon: "icons/etc_scroll_of_enchant_weapon_i02.png",
    test: (c) => c.maxPlus >= 6,
    progress: (c) => achProg(c.maxPlus, 6),
    reward: { adena: 8_000, ore: { spirit: 20 } },
  },
  {
    id: "plus8",
    category: "enchant",
    title: "На удачу",
    desc: "Достигни +8 на любом оружии",
    icon: "icons/etc_scroll_of_enchant_weapon_i03.png",
    test: (c) => c.maxPlus >= 8,
    progress: (c) => achProg(c.maxPlus, 8),
    reward: { adena: 15_000, ore: { spirit: 40 } },
  },
  {
    id: "plus12",
    category: "enchant",
    title: "Один шаг до славы",
    desc: "Достигни +12 на любом оружии",
    icon: "icons/etc_blessed_scrl_of_ench_wp_b_i03.png",
    test: (c) => c.maxPlus >= 12,
    progress: (c) => achProg(c.maxPlus, 12),
    reward: { adena: 50_000, ore: { soul: 80 } },
  },
  {
    id: "legend16",
    category: "enchant",
    title: "ЛЕГЕНДА +16",
    desc: "Заточи оружие до максимума (+16)",
    icon: "icons/etc_blessed_scrl_of_ench_wp_a_i04.png",
    test: (c) => c.maxPlus >= MAX_PLUS,
    progress: (c) => achProg(c.maxPlus, MAX_PLUS),
    reward: { adena: 150_000, ore: { soul: 200, spirit: 100 } },
  },
  {
    id: "enchanter100",
    category: "enchant",
    title: "Старатель",
    desc: "100 попыток заточки",
    icon: "icons/skill1085.png",
    test: (c) => c.tries >= 100,
    progress: (c) => achProg(c.tries, 100),
    reward: { adena: 12_000, ore: { soul: 40 } },
  },
  {
    id: "stubborn50",
    category: "enchant",
    title: "Не сдаётся",
    desc: "50 провалов заточки",
    icon: "icons/etc_broken_crystal_red_i00.png",
    test: (c) => c.fails >= 50,
    progress: (c) => achProg(c.fails, 50),
    reward: { adena: 8_000, ore: { spirit: 40 } },
  },
  // —— economy ——
  {
    id: "seller",
    category: "economy",
    title: "Торговец",
    desc: "Продай заточенное оружие",
    icon: "icons/weapon_elven_sword_i00.png",
    test: (c) => c.weaponsSold >= 1,
    progress: (c) => achProg(c.weaponsSold, 1),
    reward: { adena: 1_500 },
  },
  {
    id: "sell_plus4",
    category: "economy",
    title: "Первый риск-лот",
    desc: "Продай оружие с заточкой +4 или выше",
    icon: "icons/weapon_elven_long_sword_i00.png",
    test: (c) => c.maxSoldPlus >= 4,
    progress: (c) => achProg(c.maxSoldPlus, 4),
    reward: { adena: 2_500 },
  },
  {
    id: "sell_high",
    category: "economy",
    title: "Премиум-лот",
    desc: "Продай оружие с заточкой +12 или выше",
    icon: "icons/weapon_sword_of_magic_fog_i00.png",
    test: (c) => c.maxSoldPlus >= 12,
    progress: (c) => achProg(c.maxSoldPlus, 12),
    reward: { adena: 50_000, ore: { soul: 60 } },
  },
  {
    id: "rich1m",
    category: "economy",
    title: "Первый миллион",
    desc: "Заработай 1 000 000 adena за всё время",
    icon: "icons/etc_adena_i00.png",
    test: (c) => c.earned >= 1_000_000,
    progress: (c) => achProg(c.earned, 1_000_000),
    reward: { adena: 25_000, ore: { soul: 40 } },
  },
  {
    id: "rich10m",
    category: "economy",
    title: "Десятка миллионов",
    desc: "Заработай 10 000 000 adena за всё время",
    icon: "icons/etc_adena_i00.png",
    test: (c) => c.earned >= 10_000_000,
    progress: (c) => achProg(c.earned, 10_000_000),
    reward: { adena: 40_000, ore: { soul: 60 } },
  },
  {
    id: "rich100m",
    category: "economy",
    title: "Магнат",
    desc: "Заработай 100 000 000 adena за всё время",
    icon: "icons/etc_coins_gold_i00.png",
    test: (c) => c.earned >= 100_000_000,
    progress: (c) => achProg(c.earned, 100_000_000),
    reward: { adena: 100_000, ore: { soul: 150, spirit: 80 } },
  },
  {
    id: "crystal_merchant",
    category: "economy",
    title: "Скупщик кристаллов",
    desc: "Продай кристаллы из инвентаря",
    icon: "icons/etc_crystal_blue_i00.png",
    test: (c) => c.crystalsSold >= 1,
    reward: { adena: 2_000 },
  },
  {
    id: "zaken_earring",
    category: "economy",
    title: "Добыча Закена",
    desc: "Получи Blessed Earring of Zaken",
    icon: "icons/accessory_blessed_earring_of_zaken_i00.png",
    test: (c) => c.hasZaken,
    reward: { adena: 80_000, ore: { soul: 120 } },
  },
  // —— story ——
  {
    id: "soul_awake",
    category: "story",
    title: "Душа пробуждена",
    desc: "Создай персонажа",
    icon: "icons/skill1921.png",
    test: (c) => c.avatarCreated,
    progress: (c) => achProg(c.avatarCreated ? 1 : 0, 1),
    reward: { adena: 500 },
  },
  {
    id: "first_quest",
    category: "story",
    title: "Первое поручение",
    desc: "Закрой 1 шаг квеста",
    icon: "icons/quest_journal.png",
    test: (c) => c.questSteps >= 1,
    progress: (c) => achProg(c.questSteps, 1),
    reward: { adena: 1_500 },
  },
  {
    id: "level5",
    category: "story",
    title: "Рост души",
    desc: "Достигни 5 уровня персонажа",
    icon: "icons/etc_feather_gold_i00.png",
    test: (c) => c.avatarLevel >= 5,
    progress: (c) => achProg(c.avatarLevel, 5),
    reward: { adena: 5_000, ore: { soul: 15 } },
  },
  {
    id: "chapter1_done",
    category: "story",
    title: "Глава I закрыта",
    desc: "Закрой первую главу (квесты + босс)",
    icon: "icons/zones/banana_mine_human.png",
    test: (c) => c.chapter1Complete,
    reward: { adena: 5_000, ore: { soul: 20 } },
  },
  {
    id: "story_elven_ruins",
    category: "story",
    title: "Эхо наковальни",
    desc: "Открыть главу II — Эльфийские руины",
    icon: "icons/zones/elven_ruins_elf.png",
    test: (c) => c.storyElvenRuins,
    reward: { adena: 15_000, ore: { spirit: 30 } },
  },
  {
    id: "story_orc_barracks",
    category: "story",
    title: "Граница Эльмора",
    desc: "Открыть главу III",
    icon: "icons/zones/orc_barracks_orc.png",
    test: (c) => c.storyOrcBarracks,
    reward: { adena: 20_000, ore: { spirit: 25 } },
  },
  {
    id: "story_dark_cavern",
    category: "story",
    title: "Тень между лесами",
    desc: "Открыть главу IV",
    icon: "icons/zones/dark_cavern_dark_elf.png",
    test: (c) => c.storyDarkCavern,
    reward: { adena: 30_000 },
  },
  {
    id: "story_arc_half",
    category: "story",
    title: "Три главы Prelude",
    desc: "Прочитать 3 главы сюжетных линий",
    icon: "icons/etc_spellbook_blue_i00.png",
    test: (c) => c.storyChaptersRead >= 3,
    progress: (c) => achProg(c.storyChaptersRead, 3),
    reward: { adena: 25_000, ore: { soul: 50 } },
  },
  {
    id: "prelude_quests_complete",
    category: "story",
    title: "Хроника Prelude",
    desc: "Пройти все 5 глав заданий",
    icon: "icons/etc_spellbook_red_i00.png",
    test: (c) => c.preludeChaptersComplete >= 5,
    progress: (c) => achProg(c.preludeChaptersComplete, 5),
    reward: { adena: 100_000, ore: { soul: 120, spirit: 60 } },
  },
  {
    id: "story_arc_complete",
    category: "story",
    title: "Путь народа",
    desc: "Прочитать все 5 глав Prelude",
    icon: "icons/etc_feather_gold_i00.png",
    test: (c) => c.storyChaptersRead >= 5,
    progress: (c) => achProg(c.storyChaptersRead, 5),
    reward: { adena: 80_000, ore: { soul: 100, spirit: 50 } },
  },
  // —— craft ——
  {
    id: "first_craft",
    category: "craft",
    title: "Подмастерье",
    desc: "Скрафти первую партию зарядов",
    icon: "icons/etc_spirit_bullet_blue_i00.png",
    test: (c) => c.shotsCrafted >= 1,
    reward: { adena: 1_500, ore: { spirit: 20 } },
  },
  {
    id: "crafter100",
    category: "craft",
    title: "Мастер зарядов",
    desc: "Скрафти 100 зарядов (суммарно)",
    icon: "icons/etc_spirit_bullet_silver_i00.png",
    test: (c) => c.shotsCrafted >= 100,
    progress: (c) => achProg(c.shotsCrafted, 100),
    reward: { adena: 15_000, ore: { spirit: 60 } },
  },
  // —— collection (уникальные виды оружия в инвентаре / экипировке) ——
  {
    id: "coll_d_1",
    category: "collection",
    title: "Первая D",
    desc: "Собери 1 вид оружия грейда D",
    icon: "icons/etc_crystal_blue_i00.png",
    test: (c) => c.collD >= 1,
    progress: (c) => achProg(c.collD, 1),
    reward: { adena: 2_000, ore: { soul: 10 } },
  },
  {
    id: "coll_d_10",
    category: "collection",
    title: "Охотник D",
    desc: "Собери 10 разных оружий грейда D",
    icon: "icons/etc_crystal_blue_i00.png",
    test: (c) => c.collD >= 10,
    progress: (c) => achProg(c.collD, 10),
    reward: { adena: 8_000, ore: { soul: 25 } },
  },
  {
    id: "coll_d_25",
    category: "collection",
    title: "Арсенал D",
    desc: "Собери все разные оружия грейда D",
    icon: "icons/etc_crystal_blue_i00.png",
    test: (c) => c.collDTotal > 0 && c.collD >= c.collDTotal,
    progress: (c) => achProg(c.collD, c.collDTotal),
    reward: { adena: 40_000, ore: { soul: 80 } },
  },
  {
    id: "coll_c_1",
    category: "collection",
    title: "Первая C",
    desc: "Собери 1 вид оружия грейда C",
    icon: "icons/etc_crystal_green_i00.png",
    test: (c) => c.collC >= 1,
    progress: (c) => achProg(c.collC, 1),
    reward: { adena: 5_000, ore: { soul: 15 } },
  },
  {
    id: "coll_c_10",
    category: "collection",
    title: "Охотник C",
    desc: "Собери 10 разных оружий грейда C",
    icon: "icons/etc_crystal_green_i00.png",
    test: (c) => c.collC >= 10,
    progress: (c) => achProg(c.collC, 10),
    reward: { adena: 15_000, ore: { soul: 35 } },
  },
  {
    id: "coll_c_25",
    category: "collection",
    title: "Арсенал C",
    desc: "Собери все разные оружия грейда C",
    icon: "icons/etc_crystal_green_i00.png",
    test: (c) => c.collCTotal > 0 && c.collC >= c.collCTotal,
    progress: (c) => achProg(c.collC, c.collCTotal),
    reward: { adena: 60_000, ore: { soul: 100 } },
  },
  {
    id: "coll_b_1",
    category: "collection",
    title: "Первая B",
    desc: "Собери 1 вид оружия грейда B",
    icon: "icons/etc_crystal_red_i00.png",
    test: (c) => c.collB >= 1,
    progress: (c) => achProg(c.collB, 1),
    reward: { adena: 10_000, ore: { spirit: 15 } },
  },
  {
    id: "coll_b_10",
    category: "collection",
    title: "Охотник B",
    desc: "Собери 10 разных оружий грейда B",
    icon: "icons/etc_crystal_red_i00.png",
    test: (c) => c.collB >= 10,
    progress: (c) => achProg(c.collB, 10),
    reward: { adena: 25_000, ore: { spirit: 35 } },
  },
  {
    id: "coll_b_25",
    category: "collection",
    title: "Арсенал B",
    desc: "Собери все разные оружия грейда B",
    icon: "icons/etc_crystal_red_i00.png",
    test: (c) => c.collBTotal > 0 && c.collB >= c.collBTotal,
    progress: (c) => achProg(c.collB, c.collBTotal),
    reward: { adena: 80_000, ore: { spirit: 100 } },
  },
  {
    id: "coll_a_1",
    category: "collection",
    title: "Первая A",
    desc: "Собери 1 вид оружия грейда A",
    icon: "icons/etc_crystal_silver_i00.png",
    test: (c) => c.collA >= 1,
    progress: (c) => achProg(c.collA, 1),
    reward: { adena: 20_000, ore: { spirit: 25 } },
  },
  {
    id: "coll_a_10",
    category: "collection",
    title: "Охотник A",
    desc: "Собери 10 разных оружий грейда A",
    icon: "icons/etc_crystal_silver_i00.png",
    test: (c) => c.collA >= 10,
    progress: (c) => achProg(c.collA, 10),
    reward: { adena: 50_000, ore: { spirit: 60 } },
  },
  {
    id: "coll_a_25",
    category: "collection",
    title: "Арсенал A",
    desc: "Собери все разные оружия грейда A",
    icon: "icons/etc_crystal_silver_i00.png",
    test: (c) => c.collATotal > 0 && c.collA >= c.collATotal,
    progress: (c) => achProg(c.collA, c.collATotal),
    reward: { adena: 150_000, ore: { spirit: 150 } },
  },
];

const ACH_SECRET_ICON = achIconPath("secret_complete");

const HIDDEN_ACHIEVEMENTS = [
  {
    id: "hidden_autoclicker",
    hidden: true,
    title: "Железная хватка",
    desc: "Шахта распознала автокликер и снизила награду",
    icon: "icons/weapon_iron_glove_i00.png",
    test: (c) => c.mineGuardPenalties >= 1,
    reward: { adena: 2_000, ore: { spirit: 15 } },
  },
  {
    id: "hidden_phantom_click",
    hidden: true,
    title: "Фантомный палец",
    desc: "Попытка кликнуть «не своей» рукой в шахте",
    icon: "icons/skill1086.png",
    test: (c) => c.mineGuardSynthetic >= 1,
    reward: { adena: 1_500, ore: { soul: 10 } },
  },
  {
    id: "hidden_spectator",
    hidden: true,
    title: "Зритель в шахте",
    desc: "Пропусти 30 целей, так и не кликнув",
    icon: "icons/etc_feather_gold_i00.png",
    test: (c) => c.gnomesMissed >= 30,
    progress: (c) => achProg(c.gnomesMissed, 30),
    reward: { adena: 3_000, ore: { soul: 20 } },
  },
  {
    id: "hidden_night_smith",
    hidden: true,
    title: "Полночный кузнец",
    desc: "Заточи оружие между полуночью и 5 утра",
    icon: "icons/skill1083.png",
    test: (c) => c.nightEnchants >= 1,
    reward: { adena: 5_000, ore: { spirit: 25 } },
  },
  {
    id: "hidden_banan_escape",
    hidden: true,
    title: "Ушёл в тень",
    desc: "Дай редкому гному сбежать",
    icon: "icons/etc_letter_red_i00.png",
    test: (c) => c.bananEscaped >= 1,
    reward: { adena: 2_500, ore: { soul: 15 } },
  },
  {
    id: "hidden_completionist",
    hidden: true,
    title: "Полная коллекция",
    desc: "Открой все обычные достижения",
    icon: ACH_SECRET_ICON,
    rewardImage: "assets/achievements/secret_reward.jpg",
    test: () => allPublicAchievementsUnlocked(),
    reward: { adena: 100_000, ore: { soul: 150, spirit: 80 } },
  },
  {
    id: "hidden_a_arsenal",
    hidden: true,
    title: "Повелитель A",
    desc: "Собери в коллекцию каждое оружие грейда A — награда Закена",
    icon: "icons/accessory_blessed_earring_of_zaken_i00.png",
    test: (c) => c.aGradeCollectionComplete,
    progress: (c) => achProg(c.collA, c.collATotal),
    reward: { collectible: "zaken_blessed_earring" },
  },
];

const ALL_ACHIEVEMENTS = ACHIEVEMENTS.concat(HIDDEN_ACHIEVEMENTS);
const ACH_REWARD_IMAGE = "assets/achievements/secret_reward.jpg";

function enrichAchievementsMeta() {
  HIDDEN_ACHIEVEMENTS.forEach((a) => {
    a.category = "secret";
  });
}
enrichAchievementsMeta();

function allPublicAchievementsUnlocked() {
  ensureAchievementsState();
  return ACHIEVEMENTS.every((a) => !!state.achievements.unlocked[a.id]);
}

function ensureAchievementsState() {
  if (!state.achievements) state.achievements = { unlocked: {}, stats: {} };
  if (!state.achievements.unlocked) state.achievements.unlocked = {};
  if (!state.achievements.stats) state.achievements.stats = {};
}

function achStat(key, delta) {
  ensureAchievementsState();
  const s = state.achievements.stats;
  if (delta != null) s[key] = (s[key] || 0) + delta;
  return s[key] || 0;
}

function achStatMax(key, val) {
  ensureAchievementsState();
  const s = state.achievements.stats;
  s[key] = Math.max(s[key] || 0, val | 0);
  return s[key];
}

function maxWeaponPlus() {
  if (!state.records) return 0;
  let m = 0;
  for (const k of Object.keys(state.records)) m = Math.max(m, state.records[k] || 0);
  return m;
}

function hasZakenCollectible() {
  const gear = state.avatar?.gear;
  if (gear && (gear.earring_l?.id === "zaken_blessed_earring" || gear.earring_r?.id === "zaken_blessed_earring")) return true;
  if (state.equipped && state.equipped.zaken_blessed_earring) return true;
  return (state.inventory || []).some((it) => it.id === "zaken_blessed_earring");
}

function achRecordsCount() {
  if (!state.records) return 0;
  return Object.keys(state.records).filter((k) => (state.records[k] || 0) > 0).length;
}

function achMaxGradePlus(grade) {
  if (!state.records) return 0;
  let m = 0;
  for (const w of WEAPONS) {
    if (w.grade !== grade) continue;
    m = Math.max(m, state.records[w.id] || 0);
  }
  return m;
}

function achTotalCrystals() {
  if (!state.crystals) return 0;
  return GRADES4.reduce((sum, g) => sum + (state.crystals[g] || 0), 0);
}

function achInventoryWeapons() {
  return (state.inventory || []).filter((it) => !isAccessoryItem(it)).length;
}

function ensureWeaponCollection() {
  ensureAchievementsState();
  if (!state.achievements.stats.weaponsCollected) state.achievements.stats.weaponsCollected = {};
}

function isCollectibleWeaponId(weaponId) {
  const w = WMAP[weaponId];
  return !!(w && typeof weaponCanEnchant === "function" && weaponCanEnchant(w));
}

function markWeaponCollected(weaponId) {
  if (!weaponId || !isCollectibleWeaponId(weaponId)) return false;
  ensureWeaponCollection();
  const bag = state.achievements.stats.weaponsCollected;
  if (bag[weaponId]) return false;
  bag[weaponId] = true;
  return true;
}

function migrateWeaponCollection() {
  ensureWeaponCollection();
  let changed = false;
  const touch = (id) => {
    if (markWeaponCollected(id)) changed = true;
  };
  (state.inventory || []).forEach((it) => {
    if (!it || isAccessoryItem(it)) return;
    touch(it.id);
  });
  const gear = state.avatar?.gear;
  if (gear?.weapon?.id) touch(gear.weapon.id);
  if (changed) save();
  return changed;
}

function achUniqueWeaponsByGrade(grade) {
  ensureWeaponCollection();
  const bag = state.achievements.stats.weaponsCollected || {};
  let n = 0;
  for (const id of Object.keys(bag)) {
    if (WMAP[id]?.grade === grade) n++;
  }
  return n;
}

function achGradeWeaponCatalog(grade) {
  return WEAPONS.filter((w) => w.grade === grade && isCollectibleWeaponId(w.id));
}

function achAllGradeCollected(grade) {
  const catalog = achGradeWeaponCatalog(grade);
  if (!catalog.length) return false;
  ensureWeaponCollection();
  const bag = state.achievements.stats.weaponsCollected || {};
  return catalog.every((w) => !!bag[w.id]);
}

function achQuestStepsDone() {
  ensureQuestProgress();
  const done = state.questProgress.completed || {};
  return Object.keys(done).filter((k) => !k.startsWith("_")).length;
}

function achievementContext() {
  ensureWorkshopState();
  ensureAchievementsState();
  migrateWeaponCollection();
  const t = state.totals || {};
  const m = state.materials || {};
  const s = state.achievements.stats;
  const chapter1Complete = typeof isZoneChapterComplete === "function" && isZoneChapterComplete("banana_mine");
  return {
    avatarCreated: !!state.avatar?.created,
    avatarLevel: state.avatar?.level || 0,
    mineVisits: s.mineVisits || 0,
    bossKills: s.bossKills || 0,
    questSteps: achQuestStepsDone(),
    farmPower: typeof avatarFarmPower === "function" ? avatarFarmPower() : 0,
    chapter1Complete,
    maxPlus: maxWeaponPlus(),
    maxAPlus: achMaxGradePlus("A"),
    tries: t.tries || 0,
    fails: t.fails || 0,
    earned: t.earned || 0,
    gnomesCaught: s.gnomesCaught || 0,
    goldenGnomes: s.goldenGnomes || 0,
    bananWins: s.bananWins || 0,
    funpayWins: s.funpayWins || 0,
    weaponsSold: s.weaponsSold || 0,
    weaponsBroken: s.weaponsBroken || 0,
    maxSoldPlus: s.maxSoldPlus || 0,
    crystalsSold: s.crystalsSold || 0,
    shotsCrafted: s.shotsCrafted || 0,
    shotsSold: s.shotsSold || 0,
    oreSoulBought: s.oreSoulBought || 0,
    invFullOnce: s.invFullOnce || 0,
    soulOre: m.soul || 0,
    spiritOre: m.spirit || 0,
    totalCrystals: achTotalCrystals(),
    invWeapons: achInventoryWeapons(),
    recordsCount: achRecordsCount(),
    collD: achUniqueWeaponsByGrade("D"),
    collC: achUniqueWeaponsByGrade("C"),
    collB: achUniqueWeaponsByGrade("B"),
    collA: achUniqueWeaponsByGrade("A"),
    collDTotal: achGradeWeaponCatalog("D").length,
    collCTotal: achGradeWeaponCatalog("C").length,
    collBTotal: achGradeWeaponCatalog("B").length,
    collATotal: achGradeWeaponCatalog("A").length,
    aGradeCollectionComplete: achAllGradeCollected("A"),
    hasZaken: hasZakenCollectible(),
    mineGuardPenalties: s.mineGuardPenalties || 0,
    mineGuardSynthetic: s.mineGuardSynthetic || 0,
    gnomesMissed: s.gnomesMissed || 0,
    bananEscaped: s.bananEscaped || 0,
    nightEnchants: s.nightEnchants || 0,
    storyElvenRuins: !!(state.storyProgress?.chaptersSeen?.elven_ruins),
    storyOrcBarracks: !!(state.storyProgress?.chaptersSeen?.orc_barracks),
    storyDarkCavern: !!(state.storyProgress?.chaptersSeen?.dark_cavern),
    storyDwarvenDepths: !!(state.storyProgress?.chaptersSeen?.dwarven_depths),
    storyChaptersRead: state.storyProgress?.chaptersSeen
      ? Object.keys(state.storyProgress.chaptersSeen).filter((k) => state.storyProgress.chaptersSeen[k]).length
      : 0,
    preludeChaptersComplete: typeof preludeChaptersCompleteCount === "function" ? preludeChaptersCompleteCount() : 0,
    preludeFinaleSeen: !!(state.storyProgress?.preludeFinaleSeen),
  };
}

function formatAchReward(reward) {
  if (!reward) return "";
  const parts = [];
  if (reward.adena) parts.push(fmtAdena(playtestIncome(reward.adena)) + " adena");
  if (reward.ore) {
    if (reward.ore.soul) parts.push("Soul Ore ×" + fmt(reward.ore.soul));
    if (reward.ore.spirit) parts.push("Spirit Ore ×" + fmt(reward.ore.spirit));
  }
  if (reward.collectible && typeof COLLECTIBLES !== "undefined") {
    const def = COLLECTIBLES[reward.collectible];
    if (def) parts.push(def.name);
  }
  return parts.join(" · ");
}

function grantAchReward(reward) {
  if (!reward) return;
  ensureWorkshopState();
  // Adena ачивок не идёт в totals.earned — иначе rich* фармятся сами с себя
  if (reward.adena) {
    const adena = playtestIncome(reward.adena);
    state.adena = (state.adena || 0) + adena;
  }
  if (reward.ore) {
    if (reward.ore.soul) state.materials.soul = (state.materials.soul || 0) + reward.ore.soul;
    if (reward.ore.spirit) state.materials.spirit = (state.materials.spirit || 0) + reward.ore.spirit;
  }
  if (reward.collectible && typeof grantCollectible === "function") {
    grantCollectible(reward.collectible, reward.collectibleQty || 1);
  }
}

function toastAchievement(ach) {
  const rw = formatAchReward(ach.reward);
  gameLog((ach.hidden ? "Секретное достижение: " : "Достижение: ") + ach.title + (rw ? " (" + rw + ")" : ""), "gold");
}

let gamePaused = false;
let gamePauseDepth = 0;
let achModalQueue = [];
let achModalDraining = false;
let achModalKeyHandler = null;

const OVERLAY_OK_ARM_MS = 650;

function armOverlayOkButton(btn, lockedClass, ms) {
  if (!btn) return;
  const delay = ms == null ? OVERLAY_OK_ARM_MS : ms;
  if (btn._armTimer) clearTimeout(btn._armTimer);
  btn.classList.add(lockedClass);
  btn.setAttribute("aria-disabled", "true");
  btn._armTimer = setTimeout(() => {
    btn._armTimer = null;
    btn.classList.remove(lockedClass);
    btn.removeAttribute("aria-disabled");
  }, delay);
}

function isOverlayOkLocked(btn, lockedClass) {
  return !!(btn && btn.classList.contains(lockedClass));
}

function isGamePaused() {
  return gamePaused;
}

function isBlockingOverlayOpen() {
  const ids = [
    "storyBackdrop",
    "modalBackdrop",
    "achModalBackdrop",
    "achRewardBackdrop",
    "avatarSetupBackdrop",
    "avatarEquipBackdrop",
  ];
  return ids.some((id) => {
    const el = document.getElementById(id);
    return el && !el.hidden;
  });
}

function syncGamePauseState() {
  const shouldPause = isBlockingOverlayOpen() || achModalDraining;
  gamePauseDepth = shouldPause ? 1 : 0;
  const wasPaused = gamePaused;
  gamePaused = shouldPause;
  document.body.classList.toggle("game-paused", shouldPause);

  if (typeof mineActive !== "undefined" && mineActive) {
    if (shouldPause) {
      if (!mineOverlayPaused && typeof pauseMineForOverlay === "function") pauseMineForOverlay();
    } else if (mineOverlayPaused && typeof resumeMineFromOverlay === "function") {
      resumeMineFromOverlay();
    } else if (typeof ensureMineSpawning === "function") {
      ensureMineSpawning();
    }
  } else {
    if (shouldPause && !wasPaused && typeof pauseMineForOverlay === "function") pauseMineForOverlay();
    else if (!shouldPause && wasPaused && typeof resumeMineFromOverlay === "function") resumeMineFromOverlay();
  }
}

function setGamePaused(paused) {
  if (paused) {
    gamePauseDepth++;
    if (gamePauseDepth > 1) return;
    gamePaused = true;
    document.body.classList.add("game-paused");
    if (typeof pauseMineForOverlay === "function") pauseMineForOverlay();
    return;
  }
  if (typeof syncGamePauseState === "function") {
    syncGamePauseState();
    return;
  }
  gamePauseDepth = Math.max(0, gamePauseDepth - 1);
  if (gamePauseDepth > 0) return;
  gamePaused = false;
  document.body.classList.remove("game-paused");
  if (typeof resumeMineFromOverlay === "function") resumeMineFromOverlay();
}

function achModalIcon(ach) {
  if (ach.hidden && !state.achievements?.unlocked?.[ach.id]) return ACH_SECRET_ICON;
  return resolveAchIcon(ach);
}

function presentAchievementModal(ach, remaining) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById("achModalBackdrop");
    const box = backdrop && backdrop.querySelector(".ach-modal-box");
    const ico = document.getElementById("achModalIco");
    const kicker = document.getElementById("achModalKicker");
    const title = document.getElementById("achModalTitle");
    const desc = document.getElementById("achModalDesc");
    const reward = document.getElementById("achModalReward");
    const queue = document.getElementById("achModalQueue");
    const okBtn = document.getElementById("achModalOk");
    const badge = document.getElementById("achModalBadge");
    if (!backdrop || !ico || !title || !desc || !okBtn) { resolve(); return; }

    const rw = formatAchReward(ach.reward);
    const secret = !!ach.hidden;
    if (box) box.classList.toggle("secret", secret);
    if (badge) badge.textContent = secret ? "🔮" : "🏆";
    if (kicker) kicker.textContent = secret ? "Секретное достижение!" : "Поздравляем!";
    ico.src = achModalIcon(ach);
    ico.onerror = () => { ico.src = ACH_ICON; };
    title.textContent = ach.title;
    desc.textContent = ach.desc;
    if (reward) reward.textContent = rw ? "Награда: " + rw : "";
    if (queue) {
      queue.hidden = remaining <= 0;
      queue.textContent = remaining > 0 ? "Ещё " + remaining + " " + (remaining === 1 ? "достижение" : remaining < 5 ? "достижения" : "достижений") : "";
    }

    const close = () => {
      backdrop.hidden = true;
      if (achModalKeyHandler) {
        document.removeEventListener("keydown", achModalKeyHandler);
        achModalKeyHandler = null;
      }
      okBtn.onclick = null;
      backdrop.onclick = null;
      resolve();
    };

    achModalKeyHandler = (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (isOverlayOkLocked(okBtn, "ach-modal-btn--locked")) return;
        Audio2.click();
        close();
      }
    };
    okBtn.onclick = () => {
      if (isOverlayOkLocked(okBtn, "ach-modal-btn--locked")) return;
      Audio2.click();
      close();
    };
    backdrop.onclick = (e) => {
      if (e.target !== backdrop) return;
      if (isOverlayOkLocked(okBtn, "ach-modal-btn--locked")) return;
      Audio2.click();
      close();
    };
    document.addEventListener("keydown", achModalKeyHandler);
    backdrop.hidden = false;
    armOverlayOkButton(okBtn, "ach-modal-btn--locked");
    if (typeof Audio2 !== "undefined") {
      if (secret && Audio2.jackpot) Audio2.jackpot();
      else if (Audio2.success) Audio2.success();
    }
    okBtn.focus();
  });
}

function presentAchievementReward(ach) {
  const src = (ach && ach.rewardImage) || ACH_REWARD_IMAGE;
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const backdrop = document.getElementById("achRewardBackdrop");
    const img = document.getElementById("achRewardImg");
    const title = document.getElementById("achRewardTitle");
    const desc = document.getElementById("achRewardDesc");
    const kicker = document.getElementById("achRewardKicker");
    const okBtn = document.getElementById("achRewardOk");
    if (!backdrop || !img || !okBtn) { resolve(); return; }

    if (kicker) kicker.textContent = "🔮 Секретная награда";
    if (title) title.textContent = (ach && ach.title) || "Секретная награда";
    if (desc) desc.textContent = (ach && ach.desc) || "Ты открыл все обычные достижения.";
    img.hidden = false;
    img.src = src;

    let keyHandler = null;
    const close = () => {
      backdrop.hidden = true;
      img.src = "";
      if (keyHandler) document.removeEventListener("keydown", keyHandler);
      okBtn.onclick = null;
      backdrop.onclick = null;
      resolve();
    };

    keyHandler = (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (isOverlayOkLocked(okBtn, "ach-reward-btn--locked")) return;
        Audio2.click();
        close();
      }
    };
    okBtn.onclick = () => {
      if (isOverlayOkLocked(okBtn, "ach-reward-btn--locked")) return;
      Audio2.click();
      close();
    };
    backdrop.onclick = (e) => {
      if (e.target !== backdrop) return;
      if (isOverlayOkLocked(okBtn, "ach-reward-btn--locked")) return;
      Audio2.click();
      close();
    };
    document.addEventListener("keydown", keyHandler);
    backdrop.hidden = false;
    armOverlayOkButton(okBtn, "ach-reward-btn--locked");
    if (typeof Audio2 !== "undefined" && Audio2.jackpot) Audio2.jackpot();
    okBtn.focus();
  });
}

async function drainAchievementModals() {
  if (achModalDraining || !achModalQueue.length) return;
  achModalDraining = true;
  syncGamePauseState();
  while (achModalQueue.length) {
    const ach = achModalQueue.shift();
    const remaining = achModalQueue.length;
    await presentAchievementModal(ach, remaining);
    if (ach.rewardImage) await presentAchievementReward(ach);
  }
  achModalDraining = false;
  syncGamePauseState();
}

function enqueueAchievementModals(list) {
  if (!list.length) return;
  achModalQueue.push(...list);
  drainAchievementModals();
}

function notifyAchievements(list, opts) {
  if (!list.length) return;
  if (opts?.silent) return;
  list.forEach((a) => toastAchievement(a));
  enqueueAchievementModals(list);
}

function checkAchievements(opts) {
  ensureAchievementsState();
  const ctx = achievementContext();
  const newly = [];
  for (const ach of ALL_ACHIEVEMENTS) {
    if (state.achievements.unlocked[ach.id]) continue;
    if (!ach.test(ctx)) continue;
    state.achievements.unlocked[ach.id] = Date.now();
    grantAchReward(ach.reward);
    newly.push(ach);
  }
  // Dev QA-чеклист: без наград и без модалок игроку
  checkPlaytestChecklist(ctx);
  if (newly.length) {
    save();
    $("#adena").textContent = fmt(state.adena);
    notifyAchievements(newly, opts);
    renderMenu();
    const achScreen = $("#screen-ach");
    const invScreen = $("#screen-inv");
    if (achScreen?.classList.contains("active")) renderAchievements();
    if (invScreen?.classList.contains("active")) renderInventory();
  }
  return newly;
}

function checkPlaytestChecklist(ctx) {
  if (!FEATURE_DEV_PANEL) return;
  ensureAchievementsState();
  let changed = false;
  for (const ach of PLAYTEST_CHECKLIST) {
    if (state.achievements.unlocked[ach.id]) continue;
    if (!ach.test(ctx)) continue;
    state.achievements.unlocked[ach.id] = Date.now();
    changed = true;
  }
  if (changed && typeof renderDevSecretAchievements === "function") renderDevSecretAchievements();
}

function refreshAchievementUi() {
  renderMenu();
  const achScreen = $("#screen-ach");
  const invScreen = $("#screen-inv");
  if (achScreen?.classList.contains("active")) renderAchievements();
  if (invScreen?.classList.contains("active")) renderInventory();
  if (typeof renderDevSecretAchievements === "function") renderDevSecretAchievements();
}

function devUnlockAchievement(id, opts) {
  if (!FEATURE_DEV_PANEL) return null;
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id) || PLAYTEST_CHECKLIST.find((a) => a.id === id);
  if (!ach) return null;
  ensureAchievementsState();
  if (state.achievements.unlocked[id]) return null;
  state.achievements.unlocked[id] = Date.now();
  if (!opts?.skipReward) grantAchReward(ach.reward);
  save();
  $("#adena").textContent = fmt(state.adena);
  if (!opts?.deferUi) refreshAchievementUi();
  if (!opts?.silent) enqueueAchievementModals([ach]);
  return ach;
}

function devUnlockAllHiddenAchievements(opts) {
  if (!FEATURE_DEV_PANEL) return [];
  const list = [];
  for (const ach of HIDDEN_ACHIEVEMENTS) {
    const u = devUnlockAchievement(ach.id, { silent: true, skipReward: opts?.skipReward, deferUi: true });
    if (u) list.push(u);
  }
  if (list.length) {
    refreshAchievementUi();
    if (!opts?.silent) notifyAchievements(list, opts);
  }
  return list;
}

function devResetHiddenAchievements() {
  if (!FEATURE_DEV_PANEL) return;
  ensureAchievementsState();
  HIDDEN_ACHIEVEMENTS.forEach((a) => delete state.achievements.unlocked[a.id]);
  save();
  refreshAchievementUi();
}

function devResetAllAchievements() {
  if (!FEATURE_DEV_PANEL) return;
  ensureAchievementsState();
  state.achievements.unlocked = {};
  save();
  refreshAchievementUi();
  toast("Dev: все достижения сброшены", "warn");
}

function devGrantAchStat(key, amount) {
  if (!FEATURE_DEV_PANEL) return;
  achStat(key, Math.max(0, Math.round(Number(amount) || 0)));
  checkAchievements();
  refreshAchievementUi();
}

function devUnlockPlaytestAchievements() {
  if (!FEATURE_DEV_PANEL) return 0;
  ensureAchievementsState();
  let n = 0;
  PLAYTEST_CHECKLIST.forEach((a) => {
    if (state.achievements.unlocked[a.id]) return;
    state.achievements.unlocked[a.id] = Date.now();
    n++;
  });
  if (n) {
    save();
    refreshAchievementUi();
  }
  return n;
}

function playtestAchievementsProgress() {
  const list = PLAYTEST_CHECKLIST;
  ensureAchievementsState();
  const done = list.filter((a) => state.achievements.unlocked[a.id]).length;
  return { done, total: list.length };
}

function achievementsProgress() {
  ensureAchievementsState();
  const total = ALL_ACHIEVEMENTS.length;
  const done = ALL_ACHIEVEMENTS.filter((a) => state.achievements.unlocked[a.id]).length;
  const hiddenTotal = HIDDEN_ACHIEVEMENTS.length;
  const hiddenDone = HIDDEN_ACHIEVEMENTS.filter((a) => state.achievements.unlocked[a.id]).length;
  const playtest = playtestAchievementsProgress();
  return { done, total, hiddenTotal, hiddenDone, playtestDone: playtest.done, playtestTotal: playtest.total };
}

function openAchievements() {
  checkAchievements({ silent: true });
  renderAchievements();
  show("ach");
  Audio2.open();
}

function renderAchCard(ach, unlocked, ctx) {
  const card = document.createElement("article");
  const secret = !!ach.hidden;
  const lockedSecret = secret && !unlocked;
  card.className =
    "ach-card" +
    (unlocked ? " unlocked" : " locked") +
    (secret ? " secret" : "") +
    (lockedSecret ? " secret-locked" : "");
  const rw = unlocked ? formatAchReward(ach.reward) : lockedSecret ? "" : formatAchReward(ach.reward);
  const icon = lockedSecret ? ACH_SECRET_ICON : resolveAchIcon(ach);
  const title = lockedSecret ? "???" : ach.title;
  const desc = lockedSecret ? "Секретное достижение — откроется после выполнения" : ach.desc;
  let progressHtml = "";
  if (!unlocked && !lockedSecret && ach.progress && ctx) {
    const p = ach.progress(ctx);
    if (p && p.max > 1) {
      const pct = Math.min(100, Math.round((p.current / p.max) * 100));
      progressHtml =
        '<div class="ach-progress-row">' +
        '<div class="ach-progress-bar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="ach-progress-val">' + fmt(p.current) + " / " + fmt(p.max) + "</span>" +
        "</div>";
    }
  }
  card.innerHTML =
    `<img class="ach-ico" src="${icon}" alt="" loading="lazy" onerror="this.src='${ACH_ICON}'">` +
    `<div class="ach-body">` +
    `<div class="ach-title">${title}${unlocked ? ' <span class="ach-badge">✓</span>' : ""}</div>` +
    `<div class="ach-desc">${desc}</div>` +
    progressHtml +
    (rw ? `<div class="ach-reward">Награда: ${rw}</div>` : lockedSecret ? `<div class="ach-reward ach-reward-secret">Награда: ???</div>` : "") +
    `</div>`;
  return card;
}

function renderAchTabs() {
  const tabs = document.getElementById("achTabs");
  if (!tabs) return;
  if (!tabs.dataset.wired) {
    tabs.dataset.wired = "1";
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".ach-tab");
      if (!btn) return;
      Audio2.click();
      achUiFilter = btn.dataset.cat || "all";
      renderAchievements();
    });
  }
  tabs.innerHTML = ACH_CATEGORIES.map((cat) => {
    const sel = achUiFilter === cat.id ? " sel" : "";
    return '<button type="button" class="ach-tab' + sel + '" data-cat="' + cat.id + '">' + cat.label + "</button>";
  }).join("");
}

function renderAchievements() {
  ensureAchievementsState();
  const list = $("#achList");
  if (!list) return;
  const ctx = achievementContext();
  const { done, total, hiddenTotal, hiddenDone } = achievementsProgress();
  const sum = document.getElementById("achSummary");
  if (sum) sum.textContent = done + " / " + total;
  const hint = document.querySelector(".ach-hint");
  if (hint) {
    hint.textContent = "Секретных " + hiddenDone + " / " + hiddenTotal + " · награды автоматически";
  }
  const playtestEl = document.getElementById("achPlaytestBar");
  if (playtestEl) {
    playtestEl.hidden = true;
    playtestEl.innerHTML = "";
  }

  renderAchTabs();
  list.innerHTML = "";

  const showList = (items, headText) => {
    if (!items.length) return;
    if (headText) {
      const head = document.createElement("div");
      head.className = "ach-secret-head";
      head.textContent = headText;
      list.appendChild(head);
    }
    items.forEach((ach) => {
      list.appendChild(renderAchCard(ach, !!state.achievements.unlocked[ach.id], ctx));
    });
  };

  const filter = achUiFilter;
  if (filter === "all") {
    ACH_CATEGORIES.filter((c) => c.id !== "all" && c.id !== "secret").forEach((cat) => {
      showList(ACHIEVEMENTS.filter((a) => a.category === cat.id), cat.label);
    });
    showList(HIDDEN_ACHIEVEMENTS, "Секретные достижения");
    return;
  }
  if (filter === "secret") {
    showList(HIDDEN_ACHIEVEMENTS, null);
    return;
  }
  showList(ACHIEVEMENTS.filter((a) => a.category === filter), null);
}
