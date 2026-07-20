-- SoulForge balance analytics — шаблоны для Navicat / sqlite3
-- БД: server/data/soulforge.db
-- Период: подставьте ?1 = since_ms, ?2 = until_ms (Unix ms)

-- === 1. Фарм по зонам (adena/час, киллы) ===
SELECT
  COALESCE(json_extract(payload, '$.zoneId'), '—') AS zone_id,
  COUNT(*) AS sessions,
  SUM(COALESCE(CAST(json_extract(payload, '$.kills') AS INTEGER), 0)) AS kills,
  SUM(COALESCE(CAST(json_extract(payload, '$.weapons') AS INTEGER), 0)) AS weapons,
  SUM(COALESCE(CAST(json_extract(payload, '$.adenaGain') AS INTEGER), 0)) AS adena_gain,
  SUM(COALESCE(CAST(json_extract(payload, '$.durationMs') AS INTEGER), 0)) AS duration_ms,
  ROUND(
    SUM(COALESCE(CAST(json_extract(payload, '$.adenaGain') AS INTEGER), 0)) * 3600000.0
    / NULLIF(SUM(COALESCE(CAST(json_extract(payload, '$.durationMs') AS INTEGER), 0)), 0),
    0
  ) AS adena_per_hour
FROM character_events
WHERE event = 'farm_session'
  AND created_at >= ?1 AND created_at <= ?2
GROUP BY zone_id
ORDER BY adena_gain DESC;

-- === 2. Заточка: ok / fail / break ===
SELECT event, COUNT(*) AS n
FROM character_events
WHERE event IN ('enchant_ok', 'enchant_fail', 'enchant_break')
  AND created_at >= ?1 AND created_at <= ?2
GROUP BY event;

-- === 3. Распределение успешных +N ===
SELECT
  CAST(json_extract(payload, '$.plus') AS INTEGER) AS plus,
  COUNT(*) AS n
FROM character_events
WHERE event = 'enchant_ok'
  AND created_at >= ?1 AND created_at <= ?2
  AND json_extract(payload, '$.plus') IS NOT NULL
GROUP BY plus
ORDER BY plus;

-- === 4. Воронка квестов (шаги по зонам) ===
SELECT
  COALESCE(json_extract(payload, '$.zoneId'), '—') AS zone_id,
  CAST(json_extract(payload, '$.step') AS INTEGER) AS step,
  COUNT(*) AS completions
FROM character_events
WHERE event = 'quest_step'
  AND created_at >= ?1 AND created_at <= ?2
GROUP BY zone_id, step
ORDER BY zone_id, step;

-- === 5. Экономика: источники adena ===
SELECT
  event,
  COUNT(*) AS n,
  SUM(COALESCE(CAST(json_extract(payload, '$.adenaGain') AS INTEGER), 0)) AS adena_gain
FROM character_events
WHERE event IN ('sell_weapon', 'crystallize', 'sell_crystals', 'farm_session')
  AND created_at >= ?1 AND created_at <= ?2
GROUP BY event;

-- === 6. Лут оружия: source × grade ===
SELECT
  COALESCE(json_extract(payload, '$.source'), '—') AS source,
  COALESCE(json_extract(payload, '$.grade'), '—') AS grade,
  COUNT(*) AS n
FROM character_events
WHERE event = 'loot_weapon'
  AND created_at >= ?1 AND created_at <= ?2
GROUP BY source, grade
ORDER BY n DESC;

-- === 7. Подозрительные алерты (таблица balance_alerts) ===
SELECT
  a.created_at,
  u.nick,
  a.char_name,
  a.severity,
  a.alert_type,
  a.message
FROM balance_alerts a
JOIN users u ON u.id = a.user_id
WHERE a.created_at >= ?1 AND a.created_at <= ?2
ORDER BY a.created_at DESC
LIMIT 200;

-- === 8. Золотой дроп B+ в главе I (ручная проверка) ===
SELECT
  e.created_at,
  u.nick,
  e.char_name,
  json_extract(e.payload, '$.weaponName') AS weapon,
  json_extract(e.payload, '$.grade') AS grade,
  json_extract(e.payload, '$.plus') AS plus,
  json_extract(e.payload, '$.zoneId') AS zone_id
FROM character_events e
JOIN users u ON u.id = e.user_id
WHERE e.event = 'loot_weapon'
  AND json_extract(e.payload, '$.source') = 'golden'
  AND json_extract(e.payload, '$.zoneId') = 'banana_mine'
  AND json_extract(e.payload, '$.grade') IN ('B', 'A', 'S', 'C')
  AND e.created_at >= ?1 AND e.created_at <= ?2
ORDER BY e.created_at DESC;
