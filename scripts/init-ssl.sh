#!/usr/bin/env bash
# Idempotent first-time SSL bootstrap.
#
# Flow:
#   1. If a valid cert already exists → exit (no-op on every subsequent deploy).
#   2. Create a temporary self-signed cert so nginx can start with the HTTPS config.
#   3. Start nginx (only) so it can serve the ACME webroot challenge.
#   4. Obtain a real Let's Encrypt cert via certbot webroot.
#   5. Reload nginx to pick up the real cert.
set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/cooldesk}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$STACK_DIR"

# shellcheck source=/dev/null
source .env

: "${APP_DOMAIN:?APP_DOMAIN must be set in .env}"
: "${API_DOMAIN:?API_DOMAIN must be set in .env}"
: "${SSL_EMAIL:?SSL_EMAIL must be set in .env}"

CERT_PATH="/etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem"

# Check whether a non-expired real cert already exists inside the named volume.
# --entrypoint sh overrides the certbot renewal loop; -c "..." is the command.
if docker compose -f "$COMPOSE_FILE" run --rm --entrypoint sh certbot \
    -c "test -f '${CERT_PATH}' && openssl x509 -checkend 86400 -noout -in '${CERT_PATH}'" \
    2>/dev/null; then
  echo "Valid certificate already exists for ${APP_DOMAIN} — skipping SSL init."
  exit 0
fi

echo "==> Generating temporary self-signed certificate for ${APP_DOMAIN}..."
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint sh certbot -c \
  "mkdir -p /etc/letsencrypt/live/${APP_DOMAIN} && \
   openssl req -x509 -nodes -newkey rsa:4096 \
     -keyout /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem \
     -out    /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem \
     -subj '/CN=${APP_DOMAIN}' -days 1"

echo "==> Starting nginx with temporary certificate..."
docker compose -f "$COMPOSE_FILE" up --wait -d nginx

echo "==> Obtaining Let's Encrypt certificate for ${APP_DOMAIN} and ${API_DOMAIN}..."
docker compose -f "$COMPOSE_FILE" run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${APP_DOMAIN}" -d "${API_DOMAIN}" \
  --email "${SSL_EMAIL}" \
  --agree-tos --no-eff-email --force-renewal

echo "==> Reloading nginx with real certificate..."
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo "==> SSL initialisation complete."
