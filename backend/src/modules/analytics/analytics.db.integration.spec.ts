import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';

const dbUrl = process.env.ANALYTICS_DB_TEST_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb('Analytics DB integration', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    await client.connect();

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TEMP TABLE users_it (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        role TEXT NOT NULL,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      ) ON COMMIT PRESERVE ROWS;

      CREATE TEMP TABLE job_timeline_it (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      ) ON COMMIT PRESERVE ROWS;

      CREATE TEMP TABLE analytics_technician_daily_it (
        organization_id UUID NOT NULL,
        metric_date DATE NOT NULL,
        technician_id UUID NOT NULL,
        jobs_assigned INT NOT NULL DEFAULT 0,
        PRIMARY KEY (organization_id, metric_date, technician_id)
      ) ON COMMIT PRESERVE ROWS;

      CREATE OR REPLACE FUNCTION fn_validate_technician_role_it()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM users_it u
          WHERE u.id = NEW.technician_id
            AND u.organization_id = NEW.organization_id
            AND u.role = 'technician'
            AND u.is_deleted = FALSE
        ) THEN
          RAISE EXCEPTION 'analytics_technician_daily.technician_id must reference a technician in same org';
        END IF;

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_validate_technician_role ON analytics_technician_daily_it;
      CREATE TRIGGER trg_validate_technician_role
      BEFORE INSERT OR UPDATE ON analytics_technician_daily_it
      FOR EACH ROW
      EXECUTE FUNCTION fn_validate_technician_role_it();

      CREATE TEMP TABLE analytics_processed_events_it (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        timeline_event_id UUID NOT NULL UNIQUE REFERENCES job_timeline_it(id) ON DELETE RESTRICT,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      ) ON COMMIT PRESERVE ROWS;

      CREATE OR REPLACE FUNCTION fn_purge_analytics_processed_events_it()
      RETURNS INT
      LANGUAGE plpgsql
      AS $$
      DECLARE deleted_count INT;
      BEGIN
        DELETE FROM analytics_processed_events_it
        WHERE processed_at < NOW() - INTERVAL '90 days';
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $$;
    `);
  });

  afterAll(async () => {
    await client.end();
  });

  it('rejects non-technician inserts through technician-role trigger', async () => {
    const orgId = '00000000-0000-0000-0000-000000000001';
    const userId = '00000000-0000-0000-0000-000000000002';

    await client.query(
      `INSERT INTO users_it (id, organization_id, role) VALUES ($1, $2, 'office_staff')`,
      [userId, orgId],
    );

    await expect(
      client.query(
        `
        INSERT INTO analytics_technician_daily_it (organization_id, metric_date, technician_id, jobs_assigned)
        VALUES ($1, CURRENT_DATE, $2, 1)
        `,
        [orgId, userId],
      ),
    ).rejects.toBeTruthy();
  });

  it('blocks deleting timeline event when processed-event exists (RESTRICT)', async () => {
    const orgId = '00000000-0000-0000-0000-000000000010';
    const timeline = await client.query<{ id: string }>(
      `INSERT INTO job_timeline_it DEFAULT VALUES RETURNING id`,
    );

    await client.query(
      `
      INSERT INTO analytics_processed_events_it (organization_id, timeline_event_id)
      VALUES ($1, $2)
      `,
      [orgId, timeline.rows[0].id],
    );

    await expect(
      client.query(`DELETE FROM job_timeline_it WHERE id = $1`, [timeline.rows[0].id]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('purges only processed events older than 90 days', async () => {
    const orgId = '00000000-0000-0000-0000-000000000020';
    const oldTimeline = await client.query<{ id: string }>(`INSERT INTO job_timeline_it DEFAULT VALUES RETURNING id`);
    const newTimeline = await client.query<{ id: string }>(`INSERT INTO job_timeline_it DEFAULT VALUES RETURNING id`);

    await client.query(
      `
      INSERT INTO analytics_processed_events_it (organization_id, timeline_event_id, processed_at)
      VALUES ($1, $2, NOW() - INTERVAL '95 days')
      `,
      [orgId, oldTimeline.rows[0].id],
    );

    await client.query(
      `
      INSERT INTO analytics_processed_events_it (organization_id, timeline_event_id, processed_at)
      VALUES ($1, $2, NOW() - INTERVAL '2 days')
      `,
      [orgId, newTimeline.rows[0].id],
    );

    const purge = await client.query<{ deleted: number }>(
      `SELECT fn_purge_analytics_processed_events_it() AS deleted`,
    );
    expect(Number(purge.rows[0].deleted)).toBe(1);

    const remaining = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM analytics_processed_events_it`,
    );
    expect(Number(remaining.rows[0].count)).toBe(1);
  });
});
