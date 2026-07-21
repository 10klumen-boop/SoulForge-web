// ===== Mine UI: рендер, HUD, анимации, эффекты =====
// Зависит от mine-core.js (mineSession, mineGnomes и т.д.), загружается до него.

function mineSessionLootEl() {
  if (typeof gameDoc === "function") return gameDoc().getElementById("mineSessionLoot");
  return document.getElementById("mineSessionLoot");
}

function mineSessionLootKindsCount(rows) {
  return rows.reduce((n, r) => n + (r.qty > 1 ? r.qty : 1), 0);
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
    mineSessionLootOpen = false;
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
    el.classList.remove("is-open");
    mineSessionLootOpen = false;
    el.innerHTML =
      '<div class="mine-loot-toggle is-static">' +
      '<span class="mine-loot-title">' +
      '<span class="mine-loot-lbl">Дроп за сессию</span>' +
      "</span>" +
      '<span class="mine-loot-empty">пока нет предметов</span>' +
      "</div>";
    return;
  }

  const open = !!mineSessionLootOpen;
  el.classList.toggle("is-open", open);

  const bodyHtml =
    '<div class="mine-loot-body">' +
    rows.map((row) => {
      const grade = row.grade || "D";
      const gClass = row.kind === "accessory" ? "g-epic" : "g-" + grade;
      const plus = row.plus ? " +" + row.plus : "";
      const qty = row.qty > 1 ? '<span class="mine-loot-qty">×' + row.qty + "</span>" : "";
      const label = row.kind === "shots" ? row.name : (row.name || "?") + plus;
      const icon = row.icon || "icons/char_menu.png?v=10";
      return (
        '<span class="mine-loot-chip ' + gClass + '" title="' + label.replace(/"/g, "&quot;") + '">' +
        '<img src="' + icon + '" alt="" loading="lazy" draggable="false">' +
        '<span class="mine-loot-name">' + label + "</span>" + qty +
        "</span>"
      );
    }).join("") +
    "</div>";

  el.innerHTML =
    '<button type="button" class="mine-loot-toggle" id="mineSessionLootToggle" aria-expanded="' +
    (open ? "true" : "false") + '">' +
    '<span class="mine-loot-chevron" aria-hidden="true"></span>' +
    '<span class="mine-loot-title">' +
    '<span class="mine-loot-lbl">Дроп за сессию</span>' +
    '<span class="mine-loot-count">' + totalQty + "</span>" +
    "</span>" +
    "</button>" +
    bodyHtml;

  const btn = el.querySelector("#mineSessionLootToggle");
  if (btn) {
    btn.onclick = () => {
      mineSessionLootOpen = !mineSessionLootOpen;
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      renderMineSessionLoot();
    };
  }
}

function renderMineHudStats() {
  syncMineShotHud();
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
  if (label) label.textContent = fmtCombat(hp) + " / " + fmtCombat(g._maxHp);
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
