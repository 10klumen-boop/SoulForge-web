"use strict";

const path = require("path");
const { createSqliteStore } = require("./sqlite");

function createStore(opts) {
  opts = opts || {};
  const driver = String(process.env.SOULFORGE_DB_DRIVER || "sqlite").toLowerCase();
  if (driver === "postgres") {
    throw new Error(
      "SOULFORGE_DB_DRIVER=postgres is not implemented yet. Use sqlite or add server/db/postgres.js."
    );
  }
  const dataDir = opts.dataDir || process.env.SOULFORGE_DATA || path.join(__dirname, "..", "data");
  const dbPath =
    opts.dbPath || process.env.SOULFORGE_DB || path.join(dataDir, "soulforge.db");
  return createSqliteStore({ dataDir, dbPath });
}

module.exports = { createStore };
