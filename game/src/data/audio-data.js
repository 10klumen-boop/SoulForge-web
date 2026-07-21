// ===== Данные: аудио ассеты, каналы, экраны музыки =====
// Вынесено из 03-audio.js; плеер и synth-логика остались в 03-audio.js.

  const AUDIO_BASE = { ui: 0.55, sfx: 0.72, amb: 0.24, dwarf: 0.88, mine: 0.48, music: 0.4 };
  const SOUND_VER = 8;

  const v = (path) => path + "?v=" + SOUND_VER;

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
      ],
      mineKill: v("assets/sounds/sfx/mine_kill.wav"),
    },
    amb: {
      mine: v("assets/sounds/ambient/mine.wav"),
      indoor: v("assets/sounds/ambient/indoor.wav"),
    },
    dwarf: {
      M: v("assets/sounds/dwarf/M.wav"),
      F: v("assets/sounds/dwarf/F.wav"),
    },
  };

  // OST ╤В╨╛╨╗╤М╨║╨╛ ╨╜╨░ title-╤Н╨║╤А╨░╨╜╨░╤Е; ╤Е╨░╨▒ ╨╕╨│╤А╤Л (menu) тАФ ╨▒╨╡╨╖ ╨╝╤Г╨╖╤Л╨║╨╕
  const MUSIC_SCREENS = new Set(["login", "home", "settings", "patch", "author", "characters"]);
  // Ambient только на поле фарма; хаб (персонаж/квесты/инв) — без indoor-шипения
  const SCREEN_AMB = {
    mine: "mine",
  };

  const DWARF_CATCH = {
    rate: 1.85,
    rewardDelayMs: 520,
  };
