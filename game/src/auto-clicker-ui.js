// ===== Автокликер: UI (панель на экране Персонаж + HUD на поле) =====

const AUTO_CLICKER_ICON = "icons/auto_strike.png?v=1";

function formatAutoClickerRemaining(ms) {
  ms = Math.max(0, Math.floor(ms || 0));
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function autoClickerPacksButtonsHtml() {
  const packs = typeof AUTO_CLICKER !== "undefined" ? AUTO_CLICKER.packs : [];
  const fmtA = typeof fmtAdena === "function" ? fmtAdena : (n) => String(n);
  return packs
    .map((p) => {
      const price = typeof autoClickerPackPrice === "function" ? autoClickerPackPrice(p) : p.price;
      const can = typeof autoClickerCanBuyPack === "function" ? autoClickerCanBuyPack(p) : { ok: true };
      const poor = (state.adena || 0) < price;
      const disabled = !can.ok || poor;
      const title = !can.ok
        ? can.reason || "Недоступно"
        : poor
          ? "Не хватает adena"
          : p.label + " · " + fmtA(price);
      return (
        '<button type="button" class="mine-autoclicker-buy auto-clicker-buy"' +
        (disabled ? " disabled" : "") +
        ' data-pack="' +
        p.id +
        '" title="' +
        title.replace(/"/g, "&quot;") +
        '">' +
        p.label +
        " · " +
        fmtA(price) +
        "</button>"
      );
    })
    .join("");
}

function wireAutoClickerBuyButtons(root) {
  if (!root) return;
  root.querySelectorAll(".auto-clicker-buy").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof buyAutoClickerPack === "function") buyAutoClickerPack(btn.dataset.pack);
    };
  });
}

function renderAutoClickerPanel(opts) {
  opts = opts || {};
  const root = document.getElementById("autoClickerPanel");
  if (!root) return;
  if (typeof ensureAutoClickerState === "function") ensureAutoClickerState();
  if (typeof clampAutoClickerToMax === "function") clampAutoClickerToMax();
  if (!state.avatar?.created) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  root.hidden = false;
  const rem = typeof autoClickerRemainingMs === "function" ? autoClickerRemainingMs() : 0;
  const enabled = state.autoClicker?.enabled !== false;
  const maxMs =
    typeof autoClickerMaxStackMs === "function"
      ? autoClickerMaxStackMs()
      : AUTO_CLICKER?.maxStackMs || 0;
  const maxH = maxMs > 0 ? Math.round(maxMs / 3600000) : 0;
  const status = opts.status
    ? '<p class="avatar-boost-status avatar-boost-status--' +
      (opts.statusKind || "ok") +
      '">' +
      opts.status +
      "</p>"
    : "";

  root.innerHTML =
    '<div class="avatar-boost-head">' +
    '<img class="avatar-boost-ico" src="' +
    AUTO_CLICKER_ICON +
    '" alt="" width="40" height="40">' +
    '<div class="avatar-boost-titles">' +
    "<b>Автоудар</b>" +
    '<span class="avatar-boost-meta">' +
    (rem > 0
      ? formatAutoClickerRemaining(rem) + (enabled ? " · вкл" : " · пауза")
      : "не куплен") +
    (maxH > 0 ? " · макс. " + maxH + " ч" : "") +
    "</span>" +
    "</div>" +
    "</div>" +
    '<p class="avatar-boost-line">Пакеты 15/30/60 мин — в окне боя на поле задания (рядом с Вкл/Выкл). Цена растёт с главой. Стак до ' +
    (maxH > 0 ? maxH + " ч" : "лимита") +
    ".</p>" +
    status +
    (rem > 0
      ? '<div class="avatar-boost-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" id="autoClickerToggleBtn">' +
        (enabled ? "Выключить" : "Включить") +
        "</button>" +
        "</div>"
      : "");

  const toggle = document.getElementById("autoClickerToggleBtn");
  if (toggle) {
    toggle.onclick = () => {
      if (typeof toggleAutoClickerEnabled === "function") toggleAutoClickerEnabled();
    };
  }
}

function renderAutoClickerHud() {
  const row = document.getElementById("mineAutoClickerRow");
  const hud = document.getElementById("mineAutoClickerHud");
  const packsEl = document.getElementById("mineAutoClickerPacks");
  if (!row || !hud) return;
  if (typeof ensureAutoClickerState === "function") ensureAutoClickerState();
  if (typeof clampAutoClickerToMax === "function") clampAutoClickerToMax();
  if (typeof autoClickerBlockedInCurrentMine === "function" && autoClickerBlockedInCurrentMine()) {
    row.hidden = true;
    return;
  }
  if (!state.avatar?.created) {
    row.hidden = true;
    return;
  }

  const rem = typeof autoClickerRemainingMs === "function" ? autoClickerRemainingMs() : 0;
  const active = typeof autoClickerIsActive === "function" ? autoClickerIsActive() : false;
  const enabled = state.autoClicker?.enabled !== false;

  row.hidden = false;
  hud.hidden = false;
  hud.classList.toggle("is-on", !!active);
  hud.classList.toggle("is-paused", rem > 0 && !enabled);
  hud.classList.toggle("is-empty", rem <= 0);
  hud.setAttribute("aria-pressed", active ? "true" : "false");
  hud.disabled = rem <= 0;
  hud.title =
    rem <= 0
      ? "Купи пакет справа, чтобы запустить автоудар"
      : enabled
        ? "Нажми, чтобы выключить автоудар"
        : "Нажми, чтобы включить автоудар";

  const label = document.getElementById("mineAutoClickerLabel");
  const hint = document.getElementById("mineAutoClickerToggleHint");
  if (label) {
    label.textContent =
      rem > 0 ? "Автоудар " + formatAutoClickerRemaining(rem) : "Автоудар";
  }
  if (hint) {
    hint.hidden = rem <= 0;
    hint.textContent = enabled ? "Вкл" : "Выкл";
  }

  if (packsEl) {
    packsEl.innerHTML = autoClickerPacksButtonsHtml();
    wireAutoClickerBuyButtons(packsEl);
  }

  if (!hud.dataset.wired) {
    hud.dataset.wired = "1";
    hud.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof autoClickerRemainingMs === "function" && autoClickerRemainingMs() <= 0) return;
      if (typeof toggleAutoClickerEnabled === "function") toggleAutoClickerEnabled();
      renderAutoClickerHud();
    });
  }
}
