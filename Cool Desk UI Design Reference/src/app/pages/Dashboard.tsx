import { useState } from 'react';
import { Link } from 'react-router';
import {
  TrendingUp, TrendingDown,
  ExternalLink,
  AlertCircle, Briefcase, Calendar, AlertOctagon, AlertTriangle,
  UserX, ChevronRight,
} from 'lucide-react';
import { mockJobs, mockKPI, type Job } from '../data/mockData';
import { StatusChip } from '../components/ui/StatusChip';
import { BrandSwatch, TagChip } from '../components/ui/JobTypeChip';

/* ── hex → rgba helper ───────────────────────────────────────── */
function hexRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── Sparkline — full-width area chart, anchored to card bottom ── */
function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  const W = 200, H = 56;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const topPad = 10;

  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: topPad + (1 - (v - min) / range) * (H - topPad),
  }));

  const linePath = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`;
  const gradId = `sg-${id}`;

  return (
    <svg
      width="100%" height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          {/* 10% opacity fill fading to transparent */}
          <stop offset="0%" stopColor={color} stopOpacity="0.10" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        strokeOpacity="0.45" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ── KPI Card ────────────────────────────────────────────────── */
function KPICard({
  label, value, icon, accentColor, sparkData, sparkId, trend, trendVal, onClick,
}: {
  label: string; value: string | number;
  icon?: React.ReactNode;
  accentColor: string;
  sparkData: number[];
  sparkId: string;
  trend?: 'up' | 'down'; trendVal?: number;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: '12px', overflow: 'hidden',
        flex: 1, minWidth: '160px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 240ms ease, transform 240ms ease',
        /* Large-blur soft shadow — no border ring */
        boxShadow: hovered && onClick
          ? '0 4px 12px rgba(0,0,0,0.08), 0 20px 56px rgba(0,0,0,0.11)'
          : '0 2px 6px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08)',
        transform: hovered && onClick ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Semantic top-bar accent — 3 px, full-bleed, unified color */}
      <div style={{ height: '3px', backgroundColor: accentColor }} />

      {/* Card body — paddingBottom reserves space for absolute sparkline */}
      <div style={{ padding: '14px 18px 0', paddingBottom: '64px', backgroundColor: '#FFFFFF' }}>

        {/* Row 1: icon + eyebrow | delta badge */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ color: accentColor, lineHeight: 0, opacity: 0.65 }}>{icon}</div>
            <span style={{
              fontSize: '10px', fontWeight: 400, color: '#A8A8A8',
              letterSpacing: '0.10em',
            }}>{label}</span>
          </div>

          {/* Delta badge — unified accent color throughout */}
          {trend && trendVal !== undefined && (
            <span style={{
              fontSize: '10px', fontWeight: 600,
              color: accentColor,
              backgroundColor: hexRgba(accentColor, 0.10),
              borderRadius: '5px', padding: '2px 7px',
              letterSpacing: '0.02em', whiteSpace: 'nowrap',
            }}>
              {trend === 'up' ? '↑' : '↓'} {trendVal}%
            </span>
          )}
        </div>

        {/* Primary value — Bold 700, prominent */}
        <div style={{
          fontSize: '40px', fontWeight: 700, color: '#0A0A0A',
          lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.03em',
        }}>
          {value}
        </div>
      </div>

      {/* Sparkline — absolutely anchored to card bottom, full-width, unified color */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#FFFFFF',
      }}>
        <Sparkline data={sparkData} color={accentColor} id={sparkId} />
      </div>
    </div>
  );
}

/* ── Amber Alert Panel ───────────────────────────────────────── */
function AmberAlertPanel({ jobs }: { jobs: Job[] }) {
  const [sortBy, setSortBy] = useState<'default' | 'newest' | 'technician' | 'brand'>('default');

  const sorted = [...jobs].sort((a, b) => {
    if (sortBy === 'default') {
      if (a.is_chronic && !b.is_chronic) return -1;
      if (!a.is_chronic && b.is_chronic) return 1;
      return (a.revisit_sequence || 0) > (b.revisit_sequence || 0) ? -1 : 1;
    }
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'technician') return (a.technician_name || '').localeCompare(b.technician_name || '');
    if (sortBy === 'brand') return a.brand_name.localeCompare(b.brand_name);
    return 0;
  });

  if (jobs.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '12px',
      border: '1px solid #E5E5E5', overflow: 'hidden',
    }}>
      {/* Section heading — plain, no yellow fill */}
      <div style={{
        padding: '14px 20px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #E5E5E5',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Needs revisit</span>
          <span style={{
            backgroundColor: '#FFF1F2', color: '#9F1239',
            border: '1px solid #FECDD3',
            borderRadius: '9999px', fontSize: '11px', fontWeight: 500,
            padding: '1px 8px',
          }}>
            {jobs.length}
          </span>
        </div>
        {/* Ghost sort button */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{
            fontSize: '12px', padding: '5px 10px', borderRadius: '8px',
            border: '1px solid #E5E5E5', backgroundColor: '#fff',
            color: '#404040', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="default">Chronic first</option>
          <option value="newest">Newest first</option>
          <option value="technician">By technician</option>
          <option value="brand">By brand</option>
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '3%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
              {['Customer', 'Brand', 'Technician', 'Last visit', 'Revisit #', 'Tags', ''].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: '12px', fontWeight: 500, color: '#94A3B8',
                  whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((job) => (
              <tr
                key={job.id}
                style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                onClick={() => window.location.assign(`/jobs/${job.id}`)}
              >
                {/* Customer — Semibold anchor + chronic accent bar */}
                <td style={{
                  padding: '20px 16px', color: '#0F172A', whiteSpace: 'nowrap',
                  fontSize: '14px', fontWeight: 600,
                  borderLeft: job.is_chronic ? '2px solid #9F1239' : '2px solid transparent',
                }}>
                  {job.customer_name}
                </td>
                {/* Brand — Regular metadata */}
                <td style={{ padding: '20px 16px' }}>
                  <BrandSwatch name={job.brand_name} colorHex={job.brand_color} />
                </td>
                {/* Technician — Regular metadata */}
                <td style={{ padding: '20px 16px', color: '#64748B', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 400 }}>
                  {job.technician_name || <span style={{ color: '#A3A3A3', fontStyle: 'italic' }}>Unassigned</span>}
                </td>
                {/* Last visit — Light tertiary */}
                <td style={{ padding: '20px 16px', color: '#94A3B8', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>
                  {job.scheduled_at
                    ? new Date(job.scheduled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                    : <span style={{ color: '#CBD5E1' }}>—</span>}
                </td>
                {/* Revisit # — Medium emphasis */}
                <td style={{ padding: '20px 16px', color: '#9F1239', fontSize: '13px', fontWeight: 500 }}>
                  {job.revisit_sequence ? `#${job.revisit_sequence}` : '#1'}
                </td>
                {/* Tags — Frequent / Repeat only; Chronic is carried by the accent bar */}
                <td style={{ padding: '20px 16px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                    {job.is_frequent && <TagChip label="Frequent" variant="frequent" />}
                    {job.is_repeat && !job.is_frequent && <TagChip label="Repeat" variant="repeat" />}
                  </div>
                </td>
                <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                  <ChevronRight size={16} strokeWidth={1.5} color="#A3A3A3" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────── */
export function Dashboard() {
  const amberJobs = mockJobs.filter(j => j.status === 'needs_revisit');
  const activeJobs = mockJobs.filter(j => !['completed', 'resolved', 'resolved_on_revisit', 'cancelled'].includes(j.status));
  const cancellationPending = mockJobs.filter(j => j.status === 'cancellation_requested');

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>
      {/* Page header — Hero moment, vertically centred between top bar and KPI cards */}
      <div style={{ padding: '12px 0 36px' }}>
        <h1 style={{
          fontSize: '36px', fontWeight: 600, color: '#0A0A0A',
          margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1,
        }}>
          The Control Tower
        </h1>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <KPICard
          label="Total active jobs" value={mockKPI.total_active}
          icon={<Briefcase size={13} strokeWidth={1.5} />}
          accentColor="#737373" sparkId="total"
          sparkData={[18, 22, 19, 25, 21, 24, 23]}
          trend="up" trendVal={4} onClick={() => {}}
        />
        <KPICard
          label="Pending schedule" value={mockKPI.pending_schedule}
          icon={<Calendar size={13} strokeWidth={1.5} />}
          accentColor="#94A3B8" sparkId="pending"
          sparkData={[5, 8, 6, 9, 7, 11, 8]}
          trend="up" trendVal={9} onClick={() => {}}
        />
        <KPICard
          label="Amber alerts" value={mockKPI.amber_alerts}
          icon={<AlertTriangle size={13} strokeWidth={1.5} />}
          accentColor="#B45309" sparkId="amber"
          sparkData={[3, 5, 4, 6, 5, 7, 6]}
          trend="up" trendVal={14} onClick={() => {}}
        />
        <KPICard
          label="Chronic jobs" value={mockKPI.chronic_jobs}
          icon={<AlertOctagon size={13} strokeWidth={1.5} />}
          accentColor="#9F1239" sparkId="chronic"
          sparkData={[2, 2, 3, 3, 4, 3, 4]}
          trend="up" trendVal={8} onClick={() => {}}
        />
        <KPICard
          label="No-shows today" value={mockKPI.no_show_count}
          icon={<UserX size={13} strokeWidth={1.5} />}
          accentColor="#78716C" sparkId="noshow"
          sparkData={[1, 0, 2, 1, 0, 1, 2]}
          trend="down" trendVal={5} onClick={() => {}}
        />
      </div>

      {/* Amber Alerts */}
      {amberJobs.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <AmberAlertPanel jobs={amberJobs} />
        </div>
      )}

      {/* Active Jobs Table */}
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px',
        border: '1px solid #E5E5E5', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #E5E5E5',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Active jobs</span>
            <span style={{ fontSize: '13px', color: '#737373' }}>({activeJobs.length})</span>
          </div>
          <Link
            to="/jobs"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '13px', color: '#2563EB', textDecoration: 'none',
            }}
          >
            View all jobs <ExternalLink size={12} strokeWidth={1.5} />
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '3%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
                {['Customer', 'Brand', 'Technician', 'Scheduled', 'Status', 'Tags', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: '12px', fontWeight: 500, color: '#94A3B8',
                    whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeJobs.map((job) => (
                <tr
                  key={job.id}
                  style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  onClick={() => window.location.assign(`/jobs/${job.id}`)}
                >
                  {/* Customer — Semibold anchor + chronic accent bar */}
                  <td style={{
                    padding: '20px 16px', color: '#0F172A', whiteSpace: 'nowrap',
                    fontSize: '14px', fontWeight: 600,
                    borderLeft: job.is_chronic ? '2px solid #9F1239' : '2px solid transparent',
                  }}>
                    {job.customer_name}
                  </td>
                  {/* Brand — Regular metadata */}
                  <td style={{ padding: '20px 16px' }}>
                    <BrandSwatch name={job.brand_name} colorHex={job.brand_color} />
                  </td>
                  {/* Technician — Regular metadata */}
                  <td style={{ padding: '20px 16px', color: '#64748B', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 400 }}>
                    {job.technician_name || <span style={{ color: '#A3A3A3', fontStyle: 'italic' }}>Unassigned</span>}
                  </td>
                  {/* Scheduled — Light tertiary */}
                  <td style={{ padding: '20px 16px', color: '#94A3B8', fontSize: '12px', fontWeight: 300, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {job.scheduled_at
                      ? new Date(job.scheduled_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  {/* Status */}
                  <td style={{ padding: '20px 16px' }}>
                    <StatusChip status={job.status} />
                  </td>
                  {/* Tags */}
                  <td style={{ padding: '20px 16px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                      {job.is_chronic && <TagChip label="Chronic" variant="chronic" />}
                      {job.is_frequent && <TagChip label="Frequent" variant="frequent" />}
                      {job.is_repeat && !job.is_frequent && <TagChip label="Repeat" variant="repeat" />}
                    </div>
                  </td>
                  <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                    <ChevronRight size={16} strokeWidth={1.5} color="#A3A3A3" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}