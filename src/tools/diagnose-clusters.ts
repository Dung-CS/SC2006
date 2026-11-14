import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';

async function main() {
  const config = ConfigLoader.load();
  const db = new Database(config.get('DATABASE_URL'));
  try {
    const active = await db.query('SELECT id, locality, case_size FROM cluster WHERE is_active = true');
    console.log('Active clusters in DB:', active);

    const obs = await db.query(
      'SELECT pest_type, locality_id, count(*) FROM observation_record GROUP BY pest_type, locality_id'
    );
    console.log('Observations grouped by pest and locality:', obs);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
