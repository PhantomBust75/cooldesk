# Analytics Page Design Match

**Date:** 2026-07-13
**Approach:** Surgical in-place visual edits only — no functionality or backend changes
**Fidelity:** Copy-paste exact inline style values from `Owner's View UI Design/src/app/pages/Analytics.tsx` wherever an equivalent element exists. Only invent new markup where the reference has no equivalent (empty states, the 6-card KPI grid, the trend-row support system).
**File:** `frontend/src/app/(protected)/analytics/page.tsx` (single file — no new files, matches the existing structure of this page)
**Reference:** `Owner's View UI Design/src/app/pages/Analytics.tsx` (417 lines)

---

## Scope

Visual-only redesign of the live Analytics page (Business / Technician scorecards / Brand / Dealer tabs) to match the reference mockup's layout, spacing, typography, card styling, chart styling, table polish, and empty states. All existing `useQuery` hooks, API endpoints, computed metrics, CSV export logic, and tab/day-window state stay exactly as they are — only presentation changes.

---

## Non-Goals

- No backend changes. Confirmed via `backend/src/modules/analytics/analytics.service.ts`: no endpoint returns previous-period comparison data (no `trend`/`delta`/`previous_value` field anywhere).
- No full custom date-range preset system (reference has Last week/month/6 months/all time/custom-range-with-date-inputs — out of scope; live page keeps its exact 7/30/90-day model).
- No new charts on Technicians/Brands/Dealers tabs (reference's Brand-tab chart uses "installations/complaints" fields the live backend doesn't return for that endpoint).
- No fabricated comparison numbers — the reference's green/red "+12% vs prev period" row is driven by hard-coded mock data in the reference file; the live page's `KpiCard` gains support for an optional trend row, but no card passes one today.
- No change to `days`/`tab` state, query keys, or any `@tanstack/react-query` wiring.

---

## 1. Header

**Live today:** `page.tsx:262-291` — title + subtitle inside a `<div>`, `ExportButton` next to the title; `WindowSelect` lives separately, floating above each tab's content (`:322-330` etc.), fully disconnected from Export.

**Reference:** `Owner's View UI Design/src/app/pages/Analytics.tsx:204-218`.

Changes:
- Wrap `TimeframeSelector`-equivalent (the reskinned `WindowSelect`, see §2) and `ExportButton` together in one right-aligned flex container next to the title:
  ```jsx
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
    <div>
      <h1 style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Analytics</h1>
      <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>{subtitle}</p>
    </div>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* date selector, export button */}
    </div>
  </div>
  ```
  (values copied verbatim from reference `:205-213`, with `isMobile` sourced from the existing `useMobileBreakpoint()` hook at `frontend/src/hooks/use-mobile-breakpoint.ts` rather than porting the reference's own `useViewport()` hook.)
- Page/section outer padding becomes `isMobile ? '16px' : '24px'` (reference `:205`), replacing today's fixed `"24px"` (`page.tsx:262`).
- **Fix subtitle bug**: today's subtitle (`page.tsx:246-247`) always shows the *current* calendar month regardless of the selected day-window. Replace with logic that reflects the actual selected `days` and today's date, producing e.g. `"Last 30 days · July 2026"` — matching the reference's intent (`timeframeSubtitle`, reference `:197-202`) without porting its full preset-string branching (no 6-months/all-time/custom cases needed, since `days` only ever holds 7/30/90).

---

## 2. Date-Range Selector (reskin only — same 7/30/90 options, same state)

**Live today:** `WindowSelect` (`page.tsx:134-160`) — native `<select>`, positioned separately per-tab.

**Reference trigger button:** `Owner's View UI Design/src/app/pages/Analytics.tsx:123-136`.
**Reference dropdown panel:** `:139-147` (desktop), preset rows `:80-119`.

Changes:
- Replace the native `<select>` with a custom button + dropdown panel, copying reference styles verbatim:
  - Trigger: `Calendar` icon (`lucide-react`, `size={13}`, color `#737373`) + label text + `ChevronDown` (rotates 180° when open) — `padding:'7px 12px', borderRadius:'8px', minHeight:'36px', border:'1px solid #E5E5E5', backgroundColor: open ? '#F5F5F5' : '#fff', fontSize:'13px', color:'#404040'` (reference `:123-136`).
  - Panel (desktop): `position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:200, backgroundColor:'#fff', border:'1px solid #E5E5E5', borderRadius:'12px', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', minWidth:'220px'` (reference `:139-147`).
  - Panel rows: same visual treatment as reference preset rows (`:80-119`) — `6px` black dot indicator on the active row, `#F5F5F5` background on hover/active — but only 3 rows: "Last 7 days", "Last 30 days", "Last 90 days" (mapped to `days = 7/30/90`, the live page's existing values). No "Last 6 months / All time / Custom" rows, no From/To date inputs.
- On mobile: simple full-width dropdown below the trigger (not the reference's full bottom-sheet-with-drag-handle — that's disproportionate complexity for 3 static rows).
- No change to the `days` state, its query-key usage, or any endpoint call.

---

## 3. Export Button

**Reference:** `Owner's View UI Design/src/app/pages/Analytics.tsx:210-212`.

Copy verbatim: `Download` icon (`lucide-react`, `size={13}`, `strokeWidth={1.5}`) + `"Export"` text, `display:'flex', alignItems:'center', gap:'5px', padding:'7px 12px', minHeight:'36px', borderRadius:'8px', border:'1px solid #E5E5E5', backgroundColor:'#fff', cursor:'pointer', fontSize:'13px', color:'#404040'`. Same `handleExport`/`exportToCsv` behavior as today (`page.tsx:26-40`, `:249-259`) — unchanged.

---

## 4. KPI Cards

**Live today:** `KpiCard` (`page.tsx:78-102`), 6 cards: Total Revenue, Total Jobs, Active Jobs, Completed Jobs, 1st Visit Resolution, Revisit Rate (`:345-379`).

**Reference:** `Owner's View UI Design/src/app/pages/Analytics.tsx:234-249` (4 cards, different metric set — metric set is NOT changed here; only the card's visual treatment and the trend-row *capability* are ported).

Changes to `KpiCard`, copying reference values verbatim:
```jsx
<div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5' }}>
  <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', marginBottom: '6px' }}>{label}</div>
  <div style={{ fontSize: '24px', fontWeight: 600, color: '#0A0A0A', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  {trend ? (
    <div style={{ fontSize: '12px', color: trend.isPositive ? '#10B981' : '#EF4444', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
      {trend.label} <span style={{ color: '#737373' }}>vs prev period</span>
    </div>
  ) : null}
</div>
```
(reference `:234-249`, container padding/border/radius unchanged from today since it already matched)

- `KpiCard` gains an optional `trend?: { label: string; isPositive: boolean }` prop. `isPositive` is a semantic "is this good" flag (not sign-of-number — e.g. a decrease in average resolution time is positive), matching the reference's `up: boolean` convention (reference `:236-239`).
- **No card passes a `trend` prop today** — confirmed no backend field exists to back it. The row is simply absent until a future backend change adds real comparison data; nothing is fabricated.
- All 6 existing metrics, values, and null-safe `"—"` formatting (`page.tsx:366-370`, `:373-378`) stay exactly as computed today — only the container/label/value styling changes.
- Grid: `gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px'` (reference `:234`), replacing today's fixed `repeat(4, 1fr)` with no breakpoint (`page.tsx:337-344`). With 6 cards this still produces an uneven last row of 2 on desktop — intentional, matching the reference's exact column count rather than forcing symmetry.

---

## 5. Charts (Business tab only)

**Live today:** `page.tsx:388-446`, wrapped in `ChartCard` (`:52-76`).

**Reference:** `Owner's View UI Design/src/app/pages/Analytics.tsx:251-262` (bar), `:264-277` (line).

Changes:
- Remove the `ChartCard` bordered-box wrapper for these two charts; render directly on the tab's white background with a plain title above: `<h3 style={{ fontSize: '14px', fontWeight: 500, color: '#171717', marginBottom: '16px' }}>` (reference `:252`, `:265`), matching reference's un-boxed presentation. Confirmed via grep that `ChartCard` (`page.tsx:52-76`) has no callers anywhere else in the codebase — both of its only two usages (`:388`, `:411`) are the charts being unwrapped here, so the function becomes dead code and should be deleted entirely, not left unused.
- **Daily Revenue bar chart**: `CartesianGrid stroke="#F5F5F5"` (was `#E5E5E5`), axis tick `{ fontSize: 12, fill: '#737373' }` (was 11), height `240` (was 200), `Tooltip contentStyle={{ ..., boxShadow: 'none' }}` explicit. Same `<Bar dataKey="revenue" fill="#0A0A0A" radius={[4,4,0,0]}>` (reference `:251-262`).
- **Daily Jobs line chart**: keep the existing field names `total`/`completed` (not reference's "installations"/"complaints" — those are reference-specific mock concepts; ours must stay accurate to what `/analytics/business/daily` actually returns). Add `<Legend>` (currently missing despite two series being drawn), add visible dots (`dot={{ r: 3 }}`, was `dot={false}`), `strokeWidth: 1.5` (was 2). Keep `total` → `#525252`, `completed` → `#F59E0B` (already matches reference's color choices) — add explicit `name` props on each `<Line>` so the legend labels read "Total" / "Completed" (reference `:264-277`).
- No change to data fetching (`dailyQuery`) or the underlying `AnalyticsDailyItem` shape.

---

## 6. Empty States

Not present in the reference file (it renders static non-empty mock arrays — confirmed via grep, no "empty"/"no data"/"placeholder" strings anywhere in `Analytics.tsx`). This section is necessarily new, styled consistently with the reference's established muted-gray palette rather than copied from an equivalent element.

Trigger rule (per your confirmation): show the consolidated empty state when `overview.total_jobs === 0` for the Business tab.

- **Business tab**, when `overview.total_jobs === 0`: replace the KPI grid + chart section with:
  - Centered message: `"No analytics available for the selected period."` (`fontSize: '14px', color: '#737373'`).
  - Two empty chart placeholder boxes at the same dimensions as the real charts (`height: 240` / `200`), styled `border: '1px dashed #E5E5E5', borderRadius: '12px'`, centered muted text `"No data to display"` — so the page doesn't visually collapse when data is absent.
- **Technicians/Brands/Dealers tables**: when the query's array is empty, render one `<tr>` with a `colSpan`-ed centered cell reading `"No {tab-name} data for this period."` (same muted styling) instead of a silently empty `<tbody>`.
- Individual null rates that occur even when `total_jobs > 0` (e.g. 1st-visit resolution before any job has completed) keep today's inline `"—"` treatment (`nullFmt`, `page.tsx:46-48`), recolored to reference's `#A3A3A3` (was inheriting a darker default) — no full-page empty state for these.
- `LoadingRow`/`ErrorRow` (`page.tsx:185-197`) get only typography alignment (`13px`, existing colors) — no bigger skeleton-loader treatment; out of scope.

---

## 7. Tables (Technicians / Brand / Dealer tabs)

**Reference:** `Owner's View UI Design/src/app/pages/Analytics.tsx:296-298` (hover), `:302-318` (technician cells), `:355-368` (brand cells), `:392-404` (dealer cells).

Copying reference values verbatim:
- Row hover: `onMouseEnter`/`onMouseLeave` toggling row `backgroundColor` to `#FAFAFA` (reference `:296-298` pattern, applied to all three tables).
- Body row border: `borderBottom: '1px solid #F5F5F5'` (was `#E5E5E5` — header row keeps `#E5E5E5`).
- First-column cell: `fontWeight: 500, color: '#171717', fontSize: '14px'`. Other data cells: `fontSize: '13px', color: '#404040'`. Numeric cells: `fontVariantNumeric: 'tabular-nums'`.
- **Technicians**: on-time-rate rendered as a horizontal progress bar (`height: '4px', backgroundColor: '#F5F5F5', borderRadius: '9999px', maxWidth: '80px'` track, filled portion colored `#10B981` / `#F59E0B` / `#EF4444` — reference `:302-309`) plus the numeric label. **Threshold scale adapted**: the reference's thresholds (`≥0.85`/`≥0.7`) assume a 0–1 fraction, but the live `onTimeRate` field is a 0–100 percentage (`ROUND(on_time_count/total*100, 1)`, `backend/src/modules/analytics/analytics.service.ts:518-526`, passed through unscaled in `frontend/src/lib/api/operations.ts:326`) — use `≥85` / `≥70` / else on the percentage scale instead, same cutoffs just in the field's actual unit. `onTimeRate` is nullable (`frontend/src/types/operations.ts:100`, already `nullFmt`'d at `page.tsx:502`) — when null, show the existing `"—"` with no progress bar rather than a bar at 0%. Star rating: filled `Star` icon (`lucide-react`, `fill`/`color: '#F59E0B'`) next to the numeric value (reference `:311-315`) — `avgStarRating` is already a 1–5 scale matching the reference's expectation, no adaptation needed. `avgStarRating` is nullable (`frontend/src/types/operations.ts:101`, already rendered via `nullFmt(item.avgStarRating, 2)` at `page.tsx:505`) — show the icon only when non-null; when null, keep the existing `"—"` with no icon.
- Revenue-type cells (any table): color `#065F46` (dark green), unconditionally. **No "missing" branch**: the reference's null/`"—"` treatment (`:316-318`, `:401-404`) doesn't apply here — `revenueCollected` (technicians/brands) and `revenueGenerated` (dealers) are all typed as plain `number`, never `null` (`frontend/src/types/operations.ts:97`, `:110`, `:120` — backend always `COALESCE`s to 0), so there's no real "missing" case to render for these three fields.
- **Brands**: revisit-rate cell turns amber `#92400E` when high. Note this is an adapted threshold, not a literal copy: the reference's "revisits `> 2`" (`:368`) is a raw revisit *count*, but the live `revisitRate` field (`frontend/src/types/operations.ts:111`) is a *percentage* (`ROUND(revisited_complaints / resolved_complaints * 100, 1)`, `backend/src/modules/analytics/analytics.service.ts:590-608`) — applying `> 2` to a percentage would flag almost every brand. Use `revisitRate > 20` (20%) as the amber threshold instead — a reasonable adaptation of the same "flag unusually high revisits" intent to the field's actual unit. **No color-swatch dot** — the reference's dot (`:361`) reads a `colour_hex` field that exists on the brand CRUD endpoint (`OfficeBrand.colorHex`, `frontend/src/types/operations.ts:4`) but is confirmed NOT selected by `getBrandAnalytics` (`backend/src/modules/analytics/analytics.service.ts:570-628` returns `brand_id, brand_name, total_jobs, active_jobs, completed_jobs, revenue_collected, revisit_rate` only — no color field). Adding it would require a backend query change, which is out of scope — this one visual element is intentionally dropped rather than silently touching the backend.
- **Dealers**: the reference's threshold-colored "pending" cell has no direct equivalent — `AnalyticsDealerItem` (`frontend/src/types/operations.ts:114-121`) has no `pending` field, only `totalJobs`/`activeJobs`/`completedJobs`/`revenueGenerated`. Apply the same amber-`#92400E`-when-`> 3` treatment to the existing **Active Jobs** cell instead (`page.tsx:613`, already rendered today as plain text) — same threshold-warning concept (jobs not yet completed), using the field the dealer table already displays rather than inventing a nonexistent one.
- None of this changes what data is fetched — purely presentational on fields the existing endpoints already return (`getTechnicianAnalytics`, `getBrandAnalytics`, `getDealerAnalytics` — `backend/src/modules/analytics/analytics.service.ts:471-675`).

---

## 8. Typography Scale (applied consistently page-wide)

| Element | Size | Weight | Color |
|---|---|---|---|
| Page title | 36px desktop / 28px mobile | 600 | `#0A0A0A`, letter-spacing `-0.02em` |
| Subtitle | 13px | 400 | `#737373` |
| Tab label (active/inactive) | 13px | 500 / 400 | `#171717` / `#737373` |
| KPI card label | 12px | 500 | `#737373` |
| KPI card value | 24px | 600 | `#0A0A0A`, tabular-nums |
| KPI trend delta (when present) | 12px | inherit | `#10B981`/`#EF4444` + `#737373` for "vs prev period" |
| Chart section title | 14px | 500 | `#171717` |
| Chart axis tick | 12px | – | `#737373` |
| Table header cell | 13px | 500 | `#525252` |
| Table first-col cell | 14px | 500 | `#171717` |
| Table data cell | 13px | 400 | `#404040` |
| Buttons (Export / date selector) | 13px | 400 | `#404040` |
| Empty-state message | 14px | 400 | `#737373` |

---

## 9. Responsive Behavior

All breakpoint logic uses the existing `useMobileBreakpoint()` hook (`frontend/src/hooks/use-mobile-breakpoint.ts`, `max-width: 768px`) — not a ported copy of the reference's own `useViewport()` hook, for consistency with the rest of the live app.

- Title: 36px → 28px.
- Page/tab padding: 24px → 16px.
- KPI grid: `repeat(4,1fr)` → `repeat(2,1fr)`.
- Header row: `flexWrap: 'wrap'` so controls drop below the title on narrow widths.
- Date-range dropdown: desktop absolute panel → simple full-width dropdown below the trigger on mobile (not the reference's bottom-sheet-with-drag, per §2).

---

## 10. Implementation Risk Notes (not design decisions — verify in dev)

- **recharts version gap**: live `frontend/package.json` has `recharts@^3.9.0`; reference mockup's `package.json` has `recharts@2.15.2`. Verify `CartesianGrid`, `Legend`, `Tooltip contentStyle`, and dot props behave identically under v3 after porting the reference's exact chart JSX — spot-check visually in dev, don't assume 1:1 prop compatibility.
- **lucide-react version gap**: live has `lucide-react@^1.16.0`; reference has `lucide-react@0.487.0`. Confirm `Download`, `Calendar`, `ChevronDown`, `Star` icon exports still exist under the live version before importing.

---

## Files Touched

| File | Change |
|---|---|
| `frontend/src/app/(protected)/analytics/page.tsx` | All changes above — header, date selector, export button, KPI cards, charts, empty states, tables, typography |

No other files change. No backend files change.
