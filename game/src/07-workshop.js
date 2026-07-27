// ===== Мастерская: UI (рендер панели, кнопки, HUD) =====
// Core logic (buyOre, craftShot, sellShots, applyMineShotDamageMult) вынесено в workshop-core.js.

function craftFavBtnHtml(kind, id, defaultTarget) {
  const on = typeof isResourceFavorited === "function" && isResourceFavorited(kind, id);
  return (
    '<button type="button" class="craft-fav-btn' + (on ? " on" : "") +
    '" data-fav-kind="' + kind +
    '" data-fav-id="' + String(id).replace(/"/g, "") +
    '" data-fav-default="' + Math.max(1, Math.floor(Number(defaultTarget) || 1)) +
    '" title="Избранное — цель дофарма в окне фарма" aria-label="Избранное">★</button>'
  );
}

function bindCraftFavButtons(root) {
  if (!root || typeof promptResourceFavorite !== "function") return;
  root.querySelectorAll(".craft-fav-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      promptResourceFavorite(
        btn.getAttribute("data-fav-kind"),
        btn.getAttribute("data-fav-id"),
        Number(btn.getAttribute("data-fav-default")) || 1
      );
    };
  });
}

function openWorkshop(tab) {
  // onclick передаёт Event — не путать с "shots"/"armor"/"jewelry"
  wsMainTab = tab === "armor" || tab === "shots" || tab === "jewelry" ? tab : null;
  wsArmorKind = null;
  wsArmorSetId = null;
  try {
    renderWorkshop();
    show("shop");
    if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  } catch (e) {
    console.error("openWorkshop failed:", e);
    if (typeof toast === "function") toast("Мастерская временно недоступна", "warn");
  }
}

function armorKindLabel(kindId) {
  const row = typeof ARMOR_KINDS !== "undefined" ? ARMOR_KINDS.find((k) => k.id === kindId) : null;
  return row?.name || kindId || "Броня";
}

function syncWorkshopChrome() {
  const back = document.getElementById("shopBackBtn");
  const title = document.getElementById("shopTitle");
  const inArmorSet = wsMainTab === "armor" && !!wsArmorSetId;
  const inArmorKind = wsMainTab === "armor" && !!wsArmorKind && !wsArmorSetId;
  const inSection = wsMainTab === "shots" || wsMainTab === "armor" || wsMainTab === "jewelry";
  if (back) {
    back.removeAttribute("data-to");
    if (inArmorSet) back.textContent = "← " + armorKindLabel(wsArmorKind);
    else if (inArmorKind) back.textContent = "← Броня";
    else if (inSection) back.textContent = "← Мастерская";
    else back.textContent = "← В меню";
    back.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      if (inArmorSet) {
        wsArmorSetId = null;
        renderWorkshop();
      } else if (inArmorKind) {
        wsArmorKind = null;
        wsArmorSetId = null;
        renderWorkshop();
      } else if (inSection) {
        wsMainTab = null;
        wsArmorKind = null;
        wsArmorSetId = null;
        renderWorkshop();
      } else {
        show("menu");
      }
    };
  }
  if (title) {
    let label = "Мастерская";
    if (wsMainTab === "shots") label = "Заряды";
    else if (wsMainTab === "jewelry") label = "Бижутерия";
    else if (wsMainTab === "armor" && wsArmorSetId && typeof ARMOR_SETS !== "undefined" && ARMOR_SETS[wsArmorSetId]) {
      label = ARMOR_SETS[wsArmorSetId].name || wsArmorSetId;
    } else if (inArmorKind) label = armorKindLabel(wsArmorKind);
    else if (wsMainTab === "armor") label = "Броня";
    title.innerHTML = '<img src="assets/ui/inventory_book.png" alt="" class="inv-head-ico"> ' + label;
  }
}

function renderWorkshopHub(body) {
  const hub = document.createElement("div");
  hub.className = "ws-hub";
  const shotIco = (typeof UI_HUB_BTN_ICONS !== "undefined" && UI_HUB_BTN_ICONS.shots) || "icons/btn_shots.png?v=2";
  const armorIco = (typeof UI_HUB_BTN_ICONS !== "undefined" && UI_HUB_BTN_ICONS.armor) || "icons/btn_armor.png?v=2";
  const jewelIco = "icons/accessory_earring_of_zaken_i00.png";
  hub.innerHTML =
    '<p class="ws-hub-lead">Выбери раздел</p>' +
    '<div class="ws-hub-grid">' +
    '<button type="button" class="ws-hub-card" data-main="shots">' +
    '<img class="ws-hub-ico-img" src="' + shotIco + '" alt="" draggable="false">' +
    "<strong>Заряды</strong>" +
    "<small>Soulshot / Spiritshot · руда · продажа</small>" +
    "</button>" +
    '<button type="button" class="ws-hub-card" data-main="armor">' +
    '<img class="ws-hub-ico-img" src="' + armorIco + '" alt="" draggable="false">' +
    "<strong>Броня</strong>" +
    "<small>Сеты D / C · крафт из Material</small>" +
    "</button>" +
    '<button type="button" class="ws-hub-card" data-main="jewelry">' +
    '<img class="ws-hub-ico-img" src="' + jewelIco + '" alt="" draggable="false">' +
    "<strong>Бижутерия</strong>" +
    "<small>Серьга Закена · осколки с мирового босса</small>" +
    "</button>" +
    "</div>";
  body.appendChild(hub);
  hub.querySelectorAll("[data-main]").forEach((b) => {
    b.onclick = () => {
      wsMainTab = b.dataset.main;
      wsArmorKind = null;
      wsArmorSetId = null;
      Audio2.click();
      renderWorkshop();
    };
  });
}

function workshopArmorSetChestIcon(setId) {
  const setDef = typeof ARMOR_SETS !== "undefined" ? ARMOR_SETS[setId] : null;
  const pieces = setDef?.pieces || [];
  for (let i = 0; i < pieces.length; i++) {
    const a = typeof AMAP !== "undefined" ? AMAP[pieces[i]] : null;
    if (a && (a.slot === "chest" || a.slot === "mail")) return a.icon;
  }
  const first = pieces[0] && typeof AMAP !== "undefined" ? AMAP[pieces[0]] : null;
  return first?.icon || "icons/armor_mithril_breastplate_i00.png";
}

function workshopArmorSetReadyCount(setId) {
  if (typeof ARMOR_CRAFT === "undefined" || !ARMOR_CRAFT) return { ready: 0, total: 0 };
  let ready = 0;
  let total = 0;
  ARMOR_CRAFT.forEach((r) => {
    const armor = typeof AMAP !== "undefined" ? AMAP[r.armorId] : null;
    if (!armor || armor.setId !== setId) return;
    total++;
    if (typeof canCraftArmor === "function" && canCraftArmor(r.armorId).ok) ready++;
  });
  return { ready, total };
}

function workshopArmorKindReady(kindId) {
  let ready = 0;
  let total = 0;
  if (typeof ARMOR_SETS === "undefined" || !ARMOR_SETS) return { ready, total };
  Object.keys(ARMOR_SETS).forEach((setId) => {
    const setDef = ARMOR_SETS[setId];
    if (setDef.kind !== kindId) return;
    const c = workshopArmorSetReadyCount(setId);
    ready += c.ready;
    total += c.total;
  });
  return { ready, total };
}

function renderWorkshopArmorTypeHub(body) {
  const hub = document.createElement("div");
  hub.className = "ws-hub ws-armor-hub";
  hub.innerHTML =
    '<p class="ws-hub-lead">Выбери тип брони</p>' +
    '<p class="ws-armor-hint ws-armor-hub-hint">Тяжёлая · лёгкая · роба. Дальше — сет и крафт из Material.</p>' +
    '<div class="ws-hub-grid ws-armor-kind-grid"></div>';
  body.appendChild(hub);
  const grid = hub.querySelector(".ws-armor-kind-grid");
  const kinds = typeof ARMOR_KINDS !== "undefined" ? ARMOR_KINDS : [];
  const pref =
    typeof professionArmorPref === "function" ? professionArmorPref(state.avatar) : null;
  if (pref) {
    const prefLabel =
      (typeof ARMOR_KIND_LABELS !== "undefined" && ARMOR_KIND_LABELS[pref]) || pref;
    const hint = hub.querySelector(".ws-armor-hub-hint");
    if (hint) {
      hint.innerHTML =
        "Твоё сродство: <b>" +
        prefLabel +
        "</b> (5/5 кусков → +6% урон/DEF). Дальше — сет и крафт.";
    }
  }
  kinds.forEach((k) => {
    const counts = workshopArmorKindReady(k.id);
    const ico =
      (typeof ARMOR_KIND_ICONS !== "undefined" && ARMOR_KIND_ICONS[k.id]) ||
      "icons/armor_mithril_breastplate_i00.png";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "ws-hub-card ws-armor-kind-card" + (pref && k.id === pref ? " is-pref" : "");
    btn.dataset.kind = k.id;
    btn.innerHTML =
      '<img class="ws-hub-ico-img" src="' + ico + '" alt="" draggable="false">' +
      "<strong>" + k.name + "</strong>" +
      (pref && k.id === pref ? '<span class="ws-armor-pref-mark">сродство</span>' : "") +
      '<span class="ws-armor-set-meta">' +
      (counts.ready ? "можно " + counts.ready + "/" + counts.total : k.short) +
      "</span>" +
      "<small>" + (k.hint || "") + "</small>";
    btn.onclick = () => {
      wsArmorKind = k.id;
      wsArmorSetId = null;
      if (typeof Audio2 !== "undefined") Audio2.click();
      renderWorkshop();
    };
    grid.appendChild(btn);
  });
}

function renderWorkshopArmorHub(body) {
  const hub = document.createElement("div");
  hub.className = "ws-hub ws-armor-hub";
  const kindName = armorKindLabel(wsArmorKind);
  hub.innerHTML =
    '<p class="ws-hub-lead">Выбери сет · ' + kindName + "</p>" +
    '<p class="ws-armor-hint ws-armor-hub-hint">Фарм Material: <b>свалка</b> (D) и <b>кузница</b> (C). Рецепт: piece + кристаллы + Soul Ore.</p>' +
    '<div class="ws-hub-grid ws-armor-set-grid"></div>';
  body.appendChild(hub);
  const grid = hub.querySelector(".ws-armor-set-grid");
  const setOrder = typeof ARMOR_SETS !== "undefined" ? Object.keys(ARMOR_SETS) : [];
  const filtered = setOrder.filter((setId) => {
    const setDef = ARMOR_SETS[setId];
    return !wsArmorKind || setDef.kind === wsArmorKind;
  });
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "ws-armor-hint";
    empty.textContent = "Сеты этого типа пока недоступны.";
    hub.appendChild(empty);
    return;
  }
  filtered.forEach((setId) => {
    const setDef = ARMOR_SETS[setId];
    const zoneId = setDef?.farmZoneId || (typeof farmZoneIdForArmorSet === "function" ? farmZoneIdForArmorSet(setId) : null);
    const zone = zoneId && typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
    const zoneName = zone
      ? (typeof zoneRaceView === "function" ? zoneRaceView(zone).name : zone.name)
      : "—";
    const counts = workshopArmorSetReadyCount(setId);
    const preview =
      typeof armorSetBonusPreviewLines === "function" ? armorSetBonusPreviewLines(setId, 4) : [];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ws-hub-card ws-armor-set-card";
    btn.dataset.set = setId;
    btn.innerHTML =
      '<img class="ws-hub-ico-img" src="' + workshopArmorSetChestIcon(setId) + '" alt="" draggable="false">' +
      "<strong>" + (setDef.name || setId) + "</strong>" +
      '<span class="ws-armor-set-meta">' +
      '<span class="ws-armor-grade g-' + (setDef.grade || "?") + '">' + (setDef.grade || "?") + "</span>" +
      (counts.ready ? " · можно " + counts.ready + "/" + counts.total : "") +
      "</span>" +
      (preview.length
        ? '<ul class="ws-armor-set-preview">' +
          preview.map((ln) => "<li>" + ln + "</li>").join("") +
          "</ul>"
        : "") +
      "<small>Фарм: " + zoneName + "</small>";
    btn.onclick = () => {
      wsArmorSetId = setId;
      if (setDef.kind) wsArmorKind = setDef.kind;
      if (typeof Audio2 !== "undefined") Audio2.click();
      renderWorkshop();
    };
    grid.appendChild(btn);
  });
}

function renderWorkshop() {
  ensureWorkshopState();
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  if (wsMainTab !== "shots" && wsMainTab !== "armor" && wsMainTab !== "jewelry" && wsMainTab !== null) {
    wsMainTab = null;
    wsArmorKind = null;
    wsArmorSetId = null;
  }
  if (wsMainTab !== "armor") {
    wsArmorKind = null;
    wsArmorSetId = null;
  }
  if (wsArmorSetId && (typeof ARMOR_SETS === "undefined" || !ARMOR_SETS[wsArmorSetId])) {
    wsArmorSetId = null;
  }
  if (wsArmorSetId && ARMOR_SETS[wsArmorSetId]?.kind) {
    wsArmorKind = ARMOR_SETS[wsArmorSetId].kind;
  }
  if (wsArmorKind && typeof ARMOR_KINDS !== "undefined" && !ARMOR_KINDS.some((k) => k.id === wsArmorKind)) {
    wsArmorKind = null;
  }
  syncWorkshopChrome();
  const body = $("#wsBody");
  if (!body) {
    console.error("renderWorkshop: #wsBody missing");
    return;
  }
  body.innerHTML = "";

  if (!wsMainTab) {
    renderWorkshopHub(body);
    return;
  }

  if (wsMainTab === "jewelry") {
    renderWorkshopJewelry(body);
    return;
  }

  if (wsMainTab === "armor" && !wsArmorKind) {
    renderWorkshopArmorTypeHub(body);
    return;
  }

  if (wsMainTab === "armor" && !wsArmorSetId) {
    renderWorkshopArmorHub(body);
    return;
  }

  const cryst = document.createElement("div");
  cryst.className = "ws-cryst-bar";
  let chtml = '<span class="cl">Кристаллы в инвентаре:</span>';
  GRADES4.forEach((g) => {
    chtml += `<span class="cr" title="Crystal (${g}-Grade)" style="color:${CRYSTAL_COLOR[g]}"><img class="cicon" src="${CRYSTAL_ICON[g]}" alt="${g}">${g}<b>${fmt(state.crystals[g] || 0)}</b></span>`;
  });
  cryst.innerHTML = chtml;
  body.appendChild(cryst);

  if (wsMainTab === "armor") {
    renderWorkshopArmor(body);
    return;
  }

  const shop = document.createElement("div");
  shop.className = "ws-sec";
  let oreHtml = "<h3>🛒 Магазин руды</h3><div class='ws-ore'>";
  ["soul", "spirit"].forEach((ty) => {
    const o = ORE[ty];
    oreHtml += `<div class="ore-card">
      <div class="oh"><img src="${o.icon}" alt=""><div><div class="on">${o.name}</div><div class="opx">${fmtAdena(orePrice(ty))} adena/шт</div></div><div class="oc">${fmt(state.materials[ty] || 0)} ${craftFavBtnHtml("ore", ty, 100)}</div></div>
      <div class="buyrow" data-ore="${ty}">
        <button data-q="10">+10</button><button data-q="100">+100</button><button data-q="1000">+1000</button>
      </div></div>`;
  });
  oreHtml += "</div>";
  shop.innerHTML = oreHtml;
  bindCraftFavButtons(shop);
  body.appendChild(shop);
  shop.querySelectorAll(".buyrow").forEach((row) => {
    const ty = row.dataset.ore;
    row.querySelectorAll("button").forEach((b) => {
      const q = +b.dataset.q;
      b.disabled = state.adena < q * orePrice(ty);
      b.onclick = () => buyOre(ty, q);
    });
  });

  const craft = document.createElement("div");
  craft.className = "ws-sec";
  craft.innerHTML = `<h3><img src="assets/ui/inventory_book.png" alt="" class="inv-head-ico"> Крафт зарядов</h3>
    <div class="craft-tabs">
      <button data-tab="soul" class="${wsTab === "soul" ? "sel" : ""}">🔫 Soulshot</button>
      <button data-tab="spirit" class="${wsTab === "spirit" ? "sel" : ""}">✨ Spiritshot</button>
    </div><div class="craft-grid" id="craftGrid"></div>`;
  body.appendChild(craft);
  craft.querySelectorAll(".craft-tabs button").forEach((b) => {
    b.onclick = () => {
      wsTab = b.dataset.tab;
      Audio2.click();
      renderWorkshop();
    };
  });

  const grid = craft.querySelector("#craftGrid");
  const ty = wsTab;
  const oreKey = SHOT_TYPE[ty].ore;
  GRADES4.forEach((g) => {
    const r = { cry: shotRecipeVal(g, "cry"), ore: shotRecipeVal(g, "ore"), sell: shotRecipeVal(g, "sell") };
    const stock = state.shots[ty][g] || 0;
    const haveCry = state.crystals[g] || 0;
    const canCraft = haveCry >= r.cry && state.materials[oreKey] >= r.ore;
    const cryLow = haveCry < r.cry ? "color:#ff6b6b" : "";
    const oreHave = state.materials[oreKey] || 0;
    const oreLow = oreHave < r.ore ? "color:#ff6b6b" : "";
    const batch = shotBatchSize();
    const card = document.createElement("div");
    card.className = "craft-card";
    card.innerHTML = `
      <div class="ch"><img src="${SHOT_ICON[ty][g]}" alt=""><div class="cn">${SHOT_TYPE[ty].item}</div><div class="cg" style="background:${GRADE_TAG[g]};color:#10131a">${g}</div></div>
      <div class="cinfo">Рецепт: <b style="${cryLow}"><img class="cryreq" src="${CRYSTAL_ICON[g]}" alt="">${r.cry} крист. ${g}</b>${craftFavBtnHtml("crystal", g, r.cry)} + <b style="${oreLow}">${r.ore} ${ORE[oreKey].name}</b>${craftFavBtnHtml("ore", oreKey, r.ore)}<br>Выход: <b>${batch}</b> зарядов · продажа <b>${r.sell}</b> adena/шт</div>
      <div class="cstock">Склад: <b>${fmt(stock)}</b> <span style="color:var(--txt-dim)">(${fmtAdena(stock * r.sell)})</span> ${craftFavBtnHtml("shot", ty + ":" + g, batch)}</div>
      <div class="cbtns">
        <button class="craftb" ${canCraft ? "" : "disabled"}>Скрафтить ×${batch}</button>
        <button class="sellb" ${stock > 0 ? "" : "disabled"}>Продать</button>
      </div>`;
    bindCraftFavButtons(card);
    card.querySelector(".craftb").onclick = () => craftShot(ty, g);
    card.querySelector(".sellb").onclick = () => sellShots(ty, g);
    grid.appendChild(card);
  });

  const sellAll = document.createElement("button");
  sellAll.className = "ws-sellall";
  const tv = shotsTotalValue();
  sellAll.disabled = tv <= 0;
  sellAll.textContent = "💰 Продать все заряды · " + fmtAdena(tv);
  sellAll.onclick = sellAllShots;
  craft.appendChild(sellAll);
}

function renderWorkshopJewelry(body) {
  const sec = document.createElement("div");
  sec.className = "ws-sec";
  sec.innerHTML =
    "<h3>💍 Бижутерия</h3>" +
    '<p class="ws-armor-hint">Осколки падают с мирового босса Закена (2–3 место). 1 место — готовая серьга.</p>' +
    '<div class="craft-grid" id="jewelCraftGrid"></div>';
  body.appendChild(sec);
  const grid = sec.querySelector("#jewelCraftGrid");
  const recipes = typeof ACCESSORY_CRAFT !== "undefined" ? ACCESSORY_CRAFT : [];
  if (!recipes.length) {
    const empty = document.createElement("p");
    empty.className = "ws-armor-hint";
    empty.textContent = "Рецептов пока нет.";
    sec.appendChild(empty);
    return;
  }
  recipes.forEach((r) => {
    const def = typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[r.accessoryId] : null;
    const frag = typeof ACCESSORY_FRAGS !== "undefined" ? ACCESSORY_FRAGS[r.shardId] : null;
    if (!def) return;
    const have = typeof accessoryFragCount === "function" ? accessoryFragCount(r.shardId) : 0;
    const can = typeof canCraftAccessory === "function" && canCraftAccessory(r.accessoryId).ok;
    const card = document.createElement("div");
    card.className = "craft-card";
    card.innerHTML =
      '<div class="ch"><img src="' +
      (def.icon || "") +
      '" alt=""><div class="cn">' +
      def.name +
      '</div><div class="cg" style="background:#5fb8ff;color:#10131a">' +
      (def.grade || "?") +
      "</div></div>" +
      '<div class="cinfo">Рецепт: <b>' +
      (frag?.name || r.shardId) +
      " ×" +
      r.shardQty +
      "</b> (есть " +
      have +
      ")" +
      (r.adena ? " + <b>" + r.adena.toLocaleString("ru-RU") + " adena</b>" : "") +
      "<br>" +
      (def.desc || "") +
      "</div>" +
      '<div class="cbtns"><button type="button" class="craftb"' +
      (can ? "" : " disabled") +
      ">Скрафтить</button></div>";
    card.querySelector(".craftb").onclick = () => {
      if (typeof craftAccessory === "function") craftAccessory(r.accessoryId);
    };
    grid.appendChild(card);
  });
}

function renderWorkshopArmor(body) {
  if (typeof ARMOR_CRAFT === "undefined" || !ARMOR_CRAFT || !ARMOR_CRAFT.length || typeof craftArmor !== "function") {
    const empty = document.createElement("div");
    empty.className = "ws-sec";
    empty.innerHTML = '<p class="ws-armor-hint">Крафт брони пока недоступен.</p>';
    body.appendChild(empty);
    return;
  }
  const setId = wsArmorSetId;
  const setDef = typeof ARMOR_SETS !== "undefined" ? ARMOR_SETS[setId] : null;
  if (!setId || !setDef) {
    renderWorkshopArmorHub(body);
    return;
  }
  const zoneId = setDef.farmZoneId || (typeof farmZoneIdForArmorSet === "function" ? farmZoneIdForArmorSet(setId) : null);
  const zone = zoneId && typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  const zoneName = zone
    ? (typeof zoneRaceView === "function" ? zoneRaceView(zone).name : zone.name)
    : zoneId || "—";

  const armorSec = document.createElement("div");
  armorSec.className = "ws-sec";
  const preview =
    typeof armorSetBonusPreviewLines === "function" ? armorSetBonusPreviewLines(setId, 5) : [];
  const defSus =
    typeof armorSetDefSustainEstimate === "function" ? armorSetDefSustainEstimate(setId) : 0;
  armorSec.innerHTML =
    "<h3>🛡 " + (setDef.name || setId) +
    ' <span class="ws-armor-grade g-' + (setDef.grade || "?") + '">' + (setDef.grade || "?") + "</span></h3>" +
    '<p class="ws-armor-hint">Фарм кусков: <b>' + zoneName + "</b>. Рецепт: Material + кристаллы " +
    (setDef.grade || "?") + " + Soul Ore.</p>" +
    (preview.length
      ? '<ul class="ws-armor-set-bonuses">' +
        preview.map((ln) => "<li>" + ln + "</li>").join("") +
        "</ul>"
      : "") +
    '<p class="ws-armor-hint ws-armor-def-hint">P.Def/M.Def кусков отдельно режут HP golden/boss' +
    (defSus > 0 ? " (полный сет ≈ −" + Math.round(defSus * 100) + "% от DEF, кап ~10%)" : "") +
    "; set-бонусы — сверху.</p>" +
    '<div class="craft-grid" id="armorCraftGrid"></div>';
  body.appendChild(armorSec);
  const aGrid = armorSec.querySelector("#armorCraftGrid");

  const recipes = ARMOR_CRAFT.filter((r) => {
    const armor = typeof AMAP !== "undefined" ? AMAP[r.armorId] : null;
    return armor && armor.setId === setId;
  });
  if (!recipes.length) {
    const empty = document.createElement("p");
    empty.className = "ws-armor-hint";
    empty.textContent = "Рецептов для этого сета нет.";
    armorSec.appendChild(empty);
    return;
  }

  recipes.forEach((r) => {
    const armor = AMAP[r.armorId];
    const frag = typeof ARMOR_FRAGS !== "undefined" ? ARMOR_FRAGS[r.fragId] : null;
    if (!armor || !frag) return;
    const grade = armor.grade || "C";
    const haveFrag = typeof armorFragCount === "function" ? armorFragCount(r.fragId) : (state.materials?.[r.fragId] || 0);
    const haveCry = state.crystals?.[grade] || 0;
    const haveOre = state.materials?.soul || 0;
    const can = typeof canCraftArmor === "function" ? canCraftArmor(r.armorId).ok : false;
    const card = document.createElement("div");
    card.className = "craft-card";
    const fragLow = haveFrag < r.fragQty ? "color:#ff6b6b" : "";
    const cryLow = haveCry < r.cry ? "color:#ff6b6b" : "";
    const oreLow = haveOre < r.oreSoul ? "color:#ff6b6b" : "";
    const adenaNeed = r.adena || 0;
    const adenaLow = adenaNeed > 0 && (state.adena || 0) < adenaNeed ? "color:#ff6b6b" : "";
    const stockFrag = fragLow ? ' style="' + fragLow + '"' : "";
    const stockOre = oreLow ? ' style="' + oreLow + '"' : "";
    const adenaBit = adenaNeed
      ? ' + <b style="' + adenaLow + '">' + fmtAdena(adenaNeed) + "</b>"
      : "";
    card.innerHTML =
      '<div class="ch"><img src="' + armor.icon + '" alt=""><div class="cn">' + armor.name + '</div><div class="cg" style="background:' + (GRADE_TAG[grade] || "#5fcf6b") + ';color:#10131a">' + grade + "</div></div>" +
      '<div class="cinfo">Рецепт: <b style="' + fragLow + '"><img class="cryreq" src="' + frag.icon + '" alt="">' + r.fragQty + " " + frag.name + "</b>" + craftFavBtnHtml("frag", r.fragId, r.fragQty) + "<br>" +
      '<b style="' + cryLow + '"><img class="cryreq" src="' + (CRYSTAL_ICON[grade] || "") + '" alt="">' + r.cry + " крист. " + grade +
      "</b>" + craftFavBtnHtml("crystal", grade, r.cry) +
      ' + <b style="' + oreLow + '">' + r.oreSoul + " Soul Ore</b>" + craftFavBtnHtml("ore", "soul", r.oreSoul) + adenaBit + "</div>" +
      '<div class="cstock">Материал: <b' + stockFrag + ">" + fmt(haveFrag) + "</b> · Soul Ore: <b" + stockOre + ">" + fmt(haveOre) + "</b></div>" +
      '<div class="cbtns"><button class="craftb" ' + (can ? "" : "disabled") + ">Скрафтить</button></div>";
    bindCraftFavButtons(card);
    card.querySelector(".craftb").onclick = () => {
      craftArmor(r.armorId);
      renderWorkshop();
      if ($("#screen-inv")?.classList?.contains("active") && typeof renderInventory === "function") renderInventory();
      if ($("#adena")) $("#adena").textContent = fmt(state.adena);
    };
    aGrid.appendChild(card);
  });
}
