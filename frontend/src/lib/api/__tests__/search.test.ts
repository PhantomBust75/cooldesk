import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchJobs } from '../search';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../client';

describe('searchJobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array for blank query without calling API', async () => {
    const result = await searchJobs('');
    expect(result.jobs).toHaveLength(0);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('maps snake_case response to camelCase', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      jobs: [{ id: 'JOB-001', customer_name: 'Ahmed', status: 'scheduled' }],
    });
    const result = await searchJobs('Ahmed');
    expect(result.jobs[0]).toEqual({ id: 'JOB-001', customerName: 'Ahmed', status: 'scheduled' });
  });
});
