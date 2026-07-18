// ===== Prelude: цепочки квестов, боссы локаций, прогресс =====

const QUESTS_PER_ZONE = 3;

/** Убийств по шагам: [зачистка, элита, финал] — хватает, чтобы подойти к порогу следующей зоны */
function zoneQuestKillTargets(chapter) {
  const ch = Math.min(5, Math.max(1, chapter || 1));
  return [
    12 + ch * 4, // ch1=16 … ch5=32
    8 + ch * 3,  // ch1=11 … ch5=23
    14 + ch * 3, // ch1=17 … ch5=29
  ];
  // Итого за главу: 44 / 54 / 64 / 74 / 84 (+ золотые + босс)
}

/** Сколько «золотых» целей нужно на шаге 2 */
function zoneQuestGoldenTarget(chapter) {
  return 1 + Math.min(5, Math.max(1, chapter || 1));
}

const QUEST_STEP_FLAVOR = [
  "Сперва выжги гнездо — пусть поле запомнит твою сталь.",
  "Теперь добей элиту — тех, кто несёт лучшую добычу.",
  "Последнее поручение. После него явится хозяин этой земли.",
];

/** @type {Record<string, Record<string, { name: string, role: string, icon: string, greet: string }>>} */
const QUEST_NPC_BY_RACE_ZONE = {
  human: {
    banana_mine: { name: "Колин Виндавуд", role: "Старейшина · Говорящий остров", icon: "icons/weapon_long_sword_i00.png", greet: "Шторм отступил, но остров ещё кровоточит." },
    elven_ruins: { name: "Галлинт", role: "Мудрец · Школа магии", icon: "icons/weapon_mace_of_judgment_i00.png", greet: "Духи вырвались из зеркал — барьер не вечен." },
    orc_barracks: { name: "Священник Эйнхасад", role: "Церковь · Расовая марка", icon: "icons/weapon_mace_of_judgment_i00.png", greet: "Эльфы ждут помощи у опушки." },
    dark_cavern: { name: "Святая Кристина", role: "Церковь · Граница тьмы", icon: "icons/weapon_mace_of_judgment_i00.png", greet: "Тьма не прощает слабых у границы." },
    dwarven_depths: { name: "Гонец Амадео", role: "Король · Башня", icon: "icons/weapon_long_sword_i00.png", greet: "Белая башня зовёт — мир сходится у кратера." },
  },
  elf: {
    banana_mine: { name: "Астериус", role: "Старейшина · Деревня эльфов", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Древо Матери увядает — гоблины рубят корни." },
    elven_ruins: { name: "Астериус", role: "Хранитель · Руины", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Осколки огня и льда будят духов у сводов." },
    orc_barracks: { name: "Райен", role: "Страж · Граница", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Орки ломятся к корням Древа." },
    dark_cavern: { name: "Астериус", role: "Разведка · Споры", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Скверна дошла до светлых корней." },
    dwarven_depths: { name: "Аркениас", role: "Маг · Башня", icon: "icons/weapon_elven_long_sword_i00.png", greet: "Небулит решит судьбу мира." },
  },
  dark_elf: {
    banana_mine: { name: "Тетрарх", role: "Школа тёмных искусств", icon: "icons/weapon_dark_screamer_i00.png", greet: "Охота Шилен началась — промаха не будет." },
    elven_ruins: { name: "Старейшина тьмы", role: "Разведка · Руины", icon: "icons/weapon_dark_screamer_i00.png", greet: "Светлые слабеют в своих сводах." },
    orc_barracks: { name: "Военачальник Баллар", role: "Граница тьмы", icon: "icons/weapon_dark_screamer_i00.png", greet: "Орки хлынули и к нам." },
    dark_cavern: { name: "Жрица Шилен", role: "Охота · Месса", icon: "icons/weapon_dark_screamer_i00.png", greet: "Охота в разгаре — кровь на алтаре." },
    dwarven_depths: { name: "Тайный совет", role: "Башня · Митреэль", icon: "icons/weapon_dark_screamer_i00.png", greet: "Башня полна чужих глаз." },
  },
  orc: {
    banana_mine: { name: "Кекай", role: "Вождь · Плато", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Плато ждёт доблести перед вечной зимой." },
    elven_ruins: { name: "Центурион", role: "Трофеи · Руины", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Предки воевали в этих руинах." },
    orc_barracks: { name: "Кекай", role: "Испытание · Чужой лес", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Эльфийский лес не любит орков." },
    dark_cavern: { name: "Шаман племени", role: "Обряд · Тьма", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Тьма — тоже огонь, если не бояться." },
    dwarven_depths: { name: "Кекай", role: "Дипломатия · Башня", icon: "icons/weapon_paagrio_hammer_i00.png", greet: "Не опозорь племя у белой башни." },
  },
  dwarf: {
    banana_mine: { name: "Серый столб", role: "Гильдия · Мамир", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Гильдии грызутся за жилу у Мамира." },
    elven_ruins: { name: "Серый столб", role: "Гильдия · Своды", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Нужен образец крепления из руин." },
    orc_barracks: { name: "Серебряные весы", role: "Торг · Лес", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Война — хороший рынок у леса." },
    dark_cavern: { name: "Представитель гильдии", role: "Контракт · Жила", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Одна сделка у границы тьмы." },
    dwarven_depths: { name: "Старейшина гильдии", role: "Поставки · Башня", icon: "icons/weapon_dwarven_hammer_i00.png", greet: "Реагенты магам и голос на выборах." },
  },
};

/** Босс локации после 3 квестов */
const ZONE_BOSSES = {
  banana_mine: { name: "Вождь стервятников", mob: "relic-werewolf", hpMult: 14, rewardMult: 2.0 },
  elven_ruins: { name: "Повелитель зеркал", mob: "silent-horror", hpMult: 16, rewardMult: 2.2 },
  orc_barracks: { name: "Кабу-разрушитель", mob: "tunath-orc-warrior", hpMult: 17, rewardMult: 2.4 },
  dark_cavern: { name: "Сердце скверны", mob: "dre-vanul", hpMult: 18, rewardMult: 2.5 },
  dwarven_depths: { name: "Страж кратера", mob: "stone-giant", hpMult: 20, rewardMult: 2.8 },
};

function questStepId(zoneId, step) {
  return "quest_" + zoneId + "_" + step;
}

function ensureQuestProgress() {
  if (!state.questProgress || typeof state.questProgress !== "object") {
    state.questProgress = { completed: {}, kills: {}, goldenKills: {}, bosses: {}, briefings: {}, chapterRewards: {}, stepRewards: {} };
  }
  const q = state.questProgress;
  if (!q.completed) q.completed = {};
  if (!q.kills) q.kills = {};
  if (!q.goldenKills) q.goldenKills = {};
  if (!q.bosses) q.bosses = {};
  if (!q.briefings) q.briefings = {};
  if (!q.chapterRewards) q.chapterRewards = {};
  if (!q.stepRewards) q.stepRewards = {};
}

function prevFarmZone(zone) {
  zone = typeof zone === "string" ? farmZoneById(zone) : zone;
  const i = FARM_ZONES.findIndex((z) => z.id === zone.id);
  return i > 0 ? FARM_ZONES[i - 1] : null;
}

function questNpc(zoneId, race) {
  race = race || (typeof currentAvatarRace === "function" ? currentAvatarRace() : state.avatar?.raceId) || "human";
  const base = QUEST_NPC_BY_RACE_ZONE[race]?.[zoneId] || QUEST_NPC_BY_RACE_ZONE.human?.[zoneId] || {
    name: "Странник", role: "Prelude", icon: UI_QUEST_ICON, greet: "Выполни поручение на поле.",
  };
  const icon = typeof uiQuestNpcIcon === "function" ? uiQuestNpcIcon(race, zoneId) : base.icon;
  return icon === base.icon ? base : Object.assign({}, base, { icon });
}

function zoneBossDef(zoneId) {
  return ZONE_BOSSES[zoneId] || { name: "Хозяин земли", mob: "relic-werewolf", hpMult: 14, rewardMult: 2.5 };
}

function zoneQuestSteps(zoneId, race) {
  const zone = farmZoneById(zoneId);
  if (!zone) return [];
  const npc = questNpc(zoneId, race);
  const beat = typeof zoneStoryBeat === "function" ? zoneStoryBeat(zoneId, race) : {};
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId, race) : zone;
  const kills = zoneQuestKillTargets(zone.chapter);
  const goldenNeed = zoneQuestGoldenTarget(zone.chapter);
  const stepTitles = ["Зачистка поля", "Охота на элиту", "Финальное поручение"];
  const steps = [];
  for (let i = 0; i < QUESTS_PER_ZONE; i++) {
    const step = i + 1;
    steps.push({
      id: questStepId(zoneId, step),
      zoneId,
      step,
      stepsTotal: QUESTS_PER_ZONE,
      chapter: zone.chapter,
      title: (view.story?.title || view.name) + " · " + stepTitles[i],
      npc,
      questRef: beat.questRef || "",
      targets: beat.targets || "враги на поле",
      kills: kills[i],
      goldenKills: step === 2 ? goldenNeed : 0,
      eyebrow: npc.role + " · " + step + "/" + QUESTS_PER_ZONE,
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
  return zoneQuestSteps(zoneId).every((q) => isQuestStepComplete(q.id));
}

function isZoneBossDefeated(zoneId) {
  ensureQuestProgress();
  return !!state.questProgress.bosses[zoneId];
}

function isZoneBossPending(zoneId) {
  return allZoneQuestsComplete(zoneId) && !isZoneBossDefeated(zoneId);
}

function isZoneChapterComplete(zoneId) {
  return allZoneQuestsComplete(zoneId) && isZoneBossDefeated(zoneId);
}

function isPrevZoneChapterComplete(zone) {
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
  state.questProgress.completed[questId] = true;
  delete state.questProgress.kills[questId];
  delete state.questProgress.goldenKills[questId];
}

function markZoneBossDefeated(zoneId) {
  ensureQuestProgress();
  state.questProgress.bosses[zoneId] = true;
}

function questBriefingSeen(questId) {
  ensureQuestProgress();
  return !!state.questProgress.briefings[questId];
}

function markQuestBriefingSeen(questId) {
  ensureQuestProgress();
  state.questProgress.briefings[questId] = true;
}

function acceptZoneQuest(questId) {
  ensureQuestProgress();
  if (state.questProgress.completed[questId]) return;
  if (state.questProgress.kills[questId] == null) state.questProgress.kills[questId] = 0;
  if (state.questProgress.goldenKills[questId] == null) state.questProgress.goldenKills[questId] = 0;
  markQuestBriefingSeen(questId);
  save();
}

function onQuestMobKill(zoneId, mobType) {
  if (!zoneId) return false;
  const def = activeZoneQuest(zoneId);
  if (!def || isQuestStepComplete(def.id)) return false;
  ensureQuestProgress();
  const isGolden = mobType === "golden" || mobType === "boss";
  if (def.goldenKills > 0) {
    if (isGolden) {
      const g = state.questProgress.goldenKills[def.id] || 0;
      if (g < def.goldenKills) state.questProgress.goldenKills[def.id] = g + 1;
    }
    const k = state.questProgress.kills[def.id] || 0;
    if (k < def.kills) state.questProgress.kills[def.id] = k + 1;
  } else {
    const cur = state.questProgress.kills[def.id] || 0;
    if (cur < def.kills) state.questProgress.kills[def.id] = cur + 1;
  }
  const done = isQuestStepObjectivesMet(def);
  if (done) {
    markQuestStepComplete(def.id);
    const loot =
      typeof grantQuestStepReward === "function"
        ? grantQuestStepReward(zoneId, def.step, def.id)
        : null;
    const lootBit = loot?.summary ? " · " + loot.summary : "";
    const next = activeZoneQuest(zoneId);
    if (next) {
      if (typeof gameLog === "function") {
        gameLog(def.title + " — выполнено" + (loot?.summary ? " (" + loot.summary + ")" : "") + ". Следующее: " + next.step + "/" + QUESTS_PER_ZONE, "success");
      }
      if (typeof toast === "function") {
        toast("✓ Поручение " + def.step + "/" + QUESTS_PER_ZONE + lootBit, "success");
      }
    } else {
      const boss = zoneBossDef(zoneId);
      if (typeof gameLog === "function") {
        gameLog("Все поручения выполнены" + (loot?.summary ? " (" + loot.summary + ")" : "") + " — на поле явится " + boss.name, "success");
      }
      if (typeof toast === "function") {
        toast("☠ Босс: " + boss.name + lootBit, "warn");
      }
    }
    if (typeof noteLeaderboardEvent === "function") noteLeaderboardEvent("snapshot");
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
  if (typeof gameLog === "function") gameLog(view.name + ": " + boss.name + " повержен — путь дальше открыт", "success");
  if (typeof toast === "function") toast("☠ " + boss.name + " повержен! Глава завершена.", "success");
  if (typeof grantChapterReward === "function") grantChapterReward(zoneId);
  if (typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  if (typeof renderQuestJournal === "function") renderQuestJournal();
  save();
  if (typeof checkAchievements === "function") checkAchievements();
}

function questStatusText(zone) {
  zone = typeof zone === "string" ? farmZoneById(zone) : zone;
  if (!zone) return "";
  if (isZoneChapterComplete(zone.id)) return "глава ✓";
  const prev = prevFarmZone(zone);
  if (prev && !isZoneChapterComplete(prev.id)) {
    const pv = typeof zoneRaceView === "function" ? zoneRaceView(prev) : prev;
    return "глава: " + (pv.name || "…") + " ✗";
  }
  if (isZoneBossPending(zone.id)) return "☠ босс";
  const def = activeZoneQuest(zone.id);
  if (!def) return "";
  const done = questKillsDone(def.id);
  if (def.goldenKills) {
    const g = questGoldenKillsDone(def.id);
    return def.step + "/" + QUESTS_PER_ZONE + " · " + done + "/" + def.kills + " · ★" + g + "/" + def.goldenKills;
  }
  return def.step + "/" + QUESTS_PER_ZONE + " · " + done + "/" + def.kills;
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
      const zid = FARM_ZONES[i].id;
      zoneQuestSteps(zid).forEach((q) => markQuestStepComplete(q.id));
      markZoneBossDefeated(zid);
    }
    FARM_ZONES.forEach((zone, i) => {
      const legacyKey = "quest_" + zone.id;
      if (state.questProgress.completed[legacyKey]) {
        zoneQuestSteps(zone.id).forEach((q) => markQuestStepComplete(q.id));
        delete state.questProgress.completed[legacyKey];
        if (i < maxIdx) markZoneBossDefeated(zone.id);
      }
    });
    state.questProgress._migratedV2 = true;
    save();
    return;
  }
  if (state.questProgress._migratedV1) return;
  state.questProgress._migratedV1 = true;
}

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
    el.hidden = false;
    el.className = "mine-quest-hud mine-quest-boss";
    el.innerHTML =
      '<span class="mine-quest-npc">☠ ' + boss.name +
      '</span><span class="mine-quest-obj">Босс локации — победи, чтобы открыть следующую главу</span>';
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
