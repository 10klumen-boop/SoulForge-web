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
    pvpWins: s.pvpWins || 0,
    pvpLosses: s.pvpLosses || 0,
    pvpAsyncWins: s.pvpAsyncWins || 0,
    pvpDuelWins: s.pvpDuelWins || 0,
    pvpRating: s.pvpRating || 1000,
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
    storyChaptersRead:
      typeof storyChaptersDoneCount === "function"
        ? storyChaptersDoneCount()
        : state.storyProgress?.chaptersSeen
          ? Object.keys(state.storyProgress.chaptersSeen).filter((k) => {
              if (!state.storyProgress.chaptersSeen[k]) return false;
              const z = typeof farmZoneById === "function" ? farmZoneById(k) : null;
              return !!(z && !z.side);
            }).length
          : 0,
    preludeChaptersComplete: typeof preludeChaptersCompleteCount === "function" ? preludeChaptersCompleteCount() : 0,
    preludeFinaleSeen: !!(state.storyProgress?.preludeFinaleSeen),
  };
}

function formatAchReward(reward) {
  if (!reward) return "";
  const parts = [];
  if (reward.adena) {
    const adena =
      typeof economyScaleAchAdena === "function"
        ? economyScaleAchAdena(reward.adena)
        : reward.adena;
    parts.push(fmtAdena(playtestIncome(adena)) + " adena");
  }
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
    const raw =
      typeof economyScaleAchAdena === "function"
        ? economyScaleAchAdena(reward.adena)
        : reward.adena;
    const adena = playtestIncome(raw);
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

const OVERLAY_OK_ARM_MS = 650;
const ACH_TOAST_MS = 4200;
const ACH_TOAST_STAGGER_MS = 380;
const ACH_TOAST_MAX = 3;

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
    "avatarSetupBackdrop",
    "avatarEquipBackdrop",
  ];
  return ids.some((id) => {
    const el = document.getElementById(id);
    return el && !el.hidden;
  });
}

function syncGamePauseState() {
  const shouldPause = isBlockingOverlayOpen();
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

function ensureAchToastHost() {
  let host = document.getElementById("achToastHost");
  if (host) return host;
  const actions = document.querySelector(".topbar-actions");
  if (!actions) return null;
  host = document.createElement("div");
  host.id = "achToastHost";
  host.className = "ach-toast-host";
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-relevant", "additions");
  actions.insertBefore(host, actions.firstChild);
  return host;
}

function dismissAchToast(el) {
  if (!el || el._achDismissing) return;
  el._achDismissing = true;
  if (el._dismissTimer) {
    clearTimeout(el._dismissTimer);
    el._dismissTimer = null;
  }
  el.classList.add("ach-toast--out");
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 320);
}

function mountAchToast(el, ms) {
  const host = ensureAchToastHost();
  if (!host) return;
  host.appendChild(el);
  while (host.children.length > ACH_TOAST_MAX) {
    dismissAchToast(host.firstElementChild);
  }
  requestAnimationFrame(() => el.classList.add("ach-toast--in"));
  el.addEventListener("click", () => dismissAchToast(el));
  el._dismissTimer = setTimeout(() => dismissAchToast(el), ms == null ? ACH_TOAST_MS : ms);
}

function presentAchievementToast(ach) {
  const secret = !!ach.hidden;
  const rw = formatAchReward(ach.reward);
  const el = document.createElement("div");
  el.className = "ach-toast" + (secret ? " secret" : "");
  el.setAttribute("role", "status");
  el.innerHTML =
    '<div class="ach-toast-rays" aria-hidden="true"></div>' +
    '<div class="ach-toast-shine" aria-hidden="true"></div>' +
    '<img class="ach-toast-ico" alt="">' +
    '<div class="ach-toast-body">' +
      '<div class="ach-toast-kicker"></div>' +
      '<div class="ach-toast-title"></div>' +
      (rw ? '<div class="ach-toast-reward"></div>' : "") +
    "</div>";
  const ico = el.querySelector(".ach-toast-ico");
  ico.src = achModalIcon(ach);
  ico.onerror = () => { ico.src = ACH_ICON; };
  el.querySelector(".ach-toast-kicker").textContent = secret ? "Секретное достижение" : "Достижение";
  el.querySelector(".ach-toast-title").textContent = ach.title || "";
  const rewardEl = el.querySelector(".ach-toast-reward");
  if (rewardEl) rewardEl.textContent = rw;
  if (typeof Audio2 !== "undefined") {
    if (secret && Audio2.jackpot) Audio2.jackpot();
    else if (Audio2.success) Audio2.success();
  }
  mountAchToast(el, ACH_TOAST_MS);
}

function presentAchievementRewardToast(ach) {
  const src = (ach && ach.rewardImage) || ACH_REWARD_IMAGE;
  if (!src) return;
  const el = document.createElement("div");
  el.className = "ach-toast ach-toast--reward secret";
  el.setAttribute("role", "status");
  el.innerHTML =
    '<div class="ach-toast-rays" aria-hidden="true"></div>' +
    '<div class="ach-toast-shine" aria-hidden="true"></div>' +
    '<div class="ach-toast-body">' +
      '<div class="ach-toast-kicker">Секретная награда</div>' +
      '<div class="ach-toast-title"></div>' +
      '<img class="ach-toast-reward-img" alt="">' +
    "</div>";
  el.querySelector(".ach-toast-title").textContent = (ach && ach.title) || "Секретная награда";
  const img = el.querySelector(".ach-toast-reward-img");
  img.src = src;
  if (typeof Audio2 !== "undefined" && Audio2.jackpot) Audio2.jackpot();
  mountAchToast(el, 5000);
}

function enqueueAchievementModals(list) {
  if (!list.length) return;
  list.forEach((ach, i) => {
    setTimeout(() => {
      presentAchievementToast(ach);
      if (ach.rewardImage) {
        setTimeout(() => presentAchievementRewardToast(ach), 220);
      }
    }, i * ACH_TOAST_STAGGER_MS);
  });
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
