// ===== Данные: Казино Банана (гача-автомат) =====
// Жёсткий sink: без адены и оружия. Только руда / кристальные свитки / талисман.
// Жетоны с поимки Банана + докупка аденой. EV крутки ниже live-фарма.

const BANANA_CASINO = {
  /** Pity: крутки без rare+ → форс кристальный свиток. */
  pityRare: 50,
  /** Pity: крутки без jackpot → форс талисман. */
  pityJackpot: 280,
  historyMax: 20,
  tokenPerPull: 1,
  /** Пакеты жетонов — фиксированная цена (без скейла зоны). */
  tokenPacks: [
    { id: "x1", label: "1 жетон", tokens: 1, price: 50_000_000 },
    { id: "x10", label: "10 жетонов", tokens: 10, price: 450_000_000 },
  ],
  /**
   * Веса на 10000. uncommon/rare/epic — те же %; jackpot 1/10000 = 0.01%.
   */
  tierWeights: {
    common: 9309,
    uncommon: 400,
    rare: 270,
    epic: 20,
    jackpot: 1,
  },
  /** Common: Soul Ore или Spirit Ore. */
  commonOres: [
    { id: "soul", min: 6, max: 14 },
    { id: "spirit", min: 6, max: 14 },
  ],
  /** Uncommon: кристальный свиток D (броня / оружие). */
  uncommonCrystal: { grade: "D", targets: ["armor", "weapon"], qty: 1 },
  /** Rare: кристальный свиток брони C. */
  rareCrystal: { grade: "C", target: "armor", qty: 1 },
  /** Epic: кристальный свиток оружия C. */
  epicCrystal: { grade: "C", target: "weapon", qty: 1 },
  /** Jackpot: только Талисман Банана. */
  jackpotCharmShare: 1,
  reelIcons: {
    soul: "icons/etc_crystal_white_i00.png",
    spirit: "icons/etc_stone_gray_i00.png",
    crystal: "icons/etc_scroll_of_enchant_weapon_i05.png",
    banana: "icons/banana_reel.png?v=1",
    charm: "icons/banana_lucky_charm.png?v=1",
  },
  charmId: "banana_lucky_charm",
};

function defaultBananaCasinoState() {
  return {
    tokens: 0,
    pity: 0,
    pityJackpot: 0,
    pulls: 0,
    jackpots: 0,
    history: [],
  };
}
