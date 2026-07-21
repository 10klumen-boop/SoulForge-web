// ===== Пролог: UI (story-backdrop, кнопка OK, рендер) =====
// Core logic (RACE_PROLOGUE, prologueForAvatar, needsIntro, markStorySeen, ensureStoryFlag)
// вынесено в intro-core.js.


function isStoryBackdropOpen() {
  const backdrop = document.getElementById("storyBackdrop");
  return !!(backdrop && !backdrop.hidden);
}

const STORY_OK_ARM_MS = 650;
let storyOkArmTimer = null;

function isStoryOkLocked() {
  const btn = document.getElementById("storyOk");
  return !!(btn && btn.classList.contains("story-ok--locked"));
}

function armStoryOkButton(ms) {
  const btn = document.getElementById("storyOk");
  if (!btn) return;
  if (storyOkArmTimer) {
    clearTimeout(storyOkArmTimer);
    storyOkArmTimer = null;
  }
  btn.classList.add("story-ok--locked");
  btn.setAttribute("aria-disabled", "true");
  storyOkArmTimer = setTimeout(() => {
    storyOkArmTimer = null;
    btn.classList.remove("story-ok--locked");
    btn.removeAttribute("aria-disabled");
  }, ms == null ? STORY_OK_ARM_MS : ms);
}

function setIntroOpen(open) {
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) return;
  backdrop.hidden = !open;
  const race = state.avatar?.raceId || "human";
  backdrop.className = "story-backdrop race-" + race + (open ? "" : "");
  if (open) {
    if (typeof setGamePaused === "function") setGamePaused(true);
    if (typeof armStoryOkButton === "function") armStoryOkButton();
  } else if (typeof syncGamePauseState === "function") {
    syncGamePauseState();
  } else if (typeof setGamePaused === "function") {
    setGamePaused(false);
  }
}

function renderStoryBody(opts) {
  opts = opts || {};
  const p = prologueForAvatar();
  const race = state.avatar?.raceId || "human";
  const icon = typeof uiZoneChipIcon === "function" ? uiZoneChipIcon("banana_mine", race) : (typeof zoneRaceView === "function" ? zoneRaceView("banana_mine", race).icon : null);
  if (typeof renderStoryPanel === "function") {
    renderStoryPanel({
      title: p.title,
      eyebrow: p.eyebrow,
      lead: p.lead,
      questRef: p.questRef,
      chapter: "Пролог · Глава I",
      icon,
      bodyHtml: prologueBodyHtml(p),
      cta: opts.firstRun ? p.cta : "Закрыть",
    });
    return;
  }
  const body = document.getElementById("storyBody");
  const title = document.getElementById("storyTitle");
  const eyebrow = document.getElementById("storyEyebrow");
  if (title) title.textContent = p.title;
  if (eyebrow) eyebrow.textContent = p.eyebrow;
  if (body) body.innerHTML = p.paragraphs.map((para) => "<p>" + para + "</p>").join("");
}

function dismissIntro(fromFirstRun) {
  const backdrop = document.getElementById("storyBackdrop");
  const mode = backdrop?.dataset.storyMode;
  if (mode === "zone") {
    if (typeof dismissZoneChapter === "function") dismissZoneChapter(!!backdrop.dataset.firstUnlock);
    return;
  }
  if (mode === "quest") {
    if (typeof dismissQuestBriefing === "function") dismissQuestBriefing();
    return;
  }
  if (mode === "chapter_reward") {
    if (typeof dismissChapterReward === "function") dismissChapterReward();
    return;
  }
  if (mode === "prelude_finale") {
    if (typeof dismissPreludeFinale === "function") dismissPreludeFinale();
    return;
  }
  if (mode === "arc") {
    if (backdrop) {
      delete backdrop.dataset.storyMode;
      backdrop.hidden = true;
    }
    if (typeof syncGamePauseState === "function") syncGamePauseState();
    else if (typeof setGamePaused === "function") setGamePaused(false);
    if (typeof Audio2 !== "undefined") Audio2.click();
    return;
  }
  setIntroOpen(false);
  markStorySeen();
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (fromFirstRun && typeof gameLog === "function") {
    const p = prologueForAvatar();
    gameLog("Пролог: «" + p.title + "» · " + (p.questRef || ""), "system");
  }
  if (typeof markStoryChapterSeen === "function") markStoryChapterSeen("banana_mine");
  if (typeof flushPendingZoneStory === "function") flushPendingZoneStory();
  if (backdrop) delete backdrop.dataset.firstRun;
  if (fromFirstRun && typeof maybeShowQuestBriefing === "function") {
    maybeShowQuestBriefing("banana_mine", { delay: 520 });
  } else if (typeof flushPendingQuestBriefing === "function") {
    flushPendingQuestBriefing();
  }
}

function showIntro(opts) {
  opts = opts || {};
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    delete backdrop.dataset.zoneId;
    delete backdrop.dataset.firstUnlock;
  }
  renderStoryBody({ firstRun: opts.firstRun });
  setIntroOpen(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function wireIntro() {
  const backdrop = document.getElementById("storyBackdrop");
  const btn = document.getElementById("storyOk");
  if (!backdrop || backdrop.dataset.wired) return;
  backdrop.dataset.wired = "1";

  btn.onclick = () => {
    if (isStoryOkLocked()) return;
    dismissIntro(!!backdrop.dataset.firstRun);
  };
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      if (isStoryOkLocked()) return;
      dismissIntro(!!backdrop.dataset.firstRun);
    }
  });

  const sett = document.getElementById("settStory");
  if (sett) {
    sett.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      delete backdrop.dataset.firstRun;
      showIntro({ firstRun: false });
    };
  }
}

function maybeShowIntro() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) return;
  ensureStoryFlag();
  if (!needsIntro()) return;
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) backdrop.dataset.firstRun = "1";
  setTimeout(() => showIntro({ firstRun: true }), 280);
}

/** Пролог, брифинги и финал Prelude — при входе в игровой хаб, не при создании героя. */
async function runGameEntryModals() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) return;
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return;

  if (typeof showPassiveIncomeEntryModal === "function") {
    try { await showPassiveIncomeEntryModal(); } catch (e) {
      console.error("showPassiveIncomeEntryModal failed:", e);
    }
  }

  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return;

  if (typeof needsIntro === "function" && needsIntro()) {
    maybeShowIntro();
    return;
  }

  setTimeout(() => {
    if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return;
    const backdrop = document.getElementById("storyBackdrop");
    if (backdrop?.dataset.pendingZoneStory && typeof flushPendingZoneStory === "function") {
      flushPendingZoneStory();
      return;
    }
    const zoneId = state.farmZone || "banana_mine";
    if (typeof maybeShowQuestBriefing === "function") {
      maybeShowQuestBriefing(zoneId, { delay: 320 });
    }
    if (typeof tryTriggerPreludeFinale === "function") tryTriggerPreludeFinale();
    else if (typeof flushPendingQuestBriefing === "function") flushPendingQuestBriefing();
  }, 360);
}
