// ===== Бижутерия D/C: вики jewelry sets + крафт/дроп =====
// Эпики (Zaken/Baium/…) остаются в COLLECTIBLES (enchant-balance.js).
// Обычка: mdef + skillCdMult / debuffResist для разнообразия билдов.

/** Side-зоны фарма кусков бижутерии — разведены по охоте.
 *  C только на зонах L2 30+ (см. farmZoneLootBand). */
const JEWELRY_FRAG_ZONES = {
  wasteland: ["elven"],
  windmill_hill: ["elven"],
  partisans_hideaway: ["elven"],
  school_of_dark_arts: ["darkness"],
  neutral_zone: ["darkness"],
  cruma_marshlands: ["aquastone"],
  execution_grounds: ["protection"],
  floran_agricultural: ["protection"],
  alligator_island: ["mermaid"],
  enchanted_valley: ["mermaid"],
  gorgon_flower_garden: ["binding"],
  sea_of_spores: ["binding"],
};

/** Шансы куска (ниже брони: меньше слотов, но earring/ring крафтятся ×2). */
const JEWELRY_FRAG_DROP = {
  normal: 0.08,
  golden: 0.32,
  boss: 0.72,
  qtyNormal: [1, 1],
  qtyGolden: [1, 2],
  qtyBoss: [2, 3],
};

/** Кап CDR с бижу (мультипликатор КД, ниже = быстрее). Пассивы × jewelry. */
const JEWELRY_SKILL_CD_FLOOR = 0.82;
/** Кап суммарного debuffResist с бижу. */
const JEWELRY_DEBUFF_RESIST_CAP = 0.32;

/**
 * Куски обычной бижутерии.
 * bonuses.skillCdMult — множитель длительности КД (0.99 = −1%).
 * bonuses.debuffResist — доля шанса отменить/ослабить входящий дебафф.
 */
const JEWELRY = [
  // —— Elven (D, CDR) ——
  {
    id: "elven_necklace",
    name: "Elven Necklace",
    slot: "necklace",
    grade: "D",
    setId: "elven",
    epic: false,
    mdef: 5,
    cc: 177,
    bonuses: { mdef: 5, skillCdMult: 0.985 },
    icon: "icons/accessory_elven_necklace_i00.png",
    desc: "D-сет Elven. M.Def +5, КД скиллов −1.5%.",
  },
  {
    id: "elven_earring",
    name: "Elven Earring",
    slot: "earring",
    grade: "D",
    setId: "elven",
    epic: false,
    mdef: 3,
    cc: 113,
    bonuses: { mdef: 3, skillCdMult: 0.99 },
    icon: "icons/accessory_elven_earring_i00.png",
    desc: "D-сет Elven. M.Def +3, КД скиллов −1%.",
  },
  {
    id: "elven_ring",
    name: "Elven Ring",
    slot: "ring",
    grade: "D",
    setId: "elven",
    epic: false,
    mdef: 2,
    cc: 70,
    bonuses: { mdef: 2, skillCdMult: 0.992 },
    icon: "icons/accessory_elven_ring_i00.png",
    desc: "D-сет Elven. M.Def +2, КД скиллов −0.8%.",
  },

  // —— Darkness (D, Resist) ——
  {
    id: "darkness_necklace",
    name: "Necklace of Darkness",
    slot: "necklace",
    grade: "D",
    setId: "darkness",
    epic: false,
    mdef: 5,
    cc: 230,
    bonuses: { mdef: 5, debuffResist: 0.035 },
    icon: "icons/accessory_necklace_of_darkness_i00.png",
    desc: "D-сет Darkness. M.Def +5, резист дебаффов +3.5%.",
  },
  {
    id: "darkness_earring",
    name: "Earring of Darkness",
    slot: "earring",
    grade: "D",
    setId: "darkness",
    epic: false,
    mdef: 4,
    cc: 146,
    bonuses: { mdef: 4, debuffResist: 0.025 },
    icon: "icons/accessory_earing_of_darkness_i00.png",
    desc: "D-сет Darkness. M.Def +4, резист дебаффов +2.5%.",
  },
  {
    id: "darkness_ring",
    name: "Ring of Darkness",
    slot: "ring",
    grade: "D",
    setId: "darkness",
    epic: false,
    mdef: 2,
    cc: 77,
    bonuses: { mdef: 2, debuffResist: 0.015 },
    icon: "icons/accessory_ring_of_darkness_i00.png",
    desc: "D-сет Darkness. M.Def +2, резист дебаффов +1.5%.",
  },

  // —— Aquastone (C, баланс) ——
  {
    id: "aquastone_necklace",
    name: "Aquastone Necklace",
    slot: "necklace",
    grade: "C",
    setId: "aquastone",
    epic: false,
    mdef: 7,
    cc: 82,
    bonuses: { mdef: 7, skillCdMult: 0.988 },
    icon: "icons/accessory_aquastone_necklace_i00.png",
    desc: "C-сет Aquastone. M.Def +7, КД −1.2%.",
  },
  {
    id: "aquastone_earring",
    name: "Aquastone Earring",
    slot: "earring",
    grade: "C",
    setId: "aquastone",
    epic: false,
    mdef: 5,
    cc: 62,
    bonuses: { mdef: 5, skillCdMult: 0.992, debuffResist: 0.01 },
    icon: "icons/accessory_aquastone_earring_i00.png",
    desc: "C-сет Aquastone. M.Def +5, КД −0.8%, резист +1%.",
  },
  {
    id: "aquastone_ring",
    name: "Aquastone Ring",
    slot: "ring",
    grade: "C",
    setId: "aquastone",
    epic: false,
    mdef: 3,
    cc: 41,
    bonuses: { mdef: 3, debuffResist: 0.012 },
    icon: "icons/accessory_aquastone_ring_i00.png",
    desc: "C-сет Aquastone. M.Def +3, резист дебаффов +1.2%.",
  },

  // —— Protection (C, Resist+) ——
  {
    id: "protection_necklace",
    name: "Necklace of Protection",
    slot: "necklace",
    grade: "C",
    setId: "protection",
    epic: false,
    mdef: 7,
    cc: 104,
    bonuses: { mdef: 7, debuffResist: 0.045 },
    icon: "icons/accessory_necklace_of_protection_i00.png",
    desc: "C-сет Protection. M.Def +7, резист дебаффов +4.5%.",
  },
  {
    id: "protection_earring",
    name: "Earring of Protection",
    slot: "earring",
    grade: "C",
    setId: "protection",
    epic: false,
    mdef: 5,
    cc: 78,
    bonuses: { mdef: 5, debuffResist: 0.03 },
    icon: "icons/accessory_earing_of_protection_i00.png",
    desc: "C-сет Protection. M.Def +5, резист дебаффов +3%.",
  },
  {
    id: "protection_ring",
    name: "Ring of Protection",
    slot: "ring",
    grade: "C",
    setId: "protection",
    epic: false,
    mdef: 3,
    cc: 52,
    bonuses: { mdef: 3, debuffResist: 0.02 },
    icon: "icons/accessory_ring_of_protection_i00.png",
    desc: "C-сет Protection. M.Def +3, резист дебаффов +2%.",
  },

  // —— Mermaid (C, M.Def+) ——
  {
    id: "mermaid_necklace",
    name: "Necklace of Mermaid",
    slot: "necklace",
    grade: "C",
    setId: "mermaid",
    epic: false,
    mdef: 9,
    cc: 157,
    bonuses: { mdef: 9 },
    icon: "icons/accessory_necklace_of_mermaid_i00.png",
    desc: "C-сет Mermaid. M.Def +9 — максимальная маг. живучесть.",
  },
  {
    id: "mermaid_earring",
    name: "Earring of Mermaid",
    slot: "earring",
    grade: "C",
    setId: "mermaid",
    epic: false,
    mdef: 6,
    cc: 118,
    bonuses: { mdef: 6 },
    icon: "icons/accessory_earing_of_mermaid_i00.png",
    desc: "C-сет Mermaid. M.Def +6.",
  },
  {
    id: "mermaid_ring",
    name: "Ring of Mermaid",
    slot: "ring",
    grade: "C",
    setId: "mermaid",
    epic: false,
    mdef: 4,
    cc: 78,
    bonuses: { mdef: 4, debuffResist: 0.008 },
    icon: "icons/accessory_ring_of_mermaid_i00.png",
    desc: "C-сет Mermaid. M.Def +4, лёгкий резист +0.8%.",
  },

  // —— Binding (C, CDR+) ——
  {
    id: "binding_necklace",
    name: "Necklace of Binding",
    slot: "necklace",
    grade: "C",
    setId: "binding",
    epic: false,
    mdef: 6,
    cc: 226,
    bonuses: { mdef: 6, skillCdMult: 0.978 },
    icon: "icons/accessory_necklace_of_binding_i00.png",
    desc: "C-сет Binding. M.Def +6, КД скиллов −2.2%.",
  },
  {
    id: "binding_earring",
    name: "Earring of Binding",
    slot: "earring",
    grade: "C",
    setId: "binding",
    epic: false,
    mdef: 4,
    cc: 118,
    bonuses: { mdef: 4, skillCdMult: 0.985 },
    icon: "icons/accessory_earing_of_binding_i00.png",
    desc: "C-сет Binding. M.Def +4, КД скиллов −1.5%.",
  },
  {
    id: "binding_ring",
    name: "Ring of Binding",
    slot: "ring",
    grade: "C",
    setId: "binding",
    epic: false,
    mdef: 3,
    cc: 112,
    bonuses: { mdef: 3, skillCdMult: 0.99 },
    icon: "icons/accessory_ring_of_binding_i00.png",
    desc: "C-сет Binding. M.Def +3, КД скиллов −1%.",
  },

  // —— NG ученик (ментор) ——
  {
    id: "ng_guard_necklace",
    name: "Амулет стража",
    slot: "necklace",
    grade: "NG",
    setId: "ng_guard",
    epic: false,
    starter: true,
    noEnchant: true,
    mdef: 2,
    cc: 0,
    bonuses: { mdef: 2, debuffResist: 0.008 },
    icon: "icons/accessory_necklace_of_darkness_i00.png",
    desc: "NG. Слабый M.Def и сопротивление дебаффам. Учебный подарок.",
  },
  {
    id: "ng_guard_earring",
    name: "Серьга стража",
    slot: "earring",
    grade: "NG",
    setId: "ng_guard",
    epic: false,
    starter: true,
    noEnchant: true,
    mdef: 1,
    cc: 0,
    bonuses: { mdef: 1, debuffResist: 0.005 },
    icon: "icons/accessory_earing_of_darkness_i00.png",
    desc: "NG. Учебная серьга стража.",
  },
  {
    id: "ng_guard_ring",
    name: "Кольцо стража",
    slot: "ring",
    grade: "NG",
    setId: "ng_guard",
    epic: false,
    starter: true,
    noEnchant: true,
    mdef: 1,
    cc: 0,
    bonuses: { mdef: 1, debuffResist: 0.004 },
    icon: "icons/accessory_ring_of_darkness_i00.png",
    desc: "NG. Учебное кольцо стража.",
  },
  {
    id: "ng_adept_necklace",
    name: "Амулет послушника",
    slot: "necklace",
    grade: "NG",
    setId: "ng_adept",
    epic: false,
    starter: true,
    noEnchant: true,
    mdef: 2,
    cc: 0,
    bonuses: { mdef: 2, skillCdMult: 0.995 },
    icon: "icons/accessory_elven_necklace_i00.png",
    desc: "NG. Слабый M.Def и чуть быстрее КД. Учебный подарок.",
  },
  {
    id: "ng_adept_earring",
    name: "Серьга послушника",
    slot: "earring",
    grade: "NG",
    setId: "ng_adept",
    epic: false,
    starter: true,
    noEnchant: true,
    mdef: 1,
    cc: 0,
    bonuses: { mdef: 1, skillCdMult: 0.997 },
    icon: "icons/accessory_elven_earring_i00.png",
    desc: "NG. Учебная серьга послушника.",
  },
  {
    id: "ng_adept_ring",
    name: "Кольцо послушника",
    slot: "ring",
    grade: "NG",
    setId: "ng_adept",
    epic: false,
    starter: true,
    noEnchant: true,
    mdef: 1,
    cc: 0,
    bonuses: { mdef: 1, skillCdMult: 0.998 },
    icon: "icons/accessory_elven_ring_i00.png",
    desc: "NG. Учебное кольцо послушника.",
  },
];

const JEWELRY_SETS = {
  elven: {
    id: "elven",
    name: "Elven Jewelry Set",
    grade: "D",
    role: "cdr",
    pieces: ["elven_necklace", "elven_earring", "elven_ring"],
    farmZoneId: "wasteland",
    bonuses: {
      3: { skillCdMult: 0.985 },
      5: { skillCdMult: 0.97, mdef: 2 },
    },
  },
  darkness: {
    id: "darkness",
    name: "Darkness Jewelry Set",
    grade: "D",
    role: "resist",
    pieces: ["darkness_necklace", "darkness_earring", "darkness_ring"],
    farmZoneId: "school_of_dark_arts",
    bonuses: {
      3: { debuffResist: 0.04 },
      5: { debuffResist: 0.06, mdef: 2 },
    },
  },
  aquastone: {
    id: "aquastone",
    name: "Aquastone Jewelry Set",
    grade: "C",
    role: "balanced",
    pieces: ["aquastone_necklace", "aquastone_earring", "aquastone_ring"],
    farmZoneId: "cruma_marshlands",
    bonuses: {
      3: { skillCdMult: 0.99, debuffResist: 0.02 },
      5: { skillCdMult: 0.98, debuffResist: 0.03, mdef: 3 },
    },
  },
  protection: {
    id: "protection",
    name: "Protection Jewelry Set",
    grade: "C",
    role: "resist",
    pieces: ["protection_necklace", "protection_earring", "protection_ring"],
    farmZoneId: "execution_grounds",
    bonuses: {
      3: { debuffResist: 0.05 },
      5: { debuffResist: 0.08, mdef: 3 },
    },
  },
  mermaid: {
    id: "mermaid",
    name: "Mermaid Jewelry Set",
    grade: "C",
    role: "mdef",
    pieces: ["mermaid_necklace", "mermaid_earring", "mermaid_ring"],
    farmZoneId: "alligator_island",
    bonuses: {
      3: { mdef: 4 },
      5: { mdef: 7, debuffResist: 0.02 },
    },
  },
  binding: {
    id: "binding",
    name: "Binding Jewelry Set",
    grade: "C",
    role: "cdr",
    pieces: ["binding_necklace", "binding_earring", "binding_ring"],
    farmZoneId: "gorgon_flower_garden",
    bonuses: {
      3: { skillCdMult: 0.98 },
      5: { skillCdMult: 0.96, mdef: 2 },
    },
  },
  ng_guard: {
    id: "ng_guard",
    name: "Бижутерия стража",
    grade: "NG",
    role: "resist",
    starter: true,
    pieces: ["ng_guard_necklace", "ng_guard_earring", "ng_guard_ring"],
    bonuses: {
      3: { debuffResist: 0.012 },
      5: { debuffResist: 0.018, mdef: 1 },
    },
  },
  ng_adept: {
    id: "ng_adept",
    name: "Бижутерия послушника",
    grade: "NG",
    role: "cdr",
    starter: true,
    pieces: ["ng_adept_necklace", "ng_adept_earring", "ng_adept_ring"],
    bonuses: {
      3: { skillCdMult: 0.992 },
      5: { skillCdMult: 0.985, mdef: 1 },
    },
  },
};

const JEWELRY_SET_FRAG_ICONS = {
  elven: "icons/etc_crystal_green_i00.png",
  darkness: "icons/etc_crystal_blue_i00.png",
  aquastone: "icons/etc_crystal_white_i00.png",
  protection: "icons/etc_gem_clear_i00.png",
  mermaid: "icons/etc_crystal_gold_i00.png",
  binding: "icons/etc_crystal_silver_i00.png",
};
const _JEWEL_FRAG_FALLBACK = "icons/etc_broken_crystal_silver_i00.png";

/** Id куска бижи на сет (один на necklace/earring/ring). */
function jewelrySetPieceId(setId) {
  return String(setId || "") + "_piece";
}

/**
 * Куски graded-бижи: один `{setId}_piece` на сет.
 * Epic shards остаются в ACCESSORY_FRAGS (enchant-balance).
 */
const JEWELRY_FRAGS = {};
Object.keys(JEWELRY_SETS).forEach((setId) => {
  const set = JEWELRY_SETS[setId];
  if (!set || set.starter || set.grade === "NG") return;
  const fragId = jewelrySetPieceId(setId);
  const label = String(set.name || setId).replace(/\s+Jewelry Set$/i, "").replace(/\s+Set$/i, "");
  JEWELRY_FRAGS[fragId] = {
    id: fragId,
    name: label + " Piece",
    setId,
    icon: JEWELRY_SET_FRAG_ICONS[setId] || _JEWEL_FRAG_FALLBACK,
    desc: "Материал сета «" + (set.name || setId) + "» для крафта в мастерской.",
  };
});

/** Старые слот-куски `{accessoryId}_piece` → setId. */
const LEGACY_JEWELRY_FRAG_TO_SET = {};
JEWELRY.forEach((j) => {
  if (j.starter || j.grade === "NG" || !j.setId) return;
  LEGACY_JEWELRY_FRAG_TO_SET[j.id + "_piece"] = j.setId;
});

function _jewelryCraftRow(accessoryId, fragQty, cry, oreSoul, adena) {
  const j = JEWELRY.find((x) => x.id === accessoryId);
  const setId = j?.setId;
  return {
    accessoryId,
    shardId: jewelrySetPieceId(setId),
    shardQty: fragQty,
    cry: cry || 0,
    oreSoul: oreSoul || 0,
    adena: adena || 0,
    graded: true,
  };
}

const JEWELRY_CRAFT = [
  // Elven D
  _jewelryCraftRow("elven_necklace", 7, 3, 8, 8000),
  _jewelryCraftRow("elven_earring", 5, 2, 5, 5000),
  _jewelryCraftRow("elven_ring", 4, 1, 4, 3500),
  // Darkness D
  _jewelryCraftRow("darkness_necklace", 8, 3, 9, 9000),
  _jewelryCraftRow("darkness_earring", 6, 2, 6, 5500),
  _jewelryCraftRow("darkness_ring", 4, 2, 4, 4000),
  // Aquastone C
  _jewelryCraftRow("aquastone_necklace", 10, 4, 14, 18000),
  _jewelryCraftRow("aquastone_earring", 7, 3, 10, 12000),
  _jewelryCraftRow("aquastone_ring", 5, 2, 7, 9000),
  // Protection C
  _jewelryCraftRow("protection_necklace", 10, 4, 14, 19000),
  _jewelryCraftRow("protection_earring", 7, 3, 10, 12500),
  _jewelryCraftRow("protection_ring", 5, 2, 7, 9500),
  // Mermaid C
  _jewelryCraftRow("mermaid_necklace", 11, 5, 16, 22000),
  _jewelryCraftRow("mermaid_earring", 8, 3, 11, 14000),
  _jewelryCraftRow("mermaid_ring", 6, 2, 8, 10000),
  // Binding C
  _jewelryCraftRow("binding_necklace", 10, 4, 15, 20000),
  _jewelryCraftRow("binding_earring", 7, 3, 10, 13000),
  _jewelryCraftRow("binding_ring", 5, 2, 7, 9500),
];

/** Слить graded jewelry в COLLECTIBLES / ACCESSORY_FRAGS / ACCESSORY_CRAFT. */
(function mergeJewelryIntoCollectibles() {
  if (typeof COLLECTIBLES === "undefined") return;
  JEWELRY.forEach((j) => {
    COLLECTIBLES[j.id] = {
      id: j.id,
      name: j.name,
      icon: j.icon,
      grade: j.grade,
      epic: false,
      setId: j.setId,
      slot: j.slot,
      desc: j.desc,
      mdef: j.mdef,
      cc: j.cc,
      bonuses: Object.assign({}, j.bonuses),
      starter: !!j.starter,
      noEnchant: !!j.noEnchant,
    };
  });
  if (typeof ACCESSORY_FRAGS !== "undefined") {
    Object.keys(JEWELRY_FRAGS).forEach((id) => {
      ACCESSORY_FRAGS[id] = JEWELRY_FRAGS[id];
    });
  }
  if (typeof ACCESSORY_CRAFT !== "undefined" && Array.isArray(ACCESSORY_CRAFT)) {
    JEWELRY_CRAFT.forEach((r) => ACCESSORY_CRAFT.push(r));
  }
})();

const JMAP = {};
JEWELRY.forEach((j) => {
  JMAP[j.id] = j;
});
