import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { DealerGuard } from '../security/dealer.guard';
import { DealerRequestContext, RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { ListNotificationsQueryDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

type UserRequest = {
  context: RequestContext;
};

type DealerRequest = {
  dealerContext: DealerRequestContext;
};

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  listUserNotifications(@Query() query: ListNotificationsQueryDto, @Req() req: UserRequest) {
    return this.notificationsService.listUserNotifications(query, req.context);
  }

  @Get('notifications/unread-count')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  getUserUnreadCount(@Req() req: UserRequest) {
    return this.notificationsService.getUserUnreadCount(req.context);
  }

  @Patch('notifications/read-all')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  markAllUserNotificationsRead(@Req() req: UserRequest) {
    return this.notificationsService.markAllUserNotificationsRead(req.context);
  }

  @Patch('notifications/:id/read')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  markUserNotificationRead(@Param('id') id: string, @Req() req: UserRequest) {
    return this.notificationsService.markUserNotificationRead(id, req.context);
  }

  @Get('dealer/notifications')
  @UseGuards(DealerGuard)
  listDealerNotifications(@Query() query: ListNotificationsQueryDto, @Req() req: DealerRequest) {
    return this.notificationsService.listDealerNotifications(query, req.dealerContext);
  }

  @Get('dealer/notifications/unread-count')
  @UseGuards(DealerGuard)
  getDealerUnreadCount(@Req() req: DealerRequest) {
    return this.notificationsService.getDealerUnreadCount(req.dealerContext);
  }

  @Patch('dealer/notifications/:id/read')
  @UseGuards(DealerGuard)
  markDealerNotificationRead(@Param('id') id: string, @Req() req: DealerRequest) {
    return this.notificationsService.markDealerNotificationRead(id, req.dealerContext);
  }
}
