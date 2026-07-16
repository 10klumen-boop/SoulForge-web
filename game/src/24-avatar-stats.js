// ===== Статы персонажа, сила фарма (зоны и сюжет — 25-story-zones.js) =====



const RACE_BASE_STATS = {

  human: { patk: 15, matk: 13, pdef: 15, mdef: 15 },

  elf: { patk: 12, matk: 19, pdef: 12, mdef: 17 },

  dark_elf: { patk: 17, matk: 16, pdef: 11, mdef: 14 },

  orc: { patk: 20, matk: 10, pdef: 19, mdef: 11 },

  dwarf: { patk: 17, matk: 10, pdef: 17, mdef: 14 },

};



const CLASS_STAT_BONUS = {

  fighter: { patk: 3, matk: 0, pdef: 2, mdef: 0 },

  mystic: { patk: 0, matk: 3, pdef: 0, mdef: 2 },

};



function avatarLevelStatBonus(level) {

  const lvl = Math.max(0, (level || 1) - 1);

  return { atk: Math.floor(lvl * 0.7), def: Math.floor(lvl * 0.55) };

}



function classStatBonus(classId) {
  if (typeof isMysticArchetype === "function" && isMysticArchetype(classId)) {
    return CLASS_STAT_BONUS.mystic;
  }
  return CLASS_STAT_BONUS[classId] || CLASS_STAT_BONUS.fighter;
}



function migrateFarmZone() {

  if (typeof migrateAvatar === "function") migrateAvatar();

  const cur = state.farmZone;

  const zone = FARM_ZONES.find((z) => z.id === cur);

  if (zone && zone.active) return;

  const fallback = FARM_ZONES.find((z) => z.active && canEnterFarmZone(z)) || FARM_ZONES[0];

  if (state.farmZone !== fallback.id) state.farmZone = fallback.id;

}



function selectFarmZone(zoneId) {

  const zone = farmZoneById(zoneId);

  if (!zone.active) {

    toast(zone.storyTag + " — в разработке", "warn");

    return false;

  }

  if (!canEnterFarmZone(zone)) {

    const st = farmZoneStatus(zone);

    const parts = [];

    if (st.needLevel > 0) parts.push("ур. " + zone.reqLevel);

    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");

    if (st.needQuest && typeof prevFarmZone === "function") {
      const prev = prevFarmZone(zone);
      if (prev) parts.push("глава «" + (zoneRaceView(prev)?.name || prev.id) + "»");
    }

    toast("Нужно: " + parts.join(", "), "warn");

    return false;

  }

  if (state.farmZone === zoneId) return true;

  state.farmZone = zoneId;

  save();

  renderMenuFarmHub();
  if (typeof renderMenuHero === "function") renderMenuHero();

  return true;

}



function avatarStatBonusesFromGear() {

  const out = { patk: 0, matk: 0, pdef: 0, mdef: 0 };

  if (typeof iterEquippedGear !== "function") return out;

  iterEquippedGear().forEach(({ item }) => {

    if (item.kind === "weapon") {

      const w = WMAP[item.id];

      if (!w) return;

      const p = item.plus || 0;

      out.patk += statAt(w.patk, w.ps, p);

      out.matk += statAt(w.matk, w.ms, p);

      return;

    }

    const def = COLLECTIBLES[item.id];

    const b = def?.bonuses;

    if (!b) return;

    if (b.patk) out.patk += b.patk;

    if (b.matk) out.matk += b.matk;

    if (b.pdef) out.pdef += b.pdef;

    if (b.mdef) out.mdef += b.mdef;

  });

  return out;

}



function avatarStats() {

  migrateAvatar();

  const a = state.avatar || {};

  const race = RACE_BASE_STATS[a.raceId] || RACE_BASE_STATS.human;

  const cls = classStatBonus(a.classId);

  const lv = Math.max(1, a.level || 1);

  const lb = avatarLevelStatBonus(lv);

  const gear = avatarStatBonusesFromGear();

  const dwarfMine = a.raceId === "dwarf" ? 2 : 0;

  return {

    patk: race.patk + cls.patk + lb.atk + gear.patk,

    matk: race.matk + cls.matk + lb.atk + gear.matk,

    pdef: race.pdef + cls.pdef + lb.def + gear.pdef,

    mdef: race.mdef + cls.mdef + lb.def + gear.mdef,

    farmBonus: dwarfMine,

  };

}



function avatarFarmPower() {

  const s = avatarStats();

  const power = Math.round(

    s.patk * 1.0 + s.matk * 0.72 + s.pdef * 0.36 + s.mdef * 0.36 + Math.max(0, (state.avatar?.level || 1) - 1) * 1.5 + s.farmBonus

  );

  return Math.max(1, power);

}



/** Бонус P.Atk от оружия; fixedPlus — принудительный уровень заточки (для базового HP). */
function avatarWeaponPatkBonus(fixedPlus) {
  if (typeof iterEquippedGear !== "function") return 0;
  let patk = 0;
  iterEquippedGear().forEach(({ item }) => {
    if (item.kind !== "weapon") return;
    const w = WMAP[item.id];
    if (!w) return;
    const plus = fixedPlus !== undefined ? fixedPlus : (item.plus || 0);
    patk += statAt(w.patk, w.ps, plus);
  });
  return patk;
}

function mineWeaponDamageScale(chapter) {
  return 0.22 + (chapter || 1) * 0.04;
}

function avatarMinePatkForDamage(weaponPlus) {
  const s = avatarStats();
  const weaponPatk = avatarWeaponPatkBonus(weaponPlus);
  const basePatk = Math.max(0, s.patk - avatarWeaponPatkBonus());
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = zone?.chapter || 1;
  return basePatk + weaponPatk * mineWeaponDamageScale(ch);
}

/** Урон без учёта заточки — для расчёта HP (заточка тогда реально ускоряет убийство). */
function avatarMineBaseClickDamage() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = zone?.chapter || 1;
  const s = avatarStats();
  const effPatk = avatarMinePatkForDamage(0);
  const raw = effPatk * 1.0 + s.matk * 0.24 + (state.avatar?.level || 1) * 1.6;
  const chapterScale = 1 + (ch - 1) * 0.035;
  return Math.max(4, Math.round((raw * chapterScale) / 4.2));
}

/** Урон клика с полной заточкой оружия. */
function avatarMineClickDamage() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const ch = zone?.chapter || 1;
  const s = avatarStats();
  const effPatk = avatarMinePatkForDamage();
  const raw = effPatk * 1.0 + s.matk * 0.24 + (state.avatar?.level || 1) * 1.6;
  const chapterScale = 1 + (ch - 1) * 0.035;
  return Math.max(4, Math.round((raw * chapterScale) / 4.2));
}

/** Прибавка урона от заточки (для HUD). */
function avatarMineEnchantDamageBonus() {
  return Math.max(0, avatarMineClickDamage() - avatarMineBaseClickDamage());
}

/** Сколько ударов нужно, чтобы убить моба (не зависит от «силы фарма»). */
function mineHitsToKill(type, zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const zone = farmZoneById(zoneId);
  const ch = zone?.chapter || 1;
  const ci = Math.min(5, Math.max(1, ch)) - 1;
  const base = {
    normal: [7, 8, 9, 10, 11],
    golden: [13, 15, 17, 19, 22],
    boss: [62, 72, 84, 94, 108],
  };
  let hits = (base[type] || base.normal)[ci];
  const power = avatarFarmPower();
  const tgt = farmZoneTargetPower(zone);
  if (power < tgt) hits = Math.round(hits * (1 + ((tgt - power) / Math.max(1, tgt)) * 0.45));
  return Math.max(type === "boss" ? 40 : type === "golden" ? 8 : 4, hits);
}

/** HP моба = базовый урон × число ударов (заточка снижает фактическое число кликов). */
function mineMobMaxHp(type, zoneId) {
  const dmg = avatarMineBaseClickDamage();
  const hits = mineHitsToKill(type, zoneId);
  let hp = Math.round(dmg * hits);
  if (type === "golden") hp = Math.round(hp * 1.08);
  if (type === "boss") {
    const boss = typeof zoneBossDef === "function" ? zoneBossDef(zoneId) : { hpMult: 14 };
    hp = Math.round(hp * Math.max(1, (boss.hpMult || 14) / 12));
  }
  return Math.max(type === "boss" ? dmg * 40 : type === "golden" ? dmg * 8 : dmg * 4, hp);
}



/** Ожидаемая сила фарма на уровне без экипировки (для подсказок). */
function expectedFarmPowerAtLevel(level) {
  level = Math.max(1, level || 1);
  const a = state.avatar || {};
  const race = RACE_BASE_STATS[a.raceId] || RACE_BASE_STATS.human;
  const cls = classStatBonus(a.classId);
  const lb = avatarLevelStatBonus(level);
  const dwarfMine = a.raceId === "dwarf" ? 2 : 0;
  const patk = race.patk + cls.patk + lb.atk;
  const matk = race.matk + cls.matk + lb.atk;
  const pdef = race.pdef + cls.pdef + lb.def;
  const mdef = race.mdef + cls.mdef + lb.def;
  return Math.round(
    patk * 1.0 + matk * 0.72 + pdef * 0.36 + mdef * 0.36 + Math.max(0, level - 1) * 1.5 + dwarfMine
  );
}



function farmZoneTargetPower(zone) {
  zone = typeof zone === "string" ? farmZoneById(zone) : zone;
  return zone.targetPower || Math.max(70, zone.reqPower || 70);
}



/** Базовый рост adena по главе и уровню (до бонуса силы). */
function mineProgressAdenaScale(zoneId) {
  zoneId = zoneId || state.farmZone || "banana_mine";
  const zone = farmZoneById(zoneId);
  const chapter = zone.chapter || 1;
  const lvl = state.avatar?.level || 1;
  const chapterMult = [1, 1.14, 1.32, 1.52, 1.74][chapter - 1] || 1;
  const lvlMult = 1 + Math.max(0, lvl - 1) * 0.032;
  return chapterMult * lvlMult;
}



/** Веса грейдов оружия с золотой цели — только по главе зоны. */
function mineDropWeights(zoneId) {
  const zone = farmZoneById(zoneId || state.farmZone || "banana_mine");
  const chapter = zone.chapter || 1;
  const tables = {
    1: { D: 100, C: 0, B: 0, A: 0 },
    2: { D: 78, C: 22, B: 0, A: 0 },
    3: { D: 55, C: 35, B: 10, A: 0 },
    4: { D: 35, C: 40, B: 25, A: 0 },
    5: { D: 0, C: 52, B: 33, A: 15 },
  };
  return { ...(tables[chapter] || tables[1]) };
}

function mineDropGradeSummary(zoneId) {
  const zone = farmZoneById(zoneId || state.farmZone || "banana_mine");
  const ch = zone.chapter || 1;
  const labels = {
    1: "только D",
    2: "D, иногда C",
    3: "D, C, редко B",
    4: "D, C, B",
    5: "C, B, редко A",
  };
  return labels[ch] || "D";
}



/** Шанс выпадения оружия с золотой цели (грейд — mineDropWeights). */
function mineGoldenWeaponChance() {
  const zone = farmZoneById(state.farmZone || "banana_mine");
  const chapter = zone.chapter || 1;
  const lvl = state.avatar?.level || 1;
  const power = avatarFarmPower();
  const target = farmZoneTargetPower(zone);
  let ch = 0.22 + chapter * 0.06 + Math.max(0, lvl - zone.reqLevel) * 0.025;
  if (power >= target) ch += 0.08;
  if (power >= target * 1.15) ch += 0.06;
  return Math.min(0.9, ch);
}



function recommendedFarmZoneId() {
  let best = null;
  FARM_ZONES.forEach((z) => {
    if (!z.active || !canEnterFarmZone(z)) return;
    if (!best || (z.chapter || 0) > (best.chapter || 0)) best = z;
  });
  return best?.id || FARM_ZONES[0]?.id;
}



function ensureFarmNotify() {
  if (!state.farmNotify || typeof state.farmNotify !== "object") state.farmNotify = {};
}



function migrateFarmNotify() {
  ensureFarmNotify();
  if (state.farmNotifyMigrated) return;
  FARM_ZONES.forEach((z) => {
    if (z.active && canEnterFarmZone(z)) state.farmNotify[z.id] = true;
  });
  state.farmNotifyMigrated = true;
  save();
}



function notifyFarmZoneUnlocks() {
  if (!state.avatar?.created) return;
  ensureFarmNotify();
  FARM_ZONES.forEach((z) => {
    if (!z.active || state.farmNotify[z.id]) return;
    if (!canEnterFarmZone(z)) return;
    state.farmNotify[z.id] = true;
    if (z.chapter > 1) {
      const v = typeof zoneRaceView === "function" ? zoneRaceView(z) : z;
      if (typeof toast === "function") {
        toast(v.storyTag + ": " + v.name, "success");
      }
      if (typeof gameLog === "function") {
        gameLog(
          "Этап открыт: " + v.name + " · ур. " + z.reqLevel + "+ · сила " + fmt(z.reqPower) + "+",
          "system"
        );
      }
    }
  });
  save();
}



function canEnterFarmZone(zone) {

  zone = zone || farmZoneById(state.farmZone || "banana_mine");

  if (!zone.active) return false;

  if (!state.avatar?.created) return zone.reqLevel <= 1 && zone.reqPower <= 0;

  const power = avatarFarmPower();

  const lvl = state.avatar.level || 1;

  if (power < zone.reqPower || lvl < zone.reqLevel) return false;

  if (typeof isPrevZoneChapterComplete === "function" && !isPrevZoneChapterComplete(zone)) return false;

  return true;

}



function farmZoneStatus(zone) {

  zone = typeof zone === "string" ? farmZoneById(zone) : zone;

  const power = avatarFarmPower();

  const lvl = state.avatar?.level || 1;

  const ok = canEnterFarmZone(zone);

  const needQuest =
    typeof isPrevZoneChapterComplete === "function" ? !isPrevZoneChapterComplete(zone) : false;

  return {

    zone,

    ok,

    locked: !zone.active,

    power,

    level: lvl,

    needPower: Math.max(0, zone.reqPower - power),

    needLevel: Math.max(0, zone.reqLevel - lvl),

    needQuest,

    targetPower: farmZoneTargetPower(zone),

    powerRatio: power / Math.max(1, farmZoneTargetPower(zone)),

  };

}

function farmZoneLockHint(zone) {
  const st = farmZoneStatus(zone);
  if (st.ok) return "";
  const parts = [];
  if (st.needLevel > 0) parts.push("ур. " + zone.reqLevel);
  if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");
  if (st.needQuest && typeof questStatusText === "function") parts.push(questStatusText(zone));
  return parts.length ? parts.join(" · ") : "Закрыто";
}



function farmZoneChipText(zone, st) {

  const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;

  if (!zone.active) return view.storyTag + " · скоро";

  if (!st.ok) {

    const parts = [];

    if (st.needLevel > 0) parts.push("р." + zone.reqLevel);

    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");

    if (st.needQuest && typeof questStatusText === "function") parts.push(questStatusText(zone));

    return parts.length ? parts.join(" · ") : "закрыто";

  }

  if (typeof questStatusText === "function") {
    const qs = questStatusText(zone);
    if (qs && qs.indexOf("✓") < 0) return qs;
  }

  const beat = typeof zoneStoryBeat === "function" ? zoneStoryBeat(zone.id) : null;

  if (beat?.targets) {
    const tgt = farmZoneTargetPower(zone);
    const pwr = st.power || avatarFarmPower();
    const fit = pwr >= tgt ? "✓" : Math.round((pwr / tgt) * 100) + "%";
    return beat.targets + " · сила " + fit + " · +" + Math.round((avatarMineRewardMult(zone.id) - 1) * 100) + "%";
  }

  return view.desc;

}



function farmZoneMetaText(zone, st) {

  const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;

  if (!zone.active) return view.storyTag + " · " + view.desc;

  if (!st.ok) {

    const parts = [];

    if (st.needLevel > 0) parts.push("ур. " + zone.reqLevel);

    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");

    if (st.needQuest && typeof prevFarmZone === "function") {
      const prev = prevFarmZone(zone);
      if (prev) parts.push("глава «" + (zoneRaceView(prev)?.name || prev.id) + "»");
    }

    return "Требуется: " + parts.join(", ");

  }

  const mult = avatarMineRewardMult(zone.id);

  const tgt = farmZoneTargetPower(zone);

  const pwr = st.power || avatarFarmPower();

  const fit = pwr >= tgt ? "норма" : fmt(pwr) + "/" + fmt(tgt) + " силы";
  const dropLbl = typeof mineDropGradeSummary === "function" ? mineDropGradeSummary(zone.id) : "D";

  return "Дроп " + dropLbl + " · +" + Math.round((mult - 1) * 100) + "% · " + fit;
}



function avatarMineRewardMult(zoneId) {

  zoneId = zoneId || state.farmZone || "banana_mine";

  const zone = farmZoneById(zoneId);

  if (!canEnterFarmZone(zone)) return 0;

  const power = avatarFarmPower();

  const lvl = state.avatar?.level || 1;

  const target = farmZoneTargetPower(zone);

  const entry = Math.max(zone.reqPower || 0, Math.floor(target * 0.86));

  const chapter = zone.chapter || 1;

  const chapterScale = zone.mine?.rewardScale || (1 + (chapter - 1) * 0.1);

  const span = Math.max(12, target - entry);

  const ratio = Math.max(0, Math.min(1.35, (power - entry) / span));

  let powerMult = 0.86 + ratio * 0.2;

  const lvlMult = 1 + Math.min(0.22, Math.max(0, lvl - zone.reqLevel) * 0.03);

  let mult = chapterScale * powerMult * lvlMult;

  const s = avatarStats();

  mult += Math.min(0.08, Math.max(0, s.patk - 28) * 0.0014);

  const race = state.avatar?.raceId;

  const raceMap = typeof ZONE_RACE_BONUS !== "undefined" ? ZONE_RACE_BONUS[zoneId] : null;

  if (race && raceMap && raceMap[race]) mult += raceMap[race];

  if (typeof avatarGearMineAdenaMult === "function") mult *= avatarGearMineAdenaMult();

  return Math.min(1.58, Math.max(0.82, mult));

}



function renderAvatarStatsPanel() {

  const grid = document.getElementById("avatarStatGrid");

  const powerEl = document.getElementById("avatarFarmPower");

  if (!grid) return;

  const s = avatarStats();

  const power = avatarFarmPower();

  const rows = [

    { k: "P.Atk", v: s.patk, tip: "Физ. урон — бонус adena при высокой силе фарма" },

    { k: "M.Atk", v: s.matk, tip: "Маг. урон — влияет на силу фарма" },

    { k: "P.Def", v: s.pdef, tip: "Физ. защита — входит в силу фарма" },

    { k: "M.Def", v: s.mdef, tip: "Маг. защита — входит в силу фарма" },

  ];

  grid.innerHTML = rows

    .map(

      (r) =>

        '<div class="avatar-stat" title="' + r.tip + '">' +

        '<span class="avatar-stat-k">' + r.k + "</span>" +

        '<b class="avatar-stat-v">' + fmt(r.v) + "</b></div>"

    )

    .join("");

  if (powerEl) powerEl.textContent = fmt(power);

}



function renderMenuFarmHub() {

  migrateFarmZone();

  if (typeof migrateQuestProgress === "function") migrateQuestProgress();

  if (typeof refreshZoneStoryUnlocks === "function") refreshZoneStoryUnlocks();

  if (typeof migrateFarmNotify === "function") migrateFarmNotify();

  if (typeof notifyFarmZoneUnlocks === "function") notifyFarmZoneUnlocks();

  const listEl = document.getElementById("farmZoneList");

  const powerHead = document.getElementById("farmHubPower");

  const meta = document.getElementById("mineBannerMeta");

  const banner = document.getElementById("mineBanner");

  const titleEl = document.getElementById("mineBannerTitle");

  const imgEl = document.getElementById("mineBannerImg");

  const farmRead = document.getElementById("farmStoryRead");

  const selected = farmZoneById(state.farmZone || "banana_mine");

  const viewSel = typeof zoneRaceView === "function" ? zoneRaceView(selected) : selected;

  const stSel = farmZoneStatus(selected);

  const power = avatarFarmPower();



  if (powerHead) {

    const tgt = farmZoneTargetPower(selected);

    powerHead.textContent = state.avatar?.created
      ? "Сила " + fmt(power) + " / " + fmt(tgt)
      : "Создай персонажа";

  }

  if (farmRead) farmRead.hidden = !state.avatar?.created;



  if (listEl) {

    listEl.innerHTML = "";

    FARM_ZONES.forEach((zone) => {

      const st = farmZoneStatus(zone);

      const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;

      const rec = typeof recommendedFarmZoneId === "function" && recommendedFarmZoneId() === zone.id;

      const row = document.createElement("button");

      row.type = "button";

      row.className =

        "farm-zone-chip" +

        (state.farmZone === zone.id ? " sel" : "") +

        (st.ok && zone.active ? " ok" : "") +

        (!zone.active ? " soon" : "") +

        (!st.ok && zone.active ? " lock" : "") +

        (rec && st.ok ? " rec" : "") +

        (typeof storyChapterSeen === "function" && storyChapterSeen(zone.id) ? " story-done" : "");

      const chipIco = typeof uiZoneChipIcon === "function" ? uiZoneChipIcon(zone.id, state.avatar?.raceId) : (view.icon || zone.icon);

      row.innerHTML =

        '<img src="' + chipIco + '" alt="">' +

        "<span><strong>" + view.name + "</strong><small>" + farmZoneChipText(zone, st) + "</small></span>";

      row.onclick = () => {

        Audio2.click();

        selectFarmZone(zone.id);

      };

      listEl.appendChild(row);

    });

  }



  if (titleEl) {
    const raw = viewSel.mine?.title || viewSel.name || "";
    titleEl.textContent = String(raw).replace(/^[^\p{L}\p{N}]+/u, "").trim() || raw;
  }

  if (imgEl) {
    imgEl.removeAttribute("src");
    imgEl.hidden = true;
    imgEl.style.display = "none";
  }

  if (!meta) return;

  if (!state.avatar?.created) {

    meta.textContent = "Создай персонажа — пять дорог сойдутся на общих жилах";

    if (banner) banner.classList.add("mine-locked");

    return;

  }

  if (typeof isPreludeComplete === "function" && isPreludeComplete()) {

    meta.textContent = "Prelude завершён · эпоха Хаоса · +" + Math.round((avatarMineRewardMult(selected.id) - 1) * 100) + "% adena";

    if (banner) banner.classList.remove("mine-locked");

    return;

  }

  if (stSel.ok) {

    const mult = avatarMineRewardMult(selected.id);
    const beat = typeof zoneStoryBeat === "function" ? zoneStoryBeat(selected.id) : null;

    meta.textContent = beat?.questRef
      ? beat.questRef + " · +" + Math.round((mult - 1) * 100) + "% adena"
      : viewSel.storyTag + " · сила " + fmt(stSel.power) + " · +" + Math.round((mult - 1) * 100) + "% adena";

    if (banner) banner.classList.remove("mine-locked");

  } else {

    meta.textContent = farmZoneMetaText(selected, stSel);

    if (banner) banner.classList.add("mine-locked");

  }

  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  if (typeof renderMineStoryBar === "function") renderMineStoryBar();
  if (typeof renderMenuHero === "function") renderMenuHero();

}



function renderMenuHero() {

  const titleEl = document.getElementById("heroTitle");
  const tagEl = document.getElementById("heroTagline");
  const heroPanel = document.querySelector(".hero-panel");
  const eyebrow = document.querySelector(".hero-eyebrow");
  if (!titleEl || !tagEl) return;

  const stepMineD = document.querySelector(".hero-step-mine .hero-step-d");
  const stepEnchD = document.querySelector(".hero-step-ench .hero-step-d");
  const stepGoldD = document.querySelector(".hero-step-gold .hero-step-d");
  const stepIco = document.querySelector(".hero-step-mine .hero-step-ico img");

  if (!state.avatar?.created) {
    titleEl.textContent = "SoulForge";
    tagEl.textContent = typeof STORY_ARC !== "undefined" ? String(STORY_ARC.tagline || "").replace(/<[^>]+>/g, "") : "Задание → заточка → adena.";
    if (eyebrow) eyebrow.textContent = "SoulForge · Lineage 2";
    if (stepMineD) stepMineD.textContent = "Лови цели · adena";
    if (stepEnchD) stepEnchD.textContent = "+0 … +16";
    if (stepGoldD) stepGoldD.textContent = "Продавай · крафти";
    if (stepIco) {
      stepIco.src = typeof UI_QUEST_ICON !== "undefined" ? UI_QUEST_ICON : "icons/quest_journal.png?v=10";
    }
    if (heroPanel) heroPanel.className = "hero-panel";
    return;
  }

  const zoneId = state.farmZone || "banana_mine";
  const view = typeof zoneRaceView === "function" ? zoneRaceView(zoneId) : farmZoneById(zoneId);
  const race = state.avatar.raceId || "human";
  const beat = (typeof STORY_BEATS !== "undefined" && STORY_BEATS[zoneId]?.[race]) || {};
  const story = view.story || {};

  titleEl.textContent = view.name || "SoulForge";

  const lead = beat.lead || story.lead || view.desc || "";
  tagEl.textContent = String(lead).replace(/<[^>]+>/g, "");

  if (eyebrow) {
    const ch = view.storyTag || ("Глава " + (view.chapter || 1));
    eyebrow.textContent = ch;
  }

  const targets = beat.targets || story.targets;
  if (stepMineD) {
    stepMineD.textContent = targets
      ? (String(targets).charAt(0).toUpperCase() + String(targets).slice(1) + " · adena")
      : "Лови цели · adena";
  }

  if (stepEnchD) {
    const drop = typeof mineDropGradeSummary === "function" ? mineDropGradeSummary(zoneId) : "D";
    stepEnchD.textContent = "Дроп " + drop + " · +0…+16";
  }

  if (stepGoldD) {
    const mult = typeof avatarMineRewardMult === "function" ? avatarMineRewardMult(zoneId) : 1;
    const pct = Math.round((mult - 1) * 100);
    stepGoldD.textContent = pct > 0 ? ("+" + pct + "% adena · крафт") : "Продавай · крафти";
  }

  if (stepIco) {
    if (typeof uiZoneChipIcon === "function") {
      stepIco.src = uiZoneChipIcon(zoneId, race);
    } else if (view.icon) {
      stepIco.src = view.icon;
    } else {
      stepIco.src = typeof UI_QUEST_ICON !== "undefined" ? UI_QUEST_ICON : "icons/quest_journal.png?v=10";
    }
  }

  if (heroPanel) heroPanel.className = "hero-panel race-" + race + " zone-" + zoneId;
}




function renderMineBanner() {

  renderMenuFarmHub();

}


