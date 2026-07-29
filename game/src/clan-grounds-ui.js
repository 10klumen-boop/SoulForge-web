// ===== Клан: города → угодья (slide-навигация, фиксированная ширина) =====

/** null = список городов; иначе hubId открытого города */
let clanGroundsViewHubId = null;
let clanGroundsSelectedId = null;
let clanGroundsAnimTimer = null;

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
  if (farm.siegeEnabled) flag = '<span class="clan-grounds-tile-flag siege">осада</span>';
  else if (farm.capturable) flag = '<span class="clan-grounds-tile-flag">later</span>';
  else if (!farm.live) flag = '<span class="clan-grounds-tile-flag soon">скоро</span>';

  const sub = st.isMine
    ? "ваш · +" + (farm.holderBonus?.adenaPct || 0) + "%"
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

  if (st.canSiegeClaim) {
    if (!st.me) {
      claimHint = '<p class="clan-grounds-claim-hint">Чтобы захватить — вступи в клан</p>';
    } else if (!st.officerOk) {
      claimHint =
        '<p class="clan-grounds-claim-hint">Захват узла — лидер или офицер (ты: ' +
        clanGroundsEsc(st.role || "участник") +
        ")</p>";
    } else if (!st.holder) {
      const claimCost =
        typeof clanTerritoryClaimCost === "function"
          ? clanTerritoryClaimCost(farm)
          : Math.max(5_000_000, Number(farm.rentPerDay) || 0) * 100;
      const claimTxt = typeof fmt === "function" ? fmt(claimCost) : String(claimCost);
      actions +=
        '<button type="button" class="party-panel-btn party-inst-primary" data-clan-claim="' +
        farm.id +
        '">Захватить узел</button>';
      claimHint =
        '<p class="clan-grounds-claim-hint">Захват свободного узла: ' +
        claimTxt +
        " adena со склада</p>";
    } else if (st.isMine) {
      actions +=
        '<button type="button" class="party-panel-btn ghost" data-clan-release="' +
        farm.id +
        '">Снять захват</button>';
    } else {
      const cost =
        typeof clanTerritoryContestCost === "function"
          ? clanTerritoryContestCost(farm, st.holder)
          : Math.max(10_000_000, Number(farm.rentPerDay) || 0) * 200;
      const costTxt = typeof fmt === "function" ? fmt(cost) : String(cost);
      const powerRu = st.holder.siegePowerRu || st.holder.siegePower || "";
      const score = st.holder.siegeScore != null ? st.holder.siegeScore : null;
      actions +=
        '<button type="button" class="party-panel-btn party-inst-primary" data-clan-contest="' +
        farm.id +
        '">Отбить узел</button>';
      claimHint =
        '<p class="clan-grounds-claim-hint">Занято «' +
        clanGroundsEsc(st.ownerName) +
        '»' +
        (powerRu
          ? " · сила осады: " +
            clanGroundsEsc(powerRu) +
            (score != null ? " (" + score + ")" : "")
          : "") +
        " · отбитие " +
        costTxt +
        " adena со склада · защита 30 мин</p>";
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
  if (farm.siegeEnabled) badges += '<span class="clan-grounds-badge siege">осада</span>';
  else if (farm.capturable) badges += '<span class="clan-grounds-badge">захват later</span>';
  if (!farm.live) {
    badges +=
      '<span class="clan-grounds-badge soon">' +
      (farm.status === "draft" ? "черновик" : "скоро") +
      "</span>";
  }

  const bonus =
    farm.siegeEnabled && farm.holderBonus?.adenaPct
      ? " · +" + farm.holderBonus.adenaPct + "% holder"
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
    claimHint +
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
    " угодий · захват на всех · лимит 2 farm</p>" +
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
  box.querySelectorAll("[data-clan-contest]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      let r = { ok: false, message: "Ошибка" };
      try {
        r =
          typeof clanContestTerritory === "function"
            ? await clanContestTerritory(btn.getAttribute("data-clan-contest"))
            : { ok: false, message: "Отбитие только онлайн" };
      } catch (_) {
        r = { ok: false, message: "Нет связи с облаком" };
      }
      btn.disabled = false;
      await clanGroundsAfterMutation(r, { contested: true });
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
