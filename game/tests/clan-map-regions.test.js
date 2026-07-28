// ===== Unit: Aden map regions (cleared baseline) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts(["src/data/clan-map-regions-data.js"]);

assert.ok(Array.isArray(CLAN_MAP_REGIONS), "regions array");
assert.strictEqual(CLAN_MAP_REGIONS.length, 0, "map cleared — no stock regions");
assert.ok(Array.isArray(CLAN_MAP_ROUTES), "routes array");
assert.strictEqual(CLAN_MAP_ROUTES.length, 0, "no stock routes");
assert.strictEqual(clanMapRegionAtPct(50, 50), null, "empty hit-test");
assert.ok(typeof clanMapPolyToSmoothPath === "function", "smooth helper");
assert.strictEqual(
  clanMapPointInPoly(5, 5, [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]),
  true
);

console.log("clan-map-regions: ok (cleared)");
