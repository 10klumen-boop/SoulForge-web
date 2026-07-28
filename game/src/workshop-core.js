// ===== Мастерская: core logic (руда, крафт, заряды, автозаряды) =====
// Вынесено из 07-workshop.js; UI осталось в 07-workshop.js.
// ORE, SHOT_TYPE, SHOT_ICON, GRADE_TAG, SHOT_BATCH, SHOT_RECIPE, GRADES4
// вынесены в data/workshop-balance.js.

let wsTab = "soul";
/** null = хаб (две кнопки), shots | armor | jewelry = раздел */
let wsMainTab = null;
/** null = хаб подвидов (heavy/light/robe); иначе id из ARMOR_KINDS */
let wsArmorKind = null;
/** null = список сетов выбранного подвида; иначе id сета из ARMOR_SETS */
let wsArmorSetId = null;
/** null | "graded" | "epic" — подраздел бижутерии */
let wsJewelryTab = null;
let wsJewelrySetId = null;


function orePrice(type) {
  return tuneInt("ore.price." + type, ORE[type].price);
}

function shotBatchSize() {
  return tuneInt("shot.batch", SHOT_BATCH);
}

function shotRecipeVal(grade, field) {
  const key = "shot." + grade + "." + field;
  const base = tuneInt(key, SHOT_RECIPE[grade][field]);
  return field === "sell" ? playtestIncome(base) : base;
}

function ensureWorkshopState() {
  if (!state.materials) ProgressStore.set("materials", { soul: 0, spirit: 0 });
  if (!state.shots) ProgressStore.set("shots", { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } });
  if (state.autoShots == null) ProgressStore.set("autoShots", true);
}

/** Soulshot для воинов, Spiritshot для мистиков — грейд экипированного оружия. */
function mineShotKind() {
  const classId = state.avatar?.classId;
  const mystic = typeof isMysticArchetype === "function" && isMysticArchetype(classId);
  return mystic ? "spirit" : "soul";
}

function mineShotGrade() {
  const eq = typeof equippedWeaponItem === "function" ? equippedWeaponItem() : null;
  const w = eq && typeof WMAP !== "undefined" ? WMAP[eq.id] : null;
  return w?.grade || "D";
}

function mineShotStock() {
  ensureWorkshopState();
  const kind = mineShotKind();
  const grade = mineShotGrade();
  return { kind, grade, qty: state.shots[kind]?.[grade] || 0 };
}

/**
 * Множитель урона клика/скилла: с авто-зарядами и наличием склада ×1, иначе ×0.5.
 * При успешном расходе списывает 1 заряд грейда оружия.
 * Без экипированного оружия заряды не тратятся (нечего «заряжать»).
 */
function applyMineShotDamageMult(baseDmg) {
  ensureWorkshopState();
  const hasWeapon = typeof equippedWeaponItem === "function" && !!equippedWeaponItem();
  const stock = mineShotStock();
  const auto = state.autoShots !== false;
  let mult = 0.5;
  if (hasWeapon && auto && stock.qty > 0) {
    let consume = true;
    if (typeof passiveEffectMult === "function") {
      const costMult = passiveEffectMult("arrowCostMult", typeof state !== "undefined" ? state.avatar : null);
      if (costMult < 1 && Math.random() >= costMult) consume = false;
    }
    if (consume) {
      ProgressStore.update("shots", (s) => {
        const next = { soul: { ...s?.soul }, spirit: { ...s?.spirit } };
        next[stock.kind][stock.grade] = stock.qty - 1;
        return next;
      });
      if (stock.qty - 1 <= 0 && !applyMineShotDamageMult._emptyToast) {
        applyMineShotDamageMult._emptyToast = true;
        if (typeof toast === "function") {
          const label = stock.kind === "spirit" ? "Spiritshot" : "Soulshot";
          toast(label + " " + stock.grade + " закончились — урон ×0.5", "warn");
        }
        setTimeout(() => { applyMineShotDamageMult._emptyToast = false; }, 4000);
      }
    }
    mult = 1;
  }
  if (typeof syncMineShotHud === "function") syncMineShotHud();
  return Math.max(1, Math.round(baseDmg * mult));
}

function toggleAutoShots() {
  ensureWorkshopState();
  ProgressStore.set("autoShots", !(state.autoShots !== false));
  if (typeof save === "function") save();
  if (typeof syncMineShotHud === "function") syncMineShotHud();
  if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  return state.autoShots !== false;
}


function buyOre(type, qty) {
  ensureWorkshopState();
  const cost = qty * orePrice(type);
  if (state.adena < cost) { toast("Недостаточно adena"); return; }
  ProgressStore.update("adena", (a) => (a || 0) - cost);
  ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), [type]: (m?.[type] || 0) + qty }));
  if (typeof achStat === "function") {
    if (type === "soul") achStat("oreSoulBought", qty);
    else achStat("oreSpiritBought", qty);
  }
  Audio2.click(); save();
  $("#adena").textContent = fmt(state.adena);
  renderWorkshop();
  if ($("#screen-inv").classList.contains("active")) renderInventory();
  toast("Куплено " + ORE[type].name + " ×" + qty + " за " + fmtAdena(cost), "craft");
  if (typeof checkAchievements === "function") checkAchievements();
}

function craftShot(type, grade) {
  ensureWorkshopState();
  const r = { cry: shotRecipeVal(grade, "cry"), ore: shotRecipeVal(grade, "ore"), sell: shotRecipeVal(grade, "sell") };
  const oreKey = SHOT_TYPE[type].ore;
  if ((state.crystals[grade] || 0) < r.cry) { toast("Не хватает кристаллов " + grade + " (нужно " + r.cry + ")"); return; }
  if (state.materials[oreKey] < r.ore) { toast("Не хватает " + ORE[oreKey].name + " (нужно " + r.ore + ")"); return; }
  ProgressStore.update("crystals", (c) => {
    const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
    next[grade] -= r.cry;
    return next;
  });
  ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), [oreKey]: (m?.[oreKey] || 0) - r.ore }));
  const batch = shotBatchSize();
  ProgressStore.update("shots", (s) => {
    const next = { soul: { ...s?.soul }, spirit: { ...s?.spirit } };
    next[type][grade] = (next[type][grade] || 0) + batch;
    return next;
  });
  Audio2.success(); save();
  $("#adena").textContent = fmt(state.adena);
  renderWorkshop();
  if ($("#screen-inv").classList.contains("active")) renderInventory();
  toast("Скрафчено " + SHOT_TYPE[type].item + " (" + grade + ") ×" + batch, "craft");
  if (typeof achStat === "function") achStat("shotsCrafted", batch);
  if (typeof checkAchievements === "function") checkAchievements();
}

function shotsTotalValue() {
  let t = 0;
  ["soul", "spirit"].forEach((ty) => GRADES4.forEach((g) => { t += (state.shots[ty][g] || 0) * shotRecipeVal(g, "sell"); }));
  return t;
}
function sellShots(type, grade) {
  ensureWorkshopState();
  const qty = state.shots[type][grade] || 0;
  if (qty <= 0) { toast("Нет зарядов на продажу"); return; }
  const rev = qty * shotRecipeVal(grade, "sell");
  ProgressStore.update("shots", (s) => {
    const next = { soul: { ...s?.soul }, spirit: { ...s?.spirit } };
    next[type][grade] = 0;
    return next;
  });
  ProgressStore.update("adena", (a) => (a || 0) + rev);
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + rev }));
  if (typeof achStat === "function") achStat("shotsSold", 1);
  Audio2.coin(); save();
  $("#adena").textContent = fmt(state.adena);
  renderWorkshop();
  toast(SHOT_TYPE[type].item + " (" + grade + ") продано за " + fmtAdena(rev), "gold");
  if (typeof checkAchievements === "function") checkAchievements();
}
function sellAllShots() {
  ensureWorkshopState();
  const total = shotsTotalValue();
  if (total <= 0) { toast("Склад зарядов пуст"); return; }
  ProgressStore.set("shots", { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } });
  ProgressStore.update("adena", (a) => (a || 0) + total);
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + total }));
  if (typeof achStat === "function") achStat("shotsSold", 1);
  Audio2.coin(); save();
  $("#adena").textContent = fmt(state.adena);
  renderWorkshop();
  toast("Все заряды проданы за " + fmtAdena(total));
  if (typeof checkAchievements === "function") checkAchievements();
}

function accessoryCraftRecipe(accessoryId) {
  if (typeof ACCESSORY_CRAFT === "undefined" || !ACCESSORY_CRAFT) return null;
  return ACCESSORY_CRAFT.find((r) => r.accessoryId === accessoryId) || null;
}

function accessoryFragCount(fragId) {
  if (!fragId) return 0;
  if (typeof inventoryShardCount === "function") return inventoryShardCount(fragId);
  return (state.materials && state.materials[fragId]) || 0;
}

function canCraftAccessory(accessoryId) {
  const r = accessoryCraftRecipe(accessoryId);
  const def = typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[accessoryId] : null;
  if (!r || !def) return { ok: false, reason: "unknown" };
  const shards = accessoryFragCount(r.shardId);
  const adena = state.adena || 0;
  if (shards < r.shardQty) return { ok: false, reason: "shard", need: r.shardQty, have: shards };
  if (adena < (r.adena || 0)) return { ok: false, reason: "adena", need: r.adena || 0, have: adena };
  const cryNeed = Math.max(0, Math.floor(Number(r.cry) || 0));
  const oreNeed = Math.max(0, Math.floor(Number(r.oreSoul) || 0));
  if (cryNeed > 0 || oreNeed > 0) {
    const grade = def.grade || "D";
    const cry = state.crystals?.[grade] || 0;
    const ore = state.materials?.soul || 0;
    if (cry < cryNeed) return { ok: false, reason: "cry", need: cryNeed, have: cry, grade };
    if (ore < oreNeed) return { ok: false, reason: "ore", need: oreNeed, have: ore };
  }
  return { ok: true, recipe: r, def };
}

function craftAccessory(accessoryId) {
  const check = canCraftAccessory(accessoryId);
  if (!check.ok) {
    if (typeof toast === "function") {
      if (check.reason === "shard") toast("Не хватает осколков (нужно " + check.need + ")", "warn");
      else if (check.reason === "cry") toast("Не хватает кристаллов " + check.grade + " (нужно " + check.need + ")", "warn");
      else if (check.reason === "ore") toast("Не хватает Soul Ore (нужно " + check.need + ")", "warn");
      else if (check.reason === "adena") toast("Недостаточно adena", "warn");
      else toast("Рецепт недоступен", "warn");
    }
    return null;
  }
  const r = check.recipe;
  const shardStack = (state.inventory || []).find((it) => it && it.kind === "shard" && it.id === r.shardId);
  const willFreeSlot =
    shardStack && Math.max(0, Math.floor(Number(shardStack.qty) || 0)) <= r.shardQty;
  if (typeof isInventoryFull === "function" && isInventoryFull() && !willFreeSlot) {
    if (typeof toast === "function") toast("Инвентарь полон", "warn");
    return null;
  }
  if (typeof consumeShardsFromInventory === "function") {
    if (!consumeShardsFromInventory(r.shardId, r.shardQty)) {
      if (typeof toast === "function") toast("Не хватает осколков", "warn");
      return null;
    }
  } else {
    ProgressStore.update("materials", (m) => {
      const next = { ...(m || { soul: 0, spirit: 0 }) };
      next[r.shardId] = Math.max(0, (next[r.shardId] || 0) - r.shardQty);
      return next;
    });
  }
  const cryNeed = Math.max(0, Math.floor(Number(r.cry) || 0));
  const oreNeed = Math.max(0, Math.floor(Number(r.oreSoul) || 0));
  if (oreNeed > 0) {
    ProgressStore.update("materials", (m) => {
      const next = { ...(m || { soul: 0, spirit: 0 }) };
      next.soul = Math.max(0, (next.soul || 0) - oreNeed);
      return next;
    });
  }
  if (cryNeed > 0) {
    const grade = check.def.grade || "D";
    ProgressStore.update("crystals", (c) => {
      const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
      next[grade] = Math.max(0, (next[grade] || 0) - cryNeed);
      return next;
    });
  }
  if (r.adena > 0) {
    ProgressStore.update("adena", (a) => Math.max(0, (a || 0) - r.adena));
  }
  const granted = typeof grantCollectible === "function" ? grantCollectible(accessoryId) : null;
  if (!granted) return null;
  if (typeof Audio2 !== "undefined" && Audio2.success) Audio2.success();
  if (typeof save === "function") save();
  if (typeof toast === "function") {
    toast("🔨 Скрафчено: " + check.def.name + (check.def.grade ? " [" + check.def.grade + "]" : ""), "craft");
  }
  if (typeof renderWorkshop === "function") renderWorkshop();
  if (typeof renderInventory === "function") renderInventory();
  return granted;
}

