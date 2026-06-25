"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchJobDetail,
  fetchJobRevisits,
  fetchJobTimeline,
  ownerOverrideJobStatus,
  reassignTechnician,
  rollbackJobStatus,
  transitionJobStatus,
} from "@/lib/api/jobs";
import { fetchOfficeTechnicians } from "@/lib/api/office";
import { useAuth } from "@/contexts/auth-context";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import { fetchSystemConfig } from "@/lib/api/operations";
import { ApiError } from "@/lib/api/client";
import { getAllowedNextStatuses } from "@/lib/jobs-state-machine";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  RotateCcw,
  ShieldAlert,
  UserRound,
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

export function JobDetail({ jobId }: { jobId: string }) {
  const { session } = useAuth();
  const isMobile = useMobileBreakpoint();
  const queryClient = useQueryClient();
  const [toStatus, setToStatus] = useState("");
  const [reason, setReason] = useState("");
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [paymentDecision, setPaymentDecision] = useState<"retain" | "void">("retain");

  const [activeTab, setActiveTab] = useState<"details" | "timeline" | "payment" | "review">("details");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTechId, setReassignTechId] = useState("");
  const [advanceStatusOpen, setAdvanceStatusOpen] = useState(false);

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

  const configQuery = useQuery({
    queryKey: ["system-config"],
    queryFn: fetchSystemConfig,
  });

  const techniciansQuery = useQuery({
    queryKey: ["office-technicians"],
    queryFn: fetchOfficeTechnicians,
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

  const transitionMutation = useMutation({
    mutationFn: async (statusOverride?: string) => {
      const target = statusOverride ?? toStatus;
      if (!detailQuery.data || !target) {
        return null;
      }

      return transitionJobStatus(jobId, {
        toStatus: target,
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

  const reassignMutation = useMutation({
    mutationFn: () => reassignTechnician(jobId, reassignTechId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setReassignOpen(false);
      setReassignTechId("");
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
  const canRollbackOneStep = isOfficeStaff && !TERMINAL_OR_CLOSED.has(detail.status);
  const hasPayment = Boolean(detail.payment);
  const isPaidCompletion = detail.status === "completed" || detail.status === "resolved" || detail.status === "resolved_on_revisit";
  const requiresPaymentDecision = hasPayment && isPaidCompletion;
  const revisitCount = revisitsQuery.data?.length ?? 0;

  // Advance Status logic
  const singleNext = nextStatuses.length === 1 ? nextStatuses[0] : null;

  function handleAdvanceStatus() {
    if (singleNext) {
      transitionMutation.mutate(singleNext);
    } else {
      setAdvanceStatusOpen(true);
    }
  }

  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1200px" }}>

      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <div style={{ marginBottom: "16px" }}>
        <Link
          href="/jobs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            color: "#737373",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={12} strokeWidth={1.5} /> All jobs
        </Link>
        <span style={{ fontSize: "12px", color: "#737373" }}> / {detail.id.slice(0, 8)}</span>
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#0A0A0A", letterSpacing: "-0.02em" }}>
            {detail.id.slice(0, 8).toUpperCase()}
          </h1>
          <button
            type="button"
            title="Copy job ID"
            onClick={() => navigator.clipboard.writeText(detail.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: "#737373",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Copy size={14} strokeWidth={1.5} />
          </button>
          <StatusChip status={detail.status} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "13px", color: "#525252" }}>
          {detail.brandName ? <span>{detail.brandName}</span> : null}
          {detail.brandName ? <span>·</span> : null}
          <span>{detail.type === "installation" ? "Installation" : "Complaint"}</span>
          {revisitCount > 0 ? <span>·</span> : null}
          {revisitCount > 0 ? <span>Revisit #{revisitCount}</span> : null}
          {detail.tags.map((tag) => (
            <span key={tag} style={{ color: tag === "chronic" ? "#9F1239" : tag === "frequent" ? "#737373" : "#525252", fontWeight: 500 }}>
              · {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: "24px", alignItems: "start" }}>

        {/* ── Left column: tabs + content ──────────────────── */}
        <div>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: "24px", borderBottom: "1px solid #E5E5E5", marginBottom: "24px" }}>
            {(["details", "timeline", "payment", "review"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #0A0A0A" : "2px solid transparent",
                  padding: "10px 0",
                  marginBottom: "-1px",
                  fontSize: "14px",
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "#171717" : "#737373",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Details tab */}
          {activeTab === "details" ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "32px", marginBottom: "24px" }}>
                {/* Customer */}
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.06em", textTransform: "uppercase" }}>Customer</p>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#737373" }}>Name</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>{detail.customerName}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#737373" }}>Phone</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>{detail.phone}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#737373" }}>Address</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>{detail.address}</p>
                    </div>
                  </div>
                </div>
                {/* Schedule */}
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.06em", textTransform: "uppercase" }}>Schedule</p>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#737373" }}>Technician</p>
                      <p style={{ margin: 0, fontSize: "13px", color: detail.assignedTechnicianName ? "#171717" : "#737373", fontStyle: detail.assignedTechnicianName ? "normal" : "italic" }}>
                        {detail.assignedTechnicianName ?? "Unassigned"}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#737373" }}>Scheduled</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#171717" }}>
                        {detail.scheduledAt ? new Date(detail.scheduledAt).toLocaleString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Show technical details */}
              <button
                type="button"
                onClick={() => setShowTechnicalDetails((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#737373", padding: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                {showTechnicalDetails ? <ChevronUp size={13} strokeWidth={1.5} /> : <ChevronDown size={13} strokeWidth={1.5} />}
                {showTechnicalDetails ? "Hide" : "Show"} technical details
              </button>

              {showTechnicalDetails ? (
                <div style={{ marginTop: "12px", display: "grid", gap: "10px", padding: "16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#F9F9F9" }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>Source</p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#525252" }}>{detail.source === "via_dealer" ? `Via dealer${detail.dealerName ? ` — ${detail.dealerName}` : ""}` : "Direct"}</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>Version</p>
                    <p style={{ margin: 0, fontSize: "13px", fontFamily: '"JetBrains Mono", monospace', color: "#525252" }}>{detail.version}</p>
                  </div>
                  {detail.type === "complaint" && detail.issueDescription ? (
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>Issue description</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#525252", lineHeight: 1.6 }}>{detail.issueDescription}</p>
                    </div>
                  ) : null}
                  {detail.type === "installation" && detail.installationNotes ? (
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>Installation notes</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#525252", lineHeight: 1.6 }}>{detail.installationNotes}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Timeline tab */}
          {activeTab === "timeline" ? (
            <div>
              {timelineQuery.isLoading ? <p style={{ fontSize: "13px", color: "#737373" }}>Loading timeline...</p> : null}
              {timelineQuery.error ? <p style={{ fontSize: "13px", color: "#991B1B" }}>Unable to load timeline.</p> : null}
              {!timelineQuery.isLoading && !timelineQuery.error && timelineQuery.data?.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#737373" }}>No timeline events yet.</p>
              ) : null}
              <div style={{ display: "grid", gap: "12px" }}>
                {timelineQuery.data?.map((event) => {
                  const prevStatus = typeof event.previousValue === "string" ? event.previousValue : null;
                  const nextStatus = typeof event.newValue === "string" ? event.newValue : null;
                  const isStatusChange = event.eventType.toLowerCase().includes("status");

                  return (
                    <div key={event.id} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "12px", alignItems: "start" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: event.actorName === "System" ? "#737373" : "#0A0A0A", marginTop: "4px", justifySelf: "center" }} />
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#171717" }}>
                            {event.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span style={{ fontSize: "11px", color: "#737373", whiteSpace: "nowrap" }}>
                            {new Date(event.occurredAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {event.actorName ? (
                          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#737373" }}>{event.actorName}</p>
                        ) : null}
                        {event.reason ? (
                          <div style={{ margin: "6px 0", padding: "8px 10px", borderRadius: "6px", backgroundColor: "#F9F9F9", border: "1px solid #F1F1F1" }}>
                            <p style={{ margin: 0, fontSize: "13px", color: "#525252", fontStyle: "italic" }}>"{event.reason}"</p>
                          </div>
                        ) : null}
                        {isStatusChange && prevStatus && nextStatus ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                            <StatusChip status={prevStatus} />
                            <span style={{ fontSize: "12px", color: "#737373" }}>→</span>
                            <StatusChip status={nextStatus} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Payment tab */}
          {activeTab === "payment" ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>Payment details coming soon.</p>
            </div>
          ) : null}

          {/* Review tab */}
          {activeTab === "review" ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>Customer review coming soon.</p>
            </div>
          ) : null}
        </div>

        {/* ── Right sidebar ───────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: isMobile ? "static" : "sticky", top: "24px" }}>

          {/* Advance Status button */}
          {advanceStatusOpen && nextStatuses.length > 1 ? (
            <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "12px", backgroundColor: "#fff" }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#737373" }}>Select next status</p>
              <select
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value)}
                style={{ width: "100%", border: "1px solid #E5E5E5", borderRadius: "8px", padding: "8px", fontSize: "13px", marginBottom: "8px" }}
              >
                <option value="">Choose...</option>
                {nextStatuses.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => { transitionMutation.mutate(); setAdvanceStatusOpen(false); }}
                  disabled={!toStatus || transitionMutation.isPending}
                  style={{ flex: 1, border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px", fontSize: "13px", cursor: "pointer", opacity: !toStatus || transitionMutation.isPending ? 0.5 : 1 }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceStatusOpen(false)}
                  style={{ flex: 1, border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#525252", padding: "9px", fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAdvanceStatus}
              disabled={nextStatuses.length === 0 || transitionMutation.isPending}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "10px",
                backgroundColor: "#0A0A0A",
                color: "#fff",
                padding: "14px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: nextStatuses.length === 0 ? "not-allowed" : "pointer",
                opacity: nextStatuses.length === 0 ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {transitionMutation.isPending ? "Updating..." : "Advance Status →"}
            </button>
          )}

          {/* Actions dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              style={{
                width: "100%",
                border: "1px solid #E5E5E5",
                borderRadius: "10px",
                backgroundColor: "#fff",
                color: "#171717",
                padding: "10px 14px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              Actions {actionsOpen ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
            </button>
            {actionsOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  backgroundColor: "#fff",
                  border: "1px solid #E5E5E5",
                  borderRadius: "10px",
                  overflow: "hidden",
                  zIndex: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                }}
              >
                {canRollbackOneStep ? (
                  <button
                    type="button"
                    onClick={() => { rollbackMutation.mutate({ reason: "Office rollback" }); setActionsOpen(false); }}
                    disabled={rollbackMutation.isPending}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #E5E5E5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                  >
                    <RotateCcw size={13} strokeWidth={1.5} /> Roll back status
                  </button>
                ) : null}
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => { setOverrideOpen(true); setActionsOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #E5E5E5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                  >
                    <ShieldAlert size={13} strokeWidth={1.5} /> Override status
                  </button>
                ) : null}
                {(isOwner || isOfficeStaff) ? (
                  <button
                    type="button"
                    onClick={() => { setReassignOpen(true); setActionsOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #E5E5E5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                  >
                    <UserRound size={13} strokeWidth={1.5} /> Reassign technician
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => { setActiveTab("payment"); setActionsOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", borderBottom: "1px solid #E5E5E5", cursor: "pointer", fontSize: "13px", color: "#171717", textAlign: "left" }}
                >
                  Manage payment
                </button>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => { setOverrideStatus("cancelled"); setOverrideOpen(true); setActionsOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#991B1B", textAlign: "left" }}
                  >
                    Cancel job
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Payment card */}
          <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "14px", backgroundColor: "#fff" }}>
            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.06em", textTransform: "uppercase" }}>Payment</p>
            {!detail.payment ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>No payment recorded</p>
            ) : (
              <div style={{ display: "grid", gap: "4px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#171717", fontWeight: 500 }}>₹{detail.payment.amount.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>{detail.payment.paymentMethodName ?? "—"}</p>
              </div>
            )}
          </div>

          {/* Undo banner */}
          {undoSecondsLeft > 0 ? (
            <div style={{ borderRadius: "8px", border: "1px solid #DCFCE7", backgroundColor: "#F0FDF4", padding: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "#166534" }}>Undo available for {undoSecondsLeft}s</span>
                <button
                  type="button"
                  onClick={() => rollbackMutation.mutate({ reason: "Undo transition" })}
                  disabled={rollbackMutation.isPending}
                  style={{ border: "1px solid #BBF7D0", borderRadius: "6px", backgroundColor: "#fff", color: "#166534", fontSize: "12px", padding: "4px 8px", cursor: "pointer" }}
                >
                  Undo
                </button>
              </div>
              <div style={{ height: "4px", borderRadius: "9999px", backgroundColor: "#DCFCE7", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(undoSecondsLeft / Math.max(1, undoWindowSeconds)) * 100}%`, backgroundColor: "#22C55E", transition: "width 1s linear" }} />
              </div>
            </div>
          ) : null}

          {transitionError ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#991B1B", padding: "8px 10px", border: "1px solid #FECACA", borderRadius: "8px", backgroundColor: "#FEF2F2" }}>{transitionError}</p>
          ) : null}
        </div>
      </div>

      {/* ── Reassign modal ─────────────────────────────────── */}
      <Modal isOpen={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign technician">
        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            New technician
            <select
              value={reassignTechId}
              onChange={(e) => setReassignTechId(e.target.value)}
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            >
              <option value="">Select technician</option>
              {(techniciansQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => reassignMutation.mutate()}
            disabled={!reassignTechId || reassignMutation.isPending}
            style={{ border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", padding: "10px 14px", fontSize: "13px", cursor: "pointer", opacity: !reassignTechId || reassignMutation.isPending ? 0.6 : 1 }}
          >
            {reassignMutation.isPending ? "Reassigning..." : "Confirm"}
          </button>
        </div>
      </Modal>

      {/* ── Override modal (owner) ─────────────────────────── */}
      <Modal isOpen={overrideOpen} onClose={() => setOverrideOpen(false)} title="Override status" blocking={requiresPaymentDecision}>
        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            Target status
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            >
              <option value="">Select status</option>
              {OWNER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#737373" }}>
            Reason
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason is required"
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
            />
          </label>
          {requiresPaymentDecision ? (
            <div style={{ borderRadius: "8px", border: "1px solid #FDE68A", backgroundColor: "#FFFBEB", padding: "10px", fontSize: "12px", color: "#92400E", display: "grid", gap: "8px" }}>
              <div>This job has payment recorded. Choose how payment should be handled.</div>
              <div style={{ display: "flex", gap: "12px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input type="radio" checked={paymentDecision === "retain"} onChange={() => setPaymentDecision("retain")} /> Retain payment
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input type="radio" checked={paymentDecision === "void"} onChange={() => setPaymentDecision("void")} /> Void payment
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
