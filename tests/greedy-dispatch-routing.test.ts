import { describe, expect, it } from 'vitest';
import { GeoPoint } from '../src/entity/valueTypes';
import { StaffStatus, TaskType } from '../src/entity/enums';
import { RouteOptimizationService, RouteJob, RouteTeam, estimateRequiredStaff } from '../src/control/RouteOptimizationService';
import { IRouteStrategy, RoutePlan } from '../src/control/routing/IRouteStrategy';

const hq = new GeoPoint(1.35, 103.82);
const pool = (overrides: Partial<RouteTeam> = {}): RouteTeam => ({
  teamId: 'Central-Vector', hq, capabilities: ['Vector'], staffCount: 3, ...overrides,
});
const job = (id: string, overrides: Partial<RouteJob> = {}): RouteJob => ({
  workOrderId: id, point: new GeoPoint(1.351, 103.821), requiredCapability: 'Vector',
  taskType: TaskType.Inspection, priority: 'High', ...overrides,
});
class MockRoad implements IRouteStrategy {
  async calculateRoute(stops: GeoPoint[]): Promise<RoutePlan> {
    const distanceMetres = stops.slice(1).reduce((total, p, i) => total + stops[i]!.distanceTo(p), 0);
    return { coordinates: stops, distanceMetres, durationSeconds: distanceMetres / 9.72, source: 'onemap' };
  }
}

describe('Priority-first greedy dispatch with real crew capacity', () => {
  it('leaves tasks unplanned when a road provider does not finish within the shared wait budget', async () => {
    const stalled: IRouteStrategy = { calculateRoute: async () => new Promise(() => {}) };
    const routes = await new RouteOptimizationService(stalled, 5).plan([pool({ staffCount: 1 })], [job('high')]);
    expect(routes).toEqual([]);
  });
  it('allocates a distant high task before nearby low tasks consume the shift', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([pool({ staffCount: 1 })], [
      job('low', { priority: 'Low', estimatedEffortMinutes: 120 }),
      job('high', { point: new GeoPoint(1.43, 103.9), estimatedEffortMinutes: 140 }),
    ]);
    expect(routes.flatMap((r) => r.workOrderIds)).toEqual(['high']);
  });

  it('fills separate parallel crews without counting the same heads twice', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([pool({ staffCount: 5 })],
      ['one', 'two', 'three'].map((id) => job(id, { requiredStaff: 2, estimatedEffortMinutes: 180 })));
    expect(routes).toHaveLength(2);
    expect(routes.reduce((sum, r) => sum + r.staffCount, 0)).toBe(4);
    expect(new Set(routes.map((r) => r.teamId)).size).toBe(2);
  });

  it('reuses staff for sequential jobs and grows a crew only from unreserved heads', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([pool({ staffCount: 3 })], [
      job('small', { requiredStaff: 1 }), job('large', { priority: 'Medium', requiredStaff: 3 }),
    ]);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.staffCount).toBe(3);
    expect(routes[0]!.workOrderIds).toEqual(['small', 'large']);
    expect(routes[0]!.waypointOrder.filter((w) => w.workOrderId).map((w) => w.requiredStaff)).toEqual([1, 3]);
  });

  it('leaves infeasible high work pending and uses capacity for lower work that fits', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([pool({ staffCount: 2 })], [
      job('high-fog', { taskType: TaskType.Fogging }), job('low-check', { priority: 'Low' }),
    ]);
    expect(routes.flatMap((r) => r.workOrderIds)).toEqual(['low-check']);
    expect(estimateRequiredStaff(TaskType.Fogging)).toBe(3);
    expect(estimateRequiredStaff(TaskType.Larviciding)).toBe(2);
  });

  it('never substitutes unavailable or unqualified staff', async () => {
    const planner = new RouteOptimizationService(new MockRoad());
    expect(await planner.plan([pool({ status: StaffStatus.Unavailable })], [job('high')])).toEqual([]);
    expect(await planner.plan([pool({ status: StaffStatus.Dispatched })], [job('high')])).toEqual([]);
    expect(await planner.plan([pool({ capabilities: ['Other'] })], [job('high')])).toEqual([]);
    expect(await planner.plan([pool({ staffCount: 0 })], [job('high')])).toEqual([]);
  });

  it('preserves the versatile pool for tasks only it can clear', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([
      pool({ teamId: 'versatile', staffCount: 1, maxStops: 1, capabilities: ['Vector', 'Structural'] }),
      pool({ teamId: 'vector', staffCount: 1, maxStops: 1 }),
    ], [job('vector', { score: 100 }), job('structural', { requiredCapability: 'Structural', score: 1 })]);
    expect(routes.find((r) => r.teamId === 'vector')!.workOrderIds).toEqual(['vector']);
    expect(routes.find((r) => r.teamId === 'versatile')!.workOrderIds).toEqual(['structural']);
  });

  it('accepts any permitted capability and enforces max stops', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([pool({ staffCount: 1, maxStops: 1 })], [
      job('first', { requiredCapability: 'Other', allowedCapabilities: ['Other', 'Vector'] }), job('second'),
    ]);
    expect(routes.flatMap((r) => r.workOrderIds)).toHaveLength(1);
  });

  it('includes mobilisation lag in the same four-hour budget', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([
      pool({ staffCount: 1, status: StaffStatus.OnCall, onCallLagHours: 2 }),
    ], [job('high', { estimatedEffortMinutes: 150 }), job('low', { priority: 'Low', estimatedEffortMinutes: 60 })]);
    expect(routes.flatMap((r) => r.workOrderIds)).toEqual(['low']);
    expect(routes[0]!.totalDurationSeconds).toBeGreaterThan(3 * 3600);
  });

  it('checks actual road time, tries another outpost, and never clamps duration', async () => {
    const east = new GeoPoint(1.35, 103.9);
    const strategy: IRouteStrategy = { calculateRoute: async (stops) => ({
      coordinates: stops, distanceMetres: 100, durationSeconds: stops[0] === hq ? 15000 : 1000, source: 'onemap',
    }) };
    const routes = await new RouteOptimizationService(strategy).plan([
      pool({ staffCount: 1 }), pool({ teamId: 'East', hq: east, staffCount: 1 }),
    ], [job('high')]);
    expect(routes[0]!.teamId).toBe('East');
    expect(routes[0]!.totalDurationSeconds).toBe(2800);
    expect(routes[0]!.totalTravelSeconds).toBe(1000);
    expect(routes[0]!.waypointOrder.at(-1)!.cumulativeDurationSeconds).toBe(2800);
    expect(await new RouteOptimizationService(strategy).plan([pool({ staffCount: 1 })], [job('high')])).toEqual([]);
  });

  it('shortens the chosen circuit while keeping every higher tier ahead of lower tiers', async () => {
    const routes = await new RouteOptimizationService(new MockRoad()).plan([pool({ staffCount: 1 })], [
      job('west-high', { point: new GeoPoint(1.35, 103.8), score: 10 }),
      job('east-low', { point: new GeoPoint(1.35, 103.85), priority: 'Low' }),
      job('far-west-high', { point: new GeoPoint(1.35, 103.78), score: 9 }),
    ]);
    const highPoints = routes[0]!.waypointOrder.filter((w) => w.workOrderId);
    expect(highPoints.map((w) => w.priority)).toEqual(['High', 'High', 'Low']);
    expect(routes[0]!.totalDurationSeconds).toBeCloseTo(routes[0]!.totalTravelSeconds + routes[0]!.totalEffortSeconds);
  });

  it('retries blocked higher work after each allocation before admitting a lower tier', async () => {
    const first = new GeoPoint(1.351, 103.821);
    const second = new GeoPoint(1.352, 103.822);
    const strategy: IRouteStrategy = { calculateRoute: async (stops) => ({
      coordinates: stops, distanceMetres: 100,
      durationSeconds: stops.includes(first) && !stops.includes(second) ? 15000 : 100,
      source: 'onemap',
    }) };
    const routes = await new RouteOptimizationService(strategy).plan([pool({ staffCount: 1, maxStops: 2 })], [
      job('retry-high', { point: first, score: 100 }), job('other-high', { point: second }),
      job('low', { priority: 'Low' }),
    ]);
    expect(routes.flatMap((r) => r.workOrderIds).sort()).toEqual(['other-high', 'retry-high']);
  });

  it('untangles a circuit that cheapest insertion alone leaves longer', async () => {
    const offsets = [[-.156489, -.824575], [-.466533, -.580220], [-.437631, .619021],
      [-.601034, .772799], [.758746, -.890421], [-.242367, -.016577], [-.953034, -.150549]];
    const jobs = offsets.map(([lat, lon], index) => job(`stop-${index}`, {
      point: new GeoPoint(hq.latitude + lat! * .05, hq.longitude + lon! * .05),
      estimatedEffortMinutes: 1, score: 100 - index,
    }));
    const distance = (sequence: GeoPoint[]): number => [hq, ...sequence, hq].slice(1).reduce(
      (sum, point, i) => sum + [hq, ...sequence][i]!.distanceTo(point), 0);
    let insertionOnly: GeoPoint[] = [];
    for (const next of jobs) {
      insertionOnly = Array.from({ length: insertionOnly.length + 1 }, (_, index) =>
        [...insertionOnly.slice(0, index), next.point, ...insertionOnly.slice(index)],
      ).sort((a, b) => distance(a) - distance(b))[0]!;
    }
    const routes = await new RouteOptimizationService(new MockRoad()).plan([pool({ staffCount: 1 })], jobs);
    expect(routes[0]!.workOrderIds).toHaveLength(7);
    expect(routes[0]!.route.distanceMetres).toBeLessThan(distance(insertionOnly) - 100);
  });

  it('rejects invalid lag and avoids repeated job or pool identifiers', async () => {
    const planner = new RouteOptimizationService(new MockRoad());
    expect(await planner.plan([pool({ status: StaffStatus.OnCall, onCallLagHours: NaN })], [job('one')])).toEqual([]);
    const routes = await planner.plan([pool({ staffCount: 1, maxStops: 1 }), pool({ staffCount: 1, maxStops: 1 })],
      [job('one'), job('one'), job('two')]);
    expect(routes.flatMap((route) => route.workOrderIds)).toHaveLength(1);
  });
});
