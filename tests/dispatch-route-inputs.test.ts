import { describe, expect, it, vi } from 'vitest';
import * as reportGrouping from '../src/control/ReportSpatialClustering';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { buildDispatchRouteInputs } from '../src/control/DispatchRouteInputs';
import { RouteOptimizationService } from '../src/control/RouteOptimizationService';
import { MockRoadRoutingStrategy } from './helpers/MockRoadRoutingStrategy';
import { Account } from '../src/entity/Account';
import { Cluster } from '../src/entity/Cluster';
import { WorkOrder } from '../src/entity/WorkOrder';
import { Report } from '../src/entity/Report';
import { PriorityScore } from '../src/entity/PriorityScore';
import { Driver, HqLocation, LocationContext, PestType, PriorityTier, ReportStatus, ReportType, Role, StaffSpecialisation, StaffStatus, TaskType, WorkOrderStatus } from '../src/entity/enums';
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
  it('uses a verified mosquito source point before a conflicting proposal point and refuses invalid source identity', () => {
    // Isolate the proposal admission path; group admission has its own exact-point coverage below.
    const grouping = vi.spyOn(reportGrouping, 'groupNearbyReports').mockReturnValue([]);
    try {
      const official = cluster('official');
      const source = report('mosquito-source', PestType.Mosquito, { clusterId: official.id, point: new GeoPoint(1.321, 103.851) });
      const proposal = { clusterId: official.id, sourceReportId: source.id, locality: official.locality,
        point: new GeoPoint(1.4, 103.9), score: 90, tier: PriorityTier.High, pestType: PestType.Mosquito,
        suggestedTaskType: TaskType.Inspection, scheduledDate: date };
      const inputs = build({ clusters: [official], reports: [source], proposals: [proposal] });
      expect(inputs.jobs).toHaveLength(1);
      expect(inputs.jobs[0]?.point).toBe(source.point);
      expect(inputs.jobs[0]).not.toHaveProperty('serviceArea');
      expect(build({ clusters: [official], reports: [source], proposals: [{ ...proposal, sourceReportId: 'missing' }] }).jobs).toEqual([]);
      expect(build({ clusters: [official], reports: [Object.assign(source, { pestType: PestType.Rat })], proposals: [proposal] }).jobs).toEqual([]);
    } finally {
      grouping.mockRestore();
    }
  });

  it('attaches official area bounds only to cluster-only work without a recorded target point', () => {
    const official = cluster('official');
    const exact = new GeoPoint(1.32, 103.85);
    const areaOrder = order('area-order', official.id);
    const exactOrder = Object.assign(order('exact-order', 'exact-cluster'), { targetPoint: exact });
    const area = build({ clusters: [official, cluster('exact-cluster')], orders: [areaOrder, exactOrder] });
    expect(area.jobs.find((job) => job.workOrderId === areaOrder.id)).toMatchObject({ serviceArea: official.boundary,
      point: official.boundary.centroid() });
    expect(area.jobs.find((job) => job.workOrderId === exactOrder.id)).not.toHaveProperty('serviceArea');
    expect(area.jobs.find((job) => job.workOrderId === exactOrder.id)?.point).toBe(exact);
    const proposal = { clusterId: official.id, locality: official.locality, score: 90, tier: PriorityTier.High,
      pestType: PestType.Mosquito, suggestedTaskType: TaskType.Inspection, scheduledDate: date };
    expect(build({ clusters: [official], proposals: [proposal] }).jobs[0]).toMatchObject({ serviceArea: official.boundary });
    expect(build({ clusters: [official], proposals: [{ ...proposal, point: exact }] }).jobs[0]).not.toHaveProperty('serviceArea');
    expect(build({ clusters: [Object.assign(cluster('official'), { isActive: false })], proposals: [proposal] }).jobs[0])
      .not.toHaveProperty('serviceArea');
    expect(build({ clusters: [official], proposals: [{ ...proposal, pestType: PestType.Rat }] }).jobs).toEqual([]);
  });

  it('keeps report-backed and linked-report work as exact points even inside an official area', () => {
    const official = cluster('official');
    const source = report('source-area', PestType.Mosquito, { clusterId: official.id, point: new GeoPoint(1.3201, 103.8501) });
    const linked = Object.assign(order('linked', official.id), { sourceReportId: source.id });
    const direct = build({ clusters: [official], reports: [source], orders: [linked] });
    expect(direct.jobs[0]?.point).toBe(source.point);
    expect(direct.jobs[0]).not.toHaveProperty('serviceArea');
    const implicit = build({ clusters: [official], reports: [source], orders: [order('implicit', official.id)] });
    expect(implicit.jobs[0]?.point).toBe(source.point);
    expect(implicit.jobs[0]).not.toHaveProperty('serviceArea');
    const standalone = build({ clusters: [official], reports: [source], proposals: [{ clusterId: official.id,
      sourceReportId: source.id, locality: official.locality, score: 99, tier: PriorityTier.High,
      pestType: PestType.Mosquito, suggestedTaskType: TaskType.Inspection, scheduledDate: date }] });
    expect(standalone.jobs).toHaveLength(1);
    expect(standalone.jobs[0]?.point).toBe(source.point);
    expect(standalone.jobs[0]).not.toHaveProperty('serviceArea');
  });

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

  it('uses exact target points and recorded capability requirements for all authorities', () => {
    const targetPoint = new GeoPoint(1.4, 103.8);
    const rat = Object.assign(order('rat'), { pestType: PestType.Rat, targetPoint });
    const snake = Object.assign(order('snake'), { pestType: PestType.Snake, targetPoint });
    const input = build({ orders: [rat, snake], clusters: [cluster('rat'), cluster('snake')] });
    expect(input.jobs).toHaveLength(2);
    expect(input.jobs[0]?.point).toBe(targetPoint);
    expect(input.jobs[0]?.allowedCapabilities).toContain(StaffSpecialisation.Sanitation);
    expect(input.jobs[0]?.requiredCapability).toBe(StaffSpecialisation.Sanitation);
    expect(input.jobs.find((job) => job.pestType === PestType.Snake)).toMatchObject({
      point: targetPoint, requiredCapability: StaffSpecialisation.AuthorityResponse,
      allowedCapabilities: [StaffSpecialisation.AuthorityResponse], requiredStaff: 2,
    });
    expect(input.referrals).toEqual([]);
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
  it('keeps recorded order priority, highest report triage and exact locality-pest score separate', async () => {
    const clusterId = 'shared';
    const lower = report('lower', PestType.Rat, { clusterId, estimatedCount: 2 });
    const injury = report('injury', PestType.Rat, { clusterId, injuryReported: true });
    const existing = Object.assign(order('existing', clusterId), {
      pestType: PestType.Rat, sourceReportId: injury.id, priority: PriorityTier.Low,
    });
    const score = Object.assign(new PriorityScore(), {
      clusterId: 'legacy-score-key', localityId: clusterId, pestType: PestType.Rat,
      computedAt: new Date('2026-10-30T00:00:00.000Z'), score: 82.5, tier: PriorityTier.High,
      severityMultiplier: 1.25, urgency: 0.66, isDegraded: true,
      excludedDrivers: [Driver.Rainfall24h], overrideRuleName: 'recorded rule',
      contributions: [{ driver: Driver.CaseSize, rawValue: 8, normalisedValue: 0.8, weight: 0.2, contribution: 0.16 }],
    });
    const unrelatedLocality = Object.assign(new PriorityScore(), { ...score, clusterId: 'elsewhere', localityId: 'elsewhere' });
    const wrongPest = Object.assign(new PriorityScore(), { ...score, pestType: PestType.Mosquito });
    const input = build({ crew: [crew('one')], reports: [lower, injury], orders: [existing],
      clusters: [cluster(clusterId)], scores: [wrongPest, unrelatedLocality, score] });
    const job = input.jobs.find((item) => item.workOrderId === existing.id)!;
    expect(job.priority).toBe(PriorityTier.Critical);
    expect(job.scoreExplanation).toEqual({
      workOrderPriority: PriorityTier.Low,
      reportTriage: { priority: PriorityTier.Critical, rationale: 'Injury reported. Seek urgent medical help where needed.' },
      localityScore: {
        value: 82.5, tier: PriorityTier.High, computedAt: '2026-10-30T00:00:00.000Z',
        severity: 1.25, urgency: 0.66, isDegraded: true, excludedDrivers: [Driver.Rainfall24h],
        overrideRuleName: 'recorded rule',
        breakdown: [{ driver: Driver.CaseSize, rawValue: 8, normalisedValue: 0.8, weight: 0.2, contribution: 0.16 }],
      },
    });
    const routes = await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(input.teams, input.jobs);
    expect(routes.flatMap((route) => route.waypointOrder).find((waypoint) => waypoint.workOrderId === existing.id)?.scoreExplanation)
      .toEqual(job.scoreExplanation);
  });

  it('does not attach locality scores for a different pest or locality and does not invent a score', () => {
    const existing = Object.assign(order('rat', 'shared'), { pestType: PestType.Rat });
    const mosquitoScore = Object.assign(new PriorityScore(), { clusterId: 'shared', localityId: 'shared', pestType: PestType.Mosquito });
    const wrongLocalityAlias = Object.assign(new PriorityScore(), { clusterId: 'shared', localityId: 'elsewhere', pestType: PestType.Rat });
    const otherLocalityScore = Object.assign(new PriorityScore(), { clusterId: 'elsewhere', localityId: 'elsewhere', pestType: PestType.Rat });
    const input = build({ orders: [existing], clusters: [cluster('shared')], scores: [mosquitoScore, wrongLocalityAlias, otherLocalityScore] });
    const explanation = input.jobs[0]?.scoreExplanation;
    expect(explanation).toEqual({ workOrderPriority: PriorityTier.Low });
    expect(input.jobs[0]?.priority).toBe(PriorityTier.Low);
    expect(explanation).not.toHaveProperty('localityScore');
  });

  it('labels explicitly tagged demo reports and orders separately while preserving ordinary locality and exact points', () => {
    const demoReport = report('demo-report', PestType.Rat, { description: '[DEMO 20261029 SW-INSPECT] Illustrative task',
      point: new GeoPoint(1.3, 103.8), localityBinding: 'Unassigned' });
    const ordinary = report('ordinary', PestType.Rat, { description: 'A resident mentioned a demo nearby',
      point: new GeoPoint(1.35, 103.8), localityBinding: 'Real locality' });
    const demoOrder = Object.assign(order('demo-order'), { clusterId: null, pestType: PestType.Rat,
      instructions: '[DEMO 20261029 SW-DRAIN] Illustrative task', location: 'Unassigned', targetPoint: new GeoPoint(1.32, 103.8) });
    const input = build({ reports: [demoReport, ordinary], orders: [demoOrder] });
    expect(input.jobs.find((job) => job.sourceReportId === demoReport.id)).toMatchObject({
      locality: 'Unassigned', isDemo: true, point: demoReport.point,
    });
    expect(input.jobs.find((job) => job.workOrderId === demoOrder.id)).toMatchObject({
      locality: 'Unassigned', isDemo: true, point: demoOrder.targetPoint,
    });
    expect(input.jobs.find((job) => job.sourceReportId === ordinary.id)).toMatchObject({
      locality: 'Real locality', isDemo: false, point: ordinary.point,
    });
    expect(demoReport.localityBinding).toBe('Unassigned');
    expect(demoOrder.location).toBe('Unassigned');
  });

  it('admits authority work alongside ordinary pests and leaves it unallocated without qualified crew', async () => {
    const reports = [report('rat', PestType.Rat), report('roach', PestType.Cockroach), report('termite', PestType.Termite),
      report('snake', PestType.Snake, { locationContext: LocationContext.Indoor })];
    const input = build({ reports, orders: [order('low')], clusters: [cluster('low')],
      crew: [Object.assign(crew('san'), { specialisation: StaffSpecialisation.Sanitation }),
        Object.assign(crew('struct'), { specialisation: StaffSpecialisation.Structural }), crew('vector')] });
    expect(input.jobs.map((j) => j.pestType)).toEqual([PestType.Snake, PestType.Rat, PestType.Cockroach, PestType.Termite, PestType.Mosquito]);
    expect(input.jobs.slice(1, 4).every((j) => j.priority === PriorityTier.High)).toBe(true);
    expect(input.referrals).toEqual([]);
    const routes = await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(input.teams, input.jobs);
    expect(routes.flatMap((r) => r.workOrderIds)).toEqual(expect.arrayContaining(['report-rat', 'report-roach', 'report-termite']));
    expect(routes.flatMap((r) => r.workOrderIds)).not.toContain('report-snake');
  });

  it('does not let an open mosquito task suppress a different pest or task at the same locality', () => {
    const input = build({ reports: [report('rat', PestType.Rat, { clusterId: 'shared' })],
      orders: [order('mosquito', 'shared')], clusters: [cluster('shared')],
      proposals: [{ clusterId: 'shared', pestType: PestType.Mosquito, locality: 'shared', score: 1,
        tier: PriorityTier.Low, suggestedTaskType: TaskType.DrainClearance, scheduledDate: date }] });
    expect(input.jobs.map((j) => j.workOrderId)).toEqual(['report-rat', 'mosquito', 'prop-shared-Mosquito']);
  });

  it('rejects standalone high non-mosquito score proposals while preserving report and order evidence', () => {
    const point = new GeoPoint(1.31, 103.91);
    const verified = report('verified-ant', PestType.Ant, { point, clusterId: 'soon-lee', localityBinding: 'Soon Lee Rd' });
    const explicit = Object.assign(order('explicit-order', 'soon-lee'), { pestType: PestType.Rat,
      taskType: TaskType.Inspection, targetPoint: new GeoPoint(1.32, 103.92) });
    const proposals = [PriorityTier.Critical, PriorityTier.High].map((tier, i) => ({
      clusterId: 'soon-lee', pestType: PestType.Cockroach, locality: 'Soon Lee Rd', score: 99 - i,
      tier, suggestedTaskType: TaskType.Inspection, scheduledDate: date,
    }));
    proposals.push({ clusterId: 'soon-lee', pestType: PestType.Cockroach, locality: 'Soon Lee Rd', score: 100,
      tier: PriorityTier.Critical, suggestedTaskType: TaskType.Inspection, scheduledDate: date,
      sourceReportId: 'missing-report', point: new GeoPoint(1.5, 104) } as typeof proposals[number]);
    proposals.push({ clusterId: 'soon-lee', pestType: PestType.Ant, locality: 'Soon Lee Rd', score: 100,
      tier: PriorityTier.Critical, suggestedTaskType: TaskType.Inspection, scheduledDate: date,
      sourceReportId: verified.id, point: new GeoPoint(1.5, 104) } as typeof proposals[number]);
    const before = structuredClone(proposals);
    const input = build({ clusters: [cluster('soon-lee')], reports: [verified], orders: [explicit], proposals });
    expect(input.jobs.map((job) => job.workOrderId)).toEqual(expect.arrayContaining(['explicit-order', 'report-verified-ant']));
    expect(input.jobs).toHaveLength(2);
    expect(input.jobs.find((job) => job.sourceReportId === verified.id)).toMatchObject({
      point, sourceReportId: verified.id, reportIds: [verified.id], locality: 'Soon Lee Rd',
    });
    expect(input.jobs.find((job) => job.workOrderId === explicit.id)?.point).toBe(explicit.targetPoint);
    expect(proposals).toEqual(before);
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
