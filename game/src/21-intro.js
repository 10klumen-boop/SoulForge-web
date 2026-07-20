// ===== Пролог: своё стартовое задание у каждой расы =====
// https://www.youtube.com/watch?v=tOHJ571xPiU

const RACE_PROLOGUE = {
  human: {
    title: "Говорящий остров",
    eyebrow: "Люди · Деревня Говорящего острова",
    cta: "На тропу",
    lead: "Шторм разбил берег — и остров ещё не готов принять беженцев.",
    questRef: "«Помощь стражам» → «Шаг в будущее»",
    targets: "мародёры с награбленным",
    mechanic: "На северной тропе мелькают мешки стервятников — настигни их прежде, чем растворятся в тумане.",
    paragraphs: [
      "Слушай, странник. Три ночи назад море вздыбилось чёрной стеной над <b>Говорящим островом</b>: корабли легли на дно, храм Эйнхасад лишился крыши, а старый <b>Колин Виндавуд</b> ходит по пепелищу и молит богов дать сил принять беженцев с большой земли.",
      "Твоё первое бремя — поле у северной тропы, где рыщут <b>мародёры</b>, обирая и живых, и мёртвых. Это пролог линии людей в Prelude: зачистка, доверие рас, путь к «<b>Шагу в будущее</b>». Закон прост, как удар молота: <b>задание → adena → заточка</b>.",
      "А иной раз во мгле полыхнёт золото — особо жирная добыча. Знак, что остров ещё не выдал всех своих тайн.",
    ],
  },
  elf: {
    title: "Эльфийский лес",
    eyebrow: "Эльфы · Деревня эльфов",
    cta: "К опушке",
    lead: "Древо Матери увядает — и лес не может ждать, пока ты соберёшься с духом.",
    questRef: "«Плоды, идущие от древа» → ритуал с единорогом",
    targets: "гоблины-лесорубы",
    mechanic: "У корней мелькают лесорубы — хватай, пока топор не упал в священную кору.",
    paragraphs: [
      "<b>Древо Матери</b> роняет пожелтевшую листву — и с каждым листом слабеет весь народ. С <b>Моря спор</b> тянет гнилостным ветром, а у опушки <b>гоблины</b> без страха рубят священную кору. <b>Астериус</b> ищет спасение и отпускает тебя на поле.",
      "Это <b>твой</b> Эльмор — не остров людей и не плато орков. Adena с поля пойдёт на свитки и дары для ритуала с <b>единорогом</b>, последней надеждой Древа. Промах здесь — позор перед суровой <b>Нерупой</b>.",
      "Впереди — руины, граница, белая башня. Но сначала — опушка, быстрые пальцы и сталь, что не подведёт.",
    ],
  },
  dark_elf: {
    title: "Тёмный лес",
    eyebrow: "Тёмные эльфы · Деревня тёмных эльфов",
    cta: "В чащу",
    lead: "Десять ночей до тёмной мессы. Охота Шилен уже идёт.",
    questRef: "«Охота Шилен» · поиск «Апокалипсиса Кайши»",
    targets: "тени чащи",
    mechanic: "В тишине Тёмного леса цели мелькают на миг — промах громче любого крика.",
    paragraphs: [
      "Ты постигаешь запретное в <b>Школе тёмных искусств</b>, где даже свечи горят неохотно. До <b>тёмной мессы</b> осталось десять ночей <b>Охоты Шилен</b> — и игра начинается в этот самый срок.",
      "Ты ищешь <b>Апокалипсис Кайши</b> и готовишься к распечатке <b>Митреэля</b>. Adena с поля — на клинок и ритуалы, не на прощение светлых сородичей.",
      "Светлые нежатся под серебряным пологом. Орки ревут на стынущем плато. Ты — в <b>Тёмном лесу</b>, и <b>Шилен</b> благоволит лишь точному клинку.",
    ],
  },
  orc: {
    title: "Плато бессмертных",
    eyebrow: "Орки · Деревня орков",
    cta: "На плато",
    lead: "Плато ждёт доблести — а вечная зима ближе, чем кажется с огненного костра.",
    questRef: "«Да здравствует Повелитель Паагрио!» → «Доказательство доблести»",
    targets: "гоблины и твари Варанки",
    mechanic: "Испытание Кекая: бей быстро, не думай. Трофей — adena, заточка — закалка.",
    paragraphs: [
      "<b>Кекай</b> сзывает племена под знамёна <b>Паагрио</b>, ибо грядёт не метель, а <b>эпоха Хаоса</b> — то, что шаманы у костров называют вечной зимой. На плато снуют <b>гоблины</b> и твари, которых гонит изгнанник <b>Варанка</b>.",
      "Центурион отправил тебя на поле испытания. Быстрый удар — трофей и adena. Медленный — стыд перед ликом <b>Паагрио</b>. Люди и эльфы далеко — твой мир огонь и сталь.",
      "Это твой первый рёв «<b>Да здравствует Повелитель Паагрио!</b>» и начало «<b>Доказательства доблести</b>».",
    ],
  },
  dwarf: {
    title: "Деревня гномов",
    eyebrow: "Гномы · Подножие Мамира",
    cta: "К жиле",
    lead: "Гильдии грызутся за жилу у Мамира — честный удар решает спор.",
    questRef: "Сбор осколков «таблички Мафр»",
    targets: "расхитители и конкуренты",
    mechanic: "Жила оживает вспышками — перехвати мешок раньше соперника.",
    paragraphs: [
      "У подножия великого <b>Мамира</b> гильдии грызутся, как псы, за осколки <b>таблички Мафр</b>, а седобородые старейшины никак не поделят власть. Твоё поле — окраина рудной жилы, где мелькают <b>расхитители</b> и соперники с полными мешками.",
      "Перехвати их — и adena ляжет в казну гильдии. Сломаешь клинок — снова на поле. Так гном проходит Prelude: честный удар, проворные пальцы, заточка на наковальне.",
      "Чужие народы торгуются где-то за горизонтом. <b>Мафр</b> проверяет новичков не словом — трудом, у подножия горы.",
    ],
  },
};

const DEFAULT_PROLOGUE = RACE_PROLOGUE.human;

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
    state.avatar.prologueSeen = true;
  } else if (state.storySeen) {
    return;
  } else {
    state.storySeen = true;
  }
  save();
}

function ensureStoryFlag() {
  if (!needsIntro() && state.avatar?.created && !state.avatar.prologueSeen) markStorySeen();
  if (!needsIntro() && !state.avatar?.created && !state.storySeen) markStorySeen();
}

function isStoryBackdropOpen() {
  const backdrop = document.getElementById("storyBackdrop");
  return !!(backdrop && !backdrop.hidden);
}

const STORY_OK_ARM_MS = 650;
let storyOkArmTimer = null;

function isStoryOkLocked() {
  const btn = document.getElementById("storyOk");
  return !!(btn && btn.classList.contains("story-ok--locked"));
}

function armStoryOkButton(ms) {
  const btn = document.getElementById("storyOk");
  if (!btn) return;
  if (storyOkArmTimer) {
    clearTimeout(storyOkArmTimer);
    storyOkArmTimer = null;
  }
  btn.classList.add("story-ok--locked");
  btn.setAttribute("aria-disabled", "true");
  storyOkArmTimer = setTimeout(() => {
    storyOkArmTimer = null;
    btn.classList.remove("story-ok--locked");
    btn.removeAttribute("aria-disabled");
  }, ms == null ? STORY_OK_ARM_MS : ms);
}

function setIntroOpen(open) {
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) return;
  backdrop.hidden = !open;
  const race = state.avatar?.raceId || "human";
  backdrop.className = "story-backdrop race-" + race + (open ? "" : "");
  if (open) {
    if (typeof setGamePaused === "function") setGamePaused(true);
    if (typeof armStoryOkButton === "function") armStoryOkButton();
  } else if (typeof syncGamePauseState === "function") {
    syncGamePauseState();
  } else if (typeof setGamePaused === "function") {
    setGamePaused(false);
  }
}

function renderStoryBody(opts) {
  opts = opts || {};
  const p = prologueForAvatar();
  const race = state.avatar?.raceId || "human";
  const icon = typeof uiZoneChipIcon === "function" ? uiZoneChipIcon("banana_mine", race) : (typeof zoneRaceView === "function" ? zoneRaceView("banana_mine", race).icon : null);
  if (typeof renderStoryPanel === "function") {
    renderStoryPanel({
      title: p.title,
      eyebrow: p.eyebrow,
      lead: p.lead,
      questRef: p.questRef,
      chapter: "Пролог · Глава I",
      icon,
      bodyHtml: prologueBodyHtml(p),
      cta: opts.firstRun ? p.cta : "Закрыть",
    });
    return;
  }
  const body = document.getElementById("storyBody");
  const title = document.getElementById("storyTitle");
  const eyebrow = document.getElementById("storyEyebrow");
  if (title) title.textContent = p.title;
  if (eyebrow) eyebrow.textContent = p.eyebrow;
  if (body) body.innerHTML = p.paragraphs.map((para) => "<p>" + para + "</p>").join("");
}

function dismissIntro(fromFirstRun) {
  const backdrop = document.getElementById("storyBackdrop");
  const mode = backdrop?.dataset.storyMode;
  if (mode === "zone") {
    if (typeof dismissZoneChapter === "function") dismissZoneChapter(!!backdrop.dataset.firstUnlock);
    return;
  }
  if (mode === "quest") {
    if (typeof dismissQuestBriefing === "function") dismissQuestBriefing();
    return;
  }
  if (mode === "chapter_reward") {
    if (typeof dismissChapterReward === "function") dismissChapterReward();
    return;
  }
  if (mode === "prelude_finale") {
    if (typeof dismissPreludeFinale === "function") dismissPreludeFinale();
    return;
  }
  if (mode === "arc") {
    if (backdrop) {
      delete backdrop.dataset.storyMode;
      backdrop.hidden = true;
    }
    if (typeof syncGamePauseState === "function") syncGamePauseState();
    else if (typeof setGamePaused === "function") setGamePaused(false);
    if (typeof Audio2 !== "undefined") Audio2.click();
    return;
  }
  setIntroOpen(false);
  markStorySeen();
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (fromFirstRun && typeof gameLog === "function") {
    const p = prologueForAvatar();
    gameLog("Пролог: «" + p.title + "» · " + (p.questRef || ""), "system");
  }
  if (typeof markStoryChapterSeen === "function") markStoryChapterSeen("banana_mine");
  if (typeof flushPendingZoneStory === "function") flushPendingZoneStory();
  if (backdrop) delete backdrop.dataset.firstRun;
  if (fromFirstRun && typeof maybeShowQuestBriefing === "function") {
    maybeShowQuestBriefing("banana_mine", { delay: 520 });
  } else if (typeof flushPendingQuestBriefing === "function") {
    flushPendingQuestBriefing();
  }
}

function showIntro(opts) {
  opts = opts || {};
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    delete backdrop.dataset.zoneId;
    delete backdrop.dataset.firstUnlock;
  }
  renderStoryBody({ firstRun: opts.firstRun });
  setIntroOpen(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function wireIntro() {
  const backdrop = document.getElementById("storyBackdrop");
  const btn = document.getElementById("storyOk");
  if (!backdrop || backdrop.dataset.wired) return;
  backdrop.dataset.wired = "1";

  btn.onclick = () => {
    if (isStoryOkLocked()) return;
    dismissIntro(!!backdrop.dataset.firstRun);
  };
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      if (isStoryOkLocked()) return;
      dismissIntro(!!backdrop.dataset.firstRun);
    }
  });

  const sett = document.getElementById("settStory");
  if (sett) {
    sett.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      delete backdrop.dataset.firstRun;
      showIntro({ firstRun: false });
    };
  }
}

function maybeShowIntro() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) return;
  ensureStoryFlag();
  if (!needsIntro()) return;
  const backdrop = document.getElementById("storyBackdrop");
  if (backdrop) backdrop.dataset.firstRun = "1";
  setTimeout(() => showIntro({ firstRun: true }), 280);
}

/** Пролог, брифинги и финал Prelude — при входе в игровой хаб, не при создании героя. */
function runGameEntryModals() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) return;
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return;

  if (typeof needsIntro === "function" && needsIntro()) {
    maybeShowIntro();
    return;
  }

  setTimeout(() => {
    if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return;
    const backdrop = document.getElementById("storyBackdrop");
    if (backdrop?.dataset.pendingZoneStory && typeof flushPendingZoneStory === "function") {
      flushPendingZoneStory();
      return;
    }
    const zoneId = state.farmZone || "banana_mine";
    if (typeof maybeShowQuestBriefing === "function") {
      maybeShowQuestBriefing(zoneId, { delay: 320 });
    }
    if (typeof tryTriggerPreludeFinale === "function") tryTriggerPreludeFinale();
    else if (typeof flushPendingQuestBriefing === "function") flushPendingQuestBriefing();
  }, 360);
}
