// ===== World boss: соло-рейс по урону (окно из WORLD_BOSS) =====

function worldBossFmtDamage(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (typeof fmt === "function") return fmt(v);
  return String(v);
}

function worldBossHitDamage() {
  let dmg = typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 8;
  dmg = Math.max(1, Math.floor(Number(dmg) || 1));
  if (typeof mineSkillClickMult === "function") {
    dmg = Math.max(1, Math.round(dmg * mineSkillClickMult()));
  }
  if (typeof passiveEffectMult === "function") {
    dmg = Math.max(
      1,
      Math.round(dmg * passiveEffectMult("farmDamageMult", typeof state !== "undefined" ? state.avatar : null))
    );
  }
  if (typeof applyMineShotDamageMult === "function") {
    dmg = Math.max(1, Math.round(applyMineShotDamageMult(dmg)));
  }
  const cap =
    typeof WORLD_BOSS_SWIPE !== "undefined" && WORLD_BOSS_SWIPE.hitDmgMax != null
      ? WORLD_BOSS_SWIPE.hitDmgMax
      : 50000;
  return Math.min(cap, dmg);
}

let worldBossStateCache = null;
let worldBossPollTimer = null;
let worldBossClickBusy = false;
let worldBossDomMob = null;
let worldBossSessionActive = false;
let worldBossEndPrompted = false;
let worldBossSwipeOpen = false;
let worldBossSwipeBusy = false;
let worldBossSwipeTimer = null;

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

/** url() для CSS-var: абсолютный путь (иначе url резолвится от styles/*.css → 404). */
function worldBossCssBgUrl(assetPath) {
  const clean = String(assetPath || "assets/ui/world-boss-card-zaken.png")
    .split("?")[0]
    .replace(/^\.\.\//, "")
    .replace(/^\/+/, "");
  try {
    return 'url("' + new URL(clean, window.location.href).href.replace(/"/g, "%22") + '")';
  } catch (_) {
    return 'url("../' + clean.replace(/"/g, "") + '")';
  }
}

/** Применить стиль кнопки WB в хабе фарма (как у карточки Закена: фон + акцент рамки). */
function applyWorldBossFarmEntryStyle(boss, status, remainingMs) {
  const btn = document.getElementById("farmEntryWorldBoss");
  if (!btn || !boss) return;
  const def =
    (typeof worldBossById === "function" && boss.id ? worldBossById(boss.id) : null) || boss;
  const cardBgRaw =
    (def.ui && def.ui.cardBg) ||
    (boss.ui && boss.ui.cardBg) ||
    "assets/ui/world-boss-card-zaken.png";
  const cardBg = String(cardBgRaw).split("?")[0];
  // RGB-тройка для rgba(var(--wb-entry-accent), a) — тот же «хром», что у Закена.
  const accentRgb =
    def.id === "world_queen_ant" || /queen/i.test(String(def.id || ""))
      ? "196, 90, 61"
      : "61, 158, 140";
  const img = btn.querySelector(".farm-hub-entry-ico");
  if (img) {
    const url =
      typeof mineAssetUrl === "function" ? mineAssetUrl(cardBgRaw) : cardBgRaw;
    if (img.getAttribute("src") !== url) img.src = url;
    img.style.objectPosition =
      def.id === "world_queen_ant" ? "center 45%" : "center 40%";
  }
  const small = btn.querySelector(".farm-hub-entry-copy small");
  if (small) {
    const name = def.name || boss.name || "Мировой босс";
    const rem = Math.max(0, Number(remainingMs) || 0);
    if (status === "active") {
      small.textContent = name + " · бой · ещё " + worldBossFmtMs(rem);
    } else if (status === "ended") {
      small.textContent = name + " · итоги · топ-3";
    } else {
      small.textContent = name + " · через " + worldBossFmtMs(rem) + " · топ-3";
    }
  }
  const bgUrl = worldBossCssBgUrl(cardBg);
  btn.dataset.wbBoss = def.id || boss.id || "";
  btn.dataset.wbStatus = status || "";
  btn.style.setProperty("--wb-entry-bg", bgUrl);
  btn.style.setProperty("--wb-entry-accent", accentRgb);
  const field = document.getElementById("worldBossField");
  if (field) {
    field.style.setProperty("--wb-entry-bg", bgUrl);
    field.style.setProperty("--wb-entry-accent", accentRgb);
  }
}

/**
 * Кнопка «Мировой босс»: приоритет живому окну с сервера (force-start / текущий бой),
 * иначе ближайший слот по расписанию МСК.
 */
async function syncWorldBossFarmEntryBtn() {
  const btn = document.getElementById("farmEntryWorldBoss");
  if (!btn) return;

  // 1) Живой кэш / API — если сейчас идёт бой (в т.ч. force-start).
  let live = null;
  const cached = worldBossStateCache;
  if (cached && cached.boss && cached.state && cached.state.status === "active") {
    live = {
      boss: cached.boss,
      status: "active",
      remainingMs: cached.state.remainingMs || 0,
    };
  } else if (typeof worldBossCloudReady === "function" && worldBossCloudReady()) {
    try {
      const r = await worldBossApi("/world-boss/state");
      if (r && r.ok) {
        worldBossStateCache = r;
        if (r.state && r.state.status === "active" && r.boss) {
          live = {
            boss: r.boss,
            status: "active",
            remainingMs: r.state.remainingMs || 0,
          };
        } else if (r.state && r.state.status === "ended" && r.boss) {
          live = {
            boss: r.boss,
            status: "ended",
            remainingMs: r.state.remainingMs || 0,
          };
        }
      }
    } catch (_) {}
  }

  if (live && live.boss) {
    applyWorldBossFarmEntryStyle(live.boss, live.status, live.remainingMs);
    return;
  }

  // 2) Расписание МСК.
  const upcoming =
    typeof worldBossUpcoming === "function" ? worldBossUpcoming(Date.now()) : null;
  const boss =
    (upcoming && upcoming.boss) ||
    (typeof worldBossForNow === "function" ? worldBossForNow(Date.now()) : null) ||
    (typeof WORLD_BOSS !== "undefined" ? WORLD_BOSS : null);
  if (!boss) return;
  applyWorldBossFarmEntryStyle(
    boss,
    upcoming && upcoming.status === "active" ? "active" : "upcoming",
    upcoming ? upcoming.remainingMs : 0
  );
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
  const tz = (r.schedule && r.schedule.tz) || "МСК";
  const list =
    Array.isArray(r.bosses) && r.bosses.length
      ? r.bosses
      : [
          Object.assign({}, r.boss || (typeof WORLD_BOSS !== "undefined" ? WORLD_BOSS : {}), {
            cardStatus: st.status,
            remainingMs: st.remainingMs,
          }),
        ];
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

  function lootClaimLabel(boss, place) {
    const row =
      boss && boss.loot && boss.loot.places
        ? boss.loot.places[place] || boss.loot.places[String(place)]
        : null;
    if (place === 1 && row && row.accessoryId) {
      const id = String(row.accessoryId);
      const def =
        typeof COLLECTIBLES !== "undefined" && COLLECTIBLES ? COLLECTIBLES[id] : null;
      // earring раньше ring: id «…_earring» содержит подстроку «ring»
      if ((def && def.slot === "earring") || /earring/i.test(id)) return "Забрать серьгу";
      if ((def && def.slot === "ring") || /(^|_)ring(_|$)/i.test(id)) return "Забрать кольцо";
      if (def && def.slot === "necklace") return "Забрать ожерелье";
      return "Забрать награду";
    }
    if (place >= 2) return "Забрать осколок (#" + place + ")";
    return "Забрать лут";
  }

  function parityHint(boss) {
    const label =
      typeof worldBossParityLabel === "function"
        ? worldBossParityLabel(boss.hourParity)
        : boss.hourParity === "even"
          ? "чётные часы"
          : "нечётные часы";
    return label + " " + tz;
  }

  const cards = list
    .map((boss) => {
      const isCurrent = st.bossId === boss.id || (!st.bossId && r.boss && r.boss.id === boss.id);
      const cardStatus = boss.cardStatus || (isCurrent ? st.status : "idle");
      const remaining =
        boss.remainingMs != null ? boss.remainingMs : isCurrent ? st.remainingMs : 0;
      const statusLabel =
        cardStatus === "active"
          ? "Идёт бой · осталось " + worldBossFmtMs(remaining)
          : cardStatus === "ended" && isCurrent
            ? "Итоги · след. старт через " + worldBossFmtMs(remaining)
            : "Старт в " + parityHint(boss) + " · через " + worldBossFmtMs(remaining);
      const canEnter = cardStatus === "active" && isCurrent && st.status === "active";
      const canClaim = ended && isCurrent && st.my?.canClaim;
      const claimLabel = lootClaimLabel(boss, st.my?.place);
      const cardBg = (boss.ui && boss.ui.cardBg) || "assets/ui/world-boss-card-zaken.png";
      const accent = (boss.ui && boss.ui.accent) || "#3d9e8c";
      const statusCls =
        cardStatus === "active"
          ? " is-live"
          : cardStatus === "ended" && isCurrent
            ? " is-ended"
            : " is-idle";
      const lootDesc =
        boss.lootBlurb ||
        "1 место — уникальная бижутерия · 2–3 — осколки (мастерская)";
      return (
        '<article class="world-boss-card' +
        statusCls +
        '" style="--wb-accent:' +
        accent +
        '" data-boss-id="' +
        (boss.id || "") +
        '">' +
        '<img class="world-boss-card-art" src="' +
        cardBg +
        '" alt="" decoding="async" />' +
        '<div class="world-boss-card-veil" aria-hidden="true"></div>' +
        '<div class="world-boss-card-body">' +
        '<div class="world-boss-card-title"><strong>' +
        (boss.name || "Мировой босс") +
        '</strong><span class="world-boss-chip">' +
        (cardStatus === "active"
          ? "Бой"
          : cardStatus === "ended" && isCurrent
            ? "Итоги"
            : "Пауза") +
        "</span></div>" +
        '<p class="world-boss-card-status">' +
        statusLabel +
        "</p>" +
        '<p class="world-boss-card-meta">HP ' +
        (boss.cosmeticHp || 10_000_000).toLocaleString("ru-RU") +
        " · окно " +
        Math.round((boss.windowMs || 5 * 60 * 1000) / 60000) +
        " мин · " +
        parityHint(boss) +
        "</p>" +
        '<p class="world-boss-card-desc">' +
        lootDesc +
        "</p>" +
        '<p class="world-boss-card-desc">Рейтинг по урону персонажа. Только ручные удары — автоудар и умения не считаются.</p>' +
        (isCurrent
          ? '<p class="world-boss-card-clicks">Твой урон: <b>' +
            worldBossFmtDamage(st.my?.damage != null ? st.my.damage : st.my?.clicks) +
            "</b></p>"
          : "") +
        (isCurrent && ended ? resultHtml : "") +
        '<div class="party-panel-actions world-boss-card-actions">' +
        (canEnter
          ? '<button type="button" class="party-panel-btn party-inst-primary world-boss-enter-btn" data-boss-id="' +
            boss.id +
            '">Войти на арену</button>'
          : "") +
        (canClaim
          ? '<button type="button" class="party-panel-btn party-inst-primary" id="worldBossClaimBtn">' +
            claimLabel +
            "</button>"
          : "") +
        "</div></div></article>"
      );
    })
    .join("");

  body.innerHTML =
    '<div class="world-boss-hub-grid">' +
    cards +
    '</div><div class="party-panel-actions world-boss-hub-actions">' +
    '<button type="button" class="party-panel-btn ghost" id="worldBossRefreshBtn">Обновить</button>' +
    "</div>";
  body.querySelectorAll(".world-boss-enter-btn").forEach((btn) => {
    btn.onclick = () => enterWorldBossArena(btn.getAttribute("data-boss-id"));
  });
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

async function enterWorldBossArena(bossId) {
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
      bossId: bossId || undefined,
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
  // Мировой босс: без фарм-статов/автоудара, соски оставляем.
  const mineHud = document.querySelector("#screen-mine .mine-hud");
  if (mineHud) mineHud.hidden = false;
  const farmStats = document.querySelector("#screen-mine .mine-farm-stats");
  if (farmStats) farmStats.hidden = true;
  const sessionLoot = document.getElementById("mineSessionLoot");
  if (sessionLoot) sessionLoot.hidden = true;
  if (typeof closeMineSessionLootDrawer === "function") closeMineSessionLootDrawer();
  if (typeof closeMineResourceFavDrawer === "function") closeMineResourceFavDrawer();
  else {
    const drawer = document.getElementById("mineSessionLootDrawer");
    if (drawer) {
      drawer.hidden = true;
      drawer.innerHTML = "";
    }
    const fav = document.getElementById("mineResourceFavDrawer");
    if (fav) {
      fav.hidden = true;
      fav.innerHTML = "";
    }
    const side = document.getElementById("mineSidePanels");
    if (side) side.hidden = true;
  }
  const resourceFav = document.getElementById("mineResourceFav");
  if (resourceFav) resourceFav.hidden = true;
  const autoRow = document.getElementById("mineAutoClickerRow");
  if (autoRow) autoRow.hidden = true;
  const territoryHud = document.getElementById("mineClanTerritoryHud");
  if (territoryHud) {
    territoryHud.hidden = true;
    territoryHud.textContent = "";
  }
  const shotBtn = document.getElementById("mineShotToggle");
  if (shotBtn) shotBtn.hidden = false;
  if (typeof syncMineShotHud === "function") syncMineShotHud();
  if (typeof renderMineHudStats === "function") renderMineHudStats();
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
  if (mobId === "queen-ant") newest.classList.add("world-boss-mob--queen-ant");
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
    const boss = payload?.boss || worldBossStateCache?.boss || {};
    if ((boss.mob || worldBossDomMob._mobId) === "queen-ant") {
      worldBossDomMob.classList.add("world-boss-mob--queen-ant");
    }
    // Не даём косметическому HP уйти в 0 — босс остаётся на поле
    if ((worldBossDomMob._hp || 0) < 1) {
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
  const fails = st.my?.swipeFails || 0;
  const maxFails = st.my?.swipeMaxFails || 3;
  hud.innerHTML =
    "<div class=\"instance-hud-title\">" +
    (boss.name || "Мировой босс") +
    "</div>" +
    "<div class=\"instance-hud-meta\">Урон: <b>" +
    worldBossFmtDamage(st.my?.damage != null ? st.my.damage : st.my?.clicks) +
    "</b>" +
    (st.status === "active" ? " · ещё " + worldBossFmtMs(st.remainingMs) : " · окончен") +
    (fails > 0 ? " · свайп " + fails + "/" + maxFails : "") +
    "</div>";
  if (st.my?.swipeRequired) maybeShowWorldBossSwipe(payload || worldBossStateCache);
  else hideWorldBossSwipe();
}

function ensureWorldBossSwipeEl() {
  let el = document.getElementById("worldBossSwipe");
  if (el && !el.querySelector(".world-boss-swipe-card.is-bare")) {
    el.remove();
    el = null;
  }
  if (el) return el;
  const stage = document.getElementById("mineStageInner") || document.getElementById("screen-mine");
  if (!stage) return null;
  el = document.createElement("div");
  el.id = "worldBossSwipe";
  el.className = "world-boss-swipe";
  el.hidden = true;
  el.innerHTML =
    '<div class="world-boss-swipe-card is-bare">' +
    '<div class="world-boss-swipe-title">Печать арены</div>' +
    '<p class="world-boss-swipe-hint" id="worldBossSwipeHint">Свайп →</p>' +
    '<div class="world-boss-swipe-rail">' +
    '<div class="world-boss-swipe-track" id="worldBossSwipeTrack" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
    '<div class="world-boss-swipe-fill" id="worldBossSwipeFill"></div>' +
    '<div class="world-boss-swipe-arrows" aria-hidden="true"><span></span><span></span><span></span></div>' +
    '<img class="world-boss-swipe-knob" id="worldBossSwipeKnob" src="assets/ui/wb-swipe-knob.png?v=1" alt="" draggable="false">' +
    "</div></div>" +
    '<div class="world-boss-swipe-timer" aria-hidden="true"><i id="worldBossSwipeTimerBar"></i></div>' +
    '<div class="world-boss-swipe-meta" id="worldBossSwipeMeta"></div>' +
    "</div>";
  stage.appendChild(el);
  return el;
}

function hideWorldBossSwipe() {
  worldBossSwipeOpen = false;
  if (worldBossSwipeTimer) {
    clearTimeout(worldBossSwipeTimer);
    worldBossSwipeTimer = null;
  }
  const el = document.getElementById("worldBossSwipe");
  if (el) {
    el.hidden = true;
    delete el.dataset.swipeAngle;
  }
}

function maybeShowWorldBossSwipe(payload) {
  const my = payload?.state?.my || payload?.my;
  if (!my || !my.swipeRequired || !my.swipeToken) return;
  if (
    worldBossSwipeOpen &&
    document.getElementById("worldBossSwipe") &&
    !document.getElementById("worldBossSwipe").hidden
  ) {
    return;
  }
  showWorldBossSwipe(my);
}

/** Случайная позиция у края арены (не центр с боссом) + угол. */
function placeWorldBossSwipeCard(overlay, card) {
  if (!overlay || !card) return 0;
  const stage = overlay.parentElement || overlay;
  const sw = Math.max(1, stage.clientWidth || 1);
  const sh = Math.max(1, stage.clientHeight || 1);
  card.style.left = "0px";
  card.style.top = "0px";
  card.style.transform = "none";
  const cw = Math.max(160, card.offsetWidth || Math.min(300, sw * 0.78));
  const ch = Math.max(72, card.offsetHeight || 110);
  const pad = 10;
  const edgeBand = Math.max(28, Math.min(sw, sh) * 0.16);
  const edge = Math.floor(Math.random() * 4);
  let x = pad;
  let y = pad;
  if (edge === 0) {
    x = pad + Math.random() * Math.max(0, sw - cw - pad * 2);
    y = pad + Math.random() * Math.max(0, edgeBand);
  } else if (edge === 1) {
    x = pad + Math.random() * Math.max(0, sw - cw - pad * 2);
    y = sh - ch - pad - Math.random() * Math.max(0, edgeBand);
  } else if (edge === 2) {
    x = pad + Math.random() * Math.max(0, edgeBand * 0.7);
    y = pad + Math.random() * Math.max(0, sh - ch - pad * 2);
  } else {
    x = sw - cw - pad - Math.random() * Math.max(0, edgeBand * 0.7);
    y = pad + Math.random() * Math.max(0, sh - ch - pad * 2);
  }
  x = Math.max(pad, Math.min(sw - cw - pad, x));
  y = Math.max(pad, Math.min(sh - ch - pad, y));
  const angle = Math.random() * 36 - 18;
  card.style.left = Math.round(x) + "px";
  card.style.top = Math.round(y) + "px";
  card.style.transform = "rotate(" + angle.toFixed(1) + "deg)";
  overlay.dataset.swipeAngle = String(angle);
  return angle;
}

function showWorldBossSwipe(my) {
  const el = ensureWorldBossSwipeEl();
  if (!el) return;
  const card = el.querySelector(".world-boss-swipe-card");
  const dir = my.swipeDir === "rtl" ? "rtl" : "ltr";
  const fails = my.swipeFails || 0;
  const maxFails = my.swipeMaxFails || 3;
  const limitMs = my.swipeTimeLimitMs || 6500;
  const hint = document.getElementById("worldBossSwipeHint");
  const meta = document.getElementById("worldBossSwipeMeta");
  const track = document.getElementById("worldBossSwipeTrack");
  const fill = document.getElementById("worldBossSwipeFill");
  const knob = document.getElementById("worldBossSwipeKnob");
  if (hint) hint.textContent = dir === "rtl" ? "Свайп ←" : "Свайп →";
  if (meta) {
    meta.textContent =
      fails > 0 ? "Срывов: " + fails + "/" + maxFails : "3 срыва — урон обнулится";
  }
  el.classList.toggle("is-rtl", dir === "rtl");
  el.hidden = false;
  worldBossSwipeOpen = true;
  worldBossSwipeBusy = false;
  const angleDeg = placeWorldBossSwipeCard(el, card);

  let progress = 0;
  let dragging = false;
  let startProg = 0;
  let pointerId = null;
  const startProgress = dir === "rtl" ? 1 : 0;
  const timerBar = document.getElementById("worldBossSwipeTimerBar");

  function setProgress(p) {
    progress = Math.max(0, Math.min(1, p));
    const inset = 0.1;
    const span = 1 - inset * 2;
    const xPos = inset + progress * span;
    if (fill) {
      if (dir === "rtl") {
        fill.style.left = xPos * 100 + "%";
        fill.style.width = (inset + span - xPos) * 100 + "%";
      } else {
        fill.style.left = inset * 100 + "%";
        fill.style.width = progress * span * 100 + "%";
      }
    }
    if (knob) knob.style.left = xPos * 100 + "%";
    if (track) track.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  }
  setProgress(startProgress);

  if (timerBar) {
    timerBar.style.transition = "none";
    timerBar.style.transform = "scaleX(1)";
    void timerBar.offsetWidth;
    timerBar.style.transition = "transform " + limitMs + "ms linear";
    timerBar.style.transform = "scaleX(0)";
  }

  function cleanupDrag() {
    dragging = false;
    pointerId = null;
  }

  async function finish(ok) {
    if (worldBossSwipeBusy) return;
    worldBossSwipeBusy = true;
    cleanupDrag();
    if (worldBossSwipeTimer) {
      clearTimeout(worldBossSwipeTimer);
      worldBossSwipeTimer = null;
    }
    const r = await worldBossApi("/world-boss/swipe", {
      method: "POST",
      body: { success: !!ok, token: my.swipeToken },
    });
    worldBossSwipeBusy = false;
    if (r.ok) worldBossStateCache = r;
    if (r.wiped) {
      hideWorldBossSwipe();
      if (typeof toast === "function") toast("3 провала свайпа — урон сброшен", "warn");
      renderWorldBossHud(r);
      return;
    }
    if (r.swipeOk) {
      hideWorldBossSwipe();
      if (typeof toast === "function") toast("Проверка пройдена", "success");
      renderWorldBossHud(r);
      return;
    }
    if (r.ok === false && r.error === "token") {
      hideWorldBossSwipe();
      if (typeof toast === "function") toast(r.message || "Обнови арену", "warn");
      return;
    }
    if (typeof toast === "function") toast(r.message || "Свайп не засчитан", "warn");
    const nextMy = r.state?.my || r.my;
    if (nextMy && nextMy.swipeRequired) {
      worldBossSwipeOpen = false;
      showWorldBossSwipe(nextMy);
    } else {
      hideWorldBossSwipe();
      renderWorldBossHud(r);
    }
  }

  if (worldBossSwipeTimer) clearTimeout(worldBossSwipeTimer);
  worldBossSwipeTimer = setTimeout(() => finish(false), limitMs);

  function pointerProgress(clientX, clientY) {
    const w = track.offsetWidth || 1;
    const rect = track.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const rad = (-angleDeg * Math.PI) / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const inset = w * 0.1;
    const usable = Math.max(1, w - inset * 2);
    return Math.max(0, Math.min(1, (localX + w / 2 - inset) / usable));
  }

  function onDown(ev) {
    if (worldBossSwipeBusy || (ev.button != null && ev.button !== 0)) return;
    const p = pointerProgress(ev.clientX, ev.clientY);
    const nearStart = dir === "rtl" ? p > 0.72 : p < 0.28;
    if (!nearStart) return;
    dragging = true;
    pointerId = ev.pointerId;
    startProg = p;
    setProgress(startProgress);
    try {
      track.setPointerCapture(ev.pointerId);
    } catch (_) {}
    ev.preventDefault();
    ev.stopPropagation();
  }
  function onMove(ev) {
    if (!dragging || (pointerId != null && ev.pointerId !== pointerId)) return;
    setProgress(pointerProgress(ev.clientX, ev.clientY));
    ev.preventDefault();
    ev.stopPropagation();
  }
  function onUp(ev) {
    if (!dragging || (pointerId != null && ev.pointerId !== pointerId)) return;
    const p = pointerProgress(ev.clientX, ev.clientY);
    const traveled = Math.abs(p - startProg);
    const ok =
      traveled >= 0.55 && (dir === "rtl" ? progress <= 0.12 : progress >= 0.88);
    cleanupDrag();
    finish(ok);
    ev.preventDefault();
    ev.stopPropagation();
  }

  track.onpointerdown = onDown;
  track.onpointermove = onMove;
  track.onpointerup = onUp;
  track.onpointercancel = () => {
    if (dragging) {
      cleanupDrag();
      finish(false);
    }
  };
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
    const bossName = (r?.boss && r.boss.name) || "Мировой босс";
    const ann =
      places.length > 0
        ? "Итоги · " + bossName + ": " +
          places.map((p) => "#" + p.place + " " + (p.charName || "?")).join(" · ")
        : st.winner
          ? "Победитель: " + st.winner.charName
          : "Окно «" + bossName + "» закрыто.";
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
    title: "Итоги · " + (boss.name || "Мировой босс"),
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
    '<p class="world-boss-end-clicks">Твой урон: <b>' +
      worldBossFmtDamage(my.damage != null ? my.damage : my.clicks) +
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
  if (worldBossSwipeOpen) return true;
  if (opts.autoClicker || opts.bySkill || opts.skillMult) return true;
  if (worldBossClickBusy) return true;
  worldBossClickBusy = true;
  try {
    const dmg = worldBossHitDamage();
    const r = await worldBossApi("/world-boss/click", {
      method: "POST",
      body: {
        characterId: state.activeCharacterId || "",
        charName: state.avatar?.name || "",
        damage: dmg,
      },
    });
    if (r.swipeRequired || r.error === "swipe") {
      worldBossStateCache = r;
      renderWorldBossHud(r);
      maybeShowWorldBossSwipe(r);
      if (!r.ok) return true;
    }
    if (r.ok) {
      worldBossStateCache = r;
      const applied = Math.max(1, Number(r.hitDamage) || dmg);
      g._hp = Math.max(1, (g._hp ?? g._maxHp) - applied);
      if (typeof Audio2 !== "undefined" && Audio2.mineHit) Audio2.mineHit();
      g.classList.add("mob-hit");
      setTimeout(() => g.classList.remove("mob-hit"), 90);
      if (typeof updateMobHpBar === "function") updateMobHpBar(g);
      const dropAt = typeof gnomeDropPoint === "function" ? gnomeDropPoint(g) : { x: 0, y: 0 };
      if (typeof floatText === "function") {
        floatText(dropAt.x, dropAt.y - 12, "+" + worldBossFmtDamage(applied), "#ffd27a");
      }
      renderWorldBossHud(r);
      if (r.swipeRequired) maybeShowWorldBossSwipe(r);
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
  hideWorldBossSwipe();
  stopWorldBossPoll();
  worldBossClearDomMob();
  const hud = document.getElementById("worldBossHud");
  if (hud) {
    hud.hidden = true;
    hud.innerHTML = "";
  }
  const farmStats = document.querySelector("#screen-mine .mine-farm-stats");
  if (farmStats) farmStats.hidden = false;
  const mineHud = document.querySelector("#screen-mine .mine-hud");
  if (mineHud) mineHud.hidden = false;
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
  if (typeof renderMineHudStats === "function") renderMineHudStats();
  if (worldBossCloudReady()) {
    worldBossApi("/world-boss/leave", { method: "POST", body: {} }).catch(() => {});
  }
}

function worldBossShouldBlockLocalSpawn() {
  return isWorldBossSessionActive();
}

/** Dev: форс-старт окна мирового босса (нужен облачный вход; на prod отключено). */
async function devForceWorldBossStart(bossId) {
  if (typeof FEATURE_DEV_PANEL !== "undefined" && !FEATURE_DEV_PANEL) return null;
  if (typeof worldBossCloudReady === "function" && !worldBossCloudReady()) {
    if (typeof toast === "function") toast("Нужен вход в облако", "warn");
    return null;
  }
  const r = await worldBossApi("/world-boss/dev/force-start", {
    method: "POST",
    body: { bossId: bossId || "world_zaken" },
  });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.message || r.error || "Не удалось запустить WB", "warn");
    return r;
  }
  worldBossStateCache = r;
  const name = (r.boss && r.boss.name) || bossId || "WB";
  if (typeof toast === "function") {
    toast("Dev: " + name + " активен · " + worldBossFmtMs(r.state?.remainingMs || 0), "success");
  }
  if (typeof syncWorldBossFarmEntryBtn === "function") syncWorldBossFarmEntryBtn();
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
  if (typeof toast === "function") toast("Dev: окно мирового босса закрыто", "info");
  if (typeof syncWorldBossFarmEntryBtn === "function") syncWorldBossFarmEntryBtn();
  if (typeof renderWorldBossHub === "function") renderWorldBossHub();
  return r;
}

if (typeof window !== "undefined") {
  window.devForceWorldBossStart = devForceWorldBossStart;
  window.devForceWorldBossEnd = devForceWorldBossEnd;
  window.devStartZaken = () => devForceWorldBossStart("world_zaken");
  window.devStartQueenAnt = () => devForceWorldBossStart("world_queen_ant");
  window.syncWorldBossFarmEntryBtn = syncWorldBossFarmEntryBtn;
}


