// ===== Данные: пассивный доход adeна (оффлайн + кап C+D) =====
// baseAdenaPerSec ≈ 10% якоря farm/час гл.I (ECONOMY). Кривая глав = economyChapterFarmMult.

const PASSIVE_INCOME = {
  /** Fallback, если economy-balance ещё не загружен: 150k/час * 0.1 / 3600. */
  baseAdenaPerSec: 4.17,
  /** Сила фарма: rate *= 1 + power/powerDiv */
  powerDiv: 420,
  /** Относительно гл.I — те же множители, что farmAdenaPerHour. */
  chapterMult: [1, 2, 3.5, 5.5, 8],
  /** Базовый кап накопления (сек). */
  baseCapSec: 2 * 3600,
  /** +сек за каждую завершённую главу Prelude. */
  chapterCapBonusSec: 3600,
  /** +сек за каждый купленный уровень склада. */
  warehouseCapBonusSec: 2 * 3600,
  warehouseMaxLv: 4,
  /** ~30–50 мин фарма якоря на момент покупки. */
  warehousePrices: [80_000, 200_000, 450_000, 1_000_000],
};

function defaultPassiveIncomeState() {
  return { lastCollectAt: 0, warehouseLv: 0 };
}
