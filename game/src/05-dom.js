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
  const subScreens = new Set(["mine", "ach", "avatar", "quests", "inv", "shop", "ench", "acc", "account-storage", "player-mail", "market", "pvp-arena"]);
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
  if (screen === "settings") {
    const pop = document.getElementById("settingsPop");
    if (pop) pop.hidden = false;
    if (typeof syncSettingsUI === "function") syncSettingsUI();
  }
  if (screen === "login" && typeof syncCloudUI === "function") syncCloudUI();
}

let _confirmResolve = null;
let _confirmEscapeAsOk = false;
let _confirmSticky = false;

function closeConfirm(result) {
  const backdrop = document.getElementById("modalBackdrop");
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  document.removeEventListener("keydown", _confirmKeyHandler);
  _confirmEscapeAsOk = false;
  _confirmSticky = false;
  const resolve = _confirmResolve;
  _confirmResolve = null;
  if (resolve) resolve(!!result);
}

function _confirmKeyHandler(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    // Sticky: только кнопки — случайный Esc/клик не закрывает
    if (_confirmSticky) return;
    Audio2.click();
    closeConfirm(_confirmEscapeAsOk);
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (_confirmSticky) return;
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
    // Сброс зависшего диалога (иначе кристаллизация/сброс молча отменяются)
    if (_confirmResolve) {
      const stale = _confirmResolve;
      _confirmResolve = null;
      try { stale(false); } catch (_) {}
    }
    _confirmResolve = resolve;
    const hideCancel = !!opts.hideCancel;
    const sticky = !!opts.sticky;
    _confirmEscapeAsOk = hideCancel;
    _confirmSticky = sticky;

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

    const onOk = () => { Audio2.click(); closeConfirm(true); };
    const onCancel = () => { Audio2.click(); closeConfirm(false); };
    okBtn.onclick = onOk;
    cancelBtn.onclick = onCancel;
    backdrop.onclick = (e) => {
      if (e.target !== backdrop) return;
      if (sticky) return;
      if (hideCancel) onOk();
      else onCancel();
    };

    backdrop.hidden = false;
    document.addEventListener("keydown", _confirmKeyHandler);
    // Sticky-диалог: фокус на OK, но Enter не срабатывает — только тап по кнопке
    (sticky || hideCancel ? okBtn : cancelBtn).focus();
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
