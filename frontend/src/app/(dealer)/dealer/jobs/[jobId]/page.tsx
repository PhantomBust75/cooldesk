"use client";

import { fetchDealerJobDetail, requestDealerJobCancellation } from "@/lib/api/dealer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, MapPin, Phone, Info, XCircle } from "lucide-react";
import { useSnackbar } from "notistack";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  new:                  { label: "New",                  color: "#D97706", bg: "#FEF3C7" },
  pending_schedule:     { label: "Pending Schedule",     color: "#D97706", bg: "#FEF3C7" },
  scheduled:            { label: "Scheduled",            color: "#1D4ED8", bg: "#DBEAFE" },
  in_progress:          { label: "In Progress",          color: "#7C3AED", bg: "#EDE9FE" },
  needs_revisit:        { label: "Needs Revisit",        color: "#B45309", bg: "#FDE68A" },
  cancellation_pending: { label: "Cancellation Pending", color: "#B91C1C", bg: "#FEE2E2" },
  resolved:             { label: "Resolved",             color: "#065F46", bg: "#D1FAE5" },
  cancelled:            { label: "Cancelled",            color: "#6B7280", bg: "#F3F4F6" },
};

type Tab = "details" | "timeline" | "payment";

function shortId(id: string): string {
  return "DL-" + id.slice(0, 6).toUpperCase();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatScheduled(iso: string | null): string {
  if (!iso) return "Pending scheduling";
  return formatDateTime(iso);
}

export default function DealerJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [showMore, setShowMore] = useState(false);

  const { data: job, isPending, isError } = useQuery({
    queryKey: ["dealer", "job", jobId],
    queryFn: () => fetchDealerJobDetail(jobId),
    enabled: !!jobId,
  });

  const cancelMutation = useMutation({
    mutationFn: () => requestDealerJobCancellation(jobId),
    onSuccess: () => {
      enqueueSnackbar("Cancellation request submitted.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dealer", "job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["dealer", "jobs"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to request cancellation.", { variant: "error" });
    },
  });

  if (isPending) {
    return (
      <div style={{ padding: "32px", fontSize: "13px", color: "#737373" }}>Loading…</div>
    );
  }

  if (isError || !job) {
    return (
      <div style={{ padding: "32px", fontSize: "13px", color: "#EF4444" }}>Job not found.</div>
    );
  }

  const status = STATUS_MAP[job.status] ?? { label: job.status, color: "#525252", bg: "#F5F5F5" };
  const canCancel = !["cancelled", "cancellation_pending", "resolved"].includes(job.status);

  const TABS: { key: Tab; label: string }[] = [
    { key: "details",  label: "Details" },
    { key: "timeline", label: "Timeline" },
    { key: "payment",  label: "Payment" },
  ];

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh" }}>
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => router.push("/dealer/jobs")}
        style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", padding: 0, marginBottom: "20px" }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Active Jobs
        <span style={{ color: "#D4D4D4" }}>/</span>
        <span style={{ color: "#0A0A0A" }}>{shortId(job.id)}</span>
      </button>

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em" }}>
          {shortId(job.id)}
        </h1>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(job.id); enqueueSnackbar("ID copied", { variant: "success" }); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#A3A3A3", padding: "4px", display: "inline-flex" }}
          title="Copy job ID"
        >
          <Copy size={15} strokeWidth={1.5} />
        </button>
        <span style={{ fontSize: "13px", fontWeight: 500, color: status.color, backgroundColor: status.bg, borderRadius: "8px", padding: "4px 10px" }}>
          {status.label}
        </span>
      </div>

      {/* Subtitle: brand + type */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", fontSize: "14px", color: "#525252" }}>
        {job.brand_color && (
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: job.brand_color, display: "inline-block" }} />
        )}
        <span>{job.brand_name ?? "Unknown brand"}</span>
        <span style={{ color: "#D4D4D4" }}>·</span>
        <span style={{ textTransform: "capitalize" }}>{job.type}</span>
      </div>

      {/* Main layout: content + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", alignItems: "start" }}>
        {/* Left: tabs + content */}
        <div>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #E5E5E5", marginBottom: "24px" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === t.key ? "2px solid #0A0A0A" : "2px solid transparent",
                  color: activeTab === t.key ? "#0A0A0A" : "#737373",
                  fontSize: "14px",
                  fontWeight: activeTab === t.key ? 500 : 400,
                  cursor: "pointer",
                  marginBottom: "-1px",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Details tab */}
          {activeTab === "details" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
              {/* Customer section */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
                  Customer
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <Row label="Name" value={job.customer_name} />
                  <div>
                    <span style={{ fontSize: "13px", color: "#737373", display: "block", marginBottom: "4px" }}>Phone</span>
                    <a
                      href={`tel:${job.phone}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "6px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717", textDecoration: "none", backgroundColor: "#fff" }}
                    >
                      <Phone size={13} strokeWidth={1.5} color="#737373" />
                      {job.phone}
                    </a>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", color: "#737373", display: "block", marginBottom: "4px" }}>Address</span>
                    <p style={{ fontSize: "14px", color: "#171717", margin: "0 0 8px" }}>{job.address}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", color: "#171717", textDecoration: "none", backgroundColor: "#fff" }}
                    >
                      <MapPin size={13} strokeWidth={1.5} color="#737373" />
                      Open in Google Maps
                    </a>
                  </div>
                </div>
              </div>

              {/* Job details section */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
                  Job Details
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "#737373", display: "block", marginBottom: "4px" }}>Brand</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#171717" }}>
                      {job.brand_color && <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: job.brand_color, display: "inline-block" }} />}
                      {job.brand_name ?? "—"}
                    </span>
                  </div>
                  {job.installation_notes && (
                    <Row label="Unit" value={job.installation_notes} />
                  )}
                  {job.issue_description && (
                    <Row label="Issue" value={job.issue_description} />
                  )}
                </div>
              </div>

              {/* Show more */}
              {!showMore && (
                <div style={{ gridColumn: "1/-1" }}>
                  <button
                    type="button"
                    onClick={() => setShowMore(true)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}
                  >
                    ∨ Show more details
                  </button>
                </div>
              )}
              {showMore && (
                <div style={{ gridColumn: "1/-1", borderTop: "1px solid #F5F5F5", paddingTop: "16px" }}>
                  <Row label="Job ID" value={job.id} mono />
                  <div style={{ marginTop: "12px" }}>
                    <Row label="Created" value={formatDateTime(job.created_at)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMore(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px", padding: 0, marginTop: "12px" }}
                  >
                    ∧ Show less
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              <TimelineEvent
                index={1}
                title="Job Submitted"
                subtitle={`${formatDateTime(job.created_at)} · via dealer`}
              />
            </div>
          )}

          {/* Payment tab */}
          {activeTab === "payment" && (
            <p style={{ fontSize: "14px", color: "#737373", margin: 0 }}>
              No payment recorded yet. Payment is processed by the technician upon job completion.
            </p>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Status card */}
          <div style={{ border: "1px solid #E5E5E5", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
              Current Status
            </div>
            <span style={{ fontSize: "13px", fontWeight: 500, color: status.color, backgroundColor: status.bg, borderRadius: "8px", padding: "4px 10px" }}>
              {status.label}
            </span>
          </div>

          {/* Scheduling card */}
          <div style={{ border: "1px solid #E5E5E5", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                Scheduled
              </div>
              <div style={{ fontSize: "13px", color: job.scheduled_at ? "#171717" : "#A3A3A3", fontStyle: job.scheduled_at ? "normal" : "italic" }}>
                {formatScheduled(job.scheduled_at)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                Technician
              </div>
              <div style={{ fontSize: "13px", color: job.technician_name ? "#171717" : "#A3A3A3", fontStyle: job.technician_name ? "normal" : "italic" }}>
                {job.technician_name ?? "Not yet assigned"}
              </div>
            </div>
          </div>

          {/* Info note */}
          <div style={{ border: "1px solid #E5E5E5", borderRadius: "12px", padding: "14px 16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <Info size={14} strokeWidth={1.5} color="#A3A3A3" style={{ flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontSize: "13px", color: "#737373", margin: 0, lineHeight: 1.5 }}>
              Scheduling and technician assignment is managed by the CoolDesk office team.
            </p>
          </div>

          {/* Cancel job button */}
          {canCancel && (
            <button
              type="button"
              onClick={() => {
                if (cancelMutation.isPending) return;
                cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                width: "100%",
                padding: "12px",
                border: "1px solid #FCA5A5",
                borderRadius: "12px",
                backgroundColor: "#fff",
                color: "#EF4444",
                fontSize: "14px",
                fontWeight: 500,
                cursor: cancelMutation.isPending ? "not-allowed" : "pointer",
                opacity: cancelMutation.isPending ? 0.6 : 1,
              }}
            >
              <XCircle size={15} strokeWidth={1.5} />
              {cancelMutation.isPending ? "Submitting…" : "Cancel job"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: "13px", color: "#737373", display: "block", marginBottom: "2px" }}>{label}</span>
      <span style={{ fontSize: "14px", color: "#171717", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

function TimelineEvent({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", paddingBottom: "20px" }}>
      <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#0A0A0A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>
        {index}
      </div>
      <div style={{ paddingTop: "4px" }}>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{title}</div>
        <div style={{ fontSize: "12px", color: "#737373", marginTop: "2px" }}>{subtitle}</div>
      </div>
    </div>
  );
}
