// ===== Символ Клятвы — валюта рейда клана (инвентарь / рынок / изучение баффов) =====

const OATH_SYMBOL = {
  id: "oath_symbol",
  /** ключ в state.materials */
  materialKey: "oath_symbol",
  nameRu: "Символ Клятвы",
  name: "Oath Symbol",
  icon: "icons/clan/oath_symbol.png?v=1",
  descRu: "Награда за рейд «Хранитель Клятвы». Тратится на изучение клан-баффов. Можно продать на рынке.",
};

function oathSymbolCount(materials) {
  const mats = materials && typeof materials === "object" ? materials : {};
  return Math.max(0, Math.floor(Number(mats[OATH_SYMBOL.materialKey]) || 0));
}

function ensureOathSymbolMaterials(materials) {
  const mats = materials && typeof materials === "object" ? materials : {};
  if (mats[OATH_SYMBOL.materialKey] == null) mats[OATH_SYMBOL.materialKey] = 0;
  return mats;
}

if (typeof window !== "undefined") {
  window.OATH_SYMBOL = OATH_SYMBOL;
  window.oathSymbolCount = oathSymbolCount;
  window.ensureOathSymbolMaterials = ensureOathSymbolMaterials;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { OATH_SYMBOL, oathSymbolCount, ensureOathSymbolMaterials };
}
