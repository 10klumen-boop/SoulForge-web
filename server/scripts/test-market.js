"use strict";

/**
 * Market escrow unit tests (in-memory temp SQLite).
 *   node scripts/test-market.mjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSqliteStore } = require("../db/sqlite");
const { sellerPayout, MARKET_MIN_PRICE } = require("../db/market");

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log("  ✓ " + name);
  else {
    failed += 1;
    console.error("  ✗ " + name + (detail ? " — " + detail : ""));
  }
}

function makeSave(adena, inv, extra) {
  extra = extra || {};
  return {
    activeCharacterId: "c1",
    characters: [
      {
        id: "c1",
        progress: {
          avatar: { created: true, name: "Hero", level: 5, gear: {} },
          adena,
          inventory: inv || [],
          crystals: Object.assign({ D: 10, C: 0, B: 0, A: 0 }, extra.crystals || {}),
          materials: Object.assign({ soul: 5, spirit: 0 }, extra.materials || {}),
          shots: {
            soul: Object.assign({ D: 3, C: 0, B: 0, A: 0 }, extra.soulShots || {}),
            spirit: { D: 0, C: 0, B: 0, A: 0 },
          },
          totals: { tries: 0, fails: 0, earned: 0 },
        },
      },
    ],
  };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-market-test-"));
const store = createSqliteStore({ dataDir: dir, dbPath: path.join(dir, "t.db") });
const now = Date.now();
const seller = { id: store.insertUser("Seller", "hashhashhash", now).id, nick: "Seller" };
const buyer = { id: store.insertUser("Buyerx", "hashhashhash", now).id, nick: "Buyerx" };

store.persistPlayerSave(
  seller,
  1,
  now,
  "0.42",
  makeSave(100000, [{ uid: "i1", id: "sword_d", plus: 5, spent: 1000 }])
);
store.persistPlayerSave(buyer, 1, now, "0.42", makeSave(500000, []));

console.log("\n--- market escrow ---");

ok("sellerPayout 5%", sellerPayout(5000) === 4750, String(sellerPayout(5000)));

const listed = store.marketCreateListing(
  seller,
  { characterId: "c1", kind: "weapon", uid: "i1", priceAdena: 5000 },
  now
);
ok("list weapon", listed.ok === true, listed.error);
ok("inventory emptied", listed.data?.characters[0].progress.inventory.length === 0);

const own = store.marketBuyListing(seller, listed.listing.id, { characterId: "c1" }, now + 1);
ok("reject own buy", own.ok === false);

store.persistPlayerSave(buyer, 2, now + 1, "0.42", makeSave(100, []));
const poor2 = store.marketBuyListing(buyer, listed.listing.id, { characterId: "c1" }, now + 2);
ok("reject insufficient adena", poor2.ok === false && /аден/i.test(poor2.error || ""), poor2.error);

store.persistPlayerSave(buyer, 3, now + 3, "0.42", makeSave(500000, []));
const buy = store.marketBuyListing(buyer, listed.listing.id, { characterId: "c1" }, now + 4);
ok("buy ok", buy.ok === true, buy.error);
ok("buyer paid", !!(buy.buyer && buy.buyer.data.characters[0].progress.adena === 495000));
ok(
  "buyer got weapon",
  !!(buy.buyer && buy.buyer.data.characters[0].progress.inventory.some((x) => x.uid === "i1"))
);
const sellerAdena = JSON.parse(store.getSave(seller.id).payload).characters[0].progress.adena;
ok("seller got payout", sellerAdena === 104750, String(sellerAdena));

const dbl = store.marketBuyListing(buyer, listed.listing.id, { characterId: "c1" }, now + 5);
ok("reject double buy", dbl.ok === false);

const lowPrice = store.marketCreateListing(
  seller,
  { characterId: "c1", kind: "crystal", grade: "D", qty: 1, priceAdena: MARKET_MIN_PRICE - 1 },
  now + 6
);
ok("reject low price", lowPrice.ok === false);

const crystal = store.marketCreateListing(
  seller,
  { characterId: "c1", kind: "crystal", grade: "D", qty: 2, priceAdena: 2000 },
  now + 7
);
ok("list crystal", crystal.ok === true, crystal.error);
ok("crystal stock", crystal.data.characters[0].progress.crystals.D === 8);

const cancel = store.marketCancelListing(seller, crystal.listing.id, { characterId: "c1" }, now + 8);
ok("cancel returns crystals", cancel.ok && cancel.data.characters[0].progress.crystals.D === 10);

const catalog = store.marketListListings({ now: now + 9 });
ok("catalog empty after sells", (catalog.rows || []).length === 0);

const starterBlock = (() => {
  store.persistPlayerSave(
    seller,
    (store.getSave(seller.id).seq || 1) + 1,
    now + 10,
    "0.42",
    makeSave(100000, [{ uid: "s1", id: "sword_d", plus: 0, spent: 0, starter: true }])
  );
  return store.marketCreateListing(
    seller,
    { characterId: "c1", kind: "weapon", uid: "s1", priceAdena: 2000 },
    now + 11
  );
})();
ok("reject starter", starterBlock.ok === false);

console.log(failed ? `\nFAILED: ${failed}` : "\nAll market tests passed.");
try {
  fs.rmSync(dir, { recursive: true, force: true });
} catch (_) {}
process.exit(failed ? 1 : 0);
