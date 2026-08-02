// ===== Бижутерия D/C: сеты, дроп кусков, агрегаторы CDR/resist =====

function accessoryDef(idOrItem) {
  const id = typeof idOrItem === "string" ? idOrItem : idOrItem?.id;
  if (!id) return null;
  if (typeof COLLECTIBLES !== "undefined" && COLLECTIBLES[id]) return COLLECTIBLES[id];
  if (typeof JMAP !== "undefined" && JMAP[id]) return JMAP[id];
  return null;
}

function isGradedJewelryItem(it) {
  if (!it || it.kind === "shard") return false;
  const def = accessoryDef(it);
  return !!(def && def.epic !== true && def.setId && def.grade);
}

function isEpicAccessoryDef(def) {
  return !!(def && def.epic === true);
}

/** Макс. заточка бижутерии (+12). */
function jewelryMaxPlus() {
  return typeof JEWELRY_MAX_PLUS === "number" ? JEWELRY_MAX_PLUS : 12;
}

/** Бонус M.Def от заточки бижутерии (+1 за уровень, как в L2). */
function jewelryEnchantMdefBonus(plus) {
  return Math.max(0, plus | 0);
}

/** Можно ли точить эту бижу (грейдовая; эпик — только с canEnchant). */
function jewelryCanEnchant(itemOrDef) {
  let def = itemOrDef;
  if (!def) return false;
  if (def.uid || (def.id && !def.name)) {
    def = typeof accessoryDef === "function" ? accessoryDef(def) : null;
  }
  if (!def || def.noEnchant) return false;
  if (def.epic && !def.canEnchant) return false;
  return !!(def.grade && def.grade !== "NG");
}

/** Сколько кусков каждого jewelry-сета надето (earring/ring считают по слотам). */
function equippedJewelrySetCounts() {
  const counts = {};
  if (typeof iterEquippedGear !== "function") return counts;
  iterEquippedGear().forEach(({ item }) => {
    if (!item || item.kind === "weapon" || item.kind === "armor") return;
    if (typeof isArmorItem === "function" && isArmorItem(item)) return;
    const def = accessoryDef(item);
    if (!def?.setId || def.epic) return;
    counts[def.setId] = (counts[def.setId] || 0) + 1;
  });
  return counts;
}

/**
 * Сет-бонусы бижутерии (пороги 3 / 5).
 * skillCdMult перемножается; debuffResist и mdef суммируются.
 */
function avatarJewelrySetBonuses() {
  const out = {
    mdef: 0,
    skillCdMult: 1,
    debuffResist: 0,
    sets: [],
  };
  if (typeof JEWELRY_SETS === "undefined" || !JEWELRY_SETS) return out;
  const counts = equippedJewelrySetCounts();
  const avatar = typeof state !== "undefined" ? state.avatar : null;
  const lv =
    typeof avatarLevelForGrade === "function"
      ? avatarLevelForGrade(avatar)
      : (avatar?.level || 1);
  Object.keys(counts).forEach((setId) => {
    const set = JEWELRY_SETS[setId];
    if (!set) return;
    const n = counts[setId] || 0;
    if (typeof isGradeOverLevel === "function" && set.grade && isGradeOverLevel(set.grade, lv)) {
      return;
    }
    const tiers = set.bonuses || {};
    const active = [];
    [3, 5].forEach((th) => {
      if (n < th || !tiers[th]) return;
      const b = tiers[th];
      if (b.mdef) out.mdef += b.mdef;
      if (b.debuffResist) out.debuffResist += b.debuffResist;
      if (b.skillCdMult != null && b.skillCdMult > 0) out.skillCdMult *= b.skillCdMult;
      active.push(th);
    });
    if (active.length) {
      out.sets.push({ id: setId, name: set.name, pieces: n, tiers: active, role: set.role });
    }
  });
  return out;
}

function iterJewelryBonusPieces(cb) {
  if (typeof iterEquippedGear !== "function") return;
  iterEquippedGear().forEach(({ item }) => {
    if (!item || item.kind === "weapon" || item.kind === "armor") return;
    if (typeof isArmorItem === "function" && isArmorItem(item)) return;
    const def = accessoryDef(item);
    if (!def || def.epic) return;
    cb(def);
  });
}

/** Множитель КД скиллов от обычной бижутерии (1 = без бонуса). */
function avatarJewelrySkillCdMult() {
  let m = 1;
  iterJewelryBonusPieces((def) => {
    const v = def.bonuses?.skillCdMult;
    if (v != null && v > 0) m *= v;
  });
  const set = avatarJewelrySetBonuses();
  if (set.skillCdMult > 0) m *= set.skillCdMult;
  const floor =
    typeof JEWELRY_SKILL_CD_FLOOR === "number" ? JEWELRY_SKILL_CD_FLOOR : 0.82;
  return Math.max(floor, Math.min(1, m));
}

/** Суммарный резист дебаффов от обычной бижутерии (0..cap). */
function avatarJewelryDebuffResist() {
  let r = 0;
  iterJewelryBonusPieces((def) => {
    if (def.bonuses?.debuffResist) r += def.bonuses.debuffResist;
  });
  r += avatarJewelrySetBonuses().debuffResist || 0;
  const cap =
    typeof JEWELRY_DEBUFF_RESIST_CAP === "number" ? JEWELRY_DEBUFF_RESIST_CAP : 0.32;
  return Math.max(0, Math.min(cap, r));
}

/** Итоговый mdef от jewelry set bonuses (куски уже в avatarStatBonusesFromGear). */
function avatarJewelrySetMdef() {
  return Math.max(0, avatarJewelrySetBonuses().mdef || 0);
}

function jewelryFragIdsForZone(zoneId) {
  const zid =
    typeof resolveFarmZoneId === "function" ? resolveFarmZoneId(zoneId) : zoneId;
  const map = typeof JEWELRY_FRAG_ZONES !== "undefined" ? JEWELRY_FRAG_ZONES : null;
  let setIds = map && map[zid] ? map[zid] : null;
  if (!setIds) {
    let zone = null;
    if (typeof farmZoneById === "function") zone = farmZoneById(zid);
    else if (typeof FARM_ZONES !== "undefined" && Array.isArray(FARM_ZONES)) {
      zone = FARM_ZONES.find((x) => x && x.id === zid) || null;
    }
    const tags = zone && Array.isArray(zone.lootTags) ? zone.lootTags : [];
    if (tags.indexOf("jewelry_c") >= 0 && map && map.abandoned_coal_low) {
      setIds = map.abandoned_coal_low;
    } else if (tags.indexOf("jewelry_d") >= 0 && map && map.wasteland) {
      setIds = map.wasteland;
    }
  }
  if (!setIds) return [];
  if (typeof setIds === "string") setIds = [setIds];
  if (!Array.isArray(setIds) || !setIds.length) return [];
  if (typeof JEWELRY_SETS === "undefined" || !JEWELRY_SETS) return [];
  const pieceIds = {};
  setIds.forEach((setId) => {
    (JEWELRY_SETS[setId]?.pieces || []).forEach((pid) => {
      pieceIds[pid] = true;
    });
  });
  const frags = typeof JEWELRY_FRAGS !== "undefined" ? JEWELRY_FRAGS : {};
  return Object.keys(frags).filter((fid) => {
    const accId = frags[fid]?.accessoryId;
    return accId && pieceIds[accId];
  });
}

function farmZoneIdForJewelrySet(setId) {
  if (typeof JEWELRY_SETS !== "undefined" && JEWELRY_SETS[setId]?.farmZoneId) {
    return JEWELRY_SETS[setId].farmZoneId;
  }
  const map = typeof JEWELRY_FRAG_ZONES !== "undefined" ? JEWELRY_FRAG_ZONES : null;
  if (!map) return null;
  return (
    Object.keys(map).find((zid) => {
      let sets = map[zid];
      if (typeof sets === "string") sets = [sets];
      return Array.isArray(sets) && sets.indexOf(setId) >= 0;
    }) || null
  );
}

function rollJewelryFragDrop(zoneId, mobType) {
  const ids = jewelryFragIdsForZone(zoneId);
  if (!ids.length) return null;
  if (typeof JEWELRY_FRAGS === "undefined" || !JEWELRY_FRAGS) return null;
  const cfg = typeof JEWELRY_FRAG_DROP !== "undefined" ? JEWELRY_FRAG_DROP : null;
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
    qty = Math.max(
      1,
      Math.round(qty * passiveEffectMult("materialsMult", typeof state !== "undefined" ? state.avatar : null))
    );
  }
  return { fragId, qty, def: JEWELRY_FRAGS[fragId] };
}

function formatJewelryBonusLines(def) {
  const lines = [];
  if (!def) return lines;
  const b = def.bonuses || {};
  if (b.mdef) lines.push("M.Def +" + b.mdef);
  if (b.pdef) lines.push("P.Def +" + b.pdef);
  if (b.pvpAtk) lines.push("ATK арены +" + Math.round(b.pvpAtk * 1000) / 10 + "%");
  if (b.pvpDef) lines.push("DEF арены +" + Math.round(b.pvpDef * 1000) / 10 + "%");
  if (b.pvpCritChance) {
    lines.push("Крит арены +" + Math.round(b.pvpCritChance * 1000) / 10 + "%");
  }
  if (b.mineAdena) lines.push("Adena +" + Math.round(b.mineAdena * 100) + "%");
  if (b.avatarXp) lines.push("XP души +" + Math.round(b.avatarXp * 100) + "%");
  if (b.enchant) {
    lines.push(
      typeof formatArmorEnchantBonus === "function"
        ? formatArmorEnchantBonus(b.enchant)
        : "Заточка +" + (b.enchant * 100).toFixed(2) + "%"
    );
  }
  if (b.skillCdMult != null && b.skillCdMult < 1) {
    const pct = Math.round((1 - b.skillCdMult) * 1000) / 10;
    lines.push("КД скиллов −" + pct + "%");
  }
  if (b.debuffResist) {
    lines.push("Резист дебаффов +" + Math.round(b.debuffResist * 1000) / 10 + "%");
  }
  if (def.uniqueEquipped || def.epic) lines.push("Уникальный — один в экипе");
  return lines;
}

function jewelrySetBonusPreviewLines(setId, pieces) {
  const set = typeof JEWELRY_SETS !== "undefined" ? JEWELRY_SETS[setId] : null;
  if (!set) return [];
  const n = pieces || 5;
  const lines = [];
  const tiers = set.bonuses || {};
  [3, 5].forEach((th) => {
    if (n < th || !tiers[th]) return;
    const b = tiers[th];
    const parts = [];
    if (b.mdef) parts.push("M.Def +" + b.mdef);
    if (b.skillCdMult != null && b.skillCdMult < 1) {
      parts.push("КД −" + Math.round((1 - b.skillCdMult) * 1000) / 10 + "%");
    }
    if (b.debuffResist) {
      parts.push("резист +" + Math.round(b.debuffResist * 1000) / 10 + "%");
    }
    if (parts.length) lines.push(th + " шт.: " + parts.join(", "));
  });
  return lines;
}
