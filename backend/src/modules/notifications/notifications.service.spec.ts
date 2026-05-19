import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { NotificationsService } from './notifications.service';
import { DealerRequestContext, RequestContext } from '../security/request-context';

describe('NotificationsService org-scoped access', () => {
  const userCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'user-1',
    role: 'owner',
  };

  const dealerCtx: DealerRequestContext = {
    organizationId: 'org-1',
    dealerId: 'dealer-1',
  };

  it('counts unread user notifications within organization', async () => {
    const db = {
      query: jest.fn(async (_text: string, params?: unknown[]) => ({
        rows: [{ count: '4' }],
        rowCount: 1,
        params,
      })),
    };

    const service = new NotificationsService(db as never);
    await expect(service.getUserUnreadCount(userCtx)).resolves.toEqual({ count: 4 });
    expect((db.query as jest.Mock).mock.calls[0][1]).toEqual(['org-1', 'user-1']);
  });

  it('marks user notification read with org and recipient scope', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [], rowCount: 1 })),
    };

    const service = new NotificationsService(db as never);
    await expect(service.markUserNotificationRead('notif-1', userCtx)).resolves.toEqual({ ok: true });

    const sql = (db.query as jest.Mock).mock.calls[0][0] as string;
    const params = (db.query as jest.Mock).mock.calls[0][1] as unknown[];
    expect(sql).toContain('read_at = NOW()');
    expect(params).toEqual(['notif-1', 'org-1', 'user-1']);
  });

  it('throws when dealer notification is not found in current organization', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
    };

    const service = new NotificationsService(db as never);
    await expect(service.markDealerNotificationRead('notif-x', dealerCtx)).rejects.toBeInstanceOf(NotFoundException);
  });
});
