// ===== Мастерская: core logic (руда, крафт, заряды, автозаряды) =====
// Вынесено из 07-workshop.js; UI осталось в 07-workshop.js.
// ORE, SHOT_TYPE, SHOT_ICON, GRADE_TAG, SHOT_BATCH, SHOT_RECIPE, GRADES4
// вынесены в data/workshop-balance.js.

let wsTab = "soul";


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
 */
function applyMineShotDamageMult(baseDmg) {
  ensureWorkshopState();
  const stock = mineShotStock();
  const auto = state.autoShots !== false;
  let mult = 0.5;
  if (auto && stock.qty > 0) {
    ProgressStore.update("shots", (s) => {
      const next = { soul: { ...s?.soul }, spirit: { ...s?.spirit } };
      next[stock.kind][stock.grade] = stock.qty - 1;
      return next;
    });
    mult = 1;
    if (stock.qty - 1 <= 0 && !applyMineShotDamageMult._emptyToast) {
      applyMineShotDamageMult._emptyToast = true;
      if (typeof toast === "function") {
        const label = stock.kind === "spirit" ? "Spiritshot" : "Soulshot";
        toast(label + " " + stock.grade + " закончились — урон ×0.5", "warn");
      }
      setTimeout(() => { applyMineShotDamageMult._emptyToast = false; }, 4000);
    }
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

