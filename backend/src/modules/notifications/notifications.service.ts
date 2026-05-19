import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { DealerRequestContext, RequestContext } from '../security/request-context';
import { ListNotificationsQueryDto } from './notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async listUserNotifications(
    query: ListNotificationsQueryDto,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>[]> {
    const limit = query.limit ?? 50;
    const params: unknown[] = [ctx.organizationId, ctx.userId, limit];
    const unreadClause = query.unreadOnly ? 'AND is_read = FALSE' : '';

    const result = await this.db.query(
      `
      SELECT id, event_type, job_id, payload, is_read, read_at, created_at
      FROM notifications
      WHERE organization_id = $1
        AND recipient_user_id = $2
        ${unreadClause}
      ORDER BY created_at DESC
      LIMIT $3
      `,
      params,
    );

    return result.rows as Record<string, unknown>[];
  }

  async getUserUnreadCount(ctx: RequestContext): Promise<{ count: number }> {
    const result = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM notifications
      WHERE organization_id = $1
        AND recipient_user_id = $2
        AND is_read = FALSE
      `,
      [ctx.organizationId, ctx.userId],
    );

    return { count: Number.parseInt(result.rows[0]?.count ?? '0', 10) };
  }

  async markUserNotificationRead(notificationId: string, ctx: RequestContext): Promise<{ ok: true }> {
    const update = await this.db.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = NOW()
      WHERE id = $1
        AND organization_id = $2
        AND recipient_user_id = $3
      `,
      [notificationId, ctx.organizationId, ctx.userId],
    );

    if ((update.rowCount ?? 0) === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { ok: true };
  }

  async listDealerNotifications(
    query: ListNotificationsQueryDto,
    ctx: DealerRequestContext,
  ): Promise<Record<string, unknown>[]> {
    const limit = query.limit ?? 50;
    const params: unknown[] = [ctx.organizationId, ctx.dealerId, limit];
    const unreadClause = query.unreadOnly ? 'AND is_read = FALSE' : '';

    const result = await this.db.query(
      `
      SELECT id, event_type, job_id, payload, is_read, read_at, created_at
      FROM notifications
      WHERE organization_id = $1
        AND recipient_dealer_id = $2
        ${unreadClause}
      ORDER BY created_at DESC
      LIMIT $3
      `,
      params,
    );

    return result.rows as Record<string, unknown>[];
  }

  async getDealerUnreadCount(ctx: DealerRequestContext): Promise<{ count: number }> {
    const result = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM notifications
      WHERE organization_id = $1
        AND recipient_dealer_id = $2
        AND is_read = FALSE
      `,
      [ctx.organizationId, ctx.dealerId],
    );

    return { count: Number.parseInt(result.rows[0]?.count ?? '0', 10) };
  }

  async markDealerNotificationRead(
    notificationId: string,
    ctx: DealerRequestContext,
  ): Promise<{ ok: true }> {
    const update = await this.db.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = NOW()
      WHERE id = $1
        AND organization_id = $2
        AND recipient_dealer_id = $3
      `,
      [notificationId, ctx.organizationId, ctx.dealerId],
    );

    if ((update.rowCount ?? 0) === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { ok: true };
  }
}
