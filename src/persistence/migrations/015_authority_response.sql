-- Unified authority operations: capabilities remain explicit, with no automatic staff upgrade.
ALTER TABLE account DROP CONSTRAINT IF EXISTS account_specialisation_check;
ALTER TABLE account ADD CONSTRAINT account_specialisation_check CHECK (
  specialisation IS NULL
  OR (role = 'CleaningCrew' AND specialisation IN (
    'VectorControl', 'Sanitation', 'Structural', 'GeneralInspection', 'AuthorityResponse'
  ))
);
