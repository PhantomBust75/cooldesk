import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import {
  CreatePaymentMethodDto,
  OwnerPaymentDecisionDto,
  PaymentStatus,
  UpdatePaymentDto,
  UpdatePaymentMethodDto,
  UpdatePaymentStatusDto,
} from './payments.dto';

type PaymentRow = {
  id: string;
  organization_id: string;
  job_id: string;
  amount: string;
  payment_method_id: string | null;
  status: PaymentStatus;
  version: number;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DatabaseService) {}

  async listPaymentMethods(ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT id, name, is_active, created_at, updated_at
      FROM payment_methods
      WHERE organization_id = $1
        AND is_deleted = FALSE
      ORDER BY name ASC
      `,
      [ctx.organizationId],
    );

    return result.rows as Record<string, unknown>[];
  }

  async createPaymentMethod(
    input: CreatePaymentMethodDto,
    ctx: RequestContext,
  ): Promise<{ id: string }> {
    const insert = await this.db.query<{ id: string }>(
      `
      INSERT INTO payment_methods (organization_id, name, is_active, is_deleted)
      VALUES ($1, $2, TRUE, FALSE)
      RETURNING id
      `,
      [ctx.organizationId, input.name.trim()],
    );

    return { id: insert.rows[0].id };
  }

  async updatePaymentMethod(
    paymentMethodId: string,
    input: UpdatePaymentMethodDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; isActive: boolean }> {
    if (input.isActive !== false) {
      throw new BadRequestException('Only deactivation is supported for payment methods');
    }

    const update = await this.db.query<{ is_active: boolean }>(
      `
      UPDATE payment_methods
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      RETURNING is_active
      `,
      [paymentMethodId, ctx.organizationId],
    );

    if (update.rows.length === 0) {
      throw new NotFoundException('Payment method not found');
    }

    return { ok: true, isActive: update.rows[0].is_active };
  }

  async updatePayment(
    paymentId: string,
    input: UpdatePaymentDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; version: number }> {
    return this.db.withTransaction(async (client) => {
      const payment = await this.getPaymentForUpdate(client, paymentId, ctx.organizationId);
      const job = await this.getJobStatus(client, payment.job_id, ctx.organizationId);

      const isClosed = ['completed', 'resolved', 'resolved_on_revisit'].includes(job.status);

      if (ctx.role === 'technician') {
        throw new ForbiddenException('Technician cannot edit submitted payments');
      }

      if (ctx.role === 'office_staff') {
        if (isClosed) {
          throw new ForbiddenException('Office staff cannot edit payments on closed jobs');
        }
        if (typeof input.amount === 'number') {
          throw new ForbiddenException('Office staff cannot modify payment amount');
        }
      }

      if (input.paymentMethodId) {
        await this.assertPaymentMethodInOrg(client, input.paymentMethodId, ctx.organizationId);
      }

      const amount = typeof input.amount === 'number' ? input.amount : Number.parseFloat(payment.amount);
      const methodId = input.paymentMethodId ?? payment.payment_method_id;

      const update = await client.query<{ version: number }>(
        `
        UPDATE payments
        SET amount = $3,
            payment_method_id = $4,
            last_edited_by = $5,
            last_edited_at = NOW(),
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $6
          AND is_deleted = FALSE
        RETURNING version
        `,
        [paymentId, ctx.organizationId, amount, methodId, ctx.userId, input.expectedVersion],
      );

      if (update.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await this.insertTimeline(
        client,
        payment.job_id,
        ctx,
        'payment_edited',
        {
          amount: Number.parseFloat(payment.amount),
          paymentMethodId: payment.payment_method_id,
        },
        {
          amount,
          paymentMethodId: methodId,
        },
        null,
      );

      return { ok: true, version: update.rows[0].version };
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    input: UpdatePaymentStatusDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: PaymentStatus; version: number }> {
    return this.db.withTransaction(async (client) => {
      const payment = await this.getPaymentForUpdate(client, paymentId, ctx.organizationId);
      this.assertStatusTransitionAllowed(payment.status, input.status);

      const update = await client.query<{ status: PaymentStatus; version: number }>(
        `
        UPDATE payments
        SET status = $3,
            last_edited_by = $4,
            last_edited_at = NOW(),
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $5
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [paymentId, ctx.organizationId, input.status, ctx.userId, input.expectedVersion],
      );

      if (update.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await this.insertTimeline(
        client,
        payment.job_id,
        ctx,
        'payment_edited',
        { status: payment.status },
        { status: input.status },
        input.reason ?? null,
      );

      return {
        ok: true,
        status: update.rows[0].status,
        version: update.rows[0].version,
      };
    });
  }

  async decideOwnerPaymentReversal(
    jobId: string,
    input: OwnerPaymentDecisionDto,
    ctx: RequestContext,
  ): Promise<{ ok: true; status: string; version: number }> {
    if (ctx.role !== 'owner') {
      throw new ForbiddenException('Only owner can decide retain-or-void');
    }

    return this.db.withTransaction(async (client) => {
      const payment = await client.query<PaymentRow>(
        `
        SELECT id, organization_id, job_id, amount, payment_method_id, status, version
        FROM payments
        WHERE organization_id = $1
          AND job_id = $2
          AND is_deleted = FALSE
        LIMIT 1
        FOR UPDATE
        `,
        [ctx.organizationId, jobId],
      );

      if (payment.rows.length === 0) {
        throw new NotFoundException('Payment not found for job');
      }

      const paymentRow = payment.rows[0];
      if (paymentRow.version !== input.expectedPaymentVersion) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      if (input.decision === 'retain') {
        await client.query(
          `
          UPDATE payments
          SET retained_note = $3,
              last_edited_by = $4,
              last_edited_at = NOW(),
              updated_at = NOW(),
              version = version + 1
          WHERE id = $1
            AND organization_id = $2
          `,
          [paymentRow.id, ctx.organizationId, input.retainedNote ?? 'Recorded on prior completion', ctx.userId],
        );

        await this.insertTimeline(
          client,
          jobId,
          ctx,
          'payment_retained',
          null,
          { retainedNote: input.retainedNote ?? 'Recorded on prior completion' },
          null,
        );
      } else {
        if (!input.voidReason?.trim()) {
          throw new BadRequestException('voidReason is required when decision is void');
        }

        await client.query(
          `
          UPDATE payments
          SET status = 'pending',
              voided_at = NOW(),
              voided_by = $3,
              void_reason = $4,
              last_edited_by = $3,
              last_edited_at = NOW(),
              updated_at = NOW(),
              version = version + 1
          WHERE id = $1
            AND organization_id = $2
          `,
          [paymentRow.id, ctx.organizationId, ctx.userId, input.voidReason],
        );

        await this.insertTimeline(
          client,
          jobId,
          ctx,
          'payment_void',
          null,
          { voidReason: input.voidReason },
          input.voidReason,
        );

        await this.insertTimeline(
          client,
          jobId,
          ctx,
          'rollback_payment_voided',
          null,
          { voidReason: input.voidReason },
          input.voidReason,
        );
      }

      const jobUpdate = await client.query<{ status: string; version: number }>(
        `
        UPDATE jobs
        SET status = 'in_process',
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
          AND organization_id = $2
          AND version = $3
          AND is_deleted = FALSE
        RETURNING status, version
        `,
        [jobId, ctx.organizationId, input.expectedJobVersion],
      );

      if (jobUpdate.rows.length === 0) {
        throw new ConflictException('Optimistic lock conflict: version mismatch');
      }

      await this.insertTimeline(
        client,
        jobId,
        ctx,
        'status_rollback',
        { status: 'completed_or_resolved' },
        { status: 'in_process' },
        input.decision,
      );

      return {
        ok: true,
        status: jobUpdate.rows[0].status,
        version: jobUpdate.rows[0].version,
      };
    });
  }

  private async getPaymentForUpdate(
    client: PoolClient,
    paymentId: string,
    organizationId: string,
  ): Promise<PaymentRow> {
    const result = await client.query<PaymentRow>(
      `
      SELECT id, organization_id, job_id, amount, payment_method_id, status, version
      FROM payments
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      LIMIT 1
      FOR UPDATE
      `,
      [paymentId, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    return result.rows[0];
  }

  private async getJobStatus(
    client: PoolClient,
    jobId: string,
    organizationId: string,
  ): Promise<{ status: string }> {
    const result = await client.query<{ status: string }>(
      `
      SELECT status
      FROM jobs
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [jobId, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Job not found');
    }

    return result.rows[0];
  }

  private assertStatusTransitionAllowed(from: PaymentStatus, to: PaymentStatus): void {
    const allowed: Record<PaymentStatus, PaymentStatus[]> = {
      pending: ['collected', 'disputed'],
      collected: ['refunded', 'disputed'],
      disputed: ['collected', 'refunded'],
      refunded: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Payment transition ${from} -> ${to} is not allowed`);
    }
  }

  private async assertPaymentMethodInOrg(
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

  private async insertTimeline(
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
}
