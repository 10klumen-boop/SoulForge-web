// ===== Достижения: core logic (проверки, статистика, награды) =====
// Вынесено из 18-achievements.js; UI панели и рендер остались в 18-achievements.js.
// Данные достижений в data/achievement-data.js.

// ===== Достижения: движок и UI =====
// Данные ачивок (ACHIEVEMENTS, HIDDEN_ACHIEVEMENTS, PLAYTEST_CHECKLIST, иконки,
// категории) вынесены в data/achievement-data.js.

let achUiFilter = "all";
// init meta after data module is loaded
if (typeof enrichAchievementsMeta === "function") enrichAchievementsMeta();

function allPublicAchievementsUnlocked() {
  ensureAchievementsState();
  return ACHIEVEMENTS.every((a) => !!state.achievements.unlocked[a.id]);
}

function ensureAchievementsState() {
  if (!state.achievements) state.achievements = { unlocked: {}, stats: {} };
  if (!state.achievements.unlocked) state.achievements.unlocked = {};
  if (!state.achievements.stats) state.achievements.stats = {};
}

function achStat(key, delta) {
  ensureAchievementsState();
  if (delta != null) {
    ProgressStore.update("achievements", (a) => {
      const stats = { ...(a?.stats || {}) };
      stats[key] = (stats[key] || 0) + delta;
      return { unlocked: { ...(a?.unlocked || {}) }, stats };
    });
  }
  return state.achievements?.stats?.[key] || 0;
}

function achStatMax(key, val) {
  ensureAchievementsState();
  ProgressStore.update("achievements", (a) => {
    const stats = { ...(a?.stats || {}) };
    stats[key] = Math.max(stats[key] || 0, val | 0);
    return { unlocked: { ...(a?.unlocked || {}) }, stats };
  });
  return state.achievements?.stats?.[key] || 0;
}

function maxWeaponPlus() {
  if (!state.records) return 0;
  let m = 0;
  for (const k of Object.keys(state.records)) m = Math.max(m, state.records[k] || 0);
  return m;
}

function hasZakenCollectible() {
  const gear = state.avatar?.gear;
  if (gear && (gear.earring_l?.id === "zaken_blessed_earring" || gear.earring_r?.id === "zaken_blessed_earring")) return true;
  if (state.equipped && state.equipped.zaken_blessed_earring) return true;
  return (state.inventory || []).some((it) => it.id === "zaken_blessed_earring");
}

function achRecordsCount() {
  if (!state.records) return 0;
  return Object.keys(state.records).filter((k) => (state.records[k] || 0) > 0).length;
}

function achMaxGradePlus(grade) {
  if (!state.records) return 0;
  let m = 0;
  for (const w of WEAPONS) {
    if (w.grade !== grade) continue;
    m = Math.max(m, state.records[w.id] || 0);
  }
  return m;
}

function achTotalCrystals() {
  if (!state.crystals) return 0;
  return GRADES4.reduce((sum, g) => sum + (state.crystals[g] || 0), 0);
}

function achInventoryWeapons() {
  return (state.inventory || []).filter((it) => !isAccessoryItem(it)).length;
}

function ensureWeaponCollection() {
  ensureAchievementsState();
  if (!state.achievements.stats.weaponsCollected) state.achievements.stats.weaponsCollected = {};
}

function isCollectibleWeaponId(weaponId) {
  const w = WMAP[weaponId];
  return !!(w && typeof weaponCanEnchant === "function" && weaponCanEnchant(w));
}

function markWeaponCollected(weaponId) {
  if (!weaponId || !isCollectibleWeaponId(weaponId)) return false;
  ensureWeaponCollection();
  const bag = state.achievements.stats.weaponsCollected;
  if (bag[weaponId]) return false;
  bag[weaponId] = true;
  return true;
}

function migrateWeaponCollection() {
  ensureWeaponCollection();
  let changed = false;
  const touch = (id) => {
    if (markWeaponCollected(id)) changed = true;
  };
  (state.inventory || []).forEach((it) => {
    if (!it || isAccessoryItem(it)) return;
    touch(it.id);
  });
  const gear = state.avatar?.gear;
  if (gear?.weapon?.id) touch(gear.weapon.id);
  if (changed) save();
  return changed;
}

function achUniqueWeaponsByGrade(grade) {
  ensureWeaponCollection();
  const bag = state.achievements.stats.weaponsCollected || {};
  let n = 0;
  for (const id of Object.keys(bag)) {
    if (WMAP[id]?.grade === grade) n++;
  }
  return n;
}

function achGradeWeaponCatalog(grade) {
  return WEAPONS.filter((w) => w.grade === grade && isCollectibleWeaponId(w.id));
}

function achAllGradeCollected(grade) {
  const catalog = achGradeWeaponCatalog(grade);
  if (!catalog.length) return false;
  ensureWeaponCollection();
  const bag = state.achievements.stats.weaponsCollected || {};
  return catalog.every((w) => !!bag[w.id]);
}

function achQuestStepsDone() {
  ensureQuestProgress();
  const done = state.questProgress.completed || {};
  return Object.keys(done).filter((k) => !k.startsWith("_")).length;
}

function achievementContext() {
  ensureWorkshopState();
  ensureAchievementsState();
  migrateWeaponCollection();
  const t = state.totals || {};
  const m = state.materials || {};
  const s = state.achievements.stats;
  const chapter1Complete = typeof isZoneChapterComplete === "function" && isZoneChapterComplete("banana_mine");
  return {
    avatarCreated: !!state.avatar?.created,
    avatarLevel: state.avatar?.level || 0,
    mineVisits: s.mineVisits || 0,
    bossKills: s.bossKills || 0,
    questSteps: achQuestStepsDone(),
    farmPower: typeof avatarFarmPower === "function" ? avatarFarmPower() : 0,
    chapter1Complete,
    maxPlus: maxWeaponPlus(),
    maxAPlus: achMaxGradePlus("A"),
    tries: t.tries || 0,
    fails: t.fails || 0,
    earned: t.earned || 0,
    gnomesCaught: s.gnomesCaught || 0,
    goldenGnomes: s.goldenGnomes || 0,
    bananWins: s.bananWins || 0,
    funpayWins: s.funpayWins || 0,
    weaponsSold: s.weaponsSold || 0,
    weaponsBroken: s.weaponsBroken || 0,
    maxSoldPlus: s.maxSoldPlus || 0,
    crystalsSold: s.crystalsSold || 0,
    shotsCrafted: s.shotsCrafted || 0,
    shotsSold: s.shotsSold || 0,
    oreSoulBought: s.oreSoulBought || 0,
    invFullOnce: s.invFullOnce || 0,
    soulOre: m.soul || 0,
    spiritOre: m.spirit || 0,
    totalCrystals: achTotalCrystals(),
    invWeapons: achInventoryWeapons(),
    recordsCount: achRecordsCount(),
    collD: achUniqueWeaponsByGrade("D"),
    collC: achUniqueWeaponsByGrade("C"),
    collB: achUniqueWeaponsByGrade("B"),
    collA: achUniqueWeaponsByGrade("A"),
    collDTotal: achGradeWeaponCatalog("D").length,
    collCTotal: achGradeWeaponCatalog("C").length,
    collBTotal: achGradeWeaponCatalog("B").length,
    collATotal: achGradeWeaponCatalog("A").length,
    aGradeCollectionComplete: achAllGradeCollected("A"),
    hasZaken: hasZakenCollectible(),
    mineGuardPenalties: s.mineGuardPenalties || 0,
    mineGuardSynthetic: s.mineGuardSynthetic || 0,
    gnomesMissed: s.gnomesMissed || 0,
    bananEscaped: s.bananEscaped || 0,
    nightEnchants: s.nightEnchants || 0,
    storyElvenRuins: !!(state.storyProgress?.chaptersSeen?.elven_ruins),
    storyOrcBarracks: !!(state.storyProgress?.chaptersSeen?.orc_barracks),
    storyDarkCavern: !!(state.storyProgress?.chaptersSeen?.dark_cavern),
    storyDwarvenDepths: !!(state.storyProgress?.chaptersSeen?.dwarven_depths),
    storyChaptersRead: state.storyProgress?.chaptersSeen
      ? Object.keys(state.storyProgress.chaptersSeen).filter((k) => state.storyProgress.chaptersSeen[k]).length
      : 0,
    preludeChaptersComplete: typeof preludeChaptersCompleteCount === "function" ? preludeChaptersCompleteCount() : 0,
    preludeFinaleSeen: !!(state.storyProgress?.preludeFinaleSeen),
  };
}

function formatAchReward(reward) {
  if (!reward) return "";
  const parts = [];
  if (reward.adena) parts.push(fmtAdena(playtestIncome(reward.adena)) + " adena");
  if (reward.ore) {
    if (reward.ore.soul) parts.push("Soul Ore ×" + fmt(reward.ore.soul));
    if (reward.ore.spirit) parts.push("Spirit Ore ×" + fmt(reward.ore.spirit));
  }
  if (reward.collectible && typeof COLLECTIBLES !== "undefined") {
    const def = COLLECTIBLES[reward.collectible];
    if (def) parts.push(def.name);
  }
  return parts.join(" · ");
}

function grantAchReward(reward) {
  if (!reward) return;
  ensureWorkshopState();
  // Adena ачивок не идёт в totals.earned — иначе rich* фармятся сами с себя
  if (reward.adena) {
    const adena = playtestIncome(reward.adena);
    ProgressStore.update("adena", (a) => (a || 0) + adena);
  }
  if (reward.ore) {
    ProgressStore.update("materials", (m) => ({
      ...(m || { soul: 0, spirit: 0 }),
      soul: (m?.soul || 0) + (reward.ore?.soul || 0),
      spirit: (m?.spirit || 0) + (reward.ore?.spirit || 0),
    }));
  }
  if (reward.collectible && typeof grantCollectible === "function") {
    grantCollectible(reward.collectible, reward.collectibleQty || 1);
  }
}

function toastAchievement(ach) {
  const rw = formatAchReward(ach.reward);
  gameLog((ach.hidden ? "Секретное достижение: " : "Достижение: ") + ach.title + (rw ? " (" + rw + ")" : ""), "gold");
}

let gamePaused = false;
let gamePauseDepth = 0;
let achModalQueue = [];
let achModalDraining = false;
let achModalKeyHandler = null;

const OVERLAY_OK_ARM_MS = 650;

function armOverlayOkButton(btn, lockedClass, ms) {
  if (!btn) return;
  const delay = ms == null ? OVERLAY_OK_ARM_MS : ms;
  if (btn._armTimer) clearTimeout(btn._armTimer);
  btn.classList.add(lockedClass);
  btn.setAttribute("aria-disabled", "true");
  btn._armTimer = setTimeout(() => {
    btn._armTimer = null;
    btn.classList.remove(lockedClass);
    btn.removeAttribute("aria-disabled");
  }, delay);
}

function isOverlayOkLocked(btn, lockedClass) {
  return !!(btn && btn.classList.contains(lockedClass));
}

function isGamePaused() {
  return gamePaused;
}

function isBlockingOverlayOpen() {
  const ids = [
    "storyBackdrop",
    "modalBackdrop",
    "achModalBackdrop",
    "achRewardBackdrop",
    "avatarSetupBackdrop",
    "avatarEquipBackdrop",
  ];
  return ids.some((id) => {
    const el = document.getElementById(id);
    return el && !el.hidden;
  });
}

function syncGamePauseState() {
  const shouldPause = isBlockingOverlayOpen() || achModalDraining;
  gamePauseDepth = shouldPause ? 1 : 0;
  const wasPaused = gamePaused;
  gamePaused = shouldPause;
  document.body.classList.toggle("game-paused", shouldPause);

  if (shouldPause && !wasPaused && typeof autoClickerFreezeForPause === "function") {
    autoClickerFreezeForPause();
  } else if (!shouldPause && wasPaused && typeof autoClickerResumeFromPause === "function") {
    autoClickerResumeFromPause();
  }

  if (typeof mineActive !== "undefined" && mineActive) {
    if (shouldPause) {
      if (!mineOverlayPaused && typeof pauseMineForOverlay === "function") pauseMineForOverlay();
    } else if (mineOverlayPaused && typeof resumeMineFromOverlay === "function") {
      resumeMineFromOverlay();
    } else if (typeof ensureMineSpawning === "function") {
      ensureMineSpawning();
    }
  } else {
    if (shouldPause && !wasPaused && typeof pauseMineForOverlay === "function") pauseMineForOverlay();
    else if (!shouldPause && wasPaused && typeof resumeMineFromOverlay === "function") resumeMineFromOverlay();
  }
}

function setGamePaused(paused) {
  if (paused) {
    gamePauseDepth++;
    if (gamePauseDepth > 1) return;
    gamePaused = true;
    document.body.classList.add("game-paused");
    if (typeof autoClickerFreezeForPause === "function") autoClickerFreezeForPause();
    if (typeof pauseMineForOverlay === "function") pauseMineForOverlay();
    return;
  }
  if (typeof syncGamePauseState === "function") {
    syncGamePauseState();
    return;
  }
  gamePauseDepth = Math.max(0, gamePauseDepth - 1);
  if (gamePauseDepth > 0) return;
  gamePaused = false;
  document.body.classList.remove("game-paused");
  if (typeof autoClickerResumeFromPause === "function") autoClickerResumeFromPause();
  if (typeof resumeMineFromOverlay === "function") resumeMineFromOverlay();
}

function achModalIcon(ach) {
  if (ach.hidden && !state.achievements?.unlocked?.[ach.id]) return ACH_SECRET_ICON;
  return resolveAchIcon(ach);
}

function presentAchievementModal(ach, remaining) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById("achModalBackdrop");
    const box = backdrop && backdrop.querySelector(".ach-modal-box");
    const ico = document.getElementById("achModalIco");
    const kicker = document.getElementById("achModalKicker");
    const title = document.getElementById("achModalTitle");
    const desc = document.getElementById("achModalDesc");
    const reward = document.getElementById("achModalReward");
    const queue = document.getElementById("achModalQueue");
    const okBtn = document.getElementById("achModalOk");
    const badge = document.getElementById("achModalBadge");
    if (!backdrop || !ico || !title || !desc || !okBtn) { resolve(); return; }

    const rw = formatAchReward(ach.reward);
    const secret = !!ach.hidden;
    if (box) box.classList.toggle("secret", secret);
    if (badge) badge.textContent = secret ? "🔮" : "🏆";
    if (kicker) kicker.textContent = secret ? "Секретное достижение!" : "Поздравляем!";
    ico.src = achModalIcon(ach);
    ico.onerror = () => { ico.src = ACH_ICON; };
    title.textContent = ach.title;
    desc.textContent = ach.desc;
    if (reward) reward.textContent = rw ? "Награда: " + rw : "";
    if (queue) {
      queue.hidden = remaining <= 0;
      queue.textContent = remaining > 0 ? "Ещё " + remaining + " " + (remaining === 1 ? "достижение" : remaining < 5 ? "достижения" : "достижений") : "";
    }

    const close = () => {
      backdrop.hidden = true;
      if (achModalKeyHandler) {
        document.removeEventListener("keydown", achModalKeyHandler);
        achModalKeyHandler = null;
      }
      okBtn.onclick = null;
      backdrop.onclick = null;
      resolve();
    };

    achModalKeyHandler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (isOverlayOkLocked(okBtn, "ach-modal-btn--locked")) return;
        Audio2.click();
        close();
      }
    };
    okBtn.onclick = () => {
      if (isOverlayOkLocked(okBtn, "ach-modal-btn--locked")) return;
      Audio2.click();
      close();
    };
    // Закрытие только по кнопке (и Enter) — клик по пустому фону не закрывает.
    backdrop.onclick = null;
    document.addEventListener("keydown", achModalKeyHandler);
    backdrop.hidden = false;
    armOverlayOkButton(okBtn, "ach-modal-btn--locked");
    if (typeof Audio2 !== "undefined") {
      if (secret && Audio2.jackpot) Audio2.jackpot();
      else if (Audio2.success) Audio2.success();
    }
    okBtn.focus();
  });
}

function presentAchievementReward(ach) {
  const src = (ach && ach.rewardImage) || ACH_REWARD_IMAGE;
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const backdrop = document.getElementById("achRewardBackdrop");
    const img = document.getElementById("achRewardImg");
    const title = document.getElementById("achRewardTitle");
    const desc = document.getElementById("achRewardDesc");
    const kicker = document.getElementById("achRewardKicker");
    const okBtn = document.getElementById("achRewardOk");
    if (!backdrop || !img || !okBtn) { resolve(); return; }

    if (kicker) kicker.textContent = "🔮 Секретная награда";
    if (title) title.textContent = (ach && ach.title) || "Секретная награда";
    if (desc) desc.textContent = (ach && ach.desc) || "Ты открыл все обычные достижения.";
    img.hidden = false;
    img.src = src;

    let keyHandler = null;
    const close = () => {
      backdrop.hidden = true;
      img.src = "";
      if (keyHandler) document.removeEventListener("keydown", keyHandler);
      okBtn.onclick = null;
      backdrop.onclick = null;
      resolve();
    };

    keyHandler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (isOverlayOkLocked(okBtn, "ach-reward-btn--locked")) return;
        Audio2.click();
        close();
      }
    };
    okBtn.onclick = () => {
      if (isOverlayOkLocked(okBtn, "ach-reward-btn--locked")) return;
      Audio2.click();
      close();
    };
    // Закрытие только по кнопке (и Enter) — клик по пустому фону не закрывает.
    backdrop.onclick = null;
    document.addEventListener("keydown", keyHandler);
    backdrop.hidden = false;
    armOverlayOkButton(okBtn, "ach-reward-btn--locked");
    if (typeof Audio2 !== "undefined" && Audio2.jackpot) Audio2.jackpot();
    okBtn.focus();
  });
}

async function drainAchievementModals() {
  if (achModalDraining || !achModalQueue.length) return;
  achModalDraining = true;
  syncGamePauseState();
  while (achModalQueue.length) {
    const ach = achModalQueue.shift();
    const remaining = achModalQueue.length;
    await presentAchievementModal(ach, remaining);
    if (ach.rewardImage) await presentAchievementReward(ach);
  }
  achModalDraining = false;
  syncGamePauseState();
}

function enqueueAchievementModals(list) {
  if (!list.length) return;
  achModalQueue.push(...list);
  drainAchievementModals();
}

function notifyAchievements(list, opts) {
  if (!list.length) return;
  if (opts?.silent) return;
  list.forEach((a) => toastAchievement(a));
  enqueueAchievementModals(list);
}

function checkAchievements(opts) {
  ensureAchievementsState();
  const ctx = achievementContext();
  const newly = [];
  for (const ach of ALL_ACHIEVEMENTS) {
    if (state.achievements.unlocked[ach.id]) continue;
    if (!ach.test(ctx)) continue;
    state.achievements.unlocked[ach.id] = Date.now();
    grantAchReward(ach.reward);
    newly.push(ach);
  }
  // Dev QA-чеклист: без наград и без модалок игроку
  checkPlaytestChecklist(ctx);
  if (newly.length) {
    save();
    $("#adena").textContent = fmt(state.adena);
    notifyAchievements(newly, opts);
    renderMenu();
    const achScreen = $("#screen-ach");
    const invScreen = $("#screen-inv");
    if (achScreen?.classList.contains("active")) renderAchievements();
    if (invScreen?.classList.contains("active")) renderInventory();
  }
  return newly;
}

function checkPlaytestChecklist(ctx) {
  if (!FEATURE_DEV_PANEL) return;
  ensureAchievementsState();
  let changed = false;
  for (const ach of PLAYTEST_CHECKLIST) {
    if (state.achievements.unlocked[ach.id]) continue;
    if (!ach.test(ctx)) continue;
    state.achievements.unlocked[ach.id] = Date.now();
    changed = true;
  }
  if (changed && typeof renderDevSecretAchievements === "function") renderDevSecretAchievements();
}

function refreshAchievementUi() {
  renderMenu();
  const achScreen = $("#screen-ach");
  const invScreen = $("#screen-inv");
  if (achScreen?.classList.contains("active")) renderAchievements();
  if (invScreen?.classList.contains("active")) renderInventory();
  if (typeof renderDevSecretAchievements === "function") renderDevSecretAchievements();
}

function devUnlockAchievement(id, opts) {
  if (!FEATURE_DEV_PANEL) return null;
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id) || PLAYTEST_CHECKLIST.find((a) => a.id === id);
  if (!ach) return null;
  ensureAchievementsState();
  if (state.achievements.unlocked[id]) return null;
  state.achievements.unlocked[id] = Date.now();
  if (!opts?.skipReward) grantAchReward(ach.reward);
  save();
  $("#adena").textContent = fmt(state.adena);
  if (!opts?.deferUi) refreshAchievementUi();
  if (!opts?.silent) enqueueAchievementModals([ach]);
  return ach;
}

function devUnlockAllHiddenAchievements(opts) {
  if (!FEATURE_DEV_PANEL) return [];
  const list = [];
  for (const ach of HIDDEN_ACHIEVEMENTS) {
    const u = devUnlockAchievement(ach.id, { silent: true, skipReward: opts?.skipReward, deferUi: true });
    if (u) list.push(u);
  }
  if (list.length) {
    refreshAchievementUi();
    if (!opts?.silent) notifyAchievements(list, opts);
  }
  return list;
}

function devResetHiddenAchievements() {
  if (!FEATURE_DEV_PANEL) return;
  ensureAchievementsState();
  HIDDEN_ACHIEVEMENTS.forEach((a) => delete state.achievements.unlocked[a.id]);
  save();
  refreshAchievementUi();
}

function devResetAllAchievements() {
  if (!FEATURE_DEV_PANEL) return;
  ensureAchievementsState();
  state.achievements.unlocked = {};
  save();
  refreshAchievementUi();
  toast("Dev: все достижения сброшены", "warn");
}

function devGrantAchStat(key, amount) {
  if (!FEATURE_DEV_PANEL) return;
  achStat(key, Math.max(0, Math.round(Number(amount) || 0)));
  checkAchievements();
  refreshAchievementUi();
}

function devUnlockPlaytestAchievements() {
  if (!FEATURE_DEV_PANEL) return 0;
  ensureAchievementsState();
  let n = 0;
  PLAYTEST_CHECKLIST.forEach((a) => {
    if (state.achievements.unlocked[a.id]) return;
    state.achievements.unlocked[a.id] = Date.now();
    n++;
  });
  if (n) {
    save();
    refreshAchievementUi();
  }
  return n;
}

function playtestAchievementsProgress() {
  const list = PLAYTEST_CHECKLIST;
  ensureAchievementsState();
  const done = list.filter((a) => state.achievements.unlocked[a.id]).length;
  return { done, total: list.length };
}
