import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DispatchJob, DispatchPlanInputs, DispatchPlanService } from '../src/control/DispatchPlanService';
import { PlannedTeamRoute, RouteJob, RouteOptimizationService } from '../src/control/RouteOptimizationService';
import { GeoPoint } from '../src/entity/valueTypes';
import { MockRoadRoutingStrategy } from './helpers/MockRoadRoutingStrategy';
import { Vehicle } from '../src/entity/Vehicle';
import { HqLocation } from '../src/entity/enums';

const date = '2099-01-01';
const point = new GeoPoint(1.3, 103.8);
const job = (id: string, extra: Partial<DispatchJob> = {}): DispatchJob => ({
  workOrderId: id, point, requiredCapability: 'Vector', priority: 'High', ...extra,
});
const input = (jobs: DispatchJob[]): DispatchPlanInputs => ({ teams: [], vehicles: [], jobs });
const route = (jobs: RouteJob[]): PlannedTeamRoute => ({ workOrderIds: jobs.map((item) => item.workOrderId) } as PlannedTeamRoute);
const complete = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(250); };

describe('Background dispatch horizon', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('returns seven pending days immediately, coalesces requests and never repeats stable report identities', async () => {
    const load = vi.fn(async (selected: string) => input([
      job('urgent', { reportIds: ['a', 'b'], sourceReportId: 'a' }),
      job(`alias-${selected}`, { reportIds: ['b'], sourceReportId: 'b' }),
      job('second'), job('third'), job('fourth'), job('fifth'), job('sixth'), job('seventh'),
    ]));
    const planner = { plan: vi.fn(async (_teams: unknown, jobs: RouteJob[]) => jobs.length ? [route(jobs.slice(0, 1))] : []) };
    const service = new DispatchPlanService(load, planner);
    const pending = service.snapshotRange(date, 7);
    expect(pending.planStatus).toBe('pending');
    expect(pending.plans).toHaveLength(7);
    expect(load).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) service.snapshotRange(date, 7);
    await complete();
    const result = service.snapshotRange(date, 7);
    expect(result.planStatus).toBe('ready');
    const ids = result.plans.flatMap((plan) => plan.routes.flatMap((item) => item.workOrderIds));
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
    expect(ids).not.toEqual(expect.arrayContaining([expect.stringContaining('alias-')]));
    expect(result.unassigned).toEqual([]);
    expect(load).toHaveBeenCalledTimes(7);
    expect(planner.plan.mock.calls.every((call) => (call[1] as RouteJob[]).every((item) => !item.workOrderId.startsWith('alias-')))).toBe(true);
    result.plans.length = 0;
    expect(service.snapshotRange(date, 7).plans).toHaveLength(7);
  });

  it('carries unplanned jobs forward, honours scheduled dates and keeps referrals and committed work distinct', async () => {
    const load = vi.fn(async () => ({ ...input([
      job('blocked'), job('tomorrow', { scheduledDate: '2099-01-02' }),
      job('assigned', { status: 'Assigned', reportIds: ['committed-report'] }),
      job('alias', { sourceReportId: 'committed-report' }),
    ]), referrals: [{ reportId: 'external', priority: 'High', authority: 'NParks' }] }));
    const planner = { plan: vi.fn(async (_teams: unknown, jobs: RouteJob[]) => jobs.filter((item) => item.workOrderId === 'tomorrow').map((item) => route([item]))) };
    const service = new DispatchPlanService(load, planner);
    service.snapshotRange(date, 3);
    await complete();
    const result = service.snapshotRange(date, 3);
    expect(planner.plan.mock.calls[0]![1].map((item) => item.workOrderId)).toEqual(['blocked']);
    expect(result.plans[0]!.routes).toEqual([]);
    expect(result.plans[1]!.routes[0]!.workOrderIds).toEqual(['tomorrow']);
    expect(result.plans[2]!.routes).toEqual([]);
    expect(result.unassigned).toEqual([
      expect.objectContaining({ workOrderId: 'assigned', disposition: 'committed', status: 'Assigned' }),
      expect.objectContaining({ workOrderId: 'blocked', disposition: 'unassigned' }),
    ]);
    expect(result.referrals).toHaveLength(1);
    expect(planner.plan.mock.calls.every((call) => call[1].some((item) => item.workOrderId === 'blocked'))).toBe(true);
  });

  it('publishes completed days and urgent pending tasks before a later provider returns', async () => {
    let release!: (routes: PlannedTeamRoute[]) => void;
    const slow = new Promise<PlannedTeamRoute[]>((done) => { release = done; });
    const planner = { plan: vi.fn().mockResolvedValueOnce([route([job('one')])]).mockImplementationOnce(() => slow) };
    const service = new DispatchPlanService(async () => input([job('one'), job('two')]), planner);
    service.snapshotRange(date, 2);
    await complete();
    const result = service.snapshotRange(date, 2);
    expect(result.planStatus).toBe('pending');
    expect(result.plans[0]!.planStatus).toBe('ready');
    expect(result.plans[1]!.unplanned).toEqual([expect.objectContaining({ workOrderId: 'two', priority: 'High',
      reason: expect.stringContaining('in progress') })]);
    release([route([job('two')])]);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.snapshotRange(date, 2).planStatus).toBe('ready');
  });

  it('bounds the whole range to thirty seconds and keeps urgent unknown access visible for retry', async () => {
    const planner = { plan: vi.fn(() => new Promise<PlannedTeamRoute[]>(() => {})) };
    const service = new DispatchPlanService(async () => input([job('unknown')]), planner);
    service.snapshotRange(date, 7);
    await complete();
    await vi.advanceTimersByTimeAsync(30_000);
    const result = service.snapshotRange(date, 7);
    expect(result.planStatus).toBe('failed');
    expect(result.plans).toHaveLength(7);
    expect(result.unassigned[0]).toMatchObject({ workOrderId: 'unknown', priority: 'High',
      reason: expect.stringContaining('could not be verified') });
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect(planner.plan.mock.calls[0]).toHaveLength(5);
    service.snapshotRange(date, 7);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(planner.plan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    service.snapshotRange(date, 7);
    await complete();
    expect(planner.plan).toHaveBeenCalledTimes(2);
  });

  it('retains the last good range on failure and expires successful cached ranges after five minutes', async () => {
    const planner = { plan: vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue([]) };
    let jobs = [job('first')];
    const service = new DispatchPlanService(async () => input(jobs), planner);
    service.snapshotRange(date, 1);
    await complete();
    const computedAt = service.snapshotRange(date, 1).computedAt;
    jobs = [job('new')];
    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1);
    expect(service.snapshotRange(date, 1).planStatus).toBe('ready');
    expect(planner.plan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(service.snapshotRange(date, 1).planStatus).toBe('refreshing');
    await complete();
    expect(service.snapshotRange(date, 1)).toMatchObject({ planStatus: 'failed', computedAt,
      unassigned: [{ workOrderId: 'first' }] });
    for (let i = 0; i < 5; i++) service.snapshotRange(date, 1);
    expect(planner.plan).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    service.snapshotRange(date, 1);
    await complete();
    expect(service.snapshotRange(date, 1)).toMatchObject({ planStatus: 'ready', unassigned: [{ workOrderId: 'new' }] });
  });

  it('reuses accepted partial days so a failed later day can make progress on retry', async () => {
    const planner = { plan: vi.fn().mockResolvedValueOnce([route([job('first')])])
      .mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce([route([job('second')])]) };
    const service = new DispatchPlanService(async () => input([job('first'), job('second')]), planner);
    service.snapshotRange(date, 2);
    await complete();
    expect(service.snapshotRange(date, 2)).toMatchObject({ planStatus: 'failed', plans: [
      { planStatus: 'ready', routes: [{ workOrderIds: ['first'] }] }, { planStatus: 'failed' },
    ] });
    expect(planner.plan).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    service.snapshotRange(date, 2);
    await complete();
    expect(service.snapshotRange(date, 2).planStatus).toBe('ready');
    expect(planner.plan).toHaveBeenCalledTimes(3);
    expect(service.snapshotRange(date, 2).plans.flatMap((plan) => plan.routes.flatMap((item) => item.workOrderIds)))
      .toEqual(['first', 'second']);
  });

  it('checks periodic invalidations without repeating unchanged provider work before the five-minute expiry', async () => {
    const planner = { plan: vi.fn(async (..._args: unknown[]) => []) };
    const service = new DispatchPlanService(async () => input([job('same')]), planner);
    service.snapshotRange(date, 2);
    await complete();
    const rangeCalls = (): number => planner.plan.mock.calls.filter((call) => call.length === 5).length;
    expect(rangeCalls()).toBe(2);
    await vi.advanceTimersByTimeAsync(30_000);
    service.invalidateAll();
    await complete();
    expect(service.snapshotRange(date, 2).planStatus).toBe('ready');
    expect(rangeCalls()).toBe(2);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    service.snapshotRange(date, 2);
    await complete();
    expect(rangeCalls()).toBe(4);
  });

  it('reuses real daily headcount and fleet limits without multiplying concurrent resources', async () => {
    const vehicle: Vehicle = { id: 'van', registration: 'DEMO', name: 'Demo van', isDemo: true, hqLocation: HqLocation.Central,
      isAvailable: true, seatCapacity: 1, maxPayloadKg: 1000, maxCargoVolumeM3: 10,
      cargoLengthCm: 400, cargoWidthCm: 200, cargoHeightCm: 200 };
    const teams = [{ teamId: 'Central-Vector', hq: point, capabilities: ['Vector'], staffCount: 1, maxStops: 1 }];
    const jobs = Array.from({ length: 7 }, (_, index) => job(`job-${index}`, { requiredStaff: 1 }));
    const service = new DispatchPlanService(async () => ({ teams, jobs, vehicles: [vehicle] }),
      new RouteOptimizationService(new MockRoadRoutingStrategy()));
    service.snapshotRange(date, 7);
    await complete();
    const result = service.snapshotRange(date, 7);
    expect(result.planStatus).toBe('ready');
    expect(result.plans.every((plan) => plan.routes.length === 1 && plan.routes[0]!.staffCount === 1 &&
      plan.routes[0]!.vehicleId === 'van' && plan.routes[0]!.workOrderIds.length === 1)).toBe(true);
    expect(new Set(result.plans.flatMap((plan) => plan.routes.flatMap((item) => item.workOrderIds))).size).toBe(7);
    expect(teams[0]!.staffCount).toBe(1);
  });

  it.each([['2099-02-30', 7], ['invalid', 1], [date, 0], [date, 8], [date, 1.5]])('rejects invalid range %s/%s', (start, days) => {
    const service = new DispatchPlanService(async () => input([]), { plan: async () => [] });
    expect(() => service.snapshotRange(String(start), Number(days))).toThrow(RangeError);
  });

  it('refuses an eighth active range without launching another loader', async () => {
    const load = vi.fn(() => new Promise<DispatchPlanInputs>(() => {}));
    const service = new DispatchPlanService(load, { plan: async () => [] });
    for (let day = 1; day <= 7; day++) service.snapshotRange(`2099-01-0${day}`, 1);
    const busy = service.snapshotRange('2099-01-08', 1);
    expect(busy).toMatchObject({ planStatus: 'pending', busy: true, retryAfterSeconds: 1 });
    await complete();
    expect(load).toHaveBeenCalledTimes(7);
  });

  it('publishes accepted daily routes before the outer range deadline', async () => {
    const planner = { plan: vi.fn(async (_teams: unknown, jobs: RouteJob[], _vehicles: unknown, _unverified: unknown,
      options?: { deadline?: number }) => {
      if (!jobs.length) return [];
      await new Promise<void>((resolve) => setTimeout(resolve, options!.deadline! - Date.now()));
      return [route(jobs)];
    }) };
    const service = new DispatchPlanService(async () => input([job('accepted')]), planner);
    service.snapshotRange(date, 2);
    await complete();
    await vi.advanceTimersByTimeAsync(29_999);
    const result = service.snapshotRange(date, 2);
    expect(result.planStatus).toBe('ready');
    expect(result.plans[0]!.routes[0]!.workOrderIds).toEqual(['accepted']);
    expect(result.unassigned).toEqual([]);
  });

  it('aborts the input loader when the shared range deadline expires', async () => {
    let signal: AbortSignal | undefined;
    const service = new DispatchPlanService(async (_date, cancellation) => {
      signal = cancellation;
      return new Promise<DispatchPlanInputs>(() => {});
    }, { plan: async () => [] });
    service.snapshotRange(date, 7);
    await complete();
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(signal?.aborted).toBe(true);
    expect(service.snapshotRange(date, 7).planStatus).toBe('failed');
  });

  it('publishes twenty thousand pending identities without pairwise deduplication scans', async () => {
    const jobs = Array.from({ length: 20_000 }, (_, index) => job(`large-${index}`, { sourceReportId: `report-${index}` }));
    const service = new DispatchPlanService(async () => input(jobs), { plan: async () => [] });
    service.snapshotRange(date, 1);
    await complete();
    await vi.advanceTimersByTimeAsync(100);
    const result = service.snapshotRange(date, 1);
    expect(result.planStatus).toBe('ready');
    expect(result.unassigned).toHaveLength(20_000);
    expect(new Set(result.unassigned.map((item) => item.workOrderId)).size).toBe(20_000);
  });
});
