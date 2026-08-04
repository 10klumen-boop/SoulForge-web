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
let mineResourceFavOpen = false;

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
  if (typeof migrateFarmZone === "function") migrateFarmZone();
  let zoneId = state.farmZone || "banana_mine";
  let zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  // В группе — соло История/Фарм закрыты (инстансы и мировой босс — отдельно)
  const inParty =
    typeof partyMemberCount === "function"
      ? partyMemberCount() > 0
      : !!(typeof getChatParty === "function" && getChatParty());
  if (inParty && zone && !zone.party) {
    toast("В группе соло История/Фарм недоступны — открой меню «Группа» → Инстанс.", "warn");
    if (typeof openPartyScreen === "function") openPartyScreen();
    return;
  }
  if (zone && typeof canEnterFarmZone === "function" && !canEnterFarmZone(zone)) {
    if (typeof migrateFarmZone === "function") migrateFarmZone();
    zoneId = state.farmZone || "banana_mine";
    zone = typeof farmZoneById === "function" ? farmZoneById(zoneId) : null;
  }
  if (zone && typeof canEnterFarmZone === "function" && !canEnterFarmZone(zone)) {
    const hint =
      typeof farmZoneLockHint === "function" ? farmZoneLockHint(zone) : "";
    toast(hint || "Нет доступной зоны — закрой главу или открой Охоту", "warn");
    if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
    return;
  }
  if (zone && zone.party) {
    if (typeof partyFarmBeforeOpenMine === "function") {
      Promise.resolve(partyFarmBeforeOpenMine()).then((ok) => {
        if (ok) openMineContinue(zoneId, zone);
      });
      return;
    }
  }
  openMineContinue(zoneId, zone);
}

/**
 * Сброс HUD/поллов/модалки инста и Закена — иначе они «переезжают» в обычный фарм.
 * mode: "solo" | "instance" | "worldBoss"
 */
function clearExclusiveMineOverlays(mode) {
  mode = mode || "solo";
  const wantInstance = mode === "instance";
  const wantWb = mode === "worldBoss";
  const wantClanBoss = mode === "clanBoss";

  if (!wantInstance) {
    if (typeof stopInstancePoll === "function") stopInstancePoll();
    if (typeof instanceClearDom === "function") {
      try {
        instanceClearDom();
      } catch (_) {}
    }
    if (typeof hideInstanceReadyGate === "function") hideInstanceReadyGate();
    const ih = document.getElementById("instanceHud");
    if (ih) {
      ih.hidden = true;
      ih.innerHTML = "";
    }
    try {
      if (typeof instanceRunState !== "undefined") instanceRunState = null;
    } catch (_) {}
    try {
      if (typeof instanceExitHandled !== "undefined") instanceExitHandled = false;
    } catch (_) {}
  }

  if (!wantWb) {
    if (typeof stopWorldBossPoll === "function") stopWorldBossPoll();
    if (typeof worldBossClearDomMob === "function") {
      try {
        worldBossClearDomMob();
      } catch (_) {}
    }
    const wh = document.getElementById("worldBossHud");
    if (wh) {
      wh.hidden = true;
      wh.innerHTML = "";
    }
    try {
      if (typeof worldBossSessionActive !== "undefined") worldBossSessionActive = false;
    } catch (_) {}
    try {
      if (typeof worldBossEndPrompted !== "undefined") worldBossEndPrompted = false;
    } catch (_) {}
  }

  if (!wantClanBoss) {
    if (typeof stopClanBossPoll === "function") stopClanBossPoll();
    if (typeof clanBossClearDomMob === "function") {
      try {
        clanBossClearDomMob();
      } catch (_) {}
    }
    const ch = document.getElementById("clanBossHud");
    if (ch) ch.remove();
    try {
      if (typeof clanBossSessionActive !== "undefined") clanBossSessionActive = false;
    } catch (_) {}
    try {
      if (typeof clanBossEndPrompted !== "undefined") clanBossEndPrompted = false;
    } catch (_) {}
  }

  // Модалки итогов инста/Закена не должны висеть поверх соло-фарма
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop && !backdrop.hidden) {
    const sm = backdrop.dataset.storyMode || "";
    if (
      sm === "instance_clear" ||
      sm === "instance_fail" ||
      sm === "world_boss_result" ||
      sm === "clan_boss_clear"
    ) {
      delete backdrop.dataset.storyMode;
      backdrop.hidden = true;
      if (typeof syncGamePauseState === "function") syncGamePauseState();
      else if (typeof setGamePaused === "function") setGamePaused(false);
    }
  }
}

function openMineContinue(zoneId, zone) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  zone = zone || (typeof farmZoneById === "function" ? farmZoneById(zoneId) : null);
  // Обычный фарм / side — всегда чистим чужие оверлеи (инст/Закен).
  if (typeof clearExclusiveMineOverlays === "function") {
    clearExclusiveMineOverlays(zone && zone.party ? "instance" : "solo");
  }
  if (typeof requestMineWithQuestBriefing === "function" && !zone?.party && requestMineWithQuestBriefing(zoneId)) return;
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
  mineClanSealSession = 0;
  mineOverlayPaused = false;
  if (!(zone && zone.party) && typeof startAutoClickerLoop === "function") {
    startAutoClickerLoop();
  }
  mineSession = {
    startedAt: Date.now(),
    adena0: Math.max(0, Math.floor(Number(state.adena) || 0)),
    kills: 0,
    weapons: 0,
    zoneId: state.farmZone || "banana_mine",
    loot: {},
  };
  mineSessionLootOpen = false;
  mineResourceFavOpen = false;
  resetMineGuardSession();
  if (typeof resetMineSkillRuntime === "function") resetMineSkillRuntime();
  $("#mineEarned").textContent = "0";
  $("#mineCaught").textContent = "0";
  $("#mineMissed").textContent = "0";
  const farmStats = document.querySelector("#screen-mine .mine-farm-stats");
  if (farmStats) farmStats.hidden = false;
  const mineHud = document.querySelector("#screen-mine .mine-hud");
  if (mineHud) mineHud.hidden = false;
  renderMineSessionLoot();
  if (hintEl) hintEl.style.display = "";
  if (typeof renderMineHudStats === "function") renderMineHudStats();
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  if (typeof renderMineSkillBar === "function") renderMineSkillBar();
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
  if (typeof renderMineStoryBar === "function") renderMineStoryBar(zoneId);
  show("mine");
  Audio2.open();
  if (typeof mentorEmit === "function") mentorEmit("mine_open");
  clearInterval(mineTimer);
  mineTimer = null;
  cancelMineSpawnQueue();
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  if (typeof debugLog === "function") debugLog("info", "mine", "openMine", { zone: zoneId });
  if (typeof achStat === "function") achStat("mineVisits", 1);
  if (typeof engagementEmit === "function") engagementEmit("mine_enter", { zoneId });
  if (typeof checkAchievements === "function") checkAchievements();
  if (zone && zone.party) {
    // Server drives spawns
    if (typeof partyFarmSyncEncounter === "function" && typeof partyFarmState !== "undefined") {
      partyFarmSyncEncounter(partyFarmState);
    }
    return;
  }
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
  if (typeof worldBossAfterStopMine === "function") worldBossAfterStopMine();
  if (typeof clanBossAfterStopMine === "function") clanBossAfterStopMine();
  if (typeof partyFarmAfterStopMine === "function") partyFarmAfterStopMine();
  if (typeof instanceAfterStopMine === "function") instanceAfterStopMine();
  if (typeof stopAutoClickerLoop === "function") stopAutoClickerLoop();
  if (typeof resetMineSkillRuntime === "function") resetMineSkillRuntime();
  clearInterval(mineTimer);
  mineTimer = null;
  cancelMineSpawnQueue();
  mineGnomes.forEach((g) => { clearMobTimer(g); g.remove(); });
  mineGnomes.clear();
  const lootLayer = document.getElementById("mineLootLayer");
  if (lootLayer) lootLayer.innerHTML = "";
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
  if (typeof afterInventorySpaceFreed === "function") afterInventorySpaceFreed();
  // Immediate local + cloud flush — debounce must not leave combat loot on an old cloud seq.
  if (typeof save === "function") save();
  if (typeof flushCloudSave === "function") flushCloudSave({ force: true });
  else if (window.SoulforgeCloud?.flushSave) window.SoulforgeCloud.flushSave({ force: true });
  if (typeof noteLeaderboardEvent === "function") noteLeaderboardEvent("snapshot");
}

function hasBananOnField() {
  pruneMineGnomes();
  for (const g of mineGnomes) if (g._type === "banan") return true;
  return false;
}

function pruneMineGnomes() {
  for (const g of [...mineGnomes]) {
    if (!g || !g.isConnected) {
      clearMobTimer(g);
      mineGnomes.delete(g);
    }
  }
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
  pruneMineGnomes();
  if (hasBananOnField()) return;
  cancelMineSpawnQueue();
  mineSpawnDelayTimer = setTimeout(() => {
    mineSpawnDelayTimer = null;
    spawnGnome();
  }, delay == null ? 550 : delay);
}

function ensureMineSpawning() {
  if (!mineActive || mineOverlayPaused) return;
  pruneMineGnomes();
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
  pruneMineGnomes();
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
  const normalFn = typeof passiveEffectMult === "function" ? passiveEffectMult
    : (typeof racialEffectMult === "function" ? racialEffectMult : null);
  if (normalFn) amt = Math.round(amt * normalFn("normalAdenaMult", state.avatar || state.avatar?.raceId));
  return amt;
}

/** Holder +adena% только online mine; не трогает passive. Кап с clan buff. */
let mineClanSealBuf = null;
/** Печати, нафармленные за текущую сессию фарма (для HUD). */
let mineClanSealSession = 0;

function mineApplyClanTerritoryAdena(amount) {
  const zoneId = typeof currentMineZoneId === "function" ? currentMineZoneId() : state.farmZone;
  const pct = typeof clanTerritoryAdenaBonusPct === "function" ? clanTerritoryAdenaBonusPct(zoneId) : 0;
  if (!pct || !amount) return amount;
  return Math.round(amount * (1 + pct / 100));
}

/** Clan weekly buff +adena% (online mine only). Respects combined farm cap with holder. */
function mineApplyClanBuffAdena(amount) {
  if (!amount) return amount;
  const zoneId = typeof currentMineZoneId === "function" ? currentMineZoneId() : state.farmZone;
  const holder = typeof clanTerritoryAdenaBonusPct === "function" ? clanTerritoryAdenaBonusPct(zoneId) : 0;
  const buff = typeof clanBuffAdenaPct === "function" ? clanBuffAdenaPct() : 0;
  if (!buff) return amount;
  const cap =
    (typeof CLAN_FARM_BONUS_CAPS !== "undefined" && CLAN_FARM_BONUS_CAPS.adenaPct) || 28;
  const room = Math.max(0, cap - holder);
  const apply = Math.min(buff, room);
  if (!apply) return amount;
  return Math.round(amount * (1 + apply / 100));
}

function mineGoldenReward() {
  const { lo, hi } = mineAdenaBaseRange("golden");
  let amt = playtestIncome(lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1)));
  if (typeof avatarMineRewardMult === "function") amt = Math.round(amt * avatarMineRewardMult(state.farmZone || "banana_mine"));
  const goldenFn = typeof passiveEffectMult === "function" ? passiveEffectMult
    : (typeof racialEffectMult === "function" ? racialEffectMult : null);
  if (goldenFn) amt = Math.round(amt * goldenFn("goldenAdenaMult", state.avatar || state.avatar?.raceId));
  return amt;
}

function renderMineHudStats() {
  if (typeof syncMineShotHud === "function") syncMineShotHud();
  if (typeof clanHydrateWorldState === "function") clanHydrateWorldState(false);
  if (typeof syncMineClanTerritoryHud === "function") syncMineClanTerritoryHud();
}

/** Z2: чип владельца / holder-bonus в HUD фарма (только capturable). */
function syncMineClanTerritoryHud() {
  const el = document.getElementById("mineClanTerritoryHud");
  if (!el) return;
  if (typeof isClanBossSessionActive === "function" && isClanBossSessionActive()) {
    el.hidden = true;
    el.textContent = "";
    el.className = "mh mine-clan-territory";
    return;
  }
  if (
    (typeof isWorldBossSessionActive === "function" && isWorldBossSessionActive()) ||
    (typeof mineSession !== "undefined" && mineSession && mineSession.worldBoss)
  ) {
    el.hidden = true;
    el.textContent = "";
    el.className = "mh mine-clan-territory";
    return;
  }
  const zoneId = typeof currentMineZoneId === "function" ? currentMineZoneId() : state.farmZone;
  const st =
    typeof clanTerritoryStatusForZone === "function" ? clanTerritoryStatusForZone(zoneId) : null;
  const buffPct = typeof clanBuffAdenaPct === "function" ? clanBuffAdenaPct() : 0;
  if ((!st || !st.capturable || !st.siegeEnabled) && !(buffPct > 0)) {
    el.hidden = true;
    el.textContent = "";
    el.className = "mh mine-clan-territory";
    return;
  }
  el.hidden = false;
  if (st && st.capturable && st.siegeEnabled) {
    el.className =
      "mh mine-clan-territory" +
      (st.isMyClan ? " is-mine" : st.holder ? " is-held" : " is-neutral");
    const xpBit = st.xpBonusPct ? " · +" + st.xpBonusPct + "% XP" : "";
    if (st.isMyClan && st.bonusPct) {
      el.textContent = "Ваше угодье · +" + st.bonusPct + "% адены" + xpBit;
      el.title = st.lineMeta || "Бонус владельца (только online)";
      if (mineClanSealSession > 0) {
        el.textContent += " · печати +" + mineClanSealSession;
        el.title += " · печати за сессию: " + mineClanSealSession;
      }
    } else if (st.holder) {
      el.textContent = "Чужое · клан " + st.holder.clanName;
      el.title = "Бонус только у клана-владельца";
    } else {
      const tier =
        typeof clanTerritoryWarTierLabelRu === "function"
          ? clanTerritoryWarTierLabelRu(st.territory)
          : "захват";
      el.textContent = "Свободно · " + tier;
      el.title = st.lineMeta || "Захват — в меню Клан → Угодья";
    }
  } else {
    el.className = "mh mine-clan-territory is-mine";
    el.textContent = "";
    el.title = "Недельный клан-бафф";
  }
  if (buffPct > 0) {
    el.textContent = (el.textContent ? el.textContent + " · " : "") + "бафф +" + buffPct + "%";
  }
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
  if (typeof partyFarmShouldBlockLocalSpawn === "function" && partyFarmShouldBlockLocalSpawn()) return;
  if (typeof worldBossShouldBlockLocalSpawn === "function" && worldBossShouldBlockLocalSpawn()) return;
  if (typeof clanBossShouldBlockLocalSpawn === "function" && clanBossShouldBlockLocalSpawn()) return;
  if (typeof instanceShouldBlockLocalSpawn === "function" && instanceShouldBlockLocalSpawn()) return;
  if (mineOverlayPaused) {
    queueNextMob(280);
    return;
  }
  pruneMineGnomes();
  const zoneId = currentMineZoneId();
  if (hasBananOnField() && forcedType !== "banan") return;
  if (hasCombatMobOnField() && forcedType !== "banan") return;

  if (!forcedType && shouldSpawnZoneBoss(zoneId) && !hasBossOnField()) {
    const before = mineGnomes.size;
    spawnZoneBoss();
    // Если босс не появился (ранний return) — не глушим очередь спавна
    if (mineGnomes.size === before && !hasCombatMobOnField() && !hasBananOnField()) {
      queueNextMob(500);
    }
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
  const pos = opts.center
    ? { x: Math.round(field.clientWidth / 2), y: Math.round(field.clientHeight * 0.52) }
    : opts.x != null && opts.y != null
      ? { x: opts.x, y: opts.y }
      : mineSoloPosition(field, type);
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
  const skipTimer = !!(opts.noTimer || opts.worldBoss || type === "world_boss");
  const onExpire = () => {
    if (!mineGnomes.has(g)) return;
    if (type === "boss") missBoss(g);
    else missGnome(g);
  };
  g._timerCap = skipTimer ? 0 : Date.now() + life;
  try {
    if (!skipTimer) attachMobTimer(g, life, onExpire, life);
    else if (typeof clearMobTimer === "function") clearMobTimer(g);
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
    mineGnomes.delete(g);
    clearMobTimer(g);
    try { g.remove(); } catch (_) {}
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
  if (!mineActive || mineOverlayPaused || hasBossOnField() || hasCombatMobOnField()) return false;
  const zoneId = currentMineZoneId();
  if (!shouldSpawnZoneBoss(zoneId)) return false;
  const field = mineSpawnField();
  if (!field || field.clientWidth < 48 || field.clientHeight < 48) {
    queueNextMob(400);
    return false;
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
  return true;
}

function missBoss(g) {
  // Инст-мобы не «убегают» локально — жизнь/idle считает сервер
  if (g && g._instanceEncounter) {
    if (typeof clearMobTimer === "function") clearMobTimer(g);
    return;
  }
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
  if (res.ok && typeof grantBananaCasinoTokens === "function") {
    grantBananaCasinoTokens(1);
  }
  if (res.ok && typeof announceWorldEvent === "function") {
    if (loot.kind === "earring" && res.epic) {
      announceWorldEvent("banan_zaken", {
        itemName: res.text || (typeof COLLECTIBLES !== "undefined" && COLLECTIBLES[ZAKEN_EARRING_ID]?.name) || "Благословенную серьгу ЗакАна",
        itemId: ZAKEN_EARRING_ID,
      });
    } else if (loot.kind === "adena" && Number(loot.amount) >= 100_000_000) {
      announceWorldEvent("banan_adena", { amount: loot.amount });
    }
  }
  if (res.ok && typeof logCharacterEvent === "function") {
    logCharacterEvent("banan_catch", {
      kind: loot.kind,
      amount: loot.amount || null,
      plus: loot.plus || null,
      epic: !!res.epic,
      text: res.text || null,
    });
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
  // Инст-мобы не «убегают» локально — жизнь/idle считает сервер
  if (g && g._instanceEncounter) {
    if (typeof clearMobTimer === "function") clearMobTimer(g);
    return;
  }
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
  if (g._partyEncounter && typeof partyFarmHandleHit === "function") {
    partyFarmHandleHit(g, opts);
    return;
  }
  if (g._worldBossEncounter && typeof worldBossHandleHit === "function") {
    worldBossHandleHit(g, opts);
    return;
  }
  if (g._clanBossEncounter && typeof clanBossHandleHit === "function") {
    clanBossHandleHit(g, opts);
    return;
  }
  if (g._instanceEncounter && typeof instanceHandleHit === "function") {
    instanceHandleHit(g, opts);
    return;
  }
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
  if (typeof passiveEffectMult === "function") appliedMult *= passiveEffectMult("farmDamageMult", state.avatar);
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

function trackMineScrollDrop(zoneId, mobType, dropAt) {
  if (typeof rollScrollDrop !== "function" || typeof addScroll !== "function") return;
  const sDrop = rollScrollDrop(zoneId, mobType);
  if (!sDrop) return;
  if (!addScroll(sDrop.target, sDrop.typeId, sDrop.grade, sDrop.qty)) return;
  const label =
    typeof scrollLabel === "function"
      ? scrollLabel(sDrop.target, sDrop.typeId, sDrop.grade)
      : "Свиток";
  const icon =
    typeof scrollDef === "function"
      ? scrollDef(sDrop.target, sDrop.grade, sDrop.typeId).icon
      : typeof scrollTierIcon === "function"
        ? scrollTierIcon(sDrop.typeId, sDrop.grade, sDrop.target)
        : "";
  trackMineSessionLoot({
    kind: "scroll",
    id: sDrop.target + ":" + sDrop.typeId + ":" + sDrop.grade,
    name: label,
    qty: sDrop.qty,
    grade: sDrop.grade,
    icon: icon || undefined,
  });
  if (typeof floatText === "function" && dropAt) {
    floatText(dropAt.x, dropAt.y - 104, label + " ×" + sDrop.qty, "#ffe082");
  }
}

/** Ролл оружия с любого моба (шанс — mineWeaponDropChance). */
function tryMineWeaponDrop(zoneId, mobType) {
  const chance =
    typeof mineWeaponDropChance === "function"
      ? mineWeaponDropChance(mobType)
      : mobType === "golden" || mobType === "boss"
        ? 0.12
        : 0.03;
  if (!(chance > 0) || Math.random() >= chance) return null;
  const drop = typeof rollMineWeaponDrop === "function" ? rollMineWeaponDrop(zoneId) : null;
  if (!drop) return null;
  const added = addToInventory(drop.id, {
    source: mobType === "boss" ? "zone_boss" : mobType === "golden" ? "golden" : "farm",
    zoneId,
  });
  if (!added) {
    if (typeof toast === "function") {
      toast("Оружие… но инвентарь полон (" + INV_CAP + ")!", "warn");
    }
    return null;
  }
  const tag =
    mobType === "boss" ? "Босс" : mobType === "golden" ? "Золотая цель" : "Моб";
  if (typeof toast === "function") {
    toast("⚔ " + tag + ": " + drop.name + " (" + drop.grade + ") → в инвентарь!", "loot");
  }
  return drop;
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
  if (typeof engagementEmit === "function") {
    if (type !== "boss") engagementEmit("mob_kill", { zoneId, type });
  }
  if (typeof mentorEmit === "function") mentorEmit("first_kill");
  const rewardKind = type === "boss" ? "treasure" : type === "golden" ? "treasure" : "coin";
  Audio2.mineKill();
  Audio2.mineReward(rewardKind);
  // Печати угодий: holder-mine
  if (typeof clanTerritoryByFarmZone === "function" && typeof clanAccrueSeals === "function") {
    const st =
      typeof clanTerritoryStatusForZone === "function" ? clanTerritoryStatusForZone(zoneId) : null;
    if (st && st.isMyClan && st.siegeEnabled && st.territory) {
      if (!mineClanSealBuf) mineClanSealBuf = { territoryId: "", hits: 0, flushAt: 0 };
      if (mineClanSealBuf.territoryId !== st.territory.id) {
        mineClanSealBuf.territoryId = st.territory.id;
        mineClanSealBuf.hits = 0;
      }
      mineClanSealBuf.hits += 1;
      const now = Date.now();
      if (mineClanSealBuf.hits >= 5 || now > (mineClanSealBuf.flushAt || 0)) {
        const hits = mineClanSealBuf.hits;
        mineClanSealBuf.hits = 0;
        mineClanSealBuf.flushAt = now + 15000;
        clanAccrueSeals(st.territory.id, hits)
          .then((r) => {
            if (r && r.ok && r.gained > 0) {
              mineClanSealSession += r.gained;
              if (typeof syncMineClanTerritoryHud === "function") syncMineClanTerritoryHud();
            }
          })
          .catch(() => {});
      }
    }
  }
  const caught = (parseInt($("#mineCaught").textContent) || 0) + 1;
  $("#mineCaught").textContent = caught;

  let reward, color, weaponDrop = null;
  const bossDef = type === "boss" && typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : null;
  if (type === "boss") {
    reward = mineGoldenReward();
    reward = Math.round(reward * (bossDef?.rewardMult || 3) * guard.mult);
    reward = typeof mineApplySkillAdenaBonus === "function" ? mineApplySkillAdenaBonus(reward) : reward;
    reward = typeof mineApplyClanTerritoryAdena === "function" ? mineApplyClanTerritoryAdena(reward) : reward;
    reward = typeof mineApplyClanBuffAdena === "function" ? mineApplyClanBuffAdena(reward) : reward;
    reward = mineGuardApplyAdena(reward);
    color = "#ff6b4a";
    if (typeof gameLog === "function") gameLog("☠ " + (bossDef?.name || "Босс") + " повержен!", "success");
    if (typeof rollArmorFragDrop === "function") {
      const fragDrop = rollArmorFragDrop(zoneId, "boss");
      if (fragDrop && typeof addArmorFrag === "function") {
        const granted = addArmorFrag(fragDrop.fragId, fragDrop.qty, { source: "zone_boss", zoneId });
        if (granted) {
          trackMineSessionLoot({
            kind: "armor_frag",
            id: fragDrop.fragId,
            name: fragDrop.def.name,
            qty: fragDrop.qty,
            icon: fragDrop.def.icon,
          });
          floatText(dropAt.x, dropAt.y - 56, fragDrop.def.name + " ×" + fragDrop.qty, "#7fd1ff");
        }
      }
    }
    if (typeof rollJewelryFragDrop === "function") {
      const jDrop = rollJewelryFragDrop(zoneId, "boss");
      if (jDrop && typeof addShardToInventory === "function") {
        const granted = addShardToInventory(jDrop.fragId, jDrop.qty, { source: "zone_boss", zoneId, silent: true });
        if (granted) {
          trackMineSessionLoot({
            kind: "jewelry_frag",
            id: jDrop.fragId,
            name: jDrop.def.name,
            qty: jDrop.qty,
            icon: jDrop.def.icon,
          });
          floatText(dropAt.x, dropAt.y - 40, jDrop.def.name + " ×" + jDrop.qty, "#c9a0ff");
          if (typeof toast === "function") toast("✧ " + jDrop.def.name + " ×" + jDrop.qty, "loot");
        }
      }
    }
    trackMineScrollDrop(zoneId, "boss", dropAt);
    weaponDrop = tryMineWeaponDrop(zoneId, "boss");
  } else if (type === "golden") {
    reward = mineGoldenReward();
    reward = Math.round(reward * guard.mult);
    reward = typeof mineApplySkillAdenaBonus === "function" ? mineApplySkillAdenaBonus(reward) : reward;
    reward = typeof mineApplyClanTerritoryAdena === "function" ? mineApplyClanTerritoryAdena(reward) : reward;
    reward = typeof mineApplyClanBuffAdena === "function" ? mineApplyClanBuffAdena(reward) : reward;
    reward = mineGuardApplyAdena(reward);
    color = "#ffc46b";
    weaponDrop = tryMineWeaponDrop(zoneId, "golden");
  } else {
    reward = mineNormalReward();
    reward = Math.round(reward * guard.mult);
    reward = typeof mineApplySkillAdenaBonus === "function" ? mineApplySkillAdenaBonus(reward) : reward;
    reward = typeof mineApplyClanTerritoryAdena === "function" ? mineApplyClanTerritoryAdena(reward) : reward;
    reward = typeof mineApplyClanBuffAdena === "function" ? mineApplyClanBuffAdena(reward) : reward;
    reward = mineGuardApplyAdena(reward);
    color = "#9be6a6";
    weaponDrop = tryMineWeaponDrop(zoneId, "normal");
  }
  if (type === "golden" || type === "normal") {
    if (typeof rollArmorFragDrop === "function") {
      const fragDrop = rollArmorFragDrop(zoneId, type);
      if (fragDrop && typeof addArmorFrag === "function") {
        const granted = addArmorFrag(fragDrop.fragId, fragDrop.qty, { source: type, zoneId });
        if (granted) {
          trackMineSessionLoot({
            kind: "armor_frag",
            id: fragDrop.fragId,
            name: fragDrop.def.name,
            qty: fragDrop.qty,
            icon: fragDrop.def.icon,
          });
          floatText(dropAt.x, dropAt.y - 72, fragDrop.def.name + " ×" + fragDrop.qty, "#7fd1ff");
        }
      }
    }
    if (typeof rollJewelryFragDrop === "function") {
      const jDrop = rollJewelryFragDrop(zoneId, type);
      if (jDrop && typeof addShardToInventory === "function") {
        const granted = addShardToInventory(jDrop.fragId, jDrop.qty, {
          source: type,
          zoneId,
          silent: true,
        });
        if (granted) {
          trackMineSessionLoot({
            kind: "jewelry_frag",
            id: jDrop.fragId,
            name: jDrop.def.name,
            qty: jDrop.qty,
            icon: jDrop.def.icon,
          });
          floatText(dropAt.x, dropAt.y - 88, jDrop.def.name + " ×" + jDrop.qty, "#c9a0ff");
        }
      }
    }
    trackMineScrollDrop(zoneId, type, dropAt);
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
  if ((weaponDrop || type === "boss" || type === "golden" || type === "banan") && typeof logCharacterEvent === "function") {
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
