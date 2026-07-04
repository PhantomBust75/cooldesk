"use client";

import { StatusChip } from "@/components/ui/status-chip";
import { JobTypeChip } from "@/components/ui/job-type-chip";
import { useAuth } from "@/contexts/auth-context";
import { RoleGate } from "@/components/auth/role-gate";
import { fetchJobs } from "@/lib/api/jobs";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

const PAGE_SIZE = 20;

const TERMINAL_STATUSES = new Set([
  "completed",
  "resolved",
  "resolved_on_revisit",
  "needs_revisit",
  "cancelled",
]);

const HISTORY_TABS = [
  { label: "All", value: "" },
  { label: "Completed", value: "completed" },
  { label: "Resolved", value: "resolved" },
  { label: "Resolved on Revisit", value: "resolved_on_revisit" },
  { label: "Needs Revisit", value: "needs_revisit" },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `SAR ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function JobsHistoryPage() {
  const { session } = useAuth();
  const router = useRouter();
  const isMobile = useMobileBreakpoint();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", "history", session?.user.userId, page, activeStatus],
    queryFn: () =>
      fetchJobs({
        technicianId: session?.user.userId,
        status: activeStatus || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: Boolean(session?.user.userId),
  });

  const allJobs = data?.jobs ?? [];

  const historyJobs = useMemo(() => {
    const terminal = allJobs.filter((job) => TERMINAL_STATUSES.has(job.status));
    if (!search.trim()) return terminal;
    const q = search.toLowerCase();
    return terminal.filter(
      (job) =>
        job.customerName.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q) ||
        (job.brandName ?? "").toLowerCase().includes(q),
    );
  }, [allJobs, search]);

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    textAlign: "left",
    fontSize: "11px",
    color: "#A3A3A3",
    fontWeight: 500,
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "14px 16px",
    fontSize: "13px",
    whiteSpace: "nowrap",
  };

  return (
    <RoleGate allowedRoles={["technician"]}>
      <section style={{ padding: isMobile ? "16px" : "0", maxWidth: "1400px", width: "100%" }}>
        {/* Header */}
        <div style={{ padding: "24px 24px 0", marginBottom: "16px" }}>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Job History
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>
            {historyJobs.length} jobs
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: "0 24px 16px" }}>
          <div style={{ position: "relative", maxWidth: "380px" }}>
            <Search
              size={14}
              strokeWidth={1.5}
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#A3A3A3", pointerEvents: "none" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, job ID, brand…"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717", outline: "none", backgroundColor: "#fff" }}
            />
          </div>
        </div>

        {/* Status pill tabs */}
        <div style={{ padding: "0 24px 16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {HISTORY_TABS.map(({ label, value }) => {
            const active = activeStatus === value;
            return (
              <button
                key={label}
                type="button"
                onClick={() => { setActiveStatus(value); setPage(1); }}
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

        {/* Table */}
        <div style={{ margin: "0 24px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "20px", fontSize: "13px", color: "#737373" }}>Loading…</div>
          ) : historyJobs.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#737373", fontSize: "13px" }}>
              No completed jobs yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E5E5E5", backgroundColor: "#FAFAFA" }}>
                    {["JOB ID", "CUSTOMER", "TYPE", "COMPLETED", "STATUS", "AMOUNT", "METHOD"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                    <th style={{ width: "40px" }} />
                  </tr>
                </thead>
                <tbody>
                  {historyJobs.map((job) => (
                    <tr
                      key={job.id}
                      style={{ borderBottom: "1px solid #F5F5F5", cursor: "pointer" }}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
                    >
                      <td style={{ ...tdStyle, fontFamily: '"JetBrains Mono", monospace', color: "#171717" }}>
                        {job.id.slice(0, 8)}
                      </td>
                      <td style={{ ...tdStyle, color: "#171717", fontWeight: 600, borderLeft: job.tags.includes("chronic") ? "2px solid #9F1239" : "2px solid transparent" }}>
                        {job.customerName}
                      </td>
                      <td style={tdStyle}>
                        <JobTypeChip type={job.type} />
                      </td>
                      <td style={{ ...tdStyle, color: "#525252" }}>
                        {formatDate(job.updatedAt)}
                      </td>
                      <td style={tdStyle}>
                        <StatusChip status={job.status} />
                      </td>
                      <td style={{ ...tdStyle, color: "#171717", fontWeight: 500 }}>
                        {formatAmount(job.amountCollected)}
                      </td>
                      <td style={{ ...tdStyle, color: "#525252" }}>
                        {job.paymentMethodName ?? "—"}
                      </td>
                      <td style={{ padding: "14px 16px", width: "40px" }}>
                        <ChevronRight size={14} strokeWidth={1.5} color="#737373" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {(data?.page?.totalPages ?? 0) > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px", marginBottom: "24px" }}>
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
        )}
      </section>
    </RoleGate>
  );
}
