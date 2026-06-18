# Priority 1 — Job Workflow & Role Separation Design

**Date:** 2026-06-18  
**Scope:** Job creation/scheduling workflow fixes + role-based view separation  
**Stack:** Next.js 14 (App Router), React, TanStack Query, NestJS backend

---

## 1. Job Creation Workflow

### 1a. Log New Job — Owner / Office Staff

The existing 4-step wizard at `/log-new-job` is extended:

- **Step 1 — Job type & source** (unchanged)
  - Job type: installation | complaint
  - Source: direct | via_dealer (dealer selector appears when via_dealer)
- **Step 2 — Customer identity** (unchanged)
- **Step 3 — Job details** (extended)
  - Brand (required)
  - Unit details (required)
  - Notes/issue description
  - **Technician assignment** (optional) — new dropdown listing active technicians
  - **Scheduled at** (optional) — datetime-local input, already exists but was always shown; now explicit "optional" label
- **Step 4 — Review & submit** (updated to show technician and schedule if set)

**Scheduling logic on submit:**
- Both technician + scheduledAt provided → `scheduledAt` and `technicianId` sent in payload → backend creates job as `scheduled` status
- Either/both missing → omit from payload → backend creates job as `pending_schedule` → job enters Schedule & Assign queue

The `QuickCreateJobInput` type gains an optional `technicianId?: string` field. The `createQuickJob` API function passes it through as-is.

### 1b. Log New Job — Dealer

Dealers access the same `/log-new-job` route (already gated via `RoleGate`), but the form is role-aware:

- **Source field** — hidden; auto-set to `via_dealer` in payload
- **Dealer selector** — hidden; backend already auto-assigns `dealerId` from the session for dealer actors
- **Technician assignment** — hidden
- **Scheduled at** — hidden
- **Step count** — reduces to 3 steps: Job type → Customer identity → Job details → Review

The wizard detects role via `useAuth()` and conditionally renders fields. On submit the payload omits `source` (backend sets it), `dealerId`, `technicianId`, and `scheduledAt`. Job is always created as `pending_schedule`.

**Design language:** matches the Figma reference — white card form, 12px label / 13px input text, `#E5E5E5` borders, `#0A0A0A` buttons, step dots at top.

---

## 2. Role-Based View Separation

### 2a. Sidebar Navigation

| Nav item | Owner | Office Staff | Technician | Dealer |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Jobs | ✅ | ✅ | ✅ (active only) | ✅ (own jobs) |
| History | ❌ | ❌ | ✅ (completed) | ❌ |
| Schedule & Assign (was "Pending Schedule") | ✅ | ✅ | ❌ | ❌ |
| Technicians | ✅ | ✅ | ❌ | ❌ |
| Dealers | ✅ | ✅ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ |
| Payment methods | ✅ | ❌ | ❌ | ❌ |
| Admin | ✅ | ❌ | ❌ | ❌ |

Changes to `NAV_ITEMS` in `sidebar.tsx`:
1. Rename `"Pending Schedule"` → `"Schedule & Assign"`, href stays `/pending-schedule`
2. Add `"History"` nav item visible only to `technician` role, href `/jobs/history`
3. Remove `Dashboard` from technician (they go straight to Jobs) — **actually keep Dashboard**, just the "Log new job" header button is removed for technicians

**Log new job header button:** Currently shown globally in the app shell header. Hide it for `technician` role.

### 2b. Technician Jobs View

The `/jobs` page currently shows all jobs for the org. For technicians:
- **Jobs tab:** filter to `assignedTechnicianId === session.user.userId` + active statuses (not completed/resolved/cancelled)
- **History tab** (`/jobs/history`): filter to same technician + completed/resolved/cancelled statuses

This is frontend-only filtering since the API already returns jobs with `assignedTechnicianId`. No backend change needed.

A simple tab UI (`Jobs | History`) appears at the top of the jobs page for technician role only.

### 2c. Dealer Jobs View

The `/jobs` page for dealers shows only jobs submitted by them. The backend already filters by `dealerId` for dealer sessions (confirmed via `jobs.service.ts`). No backend change needed.

---

## 3. Out of Scope (Priority 1 only)

- Edit/delete jobs (Priority 1, item 3) — deferred to separate plan
- Mobile responsiveness (Priority 2)
- Technician/Dealer management overhaul (Priority 3)
- Brand deletion, notification redesign, job details redesign (Priority 4/5)

---

## 4. Files Touched

### Frontend
| File | Change |
|---|---|
| `src/types/operations.ts` | Add `technicianId?: string` to `QuickCreateJobInput` |
| `src/app/(protected)/log-new-job/page.tsx` | Role-aware form: hide source/dealer/technician/schedule for dealers; add technician dropdown for owner/office |
| `src/components/layout/sidebar.tsx` | Rename "Pending Schedule" → "Schedule & Assign"; add History item for technicians; update role visibility |
| `src/components/layout/app-shell.tsx` | Hide "Log new job" button for technician role |
| `src/app/(protected)/jobs/page.tsx` | Add tab UI for technicians (active vs history); filter jobs by role |
| `src/app/(protected)/jobs/history/page.tsx` | New page — technician history view (completed/resolved jobs) |
| `src/lib/api/operations.ts` | Fetch technicians list for assignment dropdown in job creation |

### Backend
No backend changes required for Priority 1. The backend already:
- Auto-sets `source: via_dealer` for dealer actors
- Supports optional `scheduledAt` and will be extended to accept optional `technicianId` in `CreateJobDto` (already has `IsOptional` pattern; confirm field exists)

---

## 5. Success Criteria

- [ ] Dealer logs a job: source/technician/schedule fields not shown; job lands in Schedule & Assign queue
- [ ] Owner logs a job with no technician/schedule: job lands in Schedule & Assign queue
- [ ] Owner logs a job with both: job created as `scheduled`
- [ ] Technician sidebar has no "Log new job" button; shows Jobs (active) and History (completed) tabs
- [ ] Sidebar shows "Schedule & Assign" (not "Pending Schedule")
- [ ] Dealer job list shows only their own jobs
