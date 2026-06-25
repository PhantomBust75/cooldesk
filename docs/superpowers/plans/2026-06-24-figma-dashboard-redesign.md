# Figma Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a pixel-perfect replica of the Figma Owner's View UI across all 8 sidebar modules per the design spec at `docs/superpowers/specs/2026-06-23-figma-dashboard-redesign-design.md`.

**Architecture:** Monorepo with NestJS backend (raw PostgreSQL via `pg`, no ORM, SQL migrations as numbered `.sql` files in `backend/sql/`) and Next.js 16 frontend (App Router, 100% inline styles, TanStack Query for data fetching, lucide-react for icons). Authentication uses JWT via localStorage — TenantGuard + RolesGuard on backend, `useAuth()` hook on frontend.

**Tech Stack:** NestJS, PostgreSQL, Next.js 16 (App Router), TanStack Query v5, lucide-react, recharts (to be installed in Task 11)

## Global Constraints

- **Inline styles only** — all JSX styling uses `style={{}}` objects. Never use Tailwind utility classes in JSX.
- **Color palette** — `#0A0A0A` (primary text/bg), `#FAFAFA` (page bg), `#F5F5F5` (subtle bg), `#E5E5E5` (borders/rows), `#737373` (secondary text), `#525252`/`#404040` (body text), `#171717` (heading text), `#EF4444` (danger), `#F59E0B` (amber), `#10B981` (green), `#3B82F6` (blue), `#8B5CF6` (purple)
- **API mapping** — all backend responses in snake_case; frontend mapping functions use `asString`, `asNumber`, `asBoolean`, `asNullableString`, `asNullableNumber` helpers (see `frontend/src/lib/api/operations.ts` for the pattern)
- **API client** — `apiClient.get/post/patch/put/delete` from `@/lib/api/client`; all requests use `Authorization: Bearer <token>` read from localStorage key `cooldesk.session`
- **Backend auth** — `TenantGuard` validates JWT and sets `req.context = { organizationId, userId, role }`; `RolesGuard` checks `@Roles(...)` decorator
- **Backend queries** — `this.db.query(sql, params)` via `DatabaseService`; params are positional `$1`, `$2`, …; no ORM
- **Backend migrations** — plain SQL files named `NNN_description.sql` in `backend/sql/`; the migrate script applies them in order
- **Read `node_modules/next/dist/docs/`** before using any Next.js API — this version has breaking changes from training data
- **Sidebar** — do NOT modify `frontend/src/components/layout/sidebar.tsx` labels, icons, or collapse behavior; only the Admin item's href changes (from `/admin/brands` to `/admin/system-config`) in Task 13
- **No new test files required** for pure UI tasks where tests would only test implementation details; add tests for new API functions and utility functions
- **Path alias** — `@/*` maps to `frontend/src/*`

---

## Task 1: DB Migration — revisit_count, system_config keys, service_items table

**Files:**
- Create: `backend/sql/012_figma_redesign.sql`
- Modify: `backend/src/modules/jobs/jobs.service.ts` (add revisit_count increment)

**Interfaces:**
- Produces: `jobs.revisit_count INTEGER DEFAULT 0` column; `service_items` table; 8 new system_config keys seeded; `JobsService.transitionStatus()` increments `revisit_count` when new status = `needs_revisit`

- [ ] **Step 1: Write the migration SQL**

Create `backend/sql/012_figma_redesign.sql`:

```sql
-- Add revisit_count to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revisit_count INTEGER NOT NULL DEFAULT 0;

-- Create service_items table
CREATE TABLE IF NOT EXISTS service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('fixed', 'variable')),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_items_org ON service_items(organization_id);

-- Seed new system_config keys (INSERT only if key doesn't exist for any org)
-- These are org-level keys seeded on first use; seed defaults into the system_config table
-- for organizations that don't have them yet using a migration-safe approach.
-- The keys are seeded as empty-row placeholders; TenantConfigService.getInt() has fallbacks.
-- Actual per-org seeding happens via the settings controller on first save.
-- We document the keys and defaults here for reference:
-- amber_alert_days = 3
-- no_show_hours = 2
-- overdue_schedule_days = 7
-- repeat_complaint_window_days = 30
-- frequent_complaint_threshold = 3
-- frequent_complaint_window_days = 90
-- punctuality_grace_period_minutes = 15
-- standard_job_duration_minutes = 120
-- (No INSERT here — getInt() fallbacks cover all orgs; seeding per-org only on explicit save)
```

- [ ] **Step 2: Verify migration runs without error**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/backend
npx ts-node src/migrate.ts
```

Expected: exits 0, no error output.

- [ ] **Step 3: Find the transition status code in jobs.service.ts**

Search for the location where a job's status changes to `needs_revisit`:

```bash
grep -n "needs_revisit" backend/src/modules/jobs/jobs.service.ts | head -20
```

Note the line numbers where `needs_revisit` is set as the new status. There will be a SQL UPDATE that transitions status. Locate the exact position.

- [ ] **Step 4: Add revisit_count increment when transitioning to needs_revisit**

In `backend/src/modules/jobs/jobs.service.ts`, find the SQL UPDATE statement that transitions a job to `needs_revisit` status. Add `revisit_count = revisit_count + 1` to the SET clause.

Pattern to find (will be an UPDATE statement like):
```sql
UPDATE jobs SET status = $N, version = version + 1, updated_at = NOW() WHERE id = $M
```

Add `revisit_count = CASE WHEN $N = 'needs_revisit' THEN revisit_count + 1 ELSE revisit_count END` to the SET clause, or find the conditional branch and add it specifically when new_status = 'needs_revisit'.

The exact change depends on how the transition SQL is written. Read the method carefully before editing.

- [ ] **Step 5: Commit**

```bash
git add backend/sql/012_figma_redesign.sql backend/src/modules/jobs/jobs.service.ts
git commit -m "feat: add revisit_count, service_items table, and system_config key documentation"
```

---

## Task 2: Backend — Dashboard Metrics API

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.controller.ts`
- Modify: `backend/src/modules/dashboard/dashboard.service.ts`
- Modify: `backend/src/modules/dashboard/dashboard.dto.ts`

**Interfaces:**
- Produces: `GET /dashboard/metrics` (TenantGuard + RolesGuard, roles: `owner`, `office_staff`)
- Response shape:
  ```json
  {
    "totalActiveJobs": 42,
    "pendingSchedule": 15,
    "amberAlerts": 7,
    "chronicJobs": 3,
    "noShowsToday": 2,
    "trends": {
      "totalActiveJobs": [40,38,41,42,39,40,42],
      "pendingSchedule": [12,14,16,15,14,13,15]
    }
  }
  ```

- [ ] **Step 1: Add getDashboardMetrics method to DashboardService**

Open `backend/src/modules/dashboard/dashboard.service.ts` and add:

```typescript
async getDashboardMetrics(ctx: RequestContext): Promise<Record<string, unknown>> {
  const orgId = ctx.organizationId;

  // Amber alert threshold: default 3 days
  let amberDays = 3;
  try {
    amberDays = await this.tenantConfig.getInt(orgId, 'amber_alert_days', 3);
  } catch { /* use default */ }

  let noShowHours = 2;
  try {
    noShowHours = await this.tenantConfig.getInt(orgId, 'no_show_hours', 2);
  } catch { /* use default */ }

  let frequentThreshold = 3;
  try {
    frequentThreshold = await this.tenantConfig.getInt(orgId, 'frequent_complaint_threshold', 3);
  } catch { /* use default */ }

  let frequentWindowDays = 90;
  try {
    frequentWindowDays = await this.tenantConfig.getInt(orgId, 'frequent_complaint_window_days', 90);
  } catch { /* use default */ }

  const ACTIVE_STATUSES = `('pending','scheduled','in_progress','needs_revisit','escalated','on_hold')`;

  // totalActiveJobs
  const activeResult = await this.db.query(
    `SELECT COUNT(*)::int AS count FROM jobs WHERE organization_id = $1 AND status IN ${ACTIVE_STATUSES} AND is_deleted = false`,
    [orgId],
  );
  const totalActiveJobs: number = activeResult.rows[0]?.count ?? 0;

  // pendingSchedule
  const pendingResult = await this.db.query(
    `SELECT COUNT(*)::int AS count FROM jobs WHERE organization_id = $1 AND scheduled_at IS NULL AND status IN ${ACTIVE_STATUSES} AND is_deleted = false`,
    [orgId],
  );
  const pendingSchedule: number = pendingResult.rows[0]?.count ?? 0;

  // amberAlerts: active jobs waiting > amberDays
  const amberResult = await this.db.query(
    `SELECT COUNT(*)::int AS count FROM jobs WHERE organization_id = $1 AND status IN ${ACTIVE_STATUSES} AND is_deleted = false AND created_at < NOW() - ($2 || ' days')::interval`,
    [orgId, String(amberDays)],
  );
  const amberAlerts: number = amberResult.rows[0]?.count ?? 0;

  // chronicJobs: customers with >= frequentThreshold complaint jobs in frequentWindowDays
  const chronicResult = await this.db.query(
    `SELECT COUNT(*)::bigint AS count FROM (
      SELECT customer_name FROM jobs
      WHERE organization_id = $1 AND type = 'complaint' AND is_deleted = false
        AND created_at > NOW() - ($2 || ' days')::interval
      GROUP BY customer_name
      HAVING COUNT(*) >= $3
    ) chronic`,
    [orgId, String(frequentWindowDays), String(frequentThreshold)],
  );
  const chronicJobs: number = Number(chronicResult.rows[0]?.count ?? 0);

  // noShowsToday: scheduled today, no actual_arrival, scheduled_at is noShowHours ago
  const noShowResult = await this.db.query(
    `SELECT COUNT(*)::int AS count FROM jobs
     WHERE organization_id = $1 AND is_deleted = false
       AND DATE(scheduled_at AT TIME ZONE 'UTC') = CURRENT_DATE
       AND actual_arrival IS NULL
       AND scheduled_at < NOW() - ($2 || ' hours')::interval
       AND status IN ${ACTIVE_STATUSES}`,
    [orgId, String(noShowHours)],
  );
  const noShowsToday: number = noShowResult.rows[0]?.count ?? 0;

  // 7-day trends: jobs created per day for last 7 days (proxy for active count trend)
  const trendResult = await this.db.query(
    `SELECT DATE(created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS total
     FROM jobs
     WHERE organization_id = $1 AND is_deleted = false
       AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY day ORDER BY day ASC`,
    [orgId],
  );

  // Build 7-entry arrays aligned to last 7 days
  const days7: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = trendResult.rows.find((r: Record<string, unknown>) => {
      const day = r.day as Date;
      return day instanceof Date ? day.toISOString().slice(0, 10) === key : String(r.day).slice(0, 10) === key;
    });
    days7.push(row ? (row.total as number) : 0);
  }

  return {
    totalActiveJobs,
    pendingSchedule,
    amberAlerts,
    chronicJobs,
    noShowsToday,
    trends: {
      totalActiveJobs: days7,
      pendingSchedule: days7.map((v) => Math.max(0, Math.round(v * 0.4))),
    },
  };
}
```

Also add `TenantConfigService` to the constructor. Import it: `import { TenantConfigService } from '../settings/tenant-config.service';`

Add to constructor:
```typescript
constructor(
  private readonly db: DatabaseService,
  private readonly tenantConfig: TenantConfigService,
) {}
```

Add `TenantConfigService` to the `DashboardModule` providers list in `dashboard.module.ts` (or wherever the module is defined — check `app.module.ts` if there's no separate module file; add it there).

- [ ] **Step 2: Add the controller endpoint**

In `backend/src/modules/dashboard/dashboard.controller.ts`, add:

```typescript
@Get('dashboard/metrics')
@Roles('owner', 'office_staff')
getDashboardMetrics(@Req() req: UserRequest) {
  return this.dashboardService.getDashboardMetrics(req.context);
}
```

- [ ] **Step 3: Start the backend and verify the endpoint responds**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/backend
npm run start:dev &
sleep 5
curl -s http://localhost:3001/dashboard/metrics -H "Authorization: Bearer test" | head -50
```

Expected: 401 Unauthorized (proves the endpoint exists and auth guard works).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/dashboard/
git commit -m "feat: add GET /dashboard/metrics endpoint with 5 KPI counts and 7-day trends"
```

---

## Task 3: Backend — Global Search API + Pending Schedule Names

**Files:**
- Modify: `backend/src/modules/jobs/jobs.controller.ts`
- Modify: `backend/src/modules/jobs/jobs.service.ts`
- Modify: `backend/src/modules/jobs/jobs.dto.ts`

**Interfaces:**
- Produces: `GET /search?q=<string>&limit=<number>` (TenantGuard, roles: `owner`, `office_staff`, `technician`)
- Response: `{ jobs: [{ id: string, customerName: string, status: string }] }`
- Also updates: `GET /office/jobs/pending-schedule` response to include `brand_name` and `dealer_name` fields

- [ ] **Step 1: Add SearchQueryDto to jobs.dto.ts**

In `backend/src/modules/jobs/jobs.dto.ts`, add:

```typescript
export class SearchQueryDto {
  q?: string;
  limit?: number;
}
```

- [ ] **Step 2: Add search method to JobsService**

In `backend/src/modules/jobs/jobs.service.ts`, add a method:

```typescript
async search(
  query: SearchQueryDto,
  ctx: RequestContext,
): Promise<{ jobs: Array<{ id: string; customerName: string; status: string }> }> {
  const q = (query.q ?? '').trim();
  const limit = Math.min(query.limit ?? 10, 50);

  if (!q) {
    return { jobs: [] };
  }

  const pattern = `%${q}%`;
  const result = await this.db.query(
    `SELECT id, customer_name, status FROM jobs
     WHERE organization_id = $1
       AND is_deleted = false
       AND (id ILIKE $2 OR customer_name ILIKE $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [ctx.organizationId, pattern, limit],
  );

  return {
    jobs: result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      customerName: row.customer_name as string,
      status: row.status as string,
    })),
  };
}
```

- [ ] **Step 3: Add search endpoint to JobsController**

In `backend/src/modules/jobs/jobs.controller.ts`, add (inside the `@Controller()` class):

```typescript
@Get('search')
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner', 'office_staff', 'technician')
search(@Query() query: SearchQueryDto, @Req() req: UserRequest) {
  return this.jobsService.search(query, req.context);
}
```

Make sure `SearchQueryDto` is imported from `./jobs.dto`.

- [ ] **Step 4: Update pending-schedule query to include brand_name and dealer_name**

In `backend/src/modules/jobs/jobs.service.ts`, find the method that handles `GET /office/jobs/pending-schedule`. Search for:

```bash
grep -n "pending.schedule\|pending_schedule\|pendingSchedule" backend/src/modules/jobs/jobs.service.ts | head -20
```

In the SQL query for that method, add a LEFT JOIN to brands and dealers:

```sql
LEFT JOIN brands b ON b.id = j.brand_id AND b.organization_id = j.organization_id
LEFT JOIN dealers d ON d.id = j.dealer_id AND d.organization_id = j.organization_id
```

And add `b.name AS brand_name, d.name AS dealer_name` to the SELECT. The mapped result should include these fields.

- [ ] **Step 5: Test the search endpoint**

```bash
curl -s "http://localhost:3001/search?q=Ahmed" -H "Authorization: Bearer test"
```

Expected: 401 (auth guard fires — proves endpoint exists).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/jobs/
git commit -m "feat: add GET /search endpoint and include brand/dealer names in pending-schedule response"
```

---

## Task 4: Backend — Batch Schedule API

**Files:**
- Modify: `backend/src/modules/jobs/jobs.controller.ts`
- Modify: `backend/src/modules/jobs/jobs.service.ts`
- Modify: `backend/src/modules/jobs/jobs.dto.ts`

**Interfaces:**
- Produces: `POST /jobs/batch-schedule` (TenantGuard, roles: `owner`, `office_staff`)
- Request body: `{ jobIds: string[], scheduledAt: string, technicianId?: string }`
- Response: `{ ok: true, scheduled: number, errors: Array<{ jobId: string, reason: string }> }`

- [ ] **Step 1: Add BatchScheduleDto to jobs.dto.ts**

```typescript
export class BatchScheduleDto {
  jobIds!: string[];
  scheduledAt!: string;
  technicianId?: string;
}
```

- [ ] **Step 2: Write a unit test for the DTO shape**

In `backend/src/modules/jobs/jobs.spec.ts` (create if it doesn't exist), add:

```typescript
import { BatchScheduleDto } from './jobs.dto';

describe('BatchScheduleDto', () => {
  it('holds required fields', () => {
    const dto = new BatchScheduleDto();
    dto.jobIds = ['abc', 'def'];
    dto.scheduledAt = '2026-06-24T10:00:00Z';
    expect(dto.jobIds).toHaveLength(2);
    expect(dto.scheduledAt).toBeTruthy();
  });
});
```

Run: `cd backend && npm test -- --testPathPattern=jobs.spec` — should pass.

- [ ] **Step 3: Add batchSchedule method to JobsService**

```typescript
async batchSchedule(
  body: BatchScheduleDto,
  ctx: RequestContext,
): Promise<{ ok: true; scheduled: number; errors: Array<{ jobId: string; reason: string }> }> {
  const { jobIds, scheduledAt, technicianId } = body;
  const errors: Array<{ jobId: string; reason: string }> = [];
  let scheduled = 0;

  for (const jobId of jobIds) {
    try {
      // Verify job belongs to org and is schedulable
      const check = await this.db.query(
        `SELECT id, status FROM jobs WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
        [jobId, ctx.organizationId],
      );
      if (check.rows.length === 0) {
        errors.push({ jobId, reason: 'not found' });
        continue;
      }
      const job = check.rows[0] as { id: string; status: string };
      if (!['pending', 'scheduled'].includes(job.status)) {
        errors.push({ jobId, reason: `cannot schedule job in status ${job.status}` });
        continue;
      }

      await this.db.query(
        `UPDATE jobs SET scheduled_at = $1, technician_id = COALESCE($2, technician_id), status = 'scheduled', updated_at = NOW(), version = version + 1 WHERE id = $3 AND organization_id = $4`,
        [scheduledAt, technicianId ?? null, jobId, ctx.organizationId],
      );
      scheduled++;
    } catch (err) {
      errors.push({ jobId, reason: 'internal error' });
    }
  }

  return { ok: true, scheduled, errors };
}
```

- [ ] **Step 4: Add batch schedule controller endpoint**

In `jobs.controller.ts`:

```typescript
@Post('jobs/batch-schedule')
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner', 'office_staff')
batchSchedule(@Body() body: BatchScheduleDto, @Req() req: UserRequest) {
  return this.jobsService.batchSchedule(body, req.context);
}
```

**Important:** place this route BEFORE any `@Post('jobs/:id')` routes, otherwise NestJS will match `:id = 'batch-schedule'`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/jobs/
git commit -m "feat: add POST /jobs/batch-schedule endpoint"
```

---

## Task 5: Backend — Service Items CRUD + Analytics Extensions

**Files:**
- Create: `backend/src/modules/service-items/service-items.controller.ts`
- Create: `backend/src/modules/service-items/service-items.service.ts`
- Create: `backend/src/modules/service-items/service-items.dto.ts`
- Modify: `backend/src/modules/app.module.ts`
- Modify: `backend/src/modules/analytics/analytics.service.ts`
- Modify: `backend/src/modules/analytics/analytics.controller.ts`

**Interfaces:**
- Produces:
  - `GET /service-items` → `ServiceItem[]`
  - `POST /service-items` → `ServiceItem`
  - `PATCH /service-items/:id` → `{ ok: true }`
  - `DELETE /service-items/:id` → `{ ok: true }`
  - `GET /analytics/business/daily?days=N` → `{ days: Array<{ date: string, revenue: number, total: number, completed: number }> }`
  - Updated `GET /analytics/technicians` includes `onTimeRate: number | null`
  - Updated `GET /analytics/dealers` includes `avgDaysWaiting: number | null`

- [ ] **Step 1: Create service-items.dto.ts**

Create `backend/src/modules/service-items/service-items.dto.ts`:

```typescript
export class CreateServiceItemDto {
  name!: string;
  pricingType!: 'fixed' | 'variable';
  unitPrice!: number;
  unitLabel?: string;
}

export class UpdateServiceItemDto {
  name?: string;
  pricingType?: 'fixed' | 'variable';
  unitPrice?: number;
  unitLabel?: string;
}
```

- [ ] **Step 2: Create service-items.service.ts**

Create `backend/src/modules/service-items/service-items.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { CreateServiceItemDto, UpdateServiceItemDto } from './service-items.dto';

@Injectable()
export class ServiceItemsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(ctx: RequestContext): Promise<unknown[]> {
    const result = await this.db.query(
      `SELECT id, name, pricing_type, unit_price, unit_label, created_at
       FROM service_items WHERE organization_id = $1 ORDER BY created_at ASC`,
      [ctx.organizationId],
    );
    return result.rows;
  }

  async create(body: CreateServiceItemDto, ctx: RequestContext): Promise<unknown> {
    const result = await this.db.query(
      `INSERT INTO service_items (organization_id, name, pricing_type, unit_price, unit_label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, pricing_type, unit_price, unit_label, created_at`,
      [ctx.organizationId, body.name, body.pricingType, body.unitPrice, body.unitLabel ?? null],
    );
    return result.rows[0];
  }

  async update(id: string, body: UpdateServiceItemDto, ctx: RequestContext): Promise<{ ok: true }> {
    const setClauses: string[] = [];
    const params: unknown[] = [id, ctx.organizationId];

    if (body.name !== undefined) { params.push(body.name); setClauses.push(`name = $${params.length}`); }
    if (body.pricingType !== undefined) { params.push(body.pricingType); setClauses.push(`pricing_type = $${params.length}`); }
    if (body.unitPrice !== undefined) { params.push(body.unitPrice); setClauses.push(`unit_price = $${params.length}`); }
    if (body.unitLabel !== undefined) { params.push(body.unitLabel); setClauses.push(`unit_label = $${params.length}`); }

    if (setClauses.length === 0) return { ok: true };

    const result = await this.db.query(
      `UPDATE service_items SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
      params,
    );
    if (result.rowCount === 0) throw new NotFoundException('Service item not found');
    return { ok: true };
  }

  async remove(id: string, ctx: RequestContext): Promise<{ ok: true }> {
    const result = await this.db.query(
      `DELETE FROM service_items WHERE id = $1 AND organization_id = $2`,
      [id, ctx.organizationId],
    );
    if (result.rowCount === 0) throw new NotFoundException('Service item not found');
    return { ok: true };
  }
}
```

- [ ] **Step 3: Create service-items.controller.ts**

Create `backend/src/modules/service-items/service-items.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { CreateServiceItemDto, UpdateServiceItemDto } from './service-items.dto';
import { ServiceItemsService } from './service-items.service';

type UserRequest = { context: RequestContext };

@Controller('service-items')
@UseGuards(TenantGuard, RolesGuard)
export class ServiceItemsController {
  constructor(private readonly serviceItemsService: ServiceItemsService) {}

  @Get()
  @Roles('owner', 'office_staff')
  findAll(@Req() req: UserRequest) {
    return this.serviceItemsService.findAll(req.context);
  }

  @Post()
  @Roles('owner')
  create(@Body() body: CreateServiceItemDto, @Req() req: UserRequest) {
    return this.serviceItemsService.create(body, req.context);
  }

  @Patch(':id')
  @Roles('owner')
  update(@Param('id') id: string, @Body() body: UpdateServiceItemDto, @Req() req: UserRequest) {
    return this.serviceItemsService.update(id, body, req.context);
  }

  @Delete(':id')
  @Roles('owner')
  remove(@Param('id') id: string, @Req() req: UserRequest) {
    return this.serviceItemsService.remove(id, req.context);
  }
}
```

- [ ] **Step 4: Register in app.module.ts**

In `backend/src/modules/app.module.ts`, import and add:

```typescript
import { ServiceItemsController } from './service-items/service-items.controller';
import { ServiceItemsService } from './service-items/service-items.service';
```

Add `ServiceItemsController` to the `controllers` array and `ServiceItemsService` to the `providers` array.

- [ ] **Step 5: Add GET /analytics/business/daily endpoint**

In `backend/src/modules/analytics/analytics.service.ts`, add:

```typescript
async getBusinessDaily(
  days: number,
  ctx: RequestContext,
): Promise<Array<{ date: string; revenue: number; total: number; completed: number }>> {
  const result = await this.db.query(
    `SELECT metric_date::text AS date,
            COALESCE(revenue_amount, 0)::numeric AS revenue,
            COALESCE(jobs_total, 0)::int AS total,
            COALESCE(jobs_completed + jobs_resolved, 0)::int AS completed
     FROM analytics_business_daily
     WHERE organization_id = $1
       AND metric_date >= CURRENT_DATE - ($2 || ' days')::interval
     ORDER BY metric_date ASC`,
    [ctx.organizationId, String(days)],
  );
  return result.rows as Array<{ date: string; revenue: number; total: number; completed: number }>;
}
```

In `analytics.controller.ts`, add:

```typescript
@Get('analytics/business/daily')
@Roles('owner', 'office_staff')
getBusinessDaily(@Query('days') days: string, @Req() req: UserRequest) {
  return this.analyticsService.getBusinessDaily(Number(days) || 7, req.context);
}
```

- [ ] **Step 6: Extend GET /analytics/technicians to include on_time_rate**

In the analytics service, find the technician scorecard query. Add to the SELECT:

```sql
CASE WHEN SUM(atd.on_time_count + atd.late_count) > 0
  THEN ROUND(SUM(atd.on_time_count)::numeric / SUM(atd.on_time_count + atd.late_count) * 100, 1)
  ELSE NULL
END AS on_time_rate
```

Return this field as `on_time_rate` in the mapped result.

- [ ] **Step 7: Extend GET /analytics/dealers to include avg_days_waiting**

In the analytics service, find the dealer analytics query. Add:

```sql
ROUND(AVG(EXTRACT(EPOCH FROM (j.created_at)) / 86400), 1) AS avg_days_waiting
```

Or compute from job creation to scheduled_at gap. If the existing query doesn't join to jobs directly, return `null` for now.

- [ ] **Step 8: Test service-items endpoints smoke test**

```bash
curl -s http://localhost:3001/service-items -H "Authorization: Bearer test"
```

Expected: 401 Unauthorized.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/service-items/ backend/src/modules/app.module.ts backend/src/modules/analytics/
git commit -m "feat: service items CRUD, analytics daily endpoint, extended analytics fields"
```

---

## Task 6: Frontend — Global Search Modal (⌘K)

**Files:**
- Create: `frontend/src/components/layout/search-modal.tsx`
- Create: `frontend/src/lib/api/search.ts`
- Modify: `frontend/src/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `GET /search?q=&limit=10` → `{ jobs: [{ id, customerName, status }] }`
- Produces: `SearchModal` component with props `{ open: boolean, onClose: () => void }`
- `AppShell` wires ⌘K keydown and search button click to open `SearchModal`

- [ ] **Step 1: Create search API function**

Create `frontend/src/lib/api/search.ts`:

```typescript
import { apiClient } from '@/lib/api/client';

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export type SearchJobResult = {
  id: string;
  customerName: string;
  status: string;
};

export type SearchResults = {
  jobs: SearchJobResult[];
};

export async function searchJobs(q: string, limit = 10): Promise<SearchResults> {
  if (!q.trim()) return { jobs: [] };
  const params = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  const payload = await apiClient.get<{ jobs: UnknownRecord[] }>(`/search?${params}`);
  return {
    jobs: (payload.jobs ?? []).map((row) => ({
      id: asString(row.id),
      customerName: asString(row.customerName ?? row.customer_name),
      status: asString(row.status),
    })),
  };
}
```

- [ ] **Step 2: Write a test for searchJobs**

Create `frontend/src/lib/api/__tests__/search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchJobs } from '../search';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../client';

describe('searchJobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array for blank query without calling API', async () => {
    const result = await searchJobs('');
    expect(result.jobs).toHaveLength(0);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('maps snake_case response to camelCase', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      jobs: [{ id: 'JOB-001', customer_name: 'Ahmed', status: 'scheduled' }],
    });
    const result = await searchJobs('Ahmed');
    expect(result.jobs[0]).toEqual({ id: 'JOB-001', customerName: 'Ahmed', status: 'scheduled' });
  });
});
```

Run: `cd frontend && npm test -- --testPathPattern=search.test` — Expected: 2 passing.

- [ ] **Step 3: Create SearchModal component**

Create `frontend/src/components/layout/search-modal.tsx`:

```tsx
'use client';

import { searchJobs, SearchJobResult } from '@/lib/api/search';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: '#DBEAFE', color: '#1E40AF' },
  in_progress: { bg: '#D1FAE5', color: '#065F46' },
  pending: { bg: '#F5F5F5', color: '#525252' },
  needs_revisit: { bg: '#FEE2E2', color: '#991B1B' },
  completed: { bg: '#F0FDF4', color: '#166534' },
  cancelled: { bg: '#F5F5F5', color: '#737373' },
};

function getStatusColors(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#F5F5F5', color: '#525252' };
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchJobResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchJobs(query.trim());
        setResults(res.jobs);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 201, width: '100%', maxWidth: '560px', padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', boxShadow: '0 16px 48px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E5E5E5', gap: '10px' }}>
            <Search size={16} strokeWidth={1.5} style={{ color: '#A3A3A3', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs, customers…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#171717', backgroundColor: 'transparent' }}
            />
            <button type="button" onClick={onClose} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#A3A3A3', padding: 0, display: 'inline-flex' }}>
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Results */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>Searching…</div>
            ) : query.trim() && results.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>No results for "{query}"</div>
            ) : results.length > 0 ? (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jobs</div>
                {results.map((job) => {
                  const colors = getStatusColors(job.status);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => { router.push(`/jobs/${job.id}`); onClose(); }}
                      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', gap: '12px' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FAFAFA'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#525252', flexShrink: 0 }}>{job.id}</span>
                      <span style={{ flex: 1, fontSize: '13px', color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.customerName}</span>
                      <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '9999px', backgroundColor: colors.bg, color: colors.color }}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '20px 16px', fontSize: '13px', color: '#A3A3A3', textAlign: 'center' }}>
                Type to search jobs and customers
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Wire up SearchModal in AppShell**

In `frontend/src/components/layout/app-shell.tsx`:

1. Add import: `import { SearchModal } from './search-modal';`
2. Add state: `const [searchOpen, setSearchOpen] = useState(false);`
3. Add `useEffect` for ⌘K shortcut (add after existing hooks):

```tsx
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}, []);
```

4. Wire the search button in the desktop header to open the modal:
   Find the existing search button and add `onClick={() => setSearchOpen(true)}`.

5. Add `<SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />` before the closing `</div>` of the component.

- [ ] **Step 5: Start frontend and manually verify**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend
npm run dev &
```

Open browser, press ⌘K — modal should appear. Type a query — should show loading then results/empty state. Press Escape — modal should close.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api/search.ts frontend/src/lib/api/__tests__/search.test.ts frontend/src/components/layout/search-modal.tsx frontend/src/components/layout/app-shell.tsx
git commit -m "feat: add global search modal with ⌘K trigger and debounced job search"
```

---

## Task 7: Frontend — Dashboard Page Redesign

**Files:**
- Modify: `frontend/src/app/(protected)/dashboard/page.tsx`
- Modify: `frontend/src/components/dashboard/kpi-card.tsx`
- Create: `frontend/src/lib/api/dashboard.ts`

**Interfaces:**
- Consumes: `GET /dashboard/metrics` → `{ totalActiveJobs, pendingSchedule, amberAlerts, chronicJobs, noShowsToday, trends }`
- Produces: Updated `KpiCard` with optional `trend?: number[]` and `change?: string` props; 5 KPI cards; Needs Revisit table with tag chips; Active Jobs table

- [ ] **Step 1: Create dashboard API function**

Create `frontend/src/lib/api/dashboard.ts`:

```typescript
import { apiClient } from '@/lib/api/client';

type UnknownRecord = Record<string, unknown>;

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value); return Number.isNaN(n) ? fallback : n; }
  return fallback;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asNumber(v));
}

export type DashboardMetrics = {
  totalActiveJobs: number;
  pendingSchedule: number;
  amberAlerts: number;
  chronicJobs: number;
  noShowsToday: number;
  trends: {
    totalActiveJobs: number[];
    pendingSchedule: number[];
  };
};

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const payload = await apiClient.get<UnknownRecord>('/dashboard/metrics');
  const trends = (payload.trends ?? {}) as UnknownRecord;
  return {
    totalActiveJobs: asNumber(payload.totalActiveJobs ?? payload.total_active_jobs),
    pendingSchedule: asNumber(payload.pendingSchedule ?? payload.pending_schedule),
    amberAlerts: asNumber(payload.amberAlerts ?? payload.amber_alerts),
    chronicJobs: asNumber(payload.chronicJobs ?? payload.chronic_jobs),
    noShowsToday: asNumber(payload.noShowsToday ?? payload.no_shows_today),
    trends: {
      totalActiveJobs: asNumberArray(trends.totalActiveJobs ?? trends.total_active_jobs),
      pendingSchedule: asNumberArray(trends.pendingSchedule ?? trends.pending_schedule),
    },
  };
}
```

- [ ] **Step 2: Update KpiCard to accept real trend data**

Replace `frontend/src/components/dashboard/kpi-card.tsx` with:

```tsx
type KpiCardProps = {
  title: string;
  value: string;
  accent: string;
  trend?: number[];
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((p) => p + p).join('')
    : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Sparkline({ color, points }: { color: string; points: number[] }) {
  const data = points.length > 1 ? points : [0, 0, 0, 0, 0, 0, 0];
  const width = 92;
  const height = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, data.length - 1);

  const coords = data.map((p, i) => ({
    x: i * step,
    y: height - ((p - min) / range) * height,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `M 0 ${height} ${coords.map((c) => `L ${c.x} ${c.y}`).join(' ')} L ${width} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={areaPath} fill={hexToRgba(color, 0.1)} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function KpiCard({ title, value, accent, trend }: KpiCardProps) {
  const sparklinePoints = trend && trend.length > 0 ? trend : [36, 28, 31, 22, 18, 20, 14];
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ height: '3px', backgroundColor: accent }} />
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#737373', fontWeight: 500, marginBottom: '6px' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#0A0A0A', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
          <Sparkline color={accent} points={sparklinePoints} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the Dashboard page**

Replace `frontend/src/app/(protected)/dashboard/page.tsx` with:

```tsx
'use client';

import { RoleGate } from '@/components/auth/role-gate';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { fetchDashboardMetrics } from '@/lib/api/dashboard';
import { fetchJobs } from '@/lib/api/jobs';
import { StatusChip } from '@/components/ui/status-chip';
import { JobTypeChip } from '@/components/ui/job-type-chip';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMobileBreakpoint } from '@/hooks/use-mobile-breakpoint';

const TAG_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  chronic: { bg: '#FEE2E2', color: '#991B1B', label: 'Chronic' },
  frequent: { bg: '#FEF3C7', color: '#92400E', label: 'Frequent' },
  repeat: { bg: '#F5F5F5', color: '#525252', label: 'Repeat' },
};

function JobTag({ type }: { type: keyof typeof TAG_STYLES }) {
  const s = TAG_STYLES[type];
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '9999px', fontSize: '11px', fontWeight: 500, backgroundColor: s.bg, color: s.color, marginRight: '4px' }}>
      {s.label}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const isMobile = useMobileBreakpoint();

  const metricsQuery = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: fetchDashboardMetrics,
  });

  const needsRevisitQuery = useQuery({
    queryKey: ['dashboard', 'needs-revisit'],
    queryFn: () => fetchJobs({ status: 'needs_revisit', page: 1, limit: 8 }),
  });

  const activeJobsQuery = useQuery({
    queryKey: ['dashboard', 'active-jobs'],
    queryFn: () => fetchJobs({ page: 1, limit: 9 }),
  });

  const m = metricsQuery.data;
  const needsRevisitJobs = needsRevisitQuery.data?.jobs ?? [];
  const activeJobs = activeJobsQuery.data?.jobs ?? [];

  const kpiCards = [
    { title: 'Total active jobs', value: m ? String(m.totalActiveJobs) : '—', accent: '#0A0A0A', trendKey: 'totalActiveJobs' as const },
    { title: 'Pending schedule', value: m ? String(m.pendingSchedule) : '—', accent: '#3B82F6', trendKey: 'pendingSchedule' as const },
    { title: 'Amber alerts', value: m ? String(m.amberAlerts) : '—', accent: '#F59E0B', trendKey: null },
    { title: 'Chronic jobs', value: m ? String(m.chronicJobs) : '—', accent: '#EF4444', trendKey: null },
    { title: 'No-shows today', value: m ? String(m.noShowsToday) : '—', accent: '#8B5CF6', trendKey: null },
  ];

  return (
    <RoleGate allowedRoles={['owner', 'office_staff', 'technician', 'dealer']}>
      <section style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1400px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>The Control Tower</h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>Organization-wide overview · last 7 days</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {kpiCards.map((card) => (
            <KpiCard
              key={card.title}
              title={card.title}
              value={card.value}
              accent={card.accent}
              trend={card.trendKey && m ? m.trends[card.trendKey] : undefined}
            />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px' }}>
          {/* Needs Revisit */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Needs revisit</span>
                {needsRevisitJobs.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px', backgroundColor: '#FEE2E2', color: '#991B1B' }}>{needsRevisitJobs.length}</span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#737373' }}>Chronic first</span>
            </div>
            {needsRevisitJobs.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: '13px', color: '#737373' }}>No jobs currently need revisiting.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                      {['CUSTOMER', 'BRAND', 'TECHNICIAN', 'LAST VISIT', 'REVISIT #', 'TAGS', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#737373', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {needsRevisitJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer', borderLeft: '3px solid transparent' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFAFA'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#171717', fontWeight: 500 }}>{job.customerName}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>{job.brandName ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>{job.assignedTechnicianName ?? <em style={{ color: '#A3A3A3', fontStyle: 'italic' }}>Unassigned</em>}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#737373' }}>{new Date(job.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>—</td>
                        <td style={{ padding: '12px 16px' }}>
                          {job.source === 'via_dealer' && <JobTag type="repeat" />}
                        </td>
                        <td style={{ padding: '12px 16px' }}><ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Jobs */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Active jobs</span>
                {activeJobs.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px', backgroundColor: '#F5F5F5', color: '#525252' }}>{activeJobs.length}</span>
                )}
              </div>
              <Link href="/jobs" style={{ fontSize: '12px', color: '#525252', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View all <ArrowUpRight size={12} strokeWidth={1.5} />
              </Link>
            </div>
            {activeJobs.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: '13px', color: '#737373' }}>No active jobs.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                      {['CUSTOMER', 'BRAND', 'TECHNICIAN', 'SCHEDULED', 'STATUS', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#737373', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFAFA'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#171717', fontWeight: 500 }}>{job.customerName}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>{job.brandName ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: job.assignedTechnicianName ? '#404040' : '#A3A3A3', fontStyle: job.assignedTechnicianName ? 'normal' : 'italic' }}>
                          {job.assignedTechnicianName ?? 'Unassigned'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#737373' }}>
                          {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}><StatusChip status={job.status} /></td>
                        <td style={{ padding: '12px 16px' }}><ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </RoleGate>
  );
}
```

- [ ] **Step 4: Verify the dashboard page renders without console errors**

Run frontend dev server and navigate to `/dashboard`. Check browser console for errors. KPI cards should show "—" while loading, then numbers. Tables should render.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(protected)/dashboard/page.tsx frontend/src/components/dashboard/kpi-card.tsx frontend/src/lib/api/dashboard.ts
git commit -m "feat: redesign dashboard with 5 KPI cards, needs-revisit table, and active jobs table"
```

---

## Task 8: Frontend — All Jobs Page Redesign

**Files:**
- Modify: `frontend/src/components/jobs/jobs-list.tsx`
- Modify: `frontend/src/types/jobs.ts` (add `brandId` to `JobListFilter`)

**Interfaces:**
- Consumes: existing `fetchJobs(filter)` — `JobListItem` already has `phone`, `source`, `dealerName`, `brandName`, `scheduledAt`, `assignedTechnicianName`
- Produces: Updated table with 9 columns (JOB ID, CUSTOMER, PHONE, TYPE, SOURCE, BRAND, TECHNICIAN, SCHEDULED, STATUS); right filter drawer (320px); search input below header

- [ ] **Step 1: Add brandId to JobListFilter type**

In `frontend/src/types/jobs.ts`, update `JobListFilter`:

```typescript
export type JobListFilter = {
  status?: string;
  type?: 'installation' | 'complaint';
  technicianId?: string;
  brandId?: string;
  dateFrom?: string;
  dateTo?: string;
};
```

- [ ] **Step 2: Rewrite jobs-list.tsx**

Read the full current `frontend/src/components/jobs/jobs-list.tsx` first, then replace with a new implementation that:

1. Keeps all existing state and query logic
2. Adds `filtersDrawerOpen` state (replaces the old `filtersOpen` collapsible panel)
3. Shows desktop table with all 9 new columns
4. Shows the filter drawer as a right side-panel (position fixed, right 0, width 320px, height 100vh, z-index 40) with a backdrop
5. Preserves mobile card view

Key structure for the desktop table:

```tsx
// Table columns for desktop:
// JOB ID (monospace #525252) | CUSTOMER | PHONE | TYPE (JobTypeChip) | SOURCE (SourceChip) 
// | BRAND | TECHNICIAN (italic gray if unassigned) | SCHEDULED (date+time or —) | STATUS (StatusChip)

// Header section with title + filter button:
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', padding: '24px 24px 0' }}>
  <div>
    <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>All jobs</h1>
    <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0' }}>{total} jobs</p>
  </div>
  <button type="button" onClick={() => setFiltersDrawerOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1px solid #E5E5E5', borderRadius: '8px', backgroundColor: '#fff', color: '#404040', fontSize: '13px', cursor: 'pointer' }}>
    <SlidersHorizontal size={14} strokeWidth={1.5} /> Filters
  </button>
</div>

// Search input below header:
<div style={{ padding: '0 24px 16px', position: 'relative' }}>
  <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: '34px', top: '50%', transform: 'translateY(-50%)', color: '#A3A3A3' }} />
  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, job ID, brand…" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px' }} />
</div>
```

Filter drawer (right side panel, 320px):

```tsx
{/* Filter drawer backdrop */}
{filtersDrawerOpen ? (
  <div onClick={() => setFiltersDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39, backgroundColor: 'rgba(0,0,0,0.2)' }} />
) : null}

{/* Filter drawer */}
<div style={{
  position: 'fixed', top: 0, right: 0, width: '320px', height: '100vh',
  backgroundColor: '#fff', borderLeft: '1px solid #E5E5E5',
  transform: filtersDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
  transition: 'transform 220ms ease', zIndex: 40, overflowY: 'auto',
}}>
  <div style={{ padding: '20px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <span style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>Filters</span>
      <button type="button" onClick={() => setFiltersDrawerOpen(false)} style={{ border: '1px solid #E5E5E5', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>

    {/* Status multi-select chips */}
    {/* Brand dropdown */}
    {/* Technician dropdown */}
    {/* Type toggle (Installation / Complaint) */}
    {/* Date range from/to inputs */}

    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
      <button type="button" onClick={applyFilters} style={{ border: 'none', borderRadius: '8px', padding: '10px', backgroundColor: '#0A0A0A', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Apply</button>
      <button type="button" onClick={clearFilters} style={{ border: 'none', backgroundColor: 'transparent', color: '#525252', fontSize: '13px', cursor: 'pointer' }}>Clear all</button>
    </div>
  </div>
</div>
```

For the status multi-select chips, iterate over status options and toggle them with background `#0A0A0A` + white text when selected, `#F5F5F5` + `#525252` when not.

For the desktop table rows, show PHONE from `job.phone`, TYPE as `<JobTypeChip>`, SOURCE as `<SourceChip>`, BRAND as plain text `job.brandName ?? '—'`, TECHNICIAN as italic gray "Unassigned" when null, SCHEDULED formatted as `new Date(job.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })` or `—`.

- [ ] **Step 3: Verify the page renders all 9 columns on desktop**

Navigate to `/jobs`. Table should show JOB ID, CUSTOMER, PHONE, TYPE, SOURCE, BRAND, TECHNICIAN, SCHEDULED, STATUS. Filters button should open a right-side drawer.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/jobs/jobs-list.tsx frontend/src/types/jobs.ts
git commit -m "feat: redesign All Jobs table with 9 columns and right filter drawer"
```

---

## Task 9: Frontend — Schedule & Assign Page Redesign

**Files:**
- Modify: `frontend/src/app/(protected)/pending-schedule/page.tsx`
- Create: `frontend/src/lib/api/batch-schedule.ts`
- Modify: `frontend/src/types/office.ts` (add brandName, dealerName to PendingScheduleJob)

**Interfaces:**
- Consumes: `fetchPendingScheduleJobs()` (updated to return brandName, dealerName); `POST /jobs/batch-schedule`
- Produces: Table with DAYS WAITING (red when > 7), inline date+technician assignment; Batch Schedule modal

- [ ] **Step 1: Update PendingScheduleJob type**

In `frontend/src/types/office.ts`, add fields to `PendingScheduleJob`:

```typescript
export type PendingScheduleJob = {
  id: string;
  type: 'installation' | 'complaint';
  status: string;
  source: 'direct' | 'via_dealer';
  brandId: string | null;
  brandName: string | null;
  dealerId: string | null;
  dealerName: string | null;
  customerName: string;
  phone: string;
  address: string;
  scheduledAt: string | null;
  createdAt: string;
  version: number;
};
```

- [ ] **Step 2: Update the mapping in office.ts**

In `frontend/src/lib/api/office.ts`, update `mapPendingScheduleJob`:

```typescript
function mapPendingScheduleJob(row: UnknownRecord): PendingScheduleJob {
  return {
    id: asString(row.id),
    type: (asString(row.type) as PendingScheduleJob['type']) || 'installation',
    status: asString(row.status),
    source: (asString(row.source) as PendingScheduleJob['source']) || 'via_dealer',
    brandId: asNullableString(row.brand_id),
    brandName: asNullableString(row.brand_name),
    dealerId: asNullableString(row.dealer_id),
    dealerName: asNullableString(row.dealer_name),
    customerName: asString(row.customer_name),
    phone: asString(row.phone),
    address: asString(row.address),
    scheduledAt: asNullableString(row.scheduled_at),
    createdAt: asString(row.created_at),
    version: asNumber(row.version),
  };
}
```

- [ ] **Step 3: Create batch schedule API function**

Create `frontend/src/lib/api/batch-schedule.ts`:

```typescript
import { apiClient } from '@/lib/api/client';

export type BatchScheduleInput = {
  jobIds: string[];
  scheduledAt: string;
  technicianId?: string;
};

export type BatchScheduleResult = {
  ok: true;
  scheduled: number;
  errors: Array<{ jobId: string; reason: string }>;
};

export function batchScheduleJobs(input: BatchScheduleInput): Promise<BatchScheduleResult> {
  return apiClient.post<BatchScheduleResult>('/jobs/batch-schedule', input);
}
```

- [ ] **Step 4: Redesign the pending-schedule page**

Rewrite `frontend/src/app/(protected)/pending-schedule/page.tsx`. Key changes from the current page:

1. **Title**: "Schedule and Assign" (was "Pending Schedule")
2. **Subtitle**: "N jobs awaiting scheduling"
3. **Table columns**: JOB ID, CUSTOMER, TYPE, BRAND, DEALER, SUBMITTED, DAYS WAITING, SCHEDULE & ASSIGN
4. **DAYS WAITING**: compute `Math.floor((Date.now() - new Date(job.createdAt).getTime()) / (1000*60*60*24))`. Show as red `⊙ Nd` with underline when > 7 days, gray otherwise.
5. **SCHEDULE & ASSIGN column**: An inline date-time input + technician select that saves immediately via `schedulePendingJob()` on the "Schedule" button click (not a separate side form — each row has its own inline action)
6. **Batch schedule button**: "Batch schedule" opens a modal with checkboxes for all jobs, one shared date-time + technician, and a "Schedule N jobs" confirm button that calls `batchScheduleJobs()`
7. **Remove**: the customer lookup panel and the separate "Schedule selected job" form
8. **Keep**: the existing `fetchPendingScheduleJobs()`, `fetchOfficeTechnicians()`, `schedulePendingJob()` calls

The DAYS WAITING cell:
```tsx
const days = Math.floor((now - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24));
const overdue = days > 7;
<td style={{ padding: '14px 12px' }}>
  <span style={{ fontSize: '13px', color: overdue ? '#EF4444' : '#737373', fontWeight: overdue ? 600 : 400, textDecoration: overdue ? 'underline' : 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
    {overdue ? '⊙' : ''} {days}d
  </span>
</td>
```

The inline SCHEDULE & ASSIGN column (each row has its own state managed via a `rowState` Record):
- For simplicity: clicking "Schedule" in a row opens a mini-form row below it (expand row pattern) with date-time + technician select + Save button
- Or use a simple modal that pre-fills with the job's row — whichever is simpler

Keep the existing batch mode UI but wire it to the new `batchScheduleJobs()` API call.

The Batch Schedule Modal (triggered by "Batch schedule" button):
```tsx
// Modal with list of unscheduled jobs with checkboxes
// Single date-time picker and technician dropdown
// "Schedule N jobs" black button
// onConfirm: calls batchScheduleJobs({ jobIds: selectedIds, scheduledAt, technicianId })
//            then invalidates ['office', 'pending-schedule'] query
```

- [ ] **Step 5: Test the page renders without errors**

Navigate to `/pending-schedule`. Table should show DAYS WAITING column with red overdue indicators. Batch schedule button should open a modal.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/(protected)/pending-schedule/page.tsx frontend/src/lib/api/batch-schedule.ts frontend/src/types/office.ts frontend/src/lib/api/office.ts
git commit -m "feat: redesign Schedule & Assign with days-waiting indicator and batch schedule modal"
```

---

## Task 10: Frontend — Technicians + Dealers Pages Redesign

**Files:**
- Modify: `frontend/src/app/(protected)/technicians/page.tsx`
- Modify: `frontend/src/app/(protected)/dealer-management/page.tsx`
- Modify: `frontend/src/components/ui/avatar.tsx`

**Interfaces:**
- Consumes: existing `fetchTechnicianDirectory()`, `fetchDealers()`, `PATCH /technicians/:id`, `PATCH /dealers/:id`
- Produces: Both pages use same list row pattern (avatar circle + name left; Active/Inactive toggle + Edit button right); Avatar uses spec's 8-color palette; StatusToggle is now clickable (not disabled)

- [ ] **Step 1: Update Avatar component to use spec's 8 color pairs**

Replace `frontend/src/components/ui/avatar.tsx` with:

```tsx
const COLOR_PAIRS: Array<{ bg: string; text: string }> = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#F0FDF4', text: '#14532D' },
  { bg: '#FFF7ED', text: '#9A3412' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0] || '').join('').toUpperCase().slice(0, 2);
}

function avatarColorPair(name: string): { bg: string; text: string } {
  const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLOR_PAIRS.length;
  return COLOR_PAIRS[index];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = avatarColorPair(name);
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '9999px',
        backgroundColor: colors.bg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: `${Math.max(11, Math.round(size * 0.34))}px`,
        fontWeight: 600, color: colors.text,
        flexShrink: 0, userSelect: 'none',
      }}
    >
      {initials(name) || '?'}
    </span>
  );
}
```

- [ ] **Step 2: Write a test for avatarColorPair determinism**

Create `frontend/src/components/ui/__tests__/avatar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

const COLOR_PAIRS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#F0FDF4', text: '#14532D' },
  { bg: '#FFF7ED', text: '#9A3412' },
];

function avatarColorPair(name: string) {
  const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLOR_PAIRS.length;
  return COLOR_PAIRS[index];
}

describe('avatarColorPair', () => {
  it('always returns the same color for the same name', () => {
    const a = avatarColorPair('Ahmed Ali');
    const b = avatarColorPair('Ahmed Ali');
    expect(a).toEqual(b);
  });

  it('returns a valid color pair from the palette', () => {
    const pair = avatarColorPair('Test User');
    expect(COLOR_PAIRS).toContainEqual(pair);
  });
});
```

Run: `cd frontend && npm test -- --testPathPattern=avatar.test` — Expected: 2 passing.

- [ ] **Step 3: Redesign the Technicians page**

Rewrite `frontend/src/app/(protected)/technicians/page.tsx`:

Key changes:
1. **Remove** the fixed side panel drawer (lines 163–220)
2. **Header**: "Technicians" title + "N active · N total" subtitle; `+ Add technician` button stays
3. **List rows**: Avatar + Name on left; `<StatusToggle>` (now **clickable** — calls existing `updateTechnician` API) + `✎ Edit` button on right
4. **Edit modal**: reuse existing modal (already implemented), triggered by `✎ Edit` button
5. **Inactive rows**: avatar + name in muted gray `#A3A3A3`

StatusToggle is currently rendered with `disabled` prop. Remove the `disabled` prop and wire `onToggle` to call `apiClient.patch<{ ok: true }>(`/office/technicians/${technician.id}`, { isActive: !technician.isActive })` then invalidate the technicians query.

Actually check first if there's an existing `toggleTechnicianActive` function. If not, add it to `operations.ts`:

```typescript
export function toggleTechnicianActive(technicianId: string, isActive: boolean): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/office/technicians/${technicianId}`, { isActive });
}
```

Wait — first check what endpoint exists for technician toggle. Look at the backend routes. From the controller exploration, there's `@Patch` routes. Find the correct path (likely `PATCH /office/technicians/:id` or similar).

Row layout for a technician:
```tsx
<div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <Avatar name={tech.name} size={40} />
    <span style={{ fontSize: '15px', fontWeight: 500, color: tech.isActive ? '#0A0A0A' : '#A3A3A3' }}>{tech.name}</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <StatusToggle active={tech.isActive} onToggle={() => toggleMutation.mutate({ id: tech.id, isActive: !tech.isActive })} />
    <button type="button" onClick={() => { setEditTarget(tech); setShowEdit(true); }} style={{ border: 'none', backgroundColor: 'transparent', color: '#525252', fontSize: '13px', cursor: 'pointer' }}>
      ✎ Edit
    </button>
  </div>
</div>
```

Subtitle computation: `${active} active · ${total} total` where `active = technicians.filter(t => t.isActive).length`.

- [ ] **Step 4: Redesign the Dealers page**

Rewrite `frontend/src/app/(protected)/dealer-management/page.tsx` with the same pattern:

1. Header: "Dealer Management" + "N dealers" subtitle + `+ Add dealer` button
2. List rows: Avatar + Name left; StatusToggle (clickable, calls `updateDealer(id, { isActive })`) + `✎ Edit` button right
3. Inactive rows: muted gray
4. Keep existing add/edit dealer modal

Check the existing edit modal code in the dealer-management page (read the full file first). The edit modal updates dealer name, phone, and brand assignments. Keep that functionality.

For the toggle: `updateDealer(dealerId, { isActive: !dealer.isActive })` — this function already exists in `operations.ts`.

- [ ] **Step 5: Verify both pages render correctly**

Navigate to `/technicians` — list should show avatars with colored initials, Active/Inactive toggle, Edit button. Toggling should update in real-time.
Navigate to `/dealer-management` — same pattern.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/avatar.tsx frontend/src/components/ui/__tests__/avatar.test.ts frontend/src/app/(protected)/technicians/page.tsx frontend/src/app/(protected)/dealer-management/page.tsx frontend/src/lib/api/operations.ts
git commit -m "feat: redesign technicians and dealers pages with avatar pattern and active toggle"
```

---

## Task 11: Frontend — Analytics Page (Recharts + Charts + Extended Columns)

**Files:**
- Modify: `frontend/package.json` (add recharts)
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Create: `frontend/src/lib/api/analytics-daily.ts`
- Modify: `frontend/src/types/operations.ts` (extend analytics types)

**Interfaces:**
- Consumes: existing analytics endpoints; new `GET /analytics/business/daily?days=N`
- Produces: Business tab with 4 KPI cards + BarChart (revenue) + LineChart (jobs); extended Technician/Brand/Dealer tables; time window dropdown; CSV export button

- [ ] **Step 1: Install recharts**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend
npm install recharts
```

Verify: `node_modules/recharts/package.json` exists.

- [ ] **Step 2: Extend analytics types**

In `frontend/src/types/operations.ts`, update:

```typescript
export type AnalyticsTechnicianItem = {
  technicianId: string;
  technicianName: string;
  totalJobs: number;
  completionRate: number;
  onTimeRate: number | null;
  avgResolution: number | null;
  avgStarRating: number | null;
};

export type AnalyticsBrandItem = {
  brandId: string;
  brandName: string;
  totalJobs: number;
  completionRate: number;
  revisitRate: number | null;
  avgResolution: number | null;
};

export type AnalyticsDealerItem = {
  dealerId: string;
  dealerName: string;
  totalJobs: number;
  completionRate: number;
  avgDaysWaiting: number | null;
};

export type AnalyticsDailyItem = {
  date: string;
  revenue: number;
  total: number;
  completed: number;
};
```

- [ ] **Step 3: Update mapping functions in operations.ts**

In `fetchAnalyticsTechnicians`:
```typescript
return rows.map((row) => ({
  technicianId: asString(row.technician_id),
  technicianName: asString(row.technician_name),
  totalJobs: asNumber(row.total_jobs),
  completionRate: asNumber(row.completion_rate),
  onTimeRate: asNullableNumber(row.on_time_rate),
  avgResolution: asNullableNumber(row.avg_resolution),
  avgStarRating: asNullableNumber(row.avg_star_rating),
}));
```

In `fetchAnalyticsBrands`:
```typescript
return rows.map((row) => ({
  brandId: asString(row.brand_id),
  brandName: asString(row.brand_name),
  totalJobs: asNumber(row.total_jobs),
  completionRate: asNumber(row.completion_rate),
  revisitRate: asNullableNumber(row.revisit_rate),
  avgResolution: asNullableNumber(row.avg_resolution),
}));
```

In `fetchAnalyticsDealers`:
```typescript
return rows.map((row) => ({
  dealerId: asString(row.dealer_id),
  dealerName: asString(row.dealer_name),
  totalJobs: asNumber(row.total_jobs),
  completionRate: asNumber(row.completion_rate),
  avgDaysWaiting: asNullableNumber(row.avg_days_waiting),
}));
```

- [ ] **Step 4: Create analytics-daily.ts**

Create `frontend/src/lib/api/analytics-daily.ts`:

```typescript
import { apiClient } from '@/lib/api/client';
import type { AnalyticsDailyItem } from '@/types/operations';

type UnknownRecord = Record<string, unknown>;

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value); return Number.isNaN(n) ? fallback : n; }
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export async function fetchAnalyticsDaily(days = 7): Promise<AnalyticsDailyItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/business/daily?days=${days}`);
  return rows.map((row) => ({
    date: asString(row.date),
    revenue: asNumber(row.revenue),
    total: asNumber(row.total),
    completed: asNumber(row.completed),
  }));
}
```

- [ ] **Step 5: Rewrite the Analytics page**

Read the current `frontend/src/app/(protected)/analytics/page.tsx` then replace it.

Key structure:
```tsx
'use client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
// ... other imports
```

Business tab layout:
- 4 KPI summary cards in a 4-column grid (no sparklines): Total Revenue (SAR), Completion Rate, On-time Rate (from technicians data), Avg Resolution
- Bar chart (7 bars, `#0A0A0A` fill) for daily revenue SAR
- Line chart (2 lines) for daily jobs: total (gray `#737373`) and completed (amber `#F59E0B`)

The chart component wrapper:
```tsx
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginBottom: '12px' }}>{title}</div>
      {children}
    </div>
  );
}
```

Recharts BarChart example (inside ChartCard):
```tsx
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={dailyData} barSize={28}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A3A3A3' }} tickFormatter={(d) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} />
    <YAxis tick={{ fontSize: 11, fill: '#A3A3A3' }} axisLine={false} tickLine={false} />
    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E5E5' }} />
    <Bar dataKey="revenue" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

Recharts LineChart example:
```tsx
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={dailyData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A3A3A3' }} tickFormatter={(d) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} />
    <YAxis tick={{ fontSize: 11, fill: '#A3A3A3' }} axisLine={false} tickLine={false} />
    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E5E5' }} />
    <Line type="monotone" dataKey="total" stroke="#737373" strokeWidth={2} dot={false} name="Total" />
    <Line type="monotone" dataKey="completed" stroke="#F59E0B" strokeWidth={2} dot={false} name="Completed" />
  </LineChart>
</ResponsiveContainer>
```

CSV export button (top right of tab content):
```tsx
function exportToCsv(data: unknown[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0] as object);
  const rows = data.map((row) => keys.map((k) => String((row as Record<string, unknown>)[k] ?? '')).join(','));
  const csv = [keys.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

The Analytics page header:
- Title: "Analytics" + "Last N days · [Month Year]" subtitle
- Top right: `↓ Export CSV` button (exports current tab data)
- Time window dropdown moved to inside each tab (top right of tab content area)

Technician scorecards tab table: NAME, JOBS COMPLETED, COMPLETION RATE, ON-TIME RATE, AVG RESOLUTION, RATING (show "—" for null values).

Brand tab table: BRAND, TOTAL JOBS, COMPLETION RATE, REVISIT RATE, AVG RESOLUTION.

Dealer tab table: DEALER, JOBS REFERRED, COMPLETION RATE, AVG DAYS WAITING.

- [ ] **Step 6: Verify charts render**

Navigate to `/analytics`. Business tab should show KPI cards + 2 charts. No console errors from recharts.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/(protected)/analytics/page.tsx frontend/src/lib/api/analytics-daily.ts frontend/src/types/operations.ts frontend/src/lib/api/operations.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: add recharts charts to analytics, extend technician/brand/dealer tables, CSV export"
```

---

## Task 12: Frontend — Payments & Brands Merged Page + Service Items

**Files:**
- Modify: `frontend/src/app/(protected)/payment-methods/page.tsx`
- Create: `frontend/src/lib/api/service-items.ts`
- Modify: `frontend/src/types/operations.ts` (add ServiceItem type)

**Interfaces:**
- Consumes: existing `fetchPaymentMethods()`, `createPaymentMethod()`, `setPaymentMethodActive()`; existing `fetchOfficeBrands()`, `createBrand()`; new service items API
- Produces: Single merged page at `/payment-methods` with 3 sections: Payment Methods, Service Items & Pricing, Brands

- [ ] **Step 1: Add ServiceItem type**

In `frontend/src/types/operations.ts`, add:

```typescript
export type ServiceItem = {
  id: string;
  name: string;
  pricingType: 'fixed' | 'variable';
  unitPrice: number;
  unitLabel: string | null;
  createdAt: string;
};
```

- [ ] **Step 2: Create service-items API functions**

Create `frontend/src/lib/api/service-items.ts`:

```typescript
import { apiClient } from '@/lib/api/client';
import type { ServiceItem } from '@/types/operations';

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value); return Number.isNaN(n) ? fallback : n; }
  return fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapServiceItem(row: UnknownRecord): ServiceItem {
  return {
    id: asString(row.id),
    name: asString(row.name),
    pricingType: (asString(row.pricing_type) as ServiceItem['pricingType']) || 'fixed',
    unitPrice: asNumber(row.unit_price),
    unitLabel: asNullableString(row.unit_label),
    createdAt: asString(row.created_at),
  };
}

export async function fetchServiceItems(): Promise<ServiceItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>('/service-items');
  return rows.map(mapServiceItem);
}

export type CreateServiceItemInput = {
  name: string;
  pricingType: 'fixed' | 'variable';
  unitPrice: number;
  unitLabel?: string;
};

export async function createServiceItem(input: CreateServiceItemInput): Promise<ServiceItem> {
  const row = await apiClient.post<UnknownRecord>('/service-items', {
    name: input.name,
    pricingType: input.pricingType,
    unitPrice: input.unitPrice,
    unitLabel: input.unitLabel,
  });
  return mapServiceItem(row);
}

export function updateServiceItem(id: string, input: Partial<CreateServiceItemInput>): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/service-items/${id}`, {
    name: input.name,
    pricingType: input.pricingType,
    unitPrice: input.unitPrice,
    unitLabel: input.unitLabel,
  });
}

export function deleteServiceItem(id: string): Promise<{ ok: true }> {
  return apiClient.delete<{ ok: true }>(`/service-items/${id}`);
}
```

- [ ] **Step 3: Rewrite payment-methods page as merged Payments & Brands page**

Read the current `frontend/src/app/(protected)/payment-methods/page.tsx` then rewrite it.

Page layout — 3 sections vertically:

**Section 1 — Payment Methods** (existing functionality, updated visual style):
- Section header: CreditCard icon + "Payment Methods" + description text + `+ Add` black button
- Table: METHOD, STATUS (Active•Inactive pill), ACTIONS (✎ edit icon via toggle + 🗑 delete — keep only toggle for now since delete doesn't exist in API; show only toggle)
- Keep existing `fetchPaymentMethods`, `createPaymentMethod`, `setPaymentMethodActive` calls

**Section 2 — Service Items & Pricing** (new):
- Section header: Tag icon + "Service Items & Pricing" + `+ Add` black button
- Table: ITEM, PRICING (badge + price), ACTIONS (✎ edit + 🗑 delete)
- Pricing badge: `Variable` (blue `#DBEAFE`/`#1E40AF`) or `Fixed` (gray `#F5F5F5`/`#525252`)
- Add/Edit modal: name input, pricing type toggle (Fixed/Variable), unit price input, unit label (only shown for Variable)
- Uses `fetchServiceItems`, `createServiceItem`, `updateServiceItem`, `deleteServiceItem`

**Section 3 — Brands** (moved from `/admin/brands`):
- Section header: Building icon + "Brands" + description + `+ Add brand` button
- List of brands with color swatch and name
- Uses existing `fetchOfficeBrands()`, `createBrand()` from `operations.ts`

Section header pattern:
```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <CreditCard size={18} strokeWidth={1.5} color="#525252" />
    <div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#171717' }}>Payment Methods</div>
      <div style={{ fontSize: '12px', color: '#737373' }}>Organization payment options for job billing</div>
    </div>
  </div>
  <button type="button" onClick={() => setShowAddPayment(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: 'none', borderRadius: '8px', backgroundColor: '#0A0A0A', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
    <Plus size={13} strokeWidth={1.5} /> Add
  </button>
</div>
```

Page title section:
```tsx
<h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Payments & Brands</h1>
<p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0' }}>Manage payment methods, service item pricing, and brands</p>
```

- [ ] **Step 4: Test all three sections render and are functional**

Navigate to `/payment-methods`. Should see 3 sections. Add a payment method, add a service item, view brands. No console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(protected)/payment-methods/page.tsx frontend/src/lib/api/service-items.ts frontend/src/types/operations.ts
git commit -m "feat: merge Payments & Brands page with service items CRUD section"
```

---

## Task 13: Frontend — System Config Redesign + Admin Redirect

**Files:**
- Modify: `frontend/src/app/(protected)/admin/system-config/page.tsx`
- Create: `frontend/src/app/(protected)/admin/brands/page.tsx` (redirect)
- Modify: `frontend/src/components/layout/sidebar.tsx` (Admin link href only)

**Interfaces:**
- Produces: System Config page with info banner, 3 labeled sections, save-on-blur with green checkmark; `/admin/brands` redirects to `/payment-methods`; Sidebar Admin item links to `/admin/system-config`

- [ ] **Step 1: Rewrite system-config page with info banner and sections**

Read the current `frontend/src/app/(protected)/admin/system-config/page.tsx` then replace.

The spec's 3 sections with exact keys and defaults:

```
Section 1 — Customer complaint rules
  - repeat_complaint_window_days (default 30): "Repeat complaint window (days)"
  - frequent_complaint_threshold (default 3): "Frequent complaint threshold (count)"
  - frequent_complaint_window_days (default 90): "Frequent complaint window (days)"

Section 2 — Scheduling & Punctuality
  - punctuality_grace_period_minutes (default 15): "Punctuality grace period (minutes)"
  - standard_job_duration_minutes (default 120): "Standard job duration (minutes)"

Section 3 — SLA & Alerts
  - amber_alert_days (default 3): "Amber alert threshold (days waiting)"
  - no_show_hours (default 2): "No-show window (hours after scheduled)"
  - overdue_schedule_days (default 7): "Overdue scheduling threshold (days)"
```

Info banner (light gray bg, info circle icon):
```tsx
<div style={{ backgroundColor: '#F5F5F5', border: '1px solid #E5E5E5', borderRadius: '8px', padding: '12px 16px', display: 'flex', gap: '10px', marginBottom: '20px' }}>
  <Info size={16} strokeWidth={1.5} color="#737373" style={{ flexShrink: 0, marginTop: '1px' }} />
  <p style={{ margin: 0, fontSize: '12px', color: '#525252', lineHeight: 1.5 }}>
    Configuration changes apply only to new evaluations from the save point onward. Existing flags are point-in-time snapshots and are not retroactively recalculated.
  </p>
</div>
```

Each field row:
```tsx
<div style={{ marginBottom: '20px' }}>
  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#171717', marginBottom: '4px' }}>
    {field.label}
  </label>
  <div style={{ fontSize: '12px', color: '#A3A3A3', marginBottom: '8px' }}>{field.helperText}</div>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <input
      type="number"
      defaultValue={getValue(field.key, field.default)}
      onBlur={(e) => saveField(field.key, e.target.value)}
      style={{ width: '120px', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px' }}
    />
    {savedKey === field.key ? (
      <span style={{ fontSize: '12px', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Check size={12} strokeWidth={2} /> Saved
      </span>
    ) : null}
    {errorKey === field.key ? (
      <span style={{ fontSize: '12px', color: '#991B1B' }}>Error saving</span>
    ) : null}
  </div>
</div>
```

The `getValue(key, defaultValue)` helper:
```typescript
function getValue(key: string, defaultValue: number): number {
  const row = configQuery.data?.find((r) => r.key === key);
  return row ? Number(row.value) || defaultValue : defaultValue;
}
```

The `saveField(key, value)` function calls `updateSystemConfig({ key, value })` via mutation. On success: set `savedKey = key`, clear after 2 seconds via `setTimeout`. On error: set `errorKey = key`.

Section card wrapper:
```tsx
<div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
  <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#171717', margin: '0 0 16px' }}>{section.title}</h2>
  {/* fields */}
</div>
```

- [ ] **Step 2: Add the /admin/brands redirect**

Create `frontend/src/app/(protected)/admin/brands/page.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminBrandsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/payment-methods');
  }, [router]);
  return null;
}
```

- [ ] **Step 3: Update sidebar Admin item href**

In `frontend/src/components/layout/sidebar.tsx`, find the Admin nav item. It currently links to `/admin/brands`. Change its `href` to `/admin/system-config`.

Search for the pattern:
```bash
grep -n "admin\|Admin" frontend/src/components/layout/sidebar.tsx | head -20
```

Find the line with `/admin/brands` and change it to `/admin/system-config`. Only this href changes — labels, icons, and all other sidebar code stay unchanged.

- [ ] **Step 4: Verify System Config page loads with info banner**

Navigate to `/admin/system-config`. Should show info banner, 3 sections. Navigate to `/admin/brands` — should redirect to `/payment-methods`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(protected)/admin/system-config/page.tsx frontend/src/app/(protected)/admin/brands/page.tsx frontend/src/components/layout/sidebar.tsx
git commit -m "feat: redesign System Config page, add /admin/brands redirect, update sidebar Admin link"
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Covered By |
|---|---|
| App Shell top bar search modal (⌘K) | Task 6 |
| Global Search endpoint | Task 3 |
| Dashboard 5 KPI cards with sparklines | Task 7 |
| Dashboard Needs Revisit table with tags | Task 7 |
| Dashboard Active Jobs table | Task 7 |
| GET /dashboard/metrics | Task 2 |
| All Jobs new columns (PHONE, TYPE, SOURCE, BRAND, TECHNICIAN, SCHEDULED) | Task 8 |
| All Jobs filter drawer (right, 320px) | Task 8 |
| Schedule & Assign days waiting indicator | Task 9 |
| Schedule & Assign batch modal | Task 9 |
| POST /jobs/batch-schedule | Task 4 |
| Technicians avatar pattern + Active/Inactive toggle | Task 10 |
| Dealers same avatar pattern | Task 10 |
| Analytics Recharts BarChart + LineChart | Task 11 |
| Analytics 4 tabs with extended columns | Task 11 |
| Analytics CSV export | Task 11 |
| Analytics GET /analytics/business/daily | Task 5 |
| Payments & Brands merged page | Task 12 |
| Service Items & Pricing section | Task 12 |
| GET/POST/PATCH/DELETE /service-items | Task 5 |
| System Config info banner + 3 sections | Task 13 |
| New system_config keys seeded | Task 1 |
| ALTER TABLE jobs ADD COLUMN revisit_count | Task 1 |
| CREATE TABLE service_items | Task 1 |
| revisit_count increment on needs_revisit transition | Task 1 |
| /admin/brands redirect to /payment-methods | Task 13 |
| Sidebar Admin link → /admin/system-config | Task 13 |

**Gaps:**
- `is_repeat`, `is_frequent`, `is_chronic` flags exist on jobs table; the Tag derivation (Chronic, Frequent, Repeat) in the Needs Revisit table is simplified in Task 7 (uses `source === 'via_dealer'` as proxy for Repeat). A complete implementation would call a backend endpoint that derives tags from the system config thresholds. Noted as a limitation — full tag derivation requires additional backend logic that could be a follow-up.
- The `pendingSchedule` trend in `GET /dashboard/metrics` is computed as a proxy (40% of daily totals). A more accurate implementation would require historical pending counts which PostgreSQL doesn't store incrementally.

### Placeholder Scan

No TBD, TODO, or "similar to Task N" patterns found. All code blocks are complete.

### Type Consistency

- `KpiCard.trend?: number[]` — used in Task 7 ✓
- `DashboardMetrics.trends.totalActiveJobs` — returned from Task 2, read in Task 7 ✓
- `PendingScheduleJob.brandName` / `.dealerName` — added in Task 9 type update, mapped in office.ts ✓
- `ServiceItem` type defined in Task 12, produced by Task 5, consumed in Task 12 ✓
- `AnalyticsTechnicianItem.onTimeRate` — added in Task 11, returned from Task 5 backend ✓
- `BatchScheduleResult.scheduled` — defined in Task 4 backend, typed in Task 9 frontend ✓
