// ===== Каталог охотничьих угодий Aden по городам/хабам =====
// Источник плана наращивания: L2 hunting ≤40 + roadmap.
// Игра (claim/siege) читает CLAN_TERRITORIES; UI — clanGroundsTreeForGame().
// Редактор каталога: aden-pins.html (город → угодья, без карты).
//
// status:
//   live     — есть farm-зона и/или пин в CLAN_TERRITORIES
//   draft    — зона в JSON или скоро; пин для расстановки
//   planned  — очередь после MVP / следующих хабов
//
// x/y — % карты Aden (CRS overview). null = ещё не ставили.

const CLAN_HUNTING_HUBS = [
  { id: "talking_island", labelRu: "Говорящий остров", labelL2: "Talking Island", tier: 0 },
  { id: "elven_village", labelRu: "Деревня эльфов", labelL2: "Elven Village", tier: 0 },
  { id: "dark_elven_village", labelRu: "Деревня тёмных", labelL2: "Dark Elven Village", tier: 0 },
  { id: "orc_village", labelRu: "Деревня орков", labelL2: "Orc Village", tier: 0 },
  { id: "dwarven_village", labelRu: "Деревня гномов", labelL2: "Dwarven Village", tier: 0 },
  { id: "gludin", labelRu: "Глудин", labelL2: "Gludin Village", tier: 1 },
  { id: "gludio", labelRu: "Глудио", labelL2: "Town of Gludio", tier: 1 },
  { id: "dion", labelRu: "Дион", labelL2: "Town of Dion", tier: 1 },
  { id: "giran", labelRu: "Гиран", labelL2: "Town of Giran", tier: 2 },
  { id: "oren", labelRu: "Орен", labelL2: "Town of Oren", tier: 2 },
  { id: "aden", labelRu: "Аден", labelL2: "Town of Aden", tier: 3 },
  { id: "heine", labelRu: "Хейн", labelL2: "Heine", tier: 2 },
  { id: "goddard", labelRu: "Годдард", labelL2: "Town of Goddard", tier: 3 },
  { id: "rune", labelRu: "Руна", labelL2: "Rune Township", tier: 3 },
  { id: "schuttgart", labelRu: "Шутгарт", labelL2: "Town of Schuttgart", tier: 3 },
];

/**
 * Полный каталог: хабы + hunting. farmZoneId = id в FARM_ZONES (если есть).
 * capturableTarget — из CLAN_CAPTURABLE_TARGET_IDS / план 6–8.
 */
const CLAN_HUNTING_CATALOG = [
  // —— Хабы (города / стартовые деревни) ——
  {
    id: "talking_island",
    kind: "hub",
    hubId: null,
    labelRu: "Говорящий остров",
    labelL2: "Talking Island",
    status: "planned",
    farmZoneId: null,
    x: 13.0,
    y: 96.6,
  },
  {
    id: "elven_village",
    kind: "hub",
    hubId: null,
    labelRu: "Деревня эльфов",
    labelL2: "Elven Village",
    status: "live",
    farmZoneId: null,
    x: 49.4,
    y: 59.8,
  },
  {
    id: "dark_elven_village",
    kind: "hub",
    hubId: null,
    labelRu: "Деревня тёмных",
    labelL2: "Dark Elven Village",
    status: "live",
    farmZoneId: null,
    x: 39.1,
    y: 53.0,
  },
  {
    id: "orc_village",
    kind: "hub",
    hubId: null,
    labelRu: "Деревня орков",
    labelL2: "Orc Village",
    status: "planned",
    farmZoneId: null,
    x: 23.8,
    y: 28.5,
  },
  {
    id: "dwarven_village",
    kind: "hub",
    hubId: null,
    labelRu: "Деревня гномов",
    labelL2: "Dwarven Village",
    status: "draft",
    farmZoneId: null,
    x: 68.3,
    y: 16.0,
  },
  {
    id: "gludin",
    kind: "city",
    hubId: null,
    labelRu: "Глудин",
    labelL2: "Gludin Village",
    status: "live",
    farmZoneId: null,
    x: 13.9,
    y: 78.6,
  },
  {
    id: "gludio",
    kind: "city",
    hubId: null,
    labelRu: "Глудио",
    labelL2: "Town of Gludio",
    status: "live",
    farmZoneId: null,
    x: 32.8,
    y: 73.4,
  },
  {
    id: "dion",
    kind: "city",
    hubId: null,
    labelRu: "Дион",
    labelL2: "Town of Dion",
    status: "live",
    farmZoneId: null,
    x: 40.7,
    y: 77.3,
  },
  {
    id: "giran",
    kind: "city",
    hubId: null,
    labelRu: "Гиран",
    labelL2: "Town of Giran",
    status: "live",
    farmZoneId: null,
    x: null,
    y: null,
  },
  {
    id: "oren",
    kind: "city",
    hubId: null,
    labelRu: "Орен",
    labelL2: "Town of Oren",
    status: "live",
    farmZoneId: null,
    x: null,
    y: null,
  },
  {
    id: "aden",
    kind: "city",
    hubId: null,
    labelRu: "Аден",
    labelL2: "Town of Aden",
    status: "live",
    farmZoneId: null,
    x: null,
    y: null,
  },
  {
    id: "heine",
    kind: "city",
    hubId: null,
    labelRu: "Хейн",
    labelL2: "Heine",
    status: "live",
    farmZoneId: null,
    x: null,
    y: null,
  },
  {
    id: "goddard",
    kind: "city",
    hubId: null,
    labelRu: "Годдард",
    labelL2: "Town of Goddard",
    status: "planned",
    farmZoneId: null,
    x: null,
    y: null,
  },
  {
    id: "rune",
    kind: "city",
    hubId: null,
    labelRu: "Руна",
    labelL2: "Rune Township",
    status: "planned",
    farmZoneId: null,
    x: null,
    y: null,
  },
  {
    id: "schuttgart",
    kind: "city",
    hubId: null,
    labelRu: "Шутгарт",
    labelL2: "Town of Schuttgart",
    status: "planned",
    farmZoneId: null,
    x: null,
    y: null,
  },

  // —— Расовый soft start (общий id + raceSkin) ——
  {
    id: "race_outskirts",
    kind: "farm",
    hubId: "race",
    labelRu: "Окраина деревни",
    labelL2: "Race Village Outskirts",
    status: "live",
    farmZoneId: "race_outskirts",
    capturable: false,
    siegeEnabled: false,
    l2Lvl: "1–15",
    x: 11.5,
    y: 94.0,
    note: "скины по расе; пин на карте — ориентир ТИ",
  },

  // —— Глудин ——
  {
    id: "windmill_hill",
    kind: "farm",
    hubId: "gludin",
    labelRu: "Ветряной холм",
    labelL2: "Windmill Hill",
    status: "live",
    farmZoneId: "windmill_hill",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "15–25",
    x: null,
    y: null,
  },
  {
    id: "fellmere_harvesting",
    kind: "farm",
    hubId: "gludin",
    labelRu: "Жатва Феллмер",
    labelL2: "Fellmere Harvesting Grounds",
    status: "live",
    farmZoneId: "fellmere_harvesting",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "15–25",
    x: null,
    y: null,
  },

  // —— Глудио ——
  {
    id: "wasteland",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Пустошь",
    labelL2: "Wasteland",
    status: "live",
    farmZoneId: "wasteland",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–35",
    x: 31.7,
    y: 90.0,
    note: "siege MVP · alias scrap_field",
  },
  {
    id: "abandoned_camp",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Заброшенный лагерь",
    labelL2: "Abandoned Camp",
    status: "live",
    farmZoneId: "abandoned_camp",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–25",
    x: 28.0,
    y: 72.0,
    note: "siege · Gludio mid",
  },
  {
    id: "ruins_agony",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Руины Агонии",
    labelL2: "Ruins of Agony",
    status: "live",
    farmZoneId: "ruins_agony",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–30",
    x: 35.0,
    y: 71.0,
    note: "siege · Gludio",
  },
  {
    id: "ruins_despair",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Руины Отчаяния",
    labelL2: "Ruins of Despair",
    status: "live",
    farmZoneId: "ruins_despair",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–30",
    x: null,
    y: null,
  },
  {
    id: "langk_lizardman",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Жилище ящеров Лангк",
    labelL2: "Langk Lizardman Dwelling",
    status: "live",
    farmZoneId: "langk_lizardman",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–30",
    x: null,
    y: null,
  },
  {
    id: "evil_hunting_grounds",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Злые охотничьи угодья",
    labelL2: "Evil Hunting Grounds",
    status: "live",
    farmZoneId: "evil_hunting_grounds",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–30",
    x: null,
    y: null,
  },
  {
    id: "neutral_zone",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Нейтральная зона",
    labelL2: "Neutral Zone",
    status: "live",
    farmZoneId: "neutral_zone",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "15–25",
    x: 40.0,
    y: 62.0,
    note: "переход к эльфам",
  },
  {
    id: "orc_barracks_hunt",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Казарма орков",
    labelL2: "Orc Barracks",
    status: "live",
    farmZoneId: "orc_barracks_hunt",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "25–34",
    x: 11.1,
    y: 70.2,
    note: "capturable target · не путать с главой III orc_barracks",
  },
  {
    id: "maille_lizardman",
    kind: "farm",
    hubId: "gludio",
    labelRu: "Казарма ящеров Мейл",
    labelL2: "Maille Lizardman Barracks",
    status: "live",
    farmZoneId: "maille_lizardman",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–30",
    x: null,
    y: null,
  },

  // —— Дион ——
  {
    id: "execution_grounds",
    kind: "farm",
    hubId: "dion",
    labelRu: "Поле казни",
    labelL2: "Execution Grounds",
    status: "live",
    farmZoneId: "execution_grounds",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–35",
    x: 50.4,
    y: 79.0,
    note: "siege MVP",
  },
  {
    id: "dion_hills",
    kind: "farm",
    hubId: "dion",
    labelRu: "Холмы Диона",
    labelL2: "Dion Hills",
    status: "live",
    farmZoneId: "dion_hills",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "20–25",
    x: null,
    y: null,
  },
  {
    id: "plains_of_dion",
    kind: "farm",
    hubId: "dion",
    labelRu: "Равнины Диона",
    labelL2: "Plains of Dion",
    status: "live",
    farmZoneId: "plains_of_dion",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "23–30",
    x: null,
    y: null,
  },
  {
    id: "bee_hive",
    kind: "farm",
    hubId: "dion",
    labelRu: "Улей",
    labelL2: "Bee Hive",
    status: "live",
    farmZoneId: "bee_hive",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "23–28",
    x: null,
    y: null,
    note: "яд / эффект",
  },
  {
    id: "floran_agricultural",
    kind: "farm",
    hubId: "dion",
    labelRu: "Флоранские поля",
    labelL2: "Floran Agricultural Area",
    status: "live",
    farmZoneId: "floran_agricultural",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "30–35",
    x: null,
    y: null,
  },
  {
    id: "cruma_marshlands",
    kind: "farm",
    hubId: "dion",
    labelRu: "Болота Крумы",
    labelL2: "Cruma Marshlands",
    status: "live",
    farmZoneId: "cruma_marshlands",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "30–40",
    x: null,
    y: null,
  },
  {
    id: "partisans_hideaway",
    kind: "farm",
    hubId: "dion",
    labelRu: "Укрытие партизан",
    labelL2: "Partisans Hideaway",
    status: "live",
    farmZoneId: "partisans_hideaway",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "23–34",
    x: null,
    y: null,
    note: "party-lean",
  },
  {
    id: "ant_nest",
    kind: "farm",
    hubId: "dion",
    labelRu: "Муравейник",
    labelL2: "The Ant Nest",
    status: "live",
    farmZoneId: "ant_nest",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "30–40",
    x: 45.5,
    y: 78.5,
    note: "capturable target · данж-фарм",
  },
  {
    id: "cruma_tower_entrance",
    kind: "farm",
    hubId: "dion",
    labelRu: "Башня Крумы (вход)",
    labelL2: "Cruma Tower",
    status: "live",
    farmZoneId: "cruma_tower_entrance",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "~40",
    x: null,
    y: null,
    note: "потолок v1 / later",
  },

  // —— Гномы ——
  {
    id: "abandoned_coal_low",
    kind: "farm",
    hubId: "dwarven_village",
    labelRu: "Угольные шахты",
    labelL2: "Abandoned Coal Mines",
    status: "live",
    farmZoneId: "abandoned_coal_low",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "1–20",
    x: 78.7,
    y: 16.7,
    note: "alias mithril_forge · free C soft",
  },
  {
    id: "school_of_dark_arts",
    kind: "farm",
    hubId: "dark_elven_village",
    labelRu: "Школа тёмных искусств",
    labelL2: "School of Dark Arts",
    status: "live",
    farmZoneId: "school_of_dark_arts",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "1–20",
    x: 44.2,
    y: 52.1,
  },
  {
    id: "elven_ruins_hunt",
    kind: "farm",
    hubId: "elven_village",
    labelRu: "Руины эльфов (охота)",
    labelL2: "Elven Ruins",
    status: "live",
    farmZoneId: "elven_ruins_hunt",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "1–23",
    x: 44.5,
    y: 64.3,
    note: "не путать с главой II elven_ruins",
  },

  // —— Гиран+ / Oren / Heine / Aden (открыты v0.58.6) ——
  {
    id: "death_pass",
    kind: "farm",
    hubId: "giran",
    labelRu: "Ущелье смерти",
    labelL2: "Death Pass",
    status: "live",
    farmZoneId: "death_pass",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "30–40",
    x: null,
    y: null,
  },
  {
    id: "gorgon_flower_garden",
    kind: "farm",
    hubId: "giran",
    labelRu: "Сад горгон",
    labelL2: "Gorgon Flower Garden",
    status: "live",
    farmZoneId: "gorgon_flower_garden",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "30–40",
    x: null,
    y: null,
  },
  {
    id: "breka_stronghold",
    kind: "farm",
    hubId: "giran",
    labelRu: "Крепость Брека",
    labelL2: "Breka's Stronghold",
    status: "live",
    farmZoneId: "breka_stronghold",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "30–40",
    x: null,
    y: null,
  },
  {
    id: "dragon_valley_entrance",
    kind: "farm",
    hubId: "giran",
    labelRu: "Долина драконов (вход)",
    labelL2: "Dragon Valley",
    status: "live",
    farmZoneId: "dragon_valley_entrance",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "40+",
    x: null,
    y: null,
  },
  {
    id: "enchanted_valley",
    kind: "farm",
    hubId: "oren",
    labelRu: "Зачарованная долина",
    labelL2: "Enchanted Valley",
    status: "live",
    farmZoneId: "enchanted_valley",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "40+",
    x: null,
    y: null,
  },
  {
    id: "sea_of_spores",
    kind: "farm",
    hubId: "oren",
    labelRu: "Море спор",
    labelL2: "Sea of Spores",
    status: "live",
    farmZoneId: "sea_of_spores",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "40+",
    x: null,
    y: null,
  },
  {
    id: "alligator_island",
    kind: "farm",
    hubId: "heine",
    labelRu: "Остров аллигаторов",
    labelL2: "Alligator Island",
    status: "live",
    farmZoneId: "alligator_island",
    capturable: true,
    siegeEnabled: true,
    l2Lvl: "40+",
    x: null,
    y: null,
  },
  {
    id: "blazing_swamp",
    kind: "farm",
    hubId: "aden",
    labelRu: "Пылающее болото",
    labelL2: "Blazing Swamp",
    status: "live",
    farmZoneId: "blazing_swamp",
    capturable: true,
    l2Lvl: "50+",
    x: null,
    y: null,
  },
];

function clanHuntingCatalogByHub(hubId) {
  return (CLAN_HUNTING_CATALOG || []).filter((e) => {
    if (hubId === "race") return e.hubId === "race";
    if (e.id === hubId) return true;
    return e.hubId === hubId;
  });
}

function clanHuntingCatalogFarms() {
  return (CLAN_HUNTING_CATALOG || []).filter((e) => e.kind === "farm");
}

function clanHuntingCatalogEntry(id) {
  return (CLAN_HUNTING_CATALOG || []).find((e) => e.id === id) || null;
}

function clanHuntingHubById(hubId) {
  const fromHubs = (CLAN_HUNTING_HUBS || []).find((h) => h.id === hubId);
  if (fromHubs) return fromHubs;
  const fromCat = (CLAN_HUNTING_CATALOG || []).find(
    (e) => e.id === hubId && (e.kind === "city" || e.kind === "hub")
  );
  return fromCat || null;
}

/** Угодья (farm) каталога для хаба. */
function clanHuntingFarmsForHub(hubId) {
  return (CLAN_HUNTING_CATALOG || []).filter(
    (e) => e.kind === "farm" && e.hubId === hubId
  );
}

/**
 * Дерево для игры: только хабы с live-территориями.
 * { hub, cityTerritory|null, farms: [{ territory|null, catalog|null, live }] }
 */
function clanGroundsTreeForGame() {
  const live = typeof CLAN_TERRITORIES !== "undefined" ? CLAN_TERRITORIES : [];
  const cities = live.filter((t) => t.kind === "city");
  const hubIds = new Set();
  cities.forEach((c) => hubIds.add(c.id));
  live.forEach((t) => {
    if (t.kind === "farm" && t.hubId) hubIds.add(t.hubId);
  });

  return Array.from(hubIds)
    .map((hubId) => {
      const cityTerritory = live.find((t) => t.id === hubId && t.kind === "city") || null;
      const hubMeta = clanHuntingHubById(hubId);
      const liveFarms = live.filter((t) => t.kind === "farm" && t.hubId === hubId);
      const liveFarmIds = new Set(liveFarms.map((t) => t.id));
      const catalogFarms = clanHuntingFarmsForHub(hubId);
      const farms = [];
      liveFarms.forEach((t) => {
        farms.push({
          id: t.id,
          labelRu: t.labelRu,
          labelL2: t.labelL2,
          farmZoneId: t.farmZoneId,
          capturable: !!t.capturable,
          siegeEnabled: !!t.siegeEnabled,
          holderBonus: t.holderBonus,
          rentPerDay: t.rentPerDay,
          portrait: t.portrait,
          live: true,
          territory: t,
          status: "live",
        });
      });
      catalogFarms.forEach((c) => {
        if (liveFarmIds.has(c.id)) return;
        farms.push({
          id: c.id,
          labelRu: c.labelRu,
          labelL2: c.labelL2,
          farmZoneId: c.farmZoneId,
          capturable: !!c.capturable,
          siegeEnabled: !!c.siegeEnabled,
          holderBonus: null,
          rentPerDay: 0,
          portrait: null,
          live: false,
          territory: null,
          status: c.status || "planned",
        });
      });
      farms.sort((a, b) => {
        if (a.live !== b.live) return a.live ? -1 : 1;
        if (a.siegeEnabled !== b.siegeEnabled) return a.siegeEnabled ? -1 : 1;
        return String(a.labelRu).localeCompare(String(b.labelRu), "ru");
      });
      return {
        hubId,
        labelRu: cityTerritory?.labelRu || hubMeta?.labelRu || hubId,
        labelL2: cityTerritory?.labelL2 || hubMeta?.labelL2 || "",
        cityTerritory,
        farms,
      };
    })
    .filter((h) => h.cityTerritory || h.farms.some((f) => f.live))
    .sort((a, b) => String(a.labelRu).localeCompare(String(b.labelRu), "ru"));
}

/**
 * Полный стек охотничьих угодий для меню Фарм: все хабы с фермами из каталога.
 * (clanGroundsTreeForGame — только live-территории клана.)
 */
function farmHubTreeForMenu() {
  const hubs = [];
  const raceFarms = clanHuntingFarmsForHub("race");
  if (raceFarms.length) {
    hubs.push({
      hubId: "race",
      labelRu: "Стартовые деревни",
      labelL2: "Race villages",
      tier: 0,
      farms: raceFarms.slice(),
    });
  }
  (CLAN_HUNTING_HUBS || []).forEach((h) => {
    const farms = clanHuntingFarmsForHub(h.id);
    if (!farms.length) return;
    hubs.push({
      hubId: h.id,
      labelRu: h.labelRu,
      labelL2: h.labelL2 || "",
      tier: Number(h.tier) || 0,
      farms: farms.slice(),
    });
  });
  hubs.forEach((h) => {
    h.farms.sort((a, b) => {
      const rank = (s) => (s === "live" ? 0 : s === "draft" ? 1 : 2);
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      return String(a.labelRu || "").localeCompare(String(b.labelRu || ""), "ru");
    });
  });
  hubs.sort(
    (a, b) => a.tier - b.tier || String(a.labelRu).localeCompare(String(b.labelRu), "ru")
  );
  return hubs;
}

/** Пины для устаревшей разметки карты (если страница ещё открыта). */
function clanHuntingCatalogMarkupPins() {
  const liveIds = new Set(
    (typeof CLAN_TERRITORIES !== "undefined" ? CLAN_TERRITORIES : []).map((t) => t.id)
  );
  return (CLAN_HUNTING_CATALOG || [])
    .filter((e) => e.kind === "farm" || e.kind === "city" || e.kind === "hub")
    .filter((e) => !liveIds.has(e.id))
    .map((e) => {
      const pin = {
        id: e.id,
        kind: e.kind === "hub" ? "city" : e.kind,
        labelRu: e.labelRu,
        labelL2: e.labelL2 || e.labelRu,
        farmZoneId: e.farmZoneId || null,
        hubId: e.hubId || null,
        hitR: e.kind === "city" || e.kind === "hub" ? 3.2 : 2.8,
        capturable: !!e.capturable,
        siegeEnabled: !!e.siegeEnabled,
        holderBonus: null,
        rentPerDay: 0,
        portrait: null,
        _catalog: true,
        _status: e.status || "planned",
      };
      if (e.x != null && e.y != null) {
        pin.x = e.x;
        pin.y = e.y;
        if (typeof CLAN_MAP_CRS !== "undefined") {
          const crs = CLAN_MAP_CRS;
          pin.worldX = Math.round(crs.minX + (e.x / 100) * (crs.maxX - crs.minX));
          pin.worldY = Math.round(crs.minY + (e.y / 100) * (crs.maxY - crs.minY));
        }
      } else {
        pin.x = null;
        pin.y = null;
        pin.worldX = null;
        pin.worldY = null;
        pin._needsPlace = true;
      }
      return pin;
    });
}
