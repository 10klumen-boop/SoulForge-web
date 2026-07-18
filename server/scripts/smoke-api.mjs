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
  for (const mode of ["enchant", "power", "wealth"]) {
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
      maxPlus: 1,
      farmPower: 1,
      earned: 1,
      adena: 1,
      clientVersion: "smoke",
    },
    expectStatus: 200,
  });
  ok("runs (tiny upsert)");

  const board = await req("GET", "/leaderboard/enchant?limit=100", {
    expectStatus: 200,
  });
  const hit = Array.isArray(board.json)
    ? board.json.find((r) => r.name === nick)
    : null;
  if (!hit) {
    // may be outside top 100 — still OK if runs succeeded
    ok("leaderboard has bot", "not in top 100 (ok)");
  } else {
    ok("leaderboard has bot", `rank=${hit.rank} maxPlus=${hit.maxPlus}`);
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

async function stepNegatives() {
  await req("POST", "/runs", {
    body: { maxPlus: 1 },
    expectStatus: 401,
  });
  ok("runs without token → 401");

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
