#!/usr/bin/env bash
set -euo pipefail

STACK_DIR=${STACK_DIR:-/opt/cooldesk}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}

cd "$STACK_DIR"

if [[ -n "${PROD_ENV_FILE:-}" ]]; then
  printf "%s" "$PROD_ENV_FILE" > .env
  chmod 600 .env
fi

if [[ ! -f .env ]]; then
  echo "Missing $STACK_DIR/.env"
  exit 1
fi

export BACKEND_IMAGE="${BACKEND_IMAGE:-}"
export FRONTEND_IMAGE="${FRONTEND_IMAGE:-}"

docker compose -f "$COMPOSE_FILE" pull

STACK_DIR="$STACK_DIR" COMPOSE_FILE="$COMPOSE_FILE" bash scripts/init-ssl.sh

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

if docker compose -f "$COMPOSE_FILE" ps backend >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" exec -T backend node -e "console.log('backend container ready')" || true
fi

if [[ -n "${HEALTHCHECK_API_URL:-}" ]]; then
  curl -fsS "$HEALTHCHECK_API_URL" >/dev/null
fi

if [[ -n "${HEALTHCHECK_APP_URL:-}" ]]; then
  curl -fsS "$HEALTHCHECK_APP_URL" >/dev/null
fi

echo "Deploy successful"