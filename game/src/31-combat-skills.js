// ===== Боевые скиллы на поле задания (класс + уровень) =====

const COMBAT_SKILLS = {
  fighter: [
    {
      id: "power_strike",
      name: "Мощный удар",
      icon: "icons/skill0029.png?v=2",
      unlockLevel: 4,
      cdMs: 8500,
      hotkey: "Q",
      hotkeyCode: "KeyQ",
      desc: "Следующий удар наносит ×2.5 урона.",
      effect: "nextHit",
      mult: 2.5,
      fxColor: "#ffb07a",
    },
    {
      id: "iron_shell",
      name: "Железная стойка",
      icon: "icons/skill0279.png?v=2",
      unlockLevel: 8,
      cdMs: 13000,
      hotkey: "E",
      hotkeyCode: "KeyE",
      desc: "4 сек: таймер врага течёт вдвое медленнее.",
      effect: "timerSlow",
      duration: 4000,
      fxColor: "#c8d0dc",
    },
    {
      id: "cleave",
      name: "Рассечение",
      icon: "icons/skill0008.png?v=2",
      unlockLevel: 12,
      cdMs: 11000,
      hotkey: "R",
      hotkeyCode: "KeyR",
      desc: "Пять ударов по цели (50% урона каждый).",
      effect: "multiHit",
      hits: 5,
      mult: 0.5,
      fxColor: "#ff9a6a",
    },
    {
      id: "blood_rage",
      name: "Кровавый раж",
      icon: "icons/skill0176.png?v=2",
      unlockLevel: 16,
      cdMs: 18000,
      hotkey: "F",
      hotkeyCode: "KeyF",
      desc: "8 сек: +85% урона от кликов.",
      effect: "damageBuff",
      duration: 8000,
      mult: 1.85,
      fxColor: "#ff6a5a",
    },
  ],
  mystic: [
    {
      id: "soul_burst",
      name: "Всплеск души",
      icon: "icons/skill1184.png?v=2",
      unlockLevel: 4,
      cdMs: 9000,
      hotkey: "Q",
      hotkeyCode: "KeyQ",
      desc: "Магический залп по цели (×3.0 урона).",
      effect: "directHit",
      mult: 3.0,
      fxColor: "#6ec4ff",
    },
    {
      id: "arcane_focus",
      name: "Магический фокус",
      icon: "icons/skill1297.png?v=2",
      unlockLevel: 8,
      cdMs: 13000,
      hotkey: "E",
      hotkeyCode: "KeyE",
      desc: "7.5 сек: +78% урона от кликов.",
      effect: "damageBuff",
      duration: 7500,
      mult: 1.78,
      fxColor: "#b8a0ff",
    },
    {
      id: "ice_shackles",
      name: "Ледяные оковы",
      icon: "icons/skill1435.png?v=2",
      unlockLevel: 12,
      cdMs: 12000,
      hotkey: "R",
      hotkeyCode: "KeyR",
      desc: "2.5 сек: таймер врага останавливается + залп (4×45% урона).",
      effect: "freezeMulti",
      duration: 2500,
      hits: 4,
      mult: 0.45,
      fxColor: "#8ad4ff",
    },
    {
      id: "soul_drain",
      name: "Поглощение души",
      icon: "icons/skill1147.png?v=2",
      unlockLevel: 16,
      cdMs: 16000,
      hotkey: "F",
      hotkeyCode: "KeyF",
      desc: "Удар ×2.2 и +3.5 сек к таймеру цели.",
      effect: "drainHit",
      mult: 2.2,
      healMs: 3500,
      fxColor: "#c8a0ff",
    },
  ],
};

let mineSkillRuntime = { cds: {}, buffs: {} };

function resetMineSkillRuntime() {
  mineSkillRuntime = {
    cds: {},
    buffs: { nextHitMult: 1, damageMult: 1, damageUntil: 0, timerSlowUntil: 0, timerFreezeUntil: 0 },
  };
}

function combatSkillsForClass(classId) {
  const arch = typeof isMysticArchetype === "function" && isMysticArchetype(classId) ? "mystic" : "fighter";
  return COMBAT_SKILLS[arch] || COMBAT_SKILLS.fighter;
}

function combatSkillsForAvatar() {
  if (!state.avatar?.created) return [];
  return combatSkillsForClass(state.avatar.classId || "fighter");
}

function isCombatSkillUnlocked(skill) {
  if (!skill || !state.avatar?.created) return false;
  return (state.avatar.level || 1) >= (skill.unlockLevel || 99);
}

function combatSkillCooldownLeft(skillId) {
  const end = mineSkillRuntime.cds[skillId] || 0;
  return Math.max(0, end - Date.now());
}

function mineSkillClickMult() {
  let m = 1;
  if (mineSkillRuntime.buffs.nextHitMult > 1) {
    m *= mineSkillRuntime.buffs.nextHitMult;
    mineSkillRuntime.buffs.nextHitMult = 1;
  }
  if (mineSkillRuntime.buffs.damageUntil > Date.now()) {
    m *= mineSkillRuntime.buffs.damageMult || 1;
  }
  return m;
}

function mineSkillTimerFreezeActive() {
  return mineSkillRuntime.buffs.timerFreezeUntil > Date.now();
}

function mineSkillTimerDrainAdjust() {
  const now = Date.now();
  if (mineSkillRuntime.buffs.timerFreezeUntil > now) return 0;
  if (mineSkillRuntime.buffs.timerSlowUntil > now) return -0.42;
  return 0;
}

function activeCombatMob() {
  for (const g of mineGnomes) {
    if (g._type !== "banan") return g;
  }
  return null;
}

function applyDirectMobHit(g, mult, opts) {
  opts = opts || {};
  if (!mineGnomes.has(g) || g._type === "banan") return false;
  const type = g._type || "normal";
  const dropAt = gnomeDropPoint(g);
  const dmg = typeof avatarMineClickDamage === "function" ? avatarMineClickDamage() : 8;
  let applied = Math.max(1, Math.round(dmg * (mult || 1)));
  if (typeof applyMineShotDamageMult === "function") applied = applyMineShotDamageMult(applied);
  else applied = Math.max(1, Math.round(applied * 0.5));
  applied = applyMobShieldDamage(g, applied);
  g._hp = (g._hp ?? g._maxHp) - applied;
  if (typeof Audio2 !== "undefined" && Audio2.mineHit) Audio2.mineHit();
  g.classList.add("mob-hit");
  setTimeout(() => g.classList.remove("mob-hit"), 90);
  updateMobHpBar(g);
  floatText(dropAt.x, dropAt.y - 12, "-" + fmtCombat(applied), opts.color || "#9ad4ff");
  mineBurst(dropAt.x, dropAt.y, opts.color || "#7eb8ff", 4);
  checkMobEnrage(g);
  if (g._hp > 0) return true;
  const finishMult = typeof tune === "function" ? tune("mine.skillFinishMult", 1.35) : 1.35;
  finishMobKill(g, type, dropAt, { mult: finishMult, ok: true, bySkill: true });
  return true;
}

function useCombatSkill(skillId) {
  const skills = combatSkillsForAvatar();
  const skill = skills.find((s) => s.id === skillId);
  if (!skill || !isCombatSkillUnlocked(skill)) {
    if (typeof toast === "function") toast("Скилл ещё не открыт", "warn");
    return false;
  }
  if (!mineActive) return false;
  if (typeof isGamePaused === "function" && isGamePaused()) return false;
  if (combatSkillCooldownLeft(skillId) > 0) return false;
  const mob = activeCombatMob();
  const noTargetOk = skill.effect === "timerSlow" || skill.effect === "damageBuff" || skill.effect === "timerFreeze" || skill.effect === "freezeMulti";
  if (!mob && !noTargetOk && skill.effect !== "drainHit") {
    if (typeof toast === "function") toast("Нет цели на поле", "warn");
    return false;
  }
  if ((skill.effect === "multiHit" || skill.effect === "directHit" || skill.effect === "drainHit") && !mob) {
    if (typeof toast === "function") toast("Нет цели на поле", "warn");
    return false;
  }
  mineSkillRuntime.cds[skillId] = Date.now() + skill.cdMs;
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (skill.effect === "nextHit") {
    mineSkillRuntime.buffs.nextHitMult = skill.mult || 2;
    if (typeof toast === "function") toast(skill.name + ": следующий удар усилен", "info");
  } else if (skill.effect === "timerSlow") {
    mineSkillRuntime.buffs.timerSlowUntil = Date.now() + (skill.duration || 4000);
    if (typeof toast === "function") toast(skill.name + ": таймер замедлен", "info");
  } else if (skill.effect === "timerFreeze" || skill.effect === "freezeMulti") {
    mineSkillRuntime.buffs.timerFreezeUntil = Date.now() + (skill.duration || 2500);
    if (skill.effect === "freezeMulti" && mob) {
      const hits = skill.hits || 4;
      const mult = skill.mult || 0.45;
      const color = skill.fxColor || "#8ad4ff";
      for (let i = 0; i < hits; i++) {
        setTimeout(() => {
          if (mineGnomes.has(mob)) applyDirectMobHit(mob, mult, { color });
        }, i * 90);
      }
    }
    if (typeof toast === "function") toast(skill.name + ": время остановилось", "info");
  } else if (skill.effect === "damageBuff") {
    mineSkillRuntime.buffs.damageMult = skill.mult || 1.5;
    mineSkillRuntime.buffs.damageUntil = Date.now() + (skill.duration || 6000);
    if (typeof toast === "function") toast(skill.name + ": урон усилен", "info");
  } else if (skill.effect === "multiHit" && mob) {
    const hits = skill.hits || 3;
    const mult = skill.mult || 0.65;
    const color = skill.fxColor || "#ff9a6a";
    for (let i = 0; i < hits; i++) {
      setTimeout(() => {
        if (mineGnomes.has(mob)) applyDirectMobHit(mob, mult, { color });
      }, i * 90);
    }
    if (typeof toast === "function") toast(skill.name + "!", "info");
  } else if (skill.effect === "directHit" && mob) {
    applyDirectMobHit(mob, skill.mult || 2.5, { color: skill.fxColor || "#6ec4ff" });
    if (typeof toast === "function") toast(skill.name + "!", "info");
  } else if (skill.effect === "drainHit" && mob) {
    applyDirectMobHit(mob, skill.mult || 1.8, { color: skill.fxColor || "#c8a0ff" });
    if (mob._enraged) {
      if (typeof toast === "function") toast(skill.name + ": в ярости время не вернуть", "warn");
    } else if (typeof extendMobTimer === "function") {
      extendMobTimer(mob, skill.healMs || 3000);
      if (typeof toast === "function") toast(skill.name + ": душа поглощена", "info");
    }
  }
  renderMineSkillBar();
  renderAvatarSkillsPanel();
  return true;
}

const MINE_SKILL_BAR_POS_KEY = "sf_mine_skill_bar_pos_v1";
let mineSkillBarDragBound = false;

function mineSkillBarIsMobile() {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 640px)").matches;
}

function clearMineSkillBarInlinePos(bar) {
  if (!bar) return;
  bar.style.left = "";
  bar.style.bottom = "";
  bar.style.top = "";
  bar.style.right = "";
  bar.style.transform = "";
}

function readMineSkillBarPos() {
  try {
    const raw = localStorage.getItem(MINE_SKILL_BAR_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.leftPct !== "number" || typeof p.bottomPct !== "number") return null;
    return {
      leftPct: Math.min(92, Math.max(8, p.leftPct)),
      bottomPct: Math.min(88, Math.max(4, p.bottomPct)),
    };
  } catch (_) {
    return null;
  }
}

function saveMineSkillBarPos(leftPct, bottomPct) {
  try {
    localStorage.setItem(
      MINE_SKILL_BAR_POS_KEY,
      JSON.stringify({ leftPct, bottomPct })
    );
  } catch (_) {}
}

function applyMineSkillBarPos(bar) {
  if (!bar) return;
  if (mineSkillBarIsMobile()) {
    clearMineSkillBarInlinePos(bar);
    return;
  }
  const pos = readMineSkillBarPos();
  if (!pos) {
    clearMineSkillBarInlinePos(bar);
    return;
  }
  bar.style.left = pos.leftPct + "%";
  bar.style.bottom = pos.bottomPct + "%";
  bar.style.top = "auto";
  bar.style.right = "auto";
  bar.style.transform = "translateX(-50%)";
}

function clampMineSkillBarToField(bar) {
  if (mineSkillBarIsMobile()) {
    clearMineSkillBarInlinePos(bar);
    return;
  }
  const field = bar?.parentElement;
  if (!bar || !field) return;
  const fr = field.getBoundingClientRect();
  const br = bar.getBoundingClientRect();
  if (fr.width < 40 || fr.height < 40 || br.width < 8) return;
  let left = br.left - fr.left + br.width / 2;
  let bottom = fr.bottom - br.bottom;
  const half = br.width / 2;
  left = Math.min(fr.width - half - 4, Math.max(half + 4, left));
  bottom = Math.min(fr.height - br.height - 4, Math.max(4, bottom));
  const leftPct = (left / fr.width) * 100;
  const bottomPct = (bottom / fr.height) * 100;
  bar.style.left = leftPct + "%";
  bar.style.bottom = bottomPct + "%";
  bar.style.top = "auto";
  bar.style.right = "auto";
  bar.style.transform = "translateX(-50%)";
  saveMineSkillBarPos(leftPct, bottomPct);
}

function bindMineSkillBarDrag(bar) {
  if (!bar || mineSkillBarDragBound) return;
  const handle = bar.querySelector(".mine-skill-drag");
  if (!handle) return;
  mineSkillBarDragBound = true;
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originBottom = 0;

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId || mineSkillBarIsMobile()) return;
    const field = bar.parentElement;
    if (!field) return;
    const fr = field.getBoundingClientRect();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let left = originLeft + dx;
    let bottom = originBottom - dy;
    const half = bar.offsetWidth / 2;
    const h = bar.offsetHeight;
    left = Math.min(fr.width - half - 4, Math.max(half + 4, left));
    bottom = Math.min(fr.height - h - 4, Math.max(4, bottom));
    bar.style.left = left + "px";
    bar.style.bottom = bottom + "px";
    bar.style.top = "auto";
    bar.style.right = "auto";
    bar.style.transform = "translateX(-50%)";
  };

  const onUp = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    bar.classList.remove("is-dragging");
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    clampMineSkillBarToField(bar);
  };

  handle.addEventListener("pointerdown", (e) => {
    if (mineSkillBarIsMobile()) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const field = bar.parentElement;
    if (!field) return;
    const fr = field.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    originLeft = br.left - fr.left + br.width / 2;
    originBottom = fr.bottom - br.bottom;
    bar.classList.add("is-dragging");
    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
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
  inner.innerHTML = "";
  skills.forEach((skill) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const cd = combatSkillCooldownLeft(skill.id);
    const ready = isCombatSkillUnlocked(skill) && cd <= 0;
    btn.className = "mine-skill-btn" + (ready ? "" : " on-cd") + (!isCombatSkillUnlocked(skill) ? " locked" : "");
    btn.disabled = !isCombatSkillUnlocked(skill);
    const keyHint = mineSkillBarIsMobile() ? "" : " [" + skill.hotkey + "]";
    btn.title =
      skill.name +
      keyHint +
      " · " +
      skill.desc +
      (isCombatSkillUnlocked(skill) ? "" : " · ур. " + skill.unlockLevel);
    btn.innerHTML =
      '<img src="' + skill.icon + '" alt="">' +
      (mineSkillBarIsMobile() ? "" : '<span class="mine-skill-key">' + skill.hotkey + "</span>") +
      (cd > 0 ? '<span class="mine-skill-cd">' + Math.ceil(cd / 1000) + "</span>" : "");
    btn.onclick = () => useCombatSkill(skill.id);
    inner.appendChild(btn);
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
