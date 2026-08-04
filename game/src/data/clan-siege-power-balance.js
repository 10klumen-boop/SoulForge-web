// ===== Сила осады клана (для будущих войн за узлы) =====
// Отдельно от недельного activity-score баффов (CLAN_ACTIVITY).
// Осада = состав × профессии × вложения. Пока UI/формула; бой later.

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

  /** Бонус силы для текущего держателя узла при resolve осады. */
  defenderBonusPct: 0.15,

  /** Подписи для UI. */
  labels: {
    titleRu: "Сила осады",
    hintRu:
      "Состав × профессии × вложения. Держатель +15% к силе в осаде. Elite — по силе; флагман — арена (или сила). Не путать с клан-баффами.",
  },
};

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
