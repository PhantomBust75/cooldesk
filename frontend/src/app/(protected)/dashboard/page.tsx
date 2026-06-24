'use client';

import { RoleGate } from '@/components/auth/role-gate';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { fetchDashboardMetrics } from '@/lib/api/dashboard';
import { fetchJobs } from '@/lib/api/jobs';
import { StatusChip } from '@/components/ui/status-chip';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMobileBreakpoint } from '@/hooks/use-mobile-breakpoint';

const TAG_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  chronic: { bg: '#FEE2E2', color: '#991B1B', label: 'Chronic' },
  frequent: { bg: '#FEF3C7', color: '#92400E', label: 'Frequent' },
  repeat: { bg: '#F5F5F5', color: '#525252', label: 'Repeat' },
};

function JobTag({ type }: { type: keyof typeof TAG_STYLES }) {
  const s = TAG_STYLES[type];
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '9999px', fontSize: '11px', fontWeight: 500, backgroundColor: s.bg, color: s.color, marginRight: '4px' }}>
      {s.label}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const isMobile = useMobileBreakpoint();

  const metricsQuery = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: fetchDashboardMetrics,
  });

  const needsRevisitQuery = useQuery({
    queryKey: ['dashboard', 'needs-revisit'],
    queryFn: () => fetchJobs({ status: 'needs_revisit', page: 1, limit: 8 }),
  });

  const activeJobsQuery = useQuery({
    queryKey: ['dashboard', 'active-jobs'],
    queryFn: () => fetchJobs({ page: 1, limit: 9 }),
  });

  const m = metricsQuery.data;
  const needsRevisitJobs = needsRevisitQuery.data?.jobs ?? [];
  const activeJobs = activeJobsQuery.data?.jobs ?? [];

  const kpiCards = [
    { title: 'Total active jobs', value: m ? String(m.totalActiveJobs) : '—', accent: '#0A0A0A', trendKey: 'totalActiveJobs' as const },
    { title: 'Pending schedule', value: m ? String(m.pendingSchedule) : '—', accent: '#3B82F6', trendKey: 'pendingSchedule' as const },
    { title: 'Amber alerts', value: m ? String(m.amberAlerts) : '—', accent: '#F59E0B', trendKey: null },
    { title: 'Chronic jobs', value: m ? String(m.chronicJobs) : '—', accent: '#EF4444', trendKey: null },
    { title: 'No-shows today', value: m ? String(m.noShowsToday) : '—', accent: '#8B5CF6', trendKey: null },
  ];

  return (
    <RoleGate allowedRoles={['owner', 'office_staff', 'technician', 'dealer']}>
      <section style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1400px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>The Control Tower</h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>Organization-wide overview · last 7 days</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {kpiCards.map((card) => (
            <KpiCard
              key={card.title}
              title={card.title}
              value={card.value}
              accent={card.accent}
              trend={card.trendKey && m ? m.trends[card.trendKey] : undefined}
            />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px' }}>
          {/* Needs Revisit */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Needs revisit</span>
                {needsRevisitJobs.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px', backgroundColor: '#FEE2E2', color: '#991B1B' }}>{needsRevisitJobs.length}</span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#737373' }}>Chronic first</span>
            </div>
            {needsRevisitJobs.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: '13px', color: '#737373' }}>No jobs currently need revisiting.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                      {['CUSTOMER', 'BRAND', 'TECHNICIAN', 'LAST VISIT', 'REVISIT #', 'TAGS', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#737373', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {needsRevisitJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer', borderLeft: '3px solid transparent' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFAFA'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#171717', fontWeight: 500 }}>{job.customerName}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>{job.brandName ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>{job.assignedTechnicianName ?? <em style={{ color: '#A3A3A3', fontStyle: 'italic' }}>Unassigned</em>}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#737373' }}>{new Date(job.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>—</td>
                        <td style={{ padding: '12px 16px' }}>
                          {job.source === 'via_dealer' && <JobTag type="repeat" />}
                        </td>
                        <td style={{ padding: '12px 16px' }}><ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Jobs */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Active jobs</span>
                {activeJobs.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px', backgroundColor: '#F5F5F5', color: '#525252' }}>{activeJobs.length}</span>
                )}
              </div>
              <Link href="/jobs" style={{ fontSize: '12px', color: '#525252', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View all <ArrowUpRight size={12} strokeWidth={1.5} />
              </Link>
            </div>
            {activeJobs.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: '13px', color: '#737373' }}>No active jobs.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                      {['CUSTOMER', 'BRAND', 'TECHNICIAN', 'SCHEDULED', 'STATUS', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#737373', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFAFA'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#171717', fontWeight: 500 }}>{job.customerName}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#404040' }}>{job.brandName ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: job.assignedTechnicianName ? '#404040' : '#A3A3A3', fontStyle: job.assignedTechnicianName ? 'normal' : 'italic' }}>
                          {job.assignedTechnicianName ?? 'Unassigned'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#737373' }}>
                          {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}><StatusChip status={job.status} /></td>
                        <td style={{ padding: '12px 16px' }}><ChevronRight size={14} strokeWidth={1.5} color="#A3A3A3" /></td>
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
