"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAnalyticsBrands,
  fetchAnalyticsDealers,
  fetchAnalyticsOverview,
  fetchAnalyticsTechnicians,
} from "@/lib/api/operations";
import { fetchAnalyticsDaily } from "@/lib/api/analytics-daily";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, Download, Star } from "lucide-react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function exportToCsv(data: unknown[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0] as object);
  const rows = data.map((row) =>
    keys.map((k) => JSON.stringify((row as Record<string, unknown>)[k] ?? "")).join(","),
  );
  const csv = [keys.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
}

function nullFmt(v: number | null, decimals = 1, suffix = "") {
  return v == null ? "—" : `${v.toFixed(decimals)}${suffix}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  trend,
}: {
  title: string;
  value: string;
  trend?: { label: string; isPositive: boolean };
}) {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid #E5E5E5",
        backgroundColor: "#fff",
        padding: "20px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 500, color: "#737373", marginBottom: "6px" }}>{title}</div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "#0A0A0A",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {trend ? (
        <div
          style={{
            fontSize: "12px",
            color: trend.isPositive ? "#10B981" : "#EF4444",
            marginTop: "4px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {trend.label} <span style={{ color: "#737373" }}>vs prev period</span>
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        boxShadow: active ? "inset 0 -2px 0 0 #0A0A0A" : "none",
        backgroundColor: "transparent",
        color: active ? "#171717" : "#737373",
        padding: "12px 18px",
        marginBottom: "-1px",
        fontSize: "13px",
        cursor: "pointer",
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

const DAY_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function DateRangeDropdown({
  value,
  onChange,
  isMobile,
}: {
  value: number;
  onChange: (n: number) => void;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeOption = DAY_OPTIONS.find((o) => o.value === value) ?? DAY_OPTIONS[1];

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "7px 12px",
          minHeight: "36px",
          borderRadius: "8px",
          border: "1px solid #E5E5E5",
          backgroundColor: open ? "#F5F5F5" : "#fff",
          fontSize: "13px",
          color: "#404040",
          cursor: "pointer",
        }}
      >
        <Calendar size={13} color="#737373" />
        {activeOption.label}
        <ChevronDown
          size={13}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            left: isMobile ? 0 : "auto",
            zIndex: 200,
            backgroundColor: "#fff",
            border: "1px solid #E5E5E5",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            minWidth: isMobile ? undefined : "220px",
            padding: "6px",
          }}
        >
          {DAY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: option.value === value ? "#F5F5F5" : "transparent",
                fontSize: "13px",
                color: "#171717",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "9999px",
                  backgroundColor: option.value === value ? "#0A0A0A" : "transparent",
                }}
              />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "7px 12px",
        minHeight: "36px",
        borderRadius: "8px",
        border: "1px solid #E5E5E5",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        color: "#404040",
      }}
    >
      <Download size={13} strokeWidth={1.5} />
      Export
    </button>
  );
}

function LoadingRow() {
  return (
    <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#737373" }}>Loading…</p>
  );
}

function ErrorRow() {
  return (
    <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#EF4444" }}>
      Failed to load data.
    </p>
  );
}

const tooltipStyle = {
  fontSize: "12px",
  borderRadius: "8px",
  border: "1px solid #E5E5E5",
  boxShadow: "none",
};

const axisTickStyle = { fontSize: 12, fill: "#737373" };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const isMobile = useMobileBreakpoint();
  const [tab, setTab] = useState<"business" | "technicians" | "brands" | "dealers">("business");
  const [days, setDays] = useState(30);
  const [hoveredTechnicianId, setHoveredTechnicianId] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", days],
    queryFn: () => fetchAnalyticsOverview(days),
  });

  const dailyQuery = useQuery({
    queryKey: ["analytics", "daily", days],
    queryFn: () => fetchAnalyticsDaily(days),
    enabled: tab === "business",
  });

  const techniciansQuery = useQuery({
    queryKey: ["analytics", "technicians", days],
    queryFn: () => fetchAnalyticsTechnicians(days),
    enabled: tab === "technicians",
  });

  const brandsQuery = useQuery({
    queryKey: ["analytics", "brands", days],
    queryFn: () => fetchAnalyticsBrands(days),
    enabled: tab === "brands",
  });

  const dealersQuery = useQuery({
    queryKey: ["analytics", "dealers", days],
    queryFn: () => fetchAnalyticsDealers(days),
    enabled: tab === "dealers",
  });

  const overview = overviewQuery.data;
  const dailyData = dailyQuery.data ?? [];

  // Month label for subtitle
  const now = new Date();
  const monthLabel = now.toLocaleDateString([], { month: "long", year: "numeric" });

  function handleExport() {
    if (tab === "business") {
      exportToCsv(dailyData, `analytics-business-${days}d.csv`);
    } else if (tab === "technicians") {
      exportToCsv(techniciansQuery.data ?? [], `analytics-technicians-${days}d.csv`);
    } else if (tab === "brands") {
      exportToCsv(brandsQuery.data ?? [], `analytics-brands-${days}d.csv`);
    } else {
      exportToCsv(dealersQuery.data ?? [], `analytics-dealers-${days}d.csv`);
    }
  }

  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1400px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: isMobile ? "28px" : "36px",
              fontWeight: 600,
              color: "#0A0A0A",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Analytics
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
            Last {days} days &middot; {monthLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <DateRangeDropdown value={days} onChange={setDays} isMobile={isMobile} />
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden" }}>
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: "18px",
            borderBottom: "1px solid #E5E5E5",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
        <TabButton active={tab === "business"} onClick={() => setTab("business")}>
          Business
        </TabButton>
        <TabButton active={tab === "technicians"} onClick={() => setTab("technicians")}>
          Technician scorecards
        </TabButton>
        <TabButton active={tab === "brands"} onClick={() => setTab("brands")}>
          Brand
        </TabButton>
        <TabButton active={tab === "dealers"} onClick={() => setTab("dealers")}>
          Dealer
        </TabButton>
      </div>

      {/* ── Business Tab ── */}
      {tab === "business" ? (
        <>
          {overviewQuery.isLoading ? <LoadingRow /> : null}
          {overviewQuery.isError ? <ErrorRow /> : null}

          {overview && overview.totalJobs === 0 ? (
            <div>
              <div style={{ textAlign: "center", padding: "32px 12px", fontSize: "14px", color: "#737373" }}>
                No analytics available for the selected period.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "32px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                    Daily Revenue (RS)
                  </h3>
                  <div
                    style={{
                      height: "240px",
                      border: "1px dashed #E5E5E5",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      color: "#A3A3A3",
                    }}
                  >
                    No data to display
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                    Daily Jobs
                  </h3>
                  <div
                    style={{
                      height: "200px",
                      border: "1px dashed #E5E5E5",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      color: "#A3A3A3",
                    }}
                  >
                    No data to display
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {overview && overview.totalJobs > 0 ? (
            <>
          {/* KPI cards */}
          {overview ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <KpiCard
                title="Total Revenue (RS)"
                value={overview.totalRevenue.toLocaleString("en", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              />
              <KpiCard
                title="Total Jobs"
                value={String(overview.totalJobs)}
              />
              <KpiCard
                title="Active Jobs"
                value={String(overview.activeJobs)}
              />
              <KpiCard
                title="Completed Jobs"
                value={String(overview.completedJobs)}
              />
              <KpiCard
                title="1st Visit Resolution"
                value={
                  overview.firstVisitResolutionRate != null
                    ? `${overview.firstVisitResolutionRate.toFixed(1)}%`
                    : "—"
                }
              />
              <KpiCard
                title="Revisit Rate"
                value={
                  overview.revisitRate != null
                    ? `${overview.revisitRate.toFixed(1)}%`
                    : "—"
                }
              />
            </div>
          ) : null}

          {/* Bar chart — daily revenue */}
          {dailyQuery.isLoading ? <LoadingRow /> : null}
          {dailyQuery.isError ? <ErrorRow /> : null}
          {!dailyQuery.isLoading && !dailyQuery.isError && dailyData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "32px" }}>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                  Daily Revenue (RS)
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={axisTickStyle}
                      tickFormatter={fmt}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="revenue" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart — daily jobs */}
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#171717", marginBottom: "16px" }}>
                  Daily Jobs
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={axisTickStyle}
                      tickFormatter={fmt}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#525252"
                      strokeWidth={1.5}
                      dot={{ r: 3 }}
                      name="Total"
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      dot={{ r: 3 }}
                      name="Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ── Technicians Tab ── */}
      {tab === "technicians" ? (
        <>
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {techniciansQuery.isLoading ? <LoadingRow /> : null}
            {techniciansQuery.isError ? <ErrorRow /> : null}
            {!techniciansQuery.isLoading && !techniciansQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["NAME", "JOBS COMPLETED", "REVENUE (RS)", "1ST VISIT RES.", "AVG RESOLUTION", "ON-TIME RATE", "RATING"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5", fontSize: "13px", color: "#525252", fontWeight: 500 }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(techniciansQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "24px 12px", textAlign: "center", fontSize: "14px", color: "#737373" }}>
                        No technician data for this period.
                      </td>
                    </tr>
                  ) : (
                    (techniciansQuery.data ?? []).map((item) => {
                      const onTimeColor =
                        item.onTimeRate == null
                          ? "#E5E5E5"
                          : item.onTimeRate >= 85
                            ? "#10B981"
                            : item.onTimeRate >= 70
                              ? "#F59E0B"
                              : "#EF4444";
                      return (
                        <tr
                          key={item.technicianId}
                          onMouseEnter={() => setHoveredTechnicianId(item.technicianId)}
                          onMouseLeave={() => setHoveredTechnicianId(null)}
                          style={{
                            borderBottom: "1px solid #F5F5F5",
                            backgroundColor: hoveredTechnicianId === item.technicianId ? "#FAFAFA" : "transparent",
                          }}
                        >
                          <td style={{ padding: "10px 12px", fontWeight: 500, color: "#171717", fontSize: "14px" }}>
                            {item.technicianName || "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>
                            {item.jobsCompleted}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#065F46", fontVariantNumeric: "tabular-nums" }}>
                            {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>
                            {nullFmt(item.firstVisitResolutionRate, 1, "%")}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040", fontVariantNumeric: "tabular-nums" }}>
                            {item.avgResolutionMinutes != null ? `${item.avgResolutionMinutes} min` : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040" }}>
                            {item.onTimeRate == null ? (
                              "—"
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div
                                  style={{
                                    height: "4px",
                                    width: "80px",
                                    maxWidth: "80px",
                                    backgroundColor: "#F5F5F5",
                                    borderRadius: "9999px",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "4px",
                                      width: `${Math.min(item.onTimeRate, 100)}%`,
                                      backgroundColor: onTimeColor,
                                      borderRadius: "9999px",
                                    }}
                                  />
                                </div>
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.onTimeRate.toFixed(1)}%</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#404040" }}>
                            {item.avgStarRating == null ? (
                              "—"
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <Star size={13} fill="#F59E0B" color="#F59E0B" />
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.avgStarRating.toFixed(2)}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}

      {/* ── Brands Tab ── */}
      {tab === "brands" ? (
        <>
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {brandsQuery.isLoading ? <LoadingRow /> : null}
            {brandsQuery.isError ? <ErrorRow /> : null}
            {!brandsQuery.isLoading && !brandsQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["BRAND", "TOTAL JOBS", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (RS)", "REVISIT RATE"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(brandsQuery.data ?? []).map((item) => (
                    <tr key={item.brandId} style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.brandName || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.activeJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completedJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.revisitRate, 1, "%")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}

      {/* ── Dealers Tab ── */}
      {tab === "dealers" ? (
        <>
          <section
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {dealersQuery.isLoading ? <LoadingRow /> : null}
            {dealersQuery.isError ? <ErrorRow /> : null}
            {!dealersQuery.isLoading && !dealersQuery.isError ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F9F9F9", color: "#737373", textAlign: "left" }}>
                    {["DEALER", "JOBS SUBMITTED", "ACTIVE JOBS", "COMPLETED JOBS", "REVENUE (RS)"].map(
                      (h) => (
                        <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(dealersQuery.data ?? []).map((item) => (
                    <tr key={item.dealerId} style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.dealerName || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.activeJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completedJobs}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.revenueGenerated.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}
      </div>
    </section>
  );
}
