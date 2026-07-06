import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { RequestContext } from '../security/request-context';
import { TenantGuard } from '../security/tenant.guard';
import {
  CreatePaymentMethodDto,
  OwnerPaymentDecisionDto,
  UpdatePaymentDto,
  UpdatePaymentMethodDto,
  UpdatePaymentStatusDto,
} from './payments.dto';
import { PaymentsService } from './payments.service';

type UserRequest = {
  context: RequestContext;
};

@Controller()
@UseGuards(TenantGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payment-methods')
  @Roles('owner', 'office_staff', 'technician')
  listPaymentMethods(@Req() req: UserRequest) {
    return this.paymentsService.listPaymentMethods(req.context);
  }

  @Post('payment-methods')
  @Roles('owner')
  createPaymentMethod(@Body() body: CreatePaymentMethodDto, @Req() req: UserRequest) {
    return this.paymentsService.createPaymentMethod(body, req.context);
  }

  @Patch('payment-methods/:id')
  @Roles('owner')
  patchPaymentMethod(
    @Param('id') id: string,
    @Body() body: UpdatePaymentMethodDto,
    @Req() req: UserRequest,
  ) {
    return this.paymentsService.updatePaymentMethod(id, body, req.context);
  }

  @Patch('payments/:id')
  @Roles('owner', 'office_staff')
  patchPayment(
    @Param('id') id: string,
    @Body() body: UpdatePaymentDto,
    @Req() req: UserRequest,
  ) {
    return this.paymentsService.updatePayment(id, body, req.context);
  }

  @Patch('payments/:id/status')
  @Roles('owner', 'office_staff')
  patchPaymentStatus(
    @Param('id') id: string,
    @Body() body: UpdatePaymentStatusDto,
    @Req() req: UserRequest,
  ) {
    return this.paymentsService.updatePaymentStatus(id, body, req.context);
  }

  @Post('jobs/:id/payment-reversal-decision')
  @Roles('owner')
  decidePaymentReversal(
    @Param('id') id: string,
    @Body() body: OwnerPaymentDecisionDto,
    @Req() req: UserRequest,
  ) {
    return this.paymentsService.decideOwnerPaymentReversal(id, body, req.context);
  }

  @Patch('payment-methods/:id/toggle')
  @Roles('owner')
  togglePaymentMethod(@Param('id') id: string, @Req() req: UserRequest) {
    return this.paymentsService.togglePaymentMethod(id, req.context);
  }

  @Delete('payment-methods/:id')
  @Roles('owner')
  deletePaymentMethod(@Param('id') id: string, @Req() req: UserRequest) {
    return this.paymentsService.deletePaymentMethod(id, req.context);
  }
}
