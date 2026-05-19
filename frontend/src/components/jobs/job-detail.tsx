"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchJobDetail,
  fetchJobRevisits,
  fetchJobTimeline,
  ownerOverrideJobStatus,
  rollbackJobStatus,
  transitionJobStatus,
  updateJobPayment,
} from "@/lib/api/jobs";
import { useAuth } from "@/contexts/auth-context";
import { fetchPaymentMethods, fetchSystemConfig } from "@/lib/api/operations";
import { ApiError } from "@/lib/api/client";
import { getAllowedNextStatuses } from "@/lib/jobs-state-machine";
import { BrandSwatch, JobTypeChip, SourceChip } from "@/components/ui/job-type-chip";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  MapPin,
  Phone,
  RotateCcw,
  ShieldAlert,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TERMINAL_OR_CLOSED = new Set(["completed", "resolved", "resolved_on_revisit", "cancelled"]);
const OWNER_STATUSES = [
  "pending_schedule",
  "scheduled",
  "assigned",
  "acknowledged",
  "in_transit",
  "in_process",
  "completed",
  "new",
  "needs_revisit",
  "revisit_scheduled",
  "resolved",
  "resolved_on_revisit",
  "cancelled",
  "cancellation_requested",
];

function prettyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function JobDetail({ jobId }: { jobId: string }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [toStatus, setToStatus] = useState("");
  const [reason, setReason] = useState("");
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [paymentDecision, setPaymentDecision] = useState<"retain" | "void">("retain");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [expandedRevisitId, setExpandedRevisitId] = useState<string | null>(null);

  const role = session?.user.role;
  const isOwner = role === "owner";
  const isOfficeStaff = role === "office_staff";

  const detailQuery = useQuery({
    queryKey: ["job-detail", jobId],
    queryFn: () => fetchJobDetail(jobId),
  });

  const timelineQuery = useQuery({
    queryKey: ["job-timeline", jobId],
    queryFn: () => fetchJobTimeline(jobId),
  });

  const revisitsQuery = useQuery({
    queryKey: ["job-revisits", jobId],
    queryFn: () => fetchJobRevisits(jobId),
  });

  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  const configQuery = useQuery({
    queryKey: ["system-config"],
    queryFn: fetchSystemConfig,
  });

  const undoWindowSeconds = useMemo(() => {
    const rows = configQuery.data ?? [];
    const match = rows.find((item) => item.key === "undo_window_seconds");
    if (!match) {
      return 60;
    }
    const parsed = Number(match.value);
    return Number.isNaN(parsed) ? 60 : parsed;
  }, [configQuery.data]);

  useEffect(() => {
    if (undoSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setUndoSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [undoSecondsLeft]);

  useEffect(() => {
    if (!detailQuery.data?.payment) {
      setPaymentMethodId("");
      setPaymentAmount("");
      return;
    }

    setPaymentMethodId(detailQuery.data.payment.paymentMethodId ?? "");
    setPaymentAmount(String(detailQuery.data.payment.amount));
  }, [detailQuery.data?.payment]);

  const transitionMutation = useMutation({
    mutationFn: async () => {
      if (!detailQuery.data || !toStatus) {
        return null;
      }

      return transitionJobStatus(jobId, {
        toStatus,
        expectedVersion: detailQuery.data.version,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setUndoSecondsLeft(undoWindowSeconds);
      setReason("");
      setToStatus("");
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (payload: { reason: string }) => {
      if (!detailQuery.data) {
        return Promise.resolve({ ok: true, status: "", version: 0 });
      }
      return rollbackJobStatus(jobId, {
        expectedVersion: detailQuery.data.version,
        reason: payload.reason,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setUndoSecondsLeft(0);
    },
  });

  const ownerOverrideMutation = useMutation({
    mutationFn: () => {
      if (!detailQuery.data) {
        return Promise.resolve({ ok: true, status: "", version: 0 });
      }
      return ownerOverrideJobStatus(jobId, {
        toStatus: overrideStatus,
        expectedVersion: detailQuery.data.version,
        reason: overrideReason.trim(),
        paymentDecision,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setOverrideOpen(false);
      setOverrideStatus("");
      setOverrideReason("");
      setPaymentDecision("retain");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => {
      const input: { paymentMethodId?: string; amount?: number } = {};
      if (isOfficeStaff && paymentMethodId) {
        input.paymentMethodId = paymentMethodId;
      }
      if (isOwner && paymentAmount.trim().length > 0) {
        input.amount = Number(paymentAmount);
      }
      return updateJobPayment(jobId, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
    },
  });

  const transitionError = useMemo(() => {
    if (!transitionMutation.error) {
      return "";
    }

    if (transitionMutation.error instanceof ApiError) {
      return transitionMutation.error.message;
    }

    return "Unable to transition status.";
  }, [transitionMutation.error]);

  if (detailQuery.isLoading) {
    return <div style={{ padding: "24px", fontSize: "13px", color: "#737373" }}>Loading job details...</div>;
  }

  if (detailQuery.error || !detailQuery.data) {
    return <div style={{ margin: "24px", borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", fontSize: "13px", color: "#991B1B" }}>Unable to load job details.</div>;
  }

  const detail = detailQuery.data;
  const nextStatuses = getAllowedNextStatuses(detail);
  const isTransitionLocked = nextStatuses.length === 0;
  const canRollbackOneStep = isOfficeStaff && !TERMINAL_OR_CLOSED.has(detail.status);
  const hasPayment = Boolean(detail.payment);
  const isPaidCompletion = detail.status === "completed" || detail.status === "resolved" || detail.status === "resolved_on_revisit";
  const requiresPaymentDecision = hasPayment && isPaidCompletion;

  return (
    <section style={{ padding: "24px", maxWidth: "1160px" }}>
      <header style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "18px", marginBottom: "14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <Link href="/jobs" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#525252", textDecoration: "none", marginBottom: "8px" }}>
              <ArrowLeft size={12} strokeWidth={1.5} /> Back to jobs
            </Link>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: "#171717" }}>Job #{detail.id}</h2>
            <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
              <StatusChip status={detail.status} />
              <JobTypeChip type={detail.type} />
              <SourceChip source={detail.source} />
              <BrandSwatch name={detail.brandName ?? "Unbranded"} colorHex={null} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#737373", borderRadius: "9999px", border: "1px solid #E5E5E5", padding: "4px 9px" }}>Version: {detail.version}</div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <article style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "16px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#171717", display: "inline-flex", alignItems: "center", gap: "6px" }}><UserRound size={13} strokeWidth={1.5} /> Customer</h3>
            <dl style={{ margin: 0, display: "grid", gap: "10px", fontSize: "13px" }}>
              <div><dt style={{ color: "#737373", marginBottom: "2px" }}>Name</dt><dd style={{ color: "#171717", margin: 0 }}>{detail.customerName}</dd></div>
              <div><dt style={{ color: "#737373", marginBottom: "2px", display: "inline-flex", alignItems: "center", gap: "4px" }}><Phone size={11} strokeWidth={1.5} /> Phone</dt><dd style={{ color: "#171717", margin: 0 }}>{detail.phone}</dd></div>
              <div><dt style={{ color: "#737373", marginBottom: "2px", display: "inline-flex", alignItems: "center", gap: "4px" }}><MapPin size={11} strokeWidth={1.5} /> Address</dt><dd style={{ color: "#171717", margin: 0 }}>{detail.address}</dd></div>
            </dl>
          </article>

          <article style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "16px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#171717", display: "inline-flex", alignItems: "center", gap: "6px" }}><Wrench size={13} strokeWidth={1.5} /> Assignment</h3>
            <dl style={{ margin: 0, display: "grid", gap: "10px", fontSize: "13px" }}>
              <div><dt style={{ color: "#737373", marginBottom: "2px" }}>Technician</dt><dd style={{ color: "#171717", margin: 0 }}>{detail.assignedTechnicianName ?? "Unassigned"}</dd></div>
              <div><dt style={{ color: "#737373", marginBottom: "2px" }}>Brand</dt><dd style={{ color: "#171717", margin: 0 }}>{detail.brandName ?? "-"}</dd></div>
              <div><dt style={{ color: "#737373", marginBottom: "2px" }}>Source</dt><dd style={{ color: "#171717", margin: 0 }}>{detail.source}</dd></div>
              <div><dt style={{ color: "#737373", marginBottom: "2px", display: "inline-flex", alignItems: "center", gap: "4px" }}><CalendarClock size={11} strokeWidth={1.5} /> Scheduled</dt><dd style={{ color: "#171717", margin: 0 }}>{detail.scheduledAt ? new Date(detail.scheduledAt).toLocaleString() : "-"}</dd></div>
            </dl>
          </article>

          <article style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "16px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 600, color: "#171717", display: "inline-flex", alignItems: "center", gap: "6px" }}><ClipboardList size={13} strokeWidth={1.5} /> Job notes</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#404040", lineHeight: 1.6 }}>
              {detail.type === "complaint"
                ? detail.issueDescription || "No issue description available."
                : detail.installationNotes || "No installation notes available."}
            </p>
          </article>

          <article style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "16px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#171717" }}>Status transition</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "10px", alignItems: "end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px", color: "#737373" }}>
                Next status
                <select
                  value={toStatus}
                  onChange={(event) => setToStatus(event.target.value)}
                  disabled={isTransitionLocked}
                  style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717", backgroundColor: isTransitionLocked ? "#FAFAFA" : "#fff" }}
                >
                  <option value="">Select status</option>
                  {nextStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px", color: "#737373" }}>
                Reason (optional)
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Enter reason for timeline/audit"
                  disabled={isTransitionLocked}
                  style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717", backgroundColor: isTransitionLocked ? "#FAFAFA" : "#fff" }}
                />
              </label>

              <button
                type="button"
                onClick={() => transitionMutation.mutate()}
                disabled={isTransitionLocked || !toStatus || transitionMutation.isPending}
                style={{ borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px 13px", fontSize: "13px", cursor: "pointer", opacity: isTransitionLocked || !toStatus || transitionMutation.isPending ? 0.55 : 1 }}
              >
                {transitionMutation.isPending ? "Updating..." : "Update status"}
              </button>
            </div>
            {isTransitionLocked ? <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#737373" }}>No forward transitions available from the current status.</p> : null}
            {transitionError ? <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#991B1B" }}>{transitionError}</p> : null}

            {undoSecondsLeft > 0 ? (
              <div style={{ marginTop: "10px", borderRadius: "8px", border: "1px solid #DCFCE7", backgroundColor: "#F0FDF4", padding: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", color: "#166534" }}>Undo available for {undoSecondsLeft}s</span>
                  <button
                    type="button"
                    onClick={() => rollbackMutation.mutate({ reason: "Undo transition" })}
                    disabled={rollbackMutation.isPending}
                    style={{ border: "1px solid #BBF7D0", borderRadius: "6px", backgroundColor: "#fff", color: "#166534", fontSize: "12px", padding: "4px 8px", cursor: "pointer" }}
                  >
                    {rollbackMutation.isPending ? "Undoing..." : "Undo"}
                  </button>
                </div>
                <div style={{ height: "4px", borderRadius: "9999px", backgroundColor: "#DCFCE7", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(undoSecondsLeft / Math.max(1, undoWindowSeconds)) * 100}%`, backgroundColor: "#22C55E", transition: "width 1s linear" }} />
                </div>
              </div>
            ) : null}

            {(canRollbackOneStep || isOwner) ? (
              <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {canRollbackOneStep ? (
                  <button
                    type="button"
                    onClick={() => rollbackMutation.mutate({ reason: "Office rollback one step" })}
                    disabled={rollbackMutation.isPending}
                    style={{ border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#171717", padding: "8px 10px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                  >
                    <RotateCcw size={12} strokeWidth={1.5} />
                    {rollbackMutation.isPending ? "Rolling back..." : "Roll back one step"}
                  </button>
                ) : null}

                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setOverrideOpen(true)}
                    style={{ border: "1px solid #FECACA", borderRadius: "8px", backgroundColor: "#fff", color: "#991B1B", padding: "8px 10px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                  >
                    <ShieldAlert size={12} strokeWidth={1.5} /> Override status
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>

          <article style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "16px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#171717", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Wallet size={13} strokeWidth={1.5} />
              Payment
            </h3>
            {!detail.payment ? (
              <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>Payment is not recorded for this job yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
                <div style={{ color: "#404040" }}>Amount: ₹{detail.payment.amount.toFixed(2)}</div>
                <div style={{ color: "#404040" }}>Method: {detail.payment.paymentMethodName ?? "-"}</div>
                <div style={{ color: "#737373" }}>Recorded by: {detail.payment.recordedByName ?? "-"}</div>
                <div style={{ color: "#A3A3A3" }}>{new Date(detail.payment.recordedAt).toLocaleString()}</div>

                {isOfficeStaff ? (
                  <div style={{ marginTop: "6px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "end" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", color: "#737373" }}>
                      Payment method
                      <select
                        value={paymentMethodId}
                        onChange={(event) => setPaymentMethodId(event.target.value)}
                        style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px", fontSize: "12px", color: "#171717" }}
                      >
                        <option value="">Select method</option>
                        {(paymentMethodsQuery.data ?? []).filter((item) => item.isActive).map((method) => (
                          <option key={method.id} value={method.id}>{method.name}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => paymentMutation.mutate()}
                      disabled={!paymentMethodId || paymentMutation.isPending}
                      style={{ border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px 10px", fontSize: "12px", cursor: "pointer", opacity: !paymentMethodId || paymentMutation.isPending ? 0.6 : 1 }}
                    >
                      Save
                    </button>
                  </div>
                ) : null}

                {isOwner ? (
                  <div style={{ marginTop: "6px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "end" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", color: "#737373" }}>
                      Payment amount
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        min="0"
                        step="0.01"
                        style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px", fontSize: "12px", color: "#171717" }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => paymentMutation.mutate()}
                      disabled={!paymentAmount || paymentMutation.isPending}
                      style={{ border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px 10px", fontSize: "12px", cursor: "pointer", opacity: !paymentAmount || paymentMutation.isPending ? 0.6 : 1 }}
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </article>

          <article style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "16px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#171717" }}>Revisit history</h3>
            {revisitsQuery.isLoading ? <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>Loading revisits...</p> : null}
            {revisitsQuery.isError ? <p style={{ margin: 0, fontSize: "12px", color: "#991B1B" }}>Unable to load revisit history.</p> : null}
            {!revisitsQuery.isLoading && !revisitsQuery.isError && (revisitsQuery.data?.length ?? 0) === 0 ? <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>No revisits recorded.</p> : null}

            <div style={{ display: "grid", gap: "8px" }}>
              {revisitsQuery.data?.map((revisit) => {
                const expanded = expandedRevisitId === revisit.id;
                return (
                  <button
                    key={revisit.id}
                    type="button"
                    onClick={() => setExpandedRevisitId((current) => current === revisit.id ? null : revisit.id)}
                    style={{ textAlign: "left", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", padding: "10px", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#171717" }}>Revisit #{revisit.sequenceNumber}</span>
                      <span style={{ fontSize: "11px", color: "#737373" }}>{revisit.status}</span>
                    </div>
                    {expanded ? (
                      <div style={{ marginTop: "8px", display: "grid", gap: "4px", fontSize: "12px", color: "#525252" }}>
                        <div>Reason: {revisit.reason}</div>
                        {revisit.customReason ? <div>Detail: {revisit.customReason}</div> : null}
                        <div>Technician: {revisit.assignedTechnicianName ?? "-"}</div>
                        <div>{new Date(revisit.createdAt).toLocaleString()}</div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </article>
        </div>

        <article style={{ borderRadius: "12px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "16px", alignSelf: "start" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#171717" }}>Timeline</h3>
          {timelineQuery.isLoading ? <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>Loading timeline...</p> : null}
          {timelineQuery.error ? <p style={{ margin: 0, fontSize: "13px", color: "#991B1B" }}>Unable to load timeline.</p> : null}
          {!timelineQuery.isLoading && !timelineQuery.error && timelineQuery.data?.length === 0 ? <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>No timeline events yet.</p> : null}

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
            {timelineQuery.data?.map((event) => (
              <li key={event.id} style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#171717" }}>{event.eventType}</span>
                  <span style={{ fontSize: "11px", color: "#A3A3A3" }}>{new Date(event.occurredAt).toLocaleString()}</span>
                </div>
                {event.reason ? <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#525252" }}>Reason: {event.reason}</p> : null}
                <details style={{ marginTop: "8px", borderRadius: "8px", border: "1px solid #F1F1F1", backgroundColor: "#FAFAFA", padding: "8px" }}>
                  <summary style={{ cursor: "pointer", fontSize: "12px", color: "#404040", fontWeight: 500 }}>Payload details</summary>
                  <div style={{ marginTop: "8px", display: "grid", gap: "8px", gridTemplateColumns: "1fr" }}>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.03em" }}>Previous</p>
                      <pre style={{ margin: 0, maxHeight: "140px", overflow: "auto", borderRadius: "6px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "8px", fontSize: "11px", color: "#404040", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{prettyJson(event.previousValue)}</pre>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.03em" }}>New</p>
                      <pre style={{ margin: 0, maxHeight: "140px", overflow: "auto", borderRadius: "6px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "8px", fontSize: "11px", color: "#404040", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{prettyJson(event.newValue)}</pre>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <Modal isOpen={overrideOpen} onClose={() => setOverrideOpen(false)} title="Owner override" blocking={requiresPaymentDecision}>
        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            Target status
            <select
              value={overrideStatus}
              onChange={(event) => setOverrideStatus(event.target.value)}
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            >
              <option value="">Select status</option>
              {OWNER_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            Reason
            <input
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Reason is required"
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            />
          </label>

          {requiresPaymentDecision ? (
            <div style={{ borderRadius: "8px", border: "1px solid #FDE68A", backgroundColor: "#FFFBEB", padding: "10px", fontSize: "12px", color: "#92400E", display: "grid", gap: "8px" }}>
              <div>This job has payment recorded. Choose how payment should be handled.</div>
              <div style={{ display: "flex", gap: "12px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="radio"
                    checked={paymentDecision === "retain"}
                    onChange={() => setPaymentDecision("retain")}
                  />
                  Retain payment
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="radio"
                    checked={paymentDecision === "void"}
                    onChange={() => setPaymentDecision("void")}
                  />
                  Void payment
                </label>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => ownerOverrideMutation.mutate()}
            disabled={!overrideStatus || !overrideReason.trim() || ownerOverrideMutation.isPending}
            style={{ border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "10px 14px", fontSize: "13px", cursor: "pointer", opacity: !overrideStatus || !overrideReason.trim() || ownerOverrideMutation.isPending ? 0.6 : 1 }}
          >
            {ownerOverrideMutation.isPending ? "Applying override..." : "Confirm override"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
