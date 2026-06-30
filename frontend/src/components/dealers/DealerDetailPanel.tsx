"use client";

import { fetchDealerJobs } from "@/lib/api/operations";
import { isTerminalStatus } from "@/lib/job-status-groups";
import type { DealerDirectoryItem, DealerJobItem } from "@/types/operations";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Tab = "active" | "history";

type Props = {
  dealer: DealerDirectoryItem;
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
        backgroundColor: "#F9F9F9",
        color: "#525252",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function DealerDetailPanel({ dealer, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("active");

  const jobsQuery = useQuery({
    queryKey: ["dealer-jobs", dealer.id],
    queryFn: () => fetchDealerJobs(dealer.id),
  });

  const allJobs: DealerJobItem[] = jobsQuery.data ?? [];
  const activeJobs = useMemo(
    () => allJobs.filter((j) => !isTerminalStatus(j.status)),
    [allJobs],
  );
  const historyJobs = useMemo(
    () => allJobs.filter((j) => isTerminalStatus(j.status)),
    [allJobs],
  );

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
            backgroundColor: "#FAFAFA",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{ fontSize: "17px", fontWeight: 600, color: "#0A0A0A" }}
            >
              {dealer.name}
            </div>
            <div
              style={{ fontSize: "12px", color: "#737373", marginTop: "2px" }}
            >
              {dealer.isActive ? (
                <span style={{ color: "#10B981" }}>● Active</span>
              ) : (
                <span style={{ color: "#737373" }}>○ Inactive</span>
              )}
              {dealer.region ? ` · ${dealer.region}` : ""}
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
              backgroundColor: "#FAFAFA",
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

        {/* Stats row */}
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#FAFAFA",
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
              Active
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#0A0A0A",
                marginTop: "4px",
              }}
            >
              {activeJobs.length}
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
              Total Jobs
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#0A0A0A",
                marginTop: "4px",
              }}
            >
              {allJobs.length}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            borderBottom: "1px solid #E5E5E5",
            padding: "0 24px",
            display: "flex",
            backgroundColor: "#FAFAFA",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            style={tabStyle("active")}
            onClick={() => setTab("active")}
          >
            Active ({activeJobs.length})
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
                borderBottom: "1px solid #E5E5E5",
                textDecoration: "none",
                backgroundColor: "#FAFAFA",
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
              <StatusPill status={job.status} />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
