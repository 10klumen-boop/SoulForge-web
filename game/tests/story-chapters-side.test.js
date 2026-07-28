// ===== Unit: story chaptersSeen не считает side-фарм =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.FARM_ZONES = [
  { id: "banana_mine", chapter: 1, active: true },
  { id: "elven_ruins", chapter: 2, active: true },
  { id: "wasteland", chapter: 1, side: true, active: true },
  { id: "abandoned_coal_low", chapter: 2, side: true, active: true },
  { id: "orc_barracks", chapter: 3, active: true },
  { id: "dark_cavern", chapter: 4, active: true },
  { id: "dwarven_depths", chapter: 5, active: true },
];
global.STORY_BEATS = {};
global.RACE_THREADS = { human: { summary: "" } };
global.RACE_HERO = {};
global.STORY_ARC = {};
global.ZONE_RACE_BONUS = {};
global.state = {
  avatar: { created: true, raceId: "human", prologueSeen: true },
  storyProgress: {
    chaptersSeen: {
      banana_mine: true,
      wasteland: true,
      abandoned_coal_low: true,
      elven_ruins: true,
    },
    unlocksShown: { wasteland: true },
  },
};
global.ProgressStore = {
  set(k, v) {
    state[k] = v;
  },
  update(k, fn) {
    state[k] = fn(state[k]);
  },
};
global.save = () => {};

loadScripts(["src/story-zones-core.js"]);

function run() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try {
      fn();
      console.log("  ✓ " + name);
      passed++;
    } catch (e) {
      console.log("  ✗ " + name);
      console.log("    " + (e && e.message ? e.message : e));
      failed++;
    }
  }
  console.log("\n--- story chapters side filter ---");

  test("ensureStoryProgress strips side chaptersSeen", () => {
    ensureStoryProgress();
    assert.ok(!state.storyProgress.chaptersSeen.wasteland);
    assert.ok(!state.storyProgress.chaptersSeen.abandoned_coal_low);
    assert.ok(state.storyProgress.chaptersSeen.banana_mine);
    assert.ok(state.storyProgress.chaptersSeen.elven_ruins);
  });

  test("markStoryChapterSeen ignores side zones", () => {
    markStoryChapterSeen("wasteland");
    assert.ok(!state.storyProgress.chaptersSeen.wasteland);
    markStoryChapterSeen("orc_barracks");
    assert.ok(state.storyProgress.chaptersSeen.orc_barracks);
  });

  test("storyChaptersDoneCount only story zones", () => {
    assert.strictEqual(storyChaptersDoneCount(), 3); // banana, elven, orc
  });

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

run();
