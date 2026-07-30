// ===== Clan UI: экран меню «Клан» (создание / состав / карта) =====

/** Выбранная плитка на экране баффов (legacy, больше не используется) */
let clanBuffsSelectedKey = null;

function openClanScreen() {
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  else if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  if (typeof show === "function") show("clan");
  renderClanScreen();
  clanRefreshSocial().then(() => renderClanScreen());
  if (typeof getChatClan === "function" && getChatClan()) {
    const refreshHub = () => {
      if (document.getElementById("screen-clan")?.classList.contains("active")) {
        renderClanScreen();
      }
    };
    if (typeof clanRefreshWarehouse === "function") clanRefreshWarehouse().then(refreshHub);
    if (typeof clanRefreshBuffs === "function") clanRefreshBuffs().then(refreshHub);
    if (typeof clanRefreshBoss === "function") clanRefreshBoss().then(refreshHub);
  }
  startClanPanelPoll();
}

function bindClanMenuTile() {
  const tile = document.getElementById("clanTile");
  if (!tile || tile._bound) return;
  tile._bound = true;
  tile.onclick = () => openClanScreen();
  tile.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openClanScreen();
    }
  };
}

function roleRu(role) {
  if (role === "leader") return "лидер";
  if (role === "officer") return "офицер";
  return "участник";
}

function roleRuHint(role) {
  if (role === "leader") return "полное управление · назначает офицеров";
  if (role === "officer") return "приглашения · захват · склад · отбитие";
  return "взносы · фарм бонус";
}

function clanEscHtml(s) {
  if (typeof escHtml === "function") return escHtml(s);
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clanMemberJoinedLabel(joinedAt) {
  const t = Number(joinedAt) || 0;
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const dayMs = 86400000;
  const days = Math.floor((now - t) / dayMs);
  if (days < 0) return "";
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return days + " дн. назад";
  if (days < 30) return Math.floor(days / 7) + " нед. назад";
  try {
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch (_) {
    return d.toISOString().slice(0, 10);
  }
}

function clanMemberRoleRank(role) {
  if (role === "leader") return 0;
  if (role === "officer") return 1;
  return 2;
}

function clanSortedMembers(clan) {
  const list = (clan && clan.members) || [];
  return list.slice().sort((a, b) => {
    const ra = clanMemberRoleRank(a.role || (a.userId === clan.leaderUserId ? "leader" : "member"));
    const rb = clanMemberRoleRank(b.role || (b.userId === clan.leaderUserId ? "leader" : "member"));
    if (ra !== rb) return ra - rb;
    const ta = Number(a.joinedAt) || 0;
    const tb = Number(b.joinedAt) || 0;
    if (ta && tb && ta !== tb) return ta - tb;
    const na = String(a.name || a.nick || "").toLowerCase();
    const nb = String(b.name || b.nick || "").toLowerCase();
    return na.localeCompare(nb, "ru");
  });
}

function renderClanIncomingBlock() {
  const list = clanIncomingInvites || [];
  if (!list.length) return "";
  const n = list.length;
  return (
    '<div class="clan-invite-pending-hint">' +
    "<strong>Входящие приглашения: " +
    n +
    "</strong>" +
    '<p class="party-panel-hint">Откроется отдельное окно — Принять или Отклонить.</p>' +
    '<button type="button" class="party-panel-btn party-inst-primary" id="clanInvitePromptBtn">Открыть приглашение</button>' +
    "</div>"
  );
}

/** Приглашение в клан — отдельная карточка над составом. */
function renderClanInviteCard(clan) {
  if (!clanCanInvite()) return "";
  const members = clan ? clanSortedMembers(clan) : [];
  const free = Math.max(0, 40 - members.length);
  return (
    '<div class="party-screen-card clan-invite-card">' +
    '<div class="party-panel-head"><span>Приём в клан</span></div>' +
    '<div class="party-panel-invite">' +
    '<input type="text" class="party-panel-nick-input" id="clanInviteNick" maxlength="16" ' +
    'placeholder="Имя персонажа" spellcheck="false" autocomplete="off" value="' +
    String(clanInviteDraft || "").replace(/"/g, "&quot;") +
    '" />' +
    '<button type="button" class="party-panel-btn" id="clanInviteBtn">Пригласить</button>' +
    "</div>" +
    '<p class="party-panel-hint">По имени персонажа · свободно слотов: ' +
    free +
    ".</p></div>"
  );
}

function renderClanCreateCard() {
  return (
    '<div class="party-screen-card party-screen-card-roster">' +
    '<div class="party-panel-head"><span>Клан</span><span class="clan-cap-hint">0 / 40</span></div>' +
    '<div class="party-empty clan-empty-create">' +
    "<strong>Основать клан</strong>" +
    "<small>Имя 3–24 · латиница / кириллица / цифры · без пробелов по краям</small>" +
    '<div class="clan-create-row">' +
    '<input type="text" class="party-panel-nick-input" id="clanCreateName" maxlength="24" ' +
    'placeholder="IronPledge" spellcheck="false" autocomplete="off" value="' +
    String(clanCreateDraft || "").replace(/"/g, "&quot;") +
    '" />' +
    '<button type="button" class="party-panel-btn party-inst-primary" id="clanCreateBtn">Создать</button>' +
    "</div>" +
    '<p class="party-panel-hint">Создание и управление — только в этом меню (не в чате).</p>' +
    "</div></div>"
  );
}

function renderClanRosterCard(clan) {
  const role = clanMyRole();
  const canKick = clanCanKick();
  const canRoles = typeof clanCanSetRoles === "function" ? clanCanSetRoles() : canKick;
  const members = clanSortedMembers(clan);
  const myNick = clanMyNick();
  const officers = members.filter((m) => (m.role || "") === "officer").length;
  const leader = members.find((m) => (m.role || "") === "leader");
  const regular = members.filter((m) => {
    const r = m.role || (m.userId === clan.leaderUserId ? "leader" : "member");
    return r === "member";
  }).length;

  const slots = members
    .map((m, i) => {
      const r = m.role || (m.userId === clan.leaderUserId ? "leader" : "member");
      const isLeader = r === "leader";
      const isOfficer = r === "officer";
      const isMe = myNick && (m.nick === myNick || String(m.name || "") === myNick);
      const displayName = m.name || m.nick || "?";
      const accountNick = m.nick && m.name && m.nick !== m.name ? m.nick : "";
      const joined = clanMemberJoinedLabel(m.joinedAt);
      const initial = String(displayName).trim().charAt(0).toUpperCase() || "?";
      let roleActs = "";
      if (canRoles && !isLeader && !isMe) {
        if (isOfficer) {
          roleActs +=
            '<button type="button" class="clan-role-act" data-clan-role="member" data-clan-role-name="' +
            clanEscHtml(displayName) +
            '" title="Снять офицера">Участник</button>';
        } else {
          roleActs +=
            '<button type="button" class="clan-role-act is-promote" data-clan-role="officer" data-clan-role-name="' +
            clanEscHtml(displayName) +
            '" title="Назначить офицером">Офицер</button>';
        }
      }
      const roleKey = isLeader ? "leader" : isOfficer ? "officer" : "member";
      const portraitSrc =
        "assets/ui/clan-role-portrait-" + roleKey + ".png?v=1";
      return (
        '<li class="clan-member-row' +
        (isLeader ? " is-leader" : "") +
        (isOfficer ? " is-officer" : "") +
        (isMe ? " is-me" : "") +
        '">' +
        '<div class="clan-member-avatar clan-member-avatar--' +
        roleKey +
        '" aria-hidden="true" title="' +
        clanEscHtml(roleRu(roleKey)) +
        '">' +
        '<img class="clan-member-portrait" src="' +
        portraitSrc +
        '" alt="" draggable="false" onerror="this.parentNode.classList.add(\'is-fallback\')" />' +
        '<span class="clan-member-avatar-fallback">' +
        clanEscHtml(initial) +
        "</span>" +
        "</div>" +
        '<div class="clan-member-body">' +
        '<div class="clan-member-top">' +
        '<span class="clan-member-name">' +
        (isLeader ? "★ " : "") +
        clanEscHtml(displayName) +
        (isMe ? ' <em class="clan-member-you">вы</em>' : "") +
        "</span>" +
        '<span class="clan-role-tag clan-role-tag--' +
        r +
        '">' +
        roleRu(r) +
        "</span>" +
        "</div>" +
        '<div class="clan-member-meta">' +
        (accountNick
          ? '<span class="clan-member-nick">акк. ' + clanEscHtml(accountNick) + "</span>"
          : '<span class="clan-member-nick">#' + (i + 1) + "</span>") +
        '<span class="clan-member-role-hint">' +
        roleRuHint(r) +
        "</span>" +
        (joined ? '<span class="clan-member-joined">в клане: ' + clanEscHtml(joined) + "</span>" : "") +
        "</div>" +
        (roleActs ? '<div class="clan-member-role-acts">' + roleActs + "</div>" : "") +
        "</div>" +
        (canKick && !isLeader
          ? '<button type="button" class="party-slot-kick clan-member-kick" data-clan-kick="' +
            clanEscHtml(displayName || m.nick || "") +
            '" title="Исключить" aria-label="Исключить">×</button>'
          : '<span class="party-slot-kick-ph" aria-hidden="true"></span>') +
        "</li>"
      );
    })
    .join("");

  return (
    '<div class="party-screen-card party-screen-card-roster">' +
    '<div class="party-panel-head clan-roster-head">' +
    "<span>" +
    clanEscHtml(clan.name || "Клан") +
    "</span>" +
    '<span class="clan-cap-hint">' +
    members.length +
    " / 40</span>" +
    "</div>" +
    '<div class="clan-roster-summary">' +
    '<div class="clan-roster-stat">' +
    "<b>" +
    clanEscHtml((leader && (leader.name || leader.nick)) || "—") +
    "</b><small>лидер</small></div>" +
    '<div class="clan-roster-stat"><b>' +
    officers +
    "/5</b><small>офицеры</small></div>" +
    '<div class="clan-roster-stat"><b>' +
    regular +
    "</b><small>участники</small></div>" +
    '<div class="clan-roster-stat"><b>' +
    roleRu(role) +
    "</b><small>ваша роль</small></div>" +
    "</div>" +
    '<ul class="clan-member-list sf-scroll">' +
    (slots || '<li class="clan-member-empty">Пока никого нет</li>') +
    "</ul>" +
    (canRoles
      ? '<p class="party-panel-hint">Лидер: «Офицер» / «Участник» у игрока (макс. 5 офицеров).</p>'
      : "") +
    '<div class="party-panel-actions">' +
    '<button type="button" class="party-panel-btn ghost" id="clanLeaveBtn">Покинуть клан</button>' +
    "</div></div>"
  );
}

function renderClanHubNav() {
  const clan = typeof getChatClan === "function" ? getChatClan() : null;
  const fmtAdena = typeof fmt === "function" ? fmt : (n) => String(n);
  const holdings =
    clan && typeof clanMyHoldings === "function"
      ? clanMyHoldings().filter((t) => t.kind === "farm")
      : [];
  const wh = typeof clanWarehouseState !== "undefined" ? clanWarehouseState : null;
  const buff = typeof clanBuffState !== "undefined" ? clanBuffState : null;
  const power =
    clan && typeof clanSiegePowerState === "function" ? clanSiegePowerState() : null;

  const groundsMeta = clan
    ? holdings.length
      ? "ваши узлы: " + holdings.length + " · захват и осада"
      : "города → охота · захват узлов"
    : "нужен клан для захвата";
  const whMeta = !clan
    ? "после создания клана"
    : wh
      ? "адена: " + fmtAdena(wh.adena || 0) + (wh.holdings?.length ? " · рента с " + wh.holdings.length : "")
      : "взносы и рента с узлов";
  const buffMeta = !clan
    ? "онлайн + изучение"
    : buff
      ? "ур." +
        (buff.level || 1) +
        " · +" +
        (buff.adenaPct || 0) +
        "% adena" +
        (power ? " · сила " + power.total : "")
      : "уровень · изучение";
  const boss = typeof CLAN_BOSS !== "undefined" ? CLAN_BOSS : null;
  const raidSt = typeof clanBossStateCache !== "undefined" ? clanBossStateCache : null;
  const raidMeta = !clan
    ? "общий бой · 1 / неделю"
    : raidSt && raidSt.run && raidSt.run.status === "active"
      ? "бой · HP " + Math.floor(raidSt.run.hp || 0)
      : raidSt && raidSt.locked
        ? "лимит недели"
        : boss?.labelRu || boss?.name || "Хранитель Клятвы";

  return (
    '<div class="clan-hub-nav clan-hub-nav--4">' +
    '<div class="clan-hub-nav-head">' +
    "<strong>Разделы клана</strong>" +
    '<p class="party-panel-hint">Угодья, склад, баффы и рейд — отдельные экраны.</p>' +
    "</div>" +
    (clan
      ? '<div class="clan-hub-glance">' +
        '<div class="clan-hub-glance-item"><span>Состав</span><b>' +
        ((clan.members && clan.members.length) || 0) +
        "/40</b></div>" +
        '<div class="clan-hub-glance-item"><span>Угодья</span><b>' +
        holdings.length +
        "</b></div>" +
        '<div class="clan-hub-glance-item"><span>Склад</span><b>' +
        (wh ? fmtAdena(wh.adena || 0) : "…") +
        "</b></div>" +
        '<div class="clan-hub-glance-item"><span>Ур.</span><b>' +
        (buff ? buff.level || 1 : "…") +
        "</b></div>" +
        '<div class="clan-hub-glance-item"><span>Бафф</span><b>' +
        (buff ? "+" + (buff.adenaPct || 0) + "%" : "…") +
        "</b></div>" +
        "</div>"
      : "") +
    '<button type="button" class="clan-hub-nav-btn clan-hub-nav-btn--grounds" data-clan-open="grounds">' +
    '<span class="clan-hub-nav-veil" aria-hidden="true"></span>' +
    "<b>Угодья</b><small>" +
    clanEscHtml(groundsMeta) +
    '</small><span class="clan-hub-nav-go" aria-hidden="true">›</span></button>' +
    '<button type="button" class="clan-hub-nav-btn clan-hub-nav-btn--warehouse" data-clan-open="warehouse">' +
    '<span class="clan-hub-nav-veil" aria-hidden="true"></span>' +
    "<b>Склад</b><small>" +
    clanEscHtml(whMeta) +
    '</small><span class="clan-hub-nav-go" aria-hidden="true">›</span></button>' +
    '<button type="button" class="clan-hub-nav-btn clan-hub-nav-btn--buffs" data-clan-open="buffs">' +
    '<span class="clan-hub-nav-veil" aria-hidden="true"></span>' +
    "<b>Баффы</b><small>" +
    clanEscHtml(buffMeta) +
    '</small><span class="clan-hub-nav-go" aria-hidden="true">›</span></button>' +
    '<button type="button" class="clan-hub-nav-btn clan-hub-nav-btn--raid" data-clan-open="raid">' +
    '<span class="clan-hub-nav-veil" aria-hidden="true"></span>' +
    "<b>Рейд клана</b><small>" +
    clanEscHtml(raidMeta) +
    '</small><span class="clan-hub-nav-go" aria-hidden="true">›</span></button>' +
    "</div>"
  );
}

/** @deprecated вкладки заменены отдельными экранами */
function renderClanRightCard() {
  return renderClanHubNav();
}

function openClanGroundsScreen() {
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  else if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  clanRightTab = "grounds";
  if (typeof show === "function") show("clan-grounds");
  renderClanGroundsScreen();
  if (typeof clanHydrateWorldState === "function") clanHydrateWorldState(true);
  startClanPanelPoll();
}

function openClanWarehouseScreen() {
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  else if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  clanRightTab = "warehouse";
  if (typeof show === "function") show("clan-warehouse");
  renderClanWarehouseScreen();
  if (typeof clanRefreshWarehouse === "function") clanRefreshWarehouse().then(() => renderClanWarehouseScreen());
  startClanPanelPoll();
}

function openClanBuffsScreen() {
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  else if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  clanRightTab = "content";
  if (typeof show === "function") show("clan-buffs");
  renderClanBuffsScreen();
  if (typeof clanRefreshBuffs === "function") clanRefreshBuffs().then(() => renderClanBuffsScreen());
  startClanPanelPoll();
}

function openClanRaidScreen() {
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  else if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  clanRightTab = "raid";
  if (typeof show === "function") show("clan-raid");
  renderClanRaidScreen();
  if (typeof clanRefreshBoss === "function") clanRefreshBoss().then(() => renderClanRaidScreen());
  startClanPanelPoll();
}

/** Единая оболочка подэкранов — та же ширина/карточка, что у хаба. */
function clanSubShellHtml(innerHtml) {
  return (
    '<div class="clan-shell">' +
    '<div class="party-screen-card party-screen-card-board clan-sub-panel">' +
    (innerHtml || "") +
    "</div></div>"
  );
}

function renderClanGroundsScreen() {
  const el = document.getElementById("clanGroundsScreenBody");
  if (!el) return;
  bindClanSubBackButtons();
  if (!clanCloudReady()) {
    el.innerHTML = clanSubShellHtml('<p class="party-panel-hint">Нужен вход в облако.</p>');
    return;
  }
  el.innerHTML = clanSubShellHtml(
    typeof renderClanGroundsCard === "function" ? renderClanGroundsCard() : ""
  );
  if (typeof wireClanGroundsCard === "function") wireClanGroundsCard(el);
}

function renderClanWarehouseScreen() {
  const el = document.getElementById("clanWarehouseScreenBody");
  if (!el) return;
  bindClanSubBackButtons();
  if (!clanCloudReady()) {
    el.innerHTML = clanSubShellHtml('<p class="party-panel-hint">Нужен вход в облако.</p>');
    return;
  }
  el.innerHTML = clanSubShellHtml(renderClanWarehouseCard());
  wireClanWarehouseActions(el);
}

function renderClanBuffsScreen() {
  const el = document.getElementById("clanBuffsScreenBody");
  if (!el) return;
  bindClanSubBackButtons();
  if (!clanCloudReady()) {
    el.innerHTML = clanSubShellHtml('<p class="party-panel-hint">Нужен вход в облако.</p>');
    return;
  }
  el.innerHTML = clanSubShellHtml(renderClanBuffsCard());
  wireClanBuffsActions(el);
}

function renderClanRaidScreen() {
  const el = document.getElementById("clanRaidScreenBody");
  if (!el) return;
  bindClanSubBackButtons();
  if (!clanCloudReady()) {
    el.innerHTML = clanSubShellHtml('<p class="party-panel-hint">Нужен вход в облако.</p>');
    return;
  }
  el.innerHTML = clanSubShellHtml(renderClanRaidCard());
  wireClanRaidActions(el);
}

function bindClanSubBackButtons() {
  const pairs = [
    ["clanGroundsBackBtn", openClanScreen],
    ["clanWarehouseBackBtn", openClanScreen],
    ["clanBuffsBackBtn", openClanScreen],
    ["clanRaidBackBtn", openClanScreen],
  ];
  pairs.forEach(([id, fn]) => {
    const btn = document.getElementById(id);
    if (!btn || btn._clanBackBound) return;
    btn._clanBackBound = true;
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      fn();
    };
  });
}

function wireClanWarehouseActions(root) {
  const box = root || document;
  box.querySelectorAll("[data-clan-donate]").forEach((el) => {
    el.onclick = async () => {
      const n = Math.floor(Number(el.getAttribute("data-clan-donate")) || 0);
      if (n < 1) return;
      const have = Math.max(0, Math.floor(Number(state?.adena) || 0));
      if (have < n) {
        clanSetStatus("Недостаточно адены", "warn");
        return;
      }
      el.disabled = true;
      const r = await clanWarehouseDeposit(n);
      el.disabled = false;
      if (!r.ok) {
        clanSetStatus(r.message || r.error || "Ошибка", "warn");
        if (typeof toast === "function") toast(r.message || r.error || "Не удалось пожертвовать", "warn");
      } else {
        const xp = Math.floor(Number(r.xpGained || r.activity?.added) || 0);
        const amtTxt = typeof fmt === "function" ? fmt(r.deposited || n) : String(r.deposited || n);
        clanSetStatus(
          "Пожертвовано " + amtTxt + (xp > 0 ? " · +" + xp + " XP клану" : "")
        );
        if (typeof toast === "function") {
          toast("В казну: " + amtTxt + (xp > 0 ? " (+" + xp + " XP)" : ""), "success");
        }
        if (typeof clanRefreshWarehouse === "function") await clanRefreshWarehouse();
        if (typeof clanRefreshBuffs === "function") await clanRefreshBuffs();
      }
      renderClanWarehouseScreen();
    };
  });
}

function wireClanBuffsActions(root) {
  const box = root || document;
  box.querySelectorAll("[data-clan-buff-tip]").forEach((el) => {
    if (el.dataset.tipWired) return;
    el.dataset.tipWired = "1";
    const show = () => {
      const title = el.getAttribute("data-tip-title") || "";
      const lines = String(el.getAttribute("data-tip-lines") || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!title && !lines.length) return;
      const tip = ensureClanBuffTipEl();
      tip.innerHTML = clanBuffTipHtml(title, lines);
      positionClanBuffTip(tip, el);
    };
    const hide = () => hideClanBuffTip();
    el.addEventListener("mouseenter", show);
    el.addEventListener("mouseleave", hide);
  });
  const scrollBody = document.getElementById("clanBuffsScreenBody");
  if (scrollBody && !scrollBody.dataset.buffTipScrollWired) {
    scrollBody.dataset.buffTipScrollWired = "1";
    scrollBody.addEventListener("scroll", hideClanBuffTip, { passive: true });
  }
  box.querySelectorAll("[data-clan-study]").forEach((el) => {
    el.onclick = async () => {
      const id = el.getAttribute("data-clan-study");
      if (!id) return;
      el.disabled = true;
      const r = await clanStudyBuff(id);
      el.disabled = false;
      if (!r || !r.ok) {
        clanSetStatus((r && (r.message || r.error)) || "Не удалось изучить", "warn");
        if (typeof toast === "function") toast((r && r.message) || "Не удалось изучить", "warn");
      } else {
        const name = r.catalog?.find((c) => c.id === id)?.labelRu || id;
        clanSetStatus("Изучено: " + name);
        if (typeof toast === "function") toast("Клан изучил «" + name + "»", "success");
      }
      hideClanBuffTip();
      renderClanBuffsScreen();
    };
  });
}

function wireClanRaidActions(root) {
  const box = root || document;
  const bossBtn = box.querySelector("#clanBossEnterBtn");
  if (bossBtn) {
    bossBtn.onclick = () => {
      if (typeof startOrJoinClanBoss === "function") startOrJoinClanBoss();
    };
  }
}

const CLAN_BUFF_ICONS = {
  online: "icons/clan/clan_buff_online.png?v=1",
  farm: "icons/clan/clan_buff_greed.png?v=1",
  xp: "icons/clan/clan_buff_wisdom.png?v=1",
  combo: "icons/clan/clan_buff_unity.png?v=1",
  pvp: "icons/pvp_act_attack.png?v=1",
  pvp_def: "icons/pvp_act_guard.png?v=1",
};

/** Каталог ветки: локальный баланс + статус с сервера (чтобы ветки не пропадали на старом API). */
function clanBuffBranchRows(branchId, serverCatalog, buffState) {
  const local =
    typeof CLAN_STUDY_BUFFS !== "undefined"
      ? CLAN_STUDY_BUFFS.filter((d) => (d.branch || "farm") === branchId)
      : [];
  const server = Array.isArray(serverCatalog) ? serverCatalog : [];
  const byId = new Map(server.map((c) => [c.id, c]));
  if (!local.length) {
    return server.filter((c) => (c.branch || "farm") === branchId);
  }
  const clanLevel = Math.max(1, Math.floor(Number(buffState?.level) || 1));
  const oath = Math.max(
    0,
    Math.floor(
      Number(buffState?.myOathSymbols) ||
        Number(state?.materials?.oath_symbol) ||
        0
    )
  );
  const canRole = !!buffState?.canStudy;
  return local.map((def) => {
    const s = byId.get(def.id);
    if (s) return s;
    const reqLvl = Math.max(1, Math.floor(Number(def.reqClanLevel) || 1));
    const levelOk = clanLevel >= reqLvl;
    const cost = Math.max(0, Math.floor(Number(def.costOathSymbol) || 0));
    let lockReason = "";
    if (!levelOk) lockReason = "нужен ур." + reqLvl + " клана";
    else if (!canRole) lockReason = "только лидер/офицер";
    else if (oath < cost) lockReason = "мало Символов Клятвы";
    else lockReason = "нужен перезапуск сервера";
    return {
      id: def.id,
      branch: def.branch || "farm",
      labelRu: def.labelRu,
      descRu: def.descRu,
      adenaPct: def.adenaPct || 0,
      xpPct: def.xpPct || 0,
      pvpPct: def.pvpPct || 0,
      pvpDefPct: def.pvpDefPct || 0,
      costOathSymbol: cost,
      costAdena: 0,
      requires: def.requires,
      reqClanLevel: reqLvl,
      studied: false,
      canStudy: false,
      lockReason,
    };
  });
}

function ensureClanBuffTipEl() {
  let tip = document.getElementById("clanBuffTip");
  if (tip) return tip;
  tip = document.createElement("div");
  tip.id = "clanBuffTip";
  tip.className = "clan-buff-tip";
  tip.hidden = true;
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  return tip;
}

function hideClanBuffTip() {
  const tip = document.getElementById("clanBuffTip");
  if (tip) {
    tip.hidden = true;
    tip.innerHTML = "";
  }
}

function positionClanBuffTip(tip, anchor) {
  const r = anchor.getBoundingClientRect();
  tip.hidden = false;
  tip.style.left = "0px";
  tip.style.top = "0px";
  const tw = tip.offsetWidth || 240;
  const th = tip.offsetHeight || 80;
  let left = r.left + r.width / 2 - tw / 2;
  let top = r.top - th - 8;
  if (top < 8) top = r.bottom + 8;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  tip.style.left = Math.round(left) + "px";
  tip.style.top = Math.round(top) + "px";
}

function clanBuffTipHtml(title, lines) {
  const body = (lines || [])
    .filter(Boolean)
    .map((ln) => '<div class="clan-buff-tip-line">' + clanEscHtml(ln) + "</div>")
    .join("");
  return (
    '<strong class="clan-buff-tip-title">' +
    clanEscHtml(title || "") +
    "</strong>" +
    body
  );
}

function clanBuffIconHtml(opts) {
  const art = opts.art || CLAN_BUFF_ICONS.online;
  const mark = opts.mark
    ? '<span class="clan-buff-ico-mark' +
      (opts.markCls ? " " + opts.markCls : "") +
      '">' +
      clanEscHtml(opts.mark) +
      "</span>"
    : "";
  const tipLines = Array.isArray(opts.tipLines) ? opts.tipLines.filter(Boolean) : [];
  return (
    '<span class="clan-buff-ico' +
    (opts.extraCls || "") +
    '" data-clan-buff-tip="1" data-tip-title="' +
    clanEscHtml(opts.title || opts.label || "") +
    '" data-tip-lines="' +
    clanEscHtml(tipLines.join("|")) +
    '" aria-label="' +
    clanEscHtml(opts.title || opts.label || "") +
    '">' +
    '<span class="clan-buff-ico-frame">' +
    '<img src="' +
    clanEscHtml(art) +
    '" alt="" draggable="false" />' +
    mark +
    "</span></span>"
  );
}

function clanBuffBranchBuyHtml(rows, fmtAdena) {
  const next = rows.find((c) => c.canStudy);
  if (next) {
    const cost = Math.max(0, Math.floor(Number(next.costOathSymbol ?? next.costAdena) || 0));
    return (
      '<button type="button" class="party-panel-btn party-inst-primary clan-buff-buy-btn" data-clan-study="' +
      clanEscHtml(next.id) +
      '">Изучить · ' +
      (typeof fmtAdena === "function" ? fmtAdena(cost) : String(cost)) +
      " симв.</button>"
    );
  }
  const allDone = rows.length && rows.every((c) => c.studied);
  if (allDone) {
    return '<span class="clan-study-badge clan-buff-buy-status">изучено</span>';
  }
  const locked = rows.find((c) => !c.studied);
  return (
    '<span class="clan-study-lock clan-buff-buy-status">' +
    clanEscHtml((locked && locked.lockReason) || "недоступно") +
    "</span>"
  );
}

function clanLevelBarHtml(b) {
  const level = Math.max(1, Math.floor(Number(b.level) || 1));
  const xp = Math.max(0, Math.floor(Number(b.xp) || 0));
  const into = Math.max(0, Math.floor(Number(b.xpIntoLevel) || 0));
  const span = Math.max(0, Math.floor(Number(b.xpLevelSpan) || 0));
  const need = Math.max(0, Math.floor(Number(b.xpToNext) || 0));
  const label = b.levelLabelRu || "";
  const maxLevel = Math.max(level, Math.floor(Number(b.maxLevel) || 5));
  const pct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100;
  const meta =
    level >= maxLevel
      ? "макс. уровень"
      : into + " / " + span + (need ? " · ещё " + need : "");
  return (
    '<div class="clan-level-block">' +
    '<div class="clan-level-head">' +
    "<strong>Ур." +
    level +
    (label ? " " + clanEscHtml(label) : "") +
    "</strong>" +
    "<span>" +
    clanEscHtml(meta) +
    " · XP " +
    xp +
    "</span></div>" +
    '<div class="clan-level-bar" role="progressbar" aria-valuenow="' +
    pct +
    '" aria-valuemin="0" aria-valuemax="100">' +
    '<div class="clan-level-bar-fill" style="width:' +
    pct +
    '%"></div></div>' +
    '<p class="party-panel-hint clan-level-hint">Уровень растёт от пожертвований в казну, угодий и рейда. Сильные баффы открываются с ростом уровня.</p>' +
    "</div>"
  );
}

function renderClanBuffsCard() {
  hideClanBuffTip();
  if (!getChatClan()) {
    return (
      '<div class="clan-stub-card">' +
      "<strong>Клан-баффы</strong>" +
      '<p class="party-panel-hint">Автобафф от онлайна + изучение за Символы Клятвы (рейд). Нужен клан.</p>' +
      "</div>"
    );
  }
  const b = clanBuffState;
  if (!b) {
    return (
      '<div class="clan-stub-card">' +
      "<strong>Клан-баффы</strong>" +
      '<p class="party-panel-hint">Загрузка…</p>' +
      "</div>"
    );
  }
  const fmtAdena = typeof fmt === "function" ? fmt : (n) => String(n);
  const online = b.online || {};
  const tiers = Array.isArray(online.tiers)
    ? online.tiers
    : typeof CLAN_ONLINE_BUFF_TIERS !== "undefined"
      ? CLAN_ONLINE_BUFF_TIERS
      : [];

  const onlineIcons = tiers
    .map((t) => {
      const on = (online.tier || 0) >= t.tier && t.tier > 0;
      const cur = (online.tier || 0) === t.tier;
      return clanBuffIconHtml({
        title: t.labelRu,
        label: t.labelRu,
        art: CLAN_BUFF_ICONS.online,
        tipLines: [
          "Авто при " + t.minOnline + "+ онлайн",
          "+" + t.adenaPct + "% adena · +" + t.xpPct + "% XP",
          cur ? "сейчас активен" : on || t.tier === 0 ? "доступен" : "ещё не открыт",
        ],
        mark: cur ? "●" : on || t.tier === 0 ? "✓" : null,
        markCls: cur ? "is-now" : "",
        extraCls: on || t.tier === 0 ? " is-on" : " is-off",
      });
    })
    .join("");

  const catalog = Array.isArray(b.catalog) ? b.catalog : [];
  const branchBlocks = [
    { id: "farm", title: "+фарм (адена)", hint: "Бонус к адене с online фарма" },
    { id: "xp", title: "+опыт (XP)", hint: "Бонус к опыту персонажа" },
    { id: "pvp", title: "+PvP (урон)", hint: "Бонус к урону на арене" },
    { id: "pvp_def", title: "+PvP (защита)", hint: "Минус к входящему урону на арене" },
    { id: "combo", title: "Единство", hint: "Комбо после I ступени жадности и мудрости" },
  ]
    .map((br) => {
      const rows = clanBuffBranchRows(br.id, catalog, b);
      if (!rows.length) return "";
      const icons = rows
        .map((c) => {
          const parts = [];
          if (c.adenaPct) parts.push("+" + c.adenaPct + "% фарм");
          if (c.xpPct) parts.push("+" + c.xpPct + "% XP");
          if (c.pvpPct) parts.push("+" + c.pvpPct + "% PvP");
          if (c.pvpDefPct) parts.push("−" + c.pvpDefPct + "% вх.");
          const bonus = parts.join(" · ");
          const reqLvl = Math.max(1, Math.floor(Number(c.reqClanLevel) || 1));
          return clanBuffIconHtml({
            title: c.labelRu,
            label: c.labelRu.replace(/\s+/g, "\u00a0"),
            art: CLAN_BUFF_ICONS[br.id] || CLAN_BUFF_ICONS.farm,
            tipLines: [
              c.descRu || bonus,
              "стоимость: " +
                (typeof fmtAdena === "function"
                  ? fmtAdena(c.costOathSymbol ?? c.costAdena ?? 0)
                  : String(c.costOathSymbol ?? c.costAdena ?? 0)) +
                " × Символ Клятвы",
              "нужен ур." + reqLvl + " клана",
              c.studied
                ? "изучено"
                : c.canStudy
                  ? "можно изучить"
                  : c.lockReason || "закрыто",
            ],
            mark: c.studied ? "✓" : c.canStudy ? "!" : null,
            markCls: c.studied ? "is-ok" : c.canStudy ? "is-ready" : "",
            extraCls: c.studied ? " is-on" : c.canStudy ? " is-ready" : " is-off",
          });
        })
        .join("");
      return (
        '<div class="clan-buff-branch">' +
        '<div class="clan-buff-branch-head">' +
        "<strong>" +
        br.title +
        "</strong>" +
        "<span>" +
        br.hint +
        "</span></div>" +
        '<div class="clan-buff-ico-bar">' +
        '<div class="clan-buff-ico-row">' +
        icons +
        "</div>" +
        '<div class="clan-buff-buy-slot">' +
        clanBuffBranchBuyHtml(rows, fmtAdena) +
        "</div></div></div>"
      );
    })
    .join("");

  return (
    '<div class="clan-buffs clan-buffs--compact">' +
    clanLevelBarHtml(b) +
    '<div class="clan-warehouse-head">' +
    "<strong>Итого</strong>" +
    "<span>+" +
    (b.adenaPct || 0) +
    "% фарм · +" +
    (b.xpPct || 0) +
    "% XP · +" +
    (b.pvpPct || 0) +
    "% PvP · −" +
    (b.pvpDefPct || 0) +
    "% вх. · кап " +
    (b.caps?.adenaPct || 22) +
    "/" +
    (b.caps?.xpPct || 20) +
    "/" +
    (b.caps?.pvpPct || 12) +
    "/" +
    (b.caps?.pvpDefPct || 12) +
    "</span>" +
    "</div>" +
    '<div class="clan-buff-section">' +
    '<div class="clan-buff-section-head">' +
    "<strong>Онлайн</strong>" +
    "<span>" +
    (online.count || 0) +
    "/" +
    (online.memberCount || 0) +
    " · " +
    clanEscHtml(online.labelRu || "Тишина") +
    (online.next ? " · +" + online.next.need + " до «" + online.next.labelRu + "»" : "") +
    "</span></div>" +
    '<div class="clan-buff-ico-row">' +
    onlineIcons +
    "</div>" +
    "</div>" +
    '<div class="clan-buff-section">' +
    '<div class="clan-buff-section-head">' +
    "<strong>Изучение</strong>" +
    "<span>" +
    clanEscHtml(b.oathSymbolLabelRu || "Символ Клятвы") +
    " <b>" +
    fmtAdena(b.myOathSymbols != null ? b.myOathSymbols : state?.materials?.oath_symbol || 0) +
    "</b> · лидер/офицер</span></div>" +
    (branchBlocks || '<p class="party-panel-hint">Каталог пуст.</p>') +
    "</div>" +
    (typeof clanSiegePowerCardHtml === "function"
      ? clanSiegePowerCardHtml({ compact: true, score: b.score, weekId: b.weekId })
      : "") +
    "</div>"
  );
}

function renderClanRaidCard() {
  return renderClanBossCard();
}

function renderClanBossCard() {
  const b = typeof CLAN_BOSS !== "undefined" ? CLAN_BOSS : {};
  const st = typeof clanBossStateCache !== "undefined" ? clanBossStateCache : null;
  const run = st && st.run;
  const locked = !!(st && st.locked);
  const active = run && run.status === "active";
  const clears = st ? st.clears || 0 : 0;
  const maxC = st ? st.maxClears || 1 : 1;
  let cta = "";
  if (!getChatClan()) {
    cta = '<p class="party-panel-hint">Нужен клан.</p>';
  } else if (locked && !active) {
    cta = '<p class="party-panel-hint">Лимит недели исчерпан (' + clears + "/" + maxC + ").</p>";
  } else {
    cta =
      '<button type="button" class="party-panel-btn party-inst-primary" id="clanBossEnterBtn">' +
      (active ? (run.inRun ? "Вернуться в бой" : "Войти в бой") : "Начать рейд") +
      "</button>";
  }
  const art =
    (b.mine && b.mine.bgs && b.mine.bgs[0]) ||
    "assets/locations/clan-raid-oathkeeper.jpg?v=1";
  const hpLabel =
    typeof fmt === "function"
      ? fmt(b.baseHpHits || 1_000_000)
      : String(b.baseHpHits || 1_000_000);
  return (
    '<div class="clan-raid">' +
    '<div class="clan-raid-hero">' +
    '<img class="clan-raid-hero-art" src="' +
    clanEscHtml(art) +
    '" alt="" draggable="false" />' +
    '<span class="clan-raid-hero-veil" aria-hidden="true"></span>' +
    '<div class="clan-raid-hero-body">' +
    "<strong>Рейд клана</strong>" +
    "<small>" +
    clanEscHtml(b.labelRu || b.name || "Хранитель Клятвы") +
    "</small>" +
    "</div></div>" +
    '<div class="clan-boss-card clan-raid-card">' +
    "<strong>" +
    clanEscHtml(b.labelRu || b.name || "Рейд клана") +
    "</strong>" +
    '<p class="party-panel-hint">1–15 участников · HP ' +
    hpLabel +
    " · соски и скиллы · +" +
    (typeof fmt === "function" ? fmt(b.rewardRaidMarks || 50) : String(b.rewardRaidMarks || 50)) +
    " " +
    clanEscHtml(b.rewardRaidMarksLabelRu || "Символ Клятвы") +
    " участникам · HP общее на клан (не сбрасывается при выходе)" +
    (b.weeklyClears === 0 ? " · без недельного лимита" : " · 1 / неделю") +
    "</p>" +
    (st && (st.myOathSymbols != null || st.myRaidMarks != null)
      ? '<p class="party-panel-hint">У тебя: <b>' +
        (typeof fmt === "function"
          ? fmt(st.myOathSymbols ?? st.myRaidMarks)
          : String(st.myOathSymbols ?? st.myRaidMarks)) +
        "</b> " +
        clanEscHtml(
          st.oathSymbolLabelRu || st.raidMarksLabelRu || b.rewardRaidMarksLabelRu || "Символ Клятвы"
        ) +
        "</p>"
      : "") +
    (active
      ? '<p class="party-panel-hint">Бой: HP ' +
        Math.floor(run.hp || 0) +
        "/" +
        Math.floor(run.maxHp || 0) +
        " · " +
        (run.memberCount || 0) +
        " в бою</p>"
      : b.weeklyClears === 0
        ? ""
        : '<p class="party-panel-hint">Клиры: ' + clears + "/" + maxC + "</p>") +
    cta +
    "</div></div>"
  );
}

function renderClanWarehouseCard() {
  if (!getChatClan()) {
    return (
      '<div class="clan-stub-card">' +
      "<strong>Клан-склад</strong>" +
      '<p class="party-panel-hint">Сначала создай или вступи в клан.</p>' +
      "</div>"
    );
  }
  const wh = clanWarehouseState;
  if (!wh) {
    return (
      '<div class="clan-stub-card">' +
      "<strong>Клан-склад</strong>" +
      '<p class="party-panel-hint">Загрузка…</p>' +
      "</div>"
    );
  }
  const fmtAdena = typeof fmt === "function" ? fmt : (n) => String(n);
  const holdings = (wh.holdings || [])
    .map((h) => {
      return (
        "<li>" +
        (h.labelRu || h.territoryId) +
        (h.rentPerDay
          ? " · рента " + fmtAdena(h.rentPerDay) + "/сутки"
          : " · без ренты") +
        "</li>"
      );
    })
    .join("");
  const myAdena = fmtAdena(Math.max(0, Math.floor(Number(state?.adena) || 0)));
  const have = Math.max(0, Math.floor(Number(state?.adena) || 0));
  const tiers =
    (wh.donations && wh.donations.length
      ? wh.donations
      : typeof CLAN_DONATIONS !== "undefined"
        ? CLAN_DONATIONS
        : []) || [];
  const donateBtns = tiers
    .map((d) => {
      const amt = Math.floor(Number(d.amount) || 0);
      const xp = Math.floor(Number(d.xp) || 0);
      const label = d.label || String(amt);
      const can = have >= amt;
      return (
        '<button type="button" class="clan-wh-donate' +
        (can ? "" : " is-poor") +
        '" data-clan-donate="' +
        amt +
        '"' +
        (can ? "" : " disabled") +
        ' title="Пожертвовать ' +
        label +
        " · +" +
        xp +
        ' XP клану">' +
        '<span class="clan-wh-donate-amt">' +
        label +
        "</span>" +
        '<span class="clan-wh-donate-xp">+' +
        xp +
        " XP</span>" +
        "</button>"
      );
    })
    .join("");
  return (
    '<div class="clan-warehouse">' +
    '<div class="clan-warehouse-hero" aria-hidden="true">' +
    '<img class="clan-warehouse-hero-art" src="assets/ui/clan-warehouse-keeper.jpg?v=2" alt="" draggable="false" />' +
    "</div>" +
    '<div class="clan-warehouse-panel">' +
    '<div class="clan-warehouse-head">' +
    "<strong>Казна клана</strong>" +
    '<span class="clan-warehouse-adena" title="На складе клана">' +
    fmtAdena(wh.adena || 0) +
    "</span>" +
    "</div>" +
    (wh.rentAdded
      ? '<p class="clan-warehouse-note clan-warehouse-note--rent">Начислена рента: +' +
        fmtAdena(wh.rentAdded) +
        "</p>"
      : "") +
    '<p class="clan-warehouse-note">Пожертвование в казну · без снятия · XP клану по сумме кнопки · рента с узлов → сюда</p>' +
    '<div class="clan-warehouse-balance">У тебя: <b>' +
    myAdena +
    "</b></div>" +
    '<div class="clan-warehouse-donations" role="group" aria-label="Пожертвования">' +
    (donateBtns || '<p class="clan-warehouse-note">Нет доступных сумм</p>') +
    "</div>" +
    (holdings
      ? '<div class="clan-warehouse-holdings"><strong>Узлы</strong><ul>' +
        holdings +
        "</ul></div>"
      : '<p class="clan-warehouse-note">Нет узлов — Угодья → город → Захватить</p>') +
    "</div></div>"
  );
}

function renderClanScreen() {
  syncClanTileMeta();
  const el = document.getElementById("clanScreenBody");
  if (!el) return;

  const focusCreate = document.activeElement && document.activeElement.id === "clanCreateName";
  const focusInvite = document.activeElement && document.activeElement.id === "clanInviteNick";
  const selStart = focusCreate || focusInvite ? document.activeElement.selectionStart : null;
  const selEnd = focusCreate || focusInvite ? document.activeElement.selectionEnd : null;
  const focusId = focusCreate ? "clanCreateName" : focusInvite ? "clanInviteNick" : null;

  if (!clanCloudReady()) {
    el.innerHTML =
      '<div class="party-layout clan-layout">' +
      '<div class="party-col party-col-left"><div class="party-screen-card party-screen-card-roster">' +
      '<div class="party-panel-head"><span>Клан</span></div>' +
      '<p class="party-panel-hint">Нужен <b>вход в облако</b> и активный персонаж.</p>' +
      '<p class="party-panel-hint">Создание клана — только здесь, в меню «Клан».</p>' +
      "</div></div>" +
      '<div class="party-col party-col-right"><div class="party-screen-card party-screen-card-wide party-screen-card-board">' +
      renderClanHubNav() +
      "</div></div></div>";
    wireClanScreenActions(el);
    return;
  }

  const clan = getChatClan();
  const incoming = renderClanIncomingBlock();
  const leftInner = !clan
    ? (incoming
        ? '<div class="party-screen-card clan-invite-card">' +
          '<div class="party-panel-head"><span>Приём в клан</span></div>' +
          incoming +
          "</div>"
        : "") + renderClanCreateCard()
    : renderClanInviteCard(clan) + renderClanRosterCard(clan);

  const statusClass =
    "party-panel-status" + (clanStatusWarn ? " is-warn" : "") + (clanStatusText ? "" : " is-empty");

  el.innerHTML =
    '<div class="party-layout clan-layout">' +
    '<div class="party-col party-col-left">' +
    leftInner +
    '<p class="' +
    statusClass +
    '" id="clanPanelStatus"' +
    (clanStatusText ? "" : " hidden") +
    ">" +
    (clanStatusText || "") +
    "</p>" +
    "</div>" +
    '<div class="party-col party-col-right"><div class="party-screen-card party-screen-card-wide party-screen-card-board">' +
    renderClanHubNav() +
    "</div></div></div>";

  wireClanScreenActions(el);

  if (focusId) {
    const inp = document.getElementById(focusId);
    if (inp) {
      inp.focus();
      if (selStart != null && selEnd != null) {
        try {
          inp.setSelectionRange(selStart, selEnd);
        } catch (_) {}
      }
    }
  }
}

/** Poll: не ломать фокус ввода; иначе полный re-render. */
function applyClanScreenLiveRefresh() {
  syncClanTileMeta();
  const clanOn = document.getElementById("screen-clan")?.classList.contains("active");
  const groundsOn = document.getElementById("screen-clan-grounds")?.classList.contains("active");
  const whOn = document.getElementById("screen-clan-warehouse")?.classList.contains("active");
  const buffsOn = document.getElementById("screen-clan-buffs")?.classList.contains("active");
  const raidOn = document.getElementById("screen-clan-raid")?.classList.contains("active");
  if (!clanOn && !groundsOn && !whOn && !buffsOn && !raidOn) return;
  const typing =
    document.activeElement &&
    (document.activeElement.id === "clanCreateName" ||
      document.activeElement.id === "clanInviteNick" ||
      document.activeElement.id === "clanWhAmount");
  if (typing) {
    const st = document.getElementById("clanPanelStatus");
    if (st && clanStatusText) {
      st.hidden = false;
      st.textContent = clanStatusText;
      st.className =
        "party-panel-status" + (clanStatusWarn ? " is-warn" : "") + (clanStatusText ? "" : " is-empty");
    }
    return;
  }
  if (groundsOn) renderClanGroundsScreen();
  else if (whOn) renderClanWarehouseScreen();
  else if (buffsOn) renderClanBuffsScreen();
  else if (raidOn) renderClanRaidScreen();
  else renderClanScreen();
}

function wireClanScreenActions(root) {
  const createName = root.querySelector("#clanCreateName");
  if (createName) {
    createName.oninput = () => {
      clanCreateDraft = String(createName.value || "");
    };
    createName.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("clanCreateBtn")?.click();
      }
    };
  }
  const createBtn = root.querySelector("#clanCreateBtn");
  if (createBtn) {
    createBtn.onclick = async () => {
      const name = String(
        (document.getElementById("clanCreateName") || {}).value || clanCreateDraft || ""
      ).trim();
      createBtn.disabled = true;
      const r = await clanCreate(name);
      createBtn.disabled = false;
      if (!r.ok) {
        clanSetStatus(r.message || r.error || "Не удалось создать", "warn");
        renderClanScreen();
        return;
      }
      clanCreateDraft = "";
      clanSetStatus("Клан «" + (r.clan?.name || name) + "» создан");
      if (typeof toast === "function") toast("Клан создан", "success");
      if (typeof syncChatComposeUi === "function") syncChatComposeUi();
      renderClanScreen();
    };
  }

  const inviteInp = root.querySelector("#clanInviteNick");
  if (inviteInp) {
    inviteInp.oninput = () => {
      clanInviteDraft = String(inviteInp.value || "");
    };
    inviteInp.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("clanInviteBtn")?.click();
      }
    };
  }
  const inviteBtn = root.querySelector("#clanInviteBtn");
  if (inviteBtn) {
    inviteBtn.onclick = async () => {
      const name = String(
        (document.getElementById("clanInviteNick") || {}).value || clanInviteDraft || ""
      ).trim();
      const r = await clanInvite(name);
      if (!r.ok) {
        clanSetStatus(r.message || r.error || "Не удалось пригласить", "warn");
        renderClanScreen();
        return;
      }
      clanInviteDraft = "";
      clanSetStatus(
        r.pending
          ? "Приглашение отправлено: " + (r.invited || name)
          : "В клане: " + (r.invited || name)
      );
      renderClanScreen();
    };
  }

  const leaveBtn = root.querySelector("#clanLeaveBtn");
  if (leaveBtn) {
    leaveBtn.onclick = async () => {
      const r = await clanLeave();
      if (!r.ok) {
        clanSetStatus(r.message || r.error || "Ошибка", "warn");
        renderClanScreen();
        return;
      }
      clanSetStatus("Вы покинули клан");
      if (typeof syncChatComposeUi === "function") syncChatComposeUi();
      renderClanScreen();
    };
  }

  root.querySelectorAll("[data-clan-kick]").forEach((el) => {
    el.onclick = async () => {
      const r = await clanKick(el.getAttribute("data-clan-kick"));
      if (!r.ok) {
        clanSetStatus(r.message || r.error || "Ошибка кика", "warn");
        renderClanScreen();
        return;
      }
      clanSetStatus("Исключён: " + (r.kicked || ""));
      renderClanScreen();
    };
  });

  root.querySelectorAll("[data-clan-role]").forEach((el) => {
    el.onclick = async () => {
      const name = el.getAttribute("data-clan-role-name");
      const nextRole = el.getAttribute("data-clan-role");
      el.disabled = true;
      const r =
        typeof clanSetMemberRole === "function"
          ? await clanSetMemberRole(name, nextRole)
          : { ok: false, message: "Нет API ролей" };
      el.disabled = false;
      if (!r.ok) {
        clanSetStatus(r.message || r.error || "Не удалось сменить роль", "warn");
        renderClanScreen();
        return;
      }
      clanSetStatus(r.message || "Роль обновлена");
      renderClanScreen();
    };
  });

  root.querySelectorAll("[data-clan-open]").forEach((el) => {
    el.onclick = () => {
      const which = el.getAttribute("data-clan-open");
      if (which === "grounds") openClanGroundsScreen();
      else if (which === "warehouse") openClanWarehouseScreen();
      else if (which === "buffs") openClanBuffsScreen();
      else if (which === "raid") openClanRaidScreen();
    };
  });

  const promptBtn = root.querySelector("#clanInvitePromptBtn");
  if (promptBtn) {
    promptBtn.onclick = () => {
      clanLastPromptedInviteId = "";
      if (typeof maybePromptClanInvite === "function") maybePromptClanInvite();
    };
  }
}
