type JobStatus =
  | "pending_schedule"
  | "scheduled"
  | "assigned"
  | "acknowledged"
  | "in_transit"
  | "in_process"
  | "completed"
  | "new"
  | "resolved"
  | "needs_revisit"
  | "revisit_scheduled"
  | "resolved_on_revisit"
  | "cancellation_requested"
  | "cancelled";

interface StatusChipConfig {
  label: string;
  bg: string;
  text: string;
  dot: string;
  border: string;
}

const STATUS_MAP: Record<JobStatus, StatusChipConfig> = {
  pending_schedule: {
    label: "Pending schedule",
    bg: "#F1F5F9",
    text: "#1E293B",
    dot: "#64748B",
    border: "#E2E8F0",
  },
  scheduled: {
    label: "Scheduled",
    bg: "#F1F5F9",
    text: "#1E293B",
    dot: "#1E293B",
    border: "#E2E8F0",
  },
  assigned: {
    label: "Assigned",
    bg: "#F1F5F9",
    text: "#1E293B",
    dot: "#1E293B",
    border: "#E2E8F0",
  },
  acknowledged: {
    label: "Acknowledged",
    bg: "#F0FDFA",
    text: "#134E4A",
    dot: "#134E4A",
    border: "#CCFBF1",
  },
  in_transit: {
    label: "In transit",
    bg: "#F1F5F9",
    text: "#1E293B",
    dot: "#1E293B",
    border: "#E2E8F0",
  },
  in_process: {
    label: "In progress",
    bg: "#FEFCE8",
    text: "#854D0E",
    dot: "#854D0E",
    border: "#FEF08A",
  },
  completed: {
    label: "Completed",
    bg: "#F0FDFA",
    text: "#134E4A",
    dot: "#134E4A",
    border: "#CCFBF1",
  },
  new: {
    label: "New",
    bg: "#F1F5F9",
    text: "#1E293B",
    dot: "#64748B",
    border: "#E2E8F0",
  },
  resolved: {
    label: "Resolved",
    bg: "#F0FDFA",
    text: "#134E4A",
    dot: "#134E4A",
    border: "#CCFBF1",
  },
  needs_revisit: {
    label: "Needs revisit",
    bg: "#FFF1F2",
    text: "#9F1239",
    dot: "#9F1239",
    border: "#FECDD3",
  },
  revisit_scheduled: {
    label: "Revisit scheduled",
    bg: "#F1F5F9",
    text: "#1E293B",
    dot: "#1E293B",
    border: "#E2E8F0",
  },
  resolved_on_revisit: {
    label: "Resolved on revisit",
    bg: "#F0FDFA",
    text: "#134E4A",
    dot: "#134E4A",
    border: "#CCFBF1",
  },
  cancellation_requested: {
    label: "Cancellation pending",
    bg: "#FFF1F2",
    text: "#9F1239",
    dot: "#9F1239",
    border: "#FECDD3",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#F5F5F5",
    text: "#525252",
    dot: "#A3A3A3",
    border: "#E5E5E5",
  },
};

interface Props {
  status: string;
  size?: "sm" | "md";
}

export function StatusChip({ status }: Props) {
  const cfg = STATUS_MAP[status as JobStatus];
  if (!cfg) return null;

  return (
    <span
      aria-label={`Job status: ${cfg.label}`}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}
