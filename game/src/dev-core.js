// ===== Dev helpers: пресеты, парсеры, чит-функции =====
// Вынесено из 10-dev.js; UI панели осталось в 10-dev.js.

// ===== Dev-панель (каталог оружия и др., справа от игры) =====

let devPanelOpen = false;
let devTab = "cheats";
let devWorldFilter = "";

// DEV_ADENA_PRESETS и DEV_AVATAR_XP_PRESETS вынесены в data/dev-data.js.


function parseDevAdenaInput(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/[\s,]/g, "");
  if (!s) return 0;
  const m = s.match(/^(\d+(?:\.\d+)?)(kkk|kk|k)?$/);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  const mult = m[2] === "kkk" ? 1e9 : m[2] === "kk" ? 1e6 : m[2] === "k" ? 1e3 : 1;
  return Math.round(parseFloat(m[1]) * mult);
}

function devGrantAdena(amount) {
  if (!FEATURE_DEV_PANEL) return;
  const add = Math.round(Number(amount) || 0);
  if (add <= 0) { toast("Укажи положительную сумму", "warn"); return; }
  ProgressStore.update("adena", (a) => (a || 0) + add);
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + add }));
  save();
  $("#adena").textContent = fmt(state.adena);
  const cur = document.getElementById("devAdenaCur");
  if (cur) cur.textContent = fmt(state.adena);
  Audio2.coin();
  toast("Dev: +" + fmtAdena(add) + " adena", "gold");
}

function devGrantScrollPack(kind) {
  if (!FEATURE_DEV_PANEL) return;
  if (typeof addScroll !== "function") {
    toast("scroll-core не загружен", "warn");
    return;
  }
  const packs = {
    d: [
      ["weapon", "regular", "D", 30],
      ["weapon", "blessed", "D", 8],
      ["armor", "regular", "D", 30],
      ["armor", "blessed", "D", 8],
    ],
    c: [
      ["weapon", "regular", "C", 20],
      ["weapon", "blessed", "C", 6],
      ["weapon", "destruction", "C", 3],
      ["armor", "regular", "C", 20],
      ["armor", "blessed", "C", 6],
      ["armor", "destruction", "C", 3],
    ],
    crystal: [
      ["weapon", "crystal", "D", 2],
      ["armor", "crystal", "D", 2],
      ["weapon", "crystal", "C", 1],
      ["armor", "crystal", "C", 1],
    ],
  };
  const rows = packs[kind] || packs.d;
  rows.forEach((r) => addScroll(r[0], r[1], r[2], r[3]));
  save();
  if (typeof renderInventory === "function") renderInventory();
  Audio2.coin();
  toast("Dev: свитки выданы (" + kind + ")", "loot");
}

function devGrantScroll(target, typeId, grade, qty) {
  if (!FEATURE_DEV_PANEL) return;
  if (typeof addScroll !== "function") {
    toast("scroll-core не загружен", "warn");
    return;
  }
  const n = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)));
  if (!addScroll(target, typeId, grade, n)) {
    toast("Не удалось выдать свиток", "warn");
    return;
  }
  save();
  if (typeof renderInventory === "function") renderInventory();
  Audio2.coin();
  const label =
    typeof scrollLabel === "function"
      ? scrollLabel(target, typeId, grade)
      : typeId + " " + grade;
  toast("Dev: +" + n + " × " + label, "loot");
}

