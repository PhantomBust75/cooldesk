import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { OwnerDashboardQueryDto } from './dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

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
}
