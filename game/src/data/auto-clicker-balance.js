// ===== Данные: автокликер (покупка на время) =====
// Цены ≈ 70–75% дохода якоря farm за длительность пакета (гл.I).

const AUTO_CLICKER = {
  intervalMs: 150,
  chapterPriceMultStep: 0.08,
  /** Максимум накопленного времени автоудара (стак пакетов). */
  maxStackMs: 3 * 60 * 60 * 1000,
  packs: [
    { id: "short", label: "15 мин", durationMs: 15 * 60 * 1000, price: 1_750_000 },
    { id: "mid", label: "30 мин", durationMs: 30 * 60 * 1000, price: 3_500_000 },
    { id: "long", label: "60 мин", durationMs: 60 * 60 * 1000, price: 6_900_000 },
  ],
};

function defaultAutoClickerState() {
  return { until: 0, enabled: true, pauseStartedAt: 0 };
}
