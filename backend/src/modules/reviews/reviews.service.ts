import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../shared/database.service';
import { RequestContext } from '../security/request-context';
import { SubmitReviewDto } from './reviews.dto';

type ReviewRow = {
  id: string;
  job_id: string;
  organization_id: string;
  review_token: string;
  expires_at: string;
  submitted_at: string | null;
};

@Injectable()
export class ReviewsService {
  constructor(private readonly db: DatabaseService) {}

  async generateReviewLink(jobId: string, ctx: RequestContext): Promise<{ ok: true; token: string; url: string; expiresAt: string }> {
    return this.db.withTransaction(async (client) => {
      const job = await client.query<{ id: string; organization_id: string; status: string }>(
        `
        SELECT id, organization_id, status
        FROM jobs
        WHERE id = $1
          AND organization_id = $2
          AND is_deleted = FALSE
        LIMIT 1
        `,
        [jobId, ctx.organizationId],
      );

      if (job.rows.length === 0) {
        throw new NotFoundException('Job not found');
      }

      const existing = await client.query<ReviewRow>(
        `
        SELECT id, job_id, organization_id, review_token, expires_at, submitted_at
        FROM customer_reviews
        WHERE job_id = $1
          AND organization_id = $2
        LIMIT 1
        FOR UPDATE
        `,
        [jobId, ctx.organizationId],
      );

      let row: ReviewRow;
      if (existing.rows.length === 0) {
        const inserted = await client.query<ReviewRow>(
          `
          INSERT INTO customer_reviews (
            job_id,
            organization_id,
            link_generated_at,
            updated_at
          )
          VALUES ($1, $2, NOW(), NOW())
          RETURNING id, job_id, organization_id, review_token, expires_at, submitted_at
          `,
          [jobId, ctx.organizationId],
        );
        row = inserted.rows[0];
      } else {
        if (existing.rows[0].submitted_at) {
          throw new ConflictException('Review already submitted for this job');
        }

        const regenerated = await client.query<ReviewRow>(
          `
          UPDATE customer_reviews
          SET review_token = gen_random_uuid(),
              link_generated_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
            AND organization_id = $2
          RETURNING id, job_id, organization_id, review_token, expires_at, submitted_at
          `,
          [existing.rows[0].id, ctx.organizationId],
        );
        row = regenerated.rows[0];
      }

      return {
        ok: true,
        token: row.review_token,
        url: `https://cooldesk.app/review/${row.review_token}`,
        expiresAt: row.expires_at,
      };
    });
  }

  async submitByToken(
    token: string,
    input: SubmitReviewDto,
  ): Promise<{ ok: true; jobId: string; organizationId: string; isLowRated: boolean }> {
    return this.db.withTransaction(async (client) => {
      const review = await client.query<ReviewRow>(
        `
        SELECT id, job_id, organization_id, review_token, expires_at, submitted_at
        FROM customer_reviews
        WHERE review_token = $1
        LIMIT 1
        FOR UPDATE
        `,
        [token],
      );

      if (review.rows.length === 0) {
        throw new NotFoundException('Review token not found');
      }

      if (review.rows[0].submitted_at) {
        throw new ConflictException('Review already submitted');
      }

      const updated = await client.query<{
        job_id: string;
        organization_id: string;
        is_low_rated: boolean;
      }>(
        `
        UPDATE customer_reviews
        SET star_rating = $2,
            comment = $3,
            submitted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND submitted_at IS NULL
          AND expires_at > NOW()
        RETURNING job_id, organization_id, is_low_rated
        `,
        [review.rows[0].id, input.rating, input.comment?.trim() ?? null],
      );

      if (updated.rows.length === 0) {
        throw new GoneException('Review token has expired');
      }

      const resolved = updated.rows[0];

      await this.insertTimelineSystemEvent(
        client,
        resolved.job_id,
        resolved.organization_id,
        'review_submitted',
        {
          starRating: input.rating,
          isLowRated: resolved.is_low_rated,
        },
      );

      if (resolved.is_low_rated) {
        await this.notifyOwnerOfficeUsers(
          client,
          resolved.organization_id,
          'low_rating_received',
          resolved.job_id,
        );
      }

      return {
        ok: true,
        jobId: resolved.job_id,
        organizationId: resolved.organization_id,
        isLowRated: resolved.is_low_rated,
      };
    });
  }

  async listSubmitted(
    ctx: RequestContext,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT
        id,
        job_id,
        organization_id,
        star_rating,
        COALESCE(comment, review_text) AS comment,
        submitted_at,
        is_low_rated,
        created_at,
        updated_at
      FROM customer_reviews
      WHERE organization_id = $1
        AND submitted_at IS NOT NULL
      ORDER BY submitted_at DESC
      LIMIT $2
      `,
      [ctx.organizationId, Math.min(limit, 200)],
    );

    return result.rows as Record<string, unknown>[];
  }

  async listLowRated(
    ctx: RequestContext,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `
      SELECT
        id,
        job_id,
        organization_id,
        star_rating,
        COALESCE(comment, review_text) AS comment,
        submitted_at,
        is_low_rated,
        created_at,
        updated_at
      FROM customer_reviews
      WHERE organization_id = $1
        AND submitted_at IS NOT NULL
        AND is_low_rated = TRUE
      ORDER BY submitted_at DESC
      LIMIT $2
      `,
      [ctx.organizationId, Math.min(limit, 200)],
    );

    return result.rows as Record<string, unknown>[];
  }

  private async insertTimelineSystemEvent(
    client: PoolClient,
    jobId: string,
    organizationId: string,
    eventType: string,
    newValue: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO job_timeline (
        organization_id,
        job_id,
        event_type,
        actor_user_id,
        actor_dealer_id,
        previous_value,
        new_value,
        reason,
        occurred_at
      )
      VALUES ($1, $2, $3, NULL, NULL, NULL, $4::jsonb, NULL, NOW())
      `,
      [organizationId, jobId, eventType, JSON.stringify(newValue)],
    );
  }

  async getByToken(token: string): Promise<{
    token: string;
    job_id: string;
    expires_at: string;
    is_submitted: boolean;
  }> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      throw new NotFoundException('Review token not found');
    }

    const result = await this.db.query<{
      review_token: string;
      job_id: string;
      expires_at: string;
      submitted_at: string | null;
    }>(
      `
      SELECT review_token, job_id, expires_at, submitted_at
      FROM customer_reviews
      WHERE review_token = $1::uuid
      LIMIT 1
      `,
      [token],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Review token not found');
    }

    const row = result.rows[0];
    return {
      token: row.review_token,
      job_id: row.job_id,
      expires_at: row.expires_at,
      is_submitted: row.submitted_at !== null,
    };
  }

  private async notifyOwnerOfficeUsers(
    client: PoolClient,
    organizationId: string,
    eventType: string,
    jobId: string,
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
      await client.query(
        `
        INSERT INTO notifications (organization_id, event_type, job_id, recipient_user_id, payload)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT DO NOTHING
        `,
        [
          organizationId,
          eventType,
          jobId,
          recipient.id,
          JSON.stringify({ jobId }),
        ],
      );
    }
  }
}
