import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router';
import {
  Home, ListTodo, Bell, Settings, BarChart3, Users,
  Building2, Plus, Search, ChevronRight, CreditCard,
  Zap, Clock, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { mockNotifications } from '../../data/mockData';
import { NotificationOverlay } from '../notifications/NotificationOverlay';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/jobs', label: 'All jobs', icon: ListTodo },
  { path: '/pending-schedule', label: 'Pending schedule', icon: Clock },
  { path: '/technicians', label: 'Technicians', icon: Users },
  { path: '/dealers', label: 'Dealer management', icon: Building2 },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { path: '/settings', label: 'System config', icon: Settings },
];

export function AppShell() {
  const location = useLocation();
  const unread = mockNotifications.filter(n => !n.is_read).length;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const preview = [...mockNotifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: '#FFFFFF', overflow: 'hidden',
      fontSize: '15px', lineHeight: 1.5, color: '#171717',
    }}>
      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <aside style={{
        width: sidebarOpen ? '240px' : '56px',
        backgroundColor: '#FAFAFA',
        borderRight: '1px solid #E5E5E5',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 220ms ease-in-out',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          height: '56px',
          padding: '0 14px',
          borderBottom: '1px solid #E5E5E5',
          display: 'flex', alignItems: 'center', gap: '9px',
          flexShrink: 0,
        }}>
          <Zap
            size={20}
            color="#0A0A0A"
            strokeWidth={1.5}
            style={{ flexShrink: 0 }}
          />
          {sidebarOpen && (
            <span style={{
              fontSize: '16px', fontWeight: 500, color: '#0A0A0A',
              whiteSpace: 'nowrap', letterSpacing: '-0.01em',
            }}>
              CoolDesk
            </span>
          )}
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1, padding: '8px 8px', overflowY: 'auto', overflowX: 'hidden',
        }}>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '8px',
                  marginBottom: '2px', textDecoration: 'none',
                  backgroundColor: active ? '#F5F5F5' : 'transparent',
                  color: active ? '#0A0A0A' : '#525252',
                  fontSize: '13px', fontWeight: active ? 500 : 400,
                  whiteSpace: 'nowrap', overflow: 'hidden',
                  transition: 'background-color 120ms, color 120ms',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#F5F5F5';
                    (e.currentTarget as HTMLElement).style.color = '#0A0A0A';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#525252';
                  }
                }}
              >
                <Icon size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse control */}
        <div style={{ padding: '8px 8px', borderTop: '1px solid #E5E5E5' }}>
          <button
            onClick={() => setSidebarOpen(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '8px 10px', borderRadius: '8px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#737373', fontSize: '13px',
            }}
          >
            <span style={{
              transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 220ms', flexShrink: 0, lineHeight: 0,
            }}>
              <ChevronRight size={14} strokeWidth={1.5} />
            </span>
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main content ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: '56px', backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E5E5E5',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px',
          flexShrink: 0,
        }}>
          {/* Search */}
          <div style={{ flex: 1, maxWidth: '380px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={14} strokeWidth={1.5}
              style={{ position: 'absolute', left: '10px', color: '#A3A3A3', pointerEvents: 'none' }}
            />
            <input
              placeholder="Search jobs, customers..."
              style={{
                width: '100%', padding: '7px 60px 7px 32px',
                border: '1px solid #E5E5E5', borderRadius: '8px',
                fontSize: '13px', outline: 'none', backgroundColor: '#FFFFFF',
                color: '#171717', fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.borderColor = '#A3A3A3')}
              onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
            />
            <span style={{
              position: 'absolute', right: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px', color: '#A3A3A3',
              backgroundColor: '#F5F5F5', border: '1px solid #E5E5E5',
              borderRadius: '4px', padding: '1px 5px',
              pointerEvents: 'none',
            }}>⌘K</span>
          </div>

          {/* Spacer — pushes everything right */}
          <div style={{ flex: 1 }} />

          {/* Log new job — Ghost / Outline style */}
          <Link
            to="/log-new-job"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '8px',
              backgroundColor: 'transparent', color: '#525252',
              border: '1px solid #E5E5E5',
              textDecoration: 'none', fontSize: '13px', fontWeight: 400,
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'background-color 120ms, border-color 120ms, color 120ms',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = '#F5F5F5';
              el.style.borderColor = '#D4D4D4';
              el.style.color = '#0A0A0A';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = 'transparent';
              el.style.borderColor = '#E5E5E5';
              el.style.color = '#525252';
            }}
          >
            <Plus size={13} strokeWidth={1.5} />
            Log new job
          </Link>

          {/* ── Session Hub ─────────────────────────────────────── */}
          {/* Thin divider */}
          <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E5E5', flexShrink: 0, margin: '0 4px' }} />

          {/* Notification bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setNotifOpen(p => !p)}
              style={{
                position: 'relative', color: notifOpen ? '#0A0A0A' : '#737373',
                lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: notifOpen ? '#F5F5F5' : 'transparent',
                transition: 'background-color 120ms, color 120ms',
                padding: 0,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = '#F5F5F5';
                el.style.color = '#0A0A0A';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = notifOpen ? '#F5F5F5' : 'transparent';
                el.style.color = notifOpen ? '#0A0A0A' : '#737373';
              }}
            >
              <Bell size={16} strokeWidth={1.5} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: '4px', right: '4px',
                  width: '7px', height: '7px',
                  backgroundColor: '#9F1239',
                  borderRadius: '9999px',
                  border: '1.5px solid #FFFFFF',
                }} />
              )}
            </button>

            {/* Notification popover */}
            {notifOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: '360px', backgroundColor: '#fff',
                border: '1px solid #E5E5E5', borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                zIndex: 9999, overflow: 'hidden',
              }}>
                {/* Popover header */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid #E5E5E5',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#0A0A0A' }}>Notifications</span>
                  {unread > 0 && (
                    <span style={{
                      backgroundColor: '#9F1239', color: '#fff',
                      borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                      padding: '1px 7px', letterSpacing: '0.01em',
                    }}>{unread}</span>
                  )}
                </div>

                {/* Preview items */}
                <div>
                  {preview.map((notif, i) => (
                    <div
                      key={notif.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: i < preview.length - 1 ? '1px solid #F5F5F5' : 'none',
                        display: 'flex', gap: '10px', alignItems: 'flex-start',
                        backgroundColor: notif.is_read ? '#fff' : '#FAFAFA',
                        cursor: 'pointer',
                        transition: 'background-color 100ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = notif.is_read ? '#fff' : '#FAFAFA')}
                      onClick={() => { setNotifOpen(false); setNotifCenterOpen(true); }}
                    >
                      {/* Unread dot */}
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        backgroundColor: notif.is_read ? 'transparent' : '#2563EB',
                        marginTop: '5px', flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: notif.is_read ? 400 : 500, color: '#171717', lineHeight: 1.4 }}>
                            {notif.title}
                          </span>
                          {notif.is_urgent && (
                            <AlertTriangle size={13} strokeWidth={1.5} color={notif.urgent_color === 'red' ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0, marginTop: '2px' }} />
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#737373', margin: '2px 0 0', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                          {notif.body}
                        </p>
                        <span style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '4px', display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(notif.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}

                  {preview.length === 0 && (
                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <CheckCircle size={24} strokeWidth={1.5} style={{ margin: '0 auto 8px', display: 'block', color: '#10B981', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontSize: '13px', color: '#737373' }}>No notifications</p>
                    </div>
                  )}
                </div>

                {/* View all footer */}
                <div style={{ borderTop: '1px solid #E5E5E5' }}>
                  <button
                    onClick={() => { setNotifOpen(false); setNotifCenterOpen(true); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      width: '100%', padding: '11px 16px', fontSize: '13px', fontWeight: 500,
                      color: '#0A0A0A', background: 'none', border: 'none', cursor: 'pointer',
                      transition: 'background-color 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    View all notifications <ChevronRight size={13} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Avatar with Live dot overlay */}
          <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '9999px',
              backgroundColor: '#F5F5F5',
              border: '1px solid #E5E5E5',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#171717',
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em',
              flexShrink: 0,
            }}>OW</div>
            {/* Live status dot — bottom-right corner overlay */}
            <span style={{
              position: 'absolute', bottom: '0px', right: '0px',
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: '#10B981',
              border: '2px solid #FFFFFF',
            }} />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', backgroundColor: '#FFFFFF' }}>
          <Outlet />
        </main>
      </div>

      {/* ── Notification Center Overlay ──────────────────────── */}
      <NotificationOverlay
        open={notifCenterOpen}
        onClose={() => setNotifCenterOpen(false)}
      />
    </div>
  );
}