function renderMenu() {
  const n = inventoryCount();
  const capHint = n >= INV_CAP ? "!" : "";
  const invEl = $("#invCount");
  if (invEl) invEl.textContent = n + "/" + INV_CAP + capHint;
  const asMeta = document.getElementById("accountStorageMeta");
  if (asMeta && typeof accountWarehouseCount === "function") {
    const wh = accountWarehouseCount();
    const cap = typeof ACCOUNT_WAREHOUSE_CAP === "number" ? ACCOUNT_WAREHOUSE_CAP : 40;
    asMeta.textContent = wh + "/" + cap;
  }
  const mail =
    typeof playerMailBadgeCount === "function" ? playerMailBadgeCount() : 0;
  const mailBadge = document.getElementById("playerMailBadge");
  if (mailBadge) {
    mailBadge.hidden = !(mail > 0);
    mailBadge.textContent = mail > 99 ? "99+" : String(mail);
  }
  const mailMeta = document.getElementById("playerMailMeta");
  if (mailMeta) {
    mailMeta.hidden = true;
    mailMeta.textContent = "";
  }
  const achEl = document.getElementById("achCount");
  if (achEl && typeof achievementsProgress === "function") {
    const { done, total } = achievementsProgress();
    achEl.textContent = done + "/" + total;
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
  if (typeof syncPartyTileMeta === "function") syncPartyTileMeta();
  if (typeof syncCloudUI === "function") syncCloudUI();
  const tileMeta = document.getElementById("avatarTileMeta");
  if (tileMeta) {
    if (typeof needsAvatarSetup === "function" && needsAvatarSetup()) {
      tileMeta.textContent = "Создать";
    } else if (state.avatar?.created) {
      const p = typeof avatarProgress === "function" ? avatarProgress() : { level: 1 };
      tileMeta.textContent = "ур. " + p.level;
    }
  }
  if (typeof syncMenuHubMode === "function") syncMenuHubMode();
}
