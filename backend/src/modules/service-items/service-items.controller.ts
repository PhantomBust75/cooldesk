import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { CreateServiceItemDto, UpdateServiceItemDto } from './service-items.dto';
import { ServiceItemsService } from './service-items.service';

type UserRequest = { context: RequestContext };

@Controller('service-items')
@UseGuards(TenantGuard, RolesGuard)
export class ServiceItemsController {
  constructor(private readonly serviceItemsService: ServiceItemsService) {}

  @Get()
  @Roles('owner', 'office_staff', 'technician')
  findAll(@Req() req: UserRequest) {
    return this.serviceItemsService.findAll(req.context);
  }

  @Post()
  @Roles('owner')
  create(@Body() body: CreateServiceItemDto, @Req() req: UserRequest) {
    return this.serviceItemsService.create(body, req.context);
  }

  @Patch(':id')
  @Roles('owner')
  update(
    @Param('id') id: string,
    @Body() body: UpdateServiceItemDto,
    @Req() req: UserRequest,
  ) {
    return this.serviceItemsService.update(id, body, req.context);
  }

  @Delete(':id')
  @Roles('owner')
  remove(@Param('id') id: string, @Req() req: UserRequest) {
    return this.serviceItemsService.remove(id, req.context);
  }
}
