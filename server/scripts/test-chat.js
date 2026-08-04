#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { createStore } = require("../db");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-chat-"));
const dbPath = path.join(tmpDir, "test.db");
const store = createStore({ dataDir: tmpDir, dbPath });

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

const u1 = store.insertUser("ChatOne", bcrypt.hashSync("pass1234", 4), Date.now());
const u2 = store.insertUser("ChatTwo", bcrypt.hashSync("pass1234", 4), Date.now());
const u3 = store.insertUser("ChatTri", bcrypt.hashSync("pass1234", 4), Date.now());
const user1 = { id: u1.id, nick: "ChatOne" };
const user2 = { id: u2.id, nick: "ChatTwo" };
const user3 = { id: u3.id, nick: "ChatTri" };

const empty = store.chatPostMessage(user1, { body: "   ", now: 1000 });
assert(!empty.ok && empty.error === "empty", "reject empty");

const a = store.chatPostMessage(user1, { channel: "world", body: "привет мир", charName: "HeroA", now: 2000 });
assert(a.ok && a.message.channel === "world", "world post");

const rate = store.chatPostMessage(user1, { body: "рано", now: 2500 });
assert(!rate.ok && rate.error === "rate", "rate limit");

const trade = store.chatPostMessage(user2, { channel: "trade", body: "продаю D", now: 2600 });
assert(trade.ok && trade.message.channel === "trade", "trade post");

const worldList = store.chatListMessages(user1, { channel: "world", after: 0 });
assert(worldList.messages.length === 1 && worldList.messages[0].body === "привет мир", "world filter");

const tradeList = store.chatListMessages(user1, { channel: "trade", after: 0 });
assert(tradeList.messages.length === 1, "trade filter");

const noParty = store.chatPostMessage(user1, { channel: "party", body: "hey", now: 5000 });
assert(!noParty.ok && noParty.error === "no_party", "party requires membership");

const party = store.chatCreateParty(user1, { now: 5100 });
assert(party.ok && party.party, "create party");

// Имена персонажей для invite (не логин)
store.persistPlayerSave(user1, 1, Date.now(), "test", {
  activeCharacterId: "c1",
  characters: [{ id: "c1", progress: { avatar: { created: true, name: "HeroA", level: 10, raceId: "human", classId: "fighter", genderId: "male" }, adena: 0 } }],
  avatar: { created: true, name: "HeroA", level: 10, raceId: "human", classId: "fighter", genderId: "male" },
  adena: 0,
});
store.persistPlayerSave(user2, 1, Date.now(), "test", {
  activeCharacterId: "c2",
  characters: [{ id: "c2", progress: { avatar: { created: true, name: "HeroB", level: 10, raceId: "human", classId: "fighter", genderId: "male" }, adena: 0 } }],
  avatar: { created: true, name: "HeroB", level: 10, raceId: "human", classId: "fighter", genderId: "male" },
  adena: 0,
});

const invite = store.chatInviteParty(user1, { charName: "HeroB", now: 5200 });
assert(invite.ok && invite.pending && invite.invited === "HeroB", "invite party pending");
const invList = store.chatListPartyInvites(user2);
assert(invList.invites.length === 1, "pending invite listed");
const accept = store.chatRespondPartyInvite(user2, { inviteId: invList.invites[0].id, accept: true, now: 5250 });
assert(accept.ok && accept.accepted && accept.party.members.length === 2, "accept invite");

const pMsg = store.chatPostMessage(user1, { channel: "party", body: "в группу", now: 8000 });
assert(pMsg.ok && pMsg.message.scopeId, "party message");
const pList2 = store.chatListMessages(user2, { channel: "party" });
assert(pList2.messages.some((m) => m.body === "в группу"), "party member sees");
const pList3 = store.chatListMessages(user3, { channel: "party" });
assert(pList3.messages.length === 0 && pList3.reason === "no_party", "outsider no party");

const whisper = store.chatPostMessage(user1, {
  channel: "whisper",
  body: "псст",
  toNick: "ChatTwo",
  now: 11000,
});
assert(whisper.ok && whisper.message.targetNick === "ChatTwo", "whisper");
const w1 = store.chatListMessages(user1, { channel: "whisper" });
const w2 = store.chatListMessages(user2, { channel: "whisper" });
const w3 = store.chatListMessages(user3, { channel: "whisper" });
assert(w1.messages.length === 1 && w2.messages.length === 1, "whisper visible to pair");
assert(w3.messages.length === 0, "whisper private");

const viaCmd = store.chatPostMessage(user2, {
  body: "/w ChatOne ответ",
  now: 14000,
});
assert(viaCmd.ok && viaCmd.message.channel === "whisper", "slash whisper");

store.persistPlayerSave(user3, 1, Date.now(), "test", {
  activeCharacterId: "c3",
  characters: [{ id: "c3", progress: { avatar: { created: true, name: "HeroC", level: 10, raceId: "human", classId: "fighter", genderId: "male" }, adena: 0 } }],
  avatar: { created: true, name: "HeroC", level: 10, raceId: "human", classId: "fighter", genderId: "male" },
  adena: 0,
});

const clan = store.chatCreateClan(user1, { name: "Forge", now: 17000 });
assert(clan.ok && clan.clan.name === "Forge", "clan create");
const clanInv = store.chatInviteClan(user1, { charName: "HeroC", now: 17100 });
assert(clanInv.ok && clanInv.pending, "clan invite pending");
const clanInvList = store.chatListClanInvites(user3);
assert(clanInvList.invites.length === 1, "clan invite listed");
const clanAccept = store.chatRespondClanInvite(user3, {
  inviteId: clanInvList.invites[0].id,
  accept: true,
  now: 17200,
});
assert(clanAccept.ok && clanAccept.accepted, "clan invite accept");
const cMsg = store.chatPostMessage(user1, { channel: "clan", body: "клан ок", now: 20000 });
assert(cMsg.ok, "clan msg");
const cTri = store.chatListMessages(user3, { channel: "clan" });
assert(cTri.messages.some((m) => m.body === "клан ок"), "clan member sees");
const cTwo = store.chatListMessages(user2, { channel: "clan" });
assert(cTwo.reason === "no_clan", "non-clan");

// --- Мировые оповещения ---
const annLow = store.chatAnnounceWorld(user2, {
  type: "enchant_high",
  payload: { itemName: "Sword", grade: "D", plus: 14, kind: "weapon" },
  charName: "HeroB",
  now: 25000,
});
assert(!annLow.ok && annLow.error === "payload", "enchant +14 weapon not announced");

const annArmorLow = store.chatAnnounceWorld(user2, {
  type: "enchant_high",
  payload: { itemName: "Plate", grade: "C", plus: 10, kind: "armor" },
  charName: "HeroB",
  now: 25000,
});
assert(!annArmorLow.ok && annArmorLow.error === "payload", "armor +10 not announced");

const annOk = store.chatAnnounceWorld(user2, {
  type: "enchant_high",
  payload: { itemName: "Sword", grade: "C", plus: 16, kind: "weapon" },
  charName: "HeroB",
  now: 25000,
});
assert(annOk.ok && annOk.message.msgType === "announce", "enchant +16 announce");
assert(annOk.message.channel === "world", "announce channel world");
assert(/ЛЕГЕНДА/.test(annOk.message.body) && /HeroB/.test(annOk.message.body), "legend copy");
assert(annOk.message.nick === "Мир", "announce nick Мир");

const annRate = store.chatAnnounceWorld(user2, {
  type: "banan_zaken",
  charName: "HeroB",
  now: 26000,
});
assert(!annRate.ok && annRate.error === "rate", "announce rate limit");

const annArmor = store.chatAnnounceWorld(user2, {
  type: "enchant_high",
  payload: { itemName: "Plate", grade: "C", plus: 12, kind: "armor" },
  charName: "HeroB",
  now: 35000,
});
assert(annArmor.ok && /\+12/.test(annArmor.message.body), "armor +12 announce");

const annZaken = store.chatAnnounceWorld(user3, {
  type: "banan_zaken",
  charName: "HeroC",
  now: 36000,
});
assert(annZaken.ok && /ЗакАна/.test(annZaken.message.body), "zaken announce");

const annAdena = store.chatAnnounceWorld(user1, {
  type: "banan_adena",
  payload: { amount: 500_000_000 },
  charName: "HeroA",
  now: 37000,
});
assert(annAdena.ok && /500кк/.test(annAdena.message.body), "adena jackpot announce");

const annCasino = store.chatAnnounceWorld(user3, {
  type: "casino_jackpot",
  payload: { itemName: "Талисман Банана" },
  charName: "HeroC",
  now: 45000,
});
assert(annCasino.ok && /Талисман/.test(annCasino.message.body), "casino jackpot announce");

const worldAfter = store.chatListMessages(user3, { channel: "world", after: 0 });
assert(
  worldAfter.messages.filter((m) => m.msgType === "announce").length >= 3,
  "announces visible in world"
);

const badType = store.chatAnnounceWorld(user1, { type: "fake_event", now: 50000 });
assert(!badType.ok && badType.error === "type", "reject unknown type");

console.log("chat tests ok");
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (_) {}
