(async function boot() {
  try {
    if (typeof hydrateDesktopSave === "function") await hydrateDesktopSave();
  } catch (e) {
    console.error("hydrateDesktopSave failed:", e);
    saveNotice = saveNotice || "Не удалось загрузить сохранение — новый прогресс";
  }

$("#mineBanner").onclick = openMine;
if (typeof wireDebugLog === "function") wireDebugLog();
$("#mineBack").onclick = () => { Audio2.click(); stopMine(); renderMenu(); show("menu"); };
const mineShotBtn = document.getElementById("mineShotToggle");
if (mineShotBtn) {
  mineShotBtn.onclick = (e) => {
    e.preventDefault();
    if (typeof toggleAutoShots === "function") toggleAutoShots();
  };
}
$("#invTile").onclick = openInventory;
$("#shopTile").onclick = openWorkshop;
$("#achTile").onclick = openAchievements;
if (typeof wireDevPanel === "function") wireDevPanel();
if (typeof wireQuestJournal === "function") wireQuestJournal();
$("#enchBack").onclick = () => { Audio2.click(); goInventory(); };
$("#accBack").onclick = () => { Audio2.click(); curAcc = null; goInventory(); };
$("#accEquipBtn").onclick = () => { Audio2.click(); equipAccessory(); };
$("#accFunpayBtn").onclick = () => { Audio2.click(); funpayAccessory(); };

$("#enchBtn").onclick = doEnchant;
$("#newBtn").onclick = newWeapon;
$("#sellBtn").onclick = sellWeapon;
document.querySelectorAll(".back").forEach((b) => { if (b.dataset.to) b.onclick = () => { Audio2.click(); show(b.dataset.to); }; });
$("#settMute").onclick = () => { Audio2.click(); toggleMute(); };
$("#resetBtn").onclick = async () => {
  if (!await showConfirm({
    title: "Сброс прогресса",
    message: "Сбросить весь прогресс (adena, инвентарь и рекорды)?\nДействие необратимо.",
    okText: "Сбросить",
    danger: true,
  })) return;
  stopMine();
  if (pipWindow && !pipWindow.closed) pipWindow.close();
  resetProgress();
  renderMenu();
  $("#adena").textContent = fmt(state.adena);
  syncSettingsUI();
  show("home");
  toast("Прогресс сброшен");
};
document.addEventListener("keydown", (e) => {
  const modalOpen = document.getElementById("modalBackdrop") && !document.getElementById("modalBackdrop").hidden;
  const achModalOpen = document.getElementById("achModalBackdrop") && !document.getElementById("achModalBackdrop").hidden;
  const achRewardOpen = document.getElementById("achRewardBackdrop") && !document.getElementById("achRewardBackdrop").hidden;
  const storyOpen = document.getElementById("storyBackdrop") && !document.getElementById("storyBackdrop").hidden;
  const avatarSetupOpen = document.getElementById("avatarSetupBackdrop") && !document.getElementById("avatarSetupBackdrop").hidden;
  const avatarEquipOpen = document.getElementById("avatarEquipBackdrop") && !document.getElementById("avatarEquipBackdrop").hidden;
  if (e.key === "Escape" && avatarSetupOpen) {
    e.preventDefault();
    if (typeof Audio2 !== "undefined") Audio2.click();
    if (typeof avatarSetupBack === "function") avatarSetupBack();
    return;
  }
  if (modalOpen || achModalOpen || achRewardOpen || storyOpen || avatarSetupOpen || avatarEquipOpen) return;
  if ($("#screen-ench").classList.contains("active")) {
    if (e.code === "Space") { e.preventDefault(); doEnchant(); }
    else if (e.key.toLowerCase() === "n") newWeapon();
    else if (e.key.toLowerCase() === "s") sellWeapon();
    else if (e.key === "Escape") { Audio2.click(); goInventory(); }
  } else if ($("#screen-acc").classList.contains("active")) {
    if (e.key === "Escape") { Audio2.click(); curAcc = null; goInventory(); }
  } else if (e.key === "Escape" && $("#screen-mine").classList.contains("active")) { stopMine(); renderMenu(); show("menu"); }
  else if (e.key === "Escape" && $("#screen-login")?.classList.contains("active")) {
    Audio2.click();
  }
  else if (e.key === "Escape" && $("#screen-menu").classList.contains("active")) { Audio2.click(); show("home"); }
  else if (e.key === "Escape" && ($("#screen-settings").classList.contains("active") || $("#screen-patch").classList.contains("active") || $("#screen-author").classList.contains("active"))) {
    Audio2.click();
    const back = document.querySelector(".screen.active .panel-head .back");
    const to = back?.dataset?.to || "home";
    show(to);
  }
  else if (e.key === "Escape" && ($("#screen-characters").classList.contains("active") || $("#screen-leaderboard")?.classList.contains("active") || $("#screen-home").classList.contains("active"))) { Audio2.click(); show("home"); }
  else if (e.key === "Escape" && ($("#screen-inv").classList.contains("active") || $("#screen-ach").classList.contains("active") || $("#screen-shop").classList.contains("active") || $("#screen-avatar").classList.contains("active") || $("#screen-quests").classList.contains("active"))) { show("menu"); }
  if (e.key.toLowerCase() === "m" && document.activeElement.id !== "devSearchInput") toggleMute();
});

syncSettingsUI();
if (typeof wireAudioVolumeSettings === "function") wireAudioVolumeSettings();
if (isDesktopApp && state.alwaysOnTop) window.soulforgeDesktop.setAlwaysOnTop(true);
$("#adena").textContent = fmt(state.adena);
initGameLog();
if (saveNotice) { toast(saveNotice, "system"); saveNotice = null; }
if (trimInventoryToCap()) toast("Инвентарь обрезан до " + INV_CAP + " ячеек", "warn");
if (state.inventory) state.inventory.forEach(normalizeInvItem);
migrateCollectibles();
migrateCollectiblesToInventory();
if (typeof wireBananDev === "function") wireBananDev();
wireAuthorPanel();
wireIntro();
wireAvatar();
if (typeof wireHomeMenu === "function") wireHomeMenu();
if (typeof wireAvatarGear === "function") wireAvatarGear();
wirePortableSaveUI();
initCloud();
if (typeof checkAchievements === "function") checkAchievements({ silent: true });
if (typeof migrateAvatar === "function") migrateAvatar();
if (typeof migrateStarterWeapon === "function") migrateStarterWeapon();
if (typeof ensureStoryProgress === "function") ensureStoryProgress();
if (typeof migrateQuestProgress === "function") migrateQuestProgress();
if (typeof repairQuestProgressIntegrity === "function") repairQuestProgressIntegrity();
if (typeof migrateChapterRewards === "function") migrateChapterRewards();
if (typeof migratePreludeFinale === "function") migratePreludeFinale();
if (typeof wireCombatSkills === "function") wireCombatSkills();
if (typeof migrateFarmZone === "function") migrateFarmZone();
if (typeof applyUiIconsToFarmZones === "function") applyUiIconsToFarmZones();
if (typeof applyUiIconsToQuestNpcs === "function") applyUiIconsToQuestNpcs();
if (typeof wireStoryArcBar === "function") wireStoryArcBar();
if (typeof wireMineStory === "function") wireMineStory();
if (typeof ensurePassiveIncomeState === "function") ensurePassiveIncomeState();
if (typeof ensureAutoClickerState === "function") ensureAutoClickerState();
if (typeof collectPassiveIncome === "function") {
  try { collectPassiveIncome({ queueNotice: true }); } catch (e) { console.error("collectPassiveIncome failed:", e); }
}
renderMenu();
if (typeof applyVersionLabels === "function") applyVersionLabels();
show("login");
if (typeof tryResumeCloudSession === "function") {
  tryResumeCloudSession().catch((e) => console.error("tryResumeCloudSession failed:", e));
}
if (typeof Audio2 !== "undefined") {
  if (Audio2.preload) Audio2.preload();
}
if (typeof refreshZoneStoryUnlocks === "function") refreshZoneStoryUnlocks();
if (typeof updateHomeCharsSubtitle === "function") updateHomeCharsSubtitle();
document.body.addEventListener(
  "pointerdown",
  () => {
    if (typeof Audio2 !== "undefined") {
      Audio2.unlock();
      const active = document.querySelector(".screen.active");
      const screen = active && active.id ? active.id.replace("screen-", "") : "";
      if (Audio2.setScreen) Audio2.setScreen(screen);
    }
  },
  { once: true }
);

// ПКМ: без контекстного меню WebView / браузера
document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  { capture: true }
);
document.addEventListener(
  "auxclick",
  (e) => {
    if (e.button !== 0) e.preventDefault();
  },
  { capture: true }
);

// Mac trackpad / кнопки мыши «Назад/Вперёд»: не уводить со SPA
(function trapBrowserHistoryGestures() {
  try {
    history.replaceState({ soulforge: 1 }, "", location.href);
    history.pushState({ soulforge: 1 }, "", location.href);
  } catch (_) {}
  window.addEventListener("popstate", () => {
    try {
      history.pushState({ soulforge: 1 }, "", location.href);
    } catch (_) {}
  });
  const blockNavBtn = (e) => {
    if (e.button === 3 || e.button === 4) e.preventDefault();
  };
  document.addEventListener("mousedown", blockNavBtn, { capture: true });
  document.addEventListener("mouseup", blockNavBtn, { capture: true });
})();

// iOS Safari: pinch zoom (gesture*) — double-tap закрыт через touch-action: manipulation
(function blockIosPageZoom() {
  const stop = (e) => e.preventDefault();
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
})();
})();
