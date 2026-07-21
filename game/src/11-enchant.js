// ===== Enchant: логика заточки и эффекты =====
// UI (openEnchant, renderEnch, renderScrolls, enchFlash) вынесено в enchant-ui.js.


let busy = false;

/** Записать plus/spent экипированного или инвентарного оружия через ProgressStore (не in-place). */
function syncEnchantItemToStore() {
  if (!cur || !cur.item) return;
  if (cur.equipped) {
    const uid = cur.item.uid;
    const id = cur.item.id;
    const plus = cur.plus | 0;
    const spent = cur.item.spent || 0;
    const starter = !!cur.item.starter;
    const broken = !!cur.broken;
    ProgressStore.update("avatar", (a) => {
      const next = { ...(a || {}) };
      const gear = {
        ...(next.gear || (typeof defaultAvatarGear === "function" ? defaultAvatarGear() : {})),
      };
      if (broken) {
        gear.weapon = null;
      } else {
        gear.weapon = {
          uid,
          id,
          plus,
          spent,
          kind: "weapon",
          starter,
        };
      }
      next.gear = gear;
      return next;
    });
    if (!broken && typeof equippedWeaponItem === "function") {
      const live = equippedWeaponItem();
      if (live) cur.item = live;
    }
    return;
  }
  if (cur.broken) return;
  const uid = cur.item.uid;
  const plus = cur.plus | 0;
  const spent = cur.item.spent || 0;
  ProgressStore.update("inventory", (inv) =>
    (inv || []).map((it) => (it.uid === uid ? { ...it, plus, spent } : it))
  );
  const live = (state.inventory || []).find((it) => it.uid === uid);
  if (live) cur.item = live;
}

function doEnchant() {
  if (busy || (typeof isGamePaused === "function" && isGamePaused())) return;
  if (!cur || cur.broken) return;
  const capPlus = typeof scrollMaxPlus === "function" ? scrollMaxPlus(cur.scroll) : MAX_PLUS;
  if (cur.plus >= capPlus) return;
  const sc = scrollFor(cur.weapon.grade, cur.scroll);
  if (state.adena < sc.cost) { toast("Недостаточно adena!", "warn"); return; }
  busy = true;
  renderEnch();
  ProgressStore.update("adena", (a) => (a || 0) - sc.cost);
  cur.item.spent = (cur.item.spent || 0) + sc.cost;
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), tries: (t?.tries || 0) + 1 }));
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5 && typeof achStat === "function") achStat("nightEnchants", 1);
  Audio2.charge();
  const stage = $("#stage"); stage.classList.add("charging");
  setVerdict("Заточка...", "neutral");
  $("#adena").textContent = fmt(state.adena);
  $("#pSpent").textContent = fmtAdena(cur.item.spent);
  const chance = successChance(cur.plus, sc.behavior);
  const win = Math.random() < chance;
  setTimeout(() => {
    stage.classList.remove("charging");
    let animMs = 0;
    if (win) {
      cur.plus++; cur.item.plus = cur.plus;
      stage.classList.add("success");
      const gi = glowInfo(cur.plus);
      enchFlash("success", gi.color);
      const maxed = cur.plus >= capPlus;
      maxed ? Audio2.jackpot() : Audio2.success();
      enchantFirework(gi.color, maxed ? 52 : 36);
      playEnchantPlusPop(cur.plus, { maxed: maxed && capPlus >= MAX_PLUS });
      animMs = 520;
      setTimeout(() => stage.classList.remove("success"), animMs);
      setTimeout(() => stage.classList.remove("success-flash"), 880);
      setVerdict(
        maxed && capPlus >= MAX_PLUS ? "+16 МАКСИМУМ — ЛЕГЕНДА!" : (cur.plus >= 12 ? "Великолепно! +" + cur.plus : "Успех! +" + cur.plus),
        "good"
      );
      gameLog(
        (maxed && capPlus >= MAX_PLUS ? "ЛЕГЕНДА! " : "") + cur.weapon.name + " [" + cur.weapon.grade + "] → +" + cur.plus,
        maxed && capPlus >= MAX_PLUS ? "success" : "enchant"
      );
      notifyWeaponRecord(cur.weapon, cur.plus);
      if (typeof logCharacterEvent === "function") {
        logCharacterEvent("enchant_ok", {
          weaponId: cur.weapon.id,
          weaponName: cur.weapon.name,
          grade: cur.weapon.grade,
          plus: cur.plus,
          scroll: sc.id,
          cost: sc.cost,
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
        cur.plus = 0; cur.item.plus = 0; setVerdict("Провал — заточка сброшена до +0 (оружие цело)", "bad");
        gameLog("Провал (благ.): " + cur.weapon.name + " — сброс до +0", "fail");
        shards(cur.weapon.glow, 16);
        if (typeof logCharacterEvent === "function") {
          logCharacterEvent("enchant_fail", {
            weaponId: cur.weapon.id,
            weaponName: cur.weapon.name,
            grade: cur.weapon.grade,
            plusBefore,
            scroll: sc.id,
            cost: sc.cost,
            behavior: "reset",
          });
        }
      } else if (sc.behavior === "destruction") {
        const plusBefore = cur.plus;
        setVerdict("Провал — оружие цело (+" + cur.plus + ")", "bad");
        gameLog("Провал (разруш.): " + cur.weapon.name + " +" + plusBefore + " — без изменений", "fail");
        shards(cur.weapon.glow, 10);
        if (typeof logCharacterEvent === "function") {
          logCharacterEvent("enchant_fail", {
            weaponId: cur.weapon.id,
            weaponName: cur.weapon.name,
            grade: cur.weapon.grade,
            plusBefore,
            scroll: sc.id,
            cost: sc.cost,
            behavior: "destruction",
          });
        }
      } else {
        const plusBefore = cur.plus;
        notifyWeaponRecord(cur.weapon, cur.plus);
        cur.broken = true;
        if (typeof achStat === "function") achStat("weaponsBroken", 1);
        if (!cur.equipped) {
          ProgressStore.set("inventory", (state.inventory || []).filter((x) => x.uid !== cur.item.uid));
        }
        const grade = cur.weapon.grade;
        const yld = crystalYield(cur.weapon, cur.plus);
        ProgressStore.update("crystals", (c) => {
          const next = { ...(c || { D: 0, C: 0, B: 0, A: 0 }) };
          next[grade] = (next[grade] || 0) + yld;
          return next;
        });
        stage.classList.add("fail");
        animMs = Math.max(animMs, 560);
        setTimeout(() => {
          stage.classList.remove("fail");
          if (cur.broken) renderEnch();
        }, 560);
        const plusTag = cur.plus ? " +" + cur.plus : "";
        setVerdict("Оружие рассыпалось → +" + yld + " кристаллов (" + grade + ")", "bad");
        shards(CRYSTAL_COLOR[grade] || "#ff5a5a", 30);
        gameLog("Разрушено: " + cur.weapon.name + plusTag + " → +" + yld + " крист. (" + grade + ")", "fail");
        if (typeof logCharacterEvent === "function") {
          logCharacterEvent("enchant_break", {
            weaponId: cur.weapon.id,
            weaponName: cur.weapon.name,
            grade,
            plus: plusBefore,
            scroll: sc.id,
            cost: sc.cost,
            crystals: yld,
          });
        }
      }
    }
    // Сначала в store (экип живёт в avatar.gear), потом XP — иначе clone avatar откатывает plus.
    syncEnchantItemToStore();
    if (typeof onEnchantAvatarXp === "function") {
      onEnchantAvatarXp(win, cur.plus, sc.behavior, !!cur.broken);
    }
    save(); renderMenu();
    if (cur.equipped) {
      if (typeof renderAvatarGearSlots === "function") renderAvatarGearSlots();
      if (typeof renderAvatarHub === "function") renderAvatarHub();
      if (typeof renderMineHudStats === "function") renderMineHudStats();
    }
    renderEnch();
    setTimeout(() => {
      busy = false;
      renderEnch();
      if (typeof checkAchievements === "function") checkAchievements();
    }, animMs);
  }, 600);
}

function newWeapon() { Audio2.click(); goInventory(); }

function sellWeapon() {
  if (busy || !cur || cur.broken) return;
  if (cur.equipped) { toast("Сначала сними оружие в «Персонаж»", "warn"); return; }
  if (!canSellWeapon(cur.weapon, cur.plus)) { toast("Продать можно только с +4 и выше"); return; }
  const sv = sellValue(cur.weapon, cur.plus);
  ProgressStore.update("adena", (a) => (a || 0) + sv);
  ProgressStore.update("totals", (t) => ({ ...(t || { tries: 0, fails: 0, earned: 0 }), earned: (t?.earned || 0) + sv }));
  Audio2.success();
  ProgressStore.set("inventory", (state.inventory || []).filter((x) => x.uid !== cur.item.uid));
  const plusLabel = isNgSellWeapon(cur.weapon) ? "" : (" +" + cur.plus);
  toast("Продано" + plusLabel + " " + cur.weapon.name + " за " + fmt(sv) + " adena", "gold");
  if (typeof achStat === "function" && !isNgSellWeapon(cur.weapon)) achStat("weaponsSold", 1);
  if (typeof achStatMax === "function" && !isNgSellWeapon(cur.weapon)) achStatMax("maxSoldPlus", cur.plus);
  if (typeof onSellAvatarXp === "function" && !isNgSellWeapon(cur.weapon)) onSellAvatarXp(cur.plus);
  save();
  $("#adena").textContent = fmt(state.adena);
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof noteLeaderboardEvent === "function") noteLeaderboardEvent("sell");
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("sell_weapon", {
      weaponId: cur.weapon.id,
      weaponName: cur.weapon.name,
      grade: cur.weapon.grade,
      plus: cur.plus,
      adenaGain: sv,
    });
  }
  goInventory();
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
