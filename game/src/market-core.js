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
  if (kind === "crystal") {
    return "Кристалл " + (item.grade || "?");
  }
  if (kind === "material") {
    const ore = typeof ORE !== "undefined" ? ORE[item.ore] : null;
    return (ore?.name || item.ore || "Руда");
  }
  if (kind === "shot") {
    const sk = item.shotKind || item.shot_kind;
    const label = typeof SHOT_TYPE !== "undefined" ? SHOT_TYPE[sk]?.label : sk;
    return (label || "Заряд") + " " + (item.grade || "");
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
  if (kind === "crystal") {
    const map = typeof CRYSTAL_ICON !== "undefined" ? CRYSTAL_ICON : null;
    return (map && map[item.grade]) || "icons/etc_crystal_blue_i00.png";
  }
  if (kind === "material") {
    return (typeof ORE !== "undefined" && ORE[item.ore]?.icon) || "icons/etc_crystal_white_i00.png";
  }
  if (kind === "shot") {
    const sk = item.shotKind || item.shot_kind;
    return (typeof SHOT_ICON !== "undefined" && SHOT_ICON[sk]?.[item.grade]) || "icons/etc_spirit_bullet_blue_i00.png";
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
    if (it.kind === "accessory") return false;
    if (gearUid && String(gearUid) === String(it.uid)) return false;
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
  return out;
}
