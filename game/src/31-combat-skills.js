// ===== Боевые скиллы: UI (рендер скилл-бара, панели аватара) =====
// Core logic (useCombatSkill, combatSkillCooldownLeft, mineSkillClickMult)
// вынесено в combat-skills-core.js.

function syncMineSkillBtn(btn, skill) {
  const cd = combatSkillCooldownLeft(skill.id);
  const unlocked = isCombatSkillUnlocked(skill);
  const ready = unlocked && cd <= 0;
  btn.className =
    "mine-skill-btn" + (ready ? "" : " on-cd") + (unlocked ? "" : " locked");
  btn.disabled = !unlocked;
  const keyHint = mineSkillBarIsMobile() ? "" : " [" + skill.hotkey + "]";
  btn.title =
    skill.name +
    keyHint +
    " · " +
    skill.desc +
    (unlocked ? "" : " · ур. " + skill.unlockLevel);
  let img = btn.querySelector("img");
  if (!img) {
    img = document.createElement("img");
    img.alt = "";
    btn.appendChild(img);
  }
  if (img.getAttribute("src") !== skill.icon) img.src = skill.icon;

  let keyEl = btn.querySelector(".mine-skill-key");
  if (mineSkillBarIsMobile()) {
    if (keyEl) keyEl.remove();
  } else {
    if (!keyEl) {
      keyEl = document.createElement("span");
      keyEl.className = "mine-skill-key";
      btn.appendChild(keyEl);
    }
    keyEl.textContent = skill.hotkey;
  }

  let cdEl = btn.querySelector(".mine-skill-cd");
  if (cd > 0) {
    if (!cdEl) {
      cdEl = document.createElement("span");
      cdEl.className = "mine-skill-cd";
      btn.appendChild(cdEl);
    }
    cdEl.textContent = String(Math.ceil(cd / 1000));
  } else if (cdEl) {
    cdEl.remove();
  }
}

function renderMineSkillBar() {
  const bar = document.getElementById("mineSkillBar");
  if (!bar) return;
  if (!mineActive || !state.avatar?.created) {
    bar.hidden = true;
    return;
  }
  const skills = combatSkillsForAvatar();
  const unlocked = skills.filter(isCombatSkillUnlocked);
  if (!unlocked.length) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  let dock = bar.querySelector(".mine-skill-dock");
  if (!dock) {
    bar.innerHTML =
      '<div class="mine-skill-dock">' +
      '<div class="mine-skill-drag" title="Перетащить плашку" aria-label="Перетащить"></div>' +
      '<div class="mine-skill-bar-inner"></div>' +
      "</div>";
    dock = bar.querySelector(".mine-skill-dock");
    mineSkillBarDragBound = false;
    bindMineSkillBarDrag(bar);
  }
  applyMineSkillBarPos(bar);
  const inner = bar.querySelector(".mine-skill-bar-inner");
  if (!inner) return;

  const wanted = skills.map((s) => s.id).join(",");
  if (inner.dataset.skillIds !== wanted) {
    inner.dataset.skillIds = wanted;
    inner.innerHTML = "";
    skills.forEach((skill) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.skillId = skill.id;
      bindMineSkillBtn(btn, skill.id);
      syncMineSkillBtn(btn, skill);
      inner.appendChild(btn);
    });
    return;
  }

  skills.forEach((skill) => {
    const btn = inner.querySelector('[data-skill-id="' + skill.id + '"]');
    if (btn) syncMineSkillBtn(btn, skill);
  });
}

function renderAvatarSkillsPanel() {
  const el = document.getElementById("avatarSkillsPanel");
  if (!el) return;
  if (!state.avatar?.created) {
    el.innerHTML = "";
    return;
  }
  const skills = combatSkillsForAvatar();
  const lvl = state.avatar.level || 1;
  const className =
    typeof L2_CLASSES !== "undefined" && state.avatar.classId
      ? (L2_CLASSES[state.avatar.classId]?.name || "")
      : "";
  el.innerHTML =
    '<h4 class="avatar-skills-title">Боевые скиллы' +
    (className ? " · " + className : "") +
    "</h4>" +
    '<p class="avatar-skills-hint">На поле задания · клавиши Q · E · R · F</p>' +
    skills.map((s) => {
      const open = lvl >= s.unlockLevel;
      return (
        '<div class="avatar-skill-row' + (open ? " unlocked" : " locked") + '">' +
        '<img src="' + s.icon + '" alt="">' +
        "<div><b>" + s.name + "</b>" +
        (open ? "" : ' <small>· ур. ' + s.unlockLevel + "</small>") +
        "<p>" + s.desc + "</p></div></div>"
      );
    }).join("");
}

function wireCombatSkills() {
  document.addEventListener("keydown", (e) => {
    if (!mineActive || e.repeat) return;
    if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
    const modalOpen = document.getElementById("storyBackdrop") && !document.getElementById("storyBackdrop").hidden;
    if (modalOpen) return;
    const skills = combatSkillsForAvatar();
    const skill = skills.find((s) => s.hotkeyCode && s.hotkeyCode === e.code);
    if (skill && $("#screen-mine")?.classList.contains("active")) {
      e.preventDefault();
      useCombatSkill(skill.id);
    }
  });
  setInterval(() => {
    if (mineActive && document.getElementById("mineSkillBar") && !document.getElementById("mineSkillBar").hidden) {
      renderMineSkillBar();
    }
  }, 400);
}

function applyMobShieldDamage(g, applied) {
  if (!g._shielded || g._shieldBroken) return applied;
  g._shieldHits = (g._shieldHits || 0) + 1;
  if (g._shieldHits >= 3) {
    g._shieldBroken = true;
    g.classList.remove("mob-shielded");
    if (typeof toast === "function") toast("Щит пробит!", "info");
    return applied;
  }
  return Math.max(1, Math.round(applied * 0.35));
}

function rollMobShield(type, chapter) {
  const ch = chapter || 1;
  if (type === "boss") return true;
  if (type === "golden") return Math.random() < 0.42 + ch * 0.03;
  return Math.random() < 0.16 + ch * 0.045;
}

function mobEnrageChance(type) {
  const t = type || "normal";
  if (t === "boss") return typeof tune === "function" ? tune("mine.enrageBoss", 0.55) : 0.55;
  if (t === "golden") return typeof tune === "function" ? tune("mine.enrageGolden", 0.4) : 0.4;
  return typeof tune === "function" ? tune("mine.enrageNormal", 0.28) : 0.28;
}

function checkMobEnrage(g) {
  if (!g || !g._maxHp || g._enraged || g._enrageRolled) return;
  const threshold = typeof tune === "function" ? tune("mine.enrageHp", 0.35) : 0.35;
  if (g._hp / g._maxHp > threshold) return;
  // Один бросок на моба при пересечении порога HP
  g._enrageRolled = true;
  const chance = mobEnrageChance(g._type);
  if (Math.random() >= chance) return;
  g._enraged = true;
  g.classList.add("mob-enraged");
  if (typeof toast === "function") toast("Ярость! Таймер ускорился — добей врага", "warn");
}

function mobTimerUrgencyDrain(g, left, total) {
  if (!total || left <= 0) return 0;
  if (typeof mineSkillTimerFreezeActive === "function" && mineSkillTimerFreezeActive()) return 0;
  const ratio = left / total;
  let drain = 0;
  // Красная зона таймера — чуть быстрее
  if (ratio < 0.55) {
    g.classList.add("mob-urgent");
    drain += 0.12;
  } else {
    g.classList.remove("mob-urgent");
  }
  // Ярость: заметно ускоряет слив (клики по-прежнему не продлевают таймер)
  if (g._enraged) drain += 0.7;
  drain += mineSkillTimerDrainAdjust();
  return drain;
}
