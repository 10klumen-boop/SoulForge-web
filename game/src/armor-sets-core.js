// ===== Броня / сеты: helpers + avatarSetBonuses + фрагменты / крафт =====

function isArmorItem(it) {
  if (!it) return false;
  if (it.kind === "armor") return true;
  return !!(typeof AMAP !== "undefined" && AMAP[it.id]);
}

function armorItemDef(it) {
  if (!it || typeof AMAP === "undefined") return null;
  return AMAP[it.id] || null;
}

function armorSlotType(it) {
  const def = armorItemDef(it);
  return def?.slot || null;
}

function armorFragDef(fragId) {
  if (!fragId || typeof ARMOR_FRAGS === "undefined") return null;
  const resolved = typeof resolveArmorFragId === "function" ? resolveArmorFragId(fragId) : fragId;
  return ARMOR_FRAGS[resolved] || ARMOR_FRAGS[fragId] || null;
}

/** Legacy `{armorId}_piece` → `{setId}_material`. */
function resolveArmorFragId(fragId) {
  const id = String(fragId || "");
  if (!id) return id;
  if (typeof ARMOR_FRAGS !== "undefined" && ARMOR_FRAGS[id]) return id;
  const setId =
    typeof LEGACY_ARMOR_FRAG_TO_SET !== "undefined" ? LEGACY_ARMOR_FRAG_TO_SET[id] : null;
  if (setId && typeof armorSetMaterialId === "function") return armorSetMaterialId(setId);
  return id;
}

/** Enchant: доля шанса → «+0.10% (~+0.1 к 100 зат.)». */
function formatArmorEnchantBonus(enchant) {
  const e = Number(enchant) || 0;
  if (!(e > 0)) return "";
  const pct = (e * 100).toFixed(2);
  const per100 = (e * 100).toFixed(1);
  return "+" + pct + "% заточка (~+" + per100 + " к 100 зат.)";
}

/** Части бонуса порога (без префикса «N шт.»). */
function formatArmorBonusParts(b) {
  if (!b) return [];
  const parts = [];
  if (b.armorSustain) parts.push("−" + Math.round(b.armorSustain * 100) + "% HP golden/boss");
  if (b.pdef) parts.push("+" + b.pdef + " P.Def");
  if (b.mdef) parts.push("+" + b.mdef + " M.Def");
  if (b.mineAdena) parts.push("+" + Math.round(b.mineAdena * 100) + "% adena");
  if (b.enchant) parts.push(formatArmorEnchantBonus(b.enchant));
  if (b.bossResist) parts.push("−" + Math.round(b.bossResist * 100) + "% HP босса зоны");
  if (b.mineXp) parts.push("+" + Math.round(b.mineXp * 100) + "% XP фарма");
  if (b.pvpAtk) parts.push("+" + Math.round(b.pvpAtk * 1000) / 10 + "% ATK арены");
  if (b.pvpDef) parts.push("+" + Math.round(b.pvpDef * 1000) / 10 + "% DEF арены");
  if (b.pvpHp) parts.push("+" + Math.round(b.pvpHp) + " HP арены");
  return parts;
}

function formatArmorSetBonusLine(th, b) {
  const parts = formatArmorBonusParts(b);
  return th + " шт.: " + (parts.join(" · ") || "—");
}

/** Σ P.Def / M.Def кусков сета. */
function armorSetPieceDefTotals(setId) {
  const out = { pdef: 0, mdef: 0, pieces: 0 };
  const setDef = typeof ARMOR_SETS !== "undefined" ? ARMOR_SETS[setId] : null;
  const pieces = setDef?.pieces || [];
  pieces.forEach((id) => {
    const a = typeof AMAP !== "undefined" ? AMAP[id] : null;
    if (!a) return;
    out.pdef += a.pdef || 0;
    out.mdef += a.mdef || 0;
    out.pieces++;
  });
  return out;
}

/**
 * Оценка sustain только от Σ DEF полного сета (без set armorSustain).
 * Та же формула, что avatarArmorSustainPct от def.
 */
function armorSetDefSustainEstimate(setId) {
  const tot = armorSetPieceDefTotals(setId);
  const weighted = (tot.pdef || 0) + (tot.mdef || 0) * 0.5;
  const div = typeof ARMOR_SUSTAIN_DEF_DIV === "number" ? ARMOR_SUSTAIN_DEF_DIV : 620;
  const fromDefCap = typeof ARMOR_SUSTAIN_FROM_DEF_CAP === "number" ? ARMOR_SUSTAIN_FROM_DEF_CAP : 0.1;
  return Math.min(fromDefCap, weighted / Math.max(1, div));
}

/** Короткие строки превью для карточки сета в мастерской. */
function armorSetBonusPreviewLines(setId, maxLines) {
  maxLines = maxLines || 4;
  const setDef = typeof ARMOR_SETS !== "undefined" ? ARMOR_SETS[setId] : null;
  if (!setDef) return [];
  const lines = [];
  const tot = armorSetPieceDefTotals(setId);
  const defSus = armorSetDefSustainEstimate(setId);
  lines.push(
    "Σ P.Def " + tot.pdef + " · M.Def " + tot.mdef +
      (defSus > 0 ? " → ≈−" + Math.round(defSus * 100) + "% HP (от DEF)" : "")
  );
  const tiers = setDef.bonuses || {};
  [2, 4, 5].forEach((th) => {
    if (!tiers[th]) return;
    const short = formatArmorBonusParts(tiers[th]).join(", ");
    if (short) lines.push(th + ": " + short);
  });
  return lines.slice(0, maxLines);
}

function armorFragCount(fragId) {
  if (!fragId || !state.materials) return 0;
  return state.materials[fragId] || 0;
}

function addArmorFrag(fragId, qty, meta) {
  const resolved = resolveArmorFragId(fragId);
  const def = armorFragDef(resolved);
  if (!def || !(qty > 0)) return null;
  if (typeof ensureWorkshopState === "function") ensureWorkshopState();
  ProgressStore.update("materials", (m) => {
    const next = { ...(m || { soul: 0, spirit: 0 }) };
    next[resolved] = (next[resolved] || 0) + qty;
    return next;
  });
  if (typeof save === "function") save();
  // Без toast: материалы часто падают и перекрывают action bar; feedback — floatText / дроп сессии.
  if (meta?.notify && typeof toast === "function") {
    toast("🔩 " + def.name + " ×" + qty, "loot");
  }
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("loot_armor_frag", {
      fragId: resolved,
      qty,
      source: meta?.source || "unknown",
      zoneId: meta?.zoneId || state.farmZone || null,
    });
  }
  if (typeof renderMineResourceFavorites === "function") renderMineResourceFavorites();
  return { def, qty, fragId: resolved };
}

function addArmorToInventory(armorId, meta) {
  const def = typeof AMAP !== "undefined" ? AMAP[armorId] : null;
  if (!def) return null;
  if (!state.inventory) state.inventory = [];
  const it = { uid: typeof uid === "function" ? uid() : String(Date.now()), id: armorId, kind: "armor" };
  if (meta?.craftOpt) it.craftOpt = meta.craftOpt;
  if (typeof isInventoryFull === "function" && isInventoryFull()) {
    if (typeof enqueueOverflowLoot === "function" && enqueueOverflowLoot(it, { source: meta?.source || "armor" })) {
      return it;
    }
    if (typeof toast === "function") toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
  const inv = (state.inventory || []).slice();
  inv.push(it);
  ProgressStore.set("inventory", inv);
  if (typeof save === "function") save();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("loot_armor", {
      armorId,
      armorName: def.name,
      grade: def.grade || null,
      slot: def.slot || null,
      source: meta?.source || "unknown",
      zoneId: meta?.zoneId || state.farmZone || null,
      craftOpt: meta?.craftOpt || null,
    });
  }
  return it;
}

/** Сколько кусков каждого сета надето. */
function equippedArmorSetCounts() {
  const counts = {};
  if (typeof iterEquippedGear !== "function") return counts;
  iterEquippedGear().forEach(({ item }) => {
    if (!isArmorItem(item)) return;
    const def = armorItemDef(item);
    if (!def?.setId) return;
    counts[def.setId] = (counts[def.setId] || 0) + 1;
  });
  return counts;
}

/**
 * Активные бонусы сетов: farm (sustain/adena/xp/enchant/boss) + PvP (pvpAtk/pvpDef/pvpHp).
 * Пороги 2 / 4 / 5 — суммируются (полный сет получает все ступени).
 * Только сеты своего kind (professionArmorPref) — иначе маг в heavy / микс 2pc.
 */
function avatarSetBonuses() {
  const out = {
    pdef: 0,
    mdef: 0,
    armorSustain: 0,
    mineAdena: 0,
    enchant: 0,
    bossResist: 0,
    mineXp: 0,
    pvpAtk: 0,
    pvpDef: 0,
    pvpHp: 0,
    sets: [],
  };
  if (typeof ARMOR_SETS === "undefined" || !ARMOR_SETS) return out;
  const counts = equippedArmorSetCounts();
  const avatar = typeof state !== "undefined" ? state.avatar : null;
  const lv =
    typeof avatarLevelForGrade === "function"
      ? avatarLevelForGrade(avatar)
      : (avatar?.level || 1);
  const pref =
    typeof professionArmorPref === "function" ? professionArmorPref(avatar) : null;
  Object.keys(counts).forEach((setId) => {
    const set = ARMOR_SETS[setId];
    if (!set) return;
    const n = counts[setId] || 0;
    // Куски выше дозволенного грейда — сет-бонусы не работают.
    if (typeof isGradeOverLevel === "function" && set.grade && isGradeOverLevel(set.grade, lv)) {
      return;
    }
    // Чужой kind (роба-класс в heavy, или 2pc мимо сродства) — без бонусов.
    if (pref && set.kind && set.kind !== pref) return;
    const active = [];
    const tiers = set.bonuses || {};
    [2, 4, 5].forEach((th) => {
      if (n < th || !tiers[th]) return;
      const b = tiers[th];
      if (b.pdef) out.pdef += b.pdef;
      if (b.mdef) out.mdef += b.mdef;
      if (b.armorSustain) out.armorSustain += b.armorSustain;
      if (b.mineAdena) out.mineAdena += b.mineAdena;
      if (b.enchant) out.enchant += b.enchant;
      if (b.bossResist) out.bossResist += b.bossResist;
      if (b.mineXp) out.mineXp += b.mineXp;
      if (b.pvpAtk) out.pvpAtk += b.pvpAtk;
      if (b.pvpDef) out.pvpDef += b.pvpDef;
      if (b.pvpHp) out.pvpHp += b.pvpHp;
      active.push(th);
    });
    if (active.length) {
      out.sets.push({ id: setId, name: set.name, pieces: n, tiers: active, kind: set.kind });
    }
  });
  return out;
}

/** Множитель статов куска брони: грейд × чужой kind. */
function armorPiecePowerMult(def, avatar) {
  if (!def) return 1;
  const a = avatar || (typeof state !== "undefined" ? state.avatar : null);
  const lv =
    typeof avatarLevelForGrade === "function" ? avatarLevelForGrade(a) : a?.level || 1;
  let m = typeof avatarGradePenaltyMult === "function" ? avatarGradePenaltyMult(def.grade, lv) : 1;
  const pref = typeof professionArmorPref === "function" ? professionArmorPref(a) : null;
  if (pref && def.setId && typeof ARMOR_SETS !== "undefined" && ARMOR_SETS[def.setId]) {
    const kind = ARMOR_SETS[def.setId].kind;
    if (kind && kind !== pref) {
      const off = typeof OFF_ARMOR_DEF_MULT === "number" ? OFF_ARMOR_DEF_MULT : 0.42;
      m *= off;
    }
  }
  return m;
}

/** Макс. заточка брони (+12). */
function armorMaxPlus() {
  return typeof ARMOR_MAX_PLUS === "number" ? ARMOR_MAX_PLUS : 12;
}

/** Бонус P.Def от заточки брони (+N). */
function armorEnchantPdefBonus(plus) {
  const cap = armorMaxPlus();
  return Math.max(0, Math.min(cap, plus | 0)) * 2;
}

/** Бонус M.Def от заточки брони (+N). */
function armorEnchantMdefBonus(plus) {
  const cap = armorMaxPlus();
  return Math.max(0, Math.min(cap, plus | 0));
}

/** P.Def/M.Def от кусков брони (+ legacy set flat) — не в farm power. */
function avatarArmorDefBonuses() {
  const out = { pdef: 0, mdef: 0 };
  const avatar = typeof state !== "undefined" ? state.avatar : null;
  if (typeof iterEquippedGear === "function") {
    iterEquippedGear().forEach(({ item }) => {
      if (!isArmorItem(item)) return;
      const def = armorItemDef(item);
      if (!def) return;
      const mult = armorPiecePowerMult(def, avatar);
      const plus = item.plus || 0;
      const pAdd = typeof armorEnchantPdefBonus === "function" ? armorEnchantPdefBonus(plus) : plus * 2;
      const mAdd = typeof armorEnchantMdefBonus === "function" ? armorEnchantMdefBonus(plus) : plus;
      let pBase = (def.pdef || 0) + pAdd;
      let mBase = (def.mdef || 0) + mAdd;
      if (item.craftOpt?.key === "pdef") pBase += Number(item.craftOpt.value) || 0;
      if (item.craftOpt?.key === "mdef") mBase += Number(item.craftOpt.value) || 0;
      out.pdef += Math.round(pBase * mult);
      out.mdef += Math.round(mBase * mult);
    });
  }
  const set = avatarSetBonuses();
  out.pdef += set.pdef || 0;
  out.mdef += set.mdef || 0;
  if (typeof avatarArmorAffinityMult === "function") {
    const m = avatarArmorAffinityMult(avatar);
    if (m > 1) {
      out.pdef = Math.round(out.pdef * m);
      out.mdef = Math.round(out.mdef * m);
    }
  }
  return out;
}

/**
 * Доля снижения HP golden/boss от P.Def/M.Def кусков + set armorSustain.
 * Кап ~15%; полный Mithril ≈ 10% от def + 4% от 2-set.
 */
function avatarArmorSustainPct() {
  const def = avatarArmorDefBonuses();
  const weighted = (def.pdef || 0) + (def.mdef || 0) * 0.5;
  const div = typeof ARMOR_SUSTAIN_DEF_DIV === "number" ? ARMOR_SUSTAIN_DEF_DIV : 620;
  const fromDefCap = typeof ARMOR_SUSTAIN_FROM_DEF_CAP === "number" ? ARMOR_SUSTAIN_FROM_DEF_CAP : 0.1;
  let pct = Math.min(fromDefCap, weighted / Math.max(1, div));
  if (typeof avatarSetBonuses === "function") {
    pct += Math.max(0, avatarSetBonuses().armorSustain || 0);
  }
  if (typeof sumEquippedCraftOpt === "function") {
    pct += Math.max(0, sumEquippedCraftOpt("armorSustain", "armor") || 0);
  }
  const totalCap = typeof ARMOR_SUSTAIN_TOTAL_CAP === "number" ? ARMOR_SUSTAIN_TOTAL_CAP : 0.15;
  return Math.min(totalCap, Math.max(0, pct));
}

function armorFragIdsForZone(zoneId) {
  const zid =
    typeof resolveFarmZoneId === "function" ? resolveFarmZoneId(zoneId) : zoneId;
  const map = typeof ARMOR_FRAG_ZONES !== "undefined" ? ARMOR_FRAG_ZONES : null;
  let setIds = map && map[zid] ? map[zid] : null;
  // lootTags → пул грейда, если зона не в явной карте
  if (!setIds) {
    let zone = null;
    if (typeof farmZoneById === "function") zone = farmZoneById(zid);
    else if (typeof FARM_ZONES !== "undefined" && Array.isArray(FARM_ZONES)) {
      zone = FARM_ZONES.find((x) => x && x.id === zid) || null;
    }
    const tags = zone && Array.isArray(zone.lootTags) ? zone.lootTags : [];
    if (tags.indexOf("armor_c") >= 0 && map && map.abandoned_coal_low) {
      setIds = map.abandoned_coal_low;
    } else if (tags.indexOf("armor_d") >= 0 && map && map.wasteland) {
      setIds = map.wasteland;
    }
  }
  if (!setIds) return [];
  if (typeof setIds === "string") setIds = [setIds];
  if (!Array.isArray(setIds) || !setIds.length) return [];
  if (typeof ARMOR_FRAGS === "undefined" || !ARMOR_FRAGS) return [];
  const out = [];
  setIds.forEach((setId) => {
    const fragId =
      typeof armorSetMaterialId === "function" ? armorSetMaterialId(setId) : setId + "_material";
    if (ARMOR_FRAGS[fragId]) out.push(fragId);
  });
  return out;
}

function farmZoneIdForArmorSet(setId) {
  if (typeof ARMOR_SETS !== "undefined" && ARMOR_SETS[setId]?.farmZoneId) {
    return ARMOR_SETS[setId].farmZoneId;
  }
  const map = typeof ARMOR_FRAG_ZONES !== "undefined" ? ARMOR_FRAG_ZONES : null;
  if (!map) return null;
  const entry = Object.keys(map).find((zid) => {
    let sets = map[zid];
    if (typeof sets === "string") sets = [sets];
    return Array.isArray(sets) && sets.indexOf(setId) >= 0;
  });
  return entry || null;
}

function rollArmorFragDrop(zoneId, mobType) {
  const ids = armorFragIdsForZone(zoneId);
  if (!ids.length) return null;
  if (typeof ARMOR_FRAGS === "undefined" || !ARMOR_FRAGS) return null;
  const cfg = typeof ARMOR_FRAG_DROP !== "undefined" ? ARMOR_FRAG_DROP : null;
  if (!cfg) return null;
  const type = mobType === "boss" || mobType === "golden" ? mobType : "normal";
  const chance = cfg[type] || 0;
  if (!(chance > 0) || Math.random() >= chance) return null;
  const fragId = ids[Math.floor(Math.random() * ids.length)];
  const range = type === "boss" ? cfg.qtyBoss : type === "golden" ? cfg.qtyGolden : cfg.qtyNormal;
  const lo = Array.isArray(range) ? range[0] : 1;
  const hi = Array.isArray(range) ? range[1] : lo;
  let qty = lo >= hi ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
  if (typeof passiveEffectMult === "function") {
    qty = Math.max(1, Math.round(qty * passiveEffectMult("materialsMult", typeof state !== "undefined" ? state.avatar : null)));
  }
  return { fragId, qty, def: ARMOR_FRAGS[fragId] };
}

/** @deprecated готовые куски с босса больше не падают — только фрагменты в forge-зоне. */
function rollArmorBossDrop(zoneId) {
  return null;
}

function grantArmorDrop(armorId, meta) {
  const def = typeof AMAP !== "undefined" ? AMAP[armorId] : null;
  if (!def) return null;
  const it = addArmorToInventory(armorId, meta);
  if (!it) return null;
  if (!meta?.silent && typeof toast === "function") {
    toast("🛡 Добыто: " + def.name + " (" + (def.grade || "?") + ") → в инвентарь", "loot");
  }
  return { item: it, def };
}

function armorCraftRecipe(armorId) {
  if (typeof ARMOR_CRAFT === "undefined" || !ARMOR_CRAFT) return null;
  return ARMOR_CRAFT.find((r) => r.armorId === armorId) || null;
}

function canCraftArmor(armorId) {
  const r = armorCraftRecipe(armorId);
  const armor = typeof AMAP !== "undefined" ? AMAP[armorId] : null;
  if (!r || !armor) return { ok: false, reason: "unknown" };
  const grade = armor.grade || "C";
  const frags = armorFragCount(r.fragId);
  const cry = state.crystals?.[grade] || 0;
  const ore = state.materials?.soul || 0;
  const adena = state.adena || 0;
  if (frags < r.fragQty) return { ok: false, reason: "frag", need: r.fragQty, have: frags };
  if (cry < r.cry) return { ok: false, reason: "cry", need: r.cry, have: cry, grade };
  if (ore < r.oreSoul) return { ok: false, reason: "ore", need: r.oreSoul, have: ore };
  if (adena < (r.adena || 0)) return { ok: false, reason: "adena", need: r.adena || 0, have: adena };
  return { ok: true, recipe: r, armor, grade };
}

function craftArmor(armorId) {
  const check = canCraftArmor(armorId);
  if (!check.ok) {
    if (typeof toast === "function") {
      if (check.reason === "frag") toast("Не хватает материала (нужно " + check.need + ")", "warn");
      else if (check.reason === "cry") toast("Не хватает кристаллов " + check.grade + " (нужно " + check.need + ")", "warn");
      else if (check.reason === "ore") toast("Не хватает Soul Ore (нужно " + check.need + ")", "warn");
      else if (check.reason === "adena") toast("Недостаточно adena", "warn");
      else toast("Рецепт недоступен", "warn");
    }
    return null;
  }
  const r = check.recipe;
  const grade = check.grade;
  if (typeof isInventoryFull === "function" && isInventoryFull()) {
    if (typeof toast === "function") toast("Инвентарь полон (" + INV_CAP + " ячеек)", "warn");
    return null;
  }
  ProgressStore.update("materials", (m) => {
    const next = { ...(m || { soul: 0, spirit: 0 }) };
    next[r.fragId] = Math.max(0, (next[r.fragId] || 0) - r.fragQty);
    next.soul = Math.max(0, (next.soul || 0) - r.oreSoul);
    return next;
  });
  ProgressStore.update("crystals", (c) => {
    const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
    next[grade] = Math.max(0, (next[grade] || 0) - r.cry);
    return next;
  });
  if (r.adena > 0) {
    ProgressStore.update("adena", (a) => Math.max(0, (a || 0) - r.adena));
  }
  const craftOpt = typeof rollCraftOpt === "function" ? rollCraftOpt("armor") : null;
  const it = addArmorToInventory(armorId, {
    source: "craft",
    craftOpt: craftOpt || undefined,
  });
  if (!it) return null;
  if (typeof Audio2 !== "undefined" && Audio2.success) Audio2.success();
  if (typeof save === "function") save();
  if (typeof toast === "function") {
    let msg = "🔨 Скрафчено: " + check.armor.name + " [" + grade + "]";
    if (craftOpt && typeof formatCraftOpt === "function") {
      msg += " · Редкий крафт: " + formatCraftOpt(craftOpt);
    }
    toast(msg, "craft");
  }
  if (typeof achStat === "function") achStat("armorCrafted", 1);
  if (typeof checkAchievements === "function") checkAchievements();
  return it;
}

/** Слияние legacy слот-кусков брони в set-материал. */
function migrateArmorSetMaterials() {
  if (typeof LEGACY_ARMOR_FRAG_TO_SET === "undefined" || !LEGACY_ARMOR_FRAG_TO_SET) return;
  if (!state.materials) return;
  let changed = false;
  ProgressStore.update("materials", (m) => {
    const next = { ...(m || { soul: 0, spirit: 0 }) };
    Object.keys(LEGACY_ARMOR_FRAG_TO_SET).forEach((legacyId) => {
      const qty = Math.max(0, Math.floor(Number(next[legacyId]) || 0));
      if (!qty) return;
      const setId = LEGACY_ARMOR_FRAG_TO_SET[legacyId];
      const neo =
        typeof armorSetMaterialId === "function" ? armorSetMaterialId(setId) : setId + "_material";
      next[neo] = (next[neo] || 0) + qty;
      delete next[legacyId];
      changed = true;
    });
    return next;
  });
  if (changed && typeof save === "function") save();
}
