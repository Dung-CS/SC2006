import { describe, expect, it } from 'vitest';
import { GeoPoint } from '../src/entity/valueTypes';
import { RouteOptimizationService, RouteJob, RouteTeam } from '../src/control/RouteOptimizationService';
import { StaffStatus } from '../src/entity/enums';
import { IRouteStrategy, RoutePlan } from '../src/control/routing/IRouteStrategy';

const hq = new GeoPoint(1.35, 103.82);
const a = new GeoPoint(1.351, 103.821);
const b = new GeoPoint(1.352, 103.822);
const team = (teamId: string, point = hq): RouteTeam => ({ teamId, hq: point, capabilities: ['X'], staffCount: 4 });
const job = (id: string, point: GeoPoint, priority = 'High'): RouteJob => ({
  workOrderId: id, point, requiredCapability: 'X', priority, estimatedEffortMinutes: 1,
});
const key = (p: GeoPoint) => `${p.latitude},${p.longitude}`;

function road(cost: (stops: GeoPoint[]) => number): IRouteStrategy {
  return { calculateRoute: async (stops): Promise<RoutePlan> => ({ coordinates: stops, distanceMetres: 100,
    durationSeconds: cost(stops), source: 'onemap' }) };
}

describe('verified road-time objective', () => {
  it('compares multiple verified placements by actual directed road time, even when geometry ranks them oppositely', async () => {
    const routes = await new RouteOptimizationService(road((stops) => key(stops[0]!) === key(hq) ? 900 : 120), 1000)
      .plan([team('Central-X'), team('East-X', new GeoPoint(1.36, 103.9))], [job('j', a)]);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.teamId).toBe('East-X');
    expect(routes[0]!.totalTravelSeconds).toBe(120);
  });

  it('returns the verified incumbent when later search candidates time out', async () => {
    let calls = 0;
    const strategy: IRouteStrategy = { calculateRoute: async (stops) => {
      calls++;
      if (calls > 1) return new Promise<RoutePlan>(() => {});
      return { coordinates: stops, distanceMetres: 100, durationSeconds: 120, source: 'onemap' };
    } };
    const routes = await new RouteOptimizationService(strategy, 30, 5).plan([team('Central-X'), team('East-X', b)], [job('j', a)]);
    expect(routes.flatMap((route) => route.workOrderIds)).toEqual(['j']);
    expect(routes[0]!.totalTravelSeconds).toBe(120);
  });

  it('uses the verified ordered leg ETAs for waypoint cumulative times', async () => {
    const strategy: IRouteStrategy = { calculateRoute: async (stops) => ({ coordinates: stops, distanceMetres: 100,
      durationSeconds: 300, source: 'onemap', legs: stops.slice(1).map((_, i) => ({ durationSeconds: i === 0 ? 100 : 200, distanceMetres: 50 })) }) };
    const routes = await new RouteOptimizationService(strategy).plan([team('Central-X')], [job('j', a)]);
    const waypoints = routes[0]!.waypointOrder;
    expect(waypoints.find((waypoint) => waypoint.workOrderId)!.cumulativeDurationSeconds).toBe(160);
    expect(waypoints.at(-1)!.cumulativeDurationSeconds).toBe(routes[0]!.totalDurationSeconds);
  });

  it('keeps on-call lag in feasibility but chooses among feasible routes by road seconds', async () => {
    const shortOnCall = team('East-X', new GeoPoint(1.36, 103.9));
    shortOnCall.status = StaffStatus.OnCall;
    shortOnCall.onCallLagHours = 1;
    const strategy = road((stops) => key(stops[0]!) === key(shortOnCall.hq) ? 100 : 500);
    const routes = await new RouteOptimizationService(strategy).plan([team('Central-X'), shortOnCall], [job('j', a)]);
    expect(routes[0]!.teamId).toBe('East-X');
    expect(routes[0]!.totalTravelSeconds).toBe(100);
    expect(routes[0]!.totalDurationSeconds).toBe(3_760);
  });

  it('rejects present but incomplete per-leg metrics instead of inventing zero-time ETAs', async () => {
    const strategy: IRouteStrategy = { calculateRoute: async (stops) => ({ coordinates: stops, distanceMetres: 100,
      durationSeconds: 300, source: 'onemap', legs: [{ durationSeconds: 300, distanceMetres: 100 }] }) };
    expect(await new RouteOptimizationService(strategy).plan([team('Central-X')], [job('j', a)])).toEqual([]);
  });

  it('does not impose a small fixed route-leg ceiling on a large co-located workload', async () => {
    const colocated = new GeoPoint(hq.latitude + 0.00001, hq.longitude);
    const routes = await new RouteOptimizationService(road(() => 0)).plan([team('Central-X')],
      Array.from({ length: 80 }, (_, index) => job(`bulk-${index}`, colocated)));
    expect(routes.flatMap((route) => route.workOrderIds)).toHaveLength(80);
  });

  it('does not allocate committed statuses through a direct planner call or mark them road-unverified', async () => {
    const unverified = new Set(['Assigned', 'Accepted', 'InProgress', 'Rejected']);
    const routes = await new RouteOptimizationService(road(() => 0)).plan([team('Central-X')],
      ['Assigned', 'Accepted', 'InProgress', 'Rejected'].map((status) => ({ ...job(status, a), status })),
      undefined, unverified);
    expect(routes).toEqual([]);
    expect(unverified).toEqual(new Set());
  });
});
