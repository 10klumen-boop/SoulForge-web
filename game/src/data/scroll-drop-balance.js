// ===== Свитки заточки: дроп с фарма =====
// target: weapon | armor (armor = броня + бижутерия); type: regular|blessed|destruction; grade: D|C|B|A
// Кристальные свитки (guarantee) в поле не дропаются — только рынок / прочие источники.

/** Шанс дропа свитка по типу моба. */
const SCROLL_DROP_CHANCE = {
  normal: 0.045,
  golden: 0.16,
  boss: 0.42,
};

/** Множитель шанса свитка в сюжетных главах (только редкий D). */
const SCROLL_DROP_STORY_MULT = 0.35;

/** Веса типа свитка. crystal = 0: не добывается в поле. */
const SCROLL_DROP_TYPE_WEIGHTS = {
  normal: { regular: 78, blessed: 18, destruction: 4, crystal: 0 },
  golden: { regular: 62, blessed: 28, destruction: 10, crystal: 0 },
  boss: { regular: 48, blessed: 32, destruction: 20, crystal: 0 },
};

/** Доля свитков оружия vs брони (броня = броня+бижу). */
const SCROLL_DROP_WEAPON_SHARE = 0.55;

/** Веса цели свитка при дропе. */
const SCROLL_DROP_TARGET_WEIGHTS = {
  weapon: 55,
  armor: 45,
};

/**
 * Грейд свитка по зоне / главе.
 * Hunting MVP + legacy aliases.
 */
const SCROLL_DROP_ZONE_GRADE = {
  wasteland: "D",
  scrap_field: "D",
  race_outskirts: "D",
  abandoned_camp: "D",
  ruins_agony: "D",
  abandoned_coal_low: "D",
  mithril_forge: "D",
  execution_grounds: "C",
};

/** Глава → грейд свитка (сюжетная цепочка; hunting — lootTags / ZONE_GRADE). */
const SCROLL_DROP_CHAPTER_GRADE = {
  1: "D",
  2: "D",
  3: "D",
  4: "C",
  5: "C",
};
