// ===== UI: почта игроков (отдельный экран меню) =====

let _playerMailPickUid = null;
let _playerMailBusy = false;
let _playerMailInbox = [];
let _playerMailOutbox = [];
let _playerMailUnread = 0;
let _playerMailToName = "";
let _playerMailSendTab = "gear"; // gear | stack
let _playerMailStackKey = ""; // "adena" | "crystal:D" | "material:soul" | "shot:soul:D"
let _playerMailStackQty = 1;

function playerMailBadgeCount() {
  return Math.max(0, _playerMailUnread | 0);
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

  const mailN = playerMailBadgeCount();
  const badge = document.getElementById("playerMailHeadBadge");
  if (badge) {
    badge.hidden = mailN <= 0;
    badge.textContent = String(mailN);
  }

  body.innerHTML = renderPlayerMailHtml();
  wirePlayerMailUi(body);
}

async function refreshPlayerMailLists() {
  if (typeof playerMailIsLoggedIn !== "function" || !playerMailIsLoggedIn()) {
    _playerMailInbox = [];
    _playerMailOutbox = [];
    _playerMailUnread = 0;
    if (typeof state !== "undefined" && document.getElementById("screen-player-mail")?.classList.contains("active")) {
      renderPlayerMail();
    }
    if (typeof renderMenu === "function") renderMenu();
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
  if (document.getElementById("screen-player-mail")?.classList.contains("active")) {
    renderPlayerMail();
  }
  if (typeof renderMenu === "function") renderMenu();
}

function playerMailStackKeyOf(st) {
  if (!st) return "";
  if (st.kind === "adena") return "adena";
  if (st.kind === "crystal") return "crystal:" + st.grade;
  if (st.kind === "material") return "material:" + st.ore;
  if (st.kind === "shot") return "shot:" + st.shotKind + ":" + st.grade;
  return "";
}

function playerMailParseStackKey(key) {
  if (!key) return null;
  if (key === "adena") return { kind: "adena" };
  const parts = String(key).split(":");
  if (parts[0] === "crystal") return { kind: "crystal", grade: parts[1] };
  if (parts[0] === "material") return { kind: "material", ore: parts[1] };
  if (parts[0] === "shot") return { kind: "shot", shotKind: parts[1], grade: parts[2] };
  return null;
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
        '"' +
        (_playerMailBusy ? " disabled" : "") +
        ">Забрать</button>" +
        "</div>";
    });
    html += "</div>";
  }
  html += "</section>";

  html +=
    '<section class="account-mail-section">' +
    "<h3>Отправить</h3>" +
    '<p class="account-storage-hint">Экип, адена, кристаллы, руда или заряды → уникальное имя персонажа.</p>';

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
    const stacks = typeof playerMailStackOptions === "function" ? playerMailStackOptions() : [];
    const sel = stacks.find((s) => playerMailStackKeyOf(s) === _playerMailStackKey) || null;
    const max = sel ? sel.max : 0;
    if (sel) {
      _playerMailStackQty = Math.max(1, Math.min(max, Math.floor(Number(_playerMailStackQty) || 1)));
    }
    canSend = !!sel && _playerMailStackQty >= 1 && !!String(_playerMailToName || "").trim();
    html += '<div class="account-mail-stack-list">';
    if (!stacks.length) html += '<p class="account-storage-empty">Нет адены / стеков</p>';
    else {
      stacks.forEach((st) => {
        const key = playerMailStackKeyOf(st);
        html +=
          '<button type="button" class="account-mail-stack-row' +
          (_playerMailStackKey === key ? " sel" : "") +
          '" data-mail-stack="' +
          key +
          '">' +
          st.label +
          "</button>";
      });
    }
    html += "</div>";
    if (sel) {
      html +=
        '<div class="account-mail-qty-row">' +
        '<label>Кол-во</label>' +
        '<input type="number" id="playerMailStackQty" min="1" max="' +
        max +
        '" value="' +
        _playerMailStackQty +
        '">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-mail-qty-max>всё</button>' +
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
        '<button type="button" class="btn" data-cancel-mail="' +
        m.id +
        '"' +
        (_playerMailBusy ? " disabled" : "") +
        ">Вернуть</button>" +
        "</div>";
    });
    html += "</div>";
  }
  html += "</section>";
  return html;
}

function wirePlayerMailUi(root) {
  root.querySelectorAll("[data-claim-mail]").forEach((btn) => {
    btn.onclick = async () => {
      if (_playerMailBusy) return;
      Audio2.click();
      _playerMailBusy = true;
      try {
        const r = await playerMailClaim(btn.dataset.claimMail);
        if (!r.ok) {
          if (typeof toast === "function") toast(r.error || "Не удалось", "warn");
          return;
        }
        if (typeof toast === "function") toast("Получено: " + playerMailParcelLabel(r.parcel), "success");
        _playerMailPickUid = null;
        await refreshPlayerMailLists();
        if (typeof renderInventory === "function") renderInventory();
        if (typeof renderMenu === "function") renderMenu();
      } finally {
        _playerMailBusy = false;
      }
    };
  });
  root.querySelectorAll("[data-cancel-mail]").forEach((btn) => {
    btn.onclick = async () => {
      if (_playerMailBusy) return;
      Audio2.click();
      _playerMailBusy = true;
      try {
        const r = await playerMailCancel(btn.dataset.cancelMail);
        if (!r.ok) {
          if (typeof toast === "function") toast(r.error || "Не удалось", "warn");
          return;
        }
        if (typeof toast === "function") toast("Письмо возвращено", "success");
        await refreshPlayerMailLists();
        if (typeof renderInventory === "function") renderInventory();
        if (typeof renderMenu === "function") renderMenu();
      } finally {
        _playerMailBusy = false;
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
      _playerMailStackQty = 1;
      const nameEl = document.getElementById("playerMailToName");
      if (nameEl) _playerMailToName = nameEl.value;
      renderPlayerMail();
    };
  });
  const qtyInput = root.querySelector("#playerMailStackQty");
  if (qtyInput) {
    qtyInput.oninput = () => {
      _playerMailStackQty = Math.max(1, Math.floor(Number(qtyInput.value) || 1));
    };
  }
  root.querySelectorAll("[data-mail-qty-max]").forEach((btn) => {
    btn.onclick = () => {
      const stacks = playerMailStackOptions();
      const sel = stacks.find((s) => playerMailStackKeyOf(s) === _playerMailStackKey);
      if (!sel) return;
      _playerMailStackQty = sel.max;
      if (qtyInput) qtyInput.value = String(sel.max);
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
        await refreshPlayerMailLists();
        if (typeof renderInventory === "function") renderInventory();
        if (typeof renderMenu === "function") renderMenu();
      } finally {
        _playerMailBusy = false;
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
}
