// ===== Главное меню (title screen) =====

function applyVersionLabels() {
  const v = typeof GAME_VERSION !== "undefined" ? GAME_VERSION : "0.30a-r";
  const label = "v" + v;
  document.querySelectorAll("[data-game-ver]").forEach((el) => {
    el.textContent = label;
  });
  const patchSub = document.getElementById("homePatchSub");
  if (patchSub) patchSub.textContent = "История обновлений · " + label;
  document.title = "SoulForge Lineage 2 — Enchant Sim " + label;
  if (typeof updateHomeCharsSubtitle === "function") updateHomeCharsSubtitle();
}

function openHome() {
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof updateHomeCharsSubtitle === "function") updateHomeCharsSubtitle();
  if (typeof syncCloudUI === "function") syncCloudUI();
  show("home");
}

function openCharactersScreen() {
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof renderCharacterRoster === "function") renderCharacterRoster();
  show("characters");
}

function enterGameHub() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    openCharactersScreen();
    return;
  }
  if (typeof renderMenu === "function") renderMenu();
  show("menu");
  if (typeof Audio2 !== "undefined") Audio2.open();
  if (typeof runGameEntryModals === "function") runGameEntryModals();
}

function wireHomeMenu() {
  applyVersionLabels();

  const play = document.getElementById("homePlayBtn");
  if (play && !play.dataset.wired) {
    play.dataset.wired = "1";
    play.onclick = () => enterGameHub();
  }

  const chars = document.getElementById("homeCharsBtn");
  if (chars && !chars.dataset.wired) {
    chars.dataset.wired = "1";
    chars.onclick = () => openCharactersScreen();
  }

  const rating = document.getElementById("homeRatingBtn");
  if (rating && !rating.dataset.wired) {
    rating.dataset.wired = "1";
    rating.onclick = () => {
      if (typeof openLeaderboard === "function") openLeaderboard({ from: "home" });
      else if (typeof Audio2 !== "undefined") Audio2.click();
    };
  }

  const settings = document.getElementById("homeSettingsBtn");
  if (settings && !settings.dataset.wired) {
    settings.dataset.wired = "1";
    settings.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      show("settings");
    };
  }

  const patch = document.getElementById("homePatchBtn");
  if (patch && !patch.dataset.wired) {
    patch.dataset.wired = "1";
    patch.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      show("patch");
    };
  }

  const author = document.getElementById("homeAuthorBtn");
  if (author && !author.dataset.wired) {
    author.dataset.wired = "1";
    author.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      show("author");
    };
  }

  const hubHome = document.getElementById("hubHomeBtn");
  if (hubHome && !hubHome.dataset.wired) {
    hubHome.dataset.wired = "1";
    hubHome.onclick = () => openHome();
  }

  if (typeof wireCharacterMenu === "function") wireCharacterMenu();
}
