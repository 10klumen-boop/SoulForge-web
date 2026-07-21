// ===== Story zones: core helpers (race view, farmZoneById, story progress) =====
// Вынесено из 25-story-zones.js; UI панелей и рендер остались в 25-story-zones.js.
// Данные зон в data/story-zones-data.js.

// ===== Prelude: задание-кликер + полный сюжет каждой расы =====
// https://www.youtube.com/watch?v=tOHJ571xPiU

// ===== Prelude: логика зон и сюжета =====
// Данные зон (STORY_ARC, RACE_THREADS, RACE_HERO, STORY_BEATS, FARM_ZONES, ZONE_RACE_BONUS)
// вынесены в data/story-zones-data.js.


function currentAvatarRace() {
  const r = String(state.avatar?.raceId || "human").toLowerCase();
  if (r === "darkelf" || r === "dark-elf") return "dark_elf";
  const ok = ["human", "elf", "dark_elf", "orc", "dwarf"];
  return ok.includes(r) ? r : "human";
}

function normalizeAvatarRace() {
  if (!state.avatar || typeof state.avatar !== "object") ProgressStore.set("avatar", {});
  ProgressStore.update("avatar", (a) => ({ ...(a || {}), raceId: currentAvatarRace() }));
}

/** Зона с учётом расы: название, hint, сюжет, иконка. */
function zoneRaceView(zoneOrId, race) {
  const zone = typeof zoneOrId === "string" ? farmZoneById(zoneOrId) : zoneOrId;
  race = race || currentAvatarRace();
  const skin = zone.raceSkin?.[race] || zone.raceSkin?.human || {};
  const beat = STORY_BEATS[zone.id]?.[race] || {};
  const story = skin.story ? { ...skin.story, ...beat } : skin.story;
  return {
    ...zone,
    name: skin.name || zone.name,
    desc: skin.desc || zone.desc,
    storyTag: skin.storyTag || zone.storyTag,
    icon: skin.icon || zone.icon,
    story,
    mine: { ...zone.mine, ...(skin.mine || {}) },
  };
}

function defaultStoryProgress() {
  return { chaptersSeen: {}, unlocksShown: {} };
}

function ensureStoryProgress() {
  if (!state.storyProgress || typeof state.storyProgress !== "object") {
    ProgressStore.set("storyProgress", defaultStoryProgress());
  }
  ProgressStore.update("storyProgress", (sp) => {
    const next = { ...(sp || defaultStoryProgress()) };
    if (!next.chaptersSeen) next.chaptersSeen = {};
    if (!next.unlocksShown) next.unlocksShown = {};
    if (next.chaosUnlocked == null) next.chaosUnlocked = false;
    if (state.avatar?.prologueSeen) {
      next.chaptersSeen.banana_mine = true;
      next.unlocksShown.banana_mine = true;
    }
    return next;
  });
}

function farmZoneById(id) {
  return FARM_ZONES.find((z) => z.id === id) || FARM_ZONES[0];
}

function zoneMineConfig(zoneId) {
  const mine = zoneRaceView(zoneId).mine || FARM_ZONES[0].mine;
  return typeof mergeMineVisualConfig === "function" ? mergeMineVisualConfig(zoneId, mine) : mine;
}

function raceThreadForAvatar() {
  return RACE_THREADS[currentAvatarRace()] || RACE_THREADS.human;
}

function curRaceIcon() {
  const zoneId = state?.farmZone || "banana_mine";
  if (typeof uiZoneChipIcon === "function") return uiZoneChipIcon(zoneId);
  return zoneRaceView("banana_mine").icon;
}

function storyChapterSeen(zoneId) {
  ensureStoryProgress();
  return !!state.storyProgress.chaptersSeen[zoneId];
}

function markStoryChapterSeen(zoneId) {
  ensureStoryProgress();
  if (state.storyProgress.chaptersSeen[zoneId]) return;
  state.storyProgress.chaptersSeen[zoneId] = true;
  save();
}

function storyChaptersDoneCount() {
  ensureStoryProgress();
  return FARM_ZONES.filter((z) => z.active && state.storyProgress.chaptersSeen[z.id]).length;
}

function storyChaptersActiveCount() {
  return FARM_ZONES.filter((z) => z.active).length;
}

function zoneStoryBodyHtml(view, opts) {
  opts = opts || {};
  const s = view.story;
  if (!s) return "";
  const parts = [];
  if (opts.epigraph && view.chapter === 1) {
    parts.push('<p class="story-epigraph">' + PRELUDE_EPIGRAPH + "</p>");
  }
  if (s.paragraphs) parts.push(s.paragraphs.map((p) => "<p>" + p + "</p>").join(""));
  const mech = s.mechanic || (s.targets
    ? "На поле мелькают <b>" + s.targets + "</b> — настигни их прежде, чем скроются во тьму. Поймал — adena и оружие."
    : "");
  if (mech) {
    parts.push('<div class="story-mechanic"><span class="story-mechanic-k">Поле задания</span><p>' + mech + "</p></div>");
  }
  return parts.join("");
}
