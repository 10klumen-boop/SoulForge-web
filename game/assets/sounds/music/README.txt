SoulForge — музыка title-экранов (логин / home / settings)
==========================================================

Оригинальные треки Lineage II (NCsoft / NCSOUND). Плеер в правом верхнем углу
на экранах login/home: ‹ ›, полоска перемотки. При каждом входе в сессию —
случайный трек; ручной выбор пишется в state.menuMusicId.

Файлы:
  menu_theme.m4a           — The Call of Destiny (Chaotic Chronicle) — логин L2
  behind_the_mountain.m4a  — Behind the Mountain (Interlude)
  after_the_storm.m4a      — After the Storm
  hall_of_mists.m4a        — Hall of Mists
  island_village.m4a       — Island Village
  lovers_reunited.m4a      — Lovers Reunited
  march_of_heroes.m4a      — March of Heroes

Перекачать / докачать:
  pip install yt-dlp
  python game/tools/fetch_l2_music.py
  python game/tools/fetch_l2_music.py --track behind_the_mountain
  python game/tools/fetch_l2_music.py --list

После замены файлов — поднять SOUND_VER в game/src/data/audio-data.js и Ctrl+F5.
Каталог треков в коде: MENU_MUSIC_TRACKS (audio-data.js).
