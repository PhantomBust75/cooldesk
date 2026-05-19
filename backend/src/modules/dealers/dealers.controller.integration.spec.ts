import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DealersController } from './dealers.controller';
import { DealersService } from './dealers.service';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { DealerGuard } from '../security/dealer.guard';
import { AppConfigService } from '../../shared/app-config.service';
import { DatabaseService } from '../../shared/database.service';

describe('DealersController integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const dealersService: any = {
    listDealers: jest.fn(),
    createDealer: jest.fn(),
    listDealerLinkedBrands: jest.fn(),
    listDealerHistory: jest.fn(),
    getDealerJobById: jest.fn(),
  };

  const db: any = {
    query: jest.fn(),
  };

  const appConfig = {
    jwtUserSecret: 'test-user-secret',
    jwtDealerSecret: 'test-dealer-secret',
  };

  beforeEach(async () => {
    dealersService.createDealer.mockReset();
    dealersService.listDealers.mockReset();
    dealersService.listDealerLinkedBrands.mockReset();
    dealersService.listDealerHistory.mockReset();
    dealersService.getDealerJobById.mockReset();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [{ id: 'org-1' }], rowCount: 1 });

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [DealersController],
      providers: [
        RolesGuard,
        TenantGuard,
        DealerGuard,
        { provide: DealersService, useValue: dealersService },
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

  it('rejects office staff on owner-only POST /dealers', async () => {
    await request(app.getHttpServer())
      .post('/dealers')
      .set('Authorization', `Bearer ${userToken({ role: 'office_staff', sub: 'staff-1' })}`)
      .send({
        name: 'Dealer A',
        email: 'dealer-a@example.com',
        password: 'Password123!',
        brandIds: ['11111111-1111-4111-8111-111111111111'],
      })
      .expect(403);

    expect(dealersService.createDealer).not.toHaveBeenCalled();
  });

  it('allows owner and office_staff to GET /dealers with tenant context', async () => {
    dealersService.listDealers.mockResolvedValue([{ id: 'dealer-1', name: 'Dealer One' }]);

    await request(app.getHttpServer())
      .get('/dealers')
      .set('Authorization', `Bearer ${userToken({ role: 'office_staff', organization_id: 'org-owner', sub: 'staff-1' })}`)
      .expect(200);

    expect(dealersService.listDealers).toHaveBeenCalledWith({
      organizationId: 'org-owner',
      userId: 'staff-1',
      role: 'office_staff',
    });
  });

  it('passes tenant context to owner dealer creation', async () => {
    dealersService.createDealer.mockResolvedValue({ dealerId: 'dealer-created' });

    await request(app.getHttpServer())
      .post('/dealers')
      .set('Authorization', `Bearer ${userToken({ organization_id: 'org-owner', sub: 'owner-99', role: 'owner' })}`)
      .send({
        name: 'Dealer B',
        email: 'dealer-b@example.com',
        password: 'Password123!',
        brandIds: ['11111111-1111-4111-8111-111111111111'],
      })
      .expect(201);

    expect(dealersService.createDealer).toHaveBeenCalledWith(
      {
        name: 'Dealer B',
        email: 'dealer-b@example.com',
        password: 'Password123!',
        brandIds: ['11111111-1111-4111-8111-111111111111'],
      },
      {
        organizationId: 'org-owner',
        userId: 'owner-99',
        role: 'owner',
      },
    );
  });

  it('rejects dealer route access without dealer token', async () => {
    await request(app.getHttpServer())
      .get('/dealer/brands')
      .expect(401);
  });

  it('passes dealer JWT context to GET /dealer/brands', async () => {
    dealersService.listDealerLinkedBrands.mockResolvedValue([{ id: 'brand-1', name: 'Brand 1' }]);

    await request(app.getHttpServer())
      .get('/dealer/brands')
      .set('Authorization', `Bearer ${dealerToken({ organization_id: 'org-dealer', sub: 'dealer-42' })}`)
      .expect(200);

    expect(dealersService.listDealerLinkedBrands).toHaveBeenCalledWith({
      organizationId: 'org-dealer',
      dealerId: 'dealer-42',
    });
  });

  it('passes dealer JWT context and query params to GET /dealer/jobs/history', async () => {
    dealersService.listDealerHistory.mockResolvedValue([{ id: 'job-1' }]);

    await request(app.getHttpServer())
      .get('/dealer/jobs/history?limit=25')
      .set('Authorization', `Bearer ${dealerToken({ organization_id: 'org-dealer', sub: 'dealer-42' })}`)
      .expect(200);

    expect(dealersService.listDealerHistory).toHaveBeenCalledWith(
      { limit: 25 },
      { organizationId: 'org-dealer', dealerId: 'dealer-42' },
    );
  });

  it('returns 404 for guessed cross-org dealer job id', async () => {
    dealersService.getDealerJobById.mockRejectedValue(new NotFoundException('Dealer job not found'));

    await request(app.getHttpServer())
      .get('/dealer/jobs/job-guess')
      .set('Authorization', `Bearer ${dealerToken({ organization_id: 'org-dealer', sub: 'dealer-42' })}`)
      .expect(404);

    expect(dealersService.getDealerJobById).toHaveBeenCalledWith(
      'job-guess',
      { organizationId: 'org-dealer', dealerId: 'dealer-42' },
    );
  });
});
