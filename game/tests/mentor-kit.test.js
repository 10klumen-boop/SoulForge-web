// ===== Unit-тесты: mentor practice kit =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.save = () => {};
global.toast = () => {};
global.gameLog = () => {};
global.$ = () => ({ textContent: "" });
global.renderMenu = () => {};
global.renderInventory = () => {};
global.uid = () => "u" + Math.random().toString(16).slice(2);
global.isInventoryFull = () => false;
global.markWeaponCollected = () => {};
global.isMysticArchetype = (c) => c === "mystic" || c === "wizard";
global.WMAP = {
  doom_hammer_182: { id: "doom_hammer_182", name: "Doom Hammer", grade: "D" },
  staff_of_magic_186: { id: "staff_of_magic_186", name: "Staff of Magic", grade: "D" },
};
global.addToInventory = (weaponId, meta) => {
  const it = { uid: uid(), id: weaponId, plus: 0, spent: 0 };
  state.inventory.push(it);
  return it;
};
global.addScroll = () => true;
global.ProgressStore = {
  set: (k, v) => { state[k] = v; },
  update: (k, fn) => { state[k] = fn(state[k]); },
};
global.state = {
  avatar: { created: true, classId: "fighter", raceId: "human" },
  inventory: [],
  adena: 0,
  materials: { soul: 0, spirit: 0 },
  crystals: { D: 0, C: 0, B: 0, A: 0 },
  mentor: { skipped: false, bitId: null, lineIndex: 0, doneBits: {}, doneLessons: {}, chapterIntroSeen: {}, started: false, kitGranted: false },
};

loadScripts([
  "src/data/mentor-kit-balance.js",
  "src/mentor-core.js",
  "src/mentor-kit-core.js",
]);

function reset() {
  state.inventory = [];
  state.adena = 0;
  state.materials = { soul: 0, spirit: 0 };
  state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  state.avatar.classId = "fighter";
  state.mentor = defaultMentorProgress();
}

function runTests() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try { fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { failed++; console.error("  ✗ " + name); console.error("    " + e.message); }
  }

  console.log("\n--- mentor kit ---");

  test("grantMentorPracticeKit once", () => {
    reset();
    let scrollQty = 0;
    global.addScroll = (t, typeId, grade, qty) => {
      scrollQty = qty;
      return true;
    };
    const r = grantMentorPracticeKit();
    assert.ok(r);
    assert.strictEqual(state.mentor.kitGranted, true);
    assert.ok(state.inventory.some((it) => it.id === "doom_hammer_182" && it.mentorKit));
    assert.ok(state.adena >= 300_000);
    assert.ok(state.materials.soul >= 40);
    assert.strictEqual(scrollQty, 4);
    assert.strictEqual(state.crystals.D, 0);
    assert.strictEqual(MENTOR_PRACTICE_KIT.scriptBreakAtPlus, 3);
    assert.strictEqual(grantMentorPracticeKit(), null);
  });

  test("mystic gets staff", () => {
    reset();
    state.avatar.classId = "mystic";
    const r = grantMentorPracticeKit();
    assert.ok(r);
    assert.ok(state.inventory.some((it) => it.id === "staff_of_magic_186"));
  });

  test("script roll: win until +3, break on +4 try", () => {
    reset();
    state.mentor.bitId = "eyra_enchant_btn";
    const kitItem = { uid: "m1", id: "doom_hammer_182", plus: 0, mentorKit: true };
    assert.strictEqual(mentorScriptEnchantRoll({ item: kitItem, plus: 0 }), true);
    assert.strictEqual(mentorScriptEnchantRoll({ item: kitItem, plus: 1 }), true);
    assert.strictEqual(mentorScriptEnchantRoll({ item: kitItem, plus: 2 }), true);
    assert.strictEqual(mentorScriptEnchantRoll({ item: kitItem, plus: 3 }), false);
    assert.strictEqual(mentorScriptEnchantRoll({ item: { plus: 3 }, plus: 3 }), null);
  });

  test("ensure shot crystals tops up to 6", () => {
    reset();
    state.crystals.D = 2;
    const add = mentorEnsureShotCraftCrystals();
    assert.strictEqual(add, 4);
    assert.strictEqual(state.crystals.D, 6);
  });

  console.log("\nMentor kit: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
