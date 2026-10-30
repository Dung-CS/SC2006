import { afterEach, describe, expect, it, vi } from 'vitest';
import { OneMapGateway, DrivingRouteLeg } from '../src/boundary/gateways/OneMapGateway';
import { HttpClient } from '../src/boundary/gateways/HttpClient';
import { RouteOptimizationService, RouteJob, RouteTeam } from '../src/control/RouteOptimizationService';
import { DispatchPlanService } from '../src/control/DispatchPlanService';
import { OneMapRoadRoutingStrategy } from '../src/control/routing/OneMapRoadRoutingStrategy';
import { RouteStrategyFactory } from '../src/control/routing/RouteStrategyFactory';
import { DirectDistanceRoutingStrategy } from '../src/control/routing/DirectDistanceRoutingStrategy';
import { GeoPoint } from '../src/entity/valueTypes';
import { HqLocation } from '../src/entity/enums';
import type { Vehicle } from '../src/entity/Vehicle';

const hq = new GeoPoint(1.32, 103.85);
const offshore = new GeoPoint(1.205, 103.605);
const mainland = new GeoPoint(1.325, 103.855);
const team: RouteTeam = { teamId: 'Central-Vector', hq, capabilities: ['Vector'], staffCount: 2 };
const vehicle: Vehicle = { id: 'van', registration: 'DEMO', name: 'Van', hqLocation: HqLocation.Central,
  maxPayloadKg: 1000, maxCargoVolumeM3: 10, cargoLengthCm: 300, cargoWidthCm: 200,
  cargoHeightCm: 200, seatCapacity: 4, isAvailable: true, isDemo: true };
const job = (id: string, point: GeoPoint, priority = 'High'): RouteJob => ({
  workOrderId: id, point, requiredCapability: 'Vector', requiredStaff: 1, estimatedEffortMinutes: 10, priority,
});
const leg = (start: GeoPoint, end: GeoPoint): DrivingRouteLeg => ({
  coordinates: [start, end], distanceMetres: 2000, durationSeconds: 200,
});
const strategy = (drivingRoute: (start: GeoPoint, end: GeoPoint) => Promise<DrivingRouteLeg>) =>
  new OneMapRoadRoutingStrategy({ drivingRoute } as OneMapGateway);
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Only verified driving routes enter dispatch', () => {
  it('excludes a ferry-only critical task while retaining valid mainland jobs in priority order', async () => {
    const roads = strategy(async (start, end) => {
      if (start === offshore || end === offshore) throw new Error('No driving route');
      return leg(start, end);
    });
    const unverified = new Set<string>();
    const routes = await new RouteOptimizationService(roads).plan([team], [
      job('low', mainland, 'Low'), job('island', offshore, 'Critical'),
      job('high', new GeoPoint(1.326, 103.856)),
    ], [vehicle], unverified);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.workOrderIds).toEqual(['high', 'low']);
    expect(routes[0]!.route.source).toBe('onemap');
    expect(unverified).toEqual(new Set(['island']));
  });

  it('does not blacklist a road-connected island when complete driving legs are verified', async () => {
    const sentosa = new GeoPoint(1.25, 103.83);
    const routes = await new RouteOptimizationService(strategy(async (start, end) => leg(start, end)))
      .plan([team], [job('connected-island', sentosa)], [vehicle]);
    expect(routes[0]!.workOrderIds).toEqual(['connected-island']);
  });

  it('rejects a provider which snaps an island destination onto the mainland', async () => {
    const roads = strategy(async (start, end) => leg(start === offshore ? mainland : start, end === offshore ? mainland : end));
    expect(await new RouteOptimizationService(roads).plan([team], [job('island', offshore)], [vehicle])).toEqual([]);
  });

  it('does not trust a source label when the whole circuit misses the requested task', async () => {
    const roads = { calculateRoute: async () => ({ ...leg(hq, hq), coordinates: [hq, mainland, hq], source: 'onemap' as const }) };
    expect(await new RouteOptimizationService(roads).plan([team], [job('island', offshore)], [vehicle])).toEqual([]);
  });

  it('rejects disconnected leg joins even when each snapped endpoint is within the access tolerance', async () => {
    const roads = strategy(async (start, end) => end === mainland
      ? leg(start, new GeoPoint(mainland.latitude + .001, mainland.longitude))
      : leg(new GeoPoint(mainland.latitude - .001, mainland.longitude), end));
    expect(await new RouteOptimizationService(roads).plan([team], [job('one', mainland)], [vehicle])).toEqual([]);
  });

  it('does not manufacture routes on timeout, an exhausted budget, missing configuration or a direct estimate', async () => {
    const stalled = { calculateRoute: vi.fn(async () => new Promise<never>(() => {})) };
    const unverified = new Set<string>();
    // Fake clock: a real timer can fire just before the deadline's millisecond and admit a second call.
    vi.useFakeTimers();
    const stalledPlan = new RouteOptimizationService(stalled, 5).plan([team], [job('one', mainland), job('two', offshore)], [vehicle], unverified);
    await vi.advanceTimersByTimeAsync(5);
    expect(await stalledPlan).toEqual([]);
    vi.useRealTimers();
    expect(stalled.calculateRoute).toHaveBeenCalledTimes(1);
    expect(unverified).toEqual(new Set(['one', 'two']));
    for (const roads of [RouteStrategyFactory.create(null), new DirectDistanceRoutingStrategy()]) {
      expect(await new RouteOptimizationService(roads).plan([team], [job('one', mainland)], [vehicle])).toEqual([]);
    }
    const unused = { calculateRoute: vi.fn() };
    expect(await new RouteOptimizationService(unused, 0).plan([team], [job('one', mainland)], [vehicle])).toEqual([]);
    expect(unused.calculateRoute).not.toHaveBeenCalled();
  });

  it('leaves a stalled critical task unverified and still dispatches a verified lower-priority task', async () => {
    const roads = { calculateRoute: vi.fn(async (stops: GeoPoint[]) => {
      if (stops.includes(offshore)) return new Promise<never>(() => {});
      return { ...leg(stops[0]!, stops.at(-1)!), coordinates: stops, source: 'onemap' as const };
    }) };
    const unverified = new Set<string>();
    const routes = await new RouteOptimizationService(roads, 100, 3).plan([team],
      [job('critical-island', offshore, 'Critical'), job('reachable-low', mainland, 'Low')], [vehicle], unverified);
    expect(routes[0]!.workOrderIds).toEqual(['reachable-low']);
    expect(unverified).toEqual(new Set(['critical-island']));
    expect(routes[0]!.route.source).toBe('onemap');
  });

  it.each([
    { distanceMetres: NaN }, { distanceMetres: -1 }, { durationSeconds: -1 },
    { coordinates: [] }, { coordinates: [hq] },
    { coordinates: [hq, new GeoPoint(Infinity, 103.8)] },
  ])('rejects malformed road metrics or geometry: %j', async (changes) => {
    const roads = strategy(async (start, end) => ({ ...leg(start, end), ...changes }));
    expect(await new RouteOptimizationService(roads).plan([team], [job('one', mainland)], [vehicle])).toEqual([]);
  });

  it('rejects a partially verified circuit when the return leg is unavailable', async () => {
    const roads = strategy(async (start, end) => {
      if (end === hq) throw new Error('No return route');
      return leg(start, end);
    });
    expect(await new RouteOptimizationService(roads).plan([team], [job('one', mainland)], [vehicle])).toEqual([]);
  });

  it('retries road-unverified snapshots after service recovery with unchanged task and fleet inputs', async () => {
    vi.useFakeTimers();
    let available = false;
    const roads = strategy(async (start, end) => {
      if (!available) throw new Error('Temporary timeout');
      return leg(start, end);
    });
    const planner = new RouteOptimizationService(roads);
    const plan = vi.spyOn(planner, 'plan');
    const service = new DispatchPlanService(async () => ({ teams: [team], vehicles: [vehicle],
      jobs: [job('reachable', mainland), job('no-crew', mainland, 'Low')].map((value) =>
        value.workOrderId === 'no-crew' ? { ...value, requiredStaff: 5 } : {
          ...value, reportIds: ['r1', 'r2'], reportCount: 2,
          individualCounts: [{ reportId: 'r1', estimatedCount: 3 }, { reportId: 'r2', estimatedCount: null }],
        }) }), planner);
    await service.refresh('2099-01-01');
    const first = service.snapshot('2099-01-01');
    expect(first.planStatus).toBe('ready');
    expect(first.routes).toEqual([]);
    expect(first.unplanned[0]!.reason).toMatch(/could not be verified/);
    expect(first.unplanned[0]!.reason).not.toMatch(/unreachable/);
    expect(first.unplanned[0]).toMatchObject({ reportIds: ['r1', 'r2'], reportCount: 2,
      individualCounts: [{ reportId: 'r1', estimatedCount: 3 }, { reportId: 'r2', estimatedCount: null }] });
    expect(first.unplanned[1]!.reason).toMatch(/crew/);
    available = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(service.snapshot('2099-01-01').planStatus).toBe('refreshing');
    // Repeated reads while refreshing do not queue more full computations.
    service.snapshot('2099-01-01');
    await vi.advanceTimersByTimeAsync(250);
    expect(service.snapshot('2099-01-01').routes[0]!.workOrderIds).toEqual(['reachable']);
    expect(plan).toHaveBeenCalledTimes(2);
  });
});

describe('OneMap driving response validation', () => {
  const token = `header.${Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString('base64url')}.signature`;
  const gateway = (body: unknown) => new OneMapGateway({
    get: vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  } as unknown as HttpClient, 'https://onemap.test', token);

  it('accepts geometry serving the requested endpoints and valid metrics', async () => {
    const result = await gateway({ route_geometry: [[hq.latitude, hq.longitude], [mainland.latitude, mainland.longitude]],
      route_summary: { total_distance: 1200, total_time: 180 } }).drivingRoute(hq, mainland);
    expect(result.durationSeconds).toBe(180);
  });

  it.each([
    { route_geometry: [[hq.latitude, hq.longitude], [mainland.latitude, mainland.longitude]], route_summary: { total_distance: -1, total_time: 10 } },
    { route_geometry: [[hq.latitude, hq.longitude], [mainland.latitude, mainland.longitude]], route_summary: { total_distance: null, total_time: 10 } },
    { route_geometry: [[hq.latitude, hq.longitude]], route_summary: { total_distance: 1, total_time: 10 } },
    { route_geometry: '_', route_summary: { total_distance: 1, total_time: 10 } },
    { route_geometry: [[hq.latitude, hq.longitude], [offshore.latitude, offshore.longitude]], route_summary: { total_distance: 1, total_time: 10 } },
    { error: 'No route found' },
  ])('rejects invalid API response: %j', async (body) => {
    await expect(gateway(body).drivingRoute(hq, mainland)).rejects.toThrow();
  });
});
