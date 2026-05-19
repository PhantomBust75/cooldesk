# CoolDesk Backend (Phase 00–10)

This backend starter initializes implementation slices through Phase 08:

- Multi-tenant foundation migration SQL
- Platform organization management endpoints
- Tenant and platform guard separation
- Organization-scoped `system_config` access service
- Job creation schema with status trigger validation
- VCID resolution and tenant-scoped job APIs
- Status transition engine with optimistic locking
- Cancellation lifecycle flows (direct, dealer withdrawal, request/decision)
- Technician assignment + scheduling conflict acknowledgment
- Technician mobile sync/undo APIs with idempotent action handling
- No-show / unacknowledged detection scan endpoints
- Payment lifecycle with status transitions, optimistic locking, and role-based edit authority
- Revisit lifecycle (`needs_revisit` creation + office scheduling) with chronic escalation notification
- Notification centre APIs with read/unread state and retry-safe deduped delivery
- Owner dashboard APIs backed by org-scoped analytics tables
- Phase 08 analytics worker pipeline with idempotent processed-event ledger
- Dealer network management APIs (`dealers`, `dealer_credentials`, `dealer_brands`)
- Phase 09 office staff portal quick-entry, revisit cards, and rescheduling workflows
- Phase 10 customer review link lifecycle with tokenized submission and low-rating visibility

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Environment

Copy `.env.example` to `.env` and fill values.

## Default owner bootstrap credentials

`POST /platform/organizations` now supports owner defaults when omitted:

- `ownerEmail`: `admin@email.com`
- `ownerPassword`: `password`

If `ownerPasswordHash` is provided, that hash is used as-is. Otherwise the service hashes
`ownerPassword` (or the default `password`) before inserting the owner user.

## Run

```powershell
Set-Location "c:\Users\786\Desktop\Projects\Cool Desk\backend"
npm install
npm run build
npm run start:dev
```

## Migration

Apply migrations in order:

1. `sql/000_phase00_foundation.sql`
2. `sql/001_phase01_jobs.sql`
3. `sql/002_phase02_lifecycle.sql`
4. `sql/003_phase03_assignments_conflicts.sql`
5. `sql/004_phase04_technician_sync_undo.sql`
6. `sql/005_phase05_payments_lifecycle.sql`
7. `sql/006_phase06_revisits_punctuality.sql`
8. `sql/007_phase07_notifications_dashboard.sql`
9. `sql/008_phase08_analytics_dealer_network.sql`
10. `sql/009_phase10_customer_reviews.sql`

## Implemented Endpoints

- `POST /auth/login` (organization users: `owner`, `office_staff`, `technician`)
- `POST /platform/organizations`
- `PATCH /platform/organizations/:id`
- `GET /platform/organizations`
- `POST /jobs` (owner/office_staff)
- `POST /dealer/jobs` (dealer token)
- `GET /jobs/:id` (owner/office_staff/technician)
- `GET /jobs` (filtered list)
- `GET /office/customers/lookup` (owner/office_staff org-scoped name/phone lookup)
- `GET /office/jobs/pending-schedule` (owner/office_staff dealer installation pending queue)
- `POST /office/jobs/:id/schedule` (owner/office_staff pending queue scheduling, optional immediate assignment)
- `GET /office/technicians/workload` (owner/office_staff org-scoped active assignment snapshot)
- `POST /office/jobs/quick-entry` (owner/office_staff quick intake with optional technician assignment)
- `GET /office/brands` (owner/office_staff active brands for quick-entry dropdown)
- `GET /office/technicians` (owner/office_staff active technicians for quick-entry dropdown)
- `GET /office/revisits/pending` (owner/office_staff amber revisit scheduling cards)
- `PATCH /office/jobs/:id/reschedule` (owner/office_staff reschedule with schedule audit + conflict acknowledgement)
- `POST /jobs/:id/review-link` (owner/office_staff/technician review link generation or regeneration)
- `POST /reviews/:token` (public customer review submission; token-bound, expiry + single-submit guarded)
- `GET /reviews` (owner/office_staff submitted reviews list)
- `GET /reviews/low-rated` (owner/office_staff low-rated review cards)
- `PATCH /jobs/:id/status` (owner/office_staff/technician role rules)
- `POST /dealer/jobs/:id/withdraw`
- `POST /dealer/jobs/:id/cancellation-request`
- `PATCH /jobs/:id/cancellation-request` (owner/office_staff)
- `POST /jobs/:id/assign` (owner/office_staff — technician assignment with conflict detection)
- `POST /jobs/:id/reassign` (owner/office_staff — reassign with conflict detection)
- `POST /jobs/:id/acknowledge` (technician — marks job acknowledged, sets assignment timestamp)
- `GET /technician/jobs` (technician active assignments only; org-scoped)
- `POST /jobs/:id/mobile-sync` (technician atomic sync action: status/payment/status+payment)
- `POST /jobs/:id/undo` (technician server-side undo inside org-config window)
- `POST /internal/jobs/no-show-scan` (owner/office_staff org-scoped scan)
- `POST /internal/jobs/unacknowledged-scan` (owner/office_staff org-scoped scan)
- `POST /jobs/:id/revisit-schedule` (owner/office_staff — schedule pending revisit and assign technician)
- `GET /payment-methods` (org-scoped)
- `POST /payment-methods` (owner)
- `PATCH /payment-methods/:id` (owner, deactivate only)
- `PATCH /payments/:id` (owner/office_staff split authority)
- `PATCH /payments/:id/status` (owner/office_staff status lifecycle update)
- `POST /jobs/:id/payment-reversal-decision` (owner retain-or-void flow)
- `GET /notifications` (user notification centre)
- `GET /notifications/unread-count` (user badge count)
- `PATCH /notifications/:id/read` (user marks notification read)
- `GET /dealer/notifications` (dealer notification centre)
- `GET /dealer/notifications/unread-count` (dealer badge count)
- `PATCH /dealer/notifications/:id/read` (dealer marks notification read)
- `GET /dashboard/owner` (owner/office_staff org-scoped analytics dashboard)
- `POST /internal/analytics/process` (owner/office_staff process unprocessed org timeline events)
- `POST /internal/analytics/purge-processed-events` (owner/office_staff purge >90-day ledger rows)
- `POST /dealers` (owner creates dealer + credentials + brand links)
- `PATCH /dealers/:id` (owner activate/deactivate dealer)
- `PUT /dealers/:id/brands` (owner replaces dealer brand links)
- `GET /dealers/analytics/daily` (owner/office_staff org-scoped dealer analytics)
- `GET /dealer/brands` (dealer linked brands only)
- `GET /dealer/jobs/history` (dealer org-scoped own submissions)
- `GET /dealer/jobs/:id` (dealer scoped job-by-id lookup)

## Test Notes

- `npm test` runs service-level specs.
- `src/modules/payments/payments.db.integration.spec.ts` is gated by `PAYMENTS_DB_TEST_URL` and verifies SQL behavior for `trg_set_collected_at` and `chk_collected_meta`.
- `src/modules/notifications/notifications.db.integration.spec.ts` is gated by `NOTIFICATIONS_DB_TEST_URL` and verifies `chk_read_meta` plus dedup index behavior.
- `src/modules/analytics/analytics.db.integration.spec.ts` is gated by `ANALYTICS_DB_TEST_URL` and verifies `trg_validate_technician_role`, RESTRICT semantics, and 90-day purge behavior.
- `src/modules/jobs/jobs.db.integration.spec.ts` is gated by `JOBS_DB_TEST_URL` and verifies office tenant scoping on quick-entry validations, pending revisit cards, and reschedule org/version guards.
- `src/modules/reviews/reviews.db.integration.spec.ts` is gated by `REVIEWS_DB_TEST_URL` and verifies token expiry, single-submit guard, and org-safe low-rating notification flow.
- Controller integration coverage exists for `jobs`, `payments`, `dealers`, and `analytics` owner/tenant guards using `@nestjs/testing` + `supertest`.

## VCID Multi-Match Contract

For `POST /jobs` and `POST /dealer/jobs`, if phone lookup matches multiple VCIDs and no
`selectedVcid` is provided, API returns `409` with candidate list:

```json
{
	"code": "MULTIPLE_VCID_MATCHES",
	"message": "Multiple customer matches found for phone. Select one VCID and retry.",
	"candidates": [
		{ "vcid": "...", "customerName": "...", "address": "..." }
	]
}
```

Client should retry request with `selectedVcid` set to one candidate, or set
`linkBehavior: "create_new"` to force new VCID creation.
