// ===== Clan core: логика экрана «Клан» (создание только здесь, не в чате) =====

let clanInviteDraft = "";
let clanCreateDraft = "";
let clanStatusText = "";
let clanStatusWarn = false;
let clanRightTab = "grounds"; // grounds | warehouse | content (map → grounds)
/** @type {object[]} */
let clanIncomingInvites = [];
let clanPollTimer = null;
let clanInvitePromptBusy = false;
let clanLastPromptedInviteId = "";

function getChatClan() {
  if (typeof chatSocial !== "undefined" && chatSocial) return chatSocial.clan || null;
  return null;
}

function clanCloudReady() {
  const sessionOk = typeof isInCharacterSession === "function" ? isInCharacterSession() : !!state?.avatar?.created;
  return (
    sessionOk &&
    typeof cloudEnabled === "function" &&
    cloudEnabled() &&
    typeof readCloudAuth === "function" &&
    !!readCloudAuth()?.token
  );
}

function clanMyNick() {
  if (typeof chatMyNick === "function") return String(chatMyNick() || "").trim();
  if (typeof cloudUserNick === "function") return String(cloudUserNick() || "").trim();
  return "";
}

function clanMyRole() {
  const clan = getChatClan();
  if (!clan) return null;
  const myNick = clanMyNick();
  const me = (clan.members || []).find((m) => m.nick === myNick);
  if (me?.role) return me.role;
  const myUid =
    typeof cloudUserId === "function"
      ? String(cloudUserId() || "")
      : typeof chatSocial !== "undefined" && chatSocial?.userId
        ? String(chatSocial.userId)
        : "";
  const leaderId = String(clan.leaderUserId || "");
  if (myUid && leaderId && myUid === leaderId) return "leader";
  if (me && me.userId != null && String(me.userId) === leaderId) return "leader";
  const leader = (clan.members || []).find((m) => String(m.userId) === leaderId);
  if (leader && myNick && leader.nick === myNick) return "leader";
  return me ? "member" : null;
}

function clanCanInvite() {
  const r = clanMyRole();
  return r === "leader" || r === "officer";
}

function clanCanKick() {
  return clanMyRole() === "leader";
}

function clanCanSetRoles() {
  return clanMyRole() === "leader";
}

async function clanSetMemberRole(charName, role) {
  const raw = String(charName || "").trim();
  const next = String(role || "").trim().toLowerCase();
  if (raw.length < 2) {
    return { ok: false, error: "name", message: "Укажи имя персонажа" };
  }
  if (next !== "officer" && next !== "member") {
    return { ok: false, error: "role", message: "Роль: officer или member" };
  }
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const r = await clanApi("/chat/clan/role", {
    method: "POST",
    body: { charName: raw, role: next },
  });
  if (r.ok && typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || chatSocial.clan };
  }
  return r;
}

function clanMemberCount() {
  const c = getChatClan();
  return (c && c.members && c.members.length) || 0;
}

function clanPendingInviteCount() {
  return (clanIncomingInvites || []).length;
}

function clanSetStatus(text, kind) {
  clanStatusText = text || "";
  clanStatusWarn = kind === "warn";
  const el = document.getElementById("clanPanelStatus");
  if (!el) {
    if (text && typeof toast === "function") toast(text, kind === "warn" ? "warn" : "info");
    return;
  }
  el.textContent = clanStatusText;
  el.hidden = !clanStatusText;
  el.classList.toggle("is-warn", !!clanStatusWarn);
}

function syncClanTileMeta() {
  const meta = document.getElementById("clanTileMeta");
  const badge = document.getElementById("clanTileBadge");
  if (meta) {
    if (!clanCloudReady()) meta.textContent = "Облако";
    else if (!getChatClan()) {
      meta.textContent = clanPendingInviteCount() ? "Приглаш." : "Создать";
    } else meta.textContent = clanMemberCount() + "/40";
  }
  if (badge) {
    const n = getChatClan() ? 0 : clanPendingInviteCount();
    badge.hidden = !(n > 0);
    badge.textContent = n > 9 ? "9+" : String(n);
  }
}

async function clanApi(path, opts) {
  try {
    if (typeof chatApi !== "function") {
      return { ok: false, error: "no_api", message: "Нет связи с облаком" };
    }
    const r = await chatApi(path, opts);
    if (r && r.ok === false && !r.message && r.error) {
      return Object.assign({}, r, { message: String(r.error) });
    }
    return r;
  } catch (_) {
    return { ok: false, offline: true, error: "offline", message: "Нет связи с облаком" };
  }
}

async function refreshClanInvites() {
  if (!clanCloudReady()) {
    clanIncomingInvites = [];
    clanLastPromptedInviteId = "";
    syncClanTileMeta();
    return;
  }
  try {
    const r = await clanApi("/chat/clan/invites", { method: "GET" });
    if (r && r.ok) clanIncomingInvites = r.invites || [];
  } catch (_) {
    /* offline */
  }
  syncClanTileMeta();
  if (typeof maybePromptClanInvite === "function") maybePromptClanInvite();
}

async function maybePromptClanInvite() {
  if (clanInvitePromptBusy || !clanCloudReady()) return;
  if (typeof getChatClan === "function" && getChatClan()) {
    // уже в клане — входящие не показываем (сервер всё равно отклонит accept)
    return;
  }
  const backdrop = document.getElementById("modalBackdrop");
  if (backdrop && !backdrop.hidden) return;
  const inv = (clanIncomingInvites || [])[0];
  if (!inv || !inv.id) {
    clanLastPromptedInviteId = "";
    return;
  }
  if (inv.id === clanLastPromptedInviteId) return;
  if (typeof showConfirm !== "function") return;

  clanInvitePromptBusy = true;
  clanLastPromptedInviteId = inv.id;
  try {
    const from = inv.fromName || inv.fromNick || "Игрок";
    const clanName = inv.clanName || "Клан";
    const esc =
      typeof escHtml === "function"
        ? escHtml
        : (s) =>
            String(s == null ? "" : s)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");
    const ok = await showConfirm({
      title: "Приглашение в клан",
      html:
        '<div class="clan-invite-modal">' +
        '<p class="clan-invite-modal-kicker">Вас приглашают вступить</p>' +
        '<p class="clan-invite-modal-clan">' +
        esc(clanName) +
        "</p>" +
        '<p class="clan-invite-modal-from">от <b>' +
        esc(from) +
        "</b></p>" +
        '<p class="clan-invite-modal-hint">Принять — станете участником. Отклонить — приглашение сгорит.</p>' +
        "</div>",
      okText: "Принять",
      cancelText: "Отклонить",
    });
    const r = await clanRespondInvite(inv.id, !!ok);
    if (ok) {
      if (r && r.ok) {
        if (typeof toast === "function") toast("Вы вступили в клан «" + clanName + "»", "success");
        if (typeof clanSetStatus === "function") clanSetStatus("Вы вступили в клан");
      } else if (typeof toast === "function") {
        toast((r && (r.message || r.error)) || "Не удалось принять", "warn");
      }
    } else if (typeof toast === "function") {
      toast("Приглашение отклонено", "info");
    }
    if (typeof syncChatComposeUi === "function") syncChatComposeUi();
    if (document.getElementById("screen-clan")?.classList.contains("active")) {
      if (typeof renderClanScreen === "function") renderClanScreen();
    }
  } finally {
    clanInvitePromptBusy = false;
    clanLastPromptedInviteId = "";
    // следующее приглашение в очереди
    if ((clanIncomingInvites || []).length) {
      setTimeout(() => {
        if (typeof maybePromptClanInvite === "function") maybePromptClanInvite();
      }, 80);
    }
  }
}

async function clanCreate(name) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  if (n.length < 3) {
    return { ok: false, error: "name", message: "Имя клана: минимум 3 символа" };
  }
  if (!clanCloudReady()) {
    return { ok: false, error: "auth", message: "Нужен вход в облако и персонаж" };
  }
  const r = await clanApi("/chat/clan/create", { method: "POST", body: { name: n } });
  if (r.ok && typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || null };
  }
  return r;
}

async function clanLeave() {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const r = await clanApi("/chat/clan/leave", { method: "POST", body: {} });
  if (r.ok && typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || chatSocial.party, clan: null };
  }
  return r;
}

async function clanInvite(charName) {
  const raw = String(charName || "").trim();
  if (raw.length < 2) {
    return { ok: false, error: "name", message: "Укажи имя персонажа" };
  }
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  return clanApi("/chat/clan/invite", { method: "POST", body: { charName: raw } });
}

async function clanKick(charName) {
  const raw = String(charName || "").trim();
  if (raw.length < 2) {
    return { ok: false, error: "name", message: "Укажи имя персонажа" };
  }
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const r = await clanApi("/chat/clan/kick", { method: "POST", body: { charName: raw } });
  if (r.ok && typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || chatSocial.clan };
  }
  return r;
}

async function clanRespondInvite(inviteId, accept) {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const r = await clanApi("/chat/clan/invite/respond", {
    method: "POST",
    body: { inviteId, accept: !!accept },
  });
  if (r.ok && typeof chatSocial !== "undefined") {
    chatSocial = { party: r.party || chatSocial.party, clan: r.clan || chatSocial.clan };
  }
  await refreshClanInvites();
  return r;
}

/** @type {object|null} */
let clanWarehouseState = null;
let clanWarehouseDraft = "";

function clanActiveCharacterId() {
  if (state?.activeCharacterId) return String(state.activeCharacterId);
  if (typeof resolveActiveCharacterId === "function") {
    try {
      return resolveActiveCharacterId(state) || "";
    } catch (_) {}
  }
  const chars = state?.characters;
  if (Array.isArray(chars) && chars[0]?.id) return String(chars[0].id);
  return "";
}

function applyClanSave(save) {
  if (!save || !save.data) return false;
  if (typeof applyCloudSaveData === "function") {
    applyCloudSaveData(save.data, save.seq, save.savedAt);
    return true;
  }
  return false;
}

async function clanRefreshTerritories() {
  if (!clanCloudReady()) return { ok: false };
  try {
    const r = await clanApi("/chat/clan/territories", { method: "GET" });
    if (r && r.ok && typeof applyClanTerritoryHolders === "function") {
      applyClanTerritoryHolders(r.holders || []);
    }
    return r || { ok: false };
  } catch (_) {
    return { ok: false, offline: true };
  }
}

async function clanClaimTerritory(territoryId) {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const r = await clanApi("/chat/clan/territories/claim", {
    method: "POST",
    body: { territoryId },
  });
  if (r && r.ok && typeof applyClanTerritoryHolders === "function") {
    applyClanTerritoryHolders(r.holders || []);
  }
  return r;
}

async function clanContestTerritory(territoryId) {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const r = await clanApi("/chat/clan/territories/contest", {
    method: "POST",
    body: { territoryId },
  });
  if (r && r.ok && typeof applyClanTerritoryHolders === "function") {
    applyClanTerritoryHolders(r.holders || []);
  }
  return r;
}

async function clanReleaseTerritory(territoryId) {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const r = await clanApi("/chat/clan/territories/release", {
    method: "POST",
    body: { territoryId },
  });
  if (r && r.ok && typeof applyClanTerritoryHolders === "function") {
    applyClanTerritoryHolders(r.holders || []);
  }
  return r;
}

async function clanRefreshWarehouse() {
  if (!clanCloudReady() || !getChatClan()) {
    clanWarehouseState = null;
    return { ok: false };
  }
  try {
    const r = await clanApi("/chat/clan/warehouse", { method: "GET" });
    if (r && r.ok) clanWarehouseState = r;
    return r || { ok: false };
  } catch (_) {
    return { ok: false, offline: true };
  }
}

/**
 * Парсер суммы склада: 1500000 | 1.5kk | 10kkk | 10ккк.
 * (Раньше replace(/\D/) резал суффиксы → «10kkk» становилось «10».)
 */
function parseClanAdenaAmount(raw) {
  let s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return 0;
  s = s.replace(/[\s\u00a0\u202f,]/g, "");
  s = s.replace(/к/g, "k");
  const m = s.match(/^(\d+(?:\.\d+)?)(kkk|kk|k)?$/);
  if (m) {
    const mult = m[2] === "kkk" ? 1e9 : m[2] === "kk" ? 1e6 : m[2] === "k" ? 1e3 : 1;
    const n = parseFloat(m[1]) * mult;
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.round(n));
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n));
}

async function clanWarehouseDeposit(amount) {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const characterId = clanActiveCharacterId();
  if (!characterId) return { ok: false, error: "character", message: "Нет активного персонажа" };
  const body =
    typeof leaseBody === "function"
      ? leaseBody({ amount, characterId })
      : { amount, characterId };
  const r = await clanApi("/chat/clan/warehouse/deposit", { method: "POST", body });
  if (r && r.ok) {
    if (r.save) applyClanSave(r.save);
    clanWarehouseState = Object.assign({}, clanWarehouseState || {}, {
      adena: r.adena,
      canWithdraw: clanWarehouseState?.canWithdraw,
    });
  }
  return r;
}

async function clanWarehouseWithdraw(amount) {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  const characterId = clanActiveCharacterId();
  if (!characterId) return { ok: false, error: "character", message: "Нет активного персонажа" };
  const body =
    typeof leaseBody === "function"
      ? leaseBody({ amount, characterId })
      : { amount, characterId };
  const r = await clanApi("/chat/clan/warehouse/withdraw", { method: "POST", body });
  if (r && r.ok) {
    if (r.save) applyClanSave(r.save);
    clanWarehouseState = Object.assign({}, clanWarehouseState || {}, {
      adena: r.adena,
      canWithdraw: true,
    });
  }
  return r;
}

/** @type {object|null} */
let clanBuffState = null;

async function clanRefreshBuffs() {
  if (!clanCloudReady() || !getChatClan()) {
    clanBuffState = null;
    return { ok: false };
  }
  try {
    const r = await clanApi("/chat/clan/buffs", { method: "GET" });
    if (r && r.ok) clanBuffState = r;
    return r || { ok: false };
  } catch (_) {
    return { ok: false, offline: true };
  }
}

async function clanStudyBuff(buffId) {
  if (!clanCloudReady()) return { ok: false, error: "auth", message: "Нужен вход в облако" };
  if (!getChatClan()) return { ok: false, error: "clan", message: "Нужен клан" };
  const characterId =
    typeof clanActiveCharacterId === "function" ? clanActiveCharacterId() : state?.activeCharacterId || "";
  const r = await clanApi("/chat/clan/buffs/study", {
    method: "POST",
    body: { buffId, characterId },
  });
  if (r && r.ok) {
    clanBuffState = r;
    if (typeof clanRefreshWarehouse === "function") {
      try {
        await clanRefreshWarehouse();
      } catch (_) {}
    }
  }
  return r || { ok: false };
}

function clanBuffAdenaPct() {
  return Math.max(0, Number(clanBuffState?.adenaPct) || 0);
}

function clanBuffXpPct() {
  return Math.max(0, Number(clanBuffState?.xpPct) || 0);
}

function clanBuffPvpPct() {
  return Math.max(0, Number(clanBuffState?.pvpPct) || 0);
}

function clanBuffPvpDefPct() {
  return Math.max(0, Number(clanBuffState?.pvpDefPct) || 0);
}

async function clanRefreshSocial() {
  if (!clanCloudReady()) return { ok: false };
  try {
    const r = await clanApi("/chat/social", { method: "GET" });
    if (r && r.ok && typeof chatSocial !== "undefined") {
      chatSocial = {
        party: r.party !== undefined ? r.party : chatSocial.party,
        clan: r.clan !== undefined ? r.clan : chatSocial.clan,
      };
    }
  } catch (_) {}
  await refreshClanInvites();
  await clanRefreshTerritories();
  if (getChatClan()) {
    await clanRefreshWarehouse();
    await clanRefreshBuffs();
    if (typeof clanRefreshBoss === "function") await clanRefreshBoss();
  } else {
    clanWarehouseState = null;
    clanBuffState = null;
    if (typeof clanBossStateCache !== "undefined") clanBossStateCache = null;
  }
  _clanHydrateAt = Date.now();
  return { ok: true };
}

/** Holder/buffs вне экрана Клан (фарм-хаб, mine HUD). Throttle ~15с. */
let _clanHydrateAt = 0;
let _clanHydrateBusy = false;
async function clanHydrateWorldState(force) {
  if (!clanCloudReady()) return { ok: false };
  const now = Date.now();
  if (!force && (now - _clanHydrateAt < 15000 || _clanHydrateBusy)) return { ok: true, skipped: true };
  _clanHydrateBusy = true;
  try {
    await refreshClanInvites();
    await clanRefreshTerritories();
    if (getChatClan()) await clanRefreshBuffs();
    else clanBuffState = null;
    _clanHydrateAt = Date.now();
    if (typeof syncClanTileMeta === "function") syncClanTileMeta();
    if (typeof syncMineClanTerritoryHud === "function") syncMineClanTerritoryHud();
    const menuOn = document.getElementById("screen-menu")?.classList.contains("active");
    if (menuOn && typeof renderMenuFarmHub === "function") renderMenuFarmHub();
    return { ok: true };
  } catch (_) {
    return { ok: false };
  } finally {
    _clanHydrateBusy = false;
  }
}

function startClanPanelPoll() {
  if (clanPollTimer) return;
  clanPollTimer = setInterval(() => {
    const clanOn = document.getElementById("screen-clan")?.classList.contains("active");
    const groundsOn = document.getElementById("screen-clan-grounds")?.classList.contains("active");
    const whOn = document.getElementById("screen-clan-warehouse")?.classList.contains("active");
    const buffsOn = document.getElementById("screen-clan-buffs")?.classList.contains("active");
    if ((!clanOn && !groundsOn && !whOn && !buffsOn) || !clanCloudReady()) return;
    clanRefreshSocial().then(() => {
      if (typeof applyClanScreenLiveRefresh === "function") applyClanScreenLiveRefresh();
      else if (typeof renderClanScreen === "function") renderClanScreen();
    });
  }, 4000);
}
