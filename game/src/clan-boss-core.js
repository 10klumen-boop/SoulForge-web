// ===== Clan boss: shared HP mine session (фаза D) =====

let clanBossStateCache = null;
let clanBossPollTimer = null;
let clanBossHitBusy = false;
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
  const storyBar = document.getElementById("mineStoryBar");
  if (storyBar) storyBar.hidden = true;
  const questHud = document.getElementById("mineQuestHud");
  if (questHud) questHud.hidden = true;
  const mineHud = document.querySelector("#screen-mine .mine-hud");
  if (mineHud) mineHud.hidden = true;
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

function finishClanBossSession(r) {
  stopClanBossPoll();
  const run = r?.run;
  if (run?.status === "cleared") {
    const marks =
      (run.reward && run.reward.raidMarksEach) ||
      (r.boss && r.boss.rewardRaidMarks) ||
      (typeof CLAN_BOSS !== "undefined" ? CLAN_BOSS.rewardRaidMarks : 50);
    const marksLabel =
      (run.reward && run.reward.raidMarksLabelRu) ||
      r.raidMarksLabelRu ||
      (r.boss && r.boss.rewardRaidMarksLabelRu) ||
      (typeof CLAN_BOSS !== "undefined" ? CLAN_BOSS.rewardRaidMarksLabelRu : null) ||
      "Печати Клятвы";
    const wh =
      (run.reward && run.reward.warehouseAdena) ||
      (r.boss && r.boss.rewardAdenaWarehouse) ||
      0;
    if (typeof toast === "function") {
      let msg =
        "Рейд пройден! +" +
        (typeof fmt === "function" ? fmt(marks) : marks) +
        " " +
        marksLabel;
      if (wh > 0) {
        msg +=
          " · +" +
          (typeof fmt === "function" ? fmt(wh) : wh) +
          " adena на склад";
      }
      toast(msg, "success");
    }
    if (typeof clanRefreshWarehouse === "function") clanRefreshWarehouse();
    if (typeof clanRefreshBuffs === "function") clanRefreshBuffs();
  } else if (run?.status === "failed") {
    if (typeof toast === "function") toast("Время вышло — клан-босс ушёл", "warn");
  }
  clanBossAfterStopMine();
  if (typeof show === "function") show("clan");
  if (typeof renderClanScreen === "function") {
    clanRefreshBoss().then(() => {
      if (document.getElementById("screen-clan-raid")?.classList.contains("active")) {
        if (typeof renderClanRaidScreen === "function") renderClanRaidScreen();
      } else if (typeof renderClanScreen === "function") {
        renderClanScreen();
      }
    });
  }
}

async function clanBossHandleHit(g, opts) {
  if (!clanBossSessionActive || !g || !g._clanBossEncounter) return true;
  if (clanBossEndPrompted) return true;
  if (clanBossHitBusy) return true;
  clanBossHitBusy = true;
  try {
    const dmgRaw =
      typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 100;
    const dmgCap =
      typeof CLAN_BOSS !== "undefined" && CLAN_BOSS.hitDmgMax != null
        ? CLAN_BOSS.hitDmgMax
        : 50000;
    let dmg = Math.max(1, Math.min(dmgCap, Math.floor(Number(dmgRaw) || 1)));
    if (opts && opts.skillMult) {
      dmg = Math.max(1, Math.min(dmgCap, Math.round(dmg * (Number(opts.skillMult) || 1))));
    }
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
      const dmgLabel =
        typeof fmtCombat === "function" ? fmtCombat(dmg) : String(dmg);
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
  } finally {
    clanBossHitBusy = false;
  }
  return true;
}

function clanBossAfterStopMine() {
  clanBossSessionActive = false;
  clanBossEndPrompted = false;
  stopClanBossPoll();
  clanBossClearDomMob();
  removeClanBossHud();
  const mineHud = document.querySelector("#screen-mine .mine-hud");
  if (mineHud) mineHud.hidden = false;
  if (typeof clanCloudReady === "function" && clanCloudReady()) {
    clanBossApi("/chat/clan/boss/leave", { method: "POST", body: {} }).catch(() => {});
  }
}
