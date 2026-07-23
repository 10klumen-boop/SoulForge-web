// ===== Пассивные умения: core (каталог PASSIVE_SKILLS + grants) =====
// UI-термин: «пассивные умения». Боевые активные — отдельно (COMBAT_SKILLS).

function passiveSkillById(id) {
  if (!id || typeof PASSIVE_SKILLS === "undefined" || !PASSIVE_SKILLS) return null;
  return PASSIVE_SKILLS[id] || null;
}

function passiveSkillIdsGrantedToAvatar(avatar) {
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null) || {};
  const ids = [];
  const raceMap = typeof RACE_PASSIVE_SKILL_IDS !== "undefined" ? RACE_PASSIVE_SKILL_IDS : null;
  const raceIds = raceMap && a.raceId ? raceMap[a.raceId] : null;
  if (Array.isArray(raceIds)) ids.push(...raceIds);
  const classMap = typeof CLASS_PASSIVE_SKILL_IDS !== "undefined" ? CLASS_PASSIVE_SKILL_IDS : null;
  const classIds = classMap && a.classId ? classMap[a.classId] : null;
  if (Array.isArray(classIds)) ids.push(...classIds);
  return ids;
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
