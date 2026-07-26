// ===== Party core: экран меню «Группа» (не оверлей) =====

let partyInviteDraft = "";
let partyPollTimer = null;
let partyStatusText = "";
let partyStatusWarn = false;
/** @type {object[]} */
let partyIncomingInvites = [];
/** @type {object[]} */
let partyOutgoingInvites = [];
/** @type {{ zoneId: string, memberCount?: number }|null} */
let partyFarmInfo = null;
/** @type {object|null} */
let partyInstanceInfo = null;
let partyInvitePromptBusy = false;
let partyInstancePromptBusy = false;
let partyLastPromptedInviteId = "";
let partyLastPromptedInstanceId = "";
/** @type {"inst"|"lfg"} */
let partyRightTab = "inst";
/** @type {Record<string, { clears?: number, max?: number }>} */
let partyDungeonLocks = {};
/** @type {{ listings: object[], mine: object|null }} */
let partyLfgCache = { listings: [], mine: null };

function getChatParty() {
  if (typeof chatSocial !== "undefined" && chatSocial) return chatSocial.party || null;
  return null;
}

function partyMemberCount() {
  const p = getChatParty();
  return (p && p.members && p.members.length) || 0;
}

function partyAmLeader() {
  const p = getChatParty();
  if (!p) return false;
  const myNick = typeof chatMyNick === "function" ? chatMyNick() : "";
  const leader = (p.members || []).find((m) => m.userId === p.leaderUserId);
  return !!(leader && leader.nick === myNick);
}

function partyCanEnterGroupContent() {
  const n = partyMemberCount();
  const min = (typeof PARTY_CONTENT !== "undefined" && PARTY_CONTENT.minMembers) || 2;
  const max = (typeof PARTY_CONTENT !== "undefined" && PARTY_CONTENT.maxMembers) || 4;
  return n >= min && n <= max;
}

function partySessionOk() {
  return typeof isInCharacterSession === "function" ? isInCharacterSession() : false;
}

function partyCloudReady() {
  return (
    partySessionOk() &&
    typeof cloudEnabled === "function" &&
    cloudEnabled() &&
    typeof readCloudAuth === "function" &&
    !!readCloudAuth()?.token
  );
}

function partyMemberLabel(m) {
  return String((m && (m.name || m.charName || m.nick)) || "?").trim() || "?";
}

function partyMyCharName() {
  if (typeof chatActiveCharName === "function") {
    const n = String(chatActiveCharName() || "").trim();
    if (n) return n;
  }
  return String(state?.avatar?.name || "").trim();
}

function partyActiveFarmZoneId() {
  return partyFarmInfo?.zoneId || null;
}

async function partyApi(path, opts) {
  if (typeof chatApi === "function") return chatApi(path, opts);
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

function partySetStatus(text, kind) {
  partyStatusText = text || "";
  partyStatusWarn = kind === "warn";
  const el = document.getElementById("partyPanelStatus");
  if (!el) {
    if (text && typeof toast === "function") toast(text, kind === "warn" ? "warn" : "info");
    return;
  }
  el.textContent = partyStatusText;
  el.hidden = !partyStatusText;
  el.classList.toggle("is-warn", partyStatusWarn);
}

function syncPartyTileMeta() {
  const meta = document.getElementById("partyTileMeta");
  if (!meta) return;
  if (!partyCloudReady()) {
    meta.textContent = "Облако";
    return;
  }
  const p = getChatParty();
  const n = partyMemberCount();
  const invN = (partyIncomingInvites || []).length;
  if (!p && invN) meta.textContent = "Приглаш.";
  else meta.textContent = p ? n + "/4" : "Собрать";
  const badge = document.getElementById("partyTileBadge");
  if (badge) {
    const show = invN > 0 || n >= 2;
    badge.hidden = !show;
    badge.textContent = invN > 0 ? String(invN) : n > 0 ? String(n) : "";
  }
}

function applyPartyMePayload(r) {
  if (!r || !r.ok) return;
  if (typeof chatSocial !== "undefined") {
    chatSocial.party = r.party || null;
  }
  partyIncomingInvites = Array.isArray(r.invites) ? r.invites : [];
  partyOutgoingInvites = Array.isArray(r.outgoingInvites) ? r.outgoingInvites : [];
  const prevFarm = partyFarmInfo?.zoneId || null;
  partyFarmInfo = r.farm || null;
  partyInstanceInfo = r.instance || null;
  const nextFarm = partyFarmInfo?.zoneId || null;
  if (prevFarm !== nextFarm && typeof renderMenuFarmHub === "function") {
    const menu = document.getElementById("screen-menu");
    if (menu && menu.classList.contains("active")) renderMenuFarmHub();
  }
}

function openPartyScreen() {
  if (typeof Audio2 !== "undefined") Audio2.open();
  renderPartyPanel();
  if (typeof show === "function") show("party");
  partyRefreshMe({ withSide: true });
}

async function partyRefreshMe(opts) {
  opts = opts || {};
  if (!partyCloudReady()) {
    partyIncomingInvites = [];
    partyOutgoingInvites = [];
    partyFarmInfo = null;
    partyInstanceInfo = null;
    partyLfgCache = { listings: [], mine: null };
    renderPartyPanel();
    return { ok: false };
  }
  const r = await partyApi("/party/me");
  if (r.ok) applyPartyMePayload(r);
  if (opts.withSide || partyRightTab === "lfg") {
    await Promise.all([partyRefreshLocks(), partyRefreshLfg()]);
  } else if (partyRightTab === "inst") {
    await partyRefreshLocks();
  }
  renderPartyPanel();
  maybePromptPartyInvite();
  maybePromptPartyInstance();
  return r;
}

async function partyCreate() {
  const r = await partyApi("/chat/party/create", { method: "POST", body: {} });
  if (!r.ok) {
    partySetStatus(r.error || "Не удалось создать", "warn");
    renderPartyPanel();
    return;
  }
  if (typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || null, clan: r.clan || chatSocial.clan };
  }
  partySetStatus("Группа создана — пригласи по имени персонажа");
  renderPartyPanel();
  if (typeof syncChatComposeUi === "function") syncChatComposeUi();
}

async function partyLeave() {
  const r = await partyApi("/chat/party/leave", { method: "POST", body: {} });
  if (!r.ok) {
    partySetStatus(r.error || "Ошибка", "warn");
    renderPartyPanel();
    return;
  }
  if (typeof chatSocial !== "undefined") {
    chatSocial = { party: null, clan: r.clan || chatSocial.clan };
  }
  partyInviteDraft = "";
  partyOutgoingInvites = [];
  partyFarmInfo = null;
  partyInstanceInfo = null;
  partySetStatus("Вы покинули группу");
  renderPartyPanel();
  if (typeof syncChatComposeUi === "function") syncChatComposeUi();
}

async function partyInviteByName() {
  const input = document.getElementById("partyPanelInviteNick");
  const name = String((input && input.value) || partyInviteDraft || "").trim();
  if (!name) {
    partySetStatus("Введи имя персонажа", "warn");
    renderPartyPanel();
    if (input) input.focus();
    return;
  }
  partyInviteDraft = name;
  const r = await partyApi("/chat/party/invite", { method: "POST", body: { charName: name } });
  if (!r.ok) {
    partySetStatus(r.error || "Не удалось пригласить", "warn");
    renderPartyPanel();
    return;
  }
  if (typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || chatSocial.clan };
  }
  partyOutgoingInvites = Array.isArray(r.invitesOutgoing) ? r.invitesOutgoing : partyOutgoingInvites;
  partyInviteDraft = "";
  partySetStatus("Приглашение «" + (r.invited || name) + "» — ждём согласия");
  if (typeof toast === "function") toast("Приглашение отправлено — ждём ответа", "info");
  renderPartyPanel();
  if (typeof syncChatComposeUi === "function") syncChatComposeUi();
}

async function partyKickByName(nameArg) {
  const input = document.getElementById("partyPanelInviteNick");
  const name = String(nameArg || (input && input.value) || partyInviteDraft || "").trim();
  if (!name) {
    partySetStatus("Введи имя персонажа для кика", "warn");
    renderPartyPanel();
    return;
  }
  if (!nameArg) partyInviteDraft = name;
  const r = await partyApi("/chat/party/kick", { method: "POST", body: { charName: name } });
  if (!r.ok) {
    partySetStatus(r.error || "Не удалось исключить", "warn");
    renderPartyPanel();
    return;
  }
  if (typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || chatSocial.clan };
  }
  if (!nameArg) partyInviteDraft = "";
  partySetStatus("Исключён: " + (r.kicked || name));
  renderPartyPanel();
  if (typeof syncChatComposeUi === "function") syncChatComposeUi();
}

function partyInstanceStatusLabel(inst) {
  if (!inst) return "";
  if (inst.status === "ready") return "Ready-check";
  if (inst.status === "active") {
    if (inst.phase === "boss") return "Босс";
    if (inst.phase === "wave") return "Волна " + ((inst.waveIndex || 0) + 1);
    return "Бой";
  }
  if (inst.status === "cleared") return "Пройден";
  if (inst.status === "failed") return "Провал";
  return String(inst.status || "");
}

function partyRenderMemberSlots(p, myNick) {
  const leaderId = p.leaderUserId;
  const members = p.members || [];
  const max = (typeof PARTY_CONTENT !== "undefined" && PARTY_CONTENT.maxMembers) || 4;
  const amLeader = partyAmLeader();
  let html = '<ul class="party-panel-slots" aria-label="Состав группы">';
  for (let i = 0; i < max; i++) {
    const m = members[i];
    if (!m) {
      html +=
        '<li class="party-slot is-empty">' +
        '<span class="party-slot-idx">' +
        (i + 1) +
        "</span>" +
        '<span class="party-slot-ready empty-ph" aria-hidden="true"></span>' +
        '<span class="party-slot-nick dim">свободно</span>' +
        '<span class="party-slot-kick-ph" aria-hidden="true"></span>' +
        "</li>";
      continue;
    }
    const isLead = m.userId === leaderId;
    const isMe = partyMemberIsMe(m, myNick);
    const ready = !!m.ready;
    const label = partyMemberLabel(m);
    const canKick = amLeader && !isMe;
    html +=
      '<li class="party-slot' +
      (isLead ? " is-leader" : "") +
      (isMe ? " is-me" : "") +
      (ready ? " is-ready" : "") +
      '">' +
      '<span class="party-slot-idx">' +
      (i + 1) +
      "</span>" +
      '<span class="party-slot-ready' +
      (ready ? " on" : "") +
      '" title="' +
      (ready ? "Готов" : "Ждёт") +
      '">' +
      (ready ? "Готов" : "Ждёт") +
      "</span>" +
      '<span class="party-slot-nick">' +
      (isLead ? "★ " : "") +
      label +
      (isMe ? " · вы" : "") +
      "</span>" +
      (canKick
        ? '<button type="button" class="party-slot-kick" data-party-kick="' +
          encodeURIComponent(label) +
          '" title="Исключить" aria-label="Исключить">×</button>'
        : '<span class="party-slot-kick-ph" aria-hidden="true"></span>') +
      "</li>";
  }
  html += "</ul>";
  const need = Math.max(0, ((typeof PARTY_CONTENT !== "undefined" && PARTY_CONTENT.minMembers) || 2) - members.length);
  if (need > 0) {
    html +=
      '<p class="party-panel-hint">Нужен ещё ' +
      need +
      (need === 1 ? " игрок" : " игрока") +
      " для инстанса</p>";
  }
  return html;
}

function partyDungeonCardBg(d) {
  if (!d) return "";
  if (d.ui && d.ui.cardBg) return d.ui.cardBg;
  if (d.mine && Array.isArray(d.mine.bgs) && d.mine.bgs[0]) return d.mine.bgs[0];
  return "";
}

function partyEscAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function partyCardArtHtml(bg) {
  if (!bg) return "";
  return (
    '<img class="party-dungeon-card-art" src="' +
    partyEscAttr(bg) +
    '" alt="" decoding="async" loading="lazy" />'
  );
}

function partyRenderInstanceBlock(inst) {
  if (!inst || (inst.status !== "ready" && inst.status !== "active")) return "";
  const d =
    typeof partyDungeonById === "function"
      ? partyDungeonById(inst.dungeonId)
      : (typeof PARTY_DUNGEONS !== "undefined" ? PARTY_DUNGEONS : []).find((x) => x.id === inst.dungeonId);
  const bg = partyDungeonCardBg(d);
  return (
    '<div class="party-inst-banner">' +
    (bg
      ? '<img class="party-inst-banner-art" src="' + partyEscAttr(bg) + '" alt="" decoding="async" />'
      : "") +
    '<div class="party-inst-banner-copy">' +
    "<strong>" +
    (inst.dungeonName || "Инстанс") +
    "</strong>" +
    "<small>" +
    partyInstanceStatusLabel(inst) +
    "</small>" +
    "</div>" +
    '<button type="button" class="party-panel-btn party-inst-primary" id="partyInstJoinBtn">Войти в бой</button>' +
    "</div>"
  );
}

function partyRenderDungeonCards(inst) {
  const list = typeof PARTY_DUNGEONS !== "undefined" ? PARTY_DUNGEONS : [];
  const canStart = partyAmLeader() && partyCanEnterGroupContent();
  const power = typeof avatarFarmPower === "function" ? avatarFarmPower() : 0;
  const level = state.avatar?.level || 1;
  const activeBusy = !!(inst && (inst.status === "ready" || inst.status === "active"));
  if (!list.length) {
    return '<p class="party-panel-hint">Инстансы пока недоступны.</p>';
  }
  return (
    '<div class="party-dungeon-list">' +
    list
      .map((d) => {
        const lock = partyDungeonLocks[d.id] || {
          clears: 0,
          max: d.weeklyClears != null ? d.weeklyClears : 3,
        };
        const max = lock.max != null ? lock.max : 3;
        const unlimited = max <= 0;
        const left = unlimited ? 99 : Math.max(0, max - (lock.clears || 0));
        const needLv = level < (d.reqLevel || 1);
        const needPow = power < (d.reqPower || 0);
        const noClears = !unlimited && left <= 0;
        let reason = "";
        if (!partyAmLeader()) reason = "Запускает лидер";
        else if (!partyCanEnterGroupContent()) reason = "Нужно 2–4 в группе";
        else if (activeBusy) reason = "Уже есть активный инст";
        else if (needLv) reason = "Нужен ур. " + d.reqLevel;
        else if (needPow) reason = "Нужна сила " + d.reqPower;
        else if (noClears) reason = "Нет клиров на неделе";
        const disabled = !!reason || !canStart;
        const bg = partyDungeonCardBg(d);
        const accent = (d.ui && d.ui.accent) || "";
        return (
          '<article class="party-dungeon-card' +
          (disabled ? " is-locked" : "") +
          '"' +
          (accent ? ' style="--party-accent:' + partyEscAttr(accent) + '"' : "") +
          ">" +
          partyCardArtHtml(bg) +
          '<div class="party-dungeon-card-veil" aria-hidden="true"></div>' +
          '<div class="party-dungeon-card-body">' +
          '<div class="party-dungeon-card-title">' +
          "<strong>" +
          d.name +
          "</strong>" +
          '<span class="party-dungeon-chip">' +
          (unlimited ? "∞ входов" : left + "/" + max) +
          "</span>" +
          "</div>" +
          '<p class="party-dungeon-desc">' +
          (d.desc || "") +
          "</p>" +
          '<div class="party-dungeon-meta">ур.' +
          d.reqLevel +
          " · сила " +
          d.reqPower +
          "</div>" +
          (reason ? '<div class="party-dungeon-reason">' + reason + "</div>" : "") +
          '<div class="party-dungeon-actions">' +
          '<button type="button" class="party-panel-btn party-inst-primary" data-dungeon-start="' +
          d.id +
          '"' +
          (disabled ? " disabled" : "") +
          ">Старт</button>" +
          (partyAmLeader()
            ? '<button type="button" class="party-panel-btn party-btn-search" data-dungeon-lfg="' +
              d.id +
              '">В поиск</button>'
            : "") +
          "</div></div></article>"
        );
      })
      .join("") +
    "</div>"
  );
}

function partyRenderLfgPane() {
  const mine = partyLfgCache.mine;
  const list = partyLfgCache.listings || [];
  const p = getChatParty();
  const dungeons = typeof PARTY_DUNGEONS !== "undefined" ? PARTY_DUNGEONS : [];
  let mineHtml = "";
  if (mine) {
    const md = dungeons.find((x) => x.id === mine.dungeonId);
    const bg = partyDungeonCardBg(md);
    mineHtml =
      '<div class="party-lfg-mine">' +
      (bg
        ? '<img class="party-dungeon-card-art" src="' + partyEscAttr(bg) + '" alt="" decoding="async" />'
        : "") +
      '<div class="party-lfg-mine-copy">' +
      "<strong>Ваш набор</strong>" +
      "<span>" +
      (mine.dungeonName || "?") +
      " · " +
      mine.membersCount +
      "/" +
      mine.maxMembers +
      (mine.note ? " · " + mine.note : "") +
      "</span>" +
      "</div>" +
      '<button type="button" class="party-panel-btn ghost" id="partyLfgRemoveBtn">Снять</button>' +
      "</div>";
  } else if (partyAmLeader() && p) {
    mineHtml =
      '<p class="party-panel-hint">Опубликуй набор кнопкой «В поиск» на карточке инста.</p>';
  } else if (!p) {
    mineHtml = '<p class="party-panel-hint">Вступи в объявление ниже или создай группу слева.</p>';
  }

  const rows = list.length
    ? list
        .map((row) => {
          const d = dungeons.find((x) => x.id === row.dungeonId);
          const bg = partyDungeonCardBg(d);
          return (
            '<div class="party-lfg-row">' +
            (bg
              ? '<img class="party-dungeon-card-art" src="' + partyEscAttr(bg) + '" alt="" decoding="async" />'
              : "") +
            '<div class="party-lfg-row-veil" aria-hidden="true"></div>' +
            '<div class="party-lfg-row-body">' +
            "<strong>" +
            (row.dungeonName || "?") +
            "</strong>" +
            "<small>" +
            (row.leaderName || "?") +
            " · " +
            row.membersCount +
            "/" +
            row.maxMembers +
            (row.note ? " · " + row.note : "") +
            "</small>" +
            "</div>" +
            '<button type="button" class="party-panel-btn party-inst-primary" data-lfg-join="' +
            row.id +
            '"' +
            (p ? " disabled title=\"Сначала выйди из группы\"" : "") +
            ">Вступить</button>" +
            "</div>"
          );
        })
        .join("")
    : '<div class="party-lfg-empty">Пока нет объявлений. Лидер может опубликовать набор.</div>';

  return (
    '<div class="party-lfg-head"><strong>Доска набора</strong><small>Живые группы · инстансы</small></div>' +
    mineHtml +
    '<div class="party-lfg-list">' +
    rows +
    "</div>"
  );
}

async function partyRefreshLocks() {
  if (!partyCloudReady()) {
    partyDungeonLocks = {};
    return;
  }
  const r = await partyApi(
    "/instance/locks?characterId=" + encodeURIComponent(state.activeCharacterId || "")
  );
  if (r.ok) partyDungeonLocks = r.locks || {};
}

async function partyRefreshLfg() {
  if (!partyCloudReady()) {
    partyLfgCache = { listings: [], mine: null };
    return;
  }
  const r = await partyApi("/party/lfg");
  if (r.ok) {
    partyLfgCache = {
      listings: Array.isArray(r.listings) ? r.listings : [],
      mine: r.mine || null,
    };
  }
}

async function partyLfgPublish(dungeonId) {
  const r = await partyApi("/party/lfg", {
    method: "POST",
    body: { dungeonId },
  });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Не удалось опубликовать", "warn");
    return;
  }
  partyLfgCache = {
    listings: Array.isArray(r.listings) ? r.listings : partyLfgCache.listings,
    mine: r.mine || r.listing || null,
  };
  partyRightTab = "lfg";
  if (typeof toast === "function") toast("Набор опубликован", "success");
  renderPartyPanel();
}

async function partyLfgRemove() {
  const r = await partyApi("/party/lfg", { method: "DELETE" });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Ошибка", "warn");
    return;
  }
  partyLfgCache = {
    listings: Array.isArray(r.listings) ? r.listings : [],
    mine: null,
  };
  renderPartyPanel();
}

async function partyLfgJoin(listingId) {
  const r = await partyApi("/party/lfg/join", {
    method: "POST",
    body: { listingId, charName: partyMyCharName() || undefined },
  });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Не удалось вступить", "warn");
    return;
  }
  if (typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || null, clan: r.clan || chatSocial.clan };
  }
  partyLfgCache = {
    listings: Array.isArray(r.listings) ? r.listings : [],
    mine: r.mine || null,
  };
  if (typeof toast === "function") toast("Вы в группе", "success");
  await partyRefreshMe();
  if (typeof syncChatComposeUi === "function") syncChatComposeUi();
}

async function partyRespondInvite(inviteId, accept) {
  const r = await partyApi("/chat/party/invite/respond", {
    method: "POST",
    body: {
      inviteId,
      accept: !!accept,
      charName: partyMyCharName() || undefined,
    },
  });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.error || "Ошибка приглашения", "warn");
    await partyRefreshMe();
    return r;
  }
  if (typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || null, clan: r.clan || chatSocial.clan };
  }
  partyIncomingInvites = (partyIncomingInvites || []).filter((i) => i.id !== inviteId);
  if (accept) {
    if (typeof toast === "function") toast("Вы вступили в группу", "success");
    partySetStatus("Вы в группе");
  } else {
    if (typeof toast === "function") toast("Приглашение отклонено", "info");
  }
  await partyRefreshMe();
  if (typeof syncChatComposeUi === "function") syncChatComposeUi();
  return r;
}

async function maybePromptPartyInvite() {
  if (partyInvitePromptBusy || !partyCloudReady()) return;
  const inv = (partyIncomingInvites || [])[0];
  if (!inv || !inv.id) return;
  if (inv.id === partyLastPromptedInviteId) return;
  if (typeof showConfirm !== "function") return;
  partyInvitePromptBusy = true;
  partyLastPromptedInviteId = inv.id;
  try {
    const from = inv.fromName || inv.fromNick || "Игрок";
    const ok = await showConfirm({
      title: "Приглашение в группу",
      message: from + " приглашает вас в группу.\nПринять?",
      okText: "Принять",
      cancelText: "Отклонить",
    });
    await partyRespondInvite(inv.id, !!ok);
  } finally {
    partyInvitePromptBusy = false;
  }
}

async function maybePromptPartyInstance() {
  if (partyInstancePromptBusy || !partyCloudReady()) return;
  const inst = partyInstanceInfo;
  if (!inst || !inst.runId) return;
  if (inst.status !== "ready" && inst.status !== "active") return;
  if (typeof mineActive !== "undefined" && mineActive && instanceRunState?.runId === inst.runId) return;
  if (inst.runId === partyLastPromptedInstanceId) return;
  if (partyAmLeader() && instanceRunState?.runId === inst.runId) return;
  partyInstancePromptBusy = true;
  partyLastPromptedInstanceId = inst.runId;
  try {
    if (typeof showConfirm !== "function") {
      if (typeof joinPartyInstance === "function") await joinPartyInstance(inst);
      return;
    }
    const ok = await showConfirm({
      title: "Инстанс группы",
      message:
        (inst.dungeonName || "Инстанс") +
        " уже запущен.\nВойти вместе с группой?",
      okText: "Войти",
      cancelText: "Позже",
    });
    if (ok && typeof joinPartyInstance === "function") await joinPartyInstance(inst);
  } finally {
    partyInstancePromptBusy = false;
  }
}

function partyMemberIsMe(m, myNick) {
  if (!m) return false;
  if (myNick && m.nick === myNick) return true;
  const myChar = typeof partyMyCharName === "function" ? partyMyCharName() : "";
  if (myChar && (m.name === myChar || m.charName === myChar)) return true;
  return false;
}

function partyFindMe(members, myNick) {
  return (members || []).find((m) => partyMemberIsMe(m, myNick)) || null;
}

async function partyToggleReady() {
  const p = getChatParty();
  if (!p) {
    partySetStatus("Сначала создай группу", "warn");
    renderPartyPanel();
    return;
  }
  const myNick = typeof chatMyNick === "function" ? chatMyNick() : "";
  const me = partyFindMe(p.members, myNick);
  const next = !(me && me.ready);
  const r = await partyApi("/party/ready", { method: "POST", body: { ready: next } });
  if (!r.ok) {
    partySetStatus(r.error || "Ошибка ready", "warn");
    renderPartyPanel();
    return;
  }
  if (r.party && typeof chatSocial !== "undefined") chatSocial.party = r.party;
  renderPartyPanel();
}

function wirePartyInviteInput(input) {
  if (!input || input.dataset.wired === "1") return;
  input.dataset.wired = "1";
  input.value = partyInviteDraft;
  input.addEventListener("input", () => {
    partyInviteDraft = String(input.value || "");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      partyInviteByName();
    }
  });
}

function renderPartyPanel() {
  syncPartyTileMeta();

  const el = document.getElementById("partyScreenBody");
  if (!el) return;

  const focusInvite = document.activeElement && document.activeElement.id === "partyPanelInviteNick";
  const selStart = focusInvite ? document.activeElement.selectionStart : null;
  const selEnd = focusInvite ? document.activeElement.selectionEnd : null;

  if (!partyCloudReady()) {
    el.innerHTML =
      '<div class="party-layout">' +
      '<div class="party-col party-col-left"><div class="party-screen-card">' +
      '<p class="party-panel-hint">Нужен вход в облако и активный персонаж.</p>' +
      '<p class="party-panel-hint">Приглашения — только по <b>имени персонажа</b>.</p>' +
      "</div></div>" +
      '<div class="party-col party-col-right"><div class="party-screen-card">' +
      '<p class="party-panel-hint">Инстансы и поиск группы — после входа в облако.</p>' +
      "</div></div></div>";
    return;
  }

  const p = getChatParty();
  const myNick = typeof chatMyNick === "function" ? chatMyNick() : "";
  const myChar = partyMyCharName();
  const incoming = partyIncomingInvites || [];
  const outgoing = partyOutgoingInvites || [];
  const inst = partyInstanceInfo;

  let incomingHtml = "";
  if (incoming.length) {
    incomingHtml =
      '<div class="party-invite-inbox">' +
      incoming
        .map((inv) => {
          const from = inv.fromName || inv.fromNick || "Игрок";
          return (
            '<div class="party-invite-row">' +
            "<span>Приглашение от <b>" +
            from +
            "</b></span>" +
            '<button type="button" class="party-panel-btn" data-party-accept="' +
            inv.id +
            '">Принять</button>' +
            '<button type="button" class="party-panel-btn ghost" data-party-decline="' +
            inv.id +
            '">Отклонить</button>' +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  }

  let leftBody = "";
  if (!p) {
    leftBody =
      incomingHtml +
      '<div class="party-empty">' +
      "<strong>Собрать группу</strong>" +
      "<small>Инстансы · 2–4 · имя персонажа</small>" +
      (myChar ? '<p class="party-panel-hint">Ты: <b>' + myChar + "</b></p>" : "") +
      '<button type="button" class="party-panel-btn party-inst-primary" id="partyCreateBtn">Создать группу</button>' +
      "</div>";
  } else {
    const outHtml = outgoing.length
      ? '<p class="party-panel-hint">Ждём ответа: ' +
        outgoing.map((o) => o.toName || "?").join(", ") +
        "</p>"
      : "";
    const myReady = !!partyFindMe(p.members, myNick)?.ready;
    leftBody =
      incomingHtml +
      partyRenderInstanceBlock(inst) +
      partyRenderMemberSlots(p, myNick) +
      outHtml +
      (partyAmLeader()
        ? '<div class="party-panel-invite">' +
          '<input type="text" class="party-panel-nick-input" id="partyPanelInviteNick" maxlength="16" placeholder="Имя персонажа" spellcheck="false" autocomplete="off" />' +
          '<button type="button" class="party-panel-btn" id="partyInviteBtn">Пригласить</button>' +
          "</div>"
        : '<p class="party-panel-hint">Приглашает только лидер</p>') +
      '<div class="party-panel-actions">' +
      '<button type="button" class="party-panel-btn' +
      (myReady ? "" : " ghost") +
      '" id="partyReadyBtn">' +
      (myReady ? "Готов ✓" : "Ready") +
      "</button>" +
      '<button type="button" class="party-panel-btn ghost" id="partyLeaveBtn">Выйти</button>' +
      "</div>";
  }

  const tabInst = partyRightTab === "inst";
  const rightBody =
    '<div class="party-right-tabs" role="tablist">' +
    '<button type="button" class="party-right-tab' +
    (tabInst ? " sel" : "") +
    '" data-party-tab="inst">Инстансы</button>' +
    '<button type="button" class="party-right-tab' +
    (!tabInst ? " sel" : "") +
    '" data-party-tab="lfg">Поиск</button>' +
    "</div>" +
    '<div class="party-right-pane">' +
    (tabInst ? partyRenderDungeonCards(inst) : partyRenderLfgPane()) +
    "</div>";

  el.innerHTML =
    '<div class="party-layout">' +
    '<div class="party-col party-col-left"><div class="party-screen-card party-screen-card-roster">' +
    '<div class="party-panel-head"><strong>Группа' +
    (p ? " · " + (p.members || []).length + "/4" : "") +
    "</strong></div>" +
    leftBody +
    '<p class="party-panel-status" id="partyPanelStatus" hidden></p>' +
    "</div></div>" +
    '<div class="party-col party-col-right"><div class="party-screen-card party-screen-card-wide party-screen-card-board">' +
    rightBody +
    "</div></div></div>";

  if (partyStatusText) partySetStatus(partyStatusText, partyStatusWarn ? "warn" : "");

  const createBtn = document.getElementById("partyCreateBtn");
  if (createBtn) createBtn.onclick = () => partyCreate();
  const leaveBtn = document.getElementById("partyLeaveBtn");
  if (leaveBtn) leaveBtn.onclick = () => partyLeave();
  const inviteBtn = document.getElementById("partyInviteBtn");
  if (inviteBtn) inviteBtn.onclick = () => partyInviteByName();
  const readyBtn = document.getElementById("partyReadyBtn");
  if (readyBtn) readyBtn.onclick = () => partyToggleReady();
  const instJoinBtn = document.getElementById("partyInstJoinBtn");
  if (instJoinBtn) {
    instJoinBtn.onclick = () => {
      if (typeof joinPartyInstance === "function") joinPartyInstance(partyInstanceInfo);
    };
  }
  el.querySelectorAll("[data-party-tab]").forEach((btn) => {
    btn.onclick = () => {
      partyRightTab = btn.getAttribute("data-party-tab") === "lfg" ? "lfg" : "inst";
      if (partyRightTab === "lfg") {
        partyRefreshLfg().then(() => renderPartyPanel());
      } else {
        partyRefreshLocks().then(() => renderPartyPanel());
      }
    };
  });
  el.querySelectorAll("[data-dungeon-start]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      if (typeof startInstanceRun === "function") startInstanceRun(btn.getAttribute("data-dungeon-start"));
    };
  });
  el.querySelectorAll("[data-dungeon-lfg]").forEach((btn) => {
    btn.onclick = () => partyLfgPublish(btn.getAttribute("data-dungeon-lfg"));
  });
  el.querySelectorAll("[data-lfg-join]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      partyLfgJoin(btn.getAttribute("data-lfg-join"));
    };
  });
  const lfgRemove = document.getElementById("partyLfgRemoveBtn");
  if (lfgRemove) lfgRemove.onclick = () => partyLfgRemove();

  el.querySelectorAll("[data-party-accept]").forEach((btn) => {
    btn.onclick = () => partyRespondInvite(btn.getAttribute("data-party-accept"), true);
  });
  el.querySelectorAll("[data-party-decline]").forEach((btn) => {
    btn.onclick = () => partyRespondInvite(btn.getAttribute("data-party-decline"), false);
  });
  el.querySelectorAll("[data-party-kick]").forEach((btn) => {
    btn.onclick = () => {
      let name = "";
      try {
        name = decodeURIComponent(btn.getAttribute("data-party-kick") || "");
      } catch (_) {
        name = btn.getAttribute("data-party-kick") || "";
      }
      if (name) partyKickByName(name);
    };
  });
  const inviteInput = document.getElementById("partyPanelInviteNick");
  if (inviteInput) {
    inviteInput.value = partyInviteDraft;
    wirePartyInviteInput(inviteInput);
    if (focusInvite) {
      inviteInput.focus();
      try {
        if (selStart != null) inviteInput.setSelectionRange(selStart, selEnd);
      } catch (_) {}
    }
  }
}

function startPartyPanelPoll() {
  if (partyPollTimer) return;
  partyPollTimer = setInterval(() => {
    if (!partyCloudReady()) {
      syncPartyTileMeta();
      return;
    }
    const typing =
      document.activeElement && document.activeElement.id === "partyPanelInviteNick";
    if (typing) {
      partyInviteDraft = String(document.activeElement.value || "");
      return;
    }
    partyRefreshMe();
  }, 3500);
}

function wirePartyUi() {
  const tile = document.getElementById("partyTile");
  if (tile && !tile._bound) {
    tile._bound = true;
    tile.onclick = () => openPartyScreen();
  }
}

function initPartyPanel() {
  const old = document.getElementById("partyPanel");
  if (old && old.parentNode) old.parentNode.removeChild(old);
  wirePartyUi();
  renderPartyPanel();
  startPartyPanelPoll();
  setTimeout(() => renderPartyPanel(), 800);
}
