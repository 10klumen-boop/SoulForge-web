const LOG_MAX_LINES = 200;
const LOG_COLLAPSE_KEY = "sf-log-collapsed";

const LOG_FILTER_GROUPS = [
  { id: "enchant", label: "Заточка", kinds: ["enchant", "success", "fail"] },
  { id: "economy", label: "Деньги", kinds: ["gold", "loot", "craft"] },
  { id: "system", label: "Система", kinds: ["system", "info", "warn"] },
];

const LOG_FILTER_KEY = "sf-log-filters";
let logFilterOn = new Set(LOG_FILTER_GROUPS.map((g) => g.id));
let logUnreadWhileCollapsed = 0;

function logFeedEl() {
  return document.getElementById("gameLogFeed");
}

function logPanelEl() {
  return document.getElementById("gameLogPanel");
}

function isGameLogCollapsed() {
  const panel = logPanelEl();
  return !!(panel && panel.classList.contains("is-collapsed"));
}

function saveLogCollapsed(collapsed) {
  try {
    localStorage.setItem(LOG_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch (_) {}
}

function loadLogCollapsed() {
  try {
    const raw = localStorage.getItem(LOG_COLLAPSE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch (_) {}
  return true; // по умолчанию свёрнут — больше места игре
}

function updateLogBadge() {
  const badge = document.getElementById("gameLogBadge");
  if (!badge) return;
  if (!isGameLogCollapsed() || logUnreadWhileCollapsed <= 0) {
    badge.hidden = true;
    badge.textContent = "0";
    return;
  }
  badge.hidden = false;
  badge.textContent = logUnreadWhileCollapsed > 99 ? "99+" : String(logUnreadWhileCollapsed);
}

function setGameLogCollapsed(collapsed) {
  const panel = logPanelEl();
  const toggle = document.getElementById("gameLogToggle");
  if (!panel) return;
  panel.classList.toggle("is-collapsed", !!collapsed);
  if (toggle) toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  saveLogCollapsed(!!collapsed);
  if (!collapsed) {
    logUnreadWhileCollapsed = 0;
    updateLogBadge();
    const feed = logFeedEl();
    if (feed) feed.scrollTop = feed.scrollHeight;
  }
}

function toggleGameLog() {
  setGameLogCollapsed(!isGameLogCollapsed());
}

function logKindGroup(kind) {
  const k = kind || "info";
  for (const g of LOG_FILTER_GROUPS) {
    if (g.kinds.includes(k)) return g.id;
  }
  return "system";
}

function isLogKindVisible(kind) {
  return logFilterOn.has(logKindGroup(kind));
}

function saveLogFilters() {
  if (window.soulforgeDesktop?.isDesktop) return;
  try {
    localStorage.setItem(LOG_FILTER_KEY, JSON.stringify([...logFilterOn]));
  } catch (_) {}
}

function loadLogFilters() {
  if (window.soulforgeDesktop?.isDesktop) return;
  try {
    const raw = localStorage.getItem(LOG_FILTER_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return;
    const valid = ids.filter((id) => LOG_FILTER_GROUPS.some((g) => g.id === id));
    if (valid.length) logFilterOn = new Set(valid);
  } catch (_) {}
}

function applyLogFilters() {
  const feed = logFeedEl();
  if (!feed) return;
  feed.querySelectorAll(".log-line").forEach((line) => {
    const kind = line.dataset.kind || "info";
    line.classList.toggle("log-hidden", !isLogKindVisible(kind));
  });
}

function toggleLogFilter(id) {
  if (logFilterOn.has(id)) {
    if (logFilterOn.size <= 1) return;
    logFilterOn.delete(id);
  } else {
    logFilterOn.add(id);
  }
  saveLogFilters();
  syncLogFilterUi();
  applyLogFilters();
}

function syncLogFilterUi() {
  const bar = document.getElementById("gameLogFilters");
  if (!bar) return;
  bar.querySelectorAll(".log-filter").forEach((btn) => {
    btn.classList.toggle("on", logFilterOn.has(btn.dataset.filter));
  });
}

function buildLogFilters() {
  const bar = document.getElementById("gameLogFilters");
  if (!bar || bar.dataset.wired) return;
  bar.dataset.wired = "1";
  LOG_FILTER_GROUPS.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "log-filter on";
    btn.dataset.filter = g.id;
    btn.textContent = g.label;
    btn.title = g.label;
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      toggleLogFilter(g.id);
    };
    bar.appendChild(btn);
  });
  syncLogFilterUi();
}

function formatLogTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function gameLog(msg, kind) {
  const feed = logFeedEl();
  if (!feed || !msg) return;
  const k = kind || "info";
  const line = document.createElement("div");
  line.className = "log-line kind-" + k;
  line.dataset.kind = k;
  if (!isLogKindVisible(k)) line.classList.add("log-hidden");
  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatLogTime(new Date());
  const text = document.createElement("span");
  text.className = "log-text";
  text.textContent = String(msg);
  line.appendChild(time);
  line.appendChild(text);
  feed.appendChild(line);
  while (feed.children.length > LOG_MAX_LINES) feed.firstChild.remove();
  feed.scrollTop = feed.scrollHeight;
  if (isGameLogCollapsed() && isLogKindVisible(k)) {
    logUnreadWhileCollapsed++;
    updateLogBadge();
  }
}

function clearGameLog() {
  const feed = logFeedEl();
  if (feed) feed.innerHTML = "";
  gameLog("Журнал очищен.", "system");
}

function initGameLog() {
  loadLogFilters();
  buildLogFilters();
  setGameLogCollapsed(loadLogCollapsed());

  const clr = document.getElementById("gameLogClear");
  if (clr) {
    clr.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      const feed = logFeedEl();
      if (feed) feed.innerHTML = "";
      gameLog("Журнал очищен.", "system");
    };
  }
  const toggle = document.getElementById("gameLogToggle");
  if (toggle && !toggle.dataset.wired) {
    toggle.dataset.wired = "1";
    toggle.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setGameLogCollapsed(false);
    };
  }
  const collapse = document.getElementById("gameLogCollapse");
  if (collapse && !collapse.dataset.wired) {
    collapse.dataset.wired = "1";
    collapse.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setGameLogCollapsed(true);
    };
  }
  if (!document.body.dataset.logHotkey) {
    document.body.dataset.logHotkey = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key !== "l" && e.key !== "L") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      e.preventDefault();
      if (typeof Audio2 !== "undefined") Audio2.click();
      toggleGameLog();
    });
  }

  gameLog("Журнал открыт. Prelude: задание → заточка → adena.", "system");
  gameLog("Лови цели на поле — копи adena для свитков.", "info");
  gameLog("Подсказка: L — свернуть/открыть журнал.", "system");
}
