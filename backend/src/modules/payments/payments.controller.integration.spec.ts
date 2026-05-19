import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { AppConfigService } from '../../shared/app-config.service';
import { DatabaseService } from '../../shared/database.service';

describe('PaymentsController integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const paymentsService: any = {
    decideOwnerPaymentReversal: jest.fn(),
    updatePaymentStatus: jest.fn(),
  };
  const db: any = {
    query: jest.fn(),
  };
  const appConfig = {
    jwtUserSecret: 'test-user-secret',
  };

  beforeEach(async () => {
    paymentsService.decideOwnerPaymentReversal.mockReset();
    paymentsService.updatePaymentStatus.mockReset();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [{ id: 'org-1' }], rowCount: 1 });

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [PaymentsController],
      providers: [
        RolesGuard,
        TenantGuard,
        { provide: PaymentsService, useValue: paymentsService },
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

  function tenantToken(payload?: Partial<{ sub: string; organization_id: string; role: string }>): string {
    return jwtService.sign(
      {
        sub: payload?.sub ?? 'user-1',
        organization_id: payload?.organization_id ?? 'org-1',
        role: payload?.role ?? 'owner',
      },
      { secret: appConfig.jwtUserSecret },
    );
  }

  it('rejects retain-or-void decision without bearer token', async () => {
    await request(app.getHttpServer())
      .post('/jobs/job-1/payment-reversal-decision')
      .send({
        expectedJobVersion: 4,
        expectedPaymentVersion: 2,
        decision: 'retain',
      })
      .expect(401);
  });

  it('rejects office staff on owner-only retain-or-void route', async () => {
    await request(app.getHttpServer())
      .post('/jobs/job-1/payment-reversal-decision')
      .set('Authorization', `Bearer ${tenantToken({ role: 'office_staff', sub: 'staff-1' })}`)
      .send({
        expectedJobVersion: 4,
        expectedPaymentVersion: 2,
        decision: 'retain',
      })
      .expect(403);

    expect(paymentsService.decideOwnerPaymentReversal).not.toHaveBeenCalled();
  });

  it('passes JWT tenant context into owner retain-or-void route', async () => {
    paymentsService.decideOwnerPaymentReversal.mockResolvedValue({ ok: true, status: 'in_process', version: 5 });

    await request(app.getHttpServer())
      .post('/jobs/job-1/payment-reversal-decision')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-owner', sub: 'owner-77', role: 'owner' })}`)
      .send({
        expectedJobVersion: 4,
        expectedPaymentVersion: 2,
        decision: 'void',
        voidReason: 'Incorrect amount captured',
      })
      .expect(201);

    expect(paymentsService.decideOwnerPaymentReversal).toHaveBeenCalledWith(
      'job-1',
      {
        expectedJobVersion: 4,
        expectedPaymentVersion: 2,
        decision: 'void',
        voidReason: 'Incorrect amount captured',
      },
      {
        organizationId: 'org-owner',
        userId: 'owner-77',
        role: 'owner',
      },
    );
  });

  it('rejects inactive organization in owner retain-or-void route', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await request(app.getHttpServer())
      .post('/jobs/job-1/payment-reversal-decision')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-inactive', role: 'owner' })}`)
      .send({
        expectedJobVersion: 4,
        expectedPaymentVersion: 2,
        decision: 'retain',
      })
      .expect(401);
  });

  it('allows office staff on payment status route and passes tenant context', async () => {
    paymentsService.updatePaymentStatus.mockResolvedValue({ ok: true, status: 'collected', version: 3 });

    await request(app.getHttpServer())
      .patch('/payments/pay-1/status')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-pay', sub: 'staff-2', role: 'office_staff' })}`)
      .send({
        expectedVersion: 2,
        status: 'collected',
        reason: 'Cash received',
      })
      .expect(200);

    expect(paymentsService.updatePaymentStatus).toHaveBeenCalledWith(
      'pay-1',
      {
        expectedVersion: 2,
        status: 'collected',
        reason: 'Cash received',
      },
      {
        organizationId: 'org-pay',
        userId: 'staff-2',
        role: 'office_staff',
      },
    );
  });
});
