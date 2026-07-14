"use client";

import { fetchDealerJobs, type DealerJob } from "@/lib/api/dealer";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Plus } from "lucide-react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

const STATUS_FILTERS = ["All", "Pending Schedule", "Scheduled", "In Progress", "Needs Revisit"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  new:                  { label: "New",                  color: "#D97706", bg: "#FEF3C7" },
  pending_schedule:     { label: "Pending Schedule",     color: "#D97706", bg: "#FEF3C7" },
  scheduled:            { label: "Scheduled",            color: "#1D4ED8", bg: "#DBEAFE" },
  in_progress:          { label: "In Progress",          color: "#7C3AED", bg: "#EDE9FE" },
  needs_revisit:        { label: "Needs Revisit",        color: "#B45309", bg: "#FDE68A" },
  cancellation_pending: { label: "Cancellation Pending", color: "#B91C1C", bg: "#FEE2E2" },
  resolved:             { label: "Resolved",             color: "#065F46", bg: "#D1FAE5" },
  cancelled:            { label: "Cancelled",            color: "#6B7280", bg: "#F3F4F6" },
};

const TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  installation: { label: "Installation", color: "#065F46", bg: "#D1FAE5" },
  complaint:    { label: "Complaint",    color: "#B45309", bg: "#FEF3C7" },
};

function jobMatchesFilter(job: DealerJob, filter: StatusFilter): boolean {
  if (filter === "All") return true;
  const s = job.status;
  if (filter === "Pending Schedule") return s === "pending_schedule" || s === "new";
  if (filter === "Scheduled")        return s === "scheduled";
  if (filter === "In Progress")      return s === "in_progress";
  if (filter === "Needs Revisit")    return s === "needs_revisit";
  return false;
}

function formatScheduled(iso: string | null): { text: string; italic: boolean } {
  if (!iso) return { text: "Pending", italic: true };
  const d = new Date(iso);
  const day = d.getDate();
  const mon = d.toLocaleDateString("en-GB", { month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return { text: `${day} ${mon}, ${time}`, italic: false };
}

function shortId(id: string): string {
  return "DL-" + id.slice(0, 6).toUpperCase();
}

export default function DealerJobsPage() {
  const router = useRouter();
  const isMobile = useMobileBreakpoint();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");

  const { data: jobs = [], isPending, isError } = useQuery({
    queryKey: ["dealer", "jobs"],
    queryFn: () => fetchDealerJobs(),
  });

  const activeJobs = jobs.filter((j) => j.status !== "resolved" && j.status !== "cancelled");

  const filtered = activeJobs.filter((j) => {
    if (!jobMatchesFilter(j, activeFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        j.customer_name.toLowerCase().includes(q) ||
        shortId(j.id).toLowerCase().includes(q) ||
        (j.brand_name?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div style={{ padding: isMobile ? "16px 16px 0" : "24px 24px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? "26px" : "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Active Jobs
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>{activeJobs.length} jobs</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dealer/jobs/new")}
          style={{ display: "flex", alignItems: "center", gap: "7px", padding: isMobile ? "9px 14px" : "10px 18px", backgroundColor: "#0A0A0A", color: "#fff", border: "none", borderRadius: "8px", fontSize: isMobile ? "13px" : "14px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <Plus size={14} strokeWidth={2} />
          {isMobile ? "New job" : "Log new job"}
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#A3A3A3", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your jobs by customer, job ID, or brand…"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717", outline: "none", backgroundColor: "#fff" }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap", overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? "4px" : 0 }}>
        {STATUS_FILTERS.map((f) => {
          const active = activeFilter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              style={{
                padding: "5px 14px",
                borderRadius: "9999px",
                border: active ? "none" : "1px solid #E5E5E5",
                backgroundColor: active ? "#0A0A0A" : "#fff",
                color: active ? "#fff" : "#525252",
                fontSize: "13px",
                fontWeight: active ? 500 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      <div style={{ border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden", backgroundColor: "#fff" }}>
        {isPending ? (
          <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#737373" }}>Loading…</div>
        ) : isError ? (
          <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#EF4444" }}>Failed to load jobs.</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#737373" }}>No jobs found</div>
        ) : isMobile ? (
          /* Mobile card list */
          filtered.map((job, i) => {
            const status = STATUS_MAP[job.status] ?? { label: job.status, color: "#525252", bg: "#F5F5F5" };
            const type = TYPE_MAP[job.type] ?? { label: job.type, color: "#525252", bg: "#F5F5F5" };
            const sched = formatScheduled(job.scheduled_at);
            return (
              <div
                key={job.id}
                onClick={() => router.push(`/dealer/jobs/${job.id}`)}
                style={{
                  padding: "14px 16px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #F5F5F5" : "none",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{job.customer_name}</span>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: status.color, backgroundColor: status.bg, borderRadius: "6px", padding: "3px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {status.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "#A3A3A3", fontFamily: "monospace" }}>{shortId(job.id)}</span>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: type.color, backgroundColor: type.bg, borderRadius: "6px", padding: "2px 7px" }}>{type.label}</span>
                  {job.brand_name && (
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#525252" }}>
                      {job.brand_color && <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: job.brand_color, display: "inline-block", flexShrink: 0 }} />}
                      {job.brand_name}
                    </span>
                  )}
                  <span style={{ fontSize: "12px", color: sched.italic ? "#A3A3A3" : "#525252", fontStyle: sched.italic ? "italic" : "normal" }}>{sched.text}</span>
                </div>
              </div>
            );
          })
        ) : (
          /* Desktop table */
          <>
            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 120px 140px 160px 160px 32px", padding: "12px 20px", borderBottom: "1px solid #E5E5E5", backgroundColor: "#FAFAFA", gap: "16px" }}>
              {["JOB ID", "CUSTOMER", "TYPE", "BRAND", "SCHEDULED", "STATUS", ""].map((h) => (
                <span key={h} style={{ fontSize: "11px", fontWeight: 500, color: "#737373", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>
            {filtered.map((job, i) => {
              const status = STATUS_MAP[job.status] ?? { label: job.status, color: "#525252", bg: "#F5F5F5" };
              const type = TYPE_MAP[job.type] ?? { label: job.type, color: "#525252", bg: "#F5F5F5" };
              const sched = formatScheduled(job.scheduled_at);
              return (
                <div
                  key={job.id}
                  onClick={() => router.push(`/dealer/jobs/${job.id}`)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 120px 140px 160px 160px 32px",
                    alignItems: "center",
                    padding: "16px 20px",
                    borderBottom: i < filtered.length - 1 ? "1px solid #F5F5F5" : "none",
                    gap: "16px",
                    cursor: "pointer",
                    transition: "background-color 100ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span style={{ fontSize: "12px", color: "#737373", fontFamily: "monospace", fontWeight: 500 }}>{shortId(job.id)}</span>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{job.customer_name}</span>
                  <span><span style={{ fontSize: "12px", fontWeight: 500, color: type.color, backgroundColor: type.bg, borderRadius: "6px", padding: "3px 8px" }}>{type.label}</span></span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#171717" }}>
                    {job.brand_color && <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: job.brand_color, flexShrink: 0, display: "inline-block" }} />}
                    {job.brand_name ?? "—"}
                  </span>
                  <span style={{ fontSize: "13px", color: sched.italic ? "#A3A3A3" : "#171717", fontStyle: sched.italic ? "italic" : "normal" }}>{sched.text}</span>
                  <span><span style={{ fontSize: "12px", fontWeight: 500, color: status.color, backgroundColor: status.bg, borderRadius: "6px", padding: "3px 8px", whiteSpace: "nowrap" }}>{status.label}</span></span>
                  <ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" />
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer count */}
      <div style={{ padding: "12px 4px", fontSize: "12px", color: "#737373" }}>
        {filtered.length} total · showing {filtered.length}
      </div>
    </div>
  );
}
