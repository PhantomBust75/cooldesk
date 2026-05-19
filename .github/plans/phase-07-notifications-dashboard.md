# Phase 07 — Notifications, Repeat Alerts & Owner Dashboard

## Objective

Deliver in-app notifications and owner insights with strict org scoping, duplicate-safe dispatching, and `chk_read_meta` enforcement.

## Scope

- `notifications` table with org scoping and 4 partial dedup indexes
- `chk_read_meta` constraint on `read_at`
- Repeat/frequent complaint detection by org-scoped VCID (on every new complaint INSERT)
- Owner dashboard driven by precomputed `analytics_*_daily` tables
- Notification centre UI with read/unread state and badge count

## Implementation Backlog

### 1) Notifications Schema (Schema v2.2 §B.9)

```sql
CONSTRAINT chk_recipient
  CHECK (recipient_user_id IS NOT NULL OR recipient_dealer_id IS NOT NULL),
CONSTRAINT chk_read_meta
  CHECK (is_read = FALSE OR read_at IS NOT NULL)
```

`chk_read_meta` prevents `is_read = TRUE` rows with no legible timestamp. Setting `is_read = TRUE` must always include `read_at = NOW()`.

**Deduplication — 4 partial indexes** (split because PostgreSQL treats NULLs as distinct in unique indexes; a single index on nullable `job_id` would not deduplicate system-level notifications):

```sql
-- User recipient, job-scoped (e.g. job_assigned)
CREATE UNIQUE INDEX idx_notif_dedup_user_job
  ON notifications (event_type, job_id, recipient_user_id)
  WHERE recipient_user_id IS NOT NULL AND job_id IS NOT NULL;

-- User recipient, non-job-scoped (e.g. frequent_complaint_detected)
CREATE UNIQUE INDEX idx_notif_dedup_user_nojob
  ON notifications (event_type, recipient_user_id)
  WHERE recipient_user_id IS NOT NULL AND job_id IS NULL;

-- Dealer recipient, job-scoped
CREATE UNIQUE INDEX idx_notif_dedup_dealer_job
  ON notifications (event_type, job_id, recipient_dealer_id)
  WHERE recipient_dealer_id IS NOT NULL AND job_id IS NOT NULL;

-- Dealer recipient, non-job-scoped
CREATE UNIQUE INDEX idx_notif_dedup_dealer_nojob
  ON notifications (event_type, recipient_dealer_id)
  WHERE recipient_dealer_id IS NOT NULL AND job_id IS NULL;
```

All inserts use `ON CONFLICT DO NOTHING` for retry-safe dispatch.

### 2) Notification Events and Recipients (Flow 14 / User Flows §16.1)

| Event | Owner | Office Staff | Technician | Dealer |
|-------|-------|--------------|------------|--------|
| `dealer_job_submitted` | ✓ | ✓ | — | — |
| `job_assigned` | — | — | ✓ | — |
| `cancellation_request_submitted` | ✓ | ✓ | — | — |
| `cancellation_request_outcome` | — | — | — | ✓ |
| `job_unacknowledged` | ✓ | ✓ | — | — |
| `no_show_flagged` | ✓ | ✓ | — | — |
| `repeat_complaint_detected` | ✓ | ✓ | — | — |
| `frequent_complaint_detected` | ✓ | ✓ | — | — |
| `third_revisit_reached` | ✓ | ✓ | — | — |

**Delivery:** In-app notification centre only. No push notifications. Persistent with read/unread state.

All notification INSERT operations include `organization_id` from `RequestContext`.

### 3) Repeat/Frequent Detection (Flow 6.5)

Runs on every new complaint INSERT (not as a background job — inline on job creation):

**Repeat detection:**
```sql
SELECT COUNT(*) FROM jobs
WHERE vcid = :vcid
  AND type = 'complaint'
  AND organization_id = :orgId
  AND created_at > NOW() - (:windowDays || ' days')::INTERVAL;
```
`windowDays` = `ConfigService.get(orgId, 'repeat_complaint_window_days')` (default 30).
If count >= 1: `jobs.is_repeat = TRUE`, `repeat_window_days_used` recorded.
Dispatch `repeat_complaint_detected` → owner + office staff in same org.

**Frequent detection:**
Same VCID + org scope; threshold from `ConfigService.get(orgId, 'frequent_complaint_threshold')` within `ConfigService.get(orgId, 'frequent_complaint_window_days')`.
If threshold met:
- `UPDATE virtual_customers SET is_frequent = TRUE, frequent_flagged_at = NOW()`
- `UPDATE jobs SET is_frequent = TRUE, frequent_threshold_used, frequent_window_used`
- Dispatch `frequent_complaint_detected` → owner + office staff in same org.

Cross-org VCID lookup is impossible: all queries include `organization_id = :orgId`.

### 4) Notification Centre UI (Flow 14.3)

- Badge count from `SELECT COUNT(*) FROM notifications WHERE recipient_user_id = :userId AND is_read = FALSE AND organization_id = :orgId`
- Listing index: `(recipient_user_id, is_read, created_at DESC)` — also exists for dealer recipient
- Clicking a notification navigates to the relevant job
- `UPDATE notifications SET is_read=TRUE, read_at=NOW() WHERE id = :notifId AND organization_id = :orgId`

### 5) Owner Dashboard

All counts and lists read from `analytics_*_daily` filtered by `organization_id`. Queries never touch `jobs` directly for aggregation.

Dashboard data includes:
- Business-wide metrics from `analytics_business_daily`
- Per-technician scorecards from `analytics_technician_daily`
- Brand performance from `analytics_brand_daily`
- Chronic job indicator on job cards (from `jobs.is_chronic`)
- Amber revisit-pending alert cards (from `jobs.status = 'needs_revisit'`)
- Low-rated reviews flag (from `customer_reviews.is_low_rated WHERE is_low_rated = TRUE`)

Brand filter applies only within the org — cannot leak aggregates from other orgs.

**Analytics scope by role (Flow 15.2):**

| Role | Analytics access |
|------|-----------------|
| Owner | Full: all technician scorecards, business-wide, dealer, brand |
| Office Staff | Operational views same as owner |
| Technician | None |
| Dealer | None; read-only job history only |

## Required Test Coverage

- Notification for org A never visible to recipient in org B.
- Retry dispatch with same `(event_type, job_id, recipient_*)` does not create duplicate (ON CONFLICT DO NOTHING).
- Non-job-scoped notification dedup works for `frequent_complaint_detected` (no `job_id`).
- `is_read = TRUE` with NULL `read_at` rejected by `chk_read_meta`.
- Repeat complaint detection cannot match VCID from another org.
- Frequent detection updates `virtual_customers.is_frequent` only within org.
- Brand filter on owner dashboard returns only same-org analytics.

## Exit Criteria

- Notification centre is reliable, idempotent, and delivery-safe.
- Repeat/frequent alerts are accurate within org boundaries and config-driven.
- Dashboard reflects org-only analytics and filters correctly.

## Risks and Mitigations

- **Risk:** Single dedup index on nullable `job_id` silently allows duplicates for system-level events.
  - **Mitigation:** 4 partial indexes split by job-scoped vs non-job-scoped per recipient type (implemented in v2.2).
- **Risk:** Repeat detection running as background job misses inline creation timing.
  - **Mitigation:** Detection runs synchronously on `POST /jobs`; background job is not needed for this flow.
