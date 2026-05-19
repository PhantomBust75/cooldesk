# CoolDesk — GitHub Copilot Instructions

## What This Project Is

CoolDesk is a **multi-tenant SaaS portal** for AC service businesses (NestJS + Next.js +
PostgreSQL on AWS). Each AC service business is an **organization** (tenant). Organizations are
fully isolated — no data from one organization is ever visible or accessible to another.

Within each organization, CoolDesk manages two job types — **AC installations** and **customer
complaints** — end-to-end: scheduling, technician dispatch, field status updates, revisit
tracking, payment collection, and analytics.

This is **not a CRUD application**. Every job follows a strict, forward-only state machine
enforced at the service layer. Always think in terms of state transitions, not record updates.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS — modular monolith |
| Frontend | Next.js (REST consumption) |
| Database | PostgreSQL 14+ |
| Infrastructure | AWS — EC2 + ALB, RDS Multi-AZ, S3, CloudFront, Secrets Manager |
| Auth | JWT — carries `organization_id`, `user_id` (or `dealer_id`), and `role` |
| Technician view | PWA — offline-capable, optimised for low-end Android |

---

## Tenancy Model

### Organizations
- Every tenant is an `organizations` row. All operational data belongs to an organization.
- Organizations can be activated or deactivated by the platform admin but are **never deleted**.
- Each organization gets its own seeded `system_config` rows on creation.
- The `slug` field on `organizations` is used for subdomain routing (e.g.
  `acme.cooldesk.com`).

### The two identity layers

| Layer | Who | Table |
|---|---|---|
| **Platform** | CoolDesk staff managing the SaaS platform itself | `platform_admins` |
| **Organization** | Users within a tenant's AC business | `users`, `dealers` |

These are **completely separate**. `platform_admins` rows are never in the `users` table. A
`users` row with any role can never access platform-level operations.

### User Roles (organization-scoped)

There are exactly **four roles**. Every role exists within exactly one organization.

| Role | Key Capabilities |
|---|---|
| `owner` | Full read-write within the org. Override any record, status, or payment. Manages all accounts, brands, payment methods, and org config. |
| `office_staff` | Create/assign jobs, manage revisit slots, one-state rollback (pre-completion only), approve/reject dealer cancellation requests. |
| `technician` | Own assigned jobs only. Move status forward, log arrival, record payment. 60-second undo window after each transition. |
| `dealer` | Submit jobs on behalf of customers. Read-only history of own submissions. Request cancellations on in-progress jobs. |

`owner`, `office_staff`, and `technician` live in the `users` table (role enum +
`organization_id`).  
`dealer` is a **separate entity** in the `dealers` table, also scoped by `organization_id`.  
Never conflate dealers with users in queries or guards.

---

## Multi-Tenancy Rules — Never Violate

These apply to **every** query, service method, controller, and background worker without
exception.

**1. Every tenant-scoped table carries `organization_id`.**

Tables that carry `organization_id`: `users`, `dealers`, `brands`, `jobs`, `job_units`,
`job_assignments`, `revisits`, `revisit_assignments`, `job_cancellation_requests`, `payments`,
`payment_methods`, `virtual_customers`, `customer_phones`, `job_timeline`, `notifications`,
`scheduling_conflicts`, `analytics_technician_daily`, `analytics_business_daily`,
`analytics_brand_daily`, `analytics_dealer_daily`, `customer_reviews`, `system_config`.

**2. Every query against a tenant-scoped table must filter by `organization_id`.**

A query that omits `organization_id` is a data-leak bug, not a minor omission.

**3. `organization_id` always comes from the verified JWT — never from the request body or
query string.**

The `TenantGuard` extracts `organization_id` from the token and attaches it to the request
context. Services read it from context only.

```typescript
// Apply to every tenant-scoped controller
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)

// Read org from context in every service method — never from body/params
async findJob(jobId: string, ctx: RequestContext): Promise<Job> {
  return this.repo.findOne({
    where: { id: jobId, organization_id: ctx.organizationId, is_deleted: false },
  });
}
```

**4. Cross-tenant access is never permitted at the application layer.**

Only `platform_admin` can query across organizations, and only through dedicated platform
endpoints that are completely separate from the tenant API surface.

**5. Background workers must scope every query by `organization_id`**, received as part of the
job payload — never inferred or omitted.

**6. Composite indexes on hot query paths must lead with `organization_id`** so PostgreSQL can
perform index scans without touching other tenants' rows.

**7. Foreign key references within a tenant must be validated to belong to the same org.**

A brand, technician, dealer, or payment method from org A must never be assignable to a job in
org B. Enforce at the service layer; the DB FK alone is not sufficient.

---

## Configuration Layer (Per Organization)

Stored in `system_config` (composite PK: `organization_id` + `key`). Managed exclusively by
the `owner` role within each org. Never hardcode threshold values in application logic — always
read via `ConfigService` scoped to the current `organization_id`.

| Key | Default |
|---|---|
| `repeat_complaint_window_days` | `30` |
| `frequent_complaint_threshold` | `3` |
| `frequent_complaint_window_days` | `90` |
| `punctuality_grace_period_mins` | `15` |
| `customer_review_mode` | `'off'` |
| `undo_window_seconds` | `60` |

---

## Core Data Model Rules

### Jobs
- Every job must have `type`, `status`, `brand_id`, `source`, and `organization_id` before saving.
- `type` is either `'installation'` or `'complaint'`. Immutable after creation.
- `source` is either `'direct'` or `'via_dealer'`. When `via_dealer`, `dealer_id` must not be
  null (`chk_dealer_source`). The referenced dealer must belong to the **same organization**.
- Complaint-specific fields (e.g. `issue_description`) must be null on installation jobs and vice
  versa.
- A technician assignment is not required at creation but is required before a job can advance
  past its initial state. The assigned technician must belong to the **same organization**.

### Virtual Customer ID (VCID)
- Every job carries a `vcid` (FK to `virtual_customers`).
- `virtual_customers` is **organization-scoped**. A VCID is unique within an org, not globally.
- The VCID is a **backend-only identity anchor** — never displayed or referenced by name in the
  UI. All customer-facing UI uses name, address, and phone numbers only.
- On new job creation, check `customer_phones` filtered by the same `organization_id` to find
  an existing VCID. Never match across organizations.
- VCID is the sole identifier used by repeat complaint and frequent complaint detection.

### Payments
- Every job has exactly **one** payment record (UNIQUE on `payments.job_id`).
- Payment is recorded atomically with the `completed` / `resolved` status transition.
- **Split payment authority by role:**
  - Technician: records initial amount and method.
  - Office staff: may modify `payment_method_id` only.
  - Owner: may modify `payment_amount` only.
- Every payment edit must be logged in `job_timeline` with previous value, new value, field,
  timestamp, and actor.
- Owner reversal of `completed` / `resolved` outside the 60-second undo window with an existing
  payment requires a **mandatory retain-or-void prompt**. Never bypass this.

### Brands
- Brand is **mandatory** on every job and is **organization-scoped**.
- Brands can be activated/deactivated but **never deleted** (`is_active = FALSE`).
- A brand belonging to one org cannot be referenced by a job in another org.

### Soft Deletes
- All operational entities use `is_deleted = BOOLEAN`. Physical deletion is never used.
- Always include both `is_deleted = FALSE` **and** `organization_id = :org_id` in operational
  queries.

---

## Job Status State Machines

**Enforced by `trg_validate_job_status` at the DB level AND the NestJS service layer.**

### Installation statuses (in order)
`pending_schedule` → `scheduled` → `assigned` → `acknowledged` → `in_transit` → `in_process`
→ `completed` | `cancelled`  
(`pending_schedule` only for dealer-submitted installations; direct jobs start at `scheduled`)

### Complaint statuses (in order)
`new` → `assigned` → `acknowledged` → `in_transit` → `in_process` → `resolved`  
Revisit branch: `in_process` → `needs_revisit` → `revisit_scheduled` → `in_transit` →
`in_process` → `resolved` (loops)  
Terminal: `resolved`, `resolved_on_revisit`, `cancelled`  
Dealer-only intermediate: `cancellation_requested`

**Rules:**
- Jobs cannot skip states or move backward except via office-staff rollback or owner override.
- A complaint can only close when a technician explicitly marks `resolved` or
  `resolved_on_revisit`.
- Cancelled jobs are excluded from resolution/completion rates but included in volume counts.

---

## Revisit Track

Triggered when a technician marks a complaint `needs_revisit`.

- Technician must select a reason: `part_unavailable`, `customer_not_home`, `issue_recurring`,
  `further_diagnosis_required`, or `custom` (requires `custom_reason` text).
- A `revisits` child record is created with `sequence_number` incremented.
- Raise amber `revisit_pending_scheduling` alert on office staff portal and owner dashboard.
- When `sequence_number >= 3`, `trg_chronic` sets `jobs.is_chronic = TRUE`. Notify owner and
  office staff. Surface a distinct chronic indicator on the owner dashboard.
- Revisit assignments are independent — default to the parent job technician but allow
  reassignment within the same org.

---

## 60-Second Undo Window

- Countdown starts **on the device at queue submission**, not on server confirmation.
- After 60 seconds the transition is locked on the device.
- Special rollback logic on undo:
  - `needs_revisit`: delete the revisit record, clear the amber alert.
  - `completed` / `resolved`: roll back payment record atomically.
- Duration read from `system_config.undo_window_seconds` for the current org — never hardcoded.

---

## Optimistic Locking

Both `jobs` and `payments` use a `version` integer column. Always include `organization_id`
and `version` in update conditions:

```sql
UPDATE jobs
SET status = :new_status, updated_at = NOW(), version = version + 1
WHERE id = :job_id
  AND organization_id = :org_id
  AND version = :expected_version
  AND is_deleted = FALSE;
-- 0 rows updated → throw OptimisticLockException → HTTP 409
```

---

## Atomic Payment + Status Transition

```sql
BEGIN;
  UPDATE jobs SET status = 'completed', version = version + 1, updated_at = NOW()
    WHERE id = :job_id AND organization_id = :org_id AND version = :v AND is_deleted = FALSE;
  INSERT INTO payments
    (job_id, organization_id, amount, payment_method_id, status, recorded_by)
    VALUES (:job_id, :org_id, :amount, :method_id, 'collected', :technician_id);
  INSERT INTO job_timeline (job_id, organization_id, event_type, actor_user_id, new_value)
    VALUES (:job_id, :org_id, 'status_transition', :technician_id, '{"status":"completed"}');
  INSERT INTO job_timeline (job_id, organization_id, event_type, actor_user_id, new_value)
    VALUES (:job_id, :org_id, 'payment_recorded', :technician_id, :payment_json);
COMMIT;
```

---

## Offline Sync (Technician Mobile View)

- Status transitions and payment details queued as a **single atomic entry**; `organization_id`
  is included in the queue payload.
- Retried on reconnect. UNIQUE on `payments.job_id` and optimistic locking prevent
  double-application.
- 60-second undo countdown runs client-side from queue submission.
- Show "pending sync" indicator while awaiting server confirmation.

---

## Notification Centre

- In-app only — no push, no email.
- All notification rows carry `organization_id`.
- Deduplication via partial unique indexes on
  `(organization_id, event_type, job_id, recipient_*)`.
- Retried workers must not produce duplicate rows.

| Event | Owner | Office Staff | Technician | Dealer |
|---|---|---|---|---|
| New dealer job submitted | ✓ | ✓ | — | — |
| Job assigned | — | — | ✓ | — |
| Dealer cancellation request | ✓ | ✓ | — | — |
| Cancellation request outcome | — | — | — | ✓ |
| Job unacknowledged | ✓ | ✓ | — | — |
| No-show flagged | ✓ | ✓ | — | — |
| Repeat/frequent complaint | ✓ | ✓ | — | — |
| Third revisit reached | ✓ | ✓ | — | — |

---

## Audit Trail (job_timeline)

Append-only and organization-scoped. Every row carries `organization_id`. Rows are never
updated or deleted.

Required fields: `organization_id`, `event_type`, `actor_user_id` OR `actor_dealer_id` (or
`event_type = 'system_event'` for workers), `previous_value` (JSONB), `new_value` (JSONB),
`reason` (when applicable), `occurred_at`.

If an action doesn't produce a timeline entry, it is not auditable — always log it.

---

## Analytics

- Precomputed, not live. Dashboards query `analytics_*_daily` tables.
- All analytics tables carry `organization_id`. One org's analytics are never visible to another.
- Workers are idempotent: track processed event IDs in `analytics_processed_events`, skip on
  retry. Workers receive `organization_id` in the job payload.
- Cancelled jobs excluded from resolution/completion rates, included in volume counts.
- `avg_star_rating` in `analytics_technician_daily` is NULL when
  `system_config.customer_review_mode = 'off'` for the current org.

---

## Scheduling Conflict Detection

Check for overlapping scheduled jobs within the **same organization** before confirming any
assignment. Surface a warning (not a hard block), require explicit acknowledgment, log to
`scheduling_conflicts` and `job_timeline` with `scheduling_conflict_ack` and
`organization_id`.

---

## Dealer Network

- Dealers are **organization-scoped** — a dealer belongs to exactly one organization.
- Dealers can view only their own org's submissions. No cross-org visibility.
- Cancellation rules:
  - Dealers can withdraw directly only in the initial state (`new` / `pending_schedule`).
  - Beyond initial state: `cancellation_requested` → requires office staff or owner approval.
  - A rejected request cannot be resubmitted on the same job.

---

## NestJS Module Boundaries

Each domain is isolated in its own NestJS module. Do not import domain services across module
boundaries except through clearly defined interfaces. Modules:

`platform` | `organizations` | `jobs` | `revisits` | `payments` | `users` | `brands` |
`dealers` | `analytics` | `notifications` | `settings`

Apply `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)` at the controller level on every
tenant-scoped route. Platform routes use `@UseGuards(PlatformAdminGuard)` instead.

---

## Test Requirements (All Phases)

Every phase (0 through 10) must ship with automated tests before it is considered complete.
Treat missing tests as an incomplete implementation.

### Mandatory test categories per phase

- **Unit tests:** service-layer rules, validators, state transitions, role checks.
- **Integration tests:** controller + guard + DB interactions for tenant-scoped routes.
- **Tenant isolation tests:** verify org A cannot read/write org B data in every new feature.
- **Regression tests:** preserve prior phase behavior when adding new phase functionality.

### Minimum phase coverage

- **Phase 0:** token matrix tests (`user`, `dealer`, `platform_admin`), guard separation,
  organization bootstrap transaction rollback tests.
- **Phase 1:** job creation validation, VCID resolution paths, exactly-one linkage timeline test,
  cross-org brand/dealer rejection tests.
- **Phase 2:** allowed/disallowed status transitions, optimistic-lock 409 tests,
  rollback/override permission tests.
- **Phase 3:** cross-org technician assignment rejection, conflict detection scoping,
  acknowledgment logging tests.
- **Phase 4:** offline queue idempotency tests, undo window enforcement tests,
  payment+status atomic rollback tests.
- **Phase 5:** one-payment-per-job concurrency tests, split payment authority tests,
  retain-or-void enforcement tests.
- **Phase 6:** revisit creation/validation tests, third-revisit chronic trigger tests,
  punctuality/no-show config-driven tests.
- **Phase 7:** notification dedup tests, repeat/frequent complaint detection scoping tests,
  owner dashboard org-filter tests.
- **Phase 8:** analytics idempotency tests, worker org-scoping tests,
  dealer visibility and cancellation-rule tests.
- **Phase 9:** office portal search scoping tests, rollback audit tests,
  cancellation approval scope tests.
- **Phase 10:** review token/org binding tests, review-mode isolation tests,
  `avg_star_rating` NULL behavior tests when mode is `off`.

### Execution and quality gates

- Run tests for the changed module(s) locally before pushing.
- Run at least one broader suite (or full suite) before merging phase-complete work.
- Any bug fix must add a failing test first, then implementation, then passing result.
- PRs implementing phase work must include a short test evidence section
  (commands run + passing summary).

---

## Key Constraints to Never Violate

1. **Every query against a tenant-scoped table must include `organization_id`.**
2. **`organization_id` always comes from the JWT — never from client input.**
3. **No job can exist without** `type`, `status`, `brand_id`, `source`, and `organization_id`.
4. **Every job must have a VCID** — linked or newly generated — before saving. VCID lookup is
   scoped to the same org.
5. **Complaint fields must be null on installations** and vice versa.
6. **All FK references within a tenant (technician, brand, dealer, payment method) must belong
   to the same organization.** Enforce at the service layer.
7. **Revisits cannot exist without a parent complaint job in the same org.**
8. **Payments cannot exist without a job.**
9. **Brands and payment methods cannot be deleted** — only deactivated.
10. **VCID is never shown in the UI** under any circumstance.
11. **`trg_validate_job_status` enforces per-type status validity at the DB level** — service-layer
    validation must also exist as the first line of defence.
12. **Owner status reversal outside the undo window with an existing payment requires a
    retain-or-void decision.** This cannot be bypassed.
13. **Cross-tenant data access is never permitted at the application layer.** Platform admin
    cross-org operations use dedicated, separately guarded platform endpoints only.
