// ===== UI: ежедневные / еженедельные поручения =====

let engagementUiTab = "daily";

function maybeAnnounceEngagementEntry() {
  if (typeof engagementClaimableCount !== "function") return;
  const n = engagementClaimableCount();
  const streak = Math.max(0, Math.floor(Number(state.engagement?.loginStreak) || 0));
  if (n <= 0 && streak <= 0) return;
  const parts = [];
  if (streak > 0) parts.push("Стрик ×" + streak);
  if (n > 0) parts.push("наград: " + n);
  if (typeof toast === "function") {
    toast("Поручения · " + parts.join(" · "), n > 0 ? "gold" : "system");
  }
}

function refreshEngagementUi() {
  syncEngagementMenuTile();
  const screen = document.getElementById("screen-engagement");
  if (screen && screen.classList.contains("active")) {
    renderEngagementScreen();
  }
  if (typeof renderMenu === "function") {
    /* tile meta already via syncEngagementMenuTile */
  }
}

function syncEngagementMenuTile() {
  const meta = document.getElementById("engagementTileMeta");
  const badge = document.getElementById("engagementTileBadge");
  if (!meta && !badge) return;
  if (typeof ensureEngagementPeriod === "function") {
    try {
      ensureEngagementPeriod(Date.now(), { touchLogin: false });
    } catch (_) {}
  }
  const claimable =
    typeof engagementClaimableCount === "function" ? engagementClaimableCount() : 0;
  const daily =
    typeof engagementDailyDoneCount === "function"
      ? engagementDailyDoneCount()
      : { done: 0, total: 0 };
  if (meta) {
    meta.textContent =
      claimable > 0 ? "Награда!" : daily.total ? daily.done + "/" + daily.total : "День";
  }
  if (badge) {
    badge.hidden = !(claimable > 0);
    badge.textContent = claimable > 99 ? "99+" : String(claimable);
  }
}

function openEngagementScreen() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    if (typeof maybeShowAvatarSetup === "function") maybeShowAvatarSetup();
    return;
  }
  if (typeof ensureEngagementPeriod === "function") {
    ensureEngagementPeriod(Date.now(), { touchLogin: true });
  }
  if (typeof engagementEmit === "function") engagementEmit("login");
  renderEngagementScreen();
  show("engagement");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
}

function renderEngagementTabs() {
  const tabs = document.getElementById("engagementTabs");
  if (!tabs) return;
  if (!tabs.dataset.wired) {
    tabs.dataset.wired = "1";
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".eng-tab");
      if (!btn) return;
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      engagementUiTab = btn.dataset.tab || "daily";
      renderEngagementScreen();
    });
  }
  const items = [
    { id: "daily", label: "День" },
    { id: "weekly", label: "Неделя" },
  ];
  tabs.innerHTML = items
    .map((t) => {
      const sel = engagementUiTab === t.id ? " sel" : "";
      return (
        '<button type="button" class="eng-tab' +
        sel +
        '" data-tab="' +
        t.id +
        '">' +
        t.label +
        "</button>"
      );
    })
    .join("");
}

function renderEngagementStreak() {
  const host = document.getElementById("engagementStreak");
  if (!host) return;
  const e = typeof ensureEngagementState === "function" ? ensureEngagementState() : state.engagement;
  const streak = Math.max(0, Math.floor(Number(e?.loginStreak) || 0));
  const days = (ENGAGEMENT && ENGAGEMENT.streakDisplayDays) || 7;
  const claimable = typeof engagementStreakClaimable === "function" && engagementStreakClaimable();
  const fullNeed =
    typeof engagementStreakFullDays === "function" ? engagementStreakFullDays() : 7;
  const isFull =
    typeof engagementStreakIsFull === "function"
      ? engagementStreakIsFull(streak)
      : streak >= fullNeed;
  const reward =
    typeof engagementStreakReward === "function"
      ? engagementStreakReward(Math.max(fullNeed, streak || 1))
      : null;
  const rw =
    reward && typeof formatEngagementReward === "function"
      ? formatEngagementReward(reward)
      : "";
  const ico =
    typeof resolveEngagementIcon === "function"
      ? resolveEngagementIcon("streak")
      : "icons/engagement/streak.png?v=1";
  let dots = "";
  for (let i = 1; i <= days; i++) {
    const on = streak >= i;
    dots +=
      '<span class="eng-streak-dot' +
      (on ? " on" : "") +
      '" title="День ' +
      i +
      '">' +
      i +
      "</span>";
  }
  let actionHtml = "";
  if (claimable) {
    actionHtml =
      '<button type="button" class="btn btn-primary eng-claim-btn" data-eng-claim="streak">Забрать полный</button>';
  } else if (e.streakClaimedDay === (typeof engagementUtcDayKey === "function" ? engagementUtcDayKey(Date.now()) : "") && isFull) {
    actionHtml = '<span class="eng-claimed">забрано</span>';
  } else {
    actionHtml =
      '<span class="eng-pending">нужен ×' + fullNeed + "</span>";
  }
  host.innerHTML =
    '<div class="eng-streak-head">' +
    '<div class="eng-streak-left">' +
    '<img class="eng-ico eng-ico-sm" src="' +
    ico +
    '" alt="" loading="lazy">' +
    "<div><b>Стрик входа</b> · ×" +
    streak +
    "/" +
    fullNeed +
    (rw ? '<div class="eng-streak-rw">Награда за полный: ' + rw + "</div>" : "") +
    "</div></div>" +
    actionHtml +
    "</div>" +
    '<div class="eng-streak-dots">' +
    dots +
    "</div>";
}

function renderEngagementTaskCard(task) {
  const p =
    typeof engagementTaskProgress === "function"
      ? engagementTaskProgress(task.id)
      : { current: 0, max: task.target || 1, done: false, claimed: false };
  const pct = Math.min(100, Math.round((p.current / p.max) * 100));
  const rw =
    typeof formatEngagementReward === "function"
      ? formatEngagementReward(task.reward)
      : "";
  const ico =
    typeof resolveEngagementIcon === "function"
      ? resolveEngagementIcon(task)
      : "icons/engagement/quest.png?v=1";
  let action = "";
  if (p.claimed) {
    action = '<span class="eng-claimed">✓ Получено</span>';
  } else if (p.done) {
    action =
      '<button type="button" class="btn btn-primary eng-claim-btn" data-eng-claim="task" data-id="' +
      task.id +
      '">Забрать</button>';
  } else {
    action = '<span class="eng-pending">В процессе</span>';
  }
  const card = document.createElement("article");
  card.className =
    "eng-card" + (p.claimed ? " claimed" : p.done ? " ready" : "");
  card.innerHTML =
    '<img class="eng-ico" src="' +
    ico +
    '" alt="" loading="lazy">' +
    '<div class="eng-body">' +
    '<div class="eng-title">' +
    task.title +
    "</div>" +
    '<div class="eng-desc">' +
    (task.desc || "") +
    "</div>" +
    '<div class="eng-progress-row">' +
    '<div class="eng-progress-bar"><i style="width:' +
    pct +
    '%"></i></div>' +
    '<span class="eng-progress-val">' +
    (typeof fmt === "function" ? fmt(p.current) : p.current) +
    " / " +
    (typeof fmt === "function" ? fmt(p.max) : p.max) +
    "</span>" +
    "</div>" +
    (rw ? '<div class="eng-reward">Награда: ' + rw + "</div>" : "") +
    "</div>" +
    '<div class="eng-actions">' +
    action +
    "</div>";
  return card;
}

function renderEngagementMilestone(period) {
  const host = document.getElementById("engagementMilestone");
  if (!host) return;
  const isWeekly = period === "weekly";
  const mile = isWeekly ? ENGAGEMENT_WEEKLY_MILESTONE : ENGAGEMENT_DAILY_MILESTONE;
  const e = ensureEngagementState();
  const allClaimed =
    typeof engagementAllPeriodClaimed === "function" &&
    engagementAllPeriodClaimed(isWeekly ? "weekly" : "daily");
  const claimed = isWeekly ? e.weeklyMilestoneClaimed : e.dailyMilestoneClaimed;
  const rw =
    typeof formatEngagementReward === "function"
      ? formatEngagementReward(mile.reward)
      : "";
  let action = "";
  if (claimed) action = '<span class="eng-claimed">✓ Получено</span>';
  else if (allClaimed) {
    action =
      '<button type="button" class="btn btn-primary eng-claim-btn" data-eng-claim="milestone" data-period="' +
      (isWeekly ? "weekly" : "daily") +
      '">Забрать комплект</button>';
  } else {
    action = '<span class="eng-pending">Забери все поручения</span>';
  }
  host.innerHTML =
    '<div class="eng-mile-card' +
    (claimed ? " claimed" : allClaimed ? " ready" : "") +
    '">' +
    '<div class="eng-mile-left">' +
    '<img class="eng-ico eng-ico-sm" src="' +
    (typeof resolveEngagementIcon === "function"
      ? resolveEngagementIcon(mile)
      : "icons/engagement/milestone.png?v=1") +
    '" alt="" loading="lazy">' +
    "<div><b>" +
    mile.title +
    "</b><div class=\"eng-desc\">" +
    mile.desc +
    "</div>" +
    (rw ? '<div class="eng-reward">Награда: ' + rw + "</div>" : "") +
    "</div></div>" +
    '<div class="eng-actions">' +
    action +
    "</div></div>";
}

function renderEngagementScreen() {
  if (typeof ensureEngagementPeriod === "function") {
    ensureEngagementPeriod(Date.now(), { touchLogin: false });
  }
  renderEngagementTabs();
  renderEngagementStreak();
  const list = document.getElementById("engagementList");
  const resetEl = document.getElementById("engagementResetHint");
  const summary = document.getElementById("engagementSummary");
  const period = engagementUiTab === "weekly" ? "weekly" : "daily";
  if (resetEl) {
    const ms =
      period === "weekly"
        ? engagementMsUntilUtcWeek(Date.now())
        : engagementMsUntilUtcMidnight(Date.now());
    resetEl.textContent =
      "Сброс через " + formatEngagementCountdown(ms) + " (UTC)";
  }
  if (summary) {
    if (period === "daily") {
      const d = engagementDailyDoneCount();
      summary.textContent = "День · " + d.done + " / " + d.total;
    } else {
      const e = ensureEngagementState();
      let done = 0;
      (e.weeklyIds || []).forEach((id) => {
        if (engagementTaskProgress(id).claimed) done++;
      });
      summary.textContent = "Неделя · " + done + " / " + (e.weeklyIds || []).length;
    }
  }
  if (list) {
    list.innerHTML = "";
    const tasks =
      typeof engagementActiveTasks === "function"
        ? engagementActiveTasks(period)
        : [];
    if (!tasks.length) {
      list.innerHTML = '<div class="eng-empty">Нет поручений на этот период</div>';
    } else {
      tasks.forEach((t) => list.appendChild(renderEngagementTaskCard(t)));
    }
  }
  renderEngagementMilestone(period);
  wireEngagementClaims();
  syncEngagementMenuTile();
}

function wireEngagementClaims() {
  const root = document.getElementById("screen-engagement");
  if (!root || root.dataset.claimWired) return;
  root.dataset.claimWired = "1";
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-eng-claim]");
    if (!btn) return;
    if (btn.getAttribute("aria-disabled") === "true") return;
    if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
    const kind = btn.getAttribute("data-eng-claim");
    let res = null;
    if (kind === "task") res = claimEngagementTask(btn.getAttribute("data-id"));
    else if (kind === "milestone")
      res = claimEngagementMilestone(btn.getAttribute("data-period") || "daily");
    else if (kind === "streak") res = claimEngagementStreak();
    if (res && res.ok) {
      const adenaEl = document.getElementById("adena");
      if (adenaEl && typeof fmt === "function") adenaEl.textContent = fmt(state.adena);
      renderEngagementScreen();
      if (typeof renderMenu === "function") renderMenu();
    }
  });
}

function bindEngagementUi() {
  const tile = document.getElementById("engagementTile");
  if (tile && !tile.dataset.wired) {
    tile.dataset.wired = "1";
    tile.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      openEngagementScreen();
    };
  }
  wireEngagementClaims();
  syncEngagementMenuTile();
}

if (typeof window !== "undefined") {
  window.openEngagementScreen = openEngagementScreen;
  window.refreshEngagementUi = refreshEngagementUi;
  window.syncEngagementMenuTile = syncEngagementMenuTile;
  window.maybeAnnounceEngagementEntry = maybeAnnounceEngagementEntry;
  window.bindEngagementUi = bindEngagementUi;
}
