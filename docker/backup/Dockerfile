# Daily backup job: PostgreSQL dump + copy of the object storage (certificate PDFs,
# signature/stamp images). Same major version as the database server for pg_dump.
FROM postgres:17-alpine
RUN apk add --no-cache rclone tzdata
COPY backup.sh entrypoint.sh restore-files.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh /usr/local/bin/restore-files.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
