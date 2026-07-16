// ===== UI-иконки — расы, классы, зоны, квесты =====
// Расы/классы: портреты с l2-god.ru (Powerwiki GoD), см. game/tools/install_race_icons_from_l2god.py

const UI_RACE_ICON_VER = 11;

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
  workshop: "assets/ui/inventory_book_crop.png?v=10",
  achievements: "assets/ui/bloodhood_icon02_crop.png",
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
};

/** @deprecated use UI_ZONE_RACE_CHIP_ICONS */
const UI_ZONE_ICONS = Object.fromEntries(
  Object.keys(UI_ZONE_RACE_CHIP_ICONS).map((z) => [z, UI_ZONE_RACE_CHIP_ICONS[z].human])
);

function uiZoneChipIcon(zoneId, race) {
  race = race || (typeof currentAvatarRace === "function" ? currentAvatarRace() : null) || state?.avatar?.raceId || "human";
  return UI_ZONE_RACE_CHIP_ICONS[zoneId]?.[race] || UI_ZONE_RACE_CHIP_ICONS[zoneId]?.human || UI_QUEST_ICON;
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
  if (charIco) charIco.src = UI_MENU_ICONS.character;
  if (questIco) questIco.src = UI_MENU_ICONS.quest;
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
