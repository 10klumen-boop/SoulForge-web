// ===== Clan boss: shared HP mine session (фаза D) =====

let clanBossStateCache = null;
let clanBossPollTimer = null;
let clanBossHitBusy = false;
let clanBossHitQueue = [];
let clanBossDomMob = null;
let clanBossSessionActive = false;
let clanBossEndPrompted = false;

function isClanBossSessionActive() {
  return !!(typeof mineActive !== "undefined" && mineActive && clanBossSessionActive);
}

function clanBossShouldBlockLocalSpawn() {
  return isClanBossSessionActive();
}

async function clanBossApi(path, opts) {
  if (typeof clanApi === "function") return clanApi(path, opts);
  if (typeof chatApi === "function") return chatApi(path, opts);
  return { ok: false, error: "no_api", message: "Нет связи" };
}

async function clanRefreshBoss() {
  if (typeof clanCloudReady === "function" && !clanCloudReady()) {
    clanBossStateCache = null;
    return { ok: false };
  }
  if (typeof getChatClan === "function" && !getChatClan()) {
    clanBossStateCache = null;
    return { ok: false };
  }
  try {
    const r = await clanBossApi("/chat/clan/boss", { method: "GET" });
    if (r && r.ok) clanBossStateCache = r;
    return r || { ok: false };
  } catch (_) {
    return { ok: false, offline: true };
  }
}

function clanBossFmtMs(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

function clanBossClearDomMob() {
  if (clanBossDomMob) {
    try {
      if (typeof removeGnome === "function") removeGnome(clanBossDomMob);
      else clanBossDomMob.remove();
    } catch (_) {}
    clanBossDomMob = null;
  }
}

function clanBossSprite(st, boss) {
  const slug = (st && st.mob) || (boss && boss.mob) || "clan-oathkeeper";
  if (typeof mob === "function") {
    const s = mob(slug, "target-elite target-boss clan-raid-boss");
    // cache-bust после вырезания фона
    if (s && s.src && s.src.indexOf("clan-oathkeeper") !== -1) {
      s.src = s.src.replace(/(\?v=\d+)?$/, "") + "?v=5";
    }
    return s;
  }
  const src = "assets/mobs/" + slug + ".png?v=5";
  return {
    src,
    kind: "sprite",
    anim: "idle",
    cls: "target-elite target-boss clan-raid-boss",
    label: (boss && (boss.labelRu || boss.name)) || "Хранитель Клятвы",
  };
}

function ensureClanBossHud() {
  return document.getElementById("clanBossHud");
}

function removeClanBossHud() {
  const hud = document.getElementById("clanBossHud");
  if (hud) hud.remove();
}

function syncClanBossHud(_payload) {
  // Верхняя табличка рейда отключена — HP уже на полоске у спрайта.
  // Не создавать пустой .instance-hud: display:flex перебивает [hidden].
  removeClanBossHud();
}

function spawnClanBossMob(payload) {
  const field = document.getElementById("mineStageInner") || document.getElementById("minefield");
  if (!field || typeof spawnSoloMob !== "function") return;
  const st = payload?.run || clanBossStateCache?.run;
  const boss = payload?.boss || clanBossStateCache?.boss || {};
  if (!st) return;

  if (
    clanBossDomMob &&
    typeof mineGnomes !== "undefined" &&
    mineGnomes.has(clanBossDomMob)
  ) {
    clanBossDomMob._maxHp = st.maxHp;
    clanBossDomMob._hp = Math.max(0, st.hp);
    if (typeof updateMobHpBar === "function") updateMobHpBar(clanBossDomMob);
    return;
  }

  clanBossClearDomMob();
  const before = typeof mineGnomes !== "undefined" ? mineGnomes.size : 0;
  const fw = field.clientWidth || field.offsetWidth || 0;
  const fh = field.clientHeight || field.offsetHeight || 0;
  const cx = fw ? Math.round(fw / 2) : null;
  const cy = fh ? Math.round(fh * 0.56) : null;
  spawnSoloMob(field, "boss", {
    name: st.bossName || boss.name || "Клан-босс",
    sprite: clanBossSprite(st, boss),
    noTimer: true,
    center: !(cx != null && cy != null),
    x: cx != null ? cx : undefined,
    y: cy != null ? cy : undefined,
  });
  let newest = null;
  if (typeof mineGnomes !== "undefined") {
    mineGnomes.forEach((g) => {
      newest = g;
    });
  }
  if (!newest || (typeof mineGnomes !== "undefined" && mineGnomes.size <= before)) return;
  newest._clanBossEncounter = true;
  newest.classList.add("clan-raid-boss");
  newest._maxHp = st.maxHp;
  newest._hp = Math.max(0, st.hp);
  if (cx != null && cy != null) {
    newest.style.left = cx + "px";
    newest.style.top = cy + "px";
    newest._x = cx;
    newest._y = cy;
  }
  if (typeof clearMobTimer === "function") clearMobTimer(newest);
  newest._onExpire = null;
  if (typeof updateMobHpBar === "function") updateMobHpBar(newest);
  clanBossDomMob = newest;
}

function startClanBossPoll() {
  stopClanBossPoll();
  clanBossPollTimer = setInterval(async () => {
    if (!clanBossSessionActive) return;
    const r = await clanBossApi("/chat/clan/boss", { method: "GET" });
    if (!r || !r.ok) return;
    clanBossStateCache = r;
    syncClanBossHud(r);
    spawnClanBossMob(r);
    if (r.run && r.run.status !== "active" && !clanBossEndPrompted) {
      clanBossEndPrompted = true;
      finishClanBossSession(r);
    }
  }, 500);
}

function stopClanBossPoll() {
  if (clanBossPollTimer) {
    clearInterval(clanBossPollTimer);
    clanBossPollTimer = null;
  }
}

async function enterClanBossMine(payload) {
  if (typeof clearExclusiveMineOverlays === "function") clearExclusiveMineOverlays("clanBoss");
  const run = payload?.run;
  const boss = payload?.boss || (typeof CLAN_BOSS !== "undefined" ? CLAN_BOSS : {});
  const mineCfg = (run && run.mine) || boss.mine || {};
  clanBossStateCache = payload;
  clanBossEndPrompted = false;

  const panelTitle = document.getElementById("minePanelTitle");
  if (panelTitle) panelTitle.textContent = boss.name || run?.bossName || "Клан-босс";
  const bgPool = mineCfg.bgs && mineCfg.bgs.length ? mineCfg.bgs : ["assets/locations/crimson-howl-gorge.jpg"];
  const bgRaw = bgPool[0];
  const img = document.getElementById("mineBgImg");
  if (img) {
    const url = typeof mineAssetUrl === "function" ? mineAssetUrl(bgRaw) : bgRaw;
    img.removeAttribute("src");
    img.src = url;
  }
  if (typeof applyMineStageVisual === "function") {
    applyMineStageVisual(
      {
        overlay: mineCfg.overlay || "mine-zone-elven",
        bgs: bgPool,
        title: boss.name,
        bgCover: true,
      },
      "clan_boss"
    );
  }
  const hintEl = document.getElementById("mineHint");
  if (hintEl) {
    hintEl.textContent = "";
    hintEl.style.display = "none";
  }

  mineActive = true;
  mineOverlayPaused = false;
  clanBossSessionActive = true;
  if (typeof stopAutoClickerLoop === "function") stopAutoClickerLoop();
  mineSession = {
    startedAt: Date.now(),
    adena0: Math.max(0, Math.floor(Number(state.adena) || 0)),
    kills: 0,
    weapons: 0,
    zoneId: "clan_boss",
    clanBoss: true,
    loot: {},
  };
  mineSessionLootOpen = false;
  if (typeof resetMineGuardSession === "function") resetMineGuardSession();
  if (typeof resetMineSkillRuntime === "function") resetMineSkillRuntime();
  const earned = document.getElementById("mineEarned");
  const caught = document.getElementById("mineCaught");
  const missed = document.getElementById("mineMissed");
  if (earned) earned.textContent = "0";
  if (caught) caught.textContent = "0";
  if (missed) missed.textContent = "0";
  if (typeof renderMineSessionLoot === "function") renderMineSessionLoot();
  if (typeof renderMineHudStats === "function") renderMineHudStats();
  if (typeof renderMineSkillBar === "function") renderMineSkillBar();
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
  if (typeof syncMineShotHud === "function") syncMineShotHud();
  const storyBar = document.getElementById("mineStoryBar");
  if (storyBar) storyBar.hidden = true;
  const questHud = document.getElementById("mineQuestHud");
  if (questHud) questHud.hidden = true;
  // Оставляем HUD для сосок; прячем только фарм-статы сессии.
  const mineHud = document.querySelector("#screen-mine .mine-hud");
  if (mineHud) mineHud.hidden = false;
  const farmStats = document.querySelector("#screen-mine .mine-farm-stats");
  if (farmStats) farmStats.hidden = true;
  const sessionLoot = document.getElementById("mineSessionLoot");
  if (sessionLoot) sessionLoot.hidden = true;
  const resourceFav = document.getElementById("mineResourceFav");
  if (resourceFav) resourceFav.hidden = true;
  const territoryHud = document.getElementById("mineClanTerritoryHud");
  if (territoryHud) {
    territoryHud.hidden = true;
    territoryHud.textContent = "";
  }
  if (typeof show === "function") show("mine");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  clearInterval(mineTimer);
  mineTimer = null;
  if (typeof cancelMineSpawnQueue === "function") cancelMineSpawnQueue();
  spawnClanBossMob(payload);
  syncClanBossHud(payload);
  startClanBossPoll();
}

async function startOrJoinClanBoss() {
  if (typeof clanCloudReady === "function" && !clanCloudReady()) {
    if (typeof toast === "function") toast("Нужен вход в облако", "warn");
    return;
  }
  let r = await clanBossApi("/chat/clan/boss", { method: "GET" });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Ошибка", "warn");
    return;
  }
  if (r.locked && !(r.run && r.run.status === "active")) {
    if (typeof toast === "function") toast("Клан-босс уже пройден на этой неделе", "warn");
    return;
  }
  if (r.run && r.run.status === "active") {
    if (!r.run.inRun) {
      r = await clanBossApi("/chat/clan/boss/join", { method: "POST", body: {} });
      if (!r.ok) {
        if (typeof toast === "function") toast(r.message || r.error || "Не удалось войти", "warn");
        return;
      }
    }
  } else {
    r = await clanBossApi("/chat/clan/boss/start", { method: "POST", body: {} });
    if (!r.ok) {
      if (typeof toast === "function") toast(r.message || r.error || "Не удалось начать", "warn");
      return;
    }
  }
  clanBossStateCache = r;
  await enterClanBossMine(r);
}

function clanBossEscHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clanBossRewardSummary(r) {
  const run = r?.run || {};
  const boss = r?.boss || (typeof CLAN_BOSS !== "undefined" ? CLAN_BOSS : {});
  const reward = run.reward || {};
  const marks =
    reward.raidMarksEach != null
      ? reward.raidMarksEach
      : boss.rewardOathSymbol != null
        ? boss.rewardOathSymbol
        : boss.rewardRaidMarks != null
          ? boss.rewardRaidMarks
          : typeof CLAN_BOSS !== "undefined"
            ? CLAN_BOSS.rewardRaidMarks
            : 50;
  const marksLabel =
    reward.raidMarksLabelRu ||
    r?.oathSymbolLabelRu ||
    r?.raidMarksLabelRu ||
    boss.rewardRaidMarksLabelRu ||
    (typeof OATH_SYMBOL !== "undefined" ? OATH_SYMBOL.nameRu : null) ||
    (typeof CLAN_BOSS !== "undefined" ? CLAN_BOSS.rewardRaidMarksLabelRu : null) ||
    "Символ Клятвы";
  const wh =
    reward.warehouseAdena != null
      ? reward.warehouseAdena
      : boss.rewardAdenaWarehouse != null
        ? boss.rewardAdenaWarehouse
        : typeof CLAN_BOSS !== "undefined"
          ? CLAN_BOSS.rewardAdenaWarehouse
          : 0;
  const oathIcon =
    (typeof OATH_SYMBOL !== "undefined" && OATH_SYMBOL.icon) ||
    "icons/clan/oath_symbol.png?v=1";
  return {
    bossName: boss.name || run.bossName || "Клан-босс",
    marks: Math.max(0, Math.floor(Number(marks) || 0)),
    marksLabel: String(marksLabel),
    marksIcon: oathIcon,
    warehouseAdena: Math.max(0, Math.floor(Number(wh) || 0)),
    warehouseTotal:
      reward.warehouseTotal != null ? Math.max(0, Math.floor(Number(reward.warehouseTotal) || 0)) : null,
    activityScore:
      reward.activity && reward.activity.added != null
        ? Math.max(0, Math.floor(Number(reward.activity.added) || 0))
        : 0,
  };
}

function clanBossClearLootHtml(summary) {
  summary = summary || {};
  const esc = clanBossEscHtml;
  const fmtN = typeof fmt === "function" ? fmt : (n) => String(n);
  const fmtA = typeof fmtAdena === "function" ? fmtAdena : fmtN;
  const parts = [];
  parts.push('<p class="clan-boss-clear-lead"><b>' + esc(summary.bossName || "Клан-босс") + "</b> повержен.</p>");
  parts.push('<div class="clan-boss-clear-loot" role="list">');
  if (summary.marks > 0) {
    parts.push(
      '<div class="clan-boss-drop" role="listitem">' +
        '<img class="clan-boss-drop-ico" src="' +
        esc(summary.marksIcon) +
        '" alt="" draggable="false" />' +
        '<div class="clan-boss-drop-meta">' +
        '<div class="clan-boss-drop-name">' +
        esc(summary.marksLabel) +
        "</div>" +
        '<div class="clan-boss-drop-qty">×' +
        fmtN(summary.marks) +
        ' <span class="clan-boss-drop-tag">в инвентарь</span></div>' +
        "</div></div>"
    );
  }
  if (summary.warehouseAdena > 0) {
    parts.push(
      '<div class="clan-boss-drop" role="listitem">' +
        '<img class="clan-boss-drop-ico" src="icons/warehouse_chest.png?v=1" alt="" draggable="false" />' +
        '<div class="clan-boss-drop-meta">' +
        '<div class="clan-boss-drop-name">Adena · склад клана</div>' +
        '<div class="clan-boss-drop-qty">+' +
        fmtA(summary.warehouseAdena) +
        ' <span class="clan-boss-drop-tag">общий</span></div>' +
        (summary.warehouseTotal != null
          ? '<div class="clan-boss-drop-sub">На складе: ' + fmtA(summary.warehouseTotal) + "</div>"
          : "") +
        "</div></div>"
    );
  }
  if (summary.activityScore > 0) {
    parts.push(
      '<div class="clan-boss-drop clan-boss-drop--soft" role="listitem">' +
        '<div class="clan-boss-drop-ico clan-boss-drop-ico--glyph" aria-hidden="true">★</div>' +
        '<div class="clan-boss-drop-meta">' +
        '<div class="clan-boss-drop-name">Опыт клана</div>' +
        '<div class="clan-boss-drop-qty">+' +
        fmtN(summary.activityScore) +
        "</div></div></div>"
    );
  }
  parts.push("</div>");
  if (!summary.marks && !summary.warehouseAdena && !summary.activityScore) {
    parts.push("<p>Награда уже учтена.</p>");
  }
  return parts.join("");
}

function showClanBossClearModal(summary) {
  summary = summary || {};
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop || typeof renderStoryPanel !== "function") {
    if (typeof toast === "function") {
      toast(
        "Рейд пройден! +" +
          (typeof fmt === "function" ? fmt(summary.marks) : summary.marks) +
          " " +
          (summary.marksLabel || "Символ Клятвы"),
        "success"
      );
    }
    leaveClanBossAfterClear();
    return;
  }
  renderStoryPanel({
    title: "Рейд пройден",
    eyebrow: summary.bossName || "Клан-босс",
    lead: "Дроп за победу",
    chapter: "Клан · рейд",
    icon: summary.marksIcon || "",
    bodyHtml: clanBossClearLootHtml(summary),
    cta: "Забрать",
  });
  backdrop.dataset.storyMode = "clan_boss_clear";
  backdrop.className =
    "story-backdrop race-" +
    ((typeof state !== "undefined" && state.avatar && state.avatar.raceId) || "human") +
    " story-chapter-reward story-clan-boss-clear";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function leaveClanBossAfterClear() {
  if (typeof stopMine === "function") {
    try {
      stopMine();
    } catch (_) {
      clanBossAfterStopMine();
    }
  } else {
    clanBossAfterStopMine();
  }
  if (typeof show === "function") show("clan");
  if (typeof clanRefreshWarehouse === "function") clanRefreshWarehouse();
  if (typeof clanRefreshBuffs === "function") clanRefreshBuffs();
  if (typeof clanRefreshBoss === "function") {
    clanRefreshBoss().then(() => {
      if (document.getElementById("screen-clan-raid")?.classList.contains("active")) {
        if (typeof renderClanRaidScreen === "function") renderClanRaidScreen();
      } else if (typeof renderClanScreen === "function") {
        renderClanScreen();
      }
    });
  } else if (typeof renderClanScreen === "function") {
    renderClanScreen();
  }
}

function dismissClanBossClearModal() {
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    backdrop.hidden = true;
  }
  if (typeof Audio2 !== "undefined") Audio2.click();
  leaveClanBossAfterClear();
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
}

function finishClanBossSession(r) {
  stopClanBossPoll();
  clanBossHitQueue.length = 0;
  const run = r?.run;
  if (run?.status === "cleared") {
    if (run.reward && run.reward.mySave && typeof applyClanSave === "function") {
      applyClanSave(run.reward.mySave);
    } else if (typeof applyClanSave === "function" && r.save) {
      applyClanSave(r.save);
    }
    clanBossClearDomMob();
    removeClanBossHud();
    showClanBossClearModal(clanBossRewardSummary(r));
    return;
  }
  if (run?.status === "failed") {
    if (typeof toast === "function") toast("Время вышло — клан-босс ушёл", "warn");
  }
  leaveClanBossAfterClear();
}

async function clanBossHandleHit(g, opts) {
  if (!clanBossSessionActive || !g || !g._clanBossEncounter) return true;
  if (clanBossEndPrompted) return true;
  clanBossHitQueue.push({ g, opts: opts || {} });
  if (!clanBossHitBusy) flushClanBossHitQueue();
  return true;
}

async function flushClanBossHitQueue() {
  if (clanBossHitBusy) return;
  clanBossHitBusy = true;
  try {
    while (clanBossHitQueue.length && clanBossSessionActive && !clanBossEndPrompted) {
      const job = clanBossHitQueue.shift();
      if (!job || !job.g || !job.g._clanBossEncounter) continue;
      await clanBossSendHit(job.g, job.opts || {});
    }
  } finally {
    clanBossHitBusy = false;
    if (clanBossHitQueue.length && clanBossSessionActive && !clanBossEndPrompted) {
      flushClanBossHitQueue();
    }
  }
}

async function clanBossSendHit(g, opts) {
  const dmgRaw =
    typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 100;
  const dmgCap =
    typeof CLAN_BOSS !== "undefined" && CLAN_BOSS.hitDmgMax != null
      ? CLAN_BOSS.hitDmgMax
      : 50000;
  let dmg = Math.max(1, Math.floor(Number(dmgRaw) || 1));
  if (!opts.bySkill && typeof mineSkillClickMult === "function") {
    dmg = Math.max(1, Math.round(dmg * mineSkillClickMult()));
  }
  if (typeof passiveEffectMult === "function") {
    dmg = Math.max(
      1,
      Math.round(dmg * passiveEffectMult("farmDamageMult", typeof state !== "undefined" ? state.avatar : null))
    );
  }
  if (opts.skillMult) {
    dmg = Math.max(1, Math.round(dmg * (Number(opts.skillMult) || 1)));
  }
  if (typeof applyMineShotDamageMult === "function") {
    dmg = applyMineShotDamageMult(dmg);
  }
  dmg = Math.max(1, Math.min(dmgCap, Math.floor(dmg)));

  const dropAt =
    typeof gnomeDropPoint === "function" ? gnomeDropPoint(g) : { x: g._x || 0, y: g._y || 0 };
  const r = await clanBossApi("/chat/clan/boss/hit", {
    method: "POST",
    body: { dmg },
  });
  if (r && r.ok && !r.throttled) {
    clanBossStateCache = r;
    const st = r.run;
    if (st && g) {
      g._maxHp = st.maxHp;
      g._hp = Math.max(0, st.hp);
      if (typeof updateMobHpBar === "function") updateMobHpBar(g);
    }
    if (typeof Audio2 !== "undefined" && Audio2.mineHit) Audio2.mineHit();
    g.classList.add("mob-hit");
    setTimeout(() => g.classList.remove("mob-hit"), 90);
    const dmgLabel = typeof fmtCombat === "function" ? fmtCombat(dmg) : String(dmg);
    if (typeof floatText === "function") {
      floatText(
        dropAt.x + (Math.random() - 0.5) * 28,
        dropAt.y - 12 - Math.random() * 18,
        "-" + dmgLabel,
        opts && opts.bySkill ? "#9ad4ff" : "#ff9a8a"
      );
    }
    if (typeof mineBurst === "function") {
      mineBurst(dropAt.x, dropAt.y, opts && opts.bySkill ? "#7eb8ff" : "#c8a882", 5);
    }
    syncClanBossHud(r);
    if (st && st.status !== "active" && !clanBossEndPrompted) {
      clanBossEndPrompted = true;
      clanBossHitQueue.length = 0;
      finishClanBossSession(r);
    }
  } else if (r && r.ok) {
    clanBossStateCache = r;
    const st = r.run;
    if (st && g) {
      g._maxHp = st.maxHp;
      g._hp = Math.max(0, st.hp);
      if (typeof updateMobHpBar === "function") updateMobHpBar(g);
    }
    syncClanBossHud(r);
  }
  return true;
}

function clanBossAfterStopMine() {
  clanBossSessionActive = false;
  clanBossEndPrompted = false;
  clanBossHitQueue.length = 0;
  stopClanBossPoll();
  clanBossClearDomMob();
  removeClanBossHud();
  const mineHud = document.querySelector("#screen-mine .mine-hud");
  if (mineHud) mineHud.hidden = false;
  const farmStats = document.querySelector("#screen-mine .mine-farm-stats");
  if (farmStats) farmStats.hidden = false;
  if (typeof clanCloudReady === "function" && clanCloudReady()) {
    clanBossApi("/chat/clan/boss/leave", { method: "POST", body: {} }).catch(() => {});
  }
}
