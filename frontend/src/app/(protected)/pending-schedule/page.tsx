"use client";

import { JobTypeChip } from "@/components/ui/job-type-chip";
import { ApiError } from "@/lib/api/client";
import {
  batchScheduleJobs,
  type BatchScheduleInput,
} from "@/lib/api/batch-schedule";
import {
  fetchOfficeTechnicians,
  fetchPendingScheduleJobs,
  schedulePendingJob,
} from "@/lib/api/office";
import type { PendingScheduleJob, SchedulePendingJobInput } from "@/types/office";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Users, X } from "lucide-react";
import { useSnackbar } from "notistack";
import { useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function toDateTimeLocalValue(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function initialScheduleAt(): string {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  return toDateTimeLocalValue(next);
}

function toIsoStringFromLocal(value: string): string {
  return new Date(value).toISOString();
}

function daysWaiting(createdAt: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function daysColor(days: number): string {
  if (days >= 7) return "#EF4444";
  if (days >= 3) return "#F59E0B";
  return "#737373";
}

function slaTier(days: number): "ok" | "amber" | "red" {
  if (days >= 7) return "red";
  if (days >= 3) return "amber";
  return "ok";
}

const SLA_COLORS = {
  ok:    { text: "#525252", track: "#F5F5F5",  fill: "#D1D5DB" },
  amber: { text: "#92400E", track: "#FEF3C7",  fill: "#F59E0B" },
  red:   { text: "#991B1B", track: "#FEE2E2",  fill: "#EF4444" },
};

// ─── inline row state ────────────────────────────────────────────────────────

type RowState = {
  scheduledAt: string;
  technicianId: string;
  open: boolean;
};

// ─── Batch Schedule Modal ────────────────────────────────────────────────────

type BatchModalProps = {
  jobs: PendingScheduleJob[];
  technicians: Array<{ id: string; name: string; activeAssignments: number }>;
  onClose: () => void;
  onSuccess: () => void;
};

function BatchModal({ jobs, technicians, onClose, onSuccess }: BatchModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(jobs.map((j) => j.id));
  const [scheduledAt, setScheduledAt] = useState(initialScheduleAt());
  const [technicianId, setTechnicianId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: (input: BatchScheduleInput) => batchScheduleJobs(input),
    onSuccess: () => {
      enqueueSnackbar("Jobs scheduled successfully", { variant: "success" });
      onSuccess();
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to batch schedule jobs.";
      setError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.length === jobs.length ? [] : jobs.map((j) => j.id),
    );
  }

  function handleConfirm() {
    if (selectedIds.length === 0) {
      setError("Select at least one job.");
      return;
    }
    if (!scheduledAt) {
      setError("Select a date and time.");
      return;
    }
    setError(null);
    mutation.mutate({
      jobIds: selectedIds,
      scheduledAt: toIsoStringFromLocal(scheduledAt),
      technicianId: technicianId || undefined,
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#FAFAFA",
          borderRadius: "14px",
          border: "1px solid #E5E5E5",
          padding: "28px",
          width: "560px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: "#0A0A0A",
            }}
          >
            Batch Schedule
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#737373",
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Jobs list */}
        <div
          style={{
            border: "1px solid #E5E5E5",
            borderRadius: "10px",
            overflow: "hidden",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #E5E5E5",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              backgroundColor: "#FAFAFA",
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.length === jobs.length}
              onChange={toggleAll}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#525252" }}>
              {selectedIds.length} / {jobs.length} selected
            </span>
          </div>
          {jobs.map((job) => {
            const days = daysWaiting(job.createdAt);
            const overdue = days >= 7;
            return (
              <div
                key={job.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderBottom: "1px solid #F9F9F9",
                  backgroundColor: selectedIds.includes(job.id) ? "#FAFAFA" : "#FAFAFA",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(job.id)}
                  onChange={() => toggleId(job.id)}
                  style={{ cursor: "pointer" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#171717",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {job.customerName}
                  </div>
                  <div style={{ fontSize: "12px", color: "#737373" }}>
                    {job.id.slice(0, 8)}…
                  </div>
                </div>
                <JobTypeChip type={job.type} />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: overdue ? 600 : 400,
                    color: daysColor(days),
                    textDecoration: overdue ? "underline" : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {overdue ? "⊙ " : ""}{days}d
                </span>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "#404040",
                marginBottom: "6px",
              }}
            >
              Scheduled date &amp; time
            </label>
            <div style={{ position: "relative" }}>
              <Calendar
                size={14}
                strokeWidth={1.5}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#737373",
                  pointerEvents: "none",
                }}
              />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px 8px 32px",
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                required
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "#404040",
                marginBottom: "6px",
              }}
            >
              Technician (optional)
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 10px",
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              <option value="">No technician assignment</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.activeAssignments})
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div
              style={{
                borderRadius: "8px",
                border: "1px solid rgba(239,68,68,0.2)",
                backgroundColor: "rgba(239,68,68,0.08)",
                padding: "10px 12px",
                color: "#EF4444",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={mutation.isPending || selectedIds.length === 0}
            onClick={handleConfirm}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "8px",
              padding: "11px 14px",
              backgroundColor: "#0A0A0A",
              color: "#FAFAFA",
              fontSize: "13px",
              fontWeight: 600,
              cursor: mutation.isPending || selectedIds.length === 0 ? "not-allowed" : "pointer",
              opacity: mutation.isPending || selectedIds.length === 0 ? 0.5 : 1,
            }}
          >
            {mutation.isPending
              ? "Scheduling…"
              : `Schedule ${selectedIds.length} job${selectedIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline row form ─────────────────────────────────────────────────────────

type InlineFormProps = {
  job: PendingScheduleJob;
  technicians: Array<{ id: string; name: string; activeAssignments: number }>;
  onClose: () => void;
  onSuccess: () => void;
};

function InlineForm({ job, technicians, onClose, onSuccess }: InlineFormProps) {
  const [scheduledAt, setScheduledAt] = useState(initialScheduleAt());
  const [technicianId, setTechnicianId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: (payload: SchedulePendingJobInput) => schedulePendingJob(job.id, payload),
    onSuccess: () => {
      enqueueSnackbar("Job scheduled successfully", { variant: "success" });
      onSuccess();
    },
    onError: (err) => {
      let msg = "Unable to schedule job right now.";
      if (err instanceof ApiError) {
        msg = err.status === 409 ? "Version conflict. Refresh and retry." : err.message;
      }
      setError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  function handleSave() {
    if (!scheduledAt) {
      setError("Select a date and time.");
      return;
    }
    setError(null);
    mutation.mutate({
      scheduledAt: toIsoStringFromLocal(scheduledAt),
      expectedVersion: job.version,
      technicianId: technicianId || undefined,
    });
  }

  return (
    <tr style={{ backgroundColor: "#FAFAFA" }}>
      <td
        colSpan={10}
        style={{ padding: "14px 16px", borderBottom: "1px solid #E5E5E5" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 500,
                color: "#525252",
                marginBottom: "4px",
              }}
            >
              Date &amp; time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              style={{
                padding: "7px 10px",
                border: "1px solid #E5E5E5",
                borderRadius: "7px",
                fontSize: "13px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 500,
                color: "#525252",
                marginBottom: "4px",
              }}
            >
              Technician (optional)
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              style={{
                padding: "7px 10px",
                border: "1px solid #E5E5E5",
                borderRadius: "7px",
                fontSize: "13px",
                minWidth: "180px",
              }}
            >
              <option value="">Unassigned</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.activeAssignments})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={mutation.isPending}
            onClick={handleSave}
            style={{
              padding: "7px 16px",
              border: "none",
              borderRadius: "7px",
              backgroundColor: "#0A0A0A",
              color: "#FAFAFA",
              fontSize: "13px",
              fontWeight: 500,
              cursor: mutation.isPending ? "not-allowed" : "pointer",
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 12px",
              border: "1px solid #E5E5E5",
              borderRadius: "7px",
              backgroundColor: "#FAFAFA",
              color: "#525252",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          {error ? (
            <span style={{ fontSize: "12px", color: "#EF4444" }}>{error}</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PendingSchedulePage() {
  const queryClient = useQueryClient();

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const pendingScheduleQuery = useQuery({
    queryKey: ["office", "pending-schedule"],
    queryFn: () => fetchPendingScheduleJobs(100),
  });

  const techniciansQuery = useQuery({
    queryKey: ["office", "technicians"],
    queryFn: fetchOfficeTechnicians,
  });

  const queue = pendingScheduleQuery.data ?? [];
  const technicians = techniciansQuery.data ?? [];

  function handleJobSuccess() {
    queryClient.invalidateQueries({ queryKey: ["office", "pending-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["office", "technicians"] });
  }

  const TABLE_HEADERS = [
    "JOB ID",
    "CUSTOMER",
    "STATUS",
    "TYPE",
    "BRAND",
    "DEALER",
    "SUBMITTED",
    "SCHEDULED",
    "DAYS WAITING",
    "ACTIONS",
  ];

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left" as const,
    fontSize: "11px",
    fontWeight: 500,
    color: "#A3A3A3",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap" as const,
    borderBottom: "1px solid #E5E5E5",
    backgroundColor: "#FAFAFA",
  };

  return (
    <section style={{ padding: "24px", maxWidth: "1200px" }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
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
            Schedule and Assign
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#737373",
              margin: "4px 0 0",
              fontWeight: 400,
            }}
          >
            {queue.length} job{queue.length === 1 ? "" : "s"} awaiting scheduling
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowBatchModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #E5E5E5",
            backgroundColor: "#0A0A0A",
            color: "#FAFAFA",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <Users size={14} strokeWidth={1.5} />
          Batch schedule
        </button>
      </div>

      {/* Table card */}
      <div
        style={{
          backgroundColor: "#FAFAFA",
          borderRadius: "12px",
          border: "1px solid #E5E5E5",
          overflow: "hidden",
        }}
      >
        {pendingScheduleQuery.isLoading ? (
          <div style={{ padding: "24px", fontSize: "13px", color: "#737373" }}>
            Loading queue…
          </div>
        ) : null}

        {pendingScheduleQuery.isError ? (
          <div style={{ padding: "24px", fontSize: "13px", color: "#EF4444" }}>
            Failed to load pending-schedule jobs.
          </div>
        ) : null}

        {!pendingScheduleQuery.isLoading && !pendingScheduleQuery.isError && queue.length === 0 ? (
          <div style={{ padding: "24px", fontSize: "13px", color: "#737373" }}>
            No pending-schedule jobs right now.
          </div>
        ) : null}

        {queue.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "820px",
              }}
            >
              <thead>
                <tr>
                  {TABLE_HEADERS.map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((job) => {
                  const days = daysWaiting(job.createdAt);
                  const isExpanded = expandedJobId === job.id;

                  return [
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #F9F9F9",
                        backgroundColor: isExpanded ? "#F9F9F9" : "#FAFAFA",
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#F5F5F5"; }}
                      onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#FAFAFA"; }}
                    >
                      {/* JOB ID */}
                      <td
                        style={{
                          padding: "14px 12px",
                          fontSize: "12px",
                          color: "#737373",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {job.id.slice(0, 8)}…
                      </td>

                      {/* CUSTOMER */}
                      <td style={{ padding: "14px 12px" }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#171717",
                          }}
                        >
                          {job.customerName}
                        </div>
                        <div style={{ fontSize: "12px", color: "#737373" }}>
                          {job.address}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: "14px 12px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "9999px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: "#F9F9F9",
                            color: "#525252",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* TYPE */}
                      <td style={{ padding: "14px 12px" }}>
                        <JobTypeChip type={job.type} />
                      </td>

                      {/* BRAND */}
                      <td
                        style={{
                          padding: "14px 12px",
                          fontSize: "13px",
                          color: job.brandName ? "#171717" : "#737373",
                        }}
                      >
                        {job.brandName ?? "—"}
                      </td>

                      {/* DEALER */}
                      <td
                        style={{
                          padding: "14px 12px",
                          fontSize: "13px",
                          color: job.dealerName ? "#171717" : "#737373",
                        }}
                      >
                        {job.dealerName ?? "—"}
                      </td>

                      {/* SUBMITTED */}
                      <td
                        style={{
                          padding: "14px 12px",
                          fontSize: "13px",
                          color: "#404040",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>

                      {/* SCHEDULED */}
                      <td
                        style={{
                          padding: "14px 12px",
                          fontSize: "13px",
                          color: job.scheduledAt ? "#171717" : "#737373",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {job.scheduledAt
                          ? new Date(job.scheduledAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>

                      {/* DAYS WAITING */}
                      <td style={{ padding: "14px 12px" }}>
                        {(() => {
                          const tier = slaTier(days);
                          const c = SLA_COLORS[tier];
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "80px" }}>
                              <span style={{ fontSize: "13px", fontWeight: tier === "ok" ? 400 : 600, color: c.text }}>
                                {days}d
                              </span>
                              <div style={{ height: "4px", borderRadius: "9999px", backgroundColor: c.track, overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: "9999px", backgroundColor: c.fill, width: `${Math.min(100, (days / 10) * 100)}%` }} />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* SCHEDULE & ASSIGN */}
                      <td style={{ padding: "14px 12px" }}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedJobId((prev) =>
                              prev === job.id ? null : job.id,
                            )
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            borderRadius: "7px",
                            border: `1px solid ${isExpanded ? "#0A0A0A" : "#E5E5E5"}`,
                            backgroundColor: isExpanded ? "#0A0A0A" : "#FAFAFA",
                            color: isExpanded ? "#FAFAFA" : "#404040",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Calendar size={12} strokeWidth={1.5} />
                          {isExpanded ? "Close" : "Schedule"}
                        </button>
                      </td>
                    </tr>,

                    isExpanded ? (
                      <InlineForm
                        key={`${job.id}-form`}
                        job={job}
                        technicians={technicians}
                        onClose={() => setExpandedJobId(null)}
                        onSuccess={() => {
                          handleJobSuccess();
                          setExpandedJobId(null);
                        }}
                      />
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Batch Schedule Modal */}
      {showBatchModal ? (
        <BatchModal
          jobs={queue}
          technicians={technicians}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            handleJobSuccess();
            setShowBatchModal(false);
          }}
        />
      ) : null}
    </section>
  );
}
