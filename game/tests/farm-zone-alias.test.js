// ===== Unit: farm zone aliases Gate0 =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts([
  "src/data/farm-zones-balance.js",
]);

assert.strictEqual(resolveFarmZoneId("scrap_field"), "wasteland");
assert.strictEqual(resolveFarmZoneId("mithril_forge"), "abandoned_coal_low");
assert.strictEqual(resolveFarmZoneId("wasteland"), "wasteland");
assert.ok(CLAN_SIEGE_MVP_IDS.includes("wasteland"));
assert.ok(CLAN_SIEGE_MVP_IDS.includes("execution_grounds"));
assert.strictEqual(HUNTING_GRADUATION_LEVEL, 10);

console.log("farm-zone-alias: ok");
