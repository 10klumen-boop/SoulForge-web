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
    client_version TEXT,
    updated_at INTEGER NOT NULL,
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
  INSERT INTO scores (user_id, max_plus, farm_power, earned, adena, client_version, updated_at)
  VALUES (@user_id, @max_plus, @farm_power, @earned, @adena, @client_version, @updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    max_plus = excluded.max_plus,
    farm_power = excluded.farm_power,
    earned = excluded.earned,
    adena = excluded.adena,
    client_version = excluded.client_version,
    updated_at = excluded.updated_at
`);

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
  } else {
    mode = "enchant";
  }
  const rows = db
    .prepare(
      `SELECT u.nick AS name, ${valueExpr} AS value, s.max_plus, s.farm_power, s.earned, s.adena, s.updated_at
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
    updatedAt: r.updated_at,
    mode,
  }));
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "256kb" }));

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
  const now = Date.now();
  const prev = db.prepare("SELECT * FROM scores WHERE user_id = ?").get(user.id);
  const next = {
    user_id: user.id,
    max_plus: Math.max(prev?.max_plus || 0, maxPlus),
    farm_power: Math.max(prev?.farm_power || 0, farmPower),
    earned: Math.max(prev?.earned || 0, earned),
    adena,
    client_version: String(body.clientVersion || "").slice(0, 32),
    updated_at: now,
  };
  stmtUpsertScore.run(next);
  res.json({ ok: true });
});

app.get("/leaderboard/:mode", (req, res) => {
  const mode = String(req.params.mode || "enchant").toLowerCase();
  const limit = Number(req.query.limit) || 50;
  if (!["enchant", "power", "wealth", "default"].includes(mode)) {
    return jsonError(res, 400, "mode: enchant | power | wealth");
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
  res.json({ ok: true, users, sessions, scores, db: path.basename(DB_PATH) });
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
                s.max_plus, s.farm_power, s.earned, s.adena, s.updated_at, s.client_version,
                (SELECT COUNT(*) FROM sessions ses WHERE ses.user_id = u.id AND ses.exp >= ?) AS sessions
         FROM users u
         LEFT JOIN scores s ON s.user_id = u.id
         WHERE u.nick LIKE ? COLLATE NOCASE
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(now, "%" + q.replace(/[%_]/g, "") + "%", limit, offset);
  } else {
    rows = db
      .prepare(
        `SELECT u.id, u.nick, u.created_at,
                s.max_plus, s.farm_power, s.earned, s.adena, s.updated_at, s.client_version,
                (SELECT COUNT(*) FROM sessions ses WHERE ses.user_id = u.id AND ses.exp >= ?) AS sessions
         FROM users u
         LEFT JOIN scores s ON s.user_id = u.id
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

if (SERVE_GAME && fs.existsSync(GAME_DIR)) {
  app.use(express.static(GAME_DIR, { fallthrough: true, index: "index.html" }));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/auth") ||
      req.path.startsWith("/runs") ||
      req.path.startsWith("/leaderboard") ||
      req.path.startsWith("/admin")
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
  if (ADMIN_KEY) console.log("Admin API: enabled (/admin/*, header X-Soulforge-Admin)");
  else console.log("Admin API: disabled (set SOULFORGE_ADMIN_KEY to enable)");
  if (SERVE_GAME && fs.existsSync(GAME_DIR)) {
    console.log(`Static game: ${GAME_DIR}`);
  }
});
