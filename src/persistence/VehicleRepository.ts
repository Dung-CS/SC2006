import { Vehicle } from '../entity/Vehicle';
import { HqLocation } from '../entity/enums';
import { VehicleStore } from '../ports/VehicleStore';
import { Database, Row } from './Database';
import { demoGoodsPlate } from '../entity/SingaporePlate';

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
       cargo_length_cm, cargo_width_cm, cargo_height_cm, seat_capacity, is_available, is_demo, model, photo_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET registration=EXCLUDED.registration, name=EXCLUDED.name,
        hq_location=EXCLUDED.hq_location, max_payload_kg=EXCLUDED.max_payload_kg,
        max_cargo_volume_m3=EXCLUDED.max_cargo_volume_m3, cargo_length_cm=EXCLUDED.cargo_length_cm,
        cargo_width_cm=EXCLUDED.cargo_width_cm, cargo_height_cm=EXCLUDED.cargo_height_cm,
        seat_capacity=EXCLUDED.seat_capacity, is_available=EXCLUDED.is_available, is_demo=EXCLUDED.is_demo,
        model=EXCLUDED.model, photo_url=EXCLUDED.photo_url
      RETURNING *`, [vehicle.id, vehicle.registration, vehicle.name, vehicle.hqLocation,
      vehicle.maxPayloadKg, vehicle.maxCargoVolumeM3, vehicle.cargoLengthCm, vehicle.cargoWidthCm,
      vehicle.cargoHeightCm, vehicle.seatCapacity, vehicle.isAvailable, vehicle.isDemo, vehicle.model ?? null, vehicle.photoUrl ?? null]);
    if (!rows[0]) throw new Error('vehicle save returned no stored row');
    return VehicleRepository.fromRow(rows[0]);
  }

  private static fromRow(row: Row): Vehicle {
    return {
      id: String(row.id), registration: String(row.registration), name: String(row.name),
      model: row.model == null ? null : String(row.model), photoUrl: row.photo_url == null ? null : String(row.photo_url),
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

export type DemoVehicleKind = 'van' | 'pickup';
const DEMO_MODELS: Record<DemoVehicleKind, { model: string; photoUrl: string }> = {
  van: { model: 'Toyota Hiace', photoUrl: '/visuals/vehicles/toyota-hiace.jpg' },
  pickup: { model: 'Toyota Hilux', photoUrl: '/visuals/vehicles/toyota-hilux.jpg' },
};

/** Model, photo and display name for a demo vehicle, e.g. "Toyota Hiace (Central HQ)". */
export function demoVehicleIdentity(kind: DemoVehicleKind, hq: string): { model: string; photoUrl: string; name: string } {
  const { model, photoUrl } = DEMO_MODELS[kind];
  return { model, photoUrl, name: `${model} (${hq.replace(/([a-z])([A-Z])/g, '$1 $2')} HQ)` };
}

/** Run only for an empty registry. Disabled or edited demo entries are never recreated on restart. */
export async function seedDemoVehicles(store: VehicleStore): Promise<void> {
  if ((await store.list()).length > 0) return;
  const taken = new Set<string>();
  const plate = (id: string): string => { const p = demoGoodsPlate(id, taken); taken.add(p); return p; };
  for (const hqLocation of Object.values(HqLocation)) {
    const vanId = `demo-vehicle-${hqLocation}-van`;
    await store.save({ id: vanId, registration: plate(vanId), ...demoVehicleIdentity('van', hqLocation), hqLocation,
      maxPayloadKg: 750, maxCargoVolumeM3: 6, cargoLengthCm: 300, cargoWidthCm: 160, cargoHeightCm: 140, seatCapacity: 3,
      isAvailable: true, isDemo: true });
    const pickupId = `demo-vehicle-${hqLocation}-pickup`;
    await store.save({ id: pickupId, registration: plate(pickupId), ...demoVehicleIdentity('pickup', hqLocation), hqLocation,
      maxPayloadKg: 1000, maxCargoVolumeM3: 3, cargoLengthCm: 240, cargoWidthCm: 150, cargoHeightCm: 100, seatCapacity: 5,
      isAvailable: true, isDemo: true });
  }
}
