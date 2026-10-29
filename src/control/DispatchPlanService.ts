import { createHash } from 'node:crypto';
import { singaporeDate } from '../entity/valueTypes';
import { Vehicle } from '../entity/Vehicle';
import { RouteJob, RouteTeam, PlannedTeamRoute, RouteOptimizationService } from './RouteOptimizationService';
import { WorkOrderStatus } from '../entity/enums';

const SNAPSHOT_TTL_MS = 5 * 60_000;
const RETRY_DELAY_MS = 30_000;
const RANGE_BUDGET_MS = 30_000;
const COMMITTED_REASON = 'Already assigned, accepted or in progress; retain existing assignment and exclude from new allocation.';
const isCommitted = (job: RouteJob): boolean =>
  [WorkOrderStatus.Assigned, WorkOrderStatus.Accepted, WorkOrderStatus.InProgress, WorkOrderStatus.Rejected].includes(job.status as WorkOrderStatus);

export interface DispatchPlanInputs {
  teams: RouteTeam[];
  jobs: DispatchJob[];
  vehicles: Vehicle[];
  referrals?: unknown[];
}

export type DispatchJob = RouteJob & { scheduledDate?: string };
export interface UnplannedTask {
  workOrderId: string; locality?: string; priority?: string; pestType?: string;
  point: { latitude: number; longitude: number }; mapClusterId?: string;
  taskType?: string; requiredStaff?: number; reportIds?: string[]; reportCount?: number;
  sourceReportId?: string; scheduledDate?: string; status?: string;
  isDemo?: boolean;
  disposition: 'unassigned' | 'committed';
  individualCounts?: Array<{ reportId: string; estimatedCount: number | null }>; reason: string;
}

export interface DispatchPlanSnapshot {
  date: string;
  planStatus: 'pending' | 'refreshing' | 'ready' | 'failed';
  computedAt: string | null;
  planningDurationSeconds: number | null;
  error: string | null;
  routes: PlannedTeamRoute[];
  unplanned: UnplannedTask[];
  referrals: unknown[];
}

export interface DispatchRangeSnapshot {
  startDate: string;
  days: number;
  planStatus: DispatchPlanSnapshot['planStatus'];
  computedAt: string | null;
  plans: DispatchPlanSnapshot[];
  unassigned: UnplannedTask[];
  referrals: unknown[];
  error: string | null;
  availabilityAssumption: string;
  busy?: boolean;
  retryAfterSeconds?: number;
}

interface CachedRange {
  value: DispatchRangeSnapshot;
  requested: boolean;
  running: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
  retryAt: number | null;
  expiresAt: number | null;
  fingerprints: Array<string | null>;
}

export const validDispatchDate = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const dateAfter = (date: string, offset: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const identities = (job: Pick<RouteJob, 'workOrderId' | 'reportIds' | 'sourceReportId'>): string[] =>
  [`job:${job.workOrderId}`, ...(job.reportIds ?? []).map((id) => `report:${id}`),
    ...(job.sourceReportId ? [`report:${job.sourceReportId}`] : [])];
const priorityRank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const priorityFirst = (a: { priority?: string }, b: { priority?: string }): number =>
  (priorityRank[a.priority ?? 'Medium'] ?? 2) - (priorityRank[b.priority ?? 'Medium'] ?? 2);
const blankPlan = (date: string): DispatchPlanSnapshot => ({ date, planStatus: 'pending', computedAt: null,
  planningDurationSeconds: null, error: null, routes: [], unplanned: [], referrals: [] });

interface CachedPlan {
  value: DispatchPlanSnapshot;
  fingerprint: string | null;
  requested: boolean;
  running: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
  retryAt: number | null;
  expiresAt: number | null;
}

/** Compute in the background. Page requests only read a snapshot and never wait for road APIs. */
export class DispatchPlanService {
  private readonly entries = new Map<string, CachedPlan>();
  private readonly ranges = new Map<string, CachedRange>();

  constructor(private readonly loadInputs: (date: string, signal?: AbortSignal) => Promise<DispatchPlanInputs>,
    private readonly planner: Pick<RouteOptimizationService, 'plan'>) {}

  snapshot(date: string): DispatchPlanSnapshot {
    const existed = this.entries.has(date);
    const entry = this.entry(date);
    const now = Date.now();
    if (!existed || entry.retryAt !== null && entry.retryAt <= now ||
        entry.value.planStatus === 'ready' && entry.expiresAt !== null && entry.expiresAt <= now) this.invalidate(date);
    return structuredClone(entry.value);
  }

  snapshotRange(startDate: string, days: number): DispatchRangeSnapshot {
    if (!validDispatchDate(startDate) || !Number.isInteger(days) || days < 1 || days > 7) {
      throw new RangeError('Choose a valid calendar date and a horizon of one to seven days.');
    }
    const key = `${startDate}:${days}`;
    let entry = this.ranges.get(key);
    if (!entry) {
      const value: DispatchRangeSnapshot = { startDate, days, planStatus: 'pending', computedAt: null,
        plans: Array.from({ length: days }, (_, offset) => blankPlan(dateAfter(startDate, offset))),
        unassigned: [], referrals: [], error: null,
        availabilityAssumption: 'Future days reuse the current available crew and fleet roster; availability is a planning assumption, not a confirmed booking.' };
      if (this.ranges.size >= 7) {
        const old = [...this.ranges].find(([, item]) => !item.running && !item.timer);
        if (old) this.ranges.delete(old[0]);
        else return { ...value, busy: true, retryAfterSeconds: 1,
          error: 'Planning capacity is busy. This range has not started; the next poll will retry.' };
      }
      entry = { requested: false, running: null, timer: null, retryAt: null, expiresAt: null, fingerprints: [],
        value };
      this.ranges.set(key, entry);
      this.invalidateRange(entry);
    } else if (entry.retryAt !== null && entry.retryAt <= Date.now() ||
      entry.value.planStatus === 'ready' && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.invalidateRange(entry);
    }
    return structuredClone(entry.value);
  }

  private invalidateRange(entry: CachedRange): void {
    entry.retryAt = null;
    entry.requested = true;
    entry.value.planStatus = entry.value.computedAt ? 'refreshing' : 'pending';
    if (entry.running || entry.timer) return;
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.running = this.computeRange(entry).finally(() => { entry.running = null; });
    }, 250);
  }

  invalidateAll(): void {
    const today = singaporeDate(new Date());
    for (const date of new Set([today, ...this.entries.keys()])) this.invalidate(date);
    for (const entry of this.ranges.values()) this.invalidateRange(entry);
  }

  invalidate(date: string): void {
    const entry = this.entry(date);
    entry.retryAt = null;
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
      entry = { fingerprint: null, requested: false, running: null, timer: null, retryAt: null, expiresAt: null, value: {
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

  private async computeRange(entry: CachedRange): Promise<void> {
    while (entry.requested) {
      entry.requested = false;
      const deadline = Date.now() + RANGE_BUDGET_MS;
      const controller = new AbortController();
      const lastGood = entry.value.computedAt !== null && entry.value.plans.every((plan) => plan.computedAt !== null);
      const previousPlans = entry.value.plans;
      const reuseUntil = entry.expiresAt ?? 0;
      const fingerprints: Array<string | null> = [];
      let recomputed = false;
      const plans = entry.value.plans.map((plan) => blankPlan(plan.date));
      const scheduled = new Set<string>();
      const carried = new Map<string, DispatchJob>();
      const pending = new Map<string, UnplannedTask>();
      const pendingOwner = new Map<string, string>();
      const rememberPending = (job: UnplannedTask): void => {
        const keys = identities(job);
        const replaced = new Set(keys.map((key) => pendingOwner.get(key)).filter((id): id is string => id !== undefined));
        for (const id of replaced) {
          const existing = pending.get(id)!;
          for (const key of identities(existing)) if (pendingOwner.get(key) === id) pendingOwner.delete(key);
          pending.delete(id);
        }
        pending.set(job.workOrderId, job);
        for (const key of keys) pendingOwner.set(key, job.workOrderId);
      };
      const checkpoint = async (): Promise<void> => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (controller.signal.aborted || Date.now() >= deadline) throw new Error('Planning horizon time budget exhausted.');
      };
      const referralMap = new Map<string, unknown>();
      let needsRetry = false;
      // One shared deadline, including input I/O, rather than seven full provider wait budgets.
      const bounded = async <T>(work: () => Promise<T>): Promise<T> => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) { controller.abort(); throw new Error('Planning horizon time budget exhausted.'); }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([work(), new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Planning horizon time budget exhausted.')); }, remaining);
          })]);
        } finally { if (timer) clearTimeout(timer); }
      };
      const publish = (): void => {
        if (lastGood) return;
        entry.value.plans = structuredClone(plans);
        entry.value.unassigned = [...pending.values()].filter((job) => job.disposition === 'committed' || !identities(job).some((id) => scheduled.has(id)))
          .sort(priorityFirst);
        entry.value.referrals = [...referralMap.values()];
      };
      try {
        for (let index = 0; index < plans.length; index++) {
          const date = plans[index]!.date;
          let dailyInput: DispatchPlanInputs | null = null;
          let fingerprint: string | null = null;
          const daily = new DispatchPlanService(async () => {
            const loaded = await bounded(() => this.loadInputs(date, controller.signal));
            if (Date.now() >= deadline) throw new Error('Planning horizon time budget exhausted.');
            for (const [itemIndex, job] of loaded.jobs.entries()) {
              carried.set(job.workOrderId, job);
              if (itemIndex % 1000 === 999) await checkpoint();
            }
            const seen = new Set(scheduled);
            const jobs = [...carried.values()].filter((job) => !job.scheduledDate || job.scheduledDate <= date)
              .sort((a, b) => Number(isCommitted(b)) - Number(isCommitted(a)) || priorityFirst(a, b))
              .filter((job) => {
                const keys = identities(job);
                if (keys.some((key) => seen.has(key))) return false;
                keys.forEach((key) => seen.add(key));
                return true;
              });
            for (const referral of loaded.referrals ?? []) {
              const item = referral as { workOrderId?: string; reportId?: string; reportIds?: string[] };
              referralMap.set(item.workOrderId ?? item.reportIds?.slice().sort().join('|') ?? item.reportId ?? JSON.stringify(referral), referral);
            }
            dailyInput = { ...loaded, jobs };
            fingerprint = createHash('sha256').update(JSON.stringify({ ...dailyInput,
              teams: [...dailyInput.teams].sort((a, b) => a.teamId.localeCompare(b.teamId)),
              jobs: [...jobs].sort((a, b) => a.workOrderId.localeCompare(b.workOrderId)),
              vehicles: [...dailyInput.vehicles].sort((a, b) => a.id.localeCompare(b.id)),
            })).digest('hex');
            plans[index]!.referrals = loaded.referrals ?? [];
            plans[index]!.unplanned = jobs.map((job) => this.unplannedTask(job, new Set(), date,
              'Planning is in progress; access and capacity have not yet been verified.'));
            for (const [itemIndex, job] of plans[index]!.unplanned.entries()) {
              rememberPending(job);
              if (itemIndex % 1000 === 999) await checkpoint();
            }
            publish();
            return dailyInput;
          }, { plan: (teams, jobs, vehicles, roadUnverified) => {
            if (fingerprint === entry.fingerprints[index] && reuseUntil > Date.now() && previousPlans[index]?.computedAt) {
              return Promise.resolve(structuredClone(previousPlans[index]!.routes));
            }
            recomputed = true;
            // Leave time to publish the planner's accepted routes before the outer
            // horizon timer fires. Equal deadlines can discard a valid partial day.
            const dailyDeadline = Date.now() + Math.max(0, (deadline - Date.now() - 1000) / (plans.length - index));
            return bounded(() => this.planner.plan(teams, jobs, vehicles, roadUnverified, { deadline: dailyDeadline }));
          } });
          await daily.refresh(date);
          const result = daily.snapshot(date);
          if (result.planStatus === 'failed') {
            // Keep known urgent jobs visible even when a provider times out before returning a route.
            plans[index]!.planStatus = 'failed';
            plans[index]!.error = 'Access verification or planning failed; this day will retry.';
            plans[index]!.unplanned = ((dailyInput as DispatchPlanInputs | null)?.jobs ?? []).map((job) =>
              this.unplannedTask(job, new Set([job.workOrderId]), date));
            for (const job of plans[index]!.unplanned) rememberPending(job);
            throw new Error('A day in the horizon could not be computed.');
          }
          plans[index] = result;
          fingerprints[index] = result.unplanned.some((job) => job.reason.includes('could not be verified')) ? null : fingerprint;
          const byId = new Map(((dailyInput as DispatchPlanInputs | null)?.jobs ?? []).map((job) => [job.workOrderId, job]));
          for (const route of result.routes) for (const id of route.workOrderIds) {
            const job = byId.get(id);
            (job ? identities(job) : [`job:${id}`]).forEach((key) => scheduled.add(key));
          }
          // Committed identities must also stay out of every later new allocation.
          for (const job of byId.values()) if (isCommitted(job)) identities(job).forEach((key) => scheduled.add(key));
          for (const [itemIndex, job] of result.unplanned.entries()) {
            rememberPending(job);
            if (job.reason.includes('could not be verified')) needsRetry = true;
            if (itemIndex % 1000 === 999) await checkpoint();
          }
          publish();
        }
        entry.value = { ...entry.value, plans, planStatus: entry.requested ? 'refreshing' : 'ready',
          computedAt: new Date().toISOString(), error: null,
          unassigned: [...pending.values()].filter((job) => job.disposition === 'committed' ||
            !identities(job).some((id) => scheduled.has(id))).sort(priorityFirst), referrals: [...referralMap.values()] };
        entry.fingerprints = fingerprints;
        if (recomputed) entry.expiresAt = Date.now() + SNAPSHOT_TTL_MS;
        entry.retryAt = needsRetry ? Date.now() + RETRY_DELAY_MS : null;
      } catch {
        controller.abort();
        publish();
        if (!lastGood && plans.some((plan) => plan.computedAt !== null)) {
          // Resume accepted partial days on retry, rather than spend every deadline on day one.
          entry.fingerprints = fingerprints;
          entry.expiresAt = Date.now() + SNAPSHOT_TTL_MS;
        }
        entry.value.planStatus = 'failed';
        entry.value.error = 'The horizon is incomplete. Retained plans remain visible; unverified days will retry.';
        entry.retryAt = Date.now() + RETRY_DELAY_MS;
      }
    }
  }

  private unplannedTask(job: DispatchJob, roadUnverified: Set<string>, date: string, pendingReason?: string): UnplannedTask {
    return { workOrderId: job.workOrderId, point: { latitude: job.point.latitude, longitude: job.point.longitude },
      mapClusterId: job.mapClusterId, locality: job.locality, priority: job.priority,
      pestType: job.pestType, taskType: job.taskType, requiredStaff: job.requiredStaff,
      reportIds: job.reportIds, reportCount: job.reportCount, individualCounts: job.individualCounts,
      sourceReportId: job.sourceReportId, scheduledDate: job.scheduledDate ?? date, status: job.status, isDemo: job.isDemo,
      disposition: isCommitted(job) ? 'committed' : 'unassigned',
      reason: job.status === WorkOrderStatus.Rejected
        ? 'Committed work is excluded from new allocation; retain/review its existing assignment.'
        : isCommitted(job) ? COMMITTED_REASON : pendingReason ?? (roadUnverified.has(job.workOrderId)
          ? 'A complete driving route to this task could not be verified. Road access or the routing service may be unavailable; verification will retry.'
          : 'No qualified crew and available HQ vehicle can fit this task within staff, cargo and four-hour limits.') };
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
        if (fingerprint === entry.fingerprint && entry.expiresAt !== null && entry.expiresAt > Date.now()) {
          entry.value.planStatus = entry.requested ? 'refreshing' : 'ready';
          entry.value.error = null;
          continue;
        }
        entry.value.planStatus = entry.value.computedAt ? 'refreshing' : 'pending';
        const start = Date.now();
        const roadUnverified = new Set<string>();
        const allocatable = input.jobs.filter((job) => !isCommitted(job));
        const routes = await this.planner.plan(input.teams, allocatable, input.vehicles, roadUnverified);
        const plannedIds = new Set(routes.flatMap((route) => route.workOrderIds));
        const rank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const unplanned = input.jobs.filter((job) => !plannedIds.has(job.workOrderId))
          .sort((a, b) => (rank[a.priority ?? 'Medium'] ?? 2) - (rank[b.priority ?? 'Medium'] ?? 2))
          .map((job) => this.unplannedTask(job, roadUnverified, date));
        entry.value = { date, planStatus: entry.requested ? 'refreshing' : 'ready', routes, unplanned,
          referrals: input.referrals ?? [], computedAt: new Date().toISOString(),
          planningDurationSeconds: (Date.now() - start) / 1000, error: null };
        const needsRoadRetry = unplanned.some((job) => roadUnverified.has(job.workOrderId));
        // Unverified roads are not a permanent capacity result. Retry unchanged inputs on later reads.
        entry.fingerprint = needsRoadRetry ? null : fingerprint;
        entry.retryAt = needsRoadRetry ? Date.now() + RETRY_DELAY_MS : null;
        entry.expiresAt = Date.now() + SNAPSHOT_TTL_MS;
      } catch {
        entry.value.planStatus = 'failed';
        entry.value.error = 'The latest plan could not be computed. The next refresh will retry.';
        entry.retryAt = Date.now() + RETRY_DELAY_MS;
      }
    }
  }
}
