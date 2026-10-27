-- =============================================================================================
-- D-Fence — migration 011: a verified report is a work-order target in its own right (8.1.2).
-- Traces: 8.1.2, 8.1.5, 8.1.13, 8.1.16, 8.3.12, 4.1.15, 4.4.8.
--
-- NOT YET APPLIED. Written for review; replay it on an isolated database first.
--
-- 1. work_order.cluster_id becomes nullable. A report outside every dengue cluster is still a real
--    place with a real point, and inventing a cluster for it would be a false association.
-- 2. A target CHECK keeps every row pointing somewhere: a cluster, a source report, or both.
-- 3. source_report_id moves from ON DELETE SET NULL to RESTRICT, so the sole target of a
--    report-only job cannot disappear under it (the CHECK would refuse the SET NULL anyway).
-- 4. work_order.pest_type is persisted. Before this, a Rat or Termite job reloaded from Postgres as
--    the entity default, Mosquito. The backfill uses only evidence already stored: the source
--    report, else the linked reports when they all name one pest. Anything else stays NULL and the
--    application shows it as unknown and refuses to assign it. A blanket Mosquito would invent
--    history.
-- 5. treatment_record gains a nullable cluster and a pest, so a report-only verification records
--    its treatment against the work order alone, and a rat inspection at a dengue cluster no longer
--    resets the Mosquito days-since-treatment driver. A legacy record of unknown pest keeps counting
--    for every pest, which is what it did before.
-- 6. Critical is added to the work-order priority CHECK: 4.4's override yields Critical tiers, and
--    a report recording a human injury is dispatched at Critical (4.4.8).
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1–3. Target
-- ---------------------------------------------------------------------------------------------

ALTER TABLE work_order ALTER COLUMN cluster_id DROP NOT NULL;

ALTER TABLE work_order DROP CONSTRAINT IF EXISTS work_order_target_check;
ALTER TABLE work_order ADD CONSTRAINT work_order_target_check
  CHECK (cluster_id IS NOT NULL OR source_report_id IS NOT NULL);

ALTER TABLE work_order DROP CONSTRAINT IF EXISTS work_order_source_report_id_fkey;
ALTER TABLE work_order ADD CONSTRAINT work_order_source_report_id_fkey
  FOREIGN KEY (source_report_id) REFERENCES report(id) ON DELETE RESTRICT;

-- 8.1.2, 8.1.11 — the duplicate check for a report-only job reads by source.
CREATE INDEX IF NOT EXISTS work_order_source_open_idx ON work_order (source_report_id)
  WHERE source_report_id IS NOT NULL AND status NOT IN ('Verified','Cancelled');

-- ---------------------------------------------------------------------------------------------
-- 4. Work-order pest
-- ---------------------------------------------------------------------------------------------

ALTER TABLE work_order ADD COLUMN IF NOT EXISTS pest_type text;

ALTER TABLE work_order DROP CONSTRAINT IF EXISTS work_order_pest_type_check;
ALTER TABLE work_order ADD CONSTRAINT work_order_pest_type_check CHECK (
  pest_type IS NULL OR pest_type IN (
    'Mosquito','Rat','Cockroach','Fly','BedBug','Flea','Termite','Ant','Snake','WildBoar',
    'Macaque','MonitorLizard','Otter','Civet','Bat','Pangolin','Crocodile','HouseCrow','Pigeon',
    'JavanMyna','BeeWasp','Other'));

-- From the source report: the report the job was raised from names its pest.
UPDATE work_order w
   SET pest_type = r.pest_type
  FROM report r
 WHERE w.pest_type IS NULL
   AND r.id = w.source_report_id;

-- Else from the linked reports, only when every one of them names the same pest.
UPDATE work_order w
   SET pest_type = l.pest_type
  FROM (SELECT work_order_id, min(pest_type) AS pest_type
          FROM report
         WHERE work_order_id IS NOT NULL
         GROUP BY work_order_id
        HAVING count(DISTINCT pest_type) = 1) l
 WHERE w.pest_type IS NULL
   AND l.work_order_id = w.id;

-- Rows still NULL are left NULL on purpose: unknown, not Mosquito.

-- ---------------------------------------------------------------------------------------------
-- 6. Priority
-- ---------------------------------------------------------------------------------------------

ALTER TABLE work_order DROP CONSTRAINT IF EXISTS work_order_priority_check;
ALTER TABLE work_order ADD CONSTRAINT work_order_priority_check
  CHECK (priority IN ('Critical','High','Medium','Low'));

-- ---------------------------------------------------------------------------------------------
-- 5. Treatment record
-- ---------------------------------------------------------------------------------------------

ALTER TABLE treatment_record ALTER COLUMN cluster_id DROP NOT NULL;

ALTER TABLE treatment_record ADD COLUMN IF NOT EXISTS pest_type text;

ALTER TABLE treatment_record DROP CONSTRAINT IF EXISTS treatment_record_pest_type_check;
ALTER TABLE treatment_record ADD CONSTRAINT treatment_record_pest_type_check CHECK (
  pest_type IS NULL OR pest_type IN (
    'Mosquito','Rat','Cockroach','Fly','BedBug','Flea','Termite','Ant','Snake','WildBoar',
    'Macaque','MonitorLizard','Otter','Civet','Bat','Pangolin','Crocodile','HouseCrow','Pigeon',
    'JavanMyna','BeeWasp','Other'));

-- From the work order it records, and only where that pest is now known.
UPDATE treatment_record t
   SET pest_type = w.pest_type
  FROM work_order w
 WHERE t.pest_type IS NULL
   AND t.work_order_id = w.id
   AND w.pest_type IS NOT NULL;
