import 'reflect-metadata';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { DealerGuard } from '../security/dealer.guard';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { AppConfigService } from '../../shared/app-config.service';
import { DatabaseService } from '../../shared/database.service';

describe('JobsController Phase 06 integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const jobsService: any = {
    scheduleRevisit: jest.fn(),
    updateStatus: jest.fn(),
    dealerWithdrawInitialJob: jest.fn(),
    requestDealerCancellation: jest.fn(),
    lookupCustomers: jest.fn(),
    listPendingScheduleJobs: jest.fn(),
    getTechnicianWorkload: jest.fn(),
    quickEntryCreateJob: jest.fn(),
    listBrandsForOffice: jest.fn(),
    listTechniciansForOffice: jest.fn(),
    listPendingRevisitCards: jest.fn(),
    rescheduleJob: jest.fn(),
    schedulePendingJob: jest.fn(),
    decideCancellationRequest: jest.fn(),
  };
  const db: any = {
    query: jest.fn(),
  };
  const appConfig = {
    jwtUserSecret: 'test-user-secret',
    jwtDealerSecret: 'test-dealer-secret',
  };

  beforeEach(async () => {
    jobsService.scheduleRevisit.mockReset();
    jobsService.updateStatus.mockReset();
    jobsService.dealerWithdrawInitialJob.mockReset();
    jobsService.requestDealerCancellation.mockReset();
    jobsService.lookupCustomers.mockReset();
    jobsService.listPendingScheduleJobs.mockReset();
    jobsService.getTechnicianWorkload.mockReset();
    jobsService.quickEntryCreateJob.mockReset();
    jobsService.listBrandsForOffice.mockReset();
    jobsService.listTechniciansForOffice.mockReset();
    jobsService.listPendingRevisitCards.mockReset();
    jobsService.rescheduleJob.mockReset();
    jobsService.schedulePendingJob.mockReset();
    jobsService.decideCancellationRequest.mockReset();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [{ id: 'org-1' }], rowCount: 1 });

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [JobsController],
      providers: [
        RolesGuard,
        TenantGuard,
        DealerGuard,
        { provide: JobsService, useValue: jobsService },
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
        role: payload?.role ?? 'office_staff',
      },
      { secret: appConfig.jwtUserSecret },
    );
  }

  function dealerToken(payload?: Partial<{ sub: string; organization_id: string }>): string {
    return jwtService.sign(
      {
        sub: payload?.sub ?? 'dealer-1',
        organization_id: payload?.organization_id ?? 'org-1',
        type: 'dealer',
      },
      { secret: appConfig.jwtDealerSecret },
    );
  }

  it('rejects revisit scheduling without bearer token', async () => {
    await request(app.getHttpServer())
      .post('/jobs/job-1/revisit-schedule')
      .send({
        revisitId: 'b1f18c7f-6a38-44e1-98b3-996df2bbd111',
        scheduledAt: new Date().toISOString(),
        technicianId: '85ae80e7-658a-49c6-9070-627379fa9111',
        expectedVersion: 3,
      })
      .expect(401);
  });

  it('rejects revisit scheduling for technician role', async () => {
    await request(app.getHttpServer())
      .post('/jobs/job-1/revisit-schedule')
      .set('Authorization', `Bearer ${tenantToken({ role: 'technician', sub: 'tech-1' })}`)
      .send({
        revisitId: 'b1f18c7f-6a38-44e1-98b3-996df2bbd111',
        scheduledAt: new Date().toISOString(),
        technicianId: '85ae80e7-658a-49c6-9070-627379fa9111',
        expectedVersion: 3,
      })
      .expect(403);

    expect(jobsService.scheduleRevisit).not.toHaveBeenCalled();
  });

  it('passes JWT tenant context into scheduleRevisit', async () => {
    jobsService.scheduleRevisit.mockResolvedValue({
      ok: true,
      status: 'revisit_scheduled',
      version: 4,
      revisitId: 'b1f18c7f-6a38-44e1-98b3-996df2bbd111',
    });

    await request(app.getHttpServer())
      .post('/jobs/job-1/revisit-schedule')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-tenant-a', sub: 'staff-1', role: 'office_staff' })}`)
      .send({
        revisitId: 'b1f18c7f-6a38-44e1-98b3-996df2bbd111',
        scheduledAt: '2026-05-05T10:00:00.000Z',
        technicianId: '85ae80e7-658a-49c6-9070-627379fa9111',
        expectedVersion: 3,
      })
      .expect(201);

    expect(jobsService.scheduleRevisit).toHaveBeenCalledWith(
      'job-1',
      {
        revisitId: 'b1f18c7f-6a38-44e1-98b3-996df2bbd111',
        scheduledAt: '2026-05-05T10:00:00.000Z',
        technicianId: '85ae80e7-658a-49c6-9070-627379fa9111',
        expectedVersion: 3,
      },
      {
        organizationId: 'org-tenant-a',
        userId: 'staff-1',
        role: 'office_staff',
      },
    );
  });

  it('rejects inactive organization in TenantGuard', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await request(app.getHttpServer())
      .post('/jobs/job-1/revisit-schedule')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-inactive' })}`)
      .send({
        revisitId: 'b1f18c7f-6a38-44e1-98b3-996df2bbd111',
        scheduledAt: new Date().toISOString(),
        technicianId: '85ae80e7-658a-49c6-9070-627379fa9111',
        expectedVersion: 3,
      })
      .expect(401);
  });

  it('allows technician status update route and passes tenant context from JWT', async () => {
    jobsService.updateStatus.mockResolvedValue({ ok: true, status: 'in_process', version: 8 });

    await request(app.getHttpServer())
      .patch('/jobs/job-77/status')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-tech', sub: 'tech-77', role: 'technician' })}`)
      .send({
        targetStatus: 'in_process',
        expectedVersion: 7,
      })
      .expect(200);

    expect(jobsService.updateStatus).toHaveBeenCalledWith(
      'job-77',
      {
        targetStatus: 'in_process',
        expectedVersion: 7,
      },
      {
        organizationId: 'org-tech',
        userId: 'tech-77',
        role: 'technician',
      },
    );
  });

  it('returns 404 for guessed cross-org dealer job id on withdraw route', async () => {
    jobsService.dealerWithdrawInitialJob.mockRejectedValue(new NotFoundException('Dealer job not found'));

    await request(app.getHttpServer())
      .post('/dealer/jobs/job-guess/withdraw')
      .set('Authorization', `Bearer ${dealerToken({ organization_id: 'org-dealer', sub: 'dealer-42' })}`)
      .send({ reason: 'customer asked to stop' })
      .expect(404);

    expect(jobsService.dealerWithdrawInitialJob).toHaveBeenCalledWith(
      'job-guess',
      'customer asked to stop',
      {
        organizationId: 'org-dealer',
        dealerId: 'dealer-42',
      },
    );
  });

  it('returns 404 for guessed cross-org dealer job id on cancellation-request route', async () => {
    jobsService.requestDealerCancellation.mockRejectedValue(new NotFoundException('Dealer job not found'));

    await request(app.getHttpServer())
      .post('/dealer/jobs/job-guess/cancellation-request')
      .set('Authorization', `Bearer ${dealerToken({ organization_id: 'org-dealer', sub: 'dealer-42' })}`)
      .send({ reason: 'need to cancel' })
      .expect(404);

    expect(jobsService.requestDealerCancellation).toHaveBeenCalledWith(
      'job-guess',
      'need to cancel',
      {
        organizationId: 'org-dealer',
        dealerId: 'dealer-42',
      },
    );
  });

  it('rejects office customer lookup for technician role', async () => {
    await request(app.getHttpServer())
      .get('/office/customers/lookup?phone=03001234567')
      .set('Authorization', `Bearer ${tenantToken({ role: 'technician', sub: 'tech-1' })}`)
      .expect(403);

    expect(jobsService.lookupCustomers).not.toHaveBeenCalled();
  });

  it('passes query and tenant context into office customer lookup', async () => {
    jobsService.lookupCustomers.mockResolvedValue([
      {
        phone: '03001234567',
        vcid: 'vcid-1',
        customer_name: 'Ali Khan',
        address: 'Street 1',
      },
    ]);

    await request(app.getHttpServer())
      .get('/office/customers/lookup?name=Ali&limit=15')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-7', role: 'office_staff' })}`)
      .expect(200);

    expect(jobsService.lookupCustomers).toHaveBeenCalledWith(
      { name: 'Ali', limit: 15 },
      {
        organizationId: 'org-office',
        userId: 'staff-7',
        role: 'office_staff',
      },
    );
  });

  it('passes tenant context into pending schedule queue endpoint', async () => {
    jobsService.listPendingScheduleJobs.mockResolvedValue([{ id: 'job-1', status: 'pending_schedule' }]);

    await request(app.getHttpServer())
      .get('/office/jobs/pending-schedule?limit=25')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'owner-7', role: 'owner' })}`)
      .expect(200);

    expect(jobsService.listPendingScheduleJobs).toHaveBeenCalledWith(
      { limit: 25 },
      {
        organizationId: 'org-office',
        userId: 'owner-7',
        role: 'owner',
      },
    );
  });

  it('passes tenant context into office technician workload endpoint', async () => {
    jobsService.getTechnicianWorkload.mockResolvedValue([
      { technician_id: 'tech-1', active_assignments: 2 },
    ]);

    await request(app.getHttpServer())
      .get('/office/technicians/workload')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-8', role: 'office_staff' })}`)
      .expect(200);

    expect(jobsService.getTechnicianWorkload).toHaveBeenCalledWith({
      organizationId: 'org-office',
      userId: 'staff-8',
      role: 'office_staff',
    });
  });

  it('rejects pending-schedule action for technician role', async () => {
    await request(app.getHttpServer())
      .post('/office/jobs/job-1/schedule')
      .set('Authorization', `Bearer ${tenantToken({ role: 'technician', sub: 'tech-1' })}`)
      .send({
        scheduledAt: '2026-05-06T10:00:00.000Z',
        expectedVersion: 2,
      })
      .expect(403);

    expect(jobsService.schedulePendingJob).not.toHaveBeenCalled();
  });

  it('passes payload and tenant context into pending-schedule action endpoint', async () => {
    jobsService.schedulePendingJob.mockResolvedValue({
      ok: true,
      status: 'assigned',
      version: 4,
    });

    await request(app.getHttpServer())
      .post('/office/jobs/job-1/schedule')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-9', role: 'office_staff' })}`)
      .send({
        scheduledAt: '2026-05-06T10:00:00.000Z',
        expectedVersion: 2,
        technicianId: '85ae80e7-658a-49c6-9070-627379fa9111',
        acknowledgeConflict: true,
      })
      .expect(201);

    expect(jobsService.schedulePendingJob).toHaveBeenCalledWith(
      'job-1',
      {
        scheduledAt: '2026-05-06T10:00:00.000Z',
        expectedVersion: 2,
        technicianId: '85ae80e7-658a-49c6-9070-627379fa9111',
        acknowledgeConflict: true,
      },
      {
        organizationId: 'org-office',
        userId: 'staff-9',
        role: 'office_staff',
      },
    );
  });

  it('rejects cancellation-decision endpoint for technician role', async () => {
    await request(app.getHttpServer())
      .patch('/jobs/job-1/cancellation-request')
      .set('Authorization', `Bearer ${tenantToken({ role: 'technician', sub: 'tech-1' })}`)
      .send({ decision: 'approved', expectedVersion: 3 })
      .expect(403);

    expect(jobsService.decideCancellationRequest).not.toHaveBeenCalled();
  });

  it('rejects cancellation-decision endpoint for dealer token', async () => {
    await request(app.getHttpServer())
      .patch('/jobs/job-1/cancellation-request')
      .set('Authorization', `Bearer ${dealerToken({ organization_id: 'org-1', sub: 'dealer-1' })}`)
      .send({ decision: 'approved', expectedVersion: 3 })
      .expect(401);

    expect(jobsService.decideCancellationRequest).not.toHaveBeenCalled();
  });

  it('passes payload and tenant context into cancellation-decision endpoint', async () => {
    jobsService.decideCancellationRequest.mockResolvedValue({
      ok: true,
      status: 'cancelled',
      version: 5,
    });

    await request(app.getHttpServer())
      .patch('/jobs/job-1/cancellation-request')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-10', role: 'office_staff' })}`)
      .send({ decision: 'approved', expectedVersion: 4 })
      .expect(200);

    expect(jobsService.decideCancellationRequest).toHaveBeenCalledWith(
      'job-1',
      { decision: 'approved', expectedVersion: 4 },
      {
        organizationId: 'org-office',
        userId: 'staff-10',
        role: 'office_staff',
      },
    );
  });

  it('passes rejected decision and context into cancellation-decision endpoint', async () => {
    jobsService.decideCancellationRequest.mockResolvedValue({
      ok: true,
      status: 'in_process',
      version: 5,
    });

    await request(app.getHttpServer())
      .patch('/jobs/job-1/cancellation-request')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'owner-11', role: 'owner' })}`)
      .send({ decision: 'rejected', expectedVersion: 4 })
      .expect(200);

    expect(jobsService.decideCancellationRequest).toHaveBeenCalledWith(
      'job-1',
      { decision: 'rejected', expectedVersion: 4 },
      {
        organizationId: 'org-office',
        userId: 'owner-11',
        role: 'owner',
      },
    );
  });

  it('rejects PATCH /jobs/:id/status for dealer token (rollback guard)', async () => {
    await request(app.getHttpServer())
      .patch('/jobs/job-1/status')
      .set('Authorization', `Bearer ${dealerToken({ organization_id: 'org-1', sub: 'dealer-1' })}`)
      .send({ targetStatus: 'acknowledged', expectedVersion: 3, reason: 'test' })
      .expect(401);

    expect(jobsService.updateStatus).not.toHaveBeenCalled();
  });

  it('forwards rollback payload and tenant context on PATCH /jobs/:id/status for office_staff', async () => {
    jobsService.updateStatus.mockResolvedValue({ ok: true, status: 'acknowledged', version: 6 });

    await request(app.getHttpServer())
      .patch('/jobs/job-1/status')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-20', role: 'office_staff' })}`)
      .send({ targetStatus: 'acknowledged', expectedVersion: 5, reason: 'Wrong address entered' })
      .expect(200);

    expect(jobsService.updateStatus).toHaveBeenCalledWith(
      'job-1',
      { targetStatus: 'acknowledged', expectedVersion: 5, reason: 'Wrong address entered' },
      { organizationId: 'org-office', userId: 'staff-20', role: 'office_staff' },
    );
  });

  it('rejects office quick-entry endpoint for technician role', async () => {
    await request(app.getHttpServer())
      .post('/office/jobs/quick-entry')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'tech-22', role: 'technician' })}`)
      .send({
        type: 'complaint',
        brandId: '85ae80e7-658a-49c6-9070-627379fa9111',
        customerName: 'Ali Khan',
        phone: '03001234567',
        address: 'Street 1',
      })
      .expect(403);

    expect(jobsService.quickEntryCreateJob).not.toHaveBeenCalled();
  });

  it('passes quick-entry payload and context into office quick-entry endpoint', async () => {
    jobsService.quickEntryCreateJob.mockResolvedValue({ ok: true, jobId: 'job-quick-1', status: 'assigned' });

    await request(app.getHttpServer())
      .post('/office/jobs/quick-entry')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-21', role: 'office_staff' })}`)
      .send({
        type: 'complaint',
        brandId: '85ae80e7-658a-49c6-9070-627379fa9111',
        technicianId: '95ae80e7-658a-49c6-9070-627379fa9111',
        customerName: 'Ali Khan',
        phone: '03001234567',
        address: 'Street 1, Lahore',
        issueDescription: 'Cooling issue',
        scheduledAt: '2026-05-06T10:00:00.000Z',
      })
      .expect(201);

    expect(jobsService.quickEntryCreateJob).toHaveBeenCalledWith(
      {
        type: 'complaint',
        brandId: '85ae80e7-658a-49c6-9070-627379fa9111',
        technicianId: '95ae80e7-658a-49c6-9070-627379fa9111',
        customerName: 'Ali Khan',
        phone: '03001234567',
        address: 'Street 1, Lahore',
        issueDescription: 'Cooling issue',
        scheduledAt: '2026-05-06T10:00:00.000Z',
      },
      {
        organizationId: 'org-office',
        userId: 'staff-21',
        role: 'office_staff',
      },
    );
  });

  it('passes tenant context into office brands dropdown endpoint', async () => {
    jobsService.listBrandsForOffice.mockResolvedValue([{ id: 'brand-1', name: 'LG' }]);

    await request(app.getHttpServer())
      .get('/office/brands')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-30', role: 'office_staff' })}`)
      .expect(200);

    expect(jobsService.listBrandsForOffice).toHaveBeenCalledWith({
      organizationId: 'org-office',
      userId: 'staff-30',
      role: 'office_staff',
    });
  });

  it('passes tenant context into office technicians dropdown endpoint', async () => {
    jobsService.listTechniciansForOffice.mockResolvedValue([
      { id: 'tech-1', name: 'Tech One', activeAssignments: 2 },
    ]);

    await request(app.getHttpServer())
      .get('/office/technicians')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'owner-31', role: 'owner' })}`)
      .expect(200);

    expect(jobsService.listTechniciansForOffice).toHaveBeenCalledWith({
      organizationId: 'org-office',
      userId: 'owner-31',
      role: 'owner',
    });
  });

  it('passes tenant context into pending revisit cards endpoint', async () => {
    jobsService.listPendingRevisitCards.mockResolvedValue([{ job_id: 'job-1' }]);

    await request(app.getHttpServer())
      .get('/office/revisits/pending')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'staff-40', role: 'office_staff' })}`)
      .expect(200);

    expect(jobsService.listPendingRevisitCards).toHaveBeenCalledWith({
      organizationId: 'org-office',
      userId: 'staff-40',
      role: 'office_staff',
    });
  });

  it('rejects office reschedule endpoint for technician role', async () => {
    await request(app.getHttpServer())
      .patch('/office/jobs/job-1/reschedule')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'tech-41', role: 'technician' })}`)
      .send({ scheduledAt: '2026-05-09T10:00:00.000Z', expectedVersion: 3 })
      .expect(403);

    expect(jobsService.rescheduleJob).not.toHaveBeenCalled();
  });

  it('passes payload and context into office reschedule endpoint', async () => {
    jobsService.rescheduleJob.mockResolvedValue({ ok: true, status: 'scheduled', version: 4 });

    await request(app.getHttpServer())
      .patch('/office/jobs/job-1/reschedule')
      .set('Authorization', `Bearer ${tenantToken({ organization_id: 'org-office', sub: 'owner-42', role: 'owner' })}`)
      .send({
        scheduledAt: '2026-05-09T10:00:00.000Z',
        expectedVersion: 3,
        technicianId: '95ae80e7-658a-49c6-9070-627379fa9111',
        acknowledgeConflict: true,
      })
      .expect(200);

    expect(jobsService.rescheduleJob).toHaveBeenCalledWith(
      'job-1',
      {
        scheduledAt: '2026-05-09T10:00:00.000Z',
        expectedVersion: 3,
        technicianId: '95ae80e7-658a-49c6-9070-627379fa9111',
        acknowledgeConflict: true,
      },
      {
        organizationId: 'org-office',
        userId: 'owner-42',
        role: 'owner',
      },
    );
  });
});
