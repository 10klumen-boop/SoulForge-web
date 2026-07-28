// ===== Unit: Z2 clan territory holder (online only, mock claim) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts([
  "src/data/farm-zones-balance.js",
  "src/data/clan-territories-data.js",
]);

global.chatSocial = { clan: null, party: null };
global.clanMyRole = () => null;

// Neutral → no bonus
assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 0);
assert.strictEqual(clanTerritoryAdenaBonusPct("scrap_field"), 0); // alias

chatSocial.clan = { id: "c1", name: "Iron" };
clanMyRole = () => "leader";

const claim = claimClanTerritoryMock("wasteland");
assert.strictEqual(claim.ok, true, claim.message);
assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 4);
assert.strictEqual(clanTerritoryAdenaBonusPct("scrap_field"), 4);

// Other clan — no bonus
chatSocial.clan = { id: "c2", name: "Other" };
assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 0);
const st = clanTerritoryStatusForZone("wasteland");
assert.strictEqual(st.holder.clanName, "Iron");
assert.strictEqual(st.isMyClan, false);
assert.ok(st.lineShort.includes("Iron"));

// Cap 2 farm
chatSocial.clan = { id: "c1", name: "Iron" };
assert.strictEqual(claimClanTerritoryMock("execution_grounds").ok, true);
assert.strictEqual(clanTerritoryAdenaBonusPct("execution_grounds"), 5);
// Города — хабы без claim в MVP
assert.strictEqual(claimClanTerritoryMock("gludio").ok, false);
assert.strictEqual(claimClanTerritoryMock("dion").ok, false);

// Release
assert.strictEqual(releaseClanTerritoryMock("wasteland").ok, true);
assert.strictEqual(clanTerritoryAdenaBonusPct("wasteland"), 0);

// Passive path must not call mineApplyClanTerritoryAdena — just ensure helper stays zone-scoped
assert.strictEqual(typeof mineApplyClanTerritoryAdena, "undefined");

console.log("clan-territory-holder: ok");
