import { ArrowRight, Building2 } from "lucide-react";

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
        padding: "3px 10px",
        borderRadius: "9999px",
        border: `1px solid ${isInstall ? "#BBF7D0" : "#FED7AA"}`,
        backgroundColor: isInstall ? "#F0FDF4" : "#FFF7ED",
        fontSize: "13px",
        fontWeight: 500,
        color: isInstall ? "#16A34A" : "#EA580C",
        whiteSpace: "nowrap",
      }}
    >
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

const BRAND_COLORS = [
  "#2563EB", "#7C3AED", "#DB2777", "#DC2626",
  "#D97706", "#059669", "#0891B2", "#4F46E5",
];

function brandColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return BRAND_COLORS[Math.abs(hash) % BRAND_COLORS.length];
}

export function BrandSwatch({
  name,
  colorHex,
}: {
  name: string;
  colorHex?: string | null;
}) {
  const dot = colorHex ?? brandColor(name);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px", color: "#171717" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: dot, flexShrink: 0 }} />
      {name}
    </span>
  );
}
