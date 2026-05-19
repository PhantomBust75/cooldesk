import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';

const dbUrl = process.env.NOTIFICATIONS_DB_TEST_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb('Notifications DB integration', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    await client.connect();

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TEMP TABLE notifications_it (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        event_type TEXT NOT NULL,
        job_id UUID,
        recipient_user_id UUID,
        recipient_dealer_id UUID,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT chk_recipient_it
          CHECK (recipient_user_id IS NOT NULL OR recipient_dealer_id IS NOT NULL),
        CONSTRAINT chk_read_meta_it
          CHECK (is_read = FALSE OR read_at IS NOT NULL),
        CONSTRAINT chk_single_recipient_channel_it
          CHECK (
            (recipient_user_id IS NOT NULL AND recipient_dealer_id IS NULL)
            OR (recipient_user_id IS NULL AND recipient_dealer_id IS NOT NULL)
          )
      ) ON COMMIT PRESERVE ROWS;

      CREATE UNIQUE INDEX idx_notif_dedup_user_job_it
        ON notifications_it (organization_id, event_type, job_id, recipient_user_id)
        WHERE recipient_user_id IS NOT NULL AND job_id IS NOT NULL;

      CREATE UNIQUE INDEX idx_notif_dedup_user_nojob_it
        ON notifications_it (organization_id, event_type, recipient_user_id)
        WHERE recipient_user_id IS NOT NULL AND job_id IS NULL;
    `);
  });

  afterAll(async () => {
    await client.end();
  });

  it('rejects is_read=true when read_at is null', async () => {
    await expect(
      client.query(`
        INSERT INTO notifications_it (organization_id, event_type, recipient_user_id, is_read, read_at)
        VALUES (gen_random_uuid(), 'job_assigned', gen_random_uuid(), TRUE, NULL)
      `),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('deduplicates job-scoped user notifications with ON CONFLICT DO NOTHING', async () => {
    const orgId = '11111111-1111-1111-1111-111111111111';
    const jobId = '22222222-2222-2222-2222-222222222222';
    const userId = '33333333-3333-3333-3333-333333333333';

    await client.query(
      `
      INSERT INTO notifications_it (organization_id, event_type, job_id, recipient_user_id)
      VALUES ($1, 'job_assigned', $2, $3)
      `,
      [orgId, jobId, userId],
    );

    const retry = await client.query(
      `
      INSERT INTO notifications_it (organization_id, event_type, job_id, recipient_user_id)
      VALUES ($1, 'job_assigned', $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [orgId, jobId, userId],
    );

    expect(retry.rowCount).toBe(0);
  });

  it('deduplicates non-job frequent notifications with ON CONFLICT DO NOTHING', async () => {
    const orgId = '44444444-4444-4444-4444-444444444444';
    const userId = '55555555-5555-5555-5555-555555555555';

    await client.query(
      `
      INSERT INTO notifications_it (organization_id, event_type, recipient_user_id)
      VALUES ($1, 'frequent_complaint_detected', $2)
      `,
      [orgId, userId],
    );

    const retry = await client.query(
      `
      INSERT INTO notifications_it (organization_id, event_type, recipient_user_id)
      VALUES ($1, 'frequent_complaint_detected', $2)
      ON CONFLICT DO NOTHING
      `,
      [orgId, userId],
    );

    expect(retry.rowCount).toBe(0);
  });
});
