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
import { Calendar, ChevronRight, Users, X } from "lucide-react";
import { useSnackbar } from "notistack";
import { formatDayMonth } from "@/lib/format-date";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useState } from "react";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function slaTier(days: number): "ok" | "amber" | "red" {
  if (days >= 7) return "red";
  if (days >= 3) return "amber";
  return "ok";
}

const SLA_COLORS = {
  ok:    { text: "#525252", track: "#F5F5F5", fill: "#D1D5DB" },
  amber: { text: "#92400E", track: "#FEF3C7", fill: "#F59E0B" },
  red:   { text: "#991B1B", track: "#FEE2E2", fill: "#EF4444" },
};

// ─── Batch Schedule Modal ─────────────────────────────────────────────────────

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
    if (selectedIds.length === 0) { setError("Select at least one job."); return; }
    if (!scheduledAt) { setError("Select a date and time."); return; }
    setError(null);
    mutation.mutate({
      jobIds: selectedIds,
      scheduledAt: toIsoStringFromLocal(scheduledAt),
      technicianId: technicianId || undefined,
    });
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "#FAFAFA", borderRadius: "14px", border: "1px solid #E5E5E5", padding: "28px", width: "560px", maxWidth: "calc(100vw - 32px)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: "#171717" }}>Batch Schedule</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#737373" }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #E5E5E5", display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#FAFAFA" }}>
            <input type="checkbox" checked={selectedIds.length === jobs.length} onChange={toggleAll} style={{ cursor: "pointer" }} />
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#525252" }}>{selectedIds.length} / {jobs.length} selected</span>
          </div>
          {jobs.map((job) => {
            const days = daysWaiting(job.createdAt);
            const overdue = days >= 7;
            return (
              <div key={job.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderBottom: "1px solid #F9F9F9", backgroundColor: "#FAFAFA" }}>
                <input type="checkbox" checked={selectedIds.includes(job.id)} onChange={() => toggleId(job.id)} style={{ cursor: "pointer" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.customerName}</div>
                  <div style={{ fontSize: "12px", color: "#737373" }}>{job.id.slice(0, 8)}…</div>
                </div>
                <JobTypeChip type={job.type} />
                <span style={{ fontSize: "12px", fontWeight: overdue ? 600 : 400, color: overdue ? "#991B1B" : "#737373", whiteSpace: "nowrap" }}>
                  {days}d
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#404040", marginBottom: "6px" }}>Scheduled date &amp; time</label>
            <DateTimePicker value={scheduledAt || null} onChange={(next) => setScheduledAt(next ?? "")} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#404040", marginBottom: "6px" }}>Technician (optional)</label>
            <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }}>
              <option value="">No technician assignment</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.activeAssignments})</option>)}
            </select>
          </div>
          {error ? <div style={{ borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)", backgroundColor: "rgba(239,68,68,0.08)", padding: "10px 12px", color: "#EF4444", fontSize: "13px" }}>{error}</div> : null}
          <button
            type="button"
            disabled={mutation.isPending || selectedIds.length === 0}
            onClick={handleConfirm}
            style={{ width: "100%", border: "none", borderRadius: "8px", padding: "11px 14px", backgroundColor: "#0A0A0A", color: "#FAFAFA", fontSize: "13px", fontWeight: 600, cursor: mutation.isPending || selectedIds.length === 0 ? "not-allowed" : "pointer", opacity: mutation.isPending || selectedIds.length === 0 ? 0.5 : 1 }}
          >
            {mutation.isPending ? "Scheduling…" : `Schedule ${selectedIds.length} job${selectedIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PendingSchedulePage() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [showBatchModal, setShowBatchModal] = useState(false);
  // Inline state: per-job date and technician
  const [scheduling, setScheduling] = useState<Record<string, string>>({});
  const [assigning, setAssigning]   = useState<Record<string, string>>({});
  const [savingId, setSavingId]     = useState<string | null>(null);

  const pendingScheduleQuery = useQuery({
    queryKey: ["office", "pending-schedule"],
    queryFn: () => fetchPendingScheduleJobs(100),
  });

  const techniciansQuery = useQuery({
    queryKey: ["office", "technicians"],
    queryFn: fetchOfficeTechnicians,
  });

  const queue       = pendingScheduleQuery.data ?? [];
  const technicians = techniciansQuery.data ?? [];

  const scheduleMutation = useMutation({
    mutationFn: ({ jobId, payload }: { jobId: string; payload: SchedulePendingJobInput }) =>
      schedulePendingJob(jobId, payload),
    onSuccess: (_data, { jobId }) => {
      enqueueSnackbar("Job scheduled successfully", { variant: "success" });
      setSavingId(null);
      setScheduling((s) => { const n = { ...s }; delete n[jobId]; return n; });
      setAssigning((s) => { const n = { ...s }; delete n[jobId]; return n; });
      queryClient.invalidateQueries({ queryKey: ["office", "pending-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["office", "technicians"] });
    },
    onError: (err, { jobId: _jobId }) => {
      const msg = err instanceof ApiError ? err.message : "Unable to schedule job right now.";
      enqueueSnackbar(msg, { variant: "error" });
      setSavingId(null);
    },
  });

  function handleConfirm(job: PendingScheduleJob) {
    const dateVal = scheduling[job.id];
    if (!dateVal) { enqueueSnackbar("Select a date and time first.", { variant: "warning" }); return; }
    setSavingId(job.id);
    scheduleMutation.mutate({
      jobId: job.id,
      payload: {
        scheduledAt: toIsoStringFromLocal(dateVal),
        expectedVersion: job.version,
        technicianId: assigning[job.id] || undefined,
      },
    });
  }

  function handleBatchSuccess() {
    queryClient.invalidateQueries({ queryKey: ["office", "pending-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["office", "technicians"] });
  }

  const TABLE_HEADERS = ["JOB ID", "CUSTOMER", "TYPE", "BRAND", "DEALER", "SUBMITTED", "DAYS WAITING", "SCHEDULE & ASSIGN", ""];

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    textAlign: "left",
    fontSize: "11px",
    fontWeight: 500,
    color: "#A3A3A3",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #E5E5E5",
    backgroundColor: "#FAFAFA",
  };

  return (
    <section style={{ padding: "24px 24px 320px", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Schedule and Assign
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "4px 0 0", fontWeight: 400 }}>
            {queue.length} job{queue.length === 1 ? "" : "s"} awaiting scheduling
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowBatchModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#171717", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
        >
          <Users size={14} strokeWidth={1.5} />
          Batch schedule
        </button>
      </div>

      {/* Table card */}
      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
        {pendingScheduleQuery.isLoading ? (
          <div style={{ padding: "24px", fontSize: "13px", color: "#737373" }}>Loading queue…</div>
        ) : pendingScheduleQuery.isError ? (
          <div style={{ padding: "24px", fontSize: "13px", color: "#EF4444" }}>Failed to load pending-schedule jobs.</div>
        ) : queue.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#737373" }}>
            No jobs pending schedule — all caught up!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
              <thead>
                <tr>
                  {TABLE_HEADERS.map((h) => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {queue.map((job) => {
                  const days   = daysWaiting(job.createdAt);
                  const tier   = slaTier(days);
                  const c      = SLA_COLORS[tier];
                  const dateVal = scheduling[job.id] ?? "";
                  const techVal = assigning[job.id]  ?? "";
                  const canConfirm = !!dateVal;
                  const isSaving   = savingId === job.id;

                  return (
                    <tr
                      key={job.id}
                      style={{ borderBottom: "1px solid #F5F5F5" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
                    >
                      {/* JOB ID */}
                      <td style={{ padding: "14px 16px", fontSize: "12px", color: "#737373", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {job.id.slice(0, 8)}…
                      </td>

                      {/* CUSTOMER */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#171717" }}>{job.customerName}</div>
                        {job.address ? <div style={{ fontSize: "12px", color: "#737373", marginTop: "1px" }}>{job.address}</div> : null}
                      </td>

                      {/* TYPE */}
                      <td style={{ padding: "14px 16px" }}>
                        <JobTypeChip type={job.type} />
                      </td>

                      {/* BRAND */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: job.brandName ? "#171717" : "#737373" }}>
                        {job.brandName ?? "—"}
                      </td>

                      {/* DEALER */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: job.dealerName ? "#171717" : "#737373" }}>
                        {job.dealerName ?? "—"}
                      </td>

                      {/* SUBMITTED */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#404040", whiteSpace: "nowrap" }}>
                        {formatDayMonth(job.createdAt)}
                      </td>

                      {/* DAYS WAITING */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "72px" }}>
                          <span style={{ fontSize: "13px", fontWeight: tier === "ok" ? 400 : 600, color: c.text }}>{days}d</span>
                          <div style={{ height: "3px", borderRadius: "9999px", backgroundColor: c.track, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: "9999px", backgroundColor: c.fill, width: `${Math.min(100, (days / 10) * 100)}%` }} />
                          </div>
                        </div>
                      </td>

                      {/* SCHEDULE & ASSIGN — inline inputs */}
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
                          <DateTimePicker
                            value={dateVal || null}
                            onChange={(next) => setScheduling((s) => ({ ...s, [job.id]: next ?? "" }))}
                            placeholder="Set date & time"
                          />
                          <select
                            value={techVal}
                            onChange={(e) => setAssigning((s) => ({ ...s, [job.id]: e.target.value }))}
                            style={{ padding: "5px 8px", fontSize: "12px", border: "1px solid #E5E5E5", borderRadius: "6px", outline: "none", color: techVal ? "#171717" : "#A3A3A3", backgroundColor: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                          >
                            <option value="">Assign technician…</option>
                            {technicians.map((t) => (
                              <option key={t.id} value={t.id}>{t.name} ({t.activeAssignments})</option>
                            ))}
                          </select>
                          {canConfirm && (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleConfirm(job)}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", padding: "6px 10px", borderRadius: "6px", backgroundColor: "#0A0A0A", color: "#fff", border: "none", fontSize: "12px", cursor: isSaving ? "not-allowed" : "pointer", fontWeight: 500, opacity: isSaving ? 0.6 : 1 }}
                            >
                              <Calendar size={11} strokeWidth={1.5} />
                              {isSaving ? "Saving…" : "Confirm"}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Chevron */}
                      <td style={{ padding: "14px 16px", width: "40px" }}>
                        <ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBatchModal ? (
        <BatchModal
          jobs={queue}
          technicians={technicians}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => { handleBatchSuccess(); setShowBatchModal(false); }}
        />
      ) : null}
    </section>
  );
}
