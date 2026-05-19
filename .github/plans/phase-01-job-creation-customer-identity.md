# Phase 01 — Job Creation & Customer Identity

## Objective

Enable org-scoped job creation with strict validation and deterministic VCID linkage.

## Scope

- `jobs`, `job_units`, `job_cancellation_requests` DDL and constraints
- `trg_validate_job_status` trigger (per-type status enforcement)
- VCID resolution pipeline (phone primary, name+address secondary)
- Job creation and retrieval APIs
- Timeline events for all linkage decisions
- Initial status rules by job type and source
- Repeat and frequent complaint flag logic at creation time

## Implementation Backlog

### 1) Schema and Constraints

Create `jobs` with all constraints from Schema v2.2 §B.4:

- `status job_status NOT NULL` — enum type, not TEXT. `trg_validate_job_status` adds per-type validity.
- `chk_dealer_source`: `source <> 'via_dealer' OR dealer_id IS NOT NULL`
- `chk_cancel_meta`: `cancelled_at IS NULL OR (cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL)`
- `chk_cancel_order`: `cancelled_at IS NULL OR cancelled_at >= created_at`
- `version INT NOT NULL DEFAULT 0` — optimistic locking baseline
- `is_repeat`, `is_frequent`, `is_chronic` flags with context columns:
  - `repeat_window_days_used INT` — records threshold in effect when flag was set
  - `frequent_threshold_used INT`
  - `frequent_window_used INT`

Create `job_cancellation_requests` (Schema v2.2 §B.4a):
- **No** `UNIQUE(job_id)` — removed in v2.2 to allow a new request after rejection.
- Partial unique index enforces at most one **pending** request per job:
  ```sql
  CREATE UNIQUE INDEX idx_cancel_req_one_pending
    ON job_cancellation_requests (job_id)
    WHERE status = 'pending';
  ```
- `chk_decision_meta`: requires `decided_by` and `decided_at` when status is not `pending`.
- `chk_decided_order`: `decided_at IS NULL OR decided_at >= requested_at`

Create `job_units` with `ON DELETE CASCADE` from jobs.

Create all 7 indexes from Schema v2.2 §B.4 (were missing in v1 DDL):
```sql
CREATE INDEX idx_jobs_vcid_created  ON jobs (vcid, created_at DESC)    WHERE is_deleted = FALSE;
CREATE INDEX idx_jobs_status_type   ON jobs (status, type)              WHERE is_deleted = FALSE;
CREATE INDEX idx_jobs_dealer        ON jobs (dealer_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_jobs_brand         ON jobs (brand_id);
CREATE INDEX idx_jobs_scheduled     ON jobs (scheduled_at);
CREATE INDEX idx_jobs_is_chronic    ON jobs (is_chronic)                WHERE is_chronic = TRUE;
CREATE INDEX idx_jobs_not_deleted   ON jobs (id)                        WHERE is_deleted = FALSE;
```

Add `trg_validate_job_status` trigger (BEFORE INSERT OR UPDATE OF status):

```
valid_installation: pending_schedule, scheduled, assigned, acknowledged,
                    in_transit, in_process, completed, cancelled
valid_complaint:    new, assigned, acknowledged, in_transit, in_process,
                    resolved, needs_revisit, revisit_scheduled, resolved_on_revisit,
                    cancellation_requested, cancelled
```

Raises exception on invalid status for type. DB-level second layer behind service validation.

### 2) Job Creation Service — VCID Resolution (Flow 1)

Phone is the authoritative lookup key. Name+address is a hint only.

**Step 1 — Phone lookup:**
- Query `customer_phones WHERE phone = :phone AND organization_id = :orgId`
- If match found: surface "Link to [Matched Name] — [Matched Address]?" prompt
  - Confirmed: use existing `vcid`, pre-fill `customer_name` and `address` (editable)
  - Dismissed: create new `virtual_customers` row, log `customer_link_dismissed` to timeline with matched name, actor, and timestamp

**Step 2 — Secondary hint (only if no phone match):**
- Levenshtein on name + word-overlap on address
- If partial match: surface suggestion; same confirm/dismiss branch as above
- If no match: proceed with new VCID silently

**Step 3 — Repeat/frequent detection:**
- Query `jobs WHERE vcid = :vcid AND type = 'complaint' AND organization_id = :orgId AND created_at > NOW() - :repeat_window_days`
- If count >= 1: set `is_repeat = TRUE`, record `repeat_window_days_used`
- Dispatch `repeat_complaint_detected` notification to owner + office staff
- Check frequent threshold in `frequent_complaint_window_days`; if met: update `virtual_customers.is_frequent = TRUE`, set `is_frequent = TRUE`, record threshold and window used, dispatch `frequent_complaint_detected`

Flags are **point-in-time snapshots**. Retroactive recalculation requires a separate background job.

### 3) Initial Status Rules

| Job type | Source | Scheduling date provided? | Initial status |
|----------|--------|--------------------------|----------------|
| Installation | any | Yes | `scheduled` |
| Installation | via_dealer | No | `pending_schedule` |
| Complaint | any | — | `new` |

### 4) Validation Rules

- `brand_id` must belong to same org and be active; inactive brand → 400.
- `dealer_id` must belong to same org; cross-org dealer → 400.
- Complaint-only fields (`issue_description`) must be null on installations.
- Installation-only fields must be null on complaints.
- `source = 'via_dealer'` requires `dealer_id`; DB constraint `chk_dealer_source` catches any bypass.
- Phone number matching two VCIDs: surface both matches; staff selects manually.

### 5) Timeline Guarantees

Every created job must have **exactly one** of:
- `customer_linked` — with matched VCID, actor, timestamp
- `customer_link_dismissed` — with matched name, actor, timestamp

Include structured JSONB `new_value` with linkage context.

### 6) API Surface

- `POST /jobs` — roles: `office_staff`, `owner`
- `GET /jobs/:id` — role-scoped visibility
- Dealer variant: `POST /dealer/jobs` — actor identified from dealer JWT; `organization_id` comes from JWT, never from body

## Required Test Coverage

- Job without `organization_id` fails NOT NULL at DB level.
- Cross-org brand assignment rejected at service layer before DB write.
- Cross-org dealer assignment rejected at service layer.
- VCID phone lookup returns no rows from other orgs.
- Exactly one `customer_linked` or `customer_link_dismissed` per job creation.
- `pending_schedule` status for dealer-submitted installation with no date.
- `new` status for complaint regardless of source.
- Active-brand guard rejects inactive brand.
- Duplicate VCID suggestion (two VCIDs matched): both surfaces correctly, staff selects one.

## Exit Criteria

- Job creation is impossible without a valid tenant context.
- VCID linkage is deterministic and org-scoped.
- Timeline is complete for every customer identity decision path.
- Retrieval respects role and organization boundaries.

## Risks and Mitigations

- **Risk:** Duplicate customer records from partial matching noise.
  - **Mitigation:** Phone is the authoritative key; name+address is prompt-only, never auto-links.
- **Risk:** Status bypass through direct DB writes or missed trigger.
  - **Mitigation:** `trg_validate_job_status` + service-layer validation both mandatory; neither is optional.
- **Risk:** Repeat/frequent flags going stale after threshold config change.
  - **Mitigation:** Context columns record threshold-in-effect at flag time; retroactive recalc is an explicit background job, not automatic.
