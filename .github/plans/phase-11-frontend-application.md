# Phase 11 — Frontend Application (Web + Technician PWA)

## Objective

Deliver the production frontend for CoolDesk using the approved design reference and fully integrated tenant-safe workflows for `owner`, `office_staff`, `technician`, and `dealer` roles.

Design reference:
- Figma site: `https://sonata-tack-53126368.figma.site/dashboard`
- Local UI reference implementation: `Cool Desk UI Design Reference/`
- Local reference mapping (treat as implementation parity source):
  - UX rules: `Cool Desk UI Design Reference/guidelines/Guidelines.md`
  - Page blueprints: `Cool Desk UI Design Reference/src/app/pages/`
  - Reusable primitives: `Cool Desk UI Design Reference/src/app/components/ui/`
  - App shell/layout patterns: `Cool Desk UI Design Reference/src/app/components/layout/AppShell.tsx`
  - Theme and styling baseline: `Cool Desk UI Design Reference/src/styles/`

## Scope

- Build role-aware frontend in Next.js (tenant web app + technician PWA)
- Implement auth, route protection, and token refresh flows
- Implement office staff operations UI from Phase 09
- Implement customer reviews UI integration from Phase 10
- Implement notification center, dashboard, analytics, and management screens
- Ensure all API calls are organization-safe (org from JWT only; never user-entered)
- Add frontend test coverage (unit, integration, e2e smoke)

## Implementation Backlog

### 1) Foundation and Architecture

- Create `frontend/` Next.js app (App Router, TypeScript, strict mode, ESLint, Prettier).
- Port design tokens/components from `Cool Desk UI Design Reference/src/app/components/ui` into a reusable design system package/folder.
- Define app shells by role:
  - `OwnerShell`
  - `OfficeStaffShell`
  - `TechnicianShell` (PWA optimized)
  - `DealerShell`
- Implement global providers:
  - Auth/session provider
  - Query/cache provider
  - Notification/toast provider
  - Theme provider (if required by design system)

### 2) Auth, Session, and Route Guards

- Implement login flow for:
  - Organization users (`owner`, `office_staff`, `technician`)
  - Dealer auth surface (separate flow)
- Store JWT securely (HTTP-only cookie preferred; if bearer storage is used, apply XSS-hardening constraints).
- Build frontend route guards:
  - unauthenticated redirect
  - role-based page access
  - session expiry handling and silent refresh (if backend supports refresh)
- Ensure UI never accepts `organization_id` from form/query/body; backend derives from JWT.

### 3) API Layer and Contracts

- Build typed API client module (`fetch` wrapper with interceptors, error normalization, retry policy for idempotent GETs).
- Generate or maintain typed contracts for DTOs used by pages (jobs, revisits, payments, notifications, reviews, analytics).
- Add standardized error mapping for backend semantics:
  - `409` optimistic lock conflicts
  - `403` role/guard denials
  - `410` expired review links
  - validation errors with field-level display
- Add consistent loading/empty/error states for all list/detail screens.

### 4) Core Role-Based Screens (Design-Accurate)

Implement pages based on the reference set from `Cool Desk UI Design Reference/src/app/pages`:

- `Dashboard`
- `JobList`
- `JobDetail`
- `LogNewJob`
- `PendingSchedule`
- `Notifications`
- `Analytics`
- `DealerManagement`
- `Technicians`
- `PaymentMethods`
- `SystemConfig`
- `Login`

Each screen must:
- Use server-backed data (replace mock data)
- Respect role and tenant boundaries
- Include timeline/audit visibility where applicable
- Preserve status-chip and job-type-chip semantics from design system
- Follow spacing, typography, and component behavior from `guidelines/Guidelines.md`

### 5) Phase 09 Office Workflow UI Completion

- Quick-entry form for installation/complaint job creation.
- Customer lookup (phone exact, name search) with tenant-safe responses.
- Pending-schedule queue with assign/reschedule actions.
- Technician workload and conflict indicators.
- One-step rollback UX with mandatory reason capture.
- Cancellation decision flow (`approve` / `reject`) with clear status restoration messaging.
- Pending revisit cards and revisit scheduling modal/actions.

### 6) Phase 10 Customer Reviews UI

- Add technician completion flow prompts based on `customer_review_mode`:
  - `off`: no review UI
  - `optional`: generate-link optional
  - `mandatory`: block completion until link generated
- Add review link share UI for WhatsApp/SMS.
- Build public token route: `/review/[token]`:
  - submit rating/comment
  - show expired/already-submitted/not-found states (410/409/404)
- Owner review views:
  - all reviews list
  - low-rated review queue

### 7) Technician PWA (Phase 04 Frontend Delivery)

- Configure PWA manifest, icons, service worker, and installability prompts.
- Implement offline-first queue UI:
  - pending sync badge
  - retriable failed entries
  - conflict resolution messaging for version mismatches
- Device-side undo countdown for status transitions using org-config value from backend.
- Optimize for low-end Android:
  - lightweight bundles
  - minimized rerenders
  - skeleton states instead of heavy loaders

### 8) Notifications and Real-Time UX

- Notification center list with unread/read actions and pagination.
- Header badge count refresh strategy (polling or push adapter when available).
- Dedup-safe rendering keyed by backend notification IDs.
- Deep-link actions from notifications to job/revisit/review screens.

### 9) Data Safety and UX Guardrails

- Never display VCID in UI.
- Always render source tags (`direct`, `via_dealer`) and role-limited actions.
- Prevent illegal transitions client-side, but rely on server as source of truth.
- Display optimistic-lock errors as actionable refresh-and-retry prompts.
- Ensure all mutable forms include version fields where backend requires optimistic locking.

### 10) Frontend Testing Requirements

- Unit tests:
  - reusable UI components
  - form validators
  - API error mappers
- Integration tests:
  - role-based route guard behavior
  - key workflows (quick-entry, rollback, cancellation decision, review submission)
- E2E smoke tests:
  - owner dashboard load
  - office pending-schedule action
  - technician status transition + undo countdown
  - public review token submission
- Tenant isolation tests (frontend assertions):
  - no org switch control in tenant app
  - no cross-org data in search/list surfaces under mocked token contexts

### 11) Delivery, Performance, and Observability

- Add CI jobs:
  - `lint`
  - `typecheck`
  - unit/integration tests
  - e2e smoke (headless)
- Define performance budgets:
  - dashboard first-contentful paint target
  - PWA interaction latency target on low-end Android profile
- Add telemetry hooks for:
  - API failures
  - sync queue failures
  - route-level render timings

## Suggested Milestones

1. Foundation + auth + API client
2. Office staff flows (Phase 09 parity)
3. Technician PWA + undo UX parity (Phase 04 parity)
4. Reviews UI (Phase 10 parity)
5. Hardening: tests, performance, accessibility, release prep

## Required Test Coverage

- Role-based route access matrix (`owner`, `office_staff`, `technician`, `dealer`)
- Quick-entry form org-safe validation (brand/technician restrictions)
- Rollback form enforces mandatory reason and handles 409 correctly
- Cancellation approval/rejection UX reflects backend final state
- Review token page correctly handles 404/409/410
- Notification center badge/read state consistency
- Offline queue replay and error state rendering

## Exit Criteria

- All primary workflows from backend Phases 00–10 are available in frontend UX.
- UI is visually aligned with design reference and component standards.
- Technician PWA supports offline queue + undo countdown UX.
- Frontend test suite passes in CI with required smoke coverage.
- No tenant-safety violations (no org leakage, no VCID exposure, no illegal action surfaces by role).

## Risks and Mitigations

- **Risk:** Design-reference drift between prototype and production implementation.
  - **Mitigation:** Establish component parity checklist and lock tokens/spacing/typography early.
- **Risk:** Offline queue conflicts with optimistic locking create confusing user outcomes.
  - **Mitigation:** Standardize 409 conflict UX with guided refresh/retry and preserved form state.
- **Risk:** Role guard gaps expose actions in UI not allowed by backend.
  - **Mitigation:** Centralize permission map and add route/action guard tests per role.