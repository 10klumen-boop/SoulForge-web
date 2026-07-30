// ===== Unit: armor/jewelry enchant feeds avatarStatBonusesFromGear =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [];
global.WMAP = {};
global.COLLECTIBLES = {
  jew1: { id: "jew1", name: "Ring", grade: "D", setId: "elven", bonuses: { mdef: 5 } },
};
global.AMAP = {
  helm1: { id: "helm1", name: "Helm", grade: "D", pdef: 20, mdef: 10, slot: "helmet" },
};
global.state = {
  avatar: { created: true, raceId: "human", classId: "fighter", level: 20, gear: {} },
};
global.CLASS_STAT_BONUS = { fighter: { patk: 0, matk: 0, pdef: 0, mdef: 0 } };
global.RACE_BASE_STATS = { human: { patk: 0, matk: 0, pdef: 0, mdef: 0 } };
global.avatarLevelStatBonus = () => ({ atk: 0, def: 0 });
global.passiveEffectSum = () => 0;
global.isMysticArchetype = () => false;

loadScripts([
  "src/armor-sets-core.js",
  "src/jewelry-sets-core.js",
  "src/avatar-math.js",
]);

global.isArmorItem = (it) => it && (it.kind === "armor" || it.id === "helm1");
global.armorItemDef = (it) => AMAP[it.id] || null;
global.armorPiecePowerMult = () => 1;
global.iterEquippedGear = () => [
  { slot: "helmet", item: { id: "helm1", kind: "armor", plus: 4 } },
  { slot: "ring_l", item: { id: "jew1", kind: "accessory", plus: 3 } },
];
global.avatarSetBonuses = () => ({ pdef: 0, mdef: 0 });
global.avatarJewelrySetMdef = () => 0;

const gear = avatarStatBonusesFromGear();
// armor +4 → pdef +8, mdef +4 on base 20/10
assert.strictEqual(gear.pdef, 20 + 8, "armor enchant pdef " + gear.pdef);
assert.strictEqual(gear.mdef, 10 + 4 + 5 + 3, "armor+jew enchant mdef " + gear.mdef);

global.iterEquippedGear = () => [
  { slot: "helmet", item: { id: "helm1", kind: "armor", plus: 0 } },
];
const base = avatarStatBonusesFromGear();
assert.strictEqual(base.pdef, 20);
assert.strictEqual(base.mdef, 10);

console.log("armor-jewelry-enchant-stats: ok");
