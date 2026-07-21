// ===== Мастерская: UI (рендер панели, кнопки, HUD) =====
// Core logic (buyOre, craftShot, sellShots, applyMineShotDamageMult) вынесено в workshop-core.js.

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

