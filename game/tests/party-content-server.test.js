"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const assert = require("assert");
const bcrypt = require(path.join(__dirname, "..", "..", "server", "node_modules", "bcryptjs"));
const { createStore } = require(path.join(__dirname, "..", "..", "server", "db"));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-party-"));
const dbPath = path.join(tmpDir, "test.db");
const store = createStore({ dataDir: tmpDir, dbPath });

function seedChar(user, charId, name, level) {
  const now = Date.now();
  store.persistPlayerSave(user, 1, now, "test", {
    activeCharacterId: charId,
    characters: [
      {
        id: charId,
        progress: {
          avatar: {
            created: true,
            name,
            level: level || 20,
            raceId: "human",
            classId: "fighter",
            genderId: "male",
            xp: 0,
          },
          adena: 1000,
          farmZone: "banana_mine",
        },
      },
    ],
    avatar: {
      created: true,
      name,
      level: level || 20,
      raceId: "human",
      classId: "fighter",
      genderId: "male",
      xp: 0,
    },
    adena: 1000,
  });
}

const u1 = store.insertUser("PartyOne", bcrypt.hashSync("pass1234", 4), Date.now());
const u2 = store.insertUser("PartyTwo", bcrypt.hashSync("pass1234", 4), Date.now());
const user1 = { id: u1.id, nick: "PartyOne" };
const user2 = { id: u2.id, nick: "PartyTwo" };
seedChar(user1, "c1", "HeroOne", 25);
seedChar(user2, "c2", "HeroTwo", 25);

const party = store.chatCreateParty(user1, { now: 1000 });
assert.ok(party.ok && party.party, party.message);

const invite = store.chatInviteParty(user1, { charName: "HeroTwo", now: 1100 });
assert.ok(invite.ok, invite.message);
assert.ok(invite.pending, "invite must be pending");
assert.strictEqual(invite.party.members.length, 1, "not in party until accept");

const listed = store.chatListPartyInvites(user2);
assert.ok(listed.ok && listed.invites.length === 1);

const declinedWrong = store.chatRespondPartyInvite(user2, {
  inviteId: listed.invites[0].id,
  accept: false,
  now: 1110,
});
assert.ok(declinedWrong.ok && declinedWrong.accepted === false);

const invite2 = store.chatInviteParty(user1, { charName: "HeroTwo", now: 1120 });
assert.ok(invite2.ok && invite2.pending);
const listed2 = store.chatListPartyInvites(user2);
assert.ok(listed2.invites.length === 1);
const accept = store.chatRespondPartyInvite(user2, {
  inviteId: listed2.invites[0].id,
  accept: true,
  now: 1130,
});
assert.ok(accept.ok && accept.accepted, accept.message);
assert.strictEqual(accept.party.members.length, 2);

const kickSelf = store.chatKickParty(user1, { charName: "HeroOne", now: 1150 });
assert.ok(!kickSelf.ok);

const farmDisabled = store.partyFarmJoin(user1, {
  zoneId: "party_raiders_trail",
  power: 120,
  characterId: "c1",
  now: 1500,
});
assert.ok(!farmDisabled.ok, "party farm must be disabled");
assert.strictEqual(farmDisabled.error, "disabled");

const me = store.partyGetMe(user1);
assert.ok(me.ok);
assert.strictEqual(me.farm, null, "farm removed from party me");

const now0 = Date.now();
store.partySetReady(user2, { ready: true });

const start = store.instanceStart(user1, {
  dungeonId: "dungeon_alpha",
  power: 120,
  characterId: "c1",
  now: now0,
});
assert.ok(start.ok, start.message);
assert.ok(start.state.runId);
assert.strictEqual(start.state.status, "ready", "must wait for Ready");

const activeForMember = store.instanceActive(user2);
assert.ok(activeForMember.ok && activeForMember.state, "member sees active instance");
assert.strictEqual(activeForMember.state.runId, start.state.runId);
assert.strictEqual(activeForMember.state.status, "ready");

store.instanceReady(user2, {
  runId: start.state.runId,
  ready: true,
  power: 110,
  characterId: "c2",
});
const stillReady = store.instanceState(user1, { runId: start.state.runId });
assert.strictEqual(stillReady.state.status, "ready", "one ready is not enough");

store.instanceReady(user1, {
  runId: start.state.runId,
  ready: true,
  power: 120,
  characterId: "c1",
});

const st = store.instanceState(user1, { runId: start.state.runId });
assert.ok(st.ok);
assert.strictEqual(st.state.status, "active", "all ready starts fight");
assert.ok(st.state.encounter && st.state.encounter.mobs && st.state.encounter.mobs.length >= 2);

let cleared = false;
let sawRegen = false;
for (let i = 0; i < 12000 && !cleared; i++) {
  const snap = store.instanceState(user1, { runId: start.state.runId });
  if (snap.state?.status === "failed") break;
  const enc = snap.state?.encounter;
  const stones = (enc?.shieldStones || []).filter((s) => !s.dead);
  const targetId = stones.length
    ? stones[0].id
    : (enc?.mobs || []).find((m) => !m.dead)?.id;
  const tHit = now0 + 1500 + i * 160;
  if (
    !sawRegen &&
    enc &&
    enc.kind === "boss" &&
    (enc.mechanic === "regen" || /еген/i.test(String(enc.phaseLabel || "")))
  ) {
    const b0 = (enc.mobs || [])[0];
    const hp0 = b0.hp;
    const hRegen = store.instanceHit(user1, {
      runId: start.state.runId,
      dmg: 1,
      mobId: b0.id,
      now: tHit + 10_000,
    });
    const b1 = (hRegen.state?.encounter?.mobs || [])[0];
    if (b1 && (b1.hp > hp0 || hRegen.state.lastEvent === "boss_regen")) sawRegen = true;
  }
  const h = store.instanceHit(user1, {
    runId: start.state.runId,
    dmg: 400,
    mobId: targetId,
    bySkill: true,
    now: tHit,
  });
  assert.ok(h.ok, h.message);
  if (h.state && h.state.status === "cleared") {
    cleared = true;
    const loot = h.loot || h.state.lootByUser;
    assert.ok(loot);
    assert.ok(loot.xp > 0, "xp reward");
    // оружие/броня раздаются рандомно — у конкретного игрока пуха может не быть
    assert.ok(Array.isArray(loot.armorIds), "armor ids array");
    assert.ok(loot.armorIds.length <= 2, "max 2 armor pieces");
    if (loot.weaponGrade) assert.ok(loot.weaponGrade);
  }
}
assert.ok(cleared, "instance should clear");
assert.ok(sawRegen, "boss should regenerate HP during regen phase");

const locks = store.instanceLocksFor(user1, { characterId: "c1", now: now0 + 500_000 });
assert.ok(locks.ok);
assert.ok(locks.locks.dungeon_alpha.clears >= 1);

// --- Нельзя стартовать/продолжать инст соло после выхода лидера ---
const startSoloGuard = store.instanceStart(user1, {
  dungeonId: "dungeon_alpha",
  power: 120,
  powers: { [user1.id]: 120, [user2.id]: 110 },
  now: now0 + 700_000,
});
assert.ok(startSoloGuard.ok, startSoloGuard.message);
store.instanceReady(user2, {
  runId: startSoloGuard.state.runId,
  ready: true,
  power: 110,
  characterId: "c2",
});
const leaveLeader = store.instanceLeave(user1, { runId: startSoloGuard.state.runId });
assert.ok(leaveLeader.ok);
assert.ok(leaveLeader.undersized || leaveLeader.dissolved || !store._instanceRuns.has(startSoloGuard.state.runId));
const soloReady = store.instanceReady(user2, {
  runId: startSoloGuard.state.runId,
  ready: true,
  power: 110,
  characterId: "c2",
});
assert.ok(!soloReady.ok || soloReady.error === "run" || soloReady.error === "size" || !soloReady.state || soloReady.state.status !== "active");
assert.ok(
  ![...store._instanceRuns.values()].some(
    (r) => r.partyId === startSoloGuard.state.partyId && r.status === "active" && r.members.size < 2
  ),
  "no solo active instance"
);

// --- World boss ---
const wbStart = store.worldBossForceStart({ now: now0 + 1_000_000 });
assert.ok(wbStart.ok);
assert.strictEqual(wbStart.state.status, "active");

const enter1 = store.worldBossEnter(user1, {
  characterId: "c1",
  charName: "HeroOne",
  level: 25,
  now: now0 + 1_000_100,
});
assert.ok(enter1.ok, enter1.message);

const enter2 = store.worldBossEnter(user2, {
  characterId: "c2",
  charName: "HeroTwo",
  level: 25,
  now: now0 + 1_000_110,
});
assert.ok(enter2.ok, enter2.message);

const skillReject = store.worldBossClick(user1, {
  bySkill: true,
  now: now0 + 1_000_200,
});
assert.ok(!skillReject.ok, "skills must not count");

for (let i = 0; i < 5; i++) {
  const c = store.worldBossClick(user1, {
    characterId: "c1",
    charName: "HeroOne",
    now: now0 + 1_000_300 + i * 200,
  });
  assert.ok(c.ok, c.message);
}
for (let i = 0; i < 3; i++) {
  const c = store.worldBossClick(user2, {
    characterId: "c2",
    charName: "HeroTwo",
    now: now0 + 1_000_400 + i * 200,
  });
  assert.ok(c.ok, c.message);
}

const mid = store.worldBossState(user1);
assert.strictEqual(mid.state.my.clicks, 5);
assert.strictEqual(mid.state.top[0].charName, "HeroOne");

store.worldBossForceEnd({ now: now0 + 1_000_300 + 20 * 60 * 1000 });
const ended = store.worldBossState(user1);
assert.strictEqual(ended.state.status, "ended");
assert.ok(ended.state.winner);
assert.strictEqual(ended.state.winner.charName, "HeroOne");

const claimLoser = store.worldBossClaim(user2, { now: now0 + 2_000_000 });
assert.ok(claimLoser.ok, claimLoser.message);
assert.ok(claimLoser.loot && claimLoser.loot.shards && claimLoser.loot.shards.id === "zaken_earring_shard");
assert.strictEqual(claimLoser.place, 2);

const claim = store.worldBossClaim(user1, { now: now0 + 2_000_100 });
assert.ok(claim.ok, claim.message);
assert.ok(claim.loot && claim.loot.accessoryId === "zaken_earring");
assert.strictEqual(claim.place, 1);

const claim2 = store.worldBossClaim(user1, { now: now0 + 2_000_200 });
assert.ok(!claim2.ok, "one claim only");

// --- LFG board ---
const u3 = store.insertUser("PartyThree", bcrypt.hashSync("pass1234", 4), Date.now());
const u4 = store.insertUser("PartyFour", bcrypt.hashSync("pass1234", 4), Date.now());
const user3 = { id: u3.id, nick: "PartyThree" };
const user4 = { id: u4.id, nick: "PartyFour" };
seedChar(user3, "c3", "HeroThree", 25);
seedChar(user4, "c4", "HeroFour", 25);

const p3 = store.chatCreateParty(user3, { now: now0 + 3_000_000 });
assert.ok(p3.ok && p3.party);

const posted = store.partyLfgPost(user3, {
  dungeonId: "dungeon_alpha",
  note: "быстрый",
  now: now0 + 3_000_100,
});
assert.ok(posted.ok, posted.message);
assert.ok(posted.mine || posted.listing);
assert.strictEqual((posted.mine || posted.listing).dungeonId, "dungeon_alpha");

const lfgListed = store.partyLfgList(user4, { now: now0 + 3_000_200 });
assert.ok(lfgListed.ok);
assert.ok(lfgListed.listings.some((x) => x.dungeonId === "dungeon_alpha"));

const busyJoin = store.partyLfgJoin(user1, {
  listingId: lfgListed.listings[0].id,
  now: now0 + 3_000_300,
});
assert.ok(!busyJoin.ok, "already in party must reject");
assert.strictEqual(busyJoin.error, "busy");

const joined = store.partyLfgJoin(user4, {
  listingId: lfgListed.listings[0].id,
  charName: "HeroFour",
  now: now0 + 3_000_400,
});
assert.ok(joined.ok, joined.message);
assert.ok(joined.party);
assert.strictEqual(joined.party.members.length, 2);

const afterJoin = store.partyLfgList(user3, { now: now0 + 3_000_500 });
assert.ok(afterJoin.mine);
assert.strictEqual(afterJoin.mine.membersCount, 2);

store.partySetReady(user4, { ready: true });
const startFromLfg = store.instanceStart(user3, {
  dungeonId: "dungeon_alpha",
  power: 120,
  characterId: "c3",
  now: now0 + 3_001_000,
});
assert.ok(startFromLfg.ok, startFromLfg.message);
assert.strictEqual(startFromLfg.state.status, "ready");
store.instanceReady(user3, { runId: startFromLfg.state.runId, ready: true, power: 120, characterId: "c3" });
store.instanceReady(user4, { runId: startFromLfg.state.runId, ready: true, power: 110, characterId: "c4" });
const afterReady = store.instanceState(user3, { runId: startFromLfg.state.runId });
assert.strictEqual(afterReady.state.status, "active");
const clearedBoard = store.partyLfgList(user3, { now: now0 + 3_001_100 });
assert.ok(!clearedBoard.mine, "instance start clears listing");

const p5user = store.insertUser("PartyFive", bcrypt.hashSync("pass1234", 4), Date.now());
const user5 = { id: p5user.id, nick: "PartyFive" };
seedChar(user5, "c5", "HeroFive", 25);
store.chatCreateParty(user5, { now: now0 + 4_000_000 });
const short = store.partyLfgPost(user5, {
  dungeonId: "dungeon_depths",
  now: now0 + 4_000_100,
});
assert.ok(short.ok);
const expired = store.partyLfgList(user5, { now: now0 + 4_000_100 + 16 * 60 * 1000 });
assert.ok(!expired.mine, "TTL expires listing");
assert.ok(!expired.listings.some((x) => x.id === (short.listing || short.mine)?.id));

// --- Depths: наковальня вместо кристаллов ---
const depthsNow = Date.now();
const depthsStart = store.instanceStart(user1, {
  dungeonId: "dungeon_depths",
  power: 200,
  characterId: "c1",
  now: depthsNow,
});
assert.ok(depthsStart.ok, depthsStart.message);
store.instanceReady(user1, {
  runId: depthsStart.state.runId,
  ready: true,
  power: 200,
  characterId: "c1",
});
store.instanceReady(user2, {
  runId: depthsStart.state.runId,
  ready: true,
  power: 190,
  characterId: "c2",
});
let sawAnvil = false;
let anvilCleared = false;
let anvilRounds = 0;
let bossDmgAfterAnvil = false;
for (let i = 0; i < 12000 && !bossDmgAfterAnvil; i++) {
  const snap = store.instanceState(user1, { runId: depthsStart.state.runId });
  if (!snap.state || snap.state.status === "failed" || snap.state.status === "cleared") break;
  const enc = snap.state.encounter;
  const tHit = depthsNow + 1500 + i * 160;
  if (enc && enc.kind === "boss" && enc.anvilActive) {
    sawAnvil = true;
    assert.ok(!(enc.shieldStones || []).length, "depths anvil has no shield crystals");
    assert.ok((enc.anvilMarks || []).length >= 6, "anvil has many marks");
    assert.ok((enc.anvilPlayers || []).length >= 2, "party colors assigned");
    assert.ok(enc.anvilFailMax >= 6, "fail budget set");
    assert.ok(enc.anvilGoal >= 4, "anvil goal scaled");
    const boss = (enc.mobs || [])[0];
    const blocked = store.instanceHit(user1, {
      runId: depthsStart.state.runId,
      dmg: 500,
      mobId: boss.id,
      now: tHit,
    });
    assert.ok(blocked.ok);
    assert.ok(blocked.blocked, "boss hits blocked during anvil");
    let roundDone = false;
    for (let k = 0; k < 400 && !roundDone; k++) {
      const mid = store.instanceState(user1, { runId: depthsStart.state.runId });
      const e2 = mid.state?.encounter;
      if (!e2 || !e2.anvilActive) {
        roundDone = true;
        break;
      }
      const tK = tHit + 500 + k * 160;
      const run = [...store._instanceRuns.values()].find((r) => r.id === depthsStart.state.runId);
      if (run && run.encounter && Array.isArray(run.encounter.anvilMarks)) {
        for (const m of run.encounter.anvilMarks) {
          m.windowOpen = true;
          m.nextToggleAt = tK + 5000;
        }
      }
      const myMarks = (e2.anvilMarks || []).filter((m) => String(m.ownerUserId) === String(user1.id));
      const mark = myMarks[k % Math.max(1, myMarks.length)] || (e2.anvilMarks || [])[0];
      if (!mark) break;
      const hk = store.instanceHit(user1, {
        runId: depthsStart.state.runId,
        dmg: 1,
        mobId: mark.id,
        bySkill: true,
        now: tK,
      });
      if (hk.anvilWiped) break;
      if (hk.anvilDone || (hk.state && !hk.state.encounter?.anvilActive)) {
        roundDone = true;
        break;
      }
    }
    assert.ok(roundDone, "anvil round should complete");
    anvilRounds += 1;
    // если сразу стартовала следующая наковальня — продолжим цикл
    continue;
  }
  if (enc && enc.kind === "boss" && !enc.anvilActive && anvilRounds >= 1) {
    // все раунды кузни пройдены (или между ними) — пробуем урон
    const after = store.instanceState(user1, { runId: depthsStart.state.runId });
    const e3 = after.state?.encounter;
    if (e3 && e3.anvilActive) continue;
    if (anvilRounds < 3 && e3) {
      // ещё могут быть фазы — ждём, пока HP не уроним дальше
      const boss2 = (e3.mobs || [])[0];
      if (boss2 && !boss2.dead) {
        store.instanceHit(user1, {
          runId: depthsStart.state.runId,
          dmg: 500,
          mobId: boss2.id,
          bySkill: true,
          now: tHit,
        });
      }
      if (anvilRounds >= 3) {
        /* fallthrough to damage check below next ticks */
      }
      continue;
    }
    const boss2 = (e3?.mobs || [])[0];
    if (!boss2 || boss2.dead) break;
    const hpBefore = boss2.hp;
    const hBoss = store.instanceHit(user1, {
      runId: depthsStart.state.runId,
      dmg: 400,
      mobId: boss2.id,
      bySkill: true,
      now: tHit + 80_000,
    });
    if (hBoss.ok && !hBoss.blocked) {
      const hpAfter = (hBoss.state?.encounter?.mobs || [])[0]?.hp;
      if (hpAfter < hpBefore) {
        anvilCleared = true;
        bossDmgAfterAnvil = true;
        break;
      }
    }
  }
  const stones = (enc?.shieldStones || []).filter((s) => !s.dead);
  const targetId = stones.length
    ? stones[0].id
    : (enc?.mobs || []).find((m) => !m.dead)?.id;
  const h = store.instanceHit(user1, {
    runId: depthsStart.state.runId,
    dmg: 500,
    mobId: targetId,
    bySkill: true,
    now: tHit,
  });
  assert.ok(h.ok, h.message);
}
assert.ok(sawAnvil, "depths boss should enter anvil phase");
assert.ok(anvilRounds >= 3, "depths should run multiple anvil rounds, got " + anvilRounds);
assert.ok(bossDmgAfterAnvil, "boss damage resumes after anvil");
store.instanceLeave(user1, { runId: depthsStart.state.runId });
store.instanceLeave(user2, { runId: depthsStart.state.runId });

// Провал наковальни (чужой цвет) → wipe
const wipeNow = Date.now();
const wipeStart = store.instanceStart(user1, {
  dungeonId: "dungeon_depths",
  power: 200,
  characterId: "c1",
  now: wipeNow,
});
assert.ok(wipeStart.ok, wipeStart.message);
store.instanceReady(user1, { runId: wipeStart.state.runId, ready: true, power: 200, characterId: "c1" });
store.instanceReady(user2, { runId: wipeStart.state.runId, ready: true, power: 190, characterId: "c2" });
let wiped = false;
for (let i = 0; i < 8000 && !wiped; i++) {
  const snap = store.instanceState(user1, { runId: wipeStart.state.runId });
  if (!snap.state || snap.state.status === "failed") {
    wiped = snap.state?.lastEvent === "anvil_fail" || snap.state?.phase === "wipe";
    break;
  }
  if (snap.state.status === "cleared") break;
  const enc = snap.state.encounter;
  const tHit = wipeNow + 1500 + i * 160;
  if (enc && enc.kind === "boss" && enc.anvilActive) {
    const run = [...store._instanceRuns.values()].find((r) => r.id === wipeStart.state.runId);
    const failMax = Math.max(1, enc.anvilFailMax || 10);
    for (let f = 0; f < failMax + 2; f++) {
      if (run && run.encounter && Array.isArray(run.encounter.anvilMarks)) {
        for (const m of run.encounter.anvilMarks) {
          m.windowOpen = true;
          m.nextToggleAt = tHit + 5000 + f * 200;
        }
      }
      const foreign = (enc.anvilMarks || []).find((m) => String(m.ownerUserId) !== String(user1.id));
      const mark = foreign || (enc.anvilMarks || [])[0];
      const hw = store.instanceHit(user1, {
        runId: wipeStart.state.runId,
        dmg: 1,
        mobId: mark.id,
        now: tHit + 200 + f * 200,
      });
      if (hw.anvilWiped || hw.state?.status === "failed") {
        wiped = true;
        assert.strictEqual(hw.state.lastEvent, "anvil_fail");
        break;
      }
    }
    break;
  }
  const targetId = (enc?.mobs || []).find((m) => !m.dead)?.id;
  store.instanceHit(user1, {
    runId: wipeStart.state.runId,
    dmg: 500,
    mobId: targetId,
    bySkill: true,
    now: tHit,
  });
}
assert.ok(wiped, "wrong-color anvil fails should wipe the party");

console.log("party-content-server.test.js OK");
