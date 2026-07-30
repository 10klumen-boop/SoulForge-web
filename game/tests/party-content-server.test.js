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
  const lv = Math.max(35, Math.floor(Number(level) || 35));
  store.persistPlayerSave(user, 1, now, "test", {
    activeCharacterId: charId,
    characters: [
      {
        id: charId,
        progress: {
          avatar: {
            created: true,
            name,
            level: lv,
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
      level: lv,
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
  power: 600,
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
  power: 600,
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
  power: 580,
  characterId: "c2",
});
const stillReady = store.instanceState(user1, { runId: start.state.runId });
assert.strictEqual(stillReady.state.status, "ready", "one ready is not enough");

store.instanceReady(user1, {
  runId: start.state.runId,
  ready: true,
  power: 600,
  characterId: "c1",
});

const st = store.instanceState(user1, { runId: start.state.runId });
assert.ok(st.ok);
assert.strictEqual(st.state.status, "active", "all ready starts fight");
assert.ok(st.state.encounter && st.state.encounter.mobs && st.state.encounter.mobs.length >= 2);

{
  const runId = start.state.runId;
  const mobId = (st.state.encounter.mobs || []).find((m) => !m.dead)?.id;
  assert.ok(mobId);
  const tBuff = now0 + 400;
  const baseHit = store.instanceHit(user1, { runId, dmg: 12, mobId, now: tBuff });
  assert.ok(baseHit.ok);
  const buff = store.instancePartyBuff(user1, {
    runId,
    mult: 1.18,
    durationMs: 8000,
    skillId: "warcryer_f",
    name: "Великий клич",
    now: tBuff + 50,
  });
  assert.ok(buff.ok, buff.message);
  assert.ok(buff.state.partyDamageBuff);
  assert.strictEqual(buff.state.partyDamageBuff.mult, 1.18);
  assert.strictEqual(buff.state.lastEvent, "party_damage_buff");
  const allyHit = store.instanceHit(user2, { runId, dmg: 12, mobId, now: tBuff + 250 });
  assert.ok(allyHit.ok);
  assert.ok(
    allyHit.dmg > baseHit.dmg,
    "ally must receive party buff: " + allyHit.dmg + " vs " + baseHit.dmg
  );
}

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
  power: 600,
  powers: { [user1.id]: 600, [user2.id]: 580 },
  now: now0 + 700_000,
});
assert.ok(startSoloGuard.ok, startSoloGuard.message);
store.instanceReady(user2, {
  runId: startSoloGuard.state.runId,
  ready: true,
  power: 580,
  characterId: "c2",
});
const leaveLeader = store.instanceLeave(user1, { runId: startSoloGuard.state.runId });
assert.ok(leaveLeader.ok);
assert.ok(leaveLeader.undersized || leaveLeader.dissolved || !store._instanceRuns.has(startSoloGuard.state.runId));
const soloReady = store.instanceReady(user2, {
  runId: startSoloGuard.state.runId,
  ready: true,
  power: 580,
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
const wbStart = store.worldBossForceStart({ now: now0 + 1_000_000, bossId: "world_zaken" });
assert.ok(wbStart.ok);
assert.strictEqual(wbStart.state.status, "active");
assert.strictEqual(wbStart.boss.id, "world_zaken");
assert.ok(Array.isArray(wbStart.bosses) && wbStart.bosses.length >= 2);

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
    damage: 10,
    now: now0 + 1_000_300 + i * 200,
  });
  assert.ok(c.ok, c.message);
}
for (let i = 0; i < 3; i++) {
  const c = store.worldBossClick(user2, {
    characterId: "c2",
    charName: "HeroTwo",
    damage: 100,
    now: now0 + 1_000_400 + i * 200,
  });
  assert.ok(c.ok, c.message);
}

const mid = store.worldBossState(user1);
assert.strictEqual(mid.state.my.damage, 50);
assert.strictEqual(mid.state.my.hits, 5);
assert.strictEqual(mid.state.my.clicks, 50);
assert.strictEqual(mid.state.top[0].charName, "HeroTwo"); // больше урона при меньшем числе ударов
const mid2 = store.worldBossState(user2);
assert.strictEqual(mid2.state.my.damage, 300);

store.worldBossForceEnd({ now: now0 + 1_000_300 + 20 * 60 * 1000 });
const ended = store.worldBossState(user1);
assert.strictEqual(ended.state.status, "ended");
assert.ok(ended.state.winner);
assert.strictEqual(ended.state.winner.charName, "HeroTwo");

const claimLoser = store.worldBossClaim(user1, { now: now0 + 2_000_000 });
assert.ok(claimLoser.ok, claimLoser.message);
assert.ok(claimLoser.loot && claimLoser.loot.shards && claimLoser.loot.shards.id === "zaken_earring_shard");
assert.strictEqual(claimLoser.place, 2);

const claim = store.worldBossClaim(user2, { now: now0 + 2_000_100 });
assert.ok(claim.ok, claim.message);
assert.ok(claim.loot && claim.loot.accessoryId === "zaken_earring");
assert.strictEqual(claim.place, 1);

const claim2 = store.worldBossClaim(user2, { now: now0 + 2_000_200 });
assert.ok(!claim2.ok, "one claim only");

// Queen Ant force + loot
const qaStart = store.worldBossForceStart({ now: now0 + 2_500_000, bossId: "world_queen_ant" });
assert.ok(qaStart.ok);
assert.strictEqual(qaStart.boss.id, "world_queen_ant");
const qaEnter = store.worldBossEnter(user1, {
  characterId: "c1",
  charName: "HeroOne",
  level: 25,
  bossId: "world_queen_ant",
  now: now0 + 2_500_100,
});
assert.ok(qaEnter.ok, qaEnter.message);
for (let i = 0; i < 2; i++) {
  const c = store.worldBossClick(user1, {
    characterId: "c1",
    charName: "HeroOne",
    now: now0 + 2_500_200 + i * 200,
  });
  assert.ok(c.ok, c.message);
}
store.worldBossForceEnd({ now: now0 + 2_500_800 });
const qaClaim = store.worldBossClaim(user1, { now: now0 + 2_501_000 });
assert.ok(qaClaim.ok, qaClaim.message);
assert.ok(qaClaim.loot && qaClaim.loot.accessoryId === "queen_ant_ring");

// --- World boss swipe anti-bot ---
const swipeStart = store.worldBossForceStart({ now: now0 + 3_500_000, bossId: "world_zaken" });
assert.ok(swipeStart.ok);
const swipeEnter = store.worldBossEnter(user1, {
  characterId: "c1",
  charName: "HeroOne",
  level: 25,
  now: now0 + 3_500_100,
});
assert.ok(swipeEnter.ok, swipeEnter.message);
let swipeHit = null;
for (let i = 0; i < 3; i++) {
  swipeHit = store.worldBossClick(user1, {
    characterId: "c1",
    charName: "HeroOne",
    now: now0 + 3_500_200 + i * 200,
    _testSwipeNextAt: 3,
  });
  assert.ok(swipeHit.ok, swipeHit.message);
}
assert.ok(swipeHit.swipeRequired || swipeHit.state.my.swipeRequired, "swipe should trigger at 3");
assert.strictEqual(swipeHit.state.my.hits, 3);
assert.ok(swipeHit.state.my.damage >= 3);
const blocked = store.worldBossClick(user1, {
  characterId: "c1",
  now: now0 + 3_501_000,
});
assert.ok(!blocked.ok && blocked.error === "swipe", "hits blocked during swipe");
const token1 = blocked.state.my.swipeToken;
assert.ok(token1);
const fail1 = store.worldBossSwipe(user1, { success: false, token: token1, now: now0 + 3_501_100 });
assert.ok(fail1.ok && !fail1.swipeOk && !fail1.wiped);
assert.strictEqual(fail1.state.my.swipeFails, 1);
assert.ok(fail1.state.my.swipeRequired);
const token2 = fail1.state.my.swipeToken;
const fail2 = store.worldBossSwipe(user1, { success: false, token: token2, now: now0 + 3_501_200 });
assert.ok(fail2.ok && !fail2.wiped);
assert.strictEqual(fail2.state.my.swipeFails, 2);
const token3 = fail2.state.my.swipeToken;
const wipe = store.worldBossSwipe(user1, { success: false, token: token3, now: now0 + 3_501_300 });
assert.ok(wipe.ok && wipe.wiped);
assert.strictEqual(wipe.state.my.damage, 0);
assert.strictEqual(wipe.state.my.hits, 0);
assert.strictEqual(wipe.state.my.swipeFails, 0);
assert.ok(!wipe.state.my.swipeRequired);

for (let i = 0; i < 2; i++) {
  swipeHit = store.worldBossClick(user1, {
    characterId: "c1",
    damage: 25,
    now: now0 + 3_502_000 + i * 200,
    _testSwipeNextAt: 2,
  });
  assert.ok(swipeHit.ok, swipeHit.message);
}
assert.ok(swipeHit.state.my.swipeRequired);
assert.strictEqual(swipeHit.state.my.damage, 50);
const pass = store.worldBossSwipe(user1, {
  success: true,
  token: swipeHit.state.my.swipeToken,
  now: now0 + 3_502_500,
});
assert.ok(pass.ok && pass.swipeOk);
assert.ok(!pass.state.my.swipeRequired);
assert.strictEqual(pass.state.my.damage, 50);

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
  power: 600,
  characterId: "c3",
  now: now0 + 3_001_000,
});
assert.ok(startFromLfg.ok, startFromLfg.message);
assert.strictEqual(startFromLfg.state.status, "ready");
store.instanceReady(user3, { runId: startFromLfg.state.runId, ready: true, power: 600, characterId: "c3" });
store.instanceReady(user4, { runId: startFromLfg.state.runId, ready: true, power: 580, characterId: "c4" });
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
  power: 600,
  characterId: "c1",
  now: depthsNow,
});
assert.ok(depthsStart.ok, depthsStart.message);
store.instanceReady(user1, {
  runId: depthsStart.state.runId,
  ready: true,
  power: 600,
  characterId: "c1",
});
store.instanceReady(user2, {
  runId: depthsStart.state.runId,
  ready: true,
  power: 580,
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
  // Не даём wave-idle съесть жизни при synthetic now
  const runIdle = [...store._instanceRuns.values()].find((r) => r.id === depthsStart.state.runId);
  if (runIdle?.encounter?.kind === "wave") {
    runIdle.encounter.idleDeadlineAt = tHit + 60_000;
  }
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
      const tK = tHit + 500 + k * 160;
      const run = [...store._instanceRuns.values()].find((r) => r.id === depthsStart.state.runId);
      if (!run || !run.encounter || !run.encounter.anvilActive) {
        roundDone = true;
        break;
      }
      if (Array.isArray(run.encounter.anvilMarks)) {
        for (const m of run.encounter.anvilMarks) {
          m.windowOpen = true;
          m.nextToggleAt = tK + 5000;
        }
      }
      const myMarks = (run.encounter.anvilMarks || []).filter(
        (m) => String(m.ownerUserId) === String(user1.id)
      );
      if (!myMarks.length) continue;
      const mark = myMarks[0];
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
  power: 600,
  characterId: "c1",
  now: wipeNow,
});
assert.ok(wipeStart.ok, wipeStart.message);
store.instanceReady(user1, { runId: wipeStart.state.runId, ready: true, power: 600, characterId: "c1" });
store.instanceReady(user2, { runId: wipeStart.state.runId, ready: true, power: 580, characterId: "c2" });
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
  const runIdle = [...store._instanceRuns.values()].find((r) => r.id === wipeStart.state.runId);
  if (runIdle?.encounter?.kind === "wave") {
    runIdle.encounter.idleDeadlineAt = tHit + 60_000;
  }
  if (enc && enc.kind === "boss" && enc.anvilActive) {
    const run = [...store._instanceRuns.values()].find((r) => r.id === wipeStart.state.runId);
    const failMax = Math.max(1, enc.anvilFailMax || 10);
    for (let f = 0; f < failMax + 2; f++) {
      if (!run || !run.encounter || !run.encounter.anvilActive) break;
      if (Array.isArray(run.encounter.anvilMarks)) {
        for (const m of run.encounter.anvilMarks) {
          m.windowOpen = true;
          m.nextToggleAt = tHit + 5000 + f * 200;
        }
      }
      const foreign = (run.encounter.anvilMarks || []).find(
        (m) => String(m.ownerUserId) !== String(user1.id)
      );
      const mark = foreign || (run.encounter.anvilMarks || [])[0];
      if (!mark) break;
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

// --- Некрополь: адды блокируют босса, дедлайн жжёт life ---
const addsNow = Date.now();
const addsStart = store.instanceStart(user1, {
  dungeonId: "dungeon_catacomb",
  power: 400,
  characterId: "c1",
  powers: { [user1.id]: 400, [user2.id]: 380 },
  now: addsNow,
});
assert.ok(addsStart.ok, addsStart.message);
store.instanceReady(user1, { runId: addsStart.state.runId, ready: true, power: 400, characterId: "c1" });
store.instanceReady(user2, { runId: addsStart.state.runId, ready: true, power: 380, characterId: "c2" });
let sawAdds = false;
let addsCleared = false;
for (let i = 0; i < 10000 && !addsCleared; i++) {
  const snap = store.instanceState(user1, { runId: addsStart.state.runId });
  if (!snap.state || snap.state.status === "failed" || snap.state.status === "cleared") break;
  const enc = snap.state.encounter;
  const tHit = addsNow + 1500 + i * 160;
  const runIdle = [...store._instanceRuns.values()].find((r) => r.id === addsStart.state.runId);
  if (runIdle?.encounter?.kind === "wave") {
    runIdle.encounter.idleDeadlineAt = tHit + 60_000;
  }
  if (enc && enc.kind === "boss" && enc.addsActive) {
    sawAdds = true;
    const boss = (enc.mobs || [])[0];
    const blocked = store.instanceHit(user1, {
      runId: addsStart.state.runId,
      dmg: 500,
      mobId: boss.id,
      now: tHit,
    });
    assert.ok(blocked.ok);
    assert.ok(blocked.blocked, "boss blocked while adds alive");
    const aliveAdds = (enc.adds || []).filter((a) => a && !a.dead);
    assert.ok(aliveAdds.length >= 1, "adds spawned");
    for (const add of aliveAdds) {
      for (let k = 0; k < 80; k++) {
        const ha = store.instanceHit(user1, {
          runId: addsStart.state.runId,
          dmg: 400,
          mobId: add.id,
          bySkill: true,
          now: tHit + 200 + k * 160,
        });
        if (ha.addDead || ha.addsDown) break;
        if (ha.state?.status === "failed") break;
      }
    }
    const after = store.instanceState(user1, { runId: addsStart.state.runId });
    if (after.state?.encounter && !after.state.encounter.addsActive) {
      addsCleared = true;
      const boss2 = (after.state.encounter.mobs || [])[0];
      const hpBefore = boss2.hp;
      const hBoss = store.instanceHit(user1, {
        runId: addsStart.state.runId,
        dmg: 300,
        mobId: boss2.id,
        bySkill: true,
        now: tHit + 50_000,
      });
      assert.ok(hBoss.ok && !hBoss.blocked, "boss damage after adds");
      const hpAfter = (hBoss.state?.encounter?.mobs || [])[0]?.hp;
      assert.ok(hpAfter < hpBefore, "boss took damage after adds cleared");
      break;
    }
    continue;
  }
  const targetId = (enc?.mobs || []).find((m) => !m.dead)?.id;
  store.instanceHit(user1, {
    runId: addsStart.state.runId,
    dmg: 500,
    mobId: targetId,
    bySkill: true,
    now: tHit,
  });
}
assert.ok(sawAdds, "catacomb boss should spawn adds");
assert.ok(addsCleared, "adds should be clearable");
store.instanceLeave(user1, { runId: addsStart.state.runId });
store.instanceLeave(user2, { runId: addsStart.state.runId });

// --- Шпиль: канал прерывается скиллом; без скилла — fail ---
const chNow = Date.now();
const chStart = store.instanceStart(user1, {
  dungeonId: "dungeon_spire",
  power: 600,
  characterId: "c1",
  powers: { [user1.id]: 600, [user2.id]: 580 },
  now: chNow,
});
assert.ok(chStart.ok, chStart.message);
store.instanceReady(user1, { runId: chStart.state.runId, ready: true, power: 600, characterId: "c1" });
store.instanceReady(user2, { runId: chStart.state.runId, ready: true, power: 580, characterId: "c2" });

function forceInstanceBoss(runId, dungeonId) {
  const run = [...store._instanceRuns.values()].find((r) => r.id === runId);
  assert.ok(run && run.status === "active", "run active for boss force");
  const dungeon = partyDungeonById(dungeonId);
  assert.ok(dungeon && dungeon.boss, "dungeon boss");
  // Перепрыгиваем волны — тестируем только механики босса
  run.waveIndex = dungeon.waves.length;
  run.phase = "boss";
  run.encounter = null;
  const powers = [...run.members.values()].map((m) => m.power);
  const { partyInstanceMobMaxHp: hpFn } = require(path.join(
    __dirname,
    "..",
    "src",
    "data",
    "party-content-data.js"
  ));
  const maxHp = hpFn(dungeon.boss, dungeon, run.members.size, powers);
  const packId = "test_boss_" + runId;
  run.encounter = {
    id: packId,
    kind: "boss",
    name: dungeon.boss.name,
    phaseLabel: null,
    mechanic: null,
    toughness: 1,
    regen: false,
    phases: dungeon.boss.phases || null,
    enrageMs: dungeon.boss.enrageMs || 0,
    enrageAt: Date.now() + (dungeon.boss.enrageMs || 120000),
    regenPulseMs: dungeon.boss.regenPulseMs || 0,
    regenPct: dungeon.boss.regenPct || 0,
    nextRegenAt: Date.now() + 2000,
    lastHitAt: Date.now(),
    idleDeadlineAt: 0,
    lastSkillHitAt: 0,
    mobs: [
      {
        id: packId + "_0",
        name: dungeon.boss.name,
        mob: dungeon.boss.mob,
        hp: maxHp,
        maxHp,
        dead: false,
        shieldHp: 0,
        shieldMax: 0,
      },
    ],
  };
  return run;
}

const { partyDungeonById } = require(path.join(
  __dirname,
  "..",
  "src",
  "data",
  "party-content-data.js"
));
forceInstanceBoss(chStart.state.runId, "dungeon_spire");

let sawChannel = false;
let interrupted = false;
for (let i = 0; i < 8000 && !interrupted; i++) {
  const snap = store.instanceState(user1, { runId: chStart.state.runId });
  if (!snap.state || snap.state.status === "failed" || snap.state.status === "cleared") break;
  const enc = snap.state.encounter;
  const tHit = chNow + 1500 + i * 160;
  if (!enc || enc.kind !== "boss") break;
  const run = [...store._instanceRuns.values()].find((r) => r.id === chStart.state.runId);
  // Снижаем HP до channel-порога (~0.74)
  if (run && run.encounter && run.encounter.mobs && run.encounter.mobs[0]) {
    const boss = run.encounter.mobs[0];
    if (boss.hp / boss.maxHp > 0.74) {
      boss.hp = Math.floor(boss.maxHp * 0.74);
    }
  }
  store.instanceState(user1, { runId: chStart.state.runId });
  if (run && run.encounter && run.encounter.channelArmed && !run.encounter.channelActive) {
    const forceNow = Date.now();
    run.encounter.nextChannelAt = forceNow - 1;
    store.instanceState(user1, { runId: chStart.state.runId, now: forceNow });
  }
  const enc2 = store.instanceState(user1, { runId: chStart.state.runId }).state?.encounter;
  if (enc2 && enc2.channelActive) {
    sawChannel = true;
    const boss = (enc2.mobs || [])[0];
    const hi = store.instanceHit(user1, {
      runId: chStart.state.runId,
      dmg: 200,
      mobId: boss.id,
      bySkill: true,
      skillMult: 1.5,
      now: tHit + 50,
    });
    assert.ok(hi.ok);
    assert.ok(
      hi.state?.lastEvent === "channel_interrupted" ||
        (hi.state?.encounter && !hi.state.encounter.channelActive),
      "skill should interrupt channel"
    );
    interrupted = true;
    break;
  }
  // лёгкий хит чтобы тикнуть фазу
  const boss = (enc.mobs || [])[0];
  store.instanceHit(user1, {
    runId: chStart.state.runId,
    dmg: 20,
    mobId: boss && boss.id,
    now: tHit,
  });
}
assert.ok(sawChannel, "spire boss should start channel");
assert.ok(interrupted, "channel should be interruptible by skill");

store.instanceLeave(user1, { runId: chStart.state.runId });
store.instanceLeave(user2, { runId: chStart.state.runId });
const chFailNow = Date.now();
const chFailStart = store.instanceStart(user1, {
  dungeonId: "dungeon_spire",
  power: 600,
  characterId: "c1",
  powers: { [user1.id]: 600, [user2.id]: 580 },
  now: chFailNow,
});
assert.ok(chFailStart.ok, chFailStart.message);
store.instanceReady(user1, { runId: chFailStart.state.runId, ready: true, power: 600, characterId: "c1" });
store.instanceReady(user2, { runId: chFailStart.state.runId, ready: true, power: 580, characterId: "c2" });
forceInstanceBoss(chFailStart.state.runId, "dungeon_spire");
let channelWiped = false;
for (let i = 0; i < 8000 && !channelWiped; i++) {
  const snap = store.instanceState(user1, { runId: chFailStart.state.runId });
  if (!snap.state) break;
  if (snap.state.status === "failed") {
    channelWiped =
      snap.state.lastEvent === "channel_fail" || snap.state.phase === "wipe";
    break;
  }
  if (snap.state.status === "cleared") break;
  const enc = snap.state.encounter;
  const tHit = chFailNow + 1500 + i * 160;
  const run = [...store._instanceRuns.values()].find((r) => r.id === chFailStart.state.runId);
  if (run && run.encounter && run.encounter.mobs && run.encounter.mobs[0]) {
    const boss = run.encounter.mobs[0];
    if (boss.hp / boss.maxHp > 0.74) boss.hp = Math.floor(boss.maxHp * 0.74);
  }
  store.instanceState(user1, { runId: chFailStart.state.runId });
  if (enc && enc.kind === "boss" && run && run.encounter) {
    if (run.encounter.channelArmed && !run.encounter.channelActive) {
      const forceNow = Date.now();
      run.encounter.nextChannelAt = forceNow - 1;
      run.encounter.channelWindowMs = 400;
      run.encounter.channelFailMax = 1;
      store.instanceState(user1, { runId: chFailStart.state.runId, now: forceNow });
    }
    if (run.encounter.channelActive) {
      const forceNow = Date.now();
      run.encounter.channelEndsAt = forceNow - 1;
      const after = store.instanceState(user1, { runId: chFailStart.state.runId, now: forceNow });
      if (after.state?.status === "failed") {
        channelWiped = after.state.lastEvent === "channel_fail" || after.state.phase === "wipe";
        break;
      }
      continue;
    }
  }
  const boss = (enc?.mobs || [])[0];
  store.instanceHit(user1, {
    runId: chFailStart.state.runId,
    dmg: 20,
    mobId: boss && boss.id,
    now: tHit,
  });
}
assert.ok(channelWiped, "missed channel should wipe at failMax");

console.log("party-content-server.test.js OK");
