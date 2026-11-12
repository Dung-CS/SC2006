import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DispatchPlanInputs, DispatchPlanService } from '../src/control/DispatchPlanService';
import { PriorityScoreRepository } from '../src/persistence/PriorityScoreRepository';
import { Database, Row } from '../src/persistence/Database';

// Supabase egress overran 5.5 GB three times (September and November 2026). Each test pins a read
// path that ran on a timer and pulled the same rows from Postgres again and again.

const date = '2099-01-01';
const input = (): DispatchPlanInputs => ({ teams: [], vehicles: [], jobs: [] });
const planner = { plan: vi.fn(async () => []) };

describe('Egress guard: dispatch plans nobody is viewing', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('does not reload inputs for an idle range on invalidateAll, and recomputes it on the next read', async () => {
    const load = vi.fn(async (_day: string) => input());
    const service = new DispatchPlanService(load, planner);
    service.snapshotRange(date, 7);
    await vi.advanceTimersByTimeAsync(250);
    expect(load).toHaveBeenCalledTimes(7);

    await vi.advanceTimersByTimeAsync(11 * 60_000);
    load.mockClear();
    for (let i = 0; i < 20; i++) { service.invalidateAll(); await vi.advanceTimersByTimeAsync(30_000); }
    // Only today's plan (not 2099-01-01) is kept warm; the idle seven-day range reads nothing.
    expect(load.mock.calls.filter(([day]) => String(day).startsWith('2099'))).toHaveLength(0);

    expect(service.snapshotRange(date, 7).planStatus).toBe('refreshing');
    await vi.advanceTimersByTimeAsync(250);
    expect(load.mock.calls.filter(([day]) => String(day).startsWith('2099'))).toHaveLength(7);
  });

  it('still recomputes a range that was read within the last ten minutes', async () => {
    const load = vi.fn(async (_day: string) => input());
    const service = new DispatchPlanService(load, planner);
    service.snapshotRange(date, 2);
    await vi.advanceTimersByTimeAsync(250);
    load.mockClear();
    service.invalidateAll();
    await vi.advanceTimersByTimeAsync(250);
    expect(load.mock.calls.filter(([day]) => String(day).startsWith('2099'))).toHaveLength(2);
  });
});

describe('Egress guard: latest priority scores', () => {
  const stamp = new Date('2099-01-01T00:00:00Z');
  const fakeDb = (): { db: Database; sql: string[]; setStamp: (d: Date) => void } => {
    let at = stamp;
    const sql: string[] = [];
    const db = {
      query: async (text: string): Promise<Row[]> => {
        sql.push(text);
        if (text.includes('max(computed_at)')) return [{ at }];
        if (text.includes('FROM priority_score')) {
          return [{ id: 's1', cluster_id: 'c1', pest_type: 'Mosquito', computed_at: at, score: 0.5, tier: 'High',
            is_degraded: false, excluded_drivers: [], rank: 1 }];
        }
        return [{ priority_score_id: 's1', driver: 'CaseSize', raw_value: 1, normalised_value: 1, weight: 0.3, contribution: 0.3 }];
      },
    } as unknown as Database;
    return { db, sql, setStamp: (d) => { at = d; } };
  };

  it('reads scores and contributions once per scoring cycle, not once per call', async () => {
    const { db, sql, setStamp } = fakeDb();
    const repo = new PriorityScoreRepository(db);
    const first = await repo.latest();
    for (let i = 0; i < 50; i++) await repo.latest();
    expect(sql.filter((q) => q.includes('driver_contribution'))).toHaveLength(1);
    expect(sql.filter((q) => q.includes('SELECT *'))).toHaveLength(2);

    // Callers get fresh objects; mutating one must not leak into the next call.
    first[0]!.excludedDrivers.push('CaseSize' as never);
    expect((await repo.latest())[0]!.excludedDrivers).toEqual([]);

    setStamp(new Date('2099-01-01T00:20:00Z'));
    await repo.latest();
    expect(sql.filter((q) => q.includes('driver_contribution'))).toHaveLength(2);
  });
});
