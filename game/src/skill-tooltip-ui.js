// ===== Тултипы боевых скиллов (скилл-бар + панель персонажа) =====
// Переиспользует item-tip shell; описания — combatSkillGameplayDesc.

function combatSkillTooltipHtml(skill) {
  if (!skill || typeof itemTipShellHtml !== "function") return "";
  const unlocked = typeof isCombatSkillUnlocked === "function" && isCombatSkillUnlocked(skill);
  const cdLeft =
    typeof combatSkillCooldownLeft === "function" ? combatSkillCooldownLeft(skill.id) : 0;
  const baseCd = Number(skill.cdMs) || 0;
  const effCd =
    typeof combatSkillEffectiveCdMs === "function" ? combatSkillEffectiveCdMs(skill) : baseCd;
  const typeLabel =
    typeof combatSkillEffectLabel === "function"
      ? combatSkillEffectLabel(skill.effect)
      : "Боевой скилл";
  const desc =
    typeof combatSkillGameplayDesc === "function"
      ? combatSkillGameplayDesc(skill)
      : skill.desc || "";

  const stats = [
    {
      k: "Перезарядка",
      v:
        (typeof combatSkillFmtSec === "function" ? combatSkillFmtSec(effCd) : effCd + " мс") +
        (effCd !== baseCd && baseCd
          ? " (база " +
            (typeof combatSkillFmtSec === "function" ? combatSkillFmtSec(baseCd) : baseCd) +
            ")"
          : ""),
    },
    { k: "Тип", v: typeLabel },
  ];
  if (skill.unlockLevel) {
    stats.push({
      k: "Открытие",
      v: unlocked ? "открыт · ур. " + skill.unlockLevel : "с ур. " + skill.unlockLevel,
    });
  }

  const meta = [desc];
  if (skill.adenaHitBonus > 0) {
    meta.push("Бонус адены на усиленный удар: +" + skill.adenaHitBonus + "%");
  }

  let status;
  if (!unlocked) status = "Закрыт — нужен ур. " + (skill.unlockLevel || "?");
  else if (cdLeft > 0) status = "Перезарядка: " + Math.ceil(cdLeft / 1000) + " с";
  else status = "Готов к применению";

  const actions = [
    status,
    skill.hotkey
      ? "Клик или клавиша " + skill.hotkey + " — применить на поле"
      : "Клик — применить на поле",
  ];

  return itemTipShellHtml({
    icon: skill.icon,
    title: skill.name,
    subtitle: "Боевой скилл" + (skill.hotkey ? " · [" + skill.hotkey + "]" : ""),
    stats: stats,
    meta: meta,
    actions: actions,
  });
}

/** Тултип активного баффа на поле фарма. */
function mineSkillBuffTooltipHtml(buff) {
  if (!buff || typeof itemTipShellHtml !== "function") return "";
  let skill = null;
  if (buff.skillId && typeof combatSkillsForAvatar === "function") {
    skill = combatSkillsForAvatar().find((s) => s.id === buff.skillId) || null;
  }
  const typeLabel =
    skill && typeof combatSkillEffectLabel === "function"
      ? combatSkillEffectLabel(skill.effect)
      : "Бафф скилла";
  const desc =
    skill && typeof combatSkillGameplayDesc === "function"
      ? combatSkillGameplayDesc(skill)
      : skill?.desc || "";
  const timeLine = buff.sticky
    ? "Длится до следующего удара"
    : buff.leftMs > 0
      ? "Осталось: " + Math.ceil(buff.leftMs / 1000) + " с"
      : "Активен";
  const stats = [
    { k: "Статус", v: "Активен" },
    { k: "Длительность", v: timeLine },
    { k: "Тип", v: typeLabel },
  ];
  const meta = [];
  if (desc) meta.push(desc);
  if (skill?.adenaHitBonus > 0) {
    meta.push("Бонус адены на усиленный удар: +" + skill.adenaHitBonus + "%");
  }
  const actions = [
    "Бафф со скилла на поле задания",
    skill?.hotkey ? "Источник: [" + skill.hotkey + "] " + skill.name : "Источник: " + (buff.name || "скилл"),
  ];
  return itemTipShellHtml({
    icon: buff.icon || skill?.icon,
    title: buff.name || skill?.name || "Бафф",
    subtitle: "Активный бафф",
    stats: stats,
    meta: meta,
    actions: actions,
  });
}

/**
 * @param {HTMLElement} el
 * @param {() => object|null} getBuff
 */
function wireMineSkillBuffTooltip(el, getBuff) {
  if (!el || typeof wireItemTooltip !== "function") return;
  if (el.dataset.buffTipWired) return;
  el.dataset.buffTipWired = "1";
  const plain = (() => {
    const buff = typeof getBuff === "function" ? getBuff() : null;
    if (!buff) return "";
    return buff.sticky
      ? buff.name + " · до следующего удара"
      : buff.name + (buff.leftMs > 0 ? " · " + Math.ceil(buff.leftMs / 1000) + " с" : "");
  })();
  wireItemTooltip(
    el,
    () => {
      const buff = typeof getBuff === "function" ? getBuff() : null;
      return buff ? mineSkillBuffTooltipHtml(buff) : "";
    },
    plain
  );
}

/**
 * @param {HTMLElement} el
 * @param {() => object|null} getSkill
 */
function wireCombatSkillTooltip(el, getSkill) {
  if (!el || typeof wireItemTooltip !== "function") return;
  if (el.dataset.skillTipWired) return;
  el.dataset.skillTipWired = "1";
  wireItemTooltip(
    el,
    () => {
      const skill = typeof getSkill === "function" ? getSkill() : null;
      return skill ? combatSkillTooltipHtml(skill) : "";
    },
    (() => {
      const skill = typeof getSkill === "function" ? getSkill() : null;
      return typeof combatSkillPlainTip === "function" ? combatSkillPlainTip(skill) : "";
    })()
  );
}
