// ===== Статы персонажа и фарм-зоны: core logic =====
// Чистые расчёты вынесены в avatar-math.js.
// Здесь: выбор зоны, проверки входа, миграции, бонус награды.
// UI рендер остался в 24-avatar-stats.js.

// ===== Статы персонажа, сила фарма (зоны и сюжет — 25-story-zones.js) =====



// ===== Статы персонажа: логика и UI =====
// Чистые расчёты (avatarStats, avatarFarmPower, mineMobMaxHp и т.д.) вынесены в avatar-math.js.


function migrateFarmZone() {

  if (typeof migrateAvatar === "function") migrateAvatar();

  const cur = state.farmZone;

  const zone = FARM_ZONES.find((z) => z.id === cur);

  if (zone && zone.active) return;

  const fallback = FARM_ZONES.find((z) => z.active && canEnterFarmZone(z)) || FARM_ZONES[0];

  if (state.farmZone !== fallback.id) {
    ProgressStore.set("farmZone", fallback.id);
  }

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

  const from = state.farmZone;
  ProgressStore.set("farmZone", zoneId);

  save();
  if (typeof flushCloudSave === "function") flushCloudSave({ force: true });
  else if (window.SoulforgeCloud?.flushSave) window.SoulforgeCloud.flushSave({ force: true });
  if (typeof logCharacterEvent === "function") {
    logCharacterEvent("zone_change", { from, to: zoneId });
  }

  renderMenuFarmHub();
  if (typeof renderMenuHero === "function") renderMenuHero();

  return true;

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

  const atk = avatarIsMystic() ? s.matk : s.patk;

  mult += Math.min(0.08, Math.max(0, atk - 28) * 0.0014);

  const race = state.avatar?.raceId;

  const raceMap = typeof ZONE_RACE_BONUS !== "undefined" ? ZONE_RACE_BONUS[zoneId] : null;

  let raceBonus = race && raceMap && raceMap[race] ? raceMap[race] : 0;
  const raceFloor = typeof passiveEffectSum === "function"
    ? passiveEffectSum("zoneRaceBonusFloor", race, lvl)
    : (typeof racialEffectSum === "function" ? racialEffectSum("zoneRaceBonusFloor", race, lvl) : 0);
  if (raceFloor > 0) raceBonus = Math.max(raceBonus, raceFloor);
  mult += raceBonus;

  if (typeof avatarGearMineAdenaMult === "function") mult *= avatarGearMineAdenaMult();

  // Расовый farmAdenaMult — после clamp кривой силы, иначе съедается капом 1.58
  let out = Math.min(1.58, Math.max(0.82, mult));
  const farmMultFn = typeof passiveEffectMult === "function" ? passiveEffectMult
    : (typeof racialEffectMult === "function" ? racialEffectMult : null);
  if (farmMultFn) out *= farmMultFn("farmAdenaMult", race, lvl);
  return out;

}



