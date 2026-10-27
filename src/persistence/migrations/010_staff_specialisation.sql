-- =============================================================================================
-- D-Fence — migration 010: a crew member's recorded capability.
-- Traces: 8.1.17, 8.2.1, 8.2.3, 2.4.1.
--
-- Nullable on purpose. Every account that exists before this migration has no recorded capability,
-- and NULL keeps that fact: StaffRoutingPolicy treats NULL as "qualified for nothing" until an
-- Operations Manager sets it. A DEFAULT here would silently qualify every legacy crew member.
--
-- Only a Cleaning Crew account may carry one. It is not an auth role; `role` is unchanged.
-- =============================================================================================

ALTER TABLE account ADD COLUMN IF NOT EXISTS specialisation text;

ALTER TABLE account DROP CONSTRAINT IF EXISTS account_specialisation_check;
ALTER TABLE account ADD CONSTRAINT account_specialisation_check CHECK (
  specialisation IS NULL
  OR (role = 'CleaningCrew'
      AND specialisation IN ('VectorControl', 'Sanitation', 'Structural', 'GeneralInspection'))
);
