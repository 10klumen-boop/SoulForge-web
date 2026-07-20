#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.SOULFORGE_DATA || path.join(__dirname, "data");
const DB_PATH = process.env.SOULFORGE_DB || path.join(DATA_DIR, "soulforge.db");
const SERVE_GAME = process.env.SOULFORGE_SERVE_GAME !== "0";
const GAME_DIR = process.env.SOULFORGE_GAME || path.join(__dirname, "..", "game");
const ADMIN_DIR = path.join(__dirname, "admin");
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;
const ADMIN_KEY = String(process.env.SOULFORGE_ADMIN_KEY || "").trim();
const NICK_RE = /^[a-zA-Z]{2,16}$/;
const PASS_RE = /^[a-zA-Z0-9]{6,72}$/;

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    exp INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS scores (
    user_id INTEGER PRIMARY KEY,
    max_plus INTEGER NOT NULL DEFAULT 0,
    farm_power INTEGER NOT NULL DEFAULT 0,
    earned INTEGER NOT NULL DEFAULT 0,
    adena INTEGER NOT NULL DEFAULT 0,
    mobs INTEGER NOT NULL DEFAULT 0,
    client_version TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function ensureScoreColumn(name, ddl) {
  const cols = db.prepare("PRAGMA table_info(scores)").all();
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE scores ADD COLUMN ${name} ${ddl}`);
  }
}
ensureScoreColumn("mobs", "INTEGER NOT NULL DEFAULT 0");

db.exec(`
  CREATE TABLE IF NOT EXISTS player_saves (
    user_id INTEGER PRIMARY KEY,
    nick TEXT NOT NULL,
    payload TEXT NOT NULL,
    seq INTEGER NOT NULL DEFAULT 0,
    saved_at INTEGER NOT NULL,
    client_version TEXT,
    chars_count INTEGER NOT NULL DEFAULT 0,
    active_name TEXT,
    active_level INTEGER NOT NULL DEFAULT 1,
    adena INTEGER NOT NULL DEFAULT 0,
    mobs INTEGER NOT NULL DEFAULT 0,
    max_plus INTEGER NOT NULL DEFAULT 0,
    farm_zone TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS player_characters (
    user_id INTEGER NOT NULL,
    slot_id TEXT NOT NULL,
    nick TEXT NOT NULL,
    name TEXT,
    race_id TEXT,
    class_id TEXT,
    gender_id TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    adena INTEGER NOT NULL DEFAULT 0,
    farm_zone TEXT,
    created INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, slot_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const stmtUserByNick = db.prepare("SELECT * FROM users WHERE nick = ? COLLATE NOCASE");
const stmtUserById = db.prepare("SELECT id, nick, created_at FROM users WHERE id = ?");
const stmtInsertUser = db.prepare(
  "INSERT INTO users (nick, pass_hash, created_at) VALUES (?, ?, ?)"
);
const stmtInsertSession = db.prepare(
  "INSERT INTO sessions (token, user_id, exp) VALUES (?, ?, ?)"
);
const stmtSession = db.prepare(
  "SELECT s.token, s.user_id, s.exp, u.nick FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
);
const stmtDeleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");
const stmtDeleteExpired = db.prepare("DELETE FROM sessions WHERE exp < ?");
const stmtUpsertScore = db.prepare(`
  INSERT INTO scores (user_id, max_plus, farm_power, earned, adena, mobs, client_version, updated_at)
  VALUES (@user_id, @max_plus, @farm_power, @earned, @adena, @mobs, @client_version, @updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    max_plus = excluded.max_plus,
    farm_power = excluded.farm_power,
    earned = excluded.earned,
    adena = excluded.adena,
    mobs = excluded.mobs,
    client_version = excluded.client_version,
    updated_at = excluded.updated_at
`);
const stmtGetSave = db.prepare("SELECT * FROM player_saves WHERE user_id = ?");
const stmtUpsertSave = db.prepare(`
  INSERT INTO player_saves (
    user_id, nick, payload, seq, saved_at, client_version,
    chars_count, active_name, active_level, adena, mobs, max_plus, farm_zone, updated_at
  ) VALUES (
    @user_id, @nick, @payload, @seq, @saved_at, @client_version,
    @chars_count, @active_name, @active_level, @adena, @mobs, @max_plus, @farm_zone, @updated_at
  )
  ON CONFLICT(user_id) DO UPDATE SET
    nick = excluded.nick,
    payload = excluded.payload,
    seq = excluded.seq,
    saved_at = excluded.saved_at,
    client_version = excluded.client_version,
    chars_count = excluded.chars_count,
    active_name = excluded.active_name,
    active_level = excluded.active_level,
    adena = excluded.adena,
    mobs = excluded.mobs,
    max_plus = excluded.max_plus,
    farm_zone = excluded.farm_zone,
    updated_at = excluded.updated_at
`);
const stmtDeleteChars = db.prepare("DELETE FROM player_characters WHERE user_id = ?");
const stmtInsertChar = db.prepare(`
  INSERT INTO player_characters (
    user_id, slot_id, nick, name, race_id, class_id, gender_id, level, adena, farm_zone, created
  ) VALUES (
    @user_id, @slot_id, @nick, @name, @race_id, @class_id, @gender_id, @level, @adena, @farm_zone, @created
  )
`);
const stmtCountSaves = db.prepare("SELECT COUNT(*) AS n FROM player_saves");

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

function persistPlayerSave(user, seq, savedAt, clientVersion, data) {
  const summary = summarizeSaveData(data);
  const payload = JSON.stringify(data);
  const now = Date.now();
  const saveRow = {
    user_id: user.id,
    nick: user.nick,
    payload,
    seq: Math.max(0, Math.floor(Number(seq) || 0)),
    saved_at: Math.max(0, Math.floor(Number(savedAt) || now)),
    client_version: String(clientVersion || "").slice(0, 32),
    chars_count: summary.chars_count,
    active_name: summary.active_name,
    active_level: summary.active_level,
    adena: summary.adena,
    mobs: summary.mobs,
    max_plus: summary.max_plus,
    farm_zone: summary.farm_zone,
    updated_at: now,
  };
  const tx = db.transaction(() => {
    stmtUpsertSave.run(saveRow);
    stmtDeleteChars.run(user.id);
    for (const row of characterRowsFromData(user.id, user.nick, data)) {
      stmtInsertChar.run(row);
    }
    const prev = db.prepare("SELECT * FROM scores WHERE user_id = ?").get(user.id);
    stmtUpsertScore.run({
      user_id: user.id,
      max_plus: Math.max(prev?.max_plus || 0, summary.max_plus),
      farm_power: Math.max(prev?.farm_power || 0, summary.farm_power),
      earned: Math.max(prev?.earned || 0, summary.earned),
      adena: summary.adena,
      mobs: Math.max(prev?.mobs || 0, summary.mobs),
      client_version: saveRow.client_version,
      updated_at: now,
    });
  });
  tx();
  return { saveRow, summary };
}

function parseSavePayload(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch (e) {
    return null;
  }
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
  stmtDeleteExpired.run(Date.now());
  const row = stmtSession.get(token);
  if (!row || row.exp < Date.now()) return null;
  return { id: row.user_id, nick: row.nick, token };
}

function createSession(userId) {
  const token = newToken();
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  stmtInsertSession.run(token, userId, exp);
  return { token, exp };
}

function maxPlusFromRecords(records) {
  if (!records || typeof records !== "object") return 0;
  let m = 0;
  for (const k of Object.keys(records)) m = Math.max(m, Number(records[k]) || 0);
  return m;
}

function boardRows(mode, limit) {
  limit = Math.min(100, Math.max(1, limit || 50));
  let order = "s.max_plus DESC, s.updated_at ASC";
  let valueExpr = "s.max_plus";
  if (mode === "power") {
    order = "s.farm_power DESC, s.updated_at ASC";
    valueExpr = "s.farm_power";
  } else if (mode === "wealth") {
    order = "s.earned DESC, s.updated_at ASC";
    valueExpr = "s.earned";
  } else if (mode === "mobs") {
    order = "s.mobs DESC, s.updated_at ASC";
    valueExpr = "s.mobs";
  } else {
    mode = "enchant";
  }
  const rows = db
    .prepare(
      `SELECT u.nick AS name, ${valueExpr} AS value, s.max_plus, s.farm_power, s.earned, s.adena, s.mobs, s.updated_at
       FROM scores s JOIN users u ON u.id = s.user_id
       ORDER BY ${order}
       LIMIT ?`
    )
    .all(limit);
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    value: r.value,
    maxPlus: r.max_plus,
    farmPower: r.farm_power,
    earned: r.earned,
    adena: r.adena,
    mobs: r.mobs || 0,
    updatedAt: r.updated_at,
    mode,
  }));
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "soulforge-cloud", version: "0.31.0" });
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
  if (stmtUserByNick.get(nick)) {
    return jsonError(res, 409, "Ник уже занят");
  }
  const passHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const info = stmtInsertUser.run(nick, passHash, Date.now());
  const session = createSession(info.lastInsertRowid);
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
  const user = stmtUserByNick.get(nick);
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
  if (user?.token) stmtDeleteSession.run(user.token);
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Нет сессии");
  const row = stmtUserById.get(user.id);
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
  const now = Date.now();
  const prev = db.prepare("SELECT * FROM scores WHERE user_id = ?").get(user.id);
  const next = {
    user_id: user.id,
    max_plus: Math.max(prev?.max_plus || 0, maxPlus),
    farm_power: Math.max(prev?.farm_power || 0, farmPower),
    earned: Math.max(prev?.earned || 0, earned),
    adena,
    mobs: Math.max(prev?.mobs || 0, mobs),
    client_version: String(body.clientVersion || "").slice(0, 32),
    updated_at: now,
  };
  stmtUpsertScore.run(next);
  res.json({ ok: true });
});

app.get("/save", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const row = stmtGetSave.get(user.id);
  if (!row) return res.json({ ok: true, empty: true });
  const data = parseSavePayload(row);
  if (!data) return jsonError(res, 500, "Повреждённый сейв на сервере");
  res.json({
    ok: true,
    empty: false,
    seq: row.seq,
    savedAt: row.saved_at,
    clientVersion: row.client_version,
    data,
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

app.put("/save", (req, res) => {
  const user = authUser(req);
  if (!user) return jsonError(res, 401, "Войдите в аккаунт");
  const body = req.body || {};
  const data = body.data;
  if (!data || typeof data !== "object") {
    return jsonError(res, 400, "Нужен data (объект прогресса)");
  }
  const seq = Math.max(0, Math.floor(Number(body.seq) || 0));
  const savedAt = Math.max(0, Math.floor(Number(body.savedAt) || Date.now()));
  const prev = stmtGetSave.get(user.id);
  if (prev && seq < (prev.seq || 0)) {
    const prevData = parseSavePayload(prev);
    return res.status(409).json({
      ok: false,
      error: "На сервере более новый сейв",
      conflict: true,
      seq: prev.seq,
      savedAt: prev.saved_at,
      data: prevData,
    });
  }
  try {
    if (typeof body.farmPower === "number") data.farmPower = body.farmPower;
    const { summary } = persistPlayerSave(
      user,
      seq,
      savedAt,
      body.clientVersion,
      data
    );
    res.json({ ok: true, seq, savedAt, summary });
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
  const rows = boardRows(mode === "default" ? "enchant" : mode, limit);
  res.json(rows);
});

app.get("/admin/enabled", (_req, res) => {
  res.json({ ok: true, enabled: !!ADMIN_KEY });
});

const admin = express.Router();
admin.use(requireAdmin);

admin.get("/overview", (_req, res) => {
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const sessions = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE exp >= ?").get(Date.now()).n;
  const scores = db.prepare("SELECT COUNT(*) AS n FROM scores").get().n;
  const saves = stmtCountSaves.get().n;
  res.json({ ok: true, users, sessions, scores, saves, db: path.basename(DB_PATH) });
});

admin.get("/users", (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = String(req.query.q || "").trim();
  const now = Date.now();
  let rows;
  if (q) {
    rows = db
      .prepare(
        `SELECT u.id, u.nick, u.created_at,
                s.max_plus, s.farm_power, s.earned, s.adena, s.mobs, s.updated_at, s.client_version,
                ps.chars_count, ps.active_name, ps.active_level, ps.farm_zone AS save_farm_zone,
                (SELECT COUNT(*) FROM sessions ses WHERE ses.user_id = u.id AND ses.exp >= ?) AS sessions
         FROM users u
         LEFT JOIN scores s ON s.user_id = u.id
         LEFT JOIN player_saves ps ON ps.user_id = u.id
         WHERE u.nick LIKE ? COLLATE NOCASE
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(now, "%" + q.replace(/[%_]/g, "") + "%", limit, offset);
  } else {
    rows = db
      .prepare(
        `SELECT u.id, u.nick, u.created_at,
                s.max_plus, s.farm_power, s.earned, s.adena, s.mobs, s.updated_at, s.client_version,
                ps.chars_count, ps.active_name, ps.active_level, ps.farm_zone AS save_farm_zone,
                (SELECT COUNT(*) FROM sessions ses WHERE ses.user_id = u.id AND ses.exp >= ?) AS sessions
         FROM users u
         LEFT JOIN scores s ON s.user_id = u.id
         LEFT JOIN player_saves ps ON ps.user_id = u.id
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(now, limit, offset);
  }
  res.json({ ok: true, rows });
});

admin.put("/users/:id/score", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  if (!stmtUserById.get(userId)) return jsonError(res, 404, "Пользователь не найден");
  const body = req.body || {};
  const now = Date.now();
  const row = {
    user_id: userId,
    max_plus: Math.max(0, Math.floor(Number(body.max_plus) || 0)),
    farm_power: Math.max(0, Math.floor(Number(body.farm_power) || 0)),
    earned: Math.max(0, Math.floor(Number(body.earned) || 0)),
    adena: Math.max(0, Math.floor(Number(body.adena) || 0)),
    mobs: Math.max(0, Math.floor(Number(body.mobs) || 0)),
    client_version: String(body.client_version || "admin").slice(0, 32),
    updated_at: now,
  };
  stmtUpsertScore.run(row);
  res.json({ ok: true, score: row });
});

admin.post("/users/:id/password", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  const user = stmtUserById.get(userId);
  if (!user) return jsonError(res, 404, "Пользователь не найден");
  const password = String(req.body?.password || "");
  if (!PASS_RE.test(password)) {
    return jsonError(res, 400, "Пароль: 6–72 символа, только латиница и цифры");
  }
  const passHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").run(passHash, userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  res.json({ ok: true, nick: user.nick });
});

admin.delete("/users/:id", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) return jsonError(res, 400, "Некорректный id");
  const user = stmtUserById.get(userId);
  if (!user) return jsonError(res, 404, "Пользователь не найден");
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  res.json({ ok: true, nick: user.nick });
});

admin.post("/maintenance/purge-sessions", (_req, res) => {
  const info = stmtDeleteExpired.run(Date.now());
  res.json({ ok: true, removed: info.changes });
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
  console.log(`DB: ${DB_PATH}`);
  if (ADMIN_KEY) console.log("Admin console: /db-admin/ (header X-Soulforge-Admin)");
  else console.log("Admin API: disabled (set SOULFORGE_ADMIN_KEY to enable)");
  if (SERVE_GAME && fs.existsSync(GAME_DIR)) {
    console.log(`Static game: ${GAME_DIR}`);
  }
});
