import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { CreateBrandDto, BrandResponseDto } from './brands.dto';

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
    this.logger.log(`[createBrand] Starting - org: ${ctx.organizationId}`);
    this.logger.debug(`[createBrand] Input body: ${JSON.stringify(body)}`);
    
    if (!body.name || body.name.trim().length === 0) {
      this.logger.warn(`[createBrand] Validation failed: empty name`);
      throw new BadRequestException('Brand name is required');
    }

    this.logger.log(`[createBrand] Validated name: "${body.name}", color_hex: "${body.color_hex || 'undefined'}"`);

    const result = await this.db.query<{
      id: string;
      name: string;
      color_hex: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `
      INSERT INTO brands (organization_id, name, color_hex, is_active, is_deleted)
      VALUES ($1, $2, $3, TRUE, FALSE)
      RETURNING id, name, color_hex, is_active, created_at
      `,
      [ctx.organizationId, body.name.trim(), body.color_hex || null],
    );

    if (result.rowCount === 0) {
      this.logger.error(`[createBrand] Insert returned no rows`);
      throw new BadRequestException('Failed to create brand');
    }

    const row = result.rows[0];
    this.logger.log(`[createBrand] Success - created brand ${row.id} in org ${ctx.organizationId}`);
    return {
      id: row.id,
      name: row.name,
      color_hex: row.color_hex ?? undefined,
      installation_charge: 0,
      is_active: row.is_active,
      created_at: row.created_at,
    };
  }
}
