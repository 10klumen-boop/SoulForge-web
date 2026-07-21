// ===== Экипировка персонажа: core logic (слоты, бонусы, надевание/снятие) =====
// Вынесено из 23-avatar-gear.js; UI осталось в 23-avatar-gear.js.

// ===== Экипировка персонажа: слоты L2, бонусы от оружия и эпической бижутерии =====

/** UI эпик-бижутерии выключен, пока дроп/прогрессия не введены. Слоты и бонусы в данных остаются. */
const FEATURE_EPIC_JEWELRY_UI = false;

const AVATAR_GEAR_SLOTS = [
  { id: "earring_l", label: "Серьга", side: "left", row: 0, jewelry: true, placeholder: "icons/accessory_blessed_earring_of_zaken_i00.png" },
  { id: "necklace", label: "Ожерелье", side: "left", row: 1, jewelry: true, placeholder: "icons/accessory_necklace_of_valakas_i00.png" },
  { id: "ring_l", label: "Кольцо", side: "left", row: 2, jewelry: true, placeholder: "icons/accessory_ring_of_baium_i00.png" },
  { id: "weapon", label: "Оружие", side: "right", row: 0, placeholder: "icons/weapon_iron_glove_i00.png" },
  { id: "earring_r", label: "Серьга", side: "right", row: 1, jewelry: true, placeholder: "icons/accessory_earring_of_antaras_i00.png" },
  { id: "ring_r", label: "Кольцо", side: "right", row: 2, jewelry: true, placeholder: "icons/accessory_ring_of_baium_i00.png" },
];

function avatarGearSlotsForUi() {
  return AVATAR_GEAR_SLOTS.filter((s) => FEATURE_EPIC_JEWELRY_UI || !s.jewelry);
}

const WEAPON_GRADE_ENCH_MULT = { D: 0.6, C: 0.85, B: 1, A: 1.2 };

let _avatarEquipSlot = null;
let _avatarEquipFilter = { q: "", grade: "", aff: "" };

function defaultAvatarGear() {
  return { weapon: null, earring_l: null, earring_r: null, ring_l: null, ring_r: null, necklace: null };
}

function ensureAvatarGear() {
  if (!state.avatar || typeof state.avatar !== "object") {
    if (typeof defaultAvatar === "function") ProgressStore.set("avatar", defaultAvatar());
    else ProgressStore.set("avatar", { gear: defaultAvatarGear() });
  }
  if (!state.avatar.gear || typeof state.avatar.gear !== "object") {
    ProgressStore.update("avatar", (a) => ({ ...(a || {}), gear: defaultAvatarGear() }));
  }
  return state.avatar.gear;
}

function avatarGearSnapshot(it) {
  if (!it) return null;
  if (isAccessoryItem(it)) return { uid: it.uid, id: it.id, kind: "accessory" };
  const def = WMAP[it.id];
  const starter = !!it.starter || (def && typeof isNoGradeWeapon === "function" && isNoGradeWeapon(def));
  return { uid: it.uid, id: it.id, plus: it.plus || 0, spent: it.spent || 0, kind: "weapon", starter };
}

function avatarGearItemDef(item) {
  if (!item) return null;
  if (item.kind === "accessory" || isAccessoryItem(item)) return COLLECTIBLES[item.id];
  return WMAP[item.id] || null;
}

function accessorySlotType(item) {
  const def = COLLECTIBLES[item?.id];
  return def?.slot || null;
}

function slotAcceptsItem(slotId, it) {
  if (!it) return false;
  const slot = AVATAR_GEAR_SLOTS.find((s) => s.id === slotId);
  if (!slot) return false;
  if (slotId === "weapon") return !isAccessoryItem(it) && !!WMAP[it.id];
  if (!isAccessoryItem(it)) return false;
  const st = accessorySlotType(it);
  if (!st) return false;
  if (st === "earring") return slotId === "earring_l" || slotId === "earring_r";
  if (st === "ring") return slotId === "ring_l" || slotId === "ring_r";
  if (st === "necklace") return slotId === "necklace";
  return false;
}

function findInvIndexByUid(uid) {
  return (state.inventory || []).findIndex((x) => x.uid === uid);
}

function removeInvByUid(uid) {
  const idx = findInvIndexByUid(uid);
  if (idx < 0) return null;
  const inv = (state.inventory || []).slice();
  const [it] = inv.splice(idx, 1);
  ProgressStore.set("inventory", inv);
  return it;
}

function returnGearToInventory(item) {
  if (!item) return false;
  const inv = (state.inventory || []).slice();
  if (isInventoryFull()) return false;
  if (item.kind === "accessory" || isAccessoryItem(item)) {
    inv.push({ uid: item.uid, id: item.id, kind: "accessory" });
  } else {
    inv.push({
      uid: item.uid,
      id: item.id,
      plus: item.plus || 0,
      spent: item.spent || 0,
      starter: item.starter,
    });
    normalizeInvItem(inv[inv.length - 1]);
  }
  ProgressStore.set("inventory", inv);
  return true;
}

function migrateAvatarGear() {
  if (!state.avatar || typeof state.avatar !== "object") return;
  if (!state.avatar.gear || typeof state.avatar.gear !== "object") {
    ProgressStore.update("avatar", (a) => ({ ...(a || {}), gear: defaultAvatarGear() }));
  }
  const gear = state.avatar.gear;
  if (state.equipped && state.equipped.zaken_blessed_earring) {
    if (!gear.earring_l && !gear.earring_r) {
      const invIdx = (state.inventory || []).findIndex((it) => it.id === "zaken_blessed_earring");
      if (invIdx >= 0) {
        const it = state.inventory[invIdx];
        gear.earring_l = avatarGearSnapshot(it);
        const inv = (state.inventory || []).slice();
        inv.splice(invIdx, 1);
        ProgressStore.set("inventory", inv);
      } else {
        gear.earring_l = { uid: uid(), id: "zaken_blessed_earring", kind: "accessory" };
      }
    }
    ProgressStore.update("equipped", (e) => {
      const next = { ...(e || {}) };
      delete next.zaken_blessed_earring;
      return Object.keys(next).length ? next : {};
    });
  }
}

function iterEquippedGear() {
  const gear = ensureAvatarGear();
  const out = [];
  AVATAR_GEAR_SLOTS.forEach((s) => {
    const item = gear[s.id];
    if (item) out.push({ slot: s.id, item, def: avatarGearItemDef(item) });
  });
  return out;
}

function equippedWeaponItem() {
  const gear = ensureAvatarGear();
  const item = gear?.weapon;
  if (!item || isAccessoryItem(item) || !WMAP[item.id]) return null;
  return item;
}

function isEquippedWeaponItem(item) {
  if (!item || !item.uid) return false;
  const eq = equippedWeaponItem();
  return !!(eq && eq.uid === item.uid);
}

function avatarGearEnchantBonus(plus, behavior) {
  if (behavior === "guarantee" || plus < safeLevel()) return 0;
  let b = 0;
  const weapon = ensureAvatarGear().weapon;
  if (weapon) {
    const w = WMAP[weapon.id];
    const p = weapon.plus || 0;
    if (w && p >= 4) {
      const mult = WEAPON_GRADE_ENCH_MULT[w.grade] || 1;
      b += Math.min(0.006, (p - 3) * 0.00035 * mult);
    }
  }
  iterEquippedGear().forEach(({ item }) => {
    if (item.kind === "weapon") return;
    const def = COLLECTIBLES[item.id];
    if (def?.bonuses?.enchant) b += def.bonuses.enchant;
  });
  return b;
}

function avatarGearMineAdenaMult() {
  let m = 1;
  iterEquippedGear().forEach(({ item }) => {
    const def = COLLECTIBLES[item.id];
    if (def?.bonuses?.mineAdena) m += def.bonuses.mineAdena;
  });
  return m;
}

function avatarGearXpMult() {
  let m = 1;
  iterEquippedGear().forEach(({ item }) => {
    const def = COLLECTIBLES[item.id];
    if (def?.bonuses?.avatarXp) m += def.bonuses.avatarXp;
  });
  return m;
}

function avatarGearBonusSummary() {
  const lines = [];
  const ench = avatarGearEnchantBonus(safeLevel(), "regular");
  if (ench > 0) lines.push("Экип: +" + (ench * 100).toFixed(2) + "% заточка");
  const mineM = avatarGearMineAdenaMult();
  if (mineM > 1) lines.push("+" + Math.round((mineM - 1) * 100) + "% adena в задании");
  const xpM = avatarGearXpMult();
  if (xpM > 1) lines.push("+" + Math.round((xpM - 1) * 100) + "% опыт души");
  return { lines, ench, mineM, xpM };
}

function isItemEquipped(uid) {
  const gear = ensureAvatarGear();
  return AVATAR_GEAR_SLOTS.some((s) => gear[s.id]?.uid === uid);
}

function equipAvatarSlot(slotId, invItem) {
  if (!state.avatar?.created) {
    toast("Сначала создай персонажа", "warn");
    return false;
  }
  const slotMeta = AVATAR_GEAR_SLOTS.find((s) => s.id === slotId);
  if (!FEATURE_EPIC_JEWELRY_UI && slotMeta?.jewelry) {
    toast("Эпическая бижутерия пока недоступна", "warn");
    return false;
  }
  if (!slotAcceptsItem(slotId, invItem)) {
    toast("Предмет не подходит для этого слота", "warn");
    return false;
  }
  const idx = findInvIndexByUid(invItem.uid);
  if (idx < 0) {
    toast("Предмет не в инвентаре", "warn");
    return false;
  }
  const gear = ensureAvatarGear();
  const prev = gear[slotId];
  if (prev) {
    if (!returnGearToInventory(prev)) {
      toast("Инвентарь полон — сначала освободи место", "warn");
      return false;
    }
  }
  const taken = removeInvByUid(invItem.uid);
  if (!taken) return false;
  const snap = avatarGearSnapshot(taken);
  ProgressStore.update("avatar", (a) => {
    const next = { ...(a || {}) };
    const gear = { ...(next.gear || defaultAvatarGear()) };
    gear[slotId] = snap;
    next.gear = gear;
    return next;
  });
  save();
  Audio2.success();
  const def = avatarGearItemDef(snap);
  const slotLabel = AVATAR_GEAR_SLOTS.find((s) => s.id === slotId)?.label || "Слот";
  toast("Надето: " + (def?.name || "?") + " · " + slotLabel, "success");
  renderAvatarGearSlots();
  renderAvatarHub();
  renderMenu();
  if ($("#screen-inv")?.classList.contains("active") && typeof renderInventory === "function") renderInventory();
  if (typeof renderAvatarStatsPanel === "function") renderAvatarStatsPanel();
  if ($("#screen-avatar")?.classList.contains("active")) renderAvatarScreen();
  return true;
}

function unequipAvatarSlot(slotId) {
  const gear = ensureAvatarGear();
  const item = gear[slotId];
  if (!item) return false;
  if (!returnGearToInventory(item)) {
    toast("Инвентарь полон", "warn");
    return false;
  }
  ProgressStore.update("avatar", (a) => {
    const next = { ...(a || {}) };
    const gear = { ...(next.gear || defaultAvatarGear()) };
    gear[slotId] = null;
    next.gear = gear;
    return next;
  });
  save();
  Audio2.click();
  const def = avatarGearItemDef(item);
  toast("Снято: " + (def?.name || "?"), "system");
  renderAvatarGearSlots();
  renderAvatarHub();
  renderMenu();
  if ($("#screen-inv")?.classList.contains("active") && typeof renderInventory === "function") renderInventory();
  if (typeof renderAvatarStatsPanel === "function") renderAvatarStatsPanel();
  if ($("#screen-avatar")?.classList.contains("active")) renderAvatarScreen();
  return true;
}

function equipAccessoryToAvatar(item) {
  if (!FEATURE_EPIC_JEWELRY_UI) {
    toast("Эпическая бижутерия пока недоступна", "warn");
    return false;
  }
  if (!isAccessoryItem(item)) return false;
  const st = accessorySlotType(item);
  if (!st) return false;
  const gear = ensureAvatarGear();
  const order =
    st === "earring" ? ["earring_l", "earring_r"] :
    st === "ring" ? ["ring_l", "ring_r"] :
    st === "necklace" ? ["necklace"] : [];
  let target = order.find((sid) => !gear[sid]);
  if (!target) target = order.find((sid) => gear[sid]?.id !== item.id);
  if (!target) {
    toast("Слоты «" + (st === "earring" ? "серьга" : st === "ring" ? "кольцо" : "ожерелье") + "» заняты", "warn");
    return false;
  }
  return equipAvatarSlot(target, item);
}

function firstFreeSlotForItem(it) {
  return avatarGearSlotsForUi().map((s) => s.id).find((sid) => !ensureAvatarGear()[sid] && slotAcceptsItem(sid, it)) || null;
}

function listEquippableForSlot(slotId) {
  return (state.inventory || []).filter((it) => slotAcceptsItem(slotId, it));
}

function avatarEquipItemPower(it) {
  if (!it || isAccessoryItem(it)) return 0;
  const def = WMAP[it.id];
  if (!def) return 0;
  const plus = it.plus || 0;
  const mystic = typeof avatarIsMystic === "function" && avatarIsMystic();
  if (mystic && typeof mysticWeaponPower === "function") return mysticWeaponPower(def, plus);
  if (typeof fighterWeaponPower === "function") return fighterWeaponPower(def, plus);
  return typeof itemPower === "function" ? itemPower(it) : (def.patk || 0) + plus * (def.ps || 0);
}

function avatarEquipItemGrade(it) {
  if (!it) return "";
  if (isAccessoryItem(it)) return "epic";
  const def = WMAP[it.id];
  if (!def) return "";
  if (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(def)) return "NG";
  return def.grade || "";
}

function filteredEquippableForSlot(slotId) {
  const q = (_avatarEquipFilter.q || "").trim().toLowerCase();
  const grade = _avatarEquipFilter.grade || "";
  const aff = _avatarEquipFilter.aff || "";
  let options = listEquippableForSlot(slotId);
  if (q) {
    options = options.filter((it) => {
      const def = invItemDef(it);
      return def && String(def.name || "").toLowerCase().includes(q);
    });
  }
  if (grade) {
    options = options.filter((it) => avatarEquipItemGrade(it) === grade);
  }
  if (aff && slotId === "weapon") {
    options = options.filter((it) => {
      const def = WMAP[it.id];
      return def && typeof weaponAffinity === "function" && weaponAffinity(def) === aff;
    });
  }
  options.sort((a, b) => {
    const pa = avatarEquipItemPower(a);
    const pb = avatarEquipItemPower(b);
    if (pb !== pa) return pb - pa;
    const ga = avatarEquipItemGrade(a);
    const gb = avatarEquipItemGrade(b);
    const rank = { A: 4, B: 3, C: 2, D: 1, NG: 0, epic: 5 };
    if ((rank[gb] || 0) !== (rank[ga] || 0)) return (rank[gb] || 0) - (rank[ga] || 0);
    const na = invItemDef(a)?.name || "";
    const nb = invItemDef(b)?.name || "";
    return na.localeCompare(nb, "ru");
  });
  return options;
}

function syncAvatarEquipFilterUi(slotId) {
  const tools = document.getElementById("avatarEquipTools");
  const affBar = document.getElementById("avatarEquipAff");
  const search = document.getElementById("avatarEquipSearch");
  if (tools) tools.hidden = false;
  if (affBar) affBar.hidden = slotId !== "weapon";
  if (search && search.value !== (_avatarEquipFilter.q || "")) search.value = _avatarEquipFilter.q || "";
  document.querySelectorAll("#avatarEquipGrades .avatar-equip-grade").forEach((btn) => {
    btn.classList.toggle("sel", (btn.dataset.grade || "") === (_avatarEquipFilter.grade || ""));
  });
  document.querySelectorAll("#avatarEquipAff .avatar-equip-aff-btn").forEach((btn) => {
    btn.classList.toggle("sel", (btn.dataset.aff || "") === (_avatarEquipFilter.aff || ""));
  });
}

