# CoolDesk Detailed Execution Plans

This folder expands `.github/plans/cooldesk.md` into execution-ready, phase-by-phase plans.

## How to Use These Files

- Implement phases in order (`00` to `11`).
- Treat each phase's **exit criteria** as release gates.
- Do not begin a later phase until all blockers from the previous phase are closed.
- For every implementation item, enforce tenant isolation:
  - `organization_id` from JWT/context only
  - every tenant query filters by `organization_id`
  - all significant actions create `job_timeline` entries

## Phase Files

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
- [Phase 11 — Frontend Application (Web + Technician PWA)](./phase-11-frontend-application.md)

## Suggested Delivery Cadence

For each phase, run this sequence:

1. **Schema + migrations**
2. **Service layer invariants**
3. **Controllers and guards**
4. **Timeline logging + notifications**
5. **Automated tests** (unit + integration)
6. **Manual UAT checklist**
7. **Gate review against phase exit criteria**

## Definition of Done (Global)

- No cross-tenant access paths in API, workers, queries, or caches.
- No tenant-scoped query without both `organization_id` and `is_deleted = FALSE` where applicable.
- No business threshold hardcoded when it exists in `system_config`.
- Every state-changing action is auditable in `job_timeline`.
- Worker jobs are idempotent and org-scoped.
