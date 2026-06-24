import { describe, expect, it, jest } from '@jest/globals';
import { DashboardService } from './dashboard.service';
import { RequestContext } from '../security/request-context';

describe('DashboardService Phase 07 owner dashboard', () => {
  const ctx: RequestContext = {
    organizationId: 'org-1',
    userId: 'owner-1',
    role: 'owner',
  };

  it('applies brand filter within organization on analytics query', async () => {
    const db = {
      query: jest.fn(async (text: string) => ({
        rows: text.includes('analytics_brand_daily') ? [{ brand_id: 'brand-1' }] : [],
        rowCount: 1,
      })),
    };

    const service = new DashboardService(db as never, {} as never);
    await service.getOwnerDashboard({ brandId: 'brand-1', limit: 10 }, ctx);

    const brandCall = (db.query as jest.Mock).mock.calls.find((call: unknown[]) =>
      (call[0] as string).includes('analytics_brand_daily'),
    );
    expect(brandCall).toBeDefined();
    expect(brandCall?.[1]).toEqual(['org-1', 'brand-1']);
  });
});
