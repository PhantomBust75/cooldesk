"use client";

import { StatusChip } from "@/components/ui/status-chip";
import { DatePicker } from "@/components/ui/date-picker";
import {
  JobTypeChip,
  BrandSwatch,
  SourceChip,
  TagChip,
} from "@/components/ui/job-type-chip";
import { useAuth } from "@/contexts/auth-context";
import { isTerminalStatus } from "@/lib/job-status-groups";
import { fetchJobs, fetchJobsExport } from "@/lib/api/jobs";
import { fetchOfficeBrands } from "@/lib/api/operations";
import { fetchServiceItems } from "@/lib/api/service-items";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import type { JobListFilter, JobListQuery } from "@/types/jobs";
import {
  Briefcase,
  ChevronRight,
  Download,
  Filter,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { formatShortDateTime } from "@/lib/format-date";
import { buildJobsExportCsvText, buildJobsExportFilename, downloadJobsExportCsv } from "@/lib/jobs-export";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "new",
  "pending_schedule",
  "scheduled",
  "assigned",
  "acknowledged",
  "in_transit",
  "in_process",
  "needs_revisit",
  "resolved",
  "completed",
  "cancelled",
];

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScheduled(scheduledAt: string | null): string {
  return formatShortDateTime(scheduledAt);
}

const filterControlStyle: CSSProperties = {
  padding: "6px 10px",
  fontSize: "13px",
  height: "34px",
  border: "1px solid #E5E5E5",
  borderRadius: "8px",
  outline: "none",
  backgroundColor: "#fff",
  color: "#404040",
  cursor: "pointer",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const filterLabelStyle: CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#A3A3A3",
  display: "block",
  marginBottom: "6px",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

/** Measures real content height so the expand/collapse never clips a taller filter row. */
function FilterPanel({ open, children }: { open: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (innerRef.current) setHeight(innerRef.current.scrollHeight);
  }, [open, children]);

  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: open ? `${height}px` : "0px",
        opacity: open ? 1 : 0,
        transition: "max-height 300ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
      }}
    >
      <div ref={innerRef} style={{ transform: open ? "translateY(0)" : "translateY(-6px)", transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)" }}>
        {children}
      </div>
    </div>
  );
}

export function JobsList() {
  const { session } = useAuth();
  const router = useRouter();
  const isMobile = useMobileBreakpoint();
  const isTechnician = session?.user.role === "technician";
  const { enqueueSnackbar } = useSnackbar();
  const [isExporting, setIsExporting] = useState(false);

  // Applied filter state (what actually goes to the API)
  const [filter, setFilter] = useState<JobListFilter>({});
  const [searchInput, setSearchInput] = useState(""); // raw input value
  const [search, setSearch] = useState("");            // debounced value sent to API
  const [page, setPage] = useState(1);

  // 300ms debounce: only fire API when user stops typing
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Inline filter panel toggle
  const [inlineFiltersOpen, setInlineFiltersOpen] = useState(false);

  // Inline filter state (applies immediately, no Apply button)
  const [inlineStatus, setInlineStatus] = useState("");
  const [inlineType, setInlineType] = useState<"" | "installation" | "complaint">("");
  const [inlineBrandId, setInlineBrandId] = useState("");
  const [inlineChronic, setInlineChronic] = useState(false);
  // Raw "YYYY-MM-DD" from DatePicker, converted to PKT day boundaries below.
  // "Created" filters j.created_at; "Scheduled" filters j.scheduled_at — two
  // independent date ranges, matching the reference filter panel.
  const [inlineCreatedFrom, setInlineCreatedFrom] = useState("");
  const [inlineCreatedTo, setInlineCreatedTo] = useState("");
  const [inlineScheduledFrom, setInlineScheduledFrom] = useState("");
  const [inlineScheduledTo, setInlineScheduledTo] = useState("");

  const createdFromIso = inlineCreatedFrom ? `${inlineCreatedFrom}T00:00:00+05:00` : undefined;
  const createdToIso = inlineCreatedTo ? `${inlineCreatedTo}T23:59:59+05:00` : undefined;
  const scheduledFromIso = inlineScheduledFrom ? `${inlineScheduledFrom}T00:00:00+05:00` : undefined;
  const scheduledToIso = inlineScheduledTo ? `${inlineScheduledTo}T23:59:59+05:00` : undefined;

  const queryInput = useMemo<JobListQuery>(
    () => ({
      ...filter,
      status: inlineStatus || filter.status,
      type: (inlineType || filter.type) as JobListQuery["type"],
      brandId: inlineBrandId || filter.brandId,
      chronicOnly: inlineChronic || undefined,
      dateFrom: createdFromIso ?? filter.dateFrom,
      dateTo: createdToIso ?? filter.dateTo,
      scheduledFrom: scheduledFromIso ?? filter.scheduledFrom,
      scheduledTo: scheduledToIso ?? filter.scheduledTo,
      search: search.trim() || undefined,
      technicianId: isTechnician ? session?.user.userId : filter.technicianId,
      page,
      limit: PAGE_SIZE,
    }),
    [
      filter,
      inlineStatus,
      inlineType,
      inlineBrandId,
      inlineChronic,
      createdFromIso,
      createdToIso,
      scheduledFromIso,
      scheduledToIso,
      search,
      page,
      isTechnician,
      session?.user.userId,
    ]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", queryInput],
    queryFn: () => fetchJobs(queryInput),
  });

  const brandsQuery = useQuery({
    queryKey: ["office-brands"],
    queryFn: () => fetchOfficeBrands(),
  });

  const displayedJobs = useMemo(() => {
    const jobs = data?.jobs ?? [];
    if (!isTechnician) return jobs;
    return jobs.filter((job) => !isTerminalStatus(job.status));
  }, [data?.jobs, isTechnician]);

  const total = isTechnician ? displayedJobs.length : (data?.total ?? 0);
  const totalPages = Math.max(1, data?.page.totalPages ?? 1);
  const safePage = Math.min(page, totalPages);

  function clearFilters() {
    setInlineStatus("");
    setInlineType("");
    setInlineBrandId("");
    setInlineChronic(false);
    setInlineCreatedFrom("");
    setInlineCreatedTo("");
    setInlineScheduledFrom("");
    setInlineScheduledTo("");
    setFilter({});
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const activeFilterCount = [
    inlineStatus,
    inlineType,
    inlineBrandId,
    inlineChronic ? "chronic" : "",
    inlineCreatedFrom,
    inlineCreatedTo,
    inlineScheduledFrom,
    inlineScheduledTo,
  ].filter(Boolean).length;

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const [jobs, serviceItems] = await Promise.all([
        fetchJobsExport({
          status: queryInput.status,
          type: queryInput.type,
          technicianId: queryInput.technicianId,
          brandId: queryInput.brandId,
          dateFrom: queryInput.dateFrom,
          dateTo: queryInput.dateTo,
          scheduledFrom: queryInput.scheduledFrom,
          scheduledTo: queryInput.scheduledTo,
          chronicOnly: queryInput.chronicOnly,
          search: queryInput.search,
        }),
        fetchServiceItems(),
      ]);
      const csvText = buildJobsExportCsvText(jobs, serviceItems);
      // Filename reflects the Created range specifically — that's the field
      // the export's own "Date" column and default row order are built on.
      const filename = buildJobsExportFilename(inlineCreatedFrom || undefined, inlineCreatedTo || undefined);
      downloadJobsExportCsv(csvText, filename);
      enqueueSnackbar(`Exported ${jobs.length} job${jobs.length === 1 ? "" : "s"} to ${filename}`, { variant: "success" });
    } catch {
      enqueueSnackbar("Unable to export jobs to CSV.", { variant: "error" });
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          color: "#737373",
          fontSize: "13px",
        }}
      >
        Loading jobs…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
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
              All jobs
            </h1>
            <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>
              0 jobs
            </p>
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            padding: "48px",
            textAlign: "center",
            color: "#737373",
          }}
        >
          <Briefcase
            size={32}
            strokeWidth={1}
            color="#E5E5E5"
            style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}
          />
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 500,
              color: "#404040",
            }}
          >
            Failed to load jobs.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
            Try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      style={{
        padding: isMobile ? "16px" : "0",
        maxWidth: "1400px",
        width: "100%",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
          padding: "24px 24px 0",
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
            {isTechnician ? "Active Jobs" : "All jobs"}
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>
            {total} jobs
          </p>
        </div>
        {!isTechnician && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "8px 12px", minHeight: "44px", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#737373", fontSize: "13px", cursor: "pointer" }}
              >
                <X size={13} strokeWidth={1.5} /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setInlineFiltersOpen((prev) => !prev)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", minHeight: "44px", border: "1px solid", borderColor: inlineFiltersOpen ? "#0A0A0A" : "#E5E5E5", borderRadius: "8px", backgroundColor: inlineFiltersOpen ? "#0A0A0A" : "#fff", color: inlineFiltersOpen ? "#fff" : "#404040", fontSize: "13px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 150ms ease" }}
            >
              <Filter size={14} strokeWidth={1.5} />
              Filters
              {activeFilterCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "9999px", backgroundColor: inlineFiltersOpen ? "rgba(255,255,255,0.9)" : "#0A0A0A", color: inlineFiltersOpen ? "#0A0A0A" : "#fff", fontSize: "10px", fontWeight: 600 }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", minHeight: "44px", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#404040", fontSize: "13px", fontWeight: 500, cursor: isExporting ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: isExporting ? 0.6 : 1 }}
            >
              <Download size={14} strokeWidth={1.5} />
              {isExporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        )}
      </div>

      {/* ── Search row ─────────────────────────────────────── */}
      <div style={{ padding: "0 24px 16px" }}>
        <div style={{ position: "relative", maxWidth: "380px" }}>
          <Search
            size={14}
            strokeWidth={1.5}
            style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#A3A3A3", pointerEvents: "none" }}
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, job ID, brand…"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717", outline: "none", backgroundColor: "#fff" }}
          />
        </div>
      </div>

      {/* ── Technician: status pill tabs ───────────────────── */}
      {isTechnician ? (
        <div style={{ padding: "0 24px 16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { label: "All", value: "" },
            { label: "Assigned", value: "assigned" },
            { label: "Acknowledged", value: "acknowledged" },
            { label: "In Transit", value: "in_transit" },
            { label: "In Process", value: "in_process" },
          ].map(({ label, value }) => {
            const active = inlineStatus === value;
            return (
              <button
                key={label}
                type="button"
                onClick={() => { setInlineStatus(value); setPage(1); }}
                style={{
                  padding: "6px 16px",
                  borderRadius: "9999px",
                  border: active ? "none" : "1px solid #E5E5E5",
                  backgroundColor: active ? "#0A0A0A" : "#fff",
                  color: active ? "#fff" : "#525252",
                  fontSize: "13px",
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Owner/staff: collapsible filter panel ────────── */
        <div style={{ padding: "0 24px 12px" }}>
          <FilterPanel open={inlineFiltersOpen}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end", padding: "16px", backgroundColor: "#FAFAFA", borderRadius: "10px", border: "1px solid #E5E5E5" }}>
              <div>
                <label style={filterLabelStyle}>Status</label>
                <select value={inlineStatus} onChange={(e) => { setInlineStatus(e.target.value); setPage(1); }} style={filterControlStyle}>
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{formatStatusLabel(s)}</option>))}
                </select>
              </div>

              <div>
                <label style={filterLabelStyle}>Type</label>
                <select value={inlineType} onChange={(e) => { setInlineType(e.target.value as "" | "installation" | "complaint"); setPage(1); }} style={filterControlStyle}>
                  <option value="">All types</option>
                  <option value="installation">Installation</option>
                  <option value="complaint">Complaint</option>
                </select>
              </div>

              <div>
                <label style={filterLabelStyle}>Brand</label>
                <select value={inlineBrandId} onChange={(e) => { setInlineBrandId(e.target.value); setPage(1); }} style={filterControlStyle}>
                  <option value="">All brands</option>
                  {(brandsQuery.data ?? []).map((brand) => (<option key={brand.id} value={brand.id}>{brand.name}</option>))}
                </select>
              </div>

              <div style={{ width: "1px", height: "34px", backgroundColor: "#E5E5E5", alignSelf: "flex-end", flexShrink: 0 }} />

              <div>
                <label style={filterLabelStyle}>Scheduled</label>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <DatePicker value={inlineScheduledFrom} onChange={(v) => { setInlineScheduledFrom(v); setPage(1); }} placeholder="From" />
                  <span style={{ fontSize: "12px", color: "#C4C4C4", flexShrink: 0 }}>→</span>
                  <DatePicker value={inlineScheduledTo} onChange={(v) => { setInlineScheduledTo(v); setPage(1); }} placeholder="To" min={inlineScheduledFrom || undefined} />
                </div>
              </div>

              <div>
                <label style={filterLabelStyle}>Created</label>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <DatePicker value={inlineCreatedFrom} onChange={(v) => { setInlineCreatedFrom(v); setPage(1); }} placeholder="From" />
                  <span style={{ fontSize: "12px", color: "#C4C4C4", flexShrink: 0 }}>→</span>
                  <DatePicker value={inlineCreatedTo} onChange={(v) => { setInlineCreatedTo(v); setPage(1); }} placeholder="To" min={inlineCreatedFrom || undefined} />
                </div>
              </div>

              <label style={{ display: "flex", flexDirection: "column", cursor: "pointer" }}>
                <span style={filterLabelStyle}>Filter</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#737373", userSelect: "none", height: "34px" }}>
                  <input type="checkbox" checked={inlineChronic} onChange={(e) => { setInlineChronic(e.target.checked); setPage(1); }} style={{ width: "14px", height: "14px", cursor: "pointer" }} />
                  Chronic only
                </span>
              </label>
            </div>
          </FilterPanel>
        </div>
      )}

      {/* ── Jobs content ───────────────────────────────────── */}
      {displayedJobs.length === 0 ? (
        <div
          style={{
            margin: "0 24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            padding: "48px",
            textAlign: "center",
            color: "#737373",
          }}
        >
          <Briefcase
            size={32}
            strokeWidth={1}
            color="#E5E5E5"
            style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}
          />
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 500,
              color: "#404040",
            }}
          >
            No jobs found
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
            Try adjusting your filters
          </p>
        </div>
      ) : isMobile ? (
        /* ── Mobile card list ─────────────────────────────── */
        <div
          style={{
            margin: "0 24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            overflow: "hidden",
          }}
        >
          {displayedJobs.map((job, index) => (
            <a
              key={job.id}
              href={`/jobs/${job.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                padding: "14px 16px",
                borderBottom:
                  index < displayedJobs.length - 1
                    ? "1px solid #F5F5F5"
                    : "none",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <StatusChip status={job.status} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <JobTypeChip type={job.type} />
                  <ChevronRight size={14} strokeWidth={1.5} color="#737373" />
                </div>
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#171717",
                  lineHeight: 1.3,
                }}
              >
                {job.customerName}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "#737373",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  #{job.id.slice(0, 8)}
                </span>
                {job.brandName ? (
                  <>
                    <span style={{ fontSize: "11px", color: "#E5E5E5" }}>
                      ·
                    </span>
                    <BrandSwatch name={job.brandName} colorHex={null} />
                  </>
                ) : null}
                {job.phone ? (
                  <>
                    <span style={{ fontSize: "11px", color: "#E5E5E5" }}>
                      ·
                    </span>
                    <span style={{ fontSize: "11px", color: "#737373" }}>
                      {job.phone}
                    </span>
                  </>
                ) : null}
                {job.assignedTechnicianName ? (
                  <>
                    <span style={{ fontSize: "11px", color: "#E5E5E5" }}>
                      ·
                    </span>
                    <span style={{ fontSize: "11px", color: "#737373" }}>
                      {job.assignedTechnicianName}
                    </span>
                  </>
                ) : null}
              </div>
              {job.scheduledAt ? (
                <div style={{ fontSize: "11px", color: "#737373" }}>
                  {formatScheduled(job.scheduledAt)}
                </div>
              ) : null}
            </a>
          ))}
        </div>
      ) : (
        /* ── Desktop table ────────────────────────────────── */
        <div
          style={{
            margin: "0 24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "900px",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E5E5", backgroundColor: "#FAFAFA" }}>
                  {(isTechnician
                    ? ["JOB ID", "CUSTOMER", "TYPE", "BRAND", "SCHEDULED", "STATUS", "TAGS"]
                    : ["JOB ID", "CUSTOMER", "PHONE", "TYPE", "SOURCE", "BRAND", "TECHNICIAN", "SCHEDULED", "STATUS", "TAGS"]
                  ).map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: "11px",
                        color: "#A3A3A3",
                        fontWeight: 500,
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                  <th style={{ width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {displayedJobs.map((job) => (
                  <tr
                    key={job.id}
                    style={{ borderBottom: "1px solid #F5F5F5", cursor: "pointer" }}
                    onClick={() => window.location.assign(`/jobs/${job.id}`)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
                  >
                    {/* JOB ID */}
                    <td style={{ padding: "14px 16px", fontFamily: '"JetBrains Mono", monospace', fontSize: "13px", color: "#171717", whiteSpace: "nowrap" }}>
                      {job.id.slice(0, 8)}
                    </td>
                    {/* CUSTOMER */}
                    <td style={{ padding: "14px 16px", color: "#171717", fontSize: "14px", whiteSpace: "nowrap", borderLeft: job.tags.includes("chronic") ? "2px solid #9F1239" : "2px solid transparent" }}>
                      {job.customerName}
                    </td>
                    {/* PHONE — owner/staff only */}
                    {!isTechnician && (
                      <td style={{ padding: "14px 16px", color: "#525252", fontSize: "13px", whiteSpace: "nowrap" }}>
                        {job.phone || "—"}
                      </td>
                    )}
                    {/* TYPE */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <JobTypeChip type={job.type} />
                    </td>
                    {/* SOURCE — owner/staff only */}
                    {!isTechnician && (
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <SourceChip source={job.source} dealerName={job.dealerName ?? undefined} />
                      </td>
                    )}
                    {/* BRAND */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      {job.brandName ? <BrandSwatch name={job.brandName} colorHex={null} /> : <span style={{ color: "#525252", fontSize: "13px" }}>—</span>}
                    </td>
                    {/* TECHNICIAN — owner/staff only */}
                    {!isTechnician && (
                      <td style={{ padding: "14px 16px", fontSize: "13px", whiteSpace: "nowrap" }}>
                        {job.assignedTechnicianName
                          ? <span style={{ color: "#404040" }}>{job.assignedTechnicianName}</span>
                          : <span style={{ color: "#737373", fontStyle: "italic" }}>Unassigned</span>
                        }
                      </td>
                    )}
                    {/* SCHEDULED */}
                    <td style={{ padding: "14px 16px", color: "#525252", fontSize: "13px", whiteSpace: "nowrap" }}>
                      {formatScheduled(job.scheduledAt)}
                    </td>
                    {/* STATUS */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <StatusChip status={job.status} />
                    </td>
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
                      <ChevronRight size={14} strokeWidth={1.5} color="#737373" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "#737373",
          margin: "12px 24px 24px",
        }}
      >
        <span>
          {data?.total ?? 0} total · showing {displayedJobs.length}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
            style={{
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
              padding: "7px 10px",
              backgroundColor: "#fff",
              color: "#404040",
              fontSize: "12px",
              cursor: safePage <= 1 ? "not-allowed" : "pointer",
              opacity: safePage <= 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span>
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
            style={{
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
              padding: "7px 10px",
              backgroundColor: "#fff",
              color: "#404040",
              fontSize: "12px",
              cursor: safePage >= totalPages ? "not-allowed" : "pointer",
              opacity: safePage >= totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      </div>

    </section>
  );
}
