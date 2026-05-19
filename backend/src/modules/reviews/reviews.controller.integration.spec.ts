import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppConfigService } from '../../shared/app-config.service';
import { DatabaseService } from '../../shared/database.service';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('ReviewsController integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const reviewsService: any = {
    generateReviewLink: jest.fn(),
    submitByToken: jest.fn(),
    listSubmitted: jest.fn(),
    listLowRated: jest.fn(),
  };

  const db: any = {
    query: jest.fn(),
  };

  const appConfig = {
    jwtUserSecret: 'test-user-secret',
  };

  beforeEach(async () => {
    reviewsService.generateReviewLink.mockReset();
    reviewsService.submitByToken.mockReset();
    reviewsService.listSubmitted.mockReset();
    reviewsService.listLowRated.mockReset();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [{ id: 'org-1' }], rowCount: 1 });

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [ReviewsController],
      providers: [
        RolesGuard,
        TenantGuard,
        { provide: ReviewsService, useValue: reviewsService },
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

  it('allows public token submission without auth', async () => {
    reviewsService.submitByToken.mockResolvedValue({ ok: true, jobId: 'job-1', organizationId: 'org-1', isLowRated: false });

    await request(app.getHttpServer())
      .post('/reviews/11111111-1111-1111-1111-111111111111')
      .send({ rating: 5, comment: 'Excellent service' })
      .expect(201);

    expect(reviewsService.submitByToken).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      { rating: 5, comment: 'Excellent service' },
    );
  });

  it('forwards context for review-link generation', async () => {
    reviewsService.generateReviewLink.mockResolvedValue({ ok: true, token: 'tok-1', url: 'https://cooldesk.app/review/tok-1' });

    await request(app.getHttpServer())
      .post('/jobs/22222222-2222-2222-2222-222222222222/review-link')
      .set('Authorization', `Bearer ${userToken({ sub: 'tech-1', role: 'technician', organization_id: 'org-a' })}`)
      .send({})
      .expect(201);

    expect(reviewsService.generateReviewLink).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      { organizationId: 'org-a', userId: 'tech-1', role: 'technician' },
    );
  });

  it('rejects technician from owner review list endpoint', async () => {
    await request(app.getHttpServer())
      .get('/reviews')
      .set('Authorization', `Bearer ${userToken({ sub: 'tech-2', role: 'technician', organization_id: 'org-a' })}`)
      .expect(403);

    expect(reviewsService.listSubmitted).not.toHaveBeenCalled();
  });

  it('allows office staff on low-rated list endpoint', async () => {
    reviewsService.listLowRated.mockResolvedValue([{ id: 'rev-1' }]);

    await request(app.getHttpServer())
      .get('/reviews/low-rated?limit=25')
      .set('Authorization', `Bearer ${userToken({ sub: 'staff-1', role: 'office_staff', organization_id: 'org-a' })}`)
      .expect(200);

    expect(reviewsService.listLowRated).toHaveBeenCalledWith(
      { organizationId: 'org-a', userId: 'staff-1', role: 'office_staff' },
      25,
    );
  });
});
