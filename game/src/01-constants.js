const CATEGORIES = window.CATEGORIES || [];
const WEAPONS = window.WEAPONS || [];
/** Версия клиента — патчноут, главное меню, cloud API */
const GAME_VERSION = "0.36d";
/** Кэш фона главного меню (assets/ui/home_bg.png) */
const HOME_BG_VER = 1;
const WMAP = {}; WEAPONS.forEach((w) => { WMAP[w.id] = w; });
function uid() { return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function starterInventory() { return []; }

// Свитки заточки оружия по грейдам (иконки/данные — masterwork.wiki, lu4).
// Грейдовые иконки обычного свитка: D=i01, C=i02, B=i03, A=i04.
const SCROLL_ICON = {
  D: "icons/etc_scroll_of_enchant_weapon_i01.png",
  C: "icons/etc_scroll_of_enchant_weapon_i02.png",
  B: "icons/etc_scroll_of_enchant_weapon_i03.png",
  A: "icons/etc_scroll_of_enchant_weapon_i04.png",
};
const BLESSED_ICON = {
  D: "icons/etc_blessed_scrl_of_ench_wp_d_i01.png",
  C: "icons/etc_blessed_scrl_of_ench_wp_c_i02.png",
  B: "icons/etc_blessed_scrl_of_ench_wp_b_i03.png",
  A: "icons/etc_blessed_scrl_of_ench_wp_a_i04.png",
};
// базовая цена обычного свитка по грейду (adena)
const GRADE_BASE_PRICE = { D: 50_000, C: 280_000, B: 1_100_000, A: 4_500_000 };
// типы свитков: множитель цены и поведение при провале
const SCROLL_TYPES = [
  { id:"regular", name:"Свиток заточки",        mult:1,  behavior:"break",     desc:"Провал на +3 и выше — оружие рассыпается в кристаллы" },
  { id:"blessed", name:"Благословенный свиток",  mult:4,  behavior:"reset",     desc:"Провал — заточка сбрасывается до +0, оружие цело" },
  { id:"crystal", name:"Кристальный свиток",     mult:60, behavior:"guarantee", desc:"100% успех на любом уровне, но очень дорого" },
];
const SAFE_LEVEL = 3;
const START_ADENA_BASE = 25_000;
/** Множитель adena-дохода. 1 = релизный баланс (без плейтест-наценки). */
const PLAYTEST_INCOME_MULT = 1;
/** Одноразовая миграция: wipe экономики/ачивок при load старых сейвов. */
const BALANCE_RESET_VER = 1;

function playtestIncome(amount) {
  const n = Number(amount) || 0;
  if (!PLAYTEST_INCOME_MULT || PLAYTEST_INCOME_MULT === 1) return Math.round(n);
  return Math.round(n * PLAYTEST_INCOME_MULT);
}

const START_ADENA = playtestIncome(START_ADENA_BASE);
const GRADE_MULT = { A: 2.0, B: 1.5, C: 1.15, D: 0.85 };

// Экспорт/импорт .sfsave — отключено (дюп). Включать только для отладки.
const FEATURE_SAVE_TRANSFER = false;

// Dev-панель (Ctrl+Shift+D) — в релизной сборке pack-game.js выставляет false.
const FEATURE_DEV_PANEL = false;

const INV_CAP = 120;

