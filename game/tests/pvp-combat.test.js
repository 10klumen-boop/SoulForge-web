// ===== Unit-тесты: дуэли / PvP combat core =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.isMysticArchetype = (classId) => classId === "mystic" || classId === "shaman";

loadScripts([
  "src/data/combat-skills-data.js",
  "src/data/combat-skills-kits-data.js",
  "src/data/professions-data.js",
  "src/combat-skills-core.js",
  "src/data/pvp-balance.js",
  "src/pvp-combat-core.js",
]);

function test(name, fn) {
  try {
    fn();
    console.log("  ok  " + name);
  } catch (e) {
    console.error("  FAIL  " + name);
    throw e;
  }
}

console.log("pvp-combat.test.js");

function sheetFighter(overrides) {
  const o = overrides || {};
  return buildCombatSheet({
    name: o.name || "Воин",
    avatar: { classId: "fighter", raceId: "human", level: o.level || 12, name: o.name || "Воин", gear: {} },
    level: o.level || 12,
    classId: "fighter",
    raceId: "human",
    stats: o.stats || { patk: 80, matk: 20, pdef: 55, mdef: 35 },
    shotArmed: !!o.shotArmed,
    skills: o.skills,
  });
}

function sheetMystic(overrides) {
  const o = overrides || {};
  return buildCombatSheet({
    name: o.name || "Маг",
    avatar: { classId: "mystic", raceId: "elf", level: o.level || 12, name: o.name || "Маг", gear: {} },
    level: o.level || 12,
    classId: "mystic",
    raceId: "elf",
    stats: o.stats || { patk: 25, matk: 90, pdef: 35, mdef: 55 },
    shotArmed: !!o.shotArmed,
    skills: o.skills,
  });
}

test("buildCombatSheet sets atkType and hpMax", () => {
  const f = sheetFighter();
  const m = sheetMystic();
  assert.strictEqual(f.atkType, "physical");
  assert.strictEqual(m.atkType, "magical");
  assert.ok(f.hpMax > 200);
  assert.ok(m.hpMax > 200);
  assert.ok(f.skills.length >= 2);
  assert.ok(m.skills.some((s) => s.id === "elf_mystic_q" || s.id === "human_mystic_q" || s.id === "soul_burst"));
});

test("pvp remap: timerSlow → atkDebuff", () => {
  const f = sheetFighter();
  const iron = f.skills.find((s) => s.id === "human_fighter_e" || s.id === "iron_shell");
  assert.ok(iron);
  assert.strictEqual(iron.pvpEffect, "atkDebuff");
  assert.ok(iron.cdRounds >= 2);
});

test("mitigation softcap: more DEF reduces damage but never to zero", () => {
  const atk = pvpCreateFighter(sheetFighter({ stats: { patk: 100, matk: 10, pdef: 40, mdef: 30 } }));
  const soft = pvpCreateFighter(sheetFighter({ name: "Soft", stats: { patk: 40, matk: 10, pdef: 40, mdef: 30 } }));
  const tank = pvpCreateFighter(sheetFighter({ name: "Tank", stats: { patk: 40, matk: 10, pdef: 400, mdef: 30 } }));
  const rng = () => 0.5;
  const dSoft = pvpComputeHitDamage(atk, soft, 1, rng).damage;
  const dTank = pvpComputeHitDamage(atk, tank, 1, rng).damage;
  assert.ok(dSoft > dTank, "tank takes less: " + dSoft + " vs " + dTank);
  assert.ok(dTank >= 1);
  assert.ok(pvpMitigation(400) < 0.7);
  assert.ok(pvpMitigation(400) > 0.5);
});

test("guard halves incoming damage", () => {
  const a = pvpCreateFighter(sheetFighter({ name: "A" }));
  const b = pvpCreateFighter(sheetFighter({ name: "B" }));
  const rng = () => 0.5;
  b.buffs.guarding = false;
  const open = pvpComputeHitDamage(a, b, 1, rng).damage;
  b.buffs.guarding = true;
  const guarded = pvpComputeHitDamage(a, b, 1, rng).damage;
  assert.strictEqual(guarded, Math.max(1, Math.round(open * PVP_GUARD_INCOMING_MULT)));
});

test("magical attacks use mdef", () => {
  const mage = pvpCreateFighter(sheetMystic());
  const lowMdef = pvpCreateFighter(
    sheetFighter({ name: "LowM", stats: { patk: 50, matk: 10, pdef: 200, mdef: 20 } })
  );
  const highMdef = pvpCreateFighter(
    sheetFighter({ name: "HiM", stats: { patk: 50, matk: 10, pdef: 20, mdef: 200 } })
  );
  const rng = () => 0.5;
  const dLow = pvpComputeHitDamage(mage, lowMdef, 1, rng).damage;
  const dHigh = pvpComputeHitDamage(mage, highMdef, 1, rng).damage;
  assert.ok(dLow > dHigh, "mage prefers low mdef: " + dLow + " vs " + dHigh);
});

test("shotArmed increases damage", () => {
  const bare = pvpCreateFighter(sheetFighter({ shotArmed: false }));
  const armed = pvpCreateFighter(sheetFighter({ shotArmed: true }));
  const def = pvpCreateFighter(sheetFighter({ name: "D" }));
  const rng = () => 0.5;
  const d0 = pvpComputeHitDamage(bare, def, 1, rng).damage;
  const d1 = pvpComputeHitDamage(armed, def, 1, rng).damage;
  assert.ok(d1 > d0);
});

test("skillMult cap applies", () => {
  const a = pvpCreateFighter(sheetFighter());
  const b = pvpCreateFighter(sheetFighter({ name: "B" }));
  a.buffs.damageMult = 10;
  a.buffs.nextHitMult = 10;
  const rng = () => 0.5;
  const hit = pvpComputeHitDamage(a, b, 10, rng);
  const atk = pvpPrimaryAtk(a.sheet);
  const mit = pvpMitigation(pvpDefendStat(a.sheet, b.sheet));
  const expectedRaw = atk * PVP_ATK_SCALE * PVP_SKILL_MULT_CAP;
  const expected = Math.max(1, Math.round(expectedRaw * (1 - mit) * 1));
  assert.strictEqual(hit.damage, expected);
});

test("resolveRound simultaneous guard + attack", () => {
  const a = pvpCreateFighter(sheetFighter({ name: "A" }));
  const b = pvpCreateFighter(sheetFighter({ name: "B" }));
  const hpB0 = b.hp;
  const rng = pvpRng(42);
  resolveRound(a, b, { type: "attack" }, { type: "guard" }, rng);
  assert.ok(b.hp < hpB0);
  assert.ok(b.hp > hpB0 - 80); // guard softened
});

test("simulateDuel is deterministic with seed", () => {
  const a = sheetFighter({ name: "A", level: 14 });
  const b = sheetMystic({ name: "B", level: 14 });
  const r1 = simulateDuel(a, b, { seed: 99 });
  const r2 = simulateDuel(a, b, { seed: 99 });
  assert.strictEqual(r1.winner, r2.winner);
  assert.strictEqual(r1.rounds, r2.rounds);
  assert.strictEqual(r1.hpA, r2.hpA);
  assert.strictEqual(r1.hpB, r2.hpB);
});

test("higher enchant-like atk wins more often vs equal def", () => {
  const weak = sheetFighter({
    name: "Weak",
    stats: { patk: 50, matk: 15, pdef: 50, mdef: 40 },
  });
  const strong = sheetFighter({
    name: "Strong",
    stats: { patk: 140, matk: 15, pdef: 50, mdef: 40 },
  });
  const opp = sheetFighter({
    name: "Opp",
    stats: { patk: 70, matk: 15, pdef: 55, mdef: 40 },
  });
  let winStrong = 0;
  let winWeak = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (simulateDuel(strong, opp, { seed }).winner === "a") winStrong++;
    if (simulateDuel(weak, opp, { seed }).winner === "a") winWeak++;
  }
  assert.ok(winStrong > winWeak, "strong " + winStrong + " vs weak " + winWeak);
  assert.ok(winStrong >= 20, "enchant edge should be clear: " + winStrong);
});

test("directHit soul_burst deals damage in one resolve", () => {
  const mage = pvpCreateFighter(sheetMystic());
  const foe = pvpCreateFighter(sheetFighter({ name: "Foe" }));
  const hp0 = foe.hp;
  const skillId = mage.sheet.skills.find((s) => s.pvpEffect === "directHit")?.id || "soul_burst";
  const rng = pvpRng(7);
  const ev = pvpResolveAction(mage, foe, { type: "skill", skillId }, rng);
  assert.ok(foe.hp < hp0);
  assert.ok(ev.some((e) => e.kind === "hit" && e.skillId === skillId));
  assert.ok(mage.cds[skillId] > 0);
});

test("practice shadow sheet builds", () => {
  const sh = pvpPracticeShadowSheet("fighter", 10);
  assert.strictEqual(sh.atkType, "physical");
  assert.ok(sh.skills.length >= 1);
  const sm = pvpPracticeShadowSheet("mystic", 10);
  assert.strictEqual(sm.atkType, "magical");
});

test("set pvpAtk/pvpDef/pvpHp apply when avatarSetBonuses is present", () => {
  global.state = {
    avatar: { classId: "fighter", raceId: "human", level: 12, name: "Set", gear: {} },
  };
  global.avatarArmorAffinityActive = () => true;
  global.avatarSetBonuses = () => ({ pvpAtk: 0.1, pvpDef: 0.05, pvpHp: 40 });
  const bare = buildCombatSheet({
    name: "Bare",
    avatar: { classId: "fighter", raceId: "human", level: 12, name: "Bare", gear: {} },
    level: 12,
    classId: "fighter",
    raceId: "human",
    stats: { patk: 100, matk: 20, pdef: 50, mdef: 40 },
  });
  // input.avatar !== state.avatar → сет не применяется
  assert.strictEqual(bare.patk, 100);
  const live = buildCombatSheet({
    name: "Live",
    avatar: state.avatar,
    level: 12,
    classId: "fighter",
    raceId: "human",
    stats: { patk: 100, matk: 20, pdef: 50, mdef: 40 },
  });
  assert.strictEqual(live.patk, 110);
  assert.strictEqual(live.pdef, 53);
  assert.ok(live.hpMax > bare.hpMax);
  delete global.avatarSetBonuses;
  delete global.avatarArmorAffinityActive;
  delete global.state;
});

test("armor class passives grant PvP only with armor affinity", () => {
  global.PASSIVE_SKILLS = {
    fighter_heavy_armor: {
      id: "fighter_heavy_armor",
      requiresArmorAffinity: true,
      effects: [
        { type: "pvpDefMult", value: 1.05 },
        { type: "pvpHpAdd", value: 18 },
      ],
    },
  };
  global.passiveSkillsForAvatar = () => [PASSIVE_SKILLS.fighter_heavy_armor];
  global.avatarArmorAffinityActive = () => false;
  let p = pvpCollectPassives({ classId: "fighter" });
  assert.strictEqual(p.mult.def, 1);
  assert.strictEqual(p.add.hp, 0);
  assert.ok(p.ids.indexOf("fighter_heavy_armor") < 0);

  global.avatarArmorAffinityActive = () => true;
  p = pvpCollectPassives({ classId: "fighter" });
  assert.strictEqual(p.mult.def, 1.05);
  assert.strictEqual(p.add.hp, 18);
  assert.ok(p.ids.indexOf("fighter_heavy_armor") >= 0);

  const sheet = buildCombatSheet({
    name: "Tank",
    avatar: { classId: "fighter", raceId: "human", level: 12, name: "Tank", gear: {} },
    level: 12,
    classId: "fighter",
    raceId: "human",
    stats: { patk: 80, matk: 20, pdef: 100, mdef: 40 },
  });
  assert.strictEqual(sheet.pdef, 105);
  assert.ok(sheet.hpMax >= pvpHpMaxFromStats(12, 105, 40, 18));

  delete global.PASSIVE_SKILLS;
  delete global.passiveSkillsForAvatar;
  delete global.avatarArmorAffinityActive;
});

test("mystic in heavy loses set PvP and takes off-armor DEF mult", () => {
  global.state = {
    avatar: { classId: "mystic", raceId: "human", level: 40, name: "MagePlate", gear: {} },
  };
  global.avatarArmorAffinityActive = () => false;
  global.avatarEquippedArmorKind = () => "heavy";
  global.professionArmorPref = () => "robe";
  global.avatarSetBonuses = () => ({ pvpAtk: 0, pvpDef: 0.06, pvpHp: 36 });
  global.passiveSkillsForAvatar = () => [];

  const off = buildCombatSheet({
    name: "MagePlate",
    avatar: state.avatar,
    level: 40,
    classId: "mystic",
    raceId: "human",
    stats: { patk: 30, matk: 200, pdef: 200, mdef: 80 },
  });
  // MATK intact, DEF ×0.42, no set pvpDef/pvpHp
  assert.strictEqual(off.matk, 200);
  assert.strictEqual(off.pdef, Math.round(200 * PVP_OFF_ARMOR_DEF_MULT));
  assert.strictEqual(off.mdef, Math.round(80 * PVP_OFF_ARMOR_DEF_MULT));
  const hpNoSet = pvpHpMaxFromStats(40, off.pdef, off.mdef, 0);
  assert.strictEqual(off.hpMax, hpNoSet);

  global.avatarArmorAffinityActive = () => true;
  const on = buildCombatSheet({
    name: "MageRobe",
    avatar: state.avatar,
    level: 40,
    classId: "mystic",
    raceId: "human",
    stats: { patk: 30, matk: 200, pdef: 80, mdef: 120 },
  });
  assert.strictEqual(on.pdef, Math.round(80 * 1.06));
  assert.strictEqual(on.mdef, Math.round(120 * 1.06));
  assert.ok(on.hpMax > pvpHpMaxFromStats(40, on.pdef, on.mdef, 0) - 1); // +36 set HP

  delete global.avatarArmorAffinityActive;
  delete global.avatarEquippedArmorKind;
  delete global.professionArmorPref;
  delete global.avatarSetBonuses;
  delete global.passiveSkillsForAvatar;
  delete global.state;
});

test("pvp profession kit remaps without farm adena fields", () => {
  const avatar = { classId: "fighter", level: 40, professionId: "bounty_hunter" };
  const skills = pvpSkillsForAvatar(avatar, 40);
  const q = skills.find((s) => s.id === "bounty_hunter_q");
  const f = skills.find((s) => s.id === "bounty_hunter_f");
  assert.ok(q);
  assert.ok(f);
  assert.strictEqual(q.pvpEffect, "nextHit");
  assert.strictEqual(f.pvpEffect, "damageBuff");
  assert.strictEqual(q.farmAdenaMult, undefined);
  assert.strictEqual(q.adenaHitBonus, undefined);
  assert.ok(f.cdRounds >= 4);
});

test("pvp partyDamageBuff remaps to mild damageBuff", () => {
  const avatar = { classId: "shaman", level: 40, professionId: "warcryer" };
  const skills = pvpSkillsForAvatar(avatar, 40);
  const f = skills.find((s) => s.id === "warcryer_f");
  assert.ok(f);
  assert.strictEqual(f.farmEffect, "partyDamageBuff");
  assert.strictEqual(f.pvpEffect, "damageBuff");
  assert.strictEqual(f.mult, 1.18);
});

test("P0: clanPvpAtkPct / clanPvpDefPct apply from sheet without isAvatar", () => {
  const atk = pvpCreateFighter(sheetFighter({ name: "Atk" }));
  const def = pvpCreateFighter(sheetFighter({ name: "Def" }));
  atk.sheet.isAvatar = false;
  def.sheet.isAvatar = false;
  const rng = () => 0.5;
  const base = pvpComputeHitDamage(atk, def, 1, rng).damage;
  atk.sheet.clanPvpAtkPct = 12;
  const boosted = pvpComputeHitDamage(atk, def, 1, rng).damage;
  assert.ok(boosted > base, "atk buff: " + boosted + " > " + base);
  assert.strictEqual(boosted, Math.max(1, Math.round(base * 1.12)));
  atk.sheet.clanPvpAtkPct = 0;
  def.sheet.clanPvpDefPct = 12;
  const reduced = pvpComputeHitDamage(atk, def, 1, rng).damage;
  assert.strictEqual(reduced, Math.max(1, Math.round(base * 0.88)));
});

test("P0: debuffResist on sheet resists atkDebuff without isAvatar", () => {
  const atk = pvpCreateFighter(
    sheetFighter({
      name: "Debuffer",
      skills: [
        {
          id: "test_debuff",
          name: "Тест",
          pvpEffect: "atkDebuff",
          debuffMult: 0.7,
          debuffRounds: 2,
          cdRounds: 2,
          mult: 1,
          hits: 1,
        },
      ],
    })
  );
  const def = pvpCreateFighter(sheetFighter({ name: "Tank" }));
  def.sheet.isAvatar = false;
  def.sheet.debuffResist = 1;
  const events = pvpResolveAction(atk, def, { type: "skill", skillId: "test_debuff" }, () => 0.1);
  assert.ok(events.some((e) => e.kind === "resist"), JSON.stringify(events));
  assert.strictEqual(def.buffs.atkDebuffRounds, 0);
});

test("live avatarStats path does not double-add global *Add passives", () => {
  global.state = {
    avatar: { classId: "fighter", raceId: "human", level: 12, name: "Live", gear: {} },
  };
  // Уже включают patkAdd/pdefAdd/mdefAdd/matkAdd — как avatarStats после B2.
  global.avatarStats = () => ({ patk: 100, matk: 20, pdef: 50, mdef: 40 });
  global.passiveSkillsForAvatar = () => [
    {
      id: "stat_pads",
      effects: [
        { type: "patkAdd", value: 10 },
        { type: "matkAdd", value: 7 },
        { type: "pdefAdd", value: 5 },
        { type: "mdefAdd", value: 3 },
      ],
    },
  ];
  global.avatarArmorAffinityActive = () => true;

  const live = buildCombatSheet({
    name: "Live",
    avatar: state.avatar,
    level: 12,
    classId: "fighter",
    raceId: "human",
  });
  assert.strictEqual(live.patk, 100, "no double patkAdd");
  assert.strictEqual(live.matk, 20, "no double matkAdd");
  assert.strictEqual(live.pdef, 50, "no double pdefAdd");
  assert.strictEqual(live.mdef, 40, "no double mdefAdd");

  const raw = buildCombatSheet({
    name: "Raw",
    avatar: state.avatar,
    level: 12,
    classId: "fighter",
    raceId: "human",
    stats: { patk: 100, matk: 20, pdef: 50, mdef: 40 },
  });
  assert.strictEqual(raw.patk, 110);
  assert.strictEqual(raw.matk, 27);
  assert.strictEqual(raw.pdef, 55);
  assert.strictEqual(raw.mdef, 43);

  delete global.avatarStats;
  delete global.passiveSkillsForAvatar;
  delete global.avatarArmorAffinityActive;
  delete global.state;
});

console.log("pvp-combat: all tests passed");
