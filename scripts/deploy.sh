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

# Always enforce correct production values regardless of PROD_ENV_FILE content
# Uses replace-or-append so it works even if the key is missing from the secret
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}
set_env API_DOMAIN    "api.gruntflow.io"
set_env CORS_ORIGINS  "https://frontend-mu-coral-29.vercel.app,http://app.100-24-156-209.sslip.io"

export BACKEND_IMAGE="${BACKEND_IMAGE:-}"

docker compose -f "$COMPOSE_FILE" pull

STACK_DIR="$STACK_DIR" COMPOSE_FILE="$COMPOSE_FILE" bash scripts/init-ssl.sh

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Remove dangling images and stopped containers left over from previous deploys
docker system prune -f --volumes=false

if docker compose -f "$COMPOSE_FILE" ps backend >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" exec -T backend node -e "console.log('backend container ready')" || true
fi

wait_for_url() {
  local url="$1" label="$2"
  echo "Waiting for $label to be ready..."
  for attempt in $(seq 1 20); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      echo "$label is ready."
      return 0
    fi
    echo "  attempt $attempt/20 – not ready yet, retrying in 5s..."
    sleep 5
  done
  echo "$label health check failed after 100s"
  return 1
}

if [[ -n "${HEALTHCHECK_API_URL:-}" ]]; then
  wait_for_url "$HEALTHCHECK_API_URL" "API"
fi

if [[ -n "${HEALTHCHECK_APP_URL:-}" ]]; then
  wait_for_url "$HEALTHCHECK_APP_URL" "App"
fi

echo "Deploy successful"