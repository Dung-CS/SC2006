/**
 * D-Fence — read-only inventory of what a live demo needs: staff per role, HQ and specialisation,
 * reports and work orders per status and pest, dispatches, clusters and recent account audit.
 *
 *     npx tsx src/tools/demo-inventory.ts
 */
import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';

async function main(): Promise<void> {
  const db = new Database(ConfigLoader.load().get('DATABASE_URL'));
  const show = async (label: string, sql: string): Promise<void> => {
    try {
      console.log(`\n== ${label}`);
      console.table(await db.query(sql));
    } catch (error) {
      console.log(`  (failed: ${(error as Error).message})`);
    }
  };
  try {
    await show('accounts', `SELECT role, specialisation, hq_location, staff_status, count(*)::int n
      FROM account GROUP BY 1,2,3,4 ORDER BY 1,2,3`);
    await show('vehicles', 'SELECT * FROM vehicle LIMIT 3');
    await show('vehicle count', 'SELECT count(*)::int n FROM vehicle');
    await show('reports', `SELECT status, pest_type, count(*)::int n FROM report GROUP BY 1,2 ORDER BY 1,2`);
    await show('work orders', `SELECT status, count(*)::int n FROM work_order GROUP BY 1 ORDER BY 1`);
    await show('staff', `SELECT email, display_name, role, specialisation, hq_location, staff_status, is_active
      FROM account WHERE role <> 'Resident' ORDER BY role, email`);
    await show('work order detail', `SELECT task_type, pest_type, status, priority, scheduled_date::text, assignee_id IS NOT NULL assigned
      FROM work_order ORDER BY scheduled_date`);
    await show('dispatch assignments', `SELECT * FROM dispatch_assignment ORDER BY created_at DESC LIMIT 10`);
    await show('clusters', `SELECT count(*)::int n FROM cluster`);
    await show('priority scores', `SELECT pest_type, tier, count(*)::int n FROM priority_score GROUP BY 1,2 ORDER BY 1,2`);
    await show('observations', `SELECT pest_type, count(*)::int n FROM observation_record GROUP BY 1 ORDER BY 2 DESC`);
    await show('high aedes areas', `SELECT count(*)::int n FROM high_aedes_area`);
    await show('ingestion runs (last 5)', `SELECT * FROM ingestion_run ORDER BY started_at DESC LIMIT 5`);
    await show('account audit (last 20)', `SELECT * FROM audit_record WHERE action ILIKE '%account%' OR action ILIKE '%staff%'
      ORDER BY occurred_at DESC LIMIT 20`);
  } finally {
    await db.close();
  }
}

void main();
