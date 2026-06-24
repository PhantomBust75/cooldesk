import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { CreateServiceItemDto, UpdateServiceItemDto } from './service-items.dto';

@Injectable()
export class ServiceItemsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(ctx: RequestContext): Promise<unknown[]> {
    const result = await this.db.query(
      `SELECT id, name, pricing_type, unit_price, unit_label, created_at
       FROM service_items WHERE organization_id = $1 ORDER BY created_at ASC`,
      [ctx.organizationId],
    );
    return result.rows;
  }

  async create(body: CreateServiceItemDto, ctx: RequestContext): Promise<unknown> {
    const result = await this.db.query(
      `INSERT INTO service_items (organization_id, name, pricing_type, unit_price, unit_label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, pricing_type, unit_price, unit_label, created_at`,
      [ctx.organizationId, body.name, body.pricingType, body.unitPrice, body.unitLabel ?? null],
    );
    return result.rows[0];
  }

  async update(
    id: string,
    body: UpdateServiceItemDto,
    ctx: RequestContext,
  ): Promise<{ ok: true }> {
    const setClauses: string[] = [];
    const params: unknown[] = [id, ctx.organizationId];

    if (body.name !== undefined) {
      params.push(body.name);
      setClauses.push(`name = $${params.length}`);
    }
    if (body.pricingType !== undefined) {
      params.push(body.pricingType);
      setClauses.push(`pricing_type = $${params.length}`);
    }
    if (body.unitPrice !== undefined) {
      params.push(body.unitPrice);
      setClauses.push(`unit_price = $${params.length}`);
    }
    if (body.unitLabel !== undefined) {
      params.push(body.unitLabel);
      setClauses.push(`unit_label = $${params.length}`);
    }

    if (setClauses.length === 0) return { ok: true };

    const result = await this.db.query(
      `UPDATE service_items SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
      params,
    );
    if (result.rowCount === 0) throw new NotFoundException('Service item not found');
    return { ok: true };
  }

  async remove(id: string, ctx: RequestContext): Promise<{ ok: true }> {
    const result = await this.db.query(
      `DELETE FROM service_items WHERE id = $1 AND organization_id = $2`,
      [id, ctx.organizationId],
    );
    if (result.rowCount === 0) throw new NotFoundException('Service item not found');
    return { ok: true };
  }
}
