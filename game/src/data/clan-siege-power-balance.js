// ===== Сила осады / штурма клана =====
// Отдельно от недельного activity-score баффов (CLAN_ACTIVITY).
// Штурм farm = сила ростера + печати за окно; elite = окно осады по силе.

const CLAN_SIEGE_POWER = {
  /** База за каждого участника в ростере. */
  perMember: 12,

  /**
   * Бонус за ступень профессии (starter / 1st / 2nd).
   * Без данных о классе соклановца — 0 (только perMember).
   */
  professionTier: {
    0: 0,
    1: 18,
    2: 42,
  },

  /**
   * Вес роли в осаде (множитель к professionTier).
   * craft слабее в бою за узел, tank/support ценнее.
   */
  roleWeight: {
    tank: 1.25,
    melee: 1.1,
    dagger: 1.05,
    archer: 1.1,
    mage: 1.1,
    support: 1.2,
    craft: 0.65,
    unknown: 1,
  },

  /** Вложения: очки осады с адена, внесённых на склад за текущую неделю. */
  investAdenaPerPoint: 20000, // 1 очко / 20k
  investCap: 180,

  /** Вложения: доля недельного activity-score (claim, депозиты…). */
  activityPerScore: 0.25,
  activityCap: 120,

  /** Бонус силы для текущего держателя узла при resolve осады / штурма. */
  defenderBonusPct: 0.25,

  /** Подписи для UI. */
  labels: {
    titleRu: "Сила клана",
    hintRu:
      "Состав × профессии × вложения. Штурм farm: сила + печати за 4 ч (держатель +25%). Elite — только осада по расписанию. Не путать с клан-баффами.",
  },
};

/** Штурм обычных (normal) farm-узлов. */
const CLAN_ASSAULT = {
  windowMs: 4 * 60 * 60 * 1000,
  feeFloor: 5_000_000,
  feeRentDays: 50,
  sealDiv: 5,
  sealScoreCap: 20,
  /** Ниже 50% силы держателя — отказ без списания (если не abandoned). */
  powerGateMin: 0.5,
  abandonedWeekScore: 50,
  loseCdMs: 12 * 60 * 60 * 1000,
  lockMs: 24 * 60 * 60 * 1000,
  claimMinPower: { normal: 0, elite: 48, flagship: 72 },
  labels: {
    titleRu: "Штурм",
    hintRu:
      "Вход из казны · 4 часа · побеждает сила клана + печати (с капом). Казна исход не решает.",
  },
};

function clanAssaultFeeFor(tOrMeta) {
  const rent = Math.max(0, Math.floor(Number(tOrMeta?.rentPerDay) || 0));
  const floor = (CLAN_ASSAULT && CLAN_ASSAULT.feeFloor) || 5_000_000;
  const days = (CLAN_ASSAULT && CLAN_ASSAULT.feeRentDays) || 50;
  return Math.max(floor, rent * days);
}

function clanAssaultSealScore(seals) {
  const div = (CLAN_ASSAULT && CLAN_ASSAULT.sealDiv) || 5;
  const cap = (CLAN_ASSAULT && CLAN_ASSAULT.sealScoreCap) || 80;
  return Math.min(cap, Math.floor(Math.max(0, Number(seals) || 0) / div));
}

function clanSiegeRoleWeight(role) {
  const map = CLAN_SIEGE_POWER.roleWeight || {};
  const key = String(role || "unknown");
  return map[key] != null ? map[key] : map.unknown || 1;
}

function clanSiegeProfessionPoints(tier, role) {
  const t = Math.max(0, Math.min(2, Math.floor(Number(tier) || 0)));
  const base = (CLAN_SIEGE_POWER.professionTier || {})[t] || 0;
  return Math.round(base * clanSiegeRoleWeight(role));
}

/**
 * @param {object} input
 * @param {number} input.memberCount
 * @param {Array<{ tier?: number, role?: string }>} [input.professions] — известные проф. участников
 * @param {number} [input.weekDepositAdena] — взносы на склад за неделю
 * @param {number} [input.weekScore] — activity score недели
 */
function computeClanSiegePower(input) {
  const cfg = typeof CLAN_SIEGE_POWER !== "undefined" ? CLAN_SIEGE_POWER : {};
  const members = Math.max(0, Math.floor(Number(input?.memberCount) || 0));
  const perMember = Number(cfg.perMember) || 0;
  const rosterPts = members * perMember;

  const profs = Array.isArray(input?.professions) ? input.professions : [];
  let professionPts = 0;
  profs.forEach((p) => {
    professionPts += clanSiegeProfessionPoints(p?.tier, p?.role);
  });

  const deposit = Math.max(0, Number(input?.weekDepositAdena) || 0);
  const adenaPer = Math.max(1, Number(cfg.investAdenaPerPoint) || 20000);
  const investCap = Math.max(0, Number(cfg.investCap) || 0);
  const investPts = Math.min(investCap, Math.floor(deposit / adenaPer));

  const weekScore = Math.max(0, Number(input?.weekScore) || 0);
  const actMult = Number(cfg.activityPerScore) || 0;
  const actCap = Math.max(0, Number(cfg.activityCap) || 0);
  const activityPts = Math.min(actCap, Math.floor(weekScore * actMult));

  const total = rosterPts + professionPts + investPts + activityPts;
  return {
    total,
    rosterPts,
    professionPts,
    investPts,
    activityPts,
    memberCount: members,
    knownProfessions: profs.length,
  };
}

/** Сравнение двух сил для будущего окна осады (пока справочно). */
function clanSiegePowerRatio(attackerPower, defenderPower) {
  const a = Math.max(0, Number(attackerPower) || 0);
  const d = Math.max(1, Number(defenderPower) || 0);
  return Math.round((a / d) * 100) / 100;
}
