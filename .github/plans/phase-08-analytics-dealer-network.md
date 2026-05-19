# Phase 08 — Analytics & Dealer Network

## Objective

Implement idempotent org-scoped analytics workers with 90-day event retention and complete dealer-facing workflows including credentials, submission, history, and cancellation.

## Scope

- `analytics_*_daily` tables with `organization_id`
- `analytics_processed_events` ledger with `ON DELETE RESTRICT` and 90-day purge
- `trg_validate_technician_role` trigger on `analytics_technician_daily`
- Idempotent worker pipeline (timeline → analytics)
- `dealer_credentials` table (v2 schema)
- Dealer management, submission, history, and cancellation request flow
- Dealer analytics scoped to org

## Implementation Backlog

### 1) Analytics Schema (Schema v2.2 §B.11–B.12)

`analytics_processed_events`:
- FK to `job_timeline(id)` uses `ON DELETE RESTRICT` — **not CASCADE**.
  - If a timeline row were deleted (emergency surgery), the analytics team must manually audit rollup tables before removing the processed-event record. Silent CASCADE would allow re-processing and double-counting.
- `timeline_event_id UUID NOT NULL UNIQUE` — idempotency check is O(log n) existence lookup.

```sql
CREATE UNIQUE INDEX idx_ape_timeline_event
  ON analytics_processed_events (timeline_event_id);

CREATE INDEX idx_ape_processed_at
  ON analytics_processed_events (processed_at DESC);
```

**90-day rolling retention:**
```sql
CREATE OR REPLACE FUNCTION fn_purge_analytics_processed_events()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM analytics_processed_events
  WHERE processed_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

Schedule via `pg_cron` at `0 2 * * *` (02:00 UTC). If pg_cron is unavailable, invoke via `@nestjs/schedule @Cron('0 2 * * *')` in the analytics module. Retention period adjustable in the function body — no migration required.

`analytics_technician_daily` includes `trg_validate_technician_role` (BEFORE INSERT OR UPDATE):
- Rejects rows where `technician_id` does not have `role = 'technician'` in `users`.
- Prevents non-technician user IDs from polluting the technician scorecard.

### 2) Analytics Worker Pipeline (Flow 13 / E.3 Pattern)

Worker payload must include `organization_id`.

**Fetch unprocessed events (batch of 500):**
```sql
SELECT jt.id, jt.event_type, jt.job_id, jt.occurred_at
FROM job_timeline jt
WHERE jt.event_type IN ('status_transition', 'payment_recorded')
  AND jt.organization_id = :orgId
  AND NOT EXISTS (
    SELECT 1 FROM analytics_processed_events ape
    WHERE ape.timeline_event_id = jt.id
  )
ORDER BY jt.occurred_at
LIMIT 500;
```

**UPSERT into analytics tables:**
```sql
INSERT INTO analytics_technician_daily
  (organization_id, technician_id, date, complaints_resolved, total_payment_collected)
VALUES (:orgId, :technicianId, CURRENT_DATE, 1, :amount)
ON CONFLICT (technician_id, date) DO UPDATE
  SET complaints_resolved = analytics_technician_daily.complaints_resolved + 1,
      total_payment_collected = analytics_technician_daily.total_payment_collected + EXCLUDED.total_payment_collected,
      updated_at = NOW();
```

**Mark processed (idempotent):**
```sql
INSERT INTO analytics_processed_events (timeline_event_id, processed_at, organization_id)
VALUES (:eventId, NOW(), :orgId)
ON CONFLICT (timeline_event_id) DO NOTHING;
```

All analytics writes are org-scoped. A worker processing org A's events never writes to org B's rows.

### 3) Dealer Credentials (Schema v2.2 §B.3 — v2)

`dealer_credentials` is separated from the `dealers` business entity to support:
- Dealers without portal access (no credentials row required)
- Future OAuth/SSO without altering `dealers`

```sql
CREATE TABLE dealer_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     UUID NOT NULL UNIQUE REFERENCES dealers(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  last_login_at TIMESTAMPTZ,
  ...
);
```

`ON DELETE CASCADE`: credentials are owned by the dealer; deleting a dealer deletes credentials.
Migration note: add `dealer_credentials` to migration order after `dealers`.

### 4) Dealer Management (Owner Only)

- `POST /dealers` — creates dealer + `dealer_credentials` + `dealer_brands` in one transaction.
- `PATCH /dealers/:id` — activate/deactivate (`is_active`); historical data and brand links preserved.
- `PUT /dealers/:id/brands` — owner adds/removes brand links (`INSERT` or `DELETE` from `dealer_brands`).
- Dealer is always bound to one org; `organization_id` from `RequestContext`, never from request body.

### 5) Dealer Submission Portal (Flow 2)

Dealer JWT carries `{ sub, organization_id, type: 'dealer' }`. All job INSERTs use `organization_id` from dealer JWT.

- Dealer sees only brands linked in `dealer_brands` for their org.
- Phone number VCID lookup scoped to `organization_id` — dealer sees `New/Existing` indicator only, not internal VCID.
- Phone match flagged for office staff VCID review when new phone matches known customer pattern (internal only — see Residual Gap 17.5).
- All job history: `WHERE dealer_id = :dealerId AND organization_id = :orgId` — dealer cannot see jobs from another org even with a guessed job ID.

**Residual Gap 17.5 — VCID conflict visibility:** When a dealer submits a phone number matching an existing VCID from a different dealer, the system flags for internal office staff review only. Dealer receives no indication. This is the intended policy; confirm before implementation.

### 6) Dealer Cancellation Flow

- `INSERT job_cancellation_requests` with `organization_id`.
- Partial unique index `idx_cancel_req_one_pending` enforces at most one pending request per job.
- A new request is allowed after the previous is approved or rejected (UNIQUE(job_id) removed in v2.2).
- Approval notification (`cancellation_request_outcome`) scoped to the dealer's org only.
- Analytics: `analytics_dealer_daily` updated for submitted/cancelled jobs.

### 7) Dealer Analytics

`analytics_dealer_daily` tracks: `jobs_submitted`, `complaints_submitted`, `installations_submitted`, `resolved_count`, `avg_resolution_mins`, `pending_count` — all per org per dealer per day.

All analytics queries filtered by `WHERE organization_id = :orgId`.
CSV export is org-scoped; no cross-org data in export.

## Required Test Coverage

- Worker processing org A's timeline never writes to org B's `analytics_*_daily` rows.
- The same timeline event processed twice produces identical analytics rows (idempotency via ON CONFLICT).
- `analytics_processed_events` FK is RESTRICT — deleting a timeline row blocked if processed-event exists.
- `trg_validate_technician_role` rejects non-technician row INSERT on `analytics_technician_daily`.
- `fn_purge_analytics_processed_events` deletes rows older than 90 days; newer rows unaffected.
- Dealer JWT cannot retrieve a job from another org by ID.
- Rejected cancellation request allows a new request submission.
- Dealer submission VCID lookup returns no cross-org results.

## Exit Criteria

- Analytics are accurate, precomputed, and retry-safe.
- Dealer network operations are fully tenant-isolated.
- 90-day retention keeps `analytics_processed_events` performant without manual intervention.
- Dealer cancellation policies enforced end-to-end.

## Risks and Mitigations

- **Risk:** `analytics_processed_events` grows unbounded and degrades index performance.
  - **Mitigation:** 90-day purge via `fn_purge_analytics_processed_events`; pg_cron or NestJS scheduler; adjust window in function body only.
- **Risk:** ON DELETE CASCADE changed to RESTRICT on `analytics_processed_events` FK (v2.2 fix).
  - **Mitigation:** Any emergency deletion of a `job_timeline` row must be preceded by manual audit and deletion of the corresponding `analytics_processed_events` row; document in runbook.
