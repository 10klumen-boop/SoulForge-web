// ===== Hunting zones: alias, кривая силы, capturable freeze (Gate0) =====
// SF avatar.level — единственный gate. L2 lvlMin/Max в JSON — ориентир канона.

/** Старые id сейвов / избранного → актуальный farmZoneId. */
const FARM_ZONE_ALIASES = {
  scrap_field: "wasteland",
  mithril_forge: "abandoned_coal_low",
};

/**
 * Гейты охоты (reqLevel / reqPower / targetPower) калибруются от L2 mid:
 *  mid < 18  → SF ~1–10 (soft)
 *  18–30     → SF 12–18 (D, L2 20–30)
 *  30–40     → SF 22–28 (C)
 *  40+       → SF 30–36 (C+)
 * Так SF 20 не заходит в L2 30–40 / 40+. Живые числа — в story-zones.json.
 */
const FARM_POWER_CURVE = [
  { l2Mid: 12, reqLevel: 5, reqPower: 80, note: "soft ≤20 (B2 ×2 vs B1 power)" },
  { l2Mid: 25, reqLevel: 16, reqPower: 176, note: "D 20–30" },
  { l2Mid: 35, reqLevel: 25, reqPower: 256, note: "C 30–40" },
  { l2Mid: 45, reqLevel: 32, reqPower: 318, note: "C 40+" },
  { l2Mid: 55, reqLevel: 36, reqPower: 352, note: "C 50+" },
];

/** Все side-зоны охоты (кроме race soft-start). */
const CLAN_CAPTURABLE_TARGET_IDS = [
  "blazing_swamp",
  "school_of_dark_arts",
  "ant_nest",
  "bee_hive",
  "cruma_marshlands",
  "cruma_tower_entrance",
  "dion_hills",
  "execution_grounds",
  "floran_agricultural",
  "partisans_hideaway",
  "plains_of_dion",
  "abandoned_coal_low",
  "elven_ruins_hunt",
  "breka_stronghold",
  "death_pass",
  "dragon_valley_entrance",
  "gorgon_flower_garden",
  "fellmere_harvesting",
  "windmill_hill",
  "abandoned_camp",
  "evil_hunting_grounds",
  "langk_lizardman",
  "maille_lizardman",
  "neutral_zone",
  "orc_barracks_hunt",
  "ruins_agony",
  "ruins_despair",
  "wasteland",
  "alligator_island",
  "enchanted_valley",
  "sea_of_spores"
];

/** Claim/siege nodes (все live side-зоны). */
const CLAN_SIEGE_MVP_IDS = [
  "blazing_swamp",
  "school_of_dark_arts",
  "ant_nest",
  "bee_hive",
  "cruma_marshlands",
  "cruma_tower_entrance",
  "dion_hills",
  "execution_grounds",
  "floran_agricultural",
  "partisans_hideaway",
  "plains_of_dion",
  "abandoned_coal_low",
  "elven_ruins_hunt",
  "breka_stronghold",
  "death_pass",
  "dragon_valley_entrance",
  "gorgon_flower_garden",
  "fellmere_harvesting",
  "windmill_hill",
  "abandoned_camp",
  "evil_hunting_grounds",
  "langk_lizardman",
  "maille_lizardman",
  "neutral_zone",
  "orc_barracks_hunt",
  "ruins_agony",
  "ruins_despair",
  "wasteland",
  "alligator_island",
  "enchanted_valley",
  "sea_of_spores"
];

const CLAN_TERRITORY_CAP = { farm: 2, city: 1 };

/** SF lvl, после которого показываем CTA в hunting. */
const HUNTING_GRADUATION_LEVEL = 10;

/** Дефолтная hunting-зона для CTA. */
const HUNTING_CTA_ZONE_ID = "wasteland";

/**
 * Экономическая/дроп-глава зоны.
 * Сюжет: narrative `chapter`. Охота: от L2-банды лута (не от SF reqLevel).
 */
function farmZoneProgressChapter(zoneOrId) {
  const zone =
    typeof zoneOrId === "string"
      ? typeof farmZoneById === "function"
        ? farmZoneById(zoneOrId)
        : null
      : zoneOrId;
  if (!zone) return 1;
  if (!zone.side) {
    return Math.min(5, Math.max(1, Number(zone.chapter) || 1));
  }
  const band = typeof farmZoneLootBand === "function" ? farmZoneLootBand(zone) : null;
  if (band === "d20") return 1;
  if (band === "d30") return 2;
  if (band === "c40") return 3;
  if (band === "c40p") return 5;
  const lvl = Math.max(1, Number(zone.reqLevel) || 1);
  if (lvl <= 12) return 1;
  if (lvl <= 18) return 2;
  if (lvl <= 28) return 3;
  if (lvl <= 32) return 4;
  return 5;
}

/**
 * Середина канонического L2-диапазона зоны (lvlMin/lvlMax).
 * Fallback: reqLevel × 2.2 (грубо SF→L2).
 */
function farmZoneL2Mid(zoneOrId) {
  const zone =
    typeof zoneOrId === "string"
      ? typeof farmZoneById === "function"
        ? farmZoneById(zoneOrId)
        : null
      : zoneOrId;
  if (!zone) return 1;
  const lo = Number(zone.lvlMin);
  const hi = Number(zone.lvlMax);
  if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo) {
    return (lo + hi) / 2;
  }
  return Math.max(1, Number(zone.reqLevel) || 1) * 2.2;
}

/**
 * Банда лута охоты по L2 mid:
 *  d20  — ≤20
 *  d30  — 20–30
 *  c40  — 30–40
 *  c40p — 40+
 */
function farmZoneLootBand(zoneOrId) {
  const zone =
    typeof zoneOrId === "string"
      ? typeof farmZoneById === "function"
        ? farmZoneById(zoneOrId)
        : null
      : zoneOrId;
  if (!zone || !zone.side) return null;
  const mid = farmZoneL2Mid(zone);
  // mid ровно 20 (L2 15–25) → d20, как UI-фильтр «до 20»
  if (mid <= 20) return "d20";
  if (mid < 30) return "d30";
  if (mid < 40) return "c40";
  return "c40p";
}

/** D | C — грейд кусков/свитков/оружия охоты. */
function farmZoneLootGrade(zoneOrId) {
  const band = farmZoneLootBand(zoneOrId);
  if (!band) return "D";
  return band.charAt(0) === "c" ? "C" : "D";
}

/** Короткая подпись банды для тултипа. */
function farmZoneLootBandLabel(zoneOrId) {
  const band = farmZoneLootBand(zoneOrId);
  const map = {
    d20: "L2 ≤20 · дроп D (куски, оружие, свитки)",
    d30: "L2 20–30 · дроп D, сильнее на высоких зонах",
    c40: "L2 30–40 · дроп C (куски, оружие, свитки)",
    c40p: "L2 40+ · дроп C (куски, оружие, свитки)",
  };
  return map[band] || "";
}

function resolveFarmZoneId(id) {
  const raw = String(id || "");
  if (!raw) return raw;
  const map = typeof FARM_ZONE_ALIASES !== "undefined" ? FARM_ZONE_ALIASES : {};
  return map[raw] || raw;
}

function isClanSiegeEnabledZone(zoneOrId) {
  const z = typeof zoneOrId === "string"
    ? (typeof farmZoneById === "function" ? farmZoneById(zoneOrId) : { id: zoneOrId })
    : zoneOrId;
  return !!(z && z.side && z.capturable && z.siegeEnabled);
}
