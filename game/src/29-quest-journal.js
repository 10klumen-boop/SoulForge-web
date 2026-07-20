// ===== Журнал квестов, награды за главы =====

/** Награды за прохождение главы (босс повержен). */
const ZONE_CHAPTER_REWARDS = {
  banana_mine: {
    adena: 22_000,
    soul: 20,
    spirit: 0,
    crystals: { D: 2 },
    lines: [
      "Старейшина благодарит за зачистку — остров снова дышит.",
      "Выплата и кристаллы D — заточи клинок и добери силу до следующей главы.",
    ],
  },
  elven_ruins: {
    adena: 28_000,
    soul: 18,
    spirit: 8,
    crystals: { D: 2 },
    lines: [
      "Барьер руин удержан — духи отступили от сводов.",
      "Руда и кристаллы D — без авто-залива свитками.",
    ],
  },
  orc_barracks: {
    adena: 40_000,
    soul: 24,
    spirit: 14,
    crystals: { D: 2, C: 1 },
    lines: [
      "Граница у леса устояла — орки откатываются.",
      "Племя и церковь делят скромные трофеи.",
    ],
  },
  dark_cavern: {
    adena: 55_000,
    soul: 32,
    spirit: 20,
    crystals: { C: 2 },
    lines: [
      "Скверна приглушена — тьма отступила на шаг.",
      "Кристаллы C — редкая добыча у границы.",
    ],
  },
  dwarven_depths: {
    adena: 70_000,
    soul: 40,
    spirit: 28,
    crystals: { C: 2, B: 1 },
    lines: [
      "Кратер под контролем — гильдии готовы открыть путь к башне.",
      "Финал пролога: осмысленная выплата, не миллионы.",
    ],
  },
};

/** Награда за шаг поручения (меньше главы; растёт с главой и номером шага). */
function zoneQuestStepRewardDef(zoneId, step) {
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  const ch = Math.min(5, Math.max(1, zone?.chapter || 1));
  const s = Math.min(3, Math.max(1, Number(step) || 1));
  const adenaBase = [2800, 3500, 5200, 7200, 9500][ch - 1];
  const stepMult = [1, 1.25, 1.55][s - 1];
  const adena = Math.round(adenaBase * stepMult);
  const soul = Math.max(1, Math.round([5, 5, 7, 9, 12][ch - 1] * [0.85, 1, 1.2][s - 1]));
  let spirit = 0;
  if (ch >= 2) {
    spirit = Math.round([0, 2, 3, 5, 7][ch - 1] * [0.6, 0.9, 1.15][s - 1]);
  }
  const crystals = {};
  if (s === 3) {
    if (ch <= 2) crystals.D = 1;
    else if (ch === 3) crystals.D = 1;
    else crystals.C = 1;
  } else if (s === 2 && ch === 1) {
    // Гл.1: кристалл уже на шаге 2 — успеть заточить до босса
    crystals.D = 1;
  } else if (s === 2 && ch >= 4) {
    crystals.D = 1;
  }
  return { adena, soul, spirit, crystals };
}

function ensureStepRewardsState() {
  ensureQuestProgress();
  if (!state.questProgress.stepRewards) state.questProgress.stepRewards = {};
}

function isQuestStepRewardClaimed(questId) {
  ensureStepRewardsState();
  return !!state.questProgress.stepRewards[questId];
}

function formatQuestStepLootLines(zoneId, step) {
  const rw = zoneQuestStepRewardDef(zoneId, step);
  const lines = [];
  const adena = typeof playtestIncome === "function" ? playtestIncome(rw.adena || 0) : (rw.adena || 0);
  if (adena) lines.push("+" + fmtAdena(adena) + " adena");
  if (rw.soul) lines.push("Soul Ore ×" + fmt(rw.soul));
  if (rw.spirit) lines.push("Spirit Ore ×" + fmt(rw.spirit));
  if (rw.crystals) {
    Object.keys(rw.crystals).forEach((g) => {
      if (rw.crystals[g]) lines.push("Кристалл " + g + " ×" + rw.crystals[g]);
    });
  }
  return lines;
}

function formatQuestStepLootShort(zoneId, step) {
  return formatQuestStepLootLines(zoneId, step).join(" · ");
}

function applyQuestStepReward(zoneId, step, questId, opts) {
  opts = opts || {};
  ensureStepRewardsState();
  if (!questId || state.questProgress.stepRewards[questId]) {
    return { adena: 0, summary: "", skipped: true };
  }
  const rw = zoneQuestStepRewardDef(zoneId, step);
  if (typeof ensureWorkshopState === "function") ensureWorkshopState();
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  if (!state.materials) state.materials = { soul: 0, spirit: 0 };
  let adena = typeof playtestIncome === "function" ? playtestIncome(rw.adena || 0) : (rw.adena || 0);
  if (adena > 0) {
    state.adena += adena;
    state.totals.earned = (state.totals.earned || 0) + adena;
  }
  if (rw.soul) state.materials.soul = (state.materials.soul || 0) + rw.soul;
  if (rw.spirit) state.materials.spirit = (state.materials.spirit || 0) + rw.spirit;
  if (rw.crystals) {
    Object.keys(rw.crystals).forEach((g) => {
      state.crystals[g] = (state.crystals[g] || 0) + (rw.crystals[g] || 0);
    });
  }
  state.questProgress.stepRewards[questId] = true;
  if ($("#adena")) $("#adena").textContent = fmt(state.adena);
  const summary = formatQuestStepLootShort(zoneId, step);
  if (!opts.silent && typeof gameLog === "function" && summary) {
    gameLog("Награда поручения " + step + "/" + (typeof QUESTS_PER_ZONE !== "undefined" ? QUESTS_PER_ZONE : 3) + ": " + summary, "success");
  }
  return { adena, rw, summary };
}

function grantQuestStepReward(zoneId, step, questId) {
  return applyQuestStepReward(zoneId, step, questId);
}

function ensureChapterRewardsState() {
  ensureQuestProgress();
  if (!state.questProgress.chapterRewards) state.questProgress.chapterRewards = {};
}

function isChapterRewardClaimed(zoneId) {
  ensureChapterRewardsState();
  return !!state.questProgress.chapterRewards[zoneId];
}

function zoneChapterRewardDef(zoneId) {
  return ZONE_CHAPTER_REWARDS[zoneId] || { adena: 15_000, soul: 10, spirit: 0, crystals: { D: 1 }, lines: [] };
}

function applyChapterReward(zoneId, opts) {
  opts = opts || {};
  const rw = zoneChapterRewardDef(zoneId);
  ensureWorkshopState();
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  if (!state.materials) state.materials = { soul: 0, spirit: 0 };
  let adena = typeof playtestIncome === "function" ? playtestIncome(rw.adena || 0) : (rw.adena || 0);
  if (adena > 0) {
    state.adena += adena;
    state.totals.earned = (state.totals.earned || 0) + adena;
  }
  if (rw.soul) state.materials.soul = (state.materials.soul || 0) + rw.soul;
  if (rw.spirit) state.materials.spirit = (state.materials.spirit || 0) + rw.spirit;
  if (rw.crystals) {
    Object.keys(rw.crystals).forEach((g) => {
      state.crystals[g] = (state.crystals[g] || 0) + (rw.crystals[g] || 0);
    });
  }
  ensureChapterRewardsState();
  state.questProgress.chapterRewards[zoneId] = true;
  save();
  if ($("#adena")) $("#adena").textContent = fmt(state.adena);
  if (!opts.silent && typeof gameLog === "function") {
    const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : { name: zoneId };
    gameLog("Награда главы «" + (view.name || zoneId) + "»: +" + fmtAdena(adena) + " adena", "success");
  }
  return { adena, rw };
}

function chapterRewardBodyHtml(zoneId) {
  const rw = zoneChapterRewardDef(zoneId);
  const boss = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : { name: "Босс" };
  const parts = [];
  parts.push("<p><b>☠ " + boss.name + "</b> повержен. Путь дальше открыт.</p>");
  (rw.lines || []).forEach((ln) => parts.push("<p>" + ln + "</p>"));
  parts.push('<div class="chapter-reward-loot">');
  parts.push("<p><b>Награда:</b></p><ul>");
  if (rw.adena) parts.push("<li>+" + fmtAdena(typeof playtestIncome === "function" ? playtestIncome(rw.adena) : rw.adena) + " adena</li>");
  if (rw.soul) parts.push("<li>Soul Ore ×" + fmt(rw.soul) + "</li>");
  if (rw.spirit) parts.push("<li>Spirit Ore ×" + fmt(rw.spirit) + "</li>");
  if (rw.crystals) {
    Object.keys(rw.crystals).forEach((g) => {
      if (rw.crystals[g]) parts.push("<li>Кристалл " + g + " ×" + rw.crystals[g] + "</li>");
    });
  }
  parts.push("</ul></div>");
  return parts.join("");
}

function showChapterRewardModal(zoneId) {
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) {
    applyChapterReward(zoneId);
    return;
  }
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : { name: zoneId, storyTag: "" };
  if (typeof renderStoryPanel === "function") {
    renderStoryPanel({
      title: "Глава завершена",
      eyebrow: view.storyTag || view.name,
      lead: "Награда за прохождение локации",
      chapter: view.storyTag || "",
      icon: typeof uiZoneChipIcon === "function" ? uiZoneChipIcon(zoneId, state.avatar?.raceId) : view.icon,
      bodyHtml: chapterRewardBodyHtml(zoneId),
      cta: "Принять награду",
    });
  }
  backdrop.dataset.storyMode = "chapter_reward";
  backdrop.dataset.zoneId = zoneId;
  backdrop.className =
    "story-backdrop race-" + (state.avatar?.raceId || "human") +
    " story-zone-" + zoneId + " story-chapter-reward";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function grantChapterReward(zoneId, opts) {
  opts = opts || {};
  if (!zoneId || isChapterRewardClaimed(zoneId)) return false;
  if (opts.silent) {
    applyChapterReward(zoneId, { silent: true });
    return true;
  }
  showChapterRewardModal(zoneId);
  return true;
}

function dismissChapterReward() {
  const backdrop = document.getElementById("storyBackdrop");
  const zoneId = backdrop?.dataset.zoneId;
  if (zoneId && !isChapterRewardClaimed(zoneId)) applyChapterReward(zoneId);
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    delete backdrop.dataset.zoneId;
    backdrop.hidden = true;
  }
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (zoneId && typeof toast === "function") {
    const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : { name: zoneId };
    toast("Награда главы «" + (view.name || zoneId) + "» получена", "success");
  }
  if (typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderQuestJournal === "function") renderQuestJournal();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof tryTriggerPreludeFinale === "function") tryTriggerPreludeFinale();
}

function migrateChapterRewards() {
  if (!state.avatar?.created) return;
  FARM_ZONES.forEach((z) => {
    if (!z.active) return;
    if (typeof isZoneChapterComplete === "function" && isZoneChapterComplete(z.id) && !isChapterRewardClaimed(z.id)) {
      grantChapterReward(z.id, { silent: true });
    }
  });
}

function questJournalProgressSummary() {
  if (!state.avatar?.created) return "Создай персонажа";
  let done = 0;
  let active = null;
  FARM_ZONES.forEach((z) => {
    if (!z.active) return;
    if (typeof isZoneChapterComplete === "function" && isZoneChapterComplete(z.id)) done++;
    else if (!active && typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) active = z;
  });
  if (active) {
    const q = typeof activeZoneQuest === "function" ? activeZoneQuest(active.id) : null;
    if (typeof isZoneBossPending === "function" && isZoneBossPending(active.id)) return "☠ босс · " + (zoneRaceView(active.id).name || "");
    if (q) return "Гл." + active.chapter + " · " + q.step + "/" + QUESTS_PER_ZONE;
    return "Гл." + active.chapter + " · готово";
  }
  return done + "/" + FARM_ZONES.filter((z) => z.active).length + " глав";
}

function questStepStatusHtml(def) {
  if (!def) return "";
  const lootShort =
    typeof formatQuestStepLootShort === "function"
      ? formatQuestStepLootShort(def.zoneId, def.step)
      : "";
  if (isQuestStepComplete(def.id)) {
    return (
      '<span class="qj-status done">✓</span>' +
      (lootShort ? '<span class="qj-step-loot claimed" title="Награда получена">' + lootShort + "</span>" : "")
    );
  }
  const kills = questKillsDone(def.id);
  const need = def.kills;
  let obj = kills + "/" + need;
  if (def.goldenKills) obj += " · ★" + questGoldenKillsDone(def.id) + "/" + def.goldenKills;
  const pct = Math.min(100, Math.round((kills / Math.max(1, need)) * 100));
  return (
    '<span class="qj-status active">' + obj + "</span>" +
    '<span class="qj-step-bar"><i style="width:' + pct + '%"></i></span>' +
    (lootShort ? '<span class="qj-step-loot" title="Награда за шаг">' + lootShort + "</span>" : "")
  );
}

function renderQuestJournal() {
  const list = document.getElementById("questJournalList");
  const meta = document.getElementById("questJournalMetaHead");
  if (!list) return;
  if (!state.avatar?.created) {
    list.innerHTML = '<p class="quest-journal-empty">Создай персонажа — журнал откроется с первой главой.</p>';
    if (meta) meta.textContent = "";
    return;
  }
  if (meta) meta.textContent = questJournalProgressSummary();
  list.innerHTML = "";
  FARM_ZONES.forEach((zone) => {
    if (!zone.active) return;
    const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;
    const st = typeof farmZoneStatus === "function" ? farmZoneStatus(zone) : { ok: true };
    const complete = typeof isZoneChapterComplete === "function" && isZoneChapterComplete(zone.id);
    const bossPending = typeof isZoneBossPending === "function" && isZoneBossPending(zone.id);
    const rewardOk = isChapterRewardClaimed(zone.id);
    const card = document.createElement("article");
    card.className = "qj-chapter" + (complete ? " complete" : "") + (state.farmZone === zone.id ? " current" : "") + (!st.ok ? " locked" : "");
    const head = document.createElement("div");
    head.className = "qj-chapter-head";
    head.innerHTML =
      '<img class="qj-chapter-icon" src="' + (typeof uiZoneChipIcon === "function" ? uiZoneChipIcon(zone.id, state.avatar?.raceId) : (view.icon || zone.icon)) + '" alt="">' +
      '<div class="qj-chapter-titles">' +
      '<b>' + (view.storyTag || zone.storyTag) + "</b>" +
      "<span>" + (view.name || zone.name) + "</span>" +
      "</div>" +
      '<span class="qj-chapter-badge">' + (complete ? (rewardOk ? "✓ награда" : "✓") : bossPending ? "☠ босс" : st.ok ? "активна" : "🔒") + "</span>";
    card.appendChild(head);
    const steps = typeof zoneQuestSteps === "function" ? zoneQuestSteps(zone.id) : [];
    const stepsEl = document.createElement("div");
    stepsEl.className = "qj-steps";
    steps.forEach((def, i) => {
      const row = document.createElement("div");
      row.className = "qj-step" + (isQuestStepComplete(def.id) ? " done" : activeZoneQuest(zone.id)?.id === def.id ? " current" : "");
      row.innerHTML =
        '<span class="qj-step-n">' + (i + 1) + ".</span>" +
        '<span class="qj-step-title">' + def.title.split(" · ").pop() + "</span>" +
        questStepStatusHtml(def);
      stepsEl.appendChild(row);
    });
    const boss = typeof zoneBossDef === "function" ? zoneBossDef(zone.id) : { name: "Босс" };
    const bossRow = document.createElement("div");
    bossRow.className = "qj-step qj-boss" + (complete ? " done" : bossPending ? " current" : "");
    bossRow.innerHTML =
      '<span class="qj-step-n">☠</span>' +
      '<span class="qj-step-title">' + boss.name + "</span>" +
      '<span class="qj-status">' + (complete ? "✓" : bossPending ? "на поле" : "—") + "</span>";
    stepsEl.appendChild(bossRow);
    card.appendChild(stepsEl);
    const actions = document.createElement("div");
    actions.className = "qj-actions";
    if (st.ok) {
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "btn btn-primary btn-sm";
      playBtn.textContent = complete ? "На поле" : bossPending ? "К боссу" : "На поле";
      playBtn.onclick = () => {
        Audio2.click();
        if (typeof selectFarmZone === "function") selectFarmZone(zone.id);
        if (typeof openMine === "function") openMine();
      };
      actions.appendChild(playBtn);
      if (!complete) {
        const briefBtn = document.createElement("button");
        briefBtn.type = "button";
        briefBtn.className = "btn btn-ghost btn-sm";
        briefBtn.textContent = "Брифинг";
        briefBtn.onclick = () => {
          Audio2.click();
          if (typeof selectFarmZone === "function") selectFarmZone(zone.id);
          if (typeof showQuestBriefing === "function") showQuestBriefing(zone.id, { cta: "На поле" });
        };
        actions.appendChild(briefBtn);
      }
    } else {
      const lock = document.createElement("span");
      lock.className = "qj-locked";
      lock.textContent = typeof farmZoneLockHint === "function" ? farmZoneLockHint(zone) : "Закрыто";
      actions.appendChild(lock);
    }
    card.appendChild(actions);
    list.appendChild(card);
  });
}

function openQuestJournal() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
    toast("Сначала создай персонажа", "warn");
    if (typeof maybeShowAvatarSetup === "function") maybeShowAvatarSetup();
    return;
  }
  renderQuestJournal();
  show("quests");
  Audio2.open();
}

function goQuestJournal() {
  renderQuestJournal();
  renderMenu();
  show("quests");
}

function wireQuestJournal() {
  const doc = typeof gameDoc === "function" ? gameDoc() : document;
  const tile = doc.getElementById("questTile");
  if (tile && !tile.dataset.wired) {
    tile.dataset.wired = "1";
    tile.onclick = () => openQuestJournal();
  }
}
