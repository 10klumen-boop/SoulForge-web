// ===== Unit-тесты: prelude-finale-core.js =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.FARM_ZONES = [
  { id: "banana_mine", active: true, chapter: 1 },
  { id: "elven_ruins", active: true, chapter: 2 },
  { id: "dwarven_depths", active: true, chapter: 3 },
];
global.state = { avatar: { created: true, raceId: "human" }, storyProgress: {} };
global.ensureStoryProgress = () => {
  if (!state.storyProgress) state.storyProgress = {};
};
global.isZoneChapterComplete = (id) => global._completedZones?.has(id) || false;
global.playtestIncome = (n) => n;
global.ProgressStore = {
  set: (k, v) => { global.state[k] = v; },
  update: (k, fn) => { global.state[k] = fn(global.state[k]); },
};
global.ensureWorkshopState = () => {};
global.save = () => {};
global.$ = () => ({ textContent: "" });
global.gameLog = () => {};
global.STORY_ARC = { finaleTease: "Хаос ждёт." };

global._completedZones = new Set();

global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);

loadScripts([
  "src/prelude-finale-core.js",
]);

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log("  ✓ " + name);
    } catch (e) {
      failed++;
      console.error("  ✗ " + name);
      console.error("    " + e.message);
    }
  }

  console.log("\n--- prelude finale core ---");

  test("isPreludeComplete returns false when no zones complete", () => {
    global._completedZones = new Set();
    assert.strictEqual(isPreludeComplete(), false);
  });

  test("isPreludeComplete returns true when all zones complete", () => {
    global._completedZones = new Set(["banana_mine", "elven_ruins", "dwarven_depths"]);
    assert.strictEqual(isPreludeComplete(), true);
  });

  test("preludeFinaleSeen returns false initially", () => {
    state.storyProgress = {};
    assert.strictEqual(preludeFinaleSeen(), false);
  });

  test("preludeFinaleEpilogue returns human epilogue", () => {
    const ep = preludeFinaleEpilogue();
    assert.ok(ep.title);
    assert.ok(ep.paragraphs.length > 0);
  });

  test("applyPreludeFinaleReward marks finale seen and unlocks chaos", () => {
    state.adena = 0;
    state.materials = { soul: 0, spirit: 0 };
    state.crystals = { D: 0, C: 0, B: 0, A: 0 };
    state.storyProgress = {};
    applyPreludeFinaleReward();
    assert.strictEqual(state.storyProgress.preludeFinaleSeen, true);
    assert.strictEqual(state.storyProgress.chaosUnlocked, true);
    assert.ok(state.adena > 0);
    assert.ok(state.materials.soul > 0);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
