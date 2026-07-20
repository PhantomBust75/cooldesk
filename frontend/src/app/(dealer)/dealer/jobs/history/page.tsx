"use client";

import { fetchDealerJobs } from "@/lib/api/dealer";
import { useQuery } from "@tanstack/react-query";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import { formatDate } from "@/lib/format-date";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  resolved:  { label: "Resolved",  color: "#065F46", bg: "#D1FAE5" },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
};

const TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  installation: { label: "Installation", color: "#065F46", bg: "#D1FAE5" },
  complaint:    { label: "Complaint",    color: "#B45309", bg: "#FEF3C7" },
};

function shortId(id: string): string {
  return "DL-" + id.slice(0, 6).toUpperCase();
}

export default function DealerJobHistoryPage() {
  const isMobile = useMobileBreakpoint();
  const { data: jobs = [], isPending, isError } = useQuery({
    queryKey: ["dealer", "jobs"],
    queryFn: () => fetchDealerJobs(),
  });

  const history = jobs.filter((j) => j.status === "resolved" || j.status === "cancelled");

  return (
    <div style={{ padding: isMobile ? "16px 16px 0" : "28px 32px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h1 style={{ fontSize: isMobile ? "22px" : "24px", fontWeight: 600, color: "#0A0A0A", margin: 0 }}>Job History</h1>
        <p style={{ fontSize: "14px", color: "#737373", marginTop: "4px" }}>
          {history.length} completed job{history.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden" }}>
        {isPending ? (
          <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#737373" }}>Loading…</div>
        ) : isError ? (
          <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#EF4444" }}>Failed to load history.</div>
        ) : history.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#737373" }}>No completed jobs yet.</div>
        ) : isMobile ? (
          /* Mobile card list */
          history.map((job, i) => {
            const status = STATUS_MAP[job.status] ?? { label: job.status, color: "#525252", bg: "#F5F5F5" };
            const type = TYPE_MAP[job.type] ?? { label: job.type, color: "#525252", bg: "#F5F5F5" };
            return (
              <div
                key={job.id}
                style={{ padding: "14px 16px", borderBottom: i < history.length - 1 ? "1px solid #F5F5F5" : "none" }}
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
                  <span style={{ fontSize: "12px", color: "#737373" }}>{formatDate(job.created_at)}</span>
                </div>
              </div>
            );
          })
        ) : (
          /* Desktop table */
          <>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px 150px 130px", padding: "12px 20px", borderBottom: "1px solid #E5E5E5", backgroundColor: "#FAFAFA", gap: "12px" }}>
              {["JOB ID", "CUSTOMER", "TYPE", "DATE", "STATUS"].map((h) => (
                <span key={h} style={{ fontSize: "11px", fontWeight: 500, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>
            {history.map((job, i) => {
              const status = STATUS_MAP[job.status] ?? { label: job.status, color: "#525252", bg: "#F5F5F5" };
              const type = TYPE_MAP[job.type] ?? { label: job.type, color: "#525252", bg: "#F5F5F5" };
              return (
                <div key={job.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px 150px 130px", alignItems: "center", padding: "16px 20px", borderBottom: i < history.length - 1 ? "1px solid #F5F5F5" : "none", gap: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#737373", fontFamily: "monospace" }}>{shortId(job.id)}</span>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{job.customer_name}</span>
                  <span><span style={{ fontSize: "12px", fontWeight: 500, color: type.color, backgroundColor: type.bg, borderRadius: "6px", padding: "3px 8px" }}>{type.label}</span></span>
                  <span style={{ fontSize: "13px", color: "#525252" }}>{formatDate(job.created_at)}</span>
                  <span><span style={{ fontSize: "12px", fontWeight: 500, color: status.color, backgroundColor: status.bg, borderRadius: "6px", padding: "3px 8px" }}>{status.label}</span></span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
