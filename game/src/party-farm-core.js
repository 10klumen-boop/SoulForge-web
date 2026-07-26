// ===== Party farm: отключён (контент группы = инстансы) =====

let partyFarmState = null;
let partyFarmPollTimer = null;
let partyFarmHitBusy = false;
let partyFarmDomMob = null;
let partyFarmLastEncId = null;

function isPartyFarmZone(zoneOrId) {
  const z =
    typeof zoneOrId === "string"
      ? typeof farmZoneById === "function"
        ? farmZoneById(zoneOrId)
        : null
      : zoneOrId;
  if (z && z.party) return true;
  if (typeof zoneOrId === "string" && typeof partyFarmZoneById === "function") {
    return !!partyFarmZoneById(zoneOrId);
  }
  return false;
}

function isPartyFarmSessionActive() {
  return false;
}

function partyFarmBeforeOpenMine() {
  if (typeof toast === "function") {
    toast("Групповой фарм отключён. В группе доступны только инстансы.", "warn");
  }
  return false;
}

function partyFarmAfterStopMine() {
  partyFarmState = null;
  if (partyFarmPollTimer) {
    clearInterval(partyFarmPollTimer);
    partyFarmPollTimer = null;
  }
  partyFarmDomMob = null;
  partyFarmLastEncId = null;
}

function partyFarmShouldBlockLocalSpawn() {
  return false;
}

async function partyFarmHandleHit() {
  return true;
}

function partyFarmSyncEncounter() {}
