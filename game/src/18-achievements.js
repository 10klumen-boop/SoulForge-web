// ===== Достижения: UI (панель, рендер карточек, табов) =====
// Core logic (checkAchievements, checkPlaytestChecklist, grantAchReward)
// вынесена в achievements-core.js.

function achievementsProgress() {
  ensureAchievementsState();
  const total = ALL_ACHIEVEMENTS.length;
  const done = ALL_ACHIEVEMENTS.filter((a) => state.achievements.unlocked[a.id]).length;
  const hiddenTotal = HIDDEN_ACHIEVEMENTS.length;
  const hiddenDone = HIDDEN_ACHIEVEMENTS.filter((a) => state.achievements.unlocked[a.id]).length;
  const playtest = playtestAchievementsProgress();
  return { done, total, hiddenTotal, hiddenDone, playtestDone: playtest.done, playtestTotal: playtest.total };
}

function openAchievements() {
  checkAchievements({ silent: true });
  renderAchievements();
  show("ach");
  Audio2.open();
}

function renderAchCard(ach, unlocked, ctx) {
  const card = document.createElement("article");
  const secret = !!ach.hidden;
  const lockedSecret = secret && !unlocked;
  card.className =
    "ach-card" +
    (unlocked ? " unlocked" : " locked") +
    (secret ? " secret" : "") +
    (lockedSecret ? " secret-locked" : "");
  const rw = unlocked ? formatAchReward(ach.reward) : lockedSecret ? "" : formatAchReward(ach.reward);
  const icon = lockedSecret ? ACH_SECRET_ICON : resolveAchIcon(ach);
  const title = lockedSecret ? "???" : ach.title;
  const desc = lockedSecret ? "Секретное достижение — откроется после выполнения" : ach.desc;
  let progressHtml = "";
  if (!unlocked && !lockedSecret && ach.progress && ctx) {
    const p = ach.progress(ctx);
    if (p && p.max > 1) {
      const pct = Math.min(100, Math.round((p.current / p.max) * 100));
      progressHtml =
        '<div class="ach-progress-row">' +
        '<div class="ach-progress-bar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="ach-progress-val">' + fmt(p.current) + " / " + fmt(p.max) + "</span>" +
        "</div>";
    }
  }
  card.innerHTML =
    `<img class="ach-ico" src="${icon}" alt="" loading="lazy" onerror="this.src='${ACH_ICON}'">` +
    `<div class="ach-body">` +
    `<div class="ach-title">${title}${unlocked ? ' <span class="ach-badge">✓</span>' : ""}</div>` +
    `<div class="ach-desc">${desc}</div>` +
    progressHtml +
    (rw ? `<div class="ach-reward">Награда: ${rw}</div>` : lockedSecret ? `<div class="ach-reward ach-reward-secret">Награда: ???</div>` : "") +
    `</div>`;
  return card;
}

function renderAchTabs() {
  const tabs = document.getElementById("achTabs");
  if (!tabs) return;
  if (!tabs.dataset.wired) {
    tabs.dataset.wired = "1";
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".ach-tab");
      if (!btn) return;
      Audio2.click();
      achUiFilter = btn.dataset.cat || "all";
      renderAchievements();
    });
  }
  tabs.innerHTML = ACH_CATEGORIES.map((cat) => {
    const sel = achUiFilter === cat.id ? " sel" : "";
    return '<button type="button" class="ach-tab' + sel + '" data-cat="' + cat.id + '">' + cat.label + "</button>";
  }).join("");
}

function renderAchievements() {
  ensureAchievementsState();
  const list = $("#achList");
  if (!list) return;
  const ctx = achievementContext();
  const { done, total, hiddenTotal, hiddenDone } = achievementsProgress();
  const sum = document.getElementById("achSummary");
  if (sum) sum.textContent = done + " / " + total;
  const hint = document.querySelector(".ach-hint");
  if (hint) {
    hint.textContent = "Секретных " + hiddenDone + " / " + hiddenTotal + " · награды автоматически";
  }
  const playtestEl = document.getElementById("achPlaytestBar");
  if (playtestEl) {
    playtestEl.hidden = true;
    playtestEl.innerHTML = "";
  }

  renderAchTabs();
  list.innerHTML = "";

  const showList = (items, headText) => {
    if (!items.length) return;
    if (headText) {
      const head = document.createElement("div");
      head.className = "ach-secret-head";
      head.textContent = headText;
      list.appendChild(head);
    }
    items.forEach((ach) => {
      list.appendChild(renderAchCard(ach, !!state.achievements.unlocked[ach.id], ctx));
    });
  };

  const filter = achUiFilter;
  if (filter === "all") {
    ACH_CATEGORIES.filter((c) => c.id !== "all" && c.id !== "secret").forEach((cat) => {
      showList(ACHIEVEMENTS.filter((a) => a.category === cat.id), cat.label);
    });
    showList(HIDDEN_ACHIEVEMENTS, "Секретные достижения");
    return;
  }
  if (filter === "secret") {
    showList(HIDDEN_ACHIEVEMENTS, null);
    return;
  }
  showList(ACHIEVEMENTS.filter((a) => a.category === filter), null);
}
