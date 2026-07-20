#!/bin/bash
# Nightly SQLite backup for SoulForge on VPS.
# Install:
#   sudo mkdir -p /var/backups/soulforge
#   sudo cp server/scripts/backup-sqlite.sh /usr/local/bin/soulforge-backup-db
#   sudo chmod +x /usr/local/bin/soulforge-backup-db
#   echo '15 3 * * * root /usr/local/bin/soulforge-backup-db' | sudo tee /etc/cron.d/soulforge-db

set -euo pipefail
SRC="${SOULFORGE_DB:-/var/www/soulforge/server/data/soulforge.db}"
DEST_DIR="${SOULFORGE_BACKUP_DIR:-/var/backups/soulforge}"
KEEP_DAYS="${SOULFORGE_BACKUP_KEEP_DAYS:-14}"

mkdir -p "$DEST_DIR"
if [[ ! -f "$SRC" ]]; then
  echo "soulforge backup: missing $SRC" >&2
  exit 1
fi

STAMP="$(date +%F)"
OUT="$DEST_DIR/soulforge-$STAMP.db"
cp -a "$SRC" "$OUT"
# Keep one rolling "latest" copy for quick restore
cp -a "$OUT" "$DEST_DIR/soulforge-latest.db"
find "$DEST_DIR" -name 'soulforge-????-??-??.db' -mtime +"$KEEP_DAYS" -delete
echo "soulforge backup: $OUT"
