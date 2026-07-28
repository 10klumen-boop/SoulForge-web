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

function invGearSlotUnderPoint(e) {
  if (!e) return null;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || typeof el.closest !== "function") return null;
  return el.closest(".inv-gear-slot:not(.is-stub)");
}

function clearInvGearDropHints() {
  document.querySelectorAll(".inv-gear-slot.drop-ok, .inv-gear-slot.drop-no, .inv-gear-slot.drop-over").forEach((s) => {
    s.classList.remove("drop-ok", "drop-no", "drop-over");
  });
}

function updateInvGearDropHover(e) {
  if (!invPointerDrag || !invPointerDrag.armed) return;
  const inv = state.inventory || [];
  const it = inv[invPointerDrag.idx];
  clearInvGearDropHints();
  if (!it || typeof slotAcceptsItem !== "function") return;
  document.querySelectorAll("#invPaperdoll .inv-gear-slot:not(.is-stub)").forEach((slotEl) => {
    const sid = slotEl.dataset.slot;
    if (!sid) return;
    if (slotAcceptsItem(sid, it)) slotEl.classList.add("drop-ok");
    else slotEl.classList.add("drop-no");
  });
  const over = invGearSlotUnderPoint(e);
  if (over) over.classList.add("drop-over");
}

function tryEquipFromInvDrag(e, invIdx) {
  const over = invGearSlotUnderPoint(e);
  if (!over) return false;
  const slotId = over.dataset.slot;
  const inv = state.inventory || [];
  const it = inv[invIdx];
  if (!slotId || !it) return false;
  if (typeof slotAcceptsItem !== "function" || !slotAcceptsItem(slotId, it)) {
    const slotMeta = typeof AVATAR_GEAR_SLOTS !== "undefined"
      ? AVATAR_GEAR_SLOTS.find((s) => s.id === slotId)
      : null;
    const need = slotMeta?.armor
      ? "сюда только " + (slotMeta.label || slotId).toLowerCase()
      : slotId === "weapon"
        ? "сюда только оружие"
        : "предмет не подходит";
    toast("Нельзя надеть: " + need, "warn");
    return true;
  }
  if (typeof equipAvatarSlot === "function") equipAvatarSlot(slotId, it);
  return true;
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
  updateInvGearDropHover(e);
}

function finishInvPointerDrag(e) {
  const pd = invPointerDrag;
  invPointerDrag = null;
  dragSrc = null;
  if (pd && pd.armed) {
    invSuppressClickUntil = Date.now() + 320;
    const inv = state.inventory || [];
    const it = inv[pd.idx];
    if (e && tryEquipFromInvDrag(e, pd.idx)) {
      /* equipped or rejected with toast */
    } else {
      const cz = invCrystallizeZone();
      if (cz && e && pointInElement(e, cz)) {
        if (it && canCrystallizeInventoryItem(it)) {
          crystallizeAt(pd.idx);
        }
      }
    }
  }
  clearInvDragUi();
}

function invDragPreferScroll(e, dx, dy) {
  // На таче вертикальный жест — скролл экрана, не drag слота.
  if (e.pointerType && e.pointerType !== "touch") return false;
  try {
    if (typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches && e.pointerType === "mouse") {
      return false;
    }
  } catch (_) {}
  return Math.abs(dy) >= Math.abs(dx);
}

document.addEventListener("pointermove", (e) => {
  if (!invPointerDrag || invPointerDrag.pointerId !== e.pointerId) return;
  if (invPointerDrag.armed) {
    e.preventDefault();
    moveInvDragGhost(e);
    updateInvCrystHover(e);
    updateInvGearDropHover(e);
    return;
  }
  const dx = e.clientX - invPointerDrag.x;
  const dy = e.clientY - invPointerDrag.y;
  if (dx * dx + dy * dy < 36) return;
  if (invDragPreferScroll(e, dx, dy)) {
    clearInvDragUi();
    return;
  }
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
  clearInvGearDropHints();
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

function canCrystallizeInventoryItem(it) {
  if (!it) return false;
  if (typeof isShardItem === "function" && isShardItem(it)) return false;
  if (isAccessoryItem(it)) {
    const def =
      typeof accessoryDef === "function"
        ? accessoryDef(it)
        : typeof COLLECTIBLES !== "undefined"
          ? COLLECTIBLES[it.id]
          : null;
    if (!def || def.epic) return false;
    if (!def.grade || def.grade === "NG") return false;
    return true;
  }
  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    const def =
      typeof armorItemDef === "function"
        ? armorItemDef(it)
        : typeof AMAP !== "undefined"
          ? AMAP[it.id]
          : null;
    return !!(def && def.grade && def.grade !== "NG");
  }
  const w = typeof WMAP !== "undefined" ? WMAP[it.id] : null;
  if (!w) return false;
  if (typeof weaponCanEnchant === "function" && !weaponCanEnchant(w)) return false;
  return !!(w.grade && w.grade !== "NG");
}

async function crystallizeAt(idx) {
  const inv = state.inventory || [];
  const it = inv[idx];
  if (!it) return;
  if (typeof isShardItem === "function" && isShardItem(it)) return;
  if (typeof isItemEquipped === "function" && isItemEquipped(it.uid)) {
    toast("Сначала сними предмет", "warn");
    return;
  }

  const isAcc = isAccessoryItem(it);
  const isArmor = !isAcc && typeof isArmorItem === "function" && isArmorItem(it);
  let def = null;
  let kind = "weapon";
  if (isAcc) {
    def =
      typeof accessoryDef === "function"
        ? accessoryDef(it)
        : typeof COLLECTIBLES !== "undefined"
          ? COLLECTIBLES[it.id]
          : null;
    kind = "accessory";
    if (!def) return;
    if (def.epic) {
      toast("Эпическую бижутерию нельзя кристаллизовать", "warn");
      return;
    }
  } else if (isArmor) {
    def =
      typeof armorItemDef === "function"
        ? armorItemDef(it)
        : typeof AMAP !== "undefined"
          ? AMAP[it.id]
          : null;
    kind = "armor";
  } else {
    def = typeof WMAP !== "undefined" ? WMAP[it.id] : null;
    kind = "weapon";
  }
  if (!def) return;
  if (!isAcc && !isArmor && typeof weaponCanEnchant === "function" && !weaponCanEnchant(def)) {
    toast("«" + def.name + "» без грейда — не кристаллизуется", "warn");
    return;
  }
  if (!def.grade || def.grade === "NG") {
    toast("«" + def.name + "» без грейда — не кристаллизуется", "warn");
    return;
  }
  const plus = isArmor || isAcc ? (isArmor ? it.plus || 0 : 0) : it.plus || 0;
  const yld = crystalYield(def, plus);
  const grade = def.grade;
  const plusStr = plus ? " +" + plus : "";
  const ok = await showConfirm({
    title: "Кристаллизация",
    html: `<div class="modal-cryst">
      <img class="modal-cryst-wpn" src="${def.icon}" alt="">
      <div class="modal-cryst-info">
        <div class="modal-cryst-name g-${grade}">${def.name}${plusStr}</div>
        <div class="modal-cryst-warn">Предмет будет уничтожен без возврата.</div>
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
  if (typeof afterInventorySpaceFreed === "function") afterInventorySpaceFreed();
  Audio2.coin();
  save();
  if (typeof flushCloudSave === "function") flushCloudSave({ force: true });
  toast("Кристаллизация: " + def.name + plusStr + " → +" + yld + " крист. (" + grade + ")", "loot");
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("crystallize", {
      itemId: def.id,
      itemName: def.name,
      kind,
      weaponId: kind === "weapon" ? def.id : undefined,
      weaponName: kind === "weapon" ? def.name : undefined,
      grade,
      plus,
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

function attachInvItemDrag(slot, idx, opts) {
  opts = opts || {};
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
  if (opts.crystallize) {
    slot.addEventListener("contextmenu", (e) => {
      const inv = state.inventory || [];
      const it = inv[idx];
      if (!it || !canCrystallizeInventoryItem(it)) return;
      e.preventDefault();
      crystallizeAt(idx);
    });
  }
}

function attachInvSlotCryst(slot, idx) {
  attachInvItemDrag(slot, idx, { crystallize: true });
}

function buildInvTabs(tabId) {
  const tabs = document.createElement("div");
  tabs.className = "inv-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Вкладки инвентаря по типу");
  INV_TABS.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const active = tabId === t.id;
    btn.className = "inv-tab inv-tab-" + t.id + (active ? " active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", active ? "true" : "false");
    const n = countInvTabItems(t.id);
    btn.innerHTML = t.id !== "all" && n
      ? t.label + ' <span class="inv-tab-n">(' + n + ")</span>"
      : t.label;
    const titles = {
      all: "Все предметы сумки",
      weapon: "Оружие",
      armor: "Броня",
      accessory: "Бижутерия",
      frag: "Куски брони (Material)",
      shot: "Soulshot / Spiritshot",
      crystal: "Кристаллы",
      ore: "Soul Ore / Spirit Ore",
    };
    btn.title = titles[t.id] || t.label;
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

function appendInvStackSlot(grid, opts) {
  const slot = document.createElement("div");
  const gClass = opts.gradeClass ? " " + opts.gradeClass : "";
  slot.className = "inv-slot filled inv-stack" + gClass;
  const tipOpts = {
    name: opts.name,
    icon: opts.icon,
    qty: opts.qty,
    badge: opts.badge,
    gradeClass: opts.badge ? "g-" + String(opts.badge) : "",
    kind: opts.kind || "Стек",
    role: opts.role || "",
    extra: opts.extra || "",
    actions: opts.actions || [],
  };
  const plain =
    typeof itemTooltipPlainFromStack === "function"
      ? itemTooltipPlainFromStack(tipOpts)
      : opts.title || opts.name || "";
  const ico = opts.icon
    ? '<img src="' + opts.icon + '" alt="" loading="lazy" draggable="false" onerror="this.style.visibility=\'hidden\'">'
    : "";
  const qty = opts.qty > 0 ? '<span class="inv-stack-qty">×' + fmt(opts.qty) + "</span>" : "";
  const lbl = opts.badge ? '<span class="inv-stack-badge">' + opts.badge + "</span>" : "";
  slot.innerHTML = ico + qty + lbl;
  if (opts.onclick) slot.onclick = opts.onclick;
  if (typeof wireItemTooltip === "function") {
    wireItemTooltip(
      slot,
      () =>
        typeof itemTooltipHtmlFromStack === "function"
          ? itemTooltipHtmlFromStack(tipOpts)
          : "",
      plain
    );
  } else if (plain) {
    slot.title = plain;
  }
  grid.appendChild(slot);
}

function fillInvResourceGrid(grid, tabId) {
  let filled = 0;
  const cap = typeof INV_CAP === "number" ? INV_CAP : 120;
  let hasStacks = false;

  function note(text) {
    const e = document.createElement("div");
    e.className = "empty inv-empty-note";
    e.textContent = text;
    grid.appendChild(e);
  }

  if (tabId === "frag") {
    const stacks = typeof listFragStacks === "function" ? listFragStacks() : listArmorFragStacks();
    if (!stacks.length) {
      note("Нет кусков. Фарми Свалку (D) / Кузницу (C) — броня и бижутерия.");
    } else {
      hasStacks = true;
      stacks.forEach((row) => {
        const isJewel = row.kind === "jewelry";
        appendInvStackSlot(grid, {
          name: row.def.name,
          icon: row.def.icon,
          qty: row.qty,
          kind: isJewel ? "Кусок бижутерии" : "Кусок брони",
          role: isJewel
            ? "Крафт в Мастерской → Бижутерия"
            : "Крафт в Мастерской → Броня",
        });
        filled++;
      });
    }
  } else if (tabId === "scroll") {
    const stacks = typeof listScrollStacks === "function" ? listScrollStacks() : [];
    if (!stacks.length) {
      note("Нет свитков. Фарми зоны или купи на рынке у игроков.");
    } else {
      hasStacks = true;
      stacks.forEach((row) => {
        appendInvStackSlot(grid, {
          name: row.name,
          icon: row.icon,
          qty: row.qty,
          badge: row.grade,
          gradeClass: "g-" + row.grade + " inv-scroll",
          kind: "Свиток заточки",
          role:
            "Заточка " +
            (row.target === "armor" ? "брони / бижутерии" : "оружия"),
        });
        filled++;
      });
    }
  } else if (tabId === "shot") {
    const stacks = listShotStacks();
    if (!stacks.length) note("Нет зарядов. Крафти в Мастерской → Заряды.");
    else {
      hasStacks = true;
      stacks.forEach((row) => {
        const icon =
          (typeof SHOT_ICON !== "undefined" && SHOT_ICON[row.kind] && SHOT_ICON[row.kind][row.grade]) ||
          row.icon ||
          "";
        appendInvStackSlot(grid, {
          name: row.name,
          icon,
          qty: row.qty,
          badge: row.grade,
          gradeClass: "g-" + row.grade,
          kind: "Заряд",
          role: "Автоудар / бой",
        });
        filled++;
      });
    }
  } else if (tabId === "crystal") {
    const stacks = listCrystalStacks();
    if (!stacks.length) note("Нет кристаллов. Кристаллизуй оружие, броню или бижутерию D/C.");
    else {
      hasStacks = true;
      stacks.forEach((row) => {
        appendInvStackSlot(grid, {
          name: "Crystal " + row.grade,
          icon: row.icon,
          qty: row.qty,
          badge: row.grade,
          gradeClass: "g-" + row.grade,
          kind: "Кристалл",
          role: "Крафт и обмен",
        });
        filled++;
      });
    }
  } else if (tabId === "ore") {
    const stacks = listOreStacks();
    if (!stacks.length) note("Нет руды. Добывай на поле и за квесты.");
    else {
      hasStacks = true;
      stacks.forEach((row) => {
        appendInvStackSlot(grid, {
          name: row.name,
          icon: row.icon,
          qty: row.qty,
          kind: "Руда",
          role: "Крафт зарядов и рецептов",
        });
        filled++;
      });
    }
  }

  // Пустые ячейки — только когда есть стаки (иначе одна заметка на всю сетку)
  if (hasStacks) {
    for (let i = filled; i < cap; i++) appendInvEmptySlot(grid);
  }

  if (tabId === "crystal") {
    const sellWrap = document.createElement("div");
    sellWrap.className = "inv-res-actions";
    const tv = typeof crystalsTotalValue === "function" ? crystalsTotalValue() : 0;
    const sbtn = document.createElement("button");
    sbtn.type = "button";
    sbtn.className = "cryst-sell";
    sbtn.disabled = tv <= 0;
    sbtn.textContent = "Продать все · " + fmtAdena(tv);
    sbtn.onclick = sellCrystals;
    sellWrap.appendChild(sbtn);
    grid.appendChild(sellWrap);
  }
}

function fillInvGrid(grid, tabId, shown) {
  if (typeof isInvResourceTab === "function" && isInvResourceTab(tabId)) {
    fillInvResourceGrid(grid, tabId);
    return;
  }
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
  const wireTip = () => {
    if (typeof wireItemTooltip !== "function") return;
    wireItemTooltip(
      slot,
      () =>
        typeof itemTooltipHtmlFromInvItem === "function"
          ? itemTooltipHtmlFromInvItem(it)
          : "",
      typeof itemTooltipPlainFromInvItem === "function"
        ? itemTooltipPlainFromInvItem(it)
        : def.name || ""
    );
  };
  if (typeof isShardItem === "function" && isShardItem(it)) {
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    slot.className = "inv-slot filled g-D";
    slot.innerHTML =
      '<img src="' +
      def.icon +
      '" alt="" loading="lazy" draggable="false" onerror="this.style.visibility=\'hidden\'">' +
      (qty > 1 ? '<span class="ip">×' + qty + "</span>" : "");
    slot.onclick = () => {
      if (invClickBlocked()) return;
      Audio2.click();
      if (typeof toast === "function") toast(def.name + " ×" + qty + " · крафт в Мастерской", "info");
    };
    wireTip();
  } else if (isAccessoryItem(it)) {
    const gKey = typeof inventoryItemGradeKey === "function" ? inventoryItemGradeKey(it) : (def.epic ? "epic" : def.grade || "epic");
    const isEpic = !!def.epic;
    slot.className = "inv-slot filled g-" + gKey;
    const canCry = canCrystallizeInventoryItem(it);
    slot.innerHTML = `<img src="${def.icon}" alt="" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">${it.plus ? `<span class="ip">+${it.plus}</span>` : ""}`;
    slot.onclick = () => {
      if (invClickBlocked()) return;
      Audio2.click();
      if (isEpic) {
        openAccessory(it);
        return;
      }
      if (typeof openEnchant === "function") openEnchant(it);
    };
    attachInvItemDrag(slot, idx, canCry ? { crystallize: true } : {});
    wireTip();
  } else if (typeof isArmorItem === "function" && isArmorItem(it)) {
    slot.className = "inv-slot filled g-" + (def.grade || "C");
    slot.innerHTML = `<img src="${def.icon}" alt="" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">${it.plus ? `<span class="ip">+${it.plus}</span>` : ""}`;
    slot.onclick = () => {
      if (invClickBlocked()) return;
      Audio2.click();
      if (typeof openEnchant === "function") openEnchant(it);
    };
    attachInvItemDrag(slot, idx, { crystallize: true });
    wireTip();
  } else {
    const w = def;
    const ng = w.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(w));
    slot.className = "inv-slot filled g-" + (w.grade || "NG");
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
    if (ng) attachInvItemDrag(slot, idx);
    else attachInvSlotCryst(slot, idx);
    wireTip();
  }
  grid.appendChild(slot);
}

function appendInvCrystallizeFooter(list) {
  const cz = document.createElement("div");
  cz.className = "inv-crystallize inv-crystallize-footer";
  cz.id = "invCrystallize";
  cz.innerHTML =
    '<div class="inv-crystallize-slot"><img class="inv-crystallize-ico" src="' +
    CRYSTALLIZE_ICON.normal +
    '" alt="" draggable="false"></div>' +
    '<div class="inv-crystallize-text"><b>Кристаллизация</b><span>Тяни оружие, броню или бижу D/C · ПКМ по предмету</span></div>';
  attachCrystallizeZone(cz);
  list.appendChild(cz);
}

function renderInventory() {
  const list = $("#invList");
  if (!list) return;
  if (typeof hideItemTip === "function") hideItemTip();
  list.innerHTML = "";
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  const inv = state.inventory || [];
  const tabId = inventoryTabId();
  const sortMode = inventorySortMode();
  if (inv.length > 1) applyInventorySort(sortMode);

  const shown = inv.slice(0, INV_CAP);
  const resourceTab = typeof isInvResourceTab === "function" && isInvResourceTab(tabId);
  const visible = resourceTab
    ? []
    : shown.map((it, idx) => ({ it, idx })).filter((row) => inventoryItemMatchesTab(row.it, tabId));

  if (typeof renderGearPaperdoll === "function") {
    renderGearPaperdoll(document.getElementById("invPaperdoll"));
  }

  const scroll = document.createElement("div");
  scroll.className = "inv-bag-scroll sf-scroll";

  const overflowN = typeof overflowLootCount === "function" ? overflowLootCount() : 0;
  if (overflowN > 0) {
    const banner = document.createElement("button");
    banner.type = "button";
    banner.className = "inv-overflow-banner";
    banner.innerHTML =
      "<b>Отложенный лут</b> · " +
      overflowN +
      " шт. — нажми, чтобы забрать в сумку";
    banner.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      if (typeof flushOverflowLoot === "function") flushOverflowLoot({ silent: false });
      renderInventory();
    };
    scroll.appendChild(banner);
  }

  const bar = document.createElement("div");
  bar.className = "inv-bar";
  const title = document.createElement("div");
  title.className = "inv-bar-title";
  let countLabel;
  if (resourceTab) {
    const n = countInvTabItems(tabId);
    countLabel = n ? String(n) : "пусто";
  } else if (tabId !== "all") {
    countLabel = visible.length + " из " + inv.length + "/" + INV_CAP;
  } else {
    countLabel = inv.length + "/" + INV_CAP;
  }
  title.innerHTML = "Сумка <span>(" + countLabel + ")</span>";
  bar.appendChild(title);
  scroll.appendChild(bar);

  const gridPanel = document.createElement("div");
  gridPanel.className = "inv-grid-panel";
  gridPanel.appendChild(buildInvTabs(tabId));

  if (resourceTab) {
    const grid = document.createElement("div");
    grid.className = "inv-grid inv-grid-res";
    fillInvGrid(grid, tabId, shown);
    gridPanel.appendChild(grid);
    scroll.appendChild(gridPanel);
    list.appendChild(scroll);
    appendInvCrystallizeFooter(list);
    return;
  }

  const hasEquipped = typeof equippedWeaponItem === "function" && !!equippedWeaponItem();
  if (!inv.length && !hasEquipped) {
    const e = document.createElement("div");
    e.className = "empty";
    e.innerHTML = "Сумка пуста.<br>Добудь оружие в <b>задании</b> — лови цели на поле.";
    scroll.appendChild(e);
  } else if (!inv.length && hasEquipped) {
    const e = document.createElement("div");
    e.className = "empty inv-empty-note";
    e.innerHTML = "В сумке пусто — оружие надето слева. Добывай D+ в задании.";
    scroll.appendChild(e);
  } else if (tabId !== "all" && !visible.length) {
    const e = document.createElement("div");
    e.className = "empty inv-empty-note";
    const labels = { weapon: "оружия", armor: "брони", accessory: "бижутерии" };
    e.textContent = "В этой вкладке нет " + (labels[tabId] || "предметов") + ".";
    scroll.appendChild(e);
  }

  const grid = document.createElement("div");
  grid.className = "inv-grid";
  fillInvGrid(grid, tabId, shown);
  gridPanel.appendChild(grid);
  scroll.appendChild(gridPanel);
  list.appendChild(scroll);
  appendInvCrystallizeFooter(list);
}

async function sellNgWeaponFromInventory(it) {
  if (!it || isAccessoryItem(it)) return;
  const w = WMAP[it.id];
  if (!w || (typeof isNgSellWeapon === "function" && !isNgSellWeapon(w))) return;
  if (typeof isEquippedWeaponItem === "function" && isEquippedWeaponItem(it)) {
    toast("Сначала сними оружие в инвентаре", "warn");
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
  if (typeof afterInventorySpaceFreed === "function") afterInventorySpaceFreed();
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

