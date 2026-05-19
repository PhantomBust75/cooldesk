# CoolDesk

Multi-tenant SaaS portal for AC service businesses — NestJS backend + Next.js frontend + PostgreSQL.

---

## Quick Start (one command)

From the repository root:

```powershell
npm install
npm run start:all
```

This starts:
- **Backend** (NestJS) on `http://localhost:3000`
- **Frontend** (Next.js) on `http://localhost:3001`

---

## Default Owner Credentials

When bootstrapping an organization via `POST /platform/organizations`:

| Field    | Default            |
|----------|--------------------|
| Email    | `admin@email.com`  |
| Password | `password`         |

---

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Backend: copy `backend/.env.example` → `backend/.env.local` and fill in values

---

## Project Structure

```
.
├── backend/          # NestJS API (see backend/README.md)
├── frontend/         # Next.js app (see frontend/README.md)
├── docs/             # Architecture decisions and dev notes
├── scripts/          # Dev tooling (start-all.mjs, etc.)
└── .github/          # CI, plans, Copilot instructions
```

---

## Running Individually

**Backend**

```powershell
Set-Location backend
npm install
npm run start:dev
```

**Frontend**

```powershell
Set-Location frontend
npm install
npm run dev
```

---

## Docs

| Topic | File |
|-------|------|
| Hydration mismatch handling (Next.js) | [`docs/hydration-notes.md`](docs/hydration-notes.md) |
| AWS EC2 production deployment | [`docs/aws-ec2-prod-deployment-plan.md`](docs/aws-ec2-prod-deployment-plan.md) |

---

## Production Deploy (EC2 + `prod` branch)

### Required GitHub repository secrets

- `EC2_HOST` (example: `12.34.56.78`)
- `EC2_USER` (example: `ubuntu`)
- `EC2_SSH_KEY` (private key content for SSH)
- `PROD_ENV_FILE` (optional, full root `.env` content for server refresh)

### Required GitHub repository variables

- `NEXT_PUBLIC_API_BASE_URL` (example: `https://api.yourdomain.com`)
- `NEXT_PUBLIC_AUTH_LOGIN_PATH` (example: `/auth/login`)

### Optional GitHub repository variables

- `HEALTHCHECK_API_URL` (example: `https://api.yourdomain.com/health`)
- `HEALTHCHECK_APP_URL` (example: `https://app.yourdomain.com`)

### First EC2 bootstrap (Ubuntu 22.04+)

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
```

Then clone and prepare stack files:

```bash
cd /opt/cooldesk
git clone https://github.com/GruntFlow-io/cooldesk .
cp .env.example .env
chmod +x scripts/deploy.sh scripts/backup-db.sh
docker compose --env-file .env -f docker-compose.prod.yml config
```

Push to `prod` to trigger `.github/workflows/deploy-prod.yml`.

---

## Further Reading

- [Backend README](backend/README.md) — API endpoints, migrations, env setup
- [Frontend README](frontend/README.md) — Next.js app router, build commands
