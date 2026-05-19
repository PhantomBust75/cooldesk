import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { CreateBrandDto, BrandResponseDto } from './brands.dto';

@Injectable()
export class BrandsService {
  private logger = new Logger('BrandsService');

  constructor(private readonly db: DatabaseService) {}

  async listBrands(ctx: RequestContext): Promise<BrandResponseDto[]> {
    // Try to select with color_hex first; fall back to selecting without it if column doesn't exist
    let result = await this.db.query<{
      id: string;
      name: string;
      color_hex: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `
      SELECT id, name, color_hex, is_active, created_at
      FROM brands
      WHERE organization_id = $1
        AND is_deleted = FALSE
      ORDER BY created_at DESC
      `,
      [ctx.organizationId],
    ).catch(async (error) => {
      // If color_hex column doesn't exist, try without it
      if (error.message && error.message.includes('color_hex')) {
        return this.db.query<{
          id: string;
          name: string;
          color_hex: string | null;
          is_active: boolean;
          created_at: string;
        }>(
          `
          SELECT id, name, NULL AS color_hex, is_active, created_at
          FROM brands
          WHERE organization_id = $1
            AND is_deleted = FALSE
          ORDER BY created_at DESC
          `,
          [ctx.organizationId],
        );
      }
      throw error;
    });

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      color_hex: row.color_hex ?? undefined,
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

    // Try to insert with color_hex first; fall back to insert without it if column doesn't exist
    let result = await this.db.query<{
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
    ).catch(async (error) => {
      this.logger.error(`[createBrand] Insert with color_hex failed: ${error.message}`);
      // If color_hex column doesn't exist, try without it
      if (error.message && error.message.includes('color_hex')) {
        this.logger.log(`[createBrand] Retrying insert without color_hex column`);
        return this.db.query<{
          id: string;
          name: string;
          color_hex: string | null;
          is_active: boolean;
          created_at: string;
        }>(
          `
          INSERT INTO brands (organization_id, name, is_active, is_deleted)
          VALUES ($1, $2, TRUE, FALSE)
          RETURNING id, name, NULL AS color_hex, is_active, created_at
          `,
          [ctx.organizationId, body.name.trim()],
        );
      }
      throw error;
    });

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
      is_active: row.is_active,
      created_at: row.created_at,
    };
  }
}
