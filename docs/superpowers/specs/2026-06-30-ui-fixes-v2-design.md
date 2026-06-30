# CoolDesk UI Fixes v2 — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix all reported UI/UX issues across Jobs, Technicians, Dealers, Payments & Brands, Notifications, Sidebar, and System Config to match the Figma reference pixel-perfectly, with TDD throughout.

**Figma Reference:** https://sonata-tack-53126368.figma.site/dashboard

**Architecture:** Pure frontend changes except Schedule & Assign (backend query fix needed) and Payments & Brands (backend CRUD for payment methods). All status logic enforcement is frontend-only.

**Tech Stack:** Next.js (App Router), React, TanStack Query, NestJS (backend), PostgreSQL, TypeScript, inline styles matching existing palette.

---

## Global Constraints

- Color palette: `#0A0A0A` (near-black), `#FAFAFA` (near-white), `#F9F9F9` (bg), `#E5E5E5` (border), `#737373` (muted), `#171717` (body text), `#525252` (secondary text), `#404040` (tertiary text), `#10B981` (green/active), `#EF4444` (red/error), `#F59E0B` (amber)
- No Tailwind — all styles are inline `style={{}}` objects
- Existing font sizes: headings `36px` weight `600`, labels `13px`, helper `12px`, table headers `11px` uppercase weight `500-600` letter-spacing `0.04em`
- Border-radius: cards `12px`, buttons `8px`, pills `9999px`
- All new API functions go in `frontend/src/lib/api/` existing files (or `operations.ts`)
- All new TypeScript types go in `frontend/src/types/operations.ts`
- Backend changes use `DatabaseService.query` pattern (no raw `pg` Pool imports)
- TDD: write failing tests first, then implement. Backend tests in `*.service.spec.ts`; frontend unit tests with Jest/RTL where logic is testable
- Commit after each task with descriptive message

---

## Module 1 — Job Management

### Task 1: Job Creation — Confirmation Screen (Step 4)

**Files:**
- Modify: `frontend/src/app/(protected)/log-new-job/page.tsx`

**What to build:**
The existing 4-step wizard currently submits on step 4 completion. Replace step 4 (the "Schedule & Assign" step for owners) with a two-phase final step:

**Phase A — Review screen (before submit):**
Show a read-only summary of all entered data before creating the job:
- Section "Job details": Type chip, Source chip
- Section "Customer": Name, Phone, Address
- Section "Brand & units": Brand name, unit rows (model, type, count)
- Section "Schedule" (owner only): Scheduled date/time or "Not scheduled", Technician or "Unassigned"
- Two buttons: `← Back` and `Create job →` (black, full-width)

**Phase B — Success screen (after successful API call):**
Replace the form entirely with a centered success state:
- Green checkmark circle (CheckCircle icon, size 48, color `#10B981`)
- Heading "Job created" (24px, weight 600)
- Subtext "Job has been logged successfully." (13px, `#737373`)
- Job ID displayed in monospace pill (background `#F9F9F9`, border `#E5E5E5`)
- Two actions: `View job →` (links to `/jobs/{id}`) and `Log another job` (resets form)

**Implementation notes:**
- The existing `step` state goes 1 → 2 → 3 → 4 (review) → success
- `step === 4` shows the review screen; `step === 5` shows success
- Move the `createQuickJob` mutation call from step 3's "Continue" to step 4's "Create job" button
- `totalSteps` display stays "4" (review is step 4, success is outside the stepper)
- No backend changes needed

**Tests:**
- `log-new-job.test.tsx`: renders review screen at step 4 with correct summary data; "Create job" triggers mutation; success screen shows job ID; "Log another job" resets to step 1

---

### Task 2: Schedule & Assign — Fix Unassigned/Unscheduled Job Filtering

**Files:**
- Modify: `backend/src/modules/jobs/jobs.service.ts` (around line 740, `getPendingScheduleJobs`)
- Modify: `backend/src/modules/jobs/jobs.service.spec.ts`

**What to build:**
The current query only fetches `status = 'pending_schedule'`. The Figma shows the Schedule & Assign tab includes ALL jobs that need attention — both installations awaiting scheduling AND complaints awaiting assignment.

Update the `getPendingScheduleJobs` query to fetch jobs where **any** of these is true:
1. `status = 'pending_schedule'` (installation awaiting office scheduling)
2. `status = 'new'` AND `type = 'complaint'` (complaint not yet assigned to technician)
3. `status = 'scheduled'` AND `technician_id IS NULL` (scheduled but no technician assigned)

SQL (replacing the single `status = 'pending_schedule'` condition):
```sql
WHERE j.is_deleted = FALSE
  AND j.organization_id = $1
  AND (
    j.status = 'pending_schedule'
    OR (j.status = 'new' AND j.type = 'complaint')
    OR (j.status = 'scheduled' AND j.technician_id IS NULL)
  )
ORDER BY j.created_at ASC
LIMIT $2
```

Also fix "Jobs with status Scheduled but no date displayed" — the existing `PendingScheduleJob` type and row mapper must include `scheduled_at` from the query result; confirm the SELECT already includes `j.scheduled_at` and the frontend displays it when present.

**Frontend fix for missing scheduled date display** (`pending-schedule/page.tsx`):
In the table row, add a "SCHEDULED" column between SUBMITTED and DAYS WAITING that shows `formatScheduled(job.scheduledAt)` when it exists, or "—" when null.

**Tests (`jobs.service.spec.ts`):**
- `returns pending_schedule installation jobs`
- `returns new complaint jobs`  
- `returns scheduled jobs with no technician`
- `does not return completed/cancelled/assigned jobs`

---

### Task 3: All Jobs Page — Search Fix, Filters Button, Remove Duplicate Button

**Files:**
- Modify: `frontend/src/components/jobs/jobs-list.tsx`
- Modify: `backend/src/modules/jobs/jobs.service.ts` (search query, if needed)

**What to build:**

**3a — Remove duplicate "Log new job" button:**
The `JobsList` component renders a `<Link href="/log-new-job">Log new job</Link>` button inside the page header for non-technician users. Remove it. The "Log new job" button lives exclusively in the top nav bar (header layout).

**3b — Fix search:**
The search input currently sets `search` state which flows into `queryInput.search`. Verify the backend `listJobs` query uses the search term against `customer_name`, `id` (partial), and `brand_name`. If not working, check `jobs.service.ts` `listJobs` for the `search` param handling and add `ILIKE '%' || $n || '%'` clauses if missing.

**3c — Filters button alignment:**
Per Figma: the search bar and Filters button sit on the same row BUT the Filters button is flush right (top-right corner of the content area), not immediately after the search bar. Update the layout:
```
[Search bar (flex: 1)]    [Filters button (fixed right)]
```
The filter panel that drops down below is unchanged.

**Tests:**
- `jobs-list.test.tsx`: does not render "Log new job" button for owner role; search input updates query; filters button toggles panel

---

### Task 4: Job Status — Frontend Lifecycle Guard

**Files:**
- Modify: `frontend/src/components/jobs/job-detail.tsx`
- Modify: `frontend/src/lib/job-status-groups.ts` (or create helper)

**What to build:**
In the job detail view, the status action buttons (e.g., "Mark Complete") must be hidden (not just disabled) when the job does not meet lifecycle prerequisites:

Rules (frontend-only):
- Hide **any forward-progress action** if `job.technicianId === null` AND job type is `installation`  
- Hide **"Mark Completed"** if `job.scheduledAt === null` AND job type is `installation`
- Complaints follow their own flow (`new → assigned`) — no schedule required

Helper function to add:
```typescript
// src/lib/job-status-groups.ts
export function canProgressInstallation(job: { technicianId: string | null; scheduledAt: string | null; type: string }): boolean {
  if (job.type !== 'installation') return true;
  return job.technicianId !== null && job.scheduledAt !== null;
}
```

In `job-detail.tsx`, wrap the action button section with:
```typescript
const showActions = canProgressInstallation(job);
```
And conditionally render the forward-action buttons only when `showActions` is true. Show a muted helper text instead: "Assign a technician and schedule this job to enable actions."

**Tests:**
- `canProgressInstallation`: returns false when technician null; returns false when scheduledAt null; returns true when both set; always returns true for complaint type

---

## Module 2 — Technicians & Dealers

### Task 5: Technician Detail Overlay

**Files:**
- Create: `frontend/src/components/technicians/TechnicianDetailPanel.tsx`
- Modify: `frontend/src/app/(protected)/technicians/page.tsx`
- Modify: `frontend/src/lib/api/operations.ts` (add fetch function)
- Modify: `frontend/src/types/operations.ts` (add types)

**What to build:**
Clicking anywhere on a technician row (not just the Edit button) opens a slide-in panel from the left side of the screen (overlapping the sidebar).

**Panel layout** (fixed, `left: 0`, `top: 0`, `bottom: 0`, `width: 340px`, `backgroundColor: #FAFAFA`, `borderRight: 1px solid #E5E5E5`, z-index above sidebar):
- **Header:** Avatar (48px), Name (18px bold), Active badge (`#10B981`), close `×` button top-right
- **Contact row:** Phone icon + phone, Email icon + email, Location icon + city, "Since {date}"
- **Tabs:** `Job History` | `Ongoing ({count})` — underline indicator, same pattern as existing tab bars
- **Job History tab:** Table with columns JOB ID | CUSTOMER | TYPE | STATUS | AMOUNT | RATING
  - JOB ID: monospace truncated to 8 chars
  - CUSTOMER: plain text
  - TYPE: JobTypeChip
  - STATUS: StatusChip
  - AMOUNT: `SAR {amount}` in green `#10B981` if collected, `—` if null
  - RATING: star icons (filled/empty), `—` if null
- **Ongoing tab:** Same table structure but filtered to non-terminal jobs only
- Overlay background (`rgba(0,0,0,0.3)`) behind panel — clicking it closes the panel

**New API call** (`fetchTechnicianJobHistory(technicianId, orgId)`):
```sql
SELECT j.id, j.customer_name, j.type, j.status,
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'collected'), 0) AS amount_collected,
       ROUND(AVG(r.rating), 1) AS avg_rating
FROM jobs j
LEFT JOIN payments p ON p.job_id = j.id AND p.organization_id = j.organization_id AND p.is_deleted = FALSE
LEFT JOIN customer_reviews r ON r.job_id = j.id AND r.organization_id = j.organization_id
WHERE j.organization_id = $1
  AND j.technician_id = $2
  AND j.is_deleted = FALSE
GROUP BY j.id, j.customer_name
ORDER BY j.created_at DESC
LIMIT 50
```
Note: `customer_name` is stored directly on the `jobs` table — no separate `customers` table exists.

Add endpoint `GET /office/technicians/:id/jobs` in `jobs.controller.ts` / `jobs.service.ts`.

**New types:**
```typescript
export type TechnicianJobHistoryItem = {
  id: string;
  customerName: string;
  type: 'installation' | 'complaint';
  status: string;
  amountCollected: number;
  avgRating: number | null;
};
```

**Tests:**
- `TechnicianDetailPanel.test.tsx`: renders with technician data; shows Job History tab by default; switches to Ongoing tab; close button calls onClose

---

### Task 6: Dealer Detail Overlay + UI Consistency

**Files:**
- Create: `frontend/src/components/dealers/DealerDetailPanel.tsx`
- Modify: `frontend/src/app/(protected)/dealer-management/page.tsx`

**What to build:**
Mirror Task 5 exactly for dealers. The dealer detail panel shows:
- **Header:** Avatar (initials), company name, Active/Inactive badge, close button
- **Contact row:** Contact name (if set), email, region
- **Tabs:** `Job History` | `Active Jobs ({count})`
- **Job History tab:** Same table as technician (JOB ID | CUSTOMER | TYPE | STATUS | AMOUNT)
- **Active Jobs tab:** Only jobs with non-terminal status submitted by this dealer

New API call: `GET /office/dealers/:id/jobs` returning same structure.

Also fix the Dealer Edit form to match Technician Edit form — currently they differ. Both should show: Name (read-only for dealers since it's the company name), Contact name (editable), Email (editable for dealers), Region (editable for dealers), Active/Inactive toggle, Save button.

Check `frontend/src/app/(protected)/dealer-management/page.tsx` — the existing Edit modal for dealers has Contact name, email, region from recent commits (cec25d2). Confirm those fields render correctly.

**Tests:**
- `DealerDetailPanel.test.tsx`: renders with dealer data; shows Job History tab; switching tabs works; close dismisses panel

---

## Module 3 — System Configuration

### Task 7: Remove Brand Sub-Tab from System Config / Sidebar

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx`
- Modify: `frontend/src/app/(protected)/admin/` (check for brand tab reference)

**What to build:**
The Figma System Config page has **no Brand sub-tab**. Brands are managed exclusively in Payments & Brands.

- Remove any "Brands" or "Brand management" link from the sidebar `NAV_ITEMS` array
- Check `/admin/brands/page.tsx` — if it only manages brands (which are now in Payments & Brands), add a redirect: `redirect('/payment-methods')` at the top of that page so any old bookmarked links still work
- The sidebar currently has no brand link (verified in the code — `NAV_ITEMS` doesn't include brands), but confirm the `admin` nav item doesn't show a dropdown with Brands
- The `/admin/system-config` route should remain as-is (the Figma routes to `/settings` but the existing app uses `/admin/system-config` — keep existing route)

**Tests:**
- Confirm no "Brand" or "Admin > Brand" nav item appears for owner role in sidebar render

---

## Module 4 — Payments & Brands

### Task 8: Payments & Brands — Tab Rename + Add Payment Method + Brand Display

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx` (label update)
- Modify: `frontend/src/app/(protected)/payment-methods/page.tsx`
- Modify: `frontend/src/components/payment-methods/PaymentMethodsSection.tsx`
- Modify: `frontend/src/lib/api/operations.ts`
- Modify: `frontend/src/types/operations.ts`
- Modify: `backend/src/modules/payments/` (add payment method CRUD endpoints if missing)

**What to build:**

**8a — Sidebar rename:**
Change label `"Payment Methods"` → `"Payments & Brands"` in `sidebar.tsx` `NAV_ITEMS`.

**8b — Page title & subtitle:**
Change page `<h1>` from "Payment Methods" to "Payments & Brands" with subtitle "Manage payment methods, service item pricing, and brands".

**8c — Payment Methods section (matches Figma):**
The section shows a table: METHOD | STATUS | ACTIONS with edit (pencil) and delete (trash) icon buttons. An "+Add" button opens a modal to create a new payment method.

Add modal fields: Method name (text input, required). On save: POST to `/payments/methods` or existing endpoint.

Check existing `PaymentMethodsSection.tsx` — it uses toggles. Replace with the Figma table layout:
- Each row: credit-card icon + method name | Active/Inactive pill | edit icon + delete icon
- Active pill: `background: rgba(16,185,129,0.1)`, `color: #10B981`, `border: 1px solid rgba(16,185,129,0.2)`
- Inactive: `color: #737373`, `background: #F9F9F9`

**8d — Brands section:**
Below payment methods (and service items if present), add a "Brands" section with:
- Section header: stack icon + "Brands" title + subtitle "Colour coding for the owner portal and installation charges" + "+Add" button (black)
- Table: BRAND | INSTALLATION CHARGE (SAR) | STATUS | ACTIONS
- Each brand row: colored square swatch (`brand.colorHex`, 16×16, border-radius 4px) + brand name | `SAR {installationCharge}` in green if active | Active/Inactive pill | edit + delete icons
- "+Add" opens existing brand creation modal (from `/admin/brands` logic)
- Brands data: use existing `fetchOfficeBrands()` API call (already returns brands)

`installation_charge` does NOT exist yet in the DB or backend. Add it as part of this task:

**DB migration** — `ALTER TABLE brands ADD COLUMN IF NOT EXISTS installation_charge NUMERIC(10,2) NOT NULL DEFAULT 0;`  
Run this in `DatabaseService` at app startup or as a migration script `backend/migrations/add-brand-installation-charge.sql`.

**Backend** (`brands.service.ts`): add `installation_charge` to the SELECT in `listBrands`; add it to the DTO and update-brand handler.

**Frontend mapper** (`fetchOfficeBrands` in `operations.ts`): add `installationCharge: asNumber(row.installation_charge)` to the return type and mapper.

**Existing `BrandItem` type** in `types/operations.ts`: add `installationCharge: number`.

**Tests:**
- `payment-methods.test.tsx`: renders "Payments & Brands" heading; shows brands table with color swatches; Add payment method modal opens/closes; Add brand button present

---

## Module 5 — Notifications Redesign

### Task 9: Notifications — Complete Redesign

**Files:**
- Modify: `frontend/src/app/(protected)/notifications/page.tsx`

**What to build:**
Complete rewrite of the notifications page to match Figma exactly. Keep existing data-fetching hooks (`fetchNotifications`, `fetchUnreadNotificationCount`, `markNotificationRead`) — only replace the UI layer.

**New layout:**

```
Notifications    [4 unread]         [✓ Mark all read]
[All] [Unread] [Cancellations] [Assignments]
─────────────────────────────────────────────
• [TITLE — Job #XXXX]              05 May, 10:30  ⚠
  [Description text up to 2 lines]
  View job XXXX →
─────────────────────────────────────────────
```

**Tab filter logic:**
- All: all notifications
- Unread: `!n.isRead`
- Cancellations: `n.eventType.includes('cancellation')` or `n.eventType === 'cancellation_requested'`
- Assignments: `n.eventType.includes('assign')` or `n.eventType === 'job_assigned'`

**Item styles:**
- Unread items: left border `3px solid #0A0A0A`, background `#FAFAFA`
- Read items: no left border, background white
- Unread blue dot: `8px` circle, `backgroundColor: #3B82F6`, `borderRadius: '50%'`
- Title: `14px`, `fontWeight: 600`, `color: #171717`
- Timestamp: `12px`, `color: #737373`, right-aligned
- Description: `13px`, `color: #525252`, max 2 lines (CSS `-webkit-line-clamp: 2`)
- "View job XXXX →": `12px`, `color: #0A0A0A`, `fontWeight: 500`, `textDecoration: none`, link to `/jobs/{jobId}` (parse jobId from `n.payload`)
- Warning triangle (⚠): show for `eventType` containing `chronic`, `amber`, `no_show`, `cancellation` — color `#F59E0B`

**Tab bar style:**
- Active tab: `fontWeight: 600`, `color: #0A0A0A`, `borderBottom: 2px solid #0A0A0A`
- Inactive: `color: #737373`, `borderBottom: 2px solid transparent`
- Unread count badge on tabs: small pill `backgroundColor: #0A0A0A`, `color: #FAFAFA`, `fontSize: 11px`

**"Mark all read" button:** border `1px solid #E5E5E5`, background white, calls `markAllRead` mutation.

**Empty state:** Bell icon (size 32, `#E5E5E5`) + "No notifications" + "You're all caught up."

Remove the existing verbose JSON payload display. Extract job ID from payload for the "View job" link.

**Tests:**
- `notifications.test.tsx`: renders tabs; Unread tab filters correctly; Cancellations tab filters correctly; Mark all read button present; empty state renders

---

## Module 6 — Sidebar Collapse

### Task 10: Sidebar — Smooth Icon-Only Collapsed State

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx`
- Modify: `frontend/src/app/(protected)/layout.tsx` (adjust main content margin)

**What to build:**
Currently when `collapsed === true` on desktop, the sidebar width goes to `56px` but the nav links still try to render text (which overflows or wraps). The Figma shows a clean icon-only state with no text visible.

**Changes to `sidebar.tsx`:**

1. **Hide text labels when collapsed** — wrap nav item label in:
```tsx
{!collapsed && <span style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 150ms ease' }}>{item.label}</span>}
```
Actually: only render the label span when `!collapsed` to avoid layout issues.

2. **Hide the CoolDesk wordmark when collapsed** — only show the `<Zap>` icon, hide `<span>CoolDesk</span>` and the toggle button when collapsed (show a centered icon instead):
```tsx
// collapsed header: just the Zap icon centered, clicking it expands
// expanded header: Zap + "CoolDesk" + Menu toggle button
```

3. **Collapsed "expand" trigger** — at the bottom, replace "Collapse" with a `>` chevron (`ChevronRight`) when collapsed. When expanded, show `< Collapse` with `ChevronLeft`.

4. **Tooltip on hover when collapsed** — add `title={item.label}` on the `<Link>` so browsers show a native tooltip for the icon when sidebar is collapsed.

5. **Smooth transition** — the sidebar already has `transition: 'width 220ms ease-in-out'`. The content inside also needs `overflow: hidden` at the sidebar level (already set) and each nav item needs `overflow: hidden; white-space: nowrap` so text doesn't wrap during transition.

6. **Main content margin** — in `layout.tsx`, the left margin of the main area must match sidebar width: `marginLeft: collapsed ? '56px' : '240px'` with the same `transition: 'margin-left 220ms ease-in-out'`.

**Collapsed nav item layout:**
```tsx
<Link style={{
  padding: collapsed ? '10px 0' : '10px 12px',
  justifyContent: collapsed ? 'center' : 'flex-start',
  ...
}}>
  <Icon size={17} />
  {!collapsed && <span>{item.label}</span>}
</Link>
```

**Tests:**
- `sidebar.test.tsx`: when collapsed prop is true, labels are not rendered; icon is rendered; when expanded, labels are rendered

---

## Execution Order

Tasks should be executed in this sequence (dependencies noted):
1. Task 10 — Sidebar collapse (foundational, affects all pages)
2. Task 7 — Remove Brand sub-tab (quick cleanup)
3. Task 3 — All Jobs page fixes (quick wins)
4. Task 4 — Job status lifecycle guard (frontend helper)
5. Task 1 — Job creation confirmation screen
6. Task 2 — Schedule & Assign backend + frontend fix
7. Task 8 — Payments & Brands full redesign
8. Task 9 — Notifications redesign
9. Task 5 — Technician detail overlay (new component + backend endpoint)
10. Task 6 — Dealer detail overlay (mirrors Task 5)
