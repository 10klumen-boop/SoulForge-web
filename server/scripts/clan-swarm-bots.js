#!/usr/bin/env node
"use strict";

/**
 * Локальный рой ботов для прогона клан-системы (~2 часа).
 *
 * Только localhost / 127.0.0.1. HTTP API: регистрация → кланы → вклад →
 * захват/отбитие → печати → заявки на осаду. XP крутится через /save.
 *
 *   node server/scripts/clan-swarm-bots.js
 *   node server/scripts/clan-swarm-bots.js --hours 2 --bots 30
 *   node server/scripts/clan-swarm-bots.js --minutes 5   # короткий тест
 *
 * Env: SF_SMOKE_BASE (default http://127.0.0.1:8787), SF_SMOKE_DB
 */

const path = require("path");
const Database = require("better-sqlite3");

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1] != null) return args[i + 1];
  return fallback;
}

const BASE = String(process.env.SF_SMOKE_BASE || arg("--base", "http://127.0.0.1:8787")).replace(
  /\/$/,
  ""
);
const DB =
  process.env.SF_SMOKE_DB || path.join(__dirname, "..", "data", "soulforge.db");
const BOTS = Math.max(6, Math.min(60, Number(arg("--bots", "30")) || 30));
const CLANS = Math.max(2, Math.min(12, Number(arg("--clans", "6")) || 6));
const HOURS = Number(arg("--hours", "0")) || 0;
const MINUTES = Number(arg("--minutes", "0")) || 0;
const DURATION_MS =
  (HOURS > 0 ? HOURS * 3600e3 : 0) ||
  (MINUTES > 0 ? MINUTES * 60e3 : 0) ||
  2 * 3600e3;
const TICK_MS = Math.max(15_000, Number(arg("--tick-ms", "45000")) || 45_000);
const PASS = "BotFarm99";
const RUN_ID = Date.now().toString(36).replace(/[^a-z]/gi, "").slice(-4) || "run";

function assertLocalBase(url) {
  let u;
  try {
    u = new URL(url);
  } catch (_) {
    throw new Error("Bad --base URL");
  }
  const host = String(u.hostname || "").toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(
      "clan-swarm-bots: только локально (127.0.0.1/localhost), сейчас: " + host
    );
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function botNick(i) {
  // 2–16 латинских букв: SfBotAA .. SfBotBK
  const a = String.fromCharCode(65 + Math.floor(i / 26) % 26);
  const b = String.fromCharCode(65 + (i % 26));
  return ("SfBot" + a + b + RUN_ID).replace(/[^a-zA-Z]/g, "").slice(0, 16);
}

function clanName(i) {
  return ("Swarm" + String.fromCharCode(65 + i) + RUN_ID).slice(0, 24);
}

async function api(method, urlPath, { token, body, writerId } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const payload = body && typeof body === "object" ? { ...body } : body;
  if (writerId && payload && typeof payload === "object") payload.writerId = writerId;
  const res = await fetch(BASE + urlPath, {
    method,
    headers,
    body: payload != null ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function makeSave(bot, level) {
  const id = bot.charId;
  const xp = Math.max(0, (level - 1) * 1200 + Math.floor(Math.random() * 400));
  return {
    activeCharacterId: id,
    characters: [
      {
        id,
        progress: {
          adena: bot.adena || 80_000_000,
          avatar: {
            created: true,
            name: bot.charName,
            level,
            xp,
            classId: "fighter",
            raceId: ["human", "elf", "dark_elf", "orc", "dwarf"][bot.i % 5],
            professionId: bot.i % 3 === 0 ? "warrior" : null,
            professionTier: bot.i % 3 === 0 ? 1 : 0,
            professionRole: bot.i % 2 === 0 ? "tank" : "melee",
          },
          inventory: [],
          totals: { tries: level * 10, fails: 0, earned: level * 50000 },
          farmZone: "wasteland",
        },
      },
    ],
    adena: bot.adena || 80_000_000,
    farmZone: "wasteland",
  };
}

async function register(bot) {
  let r = await api("POST", "/auth/register", {
    body: { nick: bot.nick, password: PASS },
  });
  if (r.status === 409) {
    r = await api("POST", "/auth/login", {
      body: { nick: bot.nick, password: PASS },
    });
  }
  if (r.status !== 200 || !r.json?.ok || !r.json.token) {
    throw new Error("auth " + bot.nick + " " + JSON.stringify(r.json));
  }
  bot.token = r.json.token;
  bot.writerId = "swarm-" + bot.nick + "-" + RUN_ID;
  bot.seq = 0;
  return bot;
}

async function putSave(bot, level) {
  bot.level = level;
  bot.seq = (bot.seq || 0) + 1;
  const r = await api("PUT", "/save", {
    token: bot.token,
    writerId: bot.writerId,
    body: {
      data: makeSave(bot, level),
      seq: bot.seq,
      savedAt: Date.now(),
      clientVersion: "0.58-swarm",
      writerId: bot.writerId,
    },
  });
  if (r.status !== 200 || !r.json?.ok) {
    // lease conflict — soft skip
    return false;
  }
  return true;
}

function backdateTerritory(territoryId, msAgo) {
  const db = new Database(DB);
  try {
    db.prepare("UPDATE chat_clan_territories SET claimed_at = ? WHERE territory_id = ?").run(
      Date.now() - msAgo,
      territoryId
    );
  } finally {
    db.close();
  }
}

async function main() {
  assertLocalBase(BASE);
  console.log(
    "[swarm] base=" +
      BASE +
      " bots=" +
      BOTS +
      " clans=" +
      CLANS +
      " duration=" +
      Math.round(DURATION_MS / 60000) +
      "m tick=" +
      TICK_MS +
      "ms"
  );

  const health = await api("GET", "/health");
  if (health.status !== 200) throw new Error("server not up on " + BASE);

  const bots = [];
  for (let i = 0; i < BOTS; i++) {
    const nick = botNick(i);
    bots.push({
      i,
      nick,
      charId: "c" + i,
      charName: ("Hero" + nick).slice(0, 16),
      adena: 120_000_000,
      level: 8 + (i % 10),
      clanIdx: i % CLANS,
      isLeader: i < CLANS,
      isOfficer: i >= CLANS && i < CLANS * 2,
    });
  }

  console.log("[swarm] register…");
  for (const b of bots) {
    await register(b);
    await putSave(b, b.level);
  }

  const clans = [];
  for (let c = 0; c < CLANS; c++) {
    const lead = bots.find((b) => b.clanIdx === c && b.isLeader);
    const members = bots.filter((b) => b.clanIdx === c && !b.isLeader);
    const name = clanName(c);
    let r = await api("POST", "/chat/clan/create", {
      token: lead.token,
      body: { name, charName: lead.charName },
    });
    if (!r.json?.ok) throw new Error("create clan " + name + " " + JSON.stringify(r.json));
    const clanId = r.json.clan?.id;
    console.log("[swarm] clan", name, clanId);

    for (const m of members) {
      r = await api("POST", "/chat/clan/invite", {
        token: lead.token,
        body: { charName: m.charName },
      });
      const inviteId = r.json?.inviteId;
      if (!inviteId) {
        console.warn("[swarm] invite fail", m.charName, r.json);
        continue;
      }
      r = await api("POST", "/chat/clan/invite/respond", {
        token: m.token,
        body: { inviteId, accept: true },
      });
      if (!r.json?.ok) console.warn("[swarm] join fail", m.charName, r.json);
    }

    const officers = members.filter((m) => m.isOfficer);
    for (const o of officers) {
      await api("POST", "/chat/clan/role", {
        token: lead.token,
        body: { charName: o.charName, role: "officer" },
      });
    }

    r = await api("POST", "/chat/clan/warehouse/deposit", {
      token: lead.token,
      body: { amount: 100_000_000, characterId: lead.charId },
    });
    if (!r.json?.ok) console.warn("[swarm] deposit", name, r.json);

    clans.push({ idx: c, name, id: clanId, lead, members: [lead, ...members] });
  }

  const terr = await api("GET", "/chat/clan/territories", { token: bots[0].token });
  const meta = terr.json?.meta || {};
  const farmIds = Object.keys(meta).filter((id) => {
    const m = meta[id];
    return m && m.kind !== "city" && m.siegeEnabled && m.capturable;
  });
  const normalIds = farmIds.filter((id) => (meta[id].warTier || "normal") === "normal");
  const eliteIds = farmIds.filter((id) => {
    const w = meta[id].warTier;
    return w === "elite" || w === "flagship";
  });
  console.log("[swarm] farms", farmIds.length, "normal", normalIds.length, "elite", eliteIds.length);

  const started = Date.now();
  let tick = 0;
  while (Date.now() - started < DURATION_MS) {
    tick += 1;
    const elapsedMin = Math.round((Date.now() - started) / 60000);
    console.log("[swarm] tick", tick, "t+" + elapsedMin + "m");

    // XP grind
    for (const b of bots) {
      if (Math.random() < 0.7) {
        b.level = Math.min(40, (b.level || 8) + (Math.random() < 0.35 ? 1 : 0));
        b.adena = Math.max(5_000_000, (b.adena || 0) + 200_000 + Math.floor(Math.random() * 500_000));
        await putSave(b, b.level);
      }
    }

    // Top-up warehouse + claim / contest / siege / seals
    for (const clan of clans) {
      const actor = Math.random() < 0.5 ? clan.lead : clan.members.find((m) => m.isOfficer) || clan.lead;

      await api("POST", "/chat/clan/warehouse/deposit", {
        token: actor.token,
        body: {
          amount: 5_000_000 + Math.floor(Math.random() * 10_000_000),
          characterId: actor.charId,
        },
      });

      const list = await api("GET", "/chat/clan/territories", { token: actor.token });
      const holders = list.json?.holders || [];
      const heldMap = new Map(holders.map((h) => [h.territoryId, h]));
      const myHold = holders.filter((h) => h.clanId === clan.id);

      // Claim free normal
      if (myHold.length < 2) {
        const free = normalIds.find((id) => !heldMap.has(id));
        if (free) {
          const r = await api("POST", "/chat/clan/territories/claim", {
            token: actor.token,
            body: { territoryId: free },
          });
          if (r.json?.ok) console.log("[swarm]", clan.name, "claim", free);
        } else if (Math.random() < 0.35) {
          const target = normalIds[Math.floor(Math.random() * normalIds.length)];
          const h = heldMap.get(target);
          if (h && h.clanId !== clan.id) {
            backdateTerritory(target, 3 * 3600e3);
            const r = await api("POST", "/chat/clan/territories/contest", {
              token: actor.token,
              body: { territoryId: target },
            });
            if (r.json?.ok) console.log("[swarm]", clan.name, "contest", target);
            else if (r.json?.message) {
              /* day_cap / funds — ок */
            }
          }
        }
      }

      // Siege bids while window open
      for (const eid of eliteIds) {
        const st = await api(
          "GET",
          "/chat/clan/territories/siege-status?territoryId=" + encodeURIComponent(eid),
          { token: actor.token }
        );
        if (st.json?.window?.open) {
          const r = await api("POST", "/chat/clan/territories/siege-bid", {
            token: actor.token,
            body: { territoryId: eid },
          });
          if (r.json?.ok) console.log("[swarm]", clan.name, "siege-bid", eid);
        }
      }

      // Seals from members on held nodes
      for (const h of myHold) {
        const farmer = clan.members[Math.floor(Math.random() * clan.members.length)];
        await api("POST", "/chat/clan/seals/accrue", {
          token: farmer.token,
          body: { territoryId: h.territoryId, hits: 8 + Math.floor(Math.random() * 20) },
        });
      }

      // Soft nudge resolve (server also auto-resolves)
      if (tick % 3 === 0 && clan.idx === 0) {
        await api("POST", "/chat/clan/territories/siege-resolve", {
          token: clan.lead.token,
          body: {},
        });
      }
    }

    const left = DURATION_MS - (Date.now() - started);
    if (left <= 0) break;
    await sleep(Math.min(TICK_MS, left));
  }

  const end = await api("GET", "/chat/clan/leaderboard?limit=20", { token: bots[0].token });
  const entries = end.json?.entries || [];
  console.log("[swarm] done. top clans:");
  entries.slice(0, 10).forEach((e) => {
    console.log("  #" + e.rank, e.clanName, e.points);
  });
  console.log("[swarm] bots avg level", Math.round(bots.reduce((s, b) => s + (b.level || 0), 0) / bots.length));
}

main().catch((e) => {
  console.error("[swarm] FAIL", e);
  process.exit(1);
});
