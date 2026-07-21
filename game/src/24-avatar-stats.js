// ===== Статы персонажа и фарм-зоны: UI (панель, меню, баннер) =====
// Core logic (selectFarmZone, canEnterFarmZone, avatarMineRewardMult)
// вынесена в avatar-stats-core.js.
// Чистые расчёты (avatarStats, avatarFarmPower, mineMobMaxHp) — в avatar-math.js.

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

    { k: "P.Def", v: s.pdef, tip: "Физ. защита — входит в силу фарма" },

    { k: "M.Def", v: s.mdef, tip: "Маг. защита — входит в силу фарма" },

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

  const listEl = document.getElementById("farmZoneList");

  const powerHead = document.getElementById("farmHubPower");

  const meta = document.getElementById("mineBannerMeta");

  const banner = document.getElementById("mineBanner");

  const titleEl = document.getElementById("mineBannerTitle");

  const imgEl = document.getElementById("mineBannerImg");

  const farmRead = document.getElementById("farmStoryRead");

  const selected = farmZoneById(state.farmZone || "banana_mine");

  const viewSel = typeof zoneRaceView === "function" ? zoneRaceView(selected) : selected;

  const stSel = farmZoneStatus(selected);

  const power = avatarFarmPower();



  if (powerHead) {

    const tgt = farmZoneTargetPower(selected);

    powerHead.textContent = state.avatar?.created
      ? "Сила " + fmt(power) + " / " + fmt(tgt)
      : "Создай персонажа";

  }

  if (farmRead) farmRead.hidden = !state.avatar?.created;



  if (listEl) {

    listEl.innerHTML = "";

    FARM_ZONES.forEach((zone) => {

      const st = farmZoneStatus(zone);

      const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;

      const rec = typeof recommendedFarmZoneId === "function" && recommendedFarmZoneId() === zone.id;

      const row = document.createElement("button");

      row.type = "button";

      row.className =

        "farm-zone-chip" +

        (state.farmZone === zone.id ? " sel" : "") +

        (st.ok && zone.active ? " ok" : "") +

        (!zone.active ? " soon" : "") +

        (!st.ok && zone.active ? " lock" : "") +

        (rec && st.ok ? " rec" : "") +

        (typeof storyChapterSeen === "function" && storyChapterSeen(zone.id) ? " story-done" : "");

      const chipIco = typeof uiZoneChipIcon === "function" ? uiZoneChipIcon(zone.id, state.avatar?.raceId) : (view.icon || zone.icon);

      row.innerHTML =

        '<img src="' + chipIco + '" alt="">' +

        "<span><strong>" + view.name + "</strong><small>" + farmZoneChipText(zone, st) + "</small></span>";

      row.onclick = () => {

        Audio2.click();

        selectFarmZone(zone.id);

      };

      listEl.appendChild(row);

    });

  }



  if (titleEl) {
    const raw = viewSel.mine?.title || viewSel.name || "";
    titleEl.textContent = String(raw).replace(/^[^\p{L}\p{N}]+/u, "").trim() || raw;
  }

  if (imgEl) {
    imgEl.removeAttribute("src");
    imgEl.hidden = true;
    imgEl.style.display = "none";
  }

  if (!meta) return;

  if (!state.avatar?.created) {

    meta.textContent = "Создай персонажа — пять дорог сойдутся на общих жилах";

    if (banner) banner.classList.add("mine-locked");

    return;

  }

  if (typeof isPreludeComplete === "function" && isPreludeComplete()) {

    meta.textContent = "Prelude завершён · эпоха Хаоса · +" + Math.round((avatarMineRewardMult(selected.id) - 1) * 100) + "% adena";

    if (banner) banner.classList.remove("mine-locked");

    return;

  }

  if (stSel.ok) {

    const mult = avatarMineRewardMult(selected.id);
    const beat = typeof zoneStoryBeat === "function" ? zoneStoryBeat(selected.id) : null;

    meta.textContent = beat?.questRef
      ? beat.questRef + " · +" + Math.round((mult - 1) * 100) + "% adena"
      : viewSel.storyTag + " · сила " + fmt(stSel.power) + " · +" + Math.round((mult - 1) * 100) + "% adena";

    if (banner) banner.classList.remove("mine-locked");

  } else {

    meta.textContent = farmZoneMetaText(selected, stSel);

    if (banner) banner.classList.add("mine-locked");

  }

  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
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
  const beat = (typeof STORY_BEATS !== "undefined" && STORY_BEATS[zoneId]?.[race]) || {};
  const story = view.story || {};

  titleEl.textContent = view.name || "SoulForge";

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



