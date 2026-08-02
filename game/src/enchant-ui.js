// ===== Enchant: UI и рендер =====
// Вынесено из 11-enchant.js; зависит от scroll-core / 11-enchant.js (cur, busy).

function enchantScrollTarget() {
  if (!cur) return "weapon";
  if (cur.kind === "armor" || cur.kind === "accessory" || cur.kind === "jewelry") return "armor";
  return "weapon";
}

function enchantItemLabel() {
  if (!cur) return "оружие";
  if (cur.kind === "armor") return "броня";
  if (cur.kind === "accessory" || cur.kind === "jewelry") return "бижутерия";
  return "оружие";
}

function enchantKindTitleSuffix() {
  if (!cur) return "";
  if (cur.kind === "armor") return " · броня";
  if (cur.kind === "accessory" || cur.kind === "jewelry") return " · бижутерия";
  return "";
}

function findGearSlotByUid(uid) {
  if (!uid || typeof ensureAvatarGear !== "function" || typeof AVATAR_GEAR_SLOTS === "undefined") return null;
  const gear = ensureAvatarGear();
  const slot = AVATAR_GEAR_SLOTS.find((s) => gear[s.id]?.uid === uid);
  return slot?.id || null;
}

function openEnchant(item, opts) {
  opts = opts || {};
  if (!item && opts.fromGear) item = typeof equippedWeaponItem === "function" ? equippedWeaponItem() : null;
  if (!item) return;
  if (typeof isShardItem === "function" && isShardItem(item)) return;
  normalizeInvItem(item);

  const isAcc = typeof isAccessoryItem === "function" && isAccessoryItem(item);
  const isArmor = !isAcc && typeof isArmorItem === "function" && isArmorItem(item);
  let def = null;
  let kind = "weapon";
  let gearSlot = null;

  if (isAcc) {
    def = typeof accessoryDef === "function" ? accessoryDef(item) : typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[item.id] : null;
    if (!def) return;
    const canJew =
      typeof jewelryCanEnchant === "function" ? jewelryCanEnchant(def) : !!(def.grade && def.grade !== "NG" && !def.epic);
    if (def.epic && !canJew) {
      if (typeof openAccessory === "function") openAccessory(item);
      return;
    }
    if (!canJew) {
      toast("«" + def.name + "» без грейда — не точится.", "warn");
      return;
    }
    kind = "accessory";
    gearSlot =
      opts.gearSlot ||
      findGearSlotByUid(item.uid) ||
      (typeof accessorySlotType === "function" ? accessorySlotType(item) : null) ||
      def.slot ||
      null;
  } else if (isArmor) {
    def = typeof armorItemDef === "function" ? armorItemDef(item) : typeof AMAP !== "undefined" ? AMAP[item.id] : null;
    if (!def) return;
    if (!def.grade || def.grade === "NG") {
      toast("«" + def.name + "» без грейда — не точится.", "warn");
      return;
    }
    kind = "armor";
    gearSlot =
      opts.gearSlot ||
      (typeof armorSlotType === "function" ? armorSlotType(item) : null) ||
      def.slot ||
      null;
  } else {
    def = typeof WMAP !== "undefined" ? WMAP[item.id] : null;
    if (!def) return;
    if (typeof weaponCanEnchant === "function" && !weaponCanEnchant(def)) {
      toast("«" + def.name + "» без грейда — не точится. Добывай оружие D+ в задании.", "warn");
      return;
    }
    kind = "weapon";
    gearSlot = "weapon";
  }

  const equipped =
    opts.equipped ||
    (typeof isItemEquipped === "function" && isItemEquipped(item.uid)) ||
    (kind === "weapon" && typeof isEquippedWeaponItem === "function" && isEquippedWeaponItem(item));

  if (equipped && !opts.gearSlot && kind !== "weapon") {
    const found = findGearSlotByUid(item.uid);
    if (found) gearSlot = found;
  }

  if (typeof ensureScrollsState === "function") ensureScrollsState();

  cur = {
    item,
    weapon: def,
    kind,
    gearSlot,
    plus: item.plus || 0,
    broken: false,
    scroll: "regular",
    equipped: !!equipped,
  };
  $("#enchTitle").textContent = def.name + (equipped ? " · надето" : "") + enchantKindTitleSuffix();
  renderScrolls();
  renderEnch(true);
  show("ench");
}

function renderScrolls() {
  const box = $("#scrolls");
  box.innerHTML = "";
  if (!cur || !cur.weapon) return;
  const grade = cur.weapon.grade;
  const target = enchantScrollTarget();
  if (typeof ensureScrollsState === "function") ensureScrollsState();
  SCROLL_TYPES.forEach((t) => {
    const s =
      typeof scrollDef === "function" ? scrollDef(target, grade, t.id) : scrollFor(grade, t.id);
    const qty = typeof scrollQty === "function" ? scrollQty(target, t.id, grade) : 0;
    const tier = s.tier || 1;
    const el = document.createElement("div");
    el.className =
      "scroll-opt scroll-tier-" +
      tier +
      (cur.scroll === s.id ? " sel" : "") +
      (qty < 1 ? " is-empty" : "");
    el.dataset.tier = String(tier);
    el.innerHTML =
      `<div class="si"><img src="${s.icon}" alt="" onerror="this.style.visibility='hidden'"></div>` +
      `<div class="sm"><div class="st">${s.name} <span class="grade g-${grade}">${grade}</span></div>` +
      `<div class="sd">${s.desc}</div></div>` +
      `<div class="sc">×${qty}<small>свиток</small>` +
      `<span class="scroll-adena">${fmtAdena(s.estimate || s.cost || 0)}</span><small>adena</small></div>`;
    el.onclick = () => {
      cur.scroll = s.id;
      Audio2.click();
      renderScrolls();
      renderEnch();
    };
    box.appendChild(el);
  });
}

function notifyWeaponRecord(w, plus) {
  if (bumpWeaponRecord(w.id, plus)) {
    const nick =
      typeof getCloudNick === "function"
        ? getCloudNick()
        : typeof SoulforgeCloud !== "undefined"
          ? SoulforgeCloud.getNick()
          : null;
    let msg = "Рекорд: +" + plus + " «" + w.name + "»";
    if (nick) msg += " · уходит в рейтинг";
    else if (typeof cloudEnabled === "function" && cloudEnabled()) msg += " · войди, чтобы в таблицу";
    if (typeof toast === "function") toast(msg, "success");
    if (typeof noteLeaderboardEvent === "function") {
      noteLeaderboardEvent("record", { weaponId: w.id, plus, grade: w.grade, weaponName: w.name });
    }
  }
}

function playEnchantPlusPop(plus, opts) {
  opts = opts || {};
  const el = $("#stgPlus");
  const stage = $("#stage");
  if (el) {
    el.textContent = "+" + plus;
    el.classList.remove("plus-pop");
    void el.offsetWidth;
    el.classList.add("plus-pop");
    setTimeout(() => el.classList.remove("plus-pop"), 560);
  }
  if (!stage) return;
  stage.querySelectorAll(".wplus-float").forEach((n) => n.remove());
  const float = document.createElement("div");
  float.className = "wplus-float" + (opts.maxed ? " is-max" : "");
  float.textContent = opts.maxed ? (opts.capLabel || "+16!") : "+" + plus;
  float.setAttribute("aria-hidden", "true");
  stage.appendChild(float);
  setTimeout(() => float.remove(), 900);
}

function renderBrokenVisual(w, broken) {
  const failAnim = broken && $("#stage")?.classList.contains("fail");
  const showCrystal = broken && !failAnim;
  const stgImg = $("#stgImg");
  const brokenImg = $("#stgBrokenImg");
  const stgIcon = $("#stgIcon");
  if (stgImg) {
    stgImg.style.display = showCrystal ? "none" : "";
    stgImg.style.filter = broken
      ? "none"
      : `drop-shadow(0 0 ${glowInfo(cur.plus).blur.toFixed(0)}px ${glowInfo(cur.plus).color})`;
  }
  if (!brokenImg) return;
  if (showCrystal) {
    const grade = w.grade || "D";
    brokenImg.src = CRYSTAL_ICON[grade] || CRYSTAL_ICON.D;
    brokenImg.hidden = false;
    brokenImg.style.setProperty("--crystal-glow", CRYSTAL_COLOR[grade] || CRYSTAL_COLOR.D);
    stgIcon?.classList.add("is-broken");
  } else {
    brokenImg.hidden = true;
    stgIcon?.classList.remove("is-broken");
  }
}

function renderEnch(resetVerdict) {
  if (!cur || !cur.weapon) return;
  const w = cur.weapon;
  const broken = cur.broken;
  const isArmor = cur.kind === "armor";
  const isJew = cur.kind === "accessory" || cur.kind === "jewelry";
  const label = enchantItemLabel();
  $("#stgName").textContent = w.name;
  $("#stgPlus").textContent = broken ? "разрушено" : "+" + cur.plus;
  $("#stgImg").src = w.icon;
  renderBrokenVisual(w, broken);

  const g = glowInfo(cur.plus);
  const aura = $("#aura");
  aura.style.setProperty("--glow", g.color);
  aura.style.opacity = broken ? 0 : g.op.toFixed(2);

  const patkBox = $("#patk")?.closest(".box");
  const matkBox = $("#matk")?.closest(".box");
  const patkCap = $("#patkCap");
  const matkCap = $("#matkCap");
  if (isJew) {
    const plus = broken ? 0 : cur.plus;
    const mBonus = typeof jewelryEnchantMdefBonus === "function" ? jewelryEnchantMdefBonus(plus) : plus;
    const baseM = (w.bonuses && w.bonuses.mdef) || w.mdef || 0;
    const m = broken ? 0 : baseM + mBonus;
    if (patkBox) patkBox.hidden = true;
    if (matkBox) {
      matkBox.hidden = false;
      matkBox.classList.add("is-primary");
    }
    if (matkCap) matkCap.textContent = "M. Def";
    $("#matk").innerHTML = `${fmt(m)} <small>${plus > 0 ? "+" + mBonus : ""}</small>`;
    if (matkBox) matkBox.title = "M.Def";
  } else if (isArmor) {
    const plus = broken ? 0 : cur.plus;
    const pBonus = typeof armorEnchantPdefBonus === "function" ? armorEnchantPdefBonus(plus) : plus * 2;
    const mBonus = typeof armorEnchantMdefBonus === "function" ? armorEnchantMdefBonus(plus) : plus;
    const p = broken ? 0 : (w.pdef || 0) + pBonus;
    const m = broken ? 0 : (w.mdef || 0) + mBonus;
    if (patkBox) {
      patkBox.hidden = false;
      patkBox.classList.add("is-primary");
    }
    if (matkBox) {
      matkBox.hidden = false;
      matkBox.classList.remove("is-primary");
    }
    if (patkCap) patkCap.textContent = "P. Def";
    if (matkCap) matkCap.textContent = "M. Def";
    $("#patk").innerHTML =
      `${fmt(p)} <small>${plus > 0 ? "+" + pBonus : ""}</small>`;
    $("#matk").innerHTML =
      `${fmt(m)} <small>${plus > 0 ? "+" + mBonus : ""}</small>`;
    if (patkBox) patkBox.title = "P.Def";
    if (matkBox) matkBox.title = "M.Def";
  } else {
    const p = broken ? 0 : statAt(w.patk, w.ps, cur.plus);
    const m = broken ? 0 : statAt(w.matk, w.ms, cur.plus);
    if (patkBox) patkBox.hidden = false;
    const mysticPrimary = typeof avatarIsMystic === "function" && avatarIsMystic();
    if (patkBox) patkBox.classList.toggle("is-primary", !mysticPrimary);
    if (matkBox) {
      matkBox.hidden = false;
      matkBox.classList.toggle("is-primary", !!mysticPrimary);
    }
    if (patkCap) patkCap.textContent = "P. Atk";
    if (matkCap) matkCap.textContent = "M. Atk";
    $("#patk").innerHTML = `${fmt(p)} <small>${cur.plus > 0 ? "+" + w.ps * cur.plus : ""}</small>`;
    $("#matk").innerHTML = `${fmt(m)} <small>${cur.plus > 0 ? "+" + w.ms * cur.plus : ""}</small>`;
    if (patkBox) patkBox.title = "P.Atk";
    if (matkBox) matkBox.title = "M.Atk";
  }

  const target = enchantScrollTarget();
  const sc =
    typeof scrollDef === "function" ? scrollDef(target, w.grade, cur.scroll) : scrollFor(w.grade, cur.scroll);
  const qty = typeof scrollQty === "function" ? scrollQty(target, cur.scroll, w.grade) : 0;
  const adenaCost = Math.max(0, Math.floor(Number(sc.estimate != null ? sc.estimate : sc.cost) || 0));
  const chance = successChance(cur.plus, sc.behavior);
  const safe = cur.plus < safeLevel();
  const capPlus =
    typeof enchantItemCapPlus === "function"
      ? enchantItemCapPlus(cur.kind, cur.scroll)
      : typeof scrollMaxPlus === "function"
        ? scrollMaxPlus(cur.scroll)
        : MAX_PLUS;
  $("#oddsVal").textContent = broken ? "—" : Math.round(chance * 100) + "%" + (safe ? " (безопасно)" : "");
  const scrollQtyEl = $("#scrollQtyVal");
  if (scrollQtyEl) scrollQtyEl.textContent = broken ? "—" : "×" + qty;
  $("#costVal").textContent = broken ? "—" : fmtAdena(adenaCost);

  const maxed = cur.plus >= capPlus;
  const note = $("#safeNote");
  const ItemCap = isJew ? "Бижутерия" : isArmor ? "Броня" : "Оружие";
  if (broken) {
    note.textContent = ItemCap + " разрушена — возьми новое";
    note.style.color = "var(--red)";
  } else if (maxed && isJew) {
    note.textContent = "+12 — максимальная заточка бижутерии!";
    note.style.color = "var(--red)";
  } else if (maxed && capPlus >= MAX_PLUS) {
    note.textContent = "+16 — максимальная заточка!";
    note.style.color = "var(--red)";
  } else if (maxed && sc.behavior === "destruction") {
    note.textContent = "Свиток разрушения — максимум +" + capPlus;
    note.style.color = "var(--gold-soft)";
  } else if (safe) {
    note.textContent = "+0…+3 — безопасная заточка";
    note.style.color = "var(--green)";
  } else if (sc.behavior === "guarantee") {
    note.textContent = "Кристальный свиток — гарантированный успех";
    note.style.color = "var(--blue)";
  } else if (sc.behavior === "destruction") {
    note.textContent =
      "Свиток разрушения — низкий шанс, провал не ломает (до +" + capPlus + ")";
    note.style.color = "var(--gold-soft)";
  } else if (sc.behavior === "reset") {
    note.textContent = "Риск: провал откатит до +0";
    note.style.color = "var(--gold-soft)";
  } else {
    note.textContent = "Риск: провал разрушит " + label;
    note.style.color = "var(--red)";
  }
  if (!broken && !maxed && !isArmor && !isJew) {
    const mystic = typeof avatarIsMystic === "function" && avatarIsMystic();
    if (mystic && typeof weaponAffinity === "function" && weaponAffinity(w) === "physical") {
      note.textContent = "Физическое оружие — для мага слабее";
      note.style.color = "var(--gold-soft)";
    } else if (!mystic && typeof weaponAffinity === "function" && weaponAffinity(w) === "magical") {
      note.textContent = "Магическое оружие — для воина слабее";
      note.style.color = "var(--gold-soft)";
    }
  }

  $("#pMax").textContent = isArmor || isJew ? "—" : "+" + weaponRecord(w.id);
  $("#pSpent").textContent = fmtAdena(cur.item.spent || 0);

  const hasScrollOk = qty >= 1;
  const canAfford = (state.adena || 0) >= adenaCost;
  $("#enchBtn").disabled = busy || broken || maxed || !hasScrollOk || !canAfford;
  $("#enchBtn").textContent = busy
    ? "Заточка…"
    : broken
      ? "Разрушено"
      : maxed
        ? "Максимум +" + capPlus
        : !hasScrollOk
          ? "Нет свитка"
          : !canAfford
            ? "Мало adena"
            : "Заточить ✦";

  const marketNote = $("#enchMarketNote");
  if (marketNote) {
    marketNote.textContent = isJew
      ? "Продажа бижу — на рынке"
      : isArmor
        ? "Продажа брони — на рынке"
        : "Продажа оружия — на рынке";
  }

  if (resetVerdict) setVerdict("Удачи, авантюрист!", "neutral");
  $("#adena").textContent = fmt(state.adena);
}

function setVerdict(text, kind) {
  const v = $("#verdict");
  v.textContent = text;
  v.className = "verdict " + kind;
}

function enchFlash(kind, glowColor) {
  const stage = $("#stage");
  const flash = $("#enchFlash");
  if (!stage || !flash) return;
  stage.classList.remove("success-flash", "fail-flash");
  if (glowColor) flash.style.setProperty("--flash-color", glowColor);
  if (kind === "success") {
    stage.classList.add("success-flash");
  } else if (kind === "fail") {
    stage.classList.add("fail-flash");
    setTimeout(() => stage.classList.remove("fail-flash"), 580);
  }
}
