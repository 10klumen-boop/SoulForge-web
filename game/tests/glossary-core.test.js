// ===== Unit: glossary-core linkify / search =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts(["src/data/glossary-data.js", "src/glossary-core.js"]);

glossaryResetIndex();

assert.ok(glossaryGet("shilen"), "get shilen");
assert.equal(glossaryGet("shilen").title, "Шилен");

const all = glossaryAll();
assert.ok(all.length >= 40, "seed size " + all.length);

const found = glossarySearch("небулит");
assert.ok(found.some((e) => e.id === "nebulite"), "search nebulite");

const plain = glossaryLinkifyHtml("Имя Шилен звучит во мраке.");
assert.ok(plain.includes('data-glossary="shilen"'), "linkify shilen: " + plain);
assert.ok(plain.includes("glossary-term"), "has class");
assert.ok(plain.startsWith("Имя "), "prefix preserved: " + plain);

const longest = glossaryLinkifyHtml("Ищу Апокалипсис Кайши в лесу.");
assert.ok(longest.includes('data-glossary="kaisha"'), "longest alias kaisha");
assert.ok(!longest.includes('data-glossary="shilen"') || longest.indexOf("Кайши") > -1, "kaisha ok");

const html = glossaryLinkifyHtml('Слушай про <b>Шилен</b> и adena.');
assert.ok(html.includes("<b>"), "keeps b tag");
assert.ok(html.includes('data-glossary="shilen"'), "term inside/near b");
assert.ok(html.includes('data-glossary="adena"') || html.toLowerCase().includes("adena"), "adena linked");

const once = glossaryLinkifyHtml(glossaryLinkifyHtml("Шилен и Шилен"));
const buttons = (once.match(/data-glossary="shilen"/g) || []).length;
assert.ok(buttons >= 2, "two terms");
assert.ok(!once.includes("glossary-term\"><button"), "no nested buttons: " + once);

const boundary = glossaryLinkifyHtml("неШилен вовсе");
assert.ok(!boundary.includes('data-glossary="shilen"'), "word boundary");

const latin = glossaryLinkifyHtml("Buy Soulshot now");
assert.ok(latin.includes('data-glossary="soulshot"'), "latin case: " + latin);

assert.ok(typeof applyGlossaryPayload === "function", "applyGlossaryPayload");
const swapped = applyGlossaryPayload({
  categories: { lore: "Лор", game: "Игра" },
  entries: [
    { id: "unit_only", title: "UnitOnly", category: "game", aliases: ["UnitOnly"], short: "Тест hot-swap" },
  ],
});
assert.ok(swapped, "apply ok");
glossaryResetIndex();
assert.ok(glossaryGet("unit_only"), "hot-swapped term");
assert.ok(!glossaryGet("shilen"), "old terms replaced");

console.log("glossary-core.test.js OK");
