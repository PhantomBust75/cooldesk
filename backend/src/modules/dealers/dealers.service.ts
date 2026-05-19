import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync } from 'crypto';
import { DatabaseService } from '../../shared/database.service';
import { DealerRequestContext, RequestContext } from '../security/request-context';
import {
  CreateDealerDto,
  DealerHistoryQueryDto,
  UpdateDealerBrandsDto,
  UpdateDealerStatusDto,
} from './dealers.dto';

@Injectable()
export class DealersService {
  constructor(private readonly db: DatabaseService) {}

  async listDealers(ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT
        d.id,
        d.name,
        ''::text AS phone,
        d.is_active,
        d.created_at
      FROM dealers d
      WHERE d.organization_id = $1
        AND d.is_deleted = FALSE
      ORDER BY d.name ASC
      `,
      [ctx.organizationId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async createDealer(
    input: CreateDealerDto,
    ctx: RequestContext,
  ): Promise<{ dealerId: string }> {
    if (ctx.role !== 'owner') {
      throw new ForbiddenException('Only owner can create dealers');
    }

    return this.db.withTransaction(async (client) => {
      const insert = await client.query<{ id: string }>(
        `
        INSERT INTO dealers (organization_id, name, is_active, is_deleted)
        VALUES ($1, $2, TRUE, FALSE)
        RETURNING id
        `,
        [ctx.organizationId, input.name.trim()],
      );

      const dealerId = insert.rows[0].id;
      const passwordHash = this.hashPassword(input.password);

      await client.query(
        `
        INSERT INTO dealer_credentials (dealer_id, password_hash)
        VALUES ($1, $2)
        `,
        [dealerId, passwordHash],
      );

      if (input.brandIds?.length) {
        await this.assertBrandsInOrganization(client, input.brandIds, ctx.organizationId);
        for (const brandId of input.brandIds) {
          await client.query(
            `
            INSERT INTO dealer_brands (dealer_id, brand_id, organization_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            `,
            [dealerId, brandId, ctx.organizationId],
          );
        }
      }

      return { dealerId };
    });
  }

  async updateDealerStatus(
    dealerId: string,
    input: UpdateDealerStatusDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; isActive: boolean }> {
    if (ctx.role !== 'owner') {
      throw new ForbiddenException('Only owner can update dealers');
    }

    const update = await this.db.query<{ is_active: boolean }>(
      `
      UPDATE dealers
      SET is_active = $3,
          updated_at = NOW()
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      RETURNING is_active
      `,
      [dealerId, ctx.organizationId, input.isActive],
    );

    if (update.rows.length === 0) {
      throw new NotFoundException('Dealer not found');
    }

    return { ok: true, isActive: update.rows[0].is_active };
  }

  async setDealerBrands(
    dealerId: string,
    input: UpdateDealerBrandsDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; brandCount: number }> {
    if (ctx.role !== 'owner') {
      throw new ForbiddenException('Only owner can update dealer brands');
    }

    return this.db.withTransaction(async (client) => {
      const dealer = await client.query<{ id: string }>(
        `
        SELECT id
        FROM dealers
        WHERE id = $1
          AND organization_id = $2
          AND is_deleted = FALSE
        LIMIT 1
        `,
        [dealerId, ctx.organizationId],
      );

      if (dealer.rows.length === 0) {
        throw new NotFoundException('Dealer not found');
      }

      await this.assertBrandsInOrganization(client, input.brandIds, ctx.organizationId);

      await client.query(
        `
        DELETE FROM dealer_brands
        WHERE dealer_id = $1
          AND organization_id = $2
        `,
        [dealerId, ctx.organizationId],
      );

      for (const brandId of input.brandIds) {
        await client.query(
          `
          INSERT INTO dealer_brands (dealer_id, brand_id, organization_id)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
          `,
          [dealerId, brandId, ctx.organizationId],
        );
      }

      return { ok: true, brandCount: input.brandIds.length };
    });
  }

  async listDealerLinkedBrands(ctx: DealerRequestContext): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT b.id, b.name
      FROM dealer_brands db
      INNER JOIN brands b
        ON b.id = db.brand_id
       AND b.organization_id = db.organization_id
      INNER JOIN dealers d
        ON d.id = db.dealer_id
       AND d.organization_id = db.organization_id
      WHERE db.organization_id = $1
        AND db.dealer_id = $2
        AND b.is_active = TRUE
        AND b.is_deleted = FALSE
        AND d.is_active = TRUE
        AND d.is_deleted = FALSE
      ORDER BY b.name ASC
      `,
      [ctx.organizationId, ctx.dealerId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async getDealerJobById(
    jobId: string,
    ctx: DealerRequestContext,
  ): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `
      SELECT id, type, status, source, brand_id, customer_name, phone, address,
             issue_description, installation_notes, scheduled_at, created_at, updated_at
      FROM jobs
      WHERE id = $1
        AND organization_id = $2
        AND dealer_id = $3
        AND source = 'via_dealer'
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [jobId, ctx.organizationId, ctx.dealerId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Dealer job not found');
    }

    return result.rows[0] as Record<string, unknown>;
  }

  async listDealerHistory(
    query: DealerHistoryQueryDto,
    ctx: DealerRequestContext,
  ): Promise<Record<string, unknown>[]> {
    const limit = query.limit ?? 100;
    const result = await this.db.query(
      `
      SELECT id, type, status, brand_id, customer_name, phone, scheduled_at, created_at, updated_at
      FROM jobs
      WHERE organization_id = $1
        AND dealer_id = $2
        AND source = 'via_dealer'
        AND is_deleted = FALSE
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [ctx.organizationId, ctx.dealerId, limit],
    );

    return result.rows as Record<string, unknown>[];
  }

  async getDealerDailyAnalytics(
    date: string | undefined,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>[]> {
    if (!(ctx.role === 'owner' || ctx.role === 'office_staff')) {
      throw new ForbiddenException('Only owner or office staff can read dealer analytics');
    }

    const params: unknown[] = [ctx.organizationId];
    let dateFilter = '';
    if (date) {
      params.push(date);
      dateFilter = `AND add.metric_date = $${params.length}::date`;
    }

    const result = await this.db.query(
      `
      SELECT add.metric_date, add.dealer_id, d.name AS dealer_name,
             add.jobs_submitted, add.complaints_submitted, add.installations_submitted,
             add.resolved_count, add.pending_count, add.jobs_cancelled, add.avg_resolution_mins
      FROM analytics_dealer_daily add
      LEFT JOIN dealers d
        ON d.id = add.dealer_id
       AND d.organization_id = add.organization_id
      WHERE add.organization_id = $1
        ${dateFilter}
      ORDER BY add.metric_date DESC, d.name ASC NULLS LAST
      LIMIT 500
      `,
      params,
    );

    return result.rows as Record<string, unknown>[];
  }

  private async assertBrandsInOrganization(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ id: string }> }> },
    brandIds: string[],
    organizationId: string,
  ): Promise<void> {
    if (brandIds.length === 0) {
      return;
    }

    const result = await client.query(
      `
      SELECT id
      FROM brands
      WHERE organization_id = $1
        AND is_deleted = FALSE
        AND id = ANY($2::uuid[])
      `,
      [organizationId, brandIds],
    );

    if (result.rows.length !== brandIds.length) {
      throw new BadRequestException('One or more brands are invalid or cross-organization');
    }
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }
}
