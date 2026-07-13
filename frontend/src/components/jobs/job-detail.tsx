"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  fetchJobDetail,
  fetchJobRevisits,
  fetchJobTimeline,
  ownerOverrideJobStatus,
  reassignTechnician,
  rollbackJobStatus,
  transitionJobStatus,
  updateJobPayment,
} from "@/lib/api/jobs";
import { fetchOfficeTechnicians } from "@/lib/api/office";
import { useAuth } from "@/contexts/auth-context";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import { fetchSystemConfig } from "@/lib/api/operations";
import { ApiError } from "@/lib/api/client";
import { getAllowedNextStatuses } from "@/lib/jobs-state-machine";
import { canProgressInstallation } from "@/lib/job-status-groups";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import { BrandSwatch } from "@/components/ui/job-type-chip";
import { fetchOfficeBrands, fetchPaymentMethods } from "@/lib/api/operations";
import { fetchServiceItems } from "@/lib/api/service-items";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  MapPin,
  Phone,
  RotateCcw,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TransitionJobStatusInput } from "@/types/jobs";

const TERMINAL_OR_CLOSED = new Set(["completed", "resolved", "resolved_on_revisit", "cancelled"]);
const INSTALLATION_STATUSES = [
  "pending_schedule",
  "scheduled",
  "assigned",
  "acknowledged",
  "in_transit",
  "in_process",
  "completed",
  "cancelled",
];

const COMPLAINT_STATUSES = [
  "new",
  "assigned",
  "acknowledged",
  "in_transit",
  "in_process",
  "resolved",
  "needs_revisit",
  "revisit_scheduled",
  "resolved_on_revisit",
  "cancellation_requested",
  "cancelled",
];

export function JobDetail({ jobId }: { jobId: string }) {
  const { session } = useAuth();
  const isMobile = useMobileBreakpoint();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [toStatus, setToStatus] = useState("");
  const [reason, setReason] = useState("");
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const OVERRIDE_REASON_MIN_CHARS = 10;
  const [paymentDecision, setPaymentDecision] = useState<"retain" | "void">("retain");

  const [activeTab, setActiveTab] = useState<"details" | "timeline" | "payment" | "review">("details");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTechId, setReassignTechId] = useState("");
  const [advanceStatusOpen, setAdvanceStatusOpen] = useState(false);
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false);
  const [paySelectedItems, setPaySelectedItems] = useState<Set<string>>(new Set());
  const [payItemQuantities, setPayItemQuantities] = useState<Map<string, number>>(new Map());
  const [paySelectedMethodId, setPaySelectedMethodId] = useState("");
  const [payAdditional, setPayAdditional] = useState("");

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

  const isTechnician = role === "technician";

  const revisitsQuery = useQuery({
    queryKey: ["job-revisits", jobId],
    queryFn: () => fetchJobRevisits(jobId),
    enabled: !isTechnician,
  });

  const configQuery = useQuery({
    queryKey: ["system-config"],
    queryFn: fetchSystemConfig,
    enabled: !isTechnician,
  });

  const techniciansQuery = useQuery({
    queryKey: ["office-technicians"],
    queryFn: fetchOfficeTechnicians,
    enabled: !isTechnician,
  });

  const serviceItemsQuery = useQuery({
    queryKey: ["service-items"],
    queryFn: fetchServiceItems,
    enabled: collectPaymentOpen,
  });

  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    enabled: collectPaymentOpen,
  });

  const brandsQuery = useQuery({
    queryKey: ["office-brands"],
    queryFn: fetchOfficeBrands,
    enabled: collectPaymentOpen,
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
      enqueueSnackbar("Status updated successfully", { variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setUndoSecondsLeft(undoWindowSeconds);
      setReason("");
      setToStatus("");
    },
    onError: (err: unknown) => {
      enqueueSnackbar(err instanceof Error ? err.message : "Failed to update status.", { variant: "error" });
    },
  });

  const collectPaymentMutation = useMutation({
    mutationFn: async (payload: { toStatus: string; paymentMethodId: string; paymentAmount: number; serviceItems: TransitionJobStatusInput["serviceItems"] }) => {
      if (!detailQuery.data) return;
      await transitionJobStatus(jobId, {
        toStatus: payload.toStatus,
        expectedVersion: detailQuery.data.version,
        paymentAmount: payload.paymentAmount,
        paymentMethodId: payload.paymentMethodId,
        serviceItems: payload.serviceItems,
      });
    },
    onSuccess: async () => {
      enqueueSnackbar("Payment collected and job completed", { variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
    },
    onError: (err: unknown) => {
      enqueueSnackbar(err instanceof Error ? err.message : "Failed to collect payment.", { variant: "error" });
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
      enqueueSnackbar("Status rolled back", { variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setUndoSecondsLeft(0);
    },
    onError: (err: unknown) => {
      enqueueSnackbar(err instanceof Error ? err.message : "Failed to rollback status.", { variant: "error" });
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
      enqueueSnackbar("Status overridden successfully", { variant: "success" });
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
    onError: (err: unknown) => {
      enqueueSnackbar(err instanceof Error ? err.message : "Failed to override status.", { variant: "error" });
    },
  });

  const [reassignError, setReassignError] = useState("");
  const reassignMutation = useMutation({
    mutationFn: () => reassignTechnician(jobId, reassignTechId),
    onSuccess: async () => {
      enqueueSnackbar("Technician reassigned successfully", { variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
      setReassignOpen(false);
      setReassignTechId("");
      setReassignError("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Reassignment failed";
      enqueueSnackbar(msg, { variant: "error" });
      setReassignError(msg);
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

  const canAdvanceStatus = canProgressInstallation({
    type: detail.type,
    technicianId: detail.assignedTechnicianId,
    scheduledAt: detail.scheduledAt,
  });

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
            fontSize: "13px",
            color: "#A3A3A3",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={12} strokeWidth={1.5} /> All jobs
        </Link>
        <span style={{ fontSize: "13px", color: "#A3A3A3" }}> / {detail.id.slice(0, 8)}</span>
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600, color: "#0A0A0A", letterSpacing: "-0.01em", fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
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
              color: "#A3A3A3",
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
            <span
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "9999px",
                padding: "2px 8px",
                fontSize: "11px",
                fontWeight: 500,
                backgroundColor: tag === "chronic" ? "#FFF1F2" : tag === "frequent" ? "#FFFBEB" : "#F1F5F9",
                color: tag === "chronic" ? "#9F1239" : tag === "frequent" ? "#92400E" : "#1E293B",
              }}
            >
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
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
            {(["details", "timeline", "payment", "review"] as const).filter((tab) => !(isTechnician && tab === "review")).map((tab) => (
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
                  fontSize: "13px",
                  fontWeight: activeTab === tab ? 500 : 400,
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
              {/* Two-column: Customer | Job Details */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "40px", marginBottom: "28px" }}>

                {/* ── CUSTOMER ── */}
                <div>
                  <p style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Customer</p>
                  <div style={{ display: "grid", gap: "18px" }}>

                    {/* Name */}
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", alignItems: "start", gap: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#737373", paddingTop: "1px" }}>Name</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#0A0A0A" }}>{detail.customerName}</span>
                    </div>

                    {/* Phone */}
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", alignItems: "start", gap: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#737373", paddingTop: "8px" }}>Phone</span>
                      <a
                        href={`tel:${detail.phone}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "6px 14px",
                          borderRadius: "9999px",
                          border: "1px solid #E5E5E5",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#171717",
                          textDecoration: "none",
                          backgroundColor: "#fff",
                          width: "fit-content",
                        }}
                      >
                        <Phone size={13} strokeWidth={1.5} color="#525252" />
                        {detail.phone}
                      </a>
                    </div>

                    {/* Address */}
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", alignItems: "start", gap: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#737373", paddingTop: "1px" }}>Address</span>
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#0A0A0A", lineHeight: 1.4 }}>{detail.address}</p>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(detail.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "5px 12px",
                            borderRadius: "9999px",
                            border: "1px solid #E5E5E5",
                            fontSize: "12px",
                            color: "#525252",
                            textDecoration: "none",
                            backgroundColor: "#fff",
                            width: "fit-content",
                          }}
                        >
                          <MapPin size={12} strokeWidth={1.5} />
                          Open in Google Maps
                        </a>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ── JOB DETAILS ── */}
                <div>
                  <p style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Job Details</p>
                  <div style={{ display: "grid", gap: "18px" }}>

                    {/* Brand */}
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#737373" }}>Brand</span>
                      {detail.brandName
                        ? <BrandSwatch name={detail.brandName} />
                        : <span style={{ fontSize: "13px", color: "#737373" }}>—</span>
                      }
                    </div>

                    {/* Unit */}
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#737373", paddingTop: "1px" }}>Unit</span>
                      <span style={{ fontSize: "13px", color: "#0A0A0A", lineHeight: 1.4 }}>
                        {detail.installationNotes ?? detail.issueDescription ?? "—"}
                      </span>
                    </div>

                    {/* Scheduled */}
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#737373" }}>Scheduled</span>
                      <span style={{ fontSize: "13px", color: "#0A0A0A" }}>
                        {detail.scheduledAt
                          ? new Date(detail.scheduledAt).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
                          : "—"}
                      </span>
                    </div>

                  </div>
                </div>
              </div>

              {/* ── Show more details accordion ── */}
              <button
                type="button"
                onClick={() => setShowTechnicalDetails((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#A3A3A3", padding: 0, display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                {showTechnicalDetails ? <ChevronUp size={13} strokeWidth={1.5} /> : <ChevronDown size={13} strokeWidth={1.5} />}
                Show more details
              </button>

              {showTechnicalDetails ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "14px", padding: "16px 20px", borderRadius: "10px", border: "1px solid #E5E5E5", backgroundColor: "#FAFAFA" }}>
                  {/* Technician */}
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Technician</span>
                    <span style={{ fontSize: "13px", color: detail.assignedTechnicianName ? "#171717" : "#737373", fontStyle: detail.assignedTechnicianName ? "normal" : "italic" }}>
                      {detail.assignedTechnicianName ?? "Unassigned"}
                    </span>
                  </div>
                  {/* Source */}
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Source</span>
                    <span style={{ fontSize: "13px", color: "#525252" }}>
                      {detail.source === "via_dealer" ? `Via dealer${detail.dealerName ? ` — ${detail.dealerName}` : ""}` : "Direct"}
                    </span>
                  </div>
                  {/* Version */}
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Version</span>
                    <span style={{ fontSize: "13px", fontFamily: '"JetBrains Mono", monospace', color: "#525252" }}>{detail.version}</span>
                  </div>
                  {/* Tags */}
                  {detail.tags.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Tags</span>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {detail.tags.map((tag) => (
                          <span key={tag} style={{ padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 500, backgroundColor: tag === "chronic" ? "#FFF1F2" : tag === "frequent" ? "#FFFBEB" : "#F1F5F9", color: tag === "chronic" ? "#9F1239" : tag === "frequent" ? "#92400E" : "#1E293B" }}>
                            {tag.charAt(0).toUpperCase() + tag.slice(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Issue description */}
                  {detail.type === "complaint" && detail.issueDescription ? (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "start" }}>
                      <span style={{ fontSize: "12px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, paddingTop: "2px" }}>Issue</span>
                      <span style={{ fontSize: "13px", color: "#525252", lineHeight: 1.6 }}>{detail.issueDescription}</span>
                    </div>
                  ) : null}
                  {/* Installation notes */}
                  {detail.type === "installation" && detail.installationNotes ? (
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "start" }}>
                      <span style={{ fontSize: "12px", color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, paddingTop: "2px" }}>Notes</span>
                      <span style={{ fontSize: "13px", color: "#525252", lineHeight: 1.6 }}>{detail.installationNotes}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Timeline tab */}
          {activeTab === "timeline" ? (() => {
            const STEPS: Record<string, string[]> = {
              installation: ["assigned", "acknowledged", "in_transit", "in_process", "completed"],
              complaint: ["assigned", "acknowledged", "in_transit", "in_process", "resolved"],
            };
            const STEP_LABELS: Record<string, string> = {
              assigned: "Assigned",
              acknowledged: "Acknowledged",
              in_transit: "In Transit",
              in_process: "In Process",
              completed: "Completed",
              resolved: "Resolved",
            };

            // Build map: status → timestamp from timeline events
            // newValue comes from the API as { status: "assigned", ... }
            const doneAt: Record<string, string> = {};
            for (const event of timelineQuery.data ?? []) {
              const nv = event.newValue;
              const newStatus =
                nv && typeof nv === "object" && "status" in nv
                  ? String((nv as Record<string, unknown>).status)
                  : typeof nv === "string"
                    ? nv
                    : null;
              if (newStatus && event.occurredAt) {
                doneAt[newStatus] = event.occurredAt;
              }
            }

            const steps = STEPS[detail.type] ?? STEPS.installation;

            return (
              <div>
                {timelineQuery.isLoading && (
                  <p style={{ fontSize: "13px", color: "#737373" }}>Loading timeline…</p>
                )}
                {timelineQuery.error && (
                  <p style={{ fontSize: "13px", color: "#991B1B" }}>Unable to load timeline.</p>
                )}
                {!timelineQuery.isLoading && !timelineQuery.error && (
                  <div style={{ paddingTop: "4px" }}>
                    {steps.map((status, idx) => {
                      const isDone = Boolean(doneAt[status]);
                      const isLast = idx === steps.length - 1;
                      const ts = doneAt[status];
                      const formatted = ts
                        ? new Date(ts).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
                        : null;

                      // Determine state: past (green ✓), current (black #), future (gray)
                      const isCurrent = status === detail.status;
                      const isPast = isDone && !isCurrent;

                      let circleBg = "#F5F5F5";
                      let circleBorder = "1px solid #E5E5E5";
                      let circleColor = "#A3A3A3";
                      if (isPast) { circleBg = "#16A34A"; circleBorder = "none"; circleColor = "#fff"; }
                      else if (isCurrent) { circleBg = "#0A0A0A"; circleBorder = "none"; circleColor = "#fff"; }

                      const lineColor = isPast ? "#16A34A" : isDone ? "#0A0A0A" : "#E5E5E5";

                      return (
                        <div key={status} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                          {/* Left: circle + connector */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                backgroundColor: circleBg,
                                border: circleBorder,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: circleColor,
                                flexShrink: 0,
                              }}
                            >
                              {isPast ? <Check size={16} strokeWidth={2.5} /> : idx + 1}
                            </div>
                            {!isLast && (
                              <div style={{ width: "2px", height: "32px", backgroundColor: lineColor, marginTop: "4px", borderRadius: "1px" }} />
                            )}
                          </div>

                          {/* Right: label + timestamp */}
                          <div style={{ paddingTop: "8px", paddingBottom: isLast ? 0 : "8px" }}>
                            <p style={{ margin: 0, fontSize: "15px", fontWeight: isDone ? 600 : 400, color: isDone ? "#0A0A0A" : "#A3A3A3", lineHeight: 1.3 }}>
                              {STEP_LABELS[status] ?? status}
                            </p>
                            {formatted && (
                              <p style={{ margin: "3px 0 0", fontSize: "13px", color: "#737373" }}>
                                {formatted}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })() : null}

          {/* Payment tab */}
          {activeTab === "payment" ? (
            <div style={{ padding: "24px 0" }}>
              {!detail.payment ? (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500, color: "#171717" }}>No payment recorded</p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#A3A3A3" }}>Payment is recorded when a technician completes the job</p>
                </div>
              ) : (() => {
                const pmt = detail.payment!;
                const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string; label: string }> = {
                  collected: { bg: "#DCFCE7", color: "#166534", dot: "#22C55E", label: "Collected" },
                  refunded:  { bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B", label: "Refunded"  },
                  disputed:  { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444", label: "Disputed"  },
                  pending:   { bg: "#F5F5F5", color: "#525252", dot: "#A3A3A3", label: "Pending"   },
                };
                const s = STATUS_STYLE[pmt.status] ?? STATUS_STYLE["pending"];
                const recordedDate = new Date(pmt.recordedAt).toLocaleString("en-US", {
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                });
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Amount + status */}
                    <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Amount Collected</p>
                        <p style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#171717", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          RS {pmt.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "9999px", backgroundColor: s.bg, color: s.color, fontSize: "13px", fontWeight: 600 }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
                        {s.label}
                      </span>
                    </div>

                    {/* Service items breakdown */}
                    {pmt.items.length > 0 && (
                      <div style={{ border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden" }}>
                        <div style={{ padding: "12px 20px", backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5" }}>
                          <span style={{ fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Service Items</span>
                        </div>
                        {pmt.items.map((item, i) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "12px 20px", gap: "16px",
                              borderBottom: i < pmt.items.length - 1 ? "1px solid #F5F5F5" : "none",
                              backgroundColor: "#fff",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: "13px", color: "#171717" }}>{item.name}</span>
                              {item.quantity !== 1 && (
                                <span style={{ fontSize: "12px", color: "#737373", marginLeft: "6px" }}>× {item.quantity}</span>
                              )}
                            </div>
                            <span style={{ fontSize: "13px", color: "#171717", fontWeight: 500, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                              RS {item.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        {/* Subtotal row if there's also an additional amount */}
                        {(() => {
                          const itemsSum = pmt.items.reduce((s, it) => s + it.total, 0);
                          const diff = parseFloat((pmt.amount - itemsSum).toFixed(2));
                          if (diff > 0.005) return (
                            <>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #F5F5F5", backgroundColor: "#fff" }}>
                                <span style={{ fontSize: "13px", color: "#737373" }}>Additional charges</span>
                                <span style={{ fontSize: "13px", color: "#171717", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>RS {diff.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </>
                          );
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Detail rows */}
                    <div style={{ border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden" }}>
                      {[
                        { label: "Payment Method", value: pmt.paymentMethodName ?? "—" },
                        { label: "Recorded By",    value: pmt.recordedByName ?? "—"     },
                        { label: "Date & Time",    value: recordedDate                   },
                        { label: "Payment ID",     value: pmt.id                         },
                      ].map(({ label, value }, i, arr) => (
                        <div
                          key={label}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "14px 20px", gap: "16px",
                            borderBottom: i < arr.length - 1 ? "1px solid #F5F5F5" : "none",
                            backgroundColor: "#fff",
                          }}
                        >
                          <span style={{ fontSize: "13px", color: "#737373", flexShrink: 0 }}>{label}</span>
                          <span style={{ fontSize: "13px", color: "#171717", fontWeight: 500, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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

          {/* ── Technician sidebar ── */}
          {isTechnician ? (() => {
            const TECH_ACTIONS: Record<string, { label: string; next: string }> = {
              assigned:     { label: "Acknowledge Job →",       next: "acknowledged" },
              acknowledged: { label: "I'm On My Way →",         next: "in_transit" },
              in_transit:   { label: "Start Job →",             next: "in_process" },
              in_process:   {
                label: detail.type === "installation" ? "Complete Installation →" : "Resolve Job →",
                next: detail.type === "installation" ? "completed" : "resolved",
              },
            };
            const action = TECH_ACTIONS[detail.status];
            const isTerminal = TERMINAL_OR_CLOSED.has(detail.status);

            return (
              <>
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Current Status</p>
                  <StatusChip status={detail.status} />
                </div>

                {action && (
                  <button
                    type="button"
                    disabled={transitionMutation.isPending}
                    onClick={() => {
                      if (detail.status === "in_process") {
                        setCollectPaymentOpen(true);
                      } else {
                        transitionMutation.mutate(action.next);
                      }
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: "10px",
                      backgroundColor: "#0A0A0A",
                      color: "#fff",
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: transitionMutation.isPending ? "not-allowed" : "pointer",
                      opacity: transitionMutation.isPending ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {transitionMutation.isPending ? "Updating…" : action.label}
                  </button>
                )}

                {isTerminal && (
                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", fontSize: "13px", color: "#16A34A", textAlign: "center", fontWeight: 500 }}>
                    Job complete
                  </div>
                )}
              </>
            );
          })() : null}

          {/* ── Owner / staff sidebar ── */}
          {!isTechnician && (canAdvanceStatus ? (
            <>
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
                      onClick={() => { transitionMutation.mutate(undefined); setAdvanceStatusOpen(false); }}
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
                    padding: "12px 16px",
                    fontSize: "14px",
                    fontWeight: 500,
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
            </>
          ) : (
            <div
              style={{
                borderRadius: "10px",
                border: "1px solid #E5E5E5",
                backgroundColor: "#FAFAFA",
                padding: "14px",
                fontSize: "13px",
                color: "#737373",
                textAlign: "center",
              }}
            >
              Assign a technician and set a scheduled date to advance this installation job.
            </div>
          ))}

          {/* Actions dropdown — owner/staff only */}
          {!isTechnician && <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              style={{
                width: "100%",
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                backgroundColor: "#fff",
                color: "#404040",
                padding: "9px 14px",
                fontSize: "13px",
                fontWeight: 400,
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
          </div>}

          {/* Payment card — owner/staff only */}
          {!isTechnician && <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "14px", backgroundColor: "#fff" }}>
            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.07em", textTransform: "uppercase" }}>Payment</p>
            {!detail.payment ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>No payment recorded</p>
            ) : (
              <div style={{ display: "grid", gap: "4px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#171717", fontWeight: 500 }}>RS {detail.payment.amount.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>{detail.payment.paymentMethodName ?? "—"}</p>
              </div>
            )}
          </div>}

          {/* Undo banner */}
          {undoSecondsLeft > 0 && !isTechnician ? (
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

      {/* ── Collect Payment modal ──────────────────────────── */}
      {collectPaymentOpen && (() => {
        const brands = brandsQuery.data ?? [];
        const serviceItems = serviceItemsQuery.data ?? [];
        const paymentMethods = paymentMethodsQuery.data ?? [];
        const selectedServiceItems = serviceItems.filter((si) => paySelectedItems.has(si.id));
        const selectedItemsTotal = selectedServiceItems.reduce((sum, si) => {
          const qty = si.pricingType === "variable" ? (payItemQuantities.get(si.id) ?? 1) : 1;
          return sum + si.unitPrice * qty;
        }, 0);
        const additionalNum = parseFloat(payAdditional) || 0;
        const totalAmount = selectedItemsTotal + additionalNum;
        const canConfirm = paySelectedMethodId && totalAmount >= 0;
        const terminalStatus = detail.type === "installation" ? "completed" : "resolved";

        return (
          <div
            style={{
              position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: "16px",
            }}
            onClick={() => setCollectPaymentOpen(false)}
          >
            <div
              style={{
                backgroundColor: "#fff", borderRadius: "16px",
                width: "100%", maxWidth: "480px", maxHeight: "90vh",
                overflow: "hidden", display: "flex", flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", borderBottom: "1px solid #F5F5F5" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: "#171717" }}>Collect Payment</h2>
                  <p style={{ margin: "3px 0 0", fontSize: "13px", color: "#737373" }}>{detail.customerName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectPaymentOpen(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", padding: "4px", color: "#737373", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* Brand */}
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Brand Installed</p>
                  <select
                    style={{ width: "100%", border: "1px solid #E5E5E5", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#171717", backgroundColor: "#fff", boxSizing: "border-box" }}
                  >
                    <option value="">Select brand…</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id} selected={b.id === detail.brandId}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Service items */}
                <div>
                  <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Service Items Used</p>
                  {serviceItems.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#A3A3A3", margin: 0 }}>No service items configured.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {serviceItems.map((si) => {
                        const checked = paySelectedItems.has(si.id);
                        const isVariable = si.pricingType === "variable";
                        const qty = payItemQuantities.get(si.id) ?? 1;
                        const lineTotal = si.unitPrice * (isVariable ? qty : 1);
                        return (
                          <div
                            key={si.id}
                            style={{
                              padding: "10px 12px", borderRadius: "8px",
                              backgroundColor: checked ? "#F0FDF4" : "transparent",
                              border: checked ? "1px solid #BBF7D0" : "1px solid transparent",
                              transition: "all 0.1s",
                            }}
                          >
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = new Set(paySelectedItems);
                                    if (checked) next.delete(si.id); else next.add(si.id);
                                    setPaySelectedItems(next);
                                  }}
                                  style={{ width: "16px", height: "16px", accentColor: "#16A34A", cursor: "pointer" }}
                                />
                                <span style={{ fontSize: "14px", color: "#171717" }}>{si.name}</span>
                                {isVariable && <span style={{ fontSize: "11px", padding: "1px 6px", backgroundColor: "#EEF2FF", borderRadius: "4px", color: "#4338CA" }}>per {si.unitLabel ?? "unit"}</span>}
                              </span>
                              <span style={{ fontSize: "13px", color: "#525252", fontWeight: 500 }}>
                                RS {lineTotal.toFixed(2)}
                              </span>
                            </label>
                            {isVariable && checked && (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", paddingLeft: "26px" }}>
                                <span style={{ fontSize: "12px", color: "#737373" }}>Qty ({si.unitLabel ?? "unit"}):</span>
                                <input
                                  type="number"
                                  min="0.001"
                                  step="0.5"
                                  value={qty}
                                  onChange={(e) => {
                                    const next = new Map(payItemQuantities);
                                    next.set(si.id, Math.max(0.001, parseFloat(e.target.value) || 1));
                                    setPayItemQuantities(next);
                                  }}
                                  style={{ width: "80px", border: "1px solid #D1FAE5", borderRadius: "6px", padding: "4px 8px", fontSize: "13px", outline: "none" }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Additional charges */}
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Additional Charges (RS)</p>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payAdditional}
                    onChange={(e) => setPayAdditional(e.target.value)}
                    placeholder="0.00"
                    style={{ width: "100%", border: "1px solid #E5E5E5", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#171717", boxSizing: "border-box", outline: "none" }}
                  />
                </div>

                {/* Payment method */}
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Payment Method</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {paymentMethods.filter((m) => m.isActive).map((m) => {
                      const sel = paySelectedMethodId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaySelectedMethodId(m.id)}
                          style={{
                            padding: "8px 16px", borderRadius: "9999px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
                            border: sel ? "none" : "1px solid #E5E5E5",
                            backgroundColor: sel ? "#0A0A0A" : "#fff",
                            color: sel ? "#fff" : "#525252",
                          }}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                    {paymentMethods.filter((m) => m.isActive).length === 0 && (
                      <p style={{ fontSize: "13px", color: "#A3A3A3", margin: 0 }}>No payment methods configured.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "16px 20px", borderTop: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", color: "#737373" }}>Total</span>
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "#0A0A0A" }}>
                    RS {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setCollectPaymentOpen(false)}
                    style={{ flex: 1, border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#404040", padding: "9px 14px", fontSize: "13px", fontWeight: 400, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canConfirm || collectPaymentMutation.isPending}
                    onClick={() => {
                      if (!paySelectedMethodId) return;
                      const builtItems = selectedServiceItems.map((si) => {
                        const isVar = si.pricingType === "variable";
                        const qty = isVar ? (payItemQuantities.get(si.id) ?? 1) : 1;
                        const tot = parseFloat((si.unitPrice * qty).toFixed(2));
                        return { serviceItemId: si.id, name: si.name, unitPrice: si.unitPrice, quantity: qty, total: tot };
                      });
                      collectPaymentMutation.mutate({
                        toStatus: terminalStatus,
                        paymentMethodId: paySelectedMethodId,
                        paymentAmount: totalAmount,
                        serviceItems: builtItems.length > 0 ? builtItems : undefined,
                      });
                      setCollectPaymentOpen(false);
                    }}
                    style={{
                      flex: 2, border: "none", borderRadius: "10px",
                      backgroundColor: canConfirm ? "#0A0A0A" : "#E5E5E5",
                      color: canConfirm ? "#fff" : "#A3A3A3",
                      padding: "12px 16px", fontSize: "14px", fontWeight: 500,
                      cursor: canConfirm ? "pointer" : "not-allowed",
                    }}
                  >
                    {collectPaymentMutation.isPending ? "Processing…" : paySelectedMethodId ? `Confirm — ${paymentMethods.find((m) => m.id === paySelectedMethodId)?.name ?? ""}` : "Select method to confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
          {reassignError ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#991B1B", padding: "8px 10px", border: "1px solid #FECACA", borderRadius: "8px", backgroundColor: "#FEF2F2" }}>{reassignError}</p>
          ) : null}
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
              {(detail.type === "complaint" ? COMPLAINT_STATUSES : INSTALLATION_STATUSES).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>
            Reason
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason is required"
              rows={3}
              style={{
                borderRadius: "8px",
                border: `1px solid ${overrideReason.length >= OVERRIDE_REASON_MIN_CHARS ? "#10B981" : "#E5E5E5"}`,
                padding: "8px 10px",
                fontSize: "13px",
                color: "#171717",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: "11px", color: overrideReason.length >= OVERRIDE_REASON_MIN_CHARS ? "#10B981" : "#737373" }}>
              {overrideReason.length} / {OVERRIDE_REASON_MIN_CHARS} minimum
            </span>
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
