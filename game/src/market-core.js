// ===== Рынок (buyout): API + подписи лотов =====

const MARKET_MIN_PRICE = 1000;
const MARKET_MAX_PRICE = 50_000_000_000;
const MARKET_TAX_PCT = 5;
const MARKET_MAX_LISTINGS = 10;

function marketActiveCharacterId() {
  return state.activeCharacterId || (state.characters && state.characters[0] && state.characters[0].id) || null;
}

function marketListingTitle(listing) {
  const item = listing?.item || {};
  const kind = listing?.kind || item.kind;
  if (kind === "weapon") {
    const w = typeof WMAP !== "undefined" ? WMAP[item.id] : null;
    const name = w?.name || item.id || "Оружие";
    const plus = Math.max(0, Number(item.plus) || 0);
    return name + (plus ? " +" + plus : "");
  }
  if (kind === "armor") {
    const a = typeof AMAP !== "undefined" ? AMAP[item.id] : null;
    const name = a?.name || item.id || "Броня";
    const plus = Math.max(0, Number(item.plus) || 0);
    return name + (plus ? " +" + plus : "");
  }
  if (kind === "accessory") {
    const c = typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[item.id] : null;
    return c?.name || item.id || "Бижутерия";
  }
  if (kind === "armor_piece") {
    const fid = item.fragId || item.id;
    const frag = typeof ARMOR_FRAGS !== "undefined" ? ARMOR_FRAGS[fid] : null;
    return frag?.name || fid || "Кусок брони";
  }
  if (kind === "jewelry_piece") {
    const fid = item.fragId || item.id;
    const frag =
      (typeof ACCESSORY_FRAGS !== "undefined" && ACCESSORY_FRAGS[fid]) ||
      (typeof JEWELRY_FRAGS !== "undefined" && JEWELRY_FRAGS[fid]) ||
      null;
    return frag?.name || fid || "Кусок бижутерии";
  }
  if (kind === "crystal") {
    return "Кристалл " + (item.grade || "?");
  }
  if (kind === "material") {
    if (item.ore === "oath_symbol" && typeof OATH_SYMBOL !== "undefined") {
      return OATH_SYMBOL.nameRu || "Символ Клятвы";
    }
    const ore = typeof ORE !== "undefined" ? ORE[item.ore] : null;
    return ore?.name || item.ore || "Руда";
  }
  if (kind === "shot") {
    const sk = item.shotKind || item.shot_kind;
    const label = typeof SHOT_TYPE !== "undefined" ? SHOT_TYPE[sk]?.label : sk;
    return (label || "Заряд") + " " + (item.grade || "");
  }
  if (kind === "scroll") {
    const target = item.target || "weapon";
    const typeId = item.typeId || item.scrollType || item.scroll_type || "regular";
    if (typeof scrollLabel === "function") return scrollLabel(target, typeId, item.grade);
    return "Свиток " + (target === "armor" ? "брони" : "оружия") + " " + (item.grade || "");
  }
  return "Лот";
}

function marketListingIcon(listing) {
  const item = listing?.item || {};
  const kind = listing?.kind || item.kind;
  if (kind === "weapon") {
    const w = typeof WMAP !== "undefined" ? WMAP[item.id] : null;
    return w?.icon || "icons/weapon_generic.png";
  }
  if (kind === "armor") {
    const a = typeof AMAP !== "undefined" ? AMAP[item.id] : null;
    return a?.icon || "icons/btn_armor.png";
  }
  if (kind === "accessory") {
    const c = typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[item.id] : null;
    return c?.icon || "icons/accessory_earring_of_zaken_i00.png";
  }
  if (kind === "armor_piece") {
    const fid = item.fragId || item.id;
    const frag = typeof ARMOR_FRAGS !== "undefined" ? ARMOR_FRAGS[fid] : null;
    return frag?.icon || "icons/etc_crystal_white_i00.png";
  }
  if (kind === "jewelry_piece") {
    const fid = item.fragId || item.id;
    const frag =
      (typeof ACCESSORY_FRAGS !== "undefined" && ACCESSORY_FRAGS[fid]) ||
      (typeof JEWELRY_FRAGS !== "undefined" && JEWELRY_FRAGS[fid]) ||
      null;
    return frag?.icon || "icons/etc_broken_crystal_silver_i00.png";
  }
  if (kind === "crystal") {
    const map = typeof CRYSTAL_ICON !== "undefined" ? CRYSTAL_ICON : null;
    return (map && map[item.grade]) || "icons/etc_crystal_blue_i00.png";
  }
  if (kind === "material") {
    if (item.ore === "oath_symbol" && typeof OATH_SYMBOL !== "undefined") {
      return OATH_SYMBOL.icon || "icons/clan/oath_symbol.png?v=1";
    }
    return (typeof ORE !== "undefined" && ORE[item.ore]?.icon) || "icons/etc_crystal_white_i00.png";
  }
  if (kind === "shot") {
    const sk = item.shotKind || item.shot_kind;
    return (typeof SHOT_ICON !== "undefined" && SHOT_ICON[sk]?.[item.grade]) || "icons/etc_spirit_bullet_blue_i00.png";
  }
  if (kind === "scroll") {
    const typeId = item.typeId || item.scrollType || item.scroll_type || "regular";
    const grade = item.grade || "D";
    const target = item.target === "armor" || item.target === "jewelry" ? "armor" : "weapon";
    if (typeof scrollTierIcon === "function") return scrollTierIcon(typeId, grade, target);
    return target === "armor"
      ? "icons/etc_scroll_of_enchant_armor_i01.png"
      : "icons/etc_scroll_of_enchant_weapon_i01.png";
  }
  return "icons/weapon_generic.png";
}

function marketListingGrade(listing) {
  const item = listing?.item || {};
  const kind = listing?.kind || item.kind;
  if (kind === "weapon") {
    const w = typeof WMAP !== "undefined" ? WMAP[item.id] : null;
    return w?.grade || "";
  }
  if (kind === "armor") {
    const a = typeof AMAP !== "undefined" ? AMAP[item.id] : null;
    return a?.grade || "";
  }
  if (kind === "accessory") {
    const c = typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[item.id] : null;
    return c?.grade || "";
  }
  if (kind === "armor_piece") {
    const fid = item.fragId || item.id;
    const frag = typeof ARMOR_FRAGS !== "undefined" ? ARMOR_FRAGS[fid] : null;
    const armorId = frag?.armorId;
    if (armorId && typeof AMAP !== "undefined") return AMAP[armorId]?.grade || "";
    return "";
  }
  if (kind === "jewelry_piece") {
    const fid = item.fragId || item.id;
    const frag =
      (typeof ACCESSORY_FRAGS !== "undefined" && ACCESSORY_FRAGS[fid]) ||
      (typeof JEWELRY_FRAGS !== "undefined" && JEWELRY_FRAGS[fid]) ||
      null;
    const accId = frag?.accessoryId;
    if (accId && typeof COLLECTIBLES !== "undefined") {
      const c = COLLECTIBLES[accId];
      if (c?.epic) return "epic";
      return c?.grade || "";
    }
    return "";
  }
  return item.grade || "";
}

async function marketApi(path, opts) {
  opts = opts || {};
  if (typeof cloudEnabled === "function" && !cloudEnabled()) {
    return { ok: false, error: "Сервер не подключён" };
  }
  if (typeof readCloudAuth === "function" && !readCloudAuth()?.token) {
    return { ok: false, error: "Войдите в аккаунт" };
  }
  const method = opts.method || "GET";
  const headers = typeof authHeaders === "function" ? authHeaders(!!opts.body) : { "Content-Type": "application/json" };
  try {
    const res = await fetch(cloudApiUrl(path), {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        locked: !!data.locked,
        error: data.error || "Ошибка рынка",
      };
    }
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, offline: true, error: "Нет связи с сервером" };
  }
}

function marketLeaseBody(extra) {
  const base = typeof leaseBody === "function" ? leaseBody(extra) : Object.assign({}, extra || {});
  const cid = marketActiveCharacterId();
  if (cid) base.characterId = cid;
  return base;
}

function applyMarketSave(save) {
  if (!save || !save.data) return false;
  if (typeof applyCloudSaveData === "function") {
    applyCloudSaveData(save.data, save.seq, save.savedAt);
    return true;
  }
  return false;
}

async function marketFetchListings(filters) {
  filters = filters || {};
  const q = new URLSearchParams();
  if (filters.kind) q.set("kind", filters.kind);
  if (filters.grade) q.set("grade", filters.grade);
  if (filters.q) q.set("q", filters.q);
  q.set("limit", String(filters.limit || 50));
  const qs = q.toString();
  return marketApi("/market/listings" + (qs ? "?" + qs : ""));
}

async function marketFetchMine() {
  const cid = marketActiveCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return marketApi("/market/mine" + qs);
}

async function marketListItem(payload) {
  const body = Object.assign(marketLeaseBody(), payload || {});
  const r = await marketApi("/market/list", { method: "POST", body });
  if (r.ok && r.save) applyMarketSave(r.save);
  if (r.ok && typeof logCharacterEvent === "function") {
    logCharacterEvent("market_list", {
      listingId: r.listing?.id,
      kind: payload?.kind,
      price: payload?.priceAdena,
    });
  }
  return r;
}

async function marketBuyListing(id) {
  const body = marketLeaseBody();
  const r = await marketApi("/market/buy/" + encodeURIComponent(id), { method: "POST", body });
  if (r.ok && r.save) applyMarketSave(r.save);
  if (r.ok && typeof logCharacterEvent === "function") {
    logCharacterEvent("market_buy", { listingId: id, price: r.priceAdena, tax: r.taxAdena });
  }
  return r;
}

async function marketCancelListing(id) {
  const body = marketLeaseBody();
  const r = await marketApi("/market/cancel/" + encodeURIComponent(id), { method: "POST", body });
  if (r.ok && r.save) applyMarketSave(r.save);
  if (r.ok && typeof logCharacterEvent === "function") {
    logCharacterEvent("market_cancel", { listingId: id });
  }
  return r;
}

function marketListableWeapons() {
  const inv = state.inventory || [];
  const gearUid = state.avatar?.gear?.weapon?.uid;
  return inv.filter((it) => {
    if (!it || !it.uid || !it.id) return false;
    if (it.starter) return false;
    if (it.kind === "accessory" || it.kind === "armor") return false;
    if (typeof isArmorItem === "function" && isArmorItem(it)) return false;
    if (typeof isAccessoryItem === "function" && isAccessoryItem(it)) return false;
    if (typeof WMAP !== "undefined" && !WMAP[it.id]) return false;
    if (gearUid && String(gearUid) === String(it.uid)) return false;
    return true;
  });
}

function marketListableArmor() {
  const inv = state.inventory || [];
  const gear = state.avatar?.gear || {};
  const equipped = new Set();
  Object.keys(gear).forEach((k) => {
    const g = gear[k];
    if (g?.uid) equipped.add(String(g.uid));
  });
  return inv.filter((it) => {
    if (!it || !it.uid || !it.id) return false;
    if (typeof isArmorItem !== "function" || !isArmorItem(it)) return false;
    if (typeof AMAP !== "undefined" && !AMAP[it.id]) return false;
    if (equipped.has(String(it.uid))) return false;
    return true;
  });
}

function marketListableAccessories() {
  const inv = state.inventory || [];
  const gear = state.avatar?.gear || {};
  const equipped = new Set();
  Object.keys(gear).forEach((k) => {
    const g = gear[k];
    if (g?.uid) equipped.add(String(g.uid));
  });
  return inv.filter((it) => {
    if (!it || !it.uid || !it.id) return false;
    if (typeof isAccessoryItem !== "function" || !isAccessoryItem(it)) return false;
    if (typeof COLLECTIBLES !== "undefined" && !COLLECTIBLES[it.id]) return false;
    if (equipped.has(String(it.uid))) return false;
    return true;
  });
}

function marketStackOptions() {
  const out = [];
  const cry = state.crystals || {};
  ["D", "C", "B", "A"].forEach((g) => {
    const n = Math.max(0, Math.floor(Number(cry[g]) || 0));
    if (n > 0) out.push({ kind: "crystal", grade: g, max: n, label: "Кристалл " + g + " ×" + n });
  });
  const mats = state.materials || {};
  ["soul", "spirit"].forEach((ore) => {
    const n = Math.max(0, Math.floor(Number(mats[ore]) || 0));
    if (n > 0) {
      const name = (typeof ORE !== "undefined" && ORE[ore]?.name) || ore;
      out.push({ kind: "material", ore, max: n, label: name + " ×" + n });
    }
  });
  {
    const n = Math.max(0, Math.floor(Number(mats.oath_symbol) || 0));
    if (n > 0) {
      const name =
        (typeof OATH_SYMBOL !== "undefined" && OATH_SYMBOL.nameRu) || "Символ Клятвы";
      const icon = (typeof OATH_SYMBOL !== "undefined" && OATH_SYMBOL.icon) || "";
      out.push({
        kind: "material",
        ore: "oath_symbol",
        max: n,
        label: name + " ×" + n,
        icon,
      });
    }
  }
  if (typeof ARMOR_FRAGS !== "undefined" && ARMOR_FRAGS) {
    Object.keys(ARMOR_FRAGS).forEach((fragId) => {
      const n = Math.max(0, Math.floor(Number(mats[fragId]) || 0));
      if (n <= 0) return;
      const frag = ARMOR_FRAGS[fragId];
      let grade = "";
      if (frag?.armorId && typeof AMAP !== "undefined" && AMAP[frag.armorId]) {
        grade = AMAP[frag.armorId].grade || "";
      } else if (frag?.setId && typeof ARMOR_SETS !== "undefined" && ARMOR_SETS[frag.setId]) {
        grade = ARMOR_SETS[frag.setId].grade || "";
      }
      out.push({
        kind: "armor_piece",
        fragId,
        max: n,
        grade,
        label: (frag?.name || fragId) + " ×" + n,
        icon: frag?.icon || "",
      });
    });
  }
  if (typeof ACCESSORY_FRAGS !== "undefined" && ACCESSORY_FRAGS) {
    Object.keys(ACCESSORY_FRAGS).forEach((fragId) => {
      const n =
        typeof inventoryShardCount === "function"
          ? inventoryShardCount(fragId)
          : 0;
      if (n <= 0) return;
      const frag = ACCESSORY_FRAGS[fragId];
      let grade = "";
      if (frag?.accessoryId && typeof COLLECTIBLES !== "undefined" && COLLECTIBLES[frag.accessoryId]) {
        const acc = COLLECTIBLES[frag.accessoryId];
        grade = acc.epic ? "epic" : acc.grade || "";
      } else if (frag?.setId && typeof JEWELRY_SETS !== "undefined" && JEWELRY_SETS[frag.setId]) {
        grade = JEWELRY_SETS[frag.setId].grade || "";
      } else if (frag?.setId && typeof COLLECTIBLES !== "undefined") {
        const sample = Object.keys(COLLECTIBLES).find((id) => COLLECTIBLES[id]?.setId === frag.setId);
        if (sample) grade = COLLECTIBLES[sample].grade || "";
      }
      out.push({
        kind: "jewelry_piece",
        fragId,
        max: n,
        grade,
        label: (frag?.name || fragId) + " ×" + n,
        icon: frag?.icon || "",
      });
    });
  }
  const shots = state.shots || {};
  ["soul", "spirit"].forEach((sk) => {
    ["D", "C", "B", "A"].forEach((g) => {
      const n = Math.max(0, Math.floor(Number(shots[sk]?.[g]) || 0));
      if (n > 0) {
        const label = (typeof SHOT_TYPE !== "undefined" && SHOT_TYPE[sk]?.label) || sk;
        out.push({ kind: "shot", shotKind: sk, grade: g, max: n, label: label + " " + g + " ×" + n });
      }
    });
  });
  if (typeof listScrollStacks === "function") {
    listScrollStacks().forEach((st) => {
      out.push({
        kind: "scroll",
        target: st.target,
        typeId: st.typeId,
        grade: st.grade,
        max: st.qty,
        label: st.name + " ×" + st.qty,
        icon: st.icon,
        estimate: st.estimate,
      });
    });
  }
  return out;
}
