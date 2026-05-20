import { BadRequestException, Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { DatabaseService } from '../../shared/database.service';

class UpdateSystemConfigDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  value!: string;
}

type UserRequest = {
  context: RequestContext;
};

@Controller('settings')
@UseGuards(TenantGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly db: DatabaseService) {}

  @Get('system-config')
  @Roles('owner', 'office_staff')
  async listSystemConfig(@Req() req: UserRequest) {
    const result = await this.db.query(
      `
      SELECT key, value, updated_at
      FROM system_config
      WHERE organization_id = $1
      ORDER BY key ASC
      `,
      [req.context.organizationId],
    );
    return result.rows;
  }

  @Patch('system-config/:key')
  @Roles('owner')
  async updateSystemConfig(
    @Param('key') key: string,
    @Body() body: UpdateSystemConfigDto,
    @Req() req: UserRequest,
  ) {
    if (!key || key.length < 1 || key.length > 100) {
      throw new BadRequestException('Invalid config key');
    }

    const result = await this.db.query(
      `
      UPDATE system_config
      SET value = $3, updated_at = NOW()
      WHERE organization_id = $1
        AND key = $2
      `,
      [req.context.organizationId, key, body.value],
    );

    if ((result.rowCount ?? 0) === 0) {
      await this.db.query(
        `
        INSERT INTO system_config (organization_id, key, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `,
        [req.context.organizationId, key, body.value],
      );
    }

    return { ok: true };
  }
}
