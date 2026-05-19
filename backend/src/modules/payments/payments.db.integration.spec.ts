import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';

const dbUrl = process.env.PAYMENTS_DB_TEST_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb('Payments DB integration (trigger + constraints)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    await client.connect();

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_it') THEN
          CREATE TYPE payment_status_it AS ENUM ('pending', 'collected', 'refunded', 'disputed');
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TEMP TABLE payments_it (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status payment_status_it NOT NULL DEFAULT 'pending',
        collected_at TIMESTAMPTZ,
        voided_at TIMESTAMPTZ,
        CHECK (
          (
            status = 'refunded'
            AND collected_at IS NOT NULL
          )
          OR (
            status = 'collected'
            AND collected_at IS NOT NULL
          )
          OR (
            status = 'disputed'
          )
          OR (
            status = 'pending'
            AND voided_at IS NOT NULL
          )
          OR (
            status = 'pending'
            AND voided_at IS NULL
            AND collected_at IS NULL
          )
        )
      ) ON COMMIT PRESERVE ROWS;

      ALTER TABLE payments_it
      DROP CONSTRAINT IF EXISTS chk_collected_meta;
      ALTER TABLE payments_it
      ADD CONSTRAINT chk_collected_meta
      CHECK (
        (
          status = 'refunded'
          AND collected_at IS NOT NULL
        )
        OR (
          status = 'collected'
          AND collected_at IS NOT NULL
        )
        OR (
          status = 'disputed'
        )
        OR (
          status = 'pending'
          AND voided_at IS NOT NULL
        )
        OR (
          status = 'pending'
          AND voided_at IS NULL
          AND collected_at IS NULL
        )
      );

      CREATE OR REPLACE FUNCTION set_collected_at_fn_it()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.status = 'collected'
           AND (TG_OP = 'INSERT' OR OLD.status <> 'collected')
        THEN
          NEW.collected_at := COALESCE(NEW.collected_at, NOW());
        END IF;

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_set_collected_at ON payments_it;

      CREATE TRIGGER trg_set_collected_at
      BEFORE INSERT OR UPDATE OF status
      ON payments_it
      FOR EACH ROW
      EXECUTE FUNCTION set_collected_at_fn_it();
    `);
  });

  afterAll(async () => {
    await client.end();
  });

  it('trg_set_collected_at sets collected_at on collected insert', async () => {
    const insert = await client.query<{ collected_at: string | null }>(
      `
      INSERT INTO payments_it (status, collected_at)
      VALUES ('collected', NULL)
      RETURNING collected_at
      `,
    );

    expect(insert.rows[0].collected_at).not.toBeNull();
  });

  it('chk_collected_meta rejects refunded with NULL collected_at on insert', async () => {
    await expect(
      client.query(`INSERT INTO payments_it (status, collected_at) VALUES ('refunded', NULL)`),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('chk_collected_meta rejects transition to refunded when collected_at is null', async () => {
    const base = await client.query<{ id: string }>(
      `
      INSERT INTO payments_it (status, collected_at)
      VALUES ('pending', NULL)
      RETURNING id
      `,
    );

    await expect(
      client.query(`UPDATE payments_it SET status = 'refunded' WHERE id = $1`, [base.rows[0].id]),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
