import { randomBytes, scryptSync } from 'crypto';
import { Client } from 'pg';

const TABLES = [
  'organizations',
  'platform_admins',
  'users',
  'system_config',
  'dealers',
  'brands',
  'virtual_customers',
  'customer_phones',
  'jobs',
  'job_units',
  'job_cancellation_requests',
  'job_timeline',
  'notifications',
  'job_assignments',
  'scheduling_conflicts',
  'payment_methods',
  'payments',
  'revisits',
  'revisit_assignments',
  'mobile_sync_events',
  'analytics_business_daily',
  'analytics_technician_daily',
  'analytics_brand_daily',
  'analytics_dealer_daily',
  'customer_reviews',
  'analytics_processed_events',
  'dealer_credentials',
  'dealer_brands',
  'service_items',
  'job_payment_items',
];

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log('Wiping all data...');
    await client.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);

    console.log('Seeding organization...');
    const { rows: orgRows } = await client.query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
      ['Demo Company', 'demo'],
    );
    const organizationId = orgRows[0].id;
    await client.query('SELECT seed_system_config($1)', [organizationId]);

    console.log('Seeding staff users...');
    const staffUsers = [
      { email: 'owner@cooldesk.dev', fullName: 'Demo Owner', role: 'owner' },
      { email: 'staff@cooldesk.dev', fullName: 'Demo Office Staff', role: 'office_staff' },
      { email: 'tech@cooldesk.dev', fullName: 'Demo Technician', role: 'technician' },
    ];
    for (const user of staffUsers) {
      await client.query(
        `
        INSERT INTO users (organization_id, email, full_name, role, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [organizationId, user.email, user.fullName, user.role, hashPassword('password')],
      );
    }

    console.log('Seeding dealer...');
    const { rows: dealerRows } = await client.query<{ id: string }>(
      `
      INSERT INTO dealers (organization_id, name, phone, email, contact_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [organizationId, 'Demo Dealer', '0000000000', 'dealer@cooldesk.dev', 'Demo Dealer Contact'],
    );
    await client.query(
      `INSERT INTO dealer_credentials (dealer_id, password_hash) VALUES ($1, $2)`,
      [dealerRows[0].id, hashPassword('password')],
    );

    console.log('Seeding platform admin...');
    await client.query(
      `INSERT INTO platform_admins (email, password_hash, full_name) VALUES ($1, $2, $3)`,
      ['admin@cooldesk.dev', hashPassword('password'), 'Demo Platform Admin'],
    );

    console.log('Seed complete.');
    console.log('  owner:           owner@cooldesk.dev / password');
    console.log('  office_staff:    staff@cooldesk.dev / password');
    console.log('  technician:      tech@cooldesk.dev / password');
    console.log('  dealer:          dealer@cooldesk.dev / password');
    console.log('  platform_admin:  admin@cooldesk.dev / password');
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
