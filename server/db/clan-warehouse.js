"use strict";

const { parseSavePayload, resolveActiveCharacterId } = require("./save-utils");

/** Territory meta (mirror game/src/data/clan-territories-data.js). */
const CLAN_TERRITORIES = {
  blazing_swamp: {
    id: "blazing_swamp",
    kind: "farm",
    labelRu: "Пылающее болото",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 80000,
    holderBonusAdenaPct: 6,
  },
  school_of_dark_arts: {
    id: "school_of_dark_arts",
    kind: "farm",
    labelRu: "Школа тёмных искусств",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 35500,
    holderBonusAdenaPct: 2,
  },
  ant_nest: {
    id: "ant_nest",
    kind: "farm",
    labelRu: "Муравейник",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 60000,
    holderBonusAdenaPct: 4,
  },
  bee_hive: {
    id: "bee_hive",
    kind: "farm",
    labelRu: "Улей",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 50500,
    holderBonusAdenaPct: 3,
  },
  cruma_marshlands: {
    id: "cruma_marshlands",
    kind: "farm",
    labelRu: "Болота Крумы",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 60000,
    holderBonusAdenaPct: 4,
  },
  cruma_tower_entrance: {
    id: "cruma_tower_entrance",
    kind: "farm",
    labelRu: "Башня Крумы (вход)",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 64000,
    holderBonusAdenaPct: 4,
  },
  dion_hills: {
    id: "dion_hills",
    kind: "farm",
    labelRu: "Холмы Диона",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 47500,
    holderBonusAdenaPct: 2,
  },
  execution_grounds: {
    id: "execution_grounds",
    kind: "farm",
    labelRu: "Поле казни",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 65000,
    holderBonusAdenaPct: 5,
  },
  floran_agricultural: {
    id: "floran_agricultural",
    kind: "farm",
    labelRu: "Флоранские поля",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 57500,
    holderBonusAdenaPct: 3,
  },
  partisans_hideaway: {
    id: "partisans_hideaway",
    kind: "farm",
    labelRu: "Укрытие партизан",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 53500,
    holderBonusAdenaPct: 3,
  },
  plains_of_dion: {
    id: "plains_of_dion",
    kind: "farm",
    labelRu: "Равнины Диона",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 51500,
    holderBonusAdenaPct: 3,
  },
  abandoned_coal_low: {
    id: "abandoned_coal_low",
    kind: "farm",
    labelRu: "Угольные шахты",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 40000,
    holderBonusAdenaPct: 2,
  },
  elven_ruins_hunt: {
    id: "elven_ruins_hunt",
    kind: "farm",
    labelRu: "Руины эльфов (охота)",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 37000,
    holderBonusAdenaPct: 2,
  },
  breka_stronghold: {
    id: "breka_stronghold",
    kind: "farm",
    labelRu: "Крепость Брека",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 58500,
    holderBonusAdenaPct: 3,
  },
  death_pass: {
    id: "death_pass",
    kind: "farm",
    labelRu: "Ущелье смерти",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 60000,
    holderBonusAdenaPct: 4,
  },
  dragon_valley_entrance: {
    id: "dragon_valley_entrance",
    kind: "farm",
    labelRu: "Долина драконов (вход)",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 67500,
    holderBonusAdenaPct: 4,
  },
  gorgon_flower_garden: {
    id: "gorgon_flower_garden",
    kind: "farm",
    labelRu: "Сад горгон",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 60000,
    holderBonusAdenaPct: 4,
  },
  fellmere_harvesting: {
    id: "fellmere_harvesting",
    kind: "farm",
    labelRu: "Жатва Феллмер",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 45000,
    holderBonusAdenaPct: 2,
  },
  windmill_hill: {
    id: "windmill_hill",
    kind: "farm",
    labelRu: "Ветряной холм",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 45000,
    holderBonusAdenaPct: 2,
  },
  abandoned_camp: {
    id: "abandoned_camp",
    kind: "farm",
    labelRu: "Заброшенный лагерь",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 45000,
    holderBonusAdenaPct: 3,
  },
  evil_hunting_grounds: {
    id: "evil_hunting_grounds",
    kind: "farm",
    labelRu: "Злые охотничьи угодья",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 50000,
    holderBonusAdenaPct: 2,
  },
  langk_lizardman: {
    id: "langk_lizardman",
    kind: "farm",
    labelRu: "Жилище ящеров Лангк",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 50000,
    holderBonusAdenaPct: 2,
  },
  maille_lizardman: {
    id: "maille_lizardman",
    kind: "farm",
    labelRu: "Казарма ящеров Мейл",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 50000,
    holderBonusAdenaPct: 2,
  },
  neutral_zone: {
    id: "neutral_zone",
    kind: "farm",
    labelRu: "Нейтральная зона",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 45000,
    holderBonusAdenaPct: 2,
  },
  orc_barracks_hunt: {
    id: "orc_barracks_hunt",
    kind: "farm",
    labelRu: "Казарма орков",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 54500,
    holderBonusAdenaPct: 3,
  },
  ruins_agony: {
    id: "ruins_agony",
    kind: "farm",
    labelRu: "Руины Агонии",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 55000,
    holderBonusAdenaPct: 4,
  },
  ruins_despair: {
    id: "ruins_despair",
    kind: "farm",
    labelRu: "Руины Отчаяния",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 50000,
    holderBonusAdenaPct: 2,
  },
  wasteland: {
    id: "wasteland",
    kind: "farm",
    labelRu: "Пустошь",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 50000,
    holderBonusAdenaPct: 4,
  },
  alligator_island: {
    id: "alligator_island",
    kind: "farm",
    labelRu: "Остров аллигаторов",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 70000,
    holderBonusAdenaPct: 4,
  },
  enchanted_valley: {
    id: "enchanted_valley",
    kind: "farm",
    labelRu: "Зачарованная долина",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 70000,
    holderBonusAdenaPct: 4,
  },
  sea_of_spores: {
    id: "sea_of_spores",
    kind: "farm",
    labelRu: "Море спор",
    capturable: true,
    siegeEnabled: true,
    rentPerDay: 70000,
    holderBonusAdenaPct: 4,
  },
  gludin: {
    id: "gludin",
    kind: "city",
    labelRu: "Глудин",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  gludio: {
    id: "gludio",
    kind: "city",
    labelRu: "Глудио",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  dion: {
    id: "dion",
    kind: "city",
    labelRu: "Дион",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  elven_village: {
    id: "elven_village",
    kind: "city",
    labelRu: "Деревня эльфов",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  dark_elven_village: {
    id: "dark_elven_village",
    kind: "city",
    labelRu: "Деревня тёмных",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  dwarven_village: {
    id: "dwarven_village",
    kind: "city",
    labelRu: "Деревня гномов",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  giran: {
    id: "giran",
    kind: "city",
    labelRu: "Гиран",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  oren: {
    id: "oren",
    kind: "city",
    labelRu: "Орен",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  heine: {
    id: "heine",
    kind: "city",
    labelRu: "Хейн",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  },
  aden: {
    id: "aden",
    kind: "city",
    labelRu: "Аден",
    capturable: false,
    siegeEnabled: false,
    rentPerDay: 0,
    holderBonusAdenaPct: 0,
  }
};

const HOLD_MAX = { farm: 2, city: 1 };
/** Safe JS integer — раньше 50ккк резало крупные взносы. */
const DEPOSIT_MAX = Number.MAX_SAFE_INTEGER;
const MS_DAY = 24 * 60 * 60 * 1000;
/** После захвата узел нельзя отбить сразу. */
const CONTEST_LOCK_MS = 30 * 60 * 1000;
/** База отбития: max(floor, rent × дней). */
const CONTEST_COST_FLOOR = 10_000_000;
const CONTEST_RENT_DAYS = 200;
/** Захват свободного узла со склада. */
const CLAIM_COST_FLOOR = 5_000_000;
const CLAIM_RENT_DAYS = 100;

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function getCharacterSlot(data, characterId) {
  data = data && typeof data === "object" ? data : {};
  const cid = String(characterId || "").slice(0, 64);
  const chars = Array.isArray(data.characters) ? data.characters : [];
  if (cid) {
    const hit = chars.find((c) => c && String(c.id) === cid);
    if (hit) return hit;
  }
  const active = resolveActiveCharacterId(data);
  if (active) {
    const hit = chars.find((c) => c && String(c.id) === String(active));
    if (hit) return hit;
  }
  return chars[0] || null;
}

function ensureProgress(slot) {
  if (!slot.progress || typeof slot.progress !== "object") slot.progress = {};
  const p = slot.progress;
  if (p.adena == null) p.adena = 0;
  return p;
}

function syncActiveRoot(data) {
  const activeId = resolveActiveCharacterId(data);
  const slot = getCharacterSlot(data, activeId);
  if (!slot?.progress) return data;
  const p = slot.progress;
  if (p.adena !== undefined) data.adena = p.adena;
  data.activeCharacterId = activeId;
  return data;
}

function attachClanEconomyMethods(db, store, deps) {
  deps = deps || {};

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_clan_warehouse (
      clan_id TEXT PRIMARY KEY,
      adena INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_territories (
      territory_id TEXT PRIMARY KEY,
      clan_id TEXT NOT NULL,
      claimed_at INTEGER NOT NULL,
      last_rent_at INTEGER NOT NULL,
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_warehouse_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan_id TEXT NOT NULL,
      user_id INTEGER,
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clan_terr_clan ON chat_clan_territories(clan_id);
    CREATE INDEX IF NOT EXISTS idx_clan_wh_log ON chat_clan_warehouse_log(clan_id, id DESC);
  `);

  const stmtMemberClan = db.prepare("SELECT clan_id FROM chat_clan_members WHERE user_id = ?");
  const stmtClanGet = db.prepare("SELECT * FROM chat_clans WHERE id = ?");
  const stmtMemberRole = db.prepare(
    "SELECT role FROM chat_clan_members WHERE clan_id = ? AND user_id = ?"
  );
  const stmtWhGet = db.prepare("SELECT * FROM chat_clan_warehouse WHERE clan_id = ?");
  const stmtWhUpsert = db.prepare(`
    INSERT INTO chat_clan_warehouse (clan_id, adena, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(clan_id) DO UPDATE SET adena = excluded.adena, updated_at = excluded.updated_at
  `);
  const stmtWhLog = db.prepare(`
    INSERT INTO chat_clan_warehouse_log (clan_id, user_id, kind, amount, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const stmtTerrAll = db.prepare("SELECT * FROM chat_clan_territories");
  const stmtTerrGet = db.prepare("SELECT * FROM chat_clan_territories WHERE territory_id = ?");
  const stmtTerrByClan = db.prepare("SELECT * FROM chat_clan_territories WHERE clan_id = ?");
  const stmtTerrInsert = db.prepare(`
    INSERT INTO chat_clan_territories (territory_id, clan_id, claimed_at, last_rent_at)
    VALUES (?, ?, ?, ?)
  `);
  const stmtTerrDelete = db.prepare("DELETE FROM chat_clan_territories WHERE territory_id = ?");
  const stmtTerrTransfer = db.prepare(`
    UPDATE chat_clan_territories
    SET clan_id = ?, claimed_at = ?, last_rent_at = ?
    WHERE territory_id = ?
  `);
  const stmtTerrRent = db.prepare(
    "UPDATE chat_clan_territories SET last_rent_at = ? WHERE territory_id = ?"
  );
  const stmtUserById = db.prepare("SELECT id, nick FROM users WHERE id = ?");

  function weekScore(clanId, now) {
    if (typeof store.clanGetWeekScore === "function") {
      return store.clanGetWeekScore(clanId, { now });
    }
    return 0;
  }

  function siegePower(clanId, now) {
    if (typeof store.clanGetSiegePower === "function") {
      return store.clanGetSiegePower(clanId, { now });
    }
    return { score: weekScore(clanId, now), tier: 0, costMult: 1, labelRu: "Слабая" };
  }

  function claimCostFor(meta) {
    const rent = Math.max(0, Math.floor(Number(meta?.rentPerDay) || 0));
    return Math.max(CLAIM_COST_FLOOR, rent * CLAIM_RENT_DAYS);
  }

  /**
   * Цена отбития = база(рента) × множитель силы осады владельца.
   * Сильный клан-держатель дороже отбить; атакующий с большей активностью — скидка до 40%.
   */
  function contestCostFor(meta, defenderClanId, attackerClanId, now) {
    const rent = Math.max(0, Math.floor(Number(meta?.rentPerDay) || 0));
    const base = Math.max(CONTEST_COST_FLOOR, rent * CONTEST_RENT_DAYS);
    const def = siegePower(defenderClanId, now);
    const atkScore = attackerClanId ? weekScore(attackerClanId, now) : 0;
    const mult = Math.max(1, Number(def.costMult) || 1);
    let cost = Math.floor(base * mult);
    const adv = Math.max(0, atkScore - (def.score || 0));
    const discount = Math.min(0.4, adv / 1000);
    cost = Math.floor(cost * (1 - discount));
    return {
      cost: Math.max(CONTEST_COST_FLOOR, cost),
      base,
      defenderScore: def.score || 0,
      defenderTier: def.tier || 0,
      defenderPowerRu: def.labelRu || "Слабая",
      attackerScore: atkScore,
      discountPct: Math.round(discount * 100),
      costMult: mult,
    };
  }

  function countHoldings(clanId) {
    const owned = stmtTerrByClan.all(clanId);
    let farm = 0;
    let city = 0;
    for (const o of owned) {
      const m = CLAN_TERRITORIES[o.territory_id];
      if (m?.kind === "city") city += 1;
      else farm += 1;
    }
    return { farm, city };
  }

  function getClanId(userId) {
    return stmtMemberClan.get(userId)?.clan_id || null;
  }

  function clanRole(clanId, userId) {
    const clan = stmtClanGet.get(clanId);
    const uid = Number(userId);
    if (clan && Number(clan.leader_user_id) === uid) return "leader";
    return stmtMemberRole.get(clanId, userId)?.role || "member";
  }

  function ensureWarehouse(clanId, now) {
    let row = stmtWhGet.get(clanId);
    if (!row) {
      stmtWhUpsert.run(clanId, 0, now);
      row = stmtWhGet.get(clanId);
    }
    return row;
  }

  function loadUserData(userId) {
    const row = store.getSave(userId);
    if (!row) return { ok: false, error: "need_save", message: "Нет облачного сейва" };
    const data = parseSavePayload(row);
    if (!data) return { ok: false, error: "bad_save", message: "Повреждённый сейв" };
    return { ok: true, row, data: cloneJson(data) };
  }

  function persistMutated(user, data, prevSeq) {
    const nextSeq = Math.max(1, (prevSeq || 0) + 1);
    const savedAt = Date.now();
    syncActiveRoot(data);
    const result = deps.persistPlayerSaveInternal(user, nextSeq, savedAt, null, data);
    return {
      save: {
        seq: nextSeq,
        savedAt,
        data,
        summary: result?.summary,
      },
    };
  }

  function holdersPublic(now) {
    now = Number(now) || Date.now();
    return stmtTerrAll.all().map((row) => {
      const meta = CLAN_TERRITORIES[row.territory_id] || {};
      const clan = stmtClanGet.get(row.clan_id);
      const quote = contestCostFor(meta, row.clan_id, null, now);
      const power = siegePower(row.clan_id, now);
      return {
        territoryId: row.territory_id,
        clanId: row.clan_id,
        clanName: clan?.name || "?",
        claimedAt: row.claimed_at,
        kind: meta.kind || "farm",
        labelRu: meta.labelRu || row.territory_id,
        rentPerDay: meta.rentPerDay || 0,
        holderBonusAdenaPct: meta.holderBonusAdenaPct || 0,
        siegeEnabled: !!meta.siegeEnabled,
        contestCost: quote.cost,
        contestBase: quote.base,
        claimCost: claimCostFor(meta),
        contestLockMs: CONTEST_LOCK_MS,
        siegeScore: power.score,
        siegeTier: power.tier,
        siegePowerRu: power.labelRu,
      };
    });
  }

  /** Accrue rent into warehouse for one clan; returns { added, adena }. */
  function accrueRentForClan(clanId, now) {
    now = Number(now) || Date.now();
    const rows = stmtTerrByClan.all(clanId);
    let added = 0;
    for (const row of rows) {
      const meta = CLAN_TERRITORIES[row.territory_id];
      if (!meta || !(meta.rentPerDay > 0)) {
        stmtTerrRent.run(now, row.territory_id);
        continue;
      }
      const last = Math.max(0, Number(row.last_rent_at) || Number(row.claimed_at) || now);
      const elapsed = Math.max(0, now - last);
      if (elapsed < 60_000) continue; // min 1 min tick
      const days = elapsed / MS_DAY;
      const gain = Math.floor(meta.rentPerDay * days);
      if (gain > 0) {
        added += gain;
        stmtWhLog.run(clanId, null, "rent", gain, row.territory_id, now);
      }
      stmtTerrRent.run(now, row.territory_id);
    }
    if (added > 0) {
      const wh = ensureWarehouse(clanId, now);
      const next = Math.max(0, Math.floor(Number(wh.adena) || 0) + added);
      stmtWhUpsert.run(clanId, next, now);
      return { added, adena: next };
    }
    const wh = ensureWarehouse(clanId, now);
    return { added: 0, adena: Math.max(0, Math.floor(Number(wh.adena) || 0)) };
  }

  store.clanListTerritories = function clanListTerritories() {
    return { ok: true, holders: holdersPublic(), meta: CLAN_TERRITORIES };
  };

  store.clanClaimTerritory = function clanClaimTerritory(user, opts = {}) {
    const territoryId = String(opts.territoryId || "").trim();
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta || !meta.capturable) {
      return { ok: false, error: "zone", message: "Зона не захватывается" };
    }
    // MVP: только siegeEnabled farm. Города — хабы без claim.
    if (!meta.siegeEnabled) {
      return {
        ok: false,
        error: "siege_off",
        message:
          meta.kind === "city"
            ? "Города — хабы без захвата в MVP"
            : "Осада этой зоны ещё не включена",
      };
    }
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const role = clanRole(clanId, user.id);
    if (role !== "leader" && role !== "officer") {
      return { ok: false, error: "role", message: "Заявляет лидер или офицер" };
    }
    const now = Number(opts.now) || Date.now();
    const cost = claimCostFor(meta);
    return db.transaction(() => {
      const cur = stmtTerrGet.get(territoryId);
      if (cur && cur.clan_id === clanId) {
        return { ok: true, message: "Уже ваш узел", holders: holdersPublic(now) };
      }
      if (cur) {
        const other = stmtClanGet.get(cur.clan_id);
        return {
          ok: false,
          error: "held",
          message:
            "Занято «" +
            (other?.name || "?") +
            "» — отбейте кнопкой «Отбить узел» (адена со склада)",
        };
      }
      const counts = countHoldings(clanId);
      if (meta.kind === "city" && counts.city >= HOLD_MAX.city) {
        return { ok: false, error: "cap", message: "Лимит: 1 город" };
      }
      if (meta.kind !== "city" && counts.farm >= HOLD_MAX.farm) {
        return { ok: false, error: "cap", message: "Лимит: 2 farm-узла" };
      }

      const wh = ensureWarehouse(clanId, now);
      const have = Math.max(0, Math.floor(Number(wh.adena) || 0));
      if (have < cost) {
        return {
          ok: false,
          error: "funds",
          message:
            "Захват: на складе нужно " +
            cost.toLocaleString("ru-RU") +
            " adena (есть " +
            have.toLocaleString("ru-RU") +
            ")",
          claimCost: cost,
        };
      }
      stmtWhUpsert.run(clanId, have - cost, now);
      stmtWhLog.run(clanId, user.id, "claim", cost, territoryId, now);
      stmtTerrInsert.run(territoryId, clanId, now, now);
      if (typeof store.clanAddActivityScore === "function") {
        store.clanAddActivityScore(clanId, 50, { now });
      }
      return {
        ok: true,
        claimCost: cost,
        warehouseAdena: have - cost,
        message:
          "Заявлено: " +
          meta.labelRu +
          " (−" +
          cost.toLocaleString("ru-RU") +
          " со склада)",
        holders: holdersPublic(now),
      };
    })();
  };

  /** Отбить занятый узел: цена от силы осады владельца, адена со склада атакующего. */
  store.clanContestTerritory = function clanContestTerritory(user, opts = {}) {
    const territoryId = String(opts.territoryId || "").trim();
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta || !meta.capturable) {
      return { ok: false, error: "zone", message: "Зона не захватывается" };
    }
    if (!meta.siegeEnabled) {
      return {
        ok: false,
        error: "siege_off",
        message:
          meta.kind === "city"
            ? "Города — хабы без захвата в MVP"
            : "Осада этой зоны ещё не включена",
      };
    }
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const role = clanRole(clanId, user.id);
    if (role !== "leader" && role !== "officer") {
      return { ok: false, error: "role", message: "Отбивает лидер или офицер" };
    }
    const now = Number(opts.now) || Date.now();

    return db.transaction(() => {
      const cur = stmtTerrGet.get(territoryId);
      if (!cur) {
        return {
          ok: false,
          error: "free",
          message: "Узел свободен — нажмите «Захватить узел»",
        };
      }
      if (cur.clan_id === clanId) {
        return { ok: true, message: "Уже ваш узел", holders: holdersPublic(now) };
      }

      const quote = contestCostFor(meta, cur.clan_id, clanId, now);
      const cost = quote.cost;

      const claimedAt = Math.max(0, Number(cur.claimed_at) || 0);
      const unlockAt = claimedAt + CONTEST_LOCK_MS;
      if (now < unlockAt) {
        const mins = Math.max(1, Math.ceil((unlockAt - now) / 60000));
        return {
          ok: false,
          error: "lock",
          message: "Защита после захвата ещё " + mins + " мин",
          unlockAt,
          ...quote,
          contestCost: cost,
        };
      }

      const counts = countHoldings(clanId);
      if (meta.kind === "city" && counts.city >= HOLD_MAX.city) {
        return { ok: false, error: "cap", message: "Лимит: 1 город — сначала снимите свой" };
      }
      if (meta.kind !== "city" && counts.farm >= HOLD_MAX.farm) {
        return {
          ok: false,
          error: "cap",
          message: "Лимит: 2 farm-узла — сначала снимите один свой",
        };
      }

      // Рента защитнику до передачи
      accrueRentForClan(cur.clan_id, now);

      const wh = ensureWarehouse(clanId, now);
      const have = Math.max(0, Math.floor(Number(wh.adena) || 0));
      if (have < cost) {
        return {
          ok: false,
          error: "funds",
          message:
            "Отбитие («" +
            quote.defenderPowerRu +
            "», ×" +
            quote.costMult +
            "): нужно " +
            cost.toLocaleString("ru-RU") +
            " adena на складе (есть " +
            have.toLocaleString("ru-RU") +
            ")",
          ...quote,
          contestCost: cost,
          warehouseAdena: have,
        };
      }

      const nextAdena = have - cost;
      stmtWhUpsert.run(clanId, nextAdena, now);
      stmtWhLog.run(clanId, user.id, "contest", cost, territoryId, now);
      stmtTerrTransfer.run(clanId, now, now, territoryId);

      if (typeof store.clanAddActivityScore === "function") {
        store.clanAddActivityScore(clanId, 75, { now });
      }

      const other = stmtClanGet.get(cur.clan_id);
      return {
        ok: true,
        contested: true,
        ...quote,
        contestCost: cost,
        warehouseAdena: nextAdena,
        message:
          "Отбито: " +
          meta.labelRu +
          " у «" +
          (other?.name || "?") +
          "» [" +
          quote.defenderPowerRu +
          "] (−" +
          cost.toLocaleString("ru-RU") +
          " со склада)",
        holders: holdersPublic(now),
      };
    })();
  };

  store.clanReleaseTerritory = function clanReleaseTerritory(user, opts = {}) {
    const territoryId = String(opts.territoryId || "").trim();
    const meta = CLAN_TERRITORIES[territoryId];
    if (!meta) return { ok: false, error: "zone", message: "Нет зоны" };
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const role = clanRole(clanId, user.id);
    if (role !== "leader" && role !== "officer") {
      return { ok: false, error: "role", message: "Снимает лидер или офицер" };
    }
    return db.transaction(() => {
      const cur = stmtTerrGet.get(territoryId);
      if (!cur || cur.clan_id !== clanId) {
        return { ok: false, error: "not_yours", message: "Узел не ваш" };
      }
      // flush rent before release
      accrueRentForClan(clanId, opts.now || Date.now());
      stmtTerrDelete.run(territoryId);
      return { ok: true, message: "Снято: " + meta.labelRu, holders: holdersPublic() };
    })();
  };

  store.clanGetWarehouse = function clanGetWarehouse(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const now = Number(opts.now) || Date.now();
    return db.transaction(() => {
      const rent = accrueRentForClan(clanId, now);
      const clan = stmtClanGet.get(clanId);
      const role = clanRole(clanId, user.id);
      const holdings = stmtTerrByClan.all(clanId).map((row) => {
        const meta = CLAN_TERRITORIES[row.territory_id] || {};
        return {
          territoryId: row.territory_id,
          labelRu: meta.labelRu || row.territory_id,
          rentPerDay: meta.rentPerDay || 0,
          claimedAt: row.claimed_at,
        };
      });
      return {
        ok: true,
        clanId,
        clanName: clan?.name || null,
        role,
        adena: rent.adena,
        rentAdded: rent.added,
        holdings,
        canDeposit: true,
        canWithdraw: false,
        donations:
          typeof store.clanDonationTier === "function" ? store.clanDonationTier() : [],
      };
    })();
  };

  store.clanWarehouseDeposit = function clanWarehouseDeposit(user, opts = {}) {
    const amount = Math.floor(Number(opts.amount) || 0);
    const known =
      typeof store.clanDonationTier === "function" &&
      store.clanDonationTier().some((d) => d.amount === amount);
    if (!Number.isFinite(amount) || !known) {
      return {
        ok: false,
        error: "amount",
        message: "Выбери сумму пожертвования: 1kk / 10kk / 100kk / 1kkk",
      };
    }
    if (amount > DEPOSIT_MAX) {
      return {
        ok: false,
        error: "amount",
        message: "Слишком большая сумма (макс. " + DEPOSIT_MAX.toLocaleString("ru-RU") + ")",
      };
    }
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const characterId = String(opts.characterId || "").slice(0, 64);
    if (!characterId) return { ok: false, error: "character", message: "Нужен characterId" };
    const now = Number(opts.now) || Date.now();

    return db.transaction(() => {
      const loaded = loadUserData(user.id);
      if (!loaded.ok) return loaded;
      const slot = getCharacterSlot(loaded.data, characterId);
      if (!slot) return { ok: false, error: "character", message: "Персонаж не найден" };
      const progress = ensureProgress(slot);
      const have = Math.max(0, Math.floor(Number(progress.adena) || 0));
      if (have < amount) {
        return { ok: false, error: "funds", message: "Недостаточно адены у персонажа" };
      }
      progress.adena = have - amount;
      accrueRentForClan(clanId, now);
      const wh = ensureWarehouse(clanId, now);
      const next = Math.max(0, Math.floor(Number(wh.adena) || 0) + amount);
      stmtWhUpsert.run(clanId, next, now);
      stmtWhLog.run(clanId, user.id, "donate", amount, characterId, now);
      let activity = null;
      if (typeof store.clanScoreFromDeposit === "function" && typeof store.clanAddActivityScore === "function") {
        const pts = store.clanScoreFromDeposit(amount);
        activity = store.clanAddActivityScore(clanId, pts, { now });
      }
      const persisted = persistMutated(user, loaded.data, loaded.row.seq);
      return {
        ok: true,
        adena: next,
        deposited: amount,
        donated: amount,
        xpGained: activity?.added || 0,
        charAdena: progress.adena,
        activity,
        ...persisted,
      };
    })();
  };

  store.clanWarehouseWithdraw = function clanWarehouseWithdraw(_user, _opts = {}) {
    return {
      ok: false,
      error: "disabled",
      message: "Склад — только пожертвования. Снятие отключено.",
    };
  };
}

module.exports = { attachClanEconomyMethods, CLAN_TERRITORIES };
