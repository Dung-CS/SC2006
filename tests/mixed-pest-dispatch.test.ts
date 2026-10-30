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
import { Driver, HqLocation, LocationContext, PestType, PriorityTier, ReportStatus, ReportType, Role, StaffSpecialisation, StaffStatus, TaskType, WorkOrderStatus } from '../src/entity/enums';
import { Account } from '../src/entity/Account';
import { buildDispatchRouteInputs } from '../src/control/DispatchRouteInputs';
import { taskForReport } from '../src/control/ReportTriagePolicy';
import { RouteOptimizationService } from '../src/control/RouteOptimizationService';
import { MockRoadRoutingStrategy } from './helpers/MockRoadRoutingStrategy';
import { DirectDistanceRoutingStrategy } from '../src/control/routing/DirectDistanceRoutingStrategy';
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
  it('returns stored locality breakdowns and separate report triage on proposals for matching pest/locality', async () => {
    const f = fixture();
    const c = await cluster(f);
    const reportScore = Object.assign(new PriorityScore(), {
      clusterId: 'legacy-rat-score-key', localityId: c.id, pestType: PestType.Rat,
      computedAt: new Date('2026-10-29T12:00:00.000Z'), score: 47.2, tier: PriorityTier.Medium,
      severityMultiplier: 0.8, urgency: 0.59, isDegraded: false, excludedDrivers: [], overrideRuleName: '',
      contributions: [{ driver: Driver.CaseSize, rawValue: 4, normalisedValue: 0.4, weight: 0.2, contribution: 0.08 }],
    });
    const mosquitoScore = Object.assign(new PriorityScore(), { ...reportScore, clusterId: c.id, pestType: PestType.Mosquito,
      score: 78.4, tier: PriorityTier.High, urgency: 0.784 });
    await f.scores.saveAll([reportScore, mosquitoScore]);
    const source = report('rat-injury', PestType.Rat, { clusterId: c.id, injuryReported: true });
    await f.reports.save(source);

    const proposals = await f.dispatch.proposeDailyList(date, manager);
    const reportProposal = proposals.find((proposal) => proposal.sourceReportId === source.id)!;
    expect(reportProposal.scoreExplanation).toEqual({
      reportTriage: { priority: 'Critical', rationale: 'Injury reported. Seek urgent medical help where needed.' },
      localityScore: {
        value: 47.2, tier: PriorityTier.Medium, computedAt: '2026-10-29T12:00:00.000Z', severity: 0.8, urgency: 0.59,
        isDegraded: false, excludedDrivers: [], overrideRuleName: '',
        breakdown: [{ driver: Driver.CaseSize, rawValue: 4, normalisedValue: 0.4, weight: 0.2, contribution: 0.08 }],
      },
    });
    const officialProposal = proposals.find((proposal) => !proposal.sourceReportId)!;
    expect(officialProposal.scoreExplanation?.localityScore).toMatchObject({
      value: 78.4, tier: PriorityTier.High, computedAt: '2026-10-29T12:00:00.000Z',
    });
    const routeInputs = buildDispatchRouteInputs({ date, crew: [], reports: [source], orders: [], clusters: [c], proposals: [officialProposal],
      profiles: ConfigLoader.load().pestProfiles, scores: [reportScore, mosquitoScore] });
    expect(routeInputs.jobs.find((job) => job.workOrderId === `prop-${c.id}-${PestType.Mosquito}`)?.scoreExplanation)
      .toEqual(officialProposal.scoreExplanation);
  });

  it('serialises official cluster map points from the boundary centroid and preserves exact report points', async () => {
    const f = fixture();
    const c = await cluster(f);
    c.boundary = new Polygon([[new GeoPoint(1.31, 103.84), new GeoPoint(1.33, 103.86), new GeoPoint(1.35, 103.88)]]);
    await f.clusters.upsertFromFeed({ records: [c], retrievedAt: new Date() });
    await f.scores.saveAll([Object.assign(new PriorityScore(), { clusterId: c.id, localityId: c.id,
      pestType: PestType.Mosquito, tier: PriorityTier.High, score: 80, rank: 1 })]);
    const official = (await f.dispatch.proposeDailyList(date, manager)).find((proposal) => !proposal.sourceReportId);
    expect(official?.mapPoint).toEqual({ latitude: 1.33, longitude: 103.86 });
    expect(official?.point).toBeUndefined();
    const inputs = buildDispatchRouteInputs({ date, crew: [], reports: [], orders: [], clusters: [c],
      proposals: official ? [official] : [], profiles: ConfigLoader.load().pestProfiles });
    expect(inputs.jobs[0]?.serviceArea).toBe(c.boundary);
    expect(inputs.jobs[0]?.point).toEqual(c.boundary.centroid());

    const source = report('exact-report', PestType.Rat, { point: new GeoPoint(1.37, 103.91), clusterId: c.id });
    await f.reports.save(source);
    const reportProposal = (await f.dispatch.proposeDailyList(date, manager)).find((proposal) => proposal.sourceReportId === source.id);
    expect(reportProposal?.point).toBe(source.point);
  });

  it.each([PestType.Snake, PestType.WildBoar, PestType.BeeWasp, PestType.HouseCrow, PestType.Pigeon, PestType.JavanMyna])(
    'carries verified %s through proposal, exact-point inputs and qualified road planning', async (pestType) => {
      const f = fixture();
      const source = report(`authority-${pestType}`, pestType, { point: new GeoPoint(1.32, 103.85) });
      await f.reports.save(source);
      const proposals = await f.dispatch.proposeDailyList(date, manager);
      expect(proposals).toHaveLength(1);
      expect(proposals[0]).toMatchObject({ sourceReportId: source.id, point: source.point,
        allowedCapabilities: [StaffSpecialisation.AuthorityResponse] });
      expect(proposals[0]?.referralAuthority).toBeUndefined();
      // Supply proposals independently of the report-group path while retaining verified source validation.
      const crew = Array.from({ length: 4 }, (_, index) => Object.assign(new Account(), {
        id: `authority-${index}`, role: Role.CleaningCrew, isActive: true,
        specialisation: StaffSpecialisation.AuthorityResponse, staffStatus: StaffStatus.Available,
        hqLocation: HqLocation.Central,
      }));
      const inputs = buildDispatchRouteInputs({ date, crew, reports: [source], orders: [], clusters: [],
        proposals, profiles: ConfigLoader.load().pestProfiles });
      expect(inputs.referrals).toEqual([]);
      expect(inputs.jobs).toHaveLength(1);
      expect(inputs.jobs[0]).toMatchObject({ point: source.point, allowedCapabilities: [StaffSpecialisation.AuthorityResponse] });
      const routes = await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(inputs.teams, inputs.jobs);
      expect(routes.flatMap((route) => route.workOrderIds)).toEqual([`report-${source.id}`]);
      expect(routes[0]?.staffCount).toBeGreaterThanOrEqual(inputs.jobs[0]!.requiredStaff!);
      expect(routes[0]?.isWithinFourHourCap).toBe(true);
      // An estimate is not evidence of road access, even for an otherwise qualified response team.
      expect(await new RouteOptimizationService(new DirectDistanceRoutingStrategy()).plan(inputs.teams, inputs.jobs)).toEqual([]);
      // An empty operational fleet still prevents executable dispatch.
      expect(await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(inputs.teams, inputs.jobs, [])).toEqual([]);
      const insufficient = buildDispatchRouteInputs({ date, crew: crew.slice(0, 1), reports: [source],
        orders: [], clusters: [], proposals, profiles: ConfigLoader.load().pestProfiles });
      if (pestType === PestType.Snake || pestType === PestType.WildBoar) {
        expect(await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(insufficient.teams, insufficient.jobs)).toEqual([]);
      }
    });

  it.each([
    [PestType.Snake, ReportType.BlockedDrain],
    [PestType.Macaque, ReportType.UnclearedRefuse],
    [PestType.HouseCrow, ReportType.UnclearedRefuse],
    [PestType.Pigeon, ReportType.UnclearedRefuse],
  ])('keeps %s with %s as authority Inspection through proposal, exact-point inputs and planner', async (pestType, type) => {
    const f = fixture();
    const source = report(`condition-${pestType}`, pestType, { type, point: new GeoPoint(1.33, 103.86) });
    await f.reports.save(source);
    expect(taskForReport(source)).toBe(TaskType.Inspection);
    const proposals = await f.dispatch.proposeDailyList(date, manager);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ sourceReportId: source.id, point: source.point,
      suggestedTaskType: TaskType.Inspection, allowedCapabilities: [StaffSpecialisation.AuthorityResponse] });
    expect(proposals[0]?.referralAuthority).toBeUndefined();
    const crew = Array.from({ length: 4 }, (_, index) => Object.assign(new Account(), {
      id: `authority-${index}`, role: Role.CleaningCrew, isActive: true,
      specialisation: StaffSpecialisation.AuthorityResponse, staffStatus: StaffStatus.Available,
      hqLocation: HqLocation.Central,
    }));
    const inputs = buildDispatchRouteInputs({ date, crew, reports: [source], orders: [], clusters: [],
      proposals, profiles: ConfigLoader.load().pestProfiles });
    expect(inputs.referrals).toEqual([]);
    expect(inputs.jobs).toHaveLength(1);
    expect(inputs.jobs[0]).toMatchObject({ point: source.point, allowedCapabilities: [StaffSpecialisation.AuthorityResponse] });
    expect(inputs.jobs[0]!.requiredStaff).toBeGreaterThanOrEqual(1);
    const routes = await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(inputs.teams, inputs.jobs);
    expect(routes.flatMap((route) => route.workOrderIds)).toEqual([`report-${source.id}`]);
    expect(routes[0]?.staffCount).toBeGreaterThanOrEqual(inputs.jobs[0]!.requiredStaff!);
    // Generic crew stays ineligible for authority work.
    const generic = crew.map((c) => Object.assign(new Account(), c, { specialisation: StaffSpecialisation.GeneralInspection }));
    const refused = buildDispatchRouteInputs({ date, crew: generic, reports: [source], orders: [], clusters: [],
      proposals, profiles: ConfigLoader.load().pestProfiles });
    expect(await new RouteOptimizationService(new MockRoadRoutingStrategy()).plan(refused.teams, refused.jobs)).toEqual([]);
  });

  it('keeps condition-based clearance for non-authority pests', () => {
    expect(taskForReport({ pestType: PestType.Rat, type: ReportType.BlockedDrain })).toBe(TaskType.DrainClearance);
    expect(taskForReport({ pestType: PestType.Cockroach, type: ReportType.UnclearedRefuse })).toBe(TaskType.RefuseClearance);
    expect(taskForReport({ pestType: PestType.BeeWasp, type: ReportType.BlockedDrain })).toBe(TaskType.Inspection);
  });

  it('retains unscored non-dengue and authority tasks before the display limit', async () => {
    const f = fixture(1);
    const c = await cluster(f);
    await f.scores.saveAll([Object.assign(new PriorityScore(), { clusterId: c.id, localityId: c.id,
      pestType: PestType.Mosquito, tier: PriorityTier.Low, score: 1, rank: 1 })]);
    for (const r of [report('rat', PestType.Rat), report('termite', PestType.Termite),
      report('snake', PestType.Snake, { locationContext: LocationContext.Indoor })]) await f.reports.save(r);
    const displayed = await f.dispatch.proposeDailyList(date, manager);
    const all = await f.dispatch.proposeDailyList(date, manager, Infinity);
    expect(displayed).toHaveLength(1);
    expect(displayed[0]).toMatchObject({ sourceReportId: 'snake', tier: 'Critical', allowedCapabilities: [StaffSpecialisation.AuthorityResponse] });
    expect(all).toHaveLength(4);
    expect(all.map((p) => p.tier)).toEqual(['Critical', 'High', 'High', 'Low']);
    expect(all.find((p) => p.sourceReportId === 'rat')).toMatchObject({ point: { latitude: 1.32, longitude: 103.85 }, priorityBasis: 'ReportTriage' });
  });

  it('keeps locality scores as risk information for non-mosquito pests', async () => {
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
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({ pestType: PestType.Rat, sourceReportId: 'rat', priorityBasis: 'ReportTriage' });
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
