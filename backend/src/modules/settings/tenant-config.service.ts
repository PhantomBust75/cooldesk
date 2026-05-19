import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';

@Injectable()
export class TenantConfigService {
  constructor(private readonly db: DatabaseService) {}

  async get(organizationId: string, key: string): Promise<string> {
    const result = await this.db.query<{ value: string }>(
      `
      SELECT value
      FROM system_config
      WHERE organization_id = $1
        AND key = $2
      LIMIT 1
      `,
      [organizationId, key],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Config key not found: ${key}`);
    }

    return result.rows[0].value;
  }

  async getInt(organizationId: string, key: string, fallback: number): Promise<number> {
    const result = await this.db.query<{ value: string }>(
      `
      SELECT COALESCE(value, $3::text) AS value
      FROM system_config
      WHERE organization_id = $1
        AND key = $2
      LIMIT 1
      `,
      [organizationId, key, fallback],
    );

    if (result.rowCount === 0) {
      return fallback;
    }

    const parsed = Number.parseInt(result.rows[0].value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
