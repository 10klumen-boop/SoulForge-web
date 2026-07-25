// ===== Почта игроков (серверный эскроу по имени персонажа) =====

const PLAYER_MAIL_TTL_DAYS = 7;

function playerMailActiveCharacterId() {
  return (
    state.activeCharacterId ||
    (state.characters && state.characters[0] && state.characters[0].id) ||
    null
  );
}

function playerMailLeaseBody(extra) {
  const base = typeof leaseBody === "function" ? leaseBody(extra) : Object.assign({}, extra || {});
  const cid = playerMailActiveCharacterId();
  if (cid) base.characterId = cid;
  return base;
}

function applyPlayerMailSave(save) {
  if (!save || !save.data) return false;
  if (typeof applyCloudSaveData === "function") {
    applyCloudSaveData(save.data, save.seq, save.savedAt);
    return true;
  }
  return false;
}

async function playerMailApi(path, opts) {
  opts = opts || {};
  if (typeof cloudEnabled === "function" && !cloudEnabled()) {
    return { ok: false, error: "Сервер не подключён" };
  }
  if (typeof readCloudAuth === "function" && !readCloudAuth()?.token) {
    return { ok: false, error: "Войдите в аккаунт" };
  }
  const method = opts.method || "GET";
  const headers =
    typeof authHeaders === "function" ? authHeaders(!!opts.body) : { "Content-Type": "application/json" };
  try {
    const res = await fetch(cloudApiUrl(path), {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || data.message || "Ошибка " + res.status,
        locked: !!data.locked,
        lease: data.lease,
        status: res.status,
      };
    }
    return Object.assign({ ok: true }, data);
  } catch (e) {
    return { ok: false, error: e.message || "Сеть недоступна" };
  }
}

async function playerMailFetchInbox() {
  const cid = playerMailActiveCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return playerMailApi("/mail/inbox" + qs);
}

async function playerMailFetchOutbox() {
  const cid = playerMailActiveCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return playerMailApi("/mail/outbox" + qs);
}

/** @param {object} payload { toName, kind, uid?, qty?, grade?, ore?, shotKind? } */
async function playerMailSendPayload(payload) {
  const body = Object.assign(playerMailLeaseBody(), payload || {});
  body.toName = String(body.toName || "").trim();
  const r = await playerMailApi("/mail/send", { method: "POST", body });
  if (r.ok && r.save) applyPlayerMailSave(r.save);
  return r;
}

async function playerMailSend(uid, toName) {
  return playerMailSendPayload({ kind: "weapon", uid, toName });
}

async function playerMailClaim(parcelId) {
  const body = playerMailLeaseBody();
  const r = await playerMailApi("/mail/claim/" + encodeURIComponent(parcelId), {
    method: "POST",
    body,
  });
  if (r.ok && r.save) applyPlayerMailSave(r.save);
  return r;
}

async function playerMailCancel(parcelId) {
  const body = playerMailLeaseBody();
  const r = await playerMailApi("/mail/cancel/" + encodeURIComponent(parcelId), {
    method: "POST",
    body,
  });
  if (r.ok && r.save) applyPlayerMailSave(r.save);
  return r;
}

function playerMailStackOptions() {
  const out = [];
  const adena = Math.max(0, Math.floor(Number(state.adena) || 0));
  if (adena > 0) out.push({ kind: "adena", max: adena, label: "Adena ×" + (typeof fmtAdena === "function" ? fmtAdena(adena) : adena) });
  if (typeof marketStackOptions === "function") {
    marketStackOptions().forEach((s) => out.push(s));
  } else {
    const cry = state.crystals || {};
    ["D", "C", "B", "A"].forEach((g) => {
      const n = Math.max(0, Math.floor(Number(cry[g]) || 0));
      if (n > 0) out.push({ kind: "crystal", grade: g, max: n, label: "Кристалл " + g + " ×" + n });
    });
  }
  return out;
}

function playerMailParcelLabel(parcel) {
  const it = parcel?.item || {};
  const kind = parcel?.kind || it.kind;
  const qty = Math.max(1, Math.floor(Number(parcel?.qty) || 1));
  if (kind === "adena") {
    return (typeof fmtAdena === "function" ? fmtAdena(qty) : qty) + " adena";
  }
  if (kind === "crystal") return "Кристалл " + (it.grade || "?") + " ×" + qty;
  if (kind === "material") {
    const name = (typeof ORE !== "undefined" && ORE[it.ore]?.name) || it.ore || "Руда";
    return name + " ×" + qty;
  }
  if (kind === "shot") {
    const sk = it.shotKind || it.shot_kind;
    const label = (typeof SHOT_TYPE !== "undefined" && SHOT_TYPE[sk]?.label) || sk || "Заряд";
    return label + " " + (it.grade || "") + " ×" + qty;
  }
  if (typeof accountStorageItemLabel === "function") return accountStorageItemLabel(it);
  if (typeof marketListingTitle === "function") {
    return marketListingTitle({ kind, item: it, qty });
  }
  return it.id || "Письмо";
}

function playerMailParcelIcon(parcel) {
  const it = parcel?.item || {};
  const kind = parcel?.kind || it.kind;
  if (kind === "adena") return "icons/etc_adena_i00.png";
  if (kind === "crystal") {
    const map = typeof CRYSTAL_ICON !== "undefined" ? CRYSTAL_ICON : null;
    return (map && map[it.grade]) || "icons/etc_crystal_blue_i00.png";
  }
  if (kind === "material") {
    return (typeof ORE !== "undefined" && ORE[it.ore]?.icon) || "icons/etc_crystal_white_i00.png";
  }
  if (kind === "shot") {
    const sk = it.shotKind || it.shot_kind;
    return (typeof SHOT_ICON !== "undefined" && SHOT_ICON[sk]?.[it.grade]) || "icons/etc_spirit_bullet_blue_i00.png";
  }
  if (typeof accountStorageItemIcon === "function") return accountStorageItemIcon(it);
  return "icons/weapon_small_sword_i00.png";
}

function playerMailIsLoggedIn() {
  return !!(typeof readCloudAuth === "function" && readCloudAuth()?.token);
}
