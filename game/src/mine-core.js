// ===== Mine core: игровая логика задания-кликера (spawn, урон, дроп, награды) =====
// UI helpers (renderMineSessionLoot, attachMobTimer, floatText и т.д.) вынесены в mine-ui.js.

let mineTimer = null;
let mineSpawnDelayTimer = null;
const mineGnomes = new Set();
let mineActive = false;
let mineOverlayPaused = false;
// Баланс и визуальные константы шахты вынесены в data/farm-balance.js.
let mineWeaponsByGrade = null;
let mineSession = null;
let mineSessionLootOpen = false;

function mineSessionLootKey(entry) {
  if (entry.kind === "weapon") return "w:" + entry.id + ":" + (entry.plus || 0);
  if (entry.kind === "accessory") return "a:" + entry.id;
  if (entry.kind === "shots") return "ss:" + (entry.shotKind || "soulshots") + ":" + entry.grade;
  return "x:" + (entry.name || "?");
}

function trackMineSessionLoot(entry) {
  if (!mineSession || !entry) return;
  if (!mineSession.loot) mineSession.loot = {};
  const key = mineSessionLootKey(entry);
  const add = entry.qty || 1;
  const row = mineSession.loot[key];
  if (row) row.qty = (row.qty || 0) + add;
  else mineSession.loot[key] = Object.assign({}, entry, { qty: add });
  if (typeof renderMineSessionLoot === "function") renderMineSessionLoot();
}

function pickMineWeaponFromPool(pool) {
  if (!pool?.length) return null;
  const mystic = typeof avatarIsMystic === "function" && avatarIsMystic();
  let total = 0;
  const weights = pool.map((w) => {
    const wt = mystic
      ? Math.max(1, (w.matk || 0) * 2 + (w.ms || 0) * 8)
      : Math.max(1, (w.patk || 0) * 2 + (w.ps || 0) * 8);
    total += wt;
    return wt;
  });
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function rollMineWeaponDrop(zoneId) {
  zoneId = zoneId || (typeof currentMineZoneId === "function" ? currentMineZoneId() : (state.farmZone || "banana_mine"));
  if (!mineWeaponsByGrade) {
    mineWeaponsByGrade = { D: [], C: [], B: [], A: [] };
    WEAPONS.forEach((w) => { if (mineWeaponsByGrade[w.grade]) mineWeaponsByGrade[w.grade].push(w); });
  }
  let total = 0;
  for (const g of ["D", "C", "B", "A"]) total += mineDropWeight(g, zoneId);
  if (total <= 0) {
    const pool = mineWeaponsByGrade.D;
    return pickMineWeaponFromPool(pool);
  }
  let roll = Math.random() * total;
  let grade = "D";
  for (const g of ["D", "C", "B", "A"]) {
    roll -= mineDropWeight(g, zoneId);
    if (roll <= 0) { grade = g; break; }
  }
  const pool = mineWeaponsByGrade[grade];
  if (!pool || !pool.length) {
    for (const g of ["D", "C", "B", "A"]) {
      if (mineWeaponsByGrade[g]?.length) return pickMineWeaponFromPool(mineWeaponsByGrade[g]);
    }
    return null;
  }
  return pickMineWeaponFromPool(pool);
}

function grantBananLoot(loot) {
  ensureWorkshopState();
  if (loot.kind === "soulshots") {
    state.shots.soul[loot.grade] = (state.shots.soul[loot.grade] || 0) + loot.qty;
    return { ok: true, text: loot.label };
  }
  if (loot.kind === "spiritshots") {
    state.shots.spirit[loot.grade] = (state.shots.spirit[loot.grade] || 0) + loot.qty;
    return { ok: true, text: loot.label };
  }
  if (loot.kind === "adena") {
    const amount = playtestIncome(loot.amount);
    ProgressStore.update("adena", (a) => (a || 0) + amount);
    ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + amount }));
    $("#adena").textContent = fmt(state.adena);
    return { ok: true, text: fmtAdena(amount) + " adena" };
  }
  if (loot.kind === "weapon") {
    const w = rollMineWeaponDrop();
    if (!w) return { ok: false, text: "—" };
    const it = addToInventory(w.id, { source: "rare_loot", zoneId: state.farmZone || null, plus: loot.plus || 0 });
    if (!it) return { ok: false, text: "инвентарь полон", invFull: true };
    if (loot.plus) it.plus = loot.plus;
    bumpWeaponRecord(w.id, loot.plus);
    return { ok: true, text: w.name + " +" + loot.plus, weapon: w };
  }
  if (loot.kind === "earring") {
    const def = grantCollectible(ZAKEN_EARRING_ID);
    if (!def) return { ok: false, text: "инвентарь полон", invFull: true };
    return { ok: true, text: def.name, epic: true };
  }
  return { ok: false, text: "—" };
}

// MINE_BGS, DWARF_IMGS, DWARF_GOLDS вынесены в data/farm-balance.js.

function openMine() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
    toast("Сначала создай персонажа", "warn");
    if (typeof maybeShowAvatarSetup === "function") maybeShowAvatarSetup();
    return;
  }
  const zoneId = state.farmZone || "banana_mine";
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  if (zone && typeof canEnterFarmZone === "function" && !canEnterFarmZone(zone)) {
    toast("Недостаточно силы фарма для зоны", "warn");
    if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
    return;
  }
  if (typeof requestMineWithQuestBriefing === "function" && requestMineWithQuestBriefing(zoneId)) return;
  const cfg = typeof zoneMineConfig === "function" ? zoneMineConfig(zoneId) : { bgs: MINE_BGS, spawnMs: 920, hint: "Цели вот-вот мелькнут…", title: "Задание" };
  const panelTitle = document.getElementById("minePanelTitle");
  if (panelTitle) {
    const raw = cfg.title || "Задание";
    panelTitle.textContent = String(raw).replace(/^[^\p{L}\p{N}]+/u, "").trim() || raw;
  }
  const bgPool = cfg.bgs && cfg.bgs.length ? cfg.bgs : (typeof MINE_FALLBACK_BG !== "undefined" ? MINE_FALLBACK_BG : MINE_BGS.map((p) => (typeof mineAssetUrl === "function" ? mineAssetUrl(p) : p + "?v=6")));
  const bgRaw = bgPool[Math.floor(Math.random() * bgPool.length)];
  const img = $("#mineBgImg");
  if (img) {
    const url = typeof mineAssetUrl === "function" ? mineAssetUrl(bgRaw) : bgRaw;
    img.removeAttribute("src");
    img.src = url;
  }
  if (typeof applyMineStageVisual === "function") applyMineStageVisual(cfg, zoneId);
  else {
    const inner = document.getElementById("mineStageInner");
    if (inner) inner.className = "mine-stage-inner" + (cfg.overlay ? " " + cfg.overlay : "");
  }
  if (typeof resetMineSpritePick === "function") resetMineSpritePick(zoneId);
  if (typeof normalizeAvatarRace === "function") normalizeAvatarRace();
  if (typeof repairQuestProgressIntegrity === "function") repairQuestProgressIntegrity();
  const hintEl = document.getElementById("mineHint");
  if (hintEl) hintEl.textContent = cfg.hint || "Один враг на экране — уничтожь до конца таймера";
  mineActive = true;
  mineOverlayPaused = false;
  if (typeof startAutoClickerLoop === "function") startAutoClickerLoop();
  mineSession = {
    startedAt: Date.now(),
    adena0: Math.max(0, Math.floor(Number(state.adena) || 0)),
    kills: 0,
    weapons: 0,
    zoneId: state.farmZone || "banana_mine",
    loot: {},
  };
  mineSessionLootOpen = false;
  resetMineGuardSession();
  if (typeof resetMineSkillRuntime === "function") resetMineSkillRuntime();
  $("#mineEarned").textContent = "0";
  $("#mineCaught").textContent = "0";
  $("#mineMissed").textContent = "0";
  renderMineSessionLoot();
  if (hintEl) hintEl.style.display = "";
  if (typeof renderMineHudStats === "function") renderMineHudStats();
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  if (typeof renderMineSkillBar === "function") renderMineSkillBar();
  if (typeof renderMineStoryBar === "function") renderMineStoryBar(zoneId);
  show("mine");
  Audio2.open();
  clearInterval(mineTimer);
  mineTimer = null;
  cancelMineSpawnQueue();
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  if (typeof debugLog === "function") debugLog("info", "mine", "openMine", { zone: zoneId });
  if (typeof achStat === "function") achStat("mineVisits", 1);
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof isZoneBossPending === "function" && isZoneBossPending(zoneId)) {
    const boss = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : null;
    if (hintEl && boss) {
      const grind = typeof zoneBossGrindKills === "function" ? zoneBossGrindKills(zoneId) : 0;
      const need = typeof zoneBossGrindKillsNeeded === "function" ? zoneBossGrindKillsNeeded() : 12;
      if (typeof isZoneBossQueued === "function" && isZoneBossQueued(zoneId)) {
        hintEl.textContent = "☠ " + boss.name + " — скоро на поле. Не готов? Выйди и качай силу.";
      } else {
        hintEl.textContent = "☠ " + boss.name + " · зачистка " + grind + "/" + need + " — потом снова на поле";
      }
    }
    ensureMineSpawningSoon(600);
  } else {
    ensureMineSpawningSoon(450);
  }
}

function stopMine() {
  mineActive = false;
  mineOverlayPaused = false;
  if (typeof stopAutoClickerLoop === "function") stopAutoClickerLoop();
  if (typeof resetMineSkillRuntime === "function") resetMineSkillRuntime();
  clearInterval(mineTimer);
  mineTimer = null;
  cancelMineSpawnQueue();
  mineGnomes.forEach((g) => { clearMobTimer(g); g.remove(); });
  mineGnomes.clear();
  const lootLayer = document.getElementById("mineLootLayer");
  if (lootLayer) lootLayer.innerHTML = "";
  if (typeof Audio2.stopDwarfVoice === "function") Audio2.stopDwarfVoice();
  if (mineSession && typeof logCharacterEvent === "function") {
    const adenaNow = Math.max(0, Math.floor(Number(state.adena) || 0));
    logCharacterEvent("farm_session", {
      zoneId: mineSession.zoneId,
      kills: mineSession.kills || 0,
      weapons: mineSession.weapons || 0,
      adenaGain: Math.max(0, adenaNow - (mineSession.adena0 || 0)),
      durationMs: Date.now() - (mineSession.startedAt || Date.now()),
      loot: mineSession.loot ? Object.values(mineSession.loot).map((r) => ({
        kind: r.kind,
        id: r.id,
        name: r.name,
        grade: r.grade,
        plus: r.plus || 0,
        qty: r.qty || 1,
      })) : [],
    });
  }
  mineSession = null;
  // Immediate local + cloud flush — debounce must not leave combat loot on an old cloud seq.
  if (typeof save === "function") save();
  if (typeof flushCloudSave === "function") flushCloudSave({ force: true });
  else if (window.SoulforgeCloud?.flushSave) window.SoulforgeCloud.flushSave({ force: true });
  if (typeof noteLeaderboardEvent === "function") noteLeaderboardEvent("snapshot");
}

function hasBananOnField() {
  for (const g of mineGnomes) if (g._type === "banan") return true;
  return false;
}

function cancelMineSpawnQueue() {
  if (mineSpawnDelayTimer) {
    clearTimeout(mineSpawnDelayTimer);
    mineSpawnDelayTimer = null;
  }
}

function queueNextMob(delay) {
  if (!mineActive) return;
  if (mineOverlayPaused) {
    cancelMineSpawnQueue();
    mineSpawnDelayTimer = setTimeout(() => queueNextMob(delay), 280);
    return;
  }
  if (hasBananOnField()) return;
  cancelMineSpawnQueue();
  mineSpawnDelayTimer = setTimeout(() => {
    mineSpawnDelayTimer = null;
    spawnGnome();
  }, delay == null ? 550 : delay);
}

function ensureMineSpawning() {
  if (!mineActive || mineOverlayPaused) return;
  if (hasBananOnField() || hasCombatMobOnField()) return;
  if (mineSpawnDelayTimer) return;
  queueNextMob(500);
}

function ensureMineSpawningSoon(delay) {
  const kick = () => {
    if (!mineActive) return;
    if (typeof syncGamePauseState === "function") syncGamePauseState();
    ensureMineSpawning();
    if (!mineSpawnDelayTimer && !hasCombatMobOnField() && !hasBananOnField()) {
      queueNextMob(delay == null ? 450 : delay);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(kick));
}

function hasCombatMobOnField() {
  for (const g of mineGnomes) {
    if (g._type === "banan") continue;
    return true;
  }
  return false;
}

function pauseMineSpawns() {
  if (mineTimer) { clearInterval(mineTimer); mineTimer = null; }
  cancelMineSpawnQueue();
}

function hasBossOnField() {
  for (const g of mineGnomes) if (g._type === "boss") return true;
  return false;
}

function shouldSpawnZoneBoss(zoneId) {
  return typeof shouldOfferZoneBoss === "function" && shouldOfferZoneBoss(zoneId || currentMineZoneId());
}

function resumeMineSpawns() {
  if (!mineActive || hasBananOnField() || hasCombatMobOnField()) return;
  if (shouldSpawnZoneBoss(currentMineZoneId()) && !hasBossOnField()) {
    queueNextMob(500);
    return;
  }
  queueNextMob(500);
}

function clearRegularGnomes() {
  [...mineGnomes].forEach((g) => { if (g._type !== "banan" && g._type !== "boss") removeGnome(g); });
}

function pickGnomeType(forced) {
  if (forced) return forced;
  return rollMineType();
}

function mineDropWeight(grade, zoneId) {
  zoneId = zoneId || (typeof currentMineZoneId === "function" ? currentMineZoneId() : (state.farmZone || "banana_mine"));
  const dyn = typeof mineDropWeights === "function" ? mineDropWeights(zoneId) : null;
  const base = dyn ? (dyn[grade] ?? 0) : 0;
  if (base <= 0) return 0;
  return tune("mine.drop." + grade, base);
}

function currentMineZoneId() {
  return state.farmZone || "banana_mine";
}

function rollMineType() {
  const zoneId = currentMineZoneId();
  const cfg = typeof zoneMineConfig === "function" ? zoneMineConfig(zoneId) : {};
  const banan = tune("mine.bananChance", MINE_BANAN_CHANCE);
  const golden = tune("mine.goldenChance." + zoneId, cfg.goldenChance ?? tune("mine.goldenChance", MINE_GOLDEN_CHANCE));
  const r = Math.random();
  if (r < banan) return "banan";
  if (r < banan + golden) return "golden";
  return "normal";
}

function rollBananLootTuned() {
  const a = tune("banan.loot.adena", BANAN_LOOT_WEIGHTS.adena);
  const w = tune("banan.loot.weapon", BANAN_LOOT_WEIGHTS.weapon);
  const r = Math.random() * 100;
  if (r < a) {
    const amount = tuneInt("banan.adena", BANAN_ADENA_REWARD);
    return { kind: "adena", amount, label: fmtAdena(amount) + " adena" };
  }
  if (r < a + w) {
    const drop = rollMineWeaponDrop();
    const g = drop?.grade || "D";
    return { kind: "weapon", grade: g, plus: 6, label: g + "-оружие +6" };
  }
  return { kind: "earring", label: COLLECTIBLES.zaken_blessed_earring.name };
}

function mineAdenaBaseRange(kind) {
  const golden = kind === "golden";
  const lo = tuneInt(golden ? "mine.goldenMin" : "mine.rewardMin", golden ? MINE_ADENA_GOLDEN.min : MINE_ADENA_REWARD.min);
  const hi = tuneInt(golden ? "mine.goldenMax" : "mine.rewardMax", golden ? MINE_ADENA_GOLDEN.max : MINE_ADENA_REWARD.max);
  const scale = typeof mineProgressAdenaScale === "function" ? mineProgressAdenaScale() : 1;
  return {
    lo: Math.max(1, Math.round(lo * scale)),
    hi: Math.max(1, Math.round(hi * scale)),
  };
}

function mineNormalReward() {
  const { lo, hi } = mineAdenaBaseRange("normal");
  let amt = playtestIncome(lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1)));
  if (typeof avatarMineRewardMult === "function") amt = Math.round(amt * avatarMineRewardMult(state.farmZone || "banana_mine"));
  return amt;
}

function mineGoldenReward() {
  const { lo, hi } = mineAdenaBaseRange("golden");
  let amt = playtestIncome(lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1)));
  if (typeof avatarMineRewardMult === "function") amt = Math.round(amt * avatarMineRewardMult(state.farmZone || "banana_mine"));
  return amt;
}

function renderMineHudStats() {
  if (typeof syncMineShotHud === "function") syncMineShotHud();
}

function pauseMineForOverlay() {
  if (!mineActive || mineOverlayPaused) return;
  mineOverlayPaused = true;
  pauseMineSpawns();
  mineGnomes.forEach((g) => {
    if (g._type === "banan" && g._t) { clearTimeout(g._t); g._t = null; }
    if (g._type !== "banan" && g._timerEnd) {
      g._timerPausedLeft = Math.max(0, g._timerEnd - Date.now());
      if (g._timerRaf) { cancelAnimationFrame(g._timerRaf); g._timerRaf = null; }
    }
  });
}

function resumeMineFromOverlay() {
  if (!mineOverlayPaused) return;
  mineOverlayPaused = false;
  mineGnomes.forEach((g) => {
    if (!mineGnomes.has(g) || g._type === "banan") return;
    if (g._timerPausedLeft != null) {
      const left = g._timerPausedLeft;
      const onExpire = g._onExpire;
      const total = g._timerLife;
      delete g._timerPausedLeft;
      attachMobTimer(g, left, onExpire, total);
    }
  });
  if (mineActive && !hasCombatMobOnField() && !hasBananOnField()) resumeMineSpawns();
}

function spawnGnome(forcedType) {
  if (!mineActive) return;
  if (mineOverlayPaused) {
    queueNextMob(280);
    return;
  }
  const zoneId = currentMineZoneId();
  if (hasBananOnField() && forcedType !== "banan") return;
  if (hasCombatMobOnField() && forcedType !== "banan") return;

  if (!forcedType && shouldSpawnZoneBoss(zoneId) && !hasBossOnField()) {
    spawnZoneBoss();
    return;
  }

  const field = mineSpawnField();
  if (!field) {
    queueNextMob(800);
    return;
  }
  if (field.clientWidth < 48 || field.clientHeight < 48) {
    queueNextMob(300);
    return;
  }
  let type = pickGnomeType(forcedType);
  if (type === "banan") {
    if (hasBananOnField()) {
      if (forcedType === "banan") { toast("Редкий гном уже на экране", "warn"); return; }
      type = Math.random() < tune("mine.goldenChance", MINE_GOLDEN_CHANCE) ? "golden" : "normal";
    } else {
      spawnBanan(field);
      return;
    }
  }
  $("#mineHint").style.display = "none";
  spawnSoloMob(field, type);
}

function mineMobLifetime(maxHp, damage, type) {
  const timerMult = typeof tune === "function" ? tune("mine.timerMult", 0.85) : 0.85;
  const hits = Math.max(1, Math.ceil(maxHp / Math.max(1, damage)));
  const bossMult = type === "boss" ? 1.48 : type === "golden" ? 1.15 : 1;
  // Босс: больше окна под клики (раньше cap×0.85 ≈ 27 с — слишком туго без заточки)
  const floor = type === "boss" ? 18000 : type === "golden" ? 10000 : 8500;
  const cap = type === "boss" ? 48000 : 19000;
  return Math.round(Math.min(cap, Math.max(floor, Math.round(hits * 880 * bossMult + 2000))) * timerMult);
}

function spawnSoloMob(field, type, opts) {
  opts = opts || {};
  const zoneId = currentMineZoneId();
  const pos = mineSoloPosition(field, type);
  const g = document.createElement("div");
  g.className = "gnome mine-solo" + (type === "golden" ? " golden" : type === "boss" ? " boss" : "");
  g.style.left = pos.x + "px";
  g.style.top = pos.y + "px";
  g._type = type;
  g._x = pos.x;
  g._y = pos.y;
  let sprite;
  if (opts.sprite) {
    sprite = opts.sprite;
  } else if (typeof pickMineTargetSprite === "function") {
    sprite = pickMineTargetSprite(type === "boss" ? "boss" : type, zoneId);
  } else {
    const img = type === "golden"
      ? DWARF_GOLDS[Math.floor(Math.random() * DWARF_GOLDS.length)]
      : DWARF_IMGS[Math.floor(Math.random() * DWARF_IMGS.length)];
    sprite = { src: img, kind: "portrait", cls: "", label: "" };
  }
  if (!sprite || !sprite.src) {
    sprite = { src: DWARF_IMGS[0], kind: "portrait", cls: "", label: "" };
  }
  if (sprite.kind === "icon") g.classList.add("target-icon");
  if (sprite.kind === "sprite") g.classList.add("mob-sprite-kind");
  if (sprite.cls) sprite.cls.split(/\s+/).filter(Boolean).forEach((c) => g.classList.add(c));
  g._female = /\/w_/.test(sprite.src);
  const maxHp = typeof mineMobMaxHp === "function" ? mineMobMaxHp(type, zoneId) : 18;
  const dmg = typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 8;
  g._hp = maxHp;
  g._maxHp = maxHp;
  const zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : { chapter: 1 };
  if (typeof rollMobShield === "function" && rollMobShield(type, zone.chapter || 1)) {
    g._shielded = true;
    g.classList.add("mob-shielded");
  }
  const displayName = opts.name || sprite.label || "";
  const alt = String(displayName).replace(/"/g, "&quot;");
  const nameHtml = displayName ? '<div class="mob-solo-name">' + displayName + "</div>" : "";
  g.innerHTML = mobTargetShellHtml(sprite, alt, nameHtml, mobHpBarHtml(maxHp, maxHp));
  if (sprite.kind === "sprite") {
    const delay = (Math.random() * 1.6).toFixed(2) + "s";
    g.querySelectorAll(".mob-sprite-img, .mob-sprite-shadow").forEach((el) => {
      el.style.animationDelay = delay;
    });
  }
  const life = mineMobLifetime(maxHp, dmg, type);
  const onExpire = () => {
    if (!mineGnomes.has(g)) return;
    if (type === "boss") missBoss(g);
    else missGnome(g);
  };
  g._timerCap = Date.now() + life;
  try {
    attachMobTimer(g, life, onExpire, life);
    updateMobHpBar(g);
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) { e.preventDefault(); return; }
      e.preventDefault();
      catchGnome(g, e);
    });
    field.appendChild(g);
    mineGnomes.add(g);
    if (typeof debugLog === "function") debugLog("info", "mine", "spawn " + type, { zone: zoneId, hp: maxHp });
  } catch (err) {
    g.remove();
    if (typeof debugLog === "function") debugLog("error", "mine", "spawn failed: " + (err?.message || err), err?.stack);
    queueNextMob(600);
  }
}

function spawnBanan(field) {
  $("#mineHint").style.display = "none";
  const w = field.clientWidth, h = field.clientHeight;
  const x = w / 2;
  const y = h / 2;
  const g = document.createElement("div");
  g.className = "gnome banan";
  g.style.left = x + "px";
  g.style.top = y + "px";
  g._type = "banan";
  g._x = x;
  g._y = y;
  g._hits = 0;
  g.innerHTML =
    `<div class="banan-aura"></div>` +
    `<div class="banan-timer"></div>` +
    `<img src="${BANAN_IMG}" alt="">` +
    `<div class="banan-hits">0 / ${BANAN_HITS}</div>`;
  g._t = setTimeout(() => { if (mineGnomes.has(g)) missBanan(g); }, BANAN_TIME_MS);
  g.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) { e.preventDefault(); return; }
    e.preventDefault();
    tapBanan(g, e);
  });
  field.appendChild(g);
  mineGnomes.add(g);
  clearRegularGnomes();
  pauseMineSpawns();
  gameLog("Редкий гном! 10 кликов за 9 сек", "system");
}

function spawnZoneBoss() {
  if (!mineActive || mineOverlayPaused || hasBossOnField() || hasCombatMobOnField()) return;
  const zoneId = currentMineZoneId();
  if (!shouldSpawnZoneBoss(zoneId)) return;
  const field = mineSpawnField();
  if (!field || field.clientWidth < 48 || field.clientHeight < 48) {
    queueNextMob(400);
    return;
  }
  const bossDef = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : { name: "Босс", mob: "stone-giant", rewardMult: 3 };
  let sprite;
  if (typeof pickMineTargetSprite === "function") {
    sprite = pickMineTargetSprite("boss", zoneId);
  } else {
    const bossSrc = "assets/mobs/" + (bossDef.mob || "stone-giant") + ".png";
    sprite = {
      src: typeof mineAssetUrl === "function" ? mineAssetUrl(bossSrc) : bossSrc,
      kind: "sprite",
      anim: "idle",
      cls: "target-elite",
      label: bossDef.name,
    };
  }
  spawnSoloMob(field, "boss", { name: bossDef.name, sprite });
  if (typeof markZoneBossOffered === "function") markZoneBossOffered(zoneId);
  const hintEl = document.getElementById("mineHint");
  if (hintEl) hintEl.style.display = "none";
  if (typeof gameLog === "function") gameLog("☠ " + bossDef.name + " явился на поле!", "warn");
}

function missBoss(g) {
  const zoneId = currentMineZoneId();
  removeGnome(g);
  const n = (parseInt($("#mineMissed").textContent) || 0) + 1;
  $("#mineMissed").textContent = n;
  if (typeof resetZoneBossGrind === "function") resetZoneBossGrind(zoneId);
  const need = typeof zoneBossGrindKillsNeeded === "function" ? zoneBossGrindKillsNeeded() : 12;
  toast("Босс ушёл — качайся и затачивай. После " + need + " зачисток он вернётся.", "warn");
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  queueNextMob(900);
}

function tapBanan(g, e, opts) {
  opts = opts || {};
  if (!mineGnomes.has(g) || g._type !== "banan") return;
  if (typeof isGamePaused === "function" && isGamePaused()) return;
  if (!opts.autoClicker) {
    const guard = mineGuardCheck(e, g, "banan");
    if (!guard.ok) return;
  }
  g._hits = (g._hits || 0) + 1;
  const label = g.querySelector(".banan-hits");
  if (label) label.textContent = g._hits + " / " + BANAN_HITS;
  Audio2.mineHit();
  g.classList.add("banan-tap");
  setTimeout(() => g.classList.remove("banan-tap"), 90);
  mineBurst(g._x, g._y, "#b06bff", 6);
  if (g._hits >= BANAN_HITS) catchBanan(g);
}

function missBanan(g) {
  removeGnome(g);
  const n = (parseInt($("#mineMissed").textContent) || 0) + 1;
  $("#mineMissed").textContent = n;
  if (typeof achStat === "function") achStat("bananEscaped", 1);
  if (typeof checkAchievements === "function") checkAchievements();
  toast("Редкий гном сбежал — не хватило кликов", "warn");
  resumeMineSpawns();
}

function catchBanan(g) {
  if (!mineGnomes.has(g)) return;
  const x = g._x, y = g._y;
  removeGnome(g, "caught");
  Audio2.mineKill();
  Audio2.mineReward("jackpot");
  const caught = (parseInt($("#mineCaught").textContent) || 0) + 1;
  $("#mineCaught").textContent = caught;
  const loot = rollBananLootTuned();
  const res = grantBananLoot(loot);
  const color = res.epic ? "#ffc46b" : "#b06bff";
  if (res.ok) {
    const msg = res.epic ? "ЛЕГЕНДА! Редкий гном: " + res.text : "Редкий гном: " + res.text;
    toast(msg, res.epic ? "success" : "loot");
    floatText(x, y, res.text, color);
    if (loot.kind === "weapon" && res.weapon) {
      trackMineSessionLoot({
        kind: "weapon",
        id: res.weapon.id,
        name: res.weapon.name,
        grade: res.weapon.grade,
        icon: res.weapon.icon,
        plus: loot.plus || 0,
      });
    } else if (loot.kind === "earring") {
      const def = typeof COLLECTIBLES !== "undefined" ? COLLECTIBLES[ZAKEN_EARRING_ID] : null;
      if (def) {
        trackMineSessionLoot({
          kind: "accessory",
          id: ZAKEN_EARRING_ID,
          name: def.name,
          grade: "epic",
          icon: def.icon,
        });
      }
    } else if (loot.kind === "soulshots" || loot.kind === "spiritshots") {
      const spirit = loot.kind === "spiritshots";
      trackMineSessionLoot({
        kind: "shots",
        shotKind: loot.kind,
        grade: loot.grade,
        name: (spirit ? "SpS " : "SS ") + loot.grade,
        icon: typeof ORE !== "undefined" && ORE.soul ? ORE.soul.icon : "icons/char_menu.png?v=10",
        qty: loot.qty || 1,
      });
    }
  } else {
    toast("Редкий гном… но " + res.text, "warn");
    floatText(x, y, res.text, "#ff6b6b");
  }
  mineBurst(x, y, color, 40);
  if (typeof achStat === "function") achStat("bananWins", 1);
  save();
  if (typeof checkAchievements === "function") checkAchievements();
  resumeMineSpawns();
}

function removeGnome(g, mode) {
  clearMobTimer(g);
  mineGnomes.delete(g);
  g.classList.add(mode || "leaving");
  setTimeout(() => g.remove(), mode === "caught" ? 220 : 200);
}

function missGnome(g) {
  removeGnome(g);
  const n = (parseInt($("#mineMissed").textContent) || 0) + 1;
  $("#mineMissed").textContent = n;
  if (typeof achStat === "function") achStat("gnomesMissed", 1);
  if (typeof checkAchievements === "function") checkAchievements();
  toast("Враг сбежал — кликай быстрее!", "warn");
  queueNextMob(700);
}

function gnomeDropPoint(g) {
  return mineLootCoords(g);
}

function catchGnome(g, e, opts) {
  opts = opts || {};
  if (!mineGnomes.has(g) || (typeof isGamePaused === "function" && isGamePaused())) return;
  let guard;
  if (opts.autoClicker) {
    guard = { ok: true, mult: 1, byAuto: true };
  } else {
    guard = mineGuardCheck(e, g, "gnome");
    if (!guard.ok) return;
  }
  const type = g._type || "normal";
  const dropAt = gnomeDropPoint(g);
  const dmg = typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 8;
  let appliedMult = guard.mult || 1;
  if (typeof mineSkillClickMult === "function") appliedMult *= mineSkillClickMult();
  let applied = Math.max(1, Math.round(dmg * appliedMult));
  if (typeof applyMineShotDamageMult === "function") applied = applyMineShotDamageMult(applied);
  else applied = Math.max(1, Math.round(applied * 0.5));
  if (typeof applyMobShieldDamage === "function") applied = applyMobShieldDamage(g, applied);
  g._hp = (g._hp ?? g._maxHp) - applied;
  Audio2.mineHit();
  g.classList.add("mob-hit");
  setTimeout(() => g.classList.remove("mob-hit"), 90);
  updateMobHpBar(g);
  floatText(dropAt.x, dropAt.y - 12, "-" + fmtCombat(applied), "#ff9a8a");
  mineBurst(dropAt.x, dropAt.y, type === "golden" ? "#ffc46b" : "#c8a882", 5);
  if (g._hp > 0) {
    if (typeof checkMobEnrage === "function") checkMobEnrage(g);
    return;
  }
  finishMobKill(g, type, dropAt, guard);
}

function finishMobKill(g, type, dropAt, guard) {
  removeGnome(g, "caught");
  const zoneId = typeof currentMineZoneId === "function" ? currentMineZoneId() : (state.farmZone || "banana_mine");
  if (type === "boss") {
    if (typeof onZoneBossDefeated === "function") onZoneBossDefeated(zoneId);
  } else {
    if (typeof onQuestMobKill === "function") onQuestMobKill(zoneId, type);
    if (typeof isZoneBossPending === "function" && isZoneBossPending(zoneId)) {
      if (typeof addZoneBossGrindKill === "function") addZoneBossGrindKill(zoneId);
      if (typeof renderMineQuestHud === "function") renderMineQuestHud();
    }
  }
  const rewardKind = type === "boss" ? "treasure" : type === "golden" ? "treasure" : "coin";
  Audio2.mineKill();
  Audio2.mineReward(rewardKind);
  const caught = (parseInt($("#mineCaught").textContent) || 0) + 1;
  $("#mineCaught").textContent = caught;

  let reward, color, weaponDrop = null;
  const bossDef = type === "boss" && typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : null;
  if (type === "boss") {
    reward = mineGoldenReward();
    reward = Math.round(reward * (bossDef?.rewardMult || 3) * guard.mult);
    reward = mineGuardApplyAdena(reward);
    color = "#ff6b4a";
    if (typeof gameLog === "function") gameLog("☠ " + (bossDef?.name || "Босс") + " повержен!", "success");
  } else if (type === "golden") {
    reward = mineGoldenReward();
    reward = Math.round(reward * guard.mult);
    reward = mineGuardApplyAdena(reward);
    color = "#ffc46b";
    const weaponChance = typeof mineGoldenWeaponChance === "function" ? mineGoldenWeaponChance() : 1;
    if (Math.random() < weaponChance) {
      const drop = rollMineWeaponDrop(zoneId);
      if (drop) {
        const added = addToInventory(drop.id, { source: "golden", zoneId });
        if (added) {
          weaponDrop = drop;
          toast("💰 Золотая цель обронила: " + drop.name + " (" + drop.grade + ") → в инвентарь!", "loot");
        } else {
          toast("💰 Золотая цель… но инвентарь полон (" + INV_CAP + ")!", "warn");
        }
      }
    }
  } else {
    reward = mineNormalReward();
    reward = Math.round(reward * guard.mult);
    reward = mineGuardApplyAdena(reward);
    color = "#9be6a6";
  }
  if (guard && guard.bySkill && typeof floatText === "function") {
    floatText(dropAt.x, dropAt.y - 48, "скилл-финиш", "#9ad4ff");
  }
  if (weaponDrop) {
    spawnWeaponDrop(dropAt.x, dropAt.y - 18, weaponDrop);
    floatText(dropAt.x, dropAt.y - 56, weaponDrop.name, weaponDrop.glow || color);
    mineBurst(dropAt.x, dropAt.y - 18, weaponDrop.glow || color, 16);
    trackMineSessionLoot({
      kind: "weapon",
      id: weaponDrop.id,
      name: weaponDrop.name,
      grade: weaponDrop.grade,
      icon: weaponDrop.icon,
      plus: 0,
    });
  }
  if (reward <= 0) {
    if (mineSession) {
      mineSession.kills = (mineSession.kills || 0) + 1;
      if (weaponDrop) mineSession.weapons = (mineSession.weapons || 0) + 1;
    }
    queueNextMob(type === "boss" ? 850 : 520);
    return;
  }
  const logLabel = type === "boss" ? "Босс: " : type === "golden" ? "Задание (элита): " : "Задание: ";
  const skillTag = guard && guard.bySkill ? " · скилл" : "";
  gameLog(logLabel + "+" + fmtAdena(reward) + " adena" + skillTag, "gold");
  ProgressStore.update("adena", (a) => (a || 0) + reward);
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + reward }));
  const earned = (parseInt($("#mineEarned").textContent.replace(/\D/g, "")) || 0) + reward;
  $("#mineEarned").textContent = fmt(earned);
  $("#adena").textContent = fmt(state.adena);
  const dropGolden = dropAt.golden || type === "golden" || type === "boss";
  spawnAdenaDrop(dropAt.x, dropAt.y, reward, dropGolden);
  floatText(dropAt.x, dropAt.y - 32, "+" + fmtAdena(reward), color, { adena: true });
  mineBurst(dropAt.x, dropAt.y, color, type === "golden" || type === "boss" ? 22 : 14);
  if (typeof achStat === "function") {
    achStat("gnomesCaught", 1);
    if (type === "golden") achStat("goldenGnomes", 1);
    if (type === "boss") achStat("bossKills", 1);
  }
  if (mineSession) {
    mineSession.kills = (mineSession.kills || 0) + 1;
    if (weaponDrop) mineSession.weapons = (mineSession.weapons || 0) + 1;
  }
  if ((type === "boss" || type === "golden" || type === "banan") && typeof logCharacterEvent === "function") {
    logCharacterEvent("loot_rare", {
      type,
      zoneId,
      adenaGain: reward,
      weaponId: weaponDrop?.id || null,
      weaponName: weaponDrop?.name || null,
      grade: weaponDrop?.grade || null,
    });
  }
  save();
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof onMineAvatarXp === "function") onMineAvatarXp(type === "golden" || type === "boss");
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  queueNextMob(type === "boss" ? 850 : 520);
  if (typeof updateDevTuneHints === "function") updateDevTuneHints();
}

function wireBananDev() {
  const btn = document.getElementById("devSpawnBanan");
  if (!btn || !FEATURE_DEV_PANEL) return;
  if (btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.onclick = () => {
    if (!mineActive) { toast("Сначала открой задание", "warn"); return; }
    if (hasBananOnField()) { toast("Редкий гном уже на экране", "warn"); return; }
    Audio2.click();
    spawnGnome("banan");
    gameLog("Dev: спавн редкого гнома", "system");
  };
}
