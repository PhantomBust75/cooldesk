import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { OwnerDashboardQueryDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

type UserRequest = {
  context: RequestContext;
};

@Controller()
@UseGuards(TenantGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/owner')
  @Roles('owner', 'office_staff')
  getOwnerDashboard(@Query() query: OwnerDashboardQueryDto, @Req() req: UserRequest) {
    return this.dashboardService.getOwnerDashboard(query, req.context);
  }

  @Get('dashboard/metrics')
  @Roles('owner', 'office_staff')
  getDashboardMetrics(@Req() req: UserRequest) {
    return this.dashboardService.getDashboardMetrics(req.context);
  }
}
