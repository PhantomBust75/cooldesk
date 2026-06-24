import { apiClient } from '@/lib/api/client';

type UnknownRecord = Record<string, unknown>;

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value); return Number.isNaN(n) ? fallback : n; }
  return fallback;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asNumber(v));
}

export type DashboardMetrics = {
  totalActiveJobs: number;
  pendingSchedule: number;
  amberAlerts: number;
  chronicJobs: number;
  noShowsToday: number;
  trends: {
    totalActiveJobs: number[];
    pendingSchedule: number[];
  };
};

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const payload = await apiClient.get<UnknownRecord>('/dashboard/metrics');
  const trends = (payload.trends ?? {}) as UnknownRecord;
  return {
    totalActiveJobs: asNumber(payload.totalActiveJobs ?? payload.total_active_jobs),
    pendingSchedule: asNumber(payload.pendingSchedule ?? payload.pending_schedule),
    amberAlerts: asNumber(payload.amberAlerts ?? payload.amber_alerts),
    chronicJobs: asNumber(payload.chronicJobs ?? payload.chronic_jobs),
    noShowsToday: asNumber(payload.noShowsToday ?? payload.no_shows_today),
    trends: {
      totalActiveJobs: asNumberArray(trends.totalActiveJobs ?? trends.total_active_jobs),
      pendingSchedule: asNumberArray(trends.pendingSchedule ?? trends.pending_schedule),
    },
  };
}
