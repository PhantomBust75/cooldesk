import { apiClient } from '@/lib/api/client';

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export type SearchJobResult = {
  id: string;
  customerName: string;
  status: string;
};

export type SearchResults = {
  jobs: SearchJobResult[];
};

export async function searchJobs(q: string, limit = 10): Promise<SearchResults> {
  if (!q.trim()) return { jobs: [] };
  try {
    const payload = await apiClient.get<{ jobs: UnknownRecord[] }>('/search', { params: { q: q.trim(), limit } });
    return {
      jobs: (payload.jobs ?? []).map((row) => ({
        id: asString(row.id),
        customerName: asString(row.customerName ?? row.customer_name),
        status: asString(row.status),
      })),
    };
  } catch (err) {
    console.error('[searchJobs] failed:', err);
    return { jobs: [] };
  }
}
