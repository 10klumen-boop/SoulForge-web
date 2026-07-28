// ===== Clan territories + L2BaseMap CRS (F0) =====

const CLAN_TERRITORY_HOLD_MAX = { farm: 2, city: 1 };

/** L2BaseMap overlay CRS (1812×2620). Source: L2jBrasil/L2BaseMap. */
const CLAN_MAP_CRS = {
  mapW: 1812,
  mapH: 2620,
  minX: -131072,
  maxX: 229376,
  minY: -262144,
  maxY: 262144,
  /** Ship art (IL.webp CRS-compatible). */
  overviewSrc: "assets/maps/aden-overview.webp?v=1",
};

function clanMapWorldToPct(worldX, worldY) {
  const crs = CLAN_MAP_CRS;
  const xSpan = crs.maxX - crs.minX;
  const ySpan = crs.maxY - crs.minY;
  const x = ((Number(worldX) - crs.minX) / xSpan) * 100;
  const y = ((Number(worldY) - crs.minY) / ySpan) * 100;
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

function clanMapApplyCrs(t) {
  if (!t || t.worldX == null || t.worldY == null) return t;
  const p = clanMapWorldToPct(t.worldX, t.worldY);
  t.x = p.x;
  t.y = p.y;
  return t;
}

const CLAN_TERRITORIES = [
  {
    id: "blazing_swamp",
    kind: "farm",
    labelRu: "Пылающее болото",
    labelL2: "Blazing Swamp",
    farmZoneId: "blazing_swamp",
    hubId: "aden",
    worldX: -17728,
    worldY: 118726,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_18",
    holderBonus: { adenaPct: 6 },
    rentPerDay: 80000,
    portrait: "assets/locations/blazing-swamp.jpg",
  },
  {
    id: "school_of_dark_arts",
    kind: "farm",
    labelRu: "Школа тёмных искусств",
    labelL2: "School of Dark Arts",
    farmZoneId: "school_of_dark_arts",
    hubId: "dark_elven_village",
    worldX: 28246,
    worldY: 11010,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_20",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 35500,
    portrait: "assets/locations/school-of-dark-arts.jpg",
  },
  {
    id: "ant_nest",
    kind: "farm",
    labelRu: "Муравейник",
    labelL2: "The Ant Nest",
    farmZoneId: "ant_nest",
    hubId: "dion",
    worldX: 32932,
    worldY: 149422,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_18",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 60000,
    portrait: "assets/locations/ant-nest.jpg",
  },
  {
    id: "bee_hive",
    kind: "farm",
    labelRu: "Улей",
    labelL2: "Bee Hive",
    farmZoneId: "bee_hive",
    hubId: "dion",
    worldX: 16033,
    worldY: 145562,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_20",
    holderBonus: { adenaPct: 3 },
    rentPerDay: 50500,
    portrait: "assets/locations/bee-hive.jpg",
  },
  {
    id: "cruma_marshlands",
    kind: "farm",
    labelRu: "Болота Крумы",
    labelL2: "Cruma Marshlands",
    farmZoneId: "cruma_marshlands",
    hubId: "dion",
    worldX: 17833,
    worldY: 147762,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_16",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 60000,
    portrait: "assets/locations/cruma-marsh.jpg",
  },
  {
    id: "cruma_tower_entrance",
    kind: "farm",
    labelRu: "Башня Крумы (вход)",
    labelL2: "Cruma Tower",
    farmZoneId: "cruma_tower_entrance",
    hubId: "dion",
    worldX: 19633,
    worldY: 138962,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_16",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 64000,
    portrait: "assets/locations/cruma-tower.jpg",
  },
  {
    id: "dion_hills",
    kind: "farm",
    labelRu: "Холмы Диона",
    labelL2: "Dion Hills",
    farmZoneId: "dion_hills",
    hubId: "dion",
    worldX: 21433,
    worldY: 141162,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_18",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 47500,
    portrait: "assets/locations/dion-hills.jpg",
  },
  {
    id: "execution_grounds",
    kind: "farm",
    labelRu: "Поле казни",
    labelL2: "Execution Grounds",
    farmZoneId: "execution_grounds",
    hubId: "dion",
    worldX: 50568,
    worldY: 152208,
    hitR: 2.8,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_18",
    holderBonus: { adenaPct: 5 },
    rentPerDay: 65000,
    portrait: "assets/locations/execution-grounds.jpg",
  },
  {
    id: "floran_agricultural",
    kind: "farm",
    labelRu: "Флоранские поля",
    labelL2: "Floran Agricultural Area",
    farmZoneId: "floran_agricultural",
    hubId: "dion",
    worldX: 12433,
    worldY: 145562,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_18",
    holderBonus: { adenaPct: 3 },
    rentPerDay: 57500,
    portrait: "assets/locations/floran.jpg",
  },
  {
    id: "partisans_hideaway",
    kind: "farm",
    labelRu: "Укрытие партизан",
    labelL2: "Partisans Hideaway",
    farmZoneId: "partisans_hideaway",
    hubId: "dion",
    worldX: 14233,
    worldY: 147762,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_20",
    holderBonus: { adenaPct: 3 },
    rentPerDay: 53500,
    portrait: "assets/locations/partisans.jpg",
  },
  {
    id: "plains_of_dion",
    kind: "farm",
    labelRu: "Равнины Диона",
    labelL2: "Plains of Dion",
    farmZoneId: "plains_of_dion",
    hubId: "dion",
    worldX: 16033,
    worldY: 138962,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_16",
    holderBonus: { adenaPct: 3 },
    rentPerDay: 51500,
    portrait: "assets/locations/plains-dion.jpg",
  },
  {
    id: "abandoned_coal_low",
    kind: "farm",
    labelRu: "Угольные шахты",
    labelL2: "Abandoned Coal Mines",
    farmZoneId: "abandoned_coal_low",
    hubId: "dwarven_village",
    worldX: 152601,
    worldY: -174588,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_16",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 40000,
    portrait: "assets/locations/abandoned-coal-mines.jpg",
  },
  {
    id: "elven_ruins_hunt",
    kind: "farm",
    labelRu: "Руины эльфов (охота)",
    labelL2: "Elven Ruins",
    farmZoneId: "elven_ruins_hunt",
    hubId: "elven_village",
    worldX: 29327,
    worldY: 74973,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_18",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 37000,
    portrait: "assets/locations/elven-ruins-hunt.jpg",
  },
  {
    id: "breka_stronghold",
    kind: "farm",
    labelRu: "Крепость Брека",
    labelL2: "Breka's Stronghold",
    farmZoneId: "breka_stronghold",
    hubId: "giran",
    worldX: -6928,
    worldY: 125326,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_20",
    holderBonus: { adenaPct: 3 },
    rentPerDay: 58500,
    portrait: "assets/locations/breka.jpg",
  },
  {
    id: "death_pass",
    kind: "farm",
    labelRu: "Ущелье смерти",
    labelL2: "Death Pass",
    farmZoneId: "death_pass",
    hubId: "giran",
    worldX: -17728,
    worldY: 127526,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_18",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 60000,
    portrait: "assets/locations/death-pass.jpg",
  },
  {
    id: "dragon_valley_entrance",
    kind: "farm",
    labelRu: "Долина драконов (вход)",
    labelL2: "Dragon Valley",
    farmZoneId: "dragon_valley_entrance",
    hubId: "giran",
    worldX: -15928,
    worldY: 118726,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_20",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 67500,
    portrait: "assets/locations/dragon-valley.jpg",
  },
  {
    id: "gorgon_flower_garden",
    kind: "farm",
    labelRu: "Сад горгон",
    labelL2: "Gorgon Flower Garden",
    farmZoneId: "gorgon_flower_garden",
    hubId: "giran",
    worldX: -14128,
    worldY: 120926,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_16",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 60000,
    portrait: "assets/locations/gorgon-garden.jpg",
  },
  {
    id: "fellmere_harvesting",
    kind: "farm",
    labelRu: "Жатва Феллмер",
    labelL2: "Fellmere Harvesting Grounds",
    farmZoneId: "fellmere_harvesting",
    hubId: "gludin",
    worldX: -80570,
    worldY: 150346,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_16",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 45000,
    portrait: "assets/locations/fellmere.jpg",
  },
  {
    id: "windmill_hill",
    kind: "farm",
    labelRu: "Ветряной холм",
    labelL2: "Windmill Hill",
    farmZoneId: "windmill_hill",
    hubId: "gludin",
    worldX: -78770,
    worldY: 152546,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_18",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 45000,
    portrait: "assets/locations/windmill-hill.jpg",
  },
  {
    id: "abandoned_camp",
    kind: "farm",
    labelRu: "Заброшенный лагерь",
    labelL2: "Abandoned Camp",
    farmZoneId: "abandoned_camp",
    hubId: "gludio",
    worldX: -30147,
    worldY: 115343,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_20",
    holderBonus: { adenaPct: 3 },
    rentPerDay: 45000,
    portrait: "assets/locations/abandoned-camp.jpg",
  },
  {
    id: "evil_hunting_grounds",
    kind: "farm",
    labelRu: "Злые охотничьи угодья",
    labelL2: "Evil Hunting Grounds",
    farmZoneId: "evil_hunting_grounds",
    hubId: "gludio",
    worldX: -6928,
    worldY: 118726,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_18",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 50000,
    portrait: "assets/locations/evil-grounds.jpg",
  },
  {
    id: "langk_lizardman",
    kind: "farm",
    labelRu: "Жилище ящеров Лангк",
    labelL2: "Langk Lizardman Dwelling",
    farmZoneId: "langk_lizardman",
    hubId: "gludio",
    worldX: -17728,
    worldY: 120926,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_20",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 50000,
    portrait: "assets/locations/langk.jpg",
  },
  {
    id: "maille_lizardman",
    kind: "farm",
    labelRu: "Казарма ящеров Мейл",
    labelL2: "Maille Lizardman Barracks",
    farmZoneId: "maille_lizardman",
    hubId: "gludio",
    worldX: -15928,
    worldY: 123126,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_16",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 50000,
    portrait: "assets/locations/maille.jpg",
  },
  {
    id: "neutral_zone",
    kind: "farm",
    labelRu: "Нейтральная зона",
    labelL2: "Neutral Zone",
    farmZoneId: "neutral_zone",
    hubId: "gludio",
    worldX: 13107,
    worldY: 62915,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_16",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 45000,
    portrait: "assets/locations/neutral-zone.jpg",
  },
  {
    id: "orc_barracks_hunt",
    kind: "farm",
    labelRu: "Казарма орков",
    labelL2: "Orc Barracks",
    farmZoneId: "orc_barracks_hunt",
    hubId: "gludio",
    worldX: -91062,
    worldY: 105906,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_18",
    holderBonus: { adenaPct: 3 },
    rentPerDay: 54500,
    portrait: "assets/locations/orc-barracks-hunt.jpg",
  },
  {
    id: "ruins_agony",
    kind: "farm",
    labelRu: "Руины Агонии",
    labelL2: "Ruins of Agony",
    farmZoneId: "ruins_agony",
    hubId: "gludio",
    worldX: -4915,
    worldY: 110100,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_20",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 55000,
    portrait: "assets/locations/ruins-agony.jpg",
  },
  {
    id: "ruins_despair",
    kind: "farm",
    labelRu: "Руины Отчаяния",
    labelL2: "Ruins of Despair",
    farmZoneId: "ruins_despair",
    hubId: "gludio",
    worldX: -8728,
    worldY: 120926,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_18",
    holderBonus: { adenaPct: 2 },
    rentPerDay: 50000,
    portrait: "assets/locations/ruins-despair.jpg",
  },
  {
    id: "wasteland",
    kind: "farm",
    labelRu: "Пустошь",
    labelL2: "Wasteland",
    farmZoneId: "wasteland",
    hubId: "gludio",
    worldX: -16730,
    worldY: 209800,
    hitR: 2.8,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_18",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 50000,
    portrait: "assets/locations/wasteland.jpg",
  },
  {
    id: "alligator_island",
    kind: "farm",
    labelRu: "Остров аллигаторов",
    labelL2: "Alligator Island",
    farmZoneId: "alligator_island",
    hubId: "heine",
    worldX: -17728,
    worldY: 125326,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_16",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 70000,
    portrait: "assets/locations/alligator-island.jpg",
  },
  {
    id: "enchanted_valley",
    kind: "farm",
    labelRu: "Зачарованная долина",
    labelL2: "Enchanted Valley",
    farmZoneId: "enchanted_valley",
    hubId: "oren",
    worldX: -15928,
    worldY: 127526,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sun_16",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 70000,
    portrait: "assets/locations/enchanted-valley.jpg",
  },
  {
    id: "sea_of_spores",
    kind: "farm",
    labelRu: "Море спор",
    labelL2: "Sea of Spores",
    farmZoneId: "sea_of_spores",
    hubId: "oren",
    worldX: -14128,
    worldY: 118726,
    hitR: 2.6,
    capturable: true,
    siegeEnabled: true,
    siegeSlotUtc: "sat_18",
    holderBonus: { adenaPct: 4 },
    rentPerDay: 70000,
    portrait: "assets/locations/sea-of-spores.jpg",
  },
  {
    id: "gludin",
    kind: "city",
    labelRu: "Глудин",
    labelL2: "Gludin Village",
    farmZoneId: null,
    worldX: -80970,
    worldY: 149946,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/locations/windmill-hill.jpg",
  },
  {
    id: "gludio",
    kind: "city",
    labelRu: "Глудио",
    labelL2: "Town of Gludio",
    farmZoneId: null,
    worldX: -12728,
    worldY: 122726,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/ui/clan-city-gludio.jpg?v=3",
  },
  {
    id: "dion",
    kind: "city",
    labelRu: "Дион",
    labelL2: "Town of Dion",
    farmZoneId: null,
    worldX: 15633,
    worldY: 142962,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/ui/clan-city-dion.jpg?v=3",
  },
  {
    id: "elven_village",
    kind: "city",
    labelRu: "Деревня эльфов",
    labelL2: "Elven Village",
    farmZoneId: null,
    worldX: 46989,
    worldY: 51380,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/locations/elven-village.jpg",
  },
  {
    id: "dark_elven_village",
    kind: "city",
    labelRu: "Деревня тёмных",
    labelL2: "Dark Elven Village",
    farmZoneId: null,
    worldX: 9863,
    worldY: 15729,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/locations/dark-elven-village.jpg",
  },
  {
    id: "dwarven_village",
    kind: "city",
    labelRu: "Деревня гномов",
    labelL2: "Dwarven Village",
    farmZoneId: null,
    worldX: 115114,
    worldY: -178258,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/locations/dwarven-village-legacy.jpg",
  },
  {
    id: "giran",
    kind: "city",
    labelRu: "Гиран",
    labelL2: "Town of Giran",
    farmZoneId: null,
    worldX: -13678,
    worldY: 123126,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/locations/death-pass.jpg",
  },
  {
    id: "oren",
    kind: "city",
    labelRu: "Орен",
    labelL2: "Town of Oren",
    farmZoneId: null,
    worldX: -15028,
    worldY: 123126,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/ui/clan-city-oren.jpg?v=1",
  },
  {
    id: "heine",
    kind: "city",
    labelRu: "Хейн",
    labelL2: "Heine",
    farmZoneId: null,
    worldX: -17728,
    worldY: 125326,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/ui/clan-city-heine.jpg?v=1",
  },
  {
    id: "aden",
    kind: "city",
    labelRu: "Аден",
    labelL2: "Town of Aden",
    farmZoneId: null,
    worldX: -17728,
    worldY: 118726,
    hitR: 3.2,
    capturable: false,
    siegeEnabled: false,
    holderBonus: null,
    rentPerDay: 0,
    portrait: "assets/locations/town-of-aden.jpg",
  }
].map((t) => clanMapApplyCrs(t));

/** Кэш владельцев с сервера (и локальный fallback для тестов). */
let _clanTerritoryHolders = Object.create(null);

function clanTerritoryById(id) {
  return (CLAN_TERRITORIES || []).find((t) => t.id === id) || null;
}

function clanTerritoryByFarmZone(zoneId) {
  const zid = typeof resolveFarmZoneId === "function" ? resolveFarmZoneId(zoneId) : zoneId;
  return (CLAN_TERRITORIES || []).find((t) => t.farmZoneId === zid) || null;
}

function clanTerritoryHolder(territoryId) {
  return _clanTerritoryHolders[territoryId] || null;
}

function setClanTerritoryHolderMock(territoryId, clan) {
  if (!clan) delete _clanTerritoryHolders[territoryId];
  else {
    _clanTerritoryHolders[territoryId] = {
      clanId: String(clan.clanId || clan.id || ""),
      clanName: String(clan.clanName || clan.name || "?"),
    };
    if (!_clanTerritoryHolders[territoryId].clanId) delete _clanTerritoryHolders[territoryId];
  }
}

/** Применить список holders с API. */
function applyClanTerritoryHolders(holders) {
  _clanTerritoryHolders = Object.create(null);
  (holders || []).forEach((h) => {
    if (!h || !h.territoryId || !h.clanId) return;
    _clanTerritoryHolders[h.territoryId] = {
      clanId: String(h.clanId),
      clanName: String(h.clanName || "?"),
      claimedAt: h.claimedAt != null ? Number(h.claimedAt) : null,
      contestCost: h.contestCost != null ? Number(h.contestCost) : null,
      contestBase: h.contestBase != null ? Number(h.contestBase) : null,
      claimCost: h.claimCost != null ? Number(h.claimCost) : null,
      siegeScore: h.siegeScore != null ? Number(h.siegeScore) : 0,
      siegeTier: h.siegeTier != null ? Number(h.siegeTier) : 0,
      siegePowerRu: h.siegePowerRu ? String(h.siegePowerRu) : "",
    };
  });
}

function clanMyClanRef() {
  const c = typeof chatSocial !== "undefined" ? chatSocial?.clan : null;
  if (!c || !c.id) return null;
  return { clanId: String(c.id), clanName: String(c.name || "Клан") };
}

function clanMyHoldings() {
  const me = clanMyClanRef();
  if (!me) return [];
  return (CLAN_TERRITORIES || []).filter((t) => {
    const h = clanTerritoryHolder(t.id);
    return h && h.clanId === me.clanId;
  });
}

function clanHoldingCounts(clanId) {
  const id = String(clanId || "");
  let farm = 0;
  let city = 0;
  (CLAN_TERRITORIES || []).forEach((t) => {
    const h = clanTerritoryHolder(t.id);
    if (!h || h.clanId !== id) return;
    if (t.kind === "city") city += 1;
    else farm += 1;
  });
  return { farm, city };
}

function clanTerritoryStatusForZone(zoneId) {
  const t = clanTerritoryByFarmZone(zoneId);
  if (!t) {
    return {
      territory: null,
      capturable: false,
      siegeEnabled: false,
      holder: null,
      isMyClan: false,
      bonusPct: 0,
      holderBonusPct: 0,
      lineShort: "",
      lineMeta: "",
    };
  }
  const holder = clanTerritoryHolder(t.id);
  const me = clanMyClanRef();
  const isMyClan = !!(holder && me && holder.clanId === me.clanId);
  const holderBonusPct = Math.max(0, Number(t.holderBonus?.adenaPct) || 0);
  const bonusPct = t.siegeEnabled && isMyClan ? holderBonusPct : 0;
  let lineShort = "";
  let lineMeta = "";
  if (!t.capturable) {
    lineShort = "";
  } else if (!holder) {
    lineShort = "нейтрал";
    lineMeta = t.siegeEnabled
      ? "Спорная · нейтрал · holder +" + holderBonusPct + "% online"
      : "Нейтрал";
  } else if (isMyClan) {
    lineShort = "ваш +" + bonusPct + "%";
    lineMeta =
      "Клан «" +
      holder.clanName +
      "»" +
      (bonusPct ? " · +" + bonusPct + "% adena online" : "");
  } else {
    lineShort = holder.clanName;
    lineMeta = "Владеет «" + holder.clanName + "»";
  }
  return {
    territory: t,
    capturable: !!t.capturable,
    siegeEnabled: !!t.siegeEnabled,
    holder,
    isMyClan,
    bonusPct,
    holderBonusPct,
    lineShort,
    lineMeta,
  };
}

function clanTerritoryAdenaBonusPct(zoneId) {
  return clanTerritoryStatusForZone(zoneId).bonusPct;
}

/** Цена отбития чужого узла (база; сервер умножает на силу осады владельца). */
function clanTerritoryContestCost(tOrMeta, holder) {
  const rent = Math.max(0, Math.floor(Number(tOrMeta?.rentPerDay) || 0));
  const base = Math.max(10_000_000, rent * 200);
  if (holder && holder.contestCost != null) return Math.floor(Number(holder.contestCost) || base);
  const mult =
    holder && holder.siegeTier != null
      ? [1, 1.75, 3, 5][Math.min(3, Math.max(0, Number(holder.siegeTier) || 0))]
      : 1;
  return Math.floor(base * mult);
}

function clanTerritoryClaimCost(tOrMeta) {
  const rent = Math.max(0, Math.floor(Number(tOrMeta?.rentPerDay) || 0));
  return Math.max(5_000_000, rent * 100);
}

/** Локальный claim (тесты / offline). В UI — через clanClaimTerritory API. */
function claimClanTerritoryMock(territoryId) {
  const t = clanTerritoryById(territoryId);
  if (!t || !t.capturable) {
    return { ok: false, error: "zone", message: "Зона не захватывается" };
  }
  if (!t.siegeEnabled) {
    return {
      ok: false,
      error: "siege_off",
      message:
        t.kind === "city"
          ? "Города — хабы без захвата"
          : "Осада этой зоны ещё не включена",
    };
  }
  const me = clanMyClanRef();
  if (!me) return { ok: false, error: "clan", message: "Нужен клан" };
  const role = typeof clanMyRole === "function" ? clanMyRole() : null;
  if (role !== "leader" && role !== "officer") {
    return { ok: false, error: "role", message: "Заявляет лидер или офицер" };
  }
  const cur = clanTerritoryHolder(t.id);
  if (cur && cur.clanId === me.clanId) {
    return { ok: true, message: "Уже ваш узел" };
  }
  if (cur && cur.clanId !== me.clanId) {
    return {
      ok: false,
      error: "held",
      message:
        "Занято «" + cur.clanName + "» — отбейте кнопкой «Отбить узел» (адена со склада)",
    };
  }
  const counts = clanHoldingCounts(me.clanId);
  if (t.kind === "city") {
    if (counts.city >= CLAN_TERRITORY_HOLD_MAX.city) {
      return { ok: false, error: "cap", message: "Лимит: 1 город" };
    }
  } else if (counts.farm >= CLAN_TERRITORY_HOLD_MAX.farm) {
    return { ok: false, error: "cap", message: "Лимит: 2 farm-узла" };
  }
  setClanTerritoryHolderMock(t.id, me);
  return { ok: true, message: "Заявлено: " + t.labelRu };
}

function releaseClanTerritoryMock(territoryId) {
  const t = clanTerritoryById(territoryId);
  if (!t) return { ok: false, error: "zone", message: "Нет зоны" };
  const me = clanMyClanRef();
  if (!me) return { ok: false, error: "clan", message: "Нужен клан" };
  const role = typeof clanMyRole === "function" ? clanMyRole() : null;
  if (role !== "leader" && role !== "officer") {
    return { ok: false, error: "role", message: "Снимает лидер или офицер" };
  }
  const cur = clanTerritoryHolder(t.id);
  if (!cur || cur.clanId !== me.clanId) {
    return { ok: false, error: "not_yours", message: "Узел не ваш" };
  }
  setClanTerritoryHolderMock(t.id, null);
  return { ok: true, message: "Снято: " + t.labelRu };
}

function clanPinAccent(clanName) {
  const s = String(clanName || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = [28, 42, 18, 8, 52, 72, 12, 35];
  const hue = palette[h % palette.length];
  return "hsl(" + hue + " 55% 42%)";
}
