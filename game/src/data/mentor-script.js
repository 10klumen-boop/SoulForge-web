// ===== Сценарий наставника Ючи (Yuchi) =====
// cta: { label, action } — кнопка перехода на другой экран
// grant: "practice_kit" — выдача при активации бита
// emotion: optional; иначе mentorEmotionForBit(id)

const MENTOR_BITS = [
  // —— Глава I: старт ——
  {
    id: "eyra_hello",
    type: "say",
    lines: [
      "Я Ючи. Пока старейшины раздают поручения — я учу, куда смотреть и что жать. Без меня сломаешь палец о меню раньше, чем клинок.",
    ],
    advanceOn: "ok",
  },
  {
    id: "eyra_hub_story",
    type: "point",
    lines: [
      "Твой путь идёт через Историю. Там поручения, там главы. Фарм без сюжета — потом.",
    ],
    highlight: "hub-story",
    advanceOn: "event:hub_story",
    cta: { label: "Открыть Историю", action: "open_story" },
  },
  {
    id: "eyra_wait_briefing",
    type: "wait",
    lines: [],
    advanceOn: "event:quest_accepted",
    silent: true,
  },
  {
    id: "eyra_after_quest",
    type: "say",
    lines: [
      "Слышал старейшину? Хорошо. Теперь поле. Цели не ждут вежливости.",
    ],
    advanceOn: "ok",
  },
  {
    id: "eyra_open_zone",
    type: "point",
    lines: [
      "Жми «Играть» — стартовое поле ждёт. Не блуждай по списку.",
    ],
    highlight: "hub-play",
    advanceOn: "event:mine_open",
    gates: { hubMode: "story" },
    cta: { label: "Играть", action: "open_mine" },
  },
  {
    id: "eyra_farm_click",
    type: "point",
    lines: [
      "Видишь мельканье? Это не декорация. Жми по цели, пока не исчезла. Промах — она уходит, adena тоже.",
    ],
    highlight: "mine-field",
    advanceOn: "event:first_kill",
    gates: { screen: "mine" },
    cta: { label: "На поле", action: "open_mine" },
  },
  {
    id: "eyra_quest_hud",
    type: "point",
    lines: [
      "Есть. Удары кормят и кошелёк, и поручение. Смотри полоску — старейшина считает за тебя.",
    ],
    highlight: "mine-quest-hud",
    advanceOn: "ok",
    gates: { screen: "mine" },
  },
  {
    id: "eyra_autoclicker",
    type: "point",
    lines: [
      "Автоудар. Жми подсвеченный пакет «15 мин» — подарок Кузницы, один раз бесплатно. Потом только за adena.",
    ],
    highlight: "autoclicker-gift",
    advanceOn: "event:auto_clicker_gift",
    gates: { screen: "mine" },
    lessonId: "auto_clicker",
    cta: { label: "Забрать 15 мин", action: "click_autoclicker_gift" },
  },
  {
    id: "eyra_inventory",
    type: "point",
    lines: [
      "Добыча не висит в воздухе. Инвентарь — твой мешок. Загляни.",
    ],
    highlight: "menu-inv",
    advanceOn: "event:screen_inv",
    cta: { label: "В инвентарь", action: "open_inv" },
  },
  {
    id: "eyra_inv_ng",
    type: "say",
    lines: [
      "Стартовый клинок — NG: учебный, не точится. Для настоящей заточки нужна сталь с грейдом.",
    ],
    advanceOn: "ok",
    gates: { screen: "inv" },
  },

  // —— Учебный цикл: заточка → слом → кристаллы → шоты ——
  {
    id: "eyra_kit",
    type: "say",
    lines: [
      "Держи набор: клинок D, ровно 4 свитка, adena и руда. Точи до упора — на четвёртой попытке клинок сыплется. Обломки = кристаллы = шоты.",
    ],
    advanceOn: "ok",
    grant: "practice_kit",
  },
  {
    id: "eyra_enchant_open",
    type: "point",
    lines: [
      "Открой заточку учебного клинка. Три раза повезёт (+1…+3), четвёртый свиток — урок поломки.",
    ],
    advanceOn: "event:screen_ench",
    cta: { label: "К заточке", action: "open_ench" },
  },
  {
    id: "eyra_enchant_btn",
    type: "point",
    lines: [
      "Жми «Заточить» четыре раза. До +3 клинок держится. На попытке +4 — разлетится в кристаллы. Без этого дальше не пойдём.",
    ],
    highlight: "ench-btn",
    advanceOn: "event:enchant_break",
    gates: { screen: "ench" },
    lessonId: "enchant",
    cta: { label: "Заточить", action: "click_ench" },
  },
  {
    id: "eyra_crystals_lesson",
    type: "say",
    lines: [
      "Видишь? Сломанный клинок стал кристаллами D. Это топливо мастерской. Из них сварим Soulshot (или Spiritshot для мистика).",
    ],
    advanceOn: "ok",
    grant: "ensure_shot_crystals",
    lessonId: "crystals",
  },
  {
    id: "eyra_workshop_open",
    type: "point",
    lines: [
      "Открой Мастерскую → Заряды. Там из кристаллов и руды варят шоты.",
    ],
    highlight: "menu-workshop",
    advanceOn: "event:screen_shop",
    cta: { label: "В мастерскую", action: "open_shop" },
  },
  {
    id: "eyra_workshop_shots",
    type: "point",
    lines: [
      "Жми «Скрафтить» на D-заряде. Кристаллы с обломков + руда = пачка шотов. Без шотов удар слабее.",
    ],
    highlight: "craft-shot",
    advanceOn: "event:shot_crafted",
    gates: { screen: "shop" },
    lessonId: "workshop",
    cta: { label: "Скрафтить", action: "click_craft_shot" },
  },
  {
    id: "eyra_shots_done",
    type: "say",
    lines: [
      "Запомнил цикл: заточка → поломка → кристаллы → шоты → снова поле. Шоты жгутся в бою сами, если автозаряд включён.",
    ],
    advanceOn: "ok",
    lessonId: "shots",
  },
  {
    id: "eyra_journal",
    type: "point",
    lines: [
      "Забыл, кого бить? Журнал квестов. Бумага помнит лучше меня.",
    ],
    highlight: "menu-quests",
    advanceOn: "event:screen_quests",
    cta: { label: "К квестам", action: "open_quests" },
  },
  {
    id: "eyra_loop",
    type: "say",
    lines: [
      "Запомнил? Поручение → поле → добыча → заточка → кристаллы/шоты → снова поручение. Это Кузница душ. Дальше подскажу у новых глав.",
    ],
    advanceOn: "ok",
    lessonId: "chapter1_core",
    cta: { label: "В меню", action: "open_menu" },
  },

  // —— Главы II–V ——
  {
    id: "eyra_ch2",
    type: "chapter_gate",
    zoneId: "elven_ruins",
    lines: [
      "Новая глава — новый воздух. Старейшина сменился, правила те же. Элита щедрее на кристалл — копи на заточку и шоты.",
    ],
    advanceOn: "ok",
    lessonId: "chapter2_intro",
    cta: { label: "В Историю", action: "open_story" },
  },
  {
    id: "eyra_ch3",
    type: "chapter_gate",
    zoneId: "orc_barracks",
    lines: [
      "Третья глава. Клинок без брони — мишень. Сейчас соберём учебный NG-сет под твой класс: сначала корпус, потом куски, потом бижу.",
    ],
    advanceOn: "ok",
    lessonId: "chapter3_intro",
    cta: { label: "Дальше", action: "open_avatar" },
  },
  {
    id: "eyra_ng_chest",
    type: "say",
    lines: [
      "Держи нагрудник ученика (NG). Слабый, но свой kind. Надень — цифры P.Def/M.Def уже шевелятся.",
    ],
    advanceOn: "ok",
    grant: "ng_chest",
    gates: { chapterIntro: "orc_barracks", flag: "ch3_intro" },
    lessonId: "ng_armor_chest",
    cta: { label: "К персонажу", action: "open_avatar" },
  },
  {
    id: "eyra_ng_armor",
    type: "say",
    lines: [
      "Остальные куски того же сета: шлем, ноги, перчатки, сапоги. 2/4/5 шт. дают слабые бонусы — так устроены и D/C сеты в мастерской.",
    ],
    advanceOn: "ok",
    grant: "ng_armor",
    gates: { flag: "ng_chest_done" },
    lessonId: "ng_armor_set",
    cta: { label: "К персонажу", action: "open_avatar" },
  },
  {
    id: "eyra_ng_jewelry",
    type: "say",
    lines: [
      "Бижутерия: воину — резист, мистику — чуть быстрее КД. NG, не точится. Настоящие сеты D/C крафтишь в Мастерской из кусков с полей.",
    ],
    advanceOn: "ok",
    grant: "ng_jewelry",
    gates: { flag: "ng_armor_done" },
    lessonId: "ng_jewelry",
    highlight: "menu-workshop",
    cta: { label: "В мастерскую", action: "open_shop" },
  },
  {
    id: "eyra_ch4",
    type: "chapter_gate",
    zoneId: "dark_cavern",
    lines: [
      "Устал жать сам? На поле — автоудар. Пакеты 15/30/60 — рядом с Вкл. Не стыдно: стыдно смотреть, как цель уходит.",
    ],
    highlight: "mine-autoclicker",
    advanceOn: "ok",
    lessonId: "chapter4_intro",
    cta: { label: "На поле", action: "open_mine" },
  },
  {
    id: "eyra_ch5",
    type: "chapter_gate",
    zoneId: "dwarven_depths",
    lines: [
      "Последняя глава Прелюдии. Добей сюжет — потом охота без поручений.",
    ],
    advanceOn: "ok",
    lessonId: "chapter5_intro",
    cta: { label: "В Историю", action: "open_story" },
  },
  {
    id: "eyra_hunting",
    type: "say",
    lines: [
      "Обучение старейшин до десятого позади. Угодья без сюжета — открыты. Я рядом, если позовёшь в настройках.",
    ],
    advanceOn: "ok",
    gates: { flag: "hunting_graduated" },
    lessonId: "hunting_free",
    cta: { label: "К охоте", action: "open_farm" },
  },
  {
    id: "eyra_finale",
    type: "say",
    lines: [
      "Прелюдия спета. Дальше — хаос и чужие клинки. Меню забудешь — найдёшь меня в настройках.",
    ],
    advanceOn: "ok",
    gates: { flag: "prelude_finale_seen" },
    lessonId: "prelude_finale",
  },

  {
    id: "eyra_soft_avatar",
    type: "say",
    soft: true,
    lines: ["Здесь рост, класс, пассивы. Смотри цифры до боя."],
    advanceOn: "ok",
    gates: { screen: "avatar", lessonDone: "chapter1_core" },
    lessonId: "character_stats",
  },
  {
    id: "eyra_soft_ach",
    type: "say",
    soft: true,
    lines: ["Отметки пути. Награды падают сами."],
    advanceOn: "ok",
    gates: { screen: "ach", lessonDone: "chapter1_core" },
    lessonId: "achievements",
  },
];

function mentorBitById(id) {
  return MENTOR_BITS.find((b) => b.id === id) || null;
}
