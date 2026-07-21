// ===== Данные: расы, классы, архетипы персонажа =====
// Вынесено из 22-avatar.js, чтобы добавлять расы/классы без правки логики создания.

const L2_RACE_ICONS = UI_RACE_ICONS;
const L2_ARCHETYPE_ICONS = UI_ARCHETYPE_ICONS;

const L2_CLASSES = {
  fighter: {
    id: "fighter",
    name: "Воин",
    desc: "Путь стали и заточки. С 9 уровня — бонус к рисковой заточке.",
    icon: UI_CLASS_ICONS.fighter,
  },
  mystic: {
    id: "mystic",
    name: "Мистик",
    desc: "Путь свитков и души клинка. Бонус к заточке с 10 уровня.",
    icon: UI_CLASS_ICONS.mystic,
  },
  shaman: {
    id: "shaman",
    name: "Шаман",
    desc: "Голос Паагрио и духов предков. Бонус к заточке с 10 уровня.",
    icon: UI_CLASS_ICONS.shaman,
  },
};

/** Классическая схема стартовых рас (Interlude). */
const L2_RACES = [
  {
    id: "human",
    name: "Люди",
    desc: "Универсалы Адена. Доступны воин и мистик.",
    icon: L2_RACE_ICONS.human,
  },
  {
    id: "elf",
    name: "Эльфы",
    desc: "Быстрые и точные. Воин или мистик.",
    icon: L2_RACE_ICONS.elf,
  },
  {
    id: "dark_elf",
    name: "Тёмные эльфы",
    desc: "Дети Шилен. Воин или мистик.",
    icon: L2_RACE_ICONS.dark_elf,
  },
  {
    id: "orc",
    name: "Орки",
    desc: "Сила Паагрио. Воин или шаман.",
    icon: L2_RACE_ICONS.orc,
  },
  {
    id: "dwarf",
    name: "Гномы",
    desc: "Ремесло и шахта. Только путь воина.",
    icon: L2_RACE_ICONS.dwarf,
  },
];

const L2_RACE_CLASSES = {
  human: ["fighter", "mystic"],
  elf: ["fighter", "mystic"],
  dark_elf: ["fighter", "mystic"],
  orc: ["fighter", "shaman"],
  dwarf: ["fighter"],
};
