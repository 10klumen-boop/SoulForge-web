// ===== Unit: overflow loot when inventory is full =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.INV_CAP = 2;
global.state = {
  avatar: { created: true, name: "Hero", raceId: "human", classId: "fighter" },
  inventory: [],
  overflowLoot: [],
  farmZone: "banana_mine",
  materials: {},
  crystals: { D: 0, C: 0, B: 0, A: 0 },
  activeCharacterId: "c1",
  characters: [],
};

global.ProgressStore = {
  set(key, val) {
    state[key] = val;
  },
  update(key, fn) {
    state[key] = fn(state[key]);
  },
};
global.save = () => {};
global.toast = () => {};
global.renderMenu = () => {};
global.uid = () => "u" + Math.random().toString(36).slice(2, 8);
global.WMAP = {
  sword_d: { id: "sword_d", name: "Sword D", grade: "D", icon: "x.png" },
  sword_c: { id: "sword_c", name: "Sword C", grade: "C", icon: "x.png" },
  sword_b: { id: "sword_b", name: "Sword B", grade: "B", icon: "x.png" },
};
global.COLLECTIBLES = {
  zaken_earring: { id: "zaken_earring", name: "Zaken", slot: "earring" },
};
global.ACCESSORY_FRAGS = {};
global.markWeaponCollected = () => {};
global.checkAchievements = () => {};
global.logCharacterEvent = () => {};
global.achStat = () => {};

loadScripts(["src/09-inventory.js"]);

function test(name, fn) {
  try {
    fn();
    console.log("  ok  " + name);
  } catch (e) {
    console.error("  FAIL  " + name);
    throw e;
  }
}

console.log("overflow-loot.test.js");

test("full inv sends weapon to overflow", () => {
  state.inventory = [
    { uid: "a", id: "sword_d", plus: 0, spent: 0 },
    { uid: "b", id: "sword_c", plus: 0, spent: 0 },
  ];
  state.overflowLoot = [];
  const it = addToInventory("sword_b", { source: "golden" });
  assert.ok(it);
  assert.strictEqual(state.inventory.length, 2);
  assert.strictEqual(state.overflowLoot.length, 1);
  assert.strictEqual(state.overflowLoot[0].id, "sword_b");
});

test("flushOverflowLoot pulls back when space frees", () => {
  state.inventory = [{ uid: "a", id: "sword_d", plus: 0, spent: 0 }];
  state.overflowLoot = [{ uid: "o1", id: "sword_b", plus: 0, spent: 0, _overflowAt: 1 }];
  const n = flushOverflowLoot({ silent: true });
  assert.strictEqual(n, 1);
  assert.strictEqual(state.inventory.length, 2);
  assert.strictEqual(state.overflowLoot.length, 0);
  assert.ok(state.inventory.some((x) => x.id === "sword_b"));
  assert.ok(!state.inventory[1]._overflowAt);
});

test("accessory overflow", () => {
  state.inventory = [
    { uid: "a", id: "sword_d", plus: 0, spent: 0 },
    { uid: "b", id: "sword_c", plus: 0, spent: 0 },
  ];
  state.overflowLoot = [];
  const it = addCollectibleToInventory("zaken_earring");
  assert.ok(it);
  assert.strictEqual(state.overflowLoot.length, 1);
  assert.strictEqual(state.overflowLoot[0].kind, "accessory");
});

console.log("overflow-loot.test.js OK");
