// ===== ProgressStore: централизованная запись прогресса =====
// Вынесено из 35-characters.js; зависит от CHARACTER_PROGRESS_KEYS
// и runtime-функций flushActiveCharacterToSlot, scheduleCloudSave, snapshotProgressFromState,
// applyProgressToState, reconcileActiveCharacterProgress, loadActiveCharacter,
// migrateCharactersStructure, selectCharacter, beginCreateCharacter, deleteCharacter.

const CHARACTER_PROGRESS_KEYS = [
  "avatar", "adena", "farmZone", "storyProgress", "questProgress",
  "records", "totals", "storySeen", "inventory", "crystals",
  "collectibles", "equipped", "materials", "shots", "autoShots", "achievements",
  "passiveIncome", "autoClicker",
];

const ProgressStore = (function () {
  const _progressKeys = new Set(CHARACTER_PROGRESS_KEYS);

  function _deepClone(v) {
    if (v === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (e) {
      return v;
    }
  }

  function _afterWrite() {
    try {
      if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
    } catch (e) {
      console.error("ProgressStore flush failed:", e);
    }
  }

  function _scheduleCloudSave() {
    try {
      if (typeof scheduleCloudSave === "function") scheduleCloudSave();
    } catch (e) {}
  }

  return {
    /** Список ключей, входящих в персонажный прогресс. */
    keys: CHARACTER_PROGRESS_KEYS.slice(),

    /** Является ли ключ частью progress-слота. */
    isProgressKey(key) {
      return _progressKeys.has(key);
    },

    /** Прочитать progress-ключ из root-state. */
    get(key) {
      return state[key];
    },

    /** Записать progress-ключ, клонировать значение, сделать flush в слот. */
    set(key, value) {
      if (!_progressKeys.has(key)) {
        console.warn("ProgressStore: set on non-progress key " + key + " ignored; use state directly");
        return;
      }
      state[key] = _deepClone(value);
      _afterWrite();
    },

    /** Функциональное обновление: updater(current) -> next. */
    update(key, updater) {
      const current = this.get(key);
      const next = typeof updater === "function" ? updater(current) : updater;
      this.set(key, next);
    },

    /** Пакетная запись нескольких progress-ключей (один flush). */
    setBatch(updates) {
      let changed = false;
      for (const key of Object.keys(updates || {})) {
        if (!_progressKeys.has(key)) continue;
        state[key] = _deepClone(updates[key]);
        changed = true;
      }
      if (changed) _afterWrite();
    },

    /** Выполнить функцию, которая мутирует state, и сделать flush после (без cloud schedule). */
    mutate(fn) {
      if (typeof fn !== "function") return;
      fn(state);
      _afterWrite();
    },

    /** Сделать снимок текущего root-прогресса. */
    snapshot() {
      return typeof snapshotProgressFromState === "function" ? snapshotProgressFromState() : _deepClone(state);
    },

    /** Загрузить снимок в root-state и flush'нуть в активный слот (без cloud schedule). */
    loadSnapshot(snapshot) {
      if (!snapshot) return;
      if (typeof applyProgressToState === "function") {
        applyProgressToState(snapshot);
      } else {
        for (const key of Object.keys(snapshot)) {
          if (_progressKeys.has(key)) state[key] = _deepClone(snapshot[key]);
        }
      }
      this.flush();
    },

    /** Принудительно flush'нуть root в активный слот (без cloud schedule). */
    flush() {
      if (typeof flushActiveCharacterToSlot === "function") flushActiveCharacterToSlot();
    },

    /** Синхронизировать root с активным слотом (например, после cloud apply). */
    sync() {
      if (typeof reconcileActiveCharacterProgress === "function") reconcileActiveCharacterProgress();
      else if (typeof loadActiveCharacter === "function") loadActiveCharacter();
    },

    /**
     * Пакетная запись с отложенным scheduleCloudSave: полезно для миграций,
     * где много вызовов update подряд — внешний код сам вызовет save() или scheduleCloudSave().
     */
    mutateQuiet(fn) {
      if (typeof fn !== "function") return;
      fn(state);
      _afterWrite();
    },

    /** Явно запланировать cloud save. */
    scheduleCloudSave,

    /** Активный слот или null. */
    activeSlot() {
      if (typeof migrateCharactersStructure === "function") migrateCharactersStructure();
      return (state.characters || []).find((c) => c.id === state.activeCharacterId) || null;
    },

    /** id активного слота. */
    activeSlotId() {
      return state.activeCharacterId || null;
    },

    /** Переключить активный слот. */
    setActiveSlot(id) {
      if (typeof selectCharacter === "function") selectCharacter(id);
    },

    /** Создать персонажа в пустом слоте. */
    createCharacter() {
      if (typeof beginCreateCharacter === "function") beginCreateCharacter();
    },

    /** Удалить персонажа. */
    deleteCharacter(id) {
      if (typeof deleteCharacter === "function") deleteCharacter(id);
    },
  };
})();
