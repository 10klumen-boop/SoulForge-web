// ===== Данные: баланс и визуальные константы шахты =====
// Вынесено из mine-core.js, чтобы настраивать баланс задания без правки логики.

const BANAN_IMG = "assets/dwarves/banan_rare.png";
const BANAN_HITS = 10;
const BANAN_TIME_MS = 9000;
const ZAKEN_EARRING_ID = "zaken_blessed_earring";

/** Базовый дроп adena с обычного / золотого моба (до прогресс-скейла и avatarMineRewardMult).
 *  Калибровка P1: при автоклике ~1700 киллов/час и mult≈0.86 → ~150k adena/час на гл.I. */
const MINE_ADENA_REWARD = { min: 55, max: 110 };
const MINE_ADENA_GOLDEN = { min: 340, max: 680 };

/** Шанс золотого моба (единый по всем главам). */
const MINE_GOLDEN_CHANCE = 0.05; // 5%

/** Редкий гном (Банан): спавн 0.05%, лут без сосок. */
const MINE_BANAN_CHANCE = 0.0005; // 0.05%
const BANAN_ADENA_REWARD = 500_000_000; // 500кк
/** Веса лута на 100: adena / оружие +6 / серьга ЗакАна (соски убраны). */
const BANAN_LOOT_WEIGHTS = { adena: 90, weapon: 9.5, earring: 0.5 };

const MINE_LOOT_GRADE_RANK = { epic: 5, A: 4, B: 3, C: 2, D: 1, NG: 0 };

const MINE_BGS = ["assets/mine_bg.png", "assets/mine_bg2.jpg", "assets/mine_bg3.png"];

const DWARF_IMGS = [
  "heavy_chainmail", "heavy_composite", "heavy_dwarvenchain",
  "light_drakeleather", "light_mithril", "light_platedleather", "light_rindleather",
  "light_theca", "robe_demon", "robe_divine", "robe_karmian",
  "w_heavy_chainmail", "w_heavy_composite", "w_heavy_dwarvenchain",
  "w_light_drakeleather", "w_light_mithril", "w_light_platedleather", "w_light_rindleather",
  "w_light_theca", "w_robe_demon", "w_robe_divine",
].map((n) => "assets/dwarves/" + n + ".jpg");

const DWARF_GOLDS = ["heavy_fullplate", "w_heavy_fullplate"].map((n) => "assets/dwarves/" + n + ".jpg");
