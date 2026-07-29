// ===== Avatar math: статы, сила фарма, баланс зон =====
// Вынесено из 24-avatar-stats.js; чистые расчёты без UI и мутаций state.

const RACE_BASE_STATS = {

  human: { patk: 15, matk: 13, pdef: 15, mdef: 15 },

  elf: { patk: 12, matk: 19, pdef: 12, mdef: 17 },

  dark_elf: { patk: 17, matk: 16, pdef: 11, mdef: 14 },

  orc: { patk: 20, matk: 10, pdef: 19, mdef: 11 },

  dwarf: { patk: 17, matk: 10, pdef: 17, mdef: 14 },

};



const CLASS_STAT_BONUS = {

  fighter: { patk: 3, matk: 0, pdef: 2, mdef: 0 },

  mystic: { patk: 0, matk: 4, pdef: 0, mdef: 2 },

};

function avatarLevelStatBonus(level) {

  const lvl = Math.max(0, (level || 1) - 1);

  return { atk: Math.floor(lvl * 0.7), def: Math.floor(lvl * 0.55) };

}



function classStatBonus(classId) {
  if (typeof isMysticArchetype === "function" && isMysticArchetype(classId)) {
    return CLASS_STAT_BONUS.mystic;
  }
  return CLASS_STAT_BONUS[classId] || CLASS_STAT_BONUS.fighter;
}






function avatarStatBonusesFromGear() {

  const out = { patk: 0, matk: 0, pdef: 0, mdef: 0 };

  if (typeof iterEquippedGear !== "function") return out;

  iterEquippedGear().forEach(({ item }) => {

    if (item.kind === "weapon") {

      const w = WMAP[item.id];

      if (!w) return;

      const p = item.plus || 0;
      const lv = state.avatar?.level || 1;
      const pen = typeof weaponGradePowerMult === "function" ? weaponGradePowerMult(w, lv) : 1;

      if (avatarIsMystic()) {
        out.matk += Math.round(mysticWeaponPower(w, p) * pen);
      } else {
        out.patk += Math.round(fighterWeaponPower(w, p) * pen);
        out.matk += Math.round(statAt(w.matk, w.ms, p) * pen);
      }

      return;

    }

    if (item.kind === "armor" || (typeof isArmorItem === "function" && isArmorItem(item))) {
      const def = typeof armorItemDef === "function" ? armorItemDef(item) : (typeof AMAP !== "undefined" ? AMAP[item.id] : null);
      if (!def) return;
      const mult =
        typeof armorPiecePowerMult === "function"
          ? armorPiecePowerMult(def, state.avatar)
          : typeof avatarGradePenaltyMult === "function"
            ? avatarGradePenaltyMult(def.grade, state.avatar?.level || 1)
            : 1;
      if (def.pdef) out.pdef += Math.round(def.pdef * mult);
      if (def.mdef) out.mdef += Math.round(def.mdef * mult);
      return;
    }

    const def = COLLECTIBLES[item.id];

    const b = def?.bonuses;

    if (!b && !(def && (def.mdef || def.pdef))) return;

    if (b?.patk) out.patk += b.patk;

    if (b?.matk) out.matk += b.matk;

    if (b?.pdef) out.pdef += b.pdef;

    let mdef = (b && b.mdef) || 0;
    if (!mdef && def?.mdef) mdef = def.mdef;
    const jewPlus = item.plus || 0;
    if (typeof jewelryEnchantMdefBonus === "function") {
      mdef += jewelryEnchantMdefBonus(jewPlus);
    } else if (jewPlus) {
      mdef += jewPlus;
    }
    if (mdef) out.mdef += mdef;

  });

  if (typeof avatarSetBonuses === "function") {
    const set = avatarSetBonuses();
    if (set.pdef) out.pdef += set.pdef;
    if (set.mdef) out.mdef += set.mdef;
  }
  if (typeof avatarJewelrySetMdef === "function") {
    out.mdef += avatarJewelrySetMdef();
  }

  return out;

}



function avatarStats() {

  const a = state.avatar || {};

  const race = RACE_BASE_STATS[a.raceId] || RACE_BASE_STATS.human;

  const cls = classStatBonus(a.classId);

  const lv = Math.max(1, a.level || 1);

  const lb = avatarLevelStatBonus(lv);

  const gear = avatarStatBonusesFromGear();

  const raceId = a.raceId || "human";
  const farmBonus = typeof passiveEffectSum === "function"
    ? passiveEffectSum("farmBonus", a, lv)
    : (typeof racialEffectSum === "function" ? racialEffectSum("farmBonus", raceId, lv) : 0);
  const matkAdd = typeof passiveEffectSum === "function"
    ? passiveEffectSum("matkAdd", a, lv)
    : 0;

  return {

    patk: race.patk + cls.patk + lb.atk + gear.patk,

    matk: race.matk + cls.matk + lb.atk + gear.matk + matkAdd,

    pdef: race.pdef + cls.pdef + lb.def + gear.pdef,

    mdef: race.mdef + cls.mdef + lb.def + gear.mdef,

    farmBonus,

  };

}



function avatarIsMystic() {
  return typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar?.classId);
}

/** Подпись основного стата оружия в списках экипировки / инвентаря. */
function weaponEquipStatLabel(w, plus) {
  if (!w) return "";
  const p = plus || 0;
  const lv = typeof state !== "undefined" ? state.avatar?.level || 1 : 1;
  const pen = typeof weaponGradePowerMult === "function" ? weaponGradePowerMult(w, lv) : 1;
  const gradeTag = pen < 1 ? " · штраф грейда" : "";
  if (avatarIsMystic()) {
    const weak = weaponAffinityMult(w, true) < 1 ? " · слабо" : "";
    return "M.Atk " + fmt(Math.round(mysticWeaponPower(w, p) * pen)) + weak + gradeTag + " · " + weaponAffinityShort(w);
  }
  const weak = weaponAffinityMult(w, false) < 1 ? " · слабо" : "";
  return "P.Atk " + fmt(Math.round(fighterWeaponPower(w, p) * pen)) + weak + gradeTag + " · " + weaponAffinityShort(w);
}

function avatarFarmPower() {
  const s = avatarStats();
  const mystic = avatarIsMystic();
  const primary = mystic ? s.matk * 1.06 : s.patk;
  const secondary = mystic ? s.patk : s.matk;
  // Броня/сет-def — sustain, не якорь farm power (модель 2C).
  const armorDef = typeof avatarArmorDefBonuses === "function" ? avatarArmorDefBonuses() : { pdef: 0, mdef: 0 };
  const pdef = Math.max(0, (s.pdef || 0) - (armorDef.pdef || 0));
  const mdef = Math.max(0, (s.mdef || 0) - (armorDef.mdef || 0));
  const power = Math.round(
    primary * 1.0 + secondary * 0.72 + pdef * 0.36 + mdef * 0.36 + Math.max(0, (state.avatar?.level || 1) - 1) * 1.5 + s.farmBonus
  );
  return Math.max(1, power);
}

/** Бонус P.Atk от оружия; fixedPlus — принудительный уровень заточки (для базового HP). */
function avatarWeaponPatkBonus(fixedPlus) {
  if (avatarIsMystic()) return 0;
  if (typeof iterEquippedGear !== "function") return 0;
  let patk = 0;
  const lv = state.avatar?.level || 1;
  iterEquippedGear().forEach(({ item }) => {
    if (item.kind !== "weapon") return;
    const w = WMAP[item.id];
    if (!w) return;
    const plus = fixedPlus !== undefined ? fixedPlus : (item.plus || 0);
    const pen = typeof weaponGradePowerMult === "function" ? weaponGradePowerMult(w, lv) : 1;
    patk += Math.round(fighterWeaponPower(w, plus) * pen);
  });
  return patk;
}

/** Бонус M.Atk от оружия; fixedPlus — принудительный уровень заточки (для базового HP). */
function avatarWeaponMatkBonus(fixedPlus) {
  if (typeof iterEquippedGear !== "function") return 0;
  let matk = 0;
  const lv = state.avatar?.level || 1;
  iterEquippedGear().forEach(({ item }) => {
    if (item.kind !== "weapon") return;
    const w = WMAP[item.id];
    if (!w) return;
    const plus = fixedPlus !== undefined ? fixedPlus : (item.plus || 0);
    const pen = typeof weaponGradePowerMult === "function" ? weaponGradePowerMult(w, lv) : 1;
    const raw = avatarIsMystic() ? mysticWeaponPower(w, plus) : statAt(w.matk, w.ms, plus);
    matk += Math.round(raw * pen);
  });
  return matk;
}

function mineWeaponDamageScale(chapter) {
  const ch = chapter || 1;
  const base = 0.22 + ch * 0.04;
  if (typeof avatarIsMystic === "function" && avatarIsMystic()) return base + 0.16;
  return base;
}

function avatarMinePatkForDamage(weaponPlus) {
  const s = avatarStats();
  const weaponPatk = avatarWeaponPatkBonus(weaponPlus);
  const basePatk = Math.max(0, s.patk - avatarWeaponPatkBonus());
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = mineCombatProgressChapter(zone);
  return basePatk + weaponPatk * mineWeaponDamageScale(ch);
}

function avatarMineMatkForDamage(weaponPlus) {
  const s = avatarStats();
  const weaponMatk = avatarWeaponMatkBonus(weaponPlus);
  const baseMatk = Math.max(0, s.matk - avatarWeaponMatkBonus());
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = mineCombatProgressChapter(zone);
  return baseMatk + weaponMatk * mineWeaponDamageScale(ch);
}

/** Сырой урон клика до chapterScale (воин — P.Atk, маг — M.Atk). */
function avatarMineClickRaw(weaponPlus) {
  const s = avatarStats();
  const lvl = state.avatar?.level || 1;
  if (avatarIsMystic()) {
    const effMatk = avatarMineMatkForDamage(weaponPlus);
    return effMatk * 1.1 + s.patk * 0.28 + lvl * 1.75;
  }
  const effPatk = avatarMinePatkForDamage(weaponPlus);
  return effPatk * 1.0 + s.matk * 0.24 + lvl * 1.6;
}

/** Урон без учёта заточки — для HUD бонуса заточки (HP моба якорится на зону). */
function avatarMineBaseClickDamage() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = mineCombatProgressChapter(zone);
  const raw = avatarMineClickRaw(0);
  const chapterScale = 1 + (ch - 1) * 0.035;
  return Math.max(4, Math.round((raw * chapterScale) / 4.2));
}

/** Урон клика с полной заточкой оружия. */
function avatarMineClickDamage() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = mineCombatProgressChapter(zone);
  const raw = avatarMineClickRaw();
  const chapterScale = 1 + (ch - 1) * 0.035;
  let dmg = Math.max(4, Math.round((raw * chapterScale) / 4.2));
  if (typeof avatarArmorAffinityMult === "function") {
    dmg = Math.max(4, Math.round(dmg * avatarArmorAffinityMult(state.avatar)));
  }
  return dmg;
}

/** Прибавка урона от заточки (для HUD). */
function avatarMineEnchantDamageBonus() {
  return Math.max(0, avatarMineClickDamage() - avatarMineBaseClickDamage());
}

/**
 * Эталонный урон клика зоны (от targetPower/главы).
 * HP моба якорится сюда — сила игрока ускоряет фарм, а не «толстит» моба.
 */
function mineZoneRefClickDamage(zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const zone = farmZoneById(zoneId);
  const ch = mineCombatProgressChapter(zone);
  const tgt = typeof farmZoneTargetPower === "function" ? farmZoneTargetPower(zone) : zone?.targetPower || 62;
  const k = typeof MINE_REF_POWER_TO_RAW === "number" ? MINE_REF_POWER_TO_RAW : 0.48;
  const step = typeof MINE_REF_CHAPTER_STEP === "number" ? MINE_REF_CHAPTER_STEP : 0.09;
  const chapterScale = 1 + (ch - 1) * step;
  const raw = tgt * k;
  return Math.max(4, Math.round((raw * chapterScale) / 4.2));
}

/** Бюджет ударов на целевой силе зоны (under/overpower меняет фактический TTK через урон игрока). */
function mineHitsToKill(type, zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const zone = farmZoneById(zoneId);
  const ch = mineCombatProgressChapter(zone);
  const ci = Math.min(5, Math.max(1, ch)) - 1;
  const base = {
    normal: [7, 8, 9, 10, 11],
    golden: [13, 15, 17, 19, 22],
    // Гл.1 мягче: проходим около targetPower; дальше эскалация
    boss: [44, 68, 80, 90, 104],
  };
  const hits = (base[type] || base.normal)[ci];
  return Math.max(type === "boss" ? (ci === 0 ? 28 : 40) : type === "golden" ? 8 : 4, hits);
}

/** HP моба = эталонный урон зоны × бюджет ударов (сила/заточка сокращают фактические клики). */
function mineMobMaxHp(type, zoneId) {
  const dmg = mineZoneRefClickDamage(zoneId);
  const hits = mineHitsToKill(type, zoneId);
  let hp = Math.round(dmg * hits);
  if (type === "golden") hp = Math.round(hp * 1.08);
  if (type === "boss") {
    const boss = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : { hpMult: 14 };
    hp = Math.round(hp * Math.max(1, (boss.hpMult || 14) / 12));
    if (typeof avatarSetBonuses === "function") {
      const resist = Math.min(0.35, Math.max(0, avatarSetBonuses().bossResist || 0));
      if (resist > 0) hp = Math.round(hp * (1 - resist));
    }
  }
  if (type === "golden" || type === "boss") {
    const sustain =
      typeof avatarArmorSustainPct === "function"
        ? Math.min(0.2, Math.max(0, avatarArmorSustainPct()))
        : 0;
    if (sustain > 0) hp = Math.round(hp * (1 - sustain));
  }
  const zone = farmZoneById(zoneId || state.farmZone || "banana_mine");
  const ch = zone?.chapter || 1;
  const bossFloorHits = type === "boss" ? (ch <= 1 ? 28 : 40) : 0;
  return Math.max(
    type === "boss" ? dmg * bossFloorHits : type === "golden" ? dmg * 8 : dmg * 4,
    hp
  );
}



/** Ожидаемая сила фарма на уровне без экипировки (для подсказок). */
function expectedFarmPowerAtLevel(level) {
  level = Math.max(1, level || 1);
  const a = state.avatar || {};
  const race = RACE_BASE_STATS[a.raceId] || RACE_BASE_STATS.human;
  const cls = classStatBonus(a.classId);
  const lb = avatarLevelStatBonus(level);
  const racialFarm = typeof passiveEffectSum === "function"
    ? passiveEffectSum("farmBonus", a, level)
    : (typeof racialEffectSum === "function" ? racialEffectSum("farmBonus", a.raceId, level) : 0);
  const patk = race.patk + cls.patk + lb.atk;
  const matk = race.matk + cls.matk + lb.atk;
  const pdef = race.pdef + cls.pdef + lb.def;
  const mdef = race.mdef + cls.mdef + lb.def;
  const mystic = typeof isMysticArchetype === "function" && isMysticArchetype(a.classId);
  const primary = mystic ? matk : patk;
  const secondary = mystic ? patk : matk;
  return Math.round(
    primary * 1.0 + secondary * 0.72 + pdef * 0.36 + mdef * 0.36 + Math.max(0, level - 1) * 1.5 + racialFarm
  );
}



function farmZoneTargetPower(zone) {
  zone = typeof zone === "string" ? farmZoneById(zone) : zone;
  return zone.targetPower || Math.max(70, zone.reqPower || 70);
}

/** Глава для эскалации боя: сюжет = narrative chapter; охота = farmZoneProgressChapter (банда). */
function mineCombatProgressChapter(zoneOrId) {
  const zone = typeof zoneOrId === "string" ? farmZoneById(zoneOrId) : zoneOrId;
  if (typeof farmZoneProgressChapter === "function") {
    return Math.min(5, Math.max(1, farmZoneProgressChapter(zone) || 1));
  }
  return Math.min(5, Math.max(1, zone?.chapter || 1));
}



/** Базовый рост adena по зоне и уровню (до бонуса силы).
 *  Сюжет: ECONOMY.farmAdenaPerHour по chapter.
 *  Охота: от L2 mid зоны (не от reqLevel — гейты отдельно). */
function mineProgressAdenaScale(zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const zone = farmZoneById(zoneId);
  const lvl = state.avatar?.level || 1;
  const lvlMult = 1 + Math.max(0, lvl - 1) * 0.02;
  if (zone && zone.side) {
    const mid =
      typeof farmZoneL2Mid === "function"
        ? farmZoneL2Mid(zone)
        : Math.max(1, Number(zone.reqLevel) || 1) * 2.2;
    // mid12 → ×1, mid55 → ×8
    const zoneMult = 1 + Math.max(0, mid - 12) * (7 / 43);
    return zoneMult * lvlMult;
  }
  const chapter =
    typeof farmZoneProgressChapter === "function"
      ? farmZoneProgressChapter(zone)
      : zone?.chapter || 1;
  const chapterMult =
    typeof economyChapterFarmMult === "function"
      ? economyChapterFarmMult(chapter)
      : ([1, 2, 3.5, 5.5, 8][chapter - 1] || 1);
  return chapterMult * lvlMult;
}



/** Веса грейдов оружия с фарма (грейд — mineDropWeights).
 *  Сюжет: только D. Охота: банда L2 (≤30 = D, 30+ = C).
 *  B/A — позже (сейчас вес 0). */
function mineDropWeights(zoneId) {
  const zone = farmZoneById(zoneId || state.farmZone || "banana_mine");
  if (zone && !zone.side) {
    return { D: 100, C: 0, B: 0, A: 0 };
  }
  const band =
    typeof farmZoneLootBand === "function" ? farmZoneLootBand(zone) : null;
  if (band === "d20" || band === "d30") {
    return { D: 100, C: 0, B: 0, A: 0 };
  }
  if (band === "c40" || band === "c40p") {
    return { D: 0, C: 100, B: 0, A: 0 };
  }
  // fallback: старый chapter-band
  const chapter =
    typeof farmZoneProgressChapter === "function"
      ? farmZoneProgressChapter(zone)
      : zone.chapter || 1;
  if (chapter <= 2) return { D: 100, C: 0, B: 0, A: 0 };
  return { D: 0, C: 100, B: 0, A: 0 };
}

function mineDropGradeSummary(zoneId) {
  const zone = farmZoneById(zoneId || state.farmZone || "banana_mine");
  if (zone && !zone.side) return "только D";
  const band =
    typeof farmZoneLootBand === "function" ? farmZoneLootBand(zone) : null;
  if (band === "d20") return "D (L2 ≤20)";
  if (band === "d30") return "D (L2 20–30)";
  if (band === "c40") return "C (L2 30–40)";
  if (band === "c40p") return "C (L2 40+)";
  const grade =
    typeof farmZoneLootGrade === "function" ? farmZoneLootGrade(zone) : "D";
  return grade === "C" ? "C" : "D";
}



/** Базовый шанс оружия (референс = золотой). Ниже старого «только golden». */
function mineWeaponDropChanceBase() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const lvl = state.avatar?.level || 1;
  const power = avatarFarmPower();
  const target = farmZoneTargetPower(zone);
  if (zone && !zone.side) {
    let ch = 0.028 + Math.min(0.02, Math.max(0, (zone.chapter || 1) - 1) * 0.005);
    if (power >= target) ch += 0.008;
    return Math.min(0.055, ch);
  }
  const prog =
    typeof farmZoneProgressChapter === "function"
      ? farmZoneProgressChapter(zone)
      : zone.chapter || 1;
  let ch = 0.07 + prog * 0.015 + Math.max(0, lvl - (zone.reqLevel || 1)) * 0.006;
  if (power >= target) ch += 0.02;
  if (power >= target * 1.15) ch += 0.012;
  return Math.min(0.18, ch);
}

/**
 * Шанс оружия с моба: обычный / золотой / босс.
 * Обычные тоже дропают, но реже; золотые выше обычных (база снижена vs старый golden-only).
 */
function mineWeaponDropChance(mobType) {
  const base = mineWeaponDropChanceBase();
  const type = mobType === "boss" || mobType === "golden" ? mobType : "normal";
  if (type === "boss") return Math.min(0.4, base * 1.75);
  if (type === "golden") return base;
  return Math.min(0.055, base * 0.28);
}

/** @deprecated используй mineWeaponDropChance("golden") */
function mineGoldenWeaponChance() {
  return mineWeaponDropChance("golden");
}

