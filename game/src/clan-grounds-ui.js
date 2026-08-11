// ===== Клан: города → угодья (slide-навигация, фиксированная ширина) =====

/** null = список городов; иначе hubId открытого города */
let clanGroundsViewHubId = null;
let clanGroundsSelectedId = null;
let clanGroundsAnimTimer = null;
/** @type {Record<string, object>} */
let clanGroundsSiegeCache = Object.create(null);

function clanGroundsEsc(s) {
  if (typeof escHtml === "function") return escHtml(s);
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clanGroundsTree() {
  return typeof clanGroundsTreeForGame === "function" ? clanGroundsTreeForGame() : [];
}

function clanGroundsRootEl() {
  return document.getElementById("clanGroundsRoot");
}

function clanGroundsRerender() {
  const groundsOn = document.getElementById("screen-clan-grounds")?.classList.contains("active");
  if (groundsOn && typeof renderClanGroundsScreen === "function") {
    renderClanGroundsScreen();
    return;
  }
  if (typeof renderClanScreen === "function") renderClanScreen();
  else if (typeof renderClan === "function") renderClan();
}

function clanGroundsFarmArt(farm) {
  if (farm && farm.portrait) return farm.portrait;
  const zid = (farm && (farm.farmZoneId || farm.id)) || "";
  if (zid && typeof uiZoneChipIcon === "function") {
    const race =
      typeof state !== "undefined" && state.avatar ? state.avatar.raceId : null;
    return uiZoneChipIcon(zid, race);
  }
  return "icons/btn_farm.png?v=4";
}

function clanGroundsFarmState(farm) {
  const holder =
    farm.live && typeof clanTerritoryHolder === "function"
      ? clanTerritoryHolder(farm.id)
      : null;
  const me = typeof clanMyClanRef === "function" ? clanMyClanRef() : null;
  const meId = me ? String(me.clanId || "") : "";
  const holderId = holder ? String(holder.clanId || "") : "";
  const isMine = !!(meId && holderId && holderId === meId);
  const role = typeof clanMyRole === "function" ? clanMyRole() : null;
  const officerOk = role === "leader" || role === "officer";
  const canSiegeClaim = !!(farm.live && farm.siegeEnabled);
  const ownerName = holder
    ? holder.clanName || "?"
    : farm.live
      ? "нейтрал"
      : "—";
  const ownerShort = isMine ? "ваш клан" : ownerName;
  return { holder, me, isMine, role, officerOk, canSiegeClaim, ownerName, ownerShort };
}

function clanGroundsFarmTileHtml(farm) {
  const st = clanGroundsFarmState(farm);
  const sel = clanGroundsSelectedId === farm.id ? " is-sel" : "";
  const liveCls = farm.live ? " is-live" : " is-soon";
  const siegeCls = farm.siegeEnabled ? " is-siege" : "";
  const mineCls = st.isMine ? " is-mine" : st.holder ? " is-held" : "";
  const framed =
    typeof zoneChipArtIsFramed === "function" &&
    zoneChipArtIsFramed(farm.farmZoneId || farm.id) &&
    !farm.portrait
      ? " is-framed-art"
      : "";

  let flag = "";
  if (farm.siegeEnabled) {
    const wt = typeof clanTerritoryWarTier === "function" ? clanTerritoryWarTier(farm) : "normal";
    if (wt === "flagship") flag = '<span class="clan-grounds-tile-flag siege flagship">флагман</span>';
    else if (wt === "elite") flag = '<span class="clan-grounds-tile-flag siege elite">осада</span>';
    else flag = '<span class="clan-grounds-tile-flag siege">казна</span>';
  } else if (farm.capturable) flag = '<span class="clan-grounds-tile-flag">later</span>';
  else if (!farm.live) flag = '<span class="clan-grounds-tile-flag soon">скоро</span>';

  const adenaB = farm.holderBonus?.adenaPct || 0;
  const xpB = farm.holderBonus?.xpPct || 0;
  const sub = st.isMine
    ? "ваш · +" + adenaB + "%" + (xpB ? " XP+" + xpB + "%" : "")
    : st.holder
      ? clanGroundsEsc(st.ownerShort)
      : farm.live
        ? farm.siegeEnabled
          ? "свободно"
          : "охота"
        : farm.status === "draft"
          ? "черновик"
          : "скоро";

  return (
    '<button type="button" class="clan-grounds-tile' +
    sel +
    liveCls +
    siegeCls +
    mineCls +
    framed +
    '" data-grounds-farm="' +
    farm.id +
    '" title="' +
    clanGroundsEsc(farm.labelRu) +
    '">' +
    '<img class="clan-grounds-tile-art" src="' +
    clanGroundsEsc(clanGroundsFarmArt(farm)) +
    '" alt="" draggable="false" />' +
    '<span class="clan-grounds-tile-veil" aria-hidden="true"></span>' +
    (flag ? '<span class="clan-grounds-tile-flags">' + flag + "</span>" : "") +
    '<span class="clan-grounds-tile-body">' +
    "<strong>" +
    clanGroundsEsc(farm.labelRu) +
    "</strong>" +
    "<small>" +
    sub +
    "</small>" +
    "</span></button>"
  );
}

function clanGroundsFarmDetailHtml(farm) {
  if (!farm) {
    return (
      '<div class="clan-grounds-detail is-empty" id="clanGroundsDetail">' +
      '<p class="party-panel-hint">Выбери угодье на плитке — захват и переход в фарм.</p>' +
      "</div>"
    );
  }

  const st = clanGroundsFarmState(farm);
  let actions = "";
  let claimHint = "";

  const actionSt =
    typeof clanTerritoryActionStatus === "function"
      ? clanTerritoryActionStatus(farm, { holder: st.holder, me: st.me })
      : null;
  const statusBanner = actionSt
    ? '<div class="clan-grounds-status is-' +
      clanGroundsEsc(actionSt.kind) +
      '"><b>' +
      clanGroundsEsc(actionSt.title) +
      "</b><small>" +
      clanGroundsEsc(actionSt.sub) +
      "</small></div>"
    : "";

  if (st.canSiegeClaim) {
    if (!st.me) {
      claimHint = '<p class="clan-grounds-claim-hint">Чтобы захватить — вступи в клан</p>';
    } else if (!st.officerOk) {
      claimHint =
        '<p class="clan-grounds-claim-hint">Захват / осада / отбитие — лидер или офицер (ты: ' +
        clanGroundsEsc(st.role || "участник") +
        "). Участник: фарм бонус и печати на своём узле.</p>";
    } else if (!st.holder) {
      const claimCost =
        typeof clanTerritoryClaimCost === "function"
          ? clanTerritoryClaimCost(farm)
          : Math.max(5_000_000, Number(farm.rentPerDay) || 0) * 100;
      const claimTxt = typeof fmt === "function" ? fmt(claimCost) : String(claimCost);
      actions +=
        '<button type="button" class="party-panel-btn party-inst-primary" data-clan-claim="' +
        farm.id +
        '">Захватить (казна)</button>';
      claimHint =
        '<p class="clan-grounds-claim-hint"><b>Захват (казна)</b> · свободный узел: ' +
        claimTxt +
        " adena со склада · защита 24 ч</p>";
    } else if (st.isMine) {
      actions +=
        '<button type="button" class="party-panel-btn ghost" data-clan-release="' +
        farm.id +
        '">Снять захват</button>';
      if (typeof clanTerritoryIsEliteWar === "function" && clanTerritoryIsEliteWar(farm)) {
        const win =
          typeof clanSiegeWindowForTerritory === "function"
            ? clanSiegeWindowForTerritory(farm, Date.now())
            : null;
        claimHint =
          '<p class="clan-grounds-claim-hint"><b>Осада</b> · ' +
          clanGroundsEsc(
            typeof clanSiegeSlotLabelRu === "function"
              ? clanSiegeSlotLabelRu(farm.siegeSlotUtc)
              : farm.siegeSlotUtc || "—"
          ) +
          (win && win.open
            ? " · окно ОТКРЫТО · ещё " +
              (typeof clanFormatRemainRu === "function"
                ? clanFormatRemainRu(win.endAt - Date.now())
                : "")
            : win
              ? " · через " +
                (typeof clanFormatRemainRu === "function"
                  ? clanFormatRemainRu(win.startAt - Date.now())
                  : "")
              : "") +
          " · защитник +25% силы</p>";
        if (win && win.open) {
          actions +=
            '<button type="button" class="party-panel-btn party-inst-primary" data-clan-siege-bid="' +
            farm.id +
            '">Заявка на осаду</button>';
        }
      }
      if (
        typeof clanTerritoryIsFlagship === "function" &&
        clanTerritoryIsFlagship(farm)
      ) {
        actions +=
          '<button type="button" class="party-panel-btn ghost" data-clan-open-arena="1">Арена (флагман)</button>';
        actions +=
          '<button type="button" class="party-panel-btn ghost" data-clan-arena-result="' +
          farm.id +
          '">Исход арены</button>';
        if (!claimHint) {
          claimHint =
            '<p class="clan-grounds-claim-hint"><b>Флагман</b> · топ-2 после окна: дуэль на арене (можно без matchId — подхватится последний)</p>';
        }
      }
      // Active assault on our node
      if (st.holder && st.holder.assault && st.holder.assault.status === "active") {
        const a = st.holder.assault;
        claimHint =
          (claimHint || "") +
          '<p class="clan-grounds-claim-hint"><b>Идёт штурм</b> · ' +
          (a.atkScore != null ? a.atkScore : "?") +
          " vs " +
          (a.defScore != null ? a.defScore : "?") +
          " · ещё " +
          (typeof clanFormatRemainRu === "function"
            ? clanFormatRemainRu(Math.max(0, (a.endAt || 0) - Date.now()))
            : "") +
          " · фармите узел за печати</p>";
        if ((a.endAt || 0) <= Date.now()) {
          actions +=
            '<button type="button" class="party-panel-btn party-inst-primary" data-clan-assault-resolve="' +
            farm.id +
            '">Исход штурма</button>';
        }
      }
    } else {
      const isElite =
        typeof clanTerritoryIsEliteWar === "function" && clanTerritoryIsEliteWar(farm);
      const win =
        isElite && typeof clanSiegeWindowForTerritory === "function"
          ? clanSiegeWindowForTerritory(farm, Date.now())
          : null;
      if (isElite && win && win.open) {
        actions +=
          '<button type="button" class="party-panel-btn party-inst-primary" data-clan-siege-bid="' +
          farm.id +
          '">Заявка на осаду</button>';
        claimHint =
          '<p class="clan-grounds-claim-hint"><b>Осада открыта</b> · «' +
          clanGroundsEsc(st.ownerName) +
          "» · исход по силе" +
          (typeof clanTerritoryIsFlagship === "function" && clanTerritoryIsFlagship(farm)
            ? " / арена"
            : "") +
          " · штурм казной закрыт · ещё " +
          (typeof clanFormatRemainRu === "function"
            ? clanFormatRemainRu(win.endAt - Date.now())
            : "") +
          "</p>";
      } else if (isElite) {
        claimHint =
          '<p class="clan-grounds-claim-hint"><b>Только осада</b> · «' +
          clanGroundsEsc(st.ownerName) +
          '» · сила держателя ' +
          (st.holder.rosterPower != null ? st.holder.rosterPower : "—") +
          (win
            ? " · окно через " +
              (typeof clanFormatRemainRu === "function"
                ? clanFormatRemainRu(win.startAt - Date.now())
                : "")
            : "") +
          "</p>";
      } else {
        const a = st.holder && st.holder.assault;
        const prev = st.holder && st.holder.assaultPreview;
        const fee =
          (prev && prev.feeAdena) ||
          st.holder.assaultFee ||
          (typeof clanAssaultFeeFor === "function" ? clanAssaultFeeFor(farm) : 5_000_000);
        const feeTxt = typeof fmt === "function" ? fmt(fee) : String(fee);
        const defP =
          prev && prev.defenderPower != null
            ? prev.defenderPower
            : st.holder.rosterPower != null
              ? st.holder.rosterPower
              : null;
        const atkP = prev && prev.attackerPower != null ? prev.attackerPower : null;
        if (a && a.status === "active") {
          claimHint =
            '<p class="clan-grounds-claim-hint"><b>Штурм идёт</b> · ' +
            (a.atkScore != null ? a.atkScore : "?") +
            " vs " +
            (a.defScore != null ? a.defScore : "?") +
            " · ещё " +
            (typeof clanFormatRemainRu === "function"
              ? clanFormatRemainRu(Math.max(0, (a.endAt || 0) - Date.now()))
              : "") +
            "</p>";
          if ((a.endAt || 0) <= Date.now()) {
            actions +=
              '<button type="button" class="party-panel-btn party-inst-primary" data-clan-assault-resolve="' +
              farm.id +
              '">Исход штурма</button>';
          }
        } else if (prev && prev.canAssault === false) {
          claimHint =
            '<p class="clan-grounds-claim-hint"><b>Штурм недоступен</b> · «' +
            clanGroundsEsc(st.ownerName) +
            "» · " +
            clanGroundsEsc(prev.message || prev.denyReason || "—") +
            (defP != null ? " · сила держателя " + defP : "") +
            (atkP != null ? " · ваша " + atkP : "") +
            "</p>";
        } else {
          actions +=
            '<button type="button" class="party-panel-btn party-inst-primary" data-clan-assault="' +
            farm.id +
            '">Штурм (сила)</button>';
          claimHint =
            '<p class="clan-grounds-claim-hint"><b>Штурм</b> · «' +
            clanGroundsEsc(st.ownerName) +
            '»' +
            (defP != null ? " · сила " + defP + " (+25% защ.)" : "") +
            (atkP != null ? " · ваша " + atkP : "") +
            " · вход " +
            feeTxt +
            " · 4 ч · побеждает сила + печати</p>";
        }
      }
      if (
        typeof clanTerritoryIsFlagship === "function" &&
        clanTerritoryIsFlagship(farm)
      ) {
        actions +=
          '<button type="button" class="party-panel-btn ghost" data-clan-open-arena="1">Арена (флагман)</button>';
        actions +=
          '<button type="button" class="party-panel-btn ghost" data-clan-arena-result="' +
          farm.id +
          '">Исход арены</button>';
      }
    }
  } else if (farm.live && farm.capturable && !farm.siegeEnabled) {
    claimHint = '<p class="clan-grounds-claim-hint">Захват этого угодья ещё не включён</p>';
  } else if (!farm.live) {
    claimHint = '<p class="clan-grounds-claim-hint">Зона в каталоге — фарм/захват позже</p>';
  }

  if (farm.farmZoneId && farm.live) {
    actions +=
      '<button type="button" class="party-panel-btn ghost" data-clan-goto-farm="' +
      farm.farmZoneId +
      '">В фарм</button>';
  }

  let badges = "";
  if (farm.siegeEnabled) {
    const wt = typeof clanTerritoryWarTier === "function" ? clanTerritoryWarTier(farm) : "normal";
    if (wt === "flagship") badges += '<span class="clan-grounds-badge siege">флагман · арена</span>';
    else if (wt === "elite") badges += '<span class="clan-grounds-badge siege">осада (расписание)</span>';
    else badges += '<span class="clan-grounds-badge siege">захват (казна)</span>';
  } else if (farm.capturable) badges += '<span class="clan-grounds-badge">захват later</span>';
  if (!farm.live) {
    badges +=
      '<span class="clan-grounds-badge soon">' +
      (farm.status === "draft" ? "черновик" : "скоро") +
      "</span>";
  }

  const adenaB = farm.holderBonus?.adenaPct || 0;
  const xpB = farm.holderBonus?.xpPct || 0;
  const bonus = farm.siegeEnabled && adenaB
    ? " · +" + adenaB + "% adena" + (xpB ? " · +" + xpB + "% XP" : "") + " holder"
    : "";
  const rentBit = farm.rentPerDay
    ? " · рента " + (typeof fmt === "function" ? fmt(farm.rentPerDay) : farm.rentPerDay) + "/сутки"
    : "";
  const slotBit =
    typeof clanTerritoryIsEliteWar === "function" && clanTerritoryIsEliteWar(farm)
      ? " · слот " +
        (typeof clanSiegeSlotLabelRu === "function"
          ? clanSiegeSlotLabelRu(farm.siegeSlotUtc)
          : farm.siegeSlotUtc || "")
      : "";

  const siegeLive =
    typeof clanTerritoryIsEliteWar === "function" && clanTerritoryIsEliteWar(farm)
      ? '<div class="clan-grounds-siege-live" id="clanGroundsSiegeLive" data-territory="' +
        farm.id +
        '"><p class="party-panel-hint">Загрузка заявок осады…</p></div>'
      : "";
  const historyBox =
    farm.siegeEnabled
      ? '<div class="clan-grounds-history" id="clanGroundsHistory" data-territory="' +
        farm.id +
        '"><p class="party-panel-hint">История узла…</p></div>'
      : "";

  return (
    '<div class="clan-grounds-detail" id="clanGroundsDetail" data-farm-id="' +
    farm.id +
    '">' +
    '<div class="clan-grounds-detail-head">' +
    '<div class="clan-grounds-detail-info">' +
    "<b>" +
    clanGroundsEsc(farm.labelRu) +
    "</b>" +
    '<small class="clan-grounds-farm-meta">' +
    clanGroundsEsc(farm.labelL2 || farm.id) +
    bonus +
    rentBit +
    slotBit +
    "</small>" +
    (badges ? '<div class="clan-grounds-badges">' + badges + "</div>" : "") +
    "</div>" +
    '<span class="clan-grounds-owner' +
    (st.isMine ? " is-mine" : "") +
    '" title="' +
    clanGroundsEsc(st.ownerName) +
    '">' +
    clanGroundsEsc(st.ownerShort) +
    "</span>" +
    "</div>" +
    statusBanner +
    claimHint +
    siegeLive +
    historyBox +
    (actions ? '<div class="clan-grounds-farm-actions">' + actions + "</div>" : "") +
    "</div>"
  );
}

function clanGroundsCityArt(hub) {
  if (hub?.cityTerritory?.portrait) return hub.cityTerritory.portrait;
  const withArt = (hub?.farms || []).find((f) => f.portrait);
  if (withArt?.portrait) return withArt.portrait;
  const farm = (hub?.farms || []).find((f) => f.farmZoneId || f.id);
  if (farm) return clanGroundsFarmArt(farm);
  return "icons/btn_farm.png?v=4";
}

function clanGroundsCityBtnHtml(hub) {
  const liveCount = hub.farms.filter((f) => f.live).length;
  const soonCount = hub.farms.length - liveCount;
  const holdings = hub.farms.filter((f) => {
    if (!f.live) return false;
    const h = typeof clanTerritoryHolder === "function" ? clanTerritoryHolder(f.id) : null;
    const me = typeof clanMyClanRef === "function" ? clanMyClanRef() : null;
    return h && me && h.clanId === me.clanId;
  }).length;
  const meta =
    liveCount +
    " угодий" +
    (soonCount ? " · +" + soonCount + " позже" : "") +
    (holdings ? " · ваших " + holdings : "");
  const heldCls = holdings ? " is-held" : "";

  return (
    '<button type="button" class="clan-grounds-city-btn' +
    heldCls +
    '" data-grounds-open="' +
    hub.hubId +
    '">' +
    '<img class="clan-grounds-city-art" src="' +
    clanGroundsEsc(clanGroundsCityArt(hub)) +
    '" alt="" draggable="false" />' +
    '<span class="clan-grounds-city-veil" aria-hidden="true"></span>' +
    '<span class="clan-grounds-city-name">' +
    clanGroundsEsc(hub.labelRu) +
    "</span>" +
    '<span class="clan-grounds-city-meta">' +
    clanGroundsEsc(meta) +
    "</span>" +
    '<span class="clan-grounds-city-go" aria-hidden="true">›</span>' +
    "</button>"
  );
}

function clanGroundsCitiesPaneHtml(tree, holdLine) {
  return (
    '<div class="clan-grounds-intro">' +
    "<strong>Города</strong>" +
    '<p class="party-panel-hint">Список хабов · внутри — плитки охотничьих угодий.</p>' +
    holdLine +
    (typeof clanSiegePowerCardHtml === "function" ? clanSiegePowerCardHtml() : "") +
    "</div>" +
    '<div class="clan-grounds-city-list sf-scroll" role="list">' +
    tree.map(clanGroundsCityBtnHtml).join("") +
    "</div>"
  );
}

function clanGroundsPickDefaultFarm(hub) {
  if (!hub || !hub.farms || !hub.farms.length) return null;
  if (clanGroundsSelectedId && hub.farms.some((f) => f.id === clanGroundsSelectedId)) {
    return hub.farms.find((f) => f.id === clanGroundsSelectedId);
  }
  return (
    hub.farms.find((f) => f.live && f.siegeEnabled) ||
    hub.farms.find((f) => f.live) ||
    hub.farms[0] ||
    null
  );
}

function clanGroundsFarmsPaneHtml(hub) {
  if (!hub) {
    return '<p class="party-panel-hint">Выбери город слева.</p>';
  }
  const selected = clanGroundsPickDefaultFarm(hub);
  clanGroundsSelectedId = selected ? selected.id : null;
  const liveN = hub.farms.filter((f) => f.live).length;
  return (
    '<div class="clan-grounds-nav">' +
    '<button type="button" class="party-panel-btn ghost" data-grounds-back="1">← К городам</button>' +
    "</div>" +
    '<div class="clan-grounds-intro">' +
    "<strong>" +
    clanGroundsEsc(hub.labelRu) +
    "</strong>" +
    '<p class="party-panel-hint">' +
    liveN +
    " угодий · будни: захват (казна) · elite: осада по слоту · лимит 2 farm</p>" +
    "</div>" +
    '<div class="clan-grounds-farm-scroll sf-scroll">' +
    '<div class="clan-grounds-farm-grid" role="list">' +
    hub.farms.map(clanGroundsFarmTileHtml).join("") +
    "</div>" +
    clanGroundsFarmDetailHtml(selected) +
    "</div>"
  );
}

function clanGroundsHoldLineHtml(myHoldings) {
  return myHoldings.length
    ? '<ul class="clan-grounds-holdings">' +
        myHoldings
          .map(
            (t) =>
              "<li><b>" +
              clanGroundsEsc(t.labelRu) +
              "</b>" +
              (t.siegeEnabled ? " · +" + (t.holderBonus?.adenaPct || 0) + "%" : "") +
              "</li>"
          )
          .join("") +
        "</ul>"
    : '<p class="party-panel-hint">Нет ваших угодий — зайди в город и заяви узел с осадой.</p>';
}

/** Вкладка Клан → Угодья: оба экрана в слайдере (ширина не прыгает). */
function renderClanGroundsCard() {
  const tree = clanGroundsTree();
  const myHoldings =
    typeof clanMyHoldings === "function"
      ? clanMyHoldings().filter((t) => t.kind === "farm")
      : [];

  if (!tree.length) {
    return (
      '<div class="clan-grounds" id="clanGroundsRoot">' +
      "<strong>Угодья</strong>" +
      '<p class="party-panel-hint">Пока нет live-городов в данных территорий.</p>' +
      '<a class="party-panel-btn ghost" href="aden-pins.html" target="_blank" rel="noopener">Каталог городов</a>' +
      "</div>"
    );
  }

  let hub = clanGroundsViewHubId
    ? tree.find((h) => h.hubId === clanGroundsViewHubId)
    : null;
  if (clanGroundsViewHubId && !hub) clanGroundsViewHubId = null;
  hub = clanGroundsViewHubId
    ? tree.find((h) => h.hubId === clanGroundsViewHubId)
    : null;

  const view = hub ? "farms" : "cities";
  const holdLine = clanGroundsHoldLineHtml(myHoldings);

  return (
    '<div class="clan-grounds" id="clanGroundsRoot" data-view="' +
    view +
    '">' +
    '<div class="clan-grounds-viewport">' +
    '<div class="clan-grounds-track">' +
    '<div class="clan-grounds-pane clan-grounds-pane-cities">' +
    clanGroundsCitiesPaneHtml(tree, holdLine) +
    "</div>" +
    '<div class="clan-grounds-pane clan-grounds-pane-farms" id="clanGroundsFarmsPane">' +
    clanGroundsFarmsPaneHtml(hub) +
    "</div>" +
    "</div></div>" +
    '<p class="party-panel-status" id="clanGroundsStatus" hidden></p>' +
    "</div>"
  );
}

/** Плавный переход без пересборки всего экрана клана. */
function clanGroundsNavigate(hubId) {
  const root = clanGroundsRootEl();
  if (!root || !root.querySelector(".clan-grounds-track")) {
    clanGroundsViewHubId = hubId || null;
    clanGroundsRerender();
    return;
  }

  if (clanGroundsAnimTimer) {
    clearTimeout(clanGroundsAnimTimer);
    clanGroundsAnimTimer = null;
  }

  if (hubId) {
    const tree = clanGroundsTree();
    const hub = tree.find((h) => h.hubId === hubId);
    if (!hub) return;
    clanGroundsViewHubId = hubId;
    clanGroundsSelectedId = null;
    const farmsPane = root.querySelector("#clanGroundsFarmsPane");
    if (farmsPane) farmsPane.innerHTML = clanGroundsFarmsPaneHtml(hub);
    wireClanGroundsInteractions(root);
    // force reflow then slide
    void root.offsetWidth;
    root.setAttribute("data-view", "farms");
  } else {
    root.setAttribute("data-view", "cities");
    clanGroundsAnimTimer = setTimeout(() => {
      clanGroundsViewHubId = null;
      clanGroundsSelectedId = null;
      const farmsPane = root.querySelector("#clanGroundsFarmsPane");
      if (farmsPane) farmsPane.innerHTML = clanGroundsFarmsPaneHtml(null);
      clanGroundsAnimTimer = null;
    }, 300);
  }
}

async function clanGroundsAfterMutation(r, opts) {
  opts = opts || {};
  if (r && r.ok) {
    if (typeof clanRefreshBuffs === "function") await clanRefreshBuffs();
    if (typeof clanRefreshWarehouse === "function") await clanRefreshWarehouse();
  }
  let msg = (r && (r.message || r.error)) || (r?.ok ? "Ок" : "Ошибка");
  if (r && r.ok && opts.claimed) msg += " · +50 активности";
  if (r && r.ok && opts.contested) msg += " · +75 активности";
  if (typeof clanSetStatus === "function") {
    clanSetStatus(msg, r?.ok ? "" : "warn");
  }
  const status = document.getElementById("clanGroundsStatus");
  if (status) {
    status.hidden = !msg;
    status.textContent = msg;
    status.className = "party-panel-status" + (r?.ok ? "" : " is-warn");
  }
  if (typeof syncMineClanTerritoryHud === "function") syncMineClanTerritoryHud();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();

  // обновить только pane ферм, сохранив слайд
  const root = clanGroundsRootEl();
  const hubId = clanGroundsViewHubId;
  if (root && hubId) {
    const hub = clanGroundsTree().find((h) => h.hubId === hubId);
    const farmsPane = root.querySelector("#clanGroundsFarmsPane");
    if (hub && farmsPane) {
      farmsPane.innerHTML = clanGroundsFarmsPaneHtml(hub);
      wireClanGroundsInteractions(root);
      return;
    }
  }
  clanGroundsRerender();
}

function wireClanGroundsInteractions(box) {
  box = box || document;
  box.querySelectorAll("[data-grounds-open]").forEach((btn) => {
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      clanGroundsNavigate(btn.getAttribute("data-grounds-open"));
    };
  });
  box.querySelectorAll("[data-grounds-back]").forEach((btn) => {
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      clanGroundsNavigate(null);
    };
  });
  box.querySelectorAll("[data-grounds-farm]").forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest && e.target.closest("button") && e.target.closest("button") !== el) {
        return;
      }
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      const id = el.getAttribute("data-grounds-farm");
      clanGroundsSelectedId = id;
      box.querySelectorAll("[data-grounds-farm]").forEach((n) => {
        n.classList.toggle("is-sel", n.getAttribute("data-grounds-farm") === id);
      });
      const hub = clanGroundsTree().find((h) => h.hubId === clanGroundsViewHubId);
      const farm = hub ? hub.farms.find((f) => f.id === id) : null;
      const detail = box.querySelector("#clanGroundsDetail");
      if (detail) {
        detail.outerHTML = clanGroundsFarmDetailHtml(farm);
        wireClanGroundsFarmActions(box);
      }
    };
  });
  wireClanGroundsFarmActions(box);
}

function wireClanGroundsFarmActions(box) {
  box = box || document;
  const siegeEl = box.querySelector("#clanGroundsSiegeLive");
  if (siegeEl && typeof clanSiegeStatus === "function") {
    const tid = siegeEl.getAttribute("data-territory");
    clanSiegeStatus(tid).then((r) => {
      if (!r || !r.ok) {
        siegeEl.innerHTML = '<p class="party-panel-hint">Нет данных осады</p>';
        return;
      }
      clanGroundsSiegeCache[tid] = r;
      const win = r.window;
      const now = Date.now();
      let head = "";
      if (win && win.open) {
        head =
          "<b>Окно открыто</b> · ещё " +
          (typeof clanFormatRemainRu === "function"
            ? clanFormatRemainRu(win.endAt - now)
            : "");
      } else if (win) {
        head =
          "<b>Окно закрыто</b> · через " +
          (typeof clanFormatRemainRu === "function"
            ? clanFormatRemainRu(win.startAt - now)
            : "");
      }
      const costTxt =
        r.bidCost != null
          ? typeof fmt === "function"
            ? fmt(r.bidCost)
            : String(r.bidCost)
          : "—";
      const bids = Array.isArray(r.bids) ? r.bids : [];
      const bidLines = bids.length
        ? "<ul>" +
          bids
            .map(
              (b) =>
                "<li>" +
                clanGroundsEsc(b.clanName || "?") +
                " · " +
                (typeof fmt === "function" ? fmt(b.bidAdena) : b.bidAdena) +
                "</li>"
            )
            .join("") +
          "</ul>"
        : '<p class="party-panel-hint">Заявок пока нет</p>';
      let roundBit = "";
      if (r.round && r.round.status === "awaiting_arena") {
        roundBit =
          '<p class="clan-grounds-claim-hint"><b>Ждём арену</b> · топ-2 клана · дедлайн скоро</p>';
      }
      siegeEl.innerHTML =
        '<div class="clan-grounds-siege-panel">' +
        (head ? "<p>" + head + " · заявка " + costTxt + " adena</p>" : "") +
        "<strong>Заявки на осаду</strong>" +
        bidLines +
        roundBit +
        "</div>";
    });
  }
  const histEl = box.querySelector("#clanGroundsHistory");
  if (histEl && typeof clanTerritoryHistory === "function") {
    const tid = histEl.getAttribute("data-territory");
    clanTerritoryHistory(tid).then((r) => {
      if (!r || !r.ok) {
        histEl.innerHTML = "";
        return;
      }
      const entries = Array.isArray(r.entries) ? r.entries : [];
      if (!entries.length) {
        histEl.innerHTML =
          '<p class="party-panel-hint">История пуста — захват / отбитие / осада появятся здесь.</p>';
        return;
      }
      const eventRu = {
        claim: "захват",
        contest: "отбитие",
        siege: "осада",
        siege_hold: "удержали",
        release: "снят",
      };
      histEl.innerHTML =
        "<strong>История</strong><ul>" +
        entries
          .slice(0, 8)
          .map((e) => {
            const when = e.createdAt
              ? new Date(e.createdAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            return (
              "<li>" +
              clanGroundsEsc(eventRu[e.event] || e.event) +
              (e.clanName ? " · " + clanGroundsEsc(e.clanName) : "") +
              (e.prevClanName ? " ← " + clanGroundsEsc(e.prevClanName) : "") +
              (when ? " · " + clanGroundsEsc(when) : "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    });
  }
  box.querySelectorAll("[data-clan-goto-farm]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const zid = btn.getAttribute("data-clan-goto-farm");
      if (typeof setMenuFarmEntry === "function") setMenuFarmEntry("farm");
      if (typeof selectFarmZone === "function") selectFarmZone(zid);
      if (typeof show === "function") show("menu");
    };
  });
  box.querySelectorAll("[data-clan-claim]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      let r = { ok: false, message: "Ошибка" };
      try {
        r =
          typeof clanClaimTerritory === "function"
            ? await clanClaimTerritory(btn.getAttribute("data-clan-claim"))
            : claimClanTerritoryMock(btn.getAttribute("data-clan-claim"));
      } catch (_) {
        r = { ok: false, message: "Нет связи с облаком" };
      }
      btn.disabled = false;
      await clanGroundsAfterMutation(r, { claimed: true });
    };
  });
  box.querySelectorAll("[data-clan-contest], [data-clan-assault]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      let r = { ok: false, message: "Ошибка" };
      const tid = btn.getAttribute("data-clan-assault") || btn.getAttribute("data-clan-contest");
      try {
        r =
          typeof clanStartAssault === "function"
            ? await clanStartAssault(tid)
            : typeof clanContestTerritory === "function"
              ? await clanContestTerritory(tid)
              : { ok: false, message: "Штурм только онлайн" };
      } catch (_) {
        r = { ok: false, message: "Нет связи с облаком" };
      }
      btn.disabled = false;
      await clanGroundsAfterMutation(r, { contested: true });
    };
  });
  box.querySelectorAll("[data-clan-assault-resolve]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      let r = { ok: false, message: "Ошибка" };
      try {
        r =
          typeof clanResolveAssault === "function"
            ? await clanResolveAssault(btn.getAttribute("data-clan-assault-resolve"))
            : { ok: false, message: "Нет API" };
      } catch (_) {
        r = { ok: false, message: "Нет связи с облаком" };
      }
      btn.disabled = false;
      await clanGroundsAfterMutation(r);
    };
  });
  box.querySelectorAll("[data-clan-release]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      let r = { ok: false, message: "Ошибка" };
      try {
        r =
          typeof clanReleaseTerritory === "function"
            ? await clanReleaseTerritory(btn.getAttribute("data-clan-release"))
            : releaseClanTerritoryMock(btn.getAttribute("data-clan-release"));
      } catch (_) {
        r = { ok: false, message: "Нет связи с облаком" };
      }
      btn.disabled = false;
      await clanGroundsAfterMutation(r);
    };
  });
  box.querySelectorAll("[data-clan-siege-bid]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      let r = { ok: false, message: "Ошибка" };
      try {
        r =
          typeof clanPlaceSiegeBid === "function"
            ? await clanPlaceSiegeBid(btn.getAttribute("data-clan-siege-bid"))
            : { ok: false, message: "Осада только онлайн" };
      } catch (_) {
        r = { ok: false, message: "Нет связи с облаком" };
      }
      btn.disabled = false;
      await clanGroundsAfterMutation(r);
    };
  });
  box.querySelectorAll("[data-clan-open-arena]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (typeof show === "function") show("pvp-arena");
      else if (typeof toast === "function") toast("Открой экран Арены", "info");
    };
  });
  box.querySelectorAll("[data-clan-arena-result]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const tid = btn.getAttribute("data-clan-arena-result");
      btn.disabled = true;
      let r = { ok: false, message: "Ошибка" };
      try {
        // Сначала авто: последний подходящий дуэль; если нет — спросить matchId
        r =
          typeof clanReportSiegeArenaResult === "function"
            ? await clanReportSiegeArenaResult(tid, 0)
            : { ok: false, message: "Нет API" };
        if (!r.ok && r.error === "match") {
          const raw = window.prompt("matchId дуэли (или пусто — отмена):", "");
          const matchId = Math.floor(Number(raw) || 0);
          if (matchId) {
            r = await clanReportSiegeArenaResult(tid, matchId);
          }
        }
      } catch (_) {
        r = { ok: false, message: "Нет связи" };
      }
      btn.disabled = false;
      await clanGroundsAfterMutation(r);
    };
  });
}

function wireClanGroundsCard(root) {
  wireClanGroundsInteractions(root || document);
}

function renderClanMapCard() {
  return renderClanGroundsCard();
}

function wireClanMapCard(root) {
  wireClanGroundsCard(root);
}

function wireClanMapInteractions(root) {
  wireClanGroundsCard(root);
}

function openAdenMapScreen() {
  if (typeof clanRightTab !== "undefined") clanRightTab = "grounds";
  clanGroundsViewHubId = null;
  if (typeof openClanScreen === "function") openClanScreen();
  else if (typeof show === "function") show("clan");
}

function closeAdenMapScreen() {
  if (typeof openClanScreen === "function") openClanScreen();
  else if (typeof show === "function") show("clan");
}

function refreshClanMapLive() {
  return false;
}
