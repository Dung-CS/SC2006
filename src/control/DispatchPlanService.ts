import { createHash } from 'node:crypto';
import { singaporeDate } from '../entity/valueTypes';
import { Vehicle } from '../entity/Vehicle';
import { RouteJob, RouteTeam, PlannedTeamRoute, RouteOptimizationService } from './RouteOptimizationService';

export interface DispatchPlanInputs {
  teams: RouteTeam[];
  jobs: RouteJob[];
  vehicles: Vehicle[];
  referrals?: unknown[];
}

export interface DispatchPlanSnapshot {
  date: string;
  planStatus: 'pending' | 'refreshing' | 'ready' | 'failed';
  computedAt: string | null;
  planningDurationSeconds: number | null;
  error: string | null;
  routes: PlannedTeamRoute[];
  unplanned: Array<{ workOrderId: string; locality?: string; priority?: string; pestType?: string;
    taskType?: string; requiredStaff?: number; reason: string }>;
  referrals: unknown[];
}

interface CachedPlan {
  value: DispatchPlanSnapshot;
  fingerprint: string | null;
  requested: boolean;
  running: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Compute in the background. Page requests only read a snapshot and never wait for road APIs. */
export class DispatchPlanService {
  private readonly entries = new Map<string, CachedPlan>();

  constructor(private readonly loadInputs: (date: string) => Promise<DispatchPlanInputs>,
    private readonly planner: Pick<RouteOptimizationService, 'plan'>) {}

  snapshot(date: string): DispatchPlanSnapshot {
    const existed = this.entries.has(date);
    const entry = this.entry(date);
    if (!existed || entry.value.planStatus === 'failed') this.invalidate(date);
    return structuredClone(entry.value);
  }

  invalidateAll(): void {
    const today = singaporeDate(new Date());
    for (const date of new Set([today, ...this.entries.keys()])) this.invalidate(date);
  }

  invalidate(date: string): void {
    const entry = this.entry(date);
    entry.requested = true;
    entry.value.planStatus = entry.value.computedAt ? 'refreshing' : 'pending';
    if (entry.running || entry.timer) return;
    // Combine bursts of cluster/report/staff writes into one refresh.
    entry.timer = setTimeout(() => {
      entry.timer = null;
      this.run(date, entry);
    }, 250);
  }

  /** Also useful for startup and verification without tying a public GET to computation. */
  async refresh(date: string): Promise<void> {
    const entry = this.entry(date);
    entry.requested = true;
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
    if (!entry.running) this.run(date, entry);
    await entry.running;
  }

  private entry(date: string): CachedPlan {
    let entry = this.entries.get(date);
    if (!entry) {
      // Keep a small selection of dates, including today. Running work is never discarded.
      if (this.entries.size >= 7) {
        const old = [...this.entries].find(([key, item]) => key !== singaporeDate(new Date()) && !item.running && !item.timer);
        if (old) this.entries.delete(old[0]);
      }
      entry = { fingerprint: null, requested: false, running: null, timer: null, value: {
        date, planStatus: 'pending', computedAt: null, planningDurationSeconds: null, error: null,
        routes: [], unplanned: [], referrals: [],
      } };
      this.entries.set(date, entry);
    }
    return entry;
  }

  private run(date: string, entry: CachedPlan): void {
    entry.running = this.compute(date, entry).finally(() => { entry.running = null; });
  }

  private async compute(date: string, entry: CachedPlan): Promise<void> {
    while (entry.requested) {
      entry.requested = false;
      try {
        const input = await this.loadInputs(date);
        const normalized = { ...input,
          teams: [...input.teams].sort((a, b) => a.teamId.localeCompare(b.teamId)),
          jobs: [...input.jobs].sort((a, b) => a.workOrderId.localeCompare(b.workOrderId)),
          vehicles: [...input.vehicles].sort((a, b) => a.id.localeCompare(b.id)),
        };
        const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
        if (fingerprint === entry.fingerprint) {
          entry.value.planStatus = entry.requested ? 'refreshing' : 'ready';
          entry.value.error = null;
          continue;
        }
        entry.value.planStatus = entry.value.computedAt ? 'refreshing' : 'pending';
        const start = Date.now();
        const routes = await this.planner.plan(input.teams, input.jobs, input.vehicles);
        const plannedIds = new Set(routes.flatMap((route) => route.workOrderIds));
        const rank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const unplanned = input.jobs.filter((job) => !plannedIds.has(job.workOrderId))
          .sort((a, b) => (rank[a.priority ?? 'Medium'] ?? 2) - (rank[b.priority ?? 'Medium'] ?? 2))
          .map((job) => ({ workOrderId: job.workOrderId, locality: job.locality, priority: job.priority,
            pestType: job.pestType, taskType: job.taskType, requiredStaff: job.requiredStaff,
            reason: 'No qualified crew and available HQ vehicle can fit this task within staff, cargo and four-hour limits.' }));
        entry.value = { date, planStatus: entry.requested ? 'refreshing' : 'ready', routes, unplanned,
          referrals: input.referrals ?? [], computedAt: new Date().toISOString(),
          planningDurationSeconds: (Date.now() - start) / 1000, error: null };
        entry.fingerprint = fingerprint;
      } catch {
        entry.value.planStatus = 'failed';
        entry.value.error = 'The latest plan could not be computed. The next refresh will retry.';
      }
    }
  }
}
