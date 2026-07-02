# Sub-project B: Remaining Pages Design Match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixel-perfect alignment of 8 existing frontend pages to the Figma Make design export — visual inline style changes only.

**Architecture:** All changes are inline style edits (`style={{}}`). No new components, no new files, no logic changes.

**Tech Stack:** Next.js 14+, React, TypeScript, inline styles.

## Global Constraints

- All styles must be inline (`style={{}}`). No Tailwind, no CSS modules.
- Do NOT change any API calls, mutations, query hooks, state logic, or component props/signatures.
- Do NOT remove existing functional elements (search bars, per-field save buttons) — keep them.
- Do NOT change System Config's per-field save interaction.
- Do NOT rebuild the Login demo section — only update its existing inline styles.
- TypeScript must pass: `cd frontend && npx tsc --noEmit`
- Tests must pass: `cd frontend && npm run test:run` (74 tests, 12 files)
- Working directory: `/Users/muhammadwasi/Desktop/wasi/cooldesk`

---

### Task 1: Technicians Page

**Files:**
- Modify: `frontend/src/app/(protected)/technicians/page.tsx`

**Changes (5 style edits):**

- [ ] **Step 1: Apply all 5 style changes**

  1. Section `maxWidth`: `"980px"` → `"1100px"`
  2. "Add technician" button `padding`: `"7px 14px"` → `"8px 14px"`
  3. "Add technician" button `border`: `"1px solid #E5E5E5"` → `"none"`
  4. "Add technician" button `color`: `"#FAFAFA"` → `"#fff"`
  5. Subtitle `margin`: `"3px 0 0"` → `"4px 0 0"`

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/app/(protected)/technicians/page.tsx
  git commit -m "feat(ui): align technicians page to design spec"
  ```

---

### Task 2: Job List

**Files:**
- Modify: `frontend/src/components/jobs/jobs-list.tsx`

**Changes (4 style edits):**

- [ ] **Step 1: Apply all 4 style changes**

  1. Table header cells `color`: `"#94A3B8"` → `"#A3A3A3"`
  2. Table header cells `letterSpacing`: `"0.04em"` → `"0.06em"`
  3. Job ID cell `fontSize`: `"12px"` → `"13px"`; `color`: `"#525252"` → `"#171717"`
  4. Customer cell: remove explicit `fontWeight: 500` (let it default to `400`)

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/components/jobs/jobs-list.tsx
  git commit -m "feat(ui): align jobs list table headers and cell typography to design spec"
  ```

---

### Task 3: Login Page

**Files:**
- Modify: `frontend/src/app/(auth)/login/page.tsx`

**Changes (9 style edits):**

- [ ] **Step 1: Apply all style changes**

  1. Card wrapper `padding`: `"32px"` → `"28px"`
  2. H2 `marginBottom`: `"20px"` → `"22px"`
  3. Form container `gap`: `"16px"` → `"14px"`
  4. Email input padding: update vertical from `9px` to `10px` → `"10px 12px"`
  5. Password input padding: `"9px 40px 9px 12px"` → `"10px 12px 10px 40px"`
  6. Both inputs onFocus border/outline color: `"#2563EB"` → `"#A3A3A3"` (this is managed via onFocus/onBlur state — update the focused border color value)
  7. Submit button `padding`: `"10px"` → `"11px"`; add `minHeight: "44px"`
  8. Subtitle text: change `"portal"` → `"platform"` (literal string in JSX)
  9. Demo section: verify `padding: "10px 16px"`, `borderRadius: "8px"`, `backgroundColor: "#F5F5F5"` — update if different; do NOT rebuild as card picker

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/app/(auth)/login/page.tsx
  git commit -m "feat(ui): align login page card, inputs, and button to design spec"
  ```

---

### Task 4: Dealer Management Page

**Files:**
- Modify: `frontend/src/app/(protected)/dealer-management/page.tsx`

**Changes (9 style edits):**

- [ ] **Step 1: Apply all 9 style changes**

  1. Desktop section `padding`: `"32px"` → `"24px"`
  2. `maxWidth`: `"980px"` → `"1100px"`
  3. H1 `fontSize`: `"28px"` → `"36px"`
  4. H1 `fontWeight`: `700` → `600`
  5. Header row `marginBottom`: `"32px"` → `"24px"`
  6. Subtitle `fontSize`: `"14px"` → `"13px"`; `margin`: `"4px 0 0"` → `"3px 0 0"`
  7. "Add dealer" button: `padding`: `"10px 16px"` → `"8px 14px"`; `border`: `"1px solid #0A0A0A"` → `"none"`; `fontSize`: `"14px"` → `"13px"`
  8. Dealer list `gap`: `"12px"` → `"8px"`
  9. Avatar size prop: `44` → `40`; avatar-to-name gap inside card: `"14px"` → `"12px"`

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/app/(protected)/dealer-management/page.tsx
  git commit -m "feat(ui): align dealer management page typography, spacing, and button to design spec"
  ```

---

### Task 5: Dashboard Page

**Files:**
- Modify: `frontend/src/app/(protected)/dashboard/page.tsx`

**Changes (11 style edits):**

- [ ] **Step 1: Apply all 11 style changes**

  1. H1 `fontWeight`: `700` → `600`
  2. H1 `color`: `"#050505"` → `"#0A0A0A"`
  3. H1 `letterSpacing`: unset/`"0"` → `"-0.02em"`
  4. Section titles (`"Needs revisit"`, `"Active jobs"`) `fontSize`: `"16px"` → `"14px"`; `color`: `"#111827"` → `"#171717"`
  5. Table card `border` color: `"#E5E7EB"` → `"#E5E5E5"`
  6. Toolbar `borderBottom` or divider color: `"#E5E7EB"` → `"#E5E5E5"`; `padding`: `"14px 18px"` → `"14px 16px"`
  7. Body cell `borderBottom` color: `"#EEF0F3"` → `"#F1F5F9"`
  8. Body cell `padding`: `"16px 18px"` → `"16px"` (all sides equal)
  9. Customer cell `color`: `"#111827"` → `"#0F172A"`; `fontWeight`: `700` → `600`
  10. Revisit count cell `color`: `"#BE123C"` → `"#9F1239"`; `fontWeight`: `700` → `500`
  11. KPI grid `gap` (desktop): `"14px"` → `"12px"`; grid container `marginBottom`: `"31px"` → `"32px"`

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/app/(protected)/dashboard/page.tsx
  git commit -m "feat(ui): align dashboard H1, section titles, table borders, and KPI grid to design spec"
  ```

---

### Task 6: Analytics Page

**Files:**
- Modify: `frontend/src/app/(protected)/analytics/page.tsx`

**Changes (9 style edits including 1 structural card wrap):**

- [ ] **Step 1: Apply all style changes**

  1. Page `maxWidth`: `"1040px"` → `"1400px"`
  2. Header section `marginBottom`: `"20px"` → `"24px"`
  3. Wrap the tab bar + tab content area in a single card container div:
     ```tsx
     <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden" }}>
       {/* tab bar */}
       {/* tab content panels */}
     </div>
     ```
  4. Tab button `padding`: `"10px 0"` → `"12px 18px"`
  5. Tab button active indicator: replace `borderBottom: "2px solid ..."` with `boxShadow: "inset 0 -2px 0 0 #0A0A0A"` for active; inactive has no border/shadow
  6. Business KPI card `padding`: `"14px"` → `"20px"`
  7. Business KPI value `fontSize`: `"26px"` → `"24px"`
  8. Business KPI grid `gridTemplateColumns`: `"repeat(3, 1fr)"` → `"repeat(4, 1fr)"`
  9. Technician performance table header cells: `fontSize`: `"12px"` → `"13px"`; `color`: `"#737373"` → `"#525252"`; add `fontWeight: 500`

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/app/(protected)/analytics/page.tsx
  git commit -m "feat(ui): align analytics page layout, tab card, KPI grid, and table headers to design spec"
  ```

---

### Task 7: Payment Methods Page

**Files:**
- Modify: `frontend/src/app/(protected)/payment-methods/page.tsx`

**Changes (8 style edits including structural header bar):**

- [ ] **Step 1: Apply all style changes**

  1. Page `maxWidth`: `"880px"` → `"960px"`
  2. Service Items section wrapper `marginBottom`: `"20px"` → `"24px"`
  3. Section title `fontSize`: `"15px"` → `"14px"`; `fontWeight`: `600` → `500`
  4. Service Items table header cells: `padding` → add horizontal so it matches `"10px 16px"`; `fontWeight`: `600` → `500`; remove `textTransform: "uppercase"` and `letterSpacing` if present
  5. Service Items table body cells `padding`: `"12px 0"` → `"13px 16px"`
  6. Apply same section title font changes (#3) to Brands section title
  7. Brands table body cells `padding`: `"12px 0"` → `"13px 16px"`
  8. For Service Items and Brands sections: add a FAFAFA header bar. Inside each section card, before its content, add a header bar div:
     ```tsx
     <div style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", padding: "12px 16px" }}>
       <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{sectionTitle}</span>
       {/* subtitle/description if present */}
     </div>
     ```
     Move the existing title + description into this bar; body content stays below with existing padding.

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/app/(protected)/payment-methods/page.tsx
  git commit -m "feat(ui): align payment methods page maxWidth, section header bars, and table padding to design spec"
  ```

---

### Task 8: System Config Page

**Files:**
- Modify: `frontend/src/app/(protected)/admin/system-config/page.tsx`

**Changes (10 style edits including structural header bar — DO NOT change save logic):**

- [ ] **Step 1: Apply all style changes**

  1. Page `maxWidth`: `"980px"` → `"900px"`
  2. Header section `marginBottom`: `"20px"` → `"24px"`
  3. Info banner `backgroundColor`: `"#F5F5F5"` → `"#FAFAFA"`; `padding`: `"12px 16px"` → `"10px 14px"`
  4. Info banner icon `size`: `16` → `14`; `color`: `"#737373"` → `"#525252"`
  5. Info text `fontSize`: `"12px"` → `"13px"`
  6. Each section card `marginBottom`: `"16px"` → `"20px"`
  7. Section title `fontSize`: `"14px"` → `"13px"`; `fontWeight`: `600` → `500`
  8. Field label `fontWeight`: `600` → `500`; `color`: `"#171717"` → `"#404040"`
  9. Number input `width`: `"120px"` → `"140px"`; vertical padding `"8px"` → `"9px"`; add `minHeight: "44px"`
  10. For each section card: add a FAFAFA header bar before the fields content. Move section title into this bar:
      ```tsx
      <div style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", padding: "12px 20px" }}>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{sectionTitle}</span>
      </div>
      <div style={{ padding: "20px" }}>
        {/* existing fields */}
      </div>
      ```
      **Keep all per-field save buttons exactly as they are — do NOT convert to a single save button.**

- [ ] **Step 2: TypeScript check**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Run tests**
  Run: `cd frontend && npm run test:run`
  Expected: 74/74 pass

- [ ] **Step 4: Commit**
  ```
  git add frontend/src/app/(protected)/admin/system-config/page.tsx
  git commit -m "feat(ui): align system config page banner, section cards, labels, and inputs to design spec"
  ```
