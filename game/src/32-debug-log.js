// ===== Debug log + выгрузка ошибок =====

const DEBUG_LOG_MAX = 100;
const debugEntries = [];
let debugVerboseMine = false;

function debugNow() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function debugEscapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debugLog(level, tag, message, detail) {
  const entry = {
    at: debugNow(),
    level: level || "info",
    tag: tag || "app",
    message: String(message || ""),
    detail: detail == null ? "" : (typeof detail === "string" ? detail : JSON.stringify(detail)),
  };
  debugEntries.push(entry);
  if (debugEntries.length > DEBUG_LOG_MAX) debugEntries.shift();
  if (level === "error") console.error("[SF]", tag, message, detail || "");
  else if (level === "warn" || debugVerboseMine) console.log("[SF]", tag, message, detail || "");
  renderDebugLogPanel();
}

function captureRuntimeError(kind, msg, source, line, col, err) {
  const where = source ? " @ " + source + ":" + line + ":" + col : "";
  debugLog("error", kind, String(msg || "Unknown error") + where, err?.stack || "");
}

function debugReportText() {
  const lines = [
    "SoulForge debug report",
    debugNow(),
    "UA: " + navigator.userAgent,
    "URL: " + location.href,
  ];
  if (typeof state !== "undefined") {
    lines.push("Avatar: " + (state.avatar?.created ? state.avatar.name + " (" + state.avatar.raceId + ")" : "—"));
    lines.push("Zone: " + (state.farmZone || "—"));
    lines.push("Adena: " + (state.adena ?? "—"));
  }
  const screen = document.querySelector(".screen.active");
  lines.push("Screen: " + (screen?.id || "—"));
  if (typeof mineActive !== "undefined") {
    lines.push("Mine: active=" + mineActive + ", overlayPaused=" + (typeof mineOverlayPaused !== "undefined" ? mineOverlayPaused : "—"));
  }
  lines.push("", "--- log (" + debugEntries.length + ") ---");
  debugEntries.forEach((e) => {
    lines.push("[" + e.at + "] " + e.level.toUpperCase() + " " + e.tag + ": " + e.message);
    if (e.detail) lines.push("  " + e.detail);
  });
  return lines.join("\n");
}

async function copyDebugReport() {
  const text = debugReportText();
  try {
    await navigator.clipboard.writeText(text);
    if (typeof toast === "function") toast("Отчёт скопирован в буфер", "system");
  } catch (e) {
    downloadDebugReport();
  }
}

function downloadDebugReport() {
  const text = debugReportText();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "soulforge-debug-" + Date.now() + ".txt";
  a.click();
  URL.revokeObjectURL(a.href);
  if (typeof toast === "function") toast("Отчёт сохранён в файл", "system");
}

function renderDebugLogPanel() {
  const feed = document.getElementById("devDebugFeed");
  if (!feed) return;
  const badge = document.getElementById("devDebugCount");
  const errN = debugEntries.filter((e) => e.level === "error").length;
  if (badge) badge.textContent = debugEntries.length + (errN ? " · " + errN + " err" : "");
  if (!debugEntries.length) {
    feed.innerHTML = '<div class="dev-debug-empty">Ошибки и dev-события появятся здесь.</div>';
    return;
  }
  feed.innerHTML = debugEntries
    .slice()
    .reverse()
    .map(
      (e) =>
        '<div class="dev-debug-row ' + e.level + '">' +
        '<span class="dev-debug-time">' + e.at.slice(11) + "</span>" +
        '<span class="dev-debug-tag">' + debugEscapeHtml(e.tag) + "</span>" +
        '<span class="dev-debug-msg">' + debugEscapeHtml(e.message) + "</span>" +
        (e.detail ? '<pre class="dev-debug-detail">' + debugEscapeHtml(e.detail) + "</pre>" : "") +
        "</div>"
    )
    .join("");
}

function wireDebugLog() {
  window.addEventListener("error", (e) => {
    captureRuntimeError("error", e.message, e.filename, e.lineno, e.colno, e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    captureRuntimeError("promise", r?.message || String(r), "", "", "", r instanceof Error ? r : null);
  });

  const copyBtn = document.getElementById("devDebugCopy");
  const dlBtn = document.getElementById("devDebugDownload");
  const clearBtn = document.getElementById("devDebugClear");
  const verboseBtn = document.getElementById("devDebugVerboseMine");
  const settCopy = document.getElementById("settErrorReport");

  if (copyBtn && !copyBtn.dataset.wired) {
    copyBtn.dataset.wired = "1";
    copyBtn.onclick = () => { if (typeof Audio2 !== "undefined") Audio2.click(); copyDebugReport(); };
  }
  if (dlBtn && !dlBtn.dataset.wired) {
    dlBtn.dataset.wired = "1";
    dlBtn.onclick = () => { if (typeof Audio2 !== "undefined") Audio2.click(); downloadDebugReport(); };
  }
  if (clearBtn && !clearBtn.dataset.wired) {
    clearBtn.dataset.wired = "1";
    clearBtn.onclick = () => {
      debugEntries.length = 0;
      renderDebugLogPanel();
      if (typeof Audio2 !== "undefined") Audio2.click();
      if (typeof toast === "function") toast("Лог очищен", "system");
    };
  }
  if (verboseBtn && !verboseBtn.dataset.wired) {
    verboseBtn.dataset.wired = "1";
    verboseBtn.onclick = () => {
      debugVerboseMine = !debugVerboseMine;
      verboseBtn.classList.toggle("on", debugVerboseMine);
      verboseBtn.textContent = debugVerboseMine ? "Шахта: вкл" : "Шахта: выкл";
      if (typeof Audio2 !== "undefined") Audio2.click();
    };
  }
  if (settCopy && !settCopy.dataset.wired) {
    settCopy.dataset.wired = "1";
    settCopy.onclick = () => { if (typeof Audio2 !== "undefined") Audio2.click(); copyDebugReport(); };
  }

  debugLog("info", "boot", "Debug log ready");
  renderDebugLogPanel();
}
