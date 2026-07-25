// ===== Портреты персонажа (раса × архетип × пол) — assets/portraits/ =====
// Сеты: assets/portraits/sets/{IvoryFolder}_{gender}_{setId}.png (ivory-tower.de)

const AVATAR_PORTRAIT_VER = 11;
const AVATAR_SET_PORTRAIT_VER = 1;

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

/** Папка ivory-tower.de для расы/класса (без Gender). */
function avatarIvoryFolder(raceId, classId) {
  const race = raceId || "human";
  const mystic = isMysticArchetype(classId || "fighter");
  if (race === "human") return mystic ? "HumanMage" : "HumanFighter";
  if (race === "elf") return "Elf";
  if (race === "dark_elf") return "Darkelf";
  if (race === "orc") return mystic ? "OrcMage" : "OrcFighter";
  if (race === "dwarf") return "Dwarf";
  return "HumanFighter";
}

function avatarPortraitPath(raceId, genderId, classId) {
  const race = raceId || "human";
  const gender = normalizeAvatarGender(genderId);
  const arch = avatarPortraitArchetype(classId || "fighter");
  return "assets/portraits/" + race + "_" + arch + "_" + gender + ".png?v=" + AVATAR_PORTRAIT_VER;
}

/** Локальный портрет в сете (после fetch_set_portraits.py). */
function avatarSetPortraitPath(raceId, genderId, classId, setId) {
  if (!setId || typeof AVATAR_SET_IVORY === "undefined" || !AVATAR_SET_IVORY[setId]) return "";
  const folder = avatarIvoryFolder(raceId, classId);
  const gender = normalizeAvatarGender(genderId);
  return (
    "assets/portraits/sets/" +
    folder +
    "_" +
    gender +
    "_" +
    setId +
    ".png?v=" +
    AVATAR_SET_PORTRAIT_VER
  );
}

function avatarGenderInfo(genderId) {
  const id = normalizeAvatarGender(genderId);
  return AVATAR_GENDERS.find((g) => g.id === id) || AVATAR_GENDERS[0];
}

/** Портрет: при ≥2 кусках одного сета — рендер сета с ivory, иначе базовый. */
function avatarPortraitForAvatar(a) {
  a = a || state.avatar || {};
  if (!a.raceId) return avatarPortraitPath("human", "male", "fighter");
  const min =
    typeof AVATAR_SET_PORTRAIT_MIN_PIECES === "number" ? AVATAR_SET_PORTRAIT_MIN_PIECES : 2;
  if (typeof avatarDominantEquippedSet === "function") {
    const set = avatarDominantEquippedSet();
    if (set && set.pieces >= min) {
      const setPath = avatarSetPortraitPath(a.raceId, a.genderId, a.classId, set.id);
      if (setPath) return setPath;
    }
  }
  return avatarPortraitPath(a.raceId, a.genderId, a.classId);
}

function bindAvatarPortraitFallback(imgEl) {
  if (!imgEl || imgEl.dataset.setFallbackBound === "1") return;
  imgEl.dataset.setFallbackBound = "1";
  imgEl.addEventListener("error", () => {
    const a = state.avatar || {};
    const base = avatarPortraitPath(a.raceId, a.genderId, a.classId);
    if (imgEl.getAttribute("src") !== base) imgEl.src = base;
  });
}
