// ===== Дуэли / арена: combat core (pure logic, без DOM) =====
// CombatSheet → раунды → resolveRound / simulateDuel.
// Не использует mine click damage / farmBonus / auto-clicker.

function pvpClamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/** Детерминированный RNG (mulberry32) для реплеев. */
function pvpRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pvpIsMagicalAtk(classId) {
  if (typeof isMysticArchetype === "function") return isMysticArchetype(classId);
  return classId === "mystic" || classId === "shaman";
}

function pvpHpMaxFromStats(level, pdef, mdef, hpAdd) {
  const base =
    (typeof PVP_HP_BASE === "number" ? PVP_HP_BASE : 220) +
    Math.max(1, level || 1) * (typeof PVP_HP_PER_LVL === "number" ? PVP_HP_PER_LVL : 18) +
    Math.max(0, pdef || 0) * (typeof PVP_HP_FROM_PDEF === "number" ? PVP_HP_FROM_PDEF : 1.15) +
    Math.max(0, mdef || 0) * (typeof PVP_HP_FROM_MDEF === "number" ? PVP_HP_FROM_MDEF : 0.95) +
    Math.max(0, hpAdd || 0);
  return Math.max(50, Math.round(base));
}

/** Собрать PvP-релевантные пассивы и аддитивы/мультипликаторы. */
function pvpCollectPassives(avatar) {
  const types =
    typeof PVP_PASSIVE_EFFECT_TYPES !== "undefined" ? PVP_PASSIVE_EFFECT_TYPES : {};
  const out = {
    ids: [],
    add: { patk: 0, matk: 0, pdef: 0, mdef: 0, hp: 0, crit: 0 },
    mult: { atk: 1, def: 1 },
  };
  if (typeof passiveSkillsForAvatar !== "function") return out;
  const affinityOn =
    typeof avatarArmorAffinityActive === "function" ? !!avatarArmorAffinityActive(avatar) : false;
  const skills = passiveSkillsForAvatar(avatar) || [];
  skills.forEach((sk) => {
    if (sk.requiresArmorAffinity && !affinityOn) return;
    let used = false;
    (sk.effects || []).forEach((e) => {
      const mode = types[e.type];
      if (!mode) return;
      used = true;
      const v = Number(e.value);
      if (mode === "add") {
        if (e.type === "matkAdd") out.add.matk += v || 0;
        else if (e.type === "patkAdd") out.add.patk += v || 0;
        else if (e.type === "pdefAdd") out.add.pdef += v || 0;
        else if (e.type === "mdefAdd") out.add.mdef += v || 0;
        else if (e.type === "pvpHpAdd") out.add.hp += v || 0;
        else if (e.type === "pvpCritChance") out.add.crit += v || 0;
      } else if (mode === "mult") {
        if (e.type === "pvpAtkMult") out.mult.atk *= v || 1;
        else if (e.type === "pvpDefMult") out.mult.def *= v || 1;
      }
    });
    if (used && sk.id) out.ids.push(sk.id);
  });
  return out;
}

function pvpSkillCdRounds(skill) {
  if (!skill) return 3;
  if (typeof PVP_SKILL_CD_ROUNDS !== "undefined" && PVP_SKILL_CD_ROUNDS[skill.id] != null) {
    return PVP_SKILL_CD_ROUNDS[skill.id];
  }
  const remap =
    typeof PVP_EFFECT_REMAP !== "undefined" ? PVP_EFFECT_REMAP[skill.effect] : null;
  return (remap && remap.cdRounds) || 3;
}

function pvpRemapSkill(farmSkill) {
  if (!farmSkill) return null;
  const remap =
    typeof PVP_EFFECT_REMAP !== "undefined" ? PVP_EFFECT_REMAP[farmSkill.effect] : null;
  if (!remap) return null;
  return {
    id: farmSkill.id,
    name: farmSkill.name,
    icon: farmSkill.icon,
    hotkey: farmSkill.hotkey,
    hotkeyCode:
      farmSkill.hotkeyCode ||
      (farmSkill.hotkey ? "Key" + String(farmSkill.hotkey).toUpperCase() : null),
    unlockLevel: farmSkill.unlockLevel || 1,
    farmEffect: farmSkill.effect,
    pvpEffect: remap.pvpEffect,
    mult: farmSkill.mult != null ? farmSkill.mult : 1,
    hits: farmSkill.hits || 1,
    buffRounds: remap.buffRounds != null ? remap.buffRounds : 3,
    debuffMult: remap.debuffMult != null ? remap.debuffMult : 0.7,
    debuffRounds: remap.debuffRounds != null ? remap.debuffRounds : 1,
    healFrac: remap.healFrac != null ? remap.healFrac : 0.15,
    cdRounds: pvpSkillCdRounds(farmSkill),
    fxColor: farmSkill.fxColor,
  };
}

function pvpSkillsForAvatar(avatar, level) {
  const lvl = level != null ? level : avatar?.level || 1;
  let farmList = [];
  if (typeof combatSkillsForClass === "function") {
    farmList = combatSkillsForClass(avatar?.classId || "fighter") || [];
    if (typeof applyProfessionSkillOverlay === "function") {
      farmList = applyProfessionSkillOverlay(farmList, avatar);
    }
  } else if (typeof COMBAT_SKILLS !== "undefined") {
    const cid = avatar?.classId || "fighter";
    farmList = COMBAT_SKILLS[cid] || COMBAT_SKILLS.fighter || [];
  }
  return farmList
    .map(pvpRemapSkill)
    .filter((s) => s && (s.unlockLevel || 1) <= lvl);
}

/**
 * Снимок силы для дуэли.
 * @param {object} input
 * @param {object} [input.avatar]
 * @param {object} [input.stats] — {patk,matk,pdef,mdef} (иначе avatarStats / нули)
 * @param {boolean} [input.shotArmed]
 * @param {string} [input.name]
 * @param {string} [input.weaponId]
 * @param {number} [input.weaponPlus]
 * @param {object[]} [input.skills] — готовый список PvP-скиллов
 */
function buildCombatSheet(input) {
  input = input || {};
  const avatar = input.avatar || {};
  const level = Math.max(1, input.level || avatar.level || 1);
  const classId = input.classId || avatar.classId || "fighter";
  const raceId = input.raceId || avatar.raceId || "human";
  const atkType = pvpIsMagicalAtk(classId) ? "magical" : "physical";

  let stats = input.stats;
  if (!stats && typeof avatarStats === "function" && typeof state !== "undefined" && state.avatar === avatar) {
    stats = avatarStats();
  }
  stats = stats || { patk: 20, matk: 20, pdef: 15, mdef: 15 };

  const passives = pvpCollectPassives(avatar);
  let patk = Math.max(0, stats.patk || 0);
  let matk = Math.max(0, stats.matk || 0);
  let pdef = Math.max(0, stats.pdef || 0);
  let mdef = Math.max(0, stats.mdef || 0);

  // Явные stats — сырые: накидываем все PvP-add. Live avatarStats уже включает matkAdd.
  if (input.stats) {
    patk += passives.add.patk;
    matk += passives.add.matk;
    pdef += passives.add.pdef;
    mdef += passives.add.mdef;
  } else {
    patk += passives.add.patk;
    pdef += passives.add.pdef;
    mdef += passives.add.mdef;
  }

  pdef = Math.round(pdef * passives.mult.def);
  mdef = Math.round(mdef * passives.mult.def);
  patk = Math.round(patk * passives.mult.atk);
  matk = Math.round(matk * passives.mult.atk);

  // Чужой kind брони: live avatarStats уже режет куски через armorPiecePowerMult.
  // Явные stats (тесты / тени) — дорезаем лист здесь.
  const affinityOn =
    typeof avatarArmorAffinityActive === "function" ? !!avatarArmorAffinityActive(avatar) : true;
  if (!affinityOn && input.stats) {
    const worn = typeof avatarEquippedArmorKind === "function" ? avatarEquippedArmorKind() : null;
    const pref = typeof professionArmorPref === "function" ? professionArmorPref(avatar) : null;
    if (worn && pref && worn !== pref) {
      const off =
        typeof PVP_OFF_ARMOR_DEF_MULT === "number" ? PVP_OFF_ARMOR_DEF_MULT : 0.42;
      pdef = Math.round(pdef * off);
      mdef = Math.round(mdef * off);
    }
  }

  // Сет-бонусы арены — только при сродстве брони и live-экипе.
  // (avatarSetBonuses уже фильтрует чужой kind; affinityOn режет микс/неполный.)
  let setHpAdd = 0;
  const liveAvatar =
    typeof state !== "undefined" && state.avatar && (input.avatar === state.avatar || !input.avatar);
  if (liveAvatar && affinityOn && typeof avatarSetBonuses === "function") {
    const setB = avatarSetBonuses();
    const atkB = Math.min(0.12, Math.max(0, setB.pvpAtk || 0));
    const defB = Math.min(0.12, Math.max(0, setB.pvpDef || 0));
    setHpAdd = Math.min(80, Math.max(0, setB.pvpHp || 0));
    if (atkB > 0) {
      patk = Math.round(patk * (1 + atkB));
      matk = Math.round(matk * (1 + atkB));
    }
    if (defB > 0) {
      pdef = Math.round(pdef * (1 + defB));
      mdef = Math.round(mdef * (1 + defB));
    }
  }

  const skills = Array.isArray(input.skills)
    ? input.skills
    : pvpSkillsForAvatar(avatar, level);

  const weapon =
    input.weaponId != null
      ? { id: input.weaponId, plus: input.weaponPlus || 0 }
      : avatar.gear && avatar.gear.weapon
        ? { id: avatar.gear.weapon.id, plus: avatar.gear.weapon.plus || 0 }
        : null;

  const hpMax = pvpHpMaxFromStats(level, pdef, mdef, passives.add.hp + (input.hpAdd || 0) + setHpAdd);

  return {
    name: input.name || avatar.name || "Боец",
    level,
    raceId,
    classId,
    genderId: input.genderId || avatar.genderId || "male",
    professionId: input.professionId || avatar.professionId || null,
    atkType,
    patk,
    matk,
    pdef,
    mdef,
    hpMax,
    shotArmed: !!input.shotArmed,
    weaponId: weapon?.id || null,
    weaponPlus: weapon?.plus || 0,
    skills,
    passiveIds: passives.ids.slice(),
    critChance: passives.add.crit,
    atkMult: passives.mult.atk,
    defMult: passives.mult.def,
  };
}

function pvpCreateFighter(sheet) {
  const cds = {};
  (sheet.skills || []).forEach((s) => {
    cds[s.id] = 0;
  });
  return {
    sheet,
    hp: sheet.hpMax,
    cds,
    buffs: {
      nextHitMult: 1,
      damageMult: 1,
      damageRounds: 0,
      atkDebuffMult: 1,
      atkDebuffRounds: 0,
      guarding: false,
    },
  };
}

function pvpMitigation(def) {
  const soft = typeof PVP_DEF_SOFT === "number" ? PVP_DEF_SOFT : 280;
  const d = Math.max(0, def || 0);
  return d / (d + soft);
}

function pvpPrimaryAtk(sheet) {
  return sheet.atkType === "magical" ? sheet.matk : sheet.patk;
}

function pvpDefendStat(attackerSheet, defenderSheet) {
  return attackerSheet.atkType === "magical" ? defenderSheet.mdef : defenderSheet.pdef;
}

/**
 * Урон одного удара.
 * @returns {{ damage: number, mitigated: number, variance: number }}
 */
function pvpComputeHitDamage(attacker, defender, skillMult, rng) {
  const sheetA = attacker.sheet;
  const sheetB = defender.sheet;
  const atk = pvpPrimaryAtk(sheetA);
  const def = pvpDefendStat(sheetA, sheetB);
  const mit = pvpMitigation(def);
  const scale = typeof PVP_ATK_SCALE === "number" ? PVP_ATK_SCALE : 0.42;
  const varW = typeof PVP_VARIANCE === "number" ? PVP_VARIANCE : 0.04;
  const cap = typeof PVP_SKILL_MULT_CAP === "number" ? PVP_SKILL_MULT_CAP : 4;
  const shotMult =
    sheetA.shotArmed && typeof PVP_SHOT_MULT === "number" ? PVP_SHOT_MULT : 1;

  let buffMult = attacker.buffs.damageMult || 1;
  let next = attacker.buffs.nextHitMult || 1;
  let outgoingDebuff = attacker.buffs.atkDebuffMult || 1;

  let combined = (skillMult || 1) * buffMult * next * shotMult * outgoingDebuff;
  combined = pvpClamp(combined, 0.05, cap);

  const roll = typeof rng === "function" ? rng() : 0.5;
  const variance = 1 + (roll * 2 - 1) * varW;

  const raw = atk * scale * combined;
  let damage = Math.max(1, Math.round(raw * (1 - mit) * variance));

  if (defender.buffs.guarding) {
    const g =
      typeof PVP_GUARD_INCOMING_MULT === "number" ? PVP_GUARD_INCOMING_MULT : 0.5;
    damage = Math.max(1, Math.round(damage * g));
  }

  // nextHit расходуется вызывающим кодом после удара
  return { damage, mitigated: mit, variance, consumedNextHit: next > 1 };
}

function pvpFindSkill(fighter, skillId) {
  return (fighter.sheet.skills || []).find((s) => s.id === skillId) || null;
}

function pvpSkillReady(fighter, skillId) {
  return (fighter.cds[skillId] || 0) <= 0;
}

function pvpApplyDamage(fighter, amount) {
  fighter.hp = Math.max(0, fighter.hp - Math.max(0, amount));
}

function pvpHeal(fighter, amount) {
  fighter.hp = Math.min(fighter.sheet.hpMax, fighter.hp + Math.max(0, amount));
}

function pvpTickBuffs(fighter) {
  const b = fighter.buffs;
  if (b.damageRounds > 0) {
    b.damageRounds -= 1;
    if (b.damageRounds <= 0) {
      b.damageMult = 1;
      b.damageRounds = 0;
    }
  }
  if (b.atkDebuffRounds > 0) {
    b.atkDebuffRounds -= 1;
    if (b.atkDebuffRounds <= 0) {
      b.atkDebuffMult = 1;
      b.atkDebuffRounds = 0;
    }
  }
  b.guarding = false;
}

function pvpTickCds(fighter) {
  Object.keys(fighter.cds).forEach((id) => {
    if (fighter.cds[id] > 0) fighter.cds[id] -= 1;
  });
}

function pvpStartSkillCd(fighter, skill) {
  fighter.cds[skill.id] = Math.max(0, skill.cdRounds || 1);
}

/**
 * Разрешить одно действие атакующего против защитника (до тика баффов).
 * Возвращает события лога.
 */
function pvpResolveAction(attacker, defender, action, rng) {
  const events = [];
  const name = attacker.sheet.name;
  action = action || { type: "attack" };

  if (action.type === "guard") {
    attacker.buffs.guarding = true;
    events.push({ kind: "guard", actor: name, text: name + " занимает защиту" });
    return events;
  }

  if (action.type === "skill") {
    const skill = pvpFindSkill(attacker, action.skillId);
    if (!skill || !pvpSkillReady(attacker, skill.id)) {
      events.push({
        kind: "fallback",
        actor: name,
        text: name + ": скилл недоступен → обычная атака",
      });
      action = { type: "attack" };
    } else {
      pvpStartSkillCd(attacker, skill);
      const eff = skill.pvpEffect;

      if (eff === "damageBuff") {
        attacker.buffs.damageMult = skill.mult || 1.5;
        attacker.buffs.damageRounds = skill.buffRounds || 3;
        events.push({
          kind: "buff",
          actor: name,
          skillId: skill.id,
          text: name + " использует «" + skill.name + "» (+урон " + (skill.buffRounds || 3) + " раунда)",
        });
        return events;
      }

      if (eff === "nextHit") {
        attacker.buffs.nextHitMult = skill.mult || 2.5;
        events.push({
          kind: "buff",
          actor: name,
          skillId: skill.id,
          text: name + " готовит «" + skill.name + "» (след. удар ×" + (skill.mult || 2.5) + ")",
        });
        return events;
      }

      if (eff === "atkDebuff") {
        defender.buffs.atkDebuffMult = skill.debuffMult || 0.7;
        defender.buffs.atkDebuffRounds = skill.debuffRounds || 1;
        events.push({
          kind: "debuff",
          actor: name,
          target: defender.sheet.name,
          skillId: skill.id,
          text:
            name +
            ": «" +
            skill.name +
            "» — урон " +
            defender.sheet.name +
            " ×" +
            (skill.debuffMult || 0.7),
        });
        return events;
      }

      if (eff === "directHit" || eff === "drainHit") {
        const hit = pvpComputeHitDamage(attacker, defender, skill.mult || 1, rng);
        if (hit.consumedNextHit) attacker.buffs.nextHitMult = 1;
        pvpApplyDamage(defender, hit.damage);
        events.push({
          kind: "hit",
          actor: name,
          target: defender.sheet.name,
          skillId: skill.id,
          damage: hit.damage,
          text:
            name +
            ": «" +
            skill.name +
            "» → " +
            defender.sheet.name +
            " −" +
            hit.damage,
        });
        if (eff === "drainHit") {
          const heal = Math.max(1, Math.round(hit.damage * (skill.healFrac || 0.15)));
          pvpHeal(attacker, heal);
          events.push({
            kind: "heal",
            actor: name,
            amount: heal,
            text: name + " восстанавливает " + heal + " HP",
          });
        }
        return events;
      }

      if (eff === "multiHit" || eff === "freezeMulti") {
        const hits = Math.max(1, skill.hits || 1);
        const mult = skill.mult != null ? skill.mult : 0.5;
        let total = 0;
        for (let i = 0; i < hits; i++) {
          const hit = pvpComputeHitDamage(attacker, defender, mult, rng);
          if (i === 0 && hit.consumedNextHit) attacker.buffs.nextHitMult = 1;
          pvpApplyDamage(defender, hit.damage);
          total += hit.damage;
        }
        events.push({
          kind: "hit",
          actor: name,
          target: defender.sheet.name,
          skillId: skill.id,
          damage: total,
          hits,
          text:
            name +
            ": «" +
            skill.name +
            "» (" +
            hits +
            " ударов) → −" +
            total,
        });
        if (eff === "freezeMulti") {
          defender.buffs.atkDebuffMult = skill.debuffMult || 0.7;
          defender.buffs.atkDebuffRounds = skill.debuffRounds || 1;
          events.push({
            kind: "debuff",
            actor: name,
            target: defender.sheet.name,
            text: defender.sheet.name + " скован (−урон)",
          });
        }
        return events;
      }

      // неизвестный эффект → атака
      events.push({
        kind: "fallback",
        actor: name,
        text: name + ": неизвестный эффект скилла → атака",
      });
      action = { type: "attack" };
    }
  }

  if (action.type === "attack") {
    const hit = pvpComputeHitDamage(attacker, defender, 1, rng);
    if (hit.consumedNextHit) attacker.buffs.nextHitMult = 1;
    pvpApplyDamage(defender, hit.damage);
    events.push({
      kind: "hit",
      actor: name,
      target: defender.sheet.name,
      damage: hit.damage,
      text: name + " атакует → −" + hit.damage,
    });
  }

  return events;
}

/**
 * Одновременный раунд: A и B выбирают действие.
 * Порядок resolve: сначала оба ставят guard/баффы без урона… фактически
 * resolveAction по очереди A→B, затем B→A, чтобы guard учитывался в том же раунде.
 * Для симметрии: сначала фаза setup (guard + non-damage skills), потом damage.
 */
function resolveRound(fighterA, fighterB, actionA, actionB, rng) {
  const log = [];
  const roundEvents = [];

  function isSetup(action, fighter) {
    if (!action || action.type === "guard") return true;
    if (action.type !== "skill") return false;
    const sk = pvpFindSkill(fighter, action.skillId);
    if (!sk) return false;
    return (
      sk.pvpEffect === "damageBuff" ||
      sk.pvpEffect === "nextHit" ||
      sk.pvpEffect === "atkDebuff"
    );
  }

  const setupA = isSetup(actionA, fighterA);
  const setupB = isSetup(actionB, fighterB);

  // 1) Guards и setup-скиллы обоих
  if (setupA) {
    const ev = pvpResolveAction(fighterA, fighterB, actionA, rng);
    roundEvents.push(...ev);
  }
  if (setupB) {
    const ev = pvpResolveAction(fighterB, fighterA, actionB, rng);
    roundEvents.push(...ev);
  }

  // 2) Damaging actions
  if (!setupA) {
    const ev = pvpResolveAction(fighterA, fighterB, actionA, rng);
    roundEvents.push(...ev);
  }
  if (!setupB) {
    const ev = pvpResolveAction(fighterB, fighterA, actionB, rng);
    roundEvents.push(...ev);
  }

  pvpTickBuffs(fighterA);
  pvpTickBuffs(fighterB);
  pvpTickCds(fighterA);
  pvpTickCds(fighterB);

  log.push(...roundEvents);
  return {
    events: roundEvents,
    hpA: fighterA.hp,
    hpB: fighterB.hp,
    deadA: fighterA.hp <= 0,
    deadB: fighterB.hp <= 0,
  };
}

/** Простой AI для тренировки / async-тени. `rng` — optional 0..1 generator. */
function pvpAiChooseAction(self, enemy, rng) {
  const roll = typeof rng === "function" ? rng : Math.random;
  const skills = self.sheet.skills || [];
  const ready = skills.filter((s) => pvpSkillReady(self, s.id));
  const hpPct = self.hp / Math.max(1, self.sheet.hpMax);
  const enemyPct = enemy.hp / Math.max(1, enemy.sheet.hpMax);

  if (hpPct < 0.28 && roll() < 0.55) return { type: "guard" };

  const burst = ready.find(
    (s) => s.pvpEffect === "directHit" || s.pvpEffect === "drainHit" || s.pvpEffect === "multiHit" || s.pvpEffect === "freezeMulti"
  );
  if (burst && (enemyPct < 0.4 || roll() < 0.45)) {
    return { type: "skill", skillId: burst.id };
  }

  const buff = ready.find((s) => s.pvpEffect === "damageBuff" || s.pvpEffect === "nextHit");
  if (buff && self.buffs.damageRounds <= 0 && self.buffs.nextHitMult <= 1 && roll() < 0.5) {
    return { type: "skill", skillId: buff.id };
  }

  const debuff = ready.find((s) => s.pvpEffect === "atkDebuff");
  if (debuff && enemy.buffs.atkDebuffRounds <= 0 && roll() < 0.35) {
    return { type: "skill", skillId: debuff.id };
  }

  if (hpPct < 0.45 && roll() < 0.25) return { type: "guard" };
  return { type: "attack" };
}

/**
 * Полная симуляция дуэли (обычно оба AI).
 * @returns {{ winner: 'a'|'b'|'draw', rounds: number, log: object[], sheetA, sheetB }}
 */
function simulateDuel(sheetA, sheetB, opts) {
  opts = opts || {};
  const maxRounds =
    opts.maxRounds != null
      ? opts.maxRounds
      : typeof PVP_MAX_ROUNDS === "number"
        ? PVP_MAX_ROUNDS
        : 20;
  const rng = pvpRng(opts.seed != null ? opts.seed : 1);
  const fighterA = pvpCreateFighter(sheetA);
  const fighterB = pvpCreateFighter(sheetB);
  const chooseA =
    typeof opts.chooseA === "function"
      ? opts.chooseA
      : (a, b) => pvpAiChooseAction(a, b, rng);
  const chooseB =
    typeof opts.chooseB === "function"
      ? opts.chooseB
      : (b, a) => pvpAiChooseAction(b, a, rng);

  const log = [];
  let round = 0;
  while (round < maxRounds && fighterA.hp > 0 && fighterB.hp > 0) {
    round += 1;
    const actionA = chooseA(fighterA, fighterB, round) || { type: "attack" };
    const actionB = chooseB(fighterB, fighterA, round) || { type: "attack" };
    const result = resolveRound(fighterA, fighterB, actionA, actionB, rng);
    log.push({
      round,
      actionA,
      actionB,
      events: result.events,
      hpA: result.hpA,
      hpB: result.hpB,
    });
  }

  let winner = "draw";
  if (fighterA.hp <= 0 && fighterB.hp <= 0) winner = "draw";
  else if (fighterA.hp <= 0) winner = "b";
  else if (fighterB.hp <= 0) winner = "a";
  else {
    const pctA = fighterA.hp / sheetA.hpMax;
    const pctB = fighterB.hp / sheetB.hpMax;
    if (pctA > pctB + 0.001) winner = "a";
    else if (pctB > pctA + 0.001) winner = "b";
    else winner = "draw";
  }

  return {
    winner,
    rounds: round,
    log,
    hpA: fighterA.hp,
    hpB: fighterB.hp,
    sheetA,
    sheetB,
  };
}

/** Пресет «тень» для тренировки (без живого оппонента). */
function pvpPracticeShadowSheet(kind, level) {
  const lvl = Math.max(1, level || 10);
  const mystic = kind === "mystic" || kind === "mage";
  const baseAtk = 28 + lvl * 4;
  const baseDef = 18 + lvl * 2.2;
  return buildCombatSheet({
    name: mystic ? "Тень мага" : "Тень воина",
    avatar: {
      name: mystic ? "Тень мага" : "Тень воина",
      level: lvl,
      raceId: mystic ? "elf" : "human",
      classId: mystic ? "mystic" : "fighter",
      gear: {},
    },
    level: lvl,
    classId: mystic ? "mystic" : "fighter",
    raceId: mystic ? "elf" : "human",
    stats: mystic
      ? { patk: Math.round(baseAtk * 0.45), matk: Math.round(baseAtk * 1.15), pdef: Math.round(baseDef * 0.75), mdef: Math.round(baseDef * 1.05) }
      : { patk: Math.round(baseAtk * 1.1), matk: Math.round(baseAtk * 0.4), pdef: Math.round(baseDef * 1.05), mdef: Math.round(baseDef * 0.7) },
    shotArmed: false,
    skills: pvpSkillsForAvatar(
      { classId: mystic ? "mystic" : "fighter", level: lvl },
      lvl
    ),
  });
}
