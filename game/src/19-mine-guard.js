// ===== Anti-autoclick: шахта (Phase A — клиент) =====
// Шахта спавнит ~1 гном/0.9 с → идеальная ручная игра ≈ 11 ловушек / 10 с.
// Штраф — только при нечеловеческом ритме (одинаковые интервалы < 28 ms), не за «быстрые руки».
const MINE_GUARD = {
  minGapMs: { gnome: 28, banan: 55 },
  windowMs: 10_000,
  maxGnomeCatches: 16,
  fastPairMs: 28,
  fastPairsForPenalty: 5,
  penaltyMult: 0.55,
  sessionAdenaCap: 0,
};

const mineGuardState = {
  lastAt: { gnome: 0, banan: 0 },
  gnomeTimes: [],
  suspicion: 0,
  sessionAdena: 0,
  blocked: 0,
  penalized: 0,
  warned: false,
};

function resetMineGuardSession() {
  mineGuardState.lastAt = { gnome: 0, banan: 0 };
  mineGuardState.gnomeTimes = [];
  mineGuardState.suspicion = 0;
  mineGuardState.sessionAdena = 0;
  mineGuardState.blocked = 0;
  mineGuardState.penalized = 0;
  mineGuardState.warned = false;
}

function pointerOnElement(el, e) {
  if (!el || !e || e.clientX == null) return true;
  const r = el.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

function inhumanClickRhythm(times) {
  if (times.length < 6) return false;
  let fastPairs = 0;
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] < MINE_GUARD.fastPairMs) fastPairs++;
  }
  return fastPairs >= MINE_GUARD.fastPairsForPenalty;
}

function mineGuardCheck(e, el, kind) {
  const st = mineGuardState;
  const now = Date.now();
  const minGap = MINE_GUARD.minGapMs[kind] || 28;
  const lastKey = kind === "banan" ? "banan" : "gnome";

  if (e && e.isTrusted === false) {
    st.blocked++;
    st.suspicion++;
    if (typeof achStat === "function") achStat("mineGuardSynthetic", 1);
    if (typeof checkAchievements === "function") checkAchievements();
    return { ok: false, reason: "synthetic", mult: 0 };
  }
  if (e && !pointerOnElement(el, e)) {
    st.blocked++;
    return { ok: false, reason: "miss", mult: 0 };
  }
  if (st.lastAt[lastKey] && now - st.lastAt[lastKey] < minGap) {
    st.blocked++;
    return { ok: false, reason: "fast", mult: 0 };
  }
  st.lastAt[lastKey] = now;

  let mult = 1;
  if (kind === "gnome") {
    st.gnomeTimes.push(now);
    st.gnomeTimes = st.gnomeTimes.filter((t) => now - t <= MINE_GUARD.windowMs);
    const times = st.gnomeTimes;
    const overCap = times.length > MINE_GUARD.maxGnomeCatches;
    const botLike = inhumanClickRhythm(times);
    if (overCap && botLike) {
      st.suspicion++;
      const firstPenalty = !st.penalized;
      st.penalized++;
      mult = MINE_GUARD.penaltyMult;
      if (firstPenalty) {
        if (typeof achStat === "function") achStat("mineGuardPenalties", 1);
        if (typeof checkAchievements === "function") checkAchievements();
      }
      if (!st.warned) {
        st.warned = true;
        toast("Подозрительный ритм кликов — награда задания снижена", "warn");
      }
    }
    return { ok: true, mult, cps: times.length / (MINE_GUARD.windowMs / 1000) };
  }

  return { ok: true, mult: 1 };
}

function mineGuardApplyAdena(base) {
  let amount = Math.max(0, Math.round(base));
  const cap = MINE_GUARD.sessionAdenaCap;
  if (cap > 0) {
    const room = cap - mineGuardState.sessionAdena;
    if (room <= 0) return 0;
    amount = Math.min(amount, room);
  }
  mineGuardState.sessionAdena += amount;
  return amount;
}

function mineGuardStats() {
  const st = mineGuardState;
  const n = st.gnomeTimes.length;
  return {
    cps: n / (MINE_GUARD.windowMs / 1000),
    suspicion: st.suspicion,
    blocked: st.blocked,
    penalized: st.penalized,
    sessionAdena: st.sessionAdena,
  };
}

function mineGuardDevHint() {
  const s = mineGuardStats();
  return "Guard " + s.cps.toFixed(1) + "/с · блок " + s.blocked + " · штраф " + s.penalized;
}
