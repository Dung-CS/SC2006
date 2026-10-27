-- Vehicle capacities are entered by a manager. Demo rows are labelled by the application seeder.
CREATE TABLE IF NOT EXISTS vehicle (
  id text PRIMARY KEY,
  registration text NOT NULL UNIQUE,
  name text NOT NULL,
  hq_location text NOT NULL CHECK (hq_location IN ('Central','NorthEast','NorthWest','SouthEast','SouthWest')),
  max_payload_kg numeric NOT NULL CHECK (max_payload_kg > 0 AND max_payload_kg < 'Infinity'::numeric),
  max_cargo_volume_m3 numeric NOT NULL CHECK (max_cargo_volume_m3 > 0 AND max_cargo_volume_m3 < 'Infinity'::numeric),
  cargo_length_cm numeric NOT NULL CHECK (cargo_length_cm > 0 AND cargo_length_cm < 'Infinity'::numeric),
  cargo_width_cm numeric NOT NULL CHECK (cargo_width_cm > 0 AND cargo_width_cm < 'Infinity'::numeric),
  cargo_height_cm numeric NOT NULL CHECK (cargo_height_cm > 0 AND cargo_height_cm < 'Infinity'::numeric),
  seat_capacity integer NOT NULL CHECK (seat_capacity > 0),
  is_available boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  CHECK (max_cargo_volume_m3 <= cargo_length_cm * cargo_width_cm * cargo_height_cm / 1000000)
);
