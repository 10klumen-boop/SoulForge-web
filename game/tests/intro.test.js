// ===== Unit-тесты: intro-core.js (флаги пролога) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

// Моки для intro-core.js
global.migrateAvatar = () => {};
global.inventoryCount = () => 0;
global.save = () => {};
global.PRELUDE_EPIGRAPH = "Пролог";

loadScripts([
  "src/01-constants.js",
  "src/data/prologue-data.js",
  "src/progress-store.js",
  "src/intro-core.js",
]);

function resetState() {
  state.avatar = { created: true, raceId: "human", prologueSeen: false };
  state.storySeen = false;
  state.totals = { tries: 0, fails: 0, earned: 0 };
  state.adena = START_ADENA || 0;
  state.inventory = [];
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

  console.log("\n--- intro core ---");

  test("prologueForAvatar returns race prologue when available", () => {
    resetState();
    state.avatar.raceId = "elf";
    const p = prologueForAvatar();
    assert.strictEqual(p.title, "Эльфийский лес");
  });

  test("prologueForAvatar falls back to default for unknown race", () => {
    resetState();
    state.avatar.raceId = "unknown";
    const p = prologueForAvatar();
    assert.strictEqual(p.title, RACE_PROLOGUE.human.title);
  });

  test("prologueForAvatar falls back when no avatar", () => {
    state.avatar = null;
    const p = prologueForAvatar();
    assert.strictEqual(p.title, RACE_PROLOGUE.human.title);
  });

  test("prologueBodyHtml includes epigraph and paragraphs", () => {
    resetState();
    const html = prologueBodyHtml(prologueForAvatar());
    assert.ok(html.includes(PRELUDE_EPIGRAPH));
    assert.ok(html.includes("<p>"));
    assert.ok(html.includes("story-mechanic"));
  });

  test("needsIntro returns true for fresh avatar", () => {
    resetState();
    state.avatar.prologueSeen = false;
    assert.strictEqual(needsIntro(), true);
  });

  test("needsIntro returns false after prologue seen", () => {
    resetState();
    state.avatar.prologueSeen = true;
    assert.strictEqual(needsIntro(), false);
  });

  test("needsIntro returns false for guest with storySeen", () => {
    state.avatar = { created: false };
    state.storySeen = true;
    assert.strictEqual(needsIntro(), false);
  });

  test("needsIntro returns true for fresh guest", () => {
    state.avatar = { created: false };
    state.storySeen = false;
    state.totals = { tries: 0, fails: 0, earned: 0 };
    state.adena = START_ADENA || 0;
    assert.strictEqual(needsIntro(), true);
  });

  test("markStorySeen sets prologueSeen for avatar", () => {
    resetState();
    state.avatar.prologueSeen = false;
    markStorySeen();
    assert.strictEqual(state.avatar.prologueSeen, true);
  });

  test("markStorySeen sets storySeen for guest", () => {
    state.avatar = { created: false };
    state.storySeen = false;
    markStorySeen();
    assert.strictEqual(state.storySeen, true);
  });

  test("ensureStoryFlag marks storySeen for guest when intro not needed", () => {
    state.avatar = { created: false };
    state.storySeen = false;
    state.totals = { tries: 1, fails: 0, earned: 0 };
    ensureStoryFlag();
    assert.strictEqual(state.storySeen, true);
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed > 0) process.exit(1);
}

runTests();
