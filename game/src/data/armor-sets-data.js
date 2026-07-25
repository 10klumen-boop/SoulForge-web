// ===== Броня и сеты (P3): все D/C HF-сеты (без Clan Oath) + крафт =====
// Иконки: masterwork.wiki texture-set (armor_tXX_*) → descriptive names via tools/fetch_armor_set_icons.py.
// Wiki-паттерн: Material (piece) + crystals + ore → кусок. Def даёт sustain (HP golden/boss).
// Шлемы: варианты helmet / leather_helmet / circlet / cloth_helmet (i00/i02) по сетам.

const FEATURE_ARMOR_UI = true;

/** Слоты брони (не бижутерия). */
const ARMOR_SLOT_IDS = ["helmet", "chest", "legs", "gloves", "boots"];

/**
 * Side-зоны фарма фрагментов: zoneId → список setId (в зоне падают куски нескольких сетов).
 * D ≈ гл. I–II, C ≈ гл. II–III; без квестов. Clan Oath не включаем.
 */
const ARMOR_FRAG_ZONES = {
  scrap_field: ["bone", "brigandine", "manticore", "reinforced", "elven_mithril", "knowledge"],
  mithril_forge: [
    "mithril",
    "chain",
    "tempered",
    "theca",
    "plated",
    "drake",
    "composite",
    "full_plate",
    "karmian",
    "divine",
    "demon",
  ],
};

/** @deprecated используй ARMOR_FRAG_ZONES */
const ARMOR_FRAG_ZONE_ID = "mithril_forge";

const ARMOR = [
  // —— Bone (D, heavy) ——
  { id: "bone_helmet", name: "Bone Helmet", slot: "helmet", grade: "D", setId: "bone", pdef: 5, mdef: 2, icon: "icons/armor_leather_helmet_i00.png", glow: "#c8b896" },
  { id: "bone_breastplate", name: "Bone Breastplate", slot: "chest", grade: "D", setId: "bone", pdef: 12, mdef: 4, icon: "icons/armor_bone_breastplate_i00.png", glow: "#c8b896" },
  { id: "bone_gaiters", name: "Bone Gaiters", slot: "legs", grade: "D", setId: "bone", pdef: 8, mdef: 3, icon: "icons/armor_bone_gaiters_i00.png", glow: "#c8b896" },
  { id: "bone_gloves", name: "Bone Gloves", slot: "gloves", grade: "D", setId: "bone", pdef: 4, mdef: 2, icon: "icons/armor_gauntlet_i00.png", glow: "#c8b896" },
  { id: "bone_boots", name: "Bone Boots", slot: "boots", grade: "D", setId: "bone", pdef: 4, mdef: 2, icon: "icons/armor_boots_i00.png", glow: "#c8b896" },

  // —— Brigandine (D, heavy) ——
  { id: "brigandine_helmet", name: "Brigandine Helmet", slot: "helmet", grade: "D", setId: "brigandine", pdef: 6, mdef: 2, icon: "icons/armor_leather_helmet_i02.png", glow: "#9ab0c8" },
  { id: "brigandine_breastplate", name: "Brigandine", slot: "chest", grade: "D", setId: "brigandine", pdef: 14, mdef: 5, icon: "icons/armor_brigandine_i00.png", glow: "#9ab0c8" },
  { id: "brigandine_gaiters", name: "Brigandine Gaiters", slot: "legs", grade: "D", setId: "brigandine", pdef: 9, mdef: 3, icon: "icons/armor_brigandine_gaiters_i00.png", glow: "#9ab0c8" },
  { id: "brigandine_gloves", name: "Brigandine Gauntlets", slot: "gloves", grade: "D", setId: "brigandine", pdef: 4, mdef: 2, icon: "icons/armor_brigandine_gauntlet_i00.png", glow: "#9ab0c8" },
  { id: "brigandine_boots", name: "Brigandine Boots", slot: "boots", grade: "D", setId: "brigandine", pdef: 4, mdef: 2, icon: "icons/armor_brigandine_boots_i00.png", glow: "#9ab0c8" },

  // —— Manticore (D, light) — wiki t42 ——
  { id: "manticore_helmet", name: "Manticore Skin Helmet", slot: "helmet", grade: "D", setId: "manticore", pdef: 4, mdef: 3, icon: "icons/armor_leather_helmet_i02.png", glow: "#d4a06a" },
  { id: "manticore_mail", name: "Manticore Skin Mail", slot: "chest", grade: "D", setId: "manticore", pdef: 10, mdef: 6, icon: "icons/armor_manticore_skin_shirt_i00.png", glow: "#d4a06a" },
  { id: "manticore_gaiters", name: "Manticore Skin Gaiters", slot: "legs", grade: "D", setId: "manticore", pdef: 7, mdef: 4, icon: "icons/armor_manticore_skin_gaiters_i00.png", glow: "#d4a06a" },
  { id: "manticore_gloves", name: "Manticore Skin Gloves", slot: "gloves", grade: "D", setId: "manticore", pdef: 3, mdef: 2, icon: "icons/armor_manticore_skin_gloves_i00.png", glow: "#d4a06a" },
  { id: "manticore_boots", name: "Manticore Skin Boots", slot: "boots", grade: "D", setId: "manticore", pdef: 3, mdef: 2, icon: "icons/armor_manticore_skin_boots_i00.png", glow: "#d4a06a" },

  // —— Reinforced Leather (D, light) — wiki t13 ——
  { id: "reinforced_helmet", name: "Reinforced Leather Helmet", slot: "helmet", grade: "D", setId: "reinforced", pdef: 4, mdef: 3, icon: "icons/armor_leather_helmet_i00.png", glow: "#c4a882" },
  { id: "reinforced_shirt", name: "Reinforced Leather Shirt", slot: "chest", grade: "D", setId: "reinforced", pdef: 11, mdef: 5, icon: "icons/armor_reinforced_leather_shirt_i00.png", glow: "#c4a882" },
  { id: "reinforced_gaiters", name: "Reinforced Leather Gaiters", slot: "legs", grade: "D", setId: "reinforced", pdef: 7, mdef: 4, icon: "icons/armor_reinforced_leather_gaiters_i00.png", glow: "#c4a882" },
  { id: "reinforced_gloves", name: "Reinforced Leather Gloves", slot: "gloves", grade: "D", setId: "reinforced", pdef: 3, mdef: 2, icon: "icons/armor_reinforced_leather_gloves_i00.png", glow: "#c4a882" },
  { id: "reinforced_boots", name: "Reinforced Leather Boots", slot: "boots", grade: "D", setId: "reinforced", pdef: 3, mdef: 2, icon: "icons/armor_reinforced_leather_boots_i00.png", glow: "#c4a882" },

  // —— Elven Mithril (D, robe) ——
  { id: "elven_mithril_circlet", name: "Elven Mithril Circlet", slot: "helmet", grade: "D", setId: "elven_mithril", pdef: 3, mdef: 5, icon: "icons/armor_circlet_i02.png", glow: "#8fd4a8" },
  { id: "elven_mithril_tunic", name: "Elven Mithril Tunic", slot: "chest", grade: "D", setId: "elven_mithril", pdef: 8, mdef: 10, icon: "icons/armor_mithril_tunic_i00.png", glow: "#8fd4a8" },
  { id: "elven_mithril_hose", name: "Elven Mithril Stockings", slot: "legs", grade: "D", setId: "elven_mithril", pdef: 5, mdef: 7, icon: "icons/armor_mithril_hose_i00.png", glow: "#8fd4a8" },
  { id: "elven_mithril_gloves", name: "Elven Mithril Gloves", slot: "gloves", grade: "D", setId: "elven_mithril", pdef: 2, mdef: 4, icon: "icons/armor_elven_mithril_gloves_i00.png", glow: "#8fd4a8" },
  { id: "elven_mithril_boots", name: "Elven Mithril Boots", slot: "boots", grade: "D", setId: "elven_mithril", pdef: 2, mdef: 4, icon: "icons/armor_elven_mithril_boots_i00.png", glow: "#8fd4a8" },

  // —— Knowledge (D, robe) ——
  { id: "knowledge_circlet", name: "Circlet of Knowledge", slot: "helmet", grade: "D", setId: "knowledge", pdef: 3, mdef: 5, icon: "icons/armor_circlet_i00.png", glow: "#9b8fd4" },
  { id: "knowledge_tunic", name: "Tunic of Knowledge", slot: "chest", grade: "D", setId: "knowledge", pdef: 8, mdef: 11, icon: "icons/armor_tunic_of_knowledge_i00.png", glow: "#9b8fd4" },
  { id: "knowledge_hose", name: "Stockings of Knowledge", slot: "legs", grade: "D", setId: "knowledge", pdef: 5, mdef: 8, icon: "icons/armor_hose_of_knowledge_i00.png", glow: "#9b8fd4" },
  { id: "knowledge_gloves", name: "Gloves of Knowledge", slot: "gloves", grade: "D", setId: "knowledge", pdef: 2, mdef: 4, icon: "icons/armor_gloves_of_knowledge_i00.png", glow: "#9b8fd4" },
  { id: "knowledge_boots", name: "Boots of Knowledge", slot: "boots", grade: "D", setId: "knowledge", pdef: 2, mdef: 4, icon: "icons/armor_boots_of_knowledge_i00.png", glow: "#9b8fd4" },

  // —— Mithril (C, heavy) — в SoulForge C-пул (фарм кузницы) ——
  { id: "mithril_helmet", name: "Mithril Helmet", slot: "helmet", grade: "C", setId: "mithril", pdef: 8, mdef: 4, icon: "icons/armor_helmet_i00.png", glow: "#7fd1ff" },
  { id: "mithril_breastplate", name: "Mithril Breastplate", slot: "chest", grade: "C", setId: "mithril", pdef: 18, mdef: 8, icon: "icons/armor_mithril_breastplate_i00.png", glow: "#7fd1ff" },
  { id: "mithril_gaiters", name: "Mithril Gaiters", slot: "legs", grade: "C", setId: "mithril", pdef: 12, mdef: 6, icon: "icons/armor_mithril_gaiters_i00.png", glow: "#7fd1ff" },
  { id: "mithril_gloves", name: "Mithril Gloves", slot: "gloves", grade: "C", setId: "mithril", pdef: 6, mdef: 3, icon: "icons/armor_mithril_gloves_i00.png", glow: "#7fd1ff" },
  { id: "mithril_boots", name: "Mithril Boots", slot: "boots", grade: "C", setId: "mithril", pdef: 6, mdef: 3, icon: "icons/armor_mithril_boots_i00.png", glow: "#7fd1ff" },

  // —— Chain (C, heavy) ——
  { id: "chain_helmet", name: "Chain Helmet", slot: "helmet", grade: "C", setId: "chain", pdef: 8, mdef: 4, icon: "icons/armor_helmet_i02.png", glow: "#a8b8c8" },
  { id: "chain_mail", name: "Chain Mail Shirt", slot: "chest", grade: "C", setId: "chain", pdef: 17, mdef: 7, icon: "icons/armor_chain_mail_shirt_i00.png", glow: "#a8b8c8" },
  { id: "chain_gaiters", name: "Chain Gaiters", slot: "legs", grade: "C", setId: "chain", pdef: 12, mdef: 5, icon: "icons/armor_chain_gaiters_i00.png", glow: "#a8b8c8" },
  { id: "chain_gloves", name: "Chain Gloves", slot: "gloves", grade: "C", setId: "chain", pdef: 6, mdef: 3, icon: "icons/armor_chain_gloves_i00.png", glow: "#a8b8c8" },
  { id: "chain_boots", name: "Chain Boots", slot: "boots", grade: "C", setId: "chain", pdef: 6, mdef: 3, icon: "icons/armor_chain_boots_i00.png", glow: "#a8b8c8" },

  // —— Tempered Mithril (C, light) — wiki t45 ——
  { id: "tempered_helmet", name: "Tempered Mithril Helmet", slot: "helmet", grade: "C", setId: "tempered", pdef: 6, mdef: 5, icon: "icons/armor_leather_helmet_i02.png", glow: "#6ec8c0" },
  { id: "tempered_shirt", name: "Tempered Mithril Shirt", slot: "chest", grade: "C", setId: "tempered", pdef: 15, mdef: 9, icon: "icons/armor_tempered_mithril_shirt_i00.png", glow: "#6ec8c0" },
  { id: "tempered_gaiters", name: "Tempered Mithril Gaiters", slot: "legs", grade: "C", setId: "tempered", pdef: 10, mdef: 6, icon: "icons/armor_tempered_mithril_gaiters_i00.png", glow: "#6ec8c0" },
  { id: "tempered_gloves", name: "Tempered Mithril Gloves", slot: "gloves", grade: "C", setId: "tempered", pdef: 5, mdef: 3, icon: "icons/armor_tempered_mithril_gloves_i00.png", glow: "#6ec8c0" },
  { id: "tempered_boots", name: "Tempered Mithril Boots", slot: "boots", grade: "C", setId: "tempered", pdef: 5, mdef: 3, icon: "icons/armor_tempered_mithril_boots_i00.png", glow: "#6ec8c0" },

  // —— Theca Leather (C, light) — wiki t63 ——
  { id: "theca_helmet", name: "Theca Leather Helmet", slot: "helmet", grade: "C", setId: "theca", pdef: 6, mdef: 5, icon: "icons/armor_cloth_helmet_i00.png", glow: "#d8b878" },
  { id: "theca_mail", name: "Theca Leather Mail", slot: "chest", grade: "C", setId: "theca", pdef: 15, mdef: 8, icon: "icons/armor_theca_leather_mail_i00.png", glow: "#d8b878" },
  { id: "theca_gaiters", name: "Theca Leather Gaiters", slot: "legs", grade: "C", setId: "theca", pdef: 10, mdef: 6, icon: "icons/armor_theca_leather_gaiters_i00.png", glow: "#d8b878" },
  { id: "theca_gloves", name: "Theca Leather Gloves", slot: "gloves", grade: "C", setId: "theca", pdef: 5, mdef: 3, icon: "icons/armor_theca_leather_gloves_i00.png", glow: "#d8b878" },
  { id: "theca_boots", name: "Theca Leather Boots", slot: "boots", grade: "C", setId: "theca", pdef: 5, mdef: 3, icon: "icons/armor_theca_leather_boots_i00.png", glow: "#d8b878" },

  // —— Plated Leather (C, light) — wiki t47 ——
  { id: "plated_helmet", name: "Plated Leather Helmet", slot: "helmet", grade: "C", setId: "plated", pdef: 7, mdef: 4, icon: "icons/armor_leather_helmet_i00.png", glow: "#c8a060" },
  { id: "plated_mail", name: "Plated Leather", slot: "chest", grade: "C", setId: "plated", pdef: 16, mdef: 7, icon: "icons/armor_plated_leather_i00.png", glow: "#c8a060" },
  { id: "plated_gaiters", name: "Plated Leather Gaiters", slot: "legs", grade: "C", setId: "plated", pdef: 11, mdef: 5, icon: "icons/armor_plated_leather_gaiters_i00.png", glow: "#c8a060" },
  { id: "plated_gloves", name: "Plated Leather Gloves", slot: "gloves", grade: "C", setId: "plated", pdef: 5, mdef: 3, icon: "icons/armor_plated_leather_gloves_i00.png", glow: "#c8a060" },
  { id: "plated_boots", name: "Plated Leather Boots", slot: "boots", grade: "C", setId: "plated", pdef: 5, mdef: 3, icon: "icons/armor_plated_leather_boots_i00.png", glow: "#c8a060" },

  // —— Drake Leather (C, light) — wiki t21 ——
  { id: "drake_helmet", name: "Drake Leather Helmet", slot: "helmet", grade: "C", setId: "drake", pdef: 7, mdef: 5, icon: "icons/armor_cloth_helmet_i02.png", glow: "#8b6a4a" },
  { id: "drake_mail", name: "Drake Leather Mail", slot: "chest", grade: "C", setId: "drake", pdef: 16, mdef: 9, icon: "icons/armor_drake_leather_mail_i00.png", glow: "#8b6a4a" },
  { id: "drake_gaiters", name: "Drake Leather Gaiters", slot: "legs", grade: "C", setId: "drake", pdef: 11, mdef: 6, icon: "icons/armor_drake_leather_gaiters_i00.png", glow: "#8b6a4a" },
  { id: "drake_gloves", name: "Drake Leather Gloves", slot: "gloves", grade: "C", setId: "drake", pdef: 5, mdef: 4, icon: "icons/armor_drake_leather_gloves_i00.png", glow: "#8b6a4a" },
  { id: "drake_boots", name: "Drake Leather Boots", slot: "boots", grade: "C", setId: "drake", pdef: 5, mdef: 4, icon: "icons/armor_drake_leather_boots_i00.png", glow: "#8b6a4a" },

  // —— Composite (C, heavy) — wiki t61 ——
  { id: "composite_helmet", name: "Composite Helmet", slot: "helmet", grade: "C", setId: "composite", pdef: 9, mdef: 4, icon: "icons/armor_helmet_i02.png", glow: "#b0a890" },
  { id: "composite_armor", name: "Composite Armor", slot: "chest", grade: "C", setId: "composite", pdef: 20, mdef: 8, icon: "icons/armor_composite_armor_i00.png", glow: "#b0a890" },
  { id: "composite_gaiters", name: "Composite Gaiters", slot: "legs", grade: "C", setId: "composite", pdef: 13, mdef: 6, icon: "icons/armor_composite_gaiters_i00.png", glow: "#b0a890" },
  { id: "composite_gloves", name: "Composite Gauntlets", slot: "gloves", grade: "C", setId: "composite", pdef: 6, mdef: 3, icon: "icons/armor_composite_gauntlet_i00.png", glow: "#b0a890" },
  { id: "composite_boots", name: "Composite Boots", slot: "boots", grade: "C", setId: "composite", pdef: 6, mdef: 3, icon: "icons/armor_composite_boots_i00.png", glow: "#b0a890" },

  // —— Full Plate (C, heavy) — wiki t62 ——
  { id: "full_plate_helmet", name: "Full Plate Helmet", slot: "helmet", grade: "C", setId: "full_plate", pdef: 10, mdef: 4, icon: "icons/armor_helmet_i00.png", glow: "#d0d0e0" },
  { id: "full_plate_armor", name: "Full Plate Armor", slot: "chest", grade: "C", setId: "full_plate", pdef: 22, mdef: 8, icon: "icons/armor_full_plate_armor_i00.png", glow: "#d0d0e0" },
  { id: "full_plate_gaiters", name: "Full Plate Gaiters", slot: "legs", grade: "C", setId: "full_plate", pdef: 14, mdef: 6, icon: "icons/armor_full_plate_gaiters_i00.png", glow: "#d0d0e0" },
  { id: "full_plate_gloves", name: "Full Plate Gauntlets", slot: "gloves", grade: "C", setId: "full_plate", pdef: 7, mdef: 3, icon: "icons/armor_full_plate_gauntlet_i00.png", glow: "#d0d0e0" },
  { id: "full_plate_boots", name: "Full Plate Boots", slot: "boots", grade: "C", setId: "full_plate", pdef: 7, mdef: 3, icon: "icons/armor_full_plate_boots_i00.png", glow: "#d0d0e0" },

  // —— Karmian (C, robe) ——
  { id: "karmian_circlet", name: "Karmian Circlet", slot: "helmet", grade: "C", setId: "karmian", pdef: 5, mdef: 8, icon: "icons/armor_circlet_i02.png", glow: "#c9a0e8" },
  { id: "karmian_tunic", name: "Karmian Tunic", slot: "chest", grade: "C", setId: "karmian", pdef: 12, mdef: 14, icon: "icons/armor_karmian_tunic_i00.png", glow: "#c9a0e8" },
  { id: "karmian_hose", name: "Karmian Hose", slot: "legs", grade: "C", setId: "karmian", pdef: 8, mdef: 10, icon: "icons/armor_karmian_hose_i00.png", glow: "#c9a0e8" },
  { id: "karmian_gloves", name: "Karmian Gloves", slot: "gloves", grade: "C", setId: "karmian", pdef: 4, mdef: 5, icon: "icons/armor_karmian_gloves_i00.png", glow: "#c9a0e8" },
  { id: "karmian_boots", name: "Karmian Boots", slot: "boots", grade: "C", setId: "karmian", pdef: 4, mdef: 5, icon: "icons/armor_karmian_boots_i00.png", glow: "#c9a0e8" },

  // —— Divine (C, robe) ——
  { id: "divine_circlet", name: "Divine Circlet", slot: "helmet", grade: "C", setId: "divine", pdef: 5, mdef: 9, icon: "icons/armor_circlet_i00.png", glow: "#e8e0a0" },
  { id: "divine_tunic", name: "Divine Tunic", slot: "chest", grade: "C", setId: "divine", pdef: 12, mdef: 15, icon: "icons/armor_divine_tunic_i00.png", glow: "#e8e0a0" },
  { id: "divine_hose", name: "Divine Hose", slot: "legs", grade: "C", setId: "divine", pdef: 8, mdef: 11, icon: "icons/armor_divine_hose_i00.png", glow: "#e8e0a0" },
  { id: "divine_gloves", name: "Divine Gloves", slot: "gloves", grade: "C", setId: "divine", pdef: 4, mdef: 6, icon: "icons/armor_divine_gloves_i00.png", glow: "#e8e0a0" },
  { id: "divine_boots", name: "Divine Boots", slot: "boots", grade: "C", setId: "divine", pdef: 4, mdef: 6, icon: "icons/armor_divine_boots_i00.png", glow: "#e8e0a0" },

  // —— Demon (C, robe) — wiki t54 ——
  { id: "demon_circlet", name: "Demon Circlet", slot: "helmet", grade: "C", setId: "demon", pdef: 5, mdef: 9, icon: "icons/armor_cloth_helmet_i00.png", glow: "#a05070" },
  { id: "demon_tunic", name: "Demon Tunic", slot: "chest", grade: "C", setId: "demon", pdef: 11, mdef: 16, icon: "icons/armor_demon_tunic_i00.png", glow: "#a05070" },
  { id: "demon_hose", name: "Demon Hose", slot: "legs", grade: "C", setId: "demon", pdef: 7, mdef: 12, icon: "icons/armor_demon_hose_i00.png", glow: "#a05070" },
  { id: "demon_gloves", name: "Demon Gloves", slot: "gloves", grade: "C", setId: "demon", pdef: 4, mdef: 6, icon: "icons/armor_demon_gloves_i00.png", glow: "#a05070" },
  { id: "demon_boots", name: "Demon Boots", slot: "boots", grade: "C", setId: "demon", pdef: 4, mdef: 6, icon: "icons/armor_demon_boots_i00.png", glow: "#a05070" },
];

const AMAP = {};
ARMOR.forEach((a) => {
  AMAP[a.id] = a;
});

/** Фрагменты (= wiki Material / Piece). Хранятся в state.materials[fragId]. */
const ARMOR_FRAGS = {};
/** Одна иконка Material на сет (wiki etc_*), чтобы куски не мешались визуально. */
const ARMOR_SET_FRAG_ICONS = {
  bone: "icons/etc_piece_bone_white_i00.png",
  brigandine: "icons/etc_plate_silver_i00.png",
  manticore: "icons/etc_leather_gray_i00.png",
  reinforced: "icons/etc_crafted_leather_i00.png",
  elven_mithril: "icons/etc_metallic_fiber_i00.png",
  knowledge: "icons/etc_skein_gray_i00.png",
  mithril: "icons/etc_mithril_ore_i00.png",
  chain: "icons/etc_chain_i00.png",
  tempered: "icons/etc_lump_white_i00.png",
  theca: "icons/etc_leather_yellow_i00.png",
  plated: "icons/etc_leather_brown_i00.png",
  drake: "icons/etc_scale_of_medusa_green_i00.png",
  composite: "icons/etc_plate_blue_i00.png",
  full_plate: "icons/etc_adamantium_i00.png",
  karmian: "icons/etc_piece_of_cloth_blue_i00.png",
  divine: "icons/etc_gem_clear_i00.png",
  demon: "icons/etc_piece_of_cloth_red_i00.png",
};
const _FRAG_FALLBACK = "icons/etc_lump_gray_i00.png";
ARMOR.forEach((a) => {
  const fragId = a.id + "_piece";
  ARMOR_FRAGS[fragId] = {
    id: fragId,
    name: a.name + " Material",
    armorId: a.id,
    icon: ARMOR_SET_FRAG_ICONS[a.setId] || _FRAG_FALLBACK,
  };
});

/**
 * Крафт в мастерской (wiki: piece + mats + crystals).
 * cry — кристаллы грейда куска; oreSoul — Soul Ore; adena — плата кузни.
 */
function _armorCraftRow(armorId, fragQty, cry, oreSoul, adena) {
  return { armorId, fragId: armorId + "_piece", fragQty, cry, oreSoul, adena };
}

const ARMOR_CRAFT = [
  // Bone D
  _armorCraftRow("bone_helmet", 5, 2, 6, 4000),
  _armorCraftRow("bone_breastplate", 9, 4, 14, 12000),
  _armorCraftRow("bone_gaiters", 7, 3, 10, 8000),
  _armorCraftRow("bone_gloves", 4, 1, 5, 3500),
  _armorCraftRow("bone_boots", 4, 1, 5, 3500),
  // Brigandine D
  _armorCraftRow("brigandine_helmet", 6, 2, 8, 5500),
  _armorCraftRow("brigandine_breastplate", 10, 4, 16, 15000),
  _armorCraftRow("brigandine_gaiters", 8, 3, 12, 10000),
  _armorCraftRow("brigandine_gloves", 5, 2, 6, 4500),
  _armorCraftRow("brigandine_boots", 5, 2, 6, 4500),
  // Manticore D
  _armorCraftRow("manticore_helmet", 5, 2, 7, 5000),
  _armorCraftRow("manticore_mail", 9, 4, 15, 14000),
  _armorCraftRow("manticore_gaiters", 7, 3, 11, 9000),
  _armorCraftRow("manticore_gloves", 4, 1, 5, 4000),
  _armorCraftRow("manticore_boots", 4, 1, 5, 4000),
  // Reinforced D
  _armorCraftRow("reinforced_helmet", 5, 2, 7, 4800),
  _armorCraftRow("reinforced_shirt", 9, 4, 14, 13500),
  _armorCraftRow("reinforced_gaiters", 7, 3, 11, 8800),
  _armorCraftRow("reinforced_gloves", 4, 1, 5, 3800),
  _armorCraftRow("reinforced_boots", 4, 1, 5, 3800),
  // Elven Mithril D
  _armorCraftRow("elven_mithril_circlet", 5, 2, 7, 5200),
  _armorCraftRow("elven_mithril_tunic", 9, 4, 15, 14500),
  _armorCraftRow("elven_mithril_hose", 7, 3, 11, 9200),
  _armorCraftRow("elven_mithril_gloves", 4, 1, 5, 4200),
  _armorCraftRow("elven_mithril_boots", 4, 1, 5, 4200),
  // Knowledge D
  _armorCraftRow("knowledge_circlet", 5, 2, 7, 5200),
  _armorCraftRow("knowledge_tunic", 9, 4, 15, 14500),
  _armorCraftRow("knowledge_hose", 7, 3, 11, 9200),
  _armorCraftRow("knowledge_gloves", 4, 1, 5, 4200),
  _armorCraftRow("knowledge_boots", 4, 1, 5, 4200),
  // Mithril C
  _armorCraftRow("mithril_helmet", 8, 3, 12, 12000),
  _armorCraftRow("mithril_breastplate", 14, 6, 28, 35000),
  _armorCraftRow("mithril_gaiters", 10, 4, 18, 22000),
  _armorCraftRow("mithril_gloves", 6, 2, 10, 10000),
  _armorCraftRow("mithril_boots", 6, 2, 10, 10000),
  // Chain C
  _armorCraftRow("chain_helmet", 8, 3, 12, 13000),
  _armorCraftRow("chain_mail", 14, 6, 26, 34000),
  _armorCraftRow("chain_gaiters", 10, 4, 18, 21000),
  _armorCraftRow("chain_gloves", 6, 2, 10, 10000),
  _armorCraftRow("chain_boots", 6, 2, 10, 10000),
  // Tempered C
  _armorCraftRow("tempered_helmet", 8, 3, 12, 12500),
  _armorCraftRow("tempered_shirt", 13, 5, 24, 32000),
  _armorCraftRow("tempered_gaiters", 10, 4, 17, 20000),
  _armorCraftRow("tempered_gloves", 6, 2, 9, 9500),
  _armorCraftRow("tempered_boots", 6, 2, 9, 9500),
  // Theca C
  _armorCraftRow("theca_helmet", 8, 3, 12, 12500),
  _armorCraftRow("theca_mail", 13, 5, 24, 32000),
  _armorCraftRow("theca_gaiters", 10, 4, 17, 20000),
  _armorCraftRow("theca_gloves", 6, 2, 9, 9500),
  _armorCraftRow("theca_boots", 6, 2, 9, 9500),
  // Plated C
  _armorCraftRow("plated_helmet", 8, 3, 13, 14000),
  _armorCraftRow("plated_mail", 14, 6, 26, 34000),
  _armorCraftRow("plated_gaiters", 10, 4, 18, 21000),
  _armorCraftRow("plated_gloves", 6, 2, 10, 10000),
  _armorCraftRow("plated_boots", 6, 2, 10, 10000),
  // Drake C
  _armorCraftRow("drake_helmet", 8, 3, 13, 14500),
  _armorCraftRow("drake_mail", 14, 6, 27, 36000),
  _armorCraftRow("drake_gaiters", 10, 4, 18, 22000),
  _armorCraftRow("drake_gloves", 6, 2, 10, 10500),
  _armorCraftRow("drake_boots", 6, 2, 10, 10500),
  // Composite C
  _armorCraftRow("composite_helmet", 9, 4, 14, 16000),
  _armorCraftRow("composite_armor", 15, 7, 30, 40000),
  _armorCraftRow("composite_gaiters", 11, 5, 20, 25000),
  _armorCraftRow("composite_gloves", 7, 3, 11, 12000),
  _armorCraftRow("composite_boots", 7, 3, 11, 12000),
  // Full Plate C
  _armorCraftRow("full_plate_helmet", 10, 4, 15, 18000),
  _armorCraftRow("full_plate_armor", 16, 7, 32, 45000),
  _armorCraftRow("full_plate_gaiters", 12, 5, 22, 28000),
  _armorCraftRow("full_plate_gloves", 7, 3, 12, 13000),
  _armorCraftRow("full_plate_boots", 7, 3, 12, 13000),
  // Karmian C
  _armorCraftRow("karmian_circlet", 7, 3, 11, 11000),
  _armorCraftRow("karmian_tunic", 13, 5, 24, 32000),
  _armorCraftRow("karmian_hose", 9, 4, 16, 20000),
  _armorCraftRow("karmian_gloves", 5, 2, 9, 9000),
  _armorCraftRow("karmian_boots", 5, 2, 9, 9000),
  // Divine C
  _armorCraftRow("divine_circlet", 7, 3, 12, 12000),
  _armorCraftRow("divine_tunic", 13, 5, 25, 34000),
  _armorCraftRow("divine_hose", 9, 4, 17, 21000),
  _armorCraftRow("divine_gloves", 5, 2, 9, 9500),
  _armorCraftRow("divine_boots", 5, 2, 9, 9500),
  // Demon C
  _armorCraftRow("demon_circlet", 7, 3, 12, 12000),
  _armorCraftRow("demon_tunic", 13, 5, 25, 34000),
  _armorCraftRow("demon_hose", 9, 4, 17, 21000),
  _armorCraftRow("demon_gloves", 5, 2, 9, 9500),
  _armorCraftRow("demon_boots", 5, 2, 9, 9500),
];

/**
 * bonuses[n] — активен при ≥n кусках.
 * Без голого +def: sustain/adena/заточка/XP. Бонусы сетов действуют во всех главах.
 * kind: heavy | light | robe — фильтр в Мастерской.
 */
const ARMOR_SETS = {
  bone: {
    id: "bone",
    name: "Bone Set",
    grade: "D",
    kind: "heavy",
    pieces: ["bone_helmet", "bone_breastplate", "bone_gaiters", "bone_gloves", "bone_boots"],
    farmZoneId: "scrap_field",
    bonuses: { 2: { armorSustain: 0.03 }, 4: { armorSustain: 0.02 }, 5: { bossResist: 0.06 } },
  },
  brigandine: {
    id: "brigandine",
    name: "Brigandine Set",
    grade: "D",
    kind: "heavy",
    pieces: ["brigandine_helmet", "brigandine_breastplate", "brigandine_gaiters", "brigandine_gloves", "brigandine_boots"],
    farmZoneId: "scrap_field",
    bonuses: { 2: { mineAdena: 0.04 }, 4: { mineAdena: 0.04 }, 5: { armorSustain: 0.03 } },
  },
  manticore: {
    id: "manticore",
    name: "Manticore Set",
    grade: "D",
    kind: "light",
    pieces: ["manticore_helmet", "manticore_mail", "manticore_gaiters", "manticore_gloves", "manticore_boots"],
    farmZoneId: "scrap_field",
    bonuses: { 2: { mineXp: 0.05 }, 4: { mineXp: 0.05 }, 5: { mineAdena: 0.04 } },
  },
  reinforced: {
    id: "reinforced",
    name: "Reinforced Leather Set",
    grade: "D",
    kind: "light",
    pieces: ["reinforced_helmet", "reinforced_shirt", "reinforced_gaiters", "reinforced_gloves", "reinforced_boots"],
    farmZoneId: "scrap_field",
    bonuses: { 2: { mineXp: 0.04 }, 4: { armorSustain: 0.03 }, 5: { mineAdena: 0.03 } },
  },
  elven_mithril: {
    id: "elven_mithril",
    name: "Elven Mithril Set",
    grade: "D",
    kind: "robe",
    pieces: ["elven_mithril_circlet", "elven_mithril_tunic", "elven_mithril_hose", "elven_mithril_gloves", "elven_mithril_boots"],
    farmZoneId: "scrap_field",
    bonuses: { 2: { enchant: 0.0008 }, 4: { mineXp: 0.05 }, 5: { enchant: 0.0007 } },
  },
  knowledge: {
    id: "knowledge",
    name: "Knowledge Set",
    grade: "D",
    kind: "robe",
    pieces: ["knowledge_circlet", "knowledge_tunic", "knowledge_hose", "knowledge_gloves", "knowledge_boots"],
    farmZoneId: "scrap_field",
    bonuses: { 2: { enchant: 0.001 }, 4: { enchant: 0.0005 }, 5: { mineXp: 0.06 } },
  },
  mithril: {
    id: "mithril",
    name: "Mithril Set",
    grade: "C",
    kind: "heavy",
    pieces: ["mithril_helmet", "mithril_breastplate", "mithril_gaiters", "mithril_gloves", "mithril_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { armorSustain: 0.04 }, 4: { mineAdena: 0.06 }, 5: { enchant: 0.0015, bossResist: 0.1, mineXp: 0.08 } },
  },
  chain: {
    id: "chain",
    name: "Chain Set",
    grade: "C",
    kind: "heavy",
    pieces: ["chain_helmet", "chain_mail", "chain_gaiters", "chain_gloves", "chain_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { armorSustain: 0.04 }, 4: { bossResist: 0.08 }, 5: { armorSustain: 0.03, mineAdena: 0.04 } },
  },
  tempered: {
    id: "tempered",
    name: "Tempered Mithril Set",
    grade: "C",
    kind: "light",
    pieces: ["tempered_helmet", "tempered_shirt", "tempered_gaiters", "tempered_gloves", "tempered_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { mineXp: 0.05 }, 4: { mineAdena: 0.05 }, 5: { armorSustain: 0.04 } },
  },
  theca: {
    id: "theca",
    name: "Theca Leather Set",
    grade: "C",
    kind: "light",
    pieces: ["theca_helmet", "theca_mail", "theca_gaiters", "theca_gloves", "theca_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { armorSustain: 0.035 }, 4: { armorSustain: 0.025 }, 5: { mineAdena: 0.05 } },
  },
  plated: {
    id: "plated",
    name: "Plated Leather Set",
    grade: "C",
    kind: "light",
    pieces: ["plated_helmet", "plated_mail", "plated_gaiters", "plated_gloves", "plated_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { mineAdena: 0.05 }, 4: { mineXp: 0.05 }, 5: { bossResist: 0.07 } },
  },
  drake: {
    id: "drake",
    name: "Drake Leather Set",
    grade: "C",
    kind: "light",
    pieces: ["drake_helmet", "drake_mail", "drake_gaiters", "drake_gloves", "drake_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { bossResist: 0.05 }, 4: { armorSustain: 0.04 }, 5: { bossResist: 0.05, mineXp: 0.05 } },
  },
  composite: {
    id: "composite",
    name: "Composite Set",
    grade: "C",
    kind: "heavy",
    pieces: ["composite_helmet", "composite_armor", "composite_gaiters", "composite_gloves", "composite_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { armorSustain: 0.045 }, 4: { mineAdena: 0.05 }, 5: { armorSustain: 0.03, bossResist: 0.08 } },
  },
  full_plate: {
    id: "full_plate",
    name: "Full Plate Set",
    grade: "C",
    kind: "heavy",
    pieces: ["full_plate_helmet", "full_plate_armor", "full_plate_gaiters", "full_plate_gloves", "full_plate_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { armorSustain: 0.05 }, 4: { armorSustain: 0.03 }, 5: { bossResist: 0.12 } },
  },
  karmian: {
    id: "karmian",
    name: "Karmian Set",
    grade: "C",
    kind: "robe",
    pieces: ["karmian_circlet", "karmian_tunic", "karmian_hose", "karmian_gloves", "karmian_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { enchant: 0.001 }, 4: { mineXp: 0.06 }, 5: { enchant: 0.001, bossResist: 0.06 } },
  },
  divine: {
    id: "divine",
    name: "Divine Set",
    grade: "C",
    kind: "robe",
    pieces: ["divine_circlet", "divine_tunic", "divine_hose", "divine_gloves", "divine_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { armorSustain: 0.03 }, 4: { enchant: 0.001 }, 5: { mineXp: 0.07, armorSustain: 0.03 } },
  },
  demon: {
    id: "demon",
    name: "Demon Set",
    grade: "C",
    kind: "robe",
    pieces: ["demon_circlet", "demon_tunic", "demon_hose", "demon_gloves", "demon_boots"],
    farmZoneId: "mithril_forge",
    bonuses: { 2: { enchant: 0.0012 }, 4: { mineXp: 0.05 }, 5: { enchant: 0.0008, bossResist: 0.05 } },
  },
};

/** Подвиды брони в Мастерской (порядок хаба). */
const ARMOR_KINDS = [
  { id: "heavy", name: "Тяжёлая", short: "Heavy", hint: "Bone · Brigandine · Mithril · Chain · Composite · Full Plate" },
  { id: "light", name: "Лёгкая", short: "Light", hint: "Manticore · Reinforced · Tempered · Theca · Plated · Drake" },
  { id: "robe", name: "Роба", short: "Robe", hint: "Elven Mithril · Knowledge · Karmian · Divine · Demon" },
];

const ARMOR_KIND_ICONS = {
  heavy: "icons/armor_mithril_breastplate_i00.png",
  light: "icons/armor_manticore_skin_shirt_i00.png",
  robe: "icons/armor_demon_tunic_i00.png",
};

/** Шансы фрагмента в side-зонах ARMOR_FRAG_ZONES. */
const ARMOR_FRAG_DROP = {
  normal: 0.14,
  golden: 0.5,
  boss: 0.88,
  qtyNormal: [1, 1],
  qtyGolden: [1, 2],
  qtyBoss: [2, 4],
};

/** Кап sustain от pdef/mdef кусков (доля HP golden/boss). */
const ARMOR_SUSTAIN_FROM_DEF_CAP = 0.1;
const ARMOR_SUSTAIN_DEF_DIV = 620;
const ARMOR_SUSTAIN_TOTAL_CAP = 0.15;
