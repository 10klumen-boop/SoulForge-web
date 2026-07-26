"use strict";

const crypto = require("crypto");
const path = require("path");
const balance = require(path.join(
  __dirname,
  "..",
  "..",
  "game",
  "src",
  "data",
  "party-content-data.js"
));

const PARTY_CONTENT = balance.PARTY_CONTENT || { maxMembers: 4, minMembers: 2 };
const partyDungeonById = balance.partyDungeonById;
const LFG_TTL_MS = 15 * 60 * 1000;

function newId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

/**
 * Доска набора в инстансы (LFG listings).
 * @param {import("better-sqlite3").Database} db
 * @param {object} store
 */
function attachPartyLfgMethods(db, store) {
  /** @type {Map<string, object>} listingId -> listing */
  const listings = new Map();
  /** @type {Map<string, string>} partyId -> listingId */
  const byParty = new Map();

  function partySnap(userId) {
    if (typeof store.chatGetSocial !== "function") return null;
    return store.chatGetSocial(userId)?.party || null;
  }

  function prune(now) {
    now = Number(now) || Date.now();
    for (const [id, row] of [...listings.entries()]) {
      if (!row || row.expiresAt <= now) {
        listings.delete(id);
        if (row && byParty.get(row.partyId) === id) byParty.delete(row.partyId);
      }
    }
  }

  function refreshCounts(listing) {
    if (!listing) return;
    const party = partySnap(listing.leaderUserId);
    if (!party || party.id !== listing.partyId) {
      listings.delete(listing.id);
      byParty.delete(listing.partyId);
      return null;
    }
    listing.membersCount = (party.members || []).length;
    listing.leaderNick = party.members?.find((m) => m.userId === party.leaderUserId)?.nick || listing.leaderNick;
    listing.leaderName =
      party.members?.find((m) => m.userId === party.leaderUserId)?.name ||
      party.members?.find((m) => m.userId === party.leaderUserId)?.charName ||
      listing.leaderName;
    if (listing.membersCount >= (listing.maxMembers || PARTY_CONTENT.maxMembers || 4)) {
      listings.delete(listing.id);
      byParty.delete(listing.partyId);
      return null;
    }
    return listing;
  }

  function publicListing(row) {
    if (!row) return null;
    return {
      id: row.id,
      partyId: row.partyId,
      dungeonId: row.dungeonId,
      dungeonName: row.dungeonName,
      note: row.note || "",
      membersCount: row.membersCount,
      maxMembers: row.maxMembers,
      leaderUserId: row.leaderUserId,
      leaderName: row.leaderName || row.leaderNick || "?",
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  store.partyLfgClearParty = function partyLfgClearParty(partyId) {
    const id = byParty.get(partyId);
    if (!id) return;
    listings.delete(id);
    byParty.delete(partyId);
  };

  store.partyLfgOnPartyChange = function partyLfgOnPartyChange(partyId) {
    const id = byParty.get(partyId);
    if (!id) return;
    const row = listings.get(id);
    if (!row) {
      byParty.delete(partyId);
      return;
    }
    const party = partySnap(row.leaderUserId);
    if (!party || party.id !== partyId) {
      store.partyLfgClearParty(partyId);
      return;
    }
    refreshCounts(row);
  };

  store.partyLfgList = function partyLfgList(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    prune(now);
    const mineParty = partySnap(user.id);
    const out = [];
    let mine = null;
    for (const row of [...listings.values()]) {
      const refreshed = refreshCounts(row);
      if (!refreshed) continue;
      const pub = publicListing(refreshed);
      if (mineParty && refreshed.partyId === mineParty.id) mine = pub;
      else out.push(pub);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return { ok: true, listings: out, mine, now };
  };

  store.partyLfgPost = function partyLfgPost(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    prune(now);
    const party = partySnap(user.id);
    if (!party) return { ok: false, error: "party", message: "Нужна группа" };
    if (party.leaderUserId !== user.id) {
      return { ok: false, error: "leader", message: "Публикует только лидер" };
    }
    const dungeonId = String(opts.dungeonId || "");
    const dungeon = typeof partyDungeonById === "function" ? partyDungeonById(dungeonId) : null;
    if (!dungeon) return { ok: false, error: "dungeon", message: "Инстанс не найден" };
    const note = String(opts.note || "")
      .trim()
      .slice(0, 80);
    const membersCount = (party.members || []).length;
    const maxMembers = PARTY_CONTENT.maxMembers || 4;
    if (membersCount >= maxMembers) {
      return { ok: false, error: "full", message: "Группа уже полна" };
    }
    const leader =
      (party.members || []).find((m) => m.userId === user.id) || {};
    const existingId = byParty.get(party.id);
    if (existingId) listings.delete(existingId);
    const id = newId("lfg");
    const row = {
      id,
      partyId: party.id,
      leaderUserId: user.id,
      leaderNick: user.nick,
      leaderName: leader.name || leader.charName || user.nick,
      dungeonId,
      dungeonName: dungeon.name,
      note,
      membersCount,
      maxMembers,
      createdAt: now,
      expiresAt: now + LFG_TTL_MS,
    };
    listings.set(id, row);
    byParty.set(party.id, id);
    return { ok: true, listing: publicListing(row), ...store.partyLfgList(user, { now }) };
  };

  store.partyLfgDelete = function partyLfgDelete(user) {
    const party = partySnap(user.id);
    if (!party) return { ok: false, error: "party", message: "Нет группы" };
    if (party.leaderUserId !== user.id) {
      return { ok: false, error: "leader", message: "Снимает только лидер" };
    }
    store.partyLfgClearParty(party.id);
    return { ok: true, ...store.partyLfgList(user) };
  };

  store.partyLfgJoin = function partyLfgJoin(user, opts = {}) {
    const now = Number(opts.now) || Date.now();
    prune(now);
    const listingId = String(opts.listingId || "").trim();
    const row = listings.get(listingId);
    if (!row || row.expiresAt <= now) {
      if (listingId) listings.delete(listingId);
      return { ok: false, error: "gone", message: "Объявление не найдено или истекло" };
    }
    if (partySnap(user.id)) {
      return { ok: false, error: "busy", message: "Сначала выйди из своей группы" };
    }
    refreshCounts(row);
    const live = listings.get(listingId);
    if (!live) {
      return { ok: false, error: "full", message: "Группа уже набрана" };
    }
    if (typeof store.chatJoinPartyDirect !== "function") {
      return { ok: false, error: "server", message: "Join недоступен" };
    }
    const joined = store.chatJoinPartyDirect(user, {
      partyId: live.partyId,
      charName: opts.charName,
      now,
    });
    if (!joined.ok) return joined;
    store.partyLfgOnPartyChange(live.partyId);
    return {
      ok: true,
      party: joined.party || null,
      clan: joined.clan || null,
      ...store.partyLfgList(user, { now }),
    };
  };
}

module.exports = { attachPartyLfgMethods, LFG_TTL_MS };
