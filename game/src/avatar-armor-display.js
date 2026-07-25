// ===== Бейдж надетого сета на экране персонажа =====
// Сам портрет меняется на ivory-рендер в 34-avatar-portraits.js.

/** Сет с наибольшим числом надетых кусков (минимум 1). */
function avatarDominantEquippedSet() {
  if (typeof equippedArmorSetCounts !== "function" || typeof ARMOR_SETS === "undefined") return null;
  const counts = equippedArmorSetCounts();
  let best = null;
  Object.keys(counts).forEach((setId) => {
    const n = counts[setId] || 0;
    if (n < 1) return;
    const def = ARMOR_SETS[setId];
    if (!def) return;
    if (!best || n > best.pieces) {
      best = { id: setId, name: def.name, kind: def.kind, grade: def.grade, pieces: n, def };
    }
  });
  return best;
}

function avatarSetChestIcon(setDef) {
  if (!setDef || !setDef.pieces || typeof AMAP === "undefined") return "";
  for (let i = 0; i < setDef.pieces.length; i++) {
    const a = AMAP[setDef.pieces[i]];
    if (a && a.slot === "chest" && a.icon) return a.icon;
  }
  const first = AMAP[setDef.pieces[0]];
  return first?.icon || "";
}

function avatarSetGlowColor(setDef) {
  if (!setDef || !setDef.pieces || typeof AMAP === "undefined") return "";
  for (let i = 0; i < setDef.pieces.length; i++) {
    const a = AMAP[setDef.pieces[i]];
    if (a?.glow) return a.glow;
  }
  return "";
}

function renderAvatarSetBadge() {
  const badge = document.getElementById("avatarSetBadge");
  const wrap = document.querySelector(".avatar-portrait-wrap");
  if (!badge) return;
  const set = avatarDominantEquippedSet();
  const min =
    typeof AVATAR_SET_PORTRAIT_MIN_PIECES === "number" ? AVATAR_SET_PORTRAIT_MIN_PIECES : 2;
  if (!set || set.pieces < 1) {
    badge.hidden = true;
    badge.innerHTML = "";
    badge.style.removeProperty("--set-glow");
    if (wrap) {
      wrap.classList.remove("has-set", "set-complete");
      wrap.style.removeProperty("--set-glow");
    }
    return;
  }
  const ico = avatarSetChestIcon(set.def);
  const glow = avatarSetGlowColor(set.def);
  const complete = set.pieces >= 5;
  const kindLabel =
    (typeof ARMOR_KIND_LABELS !== "undefined" && ARMOR_KIND_LABELS[set.kind]) || set.kind || "";
  badge.hidden = false;
  if (glow) badge.style.setProperty("--set-glow", glow);
  else badge.style.removeProperty("--set-glow");
  badge.className = "avatar-set-badge" + (complete ? " is-complete" : "");
  badge.innerHTML =
    (ico ? '<img class="avatar-set-badge-ico" src="' + ico + '" alt="">' : "") +
    '<div class="avatar-set-badge-text">' +
    "<b>" +
    set.name +
    "</b>" +
    "<span>" +
    set.pieces +
    "/5" +
    (kindLabel ? " · " + kindLabel : "") +
    (complete ? " · полный сет" : set.pieces >= min ? " · на портрете" : "") +
    "</span></div>";
  if (wrap) {
    wrap.classList.toggle("has-set", set.pieces >= min);
    wrap.classList.toggle("set-complete", complete);
    if (glow) wrap.style.setProperty("--set-glow", glow);
    else wrap.style.removeProperty("--set-glow");
  }
}

function renderAvatarArmorDisplay() {
  const overlay = document.getElementById("avatarArmorOverlay");
  if (overlay) {
    overlay.hidden = true;
    overlay.innerHTML = "";
  }
  const wrap = document.querySelector(".avatar-portrait-wrap");
  if (wrap) wrap.classList.remove("has-armor");
  renderAvatarSetBadge();
}
