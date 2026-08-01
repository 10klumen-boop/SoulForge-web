// ===== Статы персонажа и фарм-зоны: UI (панель, меню, баннер) =====
// Core logic (selectFarmZone, canEnterFarmZone, avatarMineRewardMult)
// вынесена в avatar-stats-core.js.
// Чистые расчёты (avatarStats, avatarFarmPower, mineMobMaxHp) — в avatar-math.js.

/** null = entry; "story" | "farm" | "worldboss" = список зон / хаб босса */
let menuFarmEntry = null;

function syncMenuHubMode() {
  const screen = document.getElementById("screen-menu");
  if (!screen) return;
  const mode =
    menuFarmEntry === "story" || menuFarmEntry === "farm" || menuFarmEntry === "worldboss"
      ? menuFarmEntry
      : "entry";
  screen.dataset.hubMode = mode;
  const grid = document.getElementById("homeGrid");
  if (grid) grid.dataset.hubMode = mode;
}

/** Полоса фильтра каталога фарма: "all" | "1-20" | "20-30" | "30-40" | "40+" */
let menuFarmLevelBand = null;

const FARM_LEVEL_BANDS = [
  { id: "all", label: "Все" },
  { id: "1-20", label: "до 20" },
  { id: "20-30", label: "20–30" },
  { id: "30-40", label: "30–40" },
  { id: "40+", label: "40+" },
];

function setMenuFarmEntry(mode) {
  const inParty =
    typeof partyMemberCount === "function"
      ? partyMemberCount() > 0
      : !!(typeof getChatParty === "function" && getChatParty());
  if (inParty && (mode === "story" || mode === "farm")) {
    if (typeof toast === "function") {
      toast("В группе — только инстансы (меню «Группа»). Соло История/Фарм недоступны.", "warn");
    }
    if (typeof openPartyScreen === "function") openPartyScreen();
    return;
  }
  if (mode === "party") {
    if (typeof openPartyScreen === "function") openPartyScreen();
    return;
  }
  const next =
    mode === "story" || mode === "farm" || mode === "worldboss" ? mode : null;
  if (next !== "farm") {
    menuFarmLevelBand = null;
  } else if (menuFarmEntry !== "farm") {
    menuFarmLevelBand = defaultFarmLevelBand();
  }
  menuFarmEntry = next;
  if (next === "story" && typeof mentorEmit === "function") mentorEmit("hub_story");
  if (menuFarmEntry === "story" || menuFarmEntry === "farm") {
    const zones =
      menuFarmEntry === "farm"
        ? typeof freeFarmZones === "function"
          ? freeFarmZones()
          : FARM_ZONES.filter((z) => z.side && !z.party)
        : typeof storyFarmZones === "function"
          ? storyFarmZones()
          : FARM_ZONES.filter((z) => !z.side && !z.party);
    const cur = typeof farmZoneById === "function" ? farmZoneById(state.farmZone) : null;
    const ok =
      cur &&
      ((menuFarmEntry === "farm" && cur.side && !cur.party) ||
        (menuFarmEntry === "story" && !cur.side && !cur.party));
    if (!ok) {
      const pick =
        zones.find((z) => typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) ||
        zones.find((z) => z.active) ||
        zones[0];
      if (pick && pick.id !== state.farmZone) {
        if (typeof ProgressStore !== "undefined") ProgressStore.set("farmZone", pick.id);
        else state.farmZone = pick.id;
      }
    }
  }
  syncMenuHubMode();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (menuFarmEntry === "story") {
    const backdrop = document.getElementById("storyBackdrop");
    if (backdrop?.dataset.pendingQuestBriefing && typeof flushPendingQuestBriefing === "function") {
      flushPendingQuestBriefing();
    } else if (typeof maybeShowQuestBriefing === "function") {
      maybeShowQuestBriefing(state.farmZone || "banana_mine", { delay: 280 });
    }
  }
  if (menuFarmEntry === "worldboss" && typeof renderWorldBossHub === "function") {
    renderWorldBossHub();
  }
}

function wireFarmHubEntry() {
  if (typeof UI_HUB_BTN_ICONS !== "undefined") {
    const storyImg = document.querySelector("#farmEntryStory .farm-hub-entry-ico");
    const farmImg = document.querySelector("#farmEntryFarm .farm-hub-entry-ico");
    if (storyImg && UI_HUB_BTN_ICONS.story) storyImg.src = UI_HUB_BTN_ICONS.story;
    if (farmImg && UI_HUB_BTN_ICONS.farm) farmImg.src = UI_HUB_BTN_ICONS.farm;
    const chaptersImg = document.querySelector("#farmStoryArcBtn .farm-story-action-ico");
    const chapterStoryImg = document.querySelector("#farmStoryRead .farm-story-action-ico");
    if (chaptersImg && UI_HUB_BTN_ICONS.chapters) chaptersImg.src = UI_HUB_BTN_ICONS.chapters;
    if (chapterStoryImg && UI_HUB_BTN_ICONS.chapterStory) chapterStoryImg.src = UI_HUB_BTN_ICONS.chapterStory;
    document.querySelectorAll(".mb-go-ico").forEach((img) => {
      if (UI_HUB_BTN_ICONS.play) img.src = UI_HUB_BTN_ICONS.play;
    });
  }
  const entry = document.getElementById("farmHubEntry");
  if (entry && !entry.dataset.wired) {
    entry.dataset.wired = "1";
    entry.querySelectorAll("[data-farm-entry]").forEach((btn) => {
      btn.onclick = () => {
        if (typeof Audio2 !== "undefined") Audio2.click();
        setMenuFarmEntry(btn.dataset.farmEntry);
      };
    });
  }
  const storyBack = document.getElementById("storyFieldBack");
  if (storyBack && !storyBack.dataset.wired) {
    storyBack.dataset.wired = "1";
    storyBack.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setMenuFarmEntry(null);
    };
  }
  const farmBack = document.getElementById("farmFieldBack");
  if (farmBack && !farmBack.dataset.wired) {
    farmBack.dataset.wired = "1";
    farmBack.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setMenuFarmEntry(null);
    };
  }
  const wbBack = document.getElementById("worldBossFieldBack");
  if (wbBack && !wbBack.dataset.wired) {
    wbBack.dataset.wired = "1";
    wbBack.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setMenuFarmEntry(null);
    };
  }
}

function fillFarmZoneList(listEl, zones, opts) {
  opts = opts || {};
  if (!listEl) return;
  if (opts.mode === "farm" && typeof fillFreeFarmCatalog === "function") {
    fillFreeFarmCatalog(listEl);
    return;
  }
  listEl.innerHTML = "";
  const mode = opts.mode || "story";
  if (!zones.length) {
    const empty = document.createElement("p");
    empty.className = "farm-hub-empty";
    empty.textContent =
      mode === "farm" ? "Свободный фарм пока пуст." : "Сюжетные зоны пока недоступны.";
    listEl.appendChild(empty);
    return;
  }
  zones.forEach((zone) => {
    listEl.appendChild(buildFarmZoneChip(zone, mode));
  });
}

function defaultFarmLevelBand() {
  if (!state.avatar?.created) return "all";
  const lvl = Math.max(1, Math.floor(Number(state.avatar.level) || 1));
  // SF level ≈ грубый ориентир к полосам L2
  if (lvl <= 4) return "1-20";
  if (lvl <= 10) return "20-30";
  if (lvl <= 16) return "30-40";
  return "40+";
}

function parseFarmL2Mid(entry, zone) {
  const l2 = entry?.l2Lvl || zone?.l2Lvl || "";
  const m = String(l2).match(/(\d+)\s*[–\-~]\s*(\d+)/);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const one = String(l2).match(/(\d+)\s*\+/);
  if (one) return Number(one[1]) + 5;
  if (zone && zone.lvlMin != null && zone.lvlMax != null) {
    return (Number(zone.lvlMin) + Number(zone.lvlMax)) / 2;
  }
  if (zone && zone.lvlMin != null) return Number(zone.lvlMin);
  const req = Number(zone?.reqLevel) || 0;
  if (req <= 0) return 12;
  if (req <= 4) return 15;
  if (req <= 10) return 25;
  if (req <= 16) return 35;
  return 45;
}

function farmLevelBandId(mid) {
  const n = Number(mid) || 0;
  // mid ровно 20 (напр. L2 15–25) → «до 20», не «20–30»
  if (n <= 20) return "1-20";
  if (n < 30) return "20-30";
  if (n < 40) return "30-40";
  return "40+";
}

function farmCatalogHubLabel(hubId) {
  if (!hubId) return "";
  if (hubId === "race") return "Старт";
  const hub =
    typeof clanHuntingHubById === "function" ? clanHuntingHubById(hubId) : null;
  return (hub && hub.labelRu) || hubId;
}

function collectFarmCatalogEntries() {
  const tree = typeof farmHubTreeForMenu === "function" ? farmHubTreeForMenu() : [];
  const out = [];
  tree.forEach((hub) => {
    (hub.farms || []).forEach((entry) => {
      const resolved = resolveCatalogFarmForMenu(entry);
      const mid = parseFarmL2Mid(entry, resolved.zone);
      out.push({
        entry,
        hub,
        resolved,
        mid,
        band: farmLevelBandId(mid),
      });
    });
  });
  out.sort((a, b) => {
    if (a.resolved.playable !== b.resolved.playable) return a.resolved.playable ? -1 : 1;
    if (a.mid !== b.mid) return a.mid - b.mid;
    return String(a.entry.labelRu || "").localeCompare(String(b.entry.labelRu || ""), "ru");
  });
  return out;
}

/** Каталог угодий: плитки + фильтр по уровню. */
function fillFreeFarmCatalog(listEl) {
  if (!listEl) return;
  hideFarmZoneTip();
  listEl.innerHTML = "";
  listEl.className =
    "farm-zone-list farm-hub-city-grid farm-catalog-zone-grid farm-catalog sf-scroll";
  if (!listEl.dataset.farmTipScrollWired) {
    listEl.dataset.farmTipScrollWired = "1";
    listEl.addEventListener("scroll", hideFarmZoneTip, { passive: true });
  }

  const hint = document.getElementById("farmHubCityHint");
  const backBtn = document.getElementById("farmFieldBack");
  const filtersEl = document.getElementById("farmLevelFilters");
  if (hint) hint.textContent = "Плитки угодий · фильтр по уровню (город — в подписи).";
  if (backBtn) {
    backBtn.title = "Назад к выбору";
    backBtn.textContent = "← Назад";
  }

  if (!menuFarmLevelBand) menuFarmLevelBand = defaultFarmLevelBand();

  const all = collectFarmCatalogEntries();
  if (filtersEl) {
    filtersEl.innerHTML = "";
    filtersEl.hidden = !all.length;
    FARM_LEVEL_BANDS.forEach((band) => {
      const count =
        band.id === "all" ? all.length : all.filter((x) => x.band === band.id).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "farm-level-chip" + (menuFarmLevelBand === band.id ? " is-on" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", menuFarmLevelBand === band.id ? "true" : "false");
      btn.dataset.farmBand = band.id;
      btn.innerHTML =
        "<b>" +
        escFarmHubText(band.label) +
        "</b><small>" +
        count +
        "</small>";
      btn.onclick = () => {
        if (typeof Audio2 !== "undefined") Audio2.click();
        menuFarmLevelBand = band.id;
        if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
      };
      filtersEl.appendChild(btn);
    });
  }

  if (!all.length) {
    const empty = document.createElement("p");
    empty.className = "farm-hub-empty";
    empty.textContent = "Каталог охотничьих угодий пуст.";
    listEl.appendChild(empty);
    return;
  }

  const filtered =
    menuFarmLevelBand === "all"
      ? all
      : all.filter((x) => x.band === menuFarmLevelBand);

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "farm-hub-empty";
    empty.textContent = "Нет угодий в этой полосе уровней.";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    listEl.appendChild(
      buildFarmZoneChip(item.resolved.zone, "farm", {
        catalog: item.entry,
        playable: item.resolved.playable,
        hubLabel: item.hub.labelRu || farmCatalogHubLabel(item.hub.hubId),
      })
    );
  });
}

/** @deprecated имя оставлено для совместимости вызовов */
function fillFreeFarmHubByCities(listEl) {
  return fillFreeFarmCatalog(listEl);
}

function escFarmHubText(s) {
  if (typeof escHtml === "function") return escHtml(s);
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveCatalogFarmForMenu(entry) {
  const zid = entry.farmZoneId || entry.id;
  const live =
    typeof farmZoneById === "function"
      ? farmZoneById(zid)
      : typeof FARM_ZONES !== "undefined"
        ? FARM_ZONES.find((z) => z.id === zid)
        : null;
  if (live && live.side && !live.party) {
    return { zone: live, playable: !!live.active };
  }
  return {
    zone: {
      id: zid,
      name: entry.labelRu || zid,
      side: true,
      party: false,
      active: false,
      hubId: entry.hubId,
      catalogStatus: entry.status || "planned",
      l2Lvl: entry.l2Lvl || "",
      icon: "icons/btn_farm.png?v=4",
      reqLevel: 0,
      reqPower: 0,
    },
    playable: false,
  };
}

function buildFarmZoneChip(zone, mode, extra) {
  extra = extra || {};
  const st = typeof farmZoneStatus === "function" ? farmZoneStatus(zone) : { ok: false };
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;
  const rec =
    typeof recommendedFarmZoneId === "function" &&
    recommendedFarmZoneId({ mode }) === zone.id;
  const row = document.createElement("button");
  row.type = "button";
  const terr =
    typeof clanTerritoryStatusForZone === "function" ? clanTerritoryStatusForZone(zone.id) : null;
  const catalog = extra.catalog || null;
  const playable = extra.playable !== false && !!zone.active;
  const soon = !playable;
  row.className =
    "farm-zone-chip" +
    (state.farmZone === zone.id && playable ? " sel" : "") +
    (st.ok && playable ? " ok" : "") +
    (soon ? " soon" : "") +
    (!st.ok && playable ? " lock" : "") +
    (rec && st.ok && playable ? " rec" : "") +
    (mode === "story" && typeof storyChapterSeen === "function" && storyChapterSeen(zone.id)
      ? " story-done"
      : "") +
    (typeof zoneChipArtIsFramed === "function" && zoneChipArtIsFramed(zone.id)
      ? " is-framed-art"
      : "") +
    (terr && terr.capturable && terr.siegeEnabled
      ? terr.isMyClan
        ? " clan-mine"
        : terr.holder
          ? " clan-held"
          : " clan-neutral"
      : "");
  if (catalog && catalog.status) row.setAttribute("data-catalog-status", catalog.status);
  const chipIco =
    typeof uiZoneChipIcon === "function"
      ? uiZoneChipIcon(zone.id, state.avatar?.raceId)
      : view.icon || zone.icon || "icons/btn_farm.png?v=4";
  let sub;
  if (mode === "farm") {
    if (playable) sub = farmFreeZoneChipText(zone, st, extra);
    else if (catalog?.status === "draft") {
      sub =
        (extra.hubLabel ? extra.hubLabel + " · " : "") +
        "черновик · доделаем";
    } else if (catalog?.l2Lvl) {
      sub =
        (extra.hubLabel ? extra.hubLabel + " · " : "") +
        "скоро · L2 " +
        catalog.l2Lvl;
    } else {
      sub = (extra.hubLabel ? extra.hubLabel + " · " : "") + "скоро";
    }
  } else {
    sub = farmZoneChipText(zone, st);
  }
  row.innerHTML =
    '<img class="farm-zone-chip-art" src="' +
    chipIco +
    '" alt="" draggable="false">' +
    '<span class="farm-zone-chip-veil" aria-hidden="true"></span>' +
    '<span class="farm-zone-chip-body"><strong>' +
    (view.name || zone.name || zone.id) +
    "</strong><small>" +
    sub +
    "</small></span>";
  if (soon) {
    row.setAttribute("aria-disabled", "true");
  }
  row.onclick = () => {
    if (soon || row.getAttribute("aria-disabled") === "true") return;
    Audio2.click();
    selectFarmZone(zone.id);
  };
  wireFarmZoneChipTooltip(row, zone, extra);
  return row;
}

const FARM_LOOT_TAG_RU = {
  armor_d: "броня D",
  armor_c: "броня C",
  armor_b: "броня B",
  jewelry_d: "бижу D",
  jewelry_c: "бижу C",
  scroll_d: "свитки D",
  scroll_c: "свитки C",
  material: "материалы",
};

function farmTipPct(x) {
  return Math.round(Number(x) * 100) + "%";
}

function farmTipRow(label, value) {
  return (
    "<tr><th>" +
    escFarmHubText(label) +
    "</th><td>" +
    value +
    "</td></tr>"
  );
}

function farmZoneArmorFragTipRows(zoneId) {
  const zid =
    typeof resolveFarmZoneId === "function" ? resolveFarmZoneId(zoneId) : zoneId;
  let pool = typeof ARMOR_FRAG_ZONES !== "undefined" ? ARMOR_FRAG_ZONES[zid] : null;
  if (typeof pool === "string") pool = [pool];
  const rows = [];
  if (Array.isArray(pool) && pool.length) {
    const names =
      typeof ARMOR_SETS !== "undefined"
        ? pool.map((sid) => ARMOR_SETS[sid]?.name || sid).filter(Boolean)
        : pool.slice();
    rows.push(farmTipRow("Куски брони", escFarmHubText(names.join(", "))));
  }
  let jPool = typeof JEWELRY_FRAG_ZONES !== "undefined" ? JEWELRY_FRAG_ZONES[zid] : null;
  if (typeof jPool === "string") jPool = [jPool];
  if (Array.isArray(jPool) && jPool.length) {
    const names =
      typeof JEWELRY_SETS !== "undefined"
        ? jPool.map((sid) => JEWELRY_SETS[sid]?.name || sid).filter(Boolean)
        : jPool.slice();
    rows.push(farmTipRow("Куски бижи", escFarmHubText(names.join(", "))));
  }
  return rows;
}

function farmZoneLootBandTipRows(zone) {
  if (!zone || !zone.side) return [];
  const label =
    typeof farmZoneLootBandLabel === "function" ? farmZoneLootBandLabel(zone) : "";
  if (!label) return [];
  const grade =
    typeof farmZoneLootGrade === "function" ? farmZoneLootGrade(zone) : "D";
  const rows = [farmTipRow("Банда лута", escFarmHubText(label))];
  rows.push(
    farmTipRow(
      "Грейд",
      escFarmHubText(
        grade +
          " · куски, оружие, свитки" +
          (grade === "D" ? " (растёт с уровнем зоны)" : "")
      )
    )
  );
  return rows;
}

function farmZoneWeaponTipRows(zone) {
  if (!zone || !zone.id) return [];
  const grade =
    typeof mineDropGradeSummary === "function" ? mineDropGradeSummary(zone.id) : "";
  const weights =
    typeof mineDropWeights === "function" ? mineDropWeights(zone.id) : null;
  const rows = [];
  if (grade) rows.push(farmTipRow("Оружие", escFarmHubText(grade)));
  if (weights) {
    const parts = ["D", "C", "B", "A"]
      .filter((g) => (weights[g] || 0) > 0)
      .map((g) => g + " " + Math.round(weights[g]) + "%");
    if (parts.length) rows.push(farmTipRow("Грейды", escFarmHubText(parts.join(" · "))));
  }
  const wChance = farmZoneWeaponChanceTip(zone);
  if (wChance) rows.push(farmTipRow("Шанс оружия", escFarmHubText(wChance)));
  return rows;
}

function farmZoneWeaponChanceTip(zone) {
  if (!zone || typeof mineWeaponDropChance !== "function") {
    if (typeof farmZoneGoldenWeaponChancePct === "function") {
      const g = farmZoneGoldenWeaponChancePct(zone);
      return g != null ? "золотой ≈ " + g + "%" : null;
    }
    return null;
  }
  const prev = state.farmZone;
  state.farmZone = zone.id;
  try {
    const n = Math.round(mineWeaponDropChance("normal") * 1000) / 10;
    const g = Math.round(mineWeaponDropChance("golden") * 1000) / 10;
    return "обычный ≈ " + n + "% · золотой ≈ " + g + "%";
  } finally {
    state.farmZone = prev;
  }
}

function farmZoneGoldenWeaponChancePct(zone) {
  if (!zone || typeof farmZoneTargetPower !== "function") return null;
  const fn =
    typeof mineWeaponDropChance === "function"
      ? (t) => mineWeaponDropChance(t)
      : typeof mineGoldenWeaponChance === "function"
        ? () => mineGoldenWeaponChance()
        : null;
  if (!fn) return null;
  const prev = state.farmZone;
  state.farmZone = zone.id;
  try {
    return Math.round(fn("golden") * 100);
  } finally {
    state.farmZone = prev;
  }
}

function farmZoneScrollTipRows(zone) {
  if (!zone || !zone.side) return [];
  const g =
    typeof scrollDropGradeForZone === "function"
      ? scrollDropGradeForZone(zone.id)
      : typeof farmZoneLootGrade === "function"
        ? farmZoneLootGrade(zone)
        : "D";
  return [farmTipRow("Свитки", escFarmHubText(g))];
}

function farmZoneAdenaTipRange(zoneId, kind) {
  const golden = kind === "golden";
  const defLo = golden
    ? typeof MINE_ADENA_GOLDEN !== "undefined"
      ? MINE_ADENA_GOLDEN.min
      : 18000
    : typeof MINE_ADENA_REWARD !== "undefined"
      ? MINE_ADENA_REWARD.min
      : 3000;
  const defHi = golden
    ? typeof MINE_ADENA_GOLDEN !== "undefined"
      ? MINE_ADENA_GOLDEN.max
      : 43200
    : typeof MINE_ADENA_REWARD !== "undefined"
      ? MINE_ADENA_REWARD.max
      : 7200;
  let lo =
    typeof tuneInt === "function"
      ? tuneInt(golden ? "mine.goldenMin" : "mine.rewardMin", defLo)
      : defLo;
  let hi =
    typeof tuneInt === "function"
      ? tuneInt(golden ? "mine.goldenMax" : "mine.rewardMax", defHi)
      : defHi;
  const scale =
    typeof mineProgressAdenaScale === "function" ? mineProgressAdenaScale(zoneId) : 1;
  lo = Math.max(1, Math.round(lo * scale));
  hi = Math.max(1, Math.round(hi * scale));
  if (typeof playtestIncome === "function") {
    lo = playtestIncome(lo);
    hi = playtestIncome(hi);
  }
  let mult =
    typeof avatarMineRewardMult === "function" ? avatarMineRewardMult(zoneId) : 1;
  if (!(mult > 0)) {
    const zone =
      typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
    const chapter = zone?.chapter || 1;
    mult = zone?.mine?.rewardScale || 1 + (chapter - 1) * 0.1;
  }
  lo = Math.round(lo * mult);
  hi = Math.round(hi * mult);
  const raceKey = golden ? "goldenAdenaMult" : "normalAdenaMult";
  const raceFn =
    typeof passiveEffectMult === "function"
      ? passiveEffectMult
      : typeof racialEffectMult === "function"
        ? racialEffectMult
        : null;
  if (raceFn) {
    const rm = raceFn(raceKey, state.avatar || state.avatar?.raceId);
    lo = Math.round(lo * rm);
    hi = Math.round(hi * rm);
  }
  return { lo, hi };
}

function farmZoneAdenaTipRows(zoneId) {
  const fmtA = typeof fmtAdena === "function" ? fmtAdena : (n) => String(n);
  const n = farmZoneAdenaTipRange(zoneId, "normal");
  const g = farmZoneAdenaTipRange(zoneId, "golden");
  return [
    farmTipRow("Adena", fmtA(n.lo) + "–" + fmtA(n.hi)),
    farmTipRow("Золотой", fmtA(g.lo) + "–" + fmtA(g.hi)),
  ];
}

function farmZoneTooltipHtml(zone, extra) {
  extra = extra || {};
  if (!zone) return "";
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;
  const name = view.name || zone.name || zone.id;
  const hub =
    extra.hubLabel ||
    farmCatalogHubLabel(zone.hubId) ||
    "";
  const catalog = extra.catalog || null;
  const playable = extra.playable !== false && !!zone.active;

  let meta = "";
  if (hub || zone.l2Lvl || (zone.lvlMin != null && zone.lvlMax != null)) {
    const bits = [];
    if (hub) bits.push(hub);
    if (zone.l2Lvl) bits.push("L2 " + zone.l2Lvl);
    else if (zone.lvlMin != null && zone.lvlMax != null) {
      bits.push("L2 " + zone.lvlMin + "–" + zone.lvlMax);
    }
    meta =
      '<div class="farm-zone-tip-meta">' + escFarmHubText(bits.join(" · ")) + "</div>";
  }

  const rows = [];
  if (zone.side) {
    rows.push(...farmZoneLootBandTipRows(zone));
    rows.push(...farmZoneAdenaTipRows(zone.id));
    rows.push(...farmZoneScrollTipRows(zone));

    const fragRows = farmZoneArmorFragTipRows(zone.id);
    if (fragRows.length) rows.push(...fragRows);
    else if (Array.isArray(zone.lootTags) && zone.lootTags.length) {
      rows.push(
        farmTipRow(
          "Лут",
          escFarmHubText(
            zone.lootTags.map((t) => FARM_LOOT_TAG_RU[t] || t).join(", ")
          )
        )
      );
    }

    rows.push(...farmZoneWeaponTipRows(zone));

    const terr =
      typeof clanTerritoryStatusForZone === "function"
        ? clanTerritoryStatusForZone(zone.id)
        : null;
    if (terr && terr.capturable && terr.siegeEnabled && terr.lineMeta) {
      rows.push(farmTipRow("Клан", escFarmHubText(terr.lineMeta)));
    }
    if (!playable && catalog) {
      rows.push(
        farmTipRow(
          "Статус",
          catalog.status === "draft" ? "черновик" : "скоро"
        )
      );
    }
  } else {
    if (view.storyTag) rows.push(farmTipRow("Сюжет", escFarmHubText(view.storyTag)));
    rows.push(farmTipRow("Дроп", escFarmHubText("только D · редко")));
    rows.push(...farmZoneWeaponTipRows(zone));
  }

  if (!rows.length) return "";

  return (
    '<strong class="farm-zone-tip-title">' +
    escFarmHubText(name) +
    "</strong>" +
    meta +
    '<table class="farm-zone-tip-table"><tbody>' +
    rows.join("") +
    "</tbody></table>"
  );
}

function ensureFarmZoneTipEl() {
  let tip = document.getElementById("farmZoneTip");
  if (tip) return tip;
  tip = document.createElement("div");
  tip.id = "farmZoneTip";
  tip.className = "farm-zone-tip";
  tip.hidden = true;
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  return tip;
}

function hideFarmZoneTip() {
  const tip = document.getElementById("farmZoneTip");
  if (tip) {
    tip.hidden = true;
    tip.innerHTML = "";
  }
}

function positionFarmZoneTip(tip, anchor) {
  const r = anchor.getBoundingClientRect();
  tip.hidden = false;
  tip.style.left = "0px";
  tip.style.top = "0px";
  const tw = tip.offsetWidth || 260;
  const th = tip.offsetHeight || 120;
  let left = r.left + r.width / 2 - tw / 2;
  let top = r.top - th - 10;
  if (top < 8) top = r.bottom + 10;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  tip.style.left = Math.round(left) + "px";
  tip.style.top = Math.round(top) + "px";
}

function wireFarmZoneChipTooltip(row, zone, extra) {
  if (!row || row.dataset.tipWired) return;
  row.dataset.tipWired = "1";
  const show = () => {
    const tip = ensureFarmZoneTipEl();
    tip.innerHTML = farmZoneTooltipHtml(zone, extra);
    positionFarmZoneTip(tip, row);
  };
  const hide = () => hideFarmZoneTip();
  row.addEventListener("mouseenter", show);
  row.addEventListener("mouseleave", hide);
  row.addEventListener("focus", show);
  row.addEventListener("blur", hide);
  row.addEventListener(
    "click",
    () => {
      hide();
    },
    true
  );
}

function farmZoneL2RangeLabel(zone) {
  if (!zone) return "";
  if (zone.l2Lvl) return "L2 " + zone.l2Lvl;
  const lo = Number(zone.lvlMin);
  const hi = Number(zone.lvlMax);
  if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo) {
    return "L2 " + lo + "–" + hi;
  }
  if (Number.isFinite(lo)) return "L2 " + lo + "+";
  return "";
}

function farmFreeZoneChipText(zone, st, extra) {
  extra = extra || {};
  const hub =
    extra.hubLabel ||
    farmCatalogHubLabel(zone.hubId) ||
    "";
  const l2 = farmZoneL2RangeLabel(zone);
  const bits = [];
  if (hub) bits.push(hub);
  if (l2) bits.push(l2);
  const prefix = bits.length ? bits.join(" · ") + " · " : "";
  if (!zone.active) return (bits.length ? bits.join(" · ") + " · " : "") + "скоро";
  if (!st.ok) {
    const parts = bits.slice();
    if (st.needLevel > 0) parts.push("от ур." + zone.reqLevel);
    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");
    return parts.length ? parts.join(" · ") : "закрыто";
  }
  const grade =
    typeof farmZoneLootGrade === "function" ? farmZoneLootGrade(zone) : null;
  let line = prefix + (grade ? "дроп " + grade : "фрагменты");
  const terr =
    typeof clanTerritoryStatusForZone === "function" ? clanTerritoryStatusForZone(zone.id) : null;
  if (terr && terr.capturable && terr.siegeEnabled && terr.lineShort) {
    line += " · " + terr.lineShort;
  }
  return line;
}

function updatePlayBanner(opts) {
  const titleEl = document.getElementById(opts.titleId);
  const metaEl = document.getElementById(opts.metaId);
  const banner = document.getElementById(opts.bannerId);
  const zone = opts.zone;
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;
  const st = farmZoneStatus(zone);
  if (titleEl) {
    const raw = opts.farm
      ? view.name || zone.name || "Фарм"
      : view.mine?.title || view.name || "";
    titleEl.textContent = String(raw).replace(/^[^\p{L}\p{N}]+/u, "").trim() || raw;
  }
  if (!metaEl || !banner) return;
  if (!state.avatar?.created) {
    metaEl.textContent = opts.farm
      ? "Создай персонажа — откроется фарм"
      : "Создай персонажа — пять дорог сойдутся на общих жилах";
    banner.classList.add("mine-locked");
    return;
  }
  if (!st.ok) {
    metaEl.textContent = farmZoneMetaText(zone, st);
    banner.classList.add("mine-locked");
    return;
  }
  banner.classList.remove("mine-locked");
  if (opts.farm) {
    let pool = typeof ARMOR_FRAG_ZONES !== "undefined" ? ARMOR_FRAG_ZONES[zone.id] : null;
    if (typeof pool === "string") pool = [pool];
    const names =
      Array.isArray(pool) && typeof ARMOR_SETS !== "undefined"
        ? pool.map((sid) => ARMOR_SETS[sid]?.name || sid).filter(Boolean)
        : [];
    const grade =
      typeof farmZoneLootGrade === "function" ? farmZoneLootGrade(zone) : null;
    let meta = names.length
      ? "Куски: " + names.join(" / ")
      : grade
        ? "Дроп " + grade
        : "Фрагменты брони";
    const terr =
      typeof clanTerritoryStatusForZone === "function" ? clanTerritoryStatusForZone(zone.id) : null;
    if (terr && terr.capturable && terr.siegeEnabled && terr.lineMeta) {
      meta += " · " + terr.lineMeta;
    }
    metaEl.textContent = meta;
    return;
  }
  if (typeof isPreludeComplete === "function" && isPreludeComplete()) {
    metaEl.textContent = "Prelude завершён · эпоха Хаоса";
    return;
  }
  const beat = typeof zoneStoryBeat === "function" ? zoneStoryBeat(zone.id) : null;
  metaEl.textContent = beat?.questRef
    ? beat.questRef
    : view.storyTag + " · сила " + fmt(st.power);
}

function renderAvatarStatsPanel() {
  const grid = document.getElementById("avatarStatGrid");
  const powerEl = document.getElementById("avatarFarmPower");
  if (!grid) return;
  const mystic = typeof avatarIsMystic === "function" && avatarIsMystic();
  const bd =
    typeof avatarStatsBreakdown === "function"
      ? avatarStatsBreakdown()
      : null;
  const s = bd ? bd.totals : typeof avatarStats === "function" ? avatarStats() : {};
  const power =
    (bd && bd.farm && bd.farm.power) ||
    (typeof avatarFarmPower === "function" ? avatarFarmPower() : 0);
  if (powerEl) powerEl.textContent = fmt(power);

  if (!bd || !bd.combat) {
    grid.className = "avatar-stat-grid";
    grid.innerHTML = [
      { k: "P.Atk", v: s.patk || 0 },
      { k: "M.Atk", v: s.matk || 0 },
      { k: "P.Def", v: s.pdef || 0 },
      { k: "M.Def", v: s.mdef || 0 },
    ]
      .map(
        (r) =>
          '<div class="avatar-stat"><span class="avatar-stat-k">' +
          r.k +
          '</span><b class="avatar-stat-v">' +
          fmt(r.v) +
          "</b></div>"
      )
      .join("");
    return;
  }

  grid.className = "avatar-stats-sheet";

  function fmtPct(x) {
    const n = Number(x) || 0;
    if (!n) return "";
    const p = Math.round(n * 1000) / 10;
    return (p % 1 === 0 ? String(p) : p.toFixed(1)) + "%";
  }

  function tipAttr(tip) {
    return tip ? ' title="' + String(tip).replace(/"/g, "&quot;") + '"' : "";
  }

  function sheetRow(k, v, opts) {
    opts = opts || {};
    return (
      '<div class="avatar-sheet-row"' +
      tipAttr(opts.tip) +
      ">" +
      '<span class="avatar-sheet-k">' +
      k +
      "</span>" +
      '<b class="avatar-sheet-v">' +
      v +
      "</b></div>"
    );
  }

  function sheetSection(title, bodyHtml, opts) {
    if (!bodyHtml) return "";
    opts = opts || {};
    const cls = opts.mode ? " avatar-sheet-sec--" + opts.mode : "";
    return (
      '<section class="avatar-sheet-sec' +
      cls +
      '">' +
      "<h4 class=\"avatar-sheet-hd\"" +
      tipAttr(opts.tip || opts.note) +
      ">" +
      title +
      "</h4>" +
      bodyHtml +
      "</section>"
    );
  }

  function combatTip(row, baseTip) {
    const bits = [];
    if (row.race) bits.push("раса " + row.race);
    if (row.class) bits.push("кл. " + row.class);
    if (row.level) bits.push("ур. " + row.level);
    if (row.gear) bits.push("экип " + row.gear);
    if (row.passive) bits.push("пасс. " + row.passive);
    const parts = bits.length ? " · " + bits.join(" + ") : "";
    return baseTip + parts;
  }

  const combatRows = [
    {
      k: "P.Atk",
      tip: mystic
        ? "Физ. урон — вторичный для мага"
        : "Физ. урон — основной у воина",
      row: bd.combat.patk,
    },
    {
      k: "M.Atk",
      tip: mystic
        ? "Маг. урон — основной у мага"
        : "Маг. урон — вторичный для воина",
      row: bd.combat.matk,
    },
    {
      k: "P.Def",
      tip: "Физ. защита",
      row: bd.combat.pdef,
    },
    {
      k: "M.Def",
      tip: "Маг. защита",
      row: bd.combat.mdef,
    },
  ];

  function statCell(k, v, tip) {
    return (
      '<div class="avatar-sheet-stat"' +
      tipAttr(tip) +
      ">" +
      '<span class="avatar-sheet-stat-k">' +
      k +
      "</span><b>" +
      v +
      "</b></div>"
    );
  }

  const combatHtml =
    '<div class="avatar-sheet-statgrid">' +
    combatRows
      .map((r) =>
        statCell(
          r.k,
          fmt((r.row && r.row.total) || 0),
          combatTip(r.row || {}, r.tip)
        )
      )
      .join("") +
    "</div>";

  const farmExtra = [];
  farmExtra.push(
    statCell(
      "Сила",
      fmt(bd.farm.power),
      "Сила фарма (PvE): гейт охоты. На арену не влияет."
    )
  );
  if (bd.farm.farmBonus > 0) {
    farmExtra.push(
      statCell("Бонус", "+" + fmt(Math.round(bd.farm.farmBonus)), "Плоский бонус к силе фарма")
    );
  }
  if (bd.sets.enchant > 0) {
    farmExtra.push(statCell("Заточка", "+" + fmtPct(bd.sets.enchant), "Шанс заточки"));
  }
  if (bd.sets.mineAdena > 0) {
    farmExtra.push(statCell("Adena", "+" + fmtPct(bd.sets.mineAdena)));
  }
  if (bd.sets.mineXp > 0) {
    farmExtra.push(statCell("XP", "+" + fmtPct(bd.sets.mineXp)));
  }
  if (bd.sets.armorSustain > 0) {
    farmExtra.push(statCell("Устойч.", "+" + fmtPct(bd.sets.armorSustain), "Меньше HP golden/boss"));
  }
  if (bd.sets.bossResist > 0) {
    farmExtra.push(statCell("Боссам", "+" + fmtPct(bd.sets.bossResist)));
  }
  if (bd.farm.weaponLabel) {
    farmExtra.push(
      '<div class="avatar-sheet-weapon"' +
        tipAttr("Оружие") +
        ">" +
        bd.farm.weaponLabel +
        "</div>"
    );
  }

  const pveBody =
    combatHtml +
    (farmExtra.length
      ? '<div class="avatar-sheet-statgrid avatar-sheet-statgrid--sec">' +
        farmExtra.join("") +
        "</div>"
      : "");

  const critPct = bd.pvp.crit > 0 ? fmtPct(bd.pvp.crit) : "—";
  const pvpBody =
    '<div class="avatar-sheet-statgrid">' +
    statCell(
      "ATK",
      bd.pvp.atk > 0 ? "+" + fmtPct(bd.pvp.atk) : "—",
      "Множитель атаки арены"
    ) +
    statCell(
      "DEF",
      bd.pvp.def > 0 ? "+" + fmtPct(bd.pvp.def) : "—",
      "Множитель защиты арены"
    ) +
    statCell(
      "HP",
      bd.pvp.hp > 0 ? "+" + fmt(Math.round(bd.pvp.hp)) : "—",
      "Бонус HP арены"
    ) +
    statCell("Крит", critPct === "" ? "—" : critPct, "Крит только на арене · ×1.5 · кап 35%") +
    "</div>";

  grid.innerHTML =
    '<p class="avatar-sheet-title">Характеристики</p>' +
    sheetSection("PvE", pveBody, {
      mode: "pve",
      tip: "Поле / охота. Сила — гейт зон.",
    }) +
    sheetSection("PvP", pvpBody, {
      mode: "pvp",
      tip: "Арена: те же Atk/Def + эти бонусы. Сила фарма не работает.",
    });
}

function renderMenuFarmHub() {
  migrateFarmZone();
  if (typeof migrateQuestProgress === "function") migrateQuestProgress();
  if (typeof refreshZoneStoryUnlocks === "function") refreshZoneStoryUnlocks();
  if (typeof migrateFarmNotify === "function") migrateFarmNotify();
  if (typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
  wireFarmHubEntry();

  const powerHead = document.getElementById("farmHubPower");
  const power = avatarFarmPower();
  const selected = farmZoneById(state.farmZone || "banana_mine");
  if (powerHead) {
    const tgt = farmZoneTargetPower(selected);
    powerHead.textContent = state.avatar?.created
      ? "Сила " + fmt(power) + " / " + fmt(tgt)
      : "Создай персонажа";
  }

  const entryEl = document.getElementById("farmHubEntry");
  const storyField = document.getElementById("storyField");
  const farmField = document.getElementById("farmField");
  const worldBossField = document.getElementById("worldBossField");
  const showEntry = !menuFarmEntry;
  if (entryEl) entryEl.hidden = !showEntry;
  if (showEntry && typeof syncWorldBossFarmEntryBtn === "function") {
    syncWorldBossFarmEntryBtn();
  }
  if (storyField) storyField.hidden = menuFarmEntry !== "story";
  if (farmField) farmField.hidden = menuFarmEntry !== "farm";
  if (worldBossField) worldBossField.hidden = menuFarmEntry !== "worldboss";
  const farmLevelFilters = document.getElementById("farmLevelFilters");
  if (farmLevelFilters && menuFarmEntry !== "farm") farmLevelFilters.hidden = true;
  if (typeof syncMenuHubMode === "function") syncMenuHubMode();

  const storyZones = typeof storyFarmZones === "function" ? storyFarmZones() : FARM_ZONES.filter((z) => !z.side && !z.party);
  const farmZones = typeof freeFarmZones === "function" ? freeFarmZones() : FARM_ZONES.filter((z) => z.side && !z.party);

  if (menuFarmEntry === "story") {
    fillFarmZoneList(document.getElementById("storyZoneList"), storyZones, { mode: "story" });
    const storyActions = document.getElementById("farmHubStoryActions");
    if (storyActions) storyActions.hidden = !state.avatar?.created;
    const enterableStory =
      storyZones.find((z) => typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) || null;
    // Не вешать баннер на пройденную главу — иначе «Играть» выглядит мёртвой
    const storyZone =
      selected && !selected.side && !selected.party && typeof canEnterFarmZone === "function" && canEnterFarmZone(selected)
        ? selected
        : enterableStory || selected;
    if (
      storyZone &&
      typeof canEnterFarmZone === "function" &&
      canEnterFarmZone(storyZone) &&
      state.farmZone !== storyZone.id
    ) {
      if (typeof ProgressStore !== "undefined") ProgressStore.set("farmZone", storyZone.id);
      else state.farmZone = storyZone.id;
    }
    updatePlayBanner({
      bannerId: "mineBanner",
      titleId: "mineBannerTitle",
      metaId: "mineBannerMeta",
      zone: storyZone,
      farm: false,
    });
  } else if (menuFarmEntry === "farm") {
    const farmBack = document.getElementById("farmFieldBack");
    if (farmBack) farmBack.textContent = "← Назад";
    fillFarmZoneList(document.getElementById("freeFarmZoneList"), farmZones, { mode: "farm" });
    const enterableFarm =
      farmZones.find((z) => typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) || null;
    const farmZone =
      selected && selected.side && !selected.party && typeof canEnterFarmZone === "function" && canEnterFarmZone(selected)
        ? selected
        : enterableFarm;
    if (farmZone) {
      if (state.farmZone !== farmZone.id) {
        if (typeof ProgressStore !== "undefined") ProgressStore.set("farmZone", farmZone.id);
        else state.farmZone = farmZone.id;
      }
      updatePlayBanner({
        bannerId: "farmPlayBanner",
        titleId: "farmPlayTitle",
        metaId: "farmPlayMeta",
        zone: farmZone,
        farm: true,
      });
    }
  } else if (menuFarmEntry === "worldboss" && typeof renderWorldBossHub === "function") {
    renderWorldBossHub();
  }

  if (typeof renderMineStoryBar === "function") renderMineStoryBar();
  if (typeof renderMenuHero === "function") renderMenuHero();
}

function renderMenuHero() {
  const titleEl = document.getElementById("heroTitle");
  const tagEl = document.getElementById("heroTagline");
  const heroPanel = document.querySelector(".hero-panel");
  const eyebrow = document.querySelector(".hero-eyebrow");
  if (!titleEl || !tagEl) return;

  const stepMineD = document.querySelector(".hero-step-mine .hero-step-d");
  const stepEnchD = document.querySelector(".hero-step-ench .hero-step-d");
  const stepGoldD = document.querySelector(".hero-step-gold .hero-step-d");
  const stepIco = document.querySelector(".hero-step-mine .hero-step-ico img");

  if (!state.avatar?.created) {
    titleEl.textContent = "SoulForge";
    tagEl.textContent = typeof STORY_ARC !== "undefined" ? String(STORY_ARC.tagline || "").replace(/<[^>]+>/g, "") : "Задание → заточка → adena.";
    if (eyebrow) eyebrow.textContent = "SoulForge · Lineage 2";
    if (stepMineD) stepMineD.textContent = "Лови цели · adena";
    if (stepEnchD) stepEnchD.textContent = "+0 … +16";
    if (stepGoldD) stepGoldD.textContent = "Продавай · крафти";
    if (stepIco) {
      stepIco.src = typeof UI_QUEST_ICON !== "undefined" ? UI_QUEST_ICON : "icons/quest_journal.png?v=10";
    }
    if (heroPanel) heroPanel.className = "hero-panel";
    return;
  }

  const zoneId = state.farmZone || "banana_mine";
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : farmZoneById(zoneId);
  const race = state.avatar.raceId || "human";
  const isFarm = !!(view && view.side);

  titleEl.textContent = view.name || "SoulForge";

  if (isFarm) {
    tagEl.textContent = "Свободный фарм · фрагменты брони и adena";
    if (eyebrow) eyebrow.textContent = "Фарм";
    if (stepMineD) stepMineD.textContent = "Фрагменты · adena";
  } else {
    const beat = (typeof STORY_BEATS !== "undefined" && STORY_BEATS[zoneId]?.[race]) || {};
    const story = view.story || {};
    const lead = beat.lead || story.lead || view.desc || "";
    tagEl.textContent = String(lead).replace(/<[^>]+>/g, "");
    if (eyebrow) {
      const ch = view.storyTag || ("Глава " + (view.chapter || 1));
      eyebrow.textContent = ch;
    }
    const targets = beat.targets || story.targets;
    if (stepMineD) {
      stepMineD.textContent = targets
        ? (String(targets).charAt(0).toUpperCase() + String(targets).slice(1) + " · adena")
        : "Лови цели · adena";
    }
  }

  if (stepEnchD) {
    const drop = typeof mineDropGradeSummary === "function" ? mineDropGradeSummary(zoneId) : "D";
    stepEnchD.textContent = "Дроп " + drop + " · +0…+16";
  }

  if (stepGoldD) {
    stepGoldD.textContent = "Продавай · крафти";
  }

  if (stepIco) {
    if (typeof uiZoneChipIcon === "function") {
      stepIco.src = uiZoneChipIcon(zoneId, race);
    } else if (view.icon) {
      stepIco.src = view.icon;
    } else {
      stepIco.src = typeof UI_QUEST_ICON !== "undefined" ? UI_QUEST_ICON : "icons/quest_journal.png?v=10";
    }
  }

  if (heroPanel) heroPanel.className = "hero-panel race-" + race + " zone-" + zoneId;
}

function renderMineBanner() {
  renderMenuFarmHub();
}
