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

function renderAccountWarehouseHtml() {
  const items = state.accountWarehouse.items || [];
  const inv = (state.inventory || []).filter((it) => !accountItemTransferBlockedReason(it));
  let html = "";
  html +=
    '<div class="account-storage-split">' +
    '<section class="account-storage-col">' +
    "<h3>Склад аккаунта <span>(" +
    items.length +
    "/" +
    ACCOUNT_WAREHOUSE_CAP +
    ")</span></h3>" +
    '<p class="account-storage-hint">Общий для всех персонажей. Клик — забрать в инвентарь.</p>' +
    '<div class="account-storage-grid" id="accountWhGrid">';
  if (!items.length) html += '<p class="account-storage-empty">Склад пуст</p>';
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
  html += "</div></section></div>";
  return html;
}

function wireAccountWarehouseUi(root) {
  root.querySelectorAll("[data-wh-uid]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      if (withdrawWarehouseItemToInv(btn.dataset.whUid)) {
        renderAccountStorage();
        if (typeof renderMenu === "function") renderMenu();
        if (typeof renderInventory === "function") renderInventory();
      }
    };
  });
  root.querySelectorAll("[data-dep-uid]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      if (depositInvItemToWarehouse(btn.dataset.depUid)) {
        renderAccountStorage();
        if (typeof renderMenu === "function") renderMenu();
        if (typeof renderInventory === "function") renderInventory();
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
