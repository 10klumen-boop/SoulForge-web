// ===== Печати угодий — валюта holder-фарма (клановый счётчик) =====

const CLAN_ZONE_SEAL = {
  id: "clan_zone_seal",
  nameRu: "Печать угодья",
  descRu:
    "Копится при online-фарме на зоне, которой владеет ваш клан. Тратится на знамя клана (+XP/рейтинг) или усиливает заявку на осаду.",
  perHit: 1,
  hourCap: 120,
  spendPurposes: {
    banner: { labelRu: "Вложить в знамя", hintRu: "+клан XP и рейтинг" },
    study_boost: { labelRu: "Подкрепление баффов", hintRu: "+клан XP" },
  },
};

function clanZoneSealLabel(territoryId) {
  const t =
    typeof clanTerritoryById === "function" ? clanTerritoryById(territoryId) : null;
  return t ? "Печать: " + t.labelRu : "Печать угодья";
}

if (typeof window !== "undefined") {
  window.CLAN_ZONE_SEAL = CLAN_ZONE_SEAL;
  window.clanZoneSealLabel = clanZoneSealLabel;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CLAN_ZONE_SEAL, clanZoneSealLabel };
}
