import { Vehicle } from '../entity/Vehicle';
import { HqLocation } from '../entity/enums';
import { VehicleStore } from '../ports/VehicleStore';
import { Database, Row } from './Database';

export class VehicleRepository implements VehicleStore {
  constructor(private readonly db: Database) {}

  async list(): Promise<Vehicle[]> {
    return (await this.db.query('SELECT * FROM vehicle ORDER BY hq_location, registration')).map(VehicleRepository.fromRow);
  }

  async findById(id: string): Promise<Vehicle | null> {
    const rows = await this.db.query('SELECT * FROM vehicle WHERE id = $1', [id]);
    return rows[0] ? VehicleRepository.fromRow(rows[0]) : null;
  }

  async save(vehicle: Vehicle): Promise<Vehicle> {
    const rows = await this.db.query(`INSERT INTO vehicle
      (id, registration, name, hq_location, max_payload_kg, max_cargo_volume_m3,
       cargo_length_cm, cargo_width_cm, cargo_height_cm, seat_capacity, is_available, is_demo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET registration=EXCLUDED.registration, name=EXCLUDED.name,
        hq_location=EXCLUDED.hq_location, max_payload_kg=EXCLUDED.max_payload_kg,
        max_cargo_volume_m3=EXCLUDED.max_cargo_volume_m3, cargo_length_cm=EXCLUDED.cargo_length_cm,
        cargo_width_cm=EXCLUDED.cargo_width_cm, cargo_height_cm=EXCLUDED.cargo_height_cm,
        seat_capacity=EXCLUDED.seat_capacity, is_available=EXCLUDED.is_available, is_demo=EXCLUDED.is_demo
      RETURNING *`, [vehicle.id, vehicle.registration, vehicle.name, vehicle.hqLocation,
      vehicle.maxPayloadKg, vehicle.maxCargoVolumeM3, vehicle.cargoLengthCm, vehicle.cargoWidthCm,
      vehicle.cargoHeightCm, vehicle.seatCapacity, vehicle.isAvailable, vehicle.isDemo]);
    if (!rows[0]) throw new Error('vehicle save returned no stored row');
    return VehicleRepository.fromRow(rows[0]);
  }

  private static fromRow(row: Row): Vehicle {
    return {
      id: String(row.id), registration: String(row.registration), name: String(row.name),
      hqLocation: row.hq_location as HqLocation, maxPayloadKg: Number(row.max_payload_kg),
      maxCargoVolumeM3: Number(row.max_cargo_volume_m3), cargoLengthCm: Number(row.cargo_length_cm),
      cargoWidthCm: Number(row.cargo_width_cm), cargoHeightCm: Number(row.cargo_height_cm),
      seatCapacity: Number(row.seat_capacity), isAvailable: Boolean(row.is_available), isDemo: Boolean(row.is_demo),
    };
  }
}

export class InMemoryVehicleStore implements VehicleStore {
  private readonly vehicles = new Map<string, Vehicle>();
  async list(): Promise<Vehicle[]> {
    return [...this.vehicles.values()].map((v) => ({ ...v })).sort((a, b) =>
      a.hqLocation.localeCompare(b.hqLocation) || a.registration.localeCompare(b.registration));
  }
  async findById(id: string): Promise<Vehicle | null> {
    const vehicle = this.vehicles.get(id);
    return vehicle ? { ...vehicle } : null;
  }
  async save(vehicle: Vehicle): Promise<Vehicle> {
    if ([...this.vehicles.values()].some((v) => v.id !== vehicle.id && v.registration === vehicle.registration)) {
      throw new Error('vehicle registration already exists');
    }
    this.vehicles.set(vehicle.id, { ...vehicle });
    return { ...vehicle };
  }
}

export function createVehicleStore(db: Database | null): VehicleStore {
  return db ? new VehicleRepository(db) : new InMemoryVehicleStore();
}

/** Run only for an empty registry. Disabled or edited demo entries are never recreated on restart. */
export async function seedDemoVehicles(store: VehicleStore): Promise<void> {
  if ((await store.list()).length > 0) return;
  for (const hqLocation of Object.values(HqLocation)) {
    await store.save({ id: `demo-vehicle-${hqLocation}-van`, registration: `DEMO-${hqLocation.toUpperCase()}-VAN`,
      name: 'Demo cargo van', hqLocation, maxPayloadKg: 750, maxCargoVolumeM3: 6,
      cargoLengthCm: 300, cargoWidthCm: 160, cargoHeightCm: 140, seatCapacity: 3,
      isAvailable: true, isDemo: true });
    await store.save({ id: `demo-vehicle-${hqLocation}-pickup`, registration: `DEMO-${hqLocation.toUpperCase()}-PICKUP`,
      name: 'Demo utility pickup', hqLocation, maxPayloadKg: 1000, maxCargoVolumeM3: 3,
      cargoLengthCm: 240, cargoWidthCm: 150, cargoHeightCm: 100, seatCapacity: 5,
      isAvailable: true, isDemo: true });
  }
}
