import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { CreateBrandDto, UpdateBrandDto, BrandResponseDto } from './brands.dto';

@Injectable()
export class BrandsService {
  private logger = new Logger('BrandsService');

  constructor(private readonly db: DatabaseService) {}

  async listBrands(ctx: RequestContext): Promise<BrandResponseDto[]> {
    const result = await this.db.query<{
      id: string;
      name: string;
      color_hex: string | null;
      installation_charge: string;
      is_active: boolean;
      created_at: string;
    }>(
      `
      SELECT id, name, color_hex, installation_charge, is_active, created_at
      FROM brands
      WHERE organization_id = $1
        AND is_deleted = FALSE
      ORDER BY created_at DESC
      `,
      [ctx.organizationId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      color_hex: row.color_hex ?? undefined,
      installation_charge: Number(row.installation_charge),
      is_active: row.is_active,
      created_at: row.created_at,
    }));
  }

  async createBrand(body: CreateBrandDto, ctx: RequestContext): Promise<BrandResponseDto> {
    this.logger.log(`[createBrand] org=${ctx.organizationId} name="${body.name}"`);

    if (!body.name || body.name.trim().length === 0) {
      throw new BadRequestException('Brand name is required');
    }

    const result = await this.db.query<{
      id: string;
      name: string;
      color_hex: string | null;
      installation_charge: string;
      is_active: boolean;
      created_at: string;
    }>(
      `
      INSERT INTO brands (organization_id, name, color_hex, installation_charge, is_active, is_deleted)
      VALUES ($1, $2, $3, $4, TRUE, FALSE)
      RETURNING id, name, color_hex, installation_charge, is_active, created_at
      `,
      [ctx.organizationId, body.name.trim(), body.color_hex || null, body.installation_charge ?? 0],
    );

    if (result.rowCount === 0) {
      throw new BadRequestException('Failed to create brand');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      color_hex: row.color_hex ?? undefined,
      installation_charge: Number(row.installation_charge),
      is_active: row.is_active,
      created_at: row.created_at,
    };
  }

  async updateBrand(id: string, body: UpdateBrandDto, ctx: RequestContext): Promise<BrandResponseDto> {
    this.logger.log(`[updateBrand] id=${id} org=${ctx.organizationId}`);

    const sets: string[] = [];
    const values: unknown[] = [id, ctx.organizationId];

    if (body.name !== undefined) { values.push(body.name.trim()); sets.push(`name = $${values.length}`); }
    if (body.color_hex !== undefined) { values.push(body.color_hex); sets.push(`color_hex = $${values.length}`); }
    if (body.installation_charge !== undefined) { values.push(body.installation_charge); sets.push(`installation_charge = $${values.length}`); }
    if (body.is_active !== undefined) { values.push(body.is_active); sets.push(`is_active = $${values.length}`); }

    if (sets.length === 0) {
      throw new BadRequestException('No fields provided to update');
    }

    sets.push(`updated_at = NOW()`);

    const result = await this.db.query<{
      id: string;
      name: string;
      color_hex: string | null;
      installation_charge: string;
      is_active: boolean;
      created_at: string;
    }>(
      `
      UPDATE brands
      SET ${sets.join(', ')}
      WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE
      RETURNING id, name, color_hex, installation_charge, is_active, created_at
      `,
      values,
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Brand ${id} not found`);
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      color_hex: row.color_hex ?? undefined,
      installation_charge: Number(row.installation_charge),
      is_active: row.is_active,
      created_at: row.created_at,
    };
  }

  async deleteBrand(id: string, ctx: RequestContext): Promise<void> {
    this.logger.log(`[deleteBrand] id=${id} org=${ctx.organizationId}`);

    const result = await this.db.query(
      `
      UPDATE brands
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE
      `,
      [id, ctx.organizationId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
  }
}
