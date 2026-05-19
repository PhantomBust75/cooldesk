"use client";

import {
  fetchAnalyticsBrands,
  fetchAnalyticsDealers,
  fetchAnalyticsOverview,
  fetchAnalyticsTechnicians,
} from "@/lib/api/operations";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Clock3, Star, TrendingUp } from "lucide-react";
import { useState } from "react";

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"business" | "technicians" | "brands" | "dealers">("business");
  const [days, setDays] = useState(30);
  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", days],
    queryFn: () => fetchAnalyticsOverview(days),
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

  return (
    <section style={{ padding: "24px", maxWidth: "1040px" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Analytics</h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>Precomputed daily organization metrics.</p>
        </div>

        <label style={{ fontSize: "12px", color: "#737373" }}>
          Window
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} style={{ marginTop: "5px", display: "block", borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </header>

      <div style={{ display: "flex", gap: "18px", borderBottom: "1px solid #E5E5E5", marginBottom: "16px" }}>
        {([
          { key: "business", label: "Business" },
          { key: "technicians", label: "Technician scorecards" },
          { key: "brands", label: "Brand" },
          { key: "dealers", label: "Dealer" },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            style={{
              border: "none",
              borderBottom: `2px solid ${tab === item.key ? "#0A0A0A" : "transparent"}`,
              backgroundColor: "transparent",
              color: tab === item.key ? "#171717" : "#737373",
              padding: "10px 0",
              marginBottom: "-1px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "business" ? (
        <>
          {overviewQuery.isLoading ? <p style={{ fontSize: "13px", color: "#737373" }}>Loading analytics...</p> : null}
          {overviewQuery.isError ? <p style={{ fontSize: "13px", color: "#991B1B" }}>Failed to load analytics.</p> : null}

          {overview ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px" }}>
              <MetricCard title="Total Jobs" value={String(overview.totalJobs)} icon={<BarChart2 size={14} strokeWidth={1.5} />} />
              <MetricCard title="Resolved/Completed" value={String(overview.resolvedOrCompleted)} icon={<CheckIcon />} />
              <MetricCard title="Cancelled" value={String(overview.cancelled)} icon={<TrendingUp size={14} strokeWidth={1.5} />} />
              <MetricCard title="Revisit Pending" value={String(overview.revisitPending)} icon={<Clock3 size={14} strokeWidth={1.5} />} />
              <MetricCard title="Avg Star Rating" value={overview.avgStarRating == null ? "—" : overview.avgStarRating.toFixed(2)} icon={<Star size={14} strokeWidth={1.5} />} />
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "technicians" ? (
        <section style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", overflow: "hidden" }}>
          {techniciansQuery.isLoading ? <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#737373" }}>Loading technician scorecards...</p> : null}
          {techniciansQuery.isError ? <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#991B1B" }}>Failed to load technician scorecards.</p> : null}
          {!techniciansQuery.isLoading && !techniciansQuery.isError ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA", color: "#737373", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Technician</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Total jobs</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Completion rate</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Avg rating</th>
                </tr>
              </thead>
              <tbody>
                {(techniciansQuery.data ?? []).map((item) => (
                  <tr key={item.technicianId} style={{ borderBottom: "1px solid #F5F5F5" }}>
                    <td style={{ padding: "10px 12px", color: "#171717" }}>{item.technicianName || "-"}</td>
                    <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
                    <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completionRate}%</td>
                    <td style={{ padding: "10px 12px", color: "#404040" }}>{item.avgStarRating == null ? "—" : item.avgStarRating.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === "brands" ? (
        <section style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", overflow: "hidden" }}>
          {brandsQuery.isLoading ? <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#737373" }}>Loading brand analytics...</p> : null}
          {brandsQuery.isError ? <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#991B1B" }}>Failed to load brand analytics.</p> : null}
          {!brandsQuery.isLoading && !brandsQuery.isError ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA", color: "#737373", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Brand</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Total jobs</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Completion rate</th>
                </tr>
              </thead>
              <tbody>
                {(brandsQuery.data ?? []).map((item) => (
                  <tr key={item.brandId} style={{ borderBottom: "1px solid #F5F5F5" }}>
                    <td style={{ padding: "10px 12px", color: "#171717" }}>{item.brandName || "-"}</td>
                    <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
                    <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === "dealers" ? (
        <section style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", overflow: "hidden" }}>
          {dealersQuery.isLoading ? <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#737373" }}>Loading dealer analytics...</p> : null}
          {dealersQuery.isError ? <p style={{ margin: 0, padding: "14px", fontSize: "13px", color: "#991B1B" }}>Failed to load dealer analytics.</p> : null}
          {!dealersQuery.isLoading && !dealersQuery.isError ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA", color: "#737373", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Dealer</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Total jobs</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E5E5E5" }}>Completion rate</th>
                </tr>
              </thead>
              <tbody>
                {(dealersQuery.data ?? []).map((item) => (
                  <tr key={item.dealerId} style={{ borderBottom: "1px solid #F5F5F5" }}>
                    <td style={{ padding: "10px 12px", color: "#171717" }}>{item.dealerName || "-"}</td>
                    <td style={{ padding: "10px 12px", color: "#404040" }}>{item.totalJobs}</td>
                    <td style={{ padding: "10px 12px", color: "#404040" }}>{item.completionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function CheckIcon() {
  return <span style={{ width: "14px", height: "14px", borderRadius: "50%", backgroundColor: "#10B981", display: "inline-block" }} />;
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>{title}</p>
        <span style={{ color: "#A3A3A3", lineHeight: 0 }}>{icon}</span>
      </div>
      <p style={{ margin: 0, fontSize: "28px", fontWeight: 600, color: "#171717", letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}
