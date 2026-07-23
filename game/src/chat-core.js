// ===== Чат: каналы Мир / Торговля / Группа / Клан / Шепот =====

const CHAT_POLL_MS = 3000;
const CHAT_COLLAPSE_KEY = "sf-chat-collapsed";
const CHAT_MOBILE_KEY = "sf-chat-mobile";
const CHAT_CHANNEL_KEY = "sf-chat-channel";
const CHAT_MAX_LEN = 200;

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

function isChatMobileEnabled() {
  try {
    return localStorage.getItem(CHAT_MOBILE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function setChatMobileEnabled(on) {
  try {
    localStorage.setItem(CHAT_MOBILE_KEY, on ? "1" : "0");
  } catch (_) {}
  document.body.classList.toggle("sf-chat-mobile", !!on);
  syncChatMobileSettingUi();
  if (typeof refreshChatPolling === "function") refreshChatPolling();
}

function syncChatMobileSettingUi() {
  const btn = document.getElementById("settChatMobile");
  if (!btn) return;
  const on = isChatMobileEnabled();
  btn.textContent = on ? "Вкл" : "Выкл";
  btn.classList.toggle("on", on);
}

function applyChatMobilePreference() {
  document.body.classList.toggle("sf-chat-mobile", isChatMobileEnabled());
  syncChatMobileSettingUi();
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

function updateChatBadge() {
  const badge = document.getElementById("gameChatBadge");
  chatUnread = totalChatUnread();
  if (!badge) return;
  if (!isChatCollapsed() || chatUnread <= 0) {
    badge.hidden = true;
    badge.textContent = "0";
    return;
  }
  badge.hidden = false;
  badge.textContent = chatUnread > 99 ? "99+" : String(chatUnread);
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
    chatUnreadByChannel[chatActiveChannel] = 0;
    updateChatTabBadges();
    scrollChatFeedToEnd();
    if (typeof chatPollNow === "function") chatPollNow();
  }
  refreshChatPolling();
}

function toggleGameChat() {
  setChatCollapsed(!isChatCollapsed());
}

function scrollChatFeedToEnd() {
  const feed = document.getElementById("gameChatFeed");
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
  const feed = document.getElementById("gameChatFeed");
  if (feed) feed.innerHTML = "";
}

function ensureKnownSet(channel) {
  if (!chatKnownIdsByChannel[channel]) chatKnownIdsByChannel[channel] = new Set();
  return chatKnownIdsByChannel[channel];
}

function appendChatMessage(msg, opts) {
  const channel = msg.channel || chatActiveChannel;
  if (channel !== chatActiveChannel) return;
  const feed = document.getElementById("gameChatFeed");
  if (!feed || !msg || msg.id == null) return;
  const known = ensureKnownSet(channel);
  if (known.has(msg.id)) return;
  known.add(msg.id);
  if (known.size > 400) {
    chatKnownIdsByChannel[channel] = new Set([...known].slice(-200));
  }

  const row = document.createElement("div");
  const mine = !!(msg.nick && msg.nick === chatMyNick());
  row.className = "game-chat-line ch-" + channel + (mine ? " is-mine" : "");
  row.dataset.id = String(msg.id);

  const meta = document.createElement("div");
  meta.className = "game-chat-meta";
  const who = document.createElement("button");
  who.type = "button";
  who.className = "game-chat-who";
  const display = msg.charName || msg.nick || "?";
  who.textContent = display;
  who.title = msg.nick ? "ЛС → " + msg.nick : display;
  who.addEventListener("click", () => {
    if (!msg.nick || msg.nick === chatMyNick()) return;
    setChatWhisperTarget(msg.nick);
    setChatChannel("whisper");
  });

  if (channel === "whisper") {
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

function setChatStatus(text, kind) {
  const el = document.getElementById("gameChatStatus");
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
  el.classList.toggle("is-warn", kind === "warn");
}

function setChatWhisperTarget(nick) {
  chatWhisperTarget = String(nick || "").trim();
  const input = document.getElementById("gameChatToNick");
  if (input) input.value = chatWhisperTarget;
  syncChatComposeUi();
}

function syncChatComposeUi() {
  const toWrap = document.getElementById("gameChatToWrap");
  const social = document.getElementById("gameChatSocial");
  const input = document.getElementById("gameChatInput");
  const send = document.getElementById("gameChatSend");
  const ch = chatActiveChannel;

  if (toWrap) toWrap.hidden = ch !== "whisper";
  if (social) {
    social.hidden = ch !== "party" && ch !== "clan";
    if (!social.hidden) renderChatSocialBar();
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
  const social = document.getElementById("gameChatSocial");
  if (!social) return;
  const ch = chatActiveChannel;
  const myNick = chatMyNick();
  social.innerHTML = "";

  if (ch === "party") {
    if (!chatSocial.party) {
      social.innerHTML =
        '<button type="button" class="game-chat-social-btn" data-act="party-create">Создать группу</button>' +
        '<span class="game-chat-social-hint">лидер приглашает по нику аккаунта</span>';
    } else {
      const names = (chatSocial.party.members || []).map((m) => m.nick).join(", ");
      const leader = (chatSocial.party.members || []).find((m) => m.userId === chatSocial.party.leaderUserId);
      const amLeader = !!(leader && leader.nick === myNick);
      social.innerHTML =
        '<span class="game-chat-social-meta">Группа · ' +
        names +
        "</span>" +
        (amLeader
          ? '<button type="button" class="game-chat-social-btn" data-act="party-invite">+ Ник</button>'
          : "") +
        '<button type="button" class="game-chat-social-btn ghost" data-act="party-leave">Выйти</button>';
    }
  } else if (ch === "clan") {
    if (!chatSocial.clan) {
      social.innerHTML =
        '<button type="button" class="game-chat-social-btn" data-act="clan-create">Создать клан</button>' +
        '<span class="game-chat-social-hint">имя 3–24 · лидер приглашает по нику</span>';
    } else {
      const leader = (chatSocial.clan.members || []).find((m) => m.userId === chatSocial.clan.leaderUserId);
      const amLeader = !!(leader && leader.nick === myNick);
      const n = (chatSocial.clan.members || []).length;
      social.innerHTML =
        '<span class="game-chat-social-meta">' +
        (chatSocial.clan.name || "Клан") +
        " · " +
        n +
        "</span>" +
        (amLeader
          ? '<button type="button" class="game-chat-social-btn" data-act="clan-invite">+ Ник</button>'
          : "") +
        '<button type="button" class="game-chat-social-btn ghost" data-act="clan-leave">Выйти</button>';
    }
  }

  social.querySelectorAll("[data-act]").forEach((btn) => {
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
  if (!res.ok) return { ok: false, status: res.status, error: data.error || "Ошибка" };
  return { ok: true, ...data };
}

async function handleChatSocialAction(act) {
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (act === "party-create") {
    const r = await chatApi("/chat/party/create", { method: "POST", body: {} });
    if (!r.ok) return setChatStatus(r.error, "warn");
    chatSocial = { party: r.party || null, clan: r.clan || chatSocial.clan };
    chatCanSend = !!chatSocial.party;
    syncChatComposeUi();
    setChatStatus("Группа создана");
    return chatPollNow();
  }
  if (act === "party-leave") {
    const r = await chatApi("/chat/party/leave", { method: "POST", body: {} });
    if (!r.ok) return setChatStatus(r.error, "warn");
    chatSocial = { party: null, clan: r.clan || chatSocial.clan };
    chatCanSend = false;
    clearChatFeed();
    chatLastIdByChannel.party = 0;
    chatKnownIdsByChannel.party = new Set();
    chatBootstrapped.party = false;
    syncChatComposeUi();
    setChatStatus("Вы покинули группу");
    return;
  }
  if (act === "party-invite") {
    const nick = window.prompt("Ник аккаунта для приглашения в группу:");
    if (!nick) return;
    const r = await chatApi("/chat/party/invite", { method: "POST", body: { nick: nick.trim() } });
    if (!r.ok) return setChatStatus(r.error, "warn");
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || chatSocial.clan };
    syncChatComposeUi();
    setChatStatus("Приглашён: " + (r.invited || nick));
    return;
  }
  if (act === "clan-create") {
    const name = window.prompt("Имя клана (3–24 символа):");
    if (!name) return;
    const r = await chatApi("/chat/clan/create", { method: "POST", body: { name: name.trim() } });
    if (!r.ok) return setChatStatus(r.error, "warn");
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || null };
    chatCanSend = !!chatSocial.clan;
    syncChatComposeUi();
    setChatStatus("Клан «" + (r.clan?.name || name) + "» создан");
    return chatPollNow();
  }
  if (act === "clan-leave") {
    const r = await chatApi("/chat/clan/leave", { method: "POST", body: {} });
    if (!r.ok) return setChatStatus(r.error, "warn");
    chatSocial = { party: r.party || chatSocial.party, clan: null };
    chatCanSend = false;
    clearChatFeed();
    chatLastIdByChannel.clan = 0;
    chatKnownIdsByChannel.clan = new Set();
    chatBootstrapped.clan = false;
    syncChatComposeUi();
    setChatStatus("Вы покинули клан");
    return;
  }
  if (act === "clan-invite") {
    const nick = window.prompt("Ник аккаунта для приглашения в клан:");
    if (!nick) return;
    const r = await chatApi("/chat/clan/invite", { method: "POST", body: { nick: nick.trim() } });
    if (!r.ok) return setChatStatus(r.error, "warn");
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || chatSocial.clan };
    syncChatComposeUi();
    setChatStatus("Приглашён: " + (r.invited || nick));
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
  syncChatChannelTabs();
  syncChatComposeUi();
  updateChatTabBadges();
  chatPollNow();
}

function syncChatChannelTabs() {
  const title = document.getElementById("gameChatTitle");
  const meta = chatChannelMeta(chatActiveChannel);
  if (title) title.textContent = meta.label;
  document.querySelectorAll(".game-chat-chan[data-channel]").forEach((btn) => {
    btn.classList.toggle("sel", btn.dataset.channel === chatActiveChannel);
  });
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
  if (channel === chatActiveChannel && !isChatCollapsed()) return;
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
      appendChatMessage(msg, { scroll: opts?.scroll !== false && !isChatCollapsed() });
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
      chatSocial = { party: active.party || null, clan: active.clan || null };
      chatCanSend = active.canSend !== false;
      if (active.reason === "no_party") {
        setChatStatus("Нет группы — создайте или попросите приглашение", "warn");
      } else if (active.reason === "no_clan") {
        setChatStatus("Нет клана — создайте или попросите приглашение", "warn");
      } else {
        setChatStatus("");
      }
      syncChatComposeUi();
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
    const toEl = document.getElementById("gameChatToNick");
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
  const panel = chatPanelEl();
  if (!panel || panel.hidden) return;
  if (!chatCanUse()) return;
  if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) {
    if (!isChatMobileEnabled()) return;
  }
  chatPollNow();
  chatPollTimer = setInterval(() => chatPollNow(), CHAT_POLL_MS);
}

function wireChatMobileSetting() {
  const btn = document.getElementById("settChatMobile");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", () => {
    if (typeof Audio2 !== "undefined") Audio2.click();
    setChatMobileEnabled(!isChatMobileEnabled());
  });
}
