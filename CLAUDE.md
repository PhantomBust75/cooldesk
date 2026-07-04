# CoolDesk

Multi-tenant SaaS for AC service businesses. NestJS API (port 3001) + Next.js frontend (port 3000) + PostgreSQL (Neon).

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

---

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- No comments unless the WHY is non-obvious.
- If you write 200 lines and it could be 50, rewrite it.

---

## 3. Surgical Changes

**Touch only what you must.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Remove only imports/variables that YOUR changes made unused.

---

## Commands

```bash
# Repo root — start everything
npm run start:all

# Backend (cd backend/)
npm run start:dev     # ts-node-dev hot reload
npm run build         # tsc → dist/
npm start             # node dist/main.js
npm run migrate       # run pending SQL migrations
npm test              # jest --runInBand (sequential — required)

# Frontend (cd frontend/)
npm run dev           # next dev --webpack  ← NOT turbopack
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run test:run      # vitest run --coverage
```

---

## Architecture

```
cooldesk/
├── backend/
│   ├── src/modules/      # One directory per domain (jobs, dealers, auth…)
│   │   └── security/     # Guards: TenantGuard, RolesGuard, DealerGuard, PlatformAdminGuard
│   ├── src/shared/       # DatabaseService (pg Pool), AppConfigService
│   └── sql/              # Numbered migration files (000_… → 014_…)
└── frontend/
    ├── src/app/          # App Router — (protected)/*, /login, /review/*
    ├── src/lib/api/      # Typed API clients — one file per domain
    ├── src/types/        # Shared TypeScript types
    └── src/contexts/     # AuthContext — session in localStorage
```

**Backend is a single flat `AppModule`.** There are no sub-modules. All controllers and providers are registered directly in `AppModule`.

---

## Authentication

All user types log in through the same `POST /auth/login` endpoint. The service tries three tables in order: `users` → `platform_admins` → `dealers`.

Each token type has its own JWT secret and guard:

| Who | Secret env var | Guard(s) | Payload shape |
|-----|---------------|----------|---------------|
| Staff (owner / office_staff / technician) | `JWT_USER_SECRET` | `TenantGuard` + `RolesGuard` | `{ sub, organization_id, role }` |
| Dealer | `JWT_DEALER_SECRET` | `DealerGuard` | `{ sub, organization_id, type: 'dealer' }` |
| Platform admin | `JWT_PLATFORM_SECRET` | `PlatformAdminGuard` | `{ sub, type: 'platform_admin' }` |

**Controller pattern for staff routes:**
```ts
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner', 'office_staff')
```

**`TenantGuard`** validates `JWT_USER_SECRET` AND checks the org is active in the DB. It sets `req.context`. **`DealerGuard`** sets `req.dealerContext` instead — never mix these up.

---

## Database / Migrations

- Provider: Neon PostgreSQL (pooled connection via `DATABASE_URL`)
- Migrations: `backend/sql/NNN_description.sql` — run in numeric order
- To run: `cd backend && npm run migrate`
- To add a migration: create `backend/sql/NNN_description.sql`, register in `backend/migrations/index.ts`
- **Never edit an existing migration file.** Always add a new one.

---

## Frontend Proxy

`/api/*` → `http://localhost:3001/*` via Next.js rewrites in `next.config.ts`.
`NEXT_PUBLIC_API_BASE_URL` defaults to `/api`. All `apiClient` calls use this prefix — never hardcode `localhost:3001` in frontend code.

---

## Key Gotchas

- **Next.js breaking changes**: APIs and conventions differ from training data. Read `node_modules/next/dist/docs/` before touching Next.js internals.
- **Always `--webpack`**: Frontend dev server uses `next dev --webpack`, not turbopack.
- **Backend env loading**: `.env.local` is loaded before `.env`. Keep secrets in `.env.local` (gitignored).
- **`jest --runInBand` is mandatory**: Backend tests share DB state and must run sequentially.
- **Dealer vs staff context**: Dealer routes use `req.dealerContext` (set by `DealerGuard`). Staff routes use `req.context` (set by `TenantGuard`). Mixing them causes silent `undefined` bugs.
- **Login fallthrough order matters**: `auth.service.ts` checks `users` → `platform_admins` → `dealers`. Don't reorder or short-circuit.
- **Toast notifications**: Use `useSnackbar()` from notistack. Never use `alert()` or `window.confirm()` in UI code.
- **Session key**: Auth context stores session under `"cooldesk.session"` in `localStorage`.

---

## Role Access Matrix

| Role | Can access |
|------|-----------|
| `owner` | Everything in staff dashboard |
| `office_staff` | Jobs, technicians, dealers (read), notifications |
| `technician` | Own jobs only (technician routes) |
| `dealer` | Dealer portal routes (`/dealer/*`) only — blocked from staff dashboard |
| `platform_admin` | Platform admin panel only |

---

## Code Conventions

- **DTOs**: All backend inputs validated via `class-validator` decorators on DTO classes. Never trust raw `req.body`.
- **API types**: Keep in `frontend/src/types/`. One file per domain. Import from there — don't inline types in components.
- **API clients**: One file per domain in `frontend/src/lib/api/`. Don't call `fetch`/`apiClient` directly from components.
- **No `any`**: No TypeScript `any` casts. Use proper types or `unknown` with narrowing.
