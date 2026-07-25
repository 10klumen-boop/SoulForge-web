// ===== Инвентарь игрока =====

const INV_GRADE_RANK = { NG: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

/** Порядок групп в сумке и вкладки фильтра. */
const INV_KIND_RANK = { weapon: 0, armor: 1, accessory: 2 };

const INV_TABS = [
  { id: "all", label: "Все" },
  { id: "weapon", label: "Оружие" },
  { id: "armor", label: "Броня" },
  { id: "accessory", label: "Бижутерия" },
  { id: "frag", label: "Куски" },
  { id: "shot", label: "Соски" },
  { id: "crystal", label: "Кристаллы" },
  { id: "ore", label: "Руда" },
];

const INV_RESOURCE_TABS = { frag: 1, shot: 1, crystal: 1, ore: 1 };

function isInvResourceTab(tabId) {
  return !!INV_RESOURCE_TABS[tabId];
}

function ensureInvTab() {
  if (state.invTab && INV_TABS.some((t) => t.id === state.invTab)) return;
  // Старые вкладки по грейду (A/B/C/…) → «Все»
  state.invTab = "all";
  delete state.invGradeFilter;
}

function inventoryTabId() {
  ensureInvTab();
  return state.invTab;
}

function inventoryItemKind(it) {
  if (!it) return null;
  if (isAccessoryItem(it)) return "accessory";
  if (typeof isArmorItem === "function" && isArmorItem(it)) return "armor";
  return "weapon";
}

function inventoryItemGradeKey(it) {
  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    const def = invItemDef(it);
    return def?.grade || "C";
  }
  if (isAccessoryItem(it)) return "epic";
  const def = invItemDef(it);
  if (!def) return null;
  if (def.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(def))) return "NG";
  return def.grade || "NG";
}

function inventoryItemMatchesTab(it, tabId) {
  if (tabId === "all") return true;
  if (isInvResourceTab(tabId)) return false;
  return inventoryItemKind(it) === tabId;
}

function setInvTab(id) {
  if (!INV_TABS.some((t) => t.id === id)) return;
  state.invTab = id;
  delete state.invGradeFilter;
  save();
}

function listArmorFragStacks() {
  if (typeof ARMOR_FRAGS === "undefined" || !ARMOR_FRAGS) return [];
  return Object.keys(ARMOR_FRAGS)
    .map((id) => {
      const def = ARMOR_FRAGS[id];
      const qty = (state.materials && state.materials[id]) || 0;
      return { id, def, qty };
    })
    .filter((row) => row.qty > 0)
    .sort((a, b) => String(a.def?.name || a.id).localeCompare(String(b.def?.name || b.id), "ru", { sensitivity: "base" }));
}

function listShotStacks() {
  if (typeof ensureWorkshopState === "function") ensureWorkshopState();
  const shots = state.shots || { soul: {}, spirit: {} };
  const out = [];
  ["soul", "spirit"].forEach((kind) => {
    ["D", "C", "B", "A"].forEach((grade) => {
      const qty = (shots[kind] && shots[kind][grade]) || 0;
      if (qty <= 0) return;
      out.push({
        id: kind + "_" + grade,
        kind,
        grade,
        qty,
        name: (kind === "spirit" ? "Spiritshot" : "Soulshot") + " " + grade,
        icon: typeof SHOT_ICON !== "undefined" ? SHOT_ICON[kind]?.[grade] || SHOT_ICON[kind] : null,
      });
    });
  });
  return out;
}

function listCrystalStacks() {
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  return ["D", "C", "B", "A"]
    .map((g) => ({
      grade: g,
      qty: state.crystals[g] || 0,
      icon: typeof CRYSTAL_ICON !== "undefined" ? CRYSTAL_ICON[g] : null,
      color: typeof CRYSTAL_COLOR !== "undefined" ? CRYSTAL_COLOR[g] : null,
    }))
    .filter((row) => row.qty > 0);
}

function listOreStacks() {
  if (typeof ensureWorkshopState === "function") ensureWorkshopState();
  const mats = state.materials || {};
  return ["soul", "spirit"]
    .map((ty) => {
      const o = typeof ORE !== "undefined" ? ORE[ty] : null;
      return {
        id: ty,
        qty: mats[ty] || 0,
        name: o?.name || (ty === "soul" ? "Soul Ore" : "Spirit Ore"),
        icon: o?.icon || null,
      };
    })
    .filter((row) => row.qty > 0);
}

function countInvResourceTabItems(tabId) {
  if (tabId === "frag") return listArmorFragStacks().length;
  if (tabId === "shot") return listShotStacks().length;
  if (tabId === "crystal") return listCrystalStacks().length;
  if (tabId === "ore") return listOreStacks().length;
  return 0;
}

function countInvTabItems(tabId) {
  if (isInvResourceTab(tabId)) return countInvResourceTabItems(tabId);
  const inv = state.inventory || [];
  return inv.slice(0, INV_CAP).filter((it) => inventoryItemMatchesTab(it, tabId)).length;
}

function inventorySortMode() {
  return "kind";
}

function inventoryItemPower(it, def) {
  if (!def || isAccessoryItem(it)) return 0;
  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    return (def.pdef || 0) + (def.mdef || 0);
  }
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
  const kindA = inventoryItemKind(a);
  const kindB = inventoryItemKind(b);
  const rankA = INV_KIND_RANK[kindA] ?? 99;
  const rankB = INV_KIND_RANK[kindB] ?? 99;
  if (rankA !== rankB) return rankA - rankB;

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
  // Внутри группы: грейд ↓, заточка ↓, сила ↓, имя
  if (gradeB !== gradeA) return gradeB - gradeA;
  if (plusB !== plusA) return plusB - plusA;
  if (mode === "power" && powerB !== powerA) return powerB - powerA;
  return String(da.name || "").localeCompare(String(db.name || ""), "ru", { sensitivity: "base" });
}

function applyInventorySort(mode) {
  mode = mode || inventorySortMode();
  state.invSort = "kind";
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
  if (it.kind === "armor" || (typeof isArmorItem === "function" && isArmorItem(it))) {
    return typeof armorItemDef === "function" ? armorItemDef(it) : (typeof AMAP !== "undefined" ? AMAP[it.id] : null);
  }
  if (it.kind === "accessory" || COLLECTIBLES[it.id]) return COLLECTIBLES[it.id];
  return WMAP[it.id] || null;
}

function isAccessoryItem(it) {
  if (!it) return false;
  if (it.kind === "armor") return false;
  if (typeof isArmorItem === "function" && isArmorItem(it)) return false;
  return !!(it.kind === "accessory" || COLLECTIBLES[it.id]);
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
  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    it.kind = "armor";
    return it;
  }
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

