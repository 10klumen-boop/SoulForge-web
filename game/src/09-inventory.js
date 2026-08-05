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
  { id: "scroll", label: "Свитки" },
  { id: "shot", label: "Соски" },
  { id: "crystal", label: "Кристаллы" },
  { id: "ore", label: "Руда" },
];

const INV_RESOURCE_TABS = { frag: 1, scroll: 1, shot: 1, crystal: 1, ore: 1 };

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
  if (isShardItem(it)) return "accessory";
  if (isAccessoryItem(it)) return "accessory";
  if (typeof isArmorItem === "function" && isArmorItem(it)) return "armor";
  return "weapon";
}

function inventoryItemGradeKey(it) {
  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    const def = invItemDef(it);
    return def?.grade || "C";
  }
  if (isAccessoryItem(it)) {
    const def = typeof accessoryDef === "function" ? accessoryDef(it) : (typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[it.id] : null);
    if (def?.epic) return "epic";
    return def?.grade || "epic";
  }
  const def = invItemDef(it);
  if (!def) return null;
  if (def.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(def))) return "NG";
  return def.grade || "NG";
}

function inventoryItemMatchesTab(it, tabId) {
  if (tabId === "all") return true;
  if (isInvResourceTab(tabId)) return false;
  // Осколки бижу — во вкладке «Куски» (resource), не в «Бижутерия».
  if (typeof isShardItem === "function" && isShardItem(it)) return false;
  return inventoryItemKind(it) === tabId;
}

function setInvTab(id) {
  if (!INV_TABS.some((t) => t.id === id)) return;
  state.invTab = id;
  delete state.invGradeFilter;
  save();
}

function listArmorFragStacks() {
  const out = [];
  if (typeof ARMOR_FRAGS !== "undefined" && ARMOR_FRAGS) {
    Object.keys(ARMOR_FRAGS).forEach((id) => {
      const def = ARMOR_FRAGS[id];
      const qty = (state.materials && state.materials[id]) || 0;
      if (qty > 0) out.push({ id, def, qty, kind: "armor" });
    });
  }
  return out.sort((a, b) =>
    String(a.def?.name || a.id).localeCompare(String(b.def?.name || b.id), "ru", { sensitivity: "base" })
  );
}

/** Куски бижутерии в сумке (kind: shard). */
function listJewelryFragStacks() {
  const byId = {};
  (state.inventory || []).forEach((it) => {
    if (typeof isShardItem !== "function" || !isShardItem(it)) return;
    const def = typeof shardItemDef === "function" ? shardItemDef(it) : null;
    if (!def) return;
    const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
    if (qty <= 0) return;
    if (!byId[it.id]) {
      byId[it.id] = { id: it.id, def, qty: 0, kind: "jewelry" };
    }
    byId[it.id].qty += qty;
  });
  return Object.keys(byId)
    .map((k) => byId[k])
    .sort((a, b) =>
      String(a.def?.name || a.id).localeCompare(String(b.def?.name || b.id), "ru", { sensitivity: "base" })
    );
}

/** Броня (materials) + бижутерия (inventory shards). */
function listFragStacks() {
  return listArmorFragStacks()
    .concat(listJewelryFragStacks())
    .sort((a, b) =>
      String(a.def?.name || a.id).localeCompare(String(b.def?.name || b.id), "ru", { sensitivity: "base" })
    );
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
  const rows = ["soul", "spirit"]
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
  const oathQty = Math.max(0, Math.floor(Number(mats.oath_symbol) || 0));
  if (oathQty > 0) {
    rows.push({
      id: "oath_symbol",
      qty: oathQty,
      name: (typeof OATH_SYMBOL !== "undefined" && OATH_SYMBOL.nameRu) || "Символ Клятвы",
      icon: (typeof OATH_SYMBOL !== "undefined" && OATH_SYMBOL.icon) || "icons/clan/oath_symbol.png?v=1",
      tip: (typeof OATH_SYMBOL !== "undefined" && OATH_SYMBOL.descRu) || "",
    });
  }
  return rows;
}

function countInvResourceTabItems(tabId) {
  if (tabId === "frag") {
    return typeof listFragStacks === "function" ? listFragStacks().length : listArmorFragStacks().length;
  }
  if (tabId === "scroll") {
    return typeof listScrollStacks === "function" ? listScrollStacks().length : 0;
  }
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
  const m = state && state.invSort;
  if (m === "power" || m === "grade" || m === "kind") return m;
  return "kind";
}

function setInvSort(mode) {
  state.invSort = mode === "power" || mode === "grade" ? mode : "kind";
  if (typeof save === "function") save();
}

function inventoryItemPower(it, def) {
  if (!def || isAccessoryItem(it) || (typeof isShardItem === "function" && isShardItem(it))) return 0;
  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    const lv = typeof state !== "undefined" ? state.avatar?.level || 1 : 1;
    const pen = typeof avatarGradePenaltyMult === "function" ? avatarGradePenaltyMult(def.grade, lv) : 1;
    return Math.round(((def.pdef || 0) + (def.mdef || 0)) * pen);
  }
  const plus = it.plus || 0;
  const p = typeof statAt === "function" ? statAt(def.patk, def.ps, plus) : (def.patk || 0);
  const m = typeof statAt === "function" ? statAt(def.matk, def.ms, plus) : (def.matk || 0);
  let raw = Math.max(p, m);
  if (typeof mysticWeaponPower === "function" && typeof avatarIsMystic === "function" && avatarIsMystic()) {
    raw = mysticWeaponPower(def, plus);
  } else if (typeof fighterWeaponPower === "function") {
    raw = fighterWeaponPower(def, plus);
  }
  const lv = typeof state !== "undefined" ? state.avatar?.level || 1 : 1;
  const pen = typeof weaponGradePowerMult === "function" ? weaponGradePowerMult(def, lv) : 1;
  return Math.round(raw * pen);
}

function inventoryItemGradeRank(it, def) {
  const key =
    typeof inventoryItemGradeKey === "function"
      ? inventoryItemGradeKey(it)
      : def && def.epic
        ? "epic"
        : (def && def.grade) || "NG";
  if (key === "epic") return 6;
  return INV_GRADE_RANK[key] ?? 0;
}

function compareInventoryItems(a, b, mode) {
  const da = invItemDef(a), db = invItemDef(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  if (mode === "name") {
    return String(da.name || "").localeCompare(String(db.name || ""), "ru", { sensitivity: "base" });
  }

  const kindA = inventoryItemKind(a);
  const kindB = inventoryItemKind(b);
  const rankA = INV_KIND_RANK[kindA] ?? 99;
  const rankB = INV_KIND_RANK[kindB] ?? 99;
  const plusA = a.plus || 0, plusB = b.plus || 0;
  const gradeA = inventoryItemGradeRank(a, da);
  const gradeB = inventoryItemGradeRank(b, db);
  const powerA = inventoryItemPower(a, da);
  const powerB = inventoryItemPower(b, db);
  const byName = () =>
    String(da.name || "").localeCompare(String(db.name || ""), "ru", { sensitivity: "base" });

  if (mode === "grade") {
    // Грейд ↓, затем тип, заточка, имя
    if (gradeB !== gradeA) return gradeB - gradeA;
    if (rankA !== rankB) return rankA - rankB;
    if (plusB !== plusA) return plusB - plusA;
    return byName();
  }

  // kind / power: сначала тип
  if (rankA !== rankB) return rankA - rankB;

  if (mode === "power") {
    if (powerB !== powerA) return powerB - powerA;
    if (gradeB !== gradeA) return gradeB - gradeA;
    if (plusB !== plusA) return plusB - plusA;
    return byName();
  }
  // kind: грейд ↓, заточка ↓, имя
  if (gradeB !== gradeA) return gradeB - gradeA;
  if (plusB !== plusA) return plusB - plusA;
  return byName();
}

function applyInventorySort(mode) {
  if (mode === "power" || mode === "grade" || mode === "kind") {
    /* keep */
  } else {
    mode = inventorySortMode();
  }
  state.invSort = mode;
  const inv = Array.isArray(state.inventory) ? state.inventory.slice() : [];
  if (inv.length > 1) {
    inv.sort((a, b) => compareInventoryItems(a, b, mode));
  }
  if (typeof ProgressStore !== "undefined" && ProgressStore && typeof ProgressStore.set === "function") {
    ProgressStore.set("inventory", inv);
  } else {
    state.inventory = inv;
  }
  if (typeof save === "function") save();
  return mode;
}

function inventoryCount() {
  return state.inventory ? state.inventory.length : 0;
}

function isInventoryFull() {
  return inventoryCount() >= INV_CAP;
}

/** Кап отложенного лута (если сумка полна — предмет не пропадает). */
const OVERFLOW_LOOT_CAP = 40;

function ensureOverflowLoot() {
  if (!Array.isArray(state.overflowLoot)) {
    if (typeof ProgressStore !== "undefined") ProgressStore.set("overflowLoot", []);
    else state.overflowLoot = [];
  }
}

function overflowLootCount() {
  ensureOverflowLoot();
  return (state.overflowLoot || []).length;
}

/**
 * Сумка полна → предмет в overflowLoot (не теряется).
 * @returns {boolean}
 */
function enqueueOverflowLoot(item, meta) {
  meta = meta || {};
  if (!item || !item.id) return false;
  ensureOverflowLoot();
  if ((state.overflowLoot || []).length >= OVERFLOW_LOOT_CAP) {
    if (!meta.silent && typeof toast === "function") {
      toast("Сумка и отложенный лут переполнены — освободи место!", "warn");
    }
    return false;
  }
  let snap;
  try {
    snap = JSON.parse(JSON.stringify(item));
  } catch (_) {
    snap = Object.assign({}, item);
  }
  if (!snap.uid && typeof uid === "function") snap.uid = uid();
  snap._overflowAt = Date.now();
  snap._overflowSource = meta.source || "loot";
  const next = (state.overflowLoot || []).concat([snap]);
  if (typeof ProgressStore !== "undefined") ProgressStore.set("overflowLoot", next);
  else state.overflowLoot = next;
  if (!meta.silent && typeof toast === "function") {
    const def = typeof invItemDef === "function" ? invItemDef(snap) : null;
    const name = (def && def.name) || snap.id || "предмет";
    toast("Сумка полна → «" + name + "» в отложенный лут", "warn");
  }
  if (typeof save === "function") save();
  if (typeof renderMenu === "function") renderMenu();
  return true;
}

/**
 * Переносит отложенный лут в сумку, пока есть место.
 * @returns {number} сколько предметов забрано
 */
function flushOverflowLoot(opts) {
  opts = opts || {};
  ensureOverflowLoot();
  const queue = state.overflowLoot || [];
  if (!queue.length) return 0;
  let moved = 0;
  const remain = [];
  const inv = (state.inventory || []).slice();
  for (let i = 0; i < queue.length; i++) {
    const it = queue[i];
    if (!it) continue;
    if (it.kind === "shard") {
      const idx = inv.findIndex((x) => x && x.kind === "shard" && x.id === it.id);
      if (idx >= 0) {
        const cur = inv[idx];
        inv[idx] = Object.assign({}, cur, {
          qty: Math.max(0, Math.floor(Number(cur.qty) || 0)) + Math.max(1, Math.floor(Number(it.qty) || 1)),
        });
        moved++;
        continue;
      }
    }
    if (inv.length >= INV_CAP) {
      remain.push(it);
      continue;
    }
    const clean = Object.assign({}, it);
    delete clean._overflowAt;
    delete clean._overflowSource;
    inv.push(clean);
    moved++;
  }
  if (moved > 0) {
    if (typeof ProgressStore !== "undefined") {
      ProgressStore.set("inventory", inv);
      ProgressStore.set("overflowLoot", remain);
    } else {
      state.inventory = inv;
      state.overflowLoot = remain;
    }
    if (!opts.silent && typeof toast === "function") {
      toast("Отложенный лут: +" + moved, "success");
    }
    if (typeof save === "function") save();
    if (typeof renderMenu === "function") renderMenu();
  }
  return moved;
}

/** После продажи/кристаллизации/снятия — попробовать забрать отложенное. */
function afterInventorySpaceFreed() {
  if (typeof flushOverflowLoot === "function") flushOverflowLoot({ silent: true });
}

function trimInventoryToCap() {
  if (!state.inventory || state.inventory.length <= INV_CAP) return false;
  ProgressStore.set("inventory", state.inventory.slice(0, INV_CAP));
  save();
  return true;
}

function addToInventory(weaponId, meta) {
  meta = meta || {};
  if (!state.inventory) state.inventory = [];
  const plus = meta.plus != null ? Math.max(0, Math.floor(Number(meta.plus) || 0)) : 0;
  const it = { uid: uid(), id: weaponId, plus: plus, spent: 0 };
  if (isInventoryFull()) {
    if (typeof enqueueOverflowLoot === "function" && enqueueOverflowLoot(it, { source: meta.source || "loot" })) {
      if (typeof markWeaponCollected === "function") markWeaponCollected(weaponId);
      if (typeof logCharacterEvent === "function") {
        const w = WMAP[weaponId];
        logCharacterEvent("loot_weapon_overflow", {
          weaponId,
          weaponName: w?.name || weaponId,
          grade: w?.grade || null,
          plus: plus,
          source: meta.source || "unknown",
          zoneId: meta.zoneId || state.farmZone || null,
        });
      }
      return it;
    }
    toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
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
      plus: plus,
      source: meta.source || "unknown",
      zoneId: meta.zoneId || state.farmZone || null,
    });
  }
  return it;
}

function isAccessoryItem(it) {
  if (!it) return false;
  if (it.kind === "armor") return false;
  if (it.kind === "shard") return false;
  if (typeof isArmorItem === "function" && isArmorItem(it)) return false;
  return !!(it.kind === "accessory" || COLLECTIBLES[it.id]);
}

function isShardItem(it) {
  return !!(it && it.kind === "shard" && it.id);
}

function shardItemDef(itOrId) {
  const id = typeof itOrId === "string" ? itOrId : itOrId?.id;
  if (!id || typeof ACCESSORY_FRAGS === "undefined") return null;
  return ACCESSORY_FRAGS[id] || null;
}

function inventoryShardCount(shardId) {
  if (!shardId) return 0;
  let n = 0;
  (state.inventory || []).forEach((it) => {
    if (it && it.kind === "shard" && it.id === shardId) n += Math.max(0, Math.floor(Number(it.qty) || 0));
  });
  // legacy: materials → сумка
  if (state.materials && state.materials[shardId]) {
    n += Math.max(0, Math.floor(Number(state.materials[shardId]) || 0));
  }
  return n;
}

/** Осколок бижутерии в сумку (стак по id). */
function addShardToInventory(shardId, qty, meta) {
  meta = meta || {};
  const resolved =
    typeof resolveJewelryFragId === "function" ? resolveJewelryFragId(shardId) : shardId;
  const def = shardItemDef(resolved) || shardItemDef(shardId);
  if (!def) return null;
  const id = resolved;
  const add = Math.max(0, Math.floor(Number(qty) || 0));
  if (add <= 0) return null;
  if (!state.inventory) state.inventory = [];
  const inv = (state.inventory || []).slice();
  const idx = inv.findIndex((it) => it && it.kind === "shard" && it.id === id);
  if (idx >= 0) {
    const cur = inv[idx];
    inv[idx] = Object.assign({}, cur, { qty: Math.max(0, Math.floor(Number(cur.qty) || 0) + add) });
  } else {
    if (typeof isInventoryFull === "function" && isInventoryFull()) {
      const overflowItem = {
        uid: typeof uid === "function" ? uid() : "sh_" + Date.now(),
        id,
        kind: "shard",
        qty: add,
      };
      if (typeof enqueueOverflowLoot === "function" && enqueueOverflowLoot(overflowItem, { source: meta.source || "shard" })) {
        return overflowItem;
      }
      if (typeof toast === "function") toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
      return null;
    }
    inv.push({
      uid: typeof uid === "function" ? uid() : "sh_" + Date.now(),
      id,
      kind: "shard",
      qty: add,
    });
  }
  ProgressStore.set("inventory", inv);
  if (!meta.silent && typeof toast === "function") {
    toast("✧ " + def.name + " ×" + add + " → сумка", "loot");
  }
  if (typeof renderMenu === "function") renderMenu();
  if (typeof renderInventory === "function") renderInventory();
  return inv.find((it) => it && it.kind === "shard" && it.id === id) || null;
}

function consumeShardsFromInventory(shardId, qty) {
  const need = Math.max(0, Math.floor(Number(qty) || 0));
  if (!need || !shardId) return false;
  if (inventoryShardCount(shardId) < need) return false;
  let left = need;
  // сначала legacy materials
  if (state.materials && state.materials[shardId]) {
    const have = Math.max(0, Math.floor(Number(state.materials[shardId]) || 0));
    const take = Math.min(have, left);
    if (take > 0) {
      ProgressStore.update("materials", (m) => {
        const next = { ...(m || {}) };
        next[shardId] = Math.max(0, (next[shardId] || 0) - take);
        if (!next[shardId]) delete next[shardId];
        return next;
      });
      left -= take;
    }
  }
  if (left > 0) {
    const inv = (state.inventory || []).slice();
    for (let i = 0; i < inv.length && left > 0; i++) {
      const it = inv[i];
      if (!it || it.kind !== "shard" || it.id !== shardId) continue;
      const have = Math.max(0, Math.floor(Number(it.qty) || 0));
      const take = Math.min(have, left);
      const rest = have - take;
      left -= take;
      if (rest > 0) inv[i] = Object.assign({}, it, { qty: rest });
      else {
        inv.splice(i, 1);
        i--;
      }
    }
    ProgressStore.set("inventory", inv);
  }
  return left <= 0;
}

function invItemDef(it) {
  if (!it) return null;
  if (it.kind === "shard" || isShardItem(it)) return shardItemDef(it);
  if (it.kind === "armor" || (typeof isArmorItem === "function" && isArmorItem(it))) {
    return typeof armorItemDef === "function" ? armorItemDef(it) : (typeof AMAP !== "undefined" ? AMAP[it.id] : null);
  }
  if (it.kind === "accessory" || COLLECTIBLES[it.id]) return COLLECTIBLES[it.id];
  return WMAP[it.id] || null;
}

function addCollectibleToInventory(collectibleId, meta) {
  const def = COLLECTIBLES[collectibleId];
  if (!def) return null;
  if (!state.inventory) state.inventory = [];
  const it = { uid: uid(), id: collectibleId, kind: "accessory", plus: 0, spent: 0 };
  if (meta?.craftOpt) it.craftOpt = meta.craftOpt;
  if (isInventoryFull()) {
    if (typeof enqueueOverflowLoot === "function" && enqueueOverflowLoot(it, { source: "accessory" })) {
      return it;
    }
    toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
  const inv = (state.inventory || []).slice();
  inv.push(it);
  ProgressStore.set("inventory", inv);
  save();
  renderMenu();
  return it;
}

function grantCollectible(id, qty, meta) {
  const def = COLLECTIBLES[id];
  if (!def) return null;
  qty = Math.max(1, qty | 0);
  let added = 0;
  for (let i = 0; i < qty; i++) {
    if (!addCollectibleToInventory(id, meta)) break;
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
  if (it.kind === "shard" || (typeof isShardItem === "function" && isShardItem(it))) {
    it.kind = "shard";
    it.qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    return it;
  }
  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    it.kind = "armor";
    if (it.plus == null) it.plus = 0;
    if (it.spent == null) it.spent = 0;
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

/** Переносит осколки из materials в сумку (один раз при открытии инвентаря). */
function migrateAccessoryShardsToInventory() {
  if (typeof ACCESSORY_FRAGS === "undefined" || !ACCESSORY_FRAGS || !state.materials) return;
  Object.keys(ACCESSORY_FRAGS).forEach((id) => {
    const qty = Math.max(0, Math.floor(Number(state.materials[id]) || 0));
    if (qty <= 0) return;
    let ok = false;
    if (typeof addShardToInventory === "function") {
      ok = !!addShardToInventory(id, qty, { silent: true });
    }
    if (!ok) return;
    ProgressStore.update("materials", (m) => {
      const next = { ...(m || {}) };
      delete next[id];
      return next;
    });
  });
}

function openInventory() {
  if (typeof migrateArmorSetMaterials === "function") migrateArmorSetMaterials();
  if (typeof migrateJewelrySetPieces === "function") migrateJewelrySetPieces();
  migrateAccessoryShardsToInventory();
  if (typeof flushOverflowLoot === "function") flushOverflowLoot({ silent: false });
  renderInventory();
  show("inv");
  Audio2.open();
}
function goInventory() {
  if (typeof migrateArmorSetMaterials === "function") migrateArmorSetMaterials();
  if (typeof migrateJewelrySetPieces === "function") migrateJewelrySetPieces();
  migrateAccessoryShardsToInventory();
  if (typeof flushOverflowLoot === "function") flushOverflowLoot({ silent: false });
  renderInventory();
  renderMenu();
  show("inv");
}

// ===== Инвентарь: логика и мутации state =====
// UI (renderInventory, drag-and-drop, crystallize UI) вынесено в inventory-ui.js.

