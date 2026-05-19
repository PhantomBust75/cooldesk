# Phase 04 — Technician PWA & 60-Second Undo

## Objective

Deliver offline-capable technician workflows with deterministic sync, org-config-driven undo timing, and full punctuality/no-show tracking.

## Scope

- Next.js PWA shell with service worker and offline cache
- Technician-only assignment views (org-scoped)
- Atomic sync queue entry (status + payment as one item)
- Device-side 60-second undo window driven by org config
- Undo special cases: `needs_revisit`, `completed`, `resolved`
- Arrival and punctuality tracking
- Background job for no-show detection
- Background job for unacknowledged job detection

## Implementation Backlog

### 1) PWA Shell

- Configure Next.js service worker with app shell caching.
- Static route fallbacks for offline mode.
- Target low-end Android as performance baseline.
- Cache `undo_window_seconds` from org config at page load — value must be fresh per org.

### 2) Technician Views

- **My Jobs list:** only active assignments for the authenticated technician in the current org.
  - Query: `job_assignments WHERE technician_id = :techId AND is_active = TRUE AND organization_id = :orgId`
  - Join to `jobs WHERE is_deleted = FALSE AND status NOT IN ('cancelled', 'completed', 'resolved', 'resolved_on_revisit')`
- **Job detail:** show only status transitions allowed by technician role and current status.
  - Disable all action buttons when `status = 'cancellation_requested'`.

### 3) Offline Queue (Flow 5.3)

Queue item schema includes:
```ts
{
  organizationId: string,
  jobId: string,
  expectedVersion: number,
  actionType: 'status_transition' | 'payment' | 'status_transition+payment',
  payload: { ... }
}
```

- Status transition and payment are **always queued as one atomic item** — never split.
- Retry with exponential backoff on reconnect.
- Show "Pending Sync" UI marker until server ack or permanent failure.
- **Offline Rule:** If device is offline > 60 seconds before sync lands, the server accepts the transition but writes a `system_event` `'Delayed Sync'` to `job_timeline` with `occurred_at` from the client-provided timestamp.

### 4) Undo Window (Flow 5.2)

- Load `undo_window_seconds` from `ConfigService.get(orgId, 'undo_window_seconds')` at page load.
- Countdown starts **at local queue submission time**, not at server confirmation.
- Undo window must reflect the org's configured value — never hardcode 60.

**If queue entry has not yet synced (still on device):**
- Remove both the transition and any paired payment from the queue. Server never sees either event.

**If queue entry has already landed on server:**
- Server applies rollback. If reverting `completed` or `resolved`: payment INSERT is also rolled back in the same transaction.
- `UPDATE jobs SET status = in_process, version++`; `DELETE FROM payments WHERE job_id = :jobId` (if completion undone)
- Write `status_undo` timeline event.

**Special undo cases:**
- `needs_revisit` undone: `DELETE` the revisit row **and** clear the amber alert immediately. (Contrast with office staff rollback which does NOT delete the revisit row — see Phase 02.)
- `completed` / `resolved` undone: payment row is rolled back atomically in the same transaction. `rollback_payment_voided` timeline event written.

**After expiry:** Undo button is disabled on the device. Server also rejects undo requests past the window.

### 5) Arrival Logging and Punctuality (Flow 11.1)

When technician taps "In Process":
- Record `actual_arrival = NOW()`.
- Compute `visit_outcome` and `late_by_minutes`:
  ```sql
  IF actual_arrival <= scheduled_at + (grace_period_mins || ' minutes')::INTERVAL
    THEN visit_outcome = 'on_time'
  ELSE
    visit_outcome = 'late';
    late_by_minutes = EXTRACT(EPOCH FROM actual_arrival - scheduled_at)/60 rounded;
    -- CHECK late_by_minutes >= 0 enforced by constraint
  ```
- `punctuality_grace_period_mins` sourced from `ConfigService.get(orgId, 'punctuality_grace_period_mins')`.
- Update analytics: `technician_daily.on_time_count++` or `late_count++`.

For revisit visits: `scheduled_at` is read from the `revisits` row, not from `jobs`.

**Rescheduled outcome (Flow 11.3):**
- When office staff changes `scheduled_at` before arrival, set `visit_outcome = 'rescheduled'`.
- Write `job_timeline` note event with old and new `scheduled_at` values in `previous_value` / `new_value` JSONB before the UPDATE.
- **Note (Residual Gap 17.4):** There is no schedule history table. The `job_timeline` note is the only audit trail for prior schedule slots. If full schedule history is required, add it as a `rescheduled` event type to the `timeline_event_type` enum.

### 6) Background Job — No-Show Detection (Flow 11.2)

Runs periodically (suggested: every 15 minutes).

```sql
SELECT id FROM jobs
WHERE scheduled_at < NOW()
  AND actual_arrival IS NULL
  AND visit_outcome IS NULL
  AND status NOT IN ('cancelled', 'cancellation_requested')
  AND organization_id = :orgId
  AND is_deleted = FALSE;
```

For each matched job:
- `UPDATE jobs SET visit_outcome = 'no_show'`
- `INSERT notifications: no_show_flagged → owner + office staff` (org-scoped)
- Flag on owner dashboard for follow-up

Also query `revisits` table with same logic for revisit no-shows.

### 7) Background Job — Unacknowledged Job Detection

Runs periodically. Checks `job_assignments WHERE is_active = TRUE AND acknowledged_at IS NULL AND assigned_at < NOW() - (:threshold || ' minutes')::INTERVAL`.

Threshold read from a future `system_config` key (or hardcode as an agreed constant until config key is introduced).

Dispatch `job_unacknowledged` notification → owner + office staff.

## Required Test Coverage

- Reconnect retry does not create a duplicate payment or apply status transition twice.
- Undo blocked on device after window expiry; server also rejects late undo.
- `needs_revisit` undo deletes revisit row and clears amber alert in same transaction.
- `completed` undo rolls back payment row atomically.
- Config-driven undo duration reflected correctly per org.
- Pending-sync indicators clear on server ack or permanent failure.
- Offline sync accepted with `Delayed Sync` system_event when > 60s.
- Punctuality calculation uses org config grace period, not hardcoded value.
- No-show detection scoped to org; does not flag jobs from other orgs.

## Exit Criteria

- Field transitions work offline and reconcile safely with no double-application.
- Undo behavior follows org config, not constants.
- Punctuality and no-show outcomes are config-driven and org-isolated.
- All background jobs are idempotent and org-scoped.

## Risks and Mitigations

- **Risk:** Device clock skew causing incorrect undo window or punctuality calculation.
  - **Mitigation:** Use server timestamp for server-side decisions; device-side countdown is UX only.
- **Risk:** Offline queue builds up large backlog causing replay issues.
  - **Mitigation:** Queue is processed in submission order; optimistic lock version guards prevent out-of-order application.
