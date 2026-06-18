"use client";

import { StatusChip } from "@/components/ui/status-chip";
import { JobTypeChip } from "@/components/ui/job-type-chip";
import { useAuth } from "@/contexts/auth-context";
import { RoleGate } from "@/components/auth/role-gate";
import { fetchJobs } from "@/lib/api/jobs";
import { isTerminalStatus } from "@/lib/job-status-groups";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

const PAGE_SIZE = 10;

export default function JobsHistoryPage() {
  const { session } = useAuth();
  const router = useRouter();
  const isMobile = useMobileBreakpoint();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", "history", session?.user.userId, page],
    queryFn: () =>
      fetchJobs({
        technicianId: session?.user.userId,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: Boolean(session?.user.userId),
  });

  const historyJobs = useMemo(
    () => (data?.jobs ?? []).filter((job) => isTerminalStatus(job.status)),
    [data?.jobs],
  );

  return (
    <RoleGate allowedRoles={["technician"]}>
      <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1100px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Job History
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>
            Completed and resolved jobs
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid #E5E5E5" }}>
          <button
            type="button"
            onClick={() => router.push("/jobs")}
            style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 400, color: "#737373", backgroundColor: "transparent", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", marginBottom: "-1px" }}
          >
            Active jobs
          </button>
          <button
            type="button"
            style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "#171717", backgroundColor: "transparent", border: "none", borderBottom: "2px solid #0A0A0A", cursor: "pointer", marginBottom: "-1px" }}
          >
            History
          </button>
        </div>

        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "20px", fontSize: "13px", color: "#737373" }}>Loading history…</div>
          ) : historyJobs.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#737373", fontSize: "13px" }}>
              No completed jobs yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                  {["Customer", "Type", "Status", "Scheduled", "Logged"].map((heading) => (
                    <th key={heading} style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "#525252" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyJobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: "1px solid #F5F5F5" }}>
                    <td style={{ padding: "14px 12px" }}>
                      <Link href={`/jobs/${job.id}`} style={{ fontSize: "13px", fontWeight: 500, color: "#171717", textDecoration: "none" }}>
                        {job.customerName}
                      </Link>
                      <div style={{ fontSize: "12px", color: "#737373" }}>{job.address}</div>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <JobTypeChip type={job.type} />
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <StatusChip status={job.status} />
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: "13px", color: "#404040" }}>
                      {job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: "13px", color: "#737373" }}>
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {(data?.page?.totalPages ?? 0) > 1 ? (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
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
        ) : null}
      </section>
    </RoleGate>
  );
}
