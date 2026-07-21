// ===== Финал Prelude: UI (модал эпилога) =====
// Core logic (isPreludeComplete, applyPreludeFinaleReward, preludeFinaleBodyHtml)
// вынесена в prelude-finale-core.js.

function showPreludeFinaleModal() {
  if (preludeFinaleSeen() || !isPreludeComplete()) return;
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) {
    applyPreludeFinaleReward();
    return;
  }
  const ep = preludeFinaleEpilogue();
  const view = typeof zoneRaceView === "function" ? zoneRaceView("dwarven_depths") : { icon: "" };
  if (typeof renderStoryPanel === "function") {
    renderStoryPanel({
      title: ep.title,
      eyebrow: ep.eyebrow,
      lead: ep.lead,
      chapter: "Prelude · Финал",
      icon: typeof uiZoneChipIcon === "function" ? uiZoneChipIcon("dwarven_depths", state.avatar?.raceId) : view.icon,
      bodyHtml: preludeFinaleBodyHtml(ep),
      cta: "Принять судьбу",
    });
  }
  backdrop.dataset.storyMode = "prelude_finale";
  backdrop.className =
    "story-backdrop race-" + (state.avatar?.raceId || "human") +
    " story-zone-dwarven_depths story-prelude-finale";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function dismissPreludeFinale() {
  if (!preludeFinaleSeen()) applyPreludeFinaleReward();
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    backdrop.hidden = true;
  }
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof toast === "function") toast("Prelude завершён — эпоха Хаоса ждёт", "success");
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  if (typeof renderQuestJournal === "function") renderQuestJournal();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof checkAchievements === "function") checkAchievements();
}

function tryTriggerPreludeFinale() {
  if (!state.avatar?.created || preludeFinaleSeen() || !isPreludeComplete()) return;
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop && !backdrop.hidden) return;
  setTimeout(() => {
    if (!preludeFinaleSeen() && isPreludeComplete()) showPreludeFinaleModal();
  }, 600);
}

function migratePreludeFinale() {
  /* UI финала Prelude — только при входе в игру (runGameEntryModals). */
}
