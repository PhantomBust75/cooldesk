import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './jobs.dto';
import { DealerRequestContext, RequestContext } from '../security/request-context';

type QueryResult<T> = { rows: T[]; rowCount: number };

function result<T>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length };
}

describe('JobsService VCID resolution', () => {
  const baseCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'user-1',
    role: 'office_staff',
  };

  const baseInput: CreateJobDto = {
    type: 'installation',
    source: 'direct',
    brandId: 'brand-1',
    customerName: 'Ali Khan',
    phone: '03001234567',
    address: 'Street 1, Lahore',
    scheduledAt: new Date().toISOString(),
    linkBehavior: 'auto_link',
  };

  function buildService(options: {
    phoneMatches: Array<{ vcid: string; customer_name: string; address: string }>;
    selectedVcid?: string;
  }): JobsService {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM brands')) {
          return result([{ id: 'brand-1' }]);
        }

        if (text.includes('FROM customer_phones cp')) {
          return result(options.phoneMatches);
        }

        if (text.includes('FROM virtual_customers') && text.includes('levenshtein')) {
          return result([]);
        }

        if (text.includes('INSERT INTO jobs')) {
          return result([{ id: 'job-1' }]);
        }

        if (text.includes('INSERT INTO job_timeline')) {
          return result([{ id: 'timeline-1' }]);
        }

        if (text.includes('INSERT INTO virtual_customers')) {
          return result([{ id: 'vcid-new' }]);
        }

        if (text.includes('SELECT id') && text.includes('FROM users')) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    return new JobsService(db as never, config as never);
  }

  it('auto-links when there is a single phone match', async () => {
    const service = buildService({
      phoneMatches: [
        { vcid: 'vcid-1', customer_name: 'Ali Khan', address: 'Street 1, Lahore' },
      ],
    });

    await expect(service.createByUser(baseInput, baseCtx)).resolves.toEqual({ jobId: 'job-1' });
  });

  it('throws 409 conflict when multiple phone matches exist without selectedVcid', async () => {
    const service = buildService({
      phoneMatches: [
        { vcid: 'vcid-1', customer_name: 'Ali Khan', address: 'Street 1, Lahore' },
        { vcid: 'vcid-2', customer_name: 'A. Khan', address: 'Street 2, Lahore' },
      ],
    });

    await expect(service.createByUser(baseInput, baseCtx)).rejects.toBeInstanceOf(ConflictException);
  });

  it('links selected VCID when retry includes selectedVcid', async () => {
    const service = buildService({
      phoneMatches: [
        { vcid: 'vcid-1', customer_name: 'Ali Khan', address: 'Street 1, Lahore' },
        { vcid: 'vcid-2', customer_name: 'A. Khan', address: 'Street 2, Lahore' },
      ],
      selectedVcid: 'vcid-2',
    });

    const retryInput: CreateJobDto = {
      ...baseInput,
      selectedVcid: 'vcid-2',
    };

    await expect(service.createByUser(retryInput, baseCtx)).resolves.toEqual({ jobId: 'job-1' });
  });
});

describe('listPendingScheduleJobs', () => {
  it('should include complaint jobs with status=new and not filter by via_dealer', async () => {
    const fakeDb = {
      query: jest.fn(async (_sql: string, _params: unknown[]) =>
        result([
          {
            id: 'job-1',
            type: 'complaint',
            status: 'new',
            technician_id: null as null,
            scheduled_at: null as null,
            customer_name: 'Alice',
          },
        ]),
      ),
      withTransaction: jest.fn(),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(fakeDb as unknown as any, config as unknown as any);

    await service.listPendingScheduleJobs(
      { limit: 10 } as { limit: number },
      { organizationId: 'org-1' } as unknown as RequestContext
    );

    const calledSql: string = fakeDb.query.mock.calls[0][0] as string;
    expect(calledSql).toContain("j.status = 'new'");
    expect(calledSql).not.toContain("j.source = 'via_dealer'");
  });
});

describe('JobsService dealer VCID conflict policy', () => {
  const dealerCtx: DealerRequestContext = {
    organizationId: 'org-1',
    dealerId: 'dealer-2',
  };

  it('creates internal VCID review event when dealer job overlaps another dealer VCID', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM brands')) {
          return result([{ id: 'brand-1' }]);
        }

        if (text.includes('FROM dealers') && text.includes('is_active = TRUE')) {
          return result([{ id: 'dealer-2' }]);
        }

        if (text.includes('FROM dealer_brands')) {
          return result([{ dealer_id: 'dealer-2' }]);
        }

        if (text.includes('FROM customer_phones cp')) {
          return result([{ vcid: 'vcid-1', customer_name: 'Ali', address: 'Street 1' }]);
        }

        if (text.includes('SELECT COUNT(*)::text AS count') && text.includes('FROM jobs')) {
          return result([{ count: '0' }]);
        }

        if (text.includes('INSERT INTO jobs')) {
          return result([{ id: 'job-1' }]);
        }

        if (text.includes('FROM jobs j') && text.includes("j.source = 'via_dealer'")) {
          return result([{ id: 'old-job-1' }]);
        }

        if (text.includes("INSERT INTO job_timeline") && text.includes("'vcid_review_required'")) {
          return result([{ id: 'timeline-vcid-1' }]);
        }

        if (text.includes('INSERT INTO notifications')) {
          return result([]);
        }

        if (text.includes('INSERT INTO analytics_dealer_daily')) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.createByDealer(
        {
          type: 'complaint',
          source: 'via_dealer',
          brandId: 'brand-1',
          customerName: 'Ali Khan',
          phone: '03001234567',
          address: 'Street 1, Lahore',
          issueDescription: 'Cooling issue',
        },
        dealerCtx,
      ),
    ).resolves.toEqual({ jobId: 'job-1' });

    const timelineCall = fakeClient.query.mock.calls.find(
      (args: unknown[]) =>
        typeof args[0] === 'string'
        && (args[0] as string).includes("'vcid_review_required'"),
    );
    expect(timelineCall).toBeDefined();
  });
});

describe('JobsService lifecycle rules', () => {
  const techCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'tech-1',
    role: 'technician',
  };

  function buildLifecycleService(options: {
    jobStatus: string;
    roleVersionMatch?: boolean;
  }): JobsService {
    const fakeClient = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: options.jobStatus,
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 3,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('FROM job_cancellation_requests') && text.includes("status = 'pending'")) {
          return result([]);
        }

        if (text.includes('UPDATE jobs') && text.includes('version = version + 1')) {
          if (options.roleVersionMatch === false) {
            return result([]);
          }

          const target = text.includes("status = 'cancelled'")
            ? 'cancelled'
            : (params?.[2] as string | undefined) ?? 'assigned';
          return result([{ status: target, version: 4 }]);
        }

        if (text.includes('INSERT INTO job_timeline')) {
          return result([{ id: 'timeline-1' }]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    return new JobsService(db as never, config as never);
  }

  it('denies technician rollback attempts', async () => {
    const service = buildLifecycleService({ jobStatus: 'in_process' });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'in_transit', expectedVersion: 3, reason: 'rollback attempt' },
        techCtx,
      ),
    ).rejects.toThrow('Only office staff can perform one-step rollback');
  });

  it('returns optimistic lock conflict on version mismatch', async () => {
    const officeCtx: RequestContext = {
      organizationId: 'org-1',
      userId: 'staff-1',
      role: 'office_staff',
    };
    const service = buildLifecycleService({ jobStatus: 'assigned', roleVersionMatch: false });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'acknowledged', expectedVersion: 3 },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks dealer withdrawal when job is past initial state', async () => {
    const dealerCtx: DealerRequestContext = {
      organizationId: 'org-1',
      dealerId: 'dealer-1',
    };

    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes("source = 'via_dealer'")) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'assigned',
              source: 'via_dealer',
              dealer_id: 'dealer-1',
              technician_id: null,
              version: 1,
              is_deleted: false,
            },
          ]);
        }
        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.dealerWithdrawInitialJob('job-1', 'cancel now', dealerCtx),
    ).rejects.toThrow('Dealer can withdraw directly only in initial state');
  });

  it('allows dealer cancellation request submission after prior rejected request', async () => {
    const dealerCtx: DealerRequestContext = {
      organizationId: 'org-1',
      dealerId: 'dealer-1',
    };

    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes("source = 'via_dealer'")) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'assigned',
              source: 'via_dealer',
              dealer_id: 'dealer-1',
              technician_id: null,
              version: 1,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('INSERT INTO job_cancellation_requests')) {
          return result([{ id: 'req-new' }]);
        }

        if (text.includes("UPDATE jobs") && text.includes("status = 'cancellation_requested'")) {
          return result([{ status: 'cancellation_requested' }]);
        }

        if (text.includes('INSERT INTO job_timeline')) {
          return result([{ id: 'timeline-1' }]);
        }

        if (text.includes('FROM users') && text.includes("role IN ('owner', 'office_staff')")) {
          return result([{ id: 'owner-1' }, { id: 'staff-1' }]);
        }

        if (text.includes('INSERT INTO notifications')) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.requestDealerCancellation('job-1', 'Need cancellation after rejected prior request', dealerCtx),
    ).resolves.toEqual({ ok: true, status: 'cancellation_requested' });
  });
});

// ─────────────────────────────────────────────
// Phase 03 – Assignment & Scheduling Conflicts
// ─────────────────────────────────────────────

describe('JobsService Phase 03 – assignTechnician', () => {
  const ctx: RequestContext = {
    organizationId: 'org-1',
    userId: 'staff-1',
    role: 'office_staff',
  };

  function buildAssignService(options: {
    jobExists?: boolean;
    techExists?: boolean;
    conflictJobIds?: string[];
    scheduledAt?: string | null;
  }) {
    const { jobExists = true, techExists = true, conflictJobIds = [], scheduledAt = '2026-05-05T10:00:00Z' } = options;

    const queries: Array<{ text: string; result: unknown }> = [];
    const fakeClient = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        // job fetch
        if (text.includes('FROM jobs WHERE id') && text.includes('is_deleted = FALSE')) {
          if (!jobExists) return result([]);
          return result([{ id: params?.[0], organization_id: 'org-1', status: 'scheduled', is_deleted: false, scheduled_at: scheduledAt }]);
        }
        // technician fetch
        if (text.includes("role = 'technician'")) {
          if (!techExists) return result([]);
          return result([{ id: params?.[0], organization_id: 'org-1', is_active: true, is_deleted: false }]);
        }
        // conflict check
        if (text.includes('JOIN job_assignments ja')) {
          return result(conflictJobIds.map(id => ({ id })));
        }
        // deactivate old assignment
        if (text.includes('SET is_active = FALSE')) return result([]);
        // insert new assignment
        if (text.includes('INSERT INTO job_assignments')) return result([{ id: 'assign-1' }]);
        // update job status
        if (text.includes("SET status = 'assigned'")) return result([{ id: params?.[0], status: 'assigned', version: 2 }]);
        // timeline
        if (text.includes('INSERT INTO job_timeline')) return result([]);
        // notification
        if (text.includes('INSERT INTO notifications')) return result([]);
        // scheduling_conflicts
        if (text.includes('INSERT INTO scheduling_conflicts')) return result([]);
        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };
    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };
    return { service: new JobsService(db as never, config as never), fakeClient };
  }

  it('rejects assignment if job not found in org', async () => {
    const { service } = buildAssignService({ jobExists: false });
    await expect(service.assignTechnician('job-x', 'tech-1', false, ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects assignment if technician is inactive, deleted, or cross-org', async () => {
    const { service } = buildAssignService({ techExists: false });
    await expect(service.assignTechnician('job-1', 'tech-x', false, ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns conflict warning and does NOT assign if conflicts exist and acknowledgeConflict=false', async () => {
    const { service } = buildAssignService({ conflictJobIds: ['job-2'] });
    const res = await service.assignTechnician('job-1', 'tech-1', false, ctx);
    expect(res.conflictJobIds).toEqual(['job-2']);
  });

  it('assigns successfully and returns empty conflictJobIds when no conflicts', async () => {
    const { service } = buildAssignService({ conflictJobIds: [] });
    const res = await service.assignTechnician('job-1', 'tech-1', false, ctx);
    expect(res.conflictJobIds).toEqual([]);
  });

  it('assigns and logs canonical conflict row when acknowledgeConflict=true', async () => {
    const { service, fakeClient } = buildAssignService({ conflictJobIds: ['job-zzz'] });
    await service.assignTechnician('job-aaa', 'tech-1', true, ctx);
    const callArgs = (fakeClient.query as jest.Mock).mock.calls;
    const conflictInsert = callArgs.find((args: unknown[]) => {
      const text = args[0] as string;
      return text.includes('INSERT INTO scheduling_conflicts');
    });
    expect(conflictInsert).toBeDefined();
    // canonical ordering: lesser UUID first
    const params = conflictInsert![1] as string[];
    expect(params[0] < params[1]).toBe(true);
  });

  it('canonical ordering: [a,b].sort() is deterministic regardless of input order', () => {
    const a = 'aaa-job';
    const b = 'zzz-job';
    const [first, second] = [a, b].sort();
    expect(first < second).toBe(true);
    // inverse order input should produce same result
    const [first2, second2] = [b, a].sort();
    expect(first2).toBe(first);
    expect(second2).toBe(second);
  });

  it('skips conflict detection if job has no scheduled_at', async () => {
    const { service } = buildAssignService({ conflictJobIds: ['job-2'], scheduledAt: null });
    const res = await service.assignTechnician('job-1', 'tech-1', false, ctx);
    // With no scheduled_at, conflict check is skipped → assigns successfully
    expect(res.conflictJobIds).toEqual([]);
  });

  it('deactivates previous assignment history row (preserves it with is_active=FALSE)', async () => {
    const { service, fakeClient } = buildAssignService({});
    await service.assignTechnician('job-1', 'tech-1', false, ctx);
    const deactivateCall = (fakeClient.query as jest.Mock).mock.calls.find((args: unknown[]) =>
      (args[0] as string).includes('SET is_active = FALSE'),
    );
    expect(deactivateCall).toBeDefined();
  });

  it('uses org config value for conflict window (not hardcoded 120)', async () => {
    const { service, fakeClient } = buildAssignService({ conflictJobIds: [] });
    const config = (service as any).configService;
    await service.assignTechnician('job-1', 'tech-1', false, ctx);
    expect(config.getInt).toHaveBeenCalledWith('org-1', 'standard_job_duration_mins', 120);
  });
});

describe('JobsService Phase 03 – acknowledgeJob', () => {
  const techCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'tech-1',
    role: 'technician',
  };

  function buildAckService(options: { jobExists?: boolean; assignmentExists?: boolean; versionMismatch?: boolean }) {
    const { jobExists = true, assignmentExists = true, versionMismatch = false } = options;
    const fakeClient = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        if (text.includes('FROM jobs WHERE id') && text.includes('is_deleted = FALSE')) {
          if (!jobExists) return result([]);
          return result([{ id: 'job-1', status: 'assigned', version: 5 }]);
        }
        if (text.includes('FROM job_assignments WHERE job_id')) {
          if (!assignmentExists) return result([]);
          return result([{ id: 'assign-1' }]);
        }
        if (text.includes('SET acknowledged_at')) return result([]);
        if (text.includes("SET status = 'acknowledged'")) {
          if (versionMismatch) return { rows: [], rowCount: 0 };
          return { rows: [{ id: 'job-1' }], rowCount: 1 };
        }
        if (text.includes('INSERT INTO job_timeline')) return result([]);
        return result([]);
      }),
    };
    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };
    const config = { getInt: jest.fn() };
    return new JobsService(db as never, config as never);
  }

  it('throws NotFoundException when job not found', async () => {
    const service = buildAckService({ jobExists: false });
    await expect(service.acknowledgeJob('job-x', techCtx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when technician has no active assignment', async () => {
    const service = buildAckService({ assignmentExists: false });
    await expect(service.acknowledgeJob('job-1', techCtx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ConflictException on optimistic lock mismatch', async () => {
    const service = buildAckService({ versionMismatch: true });
    await expect(service.acknowledgeJob('job-1', techCtx)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns ok:true on successful acknowledgment', async () => {
    const service = buildAckService({});
    await expect(service.acknowledgeJob('job-1', techCtx)).resolves.toEqual({ ok: true });
  });
});

describe('JobsService Phase 04 – mobile sync and undo', () => {
  const techCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'tech-1',
    role: 'technician',
  };

  it('treats duplicate client_action_id as idempotent replay', async () => {
    let firstInsert = true;
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('INSERT INTO mobile_sync_events')) {
          if (firstInsert) {
            firstInsert = false;
            return result([{ id: 'sync-1' }]);
          }
          return result([]);
        }
        if (text.includes('FROM job_assignments')) return result([{ id: 'assign-1' }]);
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'assigned',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 1,
              is_deleted: false,
            },
          ]);
        }
        if (text.includes("UPDATE jobs") && text.includes("SET status = $3")) {
          return result([{ status: 'acknowledged', version: 2 }]);
        }
        if (text.includes('INSERT INTO job_timeline')) return result([]);
        return result([]);
      }),
    };

    const db = { withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient) };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fallback: number) => fallback) };
    const service = new JobsService(db as never, config as never);

    const first = await service.syncTechnicianAction(
      'job-1',
      {
        clientActionId: 'action-1',
        expectedVersion: 1,
        actionType: 'status_transition',
        queueSubmittedAt: new Date().toISOString(),
        payload: { targetStatus: 'acknowledged' },
      },
      techCtx,
    );

    const replay = await service.syncTechnicianAction(
      'job-1',
      {
        clientActionId: 'action-1',
        expectedVersion: 1,
        actionType: 'status_transition',
        queueSubmittedAt: new Date().toISOString(),
        payload: { targetStatus: 'acknowledged' },
      },
      techCtx,
    );

    expect(first.ok).toBe(true);
    expect(replay).toEqual({ ok: true, duplicate: true });
  });

  it('writes Delayed Sync system_event when queueSubmittedAt is older than 60s', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('INSERT INTO mobile_sync_events')) return result([{ id: 'sync-1' }]);
        if (text.includes('FROM job_assignments')) return result([{ id: 'assign-1' }]);
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'assigned',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 1,
              is_deleted: false,
            },
          ]);
        }
        if (text.includes("UPDATE jobs") && text.includes("SET status = $3")) {
          return result([{ status: 'acknowledged', version: 2 }]);
        }
        if (text.includes('INSERT INTO job_timeline')) return result([]);
        return result([]);
      }),
    };

    const db = { withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient) };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fallback: number) => fallback) };
    const service = new JobsService(db as never, config as never);

    const oldTimestamp = new Date(Date.now() - 61_000).toISOString();
    await service.syncTechnicianAction(
      'job-1',
      {
        clientActionId: 'action-old',
        expectedVersion: 1,
        actionType: 'status_transition',
        queueSubmittedAt: oldTimestamp,
        payload: { targetStatus: 'acknowledged' },
      },
      techCtx,
    );

    const delayedSyncCall = (fakeClient.query as jest.Mock).mock.calls.find(
      (args: unknown[]) => (args[0] as string).includes("'system_event'") && (args[0] as string).includes('Delayed Sync'),
    );
    expect(delayedSyncCall).toBeDefined();
  });

  it('rejects undo when server window is expired', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM job_assignments')) return result([{ id: 'assign-1' }]);
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'completed',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 4,
              is_deleted: false,
            },
          ]);
        }
        return result([]);
      }),
    };

    const db = { withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient) };
    const config = { getInt: jest.fn(async () => 60) };
    const service = new JobsService(db as never, config as never);

    const tooOld = new Date(Date.now() - 65_000).toISOString();
    await expect(
      service.undoTechnicianAction(
        'job-1',
        { expectedVersion: 4, transitionOccurredAt: tooOld, revertToStatus: 'in_process' },
        techCtx,
      ),
    ).rejects.toThrow('Undo window expired');
  });

  it('undo for needs_revisit deletes revisit row and amber alert notification', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM job_assignments')) return result([{ id: 'assign-1' }]);
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'needs_revisit',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 4,
              is_deleted: false,
            },
          ]);
        }
        if (text.includes('UPDATE jobs') && text.includes('RETURNING status, version')) {
          return result([{ status: 'in_process', version: 5 }]);
        }
        if (text.includes('INSERT INTO job_timeline')) return result([]);
        return result([]);
      }),
    };

    const db = { withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient) };
    const config = { getInt: jest.fn(async () => 60) };
    const service = new JobsService(db as never, config as never);

    await service.undoTechnicianAction(
      'job-1',
      {
        expectedVersion: 4,
        transitionOccurredAt: new Date().toISOString(),
        revertToStatus: 'in_process',
      },
      techCtx,
    );

    const hasRevisitDelete = (fakeClient.query as jest.Mock).mock.calls.some(
      (args: unknown[]) => (args[0] as string).includes('DELETE FROM revisits'),
    );
    const hasAlertDelete = (fakeClient.query as jest.Mock).mock.calls.some(
      (args: unknown[]) => (args[0] as string).includes("event_type = 'revisit_pending_scheduling'"),
    );
    expect(hasRevisitDelete).toBe(true);
    expect(hasAlertDelete).toBe(true);
  });

  it('undo for completed removes payment atomically', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM job_assignments')) return result([{ id: 'assign-1' }]);
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'installation',
              status: 'completed',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 7,
              is_deleted: false,
            },
          ]);
        }
        if (text.includes('UPDATE jobs') && text.includes('RETURNING status, version')) {
          return result([{ status: 'in_process', version: 8 }]);
        }
        if (text.includes('INSERT INTO job_timeline')) return result([]);
        return result([]);
      }),
    };

    const db = { withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient) };
    const config = { getInt: jest.fn(async () => 60) };
    const service = new JobsService(db as never, config as never);

    await service.undoTechnicianAction(
      'job-1',
      {
        expectedVersion: 7,
        transitionOccurredAt: new Date().toISOString(),
        revertToStatus: 'in_process',
      },
      techCtx,
    );

    const paymentDelete = (fakeClient.query as jest.Mock).mock.calls.some(
      (args: unknown[]) => (args[0] as string).includes('DELETE FROM payments'),
    );
    expect(paymentDelete).toBe(true);
  });

  it('uses org-config undo_window_seconds and punctuality_grace_period_mins', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM job_assignments')) return result([{ id: 'assign-1' }]);
        if (text.includes('INSERT INTO mobile_sync_events')) return result([{ id: 'sync-1' }]);
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'in_transit',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 2,
              is_deleted: false,
            },
          ]);
        }
        if (text.includes('COALESCE(')) {
          return result([{ scheduled_at: new Date().toISOString() }]);
        }
        if (text.includes("SET status = 'in_process'")) return result([{ status: 'in_process', version: 3 }]);
        if (text.includes('INSERT INTO job_timeline')) return result([]);
        if (text.includes('UPDATE jobs') && text.includes('RETURNING status, version')) return result([{ status: 'in_process', version: 3 }]);
        return result([]);
      }),
    };

    const db = { withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient) };
    const config = {
      getInt: jest.fn(async (_orgId: string, key: string, fallback: number) => {
        if (key === 'undo_window_seconds') return 75;
        if (key === 'punctuality_grace_period_mins') return 20;
        return fallback;
      }),
    };
    const service = new JobsService(db as never, config as never);

    await service.syncTechnicianAction(
      'job-1',
      {
        clientActionId: 'action-punctual',
        expectedVersion: 2,
        actionType: 'status_transition',
        queueSubmittedAt: new Date().toISOString(),
        payload: { targetStatus: 'in_process' },
      },
      techCtx,
    );

    await service.undoTechnicianAction(
      'job-1',
      {
        expectedVersion: 2,
        transitionOccurredAt: new Date().toISOString(),
        revertToStatus: 'in_process',
      },
      {
        ...techCtx,
      },
    ).catch(() => {
      // ignore status preconditions for this assertion-only test
    });

    expect(config.getInt).toHaveBeenCalledWith('org-1', 'punctuality_grace_period_mins', 15);
    expect(config.getInt).toHaveBeenCalledWith('org-1', 'undo_window_seconds', 60);
  });
});

describe('JobsService Phase 04 – no-show detection', () => {
  it('flags only org-scoped no-show jobs', async () => {
    const officeCtx: RequestContext = {
      organizationId: 'org-1',
      userId: 'staff-1',
      role: 'office_staff',
    };

    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('SELECT id') && text.includes('visit_outcome IS NULL')) {
          return result([{ id: 'job-1' }]);
        }
        if (text.includes('UPDATE jobs') && text.includes("visit_outcome = 'no_show'")) {
          return result([{ id: 'job-1' }]);
        }
        if (text.includes('FROM users') && text.includes("role IN ('owner', 'office_staff')")) {
          return result([{ id: 'owner-1' }, { id: 'staff-2' }]);
        }
        if (text.includes('INSERT INTO notifications')) return result([]);
        return result([]);
      }),
    };

    const db = { withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient) };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fallback: number) => fallback) };
    const service = new JobsService(db as never, config as never);

    const res = await service.detectNoShows(officeCtx);
    expect(res).toEqual({ ok: true, flaggedJobs: 1 });

    const selectCall = (fakeClient.query as jest.Mock).mock.calls.find(
      (args: unknown[]) => (args[0] as string).includes('SELECT id') && (args[0] as string).includes('visit_outcome IS NULL'),
    );
    expect(selectCall?.[1]).toEqual(['org-1']);
  });
});

describe('JobsService Phase 05 – atomic completion payment flow', () => {
  const techCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'tech-1',
    role: 'technician',
  };

  it('requires payment fields when transitioning to completed', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'installation',
              status: 'in_process',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 3,
              is_deleted: false,
            },
          ]);
        }
        if (text.includes('FROM job_cancellation_requests')) return result([]);
        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'completed', expectedVersion: 3 },
        techCtx,
      ),
    ).rejects.toThrow('paymentAmount is required for completion/resolution');
  });

  it('rejects duplicate payment creation on concurrent completion retry', async () => {
    const duplicateError = Object.assign(new Error('duplicate key'), { code: '23505' });
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'installation',
              status: 'in_process',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 3,
              is_deleted: false,
            },
          ]);
        }
        if (text.includes('FROM job_cancellation_requests')) return result([]);
        if (text.includes('FROM payment_methods')) return result([{ id: 'method-1' }]);
        if (text.includes('UPDATE jobs') && text.includes('RETURNING status, version')) {
          return result([{ status: 'completed', version: 4 }]);
        }
        if (text.includes('INSERT INTO payments')) {
          throw duplicateError;
        }
        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) =>
        work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.updateStatus(
        'job-1',
        {
          targetStatus: 'completed',
          expectedVersion: 3,
          paymentAmount: 2000,
          paymentMethodId: 'method-1',
        },
        techCtx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('JobsService Phase 06 revisits', () => {
    const officeCtx: RequestContext = {
      organizationId: 'org-1',
      userId: 'staff-1',
      role: 'office_staff',
    };

    it('requires revisitReason when moving complaint to needs_revisit', async () => {
      const fakeClient = {
        query: jest.fn(async (text: string) => {
          if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
            return result([
              {
                id: 'job-1',
                organization_id: 'org-1',
                type: 'complaint',
                status: 'in_process',
                source: 'direct',
                dealer_id: null,
                technician_id: 'tech-1',
                version: 4,
                is_deleted: false,
              },
            ]);
          }
          if (text.includes('FROM job_cancellation_requests')) return result([]);
          return result([]);
        }),
      };

      const db = {
        withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      };

      const config = {
        getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
      };

      const service = new JobsService(db as never, config as never);

      await expect(
        service.updateStatus('job-1', { targetStatus: 'needs_revisit', expectedVersion: 4 }, officeCtx),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('schedules revisit and advances job to revisit_scheduled', async () => {
      const fakeClient = {
        query: jest.fn(async (text: string) => {
          if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
            return result([
              {
                id: 'job-1',
                organization_id: 'org-1',
                type: 'complaint',
                status: 'needs_revisit',
                source: 'direct',
                dealer_id: null,
                technician_id: 'tech-old',
                version: 5,
                is_deleted: false,
              },
            ]);
          }
          if (text.includes('FROM users') && text.includes("role = 'technician'")) {
            return result([{ id: 'tech-2' }]);
          }
          if (text.includes('FROM revisits') && text.includes('FOR UPDATE')) {
            return result([{ id: 'rev-1', scheduled_at: null }]);
          }
          if (text.includes("UPDATE jobs") && text.includes("status = 'revisit_scheduled'")) {
            return result([{ status: 'revisit_scheduled', version: 6 }]);
          }
          if (text.includes('INSERT INTO job_timeline')) {
            return result([{ id: 'timeline-1' }]);
          }
          return result([]);
        }),
      };

      const db = {
        withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      };

      const config = {
        getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
      };

      const service = new JobsService(db as never, config as never);

      await expect(
        service.scheduleRevisit(
          'job-1',
          {
            revisitId: 'rev-1',
            scheduledAt: new Date().toISOString(),
            technicianId: 'tech-2',
            expectedVersion: 5,
          },
          officeCtx,
        ),
      ).resolves.toEqual({ ok: true, status: 'revisit_scheduled', version: 6, revisitId: 'rev-1' });
    });
  });
});

describe('JobsService Phase 06 tenant isolation', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-1',
    userId: 'staff-1',
    role: 'office_staff',
  };

  it('rejects revisit scheduling when technician belongs to another organization', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'needs_revisit',
              source: 'direct',
              dealer_id: null,
              technician_id: null,
              version: 2,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('FROM users') && text.includes("role = 'technician'")) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.scheduleRevisit(
        'job-1',
        {
          revisitId: 'rev-1',
          scheduledAt: new Date().toISOString(),
          technicianId: 'tech-cross-org',
          expectedVersion: 2,
        },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects revisit scheduling when revisit does not belong to organization/job scope', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-1',
              type: 'complaint',
              status: 'needs_revisit',
              source: 'direct',
              dealer_id: null,
              technician_id: null,
              version: 2,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('FROM users') && text.includes("role = 'technician'")) {
          return result([{ id: 'tech-1' }]);
        }

        if (text.includes('FROM revisits') && text.includes('FOR UPDATE')) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.scheduleRevisit(
        'job-1',
        {
          revisitId: 'rev-cross-org',
          scheduledAt: new Date().toISOString(),
          technicianId: 'tech-1',
          expectedVersion: 2,
        },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects needs_revisit transition when job is not visible in current organization', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.updateStatus(
        'job-cross-org',
        {
          targetStatus: 'needs_revisit',
          expectedVersion: 1,
          revisitReason: 'issue_recurring',
        },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('JobsService Phase 09 pending-schedule action', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-office',
    userId: 'staff-1',
    role: 'office_staff',
  };

  it('rejects scheduling action when job is not in pending_schedule', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-office',
              type: 'installation',
              status: 'scheduled',
              source: 'via_dealer',
              dealer_id: 'dealer-1',
              technician_id: null,
              version: 2,
              is_deleted: false,
            },
          ]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.schedulePendingJob(
        'job-1',
        {
          scheduledAt: '2026-05-06T10:00:00.000Z',
          expectedVersion: 2,
        },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects cross-org technician on pending-schedule assignment', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-office',
              type: 'installation',
              status: 'pending_schedule',
              source: 'via_dealer',
              dealer_id: 'dealer-1',
              technician_id: null,
              version: 2,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('FROM users') && text.includes("role = 'technician'")) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.schedulePendingJob(
        'job-1',
        {
          scheduledAt: '2026-05-06T10:00:00.000Z',
          expectedVersion: 2,
          technicianId: 'tech-cross-org',
        },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('schedules and assigns pending dealer installation with dual transitions', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-office',
              type: 'installation',
              status: 'pending_schedule',
              source: 'via_dealer',
              dealer_id: 'dealer-1',
              technician_id: null,
              version: 2,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('FROM users') && text.includes("role = 'technician'")) {
          return result([{ id: 'tech-1' }]);
        }

        if (text.includes("UPDATE jobs") && text.includes("SET status = 'scheduled'")) {
          return result([{ status: 'scheduled', version: 3 }]);
        }

        if (text.includes('SELECT j.id') && text.includes('FROM jobs j')) {
          return result([]);
        }

        if (text.includes("UPDATE jobs") && text.includes("SET status = 'assigned'")) {
          return result([{ status: 'assigned', version: 4 }]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };

    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    const service = new JobsService(db as never, config as never);

    await expect(
      service.schedulePendingJob(
        'job-1',
        {
          scheduledAt: '2026-05-06T10:00:00.000Z',
          expectedVersion: 2,
          technicianId: 'tech-1',
          acknowledgeConflict: true,
        },
        officeCtx,
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: 'assigned',
      version: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 09 — Tenant isolation: lookupCustomers must never cross org boundary
// ---------------------------------------------------------------------------
describe('JobsService Phase 09 tenant isolation — lookupCustomers', () => {
  const orgACtx: RequestContext = {
    organizationId: 'org-A',
    userId: 'user-A',
    role: 'office_staff',
  };

  function buildServiceCapturingParams(): { service: JobsService; capturedParams: unknown[][] } {
    const capturedParams: unknown[][] = [];
    const db = {
      query: jest.fn(async (_text: string, params: unknown[]) => {
        capturedParams.push(params);
        return { rows: [], rowCount: 0 };
      }),
    };
    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };
    return {
      service: new JobsService(db as never, config as never),
      capturedParams,
    };
  }

  it('always passes organization_id as the first bind parameter in every query', async () => {
    const { service, capturedParams } = buildServiceCapturingParams();

    await service.lookupCustomers({ phone: '03001111111' }, orgACtx);

    expect(capturedParams.length).toBeGreaterThan(0);
    for (const params of capturedParams) {
      expect(params[0]).toBe('org-A');
    }
  });

  it('uses ctx.organizationId — not any other value — when resolving by name', async () => {
    const { service, capturedParams } = buildServiceCapturingParams();

    await service.lookupCustomers({ name: 'Test Customer' }, orgACtx);

    for (const params of capturedParams) {
      expect(params[0]).toBe('org-A');
      expect(params[0]).not.toBe('org-B');
    }
  });

  it('rejects when neither phone nor name is provided', async () => {
    const db = { query: jest.fn() };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    await expect(service.lookupCustomers({}, orgACtx)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('caps limit at 50 regardless of requested limit', async () => {
    const capturedParams: unknown[][] = [];
    const db = {
      query: jest.fn(async (_text: string, params: unknown[]) => {
        capturedParams.push(params);
        return { rows: [], rowCount: 0 };
      }),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    await service.lookupCustomers({ phone: '03001111111', limit: 999 }, orgACtx);

    // The last param in the lookup query is the LIMIT — should be capped at 50
    const lastCall = capturedParams[capturedParams.length - 1];
    expect(lastCall[lastCall.length - 1]).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Phase 09 — decideCancellationRequest service unit tests
// ---------------------------------------------------------------------------
describe('JobsService Phase 09 decideCancellationRequest', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-decide',
    userId: 'staff-1',
    role: 'office_staff',
  };

  function buildDecideService(options: {
    jobStatus: string;
    jobVersion: number;
    requestRow?: {
      id: string;
      requested_by_dealer_id: string | null;
      reason: string;
      status_at_request: string | null;
    } | null;
    updateRows?: { status: string; version: number }[];
  }): JobsService {
    const reqRow = options.requestRow !== undefined
      ? options.requestRow
      : {
          id: 'req-1',
          requested_by_dealer_id: 'dealer-1',
          reason: 'Customer request',
          status_at_request: 'in_process',
        };

    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-decide',
              type: 'complaint',
              status: options.jobStatus,
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: options.jobVersion,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('FROM job_cancellation_requests')) {
          return reqRow ? result([reqRow]) : result([]);
        }

        if (text.includes('UPDATE job_cancellation_requests')) {
          return result([]);
        }

        if (text.includes('UPDATE jobs')) {
          return result(options.updateRows ?? [{ status: 'cancelled', version: options.jobVersion + 1 }]);
        }

        if (text.includes('INSERT INTO job_timeline')) {
          return result([]);
        }

        if (text.includes('INSERT INTO notifications')) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    return new JobsService(db as never, config as never);
  }

  it('throws NotFoundException when no pending cancellation request exists', async () => {
    const service = buildDecideService({
      jobStatus: 'cancellation_requested',
      jobVersion: 3,
      requestRow: null,
    });

    await expect(
      service.decideCancellationRequest(
        'job-1',
        { decision: 'approved', expectedVersion: 3 },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('approved decision cancels the job and returns status=cancelled', async () => {
    const service = buildDecideService({
      jobStatus: 'cancellation_requested',
      jobVersion: 3,
      updateRows: [{ status: 'cancelled', version: 4 }],
    });

    const result = await service.decideCancellationRequest(
      'job-1',
      { decision: 'approved', expectedVersion: 3 },
      officeCtx,
    );

    expect(result).toMatchObject({ ok: true, status: 'cancelled', version: 4 });
  });

  it('throws ConflictException on approved decision when optimistic lock fails', async () => {
    const service = buildDecideService({
      jobStatus: 'cancellation_requested',
      jobVersion: 3,
      updateRows: [],
    });

    await expect(
      service.decideCancellationRequest(
        'job-1',
        { decision: 'approved', expectedVersion: 3 },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejected decision restores status_at_request and returns it', async () => {
    const service = buildDecideService({
      jobStatus: 'cancellation_requested',
      jobVersion: 3,
      requestRow: {
        id: 'req-1',
        requested_by_dealer_id: 'dealer-1',
        reason: 'Changed mind',
        status_at_request: 'in_process',
      },
      updateRows: [{ status: 'in_process', version: 4 }],
    });

    const result = await service.decideCancellationRequest(
      'job-1',
      { decision: 'rejected', expectedVersion: 3 },
      officeCtx,
    );

    expect(result).toMatchObject({ ok: true, status: 'in_process', version: 4 });
  });

  it('throws ConflictException on rejected decision when optimistic lock fails', async () => {
    const service = buildDecideService({
      jobStatus: 'cancellation_requested',
      jobVersion: 3,
      requestRow: {
        id: 'req-1',
        requested_by_dealer_id: null,
        reason: 'Test',
        status_at_request: 'in_process',
      },
      updateRows: [],
    });

    await expect(
      service.decideCancellationRequest(
        'job-1',
        { decision: 'rejected', expectedVersion: 3 },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// ---------------------------------------------------------------------------
// Phase 09 — listJobs org-scoping unit tests
// ---------------------------------------------------------------------------
describe('JobsService Phase 09 listJobs org-scoping', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-list',
    userId: 'staff-1',
    role: 'office_staff',
  };

  function buildListService(): { service: JobsService; capturedParams: unknown[][] } {
    const capturedParams: unknown[][] = [];
    const db = {
      query: jest.fn(async (_text: string, params: unknown[]) => {
        capturedParams.push(params);
        return { rows: [], rowCount: 0 };
      }),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    return { service: new JobsService(db as never, config as never), capturedParams };
  }

  it('always binds organization_id as the first parameter', async () => {
    const { service, capturedParams } = buildListService();
    await service.listJobs({}, officeCtx);
    expect(capturedParams.length).toBeGreaterThan(0);
    expect(capturedParams[0][0]).toBe('org-list');
  });

  it('never uses a different org id even when filters are present', async () => {
    const { service, capturedParams } = buildListService();
    await service.listJobs({ status: 'assigned', type: 'complaint' }, officeCtx);
    for (const params of capturedParams) {
      expect(params[0]).toBe('org-list');
      expect(params[0]).not.toBe('org-other');
    }
  });

  it('applies status filter as a bind param (not interpolated into SQL)', async () => {
    const { service, capturedParams } = buildListService();
    await service.listJobs({ status: 'in_process' }, officeCtx);
    const allParams = capturedParams.flat();
    expect(allParams).toContain('in_process');
  });
});

// ---------------------------------------------------------------------------
// Phase 09 — office one-step rollback via updateStatus
// ---------------------------------------------------------------------------
describe('JobsService Phase 09 office rollback via updateStatus', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-rollback',
    userId: 'staff-1',
    role: 'office_staff',
  };

  function buildRollbackService(options: {
    jobStatus: string;
    jobType?: string;
    updateRows?: { status: string; version: number }[];
  }): JobsService {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([{
            id: 'job-1',
            organization_id: 'org-rollback',
            type: options.jobType ?? 'complaint',
            status: options.jobStatus,
            source: 'direct',
            dealer_id: null,
            technician_id: 'tech-1',
            version: 5,
            is_deleted: false,
          }]);
        }
        if (text.includes('FROM job_cancellation_requests')) {
          return result([]);
        }
        if (text.includes('UPDATE jobs') && text.includes('version = version + 1')) {
          return result(options.updateRows ?? [{ status: 'acknowledged', version: 6 }]);
        }
        if (text.includes('INSERT INTO job_timeline')) {
          return result([]);
        }
        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    return new JobsService(db as never, config as never);
  }

  it('allows office_staff to roll back in_transit → acknowledged with a reason', async () => {
    const service = buildRollbackService({
      jobStatus: 'in_transit',
      updateRows: [{ status: 'acknowledged', version: 6 }],
    });

    const res = await service.updateStatus(
      'job-1',
      { targetStatus: 'acknowledged', expectedVersion: 5, reason: 'Wrong address entered' },
      officeCtx,
    );

    expect(res).toMatchObject({ ok: true, status: 'acknowledged', version: 6 });
  });

  it('allows office_staff to roll back in_process → in_transit with a reason', async () => {
    const service = buildRollbackService({
      jobStatus: 'in_process',
      updateRows: [{ status: 'in_transit', version: 6 }],
    });

    const res = await service.updateStatus(
      'job-1',
      { targetStatus: 'in_transit', expectedVersion: 5, reason: 'Misclick by technician' },
      officeCtx,
    );

    expect(res).toMatchObject({ ok: true, status: 'in_transit', version: 6 });
  });

  it('allows office_staff to roll back assigned complaint → new', async () => {
    const service = buildRollbackService({
      jobStatus: 'assigned',
      jobType: 'complaint',
      updateRows: [{ status: 'new', version: 6 }],
    });

    const res = await service.updateStatus(
      'job-1',
      { targetStatus: 'new', expectedVersion: 5, reason: 'Assignment selected too early' },
      officeCtx,
    );

    expect(res).toMatchObject({ ok: true, status: 'new', version: 6 });
  });

  it('allows office_staff to roll back assigned installation → scheduled', async () => {
    const service = buildRollbackService({
      jobStatus: 'assigned',
      jobType: 'installation',
      updateRows: [{ status: 'scheduled', version: 6 }],
    });

    const res = await service.updateStatus(
      'job-1',
      { targetStatus: 'scheduled', expectedVersion: 5, reason: 'Reassign before dispatch' },
      officeCtx,
    );

    expect(res).toMatchObject({ ok: true, status: 'scheduled', version: 6 });
  });

  it('re-raises revisit_pending_scheduling alert when rolling back revisit_scheduled → needs_revisit', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([{
            id: 'job-1',
            organization_id: 'org-rollback',
            type: 'complaint',
            status: 'revisit_scheduled',
            source: 'direct',
            dealer_id: null,
            technician_id: 'tech-1',
            version: 5,
            is_deleted: false,
          }]);
        }
        if (text.includes('FROM job_cancellation_requests')) {
          return result([]);
        }
        if (text.includes('UPDATE jobs') && text.includes('version = version + 1')) {
          return result([{ status: 'needs_revisit', version: 6 }]);
        }
        if (text.includes('FROM users') && text.includes("role IN ('owner', 'office_staff')")) {
          return result([{ id: 'owner-1' }, { id: 'staff-2' }]);
        }
        if (text.includes('INSERT INTO notifications')) {
          return result([]);
        }
        if (text.includes('INSERT INTO job_timeline')) {
          return result([]);
        }
        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    const res = await service.updateStatus(
      'job-1',
      { targetStatus: 'needs_revisit', expectedVersion: 5, reason: 'Scheduling details were incorrect' },
      officeCtx,
    );

    expect(res).toMatchObject({ ok: true, status: 'needs_revisit', version: 6 });

    const alertInserts = (fakeClient.query as jest.Mock).mock.calls.filter(
      (args: unknown[]) =>
        (args[0] as string).includes('INSERT INTO notifications')
        && (args[1] as unknown[])[1] === 'revisit_pending_scheduling',
    );
    expect(alertInserts).toHaveLength(2);
  });

  it('rejects rollback when reason is missing', async () => {
    const service = buildRollbackService({ jobStatus: 'in_transit' });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'acknowledged', expectedVersion: 5 },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects rollback when reason is empty string', async () => {
    const service = buildRollbackService({ jobStatus: 'in_transit' });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'acknowledged', expectedVersion: 5, reason: '   ' },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects rollback from completed (terminal) even for office_staff', async () => {
    const service = buildRollbackService({ jobStatus: 'completed' });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'in_process', expectedVersion: 5, reason: 'Rollback attempt' },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects rollback from resolved (terminal) even for office_staff', async () => {
    const service = buildRollbackService({ jobStatus: 'resolved', jobType: 'complaint' });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'in_process', expectedVersion: 5, reason: 'Rollback attempt' },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a skip-back (two steps) which is not in OFFICE_ROLLBACK_MAP', async () => {
    const service = buildRollbackService({ jobStatus: 'in_process' });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'assigned', expectedVersion: 5, reason: 'Two step rollback' },
        officeCtx,
      ),
    ).rejects.toThrow();
  });

  it('throws ConflictException when rollback UPDATE returns 0 rows (optimistic lock)', async () => {
    const service = buildRollbackService({
      jobStatus: 'in_transit',
      updateRows: [],
    });

    await expect(
      service.updateStatus(
        'job-1',
        { targetStatus: 'acknowledged', expectedVersion: 5, reason: 'Valid reason' },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// ---------------------------------------------------------------------------
// Phase 09 — office quick-entry and dropdowns
// ---------------------------------------------------------------------------
describe('JobsService Phase 09 office quick-entry and dropdowns', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-office',
    userId: 'staff-quick-1',
    role: 'office_staff',
  };

  function buildQuickEntryService(options?: {
    brandExists?: boolean;
    technicianExists?: boolean;
    insertedJobId?: string;
  }): { service: JobsService; queries: Array<{ text: string; params?: unknown[] }> } {
    const queries: Array<{ text: string; params?: unknown[] }> = [];
    const fakeClient = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        queries.push({ text, params });

        if (text.includes('FROM brands')) {
          return result(options?.brandExists === false ? [] : [{ id: 'brand-1' }]);
        }

        if (text.includes('FROM users') && text.includes("role = 'technician'")) {
          return result(options?.technicianExists === false ? [] : [{ id: 'tech-1' }]);
        }

        if (text.includes('FROM customer_phones cp')) {
          return result([]);
        }

        if (text.includes('FROM virtual_customers') && text.includes('levenshtein')) {
          return result([]);
        }

        if (text.includes('SELECT COUNT(*)::text AS count') && text.includes('FROM jobs')) {
          return result([{ count: '0' }]);
        }

        if (text.includes('UPDATE virtual_customers') && text.includes('SET is_frequent = TRUE')) {
          return result([]);
        }

        if (text.includes('INSERT INTO virtual_customers')) {
          return result([{ id: 'vcid-new' }]);
        }

        if (text.includes('INSERT INTO jobs')) {
          return result([{ id: options?.insertedJobId ?? 'job-quick-1' }]);
        }

        if (text.includes('INSERT INTO job_assignments')) {
          return result([{ id: 'assign-1' }]);
        }

        if (text.includes('UPDATE jobs')) {
          return result([{ status: 'assigned', version: 2 }]);
        }

        if (text.includes('INSERT INTO job_timeline')) {
          return result([{ id: 'timeline-1' }]);
        }

        if (text.includes('INSERT INTO notifications')) {
          return result([]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
      query: jest.fn(),
    };
    const config = {
      getInt: jest.fn(async (_orgId: string, _key: string, fallback: number) => fallback),
    };

    return { service: new JobsService(db as never, config as never), queries };
  }

  it('rejects quick-entry when brand is not in the current org', async () => {
    const { service } = buildQuickEntryService({ brandExists: false });

    await expect(
      service.quickEntryCreateJob(
        {
          type: 'complaint',
          brandId: 'brand-cross-org',
          customerName: 'Ali Khan',
          phone: '03001234567',
          address: 'Street 1, Lahore',
        },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects quick-entry when technician is not in the current org', async () => {
    const { service } = buildQuickEntryService({ technicianExists: false });

    await expect(
      service.quickEntryCreateJob(
        {
          type: 'complaint',
          brandId: 'brand-1',
          technicianId: 'tech-cross-org',
          customerName: 'Ali Khan',
          phone: '03001234567',
          address: 'Street 1, Lahore',
        },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates quick-entry job and returns assigned when technician is provided', async () => {
    const { service } = buildQuickEntryService();

    await expect(
      service.quickEntryCreateJob(
        {
          type: 'complaint',
          brandId: 'brand-1',
          technicianId: 'tech-1',
          customerName: 'Ali Khan',
          phone: '03001234567',
          address: 'Street 1, Lahore',
          issueDescription: 'Cooling issue',
          scheduledAt: '2026-05-06T10:00:00.000Z',
        },
        officeCtx,
      ),
    ).resolves.toMatchObject({ jobId: 'job-quick-1', status: 'assigned' });
  });

  it('listBrandsForOffice binds organization_id as first query param', async () => {
    const capturedParams: unknown[][] = [];
    const db = {
      query: jest.fn(async (_text: string, params?: unknown[]) => {
        capturedParams.push(params ?? []);
        return result([{ id: 'brand-1', name: 'LG' }]);
      }),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    await service.listBrandsForOffice(officeCtx);

    expect(capturedParams[0][0]).toBe('org-office');
  });

  it('listTechniciansForOffice binds organization_id as first query param', async () => {
    const capturedParams: unknown[][] = [];
    const db = {
      query: jest.fn(async (_text: string, params?: unknown[]) => {
        capturedParams.push(params ?? []);
        return result([{ id: 'tech-1', name: 'Tech One', active_assignments: 2 }]);
      }),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    await service.listTechniciansForOffice(officeCtx);

    expect(capturedParams[0][0]).toBe('org-office');
  });
});

// ---------------------------------------------------------------------------
// Phase 09 — revisit cards and rescheduling
// ---------------------------------------------------------------------------
describe('JobsService Phase 09 revisit cards and rescheduling', () => {
  const officeCtx: RequestContext = {
    organizationId: 'org-office',
    userId: 'staff-revisit-1',
    role: 'office_staff',
  };

  it('listPendingRevisitCards binds organization_id as first query param', async () => {
    const capturedParams: unknown[][] = [];
    const db = {
      query: jest.fn(async (_text: string, params?: unknown[]) => {
        capturedParams.push(params ?? []);
        return result([{ job_id: 'job-1' }]);
      }),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    await service.listPendingRevisitCards(officeCtx);

    expect(capturedParams[0][0]).toBe('org-office');
  });

  it('rejects reschedule when job has no previous scheduled_at', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-office',
              type: 'installation',
              status: 'scheduled',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 3,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('SELECT scheduled_at')) {
          return result([{ scheduled_at: null }]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    await expect(
      service.rescheduleJob(
        'job-1',
        { scheduledAt: '2026-05-09T10:00:00.000Z', expectedVersion: 3 },
        officeCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reschedules with schedule audit and returns updated version', async () => {
    const fakeClient = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
          return result([
            {
              id: 'job-1',
              organization_id: 'org-office',
              type: 'installation',
              status: 'scheduled',
              source: 'direct',
              dealer_id: null,
              technician_id: 'tech-1',
              version: 3,
              is_deleted: false,
            },
          ]);
        }

        if (text.includes('SELECT scheduled_at')) {
          return result([{ scheduled_at: '2026-05-08T10:00:00.000Z' }]);
        }

        if (text.includes('FROM users') && text.includes("role = 'technician'")) {
          return result([{ id: 'tech-1' }]);
        }

        if (text.includes('SELECT j.id') && text.includes('FROM jobs j')) {
          return result([]);
        }

        if (text.includes('UPDATE jobs') && text.includes("visit_outcome = 'rescheduled'")) {
          return result([{ status: 'scheduled', version: 4 }]);
        }

        if (text.includes('INSERT INTO job_timeline')) {
          return result([{ id: 'timeline-1' }]);
        }

        return result([]);
      }),
    };

    const db = {
      withTransaction: async <T>(work: (client: typeof fakeClient) => Promise<T>) => work(fakeClient),
    };
    const config = { getInt: jest.fn(async (_o: string, _k: string, fb: number) => fb) };
    const service = new JobsService(db as never, config as never);

    await expect(
      service.rescheduleJob(
        'job-1',
        {
          scheduledAt: '2026-05-09T10:00:00.000Z',
          expectedVersion: 3,
          technicianId: 'tech-1',
          acknowledgeConflict: true,
        },
        officeCtx,
      ),
    ).resolves.toMatchObject({ ok: true, status: 'scheduled', version: 4 });
  });
});

