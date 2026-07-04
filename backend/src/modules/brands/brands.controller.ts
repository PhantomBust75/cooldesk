import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards, Logger } from '@nestjs/common';
import { TenantGuard } from '../security/tenant.guard';
import { RolesGuard } from '../security/roles.guard';
import { Roles } from '../security/roles.decorator';
import { RequestContext } from '../security/request-context';
import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto } from './brands.dto';

type UserRequest = {
  context: RequestContext;
};

@Controller('office/brands')
export class BrandsController {
  private logger = new Logger('BrandsController');

  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  listBrands(@Req() req: UserRequest) {
    this.logger.log(`[GET /office/brands] org=${req.context.organizationId}`);
    return this.brandsService.listBrands(req.context);
  }

  @Post()
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  createBrand(@Body() body: CreateBrandDto, @Req() req: UserRequest) {
    this.logger.log(`[POST /office/brands] org=${req.context.organizationId}`);
    return this.brandsService.createBrand(body, req.context);
  }

  @Patch(':id')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  updateBrand(@Param('id') id: string, @Body() body: UpdateBrandDto, @Req() req: UserRequest) {
    this.logger.log(`[PATCH /office/brands/${id}] org=${req.context.organizationId}`);
    return this.brandsService.updateBrand(id, body, req.context);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  deleteBrand(@Param('id') id: string, @Req() req: UserRequest) {
    this.logger.log(`[DELETE /office/brands/${id}] org=${req.context.organizationId}`);
    return this.brandsService.deleteBrand(id, req.context);
  }
}
