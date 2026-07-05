"use client";

import { JobDetail } from "@/components/jobs/job-detail";
import { fetchTechnicianJobs } from "@/lib/api/operations";
import { isTerminalStatus } from "@/lib/job-status-groups";
import type { TechnicianDirectoryItem, TechnicianJob } from "@/types/operations";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Clock, Mail, MapPin, Phone, X } from "lucide-react";
import { useMemo, useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PALETTE = [
  { bg: "#EDE9FE", text: "#5B21B6" },
  { bg: "#D1FAE5", text: "#065F46" },
  { bg: "#FEF3C7", text: "#92400E" },
  { bg: "#FCE7F3", text: "#9D174D" },
  { bg: "#DBEAFE", text: "#1E40AF" },
];

function avatarColors(name: string) {
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span style={{ color: "#A3A3A3", fontSize: "13px" }}>—</span>;
  const filled = Math.round(rating);
  return (
    <span style={{ letterSpacing: "1px", fontSize: "14px" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < filled ? "#F59E0B" : "#D1D5DB" }}>★</span>
      ))}
    </span>
  );
}

// Status labels & colors for history table
const STATUS_STYLE: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  completed:             { bg: "#D1FAE5", dot: "#34D399", text: "#065F46", label: "Completed" },
  resolved:              { bg: "#D1FAE5", dot: "#34D399", text: "#065F46", label: "Resolved" },
  resolved_on_revisit:   { bg: "#ECFDF5", dot: "#6EE7B7", text: "#065F46", label: "Resolved (revisit)" },
  cancelled:             { bg: "#FEE2E2", dot: "#F87171", text: "#991B1B", label: "Cancelled" },
  scheduled:             { bg: "#EFF6FF", dot: "#60A5FA", text: "#1D4ED8", label: "Scheduled" },
  in_progress:           { bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "In progress" },
  needs_revisit:         { bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "Needs revisit" },
  cancellation_requested:{ bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "Cancel request" },
  pending_schedule:      { bg: "#F5F5F5", dot: "#A3A3A3", text: "#525252", label: "Pending schedule" },
};

function statusStyle(status: string) {
  return STATUS_STYLE[status] ?? { bg: "#F5F5F5", dot: "#A3A3A3", text: "#525252", label: status.replace(/_/g, " ") };
}

function StatusChip({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "9999px",
      backgroundColor: s.bg, color: s.text,
      fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ─── Ongoing job card ─────────────────────────────────────────────────────────

function OngoingCard({ job, onView }: { job: TechnicianJob; onView: () => void }) {
  return (
    <div style={{
      backgroundColor: "rgb(250, 250, 250)",
      border: "1px solid #E5E5E5",
      borderRadius: "12px",
      padding: "20px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
    }}>
      <div style={{ minWidth: 0 }}>
        {/* ID + status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", color: "#A3A3A3", fontFamily: "monospace" }}>
            j-{job.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusChip status={job.status} />
        </div>

        {/* Customer name */}
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#0A0A0A", marginBottom: "8px" }}>
          {job.customerName}
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {job.address && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#737373" }}>
              <MapPin size={13} strokeWidth={1.5} color="#A3A3A3" />
              {job.address}
            </span>
          )}
          {job.scheduledAt && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#737373" }}>
              <Clock size={13} strokeWidth={1.5} color="#A3A3A3" />
              {formatScheduled(job.scheduledAt)}
            </span>
          )}
          <span style={{ fontSize: "13px", color: "#737373" }}>
            {job.type === "installation" ? "Installation" : "Complaint"}
          </span>
        </div>
      </div>

      {/* View job button */}
      <button
        type="button"
        onClick={onView}
        style={{
          display: "inline-flex", alignItems: "center", gap: "4px",
          padding: "7px 14px", borderRadius: "8px",
          border: "1px solid #E5E5E5", backgroundColor: "#fff",
          fontSize: "13px", color: "#404040", cursor: "pointer",
          fontWeight: 500, flexShrink: 0, whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#FAFAFA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff"; }}
      >
        View job <ChevronRight size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5",
      borderRadius: "12px", padding: "20px 24px",
    }}>
      <div style={{ fontSize: "12px", fontWeight: 500, color: "#737373", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 600, color: "#0A0A0A" }}>{value}</div>
    </div>
  );
}

// ─── Panel header (shared) ────────────────────────────────────────────────────

type Tab = "history" | "ongoing" | "performance";

type Props = {
  technician: TechnicianDirectoryItem;
  onClose: () => void;
};

export function TechnicianDetailPanel({ technician, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("history");
  const [viewJobId, setViewJobId] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["technician-jobs", technician.id],
    queryFn: () => fetchTechnicianJobs(technician.id),
  });

  const allJobs: TechnicianJob[] = jobsQuery.data ?? [];
  const historyJobs  = useMemo(() => allJobs.filter((j) => isTerminalStatus(j.status)),  [allJobs]);
  const ongoingJobs  = useMemo(() => allJobs.filter((j) => !isTerminalStatus(j.status)), [allJobs]);

  const totalRevenue = useMemo(() => historyJobs.reduce((s, j) => s + j.amountCollected, 0), [historyJobs]);
  const ratings      = useMemo(() => historyJobs.map((j) => j.avgRating).filter((r): r is number => r !== null), [historyJobs]);
  const avgRating    = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const av = avatarColors(technician.name);

  const sinceDate = technician.createdAt
    ? new Date(technician.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "14px 4px",
    marginRight: "28px",
    fontSize: "14px",
    fontWeight: tab === t ? 600 : 400,
    color: tab === t ? "#0A0A0A" : "#737373",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: tab === t ? "2px solid #0A0A0A" : "2px solid transparent",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const TH: React.CSSProperties = {
    padding: "10px 20px",
    textAlign: "left",
    fontSize: "11px",
    fontWeight: 500,
    color: "#A3A3A3",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #E5E5E5",
    backgroundColor: "#FAFAFA",
    textTransform: "uppercase",
  };

  // ── Shared header + tabs markup ─────────────────────────────────────────────
  const Header = (
    <>
      <div style={{
        padding: "28px 40px 24px",
        borderBottom: "1px solid #E5E5E5",
        backgroundColor: "#fff",
        flexShrink: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "20px" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            backgroundColor: av.bg, color: av.text,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", fontWeight: 700, letterSpacing: "0.02em", flexShrink: 0,
          }}>
            {initials(technician.name)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "22px", fontWeight: 600, color: "#0A0A0A", lineHeight: 1.2 }}>
                {technician.name}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "3px 10px", borderRadius: "9999px",
                backgroundColor: technician.isActive ? "#ECFDF5" : "#F5F5F5",
                color: technician.isActive ? "#065F46" : "#525252",
                fontSize: "12px", fontWeight: 500,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, backgroundColor: technician.isActive ? "#34D399" : "#A3A3A3", display: "inline-block" }} />
                {technician.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              {technician.phone && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#737373" }}>
                  <Phone size={13} strokeWidth={1.5} color="#A3A3A3" /> {technician.phone}
                </span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#737373" }}>
                <Mail size={13} strokeWidth={1.5} color="#A3A3A3" /> {technician.email}
              </span>
              {technician.region && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#737373" }}>
                  <MapPin size={13} strokeWidth={1.5} color="#A3A3A3" /> {technician.region}
                </span>
              )}
              {sinceDate && (
                <span style={{ fontSize: "13px", color: "#737373" }}>Since {sinceDate}</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ width: 32, height: 32, borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#FAFAFA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#525252", flexShrink: 0 }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div style={{ borderBottom: "1px solid #E5E5E5", padding: "0 40px", display: "flex", backgroundColor: "#fff", flexShrink: 0 }}>
        <button type="button" style={tabStyle("history")}     onClick={() => setTab("history")}>Job History</button>
        <button type="button" style={tabStyle("ongoing")}     onClick={() => setTab("ongoing")}>Ongoing ({ongoingJobs.length})</button>
        <button type="button" style={tabStyle("performance")} onClick={() => setTab("performance")}>Performance</button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Main technician detail screen ──────────────────── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "#fff", display: "flex", flexDirection: "column" }}>
        {Header}

        <div style={{ flex: 1, overflowY: "auto", backgroundColor: "#fff" }}>
          {jobsQuery.isLoading && (
            <div style={{ padding: "40px", fontSize: "13px", color: "#737373" }}>Loading…</div>
          )}
          {jobsQuery.isError && (
            <div style={{ padding: "40px", fontSize: "13px", color: "#EF4444" }}>Failed to load jobs.</div>
          )}

          {/* Job History — table */}
          {tab === "history" && !jobsQuery.isLoading && !jobsQuery.isError && (
            historyJobs.length === 0 ? (
              <div style={{ padding: "48px 40px", fontSize: "13px", color: "#737373" }}>No completed jobs yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                  <thead>
                    <tr>
                      <th style={TH}>Job ID</th>
                      <th style={TH}>Customer</th>
                      <th style={TH}>Type</th>
                      <th style={TH}>Status</th>
                      <th style={{ ...TH, textAlign: "right" }}>Amount</th>
                      <th style={{ ...TH, textAlign: "right" }}>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyJobs.map((job) => (
                      <tr
                        key={job.id}
                        style={{ borderBottom: "1px solid #F5F5F5", cursor: "pointer" }}
                        onClick={() => setViewJobId(job.id)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#FAFAFA"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                      >
                        <td style={{ padding: "16px 20px", fontSize: "12px", color: "#737373", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          j-{job.id.slice(0, 6).toUpperCase()}
                        </td>
                        <td style={{ padding: "16px 20px", fontSize: "14px", color: "#171717", fontWeight: 500 }}>
                          {job.customerName}
                        </td>
                        <td style={{ padding: "16px 20px", fontSize: "13px", color: "#404040" }}>
                          {job.type === "installation" ? "Installation" : "Complaint"}
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <StatusChip status={job.status} />
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right", fontSize: "13px", fontWeight: 600, color: job.amountCollected > 0 ? "#171717" : "#A3A3A3", whiteSpace: "nowrap" }}>
                          {job.amountCollected > 0 ? `RS ${job.amountCollected.toLocaleString()}` : "—"}
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <Stars rating={job.avgRating} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Ongoing — cards */}
          {tab === "ongoing" && !jobsQuery.isLoading && !jobsQuery.isError && (
            ongoingJobs.length === 0 ? (
              <div style={{ padding: "48px 40px", fontSize: "13px", color: "#737373" }}>No active jobs right now.</div>
            ) : (
              <div style={{ padding: "24px 40px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {ongoingJobs.map((job) => (
                  <OngoingCard key={job.id} job={job} onView={() => setViewJobId(job.id)} />
                ))}
              </div>
            )
          )}

          {/* Performance — stat cards */}
          {tab === "performance" && !jobsQuery.isLoading && !jobsQuery.isError && (
            <div style={{ padding: "32px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
              <StatCard label="Jobs completed" value={historyJobs.length} />
              <StatCard label="Active jobs"    value={ongoingJobs.length} />
              <StatCard label="Total revenue"  value={`RS ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}`} />
              <StatCard label="Avg rating"     value={avgRating !== null ? `${avgRating.toFixed(1)} / 5` : "—"} />
            </div>
          )}
        </div>
      </div>

      {/* ── Job detail overlay (on top of technician screen) ── */}
      {viewJobId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: "#FAFAFA", display: "flex", flexDirection: "column" }}>
          {/* Back bar */}
          <div style={{ padding: "14px 24px", borderBottom: "1px solid #E5E5E5", backgroundColor: "#fff", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setViewJobId(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", fontSize: "13px", color: "#404040", cursor: "pointer", fontWeight: 500 }}
            >
              <ArrowLeft size={13} strokeWidth={1.5} /> Back to {technician.name}
            </button>
          </div>
          {/* Job detail content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <JobDetail jobId={viewJobId} />
          </div>
        </div>
      )}
    </>
  );
}
