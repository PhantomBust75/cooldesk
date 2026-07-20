/**
 * Seeds one organization + all role types for local dev.
 * Run from repo root: node scripts/seed-dev-users.mjs
 *
 * Credentials (all use password: "password"):
 *   platform admin  → platform@cooldesk.dev
 *   owner           → owner@cooldesk.dev
 *   office staff    → staff@cooldesk.dev
 *   technician      → tech@cooldesk.dev
 *   dealer login    → via POST /dealer/login  (id printed at end)
 */

import { randomBytes, scryptSync } from 'node:crypto';
import pg from '../backend/node_modules/pg/lib/index.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:sa123@localhost:5432/cooldesk';
const PASSWORD = 'password';

function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

try {
  await client.query('BEGIN');

  // ── 1. Platform admin ──────────────────────────────────────────────────────
  await client.query(`
    INSERT INTO platform_admins (email, password_hash, full_name)
    VALUES ($1, $2, 'Platform Admin')
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          full_name     = EXCLUDED.full_name
  `, ['platform@cooldesk.dev', hashPassword(PASSWORD)]);

  // ── 2. Organization ────────────────────────────────────────────────────────
  const orgRes = await client.query(`
    INSERT INTO organizations (name, slug)
    VALUES ('Dev Org', 'dev-org')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const orgId = orgRes.rows[0].id;

  // Seed system config for the org (idempotent)
  await client.query(`SELECT seed_system_config($1)`, [orgId]);

  // ── 3. Tenant users (owner, office_staff, technician) ─────────────────────
  const tenantUsers = [
    { email: 'owner@cooldesk.dev',  fullName: 'Dev Owner',      role: 'owner'        },
    { email: 'staff@cooldesk.dev',  fullName: 'Dev Staff',      role: 'office_staff' },
    { email: 'tech@cooldesk.dev',   fullName: 'Dev Technician', role: 'technician'   },
  ];

  for (const u of tenantUsers) {
    await client.query(`
      INSERT INTO users (organization_id, email, full_name, role, password_hash)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (organization_id, email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            full_name     = EXCLUDED.full_name,
            role          = EXCLUDED.role,
            is_active     = TRUE,
            is_deleted    = FALSE
    `, [orgId, u.email, u.fullName, u.role, hashPassword(PASSWORD)]);
  }

  // ── 4. Dealer ──────────────────────────────────────────────────────────────
  const dealerRes = await client.query(`
    INSERT INTO dealers (organization_id, name, is_active, is_deleted)
    VALUES ($1, 'Dev Dealer', TRUE, FALSE)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [orgId]);

  let dealerId;
  if (dealerRes.rows.length > 0) {
    dealerId = dealerRes.rows[0].id;
    await client.query(`
      INSERT INTO dealer_credentials (dealer_id, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (dealer_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [dealerId, hashPassword(PASSWORD)]);
  } else {
    const existing = await client.query(`
      SELECT id FROM dealers WHERE organization_id = $1 AND name = 'Dev Dealer' LIMIT 1
    `, [orgId]);
    dealerId = existing.rows[0]?.id;
    if (dealerId) {
      await client.query(`
        INSERT INTO dealer_credentials (dealer_id, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (dealer_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `, [dealerId, hashPassword(PASSWORD)]);
    }
  }

  await client.query('COMMIT');

  console.log('\n✓ Dev seed complete\n');
  console.log('Organization ID :', orgId);
  console.log('Dealer ID       :', dealerId ?? '(already existed, check DB)');
  console.log('\nAll credentials use password: "password"\n');
  console.log('Role            Email');
  console.log('─────────────── ──────────────────────');
  console.log('platform_admin  platform@cooldesk.dev');
  console.log('owner           owner@cooldesk.dev');
  console.log('office_staff    staff@cooldesk.dev');
  console.log('technician      tech@cooldesk.dev');
  console.log('dealer          (use dealer ID above + POST /dealer/login)');
  console.log('');

} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
