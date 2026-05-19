import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle, AlertTriangle, CheckCheck, ChevronRight } from 'lucide-react';
import { mockNotifications, type Notification } from '../data/mockData';

function NotificationItem({ notif, onRead }: { notif: Notification; onRead: () => void }) {
  const urgentBg = notif.is_urgent
    ? notif.urgent_color === 'red'
      ? (notif.is_read ? '#fff' : '#FEF2F2')
      : (notif.is_read ? '#fff' : '#FFFBEB')
    : (notif.is_read ? '#fff' : '#FAFAFA');

  return (
    <div
      style={{
        backgroundColor: urgentBg,
        padding: '14px 16px',
        borderBottom: '1px solid #F5F5F5',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'background-color 100ms',
      }}
      onMouseEnter={e => { if (notif.is_read) (e.currentTarget.style.backgroundColor = '#FAFAFA'); }}
      onMouseLeave={e => { if (notif.is_read) (e.currentTarget.style.backgroundColor = '#fff'); }}
      onClick={onRead}
    >
      {/* Unread dot */}
      <div style={{
        width: '7px', height: '7px', borderRadius: '50%',
        backgroundColor: notif.is_read ? 'transparent' : '#2563EB',
        marginTop: '5px', flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '13px', fontWeight: notif.is_read ? 400 : 500, color: '#171717' }}>
            {notif.title}
          </span>
          <span style={{ fontSize: '12px', color: '#A3A3A3', whiteSpace: 'nowrap', marginLeft: '8px', fontVariantNumeric: 'tabular-nums' }}>
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
        <div style={{ flexShrink: 0, lineHeight: 0 }}>
          <AlertTriangle size={15} strokeWidth={1.5} color={notif.urgent_color === 'red' ? '#EF4444' : '#F59E0B'} />
        </div>
      )}
    </div>
  );
}

export function Notifications() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<'all' | 'unread' | 'cancellations' | 'assignments'>('all');

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'cancellations') return n.type.includes('cancellation');
    if (filter === 'assignments') return n.type.includes('assigned') || n.type.includes('job_submitted');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const markRead = (id: string) => setNotifications(n => n.map(notif => notif.id === id ? { ...notif, is_read: true } : notif));
  const markAllRead = () => setNotifications(n => n.map(notif => ({ ...notif, is_read: true })));

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ backgroundColor: '#F5F5F5', color: '#525252', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, padding: '2px 8px' }}>
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}
          >
            <CheckCheck size={13} strokeWidth={1.5} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {(['all', 'unread', 'cancellations', 'assignments'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px', borderRadius: '9999px', fontSize: '13px', cursor: 'pointer',
              backgroundColor: filter === f ? '#0A0A0A' : '#fff',
              color: filter === f ? '#fff' : '#525252',
              border: `1px solid ${filter === f ? '#0A0A0A' : '#E5E5E5'}`,
              fontWeight: filter === f ? 500 : 400,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#737373' }}>
            <CheckCircle size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4, color: '#10B981' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#404040' }}>You're all caught up!</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>No notifications in this category.</p>
          </div>
        ) : (
          filtered.map(notif => (
            <NotificationItem key={notif.id} notif={notif} onRead={() => markRead(notif.id)} />
          ))
        )}
      </div>
    </div>
  );
}