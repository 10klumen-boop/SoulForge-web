// ===== Данные достижений: логика test/progress + hydrate из json/achievements.json =====
// Мета (title/desc/reward/иконки/категории) — в JSON. Правь контент там.

function achProg(cur, max) {
  max = Math.max(1, max || 1);
  return { current: Math.min(Math.max(0, cur || 0), max), max };
}

const ACH_LOGIC = {
  first_field: {
    test: (c) => c.mineVisits >= 1,
    progress: (c) => achProg(c.mineVisits, 1),
  },
  first_kill: {
    test: (c) => c.gnomesCaught >= 1,
    progress: (c) => achProg(c.gnomesCaught, 1),
  },
  miner10: {
    test: (c) => c.gnomesCaught >= 10,
    progress: (c) => achProg(c.gnomesCaught, 10),
  },
  miner25: {
    test: (c) => c.gnomesCaught >= 25,
    progress: (c) => achProg(c.gnomesCaught, 25),
  },
  miner50: {
    test: (c) => c.gnomesCaught >= 50,
    progress: (c) => achProg(c.gnomesCaught, 50),
  },
  golden_gnome: {
    test: (c) => c.goldenGnomes >= 1,
    progress: (c) => achProg(c.goldenGnomes, 1),
  },
  golden5: {
    test: (c) => c.goldenGnomes >= 5,
    progress: (c) => achProg(c.goldenGnomes, 5),
  },
  banan_hunter: {
    test: (c) => c.bananWins >= 1,
  },
  boss_slayer: {
    test: (c) => c.bossKills >= 1,
  },
  first_enchant: {
    test: (c) => c.tries >= 1,
    progress: (c) => achProg(c.tries, 1),
  },
  first_plus4: {
    test: (c) => c.maxPlus >= 4,
    progress: (c) => achProg(c.maxPlus, 4),
  },
  plus6: {
    test: (c) => c.maxPlus >= 6,
    progress: (c) => achProg(c.maxPlus, 6),
  },
  plus8: {
    test: (c) => c.maxPlus >= 8,
    progress: (c) => achProg(c.maxPlus, 8),
  },
  plus12: {
    test: (c) => c.maxPlus >= 12,
    progress: (c) => achProg(c.maxPlus, 12),
  },
  legend16: {
    test: (c) => c.maxPlus >= MAX_PLUS,
    progress: (c) => achProg(c.maxPlus, MAX_PLUS),
  },
  enchanter100: {
    test: (c) => c.tries >= 100,
    progress: (c) => achProg(c.tries, 100),
  },
  stubborn50: {
    test: (c) => c.fails >= 50,
    progress: (c) => achProg(c.fails, 50),
  },
  seller: {
    test: (c) => c.weaponsSold >= 1,
    progress: (c) => achProg(c.weaponsSold, 1),
  },
  sell_plus4: {
    test: (c) => c.maxSoldPlus >= 4,
    progress: (c) => achProg(c.maxSoldPlus, 4),
  },
  sell_high: {
    test: (c) => c.maxSoldPlus >= 12,
    progress: (c) => achProg(c.maxSoldPlus, 12),
  },
  rich1m: {
    test: (c) => c.earned >= 1_000_000,
    progress: (c) => achProg(c.earned, 1_000_000),
  },
  rich10m: {
    test: (c) => c.earned >= 10_000_000,
    progress: (c) => achProg(c.earned, 10_000_000),
  },
  rich100m: {
    test: (c) => c.earned >= 100_000_000,
    progress: (c) => achProg(c.earned, 100_000_000),
  },
  crystal_merchant: {
    test: (c) => c.crystalsSold >= 1,
  },
  zaken_earring: {
    test: (c) => c.hasZaken,
  },
  soul_awake: {
    test: (c) => c.avatarCreated,
    progress: (c) => achProg(c.avatarCreated ? 1 : 0, 1),
  },
  first_quest: {
    test: (c) => c.questSteps >= 1,
    progress: (c) => achProg(c.questSteps, 1),
  },
  level5: {
    test: (c) => c.avatarLevel >= 5,
    progress: (c) => achProg(c.avatarLevel, 5),
  },
  chapter1_done: {
    test: (c) => c.chapter1Complete,
  },
  story_elven_ruins: {
    test: (c) => c.storyElvenRuins,
  },
  story_orc_barracks: {
    test: (c) => c.storyOrcBarracks,
  },
  story_dark_cavern: {
    test: (c) => c.storyDarkCavern,
  },
  story_arc_half: {
    test: (c) => c.storyChaptersRead >= 3,
    progress: (c) => achProg(c.storyChaptersRead, 3),
  },
  prelude_quests_complete: {
    test: (c) => c.preludeChaptersComplete >= 5,
    progress: (c) => achProg(c.preludeChaptersComplete, 5),
  },
  story_arc_complete: {
    test: (c) => c.storyChaptersRead >= 5,
    progress: (c) => achProg(c.storyChaptersRead, 5),
  },
  first_craft: {
    test: (c) => c.shotsCrafted >= 1,
  },
  crafter100: {
    test: (c) => c.shotsCrafted >= 100,
    progress: (c) => achProg(c.shotsCrafted, 100),
  },
  coll_d_1: {
    test: (c) => c.collD >= 1,
    progress: (c) => achProg(c.collD, 1),
  },
  coll_d_10: {
    test: (c) => c.collD >= 10,
    progress: (c) => achProg(c.collD, 10),
  },
  coll_d_25: {
    test: (c) => c.collDTotal > 0 && c.collD >= c.collDTotal,
    progress: (c) => achProg(c.collD, c.collDTotal),
  },
  coll_c_1: {
    test: (c) => c.collC >= 1,
    progress: (c) => achProg(c.collC, 1),
  },
  coll_c_10: {
    test: (c) => c.collC >= 10,
    progress: (c) => achProg(c.collC, 10),
  },
  coll_c_25: {
    test: (c) => c.collCTotal > 0 && c.collC >= c.collCTotal,
    progress: (c) => achProg(c.collC, c.collCTotal),
  },
  coll_b_1: {
    test: (c) => c.collB >= 1,
    progress: (c) => achProg(c.collB, 1),
  },
  coll_b_10: {
    test: (c) => c.collB >= 10,
    progress: (c) => achProg(c.collB, 10),
  },
  coll_b_25: {
    test: (c) => c.collBTotal > 0 && c.collB >= c.collBTotal,
    progress: (c) => achProg(c.collB, c.collBTotal),
  },
  coll_a_1: {
    test: (c) => c.collA >= 1,
    progress: (c) => achProg(c.collA, 1),
  },
  coll_a_10: {
    test: (c) => c.collA >= 10,
    progress: (c) => achProg(c.collA, 10),
  },
  coll_a_25: {
    test: (c) => c.collATotal > 0 && c.collA >= c.collATotal,
    progress: (c) => achProg(c.collA, c.collATotal),
  },
  hidden_autoclicker: {
    test: (c) => c.mineGuardPenalties >= 1,
  },
  hidden_phantom_click: {
    test: (c) => c.mineGuardSynthetic >= 1,
  },
  hidden_spectator: {
    test: (c) => c.gnomesMissed >= 30,
    progress: (c) => achProg(c.gnomesMissed, 30),
  },
  hidden_night_smith: {
    test: (c) => c.nightEnchants >= 1,
  },
  hidden_banan_escape: {
    test: (c) => c.bananEscaped >= 1,
  },
  hidden_completionist: {
    test: () => typeof allPublicAchievementsUnlocked === "function" && allPublicAchievementsUnlocked(),
  },
  hidden_a_arsenal: {
    test: (c) => c.aGradeCollectionComplete,
    progress: (c) => achProg(c.collA, c.collATotal),
  },
  pt_soul: {
    test: (c) => c.avatarCreated,
    progress: (c) => achProg(c.avatarCreated ? 1 : 0, 1),
  },
  pt_field: {
    test: (c) => c.mineVisits >= 1,
    progress: (c) => achProg(c.mineVisits, 1),
  },
  pt_strike: {
    test: (c) => c.gnomesCaught >= 1,
    progress: (c) => achProg(c.gnomesCaught, 1),
  },
  pt_hammer: {
    test: (c) => c.tries >= 1,
    progress: (c) => achProg(c.tries, 1),
  },
  pt_trade: {
    test: (c) => c.weaponsSold >= 1,
    progress: (c) => achProg(c.weaponsSold, 1),
  },
  pt_grow: {
    test: (c) => c.avatarLevel >= 5,
    progress: (c) => achProg(c.avatarLevel, 5),
  },
  pt_boss: {
    test: (c) => c.bossKills >= 1,
    progress: (c) => achProg(c.bossKills, 1),
  },
  pt_chapter: {
    test: (c) => c.chapter1Complete,
    progress: (c) => achProg(c.chapter1Complete ? 1 : 0, 1),
  },
};

let ACH_ICON = "assets/ui/bloodhood_icon02_crop.png";
let ACH_ICON_VER = 3;
let ACH_ICON_MAP = {};
let ACH_ICON_WIKI = new Set();
let ACH_CATEGORIES = [];
let ACH_REWARD_IMAGE = "assets/achievements/secret_reward.jpg";
let ACH_SECRET_ICON = "icons/achievements/secret_complete.png?v=3";
let ACHIEVEMENTS = [];
let HIDDEN_ACHIEVEMENTS = [];
let PLAYTEST_CHECKLIST = [];
let ALL_ACHIEVEMENTS = [];

function achIconPath(stem) {
  return "icons/achievements/" + stem + ".png?v=" + ACH_ICON_VER;
}

function resolveAchIcon(ach) {
  if (!ach) return ACH_ICON;
  if (ACH_ICON_WIKI.has(ach.id) && ach.icon) return ach.icon;
  const stem = ACH_ICON_MAP[ach.id];
  if (stem) return achIconPath(stem);
  if (ach.hidden) return ACH_SECRET_ICON;
  return ach.icon || ACH_ICON;
}

function bindAchievementMeta(meta) {
  if (!meta || !meta.id) return null;
  const logic = ACH_LOGIC[meta.id] || {};
  const out = Object.assign({}, meta);
  out.test = logic.test || function () { return false; };
  if (logic.progress) out.progress = logic.progress;
  return out;
}

function bindAchievementList(list) {
  return (list || []).map(bindAchievementMeta).filter(Boolean);
}

/** Подтянуть meta с globalThis (JSON) в let-биндинги — window.* и let не одно и то же. */
function hydrateAchievementGlobalsFromJson() {
  const g = typeof globalThis !== "undefined" ? globalThis : window;
  if (typeof g.ACH_ICON === "string") ACH_ICON = g.ACH_ICON;
  if (typeof g.ACH_ICON_VER === "number") ACH_ICON_VER = g.ACH_ICON_VER;
  if (g.ACH_ICON_MAP && typeof g.ACH_ICON_MAP === "object") ACH_ICON_MAP = g.ACH_ICON_MAP;
  if (Array.isArray(g.ACH_CATEGORIES)) ACH_CATEGORIES = g.ACH_CATEGORIES;
  if (typeof g.ACH_REWARD_IMAGE === "string") ACH_REWARD_IMAGE = g.ACH_REWARD_IMAGE;
  const wiki = g.ACH_ICON_WIKI;
  if (Array.isArray(wiki)) ACH_ICON_WIKI = new Set(wiki);
  else if (wiki instanceof Set) ACH_ICON_WIKI = wiki;
  else ACH_ICON_WIKI = new Set();
  ACH_SECRET_ICON = achIconPath("secret_complete");
}

/** Собрать ACHIEVEMENTS / HIDDEN / PLAYTEST / ALL из *_META (после loadGameJsonData). */
function rebuildAchievementsFromMeta() {
  const g = typeof globalThis !== "undefined" ? globalThis : window;
  const meta = g.ACHIEVEMENTS_META;
  if (!meta || !Array.isArray(meta)) {
    console.warn("rebuildAchievementsFromMeta: ACHIEVEMENTS_META missing");
    return false;
  }
  hydrateAchievementGlobalsFromJson();
  ACHIEVEMENTS = bindAchievementList(meta);
  HIDDEN_ACHIEVEMENTS = bindAchievementList(g.HIDDEN_ACHIEVEMENTS_META);
  HIDDEN_ACHIEVEMENTS.forEach((a) => { a.category = "secret"; });
  PLAYTEST_CHECKLIST = bindAchievementList(g.PLAYTEST_CHECKLIST_META);
  ALL_ACHIEVEMENTS = ACHIEVEMENTS.concat(HIDDEN_ACHIEVEMENTS);
  return true;
}
