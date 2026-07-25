// ===== Профессии: core (резолв, выбор, affinity, миграция) =====

function professionById(id) {
  if (!id || typeof PROFESSIONS === "undefined") return null;
  return PROFESSIONS[id] || null;
}

function starterClassId(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  return a.classId || "fighter";
}

function currentProfession(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  return professionById(a.professionId);
}

function professionTierOf(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  if (a.professionTier != null) return Math.max(0, a.professionTier | 0);
  const p = currentProfession(a);
  return p ? p.tier : 0;
}

function combatRole(avatar) {
  const p = currentProfession(avatar);
  if (p?.role) return p.role;
  const cid = starterClassId(avatar);
  if (cid === "shaman") return "support";
  if (typeof isMysticArchetype === "function" && isMysticArchetype(cid)) return "mage";
  return "melee";
}

function professionArmorPref(avatar) {
  const p = currentProfession(avatar);
  if (p?.armorPref) return p.armorPref;
  const role = p?.role || combatRole(avatar);
  if (typeof ROLE_ARMOR_PREF !== "undefined" && ROLE_ARMOR_PREF[role]) {
    return ROLE_ARMOR_PREF[role];
  }
  const cid = starterClassId(avatar);
  if (typeof STARTER_ARMOR_PREF !== "undefined" && STARTER_ARMOR_PREF[cid]) {
    return STARTER_ARMOR_PREF[cid];
  }
  return "heavy";
}

function professionWeaponCats(avatar) {
  const p = currentProfession(avatar);
  const role = p?.role || combatRole(avatar);
  if (typeof ROLE_WEAPON_CATS !== "undefined" && ROLE_WEAPON_CATS[role]) {
    return ROLE_WEAPON_CATS[role].slice();
  }
  const cid = starterClassId(avatar);
  if (typeof STARTER_WEAPON_CATS !== "undefined" && STARTER_WEAPON_CATS[cid]) {
    return STARTER_WEAPON_CATS[cid].slice();
  }
  return [];
}

function avatarWeaponMasteryActive(w, avatar) {
  if (!w) return false;
  const cats = professionWeaponCats(avatar);
  if (!cats.length) return false;
  if (cats.indexOf(w.cat) < 0) return false;
  // Мистик / маг / саппорт: мечи только с маг. или унив. сродством
  if (w.cat === "Sword") {
    const role = typeof combatRole === "function" ? combatRole(avatar) : null;
    const cid = typeof starterClassId === "function" ? starterClassId(avatar) : avatar?.classId;
    const mageLike = cid === "mystic" || role === "mage" || role === "support";
    if (mageLike) {
      const aff =
        typeof weaponAffinity === "function"
          ? weaponAffinity(w)
          : w.weaponKind || w.affinity || "physical";
      if (aff === "physical") return false;
    }
  }
  return true;
}

function avatarWeaponMasteryMult(w, avatar) {
  const on = typeof WEAPON_MASTERY_MULT === "number" ? WEAPON_MASTERY_MULT : 1.06;
  return avatarWeaponMasteryActive(w, avatar) ? on : 1;
}

function gradeRankOf(grade) {
  if (!grade) return 0;
  const g = String(grade).toUpperCase();
  if (typeof GRADE_RANK !== "undefined" && GRADE_RANK[g] != null) return GRADE_RANK[g];
  if (g === "NG" || g === "NONE") return 0;
  return 0;
}

/** Максимальный грейд без штрафа по уровню. */
function avatarAllowedGrade(level) {
  const lv = Math.max(1, level || 1);
  const unlock = typeof GRADE_UNLOCK_LEVEL !== "undefined" ? GRADE_UNLOCK_LEVEL : { NG: 1, D: 10, C: 40 };
  if (lv >= (unlock.C || 40)) return "C";
  if (lv >= (unlock.D || 10)) return "D";
  return "NG";
}

function isGradeOverLevel(grade, level) {
  const g = String(grade || "NG").toUpperCase();
  if (g === "NG" || g === "NONE" || !g) return false;
  return gradeRankOf(g) > gradeRankOf(avatarAllowedGrade(level));
}

/** На сколько рангов грейд предмета выше дозволенного (0 = без штрафа). */
function gradeOverLevelGap(grade, level) {
  const gap = gradeRankOf(grade) - gradeRankOf(avatarAllowedGrade(level));
  return gap > 0 ? gap : 0;
}

/**
 * Множитель статов за overgrade: чем больше разрыв рангов, тем сильнее штраф.
 * gap1 → 0.60, gap2 → 0.20, gap3+ → FLOOR (0.1).
 */
function avatarGradePenaltyMult(grade, level) {
  const gap = gradeOverLevelGap(grade, level);
  if (gap <= 0) return 1;
  const step = typeof GRADE_OVERLEVEL_STEP === "number" ? GRADE_OVERLEVEL_STEP : 0.4;
  const floor = typeof GRADE_OVERLEVEL_FLOOR === "number" ? GRADE_OVERLEVEL_FLOOR : 0.1;
  return Math.max(floor, Math.round((1 - gap * step) * 1000) / 1000);
}

/** Уровень персонажа для проверок грейда. */
function avatarLevelForGrade(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  return Math.max(1, a.level || 1);
}

/** Есть ли на персонаже экип (броня или оружие) выше дозволенного грейда. */
function avatarHasOvergradeGear(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  const lv = avatarLevelForGrade(a);
  if (typeof iterEquippedGear !== "function") return false;
  let hit = false;
  iterEquippedGear().forEach(({ item }) => {
    if (hit) return;
    const def =
      typeof avatarGearItemDef === "function"
        ? avatarGearItemDef(item)
        : item?.kind === "weapon" && typeof WMAP !== "undefined"
          ? WMAP[item.id]
          : typeof AMAP !== "undefined" && AMAP[item.id];
    if (def?.grade && isGradeOverLevel(def.grade, lv)) hit = true;
  });
  return hit;
}

/** Худший (наименьший) множитель грейда среди надетого экипа. */
function avatarWorstGradePenaltyMult(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  const lv = avatarLevelForGrade(a);
  if (typeof iterEquippedGear !== "function") return 1;
  let worst = 1;
  iterEquippedGear().forEach(({ item }) => {
    const def =
      typeof avatarGearItemDef === "function"
        ? avatarGearItemDef(item)
        : item?.kind === "weapon" && typeof WMAP !== "undefined"
          ? WMAP[item.id]
          : typeof AMAP !== "undefined" && AMAP[item.id];
    if (!def?.grade) return;
    const m = avatarGradePenaltyMult(def.grade, lv);
    if (m < worst) worst = m;
  });
  return worst;
}

function gradeUnlockNextHint(allowed) {
  const unlock = typeof GRADE_UNLOCK_LEVEL !== "undefined" ? GRADE_UNLOCK_LEVEL : { D: 10, C: 40 };
  if (allowed === "NG") return "D с ур. " + (unlock.D || 10);
  if (allowed === "D") return "C с ур. " + (unlock.C || 40);
  return null;
}

function gradePenaltyHintLine(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  const lv = avatarLevelForGrade(a);
  const allowed = avatarAllowedGrade(lv);
  const next = gradeUnlockNextHint(allowed);
  const step = typeof GRADE_OVERLEVEL_STEP === "number" ? GRADE_OVERLEVEL_STEP : 0.4;
  const stepPct = Math.round(step * 100);
  if (avatarHasOvergradeGear(a)) {
    const worst = avatarWorstGradePenaltyMult(a);
    const pct = Math.round((1 - worst) * 100);
    return (
      "Штраф грейда: экип выше «" +
      allowed +
      "» до −" +
      pct +
      "% (−" +
      stepPct +
      "%/ранг)" +
      (next ? " · " + next : "")
    );
  }
  return "Грейд без штрафа: до «" + allowed + "»" + (next ? " · " + next : "");
}

/** Множитель силы оружия с учётом штрафа грейда по уровню. */
function weaponGradePowerMult(w, level) {
  if (!w) return 1;
  const lv = level != null ? level : avatarLevelForGrade();
  return avatarGradePenaltyMult(w.grade, lv);
}

function professionSkillOverlay(avatar) {
  const p = currentProfession(avatar);
  return (p && p.skillOverlay) || [];
}

function professionPassiveIds(avatar) {
  const p = currentProfession(avatar);
  return (p && Array.isArray(p.passiveIds) ? p.passiveIds : []) || [];
}

/** Доступные профессии для следующего тира (или [] если нечего выбирать). */
function availableProfessionChoices(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  if (!a.created || !a.raceId || !a.classId) return [];
  if (typeof PROFESSIONS === "undefined") return [];
  const tier = professionTierOf(a);
  const nextTier = tier + 1;
  if (nextTier > 2) return [];
  const needLvl =
    typeof PROFESSION_TIER_LEVELS !== "undefined" ? PROFESSION_TIER_LEVELS[nextTier] : nextTier === 1 ? 10 : 40;
  if ((a.level || 1) < needLvl) return [];

  const list = [];
  Object.keys(PROFESSIONS).forEach((id) => {
    const p = PROFESSIONS[id];
    if (!p || p.tier !== nextTier) return;
    if (p.baseClass !== a.classId) return;
    if (!p.races || p.races.indexOf(a.raceId) < 0) return;
    if (nextTier === 1) {
      if (p.from != null && p.from.length) return;
    } else {
      const from = p.from || [];
      if (!a.professionId || from.indexOf(a.professionId) < 0) return;
    }
    list.push(p);
  });
  return list;
}

function canChooseProfession(avatar) {
  return availableProfessionChoices(avatar).length > 0;
}

function pendingProfessionTier(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  const tier = professionTierOf(a);
  if (!canChooseProfession(a)) return 0;
  return tier + 1;
}

function chooseProfession(professionId, opts) {
  opts = opts || {};
  const a = typeof state !== "undefined" ? state.avatar : null;
  if (!a?.created) return false;
  const choices = availableProfessionChoices(a);
  const pick = choices.find((p) => p.id === professionId);
  if (!pick) {
    if (typeof toast === "function") toast("Эта профессия недоступна", "warn");
    return false;
  }
  if (typeof ProgressStore === "undefined") return false;
  ProgressStore.update("avatar", (base) => ({
    ...(base || {}),
    professionId: pick.id,
    professionTier: pick.tier,
  }));
  if (typeof save === "function") save();
  if (!opts.silent) {
    if (typeof toast === "function") toast("Профессия: " + pick.name, "success");
    if (typeof gameLog === "function") {
      gameLog("Класс: " + pick.name + " (тир " + pick.tier + ")", "system");
    }
  }
  if (typeof renderAvatarScreen === "function") renderAvatarScreen();
  if (typeof renderAvatarHub === "function") renderAvatarHub();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof renderAvatarSkillsPanel === "function") renderAvatarSkillsPanel();
  if (typeof renderCharacterRoster === "function") renderCharacterRoster();
  return true;
}

function migrateAvatarProfessionFields(next) {
  if (!next || typeof next !== "object") return next;
  if (next.professionId == null) next.professionId = null;
  if (next.professionTier == null || next.professionTier < 0) {
    const p = next.professionId ? professionById(next.professionId) : null;
    next.professionTier = p ? p.tier : 0;
  }
  if (next.professionId && !professionById(next.professionId)) {
    next.professionId = null;
    next.professionTier = 0;
  }
  return next;
}

/** Доминирующий kind экипированной брони (≥2 куска одного kind). */
function avatarEquippedArmorKind() {
  if (typeof iterEquippedGear !== "function" || typeof ARMOR_SETS === "undefined") return null;
  const counts = {};
  let total = 0;
  iterEquippedGear().forEach(({ item }) => {
    if (typeof isArmorItem === "function" && !isArmorItem(item)) return;
    const def = typeof armorItemDef === "function" ? armorItemDef(item) : null;
    if (!def?.setId) return;
    const set = ARMOR_SETS[def.setId];
    const kind = set?.kind;
    if (!kind) return;
    counts[kind] = (counts[kind] || 0) + 1;
    total++;
  });
  if (total < 2) return null;
  let best = null;
  let bestN = 0;
  Object.keys(counts).forEach((k) => {
    if (counts[k] > bestN) {
      bestN = counts[k];
      best = k;
    }
  });
  return bestN >= 2 ? best : null;
}

function avatarArmorAffinityActive(avatar) {
  const pref = professionArmorPref(avatar);
  const worn = avatarEquippedArmorKind();
  return !!(pref && worn && pref === worn);
}

function avatarArmorAffinityMult(avatar) {
  const mult = typeof ARMOR_AFFINITY_MULT === "number" ? ARMOR_AFFINITY_MULT : 1.06;
  return avatarArmorAffinityActive(avatar) ? mult : 1;
}

function armorAffinityHintLine(avatar) {
  const pref = professionArmorPref(avatar);
  const label =
    (typeof ARMOR_KIND_LABELS !== "undefined" && ARMOR_KIND_LABELS[pref]) || pref || "—";
  const lines = [];
  if (avatarArmorAffinityActive(avatar)) {
    const pct = Math.round(((typeof ARMOR_AFFINITY_MULT === "number" ? ARMOR_AFFINITY_MULT : 1.06) - 1) * 100);
    lines.push("Сродство брони («" + label + "»): +" + pct + "% урон/DEF · бонусы арены сета");
  } else {
    const worn = avatarEquippedArmorKind();
    const wornLabel =
      (typeof ARMOR_KIND_LABELS !== "undefined" && worn && ARMOR_KIND_LABELS[worn]) || worn;
    if (worn && worn !== pref) {
      lines.push(
        "Сродство брони: надето «" +
          wornLabel +
          "», нужно «" +
          label +
          "» — DEF ×0.42, без бонусов сета (фарм/арена)"
      );
    } else {
      lines.push("Сродство брони: ≥2 шт. («" + label + "») — урон/DEF и бонусы сета");
    }
  }
  const cats = professionWeaponCats(avatar);
  if (cats.length) {
    const names = cats
      .slice(0, 3)
      .map((c) => (typeof WEAPON_CAT_LABELS !== "undefined" && WEAPON_CAT_LABELS[c]) || c)
      .join("/");
    const w =
      typeof ensureAvatarGear === "function" ? ensureAvatarGear()?.weapon : null;
    const wdef =
      w && typeof WMAP !== "undefined" ? WMAP[w.id] : null;
    const masterOn = wdef && avatarWeaponMasteryActive(wdef, avatar);
    const wpct = Math.round(((typeof WEAPON_MASTERY_MULT === "number" ? WEAPON_MASTERY_MULT : 1.06) - 1) * 100);
    if (masterOn) lines.push("Мастерство оружия (" + names + "…): +" + wpct + "%");
    else lines.push("Мастерство оружия: " + names + (cats.length > 3 ? "…" : ""));
  }
  return lines.join(" · ");
}
