"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { useState } from "react";

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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #E5E5E5",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "#171717",
          marginBottom: "12px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid #E5E5E5",
        backgroundColor: "#fff",
        padding: "20px",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#737373" }}>{title}</p>
      <p
        style={{
          margin: 0,
          fontSize: "24px",
          fontWeight: 600,
          color: "#171717",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
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

function WindowSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        borderRadius: "8px",
        border: "1px solid #E5E5E5",
        padding: "6px 10px",
        fontSize: "12px",
        color: "#171717",
        backgroundColor: "#F9F9F9",
        cursor: "pointer",
      }}
    >
      <option value={7}>Last 7 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: "8px",
        border: "1px solid #E5E5E5",
        padding: "6px 12px",
        fontSize: "12px",
        color: "#404040",
        backgroundColor: "#F9F9F9",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      ↓ Export CSV
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
};

const axisTickStyle = { fontSize: 11, fill: "#737373" };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"business" | "technicians" | "brands" | "dealers">("business");
  const [days, setDays] = useState(30);

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
    <section style={{ padding: "24px", maxWidth: "1400px" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
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
            Analytics
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
            Last {days} days &middot; {monthLabel}
          </p>
        </div>
        <ExportButton onClick={handleExport} />
      </header>

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
          {/* Tab toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>

          {overviewQuery.isLoading ? <LoadingRow /> : null}
          {overviewQuery.isError ? <ErrorRow /> : null}

          {/* KPI cards — 3 columns, 2 rows */}
          {overview ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
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
            <>
              <ChartCard title="Daily Revenue (RS)">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData} barSize={28}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E5E5"
                      vertical={false}
                    />
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
              </ChartCard>

              {/* Line chart — daily jobs */}
              <ChartCard title="Daily Jobs">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E5E5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={axisTickStyle}
                      tickFormatter={fmt}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#737373"
                      strokeWidth={2}
                      dot={false}
                      name="Total"
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                      name="Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          ) : null}
        </>
      ) : null}

      {/* ── Technicians Tab ── */}
      {tab === "technicians" ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>
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
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
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
                  {(techniciansQuery.data ?? []).map((item) => (
                    <tr key={item.technicianId} style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td style={{ padding: "10px 12px", color: "#171717" }}>{item.technicianName || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>{item.jobsCompleted}</td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.revenueCollected.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.firstVisitResolutionRate, 1, "%")}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {item.avgResolutionMinutes != null ? `${item.avgResolutionMinutes} min` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.onTimeRate, 1, "%")}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#404040" }}>
                        {nullFmt(item.avgStarRating, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}

      {/* ── Brands Tab ── */}
      {tab === "brands" ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>
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
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <WindowSelect value={days} onChange={setDays} />
          </div>
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
