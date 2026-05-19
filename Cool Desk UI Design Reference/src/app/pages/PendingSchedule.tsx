import { useState } from 'react';
import { Clock, Calendar, CheckCircle, Users, ChevronRight } from 'lucide-react';
import { mockJobs, mockTechnicians } from '../data/mockData';
import { JobTypeChip } from '../components/ui/JobTypeChip';

/* ── SLA thresholds (DRD OQ-02) ─────────────────────────────── */
const SLA = {
  installation: { amber: 2, red: 4 },
  complaint:    { amber: 1, red: 2 },
};

function daysWaiting(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

/* ── SLA metadata for a given (days, type) ───────────────────── */
type SlaLevel = 'ok' | 'amber' | 'red';

interface SlaInfo {
  level: SlaLevel;
  textColor: string;
  barColor: string;
  trackColor: string;
  fillPct: number;   // 0–100
  tooltip: string;
}

function getSlaInfo(days: number, type: 'installation' | 'complaint'): SlaInfo {
  const { amber, red } = SLA[type];
  const label = type === 'installation' ? 'installation' : 'complaint';

  const fillPct = Math.min(100, (days / red) * 100);

  if (days >= red) {
    return {
      level: 'red',
      textColor: '#991B1B',
      barColor: '#EF4444',
      trackColor: '#FEE2E2',
      fillPct,
      tooltip: `Critical: Exceeds ${red}-day ${label} SLA — immediate scheduling required`,
    };
  }
  if (days >= amber) {
    return {
      level: 'amber',
      textColor: '#92400E',
      barColor: '#F59E0B',
      trackColor: '#FEF3C7',
      fillPct,
      tooltip: `Warning: Approaching ${red}-day ${label} SLA — ${red - days} day${red - days === 1 ? '' : 's'} remaining`,
    };
  }
  return {
    level: 'ok',
    textColor: '#525252',
    barColor: '#D1D5DB',
    trackColor: '#F5F5F5',
    fillPct,
    tooltip: `On track — ${amber - days} day${amber - days === 1 ? '' : 's'} before ${label} amber threshold (${amber}d amber / ${red}d critical)`,
  };
}

/* ── SLA Progress Cell ───────────────────────────────────────── */
function SlaCell({ days, type }: { days: number; type: 'installation' | 'complaint' }) {
  const [hovered, setHovered] = useState(false);
  const sla = getSlaInfo(days, type);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', minWidth: '72px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            backgroundColor: '#0A0A0A',
            color: '#FFFFFF',
            fontSize: '11px',
            lineHeight: '1.4',
            padding: '6px 10px',
            borderRadius: '6px',
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'sla-tooltip-in 120ms ease-out',
          }}
        >
          {sla.tooltip}
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #0A0A0A',
          }} />
        </div>
      )}

      {/* Duration value */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        marginBottom: '5px', cursor: 'default',
      }}>
        <Clock size={11} strokeWidth={1.5} style={{ color: sla.textColor, flexShrink: 0 }} />
        <span style={{
          fontSize: '13px', fontWeight: sla.level === 'ok' ? 400 : 600,
          color: sla.textColor, fontVariantNumeric: 'tabular-nums',
        }}>
          {days}d
        </span>
      </div>

      {/* Progress track */}
      <div style={{
        width: '72px', height: '3px',
        backgroundColor: sla.trackColor,
        borderRadius: '2px', overflow: 'hidden',
      }}>
        {/* Progress fill */}
        <div style={{
          width: `${sla.fillPct}%`,
          height: '100%',
          backgroundColor: sla.barColor,
          borderRadius: '2px',
          transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
    </div>
  );
}

export function PendingSchedule() {
  const pending = mockJobs.filter(j => j.status === 'pending_schedule');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduling, setScheduling] = useState<Record<string, string>>({});

  const toggleSelect = (id: string) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      {/* Tooltip animation */}
      <style>{`
        @keyframes sla-tooltip-in {
          from { opacity: 0; transform: translateX(-50%) translateY(3px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Pending Schedule
          </h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>
            {pending.length} jobs awaiting scheduling
          </p>
        </div>
        <button
          onClick={() => { setBatchMode(b => !b); setSelected([]); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
            borderRadius: '8px', border: `1px solid ${batchMode ? '#0A0A0A' : '#E5E5E5'}`,
            backgroundColor: batchMode ? '#0A0A0A' : '#fff',
            color: batchMode ? '#fff' : '#404040',
            cursor: 'pointer', fontSize: '13px',
            transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease',
          }}
        >
          <Users size={14} strokeWidth={1.5} /> {batchMode ? 'Exit batch mode' : 'Batch schedule'}
        </button>
      </div>

      {batchMode && selected.length > 0 && (
        <div style={{ marginBottom: '16px', backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E5E5E5' }}>
          <span style={{ fontSize: '13px', color: '#171717', fontWeight: 500 }}>
            {selected.length} job{selected.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #E5E5E5', borderRadius: '8px', outline: 'none', color: '#404040' }}>
              <option value="">Select technician…</option>
              {mockTechnicians.filter(t => t.is_active).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: '#0A0A0A', color: '#fff', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
              Confirm schedule
            </button>
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '48px', textAlign: 'center', border: '1px solid #E5E5E5' }}>
          <CheckCircle size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block', color: '#10B981' }} />
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#404040', margin: 0 }}>No jobs pending schedule — all caught up!</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
                {batchMode && <th style={{ padding: '10px 12px', width: '40px' }}></th>}
                {['Job ID', 'Customer', 'Type', 'Brand', 'Dealer', 'Submitted', 'Days waiting', 'Schedule', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 500, color: '#A3A3A3',
                    whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((job) => {
                const days = daysWaiting(job.created_at);
                return (
                  <tr
                    key={job.id}
                    style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    {batchMode && (
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="checkbox"
                          checked={selected.includes(job.id)}
                          onChange={() => toggleSelect(job.id)}
                          style={{ accentColor: '#0A0A0A' }}
                        />
                      </td>
                    )}
                    <td style={{ padding: '14px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                      {job.id.replace('j-', '')}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#171717', whiteSpace: 'nowrap', fontSize: '14px' }}>
                      {job.customer_name}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <JobTypeChip type={job.type} />
                    </td>
                    <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px' }}>
                      {job.brand_name}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#525252', fontSize: '13px' }}>
                      {job.dealer_name || <span style={{ color: '#A3A3A3' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#525252', fontSize: '13px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(job.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>

                    {/* SLA Progress Cell */}
                    <td style={{ padding: '14px 16px' }}>
                      <SlaCell days={days} type={job.type} />
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="datetime-local"
                          value={scheduling[job.id] || ''}
                          onChange={e => setScheduling(s => ({ ...s, [job.id]: e.target.value }))}
                          style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid #E5E5E5', borderRadius: '6px', outline: 'none', color: '#404040', fontFamily: 'inherit' }}
                          onClick={e => e.stopPropagation()}
                        />
                        {scheduling[job.id] && (
                          <button
                            onClick={e => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', color: '#fff', border: 'none', fontSize: '12px', cursor: 'pointer' }}
                          >
                            <Calendar size={11} strokeWidth={1.5} /> Set
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <ChevronRight size={16} strokeWidth={1.5} color="#A3A3A3" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}