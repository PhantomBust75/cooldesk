# CoolDesk AWS EC2 Production Deployment Plan

## 1) Goal
Deploy CoolDesk (Next.js frontend + NestJS backend + PostgreSQL) to AWS with:
- Dockerized runtime
- Nginx reverse proxy
- HTTPS (Let's Encrypt)
- Automatic deployment when code is pushed to GitHub `prod` branch
- Single root env file shared by backend + frontend
- Same production stack runnable locally

---

## 2) Recommended Production Architecture

### Components
- **EC2 instance** (Ubuntu 22.04 LTS)
  - Runs Docker and Docker Compose
  - Runs `frontend`, `backend`, `postgres`, `nginx`, `certbot`
- **Route53 DNS**
  - `app.yourdomain.com` -> frontend (Nginx)
  - `api.yourdomain.com` -> backend (Nginx)
- **EBS volume**
  - Persistent Docker volumes (especially Postgres data)
- **S3 bucket**
  - Database backups (`pg_dump`) and optional app backups
- **GitHub Actions**
  - Trigger on push to `prod`
  - Builds and deploys containers to EC2 over SSH

### Security Baseline
- EC2 in public subnet with Security Group:
  - `22` only from your office/home IP (not `0.0.0.0/0`)
  - `80` and `443` from `0.0.0.0/0`
  - Do **not** expose Postgres `5432` publicly
- Use a dedicated Linux user for deploy (non-root)
- Store secrets in GitHub Secrets (and optionally AWS Secrets Manager)

---

## 3) Server Directory Layout

On EC2 (example path):

```bash
/opt/cooldesk/
  docker-compose.prod.yml
  .env
  nginx/
    app.conf
    api.conf
  scripts/
    deploy.sh
    backup-db.sh
  backups/
```

---

## 4) Docker Strategy

## Services
- `frontend`: Next.js app, exposed internally on `3001`
- `backend`: NestJS app, exposed internally on `3000`
- `postgres`: PostgreSQL 14+, persistent volume
- `nginx`: public entrypoint on ports `80`/`443`
- `certbot`: SSL certificate issuance/renewal

## Example `docker-compose.prod.yml` (template)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:14
    container_name: cooldesk-postgres
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - cooldesk_net

  backend:
    image: ghcr.io/<owner>/<repo>/backend:${IMAGE_TAG}
    container_name: cooldesk-backend
    restart: always
    env_file:
      - .env
    environment:
      PORT: ${BACKEND_PORT}
    depends_on:
      - postgres
    networks:
      - cooldesk_net

  frontend:
    image: ghcr.io/<owner>/<repo>/frontend:${IMAGE_TAG}
    container_name: cooldesk-frontend
    restart: always
    env_file:
      - .env
    environment:
      PORT: ${FRONTEND_PORT}
    depends_on:
      - backend
    networks:
      - cooldesk_net

  nginx:
    image: nginx:1.27-alpine
    container_name: cooldesk-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx:/etc/nginx/conf.d
      - /etc/letsencrypt:/etc/letsencrypt
      - /var/www/certbot:/var/www/certbot
    depends_on:
      - frontend
      - backend
    networks:
      - cooldesk_net

volumes:
  postgres_data:

networks:
  cooldesk_net:
    driver: bridge
```

### Single root env model (important)
- Use exactly one env file at stack root: `.env`
- Both `frontend` and `backend` containers read this same file via `env_file: .env`
- Variable naming convention:
  - Frontend public runtime/build values: `NEXT_PUBLIC_*`
  - Private backend values: `JWT_USER_SECRET`, `JWT_DEALER_SECRET`, `JWT_PLATFORM_SECRET`, `DATABASE_URL`, API secrets
- Keep service-specific ports explicit (`BACKEND_PORT`, `FRONTEND_PORT`) to avoid collisions
- Never commit production `.env`

---

## 5) Nginx Reverse Proxy Plan

### Frontend virtual host (`app.yourdomain.com`)
- Proxy to `frontend:3001`
- Enable gzip + cache headers for static assets

### API virtual host (`api.yourdomain.com`)
- Proxy to `backend:3000`
- Set headers:
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
  - `Host`
- Increase body size for file uploads if needed

### SSL
- Use Certbot with webroot challenge
- Redirect all HTTP traffic to HTTPS
- Add cron/systemd timer for renewal and Nginx reload

---

## 6) Database Plan (Included on EC2)

## Runtime
- PostgreSQL in Docker with persistent volume `postgres_data`
- App connects via internal docker network hostname `postgres`

## Backups
- Daily `pg_dump` to `/opt/cooldesk/backups`
- Sync backups to S3
- Retention policy: e.g., 14 daily + 8 weekly + 6 monthly

## Restore Drill (must test monthly)
- Restore dump into staging DB
- Run sanity checks (tenant data boundaries, row counts, auth login)

> Note: For stronger HA, migrate DB to **AWS RDS PostgreSQL Multi-AZ** later. Keep app containers on EC2 unchanged.

---

## 7) Environment Variables (single root `.env`)

Use one root env file for all services in both local and EC2:

```dotenv
# Core
NODE_ENV=production
IMAGE_TAG=latest

# URLs
APP_DOMAIN=app.yourdomain.com
API_DOMAIN=api.yourdomain.com
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_AUTH_LOGIN_PATH=/auth/login

# Ports
BACKEND_PORT=3000
FRONTEND_PORT=3001
POSTGRES_PORT=5432

# Optional image overrides for CI/CD deployments
BACKEND_IMAGE=ghcr.io/owner/repo/backend:prod-latest
FRONTEND_IMAGE=ghcr.io/owner/repo/frontend:prod-latest

# Database
POSTGRES_DB=cooldesk
POSTGRES_USER=cooldesk
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgres://cooldesk:change_me@postgres:5432/cooldesk

# Auth / Backend secrets
JWT_USER_SECRET=replace_with_long_random_secret
JWT_DEALER_SECRET=replace_with_long_random_secret
JWT_PLATFORM_SECRET=replace_with_long_random_secret
CORS_ORIGINS=https://app.yourdomain.com
UNDO_WINDOW_SECONDS=60
```

Rules:
- EC2 production uses `/opt/cooldesk/.env`
- Local production-like run uses project-root `.env.localprod` copied to `.env`
- Commit only `.env.example`; never commit real `.env`

---

## 8) GitHub Branch + CI/CD Plan (Auto Deploy on `prod`)

## Branch Policy
- Dev work -> PR -> merge into `prod`
- Only protected merges to `prod`

## CI/CD Flow
Trigger: `push` to `prod`

Pipeline:
1. Checkout repo
2. Build frontend/backend Docker images
3. Push images to GHCR (`ghcr.io`)
4. SSH into EC2
5. Pull latest images
6. Run DB migration (backend migration step)
7. `docker compose up -d`
8. Health checks (`/health`, frontend home)
9. Rollback if health check fails

## GitHub Actions workflow file
Create: `.github/workflows/deploy-prod.yml`

Repository configuration (matches current workflow):

### Required Secrets
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

### Optional Secrets
- `PROD_ENV_FILE` (full root `.env` content; used to refresh `/opt/cooldesk/.env` on deploy)

### Required Variables
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_AUTH_LOGIN_PATH`

### Optional Variables
- `HEALTHCHECK_API_URL`
- `HEALTHCHECK_APP_URL`

Notes:
- GHCR auth in this workflow uses `${{ secrets.GITHUB_TOKEN }}` via `docker/login-action`; no separate `GHCR_TOKEN` is required.
- `BACKEND_IMAGE` and `FRONTEND_IMAGE` are passed by workflow env into `scripts/deploy.sh`.

## Deployment script (on EC2)
Create `/opt/cooldesk/scripts/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /opt/cooldesk

docker compose -f docker-compose.prod.yml pull

docker compose -f docker-compose.prod.yml up -d

# optional migration command (adjust path/command to your backend image)
# docker compose -f docker-compose.prod.yml exec -T backend npm run migration:run

# basic health checks
curl -fsS https://api.yourdomain.com/health
curl -fsS https://app.yourdomain.com

echo "Deploy successful"
```

If using GitHub secret `PROD_ENV_FILE`, write it before deploy:

```bash
printf "%s" "$PROD_ENV_FILE" > /opt/cooldesk/.env
chmod 600 /opt/cooldesk/.env
```

---

## 9) First-Time Provisioning Checklist

1. Launch EC2 (Ubuntu 22.04, t3.medium+ recommended)
2. Attach static Elastic IP
3. Configure Security Group and DNS records
4. Install Docker + Compose plugin
5. Create `/opt/cooldesk` structure
6. Place `docker-compose.prod.yml`, Nginx configs, root `.env` (set `SSL_EMAIL`)
7. Push to `prod` branch — GitHub Actions runs `deploy.sh`, which calls `init-ssl.sh` automatically: temporary self-signed cert → nginx start → real Let's Encrypt cert → nginx reload
8. Validate app login and core API routes
9. Configure backup cron and test restore once

### EC2 bootstrap commands (copy/paste)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release; echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER

sudo mkdir -p /opt/cooldesk
sudo chown -R $USER:$USER /opt/cooldesk
cd /opt/cooldesk
git clone https://github.com/GruntFlow-io/cooldesk .

cp .env.example .env
chmod +x scripts/deploy.sh scripts/backup-db.sh
docker compose --env-file .env -f docker-compose.prod.yml config
```

Optional first manual deploy test:

```bash
STACK_DIR=/opt/cooldesk scripts/deploy.sh
```

---

## 10) Run the same prod setup locally

Use exactly the same compose file and service images locally.

### Local env flow
1. Create `./.env.localprod` from `./.env.example`
2. Copy it to `./.env` before running compose
3. Use local domains or localhost values:
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000`
  - `CORS_ORIGINS=http://localhost:3001`

### Local run commands

```bash
cp .env.localprod .env
docker compose -f docker-compose.prod.yml up -d
```

### Local stop commands

```bash
docker compose -f docker-compose.prod.yml down
```

This keeps local and EC2 production behavior aligned and avoids environment drift.

---

## 11) Release Procedure

1. Merge approved PR into `prod`
2. GitHub Actions deploys automatically
3. Verify:
   - App login
   - Brand creation
   - Job creation
   - Dashboard load
4. Monitor logs for 10–15 minutes

---

## 12) Rollback Plan

- Keep previous image tags available in GHCR
- Re-deploy previous known-good tags in `docker-compose.prod.yml`
- Restart stack
- If migration was destructive, restore DB from latest backup snapshot/dump

---

## 13) Monitoring and Ops (Minimum)

- Container logs: `docker compose logs -f`
- Host metrics: CPU, RAM, disk, network (CloudWatch agent)
- Uptime checks for:
  - `https://app.yourdomain.com`
  - `https://api.yourdomain.com/health`
- Alert to email/Slack on downtime and low disk (<20%)

---

## 14) Suggested Next Enhancements

1. Move DB from EC2 container to RDS Multi-AZ
2. Put EC2 behind ALB + ACM certs
3. Use AWS Secrets Manager + SSM Parameter Store for secrets
4. Add blue/green deployment using two compose projects
5. Add staging environment (`staging` branch)

---

## 15) Acceptance Criteria for “Done”

- Push to `prod` triggers automated deployment
- New code visible on `app.yourdomain.com`
- API updated on `api.yourdomain.com`
- HTTPS valid and auto-renewing
- DB persistent across container restarts
- Daily backups available in S3 and restore tested
- Rollback runbook validated at least once
- Both frontend and backend read from one root `.env`
- Same prod compose stack runs locally with `.env.localprod` -> `.env`
