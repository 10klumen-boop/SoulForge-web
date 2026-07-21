// ===== Данные: баланс мастерской (руда, рецепты, иконки) =====
// Вынесено из workshop-core.js; логика осталась в workshop-core.js.

// ===== Мастерская зарядов: магазин руды → крафт → продажа =====
// Soulshot делается из Soul Ore, Spiritshot — из Spirit Ore (иконки с masterwork.wiki).
const ORE = {
  soul:   { name: "Soul Ore",   icon: "icons/etc_crystal_white_i00.png", price: 120 },
  spirit: { name: "Spirit Ore", icon: "icons/etc_stone_gray_i00.png",   price: 120 },
};
const SHOT_TYPE = {
  soul:   { label: "Soulshot",   item: "Soulshot",   ore: "soul" },
  spirit: { label: "Spiritshot", item: "Spiritshot", ore: "spirit" },
};
const SHOT_ICON = {
  soul:   { D: "icons/etc_spirit_bullet_blue_i00.png", C: "icons/etc_spirit_bullet_green_i00.png", B: "icons/etc_spirit_bullet_red_i00.png", A: "icons/etc_spirit_bullet_silver_i00.png" },
  spirit: { D: "icons/etc_spell_shot_blue_i00.png",    C: "icons/etc_spell_shot_green_i00.png",    B: "icons/etc_spell_shot_red_i00.png",    A: "icons/etc_spell_shot_silver_i00.png" },
};
const GRADE_TAG = { D: "#5fb8ff", C: "#5fcf6b", B: "#ff5a5a", A: "#cfd6e6" };
const SHOT_BATCH = 1000; // зарядов за один крафт
// Реальная математика крафта сосок из калькулятора MasterWork (DWARF DEFENDERS):
// соски делаются из КРИСТАЛЛОВ своего грейда + Soul/Spirit Ore (без платы за крафт).
// cry/ore — на партию 1000 шт; sell — цена продажи 1 заряда (адена). Плата за крафт не берётся.
// sell подобран так, чтобы крафт→продажа давал ~45–65% маржи от стоимости кристаллов+руды.
const SHOT_RECIPE = {
  D: { cry: 6,  ore: 18,  sell: 4 },
  C: { cry: 8,  ore: 28,  sell: 8 },
  B: { cry: 12, ore: 110, sell: 32 },
  A: { cry: 16, ore: 130, sell: 72 },
};
const GRADES4 = ["D", "C", "B", "A"];
