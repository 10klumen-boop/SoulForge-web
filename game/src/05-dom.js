function gameDoc() {
  if (pipWindow && !pipWindow.closed && pipWindow.document.querySelector(".app")) return pipWindow.document;
  return document;
}
const $ = (s) => gameDoc().querySelector(s);
const $$ = (s) => gameDoc().querySelectorAll(s);
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
function fmtAdena(n) {
  if (n >= 1e9) return (n/1e9).toFixed(2).replace(/\.?0+$/,"") + "kkk";
  if (n >= 1e6) return (n/1e6).toFixed(n % 1e6 ? 1 : 0) + "kk";
  if (n >= 1e3) return (n/1e3).toFixed(0) + "k";
  return String(n);
}
function show(screen) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#screen-" + screen).classList.add("active");
  const app = gameDoc().querySelector(".app");
  if (app) {
    const titleScreens = ["login", "home", "settings", "patch", "author", "characters"];
    app.classList.toggle("hub-screen", screen === "menu");
    app.classList.toggle("title-screen", titleScreens.includes(screen));
    app.classList.toggle("login-screen", screen === "login");
  }
  if (typeof Audio2 !== "undefined" && Audio2.setScreen) {
    Audio2.setScreen(screen);
  }
  if (screen === "settings") {
    const pop = document.getElementById("settingsPop");
    if (pop) pop.hidden = false;
    if (typeof syncSettingsUI === "function") syncSettingsUI();
    if (typeof refreshCloudAdminAvailability === "function") refreshCloudAdminAvailability();
  }
  if (screen === "login" && typeof syncCloudUI === "function") syncCloudUI();
}

let _confirmResolve = null;

function closeConfirm(result) {
  const backdrop = document.getElementById("modalBackdrop");
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  document.removeEventListener("keydown", _confirmKeyHandler);
  const resolve = _confirmResolve;
  _confirmResolve = null;
  if (resolve) resolve(!!result);
}

function _confirmKeyHandler(e) {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); Audio2.click(); closeConfirm(false); }
  if (e.key === "Enter") { e.preventDefault(); Audio2.click(); closeConfirm(true); }
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

    const onOk = () => { Audio2.click(); closeConfirm(true); };
    const onCancel = () => { Audio2.click(); closeConfirm(false); };
    okBtn.onclick = onOk;
    cancelBtn.onclick = onCancel;
    backdrop.onclick = (e) => { if (e.target === backdrop) onCancel(); };

    backdrop.hidden = false;
    document.addEventListener("keydown", _confirmKeyHandler);
    cancelBtn.focus();
  });
}

function toast(msg, kind) {
  const k = kind || "info";
  // system — служебные уведомления (save/seal), не в журнал
  if (k !== "system" && typeof gameLog === "function") gameLog(msg, k);
  const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800);
}
const MAX_PLUS = 16;
