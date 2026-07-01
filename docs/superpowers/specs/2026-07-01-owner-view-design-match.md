# Owner's View Design Match

**Date:** 2026-07-01  
**Approach:** Surgical in-place edits (Approach A)  
**Fidelity:** Pixel-perfect match to `Owner's View UI Design/` Figma Make output  
**Sequence:** Sidebar/Shell → Dashboard → All Jobs → Technicians → Dealers

---

## Scope

Five areas of `frontend/` are updated to match the design exactly:

1. Sidebar (`src/components/layout/sidebar.tsx`)
2. App Shell (`src/components/layout/app-shell.tsx`)
3. Dashboard (`src/app/(protected)/dashboard/page.tsx` + `src/components/dashboard/kpi-card.tsx`)
4. All Jobs (`src/components/jobs/jobs-list.tsx`)
5. Technicians (`src/app/(protected)/technicians/page.tsx`)
6. Dealers (`src/app/(protected)/dealer-management/page.tsx`)

Shared primitives also updated: `avatar.tsx`, `status-toggle.tsx`.

All real API wiring, role-based access control, and Next.js conventions are preserved — only visual/structural parts change.

---

## Phase 1 — Sidebar + App Shell

### `sidebar.tsx`

**Structure:**
- Remove the `<button>` toggle from the header section (currently sits next to the CoolDesk logo)
- Add a footer `<div>` at the bottom of the sidebar (between `<nav>` and end of `<aside>`):
  - `borderTop: '1px solid #E5E5E5'`, `padding: '8px'`
  - Contains a full-width button: rotating `ChevronRight` icon (180° when expanded) + "Collapse" text (hidden when `collapsed`)
  - Button style: `display: flex, alignItems: center, gap: 8px, width: 100%, padding: 8px 10px, borderRadius: 8px, background: transparent, border: none, cursor: pointer, color: #737373, fontSize: 13px, justifyContent: collapsed ? center : flex-start, minHeight: 44px`
  - Icon: `transform: collapsed ? rotate(0deg) : rotate(180deg), transition: transform 220ms`

**Visual pixel fixes:**
| Property | Before | After |
|---|---|---|
| Logo `Zap` size | 18px | 20px |
| Logo area padding | `0 12px` | `0 14px` |
| Logo area gap | `8px` | `9px` |
| Nav item `fontSize` | `13px` | `14px` |
| Nav item icon size | `17px` | `18px` |
| Nav item `gap` | `10px` | `8px` |
| Nav item `minHeight` | `40px` | `44px` |
| Active `backgroundColor` | `#F0F0F0` | `#F5F5F5` |

**Nav item changes (owner/staff view):**
- Remove `Notifications` item (`href: '/notifications'`)
- `"All Jobs"` → `"All jobs"`
- `"Schedule & Assign"` → `"Schedule and Assign"`
- `"Admin"` → `"System config"`

---

### `app-shell.tsx`

**Desktop top bar — right side (left-to-right order):**
1. `Log new job` link — add `Plus` icon (13px, strokeWidth 1.5) before text
2. Thin divider: `width: 1px, height: 20px, backgroundColor: #E5E5E5`
3. Bell button:
   - Remove `border: 1px solid #E5E5E5` (ghost style: `background: none, border: none`)
   - Size: `40×40px`, `borderRadius: 8px`
   - Unread dot color: `#EF4444` → `#9F1239`
   - On click: toggle notification popover (not navigate to `/notifications`)
   - Background tint when popover open: `backgroundColor: #F5F5F5`
4. Avatar button:
   - Change from text+ChevronDown to **32px circle**: `backgroundColor: #F5F5F5, border: 1px solid #E5E5E5, borderRadius: 9999px`
   - Shows `userInitials(session?.user.name)` (already have the helper)
   - Online dot: `8×8px, backgroundColor: #10B981, border: 2px solid #fff, position: absolute, bottom: 0, right: 0`
   - Dropdown: show user `name` (heading) + `email` (sub-line) + "Log out" button in `#991B1B`

**Notification popover** (new, rendered below bell via `position: absolute`):
- `position: absolute, top: calc(100% + 8px), right: 0, width: 360px`
- `backgroundColor: #fff, border: 1px solid #E5E5E5, borderRadius: 12px, boxShadow: 0 4px 24px rgba(0,0,0,0.10)`
- Header: "Notifications" label (`14px, fontWeight 500`) + unread count badge (`#9F1239` bg, white text)
- Body: fetch last 4 notifications via `fetchNotifications(audience, { limit: 4 })` using the existing API. Each row:
  - Unread dot: `6×6px, backgroundColor: #2563EB` (hidden if `isRead`)
  - Title: derived from `eventType` (e.g. `"job.status_changed"` → `"Job status changed"`)
  - Body: `payload` stringified or a fallback — `2-line clamp` via `-webkit-line-clamp: 2`
  - Timestamp: `new Date(createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })`
  - Unread rows: `backgroundColor: #FAFAFA`
- Footer: "View all notifications →" button navigates to `/notifications`
- Outside-click closes via `useRef` + `useEffect` (same pattern already in shell)

**Mobile header changes:**
- Hamburger stays (left)
- Replace centered "CoolDesk" text with: `Zap` icon (18px) + "CoolDesk" text, `flex: 1`, left-aligned
- Add `Plus` icon button (22px) for log-new-job before bell (no text)
- Bell: same ghost style + popover as desktop
- Avatar: same 32px circle with initials + online dot

**Mobile — remove:**
- Remove `<BottomNav unreadCount={unreadCount} />` from render
- Remove `paddingBottom: isSmallScreen ? "60px" : 0` from `<main>`

---

## Phase 2 — Dashboard

### `kpi-card.tsx`

| Property | Before | After |
|---|---|---|
| `borderRadius` | `8px` | `12px` |
| Side/bottom border | `1px solid #E5E5E5` | **removed** |
| `borderTop` | `3px solid accent` | `3px solid accent` (keep) |
| `boxShadow` | `0 12px 22px rgba(15,23,42,0.08)` | `0 2px 6px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08)` |
| Value `fontSize` | `48px` | `40px` |
| Fixed `height` | `154px` | Removed — use `paddingBottom: 64px` on body div, sparkline `position: absolute, bottom: 0` |

### `dashboard/page.tsx`

**KPI accent colors:**
| Card | Before | After |
|---|---|---|
| Total active jobs | `#0A0A0A` | `#737373` |
| Pending schedule | `#3B82F6` | `#94A3B8` |
| Amber alerts | `#F59E0B` | `#B45309` |
| Chronic jobs | `#BE123C` | `#9F1239` |
| No-shows today | `#737373` | `#78716C` |

**Table styling:**
| Property | Before | After |
|---|---|---|
| Card `borderRadius` | `10px` | `12px` |
| Header cell text color | `#8CA0BB` | `#94A3B8` |
| Header cell bg | `#F8F8F8` | `#FAFAFA` |
| Header `fontWeight` | `700` | `500` |
| Body cell fixed height | `59px` | Removed — `padding: 16px 16px` |
| Toolbar | `height: 57px` | `padding: 14px 16px`, no fixed height |
| Toolbar title `fontWeight` | `600` | `500` |

**Tag / chronic logic — fix heuristic:**
Replace index-based `getJobTagType()` with `job.tags` array:
- Chronic left-border: `job.tags.includes('chronic')` — `borderLeft: 2px solid #9F1239` on CUSTOMER `<td>` (not `<tr>`)
- Chronic tag chip: `job.tags.includes('chronic')`
- Frequent tag chip: `job.tags.includes('frequent')`
- Repeat tag chip: `job.tags.includes('repeat')`

---

## Phase 3 — All Jobs

### `jobs-list.tsx`

**Filter panel — add slide animation:**
Wrap filter panel content in always-mounted `<div>` with CSS transitions:
- `maxHeight`: `0` → `${innerRef.current.scrollHeight}px` (measured)
- `opacity`: `0` → `1` over 200ms
- `transform: translateY(-6px)` → `translateY(0)` over 300ms `cubic-bezier(0.4,0,0.2,1)`
- `marginTop`: `0` → `10px`
Use `useRef` + `useEffect` to measure content height when `inlineFiltersOpen` changes.

**Filter panel styling:**
| Property | Before | After |
|---|---|---|
| `backgroundColor` | `#F9F9F9` | `#FAFAFA` |
| Border | top/bottom `1px solid #F0F0F0` | `1px solid #E5E5E5`, `borderRadius: 8px` |
| `padding` | `12px 24px` | `14px 16px` |
| Labels above selects | None | `STATUS`, `TYPE`, `BRAND` — `11px, uppercase, #A3A3A3, letterSpacing 0.06em` |

**Filters button:**
- Icon: `SlidersHorizontal` → `Filter`
- Add active-count badge (pill) on button when any filter is active
- Add `Clear` button (with `X` icon) next to Filters button when filters are active

**Table:**
- Header row: add `backgroundColor: '#FAFAFA'`
- Header cell text color: `#737373` → `#94A3B8`
- Brand column (desktop): `{job.brandName ?? "—"}` → `<BrandSwatch name={job.brandName} colorHex={null} />`
- Row hover: add `onMouseEnter/Leave` (`backgroundColor: #FAFAFA`)
- Chronic left-border: move from `<tr>` to CUSTOMER `<td>`: `borderLeft: job.tags.includes('chronic') ? '2px solid #9F1239' : '2px solid transparent'`

---

## Phase 4 — Technicians + Dealers

### `avatar.tsx`

Update PALETTE to design's solid opaque colors (5 entries, picked by `charCodeAt(0) % 5`):
```
{ bg: '#EDE9FE', color: '#5B21B6' }
{ bg: '#D1FAE5', color: '#065F46' }
{ bg: '#FEF3C7', color: '#92400E' }
{ bg: '#FCE7F3', color: '#9D174D' }
{ bg: '#DBEAFE', color: '#1E40AF' }
```

### `status-toggle.tsx`

Rewrite to segmented two-sided pill (matches design):
- Container: `display: inline-flex, backgroundColor: #EBEBEB, borderRadius: 9999px, padding: 3px, gap: 2px`
- "Active" button (left): when active → `backgroundColor: #ECFDF5, color: #065F46` with green dot; when inactive → transparent, `#A3A3A3`, no dot
- "Inactive" button (right): when inactive → `backgroundColor: #F1F5F9, color: #475569` with slate dot; when active → transparent, `#A3A3A3`, no dot
- Both buttons: `padding: 5px 12px, borderRadius: 9999px, border: none, fontSize: 12px, fontWeight: 500`
- Clicking the already-selected side is a no-op (`cursor: default`)
- Props stay identical: `{ active, onToggle, disabled, loading }`

### `technicians/page.tsx`

**Technician cards:**
| Property | Before | After |
|---|---|---|
| Card `backgroundColor` | `#FAFAFA` | `#fff` |
| Card padding (desktop) | `14px 16px` | `18px 20px` |
| Inactive state | text color `#737373` | `opacity: 0.6` on whole card |
| Hover | None | `boxShadow: 0 4px 16px rgba(0,0,0,0.06)` + `borderColor: #D4D4D4` |
| Divider | None | `1px × 32px, #E5E5E5` between name and controls |
| Edit button | `✎` Unicode, transparent | `Edit` icon (12px), `border: 1px solid #E5E5E5`, `bg: #FAFAFA`, `padding: 6px 10px`, `borderRadius: 8px` |

**Create/Edit form — change from `<Modal>` to bottom-sheet:**
- Overlay: `position: fixed, inset: 0, backgroundColor: rgba(0,0,0,0.35), display: flex, alignItems: flex-end, justifyContent: center`
- Sheet: `backgroundColor: #fff, borderRadius: 16px 16px 0 0, width: 100%, maxWidth: 520px, maxHeight: 95vh, display: flex, flexDirection: column`
- Header: title + X close button, `padding: 16px 20px, borderBottom: 1px solid #E5E5E5`
- Body: scrollable `overflow-y: auto`, `padding: 20px`, `gap: 14px` between fields
- Footer: Cancel + primary action buttons, `padding: 14px 20px, borderTop: 1px solid #E5E5E5`
- Fields kept: name, email, password (create); name (readonly) + status toggle (edit)

### `dealer-management/page.tsx`

Same card + hover + divider + edit button changes as Technicians.

- Remove local `SegmentedStatusToggle` — use updated shared `StatusToggle`
- Change centered `<Modal>` to same bottom-sheet pattern
- Form fields kept: business name, contact name, email, region, brand assignment checkboxes (create); same + credentials section (edit)

---

## Files Changed

| File | Change type |
|---|---|
| `src/components/layout/sidebar.tsx` | Surgical edits |
| `src/components/layout/app-shell.tsx` | Surgical edits + new popover |
| `src/components/dashboard/kpi-card.tsx` | Visual property changes |
| `src/app/(protected)/dashboard/page.tsx` | Color + table style + tag logic |
| `src/components/jobs/jobs-list.tsx` | Filter animation + table tweaks |
| `src/components/ui/avatar.tsx` | Palette update |
| `src/components/ui/status-toggle.tsx` | Rewrite to segmented design |
| `src/app/(protected)/technicians/page.tsx` | Card style + bottom-sheet form |
| `src/app/(protected)/dealer-management/page.tsx` | Card style + bottom-sheet form |

---

## Out of Scope

- `bottom-nav.tsx` — file kept but no longer rendered (mobile bottom nav removed)
- No backend / API changes
- No changes to job detail, pending schedule, analytics, notifications pages
- No changes to technician/dealer detail panel overlays (already close to design)
