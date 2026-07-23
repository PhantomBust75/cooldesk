"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  fetchJobDetail,
  fetchJobRevisits,
  fetchJobTimeline,
  ownerOverrideJobStatus,
  quickCompleteJob,
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
import { fetchOfficeBrands, fetchPaymentMethods } from "@/lib/api/operations";
import { fetchServiceItems } from "@/lib/api/service-items";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  History,
  Loader2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import type { TransitionJobStatusInput } from "@/types/jobs";
import {
  formatDateTime,
  formatDateTimeWithZone,
  formatShortDateTime,
  formatWeekdayDateTime,
} from "@/lib/format-date";

const TERMINAL_OR_CLOSED = new Set([
  "completed",
  "resolved",
  "resolved_on_revisit",
  "cancelled",
]);

/** Primary-button copy: name the step being taken, not the mechanism. */
const STATUS_ACTION_LABELS: Record<string, string> = {
  assigned: "Assign Technician",
  acknowledged: "Acknowledge Job",
  in_transit: "Start Travel",
  in_process: "Start Job",
  completed: "Complete Job",
  resolved: "Resolve Job",
  resolved_on_revisit: "Resolve Job",
  needs_revisit: "Mark Needs Revisit",
  revisit_scheduled: "Schedule Revisit",
  scheduled: "Schedule Job",
  cancelled: "Cancel Job",
};

const metaLabelStyle: CSSProperties = {
  margin: "0 0 4px",
  fontSize: "10px",
  fontWeight: 600,
  color: "#A3A3A3",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
};

const metaDividerStyle: CSSProperties = {
  width: "1px",
  height: "28px",
  backgroundColor: "#E5E5E5",
  flexShrink: 0,
};

const metaTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "9999px",
  padding: "3px 10px",
  fontSize: "12px",
  fontWeight: 500,
};

const sectionCardStyle: CSSProperties = {
  padding: "16px",
  border: "1px solid #E5E5E5",
  borderRadius: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const sectionCardLabelStyle: CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#A3A3A3",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
};

const fieldRowStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  minHeight: "22px",
};

const fieldLabelStyle: CSSProperties = {
  fontSize: "12px",
  color: "#A3A3A3",
  minWidth: "88px",
  flexShrink: 0,
  paddingTop: "1px",
  lineHeight: 1.5,
};

const fieldValueStyle: CSSProperties = {
  fontSize: "13px",
  color: "#171717",
  flex: 1,
  lineHeight: 1.5,
};
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
  const [paymentDecision, setPaymentDecision] = useState<"retain" | "void">(
    "retain",
  );

  const [activeTab, setActiveTab] = useState<
    "details" | "timeline" | "payment" | "review"
  >("details");
  const [actionsOpen, setActionsOpen] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [reassignOpen, setReassignOpen] = useState<boolean>(false);
  const [reassignTechId, setReassignTechId] = useState<string>("");
  const [advanceStatusOpen, setAdvanceStatusOpen] = useState<boolean>(false);
  const [collectPaymentOpen, setCollectPaymentOpen] = useState<boolean>(false);
  const [isQuickComplete, setIsQuickComplete] = useState<boolean>(false);
  const [paySelectedItems, setPaySelectedItems] = useState<Set<string>>(
    new Set(),
  );
  const [payItemQuantities, setPayItemQuantities] = useState<
    Map<string, number>
  >(new Map());
  const [paySelectedMethodId, setPaySelectedMethodId] = useState("");
  const [paySelectedBrandId, setPaySelectedBrandId] = useState("");
  const [payStatus, setPayStatus] = useState<"collected" | "pending">(
    "collected",
  );
  const [payAdditionalCharges, setPayAdditionalCharges] = useState<
    Array<{ id: string; description: string; amount: string }>
  >([]);

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
      enqueueSnackbar(
        err instanceof Error ? err.message : "Failed to update status.",
        { variant: "error" },
      );
    },
  });

  const collectPaymentMutation = useMutation({
    mutationFn: async (payload: {
      toStatus: string;
      paymentMethodId: string;
      paymentAmount: number;
      serviceItems: TransitionJobStatusInput["serviceItems"];
      installedBrandId?: string;
      installationCharge?: number;
      paymentStatus: "collected" | "pending";
    }) => {
      if (!detailQuery.data) return;
      await transitionJobStatus(jobId, {
        toStatus: payload.toStatus,
        expectedVersion: detailQuery.data.version,
        paymentAmount: payload.paymentAmount,
        paymentMethodId: payload.paymentMethodId,
        serviceItems: payload.serviceItems,
        installedBrandId: payload.installedBrandId,
        installationCharge: payload.installationCharge,
        paymentStatus: payload.paymentStatus,
      });
    },
    onSuccess: async () => {
      enqueueSnackbar("Payment collected and job completed", {
        variant: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
    },
    onError: (err: unknown) => {
      enqueueSnackbar(
        err instanceof Error ? err.message : "Failed to collect payment.",
        { variant: "error" },
      );
    },
  });

  const quickCompleteMutation = useMutation({
    mutationFn: async (payload: {
      paymentMethodId: string;
      paymentAmount: number;
      serviceItems: TransitionJobStatusInput["serviceItems"];
      installedBrandId?: string;
      installationCharge?: number;
      paymentStatus: "collected" | "pending";
    }) => {
      if (!detailQuery.data) return;
      await quickCompleteJob(jobId, {
        expectedVersion: detailQuery.data.version,
        paymentAmount: payload.paymentAmount,
        paymentMethodId: payload.paymentMethodId,
        serviceItems: payload.serviceItems,
        installedBrandId: payload.installedBrandId,
        installationCharge: payload.installationCharge,
        paymentStatus: payload.paymentStatus,
      });
    },
    onSuccess: async () => {
      enqueueSnackbar("Job completed", { variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job-timeline", jobId] }),
      ]);
    },
    onError: (err: unknown) => {
      enqueueSnackbar(
        err instanceof Error ? err.message : "Failed to complete job.",
        { variant: "error" },
      );
    },
  });

  const closeCollectPayment = () => {
    setCollectPaymentOpen(false);
    setIsQuickComplete(false);
    setPaySelectedItems(new Set());
    setPayItemQuantities(new Map());
    setPaySelectedMethodId("");
    setPaySelectedBrandId("");
    setPayStatus("collected");
    setPayAdditionalCharges([]);
  };

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
      enqueueSnackbar(
        err instanceof Error ? err.message : "Failed to rollback status.",
        { variant: "error" },
      );
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
      enqueueSnackbar(
        err instanceof Error ? err.message : "Failed to override status.",
        { variant: "error" },
      );
    },
  });

  const [reassignError, setReassignError] = useState("");
  const reassignMutation = useMutation({
    mutationFn: () => reassignTechnician(jobId, reassignTechId),
    onSuccess: async () => {
      enqueueSnackbar("Technician reassigned successfully", {
        variant: "success",
      });
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
    return (
      <div style={{ padding: "24px", fontSize: "13px", color: "#737373" }}>
        Loading job details...
      </div>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <div
        style={{
          margin: "24px",
          borderRadius: "8px",
          border: "1px solid #FECACA",
          backgroundColor: "#FEF2F2",
          padding: "12px",
          fontSize: "13px",
          color: "#991B1B",
        }}
      >
        Unable to load job details.
      </div>
    );
  }

  const detail = detailQuery.data;
  const nextStatuses = getAllowedNextStatuses(detail);
  const shortJobId = detail.id.slice(0, 8).toUpperCase();
  // The single next step, when there is exactly one — lets the primary button
  // say what it actually does instead of a generic "Advance Status".
  const soleNextStatus = nextStatuses.length === 1 ? nextStatuses[0] : null;
  const primaryActionLabel = soleNextStatus
    ? (STATUS_ACTION_LABELS[soleNextStatus] ?? "Advance Status →")
    : "Advance Status →";
  const primaryActionCompletes = soleNextStatus
    ? TERMINAL_OR_CLOSED.has(soleNextStatus) && soleNextStatus !== "cancelled"
    : false;

  function handleCopyDetails() {
    const lines = [
      `Customer: ${detail.customerName}`,
      `Phone: ${detail.phone}`,
      `Address: ${detail.address}`,
    ];
    if (detail.brandName) lines.push(`Brand: ${detail.brandName}`);
    lines.push(
      `Type: ${detail.type === "installation" ? "Installation" : "Complaint"}`,
    );
    if (detail.scheduledAt) {
      lines.push(`Scheduled: ${formatWeekdayDateTime(detail.scheduledAt)}`);
    }
    detail.units.forEach((unit, index) => {
      const meta = [
        unit.unitType,
        unit.tonnage != null ? `${unit.tonnage} ton` : null,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(
        `Unit ${index + 1}: ${unit.model ?? unit.label}${meta ? `, ${meta}` : ""}`,
      );
    });
    const notes =
      detail.type === "installation"
        ? detail.installationNotes
        : detail.issueDescription;
    if (notes) lines.push(`Notes: ${notes}`);
    navigator.clipboard.writeText(lines.join("\n"));
    enqueueSnackbar("Job details copied", { variant: "success" });
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 2000);
  }
  const canRollbackOneStep =
    isOfficeStaff && !TERMINAL_OR_CLOSED.has(detail.status);
  const hasPayment = Boolean(detail.payment);
  const isPaidCompletion =
    detail.status === "completed" ||
    detail.status === "resolved" ||
    detail.status === "resolved_on_revisit";
  const requiresPaymentDecision = hasPayment && isPaidCompletion;
  const revisitCount = revisitsQuery.data?.length ?? 0;

  const canAdvanceStatus = canProgressInstallation({
    type: detail.type,
    technicianId: detail.assignedTechnicianId,
    scheduledAt: detail.scheduledAt,
  });

  // Owner Quick-Complete: eligible once scheduled + assigned, through every
  // subsequent state, until the job is terminal or frozen for cancellation.
  const canQuickComplete =
    Boolean(detail.assignedTechnicianId) &&
    Boolean(detail.scheduledAt) &&
    !TERMINAL_OR_CLOSED.has(detail.status) &&
    detail.status !== "cancellation_requested";

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
    <section
      style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1200px" }}
    >
      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Link
            href="/jobs"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "13px",
              color: "#737373",
              textDecoration: "none",
              minHeight: "36px",
            }}
          >
            <ArrowLeft size={13} strokeWidth={1.5} /> All jobs
          </Link>
          <span style={{ color: "#D4D4D4", fontSize: "13px" }}>/</span>
          <span
            style={{
              fontSize: "13px",
              color: "#A3A3A3",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          >
            {shortJobId}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyDetails}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 10px",
            borderRadius: "7px",
            border: "1px solid #E5E5E5",
            backgroundColor: copiedAll ? "#F0FDF4" : "#fff",
            cursor: "pointer",
            fontSize: "12px",
            color: copiedAll ? "#059669" : "#737373",
            transition:
              "color 150ms, background-color 150ms, border-color 150ms",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Copy size={11} strokeWidth={1.5} />
          {copiedAll ? "Copied!" : "Copy details"}
        </button>
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <span
          style={{
            fontSize: isMobile ? "20px" : "22px",
            fontWeight: 600,
            color: "#0A0A0A",
            letterSpacing: "-0.01em",
          }}
        >
          {detail.customerName}
        </span>
      </div>

      {/* ── Main grid ──────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 280px",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* ── Left column: tabs + content ──────────────────── */}
        <div>
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              borderBottom: "1px solid #E5E5E5",
              marginBottom: "24px",
            }}
          >
            {(["details", "timeline", "payment", "review"] as const)
              .filter((tab) => !(isTechnician && tab === "review"))
              .map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom:
                      activeTab === tab
                        ? "2px solid #0A0A0A"
                        : "2px solid transparent",
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
              {/* ── Meta strip: id / brand / type / source / status / tags ── */}
              <div
                style={{
                  border: "1px solid #E5E5E5",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p style={metaLabelStyle}>Job ID</p>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#171717",
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    }}
                  >
                    {shortJobId}
                    <button
                      type="button"
                      title="Copy job ID"
                      onClick={() => navigator.clipboard.writeText(detail.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "#A3A3A3",
                        display: "inline-flex",
                      }}
                    >
                      <Copy size={13} strokeWidth={1.5} />
                    </button>
                  </span>
                </div>
                <div style={metaDividerStyle} />
                <div>
                  <p style={metaLabelStyle}>Brand</p>
                  <span
                    style={{
                      fontSize: "14px",
                      color: detail.brandName ? "#64748B" : "#A3A3A3",
                    }}
                  >
                    {detail.brandName ?? "—"}
                  </span>
                </div>
                <div style={metaDividerStyle} />
                <div>
                  <p style={metaLabelStyle}>Type</p>
                  <span style={{ fontSize: "14px", color: "#171717" }}>
                    {detail.type === "installation"
                      ? "Installation"
                      : "Complaint"}
                  </span>
                </div>
                {detail.source === "via_dealer" ? (
                  <>
                    <div style={metaDividerStyle} />
                    <div>
                      <p style={metaLabelStyle}>Source</p>
                      <span style={{ fontSize: "14px", color: "#171717" }}>
                        via {detail.dealerName ?? "dealer"}
                      </span>
                    </div>
                  </>
                ) : null}
                <div style={metaDividerStyle} />
                <div>
                  <p style={metaLabelStyle}>Status</p>
                  <StatusChip status={detail.status} />
                </div>
                {revisitCount > 0 || detail.tags.length > 0 ? (
                  <div style={metaDividerStyle} />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                    alignSelf: "flex-end",
                    paddingBottom: "2px",
                  }}
                >
                  {revisitCount > 0 ? (
                    <span
                      style={{
                        ...metaTagStyle,
                        backgroundColor: "#EFF6FF",
                        color: "#2563EB",
                      }}
                    >
                      Revisit #{revisitCount}
                    </span>
                  ) : null}
                  {detail.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        ...metaTagStyle,
                        backgroundColor:
                          tag === "chronic"
                            ? "#FEF3C7"
                            : tag === "frequent"
                              ? "#FFFBEB"
                              : "#F1F5F9",
                        color:
                          tag === "chronic"
                            ? "#92400E"
                            : tag === "frequent"
                              ? "#92400E"
                              : "#1E293B",
                      }}
                    >
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Two-column: Customer | Job Details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                {/* ── CUSTOMER ── */}
                <div style={sectionCardStyle}>
                  <span style={sectionCardLabelStyle}>Customer</span>

                  {/* Name */}
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Name</span>
                    <span style={fieldValueStyle}>{detail.customerName}</span>
                  </div>

                  {/* Phone */}
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Phone</span>
                    <a
                      href={`tel:${detail.phone}`}
                      title="Call customer"
                      style={{
                        ...fieldValueStyle,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        textDecoration: "none",
                        width: "fit-content",
                      }}
                    >
                      {detail.phone}
                      <Phone size={13} strokeWidth={1.5} color="#A3A3A3" />
                    </a>
                  </div>

                  {/* Address */}
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Address</span>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(detail.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Google Maps"
                      style={{
                        ...fieldValueStyle,
                        display: "inline-flex",
                        alignItems: "flex-start",
                        gap: "6px",
                        textDecoration: "none",
                      }}
                    >
                      <span>{detail.address}</span>
                      <MapPin
                        size={13}
                        strokeWidth={1.5}
                        color="#A3A3A3"
                        style={{ flexShrink: 0, marginTop: "2px" }}
                      />
                    </a>
                  </div>
                </div>

                {/* ── SCHEDULING ── */}
                <div style={sectionCardStyle}>
                  <span style={sectionCardLabelStyle}>Scheduling</span>

                  {/* Technician */}
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Technician</span>
                    <span
                      style={{
                        ...fieldValueStyle,
                        color: detail.assignedTechnicianName
                          ? "#171717"
                          : "#A3A3A3",
                        fontStyle: detail.assignedTechnicianName
                          ? "normal"
                          : "italic",
                      }}
                    >
                      {detail.assignedTechnicianName ?? "Unassigned"}
                    </span>
                  </div>

                  {/* Scheduled */}
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Scheduled</span>
                    <span style={fieldValueStyle}>
                      {detail.scheduledAt ? (
                        formatWeekdayDateTime(detail.scheduledAt)
                      ) : (
                        <span style={{ color: "#A3A3A3" }}>—</span>
                      )}
                    </span>
                  </div>

                  {/* Created */}
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Created</span>
                    <span style={{ ...fieldValueStyle, color: "#737373" }}>
                      {formatDateTimeWithZone(detail.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Issue reported — complaints only ── */}
              {detail.type === "complaint" && detail.issueDescription ? (
                <div
                  style={{
                    padding: "14px 16px",
                    backgroundColor: "#FAFAFA",
                    borderRadius: "10px",
                    border: "1px solid #F0F0F0",
                    marginBottom: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#A3A3A3",
                      letterSpacing: "0.09em",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Issue Reported
                  </span>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#404040",
                      fontStyle: "italic",
                      margin: 0,
                      lineHeight: 1.65,
                    }}
                  >
                    &ldquo;{detail.issueDescription}&rdquo;
                  </p>
                </div>
              ) : null}

              {/* ── Notes — installations only ── */}
              {detail.type === "installation" && detail.installationNotes ? (
                <div
                  role="note"
                  style={{
                    padding: "14px 16px",
                    backgroundColor: "#FFFBEB",
                    borderRadius: "10px",
                    border: "1px solid #FDE68A",
                    marginBottom: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#92400E",
                      letterSpacing: "0.09em",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Notes
                  </span>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#404040",
                      margin: 0,
                      lineHeight: 1.65,
                    }}
                  >
                    {detail.installationNotes}
                  </p>
                </div>
              ) : null}

              {/* ── Unit details ── */}
              {detail.units.length > 0 ? (
                <div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#A3A3A3",
                      letterSpacing: "0.09em",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Unit Details
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {detail.units.map((unit) => (
                      <div
                        key={unit.id}
                        style={{
                          padding: "12px 14px",
                          border: "1px solid #E5E5E5",
                          borderRadius: "8px",
                          backgroundColor: "#FAFAFA",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                            {unit.model ?? unit.label}
                          </span>
                          {unit.unitType ? (
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#737373",
                                padding: "1px 7px",
                                backgroundColor: "#F5F5F5",
                                borderRadius: "4px",
                              }}
                            >
                              {unit.unitType}
                            </span>
                          ) : null}
                          {unit.tonnage != null ? (
                            <span
                              style={{
                                fontSize: "12px",
                                padding: "1px 7px",
                                backgroundColor: "#EFF6FF",
                                borderRadius: "4px",
                                color: "#1D4ED8",
                              }}
                            >
                              {unit.tonnage} ton
                            </span>
                          ) : null}
                        </div>
                        {unit.serialOuter || unit.serialInner ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            {unit.serialOuter ? (
                              <div style={{ fontSize: "12px", color: "#737373", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                                <span style={{ color: "#A3A3A3" }}>Outer SN: </span>
                                {unit.serialOuter}
                              </div>
                            ) : null}
                            {unit.serialInner ? (
                              <div style={{ fontSize: "12px", color: "#737373", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                                <span style={{ color: "#A3A3A3" }}>Inner SN: </span>
                                {unit.serialInner}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Timeline tab */}
          {activeTab === "timeline"
            ? (() => {
                const EVENT_LABELS: Record<string, string> = {
                  status_transition: "Status changed",
                  status_undo: "Status rolled back",
                  owner_quick_complete: "Completed by owner (Quick-Complete)",
                  technician_assigned: "Technician assigned",
                  assignment: "Technician assigned",
                  scheduling_conflict_ack: "Scheduling conflict acknowledged",
                  schedule_rescheduled: "Rescheduled",
                  revisit_created: "Revisit created",
                  revisit_scheduled: "Revisit scheduled",
                  cancellation: "Job cancelled",
                  cancellation_request: "Cancellation requested",
                  cancellation_approved: "Cancellation approved",
                  cancellation_rejected: "Cancellation rejected",
                  reopened: "Job reopened",
                  payment_recorded: "Payment recorded",
                  rollback_payment_voided: "Payment voided",
                  system_event: "System event",
                  vcid_review_required: "Needs VCID review",
                };

                function labelFor(eventType: string): string {
                  return (
                    EVENT_LABELS[eventType] ??
                    eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  );
                }

                function iconFor(eventType: string, isSystem: boolean) {
                  if (isSystem) return <Bot size={14} strokeWidth={1.5} />;
                  if (eventType.includes("cancellation")) return <X size={14} strokeWidth={1.5} />;
                  if (eventType.includes("revisit")) return <AlertTriangle size={14} strokeWidth={1.5} />;
                  if (eventType.includes("schedul")) return <Clock size={14} strokeWidth={1.5} />;
                  if (eventType.includes("assign")) return <RefreshCw size={14} strokeWidth={1.5} />;
                  if (eventType === "reopened" || eventType === "status_undo" || eventType === "rollback_payment_voided") {
                    return <RotateCcw size={14} strokeWidth={1.5} />;
                  }
                  if (eventType === "payment_recorded") return <CheckCircle2 size={14} strokeWidth={1.5} />;
                  return <History size={14} strokeWidth={1.5} />;
                }

                // Only status_transition/status_undo carry a human-readable value
                // (a status name) — every other event's JSON payload is IDs/dates
                // that would render as noise, so we only show a chip here.
                function statusOf(value: unknown): string | null {
                  if (value && typeof value === "object" && "status" in value) {
                    const status = String((value as Record<string, unknown>).status);
                    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  }
                  return null;
                }

                const events = timelineQuery.data ?? [];

                return (
                  <div>
                    {timelineQuery.isLoading && (
                      <p style={{ fontSize: "13px", color: "#737373" }}>Loading timeline…</p>
                    )}
                    {timelineQuery.error && (
                      <p style={{ fontSize: "13px", color: "#991B1B" }}>Unable to load timeline.</p>
                    )}
                    {!timelineQuery.isLoading && !timelineQuery.error && events.length === 0 ? (
                      <p style={{ color: "#737373", fontSize: "13px", padding: "16px 0" }}>No timeline events yet.</p>
                    ) : null}
                    {!timelineQuery.isLoading && !timelineQuery.error && events.length > 0 ? (
                      <div>
                        {events.map((event, i) => {
                          const isSystem = !event.actorUserId && !event.actorDealerId;
                          const fromStatus = statusOf(event.previousValue);
                          const toStatus = statusOf(event.newValue);
                          return (
                            <div key={event.id} style={{ display: "flex", gap: "12px", marginTop: i === 0 ? 0 : "16px" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "9999px",
                                    backgroundColor: "#F5F5F5",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#525252",
                                    flexShrink: 0,
                                  }}
                                >
                                  {iconFor(event.eventType, isSystem)}
                                </div>
                                {i < events.length - 1 ? (
                                  <div style={{ width: "1px", flex: 1, backgroundColor: "#E5E5E5", minHeight: "16px", marginTop: "4px" }} />
                                ) : null}
                              </div>
                              <div style={{ flex: 1, paddingBottom: "4px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: 500, color: isSystem ? "#737373" : "#404040" }}>
                                    {labelFor(event.eventType)}
                                  </span>
                                  <span style={{ fontSize: "12px", color: "#A3A3A3", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                                    {formatShortDateTime(event.occurredAt)}
                                  </span>
                                </div>
                                <div style={{ fontSize: "12px", color: "#737373", marginTop: "2px" }}>
                                  {isSystem ? <span style={{ fontStyle: "italic" }}>System</span> : (event.actorName ?? "—")}
                                </div>
                                {fromStatus || toStatus ? (
                                  <div style={{ marginTop: "6px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                    {fromStatus ? (
                                      <span style={{ padding: "2px 6px", backgroundColor: "#FEE2E2", color: "#991B1B", borderRadius: "4px", fontSize: "11px" }}>
                                        {fromStatus}
                                      </span>
                                    ) : null}
                                    {fromStatus && toStatus ? <span style={{ color: "#A3A3A3", fontSize: "12px" }}>→</span> : null}
                                    {toStatus ? (
                                      <span style={{ padding: "2px 6px", backgroundColor: "#D1FAE5", color: "#065F46", borderRadius: "4px", fontSize: "11px" }}>
                                        {toStatus}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {event.reason ? (
                                  <div
                                    style={{
                                      marginTop: "6px",
                                      padding: "6px 10px",
                                      backgroundColor: "#FAFAFA",
                                      borderLeft: "2px solid #E5E5E5",
                                      borderRadius: "2px",
                                      fontSize: "12px",
                                      color: "#525252",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    &ldquo;{event.reason}&rdquo;
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })()
            : null}

          {/* Payment tab */}
          {activeTab === "payment" ? (
            <div style={{ padding: "24px 0" }}>
              {!detail.payment ? (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#171717",
                    }}
                  >
                    No payment recorded
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#A3A3A3" }}>
                    Payment is recorded when a technician completes the job
                  </p>
                </div>
              ) : (
                (() => {
                  const pmt = detail.payment!;
                  const STATUS_STYLE: Record<
                    string,
                    { bg: string; color: string; dot: string; label: string }
                  > = {
                    collected: {
                      bg: "#DCFCE7",
                      color: "#166534",
                      dot: "#22C55E",
                      label: "Collected",
                    },
                    refunded: {
                      bg: "#FEF3C7",
                      color: "#92400E",
                      dot: "#F59E0B",
                      label: "Refunded",
                    },
                    disputed: {
                      bg: "#FEE2E2",
                      color: "#991B1B",
                      dot: "#EF4444",
                      label: "Disputed",
                    },
                    pending: {
                      bg: "#F5F5F5",
                      color: "#525252",
                      dot: "#A3A3A3",
                      label: "Pending",
                    },
                  };
                  const s = STATUS_STYLE[pmt.status] ?? STATUS_STYLE["pending"];
                  const recordedDate = formatDateTime(pmt.recordedAt);
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      {/* Amount + status */}
                      <div
                        style={{
                          backgroundColor: "#FAFAFA",
                          border: "1px solid #E5E5E5",
                          borderRadius: "12px",
                          padding: "20px 24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              margin: "0 0 4px",
                              fontSize: "11px",
                              fontWeight: 500,
                              color: "#A3A3A3",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                            }}
                          >
                            Amount Collected
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "28px",
                              fontWeight: 700,
                              color: "#171717",
                              fontVariantNumeric: "tabular-nums",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            RS{" "}
                            {pmt.amount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "9999px",
                            backgroundColor: s.bg,
                            color: s.color,
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: s.dot,
                              flexShrink: 0,
                            }}
                          />
                          {s.label}
                        </span>
                      </div>

                      {/* Payment breakdown */}
                      {(() => {
                        const money = (n: number) =>
                          n.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          });
                        const brandFee = pmt.installationCharge ?? 0;
                        const hasBrand = brandFee > 0;
                        const itemsSum = pmt.items.reduce(
                          (s, it) => s + it.total,
                          0,
                        );
                        const extra = parseFloat(
                          (pmt.amount - itemsSum - brandFee).toFixed(2),
                        );
                        const showExtra = extra > 0.005;
                        if (!hasBrand && pmt.items.length === 0 && !showExtra)
                          return null;
                        return (
                          <div
                            style={{
                              border: "1px solid #E5E5E5",
                              borderRadius: "12px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                padding: "12px 20px",
                                backgroundColor: "#FAFAFA",
                                borderBottom: "1px solid #E5E5E5",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  color: "#A3A3A3",
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                }}
                              >
                                Breakdown
                              </span>
                            </div>
                            {hasBrand && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "12px 20px",
                                  gap: "16px",
                                  borderBottom:
                                    pmt.items.length > 0 || showExtra
                                      ? "1px solid #F5F5F5"
                                      : "none",
                                  backgroundColor: "#fff",
                                }}
                              >
                                <span
                                  style={{ fontSize: "13px", color: "#171717" }}
                                >
                                  Brand installation
                                  {pmt.installedBrandName
                                    ? ` (${pmt.installedBrandName})`
                                    : ""}
                                </span>
                                <span
                                  style={{
                                    fontSize: "13px",
                                    color: "#171717",
                                    fontWeight: 500,
                                    flexShrink: 0,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  RS {money(brandFee)}
                                </span>
                              </div>
                            )}
                            {pmt.items.map((item, i) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "12px 20px",
                                  gap: "16px",
                                  borderBottom:
                                    i < pmt.items.length - 1 || showExtra
                                      ? "1px solid #F5F5F5"
                                      : "none",
                                  backgroundColor: "#fff",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <span
                                    style={{
                                      fontSize: "13px",
                                      color: "#171717",
                                    }}
                                  >
                                    {item.name}
                                  </span>
                                  {item.quantity !== 1 && (
                                    <span
                                      style={{
                                        fontSize: "12px",
                                        color: "#737373",
                                        marginLeft: "6px",
                                      }}
                                    >
                                      × {item.quantity}
                                    </span>
                                  )}
                                </div>
                                <span
                                  style={{
                                    fontSize: "13px",
                                    color: "#171717",
                                    fontWeight: 500,
                                    flexShrink: 0,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  RS {money(item.total)}
                                </span>
                              </div>
                            ))}
                            {showExtra && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "12px 20px",
                                  backgroundColor: "#fff",
                                }}
                              >
                                <span
                                  style={{ fontSize: "13px", color: "#737373" }}
                                >
                                  Additional charges
                                </span>
                                <span
                                  style={{
                                    fontSize: "13px",
                                    color: "#171717",
                                    fontWeight: 500,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  RS {money(extra)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Detail rows */}
                      <div
                        style={{
                          border: "1px solid #E5E5E5",
                          borderRadius: "12px",
                          overflow: "hidden",
                        }}
                      >
                        {[
                          {
                            label: "Payment Method",
                            value: pmt.paymentMethodName ?? "—",
                          },
                          {
                            label: "Recorded By",
                            value: pmt.recordedByName ?? "—",
                          },
                          { label: "Date & Time", value: recordedDate },
                          { label: "Payment ID", value: pmt.id },
                        ].map(({ label, value }, i, arr) => (
                          <div
                            key={label}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "14px 20px",
                              gap: "16px",
                              borderBottom:
                                i < arr.length - 1
                                  ? "1px solid #F5F5F5"
                                  : "none",
                              backgroundColor: "#fff",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                color: "#737373",
                                flexShrink: 0,
                              }}
                            >
                              {label}
                            </span>
                            <span
                              style={{
                                fontSize: "13px",
                                color: "#171717",
                                fontWeight: 500,
                                textAlign: "right",
                                wordBreak: "break-all",
                              }}
                            >
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          ) : null}

          {/* Review tab */}
          {activeTab === "review" ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>
                Customer review coming soon.
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Right sidebar ───────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            position: isMobile ? "static" : "sticky",
            top: "24px",
          }}
        >
          {/* ── Technician sidebar ── */}
          {isTechnician
            ? (() => {
                const TECH_ACTIONS: Record<
                  string,
                  { label: string; next: string }
                > = {
                  assigned: {
                    label: "Acknowledge Job →",
                    next: "acknowledged",
                  },
                  acknowledged: {
                    label: "I'm On My Way →",
                    next: "in_transit",
                  },
                  in_transit: { label: "Start Job →", next: "in_process" },
                  in_process: {
                    label:
                      detail.type === "installation"
                        ? "Complete Installation →"
                        : "Resolve Job →",
                    next:
                      detail.type === "installation" ? "completed" : "resolved",
                  },
                };
                const action = TECH_ACTIONS[detail.status];
                const isTerminal = TERMINAL_OR_CLOSED.has(detail.status);

                return (
                  <>
                    <div>
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "#A3A3A3",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Current Status
                      </p>
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
                          cursor: transitionMutation.isPending
                            ? "not-allowed"
                            : "pointer",
                          opacity: transitionMutation.isPending ? 0.6 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                        {transitionMutation.isPending
                          ? "Updating…"
                          : action.label}
                      </button>
                    )}

                    {isTerminal && (
                      <div
                        style={{
                          padding: "12px 14px",
                          backgroundColor: "#F0FDF4",
                          borderRadius: "10px",
                          border: "1px solid #A7F3D0",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <CheckCircle2 size={15} strokeWidth={1.5} color="#059669" />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 500, color: "#065F46" }}>Job completed</div>
                          <div style={{ fontSize: "11px", color: "#737373", marginTop: "1px" }}>No further actions required</div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            : null}

          {/* ── Owner / staff sidebar ── */}
          {!isTechnician && isOwner ? (
            <button
              type="button"
              onClick={() => {
                setIsQuickComplete(true);
                setCollectPaymentOpen(true);
              }}
              disabled={!canQuickComplete}
              onMouseEnter={(e) => {
                if (canQuickComplete) e.currentTarget.style.opacity = "0.88";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = canQuickComplete ? "1" : "0.4";
              }}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "10px",
                backgroundColor: "rgb(5, 150, 105)",
                color: "#fff",
                padding: "13px 16px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: canQuickComplete ? "pointer" : "not-allowed",
                opacity: canQuickComplete ? 1 : 0.4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "opacity 120ms",
              }}
            >
              <CheckCircle2 size={15} strokeWidth={2} /> Complete Job
            </button>
          ) : null}
          {!isTechnician &&
            !isOwner &&
            (canAdvanceStatus ? (
              <>
                {advanceStatusOpen && nextStatuses.length > 1 ? (
                  <div
                    style={{
                      border: "1px solid #E5E5E5",
                      borderRadius: "10px",
                      padding: "12px",
                      backgroundColor: "#fff",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: "12px",
                        color: "#737373",
                      }}
                    >
                      Select next status
                    </p>
                    <select
                      value={toStatus}
                      onChange={(e) => setToStatus(e.target.value)}
                      style={{
                        width: "100%",
                        border: "1px solid #E5E5E5",
                        borderRadius: "8px",
                        padding: "8px",
                        fontSize: "13px",
                        marginBottom: "8px",
                      }}
                    >
                      <option value="">Choose...</option>
                      {nextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          transitionMutation.mutate(undefined);
                          setAdvanceStatusOpen(false);
                        }}
                        disabled={!toStatus || transitionMutation.isPending}
                        style={{
                          flex: 1,
                          border: "none",
                          borderRadius: "8px",
                          backgroundColor: "#0A0A0A",
                          color: "#fff",
                          padding: "9px",
                          fontSize: "13px",
                          cursor: "pointer",
                          opacity:
                            !toStatus || transitionMutation.isPending ? 0.5 : 1,
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdvanceStatusOpen(false)}
                        style={{
                          flex: 1,
                          border: "1px solid #E5E5E5",
                          borderRadius: "8px",
                          backgroundColor: "#fff",
                          color: "#525252",
                          padding: "9px",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAdvanceStatus}
                    disabled={
                      nextStatuses.length === 0 || transitionMutation.isPending
                    }
                    onMouseEnter={(e) => {
                      if (nextStatuses.length > 0) e.currentTarget.style.opacity = "0.88";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = nextStatuses.length === 0 ? "0.4" : "1";
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: "10px",
                      // Green is reserved for the step that actually finishes the job.
                      backgroundColor: primaryActionCompletes
                        ? "rgb(5, 150, 105)"
                        : "#0A0A0A",
                      color: "#fff",
                      padding: "13px 16px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor:
                        nextStatuses.length === 0 ? "not-allowed" : "pointer",
                      opacity: nextStatuses.length === 0 ? 0.4 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "opacity 120ms",
                    }}
                  >
                    {transitionMutation.isPending ? (
                      "Updating..."
                    ) : (
                      <>
                        {primaryActionCompletes ? (
                          <CheckCircle2 size={15} strokeWidth={2} />
                        ) : null}
                        {primaryActionLabel}
                      </>
                    )}
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
                Assign a technician and set a scheduled date to advance this
                installation job.
              </div>
            ))}

          {/* Actions dropdown — owner/staff only */}
          {!isTechnician && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setActionsOpen((v) => !v)}
                style={{
                  width: "100%",
                  border: "1px solid #E5E5E5",
                  borderRadius: "10px",
                  backgroundColor: "#fff",
                  color: "#525252",
                  padding: "9px 14px",
                  fontSize: "13px",
                  fontWeight: 400,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                Actions{" "}
                {actionsOpen ? (
                  <ChevronUp size={14} strokeWidth={1.5} />
                ) : (
                  <ChevronDown size={14} strokeWidth={1.5} />
                )}
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
                    borderRadius: "12px",
                    overflow: "hidden",
                    zIndex: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                >
                  {canRollbackOneStep ? (
                    <button
                      type="button"
                      onClick={() => {
                        rollbackMutation.mutate({ reason: "Office rollback" });
                        setActionsOpen(false);
                      }}
                      disabled={rollbackMutation.isPending}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid #F5F5F5",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "#404040",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "#A3A3A3", lineHeight: 0 }}>
                        <RotateCcw size={13} strokeWidth={1.5} />
                      </span>
                      Roll back status
                    </button>
                  ) : null}
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideOpen(true);
                        setActionsOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid #F5F5F5",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "#404040",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "#A3A3A3", lineHeight: 0 }}>
                        <ShieldAlert size={13} strokeWidth={1.5} />
                      </span>
                      Override status
                    </button>
                  ) : null}
                  {isOwner || isOfficeStaff ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReassignOpen(true);
                        setActionsOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid #F5F5F5",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "#404040",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "#A3A3A3", lineHeight: 0 }}>
                        <UserRound size={13} strokeWidth={1.5} />
                      </span>
                      Reassign technician
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("payment");
                      setActionsOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 14px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid #F5F5F5",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: "#404040",
                      textAlign: "left",
                    }}
                  >
                    Manage payment
                  </button>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideStatus("cancelled");
                        setOverrideOpen(true);
                        setActionsOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "#991B1B",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "#EF4444", lineHeight: 0 }}>
                        <X size={13} strokeWidth={1.5} />
                      </span>
                      Cancel job
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {/* Payment card — owner/staff only */}
          {!isTechnician && (
            <div
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "10px",
                padding: "14px",
                backgroundColor: "#fff",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#A3A3A3",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                }}
              >
                Payment
              </p>
              {!detail.payment ? (
                <p style={{ margin: 0, fontSize: "13px", color: "#737373" }}>
                  No payment recorded
                </p>
              ) : (
                <div style={{ display: "grid", gap: "4px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#171717",
                      fontWeight: 500,
                    }}
                  >
                    RS {detail.payment.amount.toFixed(2)}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#737373" }}>
                    {detail.payment.paymentMethodName ?? "—"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Undo banner */}
          {undoSecondsLeft > 0 && !isTechnician ? (
            <div
              style={{
                borderRadius: "8px",
                border: "1px solid #DCFCE7",
                backgroundColor: "#F0FDF4",
                padding: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "12px", color: "#166534" }}>
                  Undo available for {undoSecondsLeft}s
                </span>
                <button
                  type="button"
                  onClick={() =>
                    rollbackMutation.mutate({ reason: "Undo transition" })
                  }
                  disabled={rollbackMutation.isPending}
                  style={{
                    border: "1px solid #BBF7D0",
                    borderRadius: "6px",
                    backgroundColor: "#fff",
                    color: "#166534",
                    fontSize: "12px",
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Undo
                </button>
              </div>
              <div
                style={{
                  height: "4px",
                  borderRadius: "9999px",
                  backgroundColor: "#DCFCE7",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(undoSecondsLeft / Math.max(1, undoWindowSeconds)) * 100}%`,
                    backgroundColor: "#22C55E",
                    transition: "width 1s linear",
                  }}
                />
              </div>
            </div>
          ) : null}

          {transitionError ? (
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#991B1B",
                padding: "8px 10px",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                backgroundColor: "#FEF2F2",
              }}
            >
              {transitionError}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Collect Payment modal ──────────────────────────── */}
      {collectPaymentOpen &&
        (() => {
          const fmt = (n: number) =>
            Number.isInteger(n)
              ? n.toLocaleString("en-US")
              : n.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });

          const brands = brandsQuery.data ?? [];
          const serviceItems = serviceItemsQuery.data ?? [];
          const paymentMethods = (paymentMethodsQuery.data ?? []).filter(
            (m) => m.isActive,
          );
          const isInstallation = detail.type === "installation";
          const isPayFormLoading =
            serviceItemsQuery.isLoading ||
            paymentMethodsQuery.isLoading ||
            (isInstallation && brandsQuery.isLoading);

          const selectedServiceItems = serviceItems.filter((si) =>
            paySelectedItems.has(si.id),
          );
          const itemsTotal = selectedServiceItems.reduce((sum, si) => {
            const qty =
              si.pricingType === "variable"
                ? (payItemQuantities.get(si.id) ?? 1)
                : 1;
            return sum + si.unitPrice * qty;
          }, 0);
          const selectedBrand = isInstallation
            ? brands.find((b) => b.id === paySelectedBrandId)
            : undefined;
          const brandFee = selectedBrand?.installationCharge ?? 0;
          const additionalTotal = payAdditionalCharges.reduce(
            (sum, c) => sum + (parseFloat(c.amount) || 0),
            0,
          );
          const grandTotal = brandFee + itemsTotal + additionalTotal;
          const extrasCount = payAdditionalCharges.filter(
            (c) => (parseFloat(c.amount) || 0) > 0,
          ).length;
          const canConfirm = Boolean(paySelectedMethodId) && grandTotal > 0;
          const terminalStatus = isInstallation ? "completed" : "resolved";

          const summaryParts = [
            selectedBrand ? "Installation" : null,
            selectedServiceItems.length > 0
              ? `${selectedServiceItems.length} item${selectedServiceItems.length > 1 ? "s" : ""}`
              : null,
            extrasCount > 0 ? "extras" : null,
          ].filter(Boolean) as string[];
          const summaryText =
            grandTotal > 0 && summaryParts.length > 0
              ? summaryParts.join(" · ")
              : "Select items to calculate total";

          const submitPayment = () => {
            if (!canConfirm) return;
            const builtServiceItems = selectedServiceItems.map((si) => {
              const isVar = si.pricingType === "variable";
              const qty = isVar ? (payItemQuantities.get(si.id) ?? 1) : 1;
              const tot = parseFloat((si.unitPrice * qty).toFixed(2));
              return {
                serviceItemId: si.id,
                name: si.name,
                unitPrice: si.unitPrice,
                quantity: qty,
                total: tot,
              };
            });
            const builtAdditional = payAdditionalCharges
              .filter((c) => (parseFloat(c.amount) || 0) > 0)
              .map((c) => {
                const amt = parseFloat((parseFloat(c.amount) || 0).toFixed(2));
                return {
                  name: c.description.trim() || "Additional charge",
                  unitPrice: amt,
                  quantity: 1,
                  total: amt,
                };
              });
            const builtItems = [...builtServiceItems, ...builtAdditional];
            const paymentPayload = {
              paymentMethodId: paySelectedMethodId,
              paymentAmount: parseFloat(grandTotal.toFixed(2)),
              serviceItems: builtItems.length > 0 ? builtItems : undefined,
              installedBrandId: selectedBrand ? selectedBrand.id : undefined,
              installationCharge: selectedBrand
                ? parseFloat(brandFee.toFixed(2))
                : undefined,
              paymentStatus: payStatus,
            };
            if (isQuickComplete) {
              quickCompleteMutation.mutate(paymentPayload);
            } else {
              collectPaymentMutation.mutate({
                toStatus: terminalStatus,
                ...paymentPayload,
              });
            }
            closeCollectPayment();
          };

          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: isMobile ? "flex-end" : "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: isMobile ? "0" : "16px",
              }}
              onClick={closeCollectPayment}
            >
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: isMobile ? "16px 16px 0 0" : "16px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "480px",
                  maxHeight: isMobile ? "92vh" : "90vh",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: isMobile
                    ? "0 -4px 32px rgba(0,0,0,0.14)"
                    : "0 20px 60px rgba(0,0,0,0.18)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <style>{`@keyframes cd-spin { to { transform: rotate(360deg); } }`}</style>
                {isMobile && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      paddingTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "4px",
                        borderRadius: "9999px",
                        backgroundColor: "#E5E5E5",
                      }}
                    />
                  </div>
                )}
                {/* Modal header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderBottom: "1px solid #F5F5F5",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "#171717",
                      }}
                    >
                      Collect Payment
                    </h2>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "13px",
                        color: "#737373",
                      }}
                    >
                      {detail.customerName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeCollectPayment}
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "#737373",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Scrollable body */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  {isPayFormLoading ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        padding: "40px 0",
                        color: "#737373",
                      }}
                    >
                      <Loader2
                        size={22}
                        strokeWidth={1.5}
                        style={{ animation: "cd-spin 0.8s linear infinite" }}
                      />
                      <span style={{ fontSize: "13px" }}>
                        Loading payment options…
                      </span>
                    </div>
                  ) : (
                    <>
                  {/* Brand — installation only */}
                  {isInstallation && (
                    <div>
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "#A3A3A3",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Brand Installed
                      </p>
                      <select
                        value={paySelectedBrandId}
                        onChange={(e) => setPaySelectedBrandId(e.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #E5E5E5",
                          borderRadius: "10px",
                          padding: "12px",
                          fontSize: "14px",
                          color: "#171717",
                          backgroundColor: "#fff",
                          boxSizing: "border-box",
                          minHeight: "44px",
                        }}
                      >
                        <option value="">Select brand…</option>
                        {brands
                          .filter((b) => b.isActive)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} — RS {b.installationCharge}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Service items */}
                  <div>
                    <p
                      style={{
                        margin: "0 0 10px",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#A3A3A3",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Service Items Used
                    </p>
                    {serviceItems.length === 0 ? (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#A3A3A3",
                          margin: 0,
                        }}
                      >
                        No service items configured.
                      </p>
                    ) : (
                      <div
                        style={{
                          border: "1px solid #E5E5E5",
                          borderRadius: "10px",
                          overflow: "hidden",
                        }}
                      >
                        {serviceItems.map((si, idx) => {
                          const checked = paySelectedItems.has(si.id);
                          const isVariable = si.pricingType === "variable";
                          const qty = payItemQuantities.get(si.id) ?? 1;
                          const lineTotal =
                            si.unitPrice * (isVariable ? qty : 1);
                          const priceLabel = checked
                            ? `RS ${fmt(lineTotal)}`
                            : isVariable
                              ? `RS ${si.unitPrice}/${si.unitLabel ?? "unit"}`
                              : `RS ${si.unitPrice}`;
                          return (
                            <div
                              key={si.id}
                              style={{
                                backgroundColor: checked ? "#FAFAFA" : "#fff",
                                borderTop:
                                  idx === 0 ? "none" : "1px solid #F0F0F0",
                              }}
                            >
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  cursor: "pointer",
                                  padding: "12px",
                                  gap: "10px",
                                }}
                              >
                                <span
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    minWidth: 0,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const next = new Set(paySelectedItems);
                                      if (checked) next.delete(si.id);
                                      else next.add(si.id);
                                      setPaySelectedItems(next);
                                    }}
                                    style={{
                                      width: "18px",
                                      height: "18px",
                                      accentColor: "#0A0A0A",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: "14px",
                                      color: "#171717",
                                    }}
                                  >
                                    {si.name}
                                  </span>
                                </span>
                                <span
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: checked ? "#065F46" : "#A3A3A3",
                                    flexShrink: 0,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {priceLabel}
                                </span>
                              </label>
                              {isVariable && checked && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "0 12px 12px 40px",
                                  }}
                                >
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="0.5"
                                    value={qty}
                                    onChange={(e) => {
                                      const next = new Map(payItemQuantities);
                                      next.set(
                                        si.id,
                                        Math.max(
                                          0.1,
                                          parseFloat(e.target.value) || 1,
                                        ),
                                      );
                                      setPayItemQuantities(next);
                                    }}
                                    style={{
                                      width: "72px",
                                      border: "1px solid #E5E5E5",
                                      borderRadius: "6px",
                                      padding: "6px 8px",
                                      fontSize: "13px",
                                      outline: "none",
                                      textAlign: "center",
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: "#737373",
                                    }}
                                  >
                                    {si.unitLabel ?? "unit"}
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: "auto",
                                      fontSize: "12px",
                                      color: "#737373",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    × RS {si.unitPrice} ={" "}
                                    <span
                                      style={{
                                        color: "#065F46",
                                        fontWeight: 600,
                                      }}
                                    >
                                      RS {fmt(lineTotal)}
                                    </span>
                                  </span>
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
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#A3A3A3",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Additional Charges
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {payAdditionalCharges.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <input
                            type="text"
                            value={c.description}
                            placeholder="Description"
                            onChange={(e) =>
                              setPayAdditionalCharges((prev) =>
                                prev.map((row) =>
                                  row.id === c.id
                                    ? { ...row, description: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            style={{
                              flex: 1,
                              minWidth: 0,
                              border: "1px solid #E5E5E5",
                              borderRadius: "8px",
                              padding: "10px 12px",
                              fontSize: "14px",
                              color: "#171717",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                          <div
                            style={{
                              position: "relative",
                              width: "104px",
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                left: "10px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                fontSize: "12px",
                                color: "#A3A3A3",
                                pointerEvents: "none",
                              }}
                            >
                              RS
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={c.amount}
                              placeholder="0"
                              onChange={(e) =>
                                setPayAdditionalCharges((prev) =>
                                  prev.map((row) =>
                                    row.id === c.id
                                      ? { ...row, amount: e.target.value }
                                      : row,
                                  ),
                                )
                              }
                              style={{
                                width: "100%",
                                border: "1px solid #E5E5E5",
                                borderRadius: "8px",
                                padding: "10px 10px 10px 38px",
                                fontSize: "14px",
                                color: "#171717",
                                outline: "none",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPayAdditionalCharges((prev) =>
                                prev.filter((row) => row.id !== c.id),
                              )
                            }
                            aria-label="Remove charge"
                            style={{
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "38px",
                              height: "38px",
                              border: "none",
                              borderRadius: "8px",
                              backgroundColor: "#FFF5F5",
                              color: "#EF4444",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={15} strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setPayAdditionalCharges((prev) => [
                            ...prev,
                            {
                              id: crypto.randomUUID(),
                              description: "",
                              amount: "",
                            },
                          ])
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          alignSelf: "flex-start",
                          padding: "9px 14px",
                          border: "1px dashed #D4D4D4",
                          borderRadius: "8px",
                          backgroundColor: "#FAFAFA",
                          color: "#525252",
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={14} strokeWidth={1.5} /> Add charge
                      </button>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#A3A3A3",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Payment Method <span style={{ color: "#EF4444" }}>*</span>
                    </p>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                    >
                      {paymentMethods.map((m) => {
                        const sel = paySelectedMethodId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPaySelectedMethodId(m.id)}
                            style={{
                              padding: "9px 16px",
                              borderRadius: "8px",
                              fontSize: "13px",
                              fontWeight: 500,
                              cursor: "pointer",
                              minHeight: "44px",
                              border: sel
                                ? "1px solid #0A0A0A"
                                : "1px solid #E5E5E5",
                              backgroundColor: sel ? "#0A0A0A" : "#fff",
                              color: sel ? "#fff" : "#404040",
                            }}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                      {paymentMethods.length === 0 && (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#A3A3A3",
                            margin: 0,
                          }}
                        >
                          No payment methods configured.
                        </p>
                      )}
                    </div>
                    {/* Collected / Pending toggle */}
                    <div
                      style={{
                        display: "inline-flex",
                        marginTop: "12px",
                        backgroundColor: "#EBEBEB",
                        borderRadius: "9999px",
                        padding: "3px",
                      }}
                    >
                      {(["collected", "pending"] as const).map((st) => {
                        const active = payStatus === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setPayStatus(st)}
                            style={{
                              padding: "7px 18px",
                              borderRadius: "9999px",
                              fontSize: "13px",
                              fontWeight: 500,
                              border: "none",
                              cursor: "pointer",
                              backgroundColor: active ? "#fff" : "transparent",
                              color: active ? "#171717" : "#737373",
                              boxShadow: active
                                ? "0 1px 2px rgba(0,0,0,0.12)"
                                : "none",
                            }}
                          >
                            {st === "collected" ? "Collected" : "Pending"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: "12px 20px 16px",
                    borderTop: "1px solid #E5E5E5",
                    backgroundColor: "#FAFAFA",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                      gap: "12px",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#737373" }}>
                      {summaryText}
                    </span>
                    <span
                      style={{
                        fontSize: "20px",
                        fontWeight: 700,
                        color: grandTotal > 0 ? "#065F46" : "#A3A3A3",
                        whiteSpace: "nowrap",
                      }}
                    >
                      RS {grandTotal > 0 ? fmt(grandTotal) : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={closeCollectPayment}
                      style={{
                        border: "1px solid #E5E5E5",
                        borderRadius: "10px",
                        backgroundColor: "#fff",
                        color: "#404040",
                        padding: "12px 18px",
                        fontSize: "14px",
                        fontWeight: 500,
                        cursor: "pointer",
                        minHeight: "44px",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        !canConfirm ||
                        isPayFormLoading ||
                        collectPaymentMutation.isPending ||
                        quickCompleteMutation.isPending
                      }
                      onClick={submitPayment}
                      style={{
                        flex: 1,
                        border: "none",
                        borderRadius: "10px",
                        backgroundColor:
                          canConfirm && !isPayFormLoading
                            ? "rgb(5, 150, 105)"
                            : "#E5E5E5",
                        color: canConfirm && !isPayFormLoading ? "#fff" : "#A3A3A3",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        minHeight: "44px",
                        cursor:
                          canConfirm && !isPayFormLoading
                            ? "pointer"
                            : "not-allowed",
                      }}
                    >
                      {collectPaymentMutation.isPending ||
                      quickCompleteMutation.isPending
                        ? "Processing…"
                        : canConfirm
                          ? "Confirm & Complete"
                          : "Select method to confirm"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── Reassign modal ─────────────────────────────────── */}
      <Modal
        isOpen={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign technician"
      >
        <div style={{ display: "grid", gap: "12px" }}>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              color: "#737373",
            }}
          >
            New technician
            <select
              value={reassignTechId}
              onChange={(e) => setReassignTechId(e.target.value)}
              style={{
                borderRadius: "8px",
                border: "1px solid #E5E5E5",
                padding: "8px 10px",
                fontSize: "13px",
                color: "#171717",
              }}
            >
              <option value="">Select technician</option>
              {(techniciansQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => reassignMutation.mutate()}
            disabled={!reassignTechId || reassignMutation.isPending}
            style={{
              border: "none",
              borderRadius: "8px",
              backgroundColor: "#0A0A0A",
              color: "#fff",
              padding: "10px 14px",
              fontSize: "13px",
              cursor: "pointer",
              opacity: !reassignTechId || reassignMutation.isPending ? 0.6 : 1,
            }}
          >
            {reassignMutation.isPending ? "Reassigning..." : "Confirm"}
          </button>
          {reassignError ? (
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#991B1B",
                padding: "8px 10px",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                backgroundColor: "#FEF2F2",
              }}
            >
              {reassignError}
            </p>
          ) : null}
        </div>
      </Modal>

      {/* ── Override modal (owner) ─────────────────────────── */}
      <Modal
        isOpen={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Override status"
        blocking={requiresPaymentDecision}
      >
        <div style={{ display: "grid", gap: "12px" }}>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              color: "#737373",
            }}
          >
            Target status
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
              style={{
                borderRadius: "8px",
                border: "1px solid #E5E5E5",
                padding: "8px 10px",
                fontSize: "13px",
                color: "#171717",
              }}
            >
              <option value="">Select status</option>
              {(detail.type === "complaint"
                ? COMPLAINT_STATUSES
                : INSTALLATION_STATUSES
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#404040",
            }}
          >
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
            <span
              style={{
                fontSize: "11px",
                color:
                  overrideReason.length >= OVERRIDE_REASON_MIN_CHARS
                    ? "#10B981"
                    : "#737373",
              }}
            >
              {overrideReason.length} / {OVERRIDE_REASON_MIN_CHARS} minimum
            </span>
          </label>
          {requiresPaymentDecision ? (
            <div
              style={{
                borderRadius: "8px",
                border: "1px solid #FDE68A",
                backgroundColor: "#FFFBEB",
                padding: "10px",
                fontSize: "12px",
                color: "#92400E",
                display: "grid",
                gap: "8px",
              }}
            >
              <div>
                This job has payment recorded. Choose how payment should be
                handled.
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <input
                    type="radio"
                    checked={paymentDecision === "retain"}
                    onChange={() => setPaymentDecision("retain")}
                  />{" "}
                  Retain payment
                </label>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <input
                    type="radio"
                    checked={paymentDecision === "void"}
                    onChange={() => setPaymentDecision("void")}
                  />{" "}
                  Void payment
                </label>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => ownerOverrideMutation.mutate()}
            disabled={
              !overrideStatus ||
              !overrideReason.trim() ||
              ownerOverrideMutation.isPending
            }
            style={{
              border: "none",
              borderRadius: "8px",
              backgroundColor: "#0A0A0A",
              color: "#fff",
              padding: "10px 14px",
              fontSize: "13px",
              cursor: "pointer",
              opacity:
                !overrideStatus ||
                !overrideReason.trim() ||
                ownerOverrideMutation.isPending
                  ? 0.6
                  : 1,
            }}
          >
            {ownerOverrideMutation.isPending
              ? "Applying override..."
              : "Confirm override"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
