function renderMenu() {
  const n = inventoryCount();
  const overflow =
    typeof overflowLootCount === "function" ? overflowLootCount() : 0;
  const capHint = n >= INV_CAP ? "!" : overflow > 0 ? "+" : "";
  const invEl = $("#invCount");
  if (invEl) {
    invEl.textContent =
      n +
      "/" +
      INV_CAP +
      capHint +
      (overflow > 0 ? " · +" + overflow : "");
  }
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
  if (typeof syncEngagementMenuTile === "function") syncEngagementMenuTile();
  const glossMeta = document.getElementById("glossaryTileMeta");
  if (glossMeta && typeof glossaryAll === "function") {
    const n = glossaryAll().length;
    const m = n % 100;
    const m1 = n % 10;
    let word = "терминов";
    if (!(m > 10 && m < 20)) {
      if (m1 === 1) word = "термин";
      else if (m1 >= 2 && m1 <= 4) word = "термина";
    }
    glossMeta.textContent = n + " " + word;
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
  if (typeof syncClanTileMeta === "function") syncClanTileMeta();
  if (typeof renderBananaCasinoTileMeta === "function") renderBananaCasinoTileMeta();
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
  if (typeof clanHydrateWorldState === "function") clanHydrateWorldState(false);
}
