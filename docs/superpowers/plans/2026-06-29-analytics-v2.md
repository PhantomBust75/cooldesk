# Analytics v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all four analytics endpoints with correct live-query SQL that matches the Analytics Requirements v2 spec, then update frontend types, API mappers, and UI to consume the new shapes.

**Architecture:** All four `analytics.service.ts` methods (`getBusinessOverview`, `getBusinessDaily`, `getTechnicianAnalytics`, `getBrandAnalytics`, `getDealerAnalytics`) are rewritten to query `jobs` and `payments` tables directly — no event pipeline dependency. Frontend types are updated to match new response shapes; the analytics page UI is updated to show the correct columns and KPI cards.

**Tech Stack:** NestJS (PostgreSQL via `DatabaseService.query`), Next.js (React Query, inline styles), TypeScript.

## Global Constraints

- Revenue = `SUM(payments.amount) WHERE payments.status = 'collected' AND payments.is_deleted = FALSE`
- A voided payment is never counted regardless of prior status
- `jobs.source` DB value is `'via_dealer'` (not `'Via Dealer'`) — filter must use lowercase
- `payments.status` DB value is `'collected'` (lowercase) — inserted that way in jobs.service.ts
- Cancelled jobs: included in Total Jobs only; excluded from Completed, Resolution Rate, Revisit Rate
- Complaint-only metrics: `j.type = 'complaint'` filter required on every complaint metric
- "Resolved complaint" = `status IN ('resolved', 'resolved_on_revisit')`
- Percentages: `ROUND(…::numeric, 1)` → 1 decimal place
- Monetary: `ROUND(…::numeric, 2)` → 2 decimal places
- Time durations: whole minutes → `ROUND(EXTRACT(EPOCH FROM …) / 60.0)::int`
- `completed_by_technician_id` does not exist as a column — use `j.technician_id` (currently assigned technician) as the completer proxy, consistent with the existing pipeline
- First assignment timestamp: `MIN(assigned_at)` from `job_assignments` table
- Terminal timestamp for completed/resolved jobs: `j.updated_at` (set to NOW() on each status change)
- `visit_outcome` values: `'on_time'`, `'late'`, `'no_show'`, `'rescheduled'`, `NULL` — `rescheduled` excluded from On-Time Rate denominator
- Do not touch the event-processing pipeline methods (`processOrgEvents`, `applyEvent`, etc.)

---

### Task 1: Fix `getBusinessOverview` — Business Dashboard metrics

**Files:**
- Modify: `backend/src/modules/analytics/analytics.service.ts` — method `getBusinessOverview` (lines 356–396)
- Modify: `backend/src/modules/analytics/analytics.controller.ts` — no route change needed

**Interfaces:**
- Produces: `{ total_jobs, active_jobs, completed_jobs, total_revenue, first_visit_resolution_rate, revisit_rate }`

- [ ] **Step 1: Verify current broken state with curl**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/business/overview?days=30" | jq .
```

Expected current output has `total_jobs`, `resolved_or_completed`, `cancelled`, `revisit_pending`, `avg_star_rating` — missing revenue and resolution rates.

- [ ] **Step 2: Replace `getBusinessOverview` in `analytics.service.ts`**

Replace the entire method body (keep signature: `async getBusinessOverview(days: number, ctx: RequestContext): Promise<Record<string, unknown>>`):

```typescript
async getBusinessOverview(
  days: number,
  ctx: RequestContext,
): Promise<Record<string, unknown>> {
  const result = await this.db.query<{
    total_jobs: string;
    active_jobs: string;
    completed_jobs: string;
    total_revenue: string;
    first_visit_resolution_rate: string | null;
    revisit_rate: string | null;
  }>(
    `
    SELECT
      COUNT(j.id)::int AS total_jobs,
      COUNT(j.id) FILTER (
        WHERE j.status NOT IN ('completed', 'resolved', 'resolved_on_revisit', 'cancelled')
      )::int AS active_jobs,
      COUNT(j.id) FILTER (
        WHERE j.status IN ('completed', 'resolved', 'resolved_on_revisit')
      )::int AS completed_jobs,
      ROUND(
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'collected'), 0)::numeric,
        2
      ) AS total_revenue,
      CASE
        WHEN COUNT(j.id) FILTER (
          WHERE j.type = 'complaint'
            AND j.status IN ('resolved', 'resolved_on_revisit')
        ) = 0 THEN NULL
        ELSE ROUND(
          COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
              AND j.revisit_count = 0
          )::numeric
          / COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
          )::numeric
          * 100,
          1
        )
      END AS first_visit_resolution_rate,
      CASE
        WHEN COUNT(j.id) FILTER (
          WHERE j.type = 'complaint'
            AND j.status IN ('resolved', 'resolved_on_revisit')
        ) = 0 THEN NULL
        ELSE ROUND(
          COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
              AND j.revisit_count > 0
          )::numeric
          / COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
          )::numeric
          * 100,
          1
        )
      END AS revisit_rate
    FROM jobs j
    LEFT JOIN payments p
      ON p.job_id = j.id
     AND p.organization_id = j.organization_id
     AND p.is_deleted = FALSE
    WHERE j.organization_id = $1
      AND j.is_deleted = FALSE
      AND j.created_at >= NOW() - ($2::text || ' days')::interval
    `,
    [ctx.organizationId, days],
  );

  const row = result.rows[0];
  return {
    total_jobs: Number(row.total_jobs),
    active_jobs: Number(row.active_jobs),
    completed_jobs: Number(row.completed_jobs),
    total_revenue: Number(row.total_revenue),
    first_visit_resolution_rate:
      row.first_visit_resolution_rate !== null
        ? Number(row.first_visit_resolution_rate)
        : null,
    revisit_rate:
      row.revisit_rate !== null ? Number(row.revisit_rate) : null,
  };
}
```

- [ ] **Step 3: Verify new response shape**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/business/overview?days=30" | jq .
```

Expected: `{ total_jobs: N, active_jobs: N, completed_jobs: N, total_revenue: N.NN, first_visit_resolution_rate: N.N or null, revisit_rate: N.N or null }`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/analytics/analytics.service.ts
git commit -m "fix(analytics): rewrite business overview with correct live-query metrics"
```

---

### Task 2: Fix `getBusinessDaily` — Revenue Trend chart

**Files:**
- Modify: `backend/src/modules/analytics/analytics.service.ts` — method `getBusinessDaily` (lines 338–354)

**Interfaces:**
- Produces: `Array<{ date: string; revenue: number; total: number; completed: number }>` — same shape as before, now from live query

- [ ] **Step 1: Verify current output**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/business/daily?days=7" | jq .
```

Note: current query reads from `analytics_business_daily` table and may have stale/zero data if the event pipeline was never run.

- [ ] **Step 2: Replace `getBusinessDaily` in `analytics.service.ts`**

Replace the entire method body (keep signature: `async getBusinessDaily(days: number, ctx: RequestContext): Promise<Array<{ date: string; revenue: number; total: number; completed: number }>>`):

```typescript
async getBusinessDaily(
  days: number,
  ctx: RequestContext,
): Promise<Array<{ date: string; revenue: number; total: number; completed: number }>> {
  const result = await this.db.query<{
    date: string;
    revenue: string;
    total: string;
    completed: string;
  }>(
    `
    SELECT
      j.created_at::date::text AS date,
      ROUND(
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'collected'), 0)::numeric,
        2
      ) AS revenue,
      COUNT(j.id)::int AS total,
      COUNT(j.id) FILTER (
        WHERE j.status IN ('completed', 'resolved', 'resolved_on_revisit')
      )::int AS completed
    FROM jobs j
    LEFT JOIN payments p
      ON p.job_id = j.id
     AND p.organization_id = j.organization_id
     AND p.is_deleted = FALSE
    WHERE j.organization_id = $1
      AND j.is_deleted = FALSE
      AND j.created_at >= CURRENT_DATE - ($2::text || ' days')::interval
    GROUP BY j.created_at::date
    ORDER BY date ASC
    `,
    [ctx.organizationId, String(days)],
  );

  return result.rows.map((row) => ({
    date: row.date,
    revenue: Number(row.revenue),
    total: Number(row.total),
    completed: Number(row.completed),
  }));
}
```

- [ ] **Step 3: Verify new output**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/business/daily?days=7" | jq .
```

Expected: array of `{ date: "YYYY-MM-DD", revenue: N.NN, total: N, completed: N }`, sourced from live jobs data.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/analytics/analytics.service.ts
git commit -m "fix(analytics): rewrite business daily trend with live-query revenue"
```

---

### Task 3: Fix `getTechnicianAnalytics` — Technician Report Card

**Files:**
- Modify: `backend/src/modules/analytics/analytics.service.ts` — method `getTechnicianAnalytics` (lines 398–448)

**Interfaces:**
- Produces: `Array<{ technician_id, technician_name, jobs_completed, revenue_collected, first_visit_resolution_rate, avg_resolution_minutes, on_time_rate, avg_star_rating }>`

Key changes from current:
- `total_jobs` → `jobs_completed` (only terminal status jobs, attributed to current technician)
- Remove `completion_rate` (not in spec)
- Add `revenue_collected` (payments.status = 'collected')
- Add `first_visit_resolution_rate` (resolved complaints with revisit_count = 0)
- Add `avg_resolution_minutes` (from first assignment to updated_at)
- Fix `on_time_rate` denominator: exclude `rescheduled` visits, keep `no_show`
- Remove the mixed `analytics_technician_daily` join for on_time_rate — use `visit_outcome` directly from `jobs`

- [ ] **Step 1: Verify current broken output**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/technicians?days=30" | jq '.[0]'
```

Note current fields: `technician_id`, `technician_name`, `total_jobs`, `completion_rate`, `avg_star_rating`, `on_time_rate`. Fields `avg_resolution` is missing in response despite frontend expecting it.

- [ ] **Step 2: Replace `getTechnicianAnalytics` in `analytics.service.ts`**

Replace the entire method body (keep signature: `async getTechnicianAnalytics(days: number, ctx: RequestContext): Promise<Record<string, unknown>[]>`):

```typescript
async getTechnicianAnalytics(
  days: number,
  ctx: RequestContext,
): Promise<Record<string, unknown>[]> {
  const result = await this.db.query(
    `
    SELECT
      u.id AS technician_id,
      u.full_name AS technician_name,
      COUNT(j.id) FILTER (
        WHERE j.status IN ('completed', 'resolved', 'resolved_on_revisit')
      )::int AS jobs_completed,
      ROUND(
        COALESCE(
          SUM(p.amount) FILTER (WHERE p.status = 'collected'),
          0
        )::numeric,
        2
      ) AS revenue_collected,
      CASE
        WHEN COUNT(j.id) FILTER (
          WHERE j.type = 'complaint'
            AND j.status IN ('resolved', 'resolved_on_revisit')
        ) = 0 THEN NULL
        ELSE ROUND(
          COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
              AND j.revisit_count = 0
          )::numeric
          / COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
          )::numeric
          * 100,
          1
        )
      END AS first_visit_resolution_rate,
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (j.updated_at - fa.first_assigned_at)) / 60.0
        ) FILTER (
          WHERE j.status IN ('completed', 'resolved', 'resolved_on_revisit')
            AND fa.first_assigned_at IS NOT NULL
        )
      )::int AS avg_resolution_minutes,
      CASE
        WHEN COUNT(j.id) FILTER (
          WHERE j.visit_outcome IN ('on_time', 'late', 'no_show')
        ) = 0 THEN NULL
        ELSE ROUND(
          COUNT(j.id) FILTER (WHERE j.visit_outcome = 'on_time')::numeric
          / COUNT(j.id) FILTER (
            WHERE j.visit_outcome IN ('on_time', 'late', 'no_show')
          )::numeric
          * 100,
          1
        )
      END AS on_time_rate,
      (
        SELECT ROUND(AVG(cr.star_rating)::numeric, 2)
        FROM customer_reviews cr
        INNER JOIN jobs jj
          ON jj.id = cr.job_id
         AND jj.organization_id = cr.organization_id
        WHERE jj.technician_id = u.id
          AND jj.organization_id = $1
          AND cr.submitted_at IS NOT NULL
          AND cr.submitted_at >= NOW() - ($2::text || ' days')::interval
      ) AS avg_star_rating
    FROM users u
    LEFT JOIN jobs j
      ON j.technician_id = u.id
     AND j.organization_id = $1
     AND j.is_deleted = FALSE
     AND j.created_at >= NOW() - ($2::text || ' days')::interval
    LEFT JOIN payments p
      ON p.job_id = j.id
     AND p.organization_id = j.organization_id
     AND p.is_deleted = FALSE
    LEFT JOIN (
      SELECT job_id, MIN(assigned_at) AS first_assigned_at
      FROM job_assignments
      WHERE organization_id = $1
      GROUP BY job_id
    ) fa ON fa.job_id = j.id
    WHERE u.organization_id = $1
      AND u.role = 'technician'
      AND u.is_deleted = FALSE
    GROUP BY u.id, u.full_name
    ORDER BY jobs_completed DESC
    `,
    [ctx.organizationId, days],
  );

  return result.rows as Record<string, unknown>[];
}
```

- [ ] **Step 3: Verify new output**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/technicians?days=30" | jq '.[0]'
```

Expected fields: `technician_id`, `technician_name`, `jobs_completed`, `revenue_collected`, `first_visit_resolution_rate` (number or null), `avg_resolution_minutes` (integer or null), `on_time_rate` (number or null), `avg_star_rating` (number or null).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/analytics/analytics.service.ts
git commit -m "fix(analytics): rewrite technician report card — completed_by attribution, resolution time, corrected on-time rate denominator"
```

---

### Task 4: Fix `getBrandAnalytics` and `getDealerAnalytics`

**Files:**
- Modify: `backend/src/modules/analytics/analytics.service.ts` — methods `getBrandAnalytics` (lines 450–482) and `getDealerAnalytics` (lines 484–525)

**Interfaces:**
- Brand produces: `Array<{ brand_id, brand_name, total_jobs, active_jobs, completed_jobs, revenue_collected, revisit_rate }>`
- Dealer produces: `Array<{ dealer_id, dealer_name, total_jobs, active_jobs, completed_jobs, revenue_generated }>`

Key brand changes: add `active_jobs`, `completed_jobs`, `revenue_collected`, add `revisit_rate`; remove `completion_rate`.

Key dealer changes: fix `source` filter to `'via_dealer'` (was producing zero revenue); add `active_jobs`, `completed_jobs`, `revenue_generated`; remove `completion_rate` and `avg_days_waiting`.

- [ ] **Step 1: Verify current broken dealer revenue**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/dealers?days=30" | jq '.[0]'
```

Expected: `revenue_generated` is currently missing; `completion_rate` exists (must be removed).

- [ ] **Step 2: Replace `getBrandAnalytics` in `analytics.service.ts`**

Replace the entire method body (keep signature: `async getBrandAnalytics(days: number, ctx: RequestContext): Promise<Record<string, unknown>[]>`):

```typescript
async getBrandAnalytics(
  days: number,
  ctx: RequestContext,
): Promise<Record<string, unknown>[]> {
  const result = await this.db.query(
    `
    SELECT
      b.id AS brand_id,
      b.name AS brand_name,
      COUNT(j.id)::int AS total_jobs,
      COUNT(j.id) FILTER (
        WHERE j.status NOT IN ('completed', 'resolved', 'resolved_on_revisit', 'cancelled')
      )::int AS active_jobs,
      COUNT(j.id) FILTER (
        WHERE j.status IN ('completed', 'resolved', 'resolved_on_revisit')
      )::int AS completed_jobs,
      ROUND(
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'collected'), 0)::numeric,
        2
      ) AS revenue_collected,
      CASE
        WHEN COUNT(j.id) FILTER (
          WHERE j.type = 'complaint'
            AND j.status IN ('resolved', 'resolved_on_revisit')
        ) = 0 THEN NULL
        ELSE ROUND(
          COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
              AND j.revisit_count > 0
          )::numeric
          / COUNT(j.id) FILTER (
            WHERE j.type = 'complaint'
              AND j.status IN ('resolved', 'resolved_on_revisit')
          )::numeric
          * 100,
          1
        )
      END AS revisit_rate
    FROM brands b
    LEFT JOIN jobs j
      ON j.brand_id = b.id
     AND j.organization_id = $1
     AND j.is_deleted = FALSE
     AND j.created_at >= NOW() - ($2::text || ' days')::interval
    LEFT JOIN payments p
      ON p.job_id = j.id
     AND p.organization_id = j.organization_id
     AND p.is_deleted = FALSE
    WHERE b.organization_id = $1
      AND b.is_deleted = FALSE
    GROUP BY b.id, b.name
    ORDER BY total_jobs DESC
    `,
    [ctx.organizationId, days],
  );

  return result.rows as Record<string, unknown>[];
}
```

- [ ] **Step 3: Replace `getDealerAnalytics` in `analytics.service.ts`**

Replace the entire method body (keep signature: `async getDealerAnalytics(days: number, ctx: RequestContext): Promise<Record<string, unknown>[]>`):

```typescript
async getDealerAnalytics(
  days: number,
  ctx: RequestContext,
): Promise<Record<string, unknown>[]> {
  const result = await this.db.query(
    `
    SELECT
      d.id AS dealer_id,
      d.name AS dealer_name,
      COUNT(j.id)::int AS total_jobs,
      COUNT(j.id) FILTER (
        WHERE j.status NOT IN ('completed', 'resolved', 'resolved_on_revisit', 'cancelled')
      )::int AS active_jobs,
      COUNT(j.id) FILTER (
        WHERE j.status IN ('completed', 'resolved', 'resolved_on_revisit')
      )::int AS completed_jobs,
      ROUND(
        COALESCE(
          SUM(p.amount) FILTER (
            WHERE p.status = 'collected'
              AND j.source = 'via_dealer'
          ),
          0
        )::numeric,
        2
      ) AS revenue_generated
    FROM dealers d
    LEFT JOIN jobs j
      ON j.dealer_id = d.id
     AND j.organization_id = $1
     AND j.is_deleted = FALSE
     AND j.created_at >= NOW() - ($2::text || ' days')::interval
    LEFT JOIN payments p
      ON p.job_id = j.id
     AND p.organization_id = j.organization_id
     AND p.is_deleted = FALSE
    WHERE d.organization_id = $1
      AND d.is_deleted = FALSE
    GROUP BY d.id, d.name
    ORDER BY total_jobs DESC
    `,
    [ctx.organizationId, days],
  );

  return result.rows as Record<string, unknown>[];
}
```

- [ ] **Step 4: Verify both endpoints**

```bash
curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/brands?days=30" | jq '.[0]'
# Expected: brand_id, brand_name, total_jobs, active_jobs, completed_jobs, revenue_collected, revisit_rate

curl -s -H "Authorization: Bearer <owner_token>" \
  "http://localhost:3001/analytics/dealers?days=30" | jq '.[0]'
# Expected: dealer_id, dealer_name, total_jobs, active_jobs, completed_jobs, revenue_generated
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/analytics/analytics.service.ts
git commit -m "fix(analytics): add active/completed/revenue to brand+dealer; fix dealer source filter 'via_dealer'; remove stale completion_rate"
```

---

### Task 5: Frontend — types, API mappers, analytics page UI

**Files:**
- Modify: `frontend/src/types/operations.ts` — update four analytics types (lines 65–105)
- Modify: `frontend/src/lib/api/operations.ts` — update four fetcher map functions (lines 224–275)
- Modify: `frontend/src/app/(protected)/analytics/page.tsx` — update KPI cards and table columns

**Interfaces:**
- Consumes: new backend shapes from Tasks 1–4
- Produces: correct analytics UI matching v2 spec

- [ ] **Step 1: Update types in `frontend/src/types/operations.ts`**

Replace the four analytics types (lines 65–105):

```typescript
export type AnalyticsOverview = {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalRevenue: number;
  firstVisitResolutionRate: number | null;
  revisitRate: number | null;
};

export type AnalyticsTechnicianItem = {
  technicianId: string;
  technicianName: string;
  jobsCompleted: number;
  revenueCollected: number;
  firstVisitResolutionRate: number | null;
  avgResolutionMinutes: number | null;
  onTimeRate: number | null;
  avgStarRating: number | null;
};

export type AnalyticsBrandItem = {
  brandId: string;
  brandName: string;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  revenueCollected: number;
  revisitRate: number | null;
};

export type AnalyticsDealerItem = {
  dealerId: string;
  dealerName: string;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  revenueGenerated: number;
};
```

- [ ] **Step 2: Update `fetchAnalyticsOverview` mapper in `frontend/src/lib/api/operations.ts`**

Replace the function body at line 224:

```typescript
export async function fetchAnalyticsOverview(days = 30): Promise<AnalyticsOverview> {
  const payload = await apiClient.get<unknown>(`/analytics/business/overview?days=${days}`);
  const row = asRecord(payload);

  return {
    totalJobs: asNumber(row.total_jobs),
    activeJobs: asNumber(row.active_jobs),
    completedJobs: asNumber(row.completed_jobs),
    totalRevenue: asNumber(row.total_revenue),
    firstVisitResolutionRate: asNullableNumber(row.first_visit_resolution_rate),
    revisitRate: asNullableNumber(row.revisit_rate),
  };
}
```

- [ ] **Step 3: Update `fetchAnalyticsTechnicians` mapper**

Replace the function body at line 241:

```typescript
export async function fetchAnalyticsTechnicians(days = 30): Promise<AnalyticsTechnicianItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/technicians?days=${days}`);
  return rows.map((row) => ({
    technicianId: asString(row.technician_id),
    technicianName: asString(row.technician_name),
    jobsCompleted: asNumber(row.jobs_completed),
    revenueCollected: asNumber(row.revenue_collected),
    firstVisitResolutionRate: asNullableNumber(row.first_visit_resolution_rate),
    avgResolutionMinutes: asNullableNumber(row.avg_resolution_minutes),
    onTimeRate: asNullableNumber(row.on_time_rate),
    avgStarRating: asNullableNumber(row.avg_star_rating),
  }));
}
```

- [ ] **Step 4: Update `fetchAnalyticsBrands` mapper**

Replace the function body at line 254:

```typescript
export async function fetchAnalyticsBrands(days = 30): Promise<AnalyticsBrandItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/brands?days=${days}`);
  return rows.map((row) => ({
    brandId: asString(row.brand_id),
    brandName: asString(row.brand_name),
    totalJobs: asNumber(row.total_jobs),
    activeJobs: asNumber(row.active_jobs),
    completedJobs: asNumber(row.completed_jobs),
    revenueCollected: asNumber(row.revenue_collected),
    revisitRate: asNullableNumber(row.revisit_rate),
  }));
}
```

- [ ] **Step 5: Update `fetchAnalyticsDealers` mapper**

Replace the function body at line 266:

```typescript
export async function fetchAnalyticsDealers(days = 30): Promise<AnalyticsDealerItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/dealers?days=${days}`);
  return rows.map((row) => ({
    dealerId: asString(row.dealer_id),
    dealerName: asString(row.dealer_name),
    totalJobs: asNumber(row.total_jobs),
    activeJobs: asNumber(row.active_jobs),
    completedJobs: asNumber(row.completed_jobs),
    revenueGenerated: asNumber(row.revenue_generated),
  }));
}
```

- [ ] **Step 6: Run TypeScript check to confirm no type errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "error|analytics"
```

Expected: no output (zero errors).

- [ ] **Step 7: Update Business tab KPI cards in `analytics/page.tsx`**

Replace the KPI cards section (the `{overview ? (…) : null}` block). The current 4-card grid showing Completion Rate / On-Time Rate / Avg Resolution — which are wrong — becomes 6 cards in a 3-column, 2-row grid:

```tsx
{overview ? (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "12px",
      marginBottom: "20px",
    }}
  >
    <KpiCard
      title="Total Revenue (SAR)"
      value={overview.totalRevenue.toLocaleString("en", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    />
    <KpiCard
      title="Total Jobs"
      value={String(overview.totalJobs)}
    />
    <KpiCard
      title="Active Jobs"
      value={String(overview.activeJobs)}
    />
    <KpiCard
      title="Completed Jobs"
      value={String(overview.completedJobs)}
    />
    <KpiCard
      title="1st Visit Resolution"
      value={
        overview.firstVisitResolutionRate != null
          ? `${overview.firstVisitResolutionRate.toFixed(1)}%`
          : "—"
      }
    />
    <KpiCard
      title="Revisit Rate"
      value={
        overview.revisitRate != null
          ? `${overview.revisitRate.toFixed(1)}%`
          : "—"
      }
    />
  </div>
) : null}
```

Also remove the now-unused derived KPI variables from the component body:

```tsx
// DELETE these lines (they reference old type fields that no longer exist):
// const avgOnTime = ...
// const avgResolutionKpi = ...
```

- [ ] **Step 8: Update Technician table columns**

Replace the `<thead>` and `<tbody>` rows in the technicians tab. New columns: NAME | JOBS COMPLETED | REVENUE (SAR) | 1ST VISIT RES. | AVG RESOLUTION | ON-TIME RATE | RATING

```tsx
<thead>
  <tr style={{ backgroundColor: "#FAFAFA", color: "#737373", textAlign: "left" }}>
    {["NAME", "JOBS COMPLETED", "REVENUE (SAR)", "1ST VISIT RES.", "AVG RESOLUTION", "ON-TIME RATE", "RATING"].map(
      (h) => (
        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>
          {h}
        </th>
      ),
    )}
  </tr>
</thead>
<tbody>
  {(techniciansQuery.data ?? []).map((item) => (
    <tr key={item.technicianId} style={{ borderBottom: "1px solid #F5F5F5" }}>
      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.technicianName || "—"}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.jobsCompleted}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {nullFmt(item.firstVisitResolutionRate, 1, "%")}
      </td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {item.avgResolutionMinutes != null ? `${item.avgResolutionMinutes} min` : "—"}
      </td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {nullFmt(item.onTimeRate, 1, "%")}
      </td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {nullFmt(item.avgStarRating, 2)}
      </td>
    </tr>
  ))}
</tbody>
```

- [ ] **Step 9: Update Brand table columns**

New columns: BRAND | TOTAL JOBS | ACTIVE JOBS | COMPLETED JOBS | REVENUE (SAR) | REVISIT RATE
(Remove: COMPLETION RATE, AVG RESOLUTION)

```tsx
<thead>
  <tr style={{ backgroundColor: "#FAFAFA", color: "#737373", textAlign: "left" }}>
    {["BRAND", "TOTAL JOBS", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (SAR)", "REVISIT RATE"].map(
      (h) => (
        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>
          {h}
        </th>
      ),
    )}
  </tr>
</thead>
<tbody>
  {(brandsQuery.data ?? []).map((item) => (
    <tr key={item.brandId} style={{ borderBottom: "1px solid #F5F5F5" }}>
      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.brandName || "—"}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.activeJobs}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completedJobs}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {nullFmt(item.revisitRate, 1, "%")}
      </td>
    </tr>
  ))}
</tbody>
```

- [ ] **Step 10: Update Dealer table columns**

New columns: DEALER | JOBS SUBMITTED | ACTIVE JOBS | COMPLETED JOBS | REVENUE (SAR)
(Remove: COMPLETION RATE, AVG DAYS WAITING)

```tsx
<thead>
  <tr style={{ backgroundColor: "#FAFAFA", color: "#737373", textAlign: "left" }}>
    {["DEALER", "JOBS SUBMITTED", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (SAR)"].map(
      (h) => (
        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>
          {h}
        </th>
      ),
    )}
  </tr>
</thead>
<tbody>
  {(dealersQuery.data ?? []).map((item) => (
    <tr key={item.dealerId} style={{ borderBottom: "1px solid #F5F5F5" }}>
      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.dealerName || "—"}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.activeJobs}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completedJobs}</td>
      <td style={{ padding: "10px 12px", color: "#404040" }}>
        {item.revenueGenerated.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  ))}
</tbody>
```

- [ ] **Step 11: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep error
```

Expected: no output.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/types/operations.ts \
        frontend/src/lib/api/operations.ts \
        frontend/src/app/\(protected\)/analytics/page.tsx
git commit -m "feat(analytics): update frontend types, mappers, and UI to match v2 spec"
```

---

## Spec Coverage Checklist

| Spec section | Task |
|---|---|
| 1.1 Total Revenue Collected | Task 1 |
| 1.2 Revenue Trend | Task 2 |
| 1.3 Total Jobs | Task 1 |
| 1.4 Active Jobs (incl. revisit/cancellation-requested states) | Task 1 |
| 1.5 Completed Jobs | Task 1 |
| 1.6 First Visit Resolution Rate | Task 1 |
| 1.7 Revisit Rate | Task 1 |
| 2.1 Technician Jobs Completed | Task 3 |
| 2.2 Technician Revenue Collected | Task 3 |
| 2.3 Technician First Visit Resolution Rate | Task 3 |
| 2.4 Average Resolution Time (first_assigned → updated_at, minutes) | Task 3 |
| 2.5 On-Time Arrival Rate (rescheduled excluded) | Task 3 |
| 3.1 Dealer Jobs Submitted | Task 4 |
| 3.2 Dealer Revenue Generated (source = 'via_dealer' fix) | Task 4 |
| 3.3 Dealer Active Jobs | Task 4 |
| 3.4 Dealer Completed Jobs | Task 4 |
| 3.5 Dealer Resolution Rate removed | Task 4 |
| 4.1 Brand Total Jobs | Task 4 |
| 4.2 Brand Revenue Collected | Task 4 |
| 4.3 Brand Active Jobs | Task 4 |
| 4.4 Brand Completed Jobs | Task 4 |
| 4.5 Brand Revisit Rate | Task 4 |
| Frontend KPI cards (business) | Task 5 |
| Frontend technician table | Task 5 |
| Frontend brand table | Task 5 |
| Frontend dealer table | Task 5 |
