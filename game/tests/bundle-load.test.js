// ===== Контрольный срез: загрузка всего бандла из index.html =====
// Цель — убедиться, что все скрипты в правильном порядке не падают на этапе инициализации.
const fs = require("fs");
const path = require("path");
const { loadScripts, loadGameJsonDataSync } = require("./setup");

// Минимальные DOM-моки для bootstrap
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// Более полный DOM-мок для bundle-загрузки (boot обращается к многим элементам)
function createMockElement(tag) {
  const el = {
    tagName: (tag || "DIV").toUpperCase(),
    className: "",
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: {},
    hidden: false,
    textContent: "",
    innerHTML: "",
    dataset: {},
    children: [],
    firstChild: null,
    childNodes: [],
    parentNode: null,
    setAttribute: function () {},
    getAttribute: function () { return null; },
    removeAttribute: function () {},
    appendChild: function (c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
    remove: function () {},
    removeChild: function () {},
    querySelector: function () { return createMockElement(); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
    removeEventListener: function () {},
    focus: function () {},
    get onclick() { return null; },
    set onclick(v) {},
    get onchange() { return null; },
    set onchange(v) {},
    get oninput() { return null; },
    set oninput(v) {},
  };
  return el;
}

const _mockElementMap = {};
global.document = {
  body: createMockElement("body"),
  documentElement: { dataset: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
  getElementById: (id) => {
    if (!_mockElementMap[id]) _mockElementMap[id] = createMockElement();
    return _mockElementMap[id];
  },
  querySelector: (sel) => {
    if (sel.startsWith("#")) return global.document.getElementById(sel.slice(1));
    return createMockElement();
  },
  querySelectorAll: () => [],
  createElement: (tag) => createMockElement(tag),
  addEventListener: () => {},
};
const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/g)]
  .map((m) => m[1])
  .filter((s) => s.startsWith("src/") && !s.includes("/tests/"))
  .map((s) => s.replace(/\?v=\d+/, "")); // strip cache-buster

const noopFns = [
  "renderMenu", "renderMenuHero", "renderMenuFarmHub", "renderMineBanner",
  "renderAvatarStatsPanel", "renderAvatarSkillsPanel", "renderMineSkillBar",
  "renderQuestJournal", "renderStoryArcBar", "renderAchievements", "renderStoryPanel",
  "updateAdena", "updateMaterials", "updateCrystals", "updateInventory", "updateAvatarStats",
  "show", "toast", "gameLog", "logCharacterEvent", "save", "persistEnvelope", "makeEnvelope",
  "setLiveSeq", "applyLoadedSave", "flushActiveCharacterToSlot", "reconcileActiveCharacterProgress",
  "scheduleCloudSave", "flushCloudSave", "setGamePaused", "syncGamePauseState", "openHome",
  "updateHomeCharsSubtitle", "initCharacters", "loadActiveCharacter", "migrateStarterWeapon",
  "refreshProgressUI", "migrateAvatar", "migrateQuestProgress", "refreshZoneStoryUnlocks",
  "isZoneChapterComplete", "isPrevZoneChapterComplete", "prevFarmZone", "questStatusText",
  "mineDropGradeSummary", "zoneStoryBeat", "uiZoneChipIcon", "playtestIncome", "avatarGearMineAdenaMult",
  "weaponCanEnchant", "avatarEnchantBonus", "avatarGearEnchantBonus", "scrollTierIcon",
  "starterInventory", "defaultAvatarGear", "grantStarterWeapon", "finishMobKill", "checkMobEnrage",
  "mineBurst", "floatText", "gnomeDropPoint", "updateMobHpBar", "applyMobShieldDamage",
  "avatarMineClickDamage", "applyMineShotDamageMult", "inventoryCount", "fmtCombat", "fmtAdena",
  "tune", "checkAchievements", "openAchievements", "ensureWorkshopState", "avatarFarmPower",
  "avatarStats", "avatarIsMystic", "farmZoneById", "zoneRaceView", "isMysticArchetype",
  "isGamePaused", "setWriteLockBanner", "handleWriteLeaseLost", "acquireWriteLease", "releaseWriteLease",
];
noopFns.forEach((n) => { if (typeof global[n] === "undefined") global[n] = () => {}; });

// Прогресс-хранилище для загрузки (реальный ProgressStore подгрузится сам)
if (typeof global.ProgressStore === "undefined") {
  global.ProgressStore = { set: () => {}, update: () => {}, get: () => {} };
}

global.Audio = class Audio {
  constructor() {
    this.volume = 1; this.loop = false; this.paused = true; this.currentTime = 0;
    this.dataset = {};
  }
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
  addEventListener() {}
  removeEventListener() {}
};
global.mineGnomes = { *[Symbol.iterator]() { yield* []; }, has: () => false };
global.Audio2 = { click: () => {}, playMusic: () => {}, stopMusic: () => {}, setMute: () => {} };
global.mineActive = false;
global.isGamePaused = () => false;
global.state = {
  devTune: {}, avatar: { created: true, raceId: "human", classId: "fighter", level: 1 },
  characters: [], achievements: { unlocked: {}, stats: {} }, storyProgress: {}, farmNotify: {},
  farmZone: "banana_mine", materials: { soul: 0, spirit: 0 }, crystals: { D: 0, C: 0, B: 0, A: 0 },
  inventory: [], adena: 0, settings: {}, totals: { tries: 0, fails: 0, earned: 0 },
};

console.log("\n--- bundle load ---");
loadGameJsonDataSync();
console.log("Loading " + scriptSrcs.length + " scripts from index.html");

try {
  loadScripts(scriptSrcs);
  if (typeof rebuildAchievementsFromMeta === "function") rebuildAchievementsFromMeta();
  console.log("  ✓ bundle loaded without errors");
  console.log("\n--- summary ---");
  console.log("passed: 1, failed: 0");
} catch (e) {
  console.error("  ✗ bundle load failed: " + e.message);
  console.error("    at " + (e.stack || "").split("\n").slice(0, 3).join("\n    "));
  console.log("\n--- summary ---");
  console.log("passed: 0, failed: 1");
  process.exit(1);
}
process.exit(0);
