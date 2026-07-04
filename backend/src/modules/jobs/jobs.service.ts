import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, scryptSync } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../shared/database.service';
import { TenantConfigService } from '../settings/tenant-config.service';
import { DealerRequestContext, RequestContext, UserRole } from '../security/request-context';
import {
  BatchScheduleDto,
  CustomerLookupQueryDto,
  CreateJobDto,
  CreateOfficeTechnicianDto,
  UpdateOfficeTechnicianDto,
  DecideCancellationRequestDto,
  JobStatus,
  JobType,
  ListJobsQueryDto,
  MobileSyncActionDto,
  PendingScheduleQueryDto,
  QuickEntryJobDto,
  RescheduleJobDto,
  SchedulePendingJobDto,
  ScheduleRevisitDto,
  SearchQueryDto,
  UndoJobActionDto,
  UpdateJobStatusDto,
} from './jobs.dto';

type LinkResolution = {
  vcid: string;
  eventType: 'customer_linked' | 'customer_link_dismissed';
  matchFound: boolean;
  matchedName: string | null;
  matchedAddress: string | null;
};

type JobRow = {
  id: string;
  organization_id: string;
  type: JobType;
  status: JobStatus;
  source: 'direct' | 'via_dealer';
  dealer_id: string | null;
  technician_id: string | null;
  version: number;
  is_deleted: boolean;
};

type PendingCancellationRequestRow = {
  id: string;
  requested_by_dealer_id: string | null;
  reason: string;
  status_at_request: JobStatus | null;
};

const INSTALLATION_FORWARD: Record<JobStatus, JobStatus[]> = {
  pending_schedule: ['scheduled', 'cancelled'],
  scheduled: ['assigned', 'cancelled'],
  new: [],
  assigned: ['acknowledged', 'cancelled'],
  acknowledged: ['in_transit', 'cancelled'],
  in_transit: ['in_process', 'cancelled'],
  in_process: ['completed', 'cancelled'],
  needs_revisit: [],
  revisit_scheduled: [],
  completed: [],
  resolved: [],
  resolved_on_revisit: [],
  cancellation_requested: ['cancelled'],
  cancelled: [],
};

const COMPLAINT_FORWARD: Record<JobStatus, JobStatus[]> = {
  pending_schedule: [],
  scheduled: [],
  new: ['assigned', 'cancelled', 'cancellation_requested'],
  assigned: ['acknowledged', 'cancelled', 'cancellation_requested'],
  acknowledged: ['in_transit', 'cancelled', 'cancellation_requested'],
  in_transit: ['in_process', 'cancelled', 'cancellation_requested'],
  in_process: ['resolved', 'needs_revisit', 'cancelled', 'cancellation_requested'],
  needs_revisit: ['revisit_scheduled', 'cancelled', 'cancellation_requested'],
  revisit_scheduled: ['in_transit', 'cancelled', 'cancellation_requested'],
  completed: [],
  resolved: [],
  resolved_on_revisit: [],
  cancellation_requested: ['cancelled'],
  cancelled: [],
};

const OFFICE_ROLLBACK_MAP: Partial<Record<JobStatus, JobStatus>> = {
  in_transit: 'acknowledged',
  in_process: 'in_transit',
  acknowledged: 'assigned',
  revisit_scheduled: 'needs_revisit',
};

@Injectable()
export class JobsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: TenantConfigService,
  ) {}

  async createByUser(input: CreateJobDto, ctx: RequestContext): Promise<{ id: string; status: string; version: number }> {
    return this.db.withTransaction(async (client) => {
      await this.validateCreationInput(client, input, ctx.organizationId);

      if (input.technicianId) {
        await this.assertTechnicianBelongsToOrg(client, input.technicianId, ctx.organizationId);
      }

      const linkResolution = await this.resolveVcid(client, input, ctx.organizationId);
      const flags = await this.calculateComplaintFlags(client, input.type, linkResolution.vcid, ctx.organizationId);
      const status = this.resolveInitialStatus(input);

      const jobInsert = await client.query<{ id: string; status: string; version: number }>(
        `
        INSERT INTO jobs (
          organization_id,
          type,
          status,
          brand_id,
          source,
          dealer_id,
          vcid,
          customer_name,
          address,
          phone,
          issue_description,
          installation_notes,
          scheduled_at,
          technician_id,
          is_repeat,
          is_frequent,
          repeat_window_days_used,
          frequent_threshold_used,
          frequent_window_used,
          created_by_user_id,
          created_by_dealer_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NULL
        )
        RETURNING id, status, version
        `,
        [
          ctx.organizationId,
          input.type,
          status,
          input.brandId,
          input.source,
          input.dealerId ?? null,
          linkResolution.vcid,
          input.customerName,
          input.address,
          input.phone,
          input.issueDescription ?? null,
          input.installationNotes ?? null,
          input.scheduledAt ?? null,
          input.technicianId ?? null,
          flags.isRepeat,
          flags.isFrequent,
          flags.repeatWindowDaysUsed,
          flags.frequentThresholdUsed,
          flags.frequentWindowUsed,
          ctx.userId,
        ],
      );

      const { id, version } = jobInsert.rows[0];

      await this.insertUnits(client, input.units ?? [], id, ctx.organizationId);
      await this.insertLinkageTimelineByUser(client, id, ctx, linkResolution);

      let finalStatus: string = status;
      if (input.technicianId) {
        finalStatus = 'assigned';
        await client.query(
          `
          INSERT INTO job_assignments (organization_id, job_id, technician_id, assigned_at, is_active)
          VALUES ($1, $2, $3, NOW(), TRUE)
          `,
          [ctx.organizationId, id, input.technicianId],
        );
        await this.insertTimelineByUser(
          client, id, ctx, 'technician_assigned',
          { technician_id: null },
          { technician_id: input.technicianId },
          null,
        );
        await client.query(
          `UPDATE jobs SET status = $2, updated_at = NOW(), version = version + 1 WHERE id = $1 AND organization_id = $3 AND is_deleted = FALSE`,
          [id, 'assigned', ctx.organizationId],
        );
      }

      await this.dispatchRepeatNotifications(client, id, ctx.organizationId, flags);

      return { id, status: finalStatus, version };
    });
  }

  async createByDealer(
    input: CreateJobDto,
    ctx: DealerRequestContext,
  ): Promise<{ jobId: string }> {
    return this.db.withTransaction(async (client) => {
      const normalized: CreateJobDto = {
        ...input,
        source: 'via_dealer',
        dealerId: ctx.dealerId,
      };

      await this.validateCreationInput(client, normalized, ctx.organizationId);
      const linkResolution = await this.resolveVcid(client, normalized, ctx.organizationId);
      const flags = await this.calculateComplaintFlags(
        client,
        normalized.type,
        linkResolution.vcid,
        ctx.organizationId,
      );
      const status = this.resolveInitialStatus(normalized);

      const jobInsert = await client.query<{ id: string }>(
        `
        INSERT INTO jobs (
          organization_id,
          type,
          status,
          brand_id,
          source,
          dealer_id,
          vcid,
          customer_name,
          address,
          phone,
          issue_description,
          installation_notes,
          scheduled_at,
          is_repeat,
          is_frequent,
          repeat_window_days_used,
          frequent_threshold_used,
          frequent_window_used,
          created_by_user_id,
          created_by_dealer_id
        )
        VALUES (
          $1,$2,$3,$4,'via_dealer',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NULL,$18
        )
        RETURNING id
        `,
        [
          ctx.organizationId,
          normalized.type,
          status,
          normalized.brandId,
          ctx.dealerId,
          linkResolution.vcid,
          normalized.customerName,
          normalized.address,
          normalized.phone,
          normalized.issueDescription ?? null,
          normalized.installationNotes ?? null,
          normalized.scheduledAt ?? null,
          flags.isRepeat,
          flags.isFrequent,
          flags.repeatWindowDaysUsed,
          flags.frequentThresholdUsed,
          flags.frequentWindowUsed,
          ctx.dealerId,
        ],
      );

      const jobId = jobInsert.rows[0].id;

      await this.insertUnits(client, normalized.units ?? [], jobId, ctx.organizationId);
      await this.insertLinkageTimelineByDealer(client, jobId, ctx, linkResolution);
      await this.flagVcidReviewIfDealerMismatch(
        client,
        jobId,
        ctx.organizationId,
        linkResolution.vcid,
        ctx.dealerId,
      );
      await this.dispatchRepeatNotifications(client, jobId, ctx.organizationId, flags);
      await this.notifyOwnerOfficeUsers(client, ctx.organizationId, 'dealer_job_submitted', jobId);

      await client.query(
        `
        INSERT INTO analytics_dealer_daily (
          organization_id,
          metric_date,
          dealer_id,
          jobs_submitted,
          complaints_submitted,
          installations_submitted
        )
        VALUES (
          $1,
          CURRENT_DATE,
          $2,
          1,
          $3,
          $4
        )
        ON CONFLICT (organization_id, metric_date, dealer_id)
        DO UPDATE SET
          jobs_submitted = analytics_dealer_daily.jobs_submitted + 1,
          complaints_submitted = analytics_dealer_daily.complaints_submitted + EXCLUDED.complaints_submitted,
          installations_submitted = analytics_dealer_daily.installations_submitted + EXCLUDED.installations_submitted,
          updated_at = NOW()
        `,
        [
          ctx.organizationId,
          ctx.dealerId,
          normalized.type === 'complaint' ? 1 : 0,
          normalized.type === 'installation' ? 1 : 0,
        ],
      );

      return { jobId };
    });
  }

  async quickEntryCreateJob(
    input: QuickEntryJobDto,
    ctx: RequestContext,
  ): Promise<{ jobId: string; status: JobStatus }> {
    return this.db.withTransaction(async (client) => {
      // Validate brand belongs to org
      const brandCheck = await client.query<{ id: string }>(
        `SELECT id FROM brands WHERE id = $1 AND organization_id = $2 AND is_active = TRUE LIMIT 1`,
        [input.brandId, ctx.organizationId],
      );
      if (brandCheck.rows.length === 0) {
        throw new BadRequestException('Brand not found or inactive in your organization');
      }

      // If technician provided, validate they belong to org
      if (input.technicianId) {
        await this.assertTechnicianBelongsToOrg(client, input.technicianId, ctx.organizationId);
      }

      // Convert QuickEntryJobDto to CreateJobDto (always direct source for quick entry)
      const normalized: CreateJobDto = {
        type: input.type,
        source: 'direct',
        brandId: input.brandId,
        customerName: input.customerName,
        phone: input.phone,
        address: input.address,
        issueDescription: input.issueDescription,
        installationNotes: input.installationNotes,
        scheduledAt: input.scheduledAt,
        linkBehavior: input.linkBehavior,
        selectedVcid: input.selectedVcid,
      };

      // Run standard create flow (VCID resolution, flags, timeline)
      await this.validateCreationInput(client, normalized, ctx.organizationId);
      const linkResolution = await this.resolveVcid(client, normalized, ctx.organizationId);
      const flags = await this.calculateComplaintFlags(
        client,
        normalized.type,
        linkResolution.vcid,
        ctx.organizationId,
      );
      let status = this.resolveInitialStatus(normalized);

      const jobInsert = await client.query<{ id: string }>(
        `
        INSERT INTO jobs (
          organization_id,
          type,
          status,
          brand_id,
          source,
          dealer_id,
          vcid,
          customer_name,
          address,
          phone,
          issue_description,
          installation_notes,
          scheduled_at,
          technician_id,
          is_repeat,
          is_frequent,
          repeat_window_days_used,
          frequent_threshold_used,
          frequent_window_used,
          created_by_user_id,
          created_by_dealer_id
        )
        VALUES (
          $1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NULL
        )
        RETURNING id
        `,
        [
          ctx.organizationId,
          normalized.type,
          status,
          normalized.brandId,
          'direct',
          linkResolution.vcid,
          normalized.customerName,
          normalized.address,
          normalized.phone,
          normalized.issueDescription ?? null,
          normalized.installationNotes ?? null,
          normalized.scheduledAt ?? null,
          input.technicianId ?? null,
          flags.isRepeat,
          flags.isFrequent,
          flags.repeatWindowDaysUsed,
          flags.frequentThresholdUsed,
          flags.frequentWindowUsed,
          ctx.userId,
        ],
      );

      const jobId = jobInsert.rows[0].id;

      await this.insertLinkageTimelineByUser(client, jobId, ctx, linkResolution);

      // If technician assigned directly, also log the assignment
      let finalStatus: JobStatus = status;
      if (input.technicianId) {
        finalStatus = 'assigned';
        await client.query(
          `
          INSERT INTO job_assignments (
            organization_id,
            job_id,
            technician_id,
            assigned_at,
            is_active
          )
          VALUES ($1, $2, $3, NOW(), TRUE)
          `,
          [ctx.organizationId, jobId, input.technicianId],
        );

        await this.insertTimelineByUser(
          client,
          jobId,
          ctx,
          'technician_assigned',
          { technician_id: null },
          { technician_id: input.technicianId },
          null,
        );

        // Update job status to assigned
        await client.query(
          `
          UPDATE jobs
          SET status = $2, technician_id = $3, updated_at = NOW(), version = version + 1
          WHERE id = $1 AND organization_id = $4 AND is_deleted = FALSE
          `,
          [jobId, 'assigned', input.technicianId, ctx.organizationId],
        );
      }

      await this.dispatchRepeatNotifications(client, jobId, ctx.organizationId, flags);

      return { jobId, status: finalStatus };
    });
  }

  async listBrandsForOffice(ctx: RequestContext): Promise<Array<{ id: string; name: string }>> {
    const result = await this.db.query(
      `
      SELECT id, name
      FROM brands
      WHERE organization_id = $1
        AND is_active = TRUE
        AND is_deleted = FALSE
      ORDER BY name ASC
      `,
      [ctx.organizationId],
    );
    return result.rows as Array<{ id: string; name: string }>;
  }

  async listTechniciansForOffice(ctx: RequestContext): Promise<Array<{ id: string; name: string; activeAssignments: number }>> {
    const result = await this.db.query(
      `
      SELECT
        u.id,
        u.full_name AS name,
        u.email,
        u.phone,
        u.region,
        u.is_active,
        COALESCE(COUNT(ja.id), 0) AS active_assignments
      FROM users u
      LEFT JOIN job_assignments ja
        ON ja.technician_id = u.id
       AND ja.is_active = TRUE
       AND ja.organization_id = $1
      WHERE u.organization_id = $1
        AND u.role = 'technician'
        AND u.is_deleted = FALSE
      GROUP BY u.id, u.full_name, u.email, u.phone, u.region, u.is_active
      ORDER BY u.is_active DESC, u.full_name ASC
      `,
      [ctx.organizationId],
    );
    return result.rows as Array<{ id: string; name: string; activeAssignments: number }>;
  }

  async createOfficeTechnician(
    input: CreateOfficeTechnicianDto,
    ctx: RequestContext,
  ): Promise<{ technicianId: string }> {
    if (ctx.role !== 'owner') {
      throw new ForbiddenException('Only owner can create technicians');
    }

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const passwordHash = this.hashPassword(input.password.trim());

    const existing = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM users
      WHERE organization_id = $1
        AND LOWER(email) = $2
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [ctx.organizationId, email],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException('User with this email already exists');
    }

    const created = await this.db.query<{ id: string }>(
      `
      INSERT INTO users (
        organization_id,
        email,
        full_name,
        role,
        password_hash,
        is_active,
        is_deleted
      )
      VALUES ($1, $2, $3, 'technician', $4, TRUE, FALSE)
      RETURNING id
      `,
      [ctx.organizationId, email, fullName, passwordHash],
    );

    return { technicianId: created.rows[0].id };
  }

  async updateOfficeTechnician(
    technicianId: string,
    input: UpdateOfficeTechnicianDto,
    ctx: RequestContext,
  ): Promise<{ ok: true }> {
    if (ctx.role !== 'owner' && ctx.role !== 'office_staff') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const existing = await this.db.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND role = 'technician' AND is_deleted = FALSE LIMIT 1`,
      [technicianId, ctx.organizationId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Technician not found');
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.isActive !== undefined) {
      setClauses.push(`is_active = $${idx++}`);
      values.push(input.isActive);
    }
    if (input.fullName !== undefined) {
      setClauses.push(`full_name = $${idx++}`);
      values.push(input.fullName.trim());
    }
    if (input.email !== undefined) {
      setClauses.push(`email = $${idx++}`);
      values.push(input.email.trim().toLowerCase());
    }
    if (input.phone !== undefined) {
      setClauses.push(`phone = $${idx++}`);
      values.push(input.phone.trim() || null);
    }
    if (input.region !== undefined) {
      setClauses.push(`region = $${idx++}`);
      values.push(input.region.trim() || null);
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      values.push(technicianId, ctx.organizationId);
      await this.db.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++}`,
        values,
      );
    }

    return { ok: true };
  }

  async findById(jobId: string, ctx: RequestContext): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.organization_id,
        j.type,
        j.status,
        j.brand_id,
        j.source,
        j.dealer_id,
        j.technician_id,
        j.vcid,
        j.customer_name,
        j.address,
        j.phone,
        j.issue_description,
        j.installation_notes,
        j.scheduled_at,
        j.is_repeat,
        j.is_frequent,
        j.is_chronic,
        j.created_at,
        j.updated_at,
        j.version
      FROM jobs j
      WHERE j.id = $1
        AND j.organization_id = $2
        AND j.is_deleted = FALSE
      LIMIT 1
      `,
      [jobId, ctx.organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Job not found');
    }

    return result.rows[0] as Record<string, unknown>;
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  async listJobs(query: ListJobsQueryDto, ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const conditions: string[] = ['j.organization_id = $1', 'j.is_deleted = FALSE'];
    const params: unknown[] = [ctx.organizationId];

    const add = (sql: string, value: unknown): void => {
      params.push(value);
      conditions.push(sql.replace(':p', `$${params.length}`));
    };

    if (query.status) add('j.status = :p', query.status);
    if (query.type) add('j.type = :p', query.type);
    if (query.brandId) add('j.brand_id = :p', query.brandId);
    if (query.technicianId) add('j.technician_id = :p', query.technicianId);
    if (query.dealerId) add('j.dealer_id = :p', query.dealerId);
    if (query.source) add('j.source = :p', query.source);
    if (query.createdFrom) add('j.created_at >= :p::timestamptz', query.createdFrom);
    if (query.createdTo) add('j.created_at <= :p::timestamptz', query.createdTo);
    if (query.scheduledFrom) add('j.scheduled_at >= :p::timestamptz', query.scheduledFrom);
    if (query.scheduledTo) add('j.scheduled_at <= :p::timestamptz', query.scheduledTo);

    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.type,
        j.status,
        j.source,
        j.brand_id,
        j.dealer_id,
        j.technician_id,
        j.customer_name,
        j.phone,
        j.address,
        j.scheduled_at,
        j.created_at,
        j.updated_at,
        j.version
      FROM jobs j
      WHERE ${conditions.join(' AND ')}
      ORDER BY j.created_at DESC
      LIMIT 500
      `,
      params,
    );

    return result.rows as Record<string, unknown>[];
  }

  async lookupCustomers(
    query: CustomerLookupQueryDto,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>[]> {
    const limit = Math.min(query.limit ?? 20, 50);
    const phone = query.phone?.trim();
    const name = query.name?.trim();

    if (!phone && !name) {
      throw new BadRequestException('Either phone or name is required for customer lookup');
    }

    const result = await this.db.query(
      `
      SELECT
        cp.phone,
        vc.id AS vcid,
        j.customer_name,
        j.address,
        j.id AS job_id,
        j.created_at
      FROM customer_phones cp
      INNER JOIN virtual_customers vc
        ON vc.id = cp.vcid
       AND vc.organization_id = $1
       AND vc.is_deleted = FALSE
      INNER JOIN jobs j
        ON j.vcid = vc.id
       AND j.organization_id = $1
       AND j.is_deleted = FALSE
      WHERE cp.organization_id = $1
        AND cp.is_deleted = FALSE
        AND (
          ($2::text IS NOT NULL AND cp.phone = $2)
          OR (
            $3::text IS NOT NULL
            AND (
              j.customer_name ILIKE ('%' || $3 || '%')
              OR levenshtein(lower(j.customer_name), lower($3)) <= 3
            )
          )
        )
      ORDER BY j.created_at DESC
      LIMIT $4
      `,
      [ctx.organizationId, phone ?? null, name ?? null, limit],
    );

    return result.rows as Record<string, unknown>[];
  }

  async listPendingScheduleJobs(
    query: PendingScheduleQueryDto,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>[]> {
    const limit = Math.min(query.limit ?? 100, 500);

    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.type,
        j.status,
        j.source,
        j.brand_id,
        j.dealer_id,
        j.customer_name,
        j.phone,
        j.address,
        j.scheduled_at,
        j.technician_id,
        j.created_at,
        j.version,
        b.name AS brand_name,
        d.name AS dealer_name
      FROM jobs j
      LEFT JOIN brands b ON b.id = j.brand_id AND b.organization_id = j.organization_id
      LEFT JOIN dealers d ON d.id = j.dealer_id AND d.organization_id = j.organization_id
      WHERE j.organization_id = $1
        AND j.is_deleted = FALSE
        AND (
          j.status = 'pending_schedule'
          OR (j.status = 'new' AND j.type = 'complaint')
          OR (j.status = 'scheduled' AND j.technician_id IS NULL)
        )
      ORDER BY j.created_at ASC
      LIMIT $2
      `,
      [ctx.organizationId, limit],
    );

    return result.rows as Record<string, unknown>[];
  }

  async schedulePendingJob(
    jobId: string,
    input: SchedulePendingJobDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number; conflictJobIds?: string[] }> {
    return this.db.withTransaction(async (client) => {
      const job = await this.getJobForUpdate(client, jobId, ctx.organizationId);


      if (job.status !== 'pending_schedule') {
        throw new ConflictException('Job must be in pending_schedule before office scheduling');
      }

      if (input.technicianId) {
        await this.assertTechnicianBelongsToOrg(client, input.technicianId, ctx.organizationId);
      }

      const scheduled = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = 'scheduled',
            scheduled_at = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $4
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [jobId, ctx.organizationId, input.scheduledAt, input.expectedVersion],
      );

      if (scheduled.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await this.insertTimelineByUser(
        client,
        jobId,
        ctx,
        'status_transition',
        { status: 'pending_schedule' },
        { status: 'scheduled', scheduledAt: input.scheduledAt },
        null,
      );

      if (!input.technicianId) {
        return {
          ok: true,
          status: scheduled.rows[0].status,
          version: scheduled.rows[0].version,
        };
      }

      const stdDuration = await this.configService.getInt(
        ctx.organizationId,
        'standard_job_duration_mins',
        120,
      );
      const conflictRes = await client.query<{ id: string }>(
        `
        SELECT j.id
        FROM jobs j
        INNER JOIN job_assignments ja
          ON ja.job_id = j.id
         AND ja.is_active = TRUE
        WHERE ja.technician_id = $1
          AND j.organization_id = $2
          AND j.scheduled_at BETWEEN $3 AND ($3::timestamp + ($4 || ' minutes')::interval)
          AND j.id <> $5
          AND j.is_deleted = FALSE
          AND j.status NOT IN ('cancelled', 'completed', 'resolved', 'resolved_on_revisit')
        `,
        [input.technicianId, ctx.organizationId, input.scheduledAt, stdDuration, jobId],
      );
      const conflictJobIds = conflictRes.rows.map((row) => row.id);

      if (conflictJobIds.length > 0 && input.acknowledgeConflict !== true) {
        return {
          ok: true,
          status: 'scheduled',
          version: scheduled.rows[0].version,
          conflictJobIds,
        };
      }

      await client.query(
        `
        UPDATE job_assignments
        SET is_active = FALSE,
            unassigned_at = NOW()
        WHERE job_id = $1
          AND is_active = TRUE
        `,
        [jobId],
      );

      await client.query(
        `
        INSERT INTO job_assignments (job_id, technician_id, organization_id, is_active, assigned_at, created_by)
        VALUES ($1, $2, $3, TRUE, NOW(), $4)
        `,
        [jobId, input.technicianId, ctx.organizationId, ctx.userId],
      );

      const assigned = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = 'assigned',
            technician_id = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $4
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [jobId, ctx.organizationId, input.technicianId, scheduled.rows[0].version],
      );

      if (assigned.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await this.insertTimelineByUser(
        client,
        jobId,
        ctx,
        'status_transition',
        { status: 'scheduled' },
        { status: 'assigned', technicianId: input.technicianId },
        null,
      );

      await this.insertUserNotification(
        client,
        ctx.organizationId,
        'job_assigned',
        input.technicianId,
        jobId,
        { jobId },
      );

      if (conflictJobIds.length > 0) {
        for (const conflictId of conflictJobIds) {
          const [leftId, rightId] = [jobId, conflictId].sort();
          await client.query(
            `
            INSERT INTO scheduling_conflicts (job_id, conflicting_job_id, technician_id, organization_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
            `,
            [leftId, rightId, input.technicianId, ctx.organizationId],
          );

          await this.insertTimelineByUser(
            client,
            jobId,
            ctx,
            'scheduling_conflict_ack',
            null,
            { conflictWith: conflictId },
            null,
          );
        }
      }

      return {
        ok: true,
        status: assigned.rows[0].status,
        version: assigned.rows[0].version,
        conflictJobIds: conflictJobIds.length > 0 ? conflictJobIds : undefined,
      };
    });
  }

  async getTechnicianWorkload(ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT
        u.id AS technician_id,
        u.full_name AS technician_name,
        COUNT(j.id)::int AS active_assignments,
        MIN(j.scheduled_at) AS next_scheduled_at,
        EXISTS (
          SELECT 1
          FROM scheduling_conflicts sc
          WHERE sc.organization_id = $1
            AND sc.technician_id = u.id
            AND sc.acknowledged_by IS NOT NULL
        ) AS has_acknowledged_conflicts
      FROM users u
      LEFT JOIN job_assignments ja
        ON ja.organization_id = $1
       AND ja.technician_id = u.id
       AND ja.is_active = TRUE
      LEFT JOIN jobs j
        ON j.id = ja.job_id
       AND j.organization_id = $1
       AND j.is_deleted = FALSE
       AND j.status NOT IN ('cancelled', 'completed', 'resolved', 'resolved_on_revisit')
      WHERE u.organization_id = $1
        AND u.role = 'technician'
        AND u.is_deleted = FALSE
        AND u.is_active = TRUE
      GROUP BY u.id, u.full_name
      ORDER BY u.full_name ASC
      `,
      [ctx.organizationId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async listPendingRevisitCards(ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT
        j.id AS job_id,
        j.customer_name,
        j.phone,
        j.address,
        j.updated_at,
        rv.id AS revisit_id,
        rv.sequence_number,
        rv.reason,
        rv.custom_reason,
        (j.is_chronic OR COALESCE(rv.sequence_number, 0) >= 3) AS is_chronic
      FROM jobs j
      LEFT JOIN LATERAL (
        SELECT r.id, r.sequence_number, r.reason, r.custom_reason
        FROM revisits r
        WHERE r.organization_id = j.organization_id
          AND r.job_id = j.id
          AND r.is_deleted = FALSE
        ORDER BY r.sequence_number DESC
        LIMIT 1
      ) rv ON TRUE
      WHERE j.organization_id = $1
        AND j.is_deleted = FALSE
        AND j.type = 'complaint'
        AND j.status = 'needs_revisit'
      ORDER BY j.updated_at DESC
      LIMIT 500
      `,
      [ctx.organizationId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async rescheduleJob(
    jobId: string,
    input: RescheduleJobDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number; conflictJobIds?: string[] }> {
    return this.db.withTransaction(async (client) => {
      const job = await this.getJobForUpdate(client, jobId, ctx.organizationId);

      if (['cancelled', 'completed', 'resolved', 'resolved_on_revisit', 'in_process'].includes(job.status)) {
        throw new ConflictException('Job cannot be rescheduled from current status');
      }

      const scheduleRow = await client.query<{ scheduled_at: string | null }>(
        `
        SELECT scheduled_at
        FROM jobs
        WHERE id = $1
          AND organization_id = $2
          AND is_deleted = FALSE
        LIMIT 1
        `,
        [jobId, ctx.organizationId],
      );

      const previousScheduledAt = scheduleRow.rows[0]?.scheduled_at ?? null;
      if (!previousScheduledAt) {
        throw new BadRequestException('Job has no existing schedule to reschedule');
      }

      const technicianId = input.technicianId ?? job.technician_id;

      if (input.technicianId) {
        await this.assertTechnicianBelongsToOrg(client, input.technicianId, ctx.organizationId);
      }

      let conflictJobIds: string[] = [];
      if (technicianId) {
        const stdDuration = await this.configService.getInt(
          ctx.organizationId,
          'standard_job_duration_mins',
          120,
        );
        const conflictRes = await client.query<{ id: string }>(
          `
          SELECT j.id
          FROM jobs j
          INNER JOIN job_assignments ja
            ON ja.job_id = j.id
           AND ja.is_active = TRUE
          WHERE ja.technician_id = $1
            AND j.organization_id = $2
            AND j.scheduled_at BETWEEN $3 AND ($3::timestamp + ($4 || ' minutes')::interval)
            AND j.id <> $5
            AND j.is_deleted = FALSE
            AND j.status NOT IN ('cancelled', 'completed', 'resolved', 'resolved_on_revisit')
          `,
          [technicianId, ctx.organizationId, input.scheduledAt, stdDuration, jobId],
        );
        conflictJobIds = conflictRes.rows.map((row) => row.id);
      }

      if (conflictJobIds.length > 0 && input.acknowledgeConflict !== true) {
        return {
          ok: true,
          status: job.status,
          version: job.version,
          conflictJobIds,
        };
      }

      await this.insertTimelineByUser(
        client,
        jobId,
        ctx,
        'schedule_rescheduled',
        { scheduledAt: previousScheduledAt },
        { scheduledAt: input.scheduledAt, technicianId: technicianId ?? null },
        null,
      );

      const updateResult = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET scheduled_at = $3,
            technician_id = COALESCE($4, technician_id),
            visit_outcome = 'rescheduled',
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $5
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [jobId, ctx.organizationId, input.scheduledAt, technicianId, input.expectedVersion],
      );

      if (updateResult.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      if (input.technicianId) {
        await client.query(
          `
          UPDATE job_assignments
          SET is_active = FALSE,
              unassigned_at = NOW()
          WHERE job_id = $1
            AND is_active = TRUE
          `,
          [jobId],
        );

        await client.query(
          `
          INSERT INTO job_assignments (job_id, technician_id, organization_id, is_active, assigned_at, created_by)
          VALUES ($1, $2, $3, TRUE, NOW(), $4)
          `,
          [jobId, input.technicianId, ctx.organizationId, ctx.userId],
        );

        await this.insertTimelineByUser(
          client,
          jobId,
          ctx,
          'assignment',
          { technicianId: job.technician_id },
          { technicianId: input.technicianId },
          null,
        );
      }

      if (conflictJobIds.length > 0 && technicianId) {
        for (const conflictId of conflictJobIds) {
          const [leftId, rightId] = [jobId, conflictId].sort();
          await client.query(
            `
            INSERT INTO scheduling_conflicts (job_id, conflicting_job_id, technician_id, organization_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
            `,
            [leftId, rightId, technicianId, ctx.organizationId],
          );

          await this.insertTimelineByUser(
            client,
            jobId,
            ctx,
            'scheduling_conflict_ack',
            null,
            { conflictWith: conflictId },
            null,
          );
        }
      }

      return {
        ok: true,
        status: updateResult.rows[0].status,
        version: updateResult.rows[0].version,
        conflictJobIds: conflictJobIds.length > 0 ? conflictJobIds : undefined,
      };
    });
  }

  async getTechnicianMyJobs(ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.type,
        j.status,
        j.source,
        j.brand_id,
        j.customer_name,
        j.phone,
        j.address,
        j.scheduled_at,
        j.updated_at,
        j.version,
        ja.assigned_at,
        ja.acknowledged_at
      FROM job_assignments ja
      INNER JOIN jobs j
        ON j.id = ja.job_id
       AND j.organization_id = ja.organization_id
      WHERE ja.organization_id = $1
        AND ja.technician_id = $2
        AND ja.is_active = TRUE
        AND j.is_deleted = FALSE
        AND j.status NOT IN ('cancelled', 'completed', 'resolved', 'resolved_on_revisit')
      ORDER BY ja.assigned_at DESC
      `,
      [ctx.organizationId, ctx.userId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async syncTechnicianAction(
    jobId: string,
    input: MobileSyncActionDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status?: JobStatus; version?: number; duplicate?: boolean }> {
    return this.db.withTransaction(async (client) => {
      await this.assertTechnicianActiveAssignment(client, jobId, ctx);

      const dedupeInsert = await client.query(
        `
        INSERT INTO mobile_sync_events (
          organization_id,
          job_id,
          technician_id,
          client_action_id,
          action_type,
          payload,
          queue_submitted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (organization_id, client_action_id) DO NOTHING
        RETURNING id
        `,
        [
          ctx.organizationId,
          jobId,
          ctx.userId,
          input.clientActionId,
          input.actionType,
          JSON.stringify(input.payload),
          input.queueSubmittedAt,
        ],
      );

      if (dedupeInsert.rows.length === 0) {
        return { ok: true, duplicate: true };
      }

      const job = await this.getJobForUpdate(client, jobId, ctx.organizationId);
      this.enforceTechnicianOwnership(job, ctx);

      if (job.status === 'cancellation_requested') {
        throw new ConflictException('Job is frozen while cancellation request is pending');
      }

      const submittedAt = new Date(input.queueSubmittedAt);
      if (Number.isNaN(submittedAt.getTime())) {
        throw new BadRequestException('Invalid queueSubmittedAt timestamp');
      }

      if (Date.now() - submittedAt.getTime() > 60_000) {
        await client.query(
          `
          INSERT INTO job_timeline (
            organization_id,
            job_id,
            event_type,
            previous_value,
            new_value,
            reason,
            occurred_at
          )
          VALUES ($1, $2, 'system_event', $3::jsonb, $4::jsonb, 'Delayed Sync', $5)
          `,
          [
            ctx.organizationId,
            jobId,
            JSON.stringify({ status: job.status }),
            JSON.stringify({ actionType: input.actionType, queueSubmittedAt: input.queueSubmittedAt }),
            input.queueSubmittedAt,
          ],
        );
      }

      let nextStatus: JobStatus | undefined;
      let nextVersion: number | undefined;

      if (input.actionType === 'status_transition' || input.actionType === 'status_transition+payment') {
        const targetStatus = input.payload.targetStatus;
        if (!targetStatus) {
          throw new BadRequestException('payload.targetStatus is required for status transition actions');
        }

        this.assertTransitionAllowed(job, targetStatus, ctx.role);
        const updated = await this.applyStatusTransitionWithPunctuality(
          client,
          job,
          targetStatus,
          input.expectedVersion,
          ctx,
        );
        nextStatus = updated.status;
        nextVersion = updated.version;

        await this.insertTimelineByUser(
          client,
          jobId,
          ctx,
          'status_transition',
          { status: job.status },
          { status: targetStatus },
          null,
        );
      }

      if (input.actionType === 'payment' || input.actionType === 'status_transition+payment') {
        if (typeof input.payload.paymentAmount !== 'number') {
          throw new BadRequestException('payload.paymentAmount is required for payment actions');
        }

        await client.query(
          `
          INSERT INTO payments (
            organization_id,
            job_id,
            amount,
            payment_method_id,
            recorded_by,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'collected')
          ON CONFLICT (job_id) DO NOTHING
          `,
          [
            ctx.organizationId,
            jobId,
            input.payload.paymentAmount,
            input.payload.paymentMethodId ?? null,
            ctx.userId,
          ],
        );

        await this.insertTimelineByUser(
          client,
          jobId,
          ctx,
          'payment_recorded',
          null,
          {
            amount: input.payload.paymentAmount,
            paymentMethodId: input.payload.paymentMethodId ?? null,
            actionType: input.actionType,
          },
          null,
        );
      }

      return { ok: true, status: nextStatus, version: nextVersion };
    });
  }

  async undoTechnicianAction(
    jobId: string,
    input: UndoJobActionDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number }> {
    return this.db.withTransaction(async (client) => {
      await this.assertTechnicianActiveAssignment(client, jobId, ctx);
      const job = await this.getJobForUpdate(client, jobId, ctx.organizationId);
      this.enforceTechnicianOwnership(job, ctx);

      const undoWindowSeconds = await this.configService.getInt(
        ctx.organizationId,
        'undo_window_seconds',
        60,
      );

      const transitionAt = new Date(input.transitionOccurredAt);
      if (Number.isNaN(transitionAt.getTime())) {
        throw new BadRequestException('Invalid transitionOccurredAt timestamp');
      }

      if (Date.now() - transitionAt.getTime() > undoWindowSeconds * 1000) {
        throw new ForbiddenException('Undo window expired');
      }

      const revertTo = input.revertToStatus ?? 'in_process';

      if (job.status === 'needs_revisit') {
        await client.query(
          `
          DELETE FROM revisits
          WHERE organization_id = $1
            AND job_id = $2
          `,
          [ctx.organizationId, jobId],
        );

        await client.query(
          `
          DELETE FROM notifications
          WHERE organization_id = $1
            AND job_id = $2
            AND event_type = 'revisit_pending_scheduling'
          `,
          [ctx.organizationId, jobId],
        );
      }

      if (['completed', 'resolved', 'resolved_on_revisit'].includes(job.status)) {
        await client.query(
          `
          DELETE FROM payments
          WHERE organization_id = $1
            AND job_id = $2
          `,
          [ctx.organizationId, jobId],
        );

        await this.insertTimelineByUser(
          client,
          jobId,
          ctx,
          'rollback_payment_voided',
          { status: job.status },
          { status: revertTo },
          null,
        );
      }

      const updateResult = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $4
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [jobId, ctx.organizationId, revertTo, input.expectedVersion],
      );

      if (updateResult.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await this.insertTimelineByUser(
        client,
        jobId,
        ctx,
        'status_undo',
        { status: job.status },
        { status: revertTo },
        null,
      );

      return {
        ok: true,
        status: updateResult.rows[0].status,
        version: updateResult.rows[0].version,
      };
    });
  }

  async detectNoShows(ctx: RequestContext): Promise<{ ok: true; flaggedJobs: number }> {
    return this.db.withTransaction(async (client) => {
      const noShowCandidates = await client.query<{ id: string }>(
        `
        SELECT id
        FROM jobs
        WHERE organization_id = $1
          AND scheduled_at < NOW()
          AND actual_arrival IS NULL
          AND visit_outcome IS NULL
          AND status NOT IN ('cancelled', 'cancellation_requested')
          AND is_deleted = FALSE
        `,
        [ctx.organizationId],
      );

      for (const row of noShowCandidates.rows) {
        await client.query(
          `
          UPDATE jobs
          SET visit_outcome = 'no_show',
              updated_at = NOW(),
              version = version + 1
          WHERE id = $1
            AND organization_id = $2
            AND visit_outcome IS NULL
            AND is_deleted = FALSE
          `,
          [row.id, ctx.organizationId],
        );

        await this.notifyOwnerOfficeUsers(client, ctx.organizationId, 'no_show_flagged', row.id);
      }

      return { ok: true, flaggedJobs: noShowCandidates.rows.length };
    });
  }

  async detectUnacknowledgedAssignments(
    ctx: RequestContext,
    thresholdMins: number,
  ): Promise<{ ok: true; flaggedJobs: number }> {
    return this.db.withTransaction(async (client) => {
      const pendingAcks = await client.query<{ job_id: string }>(
        `
        SELECT ja.job_id
        FROM job_assignments ja
        INNER JOIN jobs j
          ON j.id = ja.job_id
         AND j.organization_id = ja.organization_id
        WHERE ja.organization_id = $1
          AND ja.is_active = TRUE
          AND ja.acknowledged_at IS NULL
          AND ja.assigned_at < NOW() - ($2::text || ' minutes')::interval
          AND j.is_deleted = FALSE
          AND j.status NOT IN ('cancelled', 'completed', 'resolved', 'resolved_on_revisit')
        `,
        [ctx.organizationId, thresholdMins],
      );

      for (const row of pendingAcks.rows) {
        await this.notifyOwnerOfficeUsers(client, ctx.organizationId, 'job_unacknowledged', row.job_id);
      }

      return { ok: true, flaggedJobs: pendingAcks.rows.length };
    });
  }

  async updateStatus(
    jobId: string,
    input: UpdateJobStatusDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number }> {
    return this.db.withTransaction(async (client) => {
      const job = await this.getJobForUpdate(client, jobId, ctx.organizationId);
      this.enforceTechnicianOwnership(job, ctx);

      await this.autoRejectStaleCancellationRequests(client, job, ctx.organizationId);

      if (job.status === 'cancellation_requested') {
        throw new ConflictException('Job is frozen while cancellation request is pending');
      }

      if (job.status === 'cancelled' && input.targetStatus !== 'cancelled') {
        return this.ownerReopenCancelledJob(client, job, input, ctx);
      }

      if (input.targetStatus === 'cancelled') {
        return this.directCancelJob(client, job, input, ctx);
      }

      if (
        ['completed', 'resolved', 'resolved_on_revisit'].includes(job.status)
        && input.targetStatus !== job.status
      ) {
        await this.assertOwnerDecisionRequiredForPaidReversal(client, job, input, ctx);
      }

      const isRollback = this.isRollback(job, input.targetStatus);

      if (['completed', 'resolved', 'resolved_on_revisit'].includes(input.targetStatus)) {
        await this.assertMandatoryReviewLinkIfRequired(client, job.id, ctx.organizationId);
        return this.completeOrResolveWithPayment(client, job, input, ctx);
      }

      if (input.targetStatus === 'needs_revisit' && !isRollback) {
        return this.moveToNeedsRevisit(client, job, input, ctx);
      }

      if (input.targetStatus === 'revisit_scheduled') {
        throw new BadRequestException('Use revisit scheduling endpoint for revisit_scheduled transitions');
      }

      if (isRollback) {
        if (ctx.role !== 'office_staff') {
          throw new ForbiddenException('Only office staff can perform one-step rollback');
        }
        if (!input.reason?.trim()) {
          throw new BadRequestException('Rollback reason is required');
        }
        if (['completed', 'resolved', 'resolved_on_revisit'].includes(job.status)) {
          throw new ForbiddenException('Rollback from terminal completion statuses is owner-only');
        }
      } else {
        this.assertTransitionAllowed(job, input.targetStatus, ctx.role);
      }

      const updateResult = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $4
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [job.id, ctx.organizationId, input.targetStatus, input.expectedVersion],
      );

      if (updateResult.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      const eventType = isRollback ? 'status_rollback' : 'status_transition';
      await this.insertTimelineByUser(
        client,
        job.id,
        ctx,
        eventType,
        { status: job.status },
        { status: input.targetStatus },
        input.reason ?? null,
      );

      if (isRollback && input.targetStatus === 'needs_revisit') {
        await this.notifyOwnerOfficeUsers(
          client,
          ctx.organizationId,
          'revisit_pending_scheduling',
          job.id,
        );
      }

      return {
        ok: true,
        status: updateResult.rows[0].status,
        version: updateResult.rows[0].version,
      };
    });
  }

  async scheduleRevisit(
    jobId: string,
    input: ScheduleRevisitDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number; revisitId: string }> {
    return this.db.withTransaction(async (client) => {
      const job = await this.getJobForUpdate(client, jobId, ctx.organizationId);

      if (job.type !== 'complaint') {
        throw new BadRequestException('Revisit scheduling is supported only for complaint jobs');
      }

      if (job.status !== 'needs_revisit') {
        throw new ConflictException('Job must be in needs_revisit before scheduling a revisit');
      }

      await this.assertTechnicianBelongsToOrg(client, input.technicianId, ctx.organizationId);

      const revisitResult = await client.query<{ id: string; scheduled_at: string | null }>(
        `
        SELECT id, scheduled_at
        FROM revisits
        WHERE id = $1
          AND organization_id = $2
          AND job_id = $3
          AND is_deleted = FALSE
        LIMIT 1
        FOR UPDATE
        `,
        [input.revisitId, ctx.organizationId, jobId],
      );

      if (revisitResult.rows.length === 0) {
        throw new NotFoundException('Revisit not found for this job');
      }

      if (revisitResult.rows[0].scheduled_at) {
        throw new ConflictException('Revisit is already scheduled');
      }

      const jobUpdate = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = 'revisit_scheduled',
            technician_id = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $4
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [jobId, ctx.organizationId, input.technicianId, input.expectedVersion],
      );

      if (jobUpdate.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await client.query(
        `
        UPDATE revisits
        SET scheduled_at = $4,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND job_id = $3
          AND is_deleted = FALSE
        `,
        [input.revisitId, ctx.organizationId, jobId, input.scheduledAt],
      );

      await client.query(
        `
        UPDATE revisit_assignments
        SET is_active = FALSE,
            unassigned_at = NOW(),
            updated_at = NOW()
        WHERE organization_id = $1
          AND revisit_id = $2
          AND is_active = TRUE
        `,
        [ctx.organizationId, input.revisitId],
      );

      await client.query(
        `
        INSERT INTO revisit_assignments (
          organization_id,
          revisit_id,
          technician_id,
          is_active,
          assigned_at,
          created_by,
          assigned_by
        )
        VALUES ($1, $2, $3, TRUE, NOW(), $4, $4)
        `,
        [ctx.organizationId, input.revisitId, input.technicianId, ctx.userId],
      );

      await this.insertUserNotification(
        client,
        ctx.organizationId,
        'job_assigned',
        input.technicianId,
        jobId,
        { jobId, revisitId: input.revisitId },
      );

      await client.query(
        `
        DELETE FROM notifications
        WHERE organization_id = $1
          AND job_id = $2
          AND event_type = 'revisit_pending_scheduling'
        `,
        [ctx.organizationId, jobId],
      );

      await this.insertTimelineByUser(
        client,
        jobId,
        ctx,
        'revisit_scheduled',
        { status: job.status },
        {
          status: 'revisit_scheduled',
          revisitId: input.revisitId,
          technicianId: input.technicianId,
          scheduledAt: input.scheduledAt,
        },
        null,
      );

      return {
        ok: true,
        status: jobUpdate.rows[0].status,
        version: jobUpdate.rows[0].version,
        revisitId: input.revisitId,
      };
    });
  }

  async dealerWithdrawInitialJob(
    jobId: string,
    reason: string,
    ctx: DealerRequestContext,
  ): Promise<{ ok: true; status: 'cancelled' }> {
    return this.db.withTransaction(async (client) => {
      const job = await this.getDealerOwnedJob(client, jobId, ctx);

      if (!(job.status === 'new' || job.status === 'pending_schedule')) {
        throw new BadRequestException('Dealer can withdraw directly only in initial state');
      }

      await client.query(
        `
        UPDATE jobs
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancellation_reason = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND is_deleted = FALSE
        `,
        [job.id, ctx.organizationId, reason],
      );

      await this.insertTimelineByDealer(
        client,
        job.id,
        ctx,
        'cancellation',
        { status: job.status },
        { status: 'cancelled' },
        reason,
      );

      return { ok: true, status: 'cancelled' };
    });
  }

  async requestDealerCancellation(
    jobId: string,
    reason: string,
    ctx: DealerRequestContext,
  ): Promise<{ ok: true; status: 'cancellation_requested' }> {
    return this.db.withTransaction(async (client) => {
      const job = await this.getDealerOwnedJob(client, jobId, ctx);

      if (job.status === 'new' || job.status === 'pending_schedule') {
        throw new BadRequestException('Use withdraw endpoint for initial-state jobs');
      }

      if (['cancelled', 'resolved', 'resolved_on_revisit', 'completed'].includes(job.status)) {
        throw new BadRequestException('Cannot request cancellation for terminal jobs');
      }

      try {
        await client.query(
          `
          INSERT INTO job_cancellation_requests (
            organization_id,
            job_id,
            requested_by_dealer_id,
            reason,
            status,
            status_at_request
          )
          VALUES ($1, $2, $3, $4, 'pending', $5)
          `,
          [ctx.organizationId, job.id, ctx.dealerId, reason, job.status],
        );
      } catch (error: unknown) {
        const code = (error as { code?: string }).code;
        if (code === '23505') {
          throw new ConflictException('A pending cancellation request already exists for this job');
        }
        throw error;
      }

      await client.query(
        `
        UPDATE jobs
        SET status = 'cancellation_requested',
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND is_deleted = FALSE
        `,
        [job.id, ctx.organizationId],
      );

      await this.insertTimelineByDealer(
        client,
        job.id,
        ctx,
        'cancellation_request',
        { status: job.status },
        { status: 'cancellation_requested' },
        reason,
      );

      await this.notifyOwnerOfficeUsers(client, ctx.organizationId, 'cancellation_request_submitted', job.id);

      return { ok: true, status: 'cancellation_requested' };
    });
  }

  async decideCancellationRequest(
    jobId: string,
    input: DecideCancellationRequestDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number }> {
    return this.db.withTransaction(async (client) => {
      const job = await this.getJobForUpdate(client, jobId, ctx.organizationId);

      const requestResult = await client.query<PendingCancellationRequestRow>(
        `
        SELECT id, requested_by_dealer_id, reason, status_at_request
        FROM job_cancellation_requests
        WHERE organization_id = $1
          AND job_id = $2
          AND status = 'pending'
        ORDER BY requested_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [ctx.organizationId, jobId],
      );

      if (requestResult.rows.length === 0) {
        throw new NotFoundException('No pending cancellation request found');
      }

      const request = requestResult.rows[0];

      await client.query(
        `
        UPDATE job_cancellation_requests
        SET status = $3,
            decided_by = $4,
            decided_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
        `,
        [request.id, ctx.organizationId, input.decision, ctx.userId],
      );

      if (input.decision === 'approved') {
        const updateResult = await client.query<{ status: JobStatus; version: number }>(
          `
          UPDATE jobs
          SET status = 'cancelled',
              cancelled_at = NOW(),
              cancelled_by = $3,
              cancellation_reason = $4,
              updated_at = NOW(),
              version = version + 1
          WHERE id = $1
            AND organization_id = $2
            AND version = $5
            AND is_deleted = FALSE
          RETURNING status, version
          `,
          [job.id, ctx.organizationId, ctx.userId, request.reason, input.expectedVersion],
        );

        if (updateResult.rows.length === 0) {
          throw new ConflictException('Optimistic lock conflict: version mismatch');
        }

        await this.insertTimelineByUser(
          client,
          job.id,
          ctx,
          'cancellation_approved',
          { status: job.status },
          { status: 'cancelled' },
          request.reason,
        );

        if (request.requested_by_dealer_id) {
          await this.notifyDealer(
            client,
            ctx.organizationId,
            request.requested_by_dealer_id,
            'cancellation_request_outcome',
            job.id,
          );
        }

        return {
          ok: true,
          status: updateResult.rows[0].status,
          version: updateResult.rows[0].version,
        };
      }

      const restoredStatus = request.status_at_request ?? job.status;
      const rejectResult = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $4
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [job.id, ctx.organizationId, restoredStatus, input.expectedVersion],
      );

      if (rejectResult.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await this.insertTimelineByUser(
        client,
        job.id,
        ctx,
        'cancellation_rejected',
        { status: job.status },
        { status: restoredStatus },
        null,
      );

      if (request.requested_by_dealer_id) {
        await this.notifyDealer(
          client,
          ctx.organizationId,
          request.requested_by_dealer_id,
          'cancellation_request_outcome',
          job.id,
        );
      }

      return {
        ok: true,
        status: rejectResult.rows[0].status,
        version: rejectResult.rows[0].version,
      };
    });
  }

  private async directCancelJob(
    client: PoolClient,
    job: JobRow,
    input: UpdateJobStatusDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number }> {
    if (!(ctx.role === 'office_staff' || ctx.role === 'owner')) {
      throw new ForbiddenException('Only office staff or owner can directly cancel jobs');
    }

    if (['completed', 'resolved', 'resolved_on_revisit', 'cancelled'].includes(job.status)) {
      throw new BadRequestException('Cannot directly cancel terminal jobs');
    }

    if (!input.reason?.trim()) {
      throw new BadRequestException('Cancellation reason is required');
    }

    if (job.status === 'in_process' && input.confirmInProcessCancellation !== true) {
      throw new BadRequestException('In-process cancellation requires explicit confirmation');
    }

    const updateResult = await client.query<{ status: JobStatus; version: number }>(
      `
      UPDATE jobs
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_by = $3,
          cancellation_reason = $4,
          updated_at = NOW(),
          version = version + 1
      WHERE id = $1
        AND organization_id = $2
        AND version = $5
        AND is_deleted = FALSE
      RETURNING status, version
      `,
      [job.id, ctx.organizationId, ctx.userId, input.reason, input.expectedVersion],
    );

    if (updateResult.rows.length === 0) {
      throw new ConflictException('Optimistic lock conflict: version mismatch');
    }

    await this.insertTimelineByUser(
      client,
      job.id,
      ctx,
      'cancellation',
      { status: job.status },
      { status: 'cancelled' },
      input.reason,
    );

    return { ok: true, status: updateResult.rows[0].status, version: updateResult.rows[0].version };
  }

  private async completeOrResolveWithPayment(
    client: PoolClient,
    job: JobRow,
    input: UpdateJobStatusDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number }> {
    if (typeof input.paymentAmount !== 'number') {
      throw new BadRequestException('paymentAmount is required for completion/resolution');
    }

    if (!input.paymentMethodId) {
      throw new BadRequestException('paymentMethodId is required for completion/resolution');
    }

    await this.assertPaymentMethodBelongsToOrg(client, input.paymentMethodId, ctx.organizationId);

    const updateResult = await client.query<{ status: JobStatus; version: number }>(
      `
      UPDATE jobs
      SET status = $3,
          updated_at = NOW(),
          version = version + 1
      WHERE id = $1
        AND organization_id = $2
        AND version = $4
        AND is_deleted = FALSE
      RETURNING status, version
      `,
      [job.id, ctx.organizationId, input.targetStatus, input.expectedVersion],
    );

    if (updateResult.rows.length === 0) {
      throw new ConflictException('Optimistic lock conflict: version mismatch');
    }

    try {
      await client.query(
        `
        INSERT INTO payments (
          job_id,
          amount,
          payment_method_id,
          status,
          recorded_by,
          organization_id
        )
        VALUES ($1, $2, $3, 'collected', $4, $5)
        `,
        [job.id, input.paymentAmount, input.paymentMethodId, ctx.userId, ctx.organizationId],
      );
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        throw new ConflictException('Payment already exists for this job');
      }
      throw error;
    }

    await this.insertTimelineByUser(
      client,
      job.id,
      ctx,
      'status_transition',
      { status: job.status },
      { status: input.targetStatus },
      input.reason ?? null,
    );

    await this.insertTimelineByUser(
      client,
      job.id,
      ctx,
      'payment_recorded',
      null,
      { amount: input.paymentAmount, method_id: input.paymentMethodId },
      null,
    );

    return {
      ok: true,
      status: updateResult.rows[0].status,
      version: updateResult.rows[0].version,
    };
  }

  private async assertPaymentMethodBelongsToOrg(
    client: PoolClient,
    paymentMethodId: string,
    organizationId: string,
  ): Promise<void> {
    const method = await client.query<{ id: string }>(
      `
      SELECT id
      FROM payment_methods
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [paymentMethodId, organizationId],
    );

    if (method.rows.length === 0) {
      throw new BadRequestException('Payment method is invalid or cross-organization');
    }
  }

  private async assertMandatoryReviewLinkIfRequired(
    client: PoolClient,
    jobId: string,
    organizationId: string,
  ): Promise<void> {
    let mode = 'off';
    try {
      mode = await this.configService.get(organizationId, 'customer_review_mode');
    } catch {
      mode = 'off';
    }

    if (mode !== 'mandatory') {
      return;
    }

    const reviewLink = await client.query<{ id: string }>(
      `
      SELECT id
      FROM customer_reviews
      WHERE job_id = $1
        AND organization_id = $2
      LIMIT 1
      `,
      [jobId, organizationId],
    );

    if (reviewLink.rows.length === 0) {
      throw new BadRequestException('Review link generation is required before completion in mandatory mode');
    }
  }

  private async assertOwnerDecisionRequiredForPaidReversal(
    client: PoolClient,
    job: JobRow,
    input: UpdateJobStatusDto,
    ctx: RequestContext,
  ): Promise<void> {
    if (ctx.role !== 'owner') {
      return;
    }

    if (input.targetStatus !== 'in_process') {
      return;
    }

    const payment = await client.query<{ id: string }>(
      `
      SELECT id
      FROM payments
      WHERE job_id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [job.id, ctx.organizationId],
    );

    if (payment.rows.length === 0) {
      return;
    }

    const undoWindowSeconds = await this.configService.getInt(ctx.organizationId, 'undo_window_seconds', 60);
    const timeline = await client.query<{ occurred_at: string }>(
      `
      SELECT occurred_at
      FROM job_timeline
      WHERE organization_id = $1
        AND job_id = $2
        AND event_type = 'status_transition'
        AND new_value->>'status' = $3
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [ctx.organizationId, job.id, job.status],
    );

    const lastTransitionAt = timeline.rows[0]?.occurred_at;
    if (!lastTransitionAt) {
      throw new BadRequestException('Owner retain-or-void decision is required before reversal');
    }

    const elapsedMs = Date.now() - new Date(lastTransitionAt).getTime();
    if (elapsedMs > undoWindowSeconds * 1000) {
      throw new BadRequestException(
        'Owner retain-or-void decision is required. Use POST /jobs/:id/payment-reversal-decision',
      );
    }
  }

  private async ownerReopenCancelledJob(
    client: PoolClient,
    job: JobRow,
    input: UpdateJobStatusDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number }> {
    if (ctx.role !== 'owner') {
      throw new ForbiddenException('Only owner can reopen cancelled jobs');
    }

    if (!input.reason?.trim()) {
      throw new BadRequestException('Reopen reason is required');
    }

    const previousStatus = await this.getLastPreCancellationStatus(client, job.id, ctx.organizationId);

    const updateResult = await client.query<{ status: JobStatus; version: number }>(
      `
      UPDATE jobs
      SET status = $3,
          cancelled_at = NULL,
          cancelled_by = NULL,
          cancellation_reason = NULL,
          updated_at = NOW(),
          version = version + 1
      WHERE id = $1
        AND organization_id = $2
        AND version = $4
        AND is_deleted = FALSE
      RETURNING status, version
      `,
      [job.id, ctx.organizationId, previousStatus, input.expectedVersion],
    );

    if (updateResult.rows.length === 0) {
      throw new ConflictException('Optimistic lock conflict: version mismatch');
    }

    await this.insertTimelineByUser(
      client,
      job.id,
      ctx,
      'reopened',
      { status: job.status },
      { status: previousStatus },
      input.reason,
    );

    return { ok: true, status: updateResult.rows[0].status, version: updateResult.rows[0].version };
  }

  private isRollback(job: JobRow, target: JobStatus): boolean {
    if (job.status === 'assigned') {
      const expected = job.type === 'complaint' ? 'new' : 'scheduled';
      return target === expected;
    }
    return OFFICE_ROLLBACK_MAP[job.status] === target;
  }

  private assertTransitionAllowed(job: JobRow, target: JobStatus, role: UserRole): void {
    if (role === 'technician' && target === 'cancelled') {
      throw new ForbiddenException('Technician cannot cancel jobs');
    }

    const forwardMap = job.type === 'installation' ? INSTALLATION_FORWARD : COMPLAINT_FORWARD;

    if (role === 'owner') {
      if (!this.isStatusValidForType(job.type, target)) {
        throw new BadRequestException('Target status is invalid for this job type');
      }
      return;
    }

    if (role === 'office_staff' || role === 'technician') {
      const allowed = forwardMap[job.status] ?? [];
      if (!allowed.includes(target)) {
        throw new ForbiddenException(`Transition ${job.status} -> ${target} is not allowed`);
      }
      return;
    }

    throw new ForbiddenException('Invalid role for status transition');
  }

  private isStatusValidForType(type: JobType, status: JobStatus): boolean {
    if (type === 'installation') {
      return [
        'pending_schedule',
        'scheduled',
        'assigned',
        'acknowledged',
        'in_transit',
        'in_process',
        'completed',
        'cancelled',
        'cancellation_requested',
      ].includes(status);
    }

    return COMPLAINT_FORWARD[status] !== undefined;
  }

  private enforceTechnicianOwnership(job: JobRow, ctx: RequestContext): void {
    if (ctx.role !== 'technician') {
      return;
    }

    if (!job.technician_id || job.technician_id !== ctx.userId) {
      throw new ForbiddenException('Technician can update only own assigned jobs');
    }
  }

  private async getJobForUpdate(
    client: PoolClient,
    jobId: string,
    organizationId: string,
  ): Promise<JobRow> {
    const result = await client.query<JobRow>(
      `
      SELECT id, organization_id, type, status, source, dealer_id, technician_id, version, is_deleted
      FROM jobs
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      LIMIT 1
      FOR UPDATE
      `,
      [jobId, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Job not found');
    }

    return result.rows[0];
  }

  private async flagVcidReviewIfDealerMismatch(
    client: PoolClient,
    jobId: string,
    organizationId: string,
    vcid: string,
    dealerId: string,
  ): Promise<void> {
    const overlap = await client.query<{ id: string }>(
      `
      SELECT j.id
      FROM jobs j
      WHERE j.organization_id = $1
        AND j.vcid = $2
        AND j.source = 'via_dealer'
        AND j.dealer_id IS NOT NULL
        AND j.dealer_id <> $3
        AND j.is_deleted = FALSE
      LIMIT 1
      `,
      [organizationId, vcid, dealerId],
    );

    if (overlap.rows.length === 0) {
      return;
    }

    await client.query(
      `
      INSERT INTO job_timeline (
        organization_id,
        job_id,
        event_type,
        previous_value,
        new_value,
        reason,
        occurred_at
      )
      VALUES ($1, $2, 'vcid_review_required', $3::jsonb, $4::jsonb, $5, NOW())
      `,
      [
        organizationId,
        jobId,
        JSON.stringify({ dealerId }),
        JSON.stringify({ vcid }),
        'Dealer-submitted phone matched VCID used by another dealer in same organization',
      ],
    );

    await this.notifyOwnerOfficeUsers(client, organizationId, 'vcid_review_required', jobId);
  }

  private async getDealerOwnedJob(
    client: PoolClient,
    jobId: string,
    ctx: DealerRequestContext,
  ): Promise<JobRow> {
    const result = await client.query<JobRow>(
      `
      SELECT id, organization_id, type, status, source, dealer_id, technician_id, version, is_deleted
      FROM jobs
      WHERE id = $1
        AND organization_id = $2
        AND source = 'via_dealer'
        AND dealer_id = $3
        AND is_deleted = FALSE
      LIMIT 1
      FOR UPDATE
      `,
      [jobId, ctx.organizationId, ctx.dealerId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Dealer job not found');
    }

    return result.rows[0];
  }

  private async autoRejectStaleCancellationRequests(
    client: PoolClient,
    job: JobRow,
    organizationId: string,
  ): Promise<void> {
    const pending = await client.query<PendingCancellationRequestRow>(
      `
      SELECT id, requested_by_dealer_id, reason, status_at_request
      FROM job_cancellation_requests
      WHERE organization_id = $1
        AND job_id = $2
        AND status = 'pending'
      ORDER BY requested_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [organizationId, job.id],
    );

    if (pending.rows.length === 0) {
      return;
    }

    if (job.status === 'cancellation_requested') {
      return;
    }

    await client.query(
      `
      UPDATE job_cancellation_requests
      SET status = 'rejected',
          decided_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND organization_id = $2
      `,
      [pending.rows[0].id, organizationId],
    );

    await client.query(
      `
      INSERT INTO job_timeline (
        organization_id,
        job_id,
        event_type,
        previous_value,
        new_value,
        reason,
        occurred_at
      )
      VALUES ($1, $2, 'system_event', $3::jsonb, $4::jsonb, $5, NOW())
      `,
      [
        organizationId,
        job.id,
        JSON.stringify({ cancellationRequestStatus: 'pending' }),
        JSON.stringify({ cancellationRequestStatus: 'rejected' }),
        'Auto-rejected stale cancellation request due to status advancement',
      ],
    );
  }

  private async getLastPreCancellationStatus(
    client: PoolClient,
    jobId: string,
    organizationId: string,
  ): Promise<JobStatus> {
    const cancellationEvent = await client.query<{ occurred_at: string }>(
      `
      SELECT occurred_at
      FROM job_timeline
      WHERE organization_id = $1
        AND job_id = $2
        AND event_type = 'cancellation'
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [organizationId, jobId],
    );

    if (cancellationEvent.rows.length === 0) {
      throw new BadRequestException('Cannot reopen without prior cancellation event');
    }

    const previousStatusEvent = await client.query<{ status: JobStatus }>(
      `
      SELECT new_value->>'status' AS status
      FROM job_timeline
      WHERE organization_id = $1
        AND job_id = $2
        AND event_type IN ('status_transition', 'status_rollback', 'reopened', 'cancellation')
        AND occurred_at < $3::timestamptz
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [organizationId, jobId, cancellationEvent.rows[0].occurred_at],
    );

    const status = previousStatusEvent.rows[0]?.status;
    if (!status) {
      throw new BadRequestException('No pre-cancellation status available for reopen');
    }

    return status;
  }

  private async validateCreationInput(
    client: PoolClient,
    input: CreateJobDto,
    organizationId: string,
  ): Promise<void> {
    if (input.type === 'installation' && input.issueDescription) {
      throw new BadRequestException('issueDescription must be null for installation jobs');
    }

    if (input.type === 'complaint' && input.installationNotes) {
      throw new BadRequestException('installationNotes must be null for complaint jobs');
    }

    if (input.source === 'via_dealer' && !input.dealerId) {
      throw new BadRequestException('dealerId is required when source is via_dealer');
    }

    const brandResult = await client.query<{ id: string }>(
      `
      SELECT id
      FROM brands
      WHERE id = $1
        AND organization_id = $2
        AND is_active = TRUE
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [input.brandId, organizationId],
    );

    if (brandResult.rows.length === 0) {
      throw new BadRequestException('Brand is invalid, inactive, or cross-organization');
    }

    if (input.dealerId) {
      const dealerResult = await client.query<{ id: string }>(
        `
        SELECT id
        FROM dealers
        WHERE id = $1
          AND organization_id = $2
          AND is_active = TRUE
          AND is_deleted = FALSE
        LIMIT 1
        `,
        [input.dealerId, organizationId],
      );

      if (dealerResult.rows.length === 0) {
        throw new BadRequestException('Dealer is invalid, inactive, or cross-organization');
      }

      if (input.source === 'via_dealer') {
        const dealerBrandResult = await client.query<{ dealer_id: string }>(
          `
          SELECT dealer_id
          FROM dealer_brands
          WHERE organization_id = $1
            AND dealer_id = $2
            AND brand_id = $3
          LIMIT 1
          `,
          [organizationId, input.dealerId, input.brandId],
        );

        if (dealerBrandResult.rows.length === 0) {
          throw new BadRequestException('Dealer is not linked to selected brand');
        }
      }
    }
  }

  private resolveInitialStatus(input: CreateJobDto):
    | 'scheduled'
    | 'pending_schedule'
    | 'new' {
    if (input.type === 'complaint') {
      return 'new';
    }

    if (input.scheduledAt) {
      return 'scheduled';
    }

    if (input.source === 'via_dealer') {
      return 'pending_schedule';
    }

    return 'scheduled';
  }

  private async resolveVcid(
    client: PoolClient,
    input: CreateJobDto,
    organizationId: string,
  ): Promise<LinkResolution> {
    const phoneMatches = await client.query<{
      vcid: string;
      customer_name: string;
      address: string;
    }>(
      `
      SELECT DISTINCT cp.vcid, vc.customer_name, vc.address
      FROM customer_phones cp
      INNER JOIN virtual_customers vc
        ON vc.id = cp.vcid
       AND vc.organization_id = cp.organization_id
       AND vc.is_deleted = FALSE
      WHERE cp.organization_id = $1
        AND cp.phone = $2
        AND cp.is_deleted = FALSE
      LIMIT 10
      `,
      [organizationId, input.phone],
    );
    const phoneMatchCount = phoneMatches.rows.length;

    if (phoneMatchCount > 1) {
      if (input.selectedVcid) {
        const selectedMatch = phoneMatches.rows.find((row) => row.vcid === input.selectedVcid);
        if (!selectedMatch) {
          throw new BadRequestException('selectedVcid is not part of phone match candidates');
        }

        return {
          vcid: selectedMatch.vcid,
          eventType: 'customer_linked',
          matchFound: true,
          matchedName: selectedMatch.customer_name,
          matchedAddress: selectedMatch.address,
        };
      }

      if (input.linkBehavior === 'create_new') {
        return this.createNewVcid(client, organizationId, input.customerName, input.address, {
          matchFound: true,
          matchedName: phoneMatches.rows[0].customer_name,
          matchedAddress: phoneMatches.rows[0].address,
        });
      }

      throw new ConflictException({
        code: 'MULTIPLE_VCID_MATCHES',
        message: 'Multiple customer matches found for phone. Select one VCID and retry.',
        candidates: phoneMatches.rows.map((row) => ({
          vcid: row.vcid,
          customerName: row.customer_name,
          address: row.address,
        })),
      });
    }

    if (phoneMatchCount > 0) {
      if (input.linkBehavior !== 'create_new') {
        const match = phoneMatches.rows[0];
        return {
          vcid: match.vcid,
          eventType: 'customer_linked',
          matchFound: true,
          matchedName: match.customer_name,
          matchedAddress: match.address,
        };
      }

      return this.createNewVcid(client, organizationId, input.customerName, input.address, {
        matchFound: true,
        matchedName: phoneMatches.rows[0].customer_name,
        matchedAddress: phoneMatches.rows[0].address,
      });
    }

    const hintedMatch = await client.query<{
      id: string;
      customer_name: string;
      address: string;
    }>(
      `
      SELECT id, customer_name, address
      FROM virtual_customers
      WHERE organization_id = $1
        AND is_deleted = FALSE
        AND levenshtein(lower(customer_name), lower($2)) <= 3
        AND address ILIKE '%' || split_part($3, ' ', 1) || '%'
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [organizationId, input.customerName, input.address],
    );
    const hintedMatchCount = hintedMatch.rows.length;

    if (hintedMatchCount > 0 && input.linkBehavior !== 'create_new') {
      const match = hintedMatch.rows[0];
      return {
        vcid: match.id,
        eventType: 'customer_linked',
        matchFound: true,
        matchedName: match.customer_name,
        matchedAddress: match.address,
      };
    }

    return this.createNewVcid(client, organizationId, input.customerName, input.address, {
      matchFound: hintedMatchCount > 0,
      matchedName: hintedMatchCount > 0 ? hintedMatch.rows[0].customer_name : null,
      matchedAddress: hintedMatchCount > 0 ? hintedMatch.rows[0].address : null,
    });
  }

  private async createNewVcid(
    client: PoolClient,
    organizationId: string,
    customerName: string,
    address: string,
    context: { matchFound: boolean; matchedName: string | null; matchedAddress: string | null },
  ): Promise<LinkResolution> {
    const vcidResult = await client.query<{ id: string }>(
      `
      INSERT INTO virtual_customers (organization_id, customer_name, address)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [organizationId, customerName, address],
    );

    return {
      vcid: vcidResult.rows[0].id,
      eventType: 'customer_link_dismissed',
      matchFound: context.matchFound,
      matchedName: context.matchedName,
      matchedAddress: context.matchedAddress,
    };
  }

  private async calculateComplaintFlags(
    client: PoolClient,
    jobType: JobType,
    vcid: string,
    organizationId: string,
  ): Promise<{
    isRepeat: boolean;
    isFrequent: boolean;
    repeatWindowDaysUsed: number | null;
    frequentThresholdUsed: number | null;
    frequentWindowUsed: number | null;
  }> {
    if (jobType !== 'complaint') {
      return {
        isRepeat: false,
        isFrequent: false,
        repeatWindowDaysUsed: null,
        frequentThresholdUsed: null,
        frequentWindowUsed: null,
      };
    }

    const repeatWindow = await this.configService.getInt(
      organizationId,
      'repeat_complaint_window_days',
      30,
    );
    const frequentThreshold = await this.configService.getInt(
      organizationId,
      'frequent_complaint_threshold',
      3,
    );
    const frequentWindow = await this.configService.getInt(
      organizationId,
      'frequent_complaint_window_days',
      90,
    );

    const repeatCount = await client.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM jobs
      WHERE organization_id = $1
        AND vcid = $2
        AND type = 'complaint'
        AND is_deleted = FALSE
        AND created_at > NOW() - ($3::text || ' days')::interval
      `,
      [organizationId, vcid, repeatWindow],
    );

    const frequentCount = await client.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM jobs
      WHERE organization_id = $1
        AND vcid = $2
        AND type = 'complaint'
        AND is_deleted = FALSE
        AND created_at > NOW() - ($3::text || ' days')::interval
      `,
      [organizationId, vcid, frequentWindow],
    );

    const repeatExistingCount = Number.parseInt(repeatCount.rows[0].count, 10);
    const frequentExistingCount = Number.parseInt(frequentCount.rows[0].count, 10);
    const isRepeat = repeatExistingCount >= 1;
    const isFrequent = frequentExistingCount + 1 >= frequentThreshold;

    if (isFrequent) {
      await client.query(
        `
        UPDATE virtual_customers
        SET is_frequent = TRUE,
            frequent_flagged_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
        `,
        [vcid, organizationId],
      );
    }

    return {
      isRepeat,
      isFrequent,
      repeatWindowDaysUsed: isRepeat ? repeatWindow : null,
      frequentThresholdUsed: isFrequent ? frequentThreshold : null,
      frequentWindowUsed: isFrequent ? frequentWindow : null,
    };
  }

  private async insertUnits(
    client: PoolClient,
    units: Array<{ label: string; notes?: string }>,
    jobId: string,
    organizationId: string,
  ): Promise<void> {
    for (const unit of units) {
      await client.query(
        `
        INSERT INTO job_units (organization_id, job_id, label, notes)
        VALUES ($1, $2, $3, $4)
        `,
        [organizationId, jobId, unit.label, unit.notes ?? null],
      );
    }
  }

  private async insertLinkageTimelineByUser(
    client: PoolClient,
    jobId: string,
    ctx: RequestContext,
    linkResolution: LinkResolution,
  ): Promise<void> {
    await this.insertTimelineByUser(
      client,
      jobId,
      ctx,
      linkResolution.eventType,
      null,
      {
        vcid: linkResolution.vcid,
        matchFound: linkResolution.matchFound,
        matchedName: linkResolution.matchedName,
        matchedAddress: linkResolution.matchedAddress,
      },
      null,
    );
  }

  private async insertLinkageTimelineByDealer(
    client: PoolClient,
    jobId: string,
    ctx: DealerRequestContext,
    linkResolution: LinkResolution,
  ): Promise<void> {
    await this.insertTimelineByDealer(
      client,
      jobId,
      ctx,
      linkResolution.eventType,
      null,
      {
        vcid: linkResolution.vcid,
        matchFound: linkResolution.matchFound,
        matchedName: linkResolution.matchedName,
        matchedAddress: linkResolution.matchedAddress,
      },
      null,
    );
  }

  private async insertTimelineByUser(
    client: PoolClient,
    jobId: string,
    ctx: RequestContext,
    eventType: string,
    previousValue: unknown,
    newValue: unknown,
    reason: string | null,
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO job_timeline (
        organization_id,
        job_id,
        event_type,
        actor_user_id,
        previous_value,
        new_value,
        reason,
        occurred_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, NOW())
      `,
      [
        ctx.organizationId,
        jobId,
        eventType,
        ctx.userId,
        JSON.stringify(previousValue ?? {}),
        JSON.stringify(newValue ?? {}),
        reason,
      ],
    );
  }

  private async insertTimelineByDealer(
    client: PoolClient,
    jobId: string,
    ctx: DealerRequestContext,
    eventType: string,
    previousValue: unknown,
    newValue: unknown,
    reason: string | null,
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO job_timeline (
        organization_id,
        job_id,
        event_type,
        actor_dealer_id,
        previous_value,
        new_value,
        reason,
        occurred_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, NOW())
      `,
      [
        ctx.organizationId,
        jobId,
        eventType,
        ctx.dealerId,
        JSON.stringify(previousValue ?? {}),
        JSON.stringify(newValue ?? {}),
        reason,
      ],
    );
  }

  private async dispatchRepeatNotifications(
    client: PoolClient,
    jobId: string,
    organizationId: string,
    flags: { isRepeat: boolean; isFrequent: boolean },
  ): Promise<void> {
    const eventTypes: string[] = [];
    if (flags.isRepeat) {
      eventTypes.push('repeat_complaint_detected');
    }
    if (flags.isFrequent) {
      eventTypes.push('frequent_complaint_detected');
    }

    if (eventTypes.length === 0) {
      return;
    }

    const recipients = await client.query<{ id: string }>(
      `
      SELECT id
      FROM users
      WHERE organization_id = $1
        AND is_deleted = FALSE
        AND is_active = TRUE
        AND role IN ('owner', 'office_staff')
      `,
      [organizationId],
    );

    for (const eventType of eventTypes) {
      for (const recipient of recipients.rows) {
        await this.insertUserNotification(
          client,
          organizationId,
          eventType,
          recipient.id,
          eventType === 'frequent_complaint_detected' ? null : jobId,
          { jobId },
        );
      }
    }
  }

  private async notifyOwnerOfficeUsers(
    client: PoolClient,
    organizationId: string,
    eventType: string,
    jobId: string | null,
  ): Promise<void> {
    const recipients = await client.query<{ id: string }>(
      `
      SELECT id
      FROM users
      WHERE organization_id = $1
        AND is_deleted = FALSE
        AND is_active = TRUE
        AND role IN ('owner', 'office_staff')
      `,
      [organizationId],
    );

    for (const recipient of recipients.rows) {
      await this.insertUserNotification(
        client,
        organizationId,
        eventType,
        recipient.id,
        jobId,
        { jobId },
      );
    }
  }

  private async notifyDealer(
    client: PoolClient,
    organizationId: string,
    dealerId: string,
    eventType: string,
    jobId: string | null,
  ): Promise<void> {
    await this.insertDealerNotification(client, organizationId, eventType, dealerId, jobId, { jobId });
  }

  private async insertUserNotification(
    client: PoolClient,
    organizationId: string,
    eventType: string,
    recipientUserId: string,
    jobId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO notifications (organization_id, event_type, job_id, recipient_user_id, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT DO NOTHING
      `,
      [organizationId, eventType, jobId, recipientUserId, JSON.stringify(payload)],
    );
  }

  private async insertDealerNotification(
    client: PoolClient,
    organizationId: string,
    eventType: string,
    recipientDealerId: string,
    jobId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO notifications (organization_id, event_type, job_id, recipient_dealer_id, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT DO NOTHING
      `,
      [organizationId, eventType, jobId, recipientDealerId, JSON.stringify(payload)],
    );
  }

  /**
   * Assign a technician to a job, with conflict detection and canonical conflict logging.
   * Enforces org/active/deleted checks, canonical ordering, and timeline/notification updates.
   */
  async assignTechnician(
    jobId: string,
    technicianId: string,
    acknowledgeConflict: boolean,
    ctx: RequestContext,
  ): Promise<{ conflictJobIds: string[] }> {
    return this.db.withTransaction(async (client) => {
      // 1. Fetch job and technician, validate org and status
      const [jobRes, techRes] = await Promise.all([
        client.query<{ id: string; organization_id: string; status: string; is_deleted: boolean; scheduled_at: string | null }>(
          `SELECT id, organization_id, status, is_deleted, scheduled_at FROM jobs WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE`,
          [jobId, ctx.organizationId],
        ),
        client.query<{ id: string; organization_id: string; is_active: boolean; is_deleted: boolean }>(
          `SELECT id, organization_id, is_active, is_deleted FROM users WHERE id = $1 AND organization_id = $2 AND is_active = TRUE AND is_deleted = FALSE AND role = 'technician'`,
          [technicianId, ctx.organizationId],
        ),
      ]);
      if (jobRes.rows.length === 0) throw new NotFoundException('Job not found');
      if (techRes.rows.length === 0) throw new BadRequestException('Technician invalid, inactive, or cross-organization');
      const job = jobRes.rows[0];
      // 2. Conflict detection (if job is scheduled)
      let conflictJobIds: string[] = [];
      if (job.scheduled_at) {
        const stdDuration = await this.configService.getInt(ctx.organizationId, 'standard_job_duration_mins', 120);
        const conflictRes = await client.query<{ id: string }>(
          `SELECT j.id FROM jobs j
            JOIN job_assignments ja ON ja.job_id = j.id AND ja.is_active = TRUE
           WHERE ja.technician_id = $1
             AND j.organization_id = $2
             AND j.scheduled_at BETWEEN $3 AND ($3::timestamp + ($4 || ' minutes')::interval)
             AND j.id <> $5
             AND j.is_deleted = FALSE`,
          [technicianId, ctx.organizationId, job.scheduled_at, stdDuration, jobId],
        );
        conflictJobIds = conflictRes.rows.map(r => r.id);
        if (conflictJobIds.length > 0 && !acknowledgeConflict) {
          // Return warning, require explicit acknowledgment
          return { conflictJobIds };
        }
      }
      // 3. Deactivate current assignment (if any)
      await client.query(
        `UPDATE job_assignments SET is_active = FALSE, unassigned_at = NOW() WHERE job_id = $1 AND is_active = TRUE`,
        [jobId],
      );
      // 4. Insert new assignment
      await client.query(
        `INSERT INTO job_assignments (job_id, technician_id, organization_id, is_active, assigned_at, created_by)
         VALUES ($1, $2, $3, TRUE, NOW(), $4)`,
        [jobId, technicianId, ctx.organizationId, ctx.userId],
      );
      // 5. Update job status to 'assigned'
      await client.query(
        `UPDATE jobs SET status = 'assigned', technician_id = $3, version = version + 1, updated_at = NOW() WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE`,
        [jobId, ctx.organizationId, technicianId],
      );
      // 6. Timeline event
      await this.insertTimelineByUser(client, jobId, ctx, 'assignment', null, { technicianId }, null);
      // 7. Notification to technician
      await this.insertUserNotification(
        client,
        ctx.organizationId,
        'job_assigned',
        technicianId,
        jobId,
        { jobId },
      );
      // 8. Analytics update (stub)
      // TODO: increment analytics_technician_daily.jobs_assigned
      // 9. If conflict acknowledged, log canonical conflict rows and timeline
      if (conflictJobIds.length > 0 && acknowledgeConflict) {
        for (const conflictId of conflictJobIds) {
          const [a, b] = [jobId, conflictId].sort();
          await client.query(
            `INSERT INTO scheduling_conflicts (job_id, conflicting_job_id, technician_id, organization_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [a, b, technicianId, ctx.organizationId],
          );
          await this.insertTimelineByUser(client, jobId, ctx, 'scheduling_conflict_ack', null, { conflictWith: conflictId }, null);
        }
      }
      return { conflictJobIds: [] };
    });
  }

  /**
   * Reassign a technician to a job, with conflict detection and canonical conflict logging.
   * Deactivates previous assignment, inserts new, and updates job status if needed.
   */
  async reassignTechnician(
    jobId: string,
    newTechnicianId: string,
    acknowledgeConflict: boolean,
    ctx: RequestContext,
  ): Promise<{ conflictJobIds: string[] }> {
    // For simplicity, call assignTechnician (deactivates any current assignment)
    return this.assignTechnician(jobId, newTechnicianId, acknowledgeConflict, ctx);
  }

  /**
   * Technician acknowledges a job: marks assignment acknowledged_at, transitions job to 'acknowledged'.
   */
  async acknowledgeJob(jobId: string, ctx: RequestContext): Promise<{ ok: true }> {
    return this.db.withTransaction(async (client) => {
      // Verify job belongs to org and exists
      const jobRes = await client.query<{ id: string; status: string; version: number }>(
        `SELECT id, status, version FROM jobs WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE`,
        [jobId, ctx.organizationId],
      );
      if (jobRes.rows.length === 0) throw new NotFoundException('Job not found');
      const job = jobRes.rows[0];

      // Verify active assignment belongs to this technician
      const assignRes = await client.query<{ id: string }>(
        `SELECT id FROM job_assignments WHERE job_id = $1 AND technician_id = $2 AND is_active = TRUE`,
        [jobId, ctx.userId],
      );
      if (assignRes.rows.length === 0) {
        throw new ForbiddenException('No active assignment found for this technician on this job');
      }

      // Update acknowledged_at on assignment
      await client.query(
        `UPDATE job_assignments SET acknowledged_at = NOW() WHERE job_id = $1 AND technician_id = $2 AND is_active = TRUE`,
        [jobId, ctx.userId],
      );

      // Transition job to 'acknowledged'
      const updateRes = await client.query(
        `UPDATE jobs SET status = 'acknowledged', version = version + 1, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND version = $3 AND is_deleted = FALSE`,
        [jobId, ctx.organizationId, job.version],
      );
      if ((updateRes.rowCount ?? 0) === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      // Timeline event
      await this.insertTimelineByUser(client, jobId, ctx, 'status_transition', { status: job.status }, { status: 'acknowledged' }, null);

      return { ok: true };
    });
  }

  private async moveToNeedsRevisit(
    client: PoolClient,
    job: JobRow,
    input: UpdateJobStatusDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: JobStatus; version: number }> {
    if (job.type !== 'complaint') {
      throw new BadRequestException('Only complaint jobs can be moved to needs_revisit');
    }

    this.assertTransitionAllowed(job, 'needs_revisit', ctx.role);

    if (!input.revisitReason) {
      throw new BadRequestException('revisitReason is required for needs_revisit transition');
    }

    if (input.revisitReason === 'custom' && !input.customRevisitReason?.trim()) {
      throw new BadRequestException('customRevisitReason is required when revisitReason is custom');
    }

    if (ctx.role === 'technician') {
      await this.assertTechnicianActiveAssignment(client, job.id, ctx);
    }

    const updateResult = await client.query<{ status: JobStatus; version: number }>(
      `
      UPDATE jobs
      SET status = 'needs_revisit',
          revisit_count = revisit_count + 1,
          updated_at = NOW(),
          version = version + 1
      WHERE id = $1
        AND organization_id = $2
        AND version = $3
        AND is_deleted = FALSE
      RETURNING status, version
      `,
      [job.id, ctx.organizationId, input.expectedVersion],
    );

    if (updateResult.rows.length === 0) {
      throw new ConflictException('Optimistic lock conflict: version mismatch');
    }

    const nextSequenceResult = await client.query<{ next_sequence: number }>(
      `
      SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
      FROM revisits
      WHERE organization_id = $1
        AND job_id = $2
        AND is_deleted = FALSE
      `,
      [ctx.organizationId, job.id],
    );

    const nextSequence = nextSequenceResult.rows[0].next_sequence;

    const revisitInsert = await client.query<{ id: string }>(
      `
      INSERT INTO revisits (
        organization_id,
        job_id,
        sequence_number,
        reason,
        custom_reason
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        ctx.organizationId,
        job.id,
        nextSequence,
        input.revisitReason,
        input.revisitReason === 'custom' ? input.customRevisitReason?.trim() ?? null : null,
      ],
    );

    await this.insertTimelineByUser(
      client,
      job.id,
      ctx,
      'status_transition',
      { status: job.status },
      { status: 'needs_revisit' },
      null,
    );

    await this.insertTimelineByUser(
      client,
      job.id,
      ctx,
      'revisit_created',
      null,
      {
        revisitId: revisitInsert.rows[0].id,
        sequenceNumber: nextSequence,
        reason: input.revisitReason,
        customReason: input.revisitReason === 'custom' ? input.customRevisitReason?.trim() ?? null : null,
      },
      null,
    );

    await this.notifyOwnerOfficeUsers(client, ctx.organizationId, 'revisit_pending_scheduling', job.id);

    if (nextSequence >= 3) {
      await this.notifyOwnerOfficeUsers(client, ctx.organizationId, 'third_revisit_reached', job.id);
    }

    return {
      ok: true,
      status: updateResult.rows[0].status,
      version: updateResult.rows[0].version,
    };
  }

  private async assertTechnicianBelongsToOrg(
    client: PoolClient,
    technicianId: string,
    organizationId: string,
  ): Promise<void> {
    const result = await client.query<{ id: string }>(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND organization_id = $2
        AND role = 'technician'
        AND is_active = TRUE
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [technicianId, organizationId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Technician not found in this organization');
    }
  }

  private async assertTechnicianActiveAssignment(
    client: PoolClient,
    jobId: string,
    ctx: RequestContext,
  ): Promise<void> {
    const assignment = await client.query<{ id: string }>(
      `
      SELECT id
      FROM job_assignments
      WHERE organization_id = $1
        AND job_id = $2
        AND technician_id = $3
        AND is_active = TRUE
      LIMIT 1
      `,
      [ctx.organizationId, jobId, ctx.userId],
    );

    if (assignment.rows.length === 0) {
      throw new ForbiddenException('Technician has no active assignment for this job');
    }
  }

  private async applyStatusTransitionWithPunctuality(
    client: PoolClient,
    job: JobRow,
    targetStatus: JobStatus,
    expectedVersion: number,
    ctx: RequestContext,
  ): Promise<{ status: JobStatus; version: number }> {
    if (targetStatus !== 'in_process') {
      const updateResult = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = $3,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $4
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [job.id, ctx.organizationId, targetStatus, expectedVersion],
      );

      if (updateResult.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      return updateResult.rows[0];
    }

    const graceMins = await this.configService.getInt(
      ctx.organizationId,
      'punctuality_grace_period_mins',
      15,
    );

    const scheduleLookup = await client.query<{ scheduled_at: string | null }>(
      `
      SELECT COALESCE(
        (
          SELECT r.scheduled_at
          FROM revisits r
          WHERE r.organization_id = $1
            AND r.job_id = $2
            AND r.is_deleted = FALSE
            AND r.scheduled_at IS NOT NULL
          ORDER BY r.sequence_number DESC
          LIMIT 1
        ),
        j.scheduled_at
      ) AS scheduled_at
      FROM jobs j
      WHERE j.id = $2
        AND j.organization_id = $1
        AND j.is_deleted = FALSE
      LIMIT 1
      `,
      [ctx.organizationId, job.id],
    );

    const scheduledAt = scheduleLookup.rows[0]?.scheduled_at;
    if (!scheduledAt) {
      const fallbackUpdate = await client.query<{ status: JobStatus; version: number }>(
        `
        UPDATE jobs
        SET status = 'in_process',
            actual_arrival = NOW(),
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $3
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [job.id, ctx.organizationId, expectedVersion],
      );

      if (fallbackUpdate.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      return fallbackUpdate.rows[0];
    }

    const punctualityUpdate = await client.query<{ status: JobStatus; version: number }>(
      `
      UPDATE jobs
      SET status = 'in_process',
          actual_arrival = NOW(),
          visit_outcome = CASE
            WHEN NOW() <= $5::timestamptz + ($4::text || ' minutes')::interval THEN 'on_time'::visit_outcome_type
            ELSE 'late'::visit_outcome_type
          END,
          late_by_minutes = CASE
            WHEN NOW() <= $5::timestamptz + ($4::text || ' minutes')::interval THEN NULL
            ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - $5::timestamptz)) / 60.0)::int)
          END,
          updated_at = NOW(),
          version = version + 1
      WHERE id = $1
        AND organization_id = $2
        AND version = $3
        AND is_deleted = FALSE
      RETURNING status, version
      `,
      [job.id, ctx.organizationId, expectedVersion, graceMins, scheduledAt],
    );

    if (punctualityUpdate.rows.length === 0) {
      throw new ConflictException('Optimistic lock conflict: version mismatch');
    }

    return punctualityUpdate.rows[0];
  }

  async listOfficeJobs(
    query: {
      status?: string;
      type?: string;
      technicianId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      limit?: number;
      brandId?: string;
      chronicOnly?: boolean;
    },
    ctx: RequestContext,
  ): Promise<{ jobs: Record<string, unknown>[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 10), 100);
    const offset = (page - 1) * limit;

    // Technicians may only see their own jobs — override any supplied filter
    if (ctx.role === 'technician') {
      query = { ...query, technicianId: ctx.userId };
    }

    const conditions: string[] = ['j.organization_id = $1', 'j.is_deleted = FALSE'];
    const params: unknown[] = [ctx.organizationId];

    const add = (sql: string, value: unknown): void => {
      params.push(value);
      conditions.push(sql.replace(':p', `$${params.length}`));
    };

    if (query.status) add('j.status = :p', query.status);
    if (query.type) add('j.type = :p', query.type);
    if (query.technicianId) add('j.technician_id = :p', query.technicianId);
    if (query.dateFrom) add('j.created_at >= :p::timestamptz', query.dateFrom);
    if (query.dateTo) add('j.created_at <= :p::timestamptz', query.dateTo);
    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(
        `(j.customer_name ILIKE $${params.length} OR j.phone ILIKE $${params.length} OR j.address ILIKE $${params.length})`,
      );
    }
    if (query.brandId) add('j.brand_id = :p', query.brandId);
    if (query.chronicOnly) conditions.push('j.is_chronic = TRUE');

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM jobs j WHERE ${where}`,
      params,
    );
    const total = Number.parseInt(countResult.rows[0].count, 10);

    params.push(limit);
    params.push(offset);

    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.type,
        j.status,
        j.source,
        j.brand_id,
        b.name AS brand_name,
        j.dealer_id,
        d.name AS dealer_name,
        j.technician_id AS assigned_technician_id,
        u.full_name AS assigned_technician_name,
        j.customer_name,
        j.phone,
        j.address,
        j.scheduled_at,
        j.created_at,
        j.version,
        j.is_repeat,
        j.is_frequent,
        j.is_chronic,
        j.updated_at,
        p.amount AS amount_collected,
        pm.name AS payment_method_name
      FROM jobs j
      LEFT JOIN brands b ON b.id = j.brand_id
      LEFT JOIN dealers d ON d.id = j.dealer_id
      LEFT JOIN users u ON u.id = j.technician_id
      LEFT JOIN payments p ON p.job_id = j.id AND p.organization_id = j.organization_id AND p.is_deleted = FALSE
      LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE ${where}
      ORDER BY j.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );

    return {
      jobs: result.rows as Record<string, unknown>[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findByIdForOffice(jobId: string, ctx: RequestContext): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.type,
        j.status,
        j.source,
        j.brand_id,
        b.name AS brand_name,
        j.dealer_id,
        d.name AS dealer_name,
        j.technician_id AS assigned_technician_id,
        u.full_name AS assigned_technician_name,
        j.customer_name,
        j.phone,
        j.address,
        j.issue_description,
        j.installation_notes,
        j.scheduled_at,
        j.is_repeat,
        j.is_frequent,
        j.is_chronic,
        j.created_at,
        j.updated_at,
        j.version,
        CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', p.id,
          'amount', p.amount,
          'payment_method_id', p.payment_method_id,
          'payment_method_name', pm.name,
          'status', p.status,
          'recorded_by_name', rb.full_name,
          'recorded_at', p.created_at
        ) END AS payment
      FROM jobs j
      LEFT JOIN brands b ON b.id = j.brand_id
      LEFT JOIN dealers d ON d.id = j.dealer_id
      LEFT JOIN users u ON u.id = j.technician_id
      LEFT JOIN payments p ON p.job_id = j.id AND p.organization_id = j.organization_id AND p.is_deleted = FALSE
      LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      LEFT JOIN users rb ON rb.id = p.recorded_by
      WHERE j.id = $1
        AND j.organization_id = $2
        AND j.is_deleted = FALSE
      LIMIT 1
      `,
      [jobId, ctx.organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Job not found');
    }

    return result.rows[0] as Record<string, unknown>;
  }

  async getJobTimeline(
    jobId: string,
    ctx: RequestContext,
    limit = 100,
  ): Promise<Record<string, unknown>[]> {
    const jobCheck = await this.db.query<{ id: string }>(
      `SELECT id FROM jobs WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE LIMIT 1`,
      [jobId, ctx.organizationId],
    );
    if (jobCheck.rows.length === 0) {
      throw new NotFoundException('Job not found');
    }

    const result = await this.db.query(
      `
      SELECT
        jt.id,
        jt.event_type,
        jt.actor_user_id,
        jt.actor_dealer_id,
        u.full_name AS actor_name,
        jt.previous_value,
        jt.new_value,
        jt.reason,
        jt.occurred_at
      FROM job_timeline jt
      LEFT JOIN users u ON u.id = jt.actor_user_id
      WHERE jt.job_id = $1
        AND jt.organization_id = $2
      ORDER BY jt.occurred_at ASC
      LIMIT $3
      `,
      [jobId, ctx.organizationId, Math.min(limit, 500)],
    );

    return result.rows as Record<string, unknown>[];
  }

  async getJobRevisits(jobId: string, ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const jobCheck = await this.db.query<{ id: string }>(
      `SELECT id FROM jobs WHERE id = $1 AND organization_id = $2 AND is_deleted = FALSE LIMIT 1`,
      [jobId, ctx.organizationId],
    );
    if (jobCheck.rows.length === 0) {
      throw new NotFoundException('Job not found');
    }

    const result = await this.db.query(
      `
      SELECT
        r.id,
        r.sequence_number,
        r.reason,
        r.custom_reason,
        CASE WHEN ra.is_active THEN 'assigned' ELSE 'unassigned' END AS status,
        u.full_name AS assigned_technician_name,
        r.created_at
      FROM revisits r
      LEFT JOIN revisit_assignments ra
        ON ra.revisit_id = r.id AND ra.is_active = TRUE
      LEFT JOIN users u ON u.id = ra.technician_id
      WHERE r.job_id = $1
        AND r.organization_id = $2
        AND r.is_deleted = FALSE
      ORDER BY r.sequence_number ASC
      `,
      [jobId, ctx.organizationId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async patchJobPayment(
    jobId: string,
    input: { paymentMethodId?: string; amount?: number },
    ctx: RequestContext,
  ): Promise<{ ok: true }> {
    const updates: string[] = [];
    const params: unknown[] = [jobId, ctx.organizationId];

    if (input.paymentMethodId !== undefined) {
      params.push(input.paymentMethodId);
      updates.push(`payment_method_id = $${params.length}`);
    }
    if (input.amount !== undefined) {
      params.push(input.amount);
      updates.push(`amount = $${params.length}`);
    }

    if (updates.length === 0) {
      return { ok: true };
    }

    updates.push('updated_at = NOW()');

    const result = await this.db.query(
      `
      UPDATE payments
      SET ${updates.join(', ')}
      WHERE job_id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      `,
      params,
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundException('Payment record not found for this job');
    }

    return { ok: true };
  }

  async getTechnicianStats(
    technicianId: string,
    ctx: RequestContext,
  ): Promise<{ active_jobs: number; completion_rate: number | null }> {
    const techCheck = await this.db.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND role = 'technician' AND is_deleted = FALSE LIMIT 1`,
      [technicianId, ctx.organizationId],
    );
    if (techCheck.rows.length === 0) {
      throw new NotFoundException('Technician not found');
    }

    const activeResult = await this.db.query<{ active_jobs: string }>(
      `
      SELECT COUNT(*)::text AS active_jobs
      FROM job_assignments ja
      INNER JOIN jobs j ON j.id = ja.job_id AND j.organization_id = ja.organization_id
      WHERE ja.technician_id = $1
        AND ja.organization_id = $2
        AND ja.is_active = TRUE
        AND j.is_deleted = FALSE
        AND j.status NOT IN ('cancelled', 'completed', 'resolved', 'resolved_on_revisit')
      `,
      [technicianId, ctx.organizationId],
    );

    const totalResult = await this.db.query<{ total: string; completed: string }>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE j.status IN ('completed', 'resolved', 'resolved_on_revisit'))::text AS completed
      FROM job_assignments ja
      INNER JOIN jobs j ON j.id = ja.job_id AND j.organization_id = ja.organization_id
      WHERE ja.technician_id = $1
        AND ja.organization_id = $2
        AND j.is_deleted = FALSE
      `,
      [technicianId, ctx.organizationId],
    );

    const total = Number.parseInt(totalResult.rows[0].total, 10);
    const completed = Number.parseInt(totalResult.rows[0].completed, 10);

    return {
      active_jobs: Number.parseInt(activeResult.rows[0].active_jobs, 10),
      completion_rate: total > 0 ? Math.round((completed / total) * 100) / 100 : null,
    };
  }

  async search(
    query: SearchQueryDto,
    ctx: RequestContext,
  ): Promise<{ jobs: Array<{ id: string; customerName: string; status: string }> }> {
    const q = (query.q ?? '').trim();
    const limit = Math.min(query.limit ?? 10, 50);

    if (!q) {
      return { jobs: [] };
    }

    const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;
    const result = await this.db.query(
      `SELECT id, customer_name, status FROM jobs
       WHERE organization_id = $1
         AND is_deleted = false
         AND (id::text ILIKE $2 ESCAPE '\\' OR customer_name ILIKE $2 ESCAPE '\\')
       ORDER BY created_at DESC
       LIMIT $3`,
      [ctx.organizationId, pattern, limit],
    );

    return {
      jobs: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        customerName: row.customer_name as string,
        status: row.status as string,
      })),
    };
  }

  async batchSchedule(
    body: BatchScheduleDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; scheduled: number; errors: Array<{ jobId: string; reason: string }> }> {
    const { jobIds, scheduledAt, technicianId } = body;
    const errors: Array<{ jobId: string; reason: string }> = [];
    let scheduled = 0;

    for (const jobId of jobIds) {
      try {
        // Verify job belongs to org and is schedulable
        const check = await this.db.query(
          `SELECT id, status FROM jobs WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
          [jobId, ctx.organizationId],
        );
        if (check.rows.length === 0) {
          errors.push({ jobId, reason: 'not found' });
          continue;
        }
        const job = check.rows[0] as { id: string; status: string };
        if (!['pending', 'scheduled'].includes(job.status)) {
          errors.push({ jobId, reason: `cannot schedule job in status ${job.status}` });
          continue;
        }

        await this.db.query(
          `UPDATE jobs SET scheduled_at = $1, technician_id = COALESCE($2, technician_id), status = 'scheduled', updated_at = NOW(), version = version + 1 WHERE id = $3 AND organization_id = $4`,
          [scheduledAt, technicianId ?? null, jobId, ctx.organizationId],
        );
        scheduled++;
      } catch (err) {
        console.error(`[batchSchedule] jobId=${jobId}`, err);
        errors.push({ jobId, reason: 'internal error' });
      }
    }

    return { ok: true, scheduled, errors };
  }

  async getTechnicianJobs(
    technicianId: string,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT
        j.id,
        j.customer_name,
        j.type,
        j.status,
        j.created_at,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'collected'), 0) AS amount_collected,
        ROUND(AVG(r.star_rating)::numeric, 1) AS avg_rating
      FROM jobs j
      LEFT JOIN payments p
        ON p.job_id = j.id
        AND p.organization_id = j.organization_id
        AND p.is_deleted = FALSE
      LEFT JOIN customer_reviews r
        ON r.job_id = j.id
        AND r.organization_id = j.organization_id
      WHERE j.organization_id = $1
        AND j.technician_id = $2
        AND j.is_deleted = FALSE
      GROUP BY j.id, j.customer_name, j.type, j.status, j.created_at
      ORDER BY j.created_at DESC
      LIMIT 50
      `,
      [ctx.organizationId, technicianId],
    );

    return result.rows as Record<string, unknown>[];
  }
}
