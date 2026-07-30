// ===== Финал Prelude: core logic (награда, флаги, эпилог) =====
// Вынесено из 30-prelude-finale.js; UI модал остался в 30-prelude-finale.js.

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
    lead: "Пять глав позади — остров, руины, границы и Белая башня.",
    paragraphs: [
      "Ты прошёл путь, который Колин Виндавуд когда-то начинал с шторма над Говорящим островом. Мародёры отступили, руины затихли, орки и тьма отступили на шаг — не навсегда, но достаточно, чтобы народы снова заговорили друг с другом.",
      "У подножия Башни слоновой кости маги спорят о небулите, а король ждёт гонцов.",
      "Впереди — не покой, а эпоха Хаоса. Усиливай экипировку, вступай в кланы, создавай союзы и будь готов к тому, что перемирие, достигнутое доблестью твоих побед, не будет длиться вечно, а значит скоро снова придётся сражаться за спокойствие, золото и власть!"
    ],
  },
  elf: {
    title: "Prelude завершён",
    eyebrow: "Эльфы · Песнь Эльмора",
    lead: "Древо ещё дышит — и ты доказал, что лес не один.",
    paragraphs: [
      "От опушки до Башни слоновой кости — пять глав, пять полей, где каждый удар был вдохом для Древа Матери. Астериус не скажет громких слов, но лес помнит тех, кто не бросил ритуал на полпути.",
      "Аркениас у Белой башни всё ещё жаждет уничтожить небулит. Ты слышал споры магов и видел, как пять народов сходятся у кратера.",
      "Впереди — не покой, а эпоха Хаоса. Усиливай экипировку, вступай в кланы, создавай союзы и будь готов к новым вызовам! Мудрость эльфов подскажет тебе верный путь."
    ],
  },
  dark_elf: {
    title: "Prelude завершён",
    eyebrow: "Тёмные эльфы · Охота завершена",
    lead: "Пять глав крови и тени — Митреэль стал ближе, чем был.",
    paragraphs: [
      "Охота Шилен не кончилась — но её пролог ты выдержал. От Тёмного леса до башни, где шепчут о Митреэле, ты не дрогнул, когда светлые сородичи спасались бегством.",
      "Тайный совет видел твои трофеи. Золото и сталь легли в фундамент ритуалов, а враги рассыпались под твоим натиском на мириады частиц, не в силах противостоять хладнокровию и хитрости.",
      "Эпоха Хаоса не спросит, чья ты кровь, но проверит в деле, насколько остры твои клинки и крепки доспехи.",
      "Усиливай экипировку, вступай в кланы, создавай союзы. Шилен на твоей стороне, а значит врагов ждёт неминуемое поражение!"
    ],
  },
  orc: {
    title: "Prelude завершён",
    eyebrow: "Орки · Доблесть Паагрио",
    lead: "Плато и Башня слышали твой боевой клич.",
    paragraphs: [
      "Кекай не ошибся, послав тебя на поля испытания. Пять глав — пять побед над трусостью и слабостью. Гоблины, тени, чужие леса и Белая башня — везде ты оставил след крови.",
      "Шаманы кричат о вечной зиме, но ты доказал: Паагрио ещё пылает в тех, кто бьёт без колебаний. Племя будет говорить о твоих подвигах у огромных костров.",
      "Дальше — Хаос. Не для речей, а для стали.",
      "Усиливай экипировку, вступай в кланы и создавай союзы. Пусть враги трепещут от праведного гнева твоего народа!"
    ],
  },
  dwarf: {
    title: "Prelude завершён",
    eyebrow: "Гномы · Честный удар",
    lead: "Гильдии запомнят тех, кто вернулся с полным кошельком.",
    paragraphs: [
      "От мифриловой жилы Мамира до поставок у Башни слоновой кости — пять глав честного труда. Старейшины спорили, конкуренты ворчали, но монеты не лгут: твой удар принёс гильдии больше, чем их речи.",
      "Магам нужны реагенты, миру — небулит, гномам — порядок в шахтах. Ты сделал свою работу без пустых обещаний.",
      "Усиливай экипировку, вступай в кланы и создавай союзы. Мафр проверит силу каждого гнома в надвигающейся эпохе Хаоса. Кратковременное затишье - самое время начать подготовку!"
    ],
  },
};

function activePreludeZones() {
  return FARM_ZONES.filter((z) => z.active && !z.side);
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
  let adena = typeof playtestIncome === "function" ? playtestIncome(rw.adena || 0) : (rw.adena || 0);
  if (adena > 0) {
    ProgressStore.update("adena", (a) => (a || 0) + adena);
    ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + adena }));
  }
  if (rw.soul) ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), soul: (m?.soul || 0) + rw.soul }));
  if (rw.spirit) ProgressStore.update("materials", (m) => ({ ...(m || { soul: 0, spirit: 0 }), spirit: (m?.spirit || 0) + rw.spirit }));
  if (rw.crystals) {
    ProgressStore.update("crystals", (c) => {
      const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
      Object.keys(rw.crystals).forEach((g) => { next[g] = (next[g] || 0) + (rw.crystals[g] || 0); });
      return next;
    });
  }
  ensureStoryProgress();
  ProgressStore.update("storyProgress", (sp) => ({ ...(sp || {}), preludeFinaleSeen: true, chaosUnlocked: true }));
  save();
  if ($("#adena")) $("#adena").textContent = fmt(state.adena);
  if (typeof gameLog === "function") {
    gameLog("Prelude завершён — награда пролога и путь к эпохе Хаоса открыт", "success");
  }
}
