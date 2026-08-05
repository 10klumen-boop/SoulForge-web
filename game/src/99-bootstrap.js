(async function boot() {
  try {
    if (typeof loadGameJsonData === "function") await loadGameJsonData();
    if (typeof mergePartyFarmZonesIntoFarmZones === "function") mergePartyFarmZonesIntoFarmZones();
    if (typeof rebuildAchievementsFromMeta === "function") rebuildAchievementsFromMeta();
  } catch (e) {
    console.error("loadGameJsonData failed:", e);
    if (typeof toast === "function") toast("Не удалось загрузить данные игры", "warn");
  }
  try {
    if (typeof loadGlossaryFromServer === "function") await loadGlossaryFromServer();
  } catch (e) {
    console.warn("loadGlossaryFromServer failed:", e);
  }
  try {
    if (typeof hydrateDesktopSave === "function") await hydrateDesktopSave();
  } catch (e) {
    console.error("hydrateDesktopSave failed:", e);
    saveNotice = saveNotice || "Не удалось загрузить сохранение — новый прогресс";
  }

$("#mineBanner") && ($("#mineBanner").onclick = () => {
  if (typeof migrateFarmZone === "function") migrateFarmZone();
  const cur = typeof farmZoneById === "function" ? farmZoneById(state.farmZone) : null;
  if (!cur || cur.side || cur.party || (typeof canEnterFarmZone === "function" && !canEnterFarmZone(cur))) {
    const zones = typeof storyFarmZones === "function" ? storyFarmZones() : [];
    const pick =
      zones.find((z) => typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) || null;
    if (pick && typeof selectFarmZone === "function") selectFarmZone(pick.id);
  }
  openMine();
});
const farmPlayBanner = document.getElementById("farmPlayBanner");
if (farmPlayBanner) {
  farmPlayBanner.onclick = () => {
    if (typeof migrateFarmZone === "function") migrateFarmZone();
    const cur = typeof farmZoneById === "function" ? farmZoneById(state.farmZone) : null;
    if (!cur?.side || (typeof canEnterFarmZone === "function" && !canEnterFarmZone(cur))) {
      const zones = typeof freeFarmZones === "function" ? freeFarmZones() : [];
      const pick =
        zones.find((z) => typeof canEnterFarmZone === "function" && canEnterFarmZone(z)) || null;
      if (pick && typeof selectFarmZone === "function") selectFarmZone(pick.id);
    }
    openMine();
  };
}
if (typeof initPartyPanel === "function") initPartyPanel();
if (typeof syncCharacterSessionOverlays === "function") syncCharacterSessionOverlays();
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
if (typeof wireAccountStorage === "function") wireAccountStorage();
if (typeof wirePlayerMail === "function") wirePlayerMail();
if (typeof wirePartyUi === "function") wirePartyUi();
if (typeof bindClanMenuTile === "function") bindClanMenuTile();
if (typeof bindAdenMapBack === "function") bindAdenMapBack();
if (typeof syncClanTileMeta === "function") syncClanTileMeta();
$("#shopTile").onclick = () => openWorkshop();
const bananaCasinoTile = document.getElementById("bananaCasinoTile");
if (bananaCasinoTile) {
  bananaCasinoTile.onclick = () => {
    if (typeof openBananaCasino === "function") openBananaCasino();
  };
}
if (typeof bindMarketUi === "function") bindMarketUi();
if (typeof bindPvpArenaUi === "function") bindPvpArenaUi();
$("#achTile").onclick = openAchievements;
if (typeof bindEngagementUi === "function") bindEngagementUi();
if ($("#glossaryTile")) {
  $("#glossaryTile").onclick = () => {
    if (typeof openGlossaryScreen === "function") openGlossaryScreen({ from: "menu" });
  };
}
if (typeof wireDevPanel === "function") wireDevPanel();
if (typeof wireQuestJournal === "function") wireQuestJournal();
$("#enchBack").onclick = () => { Audio2.click(); goInventory(); };
$("#accBack").onclick = () => { Audio2.click(); curAcc = null; goInventory(); };
$("#accEquipBtn").onclick = () => { Audio2.click(); equipAccessory(); };
$("#accFunpayBtn").onclick = () => { Audio2.click(); funpayAccessory(); };

$("#enchBtn").onclick = doEnchant;
$("#newBtn").onclick = newWeapon;
document.querySelectorAll(".back").forEach((b) => { if (b.dataset.to) b.onclick = () => { Audio2.click(); show(b.dataset.to); }; });
$("#settMute").onclick = () => { Audio2.click(); toggleMute(); };
const topMuteBtn = $("#topMuteBtn");
if (topMuteBtn) topMuteBtn.onclick = () => { Audio2.click(); toggleMute(); };
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
  const storyOpen = document.getElementById("storyBackdrop") && !document.getElementById("storyBackdrop").hidden;
  const avatarSetupOpen = document.getElementById("avatarSetupBackdrop") && !document.getElementById("avatarSetupBackdrop").hidden;
  const avatarEquipOpen = document.getElementById("avatarEquipBackdrop") && !document.getElementById("avatarEquipBackdrop").hidden;
  if (e.key === "Escape" && avatarSetupOpen) {
    e.preventDefault();
    if (typeof Audio2 !== "undefined") Audio2.click();
    if (typeof avatarSetupBack === "function") avatarSetupBack();
    return;
  }
  if (modalOpen || storyOpen || avatarSetupOpen || avatarEquipOpen) return;
  if ($("#screen-ench").classList.contains("active")) {
    if (e.code === "Space") { e.preventDefault(); doEnchant(); }
    else if (e.key.toLowerCase() === "n") newWeapon();
    else if (e.key === "Escape") { Audio2.click(); goInventory(); }
  } else if ($("#screen-acc").classList.contains("active")) {
    if (e.key === "Escape") { Audio2.click(); curAcc = null; goInventory(); }
  } else if (e.key === "Escape" && $("#screen-mine").classList.contains("active")) {
    if (typeof mineSessionLootOpen !== "undefined" && mineSessionLootOpen && typeof closeMineSessionLootDrawer === "function") {
      Audio2.click();
      closeMineSessionLootDrawer();
      if (typeof renderMineSessionLoot === "function") renderMineSessionLoot();
    } else if (typeof mineResourceFavOpen !== "undefined" && mineResourceFavOpen && typeof closeMineResourceFavDrawer === "function") {
      Audio2.click();
      closeMineResourceFavDrawer();
      if (typeof renderMineResourceFavorites === "function") renderMineResourceFavorites();
    } else {
      stopMine();
      renderMenu();
      show("menu");
    }
  }
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
  else if (e.key === "Escape" && $("#screen-leaderboard")?.classList.contains("active")) {
    Audio2.click();
    const back = document.querySelector("#screen-leaderboard .back[data-to], #screen-leaderboard .panel-head .back");
    show(back?.dataset?.to || "home");
  }
  else if (e.key === "Escape" && ($("#screen-characters").classList.contains("active") || $("#screen-home").classList.contains("active"))) { Audio2.click(); show("home"); }
  else if (e.key === "Escape" && $("#screen-aden-map")?.classList.contains("active")) {
    Audio2.click();
    if (typeof closeAdenMapScreen === "function") closeAdenMapScreen();
    else show("clan");
  }
  else if (e.key === "Escape" && ($("#screen-clan-grounds")?.classList.contains("active") || $("#screen-clan-warehouse")?.classList.contains("active") || $("#screen-clan-buffs")?.classList.contains("active") || $("#screen-clan-raid")?.classList.contains("active") || $("#screen-clan-rank")?.classList.contains("active"))) {
    Audio2.click();
    if (typeof openClanScreen === "function") openClanScreen();
    else show("clan");
  }
  else if (e.key === "Escape" && $("#screen-inv").classList.contains("active") && typeof isInvCrySelectMode === "function" && isInvCrySelectMode()) {
    Audio2.click();
    if (typeof exitInvCrySelectMode === "function") exitInvCrySelectMode();
    if (typeof renderInventory === "function") renderInventory();
  }
  else if (e.key === "Escape" && ($("#screen-inv").classList.contains("active") || $("#screen-ach").classList.contains("active") || $("#screen-shop").classList.contains("active") || $("#screen-avatar").classList.contains("active") || $("#screen-quests").classList.contains("active") || $("#screen-engagement")?.classList.contains("active") || $("#screen-pvp-arena")?.classList.contains("active") || $("#screen-party")?.classList.contains("active") || $("#screen-clan")?.classList.contains("active") || $("#screen-player-mail")?.classList.contains("active") || $("#screen-market")?.classList.contains("active") || $("#screen-glossary")?.classList.contains("active"))) { show("menu"); }
  if (e.key.toLowerCase() === "m" && document.activeElement.id !== "devSearchInput") toggleMute();
});

syncSettingsUI();
if (typeof wireAudioVolumeSettings === "function") wireAudioVolumeSettings();
if (isDesktopApp && state.alwaysOnTop) window.soulforgeDesktop.setAlwaysOnTop(true);
$("#adena").textContent = fmt(state.adena);
initGameLog();
if (typeof initGameChat === "function") initGameChat();
if (saveNotice) { toast(saveNotice, "system"); saveNotice = null; }
if (trimInventoryToCap()) toast("Инвентарь обрезан до " + INV_CAP + " ячеек", "warn");
if (state.inventory) state.inventory.forEach(normalizeInvItem);
migrateCollectibles();
migrateCollectiblesToInventory();
if (typeof wireBananDev === "function") wireBananDev();
wireAuthorPanel();
wireIntro();
if (typeof wireMentorUI === "function") wireMentorUI();
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
if (typeof migrateArmorSetMaterials === "function") migrateArmorSetMaterials();
if (typeof migrateJewelrySetPieces === "function") migrateJewelrySetPieces();
if (typeof applyUiIconsToFarmZones === "function") applyUiIconsToFarmZones();
if (typeof applyUiIconsToQuestNpcs === "function") applyUiIconsToQuestNpcs();
if (typeof wireStoryArcBar === "function") wireStoryArcBar();
if (typeof wireMineStory === "function") wireMineStory();
if (typeof wireMineSidePanelsLayout === "function") wireMineSidePanelsLayout();
if (typeof wireGlossaryTips === "function") wireGlossaryTips();
if (typeof wireGlossaryScreen === "function") wireGlossaryScreen();
if (typeof ensurePassiveIncomeState === "function") ensurePassiveIncomeState();
if (typeof ensureAutoClickerState === "function") ensureAutoClickerState();
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
