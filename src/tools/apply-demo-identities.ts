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
import { demoGoodsPlate, isValidPlate } from '../entity/SingaporePlate';

const words = (text: string): string[] => text.split(/\s+/);
const CN_SURNAME = words('Tan Lim Lee Ng Chua Goh Wong Teo Ong Koh Yeo Chan Lau Low Sim Chew Foo Heng Seah Toh Phua Quek Ho Yap');
const CN_GIVEN = words('Wei Ming Hui Ling Jun Jie Siew Hwee Kai Xiang Mei Qi Zhi Hao Shu Fen Boon Kiat Li Ting Chee Keong Pei Shan Yi Xuan Jia Wen Xin Zi Han');
const MALE = ['Muhammad Faris', 'Ahmad Hafiz', 'Mohamed Irfan', 'Hakim', 'Zulkifli', 'Azman', 'Razali', 'Muhammad Syafiq', 'Danish', 'Aiman', 'Haziq', 'Amir'];
const FEMALE = ['Nur Aisyah', 'Siti Nurhaliza', 'Nurul Huda', 'Farhana', 'Aminah', 'Zahra', 'Liyana', 'Balqis', 'Sofia', 'Khadijah', 'Rahimah', 'Atiqah'];
const MY_FATHER = words('Ismail Rahman Yusof Osman Abdullah Salleh Zainal Mahmud Hamid Latiff Ibrahim Jaafar');
const IN_MALE = words('Rajesh Arun Suresh Vikram Kumar Ravi Anand Dinesh Mohan Karthik Gopal Vijay');
const IN_FEMALE = words('Priya Kavitha Deepa Lakshmi Anita Meena Revathi Sangeetha Devi Malathi Shanti Uma');
const IN_FATHER = words('Pillai Krishnan Subramaniam Muthusamy Nair Raman Chandran Govindasamy Rajan Suppiah Balakrishnan Naidu');
const EU_GIVEN = words('Daniel Sharon Marcus Jacqueline Gabriel Natalie Ryan Corinne Joshua Vanessa Dominic Clarice');
const EU_SURNAME = words('Pereira De-Souza Rozario Sequeira Oliveiro Westerhout Shepherdson Xavier Fernandez Rodrigues Gomes Lazaroo');

/** Mixes a number so that neighbouring inputs pick unrelated names. */
function mix(n: number): number {
  let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
const pick = <T>(list: readonly T[], n: number): T => list[n % list.length]!;

/** Nth candidate name: one of four communities, built from given names and surnames. No digits. */
function candidate(seed: number): string {
  const a = mix(seed), b = mix(a + 1), c = mix(b + 1), d = mix(c + 1);
  switch (a % 4) {
    case 0: return `${pick(CN_SURNAME, b)} ${pick(CN_GIVEN, c)} ${pick(CN_GIVEN, d)}`;
    case 1: { const f = b % 2 === 1; return `${pick(f ? FEMALE : MALE, c)} ${f ? 'binte' : 'bin'} ${pick(MY_FATHER, d)}`; }
    case 2: { const f = b % 2 === 1; return `${pick(f ? IN_FEMALE : IN_MALE, c)} ${f ? 'd/o' : 's/o'} ${pick(IN_FATHER, d)}`; }
    default: return `${pick(EU_GIVEN, b)} ${pick(EU_SURNAME, c).replace('-', ' ')}`;
  }
}

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

/** Pickup if the id, name or plate says so; otherwise van (the usual response vehicle). */
export function kindOf(row: VehicleRow): DemoVehicleKind {
  return /pickup/i.test(`${row.id} ${row.name} ${row.registration}`) ? 'pickup' : 'van';
}

export function planVehicles(rows: VehicleRow[]): { changes: VehicleChange[]; skipped: string[] } {
  const taken = new Set(rows.map((r) => r.registration));
  const changes: VehicleChange[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    if (!row.id.startsWith('demo-vehicle-') && !row.is_demo) continue;
    if (isValidPlate(row.registration)) { skipped.push(`${row.id}: already has plate ${row.registration}`); continue; }
    const registration = demoGoodsPlate(row.id, taken);
    taken.add(registration);
    const identity = demoVehicleIdentity(kindOf(row), row.hq_location);
    changes.push({ id: row.id, old: `${row.name} / ${row.registration}`, registration, ...identity, name: identity.model });
  }
  return { changes, skipped };
}

export function crewNameFor(accountId: string, taken: ReadonlySet<string> = new Set()): string {
  const start = hash(accountId);
  for (let i = 0; i < 100000; i += 1) {
    const name = candidate(start + i);
    if (!taken.has(name)) return name;
  }
  throw new Error('no free crew name');
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
