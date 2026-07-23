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

      if (avatarIsMystic()) {
        out.matk += mysticWeaponPower(w, p);
      } else {
        out.patk += fighterWeaponPower(w, p);
        out.matk += statAt(w.matk, w.ms, p);
      }

      return;

    }

    const def = COLLECTIBLES[item.id];

    const b = def?.bonuses;

    if (!b) return;

    if (b.patk) out.patk += b.patk;

    if (b.matk) out.matk += b.matk;

    if (b.pdef) out.pdef += b.pdef;

    if (b.mdef) out.mdef += b.mdef;

  });

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
  if (avatarIsMystic()) {
    const weak = weaponAffinityMult(w, true) < 1 ? " · слабо" : "";
    return "M.Atk " + fmt(mysticWeaponPower(w, p)) + weak + " · " + weaponAffinityShort(w);
  }
  const weak = weaponAffinityMult(w, false) < 1 ? " · слабо" : "";
  return "P.Atk " + fmt(fighterWeaponPower(w, p)) + weak + " · " + weaponAffinityShort(w);
}

function avatarFarmPower() {
  const s = avatarStats();
  const mystic = avatarIsMystic();
  const primary = mystic ? s.matk * 1.06 : s.patk;
  const secondary = mystic ? s.patk : s.matk;
  const power = Math.round(
    primary * 1.0 + secondary * 0.72 + s.pdef * 0.36 + s.mdef * 0.36 + Math.max(0, (state.avatar?.level || 1) - 1) * 1.5 + s.farmBonus
  );
  return Math.max(1, power);
}

/** Бонус P.Atk от оружия; fixedPlus — принудительный уровень заточки (для базового HP). */
function avatarWeaponPatkBonus(fixedPlus) {
  if (avatarIsMystic()) return 0;
  if (typeof iterEquippedGear !== "function") return 0;
  let patk = 0;
  iterEquippedGear().forEach(({ item }) => {
    if (item.kind !== "weapon") return;
    const w = WMAP[item.id];
    if (!w) return;
    const plus = fixedPlus !== undefined ? fixedPlus : (item.plus || 0);
    patk += fighterWeaponPower(w, plus);
  });
  return patk;
}

/** Бонус M.Atk от оружия; fixedPlus — принудительный уровень заточки (для базового HP). */
function avatarWeaponMatkBonus(fixedPlus) {
  if (typeof iterEquippedGear !== "function") return 0;
  let matk = 0;
  iterEquippedGear().forEach(({ item }) => {
    if (item.kind !== "weapon") return;
    const w = WMAP[item.id];
    if (!w) return;
    const plus = fixedPlus !== undefined ? fixedPlus : (item.plus || 0);
    matk += avatarIsMystic() ? mysticWeaponPower(w, plus) : statAt(w.matk, w.ms, plus);
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
  const ch = zone?.chapter || 1;
  return basePatk + weaponPatk * mineWeaponDamageScale(ch);
}

function avatarMineMatkForDamage(weaponPlus) {
  const s = avatarStats();
  const weaponMatk = avatarWeaponMatkBonus(weaponPlus);
  const baseMatk = Math.max(0, s.matk - avatarWeaponMatkBonus());
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = zone?.chapter || 1;
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

/** Урон без учёта заточки — для расчёта HP (заточка тогда реально ускоряет убийство). */
function avatarMineBaseClickDamage() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = zone?.chapter || 1;
  const raw = avatarMineClickRaw(0);
  const chapterScale = 1 + (ch - 1) * 0.035;
  return Math.max(4, Math.round((raw * chapterScale) / 4.2));
}

/** Урон клика с полной заточкой оружия. */
function avatarMineClickDamage() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = zone?.chapter || 1;
  const raw = avatarMineClickRaw();
  const chapterScale = 1 + (ch - 1) * 0.035;
  return Math.max(4, Math.round((raw * chapterScale) / 4.2));
}

/** Прибавка урона от заточки (для HUD). */
function avatarMineEnchantDamageBonus() {
  return Math.max(0, avatarMineClickDamage() - avatarMineBaseClickDamage());
}

/** Сколько ударов нужно, чтобы убить моба (не зависит от «силы фарма»). */
function mineHitsToKill(type, zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const zone = farmZoneById(zoneId);
  const ch = zone?.chapter || 1;
  const ci = Math.min(5, Math.max(1, ch)) - 1;
  const base = {
    normal: [7, 8, 9, 10, 11],
    golden: [13, 15, 17, 19, 22],
    // Гл.1 мягче: проходим около targetPower; дальше эскалация
    boss: [44, 68, 80, 90, 104],
  };
  let hits = (base[type] || base.normal)[ci];
  const power = avatarFarmPower();
  const tgt = farmZoneTargetPower(zone);
  if (power < tgt) hits = Math.round(hits * (1 + ((tgt - power) / Math.max(1, tgt)) * 0.45));
  return Math.max(type === "boss" ? (ci === 0 ? 28 : 40) : type === "golden" ? 8 : 4, hits);
}

/** HP моба = базовый урон × число ударов (заточка снижает фактическое число кликов). */
function mineMobMaxHp(type, zoneId) {
  const dmg = avatarMineBaseClickDamage();
  const hits = mineHitsToKill(type, zoneId);
  let hp = Math.round(dmg * hits);
  if (type === "golden") hp = Math.round(hp * 1.08);
  if (type === "boss") {
    const boss = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : { hpMult: 14 };
    hp = Math.round(hp * Math.max(1, (boss.hpMult || 14) / 12));
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
    ? passiveEffectSum("farmBonus", a.raceId, level)
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



/** Базовый рост adena по главе и уровню (до бонуса силы).
 *  Кривая главы = ECONOMY.farmAdenaPerHour относительно гл.I. */
function mineProgressAdenaScale(zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const zone = farmZoneById(zoneId);
  const chapter = zone.chapter || 1;
  const lvl = state.avatar?.level || 1;
  const chapterMult =
    typeof economyChapterFarmMult === "function"
      ? economyChapterFarmMult(chapter)
      : ([1, 2, 3.5, 5.5, 8][chapter - 1] || 1);
  const lvlMult = 1 + Math.max(0, lvl - 1) * 0.02;
  return chapterMult * lvlMult;
}



/** Веса грейдов оружия с золотой цели — только по главе зоны. */
function mineDropWeights(zoneId) {
  const zone = farmZoneById(zoneId || state.farmZone || "banana_mine");
  const chapter = zone.chapter || 1;
  const tables = {
    1: { D: 100, C: 0, B: 0, A: 0 },
    2: { D: 78, C: 22, B: 0, A: 0 },
    3: { D: 55, C: 35, B: 10, A: 0 },
    4: { D: 35, C: 40, B: 25, A: 0 },
    5: { D: 0, C: 52, B: 33, A: 15 },
  };
  return { ...(tables[chapter] || tables[1]) };
}

function mineDropGradeSummary(zoneId) {
  const zone = farmZoneById(zoneId || state.farmZone || "banana_mine");
  const ch = zone.chapter || 1;
  const labels = {
    1: "только D",
    2: "D, иногда C",
    3: "D, C, редко B",
    4: "D, C, B",
    5: "C, B, редко A",
  };
  return labels[ch] || "D";
}



/** Шанс выпадения оружия с золотой цели (грейд — mineDropWeights). */
function mineGoldenWeaponChance() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const chapter = zone.chapter || 1;
  const lvl = state.avatar?.level || 1;
  const power = avatarFarmPower();
  const target = farmZoneTargetPower(zone);
  // База ~10–22% по главам (+2% к формуле), потолок 37%
  let ch = 0.10 + chapter * 0.025 + Math.max(0, lvl - zone.reqLevel) * 0.01;
  if (power >= target) ch += 0.03;
  if (power >= target * 1.15) ch += 0.02;
  return Math.min(0.37, ch);
}

