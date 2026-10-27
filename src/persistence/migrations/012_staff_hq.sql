-- D-Fence — migration 012: optional operational HQ assignment for staff.
-- A missing assignment stays NULL because legacy staff locations are unknown.
ALTER TABLE account ADD COLUMN IF NOT EXISTS hq_location text;

ALTER TABLE account DROP CONSTRAINT IF EXISTS account_hq_location_check;
ALTER TABLE account ADD CONSTRAINT account_hq_location_check CHECK (
  hq_location IS NULL OR hq_location IN ('Central', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest')
);
