// ===== Core: ежедневные / еженедельные поручения + login streak =====

function ensureEngagementState() {
  if (!state.engagement || typeof state.engagement !== "object") {
    if (typeof ProgressStore !== "undefined" && ProgressStore.set) {
      ProgressStore.set("engagement", defaultEngagementState());
    } else {
      state.engagement = defaultEngagementState();
    }
  }
  const e = state.engagement;
  if (!e.progress || typeof e.progress !== "object") e.progress = {};
  if (!e.claimed || typeof e.claimed !== "object") e.claimed = {};
  if (!Array.isArray(e.dailyIds)) e.dailyIds = [];
  if (!Array.isArray(e.weeklyIds)) e.weeklyIds = [];
  return e;
}

function engagementUtcDayKey(now) {
  if (typeof partyUtcDayKey === "function") return partyUtcDayKey(now);
  const d = new Date(Number(now) || Date.now());
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function engagementUtcWeekKey(now) {
  if (typeof partyUtcWeekKey === "function") return partyUtcWeekKey(now);
  const d = new Date(Number(now) || Date.now());
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return thursday.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

function engagementPrevUtcDayKey(dayKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ""));
  if (!m) return "";
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]) - 86400000;
  return engagementUtcDayKey(t);
}

function engagementHashSeed(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function engagementMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function engagementCharacterSeedPart() {
  return String(state.activeCharacterId || state.avatar?.name || "guest");
}

function engagementPickTaskIds(pool, count, seedStr, fixedIds) {
  const list = (pool || []).slice();
  const out = [];
  const fixed = Array.isArray(fixedIds) ? fixedIds : fixedIds ? [fixedIds] : [];
  fixed.forEach((fid) => {
    const fix = list.find((t) => t.id === fid);
    if (!fix) return;
    if (out.indexOf(fix.id) >= 0) return;
    out.push(fix.id);
    const idx = list.indexOf(fix);
    if (idx >= 0) list.splice(idx, 1);
  });
  const need = Math.max(0, (count || 0) - out.length);
  const rng = engagementMulberry32(engagementHashSeed(seedStr));
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  for (let i = 0; i < need && i < list.length; i++) out.push(list[i].id);
  return out;
}

function engagementNormalizeFixedIds(period) {
  if (period === "weekly") {
    return Array.isArray(ENGAGEMENT.weeklyFixedIds)
      ? ENGAGEMENT.weeklyFixedIds.slice()
      : [];
  }
  if (Array.isArray(ENGAGEMENT.dailyFixedIds)) return ENGAGEMENT.dailyFixedIds.slice();
  if (ENGAGEMENT.dailyFixedId) return [ENGAGEMENT.dailyFixedId];
  return ["login"];
}

function engagementStripIds(map, ids) {
  const next = { ...(map || {}) };
  (ids || []).forEach((id) => {
    delete next[id];
  });
  return next;
}

function engagementWrite(mutator) {
  ensureEngagementState();
  if (typeof ProgressStore !== "undefined" && ProgressStore.update) {
    ProgressStore.update("engagement", (prev) => {
      const base = prev && typeof prev === "object" ? prev : defaultEngagementState();
      const draft = {
        ...base,
        progress: { ...(base.progress || {}) },
        claimed: { ...(base.claimed || {}) },
        dailyIds: Array.isArray(base.dailyIds) ? base.dailyIds.slice() : [],
        weeklyIds: Array.isArray(base.weeklyIds) ? base.weeklyIds.slice() : [],
      };
      mutator(draft);
      return draft;
    });
  } else {
    mutator(state.engagement);
  }
  return state.engagement;
}

/**
 * Ротация периодов + login streak. Возвращает { rolledDaily, rolledWeekly, streakUpdated }.
 */
function ensureEngagementPeriod(now, opts) {
  opts = opts || {};
  const ts = Number(now) || Date.now();
  const dayKey = engagementUtcDayKey(ts);
  const weekKey = engagementUtcWeekKey(ts);
  ensureEngagementState();
  const before = state.engagement;
  let rolledDaily = false;
  let rolledWeekly = false;
  let streakUpdated = false;

  engagementWrite((e) => {
    const rosterVer = Number(ENGAGEMENT.rosterVer) || 0;
    const needRosterRefresh = (Number(e.rosterVer) || 0) !== rosterVer;

    if (e.dailyPeriod !== dayKey) {
      rolledDaily = true;
      e.progress = engagementStripIds(e.progress, e.dailyIds);
      e.claimed = engagementStripIds(e.claimed, e.dailyIds);
      e.dailyIds = engagementPickTaskIds(
        ENGAGEMENT_DAILY_POOL,
        ENGAGEMENT.dailyCount,
        dayKey + "|" + engagementCharacterSeedPart(),
        engagementNormalizeFixedIds("daily")
      );
      e.dailyPeriod = dayKey;
      e.dailyMilestoneClaimed = false;
    } else if (needRosterRefresh || !e.dailyIds.length) {
      e.dailyIds = engagementPickTaskIds(
        ENGAGEMENT_DAILY_POOL,
        ENGAGEMENT.dailyCount,
        dayKey + "|" + engagementCharacterSeedPart(),
        engagementNormalizeFixedIds("daily")
      );
      e.dailyPeriod = dayKey;
    }

    if (e.weeklyPeriod !== weekKey) {
      rolledWeekly = true;
      e.progress = engagementStripIds(e.progress, e.weeklyIds);
      e.claimed = engagementStripIds(e.claimed, e.weeklyIds);
      e.weeklyIds = engagementPickTaskIds(
        ENGAGEMENT_WEEKLY_POOL,
        ENGAGEMENT.weeklyCount,
        weekKey + "|" + engagementCharacterSeedPart(),
        engagementNormalizeFixedIds("weekly")
      );
      e.weeklyPeriod = weekKey;
      e.weeklyMilestoneClaimed = false;
    } else if (needRosterRefresh || !e.weeklyIds.length) {
      e.weeklyIds = engagementPickTaskIds(
        ENGAGEMENT_WEEKLY_POOL,
        ENGAGEMENT.weeklyCount,
        weekKey + "|" + engagementCharacterSeedPart(),
        engagementNormalizeFixedIds("weekly")
      );
      e.weeklyPeriod = weekKey;
    }

    e.rosterVer = rosterVer;

    if (opts.touchLogin !== false) {
      if (e.lastLoginDay !== dayKey) {
        const yesterday = engagementPrevUtcDayKey(dayKey);
        if (e.lastLoginDay && e.lastLoginDay === yesterday) {
          e.loginStreak = Math.max(1, (e.loginStreak || 0) + 1);
        } else {
          e.loginStreak = 1;
        }
        e.lastLoginDay = dayKey;
        streakUpdated = true;
      }
      if (e.dailyIds.indexOf("login") >= 0) {
        const cur = e.progress.login || 0;
        if (cur < 1) e.progress.login = 1;
      }
    }
  });

  return { rolledDaily, rolledWeekly, streakUpdated, dayKey, weekKey, engagement: before };
}

function engagementActiveTasks(period) {
  ensureEngagementState();
  const e = state.engagement;
  const ids = period === "weekly" ? e.weeklyIds : e.dailyIds;
  return (ids || [])
    .map((id) => engagementTaskById(id))
    .filter(Boolean);
}

function engagementTaskProgress(taskId) {
  ensureEngagementState();
  const task = engagementTaskById(taskId);
  const cur = Math.max(0, Math.floor(Number(state.engagement.progress?.[taskId]) || 0));
  const max = Math.max(1, task?.target || 1);
  return { current: Math.min(cur, max), max, done: cur >= max, claimed: !!state.engagement.claimed?.[taskId] };
}

function engagementEventMatches(task, eventName, payload) {
  if (!task || task.event !== eventName) return false;
  const m = task.match;
  if (!m) return true;
  payload = payload || {};
  if (m.type != null) {
    const t = payload.type || payload.mobType;
    if (String(t) !== String(m.type)) return false;
  }
  if (m.youWin != null) {
    if (!!payload.youWin !== !!m.youWin) return false;
  }
  if (m.mode != null) {
    if (String(payload.mode || "") !== String(m.mode)) return false;
  }
  if (m.excludeMode != null) {
    if (String(payload.mode || "") === String(m.excludeMode)) return false;
  }
  return true;
}

function engagementEmit(eventName, payload) {
  if (!eventName) return;
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) return;
  ensureEngagementPeriod(Date.now(), { touchLogin: eventName === "login" });
  const e0 = ensureEngagementState();
  const activeIds = (e0.dailyIds || []).concat(e0.weeklyIds || []);
  let changed = false;
  engagementWrite((e) => {
    activeIds.forEach((id) => {
      const task = engagementTaskById(id);
      if (!engagementEventMatches(task, eventName, payload)) return;
      if (e.claimed[id]) return;
      const max = Math.max(1, task.target || 1);
      const cur = Math.max(0, Math.floor(Number(e.progress[id]) || 0));
      if (cur >= max) return;
      const delta = Math.max(1, Math.floor(Number(payload?.delta) || 1));
      e.progress[id] = Math.min(max, cur + delta);
      changed = true;
    });
  });
  if (changed && typeof refreshEngagementUi === "function") {
    try {
      refreshEngagementUi();
    } catch (_) {}
  }
  return changed;
}

function formatEngagementReward(reward) {
  if (!reward) return "";
  const parts = [];
  if (reward.adena) {
    const adena =
      typeof playtestIncome === "function" ? playtestIncome(reward.adena) : reward.adena;
    parts.push(
      (typeof fmtAdena === "function" ? fmtAdena(adena) : String(adena)) + " adena"
    );
  }
  if (reward.ore) {
    if (reward.ore.soul) parts.push("Soul Ore ×" + (typeof fmt === "function" ? fmt(reward.ore.soul) : reward.ore.soul));
    if (reward.ore.spirit) parts.push("Spirit Ore ×" + (typeof fmt === "function" ? fmt(reward.ore.spirit) : reward.ore.spirit));
  }
  if (reward.autoClickerMs) {
    const min = Math.round(reward.autoClickerMs / 60000);
    parts.push("Автоудар " + min + " мин");
  }
  return parts.join(" · ");
}

function grantEngagementReward(reward) {
  if (!reward) return;
  if (typeof ensureWorkshopState === "function") ensureWorkshopState();
  if (reward.adena) {
    const adena =
      typeof playtestIncome === "function" ? playtestIncome(reward.adena) : reward.adena;
    ProgressStore.update("adena", (a) => (a || 0) + adena);
  }
  if (reward.ore) {
    ProgressStore.update("materials", (m) => ({
      ...(m || { soul: 0, spirit: 0 }),
      soul: (m?.soul || 0) + (reward.ore.soul || 0),
      spirit: (m?.spirit || 0) + (reward.ore.spirit || 0),
    }));
  }
  if (reward.autoClickerMs && typeof grantAutoClickerTime === "function") {
    grantAutoClickerTime(reward.autoClickerMs, {
      label: "Поручения",
      toast: false,
    });
  }
}

function claimEngagementTask(taskId) {
  ensureEngagementPeriod(Date.now(), { touchLogin: false });
  const task = engagementTaskById(taskId);
  if (!task) return { ok: false, reason: "unknown" };
  const p = engagementTaskProgress(taskId);
  if (!p.done) return { ok: false, reason: "incomplete" };
  if (p.claimed) return { ok: false, reason: "claimed" };
  grantEngagementReward(task.reward);
  engagementWrite((e) => {
    e.claimed[taskId] = true;
  });
  if (typeof save === "function") save();
  if (typeof refreshEngagementUi === "function") refreshEngagementUi();
  if (typeof toast === "function") {
    toast("Поручение: " + task.title + " · " + formatEngagementReward(task.reward), "success");
  }
  return { ok: true, reward: task.reward };
}

function engagementAllPeriodClaimed(period) {
  ensureEngagementState();
  const ids = period === "weekly" ? state.engagement.weeklyIds : state.engagement.dailyIds;
  if (!ids || !ids.length) return false;
  return ids.every((id) => !!state.engagement.claimed?.[id]);
}

function claimEngagementMilestone(period) {
  ensureEngagementPeriod(Date.now(), { touchLogin: false });
  const isWeekly = period === "weekly";
  const e = ensureEngagementState();
  if (!engagementAllPeriodClaimed(isWeekly ? "weekly" : "daily")) {
    return { ok: false, reason: "incomplete" };
  }
  if (isWeekly ? e.weeklyMilestoneClaimed : e.dailyMilestoneClaimed) {
    return { ok: false, reason: "claimed" };
  }
  const mile = isWeekly ? ENGAGEMENT_WEEKLY_MILESTONE : ENGAGEMENT_DAILY_MILESTONE;
  grantEngagementReward(mile.reward);
  engagementWrite((draft) => {
    if (isWeekly) draft.weeklyMilestoneClaimed = true;
    else draft.dailyMilestoneClaimed = true;
  });
  if (typeof save === "function") save();
  if (typeof refreshEngagementUi === "function") refreshEngagementUi();
  if (typeof toast === "function") {
    toast(mile.title + " · " + formatEngagementReward(mile.reward), "gold");
  }
  return { ok: true, reward: mile.reward };
}

function engagementStreakClaimable() {
  ensureEngagementState();
  const e = state.engagement;
  const dayKey = engagementUtcDayKey(Date.now());
  if (!e.lastLoginDay || e.lastLoginDay !== dayKey) return false;
  if (!engagementStreakIsFull(e.loginStreak)) return false;
  return e.streakClaimedDay !== dayKey;
}

function claimEngagementStreak() {
  ensureEngagementPeriod(Date.now(), { touchLogin: true });
  if (!engagementStreakClaimable()) {
    const e = ensureEngagementState();
    if (!engagementStreakIsFull(e.loginStreak)) return { ok: false, reason: "incomplete" };
    return { ok: false, reason: "claimed" };
  }
  const e = ensureEngagementState();
  const reward = engagementStreakReward(e.loginStreak);
  const dayKey = engagementUtcDayKey(Date.now());
  grantEngagementReward(reward);
  engagementWrite((draft) => {
    draft.streakClaimedDay = dayKey;
  });
  if (typeof save === "function") save();
  if (typeof refreshEngagementUi === "function") refreshEngagementUi();
  if (typeof toast === "function") {
    toast(
      "Полный стрик ×" + e.loginStreak + " · " + formatEngagementReward(reward),
      "gold"
    );
  }
  return { ok: true, reward, streak: e.loginStreak };
}

function engagementClaimableCount() {
  ensureEngagementPeriod(Date.now(), { touchLogin: false });
  const e = ensureEngagementState();
  let n = 0;
  (e.dailyIds || []).concat(e.weeklyIds || []).forEach((id) => {
    const p = engagementTaskProgress(id);
    if (p.done && !p.claimed) n++;
  });
  if (engagementAllPeriodClaimed("daily") && !e.dailyMilestoneClaimed) n++;
  if (engagementAllPeriodClaimed("weekly") && !e.weeklyMilestoneClaimed) n++;
  if (engagementStreakClaimable()) n++;
  return n;
}

function engagementDailyDoneCount() {
  ensureEngagementState();
  const e = state.engagement;
  let done = 0;
  (e.dailyIds || []).forEach((id) => {
    if (engagementTaskProgress(id).claimed) done++;
  });
  return { done, total: (e.dailyIds || []).length };
}

function engagementMsUntilUtcMidnight(now) {
  const ts = Number(now) || Date.now();
  const d = new Date(ts);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(0, next - ts);
}

function engagementMsUntilUtcWeek(now) {
  const ts = Number(now) || Date.now();
  const d = new Date(ts);
  const utcDay = d.getUTCDay() || 7; // 1=Mon .. 7=Sun
  const daysToMon = utcDay === 1 ? 7 : 8 - utcDay;
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToMon);
  return Math.max(0, next - ts);
}

function formatEngagementCountdown(ms) {
  const sec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 48) {
    const days = Math.floor(h / 24);
    return days + "д " + (h % 24) + "ч";
  }
  return h + "ч " + String(m).padStart(2, "0") + "м";
}

if (typeof window !== "undefined") {
  window.ensureEngagementState = ensureEngagementState;
  window.ensureEngagementPeriod = ensureEngagementPeriod;
  window.engagementEmit = engagementEmit;
  window.claimEngagementTask = claimEngagementTask;
  window.claimEngagementMilestone = claimEngagementMilestone;
  window.claimEngagementStreak = claimEngagementStreak;
  window.engagementClaimableCount = engagementClaimableCount;
  window.formatEngagementReward = formatEngagementReward;
  window.grantEngagementReward = grantEngagementReward;
}
