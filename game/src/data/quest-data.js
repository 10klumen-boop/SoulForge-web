// ===== Данные квестов: формулы (таблицы NPC/боссов — в json/quest-content.json) =====

/** Убийств по шагам: [зачистка, элита, финал] — подтягивает lvl/силу к боссу и частично к гейту след. зоны */
function zoneQuestKillTargets(chapter) {
  const ch = Math.min(5, Math.max(1, chapter || 1));
  // Больше киллов при меньшем XP/килл — глава дольше, сумма ≈ гейт след. зоны
  if (ch === 1) return [38, 25, 40];
  return [
    Math.round((12 + ch * 4) * 2),
    Math.round((8 + ch * 3) * 2),
    Math.round((14 + ch * 3) * 2),
  ];
}

/** Сколько «золотых» целей нужно на шаге 2 */
function zoneQuestGoldenTarget(chapter) {
  return 1 + Math.min(5, Math.max(1, chapter || 1));
}
