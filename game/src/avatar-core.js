// ===== Персонаж: core logic (создание, уровни, опыт, миграции) =====
// Вынесено из 22-avatar.js; UI осталось в 22-avatar.js.
// Данные рас/классов в data/avatar-data.js.

// ===== Персонаж: логика и UI создания =====
// Данные рас/классов (L2_CLASSES, L2_RACES, L2_RACE_CLASSES) вынесены в data/avatar-data.js.

const AVATAR_MAX_LEVEL = 45;
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
  return { raceId: "", classId: "", genderId: "", name: "", level: 1, xp: 0, created: false, gear, professionId: null, professionTier: 0 };
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
  const prof = typeof currentProfession === "function" ? currentProfession(a) : null;
  const className = prof ? cls.name + " → " + prof.name : cls.name;
  if (!race || !a.classId) {
    return {
      icon: cls.icon,
      name: className,
      raceName: "",
      className,
      desc: prof ? prof.desc : cls.desc,
      fullTitle: className,
    };
  }
  return {
    icon: prof?.icon || cls.icon,
    name: className + " · " + race.name,
    raceName: race.name,
    className,
    desc: race.desc + " " + (prof ? prof.desc : cls.desc),
    fullTitle: race.name + " — " + className,
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
    if (typeof migrateAvatarProfessionFields === "function") {
      migrateAvatarProfessionFields(next);
    } else {
      if (next.professionId == null) next.professionId = null;
      if (next.professionTier == null) next.professionTier = 0;
    }
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
  if (lv <= 9) return "Подмастерье";
  if (lv <= 19) return "Адепт";
  if (lv <= 29) return "Мастер";
  if (lv <= 39) return "Ветеран";
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

/** Бонус к шансу заточки с +4: с 9 уровня, до +0.5% на 20 + расовый пассив. */
function avatarEnchantBonus(plus, behavior) {
  if (behavior === "guarantee" || plus < safeLevel()) return 0;
  migrateAvatar();
  const lvl = state.avatar.level || 1;
  const minLvl = 9;
  let bonus = 0;
  if (lvl >= minLvl) {
    const cap = 0.006;
    bonus = Math.min(cap, (lvl - (minLvl - 1)) * 0.00035);
  }
  if (typeof passiveEffectSum === "function") {
    bonus += passiveEffectSum("enchantChanceAdd", state.avatar, lvl);
  } else if (typeof racialEffectSum === "function") {
    bonus += racialEffectSum("enchantChanceAdd", state.avatar.raceId, lvl);
  }
  return Math.max(0, bonus);
}

function needsAvatarSetup() {
  migrateAvatar();
  const a = state.avatar;
  return !a.created || !String(a.name || "").trim() || !a.raceId || !a.classId || !a.genderId;
}

function isAvatarNameTakenLocally(name, excludeCharId) {
  const want = String(name || "").trim().toLowerCase();
  if (want.length < 2) return false;
  const chars = Array.isArray(state.characters) ? state.characters : [];
  for (const c of chars) {
    if (!c || (excludeCharId && c.id === excludeCharId)) continue;
    const av = c.progress?.avatar;
    if (!av?.created) continue;
    const n = String(av.name || "").trim().toLowerCase();
    if (n && n === want) return true;
  }
  return false;
}

function validateAvatarNameLocal(name, opts) {
  opts = opts || {};
  const n = String(name || "").trim().slice(0, 16);
  if (n.length < 2) return { ok: false, error: "Имя: 2–16 символов" };
  if (isAvatarNameTakenLocally(n, opts.excludeCharId || state.activeCharacterId)) {
    return { ok: false, error: "Имя уже занято другим персонажем аккаунта" };
  }
  return { ok: true, name: n };
}

async function checkAvatarNameAvailable(name, opts) {
  opts = opts || {};
  const local = validateAvatarNameLocal(name, opts);
  if (!local.ok) return local;
  if (typeof cloudEnabled !== "function" || !cloudEnabled()) return local;
  if (typeof readCloudAuth !== "function" || !readCloudAuth()?.token) return local;
  try {
    const q = new URLSearchParams({ name: local.name });
    const cid = opts.excludeCharId || state.activeCharacterId;
    if (cid) q.set("characterId", cid);
    const headers = typeof authHeaders === "function" ? authHeaders(false) : {};
    const res = await fetch(cloudApiUrl("/chars/name-available?" + q.toString()), { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || "Не удалось проверить имя" };
    }
    if (data.available === false) {
      return { ok: false, error: data.error || "Имя уже занято" };
    }
    return { ok: true, name: local.name };
  } catch (e) {
    return { ok: false, error: "Сеть недоступна — проверь имя позже" };
  }
}

function createAvatar(name, raceId, classId, genderId) {
  migrateAvatar();
  const local = validateAvatarNameLocal(name, { excludeCharId: state.activeCharacterId });
  if (!local.ok) return false;
  const n = local.name;
  const race = avatarRaceInfo(raceId);
  const branches = L2_RACE_CLASSES[raceId] || [];
  const gender = typeof normalizeAvatarGender === "function" ? normalizeAvatarGender(genderId) : "male";
  if (!race || !branches.includes(classId)) return false;
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
    professionId: null,
    professionTier: 0,
  }));
  // Новый персонаж — Ючи стартует автоматически после пролога
  if (typeof defaultMentorProgress === "function") {
    ProgressStore.set(
      "mentor",
      Object.assign(defaultMentorProgress(), { autoStart: true, skipped: false })
    );
  } else {
    ProgressStore.set("mentor", {
      skipped: false,
      autoStart: true,
      bitId: null,
      lineIndex: 0,
      doneBits: {},
      doneLessons: {},
      chapterIntroSeen: {},
      started: false,
      kitGranted: false,
    });
  }
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
  if (!opts.noClanBuff && typeof clanBuffXpPct === "function") {
    const xpPct = clanBuffXpPct();
    if (xpPct > 0) amount = Math.round(amount * (1 + xpPct / 100));
  }
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
  if (leveled && typeof Audio2 !== "undefined" && Audio2.levelup) Audio2.levelup();
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
  if (leveled && typeof maybeShowHuntingGraduation === "function") maybeShowHuntingGraduation();
  if (leveled && typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (leveled && typeof canChooseProfession === "function" && canChooseProfession(state.avatar)) {
    if (typeof toast === "function") {
      const t = typeof pendingProfessionTier === "function" ? pendingProfessionTier(state.avatar) : 0;
      toast(
        t === 2 ? "Доступна 2-я профессия — открой Персонажа" : "Доступна 1-я профессия — открой Персонажа",
        "success"
      );
    }
  }
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
    grantAvatarXp(risky ? 1 + Math.min(1, plus || 0) : 1, { silent: true });
  } else {
    grantAvatarXp(1, { silent: true });
  }
}

function onMineAvatarXp(golden) {
  if (!state.avatar?.created) return;
  const zone = typeof farmZoneById === "function" ? farmZoneById(state.farmZone || "banana_mine") : { chapter: 1 };
  let amt =
    typeof farmZoneMineXp === "function"
      ? farmZoneMineXp(zone, !!golden)
      : (() => {
          const ch =
            typeof farmZoneProgressChapter === "function"
              ? farmZoneProgressChapter(zone)
              : zone.chapter || 1;
          return golden
            ? Math.max(1, Math.round((8 + ch * 2) / 8))
            : Math.max(1, Math.ceil((2 + ch) / 8));
        })();
  if (typeof passiveEffectMult === "function") {
    amt = Math.round(amt * passiveEffectMult("mineXpMult", state.avatar));
  } else if (typeof racialEffectMult === "function") {
    amt = Math.round(amt * racialEffectMult("mineXpMult", state.avatar.raceId));
  }
  grantAvatarXp(amt, { silent: true });
}

function onSellAvatarXp(plus) {
  if (!state.avatar?.created || plus < 4) return;
  grantAvatarXp(10 + Math.min(10, plus), { silent: true });
}

