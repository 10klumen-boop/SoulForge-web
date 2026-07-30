"use strict";

/** Mirror game/src/data/clan-buffs-balance.js */

const path = require("path");
const { parseSavePayload, resolveActiveCharacterId } = require("./save-utils");

let OATH_SYMBOL;
try {
  OATH_SYMBOL = require(path.join(
    __dirname,
    "..",
    "..",
    "game",
    "src",
    "data",
    "oath-symbol-data.js"
  )).OATH_SYMBOL;
} catch (_) {
  OATH_SYMBOL = {
    id: "oath_symbol",
    materialKey: "oath_symbol",
    nameRu: "Символ Клятвы",
  };
}

const OATH_MAT = OATH_SYMBOL.materialKey || "oath_symbol";
const OATH_LABEL = OATH_SYMBOL.nameRu || "Символ Клятвы";

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
  if (!p.materials || typeof p.materials !== "object") p.materials = {};
  return p;
}

function syncActiveRoot(data) {
  const activeId = resolveActiveCharacterId(data);
  const slot = getCharacterSlot(data, activeId);
  if (!slot?.progress) return data;
  const p = slot.progress;
  if (p.adena !== undefined) data.adena = p.adena;
  if (p.materials) data.materials = p.materials;
  data.activeCharacterId = activeId;
  return data;
}

function studyCost(def) {
  return Math.max(0, Math.floor(Number(def?.costOathSymbol ?? def?.costAdena) || 0));
}

function materialsOathCount(progress) {
  const mats = progress?.materials;
  return Math.max(0, Math.floor(Number(mats?.[OATH_MAT]) || 0));
}

const CLAN_LEVELS = [
  { level: 1, minXp: 0, labelRu: "Новичок" },
  { level: 2, minXp: 200, labelRu: "Отряд" },
  { level: 3, minXp: 600, labelRu: "Клятва" },
  { level: 4, minXp: 1500, labelRu: "Знамя" },
  { level: 5, minXp: 3500, labelRu: "Легенда" },
];

const CLAN_ONLINE_BUFF_TIERS = [
  { tier: 0, minOnline: 0, adenaPct: 0, xpPct: 0, labelRu: "Тишина" },
  { tier: 1, minOnline: 2, adenaPct: 1, xpPct: 1, labelRu: "Дозор" },
  { tier: 2, minOnline: 4, adenaPct: 2, xpPct: 2, labelRu: "Сбор" },
  { tier: 3, minOnline: 7, adenaPct: 4, xpPct: 3, labelRu: "Клятва онлайна" },
  { tier: 4, minOnline: 12, adenaPct: 6, xpPct: 4, labelRu: "Полный строй" },
];

const CLAN_STUDY_BUFFS = [
  {
    id: "greed_1",
    branch: "farm",
    labelRu: "Жадность I",
    descRu: "+2% адены с фарма",
    adenaPct: 2,
    xpPct: 0,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "greed_2",
    branch: "farm",
    labelRu: "Жадность II",
    descRu: "+3% адены с фарма",
    adenaPct: 3,
    xpPct: 0,
    costOathSymbol: 15,
    requires: "greed_1",
    reqClanLevel: 2,
  },
  {
    id: "greed_3",
    branch: "farm",
    labelRu: "Жадность III",
    descRu: "+4% адены с фарма",
    adenaPct: 4,
    xpPct: 0,
    costOathSymbol: 40,
    requires: "greed_2",
    reqClanLevel: 3,
  },
  {
    id: "wisdom_1",
    branch: "xp",
    labelRu: "Мудрость I",
    descRu: "+2% XP",
    adenaPct: 0,
    xpPct: 2,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "wisdom_2",
    branch: "xp",
    labelRu: "Мудрость II",
    descRu: "+3% XP",
    adenaPct: 0,
    xpPct: 3,
    costOathSymbol: 15,
    requires: "wisdom_1",
    reqClanLevel: 2,
  },
  {
    id: "wisdom_3",
    branch: "xp",
    labelRu: "Мудрость III",
    descRu: "+4% XP",
    adenaPct: 0,
    xpPct: 4,
    costOathSymbol: 40,
    requires: "wisdom_2",
    reqClanLevel: 3,
  },
  {
    id: "unity_1",
    branch: "combo",
    labelRu: "Единство I",
    descRu: "+2% адены и +2% XP",
    adenaPct: 2,
    xpPct: 2,
    costOathSymbol: 25,
    requires: ["greed_1", "wisdom_1"],
    reqClanLevel: 3,
  },
  {
    id: "unity_2",
    branch: "combo",
    labelRu: "Единство II",
    descRu: "+3% адены и +3% XP",
    adenaPct: 3,
    xpPct: 3,
    costOathSymbol: 80,
    requires: ["greed_2", "wisdom_2", "unity_1"],
    reqClanLevel: 5,
  },
  {
    id: "valor_1",
    branch: "pvp",
    labelRu: "Доблесть I",
    descRu: "+2% урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 2,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "valor_2",
    branch: "pvp",
    labelRu: "Доблесть II",
    descRu: "+3% урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 3,
    costOathSymbol: 15,
    requires: "valor_1",
    reqClanLevel: 2,
  },
  {
    id: "valor_3",
    branch: "pvp",
    labelRu: "Доблесть III",
    descRu: "+4% урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 4,
    costOathSymbol: 40,
    requires: "valor_2",
    reqClanLevel: 3,
  },
  {
    id: "aegis_1",
    branch: "pvp_def",
    labelRu: "Эгида I",
    descRu: "−2% входящего урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 0,
    pvpDefPct: 2,
    costOathSymbol: 5,
    requires: null,
    reqClanLevel: 1,
  },
  {
    id: "aegis_2",
    branch: "pvp_def",
    labelRu: "Эгида II",
    descRu: "−3% входящего урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 0,
    pvpDefPct: 3,
    costOathSymbol: 15,
    requires: "aegis_1",
    reqClanLevel: 2,
  },
  {
    id: "aegis_3",
    branch: "pvp_def",
    labelRu: "Эгида III",
    descRu: "−4% входящего урона в PvP",
    adenaPct: 0,
    xpPct: 0,
    pvpPct: 0,
    pvpDefPct: 4,
    costOathSymbol: 40,
    requires: "aegis_2",
    reqClanLevel: 3,
  },
];

const CLAN_BUFF_CAPS = { adenaPct: 22, xpPct: 20, pvpPct: 12, pvpDefPct: 12 };

const CLAN_ACTIVITY = {
  claimTerritory: 50,
};

/** Mirror game/src/data/clan-buffs-balance.js — fixed donation tiers. */
const CLAN_DONATIONS = [
  { amount: 1_000_000, xp: 10, label: "1kk" },
  { amount: 10_000_000, xp: 120, label: "10kk" },
  { amount: 100_000_000, xp: 1400, label: "100kk" },
  { amount: 1_000_000_000, xp: 16000, label: "1kkk" },
];

function clanDonationByAmount(amount) {
  const n = Math.floor(Number(amount) || 0);
  return CLAN_DONATIONS.find((d) => d.amount === n) || null;
}

function clanScoreFromDonation(amount) {
  const tier = clanDonationByAmount(amount);
  return tier ? Math.max(0, Math.floor(Number(tier.xp) || 0)) : 0;
}

/** Сила осады (недельный activity score) → множитель цены отбития. */
const CLAN_SIEGE_POWER_TIERS = [
  { tier: 0, minScore: 0, costMult: 1, labelRu: "Слабая" },
  { tier: 1, minScore: 100, costMult: 1.75, labelRu: "Искра" },
  { tier: 2, minScore: 300, costMult: 3, labelRu: "Пламя" },
  { tier: 3, minScore: 700, costMult: 5, labelRu: "Клятва" },
];

/** @deprecated score→buff; kept for tests */
const CLAN_BUFF_TIERS = [
  { tier: 0, minScore: 0, adenaPct: 0, xpPct: 0, labelRu: "Нет" },
  { tier: 1, minScore: 100, adenaPct: 2, xpPct: 2, labelRu: "Искра" },
  { tier: 2, minScore: 300, adenaPct: 4, xpPct: 4, labelRu: "Пламя" },
  { tier: 3, minScore: 700, adenaPct: 6, xpPct: 5, labelRu: "Клятва" },
];

function clanUtcWeekId(now) {
  const d = new Date(Number(now) || Date.now());
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

function clanLevelFromXp(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let best = CLAN_LEVELS[0];
  for (let i = 0; i < CLAN_LEVELS.length; i++) {
    if (x >= CLAN_LEVELS[i].minXp) best = CLAN_LEVELS[i];
  }
  return best;
}

function clanXpToNext(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  const cur = clanLevelFromXp(x);
  let idx = 0;
  for (let i = 0; i < CLAN_LEVELS.length; i++) {
    if (CLAN_LEVELS[i].level === cur.level) idx = i;
  }
  const next = idx < CLAN_LEVELS.length - 1 ? CLAN_LEVELS[idx + 1] : null;
  if (!next) {
    return { next: null, need: 0, into: Math.max(0, x - cur.minXp), span: 0 };
  }
  return {
    next,
    need: Math.max(0, next.minXp - x),
    into: Math.max(0, x - cur.minXp),
    span: Math.max(1, next.minXp - cur.minXp),
  };
}

function clanStudyLevelMet(def, level) {
  if (!def) return false;
  const req = Math.max(1, Math.floor(Number(def.reqClanLevel) || 1));
  return Math.max(1, Math.floor(Number(level) || 1)) >= req;
}

function clanSiegePowerFromScore(score) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  let best = CLAN_SIEGE_POWER_TIERS[0];
  for (let i = 0; i < CLAN_SIEGE_POWER_TIERS.length; i++) {
    if (s >= CLAN_SIEGE_POWER_TIERS[i].minScore) best = CLAN_SIEGE_POWER_TIERS[i];
  }
  return best;
}

function clanBuffTierFromScore(score) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  let best = CLAN_BUFF_TIERS[0];
  for (let i = 0; i < CLAN_BUFF_TIERS.length; i++) {
    if (s >= CLAN_BUFF_TIERS[i].minScore) best = CLAN_BUFF_TIERS[i];
  }
  return best;
}

function clanOnlineBuffFromCount(onlineCount) {
  const n = Math.max(0, Math.floor(Number(onlineCount) || 0));
  let best = CLAN_ONLINE_BUFF_TIERS[0];
  for (let i = 0; i < CLAN_ONLINE_BUFF_TIERS.length; i++) {
    if (n >= CLAN_ONLINE_BUFF_TIERS[i].minOnline) best = CLAN_ONLINE_BUFF_TIERS[i];
  }
  return best;
}

function clanOnlineBuffNext(onlineCount) {
  const n = Math.max(0, Math.floor(Number(onlineCount) || 0));
  for (let i = 0; i < CLAN_ONLINE_BUFF_TIERS.length; i++) {
    if (n < CLAN_ONLINE_BUFF_TIERS[i].minOnline) {
      return {
        ...CLAN_ONLINE_BUFF_TIERS[i],
        need: CLAN_ONLINE_BUFF_TIERS[i].minOnline - n,
      };
    }
  }
  return null;
}

function clanStudyBuffDef(buffId) {
  const id = String(buffId || "");
  return CLAN_STUDY_BUFFS.find((b) => b.id === id) || null;
}

function clanStudyRequiresMet(def, studiedIds) {
  if (!def) return false;
  const have = new Set((studiedIds || []).map(String));
  const req = def.requires;
  if (!req) return true;
  const list = Array.isArray(req) ? req : [req];
  return list.every((rid) => have.has(String(rid)));
}

function clanBuffTotalsFromParts(onlineTier, studiedList) {
  let adenaPct = Math.max(0, Number(onlineTier?.adenaPct) || 0);
  let xpPct = Math.max(0, Number(onlineTier?.xpPct) || 0);
  let pvpPct = 0;
  let pvpDefPct = 0;
  (studiedList || []).forEach((b) => {
    adenaPct += Math.max(0, Number(b.adenaPct) || 0);
    xpPct += Math.max(0, Number(b.xpPct) || 0);
    pvpPct += Math.max(0, Number(b.pvpPct) || 0);
    pvpDefPct += Math.max(0, Number(b.pvpDefPct) || 0);
  });
  return {
    adenaPct: Math.min(CLAN_BUFF_CAPS.adenaPct, adenaPct),
    xpPct: Math.min(CLAN_BUFF_CAPS.xpPct, xpPct),
    pvpPct: Math.min(CLAN_BUFF_CAPS.pvpPct || 12, pvpPct),
    pvpDefPct: Math.min(CLAN_BUFF_CAPS.pvpDefPct || 12, pvpDefPct),
  };
}

function attachClanBuffMethods(db, store, deps) {
  deps = deps || {};
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_clan_week_score (
      clan_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (clan_id, week_id),
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_studied_buffs (
      clan_id TEXT NOT NULL,
      buff_id TEXT NOT NULL,
      studied_at INTEGER NOT NULL,
      studied_by INTEGER NOT NULL,
      PRIMARY KEY (clan_id, buff_id),
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_clan_progress (
      clan_id TEXT NOT NULL PRIMARY KEY,
      xp INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(clan_id) REFERENCES chat_clans(id) ON DELETE CASCADE
    );
  `);

  const stmtMemberClan = db.prepare("SELECT clan_id FROM chat_clan_members WHERE user_id = ?");
  const stmtGet = db.prepare(
    "SELECT score FROM chat_clan_week_score WHERE clan_id = ? AND week_id = ?"
  );
  const stmtUpsert = db.prepare(`
    INSERT INTO chat_clan_week_score (clan_id, week_id, score, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clan_id, week_id) DO UPDATE SET
      score = chat_clan_week_score.score + excluded.score,
      updated_at = excluded.updated_at
  `);
  const stmtXpGet = db.prepare("SELECT xp FROM chat_clan_progress WHERE clan_id = ?");
  const stmtXpUpsert = db.prepare(`
    INSERT INTO chat_clan_progress (clan_id, xp, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(clan_id) DO UPDATE SET
      xp = chat_clan_progress.xp + excluded.xp,
      updated_at = excluded.updated_at
  `);
  const stmtClanGet = db.prepare("SELECT id, name, leader_user_id FROM chat_clans WHERE id = ?");
  const stmtMemberCount = db.prepare(
    "SELECT COUNT(*) AS n FROM chat_clan_members WHERE clan_id = ?"
  );
  const stmtOnlineCount = db.prepare(`
    SELECT COUNT(*) AS n
    FROM chat_clan_members m
    JOIN write_leases wl ON wl.user_id = m.user_id
    WHERE m.clan_id = ? AND wl.expires_at > ?
  `);
  const stmtStudiedList = db.prepare(`
    SELECT buff_id, studied_at, studied_by
    FROM chat_clan_studied_buffs
    WHERE clan_id = ?
    ORDER BY studied_at ASC
  `);
  const stmtStudiedHas = db.prepare(
    "SELECT 1 AS ok FROM chat_clan_studied_buffs WHERE clan_id = ? AND buff_id = ?"
  );
  const stmtStudiedInsert = db.prepare(`
    INSERT INTO chat_clan_studied_buffs (clan_id, buff_id, studied_at, studied_by)
    VALUES (?, ?, ?, ?)
  `);
  const stmtRole = db.prepare(
    "SELECT role FROM chat_clan_members WHERE clan_id = ? AND user_id = ?"
  );
  const stmtWhGet = db.prepare("SELECT adena FROM chat_clan_warehouse WHERE clan_id = ?");
  const stmtWhUpsert = db.prepare(`
    INSERT INTO chat_clan_warehouse (clan_id, adena, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(clan_id) DO UPDATE SET adena = excluded.adena, updated_at = excluded.updated_at
  `);
  const stmtWhLog = db.prepare(`
    INSERT INTO chat_clan_warehouse_log (clan_id, user_id, kind, amount, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  function getClanId(userId) {
    return stmtMemberClan.get(userId)?.clan_id || null;
  }

  function clanRole(clanId, userId) {
    const clan = stmtClanGet.get(clanId);
    if (clan && clan.leader_user_id === userId) return "leader";
    const row = stmtRole.get(clanId, userId);
    return row?.role || "member";
  }

  function getClanXp(clanId) {
    return Math.max(0, Math.floor(Number(stmtXpGet.get(clanId)?.xp) || 0));
  }

  function clanProgressFields(clanId) {
    const xp = getClanXp(clanId);
    const lvl = clanLevelFromXp(xp);
    const prog = clanXpToNext(xp);
    const maxLevel = CLAN_LEVELS[CLAN_LEVELS.length - 1].level;
    return {
      level: lvl.level,
      xp,
      xpToNext: prog.need,
      xpIntoLevel: prog.into,
      xpLevelSpan: prog.span,
      levelLabelRu: lvl.labelRu,
      maxLevel,
      nextLevelLabelRu: prog.next ? prog.next.labelRu : null,
    };
  }

  function studiedRows(clanId) {
    return stmtStudiedList.all(clanId).map((row) => {
      const def = clanStudyBuffDef(row.buff_id);
      return {
        id: row.buff_id,
        labelRu: def?.labelRu || row.buff_id,
        adenaPct: def?.adenaPct || 0,
        xpPct: def?.xpPct || 0,
        pvpPct: def?.pvpPct || 0,
        pvpDefPct: def?.pvpDefPct || 0,
        studiedAt: row.studied_at,
        studiedBy: row.studied_by,
      };
    });
  }

  function buildBuffsPayload(clanId, opts = {}) {
    const now = Number(opts.now) || Date.now();
    const weekId = clanUtcWeekId(now);
    const scoreRow = stmtGet.get(clanId, weekId);
    const score = Math.max(0, Math.floor(Number(scoreRow?.score) || 0));
    const memberCount = Math.max(0, Math.floor(Number(stmtMemberCount.get(clanId)?.n) || 0));
    const onlineCount = Math.max(0, Math.floor(Number(stmtOnlineCount.get(clanId, now)?.n) || 0));
    const onlineTierActive = clanOnlineBuffFromCount(onlineCount);
    const onlineNext = clanOnlineBuffNext(onlineCount);
    const studied = studiedRows(clanId);
    const studiedIds = studied.map((s) => s.id);
    const totals = clanBuffTotalsFromParts(onlineTierActive, studied);
    const clan = stmtClanGet.get(clanId);
    const warehouseAdena = Math.max(0, Math.floor(Number(stmtWhGet.get(clanId)?.adena) || 0));
    const role = opts.userId != null ? clanRole(clanId, opts.userId) : null;
    const canStudy = role === "leader" || role === "officer";
    const progress = clanProgressFields(clanId);
    const clanLevel = progress.level;

    let myOathSymbols = 0;
    if (opts.userId != null) {
      const loaded = (() => {
        const row = store.getSave(opts.userId);
        if (!row) return null;
        const data = parseSavePayload(row);
        return data ? { data } : null;
      })();
      if (loaded) {
        const slot = getCharacterSlot(loaded.data, opts.characterId);
        if (slot) myOathSymbols = materialsOathCount(ensureProgress(slot));
      }
    }

    const catalog = CLAN_STUDY_BUFFS.map((def) => {
      const already = studiedIds.includes(def.id);
      const reqOk = clanStudyRequiresMet(def, studiedIds);
      const levelOk = clanStudyLevelMet(def, clanLevel);
      const reqLvl = Math.max(1, Math.floor(Number(def.reqClanLevel) || 1));
      const cost = studyCost(def);
      let lockReason = "";
      if (already) lockReason = "изучено";
      else if (!levelOk) lockReason = "нужен ур." + reqLvl + " клана";
      else if (!reqOk) lockReason = "нужны предыдущие";
      else if (!canStudy) lockReason = "только лидер/офицер";
      else if (myOathSymbols < cost) lockReason = "мало Символов Клятвы";
      return {
        id: def.id,
        branch: def.branch || "farm",
        labelRu: def.labelRu,
        descRu: def.descRu,
        adenaPct: def.adenaPct,
        xpPct: def.xpPct,
        pvpPct: def.pvpPct || 0,
        pvpDefPct: def.pvpDefPct || 0,
        costOathSymbol: cost,
        costAdena: 0,
        requires: def.requires,
        reqClanLevel: reqLvl,
        studied: already,
        canStudy: !already && levelOk && reqOk && canStudy && myOathSymbols >= cost,
        lockReason,
      };
    });

    return {
      ok: true,
      clanId,
      clanName: clan?.name || null,
      weekId,
      score,
      ...progress,
      online: {
        count: onlineCount,
        memberCount,
        tier: onlineTierActive.tier,
        labelRu: onlineTierActive.labelRu,
        adenaPct: onlineTierActive.adenaPct,
        xpPct: onlineTierActive.xpPct,
        next: onlineNext
          ? {
              tier: onlineNext.tier,
              minOnline: onlineNext.minOnline,
              labelRu: onlineNext.labelRu,
              need: onlineNext.need,
            }
          : null,
        tiers: CLAN_ONLINE_BUFF_TIERS,
      },
      studied,
      catalog,
      warehouseAdena,
      myOathSymbols,
      oathSymbolLabelRu: OATH_LABEL,
      canStudy,
      caps: CLAN_BUFF_CAPS,
      adenaPct: totals.adenaPct,
      xpPct: totals.xpPct,
      pvpPct: totals.pvpPct || 0,
      pvpDefPct: totals.pvpDefPct || 0,
      labelRu: onlineTierActive.labelRu,
      tier: onlineTierActive.tier,
    };
  }

  store.clanAddActivityScore = function clanAddActivityScore(clanId, points, opts = {}) {
    const add = Math.max(0, Math.floor(Number(points) || 0));
    if (!clanId || !add) {
      return {
        ok: true,
        added: 0,
        score: store.clanGetWeekScore(clanId, opts),
        xp: clanId ? getClanXp(clanId) : 0,
      };
    }
    const now = Number(opts.now) || Date.now();
    const weekId = clanUtcWeekId(now);
    stmtUpsert.run(clanId, weekId, add, now);
    stmtXpUpsert.run(clanId, add, now);
    const row = stmtGet.get(clanId, weekId);
    const xp = getClanXp(clanId);
    return {
      ok: true,
      added: add,
      weekId,
      score: Math.max(0, Math.floor(Number(row?.score) || 0)),
      xp,
      level: clanLevelFromXp(xp).level,
    };
  };

  store.clanGetWeekScore = function clanGetWeekScore(clanId, opts = {}) {
    if (!clanId) return 0;
    const now = Number(opts.now) || Date.now();
    const weekId = clanUtcWeekId(now);
    const row = stmtGet.get(clanId, weekId);
    return Math.max(0, Math.floor(Number(row?.score) || 0));
  };

  store.clanGetProgress = function clanGetProgress(clanId) {
    if (!clanId) return null;
    return clanProgressFields(clanId);
  };

  store.clanGetSiegePower = function clanGetSiegePower(clanId, opts = {}) {
    const score = store.clanGetWeekScore(clanId, opts);
    const power = clanSiegePowerFromScore(score);
    return { score, ...power };
  };

  store.clanScoreFromDeposit = function clanScoreFromDeposit(amount) {
    return clanScoreFromDonation(amount);
  };

  store.clanDonationTier = function clanDonationTier() {
    return CLAN_DONATIONS.slice();
  };

  store.clanGetBuffs = function clanGetBuffs(user, opts = {}) {
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    return buildBuffsPayload(clanId, {
      now: opts.now,
      userId: user.id,
      characterId: opts.characterId,
    });
  };

  store.clanStudyBuff = function clanStudyBuff(user, opts = {}) {
    const buffId = String(opts.buffId || "").trim();
    const def = clanStudyBuffDef(buffId);
    if (!def) return { ok: false, error: "buff", message: "Неизвестный бафф" };
    const clanId = getClanId(user.id);
    if (!clanId) return { ok: false, error: "clan", message: "Нужен клан" };
    const role = clanRole(clanId, user.id);
    if (role !== "leader" && role !== "officer") {
      return { ok: false, error: "role", message: "Изучает лидер или офицер" };
    }
    const characterId = String(opts.characterId || "").slice(0, 64);
    if (!characterId) return { ok: false, error: "character", message: "Нужен characterId" };
    const now = Number(opts.now) || Date.now();
    if (stmtStudiedHas.get(clanId, buffId)) {
      return { ok: false, error: "studied", message: "Уже изучено" };
    }
    const progress = clanProgressFields(clanId);
    if (!clanStudyLevelMet(def, progress.level)) {
      const reqLvl = Math.max(1, Math.floor(Number(def.reqClanLevel) || 1));
      return {
        ok: false,
        error: "clan_level",
        message: "Нужен ур." + reqLvl + " клана",
      };
    }
    const studiedIds = stmtStudiedList.all(clanId).map((r) => r.buff_id);
    if (!clanStudyRequiresMet(def, studiedIds)) {
      return { ok: false, error: "requires", message: "Сначала изучите предыдущие баффы" };
    }
    const cost = studyCost(def);
    if (!deps.persistPlayerSaveInternal) {
      return { ok: false, error: "server", message: "Сохранение недоступно" };
    }

    return db.transaction(() => {
      const row = store.getSave(user.id);
      if (!row) return { ok: false, error: "need_save", message: "Нет облачного сейва" };
      const data = parseSavePayload(row);
      if (!data) return { ok: false, error: "bad_save", message: "Повреждённый сейв" };
      const dataClone = cloneJson(data);
      const slot = getCharacterSlot(dataClone, characterId);
      if (!slot) return { ok: false, error: "character", message: "Персонаж не найден" };
      const charProgress = ensureProgress(slot);
      const have = materialsOathCount(charProgress);
      if (have < cost) {
        return {
          ok: false,
          error: "funds",
          message: "Нужно " + cost + " × " + OATH_LABEL,
        };
      }
      charProgress.materials[OATH_MAT] = have - cost;
      stmtWhLog.run(clanId, user.id, "study_buff", cost, buffId, now);
      stmtStudiedInsert.run(clanId, buffId, now, user.id);
      syncActiveRoot(dataClone);
      const nextSeq = Math.max(1, (row.seq || 0) + 1);
      const savedAt = Date.now();
      const result = deps.persistPlayerSaveInternal(user, nextSeq, savedAt, null, dataClone);
      const payload = buildBuffsPayload(clanId, {
        now,
        userId: user.id,
        characterId,
      });
      return {
        ok: true,
        studiedId: buffId,
        spent: cost,
        spentOathSymbol: cost,
        save: {
          seq: nextSeq,
          savedAt,
          data: dataClone,
          summary: result?.summary,
        },
        ...payload,
      };
    })();
  };
}

module.exports = {
  attachClanBuffMethods,
  clanUtcWeekId,
  clanBuffTierFromScore,
  clanSiegePowerFromScore,
  clanOnlineBuffFromCount,
  clanBuffTotalsFromParts,
  clanLevelFromXp,
  clanXpToNext,
  clanStudyLevelMet,
  CLAN_LEVELS,
  CLAN_BUFF_TIERS,
  CLAN_SIEGE_POWER_TIERS,
  CLAN_ONLINE_BUFF_TIERS,
  CLAN_STUDY_BUFFS,
  CLAN_BUFF_CAPS,
  CLAN_ACTIVITY,
  CLAN_DONATIONS,
  clanDonationByAmount,
  clanScoreFromDonation,
};
