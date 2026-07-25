// ===== Баланс дуэлей / арены (не фарм) =====
// Формула урона, HP, softcap DEF, remap скиллов PvE→PvP, whitelist пассивов.

/** Softcap: mitigation = def / (def + PVP_DEF_SOFT). */
const PVP_DEF_SOFT = 280;

/** Масштаб atk → сырой урон до mitigation. */
const PVP_ATK_SCALE = 0.42;

/** Узкий разброс урона (±). */
const PVP_VARIANCE = 0.04;

/** Потолок произведения skill×buff×shot за один удар. */
const PVP_SKILL_MULT_CAP = 4;

/** Guard: множитель входящего урона в раунде. */
const PVP_GUARD_INCOMING_MULT = 0.5;

/** Пре-armed spirit/soul shot на старте дуэли. */
const PVP_SHOT_MULT = 1.12;

/** HP пул. */
const PVP_HP_BASE = 220;
const PVP_HP_PER_LVL = 18;
const PVP_HP_FROM_PDEF = 1.15;
const PVP_HP_FROM_MDEF = 0.95;

/** Лимит раундов; при равенстве — сравнение % HP. */
const PVP_MAX_ROUNDS = 20;

/** Таймаут выбора хода (мс) — для live UI; AI не ждёт. */
const PVP_TURN_TIMEOUT_MS = 20000;

/**
 * Типы эффектов пассивов, влияющие на CombatSheet.
 * Экономика фарма (adena/xp/zone) сюда не входит.
 */
const PVP_PASSIVE_EFFECT_TYPES = {
  matkAdd: "add",
  patkAdd: "add",
  pdefAdd: "add",
  mdefAdd: "add",
  pvpAtkMult: "mult",
  pvpDefMult: "mult",
  pvpHpAdd: "add",
  pvpCritChance: "add",
};

/**
 * Дефолтный remap farm-effect → PvP.
 * cdRounds / debuff* можно переопределить по skill id в PVP_SKILL_CD_ROUNDS.
 */
const PVP_EFFECT_REMAP = {
  nextHit: { pvpEffect: "nextHit", cdRounds: 2 },
  directHit: { pvpEffect: "directHit", cdRounds: 2 },
  multiHit: { pvpEffect: "multiHit", cdRounds: 3 },
  damageBuff: { pvpEffect: "damageBuff", buffRounds: 3, cdRounds: 4 },
  timerSlow: {
    pvpEffect: "atkDebuff",
    debuffMult: 0.7,
    debuffRounds: 1,
    cdRounds: 3,
  },
  timerFreeze: {
    pvpEffect: "atkDebuff",
    debuffMult: 0.7,
    debuffRounds: 1,
    cdRounds: 3,
  },
  freezeMulti: {
    pvpEffect: "freezeMulti",
    debuffMult: 0.7,
    debuffRounds: 1,
    cdRounds: 3,
  },
  drainHit: { pvpEffect: "drainHit", healFrac: 0.15, cdRounds: 4 },
};

/** CD в раундах по id скилла (перекрывает дефолт remap). */
const PVP_SKILL_CD_ROUNDS = {
  power_strike: 2,
  iron_shell: 3,
  cleave: 3,
  blood_rage: 4,
  soul_burst: 2,
  arcane_focus: 4,
  ice_shackles: 3,
  soul_drain: 4,
  totem_strike: 2,
  ancestral_guard: 3,
  blood_pulse: 3,
  paagrio_gift: 4,
};

/** Подписи действий для лога. */
const PVP_ACTION_LABELS = {
  attack: "Атака",
  guard: "Защита",
  skill: "Скилл",
};
