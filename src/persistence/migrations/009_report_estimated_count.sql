-- =============================================================================================
-- D-Fence — migration 009: Persist specimen estimated count on report.
-- Traces: 5.1.15, 5.1.18.
-- =============================================================================================

ALTER TABLE report ADD COLUMN IF NOT EXISTS estimated_count integer;
