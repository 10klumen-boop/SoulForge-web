// ===== UI: склад аккаунта =====

function openAccountStorage() {
  ensureAccountStorage();
  renderAccountStorage();
  show("account-storage");
  Audio2.open();
}

function accountStorageItemLabel(it) {
  if (!it) return "?";
  const def = typeof invItemDef === "function" ? invItemDef(it) : null;
  if (!def) return it.id || "?";
  const plus = it.plus ? " +" + it.plus : "";
  const grade = def.grade ? " [" + def.grade + "]" : "";
  return (def.name || it.id) + grade + plus;
}

function accountStorageItemIcon(it) {
  const def = typeof invItemDef === "function" ? invItemDef(it) : null;
  return def?.icon || "icons/weapon_small_sword_i00.png";
}

function renderAccountStorage() {
  ensureAccountStorage();
  const body = document.getElementById("accountStorageBody");
  if (!body) return;
  body.innerHTML = renderAccountWarehouseHtml();
  wireAccountWarehouseUi(body);
}

function accountStorageAdenaIcon() {
  return typeof ADENA_ICON !== "undefined" ? ADENA_ICON : "icons/etc_adena_i00.png";
}

function accountStorageFmtAdena(n) {
  return typeof fmtAdena === "function" ? fmtAdena(n) : String(n);
}

function renderAccountAdenaPanelHtml() {
  const whAdena = typeof accountWarehouseAdena === "function" ? accountWarehouseAdena() : 0;
  const charAdena = typeof characterAdenaBalance === "function" ? characterAdenaBalance() : Math.max(0, Math.floor(Number(state.adena) || 0));
  const depDefault = charAdena > 0 ? charAdena : 1;
  const wdDefault = whAdena > 0 ? whAdena : 1;
  const ico = accountStorageAdenaIcon();
  return (
    '<div class="account-adena-panel">' +
    '<div class="account-adena-row">' +
    '<img class="account-adena-ico" src="' +
    ico +
    '" alt="">' +
    "<div>" +
    "<b>Adena на складе</b>" +
    "<span>" +
    accountStorageFmtAdena(whAdena) +
    "</span>" +
    "</div>" +
    '<div class="account-adena-controls">' +
    '<input type="number" id="accountWhAdenaQty" min="1" max="' +
    Math.max(1, whAdena) +
    '" value="' +
    wdDefault +
    '"' +
    (whAdena ? "" : " disabled") +
    ">" +
    '<button type="button" class="btn btn-ghost btn-sm" data-wh-adena-max' +
    (whAdena ? "" : " disabled") +
    ">всё</button>" +
    '<button type="button" class="btn btn-primary btn-sm" data-wh-adena-out' +
    (whAdena ? "" : " disabled") +
    ">Забрать</button>" +
    "</div></div>" +
    '<div class="account-adena-row">' +
    '<img class="account-adena-ico" src="' +
    ico +
    '" alt="">' +
    "<div>" +
    "<b>У персонажа</b>" +
    "<span>" +
    accountStorageFmtAdena(charAdena) +
    "</span>" +
    "</div>" +
    '<div class="account-adena-controls">' +
    '<input type="number" id="accountDepAdenaQty" min="1" max="' +
    Math.max(1, charAdena) +
    '" value="' +
    depDefault +
    '"' +
    (charAdena ? "" : " disabled") +
    ">" +
    '<button type="button" class="btn btn-ghost btn-sm" data-dep-adena-max' +
    (charAdena ? "" : " disabled") +
    ">всё</button>" +
    '<button type="button" class="btn btn-primary btn-sm" data-dep-adena-in' +
    (charAdena ? "" : " disabled") +
    ">Положить</button>" +
    "</div></div>" +
    '<p class="account-storage-hint">Adena общая на складе аккаунта — любой персонаж может забрать.</p>' +
    "</div>"
  );
}

function renderAccountWarehouseHtml() {
  const items = state.accountWarehouse.items || [];
  const stacks = (state.accountWarehouse.stacks || []).filter((st) => st && st.kind !== "adena");
  const inv = (state.inventory || []).filter((it) => !accountItemTransferBlockedReason(it));
  const scrollStacks = typeof listScrollStacks === "function" ? listScrollStacks() : [];
  const used = accountWarehouseCount();
  let html = "";
  html +=
    '<div class="account-storage-split">' +
    '<section class="account-storage-col">' +
    "<h3>Склад аккаунта <span>(" +
    used +
    "/" +
    ACCOUNT_WAREHOUSE_CAP +
    ")</span></h3>" +
    '<p class="account-storage-hint">Общий для всех персонажей. Клик — забрать. Adena и свитки тоже сюда.</p>' +
    renderAccountAdenaPanelHtml() +
    '<div class="account-storage-grid" id="accountWhGrid">';
  if (!items.length && !stacks.length) html += '<p class="account-storage-empty">Нет предметов на складе</p>';
  else {
    items.forEach((it) => {
      html +=
        '<button type="button" class="account-storage-slot" data-wh-uid="' +
        it.uid +
        '" title="' +
        accountStorageItemLabel(it) +
        '">' +
        '<img src="' +
        accountStorageItemIcon(it) +
        '" alt="">' +
        (it.plus ? '<span class="ip">+' + it.plus + "</span>" : "") +
        "</button>";
    });
    stacks.forEach((st) => {
      const key = typeof accountWarehouseStackKey === "function" ? accountWarehouseStackKey(st) : "";
      const label =
        (typeof warehouseScrollLabel === "function" ? warehouseScrollLabel(st) : "Свиток") +
        " ×" +
        (st.qty || 0);
      const icon = typeof warehouseScrollIcon === "function" ? warehouseScrollIcon(st) : "";
      html +=
        '<button type="button" class="account-storage-slot inv-scroll" data-wh-scroll="' +
        key +
        '" title="' +
        label +
        ' · клик — забрать всё">' +
        '<img src="' +
        icon +
        '" alt="">' +
        '<span class="inv-stack-qty">×' +
        (st.qty || 0) +
        "</span>" +
        '<span class="inv-stack-badge">' +
        (st.grade || "") +
        "</span>" +
        "</button>";
    });
  }
  html += "</div></section>";

  html +=
    '<section class="account-storage-col">' +
    "<h3>Инвентарь <span>(" +
    (state.inventory || []).length +
    "/" +
    INV_CAP +
    ")</span></h3>" +
    '<p class="account-storage-hint">Клик — положить на склад. Стартовое и надетое недоступны.</p>' +
    '<div class="account-storage-grid" id="accountInvDepositGrid">';
  if (!inv.length) html += '<p class="account-storage-empty">Нечего положить</p>';
  else {
    inv.forEach((it) => {
      html +=
        '<button type="button" class="account-storage-slot" data-dep-uid="' +
        it.uid +
        '" title="' +
        accountStorageItemLabel(it) +
        '">' +
        '<img src="' +
        accountStorageItemIcon(it) +
        '" alt="">' +
        (it.plus ? '<span class="ip">+' + it.plus + "</span>" : "") +
        "</button>";
    });
  }
  html += "</div>";

  html +=
    '<h3 class="account-storage-subhead">Свитки <span>(' +
    scrollStacks.length +
    ")</span></h3>" +
    '<p class="account-storage-hint">Клик — положить весь стак на склад. На рынке: Продать → Свитки.</p>' +
    '<div class="account-storage-grid" id="accountScrollDepositGrid">';
  if (!scrollStacks.length) html += '<p class="account-storage-empty">Нет свитков у персонажа</p>';
  else {
    scrollStacks.forEach((st) => {
      const key = "scroll:" + st.target + ":" + st.typeId + ":" + st.grade;
      html +=
        '<button type="button" class="account-storage-slot inv-scroll" data-dep-scroll="' +
        key +
        '" data-qty="' +
        st.qty +
        '" title="' +
        st.name +
        " ×" +
        st.qty +
        '">' +
        '<img src="' +
        (st.icon || "") +
        '" alt="">' +
        '<span class="inv-stack-qty">×' +
        st.qty +
        "</span>" +
        '<span class="inv-stack-badge">' +
        (st.grade || "") +
        "</span>" +
        "</button>";
    });
  }
  html += "</div></section></div>";
  return html;
}

function refreshAccountStorageAfterMove() {
  renderAccountStorage();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof renderInventory === "function") renderInventory();
  const adenaEl = document.getElementById("adena");
  if (adenaEl && typeof fmt === "function") adenaEl.textContent = fmt(state.adena);
}

function wireAccountWarehouseUi(root) {
  const whQty = root.querySelector("#accountWhAdenaQty");
  const depQty = root.querySelector("#accountDepAdenaQty");
  root.querySelectorAll("[data-wh-adena-max]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      const max = typeof accountWarehouseAdena === "function" ? accountWarehouseAdena() : 0;
      if (whQty) whQty.value = String(Math.max(1, max));
    };
  });
  root.querySelectorAll("[data-dep-adena-max]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      const max = typeof characterAdenaBalance === "function" ? characterAdenaBalance() : 0;
      if (depQty) depQty.value = String(Math.max(1, max));
    };
  });
  root.querySelectorAll("[data-wh-adena-out]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      const qty = Math.max(1, Math.floor(Number(whQty && whQty.value) || 0));
      if (typeof withdrawAdenaFromWarehouse === "function" && withdrawAdenaFromWarehouse(qty)) {
        refreshAccountStorageAfterMove();
      }
    };
  });
  root.querySelectorAll("[data-dep-adena-in]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      const qty = Math.max(1, Math.floor(Number(depQty && depQty.value) || 0));
      if (typeof depositAdenaToWarehouse === "function" && depositAdenaToWarehouse(qty)) {
        refreshAccountStorageAfterMove();
      }
    };
  });
  root.querySelectorAll("[data-wh-uid]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      if (withdrawWarehouseItemToInv(btn.dataset.whUid)) {
        refreshAccountStorageAfterMove();
      }
    };
  });
  root.querySelectorAll("[data-dep-uid]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      if (depositInvItemToWarehouse(btn.dataset.depUid)) {
        refreshAccountStorageAfterMove();
      }
    };
  });
  root.querySelectorAll("[data-wh-scroll]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      if (typeof withdrawScrollFromWarehouse === "function" && withdrawScrollFromWarehouse(btn.dataset.whScroll)) {
        refreshAccountStorageAfterMove();
      }
    };
  });
  root.querySelectorAll("[data-dep-scroll]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      const parsed =
        typeof parseAccountWarehouseStackKey === "function"
          ? parseAccountWarehouseStackKey(btn.dataset.depScroll)
          : null;
      if (!parsed || parsed.kind !== "scroll") return;
      const qty = Math.max(1, Math.floor(Number(btn.dataset.qty) || 1));
      if (
        typeof depositScrollToWarehouse === "function" &&
        depositScrollToWarehouse(parsed.target, parsed.typeId, parsed.grade, qty)
      ) {
        refreshAccountStorageAfterMove();
      }
    };
  });
}

function wireAccountStorage() {
  const tile = document.getElementById("accountStorageTile");
  if (tile && !tile.dataset.wired) {
    tile.dataset.wired = "1";
    tile.onclick = () => openAccountStorage();
  }
}
