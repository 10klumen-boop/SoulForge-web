// ===== Главное меню (title screen) =====

function applyVersionLabels() {
  const v = typeof GAME_VERSION !== "undefined" ? GAME_VERSION : "0.35a";
  const label = "v" + v;
  document.querySelectorAll("[data-game-ver]").forEach((el) => {
    el.textContent = label;
  });
  const patchSub = document.getElementById("loginPatchSub") || document.getElementById("homePatchSub");
  if (patchSub) patchSub.textContent = "История обновлений · " + label;
  document.title = "SoulForge Lineage 2 — Enchant Sim " + label;
  if (typeof updateHomeCharsSubtitle === "function") updateHomeCharsSubtitle();
}

function openLoginScreen() {
  if (typeof Audio2 !== "undefined") Audio2.click();
  try {
    if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
    if (typeof save === "function") save();
  } catch (e) {}
  if (typeof syncCloudUI === "function") syncCloudUI();
  show("login");
}

/** Сменить аккаунт = полный logout (lease + токен), не просто экран входа. */
async function switchAccountFromHome() {
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof readCloudAuth === "function" && readCloudAuth()?.token) {
    if (typeof cloudLogout === "function") {
      await cloudLogout();
      return;
    }
    if (window.SoulforgeCloud?.logout) {
      await window.SoulforgeCloud.logout();
      return;
    }
  }
  openLoginScreen();
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
    if (typeof toast === "function") {
      const n =
        typeof listCreatedCharacters === "function" ? listCreatedCharacters().length : 0;
      toast(
        n === 0 ? "Сначала создай персонажа в «Персонажи»" : "Досоздай персонажа: имя, раса, класс",
        "warn"
      );
    }
    openCharactersScreen();
    return;
  }
  if (typeof renderMenu === "function") renderMenu();
  show("menu");
  if (typeof Audio2 !== "undefined") Audio2.open();
  if (typeof runGameEntryModals === "function") {
    Promise.resolve(runGameEntryModals()).catch((e) => console.error("runGameEntryModals failed:", e));
  }
}

function setTitleBackToLogin(screenId, label) {
  const back = document.querySelector("#screen-" + screenId + " .panel-head .back");
  if (!back) return;
  back.dataset.to = "login";
  back.textContent = label || "← Вход";
  back.onclick = () => {
    if (typeof Audio2 !== "undefined") Audio2.click();
    show("login");
  };
}

function wireLoginCornerMenu() {
  const settingsBtn = document.getElementById("loginSettingsBtn");
  if (settingsBtn && !settingsBtn.dataset.wired) {
    settingsBtn.dataset.wired = "1";
    settingsBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setTitleBackToLogin("settings");
      show("settings");
    };
  }
  const patchBtn = document.getElementById("loginPatchBtn");
  if (patchBtn && !patchBtn.dataset.wired) {
    patchBtn.dataset.wired = "1";
    patchBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setTitleBackToLogin("patch");
      show("patch");
    };
  }
  const authorBtn = document.getElementById("loginAuthorBtn");
  if (authorBtn && !authorBtn.dataset.wired) {
    authorBtn.dataset.wired = "1";
    authorBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setTitleBackToLogin("author");
      show("author");
    };
  }
}

function wireHomeMenu() {
  applyVersionLabels();
  wireLoginCornerMenu();

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

  const login = document.getElementById("homeLoginBtn");
  if (login && !login.dataset.wired) {
    login.dataset.wired = "1";
    login.onclick = () => {
      if (typeof switchAccountFromHome === "function") switchAccountFromHome();
      else openLoginScreen();
    };
  }

  const settings = document.getElementById("homeSettingsBtn");
  if (settings && !settings.dataset.wired) {
    settings.dataset.wired = "1";
    settings.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      const back = document.querySelector("#screen-settings .panel-head .back");
      if (back) {
        back.dataset.to = "home";
        back.textContent = "← Главное меню";
        back.onclick = () => {
          if (typeof Audio2 !== "undefined") Audio2.click();
          show("home");
        };
      }
      show("settings");
    };
  }

  const hubHome = document.getElementById("hubHomeBtn");
  if (hubHome && !hubHome.dataset.wired) {
    hubHome.dataset.wired = "1";
    hubHome.onclick = () => openHome();
  }

  if (typeof wireCharacterMenu === "function") wireCharacterMenu();
}
