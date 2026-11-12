/**
 * D-Fence — stock the live database for a demonstration: crew in every HQ and capability, two
 * more vehicles per HQ, and verified reports across all five regions with varied pests and task
 * types. Dry run by default.
 *
 *     npx tsx src/tools/seed-demo-stock.ts            # say what would be added, change nothing
 *     npx tsx src/tools/seed-demo-stock.ts --apply    # add it (idempotent)
 *     npx tsx src/tools/seed-demo-stock.ts --remove   # delete what this tool added, where unused
 *
 * Every row is recognisable, so it can be removed again: crew addresses end in
 * `@stock.d-fence.local`, vehicles are `demo-vehicle-<HQ>-<kind>-2` with `is_demo`, and reports
 * carry the moderation reason below and deterministic ids. The crew account used to present the
 * demo (`crew.demo@d-fence.local`) is relabelled so it cannot be confused with stock crew.
 *
 * Stock crew have no password and cannot sign in. Run `apply-demo-identities.ts --apply` after
 * this to give them fictional names.
 */
import { createHash } from 'node:crypto';
import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';
import { demoVehicleIdentity, DemoVehicleKind } from '../persistence/VehicleRepository';
import { demoGoodsPlate } from '../entity/SingaporePlate';
import { HqLocation, StaffSpecialisation, StaffStatus } from '../entity/enums';

const STOCK_DOMAIN = '@stock.d-fence.local';
const STOCK_REASON = 'Verified by municipal officer (demo stock)';
const DEMO_CREW_EMAIL = 'crew.demo@d-fence.local';
const DEMO_CREW_NAME = 'DEMO CREW (sign in as this) - Ahmad Faizal';

/** A stable UUID from a label, so a rerun updates rather than duplicates. */
const stableId = (label: string): string => {
  const h = createHash('sha256').update(`dfence-demo-stock:${label}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const PLACES: Record<HqLocation, Array<[string, number, number]>> = {
  Central: [['Toa Payoh Lorong 1', 1.333, 103.849], ['Bishan Street 13', 1.35, 103.848], ['Kim Keat Avenue', 1.329, 103.856],
    ['Balestier Road', 1.326, 103.85], ['Novena Terrace', 1.32, 103.844], ['Whampoa Drive', 1.322, 103.857]],
  NorthEast: [['Hougang Avenue 8', 1.379, 103.886], ['Sengkang East Way', 1.392, 103.895], ['Punggol Field', 1.404, 103.902],
    ['Serangoon Central', 1.354, 103.873], ['Ang Mo Kio Avenue 10', 1.364, 103.854], ['Buangkok Crescent', 1.383, 103.88]],
  NorthWest: [['Woodlands Avenue 6', 1.44, 103.8], ['Yishun Ring Road', 1.429, 103.835], ['Sembawang Drive', 1.449, 103.82],
    ['Choa Chu Kang Avenue 4', 1.385, 103.745], ['Bukit Panjang Ring Road', 1.379, 103.762], ['Woodlands Street 41', 1.433, 103.775]],
  SouthEast: [['Bedok North Street 1', 1.333, 103.93], ['Tampines Street 21', 1.353, 103.952], ['Pasir Ris Drive 6', 1.374, 103.952],
    ['Geylang Serai', 1.317, 103.898], ['Marine Parade Road', 1.303, 103.907], ['Simei Street 1', 1.343, 103.953]],
  SouthWest: [['Jurong West Street 52', 1.35, 103.718], ['Clementi Avenue 3', 1.315, 103.765], ['Bukit Batok West Avenue 6', 1.349, 103.75],
    ['Jurong East Street 21', 1.333, 103.742], ['Boon Lay Drive', 1.346, 103.712], ['West Coast Road', 1.301, 103.765]],
};

/** Pest, report type, setting, and what a resident would write. Rotated across regions for variety. */
const CASES: Array<[string, string, 'Indoor' | 'Outdoor', string]> = [
  ['Mosquito', 'StandingWater', 'Outdoor', 'Stagnant water in flower pot trays and a choked roof gutter, larvae visible.'],
  ['Rat', 'BlockedDrain', 'Outdoor', 'Rats running along a blocked drain beside the hawker centre after closing.'],
  ['Cockroach', 'UnclearedRefuse', 'Indoor', 'Cockroaches around the refuse chute on several floors.'],
  ['Fly', 'UnclearedRefuse', 'Outdoor', 'Swarm of flies over overflowing bins at the bin centre.'],
  ['Termite', 'Other', 'Indoor', 'Mud tubes along the door frame and hollow-sounding skirting boards.'],
  ['BeeWasp', 'OvergrownVegetation', 'Outdoor', 'Large wasp nest in an overgrown tree beside the playground.'],
  ['Pigeon', 'UnclearedRefuse', 'Outdoor', 'Pigeons feeding on dumped food waste at the void deck.'],
  ['Snake', 'OvergrownVegetation', 'Outdoor', 'Snake seen in long grass next to the park connector.'],
  ['Ant', 'Other', 'Indoor', 'Fire ant mounds in the grass verge, residents bitten.'],
  ['Mosquito', 'BlockedDrain', 'Outdoor', 'Blocked scupper drain holding water, mosquitoes biting in the evening.'],
  ['HouseCrow', 'UnclearedRefuse', 'Outdoor', 'Crows tearing open refuse bags at the loading bay.'],
  ['Macaque', 'UnclearedRefuse', 'Outdoor', 'Macaques raiding bins near the nature park edge.'],
];

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const remove = process.argv.includes('--remove');
  const db = new Database(ConfigLoader.load().get('DATABASE_URL'));
  try {
    if (remove) {
      const reports = await db.query(`DELETE FROM report WHERE moderation_reason = $1 AND work_order_id IS NULL RETURNING id`, [STOCK_REASON]);
      const crew = await db.query(`DELETE FROM account a WHERE email LIKE $1 AND NOT EXISTS
        (SELECT 1 FROM work_order w WHERE w.assignee_id = a.id) RETURNING id`, [`%${STOCK_DOMAIN}`]);
      const vehicles = await db.query(`DELETE FROM vehicle v WHERE id LIKE 'demo-vehicle-%-2' AND NOT EXISTS
        (SELECT 1 FROM dispatch_assignment d WHERE d.vehicle_id = v.id) RETURNING id`);
      console.log(`removed ${reports.length} reports, ${crew.length} crew, ${vehicles.length} vehicles (rows still in use were kept)`);
      return;
    }

    const crew: Array<[string, HqLocation, StaffSpecialisation, StaffStatus]> = [];
    for (const hq of Object.values(HqLocation)) {
      for (const spec of Object.values(StaffSpecialisation)) {
        for (const n of [1, 2]) crew.push([`crew.${hq}.${spec}.${n}${STOCK_DOMAIN}`.toLowerCase(), hq, spec, StaffStatus.Available]);
      }
      crew.push([`crew.${hq}.vectorcontrol.oncall${STOCK_DOMAIN}`.toLowerCase(), hq, StaffSpecialisation.VectorControl, StaffStatus.OnCall]);
    }

    const plates = new Set((await db.query(`SELECT registration FROM vehicle`)).map((r) => String(r.registration)));
    const vehicles = Object.values(HqLocation).flatMap((hq) => (['van', 'pickup'] as DemoVehicleKind[]).map((kind) => {
      const id = `demo-vehicle-${hq}-${kind}-2`;
      const plate = demoGoodsPlate(id, plates);
      plates.add(plate);
      return { id, hq, kind, plate, ...demoVehicleIdentity(kind, hq) };
    }));

    const reports = Object.values(HqLocation).flatMap((hq, region) => PLACES[hq].map(([place, lat, lng], k) => {
      const [pest, type, setting, text] = CASES[(region * 5 + k) % CASES.length]!;
      return { id: stableId(`${hq}:${place}`), hq, place, lat, lng, pest, type, setting, text, corroborations: (region + k) % 4 };
    }));

    console.log(`${apply ? 'Adding' : 'Would add'} ${crew.length} stock crew, ${vehicles.length} vehicles, ${reports.length} verified reports`);
    for (const r of reports) console.log(`  ${r.hq.padEnd(9)} ${r.pest.padEnd(10)} ${r.type.padEnd(19)} ${r.place}`);
    console.log(`  relabel ${DEMO_CREW_EMAIL} -> "${DEMO_CREW_NAME}"`);
    if (!apply) return;

    for (const [email, hq, spec, status] of crew) {
      await db.query(`INSERT INTO account (email, role, email_verified, specialisation, hq_location, staff_status, on_call_lag_hours)
        VALUES ($1, 'CleaningCrew', true, $2, $3, $4, 2)
        ON CONFLICT (email) DO UPDATE SET specialisation = EXCLUDED.specialisation, hq_location = EXCLUDED.hq_location,
          staff_status = EXCLUDED.staff_status, is_active = true`, [email, spec, hq, status]);
    }
    for (const v of vehicles) {
      const big = v.kind === 'van';
      await db.query(`INSERT INTO vehicle (id, registration, name, hq_location, max_payload_kg, max_cargo_volume_m3,
          cargo_length_cm, cargo_width_cm, cargo_height_cm, seat_capacity, is_available, is_demo, model, photo_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 3, true, true, $10, $11)
        ON CONFLICT (id) DO NOTHING`,
      [v.id, v.plate, v.name, v.hq, big ? 750 : 1000, big ? 6 : 3, big ? 300 : 240, big ? 160 : 150, big ? 140 : 100, v.model, v.photoUrl]);
    }
    for (const r of reports) {
      await db.query(`INSERT INTO report (id, point, type, pest_type, location_context, description, status,
          locality_binding, corroboration_count, submitted_at, moderated_at, moderation_reason)
        VALUES ($1, ST_MakePoint($3, $2)::geography, $4, $5, $6, $7, 'Verified', $8, $9,
          NOW() - INTERVAL '26 hours', NOW() - INTERVAL '20 hours', $10)
        ON CONFLICT (id) DO NOTHING`,
      [r.id, r.lat, r.lng, r.type, r.pest, r.setting, `${r.text} Near ${r.place}.`, r.place, r.corroborations, STOCK_REASON]);
      await db.query(`INSERT INTO report_status_change (report_id, from_status, to_status, changed_at)
        SELECT $1, 'Submitted', 'Verified', NOW() - INTERVAL '20 hours'
        WHERE NOT EXISTS (SELECT 1 FROM report_status_change WHERE report_id = $1)`, [r.id]);
    }
    await db.query(`UPDATE account SET display_name = $2 WHERE email = $1`, [DEMO_CREW_EMAIL, DEMO_CREW_NAME]);
    console.log('done');
  } finally {
    await db.close();
  }
}

void main();
