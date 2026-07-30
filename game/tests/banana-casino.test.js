// ===== Unit-тесты: banana-casino-core.js =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.FARM_ZONES = [{ id: "banana_mine", active: true, chapter: 1 }];
global.farmZoneById = (id) => global.FARM_ZONES.find((z) => z.id === id) || global.FARM_ZONES[0];
global.toast = () => {};
global.save = () => {};
global.$ = () => ({ textContent: "" });
global.Audio2 = { success: () => {}, click: () => {}, jackpot: () => {}, charge: () => {}, treasure: () => {} };
global.fmt = (n) => String(n);
global.fmtAdena = (n) => String(n);
global.ProgressStore = {
  set: (k, v) => { global.state[k] = JSON.parse(JSON.stringify(v)); },
  update: (k, fn) => { global.state[k] = fn(global.state[k]); },
  get: (k) => global.state[k],
};
global.state = {
  adena: 100_000_000,
  farmZone: "banana_mine",
  bananaCasino: null,
  materials: { soul: 0, spirit: 0 },
  inventory: [],
  totals: { tries: 0, fails: 0, earned: 0 },
};
global.tune = (k, fb) => fb;
global.tuneInt = (k, fb) => fb;
global.COLLECTIBLES = {
  banana_lucky_charm: {
    id: "banana_lucky_charm",
    name: "Талисман Банана",
    icon: "icons/banana_lucky_charm.png",
    epic: true,
    slot: "ring",
  },
};
global.grantCollectible = (id) => {
  global.state.inventory.push({ uid: "c1", id, kind: "accessory" });
  return global.COLLECTIBLES[id];
};
global.addScroll = (target, typeId, grade, qty) => {
  global._lastScroll = { target, typeId, grade, qty };
  return true;
};
global.scrollDropGradeForZone = () => "D";
global.scrollTierIcon = (typeId, grade, target) =>
  "icons/scrolls/" + (target === "armor" ? "armor_" : "") + typeId + "_" + grade + ".png";
global.checkAchievements = () => {};
global.ensureWorkshopState = () => {};

loadScripts([
  "src/data/banana-casino-balance.js",
  "src/banana-casino-core.js",
]);

function runTests() {
  let passed = 0;
  let failed = 0;
  function test(name, fn) {
    try { fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { failed++; console.error("  ✗ " + name); console.error("    " + e.message); }
  }

  console.log("\n--- banana casino ---");

  test("defaultBananaCasinoState shape", () => {
    const d = defaultBananaCasinoState();
    assert.strictEqual(d.tokens, 0);
    assert.ok(Array.isArray(d.history));
  });

  test("ensureBananaCasinoState initializes ProgressStore key", () => {
    state.bananaCasino = null;
    ensureBananaCasinoState();
    assert.ok(state.bananaCasino);
    assert.strictEqual(state.bananaCasino.tokens, 0);
  });

  test("buyTokenPack spends adena and grants tokens", () => {
    state.adena = 100_000_000;
    state.bananaCasino = defaultBananaCasinoState();
    const r = buyBananaCasinoTokenPack("x1");
    assert.strictEqual(r.ok, true);
    assert.strictEqual(state.bananaCasino.tokens, 1);
    assert.strictEqual(state.adena, 100_000_000 - 50_000_000);
  });

  test("buy x10 pack", () => {
    state.adena = 500_000_000;
    state.bananaCasino = defaultBananaCasinoState();
    const r = buyBananaCasinoTokenPack("x10");
    assert.strictEqual(r.ok, true);
    assert.strictEqual(state.bananaCasino.tokens, 10);
    assert.strictEqual(state.adena, 500_000_000 - 450_000_000);
  });

  test("pack price is static", () => {
    global.mineProgressAdenaScale = () => 9;
    const pack = bananaCasinoTokenPackById("x1");
    assert.strictEqual(bananaCasinoPackPrice(pack), 50_000_000);
    assert.strictEqual(bananaCasinoPackPrice(bananaCasinoTokenPackById("x10")), 450_000_000);
    delete global.mineProgressAdenaScale;
  });

  test("spin without tokens fails", () => {
    state.bananaCasino = defaultBananaCasinoState();
    const r = spinBananaCasino(1);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, "no_tokens");
  });

  test("common is soul or spirit ore, never adena/weapon", () => {
    const soul = buildCasinoLoot("common", () => 0);
    assert.strictEqual(soul.kind, "ore");
    assert.strictEqual(soul.oreId, "soul");
    assert.ok(soul.qty >= 6 && soul.qty <= 14);
    const spirit = buildCasinoLoot("common", () => 0.6);
    assert.strictEqual(spirit.kind, "ore");
    assert.strictEqual(spirit.oreId, "spirit");
  });

  test("uncommon is crystal D scroll", () => {
    const loot = buildCasinoLoot("uncommon", () => 0);
    assert.strictEqual(loot.kind, "scroll");
    assert.strictEqual(loot.typeId, "crystal");
    assert.strictEqual(loot.grade, "D");
    assert.ok(loot.target === "armor" || loot.target === "weapon");
  });

  test("rare is crystal armor scroll C", () => {
    const loot = buildCasinoLoot("rare", () => 0);
    assert.strictEqual(loot.kind, "scroll");
    assert.strictEqual(loot.typeId, "crystal");
    assert.strictEqual(loot.target, "armor");
    assert.strictEqual(loot.grade, "C");
  });

  test("epic is crystal weapon scroll C", () => {
    const loot = buildCasinoLoot("epic", () => 0);
    assert.strictEqual(loot.kind, "scroll");
    assert.strictEqual(loot.typeId, "crystal");
    assert.strictEqual(loot.target, "weapon");
    assert.strictEqual(loot.grade, "C");
  });

  test("jackpot is always charm", () => {
    const loot = buildCasinoLoot("jackpot", () => 0.99);
    assert.strictEqual(loot.kind, "charm");
    assert.strictEqual(loot.collectibleId, "banana_lucky_charm");
  });

  test("spin grants ore via ProgressStore", () => {
    state.bananaCasino = { ...defaultBananaCasinoState(), tokens: 2 };
    state.materials = { soul: 0, spirit: 0 };
    const r = spinBananaCasino(1, () => 0);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.results[0].loot.kind, "ore");
    assert.ok((state.materials.soul || 0) > 0);
  });

  test("pity forces rare crystal scroll", () => {
    state.bananaCasino = {
      ...defaultBananaCasinoState(),
      pity: BANANA_CASINO.pityRare,
      pityJackpot: 0,
    };
    const loot = rollCasinoLoot(state.bananaCasino, () => 0.99);
    assert.strictEqual(loot.tier, "rare");
    assert.strictEqual(loot.typeId, "crystal");
  });

  test("pityJackpot forces jackpot charm", () => {
    state.bananaCasino = {
      ...defaultBananaCasinoState(),
      pityJackpot: BANANA_CASINO.pityJackpot,
    };
    const loot = rollCasinoLoot(state.bananaCasino, () => 0);
    assert.strictEqual(loot.tier, "jackpot");
    assert.strictEqual(loot.kind, "charm");
  });

  test("jackpot resets rare and jackpot pity bars", () => {
    state.inventory = [];
    state.bananaCasino = {
      ...defaultBananaCasinoState(),
      tokens: 1,
      pity: 40,
      pityJackpot: BANANA_CASINO.pityJackpot,
    };
    const r = spinBananaCasino(1, () => 0);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.results[0].tier, "jackpot");
    assert.strictEqual(state.bananaCasino.pity, 0, "rare pity reset");
    assert.strictEqual(state.bananaCasino.pityJackpot, 0, "jackpot pity reset");
    assert.ok((state.bananaCasino.jackpots || 0) >= 1);
  });

  test("grantCasinoLoot charm", () => {
    state.inventory = [];
    const res = grantCasinoLoot({
      kind: "charm",
      collectibleId: "banana_lucky_charm",
      label: "Талисман Банана",
    });
    assert.strictEqual(res.ok, true);
    assert.ok(state.inventory.some((it) => it.id === "banana_lucky_charm"));
  });

  test("×10 spin spends 10 tokens", () => {
    state.bananaCasino = { ...defaultBananaCasinoState(), tokens: 12 };
    state.materials = { soul: 0, spirit: 0 };
    const r = spinBananaCasino(10, () => 0);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.results.length, 10);
    assert.strictEqual(state.bananaCasino.tokens, 2);
  });

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

runTests();
