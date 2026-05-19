import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';

type TimelineEventRow = {
  id: string;
  event_type: 'status_transition' | 'payment_recorded' | 'review_submitted';
  job_id: string;
  occurred_at: string;
  new_value: Record<string, unknown> | null;
};

type JobFactsRow = {
  id: string;
  organization_id: string;
  technician_id: string | null;
  brand_id: string;
  dealer_id: string | null;
  type: 'installation' | 'complaint';
  source: 'direct' | 'via_dealer';
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  async processOrgEvents(
    organizationId: string,
    batchSize = 500,
  ): Promise<{ processed: number }> {
    return this.db.withTransaction(async (client) => {
      const events = await client.query<TimelineEventRow>(
        `
        SELECT jt.id, jt.event_type, jt.job_id, jt.occurred_at, jt.new_value
        FROM job_timeline jt
        WHERE jt.event_type IN ('status_transition', 'payment_recorded', 'review_submitted')
          AND jt.organization_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM analytics_processed_events ape
            WHERE ape.timeline_event_id = jt.id
          )
        ORDER BY jt.occurred_at
        LIMIT $2
        `,
        [organizationId, batchSize],
      );

      for (const event of events.rows) {
        await this.applyEvent(client, organizationId, event);
        await client.query(
          `
          INSERT INTO analytics_processed_events (timeline_event_id, processed_at, organization_id)
          VALUES ($1, NOW(), $2)
          ON CONFLICT (timeline_event_id) DO NOTHING
          `,
          [event.id, organizationId],
        );
      }

      return { processed: events.rows.length };
    });
  }

  async processFromRequest(
    input: { organizationId?: string; batchSize?: number },
    ctx: RequestContext,
  ): Promise<{ processed: number; organizationId: string }> {
    const organizationId = input.organizationId ?? ctx.organizationId;
    const result = await this.processOrgEvents(organizationId, input.batchSize ?? 500);
    return { ...result, organizationId };
  }

  async purgeProcessedEvents(): Promise<{ deleted: number }> {
    const result = await this.db.query<{ deleted: number }>(
      `SELECT fn_purge_analytics_processed_events() AS deleted`,
    );
    return { deleted: Number(result.rows[0]?.deleted ?? 0) };
  }

  private async applyEvent(
    client: PoolClient,
    organizationId: string,
    event: TimelineEventRow,
  ): Promise<void> {
    const job = await client.query<JobFactsRow>(
      `
      SELECT id, organization_id, technician_id, brand_id, dealer_id, type, source
      FROM jobs
      WHERE id = $1
        AND organization_id = $2
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [event.job_id, organizationId],
    );

    if (job.rows.length === 0) {
      return;
    }

    const facts = job.rows[0];
    const metricDate = new Date(event.occurred_at).toISOString().slice(0, 10);

    if (event.event_type === 'status_transition') {
      const status = String(event.new_value?.status ?? '');
      await this.applyStatusTransition(client, organizationId, metricDate, status, facts);
      return;
    }

    if (event.event_type === 'payment_recorded') {
      const amountRaw = event.new_value?.amount;
      const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw ?? 0);
      await this.applyPaymentRecorded(client, organizationId, metricDate, amount, facts);
      return;
    }

    if (event.event_type === 'review_submitted') {
      await this.applyReviewSubmitted(client, organizationId, metricDate, facts);
    }
  }

  private async applyReviewSubmitted(
    client: PoolClient,
    organizationId: string,
    metricDate: string,
    facts: JobFactsRow,
  ): Promise<void> {
    const modeResult = await client.query<{ value: string }>(
      `
      SELECT value
      FROM system_config
      WHERE organization_id = $1
        AND key = 'customer_review_mode'
      LIMIT 1
      `,
      [organizationId],
    );

    const mode = modeResult.rows[0]?.value ?? 'off';
    if (mode === 'off') {
      await client.query(
        `
        UPDATE analytics_business_daily
        SET avg_star_rating = NULL,
            updated_at = NOW()
        WHERE organization_id = $1
          AND metric_date = $2::date
        `,
        [organizationId, metricDate],
      );

      if (facts.technician_id) {
        await client.query(
          `
          UPDATE analytics_technician_daily
          SET avg_star_rating = NULL,
              updated_at = NOW()
          WHERE organization_id = $1
            AND metric_date = $2::date
            AND technician_id = $3
          `,
          [organizationId, metricDate, facts.technician_id],
        );
      }

      return;
    }

    const orgAvg = await client.query<{ avg: string | null }>(
      `
      SELECT AVG(cr.star_rating)::numeric(4,2) AS avg
      FROM customer_reviews cr
      WHERE cr.organization_id = $1
        AND cr.submitted_at::date = $2::date
        AND cr.submitted_at IS NOT NULL
      `,
      [organizationId, metricDate],
    );

    await client.query(
      `
      INSERT INTO analytics_business_daily (organization_id, metric_date, jobs_total, avg_star_rating)
      VALUES ($1, $2::date, 0, $3)
      ON CONFLICT (organization_id, metric_date)
      DO UPDATE SET
        avg_star_rating = EXCLUDED.avg_star_rating,
        updated_at = NOW()
      `,
      [organizationId, metricDate, orgAvg.rows[0]?.avg ?? null],
    );

    if (facts.technician_id) {
      const techAvg = await client.query<{ avg: string | null }>(
        `
        SELECT AVG(cr.star_rating)::numeric(4,2) AS avg
        FROM customer_reviews cr
        INNER JOIN jobs j
          ON j.id = cr.job_id
         AND j.organization_id = cr.organization_id
        WHERE cr.organization_id = $1
          AND cr.submitted_at::date = $2::date
          AND cr.submitted_at IS NOT NULL
          AND j.technician_id = $3
        `,
        [organizationId, metricDate, facts.technician_id],
      );

      await client.query(
        `
        INSERT INTO analytics_technician_daily (
          organization_id,
          metric_date,
          technician_id,
          jobs_assigned,
          avg_star_rating
        )
        VALUES ($1, $2::date, $3, 0, $4)
        ON CONFLICT (organization_id, metric_date, technician_id)
        DO UPDATE SET
          avg_star_rating = EXCLUDED.avg_star_rating,
          updated_at = NOW()
        `,
        [organizationId, metricDate, facts.technician_id, techAvg.rows[0]?.avg ?? null],
      );
    }

    const brandAvg = await client.query<{ avg: string | null }>(
      `
      SELECT AVG(cr.star_rating)::numeric(4,2) AS avg
      FROM customer_reviews cr
      INNER JOIN jobs j
        ON j.id = cr.job_id
       AND j.organization_id = cr.organization_id
      WHERE cr.organization_id = $1
        AND cr.submitted_at::date = $2::date
        AND cr.submitted_at IS NOT NULL
        AND j.brand_id = $3
      `,
      [organizationId, metricDate, facts.brand_id],
    );

    await client.query(
      `
      INSERT INTO analytics_brand_daily (organization_id, metric_date, brand_id, jobs_total, avg_star_rating)
      VALUES ($1, $2::date, $3, 0, $4)
      ON CONFLICT (organization_id, metric_date, brand_id)
      DO UPDATE SET
        avg_star_rating = EXCLUDED.avg_star_rating,
        updated_at = NOW()
      `,
      [organizationId, metricDate, facts.brand_id, brandAvg.rows[0]?.avg ?? null],
    );
  }

  private async applyStatusTransition(
    client: PoolClient,
    organizationId: string,
    metricDate: string,
    status: string,
    facts: JobFactsRow,
  ): Promise<void> {
    const isResolved = status === 'resolved' || status === 'resolved_on_revisit';
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';

    await client.query(
      `
      INSERT INTO analytics_business_daily (
        organization_id, metric_date, jobs_total, jobs_completed, jobs_resolved, jobs_cancelled
      )
      VALUES (
        $1, $2::date, 0, $3, $4, $5
      )
      ON CONFLICT (organization_id, metric_date)
      DO UPDATE SET
        jobs_completed = analytics_business_daily.jobs_completed + EXCLUDED.jobs_completed,
        jobs_resolved = analytics_business_daily.jobs_resolved + EXCLUDED.jobs_resolved,
        jobs_cancelled = analytics_business_daily.jobs_cancelled + EXCLUDED.jobs_cancelled,
        updated_at = NOW()
      `,
      [organizationId, metricDate, isCompleted ? 1 : 0, isResolved ? 1 : 0, isCancelled ? 1 : 0],
    );

    await client.query(
      `
      INSERT INTO analytics_brand_daily (
        organization_id, metric_date, brand_id, jobs_total, jobs_completed, jobs_resolved, jobs_cancelled
      )
      VALUES ($1, $2::date, $3, 0, $4, $5, $6)
      ON CONFLICT (organization_id, metric_date, brand_id)
      DO UPDATE SET
        jobs_completed = analytics_brand_daily.jobs_completed + EXCLUDED.jobs_completed,
        jobs_resolved = analytics_brand_daily.jobs_resolved + EXCLUDED.jobs_resolved,
        jobs_cancelled = analytics_brand_daily.jobs_cancelled + EXCLUDED.jobs_cancelled,
        updated_at = NOW()
      `,
      [organizationId, metricDate, facts.brand_id, isCompleted ? 1 : 0, isResolved ? 1 : 0, isCancelled ? 1 : 0],
    );

    if (facts.dealer_id) {
      await client.query(
        `
        INSERT INTO analytics_dealer_daily (
          organization_id, metric_date, dealer_id, jobs_submitted, complaints_submitted,
          installations_submitted, jobs_cancelled, resolved_count
        )
        VALUES ($1, $2::date, $3, 0, 0, 0, $4, $5)
        ON CONFLICT (organization_id, metric_date, dealer_id)
        DO UPDATE SET
          jobs_cancelled = analytics_dealer_daily.jobs_cancelled + EXCLUDED.jobs_cancelled,
          resolved_count = analytics_dealer_daily.resolved_count + EXCLUDED.resolved_count,
          updated_at = NOW()
        `,
        [organizationId, metricDate, facts.dealer_id, isCancelled ? 1 : 0, isResolved ? 1 : 0],
      );
    }

    if (facts.technician_id && (isResolved || isCompleted)) {
      await client.query(
        `
        INSERT INTO analytics_technician_daily (
          organization_id, metric_date, technician_id, jobs_assigned, jobs_completed, jobs_resolved
        )
        VALUES ($1, $2::date, $3, 0, $4, $5)
        ON CONFLICT (organization_id, metric_date, technician_id)
        DO UPDATE SET
          jobs_completed = analytics_technician_daily.jobs_completed + EXCLUDED.jobs_completed,
          jobs_resolved = analytics_technician_daily.jobs_resolved + EXCLUDED.jobs_resolved,
          updated_at = NOW()
        `,
        [organizationId, metricDate, facts.technician_id, isCompleted ? 1 : 0, isResolved ? 1 : 0],
      );
    }
  }

  private async applyPaymentRecorded(
    client: PoolClient,
    organizationId: string,
    metricDate: string,
    amount: number,
    facts: JobFactsRow,
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO analytics_business_daily (organization_id, metric_date, jobs_total, revenue_amount)
      VALUES ($1, $2::date, 0, $3)
      ON CONFLICT (organization_id, metric_date)
      DO UPDATE SET
        revenue_amount = analytics_business_daily.revenue_amount + EXCLUDED.revenue_amount,
        updated_at = NOW()
      `,
      [organizationId, metricDate, amount],
    );

    await client.query(
      `
      INSERT INTO analytics_brand_daily (organization_id, metric_date, brand_id, jobs_total, revenue_amount)
      VALUES ($1, $2::date, $3, 0, $4)
      ON CONFLICT (organization_id, metric_date, brand_id)
      DO UPDATE SET
        revenue_amount = analytics_brand_daily.revenue_amount + EXCLUDED.revenue_amount,
        updated_at = NOW()
      `,
      [organizationId, metricDate, facts.brand_id, amount],
    );

    if (facts.technician_id) {
      await client.query(
        `
        INSERT INTO analytics_technician_daily (
          organization_id, metric_date, technician_id, jobs_assigned, total_payment_collected
        )
        VALUES ($1, $2::date, $3, 0, $4)
        ON CONFLICT (organization_id, metric_date, technician_id)
        DO UPDATE SET
          total_payment_collected = analytics_technician_daily.total_payment_collected + EXCLUDED.total_payment_collected,
          updated_at = NOW()
        `,
        [organizationId, metricDate, facts.technician_id, amount],
      );
    }
  }
}
