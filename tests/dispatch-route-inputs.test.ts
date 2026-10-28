import { describe, expect, it } from 'vitest';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { buildDispatchRouteInputs } from '../src/control/DispatchRouteInputs';
import { RouteOptimizationService } from '../src/control/RouteOptimizationService';
import { MockRoadRoutingStrategy } from './helpers/MockRoadRoutingStrategy';
import { Account } from '../src/entity/Account';
import { Cluster } from '../src/entity/Cluster';
import { WorkOrder } from '../src/entity/WorkOrder';
import { Report } from '../src/entity/Report';
import { PriorityScore } from '../src/entity/PriorityScore';
import { HqLocation, LocationContext, PestType, PriorityTier, ReportStatus, ReportType, Role, StaffSpecialisation, StaffStatus, TaskType, WorkOrderStatus } from '../src/entity/enums';
import { GeoPoint, Polygon } from '../src/entity/valueTypes';

const date = '2099-01-01';
const profiles = ConfigLoader.load().pestProfiles;
function crew(id: string, status = StaffStatus.Available): Account {
  return Object.assign(new Account(), { id, role: Role.CleaningCrew, isActive: true,
    specialisation: StaffSpecialisation.VectorControl, hqLocation: HqLocation.Central,
    staffStatus: status, onCallLagHours: 2 });
}
function cluster(id: string): Cluster {
  return Object.assign(new Cluster(), { id, locality: id, isActive: true,
    boundary: new Polygon([[new GeoPoint(1.32, 103.85), new GeoPoint(1.321, 103.851), new GeoPoint(1.319, 103.851)]]) });
}
function order(id: string, clusterId = id): WorkOrder {
  const order = Object.assign(new WorkOrder(), { id, clusterId, scheduledDate: date,
    pestType: PestType.Mosquito, taskType: TaskType.Inspection, priority: PriorityTier.Low, sourceReportId: null });
  order.applyStatus(WorkOrderStatus.Created);
  return order;
}
const build = (overrides: Partial<Parameters<typeof buildDispatchRouteInputs>[0]> = {}) =>
  buildDispatchRouteInputs({ date, profiles, crew: [], orders: [], clusters: [], proposals: [], ...overrides });

describe('Real dispatch candidate admission and staffing', () => {
  it('retains urgent proposals alongside eight existing lower-priority jobs and routes urgent work first', async () => {
    const orders = Array.from({ length: 8 }, (_, i) => order(`low-${i}`));
    const input = build({ crew: [crew('one'), crew('two'), crew('three')], orders,
      clusters: [...orders.map((o) => cluster(o.id)), cluster('urgent')],
      proposals: [{ clusterId: 'urgent', locality: 'urgent', score: 99, tier: PriorityTier.High,
        suggestedTaskType: TaskType.Fogging, pestType: PestType.Mosquito, scheduledDate: date }] });
    expect(input.jobs).toHaveLength(9);
    expect(input.jobs.find((job) => job.priority === PriorityTier.High)?.requiredStaff).toBe(3);
    const routes = await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(input.teams, input.jobs);
    expect(routes.flatMap((r) => r.workOrderIds)).toContain('prop-urgent-Mosquito');
    expect(routes.find((r) => r.workOrderIds.includes('prop-urgent-Mosquito'))?.workOrderIds[0]).toBe('prop-urgent-Mosquito');
  });

  it('counts actual available staff separately from on-call and excludes unusable staff records', () => {
    const input = build({ crew: [crew('a'), crew('b'), crew('c', StaffStatus.OnCall),
      crew('busy', StaffStatus.Dispatched), crew('off', StaffStatus.Unavailable),
      Object.assign(crew('inactive'), { isActive: false }),
      Object.assign(crew('unknown-hq'), { hqLocation: null }),
      Object.assign(crew('unknown-skill'), { specialisation: null })] });
    expect(input.teams).toHaveLength(2);
    expect(input.teams.find((t) => t.status === StaffStatus.Available)?.staffCount).toBe(2);
    expect(input.teams.find((t) => t.status === StaffStatus.OnCall)?.staffCount).toBe(1);
    expect(input.teams.every((t) => t.capabilities.length === 1)).toBe(true);
  });

  it('never invents a depot, staff, emergency, location or legacy pest identity', () => {
    const unknown = Object.assign(order('unknown'), { pestType: null });
    const missingPoint = order('missing-point');
    const input = build({ orders: [unknown, missingPoint], clusters: [cluster('unknown')] });
    expect(input).toEqual({ teams: [], jobs: [], referrals: [] });
  });

  it('uses the report target point and shared pest/skill rules, with referrals excluded', () => {
    const targetPoint = new GeoPoint(1.4, 103.8);
    const rat = Object.assign(order('rat'), { pestType: PestType.Rat, targetPoint });
    const snake = Object.assign(order('snake'), { pestType: PestType.Snake, targetPoint });
    const input = build({ orders: [rat, snake], clusters: [cluster('rat'), cluster('snake')] });
    expect(input.jobs).toHaveLength(1);
    expect(input.jobs[0]?.point).toBe(targetPoint);
    expect(input.jobs[0]?.allowedCapabilities).toContain(StaffSpecialisation.Sanitation);
    expect(input.jobs[0]?.requiredCapability).toBe(StaffSpecialisation.Sanitation);
  });

  it('does not duplicate open work with proposals or schedule completed/future work', () => {
    const done = order('done'); done.applyStatus(WorkOrderStatus.Completed);
    const future = Object.assign(order('future'), { scheduledDate: '2099-01-02' });
    const input = build({ orders: [order('existing', 'site'), done, future],
      clusters: [cluster('site'), cluster('done'), cluster('future')],
      proposals: [{ clusterId: 'site', locality: 'site', score: 99, tier: PriorityTier.High,
        suggestedTaskType: TaskType.Inspection, scheduledDate: date }] });
    expect(input.jobs.map((j) => j.workOrderId)).toEqual(['existing']);
  });

  it('keeps assigned, accepted and rejected work visible and reserves known assignees', () => {
    const committed = Object.assign(order('committed'), { assigneeId: 'busy-crew' });
    committed.applyStatus(WorkOrderStatus.Assigned);
    const accepted = Object.assign(order('accepted'), { assigneeId: 'accepted-crew' });
    accepted.applyStatus(WorkOrderStatus.Accepted);
    const rejected = Object.assign(order('rejected'), { assigneeId: 'rejected-crew' });
    rejected.applyStatus(WorkOrderStatus.Rejected);
    const input = build({ crew: [crew('busy-crew'), crew('accepted-crew'), crew('rejected-crew'), crew('free-crew')],
      orders: [committed, accepted, rejected],
      clusters: [cluster('committed'), cluster('accepted'), cluster('rejected')], proposals: [{ clusterId: 'committed', locality: 'committed', score: 1,
        tier: PriorityTier.High, suggestedTaskType: TaskType.Inspection, scheduledDate: date }] });
    expect(input.jobs).toHaveLength(3);
    expect(input.jobs[0]).toMatchObject({ workOrderId: 'committed', status: WorkOrderStatus.Assigned });
    expect(input.jobs.map((job) => job.status)).toEqual(expect.arrayContaining([
      WorkOrderStatus.Accepted, WorkOrderStatus.Rejected,
    ]));
    expect(input.teams).toHaveLength(1);
    expect(input.teams[0]?.staffCount).toBe(1);
  });

  it('reserves an in-progress assignee and does not create duplicate report-group work', () => {
    const active = Object.assign(order('active'), { assigneeId: 'busy-crew' });
    active.applyStatus(WorkOrderStatus.InProgress);
    const source = report('active-report', PestType.Mosquito, { workOrderId: active.id, clusterId: 'active' });
    const input = build({ crew: [crew('busy-crew')], orders: [active], reports: [source], clusters: [cluster('active')] });
    expect(input.jobs).toHaveLength(1);
    expect(input.jobs[0]?.status).toBe(WorkOrderStatus.InProgress);
    expect(input.teams).toEqual([]);
  });

  it('does not invent an assignee for rejected work with a missing assignee', () => {
    const rejected = order('rejected-no-assignee');
    rejected.applyStatus(WorkOrderStatus.Rejected);
    const input = build({ crew: [crew('available')], orders: [rejected], clusters: [cluster(rejected.id)] });
    expect(input.jobs).toMatchObject([{ workOrderId: rejected.id, status: WorkOrderStatus.Rejected }]);
    expect(input.teams[0]?.staffCount).toBe(1);
  });
});

function report(id: string, pestType: PestType, overrides: Partial<Report> = {}): Report {
  const report = Object.assign(new Report(), { id, pestType, point: new GeoPoint(1.32, 103.85),
    type: ReportType.Other, clusterId: null, localityBinding: id, workOrderId: null, estimatedCount: 6,
    corroborationCount: 0, ...overrides });
  report.applyStatus(ReportStatus.Verified);
  return report;
}

describe('Mixed-pest dispatch admission', () => {
  it('routes verified rat, cockroach and termite reports before a low dengue task, and exposes snake referral', async () => {
    const reports = [report('rat', PestType.Rat), report('roach', PestType.Cockroach), report('termite', PestType.Termite),
      report('snake', PestType.Snake, { locationContext: LocationContext.Indoor })];
    const input = build({ reports, orders: [order('low')], clusters: [cluster('low')],
      crew: [Object.assign(crew('san'), { specialisation: StaffSpecialisation.Sanitation }),
        Object.assign(crew('struct'), { specialisation: StaffSpecialisation.Structural }), crew('vector')] });
    expect(input.jobs.map((j) => j.pestType)).toEqual([PestType.Rat, PestType.Cockroach, PestType.Termite, PestType.Mosquito]);
    expect(input.jobs.slice(0, 3).every((j) => j.priority === PriorityTier.High)).toBe(true);
    expect(input.referrals).toMatchObject([{ reportId: 'snake', pestType: PestType.Snake, priority: 'Critical' }]);
    const routes = await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(input.teams, input.jobs);
    expect(routes.flatMap((r) => r.workOrderIds)).toEqual(expect.arrayContaining(['report-rat', 'report-roach', 'report-termite']));
  });

  it('does not let an open mosquito task suppress a different pest or task at the same locality', () => {
    const input = build({ reports: [report('rat', PestType.Rat, { clusterId: 'shared' })],
      orders: [order('mosquito', 'shared')], clusters: [cluster('shared')],
      proposals: [{ clusterId: 'shared', pestType: PestType.Mosquito, locality: 'shared', score: 1,
        tier: PriorityTier.Low, suggestedTaskType: TaskType.DrainClearance, scheduledDate: date }] });
    expect(input.jobs.map((j) => j.workOrderId)).toEqual(['report-rat', 'mosquito', 'prop-shared-Mosquito']);
  });

  it('does not duplicate a report already represented by an open order, and retains overdue work', () => {
    const source = report('source', PestType.Rat, { workOrderId: 'existing' });
    const existing = Object.assign(order('existing'), { clusterId: null, sourceReportId: source.id,
      scheduledDate: '2098-12-31', pestType: PestType.Rat, targetPoint: source.point });
    const input = build({ reports: [source], orders: [existing] });
    expect(input.jobs).toHaveLength(1);
    expect(input.jobs[0]).toMatchObject({ workOrderId: 'existing', priority: 'High', sourceReportId: 'source' });
  });

  it('uses real report coordinates outside dengue clusters and leaves unknown counts unasserted', () => {
    const unknown = report('unknown', PestType.Cockroach, { estimatedCount: null });
    const submitted = report('submitted', PestType.Termite); submitted.applyStatus(ReportStatus.Submitted);
    const input = build({ reports: [unknown, submitted] });
    expect(input.jobs).toHaveLength(1);
    expect(input.jobs[0]).toMatchObject({ sourceReportId: 'unknown', clusterId: null, mapClusterId: 'pest-unknown', priority: 'Medium' });
    expect(input.jobs[0]?.point).toBe(unknown.point);
  });

  it('escalates an existing same-pest task from report triage and latest locality score', () => {
    const existing = Object.assign(order('rat', 'shared'), { pestType: PestType.Rat });
    const rat = report('rat-report', PestType.Rat, { clusterId: 'shared', injuryReported: true });
    const score = Object.assign(new PriorityScore(), { clusterId: 'other-score-id', localityId: 'shared', pestType: PestType.Rat, tier: PriorityTier.High });
    const input = build({ reports: [rat], orders: [existing], scores: [score], clusters: [cluster('shared')] });
    expect(input.jobs).toHaveLength(1);
    expect(input.jobs[0]?.priority).toBe(PriorityTier.Critical);
  });
});
