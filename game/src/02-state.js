function scrollFor(grade, typeId) {
  const t = SCROLL_TYPES.find((x) => x.id === typeId) || SCROLL_TYPES[0];
  const icon = typeId === "blessed" ? BLESSED_ICON[grade] : SCROLL_ICON[grade];
  const base = tune("scroll.price." + grade, GRADE_BASE_PRICE[grade] || 50_000);
  const mult = tune("scroll.mult." + typeId, t.mult);
  return {
    id: t.id, name: t.name, behavior: t.behavior, desc: t.desc, icon,
    cost: Math.round(base * mult),
  };
}

function defaultAudioVol() {
  return { master: 1, music: 0.42, sfx: 0.72, ui: 0.55, amb: 0.24, voice: 0.88 };
}

function defaultState() {
  return {
    adena: START_ADENA,
    farmZone: "banana_mine",
    storyProgress: { chaptersSeen: {}, unlocksShown: {} },
    questProgress: { completed: {}, kills: {}, goldenKills: {}, bosses: {}, briefings: {}, chapterRewards: {} },
    records: {},
    totals: { tries: 0, fails: 0, earned: 0 },
    muted: false,
    audioVol: defaultAudioVol(),
    alwaysOnTop: false,
    storySeen: false,
    characters: [],
    activeCharacterId: null,
    avatar: { raceId: "", classId: "", genderId: "", name: "", level: 1, xp: 0, created: false },
    inventory: starterInventory(),
    crystals: { D: 0, C: 0, B: 0, A: 0 },
    collectibles: {},
    equipped: {},
    materials: { soul: 0, spirit: 0 },
    shots: { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } },
    autoShots: true,
    achievements: { unlocked: {}, stats: {} },
    devTune: {},
    balanceResetVer: BALANCE_RESET_VER,
  };
}

/** Сохранить оболочку персонажа, обнулить экономику / квесты / ачивки. */
function wipeProgressKeepIdentity(progress) {
  const fresh = freshCharacterProgressSnapshot();
  const prev = progress && typeof progress === "object" ? progress : {};
  const oldAv = prev.avatar && typeof prev.avatar === "object" ? prev.avatar : {};
  fresh.avatar = {
    raceId: oldAv.raceId || "",
    classId: oldAv.classId || "",
    genderId: oldAv.genderId || "",
    name: oldAv.name || "",
    level: 1,
    xp: 0,
    created: !!oldAv.created,
    starterGranted: false,
    gear: typeof defaultAvatarGear === "function" ? defaultAvatarGear() : { weapon: null },
    prologueSeen: false,
  };
  if (fresh.avatar.created && typeof grantStarterWeapon === "function") {
    // starter выдаст migrate после apply; здесь только флаг
    fresh.avatar.starterGranted = false;
  }
  return fresh;
}

function freshCharacterProgressSnapshot() {
  if (typeof freshCharacterProgress === "function") return freshCharacterProgress();
  const d = defaultState();
  const keys = [
    "avatar", "adena", "farmZone", "storyProgress", "questProgress",
    "records", "totals", "storySeen", "inventory", "crystals",
    "collectibles", "equipped", "materials", "shots", "autoShots", "achievements",
  ];
  const p = {};
  keys.forEach((k) => { p[k] = JSON.parse(JSON.stringify(d[k])); });
  return p;
}

function applyBalanceResetIfNeeded(st) {
  if (!st || typeof st !== "object") return st;
  if (st.balanceResetVer === BALANCE_RESET_VER) return st;

  const keepMuted = !!st.muted;
  const keepAudio = st.audioVol && typeof st.audioVol === "object" ? st.audioVol : defaultAudioVol();
  const keepTop = !!st.alwaysOnTop;
  const roster = Array.isArray(st.characters) ? st.characters : [];
  const activeId = st.activeCharacterId || null;

  // Wipe root progress (legacy / active slot mirror)
  const wipedRoot = wipeProgressKeepIdentity({
    avatar: st.avatar,
    adena: st.adena,
    inventory: st.inventory,
  });
  Object.assign(st, wipedRoot);

  // Wipe each character slot
  if (roster.length) {
    st.characters = roster.map((c) => ({
      id: c.id,
      progress: wipeProgressKeepIdentity(c.progress || {}),
    }));
    st.activeCharacterId = activeId && st.characters.some((c) => c.id === activeId)
      ? activeId
      : st.characters[0]?.id || null;
  } else {
    st.characters = [];
    st.activeCharacterId = null;
  }

  st.muted = keepMuted;
  st.audioVol = keepAudio;
  st.alwaysOnTop = keepTop;
  st.devTune = {};
  st.balanceResetVer = BALANCE_RESET_VER;
  st.farmZone = "banana_mine";
  st.storySeen = false;
  st._didBalanceWipe = true;

  saveNotice = saveNotice
    ? saveNotice + " · Баланс обновлён — прогресс сброшен"
    : "Баланс обновлён — прогресс сброшен для плейтеста";
  return st;
}

function persistIfBalanceWiped(data) {
  if (!data || !data._didBalanceWipe) return data;
  delete data._didBalanceWipe;
  try {
    const seq = Math.max(maxStoredSeq(), 1);
    persistEnvelope(makeEnvelope(exportGameData(data), seq, Date.now()));
  } catch (e) {}
  return data;
}

function mergeSavedData(data) {
  const st = Object.assign(defaultState(), data);
  if (!st.storyProgress || typeof st.storyProgress !== "object") {
    st.storyProgress = { chaptersSeen: {}, unlocksShown: {} };
  }
  if (!st.questProgress || typeof st.questProgress !== "object") {
    st.questProgress = { completed: {}, kills: {}, goldenKills: {}, bosses: {}, briefings: {}, chapterRewards: {} };
  } else {
    if (!st.questProgress.goldenKills) st.questProgress.goldenKills = {};
    if (!st.questProgress.bosses) st.questProgress.bosses = {};
    if (!st.questProgress.briefings) st.questProgress.briefings = {};
    if (!st.questProgress.chapterRewards) st.questProgress.chapterRewards = {};
  }
  applyBalanceResetIfNeeded(st);
  if (typeof initCharacters === "function") initCharacters();
  if (st.autoShots == null) st.autoShots = true;
  if (!st.audioVol || typeof st.audioVol !== "object") st.audioVol = defaultAudioVol();
  else {
    const dv = defaultAudioVol();
    for (const k of Object.keys(dv)) {
      if (typeof st.audioVol[k] !== "number") st.audioVol[k] = dv[k];
    }
  }
  return st;
}

// --- Защита сохранений (v2): подпись + двойная копия + счётчик против отката ---
const SAVE_KEY = "soulforge_save";
const SEAL_KEY = "soulforge_seal";
const LIVE_SEQ_KEY = "soulforge_live_seq";
const SAVE_VER = 2;
const _savePepper = ["sf", "2|", "ench", "ant", "|", "sim", "|", "L2", "26"].join("");
let saveNotice = null;
let desktopProgressMode = false;
const _deskBlob = { save: null, seal: null };
const _deskSession = {};

function isDesktopSave() {
  return !!(typeof window !== "undefined" && window.soulforgeDesktop?.isDesktop);
}

function setLiveSeq(seq) {
  if (isDesktopSave()) {
    _deskSession[LIVE_SEQ_KEY] = String(seq);
    return;
  }
  try { sessionStorage.setItem(LIVE_SEQ_KEY, String(seq)); } catch (e) {}
}

function exportGameData(st) {
  const data = defaultState();
  for (const k of Object.keys(data)) {
    if (st[k] !== undefined) data[k] = st[k];
  }
  delete data.devTune;
  return data;
}

/** Dev: принудительный wipe экономики (как при BALANCE_RESET_VER bump). */
function forceBalanceWipe() {
  state.balanceResetVer = 0;
  applyBalanceResetIfNeeded(state);
  delete state._didBalanceWipe;
  if (typeof initCharacters === "function") initCharacters();
  if (typeof loadActiveCharacter === "function") loadActiveCharacter();
  if (typeof migrateStarterWeapon === "function") migrateStarterWeapon();
  save();
  if (typeof refreshProgressUI === "function") refreshProgressUI();
  toast(saveNotice || "Баланс обновлён — прогресс сброшен", "warn");
  saveNotice = null;
}

function saveDigest(seq, savedAt, data) {
  const body = JSON.stringify({ v: SAVE_VER, seq, savedAt, data }) + _savePepper;
  let h = 2166136261;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const h2 = Math.imul(h ^ (data.adena | 0) ^ (data.totals?.tries | 0), 2654435761) >>> 0;
  return (h >>> 0).toString(36) + "." + h2.toString(36);
}

function makeEnvelope(data, seq, savedAt) {
  return { v: SAVE_VER, seq, savedAt, data, sig: saveDigest(seq, savedAt, data) };
}

function verifyEnvelope(env) {
  if (!env || env.v !== SAVE_VER || typeof env.seq !== "number" || typeof env.savedAt !== "number") return false;
  if (!env.data || typeof env.data.adena !== "number" || typeof env.sig !== "string") return false;
  return env.sig === saveDigest(env.seq, env.savedAt, env.data);
}

function isLegacyPlain(obj) {
  return obj && typeof obj.adena === "number" && obj.v === undefined && obj.sig === undefined;
}

function parseStoredRaw(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isLegacyPlain(parsed)) return { legacy: parsed };
    if (verifyEnvelope(parsed)) return { valid: true, env: parsed };
    return { corrupt: true, env: parsed };
  } catch (e) {
    return null;
  }
}

function readStored(key) {
  if (desktopProgressMode && (key === SAVE_KEY || key === SEAL_KEY)) {
    const raw = key === SEAL_KEY ? _deskBlob.seal : _deskBlob.save;
    return parseStoredRaw(raw);
  }
  try {
    const raw = localStorage.getItem(key);
    return parseStoredRaw(raw);
  } catch (e) {
    return null;
  }
}

function persistEnvelope(env) {
  const json = JSON.stringify(env);
  if (window.soulforgeDesktop?.writeProgress) {
    desktopProgressMode = true;
    _deskBlob.save = json;
    _deskBlob.seal = json;
    window.soulforgeDesktop.writeProgress("save", json);
    window.soulforgeDesktop.writeProgress("seal", json);
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SEAL_KEY);
    } catch (e) {}
  } else {
    localStorage.setItem(SAVE_KEY, json);
    localStorage.setItem(SEAL_KEY, json);
  }
  try { setLiveSeq(env.seq); } catch (e) {}
}

async function hydrateDesktopSave() {
  const api = window.soulforgeDesktop;
  if (!api?.readProgress) return;

  _deskBlob.save = await api.readProgress("save");
  _deskBlob.seal = await api.readProgress("seal");
  const encSave = parseStoredRaw(_deskBlob.save);
  const encSeal = parseStoredRaw(_deskBlob.seal);
  const locSave = parseStoredRaw(localStorage.getItem(SAVE_KEY));
  const locSeal = parseStoredRaw(localStorage.getItem(SEAL_KEY));

  const hasEncrypted = !!(encSave?.valid || encSeal?.valid);
  const hasLocal = !!(locSave?.valid || locSeal?.valid || locSave?.legacy);

  if (!hasEncrypted && hasLocal) {
    desktopProgressMode = true;
    if (locSave?.legacy && !locSeal) {
      const data = persistIfBalanceWiped(mergeSavedData(locSave.legacy));
      persistEnvelope(makeEnvelope(exportGameData(data), 1, Date.now()));
      Object.assign(state, data);
      saveNotice = "Сохранение переведено в защищённый формат";
      return;
    }
    const picked = pickEnvelope(locSave, locSeal);
    if (picked) {
      if (picked.resync) persistEnvelope(picked.env);
      else setLiveSeq(picked.env.seq);
      Object.assign(state, persistIfBalanceWiped(mergeSavedData(picked.env.data)));
    }
    return;
  }

  if (!hasEncrypted) return;

  desktopProgressMode = true;
  let picked = pickEnvelope(encSave, encSeal);
  if (!picked) return;

  const sessionSeq = liveSeq();
  if (sessionSeq > 0 && picked.env.seq < sessionSeq) {
    if (encSeal?.valid && encSeal.env.seq >= sessionSeq) {
      picked = { env: encSeal.env, resync: false };
      saveNotice = "Откат в текущей сессии заблокирован";
    } else if (encSave?.valid && encSave.env.seq >= sessionSeq) {
      picked = { env: encSave.env, resync: true };
      saveNotice = "Откат в текущей сессии заблокирован";
    }
  }

  if (picked.resync) persistEnvelope(picked.env);
  else setLiveSeq(picked.env.seq);

  Object.assign(state, persistIfBalanceWiped(mergeSavedData(picked.env.data)));
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SEAL_KEY);
  } catch (e) {}
}

function liveSeq() {
  if (isDesktopSave()) return parseInt(_deskSession[LIVE_SEQ_KEY] || "0", 10) || 0;
  try { return parseInt(sessionStorage.getItem(LIVE_SEQ_KEY) || "0", 10) || 0; } catch (e) { return 0; }
}

function maxStoredSeq() {
  const a = readStored(SAVE_KEY);
  const b = readStored(SEAL_KEY);
  let m = 0;
  if (a?.valid) m = Math.max(m, a.env.seq);
  if (b?.valid) m = Math.max(m, b.env.seq);
  return m;
}

function pickEnvelope(save, seal) {
  const sOk = save?.valid;
  const tOk = seal?.valid;
  if (sOk && tOk) {
    if (save.env.seq > seal.env.seq) return { env: save.env, resync: true };
    if (seal.env.seq > save.env.seq) {
      saveNotice = "Откат сохранения заблокирован — восстановлен актуальный прогресс";
      return { env: seal.env, resync: false };
    }
    return { env: save.env, resync: false };
  }
  if (tOk) return { env: seal.env, resync: !sOk };
  if (sOk) return { env: save.env, resync: !tOk };
  if (save?.corrupt && tOk) {
    saveNotice = "Сохранение изменено — восстановлено из защищённой копии";
    return { env: seal.env, resync: false };
  }
  if (seal?.corrupt && sOk) {
    saveNotice = "Резервная копия повреждена — восстановлено основное сохранение";
    return { env: save.env, resync: true };
  }
  if ((save?.corrupt || seal?.corrupt) && !sOk && !tOk) {
    saveNotice = "Сохранение повреждено — начат новый прогресс";
  }
  return null;
}

function load() {
  if (isDesktopSave()) return defaultState();

  const storedSave = readStored(SAVE_KEY);
  const seal = readStored(SEAL_KEY);

  if (storedSave?.legacy && !seal) {
    const data = persistIfBalanceWiped(mergeSavedData(storedSave.legacy));
    persistEnvelope(makeEnvelope(exportGameData(data), 1, Date.now()));
    saveNotice = "Сохранение переведено в защищённый формат";
    return data;
  }

  let picked = pickEnvelope(storedSave, seal);
  if (!picked) return defaultState();

  const sessionSeq = liveSeq();
  if (sessionSeq > 0 && picked.env.seq < sessionSeq) {
    if (seal?.valid && seal.env.seq >= sessionSeq) {
      picked = { env: seal.env, resync: false };
      saveNotice = "Откат в текущей сессии заблокирован";
    } else if (storedSave?.valid && storedSave.env.seq >= sessionSeq) {
      picked = { env: storedSave.env, resync: true };
      saveNotice = "Откат в текущей сессии заблокирован";
    }
  }

  if (picked.resync) persistEnvelope(picked.env);
  else setLiveSeq(picked.env.seq);

  return persistIfBalanceWiped(mergeSavedData(picked.env.data));
}

function save() {
  if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
  const seq = maxStoredSeq() + 1;
  const env = makeEnvelope(exportGameData(state), seq, Date.now());
  persistEnvelope(env);
}

function resetProgress() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SEAL_KEY);
    sessionStorage.removeItem(LIVE_SEQ_KEY);
  } catch (e) {}
  if (isDesktopSave()) delete _deskSession[LIVE_SEQ_KEY];
  if (desktopProgressMode && window.soulforgeDesktop?.clearProgress) {
    window.soulforgeDesktop.clearProgress();
    _deskBlob.save = null;
    _deskBlob.seal = null;
  }
  const savedTune = state.devTune;
  state = defaultState();
  if (savedTune && Object.keys(savedTune).length) state.devTune = savedTune;
  if (typeof initCharacters === "function") initCharacters();
  persistEnvelope(makeEnvelope(exportGameData(state), 1, Date.now()));
}

function getCurrentEnvelope() {
  save();
  const seal = readStored(SEAL_KEY);
  if (seal?.valid) return seal.env;
  const storedSave = readStored(SAVE_KEY);
  if (storedSave?.valid) return storedSave.env;
  return makeEnvelope(exportGameData(state), Math.max(maxStoredSeq(), 1), Date.now());
}

function applyEnvelope(env, opts) {
  if (!verifyEnvelope(env)) return { ok: false, reason: "bad_sig" };
  const localMax = maxStoredSeq();
  if (env.seq < localMax && !opts?.allowOlder) {
    return { ok: false, reason: "older", localMax, importedSeq: env.seq };
  }
  const seq = Math.max(localMax, env.seq);
  const next = seq === env.seq ? env : makeEnvelope(env.data, seq, Date.now());
  persistEnvelope(next);
  Object.assign(state, mergeSavedData(next.data));
  if (typeof renderCharacterRoster === "function") renderCharacterRoster();
  return { ok: true, env: next };
}

function refreshProgressUI() {
  $("#adena").textContent = fmt(state.adena);
  renderMenu();
  if ($("#screen-inv").classList.contains("active")) renderInventory();
  if ($("#screen-shop").classList.contains("active")) renderWorkshop();
  syncSettingsUI();
  if (typeof syncCloudUI === "function") syncCloudUI();
}

let state = load();
let cur = null;
let listState = { cat: null, grade: "all", q: "" };
