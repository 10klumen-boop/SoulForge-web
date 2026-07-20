-- SoulForge PostgreSQL schema (target for migration from SQLite)
-- Apply: psql "$DATABASE_URL" -f server/db/schema.postgres.sql

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  nick CITEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(48) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(exp);

CREATE TABLE IF NOT EXISTS scores (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id VARCHAR(64) NOT NULL,
  char_name VARCHAR(48),
  max_plus INTEGER NOT NULL DEFAULT 0,
  farm_power INTEGER NOT NULL DEFAULT 0,
  earned BIGINT NOT NULL DEFAULT 0,
  adena BIGINT NOT NULL DEFAULT 0,
  mobs INTEGER NOT NULL DEFAULT 0,
  client_version VARCHAR(32),
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_max_plus ON scores(max_plus DESC, updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_farm_power ON scores(farm_power DESC, updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_earned ON scores(earned DESC, updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_mobs ON scores(mobs DESC, updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_char_name ON scores(char_name);

CREATE TABLE IF NOT EXISTS player_saves (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nick CITEXT NOT NULL,
  payload JSONB NOT NULL,
  seq BIGINT NOT NULL DEFAULT 0,
  saved_at BIGINT NOT NULL,
  client_version VARCHAR(32),
  chars_count INTEGER NOT NULL DEFAULT 0,
  active_name VARCHAR(48),
  active_level INTEGER NOT NULL DEFAULT 1,
  adena BIGINT NOT NULL DEFAULT 0,
  mobs INTEGER NOT NULL DEFAULT 0,
  max_plus INTEGER NOT NULL DEFAULT 0,
  farm_zone VARCHAR(64),
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_saves_nick ON player_saves(nick);
CREATE INDEX IF NOT EXISTS idx_player_saves_active_name ON player_saves(active_name);
CREATE INDEX IF NOT EXISTS idx_player_saves_updated_at ON player_saves(updated_at DESC);

CREATE TABLE IF NOT EXISTS player_characters (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id VARCHAR(64) NOT NULL,
  nick CITEXT NOT NULL,
  name VARCHAR(48),
  race_id VARCHAR(32),
  class_id VARCHAR(32),
  gender_id VARCHAR(16),
  level INTEGER NOT NULL DEFAULT 1,
  adena BIGINT NOT NULL DEFAULT 0,
  farm_zone VARCHAR(64),
  created SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_player_characters_nick ON player_characters(nick);
CREATE INDEX IF NOT EXISTS idx_player_characters_name ON player_characters(name);

CREATE TABLE IF NOT EXISTS write_leases (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(96) NOT NULL,
  claimed_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_write_leases_expires ON write_leases(expires_at);

CREATE TABLE IF NOT EXISTS character_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id VARCHAR(64) NOT NULL,
  char_name VARCHAR(48),
  event VARCHAR(32) NOT NULL,
  payload JSONB,
  adena BIGINT,
  client_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_character_events_user_char
  ON character_events(user_id, character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_character_events_created
  ON character_events(created_at DESC);

CREATE TABLE IF NOT EXISTS character_backups (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id VARCHAR(64) NOT NULL,
  char_name VARCHAR(48),
  progress JSONB NOT NULL,
  seq BIGINT NOT NULL DEFAULT 0,
  client_version VARCHAR(32),
  adena BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  saved_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_character_backups_user_char
  ON character_backups(user_id, character_id, created_at DESC);

CREATE TABLE IF NOT EXISTS balance_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id VARCHAR(64),
  char_name VARCHAR(48),
  alert_type VARCHAR(48) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'warn',
  message TEXT NOT NULL,
  event_type VARCHAR(32),
  event_id BIGINT,
  payload JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_balance_alerts_created ON balance_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_alerts_severity ON balance_alerts(severity, created_at DESC);

-- Optional later: finer-grained run_events stream (not used; character_events covers audit)
