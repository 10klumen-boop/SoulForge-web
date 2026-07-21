// ===== Аксессуары (серьга Закена и др.) =====
let curAcc = null;

function removeInvItem(uid) {
  ProgressStore.set("inventory", (state.inventory || []).filter((x) => x.uid !== uid));
  save();
}

function openAccessory(item) {
  const def = COLLECTIBLES[item.id];
  if (!def || !isAccessoryItem(item)) return;
  curAcc = { item, def };
  renderAccessory();
  show("acc");
}

function renderAccessory() {
  if (!curAcc) return;
  const { item, def } = curAcc;
  $("#accTitle").textContent = def.name;
  $("#accImg").src = def.icon;
  $("#accName").textContent = def.name;
  $("#accNote").textContent = def.desc || "Эпический аксессуар";
  const worn = typeof isItemEquipped === "function" && isItemEquipped(item.uid);
  const eqBtn = $("#accEquipBtn");
  eqBtn.disabled = worn || !state.avatar?.created;
  eqBtn.textContent = worn ? "Уже надето" : state.avatar?.created ? "⚡ Надеть на персонажа" : "Создай персонажа";
  const fpIco = $("#accFunpayBtn img");
  if (fpIco) fpIco.src = FUNPAY_ICON;
}

function equipAccessory() {
  if (!curAcc) return;
  const { item, def } = curAcc;
  if (typeof isItemEquipped === "function" && isItemEquipped(item.uid)) {
    toast("Уже надето", "warn");
    return;
  }
  if (typeof equipAccessoryToAvatar === "function" && equipAccessoryToAvatar(item)) {
    curAcc = null;
    goInventory();
    return;
  }
  toast("Не удалось надеть", "warn");
}

async function funpayAccessory() {
  if (!curAcc) return;
  const { item, def } = curAcc;
  const ok = await showConfirm({
    title: "FunPay",
    html: `<div class="modal-funpay">
      <p>Хрюкнуть <b>${def.name}</b> на FunPay?</p>
      <p class="modal-funpay-risk">50% шанс потерять <b>весь прогресс</b> навсегда.</p>
    </div>`,
    okText: "Хрюкнуть",
    cancelText: "Отмена",
    danger: true,
  });
  if (!ok) return;
  removeInvItem(item.uid);
  curAcc = null;
  const wiped = Math.random() < funpayWipeChance();
  if (wiped) {
    stopMine();
    if (pipWindow && !pipWindow.closed) pipWindow.close();
    resetProgress();
    syncSettingsUI();
    $("#adena").textContent = fmt(state.adena);
    renderMenu();
    show("menu");
    Audio2.fail();
    toast("FunPay: провал — весь прогресс уничтожен!", "fail");
  } else {
    const reward = playtestIncome(funpayReward());
    ProgressStore.update("adena", (a) => (a || 0) + reward);
    ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + reward }));
    Audio2.coin();
    save();
    $("#adena").textContent = fmt(state.adena);
    toast("FunPay: " + def.name + " продана — +" + fmt(reward) + " adena", "gold");
    if (typeof achStat === "function") achStat("funpayWins", 1);
    goInventory();
    if (typeof checkAchievements === "function") checkAchievements();
  }
}
