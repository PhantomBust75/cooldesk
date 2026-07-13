# Typography Consistency Pass — Design Spec

**Date:** 2026-07-13
**Approach:** Surgical inline-style edits only — no functionality changes, no new shared components/tokens (continues the established per-file convention already used by all 9 prior design-match passes)
**Fidelity:** Match `Owner's View UI Design/` reference values exactly where the reference itself is consistent; converge internal live-app drift to a single canonical value where the reference is ambiguous or the live app diverges from itself
**Scope:** Targeted pass — fix concrete residual gaps from prior passes, plus a full audit-and-fix of buttons, modals, and forms (the three categories with no clear prior pass)

---

## Background

This app has already been through 2-3 rounds of typography matching against the reference design (see `docs/superpowers/specs/2026-06-18-*`, `2026-06-23-figma-dashboard-redesign-design.md`, `2026-06-25-jobs-redesign-design.md`, `2026-06-30-ui-fixes-v2-design.md`, `2026-07-01-owner-view-design-match.md`, `2026-07-01-owner-portal-pages-design-match.md`, `2026-07-02-subproject-b-design-match.md`, `2026-07-13-analytics-design-match.md`). Sidebar, App Shell, Dashboard, Jobs List, Job Detail, Technicians, Dealers, Log New Job, Pending Schedule, and the old Notifications page have all had at least one pass. This spec is NOT a from-scratch redesign — it closes the specific gaps found by re-auditing against the reference, and does a first-time audit of buttons/modals/forms, which prior passes never treated as their own category.

**Not in scope**: the unimplemented `docs/superpowers/specs/2026-07-13-notification-center-drawer-design.md` (a paused spec to replace the Notifications page + bell popover with a global slide-in drawer). Per decision, this pass fixes the *current* Notifications page/popover typography as it exists today — if the drawer gets built later, it inherits whatever values this pass establishes.

**Not in scope**: introducing a shared typography/style-constants file. Every one of the 9 prior passes explicitly kept per-file inline styles as a Global Constraint; this pass continues that convention rather than introducing a new architectural pattern.

**Not in scope**: per-field inline validation errors (reference's Technicians/Dealer forms show a message under each invalid field; live only shows one banner per form) — this is new validation logic, not a typography fix.

**Not in scope**: reference's own internal inconsistencies (e.g. its notification-close button differs in shape between its own mobile and desktop variants) — not chasing a target that isn't consistent in the source.

**Not in scope**: `search-modal.tsx`'s result-list typography — a live-only feature (the reference has no functioning search results UI to compare against, only a static, non-interactive input).

---

## Part A: Residual Gaps From Prior Passes

These were flagged by prior specs but never fully applied, or found freshly in this pass's re-audit.

### A.1 — Jobs List customer-cell weight
**File:** `frontend/src/components/jobs/jobs-list.tsx:572`
**Current:** `color: "#171717", fontSize: "13px", fontWeight: 600`
**Reference:** `JobList.tsx:275` — `fontSize: '14px'` with **no explicit `fontWeight`** (defaults to 400)
**Fix:** Remove the `fontWeight: 600` override; keep `fontSize` at `14px` to match reference exactly (was `13px` live).

### A.2 — Log New Job label color
**File:** `frontend/src/app/(protected)/log-new-job/page.tsx` (repeated ~12×, e.g. lines 323, 339, 354, 375, 402, 407, 419, 430, 439, 463, 476)
**Current:** `color: "#525252"`
**Reference:** `LogNewJob.tsx:87` — `color: '#404040'`
**Fix:** Change every field-label `color` from `#525252` to `#404040`. Do not touch `fontSize`/`fontWeight` (`12px`/`500` already match).

### A.3 — Sidebar logo size
**File:** `frontend/src/components/layout/sidebar.tsx:104`
**Current:** `fontSize: "15px"`
**Reference:** `AppShell.tsx:203,295` — `fontSize: '16px'`
**Fix:** `15px` → `16px`. Leave `fontWeight`/`letterSpacing` unchanged (already `500`/`-0.01em`, matching reference).

### A.4 — Job Detail copy-icon color
**File:** `frontend/src/components/jobs/job-detail.tsx:368-383` (copy job id button)
**Current:** `color: "#737373"`
**Reference:** `JobDetail.tsx:280-292` — `color: '#A3A3A3'`
**Fix:** `#737373` → `#A3A3A3`.

### A.5 — "Show more details" toggle
**File:** `frontend/src/components/jobs/job-detail.tsx:553-560`
**Current:** `fontSize: "13px", color: "#737373"`
**Reference:** `JobDetail.tsx:413-428` ("Show technical details") — `fontSize: '12px', color: '#A3A3A3'`
**Fix:** `13px/#737373` → `12px/#A3A3A3`.

### A.6 — Notification card missing description text
**File:** `frontend/src/components/layout/app-shell.tsx` (popover item body, ~line 180) and `frontend/src/app/(protected)/notifications/page.tsx`
**Current:** Both render a generic fallback body line ("Tap to view details") — no real per-notification description.
**Reference:** `Notifications.tsx:35,42` — real body/description text per notification, `fontSize: '13px', color: '#525252', lineHeight: 1.5`.
**Fix (typography-only, no new data)**: apply the reference's body-text style (`13px/#525252/lineHeight:1.5`) to the existing fallback text. Do NOT attempt to generate real per-notification descriptions — that requires the `notification-meta.ts` concept from the paused drawer spec, which is out of scope here (a content/data gap, not a typography gap). Just bring the existing fallback line's *styling* in line with the reference; its *content* stays the generic fallback for now.

---

## Part B: Button Canonical Styles

No shared `Button` component exists (confirmed, zero exports named `Button` anywhere) and none is being introduced — apply these values as literal inline styles at each site, per the established per-file convention.

### B.1 — Primary button (standard)
**Canonical:** `padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, backgroundColor: "#0A0A0A", color: "#fff"`
This is already the majority pattern (Technicians' "Add technician", Dealer Management's "Add dealer", Log New Job's "Next"/"Create job", System Config's "Save configuration"). Fix outliers:
- `frontend/src/app/(protected)/payment-methods/page.tsx:224-233` (`ServiceItemModal` Save) — currently `padding: "12px 20px", borderRadius: "10px", fontSize: "14px"` → converge to canonical.

### B.2 — Primary button (large CTA)
**Canonical:** `padding: "12px 16px", borderRadius: "10px", fontSize: "14px", fontWeight: 500, backgroundColor: "#0A0A0A", color: "#fff"`
**Reference confirmation:** `JobDetail.tsx:508-520` (Advance Status) uses exactly this — `12px 16px / 10px / 14px / 500`. Note the reference uses weight **500**, not 600.
Fix in `frontend/src/components/jobs/job-detail.tsx`:
- Lines 876-891 (technician "Advance Status") — currently `padding: "16px", borderRadius: "10px", fontSize: "15px", fontWeight: 600` → converge to canonical.
- Lines 945-960 (owner "Advance Status") — currently `padding: "14px"` (uniform on all sides, not the canonical's asymmetric `12px 16px`), `borderRadius: "10px", fontSize: "14px", fontWeight: 600` → converge `padding` to `"12px 16px"` and `fontWeight` to `500` (radius and fontSize already match canonical).
- Lines 1314-1320 (Collect Payment confirm) — currently `padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 600` → converge (`fontWeight` 600 → 500).

### B.3 — Secondary button (outlined)
**Canonical:** `padding: "9px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 400, border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040"`
Fix `frontend/src/components/jobs/job-detail.tsx:987-1001` ("Actions" trigger) — currently `padding: "10px 14px", borderRadius: "10px", fontSize: "14px", fontWeight: 600` → converge to canonical (matches the reference's `JobDetail.tsx:524-541` "Actions" trigger: `padding 9px 14px, radius 8px, fontSize 13px`).

### B.4 — Danger (text-only) and B.5 — Icon-boxed danger
No changes — both already consistent app-wide (`color: "#991B1B"` text-only danger actions; `32×32px, radius 7px, bg #FFF5F5, color #EF4444` icon-boxed danger buttons on `payment-methods/page.tsx` and `PaymentMethodsSection.tsx`).

### B.6 — Icon-only, no box (copy icon)
Covered by A.4 above (job-detail.tsx copy button `#737373` → `#A3A3A3`). Do NOT change modal-close-X buttons (`modal.tsx`, `search-modal.tsx`, technicians/dealer-management modal headers) — those are a different, already-consistent affordance at `color: "#737373"`, confirmed matching across all four sites; only the copy-icon affordance needs to change.

### B.7 — Text-link style
Covered by A.5 above (job-detail.tsx "Show more details" toggle).

### B.8 — Pill/segmented toggle
**Canonical:** `fontSize: "13px", fontWeight: 500`
Fix `frontend/src/app/(protected)/payment-methods/page.tsx:143-162` (`ServiceItemModal` fixed/variable pricing-type toggle) — currently `fontSize: "14px", fontWeight: 700` → converge to canonical (`13px/500`), matching both the reference's own source for this exact component (`PaymentMethods.tsx:364`) and every other pill-toggle in the app (jobs-list technician-status pills, notifications filter pills).

### B.9 — Icon-boxed credential button (copy/reveal)
**Canonical:** `width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff"`
Fix `frontend/src/app/(protected)/dealer-management/page.tsx:540,561-571` (edit-modal copy/reveal buttons) — currently borderless (`background: none, border: none`) → add the boxed style, matching `frontend/src/app/(protected)/technicians/page.tsx:447-454,467-482`'s equivalent buttons for the identical credential-row affordance, and matching the reference's `Technicians.tsx:90-117` / `DealerManagement.tsx:101-129` `CredentialsSection`, which keeps this boxed in both forms.

---

## Part C: Modal Title Unification

**Canonical modal title:** `fontSize: "14px", fontWeight: 500, color: "#171717"` — the dominant existing pattern, from the shared `Modal` component (`frontend/src/components/ui/modal.tsx:53`), already matched by Technicians' edit modal and Dealer Management's bottom sheets, and confirmed structurally identical to the reference's own local `Modal` component (`JobDetail.tsx:105-156`, byte-for-byte the same shape as the live shared primitive).

Fix the two outliers:
- **`frontend/src/components/jobs/job-detail.tsx:1143`** — "Collect Payment" hand-rolled modal title, currently `fontSize: "18px", fontWeight: 600, color: "#0A0A0A"` → `fontSize: "14px", fontWeight: 500, color: "#171717"`.
- **`frontend/src/app/(protected)/pending-schedule/page.tsx:115`** — `BatchModal` title, currently `fontSize: "18px", fontWeight: 600` → `fontSize: "14px", fontWeight: 500, color: "#171717"`.

Do not change the modal card's shadow/border-radius/elevation in this pass — that's a structural/visual-weight decision beyond "typography," and neither modal's overall shape was flagged as a typography concern.

---

## Part D: Form Field Consistency

### D.1 — "Add/Edit entity" label + input convergence
**Canonical:** label `fontSize: "12px", fontWeight: 500, color: "#404040"`; input `fontSize: "13px"` (padding/border/radius stay as each file's existing values — only font properties change here). Confirmed as the reference's actual shared convention (`Technicians.tsx`/`DealerManagement.tsx` inline `labelStyle`/`inputStyle`), used identically for both add and edit, both entity types.

Fix:
- **`frontend/src/app/(protected)/technicians/page.tsx`** edit form (lines 385, 398, 409, 423 for labels; 391, 405, 416, 430 for inputs) — currently label `13px/500/#171717`, input `14px` → converge to canonical. (The Technicians *create* form, lines 330-339, already matches — no change there.)
- **`frontend/src/app/(protected)/dealer-management/page.tsx`** create form (lines 337, 349, 361, 374, 386 labels; 343, 355, 367, 380, 392 inputs) and edit form (lines 477, 488, 499, 511 labels; 483, 494, 505, 517 inputs) — currently label `13px/500/#171717`, input `14px` → converge to canonical, both create and edit.

Do not change the brand-assignment checkbox labels (`fontSize: "14px", color: "#171717", fontWeight: 500`, `dealer-management/page.tsx:406,589`) — those are a distinct "checkbox option" style the research did not flag as inconsistent with the reference.

### D.2 — Technicians create-modal shape
**File:** `frontend/src/app/(protected)/technicians/page.tsx:285-355` (create technician modal)
**Current:** Centered dialog — `alignItems: "center", justifyContent: "center"`, card `borderRadius: "16px"` on all four corners.
**Reference:** Both `Technicians.tsx` and `DealerManagement.tsx` use one bottom-sheet form for add and edit, both entities.
**Fix:** Convert the create-modal's overlay/card positioning to a bottom sheet — `alignItems: "flex-end"`, card `borderRadius: "16px 16px 0 0"` — matching the Technicians *edit* modal (lines 359-517) and both Dealer Management modals, which are already bottom sheets. This is a structural (not just typographic) change, but it's required to make D.1's font-level convergence actually land on a consistent modal shape — fixing the fonts on a differently-shaped dialog would leave the visual inconsistency the user is asking to close.

### D.3 — Payment Methods page consolidation
Three modals on one page currently have three different label/input styles. Converge all three to the reference's actual shared convention (`PaymentMethods.tsx:12-23`'s `labelStyle`/`inputStyle(minH)` helper, itself reused across all three reference sections): **label `fontSize: "12px", fontWeight: 500, color: "#404040"`; input `fontSize: "13px", borderRadius: "8px", minHeight: "44px"`**.

- **`frontend/src/app/(protected)/payment-methods/page.tsx`** `ServiceItemModal` (the `LBL`/`INP` consts, ~lines 102-103) — currently label `14px/600/#0A0A0A`, input `14px`, `radius 12px` → converge to canonical (the largest single outlier found).
- **`frontend/src/components/payment-methods/PaymentMethodsSection.tsx`** `PaymentMethodModal` (~line 84 label, ~line 92 input) — currently label `13px/500/#404040`, input `14px`, `radius 10px` → converge to canonical.
- **`frontend/src/app/(protected)/payment-methods/page.tsx`** `BrandModal` (~lines 474,490,511 labels; ~482,523 inputs) — already close (`12px/500/#404040`, `radius 8px`) — only add `minHeight: "44px"` if not already present; no other change.

### D.4 — Reassign/Override reason field
**File:** `frontend/src/components/jobs/job-detail.tsx` (Reassign modal ~line 1334, Override modal ~lines 1364,1377 — both use the shared `Modal` component from Part C)
**Current:** Label `fontSize: "12px", color: "#737373"` with no `fontWeight` set (defaults to 400); the reason field itself is a plain single-line `<input>` (~line 1379-1384) with no character-count helper. Confirmed via grep: the live code has no `minChars`/minimum-length concept anywhere — `reason.trim() || undefined` (line 179) only strips whitespace, it doesn't gate submission on length.
**Reference:** `JobDetail.tsx:159-183` `ReasonField` — label `fontSize: '12px', fontWeight: 500, color: '#404040'`; a `<textarea rows={3}>` with `minChars = 10` (default parameter); border color and the counter line's text color both switch from `#E5E5E5`/`#737373` to `#10B981` once `value.length >= minChars`; counter line `{value.length} / {minChars} minimum`, `fontSize: '11px'`. Confirmed this is a purely visual affordance in the reference — it recolors the textarea border and counter text, it does not gate the submit button's disabled state (which is unaffected by `met` in the surrounding code).
**Fix — visual-only, no new validation/submission logic:**
- Label: add `fontWeight: 500` and change `color` from `#737373` to `#404040` (matching D.1's label color, keeping this consistent with the rest of the app's dominant label convention rather than introducing a fourth label color).
- Replace the `<input>` with a `<textarea rows={3}>`, keeping the same `onChange`/value wiring and the same `reason.trim() || undefined` submission behavior — the submit button's enabled/disabled logic does not change.
- Add a local `minChars = 10` constant (matching the reference's default) used only to drive the two purely-visual effects below — it must not be wired into any `disabled`/submission check:
  - Textarea border color: `#E5E5E5` while empty, `#10B981` once `value.length >= minChars`, else stays `#E5E5E5`.
  - Counter line below the textarea: `fontSize: "11px"`, text `${value.length} / ${minChars} minimum`, color `#10B981` when the threshold is met, else `#737373` (matching this field's own existing muted-text color, rather than introducing the reference's `#A3A3A3` for this specific line — kept for internal consistency since every other piece of text in this exact modal already uses `#737373` for secondary text, per the modal's current styling).

---

## Files Touched

| File | Sections |
|---|---|
| `frontend/src/components/jobs/jobs-list.tsx` | A.1 |
| `frontend/src/app/(protected)/log-new-job/page.tsx` | A.2 |
| `frontend/src/components/layout/sidebar.tsx` | A.3 |
| `frontend/src/components/jobs/job-detail.tsx` | A.4, A.5, B.2, B.3, C, D.4 |
| `frontend/src/components/layout/app-shell.tsx` | A.6 |
| `frontend/src/app/(protected)/notifications/page.tsx` | A.6 |
| `frontend/src/app/(protected)/payment-methods/page.tsx` | B.1, B.8, D.3 |
| `frontend/src/app/(protected)/dealer-management/page.tsx` | B.9, D.1 |
| `frontend/src/app/(protected)/technicians/page.tsx` | D.1, D.2 |
| `frontend/src/app/(protected)/pending-schedule/page.tsx` | C |
| `frontend/src/components/payment-methods/PaymentMethodsSection.tsx` | D.3 |

No backend files change. No new files, no new shared components/tokens.

---

## Testing

**Confirmed existing test coverage of touched files** (checked directly, not assumed): `frontend/src/components/layout/sidebar.test.tsx` exists (covers A.3) but does not assert on the logo's `fontSize` anywhere, so it needs no update — it will keep passing unchanged. No test file exists at all for `jobs-list.tsx`, `job-detail.tsx`, `technicians/page.tsx`, `dealer-management/page.tsx`, `payment-methods/page.tsx`, `PaymentMethodsSection.tsx`, `pending-schedule/page.tsx`, `log-new-job/page.tsx`, `app-shell.tsx`, or `notifications/page.tsx` — every other section of this spec (A.1, A.2, A.4-A.6, B, C, D.1, D.3) is a pure style-value change with no existing test to update or break.

Two exceptions still warrant new tests, since they change rendering structure rather than just style values:
- **D.2** (Technicians create-modal shape change) — add a test confirming the create-modal's overlay uses `alignItems: "flex-end"` (bottom-sheet position) rather than `"center"`.
- **D.4** (Reassign/Override textarea + counter) — add a test confirming the reason field renders as a `<textarea>` (not `<input>`) and that the character-count helper text updates as the user types, and that the submit button's disabled state is unaffected by the character count (guards against accidentally wiring the visual `minChars` into real validation).
