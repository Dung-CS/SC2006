import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';

async function main(): Promise<void> {
  const url = ConfigLoader.load().get('DATABASE_URL');
  if (!url) {
    console.log('No DATABASE_URL');
    return;
  }
  const db = new Database(url);
  try {
    const cols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'report'");
    console.log('Report columns:', cols.map((c: any) => c.column_name));
  } finally {
    await db.close();
  }
}

void main();
