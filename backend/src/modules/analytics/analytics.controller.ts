import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { ProcessAnalyticsDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

type UserRequest = {
  context: RequestContext;
};

@Controller('internal/analytics')
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner', 'office_staff')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('process')
  process(@Body() body: ProcessAnalyticsDto, @Req() req: UserRequest) {
    return this.analyticsService.processFromRequest(body, req.context);
  }

  @Post('purge-processed-events')
  purgeProcessedEvents() {
    return this.analyticsService.purgeProcessedEvents();
  }
}
