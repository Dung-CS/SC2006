import { describe, expect, it } from 'vitest';
import { HqLocation, PriorityTier, StaffStatus, TaskType } from '../src/entity/enums';
import { GeoPoint } from '../src/entity/valueTypes';
import { Vehicle } from '../src/entity/Vehicle';
import { RouteJob, RouteTeam, RouteOptimizationService, PlannedTeamRoute } from '../src/control/RouteOptimizationService';
import { IRouteStrategy, RoutePlan } from '../src/control/routing/IRouteStrategy';

const central = new GeoPoint(1.318, 103.847);
const northEast = new GeoPoint(1.37, 103.88);
const centralTeam: RouteTeam = {
  teamId: 'Central-Vector', hq: central, capabilities: ['Vector'], staffCount: 5,
  status: StaffStatus.Available, maxStops: 2,
};
const northEastTeam: RouteTeam = {
  teamId: 'NorthEast-Vector', hq: northEast, capabilities: ['Vector'], staffCount: 3,
  status: StaffStatus.OnCall, onCallLagHours: 0.25, maxStops: 2,
};
const jobs: RouteJob[] = [
  { workOrderId: 'critical-central', point: new GeoPoint(1.319, 103.848), requiredCapability: 'Vector',
    requiredStaff: 4, estimatedEffortMinutes: 8, priority: PriorityTier.Critical, taskType: TaskType.Inspection },
  { workOrderId: 'high-northeast', point: new GeoPoint(1.371, 103.881), requiredCapability: 'Vector',
    requiredStaff: 2, estimatedEffortMinutes: 7, priority: PriorityTier.High, taskType: TaskType.Inspection,
    requiresBaseReturn: true },
  { workOrderId: 'medium-central', point: new GeoPoint(1.32, 103.849), requiredCapability: 'Vector',
    requiredStaff: 1, estimatedEffortMinutes: 5, priority: PriorityTier.Medium, taskType: TaskType.Inspection },
  { workOrderId: 'low-northeast', point: new GeoPoint(1.372, 103.882), requiredCapability: 'Vector',
    requiredStaff: 1, estimatedEffortMinutes: 5, priority: PriorityTier.Low, taskType: TaskType.Inspection },
];
const vehicle = (id: string, hqLocation: HqLocation, seatCapacity: number): Vehicle => ({
  id, hqLocation, registration: id, name: id, seatCapacity, isAvailable: true, isDemo: true,
  maxPayloadKg: 1_000, maxCargoVolumeM3: 20, cargoLengthCm: 300, cargoWidthCm: 200, cargoHeightCm: 150,
});
const vehicles = [vehicle('central-van', HqLocation.Central, 5), vehicle('northeast-van', HqLocation.NorthEast, 3)];

class DirectedFixtureRoad implements IRouteStrategy {
  async calculateRoute(stops: GeoPoint[], _signal?: AbortSignal): Promise<RoutePlan> {
    const legs = stops.slice(1).map((to, index) => {
      const from = stops[index]!;
      // Direction changes time, so the expected waypoint ETA cannot pass by dividing one total evenly.
      const durationSeconds = 40 + Math.round(Math.abs(to.latitude - from.latitude) * 20_000) +
        (to.longitude < from.longitude ? 31 : 0);
      return { durationSeconds, distanceMetres: durationSeconds * 9 };
    });
    return { coordinates: stops, legs, distanceMetres: legs.reduce((sum, leg) => sum + leg.distanceMetres, 0),
      durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0), source: 'onemap' };
  }
}

function matchingPool(route: PlannedTeamRoute, teams: RouteTeam[]): RouteTeam {
  return [...teams].sort((a, b) => b.teamId.length - a.teamId.length)
    .find((team) => route.teamId === team.teamId || route.teamId.startsWith(`${team.teamId}-crew`))!;
}

/** Independent checks over the public plan and its input records; does not call planner validators. */
function expectPlanFeasible(teams: RouteTeam[], inputJobs: RouteJob[], fleet: Vehicle[], routes: PlannedTeamRoute[]): void {
  const jobsById = new Map(inputJobs.map((job) => [job.workOrderId, job]));
  const plannedIds = routes.flatMap((route) => route.workOrderIds);
  expect(new Set(plannedIds).size).toBe(plannedIds.length);
  expect(plannedIds.every((id) => jobsById.has(id))).toBe(true);
  expect([...new Set(plannedIds)].sort()).toEqual(inputJobs.map((job) => job.workOrderId).sort());
  expect(new Set(routes.map((route) => route.vehicleId)).size).toBe(routes.length);

  const staffUsed = new Map<string, number>();
  for (const route of routes) {
    const pool = matchingPool(route, teams);
    const routeJobs = route.workOrderIds.map((id) => jobsById.get(id)!);
    const vehicleRecord = fleet.find((item) => item.id === route.vehicleId)!;
    expect(vehicleRecord).toBeDefined();
    expect(vehicleRecord.isAvailable).toBe(true);
    expect(vehicleRecord.hqLocation).toBe(pool.teamId.split('-')[0]);
    expect(route.staffCount).toBeLessThanOrEqual(pool.staffCount ?? 1);
    expect(route.staffCount).toBeGreaterThanOrEqual(Math.max(...routeJobs.map((job) => job.requiredStaff ?? 1)));
    expect(vehicleRecord.seatCapacity).toBeGreaterThanOrEqual(route.staffCount);
    expect(route.loadWeightKg).toBeLessThanOrEqual(vehicleRecord.maxPayloadKg);
    expect(route.loadVolumeM3).toBeLessThanOrEqual(vehicleRecord.maxCargoVolumeM3);
    for (const item of route.packingList) {
      const cargoSides = [vehicleRecord.cargoLengthCm, vehicleRecord.cargoWidthCm, vehicleRecord.cargoHeightCm].sort((a, b) => a - b);
      const itemSides = [item.lengthCm, item.widthCm, item.heightCm].sort((a, b) => a - b);
      expect(itemSides.every((side, index) => side <= cargoSides[index]!)).toBe(true);
    }
    expect(routeJobs.every((job) => (job.allowedCapabilities ?? [job.requiredCapability])
      .some((capability) => pool.capabilities.includes(capability)))).toBe(true);
    expect(routeJobs.every((job, index) => index === 0 ||
      ['Critical', 'High', 'Medium', 'Low'].indexOf(String(routeJobs[index - 1]!.priority)) <=
      ['Critical', 'High', 'Medium', 'Low'].indexOf(String(job.priority)))).toBe(true);
    staffUsed.set(pool.teamId, (staffUsed.get(pool.teamId) ?? 0) + route.staffCount);

    const legs = route.route.legs!;
    expect(legs).toHaveLength(route.waypointOrder.length - 1);
    expect(legs.every((leg) => Number.isFinite(leg.durationSeconds) && leg.durationSeconds >= 0 &&
      Number.isFinite(leg.distanceMetres) && leg.distanceMetres >= 0)).toBe(true);
    const travelSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
    expect(travelSeconds).toBe(route.route.durationSeconds);
    expect(route.totalTravelSeconds).toBe(travelSeconds);
    expect(route.totalDurationSeconds).toBeLessThanOrEqual(4 * 3600);
    expect(route.isWithinFourHourCap).toBe(true);
    expect(route.totalDurationSeconds).toBe(route.totalTravelSeconds + route.totalEffortSeconds + route.onCallLagHours * 3600);

    let elapsed = route.onCallLagHours * 3600;
    expect(route.waypointOrder[0]!.cumulativeDurationSeconds).toBe(elapsed);
    for (let index = 1; index < route.waypointOrder.length; index++) {
      const waypoint = route.waypointOrder[index]!;
      elapsed += legs[index - 1]!.durationSeconds + waypoint.estimatedEffortMinutes * 60;
      expect(waypoint.cumulativeDurationSeconds).toBe(elapsed);
    }
    expect(elapsed).toBe(route.totalDurationSeconds);
  }
  for (const team of teams) expect(staffUsed.get(team.teamId) ?? 0).toBeLessThanOrEqual(team.staffCount ?? 1);
}

describe('independent whole-plan route invariants', () => {
  it('preserves priorities, actual directed-leg ETAs, staff, unique vehicles and the elapsed cap', async () => {
    const teams = [centralTeam, northEastTeam];
    const routes = await new RouteOptimizationService(new DirectedFixtureRoad()).plan(teams, jobs, vehicles);

    expect(routes.flatMap((route) => route.workOrderIds).sort()).toEqual(jobs.map((job) => job.workOrderId).sort());
    expect(routes.find((route) => route.teamId === centralTeam.teamId)?.workOrderIds).toEqual([
      'critical-central', 'medium-central',
    ]);
    expect(routes.find((route) => route.teamId === northEastTeam.teamId)?.workOrderIds).toEqual([
      'high-northeast', 'low-northeast',
    ]);
    expectPlanFeasible(teams, jobs, vehicles, routes);
  });

  it('rejects a road-cheaper cross-swap that would put a three-person task into a one-person crew', async () => {
    const hqA = central;
    const hqB = northEast;
    const a = new GeoPoint(1.319, 103.848);
    const b = new GeoPoint(1.32, 103.849);
    const teamA = { ...centralTeam, staffCount: 1, maxStops: 1 };
    const teamB = { ...northEastTeam, staffCount: 3, maxStops: 1 };
    const work = [
      { workOrderId: 'one-person-task', point: a, requiredCapability: 'Vector', requiredStaff: 1,
        estimatedEffortMinutes: 1, priority: PriorityTier.High },
      { workOrderId: 'staff-limited-task', point: b, requiredCapability: 'Vector', requiredStaff: 3,
        estimatedEffortMinutes: 1, priority: PriorityTier.High },
    ];
    const fleet = [vehicle('central-van', HqLocation.Central, 3), vehicle('northeast-van', HqLocation.NorthEast, 3)];
    const road: IRouteStrategy = { calculateRoute: async (stops) => {
      const task = stops[1]!;
      const atA = task.latitude === a.latitude;
      const fromA = stops[0]!.latitude === hqA.latitude;
      const seconds = atA ? (fromA ? 100 : 150) : (fromA ? 10 : 500);
      const legs = stops.slice(1).map((_, index) => ({ durationSeconds: index === 0 ? Math.floor(seconds / 2) : Math.ceil(seconds / 2), distanceMetres: 50 }));
      return { coordinates: stops, legs, durationSeconds: seconds, distanceMetres: 100, source: 'onemap' };
    } };
    const routes = await new RouteOptimizationService(road).plan([teamA, teamB], work, fleet);

    expect(routes.map((route) => [route.teamId, route.workOrderIds])).toEqual([
      [teamA.teamId, ['one-person-task']], [teamB.teamId, ['staff-limited-task']],
    ]);
    expectPlanFeasible([teamA, teamB], work, fleet, routes);

    const relaxedWork = [work[0]!, { ...work[1]!, requiredStaff: 1 }];
    const control = await new RouteOptimizationService(road).plan([teamA, teamB], relaxedWork, fleet);
    expect(control.map((route) => [route.teamId, route.workOrderIds])).toEqual([
      [teamA.teamId, ['staff-limited-task']], [teamB.teamId, ['one-person-task']],
    ]);
    expect(control.reduce((sum, route) => sum + route.totalTravelSeconds, 0)).toBeLessThan(
      routes.reduce((sum, route) => sum + route.totalTravelSeconds, 0));
    expectPlanFeasible([teamA, teamB], relaxedWork, fleet, control);
  });

  it('rejects a lower combined travel swap when one revised route would exceed four hours, and accepts its feasible control', async () => {
    const a1 = new GeoPoint(1.319, 103.848);
    const a2 = new GeoPoint(1.32, 103.849);
    const b1 = new GeoPoint(1.371, 103.881);
    const b2 = new GeoPoint(1.372, 103.882);
    const teamA = { ...centralTeam, staffCount: 2, maxStops: 2 };
    const teamB = { ...northEastTeam, staffCount: 2, maxStops: 2 };
    const work = [a1, a2, b1, b2].map((point, index) => ({ workOrderId: `swap-${index + 1}`, point,
      requiredCapability: 'Vector', requiredStaff: 1, estimatedEffortMinutes: 1, priority: PriorityTier.High }));
    const fleet = [vehicle('central-van', HqLocation.Central, 2), vehicle('northeast-van', HqLocation.NorthEast, 2)];
    const key = (point: GeoPoint): string => `${point.latitude},${point.longitude}`;
    const aKeys = [a1, a2].map(key).sort().join(';');
    const bKeys = [b1, b2].map(key).sort().join(';');
    const aSwapKeys = [a1, b2].map(key).sort().join(';');
    const bSwapKeys = [b1, a2].map(key).sort().join(';');
    const roadFor = (aSwapSeconds: number): IRouteStrategy => ({ calculateRoute: async (stops) => {
      const fromCentral = stops[0]!.latitude === central.latitude;
      const taskKeys = stops.slice(1, -1).map(key).sort().join(';');
      const seconds = fromCentral
        ? taskKeys === key(a1) ? 100 : taskKeys === aKeys ? 14_000 : taskKeys === aSwapKeys ? aSwapSeconds :
          taskKeys === key(a2) ? 15_000 : 16_000
        : taskKeys === key(b1) ? 300 : taskKeys === bKeys ? 1_000 : taskKeys === bSwapKeys ? 100 :
          taskKeys === key(a1) ? 200 : 16_000;
      const legs = stops.slice(1).map((_, index) => ({
        durationSeconds: index === stops.length - 2 ? seconds - Math.floor(seconds / (stops.length - 1)) * (stops.length - 2)
          : Math.floor(seconds / (stops.length - 1)), distanceMetres: 100,
      }));
      return { coordinates: stops, legs, distanceMetres: legs.length * 100,
        durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0), source: 'onemap' };
    } });
    const planner = new RouteOptimizationService(roadFor(14_350));
    const blocked = await planner.plan([teamA, teamB], work, fleet);
    expect(blocked.flatMap((route) => route.workOrderIds).sort()).toEqual(work.map((job) => job.workOrderId).sort());
    expect([...blocked.find((route) => route.teamId === teamA.teamId)!.workOrderIds].sort()).toEqual([
      work[0]!.workOrderId, work[1]!.workOrderId,
    ].sort());
    expect([...blocked.find((route) => route.teamId === teamB.teamId)!.workOrderIds].sort()).toEqual([
      work[2]!.workOrderId, work[3]!.workOrderId,
    ].sort());
    expectPlanFeasible([teamA, teamB], work, fleet, blocked);

    const control = await new RouteOptimizationService(roadFor(14_250)).plan([teamA, teamB], work, fleet);
    expect([...control.find((route) => route.teamId === teamA.teamId)!.workOrderIds].sort()).toEqual([
      work[0]!.workOrderId, work[3]!.workOrderId,
    ].sort());
    expect([...control.find((route) => route.teamId === teamB.teamId)!.workOrderIds].sort()).toEqual([
      work[1]!.workOrderId, work[2]!.workOrderId,
    ].sort());
    expect(control.reduce((sum, route) => sum + route.totalTravelSeconds, 0)).toBeLessThan(
      blocked.reduce((sum, route) => sum + route.totalTravelSeconds, 0));
    expectPlanFeasible([teamA, teamB], work, fleet, control);
  });
});
