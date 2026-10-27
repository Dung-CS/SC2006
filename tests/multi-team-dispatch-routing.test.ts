import { describe, expect, it } from 'vitest';
import { GeoPoint } from '../src/entity/valueTypes';
import { StaffSpecialisation, StaffStatus, PriorityTier, TaskType, PestType } from '../src/entity/enums';
import {
  RouteOptimizationService,
  RouteTeam,
  RouteJob,
  estimateEffortMinutes,
  checkRequiresBaseReturn,
  generatePackingList,
} from '../src/control/RouteOptimizationService';
import { IRouteStrategy, RoutePlan } from '../src/control/routing/IRouteStrategy';

class MockRouteStrategy implements IRouteStrategy {
  async calculateRoute(stops: GeoPoint[]): Promise<RoutePlan> {
    let distanceMetres = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      distanceMetres += stops[i]!.distanceTo(stops[i + 1]!);
    }
    const durationSeconds = Math.round(distanceMetres / 9.72);
    return {
      coordinates: stops,
      distanceMetres,
      durationSeconds,
      source: 'onemap',
    };
  }
}

describe('Multi-Team Dispatch Routing & Logistics Optimization', () => {
  const strategy = new MockRouteStrategy();
  const planner = new RouteOptimizationService(strategy);

  const hqCentral = new GeoPoint(1.3521, 103.8198);
  const hqEast = new GeoPoint(1.3550, 103.9450);
  const hqWest = new GeoPoint(1.3400, 103.7050);

  const teams: RouteTeam[] = [
    {
      teamId: 'Central-VectorControl',
      staffCount: 3,
      hq: hqCentral,
      capabilities: [StaffSpecialisation.VectorControl, StaffSpecialisation.GeneralInspection],
      status: StaffStatus.Available,
    },
    {
      teamId: 'NorthEast-Sanitation',
      staffCount: 2,
      hq: hqEast,
      capabilities: [StaffSpecialisation.Sanitation, StaffSpecialisation.GeneralInspection],
      status: StaffStatus.Available,
    },
    {
      teamId: 'SouthWest-OnCall',
      staffCount: 3,
      hq: hqWest,
      capabilities: [StaffSpecialisation.VectorControl, StaffSpecialisation.Sanitation],
      status: StaffStatus.OnCall,
      onCallLagHours: 2,
    },
  ];

  it('estimates task efforts accurately according to pest and intervention type', () => {
    expect(estimateEffortMinutes(TaskType.Fogging)).toBe(45);
    expect(estimateEffortMinutes(TaskType.Larviciding)).toBe(40);
    expect(estimateEffortMinutes(TaskType.Inspection)).toBe(30);
    expect(estimateEffortMinutes(undefined, PestType.Snake)).toBe(60);
    expect(estimateEffortMinutes(undefined, PestType.WildBoar)).toBe(75);
  });

  it('does not mandate a depot return based on pest type', () => {
    expect(checkRequiresBaseReturn(undefined, PestType.Snake)).toBe(false);
    expect(checkRequiresBaseReturn(undefined, PestType.WildBoar)).toBe(false);
    expect(checkRequiresBaseReturn(TaskType.Fogging, PestType.Mosquito)).toBe(false);
    expect(checkRequiresBaseReturn(TaskType.DrainClearance, PestType.Mosquito)).toBe(false);
  });

  it('generates a logistics packing list with specialist equipment and safety gear', () => {
    const jobs: RouteJob[] = [
      {
        workOrderId: 'w1',
        point: new GeoPoint(1.35, 103.82),
        requiredCapability: StaffSpecialisation.VectorControl,
        taskType: TaskType.Fogging,
      },
      {
        workOrderId: 'w2',
        point: new GeoPoint(1.36, 103.83),
        requiredCapability: StaffSpecialisation.VectorControl,
        pestType: PestType.Snake,
      },
    ];

    const packing = generatePackingList(jobs);
    expect(packing.some((i) => i.item.includes('Safety Vests'))).toBe(true);
    expect(packing.some((i) => i.item.includes('Thermal Fogger'))).toBe(true);
    expect(packing.some((i) => i.item.includes('Snake Tongs'))).toBe(true);
    expect(packing.some((i) => i.item.includes('Snake Transport Container'))).toBe(true);
    expect(packing.some((i) => i.item.includes('Animal Handling Gauntlets'))).toBe(true);
  });

  it('enforces strict 4-hour dispatch cap and sequences high-priority tasks first', async () => {
    const jobs: RouteJob[] = [
      {
        workOrderId: 'low-routine-inspection',
        point: new GeoPoint(1.3530, 103.8210),
        requiredCapability: StaffSpecialisation.VectorControl,
        taskType: TaskType.Inspection,
        priority: PriorityTier.Low,
        score: 30,
      },
      {
        workOrderId: 'critical-snake-capture',
        point: new GeoPoint(1.3700, 103.8250),
        requiredCapability: StaffSpecialisation.VectorControl,
        pestType: PestType.Snake,
        priority: PriorityTier.Critical,
        score: 95,
      },
      {
        workOrderId: 'high-dengue-fogging',
        point: new GeoPoint(1.3600, 103.8230),
        requiredCapability: StaffSpecialisation.VectorControl,
        taskType: TaskType.Fogging,
        priority: PriorityTier.High,
        score: 80,
      },
      {
        workOrderId: 'sanitation-drain-clearance',
        point: new GeoPoint(1.3560, 103.9460),
        requiredCapability: StaffSpecialisation.Sanitation,
        taskType: TaskType.DrainClearance,
        priority: PriorityTier.Medium,
        score: 60,
      },
    ];

    const routes = await planner.plan(teams, jobs);
    expect(routes.length).toBeGreaterThanOrEqual(1);

    for (const r of routes) {
      // Strictly capped at 4 hours (14,400s)
      expect(r.totalDurationSeconds).toBeLessThanOrEqual(14400);
      expect(r.isWithinFourHourCap).toBe(true);
      expect(r.packingList.length).toBeGreaterThan(0);
      expect(r.waypointOrder.length).toBeGreaterThanOrEqual(2);
    }

    // Verify Central team took the critical snake capture without an automatic intermediate return.
    const centralRoute = routes.find((r) => r.teamId === 'Central-VectorControl');
    expect(centralRoute).toBeDefined();

    if (centralRoute) {
      // Critical snake task should be scheduled before low routine inspection
      const snakeIdx = centralRoute.waypointOrder.findIndex((wp) => wp.pestType === PestType.Snake);
      const lowIdx = centralRoute.waypointOrder.findIndex((wp) => wp.priority === PriorityTier.Low);

      if (snakeIdx >= 0 && lowIdx >= 0) {
        expect(snakeIdx).toBeLessThan(lowIdx);
      }

      // Task type no longer forces a base return; vehicle load governs route feasibility.
      const baseReturnWp = centralRoute.waypointOrder.find((wp) => wp.isBaseReturn);
      expect(baseReturnWp).toBeUndefined();
    }
  });
});
