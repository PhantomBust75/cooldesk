# Phase 02 — Installation & Complaint Lifecycles

## Objective

Implement forward-only status transitions with role-based controls, rollback limits, optimistic locking, and full cancellation flows including dealer withdrawal and request lifecycle.

## Scope

- `PATCH /jobs/:id/status` — all transition paths for both job types
- Service-layer transition engine + DB trigger as second layer
- Version-based optimistic lock (HTTP 409 on mismatch)
- Office staff one-step rollback (pre-completion only)
- Owner full status override and cancelled-job reopen
- Direct cancellation (office staff / owner)
- Dealer direct withdrawal (initial state only)
- Dealer cancellation request and staff decision flow
- Auto-rejection of stale cancellation requests
- `GET /jobs` with org-scoped filters

## Implementation Backlog

### 1) Transition Engine

Define allowed transitions per job type:

**Installation:** `pending_schedule → scheduled → assigned → acknowledged → in_transit → in_process → completed | cancelled`

**Complaint:** `new → assigned → acknowledged → in_transit → in_process → resolved | needs_revisit → revisit_scheduled | cancelled`

`cancellation_requested` is reachable from any pre-terminal state on dealer jobs. `cancelled` is terminal. `resolved` and `resolved_on_revisit` are terminal.

Service layer validates: current status, target status, role permissions, and preconditions in that order. `trg_validate_job_status` is a DB-level second layer — both must be in place.

### 2) Optimistic Locking

All status updates must include the version guard:

```sql
UPDATE jobs
SET status = :newStatus, updated_at = NOW(), version = version + 1
WHERE id = :jobId
  AND organization_id = :orgId
  AND version = :expectedVersion
  AND is_deleted = FALSE;
```

`rowcount = 0` → throw `OptimisticLockException` → HTTP 409. Client re-fetches and re-presents.

### 3) Role-Specific Rules

| Actor | Allowed transitions | Notes |
|-------|---------------------|-------|
| Technician | Forward only (assigned jobs) | Cannot roll back; cannot cancel |
| Office Staff | Forward + one-step rollback (pre-completion) | Rollback requires mandatory reason |
| Owner | Any valid status for job type | Full override; can reopen cancelled |

**One-step rollback state map (Office Staff):**

| Current status | Rolls back to |
|----------------|---------------|
| `in_transit` | `acknowledged` |
| `in_process` | `in_transit` |
| `acknowledged` | `assigned` |
| `revisit_scheduled` | `needs_revisit` (amber alert re-raised) |
| `assigned` | `new` (complaint) or `scheduled` (installation) |

Blocked rollback targets: `completed`, `resolved`, `resolved_on_revisit` — owner-only.
Blocked rollback from: `cancelled` — owner reopen only.

> **Note (Residual Gap 17.3):** Rolling back from `needs_revisit` to `in_process` via office rollback does **not** delete the revisit record (unlike the 60-second undo window, which does). The revisit row persists as a historical record. Amber alert remains active. Confirm with product owner before implementation whether the revisit row should be deleted in this case.

Every rollback writes `status_rollback` event to `job_timeline` with previous status, reverted status, reason, and actor.

### 4) Direct Cancellation — Office Staff / Owner (Flow 6.1)

For any non-terminal, non-completed job:
- If `status = in_process`: show confirmation warning; staff must explicitly confirm.
- Enter mandatory cancellation reason.
- `UPDATE jobs SET status='cancelled', cancelled_at=NOW(), cancelled_by=:actorId, cancellation_reason=:text, version = version + 1`
- DB constraint `chk_cancel_meta` enforces `cancelled_by` and `cancellation_reason` are both non-null.
- Write `cancellation` timeline event.
- Job is excluded from operational queues but preserved in history. Soft-delete (`is_deleted`) is **not** set — cancellation is not deletion.

### 5) Dealer Direct Withdrawal — Initial State Only (Flow 6.2)

A dealer may withdraw directly **only** when the job is in its initial status:
- Complaint: `new`
- Installation: `pending_schedule`

Any status beyond initial requires a cancellation request (Flow 6.3).

Service-layer validates: `job.source = 'via_dealer'` AND `job.dealer_id = authenticatedDealerId` AND `status IN ('new', 'pending_schedule')`.

Sets `status = 'cancelled'`, writes `cancellation` timeline event with `actor_dealer_id`.

### 6) Dealer Cancellation Request (Flow 6.3)

For jobs beyond initial state:
- `INSERT job_cancellation_requests (job_id, requested_by_dealer_id, reason, status='pending')`
- The partial unique index `idx_cancel_req_one_pending` (WHERE status = 'pending') prevents two concurrent pending requests per job. A new request **is** allowed after the first is approved or rejected — the global UNIQUE(job_id) was removed in v2.2.
- `UPDATE jobs SET status='cancellation_requested', version++`
- Dispatch `cancellation_request_submitted` notification → owner + all office staff
- Write `cancellation_request` timeline event
- All technician action buttons are disabled while job is frozen

### 7) Staff/Owner Decision on Cancellation Request (Flow 6.4)

**Approve:**
- `UPDATE job_cancellation_requests SET status='approved', decided_by, decided_at` — `chk_decision_meta` enforced
- `UPDATE jobs SET status='cancelled', cancellation_reason = dealer reason, cancelled_at, cancelled_by, version++`
- Dispatch `cancellation_request_outcome` notification → dealer
- Write `cancellation_approved` timeline event

**Reject:**
- `UPDATE job_cancellation_requests SET status='rejected', decided_by, decided_at`
- `UPDATE jobs SET status = status held at time of request, version++`
- Dispatch `cancellation_request_outcome` → dealer
- Write `cancellation_rejected` timeline event
- Technician action buttons re-enabled; job resumes normal lifecycle

**Auto-rejection of stale requests (Residual Gap 17.7):** If the job's status has advanced past the status held at request time (e.g. via background worker or owner override), the service layer must auto-reject the cancellation request on every status transition check. Mark `status='rejected'` with a `system_event` in `job_timeline`. Implement as a service-layer check triggered on every status mutation, not as a separate background job.

### 8) Owner Reopen Cancelled Job (Flow 6.5)

- Owner enters mandatory reopen reason.
- Service queries `job_timeline` for the last `status_transition` event before the `cancellation` event to determine `last_pre_cancellation_status`.
- `UPDATE jobs SET status = last_pre_cancellation_status, cancelled_at=NULL, cancelled_by=NULL, cancellation_reason=NULL, version++`
- Write `reopened` timeline event with reason, actor, timestamp.

### 9) Query API

`GET /jobs` with filters (all scoped to `organization_id`):
- `status`, `type`, `brand_id`, `technician_id`, `dealer_id`, `source`, `date range (created_at / scheduled_at)`

Use partial indexes on `(status, type) WHERE is_deleted = FALSE` for dashboard filter queries.

## Required Test Coverage

- Complaint cannot transition into installation-only statuses (blocked by trigger + service).
- Technician cannot roll back any status.
- Office staff rollback on `completed` / `resolved` is denied.
- Version mismatch returns HTTP 409; subsequent attempt with correct version succeeds.
- Every successful transition writes a `job_timeline` row with `organization_id` and actor.
- Dealer withdrawal blocked when status is past initial state.
- Second pending cancellation request blocked by partial unique index.
- Second request after rejection is allowed.
- Auto-rejection writes `system_event` to timeline.
- Owner reopen restores exact pre-cancellation status.

## Exit Criteria

- Status movement is predictable, validated, and auditable for both job types.
- Concurrency collisions are safely rejected via optimistic lock.
- Role capabilities match the matrix in User Flows §1 exactly.
- Cancellation paths (direct, withdrawal, request) are fully implemented and isolated.

## Risks and Mitigations

- **Risk:** Race between technician sync and cancellation request freezing the job.
  - **Mitigation:** Server rejects queued transitions when `status = 'cancellation_requested'`; returns error on sync reconnect.
- **Risk:** Stale cancellation request not auto-rejected, allowing inconsistent state.
  - **Mitigation:** Every status transition checks for a pending cancellation request and auto-rejects it with a `system_event` log.
