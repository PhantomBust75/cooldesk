# Notification Center — Slide-in Drawer Design

**Date:** 2026-07-13
**Scope:** Staff dashboard only (owner / office_staff / technician). Dealer portal and platform admin are unchanged.
**Reference:** Screenshot of owner UI (`Notifications` overlay layout: title + unread pill + X, filter tabs, "Mark all as read", colored/urgency-tinted cards with "View job" links).

---

## Summary

Replace the dedicated `/notifications` page with a global slide-in Notification Center, mounted once in `AppShell` so it's reachable from any protected page without navigating away. Clicking the bell opens the drawer directly (the existing small preview popover is removed). Desktop gets a right-side drawer; mobile gets a bottom sheet with drag-to-dismiss. Content stays frontend-only — no backend schema changes — except for one new bulk "mark all as read" endpoint.

---

## Non-Goals

- No changes to the dealer portal's notification UX (separate `/dealer/notifications` endpoints, separate layout) — out of scope for this pass.
- No changes to the `notifications` DB table, `NotificationItem` type, or notification-insertion call sites in `jobs.service.ts` / `reviews.service.ts`.
- No personalized description text (e.g. customer/technician names) — notification payloads only ever contain `{ jobId }` (occasionally `+ revisitId`), confirmed by inspecting every insertion call site. Descriptions are generic, per-eventType templates.
- No per-row "Mark read" button — only "Mark all as read" (bulk) plus implicit mark-as-read when the user clicks "View Job" on an item.
- No redirect kept for the old `/notifications` route — it is deleted outright (no other in-app link points to it).

---

## 1. Backend Change — Bulk Mark-All-Read

**New endpoint:** `PATCH /notifications/read-all`
- Guards: `TenantGuard, RolesGuard` with `@Roles('owner', 'office_staff', 'technician')`, same as the existing `GET /notifications` route.
- Controller: add a handler in `backend/src/modules/notifications/notifications.controller.ts` alongside `markUserNotificationRead`.
- Service: add `markAllUserNotificationsRead(ctx)` to `backend/src/modules/notifications/notifications.service.ts`:
  ```sql
  UPDATE notifications
  SET is_read = true, read_at = NOW()
  WHERE organization_id = $1 AND recipient_user_id = $2 AND is_read = false
  ```
- Response: `{ ok: true, count: <rows updated> }`.
- No DTO needed (no request body).
- No dealer-side equivalent (out of scope per decided scope).

**Frontend client:** add `markAllNotificationsRead(audience: Audience): Promise<{ ok: true; count: number }>` to `frontend/src/lib/api/notifications.ts`, calling `PATCH /notifications/read-all` (staff audience only — this function is not called for `audience === 'dealer'` since dealer scope is excluded).

---

## 2. Frontend Notification Meta Mapping (no backend involvement)

New file: `frontend/src/lib/notifications/notification-meta.ts`

```ts
export type NotificationCategory = 'cancellation' | 'assignment' | 'other';
export type NotificationPriority = 'high' | 'medium' | 'normal';

export type NotificationMeta = {
  title: string;
  description: string;
  category: NotificationCategory;
  priority: NotificationPriority;
};

export function getNotificationMeta(eventType: string): NotificationMeta;
```

Static lookup table for the 12 known `eventType` values currently produced by the backend:

| eventType | title | category | priority |
|---|---|---|---|
| `job_assigned` | Job Assigned | assignment | normal |
| `dealer_job_submitted` | New Dealer Job | other | normal |
| `no_show_flagged` | No-Show Flagged | other | high |
| `job_unacknowledged` | Job Unacknowledged | other | medium |
| `revisit_pending_scheduling` | Revisit Pending Scheduling | other | medium |
| `third_revisit_reached` | Chronic Job Flagged | other | high |
| `cancellation_request_submitted` | Cancellation Requested | cancellation | medium |
| `cancellation_request_outcome` | Cancellation Request Update | cancellation | normal |
| `vcid_review_required` | VCID Review Required | other | medium |
| `repeat_complaint_detected` | Repeat Complaint Detected | other | high |
| `frequent_complaint_detected` | Frequent Complaints Detected | other | high |
| `low_rating_received` | Low Rating Received | other | medium |

Each entry also has a fixed, generic `description` string (e.g. `third_revisit_reached` → "This job has reached its 3rd revisit and has been flagged as chronic."). Descriptions do not interpolate any payload data beyond what's already safe to assume (nothing — payload is `{ jobId }` only).

**Fallback:** any `eventType` not in the table gets `{ title: humanize(eventType), description: '', category: 'other', priority: 'normal' }`, reusing the existing humanization logic from `eventLabel()` (moved into this new file; the old page's local `eventLabel()`/app-shell's `formatEventType()` are superseded by this single shared function).

**Filter tab logic** (replaces today's regex-on-eventType):
- `all` → all items
- `unread` → `!item.isRead`
- `cancellations` → `getNotificationMeta(item.eventType).category === 'cancellation'`
- `assignments` → `getNotificationMeta(item.eventType).category === 'assignment'`

---

## 3. Drawer Component

New file: `frontend/src/components/notifications/notification-drawer.tsx`, exporting `NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void })`.

Follows the existing custom-inline-style pattern used by `frontend/src/components/layout/search-modal.tsx` and `frontend/src/components/ui/modal.tsx` — no external UI library (matches the rest of the app; MUI/shadcn are not used anywhere else).

### Data
- `useQuery(["notifications", audience], () => fetchNotifications(audience, {}))` — full list, same as today's page.
- `audience` derived the same way as today (`session.user.role === 'dealer' ? 'dealer' : 'user'` — though in practice this drawer only mounts for staff roles since it lives in the staff `AppShell`).
- Local `tab` state: `'all' | 'unread' | 'cancellations' | 'assignments'`, default `'all'`.
- "Mark all as read" button calls `markAllNotificationsRead(audience)`, then invalidates the `["notifications", ...]` and unread-count queries, and shows `enqueueSnackbar('All notifications marked as read', { variant: 'success' })` (or an error variant on failure) — replacing today's inline `feedback`/`errorMessage` `<p>` banners, per CLAUDE.md's notistack convention.
- Clicking "View Job" on an unread item calls `markNotificationRead(audience, item.id)`, invalidates the unread-count query (so the bell badge updates even though the drawer is about to close) on success, then `router.push(`/jobs/${item.jobId}`)` and `onClose()`. The navigation does not wait on the mark-read call resolving.

### Desktop layout (≥ mobile breakpoint, via existing `useMobileBreakpoint()`)
- Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,0.28); zIndex: 10000`, click → `onClose()`. (Existing app-shell popovers/dropdowns top out at `zIndex: 9999` — the drawer must sit above those.)
- Panel: `position: fixed; top:0; right:0; bottom:0; width:460px; background:#fff; box-shadow: ...; zIndex: 10001`.
- Animation: `transform: translateX(0)` when open, `translateX(100%)` when closed, `transition: transform 260ms cubic-bezier(0.32,0.72,0,1)`. Panel stays mounted (not unmounted) while animating out, matching the reference `NotificationOverlay.tsx` approach.
- `Escape` keydown listener (added while `open`) calls `onClose()`.
- Body scroll lock while open (`document.body.style.overflow = 'hidden'`, restored on close).

### Mobile layout (below breakpoint)
- Bottom sheet: slides up via `translateY`, rounded top corners (`borderRadius: '16px 16px 0 0'`), same backdrop.
- Drag-to-dismiss: touch handlers (`onTouchStart/Move/End`) tracking vertical drag distance; releasing past a threshold calls `onClose()`, otherwise springs back — ported from the existing reference mockup at `Owner's View UI Design/src/app/components/notifications/NotificationOverlay.tsx` (lines ~141-251).
- No `Escape` handling needed on mobile (no hardware keyboard expected), but harmless to keep the same listener active.

### Header
- "Notifications" title (large, bold — matches reference screenshot weight/size).
- Unread-count pill: reuse existing badge styling (`backgroundColor: '#2563EB'`, white text, `borderRadius: 9999px`, `fontSize: 11px`, `padding: '4px 10px'`, `fontWeight: 600`) — same values already used on the current page (`frontend/src/app/(protected)/notifications/page.tsx:107`).
- X button, top-right, calls `onClose()`.

### Filter tabs + Mark all as read row
Reuse the existing established pill styling from the current page (already applied, from `docs/superpowers/specs/2026-07-01-owner-portal-pages-design-match.md` §4.3):
- Active: `backgroundColor: '#0A0A0A'`, `color: '#fff'`, `borderRadius: 9999px`, `padding: '6px 14px'`, `fontSize: 13px`, `fontWeight: 500`.
- Inactive: `backgroundColor: '#F5F5F5'`, `color: '#404040'`, same shape.
- "Mark all as read" button to the right of the tabs (or wrapping below on narrow widths), disabled/hidden when unread count is 0.

### Notification cards
Each card shows: title (from meta), description (from meta), relative/formatted timestamp (`createdAt`), unread dot, priority indicator, "View Job →" link (only when `jobId` is present).

Background tint by priority, applied only while unread so read-vs-unread stays the primary, unambiguous visual distinction (reusing the app's existing red/amber palette from the same prior design spec §4.4, previously specified but never wired up since no priority field existed yet — now it does):

| State | `backgroundColor` |
|---|---|
| Read (any priority) | `#fff` |
| Unread, normal priority | `#FAFAFA` |
| Unread, high priority | `#FEF2F2` |
| Unread, medium priority | `#FFFBEB` |

Priority icon: red warning triangle (`AlertTriangle` from `lucide-react`, `color: '#DC2626'`) for `high`, amber warning triangle (`color: '#F59E0B'`) for `medium`, none for `normal`. The icon is shown regardless of read state (so a card doesn't lose its "this was high priority" signal once read) — only the background tint and the unread dot (`#2563EB`, existing convention) go away on read.

Scrollable list container: `overflow-y: auto`, fills remaining drawer height below the header/tabs.

---

## 4. AppShell Changes

`frontend/src/components/layout/app-shell.tsx`:
- Remove the existing notification preview popover: `notifOpen` state, `notifRef`, its outside-click `mousedown` listener, and both popover JSX blocks (mobile ~321-363, desktop ~540-582).
- Remove the two `router.push('/notifications')` call sites (popover item click, "View all notifications" button) — superseded by the drawer.
- Add `drawerOpen` state. Bell button `onClick` becomes `() => setDrawerOpen(true)`.
- Mount `<NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />` once, near the existing `<SearchModal open={searchOpen} onClose={...} />` mount (~line 678).
- Keep `unreadCountQuery` in `AppShell` for the bell's badge count (unchanged). The `notifsQuery` used only for popover preview content is removed (no longer needed — the drawer fetches its own full list when opened).
- Bell remains hidden for technicians and platform admins (unchanged guard conditions).

---

## 5. Route Removal

- Delete `frontend/src/app/(protected)/notifications/page.tsx` and its co-located test file.
- No redirect — confirmed no sidebar nav item or other in-app link points to `/notifications`; the bell was the only entry point.

---

## 6. Testing

- Backend: add a test for `PATCH /notifications/read-all` in the existing notifications test file — verify it flips all unread rows for the calling user's org+user to read, leaves other users'/orgs' rows untouched, and is idempotent (running twice doesn't error, second call reports `count: 0`).
- Frontend: replace `frontend/src/app/(protected)/notifications/page.test.tsx` with a test for `NotificationDrawer` covering: opens/closes via X, backdrop click, and Esc; filter tabs correctly partition items by category; "Mark all as read" calls the bulk endpoint and shows a success snackbar; clicking "View Job" marks the item read and navigates.
- Update any existing `app-shell.test.tsx` (if present) to reflect the popover's removal and the bell's new direct-open behavior.
- Run `cd backend && npm test` (must use `--runInBand`, already the configured script) and `cd frontend && npm run test:run` after implementation.
- Manual verification: open the app, click the bell from Dashboard/All Jobs/Job Details, confirm the background page stays visible and dimmed, confirm Esc/X/outside-click all close it, confirm "View Job" navigates and closes the drawer, confirm mobile viewport shows the bottom sheet with working drag-to-dismiss.

---

## Files Touched

| File | Change |
|---|---|
| `backend/src/modules/notifications/notifications.controller.ts` | Add `PATCH /notifications/read-all` route |
| `backend/src/modules/notifications/notifications.service.ts` | Add `markAllUserNotificationsRead` |
| `backend/src/modules/notifications/*.spec.ts` | Add bulk-read-all test |
| `frontend/src/lib/api/notifications.ts` | Add `markAllNotificationsRead` |
| `frontend/src/lib/notifications/notification-meta.ts` | New — eventType → title/description/category/priority mapping |
| `frontend/src/components/notifications/notification-drawer.tsx` | New — the drawer/bottom-sheet component |
| `frontend/src/components/layout/app-shell.tsx` | Remove popover, mount drawer, change bell `onClick` |
| `frontend/src/app/(protected)/notifications/page.tsx` | Deleted |
| `frontend/src/app/(protected)/notifications/page.test.tsx` | Deleted (replaced by drawer test) |
