// ===== Персонаж: UI (хаб, экран, setup) =====
// Core logic (createAvatar, grantAvatarXp, avatarProgress и т.д.) вынесено в avatar-core.js.

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
  if (typeof renderPassiveIncomePanel === "function") renderPassiveIncomePanel();
  if (typeof renderAutoClickerPanel === "function") renderAutoClickerPanel();
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
  if (backBtn) {
    backBtn.hidden = false;
    backBtn.textContent = draft.step <= 1 ? "В меню" : "Назад";
  }
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
  if (_avatarSetupDraft.step <= 1) {
    cancelAvatarSetup();
    return;
  }
  _avatarSetupDraft.step--;
  renderAvatarSetupStep();
}

function cancelAvatarSetup() {
  setAvatarSetupOpen(false);
  _avatarSetupDraft = { step: 1, raceId: null, classId: null, genderId: null };
  const inp = document.getElementById("avatarNameInput");
  if (inp) inp.value = "";
  if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
  if (typeof save === "function") save();
  if (typeof renderCharacterRoster === "function") {
    renderCharacterRoster();
    if (typeof show === "function") show("characters");
  } else if (typeof show === "function") {
    show("home");
  }
  if (typeof renderMenu === "function") renderMenu();
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
  if (typeof syncUiAfterCharacterSwap === "function") syncUiAfterCharacterSwap();
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
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cancelAvatarSetup();
    });
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
