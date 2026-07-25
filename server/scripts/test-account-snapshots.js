#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSqliteStore } = require("../db/sqlite");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-acct-snap-"));
const store = createSqliteStore({ dataDir: dir, dbPath: path.join(dir, "t.db") });

const now = Date.now();
const user = store.insertUser("SnapTest", "hash", now);
const u = store.getUserById(user.id);

function makeSave(whItems, level) {
  return {
    activeCharacterId: "c1",
    accountWarehouse: { items: whItems || [] },
    accountMail: { messages: [] },
    characters: [
      {
        id: "c1",
        progress: {
          avatar: {
            created: true,
            name: "Hero",
            level: level || 10,
            raceId: "human",
            classId: "fighter",
            genderId: "male",
            gear: {},
          },
          adena: 1000,
          inventory: [],
        },
      },
    ],
    avatar: {
      created: true,
      name: "Hero",
      level: level || 10,
      raceId: "human",
      classId: "fighter",
      genderId: "male",
      gear: {},
    },
    adena: 1000,
    inventory: [],
  };
}

const items = [
  { uid: "i_test_mail", id: "drake_mail", kind: "armor", plus: 0 },
  { uid: "i_test_helm", id: "drake_helmet", kind: "armor", plus: 0 },
];

store.persistPlayerSave(u, 1, now, "0.49", makeSave(items, 12));
let snaps = store.listAccountSnapshots(u.id, 10);
if (!snaps.length) throw new Error("expected account snapshot after save");
if (snaps[0].warehouseCount !== 2) throw new Error("warehouseCount " + snaps[0].warehouseCount);

store.persistPlayerSave(u, 2, now + 1, "0.49", makeSave([], 12));
snaps = store.listAccountSnapshots(u.id, 10);
if (snaps[0].warehouseCount !== 0) throw new Error("expected empty warehouse snapshot");

const fullSnap = snaps.find((s) => s.warehouseCount === 2) || snaps[snaps.length - 1];
// restore the first snap with items — list is DESC so last with count 2
const withItems = store.listAccountSnapshots(u.id, 40).find((s) => s.warehouseCount === 2);
if (!withItems) throw new Error("missing snapshot with items");

const before = store.getSave(u.id);
const restored = store.restoreAccountSnapshot(u, withItems.id);
if (!restored.ok) throw new Error("restore failed " + restored.error);
if (restored.warehouseCount !== 2) throw new Error("restore wh count");
if (restored.summary.active_level !== 12) throw new Error("level changed " + restored.summary.active_level);
if (before.active_level !== restored.summary.active_level) {
  throw new Error("active_level should be unchanged");
}

const after = JSON.parse(store.getSave(u.id).payload);
if ((after.accountWarehouse.items || []).length !== 2) {
  throw new Error("payload warehouse not restored");
}
const { CHARACTER_EVENT_TYPES } = require("../db/sqlite");
if (!CHARACTER_EVENT_TYPES.has("warehouse_deposit")) {
  throw new Error("missing warehouse_deposit event type");
}
if (!CHARACTER_EVENT_TYPES.has("warehouse_withdraw")) {
  throw new Error("missing warehouse_withdraw event type");
}

console.log("OK account_snapshots + restore preserves level");
store.close();
try {
  fs.rmSync(dir, { recursive: true, force: true });
} catch (_) {}
