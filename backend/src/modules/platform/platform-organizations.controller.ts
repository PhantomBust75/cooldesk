import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreatePlatformOrganizationDto,
  UpdateOrganizationStatusDto,
} from './platform-organizations.dto';
import { PlatformOrganizationsService } from './platform-organizations.service';
import { PlatformAdminGuard } from '../security/platform-admin.guard';
import { LoginDto } from '../auth/auth.dto';

@Controller('platform')
export class PlatformOrganizationsController {
  constructor(private readonly platformOrganizationsService: PlatformOrganizationsService) {}

  @Post('auth/login')
  platformLogin(@Body() body: LoginDto): Promise<{ accessToken: string }> {
    return this.platformOrganizationsService.platformLogin(body.email, body.password);
  }

  @Post('organizations')
  @UseGuards(PlatformAdminGuard)
  create(@Body() body: CreatePlatformOrganizationDto): Promise<{ organizationId: string }> {
    return this.platformOrganizationsService.createOrganization(body);
  }

  @Patch('organizations/:id')
  @UseGuards(PlatformAdminGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationStatusDto,
  ): Promise<{ ok: true }> {
    await this.platformOrganizationsService.updateOrganizationStatus(id, body);
    return { ok: true };
  }

  @Get('organizations')
  @UseGuards(PlatformAdminGuard)
  list() {
    return this.platformOrganizationsService.listOrganizations();
  }
}
