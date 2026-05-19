import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { AppConfigService } from '../../shared/app-config.service';
import { DatabaseService } from '../../shared/database.service';

describe('AnalyticsController integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const analyticsService: any = {
    processFromRequest: jest.fn(),
    purgeProcessedEvents: jest.fn(),
  };

  const db: any = {
    query: jest.fn(),
  };

  const appConfig = {
    jwtUserSecret: 'test-user-secret',
  };

  beforeEach(async () => {
    analyticsService.processFromRequest.mockReset();
    analyticsService.purgeProcessedEvents.mockReset();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [{ id: 'org-1' }], rowCount: 1 });

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AnalyticsController],
      providers: [
        RolesGuard,
        TenantGuard,
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: DatabaseService, useValue: db },
        { provide: AppConfigService, useValue: appConfig },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  function userToken(payload?: Partial<{ sub: string; organization_id: string; role: string }>): string {
    return jwtService.sign(
      {
        sub: payload?.sub ?? 'owner-1',
        organization_id: payload?.organization_id ?? 'org-1',
        role: payload?.role ?? 'owner',
      },
      { secret: appConfig.jwtUserSecret },
    );
  }

  it('rejects technician on analytics process endpoint', async () => {
    await request(app.getHttpServer())
      .post('/internal/analytics/process')
      .set('Authorization', `Bearer ${userToken({ role: 'technician', sub: 'tech-1' })}`)
      .send({ batchSize: 100 })
      .expect(403);

    expect(analyticsService.processFromRequest).not.toHaveBeenCalled();
  });

  it('passes tenant context for owner analytics processing', async () => {
    analyticsService.processFromRequest.mockResolvedValue({ processed: 12, organizationId: 'org-owner' });

    await request(app.getHttpServer())
      .post('/internal/analytics/process')
      .set('Authorization', `Bearer ${userToken({ organization_id: 'org-owner', sub: 'owner-77', role: 'owner' })}`)
      .send({ batchSize: 250 })
      .expect(201);

    expect(analyticsService.processFromRequest).toHaveBeenCalledWith(
      { batchSize: 250 },
      { organizationId: 'org-owner', userId: 'owner-77', role: 'owner' },
    );
  });

  it('allows office_staff on purge endpoint', async () => {
    analyticsService.purgeProcessedEvents.mockResolvedValue({ deleted: 9 });

    await request(app.getHttpServer())
      .post('/internal/analytics/purge-processed-events')
      .set('Authorization', `Bearer ${userToken({ role: 'office_staff', sub: 'staff-1', organization_id: 'org-a' })}`)
      .send({})
      .expect(201);

    expect(analyticsService.purgeProcessedEvents).toHaveBeenCalled();
  });

  it('rejects inactive org through tenant guard', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await request(app.getHttpServer())
      .post('/internal/analytics/process')
      .set('Authorization', `Bearer ${userToken({ organization_id: 'org-inactive', role: 'owner' })}`)
      .send({ batchSize: 100 })
      .expect(401);
  });
});
