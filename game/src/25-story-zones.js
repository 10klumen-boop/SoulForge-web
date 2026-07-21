// ===== Story zones: UI (рендер story-панели, chapter modal, arc bar) =====
// Core helpers (zoneRaceView, farmZoneById, ensureStoryProgress, zoneStoryBodyHtml)
// вынесены в story-zones-core.js.

function renderStoryPanel(opts) {
  opts = opts || {};
  const title = document.getElementById("storyTitle");
  const eyebrow = document.getElementById("storyEyebrow");
  const body = document.getElementById("storyBody");
  const btn = document.getElementById("storyOk");
  const icon = document.getElementById("storyIcon");
  const chapter = document.getElementById("storyChapter");
  const lead = document.getElementById("storyLead");
  const questRef = document.getElementById("storyQuestRef");
  if (title) title.textContent = opts.title || "";
  if (eyebrow) eyebrow.textContent = opts.eyebrow || "";
  if (body) body.innerHTML = opts.bodyHtml || "";
  if (btn) btn.textContent = opts.cta || "Закрыть";
  if (icon) {
    if (opts.icon) {
      icon.src = opts.icon;
      icon.alt = "";
      icon.hidden = false;
    } else icon.hidden = true;
  }
  if (chapter) {
    if (opts.chapter) {
      chapter.textContent = opts.chapter;
      chapter.hidden = false;
    } else chapter.hidden = true;
  }
  if (lead) {
    if (opts.lead) {
      lead.textContent = opts.lead;
      lead.hidden = false;
    } else lead.hidden = true;
  }
  if (questRef) {
    if (opts.questRef) {
      questRef.innerHTML = '<span class="story-quest-label">Квест Prelude</span> ' + opts.questRef;
      questRef.hidden = false;
    } else questRef.hidden = true;
  }
  if (typeof armStoryOkButton === "function") armStoryOkButton();
}

function zoneStoryBeat(zoneId, race) {
  const view = zoneRaceView(zoneId, race);
  const s = view.story;
  return {
    tag: view.storyTag,
    name: view.name,
    lead: s?.lead || "",
    questRef: s?.questRef || "",
    targets: s?.targets || "",
    icon: typeof uiZoneChipIcon === "function" ? uiZoneChipIcon(zoneId, race) : view.icon,
  };
}

function readZoneStory(zoneId, opts) {
  opts = opts || {};
  const view = zoneRaceView(zoneId);
  const s = view.story;
  if (!s) return;
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) return;
  if (!opts.force && typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) {
    backdrop.dataset.pendingZoneStory = zoneId;
    backdrop.dataset.pendingZoneFirstUnlock = opts.firstUnlock ? "1" : "";
    return;
  }
  renderStoryPanel({
    title: s.title,
    eyebrow: s.eyebrow,
    lead: s.lead,
    questRef: s.questRef,
    chapter: view.storyTag,
    icon: typeof uiZoneChipIcon === "function" ? uiZoneChipIcon(zoneId) : view.icon,
    bodyHtml: zoneStoryBodyHtml(view, { epigraph: view.chapter === 1 }),
    cta: opts.firstUnlock ? s.cta : "Закрыть",
  });
  backdrop.dataset.storyMode = "zone";
  backdrop.dataset.zoneId = zoneId;
  backdrop.dataset.firstUnlock = opts.firstUnlock ? "1" : "";
  backdrop.className = "story-backdrop race-" + currentAvatarRace() + " story-zone-" + zoneId;
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  const btn = document.getElementById("storyOk");
  if (btn) btn.focus();
}

function showZoneChapter(zoneId, opts) {
  readZoneStory(zoneId, opts || {});
}

function dismissZoneChapter(fromUnlock) {
  const backdrop = document.getElementById("storyBackdrop");
  const zoneId = backdrop?.dataset.zoneId;
  if (zoneId) markStoryChapterSeen(zoneId);
  if (backdrop) {
    delete backdrop.dataset.storyMode;
    delete backdrop.dataset.zoneId;
    delete backdrop.dataset.firstUnlock;
    backdrop.hidden = true;
  }
  if (typeof syncGamePauseState === "function") syncGamePauseState();
  else if (typeof setGamePaused === "function") setGamePaused(false);
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (fromUnlock && zoneId && typeof gameLog === "function") {
    const v = zoneRaceView(zoneId);
    gameLog(v.storyTag + ": «" + v.story.title + "»", "system");
  }
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  if (fromUnlock && zoneId && typeof maybeShowQuestBriefing === "function") {
    maybeShowQuestBriefing(zoneId, { chainStory: true, delay: 420 });
  }
  if (typeof flushPendingZoneStory === "function") flushPendingZoneStory();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof checkAchievements === "function") checkAchievements();
}

function queueZoneStoryUnlock(zoneId) {
  const backdrop = document.getElementById("storyBackdrop");
  if (!backdrop) {
    setTimeout(() => showZoneChapter(zoneId, { firstUnlock: true }), 320);
    return;
  }
  if ((typeof needsIntro === "function" && needsIntro()) ||
      (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen())) {
    backdrop.dataset.pendingZoneStory = zoneId;
    backdrop.dataset.pendingZoneFirstUnlock = "1";
    return;
  }
  setTimeout(() => {
    if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) {
      backdrop.dataset.pendingZoneStory = zoneId;
      backdrop.dataset.pendingZoneFirstUnlock = "1";
      return;
    }
    if (!storyChapterSeen(zoneId)) showZoneChapter(zoneId, { firstUnlock: true });
  }, 320);
}

function refreshZoneStoryUnlocks() {
  if (!state.avatar?.created) return;
  ensureStoryProgress();
  let queued = null;
  FARM_ZONES.forEach((zone) => {
    if (!zone.active) return;
    if (!zoneRaceView(zone).story) return;
    if (state.storyProgress.unlocksShown[zone.id]) return;
    if (typeof canEnterFarmZone !== "function" || !canEnterFarmZone(zone)) return;
    state.storyProgress.unlocksShown[zone.id] = true;
    if (!state.storyProgress.chaptersSeen[zone.id]) queued = zone.id;
  });
  if (queued) {
    save();
    queueZoneStoryUnlock(queued);
  }
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
}

function flushPendingZoneStory() {
  const backdrop = document.getElementById("storyBackdrop");
  const pending = backdrop?.dataset.pendingZoneStory;
  if (!pending) return;
  if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) return;
  const firstUnlock = backdrop.dataset.pendingZoneFirstUnlock === "1";
  delete backdrop.dataset.pendingZoneStory;
  delete backdrop.dataset.pendingZoneFirstUnlock;
  if (!storyChapterSeen(pending)) {
    setTimeout(() => {
      if (typeof isStoryBackdropOpen === "function" && isStoryBackdropOpen()) {
        backdrop.dataset.pendingZoneStory = pending;
        backdrop.dataset.pendingZoneFirstUnlock = firstUnlock ? "1" : "";
        return;
      }
      showZoneChapter(pending, { firstUnlock });
    }, 400);
  }
}

function renderStoryArcBar() {
  const bar = document.getElementById("storyArcBar");
  const titleEl = document.getElementById("storyArcTitle");
  const dotsEl = document.getElementById("storyArcDots");
  if (!bar || !dotsEl) return;
  if (!state.avatar?.created) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  ensureStoryProgress();
  const done = storyChaptersDoneCount();
  const thread = raceThreadForAvatar();
  const cur = zoneRaceView(state.farmZone || "banana_mine");
  if (titleEl) {
    titleEl.innerHTML =
      '<span class="story-arc-main">' + thread.title + "</span>" +
      '<span class="story-arc-sub">' + done + "/" + FARM_ZONES.length + " · " + cur.name + "</span>";
  }
  dotsEl.innerHTML = "";
  FARM_ZONES.forEach((zone) => {
    const v = zoneRaceView(zone);
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "story-arc-dot";
    dot.title = v.storyTag + " — " + v.name + " (нажми, чтобы прочитать)";
    if (!zone.active) dot.classList.add("future");
    else if (state.storyProgress.chaptersSeen[zone.id]) dot.classList.add("done");
    else if (typeof canEnterFarmZone === "function" && canEnterFarmZone(zone)) dot.classList.add("open");
    else dot.classList.add("locked");
    dot.onclick = (e) => {
      e.stopPropagation();
      if (typeof Audio2 !== "undefined") Audio2.click();
      const seen = !!state.storyProgress.chaptersSeen[zone.id];
      const open = zone.active && typeof canEnterFarmZone === "function" && canEnterFarmZone(zone);
      if (seen || open) readZoneStory(zone.id, { firstUnlock: false });
      else if (typeof toast === "function") toast("Глава ещё закрыта", "warn");
    };
    dotsEl.appendChild(dot);
  });
}

function openStoryArcOverview() {
  if (!state.avatar?.created) {
    toast("Создай персонажа", "warn");
    return;
  }
  const backdrop = document.getElementById("storyBackdrop");
  const body = document.getElementById("storyBody");
  const title = document.getElementById("storyTitle");
  const eyebrow = document.getElementById("storyEyebrow");
  const btn = document.getElementById("storyOk");
  if (!backdrop || !body) return;
  ensureStoryProgress();
  const thread = raceThreadForAvatar();
  const race = currentAvatarRace();
  const done = storyChaptersDoneCount();
  const parts = [
    '<p class="story-epigraph">' + PRELUDE_EPIGRAPH + "</p>",
    "<p>" + STORY_ARC.tagline + "</p>",
    '<p class="story-race-beat">' + thread.summary + "</p>",
    '<div class="story-mechanic"><span class="story-mechanic-k">Цикл симулятора</span><p>Задание → заточка → adena → снова задание. На поле — мародёры, духи, орки, твари — у каждой расы свой враг и свой смысл.</p></div>',
    '<p class="story-arc-hd"><b>Твои главы</b> · <a href="https://www.youtube.com/watch?v=tOHJ571xPiU" target="_blank" rel="noopener noreferrer">лор Prelude</a> · нажми главу, чтобы перечитать</p>',
    '<ul class="story-arc-list">',
  ];
  FARM_ZONES.forEach((zone) => {
    const v = zoneRaceView(zone);
    const s = v.story;
    const seen = !!state.storyProgress.chaptersSeen[zone.id];
    const open = zone.active && typeof canEnterFarmZone === "function" && canEnterFarmZone(zone);
    const status = zone.active ? (seen ? "✓" : open ? "→" : "🔒") : "…";
    const clickable = seen || open;
    parts.push(
      '<li class="' + (seen ? "done" : open ? "open" : "locked") + (clickable ? " story-arc-item" : "") + '"' +
      (clickable ? ' data-zone-id="' + zone.id + '"' : "") + ">" +
      '<span class="story-arc-item-main"><b>' + v.storyTag + "</b> " + v.name + "</span>" +
      '<span class="story-arc-item-st">' + status + "</span>" +
      (s?.questRef ? '<small class="story-arc-quest">' + s.questRef + "</small>" : "") +
      "<small>" + v.desc + "</small></li>"
    );
  });
  parts.push('</ul><p class="story-finale"><i>' + STORY_ARC.finaleTease + "</i></p>");
  renderStoryPanel({
    title: STORY_ARC.title,
    eyebrow: "Prelude · " + thread.title,
    chapter: done + "/" + FARM_ZONES.length + " глав",
    icon: curRaceIcon(),
    bodyHtml: parts.join(""),
    cta: "Закрыть",
  });
  body.querySelectorAll(".story-arc-item[data-zone-id]").forEach((li) => {
    li.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      readZoneStory(li.dataset.zoneId, { firstUnlock: false });
    };
  });
  backdrop.dataset.storyMode = "arc";
  delete backdrop.dataset.zoneId;
  backdrop.dataset.firstUnlock = "";
  backdrop.className = "story-backdrop race-" + race + " story-arc";
  backdrop.hidden = false;
  if (typeof setGamePaused === "function") setGamePaused(true);
  if (btn) btn.focus();
}

function wireStoryArcBar() {
  const btn = document.getElementById("storyArcBtn");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.onclick = () => {
    if (typeof Audio2 !== "undefined") Audio2.click();
    openStoryArcOverview();
  };
}

function renderMineStoryBar(zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const bar = document.getElementById("mineStoryBar");
  const tagEl = document.getElementById("mineStoryTag");
  const leadEl = document.getElementById("mineStoryLead");
  const questEl = document.getElementById("mineStoryQuest");
  if (!bar) return;
  if (!state.avatar?.created) {
    bar.hidden = true;
    return;
  }
  const beat = zoneStoryBeat(zoneId);
  const vis = typeof mineStageVisual === "function" ? mineStageVisual(zoneId) : null;
  bar.hidden = false;
  if (tagEl) tagEl.textContent = beat.tag;
  if (leadEl) {
    const lead = beat.lead || beat.name;
    leadEl.textContent = vis?.locationLabel ? vis.locationLabel + " — " + lead : lead;
  }
  if (questEl) {
    if (typeof isZoneBossPending === "function" && isZoneBossPending(zoneId)) {
      const boss = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : { name: "Босс" };
      const grind = typeof zoneBossGrindKills === "function" ? zoneBossGrindKills(zoneId) : 0;
      const need = typeof zoneBossGrindKillsNeeded === "function" ? zoneBossGrindKillsNeeded() : 12;
      if (typeof isZoneBossQueued === "function" && isZoneBossQueued(zoneId)) {
        questEl.textContent = "☠ " + boss.name + " — скоро на поле";
      } else {
        questEl.textContent = "☠ " + boss.name + " · качайся " + grind + "/" + need;
      }
      questEl.hidden = false;
    } else if (typeof isZoneChapterComplete === "function" && isZoneChapterComplete(zoneId)) {
      questEl.textContent = "глава завершена ✓";
      questEl.hidden = false;
    } else {
      const q = typeof activeZoneQuest === "function" ? activeZoneQuest(zoneId) : null;
      if (q) {
        const done = typeof questKillsDone === "function" ? questKillsDone(q.id) : 0;
        let line = q.step + "/" + (typeof QUESTS_PER_ZONE !== "undefined" ? QUESTS_PER_ZONE : 3) + " · " + done + "/" + q.kills;
        if (q.goldenKills && typeof questGoldenKillsDone === "function") {
          line += " · ★" + questGoldenKillsDone(q.id) + "/" + q.goldenKills;
        }
        questEl.textContent = q.npc.name + " · " + line + " · " + (beat.questRef || q.targets);
        questEl.hidden = false;
      } else if (beat.questRef) {
        questEl.textContent = beat.questRef;
        questEl.hidden = false;
      } else questEl.hidden = true;
    }
  }
}

function wireMineStory() {
  const readBtn = document.getElementById("mineStoryRead");
  if (readBtn && !readBtn.dataset.wired) {
    readBtn.dataset.wired = "1";
    readBtn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      const zoneId = state.farmZone || "banana_mine";
      if (typeof readZoneStory === "function") readZoneStory(zoneId, { firstUnlock: false });
    };
  }
  const farmRead = document.getElementById("farmStoryRead");
  if (farmRead && !farmRead.dataset.wired) {
    farmRead.dataset.wired = "1";
    farmRead.onclick = (e) => {
      e.stopPropagation();
      if (typeof Audio2 !== "undefined") Audio2.click();
      const zoneId = state.farmZone || "banana_mine";
      if (typeof readZoneStory === "function") readZoneStory(zoneId, { firstUnlock: false });
    };
  }
}
