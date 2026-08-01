// ===== Учебный набор Эйры (одноразово на персонажа) =====

const MENTOR_PRACTICE_KIT = {
  /** Дешёвое D-оружие: воин / мистик */
  weaponPhysicalId: "doom_hammer_182",
  weaponMagicalId: "staff_of_magic_186",
  /** Ровно 4: +1/+2/+3 успех, на 4-й попытке (+3→+4) скриптовый слом */
  scrolls: { target: "weapon", typeId: "regular", grade: "D", qty: 4 },
  /** Хватит на 4 попытки заточки D */
  adena: 300_000,
  oreSoul: 40,
  oreSpirit: 40,
  /**
   * Кристаллы на шоты — из поломки учебного клинка (не выдаём пачкой).
   * mentorEnsureShotCraftCrystals — страховка, если слома не было.
   */
  crystalsD: 0,
  /** При обучении: успех пока plus < breakAtPlus, на breakAtPlus — всегда слом */
  scriptBreakAtPlus: 3,
};

function mentorPracticeWeaponId() {
  const mystic =
    typeof isMysticArchetype === "function" &&
    isMysticArchetype(state.avatar?.classId);
  return mystic
    ? MENTOR_PRACTICE_KIT.weaponMagicalId
    : MENTOR_PRACTICE_KIT.weaponPhysicalId;
}
