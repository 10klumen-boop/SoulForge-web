// ===== Экипировка персонажа: UI (paperdoll в инвентаре) =====
// Core logic (ensureAvatarGear, equipAvatarSlot, iterEquippedGear и т.д.) вынесено в avatar-gear-core.js.

/** Раскладка: доспехи/оружие сверху; бижутерия снизу. Щит — stub. */
const INV_PAPERDOLL_LAYOUT = [
  [{ id: "helmet" }],
  [{ id: "chest" }],
  [
    { id: "gloves" },
    { id: "legs" },
    { id: "boots" },
  ],
  [
    { id: "weapon" },
    { stub: true, id: "stub_shield", label: "Щит", placeholder: "icons/weapon_iron_glove_i00.png" },
  ],
  [
    { id: "earring_l" },
    { id: "necklace" },
    { id: "earring_r" },
  ],
  [
    { id: "ring_l" },
    { id: "ring_r" },
  ],
];

function refreshInvPaperdoll() {
  const root = document.getElementById("invPaperdoll");
  if (root) renderGearPaperdoll(root);
}

/** @deprecated alias — paperdoll теперь в инвентаре */
function renderAvatarGearSlots() {
  refreshInvPaperdoll();
}

function invPaperdollLayout() {
  const jewelryOn = typeof FEATURE_EPIC_JEWELRY_UI === "undefined" ? true : !!FEATURE_EPIC_JEWELRY_UI;
  return INV_PAPERDOLL_LAYOUT.map((row) =>
    row.map((cell) => {
      if (cell.stub || !cell.id) return cell;
      const meta = typeof AVATAR_GEAR_SLOTS !== "undefined"
        ? AVATAR_GEAR_SLOTS.find((s) => s.id === cell.id)
        : null;
      if (meta?.jewelry && !jewelryOn) {
        return {
          stub: true,
          id: "stub_" + cell.id,
          label: meta.label,
          placeholder: meta.placeholder,
        };
      }
      return cell;
    })
  );
}

function renderGearPaperdoll(rootEl) {
  const root = rootEl || document.getElementById("invPaperdoll");
  if (!root) return;
  const gear = typeof ensureAvatarGear === "function" ? ensureAvatarGear() : {};
  root.innerHTML = "";
  const title = document.createElement("div");
  title.className = "inv-paperdoll-head";
  title.textContent = "Экипировка";
  root.appendChild(title);

  invPaperdollLayout().forEach((row) => {
    const rowEl = document.createElement("div");
    const n = row.length;
    rowEl.className =
      "inv-paperdoll-row" +
      (n === 1 ? " inv-paperdoll-row-1" : n === 2 ? " inv-paperdoll-row-2" : "");
    row.forEach((cell) => {
      if (cell.stub) {
        rowEl.appendChild(buildGearStubEl(cell));
        return;
      }
      const slot = AVATAR_GEAR_SLOTS.find((s) => s.id === cell.id);
      if (!slot) return;
      rowEl.appendChild(buildGearSlotEl(slot, gear[slot.id]));
    });
    root.appendChild(rowEl);
  });

  root.appendChild(buildInvSetBonusPanel());
}

function formatArmorSetBonusLine(th, b) {
  if (typeof formatArmorBonusParts === "function") {
    const parts = formatArmorBonusParts(b);
    return th + " шт.: " + (parts.join(" · ") || "—");
  }
  if (!b) return "";
  const parts = [];
  if (b.armorSustain) parts.push("−" + Math.round(b.armorSustain * 100) + "% HP golden/boss");
  if (b.pdef) parts.push("+" + b.pdef + " P.Def");
  if (b.mdef) parts.push("+" + b.mdef + " M.Def");
  if (b.mineAdena) parts.push("+" + Math.round(b.mineAdena * 100) + "% adena");
  if (b.enchant) {
    parts.push(
      typeof formatArmorEnchantBonus === "function"
        ? formatArmorEnchantBonus(b.enchant)
        : "+" + (b.enchant * 100).toFixed(2) + "% заточка"
    );
  }
  if (b.bossResist) parts.push("−" + Math.round(b.bossResist * 100) + "% HP босса зоны");
  if (b.mineXp) parts.push("+" + Math.round(b.mineXp * 100) + "% XP фарма");
  if (b.pvpAtk) parts.push("+" + Math.round(b.pvpAtk * 1000) / 10 + "% ATK арены");
  if (b.pvpDef) parts.push("+" + Math.round(b.pvpDef * 1000) / 10 + "% DEF арены");
  if (b.pvpHp) parts.push("+" + Math.round(b.pvpHp) + " HP арены");
  return th + " шт.: " + (parts.join(" · ") || "—");
}

function formatEquippedJewelryBonusHtml() {
  const jewelryLines = [];
  if (typeof iterEquippedGear === "function" && typeof COLLECTIBLES !== "undefined") {
    iterEquippedGear().forEach(({ item, def }) => {
      if (!item || item.kind === "weapon" || item.kind === "armor") return;
      if (typeof isArmorItem === "function" && isArmorItem(item)) return;
      const c = def || COLLECTIBLES[item.id];
      if (!c || !c.slot) return;
      const parts = [];
      const b = c.bonuses || {};
      if (b.pvpAtk) parts.push("+" + Math.round(b.pvpAtk * 1000) / 10 + "% ATK арены");
      if (b.enchant) {
        parts.push(
          typeof formatArmorEnchantBonus === "function"
            ? formatArmorEnchantBonus(b.enchant)
            : "+" + (b.enchant * 100).toFixed(2) + "% заточка"
        );
      }
      if (b.mineAdena) parts.push("+" + Math.round(b.mineAdena * 100) + "% adena");
      if (b.avatarXp) parts.push("+" + Math.round(b.avatarXp * 100) + "% XP души");
      if (b.mdef) parts.push("+" + b.mdef + " M.Def");
      if (b.pdef) parts.push("+" + b.pdef + " P.Def");
      jewelryLines.push(
        '<li class="on">✓ ' + (c.name || item.id) + (parts.length ? ": " + parts.join(" · ") : "") + "</li>"
      );
    });
  }
  if (!jewelryLines.length) return "";
  return '<div class="inv-set-bonus-head">Бижутерия</div><ul>' + jewelryLines.join("") + "</ul>";
}

function buildInvSetBonusPanel() {
  const wrap = document.createElement("div");
  wrap.className = "inv-set-bonus";
  const set = typeof avatarSetBonuses === "function" ? avatarSetBonuses() : null;
  const jewelryHtml = formatEquippedJewelryBonusHtml();
  if (!set || !(set.sets || []).length) {
    wrap.innerHTML =
      '<div class="inv-set-bonus-head">Сет</div>' +
      '<p class="inv-set-bonus-empty">Надень 2+ куска одного сета — появятся бонусы.</p>' +
      '<ul class="inv-set-bonus-hint">' +
      "<li>2 / 4 / 5: бонусы сета (farm + ATK/DEF/HP арены)</li>" +
      "<li>P.Def/M.Def кусков отдельно режут HP golden/boss (кап от DEF ~10%)</li></ul>" +
      jewelryHtml;
    return wrap;
  }
  let html = "";
  (set.sets || []).forEach((s) => {
    const def = typeof ARMOR_SETS !== "undefined" ? ARMOR_SETS[s.id] : null;
    html += '<div class="inv-set-bonus-head">' + (s.name || s.id) + " · " + s.pieces + "/5</div><ul>";
    const tiers = def?.bonuses || {};
    [2, 4, 5].forEach((th) => {
      if (!tiers[th]) return;
      const on = s.pieces >= th;
      html +=
        '<li class="' + (on ? "on" : "off") + '">' +
        (on ? "✓ " : "○ ") +
        formatArmorSetBonusLine(th, tiers[th]) +
        "</li>";
    });
    html += "</ul>";
  });
  const armorDef = typeof avatarArmorDefBonuses === "function" ? avatarArmorDefBonuses() : null;
  const sus = typeof avatarArmorSustainPct === "function" ? avatarArmorSustainPct() : 0;
  const setSus = set.armorSustain || 0;
  if (armorDef && (armorDef.pdef || armorDef.mdef || sus > 0)) {
    const fromDef = Math.max(0, sus - setSus);
    html +=
      '<p class="inv-set-bonus-def" title="Sustain от P.Def/M.Def кусков + бонус сета armorSustain. Общий кап ~15%.">' +
      "<b>DEF</b> P." +
      (armorDef.pdef || 0) +
      " / M." +
      (armorDef.mdef || 0) +
      (fromDef > 0 ? " → −" + Math.round(fromDef * 100) + "% HP (от DEF)" : "") +
      (setSus > 0 ? " · сет −" + Math.round(setSus * 100) + "%" : "") +
      (sus > 0 ? " · <b>итого −" + Math.round(sus * 100) + "%</b> golden/boss" : "") +
      "</p>";
  }
  html += jewelryHtml;
  wrap.innerHTML = html;
  return wrap;
}

function buildGearStubEl(cell) {
  const el = document.createElement("div");
  el.className = "inv-gear-slot is-stub";
  el.dataset.slot = cell.id;
  el.title = (cell.label || "Слот") + " — скоро";
  el.innerHTML =
    '<span class="inv-gear-slot-lbl">' + (cell.label || "") + "</span>" +
    '<img class="inv-gear-slot-ph" src="' + (cell.placeholder || "") + '" alt="" draggable="false">';
  return el;
}

function buildGearSlotEl(slot, item) {
  const def = typeof avatarGearItemDef === "function" ? avatarGearItemDef(item) : null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "inv-gear-slot" +
    (item ? " filled" : "") +
    (def?.epic ? " g-epic" : item && def?.grade ? " g-" + def.grade : "");
  btn.dataset.slot = slot.id;
  btn.title = slot.label + (item && def ? ": " + def.name + (item.plus ? " +" + item.plus : "") : " — пусто");
  let inner = '<span class="inv-gear-slot-lbl">' + slot.label + "</span>";
  if (item && def) {
    inner += '<img src="' + def.icon + '" alt="" draggable="false">';
    if (item.plus) inner += '<span class="inv-gear-slot-plus">+' + item.plus + "</span>";
  } else {
    inner += '<img class="inv-gear-slot-ph" src="' + (slot.placeholder || "") + '" alt="" draggable="false">';
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
  const armorOn = typeof FEATURE_ARMOR_UI === "undefined" ? true : !!FEATURE_ARMOR_UI;
  if (slot.armor && !armorOn) {
    toast("Броня пока недоступна", "warn");
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
  const enchBtn = document.getElementById("avatarEquipEnchant");
  if (enchBtn) {
    const wItem = slotId === "weapon" ? gear.weapon : null;
    const wDef = wItem && typeof WMAP !== "undefined" ? WMAP[wItem.id] : null;
    const canEnch = !!(wItem && wDef && !(typeof isNoGradeWeapon === "function" && isNoGradeWeapon(wDef)));
    enchBtn.hidden = !canEnch;
  }
  syncAvatarEquipFilterUi(slotId);
  renderAvatarEquipList();
  setAvatarEquipOpen(true);
  // На телефоне focus() у поиска поднимает клавиатуру — только desktop.
  const search = document.getElementById("avatarEquipSearch");
  if (search) {
    let finePointer = false;
    try {
      finePointer = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
    } catch (_) {}
    if (finePointer) setTimeout(() => search.focus(), 30);
  }
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
  const equipped =
    typeof ensureAvatarGear === "function" ? ensureAvatarGear()[_avatarEquipSlot] : null;
  const equippedPower = avatarEquipItemPower(equipped);
  const topPower = avatarEquipItemPower(options[0]);
  options.forEach((it, idx) => {
    const def = invItemDef(it);
    if (!def) return;
    const btn = document.createElement("button");
    btn.type = "button";
    const isArmor = typeof isArmorItem === "function" && isArmorItem(it);
    // «лучшее» только если сильнее того, что уже надето (экип не в инвентаре)
    const isBest =
      idx === 0 &&
      topPower > 0 &&
      topPower > equippedPower &&
      !isAccessoryItem(it);
    btn.className =
      "avatar-equip-opt" +
      (isAccessoryItem(it) ? " g-epic" : " g-" + def.grade) +
      (isBest ? " is-best" : "");
    const plus = it.plus ? " +" + it.plus : "";
    const badge = isBest ? '<em class="avatar-equip-best">лучшее</em>' : "";
    let sub = "";
    if (isAccessoryItem(it)) sub = def.desc || "Эпический аксессуар";
    else if (isArmor) sub = "P.Def " + (def.pdef || 0) + " · M.Def " + (def.mdef || 0);
    else sub = typeof weaponEquipStatLabel === "function" ? weaponEquipStatLabel(def, it.plus || 0) : "P.Atk " + fmt(statAt(def.patk, def.ps, it.plus || 0));
    btn.innerHTML =
      '<img src="' + def.icon + '" alt="">' +
      "<div><strong>" + def.name + plus + badge + "</strong>" +
      "<span>" + sub + "</span></div>";
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
  const enchBtn = document.getElementById("avatarEquipEnchant");
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
    if (enchBtn) {
      enchBtn.onclick = () => {
        const it = typeof equippedWeaponItem === "function" ? equippedWeaponItem() : null;
        if (!it || typeof openEnchant !== "function") return;
        Audio2.click();
        setAvatarEquipOpen(false);
        openEnchant(it, { equipped: true });
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
