// ===== Unit: clan territory holder + war tiers / XP edge =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts([
  "src/data/farm-zones-balance.js",
  "src/data/clan-territories-data.js",
]);

global.chatSocial = { clan: null, party: null };
global.clanMyRole = () => null;

assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 0);
assert.strictEqual(clanTerritoryAdenaBonusPct("scrap_field"), 0);

chatSocial.clan = { id: "c1", name: "Iron" };
clanMyRole = () => "leader";

const claim = claimClanTerritoryMock("wasteland");
assert.strictEqual(claim.ok, true, claim.message);
assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 9);
assert.strictEqual(clanTerritoryXpBonusPct("wasteland"), 3);
assert.strictEqual(clanTerritoryAdenaBonusPct("scrap_field"), 9);
assert.strictEqual(clanTerritoryWarTier(clanTerritoryById("wasteland")), "elite");
assert.strictEqual(clanTerritoryWarTier(clanTerritoryById("blazing_swamp")), "flagship");
assert.strictEqual(clanTerritoryIsFlagship(clanTerritoryById("execution_grounds")), true);
assert.ok(clanTerritoryIsEliteWar(clanTerritoryById("ant_nest")));
assert.strictEqual(clanTerritoryWarTier(clanTerritoryById("school_of_dark_arts")), "normal");

chatSocial.clan = { id: "c2", name: "Other" };
assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 0);
const st = clanTerritoryStatusForZone("wasteland");
assert.strictEqual(st.holder.clanName, "Iron");
assert.strictEqual(st.isMyClan, false);
assert.ok(st.lineShort.includes("Iron"));
assert.ok(String(st.lineMeta).includes("Чужое"));

chatSocial.clan = { id: "c1", name: "Iron" };
assert.strictEqual(claimClanTerritoryMock("execution_grounds").ok, true);
assert.strictEqual(clanTerritoryAdenaBonusPct("execution_grounds"), 11);
assert.strictEqual(claimClanTerritoryMock("gludio").ok, false);
assert.strictEqual(claimClanTerritoryMock("dion").ok, false);

assert.strictEqual(releaseClanTerritoryMock("wasteland").ok, true);
assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 0);

const win = clanSiegeWindowForTerritory(clanTerritoryById("blazing_swamp"), Date.now());
assert.ok(win);
assert.ok(win.labelRu);
assert.ok(typeof win.open === "boolean");

assert.strictEqual(typeof mineApplyClanTerritoryAdena, "undefined");

console.log("clan-territory-holder: ok");
