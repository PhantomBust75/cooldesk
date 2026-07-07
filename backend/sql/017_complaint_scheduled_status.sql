-- Allow complaint jobs to go through the scheduling flow (pending_schedule → scheduled → assigned)
-- Previously the trigger only permitted installation jobs to use these statuses.
CREATE OR REPLACE FUNCTION validate_job_status_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'installation' THEN
    IF NEW.status NOT IN (
      'pending_schedule',
      'scheduled',
      'assigned',
      'acknowledged',
      'in_transit',
      'in_process',
      'completed',
      'cancelled'
    ) THEN
      RAISE EXCEPTION 'Invalid installation status: %', NEW.status;
    END IF;
  ELSIF NEW.type = 'complaint' THEN
    IF NEW.status NOT IN (
      'new',
      'pending_schedule',
      'scheduled',
      'assigned',
      'acknowledged',
      'in_transit',
      'in_process',
      'resolved',
      'needs_revisit',
      'revisit_scheduled',
      'resolved_on_revisit',
      'cancellation_requested',
      'cancellation_pending',
      'cancelled'
    ) THEN
      RAISE EXCEPTION 'Invalid complaint status: %', NEW.status;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid job type: %', NEW.type;
  END IF;

  RETURN NEW;
END;
$$;
