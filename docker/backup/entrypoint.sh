#!/bin/sh
# Runs backup.sh every day at BACKUP_TIME (HH:MM, container time zone TZ), plus once
# at start when BACKUP_ON_START=true. busybox crond does not pass the container
# environment to jobs, so it is written to a file the job sources.
set -eu
: "${BACKUP_TIME:=02:30}"
hour="${BACKUP_TIME%%:*}"
minute="${BACKUP_TIME##*:}"
export -p | grep -E 'export (PG|POSTGRES_|S3_|BACKUP_|RCLONE_|TZ)' > /etc/backup.env
echo "$minute $hour * * * . /etc/backup.env && /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "backup: daily at ${BACKUP_TIME} (${TZ:-UTC}), keeping ${BACKUP_KEEP_DAYS:-30} days"
if [ "${BACKUP_ON_START:-false}" = "true" ]; then /usr/local/bin/backup.sh; fi
exec crond -f -l 8
