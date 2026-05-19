# CoolDesk UI Migration Plan
## Replace current Tailwind frontend with the Design Reference visual language

> **Goal:** Adopt every visual pattern from the *Cool Desk UI Design Reference* (Vite/React Router SPA)
> while keeping all Next.js App Router routing, React Query data hooks, JWT auth, and backend API calls
> exactly as they are today.

---

## Guiding principles

| Keep (never touch) | Replace (visual only) |
|---|---|
| `useQuery` / `useMutation` calls | All Tailwind class names |
| `apiClient`, all `operations.ts` functions | Sidebar / header markup |
| `AuthProvider`, `useAuth`, `RoleGate` | Every page's visual layout |
| Next.js App Router file structure (`app/`) | Inline styles ↔ Tailwind where needed |
| All backend endpoints and DTOs | Mock data references in reference files |
| `RequestContext`, JWT guard flow | React Router `<Link>` → Next.js `<Link>` |

---

## Style strategy

The reference app uses **inline `style={{}}` objects exclusively** — no Tailwind, no CSS modules.
For this migration, use the **same inline-style approach** to achieve pixel-perfect fidelity with the
reference. Tailwind can be removed from component files as they are rewritten; keep `tailwind.config`
in place for any global resets that are still useful.

### Design token cheat-sheet (inline constant to add to each file)

```ts
// Paste at top of each new component file — remove when extracted to a shared tokens file
const T = {
  bg:          '#FFFFFF',
  bgSubtle:    '#FAFAFA',
  border:      '#E5E5E5',
  borderHover: '#D4D4D4',
  text:        '#171717',
  textMuted:   '#737373',
  textSub:     '#525252',
  textFaint:   '#A3A3A3',
  primary:     '#0A0A0A',
  success:     { bg: '#F0FDFA', text: '#134E4A', border: '#CCFBF1', dot: '#10B981' },
  warning:     { bg: '#FEFCE8', text: '#854D0E', border: '#FEF08A', dot: '#F59E0B' },
  danger:      { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3', dot: '#EF4444' },
  neutral:     { bg: '#F1F5F9', text: '#1E293B', border: '#E2E8F0', dot: '#64748B' },
  radius:      { sm: '6px', md: '8px', lg: '12px', full: '9999px' },
  font:        { base: '13px', sm: '12px', lg: '15px', xl: '18px', hero: '36px' },
};
```

---

## Phase 1 — Shared UI Primitives
**New files, zero dependency on any page. Build and export these first.**

### 1.1 `frontend/src/components/ui/status-chip.tsx`
Copy `StatusChip` verbatim from reference `src/app/components/ui/StatusChip.tsx`.
- Replace `import type { JobStatus } from '../../data/mockData'` with the local TypeScript enum/union
  already in `frontend/src/types/jobs.ts` (or declare the union inline).
- No other changes. Export as named export `StatusChip`.

### 1.2 `frontend/src/components/ui/job-type-chip.tsx`
Copy `JobTypeChip`, `SourceChip`, `TagChip`, `BrandSwatch` verbatim from reference
`src/app/components/ui/JobTypeChip.tsx`.
- Same type-import fix as above.
- `BrandSwatch` currently renders plain text — keep as-is for now.

### 1.3 `frontend/src/components/ui/status-toggle.tsx`
Extract the `StatusToggle` pill component from the reference's Technicians page (lines ~85–110).
Accepts `{ active: boolean; onToggle: () => void; disabled?: boolean }`.
It is a styled pill switch (green dot + "Active"/"Inactive" label, click fires `onToggle`).

### 1.4 `frontend/src/components/ui/avatar.tsx`
Extract the avatar/initials helper from the Technicians page:
```ts
const PALETTE = ['#E8D5C4','#C4D5E8','#C4E8D5','#E8C4D5','#D5E8C4','#D5C4E8'];
function initials(name: string) { return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0,2); }
function avatarColor(name: string) { /* sum char codes % palette length */ }
```
Export `<Avatar name={string} size?: number />` which renders the colored circle + initials.

### 1.5 `frontend/src/components/ui/modal.tsx`
Extract the `Modal` component from reference `JobDetail.tsx` (lines ~110–155).
Generic: `{ isOpen, onClose, title, blocking?, children }`.
Backdrop click closes unless `blocking=true` (retain-or-void prompt).

### 1.6 `frontend/src/components/ui/sla-cell.tsx`
Extract `SlaCell` + `getSlaInfo` from reference `PendingSchedule.tsx`.
Accepts `{ days: number; type: 'installation' | 'complaint' }`.
Add `<style>` injection for the `sla-tooltip-in` keyframe or use a CSS module.

### 1.7 Install `lucide-react` if not already present
```
npm install lucide-react
```
All icon imports in new components must come from `lucide-react`, matching the reference exactly
(same icon names, `strokeWidth={1.5}` everywhere).

---

## Phase 2 — Layout: AppShell + Sidebar + Topbar
**Files to replace:**
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/layout/sidebar.tsx`

### 2.1 Sidebar (`sidebar.tsx`)

Rewrite to match reference `AppShell.tsx` sidebar section:

| Detail | Value |
|---|---|
| Expanded width | `240px` |
| Collapsed width | `56px` |
| Transition | `width 220ms ease-in-out` (on the sidebar `div`) |
| Background | `#FAFAFA` |
| Right border | `1px solid #E5E5E5` |
| Logo row | `<Zap size={18} strokeWidth={1.5} />` + "CoolDesk" text (hidden when collapsed) |
| Collapse button | `<ChevronRight />` rotated 180° when expanded, `0°` when collapsed; position absolute bottom-left corner |
| Nav items | Same routes as today. Icon + label. Label fades/hides when collapsed. |
| Active item style | `backgroundColor: '#F5F5F5'`, `color: '#171717'`, `fontWeight: 500` |
| Inactive item | `color: '#525252'`, hover → `backgroundColor: '#F5F5F5'` |
| Item padding | `9px 12px`, `borderRadius: '8px'` |
| Icon size | 16px, `strokeWidth={1.5}` |

Nav items (icon → label → Next.js route):
- `LayoutDashboard` → Dashboard → `/dashboard`
- `Briefcase` → Jobs → `/jobs`
- `Clock` → Pending Schedule → `/pending-schedule`
- `Users` → Technicians → `/technicians`
- `Building2` → Dealers → `/dealer-management`
- `BarChart2` → Analytics → `/analytics`
- `Bell` → Notifications → `/notifications` (show unread badge dot when count > 0)
- `CreditCard` → Payment Methods → `/payment-methods` *(owner only — wrap in `<RoleGate roles={['owner']}>`)* 
- `Settings` → System Config → `/system-config` *(owner only)*

Keep the `usePathname()` hook to determine active route. Keep `<RoleGate>` wrappers for owner-only items.

### 2.2 Topbar (inside `app-shell.tsx`)

Height: `56px`, `borderBottom: '1px solid #E5E5E5'`, `backgroundColor: '#fff'`.

Left side: nothing (sidebar logo is self-contained).

Center-ish: search bar
```
[ 🔍  Search jobs, customers… ] [ ⌘K ]
```
- `border: '1px solid #E5E5E5'`, `borderRadius: '8px'`, `width: '240px'`, `fontSize: '13px'`
- `⌘K` badge: `backgroundColor: '#F5F5F5'`, `borderRadius: '4px'`, `fontSize: '11px'`, `padding: '2px 5px'`
- For now: `onClick` does nothing (search is a future feature).

Right side (left-to-right): notification bell → "Log new job" ghost button
- Bell: `<Bell size={18} strokeWidth={1.5} />`, if unread count > 0 show a `7px` red dot absolutely positioned top-right. Clicking navigates to `/notifications`.
- "Log new job" button: ghost style — `border: '1px solid #E5E5E5'`, `backgroundColor: '#fff'`, `borderRadius: '8px'`, `fontSize: '13px'`, hover → `backgroundColor: '#FAFAFA'`. Use Next.js `<Link href="/log-new-job">`.

### 2.3 Main content area
```
flex: 1, overflowY: 'auto', backgroundColor: '#FAFAFA', padding: 0
```
Each page provides its own `padding: '24px'` internally (matches reference).

---

## Phase 3 — Pages (one by one)

For each page: **keep all `useQuery`/`useMutation`/`useAuth` hooks exactly as they are**;
replace only the JSX return and any local state that is purely visual.

---

### 3.1 Login page
**File:** `frontend/src/app/(auth)/login/page.tsx`  
**Reference:** `Login.tsx`

Visual changes:
- Full-page `#FAFAFA` background, centered `400px` card.
- `<Zap size={22} />` + "CoolDesk" heading above card.
- `border: '1px solid #E5E5E5'`, `borderRadius: '12px'`, `padding: '32px'`.
- Email + password inputs: `border: '1px solid #E5E5E5'`, focus → `borderColor: '#2563EB'` (via `onFocus`/`onBlur`).
- Password show/hide eye button (`Eye` / `EyeOff` lucide icons).
- Submit button: `backgroundColor: '#0A0A0A'`, loading state sets `backgroundColor: '#A3A3A3'`.
- Error banner: `backgroundColor: '#FEE2E2'`, `color: '#991B1B'`.
- **Keep:** `handleLogin` calling real auth mutation, `useRouter().push('/dashboard')` on success.

---

### 3.2 Dashboard page
**File:** `frontend/src/app/(protected)/dashboard/page.tsx`  
**Reference:** `Dashboard.tsx`

Visual structure:
```
<h1> "The Control Tower" </h1>   ← 36px, fontWeight 600, letterSpacing -0.02em
<p>  org name · today's date  </p>

[KPI row — 4 cards]
[Needs Revisit amber panel]
[Recent jobs table]
```

#### KPI Card component (new: `frontend/src/components/dashboard/kpi-card.tsx`)
- `3px` top accent bar (color = prop).
- Title `12px #737373`, Value `28px fontWeight 600`, Trend chip (green/red).
- Sparkline: 40×24px inline SVG (`<polyline>` for line, `<path>` for fill area). Data = last 7 data points from the query response.
- The reference's `hexRgba` helper converts hex color to rgba fill — copy it verbatim.

KPI cards (wire to `fetchAnalyticsOverview` query — today it returns `total_jobs`, `completion_rate`, etc.):
1. Total jobs (7d) — accent `#0A0A0A`
2. Completion rate — accent `#10B981`
3. On-time rate — accent `#F59E0B`
4. Avg resolution time — accent `#6366F1`

#### Needs Revisit panel
- `backgroundColor: '#FFFBEB'`, `border: '1px solid #FDE68A'`, `borderRadius: '12px'`.
- `<AlertTriangle size={14} color="#B45309" />` + "Needs revisit" heading.
- Table of jobs where `status === 'needs_revisit'` from the jobs query.
- Columns: Job ID (monospace `JetBrains Mono`), Customer, Technician, Waiting (days), Revisit #.
- Click row → `router.push('/jobs/' + job.id)`.
- If empty → small text "No jobs currently need revisiting."

#### Recent jobs mini-table
- Last 10 jobs from `useJobs()` query, no filters.
- Columns: Job ID, `<StatusChip>`, `<JobTypeChip>`, `<BrandSwatch>`, Customer, Assigned to.
- "View all →" link to `/jobs`.

---

### 3.3 Jobs list page
**File:** `frontend/src/app/(protected)/jobs/page.tsx` (and `frontend/src/components/jobs/jobs-list.tsx`)  
**Reference:** `JobList.tsx`

#### Header
```
<h1>Jobs</h1>
<p>{total} jobs</p>
[Filter button]  [Log new job button → /log-new-job]
```
"Log new job" button: `backgroundColor: '#0A0A0A'`, `color: '#fff'`, `borderRadius: '8px'`.

#### Filter panel (animated)
- Trigger: "Filters" button with `<SlidersHorizontal size={14} />` icon.
- Panel toggles with `maxHeight: open ? '200px' : '0'`, `overflow: 'hidden'`, `transition: 'max-height 250ms ease'`.
- Filter fields (all drive existing query params): Status (select), Type (select), Brand (select from `fetchOfficeBrands`), Source (select), Date range (two date inputs).
- Active filter count badge on button: gray pill `{n} active`.
- "Clear filters" button appears when any filter is active.

#### Table
White card `borderRadius: '12px'`, `border: '1px solid #E5E5E5'`.

Columns:
| Column | Component |
|---|---|
| Job ID | `font-family: 'JetBrains Mono', monospace`, `fontSize: '12px'`, `color: '#525252'` |
| Status | `<StatusChip status={job.status} />` |
| Type | `<JobTypeChip type={job.type} />` |
| Brand | `<BrandSwatch name={job.brand.name} colorHex={null} />` |
| Customer | plain text |
| Tags | `<TagChip>` for `is_chronic` (rose "Chronic"), `is_repeat` (slate "Repeat"), `is_frequent` (ochre "Frequent") |
| Assigned | technician name or `—` |
| Created | `toLocaleString('en-GB', { day:'2-digit', month:'short' })` |

Row hover: `backgroundColor: '#FAFAFA'`.
Row click: `router.push('/jobs/' + row.id)`.

Empty state (no results):
```
<Briefcase size={32} strokeWidth={1} color="#D4D4D4" style={{ display: 'block', margin: '0 auto 12px' }} />
<p>"No jobs found"</p>
<p style={{ color: '#737373' }}>"Try adjusting your filters"</p>
```

**Pagination:** Keep existing pagination; style prev/next buttons with `border: '1px solid #E5E5E5'`, `borderRadius: '8px'`.

---

### 3.4 Job detail page
**File:** `frontend/src/app/(protected)/jobs/[id]/page.tsx`  
**Reference:** `JobDetail.tsx` (696 lines — the most complex page)

This page is the richest in the reference. Implement in sub-sections:

#### Layout (2-column on large screens)
```
Left (flex: ~2):  Header info block | Status action panel | Units table | Revisit history
Right (flex: ~1): Timeline panel | Payment panel
```

#### Header block
- `<ArrowLeft />` back link → `/jobs`
- Job ID in monospace pill + `<Copy>` button (copies to clipboard).
- `<StatusChip>` + `<JobTypeChip>` + `<BrandSwatch>` in one row.
- Customer name, `<Phone size={13} />` phone, `<MapPin size={13} />` address.
- `is_chronic` → rose "Chronic" banner bar across top.

#### Status action panel
Box with `border: '1px solid #E5E5E5'`, `borderRadius: '12px'`.

**Technician actions** (forward transitions):
- Button label = the next logical status label.
- Clicking opens `<Modal>` with `<ReasonField>` where reason is required.
- On confirm → call existing status-transition mutation.
- 60-second undo: after mutation resolves, show countdown bar. On undo click → call rollback mutation. Timer is client-side (`useEffect` + `clearTimeout`). Duration read from `system_config.undo_window_seconds` (add to the `fetchSystemConfig` query).

**Office staff rollback** (one step back, pre-completion only):
- Show "Roll back one step" button if `ctx.role === 'office_staff'` and job not completed/resolved/cancelled.
- Opens modal → reason required → calls rollback mutation.

**Owner override:**
- "Override status" button visible only to `owner`.
- Opens modal with full status dropdown + reason.
- If job has payment and is being moved back from `completed`/`resolved` outside undo window → `blocking={true}` modal with retain/void choice.

#### Timeline panel (`<TimelinePanel>`)
Copy reference `TimelinePanel` verbatim; replace mock data with `useQuery` call to
`fetchJobTimeline(jobId)` (add this to `operations.ts` → `GET /jobs/:id/timeline`).

Icon mapping (copy from reference `iconFor` function).

#### Payment panel
Visible when job is `completed` or `resolved`.
- Amount, method, recorded-by, timestamp.
- Edit controls gated by role:
  - `office_staff`: can change `payment_method_id` (dropdown of active methods).
  - `owner`: can change `payment_amount` (numeric input).
- Both edits fire `PATCH /jobs/:id/payment` → add to `operations.ts`.
- Each edit logs to timeline (backend responsibility).

#### Revisit history
Accordion list of revisit records from `fetchJobRevisits(jobId)` (add `GET /jobs/:id/revisits`).
Each row: sequence number, reason chip, status, assigned technician.

---

### 3.5 Log New Job (multi-step form)
**File:** `frontend/src/app/(protected)/log-new-job/page.tsx`  
**Reference:** `LogNewJob.tsx`

Keep exact visual structure: `<StepHeader>` progress indicator + 4-step form inside a white card.

Replace mock data:
| Reference (mock) | Real query |
|---|---|
| `mockDealers` | `useQuery` → `fetchDealers()` |
| `mockBrands` | `useQuery` → `fetchOfficeBrands()` |
| `handlePhoneBlur` mock VCID | `useMutation` → `POST /jobs/vcid-lookup` (add endpoint) or keep as no-op with "new customer will be created" message |

On Step 4 "Review & submit", the submit button fires the existing `createQuickJob` mutation
(or a new `createJob` mutation for the full payload). On success: `router.push('/jobs')`.

Style the `<StepHeader>` step dots exactly as reference:
- Past step: `backgroundColor: '#065F46'`, `<CheckCircle size={14} />` icon.
- Current step: `backgroundColor: '#0A0A0A'`, step number.
- Future step: `backgroundColor: '#F5F5F5'`, `color: '#A3A3A3'`.
- Connector line: past = `#10B981`, future = `#E5E5E5`.

---

### 3.6 Pending Schedule page
**File:** `frontend/src/app/(protected)/pending-schedule/page.tsx`  
**Reference:** `PendingSchedule.tsx`

Replace `mockJobs` with `useQuery` → `fetchPendingScheduleJobs()`:
```ts
// Add to operations.ts
export const fetchPendingScheduleJobs = () =>
  apiClient.get<Job[]>('/jobs?status=pending_schedule').then(r => r.data);
```

Keep the full reference UI including:
- `<SlaCell>` (Phase 1.6 above) per row.
- Batch mode toggle (local state `batchMode`, `selected[]`).
- Batch technician assign: calls `PATCH /jobs/batch-assign` (add endpoint) or fires individual assign mutations in sequence.
- Individual schedule row: inline `<select>` for technician + "Confirm" button → calls assign mutation.
- `<JobTypeChip>` per row.

Wire `mockTechnicians` → `useQuery` → `fetchTechnicianDirectory()` (already in `operations.ts`).

---

### 3.7 Technicians page
**File:** `frontend/src/app/(protected)/technicians/page.tsx`  
**Reference:** `Technicians.tsx`

Replace table with card list:

```
[ Search input (filters local state) ]   [ + Add technician button ]

TechRow card × N
```

#### TechRow card
- Left: `<Avatar name={tech.name} />` + name + email + `font-size: 12px color: #737373`.
- Right: `<StatusToggle active={tech.is_active} onToggle={() => toggleMutation(tech.id)} />` + `<ChevronRight />` click-through.
- Card: `backgroundColor: '#fff'`, `border: '1px solid #E5E5E5'`, `borderRadius: '12px'`, `padding: '14px 16px'`, hover → `backgroundColor: '#FAFAFA'`.

#### Add Technician modal (`<AddTechnicianModal>`)
Matches reference exactly:
- Fields: Name, Email, Phone, Password.
- Field-level validation with `<AlertCircle size={12} color="#EF4444" />` inline error hints.
- Fires existing `createOfficeTechnician` mutation on submit.
- Close on success, reset form.

#### TechnicianProfileOverlay
Slide-in right panel (position fixed, `right: 0`, `width: '420px'`, `translateX` animation):
- Shows full tech details: name, email, phone, join date.
- Active jobs count, completion rate from `fetchTechnicianStats(id)` (add `GET /users/:id/stats`).
- Status toggle (same mutation).
- Close button top-right.

Keep `<RoleGate roles={['owner']}>` around Add button and status toggle.

---

### 3.8 Dealer Management page
**File:** `frontend/src/app/(protected)/dealer-management/page.tsx`  
**Reference:** `DealerManagement.tsx`

Same card-list pattern as Technicians:

#### DealerRow card
- `<Avatar name={dealer.business_name} />` + business name + contact name + phone.
- Status toggle (owner only).
- Edit button → opens `<DealerForm>` modal pre-filled.
- `<ChevronRight />` → `<DealerProfileOverlay>`.

#### DealerForm modal
- Fields: Business name, Contact name, Email, Phone, Password (create only), Brand assignments (checkbox grid).
- Brand list from `fetchOfficeBrands()` query — already in `operations.ts`.
- On save: calls existing `createDealer` mutation (create) or new `updateDealer` mutation (`PATCH /dealers/:id`).

#### DealerProfileOverlay
- Shows dealer details + all jobs submitted by this dealer.
- `fetchDealerJobs(dealerId)`: add `GET /dealers/:id/jobs` backend endpoint.

---

### 3.9 Analytics page
**File:** `frontend/src/app/(protected)/analytics/page.tsx`  
**Reference:** `Analytics.tsx`

Install `recharts` (already in the reference; add to `frontend/package.json`):
```
npm install recharts
```

Four tabs: Business | Technician scorecards | Brand | Dealer.

Wire to existing analytics queries:
| Tab | Query |
|---|---|
| Business | `fetchAnalyticsBusiness()` → `GET /analytics/business?days=7` |
| Technician scorecards | `fetchTechnicianDirectory()` + `fetchAnalyticsTechnicians()` |
| Brand | `fetchAnalyticsBrands()` → `GET /analytics/brands` |
| Dealer | `fetchAnalyticsDealers()` → `GET /analytics/dealers` |

Add all missing endpoints to `operations.ts` — they mirror existing `analytics_*_daily` tables.

`avg_star_rating` column: show `—` when `system_config.customer_review_mode === 'off'`.

Tab button style (copy `TabButton` from reference exactly):
- Active: `color: '#171717'`, `borderBottom: '2px solid #0A0A0A'`.
- Inactive: `color: '#737373'`, `borderBottom: '2px solid transparent'`.

---

### 3.10 Notifications page
**File:** `frontend/src/app/(protected)/notifications/page.tsx`  
**Reference:** `Notifications.tsx`

Replace `mockNotifications` with `useQuery` → `fetchNotifications()`:
```ts
// Add to operations.ts
export const fetchNotifications = () =>
  apiClient.get<Notification[]>('/notifications').then(r => r.data);
```

Add mutations:
- `markNotificationRead(id)` → `PATCH /notifications/:id/read`
- `markAllRead()` → `POST /notifications/mark-all-read`

Keep all filter chip logic (all / unread / cancellations / assignments) — it operates on the
fetched array client-side (no server filter needed).

Urgent colors: reference uses `notif.urgent_color === 'red'` vs amber — map to backend
`notification.priority` field (`'high'` → red, `'medium'` → amber).

---

### 3.11 Payment Methods page
**File:** `frontend/src/app/(protected)/payment-methods/page.tsx`  
**Reference:** `PaymentMethods.tsx`

Replace `mockPaymentMethods` with `useQuery` → `fetchPaymentMethods()`:
```ts
export const fetchPaymentMethods = () =>
  apiClient.get<PaymentMethod[]>('/payment-methods').then(r => r.data);
```

Add mutations:
- `togglePaymentMethod(id)` → `PATCH /payment-methods/:id/toggle`
- `addPaymentMethod(name)` → `POST /payment-methods`

Keep the reference's add-new inline form at the bottom. `Enter` key submits.
Wrap entire page in `<RoleGate roles={['owner']}>`.

---

### 3.12 System Config page
**File:** `frontend/src/app/(protected)/system-config/page.tsx`  
**Reference:** `SystemConfig.tsx`

Replace `SYSTEM_CONFIG` mock with `useQuery` → `fetchSystemConfig()`:
```ts
export const fetchSystemConfig = () =>
  apiClient.get<SystemConfig>('/settings/config').then(r => r.data);
```

Save mutation: `updateSystemConfig(config)` → `PATCH /settings/config`.

The reference's `<ConfigSection>`, `<NumberField>`, `<SelectField>` sub-components are
self-contained — copy verbatim and wire to real query state instead of local `useState`.

"Saved!" flash feedback on the save button (green bg for 2s) — keep from reference.

Wrap entire page in `<RoleGate roles={['owner']}>`.

---

## Phase 4 — Font Setup

### Add JetBrains Mono for monospace job IDs

In `frontend/src/app/layout.tsx` (root layout), add to the `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

Or use `next/font/google`:
```ts
import { Inter, JetBrains_Mono } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono  = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
```

CSS custom property usage in inline styles:
```ts
fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)'
```

Apply `--font-inter` as the default `font-family` on `body` in `globals.css`.

---

## Phase 5 — Global CSS cleanup

In `frontend/src/app/globals.css`:
```css
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-inter, 'Inter', -apple-system, 'Segoe UI', sans-serif);
  font-size: 13px;
  color: #171717;
  background-color: #FAFAFA;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar (matches reference's minimal aesthetic) */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #D4D4D4; border-radius: 9999px; }

/* Remove default button/input resets that fight inline styles */
button { font-family: inherit; }
input, select, textarea { font-family: inherit; }

/* Tailwind preflight can be kept or removed — test after each page rewrite */
```

---

## Phase 6 — What NOT to change

The following files must not be modified at all during this migration:

| File / directory | Reason |
|---|---|
| `frontend/src/lib/api/client.ts` | Axios instance with JWT interceptor |
| `frontend/src/lib/api/operations.ts` | All data-fetching functions (only add new exports) |
| `frontend/src/contexts/auth-context.tsx` | `AuthProvider`, `useAuth` hook |
| `frontend/src/components/auth/role-gate.tsx` | Role-based rendering |
| `frontend/src/app/(protected)/layout.tsx` | Auth guard redirect logic |
| `frontend/src/app/(auth)/layout.tsx` | Auth layout |
| `backend/**` | Entire backend unchanged |

---

## Implementation order (recommended)

```
Phase 1 → Phase 2 → Phase 3.1 (Login) → Phase 3.2 (Dashboard) → Phase 3.3 (Jobs list)
→ Phase 3.4 (Job detail) → Phase 3.5 (Log new job) → Phase 3.6 (Pending Schedule)
→ Phase 3.7 (Technicians) → Phase 3.8 (Dealers) → Phase 3.9 (Analytics)
→ Phase 3.10 (Notifications) → Phase 3.11 (Payment Methods) → Phase 3.12 (System Config)
→ Phase 4 (Fonts) → Phase 5 (CSS cleanup)
```

After each phase: run `npm run typecheck` and `npm run build` in `frontend/`. Fix errors before moving on.

---

## New backend endpoints required

These must be added to NestJS before the corresponding frontend page can be fully wired:

| Endpoint | Module | Purpose |
|---|---|---|
| `GET /jobs/:id/timeline` | `jobs` | Job detail timeline panel |
| `GET /jobs/:id/revisits` | `revisits` | Job detail revisit history |
| `POST /jobs/vcid-lookup` | `jobs` | VCID phone lookup on Log New Job step 2 |
| `PATCH /jobs/:id/payment` | `payments` | Payment amount/method edit from job detail |
| `GET /dealers/:id/jobs` | `dealers` | Dealer profile overlay |
| `PATCH /dealers/:id` | `dealers` | Edit dealer |
| `PATCH /payment-methods/:id/toggle` | `settings` | Toggle payment method active |
| `GET /analytics/business` | `analytics` | Business analytics tab |
| `GET /analytics/brands` | `analytics` | Brand analytics tab |
| `GET /analytics/dealers` | `analytics` | Dealer analytics tab |
| `GET /analytics/technicians` | `analytics` | Technician scorecards tab |
| `GET /users/:id/stats` | `users` | Technician profile overlay stats |
| `PATCH /notifications/:id/read` | `notifications` | Mark single notification read |
| `POST /notifications/mark-all-read` | `notifications` | Mark all read |
| `GET /settings/config` | `settings` | System config read |
| `PATCH /settings/config` | `settings` | System config save |
