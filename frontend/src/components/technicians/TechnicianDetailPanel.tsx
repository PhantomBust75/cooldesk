"use client";

import { fetchTechnicianJobs } from "@/lib/api/operations";
import { isTerminalStatus } from "@/lib/job-status-groups";
import type { TechnicianDirectoryItem, TechnicianJob } from "@/types/operations";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Tab = "active" | "history";

type Props = {
  technician: TechnicianDirectoryItem;
  onClose: () => void;
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: "#F5F5F5",
        color: "#525252",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function TechnicianDetailPanel({ technician, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("active");

  const jobsQuery = useQuery({
    queryKey: ["technician-jobs", technician.id],
    queryFn: () => fetchTechnicianJobs(technician.id),
  });

  const allJobs: TechnicianJob[] = jobsQuery.data ?? [];
  const activeJobs = useMemo(
    () => allJobs.filter((j) => !isTerminalStatus(j.status)),
    [allJobs],
  );
  const historyJobs = useMemo(
    () => allJobs.filter((j) => isTerminalStatus(j.status)),
    [allJobs],
  );

  const totalRevenue = useMemo(
    () => historyJobs.reduce((sum, j) => sum + j.amountCollected, 0),
    [historyJobs],
  );
  const ratings = useMemo(
    () =>
      historyJobs
        .map((j) => j.avgRating)
        .filter((r): r is number => r !== null),
    [historyJobs],
  );
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

  const displayJobs = tab === "active" ? activeJobs : historyJobs;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: tab === t ? 600 : 400,
    color: tab === t ? "#0A0A0A" : "#737373",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: tab === t ? "2px solid #0A0A0A" : "2px solid transparent",
    cursor: "pointer",
    marginBottom: "-1px",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="overlay-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "480px",
          maxWidth: "100vw",
          backgroundColor: "#FAFAFA",
          borderLeft: "1px solid #E5E5E5",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #E5E5E5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#fff",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{ fontSize: "17px", fontWeight: 600, color: "#0A0A0A" }}
            >
              {technician.name}
            </div>
            <div
              style={{ fontSize: "12px", color: "#737373", marginTop: "2px" }}
            >
              {technician.isActive ? (
                <span style={{ color: "#10B981" }}>● Active</span>
              ) : (
                <span style={{ color: "#737373" }}>○ Inactive</span>
              )}
              {" · "}
              {technician.activeAssignments} active assignment
              {technician.activeAssignments !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#525252",
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Performance row */}
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #E5E5E5",
            display: "flex",
            gap: "24px",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#737373",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Completed
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#0A0A0A",
                marginTop: "4px",
              }}
            >
              {historyJobs.length}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#737373",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Revenue
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#0A0A0A",
                marginTop: "4px",
              }}
            >
              {totalRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#737373",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Avg rating
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#0A0A0A",
                marginTop: "4px",
              }}
            >
              {avgRating ?? "—"}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            borderBottom: "1px solid #E5E5E5",
            padding: "0 24px",
            display: "flex",
            backgroundColor: "#fff",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            style={tabStyle("active")}
            onClick={() => setTab("active")}
          >
            Active Jobs ({activeJobs.length})
          </button>
          <button
            type="button"
            style={tabStyle("history")}
            onClick={() => setTab("history")}
          >
            History ({historyJobs.length})
          </button>
        </div>

        {/* Job list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {jobsQuery.isLoading && (
            <div
              style={{ padding: "24px", fontSize: "13px", color: "#737373" }}
            >
              Loading…
            </div>
          )}
          {jobsQuery.isError && (
            <div
              style={{ padding: "24px", fontSize: "13px", color: "#EF4444" }}
            >
              Failed to load jobs.
            </div>
          )}
          {!jobsQuery.isLoading && displayJobs.length === 0 && (
            <div
              style={{ padding: "24px", fontSize: "13px", color: "#737373" }}
            >
              No jobs in this category.
            </div>
          )}
          {displayJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 24px",
                borderBottom: "1px solid #F5F5F5",
                textDecoration: "none",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#171717",
                    marginBottom: "2px",
                  }}
                >
                  {job.customerName}
                </div>
                <div style={{ fontSize: "12px", color: "#737373" }}>
                  {job.id.slice(0, 8).toUpperCase()} ·{" "}
                  {new Date(job.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "4px",
                  flexShrink: 0,
                }}
              >
                <StatusPill status={job.status} />
                {job.amountCollected > 0 && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#404040",
                      fontWeight: 500,
                    }}
                  >
                    {job.amountCollected.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                    })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
