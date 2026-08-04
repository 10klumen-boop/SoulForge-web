// ===== Данные: аудио ассеты, каналы, экраны музыки =====
// Вынесено из 03-audio.js; плеер и synth-логика остались в 03-audio.js.

  const AUDIO_BASE = { ui: 0.55, sfx: 0.72, amb: 0.24, dwarf: 0.88, mine: 0.52, music: 0.4 };
  const SOUND_VER = 11;

  const v = (path) => path + "?v=" + SOUND_VER;

  /** Все farm-зоны с отдельным ambient (ключ = zoneId). */
  const ZONE_AMB_IDS = [
    "banana_mine",
    "elven_ruins",
    "wasteland",
    "race_outskirts",
    "abandoned_camp",
    "ruins_agony",
    "abandoned_coal_low",
    "execution_grounds",
    "windmill_hill",
    "fellmere_harvesting",
    "neutral_zone",
    "langk_lizardman",
    "maille_lizardman",
    "ruins_despair",
    "evil_hunting_grounds",
    "orc_barracks_hunt",
    "dion_hills",
    "bee_hive",
    "plains_of_dion",
    "partisans_hideaway",
    "floran_agricultural",
    "cruma_marshlands",
    "ant_nest",
    "cruma_tower_entrance",
    "school_of_dark_arts",
    "elven_ruins_hunt",
    "death_pass",
    "gorgon_flower_garden",
    "breka_stronghold",
    "dragon_valley_entrance",
    "enchanted_valley",
    "sea_of_spores",
    "alligator_island",
    "blazing_swamp",
    "orc_barracks",
    "dark_cavern",
    "dwarven_depths",
  ];

  const ZONE_AMB_FALLBACK = "banana_mine";

  const AUDIO_FILES = {
    music: {
      menu: v("assets/sounds/music/menu_theme.m4a"),
    },
    ui: {
      click: v("assets/sounds/ui/click.wav"),
      coin: v("assets/sounds/ui/coin.wav"),
      open: v("assets/sounds/ui/open.wav"),
    },
    sfx: {
      charge: v("assets/sounds/sfx/enchant_charge.wav"),
      success: v("assets/sounds/sfx/enchant_success.wav"),
      fail: v("assets/sounds/sfx/enchant_fail.wav"),
      jackpot: v("assets/sounds/sfx/jackpot.wav"),
      treasure: v("assets/sounds/sfx/treasure.wav"),
      quest: v("assets/sounds/sfx/quest.wav"),
      levelup: v("assets/sounds/sfx/levelup.wav"),
      mineHit: [
        v("assets/sounds/sfx/mine_hit.wav"),
        v("assets/sounds/sfx/mine_hit_2.wav"),
        v("assets/sounds/sfx/mine_hit_3.wav"),
        v("assets/sounds/sfx/mine_hit_4.wav"),
        v("assets/sounds/sfx/mine_hit_5.wav"),
      ],
      mineKill: v("assets/sounds/sfx/mine_kill.wav"),
      equipWeapon: v("assets/sounds/sfx/equip_weapon.wav"),
      equipArmor: v("assets/sounds/sfx/equip_armor.wav"),
      equipJewelry: v("assets/sounds/sfx/equip_jewelry.wav"),
    },
    amb: (() => {
      const amb = {
        // legacy fallback (не хаб)
        mine: v("assets/sounds/ambient/mine.wav"),
      };
      ZONE_AMB_IDS.forEach((id) => {
        amb[id] = v("assets/sounds/ambient/zones/" + id + ".wav");
      });
      return amb;
    })(),
    dwarf: {
      M: v("assets/sounds/dwarf/M.wav"),
      F: v("assets/sounds/dwarf/F.wav"),
    },
  };

  /** zoneId → ключ в AUDIO_FILES.amb (сейчас 1:1). */
  const ZONE_AMB = Object.fromEntries(ZONE_AMB_IDS.map((id) => [id, id]));

  function resolveZoneAmbienceKey(zoneId) {
    const zid =
      typeof resolveFarmZoneId === "function" ? resolveFarmZoneId(zoneId) : zoneId;
    if (zid && ZONE_AMB[zid]) return ZONE_AMB[zid];
    if (zid && AUDIO_FILES.amb[zid]) return zid;
    return ZONE_AMB_FALLBACK;
  }

  // OST только на title-экранах; хаб игры (menu) — без музыки
  const MUSIC_SCREENS = new Set(["login", "home", "settings", "patch", "author", "characters"]);
  // Ambient только на поле фарма; хаб (персонаж/квесты/инв) — без indoor-шипения
  const SCREEN_AMB = {
    mine: true,
  };

  const DWARF_CATCH = {
    rate: 1.85,
    rewardDelayMs: 520,
  };
