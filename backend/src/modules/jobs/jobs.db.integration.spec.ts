import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';

const dbUrl = process.env.JOBS_DB_TEST_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb('Jobs DB integration (office tenant scoping)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    await client.connect();

    await client.query(`
      CREATE TEMP TABLE brands_it (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      ) ON COMMIT PRESERVE ROWS;

      CREATE TEMP TABLE users_it (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        role TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      ) ON COMMIT PRESERVE ROWS;

      CREATE TEMP TABLE jobs_it (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        technician_id UUID,
        scheduled_at TIMESTAMPTZ,
        version INT NOT NULL DEFAULT 0,
        visit_outcome TEXT,
        is_chronic BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        customer_name TEXT,
        phone TEXT,
        address TEXT
      ) ON COMMIT PRESERVE ROWS;

      CREATE TEMP TABLE revisits_it (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        job_id UUID NOT NULL,
        sequence_number INT NOT NULL,
        reason TEXT,
        custom_reason TEXT,
        scheduled_at TIMESTAMPTZ,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      ) ON COMMIT PRESERVE ROWS;
    `);
  });

  afterAll(async () => {
    await client.end();
  });

  it('quick-entry brand validation query rejects cross-org brand', async () => {
    const orgA = '00000000-0000-0000-0000-000000000001';
    const orgB = '00000000-0000-0000-0000-000000000002';
    const brandFromOtherOrg = '10000000-0000-0000-0000-000000000001';

    await client.query(
      `INSERT INTO brands_it (id, organization_id, is_active, is_deleted) VALUES ($1, $2, TRUE, FALSE)`,
      [brandFromOtherOrg, orgB],
    );

    const brandLookup = await client.query<{ id: string }>(
      `
      SELECT id
      FROM brands_it
      WHERE id = $1
        AND organization_id = $2
        AND is_active = TRUE
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [brandFromOtherOrg, orgA],
    );

    expect(brandLookup.rows).toHaveLength(0);
  });

  it('quick-entry technician validation query rejects cross-org technician', async () => {
    const orgA = '00000000-0000-0000-0000-000000000011';
    const orgB = '00000000-0000-0000-0000-000000000012';
    const techFromOtherOrg = '20000000-0000-0000-0000-000000000001';

    await client.query(
      `INSERT INTO users_it (id, organization_id, role, is_active, is_deleted) VALUES ($1, $2, 'technician', TRUE, FALSE)`,
      [techFromOtherOrg, orgB],
    );

    const technicianLookup = await client.query<{ id: string }>(
      `
      SELECT id
      FROM users_it
      WHERE id = $1
        AND organization_id = $2
        AND role = 'technician'
        AND is_active = TRUE
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [techFromOtherOrg, orgA],
    );

    expect(technicianLookup.rows).toHaveLength(0);
  });

  it('pending revisit cards query returns only current organization rows', async () => {
    const orgA = '00000000-0000-0000-0000-000000000021';
    const orgB = '00000000-0000-0000-0000-000000000022';

    await client.query(
      `
      INSERT INTO jobs_it (id, organization_id, type, status, source, is_deleted, customer_name)
      VALUES
        ('30000000-0000-0000-0000-000000000001', $1, 'complaint', 'needs_revisit', 'direct', FALSE, 'Org A Customer'),
        ('30000000-0000-0000-0000-000000000002', $2, 'complaint', 'needs_revisit', 'direct', FALSE, 'Org B Customer')
      `,
      [orgA, orgB],
    );

    await client.query(
      `
      INSERT INTO revisits_it (id, organization_id, job_id, sequence_number, reason, is_deleted)
      VALUES
        ('40000000-0000-0000-0000-000000000001', $1, '30000000-0000-0000-0000-000000000001', 1, 'issue_recurring', FALSE),
        ('40000000-0000-0000-0000-000000000002', $2, '30000000-0000-0000-0000-000000000002', 2, 'part_unavailable', FALSE)
      `,
      [orgA, orgB],
    );

    const cards = await client.query<{ job_id: string }>(
      `
      SELECT
        j.id AS job_id
      FROM jobs_it j
      LEFT JOIN LATERAL (
        SELECT r.id, r.sequence_number, r.reason, r.custom_reason
        FROM revisits_it r
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
      [orgA],
    );

    expect(cards.rows).toHaveLength(1);
    expect(cards.rows[0].job_id).toBe('30000000-0000-0000-0000-000000000001');
  });

  it('reschedule update is blocked by organization_id mismatch', async () => {
    const orgA = '00000000-0000-0000-0000-000000000031';
    const orgB = '00000000-0000-0000-0000-000000000032';

    await client.query(
      `
      INSERT INTO jobs_it (id, organization_id, type, status, source, scheduled_at, version, is_deleted)
      VALUES ('50000000-0000-0000-0000-000000000001', $1, 'installation', 'scheduled', 'direct', NOW(), 3, FALSE)
      `,
      [orgB],
    );

    const updateResult = await client.query(
      `
      UPDATE jobs_it
      SET scheduled_at = NOW() + INTERVAL '1 day',
          visit_outcome = 'rescheduled',
          version = version + 1
      WHERE id = $1
        AND organization_id = $2
        AND version = $3
        AND is_deleted = FALSE
      RETURNING id
      `,
      ['50000000-0000-0000-0000-000000000001', orgA, 3],
    );

    expect(updateResult.rows).toHaveLength(0);
  });

  it('reschedule update is blocked by version mismatch even in correct org', async () => {
    const orgA = '00000000-0000-0000-0000-000000000041';

    await client.query(
      `
      INSERT INTO jobs_it (id, organization_id, type, status, source, scheduled_at, version, is_deleted)
      VALUES ('60000000-0000-0000-0000-000000000001', $1, 'installation', 'scheduled', 'direct', NOW(), 7, FALSE)
      `,
      [orgA],
    );

    const updateResult = await client.query(
      `
      UPDATE jobs_it
      SET scheduled_at = NOW() + INTERVAL '2 days',
          visit_outcome = 'rescheduled',
          version = version + 1
      WHERE id = $1
        AND organization_id = $2
        AND version = $3
        AND is_deleted = FALSE
      RETURNING id
      `,
      ['60000000-0000-0000-0000-000000000001', orgA, 6],
    );

    expect(updateResult.rows).toHaveLength(0);
  });
});
