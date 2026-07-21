// ===== Автокликер: core (покупка на время, tick на поле) =====

let _autoClickerTimer = null;
let _autoClickerLastHitAt = 0;

function ensureAutoClickerState() {
  if (!state.autoClicker || typeof state.autoClicker !== "object") {
    ProgressStore.set("autoClicker", defaultAutoClickerState());
  }
  const ac = state.autoClicker;
  if (ac.enabled == null) {
    ProgressStore.update("autoClicker", (a) => ({ ...(a || defaultAutoClickerState()), enabled: true }));
  }
}

function autoClickerPackById(id) {
  return (AUTO_CLICKER.packs || []).find((p) => p.id === id) || null;
}

function autoClickerChapterPriceMult() {
  const zone = typeof farmZoneById === "function"
    ? farmZoneById(state.farmZone || "banana_mine")
    : { chapter: 1 };
  const chapter = Math.max(1, zone.chapter || 1);
  const step = typeof tune === "function"
    ? tune("autoClicker.chapterPriceMultStep", AUTO_CLICKER.chapterPriceMultStep)
    : AUTO_CLICKER.chapterPriceMultStep;
  return 1 + (chapter - 1) * step;
}

function autoClickerPackPrice(pack) {
  if (!pack) return 0;
  return Math.round(pack.price * autoClickerChapterPriceMult());
}

function autoClickerFreezeForPause() {
  ensureAutoClickerState();
  const now = Date.now();
  const ac = state.autoClicker;
  if ((ac.until || 0) <= now) return;
  if (ac.pauseStartedAt) return;
  ProgressStore.update("autoClicker", (a) => ({
    ...(a || defaultAutoClickerState()),
    pauseStartedAt: now,
  }));
}

function autoClickerResumeFromPause() {
  ensureAutoClickerState();
  const ac = state.autoClicker;
  if (!ac.pauseStartedAt) return;
  const now = Date.now();
  const frozen = Math.max(0, now - ac.pauseStartedAt);
  ProgressStore.update("autoClicker", (a) => ({
    ...(a || defaultAutoClickerState()),
    until: (a?.until || 0) + frozen,
    pauseStartedAt: 0,
  }));
}

function autoClickerEffectiveUntil(now) {
  ensureAutoClickerState();
  now = now || Date.now();
  const ac = state.autoClicker;
  let until = ac.until || 0;
  if (ac.pauseStartedAt && until > ac.pauseStartedAt) {
    until += Math.max(0, now - ac.pauseStartedAt);
  }
  return until;
}

function autoClickerRemainingMs(now) {
  now = now || Date.now();
  return Math.max(0, autoClickerEffectiveUntil(now) - now);
}

function autoClickerIsActive(now) {
  ensureAutoClickerState();
  if (!state.autoClicker.enabled) return false;
  return autoClickerRemainingMs(now) > 0;
}

function buyAutoClickerPack(packId) {
  ensureAutoClickerState();
  const pack = autoClickerPackById(packId);
  if (!pack) {
    if (typeof renderAutoClickerPanel === "function") {
      renderAutoClickerPanel({ status: "Неизвестный пакет автоудара", statusKind: "warn" });
    }
    return false;
  }
  const price = autoClickerPackPrice(pack);
  if ((state.adena || 0) < price) {
    const need = typeof fmtAdena === "function" ? fmtAdena(price) : price;
    if (typeof renderAutoClickerPanel === "function") {
      renderAutoClickerPanel({ status: "Не хватает adena (нужно " + need + ")", statusKind: "warn" });
    }
    return false;
  }
  ProgressStore.update("adena", (a) => (a || 0) - price);
  const now = Date.now();
  const curUntil = autoClickerEffectiveUntil(now);
  const base = Math.max(now, curUntil);
  ProgressStore.update("autoClicker", (a) => ({
    ...(a || defaultAutoClickerState()),
    until: base + pack.durationMs,
    enabled: true,
    pauseStartedAt: 0,
  }));
  if (typeof save === "function") save();
  if ($("#adena")) $("#adena").textContent = typeof fmt === "function" ? fmt(state.adena) : String(state.adena);
  if (typeof Audio2 !== "undefined" && Audio2.success) Audio2.success();
  startAutoClickerLoop();
  if (typeof renderAvatarScreen === "function") renderAvatarScreen();
  if (typeof renderAutoClickerPanel === "function") {
    renderAutoClickerPanel({ status: "Автоудар: +" + pack.label, statusKind: "ok" });
  }
  return true;
}

function toggleAutoClickerEnabled() {
  ensureAutoClickerState();
  ProgressStore.update("autoClicker", (a) => ({
    ...(a || defaultAutoClickerState()),
    enabled: !(a?.enabled !== false),
  }));
  if (typeof save === "function") save();
  if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  if (typeof renderAutoClickerPanel === "function") renderAutoClickerPanel();
  return state.autoClicker.enabled !== false;
}

function autoClickerPickTarget() {
  if (typeof mineGnomes === "undefined" || !mineGnomes) return null;
  for (const g of mineGnomes) {
    if (!g || !g._type) continue;
    if (g._type === "banan") return g;
    if (g._type === "boss" || g._type === "golden" || g._type === "normal") return g;
  }
  return null;
}

function autoClickerPerformHit() {
  if (typeof mineActive === "undefined" || !mineActive) return false;
  if (typeof isGamePaused === "function" && isGamePaused()) return false;
  if (typeof mineOverlayPaused !== "undefined" && mineOverlayPaused) return false;
  if (!autoClickerIsActive()) return false;
  const g = autoClickerPickTarget();
  if (!g) return false;
  if (g._type === "banan") {
    if (typeof tapBanan === "function") {
      tapBanan(g, null, { autoClicker: true });
      return true;
    }
    return false;
  }
  if (typeof catchGnome === "function") {
    catchGnome(g, null, { autoClicker: true });
    return true;
  }
  return false;
}

function autoClickerTick() {
  if (!autoClickerIsActive()) return;
  const now = Date.now();
  const interval = typeof tuneInt === "function"
    ? tuneInt("autoClicker.intervalMs", AUTO_CLICKER.intervalMs)
    : AUTO_CLICKER.intervalMs;
  if (now - _autoClickerLastHitAt < interval) return;
  if (autoClickerPerformHit()) _autoClickerLastHitAt = now;
}

function startAutoClickerLoop() {
  if (_autoClickerTimer) return;
  _autoClickerTimer = setInterval(() => {
    try {
      autoClickerTick();
      if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
    } catch (e) {
      console.error("autoClickerTick failed:", e);
    }
  }, 50);
}

function stopAutoClickerLoop() {
  if (!_autoClickerTimer) return;
  clearInterval(_autoClickerTimer);
  _autoClickerTimer = null;
}
