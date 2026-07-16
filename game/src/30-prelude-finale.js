// ===== Финал Prelude: эпилог расы, награда, переход к эпохе Хаоса =====

const PRELUDE_FINALE_REWARD = {
  adena: 100_000,
  soul: 40,
  spirit: 25,
  crystals: { D: 2, C: 1 },
};

/** Эпилог после прохождения всех 5 глав (квесты + боссы). */
const PRELUDE_FINALE_EPILOGUE = {
  human: {
    title: "Prelude завершён",
    eyebrow: "Люди · Хроника доверия",
    lead: "Пять глав позади — остров, руины, границы и белая башня.",
    paragraphs: [
      "Ты прошёл путь, который <b>Колин Виндавуд</b> когда-то начинал с шторма над <b>Говорящим островом</b>. Мародёры отступили, руины затихли, орки и тьма отступили на шаг — не навсегда, но достаточно, чтобы народы снова заговорили друг с другом.",
      "У подножия <b>Башни слоновой кости</b> маги спорят о <b>небулите</b>, а король ждёт гонцов. Твоя часть хроники закончена: поле, adena, сталь и заточка сделали своё дело.",
      "Впереди — не покой, а <b>эпоха Хаоса</b>. Веди клинок к <b>+16</b>, крепи союзы и будь готов: перемирие, что держится на твоих победах, трещит по швам.",
    ],
  },
  elf: {
    title: "Prelude завершён",
    eyebrow: "Эльфы · Песнь Эльмора",
    lead: "Древо ещё дышит — и ты доказал, что лес не один.",
    paragraphs: [
      "От опушки до <b>Башни слоновой кости</b> — пять глав, пять полей, где каждый удар был вдохом для <b>Древа Матери</b>. <b>Астериус</b> не скажет громких слов, но лес помнит тех, кто не бросил ритуал на полпути.",
      "<b>Аркениас</b> у белой башни всё ещё жажет уничтожить <b>небулит</b>. Ты слышал споры магов и видел, как пять народов сходятся у кратера — с надеждой и со страхом.",
      "Prelude для тебя завершён. Дальше — заточка, сила и выбор, который определит, переживёт ли Эльмор грядущий <b>Хаос</b>.",
    ],
  },
  dark_elf: {
    title: "Prelude завершён",
    eyebrow: "Тёмные эльфы · Охота завершена",
    lead: "Пять глав крови и тени — Митреэль ближе, чем был.",
    paragraphs: [
      "Охота <b>Шилен</b> не кончилась — но её пролог ты выдержал. От <b>Тёмного леса</b> до башни, где шепчут о <b>Митреэле</b>, ты не дрогнул, когда светлые сородичи отворачивались.",
      "Тайный совет видел твои трофеи. Adena и сталь легли в фундамент ритуалов, а враги рассыпались под клинком точнее, чем любая молитва светлых.",
      "Эпоха <b>Хаоса</b> не спросит, чья ты кровь. Спросит, насколько остры твой клинок у порога <b>+16</b>.",
    ],
  },
  orc: {
    title: "Prelude завершён",
    eyebrow: "Орки · Доблесть Паагрио",
    lead: "Плато слышало твой боевой клич — и башня тоже.",
    paragraphs: [
      "<b>Кекай</b> не ошибся, послав тебя на поля испытания. Пять глав — пять побед над трусостью и слабостью. Гоблины, тени, чужие леса и белая башня — везде ты оставил след крови и adena.",
      "Шаманы кричат о вечной зиме, но ты доказал: <b>Паагрио</b> ещё пылает в тех, кто бьёт без колебаний. Племя будет говорить о твоём прологе у костров.",
      "Дальше — <b>Хаос</b>. Не для речей, а для стали. Затачивай оружие и не опозорь знамя у кратера.",
    ],
  },
  dwarf: {
    title: "Prelude завершён",
    eyebrow: "Гномы · Честный удар",
    lead: "Гильдии запомнят, кто вернулся с полным кошелём.",
    paragraphs: [
      "От жилы у <b>Мамира</b> до поставок у <b>Башни слоновой кости</b> — пять глав честного труда. Старейшины спорили, конкуренты ворчали, но монеты не лгут: твой удар принёс гильдии больше, чем их речи.",
      "Магам нужны реагенты, миру — небулит, гномам — порядок в шахтах. Ты сделал свою часть пролога без пустых обещаний.",
      "Теперь — заточка, кристаллы и дорога к <b>+16</b>. <b>Мафр</b> проверяет сильных не в прологе, а в <b>эпохе Хаоса</b>.",
    ],
  },
};

function activePreludeZones() {
  return FARM_ZONES.filter((z) => z.active);
}

function preludeChaptersCompleteCount() {
  if (typeof isZoneChapterComplete !== "function") return 0;
  return activePreludeZones().filter((z) => isZoneChapterComplete(z.id)).length;
}

function isPreludeComplete() {
  const zones = activePreludeZones();
  if (!zones.length || typeof isZoneChapterComplete !== "function") return false;
  return zones.every((z) => isZoneChapterComplete(z.id));
}

function preludeFinaleSeen() {
  ensureStoryProgress();
  return !!state.storyProgress.preludeFinaleSeen;
}

function preludeFinaleEpilogue() {
  const race = state.avatar?.raceId || "human";
  return PRELUDE_FINALE_EPILOGUE[race] || PRELUDE_FINALE_EPILOGUE.human;
}

function preludeFinaleBodyHtml(ep) {
  const parts = [];
  parts.push("<p><em>" + ep.lead + "</em></p>");
  ep.paragraphs.forEach((p) => parts.push("<p>" + p + "</p>"));
  const rw = PRELUDE_FINALE_REWARD;
  parts.push('<div class="chapter-reward-loot prelude-finale-loot">');
  parts.push("<p><b>Награда пролога:</b></p><ul>");
  if (rw.adena) parts.push("<li>+" + fmtAdena(typeof playtestIncome === "function" ? playtestIncome(rw.adena) : rw.adena) + " adena</li>");
  if (rw.soul) parts.push("<li>Soul Ore ×" + fmt(rw.soul) + "</li>");
  if (rw.spirit) parts.push("<li>Spirit Ore ×" + fmt(rw.spirit) + "</li>");
  if (rw.crystals) {
    Object.keys(rw.crystals).forEach((g) => {
      if (rw.crystals[g]) parts.push("<li>Кристалл " + g + " ×" + rw.crystals[g] + "</li>");
    });
  }
  parts.push("</ul>");
  parts.push('<p class="prelude-chaos-tease"><i>' + STORY_ARC.finaleTease + "</i></p>");
  parts.push("</div>");
  return parts.join("");
}

function applyPreludeFinaleReward() {
  const rw = PRELUDE_FINALE_REWARD;
  ensureWorkshopState();
  if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
  if (!state.materials) state.materials = { soul: 0, spirit: 0 };
  let adena = typeof playtestIncome === "function" ? playtestIncome(rw.adena || 0) : (rw.adena || 0);
  if (adena > 0) {
    state.adena += adena;
    state.totals.earned = (state.totals.earned || 0) + adena;
  }
  if (rw.soul) state.materials.soul = (state.materials.soul || 0) + rw.soul;
  if (rw.spirit) state.materials.spirit = (state.materials.spirit || 0) + rw.spirit;
  if (rw.crystals) {
    Object.keys(rw.crystals).forEach((g) => {
      state.crystals[g] = (state.crystals[g] || 0) + (rw.crystals[g] || 0);
    });
  }
  ensureStoryProgress();
  state.storyProgress.preludeFinaleSeen = true;
  state.storyProgress.chaosUnlocked = true;
  save();
  if ($("#adena")) $("#adena").textContent = fmt(state.adena);
  if (typeof gameLog === "function") {
    gameLog("Prelude завершён — награда пролога и путь к эпохе Хаоса открыт", "success");
  }
}

function showPreludeFinaleModal() {
  if (preludeFinaleSeen() || !isPreludeComplete()) return;
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) {
    applyPreludeFinaleReward();
    return;
  }
  const ep = preludeFinaleEpilogue();
  const view = typeof zoneRaceView === "function" ? zoneRaceView("dwarven_depths") : { icon: "" };
  if (typeof renderStoryPanel === "function") {
    renderStoryPanel({
      title: ep.title,
      eyebrow: ep.eyebrow,
      lead: ep.lead,
      chapter: "Prelude · Финал",
      icon: typeof uiZoneChipIcon === "function" ? uiZoneChipIcon("dwarven_depths", state.avatar?.raceId) : view.icon,
      bodyHtml: preludeFinaleBodyHtml(ep),
      cta: "Принять судьбу",
    });
  }
  backdrop.dataset.storyMode = "prelude_finale";
  backdrop.className =
    "story-backdrop race-" + (state.avatar?.raceId || "human") +
    " story-zone-dwarven_depths story-prelude-finale";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function dismissPreludeFinale() {
  if (!preludeFinaleSeen()) applyPreludeFinaleReward();
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    backdrop.hidden = true;
  }
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof toast === "function") toast("Prelude завершён — эпоха Хаоса ждёт", "success");
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  if (typeof renderQuestJournal === "function") renderQuestJournal();
  if (typeof renderMenu === "function") renderMenu();
  if (typeof checkAchievements === "function") checkAchievements();
}

function tryTriggerPreludeFinale() {
  if (!state.avatar?.created || preludeFinaleSeen() || !isPreludeComplete()) return;
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop && !backdrop.hidden) return;
  setTimeout(() => {
    if (!preludeFinaleSeen() && isPreludeComplete()) showPreludeFinaleModal();
  }, 600);
}

function migratePreludeFinale() {
  /* UI финала Prelude — только при входе в игру (runGameEntryModals). */
}
