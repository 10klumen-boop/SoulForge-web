// ===== Standalone Aden hunting-grounds markup page =====
(function () {
  const DRAFT_KEY = "sf_aden_map_region_drafts_v1";
  const PIN_DRAFT_KEY = "sf_aden_map_pin_drafts_v1";
  const ASPECT =
    (typeof CLAN_MAP_CRS !== "undefined"
      ? (CLAN_MAP_CRS.mapH || 2620) / (CLAN_MAP_CRS.mapW || 1812)
      : 2620 / 1812);

  let mode = "pan"; // pan | pin | draw | edit
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragMoved = false;
  let dragStart = null;
  let selectedPinId = null;
  let selectedRegionId = null;
  let selectedVert = -1;
  let vertDrag = null;
  let drafts = Object.create(null);
  let pinDrafts = Object.create(null); // id -> { x, y }
  let customPins = []; // новые пины (не в CLAN_TERRITORIES)
  let customRegions = []; // new угодья not in CLAN_MAP_REGIONS
  let pendingPlacePin = false; // ждём клик после «+ Новый пин»

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function round1(n) {
    return Math.round(Math.max(0, Math.min(100, Number(n) || 0)) * 10) / 10;
  }

  function loadDrafts() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      Object.keys(parsed).forEach((id) => {
        const poly = parsed[id];
        if (Array.isArray(poly) && poly.length >= 3) {
          drafts[id] = poly.map((p) => [round1(p[0]), round1(p[1])]);
        }
      });
    } catch (_) {}
  }

  function saveDrafts() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    } catch (_) {}
  }

  function loadPinDrafts() {
    try {
      const raw = localStorage.getItem(PIN_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      Object.keys(parsed).forEach((id) => {
        const p = parsed[id];
        if (p && p.x != null && p.y != null) {
          pinDrafts[id] = { x: round1(p.x), y: round1(p.y) };
        }
      });
    } catch (_) {}
  }

  function savePinDrafts() {
    try {
      localStorage.setItem(PIN_DRAFT_KEY, JSON.stringify(pinDrafts));
    } catch (_) {}
  }

  function pctToWorld(xPct, yPct) {
    const crs =
      typeof CLAN_MAP_CRS !== "undefined"
        ? CLAN_MAP_CRS
        : { minX: -131072, maxX: 229376, minY: -262144, maxY: 262144 };
    const worldX = crs.minX + (Number(xPct) / 100) * (crs.maxX - crs.minX);
    const worldY = crs.minY + (Number(yPct) / 100) * (crs.maxY - crs.minY);
    return { worldX: Math.round(worldX), worldY: Math.round(worldY) };
  }

  function pinPos(id) {
    if (pinDrafts[id]) return pinDrafts[id];
    const t = pinById(id);
    if (!t) return null;
    if (t._needsPlace && (t.x == null || t.y == null)) return null;
    if (t.x == null || t.y == null) return null;
    return { x: Number(t.x) || 0, y: Number(t.y) || 0 };
  }

  function pinPosOrCenter(id) {
    return pinPos(id) || { x: 50, y: 50 };
  }

  function setPinPos(id, x, y) {
    pinDrafts[id] = { x: round1(x), y: round1(y) };
    savePinDrafts();
  }

  function resetPinPos(id) {
    delete pinDrafts[id];
    savePinDrafts();
  }

  function allRegions() {
    const base = typeof CLAN_MAP_REGIONS !== "undefined" ? CLAN_MAP_REGIONS.slice() : [];
    customRegions.forEach((r) => {
      if (!base.some((b) => b.id === r.id)) base.push(r);
    });
    return base;
  }

  function regionById(id) {
    return allRegions().find((r) => r.id === id) || null;
  }

  function pinById(id) {
    return allPins().find((t) => t.id === id) || null;
  }

  function allPins() {
    const base = typeof CLAN_TERRITORIES !== "undefined" ? CLAN_TERRITORIES.slice() : [];
    const fromCatalog =
      typeof clanHuntingCatalogMarkupPins === "function" ? clanHuntingCatalogMarkupPins() : [];
    fromCatalog.forEach((p) => {
      if (!base.some((b) => b.id === p.id)) base.push(p);
    });
    customPins.forEach((p) => {
      if (!base.some((b) => b.id === p.id)) base.push(p);
    });
    return base;
  }

  function saveCustomPins() {
    try {
      localStorage.setItem("sf_aden_map_custom_pins_v1", JSON.stringify(customPins));
    } catch (_) {}
  }

  function loadCustomPins() {
    try {
      const raw = localStorage.getItem("sf_aden_map_custom_pins_v1");
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) customPins = arr;
    } catch (_) {}
  }

  function regionPoly(id) {
    if (Object.prototype.hasOwnProperty.call(drafts, id)) return drafts[id] || [];
    const r = regionById(id);
    return (r && r.poly) || [];
  }

  function setPoly(id, poly) {
    drafts[id] = (poly || []).map((p) => [round1(p[0]), round1(p[1])]);
    saveDrafts();
  }

  function smoothPath(poly) {
    const pts = (poly || []).map((p) => [Number(p[0]), Number(p[1])]);
    const n = pts.length;
    if (n < 3) return "";
    const mid = (i, j) => [(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2];
    let d = "M " + mid(n - 1, 0)[0] + " " + mid(n - 1, 0)[1];
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const m = mid(i, next);
      d += " Q " + pts[i][0] + " " + pts[i][1] + " " + m[0] + " " + m[1];
    }
    return d + " Z";
  }

  function distSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  function insertVert(poly, x, y) {
    const pts = poly.map((p) => [p[0], p[1]]);
    if (pts.length < 2) {
      pts.push([x, y]);
      return pts;
    }
    let bestI = pts.length - 1;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const d = distSeg(x, y, a[0], a[1], b[0], b[1]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    pts.splice(bestI + 1, 0, [x, y]);
    return pts;
  }

  function stageSize() {
    const vp = $("ammViewport");
    if (!vp) return { w: 0, h: 0, vpW: 0, vpH: 0 };
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    let baseW = vpW;
    let baseH = baseW * ASPECT;
    if (vpH > 0 && baseH < vpH * 1.2) {
      baseH = vpH * 1.2;
      baseW = baseH / ASPECT;
    }
    return { w: baseW * zoom, h: baseH * zoom, baseW, baseH, vpW, vpH };
  }

  function clampPan() {
    const s = stageSize();
    const pad = 40;
    if (s.w <= s.vpW) panX = (s.vpW - s.w) / 2;
    else panX = Math.min(pad, Math.max(s.vpW - s.w - pad, panX));
    if (s.h <= s.vpH) panY = (s.vpH - s.h) / 2;
    else panY = Math.min(pad, Math.max(s.vpH - s.h - pad, panY));
  }

  function applyTransform() {
    const stage = $("ammStage");
    if (!stage) return;
    const s = stageSize();
    if (!s.vpW) return;
    stage.style.width = s.w + "px";
    stage.style.height = s.h + "px";
    clampPan();
    stage.style.transform = "translate(" + panX + "px," + panY + "px)";
  }

  function fit() {
    zoom = 1;
    const s = stageSize();
    panX = (s.vpW - s.w) / 2;
    panY = s.vpH / 2 - 0.72 * s.h;
    clampPan();
    applyTransform();
  }

  function setZoom(next, pivot) {
    const vp = $("ammViewport");
    const prev = zoom;
    zoom = Math.max(1, Math.min(4, next));
    if (vp && pivot && prev > 0) {
      const rect = vp.getBoundingClientRect();
      const lx = pivot.x - rect.left;
      const ly = pivot.y - rect.top;
      const wx = (lx - panX) / prev;
      const wy = (ly - panY) / prev;
      panX = lx - wx * zoom;
      panY = ly - wy * zoom;
    }
    applyTransform();
  }

  function clientToPct(cx, cy) {
    const stage = $("ammStage");
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((cx - rect.left) / rect.width) * 100,
      y: ((cy - rect.top) / rect.height) * 100,
    };
  }

  function centerOnPin(id) {
    const p = pinPos(id);
    if (!p) return;
    const s = stageSize();
    if (!s.vpW) return;
    if (zoom < 1.4) zoom = 1.4;
    const sized = stageSize();
    panX = sized.vpW / 2 - (p.x / 100) * sized.w;
    panY = sized.vpH / 2 - (p.y / 100) * sized.h;
    applyTransform();
  }

  function setStatus(text) {
    const el = $("ammStatus");
    if (el) el.textContent = text;
  }

  function syncModeUi() {
    document.querySelectorAll(".amm-mode").forEach((btn) => {
      btn.classList.toggle("sel", btn.getAttribute("data-mode") === mode);
    });
    const vp = $("ammViewport");
    if (vp) {
      vp.classList.toggle("is-draw", mode === "draw");
      vp.classList.toggle("is-edit", mode === "edit");
      vp.classList.toggle("is-pin", mode === "pin");
    }
    const labels = {
      pan: "Режим: перемещение · колесо = зум",
      pin: "Режим: пины · выбери пин слева → клик по карте ставит метку",
      draw: "Режим: рисовать · выбери угодье · клик = точка · пан: Alt+тяни",
      edit: "Режим: вершины · тяни кружки · Del удаляет выбранную",
    };
    setStatus(labels[mode] || "");
  }

  function renderPinList() {
    const ul = $("ammPinList");
    if (!ul) return;
    const pins = allPins();
    ul.innerHTML = pins
      .map((t) => {
        const p = pinPos(t.id);
        const kind =
          t.kind === "city"
            ? "город / хаб"
            : t._status
              ? "фарм · " + t._status
              : "фарм / охота";
        const draft = pinDrafts[t.id] || t._custom || t._catalog ? " is-draft" : "";
        const posTxt = p ? p.x + "% / " + p.y + "%" : "не поставлен";
        return (
          '<li><button type="button" data-pin="' +
          t.id +
          '" class="' +
          (selectedPinId === t.id ? "sel" : "") +
          draft +
          '"><b>' +
          esc(t.labelRu) +
          "</b><small>" +
          esc(kind) +
          (t.hubId ? " · " + esc(t.hubId) : "") +
          " · " +
          posTxt +
          (t._custom ? " · новый" : !p ? " · клик по карте" : "") +
          "</small></button></li>"
        );
      })
      .join("");
    ul.querySelectorAll("[data-pin]").forEach((btn) => {
      btn.onclick = () => selectPin(btn.getAttribute("data-pin"));
    });
  }

  function updatePinMeta() {
    const el = $("ammPinMeta");
    if (!el) return;
    if (!selectedPinId) {
      el.textContent = "Пин не выбран — выбери в списке, затем клик по карте";
      return;
    }
    const t = pinById(selectedPinId);
    const p = pinPos(selectedPinId);
    if (!p) {
      el.innerHTML =
        "<b>" +
        esc(t?.labelRu || selectedPinId) +
        "</b> · ещё не на карте · кликни куда поставить";
      return;
    }
    const w = pctToWorld(p.x, p.y);
    el.innerHTML =
      "<b>" +
      esc(t?.labelRu || selectedPinId) +
      "</b> · " +
      p.x +
      "% / " +
      p.y +
      "% · world " +
      w.worldX +
      " / " +
      w.worldY +
      (pinDrafts[selectedPinId] ? " · черновик" : "");
  }

  function renderRegionList() {
    const ul = $("ammRegionList");
    if (!ul) return;
    ul.innerHTML = allRegions()
      .map((r) => {
        const draft = drafts[r.id] ? " is-draft" : "";
        const hub = r.hubId ? " · хаб " + r.hubId : "";
        return (
          '<li><button type="button" data-region="' +
          r.id +
          '" class="' +
          (selectedRegionId === r.id ? "sel" : "") +
          draft +
          '"><b>' +
          esc(r.labelRu) +
          "</b><small>" +
          esc(r.id) +
          hub +
          " · " +
          regionPoly(r.id).length +
          " верш.</small></button></li>"
        );
      })
      .join("");
    ul.querySelectorAll("[data-region]").forEach((btn) => {
      btn.onclick = () => selectRegion(btn.getAttribute("data-region"));
    });
  }

  function updateMeta() {
    const el = $("ammMeta");
    if (!el) return;
    if (!selectedRegionId) {
      el.textContent = "Зона не выбрана";
      return;
    }
    const r = regionById(selectedRegionId);
    const n = regionPoly(selectedRegionId).length;
    el.innerHTML =
      "<b>" +
      esc(r?.labelRu || selectedRegionId) +
      "</b> · " +
      n +
      " вершин" +
      (drafts[selectedRegionId] ? " · черновик" : "");
  }

  function renderRegionsSvg() {
    const g = $("ammRegions");
    if (!g) return;
    g.innerHTML = allRegions()
      .map((r) => {
        const poly = regionPoly(r.id);
        if (!poly.length) return "";
        const sel = selectedRegionId === r.id ? " is-sel" : "";
        if (poly.length >= 3) {
          const d = smoothPath(poly);
          return (
            '<path class="amm-region' +
            sel +
            '" data-region="' +
            r.id +
            '" d="' +
            d +
            '" style="fill:' +
            (r.fill || "rgba(120,120,80,0.18)") +
            ";stroke:" +
            (r.stroke || "rgba(200,180,120,0.9)") +
            '"></path>'
          );
        }
        // Черновик <3 точек — открытая линия
        const pts = poly.map((p) => p[0] + "," + p[1]).join(" ");
        return (
          '<polyline class="amm-region amm-region-open' +
          sel +
          '" data-region="' +
          r.id +
          '" points="' +
          pts +
          '" style="fill:none;stroke:' +
          (r.stroke || "rgba(200,180,120,0.9)") +
          '"></polyline>'
        );
      })
      .join("");
  }

  function renderRoutesSvg() {
    const g = $("ammRoutes");
    if (!g) return;
    const routes = typeof CLAN_MAP_ROUTES !== "undefined" ? CLAN_MAP_ROUTES : [];
    g.innerHTML = routes
      .map((rt) => {
        const a = pinPos(rt.from);
        const b = pinPos(rt.to);
        if (!a || !b) return "";
        return (
          '<line class="amm-route" x1="' +
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

  function renderPins() {
    const box = $("ammPins");
    if (!box) return;
    const pins = allPins();
    box.innerHTML = pins
      .map((t) => {
        const p = pinPos(t.id);
        if (!p) return ""; // не поставленные — только в списке слева
        const cls =
          "amm-pin" +
          (t.kind === "city" ? " is-city" : " is-farm") +
          (selectedPinId === t.id ? " is-sel" : "") +
          (t._custom || t._catalog ? " is-new" : "");
        const mark = t.kind === "city" ? "◆ " : t.siegeEnabled ? "◆ " : "• ";
        return (
          '<div class="' +
          cls +
          '" style="left:' +
          p.x +
          "%;top:" +
          p.y +
          '%" data-pin="' +
          t.id +
          '">' +
          mark +
          esc(t.labelRu) +
          "</div>"
        );
      })
      .join("");
    // В режиме Пины клики идут в viewport (постановка). Выбор — только из списка.
    if (mode !== "pin") {
      box.querySelectorAll("[data-pin]").forEach((el) => {
        el.style.cursor = "pointer";
        el.onclick = (e) => {
          e.stopPropagation();
          selectPin(el.getAttribute("data-pin"));
        };
      });
    }
  }

  function renderVerts() {
    const g = $("ammVerts");
    if (!g) return;
    if (mode !== "edit" && mode !== "draw") {
      g.innerHTML = "";
      return;
    }
    if (!selectedRegionId) {
      g.innerHTML = "";
      return;
    }
    const poly = regionPoly(selectedRegionId);
    g.innerHTML = poly
      .map((p, i) => {
        const sel = selectedVert === i ? " is-sel" : "";
        return (
          '<circle class="amm-vert' +
          sel +
          '" data-vert="' +
          i +
          '" cx="' +
          p[0] +
          '" cy="' +
          p[1] +
          '" r="0.55"></circle>'
        );
      })
      .join("");
    g.querySelectorAll(".amm-vert").forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        if (mode !== "edit" && mode !== "draw") return;
        e.stopPropagation();
        e.preventDefault();
        selectedVert = Number(el.getAttribute("data-vert"));
        vertDrag = { index: selectedVert };
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {}
        renderVerts();
      });
    });
  }

  function refreshMap() {
    renderRegionsSvg();
    renderRoutesSvg();
    renderPins();
    renderVerts();
  }

  function refreshAll() {
    renderPinList();
    renderRegionList();
    updateMeta();
    updatePinMeta();
    refreshMap();
    syncModeUi();
  }

  function selectPin(id) {
    selectedPinId = id;
    pendingPlacePin = false;
    centerOnPin(id);
    mode = "pin";
    const t = pinById(id);
    refreshAll();
    setStatus(
      "Пин «" +
        (t?.labelRu || id) +
        "» выбран · клик по карте = поставить сюда"
    );
  }

  function placeSelectedPin(x, y) {
    if (!selectedPinId) {
      setStatus("Сначала «+ Новый пин» или выбери пин в списке");
      return;
    }
    setPinPos(selectedPinId, x, y);
    // синхронизируем x/y на custom-объекте
    const t = pinById(selectedPinId);
    if (t) {
      t.x = round1(x);
      t.y = round1(y);
      const w = pctToWorld(x, y);
      t.worldX = w.worldX;
      t.worldY = w.worldY;
      if (t._custom) saveCustomPins();
    }
    pendingPlacePin = false;
    refreshAll();
    const w = pctToWorld(x, y);
    setStatus(
      "Пин «" +
        (t?.labelRu || selectedPinId) +
        "»: " +
        round1(x) +
        "% / " +
        round1(y) +
        "% · world " +
        w.worldX +
        " / " +
        w.worldY
    );
  }

  function newPin() {
    const label = prompt("Название пина (рус.)", "Новая точка");
    if (!label) return;
    let kind = prompt("Тип: farm или city", "farm");
    kind = String(kind || "farm").toLowerCase() === "city" ? "city" : "farm";
    const idBase = String(label)
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 28);
    const id = "pin_" + idBase + "_" + Date.now().toString(36).slice(-4);
    const pin = {
      id,
      kind,
      labelRu: label,
      labelL2: label,
      farmZoneId: kind === "farm" ? id : null,
      hubId: null,
      worldX: 0,
      worldY: 0,
      x: 50,
      y: 50,
      hitR: 2.8,
      capturable: kind === "farm",
      siegeEnabled: false,
      holderBonus: null,
      rentPerDay: 0,
      portrait: null,
      _custom: true,
    };
    customPins.push(pin);
    saveCustomPins();
    setPinPos(id, 50, 50);
    selectedPinId = id;
    mode = "pin";
    pendingPlacePin = true;
    refreshAll();
    setStatus("Новый пин «" + label + "» · кликни по карте, куда поставить");
  }

  async function copyPin() {
    if (!selectedPinId) {
      setStatus("Выбери пин");
      return;
    }
    const t = pinById(selectedPinId);
    const p = pinPos(selectedPinId);
    const w = pctToWorld(p.x, p.y);
    const text =
      "  {\n" +
      '    id: "' +
      selectedPinId +
      '",\n' +
      '    kind: "' +
      (t?.kind || "farm") +
      '",\n' +
      '    labelRu: "' +
      String(t?.labelRu || selectedPinId).replace(/"/g, '\\"') +
      '",\n' +
      '    labelL2: "' +
      String(t?.labelL2 || t?.labelRu || "").replace(/"/g, '\\"') +
      '",\n' +
      "    farmZoneId: " +
      (t?.farmZoneId ? '"' + t.farmZoneId + '"' : "null") +
      ",\n" +
      "    hubId: " +
      (t?.hubId ? '"' + t.hubId + '"' : "null") +
      ",\n" +
      "    worldX: " +
      w.worldX +
      ",\n" +
      "    worldY: " +
      w.worldY +
      ",\n" +
      "    // map % " +
      p.x +
      " / " +
      p.y +
      "\n" +
      "    hitR: 2.8,\n" +
      "    capturable: " +
      !!t?.capturable +
      ",\n" +
      "    siegeEnabled: " +
      !!t?.siegeEnabled +
      ",\n" +
      "    holderBonus: null,\n" +
      "    rentPerDay: 0,\n" +
      "    portrait: null,\n" +
      "  },";
    const ok = await copyText(text);
    console.log("[aden-markup] pin", selectedPinId, p, w, t);
    setStatus(ok ? "Объект пина скопирован → вставь в CLAN_TERRITORIES" : "См. консоль");
  }

  function selectRegion(id) {
    selectedRegionId = id;
    selectedVert = -1;
    refreshAll();
  }

  function addVertexAt(x, y) {
    if (!selectedRegionId) {
      setStatus("Сначала выбери угодье слева (или «+ Новое угодье»)");
      return;
    }
    const cur = regionPoly(selectedRegionId).map((p) => [p[0], p[1]]);
    let poly;
    if (mode === "draw") {
      // Рисование: точки подряд по контуру
      poly = cur.concat([[round1(x), round1(y)]]);
    } else {
      poly = insertVert(cur, round1(x), round1(y));
    }
    setPoly(selectedRegionId, poly);
    selectedVert = poly.length - 1;
    refreshAll();
    setStatus(
      "Точка " +
        poly.length +
        (poly.length < 3 ? " · нужно ещё " + (3 - poly.length) : " · контур замкнут")
    );
  }

  function undoVert() {
    if (!selectedRegionId) return;
    const poly = regionPoly(selectedRegionId).slice();
    if (!poly.length) {
      setStatus("Нечего отменять");
      return;
    }
    poly.pop();
    setPoly(selectedRegionId, poly);
    selectedVert = -1;
    refreshAll();
  }

  function delVert() {
    if (!selectedRegionId || selectedVert < 0) return;
    const poly = regionPoly(selectedRegionId).slice();
    if (!poly.length) return;
    poly.splice(selectedVert, 1);
    selectedVert = -1;
    setPoly(selectedRegionId, poly);
    refreshAll();
  }

  function clearPoly() {
    if (!selectedRegionId) return;
    if (!confirm("Очистить контур зоны? Начни рисовать заново (режим «Рисовать»).")) return;
    setPoly(selectedRegionId, []);
    selectedVert = -1;
    mode = "draw";
    refreshAll();
  }

  function resetDraft() {
    if (!selectedRegionId) return;
    delete drafts[selectedRegionId];
    saveDrafts();
    selectedVert = -1;
    refreshAll();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function copyOne() {
    if (!selectedRegionId) {
      setStatus("Выбери угодье");
      return;
    }
    const poly = regionPoly(selectedRegionId);
    const text = "poly: " + JSON.stringify(poly, null, 2) + ",";
    const ok = await copyText(text);
    console.log("[aden-markup]", selectedRegionId, poly);
    setStatus(ok ? "poly скопирован — вставь в clan-map-regions-data.js" : "См. консоль");
  }

  async function copyAll() {
    const payload = {};
    Object.keys(drafts).forEach((id) => {
      payload[id] = drafts[id];
    });
    const text = JSON.stringify(payload, null, 2);
    const ok = await copyText(text);
    console.log("[aden-markup] drafts", payload);
    setStatus(ok ? "Все черновики скопированы (JSON)" : "См. консоль");
  }

  function newRegion() {
    const label = prompt("Название угодья (рус.)", "Новое угодье");
    if (!label) return;
    const id =
      "custom_" +
      String(label)
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 24) +
      "_" +
      Date.now().toString(36).slice(-4);
    const hubId = selectedPinId || null;
    const r = {
      id,
      labelRu: label,
      hubId,
      fill: "rgba(120, 140, 80, 0.2)",
      stroke: "rgba(200, 210, 140, 0.95)",
      poly: [],
    };
    customRegions.push(r);
    try {
      localStorage.setItem(
        "sf_aden_map_custom_regions_v1",
        JSON.stringify(customRegions)
      );
    } catch (_) {}
    selectedRegionId = id;
    setPoly(id, []);
    mode = "draw";
    refreshAll();
    setStatus("Рисуй контур кликами по карте");
  }

  function loadCustomRegions() {
    try {
      const raw = localStorage.getItem("sf_aden_map_custom_regions_v1");
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) customRegions = arr;
    } catch (_) {}
  }

  function wire() {
    document.querySelectorAll(".amm-mode").forEach((btn) => {
      btn.onclick = () => {
        mode = btn.getAttribute("data-mode") || "pan";
        syncModeUi();
        renderVerts();
        if (mode === "pin") {
          setStatus(
            selectedPinId
              ? "Режим Пины · клик по карте ставит «" +
                  (pinById(selectedPinId)?.labelRu || selectedPinId) +
                  "»"
              : "Режим Пины · «+ Новый пин» или выбери в списке, затем клик по карте"
          );
        } else if (mode === "draw") {
          setStatus("Рисовать · клики = вершины · Alt/СКМ = пан");
        } else if (mode === "edit") {
          setStatus("Вершины · тяни точки · Delete = удалить");
        } else {
          setStatus("Перемещение · колесо = зум");
        }
      };
    });
    $("ammZoomIn").onclick = () => setZoom(zoom + 0.25);
    $("ammZoomOut").onclick = () => setZoom(zoom - 0.25);
    $("ammFit").onclick = () => fit();
    $("ammUndo").onclick = () => undoVert();
    $("ammDelVert").onclick = () => delVert();
    $("ammClearPoly").onclick = () => clearPoly();
    $("ammResetDraft").onclick = () => resetDraft();
    $("ammCopyOne").onclick = () => copyOne();
    $("ammCopyAll").onclick = () => copyAll();
    $("ammNewRegion").onclick = () => newRegion();
    const newPinBtn = $("ammNewPin");
    if (newPinBtn) newPinBtn.onclick = () => newPin();
    const copyPinBtn = $("ammCopyPin");
    if (copyPinBtn) copyPinBtn.onclick = () => copyPin();
    const resetPinBtn = $("ammResetPin");
    if (resetPinBtn) {
      resetPinBtn.onclick = () => {
        if (!selectedPinId) return;
        resetPinPos(selectedPinId);
        const t = pinById(selectedPinId);
        if (t && t._custom) {
          // сброс кастомного — обратно в центр карты
          t.x = 50;
          t.y = 50;
          const w = pctToWorld(50, 50);
          t.worldX = w.worldX;
          t.worldY = w.worldY;
          saveCustomPins();
        }
        refreshAll();
        setStatus("Позиция пина сброшена");
      };
    }

    const vp = $("ammViewport");
    vp.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        setZoom(zoom + (e.deltaY > 0 ? -0.15 : 0.15), { x: e.clientX, y: e.clientY });
      },
      { passive: false }
    );

    vp.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      if (e.target.closest && e.target.closest(".amm-vert")) return;
      if (e.target.closest && e.target.closest(".amm-pin")) return;
      // Рисование / пины: ЛКМ ставит; пан — СКМ / Alt / режим Перемещение
      const panGesture =
        mode === "pan" ||
        mode === "edit" ||
        e.button === 1 ||
        e.altKey;
      if ((mode === "draw" || mode === "pin") && !panGesture) {
        dragging = false;
        dragMoved = false;
        dragStart = {
          x: e.clientX,
          y: e.clientY,
          panX,
          panY,
          drawClick: true,
          pointerId: e.pointerId,
        };
        return;
      }
      dragging = true;
      dragMoved = false;
      dragStart = { x: e.clientX, y: e.clientY, panX, panY, drawClick: false };
      vp.classList.add("is-dragging");
      try {
        vp.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    vp.addEventListener("pointermove", (e) => {
      if (vertDrag && selectedRegionId) {
        const pct = clientToPct(e.clientX, e.clientY);
        if (!pct) return;
        const poly = regionPoly(selectedRegionId).map((p) => [p[0], p[1]]);
        poly[vertDrag.index] = [round1(pct.x), round1(pct.y)];
        setPoly(selectedRegionId, poly);
        refreshMap();
        updateMeta();
        return;
      }
      if (!dragging || !dragStart) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) dragMoved = true;
      panX = dragStart.panX + dx;
      panY = dragStart.panY + dy;
      applyTransform();
    });
    const end = (e) => {
      if (vertDrag) {
        vertDrag = null;
        return;
      }
      const start = dragStart;
      const moved = dragMoved;
      dragging = false;
      dragStart = null;
      dragMoved = false;
      vp.classList.remove("is-dragging");

      // Постановка пина / точки контура на pointerup (надёжнее, чем click)
      if (!start || !start.drawClick || moved) return;
      if (e.altKey) return;
      if (e.target.closest && e.target.closest(".amm-vert")) return;
      if (e.target.closest && e.target.closest(".amm-pin")) return;
      const pct = clientToPct(e.clientX, e.clientY);
      if (!pct) return;
      if (mode === "pin") {
        placeSelectedPin(pct.x, pct.y);
        return;
      }
      if (mode === "draw") addVertexAt(pct.x, pct.y);
    };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);

    window.addEventListener("pointermove", (e) => {
      if (!vertDrag || !selectedRegionId) return;
      const pct = clientToPct(e.clientX, e.clientY);
      if (!pct) return;
      const poly = regionPoly(selectedRegionId).map((p) => [p[0], p[1]]);
      poly[vertDrag.index] = [round1(pct.x), round1(pct.y)];
      setPoly(selectedRegionId, poly);
      refreshMap();
    });
    window.addEventListener("pointerup", () => {
      vertDrag = null;
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target.tagName || "") === "INPUT") return;
        e.preventDefault();
        delVert();
      }
    });
    window.addEventListener("resize", () => applyTransform());
  }

  function boot() {
    const src =
      (typeof CLAN_MAP_CRS !== "undefined" && CLAN_MAP_CRS.overviewSrc) ||
      "assets/maps/aden-overview.webp?v=1";
    $("ammImg").src = src;
    loadDrafts();
    loadPinDrafts();
    loadCustomPins();
    loadCustomRegions();
    wire();
    refreshAll();
    setStatus("Режим: перемещение · «+ Новый пин» или выбери пин → режим Пины → клик по карте");
    requestAnimationFrame(() => fit());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
