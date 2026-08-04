function gameDoc() {
  if (pipWindow && !pipWindow.closed && pipWindow.document.querySelector(".app")) return pipWindow.document;
  return document;
}
const $ = (s) => gameDoc().querySelector(s);
const $$ = (s) => gameDoc().querySelectorAll(s);
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
/** Только UI: урон/HP мобов ×10 (визуальные нули), на расчёты не влияет. */
const COMBAT_DISPLAY_SCALE = 10;
const fmtCombat = (n) => fmt((Math.round(Number(n) || 0)) * COMBAT_DISPLAY_SCALE);
function fmtAdena(n) {
  if (n >= 1e9) return (n/1e9).toFixed(2).replace(/\.?0+$/,"") + "kkk";
  if (n >= 1e6) return (n/1e6).toFixed(n % 1e6 ? 1 : 0) + "kk";
  if (n >= 1e3) return (n/1e3).toFixed(0) + "k";
  return String(n);
}

const SCREEN_LEAVE_MS = 300;
let _screenLeaveTimer = null;

function prefersReducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (_) {
    return false;
  }
}

function show(screen) {
  if (typeof cloudGateScreen === "function" && !cloudGateScreen(screen)) {
    screen = "login";
  }
  const target = $("#screen-" + screen);
  if (!target) return;

  const reduced = prefersReducedMotion();
  const prev = gameDoc().querySelector(".screen.active");
  const same = prev === target;

  if (_screenLeaveTimer) {
    clearTimeout(_screenLeaveTimer);
    _screenLeaveTimer = null;
  }
  gameDoc().querySelectorAll(".screen.is-leaving").forEach((el) => {
    if (el !== prev) el.classList.remove("is-leaving");
  });

  if (!same) {
    if (prev) {
      if (reduced) {
        prev.classList.remove("active", "is-leaving");
      } else {
        prev.classList.remove("active");
        prev.classList.add("is-leaving");
        const leaving = prev;
        _screenLeaveTimer = setTimeout(() => {
          leaving.classList.remove("is-leaving");
          _screenLeaveTimer = null;
        }, SCREEN_LEAVE_MS);
      }
    } else {
      $$(".screen").forEach((s) => s.classList.remove("active", "is-leaving"));
    }

    target.classList.remove("is-leaving", "active");
    if (!reduced) {
      // перезапуск enter-анимации при каждом входе на экран
      void target.offsetWidth;
    }
    target.classList.add("active");
  } else {
    target.classList.remove("is-leaving");
    target.classList.add("active");
  }

  const app = gameDoc().querySelector(".app");
  const subScreens = new Set(["mine", "ach", "avatar", "quests", "engagement", "inv", "shop", "ench", "acc", "account-storage", "player-mail", "market", "pvp-arena", "party", "clan", "clan-grounds", "clan-warehouse", "clan-buffs", "clan-raid", "clan-rank", "aden-map", "glossary", "banana-casino"]);
  if (app) {
    const titleScreens = ["home", "settings", "patch", "author", "characters"];
    app.classList.toggle("hub-screen", screen === "menu");
    app.classList.toggle("title-screen", titleScreens.includes(screen));
    app.classList.toggle("login-screen", screen === "login");
    app.classList.toggle("sub-screen", subScreens.has(screen));
  }
  const card = app?.querySelector(".card");
  if (card) card.scrollTop = 0;
  target.querySelectorAll(
    ".sf-scroll, .ach-scroll, .wlist, .wsbody, .ench, .avatar-screen, .quest-journal-list"
  ).forEach((el) => {
    el.scrollTop = 0;
  });
  if (typeof Audio2 !== "undefined" && Audio2.setScreen) {
    Audio2.setScreen(screen);
  }
  if (screen !== "inv" && typeof exitInvCrySelectMode === "function") {
    exitInvCrySelectMode();
  }
  if (screen === "settings") {
    const pop = document.getElementById("settingsPop");
    if (pop) pop.hidden = false;
    if (typeof syncSettingsUI === "function") syncSettingsUI();
  }
  if (screen === "glossary" && typeof renderGlossaryScreen === "function") {
    renderGlossaryScreen();
  }
  if (screen === "banana-casino" && typeof renderBananaCasinoScreen === "function") {
    renderBananaCasinoScreen();
  }
  if (screen === "menu" || screen === "home") {
    if (typeof refreshPlayerMailBadgeOnly === "function") {
      refreshPlayerMailBadgeOnly();
    }
    if (typeof startPlayerMailBadgePoll === "function") {
      startPlayerMailBadgePoll();
    }
  }
  if (screen === "login" && typeof syncCloudUI === "function") syncCloudUI();
  if (typeof syncCharacterSessionOverlays === "function") syncCharacterSessionOverlays();
  if (
    screen === "login" ||
    screen === "home" ||
    screen === "characters" ||
    screen === "settings" ||
    screen === "patch" ||
    screen === "author"
  ) {
    if (typeof hideMentorUI === "function") hideMentorUI();
  } else if (typeof mentorEmit === "function") {
    if (screen === "inv") mentorEmit("screen_inv");
    else if (screen === "ench") mentorEmit("screen_ench");
    else if (screen === "shop") mentorEmit("screen_shop");
    else if (screen === "quests") mentorEmit("screen_quests");
    else if (screen === "avatar" || screen === "ach" || screen === "menu" || screen === "mine") {
      if (typeof mentorScheduleResume === "function") mentorScheduleResume(40);
      else if (typeof mentorResume === "function") {
        setTimeout(() => mentorResume(), 40);
      }
    }
  }
}

/** В игре с созданным персонажем (не логин / title / выбор слота). */
function isInCharacterSession() {
  try {
    if (!state?.avatar?.created) return false;
  } catch (_) {
    return false;
  }
  const active = gameDoc().querySelector(".screen.active");
  if (!active || !active.id) return false;
  const id = String(active.id).replace(/^screen-/, "");
  const titleOrAuth = {
    login: 1,
    home: 1,
    characters: 1,
    settings: 1,
    patch: 1,
    author: 1,
  };
  return !titleOrAuth[id];
}

/** Чат и журнал — только после входа на персонажа. */
function syncCharacterSessionOverlays() {
  const on = isInCharacterSession();
  try {
    document.body.classList.toggle("sf-char-session", on);
  } catch (_) {}
  if (!on && typeof hideMentorUI === "function") hideMentorUI();
  if (typeof renderPartyPanel === "function") renderPartyPanel();
}

let _confirmResolve = null;
let _confirmEscapeAsOk = false;
let _confirmSticky = false;
let _confirmLocked = false;
let _confirmLockTimer = null;

function closeConfirm(result) {
  if (_confirmLocked) return;
  const backdrop = document.getElementById("modalBackdrop");
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  const box = backdrop.querySelector(".modal-box");
  if (box && box.dataset.sfBoxClass) {
    box.classList.remove(box.dataset.sfBoxClass);
    delete box.dataset.sfBoxClass;
  }
  document.removeEventListener("keydown", _confirmKeyHandler);
  if (_confirmLockTimer) {
    clearTimeout(_confirmLockTimer);
    _confirmLockTimer = null;
  }
  _confirmEscapeAsOk = false;
  _confirmSticky = false;
  _confirmLocked = false;
  const resolve = _confirmResolve;
  _confirmResolve = null;
  if (resolve) resolve(!!result);
}

function _confirmKeyHandler(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (_confirmSticky || _confirmLocked) return;
    Audio2.click();
    closeConfirm(_confirmEscapeAsOk);
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (_confirmSticky || _confirmLocked) return;
    Audio2.click();
    closeConfirm(true);
  }
}

function showConfirm(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const backdrop = document.getElementById("modalBackdrop");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl = document.getElementById("modalBody");
    const okBtn = document.getElementById("modalOk");
    const cancelBtn = document.getElementById("modalCancel");
    if (!backdrop || !titleEl || !bodyEl || !okBtn || !cancelBtn) {
      resolve(false);
      return;
    }
    // Не перебивать sticky+lock (вызов на дуэль) другим диалогом
    if (_confirmResolve && _confirmSticky && _confirmLocked) {
      resolve(false);
      return;
    }
    // Сброс зависшего диалога (иначе кристаллизация/сброс молча отменяются)
    if (_confirmResolve) {
      const stale = _confirmResolve;
      _confirmResolve = null;
      try { stale(false); } catch (_) {}
    }
    if (_confirmLockTimer) {
      clearTimeout(_confirmLockTimer);
      _confirmLockTimer = null;
    }
    _confirmResolve = resolve;
    const hideCancel = !!opts.hideCancel;
    const sticky = !!opts.sticky;
    const lockMs = Math.max(0, Number(opts.lockMs) || 0);
    _confirmEscapeAsOk = hideCancel;
    _confirmSticky = sticky;
    _confirmLocked = lockMs > 0;

    titleEl.textContent = opts.title || "Подтверждение";
    if (opts.html) bodyEl.innerHTML = opts.html;
    else {
      const lines = String(opts.message || "").split("\n").filter((l) => l.length);
      bodyEl.innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
    }
    okBtn.textContent = opts.okText || "OK";
    cancelBtn.textContent = opts.cancelText || "Отмена";
    okBtn.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.hidden = hideCancel;
    okBtn.disabled = false;
    cancelBtn.disabled = false;

    const onOk = () => {
      if (_confirmLocked) return;
      Audio2.click();
      closeConfirm(true);
    };
    const onCancel = () => {
      if (_confirmLocked) return;
      Audio2.click();
      closeConfirm(false);
    };
    okBtn.onclick = onOk;
    cancelBtn.onclick = onCancel;
    const blockBackdrop = (e) => {
      if (e.target !== backdrop) return;
      if (sticky || _confirmLocked) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (hideCancel) onOk();
      else onCancel();
    };
    backdrop.onclick = blockBackdrop;
    backdrop.onpointerdown = blockBackdrop;

    const box = backdrop.querySelector(".modal-box");
    if (box) {
      if (box.dataset.sfBoxClass) {
        box.classList.remove(box.dataset.sfBoxClass);
        delete box.dataset.sfBoxClass;
      }
      if (opts.boxClass) {
        box.classList.add(opts.boxClass);
        box.dataset.sfBoxClass = opts.boxClass;
      }
      box.onpointerdown = (e) => e.stopPropagation();
      box.onclick = (e) => e.stopPropagation();
    }

    if (lockMs > 0) {
      okBtn.disabled = true;
      cancelBtn.disabled = true;
      const hint = document.createElement("p");
      hint.className = "modal-lock-hint";
      const sec = Math.round(lockMs / 100) / 10;
      hint.textContent =
        "Подождите " + (Number.isInteger(sec) ? String(sec) : String(sec).replace(".", ",")) + "…";
      bodyEl.appendChild(hint);
      _confirmLockTimer = setTimeout(() => {
        _confirmLockTimer = null;
        _confirmLocked = false;
        okBtn.disabled = false;
        cancelBtn.disabled = false;
        if (hint.parentNode) hint.parentNode.removeChild(hint);
      }, lockMs);
    }

    backdrop.hidden = false;
    document.addEventListener("keydown", _confirmKeyHandler);
    if (!_confirmLocked) {
      (sticky || hideCancel ? okBtn : cancelBtn).focus();
    }
  });
}

/** Визуальные #toast-попапы выключены — текст только в журнал (gameLog). */
const TOAST_POPUPS_ENABLED = false;

function toast(msg, kind) {
  const k = kind || "info";
  // system — служебные уведомления (save/seal), не в журнал
  if (k !== "system" && typeof gameLog === "function") gameLog(msg, k);
  if (!TOAST_POPUPS_ENABLED) return;
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 1800);
}
const MAX_PLUS = 16;
