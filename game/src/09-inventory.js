// ===== Инвентарь игрока =====

const INV_GRADE_RANK = { NG: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

const INV_TABS = [
  { id: "all", label: "Все" },
  { id: "A", label: "A" },
  { id: "B", label: "B" },
  { id: "C", label: "C" },
  { id: "D", label: "D" },
  { id: "NG", label: "NG" },
  { id: "epic", label: "★" },
];

function ensureInvTab() {
  if (state.invTab && INV_TABS.some((t) => t.id === state.invTab)) return;
  if (state.invGradeFilter && !state.invGradeFilter.all) {
    const keys = ["A", "B", "C", "D", "NG", "epic"].filter((k) => state.invGradeFilter[k]);
    if (keys.length === 1) {
      state.invTab = keys[0];
      delete state.invGradeFilter;
      return;
    }
  }
  state.invTab = "all";
  delete state.invGradeFilter;
}

function inventoryTabId() {
  ensureInvTab();
  return state.invTab;
}

function inventoryItemGradeKey(it) {
  if (isAccessoryItem(it)) return "epic";
  const def = invItemDef(it);
  if (!def) return null;
  if (def.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(def))) return "NG";
  return def.grade || "NG";
}

function inventoryItemMatchesTab(it, tabId) {
  if (tabId === "all") return true;
  const key = inventoryItemGradeKey(it);
  return key != null && key === tabId;
}

function setInvTab(id) {
  if (!INV_TABS.some((t) => t.id === id)) return;
  state.invTab = id;
  delete state.invGradeFilter;
  save();
}

function countInvTabItems(tabId) {
  const inv = state.inventory || [];
  return inv.slice(0, INV_CAP).filter((it) => inventoryItemMatchesTab(it, tabId)).length;
}

function inventorySortMode() {
  return "grade";
}

function inventoryItemPower(it, def) {
  if (!def || isAccessoryItem(it)) return 0;
  const plus = it.plus || 0;
  const p = typeof statAt === "function" ? statAt(def.patk, def.ps, plus) : (def.patk || 0);
  const m = typeof statAt === "function" ? statAt(def.matk, def.ms, plus) : (def.matk || 0);
  if (typeof mysticWeaponPower === "function" && typeof avatarIsMystic === "function" && avatarIsMystic()) {
    return mysticWeaponPower(def, plus);
  }
  if (typeof fighterWeaponPower === "function") return fighterWeaponPower(def, plus);
  return Math.max(p, m);
}

function compareInventoryItems(a, b, mode) {
  const aa = isAccessoryItem(a), ab = isAccessoryItem(b);
  if (aa !== ab) return aa ? 1 : -1;
  const da = invItemDef(a), db = invItemDef(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  if (mode === "name") {
    return String(da.name || "").localeCompare(String(db.name || ""), "ru", { sensitivity: "base" });
  }
  const plusA = a.plus || 0, plusB = b.plus || 0;
  const gradeA = INV_GRADE_RANK[da.grade] ?? 0;
  const gradeB = INV_GRADE_RANK[db.grade] ?? 0;
  const powerA = inventoryItemPower(a, da);
  const powerB = inventoryItemPower(b, db);
  if (mode === "grade") {
    if (gradeB !== gradeA) return gradeB - gradeA;
    if (plusB !== plusA) return plusB - plusA;
  } else if (mode === "plus") {
    if (plusB !== plusA) return plusB - plusA;
    if (gradeB !== gradeA) return gradeB - gradeA;
  } else if (mode === "power") {
    if (powerB !== powerA) return powerB - powerA;
    if (plusB !== plusA) return plusB - plusA;
  }
  return String(da.name || "").localeCompare(String(db.name || ""), "ru", { sensitivity: "base" });
}

function applyInventorySort(mode) {
  mode = mode || inventorySortMode();
  state.invSort = "grade";
  if (state.inventory && state.inventory.length > 1) {
    state.inventory.sort((a, b) => compareInventoryItems(a, b, mode));
  }
}

function inventoryCount() {
  return state.inventory ? state.inventory.length : 0;
}

function isInventoryFull() {
  return inventoryCount() >= INV_CAP;
}

function trimInventoryToCap() {
  if (!state.inventory || state.inventory.length <= INV_CAP) return false;
  ProgressStore.set("inventory", state.inventory.slice(0, INV_CAP));
  save();
  return true;
}

function addToInventory(weaponId, meta) {
  if (!state.inventory) state.inventory = [];
  if (isInventoryFull()) {
    toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
  const it = { uid: uid(), id: weaponId, plus: 0, spent: 0 };
  const inv = (state.inventory || []).slice();
  inv.push(it);
  ProgressStore.set("inventory", inv);
  if (typeof markWeaponCollected === "function") markWeaponCollected(weaponId);
  if (isInventoryFull() && typeof achStat === "function") achStat("invFullOnce", 1);
  save();
  renderMenu();
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof logCharacterEvent === "function") {
    const w = WMAP[weaponId];
    logCharacterEvent("loot_weapon", {
      weaponId,
      weaponName: w?.name || weaponId,
      grade: w?.grade || null,
      plus: meta?.plus != null ? Math.max(0, Math.floor(Number(meta.plus) || 0)) : 0,
      source: meta?.source || "unknown",
      zoneId: meta?.zoneId || state.farmZone || null,
    });
  }
  return it;
}

function invItemDef(it) {
  if (!it) return null;
  if (it.kind === "accessory" || COLLECTIBLES[it.id]) return COLLECTIBLES[it.id];
  return WMAP[it.id] || null;
}

function isAccessoryItem(it) {
  return !!(it && (it.kind === "accessory" || COLLECTIBLES[it.id]));
}

function addCollectibleToInventory(collectibleId) {
  const def = COLLECTIBLES[collectibleId];
  if (!def) return null;
  if (!state.inventory) state.inventory = [];
  if (isInventoryFull()) {
    toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
  const it = { uid: uid(), id: collectibleId, kind: "accessory" };
  const inv = (state.inventory || []).slice();
  inv.push(it);
  ProgressStore.set("inventory", inv);
  save();
  renderMenu();
  return it;
}

function grantCollectible(id, qty) {
  const def = COLLECTIBLES[id];
  if (!def) return null;
  qty = Math.max(1, qty | 0);
  let added = 0;
  for (let i = 0; i < qty; i++) {
    if (!addCollectibleToInventory(id)) break;
    added++;
  }
  if (added > 0 && typeof checkAchievements === "function") checkAchievements();
  return added > 0 ? def : null;
}

function collectibleCount(id) {
  return (state.inventory || []).filter((it) => it.id === id && isAccessoryItem(it)).length;
}

function migrateCollectiblesToInventory() {
  if (!state.collectibles) return;
  let changed = false;
  Object.keys(COLLECTIBLES).forEach((id) => {
    let n = state.collectibles[id] || 0;
    while (n > 0) {
      if (!addCollectibleToInventory(id)) {
        if (n > 0) state.collectibles[id] = n;
        changed = true;
        return;
      }
      n--;
      changed = true;
    }
    if (state.collectibles[id] != null) {
      delete state.collectibles[id];
      changed = true;
    }
  });
  if (changed) save();
}

function normalizeInvItem(it) {
  if (!it) return it;
  if (isAccessoryItem(it)) return it;
  if (it.spent == null) it.spent = 0;
  if (it.max != null) {
    bumpWeaponRecord(it.id, it.max);
    delete it.max;
  } else if ((it.plus || 0) > weaponRecord(it.id)) {
    bumpWeaponRecord(it.id, it.plus);
  }
  return it;
}

function openInventory() { renderInventory(); show("inv"); Audio2.open(); }
function goInventory() { renderInventory(); renderMenu(); show("inv"); }

// ===== Инвентарь: логика и мутации state =====
// UI (renderInventory, drag-and-drop, crystallize UI) вынесено в inventory-ui.js.

