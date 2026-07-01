# Owner Portal Pages Design Match — Sub-project A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match Job Detail, Log New Job, Pending Schedule, and Notifications pages pixel-perfectly to the Figma Make design export — visual/structural changes only, no functionality touched.

**Architecture:** Surgical inline-style edits across 4 existing files. No new files, no new components, no new API calls. All styles remain inline (`style={{...}}`). Every task is independently reviewable.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, inline styles only (no Tailwind/CSS modules).

## Global Constraints

- All styles MUST be inline (`style={{...}}`). No Tailwind, no CSS modules, no new files.
- Do NOT change any API calls, query hooks, state logic, mutations, navigation, or form validation.
- Do NOT add new modals, new buttons tied to new actions, or new route changes.
- Do NOT change component props, exported types, or function signatures.
- TypeScript must stay clean: `cd frontend && npx tsc --noEmit` must pass after every task.
- Full test suite must stay green: `cd frontend && npm run test:run` (74 tests, 12 files) after every task.
- Exact hex values as specified — do not substitute or approximate colors.
- Read `frontend/AGENTS.md` before writing any code — it flags Next.js version caveats.

---

## File Map

| File | Task | Change type |
|---|---|---|
| `frontend/src/components/jobs/job-detail.tsx` | 1 | Typography + label colors + tag chips |
| `frontend/src/app/(protected)/log-new-job/page.tsx` | 2 | Step line height + radio border + form/input styles |
| `frontend/src/app/(protected)/pending-schedule/page.tsx` | 3 | H1 + table headers + SLA progress bars + row hover |
| `frontend/src/app/(protected)/notifications/page.tsx` | 4 | Dot color + filter chips + item backgrounds |

---

## Task 1: Job Detail — Typography, Labels, Breadcrumb, Tag Chips

**Files:**
- Modify: `frontend/src/components/jobs/job-detail.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Change H1 job ID heading (line 279)**

Find this line:
```tsx
<h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#0A0A0A", letterSpacing: "-0.02em" }}>
```

Replace with:
```tsx
<h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600, color: "#0A0A0A", letterSpacing: "-0.01em", fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
```

- [ ] **Step 2: Change tab label font size and active weight (lines 332–333)**

Find:
```tsx
                  fontSize: "14px",
                  fontWeight: activeTab === tab ? 600 : 400,
```

Replace with:
```tsx
                  fontSize: "13px",
                  fontWeight: activeTab === tab ? 500 : 400,
```

- [ ] **Step 3: Change all uppercase section labels — color, weight, letter-spacing**

There are 3 section label `<p>` elements with `fontWeight: 600, color: "#737373", letterSpacing: "0.06em"`.

Find (Customer section, line 350):
```tsx
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.06em", textTransform: "uppercase" }}>Customer</p>
```
Replace with:
```tsx
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.07em", textTransform: "uppercase" }}>Customer</p>
```

Find (Schedule section, line 368):
```tsx
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.06em", textTransform: "uppercase" }}>Schedule</p>
```
Replace with:
```tsx
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.07em", textTransform: "uppercase" }}>Schedule</p>
```

Find (Payment sidebar card label, line 654):
```tsx
            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.06em", textTransform: "uppercase" }}>Payment</p>
```
Replace with:
```tsx
            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.07em", textTransform: "uppercase" }}>Payment</p>
```

- [ ] **Step 4: Update breadcrumb color (lines 260–273)**

Find the breadcrumb `Link`:
```tsx
        <Link
          href="/jobs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            color: "#737373",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={12} strokeWidth={1.5} /> All jobs
        </Link>
        <span style={{ fontSize: "12px", color: "#737373" }}> / {detail.id.slice(0, 8)}</span>
```

Replace with:
```tsx
        <Link
          href="/jobs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "13px",
            color: "#A3A3A3",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={12} strokeWidth={1.5} /> All jobs
        </Link>
        <span style={{ fontSize: "13px", color: "#A3A3A3" }}> / {detail.id.slice(0, 8)}</span>
```

- [ ] **Step 5: Replace inline tag text with pill chip spans (lines 306–311)**

Find:
```tsx
          {detail.tags.map((tag) => (
            <span key={tag} style={{ color: tag === "chronic" ? "#9F1239" : tag === "frequent" ? "#737373" : "#525252", fontWeight: 500 }}>
              · {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </span>
          ))}
```

Replace with:
```tsx
          {detail.tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "9999px",
                padding: "2px 8px",
                fontSize: "11px",
                fontWeight: 500,
                backgroundColor: tag === "chronic" ? "#FFF1F2" : tag === "frequent" ? "#FFFBEB" : "#F1F5F9",
                color: tag === "chronic" ? "#9F1239" : tag === "frequent" ? "#92400E" : "#1E293B",
              }}
            >
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </span>
          ))}
```

- [ ] **Step 6: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run tests**

```bash
cd frontend && npm run test:run
```

Expected: all 74 tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/jobs/job-detail.tsx
git commit -m "feat(ui): update job-detail typography, labels, breadcrumb, and tag chips to match design"
```

---

## Task 2: Log New Job — Step Line, Radio Borders, Form Card, Labels, Inputs

**Files:**
- Modify: `frontend/src/app/(protected)/log-new-job/page.tsx`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Add border to pending step circle and fix connector line height**

In `StepHeader`, find the step circle div (lines 43–56):
```tsx
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 500,
              flexShrink: 0,
              backgroundColor: value < current ? "#065F46" : value === current ? "#0A0A0A" : "#F5F5F5",
              color: value <= current ? "#fff" : "#A3A3A3",
            }}
          >
```

Replace with (adds conditional border for pending circles only):
```tsx
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 500,
              flexShrink: 0,
              backgroundColor: value < current ? "#065F46" : value === current ? "#0A0A0A" : "#F5F5F5",
              color: value <= current ? "#fff" : "#A3A3A3",
              border: value > current ? "1px solid #E5E5E5" : "none",
            }}
          >
```

Then find the connector line (line 60):
```tsx
            <div style={{ flex: 1, height: "1px", backgroundColor: value < current ? "#10B981" : "#E5E5E5", minWidth: "40px" }} />
```

Replace with:
```tsx
            <div style={{ flex: 1, height: "2px", backgroundColor: value < current ? "#10B981" : "#E5E5E5", minWidth: "40px" }} />
```

- [ ] **Step 2: Fix radio button card borders and border-radius (job type radios, line 326)**

Find the job type radio label:
```tsx
                    <label key={type} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", border: `1px solid ${form.type === type ? "#0A0A0A" : "#E5E5E5"}`, borderRadius: "8px", cursor: "pointer", backgroundColor: form.type === type ? "#FAFAFA" : "#fff" }}>
```

Replace with:
```tsx
                    <label key={type} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 16px", border: form.type === type ? "1.5px solid #0A0A0A" : "1px solid #E5E5E5", borderRadius: "10px", cursor: "pointer", backgroundColor: form.type === type ? "#FAFAFA" : "#fff" }}>
```

- [ ] **Step 3: Fix radio button card borders and border-radius (source radios, line 342)**

Find the source radio label:
```tsx
                        <label key={source} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", border: `1px solid ${form.source === source ? "#0A0A0A" : "#E5E5E5"}`, borderRadius: "8px", cursor: "pointer", backgroundColor: form.source === source ? "#FAFAFA" : "#fff" }}>
```

Replace with:
```tsx
                        <label key={source} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 16px", border: form.source === source ? "1.5px solid #0A0A0A" : "1px solid #E5E5E5", borderRadius: "10px", cursor: "pointer", backgroundColor: form.source === source ? "#FAFAFA" : "#fff" }}>
```

- [ ] **Step 4: Fix form card desktop padding (line 312)**

Find:
```tsx
        <form onSubmit={onSubmit} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: isMobile ? "20px" : "28px" }}>
```

Replace with:
```tsx
        <form onSubmit={onSubmit} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: isMobile ? "20px" : "24px" }}>
```

- [ ] **Step 5: Change all form field label colors from #404040 to #525252**

There are multiple label elements with `color: "#404040"`. Use replace-all on the specific pattern in label style props.

Find (exact string, appears multiple times in the file):
```tsx
, color: "#404040", display: "block", marginBottom: "5px"
```

Replace all occurrences with:
```tsx
, color: "#525252", display: "block", marginBottom: "5px"
```

Verify the count: there should be ~8 replacements. After replacing, search for remaining `"#404040"` in label contexts to confirm no instances are missed. Non-label `#404040` usages (e.g. review rows, buttons) should be left unchanged — only change inside label style props that have `display: "block", marginBottom: "5px"`.

- [ ] **Step 6: Update input/select padding from 8px 10px to 10px 12px**

Find all occurrences of this padding pattern in input/select elements:
```tsx
padding: "8px 10px",
```

In the context of form inputs and selects (NOT in other components), replace with:
```tsx
padding: "10px 12px",
```

The inputs affected are:
- Phone input (line ~384): `padding: "8px 10px"`
- Customer name input (line ~401): `padding: "8px 10px"`
- Address input (line ~406): `padding: "8px 10px"`
- Brand select (line ~418): `padding: "8px 10px"`
- Datetime input (line ~431): `padding: "8px 10px"`
- Technician select (line ~443): `padding: "8px 10px"`
- Notes textarea (line ~469): `padding: "8px 10px"`
- Dealer select (line ~355): `padding: "8px 10px 8px 32px"` — leave as-is (has icon offset)

Do NOT change the unit row inputs (lines ~477–479) — those use `padding: "7px 8px"` which is correct for the compact grid layout.

- [ ] **Step 7: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Run tests**

```bash
cd frontend && npm run test:run
```

Expected: all 74 tests pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/\(protected\)/log-new-job/page.tsx
git commit -m "feat(ui): update log-new-job step indicator, radio cards, form card, and input styles"
```

---

## Task 3: Pending Schedule — Heading, Table Headers, SLA Progress Bars, Row Hover

**Files:**
- Modify: `frontend/src/app/(protected)/pending-schedule/page.tsx`

**Interfaces:**
- Consumes: nothing from previous tasks
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Update H1 heading (line 603–612)**

Find:
```tsx
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "#0A0A0A",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
```

Replace with:
```tsx
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
```

- [ ] **Step 2: Update `thStyle` object (lines 578–588)**

Find:
```tsx
  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left" as const,
    fontSize: "11px",
    fontWeight: 600,
    color: "#525252",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap" as const,
    borderBottom: "1px solid #E5E5E5",
    backgroundColor: "#FAFAFA",
  };
```

Replace with:
```tsx
  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left" as const,
    fontSize: "11px",
    fontWeight: 500,
    color: "#A3A3A3",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap" as const,
    borderBottom: "1px solid #E5E5E5",
    backgroundColor: "#FAFAFA",
  };
```

- [ ] **Step 3: Add row hover to main table rows**

Find the main `<tr>` for each queue row (around line 701):
```tsx
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #F9F9F9",
                        backgroundColor: isExpanded ? "#F9F9F9" : "#FAFAFA",
                      }}
                    >
```

Replace with:
```tsx
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #F9F9F9",
                        backgroundColor: isExpanded ? "#F9F9F9" : "#FAFAFA",
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#F5F5F5"; }}
                      onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#FAFAFA"; }}
                    >
```

- [ ] **Step 4: Add a helper function for SLA tier**

Add this helper function directly below the existing `daysColor` function (after line 47, before line 49 `// ─── inline row state`):

```tsx
function slaTier(days: number): "ok" | "amber" | "red" {
  if (days >= 7) return "red";
  if (days >= 3) return "amber";
  return "ok";
}

const SLA_COLORS = {
  ok:    { text: "#525252", track: "#F5F5F5",  fill: "#D1D5DB" },
  amber: { text: "#92400E", track: "#FEF3C7",  fill: "#F59E0B" },
  red:   { text: "#991B1B", track: "#FEE2E2",  fill: "#EF4444" },
};
```

- [ ] **Step 5: Replace DAYS WAITING cell content with SLA progress bar (lines 814–829)**

Find the DAYS WAITING `<td>` cell:
```tsx
                      {/* DAYS WAITING */}
                      <td style={{ padding: "14px 12px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            color,
                            fontWeight: overdue ? 600 : 400,
                            textDecoration: overdue ? "underline" : "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {overdue ? "⊙" : ""} {days}d
                        </span>
                      </td>
```

Replace with:
```tsx
                      {/* DAYS WAITING */}
                      <td style={{ padding: "14px 12px" }}>
                        {(() => {
                          const tier = slaTier(days);
                          const c = SLA_COLORS[tier];
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "80px" }}>
                              <span style={{ fontSize: "13px", fontWeight: tier === "ok" ? 400 : 600, color: c.text }}>
                                {days}d
                              </span>
                              <div style={{ height: "4px", borderRadius: "9999px", backgroundColor: c.track, overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: "9999px", backgroundColor: c.fill, width: `${Math.min(100, (days / 10) * 100)}%` }} />
                              </div>
                            </div>
                          );
                        })()}
                      </td>
```

Note: The `overdue` and `color` variables declared earlier in the row map body are no longer used after this change. Remove those two declarations to keep the code clean and avoid TypeScript "declared but never used" errors:

Find (around line 695–697):
```tsx
                  const days = daysWaiting(job.createdAt);
                  const overdue = days >= 7;
                  const color = daysColor(days);
```

Replace with:
```tsx
                  const days = daysWaiting(job.createdAt);
```

The `daysColor` function is still used inside `BatchModal` (line ~206), so do NOT remove the function itself.

- [ ] **Step 6: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If TypeScript complains about `overdue` or `color` being unused, that's the variables you removed in Step 5 — confirm they are gone.

- [ ] **Step 7: Run tests**

```bash
cd frontend && npm run test:run
```

Expected: all 74 tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/\(protected\)/pending-schedule/page.tsx
git commit -m "feat(ui): update pending-schedule heading, table headers, SLA progress bars, and row hover"
```

---

## Task 4: Notifications — Dot Color, Filter Chips, Item Backgrounds, Header Badge

**Files:**
- Modify: `frontend/src/app/(protected)/notifications/page.tsx`

**Interfaces:**
- Consumes: nothing from previous tasks
- Produces: nothing

- [ ] **Step 1: Change unread indicator dot color (line 194)**

Find:
```tsx
                backgroundColor: item.isRead ? "transparent" : "#F59E0B",
```

Replace with:
```tsx
                backgroundColor: item.isRead ? "transparent" : "#2563EB",
```

- [ ] **Step 2: Update notification item background to be conditional on isRead (line 185)**

Find (inside the `filteredItems.map` div):
```tsx
            backgroundColor: "#FAFAFA",
```
(This is the item container div background, inside the notification list.)

Replace with:
```tsx
            backgroundColor: item.isRead ? "#fff" : "#FAFAFA",
```

Be precise: this is at line ~185 inside the `filteredItems.map` callback, inside the outer `<div key={item.id}` container. Do NOT change the outer list container background (`#FAFAFA` on line ~171).

- [ ] **Step 3: Update filter chip styles (lines 125–141)**

Find the filter button style:
```tsx
              style={{
                borderRadius: "9999px",
                border: `1px solid ${tab === item.key ? "#0A0A0A" : "#E5E5E5"}`,
                backgroundColor: tab === item.key ? "#0A0A0A" : "#FAFAFA",
                color: tab === item.key ? "#FAFAFA" : "#404040",
                padding: "4px 10px",
                fontSize: "12px",
                cursor: "pointer",
              }}
```

Replace with:
```tsx
              style={{
                borderRadius: "9999px",
                border: "none",
                backgroundColor: tab === item.key ? "#0A0A0A" : "#F5F5F5",
                color: tab === item.key ? "#fff" : "#404040",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: tab === item.key ? 500 : 400,
                cursor: "pointer",
              }}
```

- [ ] **Step 4: Update header unread badge styling (lines 107–109)**

Find the header unread badge pill:
```tsx
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", borderRadius: "9999px", border: "1px solid #E5E5E5", backgroundColor: "#FAFAFA", padding: "6px 10px", fontSize: "12px", color: "#404040" }}>
            <BellRing size={13} strokeWidth={1.5} /> Unread: {unreadCountQuery.data?.count ?? "--"}
          </div>
```

Replace with:
```tsx
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "9999px", border: "none", backgroundColor: "#2563EB", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#fff" }}>
            <BellRing size={11} strokeWidth={1.5} /> {unreadCountQuery.data?.count ?? "--"}
          </div>
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run tests**

```bash
cd frontend && npm run test:run
```

Expected: all 74 tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/\(protected\)/notifications/page.tsx
git commit -m "feat(ui): update notifications dot color, filter chips, item backgrounds, and header badge"
```
