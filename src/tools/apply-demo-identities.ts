/**
 * Give existing demo vehicles a model, photo, name and Singapore plate, and give CleaningCrew
 * accounts with no display name a fictional full name. Dry run by default.
 *
 *   npx tsx src/tools/apply-demo-identities.ts            (dry run; prints the plan)
 *   npx tsx src/tools/apply-demo-identities.ts --apply    (writes; needs DATABASE_URL)
 *
 * Needs migration 016. Never changes email, role, capability or HQ. The names are fictional demo
 * values and do not describe real NEA staff. Without DATABASE_URL the dry run uses a small
 * in-memory sample so the output can be inspected.
 */
import { pathToFileURL } from 'node:url';
import { ConfigLoader } from '../config/ConfigLoader';
import { Database, Row } from '../persistence/Database';
import { demoVehicleIdentity, DemoVehicleKind } from '../persistence/VehicleRepository';
import { demoGoodsPlate } from '../entity/SingaporePlate';

const NAMES = [
  'Tan Wei Ming', 'Lim Hui Ling', 'Lee Jun Jie', 'Ng Siew Hwee', 'Chua Kai Xiang', 'Goh Mei Qi',
  'Wong Zhi Hao', 'Teo Shu Fen', 'Ong Boon Kiat', 'Koh Li Ting', 'Yeo Chee Keong', 'Chan Pei Shan',
  'Muhammad Faris bin Ismail', 'Nur Aisyah binte Rahman', 'Ahmad Hafiz bin Yusof', 'Siti Nurhaliza binte Osman',
  'Mohamed Irfan bin Abdullah', 'Nurul Huda binte Salleh', 'Hakim bin Zainal', 'Farhana binte Mahmud',
  'Rajesh Kumar s/o Pillai', 'Priya d/o Subramaniam', 'Arun s/o Krishnan', 'Kavitha d/o Muthusamy',
  'Suresh s/o Nair', 'Deepa d/o Raman', 'Vikram s/o Chandran', 'Lakshmi d/o Govindasamy',
  'Daniel Pereira', 'Sharon De Souza', 'Marcus Rozario', 'Jacqueline Sequeira',
  'Gabriel Oliveiro', 'Natalie Westerhout', 'Ryan Shepherdson', 'Corinne Xavier',
];

export interface VehicleRow { id: string; registration: string; name: string; model: string | null; photo_url: string | null;
  hq_location: string; is_demo: boolean }
export interface CrewRow { id: string; email: string; role: string; display_name: string | null }
export interface VehicleChange { id: string; old: string; model: string; photoUrl: string; name: string; registration: string }
export interface CrewChange { id: string; email: string; displayName: string }

function hash(text: string): number {
  let h = 17;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function kindOf(row: VehicleRow): DemoVehicleKind | null {
  const text = `${row.id} ${row.name}`.toLowerCase();
  if (/pickup/.test(text)) return 'pickup';
  if (/van/.test(text)) return 'van';
  return null;
}

export function planVehicles(rows: VehicleRow[]): { changes: VehicleChange[]; skipped: string[] } {
  const taken = new Set(rows.map((r) => r.registration));
  const changes: VehicleChange[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    if (!row.id.startsWith('demo-vehicle-') && !row.is_demo) continue;
    if (!/^DEMO/i.test(row.registration)) { skipped.push(`${row.id}: already has plate ${row.registration}`); continue; }
    const kind = kindOf(row);
    if (!kind) { skipped.push(`${row.id}: cannot tell van from pickup`); continue; }
    const registration = demoGoodsPlate(row.id, taken);
    taken.add(registration);
    changes.push({ id: row.id, old: `${row.name} / ${row.registration}`, registration, ...demoVehicleIdentity(kind, row.hq_location) });
  }
  return { changes, skipped };
}

export function crewNameFor(accountId: string, taken: ReadonlySet<string> = new Set()): string {
  const start = hash(accountId) % NAMES.length;
  for (let i = 0; i < NAMES.length; i += 1) {
    const name = NAMES[(start + i) % NAMES.length]!;
    if (!taken.has(name)) return name;
  }
  return `${NAMES[start]!} ${hash(accountId) % 90 + 10}`;
}

export function planCrew(rows: CrewRow[]): CrewChange[] {
  const taken = new Set(rows.map((r) => r.display_name?.trim()).filter((n): n is string => !!n));
  const changes: CrewChange[] = [];
  for (const row of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    if (row.role !== 'CleaningCrew' || row.display_name?.trim()) continue;
    const displayName = crewNameFor(row.id, taken);
    taken.add(displayName);
    changes.push({ id: row.id, email: row.email, displayName });
  }
  return changes;
}

const ascii = (text: string): string => text.replace(/[^\x20-\x7e]/g, '?');

function printPlan(vehicles: ReturnType<typeof planVehicles>, crew: CrewChange[]): void {
  console.log(`Vehicles to change: ${vehicles.changes.length}`);
  for (const c of vehicles.changes) console.log(ascii(`  ${c.id} | ${c.old} -> ${c.name} | ${c.registration} | ${c.photoUrl}`));
  for (const s of vehicles.skipped) console.log(ascii(`  skipped ${s}`));
  console.log(`Crew to name: ${crew.length}`);
  for (const c of crew) console.log(ascii(`  ${c.id} | ${c.email} | (empty) -> ${c.displayName}`));
}

const SAMPLE_VEHICLES: VehicleRow[] = ['Central', 'SouthWest'].flatMap((hq) => [
  { id: `demo-vehicle-${hq}-van`, registration: `DEMO-${hq.toUpperCase()}-VAN`, name: 'Demo cargo van', model: null, photo_url: null, hq_location: hq, is_demo: true },
  { id: `demo-vehicle-${hq}-pickup`, registration: `DEMO-${hq.toUpperCase()}-PICKUP`, name: 'Demo utility pickup', model: null, photo_url: null, hq_location: hq, is_demo: true },
]);
const SAMPLE_CREW: CrewRow[] = ['a1', 'b2', 'c3'].map((id) => ({ id: `sample-${id}`, email: `${id}@example.test`, role: 'CleaningCrew', display_name: null }));

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = ConfigLoader.load().get('DATABASE_URL');
  if (url === '') {
    if (apply) { console.log('--apply needs DATABASE_URL. Nothing was written.'); process.exitCode = 1; return; }
    console.log('DATABASE_URL is not set: dry run on an in-memory sample.');
    printPlan(planVehicles(SAMPLE_VEHICLES), planCrew(SAMPLE_CREW));
    return;
  }
  const db = new Database(url);
  try {
    const cols = await db.query(`SELECT table_name || '.' || column_name AS c FROM information_schema.columns
      WHERE (table_name = 'account' AND column_name = 'display_name') OR (table_name = 'vehicle' AND column_name IN ('model', 'photo_url'))`);
    if (cols.length < 3) {
      console.log('Migration 016 is not applied (need account.display_name, vehicle.model, vehicle.photo_url). Stopping. Nothing was written.');
      process.exitCode = 1;
      return;
    }
    const vehicles = planVehicles((await db.query('SELECT id, registration, name, model, photo_url, hq_location, is_demo FROM vehicle')).map((r: Row) => ({
      id: String(r.id), registration: String(r.registration), name: String(r.name), model: r.model == null ? null : String(r.model),
      photo_url: r.photo_url == null ? null : String(r.photo_url), hq_location: String(r.hq_location), is_demo: Boolean(r.is_demo) })));
    const crew = planCrew((await db.query('SELECT id, email, role, display_name FROM account')).map((r: Row) => ({
      id: String(r.id), email: String(r.email), role: String(r.role), display_name: r.display_name == null ? null : String(r.display_name) })));
    printPlan(vehicles, crew);
    if (!apply) { console.log('Dry run only. Add --apply to write.'); return; }
    for (const c of vehicles.changes) {
      await db.query('UPDATE vehicle SET model = $2, photo_url = $3, name = $4, registration = $5 WHERE id = $1',
        [c.id, c.model, c.photoUrl, c.name, c.registration]);
    }
    for (const c of crew) {
      await db.query(`UPDATE account SET display_name = $2 WHERE id = $1 AND role = 'CleaningCrew' AND (display_name IS NULL OR display_name = '')`,
        [c.id, c.displayName]);
    }
    console.log(`Applied: ${vehicles.changes.length} vehicles, ${crew.length} crew.`);
  } finally { await db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(String(e)); process.exitCode = 1; });
