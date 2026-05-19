import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { X, CheckCheck, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { mockNotifications, type Notification } from '../../data/mockData';

type Filter = 'all' | 'unread' | 'cancellations' | 'assignments';

function NotifRow({ notif, onRead }: { notif: Notification; onRead: () => void }) {
  const urgentBg = notif.is_urgent
    ? notif.urgent_color === 'red'
      ? notif.is_read ? '#fff' : '#FEF2F2'
      : notif.is_read ? '#fff' : '#FFFBEB'
    : notif.is_read ? '#fff' : '#FAFAFA';

  return (
    <div
      style={{
        backgroundColor: urgentBg,
        padding: '14px 20px',
        borderBottom: '1px solid #F5F5F5',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'background-color 100ms',
      }}
      onMouseEnter={e => { if (notif.is_read) (e.currentTarget.style.backgroundColor = '#FAFAFA'); }}
      onMouseLeave={e => { if (notif.is_read) (e.currentTarget.style.backgroundColor = '#fff'); }}
      onClick={onRead}
    >
      <div style={{
        width: '7px', height: '7px', borderRadius: '50%',
        backgroundColor: notif.is_read ? 'transparent' : '#2563EB',
        marginTop: '5px', flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: notif.is_read ? 400 : 500, color: '#171717', lineHeight: 1.4 }}>
            {notif.title}
          </span>
          <span style={{ fontSize: '11px', color: '#A3A3A3', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {new Date(notif.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#525252', margin: '3px 0 0', lineHeight: 1.5 }}>{notif.body}</p>
        {notif.job_ref && (
          <Link
            to={`/jobs/j-${notif.job_ref}`}
            onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#2563EB', textDecoration: 'none', marginTop: '5px' }}
          >
            View job {notif.job_ref} <ChevronRight size={11} strokeWidth={1.5} />
          </Link>
        )}
      </div>
      {notif.is_urgent && (
        <AlertTriangle size={15} strokeWidth={1.5} color={notif.urgent_color === 'red' ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0, marginTop: '2px' }} />
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationOverlay({ open, onClose }: Props) {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<Filter>('all');
  // Drives the slide-in animation
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Trigger CSS transition after mount
  useEffect(() => {
    if (open) {
      // Small rAF delay ensures the browser paints the initial off-screen state first
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'cancellations') return n.type.includes('cancellation');
    if (filter === 'assignments') return n.type.includes('assigned') || n.type.includes('job_submitted');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const markRead = (id: string) => setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
  const markAllRead = () => setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));

  const FILTERS: Filter[] = ['all', 'unread', 'cancellations', 'assignments'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
      {/* Dimmed backdrop — click to dismiss */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.28)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      />

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '460px', maxWidth: '100vw',
          backgroundColor: '#fff',
          borderLeft: '1px solid #E5E5E5',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid #E5E5E5',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: unreadCount > 0 ? '12px' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: '#F5F5F5', color: '#525252',
                  borderRadius: '9999px', fontSize: '12px', fontWeight: 500,
                  padding: '2px 8px', marginTop: '6px',
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close notifications"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#737373', flexShrink: 0,
                transition: 'background-color 120ms, color 120ms',
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
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Filter chips + Mark all read */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '14px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer',
                    backgroundColor: filter === f ? '#0A0A0A' : '#fff',
                    color: filter === f ? '#fff' : '#525252',
                    border: `1px solid ${filter === f ? '#0A0A0A' : '#E5E5E5'}`,
                    fontWeight: filter === f ? 500 : 400,
                    transition: 'all 120ms',
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px', borderRadius: '8px',
                  border: '1px solid #E5E5E5', backgroundColor: '#fff',
                  cursor: 'pointer', fontSize: '12px', color: '#404040',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'background-color 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
              >
                <CheckCheck size={12} strokeWidth={1.5} /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* ── Notification list ────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '64px 20px', textAlign: 'center' }}>
              <CheckCircle size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4, color: '#10B981' }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#404040' }}>You're all caught up!</p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#737373' }}>No notifications in this category.</p>
            </div>
          ) : (
            filtered.map(notif => (
              <NotifRow key={notif.id} notif={notif} onRead={() => markRead(notif.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
