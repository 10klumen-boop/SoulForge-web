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
// Прогресс привязан к аккаунту: guest → soulforge_save_guest, nick → soulforge_save_<nick>
const SAVE_KEY_LEGACY = "soulforge_save";
const SEAL_KEY_LEGACY = "soulforge_seal";
const SAVE_KEY_GUEST = "soulforge_save_guest";
const SEAL_KEY_GUEST = "soulforge_seal_guest";
const LIVE_SEQ_KEY_LEGACY = "soulforge_live_seq";
const SAVE_VER = 2;
const _savePepper = ["sf", "2|", "ench", "ant", "|", "sim", "|", "L2", "26"].join("");
let saveNotice = null;
let desktopProgressMode = false;
const _deskBlob = { save: null, seal: null };
const _deskSession = {};
/** @type {string|null} null = guest */
let _saveOwner = null;

function peekCloudNick() {
  try {
    const raw = localStorage.getItem("soulforge_cloud_auth");
    if (!raw) return null;
    const o = JSON.parse(raw);
    const nick = o && o.nick != null ? String(o.nick).trim() : "";
    return /^[a-zA-Z]{2,16}$/.test(nick) ? nick : null;
  } catch (e) {
    return null;
  }
}

function currentSaveOwner() {
  return _saveOwner;
}

function saveOwnerId() {
  return _saveOwner || "guest";
}

function saveKeyFor(owner) {
  return owner ? "soulforge_save_" + owner : SAVE_KEY_GUEST;
}

function sealKeyFor(owner) {
  return owner ? "soulforge_seal_" + owner : SEAL_KEY_GUEST;
}

function liveSeqKeyFor(owner) {
  return owner ? "soulforge_live_seq_" + owner : "soulforge_live_seq_guest";
}

function saveKey() {
  return saveKeyFor(_saveOwner);
}

function sealKey() {
  return sealKeyFor(_saveOwner);
}

function liveSeqKey() {
  return liveSeqKeyFor(_saveOwner);
}

function deskProgressSlot(kind) {
  return kind + ":" + saveOwnerId();
}

function migrateLegacySaveKeys() {
  try {
    const legacySave = localStorage.getItem(SAVE_KEY_LEGACY);
    const legacySeal = localStorage.getItem(SEAL_KEY_LEGACY);
    if (legacySave && !localStorage.getItem(SAVE_KEY_GUEST)) {
      localStorage.setItem(SAVE_KEY_GUEST, legacySave);
      if (legacySeal) localStorage.setItem(SEAL_KEY_GUEST, legacySeal);
    }
    if (legacySave) localStorage.removeItem(SAVE_KEY_LEGACY);
    if (legacySeal) localStorage.removeItem(SEAL_KEY_LEGACY);
    const legacySeq = sessionStorage.getItem(LIVE_SEQ_KEY_LEGACY);
    if (legacySeq && !sessionStorage.getItem(liveSeqKeyFor(null))) {
      sessionStorage.setItem(liveSeqKeyFor(null), legacySeq);
    }
    if (legacySeq) sessionStorage.removeItem(LIVE_SEQ_KEY_LEGACY);
  } catch (e) {}
}

function deskSlotFor(owner, kind) {
  return kind + ":" + (owner || "guest");
}

function hasStoredSaveFor(owner) {
  try {
    const raw = localStorage.getItem(saveKeyFor(owner));
    if (!raw) return false;
    const parsed = parseStoredRaw(raw);
    return !!(parsed?.valid || parsed?.legacy);
  } catch (e) {
    return false;
  }
}

async function hasStoredSaveForAsync(owner) {
  if (hasStoredSaveFor(owner)) return true;
  const api = window.soulforgeDesktop;
  if (!api?.readProgress) return false;
  try {
    const raw = await api.readProgress(deskSlotFor(owner, "save"));
    if (!raw && !owner) {
      const legacy = await api.readProgress("save");
      if (!legacy) return false;
      const parsed = parseStoredRaw(legacy);
      return !!(parsed?.valid || parsed?.legacy);
    }
    if (!raw) return false;
    const parsed = parseStoredRaw(raw);
    return !!(parsed?.valid || parsed?.legacy);
  } catch (e) {
    return false;
  }
}

function copyStoredSave(fromOwner, toOwner) {
  if ((fromOwner || null) === (toOwner || null)) return false;
  try {
    const s = localStorage.getItem(saveKeyFor(fromOwner));
    const t = localStorage.getItem(sealKeyFor(fromOwner));
    if (!s) return false;
    localStorage.setItem(saveKeyFor(toOwner), s);
    if (t) localStorage.setItem(sealKeyFor(toOwner), t);
    else localStorage.setItem(sealKeyFor(toOwner), s);
    return true;
  } catch (e) {
    return false;
  }
}

async function copyStoredSaveAsync(fromOwner, toOwner) {
  if (copyStoredSave(fromOwner, toOwner)) return true;
  const api = window.soulforgeDesktop;
  if (!api?.readProgress || !api?.writeProgress) return false;
  if ((fromOwner || null) === (toOwner || null)) return false;
  try {
    let s = await api.readProgress(deskSlotFor(fromOwner, "save"));
    let t = await api.readProgress(deskSlotFor(fromOwner, "seal"));
    if (!s && !fromOwner) {
      s = await api.readProgress("save");
      t = (await api.readProgress("seal")) || s;
    }
    if (!s) return false;
    await api.writeProgress(deskSlotFor(toOwner, "save"), s);
    await api.writeProgress(deskSlotFor(toOwner, "seal"), t || s);
    return true;
  } catch (e) {
    return false;
  }
}

function applyLoadedSave(loaded) {
  Object.keys(state).forEach((k) => {
    if (!(k in loaded)) delete state[k];
  });
  Object.assign(state, loaded);
  if (typeof initCharacters === "function") initCharacters();
  if (typeof loadActiveCharacter === "function") loadActiveCharacter();
  if (typeof migrateStarterWeapon === "function") migrateStarterWeapon();
  if (typeof refreshProgressUI === "function") refreshProgressUI();
  else {
    try {
      if (typeof renderMenu === "function") renderMenu();
      if (typeof syncSettingsUI === "function") syncSettingsUI();
    } catch (e) {}
  }
}

/**
 * Сохранить текущий прогресс под текущим владельцем и загрузить сейв другого аккаунта.
 * @param {string|null} nextNick
 */
async function switchSaveOwner(nextNick) {
  const next = nextNick && /^[a-zA-Z]{2,16}$/.test(nextNick) ? nextNick : null;
  const prev = _saveOwner;
  try {
    if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
    save();
  } catch (e) {}

  if (prev === next) return { ok: true, switched: false };

  if (next && !(await hasStoredSaveForAsync(next)) && (await hasStoredSaveForAsync(null))) {
    await copyStoredSaveAsync(null, next);
    saveNotice = saveNotice
      ? saveNotice + " · Прогресс гостя перенесён на аккаунт"
      : "Прогресс гостя перенесён на аккаунт «" + next + "»";
  }

  _saveOwner = next;
  _deskBlob.save = null;
  _deskBlob.seal = null;

  if (isDesktopSave() && window.soulforgeDesktop?.readProgress) {
    // Empty account must not keep previous owner's in-memory state
    applyLoadedSave(defaultState());
    await hydrateDesktopSave();
    if (typeof initCharacters === "function") initCharacters();
    if (typeof loadActiveCharacter === "function") loadActiveCharacter();
    if (typeof migrateStarterWeapon === "function") migrateStarterWeapon();
    if (typeof refreshProgressUI === "function") refreshProgressUI();
  } else {
    applyLoadedSave(load());
  }
  if (saveNotice && typeof toast === "function") {
    toast(saveNotice, "system");
    saveNotice = null;
  }
  return { ok: true, switched: true, from: prev, to: next };
}

function isDesktopSave() {
  return !!(typeof window !== "undefined" && window.soulforgeDesktop?.isDesktop);
}

function setLiveSeq(seq) {
  if (isDesktopSave()) {
    _deskSession[liveSeqKey()] = String(seq);
    return;
  }
  try { sessionStorage.setItem(liveSeqKey(), String(seq)); } catch (e) {}
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
  if (desktopProgressMode && (key === saveKey() || key === sealKey())) {
    const raw = key === sealKey() ? _deskBlob.seal : _deskBlob.save;
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
  const sk = saveKey();
  const tk = sealKey();
  if (window.soulforgeDesktop?.writeProgress) {
    desktopProgressMode = true;
    _deskBlob.save = json;
    _deskBlob.seal = json;
    window.soulforgeDesktop.writeProgress(deskProgressSlot("save"), json);
    window.soulforgeDesktop.writeProgress(deskProgressSlot("seal"), json);
    try {
      localStorage.removeItem(sk);
      localStorage.removeItem(tk);
    } catch (e) {}
  } else {
    localStorage.setItem(sk, json);
    localStorage.setItem(tk, json);
  }
  try { setLiveSeq(env.seq); } catch (e) {}
}

async function hydrateDesktopSave() {
  const api = window.soulforgeDesktop;
  if (!api?.readProgress) return;

  const slotSave = deskProgressSlot("save");
  const slotSeal = deskProgressSlot("seal");
  _deskBlob.save = await api.readProgress(slotSave);
  _deskBlob.seal = await api.readProgress(slotSeal);

  // Migrate legacy unscoped desktop files → guest once
  if (!_deskBlob.save && !_saveOwner) {
    const legacySave = await api.readProgress("save");
    const legacySeal = await api.readProgress("seal");
    if (legacySave) {
      _deskBlob.save = legacySave;
      _deskBlob.seal = legacySeal || legacySave;
      desktopProgressMode = true;
      await api.writeProgress(slotSave, legacySave);
      await api.writeProgress(slotSeal, legacySeal || legacySave);
    }
  }

  const encSave = parseStoredRaw(_deskBlob.save);
  const encSeal = parseStoredRaw(_deskBlob.seal);
  const locSave = parseStoredRaw(localStorage.getItem(saveKey()));
  const locSeal = parseStoredRaw(localStorage.getItem(sealKey()));

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
    localStorage.removeItem(saveKey());
    localStorage.removeItem(sealKey());
  } catch (e) {}
}

function liveSeq() {
  if (isDesktopSave()) return parseInt(_deskSession[liveSeqKey()] || "0", 10) || 0;
  try { return parseInt(sessionStorage.getItem(liveSeqKey()) || "0", 10) || 0; } catch (e) { return 0; }
}

function maxStoredSeq() {
  const a = readStored(saveKey());
  const b = readStored(sealKey());
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

  const storedSave = readStored(saveKey());
  const seal = readStored(sealKey());

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
  const sk = saveKey();
  const tk = sealKey();
  try {
    localStorage.removeItem(sk);
    localStorage.removeItem(tk);
    sessionStorage.removeItem(liveSeqKey());
  } catch (e) {}
  if (isDesktopSave()) delete _deskSession[liveSeqKey()];
  if (desktopProgressMode && window.soulforgeDesktop?.clearProgress) {
    window.soulforgeDesktop.clearProgress(saveOwnerId());
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
  const seal = readStored(sealKey());
  if (seal?.valid) return seal.env;
  const storedSave = readStored(saveKey());
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

migrateLegacySaveKeys();
/** Гость до явного входа; аккаунт — после login/register или resume на экране входа. */
_saveOwner = null;
let state = load();
let cur = null;
let listState = { cat: null, grade: "all", q: "" };
