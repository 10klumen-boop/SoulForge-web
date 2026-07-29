// ===== Clan boss / Рейд клана =====
// Shared HP hit-loop · участникам — Символы Клятвы (+ adena на склад).
// Временно: без недельного lockout (weeklyClears: 0), HP = 1_000_000.

const CLAN_BOSS = {
  id: "clan_oathkeeper",
  name: "Хранитель Клятвы",
  labelRu: "Хранитель Клятвы",
  reqLevel: 1,
  membersMin: 1,
  membersMax: 15,
  /** 0 = без недельного лимита (временно). */
  weeklyClears: 0,
  runTimeoutMs: 60 * 60 * 1000,
  hitIntervalMs: 120,
  /** Абсолютное HP босса (не «хиты»). */
  baseHpHits: 1_000_000,
  hpPerExtraMember: 0,
  /** Потолок урона за удар с клиента. */
  hitDmgMax: 50_000,
  rewardAdenaWarehouse: 250000,
  rewardActivityScore: 80,
  /** Символы Клятвы в инвентарь каждого участника (изучение баффов / рынок). */
  rewardRaidMarks: 50,
  rewardRaidMarksLabelRu: "Символ Клятвы",
  rewardOathSymbol: 50,
  mob: "clan-oathkeeper",
  mine: {
    bgs: ["assets/locations/clan-raid-oathkeeper.jpg?v=1"],
    overlay: "mine-zone-elven",
    title: "Рейд клана",
    hint: "Соски и скиллы работают · автоудар выкл · HP общее на клан",
  },
};

function clanBossHpHits(memberCount) {
  const base = Math.max(1, Math.floor(Number(CLAN_BOSS.baseHpHits) || 1_000_000));
  const per = Math.max(0, Math.floor(Number(CLAN_BOSS.hpPerExtraMember) || 0));
  const n = Math.max(
    1,
    Math.min(CLAN_BOSS.membersMax || 15, Math.floor(Number(memberCount) || 1))
  );
  return base + per * (n - 1);
}

if (typeof window !== "undefined") {
  window.CLAN_BOSS = CLAN_BOSS;
  window.clanBossHpHits = clanBossHpHits;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CLAN_BOSS, clanBossHpHits };
}
