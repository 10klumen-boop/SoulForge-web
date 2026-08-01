// ===== Unit-тесты: mentor-core =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.migrateAvatar = () => {};
global.inventoryCount = () => 0;
global.save = () => {};
global.weaponCanEnchant = (w) => !!(w && w.grade && w.grade !== "NG");
global.isStoryBackdropOpen = () => false;
global.needsIntro = () => false;
global.isInCharacterSession = () => true;
global.renderMentorUI = () => {};
global.hideMentorUI = () => {};
global.toast = () => {};

loadScripts([
  "src/01-constants.js",
  "src/progress-store.js",
  "src/data/mentor-npc.js",
  "src/data/mentor-script.js",
  "src/mentor-core.js",
]);

function resetMentor() {
  state.avatar = { created: true, raceId: "human", prologueSeen: true, gear: { weapon: { grade: "NG" } } };
  state.inventory = [];
  state.farmZone = "banana_mine";
  state.storyProgress = { chaptersSeen: {}, unlocksShown: {} };
  state.questProgress = { completed: {}, kills: {}, goldenKills: {}, bosses: {}, briefings: {}, chapterRewards: {}, stepRewards: {}, bossQueued: {}, bossGrind: {} };
  state.mentor = Object.assign(defaultMentorProgress(), { autoStart: true, skipped: false });
  global.document.querySelector = () => null;
  global.document.getElementById = () => null;
}

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

  console.log("\n--- mentor core ---");

  test("MENTOR_NPC is Yuchi", () => {
    assert.strictEqual(MENTOR_NPC.name, "Ючи");
    assert.ok(MENTOR_NPC.avatar);
    assert.ok(MENTOR_NPC.emotions.happy);
  });

  test("mentorEmotionForBit maps farm to angry", () => {
    assert.strictEqual(mentorEmotionForBit({ id: "eyra_farm_click" }), "angry");
    assert.strictEqual(mentorEmotionForBit({ id: "eyra_finale" }), "sad");
  });

  test("defaultMentorProgress shape", () => {
    const m = defaultMentorProgress();
    assert.strictEqual(m.skipped, false);
    assert.strictEqual(m.autoStart, false);
    assert.strictEqual(m.bitId, null);
    assert.ok(m.doneBits);
  });

  test("legacy mentor without autoStart is skipped (no auto for veterans)", () => {
    state.avatar = { created: true, raceId: "human", prologueSeen: true };
    state.mentor = {
      skipped: false,
      bitId: null,
      lineIndex: 0,
      doneBits: {},
      doneLessons: {},
      chapterIntroSeen: {},
      started: false,
    };
    ensureMentorProgress();
    assert.strictEqual(state.mentor.autoStart, false);
    assert.strictEqual(state.mentor.skipped, true);
    assert.strictEqual(mentorMayAutoShow(), false);
    assert.strictEqual(mentorShouldStart(), false);
  });

  test("engaged legacy mentor keeps autoStart", () => {
    state.avatar = { created: true, raceId: "human", prologueSeen: true };
    state.mentor = {
      skipped: false,
      bitId: "eyra_hello",
      lineIndex: 0,
      doneBits: {},
      doneLessons: {},
      chapterIntroSeen: {},
      started: true,
    };
    ensureMentorProgress();
    assert.strictEqual(state.mentor.autoStart, true);
    assert.strictEqual(state.mentor.skipped, false);
    assert.strictEqual(mentorMayAutoShow(), true);
  });

  test("new character autoStart allows mentor", () => {
    resetMentor();
    assert.strictEqual(state.mentor.autoStart, true);
    assert.strictEqual(mentorMayAutoShow(), true);
    assert.strictEqual(mentorShouldStart(), true);
  });

  test("pick first bit eyra_hello", () => {
    resetMentor();
    const bit = mentorPickNextBit();
    assert.ok(bit);
    assert.strictEqual(bit.id, "eyra_hello");
  });

  test("skip blocks resume", () => {
    resetMentor();
    mentorSkip();
    assert.strictEqual(state.mentor.skipped, true);
    assert.strictEqual(mentorPickNextBit(), null);
  });

  test("complete hello advances to hub_story", () => {
    resetMentor();
    mentorSetActiveBit(mentorBitById("eyra_hello"));
    mentorCompleteCurrentBit();
    assert.ok(state.mentor.doneBits.eyra_hello);
    const next = mentorPickNextBit();
    assert.strictEqual(next && next.id, "eyra_hub_story");
  });

  test("enchantable gate detects D grade", () => {
    resetMentor();
    assert.strictEqual(mentorHasEnchantableWeapon(), false);
    state.avatar.gear.weapon = { grade: "D", name: "Test" };
    assert.strictEqual(mentorHasEnchantableWeapon(), true);
  });

  test("mentorEmit advances waiting bit", () => {
    resetMentor();
    mentorPatch((m) => {
      m.doneBits = { eyra_hello: true };
      m.bitId = "eyra_hub_story";
      m.started = true;
      return m;
    });
    mentorEmit("hub_story");
    assert.ok(state.mentor.doneBits.eyra_hub_story);
  });

  test("ProgressStore accepts mentor key", () => {
    assert.strictEqual(ProgressStore.isProgressKey("mentor"), true);
  });

  console.log("\nMentor: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
