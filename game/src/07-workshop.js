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
const SHOT_RECIPE = {
  D: { cry: 6,  ore: 18,  sell: 2 },
  C: { cry: 8,  ore: 28,  sell: 4 },
  B: { cry: 12, ore: 110, sell: 18 },
  A: { cry: 16, ore: 130, sell: 24 },
};
const GRADES4 = ["D", "C", "B", "A"];
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
  if (!state.materials) state.materials = { soul: 0, spirit: 0 };
  if (!state.shots) state.shots = { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } };
  if (state.autoShots == null) state.autoShots = true;
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
    state.shots[stock.kind][stock.grade] = stock.qty - 1;
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
  state.autoShots = !(state.autoShots !== false);
  if (typeof save === "function") save();
  if (typeof syncMineShotHud === "function") syncMineShotHud();
  if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  return state.autoShots !== false;
}


function buyOre(type, qty) {
  ensureWorkshopState();
  const cost = qty * orePrice(type);
  if (state.adena < cost) { toast("Недостаточно adena"); return; }
  state.adena -= cost; state.materials[type] += qty;
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
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  const r = { cry: shotRecipeVal(grade, "cry"), ore: shotRecipeVal(grade, "ore"), sell: shotRecipeVal(grade, "sell") };
  const oreKey = SHOT_TYPE[type].ore;
  if ((state.crystals[grade] || 0) < r.cry) { toast("Не хватает кристаллов " + grade + " (нужно " + r.cry + ")"); return; }
  if (state.materials[oreKey] < r.ore) { toast("Не хватает " + ORE[oreKey].name + " (нужно " + r.ore + ")"); return; }
  state.crystals[grade] -= r.cry;
  state.materials[oreKey] -= r.ore;
  const batch = shotBatchSize();
  state.shots[type][grade] += batch;
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
  state.shots[type][grade] = 0; state.adena += rev; state.totals.earned = (state.totals.earned || 0) + rev;
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
  ["soul", "spirit"].forEach((ty) => GRADES4.forEach((g) => { state.shots[ty][g] = 0; }));
  state.adena += total; state.totals.earned = (state.totals.earned || 0) + total;
  if (typeof achStat === "function") achStat("shotsSold", 1);
  Audio2.coin(); save();
  $("#adena").textContent = fmt(state.adena);
  renderWorkshop();
  toast("Все заряды проданы за " + fmtAdena(total));
  if (typeof checkAchievements === "function") checkAchievements();
}

function openWorkshop() { renderWorkshop(); show("shop"); Audio2.open(); }

function renderWorkshop() {
  ensureWorkshopState();
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  const body = $("#wsBody"); body.innerHTML = "";

  const cryst = document.createElement("div");
  cryst.className = "ws-cryst-bar";
  let chtml = '<span class="cl">Кристаллы в инвентаре:</span>';
  GRADES4.forEach((g) => {
    chtml += `<span class="cr" title="Crystal (${g}-Grade)" style="color:${CRYSTAL_COLOR[g]}"><img class="cicon" src="${CRYSTAL_ICON[g]}" alt="${g}">${g}<b>${fmt(state.crystals[g] || 0)}</b></span>`;
  });
  cryst.innerHTML = chtml;
  body.appendChild(cryst);

  // 1) Магазин руды
  const shop = document.createElement("div"); shop.className = "ws-sec";
  let oreHtml = "<h3>🛒 Магазин руды</h3><div class='ws-ore'>";
  ["soul", "spirit"].forEach((ty) => {
    const o = ORE[ty];
    oreHtml += `<div class="ore-card">
      <div class="oh"><img src="${o.icon}" alt=""><div><div class="on">${o.name}</div><div class="opx">${fmtAdena(orePrice(ty))} adena/шт</div></div><div class="oc">${fmt(state.materials[ty] || 0)}</div></div>
      <div class="buyrow" data-ore="${ty}">
        <button data-q="10">+10</button><button data-q="100">+100</button><button data-q="1000">+1000</button>
      </div></div>`;
  });
  oreHtml += "</div>";
  shop.innerHTML = oreHtml;
  body.appendChild(shop);
  shop.querySelectorAll(".buyrow").forEach((row) => {
    const ty = row.dataset.ore;
    row.querySelectorAll("button").forEach((b) => {
      const q = +b.dataset.q;
      b.disabled = state.adena < q * orePrice(ty);
      b.onclick = () => buyOre(ty, q);
    });
  });

  // 2) Крафт зарядов (вкладки Soulshot / Spiritshot)
  const craft = document.createElement("div"); craft.className = "ws-sec";
  craft.innerHTML = `<h3><img src="assets/ui/inventory_book.png" alt="" class="inv-head-ico"> Крафт зарядов</h3>
    <div class="craft-tabs">
      <button data-tab="soul" class="${wsTab === "soul" ? "sel" : ""}">🔫 Soulshot</button>
      <button data-tab="spirit" class="${wsTab === "spirit" ? "sel" : ""}">✨ Spiritshot</button>
    </div><div class="craft-grid" id="craftGrid"></div>`;
  body.appendChild(craft);
  craft.querySelectorAll(".craft-tabs button").forEach((b) => { b.onclick = () => { wsTab = b.dataset.tab; Audio2.click(); renderWorkshop(); }; });

  const grid = craft.querySelector("#craftGrid");
  const ty = wsTab; const oreKey = SHOT_TYPE[ty].ore;
  GRADES4.forEach((g) => {
    const r = { cry: shotRecipeVal(g, "cry"), ore: shotRecipeVal(g, "ore"), sell: shotRecipeVal(g, "sell") };
    const stock = state.shots[ty][g] || 0;
    const haveCry = state.crystals[g] || 0;
    const canCraft = haveCry >= r.cry && state.materials[oreKey] >= r.ore;
    const cryLow = haveCry < r.cry ? "color:#ff6b6b" : "";
    const batch = shotBatchSize();
    const card = document.createElement("div"); card.className = "craft-card";
    card.innerHTML = `
      <div class="ch"><img src="${SHOT_ICON[ty][g]}" alt=""><div class="cn">${SHOT_TYPE[ty].item}</div><div class="cg" style="background:${GRADE_TAG[g]};color:#10131a">${g}</div></div>
      <div class="cinfo">Рецепт: <b style="${cryLow}"><img class="cryreq" src="${CRYSTAL_ICON[g]}" alt="">${r.cry} крист. ${g}</b> + <b>${r.ore} ${ORE[oreKey].name}</b><br>Выход: <b>${batch}</b> зарядов · продажа <b>${r.sell}</b> adena/шт</div>
      <div class="cstock">Склад: <b>${fmt(stock)}</b> <span style="color:var(--txt-dim)">(${fmtAdena(stock * r.sell)})</span></div>
      <div class="cbtns">
        <button class="craftb" ${canCraft ? "" : "disabled"}>Скрафтить ×${batch}</button>
        <button class="sellb" ${stock > 0 ? "" : "disabled"}>Продать</button>
      </div>`;
    card.querySelector(".craftb").onclick = () => craftShot(ty, g);
    card.querySelector(".sellb").onclick = () => sellShots(ty, g);
    grid.appendChild(card);
  });

  // 3) Продать всё
  const sellAll = document.createElement("button"); sellAll.className = "ws-sellall";
  const tv = shotsTotalValue(); sellAll.disabled = tv <= 0;
  sellAll.textContent = "💰 Продать все заряды · " + fmtAdena(tv);
  sellAll.onclick = sellAllShots;
  craft.appendChild(sellAll);
}

