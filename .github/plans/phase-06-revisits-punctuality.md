# Phase 06 — Revisits & Punctuality

## Objective

Support complaint revisit loops, automatic chronic escalation, and arrival/no-show outcomes with org-config thresholds.

## Scope

- `revisits` and `revisit_assignments` DDL with `organization_id`
- `needs_revisit` transition: reason selection, revisit creation, amber alert
- `trg_chronic` trigger with out-of-order insert safety
- Revisit scheduling, assignment, and execution lifecycle
- Arrival punctuality outcomes using org grace period config
- No-show auto-flagging and notification

## Implementation Backlog

### 1) Schema

`revisits` (Schema v2.2 §B.6):
- `reason revisit_reason NOT NULL` — enum: `part_unavailable`, `customer_not_home`, `issue_recurring`, `further_diagnosis_required`, `custom`
- `outcome revisit_outcome` — enum: `resolved`, `needs_revisit` (replaces TEXT CHECK from v1)
- `chk_custom_reason`: `reason <> 'custom' OR custom_reason IS NOT NULL`
- `UNIQUE (job_id, sequence_number)`

`revisit_assignments` — mirrors `job_assignments` pattern; partial unique index on `(revisit_id) WHERE is_active = TRUE`.

### 2) `trg_chronic` Trigger (Schema v2.2 §B.6)

```sql
CREATE OR REPLACE FUNCTION fn_check_chronic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sequence_number >= 3 THEN
    UPDATE jobs
    SET is_chronic = TRUE, updated_at = NOW()
    WHERE id = NEW.job_id AND is_chronic = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chronic
  AFTER INSERT ON revisits
  FOR EACH ROW EXECUTE FUNCTION fn_check_chronic();
```

**AFTER INSERT** (not BEFORE): sequence_number is committed to `revisits` first; failure in the UPDATE rolls back both.

**Out-of-order insert safety (offline sync):** If sequence 3 arrives before sequences 1 or 2 due to sync lag, the trigger fires correctly on sequence 3. Earlier sequences (sequence_number < 3) are silently skipped — the `AND is_chronic = FALSE` guard prevents any double-update. No schema change required.

### 3) `needs_revisit` Transition Flow (Flow 6.2)

- Technician selects mandatory reason. `custom` requires `custom_reason` text — `chk_custom_reason` enforces at DB level.
- `UPDATE jobs SET status='needs_revisit', version++`
- `INSERT revisits`: `job_id`, `sequence_number = (SELECT COUNT(*)+1 FROM revisits WHERE job_id = :id)`, `reason`, `organization_id`, `created_at`
- `trg_chronic` fires: if `sequence_number >= 3` → `UPDATE jobs.is_chronic = TRUE`
- If `is_chronic` just became `TRUE`:
  - Dispatch `third_revisit_reached` notification → owner + office staff (org-scoped)
  - Chronic indicator added to job card on owner dashboard
- Write `revisit_created` timeline event
- Raise amber alert card on office staff portal and owner dashboard
- Start 60-second undo window (see Phase 04 §4 for undo behavior — deletes revisit row and clears amber)

### 4) Revisit Scheduling (Flow 6.3)

- Office staff sets `revisits.scheduled_at`. Assigns technician (defaults to parent job technician; changeable).
- `UPDATE jobs SET status='revisit_scheduled', version++`
- `UPDATE revisits SET scheduled_at = :datetime`
- `INSERT revisit_assignments`: `is_active=TRUE`, `assigned_by=:staffId`, `organization_id`
- Validate: assigned technician belongs to same org.
- Amber alert is automatically cleared when status reaches `revisit_scheduled`.
- Write `revisit_scheduled` timeline event.
- Dispatch `job_assigned` notification → assigned technician (revisit).

### 5) Revisit Execution (Flow 6.4)

Technician acknowledges, goes in transit, arrives in process — same pattern as initial visit.
`actual_arrival` and `visit_outcome` are derived for the revisit using `revisits.scheduled_at` and org grace period config.

**Resolution outcome:**
- `UPDATE jobs SET status='resolved_on_revisit', version++`; INSERT payment (atomic E.2 pattern)
- `UPDATE revisits SET outcome='resolved'`

**Another revisit needed:**
- `INSERT revisits` with incremented `sequence_number`; `trg_chronic` fires again
- `UPDATE revisits (current) SET outcome='needs_revisit'`
- Office staff must schedule next revisit (loop back to §4)

### 6) Punctuality for Revisits (Flow 11.1)

Same derivation logic as initial visits, but reads `scheduled_at` from the `revisits` row:

```
IF actual_arrival <= revisits.scheduled_at + grace_period_mins
  THEN visit_outcome = 'on_time'
ELSE
  visit_outcome = 'late'
  late_by_minutes = rounded elapsed minutes
```

`punctuality_grace_period_mins` sourced from `ConfigService.get(orgId, 'punctuality_grace_period_mins')`.

Update analytics: `technician_daily.on_time_count++` or `late_count++`.

### 7) No-Show Detection (Flow 11.2)

Background job (also handles revisit no-shows):

```sql
SELECT r.id FROM revisits r
WHERE r.scheduled_at < NOW()
  AND r.actual_arrival IS NULL
  AND r.visit_outcome IS NULL
  AND r.organization_id = :orgId;
```

For each matched revisit:
- `UPDATE revisits SET visit_outcome = 'no_show'`
- Dispatch `no_show_flagged` notification → owner + office staff (org-scoped only)
- Flag on owner dashboard

## Required Test Coverage

- `needs_revisit` without a reason is rejected (service layer + DB constraint).
- `custom` reason with NULL `custom_reason` rejected by `chk_custom_reason`.
- Third revisit INSERT fires `trg_chronic` and sets `is_chronic = TRUE`.
- Out-of-order insert: sequence 3 arriving before 1 and 2 still sets chronic.
- `is_chronic` already `TRUE`: subsequent revisit INSERTs are no-ops on the jobs row.
- `third_revisit_reached` notification scoped to affected org only; other orgs unaffected.
- Grace period sourced from org config, not hardcoded.
- No-show detection scoped to org; does not flag revisits from other orgs.
- Revisit technician cross-org assignment rejected at service layer.

## Exit Criteria

- Revisit lifecycle runs end-to-end with complete audit logs.
- Chronic detection is automatic, idempotent, and offline-safe.
- Punctuality outcomes are config-driven and org-isolated.

## Risks and Mitigations

- **Risk:** `sequence_number` race condition under concurrent revisit INSERTs.
  - **Mitigation:** Use `SELECT COUNT(*)+1 ... FOR UPDATE` or wrap in advisory lock; the `UNIQUE(job_id, sequence_number)` constraint catches any race that slips through.
- **Risk:** Amber alert not cleared if `revisit_scheduled` transition is rolled back.
  - **Mitigation:** Amber alert state is derived from `jobs.status`; clearing is idempotent on re-read.
