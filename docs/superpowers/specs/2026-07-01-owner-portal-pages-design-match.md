# Owner Portal Pages Design Match — Sub-project A

**Date:** 2026-07-01
**Approach:** Surgical in-place visual edits only — no functionality changes
**Fidelity:** Pixel-perfect match to `Owner's View UI Design/` Figma Make output
**Sequence:** Job Detail → Log New Job → Pending Schedule → Notifications

---

## Scope

Four owner-facing pages in `frontend/` are updated to match the design exactly.
All real API wiring, role-based access, query hooks, modal logic, and Next.js
conventions are **preserved unchanged** — only visual/structural properties change.

Files changed:
| File | Change type |
|---|---|
| `src/components/jobs/job-detail.tsx` | Typography + label color tweaks |
| `src/app/(protected)/log-new-job/page.tsx` | Step indicator + radio button styling |
| `src/app/(protected)/pending-schedule/page.tsx` | Header typography + SLA progress bars |
| `src/app/(protected)/notifications/page.tsx` | Dot color + badge color + item backgrounds |

---

## Global Constraints

- All styles are inline (`style={{...}}`). No Tailwind, no CSS modules, no new files.
- Do NOT change any API calls, query hooks, state logic, navigation, or form validation.
- Do NOT add new modals, new buttons tied to new actions, or new API endpoints.
- Do NOT change component props or exported types.
- TypeScript must stay clean: `cd frontend && npx tsc --noEmit` must pass.
- Test suite must stay green: `cd frontend && npm run test:run` must pass.
- All inline style values must be exact hex strings as specified — no CSS variables.

---

## Page 1 — Job Detail

**File:** `frontend/src/components/jobs/job-detail.tsx`

### 1.1 Job ID Heading (H1)

Locate the `<h1>` that renders the job ID at the top of the page.

| Property | Before | After |
|---|---|---|
| `fontSize` | `28px` | `24px` |
| `fontWeight` | `700` | `600` |
| `fontFamily` | (default) | `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace` |
| `letterSpacing` | `-0.02em` | `-0.01em` |

### 1.2 Tab Labels

Locate the tab bar buttons (Details, Timeline, Payment, Review).

| Property | Before | After |
|---|---|---|
| `fontSize` | `14px` | `13px` |
| Active tab `fontWeight` | `600` | `500` |
| Inactive tab `fontWeight` | `400` | `400` (no change) |

Tab active underline (`borderBottom: 2px solid #0A0A0A`) — keep as-is.

### 1.3 Field Labels (uppercase section labels)

Locate all uppercase label spans/divs inside tab content (e.g. "CUSTOMER", "BRAND", "SCHEDULED AT", etc.).

| Property | Before | After |
|---|---|---|
| `color` | `#737373` | `#A3A3A3` |
| `fontWeight` | `600` | `500` |
| `letterSpacing` | `0.06em` | `0.07em` |
| `fontSize` | `12px` | `12px` (no change) |

### 1.4 Tag Chips (chronic / frequent / repeat in sub-header)

Locate the tag chips in the sub-header area below the job ID.

| Property | Before | After |
|---|---|---|
| `borderRadius` | any current value | `9999px` |
| `padding` | any current value | `2px 8px` |
| `fontSize` | any current value | `11px` |
| `fontWeight` | any current value | `500` |

Color pairs remain unchanged (chronic: `#FFF1F2`/`#9F1239`, frequent: `#FFFBEB`/`#92400E`, repeat: `#F1F5F9`/`#1E293B`).

### 1.5 Breadcrumb

Locate the breadcrumb link ("All jobs").

| Property | Before | After |
|---|---|---|
| `color` | any current value | `#A3A3A3` |
| `fontSize` | any current value | `13px` |

Separator between breadcrumb items (if any): `color: #A3A3A3`.

---

## Page 2 — Log New Job

**File:** `frontend/src/app/(protected)/log-new-job/page.tsx`

### 2.1 Step Progress Circles

The step indicator shows numbered circles connected by lines. The `StepHeader` component or inline step circles need these states:

**Completed step circle:**
- `backgroundColor: '#065F46'`
- `color: '#fff'`
- `width: 28px, height: 28px, borderRadius: '9999px'`
- Shows a checkmark (`✓`) instead of the step number

**Current step circle:**
- `backgroundColor: '#0A0A0A'`
- `color: '#fff'`
- `width: 28px, height: 28px, borderRadius: '9999px'`
- Shows the step number

**Pending step circle:**
- `backgroundColor: '#F5F5F5'`
- `border: '1px solid #E5E5E5'`
- `color: '#A3A3A3'`
- `width: 28px, height: 28px, borderRadius: '9999px'`
- Shows the step number

### 2.2 Step Progress Lines (connectors between circles)

**Completed segment line:**
- `backgroundColor: '#10B981'`
- `height: 2px`
- `flex: 1`

**Pending segment line:**
- `backgroundColor: '#E5E5E5'`
- `height: 2px`
- `flex: 1`

### 2.3 Radio Button Options (job type + source)

Each radio option is a clickable card-like `<div>` or `<label>`.

**Selected state:**
- `border: '1.5px solid #0A0A0A'`
- `backgroundColor: '#FAFAFA'`
- `borderRadius: '10px'`
- `padding: '14px 16px'`

**Unselected state:**
- `border: '1px solid #E5E5E5'`
- `backgroundColor: '#fff'`
- `borderRadius: '10px'`
- `padding: '14px 16px'`

### 2.4 Form Card Container

The outer card wrapping each step's form content:
- `border: '1px solid #E5E5E5'`
- `borderRadius: '12px'`
- `padding: '24px'`
- `backgroundColor: '#fff'`

### 2.5 Form Field Labels

Labels above each input field (e.g. "Phone number", "Customer name"):
- `fontSize: '12px'`
- `fontWeight: 500`
- `color: '#525252'`
- `marginBottom: '6px'`

### 2.6 Input Fields

All `<input>` and `<select>` elements within the form:
- `border: '1px solid #E5E5E5'`
- `borderRadius: '8px'`
- `padding: '10px 12px'`
- `fontSize: '13px'`
- `color: '#0A0A0A'`
- `backgroundColor: '#fff'`
- `width: '100%'`

---

## Page 3 — Pending Schedule

**File:** `frontend/src/app/(protected)/pending-schedule/page.tsx`

### 3.1 Page Heading

Locate the `<h1>` element for the page title.

| Property | Before | After |
|---|---|---|
| `fontSize` | `32px` | `36px` |
| `fontWeight` | `700` | `600` |
| `letterSpacing` | (none/0) | `-0.02em` |

### 3.2 Table Header Cells

Locate `<th>` elements in the pending schedule table.

| Property | Before | After |
|---|---|---|
| `color` | `#525252` | `#A3A3A3` |
| `fontWeight` | `600` | `500` |
| `letterSpacing` | `0.04em` | `0.06em` |
| `fontSize` | `11px` | `11px` (no change) |
| `textTransform` | `uppercase` | `uppercase` (no change) |

### 3.3 SLA Progress Bars

Replace the plain colored text display of "days waiting" with a visual progress bar cell. The data source is the existing `daysWaiting` (number) value already in the API response — no new API calls.

**Color tier logic** (use existing `daysColor()` helper or inline):
- Days ≤ 3: "ok" tier
- Days 4–6: "amber" tier
- Days ≥ 7: "red" tier

**Cell layout** (replace current `<td>` content for the days-waiting column):
```
<td>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '80px' }}>
    <span style={{ fontSize: '13px', fontWeight: tier === 'ok' ? 400 : 600, color: textColor }}>
      {daysWaiting}d
    </span>
    <div style={{ height: '4px', borderRadius: '9999px', backgroundColor: trackColor, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: '9999px', backgroundColor: fillColor, width: `${Math.min(100, (daysWaiting / 10) * 100)}%` }} />
    </div>
  </div>
</td>
```

**Color values by tier:**

| Tier | `textColor` | `trackColor` | `fillColor` |
|---|---|---|---|
| ok | `#525252` | `#F5F5F5` | `#D1D5DB` |
| amber | `#92400E` | `#FEF3C7` | `#F59E0B` |
| red | `#991B1B` | `#FEE2E2` | `#EF4444` |

The progress fill width uses `Math.min(100, (daysWaiting / 10) * 100)` — caps at 100% at 10+ days. Adjust the denominator if a SLA threshold is available in the data.

### 3.4 Row Hover

Add hover handler on `<tr>` rows if not already present:
- `onMouseEnter`: `e.currentTarget.style.backgroundColor = '#FAFAFA'`
- `onMouseLeave`: `e.currentTarget.style.backgroundColor = 'transparent'`

---

## Page 4 — Notifications

**File:** `frontend/src/app/(protected)/notifications/page.tsx`

### 4.1 Unread Dot Color

Locate the unread indicator dot (small circle rendered per notification item).

| Property | Before | After |
|---|---|---|
| `backgroundColor` | `#F59E0B` | `#2563EB` |

### 4.2 Header Unread Badge

Locate the badge showing unread count in the page header.

| Property | Before | After |
|---|---|---|
| `backgroundColor` | current (red/amber) | `#2563EB` |
| `color` | current | `#fff` |
| `borderRadius` | current | `9999px` |
| `fontSize` | current | `11px` |
| `padding` | current | `2px 7px` |
| `fontWeight` | current | `600` |

### 4.3 Filter Chips

Locate the filter buttons (All, Unread, Cancellations, Assignments).

**Active chip:**
- `backgroundColor: '#0A0A0A'`
- `color: '#fff'`
- `borderRadius: '9999px'`
- `padding: '6px 14px'`
- `fontSize: '13px'`
- `fontWeight: 500`
- `border: 'none'`

**Inactive chip:**
- `backgroundColor: '#F5F5F5'`
- `color: '#404040'`
- `borderRadius: '9999px'`
- `padding: '6px 14px'`
- `fontSize: '13px'`
- `fontWeight: 400`
- `border: 'none'`

Filter bar container: `display: flex, gap: 8px, flexWrap: 'wrap'`.

### 4.4 Notification Item Backgrounds

| State | `backgroundColor` |
|---|---|
| Unread | `#FAFAFA` |
| Read | `#fff` |
| Urgent red event type (e.g. cancellation) | `#FEF2F2` |
| Urgent amber event type (e.g. overdue) | `#FFFBEB` |

For urgent backgrounds: apply based on the existing `urgencyLevel` field or `eventType` string already in the notification data. If neither exists in the current data model, apply only the unread/read distinction and skip urgent backgrounds.

---

## Out of Scope

- No new modals (Reopen job, Void/Retain payment, Roll back status)
- No payment tab content
- No new API calls or query hooks
- No changes to technician/dealer pages (already done in previous spec)
- No changes to `sidebar.tsx`, `app-shell.tsx`, `dashboard/page.tsx`, `jobs-list.tsx`
- No changes to shared primitives (`avatar.tsx`, `status-toggle.tsx`)
