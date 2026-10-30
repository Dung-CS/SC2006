import { describe, expect, it, vi } from 'vitest';
import { VehicleController, VehicleNotFound, VehicleRejected } from '../src/control/VehicleController';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { Principal } from '../src/control/Principal';
import { InMemoryAuditStore } from '../src/persistence/memory/InMemoryStores';
import { InMemoryVehicleStore, seedDemoVehicles, VehicleRepository } from '../src/persistence/VehicleRepository';
import { Database } from '../src/persistence/Database';
import { HqLocation, Role } from '../src/entity/enums';
import { Vehicle } from '../src/entity/Vehicle';
import { VehicleRoutes } from '../src/boundary/http/VehicleRoutes';
import { Request, Response } from '../src/boundary/http/RouteHandler';

const manager = new Principal('manager', Role.OperationsManager, 'session');
const resident = new Principal('resident', Role.Resident, 'resident-session');
const draft = () => ({ registration: 'SG-01', name: 'Cargo van', hqLocation: HqLocation.Central,
  maxPayloadKg: 750, maxCargoVolumeM3: 6, cargoLengthCm: 300, cargoWidthCm: 160, cargoHeightCm: 140,
  seatCapacity: 3, isAvailable: true, isDemo: false });
const fixture = () => {
  const ac = new AccessControlService(new AccessPolicy(), new InMemoryAuditStore());
  const store = new InMemoryVehicleStore();
  const changed = vi.fn();
  return { ac, store, changed, controller: new VehicleController(ac, store, changed) };
};

describe('HQ vehicle registry', () => {
  it('stores model/photo metadata and preserves it during a legacy capacity edit', async () => {
    const f = fixture();
    const saved = await f.controller.save({ ...draft(), model: 'Toyota Hiace', photoUrl: '/visuals/vehicles/toyota-hiace.jpg' }, manager);
    const edited = await f.controller.save({ ...draft(), maxPayloadKg: 600 }, manager, saved.id);
    expect(edited).toMatchObject({ model: 'Toyota Hiace', photoUrl: '/visuals/vehicles/toyota-hiace.jpg', maxPayloadKg: 600 });
    for (const photoUrl of ['javascript:alert(1)', 'http://example.test/car.jpg', '//example.test/car.jpg', '/\\example.test/car.jpg', 'https://user:password@example.test/car.jpg']) {
      await expect(f.controller.save({ ...draft(), photoUrl }, manager, saved.id)).rejects.toThrow(VehicleRejected);
    }
    expect((await f.store.findById(saved.id))?.model).toBe('Toyota Hiace');
  });
  it('creates and edits a vehicle, retains it when unavailable and signals replanning', async () => {
    const f = fixture();
    const saved = await f.controller.save(draft(), manager);
    expect(saved.id).toBeTruthy();
    const edited = await f.controller.save({ ...draft(), hqLocation: HqLocation.NorthEast,
      maxPayloadKg: 600, isAvailable: false }, manager, saved.id);
    expect(edited).toMatchObject({ id: saved.id, hqLocation: HqLocation.NorthEast, maxPayloadKg: 600, isAvailable: false });
    expect(await f.controller.list(manager)).toEqual([edited]);
    expect(f.changed).toHaveBeenCalledTimes(2);
  });

  it('keeps registry mutations and reads manager-only', async () => {
    const f = fixture();
    await expect(f.controller.list(resident)).rejects.toThrow(/not authorised/i);
    await expect(f.controller.save(draft(), resident)).rejects.toThrow(/not authorised/i);
    expect(await f.store.list()).toEqual([]);
  });

  it('rejects non-finite/non-positive capacity, missing fields, fractional seats and impossible volume before saving', async () => {
    const f = fixture();
    for (const value of [0, -1, NaN, Infinity, '750']) {
      await expect(f.controller.save({ ...draft(), maxPayloadKg: value }, manager)).rejects.toThrow(VehicleRejected);
    }
    for (const change of [{ seatCapacity: 1.5 }, { maxCargoVolumeM3: 7 }, { registration: ' ' },
      { hqLocation: 'Unknown' }, { isAvailable: 'yes' }, { cargoWidthCm: 0 }]) {
      await expect(f.controller.save({ ...draft(), ...change }, manager)).rejects.toThrow(VehicleRejected);
    }
    expect(await f.store.list()).toHaveLength(0);
    expect(f.changed).not.toHaveBeenCalled();
  });

  it('rejects a missing vehicle and duplicate case-insensitive registrations without overwriting', async () => {
    const f = fixture();
    const saved = await f.controller.save(draft(), manager);
    await expect(f.controller.save({ ...draft(), registration: 'sg-01' }, manager)).rejects.toThrow(/already exists/);
    await expect(f.controller.save(draft(), manager, 'absent')).rejects.toThrow(VehicleNotFound);
    expect(await f.store.list()).toEqual([saved]);
  });

  it('seeds two explicitly labelled different-capacity demo vehicles per HQ exactly once', async () => {
    const store = new InMemoryVehicleStore();
    await seedDemoVehicles(store);
    const vehicles = await store.list();
    expect(vehicles).toHaveLength(10);
    expect(vehicles.every((v) => v.isDemo && v.name.startsWith('Toyota') && /^G[A-Z]{2} \d{4} [A-Z]$/.test(v.registration))).toBe(true);
    for (const hq of Object.values(HqLocation)) {
      const local = vehicles.filter((v) => v.hqLocation === hq);
      expect(local).toHaveLength(2);
      expect(new Set(local.map((v) => v.maxPayloadKg)).size).toBe(2);
    }
    await store.save({ ...vehicles[0]!, isAvailable: false });
    await seedDemoVehicles(store);
    expect(await store.list()).toHaveLength(10);
    expect((await store.findById(vehicles[0]!.id))?.isAvailable).toBe(false);
  });

  it('never adds demo rows to an existing actual fleet and returns independent memory snapshots', async () => {
    const f = fixture();
    const saved = await f.controller.save(draft(), manager);
    const copy = await f.store.findById(saved.id);
    copy!.maxPayloadKg = 1;
    await seedDemoVehicles(f.store);
    expect(await f.store.list()).toEqual([saved]);
  });

  it('writes every vehicle field in Postgres and maps numeric capacities back', async () => {
    const vehicle: Vehicle = { id: 'v1', ...draft(), model: 'Toyota Hiace', photoUrl: '/visuals/vehicles/toyota-hiace.jpg' };
    const row = { id: vehicle.id, registration: vehicle.registration, name: vehicle.name, hq_location: vehicle.hqLocation,
      max_payload_kg: '750', max_cargo_volume_m3: '6', cargo_length_cm: '300', cargo_width_cm: '160', cargo_height_cm: '140',
      seat_capacity: 3, is_available: true, is_demo: false, model: vehicle.model, photo_url: vehicle.photoUrl };
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => [row]);
    const repo = new VehicleRepository({ query } as unknown as Database);
    expect(await repo.save(vehicle)).toEqual(vehicle);
    expect(query.mock.calls[0]?.[1]).toEqual(['v1', 'SG-01', 'Cargo van', 'Central', 750, 6, 300, 160, 140, 3, true, false, vehicle.model, vehicle.photoUrl]);
    expect(await repo.findById('v1')).toEqual(vehicle);
    expect(await repo.list()).toEqual([vehicle]);
  });
});

function response() {
  const output = { code: 200, body: undefined as unknown };
  const res: Response = { status(code) { output.code = code; return res; }, json(body) { output.body = body; }, text() {} };
  return { output, res };
}
const req = (route: string, body: unknown = undefined, id?: string): Request => ({
  headers: { authorization: 'Bearer session' }, params: { route, ...(id ? { id } : {}) }, body,
});

describe('Vehicle HTTP boundary', () => {
  it('returns a useful invalid-capacity refusal, creates and updates without delete', async () => {
    const f = fixture();
    const routes = new VehicleRoutes(f.ac, f.controller);
    routes.useResolver({ resolve: async () => manager });
    const invalid = response();
    await routes.handle(req('/api/ops/vehicles', { ...draft(), maxPayloadKg: -1 }), invalid.res);
    expect(invalid.output.code).toBe(400);
    expect(invalid.output.body).toMatchObject({ error: expect.stringContaining('positive finite number') });
    const created = response();
    await routes.handle(req('/api/ops/vehicles', draft()), created.res);
    expect(created.output.code).toBe(201);
    const id = (created.output.body as { vehicle: Vehicle }).vehicle.id;
    const updated = response();
    await routes.handle(req('/api/ops/vehicles/:id', { ...draft(), isAvailable: false }, id), updated.res);
    expect(updated.output.code).toBe(200);
    expect(updated.output.body).toMatchObject({ vehicle: { id, isAvailable: false } });
    const listed = response();
    await routes.handle(req('/api/ops/vehicles'), listed.res);
    expect(listed.output.body).toMatchObject({ vehicles: [{ id }] });
  });

  it('refuses unauthorised reads and returns 404 for an unknown vehicle update', async () => {
    const f = fixture();
    const routes = new VehicleRoutes(f.ac, f.controller);
    routes.useResolver({ resolve: async () => resident });
    const blocked = response();
    await routes.handle(req('/api/ops/vehicles'), blocked.res);
    expect(blocked.output.code).toBe(403);
    routes.useResolver({ resolve: async () => manager });
    const missing = response();
    await routes.handle(req('/api/ops/vehicles/:id', draft(), 'absent'), missing.res);
    expect(missing.output.code).toBe(404);
  });
});
