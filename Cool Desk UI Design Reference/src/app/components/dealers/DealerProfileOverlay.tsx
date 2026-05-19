import { useState, useEffect } from 'react';
import {
  X, Phone, Globe, MapPin, CheckCircle,
  Briefcase, ChevronRight, TrendingUp,
  ToggleLeft, ToggleRight, Clock,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { Dealer } from '../../data/mockData';
import { mockBrands } from '../../data/mockData';
import { DEALER_EXTRAS } from '../../data/dealerExtras';

/* ── helpers ─────────────────────────────────────────────────── */
function dealerInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const PALETTE = [
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#DBEAFE', text: '#1E40AF' },
];
function avatarColors(name: string) {
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    completed: 'Completed', resolved: 'Resolved', resolved_on_revisit: 'Resolved (revisit)',
    needs_revisit: 'Needs revisit', cancelled: 'Cancelled', in_process: 'In process',
    assigned: 'Assigned', scheduled: 'Scheduled', cancellation_requested: 'Cancel request',
    pending_schedule: 'Pending schedule',
  };
  return map[s] ?? s.replace(/_/g, ' ');
}

function statusColor(s: string): { bg: string; text: string; dot: string } {
  if (['completed', 'resolved', 'resolved_on_revisit'].includes(s))
    return { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' };
  if (['cancelled'].includes(s))
    return { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' };
  if (['needs_revisit', 'cancellation_requested'].includes(s))
    return { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' };
  return { bg: '#F5F5F5', text: '#525252', dot: '#A3A3A3' };
}

/* ── Tab: Job History ────────────────────────────────────────── */
function JobHistoryTab({ dealerId }: { dealerId: string }) {
  const extra = DEALER_EXTRAS[dealerId];
  if (!extra || extra.history.length === 0)
    return <p style={{ color: '#737373', fontSize: '13px' }}>No job history available.</p>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 140px 100px 1fr', gap: '0', borderBottom: '1px solid #E5E5E5', paddingBottom: '8px', marginBottom: '4px' }}>
        {['Job ID', 'Customer', 'Type', 'Status', 'Amount', 'Technician'].map(h => (
          <span key={h} style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
        ))}
      </div>
      {extra.history.map((job, i) => {
        const sc = statusColor(job.status);
        return (
          <div
            key={job.id}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 100px 140px 100px 1fr',
              alignItems: 'center', gap: '0',
              padding: '12px 0',
              borderBottom: i < extra.history.length - 1 ? '1px solid #F5F5F5' : 'none',
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#737373' }}>{job.id}</span>
            <span style={{ fontSize: '13px', color: '#171717' }}>{job.customer}</span>
            <span style={{ fontSize: '12px', color: '#525252' }}>{job.type}</span>
            <span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px', borderRadius: '9999px',
                backgroundColor: sc.bg, color: sc.text, fontSize: '11px', fontWeight: 500,
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: sc.dot, flexShrink: 0 }} />
                {statusLabel(job.status)}
              </span>
            </span>
            <span style={{ fontSize: '13px', color: job.amount ? '#065F46' : '#A3A3A3', fontVariantNumeric: 'tabular-nums', fontWeight: job.amount ? 500 : 400 }}>
              {job.amount ? `SAR ${job.amount.toLocaleString()}` : '—'}
            </span>
            <span style={{ fontSize: '12px', color: '#737373' }}>{job.technician ?? '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab: Ongoing ────────────────────────────────────────────── */
function OngoingTab({ dealerId }: { dealerId: string }) {
  const extra = DEALER_EXTRAS[dealerId];
  if (!extra || extra.ongoing.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <CheckCircle size={28} strokeWidth={1.5} style={{ margin: '0 auto 10px', display: 'block', color: '#10B981', opacity: 0.5 }} />
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#404040' }}>No active assignments</p>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#737373' }}>This dealer has no ongoing jobs at the moment.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {extra.ongoing.map(job => {
        const sc = statusColor(job.status);
        return (
          <div key={job.id} style={{
            padding: '16px 20px', borderRadius: '10px',
            border: '1px solid #E5E5E5', backgroundColor: '#FAFAFA',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#A3A3A3' }}>{job.id}</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '9999px',
                  backgroundColor: sc.bg, color: sc.text, fontSize: '11px', fontWeight: 500,
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: sc.dot, flexShrink: 0 }} />
                  {statusLabel(job.status)}
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#171717', marginBottom: '4px' }}>{job.customer}</div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#737373' }}>
                  <MapPin size={11} strokeWidth={1.5} />{job.address}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#737373' }}>
                  <Clock size={11} strokeWidth={1.5} />
                  {new Date(job.scheduled).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: '12px', color: '#737373' }}>{job.type}</span>
                {job.technician && (
                  <span style={{ fontSize: '12px', color: '#737373' }}>· {job.technician}</span>
                )}
              </div>
            </div>
            <a
              href={`/jobs/${job.id.replace('j-', '')}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '12px', color: '#525252', textDecoration: 'none',
                padding: '6px 10px', borderRadius: '7px', border: '1px solid #E5E5E5',
                backgroundColor: '#fff', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              View job <ChevronRight size={11} strokeWidth={1.5} />
            </a>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab: Performance ────────────────────────────────────────── */
function PerformanceTab({ dealer }: { dealer: Dealer }) {
  const extra = DEALER_EXTRAS[dealer.id];
  if (!extra) return <p style={{ color: '#737373', fontSize: '13px' }}>No performance data.</p>;

  const completionRate = extra.total_jobs > 0 ? ((extra.completed_jobs / extra.total_jobs) * 100).toFixed(0) : '0';
  const crNum = Number(completionRate);
  const crColor = crNum >= 88 ? '#065F46' : crNum >= 75 ? '#92400E' : '#991B1B';
  const crBg    = crNum >= 88 ? '#D1FAE5' : crNum >= 75 ? '#FEF3C7' : '#FEE2E2';

  const assignedBrands = mockBrands.filter(b => dealer.brand_ids.includes(b.id));

  const kpis = [
    { label: 'Total jobs', value: extra.total_jobs, sub: `${extra.cancelled_jobs} cancelled` },
    { label: 'Completed', value: extra.completed_jobs, sub: 'all time' },
    { label: 'Completion rate', value: `${completionRate}%`, color: crColor, bg: crBg },
    { label: 'Avg job value', value: `SAR ${extra.avg_job_value.toLocaleString()}`, sub: 'per job' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{
            padding: '16px 18px', borderRadius: '10px',
            backgroundColor: kpi.bg ?? '#FAFAFA',
            border: '1px solid #E5E5E5',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {kpi.label}
            </div>
            <span style={{ fontSize: '26px', fontWeight: 600, color: kpi.color ?? '#0A0A0A', fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value}
            </span>
            {kpi.sub && <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Brand assignments */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#0A0A0A', marginBottom: '12px' }}>Assigned brands</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {assignedBrands.length > 0 ? assignedBrands.map(b => (
            <span key={b.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '9999px',
              border: '1px solid #E5E5E5', backgroundColor: '#FAFAFA',
              fontSize: '13px', color: '#404040',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: b.colour_hex ?? '#A3A3A3', flexShrink: 0 }} />
              {b.name}
            </span>
          )) : (
            <span style={{ fontSize: '13px', color: '#A3A3A3', fontStyle: 'italic' }}>No brands assigned</span>
          )}
        </div>
      </div>

      {/* Monthly volume chart */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#0A0A0A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Briefcase size={14} strokeWidth={1.5} color="#737373" /> Monthly job volume
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart key={`bar-${dealer.id}`} data={extra.monthly_perf.filter(m => m.submitted > 0 || m.completed > 0)} barGap={4} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#F5F5F5" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#A3A3A3' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#A3A3A3' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '12px' }}
              cursor={{ fill: '#F5F5F5' }}
            />
            <Bar dataKey="submitted" name="Submitted" fill="#E5E5E5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" name="Completed" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          {[{ color: '#E5E5E5', label: 'Submitted' }, { color: '#0A0A0A', label: 'Completed' }].map((l, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#737373' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: l.color, flexShrink: 0 }} />{l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Completion rate trend */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#0A0A0A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={14} strokeWidth={1.5} color="#737373" /> Completion rate trend (6 months)
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart key={`line-${dealer.id}`} data={extra.completion_trend.filter(m => m.rate > 0)}>
            <CartesianGrid vertical={false} stroke="#F5F5F5" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#A3A3A3' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#A3A3A3' }} axisLine={false} tickLine={false} width={32} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '12px' }}
              formatter={(v: number) => [`${v}%`, 'Completion rate']}
            />
            <Line
              type="monotone" dataKey="rate" stroke={crColor}
              strokeWidth={2} dot={{ r: 3, fill: crColor, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: crColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Main Overlay ────────────────────────────────────────────── */
interface Props {
  dealer: Dealer;
  onClose: () => void;
  onToggleStatus: () => void;
}

type Tab = 'history' | 'ongoing' | 'performance';

export function DealerProfileOverlay({ dealer, onClose, onToggleStatus }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [visible, setVisible] = useState(false);
  const extra = DEALER_EXTRAS[dealer.id];
  const av = avatarColors(dealer.business_name);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'history', label: 'Job History' },
    { key: 'ongoing', label: `Ongoing${extra && extra.ongoing.length > 0 ? ` (${extra.ongoing.length})` : ''}` },
    { key: 'performance', label: 'Performance' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      backgroundColor: '#fff',
      display: 'flex', flexDirection: 'column',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 200ms ease, transform 220ms ease',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, borderBottom: '1px solid #E5E5E5',
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', gap: '20px',
        backgroundColor: '#FAFAFA',
      }}>
        {/* Avatar */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '9999px',
          backgroundColor: av.bg, color: av.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 600, letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          {dealerInitials(dealer.business_name)}
        </div>

        {/* Name + sub-info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px', fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.01em' }}>{dealer.business_name}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 9px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500,
              backgroundColor: dealer.is_active ? '#D1FAE5' : '#F5F5F5',
              color: dealer.is_active ? '#065F46' : '#525252',
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: dealer.is_active ? '#10B981' : '#A3A3A3', flexShrink: 0 }} />
              {dealer.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#737373', fontWeight: 500 }}>{dealer.contact_name}</span>
            {extra?.phone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#737373' }}>
                <Phone size={11} strokeWidth={1.5} />{extra.phone}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#737373' }}>
              <MapPin size={11} strokeWidth={1.5} />{dealer.region}
            </span>
            {extra?.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#737373' }}>
                <Globe size={11} strokeWidth={1.5} />{extra.website}
              </span>
            )}
            {extra?.joined && (
              <span style={{ fontSize: '12px', color: '#A3A3A3' }}>
                Since {new Date(extra.joined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={onToggleStatus}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px', borderRadius: '8px',
              border: '1px solid #E5E5E5', backgroundColor: '#fff',
              fontSize: '12px', color: '#525252', cursor: 'pointer',
              transition: 'background-color 120ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
          >
            {dealer.is_active
              ? <><ToggleRight size={14} strokeWidth={1.5} color="#10B981" /> Set inactive</>
              : <><ToggleLeft size={14} strokeWidth={1.5} color="#A3A3A3" /> Set active</>
            }
          </button>
          <button
            onClick={onClose}
            aria-label="Close profile"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '8px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#737373', transition: 'background-color 120ms, color 120ms',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#F5F5F5';
              (e.currentTarget as HTMLElement).style.color = '#0A0A0A';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#737373';
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #E5E5E5', padding: '0 32px', display: 'flex' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '13px 18px', fontSize: '13px',
              fontWeight: activeTab === tab.key ? 500 : 400,
              color: activeTab === tab.key ? '#0A0A0A' : '#737373',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: `2px solid ${activeTab === tab.key ? '#0A0A0A' : 'transparent'}`,
              background: 'none', cursor: 'pointer',
              marginBottom: '-1px', transition: 'color 120ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {activeTab === 'history' && <JobHistoryTab dealerId={dealer.id} />}
        {activeTab === 'ongoing' && <OngoingTab dealerId={dealer.id} />}
        {activeTab === 'performance' && <PerformanceTab dealer={dealer} />}
      </div>
    </div>
  );
}