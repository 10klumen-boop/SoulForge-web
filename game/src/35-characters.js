// ===== Несколько персонажей: слоты, выбор, отдельный прогресс =====

const CHARACTER_MAX_SLOTS = 5;
// ===== Несколько персонажей: слоты, выбор, отдельный прогресс =====
// CHARACTER_PROGRESS_KEYS и ProgressStore вынесены в progress-store.js.


function newCharacterId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function freshCharacterProgress() {
  const d = defaultState();
  const p = {};
  CHARACTER_PROGRESS_KEYS.forEach((k) => {
    p[k] = JSON.parse(JSON.stringify(d[k]));
  });
  return p;
}

function snapshotProgressFromState() {
  const snap = {};
  CHARACTER_PROGRESS_KEYS.forEach((k) => {
    snap[k] = JSON.parse(JSON.stringify(state[k]));
  });
  return snap;
}

function applyProgressToState(progress) {
  if (!progress) return;
  CHARACTER_PROGRESS_KEYS.forEach((k) => {
    if (progress[k] !== undefined) state[k] = JSON.parse(JSON.stringify(progress[k]));
  });
}

/** Чистый прогресс в пустой слот — без «хвостов» от предыдущего героя. */
function resetEmptySlotProgress(slot) {
  if (!slot || slotIsCreated(slot)) return;
  slot.progress = freshCharacterProgress();
}

function syncUiAfterCharacterSwap() {
  if (typeof resetMineSkillRuntime === "function") resetMineSkillRuntime();
  if (typeof ensurePassiveIncomeState === "function") ensurePassiveIncomeState();
  if (typeof ensureAutoClickerState === "function") ensureAutoClickerState();
  if (typeof collectPassiveIncome === "function") {
    try { collectPassiveIncome({ queueNotice: false }); } catch (e) {}
  }
  if (typeof renderAvatarHub === "function") renderAvatarHub();
  if (typeof renderAvatarSkillsPanel === "function") renderAvatarSkillsPanel();
  if (typeof renderMineSkillBar === "function") renderMineSkillBar();
  if ($("#screen-avatar")?.classList.contains("active") && typeof renderAvatarScreen === "function") {
    renderAvatarScreen();
  }
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  if (typeof renderMineHudStats === "function") renderMineHudStats();
}

function migrateCharactersStructure() {
  if (state.characters && Array.isArray(state.characters) && state.characters.length) {
    if (!state.activeCharacterId || !state.characters.some((c) => c.id === state.activeCharacterId)) {
      state.activeCharacterId = state.characters[0].id;
    }
    return;
  }
  if (!hasLegacySinglePlayerProgress()) {
    state.characters = [];
    state.activeCharacterId = null;
    return;
  }
  const id = newCharacterId();
  state.characters = [{ id, progress: snapshotProgressFromState() }];
  state.activeCharacterId = id;
}

function ensureFixedCharacterSlots() {
  if (!Array.isArray(state.characters)) state.characters = [];
  if (state.characters.length > CHARACTER_MAX_SLOTS) {
    const created = state.characters.filter((c) => slotIsCreated(c));
    const empty = state.characters.filter((c) => !slotIsCreated(c));
    state.characters = [...created, ...empty].slice(0, CHARACTER_MAX_SLOTS);
  }
  while (state.characters.length < CHARACTER_MAX_SLOTS) {
    state.characters.push({ id: newCharacterId(), progress: freshCharacterProgress() });
  }
  if (!state.activeCharacterId || !state.characters.some((c) => c.id === state.activeCharacterId)) {
    const pick = state.characters.find((c) => slotIsCreated(c)) || state.characters[0];
    state.activeCharacterId = pick.id;
  }
}

/** Старый сейв без roster — один персонаж в корне state. Свежий аккаунт — пустой roster. */
function hasLegacySinglePlayerProgress() {
  if (state.avatar?.created) return true;
  if ((state.totals?.tries || 0) > 0 || (state.totals?.earned || 0) > 0) return true;
  if (state.adena != null && state.adena !== START_ADENA) return true;
  const q = state.questProgress;
  if (q) {
    if (Object.keys(q.completed || {}).length) return true;
    if (Object.keys(q.kills || {}).length) return true;
  }
  if (Object.keys(state.achievements?.unlocked || {}).length) return true;
  return false;
}

function flushActiveCharacterToSlot() {
  migrateCharactersStructure();
  const slot = state.characters.find((c) => c.id === state.activeCharacterId);
  if (!slot) return;
  slot.progress = snapshotProgressFromState();
}

function loadActiveCharacter() {
  migrateCharactersStructure();
  const slot = state.characters.find((c) => c.id === state.activeCharacterId);
  if (slot?.progress) applyProgressToState(slot.progress);
}

function reconcileActiveCharacterProgress() {
  migrateCharactersStructure();
  if (!state.activeCharacterId || !Array.isArray(state.characters)) return;
  const slot = state.characters.find((c) => c.id === state.activeCharacterId);
  if (!slot?.progress) return;
  const countDone = (qp) =>
    Object.keys(qp?.completed || {}).filter((k) => !k.startsWith("_")).length;
  const rootDone = countDone(state.questProgress);
  const slotDone = countDone(slot.progress.questProgress);
  if (slotDone > rootDone) applyProgressToState(slot.progress);
  flushActiveCharacterToSlot();
}

function initCharacters() {
  migrateCharactersStructure();
  ensureFixedCharacterSlots();
  reconcileActiveCharacterProgress();
}

function characterSlotsFull() {
  migrateCharactersStructure();
  ensureFixedCharacterSlots();
  return !state.characters.some((c) => !slotIsCreated(c));
}

function listCreatedCharacters() {
  migrateCharactersStructure();
  return state.characters.filter((c) => {
    const a = c.progress?.avatar;
    return a?.created && String(a.name || "").trim();
  });
}

function slotIsCreated(slot) {
  const a = slot?.progress?.avatar;
  return !!(a?.created && String(a.name || "").trim());
}

function countCharacterSlots() {
  migrateCharactersStructure();
  ensureFixedCharacterSlots();
  const created = listCreatedCharacters().length;
  return { total: CHARACTER_MAX_SLOTS, created, max: CHARACTER_MAX_SLOTS };
}

function updateHomeCharsSubtitle() {
  const el = document.getElementById("homeCharsSub");
  if (!el) return;
  migrateCharactersStructure();
  const { created, max } = countCharacterSlots();
  const a = state.avatar;
  if (a?.created && String(a.name || "").trim()) {
    el.textContent = "Играем: " + a.name + " · " + created + "/" + max;
  } else if (created === 0) {
    el.textContent = "0/" + max + " · выбери слот и создай героя";
  } else {
    el.textContent = created + "/" + max + " персонажей";
  }
}

function updateCharMenuHint() {
  const el = document.getElementById("charMenuHint");
  if (!el) return;
  migrateCharactersStructure();
  const { created, max } = countCharacterSlots();
  if (created === 0) {
    el.textContent = "5 слотов · нажми пустой или «+ Новый персонаж» · " + created + "/" + max;
  } else {
    el.textContent = "Выбери героя или пустой слот · " + created + "/" + max + " персонажей";
  }
}

function syncCharacterCloudAfterSwitch() {
  if (typeof flushCloudSave === "function") flushCloudSave({ force: true });
  if (typeof noteLeaderboardEvent === "function") {
    noteLeaderboardEvent("snapshot", null, { force: true });
  }
}

function selectCharacter(id) {
  migrateCharactersStructure();
  if (id === state.activeCharacterId) return;
  const slot = state.characters.find((c) => c.id === id);
  if (!slot) return;
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof stopMine === "function") stopMine();
  // Снимок уходящего героя в рейтинг (payload собирается синхронно)
  if (typeof noteLeaderboardEvent === "function" && state.activeCharacterId) {
    noteLeaderboardEvent("snapshot", null, { force: true });
  }
  const fromId = state.activeCharacterId;
  flushActiveCharacterToSlot();
  state.activeCharacterId = id;
  loadActiveCharacter();
  if (typeof migrateAvatar === "function") migrateAvatar();
  save();
  syncCharacterCloudAfterSwitch();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("char_switch", { from: fromId, to: id });
  }
  const feed = document.getElementById("gameLogFeed");
  if (feed) feed.innerHTML = "";
  if (typeof refreshProgressUI === "function") refreshProgressUI();
  syncUiAfterCharacterSwap();
  renderCharacterRoster();
  const a = state.avatar;
  if (a?.created && typeof gameLog === "function") {
    gameLog("Активен: " + a.name, "system");
  } else if (a?.created && typeof toast === "function") {
    toast("Активен: " + a.name, "system");
  }
}

function beginCreateCharacter() {
  if (typeof Audio2 !== "undefined") Audio2.click();
  migrateCharactersStructure();
  ensureFixedCharacterSlots();
  const empty = state.characters.find((c) => !slotIsCreated(c));
  if (!empty) {
    if (typeof toast === "function") toast("Максимум " + CHARACTER_MAX_SLOTS + " персонажей", "warn");
    return;
  }
  if (typeof stopMine === "function") stopMine();
  flushActiveCharacterToSlot();
  resetEmptySlotProgress(empty);
  state.activeCharacterId = empty.id;
  applyProgressToState(empty.progress);
  save();
  if (typeof refreshProgressUI === "function") refreshProgressUI();
  syncUiAfterCharacterSwap();
  renderCharacterRoster();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("char_create", { characterId: empty.id }, { characterId: empty.id });
  }
  if (typeof maybeShowAvatarSetup === "function") maybeShowAvatarSetup();
}

async function deleteCharacter(id) {
  migrateCharactersStructure();
  const slot = state.characters.find((c) => c.id === id);
  if (!slot) return;
  const a = slot.progress?.avatar;
  const created = slotIsCreated(slot);
  const name = created ? String(a.name).trim() : "";
  const message = created
    ? "Удалить персонажа «" + name + "»?\nСлот освободится — прогресс будет потерян."
    : "Слот уже пуст.";
  if (!created) return;
  if (typeof showConfirm === "function") {
    const ok = await showConfirm({
      title: created ? "Удалить персонажа" : "Удалить слот",
      message,
      okText: "Удалить",
      danger: true,
    });
    if (!ok) return;
  }
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof stopMine === "function") stopMine();
  flushActiveCharacterToSlot();
  const wasActive = state.activeCharacterId === id;
  state.characters = state.characters.map((c) =>
    c.id === id ? { id: c.id, progress: freshCharacterProgress() } : c
  );
  if (wasActive) {
    const next =
      state.characters.find((c) => c.id !== id && slotIsCreated(c)) ||
      state.characters.find((c) => c.id !== id) ||
      state.characters[0];
    state.activeCharacterId = next.id;
    loadActiveCharacter();
  }
  if (typeof migrateAvatar === "function") migrateAvatar();
  save();
  syncCharacterCloudAfterSwitch();
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("char_delete", { characterId: id, name: name || null });
  }
  const feed = document.getElementById("gameLogFeed");
  if (feed) feed.innerHTML = "";
  if (typeof refreshProgressUI === "function") refreshProgressUI();
  syncUiAfterCharacterSwap();
  renderCharacterRoster();
  if (typeof toast === "function") {
    toast("Персонаж «" + name + "» удалён · слот свободен", "warn");
  }
}

function onCharacterSlotClick(id) {
  migrateCharactersStructure();
  const slot = state.characters.find((c) => c.id === id);
  if (!slot) return;
  const created = slotIsCreated(slot);
  if (!created) resetEmptySlotProgress(slot);
  if (id !== state.activeCharacterId) selectCharacter(id);
  else if (!created) {
    applyProgressToState(slot.progress);
    if (typeof refreshProgressUI === "function") refreshProgressUI();
    syncUiAfterCharacterSwap();
  }
  if (!created && typeof maybeShowAvatarSetup === "function") maybeShowAvatarSetup();
}

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCharacterRoster() {
  const el = document.getElementById("charRoster");
  if (!el) return;
  migrateCharactersStructure();
  ensureFixedCharacterSlots();
  flushActiveCharacterToSlot();
  updateHomeCharsSubtitle();
  updateCharMenuHint();
  const active = state.activeCharacterId;
  let html = "";
  state.characters.forEach((slot) => {
    const a = slot.progress?.avatar || {};
    const created = slotIsCreated(slot);
    const isActive = slot.id === active;
    const cls = "char-slot-card" + (isActive ? " char-slot-active" : "") + (created ? "" : " char-slot-empty");
    let cardInner = "";
    if (created) {
      const info = typeof avatarDisplayInfo === "function" ? avatarDisplayInfo(a) : { className: "" };
      const portrait =
        typeof avatarPortraitForAvatar === "function"
          ? avatarPortraitForAvatar(a)
          : "icons/char_menu.png?v=10";
      cardInner =
        '<img class="char-slot-portrait" src="' + portrait + '" alt="">' +
        '<span class="char-slot-body">' +
        '<span class="char-slot-name">' + escHtml(a.name) + "</span>" +
        '<span class="char-slot-meta">' + escHtml(info.className) + " · ур. " + (a.level || 1) + "</span>" +
        (isActive ? '<span class="char-slot-badge">Играем</span>' : "") +
        "</span>";
    } else {
      cardInner =
        '<span class="char-slot-portrait char-slot-portrait-ph" aria-hidden="true">?</span>' +
        '<span class="char-slot-body">' +
        '<span class="char-slot-name">Пустой слот</span>' +
        '<span class="char-slot-meta">Нажми, чтобы создать</span>' +
        (isActive ? '<span class="char-slot-badge">Выбран</span>' : "") +
        "</span>";
    }
    html +=
      '<div class="char-slot-row">' +
      '<button type="button" class="' + cls + '" data-char-id="' + slot.id + '">' +
      cardInner +
      "</button>" +
      (created
        ? '<button type="button" class="char-slot-del" data-char-del="' + slot.id + '" title="Удалить персонажа">✕</button>'
        : "") +
      "</div>";
  });
  el.innerHTML = html;
  el.querySelectorAll("[data-char-id]").forEach((btn) => {
    btn.onclick = () => onCharacterSlotClick(btn.dataset.charId);
  });
  el.querySelectorAll("[data-char-del]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteCharacter(btn.dataset.charDel);
    };
  });
  const createBtn = document.getElementById("charMenuCreateBtn");
  if (createBtn) {
    createBtn.disabled = characterSlotsFull();
    createBtn.classList.toggle("disabled", characterSlotsFull());
  }
}

function wireCharacterMenu() {
  const createBtn = document.getElementById("charMenuCreateBtn");
  if (createBtn && !createBtn.dataset.wired) {
    createBtn.dataset.wired = "1";
    createBtn.onclick = () => beginCreateCharacter();
  }
}

initCharacters();

// ===== ProgressStore API: единая точка записи в активный прогресс =====
// Цель: любая запись в progress-ключи root-state проходит через ProgressStore,
// который сразу flush'ит изменения в активный character-слот и триггерит cloud save.
