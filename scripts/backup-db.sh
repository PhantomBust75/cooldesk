#!/usr/bin/env bash
set -euo pipefail

STACK_DIR=${STACK_DIR:-/opt/cooldesk}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}
BACKUP_DIR=${BACKUP_DIR:-$STACK_DIR/backups}
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_FILE="$BACKUP_DIR/cooldesk-$TIMESTAMP.sql.gz"

cd "$STACK_DIR"
mkdir -p "$BACKUP_DIR"

source .env

if [[ -z "${POSTGRES_DB:-}" || -z "${POSTGRES_USER:-}" ]]; then
  echo "POSTGRES_DB / POSTGRES_USER missing in .env"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

echo "Created backup: $BACKUP_FILE"

if [[ -n "${S3_BACKUP_URI:-}" ]]; then
  aws s3 cp "$BACKUP_FILE" "$S3_BACKUP_URI/"
  echo "Uploaded backup to $S3_BACKUP_URI"
fi