// ===== Персонаж: типология Lineage 2 (раса → класс), уровень и опыт =====

const AVATAR_MAX_LEVEL = 20;
const AVATAR_XP_BASE = 100;

/** Иконки рас и архетипов — см. 33-ui-icons.js (l2-god.ru / Powerwiki GoD). */
const L2_RACE_ICONS = UI_RACE_ICONS;
const L2_ARCHETYPE_ICONS = UI_ARCHETYPE_ICONS;

const L2_CLASSES = {
  fighter: {
    id: "fighter",
    name: "Воин",
    desc: "Путь стали и заточки. С 9 уровня — бонус к рисковой заточке.",
    icon: UI_CLASS_ICONS.fighter,
  },
  mystic: {
    id: "mystic",
    name: "Мистик",
    desc: "Путь свитков и души клинка. Бонус к заточке с 10 уровня.",
    icon: UI_CLASS_ICONS.mystic,
  },
  shaman: {
    id: "shaman",
    name: "Шаман",
    desc: "Голос Паагрио и духов предков. Бонус к заточке с 10 уровня.",
    icon: UI_CLASS_ICONS.shaman,
  },
};

/** Классическая схема стартовых рас (Interlude). */
const L2_RACES = [
  {
    id: "human",
    name: "Люди",
    desc: "Универсалы Адена. Доступны воин и мистик.",
    icon: L2_RACE_ICONS.human,
  },
  {
    id: "elf",
    name: "Эльфы",
    desc: "Быстрые и точные. Воин или мистик.",
    icon: L2_RACE_ICONS.elf,
  },
  {
    id: "dark_elf",
    name: "Тёмные эльфы",
    desc: "Дети Шилен. Воин или мистик.",
    icon: L2_RACE_ICONS.dark_elf,
  },
  {
    id: "orc",
    name: "Орки",
    desc: "Сила Паагрио. Воин или шаман.",
    icon: L2_RACE_ICONS.orc,
  },
  {
    id: "dwarf",
    name: "Гномы",
    desc: "Ремесло и шахта. Только путь воина.",
    icon: L2_RACE_ICONS.dwarf,
  },
];

const L2_RACE_CLASSES = {
  human: ["fighter", "mystic"],
  elf: ["fighter", "mystic"],
  dark_elf: ["fighter", "mystic"],
  orc: ["fighter", "shaman"],
  dwarf: ["fighter"],
};

function avatarArchetypeIcon(raceId, classId) {
  const map = L2_ARCHETYPE_ICONS[raceId];
  if (map && map[classId]) return map[classId];
  const cls = L2_CLASSES[classId];
  return cls ? cls.icon : L2_CLASSES.fighter.icon;
}

let _avatarSetupDraft = { step: 1, raceId: null, classId: null, genderId: null };

function defaultAvatar() {
  const gear = typeof defaultAvatarGear === "function"
    ? defaultAvatarGear()
    : { weapon: null, earring_l: null, earring_r: null, ring_l: null, ring_r: null, necklace: null };
  return { raceId: "", classId: "", genderId: "", name: "", level: 1, xp: 0, created: false, gear };
}

function avatarRaceInfo(raceId) {
  return L2_RACES.find((r) => r.id === raceId) || null;
}

function avatarClassInfo(classId, raceId) {
  const cls = L2_CLASSES[classId] || L2_CLASSES.fighter;
  if (!raceId) return cls;
  return Object.assign({}, cls, { icon: avatarArchetypeIcon(raceId, classId) });
}

function avatarDisplayInfo(a) {
  a = a || state.avatar || {};
  const race = avatarRaceInfo(a.raceId);
  const cls = avatarClassInfo(a.classId, a.raceId);
  if (!race || !a.classId) {
    return {
      icon: cls.icon,
      name: cls.name,
      raceName: "",
      className: cls.name,
      desc: cls.desc,
      fullTitle: cls.name,
    };
  }
  return {
    icon: cls.icon,
    name: cls.name + " · " + race.name,
    raceName: race.name,
    className: cls.name,
    desc: race.desc + " " + cls.desc,
    fullTitle: race.name + " — " + cls.name,
  };
}

function migrateAvatar() {
  if (!state.avatar || typeof state.avatar !== "object") state.avatar = defaultAvatar();
  const a = state.avatar;
  if (a.classId === "smith") a.classId = "fighter";
  if (!a.level || a.level < 1) a.level = 1;
  if (a.xp == null || a.xp < 0) a.xp = 0;
  if (a.created && (!a.raceId || !a.classId)) {
    a.raceId = a.raceId || "human";
    a.classId = a.classId || "fighter";
  }
  if (a.created && !a.genderId) a.genderId = "male";
  if (a.created && a.prologueSeen == null && state.storySeen) a.prologueSeen = true;
  if (a.created && a.prologueSeen == null) a.prologueSeen = false;
  if (typeof migrateAvatarGear === "function") migrateAvatarGear();
  if (typeof migrateStarterWeapon === "function") migrateStarterWeapon();
  if (a.created) return;
  const hasProgress =
    state.storySeen ||
    (state.totals?.tries || 0) > 0 ||
    (state.totals?.fails || 0) > 0 ||
    inventoryCount() > 0 ||
    (state.adena || 0) > START_ADENA + 500;
  if (hasProgress) {
    a.name = (a.name && String(a.name).trim()) || "Странник";
    a.raceId = a.raceId || "human";
    a.classId = a.classId || "fighter";
    a.genderId = a.genderId || "male";
    a.created = true;
  }
}

function avatarXpToLevel(level) {
  return Math.floor(AVATAR_XP_BASE * Math.pow(1.32, Math.max(0, level - 1)));
}

function avatarTitle(level) {
  const lv = Math.max(1, Math.min(AVATAR_MAX_LEVEL, level || 1));
  if (lv <= 4) return "Новичок";
  if (lv <= 8) return "Подмастерье";
  if (lv <= 12) return "Адепт";
  if (lv <= 16) return "Мастер";
  return "Грандмастер";
}

function avatarProgress() {
  migrateAvatar();
  const a = state.avatar;
  const level = Math.min(a.level || 1, AVATAR_MAX_LEVEL);
  if (level >= AVATAR_MAX_LEVEL) return { level, xp: 0, need: 0, pct: 100 };
  const need = avatarXpToLevel(level);
  const xp = a.xp || 0;
  return { level, xp, need, pct: need ? Math.min(100, (xp / need) * 100) : 0 };
}

/** Бонус к шансу заточки с +4: с 10 уровня, до +0.5% на 20. Воин/орк/гном — чуть раньше (с 9). */
function avatarEnchantBonus(plus, behavior) {
  if (behavior === "guarantee" || plus < safeLevel()) return 0;
  migrateAvatar();
  const lvl = state.avatar.level || 1;
  const minLvl = typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar.classId) ? 10 : 9;
  if (lvl < minLvl) return 0;
  const cap = typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar.classId) ? 0.004 : 0.005;
  const start = minLvl - 1;
  return Math.min(cap, (lvl - start) * 0.0005);
}

function needsAvatarSetup() {
  migrateAvatar();
  const a = state.avatar;
  return !a.created || !String(a.name || "").trim() || !a.raceId || !a.classId || !a.genderId;
}

function createAvatar(name, raceId, classId, genderId) {
  migrateAvatar();
  const n = String(name || "").trim().slice(0, 16);
  const race = avatarRaceInfo(raceId);
  const branches = L2_RACE_CLASSES[raceId] || [];
  const gender = typeof normalizeAvatarGender === "function" ? normalizeAvatarGender(genderId) : "male";
  if (!race || !branches.includes(classId)) return false;
  if (n.length < 2) return false;
  Object.assign(state.avatar, {
    raceId,
    classId,
    genderId: gender,
    name: n,
    level: 1,
    xp: 0,
    created: true,
    prologueSeen: false,
  });
  if (typeof grantStarterWeapon === "function") {
    const item = grantStarterWeapon(classId);
    state.avatar.starterGranted = true;
    const def = item && WMAP[item.id];
    if (def && typeof gameLog === "function") {
      gameLog("Старт: " + def.name + " (NG — не точится, добудь D+ в задании)", "system");
    }
  }
  save();
  return true;
}

function grantAvatarXp(amount, opts) {
  opts = opts || {};
  if (!amount || amount <= 0) return;
  migrateAvatar();
  if (!state.avatar.created) return;
  if (typeof avatarGearXpMult === "function") amount = Math.round(amount * avatarGearXpMult());
  const a = state.avatar;
  if (a.level >= AVATAR_MAX_LEVEL) return;
  a.xp = (a.xp || 0) + amount;
  let leveled = false;
  while (a.level < AVATAR_MAX_LEVEL) {
    const need = avatarXpToLevel(a.level);
    if (a.xp < need) break;
    a.xp -= need;
    a.level++;
    leveled = true;
  }
  if (a.level >= AVATAR_MAX_LEVEL) a.xp = 0;
  if (leveled && !opts.silent) {
    toast("Уровень " + a.level + " — " + avatarTitle(a.level), "success");
    if (typeof gameLog === "function") {
      gameLog("Персонаж: уровень " + a.level + " · " + avatarTitle(a.level), "system");
    }
    if (typeof combatSkillsForAvatar === "function") {
      combatSkillsForAvatar().forEach((s) => {
        if (a.level === s.unlockLevel && typeof toast === "function") {
          toast("Открыт скилл: " + s.name, "success");
        }
      });
    }
  }
  if (leveled) save();
  if (leveled && typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();
  if (leveled && typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  renderAvatarHub();
  renderMenu();
  if (typeof refreshZoneStoryUnlocks === "function") refreshZoneStoryUnlocks();
  if ($("#screen-avatar")?.classList.contains("active")) renderAvatarScreen();
  if (typeof renderAvatarSkillsPanel === "function") renderAvatarSkillsPanel();
}

function onEnchantAvatarXp(win, plus, behavior, broken) {
  if (!state.avatar?.created) return;
  if (win) {
    const risky = plus >= safeLevel();
    grantAvatarXp((risky ? 8 : 3) + Math.min(6, plus || 0), { silent: true });
  } else {
    grantAvatarXp(broken ? 6 : 4, { silent: true });
  }
}

function onMineAvatarXp(golden) {
  if (!state.avatar?.created) return;
  const zone = typeof farmZoneById === "function" ? farmZoneById(state.farmZone || "banana_mine") : { chapter: 1 };
  const ch = zone.chapter || 1;
  // Чуть выше, чтобы киллы главы подводили к reqLevel следующей зоны
  let amt = golden ? 10 + ch * 3 : 3 + ch * 2;
  if (state.avatar.raceId === "dwarf") amt = Math.round(amt * 1.15);
  grantAvatarXp(amt, { silent: true });
}

function onSellAvatarXp(plus) {
  if (!state.avatar?.created || plus < 4) return;
  grantAvatarXp(10 + Math.min(10, plus), { silent: true });
}

function renderAvatarHub() {
  migrateAvatar();
  const hub = document.getElementById("avatarHub");
  if (!hub) return;
  if (needsAvatarSetup()) {
    hub.hidden = true;
    return;
  }
  hub.hidden = false;
  const info = avatarDisplayInfo();
  const prog = avatarProgress();
  const icon = document.getElementById("avatarHubIcon");
  const nameEl = document.getElementById("avatarHubName");
  const metaEl = document.getElementById("avatarHubMeta");
  const wrap = hub.querySelector(".avatar-hub-btn");
  if (wrap) wrap.className = "avatar-hub-btn race-" + (state.avatar.raceId || "human");
  if (icon && typeof avatarPortraitForAvatar === "function") icon.src = avatarPortraitForAvatar(state.avatar);
  else if (icon) icon.src = info.icon;
  if (nameEl) nameEl.textContent = state.avatar.name;
  if (metaEl) {
    metaEl.textContent =
      info.className + " · ур. " + prog.level +
      (prog.level >= AVATAR_MAX_LEVEL ? "" : " · " + prog.xp + "/" + prog.need);
  }
}

function renderAvatarScreen() {
  migrateAvatar();
  const info = avatarDisplayInfo();
  const prog = avatarProgress();
  const rankBonus = avatarEnchantBonus(safeLevel(), "regular");
  const gearBonus = typeof avatarGearEnchantBonus === "function" ? avatarGearEnchantBonus(safeLevel(), "regular") : 0;
  const bonusPct = ((rankBonus + gearBonus) * 100).toFixed(2);
  const portraitWrap = document.querySelector(".avatar-portrait-wrap");
  if (portraitWrap) {
    portraitWrap.className = "avatar-portrait-wrap race-" + (state.avatar.raceId || "human");
  }
  const portraitEl = $("#avatarPortrait");
  if (portraitEl && typeof avatarPortraitForAvatar === "function") {
    portraitEl.src = avatarPortraitForAvatar(state.avatar);
    portraitEl.alt = state.avatar.name || "Портрет";
  }
  $("#avatarName").textContent = state.avatar.name;
  $("#avatarRace").textContent = info.raceName;
  const genderEl = $("#avatarGender");
  if (genderEl) {
    const g = typeof avatarGenderInfo === "function" ? avatarGenderInfo(state.avatar.genderId) : null;
    genderEl.textContent = g ? g.name : "";
  }
  $("#avatarClass").textContent = info.className;
  $("#avatarRank").textContent = "Уровень " + prog.level + " — " + avatarTitle(prog.level);
  const bar = $("#avatarXpBar");
  if (bar) bar.style.width = prog.pct + "%";
  $("#avatarXpText").textContent =
    prog.level >= AVATAR_MAX_LEVEL ? "Максимальный уровень" : prog.xp + " / " + prog.need + " опыта души";
  $("#avatarClassDesc").textContent = info.desc;
  const perk = $("#avatarPerk");
  const minLvl = typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar.classId) ? 10 : 9;
  if (perk) {
    const lines = [];
    if (prog.level < minLvl) {
      lines.push("С " + minLvl + " уровня: бонус уровня к заточке с +4.");
    } else if (parseFloat(bonusPct) > 0) {
      lines.push("Бонус к заточке с +4: +" + bonusPct + "% (уровень + экипировка).");
    }
    if (state.avatar.raceId === "dwarf") lines.push("Гном: +15% опыта души в шахте.");
    const gearSum = typeof avatarGearBonusSummary === "function" ? avatarGearBonusSummary() : null;
    if (gearSum && gearSum.lines.length) lines.push(gearSum.lines.join(" · "));
    perk.textContent = lines.join(" ");
  }
  if (typeof renderAvatarGearSlots === "function") renderAvatarGearSlots();
  if (typeof renderAvatarStatsPanel === "function") renderAvatarStatsPanel();
  if (typeof renderAvatarSkillsPanel === "function") renderAvatarSkillsPanel();
}

function openAvatar(fromScreen) {
  Audio2.click();
  renderAvatarScreen();
  const back = document.querySelector("#screen-avatar .back");
  const to = fromScreen || "home";
  if (back) {
    back.dataset.to = to;
    back.textContent = to === "menu" ? "← В меню" : "← Главное меню";
  }
  show("avatar");
}

function setAvatarSetupOpen(open) {
  const el = document.getElementById("avatarSetupBackdrop");
  if (!el) return;
  el.hidden = !open;
  if (open) {
    if (typeof setGamePaused === "function") setGamePaused(true);
  } else if (typeof syncGamePauseState === "function") {
    syncGamePauseState();
  } else if (typeof setGamePaused === "function") {
    setGamePaused(false);
  }
}

function avatarSetupStepLabels() {
  return ["Раса", "Класс", "Пол", "Имя"];
}

function renderAvatarSetupStep() {
  const draft = _avatarSetupDraft;
  const labels = avatarSetupStepLabels();
  const eyebrow = document.getElementById("avatarSetupEyebrow");
  if (eyebrow) eyebrow.textContent = "Шаг " + draft.step + " · " + labels[draft.step - 1];

  document.querySelectorAll(".avatar-setup-step").forEach((el) => {
    el.hidden = el.dataset.step !== ["race", "class", "gender", "name"][draft.step - 1];
  });

  const backBtn = document.getElementById("avatarSetupBack");
  const nextBtn = document.getElementById("avatarSetupNext");
  if (backBtn) backBtn.hidden = draft.step <= 1;
  if (nextBtn) {
    nextBtn.textContent = draft.step >= 4 ? "Создать персонажа" : "Далее";
  }

  if (draft.step === 1) renderAvatarRaceGrid();
  else if (draft.step === 2) renderAvatarClassGrid();
  else if (draft.step === 3) renderAvatarGenderGrid();
  else renderAvatarNameStep();
}

function renderAvatarRaceGrid() {
  const grid = document.getElementById("avatarRaceGrid");
  if (!grid) return;
  grid.innerHTML = "";
  L2_RACES.forEach((race) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-pick-card race-" + race.id + (_avatarSetupDraft.raceId === race.id ? " sel" : "");
    btn.innerHTML =
      '<img src="' + race.icon + '" alt="">' +
      "<strong>" + race.name + "</strong>" +
      "<span>" + race.desc + "</span>";
    btn.onclick = () => {
      Audio2.click();
      _avatarSetupDraft.raceId = race.id;
      _avatarSetupDraft.classId = null;
      _avatarSetupDraft.genderId = null;
      renderAvatarRaceGrid();
    };
    grid.appendChild(btn);
  });
}

function renderAvatarGenderGrid() {
  const grid = document.getElementById("avatarGenderGrid");
  const hint = document.getElementById("avatarGenderHint");
  const race = avatarRaceInfo(_avatarSetupDraft.raceId);
  if (!grid || !race) return;
  if (hint) {
    const cls = avatarClassInfo(_avatarSetupDraft.classId, race.id);
    hint.textContent =
      "Портрет для «" + race.name + " — " + (cls?.name || "…") + "» — выбери пол.";
  }
  const classId = _avatarSetupDraft.classId || "fighter";
  const genders = typeof AVATAR_GENDERS !== "undefined" ? AVATAR_GENDERS : [
    { id: "male", name: "Мужской", desc: "" },
    { id: "female", name: "Женский", desc: "" },
  ];
  grid.innerHTML = "";
  genders.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "avatar-pick-card avatar-gender-card" +
      (_avatarSetupDraft.genderId === g.id ? " sel" : "");
    const portrait =
      typeof avatarPortraitPath === "function"
        ? avatarPortraitPath(race.id, g.id, classId)
        : "assets/portraits/" + race.id + "_fighter_" + g.id + ".png?v=1";
    btn.innerHTML =
      '<div class="avatar-gender-portrait"><img src="' + portrait + '" alt=""></div>' +
      "<strong>" + g.name + "</strong>" +
      "<span>" + (g.desc || "") + "</span>";
    btn.onclick = () => {
      Audio2.click();
      _avatarSetupDraft.genderId = g.id;
      renderAvatarGenderGrid();
    };
    grid.appendChild(btn);
  });
  if (!_avatarSetupDraft.genderId) {
    _avatarSetupDraft.genderId = "male";
    renderAvatarGenderGrid();
  }
}

function renderAvatarClassGrid() {
  const grid = document.getElementById("avatarClassGrid");
  const hint = document.getElementById("avatarClassHint");
  const race = avatarRaceInfo(_avatarSetupDraft.raceId);
  if (!grid || !race) return;
  const branches = L2_RACE_CLASSES[race.id] || [];
  if (hint) {
    hint.textContent =
      branches.length === 1
        ? race.name + ": доступен только класс «" + L2_CLASSES[branches[0]].name + "»."
        : "Выбери начальный класс для расы «" + race.name + "».";
  }
  grid.innerHTML = "";
  branches.forEach((cid) => {
    const cls = avatarClassInfo(cid, race.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-pick-card" + (_avatarSetupDraft.classId === cid ? " sel" : "");
    btn.innerHTML =
      '<img src="' + cls.icon + '" alt="">' +
      "<strong>" + cls.name + "</strong>" +
      "<span>" + cls.desc + "</span>";
    btn.onclick = () => {
      Audio2.click();
      _avatarSetupDraft.classId = cid;
      renderAvatarClassGrid();
    };
    grid.appendChild(btn);
  });
  if (branches.length === 1 && !_avatarSetupDraft.classId) {
    _avatarSetupDraft.classId = branches[0];
    renderAvatarClassGrid();
  }
  const preview = document.getElementById("avatarClassSkillsPreview");
  if (preview) {
    const cid = _avatarSetupDraft.classId;
    if (cid && typeof combatSkillsForClass === "function") {
      const skills = combatSkillsForClass(cid);
      preview.hidden = false;
      preview.innerHTML =
        "<strong>Боевые скиллы · " + (L2_CLASSES[cid]?.name || cid) + "</strong>" +
        "<ul>" +
        skills
          .map((s) => "<li><b>" + s.hotkey + "</b> · " + s.name + " <small>(ур. " + s.unlockLevel + ")</small> — " + s.desc + "</li>")
          .join("") +
        "</ul>";
    } else {
      preview.hidden = true;
      preview.innerHTML = "";
    }
  }
}

function renderAvatarNameStep() {
  const summary = document.getElementById("avatarSummary");
  const race = avatarRaceInfo(_avatarSetupDraft.raceId);
  const cls = avatarClassInfo(_avatarSetupDraft.classId, _avatarSetupDraft.raceId);
  const gender = typeof avatarGenderInfo === "function" ? avatarGenderInfo(_avatarSetupDraft.genderId) : null;
  const portrait =
    typeof avatarPortraitPath === "function"
      ? avatarPortraitPath(_avatarSetupDraft.raceId, _avatarSetupDraft.genderId, _avatarSetupDraft.classId)
      : "";
  if (summary && race && cls) {
    summary.innerHTML =
      (portrait ? '<div class="avatar-summary-portrait"><img src="' + portrait + '" alt=""></div>' : "") +
      "<div><strong>" + race.name + " — " + cls.name + "</strong>" +
      (gender ? "<p>" + gender.name + "</p>" : "") +
      "<p>" + race.desc + "</p><p>" + cls.desc + "</p></div>";
    summary.className = "avatar-summary race-" + race.id;
  }
  const inp = document.getElementById("avatarNameInput");
  if (inp && document.activeElement !== inp) setTimeout(() => inp.focus(), 80);
}

function avatarSetupNext() {
  const draft = _avatarSetupDraft;
  if (draft.step === 1) {
    if (!draft.raceId) { toast("Выбери расу", "warn"); return; }
    draft.step = 2;
    renderAvatarSetupStep();
    return;
  }
  if (draft.step === 2) {
    if (!draft.classId) { toast("Выбери класс", "warn"); return; }
    draft.step = 3;
    renderAvatarSetupStep();
    return;
  }
  if (draft.step === 3) {
    if (!draft.genderId) { toast("Выбери пол", "warn"); return; }
    draft.step = 4;
    renderAvatarSetupStep();
    return;
  }
  submitAvatarSetup();
}

function avatarSetupBack() {
  if (_avatarSetupDraft.step <= 1) return;
  _avatarSetupDraft.step--;
  renderAvatarSetupStep();
}

function maybeShowAvatarSetup() {
  migrateAvatar();
  if (!needsAvatarSetup()) {
    renderAvatarHub();
    return;
  }
  _avatarSetupDraft = { step: 1, raceId: null, classId: null, genderId: null };
  const inp = document.getElementById("avatarNameInput");
  if (inp) inp.value = "";
  renderAvatarSetupStep();
  setAvatarSetupOpen(true);
}

function submitAvatarSetup() {
  const inp = document.getElementById("avatarNameInput");
  const name = inp ? inp.value : "";
  if (!createAvatar(name, _avatarSetupDraft.raceId, _avatarSetupDraft.classId, _avatarSetupDraft.genderId)) {
    toast("Укажи имя (2–16 символов) и заверши выбор расы, пола и класса", "warn");
    if (inp) inp.focus();
    return;
  }
  if (typeof Audio2 !== "undefined") Audio2.success();
  setAvatarSetupOpen(false);
  renderAvatarHub();
  renderMenu();
  if (typeof renderCharacterRoster === "function") renderCharacterRoster();
  const info = avatarDisplayInfo();
  if (typeof gameLog === "function") {
    gameLog(info.fullTitle + " «" + state.avatar.name + "» встал у наковальни.", "system");
  }
  if (typeof checkAchievements === "function") checkAchievements();
}

function wireAvatar() {
  const backdrop = document.getElementById("avatarSetupBackdrop");
  const nextBtn = document.getElementById("avatarSetupNext");
  const backBtn = document.getElementById("avatarSetupBack");
  const inp = document.getElementById("avatarNameInput");
  const hubBtn = document.getElementById("avatarHubBtn");
  const tileBtn = document.getElementById("avatarTile");
  if (hubBtn && !hubBtn.dataset.wired) {
    hubBtn.dataset.wired = "1";
    hubBtn.onclick = () => openAvatar("menu");
  }
  if (tileBtn && !tileBtn.dataset.wired) {
    tileBtn.dataset.wired = "1";
    tileBtn.onclick = () => {
      if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
        if (typeof maybeShowAvatarSetup === "function") maybeShowAvatarSetup();
        return;
      }
      openAvatar("menu");
    };
  }
  if (backdrop && !backdrop.dataset.wired) {
    backdrop.dataset.wired = "1";
    if (nextBtn) nextBtn.onclick = () => { Audio2.click(); avatarSetupNext(); };
    if (backBtn) backBtn.onclick = () => { Audio2.click(); avatarSetupBack(); };
    if (inp) {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && _avatarSetupDraft.step === 4) {
          e.preventDefault();
          submitAvatarSetup();
        }
      });
    }
  }
}
