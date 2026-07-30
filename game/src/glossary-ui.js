// ===== Глоссарий UI: тултип + экран словаря =====

let _glossaryTipPinned = false;
let _glossaryTipId = null;

const GLOSSARY_FILTER_ORDER = ["all", "lore", "place", "race", "character", "game"];
const GLOSSARY_FILTER_LABELS = {
  all: "Все",
  lore: "Лор",
  place: "Места",
  race: "Народы",
  character: "Персонажи",
  game: "Игра",
};

function glossaryTipIsCoarsePointer() {
  try {
    return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  } catch (_) {
    return false;
  }
}

function ensureGlossaryTipEl() {
  let tip = document.getElementById("glossaryTip");
  if (tip) return tip;
  tip = document.createElement("div");
  tip.id = "glossaryTip";
  tip.className = "glossary-tip item-tip";
  tip.hidden = true;
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  return tip;
}

function hideGlossaryTip() {
  const tip = document.getElementById("glossaryTip");
  if (tip) {
    tip.hidden = true;
    tip.innerHTML = "";
  }
  _glossaryTipPinned = false;
  _glossaryTipId = null;
}

function positionGlossaryTip(tip, anchor) {
  const r = anchor.getBoundingClientRect();
  tip.hidden = false;
  tip.style.left = "0px";
  tip.style.top = "0px";
  const tw = tip.offsetWidth || 280;
  const th = tip.offsetHeight || 120;
  let left = r.right + 10;
  let top = r.top;
  if (left + tw > window.innerWidth - 8) left = r.left - tw - 10;
  if (left < 8) left = Math.max(8, r.left + r.width / 2 - tw / 2);
  if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
  if (top < 8) top = 8;
  tip.style.left = Math.round(left) + "px";
  tip.style.top = Math.round(top) + "px";
}

function glossaryTipHtml(entry) {
  if (!entry) return "";
  const cat = typeof glossaryCategoryLabel === "function" ? glossaryCategoryLabel(entry.category) : entry.category;
  const catClass = entry.category ? " cat-" + entry.category : "";
  const escT = typeof glossaryEscText === "function" ? glossaryEscText : (s) => String(s || "");
  const escA = typeof glossaryEscAttr === "function" ? glossaryEscAttr : (s) => String(s || "");
  return (
    '<div class="glossary-tip-inner">' +
    '<p class="glossary-tip-eyebrow">Словарь SoulForge</p>' +
    '<div class="glossary-tip-head">' +
    '<strong class="glossary-tip-title">' +
    escT(entry.title) +
    "</strong>" +
    (cat ? '<span class="glossary-tip-cat' + catClass + '">' + escT(cat) + "</span>" : "") +
    "</div>" +
    '<p class="glossary-tip-short">' +
    escT(entry.short) +
    "</p>" +
    '<button type="button" class="glossary-tip-open" data-glossary-open="' +
    escA(entry.id) +
    '">Открыть в глоссарии</button>' +
    "</div>"
  );
}

function showGlossaryTipFor(el, opts) {
  opts = opts || {};
  const id = el && el.getAttribute("data-glossary");
  if (!id || typeof glossaryGet !== "function") return;
  const entry = glossaryGet(id);
  if (!entry) return;
  const tip = ensureGlossaryTipEl();
  tip.innerHTML = glossaryTipHtml(entry);
  tip.hidden = false;
  tip.style.pointerEvents = opts.pinned ? "auto" : "none";
  positionGlossaryTip(tip, el);
  _glossaryTipId = id;
  _glossaryTipPinned = !!opts.pinned;
  const openBtn = tip.querySelector("[data-glossary-open]");
  if (openBtn) {
    openBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideGlossaryTip();
      if (typeof openGlossaryScreen === "function") {
        const back = document.querySelector("#screen-glossary .panel-head .back");
        if (back) {
          back.dataset.to = "menu";
          back.textContent = "← В меню";
          back.onclick = () => {
            if (typeof Audio2 !== "undefined") Audio2.click();
            show("menu");
          };
        }
        openGlossaryScreen({ from: "menu", focusId: id });
      }
    };
  }
}

function glossaryTermFromEvent(e) {
  const t = e.target;
  if (!t || !t.closest) return null;
  return t.closest(".glossary-term[data-glossary]");
}

function wireGlossaryTips() {
  if (document.body.dataset.glossaryTipsWired) return;
  document.body.dataset.glossaryTipsWired = "1";

  document.addEventListener(
    "mouseover",
    (e) => {
      if (glossaryTipIsCoarsePointer()) return;
      if (_glossaryTipPinned) return;
      const term = glossaryTermFromEvent(e);
      if (!term) return;
      showGlossaryTipFor(term, { pinned: false });
    },
    true
  );
  document.addEventListener(
    "mouseout",
    (e) => {
      if (glossaryTipIsCoarsePointer()) return;
      if (_glossaryTipPinned) return;
      const term = glossaryTermFromEvent(e);
      if (!term) return;
      const to = e.relatedTarget;
      if (to && term.contains(to)) return;
      hideGlossaryTip();
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      const tip = document.getElementById("glossaryTip");
      if (tip && !tip.hidden && tip.contains(e.target)) return;
      const term = glossaryTermFromEvent(e);
      if (term) {
        e.preventDefault();
        e.stopPropagation();
        if (_glossaryTipPinned && _glossaryTipId === term.getAttribute("data-glossary")) {
          hideGlossaryTip();
          return;
        }
        showGlossaryTipFor(term, { pinned: true });
        return;
      }
      if (_glossaryTipPinned) hideGlossaryTip();
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _glossaryTipPinned) {
      hideGlossaryTip();
      e.stopPropagation();
    }
  });

  document.addEventListener(
    "scroll",
    () => {
      if (_glossaryTipPinned || !document.getElementById("glossaryTip")?.hidden) hideGlossaryTip();
    },
    true
  );
}

// —— Экран глоссария ——

let _glossaryFilterCat = "all";
let _glossaryFocusId = null;

function openGlossaryScreen(opts) {
  opts = opts || {};
  _glossaryFocusId = opts.focusId || null;
  if (typeof Audio2 !== "undefined") Audio2.click();
  const back = document.querySelector("#screen-glossary .panel-head .back");
  if (back && opts.from) {
    if (opts.from === "menu") {
      back.dataset.to = "menu";
      back.textContent = "← В меню";
    } else if (opts.from === "settings") {
      back.dataset.to = "settings";
      back.textContent = "← Настройки";
    }
  }
  if (typeof show === "function") show("glossary");
  renderGlossaryScreen();
  if (_glossaryFocusId) {
    const focusId = _glossaryFocusId;
    _glossaryFocusId = null;
    requestAnimationFrame(() => {
      const el = document.getElementById("glossary-entry-" + focusId);
      if (el) {
        el.classList.add("glossary-card-focus");
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => el.classList.remove("glossary-card-focus"), 1600);
      }
    });
  }
}

function glossaryCardHtml(e) {
  const cat = glossaryCategoryLabel(e.category);
  const focus = _glossaryFocusId === e.id ? " glossary-card-focus" : "";
  const catClass = e.category ? " cat-" + e.category : "";
  const aliases = (e.aliases || [])
    .filter((a) => a && a !== e.title)
    .slice(0, 5);
  const aliasHtml = aliases.length
    ? '<div class="glossary-aliases">' +
      aliases.map((a) => '<span class="glossary-alias">' + glossaryEscText(a) + "</span>").join("") +
      "</div>"
    : "";
  return (
    '<article class="glossary-card' +
    catClass +
    focus +
    '" id="glossary-entry-' +
    glossaryEscAttr(e.id) +
    '">' +
    '<header class="glossary-card-head">' +
    "<h3>" +
    glossaryEscText(e.title) +
    "</h3>" +
    (cat ? '<span class="glossary-card-cat">' + glossaryEscText(cat) + "</span>" : "") +
    "</header>" +
    '<p class="glossary-card-body">' +
    glossaryEscText(e.short) +
    "</p>" +
    aliasHtml +
    "</article>"
  );
}

function renderGlossaryScreen() {
  const list = document.getElementById("glossaryList");
  const search = document.getElementById("glossarySearch");
  const filters = document.getElementById("glossaryFilters");
  const meta = document.getElementById("glossaryHeadMeta");
  if (!list || typeof glossarySearch !== "function") return;

  if (filters && !filters.dataset.wired) {
    filters.dataset.wired = "1";
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-glossary-cat]");
      if (!btn) return;
      _glossaryFilterCat = btn.getAttribute("data-glossary-cat") || "all";
      filters.querySelectorAll("[data-glossary-cat]").forEach((b) => {
        b.classList.toggle("sel", b === btn);
      });
      if (typeof Audio2 !== "undefined") Audio2.click();
      renderGlossaryScreen();
    });
  }
  if (search && !search.dataset.wired) {
    search.dataset.wired = "1";
    search.addEventListener("input", () => renderGlossaryScreen());
  }

  const q = search ? search.value : "";
  const all = typeof glossaryAll === "function" ? glossaryAll() : [];
  let entries = glossarySearch(q);
  if (_glossaryFilterCat && _glossaryFilterCat !== "all") {
    entries = entries.filter((e) => e.category === _glossaryFilterCat);
  }

  // Counts on filter chips (against current search)
  const searched = glossarySearch(q);
  if (filters) {
    filters.querySelectorAll("[data-glossary-cat]").forEach((btn) => {
      const cat = btn.getAttribute("data-glossary-cat") || "all";
      const label = GLOSSARY_FILTER_LABELS[cat] || cat;
      const n = cat === "all" ? searched.length : searched.filter((e) => e.category === cat).length;
      btn.innerHTML = glossaryEscText(label) + '<span class="n">' + n + "</span>";
      btn.classList.toggle("sel", cat === _glossaryFilterCat);
    });
  }

  if (meta) {
    meta.textContent = entries.length + " / " + all.length;
  }

  if (!entries.length) {
    list.innerHTML =
      '<div class="glossary-empty"><strong>Ничего не найдено</strong>Смените фильтр или поисковый запрос.</div>';
    return;
  }

  const groupAll = _glossaryFilterCat === "all" && !String(q || "").trim();
  if (groupAll) {
    const parts = [];
    GLOSSARY_FILTER_ORDER.forEach((cat) => {
      if (cat === "all") return;
      const chunk = entries.filter((e) => e.category === cat);
      if (!chunk.length) return;
      parts.push(
        '<section class="glossary-section">' +
          '<h3 class="glossary-section-title">' +
          glossaryEscText(GLOSSARY_FILTER_LABELS[cat] || cat) +
          " · " +
          chunk.length +
          "</h3>" +
          chunk.map(glossaryCardHtml).join("") +
          "</section>"
      );
    });
    list.innerHTML = parts.join("");
  } else {
    list.innerHTML = entries.map(glossaryCardHtml).join("");
  }
}

function wireGlossaryScreen() {
  if (document.body.dataset.glossaryScreenWired) return;
  document.body.dataset.glossaryScreenWired = "1";
}
