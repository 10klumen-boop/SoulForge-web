// ===== Экономика: базовые константы (devTune может переопределять в рантайме) =====
// Цикл: шахта → заточка/продажа → мастерская (кристаллы + руда → заряды).
// Золотой гном: небольшой бонус adena + дроп оружия (основная ценность). Ачивки — доп. буст.
function statAt(base, step, plus) { return base + step * plus; }
function successChance(plus, behavior) {
  if (behavior === "guarantee") return 1;
  const safe = safeLevel();
  if (plus < safe) return 1;
  const base = tune("ench.chanceBase", 0.72);
  const step = tune("ench.chanceStep", 0.048);
  const min = tune("ench.chanceMin", 0.12);
  let ch = Math.max(min, base - (plus - safe) * step);
  if (typeof avatarEnchantBonus === "function") ch = Math.min(1, ch + avatarEnchantBonus(plus, behavior));
  if (typeof avatarGearEnchantBonus === "function") ch = Math.min(1, ch + avatarGearEnchantBonus(plus, behavior));
  return ch;
}
// Свечение: +4..+15 — синее (от бледного к яркому), +16 — красное.
function glowInfo(plus) {
  if (plus >= MAX_PLUS) return { color: "#ff5a5a", op: 0.92, blur: 46 };
  if (plus >= 4) { const t = (plus - 4) / (MAX_PLUS - 1 - 4); return { color: "#5fa8ff", op: 0.16 + t * 0.6, blur: 6 + t * 34 }; }
  return { color: "#5fa8ff", op: 0, blur: 3 };
}
// Базовая рыночная цена оружия по грейду; цена резко растёт с заточкой.
// Продажа доступна только выше безопасной зоны (с +4), иначе был бы «принтер денег».
const GRADE_VALUE = { D: 55_000, C: 280_000, B: 1_200_000, A: 5_000_000 };
function canSell(plus) { return plus > safeLevel(); }
function sellValue(w, plus) {
  const base = tune("weapon.sell." + w.grade, GRADE_VALUE[w.grade] || 55_000);
  const pow = tune("ench.sellPow", 1.25);
  return playtestIncome(Math.round(base * Math.pow(pow, plus)));
}
// Кристаллы, выпадающие при разрушении оружия (иконки и цвета — с masterwork.wiki)
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
// Базовое число кристаллов (w.cc) растёт с заточкой — ~+10% за каждый +1.
const CRYSTAL_PLUS_MULT = 1.10;

function crystalBase(weapon) {
  if (weapon && weapon.cc) return weapon.cc;
  return { D: 50, C: 150, B: 400, A: 900 }[weapon && weapon.grade] || 50;
}

function crystalYield(weapon, plus) {
  const base = crystalBase(weapon);
  const p = Math.max(0, plus | 0);
  const mult = tune("ench.crystalPlusMult", CRYSTAL_PLUS_MULT);
  if (p <= 0) return base;
  return Math.max(1, Math.round(base * Math.pow(mult, p)));
}
function crystalUnitValue(grade) {
  return playtestIncome(tune("crystal.value." + grade, CRYSTAL_VALUE[grade] || 50));
}
function crystalsTotalValue() {
  let t = 0; ["D", "C", "B", "A"].forEach((g) => { t += (state.crystals[g] || 0) * crystalUnitValue(g); });
  return t;
}

const ADENA_ICON = "icons/etc_adena_i00.png";
const FUNPAY_ICON = "icons/etc_pig_coin_i00.png";
const FUNPAY_WIPE_CHANCE = 0.5;
const FUNPAY_REWARD = 2_500_000;

function tune(key, fallback) {
  if (fallback === undefined && typeof TUNE_DEFAULTS !== "undefined") fallback = TUNE_DEFAULTS[key];
  const v = state && state.devTune ? state.devTune[key] : undefined;
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tuneInt(key, fallback) {
  return Math.round(tune(key, fallback));
}

function safeLevel() { return tuneInt("ench.safeLevel", SAFE_LEVEL); }

function funpayWipeChance() {
  return tune("funpay.wipeChance", FUNPAY_WIPE_CHANCE);
}

function funpayReward() {
  return tuneInt("funpay.reward", FUNPAY_REWARD);
}

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

function migrateCollectibles() {
  if (!state.collectibles) return;
  if (state.collectibles.zaken_earring) {
    state.collectibles.zaken_blessed_earring = (state.collectibles.zaken_blessed_earring || 0) + state.collectibles.zaken_earring;
    delete state.collectibles.zaken_earring;
  }
}

function weaponRecord(weaponId) {
  if (!state.records) state.records = {};
  return state.records[weaponId] || 0;
}

function bumpWeaponRecord(weaponId, plus) {
  if (!state.records) state.records = {};
  const p = Math.max(0, plus | 0);
  if (p <= (state.records[weaponId] || 0)) return false;
  state.records[weaponId] = p;
  return true;
}
