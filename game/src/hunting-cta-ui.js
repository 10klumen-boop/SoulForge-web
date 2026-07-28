// ===== Hunting graduation CTA (Z0: SF 1–10 → hunting) =====

function huntingGraduationLevel() {
  return typeof HUNTING_GRADUATION_LEVEL === "number" ? HUNTING_GRADUATION_LEVEL : 10;
}

function huntingCtaZoneId() {
  return typeof HUNTING_CTA_ZONE_ID === "string" ? HUNTING_CTA_ZONE_ID : "wasteland";
}

function ensureHuntingCtaProgress() {
  if (typeof ensureStoryProgress === "function") ensureStoryProgress();
  ProgressStore.update("storyProgress", (sp) => {
    const next = { ...(sp || {}) };
    if (next.huntingCtaShown == null) next.huntingCtaShown = false;
    if (next.huntingGraduated == null) next.huntingGraduated = false;
    return next;
  });
}

function shouldOfferHuntingGraduation() {
  if (!state.avatar?.created) return false;
  ensureHuntingCtaProgress();
  const lvl = state.avatar.level || 1;
  if (lvl < huntingGraduationLevel()) return false;
  if (state.storyProgress?.huntingCtaShown) return false;
  return true;
}

function markHuntingCtaShown(graduated) {
  ensureHuntingCtaProgress();
  ProgressStore.update("storyProgress", (sp) => ({
    ...(sp || {}),
    huntingCtaShown: true,
    huntingGraduated: !!(graduated || sp?.huntingGraduated),
  }));
  if (typeof save === "function") save();
}

function goToHuntingFromCta() {
  markHuntingCtaShown(true);
  const zid = huntingCtaZoneId();
  if (typeof setMenuFarmEntry === "function") setMenuFarmEntry("farm");
  if (typeof selectFarmZone === "function") selectFarmZone(zid);
    if (typeof show === "function") show("menu");
    if (typeof toast === "function") {
    const z = typeof zoneRaceView === "function" ? zoneRaceView(zid) : { name: zid };
    toast("Охотничьи угодья: " + (z.name || zid), "success");
  }
}

function showHuntingGraduationModal() {
  if (typeof closeModal === "function") closeModal();
  const zid = huntingCtaZoneId();
  const z = typeof zoneRaceView === "function" ? zoneRaceView(zid) : { name: "Пустошь" };
  const lvl = huntingGraduationLevel();
  const html =
    '<div class="modal-card hunting-cta-modal">' +
    "<h3>Выпуск в охотничьи угодья</h3>" +
    "<p>Обучение до ур. <b>" +
    lvl +
    "</b> завершено. Дальше основная добыча — на <b>hunting</b>-полях Lineage&nbsp;2, не в главах Prelude.</p>" +
    "<p>Рекомендуем начать с <b>" +
    (z.name || zid) +
    "</b> (Gludio). Сюжетные главы после этого — по желанию (лор).</p>" +
    '<div class="modal-actions">' +
    '<button type="button" class="btn primary" id="huntingCtaGo">К охоте</button>' +
    '<button type="button" class="btn" id="huntingCtaLater">Позже</button>' +
    "</div></div>";
  if (typeof openModal === "function") openModal(html);
  else if (typeof toast === "function") {
    toast("Доступны охотничьи угодья — открой вкладку Фарм", "success");
    markHuntingCtaShown(false);
    return;
  }
  const go = document.getElementById("huntingCtaGo");
  const later = document.getElementById("huntingCtaLater");
  if (go) go.onclick = () => goToHuntingFromCta();
  if (later) {
    later.onclick = () => {
      markHuntingCtaShown(false);
      if (typeof closeModal === "function") closeModal();
    };
  }
}

function maybeShowHuntingGraduation() {
  if (!shouldOfferHuntingGraduation()) return false;
  showHuntingGraduationModal();
  return true;
}
