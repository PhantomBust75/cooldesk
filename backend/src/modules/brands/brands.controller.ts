import { Body, Controller, Get, Post, Req, UseGuards, Logger } from '@nestjs/common';
import { TenantGuard } from '../security/tenant.guard';
import { RolesGuard } from '../security/roles.guard';
import { Roles } from '../security/roles.decorator';
import { RequestContext } from '../security/request-context';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './brands.dto';

type UserRequest = {
  context: RequestContext;
};

@Controller('office/brands')
export class BrandsController {
  private logger = new Logger('BrandsController');

  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listBrands(@Req() req: UserRequest) {
    this.logger.log(`[GET /office/brands] org=${req.context.organizationId}`);
    return this.brandsService.listBrands(req.context);
  }

  @Post()
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  createBrand(@Body() body: CreateBrandDto, @Req() req: UserRequest & { body: unknown }) {
    this.logger.log(`[POST /office/brands] org=${req.context.organizationId}`);
    this.logger.debug(`[POST] Raw request body: ${JSON.stringify(req.body)}`);
    this.logger.debug(`[POST] Transformed DTO: ${JSON.stringify(body)}`);
    return this.brandsService.createBrand(body, req.context);
  }
}
