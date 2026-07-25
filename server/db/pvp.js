"use strict";

const {
  sanitizeSheet,
  sheetPower,
  runSimulateDuel,
  createMatchRuntime,
  applyRound,
  aiAction,
  publicMatchView,
} = require("../lib/pvp-engine");

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const ACTION_TIMEOUT_MS = 90 * 1000;
const ASYNC_COOLDOWN_MS = 60 * 1000;

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {object} store
 */
function attachPvpMethods(db, store) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS combat_sheets (
      user_id INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      char_name TEXT,
      sheet_json TEXT NOT NULL,
      sheet_version INTEGER NOT NULL DEFAULT 1,
      power_score INTEGER NOT NULL DEFAULT 0,
      published_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, character_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_combat_sheets_name
      ON combat_sheets(char_name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS duel_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger_user_id INTEGER NOT NULL,
      challenger_character_id TEXT NOT NULL,
      challenger_name TEXT,
      target_user_id INTEGER NOT NULL,
      target_character_id TEXT NOT NULL,
      target_name TEXT,
      challenger_sheet_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      responded_at INTEGER,
      match_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_duel_challenges_target
      ON duel_challenges(target_user_id, target_character_id, status);

    CREATE TABLE IF NOT EXISTS duel_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER,
      a_user_id INTEGER NOT NULL,
      a_character_id TEXT NOT NULL,
      a_name TEXT,
      b_user_id INTEGER NOT NULL,
      b_character_id TEXT NOT NULL,
      b_name TEXT,
      a_sheet_json TEXT NOT NULL,
      b_sheet_json TEXT NOT NULL,
      state_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      seed INTEGER NOT NULL,
      winner TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS pvp_async_attacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_user_id INTEGER NOT NULL,
      attacker_character_id TEXT NOT NULL,
      attacker_name TEXT,
      defender_user_id INTEGER NOT NULL,
      defender_character_id TEXT NOT NULL,
      defender_name TEXT,
      attacker_sheet_json TEXT NOT NULL,
      defender_sheet_json TEXT NOT NULL,
      seed INTEGER NOT NULL,
      result_json TEXT NOT NULL,
      winner TEXT,
      created_at INTEGER NOT NULL,
      seen_by_defender INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pvp_async_defender
      ON pvp_async_attacks(defender_user_id, defender_character_id, created_at DESC);
  `);

  try {
    const cols = db.prepare("PRAGMA table_info(duel_matches)").all();
    if (cols.length && !cols.some((c) => c.name === "rating_applied")) {
      db.exec("ALTER TABLE duel_matches ADD COLUMN rating_applied INTEGER NOT NULL DEFAULT 0");
    }
  } catch (_) {}

  const stmtUpsertSheet = db.prepare(`
    INSERT INTO combat_sheets (
      user_id, character_id, char_name, sheet_json, sheet_version, power_score, published_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(user_id, character_id) DO UPDATE SET
      char_name = excluded.char_name,
      sheet_json = excluded.sheet_json,
      power_score = excluded.power_score,
      published_at = excluded.published_at,
      sheet_version = combat_sheets.sheet_version + 1
  `);
  const stmtSheetByKey = db.prepare(
    "SELECT * FROM combat_sheets WHERE user_id = ? AND character_id = ?"
  );
  const stmtSheetByName = db.prepare(`
    SELECT cs.*, pc.nick
    FROM combat_sheets cs
    JOIN player_characters pc
      ON pc.user_id = cs.user_id AND pc.slot_id = cs.character_id
    WHERE cs.char_name = ? COLLATE NOCASE
    LIMIT 2
  `);

  const stmtInsertChallenge = db.prepare(`
    INSERT INTO duel_challenges (
      challenger_user_id, challenger_character_id, challenger_name,
      target_user_id, target_character_id, target_name,
      challenger_sheet_json, status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
  const stmtChallengeById = db.prepare("SELECT * FROM duel_challenges WHERE id = ?");
  const stmtChallengeCas = db.prepare(`
    UPDATE duel_challenges
    SET status = ?, responded_at = ?, match_id = ?
    WHERE id = ? AND status = 'pending'
  `);
  const stmtExpireChallenges = db.prepare(`
    UPDATE duel_challenges SET status = 'expired'
    WHERE status = 'pending' AND expires_at <= ?
  `);
  const stmtInboxChallenges = db.prepare(`
    SELECT * FROM duel_challenges
    WHERE target_user_id = ? AND target_character_id = ? AND status = 'pending' AND expires_at > ?
    ORDER BY created_at DESC LIMIT 50
  `);
  const stmtOutboxChallenges = db.prepare(`
    SELECT * FROM duel_challenges
    WHERE challenger_user_id = ? AND challenger_character_id = ?
      AND status IN ('pending', 'accepted', 'declined', 'expired')
    ORDER BY created_at DESC LIMIT 50
  `);
  const stmtPendingBetween = db.prepare(`
    SELECT id FROM duel_challenges
    WHERE status = 'pending' AND expires_at > ?
      AND (
        (challenger_user_id = ? AND challenger_character_id = ? AND target_user_id = ? AND target_character_id = ?)
        OR
        (challenger_user_id = ? AND challenger_character_id = ? AND target_user_id = ? AND target_character_id = ?)
      )
    LIMIT 1
  `);

  const stmtInsertMatch = db.prepare(`
    INSERT INTO duel_matches (
      challenge_id, a_user_id, a_character_id, a_name,
      b_user_id, b_character_id, b_name,
      a_sheet_json, b_sheet_json, state_json, status, seed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `);
  const stmtMatchById = db.prepare("SELECT * FROM duel_matches WHERE id = ?");
  const stmtUpdateMatch = db.prepare(`
    UPDATE duel_matches
    SET state_json = ?, status = ?, winner = ?, updated_at = ?, finished_at = ?
    WHERE id = ?
  `);
  const stmtMarkMatchRated = db.prepare(`
    UPDATE duel_matches SET rating_applied = 1
    WHERE id = ? AND COALESCE(rating_applied, 0) = 0
  `);
  const stmtActiveMatchForChar = db.prepare(`
    SELECT * FROM duel_matches
    WHERE status = 'active'
      AND (
        (a_user_id = ? AND a_character_id = ?)
        OR (b_user_id = ? AND b_character_id = ?)
      )
    ORDER BY id DESC LIMIT 1
  `);

  const stmtInsertAsync = db.prepare(`
    INSERT INTO pvp_async_attacks (
      attacker_user_id, attacker_character_id, attacker_name,
      defender_user_id, defender_character_id, defender_name,
      attacker_sheet_json, defender_sheet_json, seed, result_json, winner, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stmtLastAsyncAttack = db.prepare(`
    SELECT created_at FROM pvp_async_attacks
    WHERE attacker_user_id = ? AND attacker_character_id = ?
    ORDER BY created_at DESC LIMIT 1
  `);
  const stmtAsyncInbox = db.prepare(`
    SELECT id, attacker_name, defender_name, winner, created_at, seen_by_defender, result_json
    FROM pvp_async_attacks
    WHERE defender_user_id = ? AND defender_character_id = ?
    ORDER BY created_at DESC LIMIT 30
  `);
  const stmtAsyncOutbox = db.prepare(`
    SELECT id, attacker_name, defender_name, winner, created_at, result_json
    FROM pvp_async_attacks
    WHERE attacker_user_id = ? AND attacker_character_id = ?
    ORDER BY created_at DESC LIMIT 30
  `);
  const stmtMarkAsyncSeen = db.prepare(`
    UPDATE pvp_async_attacks SET seen_by_defender = 1
    WHERE defender_user_id = ? AND defender_character_id = ? AND seen_by_defender = 0
  `);

  function charId(body) {
    return String(body?.characterId || "").trim().slice(0, 64);
  }

  function requireChar(body) {
    const id = charId(body);
    if (!id) return { ok: false, error: "Нужен characterId" };
    return { ok: true, characterId: id };
  }

  function resolveTarget(toName) {
    if (typeof store.mailResolveName === "function") {
      return store.mailResolveName(toName);
    }
    return { ok: false, error: "Резолв имён недоступен" };
  }

  function expirePending(now) {
    stmtExpireChallenges.run(now);
  }

  function applyMatchRating(row, now) {
    if (!row || row.status !== "finished" || !row.winner) return null;
    if (row.rating_applied) return null;
    if (typeof store.applyPvpOutcome !== "function") return null;
    const marked = stmtMarkMatchRated.run(row.id);
    if (!marked.changes) return null;
    return store.applyPvpOutcome(
      {
        winner: row.winner,
        a: {
          userId: row.a_user_id,
          characterId: row.a_character_id,
          charName: row.a_name,
        },
        b: {
          userId: row.b_user_id,
          characterId: row.b_character_id,
          charName: row.b_name,
        },
      },
      now
    );
  }

  function ratingForViewer(ratingResult, side) {
    if (!ratingResult || !side) return null;
    const mine = ratingResult[side];
    if (!mine) return null;
    return {
      rating: mine.rating,
      delta: mine.delta,
      wins: mine.wins,
      losses: mine.losses,
    };
  }

  function serializeRuntime(runtime) {
    return JSON.stringify({
      seed: runtime.seed,
      _rngCounter: runtime._rngCounter || 0,
      round: runtime.round,
      fighterA: runtime.fighterA,
      fighterB: runtime.fighterB,
      pendingA: runtime.pendingA,
      pendingB: runtime.pendingB,
      pendingAtA: runtime.pendingAtA || 0,
      pendingAtB: runtime.pendingAtB || 0,
      waitStartedAt: runtime.waitStartedAt || 0,
      log: runtime.log,
      winner: runtime.winner,
    });
  }

  function loadRuntime(raw) {
    const st = parseJson(raw, null);
    if (!st || !st.fighterA || !st.fighterB) return null;
    return st;
  }

  function matchSide(row, user, characterId) {
    if (row.a_user_id === user.id && row.a_character_id === characterId) return "a";
    if (row.b_user_id === user.id && row.b_character_id === characterId) return "b";
    return null;
  }

  function viewMatch(row, user, characterId, ratingExtra) {
    const sheetA = sanitizeSheet(parseJson(row.a_sheet_json, null));
    const sheetB = sanitizeSheet(parseJson(row.b_sheet_json, null));
    const runtime = loadRuntime(row.state_json);
    if (!sheetA || !sheetB || !runtime) return { ok: false, error: "Матч повреждён" };
    const side = matchSide(row, user, characterId);
    if (!side) return { ok: false, error: "Это не ваш матч" };
    const view = publicMatchView(runtime, sheetA, sheetB, {
      matchId: row.id,
      status: row.status,
      winner: row.winner || runtime.winner,
      yourSide: side,
      aName: row.a_name,
      bName: row.b_name,
    });
    view.yourPending = side === "a" ? !!runtime.pendingA : !!runtime.pendingB;
    view.oppPending = side === "a" ? !!runtime.pendingB : !!runtime.pendingA;
    view.skills = side === "a" ? sheetA.skills : sheetB.skills;
    if (ratingExtra) view.rating = ratingExtra;
    return { ok: true, match: view, status: row.status, rating: ratingExtra || null };
  }

  store.pvpPublishSheet = function pvpPublishSheet(user, body, now) {
    const c = requireChar(body);
    if (!c.ok) return c;
    const sheet = sanitizeSheet(body.sheet);
    if (!sheet) return { ok: false, error: "Некорректный combat sheet" };
    if (!sheet.name || sheet.name.length < 2) {
      return { ok: false, error: "В листе нет имени персонажа" };
    }
    stmtUpsertSheet.run(
      user.id,
      c.characterId,
      sheet.name,
      JSON.stringify(sheet),
      sheetPower(sheet),
      now
    );
    return { ok: true, power: sheetPower(sheet), name: sheet.name };
  };

  store.pvpLookupSheet = function pvpLookupSheet(toName) {
    const name = String(toName || "").trim().slice(0, 48);
    if (name.length < 2) return { ok: false, error: "Укажи имя персонажа" };
    const rows = stmtSheetByName.all(name);
    if (!rows.length) {
      return {
        ok: false,
        error: "У «" + name + "» нет опубликованного листа. Пусть откроет Арену.",
      };
    }
    if (rows.length > 1) {
      return { ok: false, error: "Несколько листов с этим именем" };
    }
    const row = rows[0];
    const sheet = sanitizeSheet(parseJson(row.sheet_json, null));
    if (!sheet) return { ok: false, error: "Лист повреждён" };
    return {
      ok: true,
      preview: {
        name: sheet.name,
        level: sheet.level,
        atkType: sheet.atkType,
        patk: sheet.patk,
        matk: sheet.matk,
        pdef: sheet.pdef,
        mdef: sheet.mdef,
        hpMax: sheet.hpMax,
        power: row.power_score,
        publishedAt: row.published_at,
      },
      userId: row.user_id,
      characterId: row.character_id,
      sheet,
    };
  };

  store.pvpChallenge = function pvpChallenge(user, body, now) {
    expirePending(now);
    const c = requireChar(body);
    if (!c.ok) return c;
    const sheet = sanitizeSheet(body.sheet);
    if (!sheet) return { ok: false, error: "Сначала опубликуй лист (открой Арену)" };
    const target = resolveTarget(body.toName);
    if (!target.ok) return target;
    if (target.userId === user.id && target.characterId === c.characterId) {
      return { ok: false, error: "Нельзя вызвать самого себя" };
    }
    const dup = stmtPendingBetween.get(
      now,
      user.id,
      c.characterId,
      target.userId,
      target.characterId,
      target.userId,
      target.characterId,
      user.id,
      c.characterId
    );
    if (dup) return { ok: false, error: "Вызов уже ожидает ответа" };

    // автопубликация атакующего
    stmtUpsertSheet.run(
      user.id,
      c.characterId,
      sheet.name,
      JSON.stringify(sheet),
      sheetPower(sheet),
      now
    );

    const info = stmtInsertChallenge.run(
      user.id,
      c.characterId,
      sheet.name,
      target.userId,
      target.characterId,
      target.name,
      JSON.stringify(sheet),
      now,
      now + CHALLENGE_TTL_MS
    );
    return {
      ok: true,
      challenge: {
        id: info.lastInsertRowid,
        toName: target.name,
        expiresAt: now + CHALLENGE_TTL_MS,
        status: "pending",
      },
    };
  };

  store.pvpChallengeInbox = function pvpChallengeInbox(user, body, now) {
    expirePending(now);
    const c = requireChar(body);
    if (!c.ok) return c;
    const rows = stmtInboxChallenges.all(user.id, c.characterId, now);
    return {
      ok: true,
      rows: rows.map((r) => ({
        id: r.id,
        fromName: r.challenger_name,
        toName: r.target_name,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        status: r.status,
      })),
    };
  };

  store.pvpChallengeOutbox = function pvpChallengeOutbox(user, body, now) {
    expirePending(now);
    const c = requireChar(body);
    if (!c.ok) return c;
    const rows = stmtOutboxChallenges.all(user.id, c.characterId);
    return {
      ok: true,
      rows: rows.map((r) => ({
        id: r.id,
        fromName: r.challenger_name,
        toName: r.target_name,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        status: r.status,
        matchId: r.match_id,
      })),
    };
  };

  store.pvpRespondChallenge = function pvpRespondChallenge(user, challengeId, body, now) {
    expirePending(now);
    const c = requireChar(body);
    if (!c.ok) return c;
    const row = stmtChallengeById.get(Number(challengeId));
    if (!row) return { ok: false, error: "Вызов не найден" };
    if (row.status !== "pending") return { ok: false, error: "Вызов уже закрыт" };
    if (row.expires_at <= now) {
      stmtChallengeCas.run("expired", now, null, row.id);
      return { ok: false, error: "Вызов истёк" };
    }
    if (row.target_user_id !== user.id || row.target_character_id !== c.characterId) {
      return { ok: false, error: "Это не ваш вызов" };
    }
    const accept = !!body.accept;
    if (!accept) {
      stmtChallengeCas.run("declined", now, null, row.id);
      return { ok: true, status: "declined" };
    }
    const sheetB = sanitizeSheet(body.sheet);
    if (!sheetB) return { ok: false, error: "Нужен ваш combat sheet" };
    const sheetA = sanitizeSheet(parseJson(row.challenger_sheet_json, null));
    if (!sheetA) return { ok: false, error: "Лист вызывающего повреждён" };

    stmtUpsertSheet.run(
      user.id,
      c.characterId,
      sheetB.name,
      JSON.stringify(sheetB),
      sheetPower(sheetB),
      now
    );

    const seed = (now % 100000) + 1;
    const runtime = createMatchRuntime(sheetA, sheetB, seed);
    runtime.waitStartedAt = now;
    const matchInfo = stmtInsertMatch.run(
      row.id,
      row.challenger_user_id,
      row.challenger_character_id,
      row.challenger_name,
      user.id,
      c.characterId,
      sheetB.name,
      JSON.stringify(sheetA),
      JSON.stringify(sheetB),
      serializeRuntime(runtime),
      seed,
      now,
      now
    );
    const matchId = matchInfo.lastInsertRowid;
    stmtChallengeCas.run("accepted", now, matchId, row.id);
    return {
      ok: true,
      status: "accepted",
      matchId,
      match: viewMatch(stmtMatchById.get(matchId), user, c.characterId).match,
    };
  };

  store.pvpActiveMatch = function pvpActiveMatch(user, body, now) {
    const c = requireChar(body);
    if (!c.ok) return c;
    const row = stmtActiveMatchForChar.get(user.id, c.characterId, user.id, c.characterId);
    if (!row) return { ok: true, match: null };
    // авто-ход AI при таймауте ожидания
    maybeResolveTimeout(row, now);
    const fresh = stmtMatchById.get(row.id);
    let rating = null;
    if (fresh?.status === "finished") {
      const rr = applyMatchRating(fresh, now);
      rating = ratingForViewer(rr, matchSide(fresh, user, c.characterId));
    }
    return viewMatch(fresh, user, c.characterId, rating);
  };

  store.pvpGetMatch = function pvpGetMatch(user, matchId, body, now) {
    const c = requireChar(body);
    if (!c.ok) return c;
    const row = stmtMatchById.get(Number(matchId));
    if (!row) return { ok: false, error: "Матч не найден" };
    maybeResolveTimeout(row, now);
    const fresh = stmtMatchById.get(row.id);
    let rating = null;
    if (fresh?.status === "finished") {
      const rr = applyMatchRating(fresh, now);
      rating = ratingForViewer(rr, matchSide(fresh, user, c.characterId));
    }
    return viewMatch(fresh, user, c.characterId, rating);
  };

  function maybeResolveTimeout(row, now) {
    if (!row || row.status !== "active") return;
    const runtime = loadRuntime(row.state_json);
    if (!runtime || runtime.winner) return;
    const wait = runtime.waitStartedAt || row.updated_at || now;
    if (now - wait < ACTION_TIMEOUT_MS) return;
    let changed = false;
    if (!runtime.pendingA) {
      runtime.pendingA = aiAction(runtime, "a");
      changed = true;
    }
    if (!runtime.pendingB) {
      runtime.pendingB = aiAction(runtime, "b");
      changed = true;
    }
    if (!changed) return;
    if (runtime.pendingA && runtime.pendingB) {
      applyRound(runtime, runtime.pendingA, runtime.pendingB);
      runtime.waitStartedAt = now;
    }
    const finished = !!runtime.winner;
    stmtUpdateMatch.run(
      serializeRuntime(runtime),
      finished ? "finished" : "active",
      runtime.winner || null,
      now,
      finished ? now : null,
      row.id
    );
    if (finished) {
      const freshRated = stmtMatchById.get(row.id);
      applyMatchRating(freshRated, now);
    }
  }

  store.pvpMatchAction = function pvpMatchAction(user, matchId, body, now) {
    const c = requireChar(body);
    if (!c.ok) return c;
    const row = stmtMatchById.get(Number(matchId));
    if (!row) return { ok: false, error: "Матч не найден" };
    if (row.status !== "active") return { ok: false, error: "Матч уже завершён" };
    maybeResolveTimeout(row, now);
    const fresh = stmtMatchById.get(row.id);
    const side = matchSide(fresh, user, c.characterId);
    if (!side) return { ok: false, error: "Это не ваш матч" };
    const runtime = loadRuntime(fresh.state_json);
    if (!runtime) return { ok: false, error: "Состояние матча повреждено" };
    if (runtime.winner) return { ok: false, error: "Матч уже завершён" };

    const action = normalizeAction(body.action, side === "a"
      ? sanitizeSheet(parseJson(fresh.a_sheet_json, null))
      : sanitizeSheet(parseJson(fresh.b_sheet_json, null)));
    if (!action.ok) return action;

    if (side === "a") {
      if (runtime.pendingA) return { ok: false, error: "Ход уже выбран — ждите соперника" };
      runtime.pendingA = action.action;
      runtime.pendingAtA = now;
    } else {
      if (runtime.pendingB) return { ok: false, error: "Ход уже выбран — ждите соперника" };
      runtime.pendingB = action.action;
      runtime.pendingAtB = now;
    }
    if (!runtime.waitStartedAt) runtime.waitStartedAt = now;

    if (runtime.pendingA && runtime.pendingB) {
      applyRound(runtime, runtime.pendingA, runtime.pendingB);
      runtime.waitStartedAt = now;
    }

    const finished = !!runtime.winner;
    stmtUpdateMatch.run(
      serializeRuntime(runtime),
      finished ? "finished" : "active",
      runtime.winner || null,
      now,
      finished ? now : null,
      fresh.id
    );
    const updated = stmtMatchById.get(fresh.id);
    let rating = null;
    if (finished) {
      const ratingResult = applyMatchRating(updated, now);
      const sideNow = matchSide(updated, user, c.characterId);
      rating = ratingForViewer(ratingResult, sideNow);
    }
    return viewMatch(updated, user, c.characterId, rating);
  };

  function normalizeAction(raw, sheet) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Нужно действие" };
    const type = String(raw.type || "");
    if (type === "attack" || type === "guard") return { ok: true, action: { type } };
    if (type === "skill") {
      const id = String(raw.skillId || "");
      const skills = (sheet && sheet.skills) || [];
      if (!skills.some((s) => s.id === id)) return { ok: false, error: "Неизвестный скилл" };
      return { ok: true, action: { type: "skill", skillId: id } };
    }
    return { ok: false, error: "Неизвестное действие" };
  }

  store.pvpAsyncAttack = function pvpAsyncAttack(user, body, now) {
    const c = requireChar(body);
    if (!c.ok) return c;
    const attackerSheet = sanitizeSheet(body.sheet);
    if (!attackerSheet) return { ok: false, error: "Нужен ваш combat sheet" };

    const last = stmtLastAsyncAttack.get(user.id, c.characterId);
    if (last && now - last.created_at < ASYNC_COOLDOWN_MS) {
      const left = Math.ceil((ASYNC_COOLDOWN_MS - (now - last.created_at)) / 1000);
      return { ok: false, error: "Подождите " + left + " с перед следующей атакой" };
    }

    const looked = store.pvpLookupSheet(body.toName);
    if (!looked.ok) return looked;
    if (looked.userId === user.id && looked.characterId === c.characterId) {
      return { ok: false, error: "Нельзя атаковать свою тень" };
    }

    stmtUpsertSheet.run(
      user.id,
      c.characterId,
      attackerSheet.name,
      JSON.stringify(attackerSheet),
      sheetPower(attackerSheet),
      now
    );

    const seed = (now % 100000) + 17;
    const sim = runSimulateDuel(attackerSheet, looked.sheet, seed);
    const result = {
      winner: sim.winner,
      rounds: sim.rounds,
      hpA: sim.hpA,
      hpB: sim.hpB,
      log: (sim.log || []).slice(0, 30),
    };
    const info = stmtInsertAsync.run(
      user.id,
      c.characterId,
      attackerSheet.name,
      looked.userId,
      looked.characterId,
      looked.sheet.name,
      JSON.stringify(attackerSheet),
      JSON.stringify(looked.sheet),
      seed,
      JSON.stringify(result),
      sim.winner,
      now
    );
    let rating = null;
    if (typeof store.applyPvpOutcome === "function" && sim.winner) {
      const ratingResult = store.applyPvpOutcome(
        {
          winner: sim.winner,
          a: {
            userId: user.id,
            characterId: c.characterId,
            charName: attackerSheet.name,
          },
          b: {
            userId: looked.userId,
            characterId: looked.characterId,
            charName: looked.sheet.name,
          },
        },
        now
      );
      rating = ratingForViewer(ratingResult, "a");
    }
    return {
      ok: true,
      attackId: info.lastInsertRowid,
      winner: sim.winner,
      result,
      defender: looked.preview,
      rating,
    };
  };

  store.pvpAsyncInbox = function pvpAsyncInbox(user, body) {
    const c = requireChar(body);
    if (!c.ok) return c;
    const rows = stmtAsyncInbox.all(user.id, c.characterId);
    stmtMarkAsyncSeen.run(user.id, c.characterId);
    return {
      ok: true,
      rows: rows.map((r) => ({
        id: r.id,
        attackerName: r.attacker_name,
        defenderName: r.defender_name,
        winner: r.winner,
        createdAt: r.created_at,
        seen: !!r.seen_by_defender,
        result: parseJson(r.result_json, null),
      })),
    };
  };

  store.pvpAsyncOutbox = function pvpAsyncOutbox(user, body) {
    const c = requireChar(body);
    if (!c.ok) return c;
    const rows = stmtAsyncOutbox.all(user.id, c.characterId);
    return {
      ok: true,
      rows: rows.map((r) => ({
        id: r.id,
        attackerName: r.attacker_name,
        defenderName: r.defender_name,
        winner: r.winner,
        createdAt: r.created_at,
        result: parseJson(r.result_json, null),
      })),
    };
  };
}

module.exports = { attachPvpMethods };
