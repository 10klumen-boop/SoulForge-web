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
  "monster-eye": "Глаз Монстра",
  "vampire-bat": "Вампирская летучая мышь",
  "stone-giant": "Каменный великан",
  "giant-spider": "Гигантский паук",
  "poison-spider": "Ядовитый паук",
  "tunath-orc-marksman": "Орк-лучник Тунат",
  "tunath-orc-warrior": "Орк-воин Тунат",
  "silent-horror": "Безмолвный ужас",
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
};

/** Cache-bust — менять после замены assets/locations|mobs */
const MINE_ASSET_VER = 11;
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
  if (/spider|wolf|keltir|werewolf|bat|wererat|salamander|eye/.test(slug)) return "prowl";
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

const L2_ENEMY = {
  /** Говорящий остров — северная тропа, мародёры */
  tiCoast: mobPool(["tunath-orc-warrior", "tunath-orc-marksman", "giant-spider", "young-keltir"]),
  tiCoastElite: mobPool(["relic-werewolf", "tunath-orc-warrior"], "target-elite"),

  /** Эльфийский лес — гоблины у Древа */
  elfForest: mobPool(["goblin", "lirein", "goblin-grave-robber"]),
  elfForestElite: mobPool(["goblin-grave-robber", "lirein"], "target-elite"),

  /** Тёмный лес — твари чащи */
  darkWood: mobPool(["vampire-bat", "dre-vanul", "poison-spider"]),
  darkWoodElite: mobPool(["dre-vanul", "vampire-bat"], "target-shadow target-elite"),

  /** Плато орков — испытание Кекая */
  orcPlateau: mobPool(["goblin-grave-robber", "kasha-wolf", "prarie-keltir", "young-keltir"]),
  orcPlateauElite: mobPool(["kasha-wolf", "prarie-keltir"], "target-elite"),

  /** Жилы гномов — расхитители */
  dwarfMines: mobPool(["goblin-grave-robber", "wererat", "stone-giant"]),
  dwarfMinesElite: mobPool(["stone-giant", "wererat"], "target-elite"),

  /** Эльфийские руины (остров / граница) */
  elvenRuins: mobPool(["silent-horror", "skeleton", "misy-skeleton", "wererat"]),
  elvenRuinsElite: mobPool(["silent-horror", "dre-vanul"], "target-spirit target-elite"),

  /** Стихии у руин / крепости */
  elemental: mobPool(["salamander", "undine", "monster-eye"]),
  elementalElite: mobPool(["salamander", "undine"], "target-spirit target-elite"),

  /** Разведчики / мародёры в руинах */
  ruinsLoot: mobPool(["skeleton-archer", "wererat", "stone-giant"]),
  ruinsLootElite: mobPool(["relic-werewolf", "stone-giant"], "target-elite"),

  /** Орки у опушки / лагерь */
  orcBorder: mobPool(["tunath-orc-warrior", "tunath-orc-marksman", "goblin"]),
  orcBorderElite: mobPool(["tunath-orc-warrior", "tunath-orc-marksman"], "target-elite"),

  /** Эльфийские стражи (лес для орка) */
  elfSentinels: mobPool(["lirein", "skeleton-archer", "giant-spider"]),
  elfSentinelsElite: mobPool(["lirein", "skeleton-archer"], "target-elite"),

  /** Тьма / споры / охота Шилен */
  shadowHunt: mobPool(["dre-vanul", "vampire-bat", "silent-horror", "poison-spider"]),
  shadowHuntElite: mobPool(["silent-horror", "dre-vanul"], "target-shadow target-elite"),

  /** Контрабанда / курьеры у башни */
  towerCouriers: mobPool(["tunath-orc-marksman", "wererat", "goblin-grave-robber"]),
  towerCouriersElite: mobPool(["relic-werewolf", "dre-vanul"], "target-elite"),
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
      normal: L2_ENEMY.elvenRuins,
      golden: L2_ENEMY.elvenRuinsElite,
    },
    elf: {
      location: "elven-fortress",
      bgs: l2Bg("elven-fortress", "elven-village"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.elemental,
      golden: L2_ENEMY.elementalElite,
    },
    dark_elf: {
      location: "elven-ruins",
      bgs: l2Bg("elven-ruins", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.ruinsLoot,
      golden: L2_ENEMY.ruinsLootElite,
    },
    orc: {
      location: "elven-ruins",
      bgs: l2Bg("elven-ruins"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.ruinsLoot,
      golden: L2_ENEMY.ruinsLootElite,
    },
    dwarf: {
      location: "elven-ruins",
      bgs: l2Bg("elven-ruins", "abandoned-coal-mines"),
      bgCover: true,
      targetTheme: "ruins",
      normal: L2_ENEMY.dwarfMines,
      golden: L2_ENEMY.dwarfMinesElite,
    },
  },
  orc_barracks: {
    human: {
      location: "elven-village",
      bgs: l2Bg("elven-village", "sea-of-spores"),
      bgCover: true,
      targetTheme: "forest",
      normal: L2_ENEMY.orcBorder,
      golden: L2_ENEMY.orcBorderElite,
    },
    elf: {
      location: "elven-village",
      bgs: l2Bg("elven-village", "sea-of-spores"),
      bgCover: true,
      targetTheme: "forest",
      normal: L2_ENEMY.orcBorder,
      golden: L2_ENEMY.orcBorderElite,
    },
    dark_elf: {
      location: "dark-elven-village",
      bgs: l2Bg("dark-elven-village", "school-of-dark-arts"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.orcBorder,
      golden: L2_ENEMY.orcBorderElite,
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
      normal: L2_ENEMY.dwarfMines,
      golden: L2_ENEMY.dwarfMinesElite,
    },
  },
  dark_cavern: {
    human: {
      location: "school-of-dark-arts",
      bgs: l2Bg("school-of-dark-arts", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.shadowHunt,
      golden: L2_ENEMY.shadowHuntElite,
    },
    elf: {
      location: "sea-of-spores",
      bgs: l2Bg("sea-of-spores", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: mobPool(["poison-spider", "giant-spider", "vampire-bat"]),
      golden: mobPool(["poison-spider", "dre-vanul"], "target-elite"),
    },
    dark_elf: {
      location: "school-of-dark-arts",
      bgs: l2Bg("school-of-dark-arts", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.shadowHunt,
      golden: L2_ENEMY.shadowHuntElite,
    },
    orc: {
      location: "dark-elven-village",
      bgs: l2Bg("dark-elven-village", "school-of-dark-arts"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.shadowHunt,
      golden: L2_ENEMY.shadowHuntElite,
    },
    dwarf: {
      location: "abandoned-coal-mines",
      bgs: l2Bg("abandoned-coal-mines", "dark-elven-village"),
      bgCover: true,
      targetTheme: "dark",
      normal: L2_ENEMY.dwarfMines,
      golden: L2_ENEMY.dwarfMinesElite,
    },
  },
  dwarven_depths: {
    human: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower", "town-of-aden"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerCouriers,
      golden: L2_ENEMY.towerCouriersElite,
    },
    elf: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerCouriers,
      golden: L2_ENEMY.towerCouriersElite,
    },
    dark_elf: {
      location: "ivory-tower",
      bgs: l2Bg("ivory-tower", "school-of-dark-arts"),
      bgCover: true,
      targetTheme: "tower",
      normal: L2_ENEMY.towerCouriers,
      golden: L2_ENEMY.towerCouriersElite,
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
      normal: L2_ENEMY.towerCouriers,
      golden: L2_ENEMY.towerCouriersElite,
    },
  },
};

const MINE_DWARF_FALLBACK = {
  normal: [
    mob("goblin-grave-robber"),
    mob("wererat"),
  ],
  golden: [
    mob("relic-werewolf", "target-elite"),
    mob("stone-giant", "target-elite"),
  ],
};

function mineStageVisual(zoneId, race) {
  zoneId = zoneId || (typeof currentMineZoneId === "function" ? currentMineZoneId() : state.farmZone) || "banana_mine";
  race = race || (typeof currentAvatarRace === "function" ? currentAvatarRace() : state.avatar?.raceId) || "human";
  const pack = MINE_STAGE_VISUALS[zoneId]?.[race] || MINE_STAGE_VISUALS[zoneId]?.human;
  if (!pack) {
    return {
      bgs: MINE_FALLBACK_BG,
      bgCover: false,
      targetTheme: "",
      location: "",
      locationLabel: "",
      normal: MINE_DWARF_FALLBACK.normal,
      golden: MINE_DWARF_FALLBACK.golden,
    };
  }
  return {
    ...pack,
    locationLabel: L2_LOC_NAMES[pack.location] || pack.location || "",
  };
}

function mineTargetPool(type, zoneId) {
  const vis = mineStageVisual(zoneId);
  const pool = type === "golden" ? vis.golden : vis.normal;
  return pool?.length ? pool : MINE_DWARF_FALLBACK[type === "golden" ? "golden" : "normal"];
}

function pickMineTargetSprite(type, zoneId) {
  zoneId = zoneId || (typeof currentMineZoneId === "function" ? currentMineZoneId() : state.farmZone) || "banana_mine";
  if (type === "boss") {
    const def = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : null;
    if (def?.mob) return mob(def.mob, "target-elite target-boss");
  }
  const pool = mineTargetPool(type, zoneId);
  if (!pool?.length) return MINE_DWARF_FALLBACK[type === "golden" ? "golden" : "normal"][0];
  if (pool.length === 1) return pool[0];
  const key = zoneId + ":" + type;
  let idx;
  const last = _mineSpritePick[key];
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (idx === last);
  _mineSpritePick[key] = idx;
  return pool[idx];
}

function applyMineStageVisual(cfg, zoneId) {
  const vis = mineStageVisual(zoneId);
  const inner = document.getElementById("mineStageInner");
  const bgImg = document.getElementById("mineBgImg");
  if (inner) {
    let cls = "mine-stage-inner";
    if (cfg?.overlay) cls += " " + cfg.overlay;
    if (vis.targetTheme) cls += " mine-theme-" + vis.targetTheme;
    if (vis.bgCover) cls += " mine-stage-fill";
    inner.className = cls;
    if (vis.locationLabel) inner.dataset.l2Location = vis.locationLabel;
    else delete inner.dataset.l2Location;
  }
  if (bgImg) {
    bgImg.classList.toggle("mine-bg-cover", !!vis.bgCover);
  }
}

function mergeMineVisualConfig(zoneId, mine) {
  mine = mine || {};
  const vis = mineStageVisual(zoneId);
  const raw = vis.bgs?.length ? vis.bgs : mine.bgs;
  const bgs = raw?.length ? raw.map(mineAssetUrl) : MINE_FALLBACK_BG;
  return {
    ...mine,
    bgs,
    bgCover: vis.bgCover,
    targetTheme: vis.targetTheme,
    locationLabel: vis.locationLabel,
  };
}
