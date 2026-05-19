import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../shared/app-config.service';
import { DatabaseService } from '../shared/database.service';
import { PlatformOrganizationsController } from './platform/platform-organizations.controller';
import { PlatformOrganizationsService } from './platform/platform-organizations.service';
import { TenantGuard } from './security/tenant.guard';
import { RolesGuard } from './security/roles.guard';
import { PlatformAdminGuard } from './security/platform-admin.guard';
import { DealerGuard } from './security/dealer.guard';
import { TenantConfigService } from './settings/tenant-config.service';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { DealersController } from './dealers/dealers.controller';
import { DealersService } from './dealers/dealers.service';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { BrandsController } from './brands/brands.controller';
import { BrandsService } from './brands/brands.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    JwtModule.register({}),
  ],
  controllers: [
    HealthController,
    PlatformOrganizationsController,
    JobsController,
    PaymentsController,
    NotificationsController,
    DashboardController,
    AnalyticsController,
    DealersController,
    ReviewsController,
    AuthController,
    BrandsController,
  ],
  providers: [
    AppConfigService,
    DatabaseService,
    PlatformOrganizationsService,
    JobsService,
    PaymentsService,
    NotificationsService,
    DashboardService,
    AnalyticsService,
    DealersService,
    ReviewsService,
    AuthService,
    BrandsService,
    TenantConfigService,
    TenantGuard,
    RolesGuard,
    PlatformAdminGuard,
    DealerGuard,
  ],
})
export class AppModule {}
