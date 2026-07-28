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
  const stacks = state.accountWarehouse.stacks || [];
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
    '<p class="account-storage-hint">Общий для всех персонажей. Клик — забрать. Свитки тоже сюда.</p>' +
    '<div class="account-storage-grid" id="accountWhGrid">';
  if (!items.length && !stacks.length) html += '<p class="account-storage-empty">Склад пуст</p>';
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
  root.querySelectorAll("[data-wh-scroll]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      if (typeof withdrawScrollFromWarehouse === "function" && withdrawScrollFromWarehouse(btn.dataset.whScroll)) {
        renderAccountStorage();
        if (typeof renderMenu === "function") renderMenu();
        if (typeof renderInventory === "function") renderInventory();
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
      if (!parsed) return;
      const qty = Math.max(1, Math.floor(Number(btn.dataset.qty) || 1));
      if (
        typeof depositScrollToWarehouse === "function" &&
        depositScrollToWarehouse(parsed.target, parsed.typeId, parsed.grade, qty)
      ) {
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
