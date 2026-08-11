// ===== Данные: аудио ассеты, каналы, экраны музыки =====
// Вынесено из 03-audio.js; плеер и synth-логика остались в 03-audio.js.

  const AUDIO_BASE = { ui: 0.55, sfx: 0.72, amb: 0.24, dwarf: 0.88, mine: 0.52, music: 0.4 };
  const SOUND_VER = 12;

  const v = (path) => path + "?v=" + SOUND_VER;

  /** OST title-экранов (логин / home / settings…). Выбор сохраняется в state.menuMusicId. */
  const MENU_MUSIC_TRACKS = [
    {
      id: "call_of_destiny",
      title: "The Call of Destiny",
      album: "Chaotic Chronicle",
      file: "menu_theme.m4a",
    },
    {
      id: "behind_the_mountain",
      title: "Behind the Mountain",
      album: "Interlude",
      file: "behind_the_mountain.m4a",
    },
    {
      id: "after_the_storm",
      title: "After the Storm",
      album: "Chaotic Chronicle",
      file: "after_the_storm.m4a",
    },
    {
      id: "hall_of_mists",
      title: "Hall of Mists",
      album: "Chaotic Chronicle",
      file: "hall_of_mists.m4a",
    },
    {
      id: "island_village",
      title: "Island Village",
      album: "Chaotic Chronicle",
      file: "island_village.m4a",
    },
    {
      id: "lovers_reunited",
      title: "Lovers Reunited",
      album: "Chaotic Chronicle",
      file: "lovers_reunited.m4a",
    },
    {
      id: "march_of_heroes",
      title: "March of Heroes",
      album: "Chaotic Chronicle",
      file: "march_of_heroes.m4a",
    },
  ];

  const DEFAULT_MENU_MUSIC_ID = MENU_MUSIC_TRACKS[0].id;

  function resolveMenuMusicTrack(id) {
    const list = MENU_MUSIC_TRACKS;
    if (!list || !list.length) return null;
    const want = id || (typeof state !== "undefined" && state ? state.menuMusicId : null);
    return list.find((t) => t.id === want) || list[0];
  }

  function menuMusicSrc(id) {
    const t = resolveMenuMusicTrack(id);
    if (!t) return "";
    return v("assets/sounds/music/" + t.file);
  }

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
      // legacy-ключ: актуальный трек — через menuMusicSrc() / Audio2
      menu: menuMusicSrc(DEFAULT_MENU_MUSIC_ID),
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
  /** Плеер OST (правый верх) — логин и главное меню. */
  const OST_PLAYER_SCREENS = new Set(["login", "home"]);
  // Ambient только на поле фарма; хаб (персонаж/квесты/инв) — без indoor-шипения
  const SCREEN_AMB = {
    mine: true,
  };

  const DWARF_CATCH = {
    rate: 1.85,
    rewardDelayMs: 520,
  };
