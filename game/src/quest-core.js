// ===== РљРІРµСЃС‚С‹: core logic (РїСЂРѕРіСЂРµСЃСЃ, Р±РѕСЃСЃС‹, СѓР±РёР№СЃС‚РІР°) =====
// Р’С‹РЅРµСЃРµРЅРѕ РёР· 27-quests.js; UI РѕСЃС‚Р°Р»РѕСЃСЊ РІ 27-quests.js.
// Р”Р°РЅРЅС‹Рµ РєРІРµСЃС‚РѕРІ РІ data/quest-data.js.

// ===== Prelude: С†РµРїРѕС‡РєРё РєРІРµСЃС‚РѕРІ, Р±РѕСЃСЃС‹ Р»РѕРєР°С†РёР№, РїСЂРѕРіСЂРµСЃСЃ =====
// Р”Р°РЅРЅС‹Рµ РєРІРµСЃС‚РѕРІ РІС‹РЅРµСЃРµРЅС‹ РІ data/quest-data.js (QUEST_NPC_BY_RACE_ZONE, ZONE_BOSSES,
// QUEST_STEP_FLAVOR, QUESTS_PER_ZONE, ZONE_BOSS_GRIND_KILLS, zoneQuestKillTargets, zoneQuestGoldenTarget).


function questStepId(zoneId, step) {
  return "quest_" + zoneId + "_" + step;
}

function ensureQuestProgress() {
  if (!state.questProgress || typeof state.questProgress !== "object") {
    ProgressStore.set("questProgress", { completed: {}, kills: {}, goldenKills: {}, bosses: {}, briefings: {}, chapterRewards: {}, stepRewards: {}, bossQueued: {}, bossGrind: {} });
  }
  const q = state.questProgress;
  if (!q.completed) q.completed = {};
  if (!q.kills) q.kills = {};
  if (!q.goldenKills) q.goldenKills = {};
  if (!q.bosses) q.bosses = {};
  if (!q.briefings) q.briefings = {};
  if (!q.chapterRewards) q.chapterRewards = {};
  if (!q.stepRewards) q.stepRewards = {};
  if (!q.bossQueued) q.bossQueued = {};
  if (!q.bossGrind) q.bossGrind = {};
}

function prevFarmZone(zone) {
  zone = typeof zone === "string" ? farmZoneById(zone) : zone;
  const i = FARM_ZONES.findIndex((z) => z.id === zone.id);
  if (i <= 0) return null;
  // Side-Р·РѕРЅС‹ (mithril_forge Рё С‚.Рї.) РЅРµ РІС…РѕРґСЏС‚ РІ РѕСЃРЅРѕРІРЅСѓСЋ С†РµРїРѕС‡РєСѓ РіР»Р°РІ.
  for (let j = i - 1; j >= 0; j--) {
    const z = FARM_ZONES[j];
    if (z && (z.side || z.party)) continue;
    return z;
  }
  return null;
}

function questNpc(zoneId, race) {
  race = race || (typeof currentAvatarRace === "function" ? currentAvatarRace() : state.avatar?.raceId) || "human";
  const base = QUEST_NPC_BY_RACE_ZONE[race]?.[zoneId] || QUEST_NPC_BY_RACE_ZONE.human?.[zoneId] || {
    name: "РЎС‚СЂР°РЅРЅРёРє", role: "Prelude", icon: UI_QUEST_ICON, greet: "Р’С‹РїРѕР»РЅРё РїРѕСЂСѓС‡РµРЅРёРµ РЅР° РїРѕР»Рµ.",
  };
  const icon = typeof uiQuestNpcIcon === "function" ? uiQuestNpcIcon(race, zoneId) : base.icon;
  return icon === base.icon ? base : Object.assign({}, base, { icon });
}

function zoneBossDef(zoneId) {
  return ZONE_BOSSES[zoneId] || { name: "РҐРѕР·СЏРёРЅ Р·РµРјР»Рё", mob: "relic-werewolf", hpMult: 14, rewardMult: 2.5 };
}

function questStepDef(questId) {
  for (const zone of FARM_ZONES) {
    if (!zone.active) continue;
    const steps = zoneQuestSteps(zone.id);
    const found = steps.find((s) => s.id === questId);
    if (found) return found;
  }
  return null;
}

function zoneQuestSteps(zoneId, race) {
  const zone = farmZoneById(zoneId);
  if (!zone) return [];
  // Side-С„Р°СЂРј (РєСѓР·РЅРёС†Р° РјРёС„СЂРёР»Р° Рё С‚.Рї.) вЂ” С‚РѕР»СЊРєРѕ РґСЂРѕРї, Р±РµР· РїРѕСЂСѓС‡РµРЅРёР№ Prelude.
  if ((zone.side || zone.party)) return [];
  const npc = questNpc(zoneId, race);
  const beat = typeof zoneStoryBeat === "function" ? zoneStoryBeat(zoneId, race) : {};
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId, race) : zone;
  const kills = zoneQuestKillTargets(zone.chapter);
  const goldenNeed = zoneQuestGoldenTarget(zone.chapter);
  const stepTitles = ["Р—Р°С‡РёСЃС‚РєР° РїРѕР»СЏ", "РћС…РѕС‚Р° РЅР° СЌР»РёС‚Сѓ", "Р¤РёРЅР°Р»СЊРЅРѕРµ РїРѕСЂСѓС‡РµРЅРёРµ"];
  const steps = [];
  for (let i = 0; i < QUESTS_PER_ZONE; i++) {
    const step = i + 1;
    steps.push({
      id: questStepId(zoneId, step),
      zoneId,
      step,
      stepsTotal: QUESTS_PER_ZONE,
      chapter: zone.chapter,
      title: (view.story?.title || view.name) + " В· " + stepTitles[i],
      npc,
      questRef: beat.questRef || "",
      targets: beat.targets || "РІСЂР°РіРё РЅР° РїРѕР»Рµ",
      kills: kills[i],
      goldenKills: step === 2 ? goldenNeed : 0,
      eyebrow: npc.role + " В· " + step + "/" + QUESTS_PER_ZONE,
      greet: npc.greet + " " + QUEST_STEP_FLAVOR[i],
    });
  }
  return steps;
}

function isQuestStepComplete(questId) {
  ensureQuestProgress();
  return !!state.questProgress.completed[questId];
}

function questKillsDone(questId) {
  ensureQuestProgress();
  return state.questProgress.kills[questId] || 0;
}

function questGoldenKillsDone(questId) {
  ensureQuestProgress();
  return state.questProgress.goldenKills[questId] || 0;
}

function isQuestStepObjectivesMet(def) {
  if (!def) return false;
  const killsOk = questKillsDone(def.id) >= def.kills;
  const goldenOk = !def.goldenKills || questGoldenKillsDone(def.id) >= def.goldenKills;
  return killsOk && goldenOk;
}

function allZoneQuestsComplete(zoneId) {
  return zoneQuestSteps(zoneId).every((q) => isQuestStepComplete(q.id) && isQuestStepObjectivesMet(q));
}

function isZoneBossDefeated(zoneId) {
  ensureQuestProgress();
  return !!state.questProgress.bosses[zoneId];
}

function isZoneBossPending(zoneId) {
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  if ((zone?.side || zone?.party)) return false;
  return allZoneQuestsComplete(zoneId) && !isZoneBossDefeated(zoneId);
}

function zoneBossGrindKills(zoneId) {
  ensureQuestProgress();
  return Math.max(0, Math.floor(Number(state.questProgress.bossGrind?.[zoneId]) || 0));
}

function zoneBossGrindKillsNeeded() {
  return ZONE_BOSS_GRIND_KILLS;
}

function resetZoneBossGrind(zoneId) {
  ensureQuestProgress();
  ProgressStore.update("questProgress", (q) => {
    const next = { ...(q || {}) };
    if (!next.bossGrind) next.bossGrind = {};
    next.bossGrind[zoneId] = 0;
    return next;
  });
}

function addZoneBossGrindKill(zoneId) {
  ensureQuestProgress();
  ProgressStore.update("questProgress", (q) => {
    const next = { ...(q || {}) };
    if (!next.bossGrind) next.bossGrind = {};
    next.bossGrind[zoneId] = zoneBossGrindKills(zoneId) + 1;
    return next;
  });
}

function isZoneBossQueued(zoneId) {
  ensureQuestProgress();
  return !!state.questProgress.bossQueued?.[zoneId];
}

function setZoneBossQueued(zoneId, queued) {
  ensureQuestProgress();
  ProgressStore.update("questProgress", (q) => {
    const next = { ...(q || {}) };
    if (!next.bossQueued) next.bossQueued = {};
    if (queued) next.bossQueued[zoneId] = true;
    else delete next.bossQueued[zoneId];
    return next;
  });
}

/** Р‘РѕСЃСЃ СЏРІРёС‚СЃСЏ РЅР° РїРѕР»Рµ (РїРµСЂРІС‹Р№ СЂР°Р· РїРѕСЃР»Рµ РєРІРµСЃС‚РѕРІ РёР»Рё РїРѕСЃР»Рµ N Р·Р°С‡РёСЃС‚РѕРє). */
function shouldOfferZoneBoss(zoneId) {
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  if ((zone?.side || zone?.party)) return false;
  if (!isZoneBossPending(zoneId)) return false;
  return isZoneBossQueued(zoneId) || zoneBossGrindKills(zoneId) >= ZONE_BOSS_GRIND_KILLS;
}

function markZoneBossOffered(zoneId) {
  setZoneBossQueued(zoneId, false);
  resetZoneBossGrind(zoneId);
}

function queueZoneBossSpawn(zoneId) {
  if (!isZoneBossPending(zoneId)) return;
  setZoneBossQueued(zoneId, true);
  resetZoneBossGrind(zoneId);
}

function isZoneChapterComplete(zoneId) {
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  // Side-С„Р°СЂРј РЅРµ РёРјРµРµС‚ РіР»Р°РІС‹/Р±РѕСЃСЃР° вЂ” В«Р·Р°РІРµСЂС€С‘РЅВ» СЃ С‚РѕС‡РєРё Р·СЂРµРЅРёСЏ С†РµРїРѕС‡РєРё.
  if ((zone?.side || zone?.party)) return true;
  return allZoneQuestsComplete(zoneId) && isZoneBossDefeated(zoneId);
}

function isPrevZoneChapterComplete(zone) {
  zone = typeof zone === "string" ? farmZoneById(zone) : zone;
  // Side-С„Р°СЂРј РІРЅРµ СЃСЋР¶РµС‚РЅРѕР№ С†РµРїРѕС‡РєРё вЂ” С‚РѕР»СЊРєРѕ СЃРёР»Р°/СѓСЂРѕРІРµРЅСЊ.
  if ((zone?.side || zone?.party)) return true;
  const prev = prevFarmZone(zone);
  if (!prev) return true;
  return isZoneChapterComplete(prev.id);
}

function activeZoneQuest(zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const steps = zoneQuestSteps(zoneId);
  for (const q of steps) {
    if (!isQuestStepComplete(q.id)) return q;
  }
  return null;
}

function markQuestStepComplete(questId) {
  ensureQuestProgress();
  const def = questStepDef(questId);
  ProgressStore.update("questProgress", (q) => {
    const next = { ...(q || {}) };
    next.completed = { ...next.completed, [questId]: true };
    if (def) {
      next.kills = { ...next.kills, [questId]: def.kills };
      if (def.goldenKills) {
        next.goldenKills = { ...next.goldenKills, [questId]: def.goldenKills };
      }
    }
    return next;
  });
}

function markZoneBossDefeated(zoneId) {
  ensureQuestProgress();
  ProgressStore.update("questProgress", (q) => ({ ...(q || {}), bosses: { ...(q?.bosses || {}), [zoneId]: true } }));
  setZoneBossQueued(zoneId, false);
  resetZoneBossGrind(zoneId);
}

function questBriefingSeen(questId) {
  ensureQuestProgress();
  return !!state.questProgress.briefings[questId];
}

function markQuestBriefingSeen(questId) {
  ensureQuestProgress();
  ProgressStore.update("questProgress", (q) => ({ ...(q || {}), briefings: { ...(q?.briefings || {}), [questId]: true } }));
}

function acceptZoneQuest(questId) {
  ensureQuestProgress();
  if (state.questProgress.completed[questId]) return;
  ProgressStore.update("questProgress", (q) => {
    const next = { ...(q || {}) };
    if (next.kills?.[questId] == null) next.kills = { ...next.kills, [questId]: 0 };
    if (next.goldenKills?.[questId] == null) next.goldenKills = { ...next.goldenKills, [questId]: 0 };
    next.briefings = { ...next.briefings, [questId]: true };
    return next;
  });
  save();
}

function onQuestMobKill(zoneId, mobType) {
  if (!zoneId) return false;
  const def = activeZoneQuest(zoneId);
  if (!def || isQuestStepComplete(def.id)) return false;
  ensureQuestProgress();
  const isGolden = mobType === "golden" || mobType === "boss";
  ProgressStore.update("questProgress", (q) => {
    const next = { ...(q || {}) };
    if (def.goldenKills > 0) {
      if (isGolden) {
        const g = next.goldenKills?.[def.id] || 0;
        if (g < def.goldenKills) next.goldenKills = { ...next.goldenKills, [def.id]: g + 1 };
      }
      const k = next.kills?.[def.id] || 0;
      if (k < def.kills) next.kills = { ...next.kills, [def.id]: k + 1 };
    } else {
      const cur = next.kills?.[def.id] || 0;
      if (cur < def.kills) next.kills = { ...next.kills, [def.id]: cur + 1 };
    }
    return next;
  });
  const done = isQuestStepObjectivesMet(def);
  if (done) {
    markQuestStepComplete(def.id);
    const loot =
      typeof grantQuestStepReward === "function"
        ? grantQuestStepReward(zoneId, def.step, def.id)
        : null;
    const lootBit = loot?.summary ? " В· " + loot.summary : "";
    const next = activeZoneQuest(zoneId);
    if (next) {
      if (typeof gameLog === "function") {
        gameLog(def.title + " вЂ” РІС‹РїРѕР»РЅРµРЅРѕ" + (loot?.summary ? " (" + loot.summary + ")" : "") + ". РЎР»РµРґСѓСЋС‰РµРµ: " + next.step + "/" + QUESTS_PER_ZONE, "success");
      }
      if (typeof toast === "function") {
        toast("вњ“ РџРѕСЂСѓС‡РµРЅРёРµ " + def.step + "/" + QUESTS_PER_ZONE + lootBit, "success");
      }
    } else {
      const boss = zoneBossDef(zoneId);
      queueZoneBossSpawn(zoneId);
      if (typeof gameLog === "function") {
        gameLog("Р’СЃРµ РїРѕСЂСѓС‡РµРЅРёСЏ РІС‹РїРѕР»РЅРµРЅС‹" + (loot?.summary ? " (" + loot.summary + ")" : "") + " вЂ” РЅР° РїРѕР»Рµ СЏРІРёС‚СЃСЏ " + boss.name + ". РќРµ РіРѕС‚РѕРІ вЂ” РІС‹С…РѕРґРё РєР°С‡Р°С‚СЊ СЃРёР»Сѓ", "success");
      }
      if (typeof toast === "function") {
        toast("в  Р‘РѕСЃСЃ: " + boss.name + lootBit, "warn");
      }
    }
    if (typeof noteLeaderboardEvent === "function") noteLeaderboardEvent("snapshot");
    if (typeof logCharacterEvent === "function") {
      logCharacterEvent("quest_step", {
        zoneId,
        questId: def.id,
        step: def.step,
        title: def.title,
        loot: loot?.summary || null,
      });
    }
    if (typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
    if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
    if (typeof renderStoryArcBar === "function") renderStoryArcBar();
    if (typeof renderQuestJournal === "function") renderQuestJournal();
    if (typeof checkAchievements === "function") checkAchievements();
  }
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  if (typeof renderMineStoryBar === "function") renderMineStoryBar(zoneId);
  save();
  return done;
}

function onZoneBossDefeated(zoneId) {
  if (!zoneId || isZoneBossDefeated(zoneId)) return;
  markZoneBossDefeated(zoneId);
  const boss = zoneBossDef(zoneId);
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : { name: zoneId };
  if (typeof gameLog === "function") gameLog(view.name + ": " + boss.name + " РїРѕРІРµСЂР¶РµРЅ вЂ” РїСѓС‚СЊ РґР°Р»СЊС€Рµ РѕС‚РєСЂС‹С‚", "success");
  if (typeof toast === "function") toast("в  " + boss.name + " РїРѕРІРµСЂР¶РµРЅ! Р“Р»Р°РІР° Р·Р°РІРµСЂС€РµРЅР°.", "success");
  if (typeof grantChapterReward === "function") grantChapterReward(zoneId);
  if (typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  if (typeof renderQuestJournal === "function") renderQuestJournal();
  save();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("quest_boss", {
      zoneId,
      bossId: boss?.id || null,
      bossName: boss?.name || null,
    });
  }
  if (typeof checkAchievements === "function") checkAchievements();
}

function questStatusText(zone) {
  zone = typeof zone === "string" ? farmZoneById(zone) : zone;
  if (!zone) return "";
  if (isZoneChapterComplete(zone.id)) return "РіР»Р°РІР° вњ“";
  const prev = prevFarmZone(zone);
  if (prev && !isZoneChapterComplete(prev.id)) {
    const pv = typeof zoneRaceView === "function" ? zoneRaceView(prev) : prev;
    return "РіР»Р°РІР°: " + (pv.name || "вЂ¦") + " вњ—";
  }
  if (isZoneBossPending(zone.id)) return "в  Р±РѕСЃСЃ";
  const def = activeZoneQuest(zone.id);
  if (!def) return "";
  const done = questKillsDone(def.id);
  if (def.goldenKills) {
    const g = questGoldenKillsDone(def.id);
    return def.step + "/" + QUESTS_PER_ZONE + " В· " + done + "/" + def.kills + " В· в…" + g + "/" + def.goldenKills;
  }
  return def.step + "/" + QUESTS_PER_ZONE + " В· " + done + "/" + def.kills;
}

function migrateQuestProgress() {
  if (!state.avatar?.created) return;
  ensureQuestProgress();
  const power = avatarFarmPower();
  const lvl = state.avatar.level || 1;
  let maxIdx = 0;
  FARM_ZONES.forEach((zone, i) => {
    if (!zone.active) return;
    if (power >= zone.reqPower && lvl >= zone.reqLevel) maxIdx = i;
  });
  if (!state.questProgress._migratedV2) {
    for (let i = 0; i < maxIdx; i++) {
      const z = FARM_ZONES[i];
      if (!z || (z.side || z.party)) continue;
      const zid = z.id;
      zoneQuestSteps(zid).forEach((q) => {
        markQuestStepComplete(q.id);
        markQuestBriefingSeen(q.id);
      });
      markZoneBossDefeated(zid);
    }
    FARM_ZONES.forEach((zone, i) => {
      if ((zone.side || zone.party)) return;
      const legacyKey = "quest_" + zone.id;
      if (state.questProgress.completed[legacyKey]) {
        zoneQuestSteps(zone.id).forEach((q) => {
          markQuestStepComplete(q.id);
          markQuestBriefingSeen(q.id);
        });
        delete state.questProgress.completed[legacyKey];
        if (i < maxIdx) markZoneBossDefeated(zone.id);
      }
    });
    ProgressStore.update("questProgress", (q) => ({ ...(q || {}), _migratedV2: true }));
    save();
    return;
  }
  if (state.questProgress._migratedV1) return;
  state.questProgress._migratedV1 = true;
}

/** РЎР±СЂРѕСЃ В«С„Р°РЅС‚РѕРјРЅС‹С…В» Р·Р°РІРµСЂС€РµРЅРёР№ (РјРёРіСЂР°С†РёСЏ / СЂР°СЃСЃРёРЅС…СЂРѕРЅ СЃР»РѕС‚РѕРІ) вЂ” РёРЅР°С‡Рµ РІ С€Р°С…С‚Рµ С‚РѕР»СЊРєРѕ Р±РѕСЃСЃ. */
function repairQuestProgressIntegrity() {
  if (!state.avatar?.created) return false;
  ensureQuestProgress();
  const q = state.questProgress;
  let dirty = false;
  FARM_ZONES.forEach((zone) => {
    if (!zone.active || (zone.side || zone.party)) return;
    const steps = zoneQuestSteps(zone.id);
    const allFlagged = steps.every((step) => isQuestStepComplete(step.id));
    const totalKills = steps.reduce(
      (n, step) => n + questKillsDone(step.id) + questGoldenKillsDone(step.id),
      0
    );
    if (allFlagged && totalKills === 0 && !isZoneBossDefeated(zone.id)) {
      steps.forEach((step) => {
        delete q.completed[step.id];
        delete q.kills[step.id];
        delete q.goldenKills[step.id];
        delete q.briefings[step.id];
      });
      delete q.bosses[zone.id];
      delete q.bossQueued?.[zone.id];
      delete q.bossGrind?.[zone.id];
      dirty = true;
      return;
    }
    steps.forEach((step) => {
      if (!isQuestStepComplete(step.id)) return;
      if (isQuestStepObjectivesMet(step)) return;
      q.kills[step.id] = step.kills;
      if (step.goldenKills) q.goldenKills[step.id] = step.goldenKills;
      dirty = true;
    });
    if (!allZoneQuestsComplete(zone.id) && q.bosses[zone.id]) {
      delete q.bosses[zone.id];
      dirty = true;
    }
    if (!isZoneBossPending(zone.id)) {
      if (q.bossQueued?.[zone.id]) { delete q.bossQueued[zone.id]; dirty = true; }
      if (q.bossGrind?.[zone.id]) { delete q.bossGrind[zone.id]; dirty = true; }
    }
  });
  if (dirty) save();
  return dirty;
}


