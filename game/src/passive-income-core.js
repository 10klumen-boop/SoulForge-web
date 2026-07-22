// ===== Пассивный доход: core (rate, cap C+D, collect offline) =====

/** Оффлайн-награда, показанная один раз при входе «Играть» из главного меню. */
let _passiveIncomeNotice = null;

function queuePassiveIncomeNotice(amount, sec) {
  if (!(amount > 0)) return;
  const prev = _passiveIncomeNotice;
  _passiveIncomeNotice = {
    amount: (prev?.amount || 0) + amount,
    sec: (prev?.sec || 0) + sec,
  };
}

function peekPassiveIncomeNotice() {
  return _passiveIncomeNotice;
}

function takePassiveIncomeNotice() {
  const n = _passiveIncomeNotice;
  _passiveIncomeNotice = null;
  return n;
}

function ensurePassiveIncomeState() {
  if (!state.passiveIncome || typeof state.passiveIncome !== "object") {
    ProgressStore.set("passiveIncome", defaultPassiveIncomeState());
  }
  const pi = state.passiveIncome;
  if (pi.warehouseLv == null || pi.warehouseLv < 0) {
    ProgressStore.update("passiveIncome", (p) => ({
      ...(p || defaultPassiveIncomeState()),
      warehouseLv: 0,
      lastCollectAt: p?.lastCollectAt || 0,
    }));
  }
  if (pi.warehouseLv > PASSIVE_INCOME.warehouseMaxLv) {
    ProgressStore.update("passiveIncome", (p) => ({
      ...(p || defaultPassiveIncomeState()),
      warehouseLv: PASSIVE_INCOME.warehouseMaxLv,
    }));
  }
}

function passiveCompletedChaptersCount() {
  if (typeof FARM_ZONES === "undefined" || !Array.isArray(FARM_ZONES)) return 0;
  if (typeof isZoneChapterComplete !== "function") return 0;
  return FARM_ZONES.filter((z) => z.active && isZoneChapterComplete(z.id)).length;
}

function passiveCapSec() {
  ensurePassiveIncomeState();
  const base = typeof tuneInt === "function"
    ? tuneInt("passive.baseCapSec", PASSIVE_INCOME.baseCapSec)
    : PASSIVE_INCOME.baseCapSec;
  const chBonus = typeof tuneInt === "function"
    ? tuneInt("passive.chapterCapBonusSec", PASSIVE_INCOME.chapterCapBonusSec)
    : PASSIVE_INCOME.chapterCapBonusSec;
  const whBonus = typeof tuneInt === "function"
    ? tuneInt("passive.warehouseCapBonusSec", PASSIVE_INCOME.warehouseCapBonusSec)
    : PASSIVE_INCOME.warehouseCapBonusSec;
  const chapters = passiveCompletedChaptersCount();
  const wh = state.passiveIncome.warehouseLv || 0;
  return Math.max(0, base + chapters * chBonus + wh * whBonus);
}

function passiveRatePerSec() {
  ensurePassiveIncomeState();
  const zone = typeof farmZoneById === "function"
    ? farmZoneById(state.farmZone || "banana_mine")
    : { chapter: 1 };
  const chapter = Math.max(1, Math.min(5, zone.chapter || 1));
  const baseFallback = PASSIVE_INCOME.baseAdenaPerSec;
  const baseFromEconomy =
    typeof economyPassiveAdenaPerSec === "function" ? economyPassiveAdenaPerSec(1) : baseFallback;
  const base = typeof tune === "function"
    ? tune("passive.baseAdenaPerSec", baseFromEconomy)
    : baseFromEconomy;
  const powerDiv = typeof tune === "function"
    ? tune("passive.powerDiv", PASSIVE_INCOME.powerDiv)
    : PASSIVE_INCOME.powerDiv;
  const power = typeof avatarFarmPower === "function" ? avatarFarmPower() : 0;
  const mults = PASSIVE_INCOME.chapterMult || [1];
  const chMult =
    typeof economyChapterFarmMult === "function"
      ? economyChapterFarmMult(chapter)
      : (mults[chapter - 1] || mults[mults.length - 1] || 1);
  return Math.max(0, base * (1 + power / Math.max(1, powerDiv)) * chMult);
}

function passivePendingSec(now) {
  ensurePassiveIncomeState();
  now = now || Date.now();
  const last = state.passiveIncome.lastCollectAt || 0;
  if (!last || last <= 0) return 0;
  const elapsed = Math.max(0, Math.floor((now - last) / 1000));
  return Math.min(elapsed, passiveCapSec());
}

function passivePendingAdena(now) {
  const sec = passivePendingSec(now);
  if (sec <= 0) return 0;
  return Math.floor(passiveRatePerSec() * sec);
}

function touchPassiveCollectAt(ts) {
  ensurePassiveIncomeState();
  const t = ts || Date.now();
  ProgressStore.update("passiveIncome", (p) => ({
    ...(p || defaultPassiveIncomeState()),
    lastCollectAt: t,
  }));
}

/** Heartbeat: не даём lastCollectAt отставать бесконечно при активной сессии без collect. */
function touchPassiveHeartbeat() {
  ensurePassiveIncomeState();
  const now = Date.now();
  const last = state.passiveIncome.lastCollectAt || 0;
  if (!last) {
    touchPassiveCollectAt(now);
    return;
  }
  // Сдвигаем якорь вперёд, сохраняя накопленный pending (не больше капа).
  const pending = passivePendingSec(now);
  touchPassiveCollectAt(now - pending * 1000);
}

function collectPassiveIncome(opts) {
  opts = opts || {};
  ensurePassiveIncomeState();
  const now = Date.now();
  if (!state.passiveIncome.lastCollectAt) {
    touchPassiveCollectAt(now);
    return { ok: true, amount: 0, sec: 0 };
  }
  const sec = passivePendingSec(now);
  const amount = Math.floor(passiveRatePerSec() * sec);
  touchPassiveCollectAt(now);
  if (amount <= 0) return { ok: true, amount: 0, sec };
  const gain = typeof playtestIncome === "function" ? playtestIncome(amount) : amount;
  ProgressStore.update("adena", (a) => (a || 0) + gain);
  ProgressStore.update("totals", (t) => ({
    ...(t || { tries: 0, fails: 0, earned: 0 }),
    earned: (t?.earned || 0) + gain,
  }));
  if (typeof save === "function") save();
  if ($("#adena")) $("#adena").textContent = typeof fmt === "function" ? fmt(state.adena) : String(state.adena);
  // Тосты не используем: оффлайн-награда — модалка при «Играть», ручной сбор — панель.
  if (opts.queueNotice && gain > 0) queuePassiveIncomeNotice(gain, sec);
  if (opts.log && typeof gameLog === "function" && gain > 0) {
    gameLog("Пассивный доход: +" + (typeof fmtAdena === "function" ? fmtAdena(gain) : gain) + " adena", "gold");
  }
  return { ok: true, amount: gain, sec };
}

function warehouseNextPrice() {
  ensurePassiveIncomeState();
  const lv = state.passiveIncome.warehouseLv || 0;
  if (lv >= PASSIVE_INCOME.warehouseMaxLv) return null;
  return PASSIVE_INCOME.warehousePrices[lv];
}

function buyPassiveWarehouse() {
  ensurePassiveIncomeState();
  const price = warehouseNextPrice();
  if (price == null) {
    if (typeof renderPassiveIncomePanel === "function") {
      renderPassiveIncomePanel({ status: "Склад уже максимального уровня", statusKind: "warn" });
    }
    return false;
  }
  if ((state.adena || 0) < price) {
    const need = typeof fmtAdena === "function" ? fmtAdena(price) : price;
    if (typeof renderPassiveIncomePanel === "function") {
      renderPassiveIncomePanel({ status: "Не хватает adena (нужно " + need + ")", statusKind: "warn" });
    }
    return false;
  }
  ProgressStore.update("adena", (a) => (a || 0) - price);
  ProgressStore.update("passiveIncome", (p) => ({
    ...(p || defaultPassiveIncomeState()),
    warehouseLv: (p?.warehouseLv || 0) + 1,
  }));
  if (typeof save === "function") save();
  if ($("#adena")) $("#adena").textContent = typeof fmt === "function" ? fmt(state.adena) : String(state.adena);
  if (typeof Audio2 !== "undefined" && Audio2.success) Audio2.success();
  const bonusH = Math.round(PASSIVE_INCOME.warehouseCapBonusSec / 3600);
  if (typeof renderAvatarScreen === "function") renderAvatarScreen();
  if (typeof renderPassiveIncomePanel === "function") {
    renderPassiveIncomePanel({ status: "Склад расширен — кап +" + bonusH + " ч", statusKind: "ok" });
  }
  return true;
}
