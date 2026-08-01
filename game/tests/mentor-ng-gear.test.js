// ===== Unit: mentor NG armor/jewelry gradual grant =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.save = () => {};
global.toast = () => {};
global.gameLog = () => {};
global.$ = () => ({ textContent: "" });
global.renderMenu = () => {};
global.renderInventory = () => {};
global.renderAvatarScreen = () => {};
global.uid = () => "u" + Math.random().toString(16).slice(2);
global.isInventoryFull = () => false;
global.isMysticArchetype = (c) => c === "mystic" || c === "wizard";
global.professionArmorPref = (a) => {
  if (global.isMysticArchetype(a?.classId)) return "robe";
  if (a?.classId === "rogue") return "light";
  return "heavy";
};
global.COLLECTIBLES = {};
global.ProgressStore = {
  set: (k, v) => { state[k] = v; },
  update: (k, fn) => { state[k] = fn(state[k]); },
};
global.state = {
  avatar: { created: true, classId: "fighter", raceId: "human", gear: {} },
  inventory: [],
  mentor: null,
};

global.ensureAvatarGear = () => {
  if (!state.avatar.gear) state.avatar.gear = {};
  return state.avatar.gear;
};
global.equipArmorToAvatar = (item) => {
  const def = AMAP[item.id];
  if (!def) return false;
  state.avatar.gear[def.slot] = item;
  return true;
};
global.equipAccessoryToAvatar = (item) => {
  const def = COLLECTIBLES[item.id] || accessoryDef(item);
  if (!def) return false;
  const st = def.slot;
  const order =
    st === "earring" ? ["earring_l", "earring_r"] :
    st === "ring" ? ["ring_l", "ring_r"] :
    ["necklace"];
  const gear = ensureAvatarGear();
  const target = order.find((sid) => !gear[sid]);
  if (!target) return false;
  gear[target] = item;
  return true;
};
global.addArmorToInventory = (armorId) => {
  const it = { uid: uid(), id: armorId, kind: "armor" };
  state.inventory.push(it);
  return it;
};
global.addCollectibleToInventory = (id) => {
  const it = { uid: uid(), id, kind: "accessory", plus: 0, spent: 0 };
  state.inventory.push(it);
  return it;
};
global.armorSlotType = (it) => (AMAP[it.id] && AMAP[it.id].slot) || null;
global.accessoryDef = (it) => {
  const id = typeof it === "string" ? it : it?.id;
  return COLLECTIBLES[id] || null;
};
global.mentorActiveScreen = () => "menu";

loadScripts([
  "src/data/armor-sets-data.js",
  "src/data/jewelry-sets-data.js",
  "src/data/mentor-ng-gear.js",
  "src/data/mentor-script.js",
  "src/mentor-core.js",
  "src/mentor-kit-core.js",
]);

// merge jewelry into COLLECTIBLES for tests (IIFE may have run if COLLECTIBLES existed empty)
JEWELRY.forEach((j) => {
  COLLECTIBLES[j.id] = {
    id: j.id,
    name: j.name,
    icon: j.icon,
    grade: j.grade,
    setId: j.setId,
    slot: j.slot,
    mdef: j.mdef,
    bonuses: Object.assign({}, j.bonuses),
    starter: !!j.starter,
  };
});

function reset(classId) {
  state.avatar = { created: true, classId: classId || "fighter", raceId: "human", gear: {} };
  state.inventory = [];
  state.mentor = defaultMentorProgress();
}

function runTests() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try { fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { failed++; console.error("  ✗ " + name); console.error("    " + e.message); }
  }

  console.log("\n--- mentor NG gear ---");

  test("NG armor sets exist for 3 kinds", () => {
    assert.ok(AMAP.ng_heavy_chest);
    assert.ok(AMAP.ng_light_chest);
    assert.ok(AMAP.ng_robe_chest);
    assert.strictEqual(AMAP.ng_heavy_chest.grade, "NG");
    assert.ok(ARMOR_SETS.ng_heavy.starter);
  });

  test("fighter gets heavy chest then armor", () => {
    reset("fighter");
    assert.strictEqual(mentorNgArmorKind(), "heavy");
    const r1 = grantMentorNgGearStep("chest");
    assert.ok(r1.ok);
    assert.ok(state.inventory.some((it) => it.id === "ng_heavy_chest"));
    assert.ok(state.avatar.gear.chest);
    const r2 = grantMentorNgGearStep("armor");
    assert.ok(r2.ok);
    assert.ok(state.inventory.filter((it) => String(it.id).startsWith("ng_heavy_")).length >= 5);
    assert.strictEqual(grantMentorNgGearStep("armor").ok, false);
  });

  test("mystic gets robe + adept jewelry", () => {
    reset("mystic");
    assert.strictEqual(mentorNgArmorKind(), "robe");
    assert.strictEqual(mentorNgJewelryRole(), "cdr");
    grantMentorNgGearStep("chest");
    assert.ok(state.inventory.some((it) => it.id === "ng_robe_chest"));
    const r = grantMentorNgGearStep("jewelry");
    assert.ok(r.ok);
    assert.ok(state.inventory.some((it) => it.id === "ng_adept_necklace"));
    assert.ok(state.inventory.filter((it) => it.id === "ng_adept_earring").length >= 2);
  });

  test("rogue light + guard jewelry", () => {
    reset("rogue");
    assert.strictEqual(mentorNgArmorKind(), "light");
    assert.strictEqual(mentorNgJewelryRole(), "resist");
    grantMentorNgGearStep("jewelry");
    assert.ok(state.inventory.some((it) => it.id === "ng_guard_ring"));
  });

  test("NG bits gated until chapter III intro", () => {
    // load script bits if available
    if (typeof MENTOR_BITS === "undefined") return;
    const chest = MENTOR_BITS.find((b) => b.id === "eyra_ng_chest");
    const armor = MENTOR_BITS.find((b) => b.id === "eyra_ng_armor");
    const jew = MENTOR_BITS.find((b) => b.id === "eyra_ng_jewelry");
    assert.ok(chest && chest.gates);
    assert.ok(chest.gates.chapterIntro === "orc_barracks" || chest.gates.flag === "ch3_intro");
    assert.ok(armor.gates && armor.gates.flag === "ng_chest_done");
    assert.ok(jew.gates && jew.gates.flag === "ng_armor_done");

    reset("fighter");
    state.mentor.doneBits = { eyra_loop: true };
    state.mentor.doneLessons = { chapter1_core: true };
    assert.strictEqual(mentorGatesOk(chest), false);
    state.mentor.chapterIntroSeen = { orc_barracks: true };
    state.mentor.doneBits.eyra_ch3 = true;
    assert.strictEqual(mentorGatesOk(chest), true);
    assert.strictEqual(mentorGatesOk(armor), false);
    state.mentor.doneBits.eyra_ng_chest = true;
    state.mentor.ngGearGranted = { chest: true, armor: false, jewelry: false };
    assert.strictEqual(mentorGatesOk(armor), true);
  });

  console.log("\nMentor NG gear: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
