#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { createStore } = require("./db");
const { maxPlusFromRecords, parseSavePayload, resolveActiveCharacterId } = require("./db/save-utils");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.SOULFORGE_DATA || path.join(__dirname, "data");
const DB_PATH = process.env.SOULFORGE_DB || path.join(DATA_DIR, "soulforge.db");
const SERVE_GAME = process.env.SOULFORGE_SERVE_GAME !== "0";
const GAME_DIR = process.env.SOULFORGE_GAME || path.join(__dirname, "..", "game");
const ADMIN_DIR = path.join(__dirname, "admin");
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;
const WRITE_LEASE_TTL_MS = Number(process.env.SOULFORGE_LEASE_TTL_MS || 90_000);
const ADMIN_KEY = String(process.env.SOULFORGE_ADMIN_KEY || "").trim();
const NICK_RE = /^[a-zA-Z]{2,16}$/;
const PASS_RE = /^[a-zA-Z0-9]{6,72}$/;
/** writerId = deviceId.tabId (одна вкладка) */
const WRITER_ID_RE = /^[A-Za-z0-9_.-]{8,96}$/;

const store = createStore({ dataDir: DATA_DIR, dbPath: DB_PATH });
const dbInfo = store.info();

function normalizeWriterId(raw) {
  const id = String(raw || "").trim().slice(0, 96);
  return WRITER_ID_RE.test(id) ? id : null;
}

function readWriterId(body) {
  return normalizeWriterId(body?.deviceId) || normalizeWriterId(body?.writerId);
}

function leasePayload(lease) {
  if (!lease) return null;
  return {
    writerId: lease.device_id,
    deviceId: lease.device_id,
    claimedAt: lease.claimed_at,
    expiresAt: lease.expires_at,
  };
}

function jsonError(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

function adminKeyOk(got) {
  if (!ADMIN_KEY) return false;
  try {
    const a = Buffer.from(String(got || ""), "utf8");
    const b = Buffer.from(ADMIN_KEY, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return jsonError(res, 404, "Админ-панель отключена");
  const key = req.headers["x-soulforge-admin"];
  if (!adminKeyOk(key)) return jsonError(res, 401, "Неверный ключ администратора");
  next();
}

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function authUser(req) {
  const header = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  const token = m ? m[1].trim() : (req.body && req.body.token) || "";
  if (!token) return null;
  store.deleteExpiredSessions(Date.now());
  const row = store.getSession(token);
  if (!row || row.exp < Date.now()) return null;
  return { id: row.user_id, nick: row.nick, token };
}

function createSession(userId) {
  const token = newToken();
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  store.insertSession(token, userId, exp);
  return { token, exp };
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "soulforge-cloud", version: "0.39.2", db: dbInfo.driver });
});

app.post("/auth/register", (req, res) => {
  const nick = String(req.body?.nick || "").trim();
  const password = String(req.body?.password || "");
  if (!NICK_RE.test(nick)) {
    return jsonError(res, 400, "Ник: 2–16 латинских букв (a-z, A-Z)");
  }
  if (!PASS_RE.test(password)) {
    return jsonError(res, 400, "Пароль: 6–72 символа, только латиница и цифры");
  }
  if (store.getUserByNick(nick)) {
    return jsonError(res, 409, "Ник уже занят");
  }
  const passHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const created = store.insertUser(nick, passHash, Date.now());
  const session = createSession(created.id);
  res.json({
    ok: true,
    nick,
    token: session.token,
    exp: session.exp,
  });
});

app.post("/auth/login", (req, res) => {
  const nick = String(req.body?.nick || "").trim();
  const password = String(req.body?.password || "");
  const user = store.getUserByNick(nick);
  if (!user || !bcrypt.compareSync(password, user.pass_hash)) {
    return jsonError(res, 401, "Неверный ник или пароль");
  }
  const session = createSession(user.id);
  res.json({
    ok: true,
    nick: user.nick,
    token: session.token,
    exp: session.exp,
  });
});

app.post("/auth/logout", (req, res) => {
  const user = authUser(req);
  if (user?.token) {
    const deviceId = readWriterId(req.body);
    if (deviceId) store.releaseWriteLease(user.id, deviceId);
    store.deleteSession(user.token);
  }
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Нет сессии");
  const row = store.getUserById(user.id);
  res.json({ ok: true, nick: row.nick, id: row.id });
});

app.post("/runs", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const body = req.body || {};
  const maxPlus = Math.max(
    0,
    Number(body.maxPlus) || maxPlusFromRecords(body.records) || 0
  );
  const farmPower = Math.max(0, Math.floor(Number(body.farmPower) || 0));
  const earned = Math.max(
    0,
    Math.floor(Number(body.earned ?? body.totals?.earned) || 0)
  );
  const adena = Math.max(0, Math.floor(Number(body.adena) || 0));
  const mobs = Math.max(
    0,
    Math.floor(
      Number(body.mobs ?? body.kills ?? body.totals?.gnomesCaught ?? body.achievements?.stats?.gnomesCaught) || 0
    )
  );
  let characterId = String(body.characterId || body.activeCharacterId || "").slice(0, 64);
  let charName =
    String(body.charName || body.characterName || "").trim().slice(0, 48) || null;
  if (!characterId) {
    const save = store.getSave(user.id);
    const data = parseSavePayload(save);
    characterId = resolveActiveCharacterId(data) || "legacy";
    if (!charName && data) {
      const av =
        (Array.isArray(data.characters)
          ? data.characters.find((c) => c && c.id === characterId)?.progress?.avatar
          : null) || data.avatar;
      charName = av?.name ? String(av.name).slice(0, 48) : null;
    }
  }
  const now = Date.now();
  const prev = store.getScore(user.id, characterId);
  store.upsertScore({
    user_id: user.id,
    character_id: characterId,
    char_name: charName || prev?.char_name || null,
    max_plus: Math.max(prev?.max_plus || 0, maxPlus),
    farm_power: Math.max(prev?.farm_power || 0, farmPower),
    earned: Math.max(prev?.earned || 0, earned),
    adena,
    mobs: Math.max(prev?.mobs || 0, mobs),
    client_version: String(body.clientVersion || "").slice(0, 32),
    updated_at: now,
  });
  res.json({ ok: true, characterId });
});

app.post("/events", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const body = req.body || {};
  let list = Array.isArray(body.events) ? body.events : null;
  if (!list && body.event) list = [body];
  if (!list || !list.length) return jsonError(res, 400, "Нужен массив events");
  if (list.length > 100) list = list.slice(0, 100);
  const inserted = store.insertCharacterEvents(user.id, list);
  res.json({ ok: true, inserted: inserted.length, ids: inserted.map((x) => x.id) });
});

app.get("/events", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const characterId = String(req.query.characterId || req.query.character_id || "").slice(0, 64) || null;
  const limit = Number(req.query.limit) || 100;
  const rows = store.listCharacterEvents(user.id, characterId, limit);
  res.json({ ok: true, rows });
});

app.get("/backups", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const characterId = String(req.query.characterId || req.query.character_id || "").slice(0, 64) || null;
  const limit = Number(req.query.limit) || 40;
  const rows = store.listCharacterBackups(user.id, characterId, limit);
  res.json({ ok: true, rows });
});

app.get("/save", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const row = store.getSave(user.id);
  const now = Date.now();
  const lease = store.getWriteLease(user.id);
  const leaseActive = lease && lease.expires_at > now ? leasePayload(lease) : null;
  if (!row) {
    return res.json({ ok: true, empty: true, lease: leaseActive });
  }
  const data = parseSavePayload(row);
  if (!data) return jsonError(res, 500, "Повреждённый сейв на сервере");
  res.json({
    ok: true,
    empty: false,
    seq: row.seq,
    savedAt: row.saved_at,
    clientVersion: row.client_version,
    data,
    lease: leaseActive,
    summary: {
      charsCount: row.chars_count,
      activeName: row.active_name,
      activeLevel: row.active_level,
      adena: row.adena,
      mobs: row.mobs,
      maxPlus: row.max_plus,
      farmZone: row.farm_zone,
    },
  });
});

app.post("/save/lease", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const deviceId = readWriterId(req.body);
  if (!deviceId) return jsonError(res, 400, "Нужен writerId (вкладка/устройство)");
  const takeover = !!req.body?.takeover;
  const now = Date.now();
  const result = store.claimWriteLease(user.id, deviceId, now, WRITE_LEASE_TTL_MS, takeover);
  if (!result.ok) {
    if (result.error === "need_device") return jsonError(res, 400, "Нужен writerId");
    return res.status(423).json({
      ok: false,
      error: "Аккаунт открыт на другом устройстве или во вкладке",
      locked: true,
      lease: leasePayload(result.lease),
    });
  }
  res.json({
    ok: true,
    lease: leasePayload(result.lease),
    tookOver: !!result.tookOver,
    ttlMs: WRITE_LEASE_TTL_MS,
  });
});

app.post("/save/lease/renew", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const deviceId = readWriterId(req.body);
  if (!deviceId) return jsonError(res, 400, "Нужен writerId (вкладка/устройство)");
  const now = Date.now();
  const result = store.renewWriteLease(user.id, deviceId, now, WRITE_LEASE_TTL_MS);
  if (!result.ok) {
    return res.status(423).json({
      ok: false,
      error: result.expired
        ? "Сессия записи истекла"
        : "Аккаунт открыт на другом устройстве или во вкладке",
      locked: true,
      lease: leasePayload(result.lease),
    });
  }
  res.json({ ok: true, lease: leasePayload(result.lease), ttlMs: WRITE_LEASE_TTL_MS });
});

app.post("/save/lease/release", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const deviceId = readWriterId(req.body);
  if (deviceId) store.releaseWriteLease(user.id, deviceId);
  res.json({ ok: true });
});

app.put("/save", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const body = req.body || {};
  const data = body.data;
  if (!data || typeof data !== "object") {
    return jsonError(res, 400, "Нужен data (объект прогресса)");
  }
  const deviceId = readWriterId(body);
  if (!deviceId) return jsonError(res, 400, "Нужен writerId для сохранения");
  const now = Date.now();
  let leaseCheck = store.assertWriteLease(user.id, deviceId, now);
  if (!leaseCheck.ok && leaseCheck.missing) {
    const claimed = store.claimWriteLease(user.id, deviceId, now, WRITE_LEASE_TTL_MS, false);
    if (!claimed.ok) {
      return res.status(423).json({
        ok: false,
        error: "Аккаунт открыт на другом устройстве или во вкладке",
        locked: true,
        lease: leasePayload(claimed.lease),
      });
    }
    leaseCheck = { ok: true, lease: claimed.lease };
  } else if (!leaseCheck.ok) {
    return res.status(423).json({
      ok: false,
      error: "Аккаунт открыт на другом устройстве или во вкладке",
      locked: true,
      lease: leasePayload(leaseCheck.lease),
    });
  } else {
    store.renewWriteLease(user.id, deviceId, now, WRITE_LEASE_TTL_MS);
  }
  const seq = Math.max(0, Math.floor(Number(body.seq) || 0));
  const savedAt = Math.max(0, Math.floor(Number(body.savedAt) || Date.now()));
  const prev = store.getSave(user.id);
  // Strictly newer seq only — equal/older must not overwrite (stale in-flight PUTs).
  if (prev && seq <= (prev.seq || 0)) {
    const prevData = parseSavePayload(prev);
    return res.status(409).json({
      ok: false,
      error: "На сервере более новый сейв",
      conflict: true,
      seq: prev.seq,
      savedAt: prev.saved_at,
      data: prevData,
      lease: leasePayload(store.getWriteLease(user.id)),
    });
  }
  try {
    if (typeof body.farmPower === "number") data.farmPower = body.farmPower;
    const { summary } = store.persistPlayerSave(
      user,
      seq,
      savedAt,
      body.clientVersion,
      data
    );
    res.json({
      ok: true,
      seq,
      savedAt,
      summary,
      lease: leasePayload(store.getWriteLease(user.id)),
    });
  } catch (e) {
    console.error("PUT /save failed:", e);
    return jsonError(res, 500, "Не удалось сохранить");
  }
});

app.get("/leaderboard/:mode", (req, res) => {
  const mode = String(req.params.mode || "enchant").toLowerCase();
  const limit = Number(req.query.limit) || 50;
  if (!["enchant", "power", "wealth", "mobs", "default"].includes(mode)) {
    return jsonError(res, 400, "mode: enchant | power | wealth | mobs");
  }
  const rows = store.getLeaderboard(mode === "default" ? "enchant" : mode, limit);
  res.json(rows);
});

app.get("/admin/enabled", (_req, res) => {
  res.json({ ok: true, enabled: !!ADMIN_KEY });
});

const admin = express.Router();
admin.use(requireAdmin);

admin.get("/overview", (_req, res) => {
  const counts = store.getOverviewCounts(Date.now());
  res.json({ ok: true, ...counts, db: dbInfo.label });
});

admin.get("/users", (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = String(req.query.q || "").trim();
  const rows = store.listAdminUsers({ q, limit, offset, now: Date.now() });
  res.json({ ok: true, rows });
});

admin.get("/users/:id", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  const detail = store.getAdminUserDetail(userId);
  if (!detail) return jsonError(res, 404, "Пользователь не найден");
  res.json({ ok: true, ...detail });
});

admin.get("/events", (req, res) => {
  const result = store.adminListEvents({
    nick: String(req.query.nick || req.query.q || "").trim() || null,
    characterId: String(req.query.characterId || "").slice(0, 64) || null,
    event: String(req.query.event || "").slice(0, 32) || null,
    since: req.query.since ? Number(req.query.since) : null,
    until: req.query.until ? Number(req.query.until) : null,
    limit: Number(req.query.limit) || 100,
    offset: Number(req.query.offset) || 0,
  });
  res.json({ ok: true, ...result });
});

admin.get("/events/types", (_req, res) => {
  res.json({ ok: true, rows: store.listEventTypes() });
});

admin.get("/analytics/balance", (req, res) => {
  const since = req.query.since ? Number(req.query.since) : null;
  const until = req.query.until ? Number(req.query.until) : null;
  res.json({ ok: true, ...store.getBalanceDashboard({ since, until }) });
});

admin.get("/analytics/export", (req, res) => {
  const kind = String(req.query.kind || "farm").slice(0, 24);
  const since = req.query.since ? Number(req.query.since) : null;
  const until = req.query.until ? Number(req.query.until) : null;
  const csv = store.exportBalanceCsv({ kind, since, until });
  const name = "soulforge-balance-" + kind + ".csv";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="' + name + '"');
  res.send("\uFEFF" + csv);
});

admin.get("/alerts", (req, res) => {
  const result = store.adminListAlerts({
    severity: String(req.query.severity || "").slice(0, 16) || null,
    since: req.query.since ? Number(req.query.since) : null,
    until: req.query.until ? Number(req.query.until) : null,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  res.json({ ok: true, ...result });
});

admin.get("/backups", (req, res) => {
  const result = store.adminListBackups({
    nick: String(req.query.nick || req.query.q || "").trim() || null,
    characterId: String(req.query.characterId || "").slice(0, 64) || null,
    since: req.query.since ? Number(req.query.since) : null,
    until: req.query.until ? Number(req.query.until) : null,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  res.json({ ok: true, ...result });
});

admin.get("/scores", (req, res) => {
  const result = store.adminListScores({
    nick: String(req.query.nick || req.query.q || "").trim() || null,
    limit: Number(req.query.limit) || 100,
    offset: Number(req.query.offset) || 0,
    sort: String(req.query.sort || "enchant"),
  });
  res.json({ ok: true, ...result });
});

admin.put("/users/:id/score", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  if (!store.getUserById(userId)) return jsonError(res, 404, "Пользователь не найден");
  const body = req.body || {};
  const now = Date.now();
  let characterId = String(body.character_id || body.characterId || "").slice(0, 64);
  let rawCharName = body.char_name || body.charName;
  if (!characterId) {
    const save = store.getSave(userId);
    const data = parseSavePayload(save);
    characterId = resolveActiveCharacterId(data) || "legacy";
    if (!rawCharName && data) {
      const av =
        (Array.isArray(data.characters)
          ? data.characters.find((c) => c && c.id === characterId)?.progress?.avatar
          : null) || data.avatar;
      rawCharName = av?.name || null;
    }
  }
  const row = {
    user_id: userId,
    character_id: characterId,
    char_name: rawCharName ? String(rawCharName).slice(0, 48) : null,
    max_plus: Math.max(0, Math.floor(Number(body.max_plus) || 0)),
    farm_power: Math.max(0, Math.floor(Number(body.farm_power) || 0)),
    earned: Math.max(0, Math.floor(Number(body.earned) || 0)),
    adena: Math.max(0, Math.floor(Number(body.adena) || 0)),
    mobs: Math.max(0, Math.floor(Number(body.mobs) || 0)),
    client_version: String(body.client_version || "admin").slice(0, 32),
    updated_at: now,
  };
  store.upsertScore(row);
  res.json({ ok: true, score: row });
});

admin.post("/users/:id/password", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  const user = store.getUserById(userId);
  if (!user) return jsonError(res, 404, "Пользователь не найден");
  const password = String(req.body?.password || "");
  if (!PASS_RE.test(password)) {
    return jsonError(res, 400, "Пароль: 6–72 символа, только латиница и цифры");
  }
  const passHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  store.updateUserPassword(userId, passHash);
  res.json({ ok: true, nick: user.nick });
});

admin.delete("/users/:id", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  const user = store.getUserById(userId);
  if (!user) return jsonError(res, 404, "Пользователь не найден");
  store.deleteUser(userId);
  res.json({ ok: true, nick: user.nick });
});

admin.post("/maintenance/purge-sessions", (_req, res) => {
  const info = store.deleteExpiredSessions(Date.now());
  res.json({ ok: true, removed: info.changes });
});

admin.get("/users/:id/events", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  if (!store.getUserById(userId)) return jsonError(res, 404, "Пользователь не найден");
  const characterId = String(req.query.characterId || "").slice(0, 64) || null;
  const rows = store.listCharacterEvents(userId, characterId, Number(req.query.limit) || 200);
  res.json({ ok: true, rows });
});

admin.get("/users/:id/backups", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  if (!store.getUserById(userId)) return jsonError(res, 404, "Пользователь не найден");
  const characterId = String(req.query.characterId || "").slice(0, 64) || null;
  const rows = store.listCharacterBackups(userId, characterId, Number(req.query.limit) || 40);
  res.json({ ok: true, rows });
});

admin.get("/users/:id/backups/:backupId", (req, res) => {
  const userId = Number(req.params.id);
  const backupId = Number(req.params.backupId);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  if (!Number.isInteger(backupId) || backupId < 1) return jsonError(res, 400, "Некорректный backupId");
  const row = store.getCharacterBackup(userId, backupId);
  if (!row) return jsonError(res, 404, "Бэкап не найден");
  res.json({ ok: true, backup: row });
});

admin.post("/users/:id/backups/:backupId/restore", (req, res) => {
  const userId = Number(req.params.id);
  const backupId = Number(req.params.backupId);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  if (!Number.isInteger(backupId) || backupId < 1) return jsonError(res, 400, "Некорректный backupId");
  const user = store.getUserById(userId);
  if (!user) return jsonError(res, 404, "Пользователь не найден");
  const result = store.restoreCharacterBackup(user, backupId);
  if (!result.ok) {
    const map = {
      not_found: [404, "Бэкап не найден"],
      bad_backup: [500, "Повреждённый бэкап"],
      no_save: [404, "Нет сейва"],
      bad_save: [500, "Повреждённый сейв"],
    };
    const [code, msg] = map[result.error] || [400, result.error || "Ошибка"];
    return jsonError(res, code, msg);
  }
  res.json({ ok: true, ...result });
});

app.use("/admin", admin);

if (fs.existsSync(ADMIN_DIR)) {
  app.use("/db-admin", express.static(ADMIN_DIR, { index: "index.html" }));
}

if (SERVE_GAME && fs.existsSync(GAME_DIR)) {
  app.use(express.static(GAME_DIR, { fallthrough: true, index: "index.html" }));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/auth") ||
      req.path.startsWith("/runs") ||
      req.path.startsWith("/events") ||
      req.path.startsWith("/backups") ||
      req.path.startsWith("/save") ||
      req.path.startsWith("/leaderboard") ||
      req.path.startsWith("/admin") ||
      req.path.startsWith("/db-admin")
    ) {
      return next();
    }
    res.sendFile(path.join(GAME_DIR, "index.html"), (err) => {
      if (err) next();
    });
  });
}

app.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`SoulForge cloud http://${shown}:${PORT} (bind ${HOST})`);
  console.log(`DB: ${dbInfo.driver} · ${dbInfo.path}`);
  if (ADMIN_KEY) console.log("Admin console: /db-admin/ (header X-Soulforge-Admin)");
  else console.log("Admin API: disabled (set SOULFORGE_ADMIN_KEY to enable)");
  if (SERVE_GAME && fs.existsSync(GAME_DIR)) {
    console.log(`Static game: ${GAME_DIR}`);
  }
});
