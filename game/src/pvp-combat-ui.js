// ===== Дуэли / арена: UI =====
// Тренировка | Дуэль по имени (live) | Async PvP (тень билда)

let _pvpDuel = null; // локальная тренировка
let _pvpShadowKind = "fighter";
let _pvpShotArmed = false;
let _pvpTab = "duel"; // duel | async | practice
let _pvpOnlineMatch = null; // { matchId, match }
let _pvpMatchPollTimer = null;
let _pvpAsyncLast = null;
let _pvpNameInput = "";

const PVP_HELP_SEEN_KEY = "sf_arena_help_seen_v1";
const PVP_ICO_ATTACK = "icons/pvp_act_attack.png?v=1";
const PVP_ICO_GUARD = "icons/pvp_act_guard.png?v=1";
let _pvpFxSeenKey = "";

function pvpFxFrame(fighterEl) {
  return fighterEl?.querySelector?.(".pvp-fighter-frame") || null;
}

function pvpFxEnsureLayer(frame) {
  if (!frame) return null;
  let layer = frame.querySelector(".pvp-fx");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "pvp-fx";
    frame.appendChild(layer);
  }
  return layer;
}

function pvpSpawnFx(frame, className) {
  const layer = pvpFxEnsureLayer(frame);
  if (!layer) return null;
  const el = document.createElement("div");
  el.className = className;
  layer.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 950);
  return el;
}

function pvpSpawnFloat(frame, text, kind) {
  if (!frame) return;
  const el = document.createElement("span");
  el.className =
    kind === "heal" ? "pvp-float-heal" : kind === "txt" ? "pvp-float-txt" : "pvp-float-dmg";
  el.textContent = text;
  frame.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 900);
}

function pvpSideByName(name, nameA, nameB) {
  if (!name) return null;
  if (name === nameA) return "a";
  if (name === nameB) return "b";
  return null;
}

/** VFX раунда: атака / защита / скиллы — разные. */
function pvpPlayRoundFx(root, pack) {
  if (!root || !pack) return;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return;
  }
  const fa = root.querySelector('.pvp-fighter[data-side="a"]');
  const fb = root.querySelector('.pvp-fighter[data-side="b"]');
  if (!fa || !fb) return;
  const nameA = pack.nameA || "";
  const nameB = pack.nameB || "";
  const sideEl = { a: fa, b: fb };
  const isMag = (side) => (side === "a" ? pack.atkTypeA : pack.atkTypeB) === "magical";

  const telegraph = (side, action) => {
    if (!action || !sideEl[side]) return;
    const frame = pvpFxFrame(sideEl[side]);
    if (action.type === "guard") {
      pvpSpawnFx(frame, "pvp-fx-shield");
      pvpSpawnFloat(frame, "ЗАЩИТА", "txt");
      return;
    }
    if (action.type === "attack") {
      sideEl[side].classList.add(side === "a" ? "is-lunge-right" : "is-lunge-left");
      pvpSpawnFx(frame, "pvp-fx-slash" + (isMag(side) ? " is-mag" : ""));
      return;
    }
    if (action.type === "skill") {
      pvpSpawnFx(frame, "pvp-fx-skill-burst" + (isMag(side) ? " is-mag" : ""));
      sideEl[side].classList.add(side === "a" ? "is-lunge-right" : "is-lunge-left");
    }
  };

  telegraph("a", pack.actionA);
  setTimeout(() => telegraph("b", pack.actionB), 70);

  (pack.events || []).forEach((ev, i) => {
    const delay = 120 + i * 100;
    setTimeout(() => {
      const actorSide = pvpSideByName(ev.actor, nameA, nameB);
      const targetSide =
        pvpSideByName(ev.target, nameA, nameB) ||
        (actorSide === "a" ? "b" : actorSide === "b" ? "a" : null);
      const actorFrame = actorSide ? pvpFxFrame(sideEl[actorSide]) : null;
      const targetFrame = targetSide ? pvpFxFrame(sideEl[targetSide]) : null;
      const targetEl = targetSide ? sideEl[targetSide] : null;

      if (ev.kind === "hit") {
        if (actorFrame && !pack.actionA?.type && !pack.actionB?.type) {
          pvpSpawnFx(actorFrame, "pvp-fx-slash" + (isMag(actorSide) ? " is-mag" : ""));
        }
        if (targetFrame) {
          pvpSpawnFx(targetFrame, "pvp-fx-impact");
          if (ev.damage != null) pvpSpawnFloat(targetFrame, "−" + ev.damage, "dmg");
        }
        if (targetEl) {
          targetEl.classList.add("is-hit");
          setTimeout(() => targetEl.classList.remove("is-hit"), 420);
        }
        return;
      }
      if (ev.kind === "guard") {
        if (actorFrame) pvpSpawnFx(actorFrame, "pvp-fx-shield");
        return;
      }
      if (ev.kind === "buff") {
        if (actorFrame) {
          pvpSpawnFx(actorFrame, "pvp-fx-buff");
          pvpSpawnFloat(actorFrame, "БАФФ", "txt");
        }
        return;
      }
      if (ev.kind === "debuff") {
        if (targetFrame) {
          pvpSpawnFx(targetFrame, "pvp-fx-debuff");
          pvpSpawnFloat(targetFrame, "ДЕБАФФ", "txt");
        } else if (actorFrame) {
          pvpSpawnFx(actorFrame, "pvp-fx-debuff");
        }
        return;
      }
      if (ev.kind === "heal") {
        if (actorFrame) {
          pvpSpawnFx(actorFrame, "pvp-fx-heal");
          if (ev.amount != null) pvpSpawnFloat(actorFrame, "+" + ev.amount, "heal");
        }
      }
    }, delay);
  });

  setTimeout(() => {
    fa.classList.remove("is-lunge-right", "is-lunge-left");
    fb.classList.remove("is-lunge-right", "is-lunge-left");
  }, 520);
}

function pvpHotkeyCodeOf(skillOrKey) {
  if (!skillOrKey) return "";
  if (typeof skillOrKey === "string") {
    const letter = skillOrKey.trim().toUpperCase();
    return /^[A-Z]$/.test(letter) ? "Key" + letter : "";
  }
  if (skillOrKey.hotkeyCode) return String(skillOrKey.hotkeyCode);
  return pvpHotkeyCodeOf(skillOrKey.hotkey || "");
}

function pvpBasicActHtml(act, opts) {
  opts = opts || {};
  const disabled = !!opts.disabled;
  const ico = act === "guard" ? PVP_ICO_GUARD : PVP_ICO_ATTACK;
  const key = act === "guard" ? "G" : "A";
  const code = act === "guard" ? "KeyG" : "KeyA";
  const name = act === "guard" ? "Защита" : "Атака";
  return (
    '<button type="button" class="pvp-act pvp-act-basic pvp-act-skill" data-pvp-act="' +
    act +
    '" data-hotkey-code="' +
    code +
    '"' +
    (disabled ? " disabled" : "") +
    ">" +
    '<img class="pvp-act-ico" src="' +
    ico +
    '" alt="">' +
    '<span class="pvp-act-key">' +
    key +
    '</span><span class="pvp-act-name">' +
    name +
    "</span></button>"
  );
}

function pvpHelpHtml() {
  return (
    '<div class="pvp-help">' +
    '<p class="pvp-help-lead">Арена — отдельный бой по статам экипа. <b>Сила фарма и автоудар здесь не работают.</b> Нет дропа инвентаря.</p>' +
    '<div class="pvp-help-block">' +
    "<h4>Дуэль</h4>" +
    "<p>Вызов живого игрока <b>по имени персонажа</b> (как в почте).</p>" +
    "<ol>" +
    "<li>Оба в облачном аккаунте; хотя бы раз откройте Арену (публикуется боевой лист).</li>" +
    "<li>Введите имя → «Вызвать на дуэль».</li>" +
    "<li>Соперник принимает во входящих — раундовый бой.</li>" +
    "<li>Ход: <b>A</b> атака, <b>G</b> защита, <b>Q/E/R/F</b> скиллы (оба выбирают, затем расчёт).</li>" +
    "<li>Нет хода ~90 сек — за молчуна ходит AI.</li>" +
    "</ol>" +
    "</div>" +
    '<div class="pvp-help-block">' +
    "<h4>PvP async</h4>" +
    "<p>Атака <b>тени билда</b> — соперник может быть оффлайн.</p>" +
    "<ol>" +
    "<li>У цели должен быть опубликованный лист (открывала Арену).</li>" +
    "<li>«Атаковать тень» — сервер сразу считает бой.</li>" +
    "<li>Кулдаун 60 секунд. Результат у вас и в истории цели.</li>" +
    "</ol>" +
    "</div>" +
    '<div class="pvp-help-block">' +
    "<h4>Тренировка</h4>" +
    "<p>Локальный бой с тенью воина или мага. Облако не нужно — чтобы понять формулу и скиллы.</p>" +
    "</div>" +
    '<div class="pvp-help-block">' +
    "<h4>Что влияет на урон</h4>" +
    "<ul>" +
    "<li>P.Atk / M.Atk, заточка, affinity, мастерство оружия.</li>" +
    "<li>P.Def / M.Def брони (маг → M.Def, воин → P.Def).</li>" +
    "<li>Уровень, раса/класс, боевые пассивы, шоты на старте.</li>" +
    "<li><b>Не влияет:</b> адена/XP фарма, автоудар, глава зоны.</li>" +
    "</ul>" +
    "</div>" +
    '<p class="pvp-help-foot">Снова открыть — кнопка «?» в шапке арены.</p>' +
    "</div>"
  );
}

async function showPvpArenaHelp(opts) {
  opts = opts || {};
  if (typeof showConfirm !== "function") {
    if (typeof toast === "function") toast("Арена: дуэль по имени, async-тень, тренировка", "info");
    return;
  }
  await showConfirm({
    title: opts.title || "Как устроена арена",
    html: pvpHelpHtml(),
    okText: opts.okText || "Понятно",
    hideCancel: true,
  });
  try {
    localStorage.setItem(PVP_HELP_SEEN_KEY, "1");
  } catch (_) {}
}

function pvpHelpSeen() {
  try {
    return localStorage.getItem(PVP_HELP_SEEN_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function pvpModeBannerHtml(tab) {
  if (tab === "async") {
    return (
      '<div class="pvp-banner pvp-banner-rich">' +
      "<strong>PvP async</strong> — удар по тени билда. Соперник может быть оффлайн. Кулдаун 60 с." +
      ' <button type="button" class="pvp-banner-more" data-pvp-help>Подробнее</button>' +
      "</div>"
    );
  }
  if (tab === "practice") {
    return (
      '<div class="pvp-banner pvp-banner-rich">' +
      "<strong>Тренировка</strong> — локальная тень воина/мага. Без облака, чтобы освоить ходы." +
      ' <button type="button" class="pvp-banner-more" data-pvp-help>Подробнее</button>' +
      "</div>"
    );
  }
  return (
    '<div class="pvp-banner pvp-banner-rich">' +
    "<strong>Дуэль</strong> — вызов по имени, принятие, раундовый бой онлайн. Сила фарма не считается." +
    ' <button type="button" class="pvp-banner-more" data-pvp-help>Подробнее</button>' +
    "</div>"
  );
}

function pvpOnlineListHtml(rows, actionLabel) {
  const label = actionLabel || "Вызвать";
  const body =
    rows && rows.length
      ? rows
          .map((r) => {
            const name = r.name || "?";
            const nick =
              r.nick && String(r.nick).toLowerCase() !== String(name).toLowerCase()
                ? " · " + r.nick
                : "";
            const live = !!r.live;
            const meta =
              "ур. " +
              (r.level || "?") +
              " · сила " +
              (r.power != null ? r.power : "?") +
              (r.atkType === "magical" ? " · маг." : " · физ.") +
              nick;
            return (
              '<div class="pvp-list-row pvp-online-row' +
              (live ? " is-live" : "") +
              '" data-pvp-online-name="' +
              pvpEsc(name) +
              '" role="button" tabindex="0">' +
              '<div class="pvp-online-main">' +
              '<span class="pvp-online-dot" aria-hidden="true"></span>' +
              "<div><b>" +
              pvpEsc(name) +
              '</b><small class="pvp-online-meta">' +
              (live ? "онлайн · " : "недавно · ") +
              pvpEsc(meta) +
              "</small></div></div>" +
              '<button type="button" class="pvp-chip pvp-online-act" data-pvp-online-act="' +
              pvpEsc(name) +
              '">' +
              pvpEsc(label) +
              "</button></div>"
            );
          })
          .join("")
      : '<p class="pvp-online-empty">Никого нет — пусть соперник откроет Арену</p>';
  return (
    '<div class="pvp-list-block pvp-online-list">' +
    '<div class="pvp-skills-title">Соперники</div>' +
    '<div class="pvp-online-body">' +
    body +
    "</div></div>"
  );
}

function pvpBindOnlineList(root, inputId, onAct) {
  if (!root) return;
  const fill = (name) => {
    if (!name) return;
    _pvpNameInput = name;
    const input = inputId ? document.getElementById(inputId) : null;
    if (input) input.value = name;
  };
  root.querySelectorAll("[data-pvp-online-name]").forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest("[data-pvp-online-act]")) return;
      fill(row.getAttribute("data-pvp-online-name") || "");
    };
  });
  root.querySelectorAll("[data-pvp-online-act]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = btn.getAttribute("data-pvp-online-act") || "";
      fill(name);
      if (typeof onAct === "function") await onAct(name, btn);
    };
  });
}

function pvpBindHelpButtons(root) {
  (root || document).querySelectorAll("[data-pvp-help]").forEach((btn) => {
    if (btn._pvpHelpBound) return;
    btn._pvpHelpBound = true;
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof Audio2 !== "undefined") Audio2.click();
      showPvpArenaHelp();
    };
  });
}

function pvpLiveSheet() {
  if (!state.avatar?.created) return null;
  return buildCombatSheet({
    avatar: state.avatar,
    name: state.avatar.name || "Вы",
    shotArmed: _pvpShotArmed,
  });
}

function pvpStopMatchPoll() {
  if (_pvpMatchPollTimer) {
    clearInterval(_pvpMatchPollTimer);
    _pvpMatchPollTimer = null;
  }
}

function openPvpArena() {
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (!state.avatar?.created) {
    if (typeof toast === "function") toast("Сначала создайте персонажа", "warn");
    return;
  }
  show("pvp-arena");
  if (typeof pvpPublishCurrentSheet === "function" && typeof pvpSocialLoggedIn === "function" && pvpSocialLoggedIn()) {
    pvpPublishCurrentSheet().catch(() => {});
  }
  renderPvpArena();
  if (!pvpHelpSeen()) {
    setTimeout(() => showPvpArenaHelp({ title: "Добро пожаловать на арену", okText: "В бой" }), 120);
  }
}

function pvpResetDuelState() {
  _pvpDuel = null;
  _pvpOnlineMatch = null;
  _pvpAsyncLast = null;
  pvpStopMatchPoll();
}

function pvpFmtPct(hp, max) {
  if (!max) return "0%";
  return Math.max(0, Math.round((hp / max) * 100)) + "%";
}

function pvpEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pvpPortraitUrl(sheet, side) {
  if (!sheet) return "";
  if (side === "a" && typeof avatarPortraitForAvatar === "function" && state.avatar) {
    return avatarPortraitForAvatar(state.avatar);
  }
  if (typeof avatarPortraitPath === "function") {
    const gender =
      sheet.genderId ||
      (side === "a" && state.avatar?.genderId) ||
      "male";
    return avatarPortraitPath(
      sheet.raceId || "human",
      gender,
      sheet.classId || "fighter"
    );
  }
  return "icons/char_menu.png?v=10";
}

function pvpWeaponLabel(sheet) {
  if (!sheet?.weaponId) return "без оружия";
  const w =
    typeof WMAP !== "undefined" && WMAP[sheet.weaponId] ? WMAP[sheet.weaponId].name : sheet.weaponId;
  return w + (sheet.weaponPlus ? " +" + sheet.weaponPlus : "");
}

function pvpSheetSummaryHtml(sheet, title, side) {
  if (!sheet) return "";
  const atk =
    sheet.atkType === "magical" ? "M.Atk " + sheet.matk : "P.Atk " + sheet.patk;
  const def = "P.Def " + sheet.pdef + " · M.Def " + sheet.mdef;
  const portrait = pvpPortraitUrl(sheet, side);
  return (
    '<div class="pvp-sheet" data-side="' +
    side +
    '">' +
    '<div class="pvp-sheet-portrait"><img src="' +
    pvpEsc(portrait) +
    '" alt=""></div>' +
    '<div class="pvp-sheet-info">' +
    '<div class="pvp-sheet-title">' +
    pvpEsc(title) +
    "</div>" +
    '<div class="pvp-sheet-name">' +
    pvpEsc(sheet.name || "—") +
    " · ур. " +
    sheet.level +
    "</div>" +
    '<div class="pvp-sheet-stats">' +
    atk +
    " · " +
    def +
    "</div>" +
    '<div class="pvp-sheet-meta">HP ' +
    sheet.hpMax +
    " · " +
    (sheet.atkType === "magical" ? "маг." : "физ.") +
    " · " +
    pvpEsc(pvpWeaponLabel(sheet)) +
    (sheet.shotArmed ? " · шоты" : "") +
    "</div></div></div>"
  );
}

function pvpFighterCardHtml(side, fighterOrView, opts) {
  opts = opts || {};
  const isView = !fighterOrView.sheet;
  const name = isView ? fighterOrView.name : fighterOrView.sheet.name;
  const level = isView ? fighterOrView.level : fighterOrView.sheet.level;
  const atkType = isView ? fighterOrView.atkType : fighterOrView.sheet.atkType;
  const max = isView ? fighterOrView.hpMax : fighterOrView.sheet.hpMax;
  const hp = isView ? fighterOrView.hp : fighterOrView.hp;
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const low = pct <= 25;
  const portrait = pvpPortraitUrl(
    isView
      ? {
          raceId:
            fighterOrView.raceId ||
            (side === "a" ? state.avatar?.raceId : null) ||
            "human",
          classId:
            fighterOrView.classId ||
            (fighterOrView.atkType === "magical" ? "mystic" : "fighter"),
          genderId:
            fighterOrView.genderId ||
            (side === "a" ? state.avatar?.genderId : null) ||
            "male",
          name,
        }
      : fighterOrView.sheet,
    side
  );
  const badges = opts.badges || [];

  return (
    '<div class="pvp-fighter' +
    (low ? " is-low" : "") +
    (opts.hitSide === side ? " is-hit" : "") +
    '" data-side="' +
    side +
    '">' +
    '<div class="pvp-fighter-frame">' +
    '<img class="pvp-fighter-img" src="' +
    pvpEsc(portrait) +
    '" alt="">' +
    (opts.floatDmg ? '<span class="pvp-float-dmg">−' + opts.floatDmg + "</span>" : "") +
    "</div>" +
    '<div class="pvp-fighter-meta">' +
    '<div class="pvp-fighter-name">' +
    pvpEsc(name) +
    "</div>" +
    '<div class="pvp-fighter-sub">ур. ' +
    (level || "?") +
    " · " +
    (atkType === "magical" ? "маг." : "физ.") +
    "</div>" +
    (badges.length ? '<div class="pvp-badges">' + badges.join("") + "</div>" : "") +
    '<div class="pvp-hp-label"><span>' +
    hp +
    " / " +
    max +
    "</span><span>" +
    pvpFmtPct(hp, max) +
    "</span></div>" +
    '<div class="pvp-hp-track"><div class="pvp-hp-fill" style="width:' +
    pct +
    '%"></div></div>' +
    "</div></div>"
  );
}

function pvpTabsHtml() {
  const tabs = [
    { id: "duel", label: "Дуэль" },
    { id: "async", label: "PvP async" },
    { id: "practice", label: "Тренировка" },
  ];
  return (
    '<div class="pvp-tabs" role="tablist">' +
    tabs
      .map(
        (t) =>
          '<button type="button" class="pvp-tab' +
          (_pvpTab === t.id ? " sel" : "") +
          '" data-pvp-tab="' +
          t.id +
          '">' +
          t.label +
          "</button>"
      )
      .join("") +
    "</div>"
  );
}

function pvpBindTabs(body) {
  body.querySelectorAll("[data-pvp-tab]").forEach((btn) => {
    btn.onclick = () => {
      _pvpTab = btn.getAttribute("data-pvp-tab") || "duel";
      if (typeof Audio2 !== "undefined") Audio2.click();
      if (_pvpTab !== "duel") pvpStopMatchPoll();
      renderPvpArena();
    };
  });
}

function pvpLogHtmlFromOnline(log) {
  const lines = [];
  (log || []).forEach((r) => {
    lines.push({
      kind: "round",
      text: "Раунд " + r.round,
    });
    (r.events || []).forEach((ev) => {
      if (ev.text) lines.push({ kind: ev.kind || "text", text: ev.text });
    });
  });
  return lines
    .map(
      (e) =>
        '<div class="pvp-log-line' +
        (e.kind === "round"
          ? " is-round"
          : e.kind === "hit"
            ? " is-hit"
            : e.kind === "heal"
              ? " is-heal"
              : e.kind === "buff" || e.kind === "guard"
                ? " is-buff"
                : e.kind === "debuff"
                  ? " is-debuff"
                  : "") +
        '">' +
        pvpEsc(e.text) +
        "</div>"
    )
    .join("");
}

async function renderPvpArena() {
  const body = document.getElementById("pvpArenaBody");
  if (!body) return;
  body.classList.remove("is-fight", "is-result");

  const my = pvpLiveSheet();
  if (!my) {
    body.innerHTML = '<p class="pvp-hint">Создайте персонажа, чтобы выйти на арену.</p>';
    return;
  }

  if (_pvpOnlineMatch && _pvpOnlineMatch.match) {
    body.classList.add(_pvpOnlineMatch.match.winner ? "is-result" : "is-fight");
    renderPvpOnlineFight(body);
    return;
  }

  if (_pvpDuel && _pvpDuel.pending) {
    body.classList.add("is-fight");
    renderPvpPracticeFight(body);
    return;
  }
  if (_pvpDuel && _pvpDuel.result) {
    body.classList.add("is-result");
    renderPvpPracticeResult(body);
    return;
  }

  if (_pvpTab === "practice") {
    renderPvpPracticeSetup(body, my);
    return;
  }
  if (_pvpTab === "async") {
    await renderPvpAsyncSetup(body, my);
    return;
  }
  await renderPvpDuelSetup(body, my);
}

function renderPvpPracticeSetup(body, my) {
  const shadow = pvpPracticeShadowSheet(_pvpShadowKind, my.level);
  body.innerHTML =
    pvpTabsHtml() +
    pvpModeBannerHtml("practice") +
    '<div class="pvp-compare">' +
    pvpSheetSummaryHtml(my, "Ваш лист", "a") +
    '<div class="pvp-vs" aria-hidden="true">VS</div>' +
    pvpSheetSummaryHtml(shadow, "Противник", "b") +
    "</div>" +
    '<div class="pvp-setup">' +
    '<label class="pvp-check"><input type="checkbox" id="pvpShotArmed"' +
    (_pvpShotArmed ? " checked" : "") +
    "> Заряды на старте</label>" +
    '<div class="pvp-shadow-pick">' +
    '<button type="button" class="pvp-chip' +
    (_pvpShadowKind === "fighter" ? " sel" : "") +
    '" data-pvp-shadow="fighter">Тень воина</button>' +
    '<button type="button" class="pvp-chip' +
    (_pvpShadowKind === "mystic" ? " sel" : "") +
    '" data-pvp-shadow="mystic">Тень мага</button>' +
    "</div>" +
    '<button type="button" class="pvp-start" id="pvpStartBtn">Начать тренировку</button>' +
    "</div>";
  pvpBindTabs(body);
  pvpBindHelpButtons(body);
  const shot = document.getElementById("pvpShotArmed");
  if (shot) {
    shot.onchange = () => {
      _pvpShotArmed = !!shot.checked;
      renderPvpArena();
    };
  }
  body.querySelectorAll("[data-pvp-shadow]").forEach((btn) => {
    btn.onclick = () => {
      _pvpShadowKind = btn.getAttribute("data-pvp-shadow") || "fighter";
      renderPvpArena();
    };
  });
  const start = document.getElementById("pvpStartBtn");
  if (start) start.onclick = () => pvpBeginPractice();
}

async function renderPvpDuelSetup(body, my) {
  const logged = typeof pvpSocialLoggedIn === "function" && pvpSocialLoggedIn();
  let inbox = [];
  let outbox = [];
  let online = [];
  if (logged) {
    const [inR, outR, actR, onR] = await Promise.all([
      pvpFetchDuelInbox(),
      pvpFetchDuelOutbox(),
      pvpFetchActiveMatch(),
      typeof pvpFetchOnlineList === "function" ? pvpFetchOnlineList() : Promise.resolve({ ok: false }),
    ]);
    if (inR.ok) inbox = inR.rows || [];
    if (outR.ok) outbox = outR.rows || [];
    if (onR && onR.ok) online = onR.rows || [];
    if (actR.ok && actR.match) {
      _pvpOnlineMatch = { matchId: actR.match.meta.matchId, match: actR.match };
      renderPvpArena();
      return;
    }
  }

  const challengeFromName = async (name, btn) => {
    if (!name) {
      toast("Укажите имя", "warn");
      return;
    }
    if (btn) btn.disabled = true;
    const challengeBtn = document.getElementById("pvpChallengeBtn");
    if (challengeBtn) challengeBtn.disabled = true;
    await pvpPublishCurrentSheet();
    const r = await pvpChallengeName(name);
    if (btn) btn.disabled = false;
    if (challengeBtn) challengeBtn.disabled = false;
    if (!r.ok) {
      toast(r.error || "Ошибка", "warn");
      return;
    }
    toast("Вызов отправлен «" + name + "»", "info");
    renderPvpArena();
  };

  body.innerHTML =
    pvpTabsHtml() +
    pvpModeBannerHtml("duel") +
    (!logged
      ? '<p class="pvp-hint">Нужен вход в облачный аккаунт.</p>'
      : "") +
    '<div class="pvp-compare">' +
    pvpSheetSummaryHtml(my, "Ваш лист", "a") +
    "</div>" +
    (logged
      ? pvpOnlineListHtml(online, "Вызвать") +
        '<div class="pvp-setup">' +
        '<label class="pvp-field">Имя персонажа' +
        '<input type="text" id="pvpDuelName" class="pvp-input" maxlength="48" placeholder="Например HeroBob" value="' +
        pvpEsc(_pvpNameInput) +
        '"></label>' +
        '<button type="button" class="pvp-start" id="pvpChallengeBtn">Вызвать на дуэль</button>' +
        "</div>" +
        '<div class="pvp-lists">' +
        '<div class="pvp-list-block"><div class="pvp-skills-title">Входящие вызовы</div>' +
        (inbox.length
          ? inbox
              .map(
                (r) =>
                  '<div class="pvp-list-row">' +
                  "<span>от <b>" +
                  pvpEsc(r.fromName) +
                  "</b></span>" +
                  '<span class="pvp-list-acts">' +
                  '<button type="button" class="pvp-chip" data-pvp-accept="' +
                  r.id +
                  '">Принять</button>' +
                  '<button type="button" class="pvp-forfeit" data-pvp-decline="' +
                  r.id +
                  '">Отклонить</button>' +
                  "</span></div>"
              )
              .join("")
          : '<p class="pvp-hint">Пусто</p>') +
        "</div>" +
        '<div class="pvp-list-block"><div class="pvp-skills-title">Исходящие</div>' +
        (outbox.length
          ? outbox
              .slice(0, 8)
              .map((r) => {
                const join =
                  r.status === "accepted" && r.matchId
                    ? ' <button type="button" class="pvp-chip" data-pvp-join="' +
                      r.matchId +
                      '">В бой</button>'
                    : "";
                return (
                  '<div class="pvp-list-row"><span>→ <b>' +
                  pvpEsc(r.toName) +
                  "</b> · " +
                  pvpEsc(r.status) +
                  "</span>" +
                  join +
                  "</div>"
                );
              })
              .join("")
          : '<p class="pvp-hint">Пусто</p>') +
        "</div></div>"
      : "");

  pvpBindTabs(body);
  pvpBindHelpButtons(body);
  pvpBindOnlineList(body, "pvpDuelName", challengeFromName);
  const nameEl = document.getElementById("pvpDuelName");
  if (nameEl) {
    nameEl.oninput = () => {
      _pvpNameInput = nameEl.value;
    };
  }
  const challengeBtn = document.getElementById("pvpChallengeBtn");
  if (challengeBtn) {
    challengeBtn.onclick = async () => {
      const name = (document.getElementById("pvpDuelName")?.value || "").trim();
      await challengeFromName(name, challengeBtn);
    };
  }
  body.querySelectorAll("[data-pvp-accept]").forEach((btn) => {
    btn.onclick = async () => {
      const r = await pvpRespondChallenge(btn.getAttribute("data-pvp-accept"), true);
      if (!r.ok) {
        toast(r.error || "Ошибка", "warn");
        return;
      }
      if (r.matchId && r.match) {
        _pvpOnlineMatch = { matchId: r.matchId, match: r.match };
        pvpStartMatchPoll();
      }
      toast("Дуэль началась", "info");
      renderPvpArena();
    };
  });
  body.querySelectorAll("[data-pvp-decline]").forEach((btn) => {
    btn.onclick = async () => {
      const r = await pvpRespondChallenge(btn.getAttribute("data-pvp-decline"), false);
      if (!r.ok) toast(r.error || "Ошибка", "warn");
      else toast("Вызов отклонён", "info");
      renderPvpArena();
    };
  });
  body.querySelectorAll("[data-pvp-join]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-pvp-join");
      const r = await pvpFetchMatch(id);
      if (!r.ok || !r.match) {
        toast(r.error || "Матч недоступен", "warn");
        return;
      }
      _pvpOnlineMatch = { matchId: Number(id), match: r.match };
      pvpStartMatchPoll();
      renderPvpArena();
    };
  });
}

async function renderPvpAsyncSetup(body, my) {
  const logged = typeof pvpSocialLoggedIn === "function" && pvpSocialLoggedIn();
  let inbox = [];
  let outbox = [];
  let online = [];
  if (logged) {
    const [inR, outR, onR] = await Promise.all([
      pvpFetchAsyncInbox(),
      pvpFetchAsyncOutbox(),
      typeof pvpFetchOnlineList === "function" ? pvpFetchOnlineList() : Promise.resolve({ ok: false }),
    ]);
    if (inR.ok) inbox = inR.rows || [];
    if (outR.ok) outbox = outR.rows || [];
    if (onR && onR.ok) online = onR.rows || [];
  }

  const asyncAttackFromName = async (name, btn) => {
    if (!name) {
      toast("Укажите имя", "warn");
      return;
    }
    if (btn) btn.disabled = true;
    const atkBtn = document.getElementById("pvpAsyncAttackBtn");
    if (atkBtn) atkBtn.disabled = true;
    await pvpPublishCurrentSheet();
    const r = await pvpAsyncAttackName(name);
    if (btn) btn.disabled = false;
    if (atkBtn) atkBtn.disabled = false;
    if (!r.ok) {
      toast(r.error || "Ошибка", "warn");
      return;
    }
    _pvpAsyncLast = r;
    const youWin = r.winner === "a";
    if (typeof recordPvpOutcome === "function") {
      recordPvpOutcome({
        mode: "async",
        youWin,
        draw: r.winner === "draw",
        rating: r.rating?.rating,
        matchKey: "async:" + (r.attackId || Date.now()),
      });
    }
    toast(
      youWin ? "Победа над тенью!" : r.winner === "b" ? "Тень устояла" : "Ничья",
      youWin ? "info" : "warn"
    );
    if (r.rating && typeof toast === "function") {
      const d = r.rating.delta || 0;
      toast(
        "Рейтинг " + r.rating.rating + (d >= 0 ? " (+" + d + ")" : " (" + d + ")"),
        "system"
      );
    }
    renderPvpArena();
  };

  const last = _pvpAsyncLast;
  body.innerHTML =
    pvpTabsHtml() +
    pvpModeBannerHtml("async") +
    (!logged ? '<p class="pvp-hint">Нужен вход в облачный аккаунт.</p>' : "") +
    '<div class="pvp-compare">' +
    pvpSheetSummaryHtml(my, "Ваш лист", "a") +
    "</div>" +
    (logged
      ? pvpOnlineListHtml(online, "Атака") +
        '<div class="pvp-setup">' +
        '<label class="pvp-field">Имя цели' +
        '<input type="text" id="pvpAsyncName" class="pvp-input" maxlength="48" placeholder="Имя персонажа" value="' +
        pvpEsc(_pvpNameInput) +
        '"></label>' +
        '<button type="button" class="pvp-start" id="pvpAsyncAttackBtn">Атаковать тень</button>' +
        "</div>"
      : "") +
    (last
      ? '<div class="pvp-result ' +
        (last.winner === "a" ? "win" : last.winner === "b" ? "lose" : "draw") +
        '"><div class="pvp-result-title">' +
        (last.winner === "a" ? "Победа" : last.winner === "b" ? "Поражение" : "Ничья") +
        '</div><div class="pvp-result-meta">vs ' +
        pvpEsc(last.defender?.name || "?") +
        " · раундов " +
        (last.result?.rounds || "?") +
        "</div></div>"
      : "") +
    '<div class="pvp-lists">' +
    '<div class="pvp-list-block"><div class="pvp-skills-title">Атаки на вас</div>' +
    (inbox.length
      ? inbox
          .slice(0, 10)
          .map((r) => {
            const youWin = r.winner === "b";
            return (
              '<div class="pvp-list-row"><span>от <b>' +
              pvpEsc(r.attackerName) +
              "</b> · " +
              (youWin ? "вы победили" : r.winner === "a" ? "поражение" : "ничья") +
              "</span></div>"
            );
          })
          .join("")
      : '<p class="pvp-hint">Пусто</p>') +
    "</div>" +
    '<div class="pvp-list-block"><div class="pvp-skills-title">Ваши атаки</div>' +
    (outbox.length
      ? outbox
          .slice(0, 10)
          .map(
            (r) =>
              '<div class="pvp-list-row"><span>→ <b>' +
              pvpEsc(r.defenderName) +
              "</b> · " +
              (r.winner === "a" ? "победа" : r.winner === "b" ? "поражение" : "ничья") +
              "</span></div>"
          )
          .join("")
      : '<p class="pvp-hint">Пусто</p>') +
    "</div></div>";

  pvpBindTabs(body);
  pvpBindHelpButtons(body);
  pvpBindOnlineList(body, "pvpAsyncName", asyncAttackFromName);
  const nameEl = document.getElementById("pvpAsyncName");
  if (nameEl) {
    nameEl.oninput = () => {
      _pvpNameInput = nameEl.value;
    };
  }
  const atk = document.getElementById("pvpAsyncAttackBtn");
  if (atk) {
    atk.onclick = async () => {
      const name = (document.getElementById("pvpAsyncName")?.value || "").trim();
      await asyncAttackFromName(name, atk);
    };
  }
}

function pvpNoteOnlineMatchResult(apiResult) {
  const m = apiResult?.match || _pvpOnlineMatch?.match;
  if (!m?.winner || !_pvpOnlineMatch?.matchId) return;
  const side = m.meta?.yourSide || "a";
  const youWin = (side === "a" && m.winner === "a") || (side === "b" && m.winner === "b");
  const rating = apiResult?.rating || m.rating || null;
  if (typeof recordPvpOutcome === "function") {
    recordPvpOutcome({
      mode: "duel",
      youWin,
      draw: m.winner === "draw",
      rating: rating?.rating,
      matchKey: "duel:" + _pvpOnlineMatch.matchId,
    });
  }
}

function pvpStartMatchPoll() {
  pvpStopMatchPoll();
  _pvpMatchPollTimer = setInterval(async () => {
    if (!_pvpOnlineMatch?.matchId) return;
    if (!document.getElementById("screen-pvp-arena")?.classList.contains("active")) return;
    const r = await pvpFetchMatch(_pvpOnlineMatch.matchId);
    if (r.ok && r.match) {
      _pvpOnlineMatch.match = r.match;
      if (r.rating) _pvpOnlineMatch.match.rating = r.rating;
      if (r.match.winner) {
        pvpNoteOnlineMatchResult(r);
        pvpStopMatchPoll();
      }
      renderPvpArena();
    }
  }, typeof PVP_MATCH_POLL_MS === "number" ? PVP_MATCH_POLL_MS : 2000);
}

function renderPvpOnlineFight(body) {
  const m = _pvpOnlineMatch.match;
  const side = m.meta?.yourSide || "a";
  const finished = !!m.winner;
  const youWin =
    (side === "a" && m.winner === "a") || (side === "b" && m.winner === "b");
  const skills = m.skills || [];
  const yourPending = m.yourPending;
  const oppPending = m.oppPending;

  const skillBtns = skills
    .map((s) => {
      const cds = side === "a" ? m.cdsA : m.cdsB;
      const cd = (cds && cds[s.id]) || 0;
      const locked = cd > 0 || yourPending || finished;
      const code = pvpHotkeyCodeOf(s);
      return (
        '<button type="button" class="pvp-act pvp-act-skill' +
        (locked ? " locked" : "") +
        '" data-pvp-act="skill" data-skill-id="' +
        s.id +
        '"' +
        (code ? ' data-hotkey-code="' + pvpEsc(code) + '"' : "") +
        (locked ? " disabled" : "") +
        ">" +
        (s.icon ? '<img class="pvp-act-ico" src="' + pvpEsc(s.icon) + '" alt="">' : "") +
        '<span class="pvp-act-key">' +
        pvpEsc(s.hotkey || "?") +
        '</span><span class="pvp-act-name">' +
        pvpEsc(s.name) +
        "</span>" +
        (cd > 0 ? '<span class="pvp-act-cd">' + cd + "</span>" : "") +
        "</button>"
      );
    })
    .join("");

  const aView = {
    name: m.sheetA?.name || m.meta?.aName,
    level: m.sheetA?.level,
    atkType: m.sheetA?.atkType,
    raceId: m.sheetA?.raceId,
    classId: m.sheetA?.classId,
    genderId: m.sheetA?.genderId,
    hp: m.hpA,
    hpMax: m.hpMaxA,
  };
  const bView = {
    name: m.sheetB?.name || m.meta?.bName,
    level: m.sheetB?.level,
    atkType: m.sheetB?.atkType,
    raceId: m.sheetB?.raceId,
    classId: m.sheetB?.classId,
    genderId: m.sheetB?.genderId,
    hp: m.hpB,
    hpMax: m.hpMaxB,
  };

  body.innerHTML =
    '<div class="pvp-fight' +
    (finished ? " is-over" : "") +
    '">' +
    '<div class="pvp-fight-top">' +
    (finished
      ? '<div class="pvp-result ' +
        (m.winner === "draw" ? "draw" : youWin ? "win" : "lose") +
        '"><div class="pvp-result-title">' +
        (m.winner === "draw" ? "Ничья" : youWin ? "Победа" : "Поражение") +
        '</div><div class="pvp-result-meta">Дуэль · раунд ' +
        m.round +
        (m.rating
          ? " · рейтинг " +
            m.rating.rating +
            (m.rating.delta != null
              ? " (" + (m.rating.delta >= 0 ? "+" : "") + m.rating.delta + ")"
              : "")
          : "") +
        "</div></div>"
      : '<div class="pvp-fight-head"><span class="pvp-round-pill">Раунд ' +
        (m.round + 1) +
        " / " +
        (m.maxRounds || 20) +
        '</span><span class="pvp-fight-hint">' +
        (yourPending
          ? oppPending
            ? "Расчёт…"
            : "Ждём ход соперника…"
          : "Ваш ход") +
        "</span></div>") +
    '<div class="pvp-stage">' +
    pvpFighterCardHtml("a", aView, {}) +
    '<div class="pvp-stage-vs"><span>VS</span></div>' +
    pvpFighterCardHtml("b", bView, {}) +
    "</div></div>" +
    (!finished
      ? '<div class="pvp-fight-mid"><div class="pvp-actions">' +
        pvpBasicActHtml("attack", { disabled: yourPending }) +
        pvpBasicActHtml("guard", { disabled: yourPending }) +
        skillBtns +
        "</div></div>"
      : "") +
    '<div class="pvp-fight-log-wrap"><div class="pvp-log-head">Журнал</div>' +
    '<div class="pvp-log sf-scroll" id="pvpFightLog">' +
    pvpLogHtmlFromOnline(m.log) +
    "</div></div>" +
    '<div class="pvp-fight-foot">' +
    (finished
      ? '<button type="button" class="pvp-start" id="pvpOnlineBack">К вызовам</button>'
      : '<button type="button" class="pvp-forfeit" id="pvpOnlineLeave">Сдаться (AI доиграет)</button>') +
    "</div></div>";

  if (!finished) {
    pvpStartMatchPoll();
    body.querySelectorAll("[data-pvp-act]").forEach((btn) => {
      btn.onclick = async () => {
        if (btn.disabled) return;
        const type = btn.getAttribute("data-pvp-act");
        const action =
          type === "skill"
            ? { type: "skill", skillId: btn.getAttribute("data-skill-id") }
            : { type };
        const r = await pvpSubmitMatchAction(_pvpOnlineMatch.matchId, action);
        if (!r.ok) {
          toast(r.error || "Ошибка хода", "warn");
          return;
        }
        _pvpOnlineMatch.match = r.match;
        if (r.rating) _pvpOnlineMatch.match.rating = r.rating;
        if (r.match?.winner) pvpNoteOnlineMatchResult(r);
        renderPvpArena();
      };
    });
  }
  const back = document.getElementById("pvpOnlineBack");
  if (back) {
    back.onclick = () => {
      pvpResetDuelState();
      renderPvpArena();
    };
  }
  const leave = document.getElementById("pvpOnlineLeave");
  if (leave) {
    leave.onclick = () => {
      // сдаёмся: просто уходим; таймаут AI доиграет за обоих
      toast("Вы можете закрыть экран — соперник/AI завершит по таймауту", "info");
      pvpStopMatchPoll();
      _pvpOnlineMatch = null;
      renderPvpArena();
    };
  }
  const logEl = document.getElementById("pvpFightLog");
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
  const fxKey = String(_pvpOnlineMatch.matchId) + ":" + (m.round || 0);
  if (m.round > 0 && fxKey !== _pvpFxSeenKey) {
    _pvpFxSeenKey = fxKey;
    const lastRound = (m.log || []).find((r) => r.round === m.round) || (m.log || [])[(m.log || []).length - 1];
    if (lastRound) {
      requestAnimationFrame(() =>
        pvpPlayRoundFx(body, {
          actionA: lastRound.actionA,
          actionB: lastRound.actionB,
          events: lastRound.events || [],
          nameA: aView.name,
          nameB: bView.name,
          atkTypeA: aView.atkType,
          atkTypeB: bView.atkType,
        })
      );
    }
  }
}

/* —— локальная тренировка (как раньше) —— */

function pvpBeginPractice() {
  const my = pvpLiveSheet();
  if (!my) return;
  const shadow = pvpPracticeShadowSheet(_pvpShadowKind, my.level);
  const seed = (Date.now() % 100000) + 1;
  _pvpDuel = {
    fighterA: pvpCreateFighter(my),
    fighterB: pvpCreateFighter(shadow),
    rng: pvpRng(seed),
    round: 0,
    logEntries: [],
    lastEvents: [],
    pending: true,
    result: null,
  };
  renderPvpArena();
}

function pvpLogHtml(entries) {
  return (entries || [])
    .map((e) => {
      const text = typeof e === "string" ? e : e.text;
      const k = typeof e === "string" ? "text" : e.kind;
      return (
        '<div class="pvp-log-line' +
        (k === "round"
          ? " is-round"
          : k === "hit"
            ? " is-hit"
            : k === "heal"
              ? " is-heal"
              : k === "buff" || k === "guard"
                ? " is-buff"
                : k === "debuff"
                  ? " is-debuff"
                  : k === "hp"
                    ? " is-hp"
                    : "") +
        '">' +
        pvpEsc(text) +
        "</div>"
      );
    })
    .join("");
}

function pvpActionLabel(action, fighter) {
  if (!action) return "—";
  if (action.type === "guard") return "Защита";
  if (action.type === "attack") return "Атака";
  if (action.type === "skill") {
    const sk = (fighter?.sheet?.skills || []).find((s) => s.id === action.skillId);
    return sk ? sk.name : action.skillId;
  }
  return action.type;
}

function renderPvpPracticeFight(body) {
  const d = _pvpDuel;
  const a = d.fighterA;
  const b = d.fighterB;
  const skills = a.sheet.skills || [];
  const maxR = typeof PVP_MAX_ROUNDS === "number" ? PVP_MAX_ROUNDS : 20;
  const skillBtns = skills
    .map((s) => {
      const cd = a.cds[s.id] || 0;
      const code = pvpHotkeyCodeOf(s);
      return (
        '<button type="button" class="pvp-act pvp-act-skill' +
        (cd > 0 ? " locked" : "") +
        '" data-pvp-act="skill" data-skill-id="' +
        s.id +
        '"' +
        (code ? ' data-hotkey-code="' + pvpEsc(code) + '"' : "") +
        (cd > 0 ? " disabled" : "") +
        ">" +
        (s.icon ? '<img class="pvp-act-ico" src="' + pvpEsc(s.icon) + '" alt="">' : "") +
        '<span class="pvp-act-key">' +
        pvpEsc(s.hotkey || "?") +
        '</span><span class="pvp-act-name">' +
        pvpEsc(s.name) +
        "</span>" +
        (cd > 0 ? '<span class="pvp-act-cd">' + cd + "</span>" : "") +
        "</button>"
      );
    })
    .join("");

  body.innerHTML =
    '<div class="pvp-fight">' +
    '<div class="pvp-fight-top"><div class="pvp-fight-head"><span class="pvp-round-pill">Раунд ' +
    (d.round + 1) +
    " / " +
    maxR +
    '</span><span class="pvp-fight-hint">Тренировка</span></div>' +
    '<div class="pvp-stage">' +
    pvpFighterCardHtml("a", a, {}) +
    '<div class="pvp-stage-vs"><span>VS</span></div>' +
    pvpFighterCardHtml("b", b, {}) +
    "</div></div>" +
    '<div class="pvp-fight-mid"><div class="pvp-actions">' +
    pvpBasicActHtml("attack") +
    pvpBasicActHtml("guard") +
    skillBtns +
    "</div></div>" +
    '<div class="pvp-fight-log-wrap"><div class="pvp-log-head">Журнал</div>' +
    '<div class="pvp-log sf-scroll" id="pvpFightLog">' +
    (d.logEntries.length ? pvpLogHtml(d.logEntries) : '<div class="pvp-log-line is-muted">Ожидание хода…</div>') +
    '</div></div><div class="pvp-fight-foot">' +
    '<button type="button" class="pvp-forfeit" id="pvpForfeitBtn">Сдаться</button></div></div>';

  body.querySelectorAll("[data-pvp-act]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      const type = btn.getAttribute("data-pvp-act");
      const action =
        type === "skill"
          ? { type: "skill", skillId: btn.getAttribute("data-skill-id") }
          : { type };
      pvpSubmitPracticeAction(action);
    };
  });
  document.getElementById("pvpForfeitBtn").onclick = () => {
    d.result = { winner: "b", reason: "forfeit" };
    d.pending = false;
    d.logEntries.push({ kind: "text", text: "Вы сдались." });
    renderPvpArena();
  };
  const logEl = document.getElementById("pvpFightLog");
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
  if (d.lastFx) {
    const fx = d.lastFx;
    d.lastFx = null;
    requestAnimationFrame(() => pvpPlayRoundFx(body, fx));
  }
}

function pvpSubmitPracticeAction(actionA) {
  const d = _pvpDuel;
  if (!d || !d.pending) return;
  const actionB = pvpAiChooseAction(d.fighterB, d.fighterA, d.rng);
  d.round += 1;
  const result = resolveRound(d.fighterA, d.fighterB, actionA, actionB, d.rng);
  d.lastEvents = result.events || [];
  d.lastFx = {
    actionA,
    actionB,
    events: result.events || [],
    nameA: d.fighterA.sheet.name,
    nameB: d.fighterB.sheet.name,
    atkTypeA: d.fighterA.sheet.atkType,
    atkTypeB: d.fighterB.sheet.atkType,
  };
  d.logEntries.push({
    kind: "round",
    text:
      "Раунд " +
      d.round +
      ": вы «" +
      pvpActionLabel(actionA, d.fighterA) +
      "», тень «" +
      pvpActionLabel(actionB, d.fighterB) +
      "»",
  });
  (result.events || []).forEach((ev) => {
    if (ev.text) d.logEntries.push({ kind: ev.kind || "text", text: ev.text });
  });
  const maxR = typeof PVP_MAX_ROUNDS === "number" ? PVP_MAX_ROUNDS : 20;
  if (result.deadA || result.deadB || d.round >= maxR) {
    let winner = "draw";
    if (result.deadA && !result.deadB) winner = "b";
    else if (result.deadB && !result.deadA) winner = "a";
    else {
      const pctA = d.fighterA.hp / d.fighterA.sheet.hpMax;
      const pctB = d.fighterB.hp / d.fighterB.sheet.hpMax;
      if (pctA > pctB + 0.001) winner = "a";
      else if (pctB > pctA + 0.001) winner = "b";
    }
    d.result = { winner, reason: "end" };
    d.pending = false;
  }
  renderPvpArena();
}

function renderPvpPracticeResult(body) {
  const d = _pvpDuel;
  const w = d.result.winner;
  body.innerHTML =
    '<div class="pvp-fight is-over">' +
    '<div class="pvp-fight-top"><div class="pvp-result ' +
    (w === "a" ? "win" : w === "b" ? "lose" : "draw") +
    '"><div class="pvp-result-title">' +
    (w === "a" ? "Победа" : w === "b" ? "Поражение" : "Ничья") +
    '</div></div><div class="pvp-stage">' +
    pvpFighterCardHtml("a", d.fighterA, {}) +
    '<div class="pvp-stage-vs"><span>VS</span></div>' +
    pvpFighterCardHtml("b", d.fighterB, {}) +
    '</div></div><div class="pvp-fight-log-wrap"><div class="pvp-log-head">Журнал</div>' +
    '<div class="pvp-log sf-scroll">' +
    pvpLogHtml(d.logEntries) +
    '</div></div><div class="pvp-fight-foot pvp-result-actions">' +
    '<button type="button" class="pvp-start" id="pvpAgainBtn">Ещё раз</button>' +
    '<button type="button" class="pvp-forfeit" id="pvpBackSetupBtn">Назад</button></div></div>';
  document.getElementById("pvpAgainBtn").onclick = () => pvpBeginPractice();
  document.getElementById("pvpBackSetupBtn").onclick = () => {
    pvpResetDuelState();
    renderPvpArena();
  };
  if (d.lastFx) {
    const fx = d.lastFx;
    d.lastFx = null;
    requestAnimationFrame(() => pvpPlayRoundFx(body, fx));
  }
}

function wirePvpArenaHotkeys() {
  if (typeof document === "undefined" || document._pvpHotkeysBound) return;
  document._pvpHotkeysBound = true;
  document.addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!document.getElementById("screen-pvp-arena")?.classList.contains("active")) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
    const modalOpen =
      (document.getElementById("modalBackdrop") && !document.getElementById("modalBackdrop").hidden) ||
      (document.getElementById("achModalBackdrop") && !document.getElementById("achModalBackdrop").hidden) ||
      (document.getElementById("achRewardBackdrop") && !document.getElementById("achRewardBackdrop").hidden) ||
      (document.getElementById("storyBackdrop") && !document.getElementById("storyBackdrop").hidden);
    if (modalOpen) return;
    const fight = document.querySelector("#pvpArenaBody .pvp-fight:not(.is-over)");
    if (!fight) return;
    const btn = fight.querySelector(
      '[data-hotkey-code="' + e.code + '"]:not([disabled])'
    );
    if (!btn) return;
    e.preventDefault();
    btn.click();
  });
}

function bindPvpArenaUi() {
  const tile = document.getElementById("pvpArenaTile");
  if (tile && !tile._pvpBound) {
    tile._pvpBound = true;
    tile.onclick = () => openPvpArena();
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPvpArena();
      }
    });
  }
  const helpBtn = document.getElementById("pvpHelpBtn");
  if (helpBtn && !helpBtn._pvpBound) {
    helpBtn._pvpBound = true;
    helpBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      showPvpArenaHelp();
    };
  }
  wirePvpArenaHotkeys();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPvpArenaUi);
  } else {
    bindPvpArenaUi();
  }
}
