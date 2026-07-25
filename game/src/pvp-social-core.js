// ===== Облачные дуэли / async PvP =====

const PVP_MATCH_POLL_MS = 2000;

function pvpSocialCharacterId() {
  return (
    state.activeCharacterId ||
    (state.characters && state.characters[0] && state.characters[0].id) ||
    null
  );
}

function pvpSocialLoggedIn() {
  return (
    typeof cloudEnabled === "function" &&
    cloudEnabled() &&
    typeof readCloudAuth === "function" &&
    !!readCloudAuth()?.token
  );
}

async function pvpSocialApi(path, opts) {
  opts = opts || {};
  if (!pvpSocialLoggedIn()) {
    return { ok: false, error: "Войдите в облачный аккаунт" };
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
      return { ok: false, error: data.error || data.message || "Ошибка " + res.status, status: res.status };
    }
    return Object.assign({ ok: true }, data);
  } catch (e) {
    return { ok: false, error: e.message || "Сеть недоступна" };
  }
}

function pvpCurrentSheet() {
  if (typeof pvpLiveSheet === "function") return pvpLiveSheet();
  if (!state.avatar?.created || typeof buildCombatSheet !== "function") return null;
  return buildCombatSheet({
    avatar: state.avatar,
    name: state.avatar.name || "Вы",
    shotArmed: false,
  });
}

async function pvpPublishCurrentSheet() {
  const sheet = pvpCurrentSheet();
  const cid = pvpSocialCharacterId();
  if (!sheet || !cid) return { ok: false, error: "Нет персонажа" };
  return pvpSocialApi("/pvp/sheet", {
    method: "POST",
    body: { characterId: cid, sheet },
  });
}

async function pvpLookupName(name) {
  const q = "?name=" + encodeURIComponent(String(name || "").trim());
  return pvpSocialApi("/pvp/sheet/lookup" + q);
}

async function pvpFetchOnlineList() {
  return pvpSocialApi("/pvp/online");
}

async function pvpChallengeName(toName) {
  const sheet = pvpCurrentSheet();
  const cid = pvpSocialCharacterId();
  if (!sheet || !cid) return { ok: false, error: "Нет персонажа" };
  return pvpSocialApi("/duel/challenge", {
    method: "POST",
    body: { characterId: cid, toName: String(toName || "").trim(), sheet },
  });
}

async function pvpFetchDuelInbox() {
  const cid = pvpSocialCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return pvpSocialApi("/duel/inbox" + qs);
}

async function pvpFetchDuelOutbox() {
  const cid = pvpSocialCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return pvpSocialApi("/duel/outbox" + qs);
}

async function pvpRespondChallenge(id, accept) {
  const sheet = pvpCurrentSheet();
  const cid = pvpSocialCharacterId();
  if (!cid) return { ok: false, error: "Нет персонажа" };
  return pvpSocialApi("/duel/respond/" + encodeURIComponent(id), {
    method: "POST",
    body: { characterId: cid, accept: !!accept, sheet },
  });
}

async function pvpFetchActiveMatch() {
  const cid = pvpSocialCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return pvpSocialApi("/duel/match/active" + qs);
}

async function pvpFetchMatch(matchId) {
  const cid = pvpSocialCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return pvpSocialApi("/duel/match/" + encodeURIComponent(matchId) + qs);
}

async function pvpSubmitMatchAction(matchId, action) {
  const cid = pvpSocialCharacterId();
  return pvpSocialApi("/duel/match/" + encodeURIComponent(matchId) + "/action", {
    method: "POST",
    body: { characterId: cid, action },
  });
}

async function pvpAsyncAttackName(toName) {
  const sheet = pvpCurrentSheet();
  const cid = pvpSocialCharacterId();
  if (!sheet || !cid) return { ok: false, error: "Нет персонажа" };
  return pvpSocialApi("/pvp/async/attack", {
    method: "POST",
    body: { characterId: cid, toName: String(toName || "").trim(), sheet },
  });
}

async function pvpFetchAsyncInbox() {
  const cid = pvpSocialCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return pvpSocialApi("/pvp/async/inbox" + qs);
}

async function pvpFetchAsyncOutbox() {
  const cid = pvpSocialCharacterId();
  const qs = cid ? "?characterId=" + encodeURIComponent(cid) : "";
  return pvpSocialApi("/pvp/async/outbox" + qs);
}

/**
 * Учёт рейтингового исхода (не тренировка).
 * @param {{ youWin?: boolean, draw?: boolean, mode?: "duel"|"async", rating?: number, matchKey?: string }} opts
 */
function recordPvpOutcome(opts) {
  opts = opts || {};
  if (!opts.matchKey) opts.matchKey = "anon";
  if (!window._pvpOutcomeSeen) window._pvpOutcomeSeen = Object.create(null);
  if (window._pvpOutcomeSeen[opts.matchKey]) return false;
  window._pvpOutcomeSeen[opts.matchKey] = true;

  if (opts.youWin) {
    if (typeof achStat === "function") {
      achStat("pvpWins", 1);
      if (opts.mode === "async") achStat("pvpAsyncWins", 1);
      else achStat("pvpDuelWins", 1);
    }
  } else if (!opts.draw) {
    if (typeof achStat === "function") achStat("pvpLosses", 1);
  }
  if (opts.rating != null && typeof achStatMax === "function") {
    achStatMax("pvpRating", Math.max(0, Math.floor(Number(opts.rating) || 0)));
  }
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof noteLeaderboardEvent === "function") {
    try {
      noteLeaderboardEvent("snapshot");
    } catch (_) {}
  }
  return true;
}
