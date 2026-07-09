import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';

const dbUrl = process.env.REVIEWS_DB_TEST_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb('Reviews DB integration', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    await client.connect();

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE OR REPLACE FUNCTION immutable_add_48h(ts TIMESTAMPTZ)
      RETURNS TIMESTAMPTZ LANGUAGE SQL IMMUTABLE
      AS $$ SELECT ts + INTERVAL '48 hours' $$;

      CREATE TEMP TABLE customer_reviews_it (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL UNIQUE,
        organization_id UUID NOT NULL,
        review_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        star_rating INT CHECK (star_rating BETWEEN 1 AND 5),
        comment TEXT,
        submitted_at TIMESTAMPTZ,
        link_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ GENERATED ALWAYS AS
          (immutable_add_48h(link_generated_at)) STORED,
        is_low_rated BOOLEAN GENERATED ALWAYS AS (
          CASE
            WHEN star_rating IS NOT NULL THEN star_rating <= 2
            ELSE NULL
          END
        ) STORED,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      ) ON COMMIT PRESERVE ROWS;
    `);
  });

  afterAll(async () => {
    await client.end();
  });

  it('keeps is_low_rated NULL before submission', async () => {
    await client.query(
      `
      INSERT INTO customer_reviews_it (job_id, organization_id)
      VALUES ($1, $2)
      `,
      ['00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'],
    );

    const res = await client.query<{ is_low_rated: boolean | null }>(
      `
      SELECT is_low_rated
      FROM customer_reviews_it
      WHERE job_id = $1
      `,
      ['00000000-0000-0000-0000-000000000001'],
    );

    expect(res.rows[0].is_low_rated).toBeNull();
  });

  it('computes is_low_rated TRUE for ratings <= 2 and FALSE for >= 3', async () => {
    await client.query(
      `
      INSERT INTO customer_reviews_it (job_id, organization_id, star_rating, submitted_at)
      VALUES ($1, $2, 2, NOW()), ($3, $4, 4, NOW())
      `,
      [
        '00000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
      ],
    );

    const res = await client.query<{ job_id: string; is_low_rated: boolean | null }>(
      `
      SELECT job_id, is_low_rated
      FROM customer_reviews_it
      WHERE job_id IN ($1, $2)
      ORDER BY job_id ASC
      `,
      [
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
      ],
    );

    expect(res.rows[0].is_low_rated).toBe(true);
    expect(res.rows[1].is_low_rated).toBe(false);
  });

  it('blocks second submission via submitted_at IS NULL guard', async () => {
    const token = '20000000-0000-0000-0000-000000000001';

    await client.query(
      `
      INSERT INTO customer_reviews_it (job_id, organization_id, review_token)
      VALUES ($1, $2, $3)
      `,
      ['00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', token],
    );

    const first = await client.query(
      `
      UPDATE customer_reviews_it
      SET star_rating = 5,
          comment = 'great',
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE review_token = $1
        AND submitted_at IS NULL
        AND expires_at > NOW()
      `,
      [token],
    );
    expect(first.rowCount).toBe(1);

    const second = await client.query(
      `
      UPDATE customer_reviews_it
      SET star_rating = 1,
          comment = 'retry',
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE review_token = $1
        AND submitted_at IS NULL
        AND expires_at > NOW()
      `,
      [token],
    );
    expect(second.rowCount).toBe(0);
  });

  it('treats expired token as non-updatable with expires_at guard', async () => {
    const token = '20000000-0000-0000-0000-000000000002';

    await client.query(
      `
      INSERT INTO customer_reviews_it (job_id, organization_id, review_token, link_generated_at)
      VALUES ($1, $2, $3, NOW() - INTERVAL '72 hours')
      `,
      ['00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', token],
    );

    const update = await client.query(
      `
      UPDATE customer_reviews_it
      SET star_rating = 2,
          comment = 'late',
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE review_token = $1
        AND submitted_at IS NULL
        AND expires_at > NOW()
      `,
      [token],
    );

    expect(update.rowCount).toBe(0);
  });
});
