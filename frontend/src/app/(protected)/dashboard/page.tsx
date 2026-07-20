'use client';

import { RoleGate } from '@/components/auth/role-gate';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/client';
import { fetchDashboardMetrics } from '@/lib/api/dashboard';
import { fetchJobs } from '@/lib/api/jobs';
import { StatusChip } from '@/components/ui/status-chip';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMobileBreakpoint } from '@/hooks/use-mobile-breakpoint';
import { formatDayMonth, formatShortDateTime } from '@/lib/format-date';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';

const TAG_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  chronic: { bg: '#FFF1F2', color: '#9F1239', label: 'Chronic' },
  frequent: { bg: '#FFFBEB', color: '#92400E', label: 'Frequent' },
  repeat: { bg: '#F1F5F9', color: '#1E293B', label: 'Repeat' },
};

function JobTag({ type }: { type: keyof typeof TAG_STYLES }) {
  const s = TAG_STYLES[type];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '26px',
        padding: '0 10px',
        borderRadius: '9999px',
        border: `1px solid ${type === 'frequent' ? '#FDE68A' : type === 'chronic' ? '#FECDD3' : '#E2E8F0'}`,
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

const tableCardStyle: CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #E5E5E5',
  borderRadius: '12px',
  overflow: 'hidden',
};

const tableToolbarStyle: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #E5E5E5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const headerCellStyle: CSSProperties = {
  height: '40px',
  padding: '0 18px',
  textAlign: 'left',
  fontSize: '12px',
  color: '#94A3B8',
  fontWeight: 500,
  letterSpacing: '0.04em',
  backgroundColor: '#FAFAFA',
};

const bodyCellStyle: CSSProperties = {
  padding: '16px',
  fontSize: '14px',
  color: '#536987',
  borderBottom: '1px solid #F1F5F9',
  verticalAlign: 'middle',
};

function shouldRetryDashboardQuery(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status === 401) {
    return false;
  }

  return failureCount < 3;
}

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export default function DashboardPage() {
  const router = useRouter();
  const { logout, session } = useAuth();
  const isMobile = useMobileBreakpoint();

  const metricsQuery = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: fetchDashboardMetrics,
    retry: shouldRetryDashboardQuery,
  });

  const needsRevisitQuery = useQuery({
    queryKey: ['dashboard', 'needs-revisit'],
    queryFn: () => fetchJobs({ status: 'needs_revisit', page: 1, limit: 8 }),
    retry: shouldRetryDashboardQuery,
  });

  const activeJobsQuery = useQuery({
    queryKey: ['dashboard', 'active-jobs'],
    queryFn: () => fetchJobs({ page: 1, limit: 9 }),
    retry: shouldRetryDashboardQuery,
  });

  const hasUnauthorizedDashboardError =
    isUnauthorizedError(metricsQuery.error) ||
    isUnauthorizedError(needsRevisitQuery.error) ||
    isUnauthorizedError(activeJobsQuery.error);

  useEffect(() => {
    if (session?.user.role === 'technician') {
      router.replace('/jobs');
    }
  }, [session, router]);

  useEffect(() => {
    if (hasUnauthorizedDashboardError) {
      logout();
    }
  }, [hasUnauthorizedDashboardError, logout]);

  const m = metricsQuery.data;
  const needsRevisitJobs = needsRevisitQuery.data?.jobs ?? [];
  const activeJobs = activeJobsQuery.data?.jobs ?? [];

  const kpiCards = [
    { title: 'Total active jobs', value: m ? String(m.totalActiveJobs) : '—', accent: '#737373', hasFill: false, trendKey: 'totalActiveJobs' as const },
    { title: 'Pending schedule', value: m ? String(m.pendingSchedule) : '—', accent: '#94A3B8', hasFill: false, trendKey: 'pendingSchedule' as const },
    { title: 'Amber alerts', value: m ? String(m.amberAlerts) : '—', accent: '#B45309', hasFill: true, trendKey: null },
    { title: 'Chronic jobs', value: m ? String(m.chronicJobs) : '—', accent: '#9F1239', hasFill: true, trendKey: null },
    { title: 'No-shows today', value: m ? String(m.noShowsToday) : '—', accent: '#78716C', hasFill: false, trendKey: null },
  ];

  return (
    <RoleGate allowedRoles={['owner', 'office_staff']}>
      <section style={{ padding: isMobile ? '18px 16px' : '34px 24px 40px', maxWidth: '1400px' }}>
        <div style={{ marginBottom: isMobile ? '22px' : '36px' }}>
          <h1 style={{ fontSize: isMobile ? '30px' : '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>The Control Tower</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 1fr))', gap: isMobile ? '12px' : '12px', marginBottom: isMobile ? '24px' : '32px' }}>
          {kpiCards.map((card) => (
            <KpiCard
              key={card.title}
              title={card.title}
              value={card.value}
              accent={card.accent}
              hasFill={card.hasFill}
              trend={card.trendKey && m ? m.trends[card.trendKey] : undefined}
            />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px' }}>
          {/* Needs Revisit */}
          <div style={tableCardStyle}>
            <div style={tableToolbarStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Needs revisit</span>
                {needsRevisitJobs.length > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: 500, padding: '2px 8px', borderRadius: '9999px', border: '1px solid #FECDD3', backgroundColor: '#FFF1F2', color: '#BE123C' }}>{needsRevisitJobs.length}</span>
                )}
              </div>
              <select
                aria-label="Needs revisit sort"
                defaultValue="chronic"
                style={{
                  height: '30px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  color: '#404040',
                  fontSize: '13px',
                  padding: '0 32px 0 14px',
                }}
              >
                <option value="chronic">Chronic first</option>
              </select>
            </div>
            {needsRevisitJobs.length === 0 ? (
              <div style={{ padding: '20px 18px', fontSize: '14px', color: '#737373' }}>No jobs currently need revisiting.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                  <thead>
                    <tr>
                      {['CUSTOMER', 'BRAND', 'TECHNICIAN', 'LAST VISIT', 'REVISIT #', 'TAGS', ''].map((h) => (
                        <th key={h} style={headerCellStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {needsRevisitJobs.map((job, index) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFAFA'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                      >
                        <td
                          style={{
                            ...bodyCellStyle,
                            color: '#0F172A',
                            fontWeight: 600,
                            borderLeft: job.tags.includes('chronic') ? '2px solid #9F1239' : '2px solid transparent',
                            paddingLeft: '16px',
                          }}
                        >
                          {job.customerName}
                        </td>
                        <td style={bodyCellStyle}>{job.brandName ?? '—'}</td>
                        <td style={bodyCellStyle}>{job.assignedTechnicianName ?? <em style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Unassigned</em>}</td>
                        <td style={{ ...bodyCellStyle, color: '#7E93B2' }}>{formatDayMonth(job.createdAt)}</td>
                        <td style={{ ...bodyCellStyle, color: '#9F1239', fontWeight: 500 }}>#{index + 2}</td>
                        <td style={bodyCellStyle}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {job.tags.includes('chronic') && <JobTag type="chronic" />}
                            {job.tags.includes('frequent') && <JobTag type="frequent" />}
                            {job.tags.includes('repeat') && <JobTag type="repeat" />}
                          </div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: 'right' }}><ChevronRight size={15} strokeWidth={1.5} color="#A3A3A3" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Jobs */}
          <div style={tableCardStyle}>
            <div style={tableToolbarStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Active jobs</span>
                {activeJobs.length > 0 && (
                  <span style={{ fontSize: '14px', color: '#525252' }}>({activeJobs.length})</span>
                )}
              </div>
              <Link href="/jobs" style={{ fontSize: '14px', color: '#2563EB', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View all <ArrowUpRight size={12} strokeWidth={1.5} />
              </Link>
            </div>
            {activeJobs.length === 0 ? (
              <div style={{ padding: '20px 18px', fontSize: '14px', color: '#737373' }}>No active jobs.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                  <thead>
                    <tr>
                      {['CUSTOMER', 'BRAND', 'TECHNICIAN', 'SCHEDULED', 'STATUS', 'TAGS', ''].map((h) => (
                        <th key={h} style={headerCellStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeJobs.map((job, index) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFAFA'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                      >
                        <td
                          style={{
                            ...bodyCellStyle,
                            color: '#0F172A',
                            fontWeight: 600,
                            borderLeft: job.tags.includes('chronic') ? '2px solid #9F1239' : '2px solid transparent',
                            paddingLeft: '16px',
                          }}
                        >
                          {job.customerName}
                        </td>
                        <td style={bodyCellStyle}>{job.brandName ?? '—'}</td>
                        <td style={{ ...bodyCellStyle, color: job.assignedTechnicianName ? '#536987' : '#9CA3AF', fontStyle: job.assignedTechnicianName ? 'normal' : 'italic' }}>
                          {job.assignedTechnicianName ?? 'Unassigned'}
                        </td>
                        <td style={{ ...bodyCellStyle, color: '#7E93B2' }}>
                          {formatShortDateTime(job.scheduledAt)}
                        </td>
                        <td style={bodyCellStyle}><StatusChip status={job.status} /></td>
                        <td style={bodyCellStyle}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {job.tags.includes('chronic') && <JobTag type="chronic" />}
                            {job.tags.includes('frequent') && <JobTag type="frequent" />}
                            {job.tags.includes('repeat') && <JobTag type="repeat" />}
                          </div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: 'right' }}><ChevronRight size={15} strokeWidth={1.5} color="#A3A3A3" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </RoleGate>
  );
}
