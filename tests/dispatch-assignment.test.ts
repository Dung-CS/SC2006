import { describe, expect, it } from 'vitest';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { principalFor } from '../src/control/DashboardController';
import { DispatchAssignmentRejected, DispatchAssignmentService } from '../src/control/DispatchAssignmentService';
import { buildDispatchRouteInputs } from '../src/control/DispatchRouteInputs';
import { ModerationController } from '../src/control/ModerationController';
import { ReportLifecycleController } from '../src/control/ReportLifecycleController';
import { ReportTransitionTable } from '../src/control/ReportTransitionTable';
import { RouteOptimizationService } from '../src/control/RouteOptimizationService';
import { DirectDistanceRoutingStrategy } from '../src/control/routing/DirectDistanceRoutingStrategy';
import { IRouteStrategy, RoutePlan } from '../src/control/routing/IRouteStrategy';
import { Account } from '../src/entity/Account';
import { Report } from '../src/entity/Report';
import { WorkOrder } from '../src/entity/WorkOrder';
import { HqLocation, PestType, PriorityTier, ReportStatus, ReportType, Role, StaffSpecialisation, StaffStatus, TaskType, WorkOrderStatus } from '../src/entity/enums';
import { GeoPoint } from '../src/entity/valueTypes';
import { DispatchAssignmentUnit } from '../src/persistence/DispatchAssignmentUnit';
import { InMemoryVehicleStore } from '../src/persistence/VehicleRepository';
import { InMemoryAccountStore } from '../src/persistence/memory/InMemoryAccountStores';
import { InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../src/persistence/memory/InMemoryStores';
import { InMemoryTreatmentRecordStore, InMemoryWorkOrderStore } from '../src/persistence/memory/InMemoryWorkOrderStores';
import { MockRoadRoutingStrategy } from './helpers/MockRoadRoutingStrategy';

const date = '2099-01-01';
const manager = principalFor(Role.OperationsManager, 'manager');
const config = ConfigLoader.load();
const points: Record<string, GeoPoint> = {
  a: new GeoPoint(1.3000, 103.8500), b: new GeoPoint(1.3050, 103.8550), c: new GeoPoint(1.3100, 103.8450), d: new GeoPoint(1.2950, 103.8400),
};

/** Adds a fixed delay to the first leg so the route breaks the four-hour cap. */
class SlowRoad extends MockRoadRoutingStrategy {
  override async calculateRoute(stops: GeoPoint[]): Promise<RoutePlan> {
    const plan = await super.calculateRoute(stops);
    return { ...plan, durationSeconds: plan.durationSeconds + 20_000,
      legs: plan.legs?.map((leg, index) => index === 0 ? { ...leg, durationSeconds: leg.durationSeconds + 20_000 } : leg) };
  }
}

/** Mirrors the live failure: OneMap answers fresh legs with HTTP 429 for the first `limited` calls. */
class RateLimitedRoad extends MockRoadRoutingStrategy {
  constructor(private limited: number) { super(); }
  override async calculateRoute(stops: GeoPoint[]): Promise<RoutePlan> {
    if (this.limited-- > 0) throw new Error('OneMap driving route failed: 429');
    return super.calculateRoute(stops);
  }
}

async function fixture(manualStrategy: IRouteStrategy = new MockRoadRoutingStrategy(), planned = ['a', 'b']) {
  const workOrders = new InMemoryWorkOrderStore();
  const reports = new InMemoryReportStore();
  const accounts = new InMemoryAccountStore();
  const vehicles = new InMemoryVehicleStore();
  const clusters = new InMemoryClusterStore();
  const audit = new InMemoryAuditStore();
  const ac = new AccessControlService(new AccessPolicy(), audit);
  for (const id of ['crew-1', 'crew-2']) {
    await accounts.save(Object.assign(new Account(), { id, email: `${id}@example.test`, role: Role.CleaningCrew, isActive: true,
      specialisation: StaffSpecialisation.VectorControl, hqLocation: HqLocation.Central, staffStatus: StaffStatus.Available, onCallLagHours: 0 }));
  }
  for (const id of ['van-1', 'van-2']) {
    await vehicles.save({ id, registration: id.toUpperCase(), name: id, hqLocation: HqLocation.Central, maxPayloadKg: 1000, maxCargoVolumeM3: 10,
      cargoLengthCm: 300, cargoWidthCm: 200, cargoHeightCm: 200, seatCapacity: 4, isAvailable: true, isDemo: false });
  }
  for (const [key, point] of Object.entries(points)) {
    const report = Object.assign(new Report(), { id: `report-src-${key}`, pestType: PestType.Mosquito, clusterId: null, workOrderId: null,
      point, localityBinding: key, type: ReportType.StandingWater, description: 'Standing water', submittedAt: new Date() });
    report.applyStatus(ReportStatus.Verified);
    await reports.save(report);
    const order = Object.assign(new WorkOrder(), { id: key, clusterId: null, scheduledDate: date, pestType: PestType.Mosquito,
      taskType: TaskType.Inspection, priority: PriorityTier.Low, sourceReportId: report.id, targetPoint: point });
    order.applyStatus(WorkOrderStatus.Created);
    await workOrders.save(order);
  }
  const stores = { accounts, workOrders, reports, clusters, scores: new InMemoryPriorityScoreStore(), audit, treatments: new InMemoryTreatmentRecordStore(), vehicles };
  const unit = new DispatchAssignmentUnit(null, stores, ac, config);
  const inputs = async () => buildDispatchRouteInputs({ date, profiles: config.pestProfiles, crew: await accounts.findByRole(Role.CleaningCrew),
    orders: await workOrders.findAllOpen(), clusters: [], proposals: [], reports: [...await reports.findByStatus(ReportStatus.Verified), ...await reports.findByStatus(ReportStatus.Actioned)] });
  const first = await inputs();
  const [route] = await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(first.teams,
    first.jobs.filter((job) => planned.includes(job.workOrderId)), await vehicles.list());
  const computedAt = '2098-12-31T00:00:00.000Z';
  let invalidations = 0;
  const service = new DispatchAssignmentService(ac, { findReadyRoute: () => ({ route: structuredClone(route!), computedAt }) }, unit, config,
    () => { invalidations++; }, { jobs: async () => (await inputs()).jobs, planner: new RouteOptimizationService(manualStrategy) });
  const order = async (id: string) => (await workOrders.findById(id))!;
  const saved = async () => (await unit.read().assignments.list(date))[0]!;
  return { service, route: route!, computedAt, workOrders, reports, accounts, ac, audit, unit, order, saved, invalidations: () => invalidations };
}

const set = (f: Awaited<ReturnType<typeof fixture>>, workOrderIds?: string[], crewIds = ['crew-1'], vehicleId = 'van-1') =>
  f.service.assign({ date, teamId: f.route.teamId, crewIds, vehicleId, computedAt: f.computedAt, ...(workOrderIds ? { workOrderIds } : {}) }, manager);

describe('dispatch assignment: manual set before saving', () => {
  it('saves the manager stop order after a fresh road route, and adds and removes tasks', async () => {
    const f = await fixture();
    expect([...f.route.workOrderIds].sort()).toEqual(['a', 'b']);
    const saved = await set(f, ['c', 'b']);
    expect(saved.workOrderIds).toEqual(['c', 'b']);
    expect(saved.routeSnapshot.workOrderIds).toEqual(['c', 'b']);
    expect(saved.routeSnapshot.waypointOrder.filter((stop) => !stop.isHq).map((stop) => stop.workOrderId)).toEqual(['c', 'b']);
    expect(saved.routeSnapshot.route.source).toBe('onemap');
    expect((await f.order('c')).currentStatus()).toBe(WorkOrderStatus.Assigned);
    expect((await f.order('a')).currentStatus()).toBe(WorkOrderStatus.Created);
    expect((await f.order('a')).dispatchAssignmentId).toBeNull();
    expect(f.invalidations()).toBe(1);
  });

  it('keeps the planned route when the list is unchanged and names real work orders in the snapshot', async () => {
    const f = await fixture();
    const saved = await set(f, [...f.route.workOrderIds]);
    expect(saved.routeSnapshot.waypointOrder.filter((stop) => !stop.isHq).map((stop) => stop.workOrderId)).toEqual(f.route.workOrderIds);
  });

  it('refuses an unverified road route and saves nothing', async () => {
    const f = await fixture(new DirectDistanceRoutingStrategy());
    await expect(set(f, ['c', 'b'])).rejects.toThrow(/road route .* could not be verified/);
    expect(await f.unit.read().assignments.list(date)).toEqual([]);
    expect((await f.order('b')).currentStatus()).toBe(WorkOrderStatus.Created);
  });

  it('retries a reorder that OneMap rate-limits, then saves the new order', async () => {
    DispatchAssignmentService.rateLimitRetryMs = [0, 0];
    const f = await fixture(new RateLimitedRoad(1));
    const reversed = [...f.route.workOrderIds].reverse();
    const saved = await set(f, reversed);
    expect(saved.workOrderIds).toEqual(reversed);
  });

  it('says OneMap is limiting requests, not that the route is invalid, when the limit persists', async () => {
    DispatchAssignmentService.rateLimitRetryMs = [0, 0];
    const f = await fixture(new RateLimitedRoad(Infinity));
    const failure = await set(f, [...f.route.workOrderIds].reverse()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DispatchAssignmentRejected);
    expect((failure as DispatchAssignmentRejected).message).toMatch(/OneMap is limiting/);
    expect((failure as DispatchAssignmentRejected).message).not.toMatch(/could not be verified/);
    expect((failure as DispatchAssignmentRejected).status).toBe(503);
    expect(await f.unit.read().assignments.list(date)).toEqual([]);
  });

  it('refuses a route over the four-hour cap and saves nothing', async () => {
    const f = await fixture(new SlowRoad());
    await expect(set(f, [...f.route.workOrderIds].reverse())).rejects.toThrow(/four-hour/);
    expect(await f.unit.read().assignments.list(date)).toEqual([]);
  });
});

describe('dispatch assignment: report-sourced stop', () => {
  it('books a planned report-<uuid> stop without calling findById on it (Postgres rejects non-uuid ids)', async () => {
    const f = await fixture();
    const id = '11111111-0000-4000-8000-000000000013';
    const report = Object.assign(new Report(), { id, pestType: PestType.Mosquito, clusterId: null, workOrderId: null,
      point: new GeoPoint(1.3200, 103.8600), localityBinding: 'new', type: ReportType.StandingWater, description: 'Standing water', submittedAt: new Date() });
    report.applyStatus(ReportStatus.Verified);
    await f.reports.save(report);
    const realFind = f.workOrders.findById.bind(f.workOrders);
    const original = Object.getPrototypeOf(f.workOrders).findById;
    // Staged copies of the store inherit this override, so it must use `this`, not the first store.
    f.workOrders.findById = async function (this: unknown, key: string) {
      if (/^(report|prop)-/.test(key)) throw new Error(`invalid input syntax for type uuid: "${key}"`);
      return original.call(this, key);
    };
    const saved = await set(f, [`report-${id}`]);
    expect(saved.workOrderIds).toHaveLength(1);
    const created = await realFind(saved.workOrderIds[0]!);
    expect(created?.sourceReportId).toBe(id);
    expect(created?.currentStatus()).toBe(WorkOrderStatus.Assigned);
  });
});

describe('dispatch assignment: edit after saving', () => {
  it('changes crew, vehicle and stops; a removed task returns to unassigned', async () => {
    const f = await fixture();
    const first = await set(f);
    const removed = first.workOrderIds[0]!;
    const kept = first.workOrderIds[1]!;
    const edited = await f.service.edit({ date, assignmentId: first.id, crewIds: ['crew-2'], vehicleId: 'van-2', workOrderIds: ['d', kept] }, manager);
    expect(edited.workOrderIds).toEqual(['d', kept]);
    expect(edited.crewIds).toEqual(['crew-2']);
    expect(edited.routeSnapshot.vehicleId).toBe('van-2');
    expect(edited.routeSnapshot.crewMembers?.map((member) => member.id)).toEqual(['crew-2']);
    expect(edited.updatedBy).toBe(manager.accountId);
    const gone = await f.order(removed);
    expect(gone.currentStatus()).toBe(WorkOrderStatus.Created);
    expect([gone.dispatchAssignmentId, gone.assigneeId, gone.assignedVehicleId, gone.assignedCrewIds]).toEqual([null, null, null, []]);
    const added = await f.order('d');
    expect([added.currentStatus(), added.dispatchAssignmentId, added.assigneeId, added.assignedVehicleId]).toEqual([WorkOrderStatus.Assigned, first.id, 'crew-2', 'van-2']);
    expect((await f.saved()).workOrderIds).toEqual(['d', kept]);
    // Crew and vehicle of the old booking are free again.
    const options = await f.service.options(date, f.route.teamId, manager);
    expect(options.crew.map((member) => member.id)).toContain('crew-1');
    expect(options.vehicles.map((vehicle) => vehicle.id)).toContain('van-1');
  });

  it('refuses once a task is Accepted and changes nothing', async () => {
    const f = await fixture();
    const first = await set(f);
    const accepted = await f.order(first.workOrderIds[0]!);
    accepted.applyStatus(WorkOrderStatus.Accepted);
    await f.workOrders.save(accepted);
    await expect(f.service.edit({ date, assignmentId: first.id, crewIds: ['crew-1'], vehicleId: 'van-1', workOrderIds: [first.workOrderIds[1]!] }, manager))
      .rejects.toThrow(/can no longer be edited/);
    expect((await f.saved()).workOrderIds).toEqual(first.workOrderIds);
  });

  it('refuses an edit whose road route fails and keeps the saved booking whole', async () => {
    const f = await fixture(new SlowRoad());
    const first = await set(f);
    await expect(f.service.edit({ date, assignmentId: first.id, crewIds: ['crew-1'], vehicleId: 'van-1', workOrderIds: ['c', ...first.workOrderIds] }, manager))
      .rejects.toBeInstanceOf(DispatchAssignmentRejected);
    expect((await f.saved()).workOrderIds).toEqual(first.workOrderIds);
    expect((await f.order('c')).currentStatus()).toBe(WorkOrderStatus.Created);
  });
});

describe('dispatch assignment: report reject removes its stop', () => {
  const reason = 'Photo shows a neighbour pond, not a breeding site.';
  async function moderated(strategy?: IRouteStrategy) {
    const f = await fixture(strategy);
    const lifecycle = new ReportLifecycleController(new ReportTransitionTable(), f.reports, null, f.audit);
    const moderation = new ModerationController(f.ac, f.reports, lifecycle);
    moderation.linkWorkOrders(f.workOrders, { cancel: async () => { throw new Error('the dispatch path must cancel'); } });
    moderation.linkDispatch(f.service);
    return { ...f, moderation };
  }

  it('removes one of several stops, keeps the dispatch and re-routes the rest', async () => {
    const f = await moderated();
    const first = await set(f);
    const [gone, kept] = first.workOrderIds as [string, string];
    await f.moderation.reject(`report-src-${gone}`, reason, manager);
    expect((await f.reports.findById(`report-src-${gone}`))?.currentStatus()).toBe(ReportStatus.Rejected);
    expect((await f.order(gone)).currentStatus()).toBe(WorkOrderStatus.Cancelled);
    const after = await f.saved();
    expect(after.status).toBeUndefined();
    expect(after.workOrderIds).toEqual([kept]);
    expect(after.needsRoadCheck).toBe(false);
    expect(after.routeSnapshot.waypointOrder.filter((stop) => !stop.isHq).map((stop) => stop.workOrderId)).toEqual([kept]);
    expect((await f.order(kept)).currentStatus()).toBe(WorkOrderStatus.Assigned);
  });

  it('cancels the dispatch when the rejected report was its only stop, freeing crew and vehicle', async () => {
    const f = await moderated();
    const first = await set(f, ['c']);
    await f.moderation.reject('report-src-c', reason, manager);
    const after = await f.saved();
    expect(after.id).toBe(first.id);
    expect(after.status).toBe('Cancelled');
    expect((await f.order('c')).currentStatus()).toBe(WorkOrderStatus.Cancelled);
    expect((await f.service.list(date, manager))[0]?.status).toBe('Cancelled');
    const options = await f.service.options(date, f.route.teamId, manager);
    expect(options.crew.map((member) => member.id)).toContain('crew-1');
    expect(options.vehicles.map((vehicle) => vehicle.id)).toContain('van-1');
  });

  it('never fails on routing: keeps the remaining stops in order and flags a fresh road check', async () => {
    const f = await moderated(new SlowRoad());
    const first = await set(f);
    const [gone, kept] = first.workOrderIds as [string, string];
    await f.moderation.reject(`report-src-${gone}`, reason, manager);
    const after = await f.saved();
    expect(after.workOrderIds).toEqual([kept]);
    expect(after.needsRoadCheck).toBe(true);
    expect(after.routeSnapshot.waypointOrder.filter((stop) => !stop.isHq).map((stop) => stop.workOrderId)).toEqual([kept]);
    expect((await f.reports.findById(`report-src-${gone}`))?.currentStatus()).toBe(ReportStatus.Rejected);
  });

  it('a refused report reject leaves the dispatch untouched', async () => {
    const f = await moderated();
    const first = await set(f);
    await expect(f.moderation.reject(`report-src-${first.workOrderIds[0]}`, 'short', manager)).rejects.toThrow();
    expect((await f.saved()).workOrderIds).toEqual(first.workOrderIds);
    expect((await f.order(first.workOrderIds[0]!)).currentStatus()).toBe(WorkOrderStatus.Assigned);
  });
});
