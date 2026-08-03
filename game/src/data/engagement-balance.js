// ===== Данные: ежедневные / еженедельные поручения + login streak =====
// Adena в современной шкале ECONOMY (гл.I ~9.6kk/час). grantEngagementReward → playtestIncome.

const ENGAGEMENT = {
  dailyCount: 4,
  weeklyCount: 3,
  /** Всегда в daily-наборе. */
  dailyFixedIds: ["login", "instance_clear_1"],
  /** Всегда в weekly-наборе. */
  weeklyFixedIds: ["instance_clear_2"],
  /** Bump → пересобрать текущие наборы (без сброса чужого прогресса по id). */
  rosterVer: 2,
  streakDisplayDays: 7,
  /** Награду стрика можно забрать только при полном цикле. */
  streakClaimMinDays: 7,
  iconVer: 1,
};

const ENGAGEMENT_ICON_BASE = "icons/engagement/";

/** Тематические иконки (256×256). */
const ENGAGEMENT_ICONS = {
  login: ENGAGEMENT_ICON_BASE + "login.png?v=" + ENGAGEMENT.iconVer,
  farm_kills: ENGAGEMENT_ICON_BASE + "farm_kills.png?v=" + ENGAGEMENT.iconVer,
  farm_golden: ENGAGEMENT_ICON_BASE + "farm_golden.png?v=" + ENGAGEMENT.iconVer,
  enchant: ENGAGEMENT_ICON_BASE + "enchant.png?v=" + ENGAGEMENT.iconVer,
  quest: ENGAGEMENT_ICON_BASE + "quest.png?v=" + ENGAGEMENT.iconVer,
  workshop: ENGAGEMENT_ICON_BASE + "workshop.png?v=" + ENGAGEMENT.iconVer,
  mine_visit: ENGAGEMENT_ICON_BASE + "mine_visit.png?v=" + ENGAGEMENT.iconVer,
  instance: ENGAGEMENT_ICON_BASE + "instance.png?v=" + ENGAGEMENT.iconVer,
  pvp: ENGAGEMENT_ICON_BASE + "pvp.png?v=" + ENGAGEMENT.iconVer,
  zone_boss: ENGAGEMENT_ICON_BASE + "zone_boss.png?v=" + ENGAGEMENT.iconVer,
  streak: ENGAGEMENT_ICON_BASE + "streak.png?v=" + ENGAGEMENT.iconVer,
  milestone: ENGAGEMENT_ICON_BASE + "milestone.png?v=" + ENGAGEMENT.iconVer,
  menu: ENGAGEMENT_ICON_BASE + "quest.png?v=" + ENGAGEMENT.iconVer,
};

function engagementIconUrl(key) {
  return ENGAGEMENT_ICONS[key] || ENGAGEMENT_ICONS.quest;
}

function resolveEngagementIcon(taskOrKey) {
  if (!taskOrKey) return engagementIconUrl("quest");
  if (typeof taskOrKey === "string") return engagementIconUrl(taskOrKey);
  if (taskOrKey.icon) return engagementIconUrl(taskOrKey.icon);
  return engagementIconUrl("quest");
}

/** Пул ежедневных заданий. event + match → engagementEmit. */
const ENGAGEMENT_DAILY_POOL = [
  {
    id: "login",
    period: "daily",
    title: "Ежедневный вход",
    desc: "Зайти в игру сегодня",
    target: 1,
    event: "login",
    icon: "login",
    reward: { adena: 400_000 },
  },
  {
    id: "farm_kills_30",
    period: "daily",
    title: "Охотник дня",
    desc: "Убить 30 мобов на поле",
    target: 30,
    event: "mob_kill",
    icon: "farm_kills",
    reward: { adena: 800_000 },
  },
  {
    id: "farm_golden_3",
    period: "daily",
    title: "Золотая добыча",
    desc: "Победить 3 золотых цели",
    target: 3,
    event: "mob_kill",
    match: { type: "golden" },
    icon: "farm_golden",
    reward: { adena: 1_000_000, ore: { soul: 5 } },
  },
  {
    id: "enchant_5",
    period: "daily",
    title: "Рука мастера",
    desc: "Совершить 5 попыток заточки",
    target: 5,
    event: "enchant",
    icon: "enchant",
    reward: { adena: 700_000 },
  },
  {
    id: "quest_step_1",
    period: "daily",
    title: "Поручение дня",
    desc: "Завершить 1 шаг сюжетного поручения",
    target: 1,
    event: "quest_step",
    icon: "quest",
    reward: { adena: 900_000 },
  },
  {
    id: "workshop_craft_1",
    period: "daily",
    title: "Мастерская",
    desc: "Скрафтить или купить руду в мастерской",
    target: 1,
    event: "workshop",
    icon: "workshop",
    reward: { adena: 500_000, ore: { spirit: 3 } },
  },
  {
    id: "mine_visit_1",
    period: "daily",
    title: "В поле",
    desc: "Открыть зону фарма",
    target: 1,
    event: "mine_enter",
    icon: "mine_visit",
    reward: { adena: 350_000 },
  },
  {
    id: "instance_clear_1",
    period: "daily",
    title: "Инстанс дня",
    desc: "Пройти групповой инстанс",
    target: 1,
    event: "instance_clear",
    icon: "instance",
    reward: { adena: 1_200_000, ore: { soul: 8 } },
  },
  {
    id: "pvp_fight_1",
    period: "daily",
    title: "Арена дня",
    desc: "Сыграть бой на арене (дуэль, тень или тренировка)",
    target: 1,
    event: "pvp",
    icon: "pvp",
    reward: { adena: 600_000 },
  },
];

const ENGAGEMENT_WEEKLY_POOL = [
  {
    id: "farm_kills_200",
    period: "weekly",
    title: "Недельный зачистчик",
    desc: "Убить 200 мобов",
    target: 200,
    event: "mob_kill",
    icon: "farm_kills",
    reward: { adena: 4_000_000 },
  },
  {
    id: "farm_golden_15",
    period: "weekly",
    title: "Золотая неделя",
    desc: "Победить 15 золотых целей",
    target: 15,
    event: "mob_kill",
    match: { type: "golden" },
    icon: "farm_golden",
    reward: { adena: 5_000_000, ore: { soul: 20 } },
  },
  {
    id: "enchant_25",
    period: "weekly",
    title: "Заточник недели",
    desc: "Совершить 25 попыток заточки",
    target: 25,
    event: "enchant",
    icon: "enchant",
    reward: { adena: 4_500_000 },
  },
  {
    id: "quest_steps_3",
    period: "weekly",
    title: "Сюжетная неделя",
    desc: "Завершить 3 шага поручений",
    target: 3,
    event: "quest_step",
    icon: "quest",
    reward: { adena: 5_000_000 },
  },
  {
    id: "chapter_or_boss_1",
    period: "weekly",
    title: "Гроза боссов",
    desc: "Победить зонального босса / закрыть главу",
    target: 1,
    event: "zone_boss",
    icon: "zone_boss",
    reward: { adena: 6_000_000, ore: { spirit: 15 } },
  },
  {
    id: "instance_clear_2",
    period: "weekly",
    title: "Рейдер недели",
    desc: "Пройти 2 групповых инстанса",
    target: 2,
    event: "instance_clear",
    icon: "instance",
    reward: { adena: 7_000_000, ore: { soul: 25, spirit: 15 } },
  },
  {
    id: "pvp_wins_3",
    period: "weekly",
    title: "Гладиатор недели",
    desc: "Одержать 3 победы на арене (дуэль или тень)",
    target: 3,
    event: "pvp",
    match: { youWin: true, excludeMode: "practice" },
    icon: "pvp",
    reward: { adena: 6_500_000, ore: { spirit: 20 } },
  },
];

const ENGAGEMENT_DAILY_MILESTONE = {
  id: "daily_milestone",
  title: "Комплект дня",
  desc: "Забрать все ежедневные поручения",
  icon: "milestone",
  reward: { adena: 1_500_000, autoClickerMs: 15 * 60 * 1000 },
};

const ENGAGEMENT_WEEKLY_MILESTONE = {
  id: "weekly_milestone",
  title: "Комплект недели",
  desc: "Забрать все еженедельные поручения",
  icon: "milestone",
  reward: { adena: 12_000_000, ore: { soul: 40, spirit: 40 } },
};

/** Индекс 0 = день 1 … день 7 = полный стрик (единственная claimable-награда). */
const ENGAGEMENT_STREAK_REWARDS = [
  { adena: 150_000 },
  { adena: 250_000 },
  { adena: 450_000, ore: { soul: 3 } },
  { adena: 600_000 },
  { adena: 900_000, ore: { spirit: 5 } },
  { adena: 1_200_000 },
  { adena: 2_000_000, ore: { soul: 10, spirit: 10 }, autoClickerMs: 15 * 60 * 1000 },
];

function engagementStreakFullDays() {
  return Math.max(
    1,
    Math.floor(Number(ENGAGEMENT.streakClaimMinDays) || ENGAGEMENT.streakDisplayDays || 7)
  );
}

function engagementStreakIsFull(streak) {
  return Math.max(0, Math.floor(Number(streak) || 0)) >= engagementStreakFullDays();
}

function engagementStreakReward(streak) {
  // Claim всегда выдаёт награду полного цикла (последняя ступень).
  const full = engagementStreakFullDays();
  const idx = Math.min(ENGAGEMENT_STREAK_REWARDS.length - 1, full - 1);
  void streak;
  return ENGAGEMENT_STREAK_REWARDS[idx];
}

function defaultEngagementState() {
  return {
    dailyPeriod: "",
    weeklyPeriod: "",
    dailyIds: [],
    weeklyIds: [],
    progress: {},
    claimed: {},
    dailyMilestoneClaimed: false,
    weeklyMilestoneClaimed: false,
    lastLoginDay: "",
    loginStreak: 0,
    streakClaimedDay: "",
    rosterVer: 0,
  };
}

function engagementTaskById(id) {
  return (
    ENGAGEMENT_DAILY_POOL.find((t) => t.id === id) ||
    ENGAGEMENT_WEEKLY_POOL.find((t) => t.id === id) ||
    null
  );
}

if (typeof window !== "undefined") {
  window.ENGAGEMENT = ENGAGEMENT;
  window.ENGAGEMENT_ICONS = ENGAGEMENT_ICONS;
  window.ENGAGEMENT_DAILY_POOL = ENGAGEMENT_DAILY_POOL;
  window.ENGAGEMENT_WEEKLY_POOL = ENGAGEMENT_WEEKLY_POOL;
  window.ENGAGEMENT_DAILY_MILESTONE = ENGAGEMENT_DAILY_MILESTONE;
  window.ENGAGEMENT_WEEKLY_MILESTONE = ENGAGEMENT_WEEKLY_MILESTONE;
  window.ENGAGEMENT_STREAK_REWARDS = ENGAGEMENT_STREAK_REWARDS;
  window.defaultEngagementState = defaultEngagementState;
  window.engagementTaskById = engagementTaskById;
  window.engagementStreakFullDays = engagementStreakFullDays;
  window.engagementStreakIsFull = engagementStreakIsFull;
  window.engagementStreakReward = engagementStreakReward;
  window.engagementIconUrl = engagementIconUrl;
  window.resolveEngagementIcon = resolveEngagementIcon;
}
