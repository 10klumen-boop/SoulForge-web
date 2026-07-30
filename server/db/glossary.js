"use strict";

/**
 * Online glossary store: server/data/glossary.json
 * Seeded once from game/src/data/glossary-data.js when missing.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ID_RE = /^[a-z0-9_]+$/;
const DEFAULT_CATEGORIES = {
  lore: "Лор",
  place: "Места",
  race: "Народы",
  character: "Персонажи",
  game: "Игра",
};
const MAX_BYTES_DEFAULT = 2 * 1024 * 1024;
const MAX_ENTRIES = 2000;

function createGlossaryStore(opts) {
  opts = opts || {};
  const dataDir = opts.dataDir;
  const gameDir = opts.gameDir;
  const filePath = opts.filePath || path.join(dataDir, "glossary.json");
  const maxBytes = Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : MAX_BYTES_DEFAULT;

  function ensureDir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function seedFromBundle() {
    const src = path.join(gameDir, "src", "data", "glossary-data.js");
    if (!fs.existsSync(src)) {
      return {
        categories: { ...DEFAULT_CATEGORIES },
        entries: [],
        updatedAt: new Date().toISOString(),
        seeded: true,
        source: "empty",
      };
    }
    const code = fs.readFileSync(src, "utf8");
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(
      code +
        "\n;this.GLOSSARY_ENTRIES=GLOSSARY_ENTRIES;this.GLOSSARY_CATEGORIES=GLOSSARY_CATEGORIES;",
      ctx
    );
    return {
      categories: ctx.GLOSSARY_CATEGORIES
        ? JSON.parse(JSON.stringify(ctx.GLOSSARY_CATEGORIES))
        : { ...DEFAULT_CATEGORIES },
      entries: Array.isArray(ctx.GLOSSARY_ENTRIES)
        ? JSON.parse(JSON.stringify(ctx.GLOSSARY_ENTRIES))
        : [],
      updatedAt: new Date().toISOString(),
      seeded: true,
      source: "bundle",
    };
  }

  function writeAtomic(doc) {
    ensureDir();
    const tmp = filePath + ".tmp";
    const json = JSON.stringify(doc, null, 2) + "\n";
    if (Buffer.byteLength(json, "utf8") > maxBytes) {
      const err = new Error("Глоссарий слишком большой");
      err.code = "too_large";
      throw err;
    }
    fs.writeFileSync(tmp, json, "utf8");
    fs.renameSync(tmp, filePath);
  }

  function getGlossary() {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const doc = JSON.parse(raw);
      return {
        categories: doc.categories && typeof doc.categories === "object"
          ? doc.categories
          : { ...DEFAULT_CATEGORIES },
        entries: Array.isArray(doc.entries) ? doc.entries : [],
        updatedAt: doc.updatedAt || null,
        seeded: false,
      };
    }
    const seeded = seedFromBundle();
    writeAtomic({
      categories: seeded.categories,
      entries: seeded.entries,
      updatedAt: seeded.updatedAt,
    });
    return seeded;
  }

  /**
   * @returns {{ ok: true, doc: object } | { ok: false, error: string }}
   */
  function validateAndNormalize(body) {
    if (!body || typeof body !== "object") {
      return { ok: false, error: "Нужен JSON-объект" };
    }
    const categoriesIn = body.categories;
    const entriesIn = body.entries;
    if (!categoriesIn || typeof categoriesIn !== "object" || Array.isArray(categoriesIn)) {
      return { ok: false, error: "categories должен быть объектом" };
    }
    if (!Array.isArray(entriesIn)) {
      return { ok: false, error: "entries должен быть массивом" };
    }
    if (entriesIn.length > MAX_ENTRIES) {
      return { ok: false, error: "Слишком много терминов (макс. " + MAX_ENTRIES + ")" };
    }

    const categories = {};
    for (const [k, v] of Object.entries(categoriesIn)) {
      const key = String(k || "").trim();
      if (!key || !ID_RE.test(key)) {
        return { ok: false, error: "Некорректный ключ категории: " + k };
      }
      categories[key] = String(v == null ? "" : v).trim().slice(0, 64) || key;
    }
    if (!Object.keys(categories).length) {
      return { ok: false, error: "Нужна хотя бы одна категория" };
    }

    const seen = Object.create(null);
    const entries = [];
    for (let i = 0; i < entriesIn.length; i++) {
      const raw = entriesIn[i];
      if (!raw || typeof raw !== "object") {
        return { ok: false, error: "Запись #" + (i + 1) + ": не объект" };
      }
      const id = String(raw.id || "").trim();
      if (!ID_RE.test(id)) {
        return { ok: false, error: "Запись #" + (i + 1) + ": id только a-z, 0-9, _" };
      }
      if (seen[id]) {
        return { ok: false, error: "Дубликат id: " + id };
      }
      seen[id] = true;
      const title = String(raw.title || "").trim().slice(0, 120);
      const short = String(raw.short || "").trim().slice(0, 4000);
      const category = String(raw.category || "").trim();
      if (!title) return { ok: false, error: "«" + id + "»: нужен title" };
      if (!short) return { ok: false, error: "«" + id + "»: нужно определение" };
      if (!category || !categories[category]) {
        return { ok: false, error: "«" + id + "»: неизвестная категория" };
      }
      let aliases = Array.isArray(raw.aliases) ? raw.aliases : [];
      aliases = aliases
        .map((a) => String(a == null ? "" : a).trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 40);
      if (!aliases.length) aliases = [title];
      entries.push({ id, title, category, aliases, short });
    }

    return {
      ok: true,
      doc: {
        categories,
        entries,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  function putGlossary(body) {
    const result = validateAndNormalize(body);
    if (!result.ok) return result;
    try {
      writeAtomic(result.doc);
    } catch (e) {
      if (e && e.code === "too_large") {
        return { ok: false, error: e.message };
      }
      throw e;
    }
    return { ok: true, ...result.doc };
  }

  return {
    getGlossary,
    putGlossary,
    validateAndNormalize,
    filePath,
    seedFromBundle,
  };
}

module.exports = {
  createGlossaryStore,
  ID_RE,
  DEFAULT_CATEGORIES,
  MAX_ENTRIES,
};
