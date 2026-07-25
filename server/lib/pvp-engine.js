"use strict";

/**
 * Загрузка клиентского PvP-движка в Node (simulateDuel / resolveRound).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let _ctx = null;

function loadPvpEngine() {
  if (_ctx) return _ctx;
  const gameRoot = path.join(__dirname, "..", "..", "game");
  const files = [
    path.join(gameRoot, "src/data/combat-skills-data.js"),
    path.join(gameRoot, "src/data/pvp-balance.js"),
    path.join(gameRoot, "src/pvp-combat-core.js"),
  ];
  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    isMysticArchetype(classId) {
      return classId === "mystic" || classId === "shaman";
    },
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  const code = files.map((f) => fs.readFileSync(f, "utf8")).join("\n;\n");
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "pvp-engine-bundle.js" });
  _ctx = sandbox;
  return _ctx;
}

function sanitizeSheet(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sheet = {
    name: String(raw.name || "Боец").slice(0, 48),
    level: Math.max(1, Math.min(99, Number(raw.level) || 1)),
    raceId: String(raw.raceId || "human").slice(0, 24),
    classId: String(raw.classId || "fighter").slice(0, 24),
    professionId: raw.professionId ? String(raw.professionId).slice(0, 48) : null,
    atkType: raw.atkType === "magical" ? "magical" : "physical",
    patk: Math.max(0, Math.min(50000, Math.round(Number(raw.patk) || 0))),
    matk: Math.max(0, Math.min(50000, Math.round(Number(raw.matk) || 0))),
    pdef: Math.max(0, Math.min(50000, Math.round(Number(raw.pdef) || 0))),
    mdef: Math.max(0, Math.min(50000, Math.round(Number(raw.mdef) || 0))),
    hpMax: Math.max(50, Math.min(200000, Math.round(Number(raw.hpMax) || 220))),
    shotArmed: !!raw.shotArmed,
    weaponId: raw.weaponId ? String(raw.weaponId).slice(0, 80) : null,
    weaponPlus: Math.max(0, Math.min(20, Math.round(Number(raw.weaponPlus) || 0))),
    skills: Array.isArray(raw.skills)
      ? raw.skills.slice(0, 8).map((s) => ({
          id: String(s.id || "").slice(0, 48),
          name: String(s.name || s.id || "").slice(0, 64),
          icon: s.icon ? String(s.icon).slice(0, 160) : "",
          hotkey: s.hotkey ? String(s.hotkey).slice(0, 4) : "",
          unlockLevel: Math.max(1, Number(s.unlockLevel) || 1),
          farmEffect: s.farmEffect ? String(s.farmEffect).slice(0, 32) : "",
          pvpEffect: String(s.pvpEffect || "directHit").slice(0, 32),
          mult: Number(s.mult) || 1,
          hits: Math.max(1, Math.min(8, Number(s.hits) || 1)),
          buffRounds: Math.max(0, Math.min(8, Number(s.buffRounds) || 0)),
          debuffMult: Number(s.debuffMult) || 0.7,
          debuffRounds: Math.max(0, Math.min(8, Number(s.debuffRounds) || 0)),
          healFrac: Number(s.healFrac) || 0.15,
          cdRounds: Math.max(1, Math.min(10, Number(s.cdRounds) || 2)),
          fxColor: s.fxColor ? String(s.fxColor).slice(0, 24) : "",
        }))
      : [],
    passiveIds: Array.isArray(raw.passiveIds)
      ? raw.passiveIds.slice(0, 24).map((id) => String(id).slice(0, 48))
      : [],
    critChance: Math.max(0, Math.min(1, Number(raw.critChance) || 0)),
    atkMult: Math.max(0.5, Math.min(3, Number(raw.atkMult) || 1)),
    defMult: Math.max(0.5, Math.min(3, Number(raw.defMult) || 1)),
  };
  if (!sheet.skills.length) {
    // минимальный набор, если клиент не прислал скиллы
    const eng = loadPvpEngine();
    sheet.skills = eng.pvpSkillsForAvatar(
      { classId: sheet.classId, level: sheet.level },
      sheet.level
    );
  }
  return sheet;
}

function sheetPower(sheet) {
  if (!sheet) return 0;
  const atk = sheet.atkType === "magical" ? sheet.matk : sheet.patk;
  return Math.round(atk + (sheet.pdef + sheet.mdef) * 0.5 + sheet.hpMax * 0.05);
}

function runSimulateDuel(sheetA, sheetB, seed) {
  const eng = loadPvpEngine();
  return eng.simulateDuel(sheetA, sheetB, { seed: seed || 1 });
}

function createMatchRuntime(sheetA, sheetB, seed) {
  const eng = loadPvpEngine();
  return {
    seed: seed || 1,
    rngState: null,
    round: 0,
    fighterA: eng.pvpCreateFighter(sheetA),
    fighterB: eng.pvpCreateFighter(sheetB),
    pendingA: null,
    pendingB: null,
    log: [],
    winner: null,
  };
}

/** Детерминированный шаг RNG: храним seed+counter в runtime. */
function nextRng(runtime) {
  const eng = loadPvpEngine();
  runtime._rngCounter = (runtime._rngCounter || 0) + 1;
  const rng = eng.pvpRng((runtime.seed || 1) + runtime._rngCounter * 9973);
  return rng;
}

function applyRound(runtime, actionA, actionB) {
  const eng = loadPvpEngine();
  runtime.round += 1;
  const rng = nextRng(runtime);
  const result = eng.resolveRound(
    runtime.fighterA,
    runtime.fighterB,
    actionA || { type: "attack" },
    actionB || { type: "attack" },
    rng
  );
  runtime.log.push({
    round: runtime.round,
    actionA,
    actionB,
    events: result.events,
    hpA: result.hpA,
    hpB: result.hpB,
  });
  runtime.pendingA = null;
  runtime.pendingB = null;

  const maxR = typeof eng.PVP_MAX_ROUNDS === "number" ? eng.PVP_MAX_ROUNDS : 20;
  if (result.deadA || result.deadB || runtime.round >= maxR) {
    let winner = "draw";
    if (result.deadA && !result.deadB) winner = "b";
    else if (result.deadB && !result.deadA) winner = "a";
    else if (!result.deadA && !result.deadB) {
      const pctA = runtime.fighterA.hp / runtime.fighterA.sheet.hpMax;
      const pctB = runtime.fighterB.hp / runtime.fighterB.sheet.hpMax;
      if (pctA > pctB + 0.001) winner = "a";
      else if (pctB > pctA + 0.001) winner = "b";
    }
    runtime.winner = winner;
  }
  return runtime;
}

function aiAction(runtime, side) {
  const eng = loadPvpEngine();
  const self = side === "a" ? runtime.fighterA : runtime.fighterB;
  const enemy = side === "a" ? runtime.fighterB : runtime.fighterA;
  const rng = nextRng(runtime);
  return eng.pvpAiChooseAction(self, enemy, rng);
}

function publicMatchView(runtime, sheetA, sheetB, meta) {
  return {
    round: runtime.round,
    maxRounds: 20,
    hpA: runtime.fighterA.hp,
    hpB: runtime.fighterB.hp,
    hpMaxA: sheetA.hpMax,
    hpMaxB: sheetB.hpMax,
    cdsA: runtime.fighterA.cds,
    cdsB: runtime.fighterB.cds,
    buffsA: {
      damageRounds: runtime.fighterA.buffs.damageRounds,
      nextHitMult: runtime.fighterA.buffs.nextHitMult,
      atkDebuffRounds: runtime.fighterA.buffs.atkDebuffRounds,
    },
    buffsB: {
      damageRounds: runtime.fighterB.buffs.damageRounds,
      nextHitMult: runtime.fighterB.buffs.nextHitMult,
      atkDebuffRounds: runtime.fighterB.buffs.atkDebuffRounds,
    },
    pendingA: !!runtime.pendingA,
    pendingB: !!runtime.pendingB,
    log: runtime.log.slice(-40),
    winner: runtime.winner,
    sheetA: { name: sheetA.name, level: sheetA.level, atkType: sheetA.atkType, skills: sheetA.skills },
    sheetB: { name: sheetB.name, level: sheetB.level, atkType: sheetB.atkType, skills: sheetB.skills },
    meta: meta || null,
  };
}

module.exports = {
  loadPvpEngine,
  sanitizeSheet,
  sheetPower,
  runSimulateDuel,
  createMatchRuntime,
  applyRound,
  aiAction,
  publicMatchView,
};
