// ===== Cloud: аккаунт (ник/пароль) + рейтинги =====
const CLOUD_AUTH_KEY = "soulforge_cloud_auth";
const PLAYER_ID_KEY = "soulforge_player_id";
const CLOUD_PENDING_KEY = "soulforge_cloud_pending";
const CLIENT_VERSION = typeof GAME_VERSION !== "undefined" ? GAME_VERSION : "0.31a-r";
const CLOUD_SUBMIT_MIN_MS = 45_000;

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
      const isHttpsProd = location.protocol === "https:" && !isLocalHost && !isStaticPages;
      const isLocalApi = (location.protocol === "http:" || location.protocol === "https:") && (port === "8787" || /soulforge/i.test(host));
      if (isHttpsProd || isLocalApi) {
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
    event,
    seq,
    savedAt,
    clientVersion: CLIENT_VERSION,
    adena: data.adena,
    earned: data.totals?.earned || 0,
    maxPlus: computeMaxPlus(data.records),
    farmPower: typeof avatarFarmPower === "function" ? avatarFarmPower() : 0,
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

async function cloudRegister(nick, password) {
  const r = await cloudAuthRequest("/auth/register", { nick, password });
  if (r.ok && r.token) {
    writeCloudAuth({ nick: r.nick, token: r.token, exp: r.exp });
    syncCloudUI();
    noteLeaderboardEvent("login");
  }
  return r;
}

async function cloudLogin(nick, password) {
  const r = await cloudAuthRequest("/auth/login", { nick, password });
  if (r.ok && r.token) {
    writeCloudAuth({ nick: r.nick, token: r.token, exp: r.exp });
    syncCloudUI();
    noteLeaderboardEvent("login");
  }
  return r;
}

async function cloudLogout() {
  const auth = readCloudAuth();
  if (cloudEnabled() && auth?.token) {
    try {
      await fetch(cloudApiUrl("/auth/logout"), {
        method: "POST",
        headers: authHeaders(true),
        body: "{}",
      });
    } catch (e) {}
  }
  writeCloudAuth(null);
  syncCloudUI();
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
      if (res.status === 401) writeCloudAuth(null);
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

async function flushPendingSubmissions() {
  if (!cloudEnabled() || !readCloudAuth()?.token) return { flushed: 0 };
  const pending = readPendingSubmissions();
  if (!pending.length) return { flushed: 0 };
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
        ? "Офлайн · " + pending + " событий в очереди"
        : "Онлайн-рейтинги: сервер не подключён";
    } else if (auth?.nick) {
      hint.textContent = pending
        ? "В сети как " + auth.nick + " · в очереди " + pending
        : "В сети как " + auth.nick + " · рейтинги активны";
    } else {
      hint.textContent = "Сервер доступен · войдите, чтобы участвовать в рейтинге";
    }
  }
  const nickInput = document.getElementById("cloudNick");
  const statusEl = document.getElementById("cloudAuthStatus");
  if (statusEl) {
    statusEl.textContent = auth?.nick ? ("Вы вошли: " + auth.nick) : "Гость (без рейтинга)";
  }
  const loginBtn = document.getElementById("cloudLoginBtn");
  const regBtn = document.getElementById("cloudRegisterBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");
  if (loginBtn) loginBtn.hidden = !!auth;
  if (regBtn) regBtn.hidden = !!auth;
  if (logoutBtn) logoutBtn.hidden = !auth;
  if (nickInput && auth?.nick) nickInput.value = auth.nick;
  const tile = document.getElementById("lbTileMeta");
  if (tile) tile.textContent = auth?.nick || (cloudEnabled() ? "Войти" : "Офлайн");
  const homeSub = document.getElementById("homeRatingSub");
  if (homeSub) {
    homeSub.textContent = auth?.nick
      ? ("В сети · " + auth.nick)
      : (cloudEnabled() ? "Сервер доступен · войди в настройках" : "Заточка · сила · богатство");
  }
}

function noteLeaderboardEvent(event, extra, opts) {
  submitLeaderboardEvent(event, extra, opts);
}

function formatLbValue(mode, row) {
  const v = row.value != null ? row.value : 0;
  if (mode === "enchant") return "+" + v;
  if (mode === "wealth") return typeof fmtAdena === "function" ? fmtAdena(v) : String(v);
  return typeof fmt === "function" ? fmt(v) : String(v);
}

async function renderLeaderboard() {
  const list = document.getElementById("lbList");
  const status = document.getElementById("lbStatus");
  if (!list) return;
  list.innerHTML = "";
  if (status) {
    if (!cloudEnabled()) status.textContent = "Сервер не подключён. Запустите server/ или укажите SOULFORGE_CLOUD.";
    else if (!readCloudAuth()) status.textContent = "Можно смотреть таблицу гостем. Войдите в настройках, чтобы попасть в рейтинг.";
    else status.textContent = "Режим: " + ({ enchant: "Заточка", power: "Сила", wealth: "Богатство" }[_lbMode] || _lbMode);
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
    empty.textContent = "Пока пусто — сыграй и отправь прогресс.";
    list.appendChild(empty);
    return;
  }
  const me = getCloudNick();
  res.rows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "lb-row" + (me && row.name === me ? " me" : "");
    el.innerHTML =
      '<span class="lb-rank">' + row.rank + "</span>" +
      '<span class="lb-name"></span>' +
      '<span class="lb-val"></span>';
    el.querySelector(".lb-name").textContent = row.name || "—";
    el.querySelector(".lb-val").textContent = formatLbValue(_lbMode, row);
    list.appendChild(el);
  });
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
  renderLeaderboard();
  show("leaderboard");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
}

async function wireCloudAuthForms() {
  const loginBtn = document.getElementById("cloudLoginBtn");
  const regBtn = document.getElementById("cloudRegisterBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");
  const nickEl = document.getElementById("cloudNick");
  const passEl = document.getElementById("cloudPass");
  const msgEl = document.getElementById("cloudAuthMsg");
  const setMsg = (t, warn) => {
    if (!msgEl) return;
    msgEl.textContent = t || "";
    msgEl.classList.toggle("warn", !!warn);
  };
  if (loginBtn) {
    loginBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      const nick = (nickEl?.value || "").trim();
      const password = passEl?.value || "";
      setMsg("Вход…");
      const r = await cloudLogin(nick, password);
      if (r.ok) {
        setMsg("Добро пожаловать, " + r.nick);
        if (passEl) passEl.value = "";
        flushPendingSubmissions();
      } else setMsg(r.error || "Ошибка входа", true);
    };
  }
  if (regBtn) {
    regBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      const nick = (nickEl?.value || "").trim();
      const password = passEl?.value || "";
      setMsg("Регистрация…");
      const r = await cloudRegister(nick, password);
      if (r.ok) {
        setMsg("Аккаунт создан: " + r.nick);
        if (passEl) passEl.value = "";
        flushPendingSubmissions();
      } else setMsg(r.error || "Ошибка регистрации", true);
    };
  }
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      await cloudLogout();
      setMsg("Вы вышли");
    };
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
    refreshBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      noteLeaderboardEvent("snapshot", null, { force: true });
      renderLeaderboard();
    };
  }
}

function initCloud() {
  syncCloudUI();
  wireCloudAuthForms();
  if (cloudEnabled()) flushPendingSubmissions();
}

window.SoulforgeCloud = {
  config: CLOUD_CONFIG,
  getPlayerId,
  getNick: getCloudNick,
  register: cloudRegister,
  login: cloudLogin,
  logout: cloudLogout,
  submit: submitLeaderboardEvent,
  fetchLeaderboard,
  flushPending: flushPendingSubmissions,
  pending: readPendingSubmissions,
};
