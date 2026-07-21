// ===== Экипировка персонажа: UI =====
// Core logic (ensureAvatarGear, equipAvatarSlot, iterEquippedGear и т.д.) вынесено в avatar-gear-core.js.

function renderAvatarGearSlots() {
  const left = document.getElementById("avatarGearLeft");
  const right = document.getElementById("avatarGearRight");
  if (!left || !right) return;
  const gear = ensureAvatarGear();
  left.innerHTML = "";
  right.innerHTML = "";
  const uiSlots = avatarGearSlotsForUi();
  ["left", "right"].forEach((side) => {
    const col = side === "left" ? left : right;
    const sideSlots = uiSlots.filter((s) => s.side === side).sort((a, b) => a.row - b.row);
    col.hidden = !sideSlots.length;
    sideSlots.forEach((slot) => {
      col.appendChild(buildAvatarSlotBtn(slot, gear[slot.id]));
    });
  });
}

function buildAvatarSlotBtn(slot, item) {
  const def = avatarGearItemDef(item);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "avatar-slot" + (item ? " filled" : "") + (def?.epic ? " g-epic" : item && def?.grade ? " g-" + def.grade : "");
  btn.dataset.slot = slot.id;
  btn.title = slot.label + (item && def ? ": " + def.name + (item.plus ? " +" + item.plus : "") : " — пусто");
  let inner = '<span class="avatar-slot-lbl">' + slot.label + "</span>";
  if (item && def) {
    inner += '<img src="' + def.icon + '" alt="">';
    if (item.plus) inner += '<span class="avatar-slot-plus">+' + item.plus + "</span>";
  } else {
    inner += '<img class="avatar-slot-ph" src="' + slot.placeholder + '" alt="">';
  }
  btn.innerHTML = inner;
  btn.onclick = () => openAvatarEquipPicker(slot.id);
  return btn;
}

function setAvatarEquipOpen(open) {
  const el = document.getElementById("avatarEquipBackdrop");
  if (!el) return;
  el.hidden = !open;
  if (!open) _avatarEquipSlot = null;
  if (typeof setGamePaused === "function") setGamePaused(!!open);
}

function openAvatarEquipPicker(slotId) {
  if (!state.avatar?.created) return;
  const slot = AVATAR_GEAR_SLOTS.find((s) => s.id === slotId);
  if (!slot || (!FEATURE_EPIC_JEWELRY_UI && slot.jewelry)) {
    toast("Эпическая бижутерия пока недоступна", "warn");
    return;
  }
  Audio2.click();
  _avatarEquipSlot = slotId;
  _avatarEquipFilter = { q: "", grade: "", aff: "" };
  const title = document.getElementById("avatarEquipTitle");
  if (title) title.textContent = slot.label || "Экипировка";
  const gear = ensureAvatarGear();
  const unequipBtn = document.getElementById("avatarEquipUnequip");
  if (unequipBtn) unequipBtn.hidden = !gear[slotId];
  syncAvatarEquipFilterUi(slotId);
  renderAvatarEquipList();
  setAvatarEquipOpen(true);
  const search = document.getElementById("avatarEquipSearch");
  if (search) setTimeout(() => search.focus(), 30);
}

function renderAvatarEquipList() {
  const list = document.getElementById("avatarEquipList");
  if (!list || !_avatarEquipSlot) return;
  list.innerHTML = "";
  const options = filteredEquippableForSlot(_avatarEquipSlot);
  const total = listEquippableForSlot(_avatarEquipSlot).length;
  if (!options.length) {
    const msg = total
      ? "Ничего не найдено — сбрось фильтр или поиск."
      : "Нет подходящих предметов в инвентаре.";
    list.innerHTML = '<p class="avatar-equip-empty">' + msg + "</p>";
    return;
  }
  const bestPower = avatarEquipItemPower(options[0]);
  options.forEach((it, idx) => {
    const def = invItemDef(it);
    if (!def) return;
    const btn = document.createElement("button");
    btn.type = "button";
    const isBest = idx === 0 && bestPower > 0 && !isAccessoryItem(it);
    btn.className =
      "avatar-equip-opt" +
      (isAccessoryItem(it) ? " g-epic" : " g-" + def.grade) +
      (isBest ? " is-best" : "");
    const plus = it.plus ? " +" + it.plus : "";
    const badge = isBest ? '<em class="avatar-equip-best">лучшее</em>' : "";
    btn.innerHTML =
      '<img src="' + def.icon + '" alt="">' +
      "<div><strong>" + def.name + plus + badge + "</strong>" +
      "<span>" + (isAccessoryItem(it) ? (def.desc || "Эпический аксессуар") : (typeof weaponEquipStatLabel === "function" ? weaponEquipStatLabel(def, it.plus || 0) : "P.Atk " + fmt(statAt(def.patk, def.ps, it.plus || 0)))) + "</span></div>";
    btn.onclick = () => {
      if (equipAvatarSlot(_avatarEquipSlot, it)) setAvatarEquipOpen(false);
    };
    list.appendChild(btn);
  });
}

function wireAvatarGear() {
  const backdrop = document.getElementById("avatarEquipBackdrop");
  const closeBtn = document.getElementById("avatarEquipClose");
  const unequipBtn = document.getElementById("avatarEquipUnequip");
  const search = document.getElementById("avatarEquipSearch");
  const grades = document.getElementById("avatarEquipGrades");
  const affBar = document.getElementById("avatarEquipAff");
  if (backdrop && !backdrop.dataset.wired) {
    backdrop.dataset.wired = "1";
    if (closeBtn) closeBtn.onclick = () => { Audio2.click(); setAvatarEquipOpen(false); };
    if (unequipBtn) {
      unequipBtn.onclick = () => {
        if (_avatarEquipSlot && unequipAvatarSlot(_avatarEquipSlot)) setAvatarEquipOpen(false);
      };
    }
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) setAvatarEquipOpen(false);
    });
    if (search) {
      search.addEventListener("input", () => {
        _avatarEquipFilter.q = search.value || "";
        renderAvatarEquipList();
      });
      search.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setAvatarEquipOpen(false);
        }
      });
    }
    if (grades) {
      grades.addEventListener("click", (e) => {
        const btn = e.target.closest(".avatar-equip-grade");
        if (!btn) return;
        Audio2.click();
        _avatarEquipFilter.grade = btn.dataset.grade || "";
        syncAvatarEquipFilterUi(_avatarEquipSlot);
        renderAvatarEquipList();
      });
    }
    if (affBar) {
      affBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".avatar-equip-aff-btn");
        if (!btn) return;
        Audio2.click();
        _avatarEquipFilter.aff = btn.dataset.aff || "";
        syncAvatarEquipFilterUi(_avatarEquipSlot);
        renderAvatarEquipList();
      });
    }
  }
}
