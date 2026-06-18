# Priority 2 — Mobile Responsiveness Design

**Date:** 2026-06-18  
**Scope:** Full mobile responsiveness across the CoolDesk platform  
**Target devices:** Android phones, iPhones, small-screen devices (≤768px)  
**Stack:** Next.js 16, React 19, inline styles only

---

## Strategy

Extract the existing `useSyncExternalStore` mobile-detection pattern from `app-shell.tsx` into a shared hook (`src/hooks/use-mobile-breakpoint.ts`). Each page/component imports `useMobileBreakpoint()` → `isMobile: boolean` and switches inline style values at the relevant breakpoint. No CSS framework, no new dependencies — consistent with the 100% inline-styles codebase.

Breakpoint: **768px** (already used in `app-shell.tsx`).

---

## 1. Shared Hook

**File:** `src/hooks/use-mobile-breakpoint.ts`

```typescript
export function useMobileBreakpoint(): boolean
```

Extracted verbatim from `app-shell.tsx` — the three functions (`subscribeToMobileSidebarQuery`, `getMobileSidebarSnapshot`, `getMobileSidebarServerSnapshot`) become internal to the hook. `app-shell.tsx` replaces its local logic with a call to `useMobileBreakpoint()`. This is the only shared infrastructure change.

---

## 2. Navigation — App Shell + Sidebar

**File:** `src/components/layout/app-shell.tsx`

- Use `useMobileBreakpoint()` instead of inline `useSyncExternalStore` logic
- Header search bar: `minWidth: "240px"` → on mobile: `minWidth: 0, flex: 1, maxWidth: "none"` so it doesn't overflow
- "Log new job" button: stays text on desktop, shrinks gracefully on mobile (no icon-only treatment — text is fine at mobile widths)

**File:** `src/components/layout/sidebar.tsx`

- When `isSmallScreen && mobileOpen`: render a backdrop overlay (`position: fixed, inset: 0, zIndex: 39, backgroundColor: "rgba(0,0,0,0.3)"`) behind the sidebar. Clicking the backdrop calls `onNavigate()` (closes the menu). The sidebar itself is already at `zIndex: 40`.
- No changes to sidebar width logic — collapse/expand already works.

---

## 3. Dashboard

**File:** `src/app/(protected)/dashboard/page.tsx`

**KPI card grid:**
```
desktop: gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
mobile:  gridTemplateColumns: "repeat(2, 1fr)"
```

Padding: `24px` → `16px` on mobile (applies to the outer `<section>`).

---

## 4. Jobs List

**File:** `src/components/jobs/jobs-list.tsx`

- Outer `<section>` padding: `24px` → `16px` on mobile
- Table container: wrap in `<div style={{ overflowX: "auto" }}>` — horizontal scroll on mobile, table layout preserved
- Filter panel: filter inputs currently horizontal (`display: "grid", gridTemplateColumns: "repeat(6, ...)"`) → on mobile `display: "flex", flexDirection: "column"` with each filter full-width
- Hide the "Filters" toggle panel on mobile and show filters inline (collapsed by default), OR keep the toggle but stack filters vertically when open — stacking vertically when open is simpler and sufficient

---

## 5. Job Detail

**File:** `src/components/jobs/job-detail.tsx`

- Outer padding: `24px` → `16px` on mobile
- Action button row (status transitions): if buttons are side-by-side, wrap with `flexWrap: "wrap"` and `gap: "8px"`
- Timeline section: already single-column, no changes needed
- Payment section: already single-column

---

## 6. Schedule & Assign

**File:** `src/app/(protected)/pending-schedule/page.tsx`

**Two-panel layout:**
```
desktop: gridTemplateColumns: "1fr 340px"
mobile:  gridTemplateColumns: "1fr"  (panels stack — schedule form below job queue)
```

**Customer lookup form:**
```
desktop: gridTemplateColumns: "1fr 1fr auto auto"
mobile:  display: "flex", flexDirection: "column", gap: "8px"
```
Search and Clear buttons become full-width on mobile.

**Schedule form panel:** already single-column inside — no changes to form fields, just the outer grid collapses.

Outer padding: `24px` → `16px` on mobile.

---

## 7. Log New Job Form

**File:** `src/app/(protected)/log-new-job/page.tsx`

- Outer `<section>` padding: `24px` → `16px` on mobile
- Form card padding: `28px` → `20px` on mobile
- Unit detail row grid: `"1fr 1fr 80px 32px"` → on mobile `"1fr 1fr"` (model + type on first row; quantity + remove button wrap naturally via `flexWrap`)

Actually simpler: wrap unit rows in `flexWrap: "wrap"` and let model/type take 45% each and qty/remove take auto widths. Or keep the grid and reduce column widths. The simplest fix: on mobile use `"1fr 1fr 60px 28px"` — slightly narrower columns that fit a 375px screen (4 columns still fit if padding is 16px: 375 - 32 = 343px for 4 columns).

**Decision:** Keep 4-column grid on mobile with tighter widths — `isMobile ? "1fr 1fr 56px 28px" : "1fr 1fr 80px 32px"`. Simpler than wrapping.

---

## 8. Technician History Page

**File:** `src/app/(protected)/jobs/history/page.tsx`

- Outer padding: `24px` → `16px` on mobile
- Table container: wrap in `<div style={{ overflowX: "auto" }}>` — horizontal scroll

---

## 9. Technicians Page

**File:** `src/app/(protected)/technicians/page.tsx`

- Outer padding: `24px` → `16px` on mobile
- Any side-by-side layouts: stack vertically
- Action buttons: `flexWrap: "wrap"`

---

## 10. Dealer Management Page

**File:** `src/app/(protected)/dealer-management/page.tsx`

- Outer padding: `24px` → `16px` on mobile
- Dealer list cards: already single-column, no grid changes needed
- Action buttons per row (`flexWrap: "wrap"` if side-by-side)

---

## 11. Notifications Page

**File:** `src/app/(protected)/notifications/page.tsx`

- Outer padding: `24px` → `16px` on mobile
- Notification list: already single-column, minimal changes

---

## 12. Admin Pages (Brands, System Config)

**Files:** `src/app/(protected)/admin/brands/page.tsx`, `src/app/(protected)/admin/system-config/page.tsx`

- Outer padding: `24px` → `16px` on mobile
- Any form/input rows: stack vertically on mobile

---

## Out of Scope

- Analytics page (owner/office only, rarely used on mobile — deferred)
- Payment Methods page (owner only, desktop workflow — deferred)
- Platform Admin page (internal tool — deferred)

---

## Files Touched

| File | Change |
|---|---|
| `src/hooks/use-mobile-breakpoint.ts` | **Create** — shared hook |
| `src/components/layout/app-shell.tsx` | Use hook, fix search bar overflow |
| `src/components/layout/sidebar.tsx` | Add backdrop overlay on mobile |
| `src/app/(protected)/dashboard/page.tsx` | 2-col KPI grid on mobile, padding |
| `src/components/jobs/jobs-list.tsx` | Table scroll, filter stack, padding |
| `src/components/jobs/job-detail.tsx` | Padding, button wrap |
| `src/app/(protected)/pending-schedule/page.tsx` | Stack panels, form stack, padding |
| `src/app/(protected)/log-new-job/page.tsx` | Padding, unit row tighter grid |
| `src/app/(protected)/jobs/history/page.tsx` | Table scroll, padding |
| `src/app/(protected)/technicians/page.tsx` | Padding, button wrap |
| `src/app/(protected)/dealer-management/page.tsx` | Padding, button wrap |
| `src/app/(protected)/notifications/page.tsx` | Padding |
| `src/app/(protected)/admin/brands/page.tsx` | Padding, form stack |
| `src/app/(protected)/admin/system-config/page.tsx` | Padding, form stack |

---

## Success Criteria

- [ ] No horizontal overflow on any page at 375px viewport width (iPhone SE)
- [ ] All tables horizontally scrollable when content exceeds viewport
- [ ] Sidebar opens/closes cleanly with backdrop on mobile
- [ ] Dashboard KPI cards show 2 per row on mobile
- [ ] Schedule & Assign panels stack vertically on mobile
- [ ] Log New Job form usable on 375px screen
- [ ] All form inputs full-width or near-full-width on mobile
- [ ] Padding reduced from 24px to 16px on all pages for mobile
