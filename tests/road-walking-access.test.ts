import { describe, expect, it, vi } from 'vitest';
import { DrivingRouteLeg, OneMapGateway, WalkingRouteLeg } from '../src/boundary/gateways/OneMapGateway';
import { HttpClient } from '../src/boundary/gateways/HttpClient';
import { GeoPoint } from '../src/entity/valueTypes';
import { OneMapRoadRoutingStrategy } from '../src/control/routing/OneMapRoadRoutingStrategy';
import { isVerifiedAccessRoute, RoutePlan } from '../src/control/routing/IRouteStrategy';
import { RouteOptimizationService } from '../src/control/RouteOptimizationService';

const hq = new GeoPoint(1.3, 103.8);
const access = new GeoPoint(1.305, 103.805);
const target = new GeoPoint(1.31, 103.805);
const leg = (start: GeoPoint, end: GeoPoint, durationSeconds = 100): DrivingRouteLeg => ({
  coordinates: [start, end], durationSeconds, distanceMetres: 1000,
});
const walk = (start: GeoPoint, end: GeoPoint, durationSeconds = 400): WalkingRouteLeg => ({
  ...leg(start, end, durationSeconds), source: 'onemap', mode: 'walk',
});
function fixture(walkingRoute = vi.fn(async (start: GeoPoint, end: GeoPoint) => walk(start, end, end === target ? 400 : 500))) {
  const rawDrivingRoute = vi.fn(async (start: GeoPoint, end: GeoPoint) => leg(start === target ? access : start, end === target ? access : end));
  return { strategy: new OneMapRoadRoutingStrategy({ rawDrivingRoute, walkingRoute } as unknown as OneMapGateway), rawDrivingRoute, walkingRoute };
}
const stops = [hq, target, hq];

describe('provider-verified road and walking access', () => {
  it('accepts a depot compound centre 30m from its road gate without extending task snap tolerance', async () => {
    const depotGate = new GeoPoint(hq.latitude + 0.00027, hq.longitude);
    expect(hq.distanceTo(depotGate)).toBeGreaterThan(30);
    const strategy = new OneMapRoadRoutingStrategy({
      rawDrivingRoute: async (start: GeoPoint, end: GeoPoint) => leg(
        start === hq ? depotGate : start === target ? access : start,
        end === hq ? depotGate : end === target ? access : end),
      walkingRoute: async (start: GeoPoint, end: GeoPoint) => walk(start, end),
    } as unknown as OneMapGateway);
    // Includes an intermediate depot return, as required by specimen collection work.
    const depotStops = [hq, target, hq, target, hq];
    const route = await strategy.calculateRoute(depotStops, undefined, undefined, [0, 2, 4]);
    expect(route.drivingStops).toEqual([depotGate, access, depotGate, access, depotGate]);
    expect(route.walkingVisits?.map((visit) => visit.stopIndex)).toEqual([1, 3]);
    expect(isVerifiedAccessRoute(route, depotStops, undefined, [0, 2, 4])).toBe(true);
    const tooFar = new GeoPoint(hq.latitude + 0.003, hq.longitude);
    route.drivingStops![0] = tooFar;
    route.coordinates[0] = tooFar;
    expect(isVerifiedAccessRoute(route, depotStops, undefined, [0, 2, 4])).toBe(false);
  });

  it('does not apply the depot gate exemption to an exact report sharing the depot coordinates', async () => {
    const depotGate = new GeoPoint(hq.latitude + 0.00135, hq.longitude);
    const walkingRoute = vi.fn(async () => { throw new Error('exact task walk unverified'); });
    const strategy = new OneMapRoadRoutingStrategy({
      rawDrivingRoute: async () => leg(depotGate, depotGate), walkingRoute,
    } as unknown as OneMapGateway);
    const exactHq = new GeoPoint(hq.latitude, hq.longitude);
    await expect(strategy.calculateRoute([hq, exactHq, hq])).rejects.toThrow('unverified');
    const routes = await new RouteOptimizationService(strategy).plan([{ teamId: 'Central-X', hq, capabilities: ['X'] }], [{
      workOrderId: 'exact-hq-task', sourceReportId: 'report', point: hq, priority: 'High', requiredCapability: 'X', estimatedEffortMinutes: 1,
    }]);
    expect(routes).toEqual([]);
    expect(walkingRoute).toHaveBeenCalled();
  });

  it('keeps driving geometry at access points and counts asymmetric outbound and return walks in ordered ETA legs', async () => {
    const { strategy, rawDrivingRoute, walkingRoute } = fixture();
    const route = await strategy.calculateRoute(stops);
    expect(route.coordinates).toEqual([hq, access, hq]);
    expect(route.drivingStops).toEqual([hq, access, hq]);
    expect(route.walkingVisits?.[0]?.stopIndex).toBe(1);
    expect(route.walkingVisits?.[0]?.outbound.coordinates).toEqual([access, target]);
    expect(route.walkingVisits?.[0]?.return.coordinates).toEqual([target, access]);
    expect(route.drivingDurationSeconds).toBe(200);
    expect(route.walkingDurationSeconds).toBe(900);
    expect(route.durationSeconds).toBe(1100);
    expect(route.distanceMetres).toBe(4000);
    expect(route.legs).toEqual([{ durationSeconds: 500, distanceMetres: 2000 }, { durationSeconds: 600, distanceMetres: 2000 }]);
    expect(isVerifiedAccessRoute(route, stops)).toBe(true);
    await strategy.calculateRoute(stops);
    expect(rawDrivingRoute).toHaveBeenCalledTimes(2);
    expect(walkingRoute).toHaveBeenCalledTimes(2);
    route.walkingVisits![0]!.outbound.coordinates[0] = target;
    expect((await strategy.calculateRoute(stops)).walkingVisits![0]!.outbound.coordinates[0]).toEqual(access);
  });

  it.each(['outbound', 'return', 'geometry', 'failure', 'mode'] as const)('rejects unverified walking: %s', async (reason) => {
    const walkingRoute = vi.fn(async (start: GeoPoint, end: GeoPoint) => {
      if (reason === 'failure') throw new Error('walk provider unavailable');
      const result = walk(start, end, reason === 'outbound' && end === target || reason === 'return' && start === target ? 601 : 400);
      if (reason === 'geometry') result.coordinates = [hq, access];
      if (reason === 'mode') (result as { mode: string }).mode = 'ferry';
      return result;
    });
    await expect(fixture(walkingRoute).strategy.calculateRoute(stops)).rejects.toThrow();
  });

  it('accepts exactly 600 seconds each way and cancels while walking verification is pending', async () => {
    const boundary = fixture(vi.fn(async (start: GeoPoint, end: GeoPoint) => walk(start, end, 600)));
    expect((await boundary.strategy.calculateRoute(stops)).walkingDurationSeconds).toBe(1200);
    const pending = fixture(vi.fn(async () => new Promise<WalkingRouteLeg>(() => {})));
    const controller = new AbortController();
    const result = pending.strategy.calculateRoute(stops, controller.signal);
    await vi.waitFor(() => expect(pending.walkingRoute).toHaveBeenCalledTimes(2));
    controller.abort();
    await expect(result).rejects.toThrow('cancelled');
  });

  it('rejects missing, duplicate, shifted, malformed and inconsistent walk proof at the shared core boundary', async () => {
    const valid = await fixture().strategy.calculateRoute(stops);
    const copies = (): RoutePlan => structuredClone(valid);
    const bad: RoutePlan[] = [];
    let route = copies(); route.walkingVisits = []; bad.push(route);
    route = copies(); route.walkingVisits!.push(route.walkingVisits![0]!); bad.push(route);
    route = copies(); route.walkingVisits![0]!.stopIndex = 0; bad.push(route);
    route = copies(); route.walkingVisits![0]!.return = undefined as never; bad.push(route);
    route = copies(); route.walkingVisits![0]!.return.durationSeconds = 601; bad.push(route);
    route = copies(); route.walkingVisits![0]!.outbound.coordinates = [hq, target]; bad.push(route);
    route = copies(); route.walkingDurationSeconds = 1; bad.push(route);
    route = copies(); route.drivingDurationSeconds = 1; bad.push(route);
    route = copies(); route.legs![0]!.durationSeconds = 0; bad.push(route);
    route = copies(); route.drivingStops = [hq, target, hq]; bad.push(route);
    route = copies(); route.legs = [null, null] as never; bad.push(route);
    for (const forged of bad) {
      expect(isVerifiedAccessRoute(forged, stops)).toBe(false);
      const core = new RouteOptimizationService({ calculateRoute: async () => forged });
      expect(await core.plan([{ teamId: 'Central-X', hq, capabilities: ['X'] }], [{
        workOrderId: 'job', point: target, requiredCapability: 'X', estimatedEffortMinutes: 1, priority: 'High',
      }])).toEqual([]);
    }
  });

  it('requires walking proof even for a snap inside the former 250m road-only tolerance', () => {
    const nearbyTarget = new GeoPoint(access.latitude + 0.001, access.longitude);
    expect(isVerifiedAccessRoute({ coordinates: [hq, access, hq], source: 'onemap',
      durationSeconds: 200, distanceMetres: 2000 }, [hq, nearbyTarget, hq])).toBe(false);
  });

  it('includes both walks and service in the four-hour cap and per-waypoint elapsed clock', async () => {
    const service = new RouteOptimizationService(fixture().strategy);
    const team = { teamId: 'Central-X', hq, capabilities: ['X'] };
    const job = { workOrderId: 'job', isDemo: true, point: target, requiredCapability: 'X', estimatedEffortMinutes: 1, priority: 'High' };
    const routes = await service.plan([team], [job]);
    expect(routes[0]!.waypointOrder[1]!.cumulativeDurationSeconds).toBe(560);
    expect(routes[0]!.waypointOrder[1]!.isDemo).toBe(true);
    expect(routes[0]!.waypointOrder.at(-1)!.cumulativeDurationSeconds).toBe(1160);
    expect(routes[0]!.totalDurationSeconds).toBe(1160);
    // 225 minutes + 200s driving fits; adding both verified walks exceeds the cap.
    expect(await service.plan([team], [{ ...job, estimatedEffortMinutes: 225 }])).toEqual([]);
  });
});

describe('OneMap walking profile boundary', () => {
  const token = `header.${Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url')}.signature`;
  const response = (overrides: Record<string, unknown> = {}) => ({
    status: 0, route_geometry: [[access.latitude, access.longitude], [target.latitude, target.longitude]],
    route_summary: { total_time: 400, total_distance: 650 },
    route_instructions: [[null, '', 650, '', 400, '', '', '', 'walking']], ...overrides,
  });
  it('uses the walk profile and requires provider endpoints and supported transport evidence', async () => {
    const get = vi.fn(async (_url: string) => new Response(JSON.stringify(response()), { status: 200 }));
    const gateway = new OneMapGateway({ get } as unknown as HttpClient, 'https://onemap.test', token);
    expect((await gateway.walkingRoute(access, target)).mode).toBe('walk');
    expect(new URL(get.mock.calls[0]![0] as unknown as string).searchParams.get('routeType')).toBe('walk');
  });
  it.each([
    { route_summary: { total_time: 601, total_distance: 650 } },
    { route_geometry: [[hq.latitude, hq.longitude], [target.latitude, target.longitude]] },
    { status: 207 }, { route_instructions: undefined },
    { route_instructions: [[null, '', 650, '', 400, '', '', '', 'ferry']] },
  ])('rejects an unsupported walking payload %j', async (overrides) => {
    const gateway = new OneMapGateway({ get: async () => new Response(JSON.stringify(response(overrides)), { status: 200 }) } as unknown as HttpClient, 'https://onemap.test', token);
    await expect(gateway.walkingRoute(access, target)).rejects.toThrow();
  });
});
