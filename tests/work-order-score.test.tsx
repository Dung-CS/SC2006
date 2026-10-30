/**
 * @vitest-environment jsdom
 *
 * T5 item 5 — the score breakdown lives only in the opened task. The work-order detail API returns
 * the stored same-locality / same-pest score; the map popup carries an "Open task" control instead.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { principalFor } from '../src/control/DashboardController';
import { DispatchController } from '../src/control/DispatchController';
import { StaffAccountController } from '../src/control/StaffAccountController';
import { WorkOrderLifecycleController } from '../src/control/WorkOrderLifecycleController';
import { WorkOrderTransitionTable } from '../src/control/WorkOrderTransitionTable';
import { WorkOrderRoutes } from '../src/boundary/http/WorkOrderRoutes';
import { Request, Response } from '../src/boundary/http/RouteHandler';
import { PriorityScore } from '../src/entity/PriorityScore';
import { WorkOrder } from '../src/entity/WorkOrder';
import { PestType, PriorityTier, Role, TaskType, WorkOrderStatus } from '../src/entity/enums';
import { InMemoryAccountStore, InMemorySessionStore, LocalAuthProvider } from '../src/persistence/memory/InMemoryAccountStores';
import { InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../src/persistence/memory/InMemoryStores';
import { InMemoryTreatmentRecordStore, InMemoryWorkOrderStore, RecordingNotifier } from '../src/persistence/memory/InMemoryWorkOrderStores';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { WorkOrderDetailScreen } from '../client/src/screens/operations/WorkOrderDetailScreen';
import { createTaskCallout, MapTask } from '../client/src/components/SingaporeMap';

afterEach(() => cleanup());
const MANAGER = principalFor(Role.OperationsManager, 'manager-1');

async function detail(withScore: boolean): Promise<any> {
  const audit = new InMemoryAuditStore();
  const ac = new AccessControlService(new AccessPolicy(), audit);
  const workOrders = new InMemoryWorkOrderStore();
  const scores = new InMemoryPriorityScoreStore();
  const accounts = new InMemoryAccountStore();
  const lifecycle = new WorkOrderLifecycleController(new WorkOrderTransitionTable(), workOrders, new InMemoryTreatmentRecordStore(), new RecordingNotifier(), null);
  const dispatch = new DispatchController(ac, lifecycle, workOrders, new InMemoryClusterStore(), scores, new RecordingNotifier(),
    null, 10, audit, ConfigLoader.load(), accounts, new InMemoryReportStore());
  const order = Object.assign(new WorkOrder(), { id: 'wo-1', clusterId: 'loc-1', scheduledDate: '2099-01-01', pestType: PestType.Mosquito,
    taskType: TaskType.Fogging, priority: PriorityTier.High, assigneeId: null, instructions: 'i' });
  order.applyStatus(WorkOrderStatus.Created);
  await workOrders.save(order);
  if (withScore) {
    await scores.saveAll([Object.assign(new PriorityScore(), { id: 's-1', clusterId: 'loc-1', localityId: 'loc-1', pestType: PestType.Mosquito,
      computedAt: new Date('2026-09-03T00:00:00Z'), score: 72, tier: PriorityTier.High, isDegraded: false, excludedDrivers: [], rank: 0,
      severityMultiplier: 0.8, urgency: 0.9 }),
    // Same locality, other pest: must not be borrowed.
    Object.assign(new PriorityScore(), { id: 's-2', clusterId: 'loc-1', localityId: 'loc-1', pestType: PestType.Rat,
      computedAt: new Date('2026-09-03T00:00:00Z'), score: 10, tier: PriorityTier.Low, isDegraded: false, excludedDrivers: [], rank: 1 })]);
  }
  const staff = new StaffAccountController(ac, new LocalAuthProvider(), accounts, new InMemorySessionStore(), audit);
  const routes = new WorkOrderRoutes(ac, dispatch, lifecycle, staff);
  routes.useResolver({ resolve: async (t) => (t === 'mgr' ? MANAGER : null) });
  const res = { code: 200, body: undefined as any, status(c: number) { res.code = c; return res; }, json(b: unknown) { res.body = b; }, text() {} };
  await routes.handle({ headers: { authorization: 'Bearer mgr' }, params: { route: '/api/ops/work-orders/:id', id: 'wo-1' }, body: undefined } as Request,
    res as unknown as Response);
  expect(res.code).toBe(200);
  return res.body;
}

describe('work-order detail returns the stored explanation', () => {
  it('returns the same-locality same-pest stored score only', async () => {
    const body = await detail(true);
    expect(body.scoreExplanation.workOrderPriority).toBe(PriorityTier.High);
    expect(body.scoreExplanation.localityScore).toMatchObject({ value: 72, tier: PriorityTier.High });
  });

  it('carries no locality score when none is stored, and the screen says so plainly', async () => {
    const body = await detail(false);
    expect(body.scoreExplanation.localityScore).toBeUndefined();
    const fetcher: Fetcher = async (url) => {
      const table: Record<string, unknown> = { '/api/ops/work-orders/wo-1': body, '/api/ops/work-orders/crew-workload': { crew: [] },
        '/api/ops/work-orders/wo-1/history': { entries: [] } };
      return { ok: true, status: 200, json: async () => table[url] ?? {} } as unknown as globalThis.Response;
    };
    render(<WorkOrderDetailScreen api={new ApiClient('', fetcher)} params={{ id: 'wo-1' }} principal={{ accountId: 'm', role: Role.OperationsManager }}
      onNavigate={vi.fn()} onPrincipalChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Score breakdown')).toBeTruthy());
    expect(screen.getByText('No score breakdown recorded for this task.')).toBeTruthy();
  });
});

describe('map popup', () => {
  const task: MapTask = { id: 'report-1', point: { latitude: 1.3, longitude: 103.8 }, pestType: 'Mosquito', taskType: 'Inspection', priority: 'High',
    location: 'Bedok', photoUrl: '/x.jpg', photoIsReference: true,
    scoreExplanation: { workOrderPriority: 'High' } } as MapTask;

  it('shows no score breakdown and opens the task instead', () => {
    const opened = vi.fn();
    const card = createTaskCallout(task, undefined, opened);
    expect(card.querySelector('[data-part="score-breakdown"]')).toBeNull();
    const open = card.querySelector<HTMLButtonElement>('[data-part="open-task"]')!;
    expect(open.textContent).toBe('Open task');
    open.click();
    expect(opened).toHaveBeenCalledWith(task);
  });
});
