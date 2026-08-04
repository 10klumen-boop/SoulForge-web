// ===== Unit: zone ambience mapping =====
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadScripts } = require("./setup");

loadScripts([
  "src/data/farm-zones-balance.js",
  "src/data/audio-data.js",
]);

assert.ok(Array.isArray(ZONE_AMB_IDS) && ZONE_AMB_IDS.length >= 30, "ZONE_AMB_IDS");
assert.strictEqual(typeof ZONE_AMB, "object");
assert.strictEqual(typeof resolveZoneAmbienceKey, "function");

ZONE_AMB_IDS.forEach((id) => {
  assert.strictEqual(ZONE_AMB[id], id, "ZONE_AMB " + id);
  assert.ok(AUDIO_FILES.amb[id], "AUDIO_FILES.amb " + id);
  const rel = "assets/sounds/ambient/zones/" + id + ".wav";
  const full = path.join(__dirname, "..", rel);
  assert.ok(fs.existsSync(full), "missing wav " + rel);
});

assert.strictEqual(resolveZoneAmbienceKey("banana_mine"), "banana_mine");
assert.strictEqual(resolveZoneAmbienceKey("blazing_swamp"), "blazing_swamp");
assert.strictEqual(resolveZoneAmbienceKey("no_such_zone_xyz"), ZONE_AMB_FALLBACK);
assert.strictEqual(resolveZoneAmbienceKey(null), ZONE_AMB_FALLBACK);

const hitPool = AUDIO_FILES.sfx.mineHit;
assert.ok(Array.isArray(hitPool) && hitPool.length >= 5, "mineHit pool");
hitPool.forEach((src) => {
  const file = String(src).split("?")[0];
  assert.ok(fs.existsSync(path.join(__dirname, "..", file)), "missing hit " + file);
});
assert.ok(fs.existsSync(path.join(__dirname, "..", String(AUDIO_FILES.sfx.mineKill).split("?")[0])));

console.log("zone-ambience: ok (" + ZONE_AMB_IDS.length + " zones)");
