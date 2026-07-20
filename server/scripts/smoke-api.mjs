#!/usr/bin/env node
/**
 * SoulForge API smoke bots — safe against prod if nick stays disposable.
 *
 *   node scripts/smoke-api.mjs
 *   node scripts/smoke-api.mjs --base http://109.196.103.50
 *   npm run smoke -- --base http://localhost:8787
 *
 * Env: SOULFORGE_SMOKE_BASE, SOULFORGE_SMOKE_NICK, SOULFORGE_SMOKE_PASS
 */
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const BASE = String(
  arg("--base", process.env.SOULFORGE_SMOKE_BASE || "http://109.196.103.50")
).replace(/\/$/, "");

const FIXED_NICK = arg("--nick", process.env.SOULFORGE_SMOKE_NICK || "");
const PASS =
  arg("--pass", process.env.SOULFORGE_SMOKE_PASS || "") || "SmokeBot1";

const TIMEOUT_MS = Number(arg("--timeout", "15000")) || 15000;

let failed = 0;
const results = [];

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  failed += 1;
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

function lettersNick() {
  // NICK_RE: ^[a-zA-Z]{2,16}$
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let s = "Bot";
  const buf = randomBytes(5);
  for (let i = 0; i < 5; i++) s += alphabet[buf[i] % alphabet.length];
  return s.slice(0, 16);
}

async function req(method, path, { body, token, expectStatus } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text.slice(0, 200) };
    }
    if (expectStatus != null && res.status !== expectStatus) {
      const err = new Error(
        `HTTP ${res.status} (want ${expectStatus}): ${text.slice(0, 180)}`
      );
      err.status = res.status;
      err.json = json;
      throw err;
    }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

async function stepHealth() {
  const { json } = await req("GET", "/health", { expectStatus: 200 });
  if (!json?.ok) throw new Error(JSON.stringify(json));
  ok("health", `${json.service || "?"} v${json.version || "?"}`);
}

async function stepLeaderboards() {
  for (const mode of ["enchant", "power", "wealth", "mobs"]) {
    const { json } = await req("GET", `/leaderboard/${mode}?limit=5`, {
      expectStatus: 200,
    });
    if (!Array.isArray(json)) throw new Error(`${mode}: not an array`);
    ok(`leaderboard/${mode}`, `${json.length} rows`);
  }
}

async function stepAdminEnabled() {
  const { json } = await req("GET", "/admin/enabled", { expectStatus: 200 });
  if (!json?.ok) throw new Error(JSON.stringify(json));
  ok("admin/enabled", `enabled=${!!json.enabled}`);
}

async function stepAuthAndRuns() {
  const nick = FIXED_NICK || lettersNick();
  let token = null;

  // register or login
  try {
    const reg = await req("POST", "/auth/register", {
      body: { nick, password: PASS },
      expectStatus: 200,
    });
    if (!reg.json?.token) throw new Error("no token on register");
    token = reg.json.token;
    ok("auth/register", nick);
  } catch (e) {
    if (e.status === 409 || /занят|занят|taken/i.test(String(e.message))) {
      const login = await req("POST", "/auth/login", {
        body: { nick, password: PASS },
        expectStatus: 200,
      });
      if (!login.json?.token) throw new Error("no token on login");
      token = login.json.token;
      ok("auth/login (existing)", nick);
    } else {
      throw e;
    }
  }

  const me = await req("GET", "/auth/me", { token, expectStatus: 200 });
  if (!me.json?.ok || me.json.nick !== nick) {
    throw new Error(`me mismatch: ${JSON.stringify(me.json)}`);
  }
  ok("auth/me", `id=${me.json.id}`);

  await req("POST", "/runs", {
    token,
    body: {
      characterId: "c_smoke_run",
      charName: "SmokeRunner",
      maxPlus: 1,
      farmPower: 1,
      earned: 1,
      adena: 1,
      mobs: 3,
      clientVersion: "smoke",
    },
    expectStatus: 200,
  });
  ok("runs (tiny upsert)");

  const board = await req("GET", "/leaderboard/enchant?limit=100", {
    expectStatus: 200,
  });
  const hit = Array.isArray(board.json)
    ? board.json.find(
        (r) =>
          r.characterId === "c_smoke_run" ||
          r.charName === "SmokeRunner" ||
          r.name === nick ||
          r.nick === nick
      )
    : null;
  if (!hit) {
    // may be outside top 100 — still OK if runs succeeded
    ok("leaderboard has bot", "not in top 100 (ok)");
  } else {
    ok(
      "leaderboard has bot",
      `rank=${hit.rank} name=${hit.name} nick=${hit.nick || "—"} maxPlus=${hit.maxPlus}`
    );
  }

  await req("POST", "/auth/logout", { token, body: {}, expectStatus: 200 });
  ok("auth/logout");

  // session should be dead
  try {
    await req("GET", "/auth/me", { token, expectStatus: 401 });
    ok("auth/me after logout → 401");
  } catch (e) {
    if (e.status === 401) ok("auth/me after logout → 401");
    else throw e;
  }

  // re-login for next deploys with fixed nick
  if (FIXED_NICK) {
    const again = await req("POST", "/auth/login", {
      body: { nick, password: PASS },
      expectStatus: 200,
    });
    await req("POST", "/auth/logout", {
      token: again.json.token,
      body: {},
      expectStatus: 200,
    });
    ok("re-login fixed nick");
  }

  return nick;
}


async function stepCloudSave() {
  const nick = FIXED_NICK || lettersNick();
  let token;
  try {
    const reg = await req("POST", "/auth/register", {
      body: { nick, password: PASS },
      expectStatus: 200,
    });
    token = reg.json.token;
  } catch (e) {
    const login = await req("POST", "/auth/login", {
      body: { nick, password: PASS },
      expectStatus: 200,
    });
    token = login.json.token;
  }

  const empty = await req("GET", "/save", { token, expectStatus: 200 });
  if (!empty.json?.ok) throw new Error("GET /save failed");
  ok("GET /save", empty.json.empty ? "empty" : "has data");

  const deviceA = "d_smoke_a.t_smoke_a1";
  const deviceB = "d_smoke_b.t_smoke_b1";

  const leaseA = await req("POST", "/save/lease", {
    token,
    body: { writerId: deviceA, deviceId: deviceA },
    expectStatus: 200,
  });
  if (!leaseA.json?.ok || !leaseA.json?.lease) throw new Error("lease A failed");
  ok("POST /save/lease", "writer A");

  const leaseBBlocked = await req("POST", "/save/lease", {
    token,
    body: { writerId: deviceB, deviceId: deviceB },
    expectStatus: 423,
  });
  if (!leaseBBlocked.json?.locked) throw new Error("expected 423 for second device");
  ok("lease B blocked → 423");

  const payload = {
    seq: Date.now(),
    savedAt: Date.now(),
    clientVersion: "smoke",
    farmPower: 12,
    writerId: deviceA,
    deviceId: deviceA,
    data: {
      adena: 12345,
      farmZone: "banana_mine",
      avatar: { created: true, name: "SmokeHero", raceId: "human", classId: "fighter", level: 3 },
      characters: [
        {
          id: "c_smoke",
          progress: {
            adena: 12345,
            farmZone: "banana_mine",
            avatar: { created: true, name: "SmokeHero", raceId: "human", classId: "fighter", level: 3 },
            achievements: { unlocked: {}, stats: { gnomesCaught: 7 } },
            totals: { earned: 100, tries: 1, fails: 0 },
            records: {},
          },
        },
      ],
      activeCharacterId: "c_smoke",
      achievements: { unlocked: {}, stats: { gnomesCaught: 7 } },
      totals: { earned: 100, tries: 1, fails: 0 },
      records: {},
    },
  };
  const putBlocked = await req("PUT", "/save", {
    token,
    body: { ...payload, writerId: deviceB, deviceId: deviceB },
    expectStatus: 423,
  });
  if (!putBlocked.json?.locked) throw new Error("PUT without lease should 423");
  ok("PUT from B without lease → 423");

  const put = await req("PUT", "/save", { token, body: payload, expectStatus: 200 });
  if (!put.json?.ok) throw new Error("PUT /save failed");
  ok("PUT /save", `seq=${put.json.seq}`);

  const takeover = await req("POST", "/save/lease", {
    token,
    body: { writerId: deviceB, deviceId: deviceB, takeover: true },
    expectStatus: 200,
  });
  if (!takeover.json?.ok || !takeover.json?.tookOver) throw new Error("takeover failed");
  ok("lease takeover → B");

  const putAStale = await req("PUT", "/save", {
    token,
    body: { ...payload, seq: payload.seq + 1, writerId: deviceA, deviceId: deviceA },
    expectStatus: 423,
  });
  if (!putAStale.json?.locked) throw new Error("A should lose write after takeover");
  ok("PUT from A after takeover → 423");

  const got = await req("GET", "/save", { token, expectStatus: 200 });
  if (got.json?.empty) throw new Error("save still empty after PUT");
  if (got.json?.data?.activeCharacterId !== "c_smoke") throw new Error("bad activeCharacterId");
  ok("GET /save after PUT", got.json.summary?.activeName || "ok");

  await req("POST", "/events", {
    token,
    body: {
      events: [
        {
          event: "enchant_ok",
          characterId: "c_smoke",
          charName: "SmokeHero",
          adena: 12345,
          payload: { weaponId: "test", plus: 4 },
        },
        {
          event: "farm_session",
          characterId: "c_smoke",
          charName: "SmokeHero",
          adena: 12345,
          payload: { kills: 3, adenaGain: 100 },
        },
      ],
    },
    expectStatus: 200,
  });
  ok("POST /events");

  const ev = await req("GET", "/events?characterId=c_smoke&limit=10", {
    token,
    expectStatus: 200,
  });
  if (!ev.json?.ok || !Array.isArray(ev.json.rows) || ev.json.rows.length < 1) {
    throw new Error("events empty");
  }
  ok("GET /events", `${ev.json.rows.length} rows`);

  const bak = await req("GET", "/backups?characterId=c_smoke&limit=5", {
    token,
    expectStatus: 200,
  });
  if (!bak.json?.ok || !Array.isArray(bak.json.rows) || !bak.json.rows.length) {
    throw new Error("backups empty after PUT /save");
  }
  ok("GET /backups", `${bak.json.rows.length} snaps · #${bak.json.rows[0].id}`);

  await req("POST", "/auth/logout", {
    token,
    body: { writerId: deviceB, deviceId: deviceB },
    expectStatus: 200,
  });
}

async function stepNegatives() {
  await req("POST", "/runs", {
    body: { maxPlus: 1 },
    expectStatus: 401,
  });
  ok("runs without token → 401");

  await req("GET", "/save", { expectStatus: 401 });
  ok("GET /save without token → 401");

  await req("POST", "/auth/login", {
    body: { nick: "NoSuchBot", password: "wrongpass1" },
    expectStatus: 401,
  });
  ok("bad login → 401");
}

async function main() {
  console.log(`SoulForge smoke → ${BASE}\n`);
  const steps = [
    ["health", stepHealth],
    ["leaderboards", stepLeaderboards],
    ["admin/enabled", stepAdminEnabled],
    ["auth + runs", stepAuthAndRuns],
    ["cloud save", stepCloudSave],
    ["negatives", stepNegatives],
  ];
  for (const [label, fn] of steps) {
    console.log(`· ${label}`);
    try {
      await fn();
    } catch (e) {
      fail(label, e.message || String(e));
    }
  }
  console.log("");
  if (failed) {
    console.error(`FAIL — ${failed} step group(s) broken`);
    process.exit(1);
  }
  console.log(`OK — ${results.filter((r) => r.ok).length} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
