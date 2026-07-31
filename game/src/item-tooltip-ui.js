// ===== Item tooltip (inventory + gear) =====
// Floating L2-style panel; replaces native title on fine pointers.

function itemTipEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemTipIsCoarsePointer() {
  try {
    return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  } catch (_) {
    return false;
  }
}

function ensureItemTipEl() {
  let tip = document.getElementById("itemTip");
  if (tip) return tip;
  tip = document.createElement("div");
  tip.id = "itemTip";
  tip.className = "item-tip";
  tip.hidden = true;
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  return tip;
}

function hideItemTip() {
  const tip = document.getElementById("itemTip");
  if (tip) {
    tip.hidden = true;
    tip.innerHTML = "";
  }
}

function positionItemTip(tip, anchor) {
  const r = anchor.getBoundingClientRect();
  tip.hidden = false;
  tip.style.left = "0px";
  tip.style.top = "0px";
  const tw = tip.offsetWidth || 280;
  const th = tip.offsetHeight || 140;
  let left = r.right + 10;
  let top = r.top;
  if (left + tw > window.innerWidth - 8) left = r.left - tw - 10;
  if (left < 8) left = Math.max(8, r.left + r.width / 2 - tw / 2);
  if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
  if (top < 8) top = 8;
  tip.style.left = Math.round(left) + "px";
  tip.style.top = Math.round(top) + "px";
}

/**
 * @param {HTMLElement} el
 * @param {() => string} getHtml
 * @param {string} [fallbackTitle]
 */
function wireItemTooltip(el, getHtml, fallbackTitle) {
  if (!el || el.dataset.itemTipWired) return;
  el.dataset.itemTipWired = "1";
  if (itemTipIsCoarsePointer()) {
    if (fallbackTitle) el.title = fallbackTitle;
    return;
  }
  el.removeAttribute("title");
  const show = () => {
    if (typeof invPointerDrag !== "undefined" && invPointerDrag) return;
    const html = typeof getHtml === "function" ? getHtml() : "";
    if (!html) return;
    const tip = ensureItemTipEl();
    tip.innerHTML = html;
    positionItemTip(tip, el);
  };
  const hide = () => hideItemTip();
  el.addEventListener("mouseenter", show);
  el.addEventListener("mouseleave", hide);
  el.addEventListener("focus", show);
  el.addEventListener("blur", hide);
  el.addEventListener("dragstart", hide);
  el.addEventListener(
    "click",
    () => {
      hide();
    },
    true
  );
}

function itemTipArmorSlotRu(slot) {
  if (slot === "helmet") return "шлем";
  if (slot === "chest") return "доспех";
  if (slot === "legs") return "поножи";
  if (slot === "gloves") return "перчатки";
  if (slot === "boots") return "сапоги";
  if (slot === "earring") return "серьга";
  if (slot === "ring") return "кольцо";
  if (slot === "necklace") return "ожерелье";
  if (slot === "weapon") return "оружие";
  return slot || "—";
}

function itemTipGradeLabel(def) {
  if (!def) return "";
  if (def.epic) return "Эпик";
  if (def.grade === "NG") return "NG";
  return def.grade ? String(def.grade) : "";
}

function itemTipSetName(def) {
  if (!def || !def.setId) return "";
  if (typeof ARMOR_SETS !== "undefined" && ARMOR_SETS[def.setId]) {
    return ARMOR_SETS[def.setId].name || "";
  }
  if (typeof JEWELRY_SETS !== "undefined" && JEWELRY_SETS[def.setId]) {
    return JEWELRY_SETS[def.setId].name || "";
  }
  return "";
}

function itemTipShellHtml(opts) {
  const grade = opts.grade || "";
  const gradeCls = opts.gradeClass || (grade ? "g-" + grade : "");
  const icon = opts.icon
    ? '<img class="item-tip-ico" src="' +
      itemTipEsc(opts.icon) +
      '" alt="" draggable="false" onerror="this.style.visibility=\'hidden\'">'
    : "";
  const plus = opts.plus ? '<span class="item-tip-plus">+' + opts.plus + "</span>" : "";
  const gradeBadge = grade
    ? '<span class="item-tip-grade ' + itemTipEsc(gradeCls) + '">' + itemTipEsc(grade) + "</span>"
    : "";
  const stats = (opts.stats || [])
    .filter(Boolean)
    .map((row) => {
      if (typeof row === "string") {
        return '<div class="item-tip-stat">' + itemTipEsc(row) + "</div>";
      }
      return (
        '<div class="item-tip-stat"><span>' +
        itemTipEsc(row.k) +
        "</span><b>" +
        itemTipEsc(row.v) +
        "</b></div>"
      );
    })
    .join("");
  const meta = (opts.meta || [])
    .filter(Boolean)
    .map((line) => '<div class="item-tip-meta-line">' + itemTipEsc(line) + "</div>")
    .join("");
  const actions = (opts.actions || [])
    .filter(Boolean)
    .map((line) => '<div class="item-tip-action">' + itemTipEsc(line) + "</div>")
    .join("");
  return (
    '<div class="item-tip-head">' +
    icon +
    '<div class="item-tip-head-text">' +
    '<div class="item-tip-title">' +
    itemTipEsc(opts.title || "—") +
    plus +
    "</div>" +
    (opts.subtitle
      ? '<div class="item-tip-sub">' + itemTipEsc(opts.subtitle) + "</div>"
      : "") +
    gradeBadge +
    "</div></div>" +
    (stats ? '<div class="item-tip-stats">' + stats + "</div>" : "") +
    (meta ? '<div class="item-tip-meta">' + meta + "</div>" : "") +
    (actions ? '<div class="item-tip-actions">' + actions + "</div>" : "")
  );
}

/** @param {object} [ctx] { slotLabel, equipped } */
function itemTooltipHtmlFromInvItem(it, ctx) {
  ctx = ctx || {};
  if (!it || typeof invItemDef !== "function") return "";
  const def = invItemDef(it);
  if (!def) return "";
  const slotExtra = ctx.slotLabel ? ["Слот экипа: " + ctx.slotLabel] : [];
  const equipActions = ctx.equipped ? ["Клик — сменить / снять"] : null;

  if (typeof isShardItem === "function" && isShardItem(it)) {
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    const meta = slotExtra.slice();
    if (Array.isArray(ctx.extraMeta)) meta.push(...ctx.extraMeta);
    return itemTipShellHtml({
      icon: def.icon,
      title: def.name,
      grade: "D",
      gradeClass: "g-D",
      subtitle: "Осколок",
      stats: [{ k: "Кол-во", v: "×" + qty }],
      meta,
      actions: Array.isArray(ctx.actions)
        ? ctx.actions
        : equipActions || ["Крафт в Мастерской → Бижутерия"],
    });
  }

  if (typeof isAccessoryItem === "function" && isAccessoryItem(it)) {
    const isEpic = !!def.epic;
    const canCry =
      !ctx.equipped &&
      typeof canCrystallizeInventoryItem === "function" &&
      canCrystallizeInventoryItem(it);
    const plus = it.plus || 0;
    const mBonus =
      typeof jewelryEnchantMdefBonus === "function" ? jewelryEnchantMdefBonus(plus) : plus;
    const baseM = (def.bonuses && def.bonuses.mdef) || def.mdef || 0;
    const bonusLines =
      typeof formatJewelryBonusLines === "function" ? formatJewelryBonusLines(def) : [];
    const stats = [];
    if (baseM || mBonus) {
      stats.push({
        k: "M.Def",
        v: String(baseM + mBonus) + (mBonus > 0 ? " (+" + mBonus + ")" : ""),
      });
    }
    bonusLines.forEach((ln) => {
      if (/m\.?\s*def/i.test(ln) && (baseM || mBonus)) return;
      stats.push({ k: "Бонус", v: ln });
    });
    const setName = itemTipSetName(def);
    const meta = slotExtra.slice();
    meta.push("Бижутерия · " + itemTipArmorSlotRu(def.slot));
    if (setName) meta.push("Сет: " + setName);
    if (canCry && def.cc) meta.push("Кристаллизация: " + def.cc + " × " + (def.grade || "?"));
    if (isEpic) meta.push("Эпик — не кристаллизуется");
    if (def.uniqueEquipped || def.epic) meta.push("Уникальный — работает только один в экипе");
    if (def.desc) meta.push(def.desc);
    if (Array.isArray(ctx.extraMeta)) meta.push(...ctx.extraMeta);
    return itemTipShellHtml({
      icon: def.icon,
      title: def.name,
      plus,
      grade: itemTipGradeLabel(def),
      gradeClass: isEpic ? "g-epic" : "g-" + (def.grade || "C"),
      subtitle: isEpic ? "Эпическая бижутерия" : "Бижутерия",
      stats,
      meta,
      actions: Array.isArray(ctx.actions)
        ? ctx.actions
        : equipActions || [
            isEpic ? "Клик — детали" : "Клик — заточка",
            "Тяни на слот экипа" + (canCry ? " / кристаллизацию" : ""),
          ],
    });
  }

  if (typeof isArmorItem === "function" && isArmorItem(it)) {
    const noGrade = !def.grade || def.grade === "NG";
    const setName = itemTipSetName(def);
    const meta = slotExtra.slice();
    meta.push("Слот: " + itemTipArmorSlotRu(def.slot));
    if (setName) meta.push("Сет: " + setName);
    if (def.cc && !ctx.equipped) meta.push("Кристаллизация: " + def.cc + " × " + (def.grade || "?"));
    if (Array.isArray(ctx.extraMeta)) meta.push(...ctx.extraMeta);
    const plus = it.plus || 0;
    const pBonus =
      typeof armorEnchantPdefBonus === "function" ? armorEnchantPdefBonus(plus) : plus * 2;
    const mBonus =
      typeof armorEnchantMdefBonus === "function" ? armorEnchantMdefBonus(plus) : plus;
    const pTot = (def.pdef || 0) + pBonus;
    const mTot = (def.mdef || 0) + mBonus;
    return itemTipShellHtml({
      icon: def.icon,
      title: def.name,
      plus,
      grade: itemTipGradeLabel(def) || "?",
      gradeClass: "g-" + (def.grade || "C"),
      subtitle: "Броня",
      stats: [
        {
          k: "P.Def",
          v: String(pTot) + (pBonus > 0 ? " (+" + pBonus + ")" : ""),
        },
        {
          k: "M.Def",
          v: String(mTot) + (mBonus > 0 ? " (+" + mBonus + ")" : ""),
        },
      ],
      meta,
      actions: Array.isArray(ctx.actions)
        ? ctx.actions
        : equipActions || [
            noGrade ? "Без грейда — не точится" : "Клик — заточка",
            "Тяни на экип / кристаллизацию",
          ],
    });
  }

  const w = def;
  const plus = it.plus || 0;
  const p = typeof statAt === "function" ? statAt(w.patk, w.ps, plus) : w.patk || 0;
  const m = typeof statAt === "function" ? statAt(w.matk, w.ms, plus) : w.matk || 0;
  const ng = w.grade === "NG" || (typeof isNoGradeWeapon === "function" && isNoGradeWeapon(w));
  const fmtFn = typeof fmt === "function" ? fmt : String;
  const fmtA = typeof fmtAdena === "function" ? fmtAdena : String;
  const meta = slotExtra.slice();
  if (ng && !ctx.equipped) {
    meta.push(
      "NG — продажа из сумки за " +
        fmtA(typeof sellValue === "function" ? sellValue(w, 0) : 1000)
    );
  }
  if (Array.isArray(ctx.extraMeta)) meta.push(...ctx.extraMeta);
  return itemTipShellHtml({
    icon: w.icon,
    title: w.name,
    plus,
    grade: itemTipGradeLabel(w) || "NG",
    gradeClass: "g-" + (w.grade || "NG"),
    subtitle: "Оружие",
    stats: [
      { k: "P.Atk", v: fmtFn(p) },
      { k: "M.Atk", v: fmtFn(m) },
    ],
    meta,
    actions: Array.isArray(ctx.actions)
      ? ctx.actions
      : equipActions ||
        (ng
          ? ["Клик — продать"]
          : ["Клик — заточка", "Тяни на слот оружия / кристаллизацию"]),
  });
}

function itemTooltipHtmlFromStack(opts) {
  opts = opts || {};
  const qty = Math.max(0, Math.floor(Number(opts.qty) || 0));
  const meta = [];
  if (opts.role) meta.push(opts.role);
  if (opts.extra) meta.push(opts.extra);
  return itemTipShellHtml({
    icon: opts.icon,
    title: opts.name || "—",
    grade: opts.badge || "",
    gradeClass: opts.gradeClass || (opts.badge ? "g-" + opts.badge : ""),
    subtitle: opts.kind || "Стек",
    stats: qty > 0 ? [{ k: "Кол-во", v: "×" + (typeof fmt === "function" ? fmt(qty) : qty) }] : [],
    meta,
    actions: opts.actions || [],
  });
}

function itemTooltipHtmlFromGearSlot(slotLabel, item) {
  const label = slotLabel || "Слот";
  if (!item) {
    return itemTipShellHtml({
      title: label,
      subtitle: "Экипировка",
      meta: ["Пусто — клик, чтобы надеть"],
    });
  }
  return itemTooltipHtmlFromInvItem(item, { slotLabel: label, equipped: true });
}

function itemTooltipPlainFromInvItem(it) {
  if (!it || typeof invItemDef !== "function") return "";
  const def = invItemDef(it);
  if (!def) return "";
  if (typeof isShardItem === "function" && isShardItem(it)) {
    return def.name + "\n×" + Math.max(1, Math.floor(Number(it.qty) || 1));
  }
  const grade = itemTipGradeLabel(def);
  return def.name + (grade ? " [" + grade + "]" : "") + (it.plus ? " +" + it.plus : "");
}

function itemTooltipPlainFromStack(opts) {
  opts = opts || {};
  return (opts.name || "") + (opts.qty ? "\n×" + opts.qty : "");
}

function itemTooltipPlainFromGearSlot(slotLabel, item) {
  if (!item) return (slotLabel || "Слот") + " — пусто";
  const def = typeof avatarGearItemDef === "function" ? avatarGearItemDef(item) : null;
  return (
    (slotLabel || "Слот") +
    (def ? ": " + def.name + (item.plus ? " +" + item.plus : "") : "")
  );
}
