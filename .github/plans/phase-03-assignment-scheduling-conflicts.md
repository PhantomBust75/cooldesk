# Phase 03 — Assignment & Scheduling Conflicts

## Objective

Assign technicians safely within organization boundaries and handle schedule overlaps with explicit acknowledgment and canonical conflict storage.

## Scope

- `job_assignments`, `revisit_assignments`, `scheduling_conflicts` DDL with `organization_id`
- Active/inactive assignment lifecycle and history preservation
- Cross-org technician validation at service layer
- Scheduling conflict detection using `standard_job_duration_mins` from `system_config`
- Conflict canonical ordering to prevent mirrored duplicate pairs
- Conflict warning, acknowledgment, and logging
- Technician acknowledgment endpoint

## Implementation Backlog

### 1) Schema

`job_assignments` (Schema v2.2 §B.5):
- Partial unique index enforces exactly one active assignment per job:
  ```sql
  CREATE UNIQUE INDEX idx_job_assignments_active
    ON job_assignments (job_id) WHERE is_active = TRUE;
  ```
- `ON DELETE RESTRICT` on `job_id` and `technician_id` — preserve assignment history.

`revisit_assignments` — same pattern; partial unique index on `(revisit_id) WHERE is_active = TRUE`.

`scheduling_conflicts` (Schema v2.2 §B.10):
```sql
CONSTRAINT chk_not_self_conflict CHECK (job_id <> conflicting_job_id),
CONSTRAINT chk_canonical_order   CHECK (job_id < conflicting_job_id),
UNIQUE (job_id, conflicting_job_id, technician_id)
```

The canonical ordering constraint (`job_id < conflicting_job_id`) means conflict pair (A, B) and
(B, A) are stored identically. Combined with UNIQUE, this prevents mirrored duplicates.

**Service layer must always insert as:**
```sql
job_id           = LEAST(jobA_uuid, jobB_uuid)
conflicting_job_id = GREATEST(jobA_uuid, jobB_uuid)
```

UUID lexicographic comparison is deterministic in PostgreSQL. A service-layer unit test must
assert this ordering for every conflict creation path.

Add index on `conflicting_job_id` for reverse lookups:
```sql
CREATE INDEX idx_conflicts_conflicting ON scheduling_conflicts (conflicting_job_id);
```

### 2) Assignment Service (Flow 5.1 — First Assignment)

- Validate technician `is_active = TRUE` and `is_deleted = FALSE`; reject before DB write.
- Validate technician `organization_id = job.organization_id`; cross-org assignment is rejected.
- Deactivate current active row: `UPDATE job_assignments SET is_active=FALSE, unassigned_at=NOW() WHERE job_id=:id AND is_active=TRUE`
- Insert new active row with `organization_id`.
- `UPDATE jobs SET status='assigned', version++`
- Write `assignment` or `reassignment` timeline event with previous and new technician IDs.
- Dispatch `job_assigned` notification to new technician.
- Update analytics: `technician_daily.jobs_assigned++`

### 3) Reassignment (Flow 5.2)

- Run conflict check for new technician before deactivating old assignment.
- Deactivate old row, insert new row — partial unique index on `is_active` enforces at most one active row per job.
- Previous technician loses the job from their view immediately.
- If technician is `in_transit` when reassigned: permitted; new technician notified; previous technician loses job from view.

### 4) Conflict Detection (Flow 5.1)

Scheduling conflict check scoped to `organization_id`:

```sql
SELECT j.id
FROM jobs j
JOIN job_assignments ja ON ja.job_id = j.id AND ja.is_active = TRUE
WHERE ja.technician_id = :technicianId
  AND j.organization_id = :orgId
  AND j.scheduled_at BETWEEN :newScheduledAt
      AND :newScheduledAt + (:standardJobDurationMins || ' minutes')::INTERVAL
  AND j.id <> :newJobId
  AND j.is_deleted = FALSE;
```

`standard_job_duration_mins` is read from `ConfigService.get(organizationId, 'standard_job_duration_mins')`.
Cast: `parseInt(value, 10)` with COALESCE fallback to 120.

If conflicts found: return warning payload with conflicting job IDs. Require `acknowledgeConflict: true` in the request body to proceed. If staff selects a different technician instead: no conflict row is logged.

### 5) Conflict Acknowledgment Logging

When `acknowledgeConflict: true` and conflicts exist:
- Insert into `scheduling_conflicts` using canonical ordering (`LEAST`/`GREATEST`).
- Write `scheduling_conflict_ack` event to `job_timeline`.
- Double-booking is permitted with explicit acknowledgment only — no hard block.

### 6) Technician Acknowledgment Endpoint

`POST /jobs/:id/acknowledge` — role: `technician`
- Verify `job.organization_id = requestContext.organizationId`.
- Verify job has an active assignment for the current technician.
- `UPDATE job_assignments SET acknowledged_at = NOW()`
- `UPDATE jobs SET status='acknowledged', version++`
- Write `status_transition` timeline event.

## Required Test Coverage

- Cross-org technician assignment rejected at service layer, never reaches DB.
- Inactive/deleted technician rejected before DB write.
- Conflict check queries exclude all other organizations.
- Canonical ordering enforced: inserting (B, A) when A < B produces correct stored row.
- Duplicate conflict pair (A, B) blocked by UNIQUE constraint.
- Acknowledgment creates both the conflict row and the timeline entry with org context.
- Assignment history preserves previous row as inactive with `unassigned_at` set.
- Conflict detection window uses org config value, not hardcoded 120.

## Exit Criteria

- Assignment lifecycle is fully auditable and tenant-safe.
- Schedule conflicts are surfaced, canonically stored, and explicitly accepted.
- Technician acknowledgment is ownership-scoped and version-guarded.

## Risks and Mitigations

- **Risk:** Mirrored conflict pairs (A,B) and (B,A) causing double-counting in analytics.
  - **Mitigation:** `chk_canonical_order` DB constraint + `LEAST`/`GREATEST` in service layer; unit test asserts ordering on every conflict write path.
- **Risk:** Conflict window too short or too long for different orgs or brands.
  - **Mitigation:** `standard_job_duration_mins` is in `system_config` per org; future brand-level override via `brand_configurations` extension point (stub in Schema v2.2 §B.13).
