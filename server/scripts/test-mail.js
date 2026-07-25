"use strict";

/**
 * P2P mail escrow tests (temp SQLite).
 *   node server/scripts/test-mail.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSqliteStore } = require("../db/sqlite");

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log("  ✓ " + name);
  else {
    failed += 1;
    console.error("  ✗ " + name + (detail ? " — " + detail : ""));
  }
}

function makeSave(name, inv, charId) {
  charId = charId || "c1";
  return {
    activeCharacterId: charId,
    characters: [
      {
        id: charId,
        progress: {
          avatar: { created: true, name, level: 5, gear: {} },
          adena: 1000,
          inventory: inv || [],
          crystals: { D: 0, C: 0, B: 0, A: 0 },
          materials: { soul: 0, spirit: 0 },
          shots: { soul: { D: 0, C: 0, B: 0, A: 0 }, spirit: { D: 0, C: 0, B: 0, A: 0 } },
          totals: { tries: 0, fails: 0, earned: 0 },
        },
      },
    ],
  };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-mail-test-"));
const store = createSqliteStore({ dataDir: dir, dbPath: path.join(dir, "t.db") });
const now = Date.now();
const alice = { id: store.insertUser("Alice", "hashhashhash", now).id, nick: "Alice" };
const bob = { id: store.insertUser("Bobxx", "hashhashhash", now).id, nick: "Bobxx" };

store.persistPlayerSave(
  alice,
  1,
  now,
  "0.46",
  makeSave("HeroAlice", [{ uid: "i1", id: "sword_d", plus: 3, spent: 100 }])
);
store.persistPlayerSave(bob, 1, now, "0.46", makeSave("HeroBob", []));

console.log("\n--- player mail ---");

const badName = store.mailSend(
  alice,
  { characterId: "c1", uid: "i1", toName: "Nobody" },
  now
);
ok("reject unknown name", badName.ok === false && /не найден/i.test(badName.error || ""), badName.error);

const self = store.mailSend(
  alice,
  { characterId: "c1", uid: "i1", toName: "HeroAlice" },
  now + 1
);
ok("reject self", self.ok === false && /сам/i.test(self.error || ""), self.error);

const sent = store.mailSend(
  alice,
  { characterId: "c1", uid: "i1", toName: "HeroBob" },
  now + 2
);
ok("send ok", sent.ok === true, sent.error);
ok("sender inv empty", sent.data?.characters[0].progress.inventory.length === 0);
ok("parcel escrow", sent.parcel?.status === "escrow");

const inbox = store.mailInbox(bob, { characterId: "c1" }, now + 3);
ok("bob inbox 1", inbox.ok && inbox.rows.length === 1, String(inbox.rows?.length));

const wrongChar = store.mailClaim(bob, sent.parcel.id, { characterId: "other" }, now + 4);
ok("reject wrong char", wrongChar.ok === false);

const claimed = store.mailClaim(bob, sent.parcel.id, { characterId: "c1" }, now + 5);
ok("claim ok", claimed.ok === true, claimed.error);
ok(
  "bob has item",
  claimed.data?.characters[0].progress.inventory.some((it) => it.uid === "i1"),
  JSON.stringify(claimed.data?.characters[0].progress.inventory)
);

const inbox2 = store.mailInbox(bob, { characterId: "c1" }, now + 6);
ok("inbox empty after claim", inbox2.ok && inbox2.rows.length === 0);

const dup = store.mailClaim(bob, sent.parcel.id, { characterId: "c1" }, now + 7);
ok("reject double claim", dup.ok === false);

// armor + cancel
store.persistPlayerSave(
  alice,
  sent.seq + 1,
  now + 8,
  "0.46",
  makeSave("HeroAlice", [{ uid: "a1", id: "bone_helmet", kind: "armor" }])
);
const armorSent = store.mailSend(
  alice,
  { characterId: "c1", uid: "a1", toName: "herobob" },
  now + 9
);
ok("send armor case-insensitive name", armorSent.ok === true, armorSent.error);
const cancelled = store.mailCancel(alice, armorSent.parcel.id, { characterId: "c1" }, now + 10);
ok("cancel returns item", cancelled.ok === true, cancelled.error);
ok(
  "alice got armor back",
  cancelled.data?.characters[0].progress.inventory.some((it) => it.uid === "a1")
);

// adena mail
const aliceLoaded = JSON.parse(store.getSave(alice.id).payload);
aliceLoaded.characters[0].progress.adena = 100000;
aliceLoaded.characters[0].progress.inventory = [];
store.persistPlayerSave(alice, (cancelled.seq || 10) + 1, now + 11, "0.46", aliceLoaded);

const adenaSent = store.mailSend(
  alice,
  { characterId: "c1", kind: "adena", qty: 25000, toName: "HeroBob" },
  now + 12
);
ok("send adena", adenaSent.ok === true, adenaSent.error);
ok("alice adena reduced", adenaSent.data?.characters[0].progress.adena === 75000, String(adenaSent.data?.characters[0].progress.adena));

const bobBefore = JSON.parse(store.getSave(bob.id).payload);
const bobAdenaBefore = bobBefore.characters[0].progress.adena || 0;
const adenaClaim = store.mailClaim(bob, adenaSent.parcel.id, { characterId: "c1" }, now + 13);
ok("claim adena", adenaClaim.ok === true, adenaClaim.error);
ok(
  "bob got adena",
  adenaClaim.data?.characters[0].progress.adena === bobAdenaBefore + 25000,
  String(adenaClaim.data?.characters[0].progress.adena)
);

const nameCheck = store.isCharacterNameAvailable("HeroBob", { excludeUserId: alice.id });
ok("name HeroBob taken", nameCheck.available === false);
const nameFree = store.isCharacterNameAvailable("UniqueHeroZZ", { excludeUserId: alice.id });
ok("name UniqueHeroZZ free", nameFree.available === true);

console.log(failed ? "\nFAILED: " + failed : "\nAll mail tests passed.");
process.exit(failed ? 1 : 0);
