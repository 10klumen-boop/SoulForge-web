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
          avatar: { created: true, name: extra.name || "Hero", level: 5, gear: {} },
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
  makeSave(100000, [{ uid: "i1", id: "sword_d", plus: 5, spent: 1000 }], { name: "SellerHero" })
);
store.persistPlayerSave(buyer, 1, now, "0.42", makeSave(500000, [], { name: "BuyerHero" }));

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

store.persistPlayerSave(buyer, 2, now + 1, "0.42", makeSave(100, [], { name: "BuyerHero" }));
const poor2 = store.marketBuyListing(buyer, listed.listing.id, { characterId: "c1" }, now + 2);
ok("reject insufficient adena", poor2.ok === false && /аден/i.test(poor2.error || ""), poor2.error);

store.persistPlayerSave(buyer, 3, now + 3, "0.42", makeSave(500000, [], { name: "BuyerHero" }));
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
    makeSave(100000, [{ uid: "s1", id: "sword_d", plus: 0, spent: 0, starter: true }], { name: "SellerHero" })
  );
  return store.marketCreateListing(
    seller,
    { characterId: "c1", kind: "weapon", uid: "s1", priceAdena: 2000 },
    now + 11
  );
})();
ok("reject starter", starterBlock.ok === false);

console.log("\n--- market armor / pieces ---");

store.persistPlayerSave(
  seller,
  (store.getSave(seller.id).seq || 1) + 1,
  now + 20,
  "0.42",
  makeSave(
    100000,
    [{ uid: "arm1", id: "bone_helmet", kind: "armor" }],
    { name: "SellerHero", materials: { soul: 5, spirit: 0, bone_helmet_piece: 7 } }
  )
);
const armorList = store.marketCreateListing(
  seller,
  { characterId: "c1", kind: "armor", uid: "arm1", priceAdena: 3000 },
  now + 21
);
ok("list armor", armorList.ok === true, armorList.error);
ok("armor left inv", armorList.data?.characters[0].progress.inventory.length === 0);

store.persistPlayerSave(buyer, (store.getSave(buyer.id).seq || 1) + 1, now + 22, "0.42", makeSave(500000, [], { name: "BuyerHero" }));
const armorBuy = store.marketBuyListing(buyer, armorList.listing.id, { characterId: "c1" }, now + 23);
ok("buy armor", armorBuy.ok === true, armorBuy.error);
ok(
  "buyer got armor",
  !!(
    armorBuy.buyer &&
    armorBuy.buyer.data.characters[0].progress.inventory.some(
      (x) => x.uid === "arm1" && x.kind === "armor"
    )
  )
);

const pieceList = store.marketCreateListing(
  seller,
  { characterId: "c1", kind: "armor_piece", fragId: "bone_helmet_piece", qty: 3, priceAdena: 2500 },
  now + 24
);
ok("list armor_piece", pieceList.ok === true, pieceList.error);
ok(
  "piece stock",
  pieceList.data.characters[0].progress.materials.bone_helmet_piece === 4,
  String(pieceList.data?.characters[0].progress.materials.bone_helmet_piece)
);

const pieceCancel = store.marketCancelListing(seller, pieceList.listing.id, { characterId: "c1" }, now + 25);
ok(
  "cancel returns pieces",
  pieceCancel.ok && pieceCancel.data.characters[0].progress.materials.bone_helmet_piece === 7
);

const badPiece = store.marketCreateListing(
  seller,
  { characterId: "c1", kind: "armor_piece", fragId: "soul", qty: 1, priceAdena: 2000 },
  now + 26
);
ok("reject ore as armor_piece", badPiece.ok === false);

const equippedBlock = (() => {
  const payload = makeSave(100000, [{ uid: "arm2", id: "bone_helmet", kind: "armor" }], { name: "SellerHero" });
  payload.characters[0].progress.avatar.gear = { helmet: { uid: "arm2", id: "bone_helmet", kind: "armor" } };
  store.persistPlayerSave(seller, (store.getSave(seller.id).seq || 1) + 1, now + 28, "0.42", payload);
  return store.marketCreateListing(
    seller,
    { characterId: "c1", kind: "armor", uid: "arm2", priceAdena: 3000 },
    now + 29
  );
})();
ok("reject equipped armor", equippedBlock.ok === false);

console.log("\n--- market accessory (jewelry) ---");

store.persistPlayerSave(
  seller,
  (store.getSave(seller.id).seq || 1) + 1,
  now + 30,
  "0.42",
  makeSave(100000, [{ uid: "jew1", id: "zaken_earring", kind: "accessory", plus: 12, spent: 999 }], { name: "SellerHero" })
);
const accList = store.marketCreateListing(
  seller,
  { characterId: "c1", kind: "accessory", uid: "jew1", priceAdena: 5000 },
  now + 31
);
ok("list accessory", accList.ok === true, accList.error);
ok("accessory left inv", accList.data?.characters[0].progress.inventory.length === 0);
ok("listing keeps plus", accList.listing?.item?.plus === 12, JSON.stringify(accList.listing?.item));

store.persistPlayerSave(buyer, (store.getSave(buyer.id).seq || 1) + 1, now + 32, "0.42", makeSave(500000, [], { name: "BuyerHero" }));
const accBuy = store.marketBuyListing(buyer, accList.listing.id, { characterId: "c1" }, now + 33);
ok("buy accessory", accBuy.ok === true, accBuy.error);
ok(
  "buyer got accessory",
  !!(
    accBuy.buyer &&
    accBuy.buyer.data.characters[0].progress.inventory.some(
      (x) => x.uid === "jew1" && x.kind === "accessory" && x.id === "zaken_earring" && x.plus === 12
    )
  )
);

const equippedAccBlock = (() => {
  const payload = makeSave(
    100000,
    [{ uid: "jew2", id: "zaken_earring", kind: "accessory" }],
    { name: "SellerHero" }
  );
  payload.characters[0].progress.avatar.gear = {
    earring_l: { uid: "jew2", id: "zaken_earring", kind: "accessory" },
  };
  store.persistPlayerSave(seller, (store.getSave(seller.id).seq || 1) + 1, now + 34, "0.42", payload);
  return store.marketCreateListing(
    seller,
    { characterId: "c1", kind: "accessory", uid: "jew2", priceAdena: 5000 },
    now + 35
  );
})();
ok("reject equipped accessory", equippedAccBlock.ok === false);

const weaponAsAcc = (() => {
  store.persistPlayerSave(
    seller,
    (store.getSave(seller.id).seq || 1) + 1,
    now + 36,
    "0.42",
    makeSave(100000, [{ uid: "w9", id: "sword_d", plus: 0, spent: 0 }], { name: "SellerHero" })
  );
  return store.marketCreateListing(
    seller,
    { characterId: "c1", kind: "accessory", uid: "w9", priceAdena: 5000 },
    now + 37
  );
})();
ok("reject weapon as accessory", weaponAsAcc.ok === false);

console.log(failed ? `\nFAILED: ${failed}` : "\nAll market tests passed.");
try {
  fs.rmSync(dir, { recursive: true, force: true });
} catch (_) {}
process.exit(failed ? 1 : 0);
