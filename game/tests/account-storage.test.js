// ===== Unit: склад аккаунта + почта =====
const assert = require("assert");
const { loadScripts } = require("./setup");

global.state = {
  avatar: { created: true, name: "HeroA", raceId: "human", classId: "fighter" },
  inventory: [],
  characters: [
    {
      id: "c1",
      progress: { avatar: { created: true, name: "HeroA", raceId: "human", classId: "fighter" }, inventory: [] },
    },
    {
      id: "c2",
      progress: { avatar: { created: true, name: "HeroB", raceId: "elf", classId: "mystic" }, inventory: [] },
    },
  ],
  activeCharacterId: "c1",
  accountWarehouse: { items: [] },
  accountMail: { messages: [] },
};

global.ProgressStore = {
  set(key, val) {
    state[key] = val;
  },
};
global.save = () => {};
global.toast = () => {};
global.INV_CAP = 120;
global.WMAP = { sword_a: { id: "sword_a", name: "Test Sword", grade: "A", icon: "x.png", patk: 10, matk: 5, ps: 1, ms: 1 } };
global.invItemDef = (it) => (it && it.id === "sword_a" ? WMAP.sword_a : null);
global.isItemEquipped = () => false;
global.slotIsCreated = (c) => !!(c && c.progress && c.progress.avatar && c.progress.avatar.created);
global.findInvIndexByUid = (uid) => (state.inventory || []).findIndex((it) => it.uid === uid);
global.removeInvByUid = (uid) => {
  const i = findInvIndexByUid(uid);
  if (i < 0) return null;
  return state.inventory.splice(i, 1)[0];
};
global.isInventoryFull = () => (state.inventory || []).length >= INV_CAP;

loadScripts(["src/account-storage-core.js"]);

function test(name, fn) {
  try {
    fn();
    console.log("  ok  " + name);
  } catch (e) {
    console.error("  FAIL  " + name);
    throw e;
  }
}

console.log("account-storage.test.js");

test("deposit and withdraw warehouse", () => {
  state.inventory = [{ uid: "i1", id: "sword_a", plus: 3, spent: 0 }];
  state.accountWarehouse = { items: [] };
  assert.ok(depositInvItemToWarehouse("i1"));
  assert.strictEqual(state.inventory.length, 0);
  assert.strictEqual(state.accountWarehouse.items.length, 1);
  assert.strictEqual(state.accountWarehouse.items[0].plus, 3);
  assert.ok(withdrawWarehouseItemToInv("i1"));
  assert.strictEqual(state.inventory.length, 1);
  assert.strictEqual(state.accountWarehouse.items.length, 0);
});

test("mail send and claim", () => {
  state.inventory = [{ uid: "i2", id: "sword_a", plus: 1, spent: 0 }];
  state.accountMail = { messages: [] };
  state.activeCharacterId = "c1";
  assert.ok(sendAccountMail("i2", "c2", "inv"));
  assert.strictEqual(state.inventory.length, 0);
  assert.strictEqual(mailForCharacter("c2").length, 1);
  assert.strictEqual(mailForCharacter("c1").length, 0);

  state.activeCharacterId = "c2";
  state.avatar = { created: true, name: "HeroB" };
  state.inventory = [];
  const mid = state.accountMail.messages[0].id;
  assert.ok(claimAccountMail(mid));
  assert.strictEqual(state.inventory.length, 1);
  assert.strictEqual(state.inventory[0].uid, "i2");
  assert.ok(state.accountMail.messages[0].claimedAt);
  assert.strictEqual(unreadMailCountForActive(), 0);
});

test("blocks starter; allows mail to any created char including self", () => {
  state.activeCharacterId = "c1";
  state.avatar = { created: true, name: "HeroA" };
  state.inventory = [{ uid: "i3", id: "sword_a", plus: 0, starter: true }];
  assert.ok(!depositInvItemToWarehouse("i3"));
  state.inventory = [{ uid: "i4", id: "sword_a", plus: 0 }];
  state.accountMail = { messages: [] };
  assert.ok(sendAccountMail("i4", "c1", "inv"));
  assert.strictEqual(mailForCharacter("c1").length, 1);
  assert.strictEqual(state.inventory.length, 0);
});

console.log("All account-storage tests passed.");
