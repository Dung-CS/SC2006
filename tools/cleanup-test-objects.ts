import { Database } from '../src/persistence/Database';
import { ConfigLoader } from '../src/config/ConfigLoader';

async function cleanup(reportIds: string[]): Promise<void> {
  if (reportIds.length === 0) {
    console.log('[CLEANUP] No report IDs provided.');
    return;
  }
  const config = ConfigLoader.load();
  const dbUrl = config.get('DATABASE_URL');
  if (!dbUrl) {
    console.error('[CLEANUP] No DATABASE_URL found in config.');
    return;
  }
  const db = new Database(dbUrl);
  try {
    console.log(`[CLEANUP] Deleting ${reportIds.length} test report(s) and dependencies:`, reportIds);
    await db.query('UPDATE report SET work_order_id = NULL WHERE id = ANY($1::uuid[])', [reportIds]);
    await db.query('DELETE FROM work_order WHERE source_report_id = ANY($1::uuid[])', [reportIds]);
    const sc = await db.query('DELETE FROM report_status_change WHERE report_id = ANY($1::uuid[]) RETURNING id', [reportIds]);
    const rp = await db.query('DELETE FROM report_photo WHERE report_id = ANY($1::uuid[]) RETURNING id', [reportIds]);
    const cb = await db.query('DELETE FROM corroboration WHERE report_id = ANY($1::uuid[]) RETURNING id', [reportIds]);
    const rf = await db.query('DELETE FROM referral WHERE report_id = ANY($1::uuid[]) RETURNING id', [reportIds]);
    const dr = await db.query('DELETE FROM report WHERE id = ANY($1::uuid[]) RETURNING id', [reportIds]);
    console.log(`[CLEANUP] Successfully deleted: ${dr.length} reports, ${rp.length} photos, ${sc.length} status changes.`);
  } catch (err) {
    console.error('[CLEANUP] Error during report cleanup:', err);
  } finally {
    await db.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ids = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--purge-snakes')) {
    const config = ConfigLoader.load();
    const db = new Database(config.get('DATABASE_URL'));
    try {
      const snakes = await db.query(
        "SELECT id FROM report WHERE pest_type = 'Snake' OR description ILIKE '%snake%' OR description ILIKE '%python%'"
      );
      const snakeIds = snakes.map((r: any) => r.id);
      if (snakeIds.length > 0) {
        await cleanup(snakeIds);
      } else {
        console.log('[CLEANUP] Zero snake test reports found in database.');
      }
    } finally {
      await db.close();
    }
    return;
  }
  await cleanup(ids);
}

main().catch((err) => {
  console.error('[CLEANUP] Failed:', err);
  process.exit(1);
});
