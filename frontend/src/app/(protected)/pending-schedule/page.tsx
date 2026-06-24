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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: BatchScheduleInput) => batchScheduleJobs(input),
    onSuccess: (result) => {
      const errCount = result.errors?.length ?? 0;
      if (errCount > 0) {
        setSuccessMsg(
          `Scheduled ${result.scheduled} job(s). ${errCount} error(s) occurred.`,
        );
      } else {
        setSuccessMsg(`Successfully scheduled ${result.scheduled} job(s).`);
      }
      setError(null);
      onSuccess();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to batch schedule jobs.");
      }
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
          backgroundColor: "#fff",
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
                  borderBottom: "1px solid #F5F5F5",
                  backgroundColor: selectedIds.includes(job.id) ? "#FAFAFA" : "#fff",
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
                  color: "#A3A3A3",
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
                border: "1px solid #FECACA",
                backgroundColor: "#FEF2F2",
                padding: "10px 12px",
                color: "#EF4444",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          ) : null}

          {successMsg ? (
            <div
              style={{
                borderRadius: "8px",
                border: "1px solid #D1FAE5",
                backgroundColor: "#F0FDF4",
                padding: "10px 12px",
                color: "#10B981",
                fontSize: "13px",
              }}
            >
              {successMsg}
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: SchedulePendingJobInput) => schedulePendingJob(job.id, payload),
    onSuccess: (result) => {
      const conflictCount = result.conflictJobIds?.length ?? 0;
      const note = conflictCount > 0 ? ` (${conflictCount} conflict ref(s) ack'd)` : "";
      setSuccessMsg(`Job updated to ${result.status}.${note}`);
      setError(null);
      onSuccess();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("Version conflict. Refresh and retry.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Unable to schedule job right now.");
      }
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
        colSpan={9}
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
              backgroundColor: "#fff",
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
          {successMsg ? (
            <span style={{ fontSize: "12px", color: "#10B981" }}>{successMsg}</span>
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
    "TYPE",
    "BRAND",
    "DEALER",
    "SUBMITTED",
    "DAYS WAITING",
    "SCHEDULE & ASSIGN",
  ];

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left" as const,
    fontSize: "11px",
    fontWeight: 600,
    color: "#525252",
    letterSpacing: "0.04em",
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
              fontSize: "32px",
              fontWeight: 700,
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
          backgroundColor: "#fff",
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
                  const overdue = days >= 7;
                  const color = daysColor(days);
                  const isExpanded = expandedJobId === job.id;

                  return [
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #F5F5F5",
                        backgroundColor: isExpanded ? "#F5F5F5" : "#fff",
                      }}
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

                      {/* DAYS WAITING */}
                      <td style={{ padding: "14px 12px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            color,
                            fontWeight: overdue ? 600 : 400,
                            textDecoration: overdue ? "underline" : "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {overdue ? "⊙" : ""} {days}d
                        </span>
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
                            backgroundColor: isExpanded ? "#0A0A0A" : "#fff",
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
