// ===== Unit: mail/market scroll wiring present =====
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const marketSrc = fs.readFileSync(path.join(__dirname, "../../server/db/market.js"), "utf8");
assert.ok(marketSrc.includes('"scroll"'), "market MARKET_KINDS scroll");
assert.ok(marketSrc.includes("function takeScroll"), "takeScroll");
assert.ok(marketSrc.includes("function giveScroll"), "giveScroll");
assert.ok(marketSrc.includes("plus:"), "armor plus on market");

const mailSrc = fs.readFileSync(path.join(__dirname, "../../server/db/mail.js"), "utf8");
assert.ok(mailSrc.includes('"scroll"'), "mail scroll kind");
assert.ok(mailSrc.includes("function takeScrollMail"), "takeScrollMail");
assert.ok(mailSrc.includes("function giveScrollMail"), "giveScrollMail");

// Runtime take/give mirror
const SCROLL_TARGETS = new Set(["weapon", "armor"]);
const SCROLL_TYPES = new Set(["regular", "blessed", "destruction", "crystal"]);
const GRADES = new Set(["D", "C", "B", "A"]);
function empty() {
  const g = () => ({ D: 0, C: 0, B: 0, A: 0 });
  const t = () => ({ regular: g(), blessed: g(), destruction: g(), crystal: g() });
  return { weapon: t(), armor: t() };
}
function takeScroll(progress, target, typeId, grade, qty) {
  const t = String(target || "").toLowerCase();
  const ty = String(typeId || "").toLowerCase();
  const g = String(grade || "").toUpperCase();
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  if (!SCROLL_TARGETS.has(t) || !SCROLL_TYPES.has(ty) || !GRADES.has(g)) return { ok: false };
  const have = progress.scrolls[t][ty][g] || 0;
  if (have < n) return { ok: false };
  progress.scrolls[t][ty][g] = have - n;
  return { ok: true, item: { kind: "scroll", target: t, typeId: ty, grade: g }, qty: n };
}
function giveScroll(progress, target, typeId, grade, qty) {
  const t = String(target || "").toLowerCase();
  const ty = String(typeId || "").toLowerCase();
  const g = String(grade || "").toUpperCase();
  const n = Math.max(1, Math.floor(Number(qty) || 0));
  progress.scrolls[t][ty][g] = (progress.scrolls[t][ty][g] || 0) + n;
  return { ok: true };
}

const p = { scrolls: empty() };
giveScroll(p, "weapon", "regular", "D", 5);
const taken = takeScroll(p, "weapon", "regular", "D", 2);
assert.ok(taken.ok);
assert.strictEqual(p.scrolls.weapon.regular.D, 3);

console.log("scroll-market-mail.test.js OK");
