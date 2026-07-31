// ===== UI-иконки — расы, классы, зоны, квесты =====
// Расы/классы: портреты с l2-god.ru (Powerwiki GoD), см. game/tools/install_race_icons_from_l2god.py

const UI_RACE_ICON_VER = 12;

/** Портреты рас (воинский облик) — выбор расы при создании. */
const UI_RACE_ICONS = {
  human: "icons/race_human.png?v=" + UI_RACE_ICON_VER,
  elf: "icons/race_elf.png?v=" + UI_RACE_ICON_VER,
  dark_elf: "icons/race_dark_elf.png?v=" + UI_RACE_ICON_VER,
  orc: "icons/race_orc.png?v=" + UI_RACE_ICON_VER,
  dwarf: "icons/race_dwarf.png?v=" + UI_RACE_ICON_VER,
};

/** Фоллбек архетипов (если нет расово-специфичной). */
const UI_CLASS_ICONS = {
  fighter: "icons/class_fighter.png?v=" + UI_RACE_ICON_VER,
  mystic: "icons/class_mystic.png?v=" + UI_RACE_ICON_VER,
  shaman: "icons/class_mystic.png?v=" + UI_RACE_ICON_VER,
};

/** Архетипы по расе — портреты Fighter/Mystic с той же страницы l2-god. */
const UI_ARCHETYPE_ICONS = {
  human: {
    fighter: "icons/class_human_fighter.png?v=" + UI_RACE_ICON_VER,
    mystic: "icons/class_human_mystic.png?v=" + UI_RACE_ICON_VER,
  },
  elf: {
    fighter: "icons/class_elf_fighter.png?v=" + UI_RACE_ICON_VER,
    mystic: "icons/class_elf_mystic.png?v=" + UI_RACE_ICON_VER,
  },
  dark_elf: {
    fighter: "icons/class_dark_elf_fighter.png?v=" + UI_RACE_ICON_VER,
    mystic: "icons/class_dark_elf_mystic.png?v=" + UI_RACE_ICON_VER,
  },
  orc: {
    fighter: "icons/class_orc_fighter.png?v=" + UI_RACE_ICON_VER,
    shaman: "icons/class_orc_shaman.png?v=" + UI_RACE_ICON_VER,
  },
  dwarf: {
    fighter: "icons/class_dwarf_fighter.png?v=" + UI_RACE_ICON_VER,
  },
};

/** Плитки главного меню. */
const UI_MENU_ICONS = {
  character: "icons/char_menu.png?v=10",
  quest: "icons/quest_journal.png?v=10",
  inventory: "assets/ui/menubutton2_crop.png?v=10",
  warehouse: "icons/account_warehouse.png?v=1",
  mail: "icons/etc_letter_envelope_i00.png?v=1",
  party: "icons/party_menu.png?v=2",
  clan: "icons/party_menu.png?v=2",
  arena: "icons/arena_menu.png?v=1",
  market: "icons/warehouse_chest.png?v=1",
  bananaCasino: "icons/banana_casino_menu.png?v=1",
  workshop: "assets/ui/inventory_book_crop.png?v=10",
  achievements: "assets/ui/bloodhood_icon02_crop.png",
  glossary: "icons/glossary_menu.png?v=1",
};

/** Кнопки входа История/Фарм и разделы мастерской. */
const UI_HUB_BTN_VER = 5;
const UI_HUB_BTN_ICONS = {
  story: "icons/btn_story.png?v=" + UI_HUB_BTN_VER,
  farm: "icons/btn_farm.png?v=" + UI_HUB_BTN_VER,
  shots: "icons/btn_shots.png?v=" + UI_HUB_BTN_VER,
  armor: "icons/btn_armor.png?v=" + UI_HUB_BTN_VER,
  jewelry: "icons/btn_jewelry.png?v=1",
  chapters: "icons/btn_chapters.png?v=1",
  chapterStory: "icons/btn_chapter_story.png?v=1",
  play: "icons/btn_play.png?v=1",
};

/** Иконка «задание» / квест-баннер по умолчанию. */
const UI_QUEST_ICON = "icons/quest_journal.png?v=10";

/** AI-иконки зон фарма: zone_id × race → icons/zones/{zone}_{race}.png */
const UI_ZONE_RACE_CHIP_ICONS = {
  banana_mine: {
    human: "icons/zones/banana_mine_human.png?v=3",
    elf: "icons/zones/banana_mine_elf.png?v=3",
    dark_elf: "icons/zones/banana_mine_dark_elf.png?v=3",
    orc: "icons/zones/banana_mine_orc.png?v=3",
    dwarf: "icons/zones/banana_mine_dwarf.png?v=3",
  },
  elven_ruins: {
    human: "icons/zones/elven_ruins_human.png?v=3",
    elf: "icons/zones/elven_ruins_elf.png?v=3",
    dark_elf: "icons/zones/elven_ruins_dark_elf.png?v=3",
    orc: "icons/zones/elven_ruins_orc.png?v=3",
    dwarf: "icons/zones/elven_ruins_dwarf.png?v=3",
  },
  // Side-фарм кусков D-сетов
  wasteland: {
    human: "icons/zones/wasteland_human.png?v=2",
    elf: "icons/zones/wasteland_elf.png?v=2",
    dark_elf: "icons/zones/wasteland_dark_elf.png?v=2",
    orc: "icons/zones/wasteland_orc.png?v=2",
    dwarf: "icons/zones/wasteland_dwarf.png?v=2",
  },
  // Временно те же чипы, что у руин — отдельный AI-набор позже
  abandoned_coal_low: {
    human: "icons/zones/abandoned_coal_low_human.png?v=1",
    elf: "icons/zones/abandoned_coal_low_elf.png?v=1",
    dark_elf: "icons/zones/abandoned_coal_low_dark_elf.png?v=1",
    orc: "icons/zones/abandoned_coal_low_orc.png?v=1",
    dwarf: "icons/zones/abandoned_coal_low_dwarf.png?v=1",
  },
  orc_barracks: {
    human: "icons/zones/orc_barracks_human.png?v=3",
    elf: "icons/zones/orc_barracks_elf.png?v=3",
    dark_elf: "icons/zones/orc_barracks_dark_elf.png?v=3",
    orc: "icons/zones/orc_barracks_orc.png?v=3",
    dwarf: "icons/zones/orc_barracks_dwarf.png?v=3",
  },
  dark_cavern: {
    human: "icons/zones/dark_cavern_human.png?v=3",
    elf: "icons/zones/dark_cavern_elf.png?v=3",
    dark_elf: "icons/zones/dark_cavern_dark_elf.png?v=3",
    orc: "icons/zones/dark_cavern_orc.png?v=3",
    dwarf: "icons/zones/dark_cavern_dwarf.png?v=3",
  },
  dwarven_depths: {
    human: "icons/zones/dwarven_depths_human.png?v=3",
    elf: "icons/zones/dwarven_depths_elf.png?v=3",
    dark_elf: "icons/zones/dwarven_depths_dark_elf.png?v=3",
    orc: "icons/zones/dwarven_depths_orc.png?v=3",
    dwarf: "icons/zones/dwarven_depths_dwarf.png?v=3",
  },

  race_outskirts: {
    human: "icons/zones/race_outskirts_human.png?v=1",
    elf: "icons/zones/race_outskirts_elf.png?v=1",
    dark_elf: "icons/zones/race_outskirts_dark_elf.png?v=1",
    orc: "icons/zones/race_outskirts_orc.png?v=1",
    dwarf: "icons/zones/race_outskirts_dwarf.png?v=1",
  },
  abandoned_camp: {
    human: "icons/zones/abandoned_camp_human.png?v=2",
    elf: "icons/zones/abandoned_camp_elf.png?v=2",
    dark_elf: "icons/zones/abandoned_camp_dark_elf.png?v=2",
    orc: "icons/zones/abandoned_camp_orc.png?v=2",
    dwarf: "icons/zones/abandoned_camp_dwarf.png?v=2",
  },
  ruins_agony: {
    human: "icons/zones/ruins_agony_human.png?v=2",
    elf: "icons/zones/ruins_agony_elf.png?v=2",
    dark_elf: "icons/zones/ruins_agony_dark_elf.png?v=2",
    orc: "icons/zones/ruins_agony_orc.png?v=2",
    dwarf: "icons/zones/ruins_agony_dwarf.png?v=2",
  },
  execution_grounds: {
    human: "icons/zones/execution_grounds_human.png?v=2",
    elf: "icons/zones/execution_grounds_elf.png?v=2",
    dark_elf: "icons/zones/execution_grounds_dark_elf.png?v=2",
    orc: "icons/zones/execution_grounds_orc.png?v=2",
    dwarf: "icons/zones/execution_grounds_dwarf.png?v=2",
  },
  windmill_hill: {
    human: "icons/zones/windmill_hill_human.png?v=2",
    elf: "icons/zones/windmill_hill_elf.png?v=2",
    dark_elf: "icons/zones/windmill_hill_dark_elf.png?v=2",
    orc: "icons/zones/windmill_hill_orc.png?v=2",
    dwarf: "icons/zones/windmill_hill_dwarf.png?v=2",
  },
  fellmere_harvesting: {
    human: "icons/zones/fellmere_harvesting_human.png?v=2",
    elf: "icons/zones/fellmere_harvesting_elf.png?v=2",
    dark_elf: "icons/zones/fellmere_harvesting_dark_elf.png?v=2",
    orc: "icons/zones/fellmere_harvesting_orc.png?v=2",
    dwarf: "icons/zones/fellmere_harvesting_dwarf.png?v=2",
  },
  neutral_zone: {
    human: "icons/zones/neutral_zone_human.png?v=1",
    elf: "icons/zones/neutral_zone_elf.png?v=1",
    dark_elf: "icons/zones/neutral_zone_dark_elf.png?v=1",
    orc: "icons/zones/neutral_zone_orc.png?v=1",
    dwarf: "icons/zones/neutral_zone_dwarf.png?v=1",
  },
  langk_lizardman: {
    human: "icons/zones/langk_lizardman_human.png?v=1",
    elf: "icons/zones/langk_lizardman_elf.png?v=1",
    dark_elf: "icons/zones/langk_lizardman_dark_elf.png?v=1",
    orc: "icons/zones/langk_lizardman_orc.png?v=1",
    dwarf: "icons/zones/langk_lizardman_dwarf.png?v=1",
  },
  maille_lizardman: {
    human: "icons/zones/maille_lizardman_human.png?v=1",
    elf: "icons/zones/maille_lizardman_elf.png?v=1",
    dark_elf: "icons/zones/maille_lizardman_dark_elf.png?v=1",
    orc: "icons/zones/maille_lizardman_orc.png?v=1",
    dwarf: "icons/zones/maille_lizardman_dwarf.png?v=1",
  },
  ruins_despair: {
    human: "icons/zones/ruins_despair_human.png?v=1",
    elf: "icons/zones/ruins_despair_elf.png?v=1",
    dark_elf: "icons/zones/ruins_despair_dark_elf.png?v=1",
    orc: "icons/zones/ruins_despair_orc.png?v=1",
    dwarf: "icons/zones/ruins_despair_dwarf.png?v=1",
  },
  evil_hunting_grounds: {
    human: "icons/zones/evil_hunting_grounds_human.png?v=1",
    elf: "icons/zones/evil_hunting_grounds_elf.png?v=1",
    dark_elf: "icons/zones/evil_hunting_grounds_dark_elf.png?v=1",
    orc: "icons/zones/evil_hunting_grounds_orc.png?v=1",
    dwarf: "icons/zones/evil_hunting_grounds_dwarf.png?v=1",
  },
  orc_barracks_hunt: {
    human: "icons/zones/orc_barracks_hunt_human.png?v=1",
    elf: "icons/zones/orc_barracks_hunt_elf.png?v=1",
    dark_elf: "icons/zones/orc_barracks_hunt_dark_elf.png?v=1",
    orc: "icons/zones/orc_barracks_hunt_orc.png?v=1",
    dwarf: "icons/zones/orc_barracks_hunt_dwarf.png?v=1",
  },
  dion_hills: {
    human: "icons/zones/dion_hills_human.png?v=1",
    elf: "icons/zones/dion_hills_elf.png?v=1",
    dark_elf: "icons/zones/dion_hills_dark_elf.png?v=1",
    orc: "icons/zones/dion_hills_orc.png?v=1",
    dwarf: "icons/zones/dion_hills_dwarf.png?v=1",
  },
  bee_hive: {
    human: "icons/zones/bee_hive_human.png?v=1",
    elf: "icons/zones/bee_hive_elf.png?v=1",
    dark_elf: "icons/zones/bee_hive_dark_elf.png?v=1",
    orc: "icons/zones/bee_hive_orc.png?v=1",
    dwarf: "icons/zones/bee_hive_dwarf.png?v=1",
  },
  plains_of_dion: {
    human: "icons/zones/plains_of_dion_human.png?v=1",
    elf: "icons/zones/plains_of_dion_elf.png?v=1",
    dark_elf: "icons/zones/plains_of_dion_dark_elf.png?v=1",
    orc: "icons/zones/plains_of_dion_orc.png?v=1",
    dwarf: "icons/zones/plains_of_dion_dwarf.png?v=1",
  },
  partisans_hideaway: {
    human: "icons/zones/partisans_hideaway_human.png?v=1",
    elf: "icons/zones/partisans_hideaway_elf.png?v=1",
    dark_elf: "icons/zones/partisans_hideaway_dark_elf.png?v=1",
    orc: "icons/zones/partisans_hideaway_orc.png?v=1",
    dwarf: "icons/zones/partisans_hideaway_dwarf.png?v=1",
  },
  floran_agricultural: {
    human: "icons/zones/floran_agricultural_human.png?v=1",
    elf: "icons/zones/floran_agricultural_elf.png?v=1",
    dark_elf: "icons/zones/floran_agricultural_dark_elf.png?v=1",
    orc: "icons/zones/floran_agricultural_orc.png?v=1",
    dwarf: "icons/zones/floran_agricultural_dwarf.png?v=1",
  },
  cruma_marshlands: {
    human: "icons/zones/cruma_marshlands_human.png?v=1",
    elf: "icons/zones/cruma_marshlands_elf.png?v=1",
    dark_elf: "icons/zones/cruma_marshlands_dark_elf.png?v=1",
    orc: "icons/zones/cruma_marshlands_orc.png?v=1",
    dwarf: "icons/zones/cruma_marshlands_dwarf.png?v=1",
  },
  ant_nest: {
    human: "icons/zones/ant_nest_human.png?v=1",
    elf: "icons/zones/ant_nest_elf.png?v=1",
    dark_elf: "icons/zones/ant_nest_dark_elf.png?v=1",
    orc: "icons/zones/ant_nest_orc.png?v=1",
    dwarf: "icons/zones/ant_nest_dwarf.png?v=1",
  },
  cruma_tower_entrance: {
    human: "icons/zones/cruma_tower_entrance_human.png?v=1",
    elf: "icons/zones/cruma_tower_entrance_elf.png?v=1",
    dark_elf: "icons/zones/cruma_tower_entrance_dark_elf.png?v=1",
    orc: "icons/zones/cruma_tower_entrance_orc.png?v=1",
    dwarf: "icons/zones/cruma_tower_entrance_dwarf.png?v=1",
  },
  school_of_dark_arts: {
    human: "icons/zones/school_of_dark_arts_human.png?v=1",
    elf: "icons/zones/school_of_dark_arts_elf.png?v=1",
    dark_elf: "icons/zones/school_of_dark_arts_dark_elf.png?v=1",
    orc: "icons/zones/school_of_dark_arts_orc.png?v=1",
    dwarf: "icons/zones/school_of_dark_arts_dwarf.png?v=1",
  },
  elven_ruins_hunt: {
    human: "icons/zones/elven_ruins_hunt_human.png?v=1",
    elf: "icons/zones/elven_ruins_hunt_elf.png?v=1",
    dark_elf: "icons/zones/elven_ruins_hunt_dark_elf.png?v=1",
    orc: "icons/zones/elven_ruins_hunt_orc.png?v=1",
    dwarf: "icons/zones/elven_ruins_hunt_dwarf.png?v=1",
  },
  death_pass: {
    human: "icons/zones/death_pass_human.png?v=1",
    elf: "icons/zones/death_pass_elf.png?v=1",
    dark_elf: "icons/zones/death_pass_dark_elf.png?v=1",
    orc: "icons/zones/death_pass_orc.png?v=1",
    dwarf: "icons/zones/death_pass_dwarf.png?v=1",
  },
  gorgon_flower_garden: {
    human: "icons/zones/gorgon_flower_garden_human.png?v=1",
    elf: "icons/zones/gorgon_flower_garden_elf.png?v=1",
    dark_elf: "icons/zones/gorgon_flower_garden_dark_elf.png?v=1",
    orc: "icons/zones/gorgon_flower_garden_orc.png?v=1",
    dwarf: "icons/zones/gorgon_flower_garden_dwarf.png?v=1",
  },
  breka_stronghold: {
    human: "icons/zones/breka_stronghold_human.png?v=1",
    elf: "icons/zones/breka_stronghold_elf.png?v=1",
    dark_elf: "icons/zones/breka_stronghold_dark_elf.png?v=1",
    orc: "icons/zones/breka_stronghold_orc.png?v=1",
    dwarf: "icons/zones/breka_stronghold_dwarf.png?v=1",
  },
  dragon_valley_entrance: {
    human: "icons/zones/dragon_valley_entrance_human.png?v=1",
    elf: "icons/zones/dragon_valley_entrance_elf.png?v=1",
    dark_elf: "icons/zones/dragon_valley_entrance_dark_elf.png?v=1",
    orc: "icons/zones/dragon_valley_entrance_orc.png?v=1",
    dwarf: "icons/zones/dragon_valley_entrance_dwarf.png?v=1",
  },
  enchanted_valley: {
    human: "icons/zones/enchanted_valley_human.png?v=1",
    elf: "icons/zones/enchanted_valley_elf.png?v=1",
    dark_elf: "icons/zones/enchanted_valley_dark_elf.png?v=1",
    orc: "icons/zones/enchanted_valley_orc.png?v=1",
    dwarf: "icons/zones/enchanted_valley_dwarf.png?v=1",
  },
  sea_of_spores: {
    human: "icons/zones/sea_of_spores_human.png?v=1",
    elf: "icons/zones/sea_of_spores_elf.png?v=1",
    dark_elf: "icons/zones/sea_of_spores_dark_elf.png?v=1",
    orc: "icons/zones/sea_of_spores_orc.png?v=1",
    dwarf: "icons/zones/sea_of_spores_dwarf.png?v=1",
  },
  alligator_island: {
    human: "icons/zones/alligator_island_human.png?v=1",
    elf: "icons/zones/alligator_island_elf.png?v=1",
    dark_elf: "icons/zones/alligator_island_dark_elf.png?v=1",
    orc: "icons/zones/alligator_island_orc.png?v=1",
    dwarf: "icons/zones/alligator_island_dwarf.png?v=1",
  },
  blazing_swamp: {
    human: "icons/zones/blazing_swamp_human.png?v=1",
    elf: "icons/zones/blazing_swamp_elf.png?v=1",
    dark_elf: "icons/zones/blazing_swamp_dark_elf.png?v=1",
    orc: "icons/zones/blazing_swamp_orc.png?v=1",
    dwarf: "icons/zones/blazing_swamp_dwarf.png?v=1",
  },

};

/** @deprecated use UI_ZONE_RACE_CHIP_ICONS */
const UI_ZONE_ICONS = Object.fromEntries(
  Object.keys(UI_ZONE_RACE_CHIP_ICONS).map((z) => [z, UI_ZONE_RACE_CHIP_ICONS[z].human])
);

function uiZoneChipIcon(zoneId, race) {
  if (typeof resolveFarmZoneId === "function") zoneId = resolveFarmZoneId(zoneId);
  if (zoneId === "scrap_field") zoneId = "wasteland";
  if (zoneId === "mithril_forge") zoneId = "abandoned_coal_low";
  race = race || (typeof currentAvatarRace === "function" ? currentAvatarRace() : null) || state?.avatar?.raceId || "human";
  return UI_ZONE_RACE_CHIP_ICONS[zoneId]?.[race] || UI_ZONE_RACE_CHIP_ICONS[zoneId]?.human || UI_QUEST_ICON;
}

/** Чипы без рамки в PNG (кроп с BG). Остальные — legacy с бронзовой рамкой. */
const ZONE_CHIP_FRAMELESS_IDS = {
  abandoned_coal_low: 1,
  race_outskirts: 1,
  blazing_swamp: 1,
  alligator_island: 1,
  sea_of_spores: 1,
  enchanted_valley: 1,
  dragon_valley_entrance: 1,
  breka_stronghold: 1,
  gorgon_flower_garden: 1,
  death_pass: 1,
  elven_ruins_hunt: 1,
  school_of_dark_arts: 1,
  cruma_tower_entrance: 1,
  ant_nest: 1,
  cruma_marshlands: 1,
  floran_agricultural: 1,
  partisans_hideaway: 1,
  plains_of_dion: 1,
  bee_hive: 1,
  dion_hills: 1,
  wasteland: 1,
  abandoned_camp: 1,
  ruins_agony: 1,
  execution_grounds: 1,
  windmill_hill: 1,
  fellmere_harvesting: 1,
  neutral_zone: 1,
  langk_lizardman: 1,
  maille_lizardman: 1,
  ruins_despair: 1,
  evil_hunting_grounds: 1,
  orc_barracks_hunt: 1,
};

function zoneChipArtIsFramed(zoneId) {
  if (typeof resolveFarmZoneId === "function") zoneId = resolveFarmZoneId(zoneId);
  if (zoneId === "scrap_field") zoneId = "wasteland";
  if (zoneId === "mithril_forge") zoneId = "abandoned_coal_low";
  return !ZONE_CHIP_FRAMELESS_IDS[zoneId];
}

/** Глава I — иконка локации по расе. */
const UI_ZONE_RACE_ICONS = {
  banana_mine: {
    human: "icons/weapon_long_sword_i00.png",
    elf: "icons/weapon_elven_long_sword_i00.png",
    dark_elf: "icons/weapon_dark_screamer_i00.png",
    orc: "icons/weapon_paagrio_hammer_i00.png",
    dwarf: "icons/weapon_dwarven_hammer_i00.png",
  },
};

/** NPC квестов: race → zone → icon (wiki). */
const UI_QUEST_NPC_ICONS = {
  human: {
    banana_mine: "icons/weapon_long_sword_i00.png",
    elven_ruins: "icons/etc_spellbook_blue_i00.png",
    orc_barracks: "icons/weapon_mace_of_judgment_i00.png",
    dark_cavern: "icons/etc_spellbook_red_i00.png",
    dwarven_depths: "icons/etc_letter_envelope_i00.png",
  },
  elf: {
    banana_mine: "icons/skill1902.png",
    elven_ruins: "icons/etc_broken_crystal_silver_i00.png",
    orc_barracks: "icons/weapon_elven_long_sword_i00.png",
    dark_cavern: "icons/skill1016.png",
    dwarven_depths: "icons/etc_spellbook_blue_i00.png",
  },
  dark_elf: {
    banana_mine: "icons/skill1903.png",
    elven_ruins: "icons/weapon_dark_screamer_i00.png",
    orc_barracks: "icons/skill0330.png",
    dark_cavern: "icons/etc_broken_crystal_red_i00.png",
    dwarven_depths: "icons/weapon_dark_screamer_i00.png",
  },
  orc: {
    banana_mine: "icons/skill1904.png",
    elven_ruins: "icons/weapon_orcish_poleaxe_i00.png",
    orc_barracks: "icons/weapon_buzdygan_i00.png",
    dark_cavern: "icons/weapon_great_axe_i00.png",
    dwarven_depths: "icons/weapon_paagrio_hammer_i00.png",
  },
  dwarf: {
    banana_mine: "icons/skill1921.png",
    elven_ruins: "icons/weapon_dwarven_hammer_i00.png",
    orc_barracks: "icons/etc_coins_gold_i00.png",
    dark_cavern: "icons/etc_mineral_special_i00.png",
    dwarven_depths: "icons/etc_crystal_blue_i00.png",
  },
};

function uiQuestNpcIcon(race, zoneId) {
  return UI_QUEST_NPC_ICONS[race]?.[zoneId] || UI_QUEST_NPC_ICONS.human?.[zoneId] || UI_QUEST_ICON;
}

function applyUiIconsToFarmZones() {
  if (typeof FARM_ZONES === "undefined") return;
  FARM_ZONES.forEach((zone) => {
    if (UI_ZONE_ICONS[zone.id]) zone.icon = UI_ZONE_ICONS[zone.id];
    const raceMap = UI_ZONE_RACE_ICONS[zone.id];
    if (!raceMap || !zone.raceSkin) return;
    Object.keys(raceMap).forEach((race) => {
      if (zone.raceSkin[race]) zone.raceSkin[race].icon = raceMap[race];
    });
  });
}

function applyUiIconsToQuestNpcs() {
  if (typeof QUEST_NPC_BY_RACE_ZONE === "undefined") return;
  Object.keys(UI_QUEST_NPC_ICONS).forEach((race) => {
    Object.keys(UI_QUEST_NPC_ICONS[race]).forEach((zoneId) => {
      if (QUEST_NPC_BY_RACE_ZONE[race]?.[zoneId]) {
        QUEST_NPC_BY_RACE_ZONE[race][zoneId].icon = UI_QUEST_NPC_ICONS[race][zoneId];
      }
    });
  });
}

function syncMenuTileIcons() {
  const charIco = document.querySelector("#avatarTile .tile-ico");
  const questIco = document.querySelector("#questTile .tile-ico");
  const whIco = document.querySelector("#accountStorageTile .tile-ico");
  const mailIco = document.querySelector("#playerMailTile .tile-ico");
  const partyIco = document.querySelector("#partyTile .tile-ico");
  const clanIco = document.querySelector("#clanTile .tile-ico");
  const marketIco = document.querySelector("#marketTile .tile-ico");
  const arenaIco = document.querySelector("#pvpArenaTile .tile-ico");
  const bananaIco = document.querySelector("#bananaCasinoTile .tile-ico");
  if (charIco) charIco.src = UI_MENU_ICONS.character;
  if (questIco) questIco.src = UI_MENU_ICONS.quest;
  if (whIco && UI_MENU_ICONS.warehouse) whIco.src = UI_MENU_ICONS.warehouse;
  if (mailIco && UI_MENU_ICONS.mail) mailIco.src = UI_MENU_ICONS.mail;
  if (partyIco && UI_MENU_ICONS.party) partyIco.src = UI_MENU_ICONS.party;
  if (clanIco && UI_MENU_ICONS.clan) clanIco.src = UI_MENU_ICONS.clan;
  if (marketIco && UI_MENU_ICONS.market) marketIco.src = UI_MENU_ICONS.market;
  if (bananaIco && UI_MENU_ICONS.bananaCasino) bananaIco.src = UI_MENU_ICONS.bananaCasino;
  if (arenaIco && UI_MENU_ICONS.arena) arenaIco.src = UI_MENU_ICONS.arena;
  const glossIco = document.querySelector("#glossaryTile .tile-ico");
  if (glossIco && UI_MENU_ICONS.glossary) glossIco.src = UI_MENU_ICONS.glossary;
}

function devWorldIconEntries() {
  const entries = [];
  if (typeof L2_RACES !== "undefined") {
    L2_RACES.forEach((r) => entries.push({ group: "Расы", label: r.name, path: r.icon }));
  }
  if (typeof L2_CLASSES !== "undefined") {
    Object.values(L2_CLASSES).forEach((c) => entries.push({ group: "Классы", label: c.name, path: c.icon }));
  }
  if (typeof FARM_ZONES !== "undefined") {
    FARM_ZONES.forEach((z) => {
      const raceMap = UI_ZONE_RACE_CHIP_ICONS[z.id];
      if (raceMap) {
        Object.keys(raceMap).forEach((race) => {
          entries.push({ group: "Зоны · " + race, label: (z.raceSkin?.[race]?.name || z.name) + " · " + z.id, path: raceMap[race] });
        });
      }
      entries.push({ group: "Локации", label: z.name + " · " + z.id, path: UI_ZONE_ICONS[z.id] || z.icon });
      if (z.raceSkin) {
        Object.keys(z.raceSkin).forEach((race) => {
          const skin = z.raceSkin[race];
          if (skin.icon && skin.icon !== z.icon) {
            entries.push({ group: "Локации · " + race, label: skin.name || race, path: skin.icon });
          }
        });
      }
    });
  }
  if (typeof QUEST_NPC_BY_RACE_ZONE !== "undefined") {
    Object.keys(QUEST_NPC_BY_RACE_ZONE).forEach((race) => {
      Object.keys(QUEST_NPC_BY_RACE_ZONE[race]).forEach((zoneId) => {
        const npc = QUEST_NPC_BY_RACE_ZONE[race][zoneId];
        entries.push({ group: "Квест · " + race, label: npc.name, path: npc.icon });
      });
    });
  }
  return entries;
}
