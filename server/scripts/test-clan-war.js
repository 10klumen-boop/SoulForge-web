"use strict";

/**
 * Smoke: clan war helpers (siege window, power, bid cost).
 * Run: node server/scripts/test-clan-war.js
 */
const assert = require("assert");
const {
  warTierOf,
  isEliteWar,
  isFlagship,
  siegeWindow,
  bidCostFor,
  computeSiegePower,
  DEFENDER_BONUS_PCT,
  WEEK_TASK,
} = require("../db/clan-war");

assert.strictEqual(warTierOf({ warTier: "flagship" }), "flagship");
assert.ok(isEliteWar({ warTier: "elite" }));
assert.ok(isFlagship({ warTier: "flagship" }));
assert.ok(!isFlagship({ warTier: "elite" }));
assert.ok(DEFENDER_BONUS_PCT >= 0.25);
assert.ok(WEEK_TASK.sealsTarget > 0);

const meta = {
  warTier: "elite",
  siegeSlotUtc: "sat_18",
  rentPerDay: 50000,
};
const win = siegeWindow(meta, Date.UTC(2026, 7, 1, 12, 0, 0)); // Sat Aug 1 2026 12:00
assert.ok(win);
assert.strictEqual(win.slotId, "sat_18");
assert.ok(win.startAt < win.endAt);
// Test schedule: every 2h, open 1h (aligned to UTC epoch)
if (require("../db/clan-war").CLAN_SIEGE_DAILY_TEST) {
  assert.strictEqual(win.open, true);
  assert.strictEqual(new Date(win.startAt).getUTCHours(), 12);
  assert.strictEqual(win.endAt - win.startAt, 60 * 60 * 1000);
  const closed = siegeWindow(meta, Date.UTC(2026, 7, 1, 13, 30, 0));
  assert.ok(closed);
  assert.strictEqual(closed.open, false);
  assert.strictEqual(new Date(closed.startAt).getUTCHours(), 14);
  const { siegeClosedSlotStart, siegePeriodMs } = require("../db/clan-war");
  // В «закрытой» половине слот к resolve = предыдущее окно (12:00), не следующее (14:00)
  const toResolve = siegeClosedSlotStart(meta, Date.UTC(2026, 7, 1, 13, 30, 0));
  assert.strictEqual(toResolve, closed.startAt - siegePeriodMs());
  assert.strictEqual(new Date(toResolve).getUTCHours(), 12);
}

const cost = bidCostFor(meta);
assert.ok(cost >= 5_000_000);

const power = computeSiegePower({
  memberCount: 5,
  professions: [
    { tier: 2, role: "tank" },
    { tier: 1, role: "mage" },
  ],
  weekDepositAdena: 400000,
  weekScore: 200,
});
assert.ok(power.total > 0);
assert.ok(power.members === 5);

console.log("test-clan-war: ok");
