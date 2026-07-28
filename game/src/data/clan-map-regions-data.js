// ===== Aden map regions + routes (разметка через aden-map-markup.html) =====
// Карта очищена: контуры угодий рисуются вручную и вставляются сюда.

const CLAN_MAP_REGIONS = [];

/** Пути между маркерами территорий (id из CLAN_TERRITORIES). */
const CLAN_MAP_ROUTES = [];

function clanMapRegionById(id) {
  return (CLAN_MAP_REGIONS || []).find((r) => r.id === id) || null;
}

function clanMapPolyToSvgPoints(poly) {
  return (poly || [])
    .map((p) => Number(p[0]) + "," + Number(p[1]))
    .join(" ");
}

/**
 * Сглаженный замкнутый path через середины рёбер (квадратичные кривые).
 * Hit-test — по исходным вершинам poly.
 */
function clanMapPolyToSmoothPath(poly) {
  const pts = (poly || [])
    .map((p) => [Number(p[0]), Number(p[1])])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const n = pts.length;
  if (n < 3) return "";
  const mid = (i, j) => [(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2];
  let d = "M " + mid(n - 1, 0)[0] + " " + mid(n - 1, 0)[1];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const m = mid(i, next);
    d += " Q " + pts[i][0] + " " + pts[i][1] + " " + m[0] + " " + m[1];
  }
  d += " Z";
  return d;
}

/** Ray-casting point-in-polygon. x,y в % 0–100. */
function clanMapPointInPoly(x, y, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function clanMapRegionAtPct(x, y) {
  const list = CLAN_MAP_REGIONS || [];
  for (let i = 0; i < list.length; i++) {
    if (clanMapPointInPoly(x, y, list[i].poly)) return list[i];
  }
  return null;
}

function clanMapRegionsAtPct(x, y) {
  return (CLAN_MAP_REGIONS || []).filter((r) => clanMapPointInPoly(x, y, r.poly));
}
