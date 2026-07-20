// ===== Инвентарь игрока =====
function inventoryCount() {
  return state.inventory ? state.inventory.length : 0;
}

function isInventoryFull() {
  return inventoryCount() >= INV_CAP;
}

function trimInventoryToCap() {
  if (!state.inventory || state.inventory.length <= INV_CAP) return false;
  state.inventory = state.inventory.slice(0, INV_CAP);
  save();
  return true;
}

function addToInventory(weaponId, meta) {
  if (!state.inventory) state.inventory = [];
  if (isInventoryFull()) {
    toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
  const it = { uid: uid(), id: weaponId, plus: 0, spent: 0 };
  state.inventory.push(it);
  if (isInventoryFull() && typeof achStat === "function") achStat("invFullOnce", 1);
  save();
  renderMenu();
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof logCharacterEvent === "function") {
    const w = WMAP[weaponId];
    logCharacterEvent("loot_weapon", {
      weaponId,
      weaponName: w?.name || weaponId,
      grade: w?.grade || null,
      plus: meta?.plus != null ? Math.max(0, Math.floor(Number(meta.plus) || 0)) : 0,
      source: meta?.source || "unknown",
      zoneId: meta?.zoneId || state.farmZone || null,
    });
  }
  return it;
}

function invItemDef(it) {
  if (!it) return null;
  if (it.kind === "accessory" || COLLECTIBLES[it.id]) return COLLECTIBLES[it.id];
  return WMAP[it.id] || null;
}

function isAccessoryItem(it) {
  return !!(it && (it.kind === "accessory" || COLLECTIBLES[it.id]));
}

function addCollectibleToInventory(collectibleId) {
  const def = COLLECTIBLES[collectibleId];
  if (!def) return null;
  if (!state.inventory) state.inventory = [];
  if (isInventoryFull()) {
    toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
  const it = { uid: uid(), id: collectibleId, kind: "accessory" };
  state.inventory.push(it);
  save();
  renderMenu();
  return it;
}

function grantCollectible(id, qty) {
  const def = COLLECTIBLES[id];
  if (!def) return null;
  qty = Math.max(1, qty | 0);
  let added = 0;
  for (let i = 0; i < qty; i++) {
    if (!addCollectibleToInventory(id)) break;
    added++;
  }
  if (added > 0 && typeof checkAchievements === "function") checkAchievements();
  return added > 0 ? def : null;
}

function collectibleCount(id) {
  return (state.inventory || []).filter((it) => it.id === id && isAccessoryItem(it)).length;
}

function migrateCollectiblesToInventory() {
  if (!state.collectibles) return;
  let changed = false;
  Object.keys(COLLECTIBLES).forEach((id) => {
    let n = state.collectibles[id] || 0;
    while (n > 0) {
      if (!addCollectibleToInventory(id)) {
        if (n > 0) state.collectibles[id] = n;
        changed = true;
        return;
      }
      n--;
      changed = true;
    }
    if (state.collectibles[id] != null) {
      delete state.collectibles[id];
      changed = true;
    }
  });
  if (changed) save();
}

function normalizeInvItem(it) {
  if (!it) return it;
  if (isAccessoryItem(it)) return it;
  if (it.spent == null) it.spent = 0;
  if (it.max != null) {
    bumpWeaponRecord(it.id, it.max);
    delete it.max;
  } else if ((it.plus || 0) > weaponRecord(it.id)) {
    bumpWeaponRecord(it.id, it.plus);
  }
  return it;
}

function openInventory() { renderInventory(); show("inv"); Audio2.open(); }
function goInventory() { renderInventory(); renderMenu(); show("inv"); }

let dragSrc = null;
/** @type {{ idx: number, t: number, x: number, y: number } | null} */
let dragMeta = null;
let lastWheelAt = 0;

document.addEventListener(
  "wheel",
  () => {
    lastWheelAt = Date.now();
    if (dragSrc == null && !dragMeta) return;
    dragSrc = null;
    dragMeta = null;
    $$(".inv-slot.dragover,.inv-slot.dragging").forEach((s) => s.classList.remove("dragover", "dragging"));
    const cz = document.getElementById("invCrystallize");
    if (cz) setCrystallizeIco(cz, "normal");
  },
  { passive: true, capture: true }
);

function clearInvDragUi() {
  dragSrc = null;
  dragMeta = null;
  $$(".inv-slot.dragover,.inv-slot.dragging").forEach((s) => s.classList.remove("dragover", "dragging"));
  const cz = document.getElementById("invCrystallize");
  if (cz) setCrystallizeIco(cz, "normal");
}

/** Скролл/жест трекпада часто стартует «ложный» HTML5-drag — отсекаем. */
function isAccidentalInvDrag(e) {
  if (Date.now() - lastWheelAt < 220) return true;
  if (!dragMeta) return true;
  if (Date.now() - dragMeta.t < 140) return true;
  const x = e && typeof e.clientX === "number" ? e.clientX : dragMeta.x;
  const y = e && typeof e.clientY === "number" ? e.clientY : dragMeta.y;
  const dx = x - dragMeta.x;
  const dy = y - dragMeta.y;
  return dx * dx + dy * dy < 100; // <10px — не считаем переносом
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
  state.inventory = inv.filter((x) => x.uid !== it.uid);
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  state.crystals[grade] = (state.crystals[grade] || 0) + yld;
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

function dragIndexFromEvent(e) {
  if (dragSrc != null) return dragSrc;
  try {
    const dt = e.dataTransfer;
    if (!dt) return null;
    const raw = dt.getData("application/x-soulforge-inv") || dt.getData("text/plain");
    if (raw === "" || raw == null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch (_) {
    return null;
  }
}

function attachCrystallizeZone(zone) {
  setCrystallizeIco(zone, "normal");
  zone.addEventListener("mouseenter", () => { if (dragSrc == null) setCrystallizeIco(zone, "over"); });
  zone.addEventListener("mouseleave", () => { if (dragSrc == null) setCrystallizeIco(zone, "normal"); });
  const allowDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    setCrystallizeIco(zone, "drag");
  };
  zone.addEventListener("dragenter", allowDrop);
  zone.addEventListener("dragover", allowDrop);
  zone.addEventListener("dragleave", (e) => {
    if (zone.contains(e.relatedTarget)) return;
    setCrystallizeIco(zone, "normal");
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    setCrystallizeIco(zone, "normal");
    const idx = dragIndexFromEvent(e);
    const accidental = isAccidentalInvDrag(e);
    clearInvDragUi();
    if (idx == null || accidental) return;
    const inv = state.inventory || [];
    const it = inv[idx];
    if (!it) return;
    if (isAccessoryItem(it)) {
      toast("Аксессуары нельзя кристаллизовать", "warn");
      return;
    }
    crystallizeAt(idx);
  });
}

function reorderInventory(from, to) {
  const inv = state.inventory; if (!inv || from == null) return;
  if (to === "end") {
    if (from >= inv.length - 1) return;
    const [m] = inv.splice(from, 1); inv.push(m);
  } else {
    if (to === from) return;
    const a = inv[from]; inv[from] = inv[to]; inv[to] = a;
  }
  save(); renderInventory();
}

function attachDnD(slot, idx) {
  slot.setAttribute("draggable", "true");
  slot.draggable = true;
  slot.addEventListener("dragstart", (e) => {
    // Двухпальцевый скролл на Mac часто стартует drag — отменяем
    if (Date.now() - lastWheelAt < 220) {
      e.preventDefault();
      clearInvDragUi();
      return;
    }
    dragSrc = idx;
    dragMeta = { idx, t: Date.now(), x: e.clientX || 0, y: e.clientY || 0 };
    slot.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.setData("application/x-soulforge-inv", String(idx));
    } catch (_) {}
  });
  slot.addEventListener("dragend", () => {
    clearInvDragUi();
  });
  slot.addEventListener("dragover", (e) => {
    e.preventDefault();
    slot.classList.add("dragover");
  });
  slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
  slot.addEventListener("drop", (e) => {
    e.preventDefault();
    slot.classList.remove("dragover");
    const from = dragIndexFromEvent(e);
    const accidental = isAccidentalInvDrag(e);
    clearInvDragUi();
    if (from == null || accidental) return;
    reorderInventory(from, idx);
  });
  // ПКМ / двухпальцевый клик Mac → кристаллизация (с подтверждением).
  // Обычный скролл сюда не попадает; drag-на-зону защищён isAccidentalInvDrag.
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
    if (dragSrc != null) return;
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
    " · P.Atk " + fmt(p);
  block.appendChild(meta);
  list.appendChild(block);
  return true;
}

function renderInventory() {
  const list = $("#invList"); list.innerHTML = "";
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  const inv = state.inventory || [];
  const bar = document.createElement("div"); bar.className = "inv-bar";
  bar.innerHTML = `Инвентарь <span>(${inv.length}/${INV_CAP})</span>`;
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
    `<div class="inv-crystallize-text"><b>Кристаллизация</b><span>Перетащи оружие на иконку или ПКМ по слоту — разобьётся в кристаллы</span></div>`;
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

  const grid = document.createElement("div"); grid.className = "inv-grid";
  const shown = inv.slice(0, INV_CAP);
  shown.forEach((it, idx) => {
    normalizeInvItem(it);
    const def = invItemDef(it);
    if (!def) return;
    const slot = document.createElement("div");
    if (isAccessoryItem(it)) {
      slot.className = "inv-slot filled g-epic";
      slot.setAttribute("draggable", "true");
      slot.draggable = true;
      slot.title = def.name + "\nЭпическая бижутерия · клик — детали · надень в «Персонаж»";
      slot.innerHTML = `<img src="${def.icon}" alt="" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">`;
      slot.onclick = () => { if (dragSrc != null) return; Audio2.click(); openAccessory(it); };
    } else {
      const w = def;
      const p = statAt(w.patk, w.ps, it.plus), m = statAt(w.matk, w.ms, it.plus);
      const ng = w.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(w));
      slot.className = "inv-slot filled g-" + (w.grade || "NG");
      if (ng) {
        slot.draggable = false;
        slot.removeAttribute("draggable");
      } else {
        slot.setAttribute("draggable", "true");
        slot.draggable = true;
      }
      const gradeTag = w.grade === "NG" ? "NG" : w.grade;
      slot.title = `${w.name} [${gradeTag}]${it.plus ? " +" + it.plus : ""}\nP.Atk ${fmt(p)} · M.Atk ${fmt(m)}` +
        (ng ? "\nБез грейда — не точится" : "\nКлик — заточка · перетащи / ПКМ — кристаллизация");
      slot.innerHTML = `<img src="${w.icon}" alt="" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">${it.plus ? `<span class="ip">+${it.plus}</span>` : ""}`;
      slot.onclick = () => {
        if (dragSrc != null) return;
        Audio2.click();
        if (ng) {
          toast("«" + w.name + "» без грейда — не точится", "warn");
          return;
        }
        openEnchant(it);
      };
    }
    if (slot.getAttribute("draggable") === "true" || slot.draggable === true) attachDnD(slot, idx);
    grid.appendChild(slot);
  });
  for (let i = shown.length; i < INV_CAP; i++) {
    const empty = document.createElement("div"); empty.className = "inv-slot empty";
    empty.addEventListener("dragover", (e) => { if (dragSrc == null) return; e.preventDefault(); empty.classList.add("dragover"); });
    empty.addEventListener("dragleave", () => empty.classList.remove("dragover"));
    empty.addEventListener("drop", (e) => {
      e.preventDefault(); empty.classList.remove("dragover");
      const from = dragSrc;
      const accidental = isAccidentalInvDrag(e);
      clearInvDragUi();
      if (from == null || accidental || isInventoryFull()) return;
      reorderInventory(from, "end");
    });
    grid.appendChild(empty);
  }
  list.appendChild(grid);
}

function sellCrystals() {
  const total = crystalsTotalValue();
  if (total <= 0) { toast("Нет кристаллов на продажу"); return; }
  ["D", "C", "B", "A"].forEach((g) => { state.crystals[g] = 0; });
  state.adena += total; state.totals.earned = (state.totals.earned || 0) + total;
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
