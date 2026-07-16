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
const NICK_RE = /^[a-zA-Z0-9_]{3,16}$/;

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
    return jsonError(res, 400, "Ник: 3–16 символов (a-z, 0-9, _)");
  }
  if (password.length < 6 || password.length > 72) {
    return jsonError(res, 400, "Пароль: 6–72 символа");
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

if (SERVE_GAME && fs.existsSync(GAME_DIR)) {
  app.use(express.static(GAME_DIR, { fallthrough: true, index: "index.html" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/auth") || req.path.startsWith("/runs") || req.path.startsWith("/leaderboard")) {
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
  if (SERVE_GAME && fs.existsSync(GAME_DIR)) {
    console.log(`Static game: ${GAME_DIR}`);
  }
});
