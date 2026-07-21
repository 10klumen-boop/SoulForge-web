// ===== Данные: автокликер (покупка на время) =====

const AUTO_CLICKER = {
  intervalMs: 220,
  chapterPriceMultStep: 0.08,
  packs: [
    { id: "short", label: "15 мин", durationMs: 15 * 60 * 1000, price: 80_000 },
    { id: "mid", label: "30 мин", durationMs: 30 * 60 * 1000, price: 180_000 },
    { id: "long", label: "60 мин", durationMs: 60 * 60 * 1000, price: 380_000 },
  ],
};

function defaultAutoClickerState() {
  return { until: 0, enabled: true, pauseStartedAt: 0 };
}
