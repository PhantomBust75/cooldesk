import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { PaymentsService } from './payments.service';
import { RequestContext } from '../security/request-context';

type QueryResult<T> = { rows: T[]; rowCount: number };

function result<T>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length };
}

describe('PaymentsService role authority and lifecycle', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'staff-1',
    role: 'office_staff',
  };

  const ownerCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'owner-1',
    role: 'owner',
  };

  function buildService(overrides?: {
    jobStatus?: string;
    paymentVersion?: number;
    paymentStatus?: 'pending' | 'collected' | 'refunded' | 'disputed';
    updatePaymentRowCount?: number;
    methodInOrg?: boolean;
  }): PaymentsService {
    const {
      jobStatus = 'in_process',
      paymentVersion = 2,
      paymentStatus = 'pending',
      updatePaymentRowCount = 1,
      methodInOrg = true,
    } = overrides ?? {};

    const fakeClient = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        if (text.includes('FROM payments') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'pay-1',
              organization_id: 'org-1',
              job_id: 'job-1',
              amount: '1200',
              payment_method_id: 'method-1',
              status: paymentStatus,
              version: paymentVersion,
            },
          ]);
        }

        if (text.includes('SELECT status') && text.includes('FROM jobs')) {
          return result([{ status: jobStatus }]);
        }

        if (text.includes('FROM payment_methods') && text.includes('SELECT id')) {
          return methodInOrg ? result([{ id: params?.[0] as string }]) : result([]);
        }

        if (text.includes('UPDATE payments') && text.includes('version = version + 1')) {
          if (updatePaymentRowCount === 0) {
            return { rows: [], rowCount: 0 };
          }

          if (text.includes('RETURNING status, version')) {
            return { rows: [{ status: 'collected', version: paymentVersion + 1 }], rowCount: 1 };
          }

          return { rows: [{ version: paymentVersion + 1 }], rowCount: 1 };
        }

        if (text.includes('INSERT INTO job_timeline')) {
          return result([{ id: 'timeline-1' }]);
        }

        if (text.includes('UPDATE jobs') && text.includes("status = 'in_process'")) {
          return { rows: [{ status: 'in_process', version: 5 }], rowCount: 1 };
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: async () => result([]),
    };

    return new PaymentsService(db as never);
  }

  it('rejects office staff amount edits', async () => {
    const service = buildService();

    await expect(
      service.updatePayment(
        'pay-1',
        { expectedVersion: 2, amount: 1500 },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects office staff edits on closed-job payment', async () => {
    const service = buildService({ jobStatus: 'completed' });

    await expect(
      service.updatePayment(
        'pay-1',
        { expectedVersion: 2, paymentMethodId: 'method-2' },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects cross-org payment method at service layer', async () => {
    const service = buildService({ methodInOrg: false });

    await expect(
      service.updatePayment(
        'pay-1',
        { expectedVersion: 2, paymentMethodId: 'method-x' },
        ownerCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns conflict on optimistic lock mismatch', async () => {
    const service = buildService({ updatePaymentRowCount: 0 });

    await expect(
      service.updatePayment(
        'pay-1',
        { expectedVersion: 2, paymentMethodId: 'method-2' },
        ownerCtx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows pending -> collected transition with timeline', async () => {
    const service = buildService({ paymentStatus: 'pending' });

    await expect(
      service.updatePaymentStatus(
        'pay-1',
        { expectedVersion: 2, status: 'collected', reason: 'Cheque confirmed' },
        officeCtx,
      ),
    ).resolves.toEqual({ ok: true, status: 'collected', version: 3 });
  });

  it('blocks owner void decision without reason', async () => {
    const service = buildService({ paymentStatus: 'collected' });

    await expect(
      service.decideOwnerPaymentReversal(
        'job-1',
        { expectedJobVersion: 4, expectedPaymentVersion: 2, decision: 'void' },
        ownerCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
