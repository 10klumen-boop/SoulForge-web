// ===== Enchant: UI и рендер =====
// Вынесено из 11-enchant.js; зависит от enchant-core.js (cur, busy).

function openEnchant(item, opts) {
  opts = opts || {};
  if (!item && opts.fromGear) item = typeof equippedWeaponItem === "function" ? equippedWeaponItem() : null;
  if (isAccessoryItem(item)) { openAccessory(item); return; }
  const w = WMAP[item.id]; if (!w) return;
  if (typeof weaponCanEnchant === "function" && !weaponCanEnchant(w)) {
    toast("«" + w.name + "» без грейда — не точится. Добывай оружие D+ в задании.", "warn");
    return;
  }
  normalizeInvItem(item);
  const equipped = opts.equipped || (typeof isEquippedWeaponItem === "function" && isEquippedWeaponItem(item));
  cur = { item, weapon: w, plus: item.plus || 0, broken: false, scroll: "regular", equipped };
  $("#enchTitle").textContent = w.name + (equipped ? " · надето" : "");
  renderScrolls(); renderEnch(true); show("ench");
}

function renderScrolls() {
  const box = $("#scrolls"); box.innerHTML = "";
  const grade = cur.weapon.grade;
  SCROLL_TYPES.forEach((t) => {
    const s = scrollFor(grade, t.id);
    const tier = s.tier || 1;
    const el = document.createElement("div");
    el.className = "scroll-opt scroll-tier-" + tier + (cur.scroll === s.id ? " sel" : "");
    el.dataset.tier = String(tier);
    el.innerHTML = `<div class="si"><img src="${s.icon}" alt="" onerror="this.style.visibility='hidden'"></div>` +
      `<div class="sm"><div class="st">${s.name} <span class="grade g-${grade}">${grade}</span></div><div class="sd">${s.desc}</div></div>` +
      `<div class="sc">${fmtAdena(s.cost)}<small>adena</small></div>`;
    el.onclick = () => { cur.scroll = s.id; Audio2.click(); renderScrolls(); renderEnch(); };
    box.appendChild(el);
  });
}

function notifyWeaponRecord(w, plus) {
  if (!bumpWeaponRecord(w.id, plus)) return;
  const nick =
    typeof getCloudNick === "function"
      ? getCloudNick()
      : (typeof SoulforgeCloud !== "undefined" ? SoulforgeCloud.getNick() : null);
  let msg = "Рекорд: +" + plus + " «" + w.name + "»";
  if (nick) msg += " · уходит в рейтинг";
  else if (typeof cloudEnabled === "function" && cloudEnabled()) msg += " · войди, чтобы в таблицу";
  if (typeof toast === "function") toast(msg, "success");
  if (typeof noteLeaderboardEvent === "function") {
    noteLeaderboardEvent("record", { weaponId: w.id, plus, grade: w.grade, weaponName: w.name });
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
  float.textContent = opts.maxed ? "+16!" : "+" + plus;
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
    stgImg.style.filter = broken ? "none" : `drop-shadow(0 0 ${glowInfo(cur.plus).blur.toFixed(0)}px ${glowInfo(cur.plus).color})`;
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
  const w = cur.weapon, broken = cur.broken;
  $("#stgName").textContent = w.name;
  $("#stgPlus").textContent = broken ? "разрушено" : "+" + cur.plus;
  $("#stgImg").src = w.icon;
  renderBrokenVisual(w, broken);

  const g = glowInfo(cur.plus);
  const aura = $("#aura"); aura.style.setProperty("--glow", g.color);
  aura.style.opacity = broken ? 0 : g.op.toFixed(2);

  const p = broken ? 0 : statAt(w.patk, w.ps, cur.plus);
  const m = broken ? 0 : statAt(w.matk, w.ms, cur.plus);
  const patkBox = $("#patk")?.closest(".box");
  if (patkBox) patkBox.hidden = false;
  $("#patk").innerHTML = `${fmt(p)} <small>${cur.plus > 0 ? "+" + w.ps * cur.plus : ""}</small>`;
  $("#matk").innerHTML = `${fmt(m)} <small>${cur.plus > 0 ? "+" + w.ms * cur.plus : ""}</small>`;

  const sc = scrollFor(w.grade, cur.scroll);
  const chance = successChance(cur.plus, sc.behavior);
  const safe = cur.plus < safeLevel();
  const capPlus = typeof scrollMaxPlus === "function" ? scrollMaxPlus(cur.scroll) : MAX_PLUS;
  $("#oddsVal").textContent = broken ? "—" : Math.round(chance * 100) + "%" + (safe ? " (безопасно)" : "");
  $("#costVal").textContent = fmtAdena(sc.cost);

  const maxed = cur.plus >= capPlus;
  const note = $("#safeNote");
  if (broken) { note.textContent = "Оружие разрушено — возьми новое"; note.style.color = "var(--red)"; }
  else if (maxed && capPlus >= MAX_PLUS) { note.textContent = "+16 — максимальная заточка!"; note.style.color = "var(--red)"; }
  else if (maxed && sc.behavior === "destruction") { note.textContent = "Свиток разрушения — максимум +15"; note.style.color = "var(--gold-soft)"; }
  else if (safe) { note.textContent = "+0…+3 — безопасная заточка"; note.style.color = "var(--green)"; }
  else if (sc.behavior === "guarantee") { note.textContent = "Кристальный свиток — гарантированный успех"; note.style.color = "var(--blue)"; }
  else if (sc.behavior === "destruction") { note.textContent = "Свиток разрушения — низкий шанс, провал не ломает (до +15)"; note.style.color = "var(--gold-soft)"; }
  else if (sc.behavior === "reset") { note.textContent = "Риск: провал откатит до +0"; note.style.color = "var(--gold-soft)"; }
  else { note.textContent = "Риск: провал разрушит оружие"; note.style.color = "var(--red)"; }
  if (!broken && !maxed) {
    const mystic = typeof avatarIsMystic === "function" && avatarIsMystic();
    if (mystic && typeof weaponAffinity === "function" && weaponAffinity(w) === "physical") {
      note.textContent = "Физическое оружие — для мага слабее";
      note.style.color = "var(--gold-soft)";
    } else if (!mystic && typeof weaponAffinity === "function" && weaponAffinity(w) === "magical") {
      note.textContent = "Магическое оружие — для воина слабее";
      note.style.color = "var(--gold-soft)";
    }
  }

  $("#pMax").textContent = "+" + weaponRecord(w.id);
  $("#pSpent").textContent = fmtAdena(cur.item.spent || 0);

  const canAfford = state.adena >= sc.cost;
  $("#enchBtn").disabled = busy || broken || maxed || !canAfford;
  $("#enchBtn").textContent = busy ? "Заточка…" : (broken ? "Разрушено" : (maxed ? (capPlus >= MAX_PLUS ? "Максимум +16" : "Максимум +15") : "Заточить ✦"));

  const sellable = !broken && canSellWeapon(w, cur.plus) && !cur.equipped;
  $("#sellBtn").disabled = !sellable;
  if (broken) {
    $("#sellBtn").textContent = "Нечего продавать";
  } else if (cur.equipped) {
    $("#sellBtn").textContent = "Снимите оружие, чтобы продать";
  } else if (isNgSellWeapon(w)) {
    $("#sellBtn").textContent = "Продать NG за " + fmtAdena(sellValue(w, cur.plus));
  } else if (canSell(cur.plus)) {
    $("#sellBtn").textContent = `Продать +${cur.plus} за ${fmtAdena(sellValue(w, cur.plus))}`;
  } else {
    $("#sellBtn").textContent = "Продать (нужно +4)";
  }

  if (resetVerdict) setVerdict("Удачи, авантюрист!", "neutral");
  $("#adena").textContent = fmt(state.adena);
}
function setVerdict(text, kind) { const v = $("#verdict"); v.textContent = text; v.className = "verdict " + kind; }

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
