"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { fetchAnalyticsOverview } from "@/lib/api/operations";
import { fetchJobs } from "@/lib/api/jobs";
import { StatusChip } from "@/components/ui/status-chip";
import { JobTypeChip, BrandSwatch } from "@/components/ui/job-type-chip";
import { AlertTriangle, ArrowRight, Briefcase } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

export default function DashboardPage() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const isMobile = useMobileBreakpoint();

  const analyticsQuery = useQuery({
    queryKey: ["dashboard", "analytics", 7],
    queryFn: () => fetchAnalyticsOverview(7),
  });

  const needsRevisitQuery = useQuery({
    queryKey: ["dashboard", "needs-revisit"],
    queryFn: () => fetchJobs({ status: "needs_revisit", page: 1, limit: 8 }),
  });

  const recentJobsQuery = useQuery({
    queryKey: ["dashboard", "recent-jobs"],
    queryFn: () => fetchJobs({ page: 1, limit: 10 }),
  });

  const metrics = analyticsQuery.data;
  const needsRevisitJobs = needsRevisitQuery.data?.jobs ?? [];
  const recentJobs = recentJobsQuery.data?.jobs ?? [];

  return (
    <RoleGate allowedRoles={["owner", "office_staff", "technician", "dealer"]}>
      <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1400px" }}>
        <div style={{ marginBottom: "24px" }}>
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
            The Control Tower
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#737373",
              margin: "3px 0 0",
              fontWeight: 400,
            }}
          >
            Organization-wide overview · last 7 days
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <KpiCard
            title="Total jobs (7d)"
            value={metrics ? String(metrics.totalJobs) : "—"}
            accent="#0A0A0A"
          />
          <KpiCard
            title="Completion rate"
            value={metrics ? `${metrics.resolvedOrCompleted}%` : "—"}
            accent="#10B981"
          />
          <KpiCard
            title="Revisit pending"
            value={metrics ? String(metrics.revisitPending) : "—"}
            accent="#F59E0B"
          />
          <KpiCard
            title="Cancelled"
            value={metrics ? String(metrics.cancelled) : "—"}
            accent="#6366F1"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <AlertTriangle size={14} strokeWidth={1.5} color="#B45309" />
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#171717",
                  margin: 0,
                }}
              >
                Needs revisit
              </h2>
            </div>

            {needsRevisitJobs.length === 0 ? (
              <p style={{ margin: 0, color: "#737373", fontSize: "13px" }}>
                No jobs currently need revisiting.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #FDE68A" }}>
                      {[
                        "Job ID",
                        "Customer",
                        "Technician",
                        "Waiting",
                        "Type",
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontSize: "12px",
                            color: "#92400E",
                            fontWeight: 500,
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {needsRevisitJobs.map((job) => (
                      <tr
                        key={job.id}
                        style={{
                          borderBottom: "1px solid #FEF3C7",
                          cursor: "pointer",
                        }}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                      >
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: "12px",
                            color: "#525252",
                          }}
                        >
                          {job.id}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontSize: "13px",
                            color: "#404040",
                          }}
                        >
                          {job.customerName}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontSize: "13px",
                            color: "#404040",
                          }}
                        >
                          {job.assignedTechnicianName ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontSize: "13px",
                            color: "#404040",
                          }}
                        >
                          {now
                            ? Math.max(
                                1,
                                Math.ceil(
                                  (now - new Date(job.createdAt).getTime()) /
                                    (1000 * 60 * 60 * 24),
                                ),
                              )
                            : "—"}
                          d
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              backgroundColor: "#FEE2E2",
                              color: "#991B1B",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 500,
                            }}
                          >
                            Needs revisit
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #E5E5E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#171717",
                  margin: 0,
                }}
              >
                Recent jobs
              </h2>
              <Link
                href="/jobs"
                style={{
                  fontSize: "12px",
                  color: "#525252",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                View all <ArrowRight size={12} strokeWidth={1.5} />
              </Link>
            </div>

            {recentJobs.length === 0 ? (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "#737373",
                }}
              >
                <Briefcase
                  size={32}
                  strokeWidth={1}
                  style={{
                    margin: "0 auto 12px",
                    display: "block",
                    opacity: 0.4,
                    color: "#D4D4D4",
                  }}
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
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      {[
                        "Job ID",
                        "Status",
                        "Type",
                        "Brand",
                        "Customer",
                        "Assigned to",
                      ].map((heading) => (
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
                    {recentJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{
                          borderBottom: "1px solid #F5F5F5",
                          cursor: "pointer",
                        }}
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
                          <BrandSwatch
                            name={job.brandName ?? "—"}
                            colorHex={null}
                          />
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            color: "#404040",
                            fontSize: "13px",
                          }}
                        >
                          {job.customerName}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            color: "#404040",
                            fontSize: "13px",
                          }}
                        >
                          {job.assignedTechnicianName ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </RoleGate>
  );
}
