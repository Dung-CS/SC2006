import { Database } from '../persistence/Database';
import { ConfigLoader } from '../config/ConfigLoader';

async function main() {
  const config = ConfigLoader.load();
  const url = config.get('DATABASE_URL');
  if (!url) {
    console.log('No DATABASE_URL found');
    return;
  }
  const db = new Database(url);
  try {
    const obsCount = await db.query('SELECT count(*) AS total FROM observation_record');
    console.log('Total observation_record count:', obsCount);

    const runs = await db.query(
      "SELECT id, source, outcome, started_at, ended_at, feature_count, pest_type, accepted_count, rejected_count FROM ingestion_run WHERE source = 'Observations' ORDER BY started_at DESC LIMIT 5"
    );
    console.log('Observation ingestion runs:', runs);

    const records = await db.query(
      "SELECT observation_id, pest_type, taxon_name, observed_on, locality_id, ingested_at FROM observation_record LIMIT 10"
    );
    console.log('Sample observation records:', records);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
