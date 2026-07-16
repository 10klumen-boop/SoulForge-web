function renderMenu() {
  const n = inventoryCount();
  const capHint = n >= INV_CAP ? " · полон" : "";
  $("#invCount").textContent = n + " / " + INV_CAP + capHint;
  const achEl = document.getElementById("achCount");
  if (achEl && typeof achievementsProgress === "function") {
    const { done, total } = achievementsProgress();
    achEl.textContent = done + " / " + total;
  }
  if (typeof renderMenuHero === "function") renderMenuHero();
  if (typeof renderMenuFarmHub === "function") renderMenuFarmHub();
  else if (typeof renderMineBanner === "function") renderMineBanner();
  if (typeof renderStoryArcBar === "function") renderStoryArcBar();
  const qjMeta = document.getElementById("questJournalMeta");
  if (qjMeta && typeof questJournalProgressSummary === "function") {
    qjMeta.textContent = questJournalProgressSummary();
  }
  if (typeof renderAvatarHub === "function") renderAvatarHub();
  if (typeof syncMenuTileIcons === "function") syncMenuTileIcons();
  if (typeof syncCloudUI === "function") syncCloudUI();
  const tileMeta = document.getElementById("avatarTileMeta");
  if (tileMeta) {
    if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
      tileMeta.textContent = "Создать персонажа";
    } else if (state.avatar?.created) {
      const p = typeof avatarProgress === "function" ? avatarProgress() : { level: 1 };
      const info = typeof avatarDisplayInfo === "function" ? avatarDisplayInfo() : { className: "" };
      tileMeta.textContent = state.avatar.name + " · " + (info.className || "") + " · " + p.level;
    }
  }
}
