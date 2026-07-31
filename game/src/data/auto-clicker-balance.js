// ===== Данные: автокликер (покупка на время) =====
// pack.price — якорь ≈ 70–75% live farm гл.I за длительность.
// Итоговая цена = pack.price × flatPriceScale (единая «средняя» шкала, без зоны —
// иначе покупали дёшево в intro и фармили в хай-лвл).

const AUTO_CLICKER = {
  intervalMs: 150,
  /** Доля live adena/час зоны за длительность пакета (якорь pack.price при scale=1). */
  priceOfLiveFarm: 0.72,
  /**
   * Фиксированный множитель цены (≈ среднее глав 1…5: (1+2+3.5+5.5+8)/5 = 4).
   * Не зависит от текущей зоны/охоты.
   */
  flatPriceScale: 4,
  /** Максимум накопленного времени автоудара (стак пакетов). */
  maxStackMs: 3 * 60 * 60 * 1000,
  packs: [
    { id: "short", label: "15 мин", durationMs: 15 * 60 * 1000, price: 1_750_000 },
    { id: "mid", label: "30 мин", durationMs: 30 * 60 * 1000, price: 3_500_000 },
    { id: "long", label: "60 мин", durationMs: 60 * 60 * 1000, price: 6_900_000 },
  ],
};

function defaultAutoClickerState() {
  return { until: 0, enabled: true, pauseStartedAt: 0, pausedRemainingMs: 0 };
}
