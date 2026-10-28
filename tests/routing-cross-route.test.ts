import { describe, expect, it } from 'vitest';
import { GeoPoint } from '../src/entity/valueTypes';
import { RouteOptimizationService, RouteJob, RouteTeam } from '../src/control/RouteOptimizationService';
import { IRouteStrategy, RoutePlan } from '../src/control/routing/IRouteStrategy';

const hqA = new GeoPoint(1.35, 103.82);
const hqB = new GeoPoint(1.36, 103.9);
const x1 = new GeoPoint(1.351, 103.821);
const x2 = new GeoPoint(1.352, 103.822);
const y = new GeoPoint(1.361, 103.901);
const team = (teamId: string, hq: GeoPoint, capabilities: string[], maxStops: number): RouteTeam => ({
  teamId, hq, capabilities, staffCount: 3, maxStops,
});
const task = (id: string, point: GeoPoint, allowedCapabilities: string[], effort = 1): RouteJob => ({
  workOrderId: id, point, requiredCapability: allowedCapabilities[0]!, allowedCapabilities,
  priority: 'High', estimatedEffortMinutes: effort,
});
const pointKey = (point: GeoPoint) => `${point.latitude},${point.longitude}`;

describe('bounded cross-route road improvement', () => {
  it('relocates a compatible task only when directed road time falls and served IDs stay fixed', async () => {
    const road: IRouteStrategy = { calculateRoute: async (stops): Promise<RoutePlan> => {
      const matrix = new Map<string, number>([
        [`${pointKey(hqA)}>${pointKey(x1)}`, 40], [`${pointKey(x1)}>${pointKey(hqA)}`, 60],
        [`${pointKey(hqA)}>${pointKey(x2)}`, 250], [`${pointKey(x2)}>${pointKey(hqA)}`, 150],
        [`${pointKey(x1)}>${pointKey(x2)}`, 30],
        [`${pointKey(hqA)}>${pointKey(y)}`, 500], [`${pointKey(y)}>${pointKey(hqA)}`, 500],
        [`${pointKey(hqB)}>${pointKey(x1)}`, 600], [`${pointKey(x1)}>${pointKey(hqB)}`, 600],
        [`${pointKey(hqB)}>${pointKey(x2)}`, 20], [`${pointKey(x2)}>${pointKey(hqB)}`, 380],
        [`${pointKey(hqB)}>${pointKey(y)}`, 80], [`${pointKey(y)}>${pointKey(hqB)}`, 20],
        [`${pointKey(x2)}>${pointKey(y)}`, 10],
      ]);
      const durationSeconds = stops.slice(1).reduce((sum, stop, index) =>
        sum + (matrix.get(`${pointKey(stops[index]!)}>${pointKey(stop)}`) ?? 1_000), 0);
      return { coordinates: stops, distanceMetres: 100, durationSeconds, source: 'onemap' };
    } };
    const jobs = [task('anchor', x1, ['X', 'Y']), task('move', x2, ['X', 'Y']), task('y-only', y, ['X', 'Y'], 2)];
    const routes = await new RouteOptimizationService(road).plan([
      team('A-X', hqA, ['X', 'Y'], 3), team('B-Y', hqB, ['X', 'Y'], 3),
    ], jobs);
    expect(routes.flatMap((route) => route.workOrderIds).sort()).toEqual(['anchor', 'move', 'y-only']);
    expect(routes.map((route) => [route.teamId, route.workOrderIds])).toEqual([
      ['A-X', ['anchor']], ['B-Y', ['move', 'y-only']],
    ]);
    expect(routes.reduce((sum, route) => sum + route.totalTravelSeconds, 0)).toBe(150);
  });

  it('rejects an attractive relocate that breaks the elapsed cap, while accepting the same move below the cap', async () => {
    const run = async (combinedMoveSeconds: number) => {
      const matrix = new Map<string, number>([
        [`${pointKey(hqA)}>${pointKey(x1)}`, 100], [`${pointKey(x1)}>${pointKey(hqA)}`, 100],
        [`${pointKey(hqA)}>${pointKey(x2)}`, 7_000], [`${pointKey(x2)}>${pointKey(hqA)}`, 7_000],
        [`${pointKey(x1)}>${pointKey(x2)}`, 6_900], [`${pointKey(x2)}>${pointKey(x1)}`, 7_000],
        [`${pointKey(hqB)}>${pointKey(x2)}`, 7_000], [`${pointKey(x2)}>${pointKey(hqB)}`, 7_000],
        [`${pointKey(hqB)}>${pointKey(y)}`, 500], [`${pointKey(y)}>${pointKey(hqB)}`, 500],
        [`${pointKey(x2)}>${pointKey(y)}`, combinedMoveSeconds - 7_500],
        [`${pointKey(y)}>${pointKey(x2)}`, 20_000],
      ]);
      const road: IRouteStrategy = { calculateRoute: async (stops) => ({ coordinates: stops, distanceMetres: 100,
        durationSeconds: stops.slice(1).reduce((sum, stop, index) =>
          sum + (matrix.get(`${pointKey(stops[index]!)}>${pointKey(stop)}`) ?? 1_000), 0), source: 'onemap' }) };
      return new RouteOptimizationService(road).plan([
        team('A-X', hqA, ['X', 'Y'], 2), team('B-Y', hqB, ['X', 'Y'], 2),
      ], [task('anchor', x1, ['X', 'Y']), task('move', x2, ['X', 'Y']), task('y-only', y, ['X', 'Y'], 2)]);
    };
    const rejected = await run(14_500);
    expect(rejected.map((route) => route.workOrderIds)).toEqual([['anchor', 'move'], ['y-only']]);
    expect(rejected.every((route) => route.isWithinFourHourCap)).toBe(true);
    const accepted = await run(13_500);
    expect(accepted.map((route) => route.workOrderIds)).toEqual([['anchor'], ['move', 'y-only']]);
    expect(accepted.reduce((sum, route) => sum + route.totalTravelSeconds, 0)).toBe(13_700);
  });

  it('does not relocate a three-person job into a one-person route', async () => {
    const road: IRouteStrategy = { calculateRoute: async (stops) => {
      const hq = pointKey(stops[0]!);
      const visit = stops.slice(1, -1).map(pointKey);
      const durationSeconds = hq === pointKey(hqA)
        ? visit.includes(pointKey(x1)) && visit.includes(pointKey(x2)) ? 200 : visit.includes(pointKey(x1)) ? 100 : 500
        : visit.includes(pointKey(x2)) && visit.includes(pointKey(y)) ? 50 : visit.includes(pointKey(y)) ? 100 : 500;
      return { coordinates: stops, distanceMetres: 100, durationSeconds, source: 'onemap' };
    } };
    const jobs: RouteJob[] = [
      { ...task('anchor', x1, ['X']), requiredStaff: 1 },
      { ...task('large', x2, ['X', 'Y']), requiredCapability: 'X', requiredStaff: 3 },
      { ...task('y-only', y, ['Y']), requiredStaff: 1 },
    ];
    const routes = await new RouteOptimizationService(road).plan([
      team('A-X', hqA, ['X'], 3), { ...team('B-Y', hqB, ['Y'], 2), staffCount: 1 },
    ], jobs);
    expect(routes.flatMap((route) => route.workOrderIds).sort()).toEqual(['anchor', 'large', 'y-only']);
    expect(routes.find((route) => route.teamId === 'A-X')!.workOrderIds.sort()).toEqual(['anchor', 'large']);
    expect(routes.find((route) => route.teamId === 'B-Y')!.workOrderIds).toEqual(['y-only']);
  });
});
