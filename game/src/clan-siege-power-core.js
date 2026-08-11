// ===== Сила осады: сбор входов из клан-стейта + локальной профессии =====

function clanSiegeLocalProfessionEntry() {
  const av = typeof state !== "undefined" ? state.avatar : null;
  if (!av) return null;
  let tier = 0;
  let role = "unknown";
  if (typeof getAvatarProfession === "function") {
    const p = getAvatarProfession();
    if (p) {
      tier = Number(p.tier) || 0;
      role = p.role || p.kind || "unknown";
    }
  } else if (av.professionId && typeof professionById === "function") {
    const p = professionById(av.professionId);
    if (p) {
      tier = Number(p.tier) || 0;
      role = p.role || "unknown";
    }
  } else if (av.classId) {
    tier = 0;
    role =
      av.classId === "mystic" || av.classId === "shaman"
        ? "mage"
        : "melee";
  }
  return { tier, role };
}

/**
 * Оценка силы осады текущего клана (клиент).
 * Профессии соклановцев — из social snapshot (поле profession).
 */
function clanSiegePowerState() {
  const clan = typeof getChatClan === "function" ? getChatClan() : null;
  if (!clan) return null;

  const memberCount =
    (clan.members && clan.members.length) ||
    (typeof clanMemberCount === "function" ? clanMemberCount() : 0) ||
    1;

  const professions = [];
  (clan.members || []).forEach((m) => {
    if (m && m.profession && (m.profession.tier != null || m.profession.role)) {
      professions.push({
        tier: Number(m.profession.tier) || 0,
        role: m.profession.role || "unknown",
      });
    }
  });
  if (!professions.length) {
    const local = clanSiegeLocalProfessionEntry();
    if (local && typeof clanMyClanRef === "function" && clanMyClanRef()) {
      professions.push(local);
    }
  }

  const weekScore =
    typeof clanBuffState !== "undefined" && clanBuffState
      ? Number(clanBuffState.score) || 0
      : 0;

  const warehouseAdena =
    typeof clanWarehouseState !== "undefined" && clanWarehouseState
      ? Number(clanWarehouseState.adena) || 0
      : 0;
  const weekDepositAdena = Math.min(warehouseAdena, weekScore * 10000);

  const power = computeClanSiegePower({
    memberCount,
    professions,
    weekDepositAdena,
    weekScore,
  });

  return {
    ...power,
    labels:
      (typeof CLAN_SIEGE_POWER !== "undefined" && CLAN_SIEGE_POWER.labels) || {
        titleRu: "Сила осады",
        hintRu: "",
      },
  };
}

function clanSiegePowerCardHtml(opts) {
  opts = opts || {};
  const compact = !!opts.compact;
  const p = clanSiegePowerState();
  if (!p) {
    return (
      '<div class="clan-siege-power' +
      (compact ? " is-compact" : "") +
      '">' +
      "<strong>Сила клана</strong>" +
      '<p class="party-panel-hint">Нужен клан. Сила растёт от состава, профессий и вложений.</p>' +
      "</div>"
    );
  }
  if (compact) {
    return (
      '<div class="clan-siege-power is-compact">' +
      '<div class="clan-siege-power-head">' +
      "<strong>" +
      (p.labels.titleRu || "Сила клана") +
      '</strong><span class="clan-siege-power-total">' +
      p.total +
      "</span></div>" +
      '<div class="clan-siege-power-break-inline">' +
      "<span>состав <b>" +
      p.rosterPts +
      "</b></span>" +
      "<span>проф. <b>" +
      p.professionPts +
      "</b></span>" +
      "<span>влож. <b>" +
      (p.investPts + p.activityPts) +
      "</b></span>" +
      (opts.score != null
        ? '<span class="clan-siege-power-note">акт. ' +
          opts.score +
          (opts.weekId ? " · " + opts.weekId : "") +
          "</span>"
        : "") +
      "</div></div>"
    );
  }
  const hint = p.labels.hintRu || "";
  return (
    '<div class="clan-siege-power">' +
    '<div class="clan-siege-power-head">' +
    "<strong>" +
    (p.labels.titleRu || "Сила клана") +
    '</strong><span class="clan-siege-power-total">' +
    p.total +
    "</span></div>" +
    (hint ? '<p class="party-panel-hint">' + hint + "</p>" : "") +
    '<ul class="clan-siege-power-break">' +
    "<li>Состав · " +
    p.memberCount +
    " чел. → <b>" +
    p.rosterPts +
    "</b></li>" +
    "<li>Профессии · учтено " +
    p.knownProfessions +
    " → <b>" +
    p.professionPts +
    "</b>" +
    (p.knownProfessions < p.memberCount
      ? ' <small class="clan-siege-power-note">(пока только ваши данные)</small>'
      : "") +
    "</li>" +
    "<li>Вложения · склад/активность → <b>" +
    (p.investPts + p.activityPts) +
    "</b> <small>(" +
    p.investPts +
    "+" +
    p.activityPts +
    ")</small></li>" +
    "</ul></div>"
  );
}
