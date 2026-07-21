// ===== Фарм: runtime визуальные helpers (подбор спрайтов, применение фона) =====
// Данные (L2_MOB_NAMES, L2_LOC_NAMES, MINE_STAGE_VISUALS, L2_ENEMY, MINE_DWARF_FALLBACK)
// и pure builders (mob, mobPool, l2Bg, mineAssetUrl) вынесены в data/mine-visuals-data.js.


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
