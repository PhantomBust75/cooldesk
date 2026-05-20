/**
 * Comprehensive test data seed for CoolDesk dev environment.
 * Run from repo root: node scripts/seed-test-data.mjs
 *
 * Creates: brands, payment methods, dealers, jobs (all status variants),
 *          assignments, payments, revisits, notifications, reviews.
 */

import pg from '../backend/node_modules/pg/lib/index.js';
import { randomBytes, scryptSync } from 'node:crypto';

const DB = process.env.DATABASE_URL ?? 'postgres://postgres:sa123@localhost:5432/cooldesk';
const ORG_SLUG = 'dev-org';

function hashPassword(p) {
  const s = randomBytes(16).toString('hex');
  return `${s}:${scryptSync(p, s, 64).toString('hex')}`;
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

const q = (text, params) => client.query(text, params);

try {
  // ── Resolve org + users ────────────────────────────────────────────────────
  const { rows: [org] } = await q(`SELECT id FROM organizations WHERE slug=$1`, [ORG_SLUG]);
  if (!org) throw new Error(`Organization '${ORG_SLUG}' not found. Run seed-dev-users.mjs first.`);
  const ORG = org.id;

  const { rows: [owner] }   = await q(`SELECT id FROM users WHERE organization_id=$1 AND role='owner' LIMIT 1`, [ORG]);
  const { rows: [staff] }   = await q(`SELECT id FROM users WHERE organization_id=$1 AND role='office_staff' LIMIT 1`, [ORG]);
  const { rows: [tech1] }   = await q(`SELECT id FROM users WHERE organization_id=$1 AND role='technician' LIMIT 1`, [ORG]);

  // ── Extra technician ───────────────────────────────────────────────────────
  const { rows: [tech2row] } = await q(`
    INSERT INTO users (organization_id, email, full_name, role, password_hash)
    VALUES ($1,'tech2@cooldesk.dev','Dev Technician 2','technician',$2)
    ON CONFLICT (organization_id,email) DO UPDATE SET full_name=EXCLUDED.full_name
    RETURNING id`, [ORG, hashPassword('password')]);
  const tech2 = tech2row.id;

  console.log('✓ Users resolved');

  // ── Brands ─────────────────────────────────────────────────────────────────
  async function upsertBrand(name, color) {
    const { rows: [r] } = await q(`
      INSERT INTO brands (organization_id, name, color_hex)
      VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING
      RETURNING id`, [ORG, name, color]);
    if (r) return r.id;
    const { rows: [ex] } = await q(`SELECT id FROM brands WHERE organization_id=$1 AND name=$2`, [ORG, name]);
    return ex.id;
  }

  const brandSamsung = await upsertBrand('Samsung AC', '#1565C0');
  const brandLG      = await upsertBrand('LG AC',      '#2E7D32');
  const brandHaier   = await upsertBrand('Haier AC',   '#6A1B9A');
  const brandDaikin  = await upsertBrand('Daikin AC',  '#00838F');

  console.log('✓ Brands created (Samsung, LG, Haier, Daikin)');

  // ── Payment methods ────────────────────────────────────────────────────────
  async function upsertPM(name) {
    const { rows: [r] } = await q(`
      INSERT INTO payment_methods (organization_id, name)
      VALUES ($1,$2)
      ON CONFLICT (organization_id,name) DO NOTHING
      RETURNING id`, [ORG, name]);
    if (r) return r.id;
    const { rows: [ex] } = await q(`SELECT id FROM payment_methods WHERE organization_id=$1 AND name=$2`, [ORG, name]);
    return ex.id;
  }

  const pmCash  = await upsertPM('Cash');
  const pmCard  = await upsertPM('Card');
  const pmBank  = await upsertPM('Bank Transfer');

  console.log('✓ Payment methods created (Cash, Card, Bank Transfer)');

  // ── Dealers ────────────────────────────────────────────────────────────────
  // Existing Dev Dealer — link Samsung + LG brands
  const { rows: [devDealer] } = await q(`SELECT id FROM dealers WHERE organization_id=$1 AND name='Dev Dealer' LIMIT 1`, [ORG]);
  const DEALER1 = devDealer.id;

  for (const bid of [brandSamsung, brandLG]) {
    await q(`INSERT INTO dealer_brands(dealer_id,brand_id,organization_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [DEALER1, bid, ORG]);
  }

  // 2nd dealer: Cool Air Dealers
  const { rows: [d2row] } = await q(`
    INSERT INTO dealers (organization_id, name, is_active, is_deleted)
    VALUES ($1,'Cool Air Dealers',TRUE,FALSE)
    ON CONFLICT DO NOTHING RETURNING id`,[ORG]);
  let DEALER2;
  if (d2row) {
    DEALER2 = d2row.id;
    await q(`INSERT INTO dealer_credentials(dealer_id,password_hash) VALUES($1,$2) ON CONFLICT(dealer_id) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
      [DEALER2, hashPassword('password')]);
  } else {
    const { rows: [ex] } = await q(`SELECT id FROM dealers WHERE organization_id=$1 AND name='Cool Air Dealers'`, [ORG]);
    DEALER2 = ex.id;
  }
  for (const bid of [brandHaier, brandDaikin]) {
    await q(`INSERT INTO dealer_brands(dealer_id,brand_id,organization_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [DEALER2, bid, ORG]);
  }

  console.log('✓ Dealers configured (Dev Dealer → Samsung/LG, Cool Air Dealers → Haier/Daikin)');

  // ── Helper: create a job + virtual_customer ────────────────────────────────
  async function createJob({ type, source, status, brand, dealer, tech, customerName, phone, address, scheduledAt, createdBy }) {
    // Create virtual customer
    const { rows: [vc] } = await q(`
      INSERT INTO virtual_customers (organization_id, customer_name, address)
      VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING RETURNING id`, [ORG, customerName, address]);
    let vcId = vc?.id;
    if (!vcId) {
      const { rows: [ex] } = await q(
        `SELECT id FROM virtual_customers WHERE organization_id=$1 AND customer_name=$2 AND address=$3 LIMIT 1`,
        [ORG, customerName, address]);
      vcId = ex?.id;
    }

    // Store phone in customer_phones
    await q(`INSERT INTO customer_phones(organization_id,vcid,phone) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [ORG, vcId, phone]);

    const { rows: [job] } = await q(`
      INSERT INTO jobs (
        organization_id, type, source, brand_id, dealer_id,
        vcid, customer_name, phone, address, issue_description,
        status, scheduled_at, created_by_user_id, is_deleted
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,FALSE)
      RETURNING id`, [
        ORG, type, source, brand, dealer ?? null,
        vcId, customerName, phone, address,
        type === 'complaint' ? 'Unit not cooling properly' : null,
        status, scheduledAt ?? null, createdBy ?? owner.id,
      ]);

    if (tech) {
      await q(`
        INSERT INTO job_assignments(job_id,technician_id,organization_id,is_active,created_by)
        VALUES($1,$2,$3,TRUE,$4)`, [job.id, tech, ORG, owner.id]);
    }

    return job.id;
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

  // 1. Installation — pending_schedule (not yet scheduled)
  const j_pending = await createJob({
    type:'installation', source:'direct', status:'pending_schedule',
    brand:brandSamsung, customerName:'Ahmed Khan', phone:'03001234501',
    address:'House 12, Block B, DHA Phase 5, Lahore'
  });

  // 2. Installation — scheduled (ready to assign)
  const j_scheduled = await createJob({
    type:'installation', source:'direct', status:'scheduled',
    brand:brandLG, customerName:'Sara Malik', phone:'03001234502',
    address:'Flat 4, Al-Hamra Heights, Gulberg III, Lahore',
    scheduledAt: tomorrow
  });

  // 3. Installation — assigned (tech can acknowledge)
  const j_assigned = await createJob({
    type:'installation', source:'direct', status:'assigned',
    brand:brandHaier, customerName:'Bilal Ahmed', phone:'03001234503',
    address:'Street 7, G-10/2, Islamabad',
    scheduledAt: tomorrow, tech: tech1.id
  });

  // 4. Installation — acknowledged
  const j_acknowledged = await createJob({
    type:'installation', source:'direct', status:'acknowledged',
    brand:brandDaikin, customerName:'Fatima Zahra', phone:'03001234504',
    address:'Bungalow 23, PECHS Block 2, Karachi',
    scheduledAt: tomorrow, tech: tech1.id
  });
  await q(`UPDATE job_assignments SET acknowledged_at=NOW() WHERE job_id=$1`, [j_acknowledged]);

  // 5. Installation — in_transit
  const j_transit = await createJob({
    type:'installation', source:'direct', status:'in_transit',
    brand:brandSamsung, customerName:'Usman Ali', phone:'03001234505',
    address:'Plot 45, Bahria Town Phase 4, Rawalpindi',
    scheduledAt: yesterday, tech: tech2
  });
  await q(`UPDATE job_assignments SET acknowledged_at=NOW() WHERE job_id=$1`, [j_transit]);

  // 6. Installation — in_process
  const j_inprocess = await createJob({
    type:'installation', source:'direct', status:'in_process',
    brand:brandLG, customerName:'Zainab Hussain', phone:'03001234506',
    address:'House 88, Model Town Extension, Lahore',
    scheduledAt: yesterday, tech: tech1.id
  });

  // 7. Installation — completed (with payment)
  const j_completed = await createJob({
    type:'installation', source:'direct', status:'completed',
    brand:brandSamsung, customerName:'Hamza Sheikh', phone:'03001234507',
    address:'Apartment 12B, Clifton Block 5, Karachi',
    scheduledAt: twoDaysAgo, tech: tech1.id
  });
  await q(`UPDATE jobs SET actual_arrival=$2, visit_outcome='on_time' WHERE id=$1`, [j_completed, twoDaysAgo]);
  const { rows: [pay1] } = await q(`
    INSERT INTO payments(organization_id,job_id,amount,payment_method_id,status,recorded_by)
    VALUES($1,$2,8500,$3,'collected',$4) RETURNING id`, [ORG, j_completed, pmCash, owner.id]);
  await q(`UPDATE payments SET collected_at=NOW() WHERE id=$1`, [pay1.id]);
  await q(`UPDATE jobs SET version=version+1 WHERE id=$1`, [j_completed]);

  // 8. Complaint — new (via dealer, initial state)
  const j_complaint_new = await createJob({
    type:'complaint', source:'via_dealer', status:'new',
    brand:brandSamsung, dealer:DEALER1, customerName:'Nadia Iqbal', phone:'03001234508',
    address:'House 5, Johar Town Block D, Lahore'
  });

  // 9. Complaint — assigned (direct)
  const j_complaint_assigned = await createJob({
    type:'complaint', source:'direct', status:'assigned',
    brand:brandLG, customerName:'Tariq Mehmood', phone:'03001234509',
    address:'Street 12, Askari 10, Lahore Cantt',
    scheduledAt: tomorrow, tech: tech2
  });

  // 10. Complaint — in_process
  const j_complaint_inprocess = await createJob({
    type:'complaint', source:'direct', status:'in_process',
    brand:brandHaier, customerName:'Amna Chaudhry', phone:'03001234510',
    address:'Flat 7, Sea View Apartments, Karachi',
    scheduledAt: yesterday, tech: tech1.id
  });

  // 11. Complaint — resolved
  const j_resolved = await createJob({
    type:'complaint', source:'direct', status:'resolved',
    brand:brandDaikin, customerName:'Kamran Baig', phone:'03001234511',
    address:'House 34, Wapda Town Phase 1, Lahore',
    scheduledAt: twoDaysAgo, tech: tech2
  });

  // 12. Complaint — needs_revisit
  const j_revisit = await createJob({
    type:'complaint', source:'direct', status:'needs_revisit',
    brand:brandSamsung, customerName:'Sana Riaz', phone:'03001234512',
    address:'Bungalow 15, North Nazimabad Block H, Karachi',
    scheduledAt: twoDaysAgo, tech: tech1.id
  });
  const { rows: [rv] } = await q(`
    INSERT INTO revisits(organization_id,job_id,sequence_number,reason,scheduled_at)
    VALUES($1,$2,1,'part_unavailable',$3) RETURNING id`, [ORG, j_revisit, tomorrow]);
  await q(`UPDATE jobs SET status='revisit_scheduled' WHERE id=$1`, [j_revisit]);

  // 13. Cancelled job
  const j_cancelled = await createJob({
    type:'installation', source:'direct', status:'cancelled',
    brand:brandLG, customerName:'Imran Raza', phone:'03001234513',
    address:'Plot 9, F-8/3, Islamabad'
  });

  // 14. Via-dealer job (Cool Air Dealers submitting)
  const j_dealer2 = await createJob({
    type:'installation', source:'via_dealer', status:'pending_schedule',
    brand:brandDaikin, dealer:DEALER2, customerName:'Rabia Nawaz', phone:'03001234514',
    address:'House 67, Gulshan-e-Iqbal Block 13, Karachi'
  });

  // 15. Completed with disputed payment
  const j_disputed = await createJob({
    type:'installation', source:'direct', status:'completed',
    brand:brandHaier, customerName:'Adnan Farooq', phone:'03001234515',
    address:'Street 3, Chaklala Scheme 3, Rawalpindi',
    scheduledAt: twoDaysAgo, tech: tech2
  });
  await q(`INSERT INTO payments(organization_id,job_id,amount,payment_method_id,status,recorded_by) VALUES($1,$2,12000,$3,'disputed',$4)`,
    [ORG, j_disputed, pmCard, owner.id]);

  console.log('✓ Jobs created (15 jobs across all status types)');

  // ── Job units for some jobs ────────────────────────────────────────────────
  for (const jid of [j_completed, j_inprocess, j_assigned]) {
    await q(`INSERT INTO job_units(job_id,organization_id,label,notes) VALUES($1,$2,'Split AC 1.5 Ton','Main unit')`, [jid, ORG]);
    await q(`INSERT INTO job_units(job_id,organization_id,label,notes) VALUES($1,$2,'Outdoor Unit','Compressor unit')`, [jid, ORG]);
  }

  console.log('✓ Job units added');

  // ── Notifications ──────────────────────────────────────────────────────────
  const notifEvents = [
    { job: j_assigned,          user: tech1.id,   type: 'job_assigned',      msg: 'You have been assigned a new installation job.' },
    { job: j_complaint_new,     user: owner.id,   type: 'job_submitted_by_dealer', msg: 'A new complaint job was submitted by Dev Dealer.' },
    { job: j_revisit,           user: owner.id,   type: 'revisit_scheduled', msg: 'A revisit has been scheduled for job #12.' },
    { job: j_disputed,          user: owner.id,   type: 'payment_disputed',  msg: 'Payment for completed job is disputed.' },
    { job: j_complaint_new,     user: staff.id,   type: 'job_submitted_by_dealer', msg: 'New complaint via dealer needs assignment.' },
    { job: j_transit,           user: tech2,      type: 'job_assigned',      msg: 'You have been assigned an installation job.' },
    { job: j_resolved,          user: owner.id,   type: 'job_resolved',      msg: 'Complaint job resolved successfully.' },
  ];

  for (const n of notifEvents) {
    await q(`
      INSERT INTO notifications(organization_id,job_id,recipient_user_id,event_type,payload,is_read)
      VALUES($1,$2,$3,$4,$5,FALSE)`, [ORG, n.job, n.user, n.type, JSON.stringify({ message: n.msg })]);
  }

  // Dealer notification
  await q(`
    INSERT INTO notifications(organization_id,job_id,recipient_dealer_id,event_type,payload,is_read)
    VALUES($1,$2,$3,'job_status_updated',$4,FALSE)`,
    [ORG, j_complaint_new, DEALER1, JSON.stringify({ message: 'Your submitted job has been scheduled.' })]);

  console.log('✓ Notifications created (8 notifications)');

  // ── Customer reviews ───────────────────────────────────────────────────────
  await q(`
    INSERT INTO customer_reviews(organization_id,job_id,star_rating,comment,submitted_at,link_generated_at)
    VALUES($1,$2,5,'Excellent service! Technician was very professional.',$3,NOW())
    ON CONFLICT DO NOTHING`, [ORG, j_completed, twoDaysAgo]);

  await q(`
    INSERT INTO customer_reviews(organization_id,job_id,star_rating,comment,submitted_at,link_generated_at)
    VALUES($1,$2,2,'Technician was late and did not explain the issue clearly.',$3,NOW())
    ON CONFLICT DO NOTHING`, [ORG, j_resolved, twoDaysAgo]);

  await q(`
    INSERT INTO customer_reviews(organization_id,job_id,link_generated_at)
    VALUES($1,$2,NOW())
    ON CONFLICT DO NOTHING`, [ORG, j_disputed]);

  console.log('✓ Reviews created (5-star, 2-star, pending)');

  // ── Job timeline entries for key jobs ─────────────────────────────────────
  const timelineEntries = [
    { job: j_completed, event: 'job_created',   actor: owner.id },
    { job: j_completed, event: 'job_assigned',  actor: owner.id },
    { job: j_completed, event: 'job_completed', actor: tech1.id },
    { job: j_resolved,  event: 'job_created',   actor: owner.id },
    { job: j_resolved,  event: 'job_resolved',  actor: tech2    },
    { job: j_cancelled, event: 'job_created',   actor: owner.id },
    { job: j_cancelled, event: 'job_cancelled', actor: owner.id },
  ];

  for (const t of timelineEntries) {
    await q(`
      INSERT INTO job_timeline(job_id,organization_id,event_type,actor_user_id)
      VALUES($1,$2,$3,$4)`, [t.job, ORG, t.event, t.actor]);
  }

  console.log('✓ Job timeline entries added');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  TEST DATA SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Org ID:       ${ORG}`);
  console.log(`  Owner ID:     ${owner.id}`);
  console.log(`  Staff ID:     ${staff.id}`);
  console.log(`  Tech 1 ID:    ${tech1.id}`);
  console.log(`  Tech 2 ID:    ${tech2}`);
  console.log(`  Dealer 1 ID:  ${DEALER1}  (Dev Dealer)`);
  console.log(`  Dealer 2 ID:  ${DEALER2}  (Cool Air Dealers)`);
  console.log('');
  console.log('  Brands:', brandSamsung, '(Samsung)');
  console.log('          ', brandLG,      '(LG)');
  console.log('          ', brandHaier,   '(Haier)');
  console.log('          ', brandDaikin,  '(Daikin)');
  console.log('');
  console.log('  Payment Methods: Cash · Card · Bank Transfer');
  console.log('');
  console.log('  Jobs (15 total):');
  console.log(`    pending_schedule  ${j_pending}      (installation, direct)`);
  console.log(`    scheduled         ${j_scheduled}    (installation, direct, tmrw)`);
  console.log(`    assigned          ${j_assigned}     (installation, tech1)`);
  console.log(`    acknowledged      ${j_acknowledged} (installation, tech1)`);
  console.log(`    in_transit        ${j_transit}      (installation, tech2)`);
  console.log(`    in_process        ${j_inprocess}    (installation, tech1)`);
  console.log(`    completed         ${j_completed}    (installation, payment=Cash ₨8500)`);
  console.log(`    complaint new     ${j_complaint_new}     (via_dealer DEALER1)`);
  console.log(`    complaint assigned ${j_complaint_assigned} (direct, tech2)`);
  console.log(`    complaint inprocess ${j_complaint_inprocess} (direct, tech1)`);
  console.log(`    resolved          ${j_resolved}     (complaint, tech2)`);
  console.log(`    needs_revisit     ${j_revisit}      (complaint)`);
  console.log(`    cancelled         ${j_cancelled}    (installation)`);
  console.log(`    dealer2 pending   ${j_dealer2}      (via DEALER2)`);
  console.log(`    disputed payment  ${j_disputed}     (completed, payment disputed)`);
  console.log('');
  console.log('  Reviews: 5★ on completed job, 2★ on resolved job, pending on disputed');
  console.log('  Notifications: 8 created');
  console.log('══════════════════════════════════════════════════════════════\n');

} catch (err) {
  console.error('\n✗ Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await client.end();
}
