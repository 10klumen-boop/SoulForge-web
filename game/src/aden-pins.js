// ===== Каталог: город → охотничьи угодья (без карты) =====
(function () {
  const DRAFT_KEY = "sf_aden_city_grounds_drafts_v1";

  let drafts = Object.create(null); // id -> entry override / new
  let selectedHubId = null;
  let selectedFarmId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(t) {
    const el = $("apStatusLine");
    if (el) el.textContent = t || "";
  }

  function loadDrafts() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") drafts = parsed;
    } catch (_) {}
  }

  function saveDraftsStore() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    } catch (_) {}
  }

  function baseCatalog() {
    return typeof CLAN_HUNTING_CATALOG !== "undefined" ? CLAN_HUNTING_CATALOG.slice() : [];
  }

  function mergedCatalog() {
    const byId = Object.create(null);
    baseCatalog().forEach((e) => {
      byId[e.id] = { ...e };
    });
    Object.keys(drafts).forEach((id) => {
      byId[id] = { ...(byId[id] || {}), ...drafts[id], id };
    });
    return Object.keys(byId).map((id) => byId[id]);
  }

  function hubs() {
    const cat = mergedCatalog();
    const fromData =
      typeof CLAN_HUNTING_HUBS !== "undefined"
        ? CLAN_HUNTING_HUBS.map((h) => ({ ...h }))
        : [];
    const byId = Object.create(null);
    fromData.forEach((h) => {
      byId[h.id] = { id: h.id, labelRu: h.labelRu, labelL2: h.labelL2, tier: h.tier, kind: "city" };
    });
    cat.forEach((e) => {
      if (e.kind === "city" || e.kind === "hub") {
        byId[e.id] = {
          id: e.id,
          labelRu: e.labelRu,
          labelL2: e.labelL2 || e.labelRu,
          tier: byId[e.id]?.tier ?? 1,
          kind: e.kind,
          status: e.status,
        };
      }
    });
    // хабы только из farm.hubId
    cat.forEach((e) => {
      if (e.kind === "farm" && e.hubId && e.hubId !== "race" && !byId[e.hubId]) {
        byId[e.hubId] = {
          id: e.hubId,
          labelRu: e.hubId,
          labelL2: e.hubId,
          tier: 9,
          kind: "city",
          status: "planned",
        };
      }
    });
    return Object.keys(byId)
      .map((id) => byId[id])
      .sort((a, b) => (a.tier || 0) - (b.tier || 0) || String(a.labelRu).localeCompare(String(b.labelRu), "ru"));
  }

  function farmsForHub(hubId) {
    return mergedCatalog()
      .filter((e) => e.kind === "farm" && e.hubId === hubId)
      .sort((a, b) => String(a.labelRu).localeCompare(String(b.labelRu), "ru"));
  }

  function farmCount(hubId) {
    return farmsForHub(hubId).length;
  }

  function renderHubs() {
    const ul = $("apHubList");
    if (!ul) return;
    const list = hubs();
    if (!selectedHubId && list[0]) selectedHubId = list[0].id;
    ul.innerHTML = list
      .map((h) => {
        const n = farmCount(h.id);
        return (
          "<li><button type=\"button\" data-hub=\"" +
          h.id +
          "\" class=\"" +
          (selectedHubId === h.id ? "sel" : "") +
          "\"><b>" +
          h.labelRu +
          "</b><small>" +
          h.id +
          " · " +
          n +
          " угодий" +
          (h.status ? " · " + h.status : "") +
          "</small></button></li>"
        );
      })
      .join("");
    ul.querySelectorAll("[data-hub]").forEach((btn) => {
      btn.onclick = () => {
        selectedHubId = btn.getAttribute("data-hub");
        selectedFarmId = null;
        renderAll();
      };
    });
  }

  function renderFarms() {
    const body = $("apFarmBody");
    const title = $("apHubTitle");
    const newBtn = $("apNewFarm");
    const copyBtn = $("apCopyHub");
    if (!body) return;
    const hub = hubs().find((h) => h.id === selectedHubId);
    if (title) title.textContent = hub ? hub.labelRu + " — угодья" : "Выбери город";
    if (newBtn) newBtn.disabled = !selectedHubId;
    if (copyBtn) copyBtn.disabled = !selectedHubId;

    const farms = selectedHubId ? farmsForHub(selectedHubId) : [];
    body.innerHTML = farms
      .map((f) => {
        const st = f.status || "planned";
        const cap = f.capturable ? "да" : "нет";
        const sie = f.siegeEnabled ? "да" : "нет";
        return (
          '<tr data-farm="' +
          f.id +
          '" class="' +
          (selectedFarmId === f.id ? "is-sel" : "") +
          '">' +
          "<td>" +
          (f.labelRu || "") +
          "</td>" +
          "<td>" +
          f.id +
          "</td>" +
          "<td>" +
          (f.farmZoneId || "—") +
          "</td>" +
          '<td class="is-' +
          st +
          '">' +
          st +
          "</td>" +
          "<td>" +
          cap +
          "</td>" +
          "<td>" +
          sie +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    if (!farms.length) {
      body.innerHTML =
        '<tr><td colspan="6" style="color:#9a8f78">Нет угодий — нажми «+ Угодье»</td></tr>';
    }
    body.querySelectorAll("[data-farm]").forEach((tr) => {
      tr.onclick = () => {
        selectedFarmId = tr.getAttribute("data-farm");
        fillEdit(selectedFarmId);
        renderFarms();
      };
    });
  }

  function fillEdit(id) {
    const edit = $("apEdit");
    const f = mergedCatalog().find((e) => e.id === id);
    if (!edit || !f || f.kind !== "farm") {
      if (edit) edit.hidden = true;
      return;
    }
    edit.hidden = false;
    $("apId").value = f.id;
    $("apLabel").value = f.labelRu || "";
    $("apLabelL2").value = f.labelL2 || "";
    $("apFarmZone").value = f.farmZoneId || "";
    $("apStatus").value = f.status || "planned";
    $("apCapturable").checked = !!f.capturable;
    $("apSiege").checked = !!f.siegeEnabled;
    setStatus("Редактируешь: " + f.id + " · хаб " + (f.hubId || selectedHubId));
  }

  function readEdit() {
    const id = String($("apId").value || "")
      .trim()
      .replace(/\s+/g, "_");
    return {
      id,
      kind: "farm",
      hubId: selectedHubId,
      labelRu: String($("apLabel").value || id).trim(),
      labelL2: String($("apLabelL2").value || "").trim() || String($("apLabel").value || id).trim(),
      farmZoneId: String($("apFarmZone").value || "").trim() || null,
      status: $("apStatus").value || "planned",
      capturable: !!$("apCapturable").checked,
      siegeEnabled: !!$("apSiege").checked,
      x: null,
      y: null,
    };
  }

  function catalogObjectText(e) {
    return (
      "  {\n" +
      '    id: "' +
      e.id +
      '",\n' +
      '    kind: "farm",\n' +
      '    hubId: "' +
      (e.hubId || "") +
      '",\n' +
      '    labelRu: "' +
      String(e.labelRu || "").replace(/"/g, '\\"') +
      '",\n' +
      '    labelL2: "' +
      String(e.labelL2 || "").replace(/"/g, '\\"') +
      '",\n' +
      '    status: "' +
      (e.status || "planned") +
      '",\n' +
      "    farmZoneId: " +
      (e.farmZoneId ? '"' + e.farmZoneId + '"' : "null") +
      ",\n" +
      "    capturable: " +
      !!e.capturable +
      ",\n" +
      "    siegeEnabled: " +
      !!e.siegeEnabled +
      ",\n" +
      "    x: null,\n" +
      "    y: null,\n" +
      "  },"
    );
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

  function saveEdit() {
    const e = readEdit();
    if (!e.id || !selectedHubId) {
      setStatus("Нужны id и выбранный город");
      return;
    }
    drafts[e.id] = e;
    saveDraftsStore();
    selectedFarmId = e.id;
    renderAll();
    fillEdit(e.id);
    setStatus("Черновик сохранён: " + e.id + " → clan-hunting-catalog-data.js");
  }

  function deleteEdit() {
    const id = String($("apId").value || selectedFarmId || "").trim();
    if (!id || !drafts[id]) {
      setStatus("Нет черновика для удаления (базовый каталог не стирается)");
      return;
    }
    delete drafts[id];
    saveDraftsStore();
    selectedFarmId = null;
    $("apEdit").hidden = true;
    renderAll();
    setStatus("Черновик удалён: " + id);
  }

  function newFarm() {
    if (!selectedHubId) return;
    const label = prompt("Название угодья", "Новое угодье");
    if (!label) return;
    const idBase = String(label)
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 28);
    const id = idBase || "farm_" + Date.now().toString(36);
    drafts[id] = {
      id,
      kind: "farm",
      hubId: selectedHubId,
      labelRu: label,
      labelL2: label,
      farmZoneId: null,
      status: "planned",
      capturable: false,
      siegeEnabled: false,
      x: null,
      y: null,
    };
    saveDraftsStore();
    selectedFarmId = id;
    renderAll();
    fillEdit(id);
    setStatus("Новое угодье: " + id);
  }

  function newHub() {
    const label = prompt("Название города", "Новый город");
    if (!label) return;
    const idBase = String(label)
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 24);
    const id = idBase || "city_" + Date.now().toString(36);
    drafts[id] = {
      id,
      kind: "city",
      hubId: null,
      labelRu: label,
      labelL2: label,
      status: "planned",
      farmZoneId: null,
      x: null,
      y: null,
    };
    saveDraftsStore();
    selectedHubId = id;
    selectedFarmId = null;
    renderAll();
    setStatus("Новый город: " + id);
  }

  async function copyOne() {
    const e = readEdit();
    if (!e.id) {
      setStatus("Выбери угодье");
      return;
    }
    const ok = await copyText(catalogObjectText(e));
    console.log("[aden-pins]", e);
    setStatus(ok ? "Скопировано в буфер → вставь в CLAN_HUNTING_CATALOG" : "См. консоль");
  }

  async function copyHub() {
    if (!selectedHubId) return;
    const text = farmsForHub(selectedHubId).map(catalogObjectText).join("\n");
    if (!text) {
      setStatus("Нет угодий у хаба");
      return;
    }
    const ok = await copyText(text);
    console.log("[aden-pins] hub", selectedHubId, farmsForHub(selectedHubId));
    setStatus(ok ? "Скопированы угодья хаба " + selectedHubId : "См. консоль");
  }

  function renderAll() {
    renderHubs();
    renderFarms();
    if (selectedFarmId) fillEdit(selectedFarmId);
  }

  function boot() {
    loadDrafts();
    $("apNewHub").onclick = () => newHub();
    $("apNewFarm").onclick = () => newFarm();
    $("apSave").onclick = () => saveEdit();
    $("apCopyOne").onclick = () => copyOne();
    $("apCopyHub").onclick = () => copyHub();
    $("apDelete").onclick = () => deleteEdit();
    renderAll();
    setStatus("Выбери город слева → угодья справа → правь / копируй в data-файл");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
