import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { TenantConfigService } from '../settings/tenant-config.service';
import { OwnerDashboardQueryDto } from './dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async getOwnerDashboard(
    query: OwnerDashboardQueryDto,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>> {
    const limit = query.limit ?? 30;

    const businessParams: unknown[] = [ctx.organizationId];
    const businessFilters = ['organization_id = $1'];
    if (query.metricDate) {
      businessParams.push(query.metricDate);
      businessFilters.push(`metric_date = $${businessParams.length}::date`);
    }

    const businessMetrics = await this.db.query(
      `
      SELECT metric_date, jobs_total, jobs_completed, jobs_resolved, jobs_cancelled,
             repeat_complaints, frequent_complaints, revenue_amount
      FROM analytics_business_daily
      WHERE ${businessFilters.join(' AND ')}
      ORDER BY metric_date DESC
      LIMIT ${limit}
      `,
      businessParams,
    );

    const technicianParams: unknown[] = [ctx.organizationId];
    const technicianFilters = ['atd.organization_id = $1'];
    if (query.metricDate) {
      technicianParams.push(query.metricDate);
      technicianFilters.push(`atd.metric_date = $${technicianParams.length}::date`);
    }

    const technicianScorecards = await this.db.query(
      `
      SELECT atd.metric_date, atd.technician_id, atd.jobs_assigned, atd.jobs_completed,
             atd.jobs_resolved, atd.no_show_count, atd.on_time_count, atd.late_count,
             atd.avg_star_rating, u.full_name
      FROM analytics_technician_daily atd
      LEFT JOIN users u
        ON u.id = atd.technician_id
       AND u.organization_id = atd.organization_id
      WHERE ${technicianFilters.join(' AND ')}
      ORDER BY atd.metric_date DESC, u.full_name ASC NULLS LAST
      LIMIT ${limit}
      `,
      technicianParams,
    );

    const brandParams: unknown[] = [ctx.organizationId];
    const brandFilters = ['abd.organization_id = $1'];
    if (query.metricDate) {
      brandParams.push(query.metricDate);
      brandFilters.push(`abd.metric_date = $${brandParams.length}::date`);
    }
    if (query.brandId) {
      brandParams.push(query.brandId);
      brandFilters.push(`abd.brand_id = $${brandParams.length}`);
    }

    const brandPerformance = await this.db.query(
      `
      SELECT abd.metric_date, abd.brand_id, abd.jobs_total, abd.jobs_completed,
             abd.jobs_resolved, abd.jobs_cancelled, abd.repeat_complaints,
             abd.frequent_complaints, abd.revenue_amount, b.name AS brand_name
      FROM analytics_brand_daily abd
      LEFT JOIN brands b
        ON b.id = abd.brand_id
       AND b.organization_id = abd.organization_id
      WHERE ${brandFilters.join(' AND ')}
      ORDER BY abd.metric_date DESC, b.name ASC NULLS LAST
      LIMIT ${limit}
      `,
      brandParams,
    );

    const revisitPending = await this.db.query(
      `
      SELECT id, status, customer_name, brand_id, scheduled_at, updated_at, is_chronic
      FROM jobs
      WHERE organization_id = $1
        AND status = 'needs_revisit'
        AND is_deleted = FALSE
      ORDER BY updated_at DESC
      LIMIT $2
      `,
      [ctx.organizationId, limit],
    );

    const chronicJobs = await this.db.query(
      `
      SELECT id, status, customer_name, brand_id, updated_at
      FROM jobs
      WHERE organization_id = $1
        AND is_chronic = TRUE
        AND is_deleted = FALSE
      ORDER BY updated_at DESC
      LIMIT $2
      `,
      [ctx.organizationId, limit],
    );

    const lowRatedReviews = await this.db.query(
      `
      SELECT id, job_id, technician_id, star_rating, review_text, created_at
      FROM customer_reviews
      WHERE organization_id = $1
        AND is_low_rated = TRUE
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [ctx.organizationId, limit],
    );

    return {
      businessMetrics: businessMetrics.rows,
      technicianScorecards: technicianScorecards.rows,
      brandPerformance: brandPerformance.rows,
      revisitPendingCards: revisitPending.rows,
      chronicJobCards: chronicJobs.rows,
      lowRatedReviews: lowRatedReviews.rows,
    };
  }

  async getDashboardMetrics(ctx: RequestContext): Promise<Record<string, unknown>> {
    const orgId = ctx.organizationId;

    // Amber alert threshold: default 3 days
    let amberDays = 3;
    try {
      amberDays = await this.tenantConfig.getInt(orgId, 'amber_alert_days', 3);
    } catch { /* use default */ }

    let noShowHours = 2;
    try {
      noShowHours = await this.tenantConfig.getInt(orgId, 'no_show_hours', 2);
    } catch { /* use default */ }

    let frequentThreshold = 3;
    try {
      frequentThreshold = await this.tenantConfig.getInt(orgId, 'frequent_complaint_threshold', 3);
    } catch { /* use default */ }

    let frequentWindowDays = 90;
    try {
      frequentWindowDays = await this.tenantConfig.getInt(orgId, 'frequent_complaint_window_days', 90);
    } catch { /* use default */ }

    // Active statuses: exclude terminal statuses (matches existing jobs.service.ts pattern)
    const INACTIVE_STATUSES = `('cancelled', 'completed', 'resolved', 'resolved_on_revisit')`;

    // totalActiveJobs
    const activeResult = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM jobs WHERE organization_id = $1 AND status NOT IN ${INACTIVE_STATUSES} AND is_deleted = false`,
      [orgId],
    );
    const totalActiveJobs: number = activeResult.rows[0]?.count ?? 0;

    // pendingSchedule: jobs with no scheduled_at and still active
    const pendingResult = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM jobs WHERE organization_id = $1 AND scheduled_at IS NULL AND status NOT IN ${INACTIVE_STATUSES} AND is_deleted = false`,
      [orgId],
    );
    const pendingSchedule: number = pendingResult.rows[0]?.count ?? 0;

    // amberAlerts: active jobs waiting > amberDays since creation
    const amberResult = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM jobs WHERE organization_id = $1 AND status NOT IN ${INACTIVE_STATUSES} AND is_deleted = false AND created_at < NOW() - ($2 || ' days')::interval`,
      [orgId, String(amberDays)],
    );
    const amberAlerts: number = amberResult.rows[0]?.count ?? 0;

    // chronicJobs: customers with >= frequentThreshold complaint jobs in frequentWindowDays
    const chronicResult = await this.db.query(
      `SELECT COUNT(*)::bigint AS count FROM (
        SELECT customer_name FROM jobs
        WHERE organization_id = $1 AND type = 'complaint' AND is_deleted = false
          AND created_at > NOW() - ($2 || ' days')::interval
        GROUP BY customer_name
        HAVING COUNT(*) >= $3
      ) chronic`,
      [orgId, String(frequentWindowDays), String(frequentThreshold)],
    );
    const chronicJobs: number = Number(chronicResult.rows[0]?.count ?? 0);

    // noShowsToday: scheduled today, no actual_arrival, scheduled_at is noShowHours ago
    const noShowResult = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM jobs
       WHERE organization_id = $1 AND is_deleted = false
         AND DATE(scheduled_at AT TIME ZONE 'UTC') = CURRENT_DATE
         AND actual_arrival IS NULL
         AND scheduled_at < NOW() - ($2 || ' hours')::interval
         AND status NOT IN ${INACTIVE_STATUSES}`,
      [orgId, String(noShowHours)],
    );
    const noShowsToday: number = noShowResult.rows[0]?.count ?? 0;

    // 7-day trends: jobs created per day for last 7 days
    const trendResult = await this.db.query(
      `SELECT DATE(created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS total
       FROM jobs
       WHERE organization_id = $1 AND is_deleted = false
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY day ORDER BY day ASC`,
      [orgId],
    );

    // 7-day trends: unscheduled active jobs created per day for last 7 days
    const pendingTrendResult = await this.db.query(
      `SELECT DATE(created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS total
       FROM jobs
       WHERE organization_id = $1
         AND is_deleted = false
         AND scheduled_at IS NULL
         AND status NOT IN ${INACTIVE_STATUSES}
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY day ORDER BY day ASC`,
      [orgId],
    );

    // Build 7-entry arrays aligned to last 7 days
    const days7: number[] = [];
    const pendingDays7: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = trendResult.rows.find((r: Record<string, unknown>) => {
        const day = r.day as Date;
        return day instanceof Date ? day.toISOString().slice(0, 10) === key : String(r.day).slice(0, 10) === key;
      });
      days7.push(row ? (row.total as number) : 0);

      const pendingRow = pendingTrendResult.rows.find((r: Record<string, unknown>) => {
        const day = r.day as Date;
        return day instanceof Date ? day.toISOString().slice(0, 10) === key : String(r.day).slice(0, 10) === key;
      });
      pendingDays7.push(pendingRow ? (pendingRow.total as number) : 0);
    }

    return {
      totalActiveJobs,
      pendingSchedule,
      amberAlerts,
      chronicJobs,
      noShowsToday,
      trends: {
        totalActiveJobs: days7,
        pendingSchedule: pendingDays7,
      },
    };
  }
}
