#!/usr/bin/env node
"use strict";

/**
 * PM2 ecosystem for VPS.
 * Usage:
 *   HOST=127.0.0.1 PORT=8787 pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "soulforge",
      script: "index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: "8787",
        HOST: "127.0.0.1",
        SOULFORGE_SERVE_GAME: "1",
        // SOULFORGE_ADMIN_KEY: "change-me-long-random",
      },
    },
  ],
};
