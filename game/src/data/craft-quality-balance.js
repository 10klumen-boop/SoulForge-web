// ===== Rare craft: шанс и пулы стат-ролла на экземпляре =====
// Common — без craftOpt. Rare — один ключ из пула kind.

const CRAFT_RARE_CHANCE = 0.005;

/**
 * Пулы опций. value — целое, кроме skillCdMult / debuffResist / armorSustain (доля).
 * weight — относительный вес внутри kind.
 */
const CRAFT_OPT_POOLS = {
  armor: [
    { key: "pdef", weight: 34, min: 4, max: 8 },
    { key: "mdef", weight: 34, min: 3, max: 6 },
    { key: "pvpHp", weight: 20, min: 12, max: 28 },
    { key: "armorSustain", weight: 12, min: 0.003, max: 0.006 },
  ],
  jewelry: [
    { key: "mdef", weight: 40, min: 2, max: 5 },
    { key: "skillCdMult", weight: 30, min: 0.985, max: 0.99 },
    { key: "debuffResist", weight: 30, min: 0.005, max: 0.01 },
  ],
};

function _craftOptRand(rng) {
  return typeof rng === "function" ? rng() : Math.random();
}

function _craftOptPickWeighted(pool, rng) {
  let total = 0;
  for (let i = 0; i < pool.length; i++) total += Math.max(0, Number(pool[i].weight) || 0);
  if (!(total > 0)) return pool[0] || null;
  let r = _craftOptRand(rng) * total;
  for (let i = 0; i < pool.length; i++) {
    r -= Math.max(0, Number(pool[i].weight) || 0);
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function _craftOptRollValue(entry, rng) {
  const min = Number(entry.min);
  const max = Number(entry.max);
  if (!(max >= min)) return min;
  const key = entry.key;
  if (key === "skillCdMult" || key === "debuffResist" || key === "armorSustain") {
    const t = _craftOptRand(rng);
    const raw = min + (max - min) * t;
    return Math.round(raw * 1000) / 1000;
  }
  const lo = Math.floor(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  return lo + Math.floor(_craftOptRand(rng) * (hi - lo + 1));
}

/**
 * @param {"armor"|"jewelry"} kind
 * @param {function(): number} [rng] — stub for tests (0..1)
 * @returns {{ key: string, value: number, rarity: "rare" }|null}
 */
function rollCraftOpt(kind, rng) {
  if (_craftOptRand(rng) >= CRAFT_RARE_CHANCE) return null;
  const pool = CRAFT_OPT_POOLS[kind];
  if (!pool || !pool.length) return null;
  const entry = _craftOptPickWeighted(pool, rng);
  if (!entry) return null;
  return {
    key: entry.key,
    value: _craftOptRollValue(entry, rng),
    rarity: "rare",
  };
}

function formatCraftOpt(opt) {
  if (!opt || !opt.key) return "";
  const k = opt.key;
  const v = opt.value;
  if (k === "pdef") return "+" + v + " P.Def";
  if (k === "mdef") return "+" + v + " M.Def";
  if (k === "pvpHp") return "+" + v + " HP арены";
  if (k === "armorSustain") return "Sustain +" + Math.round(v * 1000) / 10 + "%";
  if (k === "skillCdMult" && v < 1) {
    return "КД скиллов −" + Math.round((1 - v) * 1000) / 10 + "%";
  }
  if (k === "debuffResist") return "Резист дебаффов +" + Math.round(v * 1000) / 10 + "%";
  return k + " " + v;
}

/** Сумма craftOpt по экипу (armor | jewelry | all). */
function sumEquippedCraftOpt(key, kindFilter) {
  let sum = 0;
  let mult = 1;
  let useMult = key === "skillCdMult";
  if (typeof iterEquippedGear !== "function") return useMult ? 1 : 0;
  iterEquippedGear().forEach(({ item }) => {
    if (!item || !item.craftOpt || item.craftOpt.key !== key) return;
    const isArmor = item.kind === "armor" || (typeof isArmorItem === "function" && isArmorItem(item));
    const isAcc =
      item.kind === "accessory" ||
      (typeof isAccessoryItem === "function" && isAccessoryItem(item));
    if (kindFilter === "armor" && !isArmor) return;
    if (kindFilter === "jewelry" && !isAcc) return;
    const v = Number(item.craftOpt.value);
    if (!(v > 0) && !(useMult && v > 0 && v < 1)) return;
    if (useMult) mult *= v;
    else sum += v;
  });
  return useMult ? mult : sum;
}
