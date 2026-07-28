"use strict";

const { parseSavePayload, resolveActiveCharacterId } = require("./save-utils");

const MAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAIL_MAX_PENDING_PER_CHAR = 30;
const MAIL_INV_CAP = 120;
const MAIL_MAX_ADENA = 50_000_000_000;
const MAIL_GEAR_KINDS = new Set(["weapon", "armor", "accessory"]);
const MAIL_STACK_KINDS = new Set(["adena", "crystal", "material", "shot", "armor_piece", "jewelry_piece", "scroll"]);
const MAIL_KINDS = new Set([...MAIL_GEAR_KINDS, ...MAIL_STACK_KINDS]);
const GRADES = new Set(["D", "C", "B", "A"]);
const ORES = new Set(["soul", "spirit"]);
const SCROLL_TARGETS = new Set(["weapon", "armor"]);
const SCROLL_TYPE_IDS = new Set(["regular", "blessed", "destruction", "crystal"]);

function emptyScrollGradeMap() {
  return { D: 0, C: 0, B: 0, A: 0 };
}
function emptyScrollTypeMap() {
  return {
    regular: emptyScrollGradeMap(),
    blessed: emptyScrollGradeMap(),
    destruction: emptyScrollGradeMap(),
    crystal: emptyScrollGradeMap(),
  };
}
function ensureMailScrolls(progress) {
  if (!progress.scrolls || typeof progress.scrolls !== "object") {
    progress.scrolls = { weapon: emptyScrollTypeMap(), armor: emptyScrollTypeMap() };
  }
  ["weapon", "armor"].forEach((t) => {
    if (!progress.scrolls[t]) progress.scrolls[t] = emptyScrollTypeMap();
    SCROLL_TYPE_IDS.forEach((ty) => {
      if (!progress.scrolls[t][ty]) progress.scrolls[t][ty] = emptyScrollGradeMap();
    });
  });
  return progress.scrolls;
}

function isArmorPieceId(fragId) {
  const id = String(fragId || "");
  if (id.length < 8 || id.length > 80) return false;
  return /^[a-z0-9_]+_piece$/i.test(id);
}

function isJewelryPieceId(fragId) {
  const id = String(fragId || "");
  if (id.length < 6 || id.length > 80) return false;
  if (/^[a-z0-9_]+_shard$/i.test(id)) return true;
  return /^[a-z0-9_]+_piece$/i.test(id);
}

function ensureMailSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mail_parcels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_user_id INTEGER NOT NULL,
      sender_character_id TEXT NOT NULL,
      sender_name TEXT,
      recipient_user_id INTEGER NOT NULL,
      recipient_character_id TEXT NOT NULL,
      recipient_name TEXT,
      kind TEXT NOT NULL,
      item_json TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'escrow',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      claimed_at INTEGER,
      FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_mail_parcels_recipient
      ON mail_parcels(recipient_user_id, recipient_character_id, status);
    CREATE INDEX IF NOT EXISTS idx_mail_parcels_sender
      ON mail_parcels(sender_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_mail_parcels_expires
      ON mail_parcels(status, expires_at);
  `);
}

function cloneJson(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getCharacterSlot(data, characterId) {
  data = data && typeof data === "object" ? data : {};
  const chars = Array.isArray(data.characters) ? data.characters : [];
  const cid = String(characterId || "").slice(0, 64);
  if (!cid) return null;
  return chars.find((c) => c && String(c.id) === cid) || null;
}

function ensureProgress(slot) {
  if (!slot.progress || typeof slot.progress !== "object") slot.progress = {};
  const p = slot.progress;
  if (!Array.isArray(p.inventory)) p.inventory = [];
  if (!p.avatar || typeof p.avatar !== "object") p.avatar = {};
  if (!p.avatar.gear || typeof p.avatar.gear !== "object") p.avatar.gear = {};
  if (p.adena == null) p.adena = 0;
  if (!p.crystals || typeof p.crystals !== "object") p.crystals = { D: 0, C: 0, B: 0, A: 0 };
  if (!p.materials || typeof p.materials !== "object") p.materials = { soul: 0, spirit: 0 };
  if (!p.shots || typeof p.shots !== "object") {
    p.shots = { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } };
  }
  if (!p.shots.soul) p.shots.soul = { D: 0, C: 0, B: 0, A: 0 };
  if (!p.shots.spirit) p.shots.spirit = { D: 0, C: 0, B: 0, A: 0 };
  ensureMailScrolls(p);
  return p;
}

function syncActiveRoot(data) {
  const activeId = resolveActiveCharacterId(data);
  const slot = getCharacterSlot(data, activeId);
  if (!slot?.progress) return data;
  const p = slot.progress;
  const keys = [
    "avatar", "adena", "farmZone", "inventory", "crystals", "materials", "shots", "scrolls",
    "autoShots", "equipped", "records", "totals", "achievements", "questProgress",
    "storyProgress", "storySeen", "collectibles", "passiveIncome", "autoClicker",
  ];
  for (const k of keys) {
    if (p[k] !== undefined) data[k] = cloneJson(p[k]);
  }
  data.activeCharacterId = activeId;
  return data;
}

function parseItemJson(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}

function isUidEquipped(progress, uid) {
  const want = String(uid || "");
  const gear = progress.avatar?.gear || {};
  for (const k of Object.keys(gear)) {
    const g = gear[k];
    if (g && String(g.uid) === want) return true;
  }
  return false;
}

function detectGearKind(it) {
  if (!it || typeof it !== "object") return null;
  if (it.kind === "armor") return "armor";
  if (it.kind === "accessory") return "accessory";
  if (it.kind === "weapon") return "weapon";
  if (!it.kind) return "weapon";
  return null;
}

function sanitizeGearItem(it) {
  if (!it || typeof it !== "object") return null;
  const kind = detectGearKind(it);
  if (!kind || !MAIL_GEAR_KINDS.has(kind)) return null;
  const id = String(it.id || "").slice(0, 64);
  const uid = String(it.uid || "").slice(0, 64);
  if (!id || !uid) return null;
  const out = { kind, uid, id };
  if (kind === "weapon" || kind === "armor") {
    out.plus = Math.max(0, Math.floor(Number(it.plus) || 0));
    out.spent = Math.max(0, Math.floor(Number(it.spent) || 0));
  }
  return out;
}

function takeGearFromProgress(progress, uid) {
  const want = String(uid || "");
  const inv = progress.inventory || [];
  const idx = inv.findIndex((it) => it && String(it.uid) === want);
  if (idx < 0) return { ok: false, error: "Предмет не найден в инвентаре" };
  const it = inv[idx];
  if (it.starter) return { ok: false, error: "Стартовое оружие нельзя отправлять" };
  if (isUidEquipped(progress, want)) {
    return { ok: false, error: "Сначала сними предмет" };
  }
  const snap = sanitizeGearItem(it);
  if (!snap) return { ok: false, error: "Нельзя отправить этот предмет" };
  inv.splice(idx, 1);
  progress.inventory = inv;
  return { ok: true, item: snap, qty: 1 };
}

function giveGearToProgress(progress, item) {
  const snap = sanitizeGearItem(item);
  if (!snap) return { ok: false, error: "Некорректный предмет" };
  if (!Array.isArray(progress.inventory)) progress.inventory = [];
  if (progress.inventory.length >= MAIL_INV_CAP) {
    return { ok: false, error: "Инвентарь полон (" + MAIL_INV_CAP + ")" };
  }
  const row = { uid: snap.uid, id: snap.id };
  if (snap.kind === "armor") {
    row.kind = "armor";
    row.plus = snap.plus || 0;
    row.spent = snap.spent || 0;
  } else if (snap.kind === "accessory") row.kind = "accessory";
  else {
    row.plus = snap.plus || 0;
    row.spent = snap.spent || 0;
  }
  progress.inventory.push(row);
  return { ok: true };
}

function takeAdena(progress, qty) {
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (n < 1) return { ok: false, error: "Укажи сумму адены" };
  if (n > MAIL_MAX_ADENA) return { ok: false, error: "Слишком много адены за раз" };
  const have = Math.max(0, Math.floor(Number(progress.adena) || 0));
  if (have < n) return { ok: false, error: "Не хватает адены" };
  progress.adena = have - n;
  return { ok: true, item: { kind: "adena" }, qty: n };
}

function giveAdena(progress, qty) {
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (n < 1) return { ok: false, error: "Некорректная адена" };
  progress.adena = Math.max(0, Math.floor(Number(progress.adena) || 0)) + n;
  return { ok: true };
}

function takeCrystal(progress, grade, qty) {
  const g = String(grade || "").toUpperCase();
  if (!GRADES.has(g)) return { ok: false, error: "Неверный грейд" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  const have = Math.max(0, Math.floor(Number(progress.crystals[g]) || 0));
  if (have < n) return { ok: false, error: "Не хватает кристаллов" };
  progress.crystals[g] = have - n;
  return { ok: true, item: { kind: "crystal", grade: g }, qty: n };
}

function giveCrystal(progress, grade, qty) {
  const g = String(grade || "").toUpperCase();
  if (!GRADES.has(g)) return { ok: false, error: "Неверный грейд" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  progress.crystals[g] = Math.max(0, Math.floor(Number(progress.crystals[g]) || 0)) + n;
  return { ok: true };
}

function takeMaterial(progress, ore, qty) {
  const o = String(ore || "").toLowerCase();
  if (!ORES.has(o)) return { ok: false, error: "Неверная руда" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  const have = Math.max(0, Math.floor(Number(progress.materials[o]) || 0));
  if (have < n) return { ok: false, error: "Не хватает руды" };
  progress.materials[o] = have - n;
  return { ok: true, item: { kind: "material", ore: o }, qty: n };
}

function giveMaterial(progress, ore, qty) {
  const o = String(ore || "").toLowerCase();
  if (!ORES.has(o)) return { ok: false, error: "Неверная руда" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  progress.materials[o] = Math.max(0, Math.floor(Number(progress.materials[o]) || 0)) + n;
  return { ok: true };
}

function takeArmorPiece(progress, fragId, qty) {
  const fid = String(fragId || "");
  if (!isArmorPieceId(fid)) return { ok: false, error: "Неверный кусок брони" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (!progress.materials || typeof progress.materials !== "object") {
    progress.materials = { soul: 0, spirit: 0 };
  }
  const have = Math.max(0, Math.floor(Number(progress.materials[fid]) || 0));
  if (have < n) return { ok: false, error: "Не хватает кусков брони" };
  progress.materials[fid] = have - n;
  return { ok: true, item: { kind: "armor_piece", fragId: fid }, qty: n };
}

function giveArmorPiece(progress, fragId, qty) {
  const fid = String(fragId || "");
  if (!isArmorPieceId(fid)) return { ok: false, error: "Неверный кусок брони" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (!progress.materials || typeof progress.materials !== "object") {
    progress.materials = { soul: 0, spirit: 0 };
  }
  progress.materials[fid] = Math.max(0, Math.floor(Number(progress.materials[fid]) || 0)) + n;
  return { ok: true };
}

function takeJewelryPiece(progress, fragId, qty) {
  const fid = String(fragId || "");
  if (!isJewelryPieceId(fid)) return { ok: false, error: "Неверный кусок бижутерии" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (!Array.isArray(progress.inventory)) progress.inventory = [];
  let left = n;
  const next = [];
  for (const it of progress.inventory) {
    if (!it || it.kind !== "shard" || String(it.id) !== fid) {
      next.push(it);
      continue;
    }
    const have = Math.max(0, Math.floor(Number(it.qty) || 0));
    if (left <= 0) {
      next.push(it);
      continue;
    }
    if (have <= left) {
      left -= have;
      continue;
    }
    next.push(Object.assign({}, it, { qty: have - left }));
    left = 0;
  }
  if (left > 0) return { ok: false, error: "Не хватает кусков бижутерии" };
  progress.inventory = next;
  return { ok: true, item: { kind: "jewelry_piece", fragId: fid }, qty: n };
}

function giveJewelryPiece(progress, fragId, qty) {
  const fid = String(fragId || "");
  if (!isJewelryPieceId(fid)) return { ok: false, error: "Неверный кусок бижутерии" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (!Array.isArray(progress.inventory)) progress.inventory = [];
  const idx = progress.inventory.findIndex((it) => it && it.kind === "shard" && String(it.id) === fid);
  if (idx >= 0) {
    const cur = progress.inventory[idx];
    progress.inventory[idx] = Object.assign({}, cur, {
      qty: Math.max(0, Math.floor(Number(cur.qty) || 0)) + n,
    });
  } else {
    if (progress.inventory.length >= MAIL_INV_CAP) {
      return { ok: false, error: "Инвентарь полон (" + MAIL_INV_CAP + ")" };
    }
    progress.inventory.push({
      uid: "sh_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      id: fid,
      kind: "shard",
      qty: n,
    });
  }
  return { ok: true };
}

function takeScrollMail(progress, target, typeId, grade, qty) {
  const t = String(target || "").toLowerCase();
  const ty = String(typeId || "").toLowerCase();
  const g = String(grade || "").toUpperCase();
  if (!SCROLL_TARGETS.has(t)) return { ok: false, error: "Неверная цель свитка" };
  if (!SCROLL_TYPE_IDS.has(ty)) return { ok: false, error: "Неверный тип свитка" };
  if (!GRADES.has(g)) return { ok: false, error: "Неверный грейд" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  ensureMailScrolls(progress);
  const have = Math.max(0, Math.floor(Number(progress.scrolls[t][ty][g]) || 0));
  if (have < n) return { ok: false, error: "Не хватает свитков" };
  progress.scrolls[t][ty][g] = have - n;
  return { ok: true, item: { kind: "scroll", target: t, typeId: ty, scrollType: ty, grade: g }, qty: n };
}

function giveScrollMail(progress, target, typeId, grade, qty) {
  const t = String(target || "").toLowerCase();
  const ty = String(typeId || "").toLowerCase();
  const g = String(grade || "").toUpperCase();
  if (!SCROLL_TARGETS.has(t) || !SCROLL_TYPE_IDS.has(ty) || !GRADES.has(g)) {
    return { ok: false, error: "Неверный свиток" };
  }
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  ensureMailScrolls(progress);
  progress.scrolls[t][ty][g] = Math.max(0, Math.floor(Number(progress.scrolls[t][ty][g]) || 0)) + n;
  return { ok: true };
}

function takeShot(progress, shotKind, grade, qty) {
  const sk = String(shotKind || "").toLowerCase();
  const g = String(grade || "").toUpperCase();
  if (!ORES.has(sk)) return { ok: false, error: "Неверный тип заряда" };
  if (!GRADES.has(g)) return { ok: false, error: "Неверный грейд" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (!progress.shots[sk]) progress.shots[sk] = { D: 0, C: 0, B: 0, A: 0 };
  const have = Math.max(0, Math.floor(Number(progress.shots[sk][g]) || 0));
  if (have < n) return { ok: false, error: "Не хватает зарядов" };
  progress.shots[sk][g] = have - n;
  return { ok: true, item: { kind: "shot", shotKind: sk, grade: g }, qty: n };
}

function giveShot(progress, shotKind, grade, qty) {
  const sk = String(shotKind || "").toLowerCase();
  const g = String(grade || "").toUpperCase();
  if (!ORES.has(sk) || !GRADES.has(g)) return { ok: false, error: "Неверный заряд" };
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (!progress.shots[sk]) progress.shots[sk] = { D: 0, C: 0, B: 0, A: 0 };
  progress.shots[sk][g] = Math.max(0, Math.floor(Number(progress.shots[sk][g]) || 0)) + n;
  return { ok: true };
}

/** Извлечь вложение из прогресса по телу запроса. */
function takeMailFromProgress(progress, body) {
  const kind = String(body.kind || (body.uid ? "weapon" : "")).toLowerCase();
  if (MAIL_GEAR_KINDS.has(kind) || body.uid) {
    return takeGearFromProgress(progress, body.uid);
  }
  if (kind === "adena") return takeAdena(progress, body.qty ?? body.adena);
  if (kind === "crystal") return takeCrystal(progress, body.grade, body.qty);
  if (kind === "material") return takeMaterial(progress, body.ore, body.qty);
  if (kind === "armor_piece") {
    return takeArmorPiece(progress, body.fragId || body.frag_id || body.id, body.qty);
  }
  if (kind === "jewelry_piece") {
    return takeJewelryPiece(progress, body.fragId || body.frag_id || body.id, body.qty);
  }
  if (kind === "scroll") {
    return takeScrollMail(
      progress,
      body.target,
      body.typeId || body.scrollType || body.scroll_type,
      body.grade,
      body.qty
    );
  }
  if (kind === "shot") {
    return takeShot(progress, body.shotKind || body.shot_kind, body.grade, body.qty);
  }
  return { ok: false, error: "Неизвестный тип вложения" };
}

function giveMailToProgress(progress, item, qty) {
  const kind = String(item?.kind || "").toLowerCase();
  const n = Math.max(1, Math.floor(Number(qty) || 1));
  if (MAIL_GEAR_KINDS.has(kind)) return giveGearToProgress(progress, item);
  if (kind === "adena") return giveAdena(progress, n);
  if (kind === "crystal") return giveCrystal(progress, item.grade, n);
  if (kind === "material") return giveMaterial(progress, item.ore, n);
  if (kind === "armor_piece") {
    return giveArmorPiece(progress, item.fragId || item.frag_id || item.id, n);
  }
  if (kind === "jewelry_piece") {
    return giveJewelryPiece(progress, item.fragId || item.frag_id || item.id, n);
  }
  if (kind === "scroll") {
    return giveScrollMail(
      progress,
      item.target,
      item.typeId || item.scrollType || item.scroll_type,
      item.grade,
      n
    );
  }
  if (kind === "shot") return giveShot(progress, item.shotKind || item.shot_kind, item.grade, n);
  return { ok: false, error: "Неизвестный тип предмета" };
}

function parcelPublicRow(row) {
  const item = parseItemJson(row.item_json);
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    senderCharacterId: row.sender_character_id,
    senderName: row.sender_name,
    recipientUserId: row.recipient_user_id,
    recipientCharacterId: row.recipient_character_id,
    recipientName: row.recipient_name,
    kind: row.kind,
    item,
    qty: row.qty,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at || null,
  };
}

function attachMailMethods(db, store, deps) {
  ensureMailSchema(db);

  const stmtInsert = db.prepare(`
    INSERT INTO mail_parcels (
      sender_user_id, sender_character_id, sender_name,
      recipient_user_id, recipient_character_id, recipient_name,
      kind, item_json, qty, status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'escrow', ?, ?)
  `);
  const stmtGet = db.prepare("SELECT * FROM mail_parcels WHERE id = ?");
  const stmtCasStatus = db.prepare(
    "UPDATE mail_parcels SET status = ?, claimed_at = ? WHERE id = ? AND status = ?"
  );
  const stmtCountPendingTo = db.prepare(`
    SELECT COUNT(*) AS n FROM mail_parcels
    WHERE recipient_user_id = ? AND recipient_character_id = ? AND status = 'escrow'
  `);
  const stmtInbox = db.prepare(`
    SELECT * FROM mail_parcels
    WHERE recipient_user_id = ? AND recipient_character_id = ? AND status = 'escrow'
    ORDER BY created_at DESC LIMIT 100
  `);
  const stmtOutbox = db.prepare(`
    SELECT * FROM mail_parcels
    WHERE sender_user_id = ? AND sender_character_id = ? AND status = 'escrow'
    ORDER BY created_at DESC LIMIT 100
  `);
  const stmtDue = db.prepare(
    "SELECT * FROM mail_parcels WHERE status = 'escrow' AND expires_at <= ? LIMIT ?"
  );
  const stmtFindByName = db.prepare(`
    SELECT user_id, slot_id, name, nick
    FROM player_characters
    WHERE created = 1 AND name IS NOT NULL AND name != ''
      AND name = ? COLLATE NOCASE
  `);
  const stmtUserById = db.prepare("SELECT id, nick FROM users WHERE id = ?");

  function loadUserData(userId) {
    const row = store.getSave(userId);
    if (!row) return { ok: false, error: "Нет облачного сейва" };
    const data = parseSavePayload(row);
    if (!data) return { ok: false, error: "Повреждённый сейв" };
    return { ok: true, row, data: cloneJson(data) };
  }

  function persistMutated(user, data, prevSeq) {
    const nextSeq = Math.max(1, (prevSeq || 0) + 1);
    const savedAt = Date.now();
    syncActiveRoot(data);
    const result = deps.persistPlayerSaveInternal(user, nextSeq, savedAt, null, data);
    return {
      seq: nextSeq,
      savedAt,
      data,
      summary: result.summary,
    };
  }

  function resolveRecipientByName(rawName) {
    const name = String(rawName || "").trim().slice(0, 48);
    if (name.length < 2) return { ok: false, error: "Укажи имя персонажа" };
    const rows = stmtFindByName.all(name);
    if (!rows.length) return { ok: false, error: "Персонаж «" + name + "» не найден" };
    if (rows.length > 1) {
      return {
        ok: false,
        error: "Несколько персонажей с именем «" + name + "». Нужна уникальность имени.",
      };
    }
    const r = rows[0];
    return {
      ok: true,
      userId: r.user_id,
      characterId: r.slot_id,
      name: r.name,
      nick: r.nick,
    };
  }

  function returnParcelToSender(parcel) {
    const item = parseItemJson(parcel.item_json);
    if (!item) return { ok: false, error: "Повреждённое письмо" };
    const sender = stmtUserById.get(parcel.sender_user_id);
    if (!sender) return { ok: false, error: "Отправитель не найден" };
    const loaded = loadUserData(sender.id);
    if (!loaded.ok) return loaded;
    const slot = getCharacterSlot(loaded.data, parcel.sender_character_id);
    if (!slot) return { ok: false, error: "Персонаж отправителя не найден" };
    const progress = ensureProgress(slot);
    const given = giveMailToProgress(progress, item, parcel.qty);
    if (!given.ok) return given;
    const saved = persistMutated(sender, loaded.data, loaded.row.seq);
    return { ok: true, sender, saved };
  }

  function expireDue(now, limit) {
    const due = stmtDue.all(now, Math.max(1, Math.min(50, limit || 20)));
    const results = [];
    for (const parcel of due) {
      const ret = returnParcelToSender(parcel);
      if (ret.ok) {
        stmtCasStatus.run("expired", now, parcel.id, "escrow");
        results.push({ id: parcel.id, status: "expired" });
      }
    }
    return results;
  }

  store.mailExpireDue = function mailExpireDue(now, limit) {
    return db.transaction(() => expireDue(now || Date.now(), limit))();
  };

  store.mailResolveName = function mailResolveName(name) {
    return resolveRecipientByName(name);
  };

  store.mailSend = function mailSend(user, body, now) {
    now = now || Date.now();
    body = body || {};
    const characterId = String(body.characterId || body.character_id || "").slice(0, 64);
    const toName = body.toName || body.to || body.recipientName;
    if (!characterId) return { ok: false, error: "Нужен characterId" };

    const result = db.transaction(() => {
      expireDue(now, 10);
      const dest = resolveRecipientByName(toName);
      if (!dest.ok) return dest;

      if (dest.userId === user.id && dest.characterId === characterId) {
        return { ok: false, error: "Нельзя отправить самому себе" };
      }

      const pending = stmtCountPendingTo.get(dest.userId, dest.characterId);
      if ((pending?.n || 0) >= MAIL_MAX_PENDING_PER_CHAR) {
        return { ok: false, error: "Почтовый ящик получателя полон" };
      }

      const loaded = loadUserData(user.id);
      if (!loaded.ok) return loaded;
      const slot = getCharacterSlot(loaded.data, characterId);
      if (!slot) return { ok: false, error: "Персонаж не найден" };
      const progress = ensureProgress(slot);
      if (!progress.avatar?.created) return { ok: false, error: "Создай персонажа" };

      const taken = takeMailFromProgress(progress, body);
      if (!taken.ok) return taken;
      if (!taken.item?.kind || !MAIL_KINDS.has(taken.item.kind)) {
        return { ok: false, error: "Некорректное вложение" };
      }

      const senderName = String(progress.avatar.name || user.nick || "").slice(0, 48);
      const expiresAt = now + MAIL_TTL_MS;
      const info = stmtInsert.run(
        user.id,
        characterId,
        senderName,
        dest.userId,
        dest.characterId,
        String(dest.name || "").slice(0, 48),
        taken.item.kind,
        JSON.stringify(taken.item),
        taken.qty,
        now,
        expiresAt
      );
      const saved = persistMutated(user, loaded.data, loaded.row.seq);
      const parcel = parcelPublicRow(stmtGet.get(info.lastInsertRowid));
      return { ok: true, parcel, senderName, ...saved };
    })();
    return result;
  };

  store.mailInbox = function mailInbox(user, body, now) {
    now = now || Date.now();
    const characterId = String(body?.characterId || body?.character_id || "").slice(0, 64);
    if (!characterId) return { ok: false, error: "Нужен characterId" };
    return db.transaction(() => {
      expireDue(now, 10);
      const rows = stmtInbox.all(user.id, characterId).map(parcelPublicRow);
      return { ok: true, rows, now };
    })();
  };

  store.mailOutbox = function mailOutbox(user, body, now) {
    now = now || Date.now();
    const characterId = String(body?.characterId || body?.character_id || "").slice(0, 64);
    if (!characterId) return { ok: false, error: "Нужен characterId" };
    return db.transaction(() => {
      expireDue(now, 10);
      const rows = stmtOutbox.all(user.id, characterId).map(parcelPublicRow);
      return { ok: true, rows, now };
    })();
  };

  store.mailClaim = function mailClaim(user, parcelId, body, now) {
    now = now || Date.now();
    const id = Math.floor(Number(parcelId));
    if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Некорректный id" };
    const characterId = String(body?.characterId || body?.character_id || "").slice(0, 64);
    if (!characterId) return { ok: false, error: "Нужен characterId" };

    const result = db.transaction(() => {
      expireDue(now, 10);
      const parcel = stmtGet.get(id);
      if (!parcel || parcel.status !== "escrow") {
        return { ok: false, error: "Письмо недоступно" };
      }
      if (parcel.recipient_user_id !== user.id) {
        return { ok: false, error: "Это письмо другому игроку" };
      }
      if (parcel.recipient_character_id !== characterId) {
        return { ok: false, error: "Переключись на персонажа-получателя" };
      }
      const item = parseItemJson(parcel.item_json);
      if (!item) return { ok: false, error: "Повреждённое письмо" };

      const loaded = loadUserData(user.id);
      if (!loaded.ok) return loaded;
      const slot = getCharacterSlot(loaded.data, characterId);
      if (!slot) return { ok: false, error: "Персонаж не найден" };
      const progress = ensureProgress(slot);
      const given = giveMailToProgress(progress, item, parcel.qty);
      if (!given.ok) return given;

      const upd = stmtCasStatus.run("claimed", now, id, "escrow");
      if (!upd.changes) return { ok: false, error: "Письмо уже получено" };

      const saved = persistMutated(user, loaded.data, loaded.row.seq);
      return {
        ok: true,
        parcel: parcelPublicRow(stmtGet.get(id)),
        ...saved,
      };
    })();
    return result;
  };

  store.mailCancel = function mailCancel(user, parcelId, body, now) {
    now = now || Date.now();
    const id = Math.floor(Number(parcelId));
    if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Некорректный id" };
    const characterId = String(body?.characterId || body?.character_id || "").slice(0, 64);

    const result = db.transaction(() => {
      const parcel = stmtGet.get(id);
      if (!parcel || parcel.status !== "escrow") {
        return { ok: false, error: "Письмо недоступно" };
      }
      if (parcel.sender_user_id !== user.id) {
        return { ok: false, error: "Это не ваше письмо" };
      }
      if (characterId && characterId !== parcel.sender_character_id) {
        return { ok: false, error: "Письмо отправлено другим персонажем" };
      }
      const ret = returnParcelToSender(parcel);
      if (!ret.ok) return ret;
      const upd = stmtCasStatus.run("returned", now, id, "escrow");
      if (!upd.changes) return { ok: false, error: "Письмо уже обработано" };
      return {
        ok: true,
        parcelId: id,
        status: "returned",
        ...ret.saved,
      };
    })();
    return result;
  };
}

module.exports = {
  MAIL_TTL_MS,
  MAIL_MAX_PENDING_PER_CHAR,
  MAIL_MAX_ADENA,
  ensureMailSchema,
  attachMailMethods,
  sanitizeGearItem,
};
