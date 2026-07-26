// ===== Unit: кристаллизация брони (wiki cc) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.state = {
  inventory: [],
  crystals: { D: 0, C: 0, B: 0, A: 0 },
  avatar: { created: true, gear: {} },
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
global.Audio2 = { coin() {} };
global.showConfirm = async () => true;
global.renderInventory = () => {};
global.$ = () => null;
global.$$ = () => [];
global.WMAP = {};
global.CRYSTAL_ICON = { D: "d.png", C: "c.png" };
global.CRYSTAL_PLUS_MULT = 1.08;
global.tune = (_k, fb) => fb;
global.isAccessoryItem = () => false;
global.isItemEquipped = () => false;

loadScripts([
  "src/data/armor-sets-data.js",
  "src/armor-sets-core.js",
  "src/06-rules.js",
  "src/inventory-ui.js",
]);

global.renderInventory = () => {};
global.$ = () => ({ textContent: "", classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
global.$$ = () => [];

function test(name, fn) {
  const p = Promise.resolve().then(fn);
  return p.then(
    () => console.log("  ok  " + name),
    (e) => {
      console.error("  FAIL  " + name);
      throw e;
    }
  );
}

console.log("armor-crystallize.test.js");

(async () => {
  assert.ok(AMAP.bone_helmet && AMAP.bone_helmet.cc === 56);
  assert.ok(AMAP.brigandine_breastplate.cc === 543);
  assert.ok(AMAP.full_plate_armor.cc === 836);
  assert.strictEqual(crystalYield(AMAP.bone_helmet, 0), 56);
  assert.strictEqual(crystalYield(AMAP.chain_mail, 0), 202);

  state.inventory = [{ uid: "a1", id: "bone_helmet", kind: "armor" }];
  state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  await crystallizeAt(0);
  assert.strictEqual(state.inventory.length, 0);
  assert.strictEqual(state.crystals.D, 56);

  console.log("armor-crystallize.test.js OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
