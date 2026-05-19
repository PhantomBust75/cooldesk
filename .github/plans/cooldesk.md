# CoolDesk — Development Plan

19 modules across 11 build phases. Phase 0 establishes the multi-tenant foundation that every
subsequent phase depends on. Phases 1–10 cover all 19 core and optional modules. Full tenant
isolation is enforced from the first line of code.

## Detailed Phase Files

Use these execution-ready files for implementation tracking:

- [Phase 00 — Multi-Tenant Foundation](./phase-00-multi-tenant-foundation.md)
- [Phase 01 — Job Creation & Customer Identity](./phase-01-job-creation-customer-identity.md)
- [Phase 02 — Installation & Complaint Lifecycles](./phase-02-lifecycles-status-transitions.md)
- [Phase 03 — Assignment & Scheduling Conflicts](./phase-03-assignment-scheduling-conflicts.md)
- [Phase 04 — Technician PWA & 60-Second Undo](./phase-04-technician-pwa-undo.md)
- [Phase 05 — Payments](./phase-05-payments.md)
- [Phase 06 — Revisits & Punctuality](./phase-06-revisits-punctuality.md)
- [Phase 07 — Notifications & Owner Dashboard](./phase-07-notifications-dashboard.md)
- [Phase 08 — Analytics & Dealer Network](./phase-08-analytics-dealer-network.md)
- [Phase 09 — Office Staff Portal](./phase-09-office-staff-portal.md)
- [Phase 10 — Customer Reviews (Optional)](./phase-10-customer-reviews.md)

---

## Phase 0 — Multi-Tenant Foundation

**Goal:** Organizations exist. Auth is tenant-scoped. No tenant can touch another's data.
Everything built after this phase sits on top of it.

### Schema
- Create `organizations` table:
  ```sql
  CREATE TABLE organizations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE, -- used for subdomain routing
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- Create `platform_admins` table (separate from `users` — platform staff only):
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
- Add `organization_id UUID NOT NULL REFERENCES organizations(id)` to every tenant-scoped
  table before any other columns are added. Tables in scope: `users`, `dealers`,
  `dealer_credentials` (via dealers FK), `brands`, `jobs`, `job_units`, `job_assignments`,
  `revisits`, `revisit_assignments`, `job_cancellation_requests`, `payments`,
  `payment_methods`, `virtual_customers`, `customer_phones`, `job_timeline`, `notifications`,
  `scheduling_conflicts`, `analytics_technician_daily`, `analytics_business_daily`,
  `analytics_brand_daily`, `analytics_dealer_daily`, `customer_reviews`
- Update `system_config` to composite PK `(organization_id, key)`:
  ```sql
  CREATE TABLE system_config (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    key             TEXT NOT NULL,
    value           TEXT NOT NULL,
    updated_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, key)
  );
  ```
- Update `seed_system_config` to accept `p_org_id UUID` and seed per organization
- Update all composite indexes to lead with `organization_id`
- Update notification dedup indexes:
  `UNIQUE (organization_id, event_type, job_id, recipient_user_id) WHERE recipient_user_id IS NOT NULL`
  and equivalent for `recipient_dealer_id`

### Auth
- Implement JWT auth for `users`: token payload carries `{ sub, organization_id, role }`
- Implement JWT auth for `dealers`: token payload carries `{ sub, organization_id, type: 'dealer' }`
- Implement JWT auth for `platform_admins`: token payload carries `{ sub, type: 'platform_admin' }`
  — entirely separate signing secret and guard
- Build `TenantGuard`:
  - Extracts `organization_id` from the verified JWT
  - Confirms the `organization_id` matches an active, non-deleted org in the DB
  - Attaches `{ organizationId, userId, role }` to the `RequestContext`
  - Rejects any request where `organization_id` is missing or the org is inactive
- Build `RolesGuard`: reads `role` from `RequestContext` (not from the token directly after
  `TenantGuard` runs), compares against the `@Roles(...)` decorator
- Build `PlatformAdminGuard`: separate guard for platform-only endpoints; rejects all
  user/dealer tokens regardless of role
- Apply `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)` to every tenant-scoped controller
- Apply `@UseGuards(PlatformAdminGuard)` to every platform controller
- **Never apply both guards to the same controller**

### Organization management (platform admin only)
- `POST /platform/organizations` — create org, seed `system_config`, create the first `owner`
  user in one transaction
- `PATCH /platform/organizations/:id` — activate / deactivate
- `GET /platform/organizations` — list all orgs with counts (jobs, users, active status)

### ConfigService
- Build `ConfigService` that accepts `organizationId` and reads thresholds from `system_config`
- All other modules inject `ConfigService` and pass the current org's ID — never read
  `system_config` directly in business logic

### Done when
- A JWT for org A cannot access any endpoint scoped to org B
- A dealer JWT is rejected on user-role routes and vice versa
- A platform admin JWT is rejected on all tenant routes
- Creating an org produces a seeded `system_config` and a first `owner` user in one transaction
- Every DB query in the codebase includes `organization_id` in the WHERE clause

---

## Phase 1 — Job Creation & Customer Identity

**Goal:** A job can be created within an org with a valid VCID. Customer identity linkage is
org-scoped.

### Tasks
- Create DDL for `jobs`, `job_units`, `job_cancellation_requests` with `organization_id` on all
- Create `trg_validate_job_status` trigger
- Implement service-layer status validation as the first line of defence
- Build VCID resolution on job creation, scoped to `organization_id`:
  - Look up `customer_phones WHERE phone = :phone AND organization_id = :org_id`
  - If match found: surface "Link to existing customer?" prompt
  - If dismissed: generate new VCID, log `customer_link_dismissed` to `job_timeline`
  - If confirmed: link to existing VCID, log `customer_linked`
  - Also fire on name + address partial match
- Enforce all job creation constraints (type, status, brand_id, source, organization_id present;
  complaint fields null on installations; brand and dealer belong to the same org)
- Build `POST /jobs` (office_staff, owner) and `GET /jobs/:id` (role-scoped)
- All queries include `organization_id = ctx.organizationId`

### Done when
- A job saved without `organization_id` is rejected at the DB level (NOT NULL)
- A brand from a different org cannot be assigned to a job (service-layer check)
- VCID lookup never returns a match from another org
- Every job creation produces a `customer_linked` or `customer_link_dismissed` timeline entry

---

## Phase 2 — Installation & Complaint Lifecycles

**Goal:** Both job types move through their full status flows with proper role enforcement.

### Tasks
- Build `PATCH /jobs/:id/status` with transition validation (service layer + DB trigger)
- All status update queries include `organization_id = ctx.organizationId AND version = :v`
- Implement optimistic locking (HTTP 409 on version mismatch)
- Implement office staff one-state rollback (pre-completion only, mandatory reason, timeline log)
- Implement owner status override (any valid status for the job's type)
- Log every transition to `job_timeline` with `organization_id`
- Build cancellation for direct jobs (mandatory reason, log `cancellation`)
- Owner can reopen cancelled jobs (log `reopened`)
- Build `GET /jobs` with filters: status, type, brand, technician, date range, source —
  all scoped to `organization_id`

### Done when
- A complaint job cannot enter an installation-only status
- A technician cannot roll a job backward
- An office staff rollback on `completed` is rejected
- Every transition produces a `job_timeline` row with `organization_id`

---

## Phase 3 — Technician Assignment & Scheduling Conflicts

**Goal:** Jobs can be assigned within an org. Technicians from other orgs cannot be assigned.

### Tasks
- Create DDL for `job_assignments`, `revisit_assignments`, `scheduling_conflicts` with
  `organization_id` on all
- Assignment service validates that `technician_id` belongs to the same `organization_id` as
  the job before proceeding
- On assignment: deactivate previous active row, insert new active row, log `assignment` or
  `reassignment`, dispatch `job_assigned` notification
- Scheduling conflict detection scoped to `organization_id`:
  - Check overlapping `scheduled_at` for the same technician **within the same org only**
  - Return warning payload; require `acknowledgeConflict: true` to proceed
  - On acknowledgment: insert into `scheduling_conflicts` (with `organization_id`), log
    `scheduling_conflict_ack` to `job_timeline`
- Build `POST /jobs/:id/acknowledge` (technician only) — validates job belongs to same org

### Done when
- Assigning a technician from a different org is rejected at the service layer
- Conflict detection only considers jobs within the same org
- Acknowledgment produces both a `scheduling_conflicts` row and a timeline entry, both
  carrying `organization_id`

---

## Phase 4 — Technician Mobile View & 60-Second Undo

**Goal:** PWA field interface with offline sync. Undo window is org-config-driven.

### Tasks
- Configure Next.js PWA (service worker, app shell caching)
- Build technician job list and job detail view (org-scoped; technician sees own assigned jobs
  only)
- Implement browser sync queue:
  - Queue payload includes `organization_id`
  - Transition + payment queued as single atomic entry
  - Retry on reconnect; show "pending sync" indicator
- Implement 60-second undo window:
  - Read duration from `system_config.undo_window_seconds` for the current org at page load
  - Countdown starts on the device at queue submission
  - Undo within window: dequeue entry, revert UI
  - Special rollback: `needs_revisit` → delete revisit record + clear amber alert;
    `completed` / `resolved` → roll back payment atomically
- Arrival logging: compare `actual_arrival` to `scheduled_at` +
  `system_config.punctuality_grace_period_mins` for the current org

### Done when
- An offline transition submitted on reconnect does not double-apply
- Undo after 60 seconds is blocked on the device
- `needs_revisit` undo clears the amber alert immediately
- Undo duration correctly reflects the org's config value, not a hardcoded constant

---

## Phase 5 — Payments

**Goal:** Payment recorded atomically with job completion. Split authority enforced per org.

### Tasks
- Create DDL for `payment_methods` and `payments` with `organization_id`
- `payment_methods` are org-scoped — an org's payment methods are not visible to other orgs
- Implement atomic payment + status transaction (see instructions for SQL pattern); all rows
  carry `organization_id`
- Enforce split payment authority at the service layer
- Optimistic locking on `payments` updates includes `organization_id`
- Log all payment edits to `job_timeline` with `organization_id`, previous value, new value
- Implement owner retain-or-void prompt — mandatory, cannot be bypassed
- `GET /payment-methods` scoped to org; owner-only `POST` / `PATCH` (deactivate only)

### Done when
- Two concurrent completions for the same job result in one payment row
- An office staff attempt to change `amount` is rejected
- Owner reversal without a retain-or-void decision is rejected
- Payment method from a different org cannot be used on a job

---

## Phase 6 — Revisit Track & Punctuality

**Goal:** Unresolved complaints enter the revisit lifecycle. Punctuality tracked per org config.

### Tasks
- Create DDL for `revisits` and `revisit_assignments` with `organization_id`
- `needs_revisit` transition: mandatory reason selection, auto-create `revisits` row (with
  `organization_id`), raise amber alert, log `revisit_created`
- `trg_chronic`: when `sequence_number >= 3`, set `jobs.is_chronic = TRUE`, dispatch
  `third_revisit_reached` notification
- Revisit scheduling, assignment (validate technician belongs to same org), and outcome
  recording (all queries include `organization_id`)
- Punctuality: compare `actual_arrival` to `scheduled_at` + grace period from org's
  `system_config`; derive `visit_outcome`; auto-flag no-shows; dispatch `no_show_flagged`

### Done when
- `needs_revisit` without a reason is rejected
- Third revisit triggers `is_chronic` via trigger and notifies within the org only
- Grace period uses the org's config value, not a hardcoded default
- No-show flag is visible only to the affected org

---

## Phase 7 — Notifications, Repeat Alerts & Owner Dashboard

**Goal:** In-app notifications are org-scoped. Repeat/frequent detection uses org-scoped VCIDs.
Owner dashboard shows only the current org's data.

### Tasks
- Create DDL for `notifications` with `organization_id`
- Notification dispatch: all inserts include `organization_id`; dedup indexes include
  `organization_id` as the leading column
- Repeat complaint detection: query `jobs WHERE vcid = :vcid AND organization_id = :org_id`
  within the org's configured window — never cross-org
- Frequent complaint detection: same VCID + org scoping; update `virtual_customers` and
  dispatch within the org
- Owner dashboard: all counts and lists driven by `analytics_*_daily` filtered by
  `organization_id`; brand filter applies within the org only

### Done when
- A notification dispatched for org A is never visible to org B
- A retried dispatch does not duplicate a notification (dedup index catch)
- Repeat complaint detection cannot match a VCID from a different org
- Owner dashboard brand filter does not leak data from other orgs

---

## Phase 8 — Analytics & Dealer Network

**Goal:** Precomputed analytics are org-isolated. Dealer portal is live with full org scoping.

### Analytics (Modules 15–16)
- Create DDL for all `analytics_*_daily` tables and `analytics_processed_events` with
  `organization_id`
- Analytics worker: receives `organization_id` in job payload; queries unprocessed
  `job_timeline` events scoped to that org; UPSERTs into analytics tables with `organization_id`;
  marks events processed (idempotent)
- Technician performance scorecard and business-wide dashboard both query
  `analytics_*_daily WHERE organization_id = :org_id`
- All analytics filterable by date range and brand within the org; CSV export scoped to org

### Dealer Network (Modules 17–18)
- Dealer management (`POST /dealers`, `PATCH /dealers/:id`) scoped to org; owner only
- Dealer job submission portal: all submitted jobs carry `organization_id` from the dealer's JWT
- Phone number VCID lookup on dealer submission scoped to `organization_id`
- Dealer job history: `WHERE dealer_id = :dealer_id AND organization_id = :org_id` — a dealer
  cannot see submissions from a different org even if they somehow obtained another org's job ID
- Dealer cancellation flow: `job_cancellation_requests` carries `organization_id`; approval
  notifications scoped to org
- Dealer analytics section: all metrics scoped to `organization_id`

### Done when
- Analytics worker processing a timeline event from org A never writes to org B's analytics rows
- The same timeline event processed twice does not double-count
- Dealer JWT cannot retrieve a job that belongs to a different org
- A rejected cancellation request cannot be resubmitted (UNIQUE on `job_cancellation_requests.job_id`)

---

## Phase 9 — Office Staff Portal (Full)

**Goal:** Office staff portal is complete. All entry, lookup, scheduling, and conflict tools are
org-scoped.

### Tasks
- Quick-entry form for any job type (all fields validated against org's brands, technicians)
- Customer lookup: `search by name or phone WHERE organization_id = :org_id` — results are
  strictly within the org; no cross-org name collisions are shown
- Unified job list (direct + dealer-submitted, source-tagged), filtered to org
- Pending Schedule queue for dealer-submitted installation jobs
- Technician workload visibility within the org
- One-state rollback with mandatory reason logging
- Dealer cancellation request approval (approve / reject), scoped to org
- Revisit slot management
- Amber revisit-pending alert cards

### Done when
- Customer lookup cannot surface a result from another org
- Office staff actions produce timeline entries with `organization_id`
- Approving a cancellation request only affects jobs within the same org

---

## Phase 10 — Customer Reviews (Optional Module 19)

**Goal:** Post-completion reviews are org-configured and fully isolated.

### Tasks
- Create DDL for `customer_reviews` with `organization_id`
- Review mode read from `system_config.customer_review_mode WHERE organization_id = :org_id`
- Review links are org-scoped and job-specific; unique `review_token` per job
- `expires_at` generated column: `link_generated_at + INTERVAL '48 hours'`
- Customer submits from own device; technician never handles the rating
- Owner review dashboard: `WHERE organization_id = :org_id`
- Low-rated flag and `avg_star_rating` analytics scoped to org
- Owner can switch mode at any time; applies to new completions only within the org

### Done when
- A review token from org A cannot be submitted against a job in org B
- Mode switch in one org has no effect on any other org
- `avg_star_rating` in analytics is NULL when mode is `off` for that org

---

## Cross-Cutting Rules (Apply in Every Phase)

- **`organization_id` on every row** in a tenant-scoped table — set from `RequestContext`,
  never from client input
- **Every WHERE clause includes `organization_id`** — code review should treat a missing
  `organization_id` filter the same as a missing auth guard
- **FK cross-org validation at the service layer** — a brand, technician, or dealer assigned to
  a job must belong to the same org; the DB FK alone does not prevent cross-org reference
- **Never hardcode thresholds** — always read from `ConfigService` with the current `organizationId`
- **Never expose VCID in any UI component**
- **Soft deletes only** — `is_deleted = TRUE`, never `DELETE FROM`
- **Every significant action gets a `job_timeline` row** with `organization_id`
- **Analytics workers are idempotent** — skip already-processed event IDs
- **Platform admin operations live in the `platform` module** and never share guards,
  services, or repositories with tenant modules
