// ===== Enchant: логика заточки и эффекты =====
// UI (openEnchant, renderEnch, renderScrolls, enchFlash) вынесено в enchant-ui.js.


let busy = false;

/** Записать plus/spent экипированного или инвентарного предмета через ProgressStore (не in-place). */
function syncEnchantItemToStore() {
  if (!cur || !cur.item) return;
  const isArmor = cur.kind === "armor";
  const isJew = cur.kind === "accessory" || cur.kind === "jewelry";
  if (cur.equipped) {
    const uid = cur.item.uid;
    const id = cur.item.id;
    const plus = cur.plus | 0;
    const spent = cur.item.spent || 0;
    const starter = !!cur.item.starter;
    const broken = !!cur.broken;
    const slotId = cur.gearSlot || (isArmor || isJew ? null : "weapon");
    if (!slotId) return;
    ProgressStore.update("avatar", (a) => {
      const next = { ...(a || {}) };
      const gear = {
        ...(next.gear || (typeof defaultAvatarGear === "function" ? defaultAvatarGear() : {})),
      };
      if (broken) {
        gear[slotId] = null;
      } else if (isArmor) {
        gear[slotId] = { uid, id, plus, spent, kind: "armor" };
      } else if (isJew) {
        gear[slotId] = { uid, id, plus, spent, kind: "accessory" };
      } else {
        gear[slotId] = { uid, id, plus, spent, kind: "weapon", starter };
      }
      next.gear = gear;
      return next;
    });
    if (!broken) {
      const live = (state.avatar?.gear || {})[slotId];
      if (live) cur.item = live;
    }
    return;
  }
  if (cur.broken) return;
  const uid = cur.item.uid;
  const plus = cur.plus | 0;
  const spent = cur.item.spent || 0;
  ProgressStore.update("inventory", (inv) =>
    (inv || []).map((it) => {
      if (it.uid !== uid) return it;
      if (isArmor) return { ...it, kind: "armor", plus, spent };
      if (isJew) return { ...it, kind: "accessory", plus, spent };
      return { ...it, plus, spent };
    })
  );
  const live = (state.inventory || []).find((it) => it.uid === uid);
  if (live) cur.item = live;
}

function doEnchant() {
  if (busy || (typeof isGamePaused === "function" && isGamePaused())) return;
  if (!cur || cur.broken || !cur.weapon) return;
  const isArmor = cur.kind === "armor";
  const isJew = cur.kind === "accessory" || cur.kind === "jewelry";
  const capPlus =
    typeof enchantItemCapPlus === "function"
      ? enchantItemCapPlus(cur.kind, cur.scroll)
      : typeof scrollMaxPlus === "function"
        ? scrollMaxPlus(cur.scroll)
        : MAX_PLUS;
  if (cur.plus >= capPlus) return;
  const target = isArmor || isJew ? "armor" : "weapon";
  const grade = cur.weapon.grade;
  const sc =
    typeof scrollDef === "function" ? scrollDef(target, grade, cur.scroll) : scrollFor(grade, cur.scroll);
  if (typeof hasScroll === "function" && !hasScroll(target, cur.scroll, grade, 1)) {
    toast("Нет свитка в сумке — фарми зоны или купи на рынке", "warn");
    return;
  }
  const adenaCost = Math.max(0, Math.floor(Number(sc.estimate != null ? sc.estimate : sc.cost) || 0));
  if ((state.adena || 0) < adenaCost) {
    toast("Недостаточно adena!", "warn");
    return;
  }
  busy = true;
  renderEnch();
  if (typeof consumeScroll === "function") {
    if (!consumeScroll(target, cur.scroll, grade, 1)) {
      busy = false;
      toast("Нет свитка в сумке", "warn");
      if (typeof renderScrolls === "function") renderScrolls();
      renderEnch();
      return;
    }
  }
  // Сразу обновить ×N на карточках и в футере — не ждать анимации
  if (typeof renderScrolls === "function") renderScrolls();
  renderEnch();
  if (adenaCost > 0) {
    ProgressStore.update("adena", (a) => Math.max(0, (a || 0) - adenaCost));
  }
  const estimate = adenaCost;
  cur.item.spent = (cur.item.spent || 0) + estimate;
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), tries: (t?.tries || 0) + 1 }));
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5 && typeof achStat === "function") achStat("nightEnchants", 1);
  Audio2.charge();
  const stage = $("#stage");
  stage.classList.add("charging");
  setVerdict("Заточка...", "neutral");
  $("#adena").textContent = fmt(state.adena);
  $("#pSpent").textContent = fmtAdena(cur.item.spent);
  const chance = successChance(cur.plus, sc.behavior);
  const win = Math.random() < chance;
  const itemLabel = isJew ? "бижутерия" : isArmor ? "броня" : "оружие";
  const ItemLabel = isJew ? "Бижутерия" : isArmor ? "Броня" : "Оружие";
  const intactSuffix = isArmor || isJew ? "а" : "";
  setTimeout(() => {
    stage.classList.remove("charging");
    let animMs = 0;
    if (win) {
      cur.plus++;
      cur.item.plus = cur.plus;
      stage.classList.add("success");
      const gi = glowInfo(cur.plus);
      enchFlash("success", gi.color);
      const maxed = cur.plus >= capPlus;
      maxed ? Audio2.jackpot() : Audio2.success();
      enchantFirework(gi.color, maxed ? 52 : 36);
      playEnchantPlusPop(cur.plus, {
        maxed: maxed,
        capLabel: isJew ? "+12!" : capPlus >= MAX_PLUS ? "+16!" : "+" + capPlus + "!",
      });
      animMs = 520;
      setTimeout(() => stage.classList.remove("success"), animMs);
      setTimeout(() => stage.classList.remove("success-flash"), 880);
      setVerdict(
        maxed && isJew
          ? "+12 МАКСИМУМ!"
          : maxed && capPlus >= MAX_PLUS
            ? "+16 МАКСИМУМ — ЛЕГЕНДА!"
            : cur.plus >= 12
              ? "Великолепно! +" + cur.plus
              : "Успех! +" + cur.plus,
        "good"
      );
      gameLog(
        (maxed ? "МАКС! " : "") +
          cur.weapon.name +
          " [" +
          cur.weapon.grade +
          "] → +" +
          cur.plus,
        maxed ? "success" : "enchant"
      );
      if (cur.kind === "weapon") notifyWeaponRecord(cur.weapon, cur.plus);
      if (typeof logCharacterEvent === "function") {
        logCharacterEvent("enchant_ok", {
          itemId: cur.weapon.id,
          itemName: cur.weapon.name,
          weaponId: cur.kind === "weapon" ? cur.weapon.id : undefined,
          weaponName: cur.kind === "weapon" ? cur.weapon.name : undefined,
          kind: cur.kind || "weapon",
          grade: cur.weapon.grade,
          plus: cur.plus,
          scroll: sc.id,
          scrollTarget: target,
          cost: estimate,
        });
      }
    } else {
      ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), fails: (t?.fails || 0) + 1 }));
      Audio2.fail();
      enchFlash("fail");
      stage.classList.add("shake");
      animMs = 420;
      setTimeout(() => stage.classList.remove("shake"), animMs);
      if (sc.behavior === "reset") {
        const plusBefore = cur.plus;
        cur.plus = 0;
        cur.item.plus = 0;
        setVerdict("Провал — заточка сброшена до +0 (" + itemLabel + " цел" + intactSuffix + ")", "bad");
        gameLog("Провал (благ.): " + cur.weapon.name + " — сброс до +0", "fail");
        shards(cur.weapon.glow || "#ffc847", 16);
        if (typeof logCharacterEvent === "function") {
          logCharacterEvent("enchant_fail", {
            itemId: cur.weapon.id,
            itemName: cur.weapon.name,
            kind: cur.kind || "weapon",
            grade: cur.weapon.grade,
            plusBefore,
            scroll: sc.id,
            scrollTarget: target,
            failMode: "reset",
            cost: estimate,
          });
        }
      } else if (sc.behavior === "destruction") {
        const plusBefore = cur.plus;
        setVerdict("Провал — " + itemLabel + " цел" + intactSuffix + " (+" + cur.plus + ")", "bad");
        gameLog("Провал (разруш.): " + cur.weapon.name + " +" + plusBefore + " — без изменений", "fail");
        shards(cur.weapon.glow || "#ffc847", 10);
        if (typeof logCharacterEvent === "function") {
          logCharacterEvent("enchant_fail", {
            itemId: cur.weapon.id,
            itemName: cur.weapon.name,
            kind: cur.kind || "weapon",
            grade: cur.weapon.grade,
            plusBefore,
            scroll: sc.id,
            scrollTarget: target,
            failMode: "destruction",
            cost: estimate,
          });
        }
      } else {
        const plusBefore = cur.plus;
        if (cur.kind === "weapon") notifyWeaponRecord(cur.weapon, cur.plus);
        const yld = crystalYield(cur.weapon, cur.plus);
        const gradeCry = cur.weapon.grade || "D";
        ProgressStore.update("crystals", (c) => {
          const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
          next[gradeCry] = (next[gradeCry] || 0) + yld;
          return next;
        });
        cur.broken = true;
        cur.plus = 0;
        cur.item.plus = 0;
        const plusTag = plusBefore ? " +" + plusBefore : "";
        setVerdict(ItemLabel + " рассыпал" + (isArmor || isJew ? "ась" : "ось") + " → +" + yld + " кристаллов (" + gradeCry + ")", "bad");
        gameLog("Разрушено: " + cur.weapon.name + plusTag + " → +" + yld + " крист. (" + gradeCry + ")", "fail");
        shards(cur.weapon.glow || "#ff5a5a", 22);
        if (typeof logCharacterEvent === "function") {
          logCharacterEvent("enchant_fail", {
            itemId: cur.weapon.id,
            itemName: cur.weapon.name,
            kind: cur.kind || "weapon",
            grade: cur.weapon.grade,
            plus: plusBefore,
            scroll: sc.id,
            scrollTarget: target,
            failMode: "break",
            crystals: yld,
            cost: estimate,
          });
        }
        // Remove broken item from inventory / gear
        if (cur.equipped) {
          syncEnchantItemToStore();
        } else {
          ProgressStore.set("inventory", (state.inventory || []).filter((x) => x.uid !== cur.item.uid));
        }
        if (cur.broken) renderEnch();
      }
    }
    if (!cur.broken) syncEnchantItemToStore();
    if (typeof onEnchantAvatarXp === "function") {
      onEnchantAvatarXp(win, cur.plus, sc.behavior, !!cur.broken);
    }
    save();
    renderMenu();
    if (cur.equipped) {
      if (typeof renderAvatarGearSlots === "function") renderAvatarGearSlots();
      if (typeof renderAvatarHub === "function") renderAvatarHub();
      if (typeof renderMineHudStats === "function") renderMineHudStats();
      if (typeof refreshInvPaperdoll === "function") refreshInvPaperdoll();
    }
    renderEnch();
    if (typeof renderScrolls === "function") renderScrolls();
    setTimeout(() => {
      busy = false;
      if (typeof renderScrolls === "function") renderScrolls();
      renderEnch();
      if (typeof checkAchievements === "function") checkAchievements();
    }, animMs);
  }, 600);
}
function newWeapon() { Audio2.click(); goInventory(); }

/** Обычная продажа с экрана заточки отключена — оружие/броня/бижа только через рынок. */
function sellWeapon() {
  toast("Продажа — на рынке", "warn");
}

function enchantFxOrigin() {
  const stage = $("#stage");
  const wrap = stage && stage.querySelector(".weapon-wrap");
  const sr = stage.getBoundingClientRect();
  const r = (wrap || stage).getBoundingClientRect();
  return {
    cx: r.left - sr.left + r.width / 2,
    cy: r.top - sr.top + r.height / 2,
    stage,
  };
}

function spawnParticle(x, y, color, vx, vy, size, life, cls) {
  const stage = $("#stage");
  if (!stage) return;
  const p = document.createElement("div");
  p.className = "particle" + (cls ? " " + cls : "");
  const w = cls === "streak" ? 2 : size;
  const h = cls === "streak" ? size * 2.2 : size;
  p.style.width = w + "px";
  p.style.height = h + "px";
  p.style.left = x + "px";
  p.style.top = y + "px";
  p.style.background = color;
  p.style.color = color;
  if (cls === "streak") p.style.transform = "rotate(" + (Math.atan2(vy, vx) * 180 / Math.PI + 90) + "deg)";
  else if (cls !== "star") p.style.boxShadow = "0 0 " + (size * 1.2) + "px " + color;
  stage.appendChild(p);
  let t = 0;
  const tick = () => {
    t += 16;
    vy += cls === "star" ? 0.18 : 0.32;
    x += vx;
    y += vy;
    vx *= 0.985;
    const k = 1 - t / life;
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.opacity = Math.max(0, k * k);
    if (cls === "star") p.style.transform = "rotate(" + (t * 0.4) + "deg) scale(" + Math.max(0.15, k) + ")";
    else if (cls === "streak") {
      p.style.transform = "rotate(" + (Math.atan2(vy, vx) * 180 / Math.PI + 90) + "deg) scale(" + Math.max(0.2, k) + ")";
    } else {
      p.style.transform = "scale(" + Math.max(0.1, k) + ")";
    }
    if (t < life) requestAnimationFrame(tick);
    else p.remove();
  };
  requestAnimationFrame(tick);
}

function spawnEnchantRing(cx, cy) {
  const stage = $("#stage");
  if (!stage) return;
  const ring = document.createElement("div");
  ring.className = "ench-ring";
  ring.style.left = cx + "px";
  ring.style.top = cy + "px";
  ring.style.width = "16px";
  ring.style.height = "16px";
  stage.appendChild(ring);
  setTimeout(() => ring.remove(), 780);
}

function enchantFirework(accentColor, count) {
  const { cx, cy, stage } = enchantFxOrigin();
  if (!stage) return;
  const golds = ["#fff4c8", "#ffe082", "#ffc847", "#ffaa28", "#ffd966"];
  if (accentColor && accentColor !== "#5fa8ff") golds.push(accentColor);

  const burst = (n, spread, speed, delay) => {
    setTimeout(() => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.55 + Math.random() * spread);
        const col = golds[Math.floor(Math.random() * golds.length)];
        const roll = Math.random();
        const vx = Math.cos(a) * sp;
        const vy = Math.sin(a) * sp - (2.5 + Math.random() * 2);
        if (roll < 0.22) {
          spawnParticle(cx, cy, col, vx, vy, 5 + Math.random() * 4, 720 + Math.random() * 380, "star");
        } else if (roll < 0.42) {
          spawnParticle(cx, cy, col, vx * 1.1, vy * 1.1, 3 + Math.random() * 3, 560 + Math.random() * 320, "streak");
        } else {
          spawnParticle(cx, cy, col, vx, vy, 3 + Math.random() * 4, 640 + Math.random() * 420, "spark");
        }
      }
    }, delay);
  };

  spawnEnchantRing(cx, cy);
  burst(count, 1, 5.5, 0);
  burst(Math.round(count * 0.45), 1.2, 4.2, 90);
  burst(Math.round(count * 0.25), 0.8, 3.2, 180);
}

function spawn(x, y, color, vx, vy, size, life) {
  spawnParticle(x, y, color, vx, vy, size, life, "");
}
function burst(color, n) { const { cx, cy } = enchantFxOrigin();
  for (let i = 0; i < n; i++) { const a = Math.random()*Math.PI*2, sp = 2 + Math.random()*7; spawn(cx, cy, Math.random()>0.5?color:"#fff", Math.cos(a)*sp, Math.sin(a)*sp-2, 4+Math.random()*7, 700+Math.random()*500); } }
function shards(color, n) { const { cx, cy } = enchantFxOrigin();
  for (let i = 0; i < n; i++) { const a = Math.random()*Math.PI*2, sp = 3 + Math.random()*6; spawn(cx, cy, color, Math.cos(a)*sp, Math.sin(a)*sp, 3+Math.random()*5, 600+Math.random()*400); } }
