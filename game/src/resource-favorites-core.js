// ===== Избранное ресурсов (дофарм): ProgressStore + резолв have/left =====
// Добавление — из Мастерской; строка прогресса — только HUD шахты.

const RESOURCE_FAV_CAP = 8;

function getResourceFavorites() {
  const list = state && state.resourceFavorites;
  return Array.isArray(list) ? list : [];
}

function isResourceFavorited(kind, id) {
  const k = String(kind || "");
  const i = String(id || "");
  return getResourceFavorites().some((e) => e && e.kind === k && String(e.id) === i);
}

function getResourceFavoriteHave(kind, id) {
  const k = String(kind || "");
  const i = String(id || "");
  if (k === "ore") return Math.max(0, Math.floor(Number(state.materials?.[i]) || 0));
  if (k === "crystal") return Math.max(0, Math.floor(Number(state.crystals?.[i]) || 0));
  if (k === "frag") {
    if (typeof armorFragCount === "function") return Math.max(0, Math.floor(Number(armorFragCount(i)) || 0));
    return Math.max(0, Math.floor(Number(state.materials?.[i]) || 0));
  }
  if (k === "shot") {
    const parts = i.split(":");
    const ty = parts[0];
    const g = parts[1];
    return Math.max(0, Math.floor(Number(state.shots?.[ty]?.[g]) || 0));
  }
  return 0;
}

function resolveResourceFavoriteMeta(kind, id) {
  const k = String(kind || "");
  const i = String(id || "");
  if (k === "ore") {
    const o = typeof ORE !== "undefined" ? ORE[i] : null;
    return o ? { name: o.name, icon: o.icon } : { name: i, icon: "" };
  }
  if (k === "crystal") {
    return {
      name: "Crystal " + i,
      icon: (typeof CRYSTAL_ICON !== "undefined" && CRYSTAL_ICON[i]) || "",
      grade: i,
    };
  }
  if (k === "frag") {
    const def = typeof armorFragDef === "function" ? armorFragDef(i) : (typeof ARMOR_FRAGS !== "undefined" ? ARMOR_FRAGS[i] : null);
    return def ? { name: def.name, icon: def.icon } : { name: i, icon: "" };
  }
  if (k === "shot") {
    const parts = i.split(":");
    const ty = parts[0];
    const g = parts[1];
    const label =
      (typeof SHOT_TYPE !== "undefined" && SHOT_TYPE[ty] && SHOT_TYPE[ty].item) || ty || "Shot";
    const icon =
      (typeof SHOT_ICON !== "undefined" && SHOT_ICON[ty] && SHOT_ICON[ty][g]) || "";
    return { name: label + " " + g, icon, grade: g };
  }
  return { name: i, icon: "" };
}

function upsertResourceFavorite(kind, id, target) {
  const k = String(kind || "");
  const i = String(id || "");
  const t = Math.max(1, Math.floor(Number(target) || 0));
  if (!k || !i || !(t >= 1)) return false;
  if (typeof ProgressStore === "undefined") return false;
  let list = getResourceFavorites().slice();
  const idx = list.findIndex((e) => e && e.kind === k && String(e.id) === i);
  if (idx >= 0) list[idx] = { kind: k, id: i, target: t };
  else {
    if (list.length >= RESOURCE_FAV_CAP) {
      if (typeof toast === "function") toast("Избранное: максимум " + RESOURCE_FAV_CAP, "warn");
      return false;
    }
    list.push({ kind: k, id: i, target: t });
  }
  ProgressStore.set("resourceFavorites", list);
  return true;
}

function removeResourceFavorite(kind, id) {
  const k = String(kind || "");
  const i = String(id || "");
  if (typeof ProgressStore === "undefined") return false;
  const next = getResourceFavorites().filter((e) => !(e && e.kind === k && String(e.id) === i));
  ProgressStore.set("resourceFavorites", next);
  return true;
}

function listResourceFavoritesResolved() {
  return getResourceFavorites()
    .map((e) => {
      if (!e || !e.kind || e.id == null) return null;
      const have = getResourceFavoriteHave(e.kind, e.id);
      const target = Math.max(1, Math.floor(Number(e.target) || 1));
      const left = Math.max(0, target - have);
      const meta = resolveResourceFavoriteMeta(e.kind, e.id);
      return {
        kind: e.kind,
        id: String(e.id),
        target,
        have,
        left,
        done: left <= 0,
        name: meta.name || String(e.id),
        icon: meta.icon || "",
        grade: meta.grade || "",
      };
    })
    .filter(Boolean);
}

/** prompt цели; пустой/0/отмена на существующем — снять. */
function promptResourceFavorite(kind, id, defaultTarget) {
  const k = String(kind || "");
  const i = String(id || "");
  if (!k || !i) return;
  const existing = getResourceFavorites().find((e) => e && e.kind === k && String(e.id) === i);
  const def = existing ? existing.target : Math.max(1, Math.floor(Number(defaultTarget) || 1));
  const meta = resolveResourceFavoriteMeta(k, i);
  const raw = window.prompt(
    (meta.name || i) + "\nЦель (сколько нужно). 0 — убрать из избранного:",
    String(def)
  );
  if (raw === null) return;
  const cleaned = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  const n = Math.floor(Number(cleaned));
  if (!(n >= 1)) {
    if (existing) {
      removeResourceFavorite(k, i);
      if (typeof toast === "function") toast("Убрано из избранного", "info");
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
    }
  } else if (upsertResourceFavorite(k, i, n)) {
    if (typeof toast === "function") toast("★ " + (meta.name || i) + " · цель " + fmt(n), "info");
    if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  }
  if (typeof renderMineResourceFavorites === "function") renderMineResourceFavorites();
  if (document.getElementById("screen-shop")?.classList?.contains("active") && typeof renderWorkshop === "function") {
    renderWorkshop();
  }
}
