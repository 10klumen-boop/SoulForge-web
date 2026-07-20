function openEnchant(item, opts) {
  opts = opts || {};
  if (!item && opts.fromGear) item = typeof equippedWeaponItem === "function" ? equippedWeaponItem() : null;
  if (isAccessoryItem(item)) { openAccessory(item); return; }
  const w = WMAP[item.id]; if (!w) return;
  if (typeof weaponCanEnchant === "function" && !weaponCanEnchant(w)) {
    toast("«" + w.name + "» без грейда — не точится. Добывай оружие D+ в задании.", "warn");
    return;
  }
  normalizeInvItem(item);
  const equipped = opts.equipped || (typeof isEquippedWeaponItem === "function" && isEquippedWeaponItem(item));
  cur = { item, weapon: w, plus: item.plus || 0, broken: false, scroll: "regular", equipped };
  $("#enchTitle").textContent = w.name + (equipped ? " · надето" : "");
  renderScrolls(); renderEnch(true); show("ench");
}

function renderScrolls() {
  const box = $("#scrolls"); box.innerHTML = "";
  const grade = cur.weapon.grade;
  SCROLL_TYPES.forEach((t) => {
    const s = scrollFor(grade, t.id);
    const tier = s.tier || 1;
    const el = document.createElement("div");
    el.className = "scroll-opt scroll-tier-" + tier + (cur.scroll === s.id ? " sel" : "");
    el.dataset.tier = String(tier);
    el.innerHTML = `<div class="si"><img src="${s.icon}" alt="" onerror="this.style.visibility='hidden'"></div>` +
      `<div class="sm"><div class="st">${s.name} <span class="grade g-${grade}">${grade}</span></div><div class="sd">${s.desc}</div></div>` +
      `<div class="sc">${fmtAdena(s.cost)}<small>adena</small></div>`;
    el.onclick = () => { cur.scroll = s.id; Audio2.click(); renderScrolls(); renderEnch(); };
    box.appendChild(el);
  });
}

function notifyWeaponRecord(w, plus) {
  if (!bumpWeaponRecord(w.id, plus)) return;
  const nick =
    typeof getCloudNick === "function"
      ? getCloudNick()
      : (typeof SoulforgeCloud !== "undefined" ? SoulforgeCloud.getNick() : null);
  let msg = "Рекорд: +" + plus + " «" + w.name + "»";
  if (nick) msg += " · уходит в рейтинг";
  else if (typeof cloudEnabled === "function" && cloudEnabled()) msg += " · войди, чтобы в таблицу";
  if (typeof toast === "function") toast(msg, "success");
  if (typeof noteLeaderboardEvent === "function") {
    noteLeaderboardEvent("record", { weaponId: w.id, plus, grade: w.grade, weaponName: w.name });
  }
}

function playEnchantPlusPop(plus, opts) {
  opts = opts || {};
  const el = $("#stgPlus");
  const stage = $("#stage");
  if (el) {
    el.textContent = "+" + plus;
    el.classList.remove("plus-pop");
    void el.offsetWidth;
    el.classList.add("plus-pop");
    setTimeout(() => el.classList.remove("plus-pop"), 560);
  }
  if (!stage) return;
  stage.querySelectorAll(".wplus-float").forEach((n) => n.remove());
  const float = document.createElement("div");
  float.className = "wplus-float" + (opts.maxed ? " is-max" : "");
  float.textContent = opts.maxed ? "+16!" : "+" + plus;
  float.setAttribute("aria-hidden", "true");
  stage.appendChild(float);
  setTimeout(() => float.remove(), 900);
}

function renderBrokenVisual(w, broken) {
  const failAnim = broken && $("#stage")?.classList.contains("fail");
  const showCrystal = broken && !failAnim;
  const stgImg = $("#stgImg");
  const brokenImg = $("#stgBrokenImg");
  const stgIcon = $("#stgIcon");
  if (stgImg) {
    stgImg.style.display = showCrystal ? "none" : "";
    stgImg.style.filter = broken ? "none" : `drop-shadow(0 0 ${glowInfo(cur.plus).blur.toFixed(0)}px ${glowInfo(cur.plus).color})`;
  }
  if (!brokenImg) return;
  if (showCrystal) {
    const grade = w.grade || "D";
    brokenImg.src = CRYSTAL_ICON[grade] || CRYSTAL_ICON.D;
    brokenImg.hidden = false;
    brokenImg.style.setProperty("--crystal-glow", CRYSTAL_COLOR[grade] || CRYSTAL_COLOR.D);
    stgIcon?.classList.add("is-broken");
  } else {
    brokenImg.hidden = true;
    stgIcon?.classList.remove("is-broken");
  }
}

function renderEnch(resetVerdict) {
  const w = cur.weapon, broken = cur.broken;
  $("#stgName").textContent = w.name;
  $("#stgPlus").textContent = broken ? "разрушено" : "+" + cur.plus;
  $("#stgImg").src = w.icon;
  renderBrokenVisual(w, broken);

  const g = glowInfo(cur.plus);
  const aura = $("#aura"); aura.style.setProperty("--glow", g.color);
  aura.style.opacity = broken ? 0 : g.op.toFixed(2);

  const p = broken ? 0 : statAt(w.patk, w.ps, cur.plus);
  const m = broken ? 0 : statAt(w.matk, w.ms, cur.plus);
  const patkBox = $("#patk")?.closest(".box");
  if (patkBox) patkBox.hidden = false;
  $("#patk").innerHTML = `${fmt(p)} <small>${cur.plus > 0 ? "+" + w.ps * cur.plus : ""}</small>`;
  $("#matk").innerHTML = `${fmt(m)} <small>${cur.plus > 0 ? "+" + w.ms * cur.plus : ""}</small>`;

  const sc = scrollFor(w.grade, cur.scroll);
  const chance = successChance(cur.plus, sc.behavior);
  const safe = cur.plus < safeLevel();
  const capPlus = typeof scrollMaxPlus === "function" ? scrollMaxPlus(cur.scroll) : MAX_PLUS;
  $("#oddsVal").textContent = broken ? "—" : Math.round(chance * 100) + "%" + (safe ? " (безопасно)" : "");
  $("#costVal").textContent = fmtAdena(sc.cost);

  const maxed = cur.plus >= capPlus;
  const note = $("#safeNote");
  if (broken) { note.textContent = "Оружие разрушено — возьми новое"; note.style.color = "var(--red)"; }
  else if (maxed && capPlus >= MAX_PLUS) { note.textContent = "+16 — максимальная заточка!"; note.style.color = "var(--red)"; }
  else if (maxed && sc.behavior === "destruction") { note.textContent = "Свиток разрушения — максимум +15"; note.style.color = "var(--gold-soft)"; }
  else if (safe) { note.textContent = "+0…+3 — безопасная заточка"; note.style.color = "var(--green)"; }
  else if (sc.behavior === "guarantee") { note.textContent = "Кристальный свиток — гарантированный успех"; note.style.color = "var(--blue)"; }
  else if (sc.behavior === "destruction") { note.textContent = "Свиток разрушения — низкий шанс, провал не ломает (до +15)"; note.style.color = "var(--gold-soft)"; }
  else if (sc.behavior === "reset") { note.textContent = "Риск: провал откатит до +0"; note.style.color = "var(--gold-soft)"; }
  else { note.textContent = "Риск: провал разрушит оружие"; note.style.color = "var(--red)"; }
  if (!broken && !maxed) {
    const mystic = typeof avatarIsMystic === "function" && avatarIsMystic();
    if (mystic && typeof weaponAffinity === "function" && weaponAffinity(w) === "physical") {
      note.textContent = "Физическое оружие — для мага слабее";
      note.style.color = "var(--gold-soft)";
    } else if (!mystic && typeof weaponAffinity === "function" && weaponAffinity(w) === "magical") {
      note.textContent = "Магическое оружие — для воина слабее";
      note.style.color = "var(--gold-soft)";
    }
  }

  $("#pMax").textContent = "+" + weaponRecord(w.id);
  $("#pSpent").textContent = fmtAdena(cur.item.spent || 0);

  const canAfford = state.adena >= sc.cost;
  $("#enchBtn").disabled = busy || broken || maxed || !canAfford;
  $("#enchBtn").textContent = busy ? "Заточка…" : (broken ? "Разрушено" : (maxed ? (capPlus >= MAX_PLUS ? "Максимум +16" : "Максимум +15") : "Заточить ✦"));

  const sellable = !broken && canSell(cur.plus) && !cur.equipped;
  $("#sellBtn").disabled = !sellable;
  $("#sellBtn").textContent = broken ? "Нечего продавать"
    : (cur.equipped ? "Снимите оружие, чтобы продать"
    : (canSell(cur.plus) ? `Продать +${cur.plus} за ${fmtAdena(sellValue(w, cur.plus))}` : "Продать (нужно +4)"));

  if (resetVerdict) setVerdict("Удачи, авантюрист!", "neutral");
  $("#adena").textContent = fmt(state.adena);
}
function setVerdict(text, kind) { const v = $("#verdict"); v.textContent = text; v.className = "verdict " + kind; }

function enchFlash(kind, glowColor) {
  const stage = $("#stage");
  const flash = $("#enchFlash");
  if (!stage || !flash) return;
  stage.classList.remove("success-flash", "fail-flash");
  if (glowColor) flash.style.setProperty("--flash-color", glowColor);
  if (kind === "success") {
    stage.classList.add("success-flash");
  } else if (kind === "fail") {
    stage.classList.add("fail-flash");
    setTimeout(() => stage.classList.remove("fail-flash"), 580);
  }
}

let busy = false;
function doEnchant() {
  if (busy || (typeof isGamePaused === "function" && isGamePaused())) return;
  if (!cur || cur.broken) return;
  const capPlus = typeof scrollMaxPlus === "function" ? scrollMaxPlus(cur.scroll) : MAX_PLUS;
  if (cur.plus >= capPlus) return;
  const sc = scrollFor(cur.weapon.grade, cur.scroll);
  if (state.adena < sc.cost) { toast("Недостаточно adena!", "warn"); return; }
  busy = true;
  renderEnch();
  state.adena -= sc.cost;
  cur.item.spent = (cur.item.spent || 0) + sc.cost;
  state.totals.tries++;
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
      state.totals.fails++; Audio2.fail();
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
        if (cur.equipped && typeof ensureAvatarGear === "function") {
          ensureAvatarGear().weapon = null;
        } else {
          state.inventory = (state.inventory || []).filter((x) => x.uid !== cur.item.uid);
        }
        const grade = cur.weapon.grade;
        const yld = crystalYield(cur.weapon, cur.plus);
        if (!state.crystals) state.crystals = { D: 0, C: 0, B: 0, A: 0 };
        state.crystals[grade] = (state.crystals[grade] || 0) + yld;
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
  if (typeof weaponCanEnchant === "function" && !weaponCanEnchant(cur.weapon)) {
    toast("Тренировочное оружие не продаётся", "warn");
    return;
  }
  if (cur.equipped) { toast("Сначала сними оружие в «Персонаж»", "warn"); return; }
  if (!canSell(cur.plus)) { toast("Продать можно только с +4 и выше"); return; }
  const sv = sellValue(cur.weapon, cur.plus);
  state.adena += sv;
  state.totals.earned = (state.totals.earned || 0) + sv;
  Audio2.success();
  state.inventory = (state.inventory || []).filter((x) => x.uid !== cur.item.uid);
  toast("Продано +" + cur.plus + " " + cur.weapon.name + " за " + fmt(sv) + " adena", "gold");
  if (typeof achStat === "function") achStat("weaponsSold", 1);
  if (typeof achStatMax === "function") achStatMax("maxSoldPlus", cur.plus);
  if (typeof onSellAvatarXp === "function") onSellAvatarXp(cur.plus);
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
