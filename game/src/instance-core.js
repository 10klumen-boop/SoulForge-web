// ===== Instance core + UI: волны → босс, weekly lockout =====

let instanceRunState = null;
let instancePollTimer = null;
let instanceHitBusy = false;
let instanceDomMob = null;
let instanceLastEncId = null;
let instanceLootApplied = false;
/** @type {Map<string, HTMLElement>} */
let instanceDomMobs = new Map();
/** @type {Map<string, HTMLElement>} */
let instanceDomStones = new Map();
/** @type {Map<string, HTMLElement>} */
let instanceDomAnvilMarks = new Map();
/** @type {Map<string, HTMLElement>} */
let instanceDomAdds = new Map();
let instanceLastPhaseLabel = "";
let instancePhaseFxTimer = null;
let instanceLastEventSeen = "";
let instanceExitHandled = false;

function ensureInstanceModal() {
  let modal = document.getElementById("instanceModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "instanceModal";
  modal.className = "instance-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="instance-modal-card">' +
    '<div class="instance-modal-head"><strong>Инстансы</strong>' +
    '<button type="button" class="instance-modal-close" id="instanceModalClose">×</button></div>' +
    '<div class="instance-modal-body" id="instanceModalBody"></div>' +
    "</div>";
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeInstancePicker();
  });
  document.getElementById("instanceModalClose").onclick = () => closeInstancePicker();
  return modal;
}

function closeInstancePicker() {
  const modal = document.getElementById("instanceModal");
  if (modal) modal.hidden = true;
}

async function openInstancePicker() {
  if (!partyCanEnterGroupContent()) {
    if (typeof toast === "function") toast("Нужна группа из 2–4", "warn");
    return;
  }
  // Уже есть активный инстанс — любой член группы может войти
  const activeR = await partyApi("/instance/active");
  if (activeR.ok && activeR.state && (activeR.state.status === "ready" || activeR.state.status === "active")) {
    await joinPartyInstance(activeR.state);
    return;
  }
  if (!partyAmLeader()) {
    if (typeof toast === "function") toast("Инстанс запускает лидер — затем войдут все", "warn");
    return;
  }
  const modal = ensureInstanceModal();
  const body = document.getElementById("instanceModalBody");
  const locksR = await partyApi("/instance/locks?characterId=" + encodeURIComponent(state.activeCharacterId || ""));
  const locks = locksR.ok ? locksR.locks || {} : {};
  const list = typeof PARTY_DUNGEONS !== "undefined" ? PARTY_DUNGEONS : [];
  body.innerHTML = list
    .map((d) => {
      const lock = locks[d.id] || { clears: 0, max: d.weeklyClears || 3 };
      const left = Math.max(0, (lock.max || 3) - (lock.clears || 0));
      return (
        '<button type="button" class="instance-pick-btn" data-dungeon="' +
        d.id +
        '">' +
        "<strong>" +
        d.name +
        "</strong>" +
        "<small>" +
        d.desc +
        " · ур." +
        d.reqLevel +
        " · сила " +
        d.reqPower +
        "</small>" +
        "<span>Осталось " +
        left +
        "/" +
        (lock.max || 3) +
        " / нед.</span>" +
        "</button>"
      );
    })
    .join("");
  body.querySelectorAll("[data-dungeon]").forEach((btn) => {
    btn.onclick = () => startInstanceRun(btn.dataset.dungeon);
  });
  modal.hidden = false;
}

async function joinPartyInstance(st) {
  if (!st || !st.runId) {
    const r = await partyApi("/instance/active");
    if (!r.ok || !r.state) {
      if (typeof toast === "function") toast("Нет активного инстанса", "warn");
      return;
    }
    st = r.state;
  }
  if (typeof partyInstanceInfo !== "undefined") partyInstanceInfo = st;
  if (typeof partyLastPromptedInstanceId !== "undefined") partyLastPromptedInstanceId = st.runId;
  instanceRunState = st;
  instanceLootApplied = false;
  await enterInstanceMine(st);
}

async function startInstanceRun(dungeonId) {
  closeInstancePicker();
  const dungeon = typeof partyDungeonById === "function" ? partyDungeonById(dungeonId) : null;
  if (!dungeon) return;
  if (typeof avatarFarmPower === "function" && avatarFarmPower() < dungeon.reqPower) {
    if (typeof toast === "function") toast("Недостаточно силы для инстанса", "warn");
    return;
  }
  if ((state.avatar?.level || 1) < dungeon.reqLevel) {
    if (typeof toast === "function") toast("Нужен уровень " + dungeon.reqLevel, "warn");
    return;
  }
  const party = typeof getChatParty === "function" ? getChatParty() : null;
  const under = ((party && party.members) || []).filter((m) => {
    const lv =
      typeof partyMemberEffectiveLevel === "function"
        ? partyMemberEffectiveLevel(m)
        : m.level == null || m.level === ""
          ? null
          : Math.max(1, Math.floor(Number(m.level) || 0)) || null;
    return lv != null && lv < (dungeon.reqLevel || 1);
  });
  if (under.length) {
    const names = under
      .slice(0, 3)
      .map((m) => (typeof partyMemberLabel === "function" ? partyMemberLabel(m) : m.nick || "?"))
      .join(", ");
    if (typeof toast === "function") {
      toast("Ур. " + dungeon.reqLevel + "+ нужен всей группе" + (names ? ": " + names : ""), "warn");
    }
    return;
  }
  const levels = {};
  const powers = {};
  const characterIds = {};
  for (const m of (party && party.members) || []) {
    if (m && m.userId != null) {
      const lv =
        typeof partyMemberEffectiveLevel === "function"
          ? partyMemberEffectiveLevel(m)
          : Math.max(1, Math.floor(Number(m.level) || 1));
      if (lv != null) levels[m.userId] = lv;
      if (m.power != null) powers[m.userId] = Math.max(1, Math.floor(Number(m.power) || 1));
    }
  }
  const myNick =
    (typeof readCloudAuth === "function" && readCloudAuth()?.nick) ||
    (typeof cloudAuth !== "undefined" && cloudAuth?.nick) ||
    "";
  const meMember = ((party && party.members) || []).find((m) =>
    typeof partyMemberIsMe === "function" ? partyMemberIsMe(m, myNick) : false
  );
  const myId = meMember?.userId;
  if (myId != null) {
    levels[myId] = Math.max(1, Math.floor(Number(state.avatar?.level) || 1));
    powers[myId] = typeof avatarFarmPower === "function" ? avatarFarmPower() : 80;
    characterIds[myId] = state.activeCharacterId || "";
  }
  const r = await partyApi("/instance/start", {
    method: "POST",
    body: {
      dungeonId,
      power: typeof avatarFarmPower === "function" ? avatarFarmPower() : 80,
      characterId: state.activeCharacterId || "",
      levels,
      powers,
      characterIds,
    },
  });
  if (!r.ok) {
    if (typeof toast === "function") toast(r.error || "Не удалось начать", "warn");
    return;
  }
  instanceRunState = r.state;
  instanceLootApplied = false;
  if (typeof partyInstanceInfo !== "undefined") partyInstanceInfo = r.state;
  if (typeof partyLastPromptedInstanceId !== "undefined") partyLastPromptedInstanceId = r.state.runId;
  if (r.state.status === "ready") {
    if (typeof toast === "function") toast("Инстанс создан — члены группы получат приглашение войти", "info");
  }
  await enterInstanceMine(r.state);
}

async function instanceMarkReady() {
  if (!instanceRunState?.runId) return;
  const r = await partyApi("/instance/" + instanceRunState.runId + "/ready", {
    method: "POST",
    body: {
      ready: true,
      power: typeof avatarFarmPower === "function" ? avatarFarmPower() : 80,
      characterId: state.activeCharacterId || "",
    },
  });
  if (r.ok && r.state) {
    instanceRunState = r.state;
    syncInstanceEncounter(r.state);
  }
}

function ensureInstanceHud() {
  let hud = document.getElementById("instanceHud");
  // Не в mineStageInner: там line-height:0 — текст HUD схлопывается в кашу
  const host =
    document.getElementById("minefield") ||
    document.getElementById("screen-mine");
  if (!host) return null;
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "instanceHud";
    hud.className = "instance-hud";
    hud.hidden = true;
    host.appendChild(hud);
  } else if (hud.parentElement !== host) {
    host.appendChild(hud);
  }
  return hud;
}

function ensureInstanceReadyGate() {
  let gate = document.getElementById("instanceReadyGate");
  const host =
    document.getElementById("minefield") ||
    document.getElementById("screen-mine");
  if (!host) return null;
  if (!gate) {
    gate = document.createElement("div");
    gate.id = "instanceReadyGate";
    gate.className = "instance-ready-gate";
    gate.hidden = true;
    host.appendChild(gate);
  } else if (gate.parentElement !== host) {
    host.appendChild(gate);
  }
  return gate;
}

function hideInstanceReadyGate() {
  const gate = document.getElementById("instanceReadyGate");
  if (gate) gate.hidden = true;
}

function instanceEsc(s) {
  if (typeof escHtml === "function") return escHtml(s);
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInstanceReadyGate(st) {
  const gate = ensureInstanceReadyGate();
  if (!gate) return;
  if (!st || st.status !== "ready") {
    gate.hidden = true;
    return;
  }
  gate.hidden = false;
  const members = st.members || [];
  const readyN = members.filter((m) => m.ready).length;
  const readyTotal = members.length || 0;
  const myNick = typeof chatMyNick === "function" ? chatMyNick() : "";
  const myCid = state.activeCharacterId || "";
  const me =
    members.find((m) => myCid && m.characterId === myCid) ||
    members.find((m) => myNick && m.nick === myNick) ||
    null;
  const iAmReady = !!(me && me.ready);
  const slots = members
    .map((m) => {
      const isMe = !!(me && ((myCid && m.characterId === myCid) || (myNick && m.nick === myNick)));
      return (
        '<div class="instance-ready-slot' +
        (m.ready ? " is-ready" : "") +
        (isMe ? " is-me" : "") +
        '">' +
        '<span class="instance-ready-dot" aria-hidden="true"></span>' +
        '<span class="instance-ready-name">' +
        instanceEsc(m.nick || "?") +
        (isMe ? " (ты)" : "") +
        "</span>" +
        '<span class="instance-ready-mark">' +
        (m.ready ? "✓" : "…") +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  gate.innerHTML =
    '<div class="instance-ready-card">' +
    '<div class="instance-ready-kicker">Инстанс</div>' +
    '<div class="instance-ready-title">' +
    instanceEsc(st.dungeonName || "Инстанс") +
    "</div>" +
    '<div class="instance-ready-count">' +
    readyN +
    " / " +
    readyTotal +
    " готовы</div>" +
    '<div class="instance-ready-slots">' +
    slots +
    "</div>" +
    '<button type="button" class="instance-ready-btn' +
    (iAmReady ? " is-done" : "") +
    '" id="instanceHudReady"' +
    (iAmReady ? " disabled" : "") +
    ">" +
    (iAmReady ? "Ожидаем группу…" : "Готов") +
    "</button>" +
    "</div>";
  const btn = document.getElementById("instanceHudReady");
  if (btn && !iAmReady) btn.onclick = () => instanceMarkReady();
}

function renderInstanceHud(st) {
  const hud = ensureInstanceHud();
  if (!hud) return;
  // Не рисуем инст-HUD поверх соло-фарма / Закена
  if (
    typeof mineSession !== "undefined" &&
    mineSession &&
    !mineSession.instance
  ) {
    hud.hidden = true;
    hideInstanceReadyGate();
    return;
  }
  if (!st || (st.status !== "active" && st.status !== "ready" && st.status !== "cleared")) {
    hud.hidden = true;
    hideInstanceReadyGate();
    return;
  }
  renderInstanceReadyGate(st);
  if (st.status === "ready") {
    hud.hidden = true;
    return;
  }
  hud.hidden = false;
  const enc = st.encounter;
  const dungeon = typeof partyDungeonById === "function" ? partyDungeonById(st.dungeonId) : null;
  const maxLives = Math.max(1, Number(dungeon?.lives || st.lives || 3));
  const lives = Math.max(0, Number(st.lives != null ? st.lives : maxLives));
  let hearts = "";
  for (let i = 0; i < maxLives; i++) {
    hearts +=
      '<span class="instance-hud-heart' +
      (i < lives ? " on" : "") +
      '" aria-hidden="true">♥</span>';
  }
  const waveTotal = (dungeon?.waves && dungeon.waves.length) || 5;
  const waveLabel =
    st.phase === "boss"
      ? "БОСС"
      : st.phase === "wave"
        ? "Волна " + ((st.waveIndex || 0) + 1) + "/" + waveTotal
        : st.status === "cleared"
          ? "Победа"
          : String(st.status || "");

  const enrageSec =
    enc && enc.enrageInMs != null ? Math.max(0, Math.ceil(enc.enrageInMs / 1000)) : null;
  const enrageChip =
    enrageSec != null
      ? '<div class="instance-hud-chip instance-hud-chip-enrage" title="До ярости босса">' +
        '<span class="instance-hud-chip-k">Ярость</span>' +
        '<span class="instance-hud-chip-v">' +
        enrageSec +
        "с</span></div>"
      : '<div class="instance-hud-chip instance-hud-chip-ghost" aria-hidden="true"></div>';

  const buff = st.partyDamageBuff;
  const buffLeft =
    buff && buff.until > Date.now() && buff.mult > 1
      ? Math.max(0, Math.ceil((buff.until - Date.now()) / 1000))
      : null;
  const buffPct = buffLeft != null ? Math.round((buff.mult - 1) * 100) : 0;
  const buffChip =
    buffLeft != null
      ? '<div class="instance-hud-chip instance-hud-chip-buff" title="' +
        (buff.name || "Бафф группы") +
        '">' +
        '<span class="instance-hud-chip-k">Группа</span>' +
        '<span class="instance-hud-chip-v">+' +
        buffPct +
        "% · " +
        buffLeft +
        "с</span></div>"
      : "";

  let phaseBlock = "";
  if (st.phase === "boss" && enc) {
    const label = enc.phaseLabel || "Босс";
    const mech = enc.mechanic || "";
    let tip = "Держите давление";
    let cls = "is-tough";
    if (mech === "anvil") {
      tip = "Несколько раундов кузни: бей только свой цвет · скорость растёт";
      cls = "is-anvil";
    } else if (mech === "shield") {
      tip = "Бейте кристаллы вокруг босса";
      cls = "is-shield";
    } else if (mech === "adds") {
      tip = "Убейте теней до дедлайна — иначе −жизнь";
      cls = "is-adds";
    } else if (mech === "channel") {
      tip = enc.channelActive
        ? "КАСТ! Прервите скиллом!"
        : "Готовьтесь прервать канал скиллом";
      cls = enc.channelActive ? "is-channel is-channel-hot" : "is-channel";
    } else if (mech === "regen") {
      tip = "Реген каждые 2с — скилл гасит один тик";
      cls = "is-regen";
    } else if (mech === "tough") {
      tip = "Усиленная броня";
      cls = "is-tough";
    }
    const stones = Array.isArray(enc.shieldStones) ? enc.shieldStones.filter((s) => !s.dead) : [];
    let stoneLine = "";
    if (enc.anvilActive || mech === "anvil") {
      const prog = Math.max(0, Math.floor(Number(enc.anvilProgress) || 0));
      const goal = Math.max(1, Math.floor(Number(enc.anvilGoal) || 1));
      const pct = Math.max(0, Math.min(100, Math.round((prog / goal) * 100)));
      const fails = Math.max(0, Math.floor(Number(enc.anvilFails) || 0));
      const failMax = Math.max(1, Math.floor(Number(enc.anvilFailMax) || 10));
      const failPct = Math.max(0, Math.min(100, Math.round((fails / failMax) * 100)));
      const me = instanceAnvilSelfPlayer(st);
      const players = Array.isArray(enc.anvilPlayers) ? enc.anvilPlayers : [];
      const chips = players
        .map((p) => {
          const mine = me && String(p.userId) === String(me.userId);
          return (
            '<span class="instance-hud-anvil-chip' +
            (mine ? " is-me" : "") +
            '" style="--anvil-c:' +
            instanceEsc(p.color || "#ffb040") +
            '">' +
            instanceEsc(p.nick || "?") +
            (mine ? " · ты" : "") +
            "</span>"
          );
        })
        .join("");
      stoneLine =
        '<div class="instance-hud-anvil">' +
        '<div class="instance-hud-anvil-players">' +
        chips +
        "</div>" +
        '<div class="instance-hud-anvil-row">' +
        '<span class="instance-hud-anvil-label">⚒ Кузня</span>' +
        '<span class="instance-hud-anvil-prog">' +
        prog +
        " / " +
        goal +
        "</span>" +
        '<span class="instance-hud-anvil-fail" title="Ошибки до вайпа">' +
        "☠ " +
        fails +
        "/" +
        failMax +
        "</span>" +
        "</div>" +
        '<div class="instance-hud-anvil-bar" aria-hidden="true"><i style="width:' +
        pct +
        '%"></i></div>' +
        '<div class="instance-hud-anvil-failbar" aria-hidden="true"><i style="width:' +
        failPct +
        '%"></i></div>' +
        "</div>";
    } else if (enc.addsActive || mech === "adds") {
      const adds = Array.isArray(enc.adds) ? enc.adds : [];
      const alive = adds.filter((a) => a && !a.dead).length;
      const total = adds.length || alive;
      const leftSec =
        enc.addsInMs != null ? Math.max(0, Math.ceil(Number(enc.addsInMs) / 1000)) : null;
      const totalMs = Math.max(1, Number(enc.addsDeadlineMs) || 18000);
      const leftMs = enc.addsInMs != null ? Math.max(0, Number(enc.addsInMs)) : totalMs;
      const pct = Math.max(0, Math.min(100, Math.round((leftMs / totalMs) * 100)));
      stoneLine =
        '<div class="instance-hud-adds">' +
        '<div class="instance-hud-adds-row">' +
        '<span class="instance-hud-adds-label">☠ Адды</span>' +
        '<span class="instance-hud-adds-prog">' +
        alive +
        " / " +
        total +
        "</span>" +
        (leftSec != null
          ? '<span class="instance-hud-adds-timer">' + leftSec + "с</span>"
          : "") +
        "</div>" +
        '<div class="instance-hud-adds-bar" aria-hidden="true"><i style="width:' +
        pct +
        '%"></i></div>' +
        "</div>";
    } else if (enc.channelArmed || enc.channelActive || mech === "channel") {
      const fails = Math.max(0, Math.floor(Number(enc.channelFails) || 0));
      const failMax = Math.max(1, Math.floor(Number(enc.channelFailMax) || 3));
      const failPct = Math.max(0, Math.min(100, Math.round((fails / failMax) * 100)));
      const windowMs = Math.max(1, Number(enc.channelWindowMs) || 2800);
      const leftMs = enc.channelActive && enc.channelInMs != null ? Math.max(0, Number(enc.channelInMs)) : 0;
      const castPct = enc.channelActive
        ? Math.max(0, Math.min(100, Math.round((leftMs / windowMs) * 100)))
        : 0;
      const leftSec = enc.channelActive ? Math.max(0, Math.ceil(leftMs / 1000)) : null;
      stoneLine =
        '<div class="instance-hud-channel' +
        (enc.channelActive ? " is-hot" : "") +
        '">' +
        '<div class="instance-hud-channel-row">' +
        '<span class="instance-hud-channel-label">' +
        (enc.channelActive ? "✦ КАСТ" : "✦ Канал") +
        "</span>" +
        (leftSec != null
          ? '<span class="instance-hud-channel-timer">' + leftSec + "с</span>"
          : '<span class="instance-hud-channel-wait">ожидание</span>') +
        '<span class="instance-hud-channel-fail" title="Провалы до вайпа">☠ ' +
        fails +
        "/" +
        failMax +
        "</span>" +
        "</div>" +
        '<div class="instance-hud-channel-bar" aria-hidden="true"><i style="width:' +
        castPct +
        '%"></i></div>' +
        '<div class="instance-hud-channel-failbar" aria-hidden="true"><i style="width:' +
        failPct +
        '%"></i></div>' +
        "</div>";
    } else if (enc.shieldActive || stones.length) {
      const parts = (enc.shieldStones || [])
        .map((s) => {
          if (s.dead) return '<span class="instance-hud-stone dead">✦</span>';
          return (
            '<span class="instance-hud-stone">' +
            "✦ " +
            (s.hits || 0) +
            "/" +
            (s.maxHits || 40) +
            "</span>"
          );
        })
        .join("");
      stoneLine =
        '<div class="instance-hud-stones"><span class="instance-hud-stones-label">Кристаллы</span>' +
        parts +
        "</div>";
    }
    phaseBlock =
      '<div class="instance-hud-phase ' +
      cls +
      '">' +
      '<div class="instance-hud-phase-head">' +
      '<div class="instance-hud-phase-name">' +
      instanceEsc(label) +
      "</div>" +
      '<div class="instance-hud-phase-tip">' +
      tip +
      "</div>" +
      "</div>" +
      stoneLine +
      "</div>";
  } else if (enc && enc.alive != null) {
    phaseBlock =
      '<div class="instance-hud-pack">Мобы ' + enc.alive + " / " + enc.total + "</div>";
  }

  hud.innerHTML =
    '<div class="instance-hud-top">' +
    '<div class="instance-hud-lives" title="Жизни группы">' +
    '<span class="instance-hud-lives-label">Жизни</span>' +
    '<span class="instance-hud-hearts">' +
    hearts +
    "</span>" +
    '<span class="instance-hud-lives-num">' +
    lives +
    "/" +
    maxLives +
    "</span>" +
    "</div>" +
    '<div class="instance-hud-wave">' +
    waveLabel +
    "</div>" +
    '<div class="instance-hud-chips">' +
    enrageChip +
    buffChip +
    "</div>" +
    "</div>" +
    phaseBlock;
}

function playInstancePhaseFx(label, mechanic) {
  const stage = document.getElementById("minefield") || document.getElementById("mineStage");
  if (stage) {
    let flash = document.getElementById("instancePhaseFlash");
    if (!flash) {
      flash = document.createElement("div");
      flash.id = "instancePhaseFlash";
      flash.className = "instance-phase-flash";
      flash.setAttribute("aria-hidden", "true");
      stage.appendChild(flash);
    }
    flash.className =
      "instance-phase-flash show" +
      (mechanic === "anvil" ? " fx-anvil" : "") +
      (mechanic === "shield" ? " fx-shield" : "") +
      (mechanic === "adds" ? " fx-adds" : "") +
      (mechanic === "channel" ? " fx-channel" : "") +
      (mechanic === "regen" ? " fx-regen" : "") +
      (mechanic === "tough" ? " fx-tough" : "");
    if (instancePhaseFxTimer) clearTimeout(instancePhaseFxTimer);
    instancePhaseFxTimer = setTimeout(() => {
      flash.className = "instance-phase-flash";
      flash.style.opacity = "0";
    }, 700);
  }
  const bossEl = instanceDomMob || (instanceDomMobs.size ? [...instanceDomMobs.values()][0] : null);
  if (bossEl) {
    bossEl.classList.remove(
      "inst-phase-shield",
      "inst-phase-anvil",
      "inst-phase-adds",
      "inst-phase-channel",
      "inst-phase-regen",
      "inst-phase-tough",
      "inst-phase-pop"
    );
    void bossEl.offsetWidth;
    if (mechanic === "anvil") bossEl.classList.add("inst-phase-anvil");
    else if (mechanic === "shield") bossEl.classList.add("inst-phase-shield");
    else if (mechanic === "adds") bossEl.classList.add("inst-phase-adds");
    else if (mechanic === "channel") bossEl.classList.add("inst-phase-channel");
    else if (mechanic === "regen") bossEl.classList.add("inst-phase-regen");
    else bossEl.classList.add("inst-phase-tough");
    bossEl.classList.add("inst-phase-pop");
    const rect = bossEl.getBoundingClientRect();
    const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
    const fr = field ? field.getBoundingClientRect() : null;
    if (typeof mineBurst === "function" && fr) {
      const x = rect.left + rect.width / 2 - fr.left;
      const y = rect.top + rect.height / 2 - fr.top;
      const color =
        mechanic === "anvil"
          ? "#ff8a3a"
          : mechanic === "shield"
            ? "#5aa8ff"
            : mechanic === "adds"
              ? "#5ad4c0"
              : mechanic === "channel"
                ? "#b48cff"
                : mechanic === "regen"
                  ? "#4fd878"
                  : "#e8a84a";
      mineBurst(x, y, color, 18);
    }
  }
  if (typeof toast === "function" && label) {
    toast("Фаза: " + label, mechanic === "regen" || mechanic === "channel" ? "warn" : "loot");
  }
}

function syncInstanceBossVisual(st) {
  const enc = st && st.encounter;
  if (!enc || enc.kind !== "boss") {
    instanceLastPhaseLabel = "";
    clearInstanceShieldStones();
    clearInstanceAnvilMarks();
    clearInstanceAdds();
    return;
  }
  const label = enc.phaseLabel || "";
  const mech = enc.mechanic || "";
  for (const g of instanceDomMobs.values()) {
    if (!g) continue;
    // Не вешаем mob-shielded на босса — ломает спрайт; аура через inst-phase-*
    g.classList.toggle("inst-phase-anvil", mech === "anvil");
    g.classList.toggle("inst-phase-shield", mech === "shield");
    g.classList.toggle("inst-phase-adds", mech === "adds");
    g.classList.toggle("inst-phase-channel", mech === "channel" || !!enc.channelActive);
    g.classList.toggle("inst-phase-regen", mech === "regen");
    g.classList.toggle("inst-phase-tough", mech === "tough" || (!mech && !!label));
    g.classList.toggle("inst-channel-casting", !!enc.channelActive);
  }
  if (label && label !== instanceLastPhaseLabel) {
    if (instanceLastPhaseLabel) playInstancePhaseFx(label, mech);
    instanceLastPhaseLabel = label;
  }
  if (enc.anvilActive) {
    clearInstanceShieldStones();
    clearInstanceAdds();
    syncInstanceAnvilMarks(st);
  } else if (enc.addsActive) {
    clearInstanceAnvilMarks();
    clearInstanceShieldStones();
    syncInstanceAdds(st);
  } else {
    clearInstanceAnvilMarks();
    clearInstanceAdds();
    syncInstanceShieldStones(st);
  }
}

function clearInstanceShieldLinks() {
  const svg = document.getElementById("instanceShieldLinks");
  if (svg) svg.remove();
}

function syncInstanceShieldLinks() {
  const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
  if (!field) return;
  const bossEl = instanceDomMob || (instanceDomMobs.size ? [...instanceDomMobs.values()][0] : null);
  const stones = [...(instanceDomStones?.values?.() || [])].filter((g) => g && g.isConnected);
  if (!bossEl || !stones.length) {
    clearInstanceShieldLinks();
    return;
  }
  let svg = document.getElementById("instanceShieldLinks");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "instanceShieldLinks";
    svg.classList.add("instance-shield-links");
    svg.setAttribute("aria-hidden", "true");
    field.appendChild(svg);
  }
  const fr = field.getBoundingClientRect();
  svg.setAttribute("width", String(Math.max(1, Math.round(fr.width))));
  svg.setAttribute("height", String(Math.max(1, Math.round(fr.height))));
  svg.setAttribute("viewBox", "0 0 " + Math.round(fr.width) + " " + Math.round(fr.height));
  const br = bossEl.getBoundingClientRect();
  const bx = br.left + br.width / 2 - fr.left;
  const by = br.top + br.height * 0.45 - fr.top;
  let html = "";
  for (const g of stones) {
    const sr = g.getBoundingClientRect();
    const sx = sr.left + sr.width / 2 - fr.left;
    const sy = sr.top + sr.height * 0.4 - fr.top;
    const mx = (bx + sx) / 2 + (sy - by) * 0.08;
    const my = (by + sy) / 2 - (sx - bx) * 0.06;
    const d = "M" + bx + "," + by + " Q" + mx + "," + my + " " + sx + "," + sy;
    html +=
      '<path class="instance-shield-bolt-glow" d="' +
      d +
      '" fill="none"></path>' +
      '<path class="instance-shield-bolt" d="' +
      d +
      '" fill="none"></path>';
  }
  svg.innerHTML = html;
}

function clearInstanceAnvilMarks() {
  stopInstanceAnvilRingTick();
  if (!instanceDomAnvilMarks || !instanceDomAnvilMarks.size) return;
  for (const g of [...instanceDomAnvilMarks.values()]) {
    try {
      if (typeof mineGnomes !== "undefined" && mineGnomes) mineGnomes.delete(g);
      if (g && g.remove) g.remove();
    } catch (_) {}
  }
  instanceDomAnvilMarks.clear();
}

function instanceAnvilSelfPlayer(st) {
  const enc = st && st.encounter;
  const players = (enc && enc.anvilPlayers) || [];
  if (!players.length) return null;
  const youId = st && st.youUserId;
  if (youId != null) {
    const byId = players.find((p) => String(p.userId) === String(youId));
    if (byId) return byId;
  }
  const nick = typeof getCloudNick === "function" ? getCloudNick() : null;
  if (nick) {
    const byNick = players.find((p) => String(p.nick).toLowerCase() === String(nick).toLowerCase());
    if (byNick) return byNick;
  }
  return players[0] || null;
}

function instanceAnvilMarkHtml(open) {
  return (
    '<div class="anvil-mark-core">' +
    '<svg class="anvil-mark-ring" viewBox="0 0 44 44" aria-hidden="true">' +
    '<circle class="anvil-mark-ring-bg" cx="22" cy="22" r="18"></circle>' +
    '<circle class="anvil-mark-ring-fg" cx="22" cy="22" r="18"></circle>' +
    "</svg>" +
    '<div class="anvil-mark-disc">' +
    '<svg class="anvil-mark-icon" viewBox="0 0 64 64" aria-hidden="true">' +
    '<path fill="currentColor" opacity=".35" d="M10 40h44l-4 10H14z"/>' +
    '<path fill="currentColor" opacity=".55" d="M18 34h28v8H18z"/>' +
    '<path fill="currentColor" d="M8 28h48v8H8z"/>' +
    '<path fill="#ffe6a0" d="M22 12l6 14h8L30 12z" opacity=".95"/>' +
    '<path stroke="#ffe6a0" stroke-width="3" stroke-linecap="round" fill="none" d="M38 8l10 18"/>' +
    '<circle cx="48" cy="28" r="4" fill="#ffe6a0"/>' +
    "</svg>" +
    '<div class="anvil-mark-call">' +
    (open ? "БЕЙ!" : "жди") +
    "</div>" +
    "</div>" +
    '<div class="anvil-mark-mine-tag" hidden>ТВОЙ</div>' +
    "</div>"
  );
}

function syncInstanceAnvilMarkRing(g, mark, windowMs) {
  if (!g || !mark) return;
  const fg = g.querySelector(".anvil-mark-ring-fg");
  if (!fg) return;
  const c = 2 * Math.PI * 18;
  fg.style.strokeDasharray = String(c);
  if (!mark.windowOpen) {
    fg.style.strokeDashoffset = String(c);
    return;
  }
  const ends = Number(mark.openEndsAt) || 0;
  const left = Math.max(0, ends - Date.now());
  const total = Math.max(400, Number(windowMs) || 1400);
  const t = Math.max(0, Math.min(1, left / total));
  fg.style.strokeDashoffset = String(c * (1 - t));
}

let instanceAnvilRingRaf = 0;
function stopInstanceAnvilRingTick() {
  if (instanceAnvilRingRaf) {
    cancelAnimationFrame(instanceAnvilRingRaf);
    instanceAnvilRingRaf = 0;
  }
}
function startInstanceAnvilRingTick() {
  stopInstanceAnvilRingTick();
  const tick = () => {
    instanceAnvilRingRaf = 0;
    const st = instanceRunState;
    const enc = st && st.encounter;
    if (!enc || !enc.anvilActive || !instanceDomAnvilMarks.size) return;
    const windowMs = enc.anvilWindowMs || 1400;
    const byId = new Map((enc.anvilMarks || []).map((m) => [m.id, m]));
    for (const [id, g] of instanceDomAnvilMarks) {
      syncInstanceAnvilMarkRing(g, byId.get(id), windowMs);
    }
    instanceAnvilRingRaf = requestAnimationFrame(tick);
  };
  instanceAnvilRingRaf = requestAnimationFrame(tick);
}

function syncInstanceAnvilMarks(st) {
  const enc = st && st.encounter;
  const marks = enc && enc.anvilActive && Array.isArray(enc.anvilMarks) ? enc.anvilMarks : [];
  const aliveIds = new Set(marks.map((m) => m.id));
  for (const [id, g] of [...instanceDomAnvilMarks.entries()]) {
    if (!aliveIds.has(id)) {
      try {
        if (typeof mineGnomes !== "undefined" && mineGnomes) mineGnomes.delete(g);
        if (g && g.remove) g.remove();
      } catch (_) {}
      instanceDomAnvilMarks.delete(id);
    }
  }
  if (!marks.length || !enc.anvilActive) {
    clearInstanceAnvilMarks();
    return;
  }
  const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
  if (!field) return;
  const layout = [
    { left: 18, top: 44 },
    { left: 82, top: 44 },
    { left: 20, top: 58 },
    { left: 80, top: 58 },
    { left: 28, top: 70 },
    { left: 72, top: 70 },
    { left: 14, top: 52 },
    { left: 86, top: 52 },
  ];
  const windowMs = enc.anvilWindowMs || 1400;
  const me = instanceAnvilSelfPlayer(st);
  const myId = me && me.userId;
  marks.forEach((m, idx) => {
    let g = instanceDomAnvilMarks.get(m.id);
    const fallback = layout[idx] || layout[idx % layout.length] || layout[0];
    let left = Number.isFinite(Number(m.left)) ? Number(m.left) : fallback.left;
    let top = Number.isFinite(Number(m.top)) ? Number(m.top) : fallback.top;
    // Не даём клиенту поставить шар поверх босса (центр ~50/42)
    {
      const bossL = 50;
      const bossT = 42;
      const clear = 24;
      const dbx = left - bossL;
      const dby = top - bossT;
      const d2 = dbx * dbx + dby * dby;
      if (d2 < clear * clear) {
        const d = Math.sqrt(Math.max(0.01, d2));
        left = bossL + (dbx / d) * clear;
        top = bossT + (dby / d) * clear;
        if (Math.abs(dbx) < 0.1 && Math.abs(dby) < 0.1) {
          left = idx % 2 === 0 ? 18 : 82;
          top = 56;
        }
      }
    }
    left = Math.max(14, Math.min(86, left));
    top = Math.max(38, Math.min(74, top));
    const open = !!m.windowOpen;
    const color = m.color || "#ffb040";
    const mine = myId != null && String(m.ownerUserId) === String(myId);
    if (!g) {
      g = document.createElement("div");
      g.className = "gnome mine-solo instance-anvil-mark mob-sprite-kind";
      g._type = "normal";
      g._instanceEncounter = true;
      g._instanceAnvil = true;
      g._instanceMobId = m.id;
      g._instanceEncId = enc.id;
      g._anvilOwnerId = m.ownerUserId;
      g._hp = 1;
      g._maxHp = 1;
      g._shieldHp = 0;
      g._x = 0;
      g._y = 0;
      g.innerHTML = instanceAnvilMarkHtml(open);
      g.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (typeof instanceHandleHit === "function") instanceHandleHit(g, {});
      });
      field.appendChild(g);
      if (typeof mineGnomes !== "undefined" && mineGnomes) mineGnomes.add(g);
      instanceDomAnvilMarks.set(m.id, g);
    }
    g.style.left = left + "%";
    g.style.top = top + "%";
    g.style.transform = "translate(-50%, -50%)";
    g.style.setProperty("--anvil-c", color);
    g._anvilOwnerId = m.ownerUserId;
    const wasOpen = g.classList.contains("is-open");
    g.classList.toggle("is-open", open);
    g.classList.toggle("is-closed", !open);
    g.classList.toggle("is-mine", !!mine);
    if (open && !wasOpen) {
      g.classList.remove("anvil-flash");
      void g.offsetWidth;
      g.classList.add("anvil-flash");
    }
    const call = g.querySelector(".anvil-mark-call");
    if (call) call.textContent = open ? (mine ? "БЕЙ!" : "чужой") : "жди";
    const tag = g.querySelector(".anvil-mark-mine-tag");
    if (tag) tag.hidden = !mine;
    syncInstanceAnvilMarkRing(g, m, windowMs);
  });
  startInstanceAnvilRingTick();
}

function playInstanceAnvilHitFx(g, r) {
  if (!g) return;
  const rect = g.getBoundingClientRect();
  const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
  const fr = field ? field.getBoundingClientRect() : null;
  const x = fr ? rect.left + rect.width / 2 - fr.left : rect.left + rect.width / 2;
  const y = fr ? rect.top + rect.height / 2 - fr.top : rect.top;
  if (r && r.windowHit && r.colorOk) {
    g.classList.remove("anvil-hit-good");
    void g.offsetWidth;
    g.classList.add("anvil-hit-good");
    if (typeof mineBurst === "function") mineBurst(x, y, "#ffb040", 14);
    if (typeof floatText === "function") {
      const sc = Number(r.score) || 1;
      floatText(x, y - 18, (sc > 0 ? "+" : "") + sc + " ⚒", "#ffd27a");
    }
  } else {
    g.classList.remove("anvil-hit-bad");
    void g.offsetWidth;
    g.classList.add("anvil-hit-bad");
    if (typeof floatText === "function") {
      const msg = r && r.colorOk === false ? "не твой!" : "мимо";
      floatText(x, y - 14, msg, "#ff6a6a");
    }
  }
}

function clearInstanceShieldStones() {
  clearInstanceShieldLinks();
  if (!instanceDomStones || !instanceDomStones.size) return;
  for (const g of [...instanceDomStones.values()]) {
    try {
      if (typeof clearMobTimer === "function") clearMobTimer(g);
      if (typeof removeGnome === "function") removeGnome(g, "caught");
      else if (g && g.remove) g.remove();
    } catch (_) {}
  }
  instanceDomStones.clear();
}

function clearInstanceAdds() {
  if (!instanceDomAdds || !instanceDomAdds.size) return;
  for (const g of [...instanceDomAdds.values()]) {
    try {
      if (typeof clearMobTimer === "function") clearMobTimer(g);
      if (typeof removeGnome === "function") removeGnome(g, "caught");
      else if (g && g.remove) g.remove();
    } catch (_) {}
  }
  instanceDomAdds.clear();
}

function syncInstanceAdds(st) {
  const enc = st && st.encounter;
  const adds = enc && enc.addsActive && Array.isArray(enc.adds) ? enc.adds : [];
  const aliveIds = new Set(adds.filter((a) => a && !a.dead).map((a) => a.id));
  for (const [id, g] of [...instanceDomAdds.entries()]) {
    if (!aliveIds.has(id)) {
      try {
        if (typeof clearMobTimer === "function") clearMobTimer(g);
        if (typeof removeGnome === "function") removeGnome(g, "caught");
        else g.remove();
      } catch (_) {}
      instanceDomAdds.delete(id);
    }
  }
  if (!adds.length || !enc.addsActive) return;
  const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
  if (!field || typeof spawnSoloMob !== "function") return;
  adds.forEach((a) => {
    if (!a || a.dead) return;
    let g = instanceDomAdds.get(a.id);
    const left = Number.isFinite(Number(a.left)) ? Number(a.left) : 22;
    const top = Number.isFinite(Number(a.top)) ? Number(a.top) : 58;
    if (!g) {
      const mobStem = a.mob || "whisper-shade";
      const src = "assets/mobs/" + mobStem + ".png";
      const sprite = {
        src: typeof mineAssetUrl === "function" ? mineAssetUrl(src) : src + "?v=1",
        kind: "sprite",
        cls: "instance-add-mob",
        label: a.name || "Тень",
      };
      spawnSoloMob(field, "normal", { name: a.name || "Тень", sprite });
      let newest = null;
      for (const x of mineGnomes) newest = x;
      if (!newest) return;
      newest._instanceEncounter = true;
      newest._instanceAdd = true;
      newest._instanceMobId = a.id;
      newest._instanceEncId = enc.id;
      newest._hp = Math.max(0, a.hp || 0);
      newest._maxHp = Math.max(1, a.maxHp || a.hp || 1);
      newest._shieldHp = 0;
      if (typeof clearMobTimer === "function") clearMobTimer(newest);
      newest._onExpire = null;
      newest.style.left = left + "%";
      newest.style.top = top + "%";
      newest.style.transform = "translate(-50%, -50%) scale(0.78)";
      newest.classList.add("instance-add-mob", "mob-sprite-kind");
      newest.classList.remove("mob-shielded", "target-icon");
      if (typeof updateMobHpBar === "function") updateMobHpBar(newest);
      instanceDomAdds.set(a.id, newest);
      g = newest;
    } else {
      g.style.left = left + "%";
      g.style.top = top + "%";
      g._hp = Math.max(0, a.hp || 0);
      g._maxHp = Math.max(1, a.maxHp || a.hp || 1);
      if (typeof updateMobHpBar === "function") updateMobHpBar(g);
    }
  });
}

function syncInstanceShieldStones(st) {
  const enc = st && st.encounter;
  const stones = enc && enc.shieldActive && Array.isArray(enc.shieldStones) ? enc.shieldStones : [];
  const aliveIds = new Set(stones.filter((s) => !s.dead).map((s) => s.id));
  for (const [id, g] of [...instanceDomStones.entries()]) {
    if (!aliveIds.has(id)) {
      try {
        if (typeof clearMobTimer === "function") clearMobTimer(g);
        if (typeof removeGnome === "function") removeGnome(g, "caught");
        else g.remove();
      } catch (_) {}
      instanceDomStones.delete(id);
    }
  }
  if (!stones.length || !enc.shieldActive) {
    clearInstanceShieldLinks();
    return;
  }
  const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
  if (!field || typeof spawnSoloMob !== "function") return;
  // Только по бокам — низ перекрывал панель скиллов
  const layout = [
    { left: 10, top: 28 },
    { left: 90, top: 28 },
    { left: 10, top: 62 },
  ];
  stones.forEach((s, idx) => {
    if (s.dead) return;
    let g = instanceDomStones.get(s.id);
    const pos = layout[idx] || layout[idx % layout.length] || layout[0];
    if (!g) {
      const crystalSrc = "assets/mobs/shield-crystal-v2.png";
      const sprite = {
        src: typeof mineAssetUrl === "function" ? mineAssetUrl(crystalSrc) : crystalSrc + "?v=16",
        kind: "sprite",
        cls: "instance-shield-stone",
        label: s.name || "Кристалл щита",
      };
      spawnSoloMob(field, "normal", { name: s.name || "Кристалл щита", sprite });
      let newest = null;
      for (const x of mineGnomes) newest = x;
      if (!newest) return;
      newest._instanceEncounter = true;
      newest._instanceStone = true;
      newest._instanceMobId = s.id;
      newest._instanceEncId = enc.id;
      newest._hp = Math.max(0, (s.maxHits || 40) - (s.hits || 0));
      newest._maxHp = s.maxHits || 40;
      newest._shieldHp = 0;
      if (typeof clearMobTimer === "function") clearMobTimer(newest);
      newest._onExpire = null;
      newest.style.left = pos.left + "%";
      newest.style.top = pos.top + "%";
      newest.style.transform = "translate(-50%, -50%)";
      newest.classList.add("instance-shield-stone", "mob-sprite-kind");
      newest.classList.remove("mob-shielded", "target-icon");
      if (typeof updateMobHpBar === "function") updateMobHpBar(newest);
      instanceDomStones.set(s.id, newest);
      g = newest;
    } else {
      g.style.left = pos.left + "%";
      g.style.top = pos.top + "%";
      g.style.transform = "translate(-50%, -50%)";
      g._hp = Math.max(0, (s.maxHits || 40) - (s.hits || 0));
      g._maxHp = s.maxHits || 40;
      if (typeof updateMobHpBar === "function") updateMobHpBar(g);
    }
  });
  syncInstanceShieldLinks();
}

function instanceClearDom() {
  clearInstanceShieldStones();
  clearInstanceAnvilMarks();
  clearInstanceAdds();
  if (instanceDomMobs && instanceDomMobs.size) {
    for (const g of [...instanceDomMobs.values()]) {
      try {
        if (typeof removeGnome === "function") removeGnome(g);
        else if (g && g.remove) g.remove();
      } catch (_) {}
    }
    instanceDomMobs.clear();
  }
  if (instanceDomMob) {
    try {
      if (typeof removeGnome === "function") removeGnome(instanceDomMob);
      else instanceDomMob.remove();
    } catch (_) {}
    instanceDomMob = null;
  }
  instanceLastEncId = null;
}

function kickFromInstance(opts) {
  opts = opts || {};
  if (instanceExitHandled) return;
  instanceExitHandled = true;
  stopInstancePoll();
  instanceClearDom();
  hideInstanceReadyGate();
  const hud = document.getElementById("instanceHud");
  if (hud) hud.hidden = true;
  if (typeof clearInstanceShieldLinks === "function") clearInstanceShieldLinks();
  if (opts.toast && typeof toast === "function") {
    toast(opts.toast, opts.toastKind || "warn");
  }
  // stopMine → instanceAfterStopMine (leave + cleanup)
  if (typeof stopMine === "function") {
    try {
      stopMine();
    } catch (_) {}
  } else {
    instanceRunState = null;
  }
  if (opts.openParty !== false && typeof openPartyScreen === "function") {
    try {
      openPartyScreen();
    } catch (_) {}
  }
}

function syncInstanceEncounter(st) {
  // Соло-фарм: не поднимаем инст-HUD от запоздавшего poll
  if (typeof mineSession !== "undefined" && mineSession && !mineSession.instance) {
    return;
  }
  instanceRunState = st;
  renderInstanceHud(st);
  if (st && st.partyDamageBuff && st.partyDamageBuff.until > Date.now() && typeof mineSkillRuntime !== "undefined") {
    mineSkillRuntime.buffs = mineSkillRuntime.buffs || {};
    mineSkillRuntime.buffs.partyDamageMult = st.partyDamageBuff.mult || 1;
    mineSkillRuntime.buffs.partyDamageUntil = st.partyDamageBuff.until;
  }
  if (st && st.lastEvent && st.lastEvent !== instanceLastEventSeen) {
    instanceLastEventSeen = st.lastEvent;
    if (st.lastEvent === "party_damage_buff" && st.partyDamageBuff) {
      const pct = Math.round(((st.partyDamageBuff.mult || 1) - 1) * 100);
      const label = st.partyDamageBuff.name || "Клич группы";
      if (typeof toast === "function" && pct > 0) toast(label + ": группа +" + pct + "% урона", "info");
    }
    if (st.lastEvent === "boss_regen") {
      const heal = Math.max(0, Number(st.lastRegenHeal) || 0);
      if (typeof toast === "function") {
        toast(heal ? "Реген +" + heal.toLocaleString("ru-RU") : "Босс регенерирует!", "warn");
      }
      const bossEl = instanceDomMob || (instanceDomMobs.size ? [...instanceDomMobs.values()][0] : null);
      if (heal && bossEl && typeof floatText === "function" && typeof gnomeDropPoint === "function") {
        const p = gnomeDropPoint(bossEl);
        floatText(p.x, p.y - 20, "+" + heal.toLocaleString("ru-RU"), "#7dff9a");
      }
    }
    if (st.lastEvent === "enrage" || st.lastEvent === "idle_rampage" || st.lastEvent === "adds_fail" || st.lastEvent === "channel_fail") {
      if (typeof toast === "function" && st.lives != null) {
        toast("Потеряна жизнь! Осталось: " + st.lives, "warn");
      }
      if (st.lastEvent === "enrage") {
        // Новый enrage-окна на том же боссе — перезапустить визуальный таймер
        syncInstanceMobTimers(st, true);
      }
      if (st.lastEvent === "adds_fail" && typeof toast === "function") {
        toast("Адды не убиты вовремя!", "warn");
      }
      if (st.lastEvent === "channel_fail" && typeof toast === "function") {
        toast("Канал не прерван!", "warn");
      }
    }
    if (st.lastEvent === "channel_start" && typeof toast === "function") {
      toast("Босс кастует — прерви скиллом!", "warn");
    }
    if (st.lastEvent === "channel_interrupted" && typeof toast === "function") {
      toast("Канал прерван!", "loot");
    }
  }
  if (typeof renderMineSkillBar === "function") renderMineSkillBar();
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
  if (!st) return;
  if (st.status === "failed") {
    const reason =
      st.lastEvent === "anvil_fail"
        ? "Тиран Кузни казнил группу — провал наковальни!"
        : st.lastEvent === "adds_fail"
          ? "Адды разорвали группу — тени не убиты вовремя!"
          : st.lastEvent === "channel_fail"
            ? "Глас Шпиля дочитал канал — группа пала!"
            : st.phase === "undersized"
              ? "Группа распалась — инстанс закрыт"
              : st.lastEvent === "enrage" || st.phase === "wipe"
                ? "Жизни закончились — группа пала"
                : st.phase === "timeout"
                  ? "Время инстанса истекло"
                  : "Инстанс провален";
    showInstanceFailModal({
      dungeonName: st.dungeonName || "Инстанс",
      reason,
      lastEvent: st.lastEvent || "",
      phase: st.phase || "",
    });
    return;
  }
  if (!mineActive) return;
  if (st.status === "cleared") {
    instanceClearDom();
    if (!instanceLootApplied) {
      instanceLootApplied = true;
      applyInstanceLoot(st.lootByUser || st.loot);
    }
    stopInstancePoll();
    return;
  }
  const enc = st.encounter;
  if (!enc || st.status === "ready") {
    instanceClearDom();
    return;
  }
  const mobs = Array.isArray(enc.mobs) && enc.mobs.length
    ? enc.mobs
    : enc.targetId || enc.hp != null
      ? [{ id: enc.targetId || enc.id, name: enc.name, mob: enc.mob, hp: enc.hp, maxHp: enc.maxHp, dead: enc.hp <= 0, shieldHp: 0 }]
      : [];
  const packKey = enc.id + ":" + mobs.map((m) => m.id).join(",");
  if (instanceLastEncId !== packKey) {
    instanceClearDom();
    instanceLastEncId = packKey;
    const field = typeof mineSpawnField === "function" ? mineSpawnField() : null;
    if (!field || typeof spawnSoloMob !== "function") return;
    const alive = mobs.filter((m) => !m.dead);
    alive.forEach((m, idx) => {
      const type = enc.kind === "boss" ? "boss" : "normal";
      const src = "assets/mobs/" + (m.mob || "orc") + ".png";
      const sprite = {
        src: typeof mineAssetUrl === "function" ? mineAssetUrl(src) : src,
        kind: "sprite",
        cls: enc.kind === "boss" ? "target-elite" : "",
        label: m.name,
      };
      spawnSoloMob(field, type, { name: m.name, sprite });
      let newest = null;
      for (const g of mineGnomes) newest = g;
      if (!newest) return;
      newest._instanceEncounter = true;
      newest._instanceEncId = enc.id;
      newest._instanceMobId = m.id;
      newest._hp = m.hp;
      newest._maxHp = m.maxHp;
      newest._shieldHp = 0;
      newest._shieldMax = 0;
      newest.classList.remove("mob-shielded");
      // Пак / босс — по центру поля
      try {
        const n = alive.length;
        const layout =
          n <= 1
            ? [{ left: 50, top: 42 }]
            : n === 2
              ? [
                  { left: 36, top: 44 },
                  { left: 64, top: 44 },
                ]
              : n === 3
                ? [
                    { left: 30, top: 46 },
                    { left: 50, top: 38 },
                    { left: 70, top: 46 },
                  ]
                : [
                    { left: 34, top: 36 },
                    { left: 66, top: 36 },
                    { left: 34, top: 54 },
                    { left: 66, top: 54 },
                  ];
        const pos = layout[idx] || layout[0];
        newest.style.left = pos.left + "%";
        newest.style.top = pos.top + "%";
      } catch (_) {}
      if (typeof updateMobHpBar === "function") updateMobHpBar(newest);
      instanceDomMobs.set(m.id, newest);
      instanceDomMob = newest;
    });
    syncInstanceMobTimers(st, true);
    syncInstanceBossVisual(st);
    return;
  }
  // Update HP bars
  for (const m of mobs) {
    const g = instanceDomMobs.get(m.id);
    if (!g) continue;
    if (m.dead) {
      try {
        if (typeof clearMobTimer === "function") clearMobTimer(g);
        if (typeof removeGnome === "function") removeGnome(g, "caught");
        else g.remove();
      } catch (_) {}
      instanceDomMobs.delete(m.id);
      try {
        const caught = (parseInt($("#mineCaught").textContent) || 0) + 1;
        $("#mineCaught").textContent = caught;
        if (mineSession) mineSession.kills = (mineSession.kills || 0) + 1;
      } catch (_) {}
      continue;
    }
    g._hp = m.hp;
    g._maxHp = m.maxHp;
    // Камни щита — отдельный encounter; HP-щит на боссе не рисуем
    g._shieldHp = 0;
    g._shieldMax = 0;
    g.classList.remove("mob-shielded");
    if (typeof updateMobHpBar === "function") updateMobHpBar(g);
  }
  syncInstanceMobTimers(st, false);
  syncInstanceBossVisual(st);
  if (st.encounter && st.encounter.shieldActive) syncInstanceShieldLinks();
  else clearInstanceShieldLinks();
}

function pickInstanceWeaponByGrade(grade) {
  if (!grade || typeof WEAPONS === "undefined") return null;
  const pool = WEAPONS.filter((w) => w && w.grade === grade && !w.hidden);
  if (!pool.length) return null;
  if (typeof pickMineWeaponFromPool === "function") return pickMineWeaponFromPool(pool);
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function applyInstanceLoot(loot) {
  if (!loot) return null;
  if (typeof engagementEmit === "function") {
    engagementEmit("instance_clear", {
      dungeonId: instanceRunState?.dungeonId || loot.dungeonId || "",
    });
  }
  if (loot.adena) {
    ProgressStore.update("adena", (a) => Math.max(0, Math.floor(Number(a) || 0) + loot.adena));
  }
  if (loot.soul || loot.spirit) {
    ProgressStore.update("materials", (m) => {
      const next = Object.assign({ soul: 0, spirit: 0 }, m || {});
      next.soul = (next.soul || 0) + (loot.soul || 0);
      next.spirit = (next.spirit || 0) + (loot.spirit || 0);
      return next;
    });
  }
  if (loot.xp && typeof grantAvatarXp === "function") {
    grantAvatarXp(loot.xp, { silent: true });
  }
  let weaponName = "";
  let weaponGrade = loot.weaponGrade || "";
  if (loot.weaponGrade) {
    const w = pickInstanceWeaponByGrade(loot.weaponGrade);
    if (w && typeof addToInventory === "function") {
      const it = addToInventory(w.id, { source: "instance", zoneId: instanceRunState?.dungeonId || null });
      if (it) weaponName = w.name || w.id;
    }
  }
  const armorNames = [];
  const armorIds = Array.isArray(loot.armorIds) ? loot.armorIds : [];
  armorIds.forEach((aid) => {
    let granted = false;
    if (typeof grantArmorDrop === "function") {
      const res = grantArmorDrop(aid, { source: "instance", zoneId: instanceRunState?.dungeonId || null, silent: true });
      granted = !!res;
    } else if (typeof addArmorToInventory === "function") {
      granted = !!addArmorToInventory(aid, { source: "instance" });
    }
    if (granted) {
      const def = typeof AMAP !== "undefined" ? AMAP[aid] : null;
      armorNames.push(def?.name || aid);
    }
  });
  ProgressStore.update("instanceLocks", (il) => {
    const next = Object.assign({}, il || {});
    const id = instanceRunState?.dungeonId;
    if (id) {
      const row = Object.assign({ clears: 0 }, next[id] || {});
      row.clears = (row.clears || 0) + 1;
      row.weekKey = typeof partyUtcWeekKey === "function" ? partyUtcWeekKey(Date.now()) : "";
      next[id] = row;
    }
    return next;
  });
  if (typeof save === "function") save();
  const summary = {
    dungeonName: instanceRunState?.dungeonName || "Инстанс",
    dungeonId: instanceRunState?.dungeonId || "",
    adena: loot.adena || 0,
    xp: loot.xp || 0,
    soul: loot.soul || 0,
    spirit: loot.spirit || 0,
    weaponName,
    weaponGrade,
    armorSetId: loot.armorSetId || "",
    armorNames,
  };
  showInstanceClearModal(summary);
  return summary;
}

function instanceClearLootHtml(summary) {
  summary = summary || {};
  const esc = typeof instanceEsc === "function" ? instanceEsc : (s) => String(s || "");
  const parts = [];
  parts.push('<div class="chapter-reward-loot instance-clear-loot">');
  parts.push("<p><b>Награда:</b></p><ul>");
  if (summary.xp) parts.push("<li>✦ Опыт +" + (typeof fmt === "function" ? fmt(summary.xp) : summary.xp) + " XP</li>");
  if (summary.adena) {
    const ad = typeof fmtAdena === "function" ? fmtAdena(summary.adena) : summary.adena;
    parts.push("<li>🪙 Adena +" + ad + "</li>");
  }
  if (summary.soul) parts.push("<li>Soul Ore ×" + summary.soul + "</li>");
  if (summary.spirit) parts.push("<li>Spirit Ore ×" + summary.spirit + "</li>");
  if (summary.weaponName) {
    parts.push(
      "<li>⚔ " +
        esc(summary.weaponName) +
        (summary.weaponGrade ? " [" + esc(summary.weaponGrade) + "]" : "") +
        "</li>"
    );
  } else if (summary.weaponGrade) {
    parts.push("<li>⚔ Оружие [" + esc(summary.weaponGrade) + "]</li>");
  }
  if (summary.armorNames && summary.armorNames.length) {
    parts.push(
      "<li>🛡 Броня" +
        (summary.armorSetId ? " («" + esc(summary.armorSetId) + "»)" : "") +
        " — " +
        summary.armorNames.length +
        " шт.:</li>"
    );
    summary.armorNames.forEach((n) => {
      parts.push("<li class=\"instance-clear-armor-piece\">" + esc(n) + "</li>");
    });
  }
  parts.push("</ul></div>");
  return parts.join("");
}

function showInstanceClearModal(summary) {
  summary = summary || {};
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) {
    if (typeof toast === "function") toast("Инстанс пройден!", "success");
    return;
  }
  if (typeof renderStoryPanel === "function") {
    renderStoryPanel({
      title: "Инстанс пройден",
      eyebrow: summary.dungeonName || "Групповой инстанс",
      lead: "Награда за прохождение",
      chapter: "",
      icon: "",
      bodyHtml: instanceClearLootHtml(summary),
      cta: "Забрать",
    });
  }
  backdrop.dataset.storyMode = "instance_clear";
  backdrop.className =
    "story-backdrop race-" +
    ((state.avatar && state.avatar.raceId) || "human") +
    " story-chapter-reward story-instance-clear";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function showInstanceFailModal(info) {
  info = info || {};
  if (instanceExitHandled) return;
  instanceExitHandled = true;
  stopInstancePoll();
  instanceClearDom();
  hideInstanceReadyGate();
  const hud = document.getElementById("instanceHud");
  if (hud) hud.hidden = true;
  if (typeof clearInstanceShieldLinks === "function") clearInstanceShieldLinks();

  const reason = info.reason || "Инстанс провален";
  const title =
    info.lastEvent === "anvil_fail"
      ? "Казнь кузни"
      : info.lastEvent === "adds_fail"
        ? "Восстание мёртвых"
        : info.lastEvent === "channel_fail"
          ? "Песнь Безмолвия"
          : info.phase === "timeout"
            ? "Время вышло"
            : info.phase === "undersized"
              ? "Группа распалась"
              : "Поражение";
  const tip =
    info.lastEvent === "anvil_fail"
      ? "Бейте только свой цвет в окне удара. Ошибки копят полоску ☠ до вайпа."
      : info.lastEvent === "adds_fail"
        ? "Пока живы тени — босс неуязвим. Убивайте аддов до дедлайна."
        : info.lastEvent === "channel_fail"
          ? "В окне каста нужен удар скиллом. Обычные клики канал не прерывают."
          : info.phase === "undersized"
            ? "Для инстанса нужно минимум 2 игрока в группе."
            : "Сохраняйте жизни: не стойте без ударов и успевайте до ярости.";

  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop || typeof renderStoryPanel !== "function") {
    instanceExitHandled = false;
    kickFromInstance({ toast: reason });
    return;
  }
  const esc = typeof instanceEsc === "function" ? instanceEsc : (s) => String(s || "");
  renderStoryPanel({
    title: title,
    eyebrow: info.dungeonName || "Групповой инстанс",
    lead: reason,
    chapter: "",
    icon: "",
    bodyHtml:
      '<div class="instance-fail-panel">' +
      '<p class="instance-fail-badge">ПОРАЖЕНИЕ</p>' +
      "<p>" +
      esc(reason) +
      "</p>" +
      '<p class="instance-fail-tip">' +
      esc(tip) +
      "</p>" +
      "</div>",
    cta: "В группу",
  });
  backdrop.dataset.storyMode = "instance_fail";
  backdrop.className =
    "story-backdrop race-" +
    ((state.avatar && state.avatar.raceId) || "human") +
    " story-chapter-reward story-instance-fail";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function dismissInstanceFailModal() {
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    backdrop.hidden = true;
  }
  if (typeof Audio2 !== "undefined") Audio2.click();
  // уже instanceExitHandled — kickFromInstance не сработает; делаем выход вручную
  if (typeof stopMine === "function") {
    try {
      stopMine();
    } catch (_) {}
  } else {
    instanceRunState = null;
  }
  if (typeof openPartyScreen === "function") {
    openPartyScreen();
  } else {
    if (typeof renderMenu === "function") renderMenu();
    if (typeof show === "function") show("menu");
  }
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
}

function dismissInstanceClearModal() {
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    backdrop.hidden = true;
  }
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof stopMine === "function") stopMine();
  if (typeof openPartyScreen === "function") {
    openPartyScreen();
  } else {
    if (typeof renderMenu === "function") renderMenu();
    if (typeof show === "function") show("menu");
  }
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
  if (typeof toast === "function") toast("Награда инстанса получена", "success");
}

/** Визуальный таймер пака: дедлайн волны / enrage босса. Expire не пишет «Упущено». */
function syncInstanceMobTimers(st, force) {
  if (!st || !st.encounter || typeof attachMobTimer !== "function") return;
  const enc = st.encounter;
  let life = 0;
  let total = 0;
  if (enc.kind === "boss") {
    life = Math.max(0, Number(enc.enrageInMs) || 0);
    total = Math.max(life, Number(enc.enrageTotalMs) || life);
  } else {
    life = Math.max(0, Number(enc.idleInMs) || 0);
    total = Math.max(life, Number(enc.idleTotalMs) || life);
    if (!total) {
      const dungeon = typeof partyDungeonById === "function" ? partyDungeonById(st.dungeonId) : null;
      total = dungeon?.waveIdleMs || 22000;
      if (!life) life = total;
    }
  }
  if (!total) return;
  const onExpire = function () {
    /* сервер считает idle/enrage; локально только визуал */
  };
  for (const g of instanceDomMobs.values()) {
    if (!g || (typeof mineGnomes !== "undefined" && mineGnomes && !mineGnomes.has(g))) continue;
    const curLeft = g._timerEnd ? Math.max(0, g._timerEnd - Date.now()) : 0;
    if (!force && g._timerRaf) {
      // Не дёргать таймер вверх от полла (было 21↔20 при сбросе lastHit).
      // Подтягиваем только если сервер заметно «впереди» (меньше времени).
      if (life >= curLeft - 400) continue;
    }
    attachMobTimer(g, Math.max(200, life || total), onExpire, total);
  }
}

async function enterInstanceMine(st) {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    return;
  }
  if (typeof clearExclusiveMineOverlays === "function") clearExclusiveMineOverlays("instance");
  instanceExitHandled = false;
  instanceLootApplied = false;
  instanceLastEventSeen = "";
  instanceLastPhaseLabel = "";
  const dungeon =
    typeof partyDungeonById === "function" ? partyDungeonById(st.dungeonId) : null;
  const mineCfg = dungeon?.mine || {};
  const zoneId = "instance:" + (st.dungeonId || "");
  const title = st.dungeonName || mineCfg.title || dungeon?.name || "Инстанс";

  const bgPool =
    mineCfg.bgs && mineCfg.bgs.length
      ? mineCfg.bgs
      : ["assets/locations/elven-ruins.jpg", "assets/mine_bg2.jpg"];
  const bgRaw = bgPool[Math.floor(Math.random() * bgPool.length)];
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
        title,
        bgCover: true,
      },
      zoneId
    );
  }

  mineActive = true;
  mineOverlayPaused = false;
  mineSession = {
    startedAt: Date.now(),
    adena0: Math.max(0, Math.floor(Number(state.adena) || 0)),
    kills: 0,
    weapons: 0,
    zoneId,
    loot: {},
    instance: true,
  };
  // Автофарм в инсте запрещён — только ручные клики (как у мирового босса).
  if (typeof stopAutoClickerLoop === "function") stopAutoClickerLoop();
  if (typeof resetMineSkillRuntime === "function") resetMineSkillRuntime();
  const panelTitle = document.getElementById("minePanelTitle");
  if (panelTitle) panelTitle.textContent = "Инстанс";
  // В инсте не показываем центральный mineHint — Ready и статус через HUD/гейт
  const hintEl = document.getElementById("mineHint");
  if (hintEl) {
    hintEl.textContent = "";
    hintEl.style.display = "none";
  }
  if (typeof show === "function") show("mine");
  if (typeof Audio2 !== "undefined") Audio2.open();
  if (typeof renderMineSkillBar === "function") renderMineSkillBar();
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
  if (typeof renderMineStoryBar === "function") renderMineStoryBar();
  if (typeof renderMineQuestHud === "function") renderMineQuestHud();
  const storyBar = document.getElementById("mineStoryBar");
  if (storyBar) storyBar.hidden = true;
  const questHud = document.getElementById("mineQuestHud");
  if (questHud) questHud.hidden = true;
  syncInstanceEncounter(st);
  startInstancePoll();
  // Ready только вручную кнопкой HUD
}

function startInstancePoll() {
  stopInstancePoll();
  instancePollTimer = setInterval(async () => {
    if (!instanceRunState?.runId) return;
    try {
      const r = await partyApi("/instance/" + instanceRunState.runId + "/state");
      if (r.ok && r.state) {
        syncInstanceEncounter(r.state);
      } else if (r && (r.error === "run" || !r.ok)) {
        kickFromInstance({ toast: "Инстанс закрыт — нужно минимум 2 игрока" });
      }
    } catch (_) {}
  }, 400);
}

function stopInstancePoll() {
  if (instancePollTimer) {
    clearInterval(instancePollTimer);
    instancePollTimer = null;
  }
}

async function instanceHandleHit(g, opts) {
  opts = opts || {};
  if (!g || !g._instanceEncounter || !instanceRunState?.runId) return false;
  if (instanceHitBusy) return true;
  instanceHitBusy = true;
  try {
    let dmg = typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 8;
    if (!opts.bySkill && typeof mineSkillClickMult === "function") {
      dmg = Math.max(1, Math.round(dmg * mineSkillClickMult()));
    }
    // partyDamageBuff применяется на сервере (instancePartyBuff), не умножаем здесь повторно
    if (opts.skillMult) dmg = Math.max(1, Math.round(dmg * opts.skillMult));
    const r = await partyApi("/instance/" + instanceRunState.runId + "/hit", {
      method: "POST",
      body: {
        dmg,
        mobId: g._instanceMobId || undefined,
        bySkill: !!opts.bySkill,
        skillMult: opts.skillMult || undefined,
      },
    });
    if (!r.ok) {
      if (typeof toast === "function") toast(r.error || "Ошибка", "warn");
      return true;
    }
    if (r.throttled) return true;
    if (r.blocked) {
      if (g._instanceAnvil) {
        /* rare */
      } else if (instanceRunState?.encounter?.anvilActive && typeof floatText === "function") {
        const p =
          typeof gnomeDropPoint === "function" ? gnomeDropPoint(g) : null;
        if (p) floatText(p.x, p.y - 16, "сначала метки!", "#ff9a60");
      }
      if (r.state) syncInstanceEncounter(r.state);
      return true;
    }
    if (r.anvilHit) {
      playInstanceAnvilHitFx(g, r);
      if (r.markConsumed || r.markId) {
        const mid = r.markId || g._instanceMobId;
        const local = mid ? instanceDomAnvilMarks.get(mid) : g;
        if (local) {
          try {
            if (typeof mineGnomes !== "undefined" && mineGnomes) mineGnomes.delete(local);
            if (local.remove) local.remove();
          } catch (_) {}
          if (mid) instanceDomAnvilMarks.delete(mid);
        }
      }
      if (typeof Audio2 !== "undefined") {
        if (r.windowHit && r.colorOk) Audio2.mineHit();
        else if (Audio2.click) Audio2.click();
      }
      if (r.anvilWiped) {
        if (typeof toast === "function") toast("Тиран Кузни казнил группу — провал наковальни!", "warn");
        if (r.state) syncInstanceEncounter(r.state);
        return true;
      }
      if (r.anvilFail && typeof toast === "function" && r.anvilFails != null) {
        /* лёгкий toast только на половине / почти вайп */
        if (r.anvilFails === Math.ceil((r.anvilFailMax || 10) / 2) || r.anvilFails >= (r.anvilFailMax || 10) - 1) {
          toast("Ошибки кузни: " + r.anvilFails + "/" + r.anvilFailMax, "warn");
        }
      }
      if (r.anvilDone && typeof toast === "function") toast("Кузня пробита! Бейте босса!", "success");
      if (r.state) syncInstanceEncounter(r.state);
      return true;
    }
    if (typeof Audio2 !== "undefined") Audio2.mineHit();
    if (r.stoneBroken && typeof Audio2 !== "undefined") Audio2.mineKill();
    if (r.shieldDown && typeof toast === "function") toast("Щит разрушен!", "success");
    if (r.state) {
      if (r.killed && typeof Audio2 !== "undefined") Audio2.mineKill();
      syncInstanceEncounter(r.state);
      if (r.loot && !instanceLootApplied) {
        instanceLootApplied = true;
        applyInstanceLoot(r.loot);
      }
    }
  } finally {
    instanceHitBusy = false;
  }
  return true;
}

function isInstanceSessionActive() {
  return !!(mineActive && instanceRunState && (instanceRunState.status === "active" || instanceRunState.status === "ready"));
}

function instanceShouldBlockLocalSpawn() {
  return isInstanceSessionActive() || !!(mineSession && mineSession.instance);
}

async function instanceAfterStopMine() {
  stopInstancePoll();
  instanceClearDom();
  const hud = document.getElementById("instanceHud");
  if (hud) {
    hud.hidden = true;
    hud.innerHTML = "";
  }
  hideInstanceReadyGate();
  const runId = instanceRunState?.runId;
  // Сразу сбрасываем — иначе poll/HUD успевают «переехать» в соло-фарм
  instanceRunState = null;
  if (runId) {
    try {
      await partyApi("/instance/" + runId + "/leave", { method: "POST", body: {} });
    } catch (_) {}
  }
}
