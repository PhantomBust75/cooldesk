# Jobs Page Figma Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixel-perfect implementation of Figma design for All Jobs list (inline filters, TAGS column, row chevron) and Job Detail (tabbed layout with right sidebar).

**Architecture:** Four sequential tasks — backend first (tag fields + filters), then frontend types/mapper, then the two UI components. Each task commits independently and leaves the app working.

**Tech Stack:** NestJS backend (PostgreSQL), Next.js 14 frontend (React, TanStack Query, inline styles only — no Tailwind/CSS modules), lucide-react icons.

## Global Constraints

- Inline styles only — no CSS classes, Tailwind, or CSS modules
- Color palette: `#0A0A0A` primary, `#171717` text-primary, `#525252` text-secondary, `#737373` text-muted, `#E5E5E5` border, `#F5F5F5` surface-2, `#fff` surface
- No new npm packages
- Preserve existing mobile card layout in jobs-list.tsx unchanged
- Payment and Review tabs show a placeholder — no data wiring
- Reassign technician calls `POST /jobs/:id/reassign` with `{ technicianId, acknowledgeConflict: false }`
- All icon imports from `lucide-react`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/src/modules/jobs/jobs.dto.ts` | Modify | Add `brandId`, `chronicOnly` to `OfficeJobsQueryDto` |
| `backend/src/modules/jobs/jobs.service.ts` | Modify | Add tag cols + brand/chronic filters to `listOfficeJobs`; add actor name JOIN to timeline query |
| `frontend/src/types/jobs.ts` | Modify | Add `tags: string[]` to `JobListItem` and `JobDetail`; `chronicOnly` to `JobListFilter` |
| `frontend/src/lib/api/jobs.ts` | Modify | Map tag booleans → `tags[]`; pass `chronicOnly`; add `reassignTechnician` function |
| `frontend/src/components/jobs/jobs-list.tsx` | Modify | Inline filter bar; TAGS column; row chevron |
| `frontend/src/components/jobs/job-detail.tsx` | Modify | Full tabbed redesign |

---

## Task 1: Backend — tag fields, brand filter, chronicOnly, timeline actor name

**Files:**
- Modify: `backend/src/modules/jobs/jobs.dto.ts` (around line 428)
- Modify: `backend/src/modules/jobs/jobs.service.ts` (around lines 3609–3693 for listOfficeJobs; around line 3766 for timeline)

**Interfaces:**
- Produces: `listOfficeJobs` returns rows with `is_repeat: boolean`, `is_frequent: boolean`, `is_chronic: boolean`; accepts `brandId?: string` and `chronicOnly?: boolean` query params
- Produces: timeline rows include `actor_name: string | null`

- [ ] **Step 1: Add `brandId` and `chronicOnly` to `OfficeJobsQueryDto`**

In `backend/src/modules/jobs/jobs.dto.ts`, find `export class OfficeJobsQueryDto` (line 428) and add after the `limit` field:

```typescript
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  chronicOnly?: boolean;
```

Make sure `IsBoolean` and `Transform` are imported — check the existing imports at the top of the file, add them if missing:
```typescript
import { IsBoolean, Transform } from 'class-validator'; // add to existing import
```

- [ ] **Step 2: Add tag columns + brand/chronic filter to `listOfficeJobs`**

In `backend/src/modules/jobs/jobs.service.ts`, find `async listOfficeJobs` (line 3609).

After the existing `add()` calls (after line 3638 `if (query.search) {…}`), add:
```typescript
    if (query.brandId) add('j.brand_id = :p', query.brandId);
    if (query.chronicOnly) conditions.push('j.is_chronic = TRUE');
```

In the SELECT query (lines 3657–3684), add three columns after `j.version`:
```sql
        j.is_repeat,
        j.is_frequent,
        j.is_chronic,
```

The full SELECT block should end with:
```sql
        j.scheduled_at,
        j.created_at,
        j.version,
        j.is_repeat,
        j.is_frequent,
        j.is_chronic
```

- [ ] **Step 3: Add actor name JOIN to timeline query**

In `backend/src/modules/jobs/jobs.service.ts`, find `async getJobTimeline` (look for `FROM job_timeline jt` around line 3777).

Replace the timeline SELECT and FROM/WHERE block:

```sql
      SELECT
        jt.id,
        jt.event_type,
        jt.actor_user_id,
        jt.actor_dealer_id,
        u.full_name AS actor_name,
        jt.previous_value,
        jt.new_value,
        jt.reason,
        jt.occurred_at
      FROM job_timeline jt
      LEFT JOIN users u ON u.id = jt.actor_user_id
      WHERE jt.job_id = $1
        AND jt.organization_id = $2
      ORDER BY jt.occurred_at ASC
      LIMIT $3
```

- [ ] **Step 4: Restart backend and verify**

```bash
cd /Users/muhammadwasi/Desktop/wasi/cooldesk/backend
npm run start:dev
```

Open browser to `http://localhost:3000/office/jobs?chronicOnly=true` — should return jobs where `is_chronic = true` and each row has `is_repeat`, `is_frequent`, `is_chronic` fields. Check the network tab.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/jobs/jobs.dto.ts backend/src/modules/jobs/jobs.service.ts
git commit -m "feat: add tag columns and chronicOnly filter to listOfficeJobs; add actor name to timeline"
```

---

## Task 2: Frontend types and API mapper

**Files:**
- Modify: `frontend/src/types/jobs.ts`
- Modify: `frontend/src/lib/api/jobs.ts`

**Interfaces:**
- Produces: `JobListItem.tags: string[]`, `JobDetail.tags: string[]`, `JobListFilter.chronicOnly?: boolean`
- Produces: `JobTimelineItem.actorName: string | null`
- Produces: `reassignTechnician(jobId, technicianId): Promise<void>` exported from `jobs.ts`

- [ ] **Step 1: Update types**

In `frontend/src/types/jobs.ts`:

Add `tags: string[]` to `JobListItem` after `version`:
```typescript
export type JobListItem = {
  // ... existing fields ...
  version: number;
  tags: string[];
};
```

Add `tags: string[]` to `JobDetail` after `version`:
```typescript
export type JobDetail = {
  // ... existing fields ...
  version: number;
  tags: string[];
};
```

Add `actorName: string | null` to `JobTimelineItem`:
```typescript
export type JobTimelineItem = {
  id: string;
  eventType: string;
  actorUserId: string | null;
  actorDealerId: string | null;
  actorName: string | null;
  previousValue: unknown;
  newValue: unknown;
  reason: string | null;
  occurredAt: string;
};
```

Add `chronicOnly?: boolean` to `JobListFilter`:
```typescript
export type JobListFilter = {
  status?: string;
  type?: "installation" | "complaint";
  technicianId?: string;
  brandId?: string;
  dateFrom?: string;
  dateTo?: string;
  chronicOnly?: boolean;
};
```

- [ ] **Step 2: Update `mapJobListItem` to derive `tags`**

In `frontend/src/lib/api/jobs.ts`, update `mapJobListItem`:

```typescript
function mapJobListItem(row: UnknownRecord): JobListItem {
  const tags: string[] = [];
  if (row.is_chronic === true) tags.push("chronic");
  if (row.is_frequent === true) tags.push("frequent");
  if (row.is_repeat === true) tags.push("repeat");

  return {
    id: asString(row.id),
    type: (asString(row.type) as JobListItem["type"]) || "installation",
    status: asString(row.status),
    source: (asString(row.source) as JobListItem["source"]) || "direct",
    brandId: asNullableString(row.brand_id),
    brandName: asNullableString(row.brand_name),
    dealerId: asNullableString(row.dealer_id),
    dealerName: asNullableString(row.dealer_name),
    customerName: asString(row.customer_name),
    phone: asString(row.phone),
    address: asString(row.address),
    scheduledAt: asNullableString(row.scheduled_at),
    createdAt: asString(row.created_at),
    assignedTechnicianId: asNullableString(row.assigned_technician_id),
    assignedTechnicianName: asNullableString(row.assigned_technician_name),
    version: asNumber(row.version),
    tags,
  };
}
```

- [ ] **Step 3: Update `mapJobDetail` to derive `tags`**

In `frontend/src/lib/api/jobs.ts`, add the tags derivation inside `mapJobDetail` right after the `hasPayment` line, then add `tags` to the return object:

```typescript
function mapJobDetail(row: UnknownRecord): JobDetail {
  const paymentRecord = asRecord(row.payment);
  const hasPayment = Object.keys(paymentRecord).length > 0;

  const tags: string[] = [];
  if (row.is_chronic === true) tags.push("chronic");
  if (row.is_frequent === true) tags.push("frequent");
  if (row.is_repeat === true) tags.push("repeat");

  return {
    id: asString(row.id),
    type: (asString(row.type) as JobDetail["type"]) || "installation",
    status: asString(row.status),
    source: (asString(row.source) as JobDetail["source"]) || "direct",
    brandId: asNullableString(row.brand_id),
    brandName: asNullableString(row.brand_name),
    dealerId: asNullableString(row.dealer_id),
    dealerName: asNullableString(row.dealer_name),
    customerName: asString(row.customer_name),
    phone: asString(row.phone),
    address: asString(row.address),
    scheduledAt: asNullableString(row.scheduled_at),
    assignedTechnicianId: asNullableString(row.assigned_technician_id),
    assignedTechnicianName: asNullableString(row.assigned_technician_name),
    issueDescription: asNullableString(row.issue_description),
    installationNotes: asNullableString(row.installation_notes),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    version: asNumber(row.version),
    tags,
    payment: hasPayment
      ? {
          id: asString(paymentRecord.id),
          amount: asNumber(paymentRecord.amount),
          paymentMethodId: asNullableString(paymentRecord.payment_method_id),
          paymentMethodName: asNullableString(paymentRecord.payment_method_name),
          status: asString(paymentRecord.status),
          recordedByName: asNullableString(paymentRecord.recorded_by_name),
          recordedAt: asString(paymentRecord.recorded_at),
        }
      : null,
  };
}
```

- [ ] **Step 4: Update `mapTimelineItem` to include `actorName`**

```typescript
function mapTimelineItem(row: UnknownRecord): JobTimelineItem {
  return {
    id: asString(row.id),
    eventType: asString(row.event_type),
    actorUserId: asNullableString(row.actor_user_id),
    actorDealerId: asNullableString(row.actor_dealer_id),
    actorName: asNullableString(row.actor_name),
    previousValue: row.previous_value,
    newValue: row.new_value,
    reason: asNullableString(row.reason),
    occurredAt: asString(row.occurred_at),
  };
}
```

- [ ] **Step 5: Update `fetchJobs` to pass `chronicOnly`**

In `fetchJobs`, add after the existing `if (filter.search)` line:
```typescript
  if (filter.chronicOnly) params.set("chronicOnly", "true");
```

- [ ] **Step 6: Add `reassignTechnician` API function**

At the bottom of `frontend/src/lib/api/jobs.ts`, add:

```typescript
export async function reassignTechnician(
  jobId: string,
  technicianId: string
): Promise<void> {
  await apiClient.post(`/jobs/${jobId}/reassign`, {
    technicianId,
    acknowledgeConflict: false,
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/jobs.ts frontend/src/lib/api/jobs.ts
git commit -m "feat: add tags, actorName, chronicOnly to job types and API mapper"
```

---

## Task 3: All Jobs UI — inline filter bar, TAGS column, row chevron

**Files:**
- Modify: `frontend/src/components/jobs/jobs-list.tsx`

**Interfaces:**
- Consumes: `JobListItem.tags: string[]` (from Task 2)
- Consumes: `JobListFilter.chronicOnly?: boolean` (from Task 2)
- Consumes: `TagChip` from `@/components/ui/job-type-chip`

- [ ] **Step 1: Add inline filter state**

In `jobs-list.tsx`, the `filter` state and `search`/`page` states already exist. Add two new inline-only state vars right after `const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)`:

```typescript
  const [inlineStatus, setInlineStatus] = useState("");
  const [inlineType, setInlineType] = useState<"" | "installation" | "complaint">("");
  const [inlineBrandId, setInlineBrandId] = useState("");
  const [inlineChronic, setInlineChronic] = useState(false);
```

Update `queryInput` to merge inline filters:
```typescript
  const queryInput = useMemo<JobListQuery>(
    () => ({
      ...filter,
      status: inlineStatus || filter.status,
      type: (inlineType || filter.type) as JobListQuery["type"],
      brandId: inlineBrandId || filter.brandId,
      chronicOnly: inlineChronic || undefined,
      search: search.trim() || undefined,
      technicianId: isTechnician ? session?.user.userId : filter.technicianId,
      page,
      limit: PAGE_SIZE,
    }),
    [filter, inlineStatus, inlineType, inlineBrandId, inlineChronic, search, page, isTechnician, session?.user.userId]
  );
```

- [ ] **Step 2: Add inline filter bar JSX**

Add this block in the JSX, between the search `<div>` and the jobs content `<div>` (right after the closing `</div>` of the search container, around line 409):

```tsx
      {/* ── Inline filter bar ─────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 24px 12px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={inlineStatus}
          onChange={(e) => { setInlineStatus(e.target.value); setPage(1); }}
          style={{
            border: "1px solid #E5E5E5",
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "13px",
            color: inlineStatus ? "#171717" : "#737373",
            backgroundColor: "#fff",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{formatStatusLabel(s)}</option>
          ))}
        </select>

        <select
          value={inlineType}
          onChange={(e) => { setInlineType(e.target.value as "" | "installation" | "complaint"); setPage(1); }}
          style={{
            border: "1px solid #E5E5E5",
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "13px",
            color: inlineType ? "#171717" : "#737373",
            backgroundColor: "#fff",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All types</option>
          <option value="installation">Installation</option>
          <option value="complaint">Complaint</option>
        </select>

        <select
          value={inlineBrandId}
          onChange={(e) => { setInlineBrandId(e.target.value); setPage(1); }}
          style={{
            border: "1px solid #E5E5E5",
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "13px",
            color: inlineBrandId ? "#171717" : "#737373",
            backgroundColor: "#fff",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All brands</option>
          {(brandsQuery.data ?? []).map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "#525252",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={inlineChronic}
            onChange={(e) => { setInlineChronic(e.target.checked); setPage(1); }}
            style={{ width: "14px", height: "14px", cursor: "pointer" }}
          />
          Chronic only
        </label>
      </div>
```

- [ ] **Step 3: Add TAGS column header**

In the desktop table `<thead>`, find the array of column headings and add `"TAGS"` before the last entry is rendered. The current array is:
```typescript
["JOB ID", "CUSTOMER", "PHONE", "TYPE", "SOURCE", "BRAND", "TECHNICIAN", "SCHEDULED", "STATUS"]
```

Change it to:
```typescript
["JOB ID", "CUSTOMER", "PHONE", "TYPE", "SOURCE", "BRAND", "TECHNICIAN", "SCHEDULED", "STATUS", "TAGS", ""]
```

The last `""` is the chevron column (no header text). Give it a fixed width:
```tsx
<th key="chevron" style={{ width: "40px" }} />
```

Actually, replace the entire headings map with explicit columns to control widths:

```tsx
<thead>
  <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
    {["JOB ID", "CUSTOMER", "PHONE", "TYPE", "SOURCE", "BRAND", "TECHNICIAN", "SCHEDULED", "STATUS", "TAGS"].map((heading) => (
      <th
        key={heading}
        style={{
          padding: "10px 16px",
          textAlign: "left",
          fontSize: "11px",
          color: "#737373",
          fontWeight: 500,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        {heading}
      </th>
    ))}
    <th style={{ width: "40px" }} />
  </tr>
</thead>
```

- [ ] **Step 4: Add TAGS cell and chevron cell to each row**

In the desktop table `<tbody>`, at the end of each `<tr>` (after the STATUS `<td>`), add:

```tsx
                    {/* TAGS */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {job.tags.map((tag) => (
                          <TagChip key={tag} label={tag.charAt(0).toUpperCase() + tag.slice(1)} variant={tag as "chronic" | "frequent" | "repeat"} />
                        ))}
                      </div>
                    </td>
                    {/* CHEVRON */}
                    <td style={{ padding: "14px 16px", width: "40px" }}>
                      <ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" />
                    </td>
```

Make sure `TagChip` is imported at the top of the file:
```typescript
import {
  JobTypeChip,
  BrandSwatch,
  SourceChip,
  TagChip,
} from "@/components/ui/job-type-chip";
```

- [ ] **Step 5: Verify in browser**

Navigate to `http://localhost:3001/jobs`. You should see:
- Inline filter row (STATUS / TYPE / BRAND dropdowns + Chronic only checkbox) below the search bar
- TAGS column in the table (shows Chronic/Frequent/Repeat chips when data has those flags set)
- Chevron `>` at the end of each row

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/jobs/jobs-list.tsx
git commit -m "feat: add inline filter bar, TAGS column, and row chevron to All Jobs table"
```

---

## Task 4: Job Detail — tabbed layout redesign

**Files:**
- Modify: `frontend/src/components/jobs/job-detail.tsx`

**Interfaces:**
- Consumes: `JobDetail.tags: string[]` (from Task 2)
- Consumes: `JobTimelineItem.actorName: string | null` (from Task 2)
- Consumes: `reassignTechnician(jobId, technicianId)` from `@/lib/api/jobs` (from Task 2)
- Consumes: `fetchOfficeTechnicians` from `@/lib/api/office`

- [ ] **Step 1: Update imports**

Replace the current import block in `job-detail.tsx` with:

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchJobDetail,
  fetchJobRevisits,
  fetchJobTimeline,
  ownerOverrideJobStatus,
  reassignTechnician,
  rollbackJobStatus,
  transitionJobStatus,
  updateJobPayment,
} from "@/lib/api/jobs";
import { fetchOfficeTechnicians } from "@/lib/api/office";
import { useAuth } from "@/contexts/auth-context";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import { fetchPaymentMethods, fetchSystemConfig } from "@/lib/api/operations";
import { ApiError } from "@/lib/api/client";
import { getAllowedNextStatuses } from "@/lib/jobs-state-machine";
import { BrandSwatch, JobTypeChip, SourceChip, TagChip } from "@/components/ui/job-type-chip";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  RotateCcw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
```

- [ ] **Step 2: Add new state variables**

Inside `JobDetail`, after the existing state declarations, add:

```typescript
  const [activeTab, setActiveTab] = useState<"details" | "timeline" | "payment" | "review">("details");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTechId, setReassignTechId] = useState("");
  const [advanceStatusOpen, setAdvanceStatusOpen] = useState(false);
  const [advanceToStatus, setAdvanceToStatus] = useState("");
```

- [ ] **Step 3: Add technicians query and reassign mutation**

After the existing `configQuery`, add:

```typescript
  const techniciansQuery = useQuery({
    queryKey: ["office-technicians"],
    queryFn: fetchOfficeTechnicians,
  });

  const reassignMutation = useMutation({
    mutationFn: () => reassignTechnician(jobId, reassignTechId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setReassignOpen(false);
      setReassignTechId("");
    },
  });
```

- [ ] **Step 4: Replace the entire JSX return with the new layout**

Replace everything from the existing `const canRollbackOneStep` line down through the closing `);` of the return statement. The replacement below starts with pre-return constants, then the full `return (...)`:

```tsx
  const canRollbackOneStep = isOfficeStaff && !TERMINAL_OR_CLOSED.has(detail.status);
  const hasPayment = Boolean(detail.payment);
  const isPaidCompletion = detail.status === "completed" || detail.status === "resolved" || detail.status === "resolved_on_revisit";
  const requiresPaymentDecision = hasPayment && isPaidCompletion;
  const revisitCount = revisitsQuery.data?.length ?? 0;

  // Advance Status logic
  const singleNext = nextStatuses.length === 1 ? nextStatuses[0] : null;

  function handleAdvanceStatus() {
    if (singleNext) {
      setToStatus(singleNext);
      transitionMutation.mutate();
    } else {
      setAdvanceStatusOpen(true);
    }
  }

  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1200px" }}>

      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <div style={{ marginBottom: "16px" }}>
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
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#0A0A0A", letterSpacing: "-0.02em" }}>
            {detail.id.slice(0, 8).toUpperCase()}
          </h1>
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
            <Copy size={14} strokeWidth={1.5} />
          </button>
          <StatusChip status={detail.status} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "13px", color: "#525252" }}>
          {detail.brandName ? <span>{detail.brandName}</span> : null}
          {detail.brandName ? <span>·</span> : null}
          <span>{detail.type === "installation" ? "Installation" : "Complaint"}</span>
          {revisitCount > 0 ? <span>·</span> : null}
          {revisitCount > 0 ? <span>Revisit #{revisitCount}</span> : null}
          {detail.tags.map((tag) => (
            <span key={tag} style={{ color: tag === "chronic" ? "#9F1239" : tag === "frequent" ? "#854D0E" : "#1E293B", fontWeight: 500 }}>
              · {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: "24px", alignItems: "start" }}>

        {/* ── Left column: tabs + content ──────────────────── */}
        <div>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: "24px", borderBottom: "1px solid #E5E5E5", marginBottom: "24px" }}>
            {(["details", "timeline", "payment", "review"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #0A0A0A" : "2px solid transparent",
                  padding: "10px 0",
                  marginBottom: "-1px",
                  fontSize: "14px",
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "#171717" : "#737373",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Details tab */}
          {activeTab === "details" ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "32px", marginBottom: "24px" }}>
                {/* Customer */}
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>Customer</p>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#A3A3A3" }}>Name</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>{detail.customerName}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#A3A3A3" }}>Phone</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>{detail.phone}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#A3A3A3" }}>Address</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>{detail.address}</p>
                    </div>
                  </div>
                </div>
                {/* Schedule */}
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>Schedule</p>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#A3A3A3" }}>Technician</p>
                      <p style={{ margin: 0, fontSize: "13px", color: detail.assignedTechnicianName ? "#171717" : "#737373", fontStyle: detail.assignedTechnicianName ? "normal" : "italic" }}>
                        {detail.assignedTechnicianName ?? "Unassigned"}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#A3A3A3" }}>Scheduled</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>
                        {detail.scheduledAt ? new Date(detail.scheduledAt).toLocaleString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Show technical details */}
              <button
                type="button"
                onClick={() => setShowTechnicalDetails((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#737373", padding: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                {showTechnicalDetails ? <ChevronUp size={13} strokeWidth={1.5} /> : <ChevronDown size={13} strokeWidth={1.5} />}
                {showTechnicalDetails ? "Hide" : "Show"} technical details
              </button>

              {showTechnicalDetails ? (
                <div style={{ marginTop: "12px", display: "grid", gap: "10px", padding: "16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#FAFAFA" }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#A3A3A3", textTransform: "uppercase", letterSpacing: "0.05em" }}>Source</p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#525252" }}>{detail.source === "via_dealer" ? `Via dealer${detail.dealerName ? ` — ${detail.dealerName}` : ""}` : "Direct"}</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#A3A3A3", textTransform: "uppercase", letterSpacing: "0.05em" }}>Version</p>
                    <p style={{ margin: 0, fontSize: "13px", fontFamily: '"JetBrains Mono", monospace', color: "#525252" }}>{detail.version}</p>
                  </div>
                  {detail.type === "complaint" && detail.issueDescription ? (
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#A3A3A3", textTransform: "uppercase", letterSpacing: "0.05em" }}>Issue description</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#525252", lineHeight: 1.6 }}>{detail.issueDescription}</p>
                    </div>
                  ) : null}
                  {detail.type === "installation" && detail.installationNotes ? (
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#A3A3A3", textTransform: "uppercase", letterSpacing: "0.05em" }}>Installation notes</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#525252", lineHeight: 1.6 }}>{detail.installationNotes}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Timeline tab */}
          {activeTab === "timeline" ? (
            <div>
              {timelineQuery.isLoading ? <p style={{ fontSize: "13px", color: "#737373" }}>Loading timeline...</p> : null}
              {timelineQuery.error ? <p style={{ fontSize: "13px", color: "#991B1B" }}>Unable to load timeline.</p> : null}
              {!timelineQuery.isLoading && !timelineQuery.error && timelineQuery.data?.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#737373" }}>No timeline events yet.</p>
              ) : null}
              <div style={{ display: "grid", gap: "12px" }}>
                {timelineQuery.data?.map((event) => {
                  const prevStatus = typeof event.previousValue === "string" ? event.previousValue : null;
                  const nextStatus = typeof event.newValue === "string" ? event.newValue : null;
                  const isStatusChange = event.eventType.toLowerCase().includes("status");

                  return (
                    <div key={event.id} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "12px", alignItems: "start" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: event.actorName === "System" ? "#6B7280" : "#0A0A0A", marginTop: "4px", justifySelf: "center" }} />
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#171717" }}>
                            {event.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span style={{ fontSize: "11px", color: "#A3A3A3", whiteSpace: "nowrap" }}>
                            {new Date(event.occurredAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {event.actorName ? (
                          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#737373" }}>{event.actorName}</p>
                        ) : null}
                        {event.reason ? (
                          <div style={{ margin: "6px 0", padding: "8px 10px", borderRadius: "6px", backgroundColor: "#F9F9F9", border: "1px solid #F1F1F1" }}>
                            <p style={{ margin: 0, fontSize: "13px", color: "#525252", fontStyle: "italic" }}>"{event.reason}"</p>
                          </div>
                        ) : null}
                        {isStatusChange && prevStatus && nextStatus ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                            <StatusChip status={prevStatus} />
                            <span style={{ fontSize: "12px", color: "#A3A3A3" }}>→</span>
                            <StatusChip status={nextStatus} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Payment tab */}
          {activeTab === "payment" ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>Payment details coming soon.</p>
            </div>
          ) : null}

          {/* Review tab */}
          {activeTab === "review" ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>Customer review coming soon.</p>
            </div>
          ) : null}
        </div>

        {/* ── Right sidebar ───────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: isMobile ? "static" : "sticky", top: "24px" }}>

          {/* Advance Status button */}
          {advanceStatusOpen && nextStatuses.length > 1 ? (
            <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "12px", backgroundColor: "#fff" }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#737373" }}>Select next status</p>
              <select
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value)}
                style={{ width: "100%", border: "1px solid #E5E5E5", borderRadius: "8px", padding: "8px", fontSize: "13px", marginBottom: "8px" }}
              >
                <option value="">Choose...</option>
                {nextStatuses.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => { transitionMutation.mutate(); setAdvanceStatusOpen(false); }}
                  disabled={!toStatus || transitionMutation.isPending}
                  style={{ flex: 1, border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px", fontSize: "13px", cursor: "pointer", opacity: !toStatus || transitionMutation.isPending ? 0.5 : 1 }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceStatusOpen(false)}
                  style={{ flex: 1, border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#525252", padding: "9px", fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAdvanceStatus}
              disabled={nextStatuses.length === 0 || transitionMutation.isPending}
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
            >
              {transitionMutation.isPending ? "Updating..." : "Advance Status →"}
            </button>
          )}

          {/* Actions dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
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
            >
              Actions {actionsOpen ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
            </button>
            {actionsOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  backgroundColor: "#fff",
                  border: "1px solid #E5E5E5",
                  borderRadius: "10px",
                  overflow: "hidden",
                  zIndex: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                }}
              >
                {canRollbackOneStep ? (
                  <button
                    type="button"
                    onClick={() => { rollbackMutation.mutate({ reason: "Office rollback" }); setActionsOpen(false); }}
                    disabled={rollbackMutation.isPending}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #F5F5F5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                  >
                    <RotateCcw size={13} strokeWidth={1.5} /> Roll back status
                  </button>
                ) : null}
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => { setOverrideOpen(true); setActionsOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #F5F5F5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                  >
                    <ShieldAlert size={13} strokeWidth={1.5} /> Override status
                  </button>
                ) : null}
                {(isOwner || isOfficeStaff) ? (
                  <button
                    type="button"
                    onClick={() => { setReassignOpen(true); setActionsOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #F5F5F5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                  >
                    <UserRound size={13} strokeWidth={1.5} /> Reassign technician
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => { setActiveTab("payment"); setActionsOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #F5F5F5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                >
                  Manage payment
                </button>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => { setOverrideStatus("cancelled"); setOverrideOpen(true); setActionsOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#991B1B", textAlign: "left" }}
                  >
                    Cancel job
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Payment card */}
          <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "14px", backgroundColor: "#fff" }}>
            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>Payment</p>
            {!detail.payment ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>No payment recorded</p>
            ) : (
              <div style={{ display: "grid", gap: "4px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#171717", fontWeight: 500 }}>₹{detail.payment.amount.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>{detail.payment.paymentMethodName ?? "—"}</p>
              </div>
            )}
          </div>

          {/* Undo banner */}
          {undoSecondsLeft > 0 ? (
            <div style={{ borderRadius: "8px", border: "1px solid #DCFCE7", backgroundColor: "#F0FDF4", padding: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "#166534" }}>Undo available for {undoSecondsLeft}s</span>
                <button
                  type="button"
                  onClick={() => rollbackMutation.mutate({ reason: "Undo transition" })}
                  disabled={rollbackMutation.isPending}
                  style={{ border: "1px solid #BBF7D0", borderRadius: "6px", backgroundColor: "#fff", color: "#166534", fontSize: "12px", padding: "4px 8px", cursor: "pointer" }}
                >
                  Undo
                </button>
              </div>
              <div style={{ height: "4px", borderRadius: "9999px", backgroundColor: "#DCFCE7", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(undoSecondsLeft / Math.max(1, undoWindowSeconds)) * 100}%`, backgroundColor: "#22C55E", transition: "width 1s linear" }} />
              </div>
            </div>
          ) : null}

          {transitionError ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#991B1B", padding: "8px 10px", border: "1px solid #FECACA", borderRadius: "8px", backgroundColor: "#FEF2F2" }}>{transitionError}</p>
          ) : null}
        </div>
      </div>

      {/* ── Reassign modal ─────────────────────────────────── */}
      <Modal isOpen={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign technician">
        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            New technician
            <select
              value={reassignTechId}
              onChange={(e) => setReassignTechId(e.target.value)}
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            >
              <option value="">Select technician</option>
              {(techniciansQuery.data ?? []).filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => reassignMutation.mutate()}
            disabled={!reassignTechId || reassignMutation.isPending}
            style={{ border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "10px 14px", fontSize: "13px", cursor: "pointer", opacity: !reassignTechId || reassignMutation.isPending ? 0.6 : 1 }}
          >
            {reassignMutation.isPending ? "Reassigning..." : "Confirm"}
          </button>
        </div>
      </Modal>

      {/* ── Override modal (owner) ─────────────────────────── */}
      <Modal isOpen={overrideOpen} onClose={() => setOverrideOpen(false)} title="Override status" blocking={requiresPaymentDecision}>
        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            Target status
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            >
              <option value="">Select status</option>
              {OWNER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            Reason
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason is required"
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            />
          </label>
          {requiresPaymentDecision ? (
            <div style={{ borderRadius: "8px", border: "1px solid #FDE68A", backgroundColor: "#FFFBEB", padding: "10px", fontSize: "12px", color: "#92400E", display: "grid", gap: "8px" }}>
              <div>This job has payment recorded. Choose how payment should be handled.</div>
              <div style={{ display: "flex", gap: "12px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input type="radio" checked={paymentDecision === "retain"} onChange={() => setPaymentDecision("retain")} /> Retain payment
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input type="radio" checked={paymentDecision === "void"} onChange={() => setPaymentDecision("void")} /> Void payment
                </label>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => ownerOverrideMutation.mutate()}
            disabled={!overrideStatus || !overrideReason.trim() || ownerOverrideMutation.isPending}
            style={{ border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "10px 14px", fontSize: "13px", cursor: "pointer", opacity: !overrideStatus || !overrideReason.trim() || ownerOverrideMutation.isPending ? 0.6 : 1 }}
          >
            {ownerOverrideMutation.isPending ? "Applying override..." : "Confirm override"}
          </button>
        </div>
      </Modal>
    </section>
  );
```

- [ ] **Step 5: Remove the now-unused `isTransitionLocked` variable and unused imports**

At the top of the computed variables section (before the return), remove the line:
```typescript
const isTransitionLocked = nextStatuses.length === 0;
```
(we use `nextStatuses.length === 0` inline now)

Remove unused imports: `CalendarClock`, `ClipboardList`, `MapPin`, `Phone`, `Wallet`, `Wrench` from lucide-react (they're no longer used in the new JSX).

- [ ] **Step 6: Verify in browser**

Navigate to `http://localhost:3001/jobs`, click any job row. You should see:
- Breadcrumb: `← All jobs / XXXXXXXX`
- Large job ID + copy icon + status chip
- Metadata line with brand · type · Revisit # · tags
- Tab bar: Details | Timeline | Payment | Review
- Details tab: two-column Customer + Schedule layout, "Show technical details" toggle
- Right sidebar: black "Advance Status →" button, "Actions ↓" dropdown, Payment card
- Click Actions → shows Roll back / Override / Reassign / Manage payment / Cancel job
- Click Timeline tab → shows events with actor name, reason quotes, status chip pairs

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/jobs/job-detail.tsx
git commit -m "feat: redesign Job Detail page with tabbed layout and Actions sidebar"
```
