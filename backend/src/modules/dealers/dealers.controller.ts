import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { DealerGuard } from '../security/dealer.guard';
import { DealerRequestContext, RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import {
  CreateDealerDto,
  DealerHistoryQueryDto,
  UpdateDealerBrandsDto,
  UpdateDealerProfileDto,
  UpdateDealerStatusDto,
} from './dealers.dto';
import { DealersService } from './dealers.service';

type UserRequest = {
  context: RequestContext;
};

type DealerRequest = {
  dealerContext: DealerRequestContext;
};

@Controller()
export class DealersController {
  constructor(private readonly dealersService: DealersService) {}

  @Get('dealers')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listDealers(@Req() req: UserRequest) {
    return this.dealersService.listDealers(req.context);
  }

  @Post('dealers')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  createDealer(@Body() body: CreateDealerDto, @Req() req: UserRequest) {
    return this.dealersService.createDealer(body, req.context);
  }

  @Patch('dealers/:id')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  patchDealerStatus(
    @Param('id') id: string,
    @Body() body: UpdateDealerStatusDto,
    @Req() req: UserRequest,
  ) {
    return this.dealersService.updateDealerStatus(id, body, req.context);
  }

  @Put('dealers/:id/brands')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  putDealerBrands(
    @Param('id') id: string,
    @Body() body: UpdateDealerBrandsDto,
    @Req() req: UserRequest,
  ) {
    return this.dealersService.setDealerBrands(id, body, req.context);
  }

  @Get('dealers/analytics/daily')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  getDealerDailyAnalytics(@Query('date') date: string | undefined, @Req() req: UserRequest) {
    return this.dealersService.getDealerDailyAnalytics(date, req.context);
  }

  @Get('dealer/brands')
  @UseGuards(DealerGuard)
  getDealerBrands(@Req() req: DealerRequest) {
    return this.dealersService.listDealerLinkedBrands(req.dealerContext);
  }

  @Get('dealer/jobs/history')
  @UseGuards(DealerGuard)
  getDealerHistory(@Query() query: DealerHistoryQueryDto, @Req() req: DealerRequest) {
    return this.dealersService.listDealerHistory(query, req.dealerContext);
  }

  @Get('dealer/jobs/:id')
  @UseGuards(DealerGuard)
  getDealerJob(@Param('id') id: string, @Req() req: DealerRequest) {
    return this.dealersService.getDealerJobById(id, req.dealerContext);
  }

  @Get('dealers/:id/brands')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  getDealerBrandsForOffice(@Param('id') id: string, @Req() req: UserRequest) {
    return this.dealersService.getDealerBrandsForOffice(id, req.context);
  }

  @Patch('dealers/:id/profile')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  patchDealerProfile(
    @Param('id') id: string,
    @Body() body: UpdateDealerProfileDto,
    @Req() req: UserRequest,
  ) {
    return this.dealersService.updateDealerProfile(id, body, req.context);
  }

  @Get('dealers/:id/jobs')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listDealerJobsForOffice(@Param('id') id: string, @Req() req: UserRequest) {
    return this.dealersService.listDealerJobsForOffice(id, req.context);
  }
}
