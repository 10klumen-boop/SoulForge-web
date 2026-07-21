// ===== Персонаж: core logic (создание, уровни, опыт, миграции) =====
// Вынесено из 22-avatar.js; UI осталось в 22-avatar.js.
// Данные рас/классов в data/avatar-data.js.

// ===== Персонаж: логика и UI создания =====
// Данные рас/классов (L2_CLASSES, L2_RACES, L2_RACE_CLASSES) вынесены в data/avatar-data.js.

const AVATAR_MAX_LEVEL = 20;
const AVATAR_XP_BASE = 100;

function avatarArchetypeIcon(raceId, classId) {
  const map = L2_ARCHETYPE_ICONS[raceId];
  if (map && map[classId]) return map[classId];
  const cls = L2_CLASSES[classId];
  return cls ? cls.icon : L2_CLASSES.fighter.icon;
}

let _avatarSetupDraft = { step: 1, raceId: null, classId: null, genderId: null };

function defaultAvatar() {
  const gear = typeof defaultAvatarGear === "function"
    ? defaultAvatarGear()
    : { weapon: null, earring_l: null, earring_r: null, ring_l: null, ring_r: null, necklace: null };
  return { raceId: "", classId: "", genderId: "", name: "", level: 1, xp: 0, created: false, gear };
}

function avatarRaceInfo(raceId) {
  return L2_RACES.find((r) => r.id === raceId) || null;
}

function avatarClassInfo(classId, raceId) {
  const cls = L2_CLASSES[classId] || L2_CLASSES.fighter;
  if (!raceId) return cls;
  return Object.assign({}, cls, { icon: avatarArchetypeIcon(raceId, classId) });
}

function avatarDisplayInfo(a) {
  a = a || state.avatar || {};
  const race = avatarRaceInfo(a.raceId);
  const cls = avatarClassInfo(a.classId, a.raceId);
  if (!race || !a.classId) {
    return {
      icon: cls.icon,
      name: cls.name,
      raceName: "",
      className: cls.name,
      desc: cls.desc,
      fullTitle: cls.name,
    };
  }
  return {
    icon: cls.icon,
    name: cls.name + " · " + race.name,
    raceName: race.name,
    className: cls.name,
    desc: race.desc + " " + cls.desc,
    fullTitle: race.name + " — " + cls.name,
  };
}

function migrateAvatar() {
  if (!state.avatar || typeof state.avatar !== "object") ProgressStore.set("avatar", defaultAvatar());
  const a = state.avatar;
  if (!a) return;
  ProgressStore.update("avatar", (base) => {
    const next = { ...base };
    if (next.classId === "smith") next.classId = "fighter";
    if (!next.level || next.level < 1) next.level = 1;
    if (next.xp == null || next.xp < 0) next.xp = 0;
    if (next.created && (!next.raceId || !next.classId)) {
      next.raceId = next.raceId || "human";
      next.classId = next.classId || "fighter";
    }
    if (next.created && !next.genderId) next.genderId = "male";
    if (next.created && next.prologueSeen == null && state.storySeen) next.prologueSeen = true;
    if (next.created && next.prologueSeen == null) next.prologueSeen = false;
    if (!next.created) {
      // Пустой слот ростера ждёт мастер создания — не поднимаем «Странника» из чужого прогресса.
      let emptySlot = false;
      if (Array.isArray(state.characters) && state.characters.length && state.activeCharacterId) {
        const slot = state.characters.find((c) => c.id === state.activeCharacterId);
        if (slot && typeof slotIsCreated === "function" && !slotIsCreated(slot)) emptySlot = true;
      }
      const hasProgress =
        state.storySeen ||
        (state.totals?.tries || 0) > 0 ||
        (state.totals?.fails || 0) > 0 ||
        inventoryCount() > 0 ||
        (state.adena || 0) > START_ADENA + 500;
      if (!emptySlot && hasProgress) {
        next.name = (next.name && String(next.name).trim()) || "Странник";
        next.raceId = next.raceId || "human";
        next.classId = next.classId || "fighter";
        next.genderId = next.genderId || "male";
        next.created = true;
      }
    }
    return next;
  });
  if (typeof migrateAvatarGear === "function") migrateAvatarGear();
  if (typeof migrateStarterWeapon === "function") migrateStarterWeapon();
}

function avatarXpToLevel(level) {
  return Math.floor(AVATAR_XP_BASE * Math.pow(1.32, Math.max(0, level - 1)));
}

function avatarTitle(level) {
  const lv = Math.max(1, Math.min(AVATAR_MAX_LEVEL, level || 1));
  if (lv <= 4) return "Новичок";
  if (lv <= 8) return "Подмастерье";
  if (lv <= 12) return "Адепт";
  if (lv <= 16) return "Мастер";
  return "Грандмастер";
}

function avatarProgress() {
  migrateAvatar();
  const a = state.avatar;
  const level = Math.min(a.level || 1, AVATAR_MAX_LEVEL);
  if (level >= AVATAR_MAX_LEVEL) return { level, xp: 0, need: 0, pct: 100 };
  const need = avatarXpToLevel(level);
  const xp = a.xp || 0;
  return { level, xp, need, pct: need ? Math.min(100, (xp / need) * 100) : 0 };
}

/** Бонус к шансу заточки с +4: с 9 уровня, до +0.5% на 20. */
function avatarEnchantBonus(plus, behavior) {
  if (behavior === "guarantee" || plus < safeLevel()) return 0;
  migrateAvatar();
  const lvl = state.avatar.level || 1;
  const minLvl = 9;
  if (lvl < minLvl) return 0;
  const cap = 0.005;
  return Math.min(cap, (lvl - (minLvl - 1)) * 0.0005);
}

function needsAvatarSetup() {
  migrateAvatar();
  const a = state.avatar;
  return !a.created || !String(a.name || "").trim() || !a.raceId || !a.classId || !a.genderId;
}

function createAvatar(name, raceId, classId, genderId) {
  migrateAvatar();
  const n = String(name || "").trim().slice(0, 16);
  const race = avatarRaceInfo(raceId);
  const branches = L2_RACE_CLASSES[raceId] || [];
  const gender = typeof normalizeAvatarGender === "function" ? normalizeAvatarGender(genderId) : "male";
  if (!race || !branches.includes(classId)) return false;
  if (n.length < 2) return false;
  const base = typeof defaultAvatar === "function" ? defaultAvatar() : {
    raceId: "", classId: "", genderId: "", name: "", level: 1, xp: 0, created: false, gear: { weapon: null },
  };
  ProgressStore.set("avatar", Object.assign({}, base, {
    raceId,
    classId,
    genderId: gender,
    name: n,
    level: 1,
    xp: 0,
    created: true,
    prologueSeen: false,
    starterGranted: false,
  }));
  if (typeof grantStarterWeapon === "function") {
    const item = grantStarterWeapon(classId);
    ProgressStore.update("avatar", (a) => ({ ...(a || {}), starterGranted: true }));
    const def = item && WMAP[item.id];
    if (def && typeof gameLog === "function") {
      gameLog("Старт: " + def.name + " (NG — не точится, добудь D+ в задании)", "system");
    }
  }
  save();
  return true;
}

function grantAvatarXp(amount, opts) {
  opts = opts || {};
  if (!amount || amount <= 0) return;
  migrateAvatar();
  if (!state.avatar.created) return;
  if (typeof avatarGearXpMult === "function") amount = Math.round(amount * avatarGearXpMult());
  let leveled = false;
  ProgressStore.update("avatar", (a) => {
    const next = { ...a };
    if (next.level >= AVATAR_MAX_LEVEL) return next;
    next.xp = (next.xp || 0) + amount;
    while (next.level < AVATAR_MAX_LEVEL) {
      const need = avatarXpToLevel(next.level);
      if (next.xp < need) break;
      next.xp -= need;
      next.level++;
      leveled = true;
    }
    if (next.level >= AVATAR_MAX_LEVEL) next.xp = 0;
    return next;
  });
  const a = state.avatar;
  if (leveled && !opts.silent) {
    toast("Уровень " + a.level + " — " + avatarTitle(a.level), "success");
    if (typeof gameLog === "function") {
      gameLog("Персонаж: уровень " + a.level + " · " + avatarTitle(a.level), "system");
    }
    if (typeof combatSkillsForAvatar === "function") {
      combatSkillsForAvatar().forEach((s) => {
        if (a.level === s.unlockLevel && typeof toast === "function") {
          toast("Открыт скилл: " + s.name, "success");
        }
      });
    }
  }
  if (leveled) save();
  if (leveled && typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
  if (leveled && typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  renderAvatarHub();
  renderMenu();
  if (typeof refreshZoneStoryUnlocks === "function") refreshZoneStoryUnlocks();
  if ($("#screen-avatar")?.classList.contains("active")) renderAvatarScreen();
  if (typeof renderAvatarSkillsPanel === "function") renderAvatarSkillsPanel();
}

function onEnchantAvatarXp(win, plus, behavior, broken) {
  if (!state.avatar?.created) return;
  if (win) {
    const risky = plus >= safeLevel();
    grantAvatarXp((risky ? 8 : 3) + Math.min(6, plus || 0), { silent: true });
  } else {
    grantAvatarXp(broken ? 6 : 4, { silent: true });
  }
}

function onMineAvatarXp(golden) {
  if (!state.avatar?.created) return;
  const zone = typeof farmZoneById === "function" ? farmZoneById(state.farmZone || "banana_mine") : { chapter: 1 };
  const ch = zone.chapter || 1;
  // Чуть выше, чтобы киллы главы подводили к reqLevel следующей зоны
  let amt = golden ? 10 + ch * 3 : 3 + ch * 2;
  if (state.avatar.raceId === "dwarf") amt = Math.round(amt * 1.15);
  grantAvatarXp(amt, { silent: true });
}

function onSellAvatarXp(plus) {
  if (!state.avatar?.created || plus < 4) return;
  grantAvatarXp(10 + Math.min(10, plus), { silent: true });
}

