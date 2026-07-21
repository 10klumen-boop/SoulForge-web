// ===== Тестовый стенд: минимальные глобальные моки для vanilla JS модулей =====

global.state = { devTune: {} };

global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: { classList: { add: () => {}, remove: () => {}, toggle: () => {} }, dataset: {} },
  documentElement: { dataset: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: "",
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: {},
    hidden: false,
    textContent: "",
    innerHTML: "",
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    appendChild: () => {},
    remove: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    dataset: {},
  }),
};

global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  SoulforgeCloud: null,
  soulforgeDesktop: null,
  SOULFORGE_CLOUD: null,
};

global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
};

global.sessionStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
};

global.crypto = {
  randomUUID: () => "00000000-0000-0000-0000-000000000000",
};

global.location = { hostname: "localhost", port: "8787", protocol: "http:", origin: "http://localhost:8787" };

global.navigator = {};

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

global.console = console;

// Моки функций, которые 06-rules.js / 02-state.js проверяют через typeof
function ensureMockFunctions() {
  const names = [
    "avatarEnchantBonus", "avatarGearEnchantBonus", "weaponCanEnchant",
    "scrollTierIcon", "starterInventory", "defaultAvatarGear", "grantStarterWeapon",
    "initCharacters", "loadActiveCharacter", "migrateStarterWeapon", "refreshProgressUI",
    "save", "persistEnvelope", "makeEnvelope", "setLiveSeq", "applyLoadedSave",
    "flushActiveCharacterToSlot", "reconcileActiveCharacterProgress", "scheduleCloudSave",
    "ProgressStore", "gameLog", "toast", "show", "openHome", "updateHomeCharsSubtitle",
  ];
  names.forEach((n) => {
    if (typeof global[n] === "undefined") global[n] = undefined;
  });
}
ensureMockFunctions();

function loadScripts(paths) {
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  const code = paths
    .map((p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8"))
    .join("\n;\n");
  vm.runInThisContext(code, { filename: "test-bundle.js" });
}

module.exports = { loadScripts };
