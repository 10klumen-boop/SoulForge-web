// ===== Портреты персонажа (раса × архетип × пол) — assets/portraits/ =====

const AVATAR_PORTRAIT_VER = 7;

const AVATAR_GENDERS = [
  { id: "male", name: "Мужской", desc: "Классический облик расы." },
  { id: "female", name: "Женский", desc: "Классический облик расы." },
];

function isMysticArchetype(classId) {
  return classId === "mystic" || classId === "shaman";
}

function avatarPortraitArchetype(classId) {
  return isMysticArchetype(classId) ? "mystic" : "fighter";
}

function normalizeAvatarGender(genderId) {
  return genderId === "female" ? "female" : "male";
}

function avatarPortraitPath(raceId, genderId, classId) {
  const race = raceId || "human";
  const gender = normalizeAvatarGender(genderId);
  const arch = avatarPortraitArchetype(classId || "fighter");
  return "assets/portraits/" + race + "_" + arch + "_" + gender + ".png?v=" + AVATAR_PORTRAIT_VER;
}

function avatarGenderInfo(genderId) {
  const id = normalizeAvatarGender(genderId);
  return AVATAR_GENDERS.find((g) => g.id === id) || AVATAR_GENDERS[0];
}

function avatarPortraitForAvatar(a) {
  a = a || state.avatar || {};
  if (!a.raceId) return avatarPortraitPath("human", "male", "fighter");
  return avatarPortraitPath(a.raceId, a.genderId, a.classId);
}
