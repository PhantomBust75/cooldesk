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

export async function fetchAnalyticsDaily(days = 7): Promise<AnalyticsDailyItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/business/daily?days=${days}`);
  return rows.map((row) => ({
    date: asString(row.date),
    revenue: asNumber(row.revenue),
    total: asNumber(row.total),
    completed: asNumber(row.completed),
  }));
}
