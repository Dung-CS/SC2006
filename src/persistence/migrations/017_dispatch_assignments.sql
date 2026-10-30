-- A dispatch books the full crew and vehicle while retaining ordinary work-order lifecycles.
CREATE TABLE IF NOT EXISTS dispatch_assignment (
  id uuid PRIMARY KEY,
  scheduled_date date NOT NULL,
  source_team_id text NOT NULL,
  crew_ids uuid[] NOT NULL CHECK (cardinality(crew_ids) > 0),
  vehicle_id text NOT NULL REFERENCES vehicle(id),
  computed_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  UNIQUE (scheduled_date, source_team_id, computed_at)
);
ALTER TABLE work_order ADD COLUMN IF NOT EXISTS dispatch_assignment_id uuid REFERENCES dispatch_assignment(id);
CREATE INDEX IF NOT EXISTS work_order_dispatch_assignment_idx ON work_order(dispatch_assignment_id);
CREATE INDEX IF NOT EXISTS dispatch_assignment_date_idx ON dispatch_assignment(scheduled_date);
