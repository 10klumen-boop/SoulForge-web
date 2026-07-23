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
const invite = store.chatInviteParty(user1, { nick: "ChatTwo", now: 5200 });
assert(invite.ok && invite.invited === "ChatTwo", "invite party");

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

const clan = store.chatCreateClan(user1, { name: "Forge", now: 17000 });
assert(clan.ok && clan.clan.name === "Forge", "clan create");
store.chatInviteClan(user1, { nick: "ChatTri", now: 17100 });
const cMsg = store.chatPostMessage(user1, { channel: "clan", body: "клан ок", now: 20000 });
assert(cMsg.ok, "clan msg");
const cTri = store.chatListMessages(user3, { channel: "clan" });
assert(cTri.messages.some((m) => m.body === "клан ок"), "clan member sees");
const cTwo = store.chatListMessages(user2, { channel: "clan" });
assert(cTwo.reason === "no_clan", "non-clan");

console.log("chat tests ok");
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (_) {}
