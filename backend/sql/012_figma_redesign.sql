-- Add revisit_count to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revisit_count INTEGER NOT NULL DEFAULT 0;

-- Create service_items table
CREATE TABLE IF NOT EXISTS service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('fixed', 'variable')),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_items_org ON service_items(organization_id);

-- Seed new system_config keys (INSERT only if key doesn't exist for any org)
-- These are org-level keys seeded on first use; seed defaults into the system_config table
-- for organizations that don't have them yet using a migration-safe approach.
-- The keys are seeded as empty-row placeholders; TenantConfigService.getInt() has fallbacks.
-- Actual per-org seeding happens via the settings controller on first save.
-- We document the keys and defaults here for reference:
-- amber_alert_days = 3
-- no_show_hours = 2
-- overdue_schedule_days = 7
-- repeat_complaint_window_days = 30
-- frequent_complaint_threshold = 3
-- frequent_complaint_window_days = 90
-- punctuality_grace_period_minutes = 15
-- standard_job_duration_minutes = 120
-- (No INSERT here — getInt() fallbacks cover all orgs; seeding per-org only on explicit save)
