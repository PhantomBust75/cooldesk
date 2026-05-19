type KpiCardProps = {
  title: string;
  value: string;
  accent: string;
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function Sparkline({ color }: { color: string }) {
  const points = [36, 28, 31, 22, 18, 20, 14];
  const width = 92;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, points.length - 1);

  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `M 0 ${height} L ${points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point - min) / range) * height;
      return `${x} ${y}`;
    })
    .join(" L ")} L ${width} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} fill={hexToRgba(color, 0.10)} />
      <polyline points={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function KpiCard({ title, value, accent }: KpiCardProps) {
  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ height: "3px", backgroundColor: accent }} />
      <div style={{ padding: "18px 18px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#737373", fontWeight: 500, marginBottom: "6px" }}>{title}</div>
            <div style={{ fontSize: "28px", fontWeight: 600, color: "#0A0A0A", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
          <Sparkline color={accent} />
        </div>
      </div>
    </div>
  );
}