import { describe, expect, it } from 'vitest';
import { crewNameFor, planCrew, planVehicles, VehicleRow } from '../src/tools/apply-demo-identities';
import { isValidGoodsPlate } from '../src/entity/SingaporePlate';
import { InMemoryVehicleStore, seedDemoVehicles } from '../src/persistence/VehicleRepository';

const row = (id: string, registration: string, name: string, hq = 'Central'): VehicleRow =>
  ({ id, registration, name, model: null, photo_url: null, hq_location: hq, is_demo: true });

describe('apply-demo-identities planning', () => {
  it('plans models, photos, names and distinct valid plates; skips real plates', () => {
    const { changes, skipped } = planVehicles([
      row('demo-vehicle-Central-van', 'DEMO-CENTRAL-VAN', 'Demo cargo van'),
      row('demo-vehicle-Central-pickup', 'DEMO-CENTRAL-PICKUP', 'Demo utility pickup'),
      row('demo-vehicle-NorthEast-van', 'GBC 4821 K', 'Toyota Hiace', 'NorthEast'),
    ]);
    expect(changes.map((c) => c.name)).toEqual(['Toyota Hiace (Central HQ)', 'Toyota Hilux (Central HQ)']);
    expect(changes.map((c) => c.photoUrl)).toEqual(['/visuals/vehicles/toyota-hiace.jpg', '/visuals/vehicles/toyota-hilux.jpg']);
    expect(new Set(changes.map((c) => c.registration)).size).toBe(2);
    expect(changes.every((c) => isValidGoodsPlate(c.registration))).toBe(true);
    expect(skipped).toHaveLength(1);
  });
  it('names only unnamed crew, deterministically', () => {
    const rows = [
      { id: 'c1', email: 'a@x.test', role: 'CleaningCrew', display_name: null },
      { id: 'c2', email: 'b@x.test', role: 'CleaningCrew', display_name: 'Already Named' },
      { id: 'm1', email: 'm@x.test', role: 'OperationsManager', display_name: null },
    ];
    const first = planCrew(rows);
    expect(first.map((c) => c.id)).toEqual(['c1']);
    expect(planCrew(rows)).toEqual(first);
    expect(crewNameFor('c1')).toBe(crewNameFor('c1'));
  });
  it('seeds models, photos and valid distinct plates for new installs', async () => {
    const store = new InMemoryVehicleStore();
    await seedDemoVehicles(store);
    const all = await store.list();
    expect(all).toHaveLength(10);
    expect(all.every((v) => v.isDemo && v.photoUrl && v.model && isValidGoodsPlate(v.registration))).toBe(true);
    expect(new Set(all.map((v) => v.registration)).size).toBe(10);
  });
});
