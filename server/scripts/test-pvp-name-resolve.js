#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { createStore } = require("../db");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-pvp-name-"));
const store = createStore({ dataDir: tmpDir, dbPath: path.join(tmpDir, "test.db") });

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

const now = Date.now();
const u = store.insertUser("xneons", bcrypt.hashSync("pass1234", 4), now);
const user = { id: u.id, nick: "xneons" };

function makeData(chars, activeId) {
  return {
    activeCharacterId: activeId,
    characters: chars.map((c) => ({
      id: c.id,
      progress: {
        avatar: { created: true, name: c.name, level: c.level || 1 },
        adena: 0,
        inventory: [],
      },
    })),
  };
}

// Same-save case-variants must be rejected
let threw = false;
try {
  store.persistPlayerSave(
    user,
    1,
    now,
    null,
    makeData(
      [
        { id: "slotA", name: "RiDDLe", level: 20 },
        { id: "slotB", name: "Riddle", level: 19 },
      ],
      "slotB"
    )
  );
} catch (e) {
  threw = e && e.code === "name_taken";
  assert(threw, "expected name_taken, got " + (e && e.message));
}
assert(threw, "same-save RiDDLe/Riddle must fail");

// Unique names on one account — ok
store.persistPlayerSave(
  user,
  1,
  now,
  null,
  makeData(
    [
      { id: "slotA", name: "RiDDLe", level: 20 },
      { id: "slotB", name: "NeonBlade", level: 19 },
    ],
    "slotA"
  )
);

const a = store.mailResolveName("RiDDLe");
assert(a.ok && a.characterId === "slotA", "resolve RiDDLe: " + JSON.stringify(a));

const b = store.mailResolveName("NeonBlade");
assert(b.ok && b.characterId === "slotB", "resolve NeonBlade: " + JSON.stringify(b));

const d = store.mailResolveName("xneons");
assert(d.ok && d.userId === user.id, "login fallback: " + JSON.stringify(d));

const avail = store.isCharacterNameAvailable("rIdDlE", {
  excludeUserId: user.id,
  excludeSlotId: "slotNew",
});
assert(avail.ok && !avail.available, "case collision blocked for new slot");

const keepOwn = store.isCharacterNameAvailable("RiDDLe", {
  excludeUserId: user.id,
  excludeSlotId: "slotA",
});
assert(keepOwn.ok && keepOwn.available, "keep own name on same slot");

const takenSibling = store.isCharacterNameAvailable("riDDle", {
  excludeUserId: user.id,
  excludeSlotId: "slotB",
});
assert(takenSibling.ok && !takenSibling.available, "cannot reuse sibling name on other slot");

// Other account cannot take RiDDLe
const u2 = store.insertUser("OtherNick", bcrypt.hashSync("pass1234", 4), now + 1);
const other = { id: u2.id, nick: "OtherNick" };
let threw2 = false;
try {
  store.persistPlayerSave(
    other,
    1,
    now + 1,
    null,
    makeData([{ id: "o1", name: "riddle", level: 1 }], "o1")
  );
} catch (e) {
  threw2 = e && e.code === "name_taken";
}
assert(threw2, "other account cannot take riddle");

console.log("pvp-name-resolve OK");
