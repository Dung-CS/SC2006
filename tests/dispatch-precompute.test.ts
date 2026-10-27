import { describe, expect, it, vi } from 'vitest';
import { DispatchPlanInputs, DispatchPlanService } from '../src/control/DispatchPlanService';
import { RouteJob, PlannedTeamRoute } from '../src/control/RouteOptimizationService';
import { GeoPoint } from '../src/entity/valueTypes';

const date = '2099-01-01';
const input = (id = 'job'): DispatchPlanInputs => ({ teams: [], vehicles: [], referrals: [],
  jobs: [{ workOrderId: id, point: new GeoPoint(1.3, 103.8), requiredCapability: 'Vector', priority: 'High' }] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Dispatch precomputation', () => {
  it('returns pending immediately while a slow planner runs, then reuses completed work on page reads', async () => {
    const road = deferred<PlannedTeamRoute[]>();
    const planner = { plan: vi.fn(() => road.promise) };
    const service = new DispatchPlanService(async () => input(), planner);
    const work = service.refresh(date);
    expect(service.snapshot(date).planStatus).toBe('pending');
    expect(service.snapshot(date).routes).toEqual([]);
    road.resolve([]);
    await work;
    expect(service.snapshot(date)).toMatchObject({ planStatus: 'ready', unplanned: [{ workOrderId: 'job' }] });
    for (let i = 0; i < 10; i++) service.snapshot(date);
    expect(planner.plan).toHaveBeenCalledTimes(1);
    await service.refresh(date);
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it('recomputes after a changed task, fleet or staff snapshot and preserves the previous plan during refresh', async () => {
    let current = input('first');
    const second = deferred<PlannedTeamRoute[]>();
    const planner = { plan: vi.fn().mockResolvedValueOnce([]).mockImplementationOnce(() => second.promise) };
    const service = new DispatchPlanService(async () => current, planner);
    await service.refresh(date);
    current = input('second');
    const refresh = service.refresh(date);
    await Promise.resolve();
    expect(service.snapshot(date)).toMatchObject({ planStatus: 'refreshing', unplanned: [{ workOrderId: 'first' }] });
    second.resolve([]);
    await refresh;
    expect(service.snapshot(date)).toMatchObject({ planStatus: 'ready', unplanned: [{ workOrderId: 'second' }] });
    expect(planner.plan).toHaveBeenCalledTimes(2);
  });

  it('does not lose a source change that arrives during computation', async () => {
    let current = input('old');
    const first = deferred<PlannedTeamRoute[]>();
    const planner = { plan: vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue([]) };
    const service = new DispatchPlanService(async () => current, planner);
    const running = service.refresh(date);
    await Promise.resolve();
    current = input('new');
    service.invalidate(date);
    first.resolve([]);
    await running;
    expect(service.snapshot(date)).toMatchObject({ planStatus: 'ready', unplanned: [{ workOrderId: 'new' }] });
    expect(planner.plan).toHaveBeenCalledTimes(2);
  });

  it('retains last good output after failure and permits a later retry', async () => {
    let current = input('good');
    const planner = { plan: vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('road unavailable')).mockResolvedValueOnce([]) };
    const service = new DispatchPlanService(async () => current, planner);
    await service.refresh(date);
    current = input('retry');
    await service.refresh(date);
    // Reading failed state schedules a retry, but retains the last accepted plan.
    expect(service.snapshot(date).unplanned[0]?.workOrderId).toBe('good');
    await service.refresh(date);
    expect(service.snapshot(date)).toMatchObject({ planStatus: 'ready', unplanned: [{ workOrderId: 'retry' }] });
  });

  it('keeps date-specific plans separate and returns cloned snapshots', async () => {
    const service = new DispatchPlanService(async (selected) => input(selected), { plan: async () => [] });
    await service.refresh(date);
    await service.refresh('2099-01-02');
    const first = service.snapshot(date);
    first.unplanned.length = 0;
    expect(service.snapshot(date).unplanned[0]?.workOrderId).toBe(date);
    expect(service.snapshot('2099-01-02').unplanned[0]?.workOrderId).toBe('2099-01-02');
  });
});
