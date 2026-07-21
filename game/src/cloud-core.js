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

/** Lease на сервере — по устройству (не вкладке). writerId — для yield между вкладками. */
function leaseBody(extra) {
  const deviceId = getCloudDeviceId();
  return Object.assign({ deviceId, writerId: getCloudWriterId() }, extra || {});
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

let _flushEventsBusy = false;

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
  if (_flushEventsBusy) {
    return { flushed: 0, remaining: readPendingEvents().length, busy: true };
  }
  _flushEventsBusy = true;
  let flushedTotal = 0;
  try {
    while (true) {
      const pending = readPendingEvents();
      if (!pending.length) {
        return { flushed: flushedTotal, remaining: 0 };
      }
      const batch = pending.slice(0, 100);
      const left = pending.slice(batch.length);
      // Снимаем batch до ответа — иначе параллельный flush шлёт дубли.
      writePendingEvents(left);
      try {
        const res = await fetch(cloudApiUrl("/events"), {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ events: batch }),
        });
        if (!res.ok) {
          writePendingEvents(batch.concat(readPendingEvents()).slice(-200));
          return { flushed: flushedTotal, remaining: readPendingEvents().length, status: res.status };
        }
        flushedTotal += batch.length;
      } catch (e) {
        writePendingEvents(batch.concat(readPendingEvents()).slice(-200));
        return { flushed: flushedTotal, remaining: readPendingEvents().length, offline: true };
      }
      if (!left.length) {
        return { flushed: flushedTotal, remaining: 0 };
      }
    }
  } finally {
    _flushEventsBusy = false;
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
    await bindSaveToCloudNick(r.nick);
    if (typeof ensureFreshAccountSave === "function") ensureFreshAccountSave();
    const sync = await syncCloudProgress({ notify: true });
    if (!sync.ok) {
      if (!sync.readOnly) {
        writeCloudAuth(null);
        await bindSaveToCloudNick(null);
        syncCloudUI();
        return {
          ok: false,
          offline: !!sync.offline,
          error: sync.error || (sync.offline ? "Нет связи с сервером" : "Не удалось синхронизировать сейв"),
        };
      }
    }
    if (typeof syncCloudUI === "function") syncCloudUI();
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
    await bindSaveToCloudNick(r.nick);
    const sync = await syncCloudProgress({ notify: true });
    if (!sync.ok) {
      if (!sync.readOnly) {
        writeCloudAuth(null);
        await bindSaveToCloudNick(null);
        syncCloudUI();
        return {
          ok: false,
          offline: !!sync.offline,
          error: sync.error || (sync.offline ? "Нет связи с сервером" : "Не удалось синхронизировать сейв"),
        };
      }
    }
    if (typeof syncCloudUI === "function") syncCloudUI();
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
        body: JSON.stringify({ deviceId: getCloudDeviceId(), writerId: getCloudWriterId() }),
      });
    } catch (e) {}
  }
  _cloudWriteLocked = false;
  setWriteLockBanner(false);
  await bindSaveToCloudNick(null);
  writeCloudAuth(null);
  _cloudDevBypass = false;
  if (typeof syncCloudUI === "function") syncCloudUI();
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
    deviceId: getCloudDeviceId(),
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

function cloudWriteLocked() {
  return !!_cloudWriteLocked;
}

function cloudHasWriteAccess() {
  if (!cloudEnabled() || !readCloudAuth()?.token) return true;
  return !_cloudWriteLocked;
}

function cloudGameplayAllowed() {
  return cloudHasWriteAccess();
}

function setWriteLockBanner(show, opts) {
  opts = opts || {};
  let el = document.getElementById("cloudWriteLockBanner");
  if (!el && show && typeof document !== "undefined") {
    el = document.createElement("div");
    el.id = "cloudWriteLockBanner";
    el.className = "cloud-write-lock-banner";
    el.innerHTML =
      '<div class="cloud-write-lock-card">' +
      '<p class="cloud-write-lock-text">Аккаунт открыт на другом устройстве. Здесь только просмотр — прогресс не сохранится.</p>' +
      '<div class="cloud-write-lock-actions">' +
      '<button type="button" class="cloud-write-lock-btn cloud-write-lock-btn-primary" id="cloudWriteLockTakeover">Перехватить</button>' +
      '<button type="button" class="cloud-write-lock-btn cloud-write-lock-btn-ghost" id="cloudWriteLockRefresh">Обновить с сервера</button>' +
      "</div></div>";
    document.body.appendChild(el);
    const btnTake = el.querySelector("#cloudWriteLockTakeover");
    const btnRef = el.querySelector("#cloudWriteLockRefresh");
    if (btnTake && !btnTake.dataset.wired) {
      btnTake.dataset.wired = "1";
      btnTake.onclick = async () => {
        if (typeof Audio2 !== "undefined") Audio2.click();
        const lease = await acquireWriteLease({ takeover: true, askTakeover: false, notify: false });
        if (lease.ok) {
          await pullLatestCloudSave({ notify: true });
          setWriteLockBanner(false);
          if (typeof toast === "function") toast("Запись снова на этом устройстве", "success");
        }
      };
    }
    if (btnRef && !btnRef.dataset.wired) {
      btnRef.dataset.wired = "1";
      btnRef.onclick = async () => {
        if (typeof Audio2 !== "undefined") Audio2.click();
        try {
          const remote = await fetchCloudSave();
          if (remote.ok && !remote.empty) {
            applyCloudSaveData(remote.data, remote.seq, remote.savedAt);
            if (typeof toast === "function") toast("Прогресс обновлён с сервера", "success");
          }
        } catch (e) {}
      };
    }
  }
  if (!el) return;
  el.hidden = !show;
  document.body.classList.toggle("cloud-write-locked", !!show);
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
    await pullLatestCloudSave({ notify: false });
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
      // Блокируем фоновые cloud pushes, пока пользователь решает перехват.
      // Иначе scheduled save срабатывает во время диалога и вызывает handleWriteLeaseLost,
      // который накладывает banner поверх showConfirm.
      _cloudWriteLocked = true;
      setWriteLockBanner(false);
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
          takeover = false;
        }
      }
      if (!takeover) {
        if (opts.offerReadOnly !== false && typeof showConfirm === "function") {
          const viewOnly = await showConfirm({
            title: "Только просмотр",
            message:
              "Войти без записи? Прогресс подтянется с сервера, играть и сохранять можно только на активном устройстве.",
            okText: "Просмотр",
            cancelText: "Остаться на входе",
          });
          if (viewOnly) {
            _cloudWriteLocked = true;
            setWriteLockBanner(true);
            return { ok: false, locked: true, cancelled: true, readOnly: true, ...json };
          }
        }
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
      if (opts.takeover) {
        await pullLatestCloudSave({ notify: opts.notify && typeof toast === "function" });
      }
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
  const serverSeq = Math.max(1, Math.floor(Number(seq) || 0));
  const serverAt = Math.max(0, Math.floor(Number(savedAt) || Date.now()));
  _cloudSaveApplying = true;
  try {
    if (typeof persistEnvelope === "function" && typeof makeEnvelope === "function") {
      const snap =
        typeof exportGameData === "function" ? exportGameData(state) : data;
      persistEnvelope(makeEnvelope(snap, serverSeq, serverAt));
    } else if (typeof save === "function") {
      save();
    }
    if (typeof setLiveSeq === "function") setLiveSeq(serverSeq);
  } finally {
    _cloudSaveApplying = false;
  }
  if (typeof ProgressStore !== "undefined" && typeof ProgressStore.sync === "function") {
    ProgressStore.sync();
  }
}

/** Подтянуть актуальный сейв с сервера после перехвата lease. */
async function pullLatestCloudSave(opts) {
  opts = opts || {};
  try {
    const remote = await fetchCloudSave();
    if (!remote.ok) return { ok: false, error: remote.error || "Не удалось получить сейв" };
    if (remote.empty) return { ok: true, empty: true };
    const localSeq = typeof maxStoredSeq === "function" ? maxStoredSeq() : 0;
    if ((remote.seq || 0) > localSeq) {
      applyCloudSaveData(remote.data, remote.seq, remote.savedAt);
      if (opts.notify && typeof toast === "function") {
        toast("Прогресс обновлён с сервера", "success");
      }
      return { ok: true, applied: true, seq: remote.seq };
    }
    return { ok: true, applied: false, seq: remote.seq };
  } catch (e) {
    return { ok: false, error: "Ошибка синхронизации" };
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
    offerReadOnly: opts.offerReadOnly !== false,
  });
  if (!lease.ok) {
    if (lease.readOnly) {
      return { ok: true, readOnly: true, locked: true, summary: remote.summary };
    }
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
    if (document.visibilityState === "hidden") {
      flushCloudSave();
      return;
    }
    if (_cloudWriteLocked) return;
    renewWriteLease().catch(() => {});
  });
  window.addEventListener("pagehide", () => {
    flushCloudSave();
  });
  window.addEventListener("focus", () => {
    if (_cloudWriteLocked || !readCloudAuth()?.token) return;
    renewWriteLease().catch(() => {});
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
  gameplayAllowed: cloudGameplayAllowed,
  writeLocked: cloudWriteLocked,
  acquireLease: acquireWriteLease,
  getDeviceId: getCloudDeviceId,
  pushSave: pushCloudSave,
  flushSave: flushCloudSave,
  scheduleSave: scheduleCloudSave,
};
