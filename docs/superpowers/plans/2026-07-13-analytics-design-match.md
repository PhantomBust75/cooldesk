# Analytics Page Design Match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the live Analytics page to match `Owner's View UI Design/src/app/pages/Analytics.tsx` — header layout, date-range control, KPI cards, charts, tables, and empty states — with zero backend or data-fetching changes.

**Architecture:** Single-file surgical edit of `frontend/src/app/(protected)/analytics/page.tsx`. No new files except a new test file for this previously-untested page. All styles stay inline (matches existing convention — no Tailwind, no CSS modules). No new API calls, no new query keys, no changes to `days`/`tab` state semantics.

**Tech Stack:** Next.js (App Router), React, TypeScript, `@tanstack/react-query`, `recharts@^3.9.0`, `lucide-react@^1.16.0`, Vitest + `@testing-library/react`.

**Design spec:** `docs/superpowers/specs/2026-07-13-analytics-design-match.md` — read it for the full rationale behind every value below (exact reference file:line citations, and the 3 field/unit mismatches already caught and corrected).

## Global Constraints

- All styles MUST stay inline (`style={{...}}`). No Tailwind, no CSS modules, no new component files — everything is a page-local function inside `page.tsx`, matching the existing pattern (`KpiCard`, `TabButton`, etc. are already defined this way).
- Do NOT change any `useQuery` hooks, query keys, API client functions, or the `days`/`tab` state's meaning. The only new state allowed is purely presentational (dropdown open/closed, row-hover tracking).
- Do NOT add a "trend" value to any KPI card — no backend field backs it. `KpiCard` gains the *capability*, but no call site passes it.
- Do NOT add a color-swatch dot to the brand table (the field it needs isn't returned by `getBrandAnalytics` — confirmed in the spec; adding it means a backend change, out of scope).
- Do NOT rename `total`/`completed` daily-chart fields to the reference's "installations"/"complaints" — those are reference-mock-only concepts; keep the live field names.
- Exact hex values as specified in the spec — do not substitute or approximate colors.
- TypeScript must stay clean: `cd frontend && npx tsc --noEmit` must pass after every task.
- Full test suite must stay green: `cd frontend && npm run test:run` after every task.
- Read `frontend/CLAUDE.md` before writing any code — it flags Next.js version caveats and the `useSnackbar`/API-client conventions.

---

## File Map

| File | Tasks | Change type |
|---|---|---|
| `frontend/src/app/(protected)/analytics/page.tsx` | 1–8 | All changes — header, date dropdown, export button, KPI cards, charts, empty states, tables |
| `frontend/src/app/(protected)/analytics/page.test.tsx` | 1–8 | New file — created in Task 1, extended in every later task |

No backend files change. No other frontend files change.

---

## Task 1: Test Harness + Baseline Smoke Test

**Files:**
- Create: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: `AnalyticsPage` default export from `./page` (existing, unchanged in this task)
- Produces: `renderPage()` helper, `DEFAULT_OVERVIEW`/`DEFAULT_DAILY` fixtures, and the `vi.mock` setup for `@/lib/api/operations` + `@/lib/api/analytics-daily` — every later task's tests build on these.

This task only adds a test file and does not touch `page.tsx` — it establishes the harness every subsequent task's tests extend.

- [ ] **Step 1: Write the test file with a baseline smoke test**

```tsx
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AnalyticsPage from "./page";
import * as operationsApi from "@/lib/api/operations";
import * as analyticsDailyApi from "@/lib/api/analytics-daily";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@/lib/api/operations");
vi.mock("@/lib/api/analytics-daily");

const DEFAULT_OVERVIEW = {
  totalRevenue: 15000,
  totalJobs: 42,
  activeJobs: 10,
  completedJobs: 32,
  firstVisitResolutionRate: 88.5,
  revisitRate: 5.2,
};

const DEFAULT_DAILY = [
  { date: "2026-07-01", revenue: 500, total: 4, completed: 3 },
  { date: "2026-07-02", revenue: 700, total: 5, completed: 4 },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.mocked(operationsApi.fetchAnalyticsOverview).mockResolvedValue(DEFAULT_OVERVIEW);
  vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([]);
  vi.mocked(operationsApi.fetchAnalyticsBrands).mockResolvedValue([]);
  vi.mocked(operationsApi.fetchAnalyticsDealers).mockResolvedValue([]);
  vi.mocked(analyticsDailyApi.fetchAnalyticsDaily).mockResolvedValue(DEFAULT_DAILY);
});

afterEach(cleanup);

describe("AnalyticsPage", () => {
  it("renders the Analytics title and business KPI values", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes against today's unmodified page**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (1 test) — this confirms the harness itself works before any page.tsx changes begin. Every later task adds more tests to this same file.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "test: add test harness for analytics page"
```

---

## Task 2: Header Restructure — Responsive Layout, Date-Range Dropdown, Export Button

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Modify: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: `useMobileBreakpoint()` from `frontend/src/hooks/use-mobile-breakpoint.ts` (existing hook, unchanged)
- Produces: `DateRangeDropdown` component (`value`, `onChange`, `isMobile` props), restyled `ExportButton`, `isMobile` boolean in the main component — consumed by Task 3 (KPI grid breakpoint).

This is the biggest structural task: it replaces the native `<select>` with a custom dropdown, restyles the Export button, groups both next to the title in one responsive header, and removes the 4 duplicate per-tab toolbar rows (the date selector becomes a single shared control instead of one-per-tab).

- [ ] **Step 1: Write failing tests for the new header**

Add to `page.test.tsx`, inside the existing `describe("AnalyticsPage", ...)` block:

```tsx
  it("shows one shared date-range control and export button, not one per tab", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Analytics" });
    expect(screen.getAllByRole("button", { name: /Last 30 days/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Export/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Technician scorecards" }));
    expect(screen.getAllByRole("button", { name: /Last 30 days/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Export/i })).toHaveLength(1);
  });

  it("opens the date-range dropdown, selects a new range, and closes it", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Analytics" });

    fireEvent.click(screen.getByRole("button", { name: /Last 30 days/i }));
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 90 days" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(await screen.findByRole("button", { name: /Last 7 days/i })).toBeInTheDocument();
    expect(operationsApi.fetchAnalyticsOverview).toHaveBeenCalledWith(7);
    expect(screen.queryByRole("button", { name: "Last 90 days" })).not.toBeInTheDocument();
  });

  it("closes the date-range dropdown on outside click without changing the range", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Analytics" });

    fireEvent.click(screen.getByRole("button", { name: /Last 30 days/i }));
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button", { name: "Last 7 days" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Last 30 days/i })).toBeInTheDocument();
  });

  it("uses a 28px title on mobile and 36px on desktop", async () => {
    renderPage();
    const heading = await screen.findByRole("heading", { name: "Analytics" });
    expect(heading).toHaveStyle({ fontSize: "36px" });
    cleanup();

    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderPage();
    const mobileHeading = await screen.findByRole("heading", { name: "Analytics" });
    expect(mobileHeading).toHaveStyle({ fontSize: "28px" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: FAIL — `getByRole("button", { name: /Last 30 days/i })` finds nothing (today's control is a native `<select>`, which does not expose a `button` role), and there are 4 "Export CSV" buttons instead of 1.

- [ ] **Step 3: Update imports**

Find:
```tsx
import { fetchAnalyticsDaily } from "@/lib/api/analytics-daily";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
```

Replace with:
```tsx
import { fetchAnalyticsDaily } from "@/lib/api/analytics-daily";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, Download } from "lucide-react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
```

- [ ] **Step 4: Replace `WindowSelect` with `DateRangeDropdown`**

Find:
```tsx
function WindowSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        borderRadius: "8px",
        border: "1px solid #E5E5E5",
        padding: "6px 10px",
        fontSize: "12px",
        color: "#171717",
        backgroundColor: "#F9F9F9",
        cursor: "pointer",
      }}
    >
      <option value={7}>Last 7 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>
  );
}
```

Replace with:
```tsx
const DAY_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function DateRangeDropdown({
  value,
  onChange,
  isMobile,
}: {
  value: number;
  onChange: (n: number) => void;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeOption = DAY_OPTIONS.find((o) => o.value === value) ?? DAY_OPTIONS[1];

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "7px 12px",
          minHeight: "36px",
          borderRadius: "8px",
          border: "1px solid #E5E5E5",
          backgroundColor: open ? "#F5F5F5" : "#fff",
          fontSize: "13px",
          color: "#404040",
          cursor: "pointer",
        }}
      >
        <Calendar size={13} color="#737373" />
        {activeOption.label}
        <ChevronDown
          size={13}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            left: isMobile ? 0 : "auto",
            zIndex: 200,
            backgroundColor: "#fff",
            border: "1px solid #E5E5E5",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            minWidth: isMobile ? undefined : "220px",
            padding: "6px",
          }}
        >
          {DAY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: option.value === value ? "#F5F5F5" : "transparent",
                fontSize: "13px",
                color: "#171717",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "9999px",
                  backgroundColor: option.value === value ? "#0A0A0A" : "transparent",
                }}
              />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Restyle `ExportButton`**

Find:
```tsx
function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: "8px",
        border: "1px solid #E5E5E5",
        padding: "6px 12px",
        fontSize: "12px",
        color: "#404040",
        backgroundColor: "#F9F9F9",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      ↓ Export CSV
    </button>
  );
}
```

Replace with:
```tsx
function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "7px 12px",
        minHeight: "36px",
        borderRadius: "8px",
        border: "1px solid #E5E5E5",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        color: "#404040",
      }}
    >
      <Download size={13} strokeWidth={1.5} />
      Export
    </button>
  );
}
```

- [ ] **Step 6: Add `isMobile` to the main component**

Find:
```tsx
export default function AnalyticsPage() {
  const [tab, setTab] = useState<"business" | "technicians" | "brands" | "dealers">("business");
  const [days, setDays] = useState(30);
```

Replace with:
```tsx
export default function AnalyticsPage() {
  const isMobile = useMobileBreakpoint();
  const [tab, setTab] = useState<"business" | "technicians" | "brands" | "dealers">("business");
  const [days, setDays] = useState(30);
```

- [ ] **Step 7: Replace the header, and remove the Business tab's toolbar (folding the dropdown into the header)**

Find:
```tsx
  return (
    <section style={{ padding: "24px", maxWidth: "1400px" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "36px",
              fontWeight: 600,
              color: "#0A0A0A",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Analytics
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
            Last {days} days &middot; {monthLabel}
          </p>
        </div>
        <ExportButton onClick={handleExport} />
      </header>
```

Replace with:
```tsx
  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1400px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: isMobile ? "28px" : "36px",
              fontWeight: 600,
              color: "#0A0A0A",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Analytics
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
            Last {days} days &middot; {monthLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <DateRangeDropdown value={days} onChange={setDays} isMobile={isMobile} />
          <ExportButton onClick={handleExport} />
        </div>
      </div>
```

- [ ] **Step 8: Remove the Business tab's now-redundant per-tab toolbar**

Find:
```tsx
      {/* ── Business Tab ── */}
      {tab === "business" ? (
        <>
          {/* Tab toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>

          {overviewQuery.isLoading ? <LoadingRow /> : null}
```

Replace with:
```tsx
      {/* ── Business Tab ── */}
      {tab === "business" ? (
        <>
          {overviewQuery.isLoading ? <LoadingRow /> : null}
```

- [ ] **Step 9: Remove the Technicians tab's toolbar**

Find:
```tsx
      {/* ── Technicians Tab ── */}
      {tab === "technicians" ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>
          <section
```

Replace with:
```tsx
      {/* ── Technicians Tab ── */}
      {tab === "technicians" ? (
        <>
          <section
```

- [ ] **Step 10: Remove the Brands tab's toolbar**

Find:
```tsx
      {/* ── Brands Tab ── */}
      {tab === "brands" ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>
          <section
```

Replace with:
```tsx
      {/* ── Brands Tab ── */}
      {tab === "brands" ? (
        <>
          <section
```

- [ ] **Step 11: Remove the Dealers tab's toolbar**

Find:
```tsx
      {/* ── Dealers Tab ── */}
      {tab === "dealers" ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>
          <section
```

Replace with:
```tsx
      {/* ── Dealers Tab ── */}
      {tab === "dealers" ? (
        <>
          <section
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (all tests, including the 5 new ones from Step 1)

- [ ] **Step 13: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 14: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.tsx frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "feat(analytics): restructure header with shared date-range dropdown and export button"
```

---

## Task 3: KPI Card Restyle + Trend Support + Responsive Grid

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Modify: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: `isMobile` (from Task 2)
- Produces: `KpiCard`'s new optional `trend?: { label: string; isPositive: boolean }` prop — no call site uses it yet, but the shape is now available for any future backend-driven comparison data.

- [ ] **Step 1: Write failing tests**

Add to `page.test.tsx`:

```tsx
  it("does not show a trend/comparison row on any KPI card (no backend data for it yet)", async () => {
    renderPage();
    await screen.findByText("42");
    expect(screen.queryByText(/vs prev period/i)).not.toBeInTheDocument();
  });

  it("uses a 2-column KPI grid on mobile and 4-column on desktop", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderPage();
    const value = await screen.findByText("42");
    const grid = value.closest("div")?.parentElement?.parentElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: "repeat(2, 1fr)" });
  });
```

- [ ] **Step 2: Run tests to verify the grid test fails**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: the trend test PASSES already (nothing renders a trend row today); the grid test FAILS (today's grid is a fixed `repeat(4, 1fr)` regardless of `isMobile`).

- [ ] **Step 3: Update `KpiCard`**

Find:
```tsx
function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid #E5E5E5",
        backgroundColor: "#fff",
        padding: "20px",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#737373" }}>{title}</p>
      <p
        style={{
          margin: 0,
          fontSize: "24px",
          fontWeight: 600,
          color: "#171717",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
    </div>
  );
}
```

Replace with:
```tsx
function KpiCard({
  title,
  value,
  trend,
}: {
  title: string;
  value: string;
  trend?: { label: string; isPositive: boolean };
}) {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid #E5E5E5",
        backgroundColor: "#fff",
        padding: "20px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 500, color: "#737373", marginBottom: "6px" }}>{title}</div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "#0A0A0A",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {trend ? (
        <div
          style={{
            fontSize: "12px",
            color: trend.isPositive ? "#10B981" : "#EF4444",
            marginTop: "4px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {trend.label} <span style={{ color: "#737373" }}>vs prev period</span>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Make the KPI grid responsive**

Find:
```tsx
          {/* KPI cards — 3 columns, 2 rows */}
          {overview ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
```

Replace with:
```tsx
          {/* KPI cards */}
          {overview ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.tsx frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "feat(analytics): restyle KPI cards, add trend-row support, responsive grid"
```

---

## Task 4: Business Tab Chart Restyle

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Modify: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: nothing new from other tasks
- Produces: chart section now uses `<h3>` heading tags (was a plain `<div>` inside `ChartCard`) — Task 5 wraps this whole block in the empty-state conditional, so it must render exactly as produced here.

`ChartCard` is deleted entirely in this task — confirmed via grep it has no other callers, so unwrapping its only two usages leaves it fully unused.

- [ ] **Step 1: Write failing tests**

Add to `page.test.tsx`:

```tsx
  it("renders chart titles as headings, not inside a bordered ChartCard box", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 3, name: "Daily Revenue (RS)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Daily Jobs" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: FAIL — today's chart titles are `<div>`s inside `ChartCard`, not `<h3>` headings.

- [ ] **Step 3: Add `Legend` to the recharts import**

Find:
```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
```

Replace with:
```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
```

- [ ] **Step 4: Delete `ChartCard` (now-dead code)**

Find:
```tsx
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #E5E5E5",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "#171717",
          marginBottom: "12px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KpiCard({
```

Replace with:
```tsx
function KpiCard({
```

- [ ] **Step 5: Update `axisTickStyle` and `tooltipStyle`**

Find:
```tsx
const tooltipStyle = {
  fontSize: "12px",
  borderRadius: "8px",
  border: "1px solid #E5E5E5",
};

const axisTickStyle = { fontSize: 11, fill: "#737373" };
```

Replace with:
```tsx
const tooltipStyle = {
  fontSize: "12px",
  borderRadius: "8px",
  border: "1px solid #E5E5E5",
  boxShadow: "none",
};

const axisTickStyle = { fontSize: 12, fill: "#737373" };
```

- [ ] **Step 6: Replace the chart block**

Find:
```tsx
          {/* Bar chart — daily revenue */}
          {dailyQuery.isLoading ? <LoadingRow /> : null}
          {dailyQuery.isError ? <ErrorRow /> : null}
          {!dailyQuery.isLoading && !dailyQuery.isError && dailyData.length > 0 ? (
            <>
              <ChartCard title="Daily Revenue (RS)">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData} barSize={28}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E5E5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={axisTickStyle}
                      tickFormatter={fmt}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="revenue" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Line chart — daily jobs */}
              <ChartCard title="Daily Jobs">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E5E5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={axisTickStyle}
                      tickFormatter={fmt}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#737373"
                      strokeWidth={2}
                      dot={false}
                      name="Total"
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                      name="Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          ) : null}
```

Replace with:
```tsx
          {/* Bar chart — daily revenue */}
          {dailyQuery.isLoading ? <LoadingRow /> : null}
          {dailyQuery.isError ? <ErrorRow /> : null}
          {!dailyQuery.isLoading && !dailyQuery.isError && dailyData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "32px" }}>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                  Daily Revenue (RS)
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={axisTickStyle}
                      tickFormatter={fmt}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="revenue" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart — daily jobs */}
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                  Daily Jobs
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={axisTickStyle}
                      tickFormatter={fmt}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#525252"
                      strokeWidth={1.5}
                      dot={{ r: 3 }}
                      name="Total"
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      dot={{ r: 3 }}
                      name="Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 8: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.tsx frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "feat(analytics): restyle business-tab charts, remove ChartCard wrapper"
```

---

## Task 5: Business Tab Empty State

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Modify: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: the KPI grid from Task 3 and the chart block from Task 4 — both get wrapped in a new `overview.totalJobs === 0` conditional in this task.
- Produces: nothing consumed by later tasks (Tasks 6–8 are independent tables).

- [ ] **Step 1: Write failing tests**

Add to `page.test.tsx`:

```tsx
  it("shows a consolidated empty state when total_jobs is 0, instead of zero-value KPI cards", async () => {
    vi.mocked(operationsApi.fetchAnalyticsOverview).mockResolvedValue({
      totalRevenue: 0,
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      firstVisitResolutionRate: null,
      revisitRate: null,
    });
    vi.mocked(analyticsDailyApi.fetchAnalyticsDaily).mockResolvedValue([]);

    renderPage();
    expect(await screen.findByText("No analytics available for the selected period.")).toBeInTheDocument();
    expect(screen.getAllByText("No data to display")).toHaveLength(2);
    // The chart section titles still render above the placeholder boxes (by design — see
    // spec §6), so heading presence doesn't distinguish empty vs. non-empty. KPI card
    // labels only render in the non-empty path, so their absence is the real signal here.
    expect(screen.queryByText("Total Revenue (RS)")).not.toBeInTheDocument();
    expect(screen.queryByText("1st Visit Resolution")).not.toBeInTheDocument();
  });

  it("still shows KPI cards and charts when total_jobs is greater than 0", async () => {
    renderPage();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.queryByText("No analytics available for the selected period.")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify the empty-state test fails**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: the zero-jobs test FAILS (today the page renders 6 zero-value KPI cards, not the empty-state message); the second test PASSES already.

- [ ] **Step 3: Wrap the KPI grid + chart block in the empty-state conditional**

Find:
```tsx
          {overviewQuery.isLoading ? <LoadingRow /> : null}
          {overviewQuery.isError ? <ErrorRow /> : null}

          {/* KPI cards */}
          {overview ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <KpiCard
                title="Total Revenue (RS)"
                value={overview.totalRevenue.toLocaleString("en", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              />
              <KpiCard
                title="Total Jobs"
                value={String(overview.totalJobs)}
              />
              <KpiCard
                title="Active Jobs"
                value={String(overview.activeJobs)}
              />
              <KpiCard
                title="Completed Jobs"
                value={String(overview.completedJobs)}
              />
              <KpiCard
                title="1st Visit Resolution"
                value={
                  overview.firstVisitResolutionRate != null
                    ? `${overview.firstVisitResolutionRate.toFixed(1)}%`
                    : "—"
                }
              />
              <KpiCard
                title="Revisit Rate"
                value={
                  overview.revisitRate != null
                    ? `${overview.revisitRate.toFixed(1)}%`
                    : "—"
                }
              />
            </div>
          ) : null}

          {/* Bar chart — daily revenue */}
          {dailyQuery.isLoading ? <LoadingRow /> : null}
          {dailyQuery.isError ? <ErrorRow /> : null}
          {!dailyQuery.isLoading && !dailyQuery.isError && dailyData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "32px" }}>
```

Replace with:
```tsx
          {overviewQuery.isLoading ? <LoadingRow /> : null}
          {overviewQuery.isError ? <ErrorRow /> : null}

          {overview && overview.totalJobs === 0 ? (
            <div>
              <div style={{ textAlign: "center", padding: "32px 12px", fontSize: "14px", color: "#737373" }}>
                No analytics available for the selected period.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "32px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                    Daily Revenue (RS)
                  </h3>
                  <div
                    style={{
                      height: "240px",
                      border: "1px dashed #E5E5E5",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      color: "#A3A3A3",
                    }}
                  >
                    No data to display
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                    Daily Jobs
                  </h3>
                  <div
                    style={{
                      height: "200px",
                      border: "1px dashed #E5E5E5",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      color: "#A3A3A3",
                    }}
                  >
                    No data to display
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {overview && overview.totalJobs > 0 ? (
            <>
          {/* KPI cards */}
          {overview ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <KpiCard
                title="Total Revenue (RS)"
                value={overview.totalRevenue.toLocaleString("en", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              />
              <KpiCard
                title="Total Jobs"
                value={String(overview.totalJobs)}
              />
              <KpiCard
                title="Active Jobs"
                value={String(overview.activeJobs)}
              />
              <KpiCard
                title="Completed Jobs"
                value={String(overview.completedJobs)}
              />
              <KpiCard
                title="1st Visit Resolution"
                value={
                  overview.firstVisitResolutionRate != null
                    ? `${overview.firstVisitResolutionRate.toFixed(1)}%`
                    : "—"
                }
              />
              <KpiCard
                title="Revisit Rate"
                value={
                  overview.revisitRate != null
                    ? `${overview.revisitRate.toFixed(1)}%`
                    : "—"
                }
              />
            </div>
          ) : null}

          {/* Bar chart — daily revenue */}
          {dailyQuery.isLoading ? <LoadingRow /> : null}
          {dailyQuery.isError ? <ErrorRow /> : null}
          {!dailyQuery.isLoading && !dailyQuery.isError && dailyData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "32px" }}>
```

- [ ] **Step 4: Close the new wrapping fragment after the existing chart block**

Find:
```tsx
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      dot={{ r: 3 }}
                      name="Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* ── Technicians Tab ── */}
```

Replace with:
```tsx
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      dot={{ r: 3 }}
                      name="Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ── Technicians Tab ── */}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.tsx frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "feat(analytics): add consolidated empty state for zero-activity periods"
```

---

## Task 6: Technicians Table Polish

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Modify: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: `hoveredTechnicianId` state (local to this task only — Brands/Dealers tables get their own independent hover state in Tasks 7/8, not shared)

- [ ] **Step 1: Write failing tests**

Add to `page.test.tsx`:

```tsx
  it("shows a 'no data' row in the technicians table when the array is empty, and colors on-time-rate by threshold", async () => {
    vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([
      {
        technicianId: "t1",
        technicianName: "Ahmed Al-Rashid",
        jobsCompleted: 12,
        revenueCollected: 4200,
        firstVisitResolutionRate: 90,
        avgResolutionMinutes: 45,
        onTimeRate: 92,
        avgStarRating: 4.5,
      },
      {
        technicianId: "t2",
        technicianName: "Nora Al-Shehri",
        jobsCompleted: 5,
        revenueCollected: 1000,
        firstVisitResolutionRate: null,
        avgResolutionMinutes: null,
        onTimeRate: 50,
        avgStarRating: null,
      },
    ]);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Technician scorecards" }));

    expect(await screen.findByText("Ahmed Al-Rashid")).toBeInTheDocument();
    // The percentage <span> sits after the track <div>, which itself wraps the colored
    // fill <div> as its only child — so the fill color is previousElementSibling.firstElementChild.
    const highRateTrack = screen.getByText("92.0%").previousElementSibling!;
    expect(highRateTrack.firstElementChild).toHaveStyle({ backgroundColor: "#10B981" });

    const lowRateTrack = screen.getByText("50.0%").previousElementSibling!;
    expect(lowRateTrack.firstElementChild).toHaveStyle({ backgroundColor: "#EF4444" });

    expect(screen.getAllByText("—")).not.toHaveLength(0);

    cleanup();
    vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Technician scorecards" }));
    expect(await screen.findByText("No technician data for this period.")).toBeInTheDocument();
  });

  it("highlights a technician table row on hover", async () => {
    vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([
      {
        technicianId: "t1",
        technicianName: "Ahmed Al-Rashid",
        jobsCompleted: 12,
        revenueCollected: 4200,
        firstVisitResolutionRate: 90,
        avgResolutionMinutes: 45,
        onTimeRate: 92,
        avgStarRating: 4.5,
      },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Technician scorecards" }));
    const row = (await screen.findByText("Ahmed Al-Rashid")).closest("tr")!;
    expect(row).toHaveStyle({ backgroundColor: "transparent" });
    fireEvent.mouseEnter(row);
    expect(row).toHaveStyle({ backgroundColor: "#FAFAFA" });
    fireEvent.mouseLeave(row);
    expect(row).toHaveStyle({ backgroundColor: "transparent" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: FAIL — today's table has no empty-state row, no progress-bar coloring, and no hover state.

- [ ] **Step 3: Add `Star` to the lucide-react import and `hoveredTechnicianId` state**

Find:
```tsx
import { Calendar, ChevronDown, Download } from "lucide-react";
```

Replace with:
```tsx
import { Calendar, ChevronDown, Download, Star } from "lucide-react";
```

Find:
```tsx
export default function AnalyticsPage() {
  const isMobile = useMobileBreakpoint();
  const [tab, setTab] = useState<"business" | "technicians" | "brands" | "dealers">("business");
  const [days, setDays] = useState(30);
```

Replace with:
```tsx
export default function AnalyticsPage() {
  const isMobile = useMobileBreakpoint();
  const [tab, setTab] = useState<"business" | "technicians" | "brands" | "dealers">("business");
  const [days, setDays] = useState(30);
  const [hoveredTechnicianId, setHoveredTechnicianId] = useState<string | null>(null);
```

- [ ] **Step 4: Replace the technicians table**

Find:
```tsx
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {techniciansQuery.isLoading ? <LoadingRow /> : null}
            {techniciansQuery.isError ? <ErrorRow /> : null}
            {!techniciansQuery.isLoading && !techniciansQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["NAME", "JOBS COMPLETED", "REVENUE (RS)", "1ST VISIT RES.", "AVG RESOLUTION", "ON-TIME RATE", "RATING"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5", fontSize: "13px", color: "#525252", fontWeight: 500 }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(techniciansQuery.data ?? []).map((item) => (
                    <tr key={item.technicianId} style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.technicianName || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.jobsCompleted}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.firstVisitResolutionRate, 1, "%")}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.avgResolutionMinutes != null ? `${item.avgResolutionMinutes} min` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.onTimeRate, 1, "%")}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.avgStarRating, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}

      {/* ── Brands Tab ── */}
```

Replace with:
```tsx
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {techniciansQuery.isLoading ? <LoadingRow /> : null}
            {techniciansQuery.isError ? <ErrorRow /> : null}
            {!techniciansQuery.isLoading && !techniciansQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["NAME", "JOBS COMPLETED", "REVENUE (RS)", "1ST VISIT RES.", "AVG RESOLUTION", "ON-TIME RATE", "RATING"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5", fontSize: "13px", color: "#525252", fontWeight: 500 }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(techniciansQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "24px 12px", textAlign: "center", fontSize: "14px", color: "#737373" }}>
                        No technician data for this period.
                      </td>
                    </tr>
                  ) : (
                    (techniciansQuery.data ?? []).map((item) => {
                      const onTimeColor =
                        item.onTimeRate == null
                          ? "#E5E5E5"
                          : item.onTimeRate >= 85
                            ? "#10B981"
                            : item.onTimeRate >= 70
                              ? "#F59E0B"
                              : "#EF4444";
                      return (
                        <tr
                          key={item.technicianId}
                          onMouseEnter={() => setHoveredTechnicianId(item.technicianId)}
                          onMouseLeave={() => setHoveredTechnicianId(null)}
                          style={{
                            borderBottom: "1px solid #F5F5F5",
                            backgroundColor: hoveredTechnicianId === item.technicianId ? "#FAFAFA" : "transparent",
                          }}
                        >
                          <td style={{ padding: "10px 12px", fontWeight: 500, color: "#171717", fontSize: "14px" }}>
                            {item.technicianName || "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>
                            {item.jobsCompleted}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#065F46", fontVariantNumeric: "tabular-nums" }}>
                            {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>
                            {nullFmt(item.firstVisitResolutionRate, 1, "%")}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>
                            {item.avgResolutionMinutes != null ? `${item.avgResolutionMinutes} min` : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040" }}>
                            {item.onTimeRate == null ? (
                              "—"
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div
                                  style={{
                                    height: "4px",
                                    width: "80px",
                                    maxWidth: "80px",
                                    backgroundColor: "#F5F5F5",
                                    borderRadius: "9999px",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "4px",
                                      width: `${Math.min(item.onTimeRate, 100)}%`,
                                      backgroundColor: onTimeColor,
                                      borderRadius: "9999px",
                                    }}
                                  />
                                </div>
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.onTimeRate.toFixed(1)}%</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040" }}>
                            {item.avgStarRating == null ? (
                              "—"
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <Star size={13} fill="#F59E0B" color="#F59E0B" />
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.avgStarRating.toFixed(2)}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}

      {/* ── Brands Tab ── */}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.tsx frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "feat(analytics): polish technicians table — hover, progress bar, star icon, empty state"
```

---

## Task 7: Brands Table Polish

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Modify: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: `hoveredBrandId` state (independent of Task 6's `hoveredTechnicianId`)

- [ ] **Step 1: Write failing tests**

Add to `page.test.tsx`:

```tsx
  it("shows a 'no data' row in the brands table and colors revisit-rate amber above 20%", async () => {
    vi.mocked(operationsApi.fetchAnalyticsBrands).mockResolvedValue([
      { brandId: "b1", brandName: "Daikin", totalJobs: 20, activeJobs: 4, completedJobs: 16, revenueCollected: 8000, revisitRate: 25 },
      { brandId: "b2", brandName: "Samsung", totalJobs: 10, activeJobs: 2, completedJobs: 8, revenueCollected: 3000, revisitRate: 5 },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Brand" }));

    const highRevisit = await screen.findByText("25.0%");
    expect(highRevisit).toHaveStyle({ color: "#92400E" });
    const lowRevisit = screen.getByText("5.0%");
    expect(lowRevisit).toHaveStyle({ color: "#404040" });

    cleanup();
    vi.mocked(operationsApi.fetchAnalyticsBrands).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Brand" }));
    expect(await screen.findByText("No brand data for this period.")).toBeInTheDocument();
  });

  it("highlights a brand table row on hover", async () => {
    vi.mocked(operationsApi.fetchAnalyticsBrands).mockResolvedValue([
      { brandId: "b1", brandName: "Daikin", totalJobs: 20, activeJobs: 4, completedJobs: 16, revenueCollected: 8000, revisitRate: 5 },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Brand" }));
    const row = (await screen.findByText("Daikin")).closest("tr")!;
    fireEvent.mouseEnter(row);
    expect(row).toHaveStyle({ backgroundColor: "#FAFAFA" });
    fireEvent.mouseLeave(row);
    expect(row).toHaveStyle({ backgroundColor: "transparent" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: FAIL — today's table has no empty-state row, no threshold coloring, and no hover state.

- [ ] **Step 3: Add `hoveredBrandId` state**

Find:
```tsx
  const [hoveredTechnicianId, setHoveredTechnicianId] = useState<string | null>(null);
```

Replace with:
```tsx
  const [hoveredTechnicianId, setHoveredTechnicianId] = useState<string | null>(null);
  const [hoveredBrandId, setHoveredBrandId] = useState<string | null>(null);
```

- [ ] **Step 4: Replace the brands table**

Find:
```tsx
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {brandsQuery.isLoading ? <LoadingRow /> : null}
            {brandsQuery.isError ? <ErrorRow /> : null}
            {!brandsQuery.isLoading && !brandsQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["BRAND", "TOTAL JOBS", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (RS)", "REVISIT RATE"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(brandsQuery.data ?? []).map((item) => (
                    <tr key={item.brandId} style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.brandName || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.activeJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completedJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.revisitRate, 1, "%")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}

      {/* ── Dealers Tab ── */}
```

Replace with:
```tsx
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {brandsQuery.isLoading ? <LoadingRow /> : null}
            {brandsQuery.isError ? <ErrorRow /> : null}
            {!brandsQuery.isLoading && !brandsQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["BRAND", "TOTAL JOBS", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (RS)", "REVISIT RATE"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5", fontSize: "13px", color: "#525252", fontWeight: 500 }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(brandsQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "24px 12px", textAlign: "center", fontSize: "14px", color: "#737373" }}>
                        No brand data for this period.
                      </td>
                    </tr>
                  ) : (
                    (brandsQuery.data ?? []).map((item) => (
                      <tr
                        key={item.brandId}
                        onMouseEnter={() => setHoveredBrandId(item.brandId)}
                        onMouseLeave={() => setHoveredBrandId(null)}
                        style={{
                          borderBottom: "1px solid #F5F5F5",
                          backgroundColor: hoveredBrandId === item.brandId ? "#FAFAFA" : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 500, color: "#171717", fontSize: "14px" }}>
                          {item.brandName || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>{item.totalJobs}</td>
                        <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>{item.activeJobs}</td>
                        <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>{item.completedJobs}</td>
                        <td style={{ padding: "10px 12px", color: "#065F46", fontVariantNumeric: "tabular-nums" }}>
                          {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            color: item.revisitRate != null && item.revisitRate > 20 ? "#92400E" : "#404040",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {nullFmt(item.revisitRate, 1, "%")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}

      {/* ── Dealers Tab ── */}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.tsx frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "feat(analytics): polish brands table — hover, revisit-rate threshold color, empty state"
```

---

## Task 8: Dealers Table Polish

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`
- Modify: `frontend/src/app/(protected)/analytics/page.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: `hoveredDealerId` state (independent of Tasks 6/7's hover state)

- [ ] **Step 1: Write failing tests**

Add to `page.test.tsx`:

```tsx
  it("shows a 'no data' row in the dealers table and colors active-jobs amber above 3", async () => {
    vi.mocked(operationsApi.fetchAnalyticsDealers).mockResolvedValue([
      { dealerId: "d1", dealerName: "Gulf Climate Systems", totalJobs: 10, activeJobs: 5, completedJobs: 5, revenueGenerated: 6000 },
      { dealerId: "d2", dealerName: "Premium HVAC Trading", totalJobs: 6, activeJobs: 2, completedJobs: 4, revenueGenerated: 2500 },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Dealer" }));

    const highActive = await screen.findByText("5");
    expect(highActive).toHaveStyle({ color: "#92400E" });
    const lowActive = screen.getByText("2");
    expect(lowActive).toHaveStyle({ color: "#404040" });

    cleanup();
    vi.mocked(operationsApi.fetchAnalyticsDealers).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Dealer" }));
    expect(await screen.findByText("No dealer data for this period.")).toBeInTheDocument();
  });

  it("highlights a dealer table row on hover", async () => {
    vi.mocked(operationsApi.fetchAnalyticsDealers).mockResolvedValue([
      { dealerId: "d1", dealerName: "Gulf Climate Systems", totalJobs: 10, activeJobs: 1, completedJobs: 5, revenueGenerated: 6000 },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Dealer" }));
    const row = (await screen.findByText("Gulf Climate Systems")).closest("tr")!;
    fireEvent.mouseEnter(row);
    expect(row).toHaveStyle({ backgroundColor: "#FAFAFA" });
    fireEvent.mouseLeave(row);
    expect(row).toHaveStyle({ backgroundColor: "transparent" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: FAIL — today's table has no empty-state row, no threshold coloring, and no hover state.

- [ ] **Step 3: Add `hoveredDealerId` state**

Find:
```tsx
  const [hoveredBrandId, setHoveredBrandId] = useState<string | null>(null);
```

Replace with:
```tsx
  const [hoveredBrandId, setHoveredBrandId] = useState<string | null>(null);
  const [hoveredDealerId, setHoveredDealerId] = useState<string | null>(null);
```

- [ ] **Step 4: Replace the dealers table**

Find:
```tsx
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {dealersQuery.isLoading ? <LoadingRow /> : null}
            {dealersQuery.isError ? <ErrorRow /> : null}
            {!dealersQuery.isLoading && !dealersQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["DEALER", "JOBS SUBMITTED", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (RS)"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(dealersQuery.data ?? []).map((item) => (
                    <tr key={item.dealerId} style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.dealerName || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.activeJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completedJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.revenueGenerated.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}
      </div>
    </section>
  );
}
```

Replace with:
```tsx
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {dealersQuery.isLoading ? <LoadingRow /> : null}
            {dealersQuery.isError ? <ErrorRow /> : null}
            {!dealersQuery.isLoading && !dealersQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["DEALER", "JOBS SUBMITTED", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (RS)"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5", fontSize: "13px", color: "#525252", fontWeight: 500 }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(dealersQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "24px 12px", textAlign: "center", fontSize: "14px", color: "#737373" }}>
                        No dealer data for this period.
                      </td>
                    </tr>
                  ) : (
                    (dealersQuery.data ?? []).map((item) => (
                      <tr
                        key={item.dealerId}
                        onMouseEnter={() => setHoveredDealerId(item.dealerId)}
                        onMouseLeave={() => setHoveredDealerId(null)}
                        style={{
                          borderBottom: "1px solid #F5F5F5",
                          backgroundColor: hoveredDealerId === item.dealerId ? "#FAFAFA" : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 500, color: "#171717", fontSize: "14px" }}>
                          {item.dealerName || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>{item.totalJobs}</td>
                        <td
                          style={{
                            padding: "10px 12px",
                            color: item.activeJobs > 3 ? "#92400E" : "#404040",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {item.activeJobs}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>{item.completedJobs}</td>
                        <td style={{ padding: "10px 12px", color: "#065F46", fontVariantNumeric: "tabular-nums" }}>
                          {item.revenueGenerated.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/\(protected\)/analytics/page.test.tsx`
Expected: PASS (all tests — the full suite added across all 8 tasks)

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Run the full frontend test suite**

Run: `cd frontend && npm run test:run`
Expected: all tests pass, including every other pre-existing test file (this page was previously untested, so no other file should be affected)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/\(protected\)/analytics/page.tsx frontend/src/app/\(protected\)/analytics/page.test.tsx
git commit -m "feat(analytics): polish dealers table — hover, active-jobs threshold color, empty state"
```

---

## Post-Implementation Manual Verification

After all 8 tasks are committed, manually verify in the browser (per the design spec's "Overall Polish" goal — automated tests don't cover pixel-level layout or the mobile bottom-of-viewport interactions):

1. Start both servers, log in as `owner@cooldesk.dev`, navigate to `/analytics`.
2. Confirm the date-range dropdown and Export button sit side-by-side, top-right, beside the title.
3. Switch all 4 tabs — confirm only one date-range control and one Export button exist on the page at any time.
4. Resize the browser below 768px — confirm the title shrinks to 28px, padding shrinks to 16px, the KPI grid becomes 2 columns, and the header wraps.
5. Open the date-range dropdown, select each of the 3 options, confirm the KPI values and charts update (network tab shows a new `days` query param).
6. Hover over technician/brand/dealer table rows — confirm the `#FAFAFA` highlight.
7. Spot-check recharts rendering under the installed `recharts@^3.9.0` (vs. the reference's `2.15.2`) — confirm the bar chart, line chart with legend and visible dots, and tooltip all render without console errors (per the spec's Section 10 risk note).
8. Spot-check `Calendar`/`ChevronDown`/`Download`/`Star` icons actually render (vs. a missing-icon blank) under the installed `lucide-react@^1.16.0`.

---

## Self-Review Notes

**Spec coverage:** Header (§1) → Task 2. Date-range selector (§2) → Task 2. Export button (§3) → Task 2. KPI cards (§4) → Task 3. Charts (§5) → Task 4. Empty states (§6) → Task 5 (business) + Tasks 6/7/8 (tables). Tables (§7) → Tasks 6/7/8. Typography scale (§8) → applied inline across Tasks 2–8 (no standalone task needed — it's not a separable code change). Responsive behavior (§9) → Task 2 (header/title/padding/dropdown) + Task 3 (grid) + Task 4 (chart gap). Implementation risk notes (§10) → covered in Post-Implementation Manual Verification steps 7–8.

**Placeholder scan:** no TBD/TODO; every step has complete, runnable code.

**Type consistency:** `KpiCard`'s `trend` prop shape (`{ label: string; isPositive: boolean }`) is introduced once in Task 3 and never referenced again elsewhere (no call site uses it, per the spec's explicit decision) — no drift risk. `DateRangeDropdown`'s props (`value`, `onChange`, `isMobile`) are defined in Task 2 and its only call site (added in the same task's Step 7) matches exactly. `hoveredTechnicianId`/`hoveredBrandId`/`hoveredDealerId` are each scoped to their own task and table — verified no naming collisions.

**Note found during this self-review:** the design spec's §1 "Fix the subtitle bug" turned out, on closer reading of the actual code, not to be a real bug — `monthLabel` is computed fresh via `new Date()` on every render (not a stale/hardcoded value), so `"Last {days} days · {monthLabel}"` already produces exactly the example text ("Last 30 days · July 2026") for any of the 7/30/90 options. No task above changes this logic; the subtitle `<p>` is only repositioned as part of Task 2's header restructure, not rewritten. This is intentional — do not add unnecessary logic to "fix" something that already works.
