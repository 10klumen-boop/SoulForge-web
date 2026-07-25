// ===== Статы персонажа и фарм-зоны: UI (панель, меню, баннер) =====
// Core logic (selectFarmZone, canEnterFarmZone, avatarMineRewardMult)
// вынесена в avatar-stats-core.js.
// Чистые расчёты (avatarStats, avatarFarmPower, mineMobMaxHp) — в avatar-math.js.

/** null = две кнопки входа; "story" | "farm" = список зон */
let menuFarmEntry = null;

function syncMenuHubMode() {
  const screen = document.getElementById("screen-menu");
  if (!screen) return;
  const mode = menuFarmEntry === "story" || menuFarmEntry === "farm" ? menuFarmEntry : "entry";
  screen.dataset.hubMode = mode;
  const grid = document.getElementById("homeGrid");
  if (grid) grid.dataset.hubMode = mode;
}

function setMenuFarmEntry(mode) {
  menuFarmEntry = mode === "story" || mode === "farm" ? mode : null;
  if (menuFarmEntry === "story" || menuFarmEntry === "farm") {
    const zones =
      menuFarmEntry === "farm"
        ? typeof freeFarmZones === "function"
          ? freeFarmZones()
          : FARM_ZONES.filter((z) => z.side)
        : typeof storyFarmZones === "function"
          ? storyFarmZones()
          : FARM_ZONES.filter((z) => !z.side);
    const cur = typeof farmZoneById === "function" ? farmZoneById(state.farmZone) : null;
    const ok =
      cur &&
      ((menuFarmEntry === "farm" && cur.side) || (menuFarmEntry === "story" && !cur.side));
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
}

function fillFarmZoneList(listEl, zones, opts) {
  opts = opts || {};
  if (!listEl) return;
  listEl.innerHTML = "";
  const mode = opts.mode || "story";
  if (!zones.length) {
    const empty = document.createElement("p");
    empty.className = "farm-hub-empty";
    empty.textContent =
      mode === "farm"
        ? "Свободный фарм пока пуст."
        : "Сюжетные зоны пока недоступны.";
    listEl.appendChild(empty);
    return;
  }
  zones.forEach((zone) => {
    const st = farmZoneStatus(zone);
    const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;
    const rec =
      typeof recommendedFarmZoneId === "function" &&
      recommendedFarmZoneId({ mode }) === zone.id;
    const row = document.createElement("button");
    row.type = "button";
    row.className =
      "farm-zone-chip" +
      (state.farmZone === zone.id ? " sel" : "") +
      (st.ok && zone.active ? " ok" : "") +
      (!zone.active ? " soon" : "") +
      (!st.ok && zone.active ? " lock" : "") +
      (rec && st.ok ? " rec" : "") +
      (mode === "story" && typeof storyChapterSeen === "function" && storyChapterSeen(zone.id)
        ? " story-done"
        : "");
    const chipIco =
      typeof uiZoneChipIcon === "function"
        ? uiZoneChipIcon(zone.id, state.avatar?.raceId)
        : view.icon || zone.icon;
    const sub =
      mode === "farm"
        ? farmFreeZoneChipText(zone, st)
        : farmZoneChipText(zone, st);
    row.innerHTML =
      '<img src="' + chipIco + '" alt="">' +
      "<span><strong>" + view.name + "</strong><small>" + sub + "</small></span>";
    row.onclick = () => {
      Audio2.click();
      selectFarmZone(zone.id);
    };
    listEl.appendChild(row);
  });
}

function farmFreeZoneChipText(zone, st) {
  if (!zone.active) return "скоро";
  if (!st.ok) {
    const parts = [];
    if (st.needLevel > 0) parts.push("р." + zone.reqLevel);
    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");
    return parts.length ? parts.join(" · ") : "закрыто";
  }
  const mult = typeof avatarMineRewardMult === "function" ? avatarMineRewardMult(zone.id) : 1;
  return "фрагменты · +" + Math.round((mult - 1) * 100) + "% adena";
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
  const mult = avatarMineRewardMult(zone.id);
  if (opts.farm) {
    let pool = typeof ARMOR_FRAG_ZONES !== "undefined" ? ARMOR_FRAG_ZONES[zone.id] : null;
    if (typeof pool === "string") pool = [pool];
    const names =
      Array.isArray(pool) && typeof ARMOR_SETS !== "undefined"
        ? pool.map((sid) => ARMOR_SETS[sid]?.name || sid).filter(Boolean)
        : [];
    metaEl.textContent =
      (names.length ? "Куски: " + names.join(" / ") + " · " : "Фрагменты брони · ") +
      "+" + Math.round((mult - 1) * 100) + "% adena";
    return;
  }
  if (typeof isPreludeComplete === "function" && isPreludeComplete()) {
    metaEl.textContent =
      "Prelude завершён · эпоха Хаоса · +" + Math.round((mult - 1) * 100) + "% adena";
    return;
  }
  const beat = typeof zoneStoryBeat === "function" ? zoneStoryBeat(zone.id) : null;
  metaEl.textContent = beat?.questRef
    ? beat.questRef + " · +" + Math.round((mult - 1) * 100) + "% adena"
    : view.storyTag + " · сила " + fmt(st.power) + " · +" + Math.round((mult - 1) * 100) + "% adena";
}

function renderAvatarStatsPanel() {
  const grid = document.getElementById("avatarStatGrid");
  const powerEl = document.getElementById("avatarFarmPower");
  if (!grid) return;
  const s = avatarStats();
  const power = avatarFarmPower();
  const mystic = avatarIsMystic();
  const rows = [
    { k: "P.Atk", v: s.patk, tip: mystic ? "Физ. урон — вторичный для мага" : "Физ. урон — основной стат воина в шахте и силе фарма" },
    { k: "M.Atk", v: s.matk, tip: mystic ? "Маг. урон — основной стат мага в шахте и силе фарма" : "Маг. урон — вторичный для воина (влияет слабее P.Atk)" },
    { k: "P.Def", v: s.pdef, tip: "Физ. защита — броня; снижает HP golden/boss" },
    { k: "M.Def", v: s.mdef, tip: "Маг. защита — броня; снижает HP golden/boss" },
  ];
  grid.innerHTML = rows
    .map(
      (r) =>
        '<div class="avatar-stat" title="' + r.tip + '">' +
        '<span class="avatar-stat-k">' + r.k + "</span>" +
        '<b class="avatar-stat-v">' + fmt(r.v) + "</b></div>"
    )
    .join("");
  if (powerEl) powerEl.textContent = fmt(power);
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
  const showEntry = !menuFarmEntry;
  if (entryEl) entryEl.hidden = !showEntry;
  if (storyField) storyField.hidden = menuFarmEntry !== "story";
  if (farmField) farmField.hidden = menuFarmEntry !== "farm";
  if (typeof syncMenuHubMode === "function") syncMenuHubMode();

  const storyZones = typeof storyFarmZones === "function" ? storyFarmZones() : FARM_ZONES.filter((z) => !z.side);
  const farmZones = typeof freeFarmZones === "function" ? freeFarmZones() : FARM_ZONES.filter((z) => z.side);

  if (menuFarmEntry === "story") {
    fillFarmZoneList(document.getElementById("storyZoneList"), storyZones, { mode: "story" });
    const storyActions = document.getElementById("farmHubStoryActions");
    if (storyActions) storyActions.hidden = !state.avatar?.created;
    const storyZone =
      selected && !selected.side
        ? selected
        : storyZones.find((z) => typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) ||
          storyZones[0] ||
          selected;
    updatePlayBanner({
      bannerId: "mineBanner",
      titleId: "mineBannerTitle",
      metaId: "mineBannerMeta",
      zone: storyZone,
      farm: false,
    });
  } else if (menuFarmEntry === "farm") {
    fillFarmZoneList(document.getElementById("freeFarmZoneList"), farmZones, { mode: "farm" });
    const farmZone =
      selected && selected.side
        ? selected
        : farmZones.find((z) => typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) ||
          farmZones[0] ||
          null;
    if (farmZone) {
      updatePlayBanner({
        bannerId: "farmPlayBanner",
        titleId: "farmPlayTitle",
        metaId: "farmPlayMeta",
        zone: farmZone,
        farm: true,
      });
    }
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
    const mult = typeof avatarMineRewardMult === "function" ? avatarMineRewardMult(zoneId) : 1;
    const pct = Math.round((mult - 1) * 100);
    stepGoldD.textContent = pct > 0 ? ("+" + pct + "% adena · крафт") : "Продавай · крафти";
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
