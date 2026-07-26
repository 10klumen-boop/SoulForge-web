// ===== World boss: соло-рейс по кликам (окно из WORLD_BOSS) =====

let worldBossStateCache = null;
let worldBossPollTimer = null;
let worldBossClickBusy = false;
let worldBossDomMob = null;
let worldBossSessionActive = false;
let worldBossEndPrompted = false;

function isWorldBossSessionActive() {
  return !!(mineActive && worldBossSessionActive);
}

function worldBossCloudReady() {
  return (
    typeof cloudEnabled === "function" &&
    cloudEnabled() &&
    typeof readCloudAuth === "function" &&
    !!readCloudAuth()?.token
  );
}

async function worldBossApi(path, opts) {
  opts = opts || {};
  if (typeof chatApi === "function") return chatApi(path, opts);
  const method = opts.method || "GET";
  const res = await fetch(cloudApiUrl(path), {
    method: method,
    headers: authHeaders(method !== "GET"),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return Object.assign({ ok: false, status: res.status, error: data.error || data.message || "Ошибка" }, data);
  }
  return Object.assign({ ok: true }, data);
}

function worldBossFmtMs(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

function worldBossApplyLoot(loot) {
  if (!loot) return;
  const parts = [];
  if (loot.adena) {
    ProgressStore.update("adena", (a) => Math.max(0, Math.floor(Number(a) || 0) + loot.adena));
    parts.push(loot.adena + " adena");
  }
  if (loot.soul || loot.spirit) {
    ProgressStore.update("materials", (m) => {
      const next = Object.assign({ soul: 0, spirit: 0 }, m || {});
      next.soul = (next.soul || 0) + (loot.soul || 0);
      next.spirit = (next.spirit || 0) + (loot.spirit || 0);
      return next;
    });
    if (loot.soul) parts.push(loot.soul + " Soul");
    if (loot.spirit) parts.push(loot.spirit + " Spirit");
  }
  if (loot.life) {
    ProgressStore.update("crystals", (c) => {
      const next = Object.assign({ D: 0, C: 0, B: 0, A: 0 }, c || {});
      next.C = (next.C || 0) + Math.max(0, Math.floor(Number(loot.life) || 0));
      return next;
    });
    parts.push(loot.life + " Life");
  }
  if (loot.accessoryId && typeof grantCollectible === "function") {
    const def = grantCollectible(loot.accessoryId);
    if (def) parts.push(def.name || loot.accessoryId);
  }
  const shard = loot.shards;
  if (shard && shard.id && shard.qty) {
    const qty = Math.max(0, Math.floor(Number(shard.qty) || 0));
    if (qty > 0) {
      const stack =
        typeof addShardToInventory === "function"
          ? addShardToInventory(shard.id, qty, { silent: true })
          : null;
      const fragName =
        (typeof ACCESSORY_FRAGS !== "undefined" && ACCESSORY_FRAGS[shard.id]?.name) ||
        shard.id;
      if (stack) parts.push(fragName + " ×" + qty);
      else parts.push(fragName + " ×" + qty + " (не влезло в сумку)");
    }
  }
  if (typeof toast === "function") {
    toast(
      parts.length ? "Лут мирового босса: " + parts.join(" · ") : "Лут мирового босса получен",
      "success"
    );
  }
  if (typeof save === "function") save();
}

async function renderWorldBossHub() {
  const body = document.getElementById("worldBossHubBody");
  if (!body) return;
  if (!state.avatar?.created) {
    body.innerHTML = "<p class=\"farm-hub-empty\">Сначала создай персонажа.</p>";
    return;
  }
  if (!worldBossCloudReady()) {
    body.innerHTML =
      "<p class=\"farm-hub-empty\">Нужен вход в облако — мировой босс на сервере.</p>";
    return;
  }
  body.innerHTML = "<p class=\"farm-hub-empty\">Загрузка…</p>";
  const r = await worldBossApi("/world-boss/state");
  if (!r.ok) {
    body.innerHTML = "<p class=\"farm-hub-empty\">" + (r.error || "Не удалось загрузить") + "</p>";
    return;
  }
  worldBossStateCache = r;
  const st = r.state || {};
  const boss = r.boss || (typeof WORLD_BOSS !== "undefined" ? WORLD_BOSS : {});
  const statusLabel =
    st.status === "active"
      ? "Идёт бой · осталось " + worldBossFmtMs(st.remainingMs)
      : "Перерыв · следующий старт через " + worldBossFmtMs(st.remainingMs);
  const myClicks = st.my?.clicks || 0;
  const ended = st.status === "ended";
  const places = ended ? st.places || [] : [];
  const resultHtml = ended
    ? places.length
      ? '<div class="world-boss-result">' +
        "<p class=\"world-boss-card-desc\"><b>Итоги боя</b></p>" +
        "<ol class=\"world-boss-top\">" +
        places
          .map(
            (p) =>
              "<li><b>#" +
              p.place +
              "</b> " +
              (p.charName || "?") +
              (st.my?.place === p.place ? " · ты" : "") +
              "</li>"
          )
          .join("") +
        "</ol></div>"
      : st.winner
        ? "<p class=\"world-boss-card-desc\">Победитель: <b>" + st.winner.charName + "</b></p>"
        : "<p class=\"world-boss-card-desc\">Победителя нет.</p>"
    : "";
  const canEnter = st.status === "active";
  const canClaim = ended && st.my?.canClaim;
  const claimLabel =
    st.my?.place === 1
      ? "Забрать серьгу"
      : st.my?.place
        ? "Забрать осколок (#" + st.my.place + ")"
        : "Забрать лут";
  const cardBg =
    (boss.ui && boss.ui.cardBg) ||
    (typeof WORLD_BOSS !== "undefined" && WORLD_BOSS.ui && WORLD_BOSS.ui.cardBg) ||
    "assets/ui/world-boss-card-zaken.png";
  const accent =
    (boss.ui && boss.ui.accent) ||
    (typeof WORLD_BOSS !== "undefined" && WORLD_BOSS.ui && WORLD_BOSS.ui.accent) ||
    "#3d9e8c";
  const statusCls =
    st.status === "active" ? " is-live" : ended ? " is-ended" : " is-idle";
  body.innerHTML =
    '<article class="world-boss-card' +
    statusCls +
    '" style="--wb-accent:' +
    accent +
    '">' +
    '<img class="world-boss-card-art" src="' +
    cardBg +
    '" alt="" decoding="async" />' +
    '<div class="world-boss-card-veil" aria-hidden="true"></div>' +
    '<div class="world-boss-card-body">' +
    '<div class="world-boss-card-title"><strong>' +
    (boss.name || "Мировой босс") +
    '</strong><span class="world-boss-chip">' +
    (st.status === "active" ? "Бой" : ended ? "Итоги" : "Пауза") +
    "</span></div>" +
    '<p class="world-boss-card-status">' +
    statusLabel +
    "</p>" +
    '<p class="world-boss-card-meta">HP ' +
    (boss.cosmeticHp || 10_000_000).toLocaleString("ru-RU") +
    " · окно " +
    Math.round((boss.windowMs || 5 * 60 * 1000) / 60000) +
    " мин · раз в час</p>" +
    '<p class="world-boss-card-desc">1 место — Серьга Закена · 2–3 — осколки (10 шт + 10ккк adena в мастерской)</p>' +
    '<p class="world-boss-card-desc">Только реальные клики. Автоудар и умения не считаются. Места — после окна.</p>' +
    '<p class="world-boss-card-clicks">Твои клики: <b>' +
    myClicks +
    "</b></p>" +
    resultHtml +
    '<div class="party-panel-actions world-boss-card-actions">' +
    (canEnter
      ? '<button type="button" class="party-panel-btn party-inst-primary" id="worldBossEnterBtn">Войти на арену</button>'
      : "") +
    (canClaim
      ? '<button type="button" class="party-panel-btn party-inst-primary" id="worldBossClaimBtn">' +
        claimLabel +
        "</button>"
      : "") +
    '<button type="button" class="party-panel-btn ghost" id="worldBossRefreshBtn">Обновить</button>' +
    "</div></div></article>";
  const enterBtn = document.getElementById("worldBossEnterBtn");
  if (enterBtn) enterBtn.onclick = () => enterWorldBossArena();
  const claimBtn = document.getElementById("worldBossClaimBtn");
  if (claimBtn) claimBtn.onclick = () => claimWorldBossLoot();
  const refreshBtn = document.getElementById("worldBossRefreshBtn");
  if (refreshBtn) refreshBtn.onclick = () => renderWorldBossHub();
}

async function claimWorldBossLoot() {
  const r = await worldBossApi("/world-boss/claim", { method: "POST", body: {} });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Не удалось забрать", "warn");
    renderWorldBossHub();
    return;
  }
  if (r.loot) worldBossApplyLoot(r.loot);
  worldBossStateCache = r;
  renderWorldBossHub();
}

async function enterWorldBossArena() {
  if (!worldBossCloudReady()) {
    if (typeof toast === "function") toast("Нужен облачный аккаунт", "warn");
    return;
  }
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return;
  }
  const r = await worldBossApi("/world-boss/enter", {
    method: "POST",
    body: {
      characterId: state.activeCharacterId || "",
      charName: state.avatar?.name || "",
      level: state.avatar?.level || 1,
    },
  });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Не удалось войти", "warn");
    renderWorldBossHub();
    return;
  }
  worldBossStateCache = r;
  worldBossEndPrompted = false;
  openWorldBossMine(r);
}

function openWorldBossMine(payload) {
  if (typeof clearExclusiveMineOverlays === "function") clearExclusiveMineOverlays("worldBoss");
  const boss = payload?.boss || (typeof WORLD_BOSS !== "undefined" ? WORLD_BOSS : {});
  const mineCfg = boss.mine || (typeof WORLD_BOSS !== "undefined" ? WORLD_BOSS.mine : null) || {};
  const zoneId = "world_boss";
  const panelTitle = document.getElementById("minePanelTitle");
  if (panelTitle) panelTitle.textContent = boss.name || "Мировой босс";
  const bgPool = mineCfg.bgs && mineCfg.bgs.length ? mineCfg.bgs : ["assets/locations/elven-ruins.jpg"];
  const bgRaw = bgPool[Math.floor(Math.random() * bgPool.length)];
  const img = document.getElementById("mineBgImg");
  if (img) {
    const url = typeof mineAssetUrl === "function" ? mineAssetUrl(bgRaw) : bgRaw;
    img.removeAttribute("src");
    img.src = url;
  }
  if (typeof applyMineStageVisual === "function") {
    applyMineStageVisual(
      { overlay: mineCfg.overlay || "mine-zone-elven", bgs: bgPool, title: boss.name },
      zoneId
    );
  }
  const hintEl = document.getElementById("mineHint");
  if (hintEl) {
    hintEl.textContent = "";
    hintEl.style.display = "none";
  }
  mineActive = true;
  mineOverlayPaused = false;
  worldBossSessionActive = true;
  if (typeof stopAutoClickerLoop === "function") stopAutoClickerLoop();
  mineSession = {
    startedAt: Date.now(),
    adena0: Math.max(0, Math.floor(Number(state.adena) || 0)),
    kills: 0,
    weapons: 0,
    zoneId: zoneId,
    worldBoss: true,
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
  if (typeof renderMineStoryBar === "function") renderMineStoryBar(zoneId);
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  const storyBar = document.getElementById("mineStoryBar");
  if (storyBar) storyBar.hidden = true;
  const questHud = document.getElementById("mineQuestHud");
  if (questHud) questHud.hidden = true;
  if (typeof show === "function") show("mine");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  clearInterval(mineTimer);
  mineTimer = null;
  if (typeof cancelMineSpawnQueue === "function") cancelMineSpawnQueue();
  spawnWorldBossMob(payload);
  renderWorldBossHud(payload);
  startWorldBossPoll();
}

function spawnWorldBossMob(payload) {
  worldBossClearDomMob();
  const boss = payload && payload.boss ? payload.boss : (typeof WORLD_BOSS !== "undefined" ? WORLD_BOSS : {});
  const mobId = boss.mob || "zaken";
  const maxHp = boss.cosmeticHp || 10_000_000;
  const name = boss.name || "Мировой босс";
  const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
  if (!field || typeof spawnSoloMob !== "function") return;
  const src = "assets/mobs/" + mobId + ".png";
  const sprite = {
    src: typeof mineAssetUrl === "function" ? mineAssetUrl(src) : src,
    kind: "sprite",
    cls: "target-elite",
    label: name,
  };
  spawnSoloMob(field, "boss", { name: name, sprite: sprite, noTimer: true, worldBoss: true, center: true });
  let newest = null;
  if (typeof mineGnomes !== "undefined" && mineGnomes) {
    for (const g of mineGnomes) newest = g;
  }
  if (!newest) return;
  newest._worldBossEncounter = true;
  newest.classList.add("world-boss-mob");
  newest._type = "boss";
  newest._hp = maxHp;
  newest._maxHp = maxHp;
  newest._mobId = mobId;
  newest._partyEncounter = false;
  newest._instanceEncounter = false;
  newest._onExpire = null;
  if (typeof clearMobTimer === "function") clearMobTimer(newest);
  if (typeof updateMobHpBar === "function") updateMobHpBar(newest);
  worldBossDomMob = newest;
}

function ensureWorldBossMob(payload) {
  const alive =
    worldBossDomMob &&
    typeof mineGnomes !== "undefined" &&
    mineGnomes &&
    mineGnomes.has(worldBossDomMob);
  if (alive) {
    if (typeof clearMobTimer === "function") clearMobTimer(worldBossDomMob);
    worldBossDomMob._onExpire = null;
    // Не даём косметическому HP уйти в 0 — босс остаётся на поле
    if ((worldBossDomMob._hp || 0) < 1) {
      const boss = payload?.boss || worldBossStateCache?.boss || {};
      const maxHp = boss.cosmeticHp || 10_000_000;
      worldBossDomMob._maxHp = maxHp;
      worldBossDomMob._hp = maxHp;
      if (typeof updateMobHpBar === "function") updateMobHpBar(worldBossDomMob);
    }
    return;
  }
  spawnWorldBossMob(payload || worldBossStateCache);
}

function worldBossClearDomMob() {
  if (worldBossDomMob) {
    try {
      if (typeof removeGnome === "function") removeGnome(worldBossDomMob);
      else worldBossDomMob.remove();
    } catch (_) {}
    worldBossDomMob = null;
  }
}

function ensureWorldBossHud() {
  let hud = document.getElementById("worldBossHud");
  if (hud) return hud;
  const stage = document.getElementById("mineStageInner") || document.getElementById("screen-mine");
  if (!stage) return null;
  hud = document.createElement("div");
  hud.id = "worldBossHud";
  hud.className = "instance-hud world-boss-hud";
  hud.hidden = true;
  stage.appendChild(hud);
  return hud;
}

function renderWorldBossHud(payload) {
  const hud = ensureWorldBossHud();
  if (!hud) return;
  if (
    typeof mineSession !== "undefined" &&
    mineSession &&
    !mineSession.worldBoss
  ) {
    hud.hidden = true;
    return;
  }
  const st = payload?.state || worldBossStateCache?.state;
  const boss = payload?.boss || worldBossStateCache?.boss || {};
  if (!worldBossSessionActive || !st) {
    hud.hidden = true;
    return;
  }
  hud.hidden = false;
  hud.innerHTML =
    "<div class=\"instance-hud-title\">" +
    (boss.name || "Мировой босс") +
    "</div>" +
    "<div class=\"instance-hud-meta\">Клики: <b>" +
    (st.my?.clicks || 0) +
    "</b>" +
    (st.status === "active" ? " · ещё " + worldBossFmtMs(st.remainingMs) : " · окончен") +
    "</div>";
}

function startWorldBossPoll() {
  stopWorldBossPoll();
  worldBossPollTimer = setInterval(async () => {
    if (!worldBossSessionActive) return;
    const r = await worldBossApi("/world-boss/state");
    if (!r.ok) return;
    worldBossStateCache = r;
    renderWorldBossHud(r);
    if (r.state?.status === "active") {
      ensureWorldBossMob(r);
    }
    if (r.state?.status !== "active" && !worldBossEndPrompted) {
      worldBossEndPrompted = true;
      maybeShowWorldBossResult(r);
    }
  }, 2000);
}

function stopWorldBossPoll() {
  if (worldBossPollTimer) {
    clearInterval(worldBossPollTimer);
    worldBossPollTimer = null;
  }
}

function maybeShowWorldBossResult(r) {
  const st = r?.state;
  if (!st) return;

  stopWorldBossPoll();
  worldBossClearDomMob();
  renderWorldBossHud(r);

  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop || typeof renderStoryPanel !== "function") {
    // Fallback без story-панели: тост + сразу выход
    const places = st.places || [];
    const ann =
      places.length > 0
        ? "Итоги Закена: " +
          places.map((p) => "#" + p.place + " " + (p.charName || "?")).join(" · ")
        : st.winner
          ? "Победитель: " + st.winner.charName
          : "Окно Закена закрыто.";
    if (typeof toast === "function") toast(ann, "info");
    if (st.my?.canClaim && typeof toast === "function") {
      toast("Ты в топ-3 — забери награду на хабе.", "success");
    }
    leaveWorldBossArena();
    return;
  }

  const boss = r?.boss || (typeof WORLD_BOSS !== "undefined" ? WORLD_BOSS : {});
  const cta = st.my?.canClaim ? "К награде" : "Выйти";
  renderStoryPanel({
    title: "Итоги Закена",
    eyebrow: boss.name || "Мировой босс",
    lead: "Окно боя закрыто",
    chapter: "",
    icon: "",
    bodyHtml: worldBossResultBodyHtml(r),
    cta: cta,
  });
  backdrop.dataset.storyMode = "world_boss_result";
  backdrop.className =
    "story-backdrop race-" +
    ((state.avatar && state.avatar.raceId) || "human") +
    " story-chapter-reward story-world-boss-end";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  if (typeof armStoryOkButton === "function") armStoryOkButton();
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function worldBossEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function worldBossResultBodyHtml(r) {
  const st = r?.state || {};
  const my = st.my || {};
  const places = st.places || [];
  const esc = worldBossEsc;
  const parts = ['<div class="world-boss-end-panel">'];
  parts.push(
    '<p class="world-boss-end-clicks">Твои клики: <b>' +
      (my.clicks || 0) +
      "</b>" +
      (my.place ? " · место <b>#" + my.place + "</b>" : " · вне топ-3") +
      "</p>"
  );
  if (places.length) {
    parts.push('<p class="world-boss-end-label"><b>Топ</b></p>');
    parts.push('<ol class="world-boss-top">');
    places.forEach((p) => {
      parts.push(
        "<li><b>#" +
          p.place +
          "</b> " +
          esc(p.charName || "?") +
          (my.place === p.place ? " · ты" : "") +
          "</li>"
      );
    });
    parts.push("</ol>");
  } else if (st.winner) {
    parts.push("<p>Победитель: <b>" + esc(st.winner.charName || "?") + "</b></p>");
  } else {
    parts.push("<p>Победителя нет.</p>");
  }
  if (my.canClaim) {
    parts.push(
      '<p class="world-boss-end-claim">Ты в топ-3 — забери награду на хабе «Мировой босс».</p>'
    );
  } else {
    parts.push(
      '<p class="world-boss-end-claim world-boss-end-claim--muted">Награда только у топ-3.</p>'
    );
  }
  parts.push("</div>");
  return parts.join("");
}

function dismissWorldBossResultModal() {
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    backdrop.hidden = true;
  }
  if (typeof Audio2 !== "undefined") Audio2.click();
  leaveWorldBossArena();
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
}

/** Выход с арены Закена → хаб «Мировой босс» в меню фарма. */
function leaveWorldBossArena() {
  if (typeof stopMine === "function") {
    try {
      stopMine();
    } catch (_) {}
  } else if (typeof worldBossAfterStopMine === "function") {
    worldBossAfterStopMine();
  }
  if (typeof renderMenu === "function") renderMenu();
  if (typeof show === "function") show("menu");
  if (typeof setMenuFarmEntry === "function") {
    setMenuFarmEntry("worldboss");
  } else if (typeof renderWorldBossHub === "function") {
    renderWorldBossHub();
  }
}

async function worldBossHandleHit(g, opts) {
  opts = opts || {};
  if (!worldBossSessionActive || !g || !g._worldBossEncounter) return true;
  if (worldBossEndPrompted) return true;
  if (opts.autoClicker || opts.bySkill || opts.skillMult) return true;
  if (worldBossClickBusy) return true;
  worldBossClickBusy = true;
  try {
    const r = await worldBossApi("/world-boss/click", {
      method: "POST",
      body: {
        characterId: state.activeCharacterId || "",
        charName: state.avatar?.name || "",
      },
    });
    if (r.ok) {
      worldBossStateCache = r;
      // Cosmetic HP tick
      const dmg = typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 8;
      g._hp = Math.max(1, (g._hp ?? g._maxHp) - Math.max(1, dmg));
      if (typeof Audio2 !== "undefined" && Audio2.mineHit) Audio2.mineHit();
      g.classList.add("mob-hit");
      setTimeout(() => g.classList.remove("mob-hit"), 90);
      if (typeof updateMobHpBar === "function") updateMobHpBar(g);
      const dropAt = typeof gnomeDropPoint === "function" ? gnomeDropPoint(g) : { x: 0, y: 0 };
      if (typeof floatText === "function") floatText(dropAt.x, dropAt.y - 12, "+1", "#ffd27a");
      renderWorldBossHud(r);
      const caught = document.getElementById("mineCaught");
      if (caught) caught.textContent = String(r.state?.my?.clicks || 0);
      if (r.state?.status !== "active" && !worldBossEndPrompted) {
        worldBossEndPrompted = true;
        maybeShowWorldBossResult(r);
      }
    }
  } finally {
    worldBossClickBusy = false;
  }
  return true;
}

function worldBossAfterStopMine() {
  if (!worldBossSessionActive && !worldBossPollTimer) {
    const hud = document.getElementById("worldBossHud");
    if (hud) {
      hud.hidden = true;
      hud.innerHTML = "";
    }
    return;
  }
  worldBossSessionActive = false;
  worldBossEndPrompted = false;
  stopWorldBossPoll();
  worldBossClearDomMob();
  const hud = document.getElementById("worldBossHud");
  if (hud) {
    hud.hidden = true;
    hud.innerHTML = "";
  }
  if (worldBossCloudReady()) {
    worldBossApi("/world-boss/leave", { method: "POST", body: {} }).catch(() => {});
  }
}

function worldBossShouldBlockLocalSpawn() {
  return isWorldBossSessionActive();
}

/** Dev: форс-старт окна Закена (нужен облачный вход; на prod отключено). */
async function devForceWorldBossStart() {
  if (typeof FEATURE_DEV_PANEL !== "undefined" && !FEATURE_DEV_PANEL) return null;
  if (typeof worldBossCloudReady === "function" && !worldBossCloudReady()) {
    if (typeof toast === "function") toast("Нужен вход в облако", "warn");
    return null;
  }
  const r = await worldBossApi("/world-boss/dev/force-start", { method: "POST", body: {} });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Не удалось запустить Закена", "warn");
    return r;
  }
  worldBossStateCache = r;
  if (typeof toast === "function") {
    toast("Dev: Закен активен · " + worldBossFmtMs(r.state?.remainingMs || 0), "success");
  }
  if (typeof renderWorldBossHub === "function") renderWorldBossHub();
  return r;
}

async function devForceWorldBossEnd() {
  if (typeof FEATURE_DEV_PANEL !== "undefined" && !FEATURE_DEV_PANEL) return null;
  if (typeof worldBossCloudReady === "function" && !worldBossCloudReady()) {
    if (typeof toast === "function") toast("Нужен вход в облако", "warn");
    return null;
  }
  const r = await worldBossApi("/world-boss/dev/force-end", { method: "POST", body: {} });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Не удалось закрыть окно", "warn");
    return r;
  }
  worldBossStateCache = r;
  if (typeof toast === "function") toast("Dev: окно Закена закрыто", "info");
  if (typeof renderWorldBossHub === "function") renderWorldBossHub();
  return r;
}

if (typeof window !== "undefined") {
  window.devForceWorldBossStart = devForceWorldBossStart;
  window.devForceWorldBossEnd = devForceWorldBossEnd;
  window.devStartZaken = devForceWorldBossStart;
}


