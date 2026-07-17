// ===== Несколько персонажей: слоты, выбор, отдельный прогресс =====

const CHARACTER_MAX_SLOTS = 5;
const CHARACTER_PROGRESS_KEYS = [
  "avatar", "adena", "farmZone", "storyProgress", "questProgress",
  "records", "totals", "storySeen", "inventory", "crystals",
  "collectibles", "equipped", "materials", "shots", "autoShots", "achievements",
];

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

function initCharacters() {
  const hadSlots = state.characters && state.characters.length;
  migrateCharactersStructure();
  if (hadSlots) loadActiveCharacter();
}

function characterSlotsFull() {
  migrateCharactersStructure();
  return state.characters.length >= CHARACTER_MAX_SLOTS;
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

function updateHomeCharsSubtitle() {
  const el = document.getElementById("homeCharsSub");
  if (!el) return;
  migrateCharactersStructure();
  const a = state.avatar;
  if (a?.created && String(a.name || "").trim()) {
    el.textContent = "Играем: " + a.name;
  } else {
    el.textContent = "Выбор и создание";
  }
}

function selectCharacter(id) {
  migrateCharactersStructure();
  if (id === state.activeCharacterId) return;
  const slot = state.characters.find((c) => c.id === id);
  if (!slot) return;
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (typeof stopMine === "function") stopMine();
  flushActiveCharacterToSlot();
  state.activeCharacterId = id;
  loadActiveCharacter();
  if (typeof migrateAvatar === "function") migrateAvatar();
  save();
  const feed = document.getElementById("gameLogFeed");
  if (feed) feed.innerHTML = "";
  if (typeof refreshProgressUI === "function") refreshProgressUI();
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
  if (characterSlotsFull()) {
    if (typeof toast === "function") toast("Максимум " + CHARACTER_MAX_SLOTS + " персонажей", "warn");
    return;
  }
  if (typeof stopMine === "function") stopMine();
  flushActiveCharacterToSlot();
  const id = newCharacterId();
  const progress = freshCharacterProgress();
  state.characters.push({ id, progress });
  state.activeCharacterId = id;
  applyProgressToState(progress);
  save();
  renderCharacterRoster();
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
    ? "Удалить персонажа «" + name + "»?\nВесь его прогресс будет потерян без восстановления."
    : "Удалить пустой слот?";
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
  state.characters = state.characters.filter((c) => c.id !== id);
  if (!state.characters.length) {
    const newId = newCharacterId();
    state.characters.push({ id: newId, progress: freshCharacterProgress() });
    state.activeCharacterId = newId;
  } else if (state.activeCharacterId === id) {
    state.activeCharacterId = state.characters[0].id;
  }
  loadActiveCharacter();
  if (typeof migrateAvatar === "function") migrateAvatar();
  save();
  const feed = document.getElementById("gameLogFeed");
  if (feed) feed.innerHTML = "";
  if (typeof refreshProgressUI === "function") refreshProgressUI();
  renderCharacterRoster();
  if (typeof toast === "function") {
    toast(created ? "Персонаж «" + name + "» удалён" : "Слот удалён", "warn");
  }
}

function onCharacterSlotClick(id) {
  migrateCharactersStructure();
  const slot = state.characters.find((c) => c.id === id);
  if (!slot) return;
  const created = slotIsCreated(slot);
  if (id !== state.activeCharacterId) selectCharacter(id);
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
  flushActiveCharacterToSlot();
  updateHomeCharsSubtitle();
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
      '<button type="button" class="char-slot-del" data-char-del="' + slot.id + '" title="Удалить">✕</button>' +
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
