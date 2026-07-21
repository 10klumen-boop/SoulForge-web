// ===== Данные: баланс заточки, экономики, кристаллов, аксессуаров =====
// Вынесено из 06-rules.js, чтобы настраивать баланс без правки логики.

const WEAPON_AFFINITY_OFF_MULT = 0.42;
const WEAPON_AFFINITY_HYBRID_MULT = 0.78;

// База продажи оружия: ×2 к прежнему уровню (успешная заточка заметно прибыльнее свитков).
const GRADE_VALUE = { D: 220_000, C: 1_240_000, B: 4_900_000, A: 20_000_000 };
const NG_WEAPON_SELL = 1000;

const CRYSTAL_VALUE = { D: 45, C: 200, B: 650, A: 2_100 };
const CRYSTAL_COLOR = { D: "#5fb8ff", C: "#5fcf6b", B: "#ff3b3b", A: "#cfd6e6" };
const CRYSTAL_ICON = {
  D: "icons/etc_crystal_blue_i00.png",
  C: "icons/etc_crystal_green_i00.png",
  B: "icons/etc_crystal_red_i00.png",
  A: "icons/etc_crystal_silver_i00.png",
};
const CRYSTALLIZE_ICON = {
  normal: "assets/ui/inventory_recipe.png?v=10",
  over: "assets/ui/inventory_recipe_over.png?v=10",
  drag: "assets/ui/inventory_recipe_drag.png?v=10",
};
const CRYSTAL_PLUS_MULT = 1.10;

const ADENA_ICON = "icons/etc_adena_i00.png";
const FUNPAY_ICON = "icons/etc_pig_coin_i00.png";
const FUNPAY_WIPE_CHANCE = 0.5;
const FUNPAY_REWARD = 2_500_000;

const COLLECTIBLES = {
  zaken_blessed_earring: {
    id: "zaken_blessed_earring",
    name: "Благословенная серьга ЗакАна",
    icon: "icons/accessory_blessed_earring_of_zaken_i00.png",
    epic: true,
    slot: "earring",
    desc: "Эпическая серьга. На персонаже: +0.25% к шансу заточки с +4.",
    bonuses: { enchant: 0.0025, mdef: 4 },
  },
  baium_ring: {
    id: "baium_ring",
    name: "Кольцо Баюма",
    icon: "icons/accessory_ring_of_baium_i00.png",
    epic: true,
    slot: "ring",
    desc: "Эпическое кольцо. На персонаже: +0.15% к заточке, +8% adena в шахте.",
    bonuses: { enchant: 0.0015, mineAdena: 0.08, patk: 6 },
  },
  antharas_earring: {
    id: "antharas_earring",
    name: "Серьга Антараса",
    icon: "icons/accessory_earring_of_antaras_i00.png",
    epic: true,
    slot: "earring",
    desc: "Эпическая серьга. На персонаже: +0.35% к шансу заточки с +4.",
    bonuses: { enchant: 0.0035, matk: 8 },
  },
  valakas_necklace: {
    id: "valakas_necklace",
    name: "Ожерелье Валакаса",
    icon: "icons/accessory_necklace_of_valakas_i00.png",
    epic: true,
    slot: "necklace",
    desc: "Эпическое ожерелье. На персонаже: +0.2% к заточке, +12% опыта души.",
    bonuses: { enchant: 0.002, avatarXp: 0.12, pdef: 5, mdef: 5 },
  },
};
