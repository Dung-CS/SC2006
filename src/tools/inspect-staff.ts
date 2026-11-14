import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';

async function main() {
  const url = ConfigLoader.load().get('DATABASE_URL');
  const db = new Database(url);
  const rows = await db.query(
    'SELECT role, specialisation, hq_location, count(*)::int as count FROM account GROUP BY role, specialisation, hq_location',
  );
  console.log('Account breakdown:', rows);
  await db.close();
}

main().catch(console.error);
