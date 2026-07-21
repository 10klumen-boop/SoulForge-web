// ===== Данные: квесты, боссы зон, NPC поручений =====
// Вынесено из 27-quests.js, чтобы новые зоны/расы добавлялись без правки логики.

const QUESTS_PER_ZONE = 3;

/** Зачисток на поле после неудачи с боссом — затем он снова явится */
const ZONE_BOSS_GRIND_KILLS = 12;

/** Убийств по шагам: [зачистка, элита, финал] — подтягивает lvl/силу к боссу и частично к гейту след. зоны */
function zoneQuestKillTargets(chapter) {
  const ch = Math.min(5, Math.max(1, chapter || 1));
  if (ch === 1) return [22, 14, 24];
  return [
    12 + ch * 4,
    8 + ch * 3,
    14 + ch * 3,
  ];
}

/** Сколько «золотых» целей нужно на шаге 2 */
function zoneQuestGoldenTarget(chapter) {
  return 1 + Math.min(5, Math.max(1, chapter || 1));
}

const QUEST_STEP_FLAVOR = [
  "Сперва выжги гнездо — пусть поле запомнит твою сталь.",
  "Теперь добей элиту — тех, кто несёт лучшую добычу. Кристаллы сберегай на заточку.",
  "Последнее поручение. Заточи клинок — после него явится хозяин этой земли.",
];

/** @type {Record<string, Record<string, { name: string, role: string, icon: string, greet: string }>>} */
const QUEST_NPC_BY_RACE_ZONE = {
  human: {
    banana_mine: { name: "Колин Виндавуд", role: "Старейшина · Говорящий остров", icon: "icons/weapon_long_sword_i00.png", greet: "Шторм отступил, но остров ещё кровоточит." },
    elven_ruins: { name: "Галлинт", role: "Мудрец · Школа магии", icon: "icons/weapon_mace_of_judgment_i00.png", greet: "Духи вырвались из зеркал — барьер не вечен." },
    orc_barracks: { name: "Священник Эйнхасад", role: "Церковь · Расовая марка", icon: "icons/weapon_mace_of_judgment_i00.png", greet: "Эльфы ждут помощи у опушки." },
    dark_cavern: { name: "Святая Кристина", role: "Церковь · Граница тьмы", icon: "icons/weapon_mace_of_judgment_i00.png", greet: "Тьма не прощает слабых у границы." },
    dwarven_depths: { name: "Гонец Амадео", role: "Король · Башня", icon: "icons/weapon_long_sword_i00.png", greet: "Белая башня зовёт — мир сходится у кратера." },
  },
  elf: {
    banana_mine: { name: "Астериус", role: "Старейшина · Деревня эльфов", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Древо Матери увядает — гоблины рубят корни." },
    elven_ruins: { name: "Астериус", role: "Хранитель · Руины", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Осколки огня и льда будят духов у сводов." },
    orc_barracks: { name: "Райен", role: "Страж · Граница", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Орки ломятся к корням Древа." },
    dark_cavern: { name: "Астериус", role: "Разведка · Споры", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Скверна дошла до светлых корней." },
    dwarven_depths: { name: "Аркениас", role: "Маг · Башня", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Небулит решит судьбу мира." },
  },
  dark_elf: {
    banana_mine: { name: "Тетрарх", role: "Школа тёмных искусств", icon: "icons/weapon_dark_screamer_i00.png", greet: "Охота Шилен началась — промаха не будет." },
    elven_ruins: { name: "Старейшина тьмы", role: "Разведка · Руины", icon: "icons/weapon_dark_screamer_i00.png", greet: "Светлые слабеют в своих сводах." },
    orc_barracks: { name: "Военачальник Баллар", role: "Граница тьмы", icon: "icons/weapon_dark_screamer_i00.png", greet: "Орки хлынули и к нам." },
    dark_cavern: { name: "Жрица Шилен", role: "Охота · Месса", icon: "icons/weapon_dark_screamer_i00.png", greet: "Охота в разгаре — кровь на алтаре." },
    dwarven_depths: { name: "Тайный совет", role: "Башня · Митреэль", icon: "icons/weapon_dark_screamer_i00.png", greet: "Башня полна чужих глаз." },
  },
  orc: {
    banana_mine: { name: "Кекай", role: "Вождь · Плато", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Плато ждёт доблести перед вечной зимой." },
    elven_ruins: { name: "Центурион", role: "Трофеи · Руины", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Предки воевали в этих руинах." },
    orc_barracks: { name: "Кекай", role: "Испытание · Чужой лес", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Эльфийский лес не любит орков." },
    dark_cavern: { name: "Шаман племени", role: "Обряд · Тьма", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Тьма — тоже огонь, если не бояться." },
    dwarven_depths: { name: "Кекай", role: "Дипломатия · Башня", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Не опозорь племя у белой башни." },
  },
  dwarf: {
    banana_mine: { name: "Серый столб", role: "Гильдия · Мамир", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Гильдии грызутся за жилу у Мамира." },
    elven_ruins: { name: "Серый столб", role: "Гильдия · Своды", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Нужен образец крепления из руин." },
    orc_barracks: { name: "Серебряные весы", role: "Торг · Лес", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Война — хороший рынок у леса." },
    dark_cavern: { name: "Представитель гильдии", role: "Контракт · Жила", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Одна сделка у границы тьмы." },
    dwarven_depths: { name: "Старейшина гильдии", role: "Поставки · Башня", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Реагенты магам и голос на выборах." },
  },
};

/** Босс локации после 3 квестов */
const ZONE_BOSSES = {
  banana_mine: { name: "Вождь стервятников", mob: "relic-werewolf", hpMult: 11, rewardMult: 2.0 },
  elven_ruins: { name: "Повелитель зеркал", mob: "silent-horror", hpMult: 16, rewardMult: 2.2 },
  orc_barracks: { name: "Кабу-разрушитель", mob: "tunath-orc-warrior", hpMult: 17, rewardMult: 2.4 },
  dark_cavern: { name: "Сердце скверны", mob: "dre-vanul", hpMult: 18, rewardMult: 2.5 },
  dwarven_depths: { name: "Страж кратера", mob: "stone-giant", hpMult: 20, rewardMult: 2.8 },
};
