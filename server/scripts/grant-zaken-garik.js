"use strict";
/**
 * One-shot: grant Zaken earring to character Garik (VPS admin).
 *   node scripts/grant-zaken-garik.js
 */
const path = require("path");
const { createSqliteStore } = require("../db/sqlite");

const CHAR_NAME = process.argv[2] || "Garik";
const ITEM_ID = "zaken_earring";

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "soulforge.db");
const store = createSqliteStore({ dataDir, dbPath });

function newUid() {
  return (
    "i" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

const db = require("better-sqlite3")(dbPath);
const chars = db
  .prepare(
    `SELECT user_id, slot_id, name, nick, created
     FROM player_characters
     WHERE created = 1 AND name = ? COLLATE NOCASE`
  )
  .all(CHAR_NAME);
db.close();

if (!chars.length) {
  console.error("Character not found:", CHAR_NAME);
  process.exit(1);
}
if (chars.length > 1) {
  console.error("Multiple characters named", CHAR_NAME, chars);
  process.exit(1);
}

const char = chars[0];
const row = store.getSave(char.user_id);
if (!row) {
  console.error("No save for user", char.user_id);
  process.exit(1);
}

const data = JSON.parse(row.payload);
const slot = (data.characters || []).find((c) => c && String(c.id) === String(char.slot_id));
if (!slot || !slot.progress) {
  console.error("Slot not found in save", char.slot_id);
  process.exit(1);
}

if (!Array.isArray(slot.progress.inventory)) slot.progress.inventory = [];
const already = slot.progress.inventory.some((it) => it && it.id === ITEM_ID);
if (already) {
  console.log("Already has", ITEM_ID, "— skip");
  process.exit(0);
}

const item = { uid: newUid(), id: ITEM_ID, kind: "accessory" };
slot.progress.inventory.push(item);

// Mirror root inventory if this is the active character
if (String(data.activeCharacterId || "") === String(slot.id)) {
  if (!Array.isArray(data.inventory)) data.inventory = [];
  data.inventory.push(JSON.parse(JSON.stringify(item)));
}

const user = { id: char.user_id, nick: row.nick || char.nick || "player" };
const nextSeq = Math.max(1, (row.seq || 0) + 1);
const savedAt = Date.now();
store.persistPlayerSave(user, nextSeq, savedAt, "admin-grant", data);

console.log(
  JSON.stringify(
    {
      ok: true,
      userId: user.id,
      nick: user.nick,
      characterId: slot.id,
      name: slot.progress.avatar?.name || CHAR_NAME,
      item,
      seq: nextSeq,
      invLen: slot.progress.inventory.length,
    },
    null,
    2
  )
);
