"use strict";

const { parseSavePayload, summarizeSaveData, resolveActiveCharacterId } = require("./save-utils");

const MARKET_TAX = 0.05;
const MARKET_MIN_PRICE = 1000;
const MARKET_MAX_PRICE = 50_000_000_000;
const MARKET_LISTING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MARKET_MAX_LISTINGS = 10;
const MARKET_KINDS = new Set(["weapon", "crystal", "material", "shot"]);
const GRADES = new Set(["D", "C", "B", "A"]);
const ORES = new Set(["soul", "spirit"]);

function ensureMarketSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_user_id INTEGER NOT NULL,
      seller_character_id TEXT NOT NULL,
      seller_name TEXT,
      kind TEXT NOT NULL,
      item_json TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      price_adena INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'listed',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(seller_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_market_listings_status
      ON market_listings(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_market_listings_seller
      ON market_listings(seller_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_market_listings_kind
      ON market_listings(kind, status);
    CREATE TABLE IF NOT EXISTS market_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      buyer_user_id INTEGER NOT NULL,
      buyer_character_id TEXT NOT NULL,
      buyer_name TEXT,
      price_adena INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(listing_id) REFERENCES market_listings(id) ON DELETE CASCADE,
      FOREIGN KEY(buyer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_market_trades_created
      ON market_trades(created_at DESC);
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
  if (!p.crystals || typeof p.crystals !== "object") p.crystals = { D: 0, C: 0, B: 0, A: 0 };
  if (!p.materials || typeof p.materials !== "object") p.materials = { soul: 0, spirit: 0 };
  if (!p.shots || typeof p.shots !== "object") {
    p.shots = { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } };
  }
  if (!p.shots.soul) p.shots.soul = { D: 0, C: 0, B: 0, A: 0 };
  if (!p.shots.spirit) p.shots.spirit = { D: 0, C: 0, B: 0, A: 0 };
  if (!p.avatar || typeof p.avatar !== "object") p.avatar = {};
  if (!p.avatar.gear || typeof p.avatar.gear !== "object") p.avatar.gear = {};
  if (p.adena == null) p.adena = 0;
  if (!p.totals || typeof p.totals !== "object") p.totals = { tries: 0, fails: 0, earned: 0 };
  return p;
}

/** Mirror active character progress onto root save fields (legacy clients). */
function syncActiveRoot(data) {
  const activeId = resolveActiveCharacterId(data);
  const slot = getCharacterSlot(data, activeId);
  if (!slot?.progress) return data;
  const p = slot.progress;
  const keys = [
    "avatar", "adena", "farmZone", "inventory", "crystals", "materials", "shots",
    "autoShots", "equipped", "records", "totals", "achievements", "questProgress",
    "storyProgress", "storySeen", "collectibles", "passiveIncome", "autoClicker",
  ];
  for (const k of keys) {
    if (p[k] !== undefined) data[k] = cloneJson(p[k]);
  }
  data.activeCharacterId = activeId;
  return data;
}

function sanitizeWeaponItem(it) {
  if (!it || typeof it !== "object") return null;
  const id = String(it.id || "").slice(0, 64);
  const uid = String(it.uid || "").slice(0, 64);
  if (!id || !uid) return null;
  return {
    kind: "weapon",
    uid,
    id,
    plus: Math.max(0, Math.floor(Number(it.plus) || 0)),
    spent: Math.max(0, Math.floor(Number(it.spent) || 0)),
  };
}

function takeWeapon(progress, uid) {
  const want = String(uid || "");
  const inv = progress.inventory || [];
  const idx = inv.findIndex((it) => it && String(it.uid) === want);
  if (idx < 0) return { ok: false, error: "Оружие не найдено в инвентаре" };
  const it = inv[idx];
  if (it.starter) return { ok: false, error: "Стартовое оружие нельзя выставлять" };
  if (it.kind === "accessory") return { ok: false, error: "Аксессуары пока нельзя выставлять" };
  const gearUid = progress.avatar?.gear?.weapon?.uid;
  if (gearUid && String(gearUid) === want) {
    return { ok: false, error: "Сначала сними оружие" };
  }
  const snap = sanitizeWeaponItem(it);
  if (!snap) return { ok: false, error: "Некорректный предмет" };
  inv.splice(idx, 1);
  progress.inventory = inv;
  return { ok: true, item: snap, qty: 1 };
}

function giveWeapon(progress, item) {
  const snap = sanitizeWeaponItem(item);
  if (!snap) return { ok: false, error: "Некорректное оружие" };
  if (!Array.isArray(progress.inventory)) progress.inventory = [];
  if (progress.inventory.length >= 120) {
    return { ok: false, error: "Инвентарь покупателя полон" };
  }
  progress.inventory.push({
    uid: snap.uid,
    id: snap.id,
    plus: snap.plus,
    spent: snap.spent,
  });
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

function takeFromProgress(progress, body) {
  const kind = String(body.kind || "").toLowerCase();
  if (!MARKET_KINDS.has(kind)) return { ok: false, error: "Неизвестный тип лота" };
  if (kind === "weapon") return takeWeapon(progress, body.uid);
  if (kind === "crystal") return takeCrystal(progress, body.grade, body.qty);
  if (kind === "material") return takeMaterial(progress, body.ore, body.qty);
  if (kind === "shot") return takeShot(progress, body.shotKind || body.shot_kind, body.grade, body.qty);
  return { ok: false, error: "Неизвестный тип лота" };
}

function giveToProgress(progress, item, qty) {
  const kind = String(item?.kind || "").toLowerCase();
  const n = Math.max(1, Math.floor(Number(qty) || 1));
  if (kind === "weapon") return giveWeapon(progress, item);
  if (kind === "crystal") return giveCrystal(progress, item.grade, n);
  if (kind === "material") return giveMaterial(progress, item.ore, n);
  if (kind === "shot") return giveShot(progress, item.shotKind || item.shot_kind, item.grade, n);
  return { ok: false, error: "Неизвестный тип предмета" };
}

function parseItemJson(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}

function listingPublicRow(row) {
  const item = parseItemJson(row.item_json);
  return {
    id: row.id,
    sellerUserId: row.seller_user_id,
    sellerCharacterId: row.seller_character_id,
    sellerName: row.seller_name,
    kind: row.kind,
    item,
    qty: row.qty,
    priceAdena: row.price_adena,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function validatePrice(price) {
  const p = Math.floor(Number(price));
  if (!Number.isFinite(p) || p < MARKET_MIN_PRICE) {
    return { ok: false, error: "Минимальная цена: " + MARKET_MIN_PRICE + " адены" };
  }
  if (p > MARKET_MAX_PRICE) {
    return { ok: false, error: "Слишком высокая цена" };
  }
  return { ok: true, price: p };
}

function sellerPayout(price) {
  return Math.max(0, Math.floor(Number(price) * (1 - MARKET_TAX)));
}

/**
 * Attach market methods onto sqlite store.
 * @param {import('better-sqlite3').Database} db
 * @param {object} store
 * @param {object} deps { persistPlayerSaveInternal }
 */
function attachMarketMethods(db, store, deps) {
  ensureMarketSchema(db);

  const stmtInsertListing = db.prepare(`
    INSERT INTO market_listings (
      seller_user_id, seller_character_id, seller_name, kind, item_json, qty,
      price_adena, status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'listed', ?, ?)
  `);
  const stmtGetListing = db.prepare("SELECT * FROM market_listings WHERE id = ?");
  const stmtUpdateListingStatus = db.prepare(
    "UPDATE market_listings SET status = ? WHERE id = ? AND status = ?"
  );
  const stmtCountListed = db.prepare(
    "SELECT COUNT(*) AS n FROM market_listings WHERE seller_user_id = ? AND seller_character_id = ? AND status = 'listed'"
  );
  const stmtInsertTrade = db.prepare(`
    INSERT INTO market_trades (
      listing_id, buyer_user_id, buyer_character_id, buyer_name, price_adena, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const stmtDueListed = db.prepare(
    "SELECT * FROM market_listings WHERE status = 'listed' AND expires_at <= ? LIMIT ?"
  );
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

  function returnListingItem(listing) {
    const item = parseItemJson(listing.item_json);
    if (!item) return { ok: false, error: "Повреждённый лот" };
    const seller = stmtUserById.get(listing.seller_user_id);
    if (!seller) return { ok: false, error: "Продавец не найден" };
    const loaded = loadUserData(seller.id);
    if (!loaded.ok) return loaded;
    const slot = getCharacterSlot(loaded.data, listing.seller_character_id);
    if (!slot) return { ok: false, error: "Персонаж продавца не найден" };
    const progress = ensureProgress(slot);
    const given = giveToProgress(progress, item, listing.qty);
    if (!given.ok) return given;
    const saved = persistMutated(seller, loaded.data, loaded.row.seq);
    return { ok: true, seller, saved };
  }

  function expireDue(now, limit) {
    const due = stmtDueListed.all(now, Math.max(1, Math.min(50, limit || 20)));
    const results = [];
    for (const listing of due) {
      const ret = returnListingItem(listing);
      if (ret.ok) {
        stmtUpdateListingStatus.run("expired", listing.id, "listed");
        results.push({ id: listing.id, status: "expired" });
      }
    }
    return results;
  }

  store.marketExpireDue = function marketExpireDue(now) {
    return db.transaction(() => expireDue(now || Date.now(), 30))();
  };

  store.marketListListings = function marketListListings(opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    db.transaction(() => expireDue(now, 15))();

    const kind = opts.kind ? String(opts.kind).toLowerCase() : "";
    const grade = opts.grade ? String(opts.grade).toUpperCase() : "";
    const q = String(opts.q || "").trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
    const offset = Math.max(0, Number(opts.offset) || 0);

    let sql =
      "SELECT * FROM market_listings WHERE status = 'listed' AND expires_at > ?";
    const params = [now];
    if (kind && MARKET_KINDS.has(kind)) {
      sql += " AND kind = ?";
      params.push(kind);
    }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    let rows = db.prepare(sql).all(...params).map(listingPublicRow);

    if (grade && GRADES.has(grade)) {
      rows = rows.filter((r) => {
        if (r.kind === "weapon") return true; // grade resolved client-side from catalog
        return String(r.item?.grade || "").toUpperCase() === grade;
      });
    }
    if (q) {
      rows = rows.filter((r) => {
        const hay = JSON.stringify(r.item || {}).toLowerCase() + " " + String(r.sellerName || "").toLowerCase();
        return hay.includes(q);
      });
    }
    return { ok: true, rows, now };
  };

  store.marketListMine = function marketListMine(userId, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    db.transaction(() => expireDue(now, 15))();
    const characterId = opts.characterId ? String(opts.characterId).slice(0, 64) : null;
    let sql = "SELECT * FROM market_listings WHERE seller_user_id = ?";
    const params = [userId];
    if (characterId) {
      sql += " AND seller_character_id = ?";
      params.push(characterId);
    }
    sql += " ORDER BY created_at DESC LIMIT 100";
    const rows = db.prepare(sql).all(...params).map(listingPublicRow);
    return { ok: true, rows, now };
  };

  function logMarketAudit(user, event, payload, charName, characterId, adena) {
    try {
      if (typeof store.insertCharacterEvents !== "function") return;
      store.insertCharacterEvents(user.id, [
        {
          event,
          characterId: characterId || "market",
          charName: charName || null,
          payload: payload || {},
          adena: adena != null ? adena : null,
          at: Date.now(),
        },
      ]);
    } catch (e) {
      console.error("market audit", event, e);
    }
  }

  store.marketCreateListing = function marketCreateListing(user, body, now) {
    now = now || Date.now();
    const priceCheck = validatePrice(body.priceAdena ?? body.price);
    if (!priceCheck.ok) return priceCheck;
    const characterId = String(body.characterId || body.character_id || "").slice(0, 64);
    if (!characterId) return { ok: false, error: "Нужен characterId" };

    const result = db.transaction(() => {
      expireDue(now, 10);
      const counted = stmtCountListed.get(user.id, characterId);
      if ((counted?.n || 0) >= MARKET_MAX_LISTINGS) {
        return { ok: false, error: "Лимит лотов: " + MARKET_MAX_LISTINGS };
      }
      const loaded = loadUserData(user.id);
      if (!loaded.ok) return loaded;
      const slot = getCharacterSlot(loaded.data, characterId);
      if (!slot) return { ok: false, error: "Персонаж не найден" };
      const progress = ensureProgress(slot);
      if (!progress.avatar?.created) return { ok: false, error: "Создай персонажа" };
      const taken = takeFromProgress(progress, body);
      if (!taken.ok) return taken;
      const sellerName = String(progress.avatar.name || user.nick || "").slice(0, 48);
      const expiresAt = now + MARKET_LISTING_TTL_MS;
      const info = stmtInsertListing.run(
        user.id,
        characterId,
        sellerName,
        taken.item.kind,
        JSON.stringify(taken.item),
        taken.qty,
        priceCheck.price,
        now,
        expiresAt
      );
      const saved = persistMutated(user, loaded.data, loaded.row.seq);
      const listing = listingPublicRow(stmtGetListing.get(info.lastInsertRowid));
      return { ok: true, listing, sellerName, ...saved };
    })();
    if (result.ok) {
      logMarketAudit(
        user,
        "market_list",
        {
          listingId: result.listing?.id,
          kind: result.listing?.kind,
          price: result.listing?.priceAdena,
          qty: result.listing?.qty,
          item: result.listing?.item,
        },
        result.sellerName,
        characterId,
        result.listing?.priceAdena
      );
    }
    return result;
  };

  store.marketCancelListing = function marketCancelListing(user, listingId, body, now) {
    now = now || Date.now();
    const id = Math.floor(Number(listingId));
    if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Некорректный id" };

    const result = db.transaction(() => {
      const listing = stmtGetListing.get(id);
      if (!listing || listing.status !== "listed") {
        return { ok: false, error: "Лот недоступен" };
      }
      if (listing.seller_user_id !== user.id) {
        return { ok: false, error: "Это не ваш лот" };
      }
      const characterId = String(body?.characterId || listing.seller_character_id).slice(0, 64);
      if (characterId !== listing.seller_character_id) {
        return { ok: false, error: "Лот принадлежит другому персонажу" };
      }
      const item = parseItemJson(listing.item_json);
      const loaded = loadUserData(user.id);
      if (!loaded.ok) return loaded;
      const slot = getCharacterSlot(loaded.data, listing.seller_character_id);
      if (!slot) return { ok: false, error: "Персонаж не найден" };
      const progress = ensureProgress(slot);
      const given = giveToProgress(progress, item, listing.qty);
      if (!given.ok) return given;
      const upd = stmtUpdateListingStatus.run("cancelled", id, "listed");
      if (!upd.changes) return { ok: false, error: "Лот уже снят" };
      const saved = persistMutated(user, loaded.data, loaded.row.seq);
      return {
        ok: true,
        listingId: id,
        status: "cancelled",
        characterId,
        charName: progress.avatar?.name || null,
        kind: listing.kind,
        price: listing.price_adena,
        ...saved,
      };
    })();
    if (result.ok) {
      logMarketAudit(
        user,
        "market_cancel",
        { listingId: id, kind: result.kind, price: result.price },
        result.charName,
        result.characterId,
        result.price
      );
    }
    return result;
  };

  store.marketBuyListing = function marketBuyListing(buyerUser, listingId, body, now) {
    now = now || Date.now();
    const id = Math.floor(Number(listingId));
    if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Некорректный id" };
    const buyerCharacterId = String(body.characterId || body.character_id || "").slice(0, 64);
    if (!buyerCharacterId) return { ok: false, error: "Нужен characterId" };

    const result = db.transaction(() => {
      expireDue(now, 10);
      const listing = stmtGetListing.get(id);
      if (!listing || listing.status !== "listed") {
        return { ok: false, error: "Лот недоступен" };
      }
      if (listing.expires_at <= now) {
        returnListingItem(listing);
        stmtUpdateListingStatus.run("expired", id, "listed");
        return { ok: false, error: "Лот истёк" };
      }
      if (listing.seller_user_id === buyerUser.id) {
        return { ok: false, error: "Нельзя купить свой лот" };
      }

      const item = parseItemJson(listing.item_json);
      const price = listing.price_adena;
      const payout = sellerPayout(price);

      const buyerLoaded = loadUserData(buyerUser.id);
      if (!buyerLoaded.ok) return buyerLoaded;
      const buyerSlot = getCharacterSlot(buyerLoaded.data, buyerCharacterId);
      if (!buyerSlot) return { ok: false, error: "Персонаж покупателя не найден" };
      const buyerProgress = ensureProgress(buyerSlot);
      if (!buyerProgress.avatar?.created) return { ok: false, error: "Создай персонажа" };
      const buyerAdena = Math.max(0, Math.floor(Number(buyerProgress.adena) || 0));
      if (buyerAdena < price) return { ok: false, error: "Не хватает адены" };

      const given = giveToProgress(buyerProgress, item, listing.qty);
      if (!given.ok) return given;
      buyerProgress.adena = buyerAdena - price;

      const seller = stmtUserById.get(listing.seller_user_id);
      if (!seller) return { ok: false, error: "Продавец не найден" };
      const sellerLoaded = loadUserData(seller.id);
      if (!sellerLoaded.ok) return sellerLoaded;
      const sellerSlot = getCharacterSlot(sellerLoaded.data, listing.seller_character_id);
      if (!sellerSlot) return { ok: false, error: "Персонаж продавца не найден" };
      const sellerProgress = ensureProgress(sellerSlot);
      sellerProgress.adena = Math.max(0, Math.floor(Number(sellerProgress.adena) || 0)) + payout;
      sellerProgress.totals.earned =
        Math.max(0, Math.floor(Number(sellerProgress.totals.earned) || 0)) + payout;

      const upd = stmtUpdateListingStatus.run("sold", id, "listed");
      if (!upd.changes) return { ok: false, error: "Лот уже куплен" };

      const buyerName = String(buyerProgress.avatar.name || buyerUser.nick || "").slice(0, 48);
      stmtInsertTrade.run(id, buyerUser.id, buyerCharacterId, buyerName, price, now);

      const buyerSaved = persistMutated(buyerUser, buyerLoaded.data, buyerLoaded.row.seq);
      const sellerSaved = persistMutated(seller, sellerLoaded.data, sellerLoaded.row.seq);

      return {
        ok: true,
        listingId: id,
        priceAdena: price,
        taxAdena: price - payout,
        payoutAdena: payout,
        buyerName,
        sellerUserId: seller.id,
        sellerName: listing.seller_name,
        kind: listing.kind,
        item,
        buyer: buyerSaved,
        sellerSeq: sellerSaved.seq,
      };
    })();
    if (result.ok) {
      logMarketAudit(
        buyerUser,
        "market_buy",
        {
          listingId: id,
          sellerUserId: result.sellerUserId,
          sellerName: result.sellerName,
          kind: result.kind,
          item: result.item,
          price: result.priceAdena,
          tax: result.taxAdena,
          payout: result.payoutAdena,
        },
        result.buyerName,
        buyerCharacterId,
        result.priceAdena
      );
    }
    return result;
  };

  store.adminListMarket = function adminListMarket(opts = {}) {
    const status = opts.status ? String(opts.status).slice(0, 16) : null;
    const kind = opts.kind ? String(opts.kind).toLowerCase() : null;
    const nickRaw = opts.nick ? String(opts.nick).replace(/[%_]/g, "").trim() : "";
    const nickLike = nickRaw ? "%" + nickRaw + "%" : null;
    const limit = Math.min(200, Math.max(1, Math.floor(Number(opts.limit) || 80)));
    const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));

    let where = "WHERE 1=1";
    const params = [];
    if (status) {
      where += " AND l.status = ?";
      params.push(status);
    }
    if (kind && MARKET_KINDS.has(kind)) {
      where += " AND l.kind = ?";
      params.push(kind);
    }
    if (nickLike) {
      where += " AND (u.nick LIKE ? COLLATE NOCASE OR IFNULL(l.seller_name,'') LIKE ? COLLATE NOCASE)";
      params.push(nickLike, nickLike);
    }
    const total = db
      .prepare(
        `SELECT COUNT(*) AS n FROM market_listings l
         LEFT JOIN users u ON u.id = l.seller_user_id ${where}`
      )
      .get(...params).n;
    const rows = db
      .prepare(
        `SELECT l.*, u.nick AS seller_nick
         FROM market_listings l
         LEFT JOIN users u ON u.id = l.seller_user_id
         ${where}
         ORDER BY l.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset)
      .map((row) => ({
        id: row.id,
        status: row.status,
        kind: row.kind,
        qty: row.qty,
        priceAdena: row.price_adena,
        sellerUserId: row.seller_user_id,
        sellerNick: row.seller_nick || null,
        sellerName: row.seller_name || null,
        characterId: row.seller_character_id,
        item: parseItemJson(row.item_json),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }));
    return { ok: true, rows, total, limit, offset };
  };
}

module.exports = {
  MARKET_TAX,
  MARKET_MIN_PRICE,
  MARKET_MAX_PRICE,
  MARKET_LISTING_TTL_MS,
  MARKET_MAX_LISTINGS,
  MARKET_KINDS,
  ensureMarketSchema,
  attachMarketMethods,
  takeFromProgress,
  giveToProgress,
  sanitizeWeaponItem,
  validatePrice,
  sellerPayout,
  syncActiveRoot,
  getCharacterSlot,
  ensureProgress,
  listingPublicRow,
};
