import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import {
  Copy, Phone, MapPin, ArrowLeft, Clock, Bot,
  CheckCircle, AlertTriangle, History, Lock, Undo2,
  DollarSign, ChevronDown, ChevronUp, RefreshCw, X,
  AlertCircle, ArrowRight, Users, ChevronRight,
} from 'lucide-react';
import { mockJobs, mockTimeline } from '../data/mockData';
import { StatusChip } from '../components/ui/StatusChip';
import { BrandSwatch } from '../components/ui/JobTypeChip';

/* ── Timeline ────────────────────────────────────────────────── */
function TimelinePanel({ jobId }: { jobId: string }) {
  const events = mockTimeline.filter(e => e.job_id === jobId);

  const iconFor = (type: string) => {
    if (type.includes('system') || type.includes('threshold') || type.includes('chronic') || type.includes('auto')) return <Bot size={14} strokeWidth={1.5} />;
    if (type.includes('created')) return <CheckCircle size={14} strokeWidth={1.5} />;
    if (type.includes('scheduled')) return <Clock size={14} strokeWidth={1.5} />;
    if (type.includes('assigned')) return <RefreshCw size={14} strokeWidth={1.5} />;
    if (type.includes('revisit')) return <AlertTriangle size={14} strokeWidth={1.5} />;
    return <History size={14} strokeWidth={1.5} />;
  };

  const labelFor = (type: string) => {
    const map: Record<string, string> = {
      job_created: 'Job created',
      scheduled: 'Scheduled',
      assigned: 'Technician assigned',
      status_changed: 'Status changed',
      needs_revisit_raised: 'Needs revisit',
      chronic_threshold_reached: 'Chronic threshold reached',
    };
    return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div>
      {events.length === 0 ? (
        <p style={{ color: '#737373', fontSize: '13px', padding: '16px 0' }}>No timeline events yet.</p>
      ) : (
        <div>
          {events.map((event, i) => (
            <div key={event.id} style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '9999px',
                  backgroundColor: '#F5F5F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#525252', flexShrink: 0,
                }}>
                  {iconFor(event.event_type)}
                </div>
                {i < events.length - 1 && (
                  <div style={{ width: '1px', flex: 1, backgroundColor: '#E5E5E5', minHeight: '16px', marginTop: '4px' }} />
                )}
              </div>
              <div style={{ flex: 1, paddingBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: event.is_system ? '#737373' : '#404040' }}>
                    {labelFor(event.event_type)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#A3A3A3', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(event.occurred_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>
                  {event.is_system ? <span style={{ fontStyle: 'italic' }}>System</span> : event.actor}
                </div>
                {(event.previous_value || event.new_value) && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {event.previous_value && (
                      <span style={{ padding: '2px 6px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '4px', fontSize: '11px' }}>
                        {event.previous_value}
                      </span>
                    )}
                    {event.previous_value && event.new_value && <span style={{ color: '#A3A3A3', fontSize: '12px' }}>→</span>}
                    {event.new_value && (
                      <span style={{ padding: '2px 6px', backgroundColor: '#D1FAE5', color: '#065F46', borderRadius: '4px', fontSize: '11px' }}>
                        {event.new_value}
                      </span>
                    )}
                  </div>
                )}
                {event.reason && (
                  <div style={{
                    marginTop: '6px', padding: '6px 10px',
                    backgroundColor: '#FAFAFA', borderLeft: '2px solid #E5E5E5',
                    borderRadius: '2px', fontSize: '12px', color: '#525252', fontStyle: 'italic',
                  }}>
                    "{event.reason}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────── */
interface ModalProps { isOpen: boolean; onClose: () => void; title: string; blocking?: boolean; children: React.ReactNode }
function Modal({ isOpen, onClose, title, blocking, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div
      onClick={() => !blocking && onClose()}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#fff', borderRadius: '12px', width: '480px', maxWidth: '95vw',
          boxShadow: '0 10px 38px rgba(0,0,0,0.10), 0 10px 20px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E5E5E5',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: blocking ? '#FFFBEB' : '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {blocking && <Lock size={16} strokeWidth={1.5} color="#B45309" />}
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>{title}</span>
            {blocking && (
              <span style={{
                padding: '2px 8px', backgroundColor: '#FEF3C7',
                color: '#92400E', borderRadius: '9999px',
                fontSize: '11px', fontWeight: 500,
              }}>
                Action required
              </span>
            )}
          </div>
          {!blocking && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div style={{ padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Reason Field ────────────────────────────────────────────── */
function ReasonField({ label, value, onChange, minChars = 10 }: { label: string; value: string; onChange: (v: string) => void; minChars?: number }) {
  const met = value.length >= minChars;
  return (
    <div>
      <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '6px' }}>
        {label} <span style={{ color: '#EF4444' }}>*</span>
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        style={{
          width: '100%', padding: '8px 10px',
          border: `1px solid ${!value ? '#E5E5E5' : met ? '#10B981' : '#E5E5E5'}`,
          borderRadius: '8px', fontSize: '13px', resize: 'vertical', outline: 'none',
          fontFamily: 'inherit', boxSizing: 'border-box', color: '#171717',
        }}
        placeholder="Enter reason (minimum 10 characters)"
      />
      <div style={{ fontSize: '11px', color: met ? '#10B981' : '#737373', marginTop: '3px' }}>
        {value.length} / {minChars} minimum
      </div>
    </div>
  );
}

/* ── Airy Field Row ──────────────────────────────────────────── */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', minHeight: '22px' }}>
      <span style={{ fontSize: '12px', color: '#A3A3A3', minWidth: '96px', flexShrink: 0, paddingTop: '1px', lineHeight: 1.5 }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#171717', flex: 1, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

/* ── Sub-header Separator ────────────────────────────────────── */
function Dot() {
  return <span style={{ color: '#D4D4D4', userSelect: 'none' }}>·</span>;
}

/* ── JobDetail ───────────────────────────────────────────────── */
export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const job = mockJobs.find(j => j.id === `j-${id}` || j.id === id);

  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'payment' | 'review'>('details');
  const [modal, setModal] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Close actions dropdown on outside click
  useEffect(() => {
    if (!actionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionsOpen]);

  if (!job) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#737373' }}>Job not found.</p>
        <Link to="/jobs" style={{ color: '#2563EB' }}>← Back to jobs</Link>
      </div>
    );
  }

  const isTerminal = ['completed', 'resolved', 'resolved_on_revisit', 'cancelled'].includes(job.status);

  // Actions dropdown items
  const actionItems: Array<{ label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; dividerBefore?: boolean; hide?: boolean }> = [
    { label: 'Roll back status', icon: <Undo2 size={13} strokeWidth={1.5} />, onClick: () => setModal('rollback'), hide: isTerminal },
    { label: 'Override status', icon: <Lock size={13} strokeWidth={1.5} />, onClick: () => setModal('override') },
    { label: job.technician_id ? 'Reassign technician' : 'Assign technician', icon: <Users size={13} strokeWidth={1.5} />, onClick: () => {}, dividerBefore: true },
    { label: 'View timeline', icon: <History size={13} strokeWidth={1.5} />, onClick: () => setActiveTab('timeline') },
    { label: 'Manage payment', icon: <DollarSign size={13} strokeWidth={1.5} />, onClick: () => setActiveTab('payment') },
    { label: 'Cancel job', icon: <X size={13} strokeWidth={1.5} />, onClick: () => setModal('cancel'), danger: true, dividerBefore: true, hide: isTerminal },
    { label: 'Reopen job', icon: <RefreshCw size={13} strokeWidth={1.5} />, onClick: () => setModal('reopen'), dividerBefore: true, hide: job.status !== 'cancelled' },
  ].filter(a => !a.hide);

  const typeLabel = job.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) ?? '';

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
        <Link to="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#737373', textDecoration: 'none' }}>
          <ArrowLeft size={13} strokeWidth={1.5} /> All jobs
        </Link>
        <span style={{ color: '#D4D4D4', fontSize: '13px' }}>/</span>
        <span style={{ fontSize: '13px', color: '#A3A3A3', fontFamily: "'JetBrains Mono', monospace" }}>
          {job.id.replace('j-', '')}
        </span>
      </div>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        {/* Primary row: ID + copy + status chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '24px', fontWeight: 600, color: '#0A0A0A',
            letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
          }}>
            {job.id.replace('j-', '')}
          </span>
          <button
            onClick={handleCopy}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A3A3A3', position: 'relative', lineHeight: 0, padding: 0 }}
          >
            <Copy size={14} strokeWidth={1.5} />
            {copied && (
              <span style={{
                position: 'absolute', top: '-26px', left: '50%', transform: 'translateX(-50%)',
                fontSize: '11px', backgroundColor: '#0A0A0A', color: '#fff',
                padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap',
              }}>Copied!</span>
            )}
          </button>
          <StatusChip status={job.status} />
        </div>

        {/* Sub-header: secondary details, desaturated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
          <BrandSwatch name={job.brand_name} colorHex={job.brand_color} />
          {typeLabel && <><Dot /><span style={{ fontSize: '13px', color: '#737373' }}>{typeLabel}</span></>}
          {job.dealer_name && <><Dot /><span style={{ fontSize: '13px', color: '#737373' }}>via {job.dealer_name}</span></>}
          {job.revisit_sequence && <><Dot /><span style={{ fontSize: '13px', color: '#737373' }}>Revisit #{job.revisit_sequence}</span></>}
          {job.is_chronic && <><Dot /><span style={{ fontSize: '13px', color: '#B45309' }}>Chronic</span></>}
          {job.is_frequent && <><Dot /><span style={{ fontSize: '13px', color: '#737373' }}>Frequent</span></>}
          {job.is_repeat && <><Dot /><span style={{ fontSize: '13px', color: '#737373' }}>Repeat</span></>}
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '48px', alignItems: 'start' }}>

        {/* ── Left: Tabs + content ───────────────────────────── */}
        <div>
          {/* Tab bar — airy, no outer box */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E5E5', marginBottom: '0' }}>
            {(['details', 'timeline', 'payment', 'review'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 16px', fontSize: '13px',
                  fontWeight: activeTab === tab ? 500 : 400,
                  color: activeTab === tab ? '#0A0A0A' : '#737373',
                  borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? '#0A0A0A' : 'transparent'}`,
                  background: 'none', cursor: 'pointer',
                  marginBottom: '-1px', transition: 'color 120ms',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Details tab: airy grid ──────────────────────────── */}
          {activeTab === 'details' && (
            <div style={{ paddingTop: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 48px' }}>

                {/* Customer column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Customer</span>
                  <FieldRow label="Name">{job.customer_name}</FieldRow>
                  <FieldRow label="Phone">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {job.phone}
                      <a href={`tel:${job.phone}`} style={{ color: '#A3A3A3', lineHeight: 0, flexShrink: 0 }}>
                        <Phone size={12} strokeWidth={1.5} />
                      </a>
                    </span>
                  </FieldRow>
                  <FieldRow label="Address">
                    <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span>{job.address}</span>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A3A3A3', lineHeight: 0, flexShrink: 0, marginTop: '2px' }}>
                        <MapPin size={12} strokeWidth={1.5} />
                      </a>
                    </span>
                  </FieldRow>
                  {/* Progressive disclosure: VCID */}
                  {showMeta && (
                    <FieldRow label="VCID">
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#737373' }}>{job.vcid}</span>
                    </FieldRow>
                  )}
                </div>

                {/* Schedule column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Schedule</span>
                  <FieldRow label="Technician">
                    {job.technician_name ?? <span style={{ color: '#A3A3A3', fontStyle: 'italic' }}>Unassigned</span>}
                  </FieldRow>
                  {job.dealer_name && (
                    <FieldRow label="Dealer">{job.dealer_name}</FieldRow>
                  )}
                  <FieldRow label="Scheduled">
                    {job.scheduled_at
                      ? new Date(job.scheduled_at).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : <span style={{ color: '#A3A3A3' }}>—</span>}
                  </FieldRow>
                  {job.issue_description && (
                    <FieldRow label="Issue">
                      <span style={{ fontStyle: 'italic', color: '#525252' }}>{job.issue_description}</span>
                    </FieldRow>
                  )}
                  {/* Progressive disclosure: created_at */}
                  {showMeta && (
                    <FieldRow label="Created">
                      <span style={{ color: '#737373' }}>
                        {new Date(job.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </FieldRow>
                  )}
                </div>
              </div>

              {/* Show / hide technical metadata */}
              <button
                onClick={() => setShowMeta(p => !p)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  marginTop: '24px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: '#A3A3A3', padding: 0,
                  transition: 'color 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#525252')}
                onMouseLeave={e => (e.currentTarget.style.color = '#A3A3A3')}
              >
                {showMeta
                  ? <><ChevronUp size={12} strokeWidth={1.5} /> Hide technical details</>
                  : <><ChevronDown size={12} strokeWidth={1.5} /> Show technical details</>
                }
              </button>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div style={{ paddingTop: '24px' }}>
              <TimelinePanel jobId={job.id} />
            </div>
          )}

          {activeTab === 'payment' && (
            <div style={{ paddingTop: '24px' }}>
              {job.payment_amount ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '32px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>Amount</div>
                      <div style={{ fontSize: '22px', fontWeight: 600, color: '#065F46', fontVariantNumeric: 'tabular-nums' }}>
                        SAR {job.payment_amount?.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>Method</div>
                      <div style={{ fontSize: '14px', color: '#404040' }}>{job.payment_method}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', color: '#404040' }}>Edit method</button>
                    <button style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', color: '#404040' }}>Edit amount</button>
                    <button onClick={() => setModal('void-retain')} style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid #FCA5A5', backgroundColor: '#fff', cursor: 'pointer', color: '#991B1B' }}>
                      Void / retain
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#737373', fontSize: '13px' }}>No payment recorded yet.</p>
              )}
            </div>
          )}

          {activeTab === 'review' && (
            <div style={{ paddingTop: '24px' }}>
              <p style={{ color: '#737373', fontSize: '13px' }}>Customer review feature is enabled (optional mode). No review submitted yet.</p>
            </div>
          )}
        </div>

        {/* ── Right: Actions sidebar ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Cancellation banner */}
          {job.status === 'cancellation_requested' && (
            <div style={{
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: '12px', padding: '14px', marginBottom: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <AlertCircle size={15} strokeWidth={1.5} color="#B45309" />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#171717' }}>Cancellation request</span>
              </div>
              <p style={{ fontSize: '12px', color: '#404040', margin: '0 0 10px', fontStyle: 'italic' }}>
                "{job.dealer_name} has requested cancellation."
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={{
                  flex: 1, padding: '7px', borderRadius: '8px',
                  backgroundColor: '#0A0A0A', color: '#fff', border: 'none',
                  fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                }}>Approve</button>
                <button style={{
                  flex: 1, padding: '7px', borderRadius: '8px',
                  backgroundColor: '#fff', color: '#404040',
                  border: '1px solid #E5E5E5', fontSize: '13px', cursor: 'pointer',
                }}>Reject</button>
              </div>
            </div>
          )}

          {/* ── Advance Status — high-contrast CTA ────────────── */}
          {!isTerminal && (
            <button
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                backgroundColor: '#0A0A0A', color: '#fff', border: 'none',
                fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                transition: 'opacity 120ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Advance Status <ArrowRight size={14} strokeWidth={2} />
            </button>
          )}

          {/* ── Actions dropdown — muted ───────────────────────── */}
          <div ref={actionsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setActionsOpen(p => !p)}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: '8px',
                backgroundColor: '#fff', color: '#525252',
                border: '1px solid #E5E5E5', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background-color 120ms, border-color 120ms',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#FAFAFA';
                (e.currentTarget as HTMLElement).style.borderColor = '#D4D4D4';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
                (e.currentTarget as HTMLElement).style.borderColor = '#E5E5E5';
              }}
            >
              Actions
              <ChevronDown
                size={13} strokeWidth={1.5}
                style={{ transition: 'transform 160ms', transform: actionsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {actionsOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                backgroundColor: '#fff', border: '1px solid #E5E5E5',
                borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                zIndex: 200, overflow: 'hidden',
              }}>
                {actionItems.map((action, i) => (
                  <div key={action.label}>
                    {action.dividerBefore && i > 0 && (
                      <div style={{ height: '1px', backgroundColor: '#F5F5F5', margin: '0' }} />
                    )}
                    <button
                      onClick={() => { action.onClick(); setActionsOpen(false); }}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', fontSize: '13px',
                        color: action.danger ? '#991B1B' : '#404040',
                        display: 'flex', alignItems: 'center', gap: '9px',
                        transition: 'background-color 100ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span style={{ color: action.danger ? '#EF4444' : '#A3A3A3', lineHeight: 0 }}>{action.icon}</span>
                      {action.label}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Payment summary — airy, no box ─────────────────── */}
          {job.payment_amount ? (
            <div style={{ paddingTop: '8px', borderTop: '1px solid #F5F5F5' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>Payment</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#065F46', fontVariantNumeric: 'tabular-nums' }}>
                SAR {job.payment_amount.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>{job.payment_method}</div>
              <button
                onClick={() => setActiveTab('payment')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: '#A3A3A3', padding: 0,
                  transition: 'color 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#525252')}
                onMouseLeave={e => (e.currentTarget.style.color = '#A3A3A3')}
              >
                Manage <ChevronRight size={11} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div style={{ paddingTop: '8px', borderTop: '1px solid #F5F5F5' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#A3A3A3', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '4px' }}>Payment</div>
              <div style={{ fontSize: '13px', color: '#A3A3A3' }}>No payment recorded</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <Modal isOpen={modal === 'rollback'} onClose={() => { setModal(null); setReason(''); }} title="Roll back status">
        <p style={{ fontSize: '13px', color: '#737373', marginBottom: '12px' }}>
          Rolling back to: <span style={{ color: '#171717', fontWeight: 500 }}>{job.status.replace(/_/g, ' ')}</span>
        </p>
        <ReasonField label="Rollback reason" value={reason} onChange={setReason} />
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
          <button disabled={reason.length < 10} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: reason.length >= 10 ? '#0A0A0A' : '#E5E5E5', color: reason.length >= 10 ? '#fff' : '#A3A3A3', cursor: reason.length >= 10 ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}>Confirm</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'override'} onClose={() => { setModal(null); setReason(''); }} title="Full status override">
        <p style={{ fontSize: '12px', color: '#737373', marginBottom: '12px' }}>Owner only — set this job to any valid status.</p>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>
            New status <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#404040' }}>
            <option>Select status…</option>
            <option>scheduled</option><option>assigned</option><option>in_process</option>
            <option>completed</option><option>needs_revisit</option><option>cancelled</option>
          </select>
        </div>
        <ReasonField label="Override reason" value={reason} onChange={setReason} />
        <button
          onClick={() => setHelpOpen(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', fontSize: '12px', marginTop: '8px' }}
        >
          {helpOpen ? <ChevronUp size={13} strokeWidth={1.5} /> : <ChevronDown size={13} strokeWidth={1.5} />}
          What does this mean?
        </button>
        {helpOpen && (
          <div style={{ marginTop: '8px', padding: '10px 12px', backgroundColor: '#FAFAFA', borderRadius: '8px', fontSize: '12px', color: '#525252' }}>
            A full status override bypasses the normal job lifecycle and moves the job directly to the chosen status. This action is logged in the job timeline.
          </div>
        )}
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
          <button disabled={reason.length < 10} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: reason.length >= 10 ? '#0A0A0A' : '#E5E5E5', color: reason.length >= 10 ? '#fff' : '#A3A3A3', cursor: reason.length >= 10 ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}>Override status</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'cancel'} onClose={() => { setModal(null); setReason(''); }} title="Cancel job">
        {job.status === 'in_process' && (
          <div style={{ padding: '10px 12px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#92400E', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertTriangle size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: '1px' }} />
            Work has commenced on this job. Are you sure you want to cancel?
          </div>
        )}
        <ReasonField label="Cancellation reason" value={reason} onChange={setReason} />
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Back</button>
          <button disabled={reason.length < 10} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: reason.length >= 10 ? '#0A0A0A' : '#E5E5E5', color: reason.length >= 10 ? '#fff' : '#A3A3A3', cursor: reason.length >= 10 ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}>Confirm cancel</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'reopen'} onClose={() => { setModal(null); setReason(''); }} title="Reopen cancelled job">
        <p style={{ fontSize: '13px', color: '#737373', marginBottom: '12px' }}>
          This job will be restored to its last pre-cancellation status.
        </p>
        <ReasonField label="Reopen reason" value={reason} onChange={setReason} />
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
          <button disabled={reason.length < 10} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: reason.length >= 10 ? '#0A0A0A' : '#E5E5E5', color: reason.length >= 10 ? '#fff' : '#A3A3A3', cursor: reason.length >= 10 ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}>Reopen job</button>
        </div>
      </Modal>

      {/* Void-or-Retain — BLOCKING */}
      <Modal isOpen={modal === 'void-retain'} onClose={() => {}} title="Void or retain payment" blocking>
        <p style={{ fontSize: '13px', color: '#404040', marginBottom: '16px' }}>You must choose one option to continue. This action cannot be dismissed.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', border: '1px solid #E5E5E5', borderRadius: '8px', cursor: 'pointer' }}>
            <input type="radio" name="voidRetain" value="void" style={{ marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#991B1B' }}>Void payment</div>
              <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>Remove this payment record entirely</div>
              <div style={{ marginTop: '8px' }}>
                <ReasonField label="Void reason" value={reason} onChange={setReason} />
              </div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', border: '1px solid #E5E5E5', borderRadius: '8px', cursor: 'pointer' }}>
            <input type="radio" name="voidRetain" value="retain" style={{ marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#065F46' }}>Retain payment</div>
              <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>Keep the payment record without reversing it</div>
            </div>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
            Confirm choice
          </button>
        </div>
      </Modal>
    </div>
  );
}