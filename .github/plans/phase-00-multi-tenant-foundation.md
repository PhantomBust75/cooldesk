# Phase 00 — Multi-Tenant Foundation

## Objective

Establish hard tenant boundaries, platform-vs-tenant auth separation, and base org lifecycle.
All future modules depend on this phase.

## Scope

- `organizations` and `platform_admins` tables
- Tenant-scoped auth (`users`, `dealers`) and separate platform auth
- `TenantGuard`, `RolesGuard`, `PlatformAdminGuard`
- Platform organization management endpoints
- Per-organization `system_config` seeding and lookup via `ConfigService`

## Implementation Backlog

### 1) Database Foundation

Create `organizations` table:

```sql
CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Create `platform_admins` table (separate from `users`):

```sql
CREATE TABLE platform_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Add `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT` as the
first non-PK column to every tenant-scoped table before any other columns are added.
Tables in scope: `users`, `dealers`, `dealer_credentials`, `brands`, `jobs`, `job_units`,
`job_assignments`, `revisits`, `revisit_assignments`, `job_cancellation_requests`, `payments`,
`payment_methods`, `virtual_customers`, `customer_phones`, `job_timeline`, `notifications`,
`scheduling_conflicts`, `analytics_technician_daily`, `analytics_business_daily`,
`analytics_brand_daily`, `analytics_dealer_daily`, `analytics_processed_events`,
`customer_reviews`.

Convert `system_config` to composite PK `(organization_id, key)`. The `updated_by` FK uses
`ON DELETE SET NULL` (not RESTRICT) so owner account replacement never blocks a migration.
A `NULL` `updated_by` means "original seed / user no longer exists"; `updated_at` preserves
the audit trail.

```sql
CREATE TABLE system_config (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  key             TEXT NOT NULL,
  value           TEXT NOT NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, key)
);
```

Update all composite indexes to lead with `organization_id`.

Update notification dedup indexes:
- `UNIQUE (organization_id, event_type, job_id, recipient_user_id) WHERE recipient_user_id IS NOT NULL AND job_id IS NOT NULL`
- Plus three more partial variants (see Phase 07 for full split).

### 2) Seed and Bootstrap

Update `seed_system_config` to accept `p_org_id UUID`. All 7 default keys:

| Key | Default |
|-----|---------|
| `repeat_complaint_window_days` | `30` |
| `frequent_complaint_threshold` | `3` |
| `frequent_complaint_window_days` | `90` |
| `punctuality_grace_period_mins` | `15` |
| `customer_review_mode` | `off` |
| `undo_window_seconds` | `60` |
| `standard_job_duration_mins` | `120` |

Use `ON CONFLICT (organization_id, key) DO NOTHING` so the function is safe to re-run.

Create org bootstrap transaction (single atomic unit):
1. `INSERT INTO organizations`
2. `SELECT seed_system_config(org_id)`
3. `INSERT INTO users` (role = `owner`) with the new org id

Roll back entirely on any failure.

### 3) Auth and Guard Separation

- **User JWT payload:** `{ sub, organization_id, role }`
- **Dealer JWT payload:** `{ sub, organization_id, type: 'dealer' }`
- **Platform JWT payload:** `{ sub, type: 'platform_admin' }` — **separate signing secret**

Implement `TenantGuard`:
- Extracts `organization_id` from verified JWT
- Confirms org is active and not deleted in DB
- Attaches `{ organizationId, userId, role }` to `RequestContext`
- Rejects any request where org is missing or inactive

Implement `RolesGuard`:
- Reads `role` from `RequestContext` (not from token directly after `TenantGuard` runs)
- Compares against `@Roles(...)` decorator

Implement `PlatformAdminGuard`:
- Separate guard for platform-only endpoints
- Rejects all user/dealer tokens regardless of role

### 4) Controller Guard Policy

- Tenant routes: `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`
- Platform routes: `@UseGuards(PlatformAdminGuard)`
- **Never apply both guards to the same controller.**

### 5) Platform Endpoints

- `POST /platform/organizations` — create org + seed config + first owner (one transaction)
- `PATCH /platform/organizations/:id` — activate / deactivate
- `GET /platform/organizations` — list all orgs with high-level counts (jobs, users, status)

### 6) Config Access Pattern

- Build `ConfigService.get(organizationId, key)` with org-scoped caching rules.
- Application code reading `system_config` must handle `NULL updated_by` gracefully.
- Cast integer values at service layer: `parseInt(value, 10)` with COALESCE fallback.
- Replace all direct `system_config` reads in business logic with `ConfigService`.

## Required Test Coverage

- Token matrix:
  - Org A token rejected on org B endpoints
  - Dealer token rejected on user-role routes and vice versa
  - Platform token rejected on all tenant routes
- `TenantGuard` rejects inactive and soft-deleted orgs.
- Org bootstrap transaction rolls back fully on failure at any step.
- Schema: no nullable `organization_id` in any tenant-scoped table.
- `ConfigService.get` returns correct value per org; does not bleed across orgs.

## Exit Criteria

- Cross-tenant API access blocked on all tested routes.
- Every tenant query includes `organization_id`.
- Org creation always produces seeded config and first owner atomically.
- Platform endpoints are inaccessible to all tenant identities.

## Risks and Mitigations

- **Risk:** Legacy queries missing tenant filter.
  - **Mitigation:** grep for tenant tables; enforce repository helpers that always include org scope.
- **Risk:** Mixed secrets/guards allow auth confusion.
  - **Mitigation:** separate NestJS modules and env vars per identity type; CI test asserts no mixed guards on same controller.
- **Risk:** Partial org bootstrap leaves orphan data.
  - **Mitigation:** single transaction + integration test with forced mid-transaction failure.
- **Risk:** `system_config.updated_by` nullable after v2.2 change.
  - **Mitigation:** application code uses `updated_by ?? 'system'` for display; never asserts NOT NULL.
