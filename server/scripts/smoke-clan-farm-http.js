#!/usr/bin/env node
"use strict";

/**
 * Live HTTP smoke for farm+clan MVP against local server (default :8787).
 * Flow: create → invite → deposit → claim → (unlock) contest → study buff → boss.
 * Farm holder+% is covered by game/tests/clan-territory-holder.test.js (client).
 */

const path = require("path");
const Database = require("better-sqlite3");

const BASE = process.env.SF_SMOKE_BASE || "http://127.0.0.1:8787";
const DB = process.env.SF_SMOKE_DB || path.join(__dirname, "..", "data", "soulforge.db");
const suffix = Date.now().toString(36).replace(/[^a-z]/gi, "").slice(-5) || "smoke";
const PASS = "smoke12";

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

function nick(prefix) {
  // Auth: 2–16 latin letters only
  const n = (prefix + suffix).replace(/[^a-zA-Z]/g, "").slice(0, 16);
  assert(n.length >= 2, "nick too short " + n);
  return n;
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

function makeSave(adena, name, charId, level) {
  const id = charId || "c1";
  return {
    activeCharacterId: id,
    characters: [
      {
        id,
        progress: {
          adena,
          avatar: { created: true, name, level: level || 12 },
          inventory: [],
          totals: { tries: 0, fails: 0, earned: 0 },
          farmZone: "wasteland",
        },
      },
    ],
    adena,
    farmZone: "wasteland",
  };
}

async function register(nick) {
  const r = await api("POST", "/auth/register", { body: { nick, password: PASS } });
  assert(r.status === 200 && r.json?.ok, "register " + nick + " " + JSON.stringify(r.json));
  return { nick, token: r.json.token, writerId: "smoke-" + nick + "-" + suffix };
}

async function putSave(user, data, seq) {
  const r = await api("PUT", "/save", {
    token: user.token,
    writerId: user.writerId,
    body: { data, seq, savedAt: Date.now(), clientVersion: "0.58-smoke", writerId: user.writerId },
  });
  assert(r.status === 200 && r.json?.ok, "save " + user.nick + " " + JSON.stringify(r.json));
  return r.json;
}

function backdateTerritoryClaim(territoryId, msAgo) {
  const claimedAt = Date.now() - msAgo;
  const db = new Database(DB);
  try {
    const info = db
      .prepare("UPDATE chat_clan_territories SET claimed_at = ? WHERE territory_id = ?")
      .run(claimedAt, territoryId);
    assert(info.changes >= 1, "backdate territory " + territoryId);
  } finally {
    db.close();
  }
}

async function main() {
  const health = await api("GET", "/health");
  assert(health.status === 200, "health " + health.status);
  console.log("health ok", health.json?.version || "");

  const lead = await register(nick("SmkA"));
  const mem = await register(nick("SmkB"));
  lead.charId = "lead1";
  lead.charName = "Lead" + suffix;
  mem.charId = "mem1";
  mem.charName = "Mem" + suffix;

  await putSave(lead, makeSave(200_000_000, lead.charName, lead.charId), 1);
  await putSave(mem, makeSave(200_000_000, mem.charName, mem.charId), 1);

  // 1) create clan
  let r = await api("POST", "/chat/clan/create", {
    token: lead.token,
    body: { name: "Smoke" + suffix },
  });
  assert(r.status === 200 && r.json?.ok, "create " + JSON.stringify(r.json));
  const clanId = r.json.clan?.id;
  assert(clanId, "clan id");
  console.log("1 create ok", clanId);

  // 2) invite + accept
  r = await api("POST", "/chat/clan/invite", {
    token: lead.token,
    body: { charName: mem.charName },
  });
  assert(r.status === 200 && r.json?.ok && r.json.inviteId, "invite " + JSON.stringify(r.json));
  const inviteId = r.json.inviteId;
  r = await api("POST", "/chat/clan/invite/respond", {
    token: mem.token,
    body: { inviteId, accept: true },
  });
  assert(r.status === 200 && r.json?.ok, "join " + JSON.stringify(r.json));
  console.log("2 invite/join ok");

  // 3) warehouse deposit + claim free farm (or contest occupied if DB dirty)
  r = await api("POST", "/chat/clan/warehouse/deposit", {
    token: lead.token,
    body: { amount: 100_000_000, characterId: lead.charId },
  });
  assert(r.status === 200 && r.json?.ok, "deposit " + JSON.stringify(r.json));

  r = await api("GET", "/chat/clan/territories", { token: lead.token });
  assert(r.status === 200 && r.json?.ok, "territories list");
  const siegeIds = ["wasteland", "abandoned_camp", "ruins_agony", "execution_grounds"];
  const holders = r.json.holders || [];
  const heldMap = new Map(holders.map((h) => [h.territoryId, h]));
  let zoneId = siegeIds.find((id) => !heldMap.has(id));
  let acquiredVia = "claim";
  if (!zoneId) {
    zoneId = "wasteland";
    acquiredVia = "contest";
    backdateTerritoryClaim(zoneId, 35 * 60 * 1000);
    r = await api("POST", "/chat/clan/territories/contest", {
      token: lead.token,
      body: { territoryId: zoneId },
    });
    assert(r.status === 200 && r.json?.ok, "seed contest " + JSON.stringify(r.json));
    console.log("3 seed contest ok", zoneId, r.json.message);
  } else {
    r = await api("POST", "/chat/clan/territories/claim", {
      token: lead.token,
      body: { territoryId: zoneId },
    });
    assert(r.status === 200 && r.json?.ok, "claim " + zoneId + " " + JSON.stringify(r.json));
    console.log("3 claim ok", zoneId, r.json.message);
  }

  r = await api("GET", "/chat/clan/territories", { token: lead.token });
  assert(r.status === 200 && r.json?.ok, "territories");
  const held = (r.json.holders || []).find((h) => h.territoryId === zoneId);
  assert(held && held.clanId === clanId, "holder " + zoneId + " " + JSON.stringify(held));
  console.log("3b holder ok via", acquiredVia, held.holderBonusAdenaPct != null ? "+" + held.holderBonusAdenaPct + "%" : "");

  // Fresh claim/contest starts a new 30m lock — re-stamp claimed_at to NOW for lock check
  {
    const db = new Database(DB);
    try {
      db.prepare("UPDATE chat_clan_territories SET claimed_at = ? WHERE territory_id = ?").run(
        Date.now(),
        zoneId
      );
    } finally {
      db.close();
    }
  }

  // 4) member leaves → creates rival clan → contest after unlock
  r = await api("POST", "/chat/clan/leave", { token: mem.token, body: {} });
  assert(r.status === 200 && r.json?.ok, "leave " + JSON.stringify(r.json));
  r = await api("POST", "/chat/clan/create", {
    token: mem.token,
    body: { name: "Rival" + suffix },
  });
  assert(r.status === 200 && r.json?.ok, "rival create " + JSON.stringify(r.json));
  r = await api("POST", "/chat/clan/warehouse/deposit", {
    token: mem.token,
    body: { amount: 100_000_000, characterId: mem.charId },
  });
  assert(r.status === 200 && r.json?.ok, "rival deposit");

  r = await api("POST", "/chat/clan/territories/contest", {
    token: mem.token,
    body: { territoryId: zoneId },
  });
  assert(
    r.status === 400 && /защит/i.test(String(r.json?.message || r.json?.error || "")),
    "expect lock: " + JSON.stringify(r.json)
  );
  console.log("4a contest lock ok");

  backdateTerritoryClaim(zoneId, 35 * 60 * 1000);
  r = await api("POST", "/chat/clan/territories/contest", {
    token: mem.token,
    body: { territoryId: zoneId },
  });
  assert(r.status === 200 && r.json?.ok, "contest " + JSON.stringify(r.json));
  console.log("4b contest ok", r.json.message);

  // 5) study buff on rival (now holder) — need warehouse funds left after contest (~30M)
  r = await api("POST", "/chat/clan/buffs/study", {
    token: mem.token,
    body: { buffId: "greed_1" },
  });
  assert(r.status === 200 && r.json?.ok, "study " + JSON.stringify(r.json));
  assert(r.json.adenaPct === 2, "buff pct " + r.json.adenaPct);
  console.log("5 buff study ok", r.json.adenaPct + "%");

  // 6) boss clear → warehouse reward (hitIntervalMs ~150; dmg capped at 20)
  r = await api("POST", "/chat/clan/boss/start", { token: mem.token, body: {} });
  assert(r.status === 200 && r.json?.ok && r.json.run, "boss start " + JSON.stringify(r.json));
  const maxHp = Number(r.json.run.maxHp) || 0;
  assert(maxHp > 0, "maxHp");
  let cleared = false;
  const hitsNeeded = Math.ceil(maxHp / 20) + 3;
  for (let i = 0; i < hitsNeeded; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 160));
    r = await api("POST", "/chat/clan/boss/hit", { token: mem.token, body: { dmg: 20 } });
    assert(r.status === 200 && r.json?.ok, "hit " + i + " " + JSON.stringify(r.json));
    if (r.json.run?.status === "cleared") {
      cleared = true;
      assert(r.json.run.reward?.warehouseAdena >= 250000, "boss reward");
      break;
    }
  }
  assert(cleared, "boss cleared");
  r = await api("GET", "/chat/clan/warehouse", { token: mem.token });
  assert(r.status === 200 && r.json?.ok && r.json.adena >= 250000, "wh after boss " + JSON.stringify(r.json));
  console.log("6 boss+warehouse ok adena=" + r.json.adena);

  console.log("\nSMOKE PASS farm+clan HTTP (" + BASE + ")");
}

main().catch((e) => {
  console.error("\nSMOKE FAIL:", e.message || e);
  process.exit(1);
});
