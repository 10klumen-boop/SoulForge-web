// ===== Unit-тесты: avatar-stats-core.js =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.FARM_ZONES = [
  { id: "banana_mine", active: true, chapter: 1, reqLevel: 1, reqPower: 0, race: "human" },
  { id: "elven_ruins", active: true, chapter: 2, reqLevel: 5, reqPower: 100, race: "elf" },
  { id: "dwarven_depths", active: false, chapter: 3, reqLevel: 10, reqPower: 300, race: "dwarf" },
];
global.ZONE_RACE_BONUS = {};

global.farmZoneById = (id) => global.FARM_ZONES.find((z) => z.id === id);
global.avatarFarmPower = () => global._avatarPower || 50;
global.avatarStats = () => ({ patk: 30, matk: 20 });
global.avatarIsMystic = () => false;
global.ProgressStore = {
  set: (k, v) => { global.state[k] = v; },
  update: (k, fn) => { global.state[k] = fn(global.state[k]); },
};
global.save = () => {};
global.toast = () => {};
global.gameLog = () => {};
global.flushCloudSave = () => {};
global.logCharacterEvent = () => {};
global.zoneRaceView = (z) => ({ name: z.id, storyTag: "Chapter " + z.chapter, desc: z.id });
global.isPrevZoneChapterComplete = () => true;
global.prevFarmZone = () => null;
global.questStatusText = () => "";
global.mineDropGradeSummary = () => "D";
global.zoneStoryBeat = () => null;
global.avatarGearMineAdenaMult = () => 1;
global.farmZoneTargetPower = (z) => (z?.targetPower || 50 * (z?.chapter || 1));
global.fmt = (n) => String(n);
global.renderMenuHero = () => {};
global.renderMenuFarmHub = () => {};

global.state = {
  avatar: { created: true, raceId: "human", level: 5 },
  farmZone: "banana_mine",
  farmNotify: {},
};

global._avatarPower = 50;

loadScripts([
  "src/avatar-stats-core.js",
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

  console.log("\n--- avatar stats core ---");

  test("canEnterFarmZone allows starting zone", () => {
    assert.strictEqual(canEnterFarmZone(FARM_ZONES[0]), true);
  });

  test("canEnterFarmZone rejects underpowered zone", () => {
    global._avatarPower = 10;
    assert.strictEqual(canEnterFarmZone(FARM_ZONES[1]), false);
  });

  test("canEnterFarmZone allows zone when powerful enough", () => {
    global._avatarPower = 200;
    assert.strictEqual(canEnterFarmZone(FARM_ZONES[1]), true);
  });

  test("recommendedFarmZoneId picks highest available chapter", () => {
    global._avatarPower = 200;
    assert.strictEqual(recommendedFarmZoneId(), "elven_ruins");
  });

  test("selectFarmZone changes farmZone and returns true", () => {
    global._avatarPower = 200;
    const ok = selectFarmZone("elven_ruins");
    assert.strictEqual(ok, true);
    assert.strictEqual(state.farmZone, "elven_ruins");
  });

  test("selectFarmZone rejects inactive zone", () => {
    const ok = selectFarmZone("dwarven_depths");
    assert.strictEqual(ok, false);
  });

  test("farmZoneStatus returns power ratio", () => {
    global._avatarPower = 100;
    const st = farmZoneStatus(FARM_ZONES[1]);
    assert.strictEqual(st.ok, true);
    assert.ok(st.powerRatio > 0);
  });

  test("avatarMineRewardMult is within expected range", () => {
    global._avatarPower = 100;
    const mult = avatarMineRewardMult("banana_mine");
    assert.ok(mult >= 0.82);
    assert.ok(mult <= 1.58);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
