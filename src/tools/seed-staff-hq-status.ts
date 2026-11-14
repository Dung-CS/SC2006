import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';
import { HqLocation, StaffSpecialisation, StaffStatus } from '../entity/enums';

async function main() {
  const url = ConfigLoader.load().get('DATABASE_URL');
  const db = new Database(url);

  const crewRows = (await db.query(
    "SELECT id, email FROM account WHERE role = 'CleaningCrew' ORDER BY email ASC",
  )) as Array<{ id: string; email: string }>;

  console.log(`Found ${crewRows.length} CleaningCrew accounts to assign.`);

  const hqs = Object.values(HqLocation);
  const specs = Object.values(StaffSpecialisation);

  let updated = 0;
  for (let i = 0; i < crewRows.length; i++) {
    const member = crewRows[i]!;
    const hq = hqs[i % hqs.length]!;
    const spec = specs[Math.floor(i / hqs.length) % specs.length]!;

    // Distribute statuses: 70% Available, 20% OnCall, 10% Unavailable
    let status: StaffStatus = StaffStatus.Available;
    const mod = i % 10;
    if (mod === 7 || mod === 8) {
      status = StaffStatus.OnCall;
    } else if (mod === 9) {
      status = StaffStatus.Unavailable;
    }

    const lagHours = status === StaffStatus.OnCall ? 2 : 0;

    await db.query(
      `UPDATE account 
       SET hq_location = $1, specialisation = $2, staff_status = $3, on_call_lag_hours = $4 
       WHERE id = $5`,
      [hq, spec, status, lagHours, member.id],
    );
    updated++;
  }

  console.log(`Assigned ${updated} crew accounts to HQ, specialisation, and status.`);

  // Verify distribution
  const breakdown = await db.query(
    `SELECT hq_location, specialisation, staff_status, count(*)::int as count 
     FROM account WHERE role = 'CleaningCrew' 
     GROUP BY hq_location, specialisation, staff_status 
     ORDER BY hq_location, specialisation, staff_status`,
  );
  console.log('New breakdown sample:', breakdown.slice(0, 10));

  await db.close();
}

main().catch(console.error);
