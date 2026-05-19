import { Clock } from "lucide-react";
import { useState } from "react";

const SLA = {
  installation: { amber: 2, red: 4 },
  complaint: { amber: 1, red: 2 },
};

type SlaLevel = "ok" | "amber" | "red";

interface SlaInfo {
  level: SlaLevel;
  textColor: string;
  barColor: string;
  trackColor: string;
  fillPct: number;
  tooltip: string;
}

function getSlaInfo(days: number, type: "installation" | "complaint"): SlaInfo {
  const { amber, red } = SLA[type];
  const label = type === "installation" ? "installation" : "complaint";
  const fillPct = Math.min(100, (days / red) * 100);

  if (days >= red) {
    return {
      level: "red",
      textColor: "#991B1B",
      barColor: "#EF4444",
      trackColor: "#FEE2E2",
      fillPct,
      tooltip: `Critical: Exceeds ${red}-day ${label} SLA — immediate scheduling required`,
    };
  }

  if (days >= amber) {
    return {
      level: "amber",
      textColor: "#92400E",
      barColor: "#F59E0B",
      trackColor: "#FEF3C7",
      fillPct,
      tooltip: `Warning: Approaching ${red}-day ${label} SLA — ${red - days} day${red - days === 1 ? "" : "s"} remaining`,
    };
  }

  return {
    level: "ok",
    textColor: "#525252",
    barColor: "#D1D5DB",
    trackColor: "#F5F5F5",
    fillPct,
    tooltip: `On track — ${amber - days} day${amber - days === 1 ? "" : "s"} before ${label} amber threshold (${amber}d amber / ${red}d critical)`,
  };
}

export function SlaCell({ days, type }: { days: number; type: "installation" | "complaint" }) {
  const [hovered, setHovered] = useState(false);
  const sla = getSlaInfo(days, type);

  return (
    <div
      style={{ position: "relative", display: "inline-block", minWidth: "72px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        @keyframes sla-tooltip-in {
          from { opacity: 0; transform: translateX(-50%) translateY(3px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            backgroundColor: "#0A0A0A",
            color: "#FFFFFF",
            fontSize: "11px",
            lineHeight: "1.4",
            padding: "6px 10px",
            borderRadius: "6px",
            pointerEvents: "none",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            animation: "sla-tooltip-in 120ms ease-out",
          }}
        >
          {sla.tooltip}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #0A0A0A",
            }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          marginBottom: "5px",
          cursor: "default",
        }}
      >
        <Clock size={11} strokeWidth={1.5} style={{ color: sla.textColor, flexShrink: 0 }} />
        <span
          style={{
            fontSize: "13px",
            fontWeight: sla.level === "ok" ? 400 : 600,
            color: sla.textColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {days}d
        </span>
      </div>

      <div
        style={{
          width: "72px",
          height: "3px",
          backgroundColor: sla.trackColor,
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${sla.fillPct}%`,
            height: "100%",
            backgroundColor: sla.barColor,
            borderRadius: "2px",
            transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}
