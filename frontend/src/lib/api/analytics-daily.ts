import { apiClient } from '@/lib/api/client';
import type { AnalyticsDailyItem } from '@/types/operations';

type UnknownRecord = Record<string, unknown>;

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export async function fetchAnalyticsDaily(range: { dateFrom?: string; dateTo?: string } = {}): Promise<AnalyticsDailyItem[]> {
  const params = new URLSearchParams();
  if (range.dateFrom) params.set('dateFrom', range.dateFrom);
  if (range.dateTo) params.set('dateTo', range.dateTo);
  const query = params.toString();
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/business/daily${query ? `?${query}` : ''}`);
  return rows.map((row) => ({
    date: asString(row.date),
    revenue: asNumber(row.revenue),
    total: asNumber(row.total),
    completed: asNumber(row.completed),
  }));
}
