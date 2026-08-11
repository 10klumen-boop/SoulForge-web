// ===== Чат: каналы Мир / Торговля / Группа / Клан / Шепот =====

const CHAT_POLL_MS = 3000;
const CHAT_COLLAPSE_KEY = "sf-chat-collapsed";
const CHAT_CHANNEL_KEY = "sf-chat-channel";
const CHAT_SIZE_KEY = "sf-chat-size";
const CHAT_MAX_LEN = 200;
const CHAT_SIZE_MIN_W = 260;
const CHAT_SIZE_MAX_W = 560;
const CHAT_SIZE_MIN_H = 280;
const CHAT_SIZE_DEFAULT = { w: 300, h: 360 };

const CHAT_CHANNELS = [
  { id: "world", label: "Мир", short: "Мир" },
  { id: "trade", label: "Торговля", short: "Торг" },
  { id: "party", label: "Группа", short: "Гр." },
  { id: "clan", label: "Клан", short: "Клан" },
  { id: "whisper", label: "Шёпот", short: "ЛС" },
];

let chatActiveChannel = "world";
let chatLastIdByChannel = Object.create(null);
let chatKnownIdsByChannel = Object.create(null);
let chatUnreadByChannel = Object.create(null);
let chatPollTimer = null;
let chatBusy = false;
let chatUnread = 0;
let chatSocial = { party: null, clan: null };
let chatCanSend = true;
let chatWhisperTarget = "";
let chatBootstrapped = Object.create(null);

function chatPanelEl() {
  return document.getElementById("gameChatPanel");
}

function isChatNarrowViewport() {
  try {
    return !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
  } catch (_) {
    return false;
  }
}

/** Активный DOM-маунт: экран чата (телефон или плитка) либо сайдбар на ПК. */
function chatUiEls() {
  if (isChatNarrowViewport() || isChatScreenOpen()) {
    return {
      title: document.getElementById("screenChatTitle"),
      channels: document.getElementById("screenChatChannels"),
      social: document.getElementById("screenChatSocial"),
      toWrap: document.getElementById("screenChatToWrap"),
      toNick: document.getElementById("screenChatToNick"),
      status: document.getElementById("screenChatStatus"),
      feed: document.getElementById("screenChatFeed"),
      form: document.getElementById("screenChatForm"),
      input: document.getElementById("screenChatInput"),
      send: document.getElementById("screenChatSend"),
    };
  }
  return {
    title: document.getElementById("gameChatTitle"),
    channels: document.getElementById("gameChatChannels"),
    social: document.getElementById("gameChatSocial"),
    toWrap: document.getElementById("gameChatToWrap"),
    toNick: document.getElementById("gameChatToNick"),
    status: document.getElementById("gameChatStatus"),
    feed: document.getElementById("gameChatFeed"),
    form: document.getElementById("gameChatForm"),
    input: document.getElementById("gameChatInput"),
    send: document.getElementById("gameChatSend"),
  };
}

function isChatScreenOpen() {
  return !!document.getElementById("screen-chat")?.classList.contains("active");
}

/** Чат «открыт» для unread/scroll: экран на мобилке или развёрнутая панель на ПК. */
function isChatUiOpen() {
  if (isChatScreenOpen()) return true;
  if (isChatNarrowViewport()) return false;
  return !isChatCollapsed();
}

function isChatCollapsed() {
  const panel = chatPanelEl();
  return !!(panel && panel.classList.contains("is-collapsed"));
}

function saveChatCollapsed(collapsed) {
  try {
    localStorage.setItem(CHAT_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch (_) {}
}

function loadChatCollapsed() {
  try {
    const raw = localStorage.getItem(CHAT_COLLAPSE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch (_) {}
  return true;
}

function clampChatSize(size) {
  const maxW = Math.min(CHAT_SIZE_MAX_W, Math.max(CHAT_SIZE_MIN_W, window.innerWidth - 32));
  const maxH = Math.max(CHAT_SIZE_MIN_H, window.innerHeight - 48);
  const w = Math.round(Math.min(maxW, Math.max(CHAT_SIZE_MIN_W, Number(size?.w) || CHAT_SIZE_DEFAULT.w)));
  const h = Math.round(Math.min(maxH, Math.max(CHAT_SIZE_MIN_H, Number(size?.h) || CHAT_SIZE_DEFAULT.h)));
  return { w, h };
}

function loadChatSize() {
  try {
    const raw = localStorage.getItem(CHAT_SIZE_KEY);
    if (raw) return clampChatSize(JSON.parse(raw));
  } catch (_) {}
  return clampChatSize(CHAT_SIZE_DEFAULT);
}

function saveChatSize(size) {
  const next = clampChatSize(size);
  try {
    localStorage.setItem(CHAT_SIZE_KEY, JSON.stringify(next));
  } catch (_) {}
  return next;
}

function applyChatSize(size) {
  const body = document.getElementById("gameChatBody");
  if (!body) return;
  const next = clampChatSize(size || loadChatSize());
  body.style.setProperty("--chat-w", next.w + "px");
  body.style.setProperty("--chat-h", next.h + "px");
  return next;
}

function loadChatChannel() {
  try {
    const raw = localStorage.getItem(CHAT_CHANNEL_KEY);
    if (CHAT_CHANNELS.some((c) => c.id === raw)) return raw;
  } catch (_) {}
  return "world";
}

function saveChatChannel(id) {
  try {
    localStorage.setItem(CHAT_CHANNEL_KEY, id);
  } catch (_) {}
}

function chatChannelMeta(id) {
  return CHAT_CHANNELS.find((c) => c.id === id) || CHAT_CHANNELS[0];
}

function totalChatUnread() {
  return Object.values(chatUnreadByChannel).reduce((s, n) => s + (Number(n) || 0), 0);
}

function syncChatMenuTileBadge() {
  const badge = document.getElementById("chatTileBadge");
  const meta = document.getElementById("chatTileMeta");
  const n = totalChatUnread();
  if (badge) {
    if (n <= 0) {
      badge.hidden = true;
      badge.textContent = "0";
    } else {
      badge.hidden = false;
      badge.textContent = n > 99 ? "99+" : String(n);
    }
  }
  if (meta) {
    const ch = chatChannelMeta(chatActiveChannel);
    meta.textContent = ch ? ch.short || ch.label : "Мир";
  }
}

function updateChatBadge() {
  const badge = document.getElementById("gameChatBadge");
  chatUnread = totalChatUnread();
  if (badge) {
    if (isChatUiOpen() || chatUnread <= 0) {
      badge.hidden = true;
      badge.textContent = "0";
    } else {
      badge.hidden = false;
      badge.textContent = chatUnread > 99 ? "99+" : String(chatUnread);
    }
  }
  syncChatMenuTileBadge();
}

function updateChatTabBadges() {
  document.querySelectorAll(".game-chat-chan[data-channel]").forEach((btn) => {
    const ch = btn.dataset.channel;
    const n = Number(chatUnreadByChannel[ch] || 0);
    let mark = btn.querySelector(".game-chat-chan-badge");
    if (n <= 0) {
      if (mark) mark.hidden = true;
      return;
    }
    if (!mark) {
      mark = document.createElement("span");
      mark.className = "game-chat-chan-badge";
      btn.appendChild(mark);
    }
    mark.hidden = false;
    mark.textContent = n > 9 ? "9+" : String(n);
  });
  updateChatBadge();
}

function setChatCollapsed(collapsed) {
  const panel = chatPanelEl();
  const toggle = document.getElementById("gameChatToggle");
  if (!panel) return;
  panel.classList.toggle("is-collapsed", !!collapsed);
  if (toggle) toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  saveChatCollapsed(!!collapsed);
  if (!collapsed) {
    if (!isChatNarrowViewport() && !isChatScreenOpen()) {
      const ch = chatActiveChannel;
      chatKnownIdsByChannel[ch] = new Set();
      chatBootstrapped[ch] = false;
      chatLastIdByChannel[ch] = 0;
      const desk = document.getElementById("gameChatFeed");
      if (desk) desk.innerHTML = "";
    }
    chatUnreadByChannel[chatActiveChannel] = 0;
    updateChatTabBadges();
    syncChatChannelTabs();
    syncChatComposeUi();
    scrollChatFeedToEnd();
    if (typeof chatPollNow === "function") chatPollNow();
  }
  refreshChatPolling();
}

function toggleGameChat() {
  if (isChatNarrowViewport()) {
    if (isChatScreenOpen()) {
      if (typeof show === "function") show("menu");
    } else {
      openChatScreen();
    }
    return;
  }
  setChatCollapsed(!isChatCollapsed());
}

function openChatScreen() {
  if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  const ch = chatActiveChannel;
  chatKnownIdsByChannel[ch] = new Set();
  chatBootstrapped[ch] = false;
  chatLastIdByChannel[ch] = 0;
  const mob = document.getElementById("screenChatFeed");
  if (mob) mob.innerHTML = "";
  chatUnreadByChannel[ch] = 0;
  if (typeof show === "function") show("chat");
  syncChatChannelTabs();
  syncChatComposeUi();
  updateChatTabBadges();
  const input = chatUiEls().input;
  if (input) {
    setTimeout(() => {
      try {
        input.focus();
      } catch (_) {}
    }, 60);
  }
}

function onChatViewportChange() {
  const ch = chatActiveChannel;
  chatKnownIdsByChannel[ch] = new Set();
  chatBootstrapped[ch] = false;
  chatLastIdByChannel[ch] = 0;
  const desk = document.getElementById("gameChatFeed");
  const mob = document.getElementById("screenChatFeed");
  if (desk) desk.innerHTML = "";
  if (mob) mob.innerHTML = "";
  syncChatChannelTabs();
  syncChatComposeUi();
  if (typeof refreshChatPolling === "function") refreshChatPolling();
}

function scrollChatFeedToEnd() {
  const feed = chatUiEls().feed;
  if (feed) feed.scrollTop = feed.scrollHeight;
}

function chatActiveCharName() {
  return (state.avatar && state.avatar.name) || null;
}

function chatMyNick() {
  return (typeof getCloudNick === "function" && getCloudNick()) || readCloudAuth()?.nick || null;
}

function chatCanUse() {
  return typeof cloudEnabled === "function" && cloudEnabled() && !!readCloudAuth()?.token;
}

function chatFormatTime(ts) {
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  } catch (_) {
    return "";
  }
}

function clearChatFeed() {
  const feed = chatUiEls().feed;
  if (feed) feed.innerHTML = "";
}

function ensureKnownSet(channel) {
  if (!chatKnownIdsByChannel[channel]) chatKnownIdsByChannel[channel] = new Set();
  return chatKnownIdsByChannel[channel];
}

function appendChatMessage(msg, opts) {
  const channel = msg.channel || chatActiveChannel;
  if (channel !== chatActiveChannel) return;
  const feed = chatUiEls().feed;
  if (!feed || !msg || msg.id == null) return;
  const known = ensureKnownSet(channel);
  if (known.has(msg.id)) return;
  known.add(msg.id);
  if (known.size > 400) {
    chatKnownIdsByChannel[channel] = new Set([...known].slice(-200));
  }

  const isAnnounce = msg.msgType === "announce" || msg.msg_type === "announce";
  const row = document.createElement("div");
  const mine = !isAnnounce && !!(msg.nick && msg.nick === chatMyNick());
  row.className =
    "game-chat-line ch-" +
    channel +
    (mine ? " is-mine" : "") +
    (isAnnounce ? " is-announce" : "");
  row.dataset.id = String(msg.id);

  const meta = document.createElement("div");
  meta.className = "game-chat-meta";
  const who = document.createElement("button");
  who.type = "button";
  who.className = "game-chat-who" + (isAnnounce ? " is-system" : "");
  if (isAnnounce) {
    who.textContent = "★ Мир";
    who.title = "Мировое оповещение";
    who.disabled = true;
  } else {
    const display = msg.charName || msg.nick || "?";
    who.textContent = display;
    who.title = msg.nick ? "ЛС → " + msg.nick : display;
    who.addEventListener("click", () => {
      if (!msg.nick || msg.nick === chatMyNick()) return;
      setChatWhisperTarget(msg.nick);
      setChatChannel("whisper");
    });
  }

  if (!isAnnounce && channel === "whisper") {
    const me = chatMyNick();
    const arrow = document.createElement("span");
    arrow.className = "game-chat-whisper-dir";
    if (msg.nick === me) arrow.textContent = " → " + (msg.targetNick || "?");
    else arrow.textContent = " → вам";
    who.appendChild(arrow);
  }

  const time = document.createElement("span");
  time.className = "game-chat-time";
  time.textContent = chatFormatTime(msg.createdAt);
  meta.appendChild(who);
  meta.appendChild(time);

  const body = document.createElement("div");
  body.className = "game-chat-body-text";
  body.textContent = msg.body || "";

  row.appendChild(meta);
  row.appendChild(body);
  feed.appendChild(row);

  while (feed.children.length > 120) {
    const first = feed.firstElementChild;
    if (!first) break;
    const id = Number(first.dataset.id);
    if (id) ensureKnownSet(channel).delete(id);
    feed.removeChild(first);
  }

  if (opts?.scroll !== false) scrollChatFeedToEnd();
}

/**
 * Мировое оповещение о редком событии (нужен cloud-логин).
 * Текст собирает сервер; fire-and-forget.
 * @param {"enchant_high"|"banan_zaken"|"banan_adena"|"casino_jackpot"} type
 * @param {object} [payload]
 */
function announceWorldEvent(type, payload) {
  if (!chatCanUse()) return { ok: false, skipped: "auth" };
  const t = String(type || "").trim();
  if (!t) return { ok: false, skipped: "type" };
  chatApi("/chat/announce", {
    method: "POST",
    body: {
      type: t,
      payload: payload && typeof payload === "object" ? payload : {},
      charName: chatActiveCharName(),
    },
  })
    .then((r) => {
      if (r && r.ok && r.message) {
        const id = Number(r.message.id) || 0;
        if (id > (chatLastIdByChannel.world || 0)) chatLastIdByChannel.world = id;
        chatBootstrapped.world = true;
        // Сразу показать себе, не дожидаясь poll
        if (chatActiveChannel === "world") {
          appendChatMessage(r.message, { scroll: isChatUiOpen() });
        } else {
          chatUnreadByChannel.world = (chatUnreadByChannel.world || 0) + 1;
          updateChatTabBadges();
        }
      }
    })
    .catch(() => {});
  return { ok: true, queued: true };
}

function setChatStatus(text, kind) {
  const el = chatUiEls().status;
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
  el.classList.toggle("is-warn", kind === "warn");
}

function setChatWhisperTarget(nick) {
  chatWhisperTarget = String(nick || "").trim();
  const desk = document.getElementById("gameChatToNick");
  const mob = document.getElementById("screenChatToNick");
  if (desk) desk.value = chatWhisperTarget;
  if (mob) mob.value = chatWhisperTarget;
  syncChatComposeUi();
}

function syncChatComposeUi() {
  const ui = chatUiEls();
  const toWrap = ui.toWrap;
  const social = ui.social;
  const input = ui.input;
  const send = ui.send;
  const ch = chatActiveChannel;

  if (toWrap) toWrap.hidden = ch !== "whisper";
  if (social) {
    if (ch === "party" || ch === "clan") {
      social.hidden = false;
      renderChatSocialBar();
    } else {
      social.hidden = true;
      social.innerHTML = "";
    }
  }

  let placeholder = "Сообщение…";
  if (ch === "whisper") placeholder = "Текст шёпота…";
  else if (ch === "trade") placeholder = "Торговое объявление…";
  else if (ch === "party") placeholder = chatSocial.party ? "В группу…" : "Нужна группа";
  else if (ch === "clan") placeholder = chatSocial.clan ? "В клан…" : "Нужен клан";
  if (input) {
    input.placeholder = placeholder;
    input.disabled = !chatCanSend && (ch === "party" || ch === "clan");
  }
  if (send) send.disabled = !!(input && input.disabled);
}

function renderChatSocialBar() {
  const social = chatUiEls().social;
  if (!social) return;
  const ch = chatActiveChannel;
  social.innerHTML = "";

  if (ch === "party") {
    if (!chatSocial.party) {
      social.innerHTML =
        '<span class="game-chat-social-hint">Группа — плитка «Группа» в меню</span>';
    } else {
      const names = (chatSocial.party.members || [])
        .map((m) => m.name || m.charName || m.nick)
        .join(", ");
      social.innerHTML =
        '<span class="game-chat-social-meta">Группа · ' +
        names +
        "</span>" +
        '<span class="game-chat-social-hint">управление — меню «Группа»</span>';
    }
  } else if (ch === "clan") {
    if (!chatSocial.clan) {
      social.innerHTML =
        '<span class="game-chat-social-hint">Клан — плитка «Клан» в меню</span>';
    } else {
      const n = (chatSocial.clan.members || []).length;
      social.innerHTML =
        '<span class="game-chat-social-meta">' +
        (chatSocial.clan.name || "Клан") +
        " · " +
        n +
        "</span>" +
        '<span class="game-chat-social-hint">управление — меню «Клан»</span>';
    }
  }

  social.querySelectorAll("[data-act]:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => handleChatSocialAction(btn.dataset.act));
  });
}

async function chatApi(path, opts) {
  const method = opts?.method || "GET";
  const res = await fetch(cloudApiUrl(path), {
    method,
    headers: authHeaders(method !== "GET"),
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data.error || data.message || "Ошибка",
      ...data,
    };
  }
  return { ok: true, ...data };
}

async function handleChatSocialAction(act) {
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (act === "party-create") {
    if (typeof openPartyScreen === "function") return openPartyScreen();
    if (typeof partyCreate === "function") return partyCreate();
    return setChatStatus("Открой меню «Группа»", "warn");
  }
  if (act === "party-leave") {
    if (typeof partyLeave === "function") return partyLeave();
    const r = await chatApi("/chat/party/leave", { method: "POST", body: {} });
    if (!r.ok) return setChatStatus(r.error, "warn");
    chatSocial = { party: null, clan: r.clan || chatSocial.clan };
    chatCanSend = false;
    clearChatFeed();
    chatLastIdByChannel.party = 0;
    chatKnownIdsByChannel.party = new Set();
    chatBootstrapped.party = false;
    syncChatComposeUi();
    if (typeof renderPartyPanel === "function") renderPartyPanel();
    setChatStatus("Вы покинули группу");
    return;
  }
  if (act === "party-invite" || act === "party-kick") {
    if (typeof openPartyScreen === "function") return openPartyScreen();
    return setChatStatus("Приглашение — в меню «Группа»", "warn");
  }
  if (act === "clan-create" || act === "clan-invite" || act === "clan-leave") {
    if (typeof openClanScreen === "function") return openClanScreen();
    return setChatStatus("Управление кланом — в меню «Клан»", "warn");
  }
}

function setChatChannel(id) {
  if (!CHAT_CHANNELS.some((c) => c.id === id)) return;
  chatActiveChannel = id;
  saveChatChannel(id);
  chatUnreadByChannel[id] = 0;
  clearChatFeed();
  chatLastIdByChannel[id] = 0;
  chatKnownIdsByChannel[id] = new Set();
  chatBootstrapped[id] = false;
  setChatStatus("");
  syncChatChannelTabs();
  syncChatComposeUi();
  updateChatTabBadges();
  chatPollNow();
}

function syncChatChannelTabs() {
  const meta = chatChannelMeta(chatActiveChannel);
  const deskTitle = document.getElementById("gameChatTitle");
  const screenTitle = document.getElementById("screenChatTitle");
  if (deskTitle) deskTitle.textContent = meta.label;
  if (screenTitle) screenTitle.textContent = meta.label;
  document.querySelectorAll(".game-chat-chan[data-channel]").forEach((btn) => {
    btn.classList.toggle("sel", btn.dataset.channel === chatActiveChannel);
  });
  syncChatMenuTileBadge();
}

async function chatFetchMessages(channel, after) {
  if (!chatCanUse()) return { ok: false, offline: true };
  const q =
    "?channel=" +
    encodeURIComponent(channel) +
    (after > 0 ? "&after=" + after : "") +
    "&limit=" +
    (after > 0 ? "80" : "60");
  return chatApi("/chat/messages" + q);
}

function bumpUnread(channel, count) {
  if (!count) return;
  if (channel === chatActiveChannel && isChatUiOpen()) return;
  chatUnreadByChannel[channel] = (chatUnreadByChannel[channel] || 0) + count;
}

async function chatPollChannel(channel, opts) {
  const after = chatBootstrapped[channel] ? chatLastIdByChannel[channel] || 0 : 0;
  const r = await chatFetchMessages(channel, after);
  if (!r.ok) return r;

  const list = Array.isArray(r.messages) ? r.messages : [];
  const wasBoot = !!chatBootstrapped[channel];
  let newCount = 0;

  for (const msg of list) {
    const id = Number(msg.id) || 0;
    if (id > (chatLastIdByChannel[channel] || 0)) chatLastIdByChannel[channel] = id;
    msg.channel = channel;
    if (channel === chatActiveChannel && opts?.render !== false) {
      appendChatMessage(msg, { scroll: opts?.scroll !== false && isChatUiOpen() });
    }
    if (wasBoot) newCount += 1;
  }

  if (!chatBootstrapped[channel]) {
    chatBootstrapped[channel] = true;
    if (!chatLastIdByChannel[channel] && r.latestId) {
      chatLastIdByChannel[channel] = Number(r.latestId) || 0;
    }
  } else {
    bumpUnread(channel, newCount);
  }

  return { ...r, newCount };
}

async function chatPollNow() {
  if (chatBusy || !chatCanUse()) return;
  chatBusy = true;
  try {
    const active = await chatPollChannel(chatActiveChannel, { render: true, scroll: true });
    if (!active.ok) {
      if (active.status === 401) setChatStatus("Нужен вход в аккаунт", "warn");
    } else {
      // Не затираем ready: чат-полл раньше отдавал party без флагов → Ready мигал
      const prevParty = chatSocial && chatSocial.party;
      let nextParty = active.party || null;
      if (nextParty && prevParty && prevParty.id === nextParty.id) {
        const prevReady = new Map(
          (prevParty.members || []).map((m) => [m.userId, !!m.ready])
        );
        nextParty = {
          ...nextParty,
          members: (nextParty.members || []).map((m) => ({
            ...m,
            ready:
              typeof m.ready === "boolean" ? m.ready : !!prevReady.get(m.userId),
          })),
        };
      }
      chatSocial = { party: nextParty, clan: active.clan || null };
      chatCanSend = active.canSend !== false;
      if (active.reason === "no_party") {
        setChatStatus("Нет группы — меню «Группа»", "warn");
      } else if (active.reason === "no_clan") {
        setChatStatus("Нет клана — создайте или попросите приглашение", "warn");
      } else {
        setChatStatus("");
      }
      syncChatComposeUi();
      if (typeof clanHydrateWorldState === "function") clanHydrateWorldState(false);
      // Полный re-render панели группы только с party-полла — иначе Ready/вкладки мигают
    }

    // Фоновые каналы — только для бейджей
    for (const ch of CHAT_CHANNELS) {
      if (ch.id === chatActiveChannel) continue;
      await chatPollChannel(ch.id, { render: false });
    }
    updateChatTabBadges();
  } catch (_) {
    /* сеть */
  } finally {
    chatBusy = false;
  }
}

async function chatSendMessage(text) {
  if (!chatCanUse()) {
    setChatStatus("Нужен вход в аккаунт", "warn");
    return { ok: false };
  }
  let body = String(text || "").trim().slice(0, CHAT_MAX_LEN);
  if (!body) return { ok: false };

  let channel = chatActiveChannel;
  let toNick = "";
  const whisperCmd = /^\/(?:w|whisper)\s+([a-zA-Z]{2,16})\s+(.+)$/is.exec(body);
  if (whisperCmd) {
    channel = "whisper";
    toNick = whisperCmd[1];
    body = whisperCmd[2].trim().slice(0, CHAT_MAX_LEN);
    setChatWhisperTarget(toNick);
    if (chatActiveChannel !== "whisper") setChatChannel("whisper");
  } else if (channel === "whisper") {
    const toEl = chatUiEls().toNick;
    toNick = (toEl?.value || chatWhisperTarget || "").trim();
    if (!toNick) {
      setChatStatus("Укажите ник для шёпота", "warn");
      return { ok: false };
    }
  }

  try {
    const r = await chatApi("/chat/messages", {
      method: "POST",
      body: {
        channel,
        body,
        charName: chatActiveCharName(),
        toNick: toNick || undefined,
      },
    });
    if (!r.ok) {
      setChatStatus(r.error || "Не удалось отправить", "warn");
      return { ok: false };
    }
    if (r.message) {
      const ch = r.message.channel || channel;
      const id = Number(r.message.id) || 0;
      if (id > (chatLastIdByChannel[ch] || 0)) chatLastIdByChannel[ch] = id;
      chatBootstrapped[ch] = true;
      if (ch === chatActiveChannel) appendChatMessage(r.message, { scroll: true });
    }
    setChatStatus("");
    return { ok: true };
  } catch (_) {
    setChatStatus("Нет связи с сервером", "warn");
    return { ok: false };
  }
}

function stopChatPolling() {
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
}

function refreshChatPolling() {
  stopChatPolling();
  if (!chatCanUse()) return;
  if (typeof isInCharacterSession === "function" && !isInCharacterSession()) return;
  chatPollNow();
  chatPollTimer = setInterval(() => chatPollNow(), CHAT_POLL_MS);
}
