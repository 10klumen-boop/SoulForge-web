// ===== Автокликер: UI (панель на экране Персонаж + HUD на поле) =====

const AUTO_CLICKER_ICON = "icons/etc_scroll_of_return_i00.png";

function formatAutoClickerRemaining(ms) {
  ms = Math.max(0, Math.floor(ms || 0));
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function renderAutoClickerPanel(opts) {
  opts = opts || {};
  const root = document.getElementById("autoClickerPanel");
  if (!root) return;
  if (typeof ensureAutoClickerState === "function") ensureAutoClickerState();
  if (!state.avatar?.created) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  root.hidden = false;
  const rem = typeof autoClickerRemainingMs === "function" ? autoClickerRemainingMs() : 0;
  const active = typeof autoClickerIsActive === "function" ? autoClickerIsActive() : false;
  const enabled = state.autoClicker?.enabled !== false;
  const packs = typeof AUTO_CLICKER !== "undefined" ? AUTO_CLICKER.packs : [];
  const fmtA = typeof fmtAdena === "function" ? fmtAdena : (n) => String(n);
  const status = opts.status
    ? '<p class="avatar-boost-status avatar-boost-status--' + (opts.statusKind || "ok") + '">' + opts.status + "</p>"
    : "";

  const packsHtml = packs.map((p) => {
    const price = typeof autoClickerPackPrice === "function" ? autoClickerPackPrice(p) : p.price;
    return '<button type="button" class="btn btn-primary btn-sm auto-clicker-buy" data-pack="' + p.id + '">' +
      p.label + " · " + fmtA(price) + "</button>";
  }).join("");

  root.innerHTML =
    '<div class="avatar-boost-head">' +
      '<img class="avatar-boost-ico" src="' + AUTO_CLICKER_ICON + '" alt="" width="40" height="40">' +
      '<div class="avatar-boost-titles">' +
        "<b>Автоудар</b>" +
        '<span class="avatar-boost-meta">' +
          (rem > 0 ? formatAutoClickerRemaining(rem) + (enabled ? " · вкл" : " · пауза") : "не куплен") +
        "</span>" +
      "</div>" +
    "</div>" +
    '<p class="avatar-boost-line">Бьёт цели на поле задания, пока действует таймер. Цена растёт с главой зоны.</p>' +
    status +
    '<div class="avatar-boost-actions auto-clicker-packs">' + packsHtml + "</div>" +
    (rem > 0
      ? '<div class="avatar-boost-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="autoClickerToggleBtn">' +
            (enabled ? "Выключить" : "Включить") +
          "</button>" +
        "</div>"
      : "");

  root.querySelectorAll(".auto-clicker-buy").forEach((btn) => {
    btn.onclick = () => {
      if (typeof buyAutoClickerPack === "function") buyAutoClickerPack(btn.dataset.pack);
    };
  });
  const toggle = document.getElementById("autoClickerToggleBtn");
  if (toggle) {
    toggle.onclick = () => {
      if (typeof toggleAutoClickerEnabled === "function") toggleAutoClickerEnabled();
    };
  }
}

function renderAutoClickerHud() {
  const hud = document.getElementById("mineAutoClickerHud");
  if (!hud) return;
  const rem = typeof autoClickerRemainingMs === "function" ? autoClickerRemainingMs() : 0;
  const active = typeof autoClickerIsActive === "function" ? autoClickerIsActive() : false;
  if (rem <= 0) {
    hud.hidden = true;
    return;
  }
  hud.hidden = false;
  hud.innerHTML =
    '<img class="mine-autoclicker-ico" src="' + AUTO_CLICKER_ICON + '" alt="">' +
    "<span>Автоудар " + formatAutoClickerRemaining(rem) + (active ? "" : " (выкл)") + "</span>";
  hud.classList.toggle("is-on", !!active);
}
