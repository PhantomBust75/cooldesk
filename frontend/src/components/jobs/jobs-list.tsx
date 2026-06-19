"use client";

import { StatusChip } from "@/components/ui/status-chip";
import {
  JobTypeChip,
  BrandSwatch,
  SourceChip,
} from "@/components/ui/job-type-chip";
import { useAuth } from "@/contexts/auth-context";
import { isTerminalStatus } from "@/lib/job-status-groups";
import { fetchJobs } from "@/lib/api/jobs";
import { fetchOfficeTechnicians } from "@/lib/api/office";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import type { JobListFilter, JobListQuery } from "@/types/jobs";
import { Briefcase, ChevronRight, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 10;

export function JobsList() {
  const { session } = useAuth();
  const router = useRouter();
  const isMobile = useMobileBreakpoint();
  const isTechnician = session?.user.role === "technician";
  const isDealer = session?.user.role === "dealer";
  const [filter, setFilter] = useState<JobListFilter>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["jobs", queryInput],
    queryFn: () => fetchJobs(queryInput),
  });

  const techniciansQuery = useQuery({
    queryKey: ["office-technicians"],
    queryFn: () => fetchOfficeTechnicians(),
  });

  const displayedJobs = useMemo(() => {
    const jobs = data?.jobs ?? [];
    if (!isTechnician) return jobs;
    return jobs.filter((job) => !isTerminalStatus(job.status));
  }, [data?.jobs, isTechnician]);

  if (isLoading) return <div>Loading jobs…</div>;
  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
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
              Jobs
            </h1>
            <p
              style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}
            >
              0 jobs
            </p>
          </div>
          {!isTechnician ? (
            <Link
              href="/log-new-job"
              style={{
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
            color="#D4D4D4"
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
            No jobs found.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
            Try adjusting your filters.
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, data?.page.totalPages ?? 1);
  const safePage = Math.min(page, totalPages);

  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1400px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
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
            Jobs
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#737373",
              margin: "3px 0 0",
              fontWeight: 400,
            }}
          >
            {isTechnician ? displayedJobs.length : (data?.total ?? 0)} jobs
          </p>
        </div>
        {!isTechnician ? (
          <Link
            href="/log-new-job"
            style={{
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

      <div
        style={{
          border: "1px solid #E5E5E5",
          borderRadius: "12px",
          backgroundColor: "#fff",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          style={{
            width: "100%",
            padding: "14px 16px",
            backgroundColor: "#fff",
            border: "none",
            borderBottom: filtersOpen ? "1px solid #E5E5E5" : "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#171717",
            }}
          >
            <SlidersHorizontal size={14} strokeWidth={1.5} /> Filters
          </span>
          <span style={{ fontSize: "12px", color: "#737373" }}>
            {filtersOpen ? "Hide" : "Show"}
          </span>
        </button>

        <div
          style={{
            maxHeight: filtersOpen ? "220px" : "0",
            overflow: "hidden",
            transition: "max-height 250ms ease",
          }}
        >
          <div
            style={{
              padding: "16px",
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(6, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search jobs, customers, phones"
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                padding: "9px 12px",
                fontSize: "13px",
              }}
            />

            <select
              value={filter.type ?? ""}
              onChange={(event) => {
                const value = event.target.value as
                  | "installation"
                  | "complaint"
                  | "";
                setFilter((prev) => ({ ...prev, type: value || undefined }));
                setPage(1);
              }}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                padding: "9px 12px",
                fontSize: "13px",
              }}
            >
              <option value="">All types</option>
              <option value="installation">Installation</option>
              <option value="complaint">Complaint</option>
            </select>

            <select
              value={filter.status ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setFilter((prev) => ({ ...prev, status: value || undefined }));
                setPage(1);
              }}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                padding: "9px 12px",
                fontSize: "13px",
              }}
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="pending_schedule">Pending schedule</option>
              <option value="scheduled">Scheduled</option>
              <option value="assigned">Assigned</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_transit">In transit</option>
              <option value="in_process">In process</option>
              <option value="needs_revisit">Needs revisit</option>
              <option value="resolved">Resolved</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {!isTechnician ? (
              <select
                value={filter.technicianId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilter((prev) => ({
                    ...prev,
                    technicianId: value || undefined,
                  }));
                  setPage(1);
                }}
                style={{
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  padding: "9px 12px",
                  fontSize: "13px",
                }}
              >
                <option value="">All technicians</option>
                {techniciansQuery.data?.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              value={filter.dateFrom ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setFilter((prev) => ({
                  ...prev,
                  dateFrom: value || undefined,
                }));
                setPage(1);
              }}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                padding: "9px 12px",
                fontSize: "13px",
              }}
            >
              <option value="">From date</option>
              <option value="2026-01-01">2026-01-01</option>
            </select>

            <select
              value={filter.dateTo ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setFilter((prev) => ({ ...prev, dateTo: value || undefined }));
                setPage(1);
              }}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                padding: "9px 12px",
                fontSize: "13px",
              }}
            >
              <option value="">To date</option>
              <option value="2026-12-31">2026-12-31</option>
            </select>
          </div>

          <div
            style={{
              padding: "0 16px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: "12px", color: "#737373" }}>
              <span
                style={{
                  backgroundColor: "#F5F5F5",
                  borderRadius: "9999px",
                  padding: "3px 8px",
                }}
              >
                Filters active
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  setFilter({});
                  setSearch("");
                  setPage(1);
                }}
                style={{
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  padding: "7px 12px",
                  backgroundColor: "#fff",
                  fontSize: "13px",
                  color: "#404040",
                }}
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                style={{
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  padding: "7px 12px",
                  backgroundColor: "#fff",
                  fontSize: "13px",
                  color: "#404040",
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {displayedJobs.length === 0 ? (
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
            color="#D4D4D4"
            style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}
          />
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: "#404040" }}>
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
                borderBottom: index < displayedJobs.length - 1 ? "1px solid #F5F5F5" : "none",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <StatusChip status={job.status} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <JobTypeChip type={job.type} />
                  <ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" />
                </div>
              </div>
              <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717", lineHeight: 1.3 }}>
                {job.customerName}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#A3A3A3", fontFamily: '"JetBrains Mono", monospace' }}>
                  #{job.id.slice(0, 8)}
                </span>
                {job.brandName ? (
                  <>
                    <span style={{ fontSize: "11px", color: "#D4D4D4" }}>·</span>
                    <BrandSwatch name={job.brandName} colorHex={null} />
                  </>
                ) : null}
                {job.assignedTechnicianName ? (
                  <>
                    <span style={{ fontSize: "11px", color: "#D4D4D4" }}>·</span>
                    <span style={{ fontSize: "11px", color: "#737373" }}>{job.assignedTechnicianName}</span>
                  </>
                ) : null}
              </div>
            </a>
          ))}
        </div>
      ) : (
        /* ── Desktop table ────────────────────────────────── */
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                  {["Job ID", "Status", "Type", "Brand", "Customer", "Assigned", "Source"].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: "12px",
                        color: "#737373",
                        fontWeight: 500,
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedJobs.map((job) => (
                  <tr
                    key={job.id}
                    style={{ borderBottom: "1px solid #F5F5F5", cursor: "pointer" }}
                    onClick={() => window.location.assign(`/jobs/${job.id}`)}
                  >
                    <td
                      style={{
                        padding: "14px 16px",
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "12px",
                        color: "#525252",
                      }}
                    >
                      {job.id}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusChip status={job.status} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <JobTypeChip type={job.type} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <BrandSwatch name={job.brandName ?? "—"} colorHex={null} />
                    </td>
                    <td style={{ padding: "14px 16px", color: "#404040", fontSize: "13px" }}>
                      {job.customerName}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#404040", fontSize: "13px" }}>
                      {job.assignedTechnicianName ?? "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <SourceChip source={job.source} dealerName={job.dealerName ?? undefined} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "#737373",
          marginTop: "12px",
        }}
      >
        <span>
          Total (API): {data?.total ?? 0} · Showing: {displayedJobs.length}
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
              cursor: safePage <= 1 ? "not-allowed" : "pointer",
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
              cursor: safePage >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
