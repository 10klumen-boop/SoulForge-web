// ===== Казино Банана: UI (экран, барабан, reveal) =====

let _bananaCasinoSpinning = false;
let _bananaCasinoWired = false;

const BANANA_CASINO_REEL_SYMBOLS = [
  { key: "soul", icon: "icons/etc_crystal_white_i00.png" },
  { key: "spirit", icon: "icons/etc_stone_gray_i00.png" },
  { key: "crystal", icon: "icons/scrolls/crystal_D.png?v=5" },
  { key: "banana", icon: "icons/banana_reel.png?v=1" },
  { key: "charm", icon: "icons/banana_lucky_charm.png?v=1" },
  { key: "soul2", icon: "icons/etc_crystal_white_i00.png" },
];

const BANANA_CASINO_BANANA_ICON = "icons/banana_reel.png?v=1";

const BANANA_CASINO_REEL_CELL = 72;
/** Полных циклов символов в ленте — стоп всегда внутри ленты. */
const BANANA_CASINO_REEL_LOOPS = 10;

function openBananaCasino() {
  if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
    if (typeof toast === "function") toast("Сначала создай персонажа", "warn");
    if (typeof maybeShowAvatarSetup === "function") maybeShowAvatarSetup();
    return;
  }
  if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
  ensureBananaCasinoState();
  show("banana-casino");
  renderBananaCasinoScreen();
}

function renderBananaCasinoTileMeta() {
  const el = document.getElementById("bananaCasinoTileMeta");
  if (!el) return;
  const n = typeof bananaCasinoTokens === "function" ? bananaCasinoTokens() : 0;
  el.textContent = n + " жет.";
}

function _bananaCasinoReelCellPx() {
  const reel = document.querySelector(".banana-reel");
  if (!reel) return BANANA_CASINO_REEL_CELL;
  const raw = getComputedStyle(reel).getPropertyValue("--bc-cell").trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : BANANA_CASINO_REEL_CELL;
}

function _bananaCasinoReelStripHtml() {
  const parts = [];
  for (let loop = 0; loop < BANANA_CASINO_REEL_LOOPS; loop++) {
    for (const s of BANANA_CASINO_REEL_SYMBOLS) {
      parts.push(
        '<div class="banana-reel-sym" data-key="' +
          s.key +
          '"><img src="' +
          s.icon +
          '" alt="" draggable="false"></div>'
      );
    }
  }
  return parts.join("");
}

/** Заполнить ленты; в покое — translateY(0), чтобы иконки были в окне. */
function _bananaCasinoEnsureReelsIdle() {
  const root = document.getElementById("screen-banana-casino");
  if (!root) return;
  const need = BANANA_CASINO_REEL_LOOPS * BANANA_CASINO_REEL_SYMBOLS.length;
  root.querySelectorAll(".banana-reel-strip").forEach((strip) => {
    if (!strip.children.length || strip.children.length < need) {
      strip.innerHTML = _bananaCasinoReelStripHtml();
      strip.dataset.ready = "1";
    }
    if (_bananaCasinoSpinning) return;
    strip.classList.remove("is-spinning", "is-stop");
    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";
  });
}

function _bananaCasinoTierLabel(tier) {
  const map = {
    common: "Обычный",
    uncommon: "Необычный",
    rare: "Редкий",
    epic: "Эпик",
    jackpot: "Джекпот",
  };
  return map[tier] || tier;
}

function _bananaCasinoKindIcon(kind, fallback) {
  if (fallback) return fallback;
  const icons = (typeof BANANA_CASINO !== "undefined" && BANANA_CASINO.reelIcons) || {};
  if (kind === "ore") return icons.soul || "icons/etc_crystal_white_i00.png";
  if (kind === "scroll") return icons.crystal || "icons/scrolls/crystal_D.png?v=5";
  if (kind === "charm") return icons.charm || "icons/banana_lucky_charm.png?v=1";
  if (kind === "banana") return icons.banana || BANANA_CASINO_BANANA_ICON;
  return icons.soul || BANANA_CASINO_REEL_SYMBOLS[0].icon;
}

function _bananaCasinoHistoryHtml(bc) {
  const hist = Array.isArray(bc?.history) ? bc.history : [];
  if (!hist.length) {
    return '<p class="banana-casino-empty">Пока пусто — крути барабан удачи.</p>';
  }
  return (
    '<ul class="banana-casino-hist">' +
    hist
      .slice(0, 12)
      .map((h) => {
        const tier = _bananaCasinoTierLabel(h.tier);
        const icon = _bananaCasinoKindIcon(h.kind);
        return (
          '<li class="banana-casino-hist-item tier-' +
          (h.tier || "common") +
          '"><img src="' +
          icon +
          '" alt=""><span class="bch-tier">' +
          tier +
          '</span><span class="bch-label">' +
          (h.label || "—") +
          "</span></li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

function _bananaCasinoPacksHtml() {
  const packs = typeof BANANA_CASINO !== "undefined" ? BANANA_CASINO.tokenPacks || [] : [];
  const fmtA = typeof fmtAdena === "function" ? fmtAdena : (n) => String(n);
  const ico = "icons/banana_token.png?v=1";
  return packs
    .map((p) => {
      const price = typeof bananaCasinoPackPrice === "function" ? bananaCasinoPackPrice(p) : p.price;
      const poor = (state.adena || 0) < price;
      const sub = p.tokens === 1 ? "Один спин" : "Пакет со скидкой";
      return (
        '<button type="button" class="btn btn-ghost banana-casino-buy"' +
        (poor ? " disabled" : "") +
        ' data-pack="' +
        p.id +
        '">' +
        '<img class="banana-buy-ico" src="' +
        ico +
        '" alt="" draggable="false">' +
        '<span class="banana-buy-copy"><span class="banana-buy-title">' +
        p.label +
        '</span><span class="banana-buy-sub">' +
        sub +
        "</span></span>" +
        '<span class="banana-buy-price">' +
        fmtA(price) +
        "</span></button>"
      );
    })
    .join("");
}

function _bananaCasinoSetPityUi(bc) {
  const rareNeed = (typeof BANANA_CASINO !== "undefined" && BANANA_CASINO.pityRare) || 40;
  const jpNeed = (typeof BANANA_CASINO !== "undefined" && BANANA_CASINO.pityJackpot) || 200;
  const pity = bc.pity || 0;
  const pityJp = bc.pityJackpot || 0;
  const rarePct = Math.min(100, Math.round((pity / rareNeed) * 100));
  const jpPct = Math.min(100, Math.round((pityJp / jpNeed) * 100));

  const rareFill = document.getElementById("bananaPityRareFill");
  const jpFill = document.getElementById("bananaPityJpFill");
  const rareText = document.getElementById("bananaPityRareText");
  const jpText = document.getElementById("bananaPityJpText");
  if (rareFill) rareFill.style.width = rarePct + "%";
  if (jpFill) jpFill.style.width = jpPct + "%";
  if (rareText) rareText.textContent = pity + "/" + rareNeed;
  if (jpText) jpText.textContent = pityJp + "/" + jpNeed;
}

function _bananaCasinoSetMachineState(cls, on) {
  const machine = document.getElementById("bananaMachine");
  if (!machine) return;
  machine.classList.toggle(cls, !!on);
}

function _bananaCasinoFlash() {
  const el = document.getElementById("bananaSpinFlash");
  if (!el) return;
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  setTimeout(() => {
    el.hidden = true;
  }, 560);
}

function renderBananaCasinoScreen() {
  ensureBananaCasinoState();
  const bc = state.bananaCasino || defaultBananaCasinoState();
  const tokensEl = document.getElementById("bananaCasinoTokens");
  if (tokensEl) tokensEl.textContent = String(bananaCasinoTokens());

  _bananaCasinoSetPityUi(bc);

  const packsRoot = document.getElementById("bananaCasinoPacks");
  if (packsRoot) packsRoot.innerHTML = _bananaCasinoPacksHtml();

  const histRoot = document.getElementById("bananaCasinoHistory");
  if (histRoot) histRoot.innerHTML = _bananaCasinoHistoryHtml(bc);

  const hint = document.getElementById("bananaCasinoHint");
  if (hint) {
    const t = bananaCasinoTokens();
    hint.textContent = _bananaCasinoSpinning
      ? "Барабаны крутятся…"
      : t < 1
        ? "Нет жетонов — поймай Банана или купи ниже."
        : "Жетон падает с редкого гнома или покупается ниже.";
  }

  const spin1 = document.getElementById("bananaCasinoSpin1");
  const spin10 = document.getElementById("bananaCasinoSpin10");
  const tokens = bananaCasinoTokens();
  if (spin1) spin1.disabled = _bananaCasinoSpinning || tokens < 1;
  if (spin10) spin10.disabled = _bananaCasinoSpinning || tokens < 10;

  renderBananaCasinoTileMeta();
  wireBananaCasinoUi();
  _bananaCasinoEnsureReelsIdle();
}

function _bananaCasinoIconForLoot(loot) {
  if (!loot) return BANANA_CASINO_REEL_SYMBOLS[0].icon;
  return _bananaCasinoKindIcon(loot.kind, loot.icon);
}

function _bananaCasinoAnimateReels(finalIcons) {
  return new Promise((resolve) => {
    const reels = document.querySelectorAll(".banana-reel-strip");
    if (!reels.length) {
      resolve();
      return;
    }
    const icons = Array.isArray(finalIcons)
      ? finalIcons
      : [finalIcons, finalIcons, finalIcons];
    const reduced =
      typeof prefersReducedMotion === "function" && prefersReducedMotion();
    const duration = reduced ? 160 : 2000;
    const stagger = reduced ? 0 : 220;
    const cellH = _bananaCasinoReelCellPx();
    const nSym = BANANA_CASINO_REEL_SYMBOLS.length;
    // Стоп внутри предпоследнего цикла — всегда есть ячейка под окном
    const stopCycle = Math.max(1, BANANA_CASINO_REEL_LOOPS - 2);

    reels.forEach((strip, i) => {
      strip.innerHTML = _bananaCasinoReelStripHtml();
      strip.dataset.ready = "1";
      strip.classList.remove("is-spinning", "is-stop");
      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      void strip.offsetWidth;

      const stopIndex = stopCycle * nSym + (i % nSym);
      const offset = stopIndex * cellH;
      strip.style.transition =
        "transform " + (duration + i * stagger) + "ms cubic-bezier(0.08, 0.82, 0.16, 1)";
      strip.classList.add("is-spinning");
      strip.style.transform = "translateY(-" + offset + "px)";

      setTimeout(() => {
        strip.classList.remove("is-spinning");
        strip.classList.add("is-stop");
        strip.style.transition = "none";
        strip.style.transform = "translateY(-" + offset + "px)";
        const cell = strip.children[stopIndex];
        const img = cell && cell.querySelector("img");
        const icon = icons[i] || icons[0];
        if (img && icon) img.src = icon;
      }, duration + i * stagger);
    });

    setTimeout(resolve, duration + (reels.length - 1) * stagger + 100);
  });
}

function _bananaCasinoShowReveal(results) {
  if (!results || !results.length) return;
  const best = results.reduce((a, b) => {
    const rank = { common: 1, uncommon: 2, rare: 3, epic: 4, jackpot: 5 };
    return (rank[b.tier] || 0) >= (rank[a.tier] || 0) ? b : a;
  }, results[0]);

  if (best.tier === "jackpot" && typeof Audio2 !== "undefined" && Audio2.jackpot) Audio2.jackpot();
  else if ((best.tier === "epic" || best.tier === "rare") && typeof Audio2 !== "undefined" && Audio2.treasure) {
    Audio2.treasure();
  } else if (typeof Audio2 !== "undefined" && Audio2.success) Audio2.success();

  const list = results
    .map((r) => {
      const icon =
        r.tier === "jackpot"
          ? (typeof BANANA_CASINO !== "undefined" && BANANA_CASINO.reelIcons?.banana) ||
            BANANA_CASINO_BANANA_ICON
          : _bananaCasinoIconForLoot(r.loot);
      const cls = "tier-" + (r.tier || "common");
      return (
        '<div class="banana-reveal-row ' +
        cls +
        '"><span class="banana-reveal-ico"><img src="' +
        icon +
        '" alt=""></span><span class="br-meta"><span class="br-tier">' +
        _bananaCasinoTierLabel(r.tier) +
        '</span><span class="br-label">' +
        (r.label || r.res?.text || "—") +
        "</span></span></div>"
      );
    })
    .join("");

  const title =
    results.length === 1
      ? best.tier === "jackpot"
        ? "Джекпот!"
        : best.tier === "epic" || best.tier === "rare"
          ? "Удачный спин"
          : "Выигрыш"
      : "×" + results.length + " круток";

  const heroSub =
    best.tier === "jackpot"
      ? "Три банана! Талисман твой."
      : best.tier === "epic" || best.tier === "rare"
        ? "Барабан улыбнулся"
        : "Награды с барабана";

  const html =
    '<div class="banana-reveal">' +
    '<div class="banana-reveal-hero">' +
    '<div class="banana-reveal-mascot"><img src="assets/ui/banana-casino/mascot.png?v=2" alt="" draggable="false"></div>' +
    '<div class="banana-reveal-hero-copy">' +
    '<span class="banana-reveal-eyebrow">SoulForge · удача</span>' +
    '<strong class="banana-reveal-hero-title">' +
    title +
    "</strong>" +
    '<span class="banana-reveal-hero-sub">' +
    heroSub +
    "</span>" +
    "</div></div>" +
    '<div class="banana-reveal-list">' +
    list +
    "</div></div>";

  if (typeof showConfirm === "function") {
    showConfirm({
      title: title,
      html: html,
      okText: "Забрать",
      hideCancel: true,
      boxClass: "banana-reveal-modal",
    });
  } else if (typeof toast === "function") {
    toast(results.map((r) => r.label).join(", "), "loot");
  }
}

async function _bananaCasinoDoSpin(count) {
  if (_bananaCasinoSpinning) return;
  const can = canSpinBananaCasino(count);
  if (!can.ok) {
    if (typeof toast === "function") {
      toast(
        can.reason === "no_tokens"
          ? "Нужно жетонов: " + can.need
          : "Нельзя крутить",
        "warn"
      );
    }
    return;
  }

  _bananaCasinoSpinning = true;
  _bananaCasinoSetMachineState("is-spinning", true);
  _bananaCasinoSetMachineState("is-win", false);
  renderBananaCasinoScreen();

  if (typeof Audio2 !== "undefined" && Audio2.charge) Audio2.charge();

  const outcome = spinBananaCasino(count);
  if (!outcome.ok) {
    _bananaCasinoSpinning = false;
    _bananaCasinoSetMachineState("is-spinning", false);
    renderBananaCasinoScreen();
    return;
  }

  const best = outcome.results.reduce((a, b) => {
    const rank = { common: 1, uncommon: 2, rare: 3, epic: 4, jackpot: 5 };
    return (rank[b.tier] || 0) >= (rank[a.tier] || 0) ? b : a;
  }, outcome.results[0]);
  const bananaIco =
    (typeof BANANA_CASINO !== "undefined" && BANANA_CASINO.reelIcons?.banana) ||
    BANANA_CASINO_BANANA_ICON;
  const finalIcons =
    best.tier === "jackpot"
      ? [bananaIco, bananaIco, bananaIco]
      : (() => {
          const ico = _bananaCasinoIconForLoot(best.loot);
          return [ico, ico, ico];
        })();

  try {
    await _bananaCasinoAnimateReels(finalIcons);
  } catch (e) {
    console.error("banana reel anim:", e);
  }

  _bananaCasinoSpinning = false;
  _bananaCasinoSetMachineState("is-spinning", false);
  _bananaCasinoSetMachineState("is-win", true);
  _bananaCasinoFlash();
  setTimeout(() => _bananaCasinoSetMachineState("is-win", false), 750);

  renderBananaCasinoScreen();
  _bananaCasinoShowReveal(outcome.results);
}

function wireBananaCasinoUi() {
  if (_bananaCasinoWired) return;
  const root = document.getElementById("screen-banana-casino");
  if (!root) return;
  _bananaCasinoWired = true;

  const back = document.getElementById("bananaCasinoBackBtn");
  if (back) {
    back.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      if (typeof renderMenu === "function") renderMenu();
      show("menu");
    };
  }

  const spin1 = document.getElementById("bananaCasinoSpin1");
  if (spin1) spin1.onclick = () => _bananaCasinoDoSpin(1);
  const spin10 = document.getElementById("bananaCasinoSpin10");
  if (spin10) spin10.onclick = () => _bananaCasinoDoSpin(10);

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".banana-casino-buy");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    if (typeof buyBananaCasinoTokenPack === "function") {
      buyBananaCasinoTokenPack(btn.dataset.pack);
    }
  });

  root.querySelectorAll(".banana-reel-strip").forEach((strip) => {
    strip.innerHTML = _bananaCasinoReelStripHtml();
    strip.dataset.ready = "1";
  });
  _bananaCasinoEnsureReelsIdle();
}
