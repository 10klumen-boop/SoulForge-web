// ===== Склад аккаунта + почта между персонажами (account-level) =====

const ACCOUNT_WAREHOUSE_CAP = 40;
const ACCOUNT_MAIL_CAP = 50;

function defaultAccountWarehouse() {
  return { items: [], stacks: [] };
}

function defaultAccountMail() {
  return { messages: [] };
}

function ensureAccountStorage() {
  if (!state.accountWarehouse || typeof state.accountWarehouse !== "object") {
    state.accountWarehouse = defaultAccountWarehouse();
  }
  if (!Array.isArray(state.accountWarehouse.items)) state.accountWarehouse.items = [];
  if (!Array.isArray(state.accountWarehouse.stacks)) state.accountWarehouse.stacks = [];
  if (!state.accountMail || typeof state.accountMail !== "object") {
    state.accountMail = defaultAccountMail();
  }
  if (!Array.isArray(state.accountMail.messages)) state.accountMail.messages = [];
}

function newMailId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function cloneInvItem(it) {
  try {
    return JSON.parse(JSON.stringify(it));
  } catch (e) {
    return it ? { ...it } : null;
  }
}

function accountWarehouseStackKey(st) {
  if (!st) return null;
  if (st.kind === "adena") return "adena";
  if (st.kind !== "scroll") return null;
  const target =
    typeof normalizeScrollTarget === "function"
      ? normalizeScrollTarget(st.target)
      : st.target === "armor"
        ? "armor"
        : "weapon";
  const typeId =
    typeof normalizeScrollTypeId === "function"
      ? normalizeScrollTypeId(st.typeId || st.scrollType)
      : st.typeId || st.scrollType || "regular";
  const grade =
    typeof normalizeScrollGrade === "function"
      ? normalizeScrollGrade(st.grade)
      : String(st.grade || "").toUpperCase();
  if (!target || !typeId || !grade) return null;
  return "scroll:" + target + ":" + typeId + ":" + grade;
}

function parseAccountWarehouseStackKey(key) {
  const raw = String(key || "");
  if (raw === "adena") return { kind: "adena" };
  const parts = raw.split(":");
  if (parts[0] !== "scroll" || parts.length < 4) return null;
  return {
    kind: "scroll",
    target: parts[1],
    typeId: parts[2],
    grade: parts[3],
  };
}

function accountWarehouseAdena() {
  ensureAccountStorage();
  const st = (state.accountWarehouse.stacks || []).find((s) => s && s.kind === "adena");
  return Math.max(0, Math.floor(Number(st && st.qty) || 0));
}

function characterAdenaBalance() {
  return Math.max(0, Math.floor(Number(state.adena) || 0));
}

/**
 * Положить адену активного персонажа на склад аккаунта.
 * Одинаковый стек сливается; занимает 1 слот склада.
 */
function depositAdenaToWarehouse(qty) {
  ensureAccountStorage();
  if (!state.avatar?.created) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  const have = characterAdenaBalance();
  const n = Math.max(1, Math.min(have, Math.floor(Number(qty) || 0)));
  if (n < 1 || have < 1) {
    if (typeof toast === "function") toast("Нет адены", "warn");
    return false;
  }
  const stacks = state.accountWarehouse.stacks;
  const existing = stacks.find((s) => s && s.kind === "adena");
  if (!existing && accountWarehouseIsFull()) {
    if (typeof toast === "function") toast("Склад аккаунта полон (" + ACCOUNT_WAREHOUSE_CAP + ")", "warn");
    return false;
  }
  if (typeof ProgressStore !== "undefined") {
    ProgressStore.update("adena", (a) => Math.max(0, Math.floor(Number(a) || 0) - n));
  } else {
    state.adena = Math.max(0, have - n);
  }
  if (existing) {
    existing.qty = Math.max(0, Math.floor(Number(existing.qty) || 0)) + n;
  } else {
    stacks.push({ kind: "adena", qty: n });
  }
  persistAccountStorage();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("warehouse_deposit", {
      kind: "adena",
      qty: n,
      fromCharId: state.activeCharacterId || null,
    });
  }
  if (typeof toast === "function") {
    const fmt = typeof fmtAdena === "function" ? fmtAdena : String;
    toast("На склад: " + fmt(n) + " adena", "success");
  }
  return true;
}

/** Забрать адену со склада на активного персонажа. */
function withdrawAdenaFromWarehouse(qty) {
  ensureAccountStorage();
  if (!state.avatar?.created) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  const stacks = state.accountWarehouse.stacks;
  const idx = stacks.findIndex((s) => s && s.kind === "adena");
  if (idx < 0) {
    if (typeof toast === "function") toast("На складе нет адены", "warn");
    return false;
  }
  const st = stacks[idx];
  const have = Math.max(0, Math.floor(Number(st.qty) || 0));
  const n = Math.max(1, Math.min(have, Math.floor(Number(qty) || have)));
  if (n < 1) {
    if (typeof toast === "function") toast("Нечего забирать", "warn");
    return false;
  }
  if (typeof ProgressStore !== "undefined") {
    ProgressStore.update("adena", (a) => Math.max(0, Math.floor(Number(a) || 0) + n));
  } else {
    state.adena = characterAdenaBalance() + n;
  }
  st.qty = have - n;
  if (st.qty <= 0) stacks.splice(idx, 1);
  persistAccountStorage();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("warehouse_withdraw", {
      kind: "adena",
      qty: n,
      fromCharId: state.activeCharacterId || null,
    });
  }
  if (typeof toast === "function") {
    const fmt = typeof fmtAdena === "function" ? fmtAdena : String;
    toast("В кошелёк: " + fmt(n) + " adena", "success");
  }
  return true;
}

function accountWarehouseCount() {
  ensureAccountStorage();
  return (state.accountWarehouse.items || []).length + (state.accountWarehouse.stacks || []).length;
}

function accountWarehouseFree() {
  return Math.max(0, ACCOUNT_WAREHOUSE_CAP - accountWarehouseCount());
}

function accountWarehouseIsFull() {
  return accountWarehouseFree() <= 0;
}

/** Созданные персонажи аккаунта (слоты с именем). */
function accountCreatedCharacters() {
  if (!Array.isArray(state.characters)) return [];
  return state.characters.filter((c) => typeof slotIsCreated === "function" && slotIsCreated(c));
}

function accountCharacterName(charId) {
  const slot = (state.characters || []).find((c) => c && c.id === charId);
  if (!slot) return "—";
  const name = slot.progress?.avatar?.name;
  return name && String(name).trim() ? String(name).trim() : "Без имени";
}

function isAccountTransferableItem(it) {
  if (!it || !it.uid) return false;
  if (typeof invItemDef === "function") return !!invItemDef(it);
  return !!(it.id && (it.kind === "armor" || it.kind === "accessory" || !it.kind));
}

function accountItemTransferBlockedReason(it) {
  if (!it) return "Нет предмета";
  if (!isAccountTransferableItem(it)) return "Нельзя переносить этот предмет";
  if (it.starter || isStarterWeaponItem(it)) {
    return "Стартовое оружие нельзя переносить";
  }
  if (typeof isItemEquipped === "function" && isItemEquipped(it.uid)) {
    return "Сначала сними предмет";
  }
  return null;
}

function persistAccountStorage() {
  ensureAccountStorage();
  if (typeof save === "function") save();
  else if (typeof scheduleCloudSave === "function") scheduleCloudSave();
}

function noteWarehouseItemEvent(event, item) {
  if (typeof logCharacterEvent !== "function" || !item) return;
  logCharacterEvent(event, {
    uid: item.uid || null,
    itemId: item.id || null,
    plus: item.plus != null ? item.plus : 0,
    kind: item.kind || null,
    fromCharId: state.activeCharacterId || null,
  });
}

/** Положить предмет из инвентаря активного персонажа на склад аккаунта. */
function depositInvItemToWarehouse(uid) {
  ensureAccountStorage();
  if (!state.avatar?.created) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  const idx = typeof findInvIndexByUid === "function" ? findInvIndexByUid(uid) : -1;
  if (idx < 0) {
    if (typeof toast === "function") toast("Предмет не в инвентаре", "warn");
    return false;
  }
  const it = (state.inventory || [])[idx];
  const block = accountItemTransferBlockedReason(it);
  if (block) {
    if (typeof toast === "function") toast(block, "warn");
    return false;
  }
  if (accountWarehouseIsFull()) {
    if (typeof toast === "function") toast("Склад аккаунта полон (" + ACCOUNT_WAREHOUSE_CAP + ")", "warn");
    return false;
  }
  const taken = typeof removeInvByUid === "function" ? removeInvByUid(uid) : null;
  if (!taken) return false;
  state.accountWarehouse.items.push(cloneInvItem(taken));
  persistAccountStorage();
  noteWarehouseItemEvent("warehouse_deposit", taken);
  if (typeof toast === "function") {
    const def = typeof invItemDef === "function" ? invItemDef(taken) : null;
    toast("На склад: " + (def?.name || "?"), "success");
  }
  return true;
}

function warehouseScrollLabel(st) {
  if (typeof scrollLabel === "function") {
    return scrollLabel(st.target, st.typeId || st.scrollType, st.grade);
  }
  return "Свиток " + (st.target || "") + " " + (st.typeId || "") + " " + (st.grade || "");
}

function warehouseScrollIcon(st) {
  const typeId = st.typeId || st.scrollType || "regular";
  const target = st.target === "armor" ? "armor" : "weapon";
  if (typeof scrollTierIcon === "function") return scrollTierIcon(typeId, st.grade || "D", target);
  return target === "armor"
    ? "icons/etc_scroll_of_enchant_armor_i01.png"
    : "icons/etc_scroll_of_enchant_weapon_i01.png";
}

/**
 * Положить свитки активного персонажа на склад аккаунта.
 * Одинаковые стаки сливаются; новый стак занимает 1 слот склада.
 */
function depositScrollToWarehouse(target, typeId, grade, qty) {
  ensureAccountStorage();
  if (!state.avatar?.created) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (
    typeof hasScroll !== "function" ||
    typeof consumeScroll !== "function" ||
    !hasScroll(target, typeId, grade, n)
  ) {
    if (typeof toast === "function") toast("Недостаточно свитков", "warn");
    return false;
  }
  const key = accountWarehouseStackKey({ kind: "scroll", target, typeId, grade });
  if (!key) {
    if (typeof toast === "function") toast("Неверный свиток", "warn");
    return false;
  }
  const stacks = state.accountWarehouse.stacks;
  const existing = stacks.find((s) => accountWarehouseStackKey(s) === key);
  if (!existing && accountWarehouseIsFull()) {
    if (typeof toast === "function") toast("Склад аккаунта полон (" + ACCOUNT_WAREHOUSE_CAP + ")", "warn");
    return false;
  }
  if (!consumeScroll(target, typeId, grade, n)) {
    if (typeof toast === "function") toast("Не удалось списать свитки", "warn");
    return false;
  }
  const norm = parseAccountWarehouseStackKey(key);
  if (existing) {
    existing.qty = Math.max(0, Math.floor(Number(existing.qty) || 0)) + n;
  } else {
    stacks.push({
      kind: "scroll",
      target: norm.target,
      typeId: norm.typeId,
      grade: norm.grade,
      qty: n,
    });
  }
  persistAccountStorage();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("warehouse_deposit", {
      kind: "scroll",
      target: norm.target,
      typeId: norm.typeId,
      grade: norm.grade,
      qty: n,
      fromCharId: state.activeCharacterId || null,
    });
  }
  if (typeof toast === "function") {
    toast("На склад: " + warehouseScrollLabel(norm) + " ×" + n, "success");
  }
  return true;
}

/** Забрать свитки со склада в сумку активного персонажа. */
function withdrawScrollFromWarehouse(stackKey, qty) {
  ensureAccountStorage();
  if (!state.avatar?.created) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  const stacks = state.accountWarehouse.stacks;
  const idx = stacks.findIndex((s) => accountWarehouseStackKey(s) === stackKey);
  if (idx < 0) {
    if (typeof toast === "function") toast("Свитки не на складе", "warn");
    return false;
  }
  const st = stacks[idx];
  const have = Math.max(0, Math.floor(Number(st.qty) || 0));
  const n = Math.max(1, Math.min(have, Math.floor(Number(qty) || have)));
  if (n < 1 || typeof addScroll !== "function") {
    if (typeof toast === "function") toast("Нечего забирать", "warn");
    return false;
  }
  if (!addScroll(st.target, st.typeId, st.grade, n)) {
    if (typeof toast === "function") toast("Не удалось выдать свитки", "warn");
    return false;
  }
  st.qty = have - n;
  if (st.qty <= 0) stacks.splice(idx, 1);
  persistAccountStorage();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("warehouse_withdraw", {
      kind: "scroll",
      target: st.target,
      typeId: st.typeId,
      grade: st.grade,
      qty: n,
      fromCharId: state.activeCharacterId || null,
    });
  }
  if (typeof toast === "function") {
    toast("В сумку: " + warehouseScrollLabel(st) + " ×" + n, "success");
  }
  return true;
}

/** Забрать предмет со склада в инвентарь активного персонажа. */
function withdrawWarehouseItemToInv(uid) {
  ensureAccountStorage();
  if (!state.avatar?.created) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  if (typeof isInventoryFull === "function" && isInventoryFull()) {
    if (typeof toast === "function") toast("Инвентарь полон (" + INV_CAP + ")", "warn");
    return false;
  }
  const wh = state.accountWarehouse.items;
  const idx = wh.findIndex((it) => it && it.uid === uid);
  if (idx < 0) {
    if (typeof toast === "function") toast("Предмет не на складе", "warn");
    return false;
  }
  const [taken] = wh.splice(idx, 1);
  const inv = Array.isArray(state.inventory) ? state.inventory.slice() : [];
  inv.push(cloneInvItem(taken));
  if (typeof ProgressStore !== "undefined") ProgressStore.set("inventory", inv);
  else state.inventory = inv;
  persistAccountStorage();
  noteWarehouseItemEvent("warehouse_withdraw", taken);
  if (typeof toast === "function") {
    const def = typeof invItemDef === "function" ? invItemDef(taken) : null;
    toast("В инвентарь: " + (def?.name || "?"), "success");
  }
  return true;
}

function mailForCharacter(charId) {
  ensureAccountStorage();
  return state.accountMail.messages.filter((m) => m && m.toCharId === charId && !m.claimedAt);
}

function unreadMailCountForActive() {
  const id = state.activeCharacterId;
  if (!id) return 0;
  return mailForCharacter(id).length;
}

function trimAccountMailIfNeeded() {
  ensureAccountStorage();
  const msgs = state.accountMail.messages;
  if (msgs.length <= ACCOUNT_MAIL_CAP) return;
  // Сначала убираем старые полученные
  const claimed = msgs.filter((m) => m.claimedAt).sort((a, b) => (a.claimedAt || 0) - (b.claimedAt || 0));
  while (msgs.length > ACCOUNT_MAIL_CAP && claimed.length) {
    const old = claimed.shift();
    const i = msgs.indexOf(old);
    if (i >= 0) msgs.splice(i, 1);
  }
  while (msgs.length > ACCOUNT_MAIL_CAP) msgs.shift();
}

/**
 * Отправить предмет почтой любому созданному персонажу аккаунта
 * (включая активного — письмо попадёт во входящие этого слота).
 * @param {"inv"|"warehouse"} source
 */
function sendAccountMail(uid, toCharId, source) {
  ensureAccountStorage();
  source = source === "warehouse" ? "warehouse" : "inv";
  if (!state.avatar?.created || !state.activeCharacterId) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  if (!toCharId) {
    if (typeof toast === "function") toast("Выбери персонажа", "warn");
    return false;
  }
  const dest = (state.characters || []).find((c) => c.id === toCharId);
  if (!dest || (typeof slotIsCreated === "function" && !slotIsCreated(dest))) {
    if (typeof toast === "function") toast("Получатель не найден", "warn");
    return false;
  }

  let taken = null;
  if (source === "inv") {
    const idx = typeof findInvIndexByUid === "function" ? findInvIndexByUid(uid) : -1;
    if (idx < 0) {
      if (typeof toast === "function") toast("Предмет не в инвентаре", "warn");
      return false;
    }
    const it = state.inventory[idx];
    const block = accountItemTransferBlockedReason(it);
    if (block) {
      if (typeof toast === "function") toast(block, "warn");
      return false;
    }
    taken = typeof removeInvByUid === "function" ? removeInvByUid(uid) : null;
  } else {
    const wh = state.accountWarehouse.items;
    const idx = wh.findIndex((it) => it && it.uid === uid);
    if (idx < 0) {
      if (typeof toast === "function") toast("Предмет не на складе", "warn");
      return false;
    }
    taken = wh.splice(idx, 1)[0];
  }
  if (!taken) return false;

  const msg = {
    id: newMailId(),
    fromCharId: state.activeCharacterId,
    fromName: state.avatar.name || "—",
    toCharId,
    toName: accountCharacterName(toCharId),
    item: cloneInvItem(taken),
    createdAt: Date.now(),
    claimedAt: null,
  };
  state.accountMail.messages.push(msg);
  trimAccountMailIfNeeded();
  persistAccountStorage();
  if (typeof toast === "function") {
    const def = typeof invItemDef === "function" ? invItemDef(taken) : null;
    toast("Почта → " + msg.toName + ": " + (def?.name || "?"), "success");
  }
  return true;
}

/** Забрать вложение письма в инвентарь активного персонажа. */
function claimAccountMail(mailId) {
  ensureAccountStorage();
  if (!state.avatar?.created || !state.activeCharacterId) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return false;
  }
  const msg = state.accountMail.messages.find((m) => m && m.id === mailId);
  if (!msg || msg.claimedAt) {
    if (typeof toast === "function") toast("Письмо не найдено", "warn");
    return false;
  }
  if (msg.toCharId !== state.activeCharacterId) {
    if (typeof toast === "function") toast("Это письмо другому персонажу", "warn");
    return false;
  }
  if (typeof isInventoryFull === "function" && isInventoryFull()) {
    if (typeof toast === "function") toast("Инвентарь полон (" + INV_CAP + ")", "warn");
    return false;
  }
  const inv = Array.isArray(state.inventory) ? state.inventory.slice() : [];
  inv.push(cloneInvItem(msg.item));
  if (typeof ProgressStore !== "undefined") ProgressStore.set("inventory", inv);
  else state.inventory = inv;
  msg.claimedAt = Date.now();
  persistAccountStorage();
  if (typeof toast === "function") {
    const def = typeof invItemDef === "function" ? invItemDef(msg.item) : null;
    toast("Получено: " + (def?.name || "?"), "success");
  }
  return true;
}

function isStarterWeaponItem(it) {
  if (!it) return false;
  if (it.starter) return true;
  const def = typeof invItemDef === "function" ? invItemDef(it) : null;
  return !!(def && def.starter);
}
