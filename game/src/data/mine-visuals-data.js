// ===== Данные: визуальные ассеты мобов и локаций фарма =====
// Вынесено из 26-mine-visuals.js; runtime helpers и pick-логика остались в 26-mine-visuals.js.

// ===== Prelude: фоны и мобы по каноничным локациям L2 =====
// Ассеты: assets/locations/, assets/mobs/ (манифест: archive/game-assets/l2-mine-catalog.json)
// Источники: L2Hub, legacy-lineage2.com, linedia.ru — tools/fetch-l2-mine-catalog.ps1

/** @typedef {{ src: string, kind?: 'icon'|'portrait'|'sprite', anim?: string, cls?: string, label?: string }} MineTargetSprite */

const L2_MOB_NAMES = {
  goblin: "Гоблин",
  "goblin-grave-robber": "Гоблин-грабитель могил",
  wererat: "Обращённая крыса",
  skeleton: "Скелет",
  "skeleton-archer": "Скелет-лучник",
  "misy-skeleton": "Скелет Миси",
  salamander: "Саламандра",
  undine: "Ундина",
  "kasha-wolf": "Волк Каша",
  "prarie-keltir": "Степной Кельтир",
  "young-keltir": "Молодой Кельтир",
  lirein: "Лирейн",
  "dre-vanul": "Дре Ванул",
  "relic-werewolf": "Реликтовый оборотень",
  werewolf: "Оборотень",
  "monster-eye": "Глаз Монстра",
  "vampire-bat": "Вампирская летучая мышь",
  "stone-giant": "Каменный великан",
  "giant-spider": "Гигантский паук",
  "poison-spider": "Ядовитый паук",
  "tunath-orc-marksman": "Орк-лучник Тунат",
  "tunath-orc-warrior": "Орк-воин Тунат",
  "silent-horror": "Безмолвный ужас",
  orc: "Орк",
  gremlin: "Гремлин",
  imp: "Бес",
  grizzly: "Гризли",
  specter: "Призрак",
};

const L2_LOC_NAMES = {
  "talking-island-village": "Деревня Говорящего Острова",
  "talking-island-harbor": "Гавань Говорящего Острова",
  "elven-ruins": "Эльфийские Руины",
  "elven-village": "Деревня Эльфов",
  "elven-fortress": "Эльфийская Крепость",
  "dark-elven-village": "Деревня Тёмных Эльфов",
  "school-of-dark-arts": "Школа Тёмных Искусств",
  "orc-village-legacy": "Деревня Орков · Плато бессмертных",
  "dwarven-village-legacy": "Деревня Гномов",
  "abandoned-coal-mines": "Заброшенные Угольные Шахты",
  "mithril-mines": "Мифриловые Шахты",
  "sea-of-spores": "Море Спор",
  "ivory-tower": "Башня Слоновой Кости",
  "town-of-aden": "Город Аден",
  "scrap-field": "Свалка доспехов",
  "mithril-forge": "Кузница сплавов",
};

/** Cache-bust — менять после замены assets/locations|mobs */
const MINE_ASSET_VER = 14;
const _mineSpritePick = {};

function resetMineSpritePick(zoneId) {
  if (!zoneId) {
    Object.keys(_mineSpritePick).forEach((k) => delete _mineSpritePick[k]);
    return;
  }
  Object.keys(_mineSpritePick).forEach((k) => {
    if (k.startsWith(zoneId + ":")) delete _mineSpritePick[k];
  });
}

function mineAssetUrl(path) {
  if (!path) return path;
  const base = String(path).replace(/\?v=\d+/, "");
  return base + "?v=" + MINE_ASSET_VER;
}

const MINE_FALLBACK_BG = ["assets/mine_bg.png", "assets/mine_bg2.jpg", "assets/mine_bg3.png"].map(mineAssetUrl);

function l2Bg(...slugs) {
  return slugs.map((s) => mineAssetUrl("assets/locations/" + s + ".jpg"));
}

function mobAnimForSlug(slug, cls) {
  if (/target-spirit|target-shadow/.test(cls || "")) return "float";
  if (/specter|imp/.test(slug)) return "float";
  if (/spider|wolf|keltir|werewolf|bat|wererat|salamander|eye|grizzly|gremlin/.test(slug)) return "prowl";
  return "idle";
}

function mob(slug, cls) {
  const c = cls || "";
  return {
    src: mineAssetUrl("assets/mobs/" + slug + ".png"),
    kind: "sprite",
    anim: mobAnimForSlug(slug, c),
    cls: c,
    label: L2_MOB_NAMES[slug] || slug,
  };
}

function mobPool(slugs, cls) {
  return slugs.map((s) => mob(s, cls));
}

/** Пулы по контексту локации — не шарить один набор на полкарты. */
const L2_ENEMY = {
  // —— Гл. I ——
  tiCoast: mobPool(["young-keltir", "giant-spider", "goblin", "orc"]),
  tiCoastElite: mobPool(["relic-werewolf", "orc"], "target-elite"),

  elfForest: mobPool(["goblin", "lirein", "goblin-grave-robber", "gremlin"]),
  elfForestElite: mobPool(["lirein", "goblin-grave-robber"], "target-elite"),

  darkWood: mobPool(["vampire-bat", "dre-vanul", "poison-spider", "imp"]),
  darkWoodElite: mobPool(["dre-vanul", "imp"], "target-shadow target-elite"),

  orcPlateau: mobPool(["kasha-wolf", "prarie-keltir", "young-keltir", "grizzly"]),
  orcPlateauElite: mobPool(["grizzly", "kasha-wolf"], "target-elite"),

  dwarfMines: mobPool(["wererat", "goblin-grave-robber", "gremlin", "stone-giant"]),
  dwarfMinesElite: mobPool(["stone-giant", "wererat"], "target-elite"),

  // —— Гл. II руины ——
  ruinsUndead: mobPool(["silent-horror", "skeleton", "misy-skeleton", "specter"]),
  ruinsUndeadElite: mobPool(["silent-horror", "specter"], "target-spirit target-elite"),

  ruinsElemental: mobPool(["salamander", "undine", "monster-eye", "lirein"]),
  ruinsElementalElite: mobPool(["salamander", "undine"], "target-spirit target-elite"),

  ruinsShadow: mobPool(["skeleton-archer", "dre-vanul", "vampire-bat", "specter"]),
  ruinsShadowElite: mobPool(["dre-vanul", "specter"], "target-shadow target-elite"),

  ruinsRaiders: mobPool(["skeleton", "skeleton-archer", "wererat", "orc"]),
  ruinsRaidersElite: mobPool(["orc", "relic-werewolf"], "target-elite"),

  ruinsCraft: mobPool(["stone-giant", "wererat", "skeleton", "gremlin"]),
  ruinsCraftElite: mobPool(["stone-giant", "gremlin"], "target-elite"),

  // —— Гл. III опушка / лагерь ——
  borderOrcs: mobPool(["tunath-orc-warrior", "tunath-orc-marksman", "orc", "goblin"]),
  borderOrcsElite: mobPool(["tunath-orc-warrior", "orc"], "target-elite"),

  borderSkirmish: mobPool(["orc", "tunath-orc-marksman", "goblin-grave-robber", "giant-spider"]),
  borderSkirmishElite: mobPool(["orc", "tunath-orc-marksman"], "target-elite"),

  borderNight: mobPool(["orc", "dre-vanul", "goblin", "poison-spider"]),
  borderNightElite: mobPool(["dre-vanul", "orc"], "target-shadow target-elite"),

  elfSentinels: mobPool(["lirein", "skeleton-archer", "giant-spider", "goblin"]),
  elfSentinelsElite: mobPool(["lirein", "skeleton-archer"], "target-elite"),

  borderTrade: mobPool(["goblin", "wererat", "gremlin", "tunath-orc-marksman"]),
  borderTradeElite: mobPool(["tunath-orc-marksman", "gremlin"], "target-elite"),

  // —— Гл. IV тьма / споры ——
  shadowCult: mobPool(["dre-vanul", "silent-horror", "vampire-bat", "specter"]),
  shadowCultElite: mobPool(["silent-horror", "dre-vanul"], "target-shadow target-elite"),

  sporeNest: mobPool(["poison-spider", "giant-spider", "vampire-bat", "imp"]),
  sporeNestElite: mobPool(["poison-spider", "imp"], "target-elite"),

  shilenHunt: mobPool(["dre-vanul", "imp", "silent-horror", "werewolf"]),
  shilenHuntElite: mobPool(["werewolf", "dre-vanul"], "target-shadow target-elite"),

  darkChase: mobPool(["dre-vanul", "poison-spider", "kasha-wolf", "specter"]),
  darkChaseElite: mobPool(["dre-vanul", "specter"], "target-elite"),

  darkVein: mobPool(["vampire-bat", "wererat", "stone-giant", "specter"]),
  darkVeinElite: mobPool(["stone-giant", "specter"], "target-elite"),

  // —— Гл. V башня ——
  towerMages: mobPool(["monster-eye", "salamander", "wererat", "specter"]),
  towerMagesElite: mobPool(["monster-eye", "specter"], "target-spirit target-elite"),

  towerSpirits: mobPool(["undine", "monster-eye", "lirein", "specter"]),
  towerSpiritsElite: mobPool(["undine", "specter"], "target-spirit target-elite"),

  towerShadow: mobPool(["dre-vanul", "imp", "monster-eye", "silent-horror"]),
  towerShadowElite: mobPool(["dre-vanul", "imp"], "target-shadow target-elite"),

  towerCouriers: mobPool(["tunath-orc-marksman", "orc", "goblin-grave-robber", "werewolf"]),
  towerCouriersElite: mobPool(["werewolf", "orc"], "target-elite"),

  towerWardens: mobPool(["stone-giant", "wererat", "gremlin", "goblin-grave-robber"]),
  towerWardensElite: mobPool(["stone-giant", "gremlin"], "target-elite"),

  // —— Side: свалка ——
  scrapScavengers: mobPool(["wererat", "goblin-grave-robber", "skeleton-archer", "gremlin"]),
  scrapScavengersElite: mobPool(["gremlin", "relic-werewolf"], "target-elite"),

  scrapForest: mobPool(["goblin", "gremlin", "skeleton", "goblin-grave-robber"]),
  scrapForestElite: mobPool(["goblin-grave-robber", "gremlin"], "target-elite"),

  scrapCursed: mobPool(["wererat", "imp", "skeleton", "vampire-bat"]),
  scrapCursedElite: mobPool(["imp", "specter"], "target-shadow target-elite"),

  scrapRaiders: mobPool(["orc", "goblin", "wererat", "young-keltir"]),
  scrapRaidersElite: mobPool(["orc", "grizzly"], "target-elite"),

  scrapSalvage: mobPool(["gremlin", "stone-giant", "wererat", "goblin-grave-robber"]),
  scrapSalvageElite: mobPool(["stone-giant", "gremlin"], "target-elite"),

  // —— Side: кузница ——
  forgeFire: mobPool(["salamander", "stone-giant", "wererat", "gremlin"]),
  forgeFireElite: mobPool(["salamander", "stone-giant"], "target-elite"),

  forgeSpirit: mobPool(["salamander", "undine", "monster-eye", "lirein"]),
  forgeSpiritElite: mobPool(["salamander", "undine"], "target-spirit target-elite"),

  forgeHex: mobPool(["salamander", "dre-vanul", "imp", "stone-giant"]),
  forgeHexElite: mobPool(["salamander", "imp"], "target-shadow target-elite"),

  forgeWar: mobPool(["salamander", "orc", "stone-giant", "kasha-wolf"]),
  forgeWarElite: mobPool(["salamander", "orc"], "target-elite"),

  forgeAnvil: mobPool(["stone-giant", "salamander", "gremlin", "wererat"]),
  forgeAnvilElite: mobPool(["stone-giant", "salamander"], "target-elite"),
};

const MINE_STAGE_VISUALS = {
  banana_mine: {
    human: {
      location: "talking-island-harbor",
      bgs: l2Bg("talking-island-harbor", "talking-island-village"),
      bgCover: true,
      targetTheme: "coast",
      normal: L2_ENEMY.tiCoast,
      golden: L2_ENEMY.tiCoastElite,
    },
    elf: {
      location: "elven-village",
      bgs: l2Bg("elven-village"),
      bgCover: true,
      targetTheme: "forest",
      normal: L2_ENEMY.elfForest,
      golden: L2_ENEMY.elfForestElite,
    },
    dark_elf: {
      location: "dark-elven-village",
      bgs: l2Bg("dark-elven-village", "school-of-dark-arts"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.darkWood,
      golden: L2_ENEMY.darkWoodElite,
    },
    orc: {
      location: "orc-village-legacy",
      bgs: l2Bg("orc-village-legacy"),
      bgCover: true,
      targetTheme: "plateau",
      normal: L2_ENEMY.orcPlateau,
      golden: L2_ENEMY.orcPlateauElite,
    },
    dwarf: {
      location: "abandoned-coal-mines",
      bgs: l2Bg("abandoned-coal-mines", "mithril-mines", "dwarven-village-legacy"),
      bgCover: true,
      targetTheme: "mine",
      normal: L2_ENEMY.dwarfMines,
      golden: L2_ENEMY.dwarfMinesElite,
    },
  },
  elven_ruins: {
    human: {
      location: "elven-ruins",
      bgs: l2Bg("elven-ruins"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.ruinsUndead,
      golden: L2_ENEMY.ruinsUndeadElite,
    },
    elf: {
      location: "elven-fortress",
      bgs: l2Bg("elven-fortress", "elven-village"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.ruinsElemental,
      golden: L2_ENEMY.ruinsElementalElite,
    },
    dark_elf: {
      location: "elven-ruins",
      bgs: l2Bg("elven-ruins", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.ruinsShadow,
      golden: L2_ENEMY.ruinsShadowElite,
    },
    orc: {
      location: "elven-ruins",
      bgs: l2Bg("elven-ruins"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.ruinsRaiders,
      golden: L2_ENEMY.ruinsRaidersElite,
    },
    dwarf: {
      location: "elven-ruins",
      bgs: l2Bg("elven-ruins", "abandoned-coal-mines"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.ruinsCraft,
      golden: L2_ENEMY.ruinsCraftElite,
    },
  },
  orc_barracks: {
    human: {
      location: "elven-village",
      bgs: l2Bg("elven-village", "sea-of-spores"),
      bgCover: true,
      targetTheme: "forest",
      normal: L2_ENEMY.borderOrcs,
      golden: L2_ENEMY.borderOrcsElite,
    },
    elf: {
      location: "elven-village",
      bgs: l2Bg("elven-village", "sea-of-spores"),
      bgCover: true,
      targetTheme: "forest",
      normal: L2_ENEMY.borderSkirmish,
      golden: L2_ENEMY.borderSkirmishElite,
    },
    dark_elf: {
      location: "dark-elven-village",
      bgs: l2Bg("dark-elven-village", "school-of-dark-arts"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.borderNight,
      golden: L2_ENEMY.borderNightElite,
    },
    orc: {
      location: "elven-village",
      bgs: l2Bg("elven-village"),
      bgCover: true,
      targetTheme: "forest",
      normal: L2_ENEMY.elfSentinels,
      golden: L2_ENEMY.elfSentinelsElite,
    },
    dwarf: {
      location: "elven-village",
      bgs: l2Bg("elven-village"),
      bgCover: true,
      targetTheme: "forest",
      normal: L2_ENEMY.borderTrade,
      golden: L2_ENEMY.borderTradeElite,
    },
  },
  dark_cavern: {
    human: {
      location: "school-of-dark-arts",
      bgs: l2Bg("school-of-dark-arts", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.shadowCult,
      golden: L2_ENEMY.shadowCultElite,
    },
    elf: {
      location: "sea-of-spores",
      bgs: l2Bg("sea-of-spores", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.sporeNest,
      golden: L2_ENEMY.sporeNestElite,
    },
    dark_elf: {
      location: "school-of-dark-arts",
      bgs: l2Bg("school-of-dark-arts", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.shilenHunt,
      golden: L2_ENEMY.shilenHuntElite,
    },
    orc: {
      location: "dark-elven-village",
      bgs: l2Bg("dark-elven-village", "school-of-dark-arts"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.darkChase,
      golden: L2_ENEMY.darkChaseElite,
    },
    dwarf: {
      location: "abandoned-coal-mines",
      bgs: l2Bg("abandoned-coal-mines", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.darkVein,
      golden: L2_ENEMY.darkVeinElite,
    },
  },
  dwarven_depths: {
    human: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower", "town-of-aden"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerMages,
      golden: L2_ENEMY.towerMagesElite,
    },
    elf: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerSpirits,
      golden: L2_ENEMY.towerSpiritsElite,
    },
    dark_elf: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower", "school-of-dark-arts"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerShadow,
      golden: L2_ENEMY.towerShadowElite,
    },
    orc: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower", "orc-village-legacy"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerCouriers,
      golden: L2_ENEMY.towerCouriersElite,
    },
    dwarf: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower", "mithril-mines"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerWardens,
      golden: L2_ENEMY.towerWardensElite,
    },
  },

  scrap_field: {
    human: {
      location: "scrap-field",
      bgs: l2Bg("scrap-field", "scrap-field-2"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.scrapScavengers,
      golden: L2_ENEMY.scrapScavengersElite,
    },
    elf: {
      location: "scrap-field",
      bgs: l2Bg("scrap-field", "scrap-field-2"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.scrapForest,
      golden: L2_ENEMY.scrapForestElite,
    },
    dark_elf: {
      location: "scrap-field",
      bgs: l2Bg("scrap-field", "scrap-field-2"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.scrapCursed,
      golden: L2_ENEMY.scrapCursedElite,
    },
    orc: {
      location: "scrap-field",
      bgs: l2Bg("scrap-field", "scrap-field-2"),
      bgCover: true,
      targetTheme: "plateau",
      normal: L2_ENEMY.scrapRaiders,
      golden: L2_ENEMY.scrapRaidersElite,
    },
    dwarf: {
      location: "scrap-field",
      bgs: l2Bg("scrap-field", "scrap-field-2"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.scrapSalvage,
      golden: L2_ENEMY.scrapSalvageElite,
    },
  },
  mithril_forge: {
    human: {
      location: "mithril-forge",
      bgs: l2Bg("mithril-forge", "mithril-forge-2"),
      bgCover: true,
      targetTheme: "mine",
      normal: L2_ENEMY.forgeFire,
      golden: L2_ENEMY.forgeFireElite,
    },
    elf: {
      location: "mithril-forge",
      bgs: l2Bg("mithril-forge", "mithril-forge-2"),
      bgCover: true,
      targetTheme: "mine",
      normal: L2_ENEMY.forgeSpirit,
      golden: L2_ENEMY.forgeSpiritElite,
    },
    dark_elf: {
      location: "mithril-forge",
      bgs: l2Bg("mithril-forge", "mithril-forge-2"),
      bgCover: true,
      targetTheme: "mine",
      normal: L2_ENEMY.forgeHex,
      golden: L2_ENEMY.forgeHexElite,
    },
    orc: {
      location: "mithril-forge",
      bgs: l2Bg("mithril-forge", "mithril-forge-2"),
      bgCover: true,
      targetTheme: "mine",
      normal: L2_ENEMY.forgeWar,
      golden: L2_ENEMY.forgeWarElite,
    },
    dwarf: {
      location: "mithril-forge",
      bgs: l2Bg("mithril-forge", "mithril-forge-2", "mithril-mines"),
      bgCover: true,
      targetTheme: "mine",
      normal: L2_ENEMY.forgeAnvil,
      golden: L2_ENEMY.forgeAnvilElite,
    },
  },
};

const MINE_DWARF_FALLBACK = {
  normal: [
    mob("goblin-grave-robber"),
    mob("wererat"),
    mob("gremlin"),
  ],
  golden: [
    mob("relic-werewolf", "target-elite"),
    mob("stone-giant", "target-elite"),
  ],
};
