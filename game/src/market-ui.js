// ===== Рынок UI =====

let _marketTab = "browse"; // browse | sell | mine
let _marketFilterKind = ""; // "" | weapon | crystal | material | shot
let _marketFilterGrade = ""; // "" | D | C | B | A
let _marketSort = "new"; // new | price_asc | price_desc
let _marketBusy = false;
let _marketBrowseCache = [];

const MARKET_KIND_TABS = [
  { id: "", label: "Все", icon: "icons/warehouse_chest.png?v=1" },
  { id: "weapon", label: "Оружие", icon: "icons/weapon_elven_sword_i00.png" },
  { id: "crystal", label: "Кристаллы", icon: "icons/etc_crystal_blue_i00.png" },
  { id: "material", label: "Руда", icon: "icons/etc_crystal_white_i00.png" },
  { id: "shot", label: "Заряды", icon: "icons/etc_spirit_bullet_blue_i00.png" },
];

const MARKET_GRADE_TABS = [
  { id: "", label: "Все грейды", icon: "icons/warehouse_chest.png?v=1" },
  { id: "D", label: "D", icon: "icons/etc_crystal_blue_i00.png" },
  { id: "C", label: "C", icon: "icons/etc_crystal_green_i00.png" },
  { id: "B", label: "B", icon: "icons/etc_crystal_red_i00.png" },
  { id: "A", label: "A", icon: "icons/etc_crystal_silver_i00.png" },
];

const MARKET_SORT_OPTS = [
  { id: "new", label: "Новые" },
  { id: "price_asc", label: "Цена ↑" },
  { id: "price_desc", label: "Цена ↓" },
];

function marketKindTabIcon(tab) {
  if (!tab) return "";
  if (tab.id === "crystal" && typeof CRYSTAL_ICON !== "undefined") return CRYSTAL_ICON.D || tab.icon;
  if (tab.id === "material" && typeof ORE !== "undefined") return ORE.soul?.icon || tab.icon;
  if (tab.id === "shot" && typeof SHOT_ICON !== "undefined") return SHOT_ICON.soul?.D || tab.icon;
  return tab.icon || "";
}

function marketGradeTabIcon(tab) {
  if (!tab) return "";
  if (tab.id && typeof CRYSTAL_ICON !== "undefined" && CRYSTAL_ICON[tab.id]) return CRYSTAL_ICON[tab.id];
  return tab.icon || "";
}

function openMarket() {
  if (typeof cloudEnabled === "function" && !cloudEnabled()) {
    toast("Рынок доступен только онлайн", "warn");
    return;
  }
  if (typeof readCloudAuth === "function" && !readCloudAuth()?.token) {
    toast("Войдите в аккаунт, чтобы пользоваться рынком", "warn");
    return;
  }
  if (!state.avatar?.created) {
    toast("Сначала создай персонажа", "warn");
    return;
  }
  _marketTab = "browse";
  renderMarket();
  show("market");
  Audio2.open();
}

function renderMarket() {
  const root = document.getElementById("marketBody");
  if (!root) return;
  const tabs = document.getElementById("marketTabs");
  if (tabs) {
    tabs.querySelectorAll("[data-market-tab]").forEach((btn) => {
      btn.classList.toggle("sel", btn.getAttribute("data-market-tab") === _marketTab);
    });
  }
  if (_marketTab === "browse") renderMarketBrowse(root);
  else if (_marketTab === "sell") renderMarketSell(root);
  else renderMarketMine(root);
}

function marketSetTab(tab) {
  _marketTab = tab;
  renderMarket();
}

function marketSortRows(rows) {
  const list = (rows || []).slice();
  if (_marketSort === "price_asc") {
    list.sort((a, b) => (a.priceAdena || 0) - (b.priceAdena || 0));
  } else if (_marketSort === "price_desc") {
    list.sort((a, b) => (b.priceAdena || 0) - (a.priceAdena || 0));
  } else {
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  return list;
}

function marketFilterByGrade(rows, grade) {
  if (!grade) return rows || [];
  const g = String(grade).toUpperCase();
  return (rows || []).filter((r) => marketListingGrade(r) === g);
}

function marketFilterRows(rows, kind, grade) {
  let list = rows || [];
  if (kind) list = list.filter((r) => r.kind === kind);
  if (grade && (kind === "weapon" || kind === "crystal" || kind === "shot" || !kind)) {
    // grade applies to weapons always; for "all" kinds only weapons+crystal+shot get grade filter
    if (kind === "weapon" || kind === "crystal" || kind === "shot") {
      list = marketFilterByGrade(list, grade);
    } else if (!kind) {
      list = list.filter((r) => {
        if (r.kind === "material") return true;
        return marketListingGrade(r) === String(grade).toUpperCase();
      });
    }
  }
  return list;
}

/** Вкладки фильтра (не pills) */
function renderMarketSubTabs(hostId, items, activeId, onPick, extraClass) {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = "";
  host.className = "market-subtabs" + (extraClass ? " " + extraClass : "");
  const isGrade = String(extraClass || "").includes("grade");
  items.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "market-subtab" + (activeId === t.id ? " sel" : "");
    if (t.id && /^[DCBA]$/.test(t.id)) btn.classList.add("g-" + t.id);
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", activeId === t.id ? "true" : "false");
    const ico = isGrade ? marketGradeTabIcon(t) : marketKindTabIcon(t);
    if (ico) {
      const img = document.createElement("img");
      img.className = "market-subtab-ico";
      img.src = ico;
      img.alt = "";
      btn.appendChild(img);
    }
    const span = document.createElement("span");
    span.textContent = t.label;
    btn.appendChild(span);
    btn.onclick = () => {
      Audio2.click();
      onPick(t.id);
    };
    host.appendChild(btn);
  });
}

function syncMarketGradeTabsVisibility() {
  const gradeHost = document.getElementById("marketGradeTabs");
  if (!gradeHost) return;
  const show = _marketFilterKind === "weapon";
  gradeHost.hidden = !show;
  if (!show) _marketFilterGrade = "";
}

async function renderMarketBrowse(root) {
  root.innerHTML =
    '<div class="market-filter-panel">' +
    '<div class="market-subtabs" id="marketKindTabs" role="tablist"></div>' +
    '<div class="market-subtabs market-subtabs-grade" id="marketGradeTabs" role="tablist"></div>' +
    '<div class="market-subtabs market-subtabs-sort" id="marketSortTabs" role="tablist"></div>' +
    '<div class="market-filter-actions">' +
    '<button type="button" class="btn btn-ghost btn-sm" id="marketRefresh">Обновить</button>' +
    "</div></div>" +
    '<div class="market-list" id="marketList"><p class="market-empty">Загрузка…</p></div>';

  bindMarketBrowseFilters();
  const refresh = document.getElementById("marketRefresh");
  if (refresh) refresh.onclick = () => { Audio2.click(); loadMarketBrowse(); };
  loadMarketBrowse();
}

function bindMarketBrowseFilters() {
  renderMarketSubTabs("marketKindTabs", MARKET_KIND_TABS, _marketFilterKind, (kind) => {
    _marketFilterKind = kind;
    if (kind !== "weapon") _marketFilterGrade = "";
    bindMarketBrowseFilters();
    loadMarketBrowse();
  });
  if (_marketFilterKind === "weapon") {
    renderMarketSubTabs("marketGradeTabs", MARKET_GRADE_TABS, _marketFilterGrade, (grade) => {
      _marketFilterGrade = grade;
      bindMarketBrowseFilters();
      paintMarketBrowseList();
    }, "market-subtabs-grade");
  } else {
    const gh = document.getElementById("marketGradeTabs");
    if (gh) {
      gh.innerHTML = "";
      gh.hidden = true;
    }
  }
  renderMarketSubTabs("marketSortTabs", MARKET_SORT_OPTS, _marketSort, (sort) => {
    _marketSort = sort;
    bindMarketBrowseFilters();
    paintMarketBrowseList();
  }, "market-subtabs-sort");
  syncMarketGradeTabsVisibility();
}

function paintMarketBrowseList() {
  const list = document.getElementById("marketList");
  if (!list) return;
  let rows = _marketBrowseCache;
  if (_marketFilterKind === "weapon" && _marketFilterGrade) {
    rows = marketFilterByGrade(rows, _marketFilterGrade);
  }
  rows = marketSortRows(rows);
  if (!rows.length) {
    list.innerHTML =
      '<p class="market-empty">Лотов в этой вкладке нет.</p>';
    return;
  }
  list.innerHTML = "";
  rows.forEach((listing) => {
    list.appendChild(buildMarketCard(listing, { buy: true }));
  });
}

async function loadMarketBrowse() {
  const list = document.getElementById("marketList");
  if (!list) return;
  list.innerHTML = '<p class="market-empty">Загрузка…</p>';
  const r = await marketFetchListings({ kind: _marketFilterKind || undefined });
  if (!r.ok) {
    _marketBrowseCache = [];
    list.innerHTML = '<p class="market-empty">' + (r.error || "Ошибка") + "</p>";
    return;
  }
  _marketBrowseCache = r.rows || [];
  paintMarketBrowseList();
}

function buildMarketCard(listing, opts) {
  opts = opts || {};
  const card = document.createElement("div");
  const grade = marketListingGrade(listing);
  card.className = "market-card" + (grade ? " g-" + grade : "");
  const qty = listing.qty > 1 ? " ×" + listing.qty : "";
  const exp = listing.expiresAt
    ? new Date(listing.expiresAt).toLocaleDateString("ru-RU")
    : "";
  card.innerHTML =
    '<img class="market-card-ico" src="' + marketListingIcon(listing) + '" alt="">' +
    '<div class="market-card-body">' +
    "<strong>" + marketListingTitle(listing) + qty + "</strong>" +
    '<span class="market-card-meta">Продавец: ' + (listing.sellerName || "—") +
    (exp ? " · до " + exp : "") + "</span>" +
    '<span class="market-card-price">' + fmtAdena(listing.priceAdena) + " adena</span>" +
    "</div>" +
    '<div class="market-card-actions"></div>';
  const actions = card.querySelector(".market-card-actions");
  if (opts.buy) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary btn-sm";
    btn.textContent = "Купить";
    btn.onclick = () => confirmMarketBuy(listing);
    actions.appendChild(btn);
  }
  if (opts.cancel && listing.status === "listed") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-sm";
    btn.textContent = "Снять";
    btn.onclick = () => confirmMarketCancel(listing);
    actions.appendChild(btn);
  }
  if (opts.status) {
    const st = document.createElement("span");
    st.className = "market-status";
    st.textContent = marketStatusLabel(listing.status);
    actions.appendChild(st);
  }
  return card;
}

function marketStatusLabel(status) {
  return (
    {
      listed: "Активен",
      sold: "Продан",
      cancelled: "Снят",
      expired: "Истёк",
    }[status] || status
  );
}

async function confirmMarketBuy(listing) {
  if (_marketBusy) return;
  const title = marketListingTitle(listing);
  const price = listing.priceAdena;
  const adena = Math.max(0, Number(state.adena) || 0);
  if (adena < price) {
    toast("Не хватает адены", "warn");
    return;
  }
  const msg =
    "Купить «" + title + "» за " + fmtAdena(price) + " адены?\n" +
    "Налог рынка " + MARKET_TAX_PCT + "% удерживается с продавца.";
  const ok =
    typeof showConfirm === "function"
      ? await showConfirm({ title: "Покупка", message: msg, okText: "Купить" })
      : window.confirm(msg);
  if (!ok) return;
  _marketBusy = true;
  try {
    const r = await marketBuyListing(listing.id);
    if (!r.ok) {
      toast(r.error || "Не удалось купить", "warn");
      return;
    }
    toast("Куплено: " + title, "success");
    if (typeof renderHud === "function") renderHud();
    loadMarketBrowse();
  } finally {
    _marketBusy = false;
  }
}

async function confirmMarketCancel(listing) {
  if (_marketBusy) return;
  const ok =
    typeof showConfirm === "function"
      ? await showConfirm({
          title: "Снять лот",
          message: "Вернуть предмет с рынка в инвентарь?",
          okText: "Снять",
        })
      : true;
  if (!ok) return;
  _marketBusy = true;
  try {
    const r = await marketCancelListing(listing.id);
    if (!r.ok) {
      toast(r.error || "Не удалось снять", "warn");
      return;
    }
    toast("Лот снят, предмет возвращён", "success");
    if (typeof renderHud === "function") renderHud();
    renderMarketMine(document.getElementById("marketBody"));
  } finally {
    _marketBusy = false;
  }
}

/** Степпер количества */
function buildMarketQtyStepper(maxQty, initial) {
  const max = Math.max(1, Math.floor(Number(maxQty) || 1));
  const wrap = document.createElement("div");
  wrap.className = "market-stepper";
  wrap.innerHTML =
    '<div class="market-stepper-main">' +
    '<button type="button" class="market-step-btn" data-act="dec">−</button>' +
    '<input type="number" class="market-step-input" min="1" max="' + max + '" value="' +
    Math.min(max, Math.max(1, Math.floor(Number(initial) || 1))) + '">' +
    '<button type="button" class="market-step-btn" data-act="inc">+</button>' +
    "</div>" +
    '<div class="market-step-presets">' +
    '<button type="button" class="market-step-preset" data-set="1">1</button>' +
    (max >= 10 ? '<button type="button" class="market-step-preset" data-set="10">10</button>' : "") +
    (max >= 100 ? '<button type="button" class="market-step-preset" data-set="100">100</button>' : "") +
    '<button type="button" class="market-step-preset" data-set="max">всё (' + max + ")</button>" +
    "</div>";
  const input = wrap.querySelector(".market-step-input");
  const clamp = () => {
    let n = Math.floor(Number(input.value) || 1);
    if (n < 1) n = 1;
    if (n > max) n = max;
    input.value = String(n);
    return n;
  };
  wrap.querySelectorAll("[data-act]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      const cur = clamp();
      input.value = String(btn.getAttribute("data-act") === "inc" ? Math.min(max, cur + 1) : Math.max(1, cur - 1));
      clamp();
    };
  });
  wrap.querySelectorAll("[data-set]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      const set = btn.getAttribute("data-set");
      input.value = set === "max" ? String(max) : String(Math.min(max, Math.max(1, Number(set) || 1)));
      clamp();
    };
  });
  input.addEventListener("change", clamp);
  input.addEventListener("blur", clamp);
  wrap.getValue = clamp;
  return wrap;
}

/** Степпер цены: −−/− / поле / +/++ и пресеты */
function buildMarketPriceStepper(initial) {
  const min = MARKET_MIN_PRICE;
  const max = MARKET_MAX_PRICE;
  const start = Math.max(min, Math.floor(Number(initial) || min));
  const wrap = document.createElement("div");
  wrap.className = "market-stepper market-price-stepper";
  wrap.innerHTML =
    '<div class="market-stepper-main market-price-main">' +
    '<button type="button" class="market-step-btn" data-delta="-10000" title="−10k">−−</button>' +
    '<button type="button" class="market-step-btn" data-delta="-1000" title="−1k">−</button>' +
    '<input type="text" inputmode="numeric" class="market-step-input market-price-field" value="' +
    start.toLocaleString("ru-RU") + '">' +
    '<button type="button" class="market-step-btn" data-delta="1000" title="+1k">+</button>' +
    '<button type="button" class="market-step-btn" data-delta="10000" title="+10k">++</button>' +
    "</div>" +
    '<div class="market-step-presets">' +
    [
      ["мин", min],
      ["10k", 10_000],
      ["100k", 100_000],
      ["1M", 1_000_000],
      ["10M", 10_000_000],
      ["100M", 100_000_000],
    ]
      .map(
        ([lab, val]) =>
          '<button type="button" class="market-step-preset" data-price="' + val + '">' + lab + "</button>"
      )
      .join("") +
    "</div>" +
    '<p class="market-price-hint">После налога ' + MARKET_TAX_PCT +
    '% получишь: <b class="market-price-net">—</b></p>';

  const input = wrap.querySelector(".market-price-field");
  const netEl = wrap.querySelector(".market-price-net");
  const parseRaw = () => {
    const raw = String(input.value || "").replace(/\s|\u00a0/g, "").replace(/[^\d]/g, "");
    return Math.floor(Number(raw) || 0);
  };
  const format = (n) => Math.floor(n).toLocaleString("ru-RU");
  const clamp = () => {
    let n = parseRaw();
    if (n < min) n = min;
    if (n > max) n = max;
    if (document.activeElement !== input) input.value = format(n);
    else if (!String(input.value).match(/[^\d\s\u00a0]/)) {
      /* keep typing */
    } else {
      input.value = format(n);
    }
    const net = Math.floor(n * (1 - MARKET_TAX_PCT / 100));
    if (netEl) netEl.textContent = (typeof fmtAdena === "function" ? fmtAdena(net) : format(net)) + " adena";
    return n;
  };
  const commit = () => {
    let n = parseRaw();
    if (n < min) n = min;
    if (n > max) n = max;
    input.value = format(n);
    const net = Math.floor(n * (1 - MARKET_TAX_PCT / 100));
    if (netEl) netEl.textContent = (typeof fmtAdena === "function" ? fmtAdena(net) : format(net)) + " adena";
    return n;
  };

  wrap.querySelectorAll("[data-delta]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      let n = parseRaw() + (Number(btn.getAttribute("data-delta")) || 0);
      if (n < min) n = min;
      if (n > max) n = max;
      input.value = format(n);
      commit();
    };
  });
  wrap.querySelectorAll("[data-price]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      input.value = format(Number(btn.getAttribute("data-price")) || min);
      commit();
    };
  });
  input.addEventListener("blur", commit);
  input.addEventListener("change", commit);
  input.addEventListener("input", () => {
    const n = Math.max(min, parseRaw());
    const net = Math.floor(n * (1 - MARKET_TAX_PCT / 100));
    if (netEl) netEl.textContent = (typeof fmtAdena === "function" ? fmtAdena(net) : format(net)) + " adena";
  });
  commit();
  wrap.getValue = commit;
  return wrap;
}

function closeMarketListModal() {
  const el = document.getElementById("marketListModal");
  if (el) el.remove();
}

function openMarketListModal(opts) {
  opts = opts || {};
  closeMarketListModal();
  const backdrop = document.createElement("div");
  backdrop.id = "marketListModal";
  backdrop.className = "market-list-modal-backdrop";
  backdrop.innerHTML =
    '<div class="market-list-modal" role="dialog" aria-modal="true">' +
    '<div class="market-list-modal-head">' +
    (opts.icon ? '<img src="' + opts.icon + '" alt="">' : "") +
    "<div><strong>" + (opts.title || "Лот") + "</strong>" +
    '<span class="market-card-meta">' + (opts.meta || "") + "</span></div>" +
    '<button type="button" class="market-list-modal-x" aria-label="Закрыть">×</button>' +
    '</div><div class="market-list-modal-body"></div>' +
    '<div class="market-list-modal-actions">' +
    '<button type="button" class="btn btn-ghost" data-act="cancel">Отмена</button>' +
    '<button type="button" class="btn btn-primary" data-act="ok">Выставить</button>' +
    "</div></div>";

  const body = backdrop.querySelector(".market-list-modal-body");
  let qtyStepper = null;
  if (opts.maxQty != null && opts.maxQty > 1) {
    const qtyBlock = document.createElement("div");
    qtyBlock.className = "market-list-field";
    qtyBlock.innerHTML = '<div class="market-list-field-label">Количество</div>';
    qtyStepper = buildMarketQtyStepper(opts.maxQty, 1);
    qtyBlock.appendChild(qtyStepper);
    body.appendChild(qtyBlock);
  }
  const priceBlock = document.createElement("div");
  priceBlock.className = "market-list-field";
  priceBlock.innerHTML = '<div class="market-list-field-label">Цена лота</div>';
  const priceStepper = buildMarketPriceStepper(opts.suggestPrice || MARKET_MIN_PRICE);
  priceBlock.appendChild(priceStepper);
  body.appendChild(priceBlock);

  const finish = async (ok) => {
    if (!ok) {
      closeMarketListModal();
      return;
    }
    const qty = qtyStepper ? qtyStepper.getValue() : 1;
    const priceAdena = priceStepper.getValue();
    closeMarketListModal();
    if (typeof opts.onConfirm === "function") await opts.onConfirm({ qty, priceAdena });
  };
  backdrop.querySelector('[data-act="cancel"]').onclick = () => {
    Audio2.click();
    finish(false);
  };
  backdrop.querySelector('[data-act="ok"]').onclick = () => {
    Audio2.click();
    finish(true);
  };
  backdrop.querySelector(".market-list-modal-x").onclick = () => {
    Audio2.click();
    finish(false);
  };
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      Audio2.click();
      finish(false);
    }
  });
  document.body.appendChild(backdrop);
  setTimeout(() => priceStepper.querySelector(".market-price-field")?.focus(), 0);
}

function suggestMarketWeaponPrice(it) {
  try {
    const w = typeof WMAP !== "undefined" ? WMAP[it.id] : null;
    if (typeof GRADE_VALUE !== "undefined" && w?.grade) {
      const base = GRADE_VALUE[w.grade] || MARKET_MIN_PRICE;
      const plus = Math.max(0, Number(it.plus) || 0);
      return Math.max(MARKET_MIN_PRICE, Math.floor(base * Math.pow(1.25, plus)));
    }
  } catch (_) {}
  return MARKET_MIN_PRICE;
}

function renderMarketSell(root) {
  const weapons = marketListableWeapons();
  const stacks = marketStackOptions();
  let sellKind = "weapon";
  let sellGrade = "";

  root.innerHTML =
    '<p class="market-hint">Комиссия ' + MARKET_TAX_PCT +
    "%. Лимит: " + MARKET_MAX_LISTINGS +
    " лотов. Нажми предмет — откроется окно цены.</p>" +
    '<div class="market-filter-panel">' +
    '<div class="market-subtabs" id="marketSellKindTabs" role="tablist"></div>' +
    '<div class="market-subtabs market-subtabs-grade" id="marketSellGradeTabs" role="tablist"></div>' +
    "</div>" +
    '<div class="market-sell-grid" id="marketSellList"></div>';

  const paint = () => {
    const box = document.getElementById("marketSellList");
    if (!box) return;
    box.innerHTML = "";
    if (sellKind === "weapon") {
      let list = weapons;
      if (sellGrade) list = list.filter((it) => (WMAP[it.id]?.grade || "") === sellGrade);
      if (!list.length) {
        box.innerHTML = '<p class="market-empty">Нет оружия в этом грейде.</p>';
        return;
      }
      list.forEach((it) => {
        const w = WMAP[it.id];
        const row = document.createElement("button");
        row.type = "button";
        row.className = "market-sell-pick";
        row.innerHTML =
          '<img src="' + (w?.icon || "") + '" alt="">' +
          '<div class="market-sell-info"><b>' + (w?.name || it.id) + (it.plus ? " +" + it.plus : "") + "</b>" +
          '<span class="market-card-meta">Грейд ' + (w?.grade || "?") + " · нажми, чтобы выставить</span></div>" +
          '<span class="market-sell-go">→</span>';
        row.onclick = () => {
          Audio2.click();
          openMarketListModal({
            icon: w?.icon || "",
            title: (w?.name || it.id) + (it.plus ? " +" + it.plus : ""),
            meta: "Оружие · грейд " + (w?.grade || "?"),
            suggestPrice: suggestMarketWeaponPrice(it),
            onConfirm: async ({ priceAdena }) => {
              await submitMarketList({ kind: "weapon", uid: it.uid, priceAdena });
            },
          });
        };
        box.appendChild(row);
      });
      return;
    }

    let list = stacks.filter((st) => st.kind === sellKind);
    if (!list.length) {
      box.innerHTML = '<p class="market-empty">Нет предметов в этой вкладке.</p>';
      return;
    }
    list.forEach((st) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "market-sell-pick";
      const icon =
        st.kind === "crystal"
          ? (typeof CRYSTAL_ICON !== "undefined" && CRYSTAL_ICON[st.grade]) || ""
          : st.kind === "material"
            ? (typeof ORE !== "undefined" && ORE[st.ore]?.icon) || ""
            : (typeof SHOT_ICON !== "undefined" && SHOT_ICON[st.shotKind]?.[st.grade]) || "";
      row.innerHTML =
        (icon ? '<img src="' + icon + '" alt="">' : "") +
        '<div class="market-sell-info"><b>' + st.label.replace(/\s*×\d+$/, "") + "</b>" +
        '<span class="market-card-meta">В наличии: ' + st.max + " · нажми, чтобы выставить</span></div>" +
        '<span class="market-sell-go">→</span>';
      row.onclick = () => {
        Audio2.click();
        openMarketListModal({
          icon,
          title: st.label.replace(/\s*×\d+$/, ""),
          meta: "В наличии: " + st.max,
          maxQty: st.max,
          suggestPrice: MARKET_MIN_PRICE,
          onConfirm: async ({ qty, priceAdena }) => {
            const payload = { kind: st.kind, qty, priceAdena };
            if (st.kind === "crystal") payload.grade = st.grade;
            if (st.kind === "material") payload.ore = st.ore;
            if (st.kind === "shot") {
              payload.shotKind = st.shotKind;
              payload.grade = st.grade;
            }
            await submitMarketList(payload);
          },
        });
      };
      box.appendChild(row);
    });
  };

  const bind = () => {
    const kindTabs = MARKET_KIND_TABS.filter((t) => t.id !== "");
    renderMarketSubTabs("marketSellKindTabs", kindTabs, sellKind, (kind) => {
      sellKind = kind;
      if (kind !== "weapon") sellGrade = "";
      bind();
      paint();
    });
    const gradeHost = document.getElementById("marketSellGradeTabs");
    if (gradeHost) {
      gradeHost.hidden = sellKind !== "weapon";
      if (sellKind === "weapon") {
        renderMarketSubTabs("marketSellGradeTabs", MARKET_GRADE_TABS, sellGrade, (grade) => {
          sellGrade = grade;
          bind();
          paint();
        }, "market-subtabs-grade");
      } else {
        gradeHost.innerHTML = "";
      }
    }
  };
  bind();
  paint();
}

async function submitMarketList(payload) {
  if (_marketBusy) return;
  const price = Math.floor(Number(payload.priceAdena) || 0);
  if (price < MARKET_MIN_PRICE) {
    toast("Минимальная цена: " + fmtAdena(MARKET_MIN_PRICE), "warn");
    return;
  }
  if (price > MARKET_MAX_PRICE) {
    toast("Слишком высокая цена", "warn");
    return;
  }
  _marketBusy = true;
  try {
    const r = await marketListItem(payload);
    if (!r.ok) {
      toast(r.error || "Не удалось выставить", "warn");
      return;
    }
    toast("Лот выставлен", "success");
    if (typeof renderHud === "function") renderHud();
    renderMarketSell(document.getElementById("marketBody"));
  } finally {
    _marketBusy = false;
  }
}

async function renderMarketMine(root) {
  let mineKind = "";
  let mineGrade = "";
  let mineCache = [];

  root.innerHTML =
    '<div class="market-filter-panel">' +
    '<div class="market-subtabs" id="marketMineKindTabs" role="tablist"></div>' +
    '<div class="market-subtabs market-subtabs-grade" id="marketMineGradeTabs" role="tablist"></div>' +
    "</div>" +
    '<div class="market-list" id="marketMineList"><p class="market-empty">Загрузка…</p></div>';

  const paint = () => {
    const list = document.getElementById("marketMineList");
    if (!list) return;
    let rows = mineCache;
    if (mineKind) rows = rows.filter((r) => r.kind === mineKind);
    if (mineKind === "weapon" && mineGrade) rows = marketFilterByGrade(rows, mineGrade);
    if (!rows.length) {
      list.innerHTML = '<p class="market-empty">Нет лотов в этой вкладке.</p>';
      return;
    }
    list.innerHTML = "";
    rows.forEach((listing) => {
      list.appendChild(
        buildMarketCard(listing, {
          cancel: listing.status === "listed",
          status: true,
        })
      );
    });
  };

  const bind = () => {
    renderMarketSubTabs("marketMineKindTabs", MARKET_KIND_TABS, mineKind, (kind) => {
      mineKind = kind;
      if (kind !== "weapon") mineGrade = "";
      bind();
      paint();
    });
    const gradeHost = document.getElementById("marketMineGradeTabs");
    if (gradeHost) {
      gradeHost.hidden = mineKind !== "weapon";
      if (mineKind === "weapon") {
        renderMarketSubTabs("marketMineGradeTabs", MARKET_GRADE_TABS, mineGrade, (grade) => {
          mineGrade = grade;
          bind();
          paint();
        }, "market-subtabs-grade");
      } else {
        gradeHost.innerHTML = "";
      }
    }
  };
  bind();

  const list = document.getElementById("marketMineList");
  const r = await marketFetchMine();
  if (!r.ok) {
    list.innerHTML = '<p class="market-empty">' + (r.error || "Ошибка") + "</p>";
    return;
  }
  mineCache = r.rows || [];
  if (!mineCache.length) {
    list.innerHTML = '<p class="market-empty">У тебя нет лотов.</p>';
    return;
  }
  paint();
}

function bindMarketUi() {
  const tabs = document.getElementById("marketTabs");
  if (tabs && !tabs._bound) {
    tabs._bound = true;
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-market-tab]");
      if (!btn) return;
      Audio2.click();
      marketSetTab(btn.getAttribute("data-market-tab"));
    });
  }
  const tile = document.getElementById("marketTile");
  if (tile && !tile._bound) {
    tile._bound = true;
    tile.onclick = () => openMarket();
  }
}
