import { describe, expect, it, vi } from 'vitest';
import { GeoPoint } from '../src/entity/valueTypes';
import { OneMapGateway, WalkingRouteLeg } from '../src/boundary/gateways/OneMapGateway';
import { OneMapRoadRoutingStrategy } from '../src/control/routing/OneMapRoadRoutingStrategy';
import { IRouteStrategy } from '../src/control/routing/IRouteStrategy';
import { RouteOptimizationService } from '../src/control/RouteOptimizationService';

const hq = new GeoPoint(1.335, 103.743);
const x = new GeoPoint(1.336, 103.744);
const gate = new GeoPoint(hq.latitude + 0.00135, hq.longitude);
const baseJob = { point: hq, priority: 'High', requiredStaff: 1, estimatedEffortMinutes: 1 };

describe('trusted depot context regressions', () => {
  it('does not reuse candidate routes across identical coordinates/areas with different authorised depot stops', async () => {
    const contexts: number[][] = [];
    const strategy: IRouteStrategy = { calculateRoute: async (stops, _signal, _areas, depots = []) => {
      const collision = stops.length === 5 && stops[1]!.distanceTo(hq) < 1 && stops[2]!.distanceTo(hq) < 1 && stops[3]!.distanceTo(x) < 1;
      if (collision) contexts.push([...depots]);
      const exempt = collision && depots.includes(2);
      const durationSeconds = collision ? exempt ? 900 : 100 : 10;
      const drivingStops = stops.map((point, index) => exempt && index === 2 ? gate : point);
      const legs = stops.slice(1).map(() => ({ durationSeconds: durationSeconds / (stops.length - 1), distanceMetres: 100 }));
      return { source: 'onemap', coordinates: drivingStops, drivingStops, walkingVisits: [],
        drivingDurationSeconds: durationSeconds, walkingDurationSeconds: 0,
        durationSeconds, distanceMetres: legs.length * 100, legs };
    } };
    const service = new RouteOptimizationService(strategy);
    // Isolate candidate-cache admission; a later optimisation pass must not repair a broken cache.
    vi.spyOn(service as unknown as { improveAcrossRoutes: () => Promise<void> }, 'improveAcrossRoutes').mockResolvedValue();
    const routes = await service.plan([
      { teamId: 'Central-A', hq, capabilities: ['A'], staffCount: 1, maxStops: 2 },
      { teamId: 'Central-B', hq, capabilities: ['B'], staffCount: 1, maxStops: 3 },
    ], [
      { ...baseJob, workOrderId: 'base-return', requiredCapability: 'A', requiresBaseReturn: true },
      { ...baseJob, workOrderId: 'exact-hq-1', requiredCapability: 'B' },
      { ...baseJob, workOrderId: 'exact-hq-2', requiredCapability: 'B' },
      { ...baseJob, workOrderId: 'shared-low', point: x, priority: 'Low', requiredCapability: 'A', allowedCapabilities: ['A', 'B'] },
    ]);
    expect(contexts).toContainEqual([0, 2, 4]);
    expect(contexts).toContainEqual([0, 4]);
    expect(routes.find((route) => route.workOrderIds.includes('shared-low'))!.teamId).toBe('Central-B');
    expect(routes.find((route) => route.teamId === 'Central-A')!.workOrderIds).toEqual(['base-return']);
  });

  it.each([false, true])('keeps exact HQ task ETA before the return walk, with requiresBaseReturn=%s', async (requiresBaseReturn) => {
    const walkingRoute = async (start: GeoPoint, end: GeoPoint): Promise<WalkingRouteLeg> => ({
      source: 'onemap', mode: 'walk', coordinates: [start, end], durationSeconds: start.distanceTo(gate) < 1 ? 100 : 200, distanceMetres: 200,
    });
    const strategy = new OneMapRoadRoutingStrategy({
      rawDrivingRoute: async () => ({ coordinates: [gate, gate], durationSeconds: 10, distanceMetres: 10 }), walkingRoute,
    } as unknown as OneMapGateway);
    const routes = await new RouteOptimizationService(strategy).plan([
      { teamId: 'Central-A', hq, capabilities: ['A'], staffCount: 1 },
    ], [{ ...baseJob, workOrderId: 'exact-hq', requiredCapability: 'A', requiresBaseReturn }]);
    const route = routes[0]!;
    expect(route.waypointOrder).toHaveLength(3);
    expect(route.route.legs).toHaveLength(2);
    expect(route.waypointOrder[1]!.workOrderId).toBe('exact-hq');
    expect(route.waypointOrder[1]!.cumulativeDurationSeconds).toBe(170);
    expect(route.waypointOrder[2]!.isHq).toBe(true);
    expect(route.waypointOrder[2]!.isBaseReturn).toBe(requiresBaseReturn);
    expect(route.totalDurationSeconds).toBe(requiresBaseReturn ? 1580 : 380);
    expect(route.waypointOrder[2]!.cumulativeDurationSeconds).toBe(route.totalDurationSeconds);
  });
});
