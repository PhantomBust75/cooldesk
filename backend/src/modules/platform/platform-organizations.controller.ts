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

@Controller('platform/organizations')
@UseGuards(PlatformAdminGuard)
export class PlatformOrganizationsController {
  constructor(private readonly platformOrganizationsService: PlatformOrganizationsService) {}

  @Post()
  create(@Body() body: CreatePlatformOrganizationDto): Promise<{ organizationId: string }> {
    return this.platformOrganizationsService.createOrganization(body);
  }

  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationStatusDto,
  ): Promise<{ ok: true }> {
    await this.platformOrganizationsService.updateOrganizationStatus(id, body);
    return { ok: true };
  }

  @Get()
  list() {
    return this.platformOrganizationsService.listOrganizations();
  }
}
