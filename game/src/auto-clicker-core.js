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
  if (ac.enabled === false && ac.frozenRemainingMs == null) {
    ProgressStore.update("autoClicker", (a) => ({
      ...(a || defaultAutoClickerState()),
      frozenRemainingMs: 0,
    }));
  }
  // Выключенный автоудар раньше тикал until — переносим остаток в frozenRemainingMs.
  if (ac.enabled === false && ((ac.until || 0) > 0 || ac.pauseStartedAt)) {
    const now = Date.now();
    let until = ac.until || 0;
    if (ac.pauseStartedAt && until > ac.pauseStartedAt) {
      until += Math.max(0, now - ac.pauseStartedAt);
    }
    const rem = Math.max(
      0,
      Math.floor(Number(ac.frozenRemainingMs) || 0),
      until - now
    );
    ProgressStore.update("autoClicker", (a) => ({
      ...(a || defaultAutoClickerState()),
      enabled: false,
      frozenRemainingMs: rem,
      until: 0,
      pauseStartedAt: 0,
    }));
  }
}

function autoClickerMaxStackMs() {
  const fallback = (typeof AUTO_CLICKER !== "undefined" && AUTO_CLICKER.maxStackMs) || (3 * 60 * 60 * 1000);
  return typeof tuneInt === "function"
    ? tuneInt("autoClicker.maxStackMs", fallback)
    : fallback;
}

/** Обрезать уже накопленный таймер до потолка (сейвы без капа). */
function clampAutoClickerToMax(now) {
  if (!state.autoClicker || typeof state.autoClicker !== "object") return false;
  now = now || Date.now();
  const maxMs = autoClickerMaxStackMs();
  const rem = autoClickerRemainingMs(now);
  if (rem <= maxMs) return false;
  const pauseOffset = state.autoClicker.pauseStartedAt
    ? Math.max(0, now - state.autoClicker.pauseStartedAt)
    : 0;
  ProgressStore.update("autoClicker", (a) => ({
    ...(a || defaultAutoClickerState()),
    until: now + maxMs - pauseOffset,
  }));
  return true;
}

function autoClickerPackById(id) {
  return (AUTO_CLICKER.packs || []).find((p) => p.id === id) || null;
}

function autoClickerCanBuyPack(pack, now) {
  if (!pack) return { ok: false, reason: "unknown" };
  now = now || Date.now();
  const maxMs = autoClickerMaxStackMs();
  const rem = autoClickerRemainingMs(now);
  if (rem >= maxMs) return { ok: false, reason: "at_cap", rem, maxMs, room: 0 };
  const room = maxMs - rem;
  if (pack.durationMs > room) return { ok: false, reason: "no_room", rem, maxMs, room };
  return { ok: true, rem, maxMs, room };
}

/** Единый множитель цены пакета — без привязки к зоне (анти-эксплойт cheap→farm hard). */
function autoClickerPriceMult() {
  const flat =
    typeof AUTO_CLICKER !== "undefined" && AUTO_CLICKER.flatPriceScale != null
      ? Number(AUTO_CLICKER.flatPriceScale)
      : 4;
  return Number.isFinite(flat) && flat > 0 ? flat : 4;
}

/** @deprecated алиас — цена больше не от зоны */
function autoClickerZonePriceMult() {
  return autoClickerPriceMult();
}

/** @deprecated алиас */
function autoClickerChapterPriceMult() {
  return autoClickerPriceMult();
}

function autoClickerPackPrice(pack) {
  if (!pack) return 0;
  return Math.round(pack.price * autoClickerPriceMult());
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
  clampAutoClickerToMax();
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
  ensureAutoClickerState();
  const ac = state.autoClicker;
  if (ac.enabled === false) {
    return Math.max(0, Math.floor(Number(ac.frozenRemainingMs) || 0));
  }
  return Math.max(0, autoClickerEffectiveUntil(now) - now);
}

function autoClickerIsActive(now) {
  ensureAutoClickerState();
  if (state.autoClicker.enabled === false) return false;
  return autoClickerRemainingMs(now) > 0;
}

function notifyAutoClickerUi(msg, statusKind) {
  if (typeof toast === "function" && msg) toast(msg, statusKind === "ok" ? "ok" : "warn");
  if (typeof renderAutoClickerPanel === "function") {
    renderAutoClickerPanel(msg ? { status: msg, statusKind: statusKind || "ok" } : undefined);
  }
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
}

function buyAutoClickerPack(packId) {
  ensureAutoClickerState();
  clampAutoClickerToMax();
  const pack = autoClickerPackById(packId);
  if (!pack) {
    notifyAutoClickerUi("Неизвестный пакет автоудара", "warn");
    return false;
  }
  const now = Date.now();
  const can = autoClickerCanBuyPack(pack, now);
  if (!can.ok) {
    const maxH = Math.round(can.maxMs / 3600000);
    let msg = "Потолок автоудара: " + maxH + " ч";
    if (can.reason === "at_cap") {
      msg = "Уже максимум (" + maxH + " ч) — дождись таймера";
    } else if (can.reason === "no_room") {
      const roomMin = Math.max(1, Math.floor(can.room / 60000));
      msg = "Свободно только ~" + roomMin + " мин (макс. " + maxH + " ч)";
    }
    notifyAutoClickerUi(msg, "warn");
    return false;
  }
  const price = autoClickerPackPrice(pack);
  if ((state.adena || 0) < price) {
    const need = typeof fmtAdena === "function" ? fmtAdena(price) : price;
    notifyAutoClickerUi("Не хватает adena (нужно " + need + ")", "warn");
    return false;
  }
  ProgressStore.update("adena", (a) => (a || 0) - price);
  const curUntil = autoClickerEffectiveUntil(now);
  const base = Math.max(now, curUntil);
  const maxUntil = now + autoClickerMaxStackMs();
  ProgressStore.update("autoClicker", (a) => ({
    ...(a || defaultAutoClickerState()),
    until: Math.min(base + pack.durationMs, maxUntil),
    enabled: true,
    pauseStartedAt: 0,
    frozenRemainingMs: 0,
  }));
  if (typeof save === "function") save();
  if ($("#adena")) $("#adena").textContent = typeof fmt === "function" ? fmt(state.adena) : String(state.adena);
  if (typeof Audio2 !== "undefined" && Audio2.success) Audio2.success();
  startAutoClickerLoop();
  if (typeof renderAvatarScreen === "function") renderAvatarScreen();
  notifyAutoClickerUi("Автоудар: +" + pack.label, "ok");
  return true;
}

function toggleAutoClickerEnabled() {
  ensureAutoClickerState();
  const now = Date.now();
  const currentlyEnabled = state.autoClicker.enabled !== false;
  if (currentlyEnabled) {
    const rem = autoClickerRemainingMs(now);
    ProgressStore.update("autoClicker", (a) => ({
      ...(a || defaultAutoClickerState()),
      enabled: false,
      frozenRemainingMs: rem,
      until: 0,
      pauseStartedAt: 0,
    }));
  } else {
    const rem = Math.max(0, Math.floor(Number(state.autoClicker.frozenRemainingMs) || 0));
    const gamePaused = typeof isGamePaused === "function" && isGamePaused();
    ProgressStore.update("autoClicker", (a) => ({
      ...(a || defaultAutoClickerState()),
      enabled: true,
      frozenRemainingMs: 0,
      until: rem > 0 ? now + rem : 0,
      pauseStartedAt: rem > 0 && gamePaused ? now : 0,
    }));
    clampAutoClickerToMax();
  }
  if (typeof save === "function") save();
  if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  if (typeof renderAutoClickerPanel === "function") renderAutoClickerPanel();
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
  return state.autoClicker.enabled !== false;
}

function autoClickerBlockedInCurrentMine() {
  // Инстансы, мировой босс и клан-рейд — без автоудара (скиллы/соски в рейде ок).
  if (typeof mineSession !== "undefined" && mineSession && mineSession.instance) return true;
  if (typeof mineSession !== "undefined" && mineSession && mineSession.worldBoss) return true;
  if (typeof mineSession !== "undefined" && mineSession && mineSession.clanBoss) return true;
  if (typeof isInstanceSessionActive === "function" && isInstanceSessionActive()) return true;
  if (typeof isPartyFarmSessionActive === "function" && isPartyFarmSessionActive()) return true;
  if (typeof isWorldBossSessionActive === "function" && isWorldBossSessionActive()) return true;
  if (typeof isClanBossSessionActive === "function" && isClanBossSessionActive()) return true;
  return false;
}

function autoClickerPickTarget() {
  if (typeof mineGnomes === "undefined" || !mineGnomes) return null;
  let openMine = null;
  let openAny = null;
  let anyAnvil = null;
  let stone = null;
  let fallback = null;
  const youId =
    (typeof instanceRunState !== "undefined" && instanceRunState && instanceRunState.youUserId) ||
    null;
  for (const g of mineGnomes) {
    if (!g || !g._type) continue;
    if (g._type === "banan") return g;
    if (g._instanceAnvil) {
      const open = g.classList && g.classList.contains("is-open");
      const mine =
        youId != null && g._anvilOwnerId != null && String(g._anvilOwnerId) === String(youId);
      if (open && mine && !openMine) openMine = g;
      else if (open && !openAny) openAny = g;
      else if (!anyAnvil) anyAnvil = g;
      continue;
    }
    if (g._instanceStone) {
      if (!stone) stone = g;
      continue;
    }
    if (g._type === "boss" || g._type === "golden" || g._type === "normal" || g._type === "elite") {
      if (!fallback) fallback = g;
    }
  }
  // Только СВОЙ открытый цвет — чужой клик вайпит группу
  if (openMine) return openMine;
  if (openAny || anyAnvil) return null;
  return stone || fallback;
}

function autoClickerPerformHit() {
  if (typeof mineActive === "undefined" || !mineActive) return false;
  if (autoClickerBlockedInCurrentMine()) return false;
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
  if (typeof mineActive === "undefined" || !mineActive) return;
  if (autoClickerBlockedInCurrentMine()) return;
  const now = Date.now();
  const interval = typeof tuneInt === "function"
    ? tuneInt("autoClicker.intervalMs", AUTO_CLICKER.intervalMs)
    : AUTO_CLICKER.intervalMs;
  if (now - _autoClickerLastHitAt < interval) return;
  if (autoClickerPerformHit()) {
    _autoClickerLastHitAt = now;
  } else if (typeof ensureMineSpawning === "function") {
    ensureMineSpawning();
  }
}

function startAutoClickerLoop() {
  if (_autoClickerTimer) return;
  let _hudTick = 0;
  _autoClickerTimer = setInterval(() => {
    try {
      autoClickerTick();
      // HUD раз в ~200мс: только таймер/классы; кнопки пакетов не пересоздаём зря
      _hudTick += 1;
      if (_hudTick % 4 === 0 && typeof renderAutoClickerHud === "function") {
        renderAutoClickerHud();
      }
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
