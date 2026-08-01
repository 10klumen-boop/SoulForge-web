// ===== Mentor core: очередь битов Эйры, gates, ProgressStore =====

function defaultMentorProgress() {
  return {
    skipped: false,
    /** Автопоказ только у новых персонажей (createAvatar / «Снова» / вкл. в настройках). */
    autoStart: false,
    bitId: null,
    lineIndex: 0,
    doneBits: {},
    doneLessons: {},
    chapterIntroSeen: {},
    started: false,
    kitGranted: false,
    autoClickerGranted: false,
    ngGearGranted: { chest: false, armor: false, jewelry: false },
  };
}

function ensureMentorProgress() {
  if (!state.mentor || typeof state.mentor !== "object") {
    if (typeof ProgressStore !== "undefined") {
      ProgressStore.set("mentor", defaultMentorProgress());
    } else {
      state.mentor = defaultMentorProgress();
    }
  } else {
    const m = state.mentor;
    if (!m.doneBits) m.doneBits = {};
    if (!m.doneLessons) m.doneLessons = {};
    if (!m.chapterIntroSeen) m.chapterIntroSeen = {};
    if (m.lineIndex == null) m.lineIndex = 0;
    if (!m.ngGearGranted || typeof m.ngGearGranted !== "object") {
      m.ngGearGranted = { chest: false, armor: false, jewelry: false };
    }
    // Старые сейвы без autoStart: не навязываем обучение ветеранам
    if (m.autoStart == null) {
      const engaged = !!(
        m.started ||
        m.bitId ||
        (m.doneBits && Object.keys(m.doneBits).length)
      );
      m.autoStart = engaged;
      if (!engaged) m.skipped = true;
      if (typeof ProgressStore !== "undefined") {
        ProgressStore.set("mentor", { ...m });
      }
    }
  }
  return state.mentor;
}

/** Можно ли автоматически открывать диалог Ючи. */
function mentorMayAutoShow() {
  const m = ensureMentorProgress();
  if (m.skipped) return false;
  return !!(m.autoStart || m.started || m.bitId);
}

function mentorPatch(updater) {
  ensureMentorProgress();
  if (typeof ProgressStore !== "undefined") {
    ProgressStore.update("mentor", (cur) => {
      const base = cur && typeof cur === "object" ? { ...cur } : defaultMentorProgress();
      if (!base.doneBits) base.doneBits = {};
      if (!base.doneLessons) base.doneLessons = {};
      if (!base.chapterIntroSeen) base.chapterIntroSeen = {};
      return updater(base) || base;
    });
  } else {
    state.mentor = updater({ ...state.mentor }) || state.mentor;
  }
}

function mentorHasEnchantableWeapon() {
  try {
    const gear = state.avatar?.gear?.weapon;
    if (gear) {
      const def = typeof WMAP !== "undefined" ? WMAP[gear.id] : null;
      const g = gear.grade || def?.grade;
      if (g && g !== "NG") {
        if (typeof weaponCanEnchant === "function") return !!weaponCanEnchant(def || gear);
        return true;
      }
    }
    const inv = state.inventory || [];
    for (let i = 0; i < inv.length; i++) {
      const it = inv[i];
      if (!it) continue;
      const def = typeof WMAP !== "undefined" ? WMAP[it.id] : null;
      const g = it.grade || def?.grade;
      if (!g || g === "NG") continue;
      if (typeof weaponCanEnchant === "function") {
        if (weaponCanEnchant(def || it)) return true;
      } else return true;
    }
  } catch (e) {}
  return false;
}

function mentorActiveScreen() {
  try {
    const active = typeof gameDoc === "function"
      ? gameDoc().querySelector(".screen.active")
      : document.querySelector(".screen.active");
    if (!active || !active.id) return "";
    return String(active.id).replace(/^screen-/, "");
  } catch (e) {
    return "";
  }
}

function mentorHubMode() {
  try {
    return document.getElementById("screen-menu")?.dataset?.hubMode || "entry";
  } catch (e) {
    return "entry";
  }
}

function mentorFlag(name) {
  if (name === "enchantable_owned") return mentorHasEnchantableWeapon();
  if (name === "hunting_graduated") return !!(state.storyProgress && state.storyProgress.huntingGraduated);
  if (name === "prelude_finale_seen") return !!(state.storyProgress && state.storyProgress.preludeFinaleSeen);
  // NG-экип только после интро главы III
  if (name === "ch3_intro") {
    return mentorBitDone("eyra_ch3") || !!(ensureMentorProgress().chapterIntroSeen || {}).orc_barracks;
  }
  if (name === "ng_chest_done") {
    return mentorBitDone("eyra_ng_chest") || !!(ensureMentorProgress().ngGearGranted || {}).chest;
  }
  if (name === "ng_armor_done") {
    return mentorBitDone("eyra_ng_armor") || !!(ensureMentorProgress().ngGearGranted || {}).armor;
  }
  return false;
}

function mentorGatesOk(bit) {
  const g = bit.gates || {};
  if (g.screen && mentorActiveScreen() !== g.screen) return false;
  if (g.hubMode && mentorHubMode() !== g.hubMode) return false;
  if (g.flag && !mentorFlag(g.flag)) return false;
  if (g.lessonDone) {
    const m = ensureMentorProgress();
    if (!m.doneLessons[g.lessonDone]) return false;
  }
  if (g.chapterIntro) {
    const m = ensureMentorProgress();
    if (!m.chapterIntroSeen[g.chapterIntro]) return false;
  }
  return true;
}

function mentorBitDone(id) {
  const m = ensureMentorProgress();
  return !!m.doneBits[id];
}

function mentorLessonDone(id) {
  if (!id) return false;
  const m = ensureMentorProgress();
  return !!m.doneLessons[id];
}

/** Ючи только в игровой сессии — не на логине / главном меню / выборе персонажа. */
function mentorSessionOk() {
  if (typeof isInCharacterSession === "function") return isInCharacterSession();
  try {
    if (!state?.avatar?.created) return false;
    const active =
      typeof gameDoc === "function"
        ? gameDoc().querySelector(".screen.active")
        : document.querySelector(".screen.active");
    const id = active?.id ? String(active.id).replace(/^screen-/, "") : "";
    return !!(id && !{ login: 1, home: 1, characters: 1, settings: 1, patch: 1, author: 1 }[id]);
  } catch (e) {
    return false;
  }
}

function mentorIsActive() {
  const m = ensureMentorProgress();
  if (m.skipped || !mentorMayAutoShow()) return false;
  if (!mentorSessionOk()) return false;
  if (!state.avatar?.created) return false;
  if (typeof needsIntro === "function" && needsIntro()) return false;
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return false;
  return !!m.bitId;
}

function mentorShouldStart() {
  const m = ensureMentorProgress();
  if (m.skipped) return false;
  if (!mentorMayAutoShow()) return false;
  if (m.started && m.bitId) return true;
  if (m.started && mentorBitDone("eyra_loop")) return false;
  if (!state.avatar?.created) return false;
  if (typeof needsIntro === "function" && needsIntro()) return false;
  return !m.started || !mentorBitDone("eyra_hello");
}

function mentorPickNextBit() {
  const m = ensureMentorProgress();
  if (m.skipped) return null;
  if (typeof MENTOR_BITS === "undefined") return null;

  for (let i = 0; i < MENTOR_BITS.length; i++) {
    const bit = MENTOR_BITS[i];
    if (mentorBitDone(bit.id)) continue;
    if (bit.lessonId && mentorLessonDone(bit.lessonId) && bit.type !== "chapter_gate") {
      // lesson already completed via another bit — skip duplicate lesson bits
      if (bit.id !== "eyra_loop" && bit.lessonId !== "chapter1_core") continue;
    }
    if (bit.type === "chapter_gate") {
      const zoneId = bit.zoneId;
      if (!zoneId) continue;
      if (m.chapterIntroSeen[zoneId]) continue;
      // show when player is on that zone or chapter unlocked / selected
      const cur = state.farmZone;
      const seen =
        typeof storyChapterSeen === "function" ? storyChapterSeen(zoneId) : false;
      const prevDone =
        zoneId === "elven_ruins"
          ? typeof isZoneChapterComplete === "function" && isZoneChapterComplete("banana_mine")
          : zoneId === "orc_barracks"
            ? typeof isZoneChapterComplete === "function" && isZoneChapterComplete("elven_ruins")
            : zoneId === "dark_cavern"
              ? typeof isZoneChapterComplete === "function" && isZoneChapterComplete("orc_barracks")
              : zoneId === "dwarven_depths"
                ? typeof isZoneChapterComplete === "function" && isZoneChapterComplete("dark_cavern")
                : false;
      if (!(cur === zoneId || prevDone || seen)) continue;
      if (!mentorGatesOk(bit) && bit.gates) {
        // chapter_gate usually no screen gate
      }
      return bit;
    }
    if (bit.soft) {
      if (!mentorGatesOk(bit)) continue;
      if (bit.lessonId && mentorLessonDone(bit.lessonId)) continue;
      return bit;
    }
    // Linear core: must complete previous non-soft, non-chapter, non-gated-optional in order
    // until chapter1_core done; after that gated lessons by gates only
    if (!mentorBitDone("eyra_loop")) {
      // strict order for chapter I
      if (!mentorGatesOk(bit)) {
        // wait bits with events can still be "current" if previous done
        const prev = i > 0 ? MENTOR_BITS[i - 1] : null;
        if (prev && !mentorBitDone(prev.id)) continue;
        if (bit.type === "wait" || bit.advanceOn?.startsWith("event:")) {
          // become current even if screen gate fails — UI may hide until gate ok
          if (prev && mentorBitDone(prev.id)) return bit;
        }
        continue;
      }
      const prev = findPreviousRequiredBit(i);
      if (prev && !mentorBitDone(prev.id)) continue;
      return bit;
    }
    // After chapter1 core: only gated lessons / chapter gates / soft
    if (bit.id === "eyra_hello" || bit.type === "wait") continue;
    if (!bit.lessonId && bit.type !== "chapter_gate") continue;
    if (bit.lessonId && mentorLessonDone(bit.lessonId)) continue;
    if (!mentorGatesOk(bit)) continue;
    return bit;
  }
  return null;
}

function findPreviousRequiredBit(index) {
  for (let j = index - 1; j >= 0; j--) {
    const b = MENTOR_BITS[j];
    if (b.soft || b.type === "chapter_gate") continue;
    if (b.lessonId && b.lessonId !== "chapter1_core" && b.id !== "eyra_loop") {
      // optional later lessons — not required for chapter I sequence
      if (mentorBitDone("eyra_loop")) continue;
      // before loop, skip enchant etc.
      if (b.gates?.flag) continue;
    }
    if (b.gates?.flag) continue;
    if (b.soft) continue;
    return b;
  }
  return null;
}

function mentorSetActiveBit(bit) {
  mentorPatch((m) => {
    m.started = true;
    m.bitId = bit ? bit.id : null;
    m.lineIndex = 0;
    // Миграция: старый сейв мог быть сразу на крафте без eyra_workshop_open
    if (bit && bit.id === "eyra_workshop_shots") {
      m.doneBits = { ...m.doneBits, eyra_workshop_open: true };
    }
    return m;
  });
  if (typeof renderMentorUI === "function") renderMentorUI();
}

function mentorMarkBitDone(bit) {
  if (!bit) return;
  mentorPatch((m) => {
    m.doneBits = { ...m.doneBits, [bit.id]: true };
    if (bit.id === "eyra_workshop_shots") {
      m.doneBits.eyra_workshop_open = true;
    }
    if (bit.lessonId) m.doneLessons = { ...m.doneLessons, [bit.lessonId]: true };
    if (bit.type === "chapter_gate" && bit.zoneId) {
      m.chapterIntroSeen = { ...m.chapterIntroSeen, [bit.zoneId]: true };
    }
    m.bitId = null;
    m.lineIndex = 0;
    return m;
  });
}

function mentorAdvanceLineOrBit() {
  const m = ensureMentorProgress();
  const bit = mentorBitById(m.bitId);
  if (!bit) {
    mentorResume();
    return;
  }
  const lines = bit.lines || [];
  if (m.lineIndex < lines.length - 1) {
    mentorPatch((x) => {
      x.lineIndex = (x.lineIndex || 0) + 1;
      return x;
    });
    if (typeof renderMentorUI === "function") renderMentorUI();
    return;
  }
  mentorCompleteCurrentBit();
}

function mentorCompleteCurrentBit() {
  const m = ensureMentorProgress();
  const bit = mentorBitById(m.bitId);
  if (bit) mentorMarkBitDone(bit);
  if (typeof hideMentorUI === "function") hideMentorUI();
  mentorScheduleResume(80);
}

let _mentorResumeTimer = null;

function mentorScheduleResume(ms) {
  if (_mentorResumeTimer) {
    clearTimeout(_mentorResumeTimer);
    _mentorResumeTimer = null;
  }
  _mentorResumeTimer = setTimeout(() => {
    _mentorResumeTimer = null;
    if (typeof mentorSessionOk === "function" && !mentorSessionOk()) {
      if (typeof hideMentorUI === "function") hideMentorUI();
      return;
    }
    mentorResume();
  }, ms == null ? 80 : ms);
}

function mentorResume() {
  ensureMentorProgress();
  const m = state.mentor;
  if (m.skipped || !mentorMayAutoShow()) {
    if (typeof hideMentorUI === "function") hideMentorUI();
    return;
  }
  if (!mentorSessionOk()) {
    if (typeof hideMentorUI === "function") hideMentorUI();
    return;
  }
  if (!state.avatar?.created) return;
  if (typeof needsIntro === "function" && needsIntro()) return;
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) {
    if (typeof hideMentorUI === "function") hideMentorUI();
    return;
  }

  let bit = null;
  if (m.bitId) {
    bit = mentorBitById(m.bitId);
    if (bit && mentorBitDone(bit.id)) bit = null;
  }
  if (!bit) bit = mentorPickNextBit();
  if (!bit) {
    mentorPatch((x) => {
      x.bitId = null;
      return x;
    });
    if (typeof hideMentorUI === "function") hideMentorUI();
    return;
  }

  if (bit.silent && bit.type === "wait") {
    mentorSetActiveBit(bit);
    if (typeof hideMentorUI === "function") hideMentorUI();
    // Already satisfied (replay / mid-progress)?
    if (bit.advanceOn === "event:quest_accepted") {
      const z = state.farmZone || "banana_mine";
      const def = typeof activeZoneQuest === "function" ? activeZoneQuest(z) : null;
      if (def && typeof questBriefingSeen === "function" && questBriefingSeen(def.id)) {
        setTimeout(() => mentorEmit("quest_accepted"), 40);
      }
    }
    return;
  }

  if (bit.gates && !mentorGatesOk(bit) && bit.type !== "wait") {
    mentorSetActiveBit(bit);
    // Есть CTA — показываем диалог, чтобы игрок мог перейти к нужному экрану
    if (bit.cta && bit.cta.action) {
      if (typeof renderMentorUI === "function") renderMentorUI();
      return;
    }
    if (typeof hideMentorUI === "function") hideMentorUI();
    return;
  }

  mentorSetActiveBit(bit);
}

function mentorStartAfterPrologue() {
  ensureMentorProgress();
  const m = state.mentor;
  if (m.skipped || !mentorMayAutoShow()) return;
  if (mentorBitDone("eyra_hello") && mentorBitDone("eyra_loop")) {
    mentorScheduleResume(40);
    return;
  }
  mentorPatch((x) => {
    x.started = true;
    x.autoStart = true;
    return x;
  });
  mentorScheduleResume(320);
}

function mentorSkip() {
  mentorPatch((m) => {
    m.skipped = true;
    m.bitId = null;
    m.lineIndex = 0;
    return m;
  });
  if (typeof hideMentorUI === "function") hideMentorUI();
  if (typeof syncMentorSettingsUI === "function") syncMentorSettingsUI();
  if (typeof toast === "function") {
    toast("Ючи: как скажешь. Вернуть — в настройках.", "info");
  }
}

/** Вкл/выкл обучение без полного повтора сценария. */
function mentorSetEnabled(on) {
  ensureMentorProgress();
  if (on) {
    mentorPatch((m) => {
      m.skipped = false;
      m.autoStart = true;
      return m;
    });
    if (typeof toast === "function") toast("Обучение Ючи снова включено", "info");
    mentorScheduleResume(200);
  } else {
    mentorSkip();
  }
  if (typeof syncMentorSettingsUI === "function") syncMentorSettingsUI();
}

function mentorReplay() {
  mentorPatch((m) => {
    m.skipped = false;
    m.autoStart = true;
    m.started = true;
    m.bitId = null;
    m.lineIndex = 0;
    // Keep doneBits/lessons — replay only reopens soft path via clearing hello? 
    // User asked replay: reset chapter I core bits so she talks again
    const keepLessons = { ...(m.doneLessons || {}) };
    delete keepLessons.chapter1_core;
    const keepBits = { ...(m.doneBits || {}) };
    [
      "eyra_hello", "eyra_hub_story", "eyra_open_zone", "eyra_wait_briefing",
      "eyra_after_quest", "eyra_farm_click", "eyra_quest_hud", "eyra_autoclicker", "eyra_inventory",
      "eyra_inv_ng", "eyra_kit", "eyra_enchant_open", "eyra_enchant_btn",
      "eyra_crystals_lesson", "eyra_workshop_open", "eyra_workshop_shots", "eyra_shots_done",
      "eyra_journal", "eyra_loop",
    ].forEach((id) => { delete keepBits[id]; });
    m.doneBits = keepBits;
    m.doneLessons = keepLessons;
    // Повтор урока — набор и подарочный автоудар не выдаём второй раз
    return m;
  });
  if (typeof syncMentorSettingsUI === "function") syncMentorSettingsUI();
  mentorResume();
}

/** Внешние события для advanceOn: event:* */
function mentorEmit(eventName) {
  ensureMentorProgress();
  const m = state.mentor;
  if (m.skipped || !mentorMayAutoShow()) return;
  if (!mentorSessionOk()) {
    if (typeof hideMentorUI === "function") hideMentorUI();
    return;
  }
  const bit = mentorBitById(m.bitId);
  if (bit && bit.advanceOn === "event:" + eventName) {
    mentorCompleteCurrentBit();
    return;
  }
  // Also try resume if waiting for gate that this event unlocks
  mentorScheduleResume(60);
}

function mentorOnOk() {
  const m = ensureMentorProgress();
  const bit = mentorBitById(m.bitId);
  if (!bit) return;
  if (bit.advanceOn === "ok" || bit.type === "say" || bit.type === "chapter_gate" || bit.soft) {
    mentorAdvanceLineOrBit();
  }
}

function isMentorBlockingPause() {
  try {
    if (!document.body.classList.contains("mentor-active")) return false;
    if (document.body.classList.contains("mentor-soft")) return false;
    const dock = document.getElementById("mentorDock");
    if (!dock || dock.hidden) return false;
    const m = state.mentor;
    const bit = typeof mentorBitById === "function" ? mentorBitById(m?.bitId) : null;
    // Поле / заточка / меню: игрок должен жать подсвеченную цель
    if (bit && bit.type === "point" && bit.highlight) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}
