// ===== Aden map screen: fullscreen + regions + routes + pins =====

let clanMapFilter = "all"; // all | farm | city
let clanMapSelectedId = null;
let clanMapSelectedRegionId = null;
let clanMapZoom = 1;
let clanMapPanX = 0;
let clanMapPanY = 0;
let clanMapDragging = false;
let clanMapDragStart = null;
let clanMapDragMoved = false;
let adenMapBackTo = "clan";

function clanMapEsc(s) {
  if (typeof escHtml === "function") return escHtml(s);
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clanMapPinClass(t) {
  const holder = typeof clanTerritoryHolder === "function" ? clanTerritoryHolder(t.id) : null;
  const me = typeof clanMyClanRef === "function" ? clanMyClanRef() : null;
  const isMine = !!(holder && me && holder.clanId === me.clanId);
  let cls = "clan-map-pin kind-" + (t.kind || "farm");
  if (t.siegeEnabled) cls += " siege is-mvp";
  const wt = typeof clanTerritoryWarTier === "function" ? clanTerritoryWarTier(t) : t.warTier;
  if (wt === "elite") cls += " is-elite";
  if (wt === "flagship") cls += " is-flagship";
  if (!holder) cls += " is-neutral";
  else if (isMine) cls += " is-mine is-owned";
  else cls += " is-owned";
  if (clanMapSelectedId === t.id) cls += " is-sel";
  return cls;
}

function clanMapFilteredTerritories() {
  const all = typeof CLAN_TERRITORIES !== "undefined" ? CLAN_TERRITORIES : [];
  if (clanMapFilter === "farm") return all.filter((t) => t.kind === "farm");
  if (clanMapFilter === "city") return all.filter((t) => t.kind === "city");
  return all.slice();
}

function clanMapViewportEl() {
  return document.getElementById("adenMapViewport");
}

function clanMapStageEl() {
  return document.getElementById("adenMapStage");
}

function openAdenMapScreen(backTo) {
  adenMapBackTo = backTo || "clan";
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  else if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  bindAdenMapBack();
  const backBtn = document.getElementById("adenMapBackBtn");
  if (backBtn) {
    backBtn.textContent =
      adenMapBackTo === "clan" ? "← К клану" : adenMapBackTo === "menu" ? "← В меню" : "← Назад";
  }
  if (typeof show === "function") show("aden-map");
  renderAdenMapScreen();
  if (typeof clanHydrateWorldState === "function") clanHydrateWorldState(true);
}

function bindAdenMapBack() {
  const backBtn = document.getElementById("adenMapBackBtn");
  if (!backBtn || backBtn._adenBound) return;
  backBtn._adenBound = true;
  backBtn.onclick = () => {
    if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
    closeAdenMapScreen();
  };
}

function closeAdenMapScreen() {
  const to = adenMapBackTo || "clan";
  if (to === "clan" && typeof openClanScreen === "function") openClanScreen();
  else if (typeof show === "function") show(to);
}

/** Компактная карточка во вкладке Клан → Карта (без embed viewport). */
function renderClanMapCard() {
  const holdings =
    typeof clanMyHoldings === "function"
      ? clanMyHoldings()
      : [];
  const lines = holdings
    .map((t) => {
      const h = typeof clanTerritoryHolder === "function" ? clanTerritoryHolder(t.id) : null;
      return (
        "<li><b>" +
        clanMapEsc(t.labelRu) +
        "</b>" +
        (h ? " · " + clanMapEsc(h.clanName) : "") +
        (t.siegeEnabled ? " · +" + (t.holderBonus?.adenaPct || 0) + "%" : "") +
        "</li>"
      );
    })
    .join("");
  return (
    '<div class="clan-map-launch">' +
    "<strong>Карта Aden</strong>" +
    '<p class="party-panel-hint">Отдельное окно: зоны континента, пути между хабами, захват MVP-пинов.</p>' +
    (lines
      ? '<ul class="clan-map-launch-holdings">' + lines + "</ul>"
      : '<p class="party-panel-hint">Нет заявленных узлов — открой карту и заяви Пустошь / Поле казни.</p>') +
    '<div class="party-panel-actions">' +
    '<button type="button" class="party-panel-btn party-inst-primary" id="clanOpenAdenMapBtn">Открыть карту Aden</button>' +
    '<a class="party-panel-btn ghost" id="clanOpenAdenMarkupLink" href="aden-map-markup.html" target="_blank" rel="noopener">Контуры</a>' +
    '<a class="party-panel-btn ghost" href="aden-pins.html" target="_blank" rel="noopener">Пины</a>' +
    "</div></div>"
  );
}

function adenMapRegionsSvg() {
  const regions = typeof CLAN_MAP_REGIONS !== "undefined" ? CLAN_MAP_REGIONS : [];
  return regions
    .map((r) => {
      const poly = r.poly || [];
      const d =
        typeof clanMapPolyToSmoothPath === "function" ? clanMapPolyToSmoothPath(poly) : "";
      const fallbackPts =
        typeof clanMapPolyToSvgPoints === "function" ? clanMapPolyToSvgPoints(poly) : "";
      const sel = clanMapSelectedRegionId === r.id ? " is-sel" : "";
      if (d) {
        return (
          '<path class="aden-map-region' +
          sel +
          '" data-region="' +
          r.id +
          '" d="' +
          d +
          '" style="fill:' +
          (r.fill || "rgba(120,120,80,0.2)") +
          ";stroke:" +
          (r.stroke || "rgba(200,180,120,0.4)") +
          '"></path>'
        );
      }
      return (
        '<polygon class="aden-map-region' +
        sel +
        '" data-region="' +
        r.id +
        '" points="' +
        fallbackPts +
        '" style="fill:' +
        (r.fill || "rgba(120,120,80,0.2)") +
        ";stroke:" +
        (r.stroke || "rgba(200,180,120,0.4)") +
        '"></polygon>'
      );
    })
    .join("");
}

function adenMapRoutesSvg() {
  const routes = typeof CLAN_MAP_ROUTES !== "undefined" ? CLAN_MAP_ROUTES : [];
  return routes
    .map((rt) => {
      const a = typeof clanTerritoryById === "function" ? clanTerritoryById(rt.from) : null;
      const b = typeof clanTerritoryById === "function" ? clanTerritoryById(rt.to) : null;
      if (!a || !b) return "";
      const kind = rt.kind === "sea" ? " sea" : "";
      return (
        '<line class="aden-map-route' +
        kind +
        '" data-route="' +
        rt.id +
        '" x1="' +
        a.x +
        '" y1="' +
        a.y +
        '" x2="' +
        b.x +
        '" y2="' +
        b.y +
        '"></line>'
      );
    })
    .join("");
}

function adenMapPinsHtml() {
  return clanMapFilteredTerritories()
    .map((t) => {
      const holder =
        typeof clanTerritoryHolder === "function" ? clanTerritoryHolder(t.id) : null;
      const accent =
        holder && typeof clanPinAccent === "function"
          ? clanPinAccent(holder.clanName)
          : "";
      const mark = t.kind === "city" ? "♜" : t.siegeEnabled ? "⚔" : "•";
      return (
        '<button type="button" class="' +
        clanMapPinClass(t) +
        '" style="left:' +
        t.x +
        "%;top:" +
        t.y +
        "%" +
        (accent ? ";--pin-accent:" + accent : "") +
        '" data-territory="' +
        t.id +
        '" title="' +
        clanMapEsc(t.labelRu) +
        '"><span class="clan-map-pin-dot">' +
        mark +
        '</span><span class="clan-map-pin-tip">' +
        clanMapEsc(t.labelRu) +
        (holder ? " · " + clanMapEsc(holder.clanName) : "") +
        "</span></button>"
      );
    })
    .join("");
}

function renderAdenMapScreen() {
  const body = document.getElementById("adenMapBody");
  if (!body) return;
  const src =
    (typeof CLAN_MAP_CRS !== "undefined" && CLAN_MAP_CRS.overviewSrc) ||
    "assets/maps/aden-overview.webp?v=1";

  body.innerHTML =
    '<div class="aden-map-shell">' +
    '<div class="aden-map-toolbar">' +
    '<span class="clan-map-title">Aden</span>' +
    '<div class="clan-map-filters" role="tablist">' +
    '<button type="button" class="clan-map-filter' +
    (clanMapFilter === "all" ? " sel" : "") +
    '" data-clan-map-filter="all">Все</button>' +
    '<button type="button" class="clan-map-filter' +
    (clanMapFilter === "farm" ? " sel" : "") +
    '" data-clan-map-filter="farm">Фарм</button>' +
    '<button type="button" class="clan-map-filter' +
    (clanMapFilter === "city" ? " sel" : "") +
    '" data-clan-map-filter="city">Города</button>' +
    "</div>" +
    '<div class="clan-map-zoom-btns">' +
    '<button type="button" class="party-panel-btn ghost" data-clan-map-zoom="-">−</button>' +
    '<button type="button" class="party-panel-btn ghost" data-clan-map-zoom="+">+</button>' +
    '<button type="button" class="party-panel-btn ghost" data-clan-map-zoom="fit">⌂</button>' +
    '<a class="party-panel-btn ghost" href="aden-map-markup.html" target="_blank" rel="noopener">Контуры</a>' +
    '<a class="party-panel-btn ghost" href="aden-pins.html" target="_blank" rel="noopener">Пины</a>' +
    "</div></div>" +
    '<div class="aden-map-wrap">' +
    '<div class="clan-map-viewport aden-map-viewport" id="adenMapViewport">' +
    '<div class="clan-map-stage" id="adenMapStage">' +
    '<img class="clan-map-img" id="adenMapImg" src="' +
    src +
    '" alt="Карта Aden" draggable="false" />' +
    '<svg class="aden-map-svg" id="adenMapSvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<g class="aden-map-regions">' +
    adenMapRegionsSvg() +
    "</g>" +
    '<g class="aden-map-routes">' +
    adenMapRoutesSvg() +
    "</g></svg>" +
    '<div class="clan-map-pins" id="adenMapPins">' +
    adenMapPinsHtml() +
    "</div></div></div>" +
    '<aside class="clan-map-detail aden-map-detail" id="adenMapDetail">' +
    adenMapDetailHtml() +
    "</aside></div>" +
    '<p class="party-panel-hint clan-map-legend">Тяни · колесо зум · клик по зоне/пину · контуры правятся на странице «Разметка»</p>' +
    "</div>";

  wireAdenMapInteractions();
}

function adenMapRegionDetailHtml(regionId) {
  const r =
    typeof clanMapRegionById === "function" ? clanMapRegionById(regionId) : null;
  if (!r) return "";
  let hubLine = "";
  if (r.hubId) {
    const hub = typeof clanTerritoryById === "function" ? clanTerritoryById(r.hubId) : null;
    hubLine =
      '<p class="party-panel-hint">Хаб: <b>' +
      clanMapEsc(hub?.labelRu || r.hubId) +
      "</b></p>";
  }
  const nodes = (typeof CLAN_TERRITORIES !== "undefined" ? CLAN_TERRITORIES : []).filter(
    (t) => {
      if (r.hubId && t.id === r.hubId) return true;
      if (r.hubId && t.hubId === r.hubId) return true;
      if (typeof clanMapRegionAtPct === "function" && clanMapRegionAtPct(t.x, t.y)?.id === r.id)
        return true;
      return false;
    }
  );
  const nodeList = nodes
    .map((t) => {
      return (
        '<button type="button" class="party-panel-btn ghost" data-territory="' +
        t.id +
        '">' +
        clanMapEsc(t.labelRu) +
        (t.siegeEnabled ? " ⚔" : "") +
        "</button>"
      );
    })
    .join("");
  return (
    "<h4>" +
    clanMapEsc(r.labelRu) +
    "</h4>" +
    '<p class="party-panel-hint">Регион карты · ' +
    clanMapEsc(r.id) +
    "</p>" +
    hubLine +
    (nodeList
      ? '<div class="party-panel-actions aden-map-region-nodes">' + nodeList + "</div>"
      : '<p class="party-panel-hint">Маркеров в регионе пока нет.</p>')
  );
}

function adenMapDetailHtml() {
  if (clanMapSelectedId) return clanMapDetailHtml(clanMapSelectedId);
  if (clanMapSelectedRegionId) return adenMapRegionDetailHtml(clanMapSelectedRegionId);
  return (
    '<p class="party-panel-hint">Клик по зоне или пину. <b>Захват (казна)</b> — будни; <b>осада</b> — elite по слоту UTC; флагман — арена.</p>' +
    '<div class="clan-map-legend-row"><span class="clan-map-swatch is-neutral"></span> нейтрал</div>' +
    '<div class="clan-map-legend-row"><span class="clan-map-swatch is-mine"></span> ваш клан</div>' +
    '<div class="clan-map-legend-row"><span class="clan-map-swatch is-owned"></span> чужой</div>' +
    '<div class="clan-map-legend-row"><span class="clan-map-swatch siege"></span> захват / осада</div>'
  );
}

function clanMapDetailHtml(id) {
  const t = typeof clanTerritoryById === "function" ? clanTerritoryById(id) : null;
  if (!t) {
    return adenMapDetailHtml();
  }
  const holder =
    typeof clanTerritoryHolder === "function" ? clanTerritoryHolder(t.id) : null;
  const me = typeof clanMyClanRef === "function" ? clanMyClanRef() : null;
  const isMine = !!(holder && me && holder.clanId === me.clanId);
  const role = typeof clanMyRole === "function" ? clanMyRole() : null;
  const officerOk = role === "leader" || role === "officer";
  const canClaim = !!me && !!t.siegeEnabled && officerOk;

  let actions = "";
  if (t.farmZoneId) {
    actions +=
      '<button type="button" class="party-panel-btn" data-clan-goto-farm="' +
      t.farmZoneId +
      '">К зоне фарма</button>';
  }
  const isElite =
    typeof clanTerritoryIsEliteWar === "function" && clanTerritoryIsEliteWar(t);
  const win =
    isElite && typeof clanSiegeWindowForTerritory === "function"
      ? clanSiegeWindowForTerritory(t, Date.now())
      : null;
  if (canClaim) {
    if (!holder) {
      const claimCost =
        typeof clanTerritoryClaimCost === "function"
          ? clanTerritoryClaimCost(t)
          : Math.max(5_000_000, Number(t.rentPerDay) || 0) * 100;
      const claimTxt = typeof fmt === "function" ? fmt(claimCost) : String(claimCost);
      actions +=
        '<button type="button" class="party-panel-btn party-inst-primary" data-clan-claim="' +
        t.id +
        '">Захватить (казна)</button>';
      actions +=
        '<p class="party-panel-hint">Захват (казна): ' + claimTxt + " со склада · защита 30 мин</p>";
    } else if (isMine) {
      actions +=
        '<button type="button" class="party-panel-btn ghost" data-clan-release="' +
        t.id +
        '">Снять заявку</button>';
      if (isElite && win && win.open) {
        actions +=
          '<button type="button" class="party-panel-btn party-inst-primary" data-clan-siege-bid="' +
          t.id +
          '">Заявка на осаду</button>';
      }
    } else if (isElite && win && win.open) {
      actions +=
        '<button type="button" class="party-panel-btn party-inst-primary" data-clan-siege-bid="' +
        t.id +
        '">Заявка на осаду</button>';
      actions +=
        '<p class="party-panel-hint">Осада (расписание) · eco-отбитие закрыто · исход по силе' +
        (typeof clanTerritoryIsFlagship === "function" && clanTerritoryIsFlagship(t)
          ? " / арена"
          : "") +
        "</p>";
    } else {
      const cost =
        typeof clanTerritoryContestCost === "function"
          ? clanTerritoryContestCost(t, holder)
          : Math.max(10_000_000, Number(t.rentPerDay) || 0) * 200;
      const costTxt = typeof fmt === "function" ? fmt(cost) : String(cost);
      const powerRu = holder.siegePowerRu ? " · " + holder.siegePowerRu : "";
      actions +=
        '<button type="button" class="party-panel-btn party-inst-primary" data-clan-contest="' +
        t.id +
        '">Отбить (казна)</button>';
      actions +=
        '<p class="party-panel-hint">Захват (казна) · ' +
        costTxt +
        powerRu +
        " · защита 30 мин</p>";
    }
  } else if (me && t.siegeEnabled && !officerOk) {
    actions += '<p class="party-panel-hint">Заявляет лидер или офицер</p>';
  }

  const portrait = t.portrait
    ? '<img class="clan-map-portrait" src="' + t.portrait + '" alt="" draggable="false" />'
    : "";

  const xpB = t.holderBonus?.xpPct || 0;
  const warLabel =
    typeof clanTerritoryWarTierLabelRu === "function"
      ? clanTerritoryWarTierLabelRu(t)
      : "";
  const slotLabel =
    isElite && typeof clanSiegeSlotLabelRu === "function"
      ? clanSiegeSlotLabelRu(t.siegeSlotUtc)
      : "";

  return (
    portrait +
    "<h4>" +
    clanMapEsc(t.labelRu) +
    "</h4>" +
    '<p class="party-panel-hint">' +
    clanMapEsc(t.labelL2 || "") +
    (t.farmZoneId ? " · " + t.farmZoneId : "") +
    (warLabel ? " · " + warLabel : "") +
    "</p>" +
    "<p>Владелец: <b>" +
    clanMapEsc(holder?.clanName || "нейтрал") +
    "</b></p>" +
    (t.siegeEnabled
      ? '<p class="party-panel-hint">Holder · +' +
        (t.holderBonus?.adenaPct || 0) +
        "% adena" +
        (xpB ? " · +" + xpB + "% XP" : "") +
        " online · рента " +
        (typeof fmt === "function" ? fmt(t.rentPerDay || 0) : t.rentPerDay || 0) +
        "/сутки" +
        (slotLabel ? " · слот " + slotLabel : "") +
        (win && win.open ? " · окно ОТКРЫТО" : "") +
        "</p>"
      : '<p class="party-panel-hint">Город / хаб — ориентир, захват позже</p>') +
    (actions ? '<div class="party-panel-actions">' + actions + "</div>" : "")
  );
}

function clanMapAspect() {
  const crs = typeof CLAN_MAP_CRS !== "undefined" ? CLAN_MAP_CRS : { mapW: 1812, mapH: 2620 };
  return (crs.mapH || 2620) / (crs.mapW || 1812);
}

function clanMapStageSize() {
  const vp = clanMapViewportEl();
  if (!vp) return { w: 0, h: 0, vpW: 0, vpH: 0 };
  const vpW = vp.clientWidth || 0;
  const vpH = vp.clientHeight || 0;
  const aspect = clanMapAspect();
  let baseW = vpW;
  let baseH = baseW * aspect;
  if (vpH > 0 && baseH < vpH * 1.28) {
    baseH = vpH * 1.28;
    baseW = baseH / aspect;
  }
  return {
    w: baseW * clanMapZoom,
    h: baseH * clanMapZoom,
    baseW,
    baseH,
    vpW,
    vpH,
  };
}

function clanMapClampPan() {
  const s = clanMapStageSize();
  if (!s.vpW) return;
  const pad = 24;
  if (s.w <= s.vpW) {
    clanMapPanX = (s.vpW - s.w) / 2;
  } else {
    const minX = s.vpW - s.w - pad;
    const maxX = pad;
    clanMapPanX = Math.min(maxX, Math.max(minX, clanMapPanX));
  }
  if (s.h <= s.vpH) {
    clanMapPanY = (s.vpH - s.h) / 2;
  } else {
    const minY = s.vpH - s.h - pad;
    const maxY = pad;
    clanMapPanY = Math.min(maxY, Math.max(minY, clanMapPanY));
  }
}

function clanMapApplyTransform() {
  const stage = clanMapStageEl();
  const vp = clanMapViewportEl();
  if (!stage || !vp) return;
  const s = clanMapStageSize();
  if (!s.vpW) return;
  stage.style.width = s.w + "px";
  stage.style.height = s.h + "px";
  clanMapClampPan();
  stage.style.transform = "translate(" + clanMapPanX + "px," + clanMapPanY + "px)";
}

function clanMapFocusY(pct) {
  const s = clanMapStageSize();
  if (!s.vpH) return;
  const y = (Math.max(0, Math.min(100, pct)) / 100) * s.h;
  clanMapPanY = s.vpH / 2 - y;
  clanMapClampPan();
}

function clanMapFit() {
  clanMapZoom = 1;
  const s = clanMapStageSize();
  if (s.vpW) {
    clanMapPanX = (s.vpW - s.w) / 2;
    clanMapFocusY(72);
  } else {
    clanMapPanX = 0;
    clanMapPanY = 0;
  }
  clanMapApplyTransform();
}

function clanMapSetZoom(next, pivot) {
  const vp = clanMapViewportEl();
  const prev = clanMapZoom;
  clanMapZoom = Math.max(1, Math.min(3, next));
  if (vp && pivot && prev > 0) {
    const rect = vp.getBoundingClientRect();
    const lx = pivot.x - rect.left;
    const ly = pivot.y - rect.top;
    const worldX = (lx - clanMapPanX) / prev;
    const worldY = (ly - clanMapPanY) / prev;
    clanMapPanX = lx - worldX * clanMapZoom;
    clanMapPanY = ly - worldY * clanMapZoom;
  }
  clanMapApplyTransform();
}

function clanMapCenterOn(id) {
  const t = typeof clanTerritoryById === "function" ? clanTerritoryById(id) : null;
  const s = clanMapStageSize();
  if (!t || !s.vpW) return;
  if (clanMapZoom < 1.35) clanMapZoom = 1.35;
  const sized = clanMapStageSize();
  const pinX = (t.x / 100) * sized.w;
  const pinY = (t.y / 100) * sized.h;
  clanMapPanX = sized.vpW / 2 - pinX;
  clanMapPanY = sized.vpH / 2 - pinY;
  clanMapApplyTransform();
}

function adenMapRefreshDetail() {
  const box = document.getElementById("adenMapDetail");
  if (!box) return;
  box.innerHTML = adenMapDetailHtml();
  wireAdenMapDetailActions(box);
}

function showClanTerritoryDetail(id) {
  clanMapSelectedId = id;
  clanMapSelectedRegionId = null;
  document.querySelectorAll(".clan-map-pin").forEach((el) => {
    el.classList.toggle("is-sel", el.getAttribute("data-territory") === id);
  });
  document.querySelectorAll(".aden-map-region").forEach((el) => {
    el.classList.remove("is-sel");
  });
  adenMapRefreshDetail();
  if (id) clanMapCenterOn(id);
}

function showAdenMapRegionDetail(regionId) {
  clanMapSelectedRegionId = regionId;
  clanMapSelectedId = null;
  document.querySelectorAll(".clan-map-pin").forEach((el) => el.classList.remove("is-sel"));
  document.querySelectorAll(".aden-map-region").forEach((el) => {
    el.classList.toggle("is-sel", el.getAttribute("data-region") === regionId);
  });
  adenMapRefreshDetail();
}

function refreshClanMapLive() {
  const vp = clanMapViewportEl();
  if (!vp) return false;
  const pins = document.getElementById("adenMapPins");
  if (pins) pins.innerHTML = adenMapPinsHtml();
  document.querySelectorAll("#adenMapPins [data-territory]").forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      showClanTerritoryDetail(el.getAttribute("data-territory"));
    };
  });
  adenMapRefreshDetail();
  return true;
}

async function clanMapAfterTerritoryMutation(r, opts) {
  opts = opts || {};
  if (r && r.ok) {
    if (typeof clanRefreshBuffs === "function") await clanRefreshBuffs();
    if (typeof clanRefreshWarehouse === "function") await clanRefreshWarehouse();
  }
  let msg = (r && (r.message || r.error)) || (r && r.ok ? "Ок" : "Ошибка");
  if (r && r.ok && opts.claimed) msg += " · +50 активности (T1 с 100)";
  if (r && r.ok && opts.contested) msg += " · +75 активности";
  if (typeof clanSetStatus === "function") {
    clanSetStatus(msg, r && r.ok ? "" : "warn");
  }
  const status = document.getElementById("adenMapStatus");
  if (status) {
    status.hidden = !msg;
    status.textContent = msg;
    status.className = "party-panel-status" + (r.ok ? "" : " is-warn");
  }
  refreshClanMapLive();
  if (typeof syncMineClanTerritoryHud === "function") syncMineClanTerritoryHud();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
}

function wireAdenMapDetailActions(box) {
  if (!box) return;
  box.querySelectorAll("[data-clan-goto-farm]").forEach((btn) => {
    btn.onclick = () => {
      const zid = btn.getAttribute("data-clan-goto-farm");
      if (typeof setMenuFarmEntry === "function") setMenuFarmEntry("farm");
      if (typeof selectFarmZone === "function") selectFarmZone(zid);
      if (typeof show === "function") show("menu");
    };
  });
  box.querySelectorAll("[data-clan-claim]").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      const r =
        typeof clanClaimTerritory === "function"
          ? await clanClaimTerritory(btn.getAttribute("data-clan-claim"))
          : claimClanTerritoryMock(btn.getAttribute("data-clan-claim"));
      btn.disabled = false;
      await clanMapAfterTerritoryMutation(r, { claimed: true });
    };
  });
  box.querySelectorAll("[data-clan-contest]").forEach((btn) => {
    btn.onclick = async () => {
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
      await clanMapAfterTerritoryMutation(r, { contested: true });
    };
  });
  box.querySelectorAll("[data-clan-release]").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      const r =
        typeof clanReleaseTerritory === "function"
          ? await clanReleaseTerritory(btn.getAttribute("data-clan-release"))
          : releaseClanTerritoryMock(btn.getAttribute("data-clan-release"));
      btn.disabled = false;
      await clanMapAfterTerritoryMutation(r);
    };
  });
  box.querySelectorAll("[data-clan-siege-bid]").forEach((btn) => {
    btn.onclick = async () => {
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
      await clanMapAfterTerritoryMutation(r);
    };
  });
  box.querySelectorAll("[data-territory]").forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      showClanTerritoryDetail(el.getAttribute("data-territory"));
    };
  });
}

function adenMapClientToPct(clientX, clientY) {
  const stage = clanMapStageEl();
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
  };
}

function wireAdenMapInteractions() {
  const root = document.getElementById("adenMapBody") || document;
  root.querySelectorAll("[data-clan-map-filter]").forEach((btn) => {
    btn.onclick = () => {
      clanMapFilter = btn.getAttribute("data-clan-map-filter") || "all";
      renderAdenMapScreen();
    };
  });
  root.querySelectorAll("[data-clan-map-zoom]").forEach((btn) => {
    btn.onclick = () => {
      const op = btn.getAttribute("data-clan-map-zoom");
      if (op === "+") clanMapSetZoom(clanMapZoom + 0.25);
      else if (op === "-") clanMapSetZoom(clanMapZoom - 0.25);
      else clanMapFit();
    };
  });
  root.querySelectorAll("[data-territory]").forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      showClanTerritoryDetail(el.getAttribute("data-territory"));
    };
  });
  root.querySelectorAll(".aden-map-region").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (clanMapDragMoved) return;
      showAdenMapRegionDetail(el.getAttribute("data-region"));
    });
  });
  wireAdenMapDetailActions(document.getElementById("adenMapDetail"));

  const vp = clanMapViewportEl();
  if (!vp) return;

  if (!vp._adenMapBound) {
    vp._adenMapBound = true;
    vp.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        clanMapSetZoom(clanMapZoom + delta, { x: e.clientX, y: e.clientY });
      },
      { passive: false }
    );

    vp.addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest(".clan-map-pin")) return;
      clanMapDragging = true;
      clanMapDragMoved = false;
      clanMapDragStart = {
        x: e.clientX,
        y: e.clientY,
        panX: clanMapPanX,
        panY: clanMapPanY,
      };
      vp.classList.add("is-dragging");
      try {
        vp.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    vp.addEventListener("pointermove", (e) => {
      if (!clanMapDragging || !clanMapDragStart) return;
      const dx = e.clientX - clanMapDragStart.x;
      const dy = e.clientY - clanMapDragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) clanMapDragMoved = true;
      clanMapPanX = clanMapDragStart.panX + dx;
      clanMapPanY = clanMapDragStart.panY + dy;
      clanMapApplyTransform();
    });
    const endDrag = () => {
      clanMapDragging = false;
      clanMapDragStart = null;
      vp.classList.remove("is-dragging");
      setTimeout(() => {
        clanMapDragMoved = false;
      }, 0);
    };
    vp.addEventListener("pointerup", endDrag);
    vp.addEventListener("pointercancel", endDrag);
  }

  if (!window._adenMapResizeBound) {
    window._adenMapResizeBound = true;
    window.addEventListener("resize", () => {
      if (clanMapViewportEl()) clanMapApplyTransform();
    });
  }

  requestAnimationFrame(() => {
    if (clanMapSelectedId) clanMapCenterOn(clanMapSelectedId);
    else if (clanMapZoom === 1 && Math.abs(clanMapPanX) < 2 && Math.abs(clanMapPanY) < 2) clanMapFit();
    else clanMapApplyTransform();
  });
}

/** @deprecated alias — CTA в clan-ui */
function wireClanMapInteractions(root) {
  root = root || document;
  const btn = root.querySelector("#clanOpenAdenMapBtn");
  if (btn) {
    btn.onclick = () => openAdenMapScreen("clan");
  }
}
