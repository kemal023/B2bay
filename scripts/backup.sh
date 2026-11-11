#!/bin/sh
# Daily database backup, run by the `backup` service in docker-compose.yml.
# Writes a compressed pg_dump to ./backups and keeps the last $KEEP_DAYS days.
#
#   terugzetten (in een LEGE database):
#     pg_restore --no-owner --dbname "$DATABASE_URL" backups/cosmeweb-YYYY-MM-DD.dump
set -eu
KEEP_DAYS="${KEEP_DAYS:-14}"
URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"

while true; do
  file="/backups/cosmeweb-$(date +%F).dump"
  echo "$(date '+%F %T') back-up naar $file"
  if pg_dump --format=custom --no-owner --file="$file.tmp" "$URL"; then
    mv "$file.tmp" "$file"
    echo "$(date '+%F %T') klaar: $(du -h "$file" | cut -f1)"
    find /backups -name 'cosmeweb-*.dump' -mtime +"$KEEP_DAYS" -print -delete
  else
    rm -f "$file.tmp"
    echo "$(date '+%F %T') BACK-UP MISLUKT" >&2
  fi
  sleep 86400
done
