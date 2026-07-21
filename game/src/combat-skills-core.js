// ===== Боевые скиллы: core logic (cd, buffs, useCombatSkill) =====
// Вынесено из 31-combat-skills.js; UI скилл-бара и панели осталось в 31-combat-skills.js.
// Данные скиллов (COMBAT_SKILLS) в data/combat-skills-data.js.

// ===== Боевые скиллы: логика и UI =====
// Данные скиллов (COMBAT_SKILLS) вынесены в data/combat-skills-data.js.

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

function bindMineSkillBtn(btn, skillId) {
  if (btn._sfSkillBound) return;
  btn._sfSkillBound = true;
  const fire = (e) => {
    if (btn.disabled || btn.classList.contains("locked")) return;
    e.preventDefault();
    e.stopPropagation();
    useCombatSkill(skillId);
  };
  // pointerdown: не теряется при обновлении CD, не ждёт click-delay
  btn.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    fire(e);
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

