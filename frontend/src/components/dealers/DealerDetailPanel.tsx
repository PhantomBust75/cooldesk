"use client";

import { JobDetail } from "@/components/jobs/job-detail";
import { fetchDealerJobs, fetchOfficeBrands } from "@/lib/api/operations";
import { isTerminalStatus } from "@/lib/job-status-groups";
import type { DealerDirectoryItem, DealerJobItem } from "@/types/operations";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, ChevronRight, Clock, Mail, MapPin, Phone, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

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

const STATUS_STYLE: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  completed:              { bg: "#D1FAE5", dot: "#34D399", text: "#065F46", label: "Completed" },
  resolved:               { bg: "#D1FAE5", dot: "#34D399", text: "#065F46", label: "Resolved" },
  resolved_on_revisit:    { bg: "#ECFDF5", dot: "#6EE7B7", text: "#065F46", label: "Resolved (revisit)" },
  cancelled:              { bg: "#FEE2E2", dot: "#F87171", text: "#991B1B", label: "Cancelled" },
  scheduled:              { bg: "#EFF6FF", dot: "#60A5FA", text: "#1D4ED8", label: "Scheduled" },
  assigned:               { bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "Assigned" },
  in_transit:             { bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "In transit" },
  in_process:             { bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "In process" },
  needs_revisit:          { bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "Needs revisit" },
  revisit_scheduled:      { bg: "#EFF6FF", dot: "#60A5FA", text: "#1D4ED8", label: "Revisit scheduled" },
  cancellation_requested: { bg: "#FEF3C7", dot: "#F59E0B", text: "#92400E", label: "Cancel request" },
  pending_schedule:       { bg: "#F5F5F5", dot: "#A3A3A3", text: "#525252", label: "Pending schedule" },
  new:                    { bg: "#F5F5F5", dot: "#A3A3A3", text: "#525252", label: "New" },
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

// ─── Ongoing card ─────────────────────────────────────────────────────────────

function OngoingCard({ job, onView }: { job: DealerJobItem; onView: () => void }) {
  return (
    <div style={{
      backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5",
      borderRadius: "12px", padding: "20px 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", color: "#A3A3A3", fontFamily: "monospace" }}>
            j-{job.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusChip status={job.status} />
        </div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#0A0A0A", marginBottom: "8px" }}>
          {job.customerName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {job.address && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#737373" }}>
              <MapPin size={13} strokeWidth={1.5} color="#A3A3A3" /> {job.address}
            </span>
          )}
          {job.scheduledAt && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#737373" }}>
              <Clock size={13} strokeWidth={1.5} color="#A3A3A3" /> {formatScheduled(job.scheduledAt)}
            </span>
          )}
          <span style={{ fontSize: "13px", color: "#737373" }}>
            {job.type === "installation" ? "Installation" : "Complaint"}
          </span>
        </div>
      </div>
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

function StatCard({ label, value, sub, valueColor, bg }: {
  label: string;
  value: string | number;
  sub?: string;
  valueColor?: string;
  bg?: string;
}) {
  return (
    <div style={{
      backgroundColor: bg ?? "#FAFAFA", border: "1px solid #E5E5E5",
      borderRadius: "12px", padding: "18px 20px",
    }}>
      <div style={{ fontSize: "11px", fontWeight: 500, color: "#A3A3A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px" }}>
        {label}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 600, color: valueColor ?? "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "#737373", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

type Tab = "history" | "ongoing" | "performance";

type Props = {
  dealer: DealerDirectoryItem;
  onClose: () => void;
};

export function DealerDetailPanel({ dealer, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("history");
  const [viewJobId, setViewJobId] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["dealer-jobs", dealer.id],
    queryFn: () => fetchDealerJobs(dealer.id),
  });

  const brandsQuery = useQuery({
    queryKey: ["office-brands"],
    queryFn: fetchOfficeBrands,
  });

  const allJobs: DealerJobItem[] = jobsQuery.data ?? [];
  const historyJobs = useMemo(() => allJobs.filter((j) => isTerminalStatus(j.status)), [allJobs]);
  const ongoingJobs = useMemo(() => allJobs.filter((j) => !isTerminalStatus(j.status)), [allJobs]);

  const totalRevenue = useMemo(
    () => historyJobs.reduce((s, j) => s + j.amountCollected, 0),
    [historyJobs],
  );

  // Performance stats
  const cancelledCount = useMemo(() => allJobs.filter((j) => j.status === "cancelled").length, [allJobs]);
  const completedCount = useMemo(() => historyJobs.filter((j) => j.status !== "cancelled").length, [historyJobs]);
  const completionRate = allJobs.length > 0 ? Math.round((completedCount / allJobs.length) * 100) : 0;
  const avgJobValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
  const crColor = completionRate >= 88 ? "#065F46" : completionRate >= 75 ? "#92400E" : "#991B1B";
  const crBg    = completionRate >= 88 ? "#F0FDF4" : completionRate >= 75 ? "#FEF3C7" : "#FEE2E2";

  // Monthly chart data (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const label = d.toLocaleString("en-GB", { month: "short" });
      const monthJobs = allJobs.filter((j) => {
        const jd = new Date(j.createdAt);
        return jd.getFullYear() === y && jd.getMonth() === m;
      });
      const submitted = monthJobs.length;
      const completed = monthJobs.filter((j) =>
        ["completed", "resolved", "resolved_on_revisit"].includes(j.status)
      ).length;
      return { month: label, submitted, completed };
    });
  }, [allJobs]);

  const trendData = useMemo(() =>
    monthlyData.map(({ month, submitted, completed }) => ({
      month,
      rate: submitted > 0 ? Math.round((completed / submitted) * 100) : 0,
    })),
  [monthlyData]);

  // Assigned brands
  const assignedBrands = useMemo(() => {
    if (!brandsQuery.data) return [];
    return brandsQuery.data.filter((b) => dealer.brandIds.includes(b.id));
  }, [brandsQuery.data, dealer.brandIds]);

  const av = avatarColors(dealer.name);

  const sinceDate = dealer.createdAt
    ? new Date(dealer.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
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
            {initials(dealer.name)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "22px", fontWeight: 600, color: "#0A0A0A", lineHeight: 1.2 }}>
                {dealer.name}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "3px 10px", borderRadius: "9999px",
                backgroundColor: dealer.isActive ? "#ECFDF5" : "#F5F5F5",
                color: dealer.isActive ? "#065F46" : "#525252",
                fontSize: "12px", fontWeight: 500,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, backgroundColor: dealer.isActive ? "#34D399" : "#A3A3A3", display: "inline-block" }} />
                {dealer.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              {dealer.contactName && (
                <span style={{ fontSize: "13px", color: "#737373" }}>{dealer.contactName}</span>
              )}
              {dealer.phone && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#737373" }}>
                  <Phone size={13} strokeWidth={1.5} color="#A3A3A3" /> {dealer.phone}
                </span>
              )}
              {dealer.email && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#737373" }}>
                  <Mail size={13} strokeWidth={1.5} color="#A3A3A3" /> {dealer.email}
                </span>
              )}
              {dealer.region && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#737373" }}>
                  <MapPin size={13} strokeWidth={1.5} color="#A3A3A3" /> {dealer.region}
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
      {/* ── Main dealer detail screen ─────────────────────── */}
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
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                  <thead>
                    <tr>
                      <th style={TH}>Job ID</th>
                      <th style={TH}>Customer</th>
                      <th style={TH}>Type</th>
                      <th style={TH}>Status</th>
                      <th style={{ ...TH, textAlign: "right" }}>Amount</th>
                      <th style={TH}>Technician</th>
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
                        <td style={{ padding: "16px 20px", fontSize: "13px", color: "#404040" }}>
                          {job.technicianName ?? <span style={{ color: "#A3A3A3" }}>—</span>}
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

          {/* Performance */}
          {tab === "performance" && !jobsQuery.isLoading && !jobsQuery.isError && (
            <div style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: "32px" }}>

              {/* KPI 2×2 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                <StatCard
                  label="Revenue generated"
                  value={totalRevenue > 0 ? `RS ${totalRevenue.toLocaleString()}` : "—"}
                  sub="all time"
                  valueColor="#065F46"
                  bg="#F0FDF4"
                />
                <StatCard
                  label="Total jobs"
                  value={allJobs.length}
                  sub={`${cancelledCount} cancelled`}
                />
                <StatCard
                  label="Completion rate"
                  value={`${completionRate}%`}
                  valueColor={crColor}
                  bg={crBg}
                />
                <StatCard
                  label="Avg job value"
                  value={avgJobValue > 0 ? `RS ${avgJobValue.toLocaleString()}` : "—"}
                  sub="per job"
                />
              </div>

              {/* Assigned brands */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0A0A0A", marginBottom: "12px" }}>Assigned brands</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {assignedBrands.length > 0 ? assignedBrands.map((b) => (
                    <span key={b.id} style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      padding: "5px 12px", borderRadius: "9999px",
                      border: "1px solid #E5E5E5", backgroundColor: "#FAFAFA",
                      fontSize: "13px", color: "#404040",
                    }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: b.colorHex ?? "#A3A3A3", flexShrink: 0 }} />
                      {b.name}
                    </span>
                  )) : (
                    <span style={{ fontSize: "13px", color: "#A3A3A3", fontStyle: "italic" }}>No brands assigned</span>
                  )}
                </div>
              </div>

              {/* Monthly job volume bar chart */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0A0A0A", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Briefcase size={14} strokeWidth={1.5} color="#737373" /> Monthly job volume
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthlyData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke="#F5F5F5" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#A3A3A3" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#A3A3A3" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "12px" }} cursor={{ fill: "#F5F5F5" }} />
                    <Bar dataKey="submitted" name="Submitted" fill="#E5E5E5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                  {[{ color: "#E5E5E5", label: "Submitted" }, { color: "#0A0A0A", label: "Completed" }].map((l) => (
                    <span key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#737373" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: l.color, flexShrink: 0 }} />{l.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Completion rate trend line chart */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0A0A0A", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <TrendingUp size={14} strokeWidth={1.5} color="#737373" /> Completion rate trend (6 months)
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData}>
                    <CartesianGrid vertical={false} stroke="#F5F5F5" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#A3A3A3" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#A3A3A3" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "12px" }} formatter={(v) => [`${v}%`, "Completion rate"]} />
                    <Line type="monotone" dataKey="rate" stroke={crColor} strokeWidth={2} dot={{ r: 3, fill: crColor, strokeWidth: 0 }} activeDot={{ r: 5, fill: crColor }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── Job detail overlay (on top of dealer screen) ─── */}
      {viewJobId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: "#FAFAFA", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 24px", borderBottom: "1px solid #E5E5E5", backgroundColor: "#fff", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setViewJobId(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", fontSize: "13px", color: "#404040", cursor: "pointer", fontWeight: 500 }}
            >
              <ArrowLeft size={13} strokeWidth={1.5} /> Back to {dealer.name}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <JobDetail jobId={viewJobId} />
          </div>
        </div>
      )}
    </>
  );
}
