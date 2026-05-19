import { describe, expect, it, jest } from '@jest/globals';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService Phase 08', () => {
  it('processes events with org-scoped query and idempotent ledger insert', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        if (text.includes('FROM job_timeline jt')) {
          return {
            rows: [
              {
                id: 'evt-1',
                event_type: 'payment_recorded',
                job_id: 'job-1',
                occurred_at: '2026-05-05T00:00:00.000Z',
                new_value: { amount: 1200 },
              },
            ],
            rowCount: 1,
          };
        }

        if (text.includes('FROM jobs')) {
          return {
            rows: [
              {
                id: 'job-1',
                organization_id: 'org-1',
                technician_id: 'tech-1',
                brand_id: 'brand-1',
                dealer_id: 'dealer-1',
                type: 'complaint',
                source: 'via_dealer',
              },
            ],
            rowCount: 1,
          };
        }

        return { rows: [], rowCount: 0, params };
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(async () => ({ rows: [{ deleted: 0 }], rowCount: 1 })),
    };

    const service = new AnalyticsService(db as never);

    await expect(service.processOrgEvents('org-1', 500)).resolves.toEqual({ processed: 1 });

    const firstCall = (fakeClient.query as jest.Mock).mock.calls[0];
    expect((firstCall[0] as string)).toContain('jt.organization_id = $1');
    expect(firstCall[1]).toEqual(['org-1', 500]);

    const ledgerInsert = (fakeClient.query as jest.Mock).mock.calls.find((call: unknown[]) =>
      (call[0] as string).includes('analytics_processed_events') &&
      (call[0] as string).includes('ON CONFLICT (timeline_event_id) DO NOTHING'),
    );
    expect(ledgerInsert).toBeDefined();
  });

  it('purges processed event rows through purge function', async () => {
    const db = {
      withTransaction: jest.fn(),
      query: jest.fn(async () => ({ rows: [{ deleted: 12 }], rowCount: 1 })),
    };

    const service = new AnalyticsService(db as never);
    await expect(service.purgeProcessedEvents()).resolves.toEqual({ deleted: 12 });
  });

  it('processes review_submitted and computes avg star ratings when mode is optional', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM job_timeline jt')) {
          return {
            rows: [
              {
                id: 'evt-r1',
                event_type: 'review_submitted',
                job_id: 'job-1',
                occurred_at: '2026-05-08T10:00:00.000Z',
                new_value: { starRating: 4, isLowRated: false },
              },
            ],
            rowCount: 1,
          };
        }

        if (text.includes('FROM jobs')) {
          return {
            rows: [
              {
                id: 'job-1',
                organization_id: 'org-1',
                technician_id: 'tech-1',
                brand_id: 'brand-1',
                dealer_id: null,
                type: 'complaint',
                source: 'direct',
              },
            ],
            rowCount: 1,
          };
        }

        if (text.includes("FROM system_config") && text.includes("customer_review_mode")) {
          return { rows: [{ value: 'optional' }], rowCount: 1 };
        }

        if (text.includes('SELECT AVG(cr.star_rating)::numeric(4,2) AS avg')) {
          if (text.includes('AND j.technician_id = $3')) {
            return { rows: [{ avg: '4.00' }], rowCount: 1 };
          }
          if (text.includes('AND j.brand_id = $3')) {
            return { rows: [{ avg: '4.00' }], rowCount: 1 };
          }
          return { rows: [{ avg: '4.00' }], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(async () => ({ rows: [{ deleted: 0 }], rowCount: 1 })),
    };

    const service = new AnalyticsService(db as never);
    await expect(service.processOrgEvents('org-1', 50)).resolves.toEqual({ processed: 1 });

    const upsertBusiness = (fakeClient.query as jest.Mock).mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' &&
      (call[0] as string).includes('INSERT INTO analytics_business_daily') &&
      (call[0] as string).includes('avg_star_rating'),
    );
    expect(upsertBusiness).toBeDefined();
  });

  it('forces avg_star_rating to NULL when customer_review_mode is off', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM job_timeline jt')) {
          return {
            rows: [
              {
                id: 'evt-r2',
                event_type: 'review_submitted',
                job_id: 'job-2',
                occurred_at: '2026-05-08T11:00:00.000Z',
                new_value: { starRating: 1, isLowRated: true },
              },
            ],
            rowCount: 1,
          };
        }

        if (text.includes('FROM jobs')) {
          return {
            rows: [
              {
                id: 'job-2',
                organization_id: 'org-2',
                technician_id: 'tech-2',
                brand_id: 'brand-2',
                dealer_id: null,
                type: 'complaint',
                source: 'direct',
              },
            ],
            rowCount: 1,
          };
        }

        if (text.includes("FROM system_config") && text.includes("customer_review_mode")) {
          return { rows: [{ value: 'off' }], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(async () => ({ rows: [{ deleted: 0 }], rowCount: 1 })),
    };

    const service = new AnalyticsService(db as never);
    await expect(service.processOrgEvents('org-2', 50)).resolves.toEqual({ processed: 1 });

    const nullBusinessUpdate = (fakeClient.query as jest.Mock).mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' &&
      (call[0] as string).includes('UPDATE analytics_business_daily') &&
      (call[0] as string).includes('avg_star_rating = NULL'),
    );
    expect(nullBusinessUpdate).toBeDefined();
  });
});
