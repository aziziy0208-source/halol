#!/bin/sh
# Copies the backed-up storage files back into the S3 bucket (Garage).
#   docker compose run --rm --entrypoint restore-files.sh backup
# Only adds/overwrites objects; nothing in the bucket is deleted.
set -eu
RCLONE_CONFIG_STORAGE_TYPE=s3 \
RCLONE_CONFIG_STORAGE_PROVIDER=Other \
RCLONE_CONFIG_STORAGE_ENDPOINT="${S3_ENDPOINT:-http://storage:3900}" \
RCLONE_CONFIG_STORAGE_REGION="${S3_REGION:-garage}" \
RCLONE_CONFIG_STORAGE_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
RCLONE_CONFIG_STORAGE_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
RCLONE_CONFIG_STORAGE_FORCE_PATH_STYLE=true \
  rclone copy /backups/files "storage:${S3_BUCKET:-whu-files}" --checksum --progress
