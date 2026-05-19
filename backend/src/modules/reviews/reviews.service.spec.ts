import { ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { ReviewsService } from './reviews.service';

describe('ReviewsService Phase 10', () => {
  it('returns 404 when token is not found', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM customer_reviews') && text.includes('WHERE review_token = $1')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(),
    };

    const service = new ReviewsService(db as never);
    await expect(service.submitByToken('missing-token', { rating: 5 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 when token was already submitted', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM customer_reviews') && text.includes('WHERE review_token = $1')) {
          return {
            rows: [{
              id: 'rev-1',
              job_id: 'job-1',
              organization_id: 'org-1',
              review_token: 'token-1',
              expires_at: '2030-01-01T00:00:00.000Z',
              submitted_at: '2026-05-08T00:00:00.000Z',
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(),
    };

    const service = new ReviewsService(db as never);
    await expect(service.submitByToken('token-1', { rating: 3 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 410 when token is expired', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM customer_reviews') && text.includes('WHERE review_token = $1')) {
          return {
            rows: [{
              id: 'rev-1',
              job_id: 'job-1',
              organization_id: 'org-1',
              review_token: 'token-1',
              expires_at: '2026-05-01T00:00:00.000Z',
              submitted_at: null,
            }],
            rowCount: 1,
          };
        }

        if (text.includes('UPDATE customer_reviews') && text.includes('expires_at > NOW()')) {
          return { rows: [], rowCount: 0 };
        }

        return { rows: [], rowCount: 0 };
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(),
    };

    const service = new ReviewsService(db as never);
    await expect(service.submitByToken('token-1', { rating: 2, comment: 'Too late' })).rejects.toBeInstanceOf(GoneException);
  });

  it('dispatches low_rating_received within token org when low-rated submitted', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM customer_reviews') && text.includes('WHERE review_token = $1')) {
          return {
            rows: [{
              id: 'rev-1',
              job_id: 'job-1',
              organization_id: 'org-a',
              review_token: 'token-1',
              expires_at: '2030-01-01T00:00:00.000Z',
              submitted_at: null,
            }],
            rowCount: 1,
          };
        }

        if (text.includes('UPDATE customer_reviews') && text.includes('RETURNING job_id, organization_id, is_low_rated')) {
          return {
            rows: [{ job_id: 'job-1', organization_id: 'org-a', is_low_rated: true }],
            rowCount: 1,
          };
        }

        if (text.includes('FROM users') && text.includes("role IN ('owner', 'office_staff')")) {
          return {
            rows: [{ id: 'owner-1' }, { id: 'staff-1' }],
            rowCount: 2,
          };
        }

        return { rows: [], rowCount: 0 };
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(),
    };

    const service = new ReviewsService(db as never);

    await expect(service.submitByToken('token-1', { rating: 1, comment: 'bad' })).resolves.toMatchObject({
      ok: true,
      organizationId: 'org-a',
      isLowRated: true,
    });

    const notifCalls = (fakeClient.query as jest.Mock).mock.calls.filter((call: unknown[]) =>
      typeof call[0] === 'string' &&
      (call[0] as string).includes('INSERT INTO notifications'),
    );
    expect(notifCalls.length).toBe(2);

    for (const call of notifCalls) {
      const params = call[1] as unknown[];
      expect(params[0]).toBe('org-a');
      expect(params[1]).toBe('low_rating_received');
      expect(params[2]).toBe('job-1');
    }
  });
});
