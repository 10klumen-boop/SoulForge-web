// ===== Mentor UI: диалог Эйры + spotlight =====

let _mentorHighlightEl = null;
let _mentorResizeObs = null;
let _mentorClipUpdate = null;
let _mentorGateWired = false;

function mentorDockEl() {
  return document.getElementById("mentorDock");
}

function hideMentorUI() {
  if (typeof _mentorResumeTimer !== "undefined" && _mentorResumeTimer) {
    try {
      clearTimeout(_mentorResumeTimer);
      _mentorResumeTimer = null;
    } catch (e) {}
  }
  const dock = mentorDockEl();
  if (dock) {
    dock.hidden = true;
    dock.setAttribute("hidden", "");
    dock.classList.remove("is-open", "is-soft");
    dock.style.display = "none";
    try { delete dock.dataset.place; } catch (e) { dock.dataset.place = ""; }
  }
  clearMentorSpotlight();
  document.body.classList.remove("mentor-active", "mentor-soft");
  if (typeof syncGamePauseState === "function") syncGamePauseState();
}

function clearMentorSpotlight() {
  document.querySelectorAll(".mentor-spotlight-target").forEach((el) => {
    el.classList.remove("mentor-spotlight-target");
  });
  const veil = document.getElementById("mentorVeil");
  if (veil) {
    veil.hidden = true;
    veil.style.clipPath = "";
  }
  if (_mentorClipUpdate) {
    window.removeEventListener("resize", _mentorClipUpdate);
    window.removeEventListener("scroll", _mentorClipUpdate, true);
    _mentorClipUpdate = null;
  }
  _mentorHighlightEl = null;
  if (_mentorResizeObs) {
    try { _mentorResizeObs.disconnect(); } catch (e) {}
    _mentorResizeObs = null;
  }
}

function mentorFindTarget(key) {
  if (!key) return null;
  return document.querySelector('[data-mentor="' + key + '"]');
}

/** Клик разрешён: панель Эйры или подсвеченная цель (и их дети). */
function mentorClickAllowed(node) {
  if (!node || !node.closest) return false;
  if (node.closest("#mentorDock")) return true;
  if (_mentorHighlightEl && (_mentorHighlightEl === node || _mentorHighlightEl.contains(node))) return true;
  if (node.closest && node.closest(".mentor-spotlight-target")) return true;
  return false;
}

function mentorPointerGate(e) {
  if (!document.body.classList.contains("mentor-active")) return;
  if (document.body.classList.contains("mentor-soft")) return;
  const dock = mentorDockEl();
  if (!dock || dock.hidden) return;
  // Без подсветки — только dock (кнопки / галочка)
  if (!_mentorHighlightEl) {
    if (!e.target || !e.target.closest || !e.target.closest("#mentorDock")) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }
  if (mentorClickAllowed(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
}

function wireMentorPointerGate() {
  if (_mentorGateWired) return;
  _mentorGateWired = true;
  // capture: глушим чужие клики, целевая кнопка остаётся кликабельной
  ["pointerdown", "mousedown", "mouseup", "click", "touchstart"].forEach((type) => {
    document.addEventListener(type, mentorPointerGate, true);
  });
}

function applyMentorSpotlight(targetKey, soft) {
  clearMentorSpotlight();
  if (!targetKey || soft) return;
  const el = mentorFindTarget(targetKey);
  if (!el) return;
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  } catch (e) {}
  el.classList.add("mentor-spotlight-target");
  // Кнопки/плитки должны принимать клик поверх veil (veil: pointer-events none)
  try {
    el.style.pointerEvents = "auto";
  } catch (e) {}
  _mentorHighlightEl = el;

  const veil = document.getElementById("mentorVeil");
  if (veil) {
    veil.hidden = false;
    const updateClip = () => {
      if (!_mentorHighlightEl) return;
      const r = _mentorHighlightEl.getBoundingClientRect();
      const pad = 10;
      const top = Math.max(0, r.top - pad);
      const left = Math.max(0, r.left - pad);
      const right = Math.min(window.innerWidth, r.right + pad);
      const bottom = Math.min(window.innerHeight, r.bottom + pad);
      // Визуальная «дыра»; клики идут сквозь veil (pointer-events: none)
      veil.style.clipPath =
        "polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, " +
        left + "px " + top + "px, " +
        left + "px " + bottom + "px, " +
        right + "px " + bottom + "px, " +
        right + "px " + top + "px, " +
        left + "px " + top + "px)";
      if (typeof mentorPlaceDock === "function") {
        const m = state.mentor;
        const bit = typeof mentorBitById === "function" ? mentorBitById(m?.bitId) : null;
        mentorPlaceDock(bit);
      }
    };
    _mentorClipUpdate = updateClip;
    updateClip();
    _mentorResizeObs = new ResizeObserver(updateClip);
    _mentorResizeObs.observe(el);
    window.addEventListener("resize", updateClip);
    window.addEventListener("scroll", updateClip, true);
  }
}

/**
 * Ставит карточку Ючи к краю, чтобы не перекрывать подсветку / рабочие зоны.
 * top — цель внизу (заточка, поле); bottom — по умолчанию и цели сверху.
 */
function mentorPlaceDock(bit) {
  const dock = mentorDockEl();
  if (!dock) return;
  let place = "bottom";

  const screen =
    typeof mentorActiveScreen === "function" ? mentorActiveScreen() : "";
  if (screen === "ench" || screen === "mine" || screen === "shop") place = "top";

  const el = _mentorHighlightEl || (bit && bit.highlight ? mentorFindTarget(bit.highlight) : null);
  if (el) {
    try {
      const r = el.getBoundingClientRect();
      const midY = r.top + r.height / 2;
      const vh = window.innerHeight || 800;
      if (midY > vh * 0.48) place = "top";
      else place = "bottom";
    } catch (e) {}
  } else if (bit && bit.type === "say" && !bit.highlight) {
    place = "bottom";
  }

  if (bit && bit.soft) place = "bottom";

  dock.dataset.place = place;
}

function renderMentorUI() {
  const dock = mentorDockEl();
  if (!dock) return;
  ensureMentorProgress();
  if (typeof mentorSessionOk === "function" && !mentorSessionOk()) {
    hideMentorUI();
    return;
  }
  const m = state.mentor;
  if (m.skipped || !m.bitId) {
    hideMentorUI();
    return;
  }
  const bit = mentorBitById(m.bitId);
  if (!bit || bit.silent) {
    hideMentorUI();
    return;
  }
  if (bit.gates && !mentorGatesOk(bit) && bit.type !== "wait") {
    // Без CTA прячем; с CTA — оставляем кнопку перехода
    if (!(bit.cta && bit.cta.action)) {
      hideMentorUI();
      return;
    }
  }
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) {
    hideMentorUI();
    return;
  }

  const npc = typeof mentorNpc === "function" ? mentorNpc() : { name: "Ючи", role: "", avatarFallback: "" };
  const lines = bit.lines || [];
  const idx = Math.min(m.lineIndex || 0, Math.max(0, lines.length - 1));
  const text = lines[idx] || "";

  const nameEl = document.getElementById("mentorName");
  const roleEl = document.getElementById("mentorRole");
  const textEl = document.getElementById("mentorText");
  const av = document.getElementById("mentorAvatar");
  const okBtn = document.getElementById("mentorOk");
  const dismissWrap = document.getElementById("mentorDismissWrap");
  const dismissCheck = document.getElementById("mentorDismissCheck");
  const ctaBtn = document.getElementById("mentorCta");

  if (nameEl) nameEl.textContent = npc.name || "Ючи";
  if (roleEl) roleEl.textContent = npc.role || "";
  if (textEl) textEl.textContent = text;
  if (av) {
    const emo =
      typeof mentorEmotionForBit === "function"
        ? mentorEmotionForBit(bit)
        : bit.emotion || "happy";
    const src = typeof mentorAvatarSrc === "function" ? mentorAvatarSrc(emo) : npc.avatarFallback;
    av.onerror = function () {
      this.onerror = null;
      this.src = (npc.emotions && npc.emotions.happy) || npc.avatarFallback || "icons/npc/yuchi_happy.png?v=5";
    };
    av.src = src;
    av.alt = npc.name || "Ючи";
    av.dataset.emotion = emo;
  }

  const waitingEvent = !!(bit.advanceOn && String(bit.advanceOn).startsWith("event:"));
  if (okBtn) {
    if (bit.type === "point" && waitingEvent && bit.cta) {
      okBtn.hidden = true;
    } else if (bit.type === "point" && waitingEvent) {
      okBtn.hidden = true;
    } else {
      okBtn.hidden = false;
      okBtn.textContent = idx < lines.length - 1 ? "Далее" : "Понятно";
    }
    if (bit.type === "say" || bit.type === "chapter_gate" || bit.soft) {
      okBtn.hidden = false;
    }
    if (bit.type === "point" && bit.advanceOn === "ok") okBtn.hidden = false;
  }
  if (dismissWrap) dismissWrap.hidden = !!bit.soft;
  if (dismissCheck) dismissCheck.checked = false;
  if (ctaBtn) {
    let showCta = !!(bit.cta && bit.cta.label);
    let ctaAction = bit.cta && bit.cta.action ? bit.cta.action : "";
    let ctaLabel = bit.cta && bit.cta.label ? bit.cta.label : "";
    const screen = mentorActiveScreen();
    // На поле уже: не дублируем «На поле» — жать по цели
    if (showCta && ctaAction === "open_mine" && screen === "mine") {
      showCta = false;
    }
    // На заточке: CTA «Заточить», не «К заточке»
    if (showCta && ctaAction === "open_ench" && screen === "ench") {
      showCta = false;
    }
    if (showCta && ctaAction === "open_inv" && screen === "inv") {
      showCta = false;
    }
    if (showCta && ctaAction === "open_quests" && screen === "quests") {
      showCta = false;
    }
    // Мастерская: с меню — «В мастерскую»; уже внутри — «Скрафтить»
    if (bit.id === "eyra_workshop_shots" || bit.id === "eyra_workshop_open") {
      if (screen === "shop") {
        showCta = true;
        ctaAction = "click_craft_shot";
        ctaLabel = "Скрафтить";
        mentorEnsureWorkshopShotsView();
      } else {
        showCta = true;
        ctaAction = "open_shop";
        ctaLabel = "В мастерскую";
      }
    } else if (bit.id === "eyra_autoclicker") {
      if (screen === "mine") {
        showCta = true;
        ctaAction = "click_autoclicker_gift";
        ctaLabel = "Забрать 15 мин";
      } else {
        showCta = true;
        ctaAction = "open_mine";
        ctaLabel = "На поле";
      }
    } else if (showCta && ctaAction === "open_shop" && screen === "shop") {
      showCta = false;
    }
    if (showCta) {
      ctaBtn.hidden = false;
      ctaBtn.textContent = ctaLabel;
      ctaBtn.dataset.mentorAction = ctaAction;
    } else {
      ctaBtn.hidden = true;
      ctaBtn.dataset.mentorAction = "";
    }
  }

  dock.hidden = false;
  dock.removeAttribute("hidden");
  dock.style.display = "";
  dock.classList.add("is-open");
  dock.classList.toggle("is-soft", !!bit.soft);
  document.body.classList.add("mentor-active");
  document.body.classList.toggle("mentor-soft", !!bit.soft);

  // Уже в мастерской на шаге «открыть» — засчитываем вход
  if (bit.id === "eyra_workshop_open" && mentorActiveScreen() === "shop") {
    setTimeout(() => {
      if (typeof mentorEmit === "function") mentorEmit("screen_shop");
    }, 40);
  }

  if (bit.id === "eyra_autoclicker" && typeof renderAutoClickerHud === "function") {
    try { renderAutoClickerHud(); } catch (e) {}
  }

  applyMentorSpotlight(mentorHighlightForBit(bit), !!bit.soft);
  mentorPlaceDock(bit);

  if (bit.grant && typeof mentorApplyBitGrant === "function") {
    mentorApplyBitGrant(bit);
  }

  if (typeof syncGamePauseState === "function") syncGamePauseState();
}

function mentorApplyBitGrant(bit) {
  if (!bit || !bit.grant) return;
  if (bit.grant === "practice_kit") {
    if (typeof grantMentorPracticeKit === "function") grantMentorPracticeKit();
    return;
  }
  if (bit.grant === "ng_chest" || bit.grant === "ng_armor" || bit.grant === "ng_jewelry") {
    const step = bit.grant.replace(/^ng_/, "");
    const r =
      typeof grantMentorNgGearStep === "function"
        ? grantMentorNgGearStep(step)
        : { ok: false };
    if (r && r.ok && r.names && r.names.length && typeof toast === "function") {
      toast("Ючи: " + r.names.slice(0, 3).join(", ") + (r.names.length > 3 ? "…" : ""), "craft");
    }
    return;
  }
  if (bit.grant === "ensure_shot_crystals") {
    const add =
      typeof mentorEnsureShotCraftCrystals === "function"
        ? mentorEnsureShotCraftCrystals()
        : 0;
    if (add > 0 && typeof toast === "function") {
      toast("Ючи доложила кристаллы D ×" + add + " на крафт", "craft");
    }
  }
}

function mentorPreferredShotType() {
  if (typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar?.classId)) {
    return "spirit";
  }
  return "soul";
}

/** Открыть вкладку Заряды нужного типа (soul/spirit) для урока. */
function mentorEnsureWorkshopShotsView() {
  let changed = false;
  try {
    if (typeof wsMainTab !== "undefined" && wsMainTab !== "shots") {
      wsMainTab = "shots";
      changed = true;
    }
    const pref = mentorPreferredShotType();
    if (typeof wsTab !== "undefined" && wsTab !== pref) {
      wsTab = pref;
      changed = true;
    }
  } catch (e) {}
  if (changed && typeof renderWorkshop === "function") {
    try { renderWorkshop(); } catch (e) {}
  }
}

/** Подсветка с учётом экрана (меню vs крафт шотов). */
function mentorHighlightForBit(bit) {
  if (!bit) return null;
  const screen =
    typeof mentorActiveScreen === "function" ? mentorActiveScreen() : "";
  if (bit.id === "eyra_workshop_open") {
    if (screen === "shop") {
      mentorEnsureWorkshopShotsView();
      return typeof wsMainTab !== "undefined" && wsMainTab === "shots"
        ? "craft-shot"
        : "ws-shots-hub";
    }
    return "menu-workshop";
  }
  if (bit.id === "eyra_workshop_shots" || bit.highlight === "craft-shot") {
    if (screen !== "shop") return "menu-workshop";
    mentorEnsureWorkshopShotsView();
    return "craft-shot";
  }
  if (bit.id === "eyra_autoclicker" || bit.highlight === "autoclicker-gift") {
    return "autoclicker-gift";
  }
  return bit.highlight || null;
}

function mentorRefreshSpotlight() {
  if (!document.body.classList.contains("mentor-active")) return;
  const m = typeof ensureMentorProgress === "function" ? ensureMentorProgress() : state.mentor;
  const bit = typeof mentorBitById === "function" ? mentorBitById(m?.bitId) : null;
  if (!bit || bit.silent) return;
  applyMentorSpotlight(mentorHighlightForBit(bit), !!bit.soft);
  mentorPlaceDock(bit);
}

function mentorLeaveMineIfNeeded() {
  if (typeof mineActive !== "undefined" && mineActive && typeof stopMine === "function") {
    try { stopMine(); } catch (e) {}
  }
}

function mentorEnsureMenu() {
  mentorLeaveMineIfNeeded();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof show === "function") show("menu");
}

function mentorPickEnchantableItem() {
  try {
    const inv = state.inventory || [];
    // Сначала учебный клинок Эйры
    for (let i = 0; i < inv.length; i++) {
      const it = inv[i];
      if (!it || !it.mentorKit) continue;
      if (!it.grade && typeof WMAP !== "undefined") {
        const def = WMAP[it.id];
        if (def && def.grade && def.grade !== "NG") return it;
      }
      if (it.grade && it.grade !== "NG") return it;
      if (typeof weaponCanEnchant === "function" && weaponCanEnchant(it)) return it;
      const def = typeof WMAP !== "undefined" ? WMAP[it.id] : null;
      if (def && def.grade && def.grade !== "NG") return it;
    }
    const gear = state.avatar?.gear?.weapon;
    if (gear && gear.grade && gear.grade !== "NG") {
      if (typeof weaponCanEnchant !== "function" || weaponCanEnchant(gear)) return gear;
    }
    for (let i = 0; i < inv.length; i++) {
      const it = inv[i];
      if (!it || it.kind === "armor" || it.kind === "accessory") continue;
      const def = typeof WMAP !== "undefined" ? WMAP[it.id] : null;
      const grade = it.grade || def?.grade;
      if (!grade || grade === "NG") continue;
      if (typeof weaponCanEnchant === "function") {
        const probe = def ? { ...def, ...it } : it;
        if (!weaponCanEnchant(probe) && !weaponCanEnchant(def)) continue;
      }
      return it;
    }
  } catch (e) {}
  return null;
}

function mentorRunCta(action) {
  if (!action) return;
  if (typeof Audio2 !== "undefined") Audio2.click();

  if (action === "open_story") {
    mentorEnsureMenu();
    if (typeof setMenuFarmEntry === "function") setMenuFarmEntry("story");
    return;
  }
  if (action === "open_farm") {
    mentorEnsureMenu();
    if (typeof setMenuFarmEntry === "function") setMenuFarmEntry("farm");
    return;
  }
  if (action === "open_mine") {
    mentorLeaveMineIfNeeded();
    if (typeof setMenuFarmEntry === "function") {
      const hub = document.getElementById("screen-menu")?.dataset?.hubMode;
      if (hub !== "story") setMenuFarmEntry("story");
    }
    if (typeof openMine === "function") openMine();
    return;
  }
  if (action === "open_inv") {
    mentorLeaveMineIfNeeded();
    if (typeof openInventory === "function") openInventory();
    else if (typeof show === "function") show("inv");
    return;
  }
  if (action === "open_shop") {
    mentorLeaveMineIfNeeded();
    const pref =
      typeof mentorPreferredShotType === "function" ? mentorPreferredShotType() : "soul";
    try {
      if (typeof wsTab !== "undefined") wsTab = pref;
    } catch (e) {}
    if (typeof openWorkshop === "function") openWorkshop("shots");
    else if (typeof show === "function") show("shop");
    setTimeout(() => {
      if (typeof mentorRefreshSpotlight === "function") mentorRefreshSpotlight();
      else if (typeof renderMentorUI === "function") renderMentorUI();
    }, 60);
    return;
  }
  if (action === "click_craft_shot") {
    mentorEnsureWorkshopShotsView();
    const btn = document.querySelector('[data-mentor="craft-shot"]');
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    const ty =
      typeof mentorPreferredShotType === "function" ? mentorPreferredShotType() : "soul";
    if (typeof craftShot === "function") craftShot(ty, "D");
    return;
  }
  if (action === "click_autoclicker_gift") {
    if (mentorActiveScreen() !== "mine" && typeof openMine === "function") {
      openMine();
      setTimeout(() => {
        if (typeof claimMentorAutoClickerGift === "function") claimMentorAutoClickerGift();
      }, 80);
      return;
    }
    if (typeof claimMentorAutoClickerGift === "function") {
      claimMentorAutoClickerGift();
      return;
    }
    return;
  }
  if (action === "open_ench") {
    mentorLeaveMineIfNeeded();
    const item = mentorPickEnchantableItem();
    if (item && typeof openEnchant === "function") {
      openEnchant(item);
      if (typeof cur !== "undefined" && cur) {
        cur.scroll = "regular";
        if (typeof mentorEnsurePracticeScroll === "function") mentorEnsurePracticeScroll(cur);
      }
      if (typeof renderScrolls === "function") renderScrolls();
      if (typeof renderEnch === "function") renderEnch();
      return;
    }
    if (typeof openInventory === "function") openInventory();
    else if (typeof show === "function") show("inv");
    if (typeof toast === "function") toast("Выбери точимое оружие в инвентаре", "info");
    return;
  }
  if (action === "click_ench") {
    const btn = document.getElementById("enchBtn");
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    if (typeof doEnchant === "function") doEnchant();
    return;
  }
  if (action === "open_quests") {
    mentorLeaveMineIfNeeded();
    if (typeof openQuestJournal === "function") openQuestJournal();
    else if (typeof show === "function") show("quests");
    return;
  }
  if (action === "open_menu") {
    mentorEnsureMenu();
    return;
  }
  if (action === "open_avatar") {
    mentorLeaveMineIfNeeded();
    if (typeof openAvatar === "function") openAvatar();
    else if (typeof show === "function") show("avatar");
  }
}

function syncMentorSettingsUI() {
  const m = typeof ensureMentorProgress === "function" ? ensureMentorProgress() : state.mentor;
  const on = !!(m && !m.skipped);
  const enabledBtn = document.getElementById("settMentorEnabled");
  if (enabledBtn) {
    enabledBtn.textContent = on ? "Вкл" : "Выкл";
    enabledBtn.classList.toggle("on", on);
  }
}

function wireMentorUI() {
  const dock = mentorDockEl();
  if (!dock || dock.dataset.wired) return;
  dock.dataset.wired = "1";
  wireMentorPointerGate();

  const okBtn = document.getElementById("mentorOk");
  const dismissCheck = document.getElementById("mentorDismissCheck");
  const ctaBtn = document.getElementById("mentorCta");
  if (okBtn) {
    okBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      if (typeof mentorOnOk === "function") mentorOnOk();
    };
  }
  if (dismissCheck && !dismissCheck.dataset.wired) {
    dismissCheck.dataset.wired = "1";
    dismissCheck.addEventListener("change", () => {
      if (!dismissCheck.checked) return;
      if (typeof Audio2 !== "undefined") Audio2.click();
      if (typeof mentorSkip === "function") mentorSkip();
    });
  }
  if (ctaBtn) {
    ctaBtn.onclick = () => {
      const action = ctaBtn.dataset.mentorAction || "";
      mentorRunCta(action);
      // На информационных шагах CTA = «пойти и принять» (закрывает реплику)
      const m = typeof ensureMentorProgress === "function" ? ensureMentorProgress() : state.mentor;
      const bit = typeof mentorBitById === "function" ? mentorBitById(m?.bitId) : null;
      if (bit && bit.advanceOn === "ok" && typeof mentorOnOk === "function") {
        setTimeout(() => mentorOnOk(), 40);
      }
    };
  }

  const enabledBtn = document.getElementById("settMentorEnabled");
  if (enabledBtn && !enabledBtn.dataset.wired) {
    enabledBtn.dataset.wired = "1";
    enabledBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      const m = typeof ensureMentorProgress === "function" ? ensureMentorProgress() : state.mentor;
      const nextOn = !!(m && m.skipped);
      if (typeof mentorSetEnabled === "function") mentorSetEnabled(nextOn);
      else if (typeof mentorSkip === "function" && !nextOn) mentorSkip();
    };
  }

  const sett = document.getElementById("settMentor");
  if (sett && !sett.dataset.wired) {
    sett.dataset.wired = "1";
    sett.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      if (typeof mentorReplay === "function") mentorReplay();
      if (typeof syncMentorSettingsUI === "function") syncMentorSettingsUI();
      if (typeof show === "function") show("menu");
    };
  }
  syncMentorSettingsUI();
}
