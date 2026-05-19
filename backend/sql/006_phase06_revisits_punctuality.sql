-- Phase 06: Revisits & punctuality

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revisit_reason') THEN
    CREATE TYPE revisit_reason AS ENUM (
      'part_unavailable',
      'customer_not_home',
      'issue_recurring',
      'further_diagnosis_required',
      'custom'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revisit_outcome') THEN
    CREATE TYPE revisit_outcome AS ENUM ('resolved', 'needs_revisit', 'on_time', 'late', 'no_show');
  END IF;
END
$$;

ALTER TABLE revisits
  ADD COLUMN IF NOT EXISTS actual_arrival TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_outcome revisit_outcome,
  ADD COLUMN IF NOT EXISTS late_by_minutes INT,
  ADD COLUMN IF NOT EXISTS outcome revisit_outcome,
  ADD CONSTRAINT chk_revisits_late_by_minutes_non_negative CHECK (late_by_minutes IS NULL OR late_by_minutes >= 0);

ALTER TABLE revisits
  ALTER COLUMN reason TYPE revisit_reason USING reason::revisit_reason;

ALTER TABLE revisits
  DROP CONSTRAINT IF EXISTS chk_custom_reason;
ALTER TABLE revisits
  ADD CONSTRAINT chk_custom_reason CHECK (reason <> 'custom' OR custom_reason IS NOT NULL);

ALTER TABLE revisits
  DROP CONSTRAINT IF EXISTS revisits_job_id_sequence_number_key;

ALTER TABLE revisits
  DROP CONSTRAINT IF EXISTS revisits_organization_id_job_id_sequence_number_key;

ALTER TABLE revisits
  ADD CONSTRAINT uq_revisits_job_sequence UNIQUE (job_id, sequence_number);

ALTER TABLE revisit_assignments
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION fn_check_chronic()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sequence_number >= 3 THEN
    UPDATE jobs
    SET is_chronic = TRUE,
        updated_at = NOW()
    WHERE id = NEW.job_id
      AND organization_id = NEW.organization_id
      AND is_chronic = FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chronic ON revisits;

CREATE TRIGGER trg_chronic
AFTER INSERT ON revisits
FOR EACH ROW
EXECUTE FUNCTION fn_check_chronic();

CREATE INDEX IF NOT EXISTS idx_revisits_org_scheduled_no_show
  ON revisits (organization_id, scheduled_at)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_revisits_org_job_seq
  ON revisits (organization_id, job_id, sequence_number DESC)
  WHERE is_deleted = FALSE;
