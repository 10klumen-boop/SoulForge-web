// ===== Mine UI: рендер, HUD, анимации, эффекты =====
// Зависит от mine-core.js (mineSession, mineGnomes и т.д.), загружается до него.

function mineSessionLootEl() {
  if (typeof gameDoc === "function") return gameDoc().getElementById("mineSessionLoot");
  return document.getElementById("mineSessionLoot");
}

function mineSessionLootDrawerEl() {
  if (typeof gameDoc === "function") return gameDoc().getElementById("mineSessionLootDrawer");
  return document.getElementById("mineSessionLootDrawer");
}

function mineResourceFavDrawerEl() {
  if (typeof gameDoc === "function") return gameDoc().getElementById("mineResourceFavDrawer");
  return document.getElementById("mineResourceFavDrawer");
}

function mineSidePanelsEl() {
  if (typeof gameDoc === "function") return gameDoc().getElementById("mineSidePanels");
  return document.getElementById("mineSidePanels");
}

function syncMineSidePanels() {
  const side = mineSidePanelsEl();
  if (!side) return;
  ensureMineSidePanelsHost(side);
  const lootDrawer = mineSessionLootDrawerEl();
  const favDrawer = mineResourceFavDrawerEl();
  const lootOpen = !!(lootDrawer && !lootDrawer.hidden);
  const favOpen = !!(favDrawer && !favDrawer.hidden);
  const any = lootOpen || favOpen;
  side.hidden = !any;
  side.classList.toggle("has-loot", lootOpen);
  side.classList.toggle("has-fav", favOpen);
  side.classList.toggle("has-both", lootOpen && favOpen);
  if (any) layoutMineSidePanels();
  else clearMineSidePanelsLayout();
}

function ensureMineSidePanelsHost(side) {
  const el = side || mineSidePanelsEl();
  if (!el || typeof document === "undefined" || !document.body) return;
  if (el.parentElement !== document.body) document.body.appendChild(el);
}

function clearMineSidePanelsLayout() {
  const side = mineSidePanelsEl();
  if (!side) return;
  side.style.left = "";
  side.style.top = "";
  side.style.height = "";
  side.style.width = "";
}

/** Панели в тёмном gutter слева от .shell / поля — вне карточки боя. */
function layoutMineSidePanels() {
  const side = mineSidePanelsEl();
  const doc = typeof gameDoc === "function" ? gameDoc() : document;
  const field = doc.getElementById("minefield");
  const shell = doc.querySelector(".shell");
  if (!side || side.hidden || !field) return;
  const fr = field.getBoundingClientRect();
  const edgeLeft = shell ? shell.getBoundingClientRect().left : fr.left;
  const gap = 8;
  const avail = Math.max(0, edgeLeft - gap);
  const w = avail >= 100
    ? Math.min(260, Math.max(100, avail - gap))
    : Math.min(180, Math.max(120, Math.floor(window.innerWidth * 0.26)));
  side.style.width = w + "px";
  side.style.left = (avail >= 100
    ? Math.max(4, Math.round(edgeLeft - w - gap))
    : 4) + "px";
  side.style.top = Math.max(4, Math.round(fr.top)) + "px";
  side.style.height = Math.max(120, Math.round(fr.height)) + "px";
}

function wireMineSidePanelsLayout() {
  if (typeof window === "undefined" || window.__mineSidePanelsLayoutWired) return;
  window.__mineSidePanelsLayoutWired = true;
  ensureMineSidePanelsHost();
  const relayout = () => {
    const side = mineSidePanelsEl();
    if (side && !side.hidden) layoutMineSidePanels();
  };
  window.addEventListener("resize", relayout);
  window.addEventListener("scroll", relayout, true);
}

function mineSessionLootKindsCount(rows) {
  return rows.reduce((n, r) => n + (r.qty > 1 ? r.qty : 1), 0);
}

function closeMineSessionLootDrawer() {
  mineSessionLootOpen = false;
  const drawer = mineSessionLootDrawerEl();
  if (drawer) {
    drawer.hidden = true;
    drawer.innerHTML = "";
    drawer.classList.remove("is-open");
  }
  const bar = mineSessionLootEl();
  if (bar) {
    bar.classList.remove("is-open");
    const btn = bar.querySelector("#mineSessionLootToggle");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  syncMineSidePanels();
}

function closeMineResourceFavDrawer() {
  mineResourceFavOpen = false;
  const drawer = mineResourceFavDrawerEl();
  if (drawer) {
    drawer.hidden = true;
    drawer.innerHTML = "";
    drawer.classList.remove("is-open");
  }
  const bar =
    typeof gameDoc === "function"
      ? gameDoc().getElementById("mineResourceFav")
      : document.getElementById("mineResourceFav");
  if (bar) {
    bar.classList.remove("is-open");
    const btn = bar.querySelector("#mineResourceFavToggle");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  syncMineSidePanels();
}

function mineLootRowIcon(row) {
  if (row && row.icon) return row.icon;
  if (row && row.kind === "scroll") {
    const parts = String(row.id || "").split(":");
    if (parts.length >= 3) {
      const target = parts[0];
      const typeId = parts[1];
      const grade = parts[2];
      if (typeof scrollDef === "function") {
        const def = scrollDef(target, grade, typeId);
        if (def && def.icon) return def.icon;
      }
      if (typeof scrollTierIcon === "function") return scrollTierIcon(typeId, grade, target);
    }
  }
  return "icons/char_menu.png?v=10";
}

function renderMineSessionLootDrawer(rows, totalQty) {
  const drawer = mineSessionLootDrawerEl();
  if (!drawer) return;
  if (!mineSessionLootOpen || !rows.length) {
    drawer.hidden = true;
    drawer.innerHTML = "";
    drawer.classList.remove("is-open");
    syncMineSidePanels();
    return;
  }
  drawer.hidden = false;
  drawer.classList.add("is-open");
  const cells = rows
    .map((row) => {
      const grade = row.grade || "D";
      const gClass = row.kind === "accessory" ? "g-epic" : "g-" + grade;
      const plus = row.plus ? " +" + row.plus : "";
      const label = row.kind === "shots" ? row.name : (row.name || "?") + plus;
      const icon = mineLootRowIcon(row);
      const qty =
        row.qty > 1 ? '<span class="mine-loot-cell-qty">×' + row.qty + "</span>" : "";
      return (
        '<div class="mine-loot-cell ' +
        gClass +
        '" title="' +
        label.replace(/"/g, "&quot;") +
        '">' +
        '<img src="' +
        icon +
        '" alt="" loading="lazy" draggable="false">' +
        qty +
        '<span class="mine-loot-cell-name">' +
        label +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  drawer.innerHTML =
    '<div class="mine-loot-drawer-head">' +
    "<b>Дроп за сессию</b>" +
    '<span class="mine-loot-count">' +
    totalQty +
    "</span>" +
    '<button type="button" class="mine-loot-drawer-close" id="mineSessionLootClose" title="Закрыть" aria-label="Закрыть">×</button>' +
    "</div>" +
    '<div class="mine-loot-grid sf-scroll">' +
    cells +
    "</div>";
  const closeBtn = drawer.querySelector("#mineSessionLootClose");
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      closeMineSessionLootDrawer();
    };
  }
  syncMineSidePanels();
}

function renderMineSessionLoot() {
  const el = mineSessionLootEl();
  if (!el) return;
  const active = !!mineSession;
  const rows = active && mineSession.loot ? Object.values(mineSession.loot) : [];
  if (!active) {
    el.hidden = true;
    el.innerHTML = "";
    el.classList.remove("is-open");
    closeMineSessionLootDrawer();
    if (typeof renderMineResourceFavorites === "function") renderMineResourceFavorites();
    return;
  }
  el.hidden = false;
  rows.sort((a, b) => {
    const ga = MINE_LOOT_GRADE_RANK[a.grade] ?? 0;
    const gb = MINE_LOOT_GRADE_RANK[b.grade] ?? 0;
    if (gb !== ga) return gb - ga;
    return String(a.name || "").localeCompare(String(b.name || ""), "ru");
  });
  const totalQty = mineSessionLootKindsCount(rows);

  if (!rows.length) {
    closeMineSessionLootDrawer();
    el.classList.remove("is-open");
    el.innerHTML =
      '<div class="mine-loot-toggle is-static">' +
      '<span class="mine-loot-title">' +
      '<span class="mine-loot-lbl">Дроп за сессию</span>' +
      "</span>" +
      '<span class="mine-loot-empty">пока нет предметов</span>' +
      "</div>";
    if (typeof renderMineResourceFavorites === "function") renderMineResourceFavorites();
    return;
  }

  const open = !!mineSessionLootOpen;
  el.classList.toggle("is-open", open);

  el.innerHTML =
    '<button type="button" class="mine-loot-toggle" id="mineSessionLootToggle" aria-expanded="' +
    (open ? "true" : "false") +
    '" title="Открыть слева от поля (тёмная зона)">' +
    '<span class="mine-loot-chevron" aria-hidden="true"></span>' +
    '<span class="mine-loot-title">' +
    '<span class="mine-loot-lbl">Дроп за сессию</span>' +
    '<span class="mine-loot-count">' +
    totalQty +
    "</span>" +
    "</span>" +
    "</button>";

  const btn = el.querySelector("#mineSessionLootToggle");
  if (btn) {
    btn.onclick = () => {
      mineSessionLootOpen = !mineSessionLootOpen;
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      renderMineSessionLoot();
    };
  }
  renderMineSessionLootDrawer(rows, totalQty);
  if (typeof renderMineResourceFavorites === "function") renderMineResourceFavorites();
}

function renderMineHudStats() {
  syncMineShotHud();
  if (typeof renderMineResourceFavorites === "function") renderMineResourceFavorites();
}

function renderMineResourceFavDrawer(rows, needLeft, countLabel) {
  const drawer = mineResourceFavDrawerEl();
  if (!drawer) return;
  if (!mineResourceFavOpen || !rows.length) {
    drawer.hidden = true;
    drawer.innerHTML = "";
    drawer.classList.remove("is-open");
    syncMineSidePanels();
    return;
  }
  drawer.hidden = false;
  drawer.classList.add("is-open");
  const cells = rows
    .map((row) => {
      const leftCls = row.done ? " is-done" : " is-need";
      const leftTxt = row.done
        ? "готово"
        : "ещё " + (typeof fmt === "function" ? fmt(row.left) : row.left);
      const title =
        (row.name || "") +
        " · " +
        row.have +
        "/" +
        row.target +
        (row.done ? " ✓" : " · осталось " + row.left) +
        " · тап — убрать";
      const gClass = row.grade ? " g-" + row.grade : "";
      const icon = row.icon
        ? '<img src="' + row.icon + '" alt="" loading="lazy" draggable="false">'
        : "";
      const qty =
        '<span class="mine-loot-cell-qty">' +
        (typeof fmt === "function" ? fmt(row.have) : row.have) +
        "/" +
        (typeof fmt === "function" ? fmt(row.target) : row.target) +
        "</span>";
      return (
        '<button type="button" class="mine-loot-cell mine-fav-cell' +
        leftCls +
        gClass +
        '" data-fav-kind="' +
        row.kind +
        '" data-fav-id="' +
        String(row.id).replace(/"/g, "") +
        '" title="' +
        title.replace(/"/g, "&quot;") +
        '">' +
        icon +
        qty +
        '<span class="mine-loot-cell-name">' +
        (row.name || "?") +
        "</span>" +
        '<span class="mine-fav-cell-left">' +
        leftTxt +
        "</span>" +
        "</button>"
      );
    })
    .join("");
  drawer.innerHTML =
    '<div class="mine-loot-drawer-head">' +
    "<b>Дофарм</b>" +
    '<span class="mine-loot-count' +
    (needLeft <= 0 ? " is-done" : "") +
    '">' +
    countLabel +
    "</span>" +
    '<button type="button" class="mine-loot-drawer-close" id="mineResourceFavClose" title="Закрыть" aria-label="Закрыть">×</button>' +
    "</div>" +
    '<div class="mine-loot-grid sf-scroll">' +
    cells +
    "</div>";
  const closeBtn = drawer.querySelector("#mineResourceFavClose");
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      closeMineResourceFavDrawer();
    };
  }
  drawer.querySelectorAll(".mine-fav-cell").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof removeResourceFavorite !== "function") return;
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      removeResourceFavorite(btn.getAttribute("data-fav-kind"), btn.getAttribute("data-fav-id"));
      if (typeof toast === "function") toast("Убрано из избранного", "info");
      renderMineResourceFavorites();
      if (
        document.getElementById("screen-shop")?.classList?.contains("active") &&
        typeof renderWorkshop === "function"
      ) {
        renderWorkshop();
      }
    };
  });
  syncMineSidePanels();
}

function renderMineResourceFavorites() {
  const el =
    typeof gameDoc === "function"
      ? gameDoc().getElementById("mineResourceFav")
      : document.getElementById("mineResourceFav");
  if (!el) return;
  const rows =
    typeof listResourceFavoritesResolved === "function" ? listResourceFavoritesResolved() : [];
  if (!rows.length) {
    el.hidden = true;
    el.innerHTML = "";
    el.classList.remove("is-open");
    mineResourceFavOpen = false;
    closeMineResourceFavDrawer();
    return;
  }
  el.hidden = false;
  const open = !!mineResourceFavOpen;
  el.classList.toggle("is-open", open);
  const needLeft = rows.reduce((n, r) => n + (r.done ? 0 : 1), 0);
  const countLabel = needLeft > 0 ? needLeft : rows.length;

  el.innerHTML =
    '<button type="button" class="mine-loot-toggle" id="mineResourceFavToggle" aria-expanded="' +
    (open ? "true" : "false") +
    '" title="Открыть слева от поля (тёмная зона)">' +
    '<span class="mine-loot-chevron" aria-hidden="true"></span>' +
    '<span class="mine-loot-title">' +
    '<span class="mine-loot-lbl">Дофарм</span>' +
    '<span class="mine-loot-count' +
    (needLeft <= 0 ? " is-done" : "") +
    '">' +
    countLabel +
    "</span>" +
    "</span>" +
    "</button>";

  const toggle = el.querySelector("#mineResourceFavToggle");
  if (toggle) {
    toggle.onclick = () => {
      mineResourceFavOpen = !mineResourceFavOpen;
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      renderMineResourceFavorites();
    };
  }
  renderMineResourceFavDrawer(rows, needLeft, countLabel);
}

function syncMineShotHud() {
  const btn = document.getElementById("mineShotToggle");
  const stockEl = document.getElementById("mineShotStock");
  const iconEl = document.getElementById("mineShotIcon");
  if (!btn || !stockEl) return;
  if (typeof ensureWorkshopState === "function") ensureWorkshopState();
  const auto = state.autoShots !== false;
  const stock = typeof mineShotStock === "function" ? mineShotStock() : { kind: "soul", grade: "D", qty: 0 };
  const icon =
    (typeof SHOT_ICON !== "undefined" && SHOT_ICON[stock.kind] && SHOT_ICON[stock.kind][stock.grade]) ||
    "icons/etc_spirit_bullet_blue_i00.png";
  if (iconEl && iconEl.getAttribute("src") !== icon) iconEl.src = icon;
  btn.classList.toggle("off", !auto);
  btn.classList.toggle("on", auto);
  btn.classList.toggle("empty", !(stock.qty > 0));
  btn.setAttribute("aria-pressed", auto ? "true" : "false");
  stockEl.textContent = stock.qty > 0 ? fmt(stock.qty) : "0";
  const kindName = stock.kind === "spirit" ? "Spiritshot" : "Soulshot";
  btn.title = auto
    ? ("Авто " + kindName + " " + stock.grade + " · вкл · клик — выкл")
    : ("Авто " + kindName + " " + stock.grade + " · выкл · урон ×0.5 · клик — вкл");
}

function mineArea() {
  return document.getElementById("mineStageInner") || document.getElementById("mineStage") || $("#minefield");
}

function mineLootLayer() {
  return document.getElementById("mineLootLayer") || document.getElementById("mineStage") || mineArea();
}

function mineLootCoords(g) {
  const layer = mineLootLayer();
  const lr = layer.getBoundingClientRect();
  const gr = g.getBoundingClientRect();
  const type = g._type || "normal";
  return {
    x: gr.left - lr.left + gr.width * (0.38 + Math.random() * 0.24),
    y: gr.top - lr.top + gr.height * (type === "boss" ? 0.48 : 0.58),
    golden: type === "golden" || type === "boss",
  };
}

function mineSpawnField() {
  const inner = document.getElementById("mineStageInner");
  const stage = document.getElementById("mineStage");
  if (inner && inner.clientWidth > 48 && inner.clientHeight > 48) return inner;
  if (stage && stage.clientWidth > 48 && stage.clientHeight > 48) return stage;
  return mineArea();
}

function mineSoloHalfSize(type) {
  if (type === "boss") return { hw: 118, hh: 145 };
  if (type === "golden") return { hw: 108, hh: 135 };
  return { hw: 100, hh: 125 };
}

let mineSoloSlotLast = -1;

function mineSoloPosition(field, type) {
  const stage = document.getElementById("mineStage") || field;
  const w = Math.max(stage?.clientWidth || 0, field?.clientWidth || 0, 280);
  const h = Math.max(stage?.clientHeight || 0, field?.clientHeight || 0, 200);
  const { hw, hh } = mineSoloHalfSize(type);
  const padX = Math.min(hw + 8, Math.floor(w * 0.42));
  const padY = Math.min(hh + 10, Math.floor(h * 0.42));
  const minX = padX;
  const maxX = Math.max(minX, w - padX);
  const midX = (minX + maxX) / 2;
  const slots = [minX, midX, maxX];
  let idx = Math.floor(Math.random() * 3);
  if (idx === mineSoloSlotLast && slots.length > 1) {
    idx = (idx + 1 + Math.floor(Math.random() * 2)) % 3;
  }
  mineSoloSlotLast = idx;
  const y = Math.min(h - padY, Math.max(padY, h * 0.56));
  return { x: slots[idx], y };
}

function mobTimerBarHtml() {
  return (
    '<div class="mob-timer-wrap">' +
    '<div class="mob-timer" aria-hidden="true"><span class="mob-timer-fill"></span></div>' +
    '<span class="mob-timer-label">—</span>' +
    "</div>"
  );
}

function mobHpBarHtml(hp, maxHp) {
  const cur = hp != null ? hp : 0;
  const max = maxHp != null ? maxHp : 0;
  return (
    '<div class="mob-hp-wrap">' +
    '<div class="mob-hp" aria-hidden="true"><span class="mob-hp-fill"></span></div>' +
    '<span class="mob-hp-label">' + fmtCombat(cur) + " / " + fmtCombat(max) + "</span>" +
    "</div>"
  );
}

function updateMobTimerVisual(g, leftMs, totalMs) {
  const fill = g.querySelector(".mob-timer-fill");
  const label = g.querySelector(".mob-timer-label");
  const pct = totalMs > 0 ? leftMs / totalMs : 0;
  if (fill) fill.style.width = Math.max(0, pct * 100) + "%";
  if (label) label.textContent = Math.max(0, Math.ceil(leftMs / 1000)) + "с";
}

function clearMobTimer(g) {
  if (g._timerRaf) cancelAnimationFrame(g._timerRaf);
  g._timerRaf = null;
  if (g._t) { clearTimeout(g._t); g._t = null; }
}

function attachMobTimer(g, lifeMs, onExpire, totalLifeMs) {
  clearMobTimer(g);
  g._timerLife = totalLifeMs || lifeMs;
  g._timerEnd = Date.now() + lifeMs;
  g._onExpire = onExpire;
  const tick = () => {
    if (!mineGnomes.has(g)) return;
    const left = Math.max(0, g._timerEnd - Date.now());
    if (left > 0 && typeof mineSkillTimerFreezeActive === "function" && mineSkillTimerFreezeActive()) {
      g._timerEnd += 16;
    } else if (left > 0 && typeof mobTimerUrgencyDrain === "function") {
      const drain = mobTimerUrgencyDrain(g, left, g._timerLife);
      if (drain !== 0) g._timerEnd -= Math.round(16 * drain);
    }
    const left2 = Math.max(0, g._timerEnd - Date.now());
    updateMobTimerVisual(g, left2, g._timerLife);
    if (left2 <= 0) {
      clearMobTimer(g);
      if (onExpire) onExpire();
      return;
    }
    g._timerRaf = requestAnimationFrame(tick);
  };
  g._timerRaf = requestAnimationFrame(tick);
}

function extendMobTimer(g, extraMs) {
  if (!g || !g._timerEnd || !extraMs) return;
  if (g._enraged) return;
  const cap = g._timerCap || g._timerEnd;
  g._timerEnd = Math.min(g._timerEnd + extraMs, cap);
}

function mobTargetVisualHtml(sprite, alt) {
  const kind = sprite?.kind || "portrait";
  if (kind === "sprite") {
    const anim = sprite.anim || "idle";
    return (
      '<div class="mob-sprite-stage mob-anim-' + anim + '">' +
      '<div class="mob-sprite-glow" aria-hidden="true"></div>' +
      '<div class="mob-sprite-shadow" aria-hidden="true"></div>' +
      '<img class="mob-sprite-img" src="' + sprite.src + '" alt="' + alt + '" title="' + alt + '">' +
      "</div>"
    );
  }
  return (
    '<div class="mob-portrait-frame">' +
    '<img src="' + sprite.src + '" alt="' + alt + '" title="' + alt + '">' +
    "</div>"
  );
}

function mobTargetShellHtml(sprite, alt, nameHtml, hpHtml) {
  const kind = sprite?.kind || "portrait";
  if (kind === "sprite") {
    return (
      '<div class="mine-solo-unit">' +
      mobTimerBarHtml() +
      mobTargetVisualHtml(sprite, alt) +
      '<div class="mob-hud">' + nameHtml + hpHtml + "</div></div>"
    );
  }
  return (
    '<div class="mine-solo-card">' +
    mobTimerBarHtml() +
    mobTargetVisualHtml(sprite, alt) +
    '<div class="mob-card-foot">' + nameHtml + hpHtml + "</div></div>"
  );
}

function updateMobHpBar(g) {
  const fill = g.querySelector(".mob-hp-fill");
  const label = g.querySelector(".mob-hp-label");
  if (!g._maxHp) return;
  const hp = Math.max(0, g._hp ?? g._maxHp);
  if (fill) fill.style.width = Math.max(0, (hp / g._maxHp) * 100) + "%";
  let text = fmtCombat(hp) + " / " + fmtCombat(g._maxHp);
  const sh = Math.max(0, Number(g._shieldHp) || 0);
  if (sh > 0) {
    text += " · щит " + fmtCombat(sh);
    g.classList.add("mob-shielded");
  } else if (!g._instanceEncounter) {
    /* farm shield flag handled elsewhere */
  } else {
    g.classList.remove("mob-shielded");
  }
  if (label) label.textContent = text;
}

function floatText(x, y, text, color, opts) {
  opts = opts || {};
  const field = mineLootLayer();
  const el = document.createElement("div");
  el.className = "floattxt" + (opts.adena ? " floattxt-adena" : "");
  el.textContent = text;
  el.style.color = color;
  el.style.left = x + "px";
  el.style.top = (y - 30) + "px";
  field.appendChild(el);
  setTimeout(() => el.remove(), opts.adena ? 1100 : 900);
}

function spawnLootDrop(x, y, icon, opts) {
  const field = mineLootLayer();
  const golden = !!opts.golden;
  const n = opts.count ?? Math.min(16, Math.max(6, Math.round(Math.log10(Math.max(10, opts.amount || 10)) * 2.6)));
  const spread = opts.spread ?? (golden ? 26 : 20);
  const size = opts.size || "coin";
  for (let i = 0; i < n; i++) {
    const el = document.createElement("img");
    let cls = "loot-drop loot-" + size;
    if (golden) cls += " golden";
    if (opts.grade) cls += " g-" + opts.grade;
    el.className = cls;
    el.src = icon;
    el.alt = "";
    el.onerror = function () {
      if (this.dataset.fallback) return;
      this.dataset.fallback = "1";
      this.src = "icons/etc_coins_gold_i00.png";
    };
    const ox = (Math.random() - 0.5) * spread;
    const oy = (Math.random() - 0.5) * 8;
    const delay = opts.stagger === false ? 0 : i * 18 + Math.random() * 14;
    const sx = x + ox;
    const sy = y + oy;
    el.style.left = sx + "px";
    el.style.top = sy + "px";
    field.appendChild(el);
    setTimeout(() => {
      let t = 0;
      const vx = (Math.random() - 0.5) * (opts.vx ?? (golden ? 3.5 : 2.8));
      let vy = opts.vy0 ?? (-1.2 - Math.random() * 1.8);
      let px = sx;
      let py = sy;
      const spin = (Math.random() - 0.5) * (opts.spin ?? 10);
      const tick = () => {
        t += 16;
        vy += opts.gravity ?? 0.24;
        px += vx;
        py += vy;
        const life = t / (opts.duration || 1100);
        el.style.left = px + "px";
        el.style.top = py + "px";
        const fade = opts.lateFade
          ? Math.max(0, (life - 0.55) / 0.45)
          : life;
        const scale = opts.lateFade
          ? Math.max(0.9, 1 - fade * 0.12)
          : Math.max(0.45, 1 - life * 0.35);
        el.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${spin + t * (opts.rotSpeed ?? 0.12)}deg)`;
        el.style.opacity = String(opts.lateFade ? Math.max(0, 1 - fade * 1.15) : Math.max(0, 1 - life * 0.95));
        if (t < (opts.duration || 1100)) requestAnimationFrame(tick);
        else el.remove();
      };
      requestAnimationFrame(tick);
    }, delay);
  }
}

function spawnAdenaDrop(x, y, amount, golden) {
  spawnLootDrop(x, y, ADENA_ICON, {
    amount,
    golden,
    vy0: -2.2 - Math.random() * 1.6,
    gravity: 0.2,
    duration: 1200,
    spread: golden ? 28 : 22,
  });
}

function spawnWeaponDrop(x, y, weapon) {
  spawnLootDrop(x, y, weapon.icon, {
    count: 1,
    golden: true,
    grade: weapon.grade,
    size: "weapon",
    spread: 6,
    vy0: 0.2,
    vx: 1,
    gravity: 0.11,
    spin: 4,
    rotSpeed: 0.06,
    duration: 2600,
    lateFade: true,
    stagger: false,
  });
}

function mineBurst(x, y, color, n) {
  const field = mineLootLayer();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
    const p = document.createElement("div"); p.className = "particle";
    const sz = 4 + Math.random() * 6;
    p.style.width = p.style.height = sz + "px"; p.style.left = x + "px"; p.style.top = y + "px";
    p.style.background = Math.random() > .5 ? color : "#fff"; p.style.boxShadow = `0 0 ${sz*1.5}px ${color}`;
    field.appendChild(p);
    let t = 0, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp - 2, px = x, py = y;
    const tick = () => { t += 16; vy += 0.4; px += vx; py += vy; const k = 1 - t / 700;
      p.style.left = px + "px"; p.style.top = py + "px"; p.style.opacity = Math.max(0, k); p.style.transform = `scale(${Math.max(0.1, k)})`;
      if (t < 700) requestAnimationFrame(tick); else p.remove(); };
    requestAnimationFrame(tick);
  }
}
