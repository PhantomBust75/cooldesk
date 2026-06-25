# Figma Dashboard Redesign — Design Spec

**Date**: 2026-06-23  
**Reference**: https://sonata-tack-53126368.figma.site/dashboard  
**Scope**: Pixel-perfect replica of Figma Owner's View UI across all 8 sidebar modules  
**Approach**: Module-by-module (shell → dashboard → jobs → schedule → technicians/dealers → analytics → payments & brands → system config)

---

## Decisions

| Question                                     | Decision                                  |
| -------------------------------------------- | ----------------------------------------- |
| New metrics (Chronic, Amber, No-shows, Tags) | Add real backend support                  |
| Page structure vs Figma                      | Fully align (merge pages, update routes)  |
| Global search                                | Fully functional, debounced API query     |
| Mobile layouts                               | Preserve existing mobile layouts          |
| Analytics depth                              | All 4 tabs with real backend data         |
| Sidebar                                      | No changes — keep current sidebar exactly |

---

## Module 1 — App Shell (Top Bar)

### What changes

- Sidebar: **no changes** (labels, icons, colors, collapse behavior all stay)
- Add a persistent top bar (currently absent)

### Top Bar spec

- Height: 56px, `#FFFFFF` background, `1px solid #E5E5E5` bottom border
- Left: empty (sidebar occupies left column)
- Center: search input, placeholder "Search jobs, customers…", `⌘K` badge on right side of input
- Right (left to right): `+ Log new job` outlined button → opens existing log-job flow | notification bell icon with red dot for unread | avatar circle showing logged-in user initials (e.g. "OW"), `#0A0A0A` bg, white text

### Global Search Modal (⌘K)

- Triggered by clicking search input or pressing ⌘K (Ctrl+K on Windows)
- Full-screen overlay, centered modal, max-width 560px
- Search input at top, results below
- Debounce: 300ms
- New endpoint: `GET /search?q=&limit=10`
  - Queries jobs by ID prefix and customer name (ILIKE)
  - Returns `{ jobs: [{ id, customerName, status }] }`
- Results grouped under "Jobs" heading with Job ID (monospace) + customer name + status chip
- Empty state: "No results for 'X'"
- Close on Escape or click outside

---

## Module 2 — Dashboard

### Page header

- Title: "The Control Tower" (unchanged)
- Subtitle: "Organization-wide overview · last 7 days"

### KPI Cards (5 cards)

| Card              | Metric                                                               | Accent    | Backend field     |
| ----------------- | -------------------------------------------------------------------- | --------- | ----------------- |
| Total active jobs | Jobs not completed/cancelled                                         | `#0A0A0A` | `totalActiveJobs` |
| Pending schedule  | Jobs with no scheduled date                                          | `#3B82F6` | `pendingSchedule` |
| Amber alerts      | Jobs waiting > `amber_alert_days` threshold                          | `#F59E0B` | `amberAlerts`     |
| Chronic jobs      | Customers with complaints ≥ `frequent_complaint_threshold` in window | `#EF4444` | `chronicJobs`     |
| No-shows today    | Scheduled jobs with no check-in after `no_show_hours`                | `#8B5CF6` | `noShowsToday`    |

**Card anatomy** (matching Figma):

- Thin colored top border (3px)
- Row 1: icon + metric label (left) + % change badge with arrow (right)
- Row 2: large number (40px bold)
- Row 3: full-width sparkline chart (7-day trend), colored to match accent

**New endpoint**: `GET /dashboard/metrics`

- Returns all 5 counts + `trends: { [key]: number[] }` (7 values, one per day)
- Chronic/Amber/No-show computed from job data using system config thresholds

### Needs Revisit Table

- Section header: "Needs revisit" + count badge + "Chronic first" sort dropdown (right)
- Columns: CUSTOMER, BRAND, TECHNICIAN, LAST VISIT, REVISIT #, TAGS, chevron
- Red left-border accent (3px) on rows where revisit # ≥ 3
- Tags: pill chips — Frequent (amber `#FEF3C7`/`#92400E`), Chronic (red), Repeat (gray)
- Clicking row navigates to job detail

**Backend**: Add `revisit_count` integer column to jobs table (migration). Auto-increment when job status transitions to `needs_revisit`. Tags derived from system config rules.

### Active Jobs Table

- Section header: "Active jobs" + count badge + "View all ↗" link (top right)
- Columns: CUSTOMER, BRAND, TECHNICIAN, SCHEDULED, STATUS, TAGS, chevron
- Max 9 rows shown
- Status chips match existing `StatusChip` component
- Red left-border on `needs_revisit` status rows

---

## Module 3 — All Jobs

### Page header

- Title: "All jobs" + "N jobs" subtitle
- Top right: `Filters` outlined button (opens filter drawer)

### Search

- Below header: "Search by name, job ID, brand…" input
- Client-side filter on loaded job list

### Table columns

| Column     | Notes                                                            |
| ---------- | ---------------------------------------------------------------- |
| JOB ID     | Monospace, existing                                              |
| CUSTOMER   | Existing                                                         |
| PHONE      | Customer phone — already on job record                           |
| TYPE       | Icon + label (Installation wrench icon / Complaint speech icon)  |
| SOURCE     | Icon + label (Direct → arrow icon / Dealer name + building icon) |
| BRAND      | Colored text (brand link color `#0A0A0A` underline on hover)     |
| TECHNICIAN | Name or italic gray "Unassigned"                                 |
| SCHEDULED  | Date+time or `—`                                                 |
| STATUS     | StatusChip                                                       |

### Filters Drawer

- Side drawer (right), width 320px
- Filter fields: Status (multi-select chips), Brand (dropdown), Technician (dropdown), Type (Installation/Complaint toggle), Date range (from/to inputs)
- "Apply" black button, "Clear all" text link
- Filters applied to `GET /jobs` query params

---

## Module 4 — Schedule and Assign

### Page header

- Title: "Schedule and Assign" + "N jobs awaiting scheduling" subtitle
- Top right: `Batch schedule` outlined button

### Table columns

| Column            | Notes                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| JOB ID            | Monospace                                                                            |
| CUSTOMER          | Plain text                                                                           |
| TYPE              | Icon + label                                                                         |
| BRAND             | Text                                                                                 |
| DEALER            | Dealer name or `—`                                                                   |
| SUBMITTED         | Created date                                                                         |
| DAYS WAITING      | Integer days. Red `⊙ Nd` with underline when > `overdue_schedule_days` threshold     |
| SCHEDULE & ASSIGN | Inline date-time picker + technician dropdown. Saves on change via `PATCH /jobs/:id` |

### Batch Schedule Modal

- Triggered by "Batch schedule" button
- Lists all unscheduled jobs with checkboxes
- Single date-time picker + technician dropdown applied to all selected
- "Schedule N jobs" black confirm button
- New endpoint: `POST /jobs/batch-schedule` — body: `{ jobIds: string[], scheduledAt: string, technicianId: string }`

---

## Module 5 — Technicians

### Page header

- Title: "Technicians" + "N active · N total" subtitle
- Top right: `+ Add technician` black button

### List rows

- Avatar circle: 40px, pastel bg + dark initials, color deterministic from name hash (8 color pairs)
- Name: 15px `#0A0A0A`
- Right side: Active|Inactive segmented pill toggle + `✎ Edit` text button
- Inactive rows: avatar + name in muted gray `#A3A3A3`
- Toggle calls existing `PATCH /technicians/:id` with `{ isActive: boolean }`
- Add/Edit: existing modal unchanged

### Avatar color pairs (8 options)

bg/text: `#DBEAFE`/`#1E40AF`, `#D1FAE5`/`#065F46`, `#FEF3C7`/`#92400E`, `#FCE7F3`/`#9D174D`, `#EDE9FE`/`#5B21B6`, `#FFE4E6`/`#9F1239`, `#F0FDF4`/`#14532D`, `#FFF7ED`/`#9A3412`

---

## Module 6 — Dealers

Identical pattern to Technicians module.

### Page header

- Title: "Dealer Management" + "N dealers" subtitle
- Top right: `+ Add dealer` black button

### List rows

- Same avatar circle pattern (deterministic color from name)
- Active|Inactive toggle + `✎ Edit` button
- Toggle calls existing `PATCH /dealers/:id`

---

## Module 7 — Analytics

### Page header

- Title: "Analytics" + "Last 7 days · [Month Year]" subtitle
- Top right: `↓ Export CSV` outlined button (exports current tab data as CSV download)

### Tabs

`Business` | `Technician scorecards` | `Brand` | `Dealer`

### Business tab

- 4 KPI summary cards (no sparklines): Total revenue (SAR), Completion rate, On-time rate, Avg resolution
  - Each shows value + colored `+N%` / `-N%` vs prev week
- Bar chart: "Daily revenue (SAR)" — Recharts `<BarChart>`, 7 bars, `#0A0A0A` fill
- Line chart: "Daily jobs" — Recharts `<LineChart>`, 2 lines (total gray `#737373`, completed amber `#F59E0B`)

### Technician scorecards tab

- Table: NAME, JOBS COMPLETED, COMPLETION RATE, ON-TIME RATE, AVG RESOLUTION, RATING
- Sortable column headers (click to sort asc/desc)
- Data from existing `fetchAnalyticsTechnicians(days)`

### Brand tab

- Table: BRAND, TOTAL JOBS, COMPLETION RATE, REVISIT RATE, AVG RESOLUTION
- Data from existing `fetchAnalyticsBrands(days)`

### Dealer tab

- Table: DEALER, JOBS REFERRED, COMPLETION RATE, AVG DAYS WAITING
- Data from existing `fetchAnalyticsDealers(days)`

### Time window

- Dropdown top right of tab content: 7 days / 30 days / 90 days
- Controls all charts and tables on current tab

### Chart library

- Install: `recharts` (MIT, React-native, no canvas dependency)
- Shared chart wrapper component: consistent axis styling, tooltip, grid lines

---

## Module 8 — Payments & Brands

Single merged page at `/payment-methods` (sidebar label: "Payments & Brands").

### Page header

- Title: "Payments & Brands"
- Subtitle: "Manage payment methods, service item pricing, and brands"

### Section 1 — Payment Methods

- Section header: credit card icon + "Payment Methods" + description + `+ Add` black button
- Table: METHOD, STATUS (Active • Inactive pill), ACTIONS (✎ edit + 🗑 delete icons)
- Existing data and endpoints unchanged

### Section 2 — Service Items & Pricing (new)

- Section header: tag icon + "Service Items & Pricing" + description + `+ Add` black button
- Table: ITEM, PRICING (`Variable` blue badge + "SAR N / unit" or `Fixed` gray badge + "SAR N"), ACTIONS
- Add/Edit modal: name input, pricing type toggle (Fixed/Variable), unit price, unit label (for variable only)
- New DB table: `service_items (id, organization_id, name, pricing_type, unit_price, unit_label, created_at)`
- New endpoints: `GET /service-items`, `POST /service-items`, `PATCH /service-items/:id`, `DELETE /service-items/:id`

### Section 3 — Brands

- Existing brand management (currently at `/admin/brands`) moved here
- No functional changes, visual pattern updated to match new page style

### Route mapping

- Sidebar stays unchanged (labels, routes, icons — no edits to sidebar)
- `/payment-methods` page content replaced with merged Payments & Brands layout (Payment Methods + Service Items + Brands)
- `/admin/brands` → redirect to `/payment-methods` (brands section now lives there)

---

## Module 9 — System Config

Route: `/admin/system-config` (existing). Sidebar "Admin" item now links here instead of `/admin/brands`. The System Config content replaces the old Admin/brands content (brands moved to Payments & Brands page).

### Page header

- Title: "System Config"

### Info banner

- Light gray bg `#F5F5F5`, border `#E5E5E5`, info circle icon
- Text: "Configuration changes apply only to new evaluations from the save point onward. Existing flags are point-in-time snapshots and are not retroactively recalculated."

### Section 1 — Customer complaint rules

| Field                                | Key                              | Default |
| ------------------------------------ | -------------------------------- | ------- |
| Repeat complaint window (days)       | `repeat_complaint_window_days`   | 30      |
| Frequent complaint threshold (count) | `frequent_complaint_threshold`   | 3       |
| Frequent complaint window (days)     | `frequent_complaint_window_days` | 90      |

### Section 2 — Scheduling & Punctuality

| Field                              | Key                                | Default |
| ---------------------------------- | ---------------------------------- | ------- |
| Punctuality grace period (minutes) | `punctuality_grace_period_minutes` | 15      |
| Standard job duration (minutes)    | `standard_job_duration_minutes`    | 120     |

### Section 3 — SLA & Alerts

| Field                                  | Key                     | Default |
| -------------------------------------- | ----------------------- | ------- |
| Amber alert threshold (days waiting)   | `amber_alert_days`      | 3       |
| No-show window (hours after scheduled) | `no_show_hours`         | 2       |
| Overdue scheduling threshold (days)    | `overdue_schedule_days` | 7       |

### Form UX

- Each field: label (bold) + helper text (gray, 12px) + number input
- Saves on blur via existing `PATCH /settings/system-config/:key`
- Success: brief green checkmark inline; error: red inline message

### Backend

- All keys stored in existing `system_config` table
- New keys seeded via migration (no schema change)

---

## Backend Summary

### New DB migrations

1. `ALTER TABLE jobs ADD COLUMN revisit_count INTEGER DEFAULT 0`
2. Seed new system_config keys (amber_alert_days, no_show_hours, overdue_schedule_days, repeat_complaint_window_days, frequent_complaint_threshold, frequent_complaint_window_days, punctuality_grace_period_minutes, standard_job_duration_minutes)
3. `CREATE TABLE service_items (id UUID PK, organization_id UUID FK, name TEXT, pricing_type TEXT, unit_price NUMERIC, unit_label TEXT, created_at TIMESTAMPTZ)`

### New endpoints

| Method | Path                   | Purpose                           |
| ------ | ---------------------- | --------------------------------- |
| GET    | `/search?q=&limit=`    | Global job/customer search        |
| GET    | `/dashboard/metrics`   | 5 KPI counts + 7-day trend arrays |
| POST   | `/jobs/batch-schedule` | Batch assign date + technician    |
| GET    | `/service-items`       | List service items                |
| POST   | `/service-items`       | Create service item               |
| PATCH  | `/service-items/:id`   | Update service item               |
| DELETE | `/service-items/:id`   | Delete service item               |

### revisit_count increment

- In `jobs.service.ts`: when status transitions to `needs_revisit`, increment `revisit_count` on the job row

### Tag derivation (read-time, no stored tag column)

- `Chronic`: customer has ≥ `frequent_complaint_threshold` complaint-type jobs in `frequent_complaint_window_days`
- `Frequent`: customer has ≥ 2 `needs_revisit` status transitions in `repeat_complaint_window_days`
- `Repeat`: customer has ≥ 2 total jobs of any type (returning customer)

---

## Implementation Order

1. App Shell (top bar + global search)
2. Dashboard (new KPI cards + tables + backend metrics)
3. All Jobs (new columns + filter drawer)
4. Schedule & Assign (inline assignment + batch + days waiting)
5. Technicians (avatar pattern + toggle)
6. Dealers (same pattern)
7. Analytics (Recharts + 4 tabs)
8. Payments & Brands (merged page + service items)
9. System Config (new route + new config keys)

Each module: backend migration/endpoint first, then frontend component.
