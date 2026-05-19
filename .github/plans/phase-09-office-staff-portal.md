# Phase 09 — Office Staff Portal (Full)

## Objective

Complete office operations tools for intake, scheduling, customer lookup, approvals, and conflict management with strict org scoping.

## Scope

- Quick-entry form for all job types
- Customer lookup (name/phone, org-scoped)
- Unified job list and pending-schedule queue
- Technician workload visibility
- One-step rollback with reason logging
- Dealer cancellation request approval/rejection
- Revisit slot management and amber alert cards
- VCID conflict policy for dealer-submitted phones

## Implementation Backlog

### 1) Quick Entry Form

- Single form supporting installation and complaint creation.
- Brand dropdown: active brands scoped to current org only.
- Technician dropdown: active technicians scoped to current org only.
- Validates all fields against org data before submit; no cross-org entity references accepted.
- Feeds into the same job creation service as Phase 01 (VCID resolution, timeline events, repeat detection).

### 2) Customer Lookup

Search by name (Levenshtein) or phone (exact) with `organization_id = :orgId` on every query.

```sql
SELECT cp.phone, vc.id AS vcid, j.customer_name, j.address
FROM customer_phones cp
JOIN virtual_customers vc ON vc.id = cp.vcid
JOIN jobs j ON j.vcid = vc.id AND j.organization_id = :orgId
WHERE (cp.phone = :phone OR j.customer_name ILIKE :namePattern)
  AND cp.organization_id = :orgId  -- or scoped via jobs join
ORDER BY j.created_at DESC
LIMIT 20;
```

**Hard rule:** Returns no results from other orgs. Identical names across orgs are invisible to each other.

**VCID conflict policy (Residual Gap 17.5):** When a dealer-submitted phone matches an existing VCID from another dealer in the same org, the system flags the job internally for office staff VCID review. Dealer receives no indication. Office staff sees a review prompt on the job detail. This is fully internal — confirm policy before implementation.

### 3) Operational Views

**Unified job list:**
- Both `direct` and `via_dealer` source jobs in one list with a source tag.
- All filters (`status`, `type`, `brand`, `technician`, `date range`, `source`) scoped to `organization_id`.
- Uses `(status, type) WHERE is_deleted = FALSE` partial index for filter queries.

**Pending Schedule queue:**
- Dealer-submitted installation jobs at `status = 'pending_schedule'` for current org.
- Staff sets `scheduled_at` and optionally assigns a technician in the same action.
  - With technician: `status = 'pending_schedule' → scheduled → assigned` (two timeline events).
  - Without technician: `status = 'pending_schedule' → scheduled` (one timeline event). Assign separately via assignment flow.

**Technician workload view:**
- Active assignments per technician within the org; `scheduled_at` for upcoming jobs.
- Conflict context: if a technician has acknowledged conflicts, show indicator.

### 4) One-Step Rollback (Flow 8)

Rollback state map (see also Phase 02 §3):

| Current status | Rolls back to |
|----------------|---------------|
| `in_transit` | `acknowledged` |
| `in_process` | `in_transit` |
| `acknowledged` | `assigned` |
| `revisit_scheduled` | `needs_revisit` (amber alert re-raised) |
| `assigned` | `new` (complaint) or `scheduled` (installation) |

- Blocked on `completed`, `resolved`, `resolved_on_revisit` — owner only.
- Blocked on `cancelled` — owner reopen only.
- Mandatory reason field; write `status_rollback` timeline event with reason, actor, previous and new status.
- Version guard on UPDATE prevents stale write race with active technician.
- Rolling back from `needs_revisit` does **not** delete the revisit row (unlike 60-second undo). Amber alert remains active. Confirm with product owner if deletion is required.

### 5) Cancellation Request Decisions (Flow 6.4)

- Office staff opens flagged job with `status = 'cancellation_requested'`.
- Views cancellation request details and dealer reason.
- **Approve:** update request to `approved`, update job to `cancelled`, notify dealer, write `cancellation_approved` timeline event.
- **Reject:** update request to `rejected`, restore job to pre-request status, notify dealer, write `cancellation_rejected` timeline event. Technician buttons re-enabled.
- Auto-rejection of stale requests: if job has advanced while request was pending, service layer auto-rejects with `system_event` timeline entry (see Phase 02 §7).
- After rejection, dealer may submit a new request (UNIQUE(job_id) removed in v2.2; partial index allows re-request after resolution).

### 6) Revisit Slot Management

- View all active amber alert cards (`status = 'needs_revisit'` in org).
- For each: schedule revisit date/time, assign technician (validates same org), confirm → status `revisit_scheduled`, amber cleared.
- View revisit backlog with sequence numbers and chronic indicators.
- All revisit queries include `organization_id`.

### 7) Scheduling and Rescheduling

When rescheduling a visit (`scheduled_at` change before arrival):
- Write `job_timeline` note event with `previous_value: {scheduled_at: old}` and `new_value: {scheduled_at: new}` before the UPDATE.
- Set `visit_outcome = 'rescheduled'` on the `jobs` or `revisits` row.
- **Note (Residual Gap 17.4):** There is no schedule history table. The `job_timeline` note is the only audit trail for prior schedule slots. If full slot history is required, add a `rescheduled` event type to `timeline_event_type` enum.

## Required Test Coverage

- Customer lookup returns no results from other orgs, even for identical names or phones.
- Quick entry validates brand/technician against current org only.
- Rollback blocked on `completed` / `resolved`; shows correct error message.
- Rollback writes `status_rollback` event with reason and actor.
- Cancellation approval updates both `job_cancellation_requests` and `jobs` in one transaction.
- Rejection restores correct pre-request status; technician buttons re-enabled.
- Pending-schedule queue shows only dealer-submitted installation jobs for current org.
- Scheduling technician cross-org rejected at service layer.

## Exit Criteria

- Office workflow supports full daily operation end-to-end.
- All search, list, and action operations are tenant-safe.
- Alerts, approvals, and audit logs provide complete operational traceability.

## Risks and Mitigations

- **Risk:** VCID conflict from different dealers creating duplicate customers.
  - **Mitigation:** Flag for internal review only; office staff resolves via customer lookup flow. Never expose VCID in UI.
- **Risk:** Rollback race condition while technician is actively syncing.
  - **Mitigation:** Optimistic lock version guard on all UPDATE operations catches concurrent modification.
