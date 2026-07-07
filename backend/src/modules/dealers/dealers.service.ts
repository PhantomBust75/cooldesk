import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync } from 'crypto';
import { DatabaseService } from '../../shared/database.service';
import { DealerRequestContext, RequestContext } from '../security/request-context';
import {
  CreateDealerDto,
  DealerHistoryQueryDto,
  UpdateDealerBrandsDto,
  UpdateDealerProfileDto,
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
        d.contact_name,
        d.email,
        d.phone,
        d.region,
        d.is_active,
        d.created_at,
        COALESCE(
          ARRAY_AGG(db.brand_id ORDER BY db.brand_id) FILTER (WHERE db.brand_id IS NOT NULL),
          ARRAY[]::UUID[]
        ) AS brand_ids
      FROM dealers d
      LEFT JOIN dealer_brands db ON db.dealer_id = d.id AND db.organization_id = d.organization_id
      WHERE d.organization_id = $1
        AND d.is_deleted = FALSE
      GROUP BY d.id, d.name, d.contact_name, d.email, d.phone, d.region, d.is_active, d.created_at
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
        INSERT INTO dealers (organization_id, name, contact_name, email, region, is_active, is_deleted)
        VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)
        RETURNING id
        `,
        [ctx.organizationId, input.name.trim(), input.contactName?.trim() ?? null, input.email.trim(), input.region?.trim() ?? null],
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
      SELECT j.id, j.type, j.status, j.source, j.brand_id, j.customer_name, j.phone, j.address,
             j.issue_description, j.installation_notes, j.scheduled_at, j.created_at, j.updated_at,
             b.name AS brand_name, b.color_hex AS brand_color,
             u.full_name AS technician_name
      FROM jobs j
      LEFT JOIN brands b ON b.id = j.brand_id AND b.organization_id = j.organization_id
      LEFT JOIN users u ON u.id = j.technician_id AND u.organization_id = j.organization_id
      WHERE j.id = $1
        AND j.organization_id = $2
        AND j.dealer_id = $3
        AND j.source = 'via_dealer'
        AND j.is_deleted = FALSE
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
      SELECT j.id, j.type, j.status, j.brand_id, j.customer_name, j.phone,
             j.scheduled_at, j.created_at, j.updated_at,
             b.name AS brand_name, b.color_hex AS brand_color
      FROM jobs j
      LEFT JOIN brands b ON b.id = j.brand_id AND b.organization_id = j.organization_id
      WHERE j.organization_id = $1
        AND j.dealer_id = $2
        AND j.source = 'via_dealer'
        AND j.is_deleted = FALSE
      ORDER BY j.created_at DESC
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

  async listDealerJobsForOffice(
    dealerId: string,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>[]> {
    const dealerCheck = await this.db.query<{ id: string }>(
      `SELECT id FROM dealers WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE LIMIT 1`,
      [dealerId, ctx.organizationId],
    );

    if (dealerCheck.rows.length === 0) {
      throw new NotFoundException('Dealer not found');
    }

    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.type,
        j.status,
        j.customer_name,
        j.created_at,
        j.scheduled_at,
        j.address,
        u.full_name AS technician_name,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'collected'), 0) AS amount_collected
      FROM jobs j
      LEFT JOIN users u
        ON u.id = j.technician_id AND u.is_deleted = FALSE
      LEFT JOIN payments p
        ON p.job_id = j.id AND p.organization_id = j.organization_id AND p.is_deleted = FALSE
      WHERE j.dealer_id = $1
        AND j.organization_id = $2
        AND j.is_deleted = FALSE
      GROUP BY j.id, j.type, j.status, j.customer_name, j.created_at, j.scheduled_at, j.address, u.full_name
      ORDER BY j.created_at DESC
      LIMIT 200
      `,
      [dealerId, ctx.organizationId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async getDealerBrandsForOffice(
    dealerId: string,
    ctx: RequestContext,
  ): Promise<{ brandIds: string[] }> {
    const result = await this.db.query<{ brand_id: string }>(
      `
      SELECT db.brand_id
      FROM dealer_brands db
      INNER JOIN dealers d ON d.id = db.dealer_id AND d.organization_id = db.organization_id
      WHERE db.organization_id = $1
        AND db.dealer_id = $2
        AND d.is_deleted = FALSE
      `,
      [ctx.organizationId, dealerId],
    );
    return { brandIds: result.rows.map((r) => r.brand_id) };
  }

  async updateDealerProfile(
    dealerId: string,
    input: UpdateDealerProfileDto,
    ctx: RequestContext,
  ): Promise<{ ok: true }> {
    if (ctx.role !== 'owner') {
      throw new ForbiddenException('Only owner can update dealers');
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [dealerId, ctx.organizationId];

    if (input.name !== undefined) {
      params.push(input.name.trim());
      setClauses.push(`name = $${params.length}`);
    }

    if (input.contactName !== undefined) {
      params.push(input.contactName.trim());
      setClauses.push(`contact_name = $${params.length}`);
    }

    if (input.email !== undefined) {
      params.push(input.email.trim());
      setClauses.push(`email = $${params.length}`);
    }

    if (input.phone !== undefined) {
      params.push(input.phone.trim());
      setClauses.push(`phone = $${params.length}`);
    }

    if (input.region !== undefined) {
      params.push(input.region.trim());
      setClauses.push(`region = $${params.length}`);
    }

    const update = await this.db.query<{ id: string }>(
      `
      UPDATE dealers
      SET ${setClauses.join(', ')}
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      RETURNING id
      `,
      params,
    );

    if (update.rows.length === 0) {
      throw new NotFoundException('Dealer not found');
    }

    return { ok: true };
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }
}
