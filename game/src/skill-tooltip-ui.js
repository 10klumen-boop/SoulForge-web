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
