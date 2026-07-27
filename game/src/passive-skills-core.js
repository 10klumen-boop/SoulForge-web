// ===== Пассивные умения: core (каталог PASSIVE_SKILLS + grants) =====
// UI-термин: «пассивные умения». Боевые активные — отдельно (COMBAT_SKILLS).

function passiveSkillById(id) {
  if (!id || typeof PASSIVE_SKILLS === "undefined" || !PASSIVE_SKILLS) return null;
  return PASSIVE_SKILLS[id] || null;
}

/** Категория оружия → id пассивки мастерства (из class-skills). */
const WEAPON_MASTERY_PASSIVE_BY_CAT = {
  Sword: "weapon_mastery_sword",
  MagicalSword: "weapon_mastery_magical_sword",
  TwoHandSword: "weapon_mastery_twohand_sword",
  Blunt: "weapon_mastery_blunt",
  Dualblunt: "weapon_mastery_blunt",
  Dualsword: "weapon_mastery_dualsword",
  Polearm: "weapon_mastery_polearm",
  Dagger: "weapon_mastery_dagger",
  Dualdagger: "weapon_mastery_dualdagger",
  Bow: "weapon_mastery_bow",
  Fist: "weapon_mastery_fist",
};

/** Стартовые классовые пассивки «новичка» — скрываются после 1-й профессии. */
const STARTER_CLASS_PASSIVE_IDS = {
  fighter_blade: true,
  fighter_guard: true,
  mystic_focus: true,
  mystic_veil: true,
  shaman_totem: true,
  shaman_blood: true,
};

function weaponMasteryPassiveIdsForAvatar(avatar) {
  const a = avatar || {};
  if (!a.professionId || typeof professionWeaponCats !== "function") return [];
  const cats = professionWeaponCats(a) || [];
  if (!cats.length) return [];
  const role = typeof combatRole === "function" ? combatRole(a) : null;
  const cid = typeof starterClassId === "function" ? starterClassId(a) : a.classId;
  const mageLike = cid === "mystic" || role === "mage" || role === "support";
  const out = [];
  const seen = Object.create(null);
  cats.forEach((cat) => {
    let key = cat;
    if (cat === "Sword" && mageLike) key = "MagicalSword";
    const id = WEAPON_MASTERY_PASSIVE_BY_CAT[key] || WEAPON_MASTERY_PASSIVE_BY_CAT[cat];
    if (id && !seen[id]) {
      seen[id] = true;
      out.push(id);
    }
  });
  return out;
}

function passiveSkillIdsGrantedToAvatar(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  const ids = [];
  const raceMap = typeof RACE_PASSIVE_SKILL_IDS !== "undefined" ? RACE_PASSIVE_SKILL_IDS : null;
  const raceIds = raceMap && a.raceId ? raceMap[a.raceId] : null;
  if (Array.isArray(raceIds)) ids.push(...raceIds);
  const classMap = typeof CLASS_PASSIVE_SKILL_IDS !== "undefined" ? CLASS_PASSIVE_SKILL_IDS : null;
  const classIds = classMap && a.classId ? classMap[a.classId] : null;
  const hasProfession = !!a.professionId;
  if (Array.isArray(classIds)) {
    const armorPref =
      typeof professionArmorPref === "function" ? professionArmorPref(a) : null;
    classIds.forEach((id) => {
      // После 1-й профессии «новичок» уходит — остаётся броня + мастерство + пассивка профы
      if (hasProfession && STARTER_CLASS_PASSIVE_IDS[id]) return;
      // Воин: heavy → «Тяжёлая», light (разбойник/стрелок/craft) → «Лёгкая»
      if (id === "fighter_heavy_armor" || id === "fighter_light_armor") {
        ids.push(armorPref === "light" ? "fighter_light_armor" : "fighter_heavy_armor");
        return;
      }
      // Мастерство оружия: у профессии — по категориям из планировщика
      if (
        id === "fighter_weapon_mastery" ||
        id === "mystic_weapon_mastery" ||
        id === "shaman_weapon_mastery"
      ) {
        const specific = weaponMasteryPassiveIdsForAvatar(a);
        if (specific.length) {
          ids.push(...specific);
        } else {
          ids.push(id);
        }
        return;
      }
      ids.push(id);
    });
  }
  // Текущая профессия (2nd заменяет пассивы 1st — только leaf)
  if (typeof professionPassiveIds === "function") {
    const profIds = professionPassiveIds(a);
    if (Array.isArray(profIds)) ids.push(...profIds);
  }
  return ids;
}

/** Подпись эффекта пассивки только в % / плоских бонусах (без ×1.05). */
function formatPassiveEffectPct(e) {
  if (!e || !e.type) return "";
  const t = e.type;
  const v = Number(e.value);
  if (!Number.isFinite(v)) return "";
  const labels = {
    farmAdenaMult: "адена с фарма",
    normalAdenaMult: "адена с обычных",
    goldenAdenaMult: "адена с золотых",
    offlineIncomeMult: "оффлайн/склад",
    mineXpMult: "XP",
    farmDamageMult: "урон охоты",
    materialsMult: "материалы",
    arrowCostMult: "расход стрел",
    skillCdMult: "КД скиллов",
    buffDurationAdd: "длительность баффов",
    pvpDefMult: "DEF арены",
    pvpAtkMult: "ATK арены",
    pvpHpAdd: "HP арены",
    farmBonus: "мощь фарма",
    matkAdd: "MATK",
    enchantChanceAdd: "шанс заточки",
    zoneRaceBonusFloor: "мин. расовый бонус зоны",
  };
  const lab = labels[t] || t;
  if (t === "buffDurationAdd") {
    const sec = Math.round(v / 100) / 10;
    return lab + " +" + sec + " с";
  }
  if (t === "farmBonus" || t === "matkAdd" || t === "pvpHpAdd") {
    return lab + " +" + v;
  }
  if (t === "enchantChanceAdd") {
    const pp = Math.round(v * 1000) / 10;
    return lab + " +" + pp + " п.п.";
  }
  if (t === "zoneRaceBonusFloor") {
    return lab + " +" + Math.round(v * 100) + "%";
  }
  // Мультипликаторы → проценты
  const pct = Math.round((v - 1) * 1000) / 10;
  if (pct > 0) return lab + " +" + pct + "%";
  if (pct < 0) return lab + " " + pct + "%";
  return "";
}

/** ×1.06 / ×0.92 в текстах → +6% / −8%. */
function convertMultiplierTextToPct(text) {
  if (!text) return "";
  return String(text)
    .replace(/\bМультипликаторы:\s*/gi, "")
    .replace(/×\s*(\d+[.,]\d+|\d+)/g, (_, raw) => {
      const n = parseFloat(String(raw).replace(",", "."));
      if (!Number.isFinite(n) || n === 1) return "";
      const pct = Math.round((n - 1) * 1000) / 10;
      if (pct > 0) return "+" + pct + "%";
      return String(pct).replace("-", "−") + "%";
    })
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+\./g, ".")
    .trim();
}

/** Строка описания пассивки для UI: только %, без множителей. */
function passiveSkillGameplayLine(skill) {
  if (!skill) return "";
  if (skill.gameplay) {
    const converted = convertMultiplierTextToPct(skill.gameplay);
    if (converted) return converted;
  }
  const parts = (skill.effects || []).map(formatPassiveEffectPct).filter(Boolean);
  return parts.length ? parts.join(" · ") + "." : "";
}

function passiveSkillsForAvatar(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  const lvl = Math.max(1, a.level || 1);
  return passiveSkillIdsGrantedToAvatar(a)
    .map(passiveSkillById)
    .filter((s) => s && (s.unlockLevel || 1) <= lvl);
}

function passiveSkillsRacialForRace(raceId, level) {
  const lvl = level != null ? level : 1;
  const raceMap = typeof RACE_PASSIVE_SKILL_IDS !== "undefined" ? RACE_PASSIVE_SKILL_IDS : null;
  const ids = (raceMap && raceMap[raceId]) || [];
  return ids
    .map(passiveSkillById)
    .filter((s) => s && (s.unlockLevel || 1) <= lvl);
}

/** Сумма аддитивных эффектов (farmBonus, enchantChanceAdd, matkAdd, zoneRaceBonusFloor). */
function passiveEffectSum(type, avatarOrRaceId, level) {
  let skills;
  if (typeof avatarOrRaceId === "string") {
    skills = passiveSkillsRacialForRace(avatarOrRaceId, level);
  } else {
    skills = passiveSkillsForAvatar(avatarOrRaceId);
  }
  let sum = 0;
  skills.forEach((s) => {
    (s.effects || []).forEach((e) => {
      if (e.type === type) sum += Number(e.value) || 0;
    });
  });
  return sum;
}

/** Произведение мультипликаторов (farmAdenaMult, mineXpMult, …). */
function passiveEffectMult(type, avatarOrRaceId, level) {
  let skills;
  if (typeof avatarOrRaceId === "string") {
    skills = passiveSkillsRacialForRace(avatarOrRaceId, level);
  } else {
    skills = passiveSkillsForAvatar(avatarOrRaceId);
  }
  let mult = 1;
  skills.forEach((s) => {
    (s.effects || []).forEach((e) => {
      if (e.type === type) mult *= Number(e.value) || 1;
    });
  });
  return mult;
}

/** @deprecated совместимость со старым API */
function racialEffectSum(type, raceId, level) {
  return passiveEffectSum(type, raceId, level);
}
function racialEffectMult(type, raceId, level) {
  return passiveEffectMult(type, raceId, level);
}
function racialPassiveDescLines(raceId, level) {
  return passiveSkillsRacialForRace(raceId, level).map((s) => s.blurb || s.desc).filter(Boolean);
}
