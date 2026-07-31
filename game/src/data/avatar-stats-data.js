// ===== Данные: базовые статы рас и бонусы классов =====
// Числа для avatar-math / StatPipeline. Идентичность рас — в avatar-data.js.
// B1: расы ×≈1.25 vs старых баз; порядок рас сохранён.

const RACE_BASE_STATS = {
  human: { patk: 19, matk: 16, pdef: 19, mdef: 19 },
  elf: { patk: 15, matk: 24, pdef: 15, mdef: 21 },
  dark_elf: { patk: 21, matk: 20, pdef: 14, mdef: 18 },
  orc: { patk: 25, matk: 13, pdef: 24, mdef: 14 },
  dwarf: { patk: 21, matk: 13, pdef: 21, mdef: 18 },
};

const CLASS_STAT_BONUS = {
  fighter: { patk: 4, matk: 0, pdef: 3, mdef: 0 },
  mystic: { patk: 0, matk: 5, pdef: 0, mdef: 3 },
};

/**
 * Доля брони/сет DEF в силе фарма (остальное — sustain).
 * B2: hunting side reqPower/targetPower ×2 (mid D 88→176).
 * Сюжетные главы не трогали. PvP: *Add global без double-add на live sheet.
 */
const ARMOR_FARM_DEF_WEIGHT = 0.35;
