// ===== Unit-тесты: броня, слоты, сеты, farm power, sustain, крафт =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.WEAPONS = [
  {
    id: "test_sword",
    name: "Test Sword",
    grade: "D",
    patk: 40,
    matk: 20,
    ps: 4,
    ms: 3,
    icon: "icons/weapon_saber_i00.png",
  },
];
global.WMAP = {};
WEAPONS.forEach((w) => {
  WMAP[w.id] = w;
});
global.COLLECTIBLES = {};
global.INV_CAP = 64;
global.uid = () => "uid-" + Math.random().toString(16).slice(2);
global.toast = () => {};
global.save = () => {};
global.renderMenu = () => {};
global.checkAchievements = () => {};
global.logCharacterEvent = () => {};
global.Audio2 = { success: () => {}, click: () => {}, open: () => {} };
global.$ = () => null;
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.safeLevel = () => 3;
global.isMysticArchetype = (classId) => classId === "mystic" || classId === "shaman";
/** Pref брони без полного professions-core (тесты сетов). */
global.professionArmorPref = (av) => {
  const a = av || (typeof state !== "undefined" ? state.avatar : null) || {};
  if (a.classId === "mystic" || a.classId === "shaman") return "robe";
  const light =
    a.professionId === "rogue" ||
    a.professionId === "hawkeye" ||
    a.professionId === "treasure_hunter" ||
    a.professionId === "plainswalker" ||
    a.professionId === "silver_ranger";
  if (light) return "light";
  return "heavy";
};
global.OFF_ARMOR_DEF_MULT = 0.42;
global.statAt = (base, step, plus) => (base || 0) + (step || 0) * (plus || 0);
global.fighterWeaponPower = (w, plus) => (w.patk || 0) + (w.ps || 0) * (plus || 0);
global.mysticWeaponPower = (w, plus) => (w.matk || 0) + (w.ms || 0) * (plus || 0);
global.isNoGradeWeapon = () => false;
global.passiveEffectSum = () => 0;
global.racialEffectSum = () => 0;
global.farmZoneById = (id) => {
  const side = {
    scrap_field: { id: "scrap_field", chapter: 1, side: true },
    mithril_forge: { id: "mithril_forge", chapter: 2, side: true },
  };
  if (side[id]) return side[id];
  if (id === "dark_cavern") return { id: "dark_cavern", chapter: 4 };
  return { id: "elven_ruins", chapter: 2 };
};
global.FARM_ZONES = [
  { id: "banana_mine", chapter: 1 },
  { id: "elven_ruins", chapter: 2 },
  { id: "scrap_field", chapter: 1, side: true },
  { id: "mithril_forge", chapter: 2, side: true },
  { id: "orc_barracks", chapter: 3 },
];
global.zoneBossDef = () => ({ hpMult: 14 });
global.CRYSTAL_ICON = { C: "icons/c.png" };
global.GRADE_TAG = { C: "#5fcf6b" };
global.ensureWorkshopState = () => {
  if (!state.materials) state.materials = { soul: 0, spirit: 0 };
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
};

global.state = {
  avatar: {
    created: true,
    raceId: "human",
    classId: "fighter",
    level: 10,
    gear: {
      weapon: null,
      helmet: null,
      chest: null,
      legs: null,
      gloves: null,
      boots: null,
      earring_l: null,
      earring_r: null,
      ring_l: null,
      ring_r: null,
      necklace: null,
    },
  },
  inventory: [],
  adena: 0,
  materials: { soul: 0, spirit: 0 },
  crystals: { D: 0, C: 0, B: 0, A: 0 },
  farmZone: "elven_ruins",
};

global.ProgressStore = {
  set(k, v) {
    global.state[k] = v;
  },
  update(k, fn) {
    global.state[k] = fn(global.state[k]);
  },
};

global.QUESTS_PER_ZONE = 3;
global.ZONE_BOSS_GRIND_KILLS = 12;
global.ZONE_BOSSES = { elven_ruins: { name: "Boss" } };
global.ZONE_CHAPTER_REWARDS = { elven_ruins: { adena: 1 } };
global.QUEST_NPC_BY_RACE_ZONE = {};
global.QUEST_STEP_FLAVOR = [];
global.zoneQuestKillTargets = () => 5;
global.zoneQuestGoldenTarget = () => 0;

global.isInventoryFull = () => (global.state.inventory || []).length >= INV_CAP;
global.isAccessoryItem = (it) => !!(it && it.kind === "accessory");
global.normalizeInvItem = (it) => it;
global.renderAvatarGearSlots = () => {};
global.renderAvatarHub = () => {};
global.renderAvatarStatsPanel = () => {};
global.renderAvatarScreen = () => {};

loadScripts([
  "src/data/armor-sets-data.js",
  "src/avatar-gear-core.js",
  "src/armor-sets-core.js",
  "src/avatar-math.js",
  "src/quest-core.js",
]);

function equipArmorId(id) {
  const def = AMAP[id];
  assert.ok(def, "missing armor " + id);
  const it = { uid: uid(), id, kind: "armor" };
  state.inventory = [it];
  assert.strictEqual(equipAvatarSlot(def.slot, it), true);
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

  console.log("\n--- armor sets ---");

  test("slotAcceptsItem accepts armor into matching slot", () => {
    const it = { uid: "a1", id: "mithril_helmet", kind: "armor" };
    assert.strictEqual(slotAcceptsItem("helmet", it), true);
    assert.strictEqual(slotAcceptsItem("chest", it), false);
    assert.strictEqual(slotAcceptsItem("weapon", it), false);
  });

  test("slotAcceptsItem rejects weapon in armor slot", () => {
    const it = { uid: "w1", id: "test_sword", plus: 0 };
    assert.strictEqual(slotAcceptsItem("helmet", it), false);
    assert.strictEqual(slotAcceptsItem("weapon", it), true);
  });

  test("set thresholds 2/4/5 stack without empty def", () => {
    state.avatar.gear = defaultAvatarGear();
    state.inventory = [];
    assert.deepStrictEqual(avatarSetBonuses().sets, []);

    equipArmorId("mithril_helmet");
    equipArmorId("mithril_boots");
    let b = avatarSetBonuses();
    assert.ok(Math.abs(b.armorSustain - 0.04) < 1e-9);
    assert.strictEqual(b.pdef, 0);
    assert.strictEqual(b.mineAdena, 0);
    assert.strictEqual(b.enchant, 0);

    equipArmorId("mithril_gloves");
    equipArmorId("mithril_gaiters");
    b = avatarSetBonuses();
    assert.strictEqual(b.mineAdena, 0.06);
    assert.strictEqual(b.enchant, 0);
    assert.strictEqual(b.bossResist, 0);

    equipArmorId("mithril_breastplate");
    b = avatarSetBonuses();
    assert.strictEqual(b.mineAdena, 0.06);
    assert.strictEqual(b.enchant, 0);
    assert.strictEqual(b.bossResist, 0.1);
    assert.strictEqual(b.mineXp, 0.05);
    assert.ok(Math.abs(b.pvpDef - 0.06) < 1e-9);
    assert.strictEqual(b.pvpHp, 30);
    assert.strictEqual(b.sets[0].pieces, 5);
  });

  test("full bone set grants arena DEF; manticore grants ATK", () => {
    state.avatar.gear = defaultAvatarGear();
    state.avatar.classId = "fighter";
    state.avatar.professionId = null;
    ["bone_helmet", "bone_breastplate", "bone_gaiters", "bone_gloves", "bone_boots"].forEach(equipArmorId);
    let b = avatarSetBonuses();
    assert.ok(Math.abs(b.pvpDef - 0.03) < 1e-9);
    assert.strictEqual(b.pvpAtk, 0);
    assert.strictEqual(b.pvpHp, 0);

    state.avatar.gear = defaultAvatarGear();
    state.avatar.professionId = "rogue";
    ["manticore_helmet", "manticore_mail", "manticore_gaiters", "manticore_gloves", "manticore_boots"].forEach(equipArmorId);
    b = avatarSetBonuses();
    assert.ok(Math.abs(b.pvpAtk - 0.03) < 1e-9);
    assert.strictEqual(b.pvpDef, 0);
    assert.strictEqual(b.pvpHp, 0);
    state.avatar.professionId = null;
  });

  test("mystic in heavy: no set farm bonuses; piece DEF off-mult", () => {
    state.avatar.gear = defaultAvatarGear();
    state.avatar.classId = "mystic";
    state.avatar.level = 40;
    state.avatar.professionId = null;
    ["full_plate_helmet", "full_plate_armor", "full_plate_gaiters", "full_plate_gloves", "full_plate_boots"].forEach(
      equipArmorId
    );
    const b = avatarSetBonuses();
    assert.deepStrictEqual(b.sets, []);
    assert.strictEqual(b.mineAdena, 0);
    assert.strictEqual(b.bossResist, 0);
    assert.strictEqual(b.pvpDef, 0);
    assert.strictEqual(b.armorSustain, 0);

    const def = avatarArmorDefBonuses();
    const rawPdef = ["full_plate_helmet", "full_plate_armor", "full_plate_gaiters", "full_plate_gloves", "full_plate_boots"]
      .map((id) => AMAP[id].pdef || 0)
      .reduce((a, x) => a + x, 0);
    assert.ok(Math.abs(def.pdef - Math.round(rawPdef * OFF_ARMOR_DEF_MULT)) < 2);

    state.avatar.classId = "fighter";
    state.avatar.level = 10;
  });

  test("mixed robe+heavy: only preferred-kind set bonuses", () => {
    state.avatar.gear = defaultAvatarGear();
    state.avatar.classId = "mystic";
    state.avatar.level = 40;
    // 3 karmian (robe) + 2 bone (heavy)
    equipArmorId("karmian_circlet");
    equipArmorId("karmian_tunic");
    equipArmorId("karmian_hose");
    equipArmorId("bone_gloves");
    equipArmorId("bone_boots");
    const b = avatarSetBonuses();
    assert.ok(b.sets.some((s) => s.id === "karmian"));
    assert.ok(!b.sets.some((s) => s.id === "bone"));
    assert.strictEqual(b.armorSustain, 0); // bone 2pc sustain blocked
    // karmian 2pc = enchant only
    assert.ok(b.enchant > 0);
    state.avatar.classId = "fighter";
    state.avatar.level = 10;
  });

  test("farmPower barely moves with full mithril vs bare", () => {
    state.avatar.gear = defaultAvatarGear();
    state.inventory = [];
    const weapon = { uid: "w1", id: "test_sword", plus: 4, spent: 0, kind: "weapon" };
    ProgressStore.update("avatar", (a) => {
      const next = { ...(a || {}) };
      next.gear = { ...(next.gear || defaultAvatarGear()), weapon };
      return next;
    });
    const bare = avatarFarmPower();

    ["mithril_helmet", "mithril_breastplate", "mithril_gaiters", "mithril_gloves", "mithril_boots"].forEach((id) => {
      const def = AMAP[id];
      ProgressStore.update("avatar", (a) => {
        const next = { ...(a || {}) };
        const gear = { ...(next.gear || defaultAvatarGear()) };
        gear[def.slot] = { uid: uid(), id, kind: "armor" };
        next.gear = gear;
        return next;
      });
    });
    const geared = avatarFarmPower();
    const deltaPct = Math.abs(geared - bare) / Math.max(1, bare);
    assert.ok(deltaPct < 0.02, "farmPower delta " + (deltaPct * 100).toFixed(2) + "% should be < 2%");
    const stats = avatarStats();
    assert.ok(stats.pdef > 40, "full set should raise visible pdef, got " + stats.pdef);
    const sus = avatarArmorSustainPct();
    assert.ok(sus > 0.08, "full set sustain should be meaningful, got " + sus);
  });

  test("avatarGearMineAdenaMult from set works on all chapters", () => {
    state.avatar.gear = defaultAvatarGear();
    state.farmZone = "elven_ruins";
    ["mithril_helmet", "mithril_breastplate", "mithril_gaiters", "mithril_gloves"].forEach((id) => {
      const def = AMAP[id];
      state.avatar.gear[def.slot] = { uid: uid(), id, kind: "armor" };
    });
    assert.ok(Math.abs(avatarGearMineAdenaMult() - 1.06) < 1e-9);
    state.farmZone = "dark_cavern";
    assert.ok(Math.abs(avatarGearMineAdenaMult() - 1.06) < 1e-9);
  });

  test("mineMobMaxHp drops with armor sustain on golden", () => {
    state.avatar.gear = defaultAvatarGear();
    state.farmZone = "elven_ruins";
    const bareHp = mineMobMaxHp("golden", "elven_ruins");
    ["mithril_helmet", "mithril_breastplate", "mithril_gaiters", "mithril_gloves", "mithril_boots"].forEach((id) => {
      const def = AMAP[id];
      state.avatar.gear[def.slot] = { uid: uid(), id, kind: "armor" };
    });
    const gearedHp = mineMobMaxHp("golden", "elven_ruins");
    assert.ok(gearedHp < bareHp, "sustain should lower golden HP: " + gearedHp + " vs " + bareHp);
  });

  test("craftArmor consumes frags/ore/cry and grants piece", () => {
    state.avatar.gear = defaultAvatarGear();
    state.inventory = [];
    state.adena = 100000;
    state.materials = { soul: 100, spirit: 0, mithril_boots_piece: 10 };
    state.crystals = { D: 0, C: 10, B: 0, A: 0 };
    const it = craftArmor("mithril_boots");
    assert.ok(it);
    assert.strictEqual(it.id, "mithril_boots");
    assert.strictEqual(state.materials.mithril_boots_piece, 4);
    assert.strictEqual(state.materials.soul, 90);
    assert.strictEqual(state.crystals.C, 8);
    assert.strictEqual(state.adena, 90000);
    assert.strictEqual(state.inventory.length, 1);
  });

  test("rollArmorFragDrop is zone-scoped to set pool", () => {
    const orig = Math.random;
    Math.random = () => 0;
    try {
      assert.strictEqual(rollArmorFragDrop("elven_ruins", "boss"), null);
      const dPool = armorFragIdsForZone("scrap_field");
      assert.ok(dPool.length === 30, "D zone pools 6 sets × 5, got " + dPool.length);
      const cPool = armorFragIdsForZone("mithril_forge");
      assert.ok(cPool.length === 55, "C zone pools 11 sets × 5, got " + cPool.length);
      const scrap = rollArmorFragDrop("scrap_field", "boss");
      assert.ok(scrap && scrap.fragId && dPool.indexOf(scrap.fragId) >= 0);
      const forge = rollArmorFragDrop("mithril_forge", "boss");
      assert.ok(forge && forge.fragId && cPool.indexOf(forge.fragId) >= 0);
      assert.ok(dPool.every((id) => id.indexOf("mithril_") !== 0));
    } finally {
      Math.random = orig;
    }
  });

  test("craftArmor D-grade uses D crystals", () => {
    state.inventory = [];
    state.adena = 50000;
    state.materials = { soul: 50, spirit: 0, bone_boots_piece: 10 };
    state.crystals = { D: 5, C: 0, B: 0, A: 0 };
    const it = craftArmor("bone_boots");
    assert.ok(it);
    assert.strictEqual(it.id, "bone_boots");
    assert.strictEqual(state.crystals.D, 4);
    assert.ok(state.materials.bone_boots_piece < 10);
  });

  test("seventeen armor sets share two farm zones", () => {
    assert.strictEqual(Object.keys(ARMOR_SETS).length, 17);
    assert.deepStrictEqual(ARMOR_FRAG_ZONES.scrap_field, [
      "bone",
      "brigandine",
      "manticore",
      "reinforced",
      "elven_mithril",
      "knowledge",
    ]);
    assert.deepStrictEqual(ARMOR_FRAG_ZONES.mithril_forge, [
      "mithril",
      "chain",
      "tempered",
      "theca",
      "plated",
      "drake",
      "composite",
      "full_plate",
      "karmian",
      "divine",
      "demon",
    ]);
    assert.strictEqual(farmZoneIdForArmorSet("bone"), "scrap_field");
    assert.strictEqual(farmZoneIdForArmorSet("full_plate"), "mithril_forge");
    assert.strictEqual(ARMOR.length, 85);
    assert.strictEqual(ARMOR_CRAFT.length, 85);
    assert.strictEqual(farmZoneIdForArmorSet("karmian"), "mithril_forge");
  });

  test("armor sets have heavy/light/robe kinds", () => {
    assert.ok(Array.isArray(ARMOR_KINDS) && ARMOR_KINDS.length === 3);
    const counts = { heavy: 0, light: 0, robe: 0 };
    Object.values(ARMOR_SETS).forEach((s) => {
      assert.ok(s.kind === "heavy" || s.kind === "light" || s.kind === "robe", s.id);
      counts[s.kind]++;
    });
    assert.strictEqual(counts.heavy, 6);
    assert.strictEqual(counts.light, 6);
    assert.strictEqual(counts.robe, 5);
  });

  test("armor set frag icons are unique per set and helmet icons differ within kind", () => {
    const fragIcons = new Set();
    Object.keys(ARMOR_SETS).forEach((setId) => {
      const piece = ARMOR_SETS[setId].pieces[0];
      const frag = ARMOR_FRAGS[piece + "_piece"];
      assert.ok(frag?.icon, setId);
      fragIcons.add(frag.icon);
      assert.strictEqual(frag.icon, ARMOR_SET_FRAG_ICONS[setId]);
    });
    assert.strictEqual(fragIcons.size, 17);
    assert.ok(String(formatArmorEnchantBonus(0.001)).includes("100"));
    const mithrilHelm = AMAP.mithril_helmet.icon;
    const chainHelm = AMAP.chain_helmet.icon;
    assert.notStrictEqual(mithrilHelm, chainHelm);
    const lines = armorSetBonusPreviewLines("mithril", 4);
    assert.ok(lines[0].includes("P.Def"));
    assert.ok(lines.some((l) => l.startsWith("2:")));
  });

  test("mithril_forge side farm has no quests or chapter boss", () => {
    assert.strictEqual(zoneQuestSteps("mithril_forge").length, 0);
    assert.strictEqual(activeZoneQuest("mithril_forge"), null);
    assert.strictEqual(isZoneBossPending("mithril_forge"), false);
    assert.strictEqual(shouldOfferZoneBoss("mithril_forge"), false);
    assert.ok(isZoneChapterComplete("mithril_forge"));
    assert.ok(!ZONE_BOSSES.mithril_forge);
    assert.ok(!ZONE_CHAPTER_REWARDS.mithril_forge);
  });

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
