// ===== Данные квестов: формулы (таблицы NPC/боссов — в json/quest-content.json) =====

/** Убийств по шагам: [зачистка, элита, финал] — подтягивает lvl/силу к боссу и частично к гейту след. зоны */
function zoneQuestKillTargets(chapter) {
  const ch = Math.min(5, Math.max(1, chapter || 1));
  if (ch === 1) return [22, 14, 24];
  return [
    12 + ch * 4,
    8 + ch * 3,
    14 + ch * 3,
  ];
}

/** Сколько «золотых» целей нужно на шаге 2 */
function zoneQuestGoldenTarget(chapter) {
  return 1 + Math.min(5, Math.max(1, chapter || 1));
}
