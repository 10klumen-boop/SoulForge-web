// ===== Данные: единая кривая дохода (P1 калибровка) =====
// Якорь — целевой farm adena/час по главам (середины roadmap).
// Step ≈ 10–16 мин фарма главы; chapter clear ≈ 45 мин фарма.
// Live-фарм (автоклик) может быть выше — квесты калибруются по якорю, не по пику DPS.

const ECONOMY = {
  farmAdenaPerHour: [150_000, 300_000, 525_000, 825_000, 1_200_000],
  stepFarmMinutes: [10, 12, 16],
  chapterFarmMinutes: 45,
  /** Цель пассива относительно якоря farm/час (сам PASSIVE_INCOME пока отдельный). */
  passiveOfFarm: 0.1,
};

function economyChapterIndex(chapter) {
  return Math.min(4, Math.max(0, (Number(chapter) || 1) - 1));
}

function economyFarmAdenaPerHour(chapter) {
  return ECONOMY.farmAdenaPerHour[economyChapterIndex(chapter)];
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
