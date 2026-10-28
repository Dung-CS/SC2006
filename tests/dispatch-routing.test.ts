/**
 * D-Fence — dispatch routing by recorded staff capability (StaffRoutingPolicy).
 *
 * Three layers, because the rule must hold at each: the pure policy (who may hold which job), the
 * controller (assignment and reassignment refuse anyone the policy refuses, whoever calls), and the
 * HTTP boundary (a request that skips the screen meets the same refusal).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { WorkOrderTransitionTable } from '../src/control/WorkOrderTransitionTable';
import { WorkOrderLifecycleController } from '../src/control/WorkOrderLifecycleController';
import { DispatchController, WorkOrderRejected } from '../src/control/DispatchController';
import { TransitionRefused } from '../src/control/WorkOrderLifecycleController';
import { StaffAccountController } from '../src/control/StaffAccountController';
import { principalFor } from '../src/control/DashboardController';
import { Principal } from '../src/control/Principal';
import {
  coveringSpecialisations,
  externalAuthority,
  ineligibilityReason,
  permittedTasksFor,
  rankStaff,
  RoutingStaff,
} from '../src/control/StaffRoutingPolicy';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { ConfigSet } from '../src/config/ConfigSet';
import { WorkOrderRoutes } from '../src/boundary/http/WorkOrderRoutes';
import { Request, Response } from '../src/boundary/http/RouteHandler';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../src/persistence/memory/InMemoryStores';
import {
  InMemoryTreatmentRecordStore,
  InMemoryWorkOrderStore,
  RecordingNotifier,
} from '../src/persistence/memory/InMemoryWorkOrderStores';
import {
  InMemoryAccountStore,
  InMemorySessionStore,
  LocalAuthProvider,
} from '../src/persistence/memory/InMemoryAccountStores';
import { Account } from '../src/entity/Account';
import { Cluster } from '../src/entity/Cluster';
import { Report } from '../src/entity/Report';
import { PremisesMix } from '../src/entity/valueTypes';
import { GeoPoint } from '../src/entity/valueTypes';
import { RouteJob, RouteOptimizationService } from '../src/control/RouteOptimizationService';
import { DispatchPlanService } from '../src/control/DispatchPlanService';
import { MockRoadRoutingStrategy } from './helpers/MockRoadRoutingStrategy';
import { PestClass, PestType, ReportStatus, ReportType, Role, StaffSpecialisation, TaskType, WorkOrderStatus } from '../src/entity/enums';
import { InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';

const MANAGER = principalFor(Role.OperationsManager, 'manager-1');
const CREW = new Principal('vc-1', Role.CleaningCrew, 'session-vc');
const FUTURE = '2099-01-01';
const config: ConfigSet = ConfigLoader.load();
const profile = (p: PestType) => config.pestProfiles.get(p) ?? null;

function member(
  id: string,
  specialisation: StaffSpecialisation | null,
  over: Partial<Pick<Account, 'role' | 'isActive'>> = {},
): Account {
  const a = new Account();
  a.id = id;
  a.email = `${id}@d-fence.test`;
  a.authUserId = '';
  a.emailVerified = true;
  a.role = over.role ?? Role.CleaningCrew;
  a.isActive = over.isActive ?? true;
  a.specialisation = specialisation;
  a.telegramChatId = null;
  a.createdAt = new Date(0);
  return a;
}

/** The roster row `rankStaff` reads: an account plus its open-order count. */
function withLoad(a: Account, openWorkOrders: number): RoutingStaff & { openWorkOrders: number } {
  return { id: a.id, email: a.email, role: a.role, isActive: a.isActive, specialisation: a.specialisation, openWorkOrders };
}

const S = StaffSpecialisation;
const T = TaskType;

describe('Policy — each staff type against each task (mosquito, VectorBorne)', () => {
  // What each capability may do on a dengue cluster. Everything not listed is refused.
  const expected: Record<StaffSpecialisation, TaskType[]> = {
    [S.VectorControl]: [T.Fogging, T.Larviciding, T.Inspection],
    [S.Sanitation]: [T.RefuseClearance, T.DrainClearance, T.Inspection],
    [S.Structural]: [], // structural pests only: a mosquito is not its job
    [S.GeneralInspection]: [T.Inspection],
  };

  for (const spec of Object.values(S)) {
    for (const task of Object.values(T)) {
      const allowed = expected[spec].includes(task);
      it(`R1 — ${spec} ${allowed ? 'may' : 'may not'} do ${task}`, () => {
        const reason = ineligibilityReason(member('x', spec), { taskType: task, pestType: PestType.Mosquito }, profile(PestType.Mosquito));
        expect(reason === null).toBe(allowed);
      });
    }
  }

  it('R2 — Structural covers a termite inspection, and Sanitation covers termite drain clearance', () => {
    const termite = profile(PestType.Termite);
    expect(ineligibilityReason(member('x', S.Structural), { taskType: T.Inspection, pestType: PestType.Termite }, termite)).toBeNull();
    expect(ineligibilityReason(member('x', S.Sanitation), { taskType: T.DrainClearance, pestType: PestType.Termite }, termite)).toBeNull();
    expect(ineligibilityReason(member('x', S.VectorControl), { taskType: T.Inspection, pestType: PestType.Termite }, termite)).toMatch(/Structural pests/);
  });

  it('R3 — the shared table names who covers a task, used by the dispatch proposal screen', () => {
    expect(coveringSpecialisations(T.Fogging, PestClass.VectorBorne)).toEqual([S.VectorControl]);
    expect(coveringSpecialisations(T.Inspection, PestClass.VectorBorne)).toEqual([S.VectorControl, S.Sanitation, S.GeneralInspection]);
    expect(coveringSpecialisations(T.Inspection, PestClass.Wildlife)).toEqual([]);
  });

  it('R4 — rat fogging is refused and sanitation leads rat/cockroach inspections', () => {
    expect(permittedTasksFor(PestType.Rat, profile(PestType.Rat))).not.toContain(T.Fogging);
    expect(ineligibilityReason(member('vc', S.VectorControl), { taskType: T.Fogging, pestType: PestType.Rat }, profile(PestType.Rat)))
      .toMatch(/not permitted for Rat/);
    for (const pestType of [PestType.Rat, PestType.Cockroach]) {
      const decision = rankStaff([
        withLoad(member('vc', S.VectorControl), 0),
        withLoad(member('san', S.Sanitation), 5),
      ], { taskType: T.Inspection, pestType }, profile(pestType));
      expect(decision.candidates.map((candidate) => candidate.crewId)).toEqual(['san', 'vc']);
      expect(decision.candidates[0]?.primary).toBe(true);
      expect(decision.candidates[1]?.primary).toBe(false);
    }
  });
});

describe('Policy — inactive, unknown and non-crew accounts', () => {
  const job = { taskType: T.Inspection, pestType: PestType.Mosquito };

  it('U1 — an unrecorded capability is qualified for nothing, not for everything', () => {
    for (const task of Object.values(T)) {
      expect(ineligibilityReason(member('legacy', null), { ...job, taskType: task }, null)).toMatch(/no capability is recorded/);
    }
    // A legacy object that predates the field entirely is treated the same way.
    const legacy: RoutingStaff = { id: 'old', email: 'old@x', role: Role.CleaningCrew, isActive: true };
    expect(ineligibilityReason(legacy, job, null)).toMatch(/no capability is recorded/);
  });

  it('U2 — a deactivated member is refused even with a matching capability (8.2.3)', () => {
    expect(ineligibilityReason(member('gone', S.VectorControl, { isActive: false }), job, null)).toMatch(/deactivated/);
  });

  it('U3 — a manager or a missing account is not crew, whatever it claims', () => {
    expect(ineligibilityReason(member('m', S.VectorControl, { role: Role.OperationsManager }), job, null)).toMatch(/cleaning crew/);
    expect(ineligibilityReason(null, job, null)).toMatch(/cleaning crew/);
  });

  it('U4 — a pest with no catalogue entry matches nobody (no config, a rat)', () => {
    expect(ineligibilityReason(member('x', S.Sanitation), { taskType: T.Inspection, pestType: PestType.Rat }, null)).toMatch(/no pest catalogue entry/);
  });
});

describe('Policy — the wildlife catalogue, birds and bees included, never reaches the crew', () => {
  const referred = [...config.pestProfiles.values()]
    .filter((p) => p.pestClass === PestClass.Wildlife)
    .map((p) => p.pestType);
  const birdsAndBees = [PestType.HouseCrow, PestType.Pigeon, PestType.JavanMyna, PestType.BeeWasp];

  it('W1 — every Wildlife pest and every AVS/NParks bird or bee names an external authority', () => {
    expect(referred.length).toBeGreaterThanOrEqual(10);
    for (const pest of [...referred, ...birdsAndBees]) {
      expect(externalAuthority(profile(pest)), pest).toMatch(/^(AVS|NParks)/);
    }
  });

  it('W2 — no staff type is eligible for any of them, for any task', () => {
    for (const pest of [...referred, ...birdsAndBees]) {
      for (const spec of Object.values(S)) {
        for (const task of Object.values(T)) {
          expect(ineligibilityReason(member('x', spec), { taskType: task, pestType: pest }, profile(pest))).toMatch(/referred to/);
        }
      }
    }
  });

  it('W3 — NEA and VCO pests stay crew work (rat, ant, termite, mosquito)', () => {
    for (const pest of [PestType.Rat, PestType.Ant, PestType.Termite, PestType.Mosquito]) {
      expect(externalAuthority(profile(pest)), pest).toBeNull();
    }
  });
});

describe('Policy — ranking', () => {
  it('K1 — first-choice capability first, then fewest open orders, then email; ineligible never ranked', () => {
    const staff = [
      withLoad(member('b-insp', S.GeneralInspection), 0),
      withLoad(member('a-vc', S.VectorControl), 4),
      withLoad(member('c-vc', S.VectorControl), 1),
      withLoad(member('d-vc', S.VectorControl), 1),
      withLoad(member('e-unknown', null), 0),
      withLoad(member('f-off', S.VectorControl, { isActive: false }), 0),
    ];
    const decision = rankStaff(staff, { taskType: T.Inspection, pestType: PestType.Mosquito }, profile(PestType.Mosquito));

    expect(decision.referral).toBeNull();
    expect(decision.candidates.map((c) => c.crewId)).toEqual(['c-vc', 'd-vc', 'a-vc', 'b-insp']);
    expect(decision.candidates.map((c) => c.primary)).toEqual([true, true, true, false]);
    expect(decision.ineligible.map((m) => m.crewId)).toEqual(['e-unknown', 'f-off']);
    // No invented percentages: the payload carries the facts it is ranked on, nothing else.
    expect(Object.keys(decision.candidates[0] ?? {}).sort()).toEqual(['crewId', 'email', 'openWorkOrders', 'primary', 'specialisation']);
  });

  it('K2 — no workload cap: 8.2.2 shows the count and states no maximum, so 50 open still ranks', () => {
    const decision = rankStaff([withLoad(member('busy', S.VectorControl), 50)], { taskType: T.Fogging, pestType: PestType.Mosquito }, null);
    expect(decision.candidates).toHaveLength(1);
  });

  it('K3 — a referred pest returns the authority and its number, and no candidates', () => {
    const decision = rankStaff([withLoad(member('x', S.GeneralInspection), 0)], { taskType: T.Inspection, pestType: PestType.Pigeon }, profile(PestType.Pigeon));
    expect(decision.referral).toEqual({ authority: 'AVS (NParks Animal Response Centre)', contactNumber: '1800 476 1600' });
    expect(decision.candidates).toEqual([]);
  });
});

interface Fixture {
  dispatch: DispatchController;
  lifecycle: WorkOrderLifecycleController;
  workOrders: InMemoryWorkOrderStore;
  accounts: InMemoryAccountStore;
  staff: StaffAccountController;
  ac: AccessControlService;
  clusterId: string;
  reports: InMemoryReportStore;
  audit: InMemoryAuditStore;
  notifier: RecordingNotifier;
}

async function fixture(bindAccounts = true, bindReports = true): Promise<Fixture> {
  const clusters = new InMemoryClusterStore();
  const cluster = new Cluster();
  cluster.objectId = 'c-routing';
  cluster.locality = 'Tampines St 81';
  cluster.caseSize = 12;
  cluster.caseDelta = 0;
  cluster.isActive = true;
  cluster.premisesMix = new PremisesMix([], [], []);
  await clusters.upsertFromFeed({ retrievedAt: new Date(), records: [cluster] });
  const clusterId = ((await clusters.findActive())[0] as Cluster).id;

  const workOrders = new InMemoryWorkOrderStore();
  const reports = new InMemoryReportStore();
  const notifier = new RecordingNotifier();
  const audit = new InMemoryAuditStore();
  const ac = new AccessControlService(new AccessPolicy(), audit);
  const lifecycle = new WorkOrderLifecycleController(new WorkOrderTransitionTable(), workOrders, new InMemoryTreatmentRecordStore(), notifier, null);
  const accounts = new InMemoryAccountStore();
  for (const a of [
    member('vc-1', S.VectorControl),
    member('vc-2', S.VectorControl),
    member('san-1', S.Sanitation),
    member('san-2', S.Sanitation),
    member('str-1', S.Structural),
    member('insp-1', S.GeneralInspection),
    member('legacy-1', null),
    member('off-1', S.VectorControl, { isActive: false }),
  ]) {
    await accounts.save(a);
  }
  const dispatch = new DispatchController(
    ac, lifecycle, workOrders, clusters, new InMemoryPriorityScoreStore(), notifier,
    null, 10, audit, config, bindAccounts ? accounts : null, bindReports ? reports : null,
  );
  const staff = new StaffAccountController(ac, new LocalAuthProvider(), accounts, new InMemorySessionStore(), audit);
  return { dispatch, lifecycle, workOrders, accounts, staff, ac, clusterId, reports, audit, notifier };
}

async function verifiedReport(f: Fixture, id: string, pestType: PestType, clusterId = f.clusterId): Promise<Report> {
  const report = new Report();
  report.id = id;
  report.reporterId = 'resident-1';
  report.pestType = pestType;
  report.type = ReportType.Other;
  report.description = 'Verified report';
  report.clusterId = clusterId;
  report.localityBinding = 'Tampines St 81';
  report.workOrderId = null;
  report.applyStatus(ReportStatus.Verified);
  return f.reports.save(report);
}

async function order(f: Fixture, taskType: TaskType, pestType = PestType.Mosquito) {
  return f.dispatch.createWorkOrder({ clusterId: f.clusterId, taskType, pestType, scheduledDate: FUTURE }, MANAGER);
}

describe('Controller — assignment and reassignment enforce the policy', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture();
  });

  it('D1 — each staff type can be assigned the job its capability covers', async () => {
    const cases: Array<[TaskType, PestType, string]> = [
      [T.Fogging, PestType.Mosquito, 'vc-1'],
      [T.DrainClearance, PestType.Mosquito, 'san-1'],
      [T.Inspection, PestType.Termite, 'str-1'],
      [T.Inspection, PestType.Mosquito, 'insp-1'],
    ];
    for (const [task, pest, crewId] of cases) {
      const wo = await f.dispatch.createWorkOrder({ clusterId: f.clusterId, taskType: task, pestType: pest, scheduledDate: FUTURE }, MANAGER);
      const assigned = await f.dispatch.assign(wo.id, crewId, MANAGER);
      expect(assigned.assigneeId, `${task}/${pest}`).toBe(crewId);
      // Cancel so the next case's task type is not refused as a duplicate (8.1.11).
      await f.dispatch.cancel(wo.id, 'test case finished', MANAGER);
    }
  });

  it('D2 — a direct assignment to the wrong capability is refused and changes nothing', async () => {
    const wo = await order(f, T.Fogging);
    await expect(f.dispatch.assign(wo.id, 'san-1', MANAGER)).rejects.toThrow(WorkOrderRejected);
    await expect(f.dispatch.assign(wo.id, 'san-1', MANAGER)).rejects.toThrow(/Sanitation does not cover Fogging/);
    const stored = await f.workOrders.findById(wo.id);
    expect(stored?.assigneeId).toBeNull();
    expect(stored?.currentStatus()).toBe(WorkOrderStatus.Created);
    expect(await f.workOrders.assignmentHistory(wo.id)).toHaveLength(0);
  });

  it('D3 — an active crew member with no recorded capability cannot be assigned', async () => {
    const wo = await order(f, T.Inspection);
    await expect(f.dispatch.assign(wo.id, 'legacy-1', MANAGER)).rejects.toThrow(/no capability is recorded/);
  });

  it('D4 — a deactivated account is refused even when the caller says it is active', async () => {
    const wo = await order(f, T.Fogging);
    await expect(f.dispatch.assign(wo.id, 'off-1', MANAGER, true)).rejects.toThrow(/deactivated/);
  });

  it('D5 — reassignment to an ineligible member is refused; the current assignee keeps the job', async () => {
    const wo = await order(f, T.Fogging);
    await f.dispatch.assign(wo.id, 'vc-1', MANAGER);
    await f.lifecycle.accept(wo.id, CREW);
    await expect(f.dispatch.reassign(wo.id, 'insp-1', MANAGER)).rejects.toThrow(/GeneralInspection does not cover Fogging/);
    expect((await f.workOrders.findById(wo.id))?.assigneeId).toBe('vc-1');
    // And to an eligible one it still works (8.2.5).
    await f.dispatch.reassign(wo.id, 'vc-2', MANAGER);
    expect((await f.workOrders.findById(wo.id))?.assigneeId).toBe('vc-2');
  });

  it('D6 — a bird order planted past creation still cannot reach any crew, accounts bound or not', async () => {
    for (const bound of [true, false]) {
      const g = await fixture(bound);
      const wo = await order(g, T.Inspection);
      wo.pestType = PestType.HouseCrow; // as if written straight into the store
      await g.workOrders.save(wo);
      await expect(g.dispatch.assign(wo.id, 'insp-1', MANAGER)).rejects.toThrow(/AVS/);
      expect((await g.workOrders.findById(wo.id))?.assigneeId).toBeNull();
    }
  });

  it('D7 — creation refuses the AVS birds and the NParks bees and offers referral; ants are still crew work', async () => {
    for (const pest of [PestType.HouseCrow, PestType.Pigeon, PestType.JavanMyna, PestType.BeeWasp, PestType.Snake]) {
      await expect(order(f, T.Inspection, pest), pest).rejects.toThrow(/(AVS|NParks)[\s\S]*refer the report instead/);
    }
    await expect(order(f, T.Inspection, PestType.Ant)).resolves.toBeDefined();
    await expect(order(f, T.Fogging, PestType.Rat)).rejects.toThrow(/not a permitted task for Rat/);
  });

  it('D8 — routingFor ranks from the stored roster and live workload', async () => {
    const busy = await order(f, T.Fogging);
    await f.dispatch.assign(busy.id, 'vc-1', MANAGER);
    const wo = await order(f, T.Larviciding);

    const decision = await f.dispatch.routingFor(wo.id, MANAGER);
    expect(decision.candidates.map((c) => [c.crewId, c.openWorkOrders])).toEqual([
      ['vc-2', 0],
      ['vc-1', 1],
    ]);
    expect(decision.ineligible.map((m) => m.crewId).sort()).toEqual(['insp-1', 'legacy-1', 'off-1', 'san-1', 'san-2', 'str-1']);
  });

  it('D9 — routing is a manager action (2.3.5)', async () => {
    const wo = await order(f, T.Fogging);
    await expect(f.dispatch.routingFor(wo.id, CREW)).rejects.toThrow(/not authorised/);
  });

  it('D11 — a source report cannot bypass validation when the report store is unbound', async () => {
    const unbound = await fixture(true, false);
    await expect(unbound.dispatch.createWorkOrder({
      clusterId: unbound.clusterId,
      taskType: T.Inspection,
      sourceReportId: 'unverified-or-missing',
      scheduledDate: FUTURE,
    }, MANAGER)).rejects.toThrow(/source report validation is unavailable/);
    expect(await unbound.workOrders.findAll()).toHaveLength(0);
  });

  it('D10 — refused assignment in completed and terminal states changes no assignment evidence', async () => {
    const cases: Array<[WorkOrderStatus, TaskType, string]> = [
      [WorkOrderStatus.Completed, T.Fogging, 'vc-1'],
      [WorkOrderStatus.Verified, T.Larviciding, 'vc-1'],
      [WorkOrderStatus.Rejected, T.Inspection, 'insp-1'],
      [WorkOrderStatus.Cancelled, T.DrainClearance, 'san-1'],
    ];
    for (const [finalState, task, crewId] of cases) {
      const crew = new Principal(crewId, Role.CleaningCrew, `session-${crewId}`);
      const wo = await order(f, task);
      await f.dispatch.assign(wo.id, crewId, MANAGER);
      if (finalState === WorkOrderStatus.Cancelled) {
        await f.dispatch.cancel(wo.id, 'close test order', MANAGER);
      } else {
        await f.lifecycle.accept(wo.id, crew);
        await f.lifecycle.start(wo.id, crew);
        await f.lifecycle.complete(wo.id, {
          id: 'evidence-1', workOrderId: wo.id, photoKeys: ['photo'], notes: 'treated',
          taskPerformed: task, completedAt: new Date(), rejectionReason: null,
        }, crew);
        if (finalState === WorkOrderStatus.Verified) await f.lifecycle.verify(wo.id, MANAGER);
        if (finalState === WorkOrderStatus.Rejected) await f.lifecycle.rejectCompletion(wo.id, 'please repeat inspection', MANAGER);
      }
      const historyBefore = await f.workOrders.assignmentHistory(wo.id);
      const auditBefore = (await f.audit.recent(100)).length;
      const notificationsBefore = f.notifier.sent.length;
      const alternate = crewId === 'san-1' ? 'san-2' : 'vc-2';
      await expect(f.dispatch.reassign(wo.id, alternate, MANAGER)).rejects.toThrow(TransitionRefused);
      expect((await f.workOrders.findById(wo.id))?.assigneeId).toBe(crewId);
      expect(await f.workOrders.assignmentHistory(wo.id)).toEqual(historyBefore);
      expect((await f.workOrders.findById(wo.id))?.currentStatus()).toBe(finalState);
      expect(f.notifier.sent.length).toBe(notificationsBefore);
      expect((await f.audit.recent(100)).length).toBe(auditBefore);
    }
  });
});

/** A two-method Response fake, enough to read what the handler said. */
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

describe('HTTP — the boundary refuses what the screen would not offer', () => {
  let f: Fixture;
  let routes: WorkOrderRoutes;
  const req = (route: string, params: Record<string, string> = {}, body: unknown = undefined, token = 'mgr'): Request => ({
    headers: { authorization: `Bearer ${token}` },
    params: { route, ...params },
    body,
  });

  beforeEach(async () => {
    f = await fixture();
    routes = new WorkOrderRoutes(f.ac, f.dispatch, f.lifecycle, f.staff);
    routes.useResolver({ resolve: async (t) => (t === 'mgr' ? MANAGER : t === 'crew' ? CREW : null) });
  });

  it('H1 — POST assign to an ineligible crew member answers 400 with the reason', async () => {
    const wo = await order(f, T.Fogging);
    const res = response();
    await routes.handle(req('/api/ops/work-orders/:id/assign', { id: wo.id }, { crewId: 'san-1' }), res);
    expect(res.code).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/Sanitation does not cover Fogging/);

    const ok = response();
    await routes.handle(req('/api/ops/work-orders/:id/assign', { id: wo.id }, { crewId: 'vc-1' }), ok);
    expect(ok.code).toBe(200);
    expect((ok.body as { assigneeId: string }).assigneeId).toBe('vc-1');
  });

  it('allows different pests to have the same task at one cluster while still refusing a true duplicate', async () => {
    const mosquito = await order(f, T.Inspection, PestType.Mosquito);
    const termite = await order(f, T.Inspection, PestType.Termite);
    expect(termite.id).not.toBe(mosquito.id);
    await expect(order(f, T.Inspection, PestType.Termite)).rejects.toThrow(/open Inspection work order/);
  });

  it('H7 — route preview exposes insufficient-crew urgent work and leaves stored orders unchanged', async () => {
    const point = new GeoPoint(1.32, 103.85);
    const handler = new WorkOrderRoutes(f.ac, f.dispatch, f.lifecycle, f.staff,
      new RouteOptimizationService(new MockRoadRoutingStrategy()), async () => ({
        teams: [{ teamId: 'Central-Vector', hq: point, capabilities: ['Vector'], staffCount: 1 }],
        jobs: [
          { workOrderId: 'urgent', point, requiredCapability: 'Vector', taskType: TaskType.Fogging,
            requiredStaff: 3, priority: 'High', locality: 'Urgent site' },
          { workOrderId: 'routine', point, requiredCapability: 'Vector', taskType: TaskType.Inspection,
            requiredStaff: 1, priority: 'Low' },
        ],
      }));
    handler.useResolver({ resolve: async () => MANAGER });
    const res = response();
    await handler.handle(req('/api/ops/dispatch/routes', { date: FUTURE }), res);
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ date: FUTURE,
      routes: [{ staffCount: 1, workOrderIds: ['routine'] }],
      unplanned: [{ workOrderId: 'urgent', priority: 'High', requiredStaff: 3 }] });
    expect(await f.workOrders.findAll()).toHaveLength(0);
  });

  it('keeps committed work out of fallback allocation and distinguishes committed and unverified reasons', async () => {
    const point = new GeoPoint(1.32, 103.85);
    const jobs: RouteJob[] = [
      ...[WorkOrderStatus.Assigned, WorkOrderStatus.Accepted, WorkOrderStatus.InProgress].map((status, i) => ({
        workOrderId: `committed-${i}`, point, requiredCapability: 'Vector', status,
      })),
      { workOrderId: 'rejected', point, requiredCapability: 'Vector', status: WorkOrderStatus.Rejected },
      { workOrderId: 'road-unknown', point, requiredCapability: 'Vector' },
      { workOrderId: 'capacity', point, requiredCapability: 'Vector' },
    ];
    const planner = { plan: vi.fn(async (_teams: unknown, pending: RouteJob[], _vehicles: unknown, unverified: Set<string>) => {
      expect(pending.map((job) => job.workOrderId)).toEqual(['road-unknown', 'capacity']);
      unverified.add('road-unknown');
      return [];
    }) } as unknown as RouteOptimizationService;
    const handler = new WorkOrderRoutes(f.ac, f.dispatch, f.lifecycle, f.staff, planner, async () => ({ teams: [], jobs }));
    handler.useResolver({ resolve: async () => MANAGER });
    const res = response();
    await handler.handle(req('/api/ops/dispatch/routes', { date: FUTURE }), res);
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ routes: [], unplanned: [
      ...[WorkOrderStatus.Assigned, WorkOrderStatus.Accepted, WorkOrderStatus.InProgress].map((_status, i) => ({
        workOrderId: `committed-${i}`,
        reason: 'Already assigned, accepted or in progress; retain existing assignment and exclude from new allocation.',
      })),
      { workOrderId: 'rejected', reason: 'Committed work is excluded from new allocation; retain/review its existing assignment.' },
      { workOrderId: 'road-unknown', reason: expect.stringContaining('could not be verified') },
      { workOrderId: 'capacity', reason: expect.stringContaining('sufficient staff') },
    ] });
    expect(planner.plan).toHaveBeenCalledWith([], expect.any(Array), undefined, expect.any(Set));
  });

  it('H2 — a crew member cannot assign at all (role guard preserved)', async () => {
    const wo = await order(f, T.Fogging);
    const res = response();
    await routes.handle(req('/api/ops/work-orders/:id/assign', { id: wo.id }, { crewId: 'vc-1' }, 'crew'), res);
    expect(res.code).toBe(403);
  });

  it('H8 — HTTP reads a pending snapshot without waiting for the road planner', async () => {
    let finish!: (routes: []) => void;
    const waiting = new Promise<[]>((done) => { finish = done; });
    const precomputed = new DispatchPlanService(async () => ({ teams: [], jobs: [], vehicles: [] }),
      { plan: async () => waiting });
    const running = precomputed.refresh(FUTURE);
    const handler = new WorkOrderRoutes(f.ac, f.dispatch, f.lifecycle, f.staff, null, null, null, precomputed);
    handler.useResolver({ resolve: async () => MANAGER });
    const res = response();
    await handler.handle(req('/api/ops/dispatch/routes', { date: FUTURE }), res);
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ planStatus: 'pending', routes: [], computedAt: null });
    finish([]);
    await running;
  });

  it('H3 — the detail carries the ranked routing, and the workload carries each capability', async () => {
    const wo = await order(f, T.Fogging);
    const detail = response();
    await routes.handle(req('/api/ops/work-orders/:id', { id: wo.id }), detail);
    const body = detail.body as { workOrder: { pestType: string }; routing: { candidates: Array<{ crewId: string }> } };
    expect(body.workOrder.pestType).toBe(PestType.Mosquito);
    expect(body.routing.candidates.map((c) => c.crewId)).toEqual(['vc-1', 'vc-2']);

    const load = response();
    await routes.handle(req('/api/ops/work-orders/crew-workload'), load);
    const crew = (load.body as { crew: Array<{ crewId: string; specialisation: string | null }> }).crew;
    expect(crew.find((c) => c.crewId === 'san-1')?.specialisation).toBe(S.Sanitation);
    expect(crew.find((c) => c.crewId === 'legacy-1')?.specialisation).toBeNull();
  });

  it('H4 — HTTP creation trusts the verified source pest and links all verified reports in its cluster', async () => {
    const source = await verifiedReport(f, 'termite-source', PestType.Termite);
    const additional = await verifiedReport(f, 'termite-other', PestType.Termite);
    const differentPest = await verifiedReport(f, 'mosquito-other', PestType.Mosquito);
    const res = response();
    await routes.handle(req('/api/ops/work-orders', {}, {
      clusterId: f.clusterId, taskType: T.Inspection, sourceReportId: source.id,
    }), res);
    expect(res.code).toBe(201);
    const card = res.body as { id: string; pestType: string };
    expect(card.pestType).toBe(PestType.Termite);
    expect((await f.reports.findById(source.id))?.workOrderId).toBe(card.id);
    expect((await f.reports.findById(additional.id))?.workOrderId).toBe(card.id);
    expect((await f.reports.findById(differentPest.id))?.workOrderId).toBeNull();
    const routing = await f.dispatch.routingFor(card.id, MANAGER);
    expect(routing.candidates.map((member) => member.specialisation)).toContain(S.Structural);
    expect(routing.candidates.map((member) => member.specialisation)).not.toContain(S.VectorControl);
  });

  it('H5 — HTTP rejects a source pest override and an invalid or unverified source before order writes', async () => {
    const source = await verifiedReport(f, 'rat-source', PestType.Rat);
    const mismatch = response();
    await routes.handle(req('/api/ops/work-orders', {}, {
      clusterId: f.clusterId, taskType: T.Inspection, pestType: PestType.Mosquito, sourceReportId: source.id,
    }), mismatch);
    expect(mismatch.code).toBe(400);
    expect((await f.workOrders.findAll())).toHaveLength(0);

    const missing = response();
    await routes.handle(req('/api/ops/work-orders', {}, {
      clusterId: f.clusterId, taskType: T.Inspection, sourceReportId: 'missing-report',
    }), missing);
    expect(missing.code).toBe(400);
    expect((await f.workOrders.findAll())).toHaveLength(0);

    const outsideCluster = await verifiedReport(f, 'outside-cluster-source', PestType.Rat, 'other-cluster');
    const outsideRejected = response();
    await routes.handle(req('/api/ops/work-orders', {}, {
      clusterId: f.clusterId, taskType: T.Inspection, sourceReportId: outsideCluster.id,
    }), outsideRejected);
    expect(outsideRejected.code).toBe(400);
    expect((await f.reports.findById(outsideCluster.id))?.workOrderId).toBeNull();
    expect((await f.workOrders.findAll())).toHaveLength(0);

    const unverified = await verifiedReport(f, 'unverified-source', PestType.Rat);
    unverified.applyStatus(ReportStatus.Submitted);
    await f.reports.save(unverified);
    const refused = response();
    await routes.handle(req('/api/ops/work-orders', {}, {
      clusterId: f.clusterId, taskType: T.Inspection, sourceReportId: unverified.id,
    }), refused);
    expect(refused.code).toBe(400);
    expect((await f.workOrders.findAll())).toHaveLength(0);
  });

  it('H6 — HTTP creation refuses snake and bird reports for referral before storing work', async () => {
    for (const pestType of [PestType.Snake, PestType.HouseCrow]) {
      const source = await verifiedReport(f, `external-${pestType}`, pestType);
      const refused = response();
      await routes.handle(req('/api/ops/work-orders', {}, {
        clusterId: f.clusterId, taskType: T.Inspection, sourceReportId: source.id,
      }), refused);
      expect(refused.code).toBe(400);
      expect((refused.body as { error: string }).error).toMatch(/(AVS|NParks)[\s\S]*refer the report instead/);
      expect(await f.workOrders.findAll()).toHaveLength(0);
    }
  });
});
