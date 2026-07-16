// ===== Стартовое оружие без грейда (L2 NG, wiki) — не точится =====
// Воин: Short Sword · Мистик: Wand of Adept

const STARTER_WEAPONS = [
  {
    id: "ng_short_sword",
    cat: "Sword",
    name: "Короткий меч",
    grade: "NG",
    patk: 8,
    matk: 6,
    ps: 0,
    ms: 0,
    cc: 0,
    glow: "#8a8a8a",
    icon: "icons/weapon_small_sword_i00.png",
    starter: true,
    noEnchant: true,
  },
  {
    id: "ng_wand_of_adept",
    cat: "Blunt",
    name: "Жезл ученика",
    grade: "NG",
    patk: 11,
    matk: 13,
    ps: 0,
    ms: 0,
    cc: 0,
    glow: "#8a8a8a",
    icon: "icons/weapon_apprentices_wand_i00.png",
    starter: true,
    noEnchant: true,
  },
];

function registerStarterWeapons() {
  STARTER_WEAPONS.forEach((w) => {
    WMAP[w.id] = w;
  });
}

function starterWeaponIdForClass(classId) {
  return typeof isMysticArchetype === "function" && isMysticArchetype(classId)
    ? "ng_wand_of_adept"
    : "ng_short_sword";
}

function isNoGradeWeapon(w) {
  if (!w) return false;
  return w.grade === "NG" || !!w.noEnchant || !!w.starter;
}

function weaponCanEnchant(w) {
  return !!w && !isNoGradeWeapon(w);
}

function inventoryHasStarterWeapon(classId) {
  const id = starterWeaponIdForClass(classId || state.avatar?.classId || "fighter");
  return (state.inventory || []).some((it) => {
    if (!it) return false;
    if (it.starter || it.id === id) return true;
    const def = WMAP[it.id];
    return !!(def && (def.starter || def.grade === "NG"));
  });
}

function grantStarterWeapon(classId) {
  if (typeof ensureAvatarGear !== "function") return null;
  const gear = ensureAvatarGear();
  if (gear.weapon) return gear.weapon;
  const id = starterWeaponIdForClass(classId || state.avatar?.classId || "fighter");
  const def = WMAP[id];
  if (!def) return null;
  const item = { uid: uid(), id, plus: 0, spent: 0, kind: "weapon", starter: true };
  gear.weapon = typeof avatarGearSnapshot === "function" ? avatarGearSnapshot(item) : item;
  if (state.avatar) state.avatar.starterGranted = true;
  if (typeof renderAvatarGearSlots === "function") renderAvatarGearSlots();
  return gear.weapon;
}

function ensureStarterWeapon() {
  if (!state.avatar?.created) return null;
  const gear = typeof ensureAvatarGear === "function" ? ensureAvatarGear() : null;
  if (gear?.weapon) {
    if (!state.avatar.starterGranted) state.avatar.starterGranted = true;
    return gear.weapon;
  }
  // Уже выдавали / сняли в инвентарь — не ре-экипировать (иначе дюп NG)
  if (state.avatar.starterGranted || inventoryHasStarterWeapon(state.avatar.classId)) return null;
  return grantStarterWeapon(state.avatar.classId || "fighter");
}

function migrateStarterWeapon() {
  if (!state.avatar?.created) return;
  const gear = ensureAvatarGear();
  if (gear?.weapon && !state.avatar.starterGranted) {
    state.avatar.starterGranted = true;
    save();
    return;
  }
  if (inventoryHasStarterWeapon(state.avatar.classId) && !state.avatar.starterGranted) {
    state.avatar.starterGranted = true;
    save();
    return;
  }
  const had = gear?.weapon;
  const item = ensureStarterWeapon();
  if (item && !had) save();
}

registerStarterWeapons();
