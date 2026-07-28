// ===== Unit: L2BaseMap CRS for clan map F0 =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts(["src/data/clan-territories-data.js"]);

assert.ok(CLAN_MAP_CRS.mapW === 1812);
assert.ok(CLAN_MAP_CRS.overviewSrc.includes("aden-overview"));

const g = clanMapWorldToPct(-12728, 122726);
assert.ok(Math.abs(g.x - 32.8) < 0.2, "gludio x " + g.x);
assert.ok(Math.abs(g.y - 73.4) < 0.2, "gludio y " + g.y);

const w = clanTerritoryById("wasteland");
assert.ok(w && w.x > 0 && w.y > 0);
assert.ok(w.portrait);

const eg = clanTerritoryById("execution_grounds");
assert.ok(eg.siegeEnabled);

console.log("clan-map-crs: ok");
