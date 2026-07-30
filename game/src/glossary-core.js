// ===== Глоссарий: индекс, поиск, linkify HTML =====

const GLOSSARY_SKIP_OPEN = /^(a|button|code|script|style|pre|textarea)$/i;

let _glossaryById = null;
let _glossaryAliasList = null; // [{ alias, id, len, latin }] sorted longest-first

function glossaryNormalizeKey(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

function glossaryIsLatinHeavy(s) {
  const t = String(s || "");
  const letters = t.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
  if (!letters) return false;
  const latin = (letters.match(/[A-Za-z]/g) || []).length;
  return latin / letters.length >= 0.5;
}

function glossaryBuildIndex() {
  const entries = typeof GLOSSARY_ENTRIES !== "undefined" ? GLOSSARY_ENTRIES : [];
  _glossaryById = Object.create(null);
  const aliasMap = Object.create(null);
  entries.forEach((e) => {
    if (!e || !e.id) return;
    _glossaryById[e.id] = e;
    const aliases = Array.isArray(e.aliases) ? e.aliases.slice() : [];
    if (e.title && !aliases.includes(e.title)) aliases.unshift(e.title);
    aliases.forEach((raw) => {
      const alias = glossaryNormalizeKey(raw);
      if (!alias) return;
      const latin = glossaryIsLatinHeavy(alias);
      const key = latin ? alias.toLowerCase() : alias;
      const prev = aliasMap[key];
      if (!prev || alias.length > prev.alias.length) {
        aliasMap[key] = { alias, id: e.id, len: alias.length, latin };
      }
    });
  });
  _glossaryAliasList = Object.keys(aliasMap)
    .map((k) => aliasMap[k])
    .sort((a, b) => b.len - a.len || a.alias.localeCompare(b.alias, "ru"));
}

function glossaryEnsureIndex() {
  if (!_glossaryById || !_glossaryAliasList) glossaryBuildIndex();
}

function glossaryGet(id) {
  glossaryEnsureIndex();
  return _glossaryById[id] || null;
}

function glossaryAll() {
  glossaryEnsureIndex();
  const entries = typeof GLOSSARY_ENTRIES !== "undefined" ? GLOSSARY_ENTRIES : [];
  return entries.slice().sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));
}

function glossaryCategoryLabel(cat) {
  const map = typeof GLOSSARY_CATEGORIES !== "undefined" ? GLOSSARY_CATEGORIES : {};
  return map[cat] || cat || "";
}

function glossarySearch(q) {
  const needle = glossaryNormalizeKey(q).toLowerCase();
  const all = glossaryAll();
  if (!needle) return all;
  return all.filter((e) => {
    const blob = [e.title, e.short, e.id, ...(e.aliases || [])].join(" ").toLowerCase();
    return blob.includes(needle);
  });
}

function glossaryEscAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function glossaryEscText(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function glossaryCharBoundaryOk(text, start, end) {
  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";
  const wordish = /[0-9A-Za-zА-Яа-яЁё_+]/;
  if (before && wordish.test(before)) return false;
  if (after && wordish.test(after)) return false;
  return true;
}

function glossaryFindMatch(text, from) {
  glossaryEnsureIndex();
  let best = null;
  for (let i = 0; i < _glossaryAliasList.length; i++) {
    const item = _glossaryAliasList[i];
    const hay = text.slice(from);
    let idx = -1;
    if (item.latin) idx = hay.toLowerCase().indexOf(item.alias.toLowerCase());
    else idx = hay.indexOf(item.alias);
    if (idx < 0) continue;
    const abs = from + idx;
    const end = abs + item.len;
    if (!glossaryCharBoundaryOk(text, abs, end)) continue;
    if (
      !best ||
      abs < best.start ||
      (abs === best.start && item.len > best.len)
    ) {
      best = { start: abs, end, id: item.id, len: item.len };
    }
  }
  return best;
}

function glossaryLinkifyPlainText(text) {
  if (!text) return "";
  glossaryEnsureIndex();
  let out = "";
  let i = 0;
  while (i < text.length) {
    const m = glossaryFindMatch(text, i);
    if (!m) {
      out += glossaryEscText(text.slice(i));
      break;
    }
    if (m.start > i) out += glossaryEscText(text.slice(i, m.start));
    const raw = text.slice(m.start, m.end);
    out +=
      '<button type="button" class="glossary-term" data-glossary="' +
      glossaryEscAttr(m.id) +
      '">' +
      glossaryEscText(raw) +
      "</button>";
    i = m.end;
  }
  return out;
}

/**
 * Linkify glossary terms inside an HTML string. Preserves existing tags.
 * Skips text inside a / button / code / script / style / pre and existing .glossary-term.
 * @param {string} html
 * @returns {string}
 */
function glossaryLinkifyHtml(html) {
  if (html == null || html === "") return html == null ? "" : html;
  let s = String(html);
  // Unwrap previous glossary buttons so re-linkify is idempotent
  s = s.replace(/<button\b[^>]*\bglossary-term\b[^>]*>([\s\S]*?)<\/button>/gi, "$1");

  const skipOpen = GLOSSARY_SKIP_OPEN;
  let out = "";
  let i = 0;
  const stack = [];
  while (i < s.length) {
    if (s[i] === "<") {
      const end = s.indexOf(">", i);
      if (end < 0) {
        out += s.slice(i);
        break;
      }
      const tag = s.slice(i, end + 1);
      out += tag;
      const m = /^<\/?\s*([a-zA-Z0-9:-]+)/.exec(tag);
      if (m) {
        const name = m[1];
        if (tag[1] === "/") {
          for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k] === name.toLowerCase()) {
              stack.splice(k, 1);
              break;
            }
          }
        } else if (!/\/>$/.test(tag) && skipOpen.test(name)) {
          stack.push(name.toLowerCase());
        }
      }
      i = end + 1;
      continue;
    }
    let j = s.indexOf("<", i);
    if (j < 0) j = s.length;
    const text = s.slice(i, j);
    const skipping = stack.some((t) => skipOpen.test(t));
    out += skipping ? text : glossaryLinkifyPlainText(text);
    i = j;
  }
  return out;
}

/** Escape plain text then linkify (for former textContent fields). */
function glossaryLinkifyText(text) {
  return glossaryLinkifyPlainText(String(text == null ? "" : text));
}

// Rebuild if data hot-swapped in tests
function glossaryResetIndex() {
  _glossaryById = null;
  _glossaryAliasList = null;
}

/**
 * Apply server/editor payload onto bundled GLOSSARY_* arrays (mutate in place).
 * @param {{ categories?: object, entries?: object[] }} data
 * @returns {boolean}
 */
function applyGlossaryPayload(data) {
  if (!data || !Array.isArray(data.entries)) return false;
  if (typeof GLOSSARY_ENTRIES !== "undefined" && Array.isArray(GLOSSARY_ENTRIES)) {
    GLOSSARY_ENTRIES.length = 0;
    for (let i = 0; i < data.entries.length; i++) {
      GLOSSARY_ENTRIES.push(data.entries[i]);
    }
  } else if (typeof window !== "undefined") {
    window.GLOSSARY_ENTRIES = data.entries.slice();
  } else {
    return false;
  }
  if (data.categories && typeof data.categories === "object") {
    if (typeof GLOSSARY_CATEGORIES !== "undefined" && GLOSSARY_CATEGORIES && typeof GLOSSARY_CATEGORIES === "object") {
      Object.keys(GLOSSARY_CATEGORIES).forEach((k) => {
        delete GLOSSARY_CATEGORIES[k];
      });
      Object.assign(GLOSSARY_CATEGORIES, data.categories);
    } else if (typeof window !== "undefined") {
      window.GLOSSARY_CATEGORIES = Object.assign({}, data.categories);
    }
  }
  glossaryResetIndex();
  return true;
}

/**
 * Fetch live glossary from server; keep bundled data on failure.
 * @returns {Promise<{ ok: boolean, count?: number, updatedAt?: string|null, offline?: boolean, status?: number }>}
 */
async function loadGlossaryFromServer() {
  let url = "/glossary";
  try {
    if (typeof cloudApiUrl === "function") url = cloudApiUrl("/glossary");
  } catch (_) {}
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.entries)) return { ok: false, status: res.status };
    if (!applyGlossaryPayload(data)) return { ok: false };
    if (typeof renderGlossaryScreen === "function") {
      try {
        const screen = document.getElementById("screen-glossary");
        if (screen && screen.classList.contains("active")) renderGlossaryScreen();
      } catch (_) {}
    }
    if (typeof renderMenu === "function") {
      try { renderMenu(); } catch (_) {}
    }
    return {
      ok: true,
      count: data.entries.length,
      updatedAt: data.updatedAt || null,
    };
  } catch (e) {
    return { ok: false, offline: true };
  }
}

if (typeof window !== "undefined") {
  window.applyGlossaryPayload = applyGlossaryPayload;
  window.loadGlossaryFromServer = loadGlossaryFromServer;
  window.glossaryResetIndex = window.glossaryResetIndex || glossaryResetIndex;
}

