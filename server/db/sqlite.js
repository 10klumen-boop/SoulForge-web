"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const {
  summarizeSaveData,
  characterRowsFromData,
  scoreRowsFromData,
} = require("./save-utils");
const {
  detectBalanceAlerts,
  farmRowMetrics,
  rowsToCsv,
} = require("./balance-analytics");

function ensureScoreColumn(db, name, ddl) {
  const cols = db.prepare("PRAGMA table_info(scores)").all();
  if (!cols.length) return;
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE scores ADD COLUMN ${name} ${ddl}`);
  }
}

/** Account-bound scores → one row per character (character_id = slot id). */
function migrateScoresToCharacters(db) {
  const cols = db.prepare("PRAGMA table_info(scores)").all();
  if (!cols.length) return;
  if (cols.some((c) => c.name === "character_id")) {
    ensureScoreColumn(db, "char_name", "TEXT");
    return;
  }
  ensureScoreColumn(db, "mobs", "INTEGER NOT NULL DEFAULT 0");
  db.exec(`
    CREATE TABLE scores_char (
      user_id INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      char_name TEXT,
      max_plus INTEGER NOT NULL DEFAULT 0,
      farm_power INTEGER NOT NULL DEFAULT 0,
      earned INTEGER NOT NULL DEFAULT 0,
      adena INTEGER NOT NULL DEFAULT 0,
      mobs INTEGER NOT NULL DEFAULT 0,
      client_version TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, character_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  const oldScores = db.prepare("SELECT * FROM scores").all();
  const insert = db.prepare(`
    INSERT INTO scores_char (
      user_id, character_id, char_name, max_plus, farm_power, earned, adena, mobs, client_version, updated_at
    ) VALUES (
      @user_id, @character_id, @char_name, @max_plus, @farm_power, @earned, @adena, @mobs, @client_version, @updated_at
    )
  `);
  const getSave = db.prepare("SELECT active_name FROM player_saves WHERE user_id = ?");
  const getChars = db.prepare(
    "SELECT slot_id, name FROM player_characters WHERE user_id = ? ORDER BY created DESC, slot_id ASC"
  );
  const tx = db.transaction(() => {
    for (const s of oldScores) {
      const save = getSave.get(s.user_id);
      const chars = getChars.all(s.user_id);
      let characterId = "legacy";
      let charName = save?.active_name || null;
      if (chars.length === 1) {
        characterId = chars[0].slot_id;
        charName = chars[0].name || charName;
      } else if (chars.length > 1) {
        const byName = save?.active_name
          ? chars.find((c) => c.name === save.active_name)
          : null;
        const pick = byName || chars[0];
        characterId = pick.slot_id;
        charName = pick.name || charName;
      }
      insert.run({
        user_id: s.user_id,
        character_id: String(characterId).slice(0, 64),
        char_name: charName ? String(charName).slice(0, 48) : null,
        max_plus: s.max_plus || 0,
        farm_power: s.farm_power || 0,
        earned: s.earned || 0,
        adena: s.adena || 0,
        mobs: s.mobs || 0,
        client_version: s.client_version || null,
        updated_at: s.updated_at || Date.now(),
      });
    }
    db.exec("DROP TABLE scores");
    db.exec("ALTER TABLE scores_char RENAME TO scores");
  });
  tx();
}

function initSchema(db) {
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
      user_id INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      char_name TEXT,
      max_plus INTEGER NOT NULL DEFAULT 0,
      farm_power INTEGER NOT NULL DEFAULT 0,
      earned INTEGER NOT NULL DEFAULT 0,
      adena INTEGER NOT NULL DEFAULT 0,
      mobs INTEGER NOT NULL DEFAULT 0,
      client_version TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, character_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  migrateScoresToCharacters(db);
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
    CREATE TABLE IF NOT EXISTS write_leases (
      user_id INTEGER PRIMARY KEY,
      device_id TEXT NOT NULL,
      claimed_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS character_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      char_name TEXT,
      event TEXT NOT NULL,
      payload TEXT,
      adena INTEGER,
      client_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_character_events_user_char
      ON character_events(user_id, character_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_character_events_created
      ON character_events(created_at DESC);
    CREATE TABLE IF NOT EXISTS character_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      char_name TEXT,
      progress TEXT NOT NULL,
      seq INTEGER NOT NULL DEFAULT 0,
      client_version TEXT,
      adena INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      saved_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_character_backups_user_char
      ON character_backups(user_id, character_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS balance_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      character_id TEXT,
      char_name TEXT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warn',
      message TEXT NOT NULL,
      event_type TEXT,
      event_id INTEGER,
      payload TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_balance_alerts_created
      ON balance_alerts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_balance_alerts_severity
      ON balance_alerts(severity, created_at DESC);
  `);
  db.pragma("foreign_keys = ON");
}

const CHARACTER_EVENT_TYPES = new Set([
  "login",
  "logout",
  "char_create",
  "char_delete",
  "char_switch",
  "enchant_ok",
  "enchant_fail",
  "enchant_break",
  "sell_weapon",
  "crystallize",
  "sell_crystals",
  "loot_weapon",
  "loot_rare",
  "farm_session",
  "quest_step",
  "quest_boss",
  "zone_change",
  "adena",
  "snapshot",
  "restore",
  "admin",
  "balance_alert",
]);

const BACKUP_KEEP_PER_CHAR = Math.max(
  5,
  Math.min(200, Number(process.env.SOULFORGE_BACKUP_KEEP || 40))
);

function createSqliteStore(opts) {
  opts = opts || {};
  const dataDir = opts.dataDir;
  const dbPath = opts.dbPath;
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(dbPath);
  initSchema(db);

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
  const stmtDeleteUserSessions = db.prepare("DELETE FROM sessions WHERE user_id = ?");
  const stmtGetScore = db.prepare(
    "SELECT * FROM scores WHERE user_id = ? AND character_id = ?"
  );
  const stmtUpsertScore = db.prepare(`
    INSERT INTO scores (
      user_id, character_id, char_name, max_plus, farm_power, earned, adena, mobs, client_version, updated_at
    ) VALUES (
      @user_id, @character_id, @char_name, @max_plus, @farm_power, @earned, @adena, @mobs, @client_version, @updated_at
    )
    ON CONFLICT(user_id, character_id) DO UPDATE SET
      char_name = COALESCE(excluded.char_name, scores.char_name),
      max_plus = excluded.max_plus,
      farm_power = excluded.farm_power,
      earned = excluded.earned,
      adena = excluded.adena,
      mobs = excluded.mobs,
      client_version = excluded.client_version,
      updated_at = excluded.updated_at
  `);
  const stmtDeleteScoresForUser = db.prepare("DELETE FROM scores WHERE user_id = ?");
  const stmtDeleteOrphanScores = db.prepare(`
    DELETE FROM scores
    WHERE user_id = ?
      AND character_id NOT IN (
        SELECT slot_id FROM player_characters WHERE user_id = ? AND created = 1
      )
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
  const stmtUpdatePassword = db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?");
  const stmtDeleteUser = db.prepare("DELETE FROM users WHERE id = ?");
  const stmtGetLease = db.prepare("SELECT * FROM write_leases WHERE user_id = ?");
  const stmtUpsertLease = db.prepare(`
    INSERT INTO write_leases (user_id, device_id, claimed_at, expires_at)
    VALUES (@user_id, @device_id, @claimed_at, @expires_at)
    ON CONFLICT(user_id) DO UPDATE SET
      device_id = excluded.device_id,
      claimed_at = excluded.claimed_at,
      expires_at = excluded.expires_at
  `);
  const stmtDeleteLease = db.prepare("DELETE FROM write_leases WHERE user_id = ?");
  const stmtDeleteLeaseIfDevice = db.prepare(
    "DELETE FROM write_leases WHERE user_id = ? AND device_id = ?"
  );
  const stmtInsertEvent = db.prepare(`
    INSERT INTO character_events (
      user_id, character_id, char_name, event, payload, adena, client_at, created_at
    ) VALUES (
      @user_id, @character_id, @char_name, @event, @payload, @adena, @client_at, @created_at
    )
  `);
  const stmtInsertBalanceAlert = db.prepare(`
    INSERT INTO balance_alerts (
      user_id, character_id, char_name, alert_type, severity, message,
      event_type, event_id, payload, created_at
    ) VALUES (
      @user_id, @character_id, @char_name, @alert_type, @severity, @message,
      @event_type, @event_id, @payload, @created_at
    )
  `);
  const stmtRecentAlertDup = db.prepare(`
    SELECT id FROM balance_alerts
    WHERE user_id = ? AND character_id = ? AND alert_type = ? AND message = ?
      AND created_at >= ?
    LIMIT 1
  `);
  const stmtInsertBackup = db.prepare(`
    INSERT INTO character_backups (
      user_id, character_id, char_name, progress, seq, client_version, adena, level, saved_at, created_at
    ) VALUES (
      @user_id, @character_id, @char_name, @progress, @seq, @client_version, @adena, @level, @saved_at, @created_at
    )
  `);
  const stmtListBackupIds = db.prepare(`
    SELECT id FROM character_backups
    WHERE user_id = ? AND character_id = ?
    ORDER BY created_at DESC
  `);
  const stmtDeleteBackupById = db.prepare("DELETE FROM character_backups WHERE id = ?");
  const stmtGetBackup = db.prepare("SELECT * FROM character_backups WHERE id = ? AND user_id = ?");
  const stmtListBackups = db.prepare(`
    SELECT id, user_id, character_id, char_name, seq, client_version, adena, level, saved_at, created_at,
           length(progress) AS progress_bytes
    FROM character_backups
    WHERE user_id = ? AND (? IS NULL OR character_id = ?)
    ORDER BY created_at DESC
    LIMIT ?
  `);
  const stmtListEvents = db.prepare(`
    SELECT id, user_id, character_id, char_name, event, payload, adena, client_at, created_at
    FROM character_events
    WHERE user_id = ? AND (? IS NULL OR character_id = ?)
    ORDER BY created_at DESC
    LIMIT ?
  `);

  function pruneCharacterBackups(userId, characterId) {
    const ids = stmtListBackupIds.all(userId, characterId).map((r) => r.id);
    if (ids.length <= BACKUP_KEEP_PER_CHAR) return 0;
    const drop = ids.slice(BACKUP_KEEP_PER_CHAR);
    for (const id of drop) stmtDeleteBackupById.run(id);
    return drop.length;
  }

  function insertBackupRows(user, seq, clientVersion, data, now) {
    const chars = Array.isArray(data?.characters) ? data.characters : [];
    let n = 0;
    if (chars.length) {
      for (const slot of chars) {
        if (!slot?.id || !slot.progress) continue;
        const av = slot.progress.avatar || {};
        stmtInsertBackup.run({
          user_id: user.id,
          character_id: String(slot.id).slice(0, 64),
          char_name: av.name ? String(av.name).slice(0, 48) : null,
          progress: JSON.stringify(slot.progress),
          seq: Math.max(0, Math.floor(Number(seq) || 0)),
          client_version: String(clientVersion || "").slice(0, 32),
          adena: Math.max(0, Math.floor(Number(slot.progress.adena) || 0)),
          level: Math.max(1, Math.floor(Number(av.level) || 1)),
          saved_at: now,
          created_at: now,
        });
        pruneCharacterBackups(user.id, String(slot.id).slice(0, 64));
        n++;
      }
    } else if (data?.avatar?.created) {
      const progress = {
        avatar: data.avatar,
        adena: data.adena,
        farmZone: data.farmZone,
        storyProgress: data.storyProgress,
        questProgress: data.questProgress,
        records: data.records,
        totals: data.totals,
        inventory: data.inventory,
        crystals: data.crystals,
        equipped: data.equipped,
        materials: data.materials,
        shots: data.shots,
        autoShots: data.autoShots,
        achievements: data.achievements,
        collectibles: data.collectibles,
        storySeen: data.storySeen,
      };
      stmtInsertBackup.run({
        user_id: user.id,
        character_id: "legacy",
        char_name: data.avatar.name ? String(data.avatar.name).slice(0, 48) : null,
        progress: JSON.stringify(progress),
        seq: Math.max(0, Math.floor(Number(seq) || 0)),
        client_version: String(clientVersion || "").slice(0, 32),
        adena: Math.max(0, Math.floor(Number(data.adena) || 0)),
        level: Math.max(1, Math.floor(Number(data.avatar.level) || 1)),
        saved_at: now,
        created_at: now,
      });
      pruneCharacterBackups(user.id, "legacy");
      n++;
    }
    return n;
  }

  const ADMIN_USER_SELECT = `
    SELECT u.id, u.nick, u.created_at,
           s.max_plus, s.farm_power, s.earned, s.adena, s.mobs, s.updated_at, s.client_version,
           ps.chars_count, ps.active_name, ps.active_level, ps.farm_zone AS save_farm_zone,
           (SELECT COUNT(*) FROM sessions ses WHERE ses.user_id = u.id AND ses.exp >= ?) AS sessions
    FROM users u
    LEFT JOIN (
      SELECT user_id,
             MAX(max_plus) AS max_plus,
             MAX(farm_power) AS farm_power,
             MAX(earned) AS earned,
             MAX(adena) AS adena,
             MAX(mobs) AS mobs,
             MAX(updated_at) AS updated_at,
             MAX(client_version) AS client_version
      FROM scores
      GROUP BY user_id
    ) s ON s.user_id = u.id
    LEFT JOIN player_saves ps ON ps.user_id = u.id
  `;

  const store = {
    driver: "sqlite",
    dbPath,

    info() {
      return { driver: "sqlite", label: path.basename(dbPath), path: dbPath };
    },

    getUserByNick(nick) {
      return stmtUserByNick.get(nick) || null;
    },

    getUserById(id) {
      return stmtUserById.get(id) || null;
    },

    insertUser(nick, passHash, createdAt) {
      const info = stmtInsertUser.run(nick, passHash, createdAt);
      return { id: info.lastInsertRowid };
    },

    insertSession(token, userId, exp) {
      stmtInsertSession.run(token, userId, exp);
    },

    deleteExpiredSessions(now) {
      return stmtDeleteExpired.run(now);
    },

    getSession(token) {
      return stmtSession.get(token) || null;
    },

    deleteSession(token) {
      stmtDeleteSession.run(token);
    },

    getScore(userId, characterId) {
      const cid = String(characterId || "legacy").slice(0, 64);
      return stmtGetScore.get(userId, cid) || null;
    },

    upsertScore(row) {
      const payload = {
        user_id: row.user_id,
        character_id: String(row.character_id || "legacy").slice(0, 64),
        char_name: row.char_name ? String(row.char_name).slice(0, 48) : null,
        max_plus: row.max_plus || 0,
        farm_power: row.farm_power || 0,
        earned: row.earned || 0,
        adena: row.adena || 0,
        mobs: row.mobs || 0,
        client_version: row.client_version || null,
        updated_at: row.updated_at || Date.now(),
      };
      stmtUpsertScore.run(payload);
    },

    getSave(userId) {
      return stmtGetSave.get(userId) || null;
    },

    getWriteLease(userId) {
      return stmtGetLease.get(userId) || null;
    },

    /**
     * Claim or renew write lease for one device.
     * @returns {{ ok: true, lease } | { ok: false, conflict: true, lease }}
     */
    claimWriteLease(userId, deviceId, now, ttlMs, takeover) {
      const device = String(deviceId || "").slice(0, 96);
      if (!device) return { ok: false, error: "need_device" };
      const expiresAt = now + Math.max(15_000, ttlMs || 90_000);
      const cur = stmtGetLease.get(userId);
      if (cur && cur.expires_at > now && cur.device_id !== device && !takeover) {
        return { ok: false, conflict: true, lease: cur };
      }
      const lease = {
        user_id: userId,
        device_id: device,
        claimed_at: now,
        expires_at: expiresAt,
      };
      stmtUpsertLease.run(lease);
      return { ok: true, lease, tookOver: !!(cur && cur.device_id !== device) };
    },

    renewWriteLease(userId, deviceId, now, ttlMs) {
      const device = String(deviceId || "").slice(0, 96);
      const cur = stmtGetLease.get(userId);
      if (!cur || cur.device_id !== device) {
        return { ok: false, conflict: true, lease: cur || null };
      }
      if (cur.expires_at < now) {
        return { ok: false, expired: true, lease: cur };
      }
      const lease = {
        user_id: userId,
        device_id: device,
        claimed_at: cur.claimed_at,
        expires_at: now + Math.max(15_000, ttlMs || 90_000),
      };
      stmtUpsertLease.run(lease);
      return { ok: true, lease };
    },

    releaseWriteLease(userId, deviceId) {
      if (deviceId) stmtDeleteLeaseIfDevice.run(userId, String(deviceId).slice(0, 96));
      else stmtDeleteLease.run(userId);
    },

    /**
     * Active lease must match writerId (or be expired → free).
     */
    assertWriteLease(userId, deviceId, now) {
      const device = String(deviceId || "").slice(0, 96);
      if (!device) return { ok: false, error: "need_device" };
      const cur = stmtGetLease.get(userId);
      if (!cur || cur.expires_at <= now) {
        return { ok: false, missing: true, lease: cur || null };
      }
      if (cur.device_id !== device) {
        return { ok: false, conflict: true, lease: cur };
      }
      return { ok: true, lease: cur };
    },

    persistPlayerSave(user, seq, savedAt, clientVersion, data) {
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
      const scoreRows = scoreRowsFromData(user.id, user.nick, data);
      const tx = db.transaction(() => {
        stmtUpsertSave.run(saveRow);
        stmtDeleteChars.run(user.id);
        for (const row of characterRowsFromData(user.id, user.nick, data)) {
          stmtInsertChar.run(row);
        }
        if (!scoreRows.length) {
          stmtDeleteScoresForUser.run(user.id);
        } else {
          for (const sr of scoreRows) {
            const prev = stmtGetScore.get(user.id, sr.character_id);
            const farmPower =
              sr.farm_power > 0
                ? Math.max(prev?.farm_power || 0, sr.farm_power)
                : Math.max(prev?.farm_power || 0, 0);
            stmtUpsertScore.run({
              user_id: user.id,
              character_id: sr.character_id,
              char_name: sr.char_name,
              max_plus: Math.max(prev?.max_plus || 0, sr.max_plus),
              farm_power: farmPower,
              earned: Math.max(prev?.earned || 0, sr.earned),
              adena: sr.adena,
              mobs: Math.max(prev?.mobs || 0, sr.mobs),
              client_version: saveRow.client_version,
              updated_at: now,
            });
          }
          stmtDeleteOrphanScores.run(user.id, user.id);
        }
        insertBackupRows(user, saveRow.seq, saveRow.client_version, data, now);
      });
      tx();
      return { saveRow, summary };
    },

    insertCharacterEvents(userId, events) {
      const now = Date.now();
      const inserted = [];
      const tx = db.transaction(() => {
        for (const raw of events) {
          const event = String(raw.event || raw.type || "").slice(0, 32);
          if (!CHARACTER_EVENT_TYPES.has(event)) continue;
          const characterId = String(raw.characterId || raw.character_id || "legacy").slice(0, 64);
          let payload = raw.payload;
          if (payload != null && typeof payload !== "string") {
            try {
              payload = JSON.stringify(payload);
            } catch (_) {
              payload = null;
            }
          }
          if (payload && payload.length > 12_000) payload = payload.slice(0, 12_000);
          const row = {
            user_id: userId,
            character_id: characterId,
            char_name: (() => {
              const n = raw.charName || raw.char_name;
              return n ? String(n).slice(0, 48) : null;
            })(),
            event,
            payload: payload || null,
            adena:
              raw.adena != null && Number.isFinite(Number(raw.adena))
                ? Math.max(0, Math.floor(Number(raw.adena)))
                : null,
            client_at: Math.max(0, Math.floor(Number(raw.at || raw.client_at) || 0)) || null,
            created_at: now,
          };
          const info = stmtInsertEvent.run(row);
          inserted.push({ id: info.lastInsertRowid, event, characterId });
          const alerts = detectBalanceAlerts(event, row.payload);
          for (const a of alerts) {
            const alertType = String(a.type).slice(0, 48);
            const message = String(a.message).slice(0, 400);
            const dup = stmtRecentAlertDup.get(
              userId,
              characterId,
              alertType,
              message,
              now - 8000
            );
            if (dup) continue;
            stmtInsertBalanceAlert.run({
              user_id: userId,
              character_id: characterId,
              char_name: row.char_name,
              alert_type: alertType,
              severity: String(a.severity || "warn").slice(0, 16),
              message,
              event_type: event,
              event_id: info.lastInsertRowid,
              payload: row.payload,
              created_at: now,
            });
          }
        }
      });
      tx();
      return inserted;
    },

    listCharacterEvents(userId, characterId, limit) {
      limit = Math.min(500, Math.max(1, limit || 100));
      const cid = characterId ? String(characterId).slice(0, 64) : null;
      return stmtListEvents.all(userId, cid, cid, limit).map((r) => ({
        id: r.id,
        characterId: r.character_id,
        charName: r.char_name,
        event: r.event,
        payload: (() => {
          if (!r.payload) return null;
          try {
            return JSON.parse(r.payload);
          } catch (_) {
            return r.payload;
          }
        })(),
        adena: r.adena,
        clientAt: r.client_at,
        createdAt: r.created_at,
      }));
    },

    listCharacterBackups(userId, characterId, limit) {
      limit = Math.min(200, Math.max(1, limit || 40));
      const cid = characterId ? String(characterId).slice(0, 64) : null;
      return stmtListBackups.all(userId, cid, cid, limit).map((r) => ({
        id: r.id,
        characterId: r.character_id,
        charName: r.char_name,
        seq: r.seq,
        clientVersion: r.client_version,
        adena: r.adena,
        level: r.level,
        savedAt: r.saved_at,
        createdAt: r.created_at,
        progressBytes: r.progress_bytes,
      }));
    },

    getCharacterBackup(userId, backupId) {
      const row = stmtGetBackup.get(backupId, userId);
      if (!row) return null;
      let progress = null;
      try {
        progress = JSON.parse(row.progress);
      } catch (_) {
        return null;
      }
      return {
        id: row.id,
        characterId: row.character_id,
        charName: row.char_name,
        seq: row.seq,
        clientVersion: row.client_version,
        adena: row.adena,
        level: row.level,
        savedAt: row.saved_at,
        createdAt: row.created_at,
        progress,
      };
    },

    /**
     * Replace character progress in the account save from a backup snapshot.
     * Bumps seq so clients pull the restored state.
     */
    restoreCharacterBackup(user, backupId) {
      const bak = stmtGetBackup.get(backupId, user.id);
      if (!bak) return { ok: false, error: "not_found" };
      let progress;
      try {
        progress = JSON.parse(bak.progress);
      } catch (_) {
        return { ok: false, error: "bad_backup" };
      }
      const save = stmtGetSave.get(user.id);
      if (!save) return { ok: false, error: "no_save" };
      let data;
      try {
        data = JSON.parse(save.payload);
      } catch (_) {
        return { ok: false, error: "bad_save" };
      }
      if (!Array.isArray(data.characters)) data.characters = [];
      const characterId = bak.character_id;
      let slot = data.characters.find((c) => c && c.id === characterId);
      if (!slot) {
        slot = { id: characterId, progress };
        data.characters.push(slot);
      } else {
        slot.progress = progress;
      }
      data.activeCharacterId = characterId;
      // Mirror active progress to root so older clients stay consistent
      const keys = [
        "avatar",
        "adena",
        "farmZone",
        "storyProgress",
        "questProgress",
        "records",
        "totals",
        "inventory",
        "crystals",
        "equipped",
        "materials",
        "shots",
        "autoShots",
        "achievements",
        "collectibles",
        "storySeen",
      ];
      for (const k of keys) {
        if (progress[k] !== undefined) data[k] = progress[k];
      }
      const nextSeq = Math.max(0, Math.floor(Number(save.seq) || 0)) + 1;
      const now = Date.now();
      const { summary } = this.persistPlayerSave(
        user,
        nextSeq,
        now,
        save.client_version || "restore",
        data
      );
      stmtInsertEvent.run({
        user_id: user.id,
        character_id: characterId,
        char_name: bak.char_name,
        event: "restore",
        payload: JSON.stringify({ backupId, fromSavedAt: bak.saved_at }),
        adena: Math.max(0, Math.floor(Number(progress.adena) || 0)),
        client_at: null,
        created_at: now,
      });
      return { ok: true, seq: nextSeq, summary, characterId, backupId };
    },

    getLeaderboard(mode, limit) {
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
          `SELECT u.nick AS nick,
                  s.character_id AS character_id,
                  s.char_name AS char_name,
                  ${valueExpr} AS value,
                  s.max_plus, s.farm_power, s.earned, s.adena, s.mobs, s.updated_at
           FROM scores s JOIN users u ON u.id = s.user_id
           ORDER BY ${order}
           LIMIT ?`
        )
        .all(limit);
      return rows.map((r, i) => {
        const charName = r.char_name || null;
        const nick = r.nick;
        return {
          rank: i + 1,
          name: charName || nick,
          charName,
          nick,
          characterId: r.character_id,
          value: r.value,
          maxPlus: r.max_plus,
          farmPower: r.farm_power,
          earned: r.earned,
          adena: r.adena,
          mobs: r.mobs || 0,
          updatedAt: r.updated_at,
          mode,
        };
      });
    },

    getOverviewCounts(now) {
      return {
        users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
        sessions: db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE exp >= ?").get(now).n,
        scores: db.prepare("SELECT COUNT(*) AS n FROM scores").get().n,
        saves: stmtCountSaves.get().n,
        events: db.prepare("SELECT COUNT(*) AS n FROM character_events").get().n,
        backups: db.prepare("SELECT COUNT(*) AS n FROM character_backups").get().n,
        alerts: db.prepare("SELECT COUNT(*) AS n FROM balance_alerts").get().n,
      };
    },

    listAdminUsers({ q, limit, offset, now }) {
      if (q) {
        return db
          .prepare(
            `${ADMIN_USER_SELECT}
             WHERE u.nick LIKE ? COLLATE NOCASE
             ORDER BY u.id DESC
             LIMIT ? OFFSET ?`
          )
          .all(now, "%" + q.replace(/[%_]/g, "") + "%", limit, offset);
      }
      return db
        .prepare(
          `${ADMIN_USER_SELECT}
           ORDER BY u.id DESC
           LIMIT ? OFFSET ?`
        )
        .all(now, limit, offset);
    },

    listUserCharacters(userId) {
      return db
        .prepare(
          `SELECT pc.slot_id AS characterId, pc.name AS charName, pc.race_id AS raceId,
                  pc.class_id AS classId, pc.gender_id AS genderId, pc.level, pc.adena,
                  pc.farm_zone AS farmZone, pc.created,
                  s.max_plus AS maxPlus, s.farm_power AS farmPower, s.earned, s.mobs, s.updated_at AS scoreUpdatedAt
           FROM player_characters pc
           LEFT JOIN scores s ON s.user_id = pc.user_id AND s.character_id = pc.slot_id
           WHERE pc.user_id = ?
           ORDER BY pc.created DESC, pc.slot_id ASC`
        )
        .all(userId);
    },

    listUserScores(userId) {
      return db
        .prepare(
          `SELECT s.character_id AS characterId, s.char_name AS charName,
                  s.max_plus AS maxPlus, s.farm_power AS farmPower, s.earned, s.adena, s.mobs,
                  s.client_version AS clientVersion, s.updated_at AS updatedAt
           FROM scores s WHERE s.user_id = ?
           ORDER BY s.updated_at DESC`
        )
        .all(userId);
    },

    getAdminUserDetail(userId) {
      const user = stmtUserById.get(userId);
      if (!user) return null;
      const save = stmtGetSave.get(userId);
      const lease = stmtGetLease.get(userId);
      return {
        user: { id: user.id, nick: user.nick, createdAt: user.created_at },
        save: save
          ? {
              seq: save.seq,
              savedAt: save.saved_at,
              clientVersion: save.client_version,
              charsCount: save.chars_count,
              activeName: save.active_name,
              activeLevel: save.active_level,
              adena: save.adena,
              mobs: save.mobs,
              maxPlus: save.max_plus,
              farmZone: save.farm_zone,
              updatedAt: save.updated_at,
            }
          : null,
        lease: lease
          ? {
              writerId: lease.device_id,
              claimedAt: lease.claimed_at,
              expiresAt: lease.expires_at,
            }
          : null,
        characters: this.listUserCharacters(userId),
        scores: this.listUserScores(userId),
        events: this.listCharacterEvents(userId, null, 80),
        backups: this.listCharacterBackups(userId, null, 40),
      };
    },

    adminListEvents({ nick, characterId, event, since, until, limit, offset }) {
      limit = Math.min(500, Math.max(1, limit || 100));
      offset = Math.max(0, offset || 0);
      const where = [];
      const params = [];
      if (nick) {
        where.push("u.nick LIKE ? COLLATE NOCASE");
        params.push("%" + String(nick).replace(/[%_]/g, "") + "%");
      }
      if (characterId) {
        where.push("e.character_id = ?");
        params.push(String(characterId).slice(0, 64));
      }
      if (event) {
        where.push("e.event = ?");
        params.push(String(event).slice(0, 32));
      }
      if (since) {
        where.push("e.created_at >= ?");
        params.push(Math.floor(Number(since)));
      }
      if (until) {
        where.push("e.created_at <= ?");
        params.push(Math.floor(Number(until)));
      }
      const sqlWhere = where.length ? "WHERE " + where.join(" AND ") : "";
      const countRow = db
        .prepare(
          `SELECT COUNT(*) AS n FROM character_events e JOIN users u ON u.id = e.user_id ${sqlWhere}`
        )
        .get(...params);
      const rows = db
        .prepare(
          `SELECT e.id, e.user_id, u.nick, e.character_id, e.char_name, e.event, e.payload,
                  e.adena, e.client_at, e.created_at
           FROM character_events e
           JOIN users u ON u.id = e.user_id
           ${sqlWhere}
           ORDER BY e.created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);
      return {
        total: countRow?.n || 0,
        rows: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          nick: r.nick,
          characterId: r.character_id,
          charName: r.char_name,
          event: r.event,
          payload: (() => {
            if (!r.payload) return null;
            try {
              return JSON.parse(r.payload);
            } catch (_) {
              return r.payload;
            }
          })(),
          adena: r.adena,
          clientAt: r.client_at,
          createdAt: r.created_at,
        })),
      };
    },

    adminListBackups({ nick, characterId, since, until, limit, offset }) {
      limit = Math.min(200, Math.max(1, limit || 50));
      offset = Math.max(0, offset || 0);
      const where = [];
      const params = [];
      if (nick) {
        where.push("u.nick LIKE ? COLLATE NOCASE");
        params.push("%" + String(nick).replace(/[%_]/g, "") + "%");
      }
      if (characterId) {
        where.push("b.character_id = ?");
        params.push(String(characterId).slice(0, 64));
      }
      if (since) {
        where.push("b.created_at >= ?");
        params.push(Math.floor(Number(since)));
      }
      if (until) {
        where.push("b.created_at <= ?");
        params.push(Math.floor(Number(until)));
      }
      const sqlWhere = where.length ? "WHERE " + where.join(" AND ") : "";
      const countRow = db
        .prepare(
          `SELECT COUNT(*) AS n FROM character_backups b JOIN users u ON u.id = b.user_id ${sqlWhere}`
        )
        .get(...params);
      const rows = db
        .prepare(
          `SELECT b.id, b.user_id, u.nick, b.character_id, b.char_name, b.seq, b.client_version,
                  b.adena, b.level, b.saved_at, b.created_at, length(b.progress) AS progress_bytes
           FROM character_backups b
           JOIN users u ON u.id = b.user_id
           ${sqlWhere}
           ORDER BY b.created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);
      return {
        total: countRow?.n || 0,
        rows: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          nick: r.nick,
          characterId: r.character_id,
          charName: r.char_name,
          seq: r.seq,
          clientVersion: r.client_version,
          adena: r.adena,
          level: r.level,
          savedAt: r.saved_at,
          createdAt: r.created_at,
          progressBytes: r.progress_bytes,
        })),
      };
    },

    adminListScores({ nick, limit, offset, sort }) {
      limit = Math.min(200, Math.max(1, limit || 100));
      offset = Math.max(0, offset || 0);
      let order = "s.max_plus DESC, s.updated_at ASC";
      if (sort === "power") order = "s.farm_power DESC, s.updated_at ASC";
      else if (sort === "wealth") order = "s.earned DESC, s.updated_at ASC";
      else if (sort === "mobs") order = "s.mobs DESC, s.updated_at ASC";
      else if (sort === "adena") order = "s.adena DESC, s.updated_at ASC";
      else if (sort === "updated") order = "s.updated_at DESC";
      const where = [];
      const params = [];
      if (nick) {
        where.push("u.nick LIKE ? COLLATE NOCASE");
        params.push("%" + String(nick).replace(/[%_]/g, "") + "%");
      }
      const sqlWhere = where.length ? "WHERE " + where.join(" AND ") : "";
      const countRow = db
        .prepare(`SELECT COUNT(*) AS n FROM scores s JOIN users u ON u.id = s.user_id ${sqlWhere}`)
        .get(...params);
      const rows = db
        .prepare(
          `SELECT u.id AS user_id, u.nick, s.character_id, s.char_name,
                  s.max_plus, s.farm_power, s.earned, s.adena, s.mobs, s.client_version, s.updated_at
           FROM scores s JOIN users u ON u.id = s.user_id
           ${sqlWhere}
           ORDER BY ${order}
           LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);
      return {
        total: countRow?.n || 0,
        rows: rows.map((r) => ({
          userId: r.user_id,
          nick: r.nick,
          characterId: r.character_id,
          charName: r.char_name,
          maxPlus: r.max_plus,
          farmPower: r.farm_power,
          earned: r.earned,
          adena: r.adena,
          mobs: r.mobs || 0,
          clientVersion: r.client_version,
          updatedAt: r.updated_at,
        })),
      };
    },

    listEventTypes() {
      return db
        .prepare(
          `SELECT event, COUNT(*) AS n FROM character_events GROUP BY event ORDER BY n DESC`
        )
        .all();
    },

    getBalanceDashboard({ since, until }) {
      const now = Date.now();
      since = since != null ? Math.floor(Number(since)) : now - 7 * 86400000;
      until = until != null ? Math.floor(Number(until)) : now;
      const params = [since, until];

      const farmRaw = db
        .prepare(
          `SELECT
             COALESCE(json_extract(payload, '$.zoneId'), '—') AS zoneId,
             COUNT(*) AS sessions,
             SUM(COALESCE(CAST(json_extract(payload, '$.kills') AS INTEGER), 0)) AS kills,
             SUM(COALESCE(CAST(json_extract(payload, '$.weapons') AS INTEGER), 0)) AS weapons,
             SUM(COALESCE(CAST(json_extract(payload, '$.adenaGain') AS INTEGER), 0)) AS adenaGain,
             SUM(COALESCE(CAST(json_extract(payload, '$.durationMs') AS INTEGER), 0)) AS durationMs
           FROM character_events
           WHERE event = 'farm_session' AND created_at >= ? AND created_at <= ?
           GROUP BY zoneId
           ORDER BY adenaGain DESC`
        )
        .all(...params);

      const enchantRows = db
        .prepare(
          `SELECT event, COUNT(*) AS n
           FROM character_events
           WHERE event IN ('enchant_ok', 'enchant_fail', 'enchant_break')
             AND created_at >= ? AND created_at <= ?
           GROUP BY event`
        )
        .all(...params);
      const enchantMap = Object.fromEntries(enchantRows.map((r) => [r.event, r.n]));
      const enchantOk = enchantMap.enchant_ok || 0;
      const enchantFail = enchantMap.enchant_fail || 0;
      const enchantBreak = enchantMap.enchant_break || 0;
      const enchantTotal = enchantOk + enchantFail + enchantBreak;

      const enchantPlus = db
        .prepare(
          `SELECT CAST(json_extract(payload, '$.plus') AS INTEGER) AS plus, COUNT(*) AS n
           FROM character_events
           WHERE event = 'enchant_ok' AND created_at >= ? AND created_at <= ?
             AND json_extract(payload, '$.plus') IS NOT NULL
           GROUP BY plus
           ORDER BY plus ASC`
        )
        .all(...params);

      const quests = db
        .prepare(
          `SELECT
             COALESCE(json_extract(payload, '$.zoneId'), '—') AS zoneId,
             COALESCE(CAST(json_extract(payload, '$.step') AS INTEGER), 0) AS step,
             COUNT(*) AS n
           FROM character_events
           WHERE event = 'quest_step' AND created_at >= ? AND created_at <= ?
           GROUP BY zoneId, step
           ORDER BY zoneId, step`
        )
        .all(...params);

      const economy = db
        .prepare(
          `SELECT event, COUNT(*) AS n,
             SUM(COALESCE(CAST(json_extract(payload, '$.adenaGain') AS INTEGER), 0)) AS adenaGain
           FROM character_events
           WHERE event IN ('sell_weapon', 'crystallize', 'sell_crystals', 'farm_session')
             AND created_at >= ? AND created_at <= ?
           GROUP BY event`
        )
        .all(...params);

      const lootGrades = db
        .prepare(
          `SELECT
             COALESCE(json_extract(payload, '$.source'), '—') AS source,
             COALESCE(json_extract(payload, '$.grade'), '—') AS grade,
             COUNT(*) AS n
           FROM character_events
           WHERE event = 'loot_weapon' AND created_at >= ? AND created_at <= ?
           GROUP BY source, grade
           ORDER BY n DESC`
        )
        .all(...params);

      const alertCounts = db
        .prepare(
          `SELECT severity, COUNT(*) AS n FROM balance_alerts
           WHERE created_at >= ? AND created_at <= ?
           GROUP BY severity`
        )
        .all(...params);

      return {
        since,
        until,
        farm: farmRaw.map(farmRowMetrics),
        enchant: {
          ok: enchantOk,
          fail: enchantFail,
          break: enchantBreak,
          failRate: enchantTotal > 0 ? Math.round(((enchantFail + enchantBreak) / enchantTotal) * 1000) / 10 : 0,
          byPlus: enchantPlus.map((r) => ({ plus: r.plus, n: r.n })),
        },
        quests: quests.map((r) => ({ zoneId: r.zoneId, step: r.step, n: r.n })),
        economy: economy.map((r) => ({ event: r.event, n: r.n, adenaGain: r.adenaGain || 0 })),
        lootGrades: lootGrades.map((r) => ({ source: r.source, grade: r.grade, n: r.n })),
        alerts: {
          bySeverity: Object.fromEntries(alertCounts.map((r) => [r.severity, r.n])),
          total: alertCounts.reduce((s, r) => s + r.n, 0),
        },
      };
    },

    exportBalanceCsv({ kind, since, until }) {
      const dash = this.getBalanceDashboard({ since, until });
      if (kind === "farm") {
        return rowsToCsv(
          ["zoneId", "sessions", "kills", "weapons", "adenaGain", "durationMs", "adenaPerHour", "killsPerSession"],
          dash.farm
        );
      }
      if (kind === "enchant") {
        const rows = [
          { metric: "ok", value: dash.enchant.ok },
          { metric: "fail", value: dash.enchant.fail },
          { metric: "break", value: dash.enchant.break },
          { metric: "failRate_pct", value: dash.enchant.failRate },
        ];
        return rowsToCsv(["metric", "value"], rows);
      }
      if (kind === "enchant_plus") {
        return rowsToCsv(["plus", "n"], dash.enchant.byPlus);
      }
      if (kind === "quests") {
        return rowsToCsv(["zoneId", "step", "n"], dash.quests);
      }
      if (kind === "economy") {
        return rowsToCsv(["event", "n", "adenaGain"], dash.economy);
      }
      if (kind === "loot") {
        return rowsToCsv(["source", "grade", "n"], dash.lootGrades);
      }
      return rowsToCsv(["zoneId", "sessions", "kills", "adenaGain", "adenaPerHour"], dash.farm);
    },

    adminListAlerts({ severity, since, until, limit, offset }) {
      limit = Math.min(200, Math.max(1, limit || 50));
      offset = Math.max(0, offset || 0);
      const where = [];
      const params = [];
      if (severity) {
        where.push("a.severity = ?");
        params.push(String(severity).slice(0, 16));
      }
      if (since) {
        where.push("a.created_at >= ?");
        params.push(Math.floor(Number(since)));
      }
      if (until) {
        where.push("a.created_at <= ?");
        params.push(Math.floor(Number(until)));
      }
      const sqlWhere = where.length ? "WHERE " + where.join(" AND ") : "";
      const countRow = db
        .prepare(
          `SELECT COUNT(*) AS n FROM balance_alerts a JOIN users u ON u.id = a.user_id ${sqlWhere}`
        )
        .get(...params);
      const rows = db
        .prepare(
          `SELECT a.id, a.user_id, u.nick, a.character_id, a.char_name, a.alert_type,
                  a.severity, a.message, a.event_type, a.event_id, a.created_at
           FROM balance_alerts a
           JOIN users u ON u.id = a.user_id
           ${sqlWhere}
           ORDER BY a.created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);
      return {
        total: countRow?.n || 0,
        rows: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          nick: r.nick,
          characterId: r.character_id,
          charName: r.char_name,
          alertType: r.alert_type,
          severity: r.severity,
          message: r.message,
          eventType: r.event_type,
          eventId: r.event_id,
          createdAt: r.created_at,
        })),
      };
    },

    updateUserPassword(userId, passHash) {
      stmtUpdatePassword.run(passHash, userId);
      stmtDeleteUserSessions.run(userId);
    },

    deleteUser(userId) {
      stmtDeleteUser.run(userId);
    },
  };

  return store;
}

module.exports = { createSqliteStore, CHARACTER_EVENT_TYPES, BACKUP_KEEP_PER_CHAR };
