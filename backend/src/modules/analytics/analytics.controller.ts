import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { ProcessAnalyticsDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

class AnalyticsDaysQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}

type UserRequest = {
  context: RequestContext;
};

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('internal/analytics/process')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  process(@Body() body: ProcessAnalyticsDto, @Req() req: UserRequest) {
    return this.analyticsService.processFromRequest(body, req.context);
  }

  @Post('internal/analytics/purge-processed-events')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  purgeProcessedEvents() {
    return this.analyticsService.purgeProcessedEvents();
  }

  @Get('analytics/business/overview')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  businessOverview(@Query() query: AnalyticsDaysQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getBusinessOverview(query.days ?? 30, req.context);
  }

  @Get('analytics/technicians')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  technicianAnalytics(@Query() query: AnalyticsDaysQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getTechnicianAnalytics(query.days ?? 30, req.context);
  }

  @Get('analytics/brands')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  brandAnalytics(@Query() query: AnalyticsDaysQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getBrandAnalytics(query.days ?? 30, req.context);
  }

  @Get('analytics/dealers')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  dealerAnalytics(@Query() query: AnalyticsDaysQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getDealerAnalytics(query.days ?? 30, req.context);
  }
}
