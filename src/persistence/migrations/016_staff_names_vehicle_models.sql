-- Optional recorded names/models; existing identities and vehicle capacities are unchanged.
ALTER TABLE account ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS profile_description text;
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS photo_url text;
