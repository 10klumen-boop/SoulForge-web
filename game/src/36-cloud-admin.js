// ===== Админ: SQLite на сервере (ключ SOULFORGE_ADMIN_KEY) =====
const CLOUD_ADMIN_KEY = "soulforge_admin_key";

function readAdminKey() {
  try {
    return sessionStorage.getItem(CLOUD_ADMIN_KEY) || "";
  } catch (e) {
    return "";
  }
}

function writeAdminKey(key) {
  try {
    if (!key) sessionStorage.removeItem(CLOUD_ADMIN_KEY);
    else sessionStorage.setItem(CLOUD_ADMIN_KEY, key);
  } catch (e) {}
}

function cloudAdminHeaders(json) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const key = readAdminKey();
  if (key) h["X-Soulforge-Admin"] = key;
  return h;
}

async function cloudAdminFetch(path, opts) {
  opts = opts || {};
  if (!cloudEnabled()) return { ok: false, offline: true, error: "Сервер не подключён" };
  try {
    const res = await fetch(cloudApiUrl(path), {
      method: opts.method || "GET",
      headers: cloudAdminHeaders(opts.json),
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error || "Ошибка" };
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, offline: true, error: "Нет связи с сервером" };
  }
}

let _adminEnabled = null;

async function refreshCloudAdminAvailability() {
  if (!cloudEnabled()) {
    _adminEnabled = false;
    syncCloudAdminNav();
    return false;
  }
  const r = await cloudAdminFetch("/admin/enabled");
  _adminEnabled = !!(r.ok && r.enabled);
  syncCloudAdminNav();
  return _adminEnabled;
}

function cloudAdminAvailable() {
  return !!(_adminEnabled && cloudEnabled());
}

function syncCloudAdminNav() {
  const show = cloudAdminAvailable();
  ["loginAdminBtn", "settCloudAdmin", "cloudAdminBlock"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "cloudAdminBlock") el.hidden = !show;
    else el.hidden = !show;
  });
}

function openCloudAdminScreen(from) {
  if (typeof Audio2 !== "undefined") Audio2.click();
  _cloudAdminBackTo = from || "home";
  const back = document.getElementById("cloudAdminBack");
  if (back) {
    back.dataset.to = _cloudAdminBackTo;
    back.textContent = _cloudAdminBackTo === "login" ? "← Вход" : "← Главное меню";
  }
  show("cloud-admin");
  renderCloudAdmin();
}

let _cloudAdminBackTo = "home";
let _adminUsers = [];

function fmtAdminTs(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch (e) {
    return String(ts);
  }
}

function escAdmin(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

async function renderCloudAdmin() {
  const gate = document.getElementById("cloudAdminGate");
  const panel = document.getElementById("cloudAdminPanel");
  const statsEl = document.getElementById("cloudAdminStats");
  const tableEl = document.getElementById("cloudAdminTable");
  const msgEl = document.getElementById("cloudAdminGateMsg");
  if (!gate || !panel) return;

  if (!cloudAdminAvailable()) {
    gate.hidden = false;
    panel.hidden = true;
    if (msgEl) msgEl.textContent = cloudEnabled() ? "Админ-панель отключена на сервере" : "Нет связи с сервером";
    return;
  }

  const key = readAdminKey();
  if (!key) {
    gate.hidden = false;
    panel.hidden = true;
    if (msgEl) msgEl.textContent = "";
    const keyInput = document.getElementById("cloudAdminKey");
    if (keyInput && !keyInput.value) keyInput.focus();
    return;
  }

  gate.hidden = true;
  panel.hidden = false;

  const q = (document.getElementById("cloudAdminSearch")?.value || "").trim();
  const overview = await cloudAdminFetch("/admin/overview");
  if (statsEl && overview.ok) {
    statsEl.textContent =
      "Пользователей: " + overview.users +
      " · Активных сессий: " + overview.sessions +
      " · Записей рейтинга: " + overview.scores +
      " · " + (overview.db || "soulforge.db");
  }

  const list = await cloudAdminFetch("/admin/users" + (q ? "?q=" + encodeURIComponent(q) : ""));
  if (!list.ok) {
    if (list.status === 401) {
      writeAdminKey("");
      if (msgEl) msgEl.textContent = list.error || "Неверный ключ";
      gate.hidden = false;
      panel.hidden = true;
      return;
    }
    if (tableEl) tableEl.innerHTML = '<p class="cloud-admin-msg warn">' + escAdmin(list.error || "Ошибка загрузки") + "</p>";
    return;
  }

  _adminUsers = list.rows || [];
  if (!tableEl) return;
  if (!_adminUsers.length) {
    tableEl.innerHTML = '<p class="cloud-admin-msg">Нет пользователей</p>';
    return;
  }

  let html =
    '<table class="cloud-admin-table"><thead><tr>' +
    "<th>ID</th><th>Ник</th><th>+</th><th>Сила</th><th>Adena</th><th>Заработано</th><th>Сессии</th><th></th>" +
    "</tr></thead><tbody>";
  _adminUsers.forEach((u) => {
    html +=
      '<tr data-admin-user="' + u.id + '">' +
      "<td>" + u.id + "</td>" +
      "<td><strong>" + escAdmin(u.nick) + "</strong><br><small>" + fmtAdminTs(u.created_at) + "</small></td>" +
      '<td><input type="number" class="cloud-admin-inp" data-f="max_plus" min="0" value="' + (u.max_plus || 0) + '"></td>' +
      '<td><input type="number" class="cloud-admin-inp" data-f="farm_power" min="0" value="' + (u.farm_power || 0) + '"></td>' +
      '<td><input type="number" class="cloud-admin-inp" data-f="adena" min="0" value="' + (u.adena || 0) + '"></td>' +
      '<td><input type="number" class="cloud-admin-inp" data-f="earned" min="0" value="' + (u.earned || 0) + '"></td>' +
      "<td>" + (u.sessions || 0) + "</td>" +
      '<td class="cloud-admin-actions">' +
      '<button type="button" class="cloud-admin-btn" data-act="save">Сохранить</button>' +
      '<button type="button" class="cloud-admin-btn cloud-admin-btn-warn" data-act="delete">Удалить</button>' +
      "</td></tr>";
  });
  html += "</tbody></table>";
  tableEl.innerHTML = html;

  tableEl.querySelectorAll("[data-act]").forEach((btn) => {
    btn.onclick = () => cloudAdminRowAction(btn);
  });
}

async function cloudAdminRowAction(btn) {
  const row = btn.closest("tr[data-admin-user]");
  if (!row) return;
  const userId = Number(row.dataset.adminUser);
  const act = btn.dataset.act;
  if (typeof Audio2 !== "undefined") Audio2.click();

  if (act === "save") {
    const body = {};
    row.querySelectorAll(".cloud-admin-inp").forEach((inp) => {
      body[inp.dataset.f] = Number(inp.value) || 0;
    });
    btn.disabled = true;
    const r = await cloudAdminFetch("/admin/users/" + userId + "/score", { method: "PUT", json: true, body });
    btn.disabled = false;
    if (r.ok) {
      if (typeof toast === "function") toast("Сохранено: " + (r.score?.user_id || userId), "system");
      renderCloudAdmin();
    } else if (typeof toast === "function") toast(r.error || "Ошибка", "warn");
    return;
  }

  if (act === "delete") {
    const nick = row.querySelector("strong")?.textContent || String(userId);
    if (typeof showConfirm === "function") {
      const ok = await showConfirm({
        title: "Удалить аккаунт",
        message: "Удалить «" + nick + "» и все сессии/рейтинг?\nНеобратимо.",
        okText: "Удалить",
        danger: true,
      });
      if (!ok) return;
    }
    btn.disabled = true;
    const r = await cloudAdminFetch("/admin/users/" + userId, { method: "DELETE" });
    btn.disabled = false;
    if (r.ok) {
      if (typeof toast === "function") toast("Удалён: " + (r.nick || nick), "warn");
      renderCloudAdmin();
    } else if (typeof toast === "function") toast(r.error || "Ошибка", "warn");
  }
}

function wireCloudAdmin() {
  const unlock = document.getElementById("cloudAdminUnlock");
  const keyEl = document.getElementById("cloudAdminKey");
  const logout = document.getElementById("cloudAdminLogout");
  const refresh = document.getElementById("cloudAdminRefresh");
  const search = document.getElementById("cloudAdminSearch");
  const purge = document.getElementById("cloudAdminPurgeSessions");

  if (unlock && !unlock.dataset.wired) {
    unlock.dataset.wired = "1";
    unlock.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      writeAdminKey((keyEl?.value || "").trim());
      await renderCloudAdmin();
    };
  }
  if (keyEl && !keyEl.dataset.wired) {
    keyEl.dataset.wired = "1";
    keyEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") unlock?.click();
    });
  }
  if (logout && !logout.dataset.wired) {
    logout.dataset.wired = "1";
    logout.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      writeAdminKey("");
      if (keyEl) keyEl.value = "";
      renderCloudAdmin();
    };
  }
  if (refresh && !refresh.dataset.wired) {
    refresh.dataset.wired = "1";
    refresh.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      renderCloudAdmin();
    };
  }
  if (search && !search.dataset.wired) {
    search.dataset.wired = "1";
    let t = null;
    search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => renderCloudAdmin(), 280);
    });
  }
  if (purge && !purge.dataset.wired) {
    purge.dataset.wired = "1";
    purge.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      const r = await cloudAdminFetch("/admin/maintenance/purge-sessions", { method: "POST", json: true, body: {} });
      if (r.ok && typeof toast === "function") toast("Удалено сессий: " + (r.removed || 0), "system");
      renderCloudAdmin();
    };
  }

  ["loginAdminBtn", "settCloudAdmin"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.onclick = () => openCloudAdminScreen(id === "loginAdminBtn" ? "login" : "home");
  });

  const back = document.getElementById("cloudAdminBack");
  if (back && !back.dataset.wired) {
    back.dataset.wired = "1";
    back.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      show(back.dataset.to || "home");
    };
  }
}

function initCloudAdmin() {
  wireCloudAdmin();
  refreshCloudAdminAvailability();
}
