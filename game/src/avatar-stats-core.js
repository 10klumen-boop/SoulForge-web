// ===== Статы персонажа и фарм-зоны: core logic =====
// Чистые расчёты вынесены в avatar-math.js.
// Здесь: выбор зоны, проверки входа, миграции, бонус награды.
// UI рендер остался в 24-avatar-stats.js.

// ===== Статы персонажа, сила фарма (зоны и сюжет — 25-story-zones.js) =====



// ===== Статы персонажа: логика и UI =====
// Чистые расчёты (avatarStats, avatarFarmPower, mineMobMaxHp и т.д.) вынесены в avatar-math.js.


function migrateFarmZone() {

  if (typeof migrateAvatar === "function") migrateAvatar();

  let cur = state.farmZone;
  if (typeof resolveFarmZoneId === "function") {
    const resolved = resolveFarmZoneId(cur);
    if (resolved && resolved !== cur) {
      ProgressStore.set("farmZone", resolved);
      cur = resolved;
    }
  }

  const zone = typeof farmZoneById === "function"
    ? farmZoneById(cur)
    : FARM_ZONES.find((z) => z.id === cur);

  if (zone && zone.active && zone.id === cur && canEnterFarmZone(zone)) return;

  const fallbackId =
    (typeof recommendedFarmZoneId === "function" &&
      (recommendedFarmZoneId({ mode: "story" }) || recommendedFarmZoneId({ mode: "farm" }))) ||
    (FARM_ZONES.find((z) => z && z.active && canEnterFarmZone(z)) || null)?.id ||
    null;

  // Не оставлять farmZone на закрытой главе — иначе «Играть» мёртвая
  if (fallbackId && state.farmZone !== fallbackId) {
    ProgressStore.set("farmZone", fallbackId);
  }

}



function selectFarmZone(zoneId) {

  const zone = farmZoneById(zoneId);

  if (!zone.active) {

    toast(zone.storyTag + " — в разработке", "warn");

    return false;

  }

  if (zone.party) {
    toast("Групповой фарм отключён. В группе — только инстансы.", "warn");
    return false;
  }

  if (!canEnterFarmZone(zone)) {

    const st = farmZoneStatus(zone);

    if (st.chapterDone) {
      toast("Глава пройдена — зона закрыта", "warn");
      return false;
    }

    const parts = [];

    if (st.needQuest && typeof prevFarmZone === "function") {
      const prev = prevFarmZone(zone);
      if (prev) parts.push("глава «" + (zoneRaceView(prev)?.name || prev.id) + "»");
    }

    if (st.needLevel > 0) parts.push("ур. " + zone.reqLevel);

    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");

    toast("Нужно: " + (parts.length ? parts.join(", ") : "закрыто"), "warn");

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



function recommendedFarmZoneId(opts) {
  opts = opts || {};
  const mode = opts.mode; // "story" | "farm" | undefined (= story preference)
  let best = null;
  FARM_ZONES.forEach((z) => {
    if (!z.active || !canEnterFarmZone(z)) return;
    if (mode === "farm" && !z.side) return;
    if (mode !== "farm" && z.side) return;
    if (!best || (z.chapter || 0) > (best.chapter || 0)) best = z;
  });
  if (best) return best.id;
  if (mode === "farm") {
    const side = FARM_ZONES.find((z) => z.side && z.active);
    return side?.id || null;
  }
  return FARM_ZONES.find((z) => !z.side)?.id || FARM_ZONES[0]?.id;
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
    if (z.chapter > 1 || z.side) {
      const v = typeof zoneRaceView === "function" ? zoneRaceView(z) : z;
      if (typeof toast === "function") {
        toast((z.side ? "Фарм: " : (v.storyTag + ": ")) + v.name, "success");
      }
      if (typeof gameLog === "function") {
        gameLog(
          (z.side ? "Фарм открыт: " : "Этап открыт: ") +
            v.name +
            " · ур. " +
            z.reqLevel +
            "+" +
            (farmZoneUsesPowerGate(z) ? " · сила " + fmt(z.reqPower) + "+" : ""),
          "system"
        );
      }
    }
  });
  save();
}



/** Охота / party: гейт по силе. Сюжет — только уровень (+ предыдущая глава). */
function farmZoneUsesPowerGate(zone) {
  return !!(zone && (zone.side || zone.party));
}

function canEnterFarmZone(zone) {

  zone = zone || farmZoneById(state.farmZone || "banana_mine");

  if (!zone.active) return false;

  if (!state.avatar?.created) {
    if ((zone.reqLevel || 0) > 1) return false;
    if (farmZoneUsesPowerGate(zone) && (zone.reqPower || 0) > 0) return false;
    return true;
  }

  // Сюжет: пройденная глава закрыта (охота/side остаётся открытой)
  if (
    !zone.side &&
    !zone.party &&
    typeof isZoneChapterComplete === "function" &&
    isZoneChapterComplete(zone.id)
  ) {
    return false;
  }

  const lvl = state.avatar.level || 1;
  if (lvl < (zone.reqLevel || 0)) return false;

  if (farmZoneUsesPowerGate(zone)) {
    const power = avatarFarmPower();
    if (power < (zone.reqPower || 0)) return false;
    return true;
  }

  if (typeof isPrevZoneChapterComplete === "function" && !isPrevZoneChapterComplete(zone)) return false;

  return true;

}



function farmZoneStatus(zone) {

  zone = typeof zone === "string" ? farmZoneById(zone) : zone;

  const power = avatarFarmPower();

  const lvl = state.avatar?.level || 1;

  const chapterDone =
    !!(zone && !zone.side && !zone.party) &&
    typeof isZoneChapterComplete === "function" &&
    isZoneChapterComplete(zone.id);

  const ok = canEnterFarmZone(zone);

  const needQuest =
    typeof isPrevZoneChapterComplete === "function" ? !isPrevZoneChapterComplete(zone) : false;

  const powerGate = farmZoneUsesPowerGate(zone);

  return {

    zone,

    ok,

    locked: !zone.active,

    chapterDone,

    power,

    level: lvl,

    needPower: powerGate ? Math.max(0, (zone.reqPower || 0) - power) : 0,

    needLevel: Math.max(0, (zone.reqLevel || 0) - lvl),

    needQuest,

    targetPower: farmZoneTargetPower(zone),

    powerRatio: power / Math.max(1, farmZoneTargetPower(zone)),

  };

}

function farmZoneLockHint(zone) {
  const st = farmZoneStatus(zone);
  if (st.ok) return "";
  if (st.chapterDone) return "глава ✓ · закрыто";
  const parts = [];
  // Сюжет: сначала предыдущая глава, потом уровень
  if (st.needQuest && typeof questStatusText === "function") parts.push(questStatusText(zone));
  if (st.needLevel > 0) parts.push("ур. " + zone.reqLevel);
  if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");
  return parts.length ? parts.join(" · ") : "Закрыто";
}



function farmZoneChipText(zone, st) {

  const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;

  if (!zone.active) return view.storyTag + " · скоро";

  if (st.chapterDone) return "глава ✓ · закрыто";

  if (!st.ok) {

    const parts = [];

    if (st.needQuest && typeof questStatusText === "function") parts.push(questStatusText(zone));

    if (st.needLevel > 0) parts.push("от ур." + zone.reqLevel);

    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");

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
    return beat.targets + " · сила " + fit;
  }

  return view.desc;

}



function farmZoneMetaText(zone, st) {

  const view = typeof zoneRaceView === "function" ? zoneRaceView(zone) : zone;

  if (!zone.active) return view.storyTag + " · " + view.desc;

  if (!st.ok) {

    if (st.chapterDone) return "Глава пройдена — зона закрыта";

    const parts = [];

    if (st.needQuest && typeof prevFarmZone === "function") {
      const prev = prevFarmZone(zone);
      if (prev) parts.push("глава «" + (zoneRaceView(prev)?.name || prev.id) + "»");
    }

    if (st.needLevel > 0) parts.push("ур. " + zone.reqLevel);

    if (st.needPower > 0) parts.push(fmt(zone.reqPower) + " силы");

    return "Требуется: " + parts.join(", ");

  }

  const tgt = farmZoneTargetPower(zone);

  const pwr = st.power || avatarFarmPower();

  const fit = pwr >= tgt ? "норма" : fmt(pwr) + "/" + fmt(tgt) + " силы";
  const dropLbl = typeof mineDropGradeSummary === "function" ? mineDropGradeSummary(zone.id) : "D";

  return "Дроп " + dropLbl + " · " + fit;
}



function avatarMineRewardMult(zoneId) {

  zoneId = zoneId || state.farmZone || "banana_mine";

  const zone = farmZoneById(zoneId);

  if (!canEnterFarmZone(zone)) return 0;

  const power = avatarFarmPower();

  const lvl = state.avatar?.level || 1;

  const target = farmZoneTargetPower(zone);

  const entry = Math.max(zone.reqPower || 0, Math.floor(target * 0.86));

  const chapter =
    typeof farmZoneProgressChapter === "function"
      ? farmZoneProgressChapter(zone)
      : zone.chapter || 1;

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
  if (farmMultFn) out *= farmMultFn("farmAdenaMult", state.avatar || race, lvl);
  return out;

}



