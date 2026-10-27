-- 013_staff_status.sql
-- Staff status: Available, OnCall, Unavailable, Dispatched
-- On-call staff have a configurable lag time (default 2 hours) before starting dispatch.

ALTER TABLE account
  ADD COLUMN IF NOT EXISTS staff_status text NOT NULL DEFAULT 'Available',
  ADD COLUMN IF NOT EXISTS on_call_lag_hours int NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'account_staff_status_check'
  ) THEN
    ALTER TABLE account
      ADD CONSTRAINT account_staff_status_check
      CHECK (staff_status IN ('Available', 'OnCall', 'Unavailable', 'Dispatched'));
  END IF;
END $$;
