# Priority 2 — Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page in the CoolDesk platform usable on phones (≤768px) by extracting a shared `useMobileBreakpoint()` hook and applying targeted inline-style fixes across all pages.

**Architecture:** A single `useMobileBreakpoint()` hook wraps the existing `useSyncExternalStore` + `window.matchMedia` pattern already in `app-shell.tsx`. Each page imports the hook and conditionally swaps layout values (grid columns, padding, overflow). No CSS framework, no new dependencies — pure inline-style switching consistent with the existing codebase.

**Tech Stack:** Next.js 16, React 19, TypeScript, inline styles, Vitest, `useSyncExternalStore` (React built-in)

## Global Constraints

- Inline styles only — no Tailwind, no CSS modules, no className-based responsive utilities
- Breakpoint: `768px` (matches existing `app-shell.tsx` — do not change)
- No new npm packages
- No backend changes
- Type-check command: `cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit`
- Palette: `#0A0A0A` buttons, `#E5E5E5` borders, `#FAFAFA` bg, `#171717` headings, `#737373` muted, `#525252` secondary, `#404040` labels, `13px` body, `12px` labels
- Mobile padding: `16px` (desktop is `24px` throughout)
- Commit from repo root: `/Users/muhammadwasi/Desktop/wasi/cooldesk`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/hooks/use-mobile-breakpoint.ts` | **Create** | Shared `useMobileBreakpoint(): boolean` hook |
| `src/components/layout/app-shell.tsx` | **Modify** | Use hook, fix search bar overflow, add backdrop overlay |
| `src/app/(protected)/dashboard/page.tsx` | **Modify** | 2-col KPI grid on mobile, padding |
| `src/components/jobs/jobs-list.tsx` | **Modify** | Table scroll wrapper, filter stack, padding |
| `src/components/jobs/job-detail.tsx` | **Modify** | Stack two-column layout, stack payment form |
| `src/app/(protected)/pending-schedule/page.tsx` | **Modify** | Stack panels, stack filter form |
| `src/app/(protected)/log-new-job/page.tsx` | **Modify** | Padding, unit row tighter grid |
| `src/app/(protected)/jobs/history/page.tsx` | **Modify** | Table scroll, padding |
| `src/app/(protected)/technicians/page.tsx` | **Modify** | Padding, header row wrap |
| `src/app/(protected)/dealer-management/page.tsx` | **Modify** | Padding, header row wrap |
| `src/app/(protected)/notifications/page.tsx` | **Modify** | Filter grid stack, padding |
| `src/app/(protected)/admin/brands/page.tsx` | **Modify** | Padding, form stack |
| `src/app/(protected)/admin/system-config/page.tsx` | **Modify** | Padding |

---

## Task 1: `useMobileBreakpoint` Hook + App Shell + Sidebar Backdrop

**Files:**
- Create: `src/hooks/use-mobile-breakpoint.ts`
- Modify: `src/components/layout/app-shell.tsx`

**Interfaces:**
- Produces: `useMobileBreakpoint(): boolean` — imported by all subsequent tasks

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-mobile-breakpoint.ts
"use client";

import { useSyncExternalStore } from "react";

const BREAKPOINT_QUERY = "(max-width: 768px)";

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(BREAKPOINT_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(BREAKPOINT_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useMobileBreakpoint(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

- [ ] **Step 2: Refactor `app-shell.tsx` to use the hook**

At the top of `src/components/layout/app-shell.tsx`, add the import:
```typescript
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

Remove the three functions `subscribeToMobileSidebarQuery`, `getMobileSidebarSnapshot`, `getMobileSidebarServerSnapshot` and the `MOBILE_SIDEBAR_QUERY` constant.

Replace the `isSmallScreen` declaration inside `AppShell`:
```typescript
// Remove this:
const isSmallScreen = useSyncExternalStore(
  subscribeToMobileSidebarQuery,
  getMobileSidebarSnapshot,
  getMobileSidebarServerSnapshot,
);

// Replace with:
const isSmallScreen = useMobileBreakpoint();
```

- [ ] **Step 3: Fix header search bar overflow**

Find the search bar `<button>` in the header. Change `minWidth: "240px"` to adapt on mobile. The header is `display: "flex", justifyContent: "space-between"`. The search bar sits in the middle.

Replace the search bar button style:
```typescript
style={{
  border: "1px solid #E5E5E5",
  borderRadius: "8px",
  backgroundColor: "#fff",
  height: "34px",
  width: isSmallScreen ? "100%" : undefined,
  minWidth: isSmallScreen ? 0 : "240px",
  flex: isSmallScreen ? 1 : undefined,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 10px",
  color: "#737373",
  fontSize: "13px",
  cursor: "pointer",
}}
```

Also update the outer header `<div />` placeholder (first child of the flex header) — on mobile it should not take space. Add `style={{ display: isSmallScreen ? "none" : undefined }}` to that first `<div />`.

- [ ] **Step 4: Add backdrop overlay for mobile sidebar**

In `AppShell`, inside the outer `<div>` that wraps everything, render the backdrop just before `<Sidebar .../>`:

```typescript
{isSmallScreen && mobileOpen ? (
  <div
    onClick={() => setMobileOpen(false)}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 39,
      backgroundColor: "rgba(0,0,0,0.3)",
    }}
  />
) : null}
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-mobile-breakpoint.ts src/components/layout/app-shell.tsx
git commit -m "feat: add useMobileBreakpoint hook, fix mobile header overflow, add sidebar backdrop"
```

---

## Task 2: Dashboard Mobile Grid

**Files:**
- Modify: `src/app/(protected)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useMobileBreakpoint` from `@/hooks/use-mobile-breakpoint`

- [ ] **Step 1: Add import and hook call**

At the top of `src/app/(protected)/dashboard/page.tsx`, add:
```typescript
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

Inside the page component function, add at the top:
```typescript
const isMobile = useMobileBreakpoint();
```

- [ ] **Step 2: Fix outer section padding**

Find `<section style={{ padding: "24px", maxWidth: "1400px" }}>` and change to:
```typescript
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1400px" }}>
```

- [ ] **Step 3: Fix KPI card grid**

Find `gridTemplateColumns: "repeat(4, minmax(0, 1fr))"` and change to:
```typescript
gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, minmax(0, 1fr))"
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(protected\)/dashboard/page.tsx
git commit -m "feat: make dashboard KPI grid 2-col on mobile"
```

---

## Task 3: Jobs List Mobile

**Files:**
- Modify: `src/components/jobs/jobs-list.tsx`

**Interfaces:**
- Consumes: `useMobileBreakpoint` from `@/hooks/use-mobile-breakpoint`

- [ ] **Step 1: Add import and hook call**

At the top of `src/components/jobs/jobs-list.tsx`, add:
```typescript
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

Inside `JobsList`, add at the top of the function body:
```typescript
const isMobile = useMobileBreakpoint();
```

- [ ] **Step 2: Fix outer section padding**

Find the outer `<section style={{ padding: "24px", ...` and change:
```typescript
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1400px" }}>
```

- [ ] **Step 3: Wrap table in scroll container**

Find the `<table` element inside the jobs list. Wrap it in an overflow container. Find the card `<div>` that directly contains the `<table>` and add `overflowX: "auto"` to it:

```typescript
// The card div that wraps the table — find it by its border/borderRadius styles
// Add overflowX: "auto" to its style:
style={{
  backgroundColor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E5E5E5",
  overflow: "hidden",
  overflowX: "auto",   // ← add this
  marginBottom: "20px",
}}
```

Note: `overflow: "hidden"` clips the scroll. Change it to: remove `overflow: "hidden"` from the card, add `overflowX: "auto"` and `borderRadius: "12px"` is fine — the table itself handles cell borders. Actually the `overflow: "hidden"` is needed for border-radius on the table. Use a nested wrapper:

```typescript
// Card div stays with overflow: "hidden", borderRadius: "12px"
// Add an inner wrapper around the table:
<div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
    ...
  </table>
</div>
```

The `minWidth: "600px"` ensures the table keeps readable column widths while the wrapper scrolls.

- [ ] **Step 4: Stack filter inputs on mobile**

Find the filter panel's grid container. It currently uses `gridTemplateColumns` with 6 columns. Replace with:

```typescript
style={{
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "repeat(6, minmax(0, 1fr))",
  gap: "10px",
  // ... other existing styles
}}
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/jobs/jobs-list.tsx
git commit -m "feat: make jobs list table scrollable and filters stack on mobile"
```

---

## Task 4: Job Detail Mobile

**Files:**
- Modify: `src/components/jobs/job-detail.tsx`

**Interfaces:**
- Consumes: `useMobileBreakpoint` from `@/hooks/use-mobile-breakpoint`

- [ ] **Step 1: Add import and hook call**

```typescript
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

Inside the component (after the existing hooks), add:
```typescript
const isMobile = useMobileBreakpoint();
```

- [ ] **Step 2: Fix outer section padding**

```typescript
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1160px" }}>
```

- [ ] **Step 3: Stack the two-column main layout**

Find `gridTemplateColumns: "2fr 1fr"` (the main content + sidebar grid):
```typescript
gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr"
```

- [ ] **Step 4: Stack the payment/transition form**

Find `gridTemplateColumns: "1fr 2fr auto"` (the status transition form row):
```typescript
gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr auto"
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/jobs/job-detail.tsx
git commit -m "feat: stack job detail two-column layout on mobile"
```

---

## Task 5: Schedule & Assign Mobile

**Files:**
- Modify: `src/app/(protected)/pending-schedule/page.tsx`

**Interfaces:**
- Consumes: `useMobileBreakpoint` from `@/hooks/use-mobile-breakpoint`

- [ ] **Step 1: Add import and hook call**

```typescript
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

Inside `PendingSchedulePage`, add at top:
```typescript
const isMobile = useMobileBreakpoint();
```

- [ ] **Step 2: Fix outer section padding**

```typescript
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1100px" }}>
```

- [ ] **Step 3: Wrap job queue table in scroll container**

Find the `<table>` inside the queue card. Add a scroll wrapper:
```typescript
<div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
    {/* existing table content */}
  </table>
</div>
```

- [ ] **Step 4: Stack the two-panel bottom layout**

Find `gridTemplateColumns: "1fr 340px"` and change to:
```typescript
gridTemplateColumns: isMobile ? "1fr" : "1fr 340px"
```

- [ ] **Step 5: Stack the customer lookup form inputs**

Find the lookup form's grid `gridTemplateColumns: "1fr 1fr auto auto"` and change to:
```typescript
style={{
  display: isMobile ? "flex" : "grid",
  flexDirection: isMobile ? "column" : undefined,
  gridTemplateColumns: isMobile ? undefined : "1fr 1fr auto auto",
  gap: "10px",
  marginTop: "16px",
}}
```

On mobile the Search and Clear buttons become full-width in the flex column.

- [ ] **Step 6: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/\(protected\)/pending-schedule/page.tsx
git commit -m "feat: stack Schedule & Assign panels and forms on mobile"
```

---

## Task 6: Log New Job Mobile

**Files:**
- Modify: `src/app/(protected)/log-new-job/page.tsx`

**Interfaces:**
- Consumes: `useMobileBreakpoint` from `@/hooks/use-mobile-breakpoint`

- [ ] **Step 1: Add import and hook call**

```typescript
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

Inside `LogNewJobPage`, add at top:
```typescript
const isMobile = useMobileBreakpoint();
```

- [ ] **Step 2: Fix outer section and form card padding**

```typescript
// Outer section:
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "720px" }}>

// Form card (the white bordered div):
style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: isMobile ? "20px" : "28px" }}
```

- [ ] **Step 3: Tighten unit detail row grid on mobile**

Find `gridTemplateColumns: "1fr 1fr 80px 32px"` (the unit detail rows):
```typescript
gridTemplateColumns: isMobile ? "1fr 1fr 56px 28px" : "1fr 1fr 80px 32px"
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(protected\)/log-new-job/page.tsx
git commit -m "feat: reduce padding and tighten unit row grid on mobile for log-new-job"
```

---

## Task 7: Remaining Pages Mobile

**Files:**
- Modify: `src/app/(protected)/jobs/history/page.tsx`
- Modify: `src/app/(protected)/technicians/page.tsx`
- Modify: `src/app/(protected)/dealer-management/page.tsx`
- Modify: `src/app/(protected)/notifications/page.tsx`
- Modify: `src/app/(protected)/admin/brands/page.tsx`
- Modify: `src/app/(protected)/admin/system-config/page.tsx`

**Interfaces:**
- Consumes: `useMobileBreakpoint` from `@/hooks/use-mobile-breakpoint`

All six files follow the same pattern: import hook, call it, reduce padding, fix any grid to stack on mobile, wrap tables in scroll containers.

- [ ] **Step 1: History page — padding + table scroll**

In `src/app/(protected)/jobs/history/page.tsx`:

Add import:
```typescript
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

Add hook call inside `JobsHistoryPage`:
```typescript
const isMobile = useMobileBreakpoint();
```

Fix padding:
```typescript
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1100px" }}>
```

Wrap the table in a scroll container:
```typescript
<div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
    {/* existing content */}
  </table>
</div>
```

- [ ] **Step 2: Technicians page — padding + header row wrap**

In `src/app/(protected)/technicians/page.tsx`:

Add import + hook call (same pattern).

Fix padding on outer section (`maxWidth: "980px"`):
```typescript
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "980px" }}>
```

The header row is `display: "flex", justifyContent: "space-between"`. On mobile the "Add technician" button can overflow. Add `flexWrap: "wrap", gap: "12px"` to that div:
```typescript
style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}
```

- [ ] **Step 3: Dealer Management page — padding + header wrap**

In `src/app/(protected)/dealer-management/page.tsx`:

Add import + hook call.

Fix padding (find the outer `<section>` — check for `maxWidth` to locate it):
```typescript
style={{ padding: isMobile ? "16px" : "24px", maxWidth: "..." }}
```

Same header wrap fix as technicians:
```typescript
style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}
```

- [ ] **Step 4: Notifications page — padding + filter grid stack**

In `src/app/(protected)/notifications/page.tsx`:

Add import + hook call.

Fix padding (outer `<section style={{ padding: "24px", maxWidth: "1000px" }}`):
```typescript
<section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1000px" }}>
```

Find `gridTemplateColumns: "repeat(3, minmax(0, 1fr))"` in the filter section and change to:
```typescript
gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))"
```

- [ ] **Step 5: Admin Brands page — padding**

In `src/app/(protected)/admin/brands/page.tsx`:

Add import + hook call.

Find the outer section padding and change to `isMobile ? "16px" : "24px"`.

If there are any side-by-side form inputs, wrap them: `flexWrap: "wrap"` on their container.

- [ ] **Step 6: Admin System Config page — padding**

In `src/app/(protected)/admin/system-config/page.tsx`:

Add import + hook call.

Find the outer section padding and change to `isMobile ? "16px" : "24px"`.

- [ ] **Step 7: Type-check all**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add \
  src/app/\(protected\)/jobs/history/page.tsx \
  src/app/\(protected\)/technicians/page.tsx \
  src/app/\(protected\)/dealer-management/page.tsx \
  src/app/\(protected\)/notifications/page.tsx \
  src/app/\(protected\)/admin/brands/page.tsx \
  src/app/\(protected\)/admin/system-config/page.tsx
git commit -m "feat: mobile padding, table scroll, and grid stack for remaining pages"
```

---

## Self-Review

**Spec coverage:**
- [x] Shared `useMobileBreakpoint` hook — Task 1
- [x] App shell search bar overflow + sidebar backdrop — Task 1
- [x] Dashboard 2-col KPI grid — Task 2
- [x] Jobs List table scroll + filter stack — Task 3
- [x] Job Detail two-column stack — Task 4
- [x] Schedule & Assign panel stack + form stack — Task 5
- [x] Log New Job padding + unit row — Task 6
- [x] History page table scroll + padding — Task 7
- [x] Technicians page padding + header wrap — Task 7
- [x] Dealer Management padding + header wrap — Task 7
- [x] Notifications filter grid stack — Task 7
- [x] Admin pages padding — Task 7
- [x] Analytics/Payment/Platform-Admin excluded (explicitly deferred in spec) ✓

**No placeholders:** All steps have exact code. Task 7 Step 5 (Admin Brands) says "if there are any side-by-side form inputs" — to remove ambiguity: add `flexWrap: "wrap"` to the form action row regardless; it's harmless if already wrapping.

**Type consistency:** `useMobileBreakpoint(): boolean` defined in Task 1, used as `isMobile` in Tasks 2-7. ✓
