import { describe, expect, it, vi } from 'vitest';
import { GeoPoint, Polygon } from '../src/entity/valueTypes';
import { OneMapGateway } from '../src/boundary/gateways/OneMapGateway';
import { OneMapRoadRoutingStrategy } from '../src/control/routing/OneMapRoadRoutingStrategy';
import { isInsideServiceArea, isVerifiedAccessRoute, RoutePlan } from '../src/control/routing/IRouteStrategy';
import { RouteOptimizationService } from '../src/control/RouteOptimizationService';

const hq = new GeoPoint(1.335, 103.743);
const target = new GeoPoint(1.3347, 103.7);
const entry = new GeoPoint(1.33335, 103.7001);
// Synthetic official-area-shaped fixture, not a claim about the live Soon Lee boundary.
const ring = [new GeoPoint(1.333, 103.699), new GeoPoint(1.336, 103.699),
  new GeoPoint(1.336, 103.702), new GeoPoint(1.333, 103.702)];
const area = new Polygon([ring]);
const stops = [hq, target, hq];
const areas = [undefined, area, undefined];
function fixture() {
  const walkingRoute = vi.fn(async () => { throw new Error('centroid is not a walk routing node'); });
  const rawDrivingRoute = vi.fn(async (start: GeoPoint, end: GeoPoint) => ({
    coordinates: [start === target ? entry : start, end === target ? entry : end],
    distanceMetres: 4000, durationSeconds: 300,
  }));
  return { strategy: new OneMapRoadRoutingStrategy({ rawDrivingRoute, walkingRoute } as unknown as OneMapGateway), walkingRoute, rawDrivingRoute };
}
const team = { teamId: 'SouthWest-X', hq, capabilities: ['X'] };
const job = { workOrderId: 'area-job', point: target, requiredCapability: 'X', priority: 'High', estimatedEffortMinutes: 1, serviceArea: area };

describe('authorised service-area road access', () => {
  it('accepts an actual road entry 151m from a representative centre inside the trusted area, without calling walk', async () => {
    const { strategy, walkingRoute, rawDrivingRoute } = fixture();
    expect(target.distanceTo(entry)).toBeGreaterThan(150);
    const route = await strategy.calculateRoute(stops, undefined, areas);
    expect(route.areaVisits).toEqual([{ stopIndex: 1, targetPoint: target, accessPoint: entry }]);
    expect(route.coordinates).toEqual([hq, entry, hq]);
    expect(route.walkingVisits).toEqual([]);
    expect(route.walkingDurationSeconds).toBe(0);
    expect(route.durationSeconds).toBe(600);
    expect(walkingRoute).not.toHaveBeenCalled();
    expect(rawDrivingRoute).toHaveBeenCalledTimes(2);
    expect(isVerifiedAccessRoute(route, stops, areas)).toBe(true);
    const planned = await new RouteOptimizationService(strategy).plan([team], [job]);
    expect(planned[0]!.waypointOrder[1]).toMatchObject({ point: entry, targetPoint: target, isAreaAccess: true });
    expect(planned[0]!.waypointOrder[1]!.cumulativeDurationSeconds).toBe(360);
    expect(planned[0]!.totalDurationSeconds).toBe(660);
  });

  it('does not exempt an exact/report point or an outside-area entry when the walk provider fails', async () => {
    const { strategy, walkingRoute } = fixture();
    await expect(strategy.calculateRoute(stops)).rejects.toThrow('centroid');
    const elsewhere = new Polygon([[new GeoPoint(1.34, 103.71), new GeoPoint(1.35, 103.71), new GeoPoint(1.35, 103.72)]]);
    await expect(strategy.calculateRoute(stops, undefined, [undefined, elsewhere, undefined])).rejects.toThrow('centroid');
    expect(walkingRoute).toHaveBeenCalled();
  });

  it('rejects forged area metadata, holes, duplicate/mismatched visits and missing caller authorisation at the shared core boundary', async () => {
    const route = await fixture().strategy.calculateRoute(stops, undefined, areas);
    expect(isVerifiedAccessRoute(route, stops)).toBe(false);
    const hole = [new GeoPoint(1.3331, 103.6999), new GeoPoint(1.3337, 103.6999),
      new GeoPoint(1.3337, 103.7005), new GeoPoint(1.3331, 103.7005)];
    expect(isVerifiedAccessRoute(route, stops, [undefined, new Polygon([ring, hole]), undefined])).toBe(false);
    for (const mutate of [
      (p: RoutePlan) => { p.areaVisits![0]!.stopIndex = 0; },
      (p: RoutePlan) => { p.areaVisits![0]!.targetPoint = hq; },
      (p: RoutePlan) => { p.areaVisits![0]!.accessPoint = target; },
      (p: RoutePlan) => { p.areaVisits!.push(p.areaVisits![0]!); },
      (p: RoutePlan) => { p.areaVisits = []; },
    ]) {
      const forged = structuredClone(route); mutate(forged);
      expect(isVerifiedAccessRoute(forged, stops, areas)).toBe(false);
    }
    const fakeStrategy = { calculateRoute: async () => route };
    // An area fabricated in strategy output cannot override the exact job's missing authorisation.
    expect(await new RouteOptimizationService(fakeStrategy).plan([team], [{ ...job, serviceArea: undefined }])).toEqual([]);
  });

  it('separates area admission from exact-point admission when candidate circuits share the same coordinates', async () => {
    const { strategy } = fixture();
    const planned = await new RouteOptimizationService(strategy).plan([{ ...team, staffCount: 2, maxStops: 1 }], [
      job, { ...job, workOrderId: 'exact-job', serviceArea: undefined },
    ]);
    expect(planned.flatMap((route) => route.workOrderIds)).toEqual(['area-job']);
  });
});

describe('routing-only service area containment', () => {
  const hole = [new GeoPoint(1.334, 103.7), new GeoPoint(1.335, 103.7),
    new GeoPoint(1.335, 103.701), new GeoPoint(1.334, 103.701)];
  it('supports open/closed outer rings, outer boundaries, holes and hole boundaries', () => {
    expect(isInsideServiceArea(entry, area)).toBe(true);
    expect(isInsideServiceArea(ring[0]!, [[...ring, ring[0]!]])).toBe(true);
    expect(isInsideServiceArea(target, [ring, hole])).toBe(false);
    expect(isInsideServiceArea(hole[0]!, [ring, hole])).toBe(false);
    expect(isInsideServiceArea(entry, [ring, hole])).toBe(true);
  });
  it.each([
    [], [[]], [[ring[0]!, ring[1]!]], [[ring[0]!, ring[1]!, ring[1]!, ring[2]!]],
    [[ring[0]!, ring[2]!, ring[1]!, ring[3]!]],
    [[new GeoPoint(NaN, 103), ...ring]],
    [ring, [new GeoPoint(1.4, 103.7), new GeoPoint(1.5, 103.7), new GeoPoint(1.5, 103.8)]],
    [ring, hole, hole],
  ])('rejects invalid polygon geometry %#', (...rings) => {
    expect(isInsideServiceArea(entry, rings as GeoPoint[][])).toBe(false);
  });
});
