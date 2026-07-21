// ===== Квесты: UI (брифинги, HUD, панели) =====
// Логика прогресса и боссов вынесена в quest-core.js.

function questBodyHtml(def) {
  const parts = [];
  parts.push('<p class="quest-npc-greet"><b>' + def.npc.name + "</b> говорит <small>(" + def.step + "/" + def.stepsTotal + ")</small>:</p>");
  parts.push("<p><em>«" + def.greet + "»</em></p>");
  if (def.questRef) parts.push('<p class="quest-ref-line">Квест Prelude: <b>' + def.questRef + "</b></p>");
  let obj = "Уничтожить <b>" + def.kills + "</b> " + def.targets;
  if (def.goldenKills) obj += " и <b>" + def.goldenKills + "</b> элитных целей (золотых)";
  obj += ". У врагов есть <b>HP</b> — урон зависит от силы.";
  parts.push("<p>Цель: " + obj + "</p>");
  if (typeof formatQuestStepLootLines === "function") {
    const lootLines = formatQuestStepLootLines(def.zoneId, def.step);
    if (lootLines.length) {
      parts.push('<div class="quest-step-loot"><p><b>Награда за шаг:</b></p><ul>');
      lootLines.forEach((ln) => parts.push("<li>" + ln + "</li>"));
      parts.push("</ul></div>");
    }
  }
  if (def.step === def.stepsTotal) {
    parts.push("<p><b>После этого поручения</b> на поле явится босс локации.</p>");
  }
  return parts.join("");
}

function showQuestBriefingForQuest(def, opts) {
  opts = opts || {};
  if (!def || isQuestStepComplete(def.id)) {
    if (opts.resumeMine && typeof openMine === "function") openMine();
    return;
  }
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) return;
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) {
    backdrop.dataset.pendingQuestBriefing = def.id;
    backdrop.dataset.pendingQuestZone = def.zoneId;
    return;
  }
  const view = typeof zoneRaceView === "function" ? zoneRaceView(def.zoneId) : null;
  if (typeof renderStoryPanel === "function") {
    renderStoryPanel({
      title: def.title,
      eyebrow: def.eyebrow,
      lead: def.npc.name + " · поручение " + def.step + "/" + def.stepsTotal,
      questRef: def.questRef,
      chapter: view?.storyTag || "",
      icon: def.npc.icon,
      bodyHtml: questBodyHtml(def),
      cta: opts.cta || "Принять поручение",
    });
  }
  backdrop.dataset.storyMode = "quest";
  backdrop.dataset.questId = def.id;
  backdrop.dataset.zoneId = def.zoneId;
  backdrop.className = "story-backdrop race-" + (state.avatar?.raceId || "human") + " story-zone-" + def.zoneId + " story-quest";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function showQuestBriefing(zoneId, opts) {
  const def = activeZoneQuest(zoneId);
  if (!def) return;
  showQuestBriefingForQuest(def, opts);
}

function dismissQuestBriefing() {
  const backdrop = document.getElementById("storyBackdrop");
  const questId = backdrop?.dataset.questId;
  if (questId) acceptZoneQuest(questId);
  const reopenMine = !!window._pendingMineAfterQuest;
  window._pendingMineAfterQuest = false;
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    delete backdrop.dataset.questId;
    delete backdrop.dataset.zoneId;
    backdrop.hidden = true;
  }
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  if (typeof flushPendingQuestBriefing === "function") flushPendingQuestBriefing();
  if (reopenMine && typeof openMine === "function") setTimeout(() => openMine(), 120);
}

function flushPendingQuestBriefing() {
  const backdrop = document.getElementById("storyBackdrop");
  const questId = backdrop?.dataset.pendingQuestBriefing;
  if (!questId) return;
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return;
  const zoneId = backdrop.dataset.pendingQuestZone || "banana_mine";
  delete backdrop.dataset.pendingQuestBriefing;
  delete backdrop.dataset.pendingQuestZone;
  const def = activeZoneQuest(zoneId);
  if (!def || def.id !== questId || isQuestStepComplete(def.id)) return;
  setTimeout(() => showQuestBriefingForQuest(def, {}), 280);
}

function maybeShowQuestBriefing(zoneId, opts) {
  if (!state.avatar?.created) return;
  const def = activeZoneQuest(zoneId);
  if (!def || isQuestStepComplete(def.id)) return;
  if (questBriefingSeen(def.id) && questKillsDone(def.id) > 0) return;
  setTimeout(() => showQuestBriefingForQuest(def, opts || {}), opts?.delay || 280);
}

function requestMineWithQuestBriefing(zoneId) {
  const def = activeZoneQuest(zoneId);
  if (def && !questBriefingSeen(def.id)) {
    window._pendingMineAfterQuest = true;
    showQuestBriefingForQuest(def, { cta: "В бой" });
    return true;
  }
  return false;
}

function renderMineQuestHud() {
  const el = document.getElementById("mineQuestHud");
  if (!el) return;
  const zoneId = state.farmZone || "banana_mine";
  if (isZoneBossPending(zoneId)) {
    const boss = zoneBossDef(zoneId);
    const grind = zoneBossGrindKills(zoneId);
    const need = zoneBossGrindKillsNeeded();
    el.hidden = false;
    el.className = "mine-quest-hud mine-quest-boss";
    const obj = isZoneBossQueued(zoneId)
      ? "Босс скоро на поле — не готов? Выйди и качай силу"
      : "Качайся на поле · до босса " + grind + "/" + need;
    el.innerHTML =
      '<span class="mine-quest-npc">☠ ' + boss.name +
      '</span><span class="mine-quest-obj">' + obj + " — победа откроет следующую главу</span>";
    return;
  }
  el.className = "mine-quest-hud";
  const def = activeZoneQuest(zoneId);
  if (!def) {
    el.hidden = true;
    return;
  }
  const done = questKillsDone(def.id);
  const pct = Math.min(100, Math.round((done / def.kills) * 100));
  let obj = def.step + "/" + QUESTS_PER_ZONE + " · " + done + "/" + def.kills;
  if (def.goldenKills) obj += " · ★" + questGoldenKillsDone(def.id) + "/" + def.goldenKills;
  el.hidden = false;
  el.innerHTML =
    '<span class="mine-quest-npc">' + def.npc.name +
    '</span><span class="mine-quest-obj">' + obj + " · " + def.targets +
    '</span><span class="mine-quest-bar"><i style="width:' + pct + '%"></i></span>';
}

/** @deprecated совместимость */
function isQuestComplete(zoneId) {
  return isZoneChapterComplete(zoneId);
}

function isPrevZoneQuestComplete(zone) {
  return isPrevZoneChapterComplete(zone);
}

function refreshQuestUi(zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  if (typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  if (typeof renderMineStoryBar === "function") renderMineStoryBar(zoneId);
  if (typeof renderQuestJournal === "function") renderQuestJournal();
}

function devCompleteActiveQuestStep() {
  if (!FEATURE_DEV_PANEL) return false;
  const zoneId = state.farmZone || "banana_mine";
  const def = activeZoneQuest(zoneId);
  if (!def) {
    if (typeof toast === "function") toast("Нет активного поручения в этой зоне", "warn");
    return false;
  }
  if (isQuestStepComplete(def.id)) {
    if (typeof toast === "function") toast("Шаг уже выполнен", "warn");
    return false;
  }
  markQuestStepComplete(def.id);
  const next = activeZoneQuest(zoneId);
  if (next) {
    if (typeof toast === "function") toast("Dev: ✓ " + def.step + "/" + QUESTS_PER_ZONE + " — дальше " + next.step, "success");
  } else if (isZoneBossPending(zoneId)) {
    const boss = zoneBossDef(zoneId);
    if (typeof toast === "function") toast("Dev: ☠ босс — " + boss.name, "warn");
  }
  refreshQuestUi(zoneId);
  save();
  return true;
}

function devCompleteZoneQuestSteps(zoneId, opts) {
  if (!FEATURE_DEV_PANEL) return false;
  opts = opts || {};
  ensureQuestProgress();
  const steps = zoneQuestSteps(zoneId);
  if (!steps.length) return false;
  steps.forEach((q) => markQuestStepComplete(q.id));
  if (!opts.silent) refreshQuestUi(zoneId);
  if (!opts.silent) save();
  if (!opts.silent && typeof toast === "function") {
    const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : { name: zoneId };
    toast("Dev: поручения «" + (view.name || zoneId) + "» закрыты", "success");
  }
  return true;
}

function devCompleteZoneChapter(zoneId) {
  if (!FEATURE_DEV_PANEL) return false;
  ensureQuestProgress();
  devCompleteZoneQuestSteps(zoneId, { silent: true });
  if (!isZoneBossDefeated(zoneId)) {
    markZoneBossDefeated(zoneId);
    if (typeof grantChapterReward === "function") grantChapterReward(zoneId);
    const boss = zoneBossDef(zoneId);
    const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : { name: zoneId };
    if (typeof gameLog === "function") gameLog("Dev: " + view.name + " — " + boss.name + " повержен", "system");
    if (typeof toast === "function") toast("Dev: глава «" + (view.name || zoneId) + "» завершена", "success");
  } else if (typeof toast === "function") {
    const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : { name: zoneId };
    toast("Dev: «" + (view.name || zoneId) + "» уже завершена", "warn");
  }
  refreshQuestUi(zoneId);
  save();
  return true;
}
