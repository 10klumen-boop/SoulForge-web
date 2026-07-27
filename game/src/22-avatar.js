// ===== Персонаж: UI (хаб, экран, setup) =====
// Core logic (createAvatar, grantAvatarXp, avatarProgress и т.д.) вынесено в avatar-core.js.

function renderAvatarHub() {
  migrateAvatar();
  const hub = document.getElementById("avatarHub");
  const xpWrap = document.getElementById("topbarXp");
  if (!hub) return;
  if (needsAvatarSetup()) {
    hub.hidden = true;
    if (xpWrap) xpWrap.hidden = true;
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
  if (icon && typeof avatarPortraitForAvatar === "function") {
    if (typeof bindAvatarPortraitFallback === "function") bindAvatarPortraitFallback(icon);
    icon.src = avatarPortraitForAvatar(state.avatar);
  } else if (icon) icon.src = info.icon;
  // Имя героя (не логин аккаунта)
  let heroName = String(state.avatar?.name || "").trim();
  if (!heroName && Array.isArray(state.characters) && state.activeCharacterId) {
    const slot = state.characters.find((c) => c.id === state.activeCharacterId);
    heroName = String(slot?.progress?.avatar?.name || "").trim();
  }
  if (nameEl) {
    nameEl.textContent = heroName || "—";
    nameEl.title = heroName ? "Персонаж: " + heroName : "";
  }
  if (metaEl) {
    metaEl.textContent = info.className + " · ур. " + prog.level;
  }
  const xpBar = document.getElementById("topbarXpBar");
  const xpLabel = document.getElementById("topbarXpLabel");
  if (xpWrap && xpBar && xpLabel) {
    xpWrap.hidden = false;
    const maxed = prog.level >= AVATAR_MAX_LEVEL;
    xpBar.style.width = (maxed ? 100 : prog.pct) + "%";
    xpLabel.textContent = maxed ? "MAX" : prog.xp + " / " + prog.need;
    xpWrap.title = maxed
      ? "Максимальный уровень"
      : prog.xp + " / " + prog.need + " опыта души";
  }
}

function renderAvatarScreen() {
  migrateAvatar();
  const info = avatarDisplayInfo();
  const prog = avatarProgress();
  const rankBonus = avatarEnchantBonus(safeLevel(), "regular");
  const gearBonus = typeof avatarGearEnchantBonus === "function" ? avatarGearEnchantBonus(safeLevel(), "regular") : 0;
  const bonusPct = ((rankBonus + gearBonus) * 100).toFixed(2);
  const portraitWrap = document.querySelector("#screen-avatar .avatar-portrait-wrap");
  if (portraitWrap) {
    portraitWrap.className = "avatar-portrait-wrap race-" + (state.avatar.raceId || "human");
  }
  const portraitEl = $("#avatarPortrait");
  if (portraitEl && typeof avatarPortraitForAvatar === "function") {
    if (typeof bindAvatarPortraitFallback === "function") bindAvatarPortraitFallback(portraitEl);
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
  renderAvatarPerkChips(prog, bonusPct);
  if (typeof renderAvatarStatsPanel === "function") renderAvatarStatsPanel();
  if (typeof renderPassiveIncomePanel === "function") renderPassiveIncomePanel();
  if (typeof renderAutoClickerPanel === "function") renderAutoClickerPanel();
  if (typeof renderAvatarPassiveSkillsPanel === "function") renderAvatarPassiveSkillsPanel();
  if (typeof renderAvatarSkillsPanel === "function") renderAvatarSkillsPanel();
  if (typeof renderProfessionBanner === "function") renderProfessionBanner();
  if (typeof renderAvatarArmorDisplay === "function") renderAvatarArmorDisplay();
  applyAvatarTab(getAvatarTab());
}

const AVATAR_TAB_KEY = "sf_avatar_tab";
const AVATAR_TABS = ["overview", "passive", "combat", "income"];

function getAvatarTab() {
  try {
    let t = sessionStorage.getItem(AVATAR_TAB_KEY);
    if (t === "skills") t = "passive";
    if (t && AVATAR_TABS.indexOf(t) >= 0) return t;
  } catch (_) {}
  return "overview";
}

function setAvatarTab(tabId) {
  const id = AVATAR_TABS.indexOf(tabId) >= 0 ? tabId : "overview";
  try {
    sessionStorage.setItem(AVATAR_TAB_KEY, id);
  } catch (_) {}
  applyAvatarTab(id);
}

function applyAvatarTab(tabId) {
  const id = AVATAR_TABS.indexOf(tabId) >= 0 ? tabId : "overview";
  document.querySelectorAll("#screen-avatar .avatar-tab").forEach((btn) => {
    const on = btn.dataset.avatarTab === id;
    btn.classList.toggle("sel", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll("#screen-avatar .avatar-tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.avatarPanel !== id;
  });
}

function avatarPerkChipHtml(label, text, kind) {
  if (!text) return "";
  const cls = "avatar-perk-chip" + (kind === "warn" ? " is-warn" : kind === "ok" ? " is-ok" : "");
  return '<div class="' + cls + '"><b>' + label + "</b><span>" + text + "</span></div>";
}

function renderAvatarPerkChips(prog, bonusPct) {
  const box = document.getElementById("avatarPerkChips");
  if (!box) return;
  const chips = [];
  const minLvl = typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar.classId) ? 10 : 9;
  if (prog.level < minLvl) {
    chips.push(avatarPerkChipHtml("Заточка", "С " + minLvl + " ур.: бонус уровня к заточке с +4"));
  } else if (parseFloat(bonusPct) > 0) {
    chips.push(avatarPerkChipHtml("Заточка", "+" + bonusPct + "% с +4 (уровень + экип)", "ok"));
  }
  const gearSum = typeof avatarGearBonusSummary === "function" ? avatarGearBonusSummary() : null;
  if (gearSum && gearSum.lines && gearSum.lines.length) {
    const skip = new Set();
    if (typeof armorAffinityHintLine === "function") skip.add(armorAffinityHintLine(state.avatar));
    if (typeof gradePenaltyHintLine === "function") skip.add(gradePenaltyHintLine(state.avatar));
    const gearLines = gearSum.lines.filter((ln) => !skip.has(ln));
    if (gearLines.length) chips.push(avatarPerkChipHtml("Экип", gearLines.join(" · "), "ok"));
  }
  if (typeof professionArmorPref === "function") {
    const pref = professionArmorPref(state.avatar);
    const label =
      (typeof ARMOR_KIND_LABELS !== "undefined" && ARMOR_KIND_LABELS[pref]) || pref || "—";
    const active = typeof avatarArmorAffinityActive === "function" && avatarArmorAffinityActive(state.avatar);
    const pct = Math.round(((typeof ARMOR_AFFINITY_MULT === "number" ? ARMOR_AFFINITY_MULT : 1.06) - 1) * 100);
    chips.push(
      avatarPerkChipHtml(
        "Броня",
        active ? "«" + label + "» · +" + pct + "% урон/DEF" : "Нужно 5/5 («" + label + "»)",
        active ? "ok" : ""
      )
    );
  }
  if (typeof professionWeaponCats === "function") {
    const cats = professionWeaponCats(state.avatar) || [];
    if (cats.length) {
      const names = cats
        .slice(0, 3)
        .map((c) => (typeof WEAPON_CAT_LABELS !== "undefined" && WEAPON_CAT_LABELS[c]) || c)
        .join(", ");
      const w = typeof ensureAvatarGear === "function" ? ensureAvatarGear()?.weapon : null;
      const wdef = w && typeof WMAP !== "undefined" ? WMAP[w.id] : null;
      const masterOn = wdef && typeof avatarWeaponMasteryActive === "function" && avatarWeaponMasteryActive(wdef, state.avatar);
      const wpct = Math.round(((typeof WEAPON_MASTERY_MULT === "number" ? WEAPON_MASTERY_MULT : 1.06) - 1) * 100);
      chips.push(
        avatarPerkChipHtml(
          "Оружие",
          masterOn
            ? names + (cats.length > 3 ? "…" : "") + " · +" + wpct + "%"
            : names + (cats.length > 3 ? "…" : ""),
          masterOn ? "ok" : ""
        )
      );
    }
  }
  if (typeof gradePenaltyHintLine === "function") {
    const g = gradePenaltyHintLine(state.avatar);
    if (g) {
      const over = typeof avatarHasOvergradeGear === "function" && avatarHasOvergradeGear(state.avatar);
      chips.push(avatarPerkChipHtml("Грейд", g, over ? "warn" : "ok"));
    }
  }
  box.innerHTML = chips.join("");
}

function bindAvatarScreenTabs() {
  const tabs = document.querySelector("#screen-avatar .avatar-tabs");
  if (!tabs || tabs.dataset.bound === "1") return;
  tabs.dataset.bound = "1";
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-avatar-tab]");
    if (!btn || !tabs.contains(btn)) return;
    Audio2.click();
    setAvatarTab(btn.dataset.avatarTab);
  });
}

function renderAvatarPassiveSkillsPanel() {
  const el = document.getElementById("avatarPassiveSkillsPanel");
  if (!el) return;
  if (!state.avatar?.created || typeof passiveSkillsForAvatar !== "function") {
    el.innerHTML = "";
    return;
  }
  const skills = passiveSkillsForAvatar(state.avatar).filter(
    (s) =>
      s.kind === "racial" ||
      s.kind === "class" ||
      s.kind === "profession" ||
      s.kind === "weapon_mastery"
  );
  if (!skills.length) {
    el.innerHTML = "";
    return;
  }
  const racial = skills.filter((s) => s.kind === "racial");
  const classish = skills.filter(
    (s) => s.kind === "class" || s.kind === "profession" || s.kind === "weapon_mastery"
  );
  const rowHtml = (s) => {
    const line =
      (typeof passiveSkillGameplayLine === "function" && passiveSkillGameplayLine(s)) ||
      convertMultiplierTextToPct(s.blurb || "") ||
      "";
    return (
      '<div class="avatar-skill-row unlocked">' +
      '<img src="' + (s.icon || "") + '" alt="">' +
      "<div><b>" + s.name + "</b>" +
      (line ? "<p>" + line.replace(/\.$/, "") + "</p>" : "") +
      "</div></div>"
    );
  };
  el.innerHTML =
    '<h4 class="avatar-skills-title">Пассивные умения</h4>' +
    (racial.length
      ? '<p class="avatar-skills-hint">Расовые · всегда действуют</p>' + racial.map(rowHtml).join("")
      : "") +
    (classish.length
      ? '<p class="avatar-skills-hint">Класс / профессия</p>' + classish.map(rowHtml).join("")
      : "");
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
    const racialSkills =
      typeof passiveSkillsRacialForRace === "function" ? passiveSkillsRacialForRace(race.id, 1) : [];
    const passiveHtml = racialSkills
      .map((s) => {
        const ico = s.icon
          ? '<img class="avatar-race-passive-ico" src="' + s.icon + '" alt="" width="18" height="18">'
          : "";
        // Короткие blurbs — иначе в карточке расы текст обрезается
        const line = (s.blurb ||
          (typeof passiveSkillGameplayLine === "function" && passiveSkillGameplayLine(s)) ||
          "").replace(/\.$/, "");
        return (
          '<small class="avatar-race-passive">' +
          ico +
          "<span><b>" + s.name + "</b><span class=\"avatar-race-passive-bonus\">" + line + "</span></span></small>"
        );
      })
      .join("");
    btn.innerHTML =
      '<img class="avatar-pick-race-ico" src="' + race.icon + '" alt="">' +
      "<strong>" + race.name + "</strong>" +
      '<span class="avatar-pick-race-desc">' + race.desc + "</span>" +
      '<div class="avatar-race-passives">' + passiveHtml + "</div>";
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
  const race = avatarRaceInfo(_avatarSetupDraft.raceId);
  if (!grid || !race) return;
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
      "<strong>" + g.name + "</strong>";
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
  const race = avatarRaceInfo(_avatarSetupDraft.raceId);
  if (!grid || !race) return;
  const branches = L2_RACE_CLASSES[race.id] || [];
  const genderId = _avatarSetupDraft.genderId || "male";
  grid.innerHTML = "";
  branches.forEach((cid) => {
    const cls = avatarClassInfo(cid, race.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-pick-card avatar-class-card" + (_avatarSetupDraft.classId === cid ? " sel" : "");
    const portrait =
      typeof avatarPortraitPath === "function"
        ? avatarPortraitPath(race.id, genderId, cid)
        : cls.icon;
    const later =
      typeof professionPreviewIds === "function"
        ? (function () {
            const ids = professionPreviewIds(race.id, cid);
            if (!ids.length) return "";
            const names = ids
              .map((id) => (typeof PROFESSIONS !== "undefined" && PROFESSIONS[id] ? PROFESSIONS[id].name : id))
              .join(" / ");
            return '<small class="avatar-class-later">Позже: ' + names + "</small>";
          })()
        : "";
    btn.innerHTML =
      '<div class="avatar-class-portrait"><img src="' + portrait + '" alt=""></div>' +
      "<strong>" + cls.name + "</strong>" +
      later;
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
    const racialSkills =
      typeof passiveSkillsRacialForRace === "function"
        ? passiveSkillsRacialForRace(race.id, 1, _avatarSetupDraft.classId)
        : [];
    const passivesHtml = racialSkills
      .map((s) => {
        const ico = s.icon
          ? '<img class="avatar-summary-passive-ico" src="' + s.icon + '" alt="" width="18" height="18">'
          : "";
        const line = (s.blurb ||
          (typeof passiveSkillGameplayLine === "function" && passiveSkillGameplayLine(s)) ||
          "").replace(/\.$/, "");
        return (
          '<div class="avatar-summary-passive">' +
          ico +
          "<span><b>" + s.name + "</b> · " + line + "</span></div>"
        );
      })
      .join("");
    summary.innerHTML =
      (portrait ? '<div class="avatar-summary-portrait"><img src="' + portrait + '" alt=""></div>' : "") +
      '<div class="avatar-summary-body">' +
      "<strong>" + race.name + " — " + cls.name + "</strong>" +
      (gender ? '<p class="avatar-summary-gender">' + gender.name + "</p>" : "") +
      (passivesHtml
        ? '<div class="avatar-summary-passives"><span class="avatar-summary-passives-label">Расовые пассивки</span>' +
          passivesHtml +
          "</div>"
        : "") +
      "</div>";
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

async function submitAvatarSetup() {
  const inp = document.getElementById("avatarNameInput");
  const name = inp ? inp.value : "";
  const check =
    typeof checkAvatarNameAvailable === "function"
      ? await checkAvatarNameAvailable(name, { excludeCharId: state.activeCharacterId })
      : typeof validateAvatarNameLocal === "function"
        ? validateAvatarNameLocal(name)
        : { ok: String(name || "").trim().length >= 2, error: "Укажи имя" };
  if (!check.ok) {
    toast(check.error || "Имя недоступно", "warn");
    if (inp) inp.focus();
    return;
  }
  if (!createAvatar(check.name || name, _avatarSetupDraft.raceId, _avatarSetupDraft.classId, _avatarSetupDraft.genderId)) {
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
  bindAvatarScreenTabs();
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
