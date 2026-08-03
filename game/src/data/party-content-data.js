// ===== Парти-контент: зоны охоты, инстансы, баланс =====
// Shared formulas: partyAdenaMult, partyHitIntervalMs, partyFarmHp, partyDailyCapMs.

const PARTY_CONTENT = {
  version: 1,
  minMembers: 2,
  maxMembers: 4,
  /** Бонус адена за каждого участника сверх 1 (кап на 4). */
  adenaBonusPerExtra: 0.08,
  /** Hit throttle ≈ автоудар. */
  hitIntervalMs: 150,
  /** Soft-cap эффективного фарма / сутки (мс), на аккаунт. */
  farmDailyCapMs: 75 * 60 * 1000,
  /** HP моба party-farm: hitsToKill * clickDmg * members^scale */
  farmHpHits: { normal: 10, golden: 16, elite: 22 },
  farmHpMemberScale: 0.55,
  /** Adena с килла (до party mult и rewardScale зоны), якорь ~гл.II–III. */
  farmAdena: { normal: { min: 4200, max: 9800 }, golden: { min: 24000, max: 56000 }, elite: { min: 9000, max: 18000 } },
  farmSoulOreChance: 0.12,
  farmSoulOreQty: { min: 1, max: 2 },
  /** Инстанс. */
  instance: {
    runTimeoutMs: 15 * 60 * 1000,
    lives: 3,
    hitIntervalMs: 150,
    /** 0 = без weekly-лимита (тест / открытый сезон). */
    weeklyClears: 0,
    readyTimeoutMs: 60 * 1000,
    /** Множитель HP/камней инстанса. 1 = прод; <1 только для локальных тестов. */
    testHpScale: 1,
  },
};

/** Групповые зоны охоты отключены — контент группы = инстансы + мировой босс. */
const PARTY_FARM_ZONES = [];

/** Часовой пояс расписания мировых боссов (МСК, без DST). */
const WORLD_BOSS_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const WORLD_BOSS_TZ_LABEL = "МСК";

/** Анти-автоклик на арене: свайп-проверка каждые N ударов. Рейтинг — по урону. */
const WORLD_BOSS_SWIPE = {
  minClicks: 100,
  maxClicks: 150,
  maxFails: 3,
  /** Лимит на прохождение полосы (мс). */
  timeLimitMs: 6500,
  /** Кап урона за один принятый удар (античит). */
  hitDmgMax: 50000,
};

/**
 * Мировые боссы: соло-рейс по кликам.
 * Старт по чётности часа МСК: чётные — Queen Ant, нечётные — Закен.
 * Окно боя — первые windowMs часа.
 */
const WORLD_BOSSES = [
  {
    id: "world_zaken",
    name: "Закен",
    hourParity: "odd",
    windowMs: 5 * 60 * 1000,
    cooldownMs: 55 * 60 * 1000,
    mob: "zaken",
    reqLevel: 3,
    cosmeticHp: 10_000_000,
    loot: {
      places: {
        1: { accessoryId: "zaken_earring" },
        2: { shards: { id: "zaken_earring_shard", qty: 1 } },
        3: { shards: { id: "zaken_earring_shard", qty: 1 } },
      },
    },
    lootBlurb: "1 место — Серьга Закена · 2–3 — осколки (10 шт + 10ккк adena в мастерской)",
    mine: {
      bgs: ["assets/locations/zaken-pirate-cave.jpg"],
      overlay: "mine-zone-elven",
      spawnMs: 999999,
      goldenChance: 0,
      rewardScale: 1,
      title: "Закен",
      hint: "Пиратский корабль в пещере · только реальные клики! Автоудар и умения не считаются.",
    },
    ui: {
      cardBg: "assets/ui/world-boss-card-zaken.png",
      accent: "#3d9e8c",
    },
  },
  {
    id: "world_queen_ant",
    name: "Королева Муравьёв",
    hourParity: "even",
    windowMs: 5 * 60 * 1000,
    cooldownMs: 55 * 60 * 1000,
    mob: "queen-ant",
    reqLevel: 3,
    cosmeticHp: 10_000_000,
    loot: {
      places: {
        1: { accessoryId: "queen_ant_ring" },
        2: { shards: { id: "queen_ant_ring_shard", qty: 1 } },
        3: { shards: { id: "queen_ant_ring_shard", qty: 1 } },
      },
    },
    lootBlurb: "1 место — Кольцо Королевы Муравьёв · 2–3 — осколки (10 шт + 10ккк adena в мастерской)",
    mine: {
      bgs: ["assets/locations/queen-ant-nest.jpg"],
      overlay: "mine-zone-elven",
      spawnMs: 999999,
      goldenChance: 0,
      rewardScale: 1,
      title: "Королева Муравьёв",
      hint: "Муравейник · только реальные клики! Автоудар и умения не считаются.",
    },
    ui: {
      cardBg: "assets/ui/world-boss-card-queen-ant.png?v=4",
      accent: "#c45a3d",
    },
  },
];

/** Совместимость: основной alias = Закен. */
const WORLD_BOSS = WORLD_BOSSES[0];

function worldBossById(id) {
  const key = String(id || "");
  return WORLD_BOSSES.find((b) => b.id === key) || null;
}

function worldBossMskParts(now) {
  const shifted = new Date((Number(now) || Date.now()) + WORLD_BOSS_TZ_OFFSET_MS);
  return {
    hour: shifted.getUTCHours(),
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
  };
}

/** Начало текущего часа МСК (epoch ms). */
function worldBossHourStartMs(now) {
  const p = worldBossMskParts(now);
  return Date.UTC(p.y, p.m, p.d, p.hour) - WORLD_BOSS_TZ_OFFSET_MS;
}

function worldBossParityForHour(hour) {
  return (Math.floor(Number(hour) || 0) % 2 === 0) ? "even" : "odd";
}

function worldBossForParity(parity) {
  const p = parity === "even" ? "even" : "odd";
  return WORLD_BOSSES.find((b) => b.hourParity === p) || WORLD_BOSSES[0];
}

/** Босс слота текущего часа МСК. */
function worldBossForNow(now) {
  const hour = worldBossMskParts(now).hour;
  return worldBossForParity(worldBossParityForHour(hour));
}

/** Следующий старт окна для конкретного босса (начало его часа МСК). */
function worldBossNextStartMs(bossId, now) {
  const boss = worldBossById(bossId) || WORLD_BOSS;
  const wantEven = boss.hourParity === "even";
  const cur = Number(now) || Date.now();
  let t = worldBossHourStartMs(cur);
  for (let i = 0; i < 48; i++) {
    const hour = worldBossMskParts(t).hour;
    const match = (hour % 2 === 0) === wantEven;
    if (match) {
      if (cur < t) return t;
      // Текущий/прошедший слот этого босса → через 2 часа.
      return t + 2 * 60 * 60 * 1000;
    }
    t += 60 * 60 * 1000;
  }
  return t;
}

function worldBossParityLabel(parity) {
  return parity === "even" ? "чётные часы" : "нечётные часы";
}

/**
 * Ближайший слот: активное окно текущего часа или следующий старт среди боссов.
 * @returns {{ boss: object, status: "active"|"upcoming", at: number, endsAt?: number, remainingMs: number }}
 */
function worldBossUpcoming(now) {
  const cur = Number(now) || Date.now();
  const hourStart = worldBossHourStartMs(cur);
  const current = worldBossForNow(cur);
  const windowMs = current.windowMs || 5 * 60 * 1000;
  const endsAt = hourStart + windowMs;
  if (cur >= hourStart && cur < endsAt) {
    return {
      boss: current,
      status: "active",
      at: hourStart,
      endsAt,
      remainingMs: Math.max(0, endsAt - cur),
    };
  }
  let best = null;
  const list = Array.isArray(WORLD_BOSSES) ? WORLD_BOSSES : [WORLD_BOSS];
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (!b) continue;
    const at = worldBossNextStartMs(b.id, cur);
    if (!best || at < best.at) {
      best = {
        boss: b,
        status: "upcoming",
        at,
        remainingMs: Math.max(0, at - cur),
      };
    }
  }
  return (
    best || {
      boss: current,
      status: "upcoming",
      at: hourStart + 60 * 60 * 1000,
      remainingMs: Math.max(0, hourStart + 60 * 60 * 1000 - cur),
    }
  );
}

/** Инстансы: 5 волн (паки мобов) → босс с механиками под саппортов. */
const INSTANCE_ARMOR_SET_PIECES = {
  bone: ["bone_helmet", "bone_breastplate", "bone_gaiters", "bone_gloves", "bone_boots"],
  brigandine: ["brigandine_helmet", "brigandine_breastplate", "brigandine_gaiters", "brigandine_gloves", "brigandine_boots"],
  manticore: ["manticore_helmet", "manticore_mail", "manticore_gaiters", "manticore_gloves", "manticore_boots"],
  reinforced: ["reinforced_helmet", "reinforced_shirt", "reinforced_gaiters", "reinforced_gloves", "reinforced_boots"],
  elven_mithril: ["elven_mithril_circlet", "elven_mithril_tunic", "elven_mithril_hose", "elven_mithril_gloves", "elven_mithril_boots"],
  knowledge: ["knowledge_circlet", "knowledge_tunic", "knowledge_hose", "knowledge_gloves", "knowledge_boots"],
  mithril: ["mithril_helmet", "mithril_breastplate", "mithril_gaiters", "mithril_gloves", "mithril_boots"],
  chain: ["chain_helmet", "chain_mail", "chain_gaiters", "chain_gloves", "chain_boots"],
  karmian: ["karmian_circlet", "karmian_tunic", "karmian_hose", "karmian_gloves", "karmian_boots"],
  tempered: ["tempered_helmet", "tempered_shirt", "tempered_gaiters", "tempered_gloves", "tempered_boots"],
  theca: ["theca_helmet", "theca_mail", "theca_gaiters", "theca_gloves", "theca_boots"],
  plated: ["plated_helmet", "plated_mail", "plated_gaiters", "plated_gloves", "plated_boots"],
  composite: ["composite_helmet", "composite_armor", "composite_gaiters", "composite_gloves", "composite_boots"],
  full_plate: ["full_plate_helmet", "full_plate_armor", "full_plate_gaiters", "full_plate_gloves", "full_plate_boots"],
  drake: ["drake_helmet", "drake_mail", "drake_gaiters", "drake_gloves", "drake_boots"],
  divine: ["divine_circlet", "divine_tunic", "divine_hose", "divine_gloves", "divine_boots"],
  demon: ["demon_circlet", "demon_tunic", "demon_hose", "demon_gloves", "demon_boots"],
};

const PARTY_DUNGEONS = [
  {
    id: "dungeon_alpha",
    name: "Ущелье Багрового Воя",
    desc: "5 волн · босс Кровавый Вой · от 15 ур.",
    reqLevel: 15,
    reqPower: 220,
    chapter: 3,
    weeklyClears: 0,
    lives: 3,
    runTimeoutMs: 18 * 60 * 1000,
    waveIdleMs: 22 * 1000,
    mine: {
      bgs: ["assets/locations/crimson-howl-gorge.jpg"],
      overlay: "mine-zone-elven",
      title: "Ущелье Багрового Воя",
      hint: "Паки стаи · щит/реген босса · старт после готовности",
    },
    ui: {
      cardBg: "assets/ui/party-card-crimson.png",
      accent: "#c45a5a",
    },
    waves: [
      { type: "normal", count: 2, hpHits: 18, name: "Пепельный пёс", mob: "ash-hound" },
      { type: "normal", count: 2, hpHits: 20, name: "Костяной стрелок", mob: "bone-raider" },
      { type: "elite", count: 3, hpHits: 19, name: "Багровый ловчий", mob: "crimson-stalker" },
      { type: "elite", count: 3, hpHits: 22, name: "Сумеречный клык", mob: "dusk-fang" },
      { type: "elite", count: 2, hpHits: 28, name: "Железная пасть", mob: "iron-maw" },
    ],
    boss: {
      name: "Кровавый Вой",
      mob: "bloodhowl-alpha",
      hpHits: 120,
      enrageMs: 90 * 1000,
      regenPulseMs: 2000,
      regenPct: 0.05,
      phases: [
        { at: 1.0, label: "Ярость", toughness: 1 },
        { at: 0.7, label: "Барьер крови", toughness: 1.25, shieldStones: 3, stoneHits: 48 },
        { at: 0.4, label: "Регенерация", toughness: 1.35, regen: true },
        { at: 0.2, label: "Бешенство", toughness: 1.6, regen: true },
      ],
    },
    loot: {
      adena: { min: 780_000, max: 1_250_000 },
      soul: { min: 16, max: 28 },
      spirit: { min: 10, max: 20 },
      xp: { min: 900, max: 1400 },
      weaponGrade: "D",
      armorPiecesMax: 2,
      armorSetPool: ["bone", "brigandine", "manticore", "reinforced", "elven_mithril", "knowledge"],
    },
  },
  {
    id: "dungeon_catacomb",
    name: "Некрополь Шепота",
    desc: "5 волн · босс Хранитель Шепота · от 20 ур.",
    reqLevel: 20,
    reqPower: 300,
    chapter: 4,
    weeklyClears: 0,
    lives: 3,
    runTimeoutMs: 19 * 60 * 1000,
    waveIdleMs: 21 * 1000,
    mine: {
      bgs: ["assets/locations/whisper-necropolis.jpg"],
      overlay: "mine-zone-elven",
      title: "Некрополь Шепота",
      hint: "Катакомбы · адды mid-fight · старт после готовности",
    },
    ui: {
      cardBg: "assets/ui/party-card-necropolis.png",
      accent: "#5a8a9a",
    },
    waves: [
      { type: "normal", count: 2, hpHits: 22, name: "Склеповый скарабей", mob: "crypt-scarab" },
      { type: "normal", count: 2, hpHits: 24, name: "Аколит Печати", mob: "seal-acolyte" },
      { type: "elite", count: 3, hpHits: 23, name: "Костяной страж", mob: "bone-sentinel" },
      { type: "elite", count: 3, hpHits: 26, name: "Тень нефилима", mob: "nephilim-shade" },
      { type: "elite", count: 2, hpHits: 32, name: "Хранитель гробницы", mob: "tomb-warden" },
    ],
    boss: {
      name: "Хранитель Шепота",
      mob: "whisper-keeper",
      hpHits: 145,
      enrageMs: 100 * 1000,
      regenPulseMs: 2000,
      regenPct: 0.05,
      phases: [
        { at: 1.0, label: "Шёпот катакомб", toughness: 1.1 },
        {
          at: 0.7,
          label: "Восстание мёртвых",
          toughness: 1.3,
          mechanic: "adds",
          addCount: 3,
          addHpHits: 34,
          addMob: "whisper-shade",
          addName: "Тень шепота",
          addsDeadlineMs: 18000,
        },
        {
          at: 0.4,
          label: "Легион склепа",
          toughness: 1.45,
          mechanic: "adds",
          addCount: 3,
          addHpHits: 42,
          addMob: "whisper-shade",
          addName: "Тень шепота",
          addsDeadlineMs: 15000,
        },
        { at: 0.2, label: "Песнь праха", toughness: 1.7, regen: true },
      ],
    },
    loot: {
      adena: { min: 1_200_000, max: 1_900_000 },
      soul: { min: 22, max: 36 },
      spirit: { min: 14, max: 26 },
      xp: { min: 1500, max: 2250 },
      weaponGrade: "D",
      armorPiecesMax: 2,
      armorSetPool: ["mithril", "chain", "brigandine", "manticore", "reinforced", "elven_mithril"],
    },
  },
  {
    id: "dungeon_depths",
    name: "Чертог Расплавленных Сердец",
    desc: "5 волн · босс Тиран Кузни · от 30 ур.",
    reqLevel: 30,
    reqPower: 450,
    chapter: 5,
    weeklyClears: 0,
    lives: 3,
    runTimeoutMs: 20 * 60 * 1000,
    waveIdleMs: 20 * 1000,
    mine: {
      bgs: ["assets/locations/molten-heart-hall.jpg"],
      overlay: "mine-zone-dwarf",
      title: "Чертог Расплавленных Сердец",
      hint: "Недра кузни · наковальня/реген босса · старт после готовности",
    },
    ui: {
      cardBg: "assets/ui/party-card-molten.png",
      accent: "#e08a3a",
    },
    waves: [
      { type: "normal", count: 2, hpHits: 28, name: "Шлаковый призрак", mob: "slag-wraith" },
      { type: "elite", count: 3, hpHits: 30, name: "Магмовый страж", mob: "magma-sentinel" },
      { type: "elite", count: 3, hpHits: 32, name: "Ползун бездны", mob: "void-crawler" },
      { type: "elite", count: 3, hpHits: 34, name: "Ужас углей", mob: "ember-horror" },
      { type: "elite", count: 2, hpHits: 42, name: "Колосс врат", mob: "gate-colossus" },
    ],
    boss: {
      name: "Тиран Кузни",
      mob: "forge-tyrant",
      hpHits: 185,
      enrageMs: 110 * 1000,
      regenPulseMs: 2000,
      regenPct: 0.05,
      phases: [
        { at: 1.0, label: "Каменная кожа", toughness: 1.1 },
        {
          at: 0.85,
          label: "Наковальня I",
          toughness: 1.25,
          mechanic: "anvil",
          anvilMarks: 6,
          anvilGoal: 90,
          anvilWindowMs: 3200,
          anvilCycleMs: 5200,
          anvilFailMax: 12,
        },
        {
          at: 0.65,
          label: "Наковальня II",
          toughness: 1.4,
          mechanic: "anvil",
          anvilMarks: 6,
          anvilGoal: 108,
          anvilWindowMs: 2600,
          anvilCycleMs: 4300,
          anvilFailMax: 11,
        },
        {
          at: 0.45,
          label: "Наковальня III",
          toughness: 1.55,
          mechanic: "anvil",
          anvilMarks: 6,
          anvilGoal: 126,
          anvilWindowMs: 2100,
          anvilCycleMs: 3600,
          anvilFailMax: 10,
        },
        { at: 0.22, label: "Пульс магмы", toughness: 1.65, regen: true },
        { at: 0.1, label: "Гнев недр", toughness: 1.9, regen: true },
      ],
    },
    loot: {
      adena: { min: 2_400_000, max: 3_800_000 },
      soul: { min: 32, max: 52 },
      spirit: { min: 20, max: 36 },
      xp: { min: 2750, max: 4000 },
      weaponGrade: "C",
      armorPiecesMax: 2,
      armorSetPool: ["tempered", "karmian", "theca", "plated", "drake"],
    },
  },
  {
    id: "dungeon_spire",
    name: "Шпиль Безмолвия",
    desc: "5 волн · босс Глас Шпиля · от 35 ур.",
    reqLevel: 35,
    reqPower: 550,
    chapter: 5,
    weeklyClears: 0,
    lives: 3,
    runTimeoutMs: 22 * 60 * 1000,
    waveIdleMs: 18 * 1000,
    mine: {
      bgs: ["assets/locations/silence-spire.jpg"],
      overlay: "mine-zone-dwarf",
      title: "Шпиль Безмолвия",
      hint: "Башня · канал босса прерывай скиллом · старт после готовности",
    },
    ui: {
      cardBg: "assets/ui/party-card-spire.png",
      accent: "#7a6ab8",
    },
    waves: [
      { type: "normal", count: 2, hpHits: 32, name: "Рунный горгул", mob: "rune-gargoyle" },
      { type: "elite", count: 3, hpHits: 34, name: "Адепт Шпиля", mob: "spire-adept" },
      { type: "elite", count: 3, hpHits: 36, name: "Зеркальный голем", mob: "mirror-golem" },
      { type: "elite", count: 3, hpHits: 38, name: "Магический страж", mob: "arcane-ward" },
      { type: "elite", count: 2, hpHits: 46, name: "Эхо Халлата", mob: "hallate-echo" },
    ],
    boss: {
      name: "Глас Шпиля",
      mob: "spire-voice",
      hpHits: 220,
      enrageMs: 120 * 1000,
      regenPulseMs: 2000,
      regenPct: 0.045,
      phases: [
        { at: 1.0, label: "Каменный гимн", toughness: 1.15 },
        {
          at: 0.75,
          label: "Песнь Безмолвия",
          toughness: 1.35,
          mechanic: "channel",
          channelWindowMs: 3200,
          channelCycleMs: 7500,
          channelFailMax: 3,
        },
        {
          at: 0.5,
          label: "Хор рун",
          toughness: 1.5,
          mechanic: "channel",
          channelWindowMs: 2600,
          channelCycleMs: 6200,
          channelFailMax: 3,
        },
        {
          at: 0.25,
          label: "Глас бездны",
          toughness: 1.7,
          mechanic: "channel",
          channelWindowMs: 2200,
          channelCycleMs: 5500,
          channelFailMax: 2,
          regen: true,
        },
        { at: 0.1, label: "Безмолвный гнев", toughness: 2.0, regen: true },
      ],
    },
    loot: {
      adena: { min: 4_000_000, max: 6_500_000 },
      soul: { min: 42, max: 68 },
      spirit: { min: 28, max: 48 },
      xp: { min: 4000, max: 6000 },
      weaponGrade: "C",
      armorPiecesMax: 2,
      armorSetPool: ["composite", "full_plate", "drake", "divine", "demon"],
    },
  },
];

function instanceArmorPiecesForSet(setId) {
  return (INSTANCE_ARMOR_SET_PIECES[setId] || []).slice();
}

function partyShuffle(arr) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/** До maxPieces случайных кусков из случайного сета пула (не полный сет). */
function instancePickArmorPieces(setPool, maxPieces) {
  const cap = Math.max(0, Math.min(2, Math.floor(Number(maxPieces) || 0)));
  const pool = Array.isArray(setPool) ? setPool.filter(Boolean) : [];
  if (!pool.length || cap <= 0) return { setId: null, armorIds: [] };
  const setId = pool[Math.floor(Math.random() * pool.length)];
  const ids = partyShuffle(instanceArmorPiecesForSet(setId)).slice(0, cap);
  return { setId: ids.length ? setId : null, armorIds: ids };
}

function partyRollRange(range) {
  const lo = Math.max(0, Math.floor(Number(range?.min) || 0));
  const hi = Math.max(lo, Math.floor(Number(range?.max) || lo));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
function partyAdenaMult(memberCount) {
  const n = Math.max(1, Math.min(PARTY_CONTENT.maxMembers, Math.floor(Number(memberCount) || 1)));
  return 1 + PARTY_CONTENT.adenaBonusPerExtra * (n - 1);
}

function partyHitIntervalMs() {
  return PARTY_CONTENT.hitIntervalMs || 150;
}

function partyFarmDailyCapMs(zone) {
  const min = zone && zone.dailyCapMin != null ? zone.dailyCapMin : 75;
  return Math.max(15, min) * 60 * 1000;
}

function partyFarmZoneById(id) {
  return PARTY_FARM_ZONES.find((z) => z.id === id) || null;
}

function partyDungeonById(id) {
  return PARTY_DUNGEONS.find((d) => d.id === id) || null;
}

/** Эталонный click-dmg от targetPower зоны (как mineZoneRefClickDamage). */
function partyRefClickDamage(zoneOrDungeon) {
  const target = Math.max(1, Number(zoneOrDungeon?.targetPower || zoneOrDungeon?.reqPower || 80));
  const chapter = Math.max(1, Number(zoneOrDungeon?.chapter || 1));
  const raw = target * 0.48 * (1 + (chapter - 1) * 0.09);
  return Math.max(4, Math.round(raw / 4.2));
}

function partyFarmMobMaxHp(type, zone, memberCount) {
  const hitsTable = PARTY_CONTENT.farmHpHits || {};
  const hits = hitsTable[type] || hitsTable.normal || 10;
  const click = partyRefClickDamage(zone);
  const n = Math.max(1, Math.min(4, Math.floor(Number(memberCount) || 1)));
  const scale = 1 + (n - 1) * (PARTY_CONTENT.farmHpMemberScale || 0.55);
  return Math.max(20, Math.round(click * hits * scale));
}

function partyInstanceHpScale() {
  const s = Number(PARTY_CONTENT.instance && PARTY_CONTENT.instance.testHpScale);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

function partyInstanceMobMaxHp(waveOrBoss, dungeon, memberCount, snapshotPowers) {
  const hits = Math.max(4, Number(waveOrBoss?.hpHits) || 12);
  let click = partyRefClickDamage(dungeon);
  if (Array.isArray(snapshotPowers) && snapshotPowers.length) {
    const avg = snapshotPowers.reduce((s, p) => s + Math.max(1, Number(p) || 1), 0) / snapshotPowers.length;
    click = Math.max(4, Math.round(avg / 4.2));
  }
  const n = Math.max(1, Math.min(4, Math.floor(Number(memberCount) || 1)));
  const scale = 1 + (n - 1) * 0.5;
  const hpScale = partyInstanceHpScale();
  const floor = hpScale < 1 ? 6 : 40;
  return Math.max(floor, Math.round(click * hits * scale * hpScale));
}

function partyInstanceStoneHits(phase) {
  const base = Math.max(5, Math.floor(Number(phase?.stoneHits || phase?.shieldHits) || 40));
  const scaled = Math.round(base * partyInstanceHpScale());
  return Math.max(2, scaled);
}

function partyInstanceAnvilGoal(phase) {
  const base = Math.max(8, Math.floor(Number(phase?.anvilGoal) || 48));
  const scaled = Math.round(base * partyInstanceHpScale());
  return Math.max(4, scaled);
}

function partyInstanceAnvilFailMax(phase, memberCount) {
  const base = Math.max(4, Math.floor(Number(phase?.anvilFailMax) || 10));
  const n = Math.max(1, Math.min(6, Math.floor(Number(memberCount) || 1)));
  // Чуть мягче в большой пати
  return Math.max(6, base + Math.max(0, n - 2));
}

const ANVIL_PLAYER_COLORS = ["#ff5a5a", "#4da3ff", "#5dff8a", "#ffd24a", "#d48cff", "#ff9a3c"];

function partyAnvilPlayerColor(index) {
  return ANVIL_PLAYER_COLORS[Math.max(0, Math.floor(Number(index) || 0)) % ANVIL_PLAYER_COLORS.length];
}

function partyRollAdena(range, mult, rewardScale) {
  const lo = Math.max(1, Math.floor(Number(range?.min) || 1));
  const hi = Math.max(lo, Math.floor(Number(range?.max) || lo));
  const base = lo + Math.floor(Math.random() * (hi - lo + 1));
  const m = Math.max(0.1, Number(mult) || 1);
  const rs = Math.max(0.1, Number(rewardScale) || 1);
  return Math.max(1, Math.round(base * m * rs));
}

function partyUtcDayKey(now) {
  const d = new Date(Number(now) || Date.now());
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

function partyUtcWeekKey(now) {
  const d = new Date(Number(now) || Date.now());
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return thursday.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

if (typeof window !== "undefined") {
  window.PARTY_CONTENT = PARTY_CONTENT;
  window.PARTY_FARM_ZONES = PARTY_FARM_ZONES;
  window.PARTY_DUNGEONS = PARTY_DUNGEONS;
  window.WORLD_BOSS = WORLD_BOSS;
  window.WORLD_BOSSES = WORLD_BOSSES;
  window.WORLD_BOSS_TZ_LABEL = WORLD_BOSS_TZ_LABEL;
  window.WORLD_BOSS_SWIPE = WORLD_BOSS_SWIPE;
  window.worldBossById = worldBossById;
  window.worldBossForNow = worldBossForNow;
  window.worldBossHourStartMs = worldBossHourStartMs;
  window.worldBossNextStartMs = worldBossNextStartMs;
  window.worldBossParityLabel = worldBossParityLabel;
  window.worldBossUpcoming = worldBossUpcoming;
  window.partyAdenaMult = partyAdenaMult;
  window.partyHitIntervalMs = partyHitIntervalMs;
  window.partyFarmDailyCapMs = partyFarmDailyCapMs;
  window.partyFarmZoneById = partyFarmZoneById;
  window.partyDungeonById = partyDungeonById;
  window.partyRefClickDamage = partyRefClickDamage;
  window.partyFarmMobMaxHp = partyFarmMobMaxHp;
  window.partyInstanceMobMaxHp = partyInstanceMobMaxHp;
  window.partyInstanceHpScale = partyInstanceHpScale;
  window.partyInstanceStoneHits = partyInstanceStoneHits;
  window.partyInstanceAnvilGoal = partyInstanceAnvilGoal;
  window.partyInstanceAnvilFailMax = partyInstanceAnvilFailMax;
  window.partyAnvilPlayerColor = partyAnvilPlayerColor;
  window.ANVIL_PLAYER_COLORS = ANVIL_PLAYER_COLORS;
  window.partyRollAdena = partyRollAdena;
  window.partyRollRange = partyRollRange;
  window.instanceArmorPiecesForSet = instanceArmorPiecesForSet;
  window.instancePickArmorPieces = instancePickArmorPieces;
  window.partyShuffle = partyShuffle;
  window.INSTANCE_ARMOR_SET_PIECES = INSTANCE_ARMOR_SET_PIECES;
  window.partyUtcDayKey = partyUtcDayKey;
  window.partyUtcWeekKey = partyUtcWeekKey;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PARTY_CONTENT,
    PARTY_FARM_ZONES,
    PARTY_DUNGEONS,
    WORLD_BOSS,
    WORLD_BOSSES,
    WORLD_BOSS_TZ_OFFSET_MS,
    WORLD_BOSS_TZ_LABEL,
    WORLD_BOSS_SWIPE,
    worldBossById,
    worldBossForNow,
    worldBossHourStartMs,
    worldBossNextStartMs,
    worldBossParityLabel,
    worldBossUpcoming,
    worldBossParityForHour,
    worldBossForParity,
    worldBossMskParts,
    INSTANCE_ARMOR_SET_PIECES,
    partyAdenaMult,
    partyHitIntervalMs,
    partyFarmDailyCapMs,
    partyFarmZoneById,
    partyDungeonById,
    partyRefClickDamage,
    partyFarmMobMaxHp,
    partyInstanceMobMaxHp,
    partyInstanceHpScale,
    partyInstanceStoneHits,
    partyInstanceAnvilGoal,
    partyInstanceAnvilFailMax,
    partyAnvilPlayerColor,
    ANVIL_PLAYER_COLORS,
    partyRollAdena,
    partyRollRange,
    instanceArmorPiecesForSet,
    instancePickArmorPieces,
    partyShuffle,
    partyUtcDayKey,
    partyUtcWeekKey,
  };
}
