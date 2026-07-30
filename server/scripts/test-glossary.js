"use strict";

/**
 * Glossary store unit tests (temp dir).
 *   node server/scripts/test-glossary.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createGlossaryStore } = require("../db/glossary");

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log("  ✓ " + name);
  else {
    failed += 1;
    console.error("  ✗ " + name + (detail ? " — " + detail : ""));
  }
}

const root = path.join(__dirname, "..", "..");
const gameDir = path.join(root, "game");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-glossary-test-"));
const store = createGlossaryStore({
  dataDir: dir,
  gameDir,
  filePath: path.join(dir, "glossary.json"),
});

console.log("\n--- glossary store ---");

const first = store.getGlossary();
ok("seed entries", Array.isArray(first.entries) && first.entries.length >= 10, String(first.entries?.length));
ok("seed categories", first.categories && first.categories.lore === "Лор");
ok("seeded flag", first.seeded === true);
ok("file written", fs.existsSync(store.filePath));

const second = store.getGlossary();
ok("second read not re-seed", second.seeded === false);
ok("same count", second.entries.length === first.entries.length);

const bad = store.putGlossary({ categories: { lore: "Лор" }, entries: [{ id: "Bad Id", title: "x", short: "y", category: "lore" }] });
ok("reject bad id", bad.ok === false, bad.error);

const clash = store.putGlossary({
  categories: { lore: "Лор" },
  entries: [
    { id: "a", title: "A", short: "aa", category: "lore", aliases: ["A"] },
    { id: "a", title: "B", short: "bb", category: "lore", aliases: ["B"] },
  ],
});
ok("reject duplicate id", clash.ok === false);

const badCat = store.putGlossary({
  categories: { lore: "Лор" },
  entries: [{ id: "x", title: "X", short: "xx", category: "nope", aliases: ["X"] }],
});
ok("reject unknown category", badCat.ok === false);

const put = store.putGlossary({
  categories: { lore: "Лор", game: "Игра" },
  entries: [
    { id: "test_term", title: "Тест", short: "Определение теста", category: "lore", aliases: ["Тест", "теста"] },
    { id: "adena_alias", title: "Adena", short: "Валюта", category: "game", aliases: ["Adena", "адена"] },
  ],
});
ok("put ok", put.ok === true, put.error);
ok("put count 2", put.entries && put.entries.length === 2);
ok("updatedAt", !!put.updatedAt);

const after = store.getGlossary();
ok("persisted", after.entries.length === 2 && after.entries[0].id === "test_term");

const emptyCats = store.putGlossary({ categories: {}, entries: [] });
ok("reject empty categories", emptyCats.ok === false);

console.log(failed ? "\nFAILED: " + failed : "\ntest-glossary.js OK");
process.exit(failed ? 1 : 0);
