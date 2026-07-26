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

/** Глобальный мировой босс: соло-рейс по кликам. */
const WORLD_BOSS = {
  id: "world_zaken",
  name: "Закен",
  /** Окно 5 мин раз в час (пауза 55 мин → цикл 60 мин). Босс без локального таймера исчезновения. */
  windowMs: 5 * 60 * 1000,
  cooldownMs: 55 * 60 * 1000,
  mob: "zaken",
  reqLevel: 3,
  cosmeticHp: 10_000_000,
  /** Награды по месту (1–3). Крафт серьги — из осколков (см. ACCESSORY_CRAFT). */
  loot: {
    places: {
      1: { accessoryId: "zaken_earring" },
      2: { shards: { id: "zaken_earring_shard", qty: 1 } },
      3: { shards: { id: "zaken_earring_shard", qty: 1 } },
    },
  },
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
};

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
};

const PARTY_DUNGEONS = [
  {
    id: "dungeon_alpha",
    name: "Ущелье Багрового Воя",
    desc: "5 волн · босс Кровавый Вой",
    reqLevel: 3,
    reqPower: 70,
    chapter: 2,
    weeklyClears: 0,
    lives: 3,
    runTimeoutMs: 18 * 60 * 1000,
    waveIdleMs: 22 * 1000,
    mine: {
      bgs: ["assets/locations/crimson-howl-gorge.jpg"],
      overlay: "mine-zone-elven",
      title: "Ущелье Багрового Воя",
      hint: "Паки стаи · щит/реген босса · старт только с Ready",
    },
    ui: {
      cardBg: "assets/ui/party-card-crimson.png",
      accent: "#c45a5a",
    },
    waves: [
      { type: "normal", count: 2, hpHits: 14, name: "Пепельный пёс", mob: "ash-hound" },
      { type: "normal", count: 2, hpHits: 16, name: "Костяной стрелок", mob: "bone-raider" },
      { type: "elite", count: 3, hpHits: 15, name: "Багровый ловчий", mob: "crimson-stalker" },
      { type: "elite", count: 3, hpHits: 18, name: "Сумеречный клык", mob: "dusk-fang" },
      { type: "elite", count: 2, hpHits: 24, name: "Железная пасть", mob: "iron-maw" },
    ],
    boss: {
      name: "Кровавый Вой",
      mob: "bloodhowl-alpha",
      hpHits: 96,
      enrageMs: 90 * 1000,
      regenPulseMs: 2000,
      regenPct: 0.05,
      phases: [
        { at: 1.0, label: "Ярость", toughness: 1 },
        { at: 0.7, label: "Барьер крови", toughness: 1.25, shieldStones: 3, stoneHits: 40 },
        { at: 0.4, label: "Регенерация", toughness: 1.35, regen: true },
        { at: 0.2, label: "Бешенство", toughness: 1.6, regen: true },
      ],
    },
    loot: {
      adena: { min: 420_000, max: 720_000 },
      soul: { min: 12, max: 24 },
      spirit: { min: 8, max: 16 },
      xp: { min: 3600, max: 5600 },
      weaponGrade: "D",
      armorPiecesMax: 2,
      armorSetPool: ["bone", "brigandine", "manticore", "reinforced", "elven_mithril", "knowledge"],
    },
  },
  {
    id: "dungeon_depths",
    name: "Чертог Расплавленных Сердец",
    desc: "5 волн · босс Тиран Кузни",
    reqLevel: 8,
    reqPower: 180,
    chapter: 4,
    weeklyClears: 0,
    lives: 3,
    runTimeoutMs: 20 * 60 * 1000,
    waveIdleMs: 20 * 1000,
    mine: {
      bgs: ["assets/locations/molten-heart-hall.jpg"],
      overlay: "mine-zone-dwarf",
      title: "Чертог Расплавленных Сердец",
      hint: "Недра кузни · наковальня/реген босса · старт только с Ready",
    },
    ui: {
      cardBg: "assets/ui/party-card-molten.png",
      accent: "#e08a3a",
    },
    waves: [
      { type: "normal", count: 2, hpHits: 18, name: "Шлаковый призрак", mob: "slag-wraith" },
      { type: "elite", count: 3, hpHits: 20, name: "Магмовый страж", mob: "magma-sentinel" },
      { type: "elite", count: 3, hpHits: 22, name: "Ползун бездны", mob: "void-crawler" },
      { type: "elite", count: 3, hpHits: 24, name: "Ужас углей", mob: "ember-horror" },
      { type: "elite", count: 2, hpHits: 30, name: "Колосс врат", mob: "gate-colossus" },
    ],
    boss: {
      name: "Тиран Кузни",
      mob: "forge-tyrant",
      hpHits: 140,
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
          anvilGoal: 80,
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
          anvilGoal: 96,
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
          anvilGoal: 112,
          anvilWindowMs: 2100,
          anvilCycleMs: 3600,
          anvilFailMax: 10,
        },
        { at: 0.22, label: "Пульс магмы", toughness: 1.65, regen: true },
        { at: 0.1, label: "Гнев недр", toughness: 1.9, regen: true },
      ],
    },
    loot: {
      adena: { min: 980_000, max: 1_650_000 },
      soul: { min: 20, max: 38 },
      spirit: { min: 12, max: 26 },
      xp: { min: 9800, max: 14800 },
      weaponGrade: "C",
      armorPiecesMax: 2,
      armorSetPool: ["mithril", "chain", "tempered", "karmian"],
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
