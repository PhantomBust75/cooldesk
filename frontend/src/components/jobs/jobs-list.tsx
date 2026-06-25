"use client";

import { StatusChip } from "@/components/ui/status-chip";
import {
  JobTypeChip,
  BrandSwatch,
  SourceChip,
  TagChip,
} from "@/components/ui/job-type-chip";
import { useAuth } from "@/contexts/auth-context";
import { isTerminalStatus } from "@/lib/job-status-groups";
import { fetchJobs } from "@/lib/api/jobs";
import { fetchOfficeTechnicians } from "@/lib/api/office";
import { fetchOfficeBrands } from "@/lib/api/operations";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import type { JobListFilter, JobListQuery } from "@/types/jobs";
import {
  Briefcase,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
  if (!scheduledAt) return "—";
  try {
    return new Date(scheduledAt).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function JobsList() {
  const { session } = useAuth();
  const router = useRouter();
  const isMobile = useMobileBreakpoint();
  const isTechnician = session?.user.role === "technician";

  // Applied filter state (what actually goes to the API)
  const [filter, setFilter] = useState<JobListFilter>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Drawer open/close
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  // Inline filter state (applies immediately, no Apply button)
  const [inlineStatus, setInlineStatus] = useState("");
  const [inlineType, setInlineType] = useState<"" | "installation" | "complaint">("");
  const [inlineBrandId, setInlineBrandId] = useState("");
  const [inlineChronic, setInlineChronic] = useState(false);

  // Draft filter state inside the drawer (applied on "Apply")
  const [draftStatuses, setDraftStatuses] = useState<string[]>([]);
  const [draftType, setDraftType] = useState<"" | "installation" | "complaint">(
    ""
  );
  const [draftTechnicianId, setDraftTechnicianId] = useState("");
  const [draftBrandId, setDraftBrandId] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

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

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", queryInput],
    queryFn: () => fetchJobs(queryInput),
  });

  const techniciansQuery = useQuery({
    queryKey: ["office-technicians"],
    queryFn: () => fetchOfficeTechnicians(),
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

  function openDrawer() {
    // Sync draft state from current applied filter
    setDraftStatuses(filter.status ? [filter.status] : []);
    setDraftType((filter.type as "" | "installation" | "complaint") ?? "");
    setDraftTechnicianId(filter.technicianId ?? "");
    setDraftBrandId(filter.brandId ?? "");
    setDraftDateFrom(filter.dateFrom ?? "");
    setDraftDateTo(filter.dateTo ?? "");
    setFiltersDrawerOpen(true);
  }

  function applyFilters() {
    setFilter({
      status: draftStatuses.length === 1 ? draftStatuses[0] : undefined,
      type: draftType || undefined,
      technicianId: draftTechnicianId || undefined,
      brandId: draftBrandId || undefined,
      dateFrom: draftDateFrom || undefined,
      dateTo: draftDateTo || undefined,
    });
    setPage(1);
    setFiltersDrawerOpen(false);
  }

  function clearFilters() {
    setDraftStatuses([]);
    setDraftType("");
    setDraftTechnicianId("");
    setDraftBrandId("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setFilter({});
    setSearch("");
    setPage(1);
    setFiltersDrawerOpen(false);
  }

  function toggleDraftStatus(status: string) {
    setDraftStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
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
          alignItems: "flex-start",
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
            All jobs
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>
            {total} jobs
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={openDrawer}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
              backgroundColor: "#fff",
              color: "#404040",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <SlidersHorizontal size={14} strokeWidth={1.5} /> Filters
          </button>
          {!isTechnician ? (
            <Link
              href="/log-new-job"
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                padding: "7px 14px",
                backgroundColor: "#0A0A0A",
                color: "#fff",
                textDecoration: "none",
                fontSize: "13px",
              }}
            >
              Log new job
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Technician tab bar ─────────────────────────────── */}
      {isTechnician ? (
        <div
          style={{
            display: "flex",
            gap: "4px",
            borderBottom: "1px solid #E5E5E5",
            paddingBottom: "0",
            padding: "0 24px",
            marginBottom: "16px",
          }}
        >
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

      {/* ── Search input ───────────────────────────────────── */}
      <div
        style={{
          padding: "0 24px 16px",
          position: "relative",
        }}
      >
        <Search
          size={14}
          strokeWidth={1.5}
          style={{
            position: "absolute",
            left: "34px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#737373",
            pointerEvents: "none",
          }}
        />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, job ID, brand…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 12px 9px 34px",
            border: "1px solid #E5E5E5",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#171717",
            outline: "none",
          }}
        />
      </div>

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
            color: "#737373",
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
                <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                  {[
                    "JOB ID",
                    "CUSTOMER",
                    "PHONE",
                    "TYPE",
                    "SOURCE",
                    "BRAND",
                    "TECHNICIAN",
                    "SCHEDULED",
                    "STATUS",
                    "TAGS",
                  ].map((heading) => (
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
              <tbody>
                {displayedJobs.map((job) => (
                  <tr
                    key={job.id}
                    style={{
                      borderBottom: "1px solid #F5F5F5",
                      cursor: "pointer",
                    }}
                    onClick={() => window.location.assign(`/jobs/${job.id}`)}
                  >
                    {/* JOB ID */}
                    <td
                      style={{
                        padding: "14px 16px",
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "12px",
                        color: "#525252",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.id.slice(0, 8)}
                    </td>
                    {/* CUSTOMER */}
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "#171717",
                        fontSize: "13px",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.customerName}
                    </td>
                    {/* PHONE */}
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "#525252",
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.phone || "—"}
                    </td>
                    {/* TYPE */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <JobTypeChip type={job.type} />
                    </td>
                    {/* SOURCE */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <SourceChip
                        source={job.source}
                        dealerName={job.dealerName ?? undefined}
                      />
                    </td>
                    {/* BRAND */}
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "#525252",
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.brandName ?? "—"}
                    </td>
                    {/* TECHNICIAN */}
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.assignedTechnicianName ? (
                        <span style={{ color: "#404040" }}>
                          {job.assignedTechnicianName}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "#737373",
                            fontStyle: "italic",
                          }}
                        >
                          Unassigned
                        </span>
                      )}
                    </td>
                    {/* SCHEDULED */}
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "#525252",
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                      }}
                    >
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

      {/* ── Filter drawer backdrop ─────────────────────────── */}
      {filtersDrawerOpen ? (
        <div
          onClick={() => setFiltersDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 39,
            backgroundColor: "rgba(0,0,0,0.2)",
          }}
        />
      ) : null}

      {/* ── Filter drawer ──────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "320px",
          height: "100vh",
          backgroundColor: "#fff",
          borderLeft: "1px solid #E5E5E5",
          transform: filtersDrawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          zIndex: 40,
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "20px" }}>
          {/* Drawer header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#171717",
              }}
            >
              Filters
            </span>
            <button
              type="button"
              onClick={() => setFiltersDrawerOpen(false)}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                backgroundColor: "#fff",
                cursor: "pointer",
                width: "28px",
                height: "28px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Status multi-select chips */}
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#737373",
                letterSpacing: "0.05em",
                margin: "0 0 8px",
                textTransform: "uppercase",
              }}
            >
              Status
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              {STATUS_OPTIONS.map((status) => {
                const isSelected = draftStatuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleDraftStatus(status)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      border: "1px solid",
                      borderColor: isSelected ? "#0A0A0A" : "#E5E5E5",
                      backgroundColor: isSelected ? "#0A0A0A" : "#F5F5F5",
                      color: isSelected ? "#fff" : "#525252",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: isSelected ? 500 : 400,
                      transition: "all 120ms ease",
                    }}
                  >
                    {formatStatusLabel(status)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type toggle */}
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#737373",
                letterSpacing: "0.05em",
                margin: "0 0 8px",
                textTransform: "uppercase",
              }}
            >
              Type
            </p>
            <div style={{ display: "flex", gap: "6px" }}>
              {(
                [
                  { value: "", label: "All" },
                  { value: "installation", label: "Installation" },
                  { value: "complaint", label: "Complaint" },
                ] as { value: "" | "installation" | "complaint"; label: string }[]
              ).map((opt) => {
                const isSelected = draftType === opt.value;
                return (
                  <button
                    key={opt.value || "all"}
                    type="button"
                    onClick={() => setDraftType(opt.value)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "9999px",
                      border: "1px solid",
                      borderColor: isSelected ? "#0A0A0A" : "#E5E5E5",
                      backgroundColor: isSelected ? "#0A0A0A" : "#F5F5F5",
                      color: isSelected ? "#fff" : "#525252",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: isSelected ? 500 : 400,
                      transition: "all 120ms ease",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand dropdown */}
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#737373",
                letterSpacing: "0.05em",
                margin: "0 0 8px",
                textTransform: "uppercase",
              }}
            >
              Brand
            </p>
            <select
              value={draftBrandId}
              onChange={(e) => setDraftBrandId(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                padding: "9px 12px",
                fontSize: "13px",
                color: "#404040",
                backgroundColor: "#fff",
                outline: "none",
              }}
            >
              <option value="">All brands</option>
              {(brandsQuery.data ?? []).map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* Technician dropdown (non-technician only) */}
          {!isTechnician ? (
            <div style={{ marginBottom: "20px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#737373",
                  letterSpacing: "0.05em",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                }}
              >
                Technician
              </p>
              <select
                value={draftTechnicianId}
                onChange={(e) => setDraftTechnicianId(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  padding: "9px 12px",
                  fontSize: "13px",
                  color: "#404040",
                  backgroundColor: "#fff",
                  outline: "none",
                }}
              >
                <option value="">All technicians</option>
                {(techniciansQuery.data ?? []).map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Date range */}
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#737373",
                letterSpacing: "0.05em",
                margin: "0 0 8px",
                textTransform: "uppercase",
              }}
            >
              Date range
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                type="date"
                value={draftDateFrom}
                onChange={(e) => setDraftDateFrom(e.target.value)}
                placeholder="From"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  padding: "9px 12px",
                  fontSize: "13px",
                  color: "#404040",
                  outline: "none",
                }}
              />
              <input
                type="date"
                value={draftDateTo}
                onChange={(e) => setDraftDateTo(e.target.value)}
                placeholder="To"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  padding: "9px 12px",
                  fontSize: "13px",
                  color: "#404040",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={applyFilters}
              style={{
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                backgroundColor: "#0A0A0A",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              style={{
                border: "none",
                backgroundColor: "transparent",
                color: "#525252",
                fontSize: "13px",
                cursor: "pointer",
                padding: "6px",
              }}
            >
              Clear all
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
