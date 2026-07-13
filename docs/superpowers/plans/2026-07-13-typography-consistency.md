# Typography Consistency Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close typography/spacing drift between the live app and `Owner's View UI Design/` across residual gaps from prior passes, plus a full first-time audit-and-fix of buttons, modals, and forms.

**Architecture:** Surgical inline-style edits across 11 existing files, grouped into 9 tasks by file/feature area. No new files, no shared style/token module (continues this codebase's established per-file inline-style convention — see design spec's "Not in scope" section). Three tasks (D.2, D.4, B.9-related) involve small structural DOM changes (modal shape, `<input>`→`<textarea>`, credential-row layout) alongside the style fixes, but no new business logic anywhere.

**Tech Stack:** Next.js (App Router), React, TypeScript, inline styles only (no Tailwind/CSS modules).

**Design spec:** `docs/superpowers/specs/2026-07-13-typography-consistency-design.md` — read it for full rationale, reference file:line citations, and explicit non-goals. Every "current" code value quoted below was independently re-verified by direct file reads during spec-writing (several research inaccuracies from the initial broad audit were caught and corrected this way — see the spec's inline "Correction from initial scoping" notes).

## Global Constraints

- All styles stay inline (`style={{...}}`). No Tailwind, no CSS modules, no new shared component/token files — continues the established convention used by all 9 prior design-match passes in this repo.
- No functional/logic changes anywhere. Where a task touches a `disabled` condition, submit handler, or state variable, it must remain byte-identical after the change — only rendering/markup/style changes.
- **No new test files.** This is a pure visual-consistency pass (no new functionality) — matching the precedent set by all 9 prior design-match plans in this repo (`docs/superpowers/plans/2026-06-18-*` through `2026-07-02-subproject-b-design-match.md`), none of which added test files for equivalent style-only changes. Verification is: `cd frontend && npx tsc --noEmit` (must stay clean) + `cd frontend && npm run test:run` (full suite must stay green — confirms no existing test anywhere accidentally asserts on an old value) + a manual visual check via the dev server for any task that changes DOM structure (not just style values).
- **Each task's fix list is a verified starting point, not necessarily exhaustive.** Direct file reads while writing this plan caught 2-4 additional drifted instances beyond the original research in nearly every file touched. Before committing a task, grep your assigned file(s) once more for the same pattern category (e.g. other buttons matching the "Primary/black CTA" shape, other `fontSize: "1[5-8]px"` modal titles) and fix anything else you find that clearly matches — but do not go looking in files this plan doesn't list; stay inside each task's named file(s).
- Exact hex/px values as specified below — no substituting or approximating.

---

## File Map

| File | Task(s) |
|---|---|
| `frontend/src/components/jobs/jobs-list.tsx` | 1 |
| `frontend/src/components/layout/sidebar.tsx` | 1 |
| `frontend/src/app/(protected)/log-new-job/page.tsx` | 2 |
| `frontend/src/components/layout/app-shell.tsx` | 3 |
| `frontend/src/components/jobs/job-detail.tsx` | 4, 5 |
| `frontend/src/app/(protected)/pending-schedule/page.tsx` | 6 |
| `frontend/src/app/(protected)/payment-methods/page.tsx` | 7 |
| `frontend/src/components/payment-methods/PaymentMethodsSection.tsx` | 7 |
| `frontend/src/app/(protected)/dealer-management/page.tsx` | 8 |
| `frontend/src/app/(protected)/technicians/page.tsx` | 9 |

No backend files change.

---

## Task 1: Jobs List + Sidebar Quick Fixes

**Files:**
- Modify: `frontend/src/components/jobs/jobs-list.tsx`
- Modify: `frontend/src/components/layout/sidebar.tsx`

**Interfaces:** Consumes nothing from other tasks. Produces nothing consumed by other tasks. Fully independent.

- [ ] **Step 1: Remove the customer-cell fontWeight override in jobs-list.tsx**

Find (`jobs-list.tsx:572`):
```tsx
                    <td style={{ padding: "14px 16px", color: "#171717", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", borderLeft: job.tags.includes("chronic") ? "2px solid #9F1239" : "2px solid transparent" }}>
```

Replace with:
```tsx
                    <td style={{ padding: "14px 16px", color: "#171717", fontSize: "14px", whiteSpace: "nowrap", borderLeft: job.tags.includes("chronic") ? "2px solid #9F1239" : "2px solid transparent" }}>
```

(Removes `fontWeight: 600` entirely so it defaults to normal weight, and bumps `fontSize` from `13px` to `14px` — both matching the reference's `JobList.tsx:275`.)

- [ ] **Step 2: Fix the sidebar logo font size**

Find (`sidebar.tsx:104`):
```tsx
          <span style={{ fontSize: "15px", color: "#0A0A0A", fontWeight: 500, whiteSpace: "nowrap" }}>
```

Replace with:
```tsx
          <span style={{ fontSize: "16px", color: "#0A0A0A", fontWeight: 500, whiteSpace: "nowrap" }}>
```

- [ ] **Step 3: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass (neither file has a test that asserts on these two values — confirmed by direct inspection of `sidebar.test.tsx`, the only test file touching either component, which doesn't reference `fontSize` at all)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/jobs/jobs-list.tsx frontend/src/components/layout/sidebar.tsx
git commit -m "fix(typography): remove jobs-list customer-cell bold weight, fix sidebar logo size"
```

---

## Task 2: Log New Job Label Color

**Files:**
- Modify: `frontend/src/app/(protected)/log-new-job/page.tsx`

**Interfaces:** Fully independent.

- [ ] **Step 1: Replace the label color across all 11 field labels**

All 11 field-label instances share the exact same style-object text (confirmed via grep — the breadcrumb link and the "add unit" button use different surrounding properties and are NOT affected by this replace). Use a single `replace_all` edit.

Find (appears verbatim 11 times, at lines 323, 339, 354, 375, 402, 407, 419, 430, 439, 463, 476):
```
fontSize: "12px", fontWeight: 500, color: "#525252", display: "block", marginBottom: "5px"
```

Replace with (all 11 occurrences):
```
fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px"
```

- [ ] **Step 2: Verify all 11 occurrences were changed and nothing else was**

Run: `grep -c 'color: "#404040", display: "block", marginBottom: "5px"' frontend/src/app/\(protected\)/log-new-job/page.tsx`
Expected: `11`

Run: `grep -c 'color: "#525252"' frontend/src/app/\(protected\)/log-new-job/page.tsx`
Expected: `1` (only the breadcrumb link at line 307 remains, which is correct — it was never in scope)

- [ ] **Step 3: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass (no test file exists for this page)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(protected\)/log-new-job/page.tsx
git commit -m "fix(typography): correct log-new-job field label color to match reference"
```

---

## Task 3: Notification Popover Fallback Text

**Files:**
- Modify: `frontend/src/components/layout/app-shell.tsx`

**Interfaces:** Fully independent. Note: `frontend/src/app/(protected)/notifications/page.tsx` was originally believed to need an equivalent fix but direct inspection confirmed it has no body/description element at all — nothing to change there.

- [ ] **Step 1: Restyle the popover's fallback body line**

Find (`app-shell.tsx:180`):
```tsx
              <div style={{ fontSize: "12px", color: "#737373", marginTop: "2px", lineHeight: 1.4 }}>
                Tap to view details
              </div>
```

Replace with:
```tsx
              <div style={{ fontSize: "13px", color: "#525252", marginTop: "2px", lineHeight: 1.5 }}>
                Tap to view details
              </div>
```

- [ ] **Step 2: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/app-shell.tsx
git commit -m "fix(typography): match notification popover fallback text to reference body-text style"
```

---

## Task 4: Job Detail — Style-Value Fixes

**Files:**
- Modify: `frontend/src/components/jobs/job-detail.tsx`

**Interfaces:** Consumes nothing from other tasks. Task 5 also touches this file (a different, non-overlapping region) — do this task first since its changes are simpler and lower-risk.

- [ ] **Step 1: Fix the copy-icon color**

Find (`job-detail.tsx:368-383`):
```tsx
          <button
            type="button"
            title="Copy job ID"
            onClick={() => navigator.clipboard.writeText(detail.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: "#737373",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
```

Replace with:
```tsx
          <button
            type="button"
            title="Copy job ID"
            onClick={() => navigator.clipboard.writeText(detail.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: "#A3A3A3",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
```

- [ ] **Step 2: Fix the "Show more details" toggle**

Find (`job-detail.tsx:552-560`):
```tsx
              {/* ── Show more details accordion ── */}
              <button
                type="button"
                onClick={() => setShowTechnicalDetails((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#737373", padding: 0, display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
```

Replace with:
```tsx
              {/* ── Show more details accordion ── */}
              <button
                type="button"
                onClick={() => setShowTechnicalDetails((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#A3A3A3", padding: 0, display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
```

- [ ] **Step 3: Fix the technician's "Advance Status" large-CTA button (B.2)**

Find (`job-detail.tsx:876-891`):
```tsx
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: "10px",
                      backgroundColor: "#0A0A0A",
                      color: "#fff",
                      padding: "16px",
                      fontSize: "15px",
                      fontWeight: 600,
                      cursor: transitionMutation.isPending ? "not-allowed" : "pointer",
                      opacity: transitionMutation.isPending ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
```

Replace with:
```tsx
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: "10px",
                      backgroundColor: "#0A0A0A",
                      color: "#fff",
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: transitionMutation.isPending ? "not-allowed" : "pointer",
                      opacity: transitionMutation.isPending ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
```

- [ ] **Step 4: Fix the owner's "Advance Status" large-CTA button (B.2)**

Find (`job-detail.tsx:945-960`):
```tsx
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: "10px",
                    backgroundColor: "#0A0A0A",
                    color: "#fff",
                    padding: "14px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: nextStatuses.length === 0 ? "not-allowed" : "pointer",
                    opacity: nextStatuses.length === 0 ? 0.4 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
```

Replace with:
```tsx
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: "10px",
                    backgroundColor: "#0A0A0A",
                    color: "#fff",
                    padding: "12px 16px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: nextStatuses.length === 0 ? "not-allowed" : "pointer",
                    opacity: nextStatuses.length === 0 ? 0.4 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
```

- [ ] **Step 5: Fix the "Actions" trigger secondary button (B.3)**

Find (`job-detail.tsx:987-1001`):
```tsx
              style={{
                width: "100%",
                border: "1px solid #E5E5E5",
                borderRadius: "10px",
                backgroundColor: "#fff",
                color: "#171717",
                padding: "10px 14px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
```

Replace with:
```tsx
              style={{
                width: "100%",
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                backgroundColor: "#fff",
                color: "#404040",
                padding: "9px 14px",
                fontSize: "13px",
                fontWeight: 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
```

- [ ] **Step 6: Fix the Collect Payment modal title (Part C)**

Find (`job-detail.tsx:1143`):
```tsx
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#0A0A0A" }}>Collect Payment</h2>
```

Replace with:
```tsx
                  <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: "#171717" }}>Collect Payment</h2>
```

- [ ] **Step 7: Fix the Collect Payment modal's "Cancel" button (B.3)**

Find (`job-detail.tsx:1288-1294`):
```tsx
                  <button
                    type="button"
                    onClick={() => setCollectPaymentOpen(false)}
                    style={{ flex: 1, border: "1px solid #E5E5E5", borderRadius: "10px", backgroundColor: "#fff", color: "#525252", padding: "12px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
```

Replace with:
```tsx
                  <button
                    type="button"
                    onClick={() => setCollectPaymentOpen(false)}
                    style={{ flex: 1, border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#404040", padding: "9px 14px", fontSize: "13px", fontWeight: 400, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
```

- [ ] **Step 8: Fix the Collect Payment modal's confirm button padding/weight (B.2)**

Find (`job-detail.tsx:1314-1320`):
```tsx
                    style={{
                      flex: 2, border: "none", borderRadius: "10px",
                      backgroundColor: canConfirm ? "#0A0A0A" : "#E5E5E5",
                      color: canConfirm ? "#fff" : "#A3A3A3",
                      padding: "12px", fontSize: "14px", fontWeight: 600,
                      cursor: canConfirm ? "pointer" : "not-allowed",
                    }}
```

Replace with:
```tsx
                    style={{
                      flex: 2, border: "none", borderRadius: "10px",
                      backgroundColor: canConfirm ? "#0A0A0A" : "#E5E5E5",
                      color: canConfirm ? "#fff" : "#A3A3A3",
                      padding: "12px 16px", fontSize: "14px", fontWeight: 500,
                      cursor: canConfirm ? "pointer" : "not-allowed",
                    }}
```

- [ ] **Step 9: Scan the rest of this file for any other instance of these same patterns**

Grep for other buttons using `fontWeight: 600` inside a `#0A0A0A`-background style block, and any other `fontSize: "1[5-8]px"` heading inside a modal-like overlay, within `job-detail.tsx`. Fix any additional genuine match using the same canonical values from Steps 3-8. Do not touch the Reassign/Override modal (Task 5) or anything outside this file.

- [ ] **Step 10: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass (no test file exists for `job-detail.tsx`)

- [ ] **Step 11: Manual visual check**

Start the dev server, open a job's detail page as `owner@cooldesk.dev`. Confirm: the copy-ID icon and "Show more details" toggle read as a lighter gray than before; the "Advance Status" button (both technician and owner paths) is visually less heavy (500 vs 600 weight); the "Actions" dropdown trigger text is smaller/lighter; opening "Collect Payment" shows a smaller, lighter modal title matching the app's other modals.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/jobs/job-detail.tsx
git commit -m "fix(typography): job-detail button weights/sizes, copy-icon color, modal title unification"
```

---

## Task 5: Job Detail — Override Modal Reason Field

**Files:**
- Modify: `frontend/src/components/jobs/job-detail.tsx`

**Interfaces:** Touches a different region of the same file as Task 4 — do Task 4 first, then this task, to avoid both tasks editing overlapping lines in parallel. Consumes nothing else. Produces nothing consumed elsewhere.

This task does NOT touch the Reassign modal (its only label, "New technician" at line 1334-1335, is for a `<select>` dropdown — not a reason field, out of scope) or the Override modal's "Target status" label (line 1364-1365, also a `<select>`, out of scope). Only the Override modal's "Reason" field (lines 1377-1384) changes.

- [ ] **Step 1: Add a `minChars` constant near the Override modal's state**

Find (near the top of the component, wherever `overrideReason`/`overrideStatus` state is declared — locate via `grep -n "overrideReason" frontend/src/components/jobs/job-detail.tsx` to find the exact `useState` line):
```tsx
  const [overrideReason, setOverrideReason] = useState("");
```

Replace with:
```tsx
  const [overrideReason, setOverrideReason] = useState("");
  const OVERRIDE_REASON_MIN_CHARS = 10;
```

(If the exact surrounding line differs slightly from what's shown here, locate the `overrideReason` state declaration by content and add the constant directly after it — do not guess a different location.)

- [ ] **Step 2: Replace the Reason field's label + input with label + textarea + counter**

Find (`job-detail.tsx:1377-1384`):
```tsx
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            Reason
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason is required"
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            />
          </label>
```

Replace with:
```tsx
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>
            Reason
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason is required"
              rows={3}
              style={{
                borderRadius: "8px",
                border: `1px solid ${overrideReason.length >= OVERRIDE_REASON_MIN_CHARS ? "#10B981" : "#E5E5E5"}`,
                padding: "8px 10px",
                fontSize: "13px",
                color: "#171717",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: "11px", color: overrideReason.length >= OVERRIDE_REASON_MIN_CHARS ? "#10B981" : "#737373" }}>
              {overrideReason.length} / {OVERRIDE_REASON_MIN_CHARS} minimum
            </span>
          </label>
```

- [ ] **Step 3: Verify the submit button's disabled condition is unchanged**

Run: `grep -n "disabled={!overrideStatus" frontend/src/components/jobs/job-detail.tsx`
Expected output includes the unchanged line:
```tsx
            disabled={!overrideStatus || !overrideReason.trim() || ownerOverrideMutation.isPending}
```
Confirm this line was not touched by Step 2 — the character count (`OVERRIDE_REASON_MIN_CHARS`) must not appear anywhere in this expression.

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass

- [ ] **Step 5: Manual visual check**

Start the dev server, open a job in a status that allows Override (owner role), open the Override modal. Confirm: the Reason field is now a multi-line textarea; a counter below it reads "0 / 10 minimum" in gray; typing 10+ characters turns the counter and textarea border green; the "Confirm override" button's enabled/disabled state is unaffected by character count (only by whether the reason is non-empty and a status is selected, as before).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/jobs/job-detail.tsx
git commit -m "feat(typography): convert Override modal's Reason field to textarea with character counter"
```

---

## Task 6: Pending Schedule Modal Title

**Files:**
- Modify: `frontend/src/app/(protected)/pending-schedule/page.tsx`

**Interfaces:** Fully independent.

- [ ] **Step 1: Fix the BatchModal title**

Find (`pending-schedule/page.tsx:115`):
```tsx
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#0A0A0A" }}>Batch Schedule</h2>
```

Replace with:
```tsx
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: "#171717" }}>Batch Schedule</h2>
```

- [ ] **Step 2: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(protected\)/pending-schedule/page.tsx
git commit -m "fix(typography): unify BatchModal title to canonical modal-title style"
```

---

## Task 7: Payment Methods Page + PaymentMethodsSection Consolidation

**Files:**
- Modify: `frontend/src/app/(protected)/payment-methods/page.tsx`
- Modify: `frontend/src/components/payment-methods/PaymentMethodsSection.tsx`

**Interfaces:** Fully independent of other tasks. Both files are edited in this one task since they represent the same "Payment Methods page has 3 divergent modal styles" problem the design spec calls the single clearest regression in the app.

- [ ] **Step 1: Fix `ServiceItemModal`'s `LBL`/`INP` consts**

Find (`payment-methods/page.tsx:102-103`):
```tsx
  const LBL: CSSProperties = { display: "block", fontSize: "14px", fontWeight: 600, color: "#0A0A0A", marginBottom: "8px" };
  const INP: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "14px 16px", border: "1px solid #E5E5E5", borderRadius: "12px", fontSize: "14px", color: "#171717", outline: "none", fontFamily: "inherit" };
```

Replace with:
```tsx
  const LBL: CSSProperties = { display: "block", fontSize: "12px", fontWeight: 500, color: "#404040", marginBottom: "8px" };
  const INP: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "14px 16px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717", outline: "none", fontFamily: "inherit", minHeight: "44px" };
```

- [ ] **Step 2: Fix `ServiceItemModal`'s title**

Find (`payment-methods/page.tsx:114`):
```tsx
          <span style={{ fontSize: "18px", fontWeight: 600, color: "#0A0A0A" }}>
            {isEdit ? "Edit service item" : "Add service item"}
          </span>
```

Replace with:
```tsx
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>
            {isEdit ? "Edit service item" : "Add service item"}
          </span>
```

- [ ] **Step 3: Fix `ServiceItemModal`'s pricing-type toggle**

Find (`payment-methods/page.tsx:144-162`):
```tsx
                <button
                  key={t}
                  type="button"
                  onClick={() => { setPricingType(t); setUnitLabel(""); }}
                  style={{
                    padding: "8px 22px",
                    borderRadius: "9999px",
                    border: pricingType === t ? "2px solid #0A0A0A" : "2px solid transparent",
                    backgroundColor: pricingType === t ? "#fff" : "transparent",
                    color: pricingType === t ? "#0A0A0A" : "#737373",
                    fontSize: "14px",
                    fontWeight: pricingType === t ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                >
```

Replace with:
```tsx
                <button
                  key={t}
                  type="button"
                  onClick={() => { setPricingType(t); setUnitLabel(""); }}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: pricingType === t ? "#fff" : "transparent",
                    color: pricingType === t ? "#0A0A0A" : "#737373",
                    fontSize: "13px",
                    fontWeight: pricingType === t ? 500 : 400,
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                >
```

- [ ] **Step 4: Fix `ServiceItemModal`'s Cancel button**

Find (`payment-methods/page.tsx:216-222`):
```tsx
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "12px 20px", borderRadius: "10px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", fontSize: "14px", cursor: "pointer", fontWeight: 500, minWidth: "90px" }}
            >
              Cancel
            </button>
```

Replace with:
```tsx
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", fontSize: "13px", cursor: "pointer", fontWeight: 400, minWidth: "90px" }}
            >
              Cancel
            </button>
```

- [ ] **Step 5: Fix `ServiceItemModal`'s Save/submit button**

Find (`payment-methods/page.tsx:223-233`):
```tsx
            <button
              type="submit"
              disabled={isPending || !isValid}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "12px 20px", borderRadius: "10px", border: "none",
                backgroundColor: isPending || !isValid ? "#E5E5E5" : "#0A0A0A",
                color: isPending || !isValid ? "#A3A3A3" : "#fff",
                fontSize: "14px", fontWeight: 500, cursor: isPending || !isValid ? "not-allowed" : "pointer",
                minWidth: "110px",
              }}
            >
```

Replace with:
```tsx
            <button
              type="submit"
              disabled={isPending || !isValid}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", borderRadius: "8px", border: "none",
                backgroundColor: isPending || !isValid ? "#E5E5E5" : "#0A0A0A",
                color: isPending || !isValid ? "#A3A3A3" : "#fff",
                fontSize: "13px", fontWeight: 500, cursor: isPending || !isValid ? "not-allowed" : "pointer",
                minWidth: "110px",
              }}
            >
```

- [ ] **Step 6: Fix `BrandModal`'s Cancel and Submit button padding**

Find (`payment-methods/page.tsx:534-547`):
```tsx
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#404040", minHeight: "44px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !isValid}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: isValid && !isPending ? "#0A0A0A" : "#E5E5E5", color: isValid && !isPending ? "#fff" : "#A3A3A3", cursor: isValid && !isPending ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: 500, minHeight: "44px" }}
              >
```

Replace with:
```tsx
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#404040", minHeight: "44px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !isValid}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px", border: "none", backgroundColor: isValid && !isPending ? "#0A0A0A" : "#E5E5E5", color: isValid && !isPending ? "#fff" : "#A3A3A3", cursor: isValid && !isPending ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: 500, minHeight: "44px" }}
              >
```

- [ ] **Step 7: Fix `PaymentMethodModal`'s title (in `PaymentMethodsSection.tsx`)**

Find (`PaymentMethodsSection.tsx:72-74`):
```tsx
          <span style={{ fontSize: "17px", fontWeight: 600, color: "#0A0A0A" }}>
            {isEdit ? "Edit payment method" : "Add payment method"}
          </span>
```

Replace with:
```tsx
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>
            {isEdit ? "Edit payment method" : "Add payment method"}
          </span>
```

- [ ] **Step 8: Fix `PaymentMethodModal`'s input style (in `PaymentMethodsSection.tsx`)**

Find (`PaymentMethodsSection.tsx:92`):
```tsx
                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "1px solid #E5E5E5", borderRadius: "10px", fontSize: "14px", color: "#171717", outline: "none", fontFamily: "inherit" }}
```

Replace with:
```tsx
                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717", outline: "none", fontFamily: "inherit", minHeight: "44px" }}
```

- [ ] **Step 9: Fix `PaymentMethodModal`'s Cancel and Submit buttons (in `PaymentMethodsSection.tsx`)**

Find (`PaymentMethodsSection.tsx:99-119`):
```tsx
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "10px 18px", borderRadius: "9px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !isValid}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "10px 18px", borderRadius: "9px", border: "none",
                  backgroundColor: isPending || !isValid ? "#E5E5E5" : "#0A0A0A",
                  color: isPending || !isValid ? "#A3A3A3" : "#fff",
                  fontSize: "13px", fontWeight: 500,
                  cursor: isPending || !isValid ? "not-allowed" : "pointer",
                }}
              >
```

Replace with:
```tsx
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", fontSize: "13px", fontWeight: 400, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !isValid}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px", borderRadius: "8px", border: "none",
                  backgroundColor: isPending || !isValid ? "#E5E5E5" : "#0A0A0A",
                  color: isPending || !isValid ? "#A3A3A3" : "#fff",
                  fontSize: "13px", fontWeight: 500,
                  cursor: isPending || !isValid ? "not-allowed" : "pointer",
                }}
              >
```

- [ ] **Step 10: Scan the rest of both files for any other instance of these same patterns**

Grep both files for any other button/label/title matching the "Primary/Secondary button" or "modal title" shapes not already covered above (e.g. the `PaymentMethodsSection`'s own list-row edit/delete icon buttons, or any other modal in `payment-methods/page.tsx` not yet checked). Fix any genuine match using the canonical values from the design spec's Part B/C. Do not touch `BrandModal`'s labels/inputs (already confirmed correct, no change) or its title (already `14px/500/#171717`, no change).

- [ ] **Step 11: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass (no test file exists for either component)

- [ ] **Step 12: Manual visual check**

Start the dev server, go to Payment Methods as `owner@cooldesk.dev`. Open "Add service item", "Add brand", and "Add payment method" — confirm all three modals now share the same title size/weight, the same label size/weight/color, and visually similar button sizing. Confirm the fixed/variable pricing toggle no longer shows extra-bold (700) text on the active option.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/app/\(protected\)/payment-methods/page.tsx frontend/src/components/payment-methods/PaymentMethodsSection.tsx
git commit -m "fix(typography): consolidate Payment Methods page's 3 divergent modal styles into one"
```

---

## Task 8: Dealer Management Fixes

**Files:**
- Modify: `frontend/src/app/(protected)/dealer-management/page.tsx`

**Interfaces:** Fully independent.

- [ ] **Step 1: Fix label/input sizes across both create and edit forms in one pass**

The create form (5 fields: Business name, Contact name, Email address, Region, Password — lines 337-395) and the edit form (4 fields: Business name, Contact name, Email address, Region — lines 477-517, no password field) use the exact same label and input style strings. A single `replace_all` on each pattern updates both forms in one edit call — expect **9 label matches and 9 input matches** (5 create + 4 edit), not 5.

Find (the label pattern, appearing identically 9 times):
```tsx
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
```
Replace with (`replace_all` — expect 9 replacements):
```tsx
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>
```

Find (the input pattern, appearing identically 9 times):
```tsx
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
```
Replace with (`replace_all` — expect 9 replacements):
```tsx
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717" }}
```

**Caution:** verify the `replace_all` for the label string only affects the 5 create-form field labels, not the "Brand assignment" label (line 398-401, which has `fontWeight: 600` — a different string, unaffected) nor anything in the edit form (edit form fields have the exact same string pattern, and per Step 2 below they should ALSO change to the same target values, so a single `replace_all` across the whole file for both label and input patterns is actually correct and intentional — it will hit both create and edit form fields, which is exactly what Step 2 asks for too. Do not run Step 2 as a separate `replace_all` on the same strings — one `replace_all` per pattern across the whole file covers both forms at once).

- [ ] **Step 2: Confirm both forms were covered by Step 1's replace_all**

Run: `grep -c 'fontSize: "12px", fontWeight: 500, color: "#404040"' frontend/src/app/\(protected\)/dealer-management/page.tsx`
Expected: `9` (5 create-form labels + 4 edit-form labels at `dealer-management/page.tsx:477,488,499,511` — the edit form has no Password field, so only 4, not 5)

Run: `grep -c 'padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717"' frontend/src/app/\(protected\)/dealer-management/page.tsx`
Expected: `9` (5 create-form inputs + 4 edit-form inputs)

If either count is lower than expected, some occurrences weren't identical strings — find and fix the remaining ones individually using the same target values.

- [ ] **Step 3: Restructure the credential-row copy/reveal buttons (B.9)**

Find (`dealer-management/page.tsx:527-545`, username row):
```tsx
                      <div>
                        <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          USERNAME
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            value={email}
                            readOnly
                            style={{ width: "100%", boxSizing: "border-box", padding: "10px 40px 10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#737373", backgroundColor: "#FAFAFA" }}
                          />
                          <button
                            type="button"
                            onClick={() => handleCopy(email)}
                            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#A3A3A3", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
```

Replace with:
```tsx
                      <div>
                        <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          USERNAME
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            value={email}
                            readOnly
                            style={{ flex: 1, padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#404040", backgroundColor: "#FAFAFA", outline: "none" }}
                          />
                          <button
                            type="button"
                            onClick={() => handleCopy(email)}
                            style={{ padding: "9px", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer", color: "#737373", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
```

Find (`dealer-management/page.tsx:546-577`, password row):
```tsx
                      <div>
                        <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          PASSWORD
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            value="••••••••••••"
                            readOnly
                            type={showPassword ? "text" : "password"}
                            style={{ width: "100%", boxSizing: "border-box", padding: "10px 72px 10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#737373", backgroundColor: "#FAFAFA" }}
                          />
                          <div style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "8px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#A3A3A3", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy("dummy-password")}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#A3A3A3", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: "12px", color: "#737373", margin: "8px 0 0 0" }}>
                          To change the password, use the &ldquo;Reset password&rdquo; flow in system settings.
                        </p>
                      </div>
```

Replace with:
```tsx
                      <div>
                        <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          PASSWORD
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            value="••••••••••••"
                            readOnly
                            type={showPassword ? "text" : "password"}
                            style={{ flex: 1, padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#404040", backgroundColor: "#FAFAFA", outline: "none" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ padding: "9px", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer", color: "#737373", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy("dummy-password")}
                            style={{ padding: "9px", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer", color: "#737373", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                        <p style={{ fontSize: "12px", color: "#737373", margin: "8px 0 0 0" }}>
                          To change the password, use the &ldquo;Reset password&rdquo; flow in system settings.
                        </p>
                      </div>
```

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass (no test file exists for this page)

- [ ] **Step 5: Manual visual check**

Start the dev server, go to Dealer Management as `owner@cooldesk.dev`, open both "Add dealer" and an existing dealer's "Edit dealer". Confirm labels/inputs look consistent between the two. In the edit modal, confirm the username/password copy and reveal buttons are now separate boxed buttons next to the input (not icons floating inside it), matching the Technicians page's equivalent edit form.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/\(protected\)/dealer-management/page.tsx
git commit -m "fix(typography): converge dealer form labels/inputs, restructure credential-row buttons to match Technicians"
```

---

## Task 9: Technicians Fixes

**Files:**
- Modify: `frontend/src/app/(protected)/technicians/page.tsx`

**Interfaces:** Fully independent. The create form (lines 330-339) already matches canonical (`12px/500/#404040` label, `13px` input) — no change needed there, confirmed by direct inspection.

- [ ] **Step 1: Convert the create-modal to a bottom sheet**

Find (`technicians/page.tsx:288-296`, overlay):
```tsx
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999,
              }}
```

Replace with:
```tsx
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 999,
              }}
```

Find (`technicians/page.tsx:298-309`, card):
```tsx
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '520px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  overflow: 'hidden',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
```

Replace with:
```tsx
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '16px 16px 0 0',
                  width: '100%',
                  maxWidth: '520px',
                  boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
                  overflow: 'hidden',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
```

- [ ] **Step 2: Convert the edit-modal to a bottom sheet**

Find (`technicians/page.tsx:360-363`, overlay):
```tsx
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '24px' }}
              onClick={() => setEditTarget(null)}
            >
```

Replace with:
```tsx
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999, padding: '24px' }}
              onClick={() => setEditTarget(null)}
            >
```

Find (`technicians/page.tsx:364-367`, card):
```tsx
              <div
                style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
              >
```

Replace with:
```tsx
              <div
                style={{ backgroundColor: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '520px', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
              >
```

- [ ] **Step 3: Converge the edit-form label style**

Find (appears identically 4 times, at lines 385, 398, 409, 423):
```tsx
                    <label style={{ fontSize: '13px', fontWeight: 500, color: '#171717', display: 'block', marginBottom: '6px' }}>
```

Replace with (all 4 occurrences — use `replace_all`):
```tsx
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '6px' }}>
```

- [ ] **Step 4: Converge the edit-form input style**

Find (appears identically 4 times, at lines 391, 405, 416, 430):
```tsx
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '14px', color: '#171717', outline: 'none' }}
```

Replace with (all 4 occurrences — use `replace_all`):
```tsx
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717', outline: 'none' }}
```

- [ ] **Step 5: Verify occurrence counts**

Run: `grep -c "fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '6px'" frontend/src/app/\(protected\)/technicians/page.tsx`
Expected: `4`

Run: `grep -c "padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717', outline: 'none'" frontend/src/app/\(protected\)/technicians/page.tsx`
Expected: `4`

- [ ] **Step 6: Typecheck and run the full test suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd frontend && npm run test:run`
Expected: all tests pass (no test file exists for this page — `TechnicianDetailPanel.test.tsx` covers a different component)

- [ ] **Step 7: Manual visual check**

Start the dev server, go to Technicians as `owner@cooldesk.dev`. Open "Add technician" — confirm it now slides up from the bottom (not a centered dialog). Open an existing technician's edit form — confirm it also slides up from the bottom, and its field labels/inputs now visually match the create form's sizing.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/\(protected\)/technicians/page.tsx
git commit -m "fix(typography): convert Technicians create/edit modals to bottom sheets, converge edit-form field sizes"
```

---

## Self-Review Notes

**Spec coverage:** A.1→Task 1. A.2→Task 2. A.3→Task 1. A.4, A.5→Task 4. A.6→Task 3. B.1→Task 7 (+ Task 4/7 button-pattern spillover found during direct verification). B.2, B.3→Task 4 (+ spillover instances in Task 7). B.4/B.5→no task (already consistent). B.6→Task 4 (same as A.4). B.7→Task 4 (same as A.5). B.8→Task 7. B.9→Task 8. Part C→Tasks 4, 6, 7 (4 outliers total, up from the 2 originally scoped). D.1→Tasks 8, 9. D.2→Task 9 (both modals, not just create). D.3→Task 7. D.4→Task 5.

**Placeholder scan:** no TBD/TODO; every step has complete, runnable code, verified against actual current file content (not assumed) during spec-writing.

**Type consistency:** `OVERRIDE_REASON_MIN_CHARS` (Task 5) is introduced and used only within that task's single file region — no cross-task naming conflicts. No new shared types/interfaces are introduced anywhere in this plan.

**A note on plan reliability:** this plan's "current" code blocks were directly verified against the live files while writing the spec and this plan (not taken solely from the original broad research passes), which caught and corrected several real inaccuracies — a misreported `fontWeight`, an assumed-but-nonexistent second reason field, an assumed-already-correct modal shape that was actually wrong, and 4 additional drifted instances (2 modal titles, 2 buttons) that neither research pass had found. Given this pattern held across every file checked, each task above includes an explicit "scan the rest of this file" step — treat the enumerated fixes as a verified floor, not a verified ceiling.
