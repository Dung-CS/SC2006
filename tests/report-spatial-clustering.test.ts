import { describe, expect, it } from 'vitest';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { DispatchController, DuplicateWorkOrder } from '../src/control/DispatchController';
import { buildDispatchRouteInputs } from '../src/control/DispatchRouteInputs';
import { principalFor } from '../src/control/DashboardController';
import { MapViewController } from '../src/control/MapViewController';
import { groupNearbyReports, reportClusterDistance } from '../src/control/ReportSpatialClustering';
import { TrendAnalyser } from '../src/control/TrendAnalyser';
import { WorkOrderLifecycleController } from '../src/control/WorkOrderLifecycleController';
import { WorkOrderTransitionTable } from '../src/control/WorkOrderTransitionTable';
import { Report } from '../src/entity/Report';
import { Cluster } from '../src/entity/Cluster';
import { WorkOrder } from '../src/entity/WorkOrder';
import { PestType, PriorityTier, ReportStatus, ReportType, Role, TaskType, WorkOrderStatus } from '../src/entity/enums';
import { GeoPoint, Polygon } from '../src/entity/valueTypes';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../src/persistence/memory/InMemoryStores';
import { InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';
import { InMemoryTreatmentRecordStore, InMemoryWorkOrderStore } from '../src/persistence/memory/InMemoryWorkOrderStores';

const date = '2099-01-01';
const manager = principalFor(Role.OperationsManager, 'manager');
const profiles = ConfigLoader.load().pestProfiles;
function report(id: string, metres = 0, extra: Partial<Report> = {}): Report {
  const r = Object.assign(new Report(), { id, pestType: PestType.Rat, point: new GeoPoint(1.32 + metres / 111195, 103.85),
    type: ReportType.Other, estimatedCount: 2, clusterId: null, workOrderId: null, localityBinding: 'Test',
    corroborationCount: 0, ...extra });
  r.applyStatus(ReportStatus.Verified);
  return r;
}
function order(id: string, sourceReportId: string, state = WorkOrderStatus.Created): WorkOrder {
  const o = Object.assign(new WorkOrder(), { id, sourceReportId, clusterId: null, pestType: PestType.Rat,
    taskType: TaskType.Inspection, priority: PriorityTier.Low, scheduledDate: date });
  o.applyStatus(state);
  return o;
}
function fixture(distance = 100) {
  const reports = new InMemoryReportStore();
  const orders = new InMemoryWorkOrderStore();
  const clusters = new InMemoryClusterStore();
  const scores = new InMemoryPriorityScoreStore();
  const ac = new AccessControlService(new AccessPolicy(), new InMemoryAuditStore());
  const lifecycle = new WorkOrderLifecycleController(new WorkOrderTransitionTable(), orders, new InMemoryTreatmentRecordStore(), null, null);
  const dispatch = new DispatchController(ac, lifecycle, orders, clusters, scores, null, null, 10, null,
    ConfigLoader.load(), null, reports, distance);
  const map = new MapViewController(ac, clusters, scores, new TrendAnalyser(clusters), reports, orders, null, distance);
  const inputs = (source: Report[], proposals: Awaited<ReturnType<DispatchController['proposeDailyList']>> = [], jobs: WorkOrder[] = []) =>
    buildDispatchRouteInputs({ date, profiles, crew: [], orders: jobs, clusters: [], proposals, reports: source, reportClusterDistanceMetres: distance });
  return { reports, orders, clusters, dispatch, map, inputs };
}

describe('Possible duplicate report groups', () => {
  it('bounds diameter rather than chaining and is independent of input order', () => {
    const source = [report('a'), report('b', 80), report('c', 160)];
    const forward = groupNearbyReports(source);
    expect(forward.map((group) => group.reportIds)).toEqual([['a', 'b'], ['c']]);
    expect(groupNearbyReports([...source].reverse()).map((group) => group.id)).toEqual(forward.map((group) => group.id));
    expect(groupNearbyReports(source, 50)).toHaveLength(3);
    expect(groupNearbyReports(source, 250)).toHaveLength(1);
  });

  it('keeps different pests, conditions, tasks and unverified reports apart', () => {
    const submitted = report('submitted'); submitted.applyStatus(ReportStatus.Submitted);
    const closed = report('closed'); closed.applyStatus(ReportStatus.Closed);
    const groups = groupNearbyReports([report('a'), report('roach', 0, { pestType: PestType.Cockroach }),
      report('drain', 0, { type: ReportType.BlockedDrain }), report('refuse', 0, { type: ReportType.UnclearedRefuse }), submitted, closed]);
    expect(groups).toHaveLength(4);
    expect(groups.every((group) => group.reportCount === 1)).toBe(true);
  });

  it('retains the highest priority at an actual report point without summing specimen counts', () => {
    const a = report('a', 0, { estimatedCount: 4 });
    const b = report('b', 60, { estimatedCount: 6, injuryReported: true });
    const [group] = groupNearbyReports([b, a]);
    expect(group).toMatchObject({ id: 'pest-a', priority: 'Critical', reportCount: 2,
      individualCounts: [{ reportId: 'a', estimatedCount: 4 }, { reportId: 'b', estimatedCount: 6 }] });
    expect(group?.representative.point).toBe(b.point);
    expect(a.estimatedCount).toBe(4); expect(b.estimatedCount).toBe(6);
  });

  it('uses one identity in map, detail, daily proposals and route targets while retaining originals', async () => {
    const f = fixture();
    const source = [report('a'), report('b', 60, { estimatedCount: 7 })];
    for (const r of source) await f.reports.save(r);
    const proposals = await f.dispatch.proposeDailyList(date, manager);
    const layers = await f.map.layers(manager);
    const inputs = f.inputs(source, proposals);
    expect(proposals).toHaveLength(1); expect(inputs.jobs).toHaveLength(1);
    expect(layers.clusters).toHaveLength(1); expect(layers.reports).toHaveLength(2);
    expect(layers.clusters[0]).toMatchObject({ clusterId: 'pest-a', reportCount: 2, reportIds: ['a', 'b'], caseSize: 2, countLabel: 'reports', tier: 'High' });
    expect(proposals[0]).toMatchObject({ sourceReportId: 'b', mapClusterId: 'pest-a', tier: 'High', reportCount: 2 });
    expect(inputs.jobs[0]).toMatchObject({ mapClusterId: 'pest-a', sourceReportId: 'b', reportIds: ['a', 'b'], reportCount: 2 });
    expect(await f.map.clusterDetail('pest-a', manager)).toMatchObject({ openReports: 2, reportIds: ['a', 'b'], tier: 'High' });
    expect(await f.reports.findById('a')).toBe(source[0]); expect(await f.reports.findById('b')).toBe(source[1]);
  });

  it('lets an open job on any member suppress the group, without collapsing independent lifecycle jobs', async () => {
    const f = fixture();
    const source = [report('a'), report('b', 30, { injuryReported: true })];
    for (const r of source) await f.reports.save(r);
    const existing = order('existing', 'a'); await f.orders.save(existing);
    expect(await f.dispatch.proposeDailyList(date, manager)).toEqual([]);
    const jobs = f.inputs(source, [], [existing]).jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ workOrderId: 'existing', reportIds: ['a', 'b'], priority: 'Critical', mapClusterId: 'pest-a' });
    const second = order('independent', 'b'); await f.orders.save(second);
    expect(f.inputs(source, [], [existing, second]).jobs.map((job) => job.workOrderId)).toEqual(['existing', 'independent']);
  });

  it('does not resurrect actioned reports linked to completed or verified work, but permits cancelled work to reopen', async () => {
    const f = fixture();
    const r = report('a', 0, { workOrderId: 'resolved' }); r.applyStatus(ReportStatus.Actioned);
    await f.reports.save(r);
    for (const state of [WorkOrderStatus.Completed, WorkOrderStatus.Verified]) {
      const resolved = order('resolved', r.id, state); await f.orders.save(resolved);
      expect(await f.dispatch.proposeDailyList(date, manager)).toEqual([]);
      expect((await f.map.layers(manager)).clusters).toEqual([]);
      expect(f.inputs([r], [], [resolved]).jobs).toEqual([]);
    }
    const cancelled = order('resolved', r.id, WorkOrderStatus.Cancelled); await f.orders.save(cancelled);
    expect(await f.dispatch.proposeDailyList(date, manager)).toHaveLength(1);
    expect(f.inputs([r], [], [cancelled]).jobs).toHaveLength(1);
  });

  it('validates the configurable distance', () => {
    expect(reportClusterDistance(undefined)).toBe(100);
    expect(reportClusterDistance('250')).toBe(250);
    for (const invalid of ['', 'no', '0', '-1', '1001', 'Infinity']) expect(() => reportClusterDistance(invalid)).toThrow();
  });

  it('creates a work order for exactly the nearby compatible issue and allows distant independent work in the same locality', async () => {
    const f = fixture();
    const locality = Object.assign(new Cluster(), { id: 'locality', objectId: 'locality', locality: 'Test', isActive: true,
      boundary: new Polygon([[new GeoPoint(1.32, 103.85)]]) });
    await f.clusters.upsertFromFeed({ records: [locality], retrievedAt: new Date() });
    const source = report('a', 0, { clusterId: 'locality' });
    const near = report('b', 60, { clusterId: 'locality' });
    const far = report('far', 300, { clusterId: 'locality' });
    const differentCondition = report('drain', 0, { clusterId: 'locality', type: ReportType.BlockedDrain });
    for (const r of [source, near, far, differentCondition]) await f.reports.save(r);
    const first = await f.dispatch.createWorkOrder({ sourceReportId: source.id, taskType: TaskType.Inspection, scheduledDate: date }, manager);
    expect(source.workOrderId).toBe(first.id); expect(near.workOrderId).toBe(first.id);
    expect(far.workOrderId).toBeNull(); expect(differentCondition.workOrderId).toBeNull();
    const distant = await f.dispatch.createWorkOrder({ sourceReportId: far.id, taskType: TaskType.Inspection, scheduledDate: date }, manager);
    expect(distant.id).not.toBe(first.id); expect(far.workOrderId).toBe(distant.id);
    // An independently discovered open order with another member as its source blocks the group.
    const f2 = fixture(); const a = report('a'); const b = report('b', 20);
    await f2.reports.save(a); await f2.reports.save(b); await f2.orders.save(order('existing', b.id));
    await expect(f2.dispatch.createWorkOrder({ sourceReportId: a.id, taskType: TaskType.Inspection, scheduledDate: date }, manager))
      .rejects.toBeInstanceOf(DuplicateWorkOrder);
    expect(a.workOrderId).toBeNull(); expect(b.workOrderId).toBeNull();
  });
});
