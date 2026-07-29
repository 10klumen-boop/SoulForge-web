// ===== Clan buffs =====
// 1) Авто: tier от числа онлайн участников (write lease).
// 2) Доп.: изучаются за Символы Клятвы (рейд) (лидер/офицер), гейт — уровень клана.
// 3) Уровень клана: накопительный XP (вклад/угодья/рейд) — параллельно недельному score осады.

/** Накопительный уровень клана (XP не сбрасывается). */
const CLAN_LEVELS = [
  { level: 1, minXp: 0, labelRu: "Новичок" },
  { level: 2, minXp: 200, labelRu: "Отряд" },
  { level: 3, minXp: 600, labelRu: "Клятва" },
  { level: 4, minXp: 1500, labelRu: "Знамя" },
  { level: 5, minXp: 3500, labelRu: "Легенда" },
];

/** Автобафф от онлайна клана (аккаунты с живым write-lease). */
const CLAN_ONLINE_BUFF_TIERS = [
  { tier: 0, minOnline: 0, adenaPct: 0, xpPct: 0, labelRu: "Тишина" },
  { tier: 1, minOnline: 2, adenaPct: 1, xpPct: 1, labelRu: "Дозор" },
  { tier: 2, minOnline: 4, adenaPct: 2, xpPct: 2, labelRu: "Сбор" },
  { tier: 3, minOnline: 7, adenaPct: 4, xpPct: 3, labelRu: "Клятва онлайна" },
  { tier: 4, minOnline: 12, adenaPct: 6, xpPct: 4, labelRu: "Полный строй" },
];

/** Каталог изучаемых баффов (стоимость — Символы Клятвы с рейда). branch: farm | xp | combo */
const CLAN_STUDY_BUFFS = [
  // —— +фарм (адена с online mine) ——
  {
    id: "greed_1",
    branch: "farm",
    labelRu: "Жадность I",
    descRu: "+2% адены с фарма",
    adenaPct: 2,
    xpPct: 0,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "greed_2",
    branch: "farm",
    labelRu: "Жадность II",
    descRu: "+3% адены с фарма",
    adenaPct: 3,
    xpPct: 0,
    costOathSymbol: 15,
    requires: "greed_1",
    reqClanLevel: 2,
  },
  {
    id: "greed_3",
    branch: "farm",
    labelRu: "Жадность III",
    descRu: "+4% адены с фарма",
    adenaPct: 4,
    xpPct: 0,
    costOathSymbol: 40,
    requires: "greed_2",
    reqClanLevel: 3,
  },
  // —— +опыт ——
  {
    id: "wisdom_1",
    branch: "xp",
    labelRu: "Мудрость I",
    descRu: "+2% XP",
    adenaPct: 0,
    xpPct: 2,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "wisdom_2",
    branch: "xp",
    labelRu: "Мудрость II",
    descRu: "+3% XP",
    adenaPct: 0,
    xpPct: 3,
    costOathSymbol: 15,
    requires: "wisdom_1",
    reqClanLevel: 2,
  },
  {
    id: "wisdom_3",
    branch: "xp",
    labelRu: "Мудрость III",
    descRu: "+4% XP",
    adenaPct: 0,
    xpPct: 4,
    costOathSymbol: 40,
    requires: "wisdom_2",
    reqClanLevel: 3,
  },
  // —— комбо ——
  {
    id: "unity_1",
    branch: "combo",
    labelRu: "Единство I",
    descRu: "+2% адены и +2% XP",
    adenaPct: 2,
    xpPct: 2,
    costOathSymbol: 25,
    requires: ["greed_1", "wisdom_1"],
    reqClanLevel: 3,
  },
  {
    id: "unity_2",
    branch: "combo",
    labelRu: "Единство II",
    descRu: "+3% адены и +3% XP",
    adenaPct: 3,
    xpPct: 3,
    costOathSymbol: 80,
    requires: ["greed_2", "wisdom_2", "unity_1"],
    reqClanLevel: 5,
  },
  // —— PvP (урон на арене) ——
  {
    id: "valor_1",
    branch: "pvp",
    labelRu: "Доблесть I",
    descRu: "+2% урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 2,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "valor_2",
    branch: "pvp",
    labelRu: "Доблесть II",
    descRu: "+3% урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 3,
    costOathSymbol: 15,
    requires: "valor_1",
    reqClanLevel: 2,
  },
  {
    id: "valor_3",
    branch: "pvp",
    labelRu: "Доблесть III",
    descRu: "+4% урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 4,
    costOathSymbol: 40,
    requires: "valor_2",
    reqClanLevel: 3,
  },
  // —— PvP защита ——
  {
    id: "aegis_1",
    branch: "pvp_def",
    labelRu: "Эгида I",
    descRu: "−2% входящего урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 0,
    pvpDefPct: 2,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "aegis_2",
    branch: "pvp_def",
    labelRu: "Эгида II",
    descRu: "−3% входящего урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 0,
    pvpDefPct: 3,
    costOathSymbol: 15,
    requires: "aegis_1",
    reqClanLevel: 2,
  },
  {
    id: "aegis_3",
    branch: "pvp_def",
    labelRu: "Эгида III",
    descRu: "−4% входящего урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 0,
    pvpDefPct: 4,
    costOathSymbol: 40,
    requires: "aegis_2",
    reqClanLevel: 3,
  },
];

/** Кап суммы онлайн + изученных (без заточки). */
const CLAN_BUFF_CAPS = { adenaPct: 22, xpPct: 20, pvpPct: 12, pvpDefPct: 12 };

/** Очки активности (осада / босс), не баффы. */
const CLAN_ACTIVITY = {
  depositPerAdena: 0.0001,
  depositMaxPerAction: 50,
  claimTerritory: 50,
};

/** Сила осады (недельный score) → множитель цены отбития. */
const CLAN_SIEGE_POWER_TIERS = [
  { tier: 0, minScore: 0, costMult: 1, labelRu: "Слабая" },
  { tier: 1, minScore: 100, costMult: 1.75, labelRu: "Искра" },
  { tier: 2, minScore: 300, costMult: 3, labelRu: "Пламя" },
  { tier: 3, minScore: 700, costMult: 5, labelRu: "Клятва" },
];

/** @deprecated weekly score больше не крутит баффы — оставлено для тестов/совместимости */
const CLAN_BUFF_TIERS = [
  { tier: 0, minScore: 0, adenaPct: 0, xpPct: 0, labelRu: "Нет" },
  { tier: 1, minScore: 100, adenaPct: 2, xpPct: 2, labelRu: "Искра" },
  { tier: 2, minScore: 300, adenaPct: 4, xpPct: 4, labelRu: "Пламя" },
  { tier: 3, minScore: 700, adenaPct: 6, xpPct: 5, labelRu: "Клятва" },
];

function clanOnlineBuffFromCount(onlineCount) {
  const n = Math.max(0, Math.floor(Number(onlineCount) || 0));
  let best = CLAN_ONLINE_BUFF_TIERS[0];
  for (let i = 0; i < CLAN_ONLINE_BUFF_TIERS.length; i++) {
    if (n >= CLAN_ONLINE_BUFF_TIERS[i].minOnline) best = CLAN_ONLINE_BUFF_TIERS[i];
  }
  return best;
}

function clanOnlineBuffNext(onlineCount) {
  const n = Math.max(0, Math.floor(Number(onlineCount) || 0));
  for (let i = 0; i < CLAN_ONLINE_BUFF_TIERS.length; i++) {
    if (n < CLAN_ONLINE_BUFF_TIERS[i].minOnline) {
      return {
        ...CLAN_ONLINE_BUFF_TIERS[i],
        need: CLAN_ONLINE_BUFF_TIERS[i].minOnline - n,
      };
    }
  }
  return null;
}

function clanLevelFromXp(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let best = CLAN_LEVELS[0];
  for (let i = 0; i < CLAN_LEVELS.length; i++) {
    if (x >= CLAN_LEVELS[i].minXp) best = CLAN_LEVELS[i];
  }
  return best;
}

function clanXpToNext(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  const cur = clanLevelFromXp(x);
  let idx = 0;
  for (let i = 0; i < CLAN_LEVELS.length; i++) {
    if (CLAN_LEVELS[i].level === cur.level) idx = i;
  }
  const next = idx < CLAN_LEVELS.length - 1 ? CLAN_LEVELS[idx + 1] : null;
  if (!next) {
    return { next: null, need: 0, into: Math.max(0, x - cur.minXp), span: 0 };
  }
  return {
    next,
    need: Math.max(0, next.minXp - x),
    into: Math.max(0, x - cur.minXp),
    span: Math.max(1, next.minXp - cur.minXp),
  };
}

function clanStudyLevelMet(def, level) {
  if (!def) return false;
  const req = Math.max(1, Math.floor(Number(def.reqClanLevel) || 1));
  return Math.max(1, Math.floor(Number(level) || 1)) >= req;
}

function clanStudyBuffDef(buffId) {
  const id = String(buffId || "");
  return CLAN_STUDY_BUFFS.find((b) => b.id === id) || null;
}

function clanStudyRequiresMet(def, studiedIds) {
  if (!def) return false;
  const have = new Set((studiedIds || []).map(String));
  const req = def.requires;
  if (!req) return true;
  const list = Array.isArray(req) ? req : [req];
  return list.every((id) => have.has(String(id)));
}

function clanBuffTotalsFromParts(onlineTier, studiedList) {
  let adenaPct = Math.max(0, Number(onlineTier?.adenaPct) || 0);
  let xpPct = Math.max(0, Number(onlineTier?.xpPct) || 0);
  let pvpPct = 0;
  let pvpDefPct = 0;
  (studiedList || []).forEach((b) => {
    adenaPct += Math.max(0, Number(b.adenaPct) || 0);
    xpPct += Math.max(0, Number(b.xpPct) || 0);
    pvpPct += Math.max(0, Number(b.pvpPct) || 0);
    pvpDefPct += Math.max(0, Number(b.pvpDefPct) || 0);
  });
  return {
    adenaPct: Math.min(CLAN_BUFF_CAPS.adenaPct, adenaPct),
    xpPct: Math.min(CLAN_BUFF_CAPS.xpPct, xpPct),
    pvpPct: Math.min(CLAN_BUFF_CAPS.pvpPct || 12, pvpPct),
    pvpDefPct: Math.min(CLAN_BUFF_CAPS.pvpDefPct || 12, pvpDefPct),
  };
}

function clanBuffTierFromScore(score) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  let best = CLAN_BUFF_TIERS[0];
  for (let i = 0; i < CLAN_BUFF_TIERS.length; i++) {
    if (s >= CLAN_BUFF_TIERS[i].minScore) best = CLAN_BUFF_TIERS[i];
  }
  return best;
}

function clanSiegePowerFromScore(score) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  let best = CLAN_SIEGE_POWER_TIERS[0];
  for (let i = 0; i < CLAN_SIEGE_POWER_TIERS.length; i++) {
    if (s >= CLAN_SIEGE_POWER_TIERS[i].minScore) best = CLAN_SIEGE_POWER_TIERS[i];
  }
  return best;
}

function clanBuffNextThreshold(score) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  for (let i = 0; i < CLAN_BUFF_TIERS.length; i++) {
    if (s < CLAN_BUFF_TIERS[i].minScore) return CLAN_BUFF_TIERS[i];
  }
  return null;
}
