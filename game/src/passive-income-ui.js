// ===== Пассивный доход: UI (панель на экране Персонаж + модалка при «Играть») =====

const PASSIVE_INCOME_ICON = "icons/etc_adena_i00.png";
const PASSIVE_WAREHOUSE_ICON = "assets/ui/inventory_book_crop.png?v=10";

function formatPassiveDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + " ч " + m + " мин";
  if (m > 0) return m + " мин";
  return sec + " сек";
}

function renderPassiveIncomePanel(opts) {
  opts = opts || {};
  const root = document.getElementById("passiveIncomePanel");
  if (!root) return;
  if (typeof ensurePassiveIncomeState === "function") ensurePassiveIncomeState();
  if (!state.avatar?.created) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  root.hidden = false;
  const rate = typeof passiveRatePerSec === "function" ? passiveRatePerSec() : 0;
  const capSec = typeof passiveCapSec === "function" ? passiveCapSec() : 0;
  const pending = typeof passivePendingAdena === "function" ? passivePendingAdena() : 0;
  const pendingSec = typeof passivePendingSec === "function" ? passivePendingSec() : 0;
  const wh = state.passiveIncome?.warehouseLv || 0;
  const maxWh = typeof PASSIVE_INCOME !== "undefined" ? PASSIVE_INCOME.warehouseMaxLv : 4;
  const chapters = typeof passiveCompletedChaptersCount === "function" ? passiveCompletedChaptersCount() : 0;
  const nextPrice = typeof warehouseNextPrice === "function" ? warehouseNextPrice() : null;
  const rateMin = Math.round(rate * 60);
  const fmtA = typeof fmtAdena === "function" ? fmtAdena : (n) => String(n);
  const status = opts.status
    ? '<p class="avatar-boost-status avatar-boost-status--' + (opts.statusKind || "ok") + '">' + opts.status + "</p>"
    : "";

  root.innerHTML =
    '<div class="avatar-boost-head">' +
      '<img class="avatar-boost-ico" src="' + PASSIVE_INCOME_ICON + '" alt="" width="40" height="40">' +
      '<div class="avatar-boost-titles">' +
        "<b>Пассивный доход</b>" +
        '<span class="avatar-boost-meta">оффлайн · кап ' + formatPassiveDuration(capSec) + "</span>" +
      "</div>" +
    "</div>" +
    '<p class="avatar-boost-line">Ставка: <b>' + fmtA(rateMin) + "</b> adena/мин" +
      " · главы +" + chapters + "ч · склад " + wh + "/" + maxWh + "</p>" +
    '<p class="avatar-boost-line">Накоплено: <b>' + fmtA(pending) + "</b>" +
      (pendingSec > 0 ? " (" + formatPassiveDuration(pendingSec) + ")" : "") + "</p>" +
    status +
    '<div class="avatar-boost-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm" id="passiveCollectBtn">Забрать сейчас</button>' +
      (nextPrice != null
        ? '<button type="button" class="btn btn-primary btn-sm" id="passiveWarehouseBtn">' +
            '<img class="btn-inline-ico" src="' + PASSIVE_WAREHOUSE_ICON + '" alt="">' +
            "Склад +2ч · " + fmtA(nextPrice) +
          "</button>"
        : '<span class="avatar-boost-max">Склад макс.</span>') +
    "</div>";

  const collectBtn = document.getElementById("passiveCollectBtn");
  if (collectBtn) {
    collectBtn.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      let res = { amount: 0 };
      if (typeof collectPassiveIncome === "function") {
        res = collectPassiveIncome({ queueNotice: false }) || res;
      }
      const label = typeof fmtAdena === "function" ? fmtAdena(res.amount || 0) : String(res.amount || 0);
      renderPassiveIncomePanel({
        status: (res.amount || 0) > 0 ? "Забрано +" + label + " adena" : "Пока нечего забирать",
        statusKind: (res.amount || 0) > 0 ? "ok" : "warn",
      });
    };
  }
  const whBtn = document.getElementById("passiveWarehouseBtn");
  if (whBtn) {
    whBtn.onclick = () => {
      if (typeof buyPassiveWarehouse === "function") buyPassiveWarehouse();
    };
  }
}

/** Модалка оффлайн-адены — только при входе «Играть» из главного меню. */
async function showPassiveIncomeEntryModal() {
  if (typeof collectPassiveIncome === "function") {
    try { collectPassiveIncome({ queueNotice: true, log: true }); } catch (e) {}
  }
  if (typeof takePassiveIncomeNotice !== "function") return false;
  const notice = takePassiveIncomeNotice();
  if (!notice || !(notice.amount > 0)) return false;
  if (typeof showConfirm !== "function") return false;

  const fmtA = typeof fmtAdena === "function" ? fmtAdena : (n) => String(n);
  const dur = formatPassiveDuration(notice.sec);
  if (typeof Audio2 !== "undefined" && Audio2.coin) Audio2.coin();

  await showConfirm({
    title: "Склад adena",
    hideCancel: true,
    okText: "Отлично",
    html:
      '<div class="passive-earn">' +
        '<img class="passive-earn-ico" src="' + PASSIVE_INCOME_ICON + '" alt="">' +
        '<p class="passive-earn-kicker">Пока тебя не было</p>' +
        '<p class="passive-earn-amount">+' + fmtA(notice.amount) + ' <span>adena</span></p>' +
        (notice.sec > 0
          ? '<p class="passive-earn-meta">накоплено за ' + dur + "</p>"
          : "") +
      "</div>",
  });
  return true;
}
