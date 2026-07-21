// ===== Пролог: core logic (флаги) =====
// RACE_PROLOGUE и DEFAULT_PROLOGUE вынесены в data/prologue-data.js.
// UI story-backdrop и панель остались в 21-intro.js.


function prologueForAvatar() {
  const race = state.avatar?.raceId;
  return (race && RACE_PROLOGUE[race]) || DEFAULT_PROLOGUE;
}

function prologueBodyHtml(p) {
  const parts = [];
  if (typeof PRELUDE_EPIGRAPH === "string") {
    parts.push('<p class="story-epigraph">' + PRELUDE_EPIGRAPH + "</p>");
  }
  parts.push(p.paragraphs.map((para) => "<p>" + para + "</p>").join(""));
  const mech = p.mechanic || (p.targets
    ? "На поле мелькают <b>" + p.targets + "</b> — настигни их прежде, чем растворятся во мгле."
    : "");
  if (mech) {
    parts.push('<div class="story-mechanic"><span class="story-mechanic-k">Поле задания</span><p>' + mech + "</p></div>");
  }
  return parts.join("");
}

function needsIntro() {
  migrateAvatar();
  if (!state.avatar?.created) {
    if (state.storySeen) return false;
    const t = state.totals || {};
    if ((t.tries || 0) > 0 || (t.fails || 0) > 0) return false;
    if (inventoryCount() > 0) return false;
    if ((state.adena || 0) > START_ADENA + 500) return false;
    return true;
  }
  return !state.avatar.prologueSeen;
}

function markStorySeen() {
  if (state.avatar?.created) {
    if (state.avatar.prologueSeen) return;
    ProgressStore.update("avatar", (a) => ({ ...(a || {}), prologueSeen: true }));
  } else if (state.storySeen) {
    return;
  } else {
    ProgressStore.set("storySeen", true);
  }
  save();
}

function ensureStoryFlag() {
  if (!needsIntro() && state.avatar?.created && !state.avatar.prologueSeen) markStorySeen();
  if (!needsIntro() && !state.avatar?.created && !state.storySeen) markStorySeen();
}
