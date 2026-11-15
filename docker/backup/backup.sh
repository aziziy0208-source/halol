#!/bin/sh
# One backup run (spec §9: daily automatic backup of database and files).
#   /backups/db/whu-<timestamp>.dump   pg_dump custom format (restore: pg_restore, see docs/deploy.md)
#   /backups/files/                    copy of the S3 bucket (only additions — nothing is deleted)
# Optional off-site copy: BACKUP_RCLONE_REMOTE (an rclone remote configured via RCLONE_CONFIG_* env).
set -eu
stamp="$(date +%Y-%m-%d_%H%M)"
mkdir -p /backups/db /backups/files

echo "[backup ${stamp}] database"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "${PGHOST:-postgres}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --format=custom --compress=6 --file="/backups/db/whu-${stamp}.dump.partial"
mv "/backups/db/whu-${stamp}.dump.partial" "/backups/db/whu-${stamp}.dump"

echo "[backup ${stamp}] files"
RCLONE_CONFIG_STORAGE_TYPE=s3 \
RCLONE_CONFIG_STORAGE_PROVIDER=Other \
RCLONE_CONFIG_STORAGE_ENDPOINT="${S3_ENDPOINT:-http://storage:3900}" \
RCLONE_CONFIG_STORAGE_REGION="${S3_REGION:-garage}" \
RCLONE_CONFIG_STORAGE_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
RCLONE_CONFIG_STORAGE_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
RCLONE_CONFIG_STORAGE_FORCE_PATH_STYLE=true \
  rclone copy "storage:${S3_BUCKET:-whu-files}" /backups/files --checksum --quiet

# Retention for database dumps (file copies are kept: certificates are never deleted).
find /backups/db -name 'whu-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-30}" -delete

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "[backup ${stamp}] off-site → ${BACKUP_RCLONE_REMOTE}"
  rclone copy /backups "$BACKUP_RCLONE_REMOTE" --quiet
fi
echo "[backup ${stamp}] done: $(du -sh /backups/db | cut -f1) dumps, $(du -sh /backups/files | cut -f1) files"
