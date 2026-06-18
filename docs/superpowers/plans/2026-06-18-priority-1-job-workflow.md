# Priority 1 — Job Workflow & Role Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make job creation role-aware (dealers get a simplified form, owners/office get optional technician assignment), enforce role-based nav visibility, and give technicians an active-jobs / history split view.

**Architecture:** All changes are frontend-only. The backend already handles dealer source auto-assignment, optional `technicianId` on `CreateJobDto`, and role-based job list filtering. The form at `/log-new-job` detects the user's role via `useAuth()` and conditionally renders fields. A new pure-logic helper module (`job-status-groups.ts`) is extracted and tested to define which statuses are "active" vs "terminal" — this drives the technician tab view.

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Query v5, Vitest 4, TypeScript, Lucide icons

## Global Constraints

- No backend changes in this plan — all API endpoints and DTOs already support the required inputs
- Use `useAuth()` from `@/contexts/auth-context` for role detection
- Style with inline styles only — no Tailwind, no CSS modules; match existing palette: `#0A0A0A` buttons, `#E5E5E5` borders, `#FAFAFA` backgrounds, `#171717` headings, `#737373` muted text, `#525252` secondary text, `13px` body, `12px` labels
- `fetchOfficeTechnicians` is imported from `@/lib/api/office` — use it for the technician assignment dropdown
- Test runner: `cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx vitest run`
- Type-check: `cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/job-status-groups.ts` | **Create** | Pure helpers: `isTerminalStatus(status)`, `TERMINAL_STATUSES` constant |
| `src/lib/job-status-groups.test.ts` | **Create** | Unit tests for the above |
| `src/types/operations.ts` | **Modify** | Add `technicianId?: string` to `QuickCreateJobInput` |
| `src/components/layout/sidebar.tsx` | **Modify** | Rename "Pending Schedule", add "History" for technicians, fix role visibility |
| `src/components/layout/app-shell.tsx` | **Modify** | Hide "Log new job" button for technician role |
| `src/app/(protected)/log-new-job/page.tsx` | **Modify** | Role-aware wizard: dealer=3-step, owner/office=4-step with technician assignment |
| `src/components/jobs/jobs-list.tsx` | **Modify** | Add technician tab switcher (Active / History); pass technicianId pre-filter |
| `src/app/(protected)/jobs/history/page.tsx` | **Create** | Technician history page (terminal-status jobs) |

---

## Task 1: Job Status Groups Helper

**Files:**
- Create: `src/lib/job-status-groups.ts`
- Create: `src/lib/job-status-groups.test.ts`

**Interfaces:**
- Produces: `TERMINAL_STATUSES: readonly string[]`, `isTerminalStatus(status: string): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/job-status-groups.test.ts
import { describe, expect, it } from "vitest";
import { isTerminalStatus, TERMINAL_STATUSES } from "@/lib/job-status-groups";

describe("isTerminalStatus", () => {
  it("returns true for completed", () => {
    expect(isTerminalStatus("completed")).toBe(true);
  });

  it("returns true for resolved", () => {
    expect(isTerminalStatus("resolved")).toBe(true);
  });

  it("returns true for resolved_on_revisit", () => {
    expect(isTerminalStatus("resolved_on_revisit")).toBe(true);
  });

  it("returns true for cancelled", () => {
    expect(isTerminalStatus("cancelled")).toBe(true);
  });

  it("returns false for active statuses", () => {
    expect(isTerminalStatus("assigned")).toBe(false);
    expect(isTerminalStatus("in_process")).toBe(false);
    expect(isTerminalStatus("pending_schedule")).toBe(false);
    expect(isTerminalStatus("scheduled")).toBe(false);
    expect(isTerminalStatus("acknowledged")).toBe(false);
    expect(isTerminalStatus("in_transit")).toBe(false);
    expect(isTerminalStatus("needs_revisit")).toBe(false);
    expect(isTerminalStatus("revisit_scheduled")).toBe(false);
    expect(isTerminalStatus("new")).toBe(false);
  });

  it("TERMINAL_STATUSES contains the four terminal values", () => {
    expect(TERMINAL_STATUSES).toContain("completed");
    expect(TERMINAL_STATUSES).toContain("resolved");
    expect(TERMINAL_STATUSES).toContain("resolved_on_revisit");
    expect(TERMINAL_STATUSES).toContain("cancelled");
    expect(TERMINAL_STATUSES).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx vitest run src/lib/job-status-groups.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/job-status-groups'"

- [ ] **Step 3: Implement the helper**

```typescript
// src/lib/job-status-groups.ts
export const TERMINAL_STATUSES = ["completed", "resolved", "resolved_on_revisit", "cancelled"] as const;

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx vitest run src/lib/job-status-groups.test.ts
```

Expected: PASS — all 9 assertions green

- [ ] **Step 5: Add `technicianId` to `QuickCreateJobInput`**

In `src/types/operations.ts`, find the `QuickCreateJobInput` type and add the new field:

```typescript
export type QuickCreateJobInput = {
  type: "installation" | "complaint";
  source: "direct" | "via_dealer";
  brandId: string;
  customerName: string;
  phone: string;
  address: string;
  issueDescription?: string;
  installationNotes?: string;
  dealerId?: string;
  scheduledAt?: string;
  technicianId?: string;                 // ← add this line
  units?: Array<{ label: string; notes?: string }>;
};
```

- [ ] **Step 6: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && git add src/lib/job-status-groups.ts src/lib/job-status-groups.test.ts ../frontend/src/types/operations.ts
git add src/lib/job-status-groups.ts src/lib/job-status-groups.test.ts src/types/operations.ts
git commit -m "feat: add job status groups helper and technicianId to QuickCreateJobInput"
```

---

## Task 2: Sidebar & App Shell Role Updates

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `session.user.role: UserRole`
- Produces: updated nav visible to each role; no "Log new job" button for technician

- [ ] **Step 1: Update `NAV_ITEMS` in `sidebar.tsx`**

Replace the entire `NAV_ITEMS` constant with:

```typescript
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/jobs/history", label: "History", icon: Clock, roles: ["technician"] },
  { href: "/pending-schedule", label: "Schedule & Assign", icon: Clock, roles: ["owner", "office_staff"] },
  { href: "/technicians", label: "Technicians", icon: Users, roles: ["owner", "office_staff"] },
  { href: "/dealer-management", label: "Dealers", icon: Building2, roles: ["owner", "office_staff"] },
  { href: "/analytics", label: "Analytics", icon: BarChart2, roles: ["owner", "office_staff"] },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/payment-methods", label: "Payment Methods", icon: CreditCard, roles: ["owner"] },
  { href: "/admin/brands", label: "Admin", icon: Settings, roles: ["owner"] },
];
```

Note: The `Clock` icon is already imported. Two items use it — that is intentional.

- [ ] **Step 2: Hide "Log new job" in app-shell for technician**

In `src/components/layout/app-shell.tsx`, find the `Link` component that renders "Log new job" (around the header area). Wrap it with a role check using the `session` already available in that component:

```typescript
{session?.user.role !== "technician" ? (
  <Link
    href="/log-new-job"
    style={{
      border: "1px solid #E5E5E5",
      borderRadius: "8px",
      padding: "7px 12px",
      backgroundColor: "#fff",
      color: "#404040",
      fontSize: "13px",
      textDecoration: "none",
    }}
  >
    Log new job
  </Link>
) : null}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/app-shell.tsx
git commit -m "feat: rename Pending Schedule to Schedule & Assign, add History nav for technicians, hide Log New Job for technicians"
```

---

## Task 3: Role-Aware Log New Job Form

**Files:**
- Modify: `src/app/(protected)/log-new-job/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `session.user.role`
- Consumes: `fetchOfficeTechnicians` from `@/lib/api/office` → `OfficeTechnician[]`
- Consumes: `QuickCreateJobInput` (now with `technicianId?: string` from Task 1)
- Produces: role-aware 3-step form for dealers, 4-step form for owner/office with technician dropdown

The full replacement for `src/app/(protected)/log-new-job/page.tsx`:

- [ ] **Step 1: Add `useAuth` import and fetch technicians for owner/office**

At the top of the file, add to existing imports:

```typescript
import { useAuth } from "@/contexts/auth-context";
import { fetchOfficeTechnicians } from "@/lib/api/office";
```

- [ ] **Step 2: Declare role-derived constants inside `LogNewJobPage`**

At the top of the `LogNewJobPage` function body, after the existing hooks, add:

```typescript
const { session } = useAuth();
const isDealer = session?.user.role === "dealer";
const canAssign = session?.user.role === "owner" || session?.user.role === "office_staff";
const totalSteps: Step = isDealer ? 3 : 4;
```

- [ ] **Step 3: Add technician state and query**

After the existing `const [scheduledAt, setScheduledAt] = useState("")` line, add:

```typescript
const [technicianId, setTechnicianId] = useState("");

const techniciansQuery = useQuery({
  queryKey: ["office", "technicians", "job-create"],
  queryFn: fetchOfficeTechnicians,
  enabled: canAssign,
});
```

- [ ] **Step 4: Update `onSubmit` to include `technicianId` and handle dealer source**

Replace the payload construction inside `onSubmit` with:

```typescript
const payload: QuickCreateJobInput = {
  ...form,
  source: isDealer ? "via_dealer" : form.source,
  dealerId: isDealer ? undefined : (form.source === "via_dealer" ? form.dealerId : undefined),
  issueDescription: form.type === "complaint" ? form.issueDescription : undefined,
  installationNotes: form.type === "installation" ? form.installationNotes : undefined,
  scheduledAt: !isDealer && form.type === "installation" && scheduledAt ? scheduledAt : undefined,
  technicianId: !isDealer && technicianId ? technicianId : undefined,
  units: units
    .filter((u) => u.model.trim())
    .flatMap((u) =>
      Array.from({ length: Math.max(1, u.num_units) }, () => ({
        label: [u.model.trim(), u.unit_type.trim()].filter(Boolean).join(" – "),
      })),
    ),
};
```

- [ ] **Step 5: Update step validation — `step1Valid` for dealers skips source**

Replace the existing validation constants:

```typescript
const step1Valid = isDealer
  ? Boolean(form.type)
  : Boolean(form.type && form.source && (!dealerRequired || form.dealerId));
const step2Valid = Boolean(form.customerName && form.phone && form.address);
const step3Valid = Boolean(
  form.brandId &&
    (form.type === "complaint" ? form.issueDescription?.trim() : true) &&
    units.every((unit) => unit.model.trim() && unit.unit_type.trim()),
);
```

- [ ] **Step 6: Update Step Header and step count display**

In the JSX, change:

```typescript
<p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
  Step {step} of 4
</p>
```

to:

```typescript
<p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
  Step {step} of {totalSteps}
</p>
```

And update `<StepHeader current={step} total={4} />` to:

```typescript
<StepHeader current={step} total={totalSteps} />
```

- [ ] **Step 7: Update Step 1 JSX — hide source/dealer fields for dealers**

In the `{step === 1 ? (` block, wrap the source and dealer fields so dealers don't see them:

```typescript
{step === 1 ? (
  <div>
    <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>
      Job type{isDealer ? "" : " & source"}
    </h2>
    <div style={{ marginBottom: "20px" }}>
      <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>
        Job type <span style={{ color: "#EF4444" }}>*</span>
      </label>
      <div style={{ display: "flex", gap: "10px" }}>
        {(["installation", "complaint"] as const).map((type) => (
          <label key={type} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", border: `1px solid ${form.type === type ? "#0A0A0A" : "#E5E5E5"}`, borderRadius: "8px", cursor: "pointer", backgroundColor: form.type === type ? "#FAFAFA" : "#fff" }}>
            <input type="radio" name="jobType" value={type} checked={form.type === type} onChange={() => setForm((prev) => ({ ...prev, type }))} style={{ display: "none" }} />
            <span style={{ fontSize: "13px", fontWeight: form.type === type ? 500 : 400, color: form.type === type ? "#0A0A0A" : "#525252", textTransform: "capitalize" }}>{type}</span>
          </label>
        ))}
      </div>
    </div>

    {!isDealer ? (
      <>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>
            Source <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            {(["direct", "via_dealer"] as const).map((source) => (
              <label key={source} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", border: `1px solid ${form.source === source ? "#0A0A0A" : "#E5E5E5"}`, borderRadius: "8px", cursor: "pointer", backgroundColor: form.source === source ? "#FAFAFA" : "#fff" }}>
                <input type="radio" name="source" value={source} checked={form.source === source} onChange={() => setForm((prev) => ({ ...prev, source }))} style={{ display: "none" }} />
                <span style={{ fontSize: "13px", fontWeight: form.source === source ? 500 : 400, color: form.source === source ? "#0A0A0A" : "#525252" }}>{source === "direct" ? "Direct" : "Via dealer"}</span>
              </label>
            ))}
          </div>
        </div>

        {dealerRequired ? (
          <div>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>
              Dealer <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <select value={form.dealerId ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, dealerId: event.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717" }}>
              <option value="">Select dealer…</option>
              {(dealersQuery.data ?? []).filter((dealer) => dealer.isActive).map((dealer) => (
                <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
              ))}
            </select>
          </div>
        ) : null}
      </>
    ) : null}
  </div>
) : null}
```

- [ ] **Step 8: Update Step 3 JSX — add technician dropdown for owner/office, skip scheduledAt for dealers**

Inside the `{step === 3 ? (` block, after the existing `scheduledAt` input (which is already wrapped in `{form.type === "installation" ? ...}`), add the technician assignment block. The scheduledAt block stays but gains a dealer check:

```typescript
{!isDealer && form.type === "installation" ? (
  <div>
    <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>
      Scheduled at <span style={{ color: "#A3A3A3", fontWeight: 400 }}>(optional)</span>
    </label>
    <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717" }} />
  </div>
) : null}

{canAssign ? (
  <div>
    <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>
      Assign technician <span style={{ color: "#A3A3A3", fontWeight: 400 }}>(optional)</span>
    </label>
    <select
      value={technicianId}
      onChange={(event) => setTechnicianId(event.target.value)}
      style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717" }}
    >
      <option value="">No assignment — goes to queue</option>
      {(techniciansQuery.data ?? []).map((tech) => (
        <option key={tech.id} value={tech.id}>
          {tech.name} ({tech.activeAssignments} active)
        </option>
      ))}
    </select>
    {!technicianId || !scheduledAt ? (
      <p style={{ fontSize: "12px", color: "#737373", margin: "4px 0 0" }}>
        Job will enter the Schedule &amp; Assign queue if technician or schedule is missing.
      </p>
    ) : null}
  </div>
) : null}
```

- [ ] **Step 9: Update Step 4 navigation — for dealers step 3 is the last step before review**

The navigation buttons at the bottom already use `step < 4` for "Next" vs "Submit". Update this to use `totalSteps`:

Replace `step < 4 ?` with `step < totalSteps ?` in both the Next button condition and its `disabled` condition, and in the Back button. Full nav block replacement:

```typescript
<div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #E5E5E5" }}>
  {step > 1 ? (
    <button type="button" onClick={() => setStep((current) => (current - 1) as Step)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#404040" }}>
      <ArrowLeft size={13} strokeWidth={1.5} /> Back
    </button>
  ) : <div />}

  {step < totalSteps ? (
    <button
      type="button"
      onClick={() => setStep((current) => (current + 1) as Step)}
      disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid) || (step === 3 && !step3Valid)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px", opacity: (step === 1 && !step1Valid) || (step === 2 && !step2Valid) || (step === 3 && !step3Valid) ? 0.45 : 1 }}
    >
      Next <ArrowRight size={13} strokeWidth={1.5} />
    </button>
  ) : (
    <button type="submit" disabled={!canSubmit || createMutation.isPending} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px", opacity: !canSubmit || createMutation.isPending ? 0.45 : 1 }}>
      {createMutation.isPending ? "Creating..." : "Create job"}
    </button>
  )}
</div>
```

Note: The `Step` type is currently `1 | 2 | 3 | 4`. For dealers the max is 3. The type cast `(current + 1) as Step` still works since 3 is a valid Step value.

- [ ] **Step 10: Update review rows for dealer (no schedule/technician in review)**

In the `reviewRows` array, add a conditional row for technician assignment visible only to owner/office:

```typescript
const reviewRows: Array<[string, string] | null> = [
  ["Job type", form.type || "—"],
  !isDealer ? ["Source", form.source || "—"] : null,
  !isDealer ? ["Dealer", form.dealerId ? (dealersQuery.data ?? []).find((dealer) => dealer.id === form.dealerId)?.name ?? "—" : "N/A"] : null,
  ["Customer", form.customerName || "—"],
  ["Phone", form.phone || "—"],
  ["Address", form.address || "—"],
  ["Brand", form.brandId ? (brandsQuery.data ?? []).find((brand) => brand.id === form.brandId)?.name ?? "—" : "—"],
  !isDealer && form.type === "installation" ? ["Scheduled at", scheduledAt || "Pending schedule"] : null,
  canAssign && technicianId ? ["Technician", (techniciansQuery.data ?? []).find((t) => t.id === technicianId)?.name ?? "—"] : null,
  form.type === "complaint" ? ["Issue", form.issueDescription || "—"] : null,
];
```

- [ ] **Step 11: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 12: Manual verification — start dev server**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npm run dev
```

Log in as:
1. **Dealer account** — verify: step count shows "Step 1 of 3", no source/dealer/technician/schedule fields, job submits successfully and lands in Schedule & Assign queue
2. **Owner account** — verify: all 4 steps present, technician dropdown appears in step 3, submitting with both technician + schedule creates a scheduled job, submitting without them creates pending_schedule

- [ ] **Step 13: Commit**

```bash
git add src/app/\(protected\)/log-new-job/page.tsx
git commit -m "feat: make log-new-job form role-aware — dealer simplified 3-step, owner/office add optional technician assignment"
```

---

## Task 4: Technician Jobs List with Tab Switcher

**Files:**
- Modify: `src/components/jobs/jobs-list.tsx`

**Interfaces:**
- Consumes: `isTerminalStatus` from `@/lib/job-status-groups` (Task 1)
- Consumes: `useAuth()` → `session.user.role`, `session.user.userId`
- Produces: tab switcher UI for technicians; active jobs tab filters out terminal-status jobs client-side

- [ ] **Step 1: Add imports to `jobs-list.tsx`**

At the top of `src/components/jobs/jobs-list.tsx`, add:

```typescript
import { useAuth } from "@/contexts/auth-context";
import { isTerminalStatus } from "@/lib/job-status-groups";
import { useRouter } from "next/navigation";
```

- [ ] **Step 2: Add role detection and tab state inside `JobsList`**

At the top of the `JobsList` function body, add:

```typescript
const { session } = useAuth();
const router = useRouter();
const isTechnician = session?.user.role === "technician";
const isDealer = session?.user.role === "dealer";
```

- [ ] **Step 3: Pre-set technician filter when role is technician**

Modify the initial query construction. The technicians filter panel should be hidden for technicians (they only see their own jobs). Replace the `queryInput` memo with:

```typescript
const queryInput = useMemo<JobListQuery>(
  () => ({
    ...filter,
    search: search.trim() || undefined,
    technicianId: isTechnician ? session?.user.userId : filter.technicianId,
    page,
    limit: PAGE_SIZE,
  }),
  [filter, search, page, isTechnician, session?.user.userId],
);
```

- [ ] **Step 4: Filter displayed jobs client-side for technician active view**

After the `useQuery` call for `data`, add a derived value:

```typescript
const displayedJobs = useMemo(() => {
  const jobs = data?.jobs ?? [];
  if (!isTechnician) return jobs;
  return jobs.filter((job) => !isTerminalStatus(job.status));
}, [data?.jobs, isTechnician]);
```

- [ ] **Step 5: Add the tab switcher JSX for technicians**

In the JSX, find the `<h1>Jobs</h1>` heading area. After the `<h1>` + subtitle `<p>` block, and before the filter panel, add:

```typescript
{isTechnician ? (
  <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid #E5E5E5", paddingBottom: "0" }}>
    <button
      type="button"
      style={{
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#171717",
        backgroundColor: "transparent",
        border: "none",
        borderBottom: "2px solid #0A0A0A",
        cursor: "pointer",
        marginBottom: "-1px",
      }}
    >
      Active jobs
    </button>
    <button
      type="button"
      onClick={() => router.push("/jobs/history")}
      style={{
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 400,
        color: "#737373",
        backgroundColor: "transparent",
        border: "none",
        borderBottom: "2px solid transparent",
        cursor: "pointer",
        marginBottom: "-1px",
      }}
    >
      History
    </button>
  </div>
) : null}
```

- [ ] **Step 6: Replace `data?.jobs` with `displayedJobs` in the table render**

Find every reference to `data?.jobs` used in rendering the table rows and replace with `displayedJobs`. Also hide the technician filter dropdown from the filters panel for technicians (they don't need to filter by technician since they only see their own):

In the filter panel section, wrap the technician select with `{!isTechnician ? (...) : null}`.

Also hide the "Log new job" button that appears inside `JobsList` on the error and empty states for technician role:

```typescript
{!isTechnician ? (
  <Link href="/log-new-job" style={{ ... }}>
    Log new job
  </Link>
) : null}
```

(This button appears twice in the file — in the error state render and in the main jobs header. Wrap both.)

- [ ] **Step 7: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/components/jobs/jobs-list.tsx
git commit -m "feat: add technician tab switcher in jobs list, filter active jobs client-side"
```

---

## Task 5: Technician History Page

**Files:**
- Create: `src/app/(protected)/jobs/history/page.tsx`

**Interfaces:**
- Consumes: `isTerminalStatus` from `@/lib/job-status-groups` (Task 1)
- Consumes: `fetchJobs` from `@/lib/api/jobs`
- Consumes: `useAuth()` → `session.user.userId`
- Produces: paginated list of completed/resolved/cancelled jobs for the signed-in technician

- [ ] **Step 1: Create the history page**

```typescript
// src/app/(protected)/jobs/history/page.tsx
"use client";

import { StatusChip } from "@/components/ui/status-chip";
import { JobTypeChip } from "@/components/ui/job-type-chip";
import { useAuth } from "@/contexts/auth-context";
import { RoleGate } from "@/components/auth/role-gate";
import { fetchJobs } from "@/lib/api/jobs";
import { isTerminalStatus } from "@/lib/job-status-groups";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PAGE_SIZE = 10;

export default function JobsHistoryPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", "history", session?.user.userId, page],
    queryFn: () =>
      fetchJobs({
        technicianId: session?.user.userId,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: Boolean(session?.user.userId),
  });

  const historyJobs = useMemo(
    () => (data?.jobs ?? []).filter((job) => isTerminalStatus(job.status)),
    [data?.jobs],
  );

  return (
    <RoleGate allowedRoles={["technician"]}>
      <section style={{ padding: "24px", maxWidth: "1100px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Job History
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>
            Completed and resolved jobs
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid #E5E5E5" }}>
          <button
            type="button"
            onClick={() => router.push("/jobs")}
            style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 400, color: "#737373", backgroundColor: "transparent", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", marginBottom: "-1px" }}
          >
            Active jobs
          </button>
          <button
            type="button"
            style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "#171717", backgroundColor: "transparent", border: "none", borderBottom: "2px solid #0A0A0A", cursor: "pointer", marginBottom: "-1px" }}
          >
            History
          </button>
        </div>

        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "20px", fontSize: "13px", color: "#737373" }}>Loading history…</div>
          ) : historyJobs.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#737373", fontSize: "13px" }}>
              No completed jobs yet.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                  {["Customer", "Type", "Status", "Scheduled", "Completed"].map((heading) => (
                    <th key={heading} style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "#525252" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyJobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: "1px solid #F5F5F5" }}>
                    <td style={{ padding: "14px 12px" }}>
                      <Link href={`/jobs/${job.id}`} style={{ fontSize: "13px", fontWeight: 500, color: "#171717", textDecoration: "none" }}>
                        {job.customerName}
                      </Link>
                      <div style={{ fontSize: "12px", color: "#737373" }}>{job.address}</div>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <JobTypeChip type={job.type} />
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <StatusChip status={job.status} />
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: "13px", color: "#404040" }}>
                      {job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: "13px", color: "#737373" }}>
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {(data?.page?.totalPages ?? 0) > 1 ? (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", fontSize: "13px", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}
            >
              Previous
            </button>
            <span style={{ padding: "6px 12px", fontSize: "13px", color: "#737373" }}>
              Page {page} of {data?.page?.totalPages}
            </span>
            <button
              type="button"
              disabled={page === (data?.page?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", fontSize: "13px", cursor: page === (data?.page?.totalPages ?? 1) ? "default" : "pointer", opacity: page === (data?.page?.totalPages ?? 1) ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </RoleGate>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Manual verification**

Log in as a technician. Navigate to Jobs:
- "Active jobs" tab shows non-terminal jobs assigned to the technician
- Clicking "History" tab navigates to `/jobs/history`
- History page shows completed/resolved/cancelled jobs
- Clicking "Active jobs" on history page navigates back to `/jobs`
- The sidebar "History" item also links to `/jobs/history` correctly

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/frontend && npx vitest run
```

Expected: all tests pass including the new `job-status-groups.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(protected\)/jobs/history/page.tsx
git commit -m "feat: add technician job history page with terminal-status filter and tab navigation"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Dealer form hides source/technician/schedule — Task 3
- [x] Dealer job always enters pending_schedule queue — Task 3 (no technicianId/scheduledAt sent)
- [x] Owner/office: optional technician assignment in step 3 — Task 3
- [x] Owner/office: both set → scheduled, either missing → pending_schedule — Task 3 (backend handles this based on presence of fields)
- [x] "Pending Schedule" renamed to "Schedule & Assign" — Task 2
- [x] Technician sidebar has no "Log new job" button — Task 2
- [x] Technician sees Active jobs + History tabs — Tasks 4 & 5
- [x] Dealer job list shows only their own jobs — Task 4 (backend already filters; no frontend change needed beyond not overriding technicianId)

**No placeholders:** All steps include exact code, exact commands, and expected output.

**Type consistency:**
- `QuickCreateJobInput.technicianId?: string` defined in Task 1, used in Task 3 ✓
- `isTerminalStatus(status: string): boolean` defined in Task 1, used in Tasks 4 & 5 ✓
- `OfficeTechnician` type used in Task 3 via `techniciansQuery.data` — shape is `{ id, name, activeAssignments }` ✓
- `fetchJobs` signature unchanged — Task 4 uses `technicianId` which is already in `JobListQuery` ✓
