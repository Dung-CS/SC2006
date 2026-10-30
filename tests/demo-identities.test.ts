import { describe, expect, it } from 'vitest';
import { crewNameFor, planCrew, planVehicles, VehicleRow } from '../src/tools/apply-demo-identities';
import { demoGoodsPlate, isValidGoodsPlate } from '../src/entity/SingaporePlate';
import { InMemoryVehicleStore, seedDemoVehicles } from '../src/persistence/VehicleRepository';

const row = (id: string, registration: string, name: string, hq = 'Central'): VehicleRow =>
  ({ id, registration, name, model: null, photo_url: null, hq_location: hq, is_demo: true });

describe('apply-demo-identities planning', () => {
  it('plans models, photos, names and distinct valid plates; skips real plates', () => {
    const { changes, skipped } = planVehicles([
      row('demo-vehicle-Central-van', 'DEMO-CENTRAL-VAN', 'Demo cargo van'),
      row('demo-vehicle-Central-pickup', 'DEMO-CENTRAL-PICKUP', 'Demo utility pickup'),
      row('demo-vehicle-NorthEast-van', demoGoodsPlate('real'), 'Toyota Hiace', 'NorthEast'),
    ]);
    expect(changes.map((c) => c.name)).toEqual(['Toyota Hiace', 'Toyota Hilux']);
    expect(changes.map((c) => c.photoUrl)).toEqual(['/visuals/vehicles/toyota-hiace.jpg', '/visuals/vehicles/toyota-hilux.jpg']);
    expect(new Set(changes.map((c) => c.registration)).size).toBe(2);
    expect(changes.every((c) => isValidGoodsPlate(c.registration))).toBe(true);
    expect(skipped).toHaveLength(1);
  });
  it('replaces RESP29 demo plates, keeps valid ones, defaults to van', () => {
    const { changes, skipped } = planVehicles([
      row('1ad2f2cc-7e3e-4627-a53c-5b6cb61f4af3', 'RESP29-CENTRAL-01', '78C'),
      row('v2', demoGoodsPlate('real'), 'Toyota Hiace'),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.name).toBe('Toyota Hiace');
    expect(isValidGoodsPlate(changes[0]!.registration)).toBe(true);
    expect(skipped).toHaveLength(1);
  });
  it('gives 600 crew unique plain names that match their gender markers', () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({ id: `acct-${i}-${i * 7919}`, email: `c${i}@x.test`, role: 'CleaningCrew', display_name: null }));
    const names = planCrew(rows).map((c) => c.displayName);
    expect(new Set(names).size).toBe(600);
    expect(names.every((n) => !/\d/.test(n))).toBe(true);
    const male = /^(Muhammad Faris|Ahmad Hafiz|Mohamed Irfan|Hakim|Zulkifli|Azman|Razali|Muhammad Syafiq|Danish|Aiman|Haziq|Amir) bin /;
    const female = /^(Nur Aisyah|Siti Nurhaliza|Nurul Huda|Farhana|Aminah|Zahra|Liyana|Balqis|Sofia|Khadijah|Rahimah|Atiqah) binte /;
    for (const n of names.filter((x) => / bin(te)? /.test(x))) expect(n.includes(' binte ') ? female.test(n) : male.test(n)).toBe(true);
    const sons = names.filter((n) => / s\/o /.test(n)).map((n) => n.split(' ')[0]);
    const daughters = names.filter((n) => / d\/o /.test(n)).map((n) => n.split(' ')[0]);
    expect(sons.some((g) => ['Priya', 'Kavitha', 'Deepa', 'Lakshmi', 'Anita', 'Meena', 'Revathi', 'Sangeetha', 'Devi', 'Malathi', 'Shanti', 'Uma'].includes(g!))).toBe(false);
    expect(daughters.some((g) => ['Rajesh', 'Arun', 'Suresh', 'Vikram', 'Kumar', 'Ravi', 'Anand', 'Dinesh', 'Mohan', 'Karthik', 'Gopal', 'Vijay'].includes(g!))).toBe(false);
    expect(sons.length).toBeGreaterThan(0);
    expect(daughters.length).toBeGreaterThan(0);
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
