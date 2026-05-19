import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { DealersService } from './dealers.service';
import { DealerRequestContext } from '../security/request-context';

describe('DealersService Phase 08 tenant isolation', () => {
  const dealerCtx: DealerRequestContext = {
    organizationId: 'org-a',
    dealerId: 'dealer-a',
  };

  it('cannot fetch cross-org dealer job by id', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
      withTransaction: jest.fn(),
    };

    const service = new DealersService(db as never);
    await expect(service.getDealerJobById('job-from-org-b', dealerCtx)).rejects.toBeInstanceOf(NotFoundException);

    const params = (db.query as jest.Mock).mock.calls[0][1] as unknown[];
    expect(params).toEqual(['job-from-org-b', 'org-a', 'dealer-a']);
  });

  it('lists dealer history with org + dealer filters', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [{ id: 'job-1' }], rowCount: 1 })),
      withTransaction: jest.fn(),
    };

    const service = new DealersService(db as never);
    await expect(service.listDealerHistory({ limit: 50 }, dealerCtx)).resolves.toEqual([{ id: 'job-1' }]);

    const params = (db.query as jest.Mock).mock.calls[0][1] as unknown[];
    expect(params).toEqual(['org-a', 'dealer-a', 50]);
  });
});
