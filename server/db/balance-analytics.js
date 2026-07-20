"use strict";

/** Главы I — зоны с мягким дропом (алерты на высокий грейд / adena). */
const CH1_ZONES = new Set(["banana_mine"]);

const HIGH_GRADES = new Set(["B", "A", "S"]);

/** Мин. длительность сессии для farm_adena_fast (короткие сессии раздувают APM). */
const FARM_APM_MIN_MS = 3 * 60 * 1000;
/** Порог adena/мин в главе I после FARM_APM_MIN_MS. */
const FARM_APM_WARN = 400000;

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

/**
 * Правила баланса — срабатывают при записи character_events.
 * @returns {{ type: string, severity: string, message: string }[]}
 */
function detectBalanceAlerts(event, payload) {
  const p = parsePayload(payload);
  const alerts = [];
  const zoneId = p.zoneId || p.zone || null;
  const inCh1 = !!(zoneId && CH1_ZONES.has(zoneId));

  if (event === "loot_weapon") {
    const grade = String(p.grade || "").toUpperCase();
    const source = String(p.source || "");
    const plus = Math.max(0, Math.floor(Number(p.plus) || 0));
    const name = p.weaponName || p.weaponId || "оружие";

    if (source === "golden" && plus >= 10) {
      alerts.push({
        type: "golden_high_plus",
        severity: "critical",
        message: `+${plus} с золотого моба: ${name} (${grade || "?"})`,
      });
    } else if (source === "golden" && plus >= 6) {
      alerts.push({
        type: "golden_mid_plus",
        severity: inCh1 ? "warn" : "info",
        message: `+${plus} с золотого: ${name}`,
      });
    }

    // Высокий грейд с золотого — только глава I (в mid/late это ожидаемо).
    if (source === "golden" && HIGH_GRADES.has(grade) && inCh1) {
      alerts.push({
        type: "golden_high_grade",
        severity: "critical",
        message: `Грейд ${grade} с золотого · ${zoneId}: ${name}`,
      });
    }

    if (source === "golden" && grade === "C" && inCh1) {
      alerts.push({
        type: "golden_c_ch1",
        severity: "warn",
        message: `C-grade с золотого в главе I (${zoneId}): ${name}`,
      });
    }
  }

  if (event === "enchant_ok") {
    const plus = Math.max(0, Math.floor(Number(p.plus) || 0));
    if (plus >= 14) {
      alerts.push({
        type: "enchant_legend",
        severity: "info",
        message: `Заточка +${plus}: ${p.weaponName || p.weaponId || "?"}`,
      });
    }
  }

  if (event === "enchant_break") {
    const plusBefore = Math.max(0, Math.floor(Number(p.plusBefore) || 0));
    if (plusBefore >= 9) {
      alerts.push({
        type: "enchant_break_high",
        severity: "info",
        message: `Слом на +${plusBefore}: ${p.weaponName || "?"}`,
      });
    }
  }

  if (event === "farm_session") {
    const dur = Math.max(0, Math.floor(Number(p.durationMs) || 0));
    const gain = Math.max(0, Math.floor(Number(p.adenaGain) || 0));
    if (inCh1 && dur >= FARM_APM_MIN_MS) {
      const apm = gain / (dur / 60000);
      if (apm > FARM_APM_WARN) {
        alerts.push({
          type: "farm_adena_fast",
          severity: "warn",
          message: `${Math.round(apm).toLocaleString("ru-RU")} adena/мин в ${zoneId} (≥${Math.round(FARM_APM_MIN_MS / 60000)} мин)`,
        });
      }
    }
  }

  if (event === "balance_alert") {
    alerts.push({
      type: String(p.alertType || "client").slice(0, 32),
      severity: String(p.severity || "warn").slice(0, 16),
      message: String(p.message || "balance_alert").slice(0, 240),
    });
  }

  return alerts;
}

function farmRowMetrics(row) {
  const sessions = row.sessions || 0;
  const adenaGain = row.adenaGain || 0;
  const durationMs = row.durationMs || 0;
  const hours = durationMs > 0 ? durationMs / 3600000 : 0;
  return {
    zoneId: row.zoneId || "—",
    sessions,
    kills: row.kills || 0,
    weapons: row.weapons || 0,
    adenaGain,
    durationMs,
    adenaPerHour: hours > 0 ? Math.round(adenaGain / hours) : 0,
    killsPerSession: sessions > 0 ? (row.kills / sessions).toFixed(1) : "0",
  };
}

function csvEscape(val) {
  const s = val == null ? "" : String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function rowsToCsv(columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  }
  return lines.join("\n");
}

module.exports = {
  CH1_ZONES,
  FARM_APM_MIN_MS,
  FARM_APM_WARN,
  parsePayload,
  detectBalanceAlerts,
  farmRowMetrics,
  csvEscape,
  rowsToCsv,
};
