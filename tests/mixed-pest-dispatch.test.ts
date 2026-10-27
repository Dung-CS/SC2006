import { describe, expect, it } from 'vitest';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { DispatchController } from '../src/control/DispatchController';
import { principalFor } from '../src/control/DashboardController';
import { WorkOrderLifecycleController } from '../src/control/WorkOrderLifecycleController';
import { WorkOrderTransitionTable } from '../src/control/WorkOrderTransitionTable';
import { Report } from '../src/entity/Report';
import { Cluster } from '../src/entity/Cluster';
import { PriorityScore } from '../src/entity/PriorityScore';
import { WorkOrder } from '../src/entity/WorkOrder';
import { GeoPoint, Polygon, PremisesMix } from '../src/entity/valueTypes';
import { LocationContext, PestType, PriorityTier, ReportStatus, ReportType, Role, TaskType, WorkOrderStatus } from '../src/entity/enums';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../src/persistence/memory/InMemoryStores';
import { InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';
import { InMemoryTreatmentRecordStore, InMemoryWorkOrderStore } from '../src/persistence/memory/InMemoryWorkOrderStores';

const date = '2099-01-01';
const manager = principalFor(Role.OperationsManager, 'manager');
function fixture(limit = 10) {
  const reports = new InMemoryReportStore();
  const orders = new InMemoryWorkOrderStore();
  const clusters = new InMemoryClusterStore();
  const scores = new InMemoryPriorityScoreStore();
  const ac = new AccessControlService(new AccessPolicy(), new InMemoryAuditStore());
  const lifecycle = new WorkOrderLifecycleController(new WorkOrderTransitionTable(), orders, new InMemoryTreatmentRecordStore(), null, null);
  return { reports, orders, clusters, scores, dispatch: new DispatchController(ac, lifecycle, orders, clusters,
    scores, null, null, limit, null, ConfigLoader.load(), null, reports) };
}
function report(id: string, pest: PestType, over: Partial<Report> = {}): Report {
  const report = Object.assign(new Report(), { id, pestType: pest, clusterId: null, workOrderId: null,
    point: new GeoPoint(1.32, 103.85), localityBinding: id, estimatedCount: 10,
    type: ReportType.Other, ...over });
  report.applyStatus(ReportStatus.Verified);
  return report;
}
async function cluster(f: ReturnType<typeof fixture>): Promise<Cluster> {
  const c = Object.assign(new Cluster(), { id: 'locality', objectId: 'locality', locality: 'locality',
    isActive: true, premisesMix: new PremisesMix([], [], []),
    boundary: new Polygon([[new GeoPoint(1.32, 103.85)]]) });
  await f.clusters.upsertFromFeed({ records: [c], retrievedAt: new Date() });
  return c;
}

describe('Daily dispatch combines report triage and locality scores', () => {
  it('retains unscored non-dengue tasks and referrals before the display limit', async () => {
    const f = fixture(1);
    const c = await cluster(f);
    await f.scores.saveAll([Object.assign(new PriorityScore(), { clusterId: c.id, localityId: c.id,
      pestType: PestType.Mosquito, tier: PriorityTier.Low, score: 1, rank: 1 })]);
    for (const r of [report('rat', PestType.Rat), report('termite', PestType.Termite),
      report('snake', PestType.Snake, { locationContext: LocationContext.Indoor })]) await f.reports.save(r);
    const displayed = await f.dispatch.proposeDailyList(date, manager);
    const all = await f.dispatch.proposeDailyList(date, manager, Infinity);
    expect(displayed).toHaveLength(1);
    expect(displayed[0]).toMatchObject({ sourceReportId: 'snake', tier: 'Critical', referralAuthority: expect.stringMatching(/^AVS/) });
    expect(all).toHaveLength(4);
    expect(all.map((p) => p.tier)).toEqual(['Critical', 'High', 'High', 'Low']);
    expect(all.find((p) => p.sourceReportId === 'rat')).toMatchObject({ point: { latitude: 1.32, longitude: 103.85 }, priorityBasis: 'ReportTriage' });
  });

  it('does not let one pest/task occupy all work at the same locality', async () => {
    const f = fixture();
    const c = await cluster(f);
    const order = Object.assign(new WorkOrder(), { id: 'mosquito-order', clusterId: c.id,
      sourceReportId: null, pestType: PestType.Mosquito, taskType: TaskType.Fogging, scheduledDate: date });
    order.applyStatus(WorkOrderStatus.Created);
    await f.orders.save(order);
    await f.reports.save(report('rat', PestType.Rat, { clusterId: c.id }));
    await f.scores.saveAll([Object.assign(new PriorityScore(), { clusterId: 'legacy-score-subject', localityId: c.id,
      pestType: PestType.Cockroach, tier: PriorityTier.High, score: 80, rank: 1 })]);
    const proposed = await f.dispatch.proposeDailyList(date, manager);
    expect(proposed).toHaveLength(2);
    expect(proposed.map((p) => p.pestType)).toEqual(expect.arrayContaining([PestType.Rat, PestType.Cockroach]));
    expect(proposed.every((p) => p.tier === 'High')).toBe(true);
  });

  it('keeps submitted reports out and uses the recorded condition for task requirements', async () => {
    const f = fixture();
    await f.reports.save(report('drain', PestType.Cockroach, { type: ReportType.BlockedDrain }));
    const submitted = report('unverified', PestType.Termite); submitted.applyStatus(ReportStatus.Submitted);
    await f.reports.save(submitted);
    const proposed = await f.dispatch.proposeDailyList(date, manager);
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({ sourceReportId: 'drain', suggestedTaskType: TaskType.DrainClearance });
  });
});
