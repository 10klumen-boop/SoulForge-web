// ===== UI: почта игроков (отдельный экран меню) =====

let _playerMailPickUid = null;
let _playerMailBusy = false;
let _playerMailInbox = [];
let _playerMailOutbox = [];
let _playerMailUnread = 0;
let _playerMailToName = "";
let _playerMailSendTab = "gear"; // gear | stack
let _playerMailStackKey = ""; // "adena" | "crystal:D" | "material:soul" | "shot:soul:D" | ...
let _playerMailStackQty = 1;
/** Фильтр стеков: all | adena | shot | crystal | material | piece | scroll */
let _playerMailStackCat = "all";
let _playerMailPollTimer = null;
const PLAYER_MAIL_POLL_MS = 25000;

function playerMailBadgeCount() {
  return Math.max(0, _playerMailUnread | 0);
}

function syncPlayerMailBadges() {
  const n = playerMailBadgeCount();
  const head = document.getElementById("playerMailHeadBadge");
  if (head) {
    head.hidden = n <= 0;
    head.textContent = String(n);
  }
  if (typeof renderMenu === "function") renderMenu();
}

function openPlayerMail() {
  renderPlayerMail();
  show("player-mail");
  Audio2.open();
  refreshPlayerMailLists();
}

function renderPlayerMail() {
  const body = document.getElementById("playerMailBody");
  if (!body) return;
  syncPlayerMailBadges();
  body.innerHTML = renderPlayerMailHtml();
  wirePlayerMailUi(body);
}

async function refreshPlayerMailLists() {
  if (typeof playerMailIsLoggedIn !== "function" || !playerMailIsLoggedIn()) {
    _playerMailInbox = [];
    _playerMailOutbox = [];
    _playerMailUnread = 0;
    syncPlayerMailBadges();
    if (document.getElementById("screen-player-mail")?.classList.contains("active")) {
      renderPlayerMail();
    }
    return;
  }
  const [inbox, outbox] = await Promise.all([
    playerMailFetchInbox(),
    playerMailFetchOutbox(),
  ]);
  _playerMailInbox = inbox.ok ? inbox.rows || [] : [];
  _playerMailOutbox = outbox.ok ? outbox.rows || [] : [];
  _playerMailUnread = _playerMailInbox.length;
  if (!inbox.ok && inbox.error && typeof toast === "function") {
    toast(inbox.error, "warn");
  }
  syncPlayerMailBadges();
  if (document.getElementById("screen-player-mail")?.classList.contains("active")) {
    renderPlayerMail();
  }
}

/** Лёгкий опрос только входящих — для метки на плитке без открытия почты. */
async function refreshPlayerMailBadgeOnly() {
  if (typeof playerMailIsLoggedIn !== "function" || !playerMailIsLoggedIn()) {
    if (_playerMailUnread) {
      _playerMailUnread = 0;
      syncPlayerMailBadges();
    }
    return;
  }
  if (_playerMailBusy) return;
  const inbox = await playerMailFetchInbox();
  if (!inbox.ok) return;
  const rows = inbox.rows || [];
  const n = rows.length;
  const changed = n !== _playerMailUnread;
  _playerMailUnread = n;
  if (document.getElementById("screen-player-mail")?.classList.contains("active")) {
    _playerMailInbox = rows;
    if (changed && !_playerMailBusy) renderPlayerMail();
    else syncPlayerMailBadges();
  } else {
    syncPlayerMailBadges();
  }
}

function startPlayerMailBadgePoll() {
  stopPlayerMailBadgePoll();
  if (typeof playerMailIsLoggedIn !== "function" || !playerMailIsLoggedIn()) return;
  refreshPlayerMailBadgeOnly();
  _playerMailPollTimer = setInterval(() => {
    refreshPlayerMailBadgeOnly();
  }, PLAYER_MAIL_POLL_MS);
}

function stopPlayerMailBadgePoll() {
  if (_playerMailPollTimer) {
    clearInterval(_playerMailPollTimer);
    _playerMailPollTimer = null;
  }
}

function playerMailStackKeyOf(st) {
  if (!st) return "";
  if (st.kind === "adena") return "adena";
  if (st.kind === "crystal") return "crystal:" + st.grade;
  if (st.kind === "material") return "material:" + st.ore;
  if (st.kind === "shot") return "shot:" + st.shotKind + ":" + st.grade;
  if (st.kind === "armor_piece") return "armor_piece:" + st.fragId;
  if (st.kind === "jewelry_piece") return "jewelry_piece:" + st.fragId;
  if (st.kind === "scroll") return "scroll:" + st.target + ":" + st.typeId + ":" + st.grade;
  return "";
}

function playerMailParseStackKey(key) {
  if (!key) return null;
  if (key === "adena") return { kind: "adena" };
  const parts = String(key).split(":");
  if (parts[0] === "crystal") return { kind: "crystal", grade: parts[1] };
  if (parts[0] === "material") return { kind: "material", ore: parts[1] };
  if (parts[0] === "shot") return { kind: "shot", shotKind: parts[1], grade: parts[2] };
  if (parts[0] === "armor_piece") return { kind: "armor_piece", fragId: parts.slice(1).join(":") };
  if (parts[0] === "jewelry_piece") return { kind: "jewelry_piece", fragId: parts.slice(1).join(":") };
  if (parts[0] === "scroll") return { kind: "scroll", target: parts[1], typeId: parts[2], grade: parts[3] };
  return null;
}

function playerMailStackCatOf(st) {
  if (!st) return "other";
  if (st.kind === "adena") return "adena";
  if (st.kind === "shot") return "shot";
  if (st.kind === "crystal") return "crystal";
  if (st.kind === "material") return "material";
  if (st.kind === "scroll") return "scroll";
  if (st.kind === "armor_piece" || st.kind === "jewelry_piece") return "piece";
  return "other";
}

function playerMailStackIcon(st) {
  if (!st) return "icons/etc_adena_i00.png";
  if (st.icon) return st.icon;
  if (st.kind === "adena") {
    return typeof ADENA_ICON !== "undefined" ? ADENA_ICON : "icons/etc_adena_i00.png";
  }
  if (st.kind === "crystal") {
    return (typeof CRYSTAL_ICON !== "undefined" && CRYSTAL_ICON[st.grade]) || "icons/etc_crystal_blue_i00.png";
  }
  if (st.kind === "material") {
    return (typeof ORE !== "undefined" && ORE[st.ore]?.icon) || "icons/etc_crystal_white_i00.png";
  }
  if (st.kind === "shot") {
    return (
      (typeof SHOT_ICON !== "undefined" && SHOT_ICON[st.shotKind]?.[st.grade]) ||
      "icons/etc_spirit_bullet_blue_i00.png"
    );
  }
  if (st.kind === "armor_piece") {
    const frag = typeof ARMOR_FRAGS !== "undefined" ? ARMOR_FRAGS[st.fragId] : null;
    return frag?.icon || "icons/etc_crystal_white_i00.png";
  }
  if (st.kind === "jewelry_piece") {
    const frag =
      (typeof ACCESSORY_FRAGS !== "undefined" && ACCESSORY_FRAGS[st.fragId]) ||
      (typeof JEWELRY_FRAGS !== "undefined" && JEWELRY_FRAGS[st.fragId]) ||
      null;
    return frag?.icon || "icons/etc_broken_crystal_silver_i00.png";
  }
  if (st.kind === "scroll") {
    const typeId = st.typeId || "regular";
    const target = st.target === "armor" || st.target === "jewelry" ? "armor" : "weapon";
    if (typeof scrollTierIcon === "function") return scrollTierIcon(typeId, st.grade || "D", target);
    return target === "armor"
      ? "icons/etc_scroll_of_enchant_armor_i01.png"
      : "icons/etc_scroll_of_enchant_weapon_i01.png";
  }
  return "icons/etc_adena_i00.png";
}

function playerMailFormatQtyPreview(kind, qty) {
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  const full = typeof fmt === "function" ? fmt(n) : String(n);
  if (kind === "adena") {
    const short = typeof fmtAdena === "function" ? fmtAdena(n) : full;
    return "Отправишь: <b>" + full + "</b> adena <span class=\"account-mail-qty-short\">(" + short + ")</span>";
  }
  return "Отправишь: <b>" + full + "</b>";
}

function playerMailFilteredStacks() {
  const stacks = typeof playerMailStackOptions === "function" ? playerMailStackOptions() : [];
  if (_playerMailStackCat === "all") return stacks;
  return stacks.filter((st) => playerMailStackCatOf(st) === _playerMailStackCat);
}

function renderPlayerMailStackCats(stacks) {
  const counts = { all: stacks.length, adena: 0, shot: 0, crystal: 0, material: 0, piece: 0, scroll: 0 };
  stacks.forEach((st) => {
    const c = playerMailStackCatOf(st);
    if (counts[c] != null) counts[c]++;
  });
  const cats = [
    { id: "all", label: "Все" },
    { id: "adena", label: "Adena" },
    { id: "shot", label: "Соски" },
    { id: "crystal", label: "Кристаллы" },
    { id: "material", label: "Руда" },
    { id: "piece", label: "Куски" },
    { id: "scroll", label: "Свитки" },
  ];
  let html = '<div class="account-mail-stack-cats" role="tablist" aria-label="Тип стека">';
  cats.forEach((c) => {
    const n = counts[c.id] || 0;
    if (c.id !== "all" && n <= 0) return;
    html +=
      '<button type="button" class="account-storage-subtab' +
      (_playerMailStackCat === c.id ? " sel" : "") +
      '" data-mail-stack-cat="' +
      c.id +
      '">' +
      c.label +
      (c.id !== "all" ? ' <span class="inv-tab-n">(' + n + ")</span>" : "") +
      "</button>";
  });
  html += "</div>";
  return html;
}

function renderPlayerMailHtml() {
  let html = "";
  const loggedIn = typeof playerMailIsLoggedIn === "function" && playerMailIsLoggedIn();
  const itemLabel =
    typeof accountStorageItemLabel === "function"
      ? accountStorageItemLabel
      : (it) => (it && it.id) || "?";
  const itemIcon =
    typeof accountStorageItemIcon === "function"
      ? accountStorageItemIcon
      : () => "icons/weapon_small_sword_i00.png";

  if (!loggedIn) {
    html +=
      '<section class="account-mail-section">' +
      "<h3>Почта игроков</h3>" +
      '<p class="account-storage-hint">Нужен вход в облачный аккаунт — письма идут через сервер (как рынок).</p>' +
      '<p class="account-storage-empty">Войди в аккаунт на экране входа</p>' +
      "</section>";
    return html;
  }

  html +=
    '<section class="account-mail-section">' +
    "<h3>Входящие <span>(" +
    _playerMailInbox.length +
    ")</span></h3>" +
    '<p class="account-storage-hint">Срок хранения ' +
    (typeof PLAYER_MAIL_TTL_DAYS === "number" ? PLAYER_MAIL_TTL_DAYS : 7) +
    " дн. Забери на этом персонаже.</p>";
  if (!_playerMailInbox.length) html += '<p class="account-storage-empty">Нет писем</p>';
  else {
    if (_playerMailInbox.length > 1) {
      html +=
        '<div class="account-mail-inbox-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-claim-all-mail>Забрать все (' +
        _playerMailInbox.length +
        ")</button>" +
        "</div>";
    }
    html += '<div class="account-mail-list">';
    _playerMailInbox.forEach((m) => {
      html +=
        '<div class="account-mail-row">' +
        '<img src="' +
        playerMailParcelIcon(m) +
        '" alt="">' +
        "<div><b>" +
        playerMailParcelLabel(m) +
        "</b>" +
        "<span>от " +
        (m.senderName || "—") +
        "</span></div>" +
        '<button type="button" class="btn btn-primary" data-claim-mail="' +
        m.id +
        '">Забрать</button>' +
        "</div>";
    });
    html += "</div>";
  }
  html += "</section>";

  html +=
    '<section class="account-mail-section">' +
    "<h3>Отправить</h3>" +
    '<p class="account-storage-hint">Экип, адена, кристаллы, руда, куски или заряды → уникальное имя персонажа.</p>';

  html +=
    '<div class="account-mail-source-tabs">' +
    '<button type="button" class="account-storage-subtab' +
    (_playerMailSendTab === "gear" ? " sel" : "") +
    '" data-mail-tab="gear">Экип</button>' +
    '<button type="button" class="account-storage-subtab' +
    (_playerMailSendTab === "stack" ? " sel" : "") +
    '" data-mail-tab="stack">Adena / стеки</button>' +
    "</div>";

  let canSend = false;
  if (_playerMailSendTab === "gear") {
    const pool = (state.inventory || []).filter(
      (it) => typeof accountItemTransferBlockedReason !== "function" || !accountItemTransferBlockedReason(it)
    );
    const pickUid = _playerMailPickUid || "";
    canSend = !!pickUid && !!String(_playerMailToName || "").trim();
    html += '<div class="account-storage-grid" id="playerMailItemGrid">';
    if (!pool.length) html += '<p class="account-storage-empty">Нечего отправить</p>';
    else {
      pool.forEach((it) => {
        html +=
          '<button type="button" class="account-storage-slot' +
          (pickUid === it.uid ? " sel" : "") +
          '" data-mail-item="' +
          it.uid +
          '" title="' +
          itemLabel(it) +
          '">' +
          '<img src="' +
          itemIcon(it) +
          '" alt="">' +
          (it.plus ? '<span class="ip">+' + it.plus + "</span>" : "") +
          "</button>";
      });
    }
    html += "</div>";
  } else {
    const allStacks = typeof playerMailStackOptions === "function" ? playerMailStackOptions() : [];
    const stacks = playerMailFilteredStacks();
    const sel = allStacks.find((s) => playerMailStackKeyOf(s) === _playerMailStackKey) || null;
    const max = sel ? sel.max : 0;
    if (sel) {
      _playerMailStackQty = Math.max(1, Math.min(max, Math.floor(Number(_playerMailStackQty) || 1)));
    }
    canSend = !!sel && _playerMailStackQty >= 1 && !!String(_playerMailToName || "").trim();
    html += renderPlayerMailStackCats(allStacks);
    html += '<div class="account-mail-stack-list">';
    if (!stacks.length) html += '<p class="account-storage-empty">Нет стеков в этой категории</p>';
    else {
      stacks.forEach((st) => {
        const key = playerMailStackKeyOf(st);
        html +=
          '<button type="button" class="account-mail-stack-row' +
          (_playerMailStackKey === key ? " sel" : "") +
          '" data-mail-stack="' +
          key +
          '">' +
          '<img class="account-mail-stack-ico" src="' +
          playerMailStackIcon(st) +
          '" alt="">' +
          '<span class="account-mail-stack-label">' +
          st.label +
          "</span>" +
          "</button>";
      });
    }
    html += "</div>";
    if (sel) {
      const isAdena = sel.kind === "adena";
      html +=
        '<div class="account-mail-qty-row">' +
        "<label>Кол-во</label>" +
        '<input type="number" id="playerMailStackQty" min="1" max="' +
        max +
        '" value="' +
        _playerMailStackQty +
        '"' +
        (isAdena ? ' class="account-mail-qty-adena"' : "") +
        ">" +
        '<button type="button" class="btn btn-ghost btn-sm" data-mail-qty-max>всё</button>' +
        "</div>" +
        '<div class="account-mail-qty-preview" id="playerMailQtyPreview">' +
        playerMailFormatQtyPreview(sel.kind, _playerMailStackQty) +
        "</div>";
    }
  }

  html +=
    '<div class="account-mail-send-row">' +
    '<input type="text" id="playerMailToName" class="account-mail-name-input" maxlength="48" ' +
    'placeholder="Имя персонажа получателя" value="' +
    String(_playerMailToName || "").replace(/"/g, "&quot;") +
    '">' +
    '<button type="button" class="btn btn-primary" id="playerMailSendBtn"' +
    (!canSend || _playerMailBusy ? " disabled" : "") +
    ">Отправить</button>" +
    "</div></section>";

  html +=
    '<section class="account-mail-section">' +
    "<h3>Отправленные <span>(" +
    _playerMailOutbox.length +
    ")</span></h3>";
  if (!_playerMailOutbox.length) html += '<p class="account-storage-empty">Пусто</p>';
  else {
    html += '<div class="account-mail-list">';
    _playerMailOutbox.forEach((m) => {
      html +=
        '<div class="account-mail-row">' +
        '<img src="' +
        playerMailParcelIcon(m) +
        '" alt="">' +
        "<div><b>" +
        playerMailParcelLabel(m) +
        "</b>" +
        "<span>→ " +
        (m.recipientName || "—") +
        "</span></div>" +
        '<button type="button" class="btn btn-ghost" data-cancel-mail="' +
        m.id +
        '">Вернуть</button>' +
        "</div>";
    });
    html += "</div>";
  }
  html += "</section>";
  return html;
}

function updatePlayerMailQtyPreview() {
  const el = document.getElementById("playerMailQtyPreview");
  if (!el) return;
  const stacks = typeof playerMailStackOptions === "function" ? playerMailStackOptions() : [];
  const sel = stacks.find((s) => playerMailStackKeyOf(s) === _playerMailStackKey);
  if (!sel) {
    el.innerHTML = "";
    return;
  }
  const qty = Math.max(1, Math.min(sel.max, Math.floor(Number(_playerMailStackQty) || 1)));
  el.innerHTML = playerMailFormatQtyPreview(sel.kind, qty);
}

async function playerMailClaimOne(id) {
  const r = await playerMailClaim(id);
  if (!r.ok) {
    if (typeof toast === "function") toast(r.error || "Не удалось", "warn");
    return false;
  }
  if (typeof toast === "function") toast("Получено: " + playerMailParcelLabel(r.parcel), "success");
  return true;
}

async function playerMailClaimAll() {
  if (_playerMailBusy) return;
  const ids = (_playerMailInbox || []).map((m) => m && m.id).filter(Boolean);
  if (!ids.length) return;
  Audio2.click();
  _playerMailBusy = true;
  let ok = 0;
  let fail = 0;
  try {
    for (const id of ids) {
      const r = await playerMailClaim(id);
      if (r.ok) ok++;
      else fail++;
    }
    if (typeof toast === "function") {
      if (ok && !fail) toast("Получено писем: " + ok, "success");
      else if (ok) toast("Получено " + ok + ", ошибок " + fail, "warn");
      else toast("Не удалось забрать письма", "warn");
    }
  } finally {
    _playerMailBusy = false;
  }
  await refreshPlayerMailLists();
  if (typeof renderInventory === "function") renderInventory();
}

function wirePlayerMailUi(root) {
  root.querySelectorAll("[data-claim-mail]").forEach((btn) => {
    btn.onclick = async () => {
      if (_playerMailBusy) return;
      Audio2.click();
      _playerMailBusy = true;
      let ok = false;
      try {
        ok = await playerMailClaimOne(btn.dataset.claimMail);
        if (ok) _playerMailPickUid = null;
      } finally {
        _playerMailBusy = false;
      }
      if (ok) {
        await refreshPlayerMailLists();
        if (typeof renderInventory === "function") renderInventory();
      }
    };
  });
  root.querySelectorAll("[data-claim-all-mail]").forEach((btn) => {
    btn.onclick = () => playerMailClaimAll();
  });
  root.querySelectorAll("[data-cancel-mail]").forEach((btn) => {
    btn.onclick = async () => {
      if (_playerMailBusy) return;
      Audio2.click();
      _playerMailBusy = true;
      let ok = false;
      try {
        const r = await playerMailCancel(btn.dataset.cancelMail);
        if (!r.ok) {
          if (typeof toast === "function") toast(r.error || "Не удалось", "warn");
          return;
        }
        if (typeof toast === "function") toast("Письмо возвращено", "success");
        ok = true;
      } finally {
        _playerMailBusy = false;
      }
      if (ok) {
        await refreshPlayerMailLists();
        if (typeof renderInventory === "function") renderInventory();
      }
    };
  });
  root.querySelectorAll("[data-mail-tab]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      _playerMailSendTab = btn.dataset.mailTab;
      _playerMailPickUid = null;
      _playerMailStackKey = "";
      renderPlayerMail();
    };
  });
  root.querySelectorAll("[data-mail-stack-cat]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      _playerMailStackCat = btn.dataset.mailStackCat || "all";
      const nameEl = document.getElementById("playerMailToName");
      if (nameEl) _playerMailToName = nameEl.value;
      // Если выбранный стек не из категории — сбросить
      const stacks = playerMailFilteredStacks();
      if (_playerMailStackKey && !stacks.some((s) => playerMailStackKeyOf(s) === _playerMailStackKey)) {
        _playerMailStackKey = "";
        _playerMailStackQty = 1;
      }
      renderPlayerMail();
    };
  });
  root.querySelectorAll("[data-mail-item]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      _playerMailPickUid = btn.dataset.mailItem;
      const nameEl = document.getElementById("playerMailToName");
      if (nameEl) _playerMailToName = nameEl.value;
      renderPlayerMail();
    };
  });
  root.querySelectorAll("[data-mail-stack]").forEach((btn) => {
    btn.onclick = () => {
      Audio2.click();
      _playerMailStackKey = btn.dataset.mailStack;
      const stacks = typeof playerMailStackOptions === "function" ? playerMailStackOptions() : [];
      const sel = stacks.find((s) => playerMailStackKeyOf(s) === _playerMailStackKey);
      _playerMailStackQty = sel ? sel.max : 1;
      const nameEl = document.getElementById("playerMailToName");
      if (nameEl) _playerMailToName = nameEl.value;
      renderPlayerMail();
    };
  });
  const qtyInput = root.querySelector("#playerMailStackQty");
  if (qtyInput) {
    qtyInput.oninput = () => {
      _playerMailStackQty = Math.max(1, Math.floor(Number(qtyInput.value) || 1));
      updatePlayerMailQtyPreview();
      const sendBtn = document.getElementById("playerMailSendBtn");
      if (sendBtn) {
        sendBtn.disabled =
          _playerMailBusy || !_playerMailStackKey || !String(_playerMailToName || "").trim();
      }
    };
  }
  root.querySelectorAll("[data-mail-qty-max]").forEach((btn) => {
    btn.onclick = () => {
      const stacks = playerMailStackOptions();
      const sel = stacks.find((s) => playerMailStackKeyOf(s) === _playerMailStackKey);
      if (!sel) return;
      _playerMailStackQty = sel.max;
      if (qtyInput) qtyInput.value = String(sel.max);
      updatePlayerMailQtyPreview();
    };
  });
  const nameInput = root.querySelector("#playerMailToName");
  if (nameInput) {
    nameInput.oninput = () => {
      _playerMailToName = nameInput.value;
      const sendBtn = document.getElementById("playerMailSendBtn");
      if (!sendBtn) return;
      const hasPayload =
        _playerMailSendTab === "gear" ? !!_playerMailPickUid : !!_playerMailStackKey;
      sendBtn.disabled = !hasPayload || _playerMailBusy || !String(_playerMailToName).trim();
    };
  }
  const sendBtn = root.querySelector("#playerMailSendBtn");
  if (sendBtn) {
    sendBtn.onclick = async () => {
      if (_playerMailBusy) return;
      const toName = String(_playerMailToName || "").trim();
      if (!toName) {
        if (typeof toast === "function") toast("Укажи имя персонажа", "warn");
        return;
      }
      let payload = { toName };
      if (_playerMailSendTab === "gear") {
        if (!_playerMailPickUid) return;
        payload.kind = "weapon";
        payload.uid = _playerMailPickUid;
      } else {
        const parsed = playerMailParseStackKey(_playerMailStackKey);
        if (!parsed) return;
        const stacks = playerMailStackOptions();
        const sel = stacks.find((s) => playerMailStackKeyOf(s) === _playerMailStackKey);
        if (!sel) return;
        const qty = Math.max(1, Math.min(sel.max, Math.floor(Number(_playerMailStackQty) || 1)));
        payload = Object.assign(payload, parsed, { qty });
      }
      Audio2.click();
      _playerMailBusy = true;
      let ok = false;
      try {
        const r = await playerMailSendPayload(payload);
        if (!r.ok) {
          if (typeof toast === "function") toast(r.error || "Не удалось", "warn");
          return;
        }
        if (typeof toast === "function") {
          toast("Почта → " + (r.parcel?.recipientName || toName), "success");
        }
        _playerMailPickUid = null;
        _playerMailStackKey = "";
        _playerMailStackQty = 1;
        _playerMailToName = "";
        ok = true;
      } finally {
        _playerMailBusy = false;
      }
      if (ok) {
        await refreshPlayerMailLists();
        if (typeof renderInventory === "function") renderInventory();
      }
    };
  }
}

function wirePlayerMail() {
  const tile = document.getElementById("playerMailTile");
  if (tile && !tile.dataset.wired) {
    tile.dataset.wired = "1";
    tile.onclick = () => openPlayerMail();
  }
  startPlayerMailBadgePoll();
}
