// ===== Cloud: аккаунт (ник/пароль) + рейтинги =====
const CLOUD_AUTH_KEY = "soulforge_cloud_auth";
const PLAYER_ID_KEY = "soulforge_player_id";
const CLOUD_PENDING_KEY = "soulforge_cloud_pending";
const CLOUD_EVENTS_KEY = "soulforge_cloud_events";
const CLOUD_DEVICE_KEY = "soulforge_device_id";
const CLOUD_TAB_KEY = "soulforge_tab_id";
const CLIENT_VERSION = typeof GAME_VERSION !== "undefined" ? GAME_VERSION : "0.36a";
const CLOUD_SUBMIT_MIN_MS = 45_000;
const CLOUD_LEASE_HEARTBEAT_MS = 30_000;
const CLOUD_LEASE_YIELD_WAIT_MS = 2000;

const CLOUD_CONFIG = {
  baseUrl: null,
  enabled: false,
};

(function applyCloudBootstrap() {
  try {
    const cfg = typeof window !== "undefined" ? window.SOULFORGE_CLOUD : null;
    if (cfg && typeof cfg === "object") {
      if (cfg.baseUrl != null && cfg.baseUrl !== "") CLOUD_CONFIG.baseUrl = String(cfg.baseUrl);
      if (cfg.enabled != null) CLOUD_CONFIG.enabled = !!cfg.enabled;
    }
    // Same-origin: local server (:8787) or production HTTPS behind Caddy/nginx
    if (!CLOUD_CONFIG.enabled && typeof location !== "undefined") {
      const host = String(location.hostname || "").toLowerCase();
      const port = location.port;
      const isLocalHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        host.endsWith(".local");
      // Static hosts (GitHub Pages / Cloudflare Pages) — no API
      const isStaticPages =
        host.endsWith(".github.io") ||
        host.endsWith(".pages.dev") ||
        host.endsWith(".gitlab.io");
      const isDevPort = port === "8787" || port === "1420";
      // Local API (:8787) or any real host (VPS IP/domain) — not GitHub Pages / localhost static
      const isHttpish = location.protocol === "http:" || location.protocol === "https:";
      const isLocalApi = isHttpish && (port === "8787" || /soulforge/i.test(host));
      const isVpsOrigin = isHttpish && !isLocalHost && !isStaticPages;
      if (isLocalApi || isVpsOrigin) {
        CLOUD_CONFIG.baseUrl = CLOUD_CONFIG.baseUrl || location.origin;
        CLOUD_CONFIG.enabled = true;
      } else if (cfg && cfg.enabled && !CLOUD_CONFIG.baseUrl && !isDevPort) {
        CLOUD_CONFIG.baseUrl = location.origin;
      }
    }
    // Explicit empty baseUrl + enabled → same origin
    if (CLOUD_CONFIG.enabled && !CLOUD_CONFIG.baseUrl && typeof location !== "undefined") {
      CLOUD_CONFIG.baseUrl = location.origin;
    }
  } catch (e) {}
})();

function getCloudDeviceId() {
  try {
    if (window.soulforgeDesktop?.isDesktop) {
      if (!_deskDeviceId) {
        _deskDeviceId =
          "d_" +
          (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 10))
            .replace(/-/g, "")
            .slice(0, 24);
      }
      return _deskDeviceId;
    }
    let id = localStorage.getItem(CLOUD_DEVICE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id =
        "d_" +
        (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 10))
          .replace(/-/g, "")
          .slice(0, 24);
      localStorage.setItem(CLOUD_DEVICE_KEY, id);
    }
    return id;
  } catch (e) {
    return "d_local_" + String(Date.now()).slice(-10);
  }
}

function getCloudTabId() {
  try {
    if (window.soulforgeDesktop?.isDesktop) {
      if (!_deskTabId) {
        _deskTabId =
          "t_" +
          (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8))
            .replace(/-/g, "")
            .slice(0, 16);
      }
      return _deskTabId;
    }
    let id = sessionStorage.getItem(CLOUD_TAB_KEY);
    if (!id || !/^[A-Za-z0-9_-]{6,32}$/.test(id)) {
      id =
        "t_" +
        (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8))
          .replace(/-/g, "")
          .slice(0, 16);
      sessionStorage.setItem(CLOUD_TAB_KEY, id);
    }
    return id;
  } catch (e) {
    return "t_" + String(Date.now()).slice(-8);
  }
}

/** Уникальный writer = устройство + вкладка (две вкладки не пишут вместе). */
function getCloudWriterId() {
  return (getCloudDeviceId() + "." + getCloudTabId()).slice(0, 96);
}

function leaseBody(extra) {
  const id = getCloudWriterId();
  return Object.assign({ writerId: id, deviceId: id }, extra || {});
}

let _deskDeviceId = null;
let _deskTabId = null;
let _deskPlayerId = null;
const _deskCloudPending = [];
let _lastCloudSubmitAt = 0;
let _lbMode = "enchant";

function cloudApiUrl(path) {
  const base = (CLOUD_CONFIG.baseUrl || "").replace(/\/$/, "");
  return base + path;
}

function cloudEnabled() {
  return !!(CLOUD_CONFIG.baseUrl && CLOUD_CONFIG.enabled);
}

function readCloudAuth() {
  try {
    const raw = localStorage.getItem(CLOUD_AUTH_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.token || !o.nick) return null;
    return o;
  } catch (e) {
    return null;
  }
}

function writeCloudAuth(auth) {
  try {
    if (!auth) localStorage.removeItem(CLOUD_AUTH_KEY);
    else localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(auth));
  } catch (e) {}
}

function getCloudNick() {
  return readCloudAuth()?.nick || null;
}

function getPlayerId() {
  const nick = getCloudNick();
  if (nick) return "u_" + nick;
  try {
    if (window.soulforgeDesktop?.isDesktop) {
      if (!_deskPlayerId) {
        _deskPlayerId = "p_" + (crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10))).replace(/-/g, "").slice(0, 16);
      }
      return _deskPlayerId;
    }
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = "p_" + (crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10))).replace(/-/g, "").slice(0, 16);
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return "p_local";
  }
}

function readPendingSubmissions() {
  try {
    if (window.soulforgeDesktop?.isDesktop) return _deskCloudPending.slice();
    const raw = localStorage.getItem(CLOUD_PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function writePendingSubmissions(list) {
  try {
    if (window.soulforgeDesktop?.isDesktop) {
      _deskCloudPending.length = 0;
      _deskCloudPending.push(...list.slice(-50));
      return;
    }
    localStorage.setItem(CLOUD_PENDING_KEY, JSON.stringify(list.slice(-50)));
  } catch (e) {}
}

function queuePendingSubmission(payload) {
  const list = readPendingSubmissions();
  list.push({ queuedAt: Date.now(), payload });
  writePendingSubmissions(list);
}

function readPendingEvents() {
  try {
    const raw = localStorage.getItem(CLOUD_EVENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function writePendingEvents(list) {
  try {
    localStorage.setItem(CLOUD_EVENTS_KEY, JSON.stringify((list || []).slice(-200)));
  } catch (e) {}
}

function queuePendingEvent(ev) {
  const list = readPendingEvents();
  list.push(ev);
  writePendingEvents(list);
}

/** Журнал действий персонажа → POST /events (не каждый тап). */
function logCharacterEvent(event, payload, opts) {
  opts = opts || {};
  const ev = {
    event: String(event || "").slice(0, 32),
    characterId: state?.activeCharacterId || opts.characterId || null,
    charName: state?.avatar?.name || opts.charName || null,
    adena: state?.adena != null ? Math.max(0, Math.floor(Number(state.adena) || 0)) : null,
    at: Date.now(),
    payload: payload && typeof payload === "object" ? payload : payload != null ? { value: payload } : null,
    clientVersion: CLIENT_VERSION,
  };
  if (!ev.event) return { ok: false };
  queuePendingEvent(ev);
  flushPendingEvents().catch(() => {});
  return { ok: true, queued: true };
}

async function flushPendingEvents() {
  if (!cloudEnabled() || !readCloudAuth()?.token) {
    return { flushed: 0, remaining: readPendingEvents().length };
  }
  const pending = readPendingEvents();
  if (!pending.length) return { flushed: 0, remaining: 0 };
  const batch = pending.slice(0, 100);
  const left = pending.slice(batch.length);
  try {
    const res = await fetch(cloudApiUrl("/events"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) {
      writePendingEvents(pending);
      return { flushed: 0, remaining: pending.length, status: res.status };
    }
    writePendingEvents(left);
    if (left.length) flushPendingEvents().catch(() => {});
    return { flushed: batch.length, remaining: left.length };
  } catch (e) {
    writePendingEvents(pending);
    return { flushed: 0, remaining: pending.length, offline: true };
  }
}

function computeMaxPlus(records) {
  if (typeof maxWeaponPlus === "function") return maxWeaponPlus();
  let m = 0;
  const r = records || {};
  for (const k of Object.keys(r)) m = Math.max(m, r[k] || 0);
  return m;
}

function buildLeaderboardPayload(event, extra) {
  const data = exportGameData(state);
  const seq = maxStoredSeq();
  const savedAt = Date.now();
  const auth = readCloudAuth();
  return {
    v: 1,
    playerId: getPlayerId(),
    displayName: auth?.nick || null,
    characterId: state.activeCharacterId || null,
    charName: state.avatar?.name || null,
    activeCharacterId: state.activeCharacterId || null,
    event,
    seq,
    savedAt,
    clientVersion: CLIENT_VERSION,
    adena: data.adena,
    earned: data.totals?.earned || 0,
    maxPlus: computeMaxPlus(data.records),
    farmPower: typeof avatarFarmPower === "function" ? avatarFarmPower() : 0,
    mobs: data.achievements?.stats?.gnomesCaught || 0,
    totals: { ...data.totals },
    records: { ...data.records },
    attestation: saveDigest(seq, savedAt, data),
    ...extra,
  };
}

function authHeaders(json) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const auth = readCloudAuth();
  if (auth?.token) h.Authorization = "Bearer " + auth.token;
  return h;
}

function cloudAuthValidate(nick, password) {
  const n = String(nick || "").trim();
  const p = String(password || "");
  if (!/^[a-zA-Z]{2,16}$/.test(n)) {
    return { ok: false, error: "Ник: 2–16 латинских букв (a–z, A–Z)" };
  }
  if (!/^[a-zA-Z0-9]{6,72}$/.test(p)) {
    return { ok: false, error: "Пароль: от 6 символов, только латиница и цифры" };
  }
  return { ok: true, nick: n, password: p };
}

async function cloudAuthRequest(path, body) {
  if (!cloudEnabled()) return { ok: false, offline: true, error: "Сервер не подключён" };
  try {
    const res = await fetch(cloudApiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error || "Ошибка" };
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, offline: true, error: "Нет связи с сервером" };
  }
}


/** Если у ника ещё нет сейва — перенести guest-прогресс под ник (один раз). */
function maybeMigrateGuestSaveToNick(nick) {
  if (!nick) return false;
  if (typeof hasStoredSaveFor !== "function" || typeof copyStoredSave !== "function") return false;
  try {
    if (hasStoredSaveFor(nick)) return false;
    if (!hasStoredSaveFor(null)) return false;
    return !!copyStoredSave(null, nick);
  } catch (e) {
    return false;
  }
}

async function bindSaveToCloudNick(nick) {
  if (typeof switchSaveOwner !== "function") return;
  try {
    await switchSaveOwner(nick || null);
  } catch (e) {
    console.error("switchSaveOwner failed:", e);
  }
}

async function cloudRegister(nick, password) {
  const v = cloudAuthValidate(nick, password);
  if (!v.ok) return v;
  const r = await cloudAuthRequest("/auth/register", { nick: v.nick, password: v.password });
  if (r.ok && r.token) {
    writeCloudAuth({ nick: r.nick, token: r.token, exp: r.exp });
    maybeMigrateGuestSaveToNick(r.nick);
    await bindSaveToCloudNick(r.nick);
    const sync = await syncCloudProgress({ notify: true });
    if (!sync.ok) {
      writeCloudAuth(null);
      await bindSaveToCloudNick(null);
      syncCloudUI();
      return {
        ok: false,
        offline: !!sync.offline,
        error: sync.error || (sync.offline ? "Нет связи с сервером" : "Не удалось синхронизировать сейв"),
      };
    }
    syncCloudUI();
    noteLeaderboardEvent("login");
    logCharacterEvent("login", { via: "register" });
  }
  return r;
}

async function cloudLogin(nick, password) {
  const v = cloudAuthValidate(nick, password);
  if (!v.ok) return v;
  const r = await cloudAuthRequest("/auth/login", { nick: v.nick, password: v.password });
  if (r.ok && r.token) {
    writeCloudAuth({ nick: r.nick, token: r.token, exp: r.exp });
    maybeMigrateGuestSaveToNick(r.nick);
    await bindSaveToCloudNick(r.nick);
    const sync = await syncCloudProgress({ notify: true });
    if (!sync.ok) {
      writeCloudAuth(null);
      await bindSaveToCloudNick(null);
      syncCloudUI();
      return {
        ok: false,
        offline: !!sync.offline,
        error: sync.error || (sync.offline ? "Нет связи с сервером" : "Не удалось синхронизировать сейв"),
      };
    }
    syncCloudUI();
    noteLeaderboardEvent("login");
    logCharacterEvent("login", { via: "login" });
  }
  return r;
}

async function cloudLogout() {
  const auth = readCloudAuth();
  logCharacterEvent("logout", { via: "logout" });
  try {
    await flushPendingEvents();
  } catch (e) {}
  stopLeaseHeartbeat();
  try {
    await flushCloudSave({ force: true });
  } catch (e) {}
  try {
    await releaseWriteLease();
  } catch (e) {}
  if (cloudEnabled() && auth?.token) {
    try {
      await fetch(cloudApiUrl("/auth/logout"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ writerId: getCloudWriterId(), deviceId: getCloudWriterId() }),
      });
    } catch (e) {}
  }
  _cloudWriteLocked = false;
  setWriteLockBanner(false);
  await bindSaveToCloudNick(null);
  writeCloudAuth(null);
  _cloudDevBypass = false;
  syncCloudUI();
  if (typeof show === "function") show("login");
}

/** Есть ли осмысленный локальный прогресс для первой заливки в облако. */
function localSaveHasProgress() {
  try {
    if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
  } catch (e) {}
  if (typeof listCreatedCharacters === "function" && listCreatedCharacters().length > 0) return true;
  if (state?.avatar?.created) return true;
  if ((state?.totals?.tries || 0) > 0 || (state?.totals?.earned || 0) > 0) return true;
  if (state?.adena != null && typeof START_ADENA !== "undefined" && state.adena !== START_ADENA) return true;
  const chars = state?.characters;
  if (Array.isArray(chars) && chars.some((c) => c?.progress?.avatar?.created)) return true;
  return false;
}

function buildCloudSaveBody() {
  try {
    if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
  } catch (e) {}
  const data = typeof exportGameData === "function" ? exportGameData(state) : { ...state };
  delete data.devTune;
  if (typeof avatarFarmPower === "function") data.farmPower = avatarFarmPower();
  const seq = typeof maxStoredSeq === "function" ? maxStoredSeq() : Date.now();
  return {
    seq: Math.max(1, seq),
    savedAt: Date.now(),
    clientVersion: CLIENT_VERSION,
    farmPower: data.farmPower || 0,
    deviceId: getCloudWriterId(),
    writerId: getCloudWriterId(),
    data,
  };
}

let _leaseHeartbeatTimer = null;
let _cloudWriteLocked = false;
let _cloudLeaseExpiresAt = 0;

function stopLeaseHeartbeat() {
  if (_leaseHeartbeatTimer) {
    clearInterval(_leaseHeartbeatTimer);
    _leaseHeartbeatTimer = null;
  }
}

function startLeaseHeartbeat() {
  stopLeaseHeartbeat();
  if (!cloudEnabled() || !readCloudAuth()?.token) return;
  _leaseHeartbeatTimer = setInterval(() => {
    renewWriteLease().catch(() => {});
  }, CLOUD_LEASE_HEARTBEAT_MS);
}

function setWriteLockBanner(show, opts) {
  opts = opts || {};
  let el = document.getElementById("cloudWriteLockBanner");
  if (!el && show && typeof document !== "undefined") {
    el = document.createElement("div");
    el.id = "cloudWriteLockBanner";
    el.className = "cloud-write-lock-banner";
    el.innerHTML =
      '<span class="cloud-write-lock-text">Аккаунт открыт в другой вкладке или на другом устройстве. Запись отключена.</span>' +
      '<button type="button" class="cloud-write-lock-btn" id="cloudWriteLockTakeover">Перехватить</button>';
    document.body.appendChild(el);
    const btn = el.querySelector("#cloudWriteLockTakeover");
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = "1";
      btn.onclick = async () => {
        if (typeof Audio2 !== "undefined") Audio2.click();
        const lease = await acquireWriteLease({ takeover: true, askTakeover: false, notify: true });
        if (lease.ok) {
          setWriteLockBanner(false);
          if (typeof toast === "function") toast("Запись снова на этом устройстве", "success");
        }
      };
    }
  }
  if (!el) return;
  el.hidden = !show;
  if (opts.text) {
    const t = el.querySelector(".cloud-write-lock-text");
    if (t) t.textContent = opts.text;
  }
}

async function releaseWriteLease() {
  if (!cloudEnabled() || !readCloudAuth()?.token) return { ok: false };
  try {
    const res = await fetch(cloudApiUrl("/save/lease/release"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(leaseBody()),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, offline: true };
  }
}

async function renewWriteLease() {
  if (!cloudEnabled() || !readCloudAuth()?.token) return { ok: false, needAuth: true };
  if (_cloudWriteLocked) return { ok: false, locked: true };
  try {
    const res = await fetch(cloudApiUrl("/save/lease/renew"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(leaseBody()),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 423) {
      await handleWriteLeaseLost(json);
      return { ok: false, locked: true, ...json };
    }
    if (!res.ok) return { ok: false, status: res.status, error: json.error };
    _cloudLeaseExpiresAt = json.lease?.expiresAt || 0;
    _cloudWriteLocked = false;
    setWriteLockBanner(false);
    // Периодический flush — меньше потерь при перехвате
    flushCloudSave().catch(() => {});
    return { ok: true, ...json };
  } catch (e) {
    return { ok: false, offline: true };
  }
}

async function handleWriteLeaseLost(json) {
  _cloudWriteLocked = true;
  stopLeaseHeartbeat();
  setWriteLockBanner(true);
  if (typeof toast === "function") {
    toast("Аккаунт перехвачен — запись остановлена", "warn");
  }
  try {
    const remote = await fetchCloudSave();
    if (remote.ok && !remote.empty) {
      applyCloudSaveData(remote.data, remote.seq, remote.savedAt);
    }
  } catch (e) {}
}

function wireLeaseYieldChannel() {
  if (typeof BroadcastChannel === "undefined") return;
  if (document.documentElement.dataset.leaseYieldWired) return;
  document.documentElement.dataset.leaseYieldWired = "1";
  try {
    const ch = new BroadcastChannel("soulforge-lease");
    ch.onmessage = async (ev) => {
      const msg = ev?.data;
      if (!msg || msg.type !== "please-yield") return;
      if (!readCloudAuth()?.token || _cloudWriteLocked) return;
      try {
        await flushCloudSave({ force: true });
        await releaseWriteLease();
      } catch (e) {}
      _cloudWriteLocked = true;
      stopLeaseHeartbeat();
      setWriteLockBanner(true, {
        text: "Другая вкладка запросила управление. Запись на этой вкладке отключена.",
      });
      if (typeof toast === "function") toast("Управление передано другой вкладке", "warn");
    };
    window._soulforgeLeaseChannel = ch;
  } catch (e) {}
}

async function requestOtherTabsYield() {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const ch = window._soulforgeLeaseChannel || new BroadcastChannel("soulforge-lease");
    ch.postMessage({ type: "please-yield", from: getCloudWriterId(), at: Date.now() });
    await new Promise((r) => setTimeout(r, CLOUD_LEASE_YIELD_WAIT_MS));
  } catch (e) {}
}

/**
 * Захватить право записи. При конфликте — спросить takeover.
 * @returns {{ ok: boolean, locked?: boolean, tookOver?: boolean }}
 */
async function acquireWriteLease(opts) {
  opts = opts || {};
  if (!cloudEnabled() || !readCloudAuth()?.token) return { ok: false, needAuth: true };
  const tryClaim = async (takeover) => {
    const res = await fetch(cloudApiUrl("/save/lease"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(leaseBody({ takeover: !!takeover })),
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  };
  try {
    let { res, json } = await tryClaim(false);
    if (res.status === 423) {
      let takeover = !!opts.takeover;
      if (!takeover && opts.askTakeover !== false) {
        if (typeof showConfirm === "function") {
          takeover = await showConfirm({
            title: "Другое устройство / вкладка",
            message:
              "Этот аккаунт сейчас открыт в другой вкладке или на другом устройстве.\n" +
              "Перехватить управление? Сначала попробуем сохранить прогресс там, затем запись будет только здесь.",
            okText: "Перехватить",
            danger: true,
          });
        } else {
          takeover = true;
        }
      }
      if (!takeover) {
        _cloudWriteLocked = true;
        setWriteLockBanner(true);
        return { ok: false, locked: true, cancelled: true, ...json };
      }
      await requestOtherTabsYield();
      ({ res, json } = await tryClaim(true));
      if (!res.ok) {
        _cloudWriteLocked = true;
        setWriteLockBanner(true);
        return { ok: false, locked: true, ...json };
      }
      _cloudWriteLocked = false;
      setWriteLockBanner(false);
      _cloudLeaseExpiresAt = json.lease?.expiresAt || 0;
      startLeaseHeartbeat();
      if (opts.notify && typeof toast === "function") {
        toast("Управление перехвачено на эту вкладку", "success");
      }
      return { ok: true, tookOver: true, ...json };
    }
    if (!res.ok) return { ok: false, status: res.status, error: json.error };
    _cloudWriteLocked = false;
    setWriteLockBanner(false);
    _cloudLeaseExpiresAt = json.lease?.expiresAt || 0;
    startLeaseHeartbeat();
    return { ok: true, ...json };
  } catch (e) {
    return { ok: false, offline: true, error: "Нет связи с сервером" };
  }
}

async function fetchCloudSave() {
  if (!cloudEnabled() || !readCloudAuth()?.token) {
    return { ok: false, needAuth: true };
  }
  try {
    const res = await fetch(cloudApiUrl("/save"), { headers: authHeaders(false) });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      await bindSaveToCloudNick(null);
      writeCloudAuth(null);
      syncCloudUI();
      return { ok: false, needAuth: true };
    }
    if (!res.ok) return { ok: false, status: res.status, error: json.error };
    return { ok: true, ...json };
  } catch (e) {
    return { ok: false, offline: true, error: "Нет связи с сервером" };
  }
}

async function pushCloudSave(opts) {
  opts = opts || {};
  if (!cloudEnabled() || !readCloudAuth()?.token) {
    return { ok: false, needAuth: true };
  }
  if (_cloudWriteLocked) {
    return { ok: false, locked: true };
  }
  const body = buildCloudSaveBody();
  const sentSeq = body.seq;
  try {
    const res = await fetch(cloudApiUrl("/save"), {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 423) {
      await handleWriteLeaseLost(json);
      return { ok: false, locked: true, ...json };
    }
    if (res.status === 409 && json.data) {
      const localSeq = typeof maxStoredSeq === "function" ? maxStoredSeq() : sentSeq;
      // Only apply remote if it is actually newer than local — never roll back combat progress.
      if ((json.seq || 0) > localSeq) {
        applyCloudSaveData(json.data, json.seq, json.savedAt);
        if (opts.notify && typeof toast === "function") {
          toast("Сейв с другого устройства новее — загружен с сервера", "warn");
        }
        return { ok: false, conflict: true, applied: true };
      }
      return { ok: false, conflict: true, applied: false, stale: true };
    }
    if (res.status === 401) {
      await bindSaveToCloudNick(null);
      writeCloudAuth(null);
      syncCloudUI();
      return { ok: false, needAuth: true };
    }
    if (!res.ok) return { ok: false, status: res.status, error: json.error };
    // Response for an outdated request — ignore (a newer local save exists).
    const nowLocal = typeof maxStoredSeq === "function" ? maxStoredSeq() : sentSeq;
    if (sentSeq < nowLocal) {
      return { ok: true, stale: true, seq: sentSeq };
    }
    _lastCloudSaveAt = Date.now();
    if (json.lease?.expiresAt) _cloudLeaseExpiresAt = json.lease.expiresAt;
    return { ok: true, ...json };
  } catch (e) {
    return { ok: false, offline: true };
  }
}

function applyCloudSaveData(data, seq, savedAt) {
  if (!data || typeof data !== "object") return;
  if (typeof applyLoadedSave === "function") applyLoadedSave(data);
  else Object.assign(state, data);
  if (typeof save === "function") {
    _cloudSaveApplying = true;
    try {
      save();
    } finally {
      _cloudSaveApplying = false;
    }
  }
  if (seq != null && typeof setLiveSeq === "function") {
    try {
      setLiveSeq(seq);
    } catch (e) {}
  }
}

/** После логина: скачать облако, захватить право записи, при пустом облаке — залить кэш ника. */
async function syncCloudProgress(opts) {
  opts = opts || {};
  if (!cloudEnabled() || !readCloudAuth()?.token) return { ok: false, needAuth: true };
  const nick = readCloudAuth()?.nick;
  const remote = await fetchCloudSave();
  if (!remote.ok) return remote;

  if (!remote.empty) {
    applyCloudSaveData(remote.data, remote.seq, remote.savedAt);
  }

  const lease = await acquireWriteLease({
    askTakeover: opts.askTakeover !== false,
    takeover: opts.takeover,
    notify: opts.notify,
  });
  if (!lease.ok) {
    if (lease.cancelled || lease.locked) {
      return {
        ok: false,
        locked: true,
        cancelled: !!lease.cancelled,
        error: lease.cancelled
          ? "Аккаунт открыт на другом устройстве"
          : (lease.error || "Нет права записи"),
      };
    }
    return lease;
  }

  if (remote.empty) {
    const ownerMatches =
      nick &&
      typeof currentSaveOwner === "function" &&
      currentSaveOwner() === nick;
    if (ownerMatches && localSaveHasProgress()) {
      const up = await pushCloudSave({ force: true });
      if (!up.ok && !up.conflict && !up.locked) return up;
      if (up.ok && opts.notify && typeof toast === "function") {
        toast("Прогресс сохранён в облако", "success");
      }
      return { ok: true, uploaded: true, ...up };
    }
    if (opts.notify && typeof toast === "function") {
      toast("Новый облачный сейв — можно играть", "success");
    }
    return { ok: true, empty: true };
  }

  if (opts.notify && typeof toast === "function") {
    const name = remote.summary?.activeName;
    toast(name ? "Облачный сейв: " + name : "Прогресс загружен с сервера", "success");
  }
  return { ok: true, downloaded: true, summary: remote.summary };
}

let _cloudSaveTimer = null;
let _lastCloudSaveAt = 0;
let _cloudSaveApplying = false;
let _cloudDevBypass = false;
let _cloudAuthBusy = false;
const CLOUD_SAVE_DEBOUNCE_MS = 1500;
let _cloudPushBusy = false;
let _cloudPushAgain = false;
const CLOUD_GATED_SCREENS = new Set([
  "home", "menu", "characters", "leaderboard",
  "inv", "ench", "shop", "mine", "acc", "ach", "avatar", "quests",
]);

function cloudMainMenuAllowed(opts) {
  opts = opts || {};
  if (opts.devBypass || _cloudDevBypass) return true;
  if (!cloudEnabled()) return true;
  return !!readCloudAuth()?.token;
}

function cloudGateScreen(screen) {
  if (!cloudEnabled()) return true;
  if (_cloudDevBypass) return true;
  if (!CLOUD_GATED_SCREENS.has(screen)) return true;
  return !!readCloudAuth()?.token;
}

function scheduleCloudSave() {
  if (_cloudSaveApplying || _cloudWriteLocked) return;
  if (!cloudEnabled() || !readCloudAuth()?.token) return;
  if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(() => {
    _cloudSaveTimer = null;
    flushCloudSave();
  }, CLOUD_SAVE_DEBOUNCE_MS);
}

async function flushCloudSave(opts) {
  opts = opts || {};
  if (_cloudSaveTimer) {
    clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = null;
  }
  if (_cloudSaveApplying) return { ok: false, applying: true };
  if (_cloudWriteLocked) return { ok: false, locked: true };
  if (!cloudEnabled() || !readCloudAuth()?.token) return { ok: false, needAuth: true };

  // Serialize PUTs: one in flight; if save changes meanwhile, push again with latest body.
  if (_cloudPushBusy) {
    _cloudPushAgain = true;
    return { ok: false, queued: true };
  }
  _cloudPushBusy = true;
  let last = { ok: false };
  try {
    do {
      _cloudPushAgain = false;
      last = await pushCloudSave(opts);
    } while (_cloudPushAgain);
  } finally {
    _cloudPushBusy = false;
  }
  return last;
}

function wireCloudSaveLifecycle() {
  if (typeof document === "undefined" || document.documentElement.dataset.cloudSaveWired) return;
  document.documentElement.dataset.cloudSaveWired = "1";
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCloudSave();
  });
  window.addEventListener("pagehide", () => {
    flushCloudSave();
  });
}

async function submitLeaderboardEvent(event, extra, opts) {
  opts = opts || {};
  const now = Date.now();
  if (!opts.force && event === "snapshot" && now - _lastCloudSubmitAt < CLOUD_SUBMIT_MIN_MS) {
    return { ok: false, throttled: true };
  }
  const payload = buildLeaderboardPayload(event, extra || {});
  if (!cloudEnabled()) {
    queuePendingSubmission(payload);
    return { ok: false, offline: true, queued: true };
  }
  const auth = readCloudAuth();
  if (!auth?.token) {
    queuePendingSubmission(payload);
    return { ok: false, needAuth: true, queued: true };
  }
  try {
    const res = await fetch(cloudApiUrl("/runs"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (res.status === 401) {
        await bindSaveToCloudNick(null);
        writeCloudAuth(null);
      }
      queuePendingSubmission(payload);
      syncCloudUI();
      return { ok: false, status: res.status };
    }
    _lastCloudSubmitAt = now;
    return { ok: true, status: res.status };
  } catch (e) {
    queuePendingSubmission(payload);
    return { ok: false, offline: true, queued: true };
  }
}

async function flushPendingSubmissions(opts) {
  opts = opts || {};
  if (!cloudEnabled() || !readCloudAuth()?.token) return { flushed: 0, remaining: 0 };
  const pending = readPendingSubmissions();
  if (!pending.length) {
    await flushPendingEvents();
    return { flushed: 0, remaining: 0 };
  }
  const left = [];
  let flushed = 0;
  for (const item of pending) {
    try {
      const res = await fetch(cloudApiUrl("/runs"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(item.payload),
      });
      if (res.ok) flushed++;
      else left.push(item);
    } catch (e) {
      left.push(item);
    }
  }
  writePendingSubmissions(left);
  syncCloudUI();
  if (opts.notify && flushed > 0 && typeof toast === "function") {
    toast("В рейтинг отправлено: " + flushed, "success");
  } else if (opts.notify && pending.length && flushed === 0 && left.length && typeof toast === "function") {
    toast("Очередь рейтинга не ушла — попробуй позже", "warn");
  }
  await flushPendingEvents();
  return { flushed, remaining: left.length };
}

async function fetchLeaderboard(mode) {
  if (!cloudEnabled()) {
    return { ok: false, offline: true, rows: [] };
  }
  try {
    const res = await fetch(cloudApiUrl("/leaderboard/" + encodeURIComponent(mode || "enchant")));
    if (!res.ok) return { ok: false, status: res.status, rows: [] };
    const rows = await res.json();
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch (e) {
    return { ok: false, offline: true, rows: [] };
  }
}

function updateHomeRatingSubtitle() {
  const el = document.getElementById("homeRatingSub");
  if (!el) return;
  const pending = readPendingSubmissions().length;
  const auth = readCloudAuth();
  if (!cloudEnabled()) {
    el.textContent = pending ? ("Оффлайн · в очереди " + pending) : "Сервер оффлайн";
    return;
  }
  if (!auth?.nick) {
    el.textContent = pending
      ? ("Войдите · в очереди " + pending)
      : "Войдите, чтобы попасть в рейтинг";
    return;
  }
  el.textContent = pending
    ? (auth.nick + " · очередь " + pending)
    : "Заточка · сила · богатство";
}

function isLeaderboardMe(row, me) {
  if (!me || !row) return false;
  const account = String(me).toLowerCase();
  const nick = String(row.nick || "").toLowerCase();
  const cid = typeof state !== "undefined" ? state.activeCharacterId : null;
  if (cid && row.characterId) {
    return nick === account && String(row.characterId) === String(cid);
  }
  if (nick) return nick === account;
  return String(row.name || "").toLowerCase() === account;
}

function isLeaderboardMyAccount(row, me) {
  if (!me || !row) return false;
  const nick = String(row.nick || "").toLowerCase();
  if (nick) return nick === String(me).toLowerCase();
  return String(row.name || "").toLowerCase() === String(me).toLowerCase();
}

function syncCloudUI() {
  const idEl = document.getElementById("playerIdShort");
  const hint = document.getElementById("cloudHint");
  const auth = readCloudAuth();
  const pending = readPendingSubmissions().length;
  if (idEl) {
    if (auth?.nick) {
      idEl.textContent = auth.nick;
      idEl.title = auth.nick;
    } else {
      const id = getPlayerId();
      idEl.textContent = id.length > 10 ? id.slice(0, 6) + "…" + id.slice(-4) : id;
      idEl.title = id;
    }
  }
  if (hint) {
    if (!cloudEnabled()) {
      hint.textContent = pending
        ? "Оффлайн · в очереди " + pending
        : "Сервер оффлайн · демо без аккаунта";
    } else if (auth?.nick) {
      hint.textContent = pending
        ? ("В сети · " + auth.nick + " · в очереди " + pending)
        : ("Прогресс на сервере · аккаунт " + auth.nick + " · «Выйти» — сменить");
    } else {
      hint.textContent = pending
        ? ("Войдите · в очереди " + pending + " · прогресс хранится на сервере")
        : "Войдите или создайте аккаунт · прогресс хранится на сервере";
    }
  }
  const nickInput = document.getElementById("cloudNick");
  const passInput = document.getElementById("cloudPass");
  const statusEl = document.getElementById("cloudAuthStatus");
  if (statusEl) {
    statusEl.textContent = auth?.nick ? ("Вход: " + auth.nick) : "";
    statusEl.hidden = !auth?.nick;
  }
  const loginBtn = document.getElementById("cloudLoginBtn");
  const regBtn = document.getElementById("cloudRegisterBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");
  const cancelBtn = document.getElementById("cloudCancelBtn");
  if (loginBtn) {
    loginBtn.hidden = false;
    loginBtn.textContent = auth?.nick ? "Продолжить" : "Войти";
  }
  if (regBtn) regBtn.hidden = !!auth;
  if (logoutBtn) logoutBtn.hidden = !auth;
  if (cancelBtn) cancelBtn.hidden = cloudEnabled();
  const titleEl = document.getElementById("l2LoginTitle");
  if (titleEl) titleEl.textContent = auth?.nick ? "Сессия" : "Вход";
  if (nickInput) {
    nickInput.hidden = false;
    if (auth?.nick) nickInput.value = auth.nick;
  }
  if (passInput) passInput.hidden = false;
  const tile = document.getElementById("lbTileMeta");
  if (tile) tile.textContent = auth?.nick || (cloudEnabled() ? "Войти" : "Офлайн");

  const homeStatus = document.getElementById("homeAccountStatus");
  if (homeStatus) {
    if (auth?.nick) {
      homeStatus.textContent = "Аккаунт: " + auth.nick;
      homeStatus.classList.remove("is-guest");
    } else if (cloudEnabled()) {
      homeStatus.textContent = "Войдите в аккаунт";
      homeStatus.classList.add("is-guest");
    } else {
      homeStatus.textContent = "Оффлайн · без сервера";
      homeStatus.classList.add("is-guest");
    }
  }
  const homeLoginBtn = document.getElementById("homeLoginBtn");
  if (homeLoginBtn) {
    if (auth?.nick) {
      homeLoginBtn.textContent = "Сменить аккаунт";
      homeLoginBtn.title = "Выйти и открыть вход";
    } else {
      homeLoginBtn.textContent = "Войти в аккаунт";
      homeLoginBtn.title = "Логин или регистрация";
    }
  }
  updateHomeRatingSubtitle();
  if (typeof updateHomeCharsSubtitle === "function") updateHomeCharsSubtitle();
}

function noteLeaderboardEvent(event, extra, opts) {
  submitLeaderboardEvent(event, extra, opts).then((r) => {
    if (!r?.queued || (event !== "record" && event !== "sell")) return;
    if (typeof toast !== "function") return;
    const auth = readCloudAuth();
    if (!auth?.token) return;
    if (r.offline) toast("Нет сети · рекорд в очереди", "warn");
  });
}

function formatLbValue(mode, row) {
  const v = row.value != null ? row.value : 0;
  if (mode === "enchant") return "+" + v;
  if (mode === "wealth") return typeof fmtAdena === "function" ? fmtAdena(v) : String(v);
  if (mode === "mobs") {
    const n = typeof fmt === "function" ? fmt(v) : String(v);
    return n + " мобов";
  }
  return typeof fmt === "function" ? fmt(v) : String(v);
}

async function renderLeaderboard() {
  const list = document.getElementById("lbList");
  const status = document.getElementById("lbStatus");
  const cta = document.getElementById("lbLoginCta");
  if (!list) return;
  list.innerHTML = "";
  const auth = readCloudAuth();
  const pending = readPendingSubmissions().length;
  const modeLabel = { enchant: "Заточка", power: "Сила", wealth: "Богатство", mobs: "Мобы" }[_lbMode] || _lbMode;

  if (cta) {
    cta.hidden = !!(auth?.nick) || !cloudEnabled();
  }

  if (status) {
    if (!cloudEnabled()) {
      status.textContent = pending
        ? "Сервер недоступен · в очереди " + pending + " событий"
        : "Сервер не подключён";
    } else if (!auth?.nick) {
      status.textContent = pending
        ? "Войдите · в очереди " + pending
        : "Войдите, чтобы попасть в рейтинг";
    } else if (pending) {
      status.textContent = modeLabel + " · " + (state.avatar?.name || auth.nick) + " · очередь: " + pending;
    } else {
      const hero = state.avatar?.name;
      status.textContent = hero
        ? modeLabel + " · " + hero + " · " + auth.nick
        : modeLabel + " · " + auth.nick;
    }
  }
  document.querySelectorAll(".lb-tab").forEach((btn) => {
    btn.classList.toggle("sel", btn.dataset.mode === _lbMode);
  });
  const res = await fetchLeaderboard(_lbMode);
  if (!res.ok) {
    if (status) status.textContent = res.offline ? "Нет связи с сервером" : "Не удалось загрузить рейтинг";
    return;
  }
  if (!res.rows.length) {
    const empty = document.createElement("p");
    empty.className = "lb-empty";
    empty.textContent = auth?.nick
      ? "Пока пусто — заточи оружие или заверши фарм, затем обнови."
      : "Пока пусто. Войди и сыграй, чтобы появиться в таблице.";
    list.appendChild(empty);
    return;
  }
  const me = getCloudNick();
  let foundMe = false;
  res.rows.forEach((row) => {
    const isMe = isLeaderboardMe(row, me);
    const isMine = !isMe && isLeaderboardMyAccount(row, me);
    if (isMe) foundMe = true;
    const el = document.createElement("div");
    el.className = "lb-row" + (isMe ? " me" : isMine ? " mine" : "");
    el.innerHTML =
      '<span class="lb-rank">' + row.rank + "</span>" +
      '<span class="lb-name"></span>' +
      '<span class="lb-val"></span>';
    const nameEl = el.querySelector(".lb-name");
    const hero = row.charName || row.name || "—";
    const account = row.nick || "";
    const main = document.createElement("span");
    main.className = "lb-name-main";
    main.textContent = hero;
    nameEl.appendChild(main);
    if (account && String(account).toLowerCase() !== String(hero).toLowerCase()) {
      const nickEl = document.createElement("span");
      nickEl.className = "lb-nick";
      nickEl.textContent = account;
      nameEl.appendChild(nickEl);
    }
    if (isMe) {
      const tag = document.createElement("span");
      tag.className = "lb-me-tag";
      tag.textContent = "ты";
      nameEl.appendChild(tag);
    } else if (isMine) {
      const tag = document.createElement("span");
      tag.className = "lb-mine-tag";
      tag.textContent = "твой";
      nameEl.appendChild(tag);
    }
    el.querySelector(".lb-val").textContent = formatLbValue(_lbMode, row);
    list.appendChild(el);
  });
  if (me && !foundMe && status) {
    status.textContent =
      (status.textContent || modeLabel) + " · тебя ещё нет в топе — сыграй и нажми «Обновить»";
  }
}

function openLeaderboard(opts) {
  opts = opts || {};
  const back = document.querySelector("#screen-leaderboard .back[data-to], #screen-leaderboard .panel-head .back");
  if (back) {
    const to = opts.from === "home" ? "home" : "menu";
    back.dataset.to = to;
    back.textContent = to === "home" ? "← Главное меню" : "← В меню";
    back.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      show(to);
    };
  }
  if (readCloudAuth()?.token) flushPendingSubmissions();
  renderLeaderboard();
  show("leaderboard");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
}

function enterMainMenuFromLogin(opts) {
  opts = opts || {};
  if (!cloudMainMenuAllowed(opts)) {
    if (typeof show === "function") show("login");
    return;
  }
  if (typeof openHome === "function") openHome();
  else if (typeof show === "function") show("home");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  const emptyRoster =
    typeof listCreatedCharacters === "function"
      ? listCreatedCharacters().length === 0
      : !(state?.avatar?.created);
  if (opts.afterRegister || (opts.guideCreate && emptyRoster)) {
    if (typeof toast === "function") {
      toast(
        opts.afterRegister
          ? "Аккаунт пустой — открой «Персонажи» и создай героя"
          : "Сначала создай персонажа в «Персонажи»",
        "system"
      );
    }
  }
}

async function wireCloudAuthForms() {
  const loginBtn = document.getElementById("cloudLoginBtn");
  const regBtn = document.getElementById("cloudRegisterBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");
  const cancelBtn = document.getElementById("cloudCancelBtn");
  const nickEl = document.getElementById("cloudNick");
  const passEl = document.getElementById("cloudPass");
  const msgEl = document.getElementById("cloudAuthMsg");
  const setMsg = (t, warn) => {
    if (!msgEl) return;
    msgEl.textContent = t || "";
    msgEl.classList.toggle("warn", !!warn);
  };
  const setAuthBusy = (busy) => {
    _cloudAuthBusy = !!busy;
    if (loginBtn) loginBtn.disabled = busy;
    if (regBtn) regBtn.disabled = busy;
    if (logoutBtn) logoutBtn.disabled = busy;
  };
  const tryLogin = async () => {
    if (_cloudAuthBusy) return;
    const nick = (nickEl?.value || "").trim();
    const password = passEl?.value || "";
    const existing = readCloudAuth();
    if (existing?.nick && existing?.token && !password) {
      setAuthBusy(true);
      setMsg("Синхронизация…");
      try {
        await bindSaveToCloudNick(existing.nick);
        const sync = await syncCloudProgress({ notify: true });
        if (!sync.ok) {
          setMsg(
            sync.locked
              ? (sync.error || "Аккаунт открыт на другом устройстве")
              : (sync.error || "Не удалось загрузить сейв"),
            true
          );
          return;
        }
        setMsg("С возвращением, " + existing.nick);
        await flushPendingSubmissions({ notify: true });
        enterMainMenuFromLogin({ guideCreate: true });
      } finally {
        setAuthBusy(false);
      }
      return;
    }
    setAuthBusy(true);
    setMsg("Вход…");
    try {
      const r = await cloudLogin(nick, password);
      if (r.ok) {
        setMsg("Добро пожаловать, " + r.nick);
        if (passEl) passEl.value = "";
        await flushPendingSubmissions({ notify: true });
        enterMainMenuFromLogin({ guideCreate: true });
      } else setMsg(r.error || "Ошибка входа", true);
    } finally {
      setAuthBusy(false);
    }
  };
  if (loginBtn) {
    loginBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      await tryLogin();
    };
  }
  if (regBtn) {
    regBtn.onclick = async () => {
      if (_cloudAuthBusy) return;
      if (typeof Audio2 !== "undefined") Audio2.click();
      const nick = (nickEl?.value || "").trim();
      const password = passEl?.value || "";
      setAuthBusy(true);
      setMsg("Создание аккаунта…");
      try {
        const r = await cloudRegister(nick, password);
        if (r.ok) {
          setMsg("Аккаунт создан: " + r.nick);
          if (passEl) passEl.value = "";
          await flushPendingSubmissions({ notify: true });
          enterMainMenuFromLogin({ afterRegister: true });
        } else setMsg(r.error || "Ошибка регистрации", true);
      } finally {
        setAuthBusy(false);
      }
    };
  }
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (_cloudAuthBusy) return;
      if (typeof Audio2 !== "undefined") Audio2.click();
      setAuthBusy(true);
      try {
        await cloudLogout();
        setMsg("Выход выполнен");
        if (passEl) passEl.value = "";
      } finally {
        setAuthBusy(false);
      }
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setMsg("");
      if (nickEl) nickEl.value = "";
      if (passEl) passEl.value = "";
      if (!cloudEnabled()) {
        await bindSaveToCloudNick(null);
        enterMainMenuFromLogin();
      }
    };
  }
  const devSkip = document.getElementById("loginDevSkip");
  if (devSkip) {
    const allowDev = typeof FEATURE_DEV_PANEL !== "undefined" && FEATURE_DEV_PANEL;
    devSkip.hidden = !allowDev;
    if (allowDev && !devSkip.dataset.wired) {
      devSkip.dataset.wired = "1";
      devSkip.onclick = () => {
        if (typeof Audio2 !== "undefined") Audio2.click();
        setMsg("DEV · пропуск");
        _cloudDevBypass = true;
        enterMainMenuFromLogin({ devBypass: true });
      };
    }
  }
  const onEnter = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (typeof Audio2 !== "undefined") Audio2.click();
    tryLogin();
  };
  if (nickEl && !nickEl.dataset.enterWired) {
    nickEl.dataset.enterWired = "1";
    nickEl.addEventListener("keydown", onEnter);
  }
  if (passEl && !passEl.dataset.enterWired) {
    passEl.dataset.enterWired = "1";
    passEl.addEventListener("keydown", onEnter);
  }
  document.querySelectorAll(".lb-tab").forEach((btn) => {
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      _lbMode = btn.dataset.mode || "enchant";
      renderLeaderboard();
    };
  });
  const refreshBtn = document.getElementById("lbRefreshBtn");
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      await flushPendingSubmissions({ notify: true });
      await submitLeaderboardEvent("snapshot", null, { force: true });
      await renderLeaderboard();
    };
  }
  const lbCta = document.getElementById("lbLoginCta");
  if (lbCta && !lbCta.dataset.wired) {
    lbCta.dataset.wired = "1";
    lbCta.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      if (typeof openLoginScreen === "function") openLoginScreen();
      else show("login");
    };
  }
}

function initCloud() {
  syncCloudUI();
  wireCloudAuthForms();
  wireCloudSaveLifecycle();
  wireLeaseYieldChannel();
  if (cloudEnabled() && readCloudAuth()?.token) {
    flushPendingSubmissions({ notify: false });
    flushPendingEvents().catch(() => {});
  }
}

/** Автовход: токен есть → синхронизация с сервера → главное меню. */
async function tryResumeCloudSession() {
  if (!cloudEnabled() || !readCloudAuth()?.token) return { ok: false, skipped: true };
  const auth = readCloudAuth();
  const msgEl = document.getElementById("cloudAuthMsg");
  const setMsg = (t, warn) => {
    if (!msgEl) return;
    msgEl.textContent = t || "";
    msgEl.classList.toggle("warn", !!warn);
  };
  setMsg("Синхронизация…");
  await bindSaveToCloudNick(auth.nick);
  const sync = await syncCloudProgress({ notify: false });
  if (!sync.ok) {
    const msg = sync.locked
      ? (sync.error || "Аккаунт открыт на другом устройстве")
      : sync.offline
        ? "Нет связи с сервером"
        : (sync.error || "Не удалось загрузить сейв");
    setMsg(msg, true);
    return sync;
  }
  setMsg("");
  await flushPendingSubmissions({ notify: false });
  flushPendingEvents().catch(() => {});
  enterMainMenuFromLogin({ guideCreate: true });
  return sync;
}

window.SoulforgeCloud = {
  config: CLOUD_CONFIG,
  getPlayerId,
  getNick: getCloudNick,
  register: cloudRegister,
  login: cloudLogin,
  logout: cloudLogout,
  submit: submitLeaderboardEvent,
  logEvent: logCharacterEvent,
  flushEvents: flushPendingEvents,
  fetchLeaderboard,
  flushPending: flushPendingSubmissions,
  pending: readPendingSubmissions,
  syncProgress: syncCloudProgress,
  tryResumeSession: tryResumeCloudSession,
  gateScreen: cloudGateScreen,
  acquireLease: acquireWriteLease,
  getDeviceId: getCloudDeviceId,
  pushSave: pushCloudSave,
  flushSave: flushCloudSave,
  scheduleSave: scheduleCloudSave,
};
