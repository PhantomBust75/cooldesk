import { AlertTriangle, BriefcaseBusiness, Calendar, CircleAlert, Users } from 'lucide-react';
import type { ComponentType } from 'react';

type KpiCardProps = {
  title: string;
  value: string;
  accent: string;
  hasFill?: boolean;
  trend?: number[];
  change?: string;
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

function Sparkline({ color, points, hasFill }: { color: string; points: number[]; hasFill: boolean }) {
  const data = points.length > 1 ? points : [0, 0, 0, 0, 0, 0, 0];
  const width = 240;
  const height = 52;
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
      <path d={areaPath} fill={hasFill ? hexToRgba(color, 0.12) : 'none'} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const CARD_META: Record<string, { delta: string; deltaTone: string; icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }> = {
  'Total active jobs': { delta: '↑ 4%', deltaTone: '#525252', icon: BriefcaseBusiness },
  'Pending schedule': { delta: '↑ 9%', deltaTone: '#4F78A8', icon: Calendar },
  'Amber alerts': { delta: '↑ 14%', deltaTone: '#C2410C', icon: AlertTriangle },
  'Chronic jobs': { delta: '↑ 8%', deltaTone: '#9F1239', icon: CircleAlert },
  'No-shows today': { delta: '↓ 5%', deltaTone: '#525252', icon: Users },
};

export function KpiCard({ title, value, accent, hasFill = false, trend }: KpiCardProps) {
  const sparklinePoints = trend && trend.length > 0 ? trend : [36, 28, 31, 22, 18, 20, 14];
  const meta = CARD_META[title] ?? { delta: '', deltaTone: '#525252', icon: BriefcaseBusiness };
  const Icon = meta.icon;
  return (
    <div
      style={{
        position: 'relative',
        height: '154px',
        backgroundColor: '#fff',
        border: '1px solid #E5E5E5',
        borderTop: `3px solid ${accent}`,
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 12px 22px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1, padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <Icon size={12} strokeWidth={1.6} color="#B8B8B8" />
            <span
              style={{
                color: '#A3A3A3',
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                lineHeight: 1.2,
                whiteSpace: 'normal',
              }}
            >
              {title}
            </span>
          </div>
          {meta.delta ? (
            <span
              style={{
                borderRadius: '5px',
                backgroundColor: hexToRgba(accent, 0.1),
                color: meta.deltaTone,
                fontSize: '11px',
                fontWeight: 700,
                lineHeight: 1,
                padding: '4px 7px',
                whiteSpace: 'nowrap',
              }}
            >
              {meta.delta}
            </span>
          ) : null}
        </div>
        <div
          style={{
            marginTop: '13px',
            fontSize: '48px',
            fontWeight: 700,
            color: '#050505',
            lineHeight: 0.95,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '60px', opacity: 0.85 }}>
        <Sparkline color={accent} points={sparklinePoints} hasFill={hasFill} />
      </div>
    </div>
  );
}
