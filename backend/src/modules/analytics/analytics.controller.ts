import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsISO8601, IsOptional } from 'class-validator';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { ProcessAnalyticsDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

/** Omitting both bounds means "all time" — no lower/upper date restriction. */
class AnalyticsRangeQueryDto {
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
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
  businessOverview(@Query() query: AnalyticsRangeQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getBusinessOverview(query.dateFrom, query.dateTo, req.context);
  }

  @Get('analytics/business/daily')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  getBusinessDaily(@Query() query: AnalyticsRangeQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getBusinessDaily(query.dateFrom, query.dateTo, req.context);
  }

  @Get('analytics/technicians')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  technicianAnalytics(@Query() query: AnalyticsRangeQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getTechnicianAnalytics(query.dateFrom, query.dateTo, req.context);
  }

  @Get('analytics/brands')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  brandAnalytics(@Query() query: AnalyticsRangeQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getBrandAnalytics(query.dateFrom, query.dateTo, req.context);
  }

  @Get('analytics/dealers')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  dealerAnalytics(@Query() query: AnalyticsRangeQueryDto, @Req() req: UserRequest) {
    return this.analyticsService.getDealerAnalytics(query.dateFrom, query.dateTo, req.context);
  }
}
