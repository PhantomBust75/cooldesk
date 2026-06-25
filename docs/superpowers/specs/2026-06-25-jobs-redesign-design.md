# Jobs Page Redesign — Design Spec

**Date**: 2026-06-25
**Reference**: https://sonata-tack-53126368.figma.site/jobs (screenshots captured 2026-06-25)
**Scope**: Pixel-perfect Figma replica for All Jobs list page and Job Detail page
**Status**: Approved

---

## Summary of Changes

| Area | Change type |
|---|---|
| All Jobs — inline filter bar | New |
| All Jobs — TAGS column | New |
| All Jobs — row chevron | New |
| Job Detail — tabbed layout | Full redesign |
| Job Detail — right sidebar (Advance Status + Actions) | Full redesign |
| Job Detail — Details tab layout | New |
| Job Detail — Timeline tab redesign | Redesign |
| Job Detail — Payment tab | Placeholder |
| Job Detail — Review tab | Placeholder |

---

## Part 1 — All Jobs List (`/jobs`)

### Files touched
- `frontend/src/components/jobs/jobs-list.tsx`

### 1.1 Inline filter bar

A second filter row renders between the search input and the table. It contains three dropdowns and one toggle:

| Control | Type | Options | API param |
|---|---|---|---|
| STATUS | `<select>` | All statuses + each status | `filter.status` |
| TYPE | `<select>` | All types / Installation / Complaint | `filter.type` |
| BRAND | `<select>` | All brands + fetched brands | `filter.brandId` |
| Chronic only | checkbox | On/Off | `filter.chronicOnly: boolean` |

- Dropdowns are styled consistently: `border: 1px solid #E5E5E5`, `borderRadius: 8px`, `padding: 6px 10px`, `fontSize: 13px`, `backgroundColor: #fff`
- Row sits in a flex container with `gap: 8px`, `padding: 0 24px 12px`
- The existing side drawer remains for full filter access ("Filters" button top-right unchanged)
- Applying inline filter controls immediately triggers a new API query (no separate Apply step)

### 1.2 TAGS column

Added as the second-to-last column in the desktop table (before the chevron column).

- Column header: `TAGS`
- Data source: `job.tags` array — values are strings: `"chronic"`, `"frequent"`, `"repeat"`
- Renders `<TagChip>` (already exists in `job-type-chip.tsx`) for each tag. Empty = nothing rendered.
- Tag chip variants:
  - `chronic` → red (`#FFF1F2` / `#9F1239` / `#FECDD3`)
  - `frequent` → amber (`#FEFCE8` / `#854D0E` / `#FEF08A`)
  - `repeat` → slate (`#F1F5F9` / `#1E293B` / `#E2E8F0`)

### 1.3 Row chevron

Each desktop table row gets a final `<td>` containing a `<ChevronRight size={14} color="#A3A3A3" />`. This column has no header (`<th>` is empty). Width: `40px`.

### 1.4 Type and backend changes required for tags

The DB columns `is_repeat`, `is_frequent`, `is_chronic` exist on the `jobs` table but are **not** included in the `listJobs` SQL SELECT in `backend/src/modules/jobs/jobs.service.ts` (line ~648). They are included in `getJobDetail`.

**Backend change**: Add `j.is_repeat, j.is_frequent, j.is_chronic` to the `listJobs` SELECT query.

**Frontend type change** (`frontend/src/types/jobs.ts`):
- Add `tags: string[]` to `JobListItem` and `JobDetail`
- Add `chronicOnly?: boolean` to `JobListFilter`

**Frontend mapper change** (`frontend/src/lib/api/jobs.ts`):
- In `mapJobListItem`: derive `tags` from `is_chronic`, `is_frequent`, `is_repeat` booleans → push `"chronic"`, `"frequent"`, `"repeat"` strings as present
- In `mapJobDetail`: same mapping
- In `fetchJobs`: pass `chronic_only=true` param when `query.chronicOnly` is true

**Backend DTO** (`ListJobsQueryDto`): add optional `chronic_only: boolean` field and filter `AND j.is_chronic = TRUE` when set.

---

## Part 2 — Job Detail (`/jobs/[id]`)

### Files touched
- `frontend/src/components/jobs/job-detail.tsx` (full restructure)

### 2.1 Overall layout

```
┌─────────────────────────────────────────────────┬──────────────┐
│ Header (breadcrumb + ID + status + metadata)    │              │
├─────────────────────────────────────────────────┤  Right       │
│ Tab bar: Details | Timeline | Payment | Review  │  Sidebar     │
├─────────────────────────────────────────────────┤              │
│ Tab content                                     │              │
└─────────────────────────────────────────────────┴──────────────┘
```

Desktop: `grid-template-columns: 1fr 280px`, gap `24px`
Mobile: single column, sidebar stacks below tabs

### 2.2 Header block

```
← All jobs / AB123456                       (breadcrumb, 12px #737373)

AB123456  [copy icon]  [Needs revisit chip]  (H1, 28px bold #0A0A0A)

Daikin · Installation · Revisit #3 · Chronic  (metadata line, 13px #525252, Chronic in #9F1239)
```

- Breadcrumb uses `<Link href="/jobs">All jobs</Link>` + ` / ` + short ID (first 8 chars)
- Copy icon: `Copy` from lucide, 14px. Click copies full job ID to clipboard via `navigator.clipboard.writeText`
- Metadata line items separated by ` · `:
  - Brand name (if set)
  - Type label ("Installation" / "Complaint")
  - `Revisit #N` — only shown when `revisitsQuery.data?.length > 0`, N = length
  - Tag chips inline — `Chronic`, `Frequent`, `Repeat` rendered as colored text (not pill), matching Figma

### 2.3 Tab bar

Four tabs: `Details` | `Timeline` | `Payment` | `Review`

- Active tab: `borderBottom: 2px solid #0A0A0A`, `color: #171717`, `fontWeight: 600`
- Inactive tab: `color: #737373`, `fontWeight: 400`
- `fontSize: 14px`, `padding: 10px 0`, tabs separated by `gap: 24px`
- Tab bar has `borderBottom: 1px solid #E5E5E5`
- State managed via `useState<'details'|'timeline'|'payment'|'review'>('details')`

### 2.4 Right sidebar

**Advance Status button**
- Full-width black button: `backgroundColor: #0A0A0A`, `color: #fff`, `borderRadius: 10px`, `padding: 14px`, `fontSize: 14px`, `fontWeight: 600`
- Label: `Advance Status →`
- Behavior: if `nextStatuses.length === 1`, click directly transitions to that status (calls existing `transitionMutation`). If `nextStatuses.length > 1`, opens a small inline dropdown to pick. If `nextStatuses.length === 0`, button is disabled with `opacity: 0.4`.

**Actions dropdown**
- Outlined button below Advance Status: `border: 1px solid #E5E5E5`, `borderRadius: 10px`, `padding: 10px 14px`, label `Actions ↓`
- Clicking toggles a dropdown panel below the button:
  - Roll back status (existing `rollbackMutation`) — shown only for `office_staff`
  - Override status (opens existing override modal) — shown only for `owner`
  - Reassign technician (opens a small modal: technician dropdown + confirm) — shown for `owner` and `office_staff`
  - Manage payment (switches to Payment tab)
  - Cancel job (red text — sets `overrideStatus = "cancelled"` then opens override modal) — shown for `owner`

**Payment summary card**
- Below Actions dropdown
- Header: `PAYMENT` in 11px uppercase `#737373`
- If no payment: "No payment recorded" in 13px `#737373`
- If payment exists: amount + method name in 13px `#171717`

### 2.5 Details tab

Two-column layout (`grid-template-columns: 1fr 1fr`, gap `32px`) at `padding: 24px 0`:

**CUSTOMER column**
- Section label: `CUSTOMER` — 11px uppercase `#737373`, `letterSpacing: 0.06em`
- Rows (label + value pairs, label in `#A3A3A3` 12px, value in `#171717` 13px):
  - Name → `{detail.customerName}`
  - Phone → `{detail.phone}` with `<Phone size={12}>` icon
  - Address → `{detail.address}` with `<MapPin size={12}>` icon

**SCHEDULE column**
- Section label: `SCHEDULE`
- Rows:
  - Technician → name or "Unassigned"
  - Scheduled → formatted date/time or "—"

**Show technical details collapsible**
- Full-width row below the two columns
- `↓ Show technical details` toggle link (13px `#737373`)
- Expands to show: Source, Version, Issue description / Installation notes (raw text)

### 2.6 Timeline tab

Vertical list, each event rendered as a card:

```
[icon]  Status changed                    05 May, 09:00
        Ahmed Al-Rashid
        "Refrigerant level still low..."   ← only if reason exists

        in_transit → needs_revisit         ← status chip pair, only for status_change events
```

- Icon: small circle (8px) colored by event type — `status_change` (#0A0A0A), `system` (#6B7280), others (#E5E5E5)
- Event type label: 13px `#171717` bold
- Actor + timestamp: 12px `#737373`, timestamp right-aligned
- Reason/note: 13px italic `#525252`, shown in a light gray box (`#F9F9F9`, `borderRadius: 6px`, `padding: 8px`)
- Status transitions: render two `<StatusChip>` components separated by `→` arrow

### 2.7 Payment tab

Placeholder:
```
No payment data available yet.
```
Centered, 13px `#737373`, `padding: 40px 0`.

### 2.8 Review tab

Placeholder:
```
Customer review coming soon.
```
Centered, 13px `#737373`, `padding: 40px 0`.

---

## Color / token reference

All values use existing project palette — no new colors introduced:

| Token | Value |
|---|---|
| Text primary | `#171717` |
| Text secondary | `#525252` |
| Text muted | `#737373` |
| Border | `#E5E5E5` |
| Surface | `#fff` |
| Destructive text | `#9F1239` |
| Chronic chip | `#FFF1F2` / `#9F1239` / `#FECDD3` |
| Frequent chip | `#FEFCE8` / `#854D0E` / `#FEF08A` |
| Repeat chip | `#F1F5F9` / `#1E293B` / `#E2E8F0` |

---

## Out of scope

- Backend changes for `chronicOnly` filter (frontend sends param; backend may ignore until wired)
- Payment tab real data
- Review tab real data
- Mobile layout changes (preserve existing mobile card view)
- Reassign technician API (UI shows modal, backend wiring deferred)
