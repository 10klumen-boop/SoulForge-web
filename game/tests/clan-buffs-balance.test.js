// ===== Unit: clan buffs (online + study farm/xp) =====
const assert = require("assert");
const { loadScripts } = require("./setup");

loadScripts(["src/data/clan-buffs-balance.js"]);

assert.strictEqual(clanOnlineBuffFromCount(0).tier, 0);
assert.strictEqual(clanOnlineBuffFromCount(2).adenaPct, 1);
assert.strictEqual(clanOnlineBuffFromCount(12).xpPct, 4);

assert.ok(clanStudyBuffDef("greed_1"));
assert.ok(clanStudyBuffDef("greed_3"));
assert.ok(clanStudyBuffDef("wisdom_3"));
assert.ok(clanStudyBuffDef("unity_2"));
assert.strictEqual(clanStudyBuffDef("greed_1").branch, "farm");
assert.strictEqual(clanStudyBuffDef("wisdom_1").branch, "xp");

assert.strictEqual(clanStudyRequiresMet(clanStudyBuffDef("greed_2"), []), false);
assert.strictEqual(clanStudyRequiresMet(clanStudyBuffDef("greed_3"), ["greed_1", "greed_2"]), true);
assert.strictEqual(
  clanStudyRequiresMet(clanStudyBuffDef("unity_2"), ["greed_2", "wisdom_2", "unity_1"]),
  true
);

const farmBranch = CLAN_STUDY_BUFFS.filter((b) => b.branch === "farm");
const xpBranch = CLAN_STUDY_BUFFS.filter((b) => b.branch === "xp");
assert.strictEqual(farmBranch.length, 3);
assert.strictEqual(xpBranch.length, 3);

const totals = clanBuffTotalsFromParts(clanOnlineBuffFromCount(4), [
  clanStudyBuffDef("greed_1"),
  clanStudyBuffDef("wisdom_1"),
]);
assert.strictEqual(totals.adenaPct, 4);
assert.strictEqual(totals.xpPct, 4);

const fullStudy = clanBuffTotalsFromParts({ adenaPct: 0, xpPct: 0 }, [
  clanStudyBuffDef("greed_1"),
  clanStudyBuffDef("greed_2"),
  clanStudyBuffDef("greed_3"),
  clanStudyBuffDef("wisdom_1"),
  clanStudyBuffDef("wisdom_2"),
  clanStudyBuffDef("wisdom_3"),
  clanStudyBuffDef("unity_1"),
  clanStudyBuffDef("unity_2"),
]);
assert.strictEqual(fullStudy.adenaPct, 14); // 2+3+4+2+3
assert.strictEqual(fullStudy.xpPct, 14); // 2+3+4+2+3

assert.ok(CLAN_BUFF_CAPS.adenaPct >= 22);
assert.ok(CLAN_BUFF_CAPS.xpPct >= 20);
assert.ok(CLAN_BUFF_CAPS.pvpPct >= 9);
assert.ok(CLAN_BUFF_CAPS.pvpDefPct >= 9);

const pvpBranch = CLAN_STUDY_BUFFS.filter((b) => b.branch === "pvp");
assert.strictEqual(pvpBranch.length, 3);
const pvpDefBranch = CLAN_STUDY_BUFFS.filter((b) => b.branch === "pvp_def");
assert.strictEqual(pvpDefBranch.length, 3);

const withPvp = clanBuffTotalsFromParts({ adenaPct: 0, xpPct: 0 }, [
  clanStudyBuffDef("valor_1"),
  clanStudyBuffDef("valor_2"),
  clanStudyBuffDef("valor_3"),
  clanStudyBuffDef("aegis_1"),
  clanStudyBuffDef("aegis_2"),
  clanStudyBuffDef("aegis_3"),
]);
assert.strictEqual(withPvp.pvpPct, 9);
assert.strictEqual(withPvp.pvpDefPct, 9);
assert.strictEqual(withPvp.adenaPct, 0);

assert.strictEqual(clanLevelFromXp(0).level, 1);
assert.strictEqual(clanLevelFromXp(199).level, 1);
assert.strictEqual(clanLevelFromXp(200).level, 2);
assert.strictEqual(clanLevelFromXp(600).labelRu, "Клятва");
assert.strictEqual(clanLevelFromXp(3500).level, 5);
assert.strictEqual(clanXpToNext(0).need, 200);
assert.strictEqual(clanXpToNext(3500).need, 0);
assert.strictEqual(clanXpToNext(100).into, 100);
assert.strictEqual(clanXpToNext(100).span, 200);

assert.strictEqual(clanStudyBuffDef("greed_1").costOathSymbol, 5);
assert.strictEqual(clanStudyBuffDef("greed_2").costOathSymbol, 15);
assert.strictEqual(clanStudyBuffDef("unity_2").costOathSymbol, 80);

assert.strictEqual(clanStudyBuffDef("greed_2").reqClanLevel, 2);
assert.strictEqual(clanStudyBuffDef("greed_3").reqClanLevel, 3);
assert.strictEqual(clanStudyBuffDef("unity_1").reqClanLevel, 3);
assert.strictEqual(clanStudyBuffDef("unity_2").reqClanLevel, 5);
assert.strictEqual(clanStudyBuffDef("valor_1").branch, "pvp");
assert.strictEqual(clanStudyBuffDef("valor_1").pvpPct, 2);
assert.strictEqual(clanStudyBuffDef("valor_3").reqClanLevel, 3);
assert.strictEqual(clanStudyBuffDef("aegis_1").branch, "pvp_def");
assert.strictEqual(clanStudyBuffDef("aegis_3").pvpDefPct, 4);
assert.strictEqual(clanStudyLevelMet(clanStudyBuffDef("greed_2"), 1), false);
assert.strictEqual(clanStudyLevelMet(clanStudyBuffDef("greed_2"), 2), true);
assert.strictEqual(clanStudyLevelMet(clanStudyBuffDef("unity_2"), 4), false);
assert.strictEqual(clanStudyLevelMet(clanStudyBuffDef("unity_2"), 5), true);

assert.ok(Array.isArray(CLAN_DONATIONS) && CLAN_DONATIONS.length >= 4);
assert.strictEqual(clanDonationByAmount(1_000_000).xp, 10);
assert.strictEqual(clanDonationByAmount(10_000_000).xp, 120);
assert.strictEqual(clanScoreFromDonation(100_000), 0);
assert.strictEqual(clanScoreFromDonation(100_000_000), 1400);
assert.ok(clanDonationByAmount(10_000_000).xp / 10 > clanDonationByAmount(1_000_000).xp, "larger tier better XP/adena");

console.log("clan-buffs-balance: ok");
