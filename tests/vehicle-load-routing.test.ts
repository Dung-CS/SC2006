import { describe, expect, it } from 'vitest';
import { GeoPoint } from '../src/entity/valueTypes';
import { HqLocation, TaskType } from '../src/entity/enums';
import type { Vehicle } from '../src/entity/Vehicle';
import { RouteOptimizationService, RouteJob, RouteTeam } from '../src/control/RouteOptimizationService';
import { generatePackingList, logisticsLoad, itemFitsCargo } from '../src/control/LogisticsPolicy';
import { DirectDistanceRoutingStrategy } from '../src/control/routing/DirectDistanceRoutingStrategy';

const hq = new GeoPoint(1.32, 103.85);
const pool = (changes: Partial<RouteTeam> = {}): RouteTeam => ({
  teamId: 'Central-Vector', hq, capabilities: ['Vector'], staffCount: 6, ...changes,
});
const vehicle = (id: string, changes: Partial<Vehicle> = {}): Vehicle => ({
  id, registration: `DEMO-${id}`, name: 'Demo vehicle', hqLocation: HqLocation.Central,
  maxPayloadKg: 750, maxCargoVolumeM3: 6, cargoLengthCm: 300, cargoWidthCm: 160,
  cargoHeightCm: 140, seatCapacity: 6, isAvailable: true, isDemo: true, ...changes,
});
const job = (id: string, changes: Partial<RouteJob> = {}): RouteJob => ({
  workOrderId: id, point: new GeoPoint(1.321, 103.851), requiredCapability: 'Vector',
  taskType: TaskType.Inspection, priority: 'High', ...changes,
});
const planner = () => new RouteOptimizationService(new DirectDistanceRoutingStrategy());

describe('Vehicle load-constrained dispatch', () => {
  it('records positive quantities, weight and dimensions for every logistics item', () => {
    const items = generatePackingList([job('fog', { taskType: TaskType.Fogging }), job('drain', { taskType: TaskType.DrainClearance })], 3);
    for (const item of items) {
      expect(item.quantityCount).toBeGreaterThan(0);
      expect([item.unitWeightKg, item.lengthCm, item.widthCm, item.heightCm].every((n) => n > 0)).toBe(true);
      expect(item.totalWeightKg).toBe(item.quantityCount * item.unitWeightKg);
      expect(item.totalVolumeM3).toBe(item.quantityCount * item.lengthCm * item.widthCm * item.heightCm / 1_000_000);
      expect(item.isProvisional).toBe(true);
    }
  });

  it('reuses route equipment while accumulating consumables and collection capacity per task', () => {
    const once = generatePackingList([job('one', { taskType: TaskType.Fogging })], 3);
    const twice = generatePackingList([job('one', { taskType: TaskType.Fogging }), job('two', { taskType: TaskType.Fogging })], 3);
    expect(twice.find((item) => item.item.includes('Thermal Fogger'))?.quantityCount).toBe(1);
    expect(twice.find((item) => item.item.includes('Formulation'))?.quantityCount).toBe(2);
    expect(logisticsLoad(twice).weightKg - logisticsLoad(once).weightKg).toBeCloseTo(6);
    const collection = generatePackingList([job('one', { taskType: TaskType.RefuseClearance }), job('two', { taskType: TaskType.DrainClearance })]);
    expect(collection.find((item) => item.item.includes('Bio-Debris'))?.quantityCount).toBe(10);
  });

  it('requires an actual available vehicle at the correct HQ and enough seats', async () => {
    for (const fleet of [[], [vehicle('wrong-hq', { hqLocation: HqLocation.NorthEast })],
      [vehicle('unavailable', { isAvailable: false })], [vehicle('small', { seatCapacity: 2 })]]) {
      expect(await planner().plan([pool()], [job('fog', { taskType: TaskType.Fogging })], fleet)).toEqual([]);
    }
  });

  it('leaves overweight or over-volume tasks unplanned', async () => {
    expect(await planner().plan([pool()], [job('heavy', { taskType: TaskType.DrainClearance })],
      [vehicle('weight', { maxPayloadKg: 20 })])).toEqual([]);
    expect(await planner().plan([pool()], [job('bulky', { taskType: TaskType.DrainClearance })],
      [vehicle('volume', { maxCargoVolumeM3: 0.1 })])).toEqual([]);
  });

  it('checks item dimensions even when total volume and payload fit, with rotations allowed', async () => {
    const inspectionMirror = generatePackingList([job('inspection')]).find((item) => item.item.includes('Mirror'))!;
    expect(itemFitsCargo(inspectionMirror, { cargoLengthCm: 20, cargoWidthCm: 80, cargoHeightCm: 15 })).toBe(true);
    expect(await planner().plan([pool()], [job('inspection')],
      [vehicle('short', { cargoLengthCm: 70, cargoWidthCm: 70, cargoHeightCm: 70 })])).toEqual([]);
  });

  it('reserves each vehicle once across parallel routes and reports actual load percentages', async () => {
    const routes = await planner().plan([pool()], ['one', 'two', 'three'].map((id) => job(id, { estimatedEffortMinutes: 180 })),
      [vehicle('a'), vehicle('b')]);
    expect(routes).toHaveLength(2);
    expect(new Set(routes.map((route) => route.vehicleId)).size).toBe(2);
    for (const route of routes) {
      expect(route.loadWeightKg).toBeLessThanOrEqual(route.maxPayloadKg!);
      expect(route.loadVolumeM3).toBeLessThanOrEqual(route.maxCargoVolumeM3!);
      expect(route.loadWeightPercentage).toBeCloseTo(route.loadWeightKg / route.maxPayloadKg! * 100);
      expect(route.isDemoVehicle).toBe(true);
    }
  });

  it('upgrades an unreserved vehicle when sequential accumulated load needs more capacity', async () => {
    const routes = await planner().plan([pool()], [job('one', { taskType: TaskType.DrainClearance }),
      job('two', { taskType: TaskType.DrainClearance, priority: 'Medium' })],
    [vehicle('small', { maxPayloadKg: 80 }), vehicle('large', { maxPayloadKg: 200 })]);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.vehicleId).toBe('large');
    expect(routes[0]!.workOrderIds).toEqual(['one', 'two']);
    expect(routes[0]!.loadWeightKg).toBeGreaterThan(80);
    expect(routes[0]!.waypointOrder.some((waypoint) => waypoint.isBaseReturn)).toBe(false);
  });

  it('allocates high work before lower work consumes the vehicle and preserves explicit return instructions', async () => {
    const routes = await planner().plan([pool()], [job('low', { priority: 'Low', estimatedEffortMinutes: 180 }),
      job('high', { estimatedEffortMinutes: 180, requiresBaseReturn: true })], [vehicle('a')]);
    expect(routes[0]!.workOrderIds).toEqual(['high']);
    expect(routes[0]!.waypointOrder.some((waypoint) => waypoint.isBaseReturn)).toBe(true);
  });
});
