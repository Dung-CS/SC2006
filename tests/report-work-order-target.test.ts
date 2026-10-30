/**
 * D-Fence — 8.1.2: a verified report outside every dengue cluster is a work-order target.
 *
 * The job carries a null cluster and the report's own pest and point. Nothing here invents a
 * cluster association, links other cluster-less reports, or rescores an unrelated cluster.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { WorkOrderTransitionTable } from '../src/control/WorkOrderTransitionTable';
import { WorkOrderLifecycleController } from '../src/control/WorkOrderLifecycleController';
import { DispatchController, DuplicateWorkOrder, WorkOrderRejected } from '../src/control/DispatchController';
import { ReportLifecycleController } from '../src/control/ReportLifecycleController';
import { ReportTransitionTable } from '../src/control/ReportTransitionTable';
import { StaffAccountController } from '../src/control/StaffAccountController';
import { MapViewController } from '../src/control/MapViewController';
import { TrendAnalyser } from '../src/control/TrendAnalyser';
import { DashboardController, principalFor } from '../src/control/DashboardController';
import { Principal } from '../src/control/Principal';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { WorkOrderRoutes } from '../src/boundary/http/WorkOrderRoutes';
import { CrewRoutes } from '../src/boundary/http/CrewRoutes';
import { Request, Response } from '../src/boundary/http/RouteHandler';
import {
  InMemoryAuditStore,
  InMemoryClusterStore,
  InMemoryIngestionRunStore,
  InMemoryPriorityScoreStore,
} from '../src/persistence/memory/InMemoryStores';
import {
  InMemoryTreatmentRecordStore,
  InMemoryWorkOrderStore,
  RecordingNotifier,
} from '../src/persistence/memory/InMemoryWorkOrderStores';
import { InMemoryAccountStore, InMemorySessionStore, LocalAuthProvider } from '../src/persistence/memory/InMemoryAccountStores';
import { InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';
import { TreatmentRecordRepository, WorkOrderRepository } from '../src/persistence/WorkOrderRepository';
import { Database, Row } from '../src/persistence/Database';
import { Account } from '../src/entity/Account';
import { Cluster } from '../src/entity/Cluster';
import { Report } from '../src/entity/Report';
import { WorkOrder } from '../src/entity/WorkOrder';
import { TreatmentRecord } from '../src/entity/TreatmentRecord';
import { PriorityScore } from '../src/entity/PriorityScore';
import { GeoPoint, Polygon, PremisesMix, singaporeDate } from '../src/entity/valueTypes';
import { PriorityScoringEngine } from '../src/control/PriorityScoringEngine';
import { NormalisationFactory } from '../src/control/normalisation/NormalisationFactory';
import {
  LocationContext,
  PestClass,
  PestType,
  PriorityTier,
  ReportStatus,
  ReportType,
  Role,
  StaffSpecialisation,
  TaskType,
  WorkOrderStatus,
} from '../src/entity/enums';

const MANAGER = principalFor(Role.OperationsManager, 'manager-1');
const FUTURE = '2099-01-01';
const config = ConfigLoader.load();
/** Inside the cluster below. */
const CENTRE = new GeoPoint(1.43, 103.79);
/** Several kilometres from the cluster: outside every dengue cluster. */
const OUTSIDE = new GeoPoint(1.3, 103.85);

function crew(id: string): Principal {
  return new Principal(id, Role.CleaningCrew, `session-${id}`);
}

function member(id: string, specialisation: StaffSpecialisation): Account {
  const a = new Account();
  a.id = id;
  a.email = `${id}@d-fence.test`;
  a.authUserId = '';
  a.emailVerified = true;
  a.role = Role.CleaningCrew;
  a.isActive = true;
  a.specialisation = specialisation;
  a.telegramChatId = null;
  a.createdAt = new Date(0);
  return a;
}

function cluster(objectId: string, isActive: boolean): Cluster {
  const c = new Cluster();
  c.objectId = objectId;
  c.locality = objectId === 'c-active' ? 'Marsiling Rise' : 'Closed Cluster';
  c.caseSize = 12;
  c.caseDelta = 0;
  c.isActive = isActive;
  c.premisesMix = new PremisesMix([], [], []);
  const d = 0.003;
  c.boundary = new Polygon([
    [
      new GeoPoint(CENTRE.latitude - d, CENTRE.longitude - d),
      new GeoPoint(CENTRE.latitude + d, CENTRE.longitude - d),
      new GeoPoint(CENTRE.latitude + d, CENTRE.longitude + d),
      new GeoPoint(CENTRE.latitude - d, CENTRE.longitude + d),
      new GeoPoint(CENTRE.latitude - d, CENTRE.longitude - d),
    ],
  ]);
  return c;
}

interface Fixture {
  dispatch: DispatchController;
  lifecycle: WorkOrderLifecycleController;
  workOrders: InMemoryWorkOrderStore;
  treatments: InMemoryTreatmentRecordStore;
  reports: InMemoryReportStore;
  scores: InMemoryPriorityScoreStore;
  map: MapViewController;
  dashboard: DashboardController;
  staff: StaffAccountController;
  ac: AccessControlService;
  audit: InMemoryAuditStore;
  rescored: Array<{ clusterId: string; treatmentsAtCall: number }>;
  clusters: InMemoryClusterStore;
  clusterId: string;
  closedClusterId: string;
}

async function fixture(): Promise<Fixture> {
  const clusters = new InMemoryClusterStore();
  await clusters.upsertFromFeed({
    retrievedAt: new Date(),
    records: [cluster('c-active', true), cluster('c-closed', false)],
  });
  const clusterId = ((await clusters.findByObjectId('c-active')) as Cluster).id;
  const closedClusterId = ((await clusters.findByObjectId('c-closed')) as Cluster).id;

  const workOrders = new InMemoryWorkOrderStore();
  const treatments = new InMemoryTreatmentRecordStore();
  const reports = new InMemoryReportStore();
  const scores = new InMemoryPriorityScoreStore();
  const notifier = new RecordingNotifier();
  const audit = new InMemoryAuditStore();
  const ac = new AccessControlService(new AccessPolicy(), audit);
  const reportLifecycle = new ReportLifecycleController(new ReportTransitionTable(), reports, notifier);
  const rescored: Fixture['rescored'] = [];
  const lifecycle = new WorkOrderLifecycleController(
    new WorkOrderTransitionTable(),
    workOrders,
    treatments,
    notifier,
    {
      rescoreCluster: async (id: string) => {
        rescored.push({ clusterId: id, treatmentsAtCall: (await treatments.allForCluster(id)).length });
      },
    },
    reportLifecycle,
  );
  const accounts = new InMemoryAccountStore();
  for (const a of [
    member('vc-1', StaffSpecialisation.VectorControl),
    member('san-1', StaffSpecialisation.Sanitation),
    member('str-1', StaffSpecialisation.Structural),
  ]) {
    await accounts.save(a);
  }
  const dispatch = new DispatchController(
    ac, lifecycle, workOrders, clusters, scores, notifier,
    reportLifecycle, 10, audit, config, accounts, reports,
  );
  const map = new MapViewController(ac, clusters, scores, new TrendAnalyser(clusters), reports, workOrders, null);
  const dashboard = new DashboardController(ac, clusters, scores, new InMemoryIngestionRunStore(), workOrders, reports);
  const staff = new StaffAccountController(ac, new LocalAuthProvider(), accounts, new InMemorySessionStore(), audit);
  return { dispatch, lifecycle, workOrders, treatments, reports, scores, map, dashboard, staff, ac, audit, rescored, clusters, clusterId, closedClusterId };
}

async function verifiedReport(
  f: Fixture,
  id: string,
  pestType: PestType,
  over: { clusterId?: string | null; point?: GeoPoint; injuryReported?: boolean; status?: ReportStatus } = {},
): Promise<Report> {
  const report = new Report();
  report.id = id;
  report.reporterId = 'resident-1';
  report.point = over.point ?? OUTSIDE;
  report.type = ReportType.Other;
  report.pestType = pestType;
  report.locationContext = config.pestProfiles.get(pestType)?.pestClass === PestClass.Wildlife ? LocationContext.Outdoor : null;
  report.injuryReported = over.injuryReported ?? false;
  report.description = 'Verified report';
  report.clusterId = over.clusterId === undefined ? null : over.clusterId;
  report.localityBinding = 'Bedok North';
  report.corroborationCount = 0;
  report.submittedAt = new Date();
  report.moderatorId = 'manager-1';
  report.moderatedAt = new Date();
  report.moderationReason = null;
  report.workOrderId = null;
  report.applyStatus(over.status ?? ReportStatus.Verified);
  return f.reports.save(report);
}

function reportJob(f: Fixture, sourceReportId: string, taskType = TaskType.Inspection) {
  return f.dispatch.createWorkOrder({ taskType, sourceReportId, scheduledDate: FUTURE }, MANAGER);
}

/** Assign, accept, start and complete, as the assigned crew member. */
async function completeAs(f: Fixture, id: string, crewId: string): Promise<void> {
  const by = crew(crewId);
  await f.dispatch.assign(id, crewId, MANAGER);
  await f.lifecycle.accept(id, by);
  await f.lifecycle.start(id, by);
  await f.lifecycle.complete(id, {
    id: '', workOrderId: id, photoKeys: ['photo-1'], notes: 'done',
    taskPerformed: TaskType.Inspection, completedAt: new Date(), rejectionReason: null,
  }, by);
}

function response(): Response & { code: number; body: unknown } {
  const res = {
    code: 200,
    body: undefined as unknown,
    status(code: number) {
      res.code = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
    },
    text() {},
  };
  return res;
}

describe('8.1.2 — creation outside a dengue cluster', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture();
  });

  it('T1 — a Rat report gets a null-cluster job at its own point, routed to Sanitation and assignable', async () => {
    const source = await verifiedReport(f, 'rat-1', PestType.Rat);
    const wo = await reportJob(f, source.id);
    expect(wo.clusterId).toBeNull();
    expect(wo.sourceReportId).toBe(source.id);
    expect(wo.pestType).toBe(PestType.Rat);
    expect(wo.targetPoint).toEqual(OUTSIDE);
    expect(wo.location).toBe('Bedok North');
    expect(wo.priority).toBe(PriorityTier.Medium);
    expect(wo.priorityBasis()).toBe('UnscoredReportDefault');

    const routing = await f.dispatch.routingFor(wo.id, MANAGER);
    expect(routing.candidates[0]?.crewId).toBe('san-1');
    expect(routing.candidates[0]?.primary).toBe(true);
    const assigned = await f.dispatch.assign(wo.id, 'san-1', MANAGER);
    expect(assigned.assigneeId).toBe('san-1');
    expect((await f.reports.findById(source.id))?.currentStatus()).toBe(ReportStatus.Actioned);
  });

  it('T2 — a Termite report goes to Structural; VectorControl is refused', async () => {
    const source = await verifiedReport(f, 'termite-1', PestType.Termite);
    const wo = await reportJob(f, source.id);
    expect(wo.clusterId).toBeNull();
    expect(wo.pestType).toBe(PestType.Termite);
    await expect(f.dispatch.assign(wo.id, 'vc-1', MANAGER)).rejects.toThrow(/Structural pests/);
    expect((await f.dispatch.assign(wo.id, 'str-1', MANAGER)).assigneeId).toBe('str-1');
  });

  it('T3 — a recorded human injury dispatches at Critical, labelled as the override', async () => {
    const source = await verifiedReport(f, 'rat-injury', PestType.Rat, { injuryReported: true });
    const wo = await reportJob(f, source.id);
    expect(wo.priority).toBe(PriorityTier.Critical);
    expect(wo.priorityBasis()).toBe('InjuryOverride');
  });

  it('T4 — only the explicit source is linked; other cluster-less verified reports stay unlinked', async () => {
    const source = await verifiedReport(f, 'rat-src', PestType.Rat);
    const otherRat = await verifiedReport(f, 'rat-other', PestType.Rat, { point: new GeoPoint(1.31, 103.86) });
    const otherCockroach = await verifiedReport(f, 'cockroach-other', PestType.Cockroach);
    const wo = await reportJob(f, source.id);
    expect((await f.reports.findById(source.id))?.workOrderId).toBe(wo.id);
    expect((await f.reports.findById(otherRat.id))?.workOrderId).toBeNull();
    expect((await f.reports.findById(otherCockroach.id))?.workOrderId).toBeNull();
  });

  it('T5 — a source with a genuine active cluster uses it; an inactive one gives a null cluster', async () => {
    const inActive = await verifiedReport(f, 'mosq-in', PestType.Mosquito, { clusterId: f.clusterId, point: CENTRE });
    const sibling = await verifiedReport(f, 'mosq-sibling', PestType.Mosquito, { clusterId: f.clusterId, point: CENTRE });
    const woActive = await reportJob(f, inActive.id);
    expect(woActive.clusterId).toBe(f.clusterId);
    expect(woActive.priorityBasis()).toBe('ClusterTier');
    // 8.1.13 is unchanged on a cluster: same-pest reports there are linked too.
    expect((await f.reports.findById(sibling.id))?.workOrderId).toBe(woActive.id);

    const inClosed = await verifiedReport(f, 'rat-closed', PestType.Rat, { clusterId: f.closedClusterId });
    const woClosed = await reportJob(f, inClosed.id);
    expect(woClosed.clusterId).toBeNull();
  });

  it('T6 — a cluster job takes the tier of its own pest in that locality, not another pest\'s', async () => {
    const mosquito = new PriorityScore();
    mosquito.clusterId = f.clusterId;
    mosquito.localityId = f.clusterId;
    mosquito.pestType = PestType.Mosquito;
    mosquito.tier = PriorityTier.Low;
    const rat = new PriorityScore();
    rat.clusterId = f.clusterId;
    rat.localityId = f.clusterId;
    rat.pestType = PestType.Rat;
    rat.tier = PriorityTier.High;
    await f.scores.saveAll([mosquito, rat]);
    const source = await verifiedReport(f, 'rat-in', PestType.Rat, { clusterId: f.clusterId, point: CENTRE });
    expect((await reportJob(f, source.id)).priority).toBe(PriorityTier.High);
    const fog = await f.dispatch.createWorkOrder({ clusterId: f.clusterId, taskType: TaskType.Fogging, scheduledDate: FUTURE }, MANAGER);
    expect(fog.priority).toBe(PriorityTier.Low);
  });

  it('T7 — unverified, mismatched cluster or pest, and already-linked sources write nothing', async () => {
    const submitted = await verifiedReport(f, 'rat-submitted', PestType.Rat, { status: ReportStatus.Submitted });
    await expect(reportJob(f, submitted.id)).rejects.toThrow(/Verified report/);

    const outside = await verifiedReport(f, 'rat-outside', PestType.Rat);
    await expect(
      f.dispatch.createWorkOrder({ clusterId: f.clusterId, taskType: TaskType.Inspection, sourceReportId: outside.id, scheduledDate: FUTURE }, MANAGER),
    ).rejects.toThrow(/not in the requested cluster/);
    await expect(
      f.dispatch.createWorkOrder({ taskType: TaskType.Inspection, pestType: PestType.Termite, sourceReportId: outside.id, scheduledDate: FUTURE }, MANAGER),
    ).rejects.toThrow(/must match the source report/);
    await expect(reportJob(f, outside.id, TaskType.Fogging)).rejects.toThrow(/not a permitted task for Rat/);
    await expect(reportJob(f, 'missing-report')).rejects.toThrow(WorkOrderRejected);
    expect(await f.workOrders.findAll()).toHaveLength(0);
    expect((await f.reports.findById(outside.id))?.workOrderId).toBeNull();

    // Without a source, the cluster is still required (8.1.1).
    await expect(
      f.dispatch.createWorkOrder({ taskType: TaskType.Inspection, scheduledDate: FUTURE }, MANAGER),
    ).rejects.toThrow(/no active cluster/);
    await expect(
      f.dispatch.createWorkOrder({ clusterId: f.closedClusterId, taskType: TaskType.Inspection, scheduledDate: FUTURE }, MANAGER),
    ).rejects.toThrow(/no active cluster/);

    const linked = await verifiedReport(f, 'rat-linked', PestType.Rat);
    linked.workOrderId = 'some-other-order';
    await f.reports.save(linked);
    await expect(reportJob(f, linked.id)).rejects.toThrow(/already linked/);
    expect(await f.workOrders.findAll()).toHaveLength(0);
  });

  it('T8 — the same task from the same source is refused as a duplicate carrying the open job', async () => {
    const source = await verifiedReport(f, 'rat-dup', PestType.Rat);
    const first = await reportJob(f, source.id);
    // The report is now linked, but 8.1.12 offers the job rather than a bare "already linked".
    const error = await reportJob(f, source.id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DuplicateWorkOrder);
    expect((error as DuplicateWorkOrder).existing.id).toBe(first.id);
    expect((await f.workOrders.findOpenForReport(source.id)).map((w) => w.id)).toEqual([first.id]);
    // A different task on the same report is refused because the report is already linked.
    await expect(reportJob(f, source.id, TaskType.DrainClearance)).rejects.toThrow(/already linked/);
    // A cluster-less job never blocks cluster creation, and is absent from the cluster's open list.
    expect(await f.workOrders.findOpenForCluster(f.clusterId)).toHaveLength(0);
  });
});

describe('8.1.2 — lifecycle, treatment and scoring', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture();
  });

  it('L1 — verification records a null-cluster treatment, closes the source, and rescores nothing', async () => {
    const source = await verifiedReport(f, 'rat-life', PestType.Rat);
    const wo = await reportJob(f, source.id);
    await completeAs(f, wo.id, 'san-1');
    const record = await f.lifecycle.verify(wo.id, MANAGER);
    expect(record.clusterId).toBeNull();
    expect(record.workOrderId).toBe(wo.id);
    expect(record.pestType).toBe(PestType.Rat);
    expect((await f.reports.findById(source.id))?.currentStatus()).toBe(ReportStatus.Closed);
    expect(f.rescored).toEqual([]);
    expect(await f.treatments.allForCluster(f.clusterId)).toHaveLength(0);
    expect(await f.treatments.daysSinceLastTreatment(f.clusterId, new Date())).toBe(90);
  });

  it('L2 — a cluster verification still rescores, and only after its treatment is stored', async () => {
    const wo = await f.dispatch.createWorkOrder({ clusterId: f.clusterId, taskType: TaskType.Fogging, scheduledDate: FUTURE }, MANAGER);
    const by = crew('vc-1');
    await f.dispatch.assign(wo.id, 'vc-1', MANAGER);
    await f.lifecycle.accept(wo.id, by);
    await f.lifecycle.start(wo.id, by);
    await f.lifecycle.complete(wo.id, {
      id: '', workOrderId: wo.id, photoKeys: ['p'], notes: 'Fogging completed', taskPerformed: TaskType.Fogging,
      completedAt: new Date(), rejectionReason: null,
    }, by);
    await f.lifecycle.verify(wo.id, MANAGER);
    expect(f.rescored).toEqual([{ clusterId: f.clusterId, treatmentsAtCall: 1 }]);
    expect(await f.treatments.daysSinceLastTreatment(f.clusterId, new Date())).toBe(0);
  });

  it('L3 — a Rat treatment at a dengue cluster does not reset the Mosquito driver; unknown legacy still counts', async () => {
    const today = singaporeDate(new Date());
    const rat = new TreatmentRecord();
    rat.clusterId = f.clusterId;
    rat.workOrderId = 'wo-rat';
    rat.taskType = TaskType.Inspection;
    rat.completionDate = today;
    rat.pestType = PestType.Rat;
    await f.treatments.save(rat);
    expect(await f.treatments.daysSinceLastTreatment(f.clusterId, new Date())).toBe(90);
    expect(await f.treatments.daysSinceLastTreatment(f.clusterId, new Date(), PestType.Rat)).toBe(0);

    const legacy = new TreatmentRecord();
    legacy.clusterId = f.clusterId;
    legacy.workOrderId = 'wo-legacy';
    legacy.taskType = TaskType.Fogging;
    legacy.completionDate = today;
    await f.treatments.save(legacy); // pestType null: unknown, counts as it did before 011
    expect(await f.treatments.daysSinceLastTreatment(f.clusterId, new Date())).toBe(0);
  });

  it('L4 — cancellation restores the source report and leaves no treatment', async () => {
    const source = await verifiedReport(f, 'rat-cancel', PestType.Rat);
    const wo = await reportJob(f, source.id);
    await f.dispatch.assign(wo.id, 'san-1', MANAGER);
    expect((await f.reports.findById(source.id))?.currentStatus()).toBe(ReportStatus.Actioned);
    await f.dispatch.cancel(wo.id, 'resident resolved it', MANAGER);
    expect((await f.reports.findById(source.id))?.currentStatus()).toBe(ReportStatus.Verified);
    expect(f.rescored).toEqual([]);
  });

  it('L5 — terminal report-only jobs keep the no-side-effect assignment guard', async () => {
    const source = await verifiedReport(f, 'rat-terminal', PestType.Rat);
    const wo = await reportJob(f, source.id);
    await completeAs(f, wo.id, 'san-1');
    await f.lifecycle.verify(wo.id, MANAGER);
    const history = await f.workOrders.assignmentHistory(wo.id);
    await expect(f.dispatch.reassign(wo.id, 'san-1', MANAGER)).rejects.toThrow(/terminal/);
    expect(await f.workOrders.assignmentHistory(wo.id)).toEqual(history);
    expect((await f.workOrders.findById(wo.id))?.currentStatus()).toBe(WorkOrderStatus.Verified);
  });

  it('L6 — terminal cancellation and rejection refuse before changing reason, evidence or audit', async () => {
    const source = await verifiedReport(f, 'rat-terminal-actions', PestType.Rat);
    const verified = await reportJob(f, source.id);
    await completeAs(f, verified.id, 'san-1');
    await f.lifecycle.verify(verified.id, MANAGER);
    const verifiedAudit = await f.audit.forTarget('WorkOrder', verified.id, 100);
    await expect(f.dispatch.cancel(verified.id, 'must not persist', MANAGER)).rejects.toThrow(/terminal/);
    await expect(f.lifecycle.rejectCompletion(verified.id, 'must not persist', MANAGER)).rejects.toThrow(/terminal/);
    expect((await f.workOrders.findById(verified.id))?.cancellationReason).toBeNull();
    expect((await f.workOrders.latestEvidence(verified.id))?.rejectionReason).toBeNull();
    expect(await f.audit.forTarget('WorkOrder', verified.id, 100)).toEqual(verifiedAudit);

    const cancelled = await reportJob(f, (await verifiedReport(f, 'rat-cancelled-terminal', PestType.Rat)).id);
    await f.dispatch.cancel(cancelled.id, 'resident resolved it', MANAGER);
    const cancelledAudit = await f.audit.forTarget('WorkOrder', cancelled.id, 100);
    await expect(f.dispatch.cancel(cancelled.id, 'must not persist', MANAGER)).rejects.toThrow(/terminal/);
    await expect(f.lifecycle.rejectCompletion(cancelled.id, 'must not persist', MANAGER)).rejects.toThrow(/terminal/);
    expect((await f.workOrders.findById(cancelled.id))?.cancellationReason).toBe('resident resolved it');
    expect(await f.audit.forTarget('WorkOrder', cancelled.id, 100)).toEqual(cancelledAudit);
  });
});

describe('8.1.2 — legacy rows of unknown pest fail closed', () => {
  it('U1 — no assignment, no candidates, and the card says null rather than Mosquito', async () => {
    const f = await fixture();
    const wo = await f.dispatch.createWorkOrder({ clusterId: f.clusterId, taskType: TaskType.Inspection, scheduledDate: FUTURE }, MANAGER);
    wo.pestType = null; // as the repository rehydrates an unresolved legacy row
    await f.workOrders.save(wo);
    await expect(f.dispatch.assign(wo.id, 'vc-1', MANAGER)).rejects.toThrow(/pest of this legacy work order is unknown/);
    expect((await f.workOrders.findById(wo.id))?.assigneeId).toBeNull();
    expect(await f.workOrders.assignmentHistory(wo.id)).toHaveLength(0);
    const routing = await f.dispatch.routingFor(wo.id, MANAGER);
    expect(routing.candidates).toEqual([]);
    expect(routing.ineligible.every((m) => /unknown/.test(m.reason))).toBe(true);

    const routes = new WorkOrderRoutes(f.ac, f.dispatch, f.lifecycle, f.staff);
    routes.useResolver({ resolve: async (t) => (t === 'mgr' ? MANAGER : null) });
    const res = response();
    await routes.handle({ headers: { authorization: 'Bearer mgr' }, params: { route: '/api/ops/work-orders/:id', id: wo.id }, body: undefined }, res);
    expect((res.body as { workOrder: { pestType: string | null } }).workOrder.pestType).toBeNull();
  });
});

describe('8.1.2 — map, lists and API cards', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture();
  });

  it('M1 — a report-only job is drawn at the report point; a cluster-only job at the centroid', async () => {
    const source = await verifiedReport(f, 'rat-map', PestType.Rat);
    const reportOnly = await reportJob(f, source.id);
    const clusterOnly = await f.dispatch.createWorkOrder({ clusterId: f.clusterId, taskType: TaskType.Fogging, scheduledDate: FUTURE }, MANAGER);
    const markers = (await f.map.layers(MANAGER)).workOrders;
    const r = markers.find((m) => m.workOrderId === reportOnly.id);
    const c = markers.find((m) => m.workOrderId === clusterOnly.id);
    expect(r).toMatchObject({ clusterId: null, sourceReportId: source.id, latitude: OUTSIDE.latitude, longitude: OUTSIDE.longitude });
    const centroid = cluster('c-active', true).boundary.centroid();
    expect(c).toMatchObject({ clusterId: f.clusterId, sourceReportId: null, latitude: centroid.latitude, longitude: centroid.longitude });
  });

  it('M2 — the job stays in manager and crew lists, and does not mark any cluster row', async () => {
    const source = await verifiedReport(f, 'rat-list', PestType.Rat);
    const wo = await reportJob(f, source.id);
    await f.dispatch.assign(wo.id, 'san-1', MANAGER);
    expect((await f.dispatch.managerView(MANAGER)).map((w) => w.id)).toContain(wo.id);
    expect((await f.dispatch.crewView(crew('san-1'))).map((w) => w.id)).toContain(wo.id);
    expect((await f.dispatch.overdue(new Date('2100-01-01'))).map((w) => w.id)).toContain(wo.id);
    const engine = new PriorityScoringEngine(NormalisationFactory.build(config.normalisation), config, f.scores);
    await engine.computeScores(await f.clusters.findActive(), new Map(), new Date());
    const rows = await f.dashboard.buildPriorityTable(MANAGER);
    expect(rows.map((row) => [row.clusterId, row.workOrderStatus])).toEqual([[f.clusterId, null]]);
  });

  it('M3 — HTTP create without a cluster returns the card the screens read; crew card matches', async () => {
    const source = await verifiedReport(f, 'rat-http', PestType.Rat);
    const routes = new WorkOrderRoutes(f.ac, f.dispatch, f.lifecycle, f.staff);
    routes.useResolver({ resolve: async (t) => (t === 'mgr' ? MANAGER : t === 'san' ? crew('san-1') : null) });
    const req = (route: string, params: Record<string, string> = {}, body: unknown = undefined, token = 'mgr'): Request => ({
      headers: { authorization: `Bearer ${token}` },
      params: { route, ...params },
      body,
    });
    const created = response();
    await routes.handle(req('/api/ops/work-orders', {}, { taskType: TaskType.Inspection, sourceReportId: source.id }), created);
    expect(created.code).toBe(201);
    const card = created.body as Record<string, unknown>;
    expect(card).toMatchObject({
      clusterId: null,
      sourceReportId: source.id,
      pestType: PestType.Rat,
      location: 'Bedok North',
      point: { latitude: OUTSIDE.latitude, longitude: OUTSIDE.longitude },
      priority: PriorityTier.Medium,
      priorityBasis: 'UnscoredReportDefault',
    });

    const dup = response();
    await routes.handle(req('/api/ops/work-orders', {}, { taskType: TaskType.Inspection, sourceReportId: source.id }), dup);
    expect(dup.code).toBe(409);
    expect((dup.body as { existing: { id: string } }).existing.id).toBe(card.id);

    await f.dispatch.assign(String(card.id), 'san-1', MANAGER);
    const crewRoutes = new CrewRoutes(f.ac, f.dispatch, f.lifecycle);
    crewRoutes.useResolver({ resolve: async (t) => (t === 'san' ? crew('san-1') : null) });
    const job = response();
    await crewRoutes.handle(req('/api/crew/work-orders/:id', { id: String(card.id) }, undefined, 'san'), job);
    expect((job.body as { workOrder: Record<string, unknown> }).workOrder).toMatchObject({
      clusterId: null,
      sourceReportId: source.id,
      pestType: PestType.Rat,
      point: { latitude: OUTSIDE.latitude, longitude: OUTSIDE.longitude },
      priorityBasis: 'UnscoredReportDefault',
    });
  });
});

/**
 * The SQL each repository method sends, and what it makes of controlled rows. No database: the
 * live connection in src/.env is never touched. Migration 011 itself is verified separately.
 */
function fakeDb(rows: Row[] = []): { db: Database; calls: Array<{ sql: string; params: unknown[] }> } {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return rows;
    },
  } as unknown as Database;
  return { db, calls };
}

function row(over: Row = {}): Row {
  return {
    id: 'wo-1', cluster_id: null, assignee_id: null, source_report_id: 'rep-1', task_type: 'Inspection',
    scheduled_date: '2099-01-01', priority: 'Medium', instructions: '', status: 'Created', started_at: null,
    created_at: new Date(0), verified_at: null, cancellation_reason: null, issue_flag: false, issue_reason: null,
    pest_type: 'Rat', location: 'Bedok North', target_latitude: 1.3, target_longitude: 103.85,
    ...over,
  };
}

describe('8.1.2 — repository SQL round trip (controlled rows, no live database)', () => {
  it('R1 — save writes pest_type and a null cluster; the upsert updates pest_type', async () => {
    const { db, calls } = fakeDb();
    const wo = new WorkOrder();
    wo.id = 'wo-1';
    wo.clusterId = null;
    wo.pestType = PestType.Termite;
    wo.assigneeId = null;
    wo.sourceReportId = 'rep-1';
    wo.taskType = TaskType.Inspection;
    wo.scheduledDate = FUTURE;
    wo.priority = PriorityTier.Medium;
    wo.instructions = '';
    wo.startedAt = null;
    wo.cancellationReason = null;
    wo.issueFlag = false;
    wo.issueReason = null;
    wo.createdAt = new Date(0);
    wo.applyStatus(WorkOrderStatus.Created);
    await new WorkOrderRepository(db).save(wo);
    const call = calls[0];
    expect(call?.sql).toMatch(/issue_flag, issue_reason, pest_type, dispatch_assignment_id\)/);
    expect(call?.sql).toMatch(/pest_type\s+= EXCLUDED\.pest_type/);
    expect(call?.params[1]).toBeNull();
    expect(call?.params[3]).toBe('rep-1');
    expect(call?.params[15]).toBe(PestType.Termite);
    expect(call?.params[16]).toBeNull();
  });

  it('R2 — a report-only row rehydrates its null cluster, pest and report point', async () => {
    const { db, calls } = fakeDb([row()]);
    const wo = await new WorkOrderRepository(db).findById('wo-1');
    expect(calls[0]?.sql).toMatch(/w\.pest_type/);
    expect(calls[0]?.sql).toMatch(/LEFT JOIN cluster c/);
    expect(calls[0]?.sql).toMatch(/LEFT JOIN report r/);
    expect(calls[0]?.sql).toMatch(/ST_Y\(r\.point::geometry\) AS target_latitude/);
    expect(wo?.clusterId).toBeNull();
    expect(wo?.pestType).toBe(PestType.Rat);
    expect(wo?.targetPoint).toEqual(new GeoPoint(1.3, 103.85));
    expect(wo?.location).toBe('Bedok North');
  });

  it('R3 — a legacy row with no pest rehydrates as null, never Mosquito; a cluster-only row has no point', async () => {
    const { db } = fakeDb([row({ pest_type: null, cluster_id: 'c-1', source_report_id: null, target_latitude: null, target_longitude: null })]);
    const wo = await new WorkOrderRepository(db).findById('wo-1');
    expect(wo?.pestType).toBeNull();
    expect(wo?.clusterId).toBe('c-1');
    expect(wo?.targetPoint).toBeNull();
  });

  it('R4 — findOpenForReport filters by source and open status', async () => {
    const { db, calls } = fakeDb([row()]);
    const open = await new WorkOrderRepository(db).findOpenForReport('rep-1');
    expect(open).toHaveLength(1);
    expect(calls[0]?.sql).toMatch(/w\.source_report_id = \$1 AND w\.status NOT IN \('Verified','Cancelled'\)/);
    expect(calls[0]?.params).toEqual(['rep-1']);
  });

  it('R5 — treatments carry a nullable cluster and pest; the driver query filters by pest', async () => {
    const { db, calls } = fakeDb([]);
    const repo = new TreatmentRecordRepository(db);
    const record = new TreatmentRecord();
    record.id = 't-1';
    record.clusterId = null;
    record.workOrderId = 'wo-1';
    record.taskType = TaskType.Inspection;
    record.completionDate = FUTURE;
    record.pestType = PestType.Rat;
    await repo.save(record);
    expect(calls[0]?.params).toEqual(['t-1', null, 'wo-1', TaskType.Inspection, FUTURE, PestType.Rat]);
    expect(await repo.daysSinceLastTreatment('c-1', new Date())).toBe(90);
    expect(calls[1]?.sql).toMatch(/pest_type IS NULL OR pest_type = \$2/);
    expect(calls[1]?.params).toEqual(['c-1', PestType.Mosquito]);
    await repo.daysSinceLastTreatment('c-1', new Date(), PestType.Rat);
    expect(calls[2]?.params).toEqual(['c-1', PestType.Rat]);
  });
});
