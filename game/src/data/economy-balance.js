// ===== Данные: единая кривая дохода (P1 калибровка) =====
// Якорь — целевой farm adena/час по главам (середины roadmap).
// Step ≈ 10–16 мин фарма; chapter clear ≈ 45 мин; пассив ≈ 10% farm/час.
// Live-фарм (автоклик ~1700→1200 киллов/час) калибруется под эти якоря.

const ECONOMY = {
  farmAdenaPerHour: [150_000, 300_000, 525_000, 825_000, 1_200_000],
  /** Оценка киллов/час с автокликом 220ms (hits 7→11 + spawn delay). */
  farmKillsPerHourAuto: [1700, 1550, 1420, 1320, 1220],
  stepFarmMinutes: [10, 12, 16],
  chapterFarmMinutes: 45,
  passiveOfFarm: 0.1,
  goldenAdenaMult: 6,
};

function economyChapterIndex(chapter) {
  return Math.min(4, Math.max(0, (Number(chapter) || 1) - 1));
}

function economyFarmAdenaPerHour(chapter) {
  return ECONOMY.farmAdenaPerHour[economyChapterIndex(chapter)];
}

function economyFarmAdenaPerSec(chapter) {
  return economyFarmAdenaPerHour(chapter) / 3600;
}

/** Пассив adeна/сек от якоря farm (без силы персонажа). */
function economyPassiveAdenaPerSec(chapter) {
  return economyFarmAdenaPerSec(chapter) * (ECONOMY.passiveOfFarm || 0.1);
}

/** Множитель главы относительно гл.I (для mineProgressAdenaScale / passive). */
function economyChapterFarmMult(chapter) {
  const base = economyFarmAdenaPerHour(1);
  return base > 0 ? economyFarmAdenaPerHour(chapter) / base : 1;
}

/** Adena за шаг поручения (1..3) от якоря farm/час. */
function economyStepAdena(chapter, step) {
  const perHour = economyFarmAdenaPerHour(chapter);
  const idx = Math.min(2, Math.max(0, (Number(step) || 1) - 1));
  const minutes = ECONOMY.stepFarmMinutes[idx];
  return Math.round(perHour * (minutes / 60));
}

/** Adena за clear главы (босс). */
function economyChapterAdena(chapter) {
  const perHour = economyFarmAdenaPerHour(chapter);
  return Math.round(perHour * (ECONOMY.chapterFarmMinutes / 60));
}

/**
 * Масштаб adena ачивок под новую кривую.
 * early drip ×2, mid ×3–4, late ×2.5–3 — без взрыва prestige.
 */
function economyScaleAchAdena(oldAdena) {
  const n = Math.max(0, Math.floor(Number(oldAdena) || 0));
  if (n <= 0) return 0;
  if (n <= 2_500) return Math.round(n * 2);
  if (n <= 15_000) return Math.round(n * 3);
  if (n <= 50_000) return Math.round(n * 4);
  if (n <= 100_000) return Math.round(n * 3);
  return Math.round(n * 2.5);
}
