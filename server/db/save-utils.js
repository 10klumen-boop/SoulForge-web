"use strict";

function maxPlusFromRecords(records) {
  if (!records || typeof records !== "object") return 0;
  let m = 0;
  for (const k of Object.keys(records)) m = Math.max(m, Number(records[k]) || 0);
  return m;
}

function resolveActiveCharacterId(data) {
  data = data && typeof data === "object" ? data : {};
  if (data.activeCharacterId) return String(data.activeCharacterId).slice(0, 64);
  const chars = Array.isArray(data.characters) ? data.characters : [];
  if (chars[0]?.id) return String(chars[0].id).slice(0, 64);
  if (data.avatar?.created) return "legacy";
  return null;
}

function scoreMetricsFromProgress(progress, opts) {
  opts = opts || {};
  const p = progress && typeof progress === "object" ? progress : {};
  const av = p.avatar || {};
  const farmPower =
    opts.farmPower != null
      ? Math.max(0, Math.floor(Number(opts.farmPower) || 0))
      : 0;
  return {
    char_name: String(av.name || "").slice(0, 48) || null,
    max_plus: maxPlusFromRecords(p.records || {}),
    earned: Math.max(0, Math.floor(Number(p.totals?.earned) || 0)),
    adena: Math.max(0, Math.floor(Number(p.adena) || 0)),
    mobs: Math.max(
      0,
      Math.floor(Number(p.achievements?.stats?.gnomesCaught) || 0)
    ),
    farm_power: farmPower,
  };
}

/** One score row per character slot (for character-bound leaderboard). */
function scoreRowsFromData(userId, nick, data) {
  data = data && typeof data === "object" ? data : {};
  const chars = Array.isArray(data.characters) ? data.characters : [];
  const activeId = data.activeCharacterId;
  const rootFarm = Math.max(0, Math.floor(Number(data.farmPower ?? data._farmPower) || 0));
  const rows = [];
  if (chars.length) {
    for (const slot of chars) {
      if (!slot || !slot.id) continue;
      if (!slot.progress?.avatar?.created) continue;
      const isActive = String(slot.id) === String(activeId) || (!activeId && slot === chars[0]);
      const m = scoreMetricsFromProgress(slot.progress, {
        farmPower: isActive ? rootFarm : undefined,
      });
      rows.push({
        user_id: userId,
        character_id: String(slot.id).slice(0, 64),
        nick,
        ...m,
      });
    }
  } else if (data.avatar?.created) {
    const m = scoreMetricsFromProgress(data, { farmPower: rootFarm });
    rows.push({
      user_id: userId,
      character_id: "legacy",
      nick,
      ...m,
    });
  }
  return rows;
}

function summarizeSaveData(data) {
  data = data && typeof data === "object" ? data : {};
  const chars = Array.isArray(data.characters) ? data.characters : [];
  const activeId = data.activeCharacterId;
  let active = null;
  if (activeId) {
    const slot = chars.find((c) => c && c.id === activeId);
    active = slot?.progress || null;
  }
  if (!active && chars[0]?.progress) active = chars[0].progress;
  if (!active && data.avatar) active = data;
  const av = active?.avatar || data.avatar || {};
  const adena = Math.max(0, Math.floor(Number(active?.adena ?? data.adena) || 0));
  const mobs = Math.max(
    0,
    Math.floor(Number(active?.achievements?.stats?.gnomesCaught ?? data.achievements?.stats?.gnomesCaught) || 0)
  );
  const records = active?.records || data.records || {};
  const maxPlus = maxPlusFromRecords(records);
  const earned = Math.max(
    0,
    Math.floor(Number(active?.totals?.earned ?? data.totals?.earned) || 0)
  );
  const farmPower = Math.max(
    0,
    Math.floor(Number(data.farmPower ?? data._farmPower) || 0)
  );
  return {
    chars_count: chars.length || (av.created ? 1 : 0),
    active_character_id: resolveActiveCharacterId(data),
    active_name: String(av.name || "").slice(0, 48) || null,
    active_level: Math.max(1, Math.floor(Number(av.level) || 1)),
    adena,
    mobs,
    max_plus: maxPlus,
    earned,
    farm_power: farmPower,
    farm_zone: String(active?.farmZone || data.farmZone || "").slice(0, 64) || null,
  };
}

function characterRowsFromData(userId, nick, data) {
  data = data && typeof data === "object" ? data : {};
  const chars = Array.isArray(data.characters) ? data.characters : [];
  const rows = [];
  if (chars.length) {
    for (const slot of chars) {
      if (!slot || !slot.id) continue;
      const p = slot.progress || {};
      const av = p.avatar || {};
      rows.push({
        user_id: userId,
        slot_id: String(slot.id).slice(0, 64),
        nick,
        name: String(av.name || "").slice(0, 48) || null,
        race_id: String(av.raceId || "").slice(0, 32) || null,
        class_id: String(av.classId || "").slice(0, 32) || null,
        gender_id: String(av.genderId || "").slice(0, 16) || null,
        level: Math.max(1, Math.floor(Number(av.level) || 1)),
        adena: Math.max(0, Math.floor(Number(p.adena) || 0)),
        farm_zone: String(p.farmZone || "").slice(0, 64) || null,
        created: av.created ? 1 : 0,
      });
    }
  } else if (data.avatar?.created) {
    rows.push({
      user_id: userId,
      slot_id: "legacy",
      nick,
      name: String(data.avatar.name || "").slice(0, 48) || null,
      race_id: String(data.avatar.raceId || "").slice(0, 32) || null,
      class_id: String(data.avatar.classId || "").slice(0, 32) || null,
      gender_id: String(data.avatar.genderId || "").slice(0, 16) || null,
      level: Math.max(1, Math.floor(Number(data.avatar.level) || 1)),
      adena: Math.max(0, Math.floor(Number(data.adena) || 0)),
      farm_zone: String(data.farmZone || "").slice(0, 64) || null,
      created: 1,
    });
  }
  return rows;
}

function parseSavePayload(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch (e) {
    return null;
  }
}

module.exports = {
  maxPlusFromRecords,
  resolveActiveCharacterId,
  scoreMetricsFromProgress,
  scoreRowsFromData,
  summarizeSaveData,
  characterRowsFromData,
  parseSavePayload,
};
