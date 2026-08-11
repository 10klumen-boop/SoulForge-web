// ===== ╨Ч╨▓╤Г╨║: L2 Interlude samples + OST + ╨║╨░╨╜╨░╨╗╤Л ╨│╤А╨╛╨╝╨║╨╛╤Б╤В╨╕ =====
const Audio2 = (() => {
  const BASE = AUDIO_BASE;
  const FILES = AUDIO_FILES;


  let ctx;
  const sampleOk = {};
  const preloadStarted = {};

  function isSilent() {
    return !!state.muted;
  }

  function ensureAudioVol() {
    if (typeof defaultAudioVol !== "function") return;
    if (!state.audioVol || typeof state.audioVol !== "object") state.audioVol = defaultAudioVol();
    else {
      const d = defaultAudioVol();
      for (const k of Object.keys(d)) {
        if (typeof state.audioVol[k] !== "number") state.audioVol[k] = d[k];
      }
    }
  }

  function chVol(channel) {
    if (isSilent()) return 0;
    ensureAudioVol();
    const m = state.audioVol.master ?? 1;
    const c = state.audioVol[channel] ?? 1;
    return Math.max(0, Math.min(1, m * c));
  }

  function eff(base, channel) {
    return base * chVol(channel);
  }

  function ac() {
    return ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
  }

  function activeScreenId() {
    const active = document.querySelector(".screen.active");
    return active && active.id ? active.id.replace("screen-", "") : "";
  }

  function unlock() {
    if (isSilent()) return;
    const c = ac();
    if (c.state === "suspended") c.resume().catch(() => {});
  }

  function shouldPlayMusic(screen) {
    return MUSIC_SCREENS.has(screen || activeScreenId());
  }

  function tone(freq, t0, dur, type = "sine", gain = 0.2, slideTo, channel = "sfx") {
    if (isSilent()) return;
    unlock();
    gain *= chVol(channel);
    if (gain <= 0.0001) return;
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + t0 + dur);
    g.gain.setValueAtTime(0, c.currentTime + t0);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + t0);
    o.stop(c.currentTime + t0 + dur + 0.02);
  }

  function noise(t0, dur, gain = 0.25, channel = "sfx") {
    if (isSilent()) return;
    unlock();
    gain *= chVol(channel);
    if (gain <= 0.0001) return;
    const c = ac();
    const n = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const g = c.createGain();
    g.gain.value = gain;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1200;
    n.connect(f);
    f.connect(g);
    g.connect(c.destination);
    n.start(c.currentTime + t0);
  }

  function markSample(src, ok) {
    if (ok) sampleOk[src] = true;
    else if (sampleOk[src] == null) sampleOk[src] = false;
  }

  function probeSample(src) {
    if (sampleOk[src] === true) return Promise.resolve(true);
    if (sampleOk[src] === false) return Promise.resolve(false);
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = "auto";
      const done = (ok) => {
        markSample(src, ok);
        a.src = "";
        resolve(ok);
      };
      a.addEventListener("canplaythrough", () => done(true), { once: true });
      a.addEventListener("error", () => done(false), { once: true });
      a.src = src;
      a.load();
      setTimeout(() => {
        if (sampleOk[src] == null) done(false);
      }, 4000);
    });
  }

  function allSamplePaths() {
    const all = [];
    if (typeof MENU_MUSIC_TRACKS !== "undefined") {
      MENU_MUSIC_TRACKS.forEach((t) => {
        if (typeof menuMusicSrc === "function") all.push(menuMusicSrc(t.id));
      });
    } else {
      Object.values(FILES.music).forEach((p) => all.push(p));
    }
    Object.values(FILES.ui).forEach((p) => all.push(p));
    Object.values(FILES.sfx).forEach((p) => {
      if (Array.isArray(p)) p.forEach((x) => all.push(x));
      else all.push(p);
    });
    Object.values(FILES.amb).forEach((p) => all.push(p));
    Object.values(FILES.dwarf).forEach((p) => all.push(p));
    return all;
  }

  function currentMenuMusicSrc() {
    if (typeof menuMusicSrc === "function") return menuMusicSrc();
    return FILES.music.menu;
  }

  function currentMenuTrackMeta() {
    if (typeof resolveMenuMusicTrack === "function") return resolveMenuMusicTrack();
    return {
      id: "call_of_destiny",
      title: "The Call of Destiny",
      album: "Chaotic Chronicle",
    };
  }

  function normalizeMenuMusicId(id) {
    if (typeof resolveMenuMusicTrack === "function") return resolveMenuMusicTrack(id).id;
    return id || "call_of_destiny";
  }

  function preloadAll() {
    primeMusic();
    const current = currentMenuMusicSrc();
    allSamplePaths().forEach((src) => {
      if (preloadStarted[src]) return;
      preloadStarted[src] = true;
      if (src === current) return;
      probeSample(src);
    });
  }

  function playSample(src, vol = 0.7, rate = 1) {
    if (isSilent() || !src || sampleOk[src] === false) return Promise.resolve(false);
    unlock();
    const a = new Audio(src);
    a.volume = Math.min(1, Math.max(0, vol));
    a.playbackRate = rate;
    return a.play()
      .then(() => {
        markSample(src, true);
        return true;
      })
      .catch(() => {
        markSample(src, false);
        return false;
      });
  }

  function playOrSynth(src, vol, synthFn, rate = 1) {
    if (isSilent()) return;
    if (!src || sampleOk[src] === false) {
      synthFn();
      return;
    }
    playSample(src, vol, rate).then((ok) => {
      if (!ok) synthFn();
    });
  }

  function pickMineHitSrc() {
    const pool = FILES.sfx.mineHit;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let musicEl = null;
  let musicCache = null;
  let musicToken = 0;
  let musicSeeking = false;
  let musicProgressTimer = null;
  let sessionRandomPicked = false;
  let ambEl = null;
  let ambKey = null;
  let dwarfVoice = null;
  let dwarfRewardTimer = null;
  let dwarfCatchToken = 0;

  function formatMusicTime(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function stopMusicProgressTick() {
    if (musicProgressTimer) {
      clearInterval(musicProgressTimer);
      musicProgressTimer = null;
    }
  }

  function updateOstSeekUi() {
    const seek = document.getElementById("titleOstSeek");
    const timeEl = document.getElementById("titleOstTime");
    const durEl = document.getElementById("titleOstDur");
    const el = musicEl;
    const dur = el && isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    const cur = el && isFinite(el.currentTime) ? el.currentTime : 0;
    if (timeEl) timeEl.textContent = formatMusicTime(cur);
    if (durEl) durEl.textContent = formatMusicTime(dur);
    if (seek && !musicSeeking) {
      const max = Number(seek.max) || 1000;
      const pct = dur > 0 ? cur / dur : 0;
      seek.value = String(Math.round(pct * max));
      seek.style.setProperty("--ost-pct", Math.round(pct * 1000) / 10 + "%");
      seek.disabled = !(dur > 0);
    }
  }

  function startMusicProgressTick() {
    stopMusicProgressTick();
    updateOstSeekUi();
    musicProgressTimer = setInterval(updateOstSeekUi, 250);
  }

  function bindMusicElEvents(el) {
    if (!el || el.dataset.ostBound === "1") return;
    el.dataset.ostBound = "1";
    el.addEventListener("timeupdate", () => {
      if (!musicSeeking) updateOstSeekUi();
    });
    el.addEventListener("loadedmetadata", updateOstSeekUi);
    el.addEventListener("durationchange", updateOstSeekUi);
    el.addEventListener("ended", () => {
      if (el !== musicEl) return;
      if (!shouldPlayMusic() || isSilent()) return;
      cycleMenuTrack(1);
    });
  }

  function seekMusic(ratioOrSec, asSeconds) {
    if (!musicEl) return false;
    const dur = musicEl.duration;
    if (!isFinite(dur) || dur <= 0) return false;
    let t;
    if (asSeconds) t = Number(ratioOrSec) || 0;
    else t = (Math.max(0, Math.min(1, Number(ratioOrSec) || 0))) * dur;
    t = Math.max(0, Math.min(dur - 0.05, t));
    try {
      musicEl.currentTime = t;
      updateOstSeekUi();
      return true;
    } catch (_) {
      return false;
    }
  }

  function shouldShowOstPlayer(screen) {
    const id = screen || activeScreenId();
    if (typeof OST_PLAYER_SCREENS !== "undefined") return OST_PLAYER_SCREENS.has(id);
    return id === "login" || id === "home";
  }

  function syncOstPlayerVisibility(screen) {
    const root = document.getElementById("titleOst");
    if (!root) return;
    root.hidden = !shouldShowOstPlayer(screen);
  }

  function fadeElVolume(el, target, timerRef, step = 0.022) {
    if (!el) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = setInterval(() => {
      if (!el) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        return;
      }
      const diff = target - el.volume;
      if (Math.abs(diff) <= step) {
        el.volume = target;
        clearInterval(timerRef.current);
        timerRef.current = null;
        return;
      }
      el.volume += diff > 0 ? step : -step;
    }, 45);
  }

  const musicFade = { current: null };
  const ambFade = { current: null };

  function pauseMusicCache() {
    if (!musicCache) return;
    try {
      musicCache.pause();
      musicCache.currentTime = 0;
    } catch (_) {}
  }

  function stopMusicImmediate() {
    musicToken++;
    stopMusicProgressTick();
    if (musicFade.current) {
      clearInterval(musicFade.current);
      musicFade.current = null;
    }
    if (musicEl) {
      const el = musicEl;
      musicEl = null;
      try {
        el.pause();
        el.currentTime = 0;
        el.src = "";
      } catch (_) {}
    }
    pauseMusicCache();
    updateOstSeekUi();
  }

  function stopMusic() {
    stopMusicImmediate();
  }

  function stopAmbience() {
    if (ambFade.current) {
      clearInterval(ambFade.current);
      ambFade.current = null;
    }
    ambKey = null;
    if (!ambEl) return;
    const el = ambEl;
    ambEl = null;
    const fade = setInterval(() => {
      el.volume = Math.max(0, el.volume - 0.04);
      if (el.volume <= 0.01) {
        clearInterval(fade);
        el.pause();
        el.src = "";
      }
    }, 40);
  }

  function stopDwarfVoice() {
    dwarfCatchToken++;
    if (dwarfRewardTimer) {
      clearTimeout(dwarfRewardTimer);
      dwarfRewardTimer = null;
    }
    if (!dwarfVoice) return;
    try {
      dwarfVoice.pause();
      dwarfVoice.currentTime = 0;
    } catch (_) {}
    dwarfVoice = null;
  }

  function primeMusic() {
    const src = currentMenuMusicSrc();
    if (!src) return;
    if (preloadStarted[src] && musicCache && musicCache.dataset.src === src) return;
    preloadStarted[src] = true;
    if (musicCache && musicCache.dataset.src !== src) {
      try {
        musicCache.pause();
        musicCache.src = "";
      } catch (_) {}
      musicCache = null;
    }
    if (musicCache && musicCache.dataset.src === src) return;
    const el = new Audio(src);
    el.dataset.src = src;
    el.preload = "auto";
    el.load();
    musicCache = el;
    const ready = () => markSample(src, true);
    el.addEventListener("canplaythrough", ready, { once: true });
    el.addEventListener("loadeddata", ready, { once: true });
    el.addEventListener("error", () => markSample(src, false), { once: true });
  }

  function playMusicEl(el, src, target, token) {
    el.dataset.src = src;
    el.loop = false;
    bindMusicElEvents(el);
    const startVol = Math.min(target, Math.max(0.12, target * 0.45));
    el.volume = startVol;
    return el.play()
      .then(() => {
        if (token !== musicToken || !MUSIC_SCREENS.has(activeScreenId())) {
          try {
            el.pause();
            el.currentTime = 0;
            el.src = "";
          } catch (_) {}
          return false;
        }
        markSample(src, true);
        musicEl = el;
        fadeElVolume(el, target, musicFade, 0.04);
        startMusicProgressTick();
        syncOstPlayerUi();
        return true;
      });
  }

  function startMusic(forScreen) {
    const screen = forScreen || activeScreenId();
    if (!shouldPlayMusic(screen)) {
      stopMusicImmediate();
      return;
    }
    if (isSilent()) {
      stopMusicImmediate();
      return;
    }
    const src = currentMenuMusicSrc();
    const target = eff(BASE.music, "music");
    if (musicEl && musicEl.dataset.src === src && !musicEl.paused) {
      fadeElVolume(musicEl, target, musicFade, 0.04);
      return;
    }
    stopMusicImmediate();
    primeMusic();

    const token = musicToken;
    const cached = musicCache && musicCache.dataset.src === src ? musicCache : null;
    if (cached) musicCache = null;

    const attempt = (el) => playMusicEl(el, src, target, token).catch(() => false);

    if (cached) {
      attempt(cached).then((ok) => {
        if (!ok && token === musicToken && MUSIC_SCREENS.has(activeScreenId()) && !isSilent()) {
          attempt(new Audio(src));
        }
      });
      return;
    }
    attempt(new Audio(src));
  }

  function setMenuTrack(id, opts) {
    const next = normalizeMenuMusicId(id);
    const force = !!(opts && opts.force);
    const persist = !(opts && opts.persist === false);
    if (typeof state !== "undefined" && state) {
      if (!force && state.menuMusicId === next) {
        syncOstPlayerUi();
        return currentMenuTrackMeta();
      }
      state.menuMusicId = next;
      if (persist && typeof save === "function") save();
    }
    if (musicCache) {
      try {
        musicCache.pause();
        musicCache.src = "";
      } catch (_) {}
      musicCache = null;
    }
    Object.keys(preloadStarted).forEach((k) => {
      if (k.indexOf("assets/sounds/music/") >= 0) delete preloadStarted[k];
    });
    if (shouldPlayMusic()) startMusic();
    else stopMusicImmediate();
    syncOstPlayerUi();
    return currentMenuTrackMeta();
  }

  function cycleMenuTrack(dir) {
    const list =
      typeof MENU_MUSIC_TRACKS !== "undefined" && MENU_MUSIC_TRACKS.length
        ? MENU_MUSIC_TRACKS
        : [{ id: "call_of_destiny" }];
    const cur = currentMenuTrackMeta();
    const idx = Math.max(0, list.findIndex((t) => t.id === cur.id));
    const step = dir < 0 ? -1 : 1;
    const next = list[(idx + step + list.length) % list.length];
    return setMenuTrack(next.id, { force: true });
  }

  function pickRandomMenuTrack(opts) {
    const list =
      typeof MENU_MUSIC_TRACKS !== "undefined" && MENU_MUSIC_TRACKS.length
        ? MENU_MUSIC_TRACKS
        : [{ id: "call_of_destiny" }];
    if (!list.length) return null;
    const cur = typeof state !== "undefined" && state ? state.menuMusicId : null;
    let pool = list;
    if (list.length > 1 && cur) {
      const others = list.filter((t) => t.id !== cur);
      if (others.length) pool = others;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    sessionRandomPicked = true;
    return setMenuTrack(pick.id, {
      force: true,
      persist: !(opts && opts.persist === false),
    });
  }

  function ensureSessionRandomTrack() {
    if (sessionRandomPicked) return currentMenuTrackMeta();
    return pickRandomMenuTrack({ persist: true });
  }

  function syncOstPlayerUi() {
    const titleEl = document.getElementById("titleOstTitle");
    const albumEl = document.getElementById("titleOstAlbum");
    const meta = currentMenuTrackMeta();
    if (titleEl) titleEl.textContent = meta.title || "OST";
    if (albumEl) albumEl.textContent = meta.album || "Lineage II";
    const root = document.getElementById("titleOst");
    if (root) {
      root.setAttribute("data-track", meta.id || "");
      root.setAttribute("aria-label", "OST: " + (meta.title || ""));
    }
    syncOstPlayerVisibility();
    updateOstSeekUi();
  }

  // alias for older call sites
  function syncLoginMusicUi() {
    syncOstPlayerUi();
  }

  function startAmbience(key) {
    if (isSilent()) {
      stopAmbience();
      return;
    }
    const src = FILES.amb[key];
    const target = eff(BASE.amb, "amb");
    if (!src) return;
    if (sampleOk[src] === false) {
      probeSample(src);
      return;
    }
    if (ambKey === key && ambEl && !ambEl.paused) {
      fadeElVolume(ambEl, target, ambFade);
      return;
    }
    stopAmbience();
    ambKey = key;
    probeSample(src).then((ok) => {
      if (!ok || isSilent() || ambKey !== key) return;
      const el = new Audio(src);
      el.loop = true;
      el.volume = 0;
      ambEl = el;
      el.play()
        .then(() => {
          markSample(src, true);
          fadeElVolume(el, target, ambFade, 0.018);
        })
        .catch(() => {
          markSample(src, false);
          if (ambEl === el) ambEl = null;
        });
    });
  }

  function currentMineAmbKey() {
    let zoneId = null;
    if (typeof currentMineZoneId === "function") {
      try {
        zoneId = currentMineZoneId();
      } catch (_) {}
    }
    if (!zoneId && typeof state !== "undefined") zoneId = state.farmZone;
    if (typeof resolveZoneAmbienceKey === "function") return resolveZoneAmbienceKey(zoneId);
    return zoneId && FILES.amb[zoneId] ? zoneId : "banana_mine";
  }

  function setScreen(screen) {
    if (shouldPlayMusic(screen)) {
      startMusic(screen);
      stopAmbience();
      syncOstPlayerVisibility(screen);
      syncOstPlayerUi();
      return;
    }
    stopMusicImmediate();
    syncOstPlayerVisibility(screen);
    if (SCREEN_AMB[screen]) {
      startAmbience(currentMineAmbKey());
    } else {
      stopAmbience();
    }
  }

  function refreshMineAmbience() {
    if (isSilent()) return;
    if (activeScreenId() !== "mine") return;
    startAmbience(currentMineAmbKey());
  }

  function refreshVolumes() {
    if (isSilent()) {
      stopMusicImmediate();
      stopAmbience();
      stopDwarfVoice();
      return;
    }
    setScreen(activeScreenId());
  }

  function refreshAmbience() {
    refreshVolumes();
  }

  const synth = {
    charge() { tone(220, 0, 0.5, "sawtooth", 0.08, 660, "sfx"); },
    success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.4, "triangle", 0.18, null, "sfx")); },
    fail() { noise(0, 0.5, 0.3, "sfx"); tone(160, 0, 0.5, "square", 0.18, 60, "sfx"); },
    click() { tone(440, 0, 0.05, "square", 0.06, null, "ui"); },
    open() { tone(520, 0, 0.06, "triangle", 0.07, null, "ui"); tone(780, 0.04, 0.08, "sine", 0.05, null, "ui"); },
    equip() { tone(380, 0, 0.08, "triangle", 0.1, 520, "ui"); tone(620, 0.05, 0.1, "sine", 0.06, null, "ui"); },
    jackpot() { [523, 659, 784, 1047, 1318, 1568].forEach((f, i) => tone(f, i * 0.07, 0.5, "triangle", 0.2, null, "sfx")); },
    coin() { tone(880, 0, 0.08, "triangle", 0.14, 1320, "ui"); tone(1320, 0.05, 0.12, "sine", 0.1, null, "ui"); },
    treasure() { [659, 880, 1047, 1318].forEach((f, i) => tone(f, i * 0.06, 0.3, "triangle", 0.16, null, "sfx")); },
    mineHit() { tone(220, 0, 0.06, "sine", 0.04, 160, "sfx"); },
    mineKill() { tone(180, 0, 0.1, "sine", 0.035, 120, "sfx"); tone(320, 0.05, 0.08, "triangle", 0.025, null, "sfx"); },
  };

  return {
    unlock,
    preload: preloadAll,
    refreshAmbience,
    refreshMineAmbience,
    refreshVolumes,
    setScreen,
    currentMineAmbKey,
    getMenuTracks() {
      return typeof MENU_MUSIC_TRACKS !== "undefined" ? MENU_MUSIC_TRACKS.slice() : [];
    },
    getMenuTrack() {
      return currentMenuTrackMeta();
    },
    setMenuTrack(id) {
      return setMenuTrack(id, { force: true });
    },
    cycleMenuTrack,
    pickRandomMenuTrack,
    ensureSessionRandomTrack,
    seekMusic(ratio) {
      return seekMusic(ratio, false);
    },
    seekMusicTo(sec) {
      return seekMusic(sec, true);
    },
    syncOstPlayerUi,
    syncLoginMusicUi,
    setOstSeeking(on) {
      musicSeeking = !!on;
      if (!musicSeeking) updateOstSeekUi();
    },
    stopAmbience() { stopAmbience(); },
    stopMusic() { stopMusicImmediate(); },
    charge() { playOrSynth(FILES.sfx.charge, eff(BASE.sfx, "sfx"), synth.charge); },
    success() { playOrSynth(FILES.sfx.success, eff(BASE.sfx, "sfx"), synth.success); },
    fail() { playOrSynth(FILES.sfx.fail, eff(BASE.sfx, "sfx"), synth.fail); },
    click() { playOrSynth(FILES.ui.click, eff(BASE.ui, "ui"), synth.click); },
    open() { playOrSynth(FILES.ui.open, eff(BASE.ui, "ui") * 0.85, synth.open); },
    equip(slotId) {
      const meta =
        typeof AVATAR_GEAR_SLOTS !== "undefined"
          ? AVATAR_GEAR_SLOTS.find((s) => s.id === slotId)
          : null;
      let src = FILES.sfx.equipWeapon;
      if (slotId === "weapon") src = FILES.sfx.equipWeapon;
      else if (meta?.jewelry) src = FILES.sfx.equipJewelry;
      else src = FILES.sfx.equipArmor;
      playOrSynth(src, eff(BASE.ui, "ui") * 0.95, synth.equip);
    },
    jackpot() { playOrSynth(FILES.sfx.jackpot, eff(BASE.sfx, "sfx"), synth.jackpot); },
    coin() { playOrSynth(FILES.ui.coin, eff(BASE.ui, "ui"), synth.coin); },
    treasure() { playOrSynth(FILES.sfx.treasure, eff(BASE.sfx, "sfx"), synth.treasure); },
    quest() { playOrSynth(FILES.sfx.quest, eff(BASE.sfx, "sfx") * 0.9, synth.treasure); },
    levelup() { playOrSynth(FILES.sfx.levelup, eff(BASE.sfx, "sfx"), synth.jackpot); },
    mineHit() {
      const rate = 0.98 + Math.random() * 0.05;
      playOrSynth(pickMineHitSrc(), eff(BASE.mine, "sfx"), synth.mineHit, rate);
    },
    mineKill() {
      playOrSynth(FILES.sfx.mineKill, eff(BASE.mine, "sfx") * 0.75, synth.mineKill, 1.0);
    },
    mineReward(reward) {
      if (isSilent() || !reward) return;
      if (reward === "coin") playOrSynth(FILES.ui.coin, eff(BASE.ui, "ui"), synth.coin);
      else if (reward === "treasure") playOrSynth(FILES.sfx.treasure, eff(BASE.sfx, "sfx"), synth.treasure);
      else if (reward === "jackpot") playOrSynth(FILES.sfx.jackpot, eff(BASE.sfx, "sfx"), synth.jackpot);
    },
    dwarfCatch(female, reward = null) {
      if (isSilent()) return DWARF_CATCH.rewardDelayMs;
      stopDwarfVoice();
      const token = dwarfCatchToken;
      const src = female ? FILES.dwarf.F : FILES.dwarf.M;
      const delay = DWARF_CATCH.rewardDelayMs;
      unlock();
      const a = new Audio(src);
      a.volume = Math.min(1, eff(BASE.dwarf, "voice"));
      a.playbackRate = DWARF_CATCH.rate;
      dwarfVoice = a;
      a.play()
        .then(() => markSample(src, true))
        .catch(() => {
          markSample(src, false);
          synth.fail();
        });
      dwarfRewardTimer = setTimeout(() => {
        dwarfRewardTimer = null;
        if (token !== dwarfCatchToken) return;
        if (dwarfVoice === a) stopDwarfVoice();
        if (isSilent() || !reward) return;
        if (reward === "coin") playOrSynth(FILES.ui.coin, eff(BASE.ui, "ui"), synth.coin);
        else if (reward === "treasure") playOrSynth(FILES.sfx.treasure, eff(BASE.sfx, "sfx"), synth.treasure);
        else if (reward === "jackpot") playOrSynth(FILES.sfx.jackpot, eff(BASE.sfx, "sfx"), synth.jackpot);
      }, delay);
      return delay;
    },
    dwarfDeath(female) {
      return this.dwarfCatch(female, null);
    },
    stopDwarfVoice,
  };
})();
