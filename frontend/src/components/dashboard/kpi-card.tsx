type KpiCardProps = {
  title: string;
  value: string;
  accent: string;
  trend?: number[];
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((p) => p + p).join('')
    : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Sparkline({ color, points }: { color: string; points: number[] }) {
  const data = points.length > 1 ? points : [0, 0, 0, 0, 0, 0, 0];
  const width = 92;
  const height = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, data.length - 1);

  const coords = data.map((p, i) => ({
    x: i * step,
    y: height - ((p - min) / range) * height,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `M 0 ${height} ${coords.map((c) => `L ${c.x} ${c.y}`).join(' ')} L ${width} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={areaPath} fill={hexToRgba(color, 0.1)} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function KpiCard({ title, value, accent, trend }: KpiCardProps) {
  const sparklinePoints = trend && trend.length > 0 ? trend : [36, 28, 31, 22, 18, 20, 14];
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ height: '3px', backgroundColor: accent }} />
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#737373', fontWeight: 500, marginBottom: '6px' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#0A0A0A', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
          <Sparkline color={accent} points={sparklinePoints} />
        </div>
      </div>
    </div>
  );
}
