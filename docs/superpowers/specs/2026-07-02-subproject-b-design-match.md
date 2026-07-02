# Sub-project B: Remaining Pages Design Match — Spec

> Visual-only pixel-perfect alignment of 8 existing frontend pages to the Figma Make design export.
> No new modals, no new functionality, no logic changes — inline style changes only.

Design export root: `Owner's View UI Design/src/app/pages/`

---

## Global Constraints

- All styles must be inline (`style={{}}`). No Tailwind, no CSS modules.
- Do NOT change any API calls, mutations, query hooks, state logic, or component props/signatures.
- Do NOT remove or hide existing functional elements (search bars, per-field save buttons, etc.) even if absent from design — these are functional, not visual.
- Do NOT rebuild the Login demo section — only update its existing inline styles.
- Do NOT change System Config's per-field save interaction to a single save button — functional change, out of scope.
- TypeScript must pass: `cd frontend && npx tsc --noEmit`
- Tests must pass: `cd frontend && npm run test:run`

---

## Section 1 — Technicians Page

**File:** `frontend/src/app/(protected)/technicians/page.tsx`

1. `maxWidth`: `980px` → `1100px`
2. "Add technician" button `padding`: `"7px 14px"` → `"8px 14px"`
3. "Add technician" button `border`: `"1px solid #E5E5E5"` → `"none"`
4. "Add technician" button `color`: `"#FAFAFA"` → `"#fff"`
5. Subtitle `margin`: `"3px 0 0"` → `"4px 0 0"`

---

## Section 2 — Job List

**File:** `frontend/src/components/jobs/jobs-list.tsx`

1. Table header cells `color`: `"#94A3B8"` → `"#A3A3A3"`
2. Table header cells `letterSpacing`: `"0.04em"` → `"0.06em"`
3. Job ID cell `fontSize`: `"12px"` → `"13px"`; `color`: `"#525252"` → `"#171717"`
4. Customer cell `fontWeight`: `500` → remove (no explicit fontWeight in design for customer cell, defaults to `400`)

---

## Section 3 — Login Page

**File:** `frontend/src/app/(auth)/login/page.tsx`

1. Card `padding`: `"32px"` → `"28px"`
2. H2 bottom `margin`: `"20px"` → `"22px"`
3. Form `gap`: `"16px"` → `"14px"`
4. Email input vertical padding: `"9px 12px"` → `"10px 12px"`
5. Password input padding: `"9px 40px 9px 12px"` → `"10px 12px 10px 40px"`
6. Input `onFocus` outline/border color: `"#2563EB"` → `"#A3A3A3"`
7. Submit button `padding`: `"10px"` → `"11px"`; add `minHeight: "44px"`
8. Subtitle text: `"portal"` → `"platform"`
9. Demo section bar: update `padding` to `"10px 16px"` (if not already); `borderRadius: "8px"`, `backgroundColor: "#F5F5F5"` (keep existing, just verify)

---

## Section 4 — Dealer Management Page

**File:** `frontend/src/app/(protected)/dealer-management/page.tsx`

1. Page desktop `padding`: `"32px"` → `"24px"`
2. `maxWidth`: `"980px"` → `"1100px"`
3. H1 `fontSize`: `"28px"` → `"36px"`
4. H1 `fontWeight`: `700` → `600`
5. Header `marginBottom`: `"32px"` → `"24px"`
6. Subtitle `fontSize`: `"14px"` → `"13px"`; `margin`: `"4px 0 0"` → `"3px 0 0"`
7. "Add dealer" button `padding`: `"10px 16px"` → `"8px 14px"`; `border`: `"1px solid #0A0A0A"` → `"none"`; `fontSize`: `"14px"` → `"13px"`
8. Dealer list `gap`: `"12px"` → `"8px"`
9. Avatar `size` prop: `44` → `40`; avatar-to-name container `gap`: `"14px"` → `"12px"`

---

## Section 5 — Dashboard Page

**File:** `frontend/src/app/(protected)/dashboard/page.tsx`

1. H1 `fontWeight`: `700` → `600`
2. H1 `color`: `"#050505"` → `"#0A0A0A"`
3. H1 `letterSpacing`: `"0"` (or unset) → `"-0.02em"`
4. Section titles ("Needs revisit", "Active jobs") `fontSize`: `"16px"` → `"14px"`; `color`: `"#111827"` → `"#171717"`
5. Table card + toolbar `borderColor`: `"#E5E7EB"` → `"#E5E5E5"` (card outline and toolbar divider)
6. Toolbar `padding`: `"14px 18px"` → `"14px 16px"`
7. Body cell `borderBottom` color: `"#EEF0F3"` → `"#F1F5F9"`
8. Body cell `padding`: `"16px 18px"` → `"16px"` (equal all four sides)
9. Customer cell `color`: `"#111827"` → `"#0F172A"`; `fontWeight`: `700` → `600`
10. Revisit `#` cell `color`: `"#BE123C"` → `"#9F1239"`; `fontWeight`: `700` → `500`
11. KPI grid `gap` (desktop): `"14px"` → `"12px"`; grid `marginBottom`: `"31px"` → `"32px"`

---

## Section 6 — Analytics Page

**File:** `frontend/src/app/(protected)/analytics/page.tsx`

1. Page `maxWidth`: `"1040px"` → `"1400px"`
2. Header `marginBottom`: `"20px"` → `"24px"`
3. Wrap tab bar + tab content area in a single card div:
   ```
   backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden"
   ```
4. Tab button `padding`: `"10px 0"` → `"12px 18px"`
5. Tab button active indicator: change from `borderBottom: "2px solid"` to `boxShadow: "inset 0 -2px 0 0 #0A0A0A"` (so it shows on white card background)
6. Business KPI card `padding`: `"14px"` → `"20px"`
7. Business KPI value `fontSize`: `"26px"` → `"24px"`
8. Business KPI grid: `gridTemplateColumns: "repeat(3, 1fr)"` → `"repeat(4, 1fr)"`
9. Technician table header `fontSize`: `"12px"` → `"13px"`; `color`: `"#737373"` → `"#525252"`; add `fontWeight: 500`

---

## Section 7 — Payment Methods Page

**File:** `frontend/src/app/(protected)/payment-methods/page.tsx`

1. Page `maxWidth`: `"880px"` → `"960px"`
2. Service Items section `marginBottom`: `"20px"` → `"24px"`
3. Section title `fontSize`: `"15px"` → `"14px"`; `fontWeight`: `600` → `500`
4. Service Items table header `padding`: add horizontal `"0 0 10px"` → `"10px 16px"`; `fontWeight`: `600` → `500`; remove `textTransform: "uppercase"` and `letterSpacing` if present
5. Service Items table body cell `padding`: `"12px 0"` → `"13px 16px"`
6. Brands section: apply same section title font changes as #3
7. Brands table body cell `padding`: `"12px 0"` → `"13px 16px"`
8. Add FAFAFA header bar to each section card: inside the section `<div>`, before the content, add a header bar div:
   ```
   backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", padding: "12px 16px"
   ```
   containing the section title + description; move title/description into this bar.

---

## Section 8 — System Config Page

**File:** `frontend/src/app/(protected)/admin/system-config/page.tsx`

1. Page `maxWidth`: `"980px"` → `"900px"`
2. Header `marginBottom`: `"20px"` → `"24px"`
3. Info banner `backgroundColor`: `"#F5F5F5"` → `"#FAFAFA"`; `padding`: `"12px 16px"` → `"10px 14px"`
4. Info banner icon `size`: `16` → `14`; `color`: `"#737373"` → `"#525252"`
5. Info text `fontSize`: `"12px"` → `"13px"`
6. Section `marginBottom`: `"16px"` → `"20px"`
7. Section title `fontSize`: `"14px"` → `"13px"`; `fontWeight`: `600` → `500`
8. Field `label` `fontWeight`: `600` → `500`; `color`: `"#171717"` → `"#404040"`
9. Number input `width`: `"120px"` → `"140px"`; vertical padding `"8px"` → `"9px"`; add `minHeight: "44px"`
10. Add FAFAFA header bar to each section card: inside each `ConfigSection` (or equivalent section wrapper), add a header bar before the fields:
    ```
    backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", padding: "12px 20px"
    ```
    containing the section title; body content gets `padding: "20px"`.
    **Do NOT change the per-field save button behavior — keep existing save logic intact.**
