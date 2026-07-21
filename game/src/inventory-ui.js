// ===== Инвентарь: UI, рендер, drag-and-drop, кристаллизация =====
// Вынесено из 09-inventory.js; зависит от inventory-core.js.

let dragSrc = null;
/** @type {{ idx: number, x: number, y: number, armed: boolean, pointerId: number } | null} */
let invPointerDrag = null;
/** @type {HTMLElement | null} */
let invDragGhost = null;
let invSuppressClickUntil = 0;
let lastWheelAt = 0;

document.addEventListener(
  "wheel",
  (e) => {
    if (!e || (e.deltaY === 0 && e.deltaX === 0)) return;
    lastWheelAt = Date.now();
    if (!invPointerDrag) return;
    finishInvPointerDrag(null);
  },
  { passive: true, capture: true }
);

function pointInElement(e, el) {
  if (!el || !e) return false;
  const r = el.getBoundingClientRect();
  const x = e.clientX != null ? e.clientX : 0;
  const y = e.clientY != null ? e.clientY : 0;
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function invCrystallizeZone() {
  return document.getElementById("invCrystallize");
}

function updateInvCrystHover(e) {
  const cz = invCrystallizeZone();
  if (!cz || !invPointerDrag || !invPointerDrag.armed) return;
  setCrystallizeIco(cz, pointInElement(e, cz) ? "drag" : "normal");
}

function removeInvDragGhost() {
  if (invDragGhost) {
    invDragGhost.remove();
    invDragGhost = null;
  }
}

function moveInvDragGhost(e) {
  if (!invDragGhost || !e) return;
  invDragGhost.style.left = e.clientX + "px";
  invDragGhost.style.top = e.clientY + "px";
}

function createInvDragGhost(it, slot) {
  removeInvDragGhost();
  const def = invItemDef(it);
  if (!def) return;
  const grade = def.grade || "NG";
  const ghost = document.createElement("div");
  ghost.className = "inv-drag-ghost g-" + grade;
  ghost.innerHTML =
    '<img src="' + def.icon + '" alt="" draggable="false">' +
    (it.plus ? '<span class="ip">+' + it.plus + "</span>" : "");
  document.body.appendChild(ghost);
  invDragGhost = ghost;
  if (slot) {
    const r = slot.getBoundingClientRect();
    ghost.style.left = r.left + r.width / 2 + "px";
    ghost.style.top = r.top + r.height / 2 + "px";
  }
}

function armInvPointerDrag(e) {
  if (!invPointerDrag || invPointerDrag.armed) return;
  invPointerDrag.armed = true;
  dragSrc = invPointerDrag.idx;
  const slot = document.querySelector('.inv-slot[data-inv-idx="' + invPointerDrag.idx + '"]');
  if (slot) slot.classList.add("dragging");
  const inv = state.inventory || [];
  const it = inv[invPointerDrag.idx];
  if (it) createInvDragGhost(it, slot);
  moveInvDragGhost(e);
  const cz = invCrystallizeZone();
  if (cz) setCrystallizeIco(cz, pointInElement(e, cz) ? "drag" : "normal");
}

function finishInvPointerDrag(e) {
  const pd = invPointerDrag;
  invPointerDrag = null;
  dragSrc = null;
  if (pd && pd.armed) {
    invSuppressClickUntil = Date.now() + 320;
    const cz = invCrystallizeZone();
    if (cz && e && pointInElement(e, cz)) {
      const inv = state.inventory || [];
      const it = inv[pd.idx];
      if (it && !isAccessoryItem(it)) crystallizeAt(pd.idx);
    }
  }
  clearInvDragUi();
}

document.addEventListener("pointermove", (e) => {
  if (!invPointerDrag || invPointerDrag.pointerId !== e.pointerId) return;
  if (invPointerDrag.armed) {
    e.preventDefault();
    moveInvDragGhost(e);
    updateInvCrystHover(e);
    return;
  }
  const dx = e.clientX - invPointerDrag.x;
  const dy = e.clientY - invPointerDrag.y;
  if (dx * dx + dy * dy < 36) return;
  e.preventDefault();
  armInvPointerDrag(e);
});

document.addEventListener("pointerup", (e) => {
  if (!invPointerDrag || invPointerDrag.pointerId !== e.pointerId) return;
  finishInvPointerDrag(e);
}, true);

document.addEventListener("pointercancel", (e) => {
  if (!invPointerDrag || invPointerDrag.pointerId !== e.pointerId) return;
  finishInvPointerDrag(null);
}, true);

function clearInvDragUi() {
  dragSrc = null;
  invPointerDrag = null;
  removeInvDragGhost();
  $$(".inv-slot.dragover,.inv-slot.dragging").forEach((s) => s.classList.remove("dragover", "dragging"));
  const cz = invCrystallizeZone();
  if (cz) setCrystallizeIco(cz, "normal");
}

function invClickBlocked() {
  return Date.now() < invSuppressClickUntil || invPointerDrag != null || dragSrc != null;
}

function setCrystallizeIco(zone, state) {
  const img = zone && zone.querySelector(".inv-crystallize-ico");
  if (!img) return;
  img.src = CRYSTALLIZE_ICON[state] || CRYSTALLIZE_ICON.normal;
  zone.classList.toggle("dragover", state === "drag");
  zone.classList.toggle("hover", state === "over");
}

async function crystallizeAt(idx) {
  const inv = state.inventory || [];
  const it = inv[idx];
  if (!it || isAccessoryItem(it)) return;
  const w = WMAP[it.id];
  if (!w) return;
  if (typeof weaponCanEnchant === "function" && !weaponCanEnchant(w)) {
    toast("«" + w.name + "» без грейда — не кристаллизуется", "warn");
    return;
  }
  const yld = crystalYield(w, it.plus);
  const grade = w.grade;
  const plusStr = it.plus ? " +" + it.plus : "";
  const ok = await showConfirm({
    title: "Кристаллизация",
    html: `<div class="modal-cryst">
      <img class="modal-cryst-wpn" src="${w.icon}" alt="">
      <div class="modal-cryst-info">
        <div class="modal-cryst-name g-${grade}">${w.name}${plusStr}</div>
        <div class="modal-cryst-warn">Оружие будет уничтожено без заточки.</div>
        <div class="modal-cryst-reward"><img src="${CRYSTAL_ICON[grade]}" alt=""> +${yld} кристаллов <span class="g-${grade}">${grade}</span></div>
      </div>
    </div>`,
    okText: "Кристаллизовать",
    cancelText: "Отмена",
    danger: true,
  });
  if (!ok) return;
  ProgressStore.set("inventory", inv.filter((x) => x.uid !== it.uid));
  ProgressStore.update("crystals", (c) => {
    const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
    next[grade] = (next[grade] || 0) + yld;
    return next;
  });
  Audio2.coin();
  save();
  if (typeof flushCloudSave === "function") flushCloudSave({ force: true });
  toast("Кристаллизация: " + w.name + plusStr + " → +" + yld + " крист. (" + grade + ")", "loot");
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("crystallize", {
      weaponId: w.id,
      weaponName: w.name,
      grade,
      plus: it.plus || 0,
      crystals: yld,
    });
  }
  renderInventory();
}

function attachCrystallizeZone(zone) {
  setCrystallizeIco(zone, "normal");
  zone.addEventListener("mouseenter", () => { if (!invPointerDrag) setCrystallizeIco(zone, "over"); });
  zone.addEventListener("mouseleave", () => { if (!invPointerDrag) setCrystallizeIco(zone, "normal"); });
  zone.addEventListener("pointerup", (e) => {
    if (!invPointerDrag || !invPointerDrag.armed || invPointerDrag.pointerId !== e.pointerId) return;
    finishInvPointerDrag(e);
  });
}

function attachInvSlotCryst(slot, idx) {
  slot.dataset.invIdx = String(idx);
  slot.classList.add("inv-draggable");
  const endPointer = (e) => {
    if (!invPointerDrag || invPointerDrag.pointerId !== e.pointerId) return;
    finishInvPointerDrag(e);
  };
  slot.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || invClickBlocked()) return;
    if (Date.now() - lastWheelAt < 60) return;
    invPointerDrag = {
      idx,
      x: e.clientX,
      y: e.clientY,
      armed: false,
      pointerId: e.pointerId,
    };
  });
  slot.addEventListener("pointerup", endPointer);
  slot.addEventListener("pointercancel", endPointer);
  slot.addEventListener("contextmenu", (e) => {
    const inv = state.inventory || [];
    const it = inv[idx];
    if (!it || isAccessoryItem(it)) return;
    e.preventDefault();
    crystallizeAt(idx);
  });
}

function renderEquippedWeaponSlot(list) {
  if (typeof equippedWeaponItem !== "function") return false;
  const it = equippedWeaponItem();
  if (!it) return false;
  normalizeInvItem(it);
  const w = WMAP[it.id];
  if (!w) return false;
  const p = statAt(w.patk, w.ps, it.plus), m = statAt(w.matk, w.ms, it.plus);
  const ng = w.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(w));
  const block = document.createElement("div");
  block.className = "inv-equipped";
  block.innerHTML = '<div class="inv-equipped-head"><b>Надето</b><span>' +
    (ng ? "Тренировочное NG — не точится" : "Клик — заточка без снятия") + "</span></div>";
  const slot = document.createElement("div");
  slot.className = "inv-slot filled equipped g-" + (w.grade || "NG");
  const gradeTag = w.grade === "NG" ? "NG" : w.grade;
  slot.title =
    w.name + " [" + gradeTag + "]" + (it.plus ? " +" + it.plus : "") +
    (w.grade === "NG" ? "\nТренировочное — не точится" : "") +
    "\nP.Atk " + fmt(p) + " · M.Atk " + fmt(m) +
    "\nНадето на персонаже · клик — заточка";
  slot.innerHTML =
    '<span class="inv-eq-badge">E</span>' +
    '<img src="' + w.icon + '" alt="" loading="lazy" draggable="false" onerror="this.style.visibility=\'hidden\'">' +
    (it.plus ? '<span class="ip">+' + it.plus + "</span>" : "");
  slot.onclick = () => {
    if (invClickBlocked()) return;
    Audio2.click();
    if (ng) {
      toast("«" + w.name + "» без грейда — не точится", "warn");
      return;
    }
    openEnchant(it, { equipped: true });
  };
  block.appendChild(slot);
  const meta = document.createElement("div");
  meta.className = "inv-equipped-meta";
  meta.innerHTML =
    '<span class="g-' + (w.grade || "NG") + '">' + w.name + "</span>" +
    (it.plus ? " +" + it.plus : "") +
    " · " + (typeof weaponEquipStatLabel === "function" ? weaponEquipStatLabel(w, it.plus || 0) : "P.Atk " + fmt(p));
  block.appendChild(meta);
  list.appendChild(block);
  return true;
}

function buildInvTabs(tabId) {
  const tabs = document.createElement("div");
  tabs.className = "inv-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Вкладки инвентаря по грейду");
  INV_TABS.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const gradeClass = t.id !== "all" && t.id !== "epic" ? " g-" + t.id : "";
    const active = tabId === t.id;
    btn.className = "inv-tab" + gradeClass + (active ? " active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", active ? "true" : "false");
    const n = countInvTabItems(t.id);
    btn.innerHTML = t.id !== "all" && n
      ? `${t.label} <span class="inv-tab-n">(${n})</span>`
      : t.label;
    btn.title = t.id === "all"
      ? "Все предметы"
      : t.id === "epic"
        ? "Эпические аксессуары"
        : "Только грейд " + t.label;
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setInvTab(t.id);
      renderInventory();
    };
    tabs.appendChild(btn);
  });
  return tabs;
}

function appendInvEmptySlot(grid) {
  const empty = document.createElement("div");
  empty.className = "inv-slot empty";
  grid.appendChild(empty);
}

function fillInvGrid(grid, tabId, shown) {
  if (tabId === "all") {
    for (let idx = 0; idx < INV_CAP; idx++) {
      const it = shown[idx];
      if (it) appendInvItemSlot(grid, it, idx);
      else appendInvEmptySlot(grid);
    }
    return;
  }
  const packed = shown
    .map((it, idx) => ({ it, idx }))
    .filter((row) => inventoryItemMatchesTab(row.it, tabId));
  for (let i = 0; i < INV_CAP; i++) {
    if (packed[i]) appendInvItemSlot(grid, packed[i].it, packed[i].idx);
    else appendInvEmptySlot(grid);
  }
}

function appendInvItemSlot(grid, it, idx) {
  normalizeInvItem(it);
  const def = invItemDef(it);
  if (!def) {
    appendInvEmptySlot(grid);
    return;
  }
  const slot = document.createElement("div");
  if (isAccessoryItem(it)) {
    slot.className = "inv-slot filled g-epic";
    slot.title = def.name + "\nЭпическая бижутерия · клик — детали · надень в «Персонаж»";
    slot.innerHTML = `<img src="${def.icon}" alt="" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">`;
    slot.onclick = () => { if (invClickBlocked()) return; Audio2.click(); openAccessory(it); };
  } else {
    const w = def;
    const p = statAt(w.patk, w.ps, it.plus), m = statAt(w.matk, w.ms, it.plus);
    const ng = w.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(w));
    slot.className = "inv-slot filled g-" + (w.grade || "NG");
    const gradeTag = w.grade === "NG" ? "NG" : w.grade;
    slot.title = `${w.name} [${gradeTag}]${it.plus ? " +" + it.plus : ""}\nP.Atk ${fmt(p)} · M.Atk ${fmt(m)}` +
      (ng ? "\nNG — клик: продать за " + fmtAdena(typeof sellValue === "function" ? sellValue(w, 0) : 1000) : "\nКлик — заточка · зажми и потяни на кристаллизацию · ПКМ");
    slot.innerHTML = `<img src="${w.icon}" alt="" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">${it.plus ? `<span class="ip">+${it.plus}</span>` : ""}`;
    slot.onclick = () => {
      if (invClickBlocked()) return;
      Audio2.click();
      if (ng) {
        sellNgWeaponFromInventory(it);
        return;
      }
      openEnchant(it);
    };
    if (!ng) attachInvSlotCryst(slot, idx);
  }
  grid.appendChild(slot);
}

function renderInventory() {
  const list = $("#invList"); list.innerHTML = "";
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  const inv = state.inventory || [];
  const tabId = inventoryTabId();
  const sortMode = inventorySortMode();
  if (inv.length > 1) {
    applyInventorySort(sortMode);
  }

  const shown = inv.slice(0, INV_CAP);
  const visible = shown
    .map((it, idx) => ({ it, idx }))
    .filter((row) => inventoryItemMatchesTab(row.it, tabId));

  const bar = document.createElement("div"); bar.className = "inv-bar";
  const title = document.createElement("div");
  title.className = "inv-bar-title";
  const countLabel = tabId !== "all"
    ? `${visible.length} из ${inv.length}/${INV_CAP}`
    : `${inv.length}/${INV_CAP}`;
  title.innerHTML = `Инвентарь <span>(${countLabel})</span>`;
  bar.appendChild(title);
  list.appendChild(bar);

  const res = document.createElement("div");
  res.className = "inv-res";

  const rowCryst = document.createElement("div");
  rowCryst.className = "inv-res-row";
  rowCryst.innerHTML = '<span class="cl">Кристаллы:</span>';
  ["D", "C", "B", "A"].forEach((g) => {
    rowCryst.innerHTML +=
      `<span class="cr" title="Crystal (${g}-Grade)">` +
      `<img class="cicon" src="${CRYSTAL_ICON[g]}" alt="${g}">` +
      `<span class="cr-meta"><span class="cr-lbl" style="color:${CRYSTAL_COLOR[g]}">${g}</span><b>${fmt(state.crystals[g] || 0)}</b></span></span>`;
  });
  const tv = crystalsTotalValue();
  const sbtn = document.createElement("button");
  sbtn.className = "cryst-sell";
  sbtn.disabled = tv <= 0;
  sbtn.textContent = "Продать все · " + fmtAdena(tv);
  sbtn.onclick = sellCrystals;
  rowCryst.appendChild(sbtn);
  res.appendChild(rowCryst);

  ensureWorkshopState();
  const rowOre = document.createElement("div");
  rowOre.className = "inv-res-row";
  rowOre.innerHTML = '<span class="cl">Руда:</span>';
  ["soul", "spirit"].forEach((ty) => {
    const o = ORE[ty];
    const short = ty === "soul" ? "Soul" : "Spirit";
    rowOre.innerHTML +=
      `<span class="cr" title="${o.name}">` +
      `<img class="cicon" src="${o.icon}" alt="">` +
      `<span class="cr-meta"><span class="cr-lbl">${short}</span><b>${fmt(state.materials[ty] || 0)}</b></span></span>`;
  });
  res.appendChild(rowOre);
  list.appendChild(res);

  const cz = document.createElement("div");
  cz.className = "inv-crystallize";
  cz.id = "invCrystallize";
  cz.innerHTML = `<div class="inv-crystallize-slot"><img class="inv-crystallize-ico" src="${CRYSTALLIZE_ICON.normal}" alt="" draggable="false"></div>` +
    `<div class="inv-crystallize-text"><b>Кристаллизация</b><span>Зажми оружие и потяни на иконку · или ПКМ по слоту</span></div>`;
  attachCrystallizeZone(cz);
  list.appendChild(cz);

  const hasEquipped = renderEquippedWeaponSlot(list);

  if (!inv.length && !hasEquipped) {
    const e = document.createElement("div"); e.className = "empty";
    e.innerHTML = "Инвентарь пуст.<br>Добудь оружие в <b>задании</b> — лови цели на поле.";
    list.appendChild(e); return;
  }

  if (!inv.length && hasEquipped) {
    const e = document.createElement("div"); e.className = "empty inv-empty-note";
    e.innerHTML = "В сумке пусто — тренировочное оружие надето. Добывай D+ в задании.";
    list.appendChild(e);
  }

  if (!inv.length) return;

  const gridPanel = document.createElement("div");
  gridPanel.className = "inv-grid-panel";
  gridPanel.appendChild(buildInvTabs(tabId));

  const grid = document.createElement("div");
  grid.className = "inv-grid";
  fillInvGrid(grid, tabId, shown);
  gridPanel.appendChild(grid);
  list.appendChild(gridPanel);
}

async function sellNgWeaponFromInventory(it) {
  if (!it || isAccessoryItem(it)) return;
  const w = WMAP[it.id];
  if (!w || (typeof isNgSellWeapon === "function" && !isNgSellWeapon(w))) return;
  if (typeof isEquippedWeaponItem === "function" && isEquippedWeaponItem(it)) {
    toast("Сначала сними оружие в «Персонаж»", "warn");
    return;
  }
  const sv = typeof sellValue === "function" ? sellValue(w, it.plus || 0) : 1000;
  const ok = await showConfirm({
    title: "Продать NG",
    message: "Продать «" + w.name + "» за " + fmtAdena(sv) + " adena?\nТренировочное оружие исчезнет из инвентаря.",
    okText: "Продать",
    cancelText: "Отмена",
  });
  if (!ok) return;
  ProgressStore.set("inventory", (state.inventory || []).filter((x) => x.uid !== it.uid));
  ProgressStore.update("adena", (a) => (a || 0) + sv);
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + sv }));
  // NG не считается «заточенным» — ачивка seller / weaponsSold только для грейдового.
  Audio2.success();
  save();
  $("#adena").textContent = fmt(state.adena);
  renderInventory();
  toast("Продано «" + w.name + "» за " + fmt(sv) + " adena", "gold");
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("sell_weapon", {
      weaponId: w.id,
      weaponName: w.name,
      grade: "NG",
      plus: 0,
      adenaGain: sv,
    });
  }
  if (typeof noteLeaderboardEvent === "function") noteLeaderboardEvent("sell");
  if (typeof checkAchievements === "function") checkAchievements();
}

function sellCrystals() {
  const total = crystalsTotalValue();
  if (total <= 0) { toast("Нет кристаллов на продажу"); return; }
  ProgressStore.set("crystals", { D: 0, C: 0, B: 0, A: 0 });
  ProgressStore.update("adena", (a) => (a || 0) + total);
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + total }));
  if (typeof achStat === "function") achStat("crystalsSold", 1);
  Audio2.coin(); save();
  $("#adena").textContent = fmt(state.adena);
  renderInventory();
  toast("Кристаллы проданы за " + fmt(total) + " adena", "gold");
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("sell_crystals", { adenaGain: total });
  }
  if (typeof checkAchievements === "function") checkAchievements();
}

