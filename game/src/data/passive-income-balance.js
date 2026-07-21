// ===== Данные: пассивный доход adeна (оффлайн + кап C+D) =====

const PASSIVE_INCOME = {
  /** Базовая ставка adeна/сек на гл.I при силе ~0 (цель ~8–12% активного фарма). */
  baseAdenaPerSec: 95,
  /** Сила фарма: rate *= 1 + power/powerDiv */
  powerDiv: 420,
  chapterMult: [1, 1.12, 1.28, 1.48, 1.7],
  /** Базовый кап накопления (сек). */
  baseCapSec: 2 * 3600,
  /** +сек за каждую завершённую главу Prelude. */
  chapterCapBonusSec: 3600,
  /** +сек за каждый купленный уровень склада. */
  warehouseCapBonusSec: 2 * 3600,
  warehouseMaxLv: 4,
  warehousePrices: [150_000, 400_000, 900_000, 1_800_000],
};

function defaultPassiveIncomeState() {
  return { lastCollectAt: 0, warehouseLv: 0 };
}
