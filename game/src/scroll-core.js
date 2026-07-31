// ===== Свитки заточки: стаки weapon/armor × type × grade =====

const SCROLL_TARGETS = ["weapon", "armor"];
const SCROLL_GRADES = ["D", "C", "B", "A"];
const SCROLL_TYPE_IDS = ["regular", "blessed", "destruction", "crystal"];

function emptyScrollGradeMap() {
  return { D: 0, C: 0, B: 0, A: 0 };
}

function emptyScrollTypeMap() {
  return {
    regular: emptyScrollGradeMap(),
    blessed: emptyScrollGradeMap(),
    destruction: emptyScrollGradeMap(),
    crystal: emptyScrollGradeMap(),
  };
}

function emptyScrollsState() {
  return {
    weapon: emptyScrollTypeMap(),
    armor: emptyScrollTypeMap(),
  };
}

function ensureScrollsState() {
  if (!state.scrolls || typeof state.scrolls !== "object") {
    if (typeof ProgressStore !== "undefined" && ProgressStore.set) {
      ProgressStore.set("scrolls", emptyScrollsState());
    } else {
      state.scrolls = emptyScrollsState();
    }
    return state.scrolls;
  }
  let dirty = false;
  const next = JSON.parse(JSON.stringify(state.scrolls));
  // Миграция: отдельный target jewelry → armor (один свиток брони/бижу, как в L2).
  if (next.jewelry && typeof next.jewelry === "object") {
    if (!next.armor || typeof next.armor !== "object") next.armor = emptyScrollTypeMap();
    SCROLL_TYPE_IDS.forEach((typeId) => {
      if (!next.jewelry[typeId]) return;
      if (!next.armor[typeId] || typeof next.armor[typeId] !== "object") {
        next.armor[typeId] = emptyScrollGradeMap();
      }
      SCROLL_GRADES.forEach((g) => {
        const add = Math.max(0, Math.floor(Number(next.jewelry[typeId][g]) || 0));
        if (add > 0) {
          next.armor[typeId][g] = Math.max(0, Math.floor(Number(next.armor[typeId][g]) || 0)) + add;
          dirty = true;
        }
      });
    });
    delete next.jewelry;
    dirty = true;
  }
  SCROLL_TARGETS.forEach((target) => {
    if (!next[target] || typeof next[target] !== "object") {
      next[target] = emptyScrollTypeMap();
      dirty = true;
    }
    SCROLL_TYPE_IDS.forEach((typeId) => {
      if (!next[target][typeId] || typeof next[target][typeId] !== "object") {
        next[target][typeId] = emptyScrollGradeMap();
        dirty = true;
      }
      SCROLL_GRADES.forEach((g) => {
        const n = Math.max(0, Math.floor(Number(next[target][typeId][g]) || 0));
        if (next[target][typeId][g] !== n) {
          next[target][typeId][g] = n;
          dirty = true;
        }
      });
    });
  });
  if (dirty) {
    if (typeof ProgressStore !== "undefined" && ProgressStore.set) ProgressStore.set("scrolls", next);
    else state.scrolls = next;
  }
  return state.scrolls;
}

function normalizeScrollTarget(target) {
  const t = String(target || "").toLowerCase();
  // jewelry/accessory → armor: один свиток на броню и бижутерию
  if (t === "armor" || t === "jewelry" || t === "accessory" || t === "jewels") return "armor";
  if (t === "weapon") return "weapon";
  return null;
}

function normalizeScrollTypeId(typeId) {
  const id = String(typeId || "").toLowerCase();
  return SCROLL_TYPE_IDS.indexOf(id) >= 0 ? id : null;
}

function normalizeScrollGrade(grade) {
  const g = String(grade || "").toUpperCase();
  return SCROLL_GRADES.indexOf(g) >= 0 ? g : null;
}

function scrollQty(target, typeId, grade) {
  ensureScrollsState();
  const t = normalizeScrollTarget(target);
  const ty = normalizeScrollTypeId(typeId);
  const g = normalizeScrollGrade(grade);
  if (!t || !ty || !g) return 0;
  return Math.max(0, Math.floor(Number(state.scrolls[t][ty][g]) || 0));
}

function hasScroll(target, typeId, grade, qty) {
  const need = Math.max(1, Math.floor(Number(qty) || 1));
  return scrollQty(target, typeId, grade) >= need;
}

function addScroll(target, typeId, grade, qty) {
  const t = normalizeScrollTarget(target);
  const ty = normalizeScrollTypeId(typeId);
  const g = normalizeScrollGrade(grade);
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (!t || !ty || !g || n < 1) return false;
  ensureScrollsState();
  ProgressStore.update("scrolls", (s) => {
    const next = JSON.parse(JSON.stringify(s || emptyScrollsState()));
    if (!next[t]) next[t] = emptyScrollTypeMap();
    if (!next[t][ty]) next[t][ty] = emptyScrollGradeMap();
    next[t][ty][g] = Math.max(0, Math.floor(Number(next[t][ty][g]) || 0)) + n;
    return next;
  });
  return true;
}

/** Списать свитки. false если не хватает. */
function consumeScroll(target, typeId, grade, qty) {
  const t = normalizeScrollTarget(target);
  const ty = normalizeScrollTypeId(typeId);
  const g = normalizeScrollGrade(grade);
  const n = Math.max(1, Math.floor(Number(qty) || 1));
  if (!t || !ty || !g) return false;
  if (!hasScroll(t, ty, g, n)) return false;
  ProgressStore.update("scrolls", (s) => {
    const next = JSON.parse(JSON.stringify(s || emptyScrollsState()));
    if (!next[t] || typeof next[t] !== "object") next[t] = emptyScrollTypeMap();
    if (!next[t][ty] || typeof next[t][ty] !== "object") next[t][ty] = emptyScrollGradeMap();
    next[t][ty][g] = Math.max(0, Math.floor(Number(next[t][ty][g]) || 0) - n);
    return next;
  });
  return true;
}

/**
 * Описание свитка для UI/рынка.
 * cost — только оценка (GRADE_BASE_PRICE), не списывается при заточке.
 */
function scrollDef(target, grade, typeId) {
  const tTarget = normalizeScrollTarget(target) || "weapon";
  const t = (typeof SCROLL_TYPES !== "undefined" ? SCROLL_TYPES : []).find((x) => x.id === typeId) ||
    (typeof SCROLL_TYPES !== "undefined" ? SCROLL_TYPES[0] : { id: "regular", name: "Свиток", behavior: "break", desc: "", mult: 1 });
  const g = normalizeScrollGrade(grade) || "D";
  const icon =
    typeof scrollTierIcon === "function"
      ? scrollTierIcon(t.id, g, tTarget)
      : tTarget === "armor" && typeof SCROLL_ARMOR_ICON !== "undefined"
        ? SCROLL_ARMOR_ICON[g]
        : typeof SCROLL_ICON !== "undefined"
          ? SCROLL_ICON[g]
          : "";
  const base =
    typeof tune === "function"
      ? tune("scroll.price." + g, typeof GRADE_BASE_PRICE !== "undefined" ? GRADE_BASE_PRICE[g] : 50000)
      : typeof GRADE_BASE_PRICE !== "undefined"
        ? GRADE_BASE_PRICE[g]
        : 50000;
  const mult =
    typeof tune === "function" ? tune("scroll.mult." + t.id, t.mult) : t.mult || 1;
  const name = tTarget === "armor" ? t.nameArmor || t.name : t.name;
  let desc = tTarget === "armor" && t.descArmor ? t.descArmor : t.desc || "";
  if (tTarget === "armor" && !t.descArmor) {
    desc = desc
      .replace(/оружие/gi, "броня / бижутерия")
      .replace(/Оружие/g, "Броня / бижутерия")
      .replace(/оружия/gi, "брони / бижутерии");
  }
  return {
    id: t.id,
    target: tTarget,
    name,
    behavior: t.behavior,
    desc,
    icon,
    tier: (typeof SCROLL_TIER !== "undefined" ? SCROLL_TIER[t.id] : 1) || 1,
    /** Оценка для рынка, не стоимость заточки. */
    estimate: Math.round(base * mult),
    cost: 0,
    qty: scrollQty(tTarget, t.id, g),
    grade: g,
  };
}

/** Совместимость: старый scrollFor = оценка weapon-свитка. */
function scrollFor(grade, typeId) {
  const s = scrollDef("weapon", grade, typeId);
  s.cost = s.estimate;
  return s;
}

function scrollLabel(target, typeId, grade) {
  const s = scrollDef(target, grade, typeId);
  return s.name + " " + (s.grade || grade || "");
}

function listScrollStacks() {
  ensureScrollsState();
  const out = [];
  SCROLL_TARGETS.forEach((target) => {
    SCROLL_TYPE_IDS.forEach((typeId) => {
      SCROLL_GRADES.forEach((grade) => {
        const qty = scrollQty(target, typeId, grade);
        if (qty <= 0) return;
        const def = scrollDef(target, grade, typeId);
        out.push({
          kind: "scroll",
          target,
          typeId,
          grade,
          qty,
          name: scrollLabel(target, typeId, grade),
          icon: def.icon,
          estimate: def.estimate,
        });
      });
    });
  });
  return out;
}

function scrollDropGradeForZone(zoneId) {
  const zid =
    typeof resolveFarmZoneId === "function" ? resolveFarmZoneId(zoneId) : zoneId;
  let zone = null;
  if (typeof farmZoneById === "function") {
    zone = farmZoneById(zid);
  } else if (typeof FARM_ZONES !== "undefined" && Array.isArray(FARM_ZONES)) {
    zone = FARM_ZONES.find((x) => x && x.id === zid) || null;
  } else if (typeof getFarmZone === "function") {
    zone = getFarmZone(zid) || null;
  }
  // Сюжетные главы: только D
  if (zone && !zone.side) return "D";
  // Охота: банда L2 mid (≤30 D, 30+ C) — важнее lootTags
  if (zone && zone.side && typeof farmZoneLootGrade === "function") {
    return farmZoneLootGrade(zone);
  }
  // lootTags — fallback (B/A в тегах пока кап в C — для следующих обновлений)
  const tags = zone && Array.isArray(zone.lootTags) ? zone.lootTags : null;
  if (tags && tags.length) {
    const rank = { scroll_d: 1, scroll_c: 2, scroll_b: 2, scroll_a: 2 };
    let best = 0;
    let grade = null;
    tags.forEach((t) => {
      const r = rank[t];
      if (r && r > best) {
        best = r;
        grade = t === "scroll_d" ? "D" : "C";
      }
    });
    if (grade) return grade;
  }
  const map = typeof SCROLL_DROP_ZONE_GRADE !== "undefined" ? SCROLL_DROP_ZONE_GRADE : null;
  if (map && map[zid]) {
    const g = map[zid];
    return g === "B" || g === "A" ? "C" : g;
  }
  let chapter = 1;
  if (zone && zone.chapter) chapter = zone.chapter | 0;
  else if (typeof farmZoneProgressChapter === "function" && zone) {
    chapter = farmZoneProgressChapter(zone);
  }
  const cg = typeof SCROLL_DROP_CHAPTER_GRADE !== "undefined" ? SCROLL_DROP_CHAPTER_GRADE : null;
  if (cg && cg[chapter]) return cg[chapter];
  if (chapter <= 3) return "D";
  return "C";
}

function _pickWeighted(weights) {
  const entries = Object.keys(weights || {}).map((k) => ({ k, w: Math.max(0, Number(weights[k]) || 0) }));
  const sum = entries.reduce((a, e) => a + e.w, 0);
  if (sum <= 0) return "regular";
  let r = Math.random() * sum;
  for (let i = 0; i < entries.length; i++) {
    r -= entries[i].w;
    if (r <= 0) return entries[i].k;
  }
  return entries[entries.length - 1].k;
}

/**
 * Ролл дропа свитка. null если не выпал.
 * @returns {{ target, typeId, grade, qty, def }|null}
 */
function rollScrollDrop(zoneId, mobType) {
  const type = mobType === "boss" || mobType === "golden" ? mobType : "normal";
  const chanceMap = typeof SCROLL_DROP_CHANCE !== "undefined" ? SCROLL_DROP_CHANCE : null;
  let chance = chanceMap ? chanceMap[type] || 0 : 0;
  // Сюжет: свитки реже
  let zone = null;
  if (typeof farmZoneById === "function") zone = farmZoneById(zoneId);
  else if (typeof FARM_ZONES !== "undefined" && Array.isArray(FARM_ZONES)) {
    zone = FARM_ZONES.find((x) => x && x.id === zoneId) || null;
  }
  if (zone && !zone.side) {
    const mult =
      typeof SCROLL_DROP_STORY_MULT === "number" ? SCROLL_DROP_STORY_MULT : 0.35;
    chance *= mult;
  }
  if (!(chance > 0) || Math.random() >= chance) return null;
  const grade = scrollDropGradeForZone(zoneId);
  const weightsTarget =
    typeof SCROLL_DROP_TARGET_WEIGHTS !== "undefined" ? SCROLL_DROP_TARGET_WEIGHTS : null;
  let target = "weapon";
  if (weightsTarget) {
    target = _pickWeighted(weightsTarget);
  } else {
    const share =
      typeof SCROLL_DROP_WEAPON_SHARE === "number" ? SCROLL_DROP_WEAPON_SHARE : 0.55;
    target = Math.random() < share ? "weapon" : "armor";
  }
  if (!normalizeScrollTarget(target)) target = "weapon";
  const weightsMap =
    typeof SCROLL_DROP_TYPE_WEIGHTS !== "undefined" ? SCROLL_DROP_TYPE_WEIGHTS : null;
  const weights = (weightsMap && weightsMap[type]) || { regular: 1 };
  const typeId = _pickWeighted(weights);
  const def = scrollDef(target, grade, typeId);
  return { target, typeId, grade, qty: 1, def };
}
