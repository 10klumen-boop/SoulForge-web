// ===== Журнал квестов: core logic (награды за шаги и главы) =====
// Вынесено из 29-quest-journal.js; UI модалов и рендера осталось в 29-quest-journal.js.
// ZONE_CHAPTER_REWARDS в data/zone-chapter-rewards.js.

// ===== Журнал квестов, награды за главы =====
// ZONE_CHAPTER_REWARDS вынесен в data/zone-chapter-rewards.js

/** Награда за шаг поручения (якорь ECONOMY: ~10–16 мин фарма главы). */
function zoneQuestStepRewardDef(zoneId, step) {
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  const ch = Math.min(5, Math.max(1, zone?.chapter || 1));
  const s = Math.min(3, Math.max(1, Number(step) || 1));
  const adena =
    typeof economyStepAdena === "function"
      ? economyStepAdena(ch, s)
      : Math.round([25_000, 48_000, 95_000, 150_000, 230_000][ch - 1] * [1, 1.2, 1.6][s - 1]);
  const soul = Math.max(1, Math.round([12, 18, 26, 36, 48][ch - 1] * [0.85, 1, 1.25][s - 1]));
  let spirit = 0;
  if (ch >= 2) {
    spirit = Math.round([0, 6, 10, 16, 22][ch - 1] * [0.7, 1, 1.25][s - 1]);
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
  ProgressStore.update("questProgress", (q) => {
    if (q?.stepRewards) return q;
    return { ...(q || {}), stepRewards: {} };
  });
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
  let adena = typeof playtestIncome === "function" ? playtestIncome(rw.adena || 0) : (rw.adena || 0);
  if (adena > 0) {
    ProgressStore.update("adena", (a) => (a || 0) + adena);
    ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + adena }));
  }
  if (rw.soul) ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), soul: (m?.soul || 0) + rw.soul }));
  if (rw.spirit) ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), spirit: (m?.spirit || 0) + rw.spirit }));
  if (rw.crystals) {
    ProgressStore.update("crystals", (c) => {
      const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
      Object.keys(rw.crystals).forEach((g) => { next[g] = (next[g] || 0) + (rw.crystals[g] || 0); });
      return next;
    });
  }
  ProgressStore.update("questProgress", (q) => ({ ...(q || {}), stepRewards: { ...(q?.stepRewards || {}), [questId]: true } }));
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
  ProgressStore.update("questProgress", (q) => {
    if (q?.chapterRewards) return q;
    return { ...(q || {}), chapterRewards: {} };
  });
}

function isChapterRewardClaimed(zoneId) {
  ensureChapterRewardsState();
  return !!state.questProgress.chapterRewards[zoneId];
}

function zoneChapterRewardDef(zoneId) {
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  const ch = zone?.chapter || 1;
  const fallbackAdena =
    typeof economyChapterAdena === "function" ? economyChapterAdena(ch) : 112_500;
  return (
    ZONE_CHAPTER_REWARDS[zoneId] || {
      adena: fallbackAdena,
      soul: 20,
      spirit: 0,
      crystals: { D: 1 },
      lines: [],
    }
  );
}

function applyChapterReward(zoneId, opts) {
  opts = opts || {};
  const rw = zoneChapterRewardDef(zoneId);
  ensureWorkshopState();
  let adena = typeof playtestIncome === "function" ? playtestIncome(rw.adena || 0) : (rw.adena || 0);
  if (adena > 0) {
    ProgressStore.update("adena", (a) => (a || 0) + adena);
    ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + adena }));
  }
  if (rw.soul) ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), soul: (m?.soul || 0) + rw.soul }));
  if (rw.spirit) ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), spirit: (m?.spirit || 0) + rw.spirit }));
  if (rw.crystals) {
    ProgressStore.update("crystals", (c) => {
      const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
      Object.keys(rw.crystals).forEach((g) => { next[g] = (next[g] || 0) + (rw.crystals[g] || 0); });
      return next;
    });
  }
  ensureChapterRewardsState();
  ProgressStore.update("questProgress", (q) => ({ ...(q || {}), chapterRewards: { ...(q?.chapterRewards || {}), [zoneId]: true } }));
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
