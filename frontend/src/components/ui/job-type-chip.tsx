import {
  ArrowRight,
  Building2,
  MessageCircleWarning,
  Wrench,
} from "lucide-react";

type JobType = "installation" | "complaint";
type JobSource = "direct" | "via_dealer";

interface TypeChipProps {
  type: JobType;
}

interface SourceChipProps {
  source: JobSource;
  dealerName?: string;
}

export function JobTypeChip({ type }: TypeChipProps) {
  const isInstall = type === "installation";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "13px",
        color: "#404040",
      }}
    >
      {isInstall ? (
        <Wrench size={14} color="#525252" strokeWidth={1.5} />
      ) : (
        <MessageCircleWarning size={14} color="#525252" strokeWidth={1.5} />
      )}
      {isInstall ? "Installation" : "Complaint"}
    </span>
  );
}

export function SourceChip({ source, dealerName }: SourceChipProps) {
  const isDirect = source === "direct";
  const label = isDirect ? "Direct" : dealerName || "Via Dealer";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "13px",
        color: "#525252",
        maxWidth: "140px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={!isDirect ? label : undefined}
    >
      {isDirect ? (
        <ArrowRight
          size={14}
          color="#737373"
          strokeWidth={1.5}
          style={{ flexShrink: 0 }}
        />
      ) : (
        <Building2
          size={14}
          color="#737373"
          strokeWidth={1.5}
          style={{ flexShrink: 0 }}
        />
      )}
      {label}
    </span>
  );
}

export function TagChip({
  label,
  variant,
}: {
  label: string;
  variant?: "chronic" | "frequent" | "repeat" | "gray";
}) {
  const themes = {
    chronic: { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
    frequent: { bg: "#FEFCE8", text: "#854D0E", border: "#FEF08A" },
    repeat: { bg: "#F1F5F9", text: "#1E293B", border: "#E2E8F0" },
    gray: { bg: "#F5F5F5", text: "#525252", border: "#E5E5E5" },
  };

  const theme = themes[variant || "gray"];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "9999px",
        backgroundColor: theme.bg,
        color: theme.text,
        border: `1px solid ${theme.border}`,
        fontSize: "12px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function BrandSwatch({
  name,
}: {
  name: string;
  colorHex?: string | null;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "13px",
        color: "#64748B",
      }}
    >
      {name}
    </span>
  );
}
