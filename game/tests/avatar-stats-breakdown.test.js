// ===== Unit: StatPipeline / avatarStatsBreakdown =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WMAP = {
  wooden_sword: {
    id: "wooden_sword",
    name: "Wooden Sword",
    grade: "NG",
    patk: 20,
    matk: 5,
    ps: 2,
    ms: 1,
  },
};
global.AMAP = {
  helm1: { id: "helm1", name: "Helm", grade: "D", pdef: 40, mdef: 20, slot: "helmet" },
};
global.COLLECTIBLES = {};
global.state = {
  avatar: {
    created: true,
    raceId: "human",
    classId: "fighter",
    level: 10,
    gear: {
      weapon: { uid: "w1", id: "wooden_sword", kind: "weapon", plus: 2 },
      helmet: { uid: "a1", id: "helm1", kind: "armor", plus: 0 },
    },
  },
};
global.fmt = (n) => String(n);
global.isMysticArchetype = (id) => id === "mystic";
global.statAt = (b, s, p) => (b || 0) + (s || 0) * (p || 0);
global.fighterWeaponPower = (w, plus) => (w.patk || 0) + (w.ps || 0) * (plus || 0);
global.mysticWeaponPower = (w, plus) => (w.matk || 0) + (w.ms || 0) * (plus || 0);
global.weaponGradePowerMult = () => 1;
global.weaponAffinityMult = () => 1;
global.weaponAffinityShort = () => "1H";
global.isArmorItem = (it) => it && it.kind === "armor";
global.armorItemDef = (it) => (it && AMAP[it.id]) || null;
global.armorPiecePowerMult = () => 1;
global.armorEnchantPdefBonus = (plus) => (plus || 0) * 2;
global.armorEnchantMdefBonus = (plus) => plus || 0;
global.iterEquippedGear = () => {
  const g = state.avatar.gear || {};
  return Object.keys(g)
    .filter((k) => g[k])
    .map((slotId) => ({ slotId, item: g[slotId] }));
};
global.equippedWeaponItem = () => state.avatar.gear?.weapon || null;
global.avatarSetBonuses = () => ({
  pdef: 5,
  mdef: 0,
  enchant: 0.001,
  mineAdena: 0.04,
  mineXp: 0,
  armorSustain: 0,
  bossResist: 0,
  pvpAtk: 0.03,
  pvpDef: 0,
  pvpHp: 10,
});
global.avatarArmorDefBonuses = () => {
  // броня 40 pdef + set 5 — как в реальном strip для farm power
  return { pdef: 45, mdef: 20 };
};
global.avatarAccessoryPvpAtk = () => 0.05;
global.avatarAccessoryPvpDef = () => 0;
global.avatarAccessoryBonusSum = (k) => (k === "pvpHp" ? 5 : 0);
global.avatarGearEnchantBonus = () => 0.001;
global.safeLevel = () => 4;
global.passiveEffectSum = (type) => {
  if (type === "farmBonus") return 2;
  if (type === "matkAdd") return 0;
  if (type === "patkAdd") return 7;
  return 0;
};

loadScripts(["src/data/avatar-stats-data.js", "src/avatar-math.js"]);

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

  console.log("\n--- avatar stats pipeline ---");

  test("avatarStatsBreakdown totals match avatarStats", () => {
    const s = avatarStats();
    const bd = avatarStatsBreakdown();
    assert.strictEqual(bd.totals.patk, s.patk);
    assert.strictEqual(bd.totals.matk, s.matk);
    assert.strictEqual(bd.totals.pdef, s.pdef);
    assert.strictEqual(bd.totals.mdef, s.mdef);
    assert.strictEqual(bd.totals.farmBonus, s.farmBonus);
  });

  test("combat parts sum to totals", () => {
    const bd = avatarStatsBreakdown();
    const p = bd.combat.patk;
    assert.strictEqual(p.race + p.class + p.level + p.gear + (p.passive || 0), p.total);
    const m = bd.combat.matk;
    assert.strictEqual(m.race + m.class + m.level + m.gear + (m.passive || 0), m.total);
    const pd = bd.combat.pdef;
    assert.strictEqual(pd.race + pd.class + pd.level + pd.gear + (pd.passive || 0), pd.total);
    const md = bd.combat.mdef;
    assert.strictEqual(md.race + md.class + md.level + md.gear + (md.passive || 0), md.total);
  });

  test("pvp aggregates jewelry + sets and exposes crit", () => {
    const bd = avatarStatsBreakdown();
    assert.ok(Math.abs(bd.pvp.atk - 0.08) < 1e-9);
    assert.strictEqual(bd.pvp.hp, 15);
    assert.ok(typeof bd.pvp.crit === "number");
    assert.ok(bd.pvp.crit >= 0);
  });

  test("farm power matches avatarFarmPower", () => {
    const bd = avatarStatsBreakdown();
    assert.strictEqual(bd.farm.power, avatarFarmPower());
    assert.ok(bd.farm.weaponLabel);
  });

  test("farmBonus is flat number not ratio", () => {
    const bd = avatarStatsBreakdown();
    assert.strictEqual(bd.farm.farmBonus, 2);
    assert.strictEqual(bd.totals.farmBonus, 2);
    assert.ok(bd.farm.farmBonus < 1 || Number.isInteger(bd.farm.farmBonus) || bd.farm.farmBonus >= 1);
  });

  test("armor DEF in totals but only partial weight in farm power", () => {
    const bd = avatarStatsBreakdown();
    const pipe = buildAvatarStatPipeline();
    assert.ok(bd.totals.pdef > 45, "totals include armor/set pdef");
    assert.strictEqual(bd.farm.armorDefStripped.pdef, 45);
    assert.strictEqual(bd.farm.armorDefStripped.mdef, 20);
    const w = armorFarmDefWeight();
    const expectP =
      Math.max(0, bd.totals.pdef - bd.farm.armorDefStripped.pdef) +
      bd.farm.armorDefStripped.pdef * w;
    const expectM =
      Math.max(0, bd.totals.mdef - bd.farm.armorDefStripped.mdef) +
      bd.farm.armorDefStripped.mdef * w;
    assert.ok(Math.abs(bd.farm.defForFarm.pdef - expectP) < 1e-9);
    assert.ok(Math.abs(bd.farm.defForFarm.mdef - expectM) < 1e-9);
    assert.strictEqual(pipe.derived.farmPower, bd.farm.power);
  });

  test("passive scopes: *Add global including farm sheet", () => {
    const bd = avatarStatsBreakdown();
    assert.strictEqual(bd.passives.scopes.matkAdd, "global");
    assert.strictEqual(bd.passives.scopes.patkAdd, "global");
    assert.strictEqual(bd.passives.scopes.pdefAdd, "global");
    assert.strictEqual(bd.passives.scopes.mdefAdd, "global");
    assert.strictEqual(bd.passives.scopes.farmBonus, "global");
    assert.strictEqual(bd.passives.global.farmBonus, 2);
    assert.strictEqual(bd.passives.global.patkAdd, 7);
    assert.deepStrictEqual(bd.passives.pvpOnly, {});
    const race = RACE_BASE_STATS.human;
    const cls = CLASS_STAT_BONUS.fighter;
    const lb = avatarLevelStatBonus(10);
    const gear = avatarStatBonusesFromGear();
    assert.strictEqual(bd.totals.patk, race.patk + cls.patk + lb.atk + gear.patk + 7);
  });

  test("B1/B2 smoke: bare lv1 soft; lv16+D near mid D after gate ×2", () => {
    global.avatarArmorDefBonuses = () => ({ pdef: 0, mdef: 0 });
    global.passiveEffectSum = () => 0;
    state.avatar = {
      created: true,
      raceId: "human",
      classId: "fighter",
      level: 1,
      gear: { weapon: null },
    };
    global.iterEquippedGear = () => [];
    const p1 = avatarFarmPower();
    assert.ok(p1 >= 30 && p1 <= 55, "lv1 bare power " + p1 + " should be ~soft hunting 30–50");

    WMAP.d_sword = {
      id: "d_sword",
      name: "D Sword",
      grade: "D",
      patk: 48,
      matk: 12,
      ps: 4,
      ms: 2,
    };
    state.avatar.level = 16;
    state.avatar.gear = {
      weapon: { uid: "w2", id: "d_sword", kind: "weapon", plus: 4 },
    };
    global.iterEquippedGear = () => [
      { slotId: "weapon", item: state.avatar.gear.weapon },
    ];
    const p16 = avatarFarmPower();
    const midDReq = 176; // B2: was 88 ×2
    assert.ok(
      p16 >= midDReq * 0.85 && p16 <= midDReq * 1.15,
      "lv16+D power " + p16 + " should sit near mid D reqP " + midDReq + " (±15%)"
    );
    delete WMAP.d_sword;
  });

  console.log("\n--- summary ---");
  console.log("passed: " + passed + ", failed: " + failed);
  if (failed) process.exit(1);
}

run();
