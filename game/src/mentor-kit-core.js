// ===== Выдача учебного набора Эйры =====

function mentorKitAlreadyGranted() {
  ensureMentorProgress();
  return !!(state.mentor && state.mentor.kitGranted);
}

function mentorMarkKitGranted() {
  mentorPatch((m) => {
    m.kitGranted = true;
    return m;
  });
}

/**
 * Одноразовая выдача: D-клинок, свитки, adena, руда, кристаллы.
 * Возвращает краткий список для лога/диалога или null если уже выдано.
 */
function grantMentorPracticeKit(opts) {
  opts = opts || {};
  ensureMentorProgress();
  if (mentorKitAlreadyGranted() && !opts.force) return null;

  const kit =
    typeof MENTOR_PRACTICE_KIT !== "undefined"
      ? MENTOR_PRACTICE_KIT
      : {
          weaponPhysicalId: "doom_hammer_182",
          weaponMagicalId: "staff_of_magic_186",
          scrolls: { target: "weapon", typeId: "regular", grade: "D", qty: 4 },
          adena: 300_000,
          oreSoul: 40,
          oreSpirit: 40,
          crystalsD: 0,
          scriptBreakAtPlus: 3,
        };

  const weaponId =
    typeof mentorPracticeWeaponId === "function"
      ? mentorPracticeWeaponId()
      : kit.weaponPhysicalId;
  const wdef = typeof WMAP !== "undefined" ? WMAP[weaponId] : null;
  const parts = [];

  if (weaponId && typeof addToInventory === "function") {
    const it = addToInventory(weaponId, { plus: 0, source: "mentor_kit" });
    if (it) {
      // пометка в инвентаре
      ProgressStore.update("inventory", (inv) =>
        (inv || []).map((row) =>
          row && row.uid === it.uid ? { ...row, mentorKit: true } : row
        )
      );
      parts.push((wdef && wdef.name) || weaponId);
    }
  }

  const sc = kit.scrolls || {};
  if (typeof addScroll === "function" && sc.qty > 0) {
    addScroll(sc.target || "weapon", sc.typeId || "regular", sc.grade || "D", sc.qty);
    parts.push("свитки ×" + sc.qty);
  }

  const adenaAdd = Math.max(0, Math.floor(Number(kit.adena) || 0));
  if (adenaAdd > 0) {
    ProgressStore.update("adena", (a) => (a || 0) + adenaAdd);
    parts.push("+" + (typeof fmtAdena === "function" ? fmtAdena(adenaAdd) : adenaAdd) + " adena");
  }

  ProgressStore.update("materials", (m) => ({
    soul: (m?.soul || 0) + Math.max(0, kit.oreSoul || 0),
    spirit: (m?.spirit || 0) + Math.max(0, kit.oreSpirit || 0),
  }));
  if ((kit.oreSoul || 0) + (kit.oreSpirit || 0) > 0) parts.push("руда");

  const cry = Math.max(0, Math.floor(Number(kit.crystalsD) || 0));
  if (cry > 0) {
    ProgressStore.update("crystals", (c) => {
      const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
      next.D = (next.D || 0) + cry;
      return next;
    });
    parts.push("кристаллы D ×" + cry);
  }

  mentorMarkKitGranted();
  if (typeof save === "function") save();
  if ($("#adena")) {
    $("#adena").textContent = typeof fmt === "function" ? fmt(state.adena) : String(state.adena);
  }
  if (typeof renderMenu === "function") renderMenu();
  if (typeof renderInventory === "function" && mentorActiveScreen() === "inv") {
    try { renderInventory(); } catch (e) {}
  }
  if (typeof gameLog === "function") {
    gameLog("Ючи: учебный набор — " + parts.join(", "), "system");
  }
  return { weaponId, parts };
}

/** Надёжный запас D на крафт шотов после урока заточки. */
function mentorEnsureShotCraftCrystals() {
  const need = 6;
  const have = state.crystals?.D || 0;
  if (have >= need) return 0;
  const add = need - have;
  ProgressStore.update("crystals", (c) => {
    const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
    next.D = (next.D || 0) + add;
    return next;
  });
  return add;
}

/** Одноразовый бесплатный пакет 15 мин на уроке автоудара (по клику игрока). */
function mentorAutoClickerGiftAvailable() {
  if (typeof ensureMentorProgress === "function") ensureMentorProgress();
  const m = state.mentor;
  if (!m || m.skipped || m.autoClickerGranted) return false;
  return m.bitId === "eyra_autoclicker";
}

/** Забрать подарок по клику (кнопка пакета или CTA Ючи). */
function claimMentorAutoClickerGift() {
  if (!mentorAutoClickerGiftAvailable()) return false;
  const ms =
    (typeof AUTO_CLICKER !== "undefined" &&
      AUTO_CLICKER.packs &&
      AUTO_CLICKER.packs.find((p) => p.id === "short")?.durationMs) ||
    15 * 60 * 1000;
  const ok =
    typeof grantAutoClickerTime === "function"
      ? grantAutoClickerTime(ms, { label: "15 мин (подарок Ючи)", toast: true })
      : false;
  if (!ok) return false;
  mentorPatch((m) => {
    m.autoClickerGranted = true;
    return m;
  });
  if (typeof gameLog === "function") {
    gameLog("Ючи: автоудар +15 мин (учебный подарок)", "system");
  }
  if (typeof mentorEmit === "function") mentorEmit("auto_clicker_gift");
  if (typeof renderAutoClickerHud === "function") renderAutoClickerHud();
  if (typeof renderAutoClickerPanel === "function") renderAutoClickerPanel();
  return true;
}

/** @deprecated алиас — подарок только по клику */
function grantMentorAutoClicker(opts) {
  if (opts && opts.force) {
    ensureMentorProgress();
    mentorPatch((m) => {
      m.autoClickerGranted = false;
      return m;
    });
  }
  return claimMentorAutoClickerGift();
}

/**
 * Скрипт заточки учебного клинка: успех до scriptBreakAtPlus, затем всегда слом.
 * @returns {boolean|null} true/false — форс результат; null — обычный RNG
 */
function mentorScriptEnchantRoll(cur) {
  if (!cur || !cur.item || !cur.item.mentorKit) return null;
  if (typeof ensureMentorProgress === "function") ensureMentorProgress();
  if (state.mentor && state.mentor.skipped) return null;
  // Только пока ждём урок поломки (или ещё не завершили enchant)
  const bitId = state.mentor && state.mentor.bitId;
  const waitingBreak = bitId === "eyra_enchant_btn";
  const lessonOpen =
    typeof mentorLessonDone === "function" ? !mentorLessonDone("enchant") : true;
  if (!waitingBreak && !lessonOpen) return null;

  const kit =
    typeof MENTOR_PRACTICE_KIT !== "undefined" ? MENTOR_PRACTICE_KIT : null;
  const breakAt = Math.max(0, Math.floor(Number(kit?.scriptBreakAtPlus) || 3));
  const plus = Math.max(0, Math.floor(Number(cur.plus) || 0));
  if (plus < breakAt) return true;
  return false;
}

/** На уроке — только обычный свиток (break), иначе благ. сбросит до +0. */
function mentorEnsurePracticeScroll(cur) {
  if (!cur || !cur.item || !cur.item.mentorKit) return false;
  if (typeof ensureMentorProgress === "function") ensureMentorProgress();
  if (state.mentor && state.mentor.skipped) return false;
  const bitId = state.mentor && state.mentor.bitId;
  const waiting =
    bitId === "eyra_enchant_btn" || bitId === "eyra_enchant_open";
  const lessonOpen =
    typeof mentorLessonDone === "function" ? !mentorLessonDone("enchant") : false;
  if (!waiting && !lessonOpen) return false;
  if (cur.scroll === "regular") return false;
  cur.scroll = "regular";
  return true;
}

function mentorNgGearFlags() {
  ensureMentorProgress();
  const g = state.mentor.ngGearGranted;
  if (!g || typeof g !== "object") {
    return { chest: false, armor: false, jewelry: false };
  }
  return {
    chest: !!g.chest,
    armor: !!g.armor,
    jewelry: !!g.jewelry,
  };
}

function mentorMarkNgGear(step) {
  mentorPatch((m) => {
    const cur = m.ngGearGranted && typeof m.ngGearGranted === "object"
      ? { ...m.ngGearGranted }
      : { chest: false, armor: false, jewelry: false };
    cur[step] = true;
    m.ngGearGranted = cur;
    return m;
  });
}

function mentorGrantArmorId(armorId, autoEquip) {
  if (!armorId || typeof addArmorToInventory !== "function") return null;
  const it = addArmorToInventory(armorId, { source: "mentor_ng" });
  if (!it) return null;
  ProgressStore.update("inventory", (inv) =>
    (inv || []).map((row) =>
      row && row.uid === it.uid ? { ...row, mentorNg: true, starter: true } : row
    )
  );
  const live = (state.inventory || []).find((x) => x.uid === it.uid) || it;
  if (autoEquip && typeof equipArmorToAvatar === "function") {
    const slot = typeof armorSlotType === "function" ? armorSlotType(live) : null;
    const gear = typeof ensureAvatarGear === "function" ? ensureAvatarGear() : state.avatar?.gear;
    if (slot && gear && !gear[slot]) {
      try { equipArmorToAvatar(live); } catch (e) {}
    }
  }
  return live;
}

function mentorGrantJewelryId(jewelryId, qty, autoEquip) {
  qty = Math.max(1, qty | 0);
  const added = [];
  for (let i = 0; i < qty; i++) {
    if (typeof addCollectibleToInventory !== "function") break;
    const it = addCollectibleToInventory(jewelryId);
    if (!it) break;
    ProgressStore.update("inventory", (inv) =>
      (inv || []).map((row) =>
        row && row.uid === it.uid ? { ...row, mentorNg: true, starter: true } : row
      )
    );
    const live = (state.inventory || []).find((x) => x.uid === it.uid) || it;
    added.push(live);
    if (autoEquip && typeof equipAccessoryToAvatar === "function") {
      try { equipAccessoryToAvatar(live); } catch (e) {}
    }
  }
  return added;
}

/**
 * ����������� ������ NG-����: chest | armor | jewelry
 */
function grantMentorNgGearStep(step, opts) {
  opts = opts || {};
  ensureMentorProgress();
  const flags = mentorNgGearFlags();
  if (flags[step] && !opts.force) return { ok: false, step, reason: "already" };

  const names = [];
  if (step === "chest") {
    const kit = typeof mentorNgArmorKit === "function" ? mentorNgArmorKit() : null;
    if (!kit) return { ok: false, step };
    const it = mentorGrantArmorId(kit.chest, true);
    if (it) {
      const def = typeof AMAP !== "undefined" ? AMAP[kit.chest] : null;
      names.push((def && def.name) || kit.chest);
    }
    mentorMarkNgGear("chest");
  } else if (step === "armor") {
    const kit = typeof mentorNgArmorKit === "function" ? mentorNgArmorKit() : null;
    if (!kit) return { ok: false, step };
    if (!flags.chest) {
      const chest = mentorGrantArmorId(kit.chest, true);
      if (chest) {
        const def = typeof AMAP !== "undefined" ? AMAP[kit.chest] : null;
        names.push((def && def.name) || kit.chest);
      }
      mentorMarkNgGear("chest");
    }
    (kit.rest || []).forEach((id) => {
      const it = mentorGrantArmorId(id, true);
      if (it) {
        const def = typeof AMAP !== "undefined" ? AMAP[id] : null;
        names.push((def && def.name) || id);
      }
    });
    mentorMarkNgGear("armor");
  } else if (step === "jewelry") {
    const kit = typeof mentorNgJewelryKit === "function" ? mentorNgJewelryKit() : null;
    if (!kit) return { ok: false, step };
    mentorGrantJewelryId(kit.necklace, 1, true).forEach((it) => {
      const def = typeof accessoryDef === "function" ? accessoryDef(it) : null;
      names.push((def && def.name) || kit.necklace);
    });
    mentorGrantJewelryId(kit.earring, 2, true).forEach((it) => {
      const def = typeof accessoryDef === "function" ? accessoryDef(it) : null;
      names.push((def && def.name) || kit.earring);
    });
    mentorGrantJewelryId(kit.ring, 2, true).forEach((it) => {
      const def = typeof accessoryDef === "function" ? accessoryDef(it) : null;
      names.push((def && def.name) || kit.ring);
    });
    mentorMarkNgGear("jewelry");
  } else {
    return { ok: false, step, reason: "unknown" };
  }

  if (typeof save === "function") save();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof renderAvatarScreen === "function") renderAvatarScreen();
  if (typeof renderInventory === "function" && typeof mentorActiveScreen === "function" && mentorActiveScreen() === "inv") {
    try { renderInventory(); } catch (e) {}
  }
  if (typeof gameLog === "function" && names.length) {
    gameLog("���: ������� NG � " + names.join(", "), "system");
  }
  return { ok: true, step, names };
}
