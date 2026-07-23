// ===== Загрузка контентных JSON (зоны / квесты / награды глав) =====
// Вызов: await loadGameJsonData() в начале 99-bootstrap.js.
// Тесты: setup.loadGameJsonDataSync().

const GAME_JSON_PACKS = [
  { file: "src/data/json/story-zones.json", v: 1 },
  { file: "src/data/json/quest-content.json", v: 1 },
  { file: "src/data/json/zone-chapter-rewards.json", v: 1 },
  { file: "src/data/json/achievements.json", v: 1 },
  { file: "src/data/json/passive-skills.json", v: 1 },
];

function applyGameJsonPack(data) {
  if (!data || typeof data !== "object") return;
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  Object.keys(data).forEach((key) => {
    root[key] = data[key];
  });
}

function gameJsonFetchUrl(file, v) {
  return file + "?v=" + (v || 1);
}

async function loadGameJsonData() {
  if (typeof FARM_ZONES !== "undefined" && Array.isArray(FARM_ZONES) && FARM_ZONES.length) {
    return false;
  }
  const packs = await Promise.all(
    GAME_JSON_PACKS.map(async (p) => {
      const res = await fetch(gameJsonFetchUrl(p.file, p.v));
      if (!res.ok) throw new Error("Не удалось загрузить " + p.file + " (" + res.status + ")");
      return res.json();
    })
  );
  packs.forEach(applyGameJsonPack);
  return true;
}
