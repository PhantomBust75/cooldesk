# Phase 05 — Payments

## Objective

Record payments atomically with job completion/resolution, enforce strict role-based edit authority, and handle the full payment status lifecycle including refunds and disputes.

## Scope

- `payment_methods` and `payments` DDL with org scoping
- `payment_status` enum (4 values) with documented state transitions
- `trg_set_collected_at` trigger (BEFORE INSERT OR UPDATE)
- `chk_collected_meta` constraint covering all status branches
- Atomic job status + payment transaction (E.2 pattern)
- Optimistic locking on payments (was missing in v1)
- Split authority for amount vs method edits
- Owner retain-or-void policy
- Pending-to-collected transition for manual confirmation (cheque/transfer)
- Payment method management APIs

## Implementation Backlog

### 1) Schema and Constraints

`payment_methods`: org-scoped, owner-managed. `is_active` controls dropdown visibility.
Historical `payment_method_id` references are preserved via `ON DELETE RESTRICT` even after deactivation.

`payments` (Schema v2.2 §B.7):

`payment_status` enum — 4 values with documented state transitions:
```
pending   → collected   technician completes job
pending   → disputed    payment contested before collection
collected → refunded    owner authorises refund
collected → disputed    payment contested after collection
disputed  → collected   dispute resolved in favour of business
disputed  → refunded    dispute resolved in favour of customer
```

Key columns:
- `collected_at TIMESTAMPTZ` — auto-populated by trigger; **never cleared** after first set (audit requirement)
- `last_edited_by`, `last_edited_at` — tracks who last corrected the payment
- `voided_at`, `voided_by`, `void_reason` — void lifecycle fields
- `retained_note` — note when owner retains payment on reversal
- `version INT NOT NULL DEFAULT 0` — optimistic locking (was absent in v1)

Constraints:
- `chk_void_meta`: `voided_at IS NULL OR (voided_by IS NOT NULL AND void_reason IS NOT NULL)`
- `chk_edit_meta`: `last_edited_at IS NULL OR last_edited_by IS NOT NULL`
- `chk_collected_meta` — explicit branches in priority order:
  - `status = 'refunded'` → `collected_at IS NOT NULL` (stated first, before voided_at catch-all to close the refunded+voided gap)
  - `status = 'collected'` → `collected_at IS NOT NULL`
  - `status = 'disputed'` → `collected_at` optional (may arise pre- or post-collection)
  - `status = 'pending' AND voided_at IS NOT NULL` → `collected_at` preserved if previously set
  - `status = 'pending' AND voided_at IS NULL` → `collected_at IS NULL`

### 2) `trg_set_collected_at` Trigger (Schema v2.2 §B.7)

`BEFORE INSERT OR UPDATE OF status` — covers both INSERT and UPDATE to handle data migrations,
test fixtures, and code paths that insert directly as `'collected'`.

```sql
IF NEW.status = 'collected'
   AND (TG_OP = 'INSERT' OR OLD.status <> 'collected')
THEN
  NEW.collected_at := COALESCE(NEW.collected_at, NOW());
END IF;
-- All other transitions: collected_at left as-is.
```

`COALESCE` guard makes it idempotent on re-fire. `collected_at` is **never cleared** on any
subsequent transition (void, refund, dispute). Once money has been touched, that timestamp is permanent.

### 3) Atomic Completion Flow — E.2 Pattern

Payment is inserted **directly as `'collected'`** in the same transaction as the job status update.
This eliminates the previous two-round-trip gap (insert as `pending` → update to `collected`).

```sql
BEGIN;
  -- 1. Advance job status with version guard
  UPDATE jobs
  SET status = 'completed', version = version + 1, updated_at = NOW()
  WHERE id = :jobId AND organization_id = :orgId
    AND version = :expectedVersion AND is_deleted = FALSE;
  -- rowcount = 0 → ROLLBACK immediately

  -- 2. Insert payment directly as 'collected'
  --    trg_set_collected_at fires on INSERT, populates collected_at automatically.
  --    UNIQUE on job_id prevents double-payment on retry.
  INSERT INTO payments (job_id, amount, payment_method_id, status, recorded_by, organization_id)
  VALUES (:jobId, :amount, :methodId, 'collected', :technicianId, :orgId);

  -- 3. Timeline entries
  INSERT INTO job_timeline (job_id, event_type, actor_user_id, new_value, organization_id)
  VALUES (:jobId, 'status_transition', :technicianId, '{"status":"completed"}', :orgId);

  INSERT INTO job_timeline (job_id, event_type, actor_user_id, new_value, organization_id)
  VALUES (:jobId, 'payment_recorded', :technicianId,
          json_build_object('amount', :amount, 'method_id', :methodId)::jsonb, :orgId);
COMMIT;
```

All three operations succeed together or all roll back. No intermediate state where job is completed but payment is pending.

**Pending payment path** (cheque, bank transfer not yet confirmed):
- Insert with `status = 'pending'`; `collected_at` is NULL.
- To transition to `collected` later (Residual Gap 17.6): owner or office staff updates payment status via `PATCH /payments/:id/status`. This requires a new UI control and a `payment_edited` timeline event. Service layer enforces that only `owner` or `office_staff` can execute this transition; technician cannot.

### 4) Optimistic Locking on Payments

All payment UPDATE operations must include the version guard:

```sql
UPDATE payments
SET amount = :amount,
    last_edited_by = :editorId,
    last_edited_at = NOW(),
    updated_at = NOW(),
    version = version + 1
WHERE job_id = :jobId
  AND organization_id = :orgId
  AND version = :expectedVersion;
```

`rowcount = 0` → `OptimisticLockException` → HTTP 409. Actor re-fetches and retries.

### 5) Role Authority Rules (Flow 9)

| Actor | Permitted action | Blocked actions |
|-------|-----------------|-----------------|
| Technician | Set initial amount + method at completion | Edit after submission |
| Office Staff | Edit method only (on open jobs) | Edit amount; modify closed jobs |
| Owner | Edit amount; edit method on closed jobs; void/retain | None (full authority) |

Office staff corrections blocked on completed/resolved jobs — owner only.

### 6) Owner Retain-or-Void Policy (Flow 9.4)

Triggered when owner reverses a completed/resolved status **outside** the 60-second undo window and a payment row exists.

The decision prompt is **mandatory and cannot be bypassed**.

**RETAIN:**
- `UPDATE payments SET retained_note = 'Recorded on prior completion'` — no status or amount change
- Write `payment_retained` timeline event

**VOID:**
- Owner enters mandatory void reason
- `UPDATE payments SET voided_at=NOW(), voided_by=:ownerId, void_reason=:text` — `chk_void_meta` enforced
- Write `payment_void` and `rollback_payment_voided` timeline events
- `UPDATE jobs SET status='in_process', version++`
- Write `status_rollback` timeline event (owner override)

### 7) Payment Method Management APIs

- `GET /payment-methods` — scoped to org
- `POST /payment-methods` — owner only
- `PATCH /payment-methods/:id` — owner only; deactivate only (`is_active = FALSE`). Hard delete is not supported; `ON DELETE RESTRICT` on FK from `payments`.

Payment method from a different org cannot be used on a job — service-layer check required.

## Required Test Coverage

- Two concurrent completions for the same job produce exactly one payment row (UNIQUE on `job_id`).
- `trg_set_collected_at` sets `collected_at` on INSERT with `status='collected'`.
- `collected_at` is not cleared when status transitions to `refunded`, `disputed`, or `voided`.
- `chk_collected_meta` rejects `refunded` with NULL `collected_at`.
- Office staff cannot modify `amount` — rejected at service layer.
- Office staff cannot edit a closed-job payment — rejected at service layer.
- Owner void-or-retain prompt cannot be bypassed; action blocked until decision.
- Optimistic lock version mismatch returns HTTP 409.
- Payment method from different org rejected at service layer.
- Pending payment can transition to collected via owner/staff action with timeline event.

## Exit Criteria

- Payment lifecycle is atomic, auditable, and role-correct.
- No duplicate payment creation under retry or concurrency.
- `collected_at` is immutable once set, regardless of subsequent status transitions.
- Payment methods are strictly tenant-scoped.

## Risks and Mitigations

- **Risk:** Payment inserted as `pending` and never transitioned to `collected`, leaving a zombie record.
  - **Mitigation:** E.2 pattern inserts directly as `collected` for the standard flow. The `pending` path is explicitly for deferred payment methods (cheque); implement and test the `pending → collected` owner/staff action flow.
- **Risk:** Voiding a payment does not clear `collected_at`, confusing auditors.
  - **Mitigation:** Document and display the full lifecycle trail: `recorded_at → collected_at → voided_at`. All three timestamps are permanent.
