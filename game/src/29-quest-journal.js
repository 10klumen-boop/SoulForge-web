// ===== Журнал квестов: UI (модал награды главы, рендер журнала) =====
// Core logic (zoneQuestStepRewardDef, applyQuestStepReward, applyChapterReward, grantChapterReward)
// вынесено в quest-journal-core.js.

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
      '<span class="qj-status">' + (complete ? "✓" : bossPending
        ? (typeof isZoneBossQueued === "function" && isZoneBossQueued(zone.id)
          ? "скоро"
          : (typeof zoneBossGrindKills === "function"
            ? zoneBossGrindKills(zone.id) + "/" + (typeof zoneBossGrindKillsNeeded === "function" ? zoneBossGrindKillsNeeded() : 12)
            : "качайся"))
        : "—") + "</span>";
    stepsEl.appendChild(bossRow);
    card.appendChild(stepsEl);
    const actions = document.createElement("div");
    actions.className = "qj-actions";
    if (st.ok) {
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "btn btn-primary btn-sm";
      playBtn.textContent = complete ? "На поле" : bossPending ? "Качаться" : "На поле";
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
