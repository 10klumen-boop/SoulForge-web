// ===== Unit-тесты: дуэли / PvP combat core =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.isMysticArchetype = (classId) => classId === "mystic" || classId === "shaman";

loadScripts([
  "src/data/combat-skills-data.js",
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
  assert.ok(m.skills.some((s) => s.id === "soul_burst"));
});

test("pvp remap: timerSlow → atkDebuff", () => {
  const f = sheetFighter();
  const iron = f.skills.find((s) => s.id === "iron_shell");
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
  const rng = pvpRng(7);
  const ev = pvpResolveAction(mage, foe, { type: "skill", skillId: "soul_burst" }, rng);
  assert.ok(foe.hp < hp0);
  assert.ok(ev.some((e) => e.kind === "hit" && e.skillId === "soul_burst"));
  assert.ok(mage.cds.soul_burst > 0);
});

test("practice shadow sheet builds", () => {
  const sh = pvpPracticeShadowSheet("fighter", 10);
  assert.strictEqual(sh.atkType, "physical");
  assert.ok(sh.skills.length >= 1);
  const sm = pvpPracticeShadowSheet("mystic", 10);
  assert.strictEqual(sm.atkType, "magical");
});

console.log("pvp-combat: all tests passed");
