// ===== Казино Банана: core (жетоны, крутки, pity, grant) =====

function ensureBananaCasinoState() {
  if (!state.bananaCasino || typeof state.bananaCasino !== "object") {
    ProgressStore.set("bananaCasino", defaultBananaCasinoState());
    return;
  }
  const bc = state.bananaCasino;
  const patch = {};
  if (bc.tokens == null) patch.tokens = 0;
  if (bc.pity == null) patch.pity = 0;
  if (bc.pityJackpot == null) patch.pityJackpot = 0;
  if (bc.pulls == null) patch.pulls = 0;
  if (bc.jackpots == null) patch.jackpots = 0;
  if (!Array.isArray(bc.history)) patch.history = [];
  if (Object.keys(patch).length) {
    ProgressStore.update("bananaCasino", (c) => ({
      ...(c || defaultBananaCasinoState()),
      ...patch,
    }));
  }
}

function bananaCasinoTokens() {
  ensureBananaCasinoState();
  return Math.max(0, Math.floor(Number(state.bananaCasino.tokens) || 0));
}

function bananaCasinoTokenPackById(id) {
  return (BANANA_CASINO.tokenPacks || []).find((p) => p.id === id) || null;
}

function bananaCasinoPackPrice(pack) {
  if (!pack) return 0;
  // Статика: без скейла зоны/уровня — одинаково для всех.
  return Math.max(0, Math.round(Number(pack.price) || 0));
}

/** +N жетонов (поимка Банана / dev). */
function grantBananaCasinoTokens(n, opts) {
  opts = opts || {};
  n = Math.max(0, Math.floor(Number(n) || 0));
  if (n < 1) return 0;
  ensureBananaCasinoState();
  ProgressStore.update("bananaCasino", (c) => ({
    ...(c || defaultBananaCasinoState()),
    tokens: Math.max(0, Math.floor(Number(c?.tokens) || 0)) + n,
  }));
  if (opts.toast !== false && typeof toast === "function") {
    toast(n === 1 ? "Жетон Казино Банана" : ("Жетоны Казино Банана ×" + n), "loot");
  }
  if (typeof renderBananaCasinoTileMeta === "function") renderBananaCasinoTileMeta();
  return n;
}

function buyBananaCasinoTokenPack(packId) {
  ensureBananaCasinoState();
  const pack = bananaCasinoTokenPackById(packId);
  if (!pack) {
    if (typeof toast === "function") toast("Неизвестный пакет жетонов", "warn");
    return { ok: false, reason: "unknown" };
  }
  const price = bananaCasinoPackPrice(pack);
  if ((state.adena || 0) < price) {
    const need = typeof fmtAdena === "function" ? fmtAdena(price) : price;
    if (typeof toast === "function") toast("Не хватает adena (нужно " + need + ")", "warn");
    return { ok: false, reason: "no_adena", price };
  }
  ProgressStore.update("adena", (a) => (a || 0) - price);
  ProgressStore.update("bananaCasino", (c) => ({
    ...(c || defaultBananaCasinoState()),
    tokens: Math.max(0, Math.floor(Number(c?.tokens) || 0)) + pack.tokens,
  }));
  if (typeof save === "function") save();
  if ($("#adena")) $("#adena").textContent = typeof fmt === "function" ? fmt(state.adena) : String(state.adena);
  if (typeof Audio2 !== "undefined" && Audio2.success) Audio2.success();
  if (typeof toast === "function") toast("Куплено: " + pack.label, "ok");
  if (typeof renderBananaCasinoScreen === "function") renderBananaCasinoScreen();
  if (typeof renderBananaCasinoTileMeta === "function") renderBananaCasinoTileMeta();
  return { ok: true, pack, price };
}

function _bananaCasinoTierWeightTotal() {
  const w = BANANA_CASINO.tierWeights || {};
  return (w.common || 0) + (w.uncommon || 0) + (w.rare || 0) + (w.epic || 0) + (w.jackpot || 0);
}

function _bananaCasinoPickTierWeighted(rng) {
  rng = typeof rng === "function" ? rng : Math.random;
  const w = BANANA_CASINO.tierWeights || {};
  const total = _bananaCasinoTierWeightTotal() || 1000;
  let r = rng() * total;
  const order = ["common", "uncommon", "rare", "epic", "jackpot"];
  for (const tier of order) {
    r -= w[tier] || 0;
    if (r < 0) return tier;
  }
  return "common";
}

function _bananaCasinoRandInt(lo, hi, rng) {
  rng = typeof rng === "function" ? rng : Math.random;
  return lo + Math.floor(rng() * Math.max(1, hi - lo + 1));
}

function _bananaCasinoOreQty(range, rng) {
  const lo = Math.max(1, range?.min || 1);
  const hi = Math.max(lo, range?.max || lo);
  return _bananaCasinoRandInt(lo, hi, rng);
}

function _bananaCasinoCrystalIcon(target, grade) {
  if (typeof scrollTierIcon === "function") {
    return scrollTierIcon("crystal", grade, target);
  }
  return (BANANA_CASINO.reelIcons && BANANA_CASINO.reelIcons.crystal) || "icons/etc_scroll_of_enchant_weapon_i05.png";
}

/**
 * Собрать описание лута по тиру (без grant).
 * Пул: Soul/Spirit Ore · кристалл D · кристаллы зоны · Талисман Банана.
 */
function buildCasinoLoot(tier, rng) {
  rng = typeof rng === "function" ? rng : Math.random;
  const icons = BANANA_CASINO.reelIcons || {};
  const charmId = BANANA_CASINO.charmId || "banana_lucky_charm";

  if (tier === "common") {
    const pool =
      BANANA_CASINO.commonOres ||
      [BANANA_CASINO.commonOre || { id: "soul", min: 6, max: 14 }].filter(Boolean);
    const cfg = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] || {
      id: "soul",
      min: 6,
      max: 14,
    };
    const qty = _bananaCasinoOreQty(cfg, rng);
    const oreId = cfg.id || "soul";
    const name = oreId === "spirit" ? "Spirit Ore" : "Soul Ore";
    return {
      tier: "common",
      kind: "ore",
      oreId,
      qty,
      label: name + " ×" + qty,
      icon:
        oreId === "spirit"
          ? icons.spirit || "icons/etc_stone_gray_i00.png"
          : icons.soul || "icons/etc_crystal_white_i00.png",
    };
  }

  if (tier === "uncommon") {
    const cfg = BANANA_CASINO.uncommonCrystal || {
      grade: "D",
      targets: ["armor", "weapon"],
      qty: 1,
    };
    const targets = cfg.targets && cfg.targets.length ? cfg.targets : ["armor", "weapon"];
    const target = targets[Math.min(targets.length - 1, Math.floor(rng() * targets.length))] || "armor";
    const scrollGrade = cfg.grade || "D";
    const qty = cfg.qty || 1;
    const targetRu = target === "weapon" ? "оружия" : "брони";
    return {
      tier: "uncommon",
      kind: "scroll",
      target,
      typeId: "crystal",
      grade: scrollGrade,
      qty,
      label: "Кристальный свиток " + targetRu + " " + scrollGrade + (qty > 1 ? " ×" + qty : ""),
      icon: _bananaCasinoCrystalIcon(target, scrollGrade),
    };
  }

  if (tier === "rare") {
    const cfg = BANANA_CASINO.rareCrystal || { grade: "C", target: "armor", qty: 1 };
    const target = cfg.target || "armor";
    const scrollGrade = cfg.grade || "C";
    const qty = cfg.qty || 1;
    return {
      tier: "rare",
      kind: "scroll",
      target,
      typeId: "crystal",
      grade: scrollGrade,
      qty,
      label: "Кристальный свиток брони " + scrollGrade + (qty > 1 ? " ×" + qty : ""),
      icon: _bananaCasinoCrystalIcon(target, scrollGrade),
    };
  }

  if (tier === "epic") {
    const cfg = BANANA_CASINO.epicCrystal || { grade: "C", target: "weapon", qty: 1 };
    const target = cfg.target || "weapon";
    const scrollGrade = cfg.grade || "C";
    const qty = cfg.qty || 1;
    return {
      tier: "epic",
      kind: "scroll",
      target,
      typeId: "crystal",
      grade: scrollGrade,
      qty,
      label: "Кристальный свиток оружия " + scrollGrade + (qty > 1 ? " ×" + qty : ""),
      icon: _bananaCasinoCrystalIcon(target, scrollGrade),
    };
  }

  // jackpot — только талисман
  const def = typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[charmId] : null;
  return {
    tier: "jackpot",
    kind: "charm",
    collectibleId: charmId,
    label: def?.name || "Талисман Банана",
    icon: def?.icon || icons.charm || "icons/banana_lucky_charm.png?v=1",
    epic: true,
  };
}

function rollCasinoLoot(bc, rng) {
  bc = bc || state.bananaCasino || defaultBananaCasinoState();
  rng = typeof rng === "function" ? rng : Math.random;
  const pityRare = BANANA_CASINO.pityRare || 40;
  const pityJp = BANANA_CASINO.pityJackpot || 200;
  let tier;
  if ((bc.pityJackpot || 0) >= pityJp) tier = "jackpot";
  else if ((bc.pity || 0) >= pityRare) tier = "rare";
  else tier = _bananaCasinoPickTierWeighted(rng);
  return buildCasinoLoot(tier, rng);
}

function grantCasinoLoot(loot) {
  if (!loot) return { ok: false, text: "—" };
  if (typeof ensureWorkshopState === "function") ensureWorkshopState();

  if (loot.kind === "scroll") {
    if (typeof addScroll !== "function") return { ok: false, text: "свитки недоступны" };
    if (!addScroll(loot.target || "weapon", loot.typeId || "crystal", loot.grade || "D", loot.qty || 1)) {
      return { ok: false, text: "не удалось выдать свитки" };
    }
    return { ok: true, text: loot.label };
  }

  if (loot.kind === "ore") {
    const oreId = loot.oreId || "soul";
    const qty = loot.qty || 1;
    ProgressStore.update("materials", (m) => {
      const next = { ...(m || {}) };
      next[oreId] = (next[oreId] || 0) + qty;
      return next;
    });
    return { ok: true, text: loot.label };
  }

  if (loot.kind === "charm") {
    const id = loot.collectibleId || BANANA_CASINO.charmId;
    const def = typeof grantCollectible === "function" ? grantCollectible(id) : null;
    if (!def) return { ok: false, text: "инвентарь полон", invFull: true };
    return { ok: true, text: def.name, epic: true, charm: true };
  }

  return { ok: false, text: "—" };
}

function _bananaCasinoPushHistory(entry) {
  const max = BANANA_CASINO.historyMax || 20;
  ProgressStore.update("bananaCasino", (c) => {
    const hist = Array.isArray(c?.history) ? c.history.slice() : [];
    hist.unshift(entry);
    while (hist.length > max) hist.pop();
    return { ...(c || defaultBananaCasinoState()), history: hist };
  });
}

/**
 * Одна крутка: roll → grant → pity/history.
 * Токены должны быть уже списаны вызывающим (spinCasino).
 */
function resolveCasinoPull(rng) {
  ensureBananaCasinoState();
  const bc = state.bananaCasino;
  const loot = rollCasinoLoot(bc, rng);
  const res = grantCasinoLoot(loot);
  const tier = loot.tier;
  const isRarePlus = tier === "rare" || tier === "epic" || tier === "jackpot";
  const isJackpot = tier === "jackpot";

  ProgressStore.update("bananaCasino", (c) => {
    const next = { ...(c || defaultBananaCasinoState()) };
    next.pulls = (next.pulls || 0) + 1;
    if (isJackpot) {
      // Джекпот сбрасывает обе полоски (Rare и Jackpot).
      next.pity = 0;
      next.pityJackpot = 0;
      next.jackpots = (next.jackpots || 0) + 1;
    } else {
      next.pity = isRarePlus ? 0 : (next.pity || 0) + 1;
      next.pityJackpot = (next.pityJackpot || 0) + 1;
    }
    const max = BANANA_CASINO.historyMax || 20;
    const hist = Array.isArray(next.history) ? next.history.slice() : [];
    hist.unshift({
      tier,
      kind: loot.kind,
      label: res.ok ? res.text : loot.label + " (" + (res.text || "fail") + ")",
      at: Date.now(),
      ok: !!res.ok,
    });
    while (hist.length > max) hist.pop();
    next.history = hist;
    return next;
  });

  const label = res.ok ? res.text : loot.label + " (" + (res.text || "fail") + ")";

  return { loot, res, tier, label };
}

function canSpinBananaCasino(count) {
  count = Math.max(1, Math.floor(Number(count) || 1));
  ensureBananaCasinoState();
  const need = count * (BANANA_CASINO.tokenPerPull || 1);
  const have = bananaCasinoTokens();
  if (have < need) return { ok: false, reason: "no_tokens", need, have };
  return { ok: true, need, have };
}

/**
 * Списать жетоны и выполнить count круток.
 * @returns {{ ok, results?, reason? }}
 */
function spinBananaCasino(count, rng) {
  count = Math.max(1, Math.floor(Number(count) || 1));
  const can = canSpinBananaCasino(count);
  if (!can.ok) {
    if (typeof toast === "function") {
      toast(
        can.reason === "no_tokens"
          ? "Нужно жетонов: " + can.need + " (есть " + can.have + ")"
          : "Нельзя крутить",
        "warn"
      );
    }
    return { ok: false, reason: can.reason };
  }

  ProgressStore.update("bananaCasino", (c) => ({
    ...(c || defaultBananaCasinoState()),
    tokens: Math.max(0, Math.floor(Number(c?.tokens) || 0) - can.need),
  }));

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(resolveCasinoPull(rng));
  }

  if (typeof save === "function") save();
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof renderBananaCasinoTileMeta === "function") renderBananaCasinoTileMeta();

  return { ok: true, results, spent: can.need };
}
