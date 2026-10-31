import { GeoPoint } from '../entity/valueTypes';
import type { TaskScoreExplanation } from '../presentation/TaskScoreExplanation';
import { StaffStatus, PriorityTier, TaskType, PestType } from '../entity/enums';
import { IRouteStrategy, RoutePlan, isVerifiedAccessRoute, ServiceArea, serviceAreaRings } from './routing/IRouteStrategy';
import type { Vehicle } from '../entity/Vehicle';
import type { ChecklistItem } from '../ports/DispatchAssignmentStore';
import { generatePackingList, logisticsLoad, itemFitsCargo, LOGISTICS_LOAD_BASIS, PackingItem } from './LogisticsPolicy';
export { generatePackingList } from './LogisticsPolicy';
export type { PackingItem } from './LogisticsPolicy';

export interface RouteTeam {
  staffMembers?: Array<{ id: string; email: string; displayName?: string | null }>;
  teamId: string;
  hq: GeoPoint;
  capabilities: string[];
  status?: StaffStatus | string;
  onCallLagHours?: number;
  maxStops?: number;
  /** Number of distinct staff in this depot/capability/status pool. Unknown means one. */
  staffCount?: number;
}

export interface RouteJob {
  serviceArea?: ServiceArea;
  isDemo?: boolean;
  workOrderId: string;
  reportIds?: string[];
  reportCount?: number;
  individualCounts?: Array<{ reportId: string; estimatedCount: number | null }>;
  clusterId?: string | null;
  sourceReportId?: string;
  mapClusterId?: string;
  scoreExplanation?: TaskScoreExplanation;
  point: GeoPoint;
  requiredCapability: string;
  allowedCapabilities?: string[];
  requiredStaff?: number;
  taskType?: TaskType | string;
  pestType?: PestType | string;
  priority?: PriorityTier | string; // 'Critical' | 'High' | 'Medium' | 'Low'
  score?: number;
  locality?: string;
  status?: string; // 'Created' | 'Assigned' | 'InProgress' | 'Completed' | 'Verified' | 'Closed'
  estimatedEffortMinutes?: number;
  requiresBaseReturn?: boolean;
}

export interface PlannedWaypoint {
  isAreaAccess?: boolean;
  targetPoint?: GeoPoint;
  isDemo?: boolean;
  label: string;
  point: GeoPoint;
  workOrderId?: string;
  reportIds?: string[];
  reportCount?: number;
  individualCounts?: Array<{ reportId: string; estimatedCount: number | null }>;
  clusterId?: string | null;
  sourceReportId?: string;
  mapClusterId?: string;
  scoreExplanation?: TaskScoreExplanation;
  taskType?: string;
  pestType?: string;
  priority?: string;
  requiredStaff?: number;
  status: 'Completed' | 'InProgress' | 'Pending';
  isCompleted: boolean;
  estimatedEffortMinutes: number;
  requiresBaseReturn: boolean;
  isBaseReturn: boolean;
  isHq: boolean;
  cumulativeDurationSeconds: number;
}

export interface PlannedTeamRoute {
  crewMembers?: Array<{ id: string; email: string; displayName?: string | null }>;
  vehicleModel?: string;
  vehiclePhotoUrl?: string;
  teamId: string;
  staffCount: number;
  depotLocation: string;
  status: string;
  onCallLagHours: number;
  workOrderIds: string[];
  waypointOrder: PlannedWaypoint[];
  route: RoutePlan;
  totalDurationSeconds: number;
  totalTravelSeconds: number;
  totalEffortSeconds: number;
  capacityUsedPercentage: number;
  isWithinFourHourCap: boolean;
  completedCount: number;
  totalStopsCount: number;
  progressPercentage: number;
  packingList: PackingItem[];
  color: string;
  vehicleId?: string;
  vehicleRegistration?: string;
  vehicleName?: string;
  isDemoVehicle?: boolean;
  maxPayloadKg?: number;
  maxCargoVolumeM3?: number;
  loadWeightKg: number;
  loadVolumeM3: number;
  loadWeightPercentage?: number;
  loadVolumePercentage?: number;
  loadBasis: string;
  isFixed?: boolean;
  assignmentId?: string;
  checklist?: ChecklistItem[];
}

// Maximum shift duration: strictly capped at 4 hours (14,400 seconds)
const MAX_DISPATCH_SECONDS = 4 * 3600;

/** Provisional planning defaults, not an operational staffing standard. */
export function estimateRequiredStaff(taskType?: string, pestType?: string): number {
  if (pestType === PestType.WildBoar || pestType === PestType.Crocodile) return 4;
  if (pestType === PestType.Snake || pestType === PestType.MonitorLizard) return 2;
  if (taskType === TaskType.Fogging) return 3;
  if (taskType === TaskType.Larviciding || taskType === TaskType.DrainClearance || taskType === TaskType.RefuseClearance) return 2;
  return 1;
}

// High contrast team route colors
const TEAM_COLORS = [
  '#2563EB', // Blue (Central)
  '#16A34A', // Green (NorthEast)
  '#9333EA', // Purple (NorthWest)
  '#D97706', // Amber (SouthEast)
  '#DC2626', // Red (SouthWest)
  '#0D9488', // Teal
  '#4F46E5', // Indigo
  '#C026D3', // Magenta
];

/** Standard effort durations (in minutes) by task type or pest target. */
export function estimateEffortMinutes(taskType?: string, pestType?: string): number {
  if (pestType === PestType.WildBoar || pestType === 'WildBoar') return 75;
  if (pestType === PestType.Snake || pestType === 'Snake') return 60;
  if (pestType === PestType.Crocodile || pestType === 'Crocodile') return 60;
  if (pestType === PestType.MonitorLizard || pestType === 'MonitorLizard') return 55;
  if (taskType === TaskType.Fogging || taskType === 'Fogging') return 45;
  if (taskType === TaskType.Larviciding || taskType === 'Larviciding') return 40;
  if (taskType === TaskType.DrainClearance || taskType === 'DrainClearance') return 50;
  if (taskType === TaskType.RefuseClearance || taskType === 'RefuseClearance') return 40;
  if (taskType === TaskType.Inspection || taskType === 'Inspection') return 30;
  return 35;
}

/** Automatic task-based returns are replaced by vehicle load limits. Explicit instructions remain supported. */
export function checkRequiresBaseReturn(_taskType?: string, _pestType?: string): boolean {
  return false;
}

/** Priority weight: Critical = 4, High = 3, Medium = 2, Low = 1. */
function getPriorityWeight(priority?: string): number {
  switch (priority) {
    case PriorityTier.Critical:
    case 'Critical':
      return 4;
    case PriorityTier.High:
    case 'High':
      return 3;
    case PriorityTier.Medium:
    case 'Medium':
      return 2;
    case PriorityTier.Low:
    case 'Low':
    default:
      return 1;
  }
}

/** Estimate travel time in seconds between two points at ~35 km/h urban speed. */
function estimateTransitSeconds(from: GeoPoint, to: GeoPoint): number {
  const dist = from.distanceTo(to);
  if (dist < 10) return 0;
  // 35 km/h ≈ 9.72 m/s; minimum 180s (3 minutes) for any separate road leg
  return Math.max(180, Math.round(dist / 9.72));
}

/** Greedy priority-first dispatch under crew, vehicle, load and elapsed-time limits. */
interface CrewAssignment {
  pool: RouteTeam;
  teamId: string;
  staffCount: number;
  jobs: RouteJob[];
  plan: RoutePlan;
  vehicle?: Vehicle;
}

export class RouteOptimizationService {
  constructor(private readonly strategy: IRouteStrategy, private readonly roadWaitBudgetMs = 30_000,
    private readonly perCandidateWaitMs = 5_000) {}

  async plan(teams: RouteTeam[], jobs: RouteJob[], vehicles?: Vehicle[], roadUnverified = new Set<string>(), options: { deadline?: number } = {}): Promise<PlannedTeamRoute[]> {
    const roadDeadline = Math.min(Date.now() + this.roadWaitBudgetMs, options.deadline ?? Infinity);
    const cpuDeadline = roadDeadline;
    let providerCalls = 0;
    // Route-evaluation budget (not OneMap request count); OneMap separately caps concurrent leg requests.
    const maxProviderCalls = Math.max(160, jobs.length * 6 + 200);
    let searchSteps = 0;
    const maxSearchSteps = 100_000;
    const poolIds = new Set<string>();
    const pools = teams.filter((team) => {
      if (poolIds.has(team.teamId)) return false;
      poolIds.add(team.teamId);
      return (
      (team.status === undefined || team.status === StaffStatus.Available || team.status === StaffStatus.OnCall) &&
      Number.isInteger(team.staffCount ?? 1) && (team.staffCount ?? 1) > 0 &&
      (team.maxStops === undefined || Number.isInteger(team.maxStops) && team.maxStops > 0) &&
      (team.onCallLagHours === undefined || Number.isFinite(team.onCallLagHours) && team.onCallLagHours >= 0)
      );
    });
    const fleetIds = new Set<string>();
    const fleet = (vehicles ?? []).filter((vehicle) => {
      if (fleetIds.has(vehicle.id)) return false;
      fleetIds.add(vehicle.id);
      return vehicle.isAvailable && [vehicle.maxPayloadKg, vehicle.maxCargoVolumeM3, vehicle.cargoLengthCm,
        vehicle.cargoWidthCm, vehicle.cargoHeightCm].every((value) => Number.isFinite(value) && value > 0) &&
        Number.isInteger(vehicle.seatCapacity) && vehicle.seatCapacity > 0;
    });
    const assignments: CrewAssignment[] = [];
    const reserved = new Map<RouteTeam, number>();
    const cache = new Map<string, RoutePlan | null>();
    const roadVerified = new Set<string>();
    const committed = (job: RouteJob): boolean => ['assigned', 'accepted', 'inprogress', 'rejected']
      .includes(String(job.status ?? '').replace(/[\s_-]+/g, '').toLowerCase());
    for (const job of jobs) if (committed(job)) roadUnverified.delete(job.workOrderId);
    const jobIds = new Set<string>();
    const pending = jobs.filter((job) => {
      if (jobIds.has(job.workOrderId)) return false;
      jobIds.add(job.workOrderId);
      return true;
    }).map((job) => ({
      ...job,
      requiredStaff: job.requiredStaff ?? estimateRequiredStaff(job.taskType, job.pestType),
      estimatedEffortMinutes: job.estimatedEffortMinutes ?? estimateEffortMinutes(job.taskType, job.pestType),
      requiresBaseReturn: job.requiresBaseReturn ?? checkRequiresBaseReturn(job.taskType, job.pestType),
      priority: job.priority ?? ((job.requiresBaseReturn ?? checkRequiresBaseReturn(job.taskType, job.pestType)) ? PriorityTier.Critical : PriorityTier.Medium),
    })).filter((job) => Number.isInteger(job.requiredStaff) && job.requiredStaff > 0 &&
      Number.isFinite(job.estimatedEffortMinutes) && job.estimatedEffortMinutes >= 0 &&
      !committed(job));
    const capable = (team: RouteTeam, job: RouteJob): boolean =>
      (job.allowedCapabilities ?? [job.requiredCapability]).some((cap) => team.capabilities.includes(cap));
    // Within a tier, preserve scarce capabilities and use shorter jobs to clear more work.
    pending.sort((a, b) => getPriorityWeight(b.priority) - getPriorityWeight(a.priority) ||
      pools.filter((t) => capable(t, a)).length - pools.filter((t) => capable(t, b)).length ||
      a.estimatedEffortMinutes * a.requiredStaff - b.estimatedEffortMinutes * b.requiredStaff ||
      (b.score ?? 0) - (a.score ?? 0));

    // ponytail: greedy insertion is not a global VRP optimum; use a solver if exact throughput is required.
    while (pending.length > 0) {
      let allocated = false;
      // Restart at the highest pending tier after every allocation: a shorter route can unlock work.
      for (let index = 0; index < pending.length; index++) {
        if (searchSteps++ >= maxSearchSteps) break;
        const job = pending[index]!;
        const candidates: Array<{ pool: RouteTeam; existing?: CrewAssignment; jobs: RouteJob[]; size: number; addedHeads: number; cost: number; vehicle?: Vehicle }> = [];
        let evaluated = 0;
        for (const pool of pools) {
          if (candidates.length >= 5_000 || Date.now() >= cpuDeadline || searchSteps >= maxSearchSteps) break;
          searchSteps++;
          if (!capable(pool, job)) continue;
          const free = (pool.staffCount ?? 1) - (reserved.get(pool) ?? 0);
          const options = [...assignments.filter((a) => a.pool === pool), undefined];
          for (const existing of options) {
            if (candidates.length >= 5_000 || Date.now() >= cpuDeadline || searchSteps >= maxSearchSteps) break;
            searchSteps++;
            const size = Math.max(existing?.staffCount ?? 0, job.requiredStaff);
            const addedHeads = size - (existing?.staffCount ?? 0);
            if (addedHeads > free) continue;
            const current = existing?.jobs ?? [];
            if (current.length >= (pool.maxStops ?? Infinity)) continue;
            const weight = getPriorityWeight(job.priority);
            for (let pos = 0; pos <= current.length && candidates.length < 5_000 && Date.now() < cpuDeadline && searchSteps < maxSearchSteps; pos++) {
              searchSteps++;
              // Priority is a hard constraint, never a weighted travel penalty.
              if (pos > 0 && getPriorityWeight(current[pos - 1]!.priority) < weight) continue;
              if (pos < current.length && getPriorityWeight(current[pos]!.priority) > weight) continue;
              const routeJobs = [...current.slice(0, pos), job, ...current.slice(pos)];
              if (this.effort(routeJobs) + this.lag(pool) > MAX_DISPATCH_SECONDS) continue;
              const packing = generatePackingList(routeJobs, size);
              const load = logisticsLoad(packing);
              const reservedVehicleIds = new Set(assignments.filter((assignment) => assignment !== existing).map((assignment) => assignment.vehicle?.id));
              const matchingVehicles = fleet.filter((vehicle) => !reservedVehicleIds.has(vehicle.id) &&
                vehicle.hqLocation === pool.teamId.split('-')[0] && vehicle.seatCapacity >= size &&
                load.weightKg <= vehicle.maxPayloadKg && load.volumeM3 <= vehicle.maxCargoVolumeM3 &&
                packing.every((item) => itemFitsCargo(item, vehicle)));
              matchingVehicles.sort((a, b) => Number(b.id === existing?.vehicle?.id) - Number(a.id === existing?.vehicle?.id) ||
                a.maxPayloadKg - b.maxPayloadKg || a.maxCargoVolumeM3 - b.maxCargoVolumeM3);
              const vehicle = matchingVehicles[0];
              // Only an omitted argument permits legacy non-vehicle unit-test planning.
              if (vehicles !== undefined && !vehicle) continue;
              const stops = this.stops(pool.hq, routeJobs);
              const travel = stops.slice(1).reduce((sum, point, i) => sum + estimateTransitSeconds(stops[i]!, point), 0);
              const oldStops = existing ? this.stops(pool.hq, existing.jobs) : [];
              const oldEstimate = oldStops.slice(1).reduce((sum, point, i) => sum + estimateTransitSeconds(oldStops[i]!, point), 0);
              // This is a geometric estimate for ranking only. Road feasibility is checked below.
              // Geometry only orders a bounded shortlist. Service effort, lag and road travel
              // are checked separately; staffing and capability count are not road costs.
              candidates.push({ pool, existing, jobs: routeJobs, size, addedHeads, vehicle, cost: travel - oldEstimate });
            }
          }
        }
        candidates.sort((a, b) => a.cost - b.cost);
        let selected: { candidate: typeof candidates[number]; plan: RoutePlan; delta: number } | undefined;
        let anyVerified = false;
        for (const candidate of candidates) {
          if (evaluated >= 6 || Date.now() >= cpuDeadline || providerCalls >= maxProviderCalls || searchSteps >= maxSearchSteps) break;
          evaluated++;
          const calculate = async (routeJobs: RouteJob[]): Promise<RoutePlan | null> => {
            const stops = this.stops(candidate.pool.hq, routeJobs);
            const serviceAreas = this.serviceAreas(routeJobs);
            const depotStopIndices = this.depotStopIndices(routeJobs);
            const key = JSON.stringify([stops, serviceAreas.map((area) => area ? serviceAreaRings(area) : null), depotStopIndices]);
            if (cache.has(key)) return cache.get(key)!;
            let route: RoutePlan | null = null;
            const remaining = roadDeadline - Date.now();
            if (remaining > 0 && Date.now() < cpuDeadline && providerCalls < maxProviderCalls) {
              let timer: ReturnType<typeof setTimeout> | undefined;
              const controller = new AbortController();
              try {
                providerCalls++;
                route = await Promise.race([
                  this.strategy.calculateRoute(stops, controller.signal, serviceAreas, depotStopIndices),
                  new Promise<never>((_resolve, reject) => {
                    const optionalWait = selected !== undefined
                      ? remaining / Math.max(1, pending.length) / Math.max(1, 6 - evaluated)
                      : this.perCandidateWaitMs;
                    timer = setTimeout(() => { controller.abort(); reject(new Error('Road verification wait budget exhausted')); },
                      Math.min(remaining, this.perCandidateWaitMs, optionalWait));
                  }),
                ]);
                if (!this.verifiedRoute(route, stops, serviceAreas, depotStopIndices)) route = null;
              } catch { route = null; }
              finally { if (timer) clearTimeout(timer); }
            }
            cache.set(key, route);
            return route;
          };
          const plan = await calculate(candidate.jobs);
          if (!plan) continue;
          anyVerified = true;
          const duration = plan.durationSeconds + this.effort(candidate.jobs) + this.lag(candidate.pool);
          if (!Number.isFinite(plan.durationSeconds) || plan.durationSeconds < 0 || duration > MAX_DISPATCH_SECONDS) continue;
          const delta = plan.durationSeconds - (candidate.existing?.plan.durationSeconds ?? 0);
          if (!selected || delta < selected.delta) selected = { candidate, plan, delta };
        }
        if (selected) {
          const candidate = selected.candidate;
          roadVerified.add(job.workOrderId);
          roadUnverified.delete(job.workOrderId);
          reserved.set(candidate.pool, (reserved.get(candidate.pool) ?? 0) + candidate.addedHeads);
          if (candidate.existing) {
            Object.assign(candidate.existing, { jobs: candidate.jobs, staffCount: candidate.size, plan: selected.plan, vehicle: candidate.vehicle });
          } else {
            const count = assignments.filter((a) => a.pool === candidate.pool).length;
            assignments.push({ pool: candidate.pool, teamId: count === 0 ? candidate.pool.teamId : `${candidate.pool.teamId}-crew${count + 1}`,
              jobs: candidate.jobs, staffCount: candidate.size, plan: selected.plan, vehicle: candidate.vehicle });
          }
          pending.splice(index, 1);
          allocated = true;
          break;
        }
        if (candidates.length > 0 && !anyVerified && !roadVerified.has(job.workOrderId)) roadUnverified.add(job.workOrderId);
        if (!allocated && candidates.length > evaluated) roadUnverified.add(job.workOrderId);
        if (allocated) break;
      }
      if (!allocated) break;
    }
    if (pending.length && (Date.now() >= roadDeadline || searchSteps >= maxSearchSteps || providerCalls >= maxProviderCalls)) {
      for (const job of pending) if (pools.some((pool) => capable(pool, job))) roadUnverified.add(job.workOrderId);
    }
    await this.improveAcrossRoutes(assignments, vehicles !== undefined, roadDeadline, cpuDeadline,
      () => {
        if (providerCalls >= maxProviderCalls) return false;
        providerCalls++; return true;
      });
    const memberOffsets = new Map<RouteTeam, number>();
    return assignments.map((assignment, i) => {
      const offset = memberOffsets.get(assignment.pool) ?? 0;
      const members = assignment.pool.staffMembers?.slice(offset, offset + assignment.staffCount);
      memberOffsets.set(assignment.pool, offset + assignment.staffCount);
      return { ...this.buildRoute(assignment, i),
        ...(members?.length === assignment.staffCount ? { crewMembers: members } : {}) };
    });
  }

  /** ponytail: one bounded relocate/swap pass; increase the candidate cap only with measured budget headroom. */
  private async improveAcrossRoutes(assignments: CrewAssignment[], enforceVehicles: boolean, roadDeadline: number,
    cpuDeadline: number, takeProviderSlot: () => boolean): Promise<void> {
    // ponytail: a finite local-search ceiling; raise it only when synthetic runs show budget headroom.
    let withinRouteChecks = 0;
    let crossRouteChecks = 0;
    const maxWithinRouteChecks = 64;
    const maxCrossRouteChecks = 136;
    const verify = async (assignment: CrewAssignment, jobs: RouteJob[]): Promise<RoutePlan | null> => {
      const stops = this.stops(assignment.pool.hq, jobs);
      const serviceAreas = this.serviceAreas(jobs);
      if (Date.now() >= roadDeadline || Date.now() >= cpuDeadline || !takeProviderSlot()) return null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const controller = new AbortController();
      try {
        const route = await Promise.race([this.strategy.calculateRoute(stops, controller.signal, serviceAreas, this.depotStopIndices(jobs)), new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Road verification wait budget exhausted')); },
            Math.min(this.perCandidateWaitMs, roadDeadline - Date.now()));
        })]);
        return this.verifiedRoute(route, stops, serviceAreas, this.depotStopIndices(jobs)) ? route : null;
      } catch { return null; } finally { if (timer) clearTimeout(timer); }
    };
    const feasible = (a: CrewAssignment, jobs: RouteJob[]): boolean => {
      if (!jobs.length || jobs.length > (a.pool.maxStops ?? Infinity) || this.effort(jobs) + this.lag(a.pool) > MAX_DISPATCH_SECONDS) return false;
      if (jobs.some((job) => (job.requiredStaff ?? 1) > a.staffCount)) return false;
      if (jobs.some((job) => !(job.allowedCapabilities ?? [job.requiredCapability]).some((cap) => a.pool.capabilities.includes(cap)))) return false;
      if (jobs.some((job, i) => i > 0 && getPriorityWeight(jobs[i - 1]!.priority) < getPriorityWeight(job.priority))) return false;
      const packing = generatePackingList(jobs, a.staffCount);
      const load = logisticsLoad(packing);
      return !enforceVehicles || (!!a.vehicle && a.vehicle.seatCapacity >= a.staffCount && load.weightKg <= a.vehicle.maxPayloadKg &&
        load.volumeM3 <= a.vehicle.maxCargoVolumeM3 && packing.every((item) => itemFitsCargo(item, a.vehicle!)));
    };
    // Test directed-road reversals directly; geometry must not reject an asymmetric road win.
    for (const assignment of assignments) {
      for (let start = 0; start < assignment.jobs.length - 1 && withinRouteChecks < maxWithinRouteChecks &&
        Date.now() < cpuDeadline && Date.now() < roadDeadline; start++) for (let end = start + 1; end < assignment.jobs.length; end++) {
        if (withinRouteChecks++ >= maxWithinRouteChecks || Date.now() >= cpuDeadline || Date.now() >= roadDeadline) break;
        if (assignment.jobs.slice(start, end + 1).some((job) => getPriorityWeight(job.priority) !== getPriorityWeight(assignment.jobs[start]!.priority))) break;
        const jobs = [...assignment.jobs.slice(0, start), ...assignment.jobs.slice(start, end + 1).reverse(), ...assignment.jobs.slice(end + 1)];
        const plan = await verify(assignment, jobs);
        if (plan && feasible(assignment, jobs) && plan.durationSeconds + this.effort(jobs) + this.lag(assignment.pool) <= MAX_DISPATCH_SECONDS &&
          plan.durationSeconds + 1e-6 < assignment.plan.durationSeconds) {
          assignment.jobs = jobs; assignment.plan = plan;
          break;
        }
      }
    }
    for (let left = 0; left < assignments.length; left++) for (let right = left + 1; right < assignments.length; right++) {
      const a = assignments[left]!, b = assignments[right]!;
      for (let ai = 0; ai < a.jobs.length; ai++) for (let bi = 0; bi < b.jobs.length; bi++) {
        if (crossRouteChecks++ >= maxCrossRouteChecks || Date.now() >= cpuDeadline || Date.now() >= roadDeadline) return;
        const aj = a.jobs[ai]!, bj = b.jobs[bi]!;
        if (getPriorityWeight(aj.priority) !== getPriorityWeight(bj.priority)) continue;
        const aJobs = [...a.jobs]; aJobs[ai] = bj;
        const bJobs = [...b.jobs]; bJobs[bi] = aj;
        if (!feasible(a, aJobs) || !feasible(b, bJobs)) continue;
        const [aPlan, bPlan] = await Promise.all([verify(a, aJobs), verify(b, bJobs)]);
        if (aPlan && bPlan && aPlan.durationSeconds + this.effort(aJobs) + this.lag(a.pool) <= MAX_DISPATCH_SECONDS &&
          bPlan.durationSeconds + this.effort(bJobs) + this.lag(b.pool) <= MAX_DISPATCH_SECONDS &&
          aPlan.durationSeconds + bPlan.durationSeconds + 1e-6 < a.plan.durationSeconds + b.plan.durationSeconds) {
          a.jobs = aJobs; a.plan = aPlan; b.jobs = bJobs; b.plan = bPlan;
          return;
        }
      }
      // Relocate in either direction; routes stay non-empty, so shared reservations remain unchanged.
      for (const [source, target] of [[a, b], [b, a]] as const) {
        for (let sourceIndex = 0; sourceIndex < source.jobs.length; sourceIndex++) {
          if (crossRouteChecks++ >= maxCrossRouteChecks || Date.now() >= cpuDeadline || Date.now() >= roadDeadline) return;
          const job = source.jobs[sourceIndex]!;
          if (target.staffCount < (job.requiredStaff ?? 1) || !target.pool.capabilities.some((cap) => (job.allowedCapabilities ?? [job.requiredCapability]).includes(cap))) continue;
          const sourceJobs = source.jobs.filter((_, i) => i !== sourceIndex);
          if (!sourceJobs.length || !feasible(source, sourceJobs)) continue;
          for (let pos = 0; pos <= target.jobs.length; pos++) {
            if (crossRouteChecks++ >= maxCrossRouteChecks) return;
            const targetJobs = [...target.jobs.slice(0, pos), job, ...target.jobs.slice(pos)];
            if (!feasible(target, targetJobs)) continue;
            const [sourcePlan, targetPlan] = await Promise.all([verify(source, sourceJobs), verify(target, targetJobs)]);
            if (sourcePlan && targetPlan && sourcePlan.durationSeconds + this.effort(sourceJobs) + this.lag(source.pool) <= MAX_DISPATCH_SECONDS &&
              targetPlan.durationSeconds + this.effort(targetJobs) + this.lag(target.pool) <= MAX_DISPATCH_SECONDS &&
              sourcePlan.durationSeconds + targetPlan.durationSeconds + 1e-6 < source.plan.durationSeconds + target.plan.durationSeconds) {
              source.jobs = sourceJobs; source.plan = sourcePlan; target.jobs = targetJobs; target.plan = targetPlan;
              return;
            }
          }
        }
      }
    }
  }

  private lag(team: RouteTeam): number {
    return team.status === StaffStatus.OnCall ? Math.max(0, team.onCallLagHours ?? 2) * 3600 : 0;
  }

  private verifiedRoute(route: RoutePlan, stops: GeoPoint[], serviceAreas?: readonly (ServiceArea | undefined)[], depotStopIndices?: readonly number[]): boolean {
    return isVerifiedAccessRoute(route, stops, serviceAreas, depotStopIndices);
  }

  private effort(jobs: RouteJob[]): number {
    return jobs.reduce((total, job) => total + (job.estimatedEffortMinutes ?? 35) * 60 + (job.requiresBaseReturn ? 1200 : 0), 0);
  }

  private depotStopIndices(jobs: RouteJob[]): number[] {
    const indices = [0];
    let index = 0;
    for (const job of jobs) {
      index++;
      if (job.requiresBaseReturn) indices.push(++index);
    }
    if (jobs.length && !jobs.at(-1)?.requiresBaseReturn) indices.push(index + 1);
    return indices;
  }

  private serviceAreas(jobs: RouteJob[]): Array<ServiceArea | undefined> {
    const areas: Array<ServiceArea | undefined> = [undefined];
    for (const job of jobs) {
      areas.push(job.serviceArea);
      if (job.requiresBaseReturn) areas.push(undefined);
    }
    if (jobs.length && !jobs.at(-1)?.requiresBaseReturn) areas.push(undefined);
    return areas;
  }

  private stops(hq: GeoPoint, jobs: RouteJob[]): GeoPoint[] {
    const stops = [hq];
    for (const job of jobs) {
      stops.push(job.point);
      if (job.requiresBaseReturn) stops.push(hq);
    }
    if (jobs.length && !jobs.at(-1)?.requiresBaseReturn) stops.push(hq);
    return stops;
  }

  private buildRoute(assignment: CrewAssignment, colorIndex: number): PlannedTeamRoute {
    const { pool, jobs, plan, teamId, staffCount } = assignment;
    let elapsed = this.lag(pool);
    let previous = pool.hq;
    const stops = this.stops(pool.hq, jobs);
    const estimatedTravel = stops.slice(1).reduce((sum, point, i) => sum + estimateTransitSeconds(stops[i]!, point), 0);
    let routeLegIndex = 0;
    // OneMap leg metrics are already in stop order. Legacy strategies have only circuit totals.
    const legSeconds = (from: GeoPoint, to: GeoPoint): number => {
      const legIndex = routeLegIndex++;
      if (plan.legs) return plan.legs[legIndex]?.durationSeconds ?? 0;
      return estimatedTravel > 0 ? estimateTransitSeconds(from, to) / estimatedTravel * plan.durationSeconds : 0;
    };
    const waypointOrder: PlannedWaypoint[] = [{
      label: `Depot Departure (${teamId})`, point: pool.hq, status: 'Completed', isCompleted: true,
      estimatedEffortMinutes: 0, requiresBaseReturn: false, isBaseReturn: false, isHq: true,
      cumulativeDurationSeconds: elapsed,
    }];
    let completedCount = 0;
    for (const [index, job] of jobs.entries()) {
      const areaVisit = plan.areaVisits?.find((visit) => visit.stopIndex === routeLegIndex + 1);
      elapsed += legSeconds(previous, job.point) + (job.estimatedEffortMinutes ?? 35) * 60;
      const isDone = ['Completed', 'Verified', 'Closed'].includes(job.status ?? '');
      if (isDone) completedCount++;
      waypointOrder.push({
        label: `Stop ${index + 1}: ${job.locality ?? job.workOrderId} (${job.taskType ?? 'Task'})`,
        point: areaVisit?.accessPoint ?? job.point, isAreaAccess: areaVisit ? true : undefined,
        targetPoint: areaVisit?.targetPoint, isDemo: job.isDemo, workOrderId: job.workOrderId, clusterId: job.clusterId, sourceReportId: job.sourceReportId, mapClusterId: job.mapClusterId, taskType: job.taskType, pestType: job.pestType,
        ...(job.scoreExplanation ? { scoreExplanation: job.scoreExplanation } : {}),
        reportIds: job.reportIds, reportCount: job.reportCount, individualCounts: job.individualCounts,
        priority: job.priority, requiredStaff: job.requiredStaff, status: isDone ? 'Completed' : job.status === 'InProgress' ? 'InProgress' : 'Pending',
        isCompleted: isDone, estimatedEffortMinutes: job.estimatedEffortMinutes ?? 35,
        requiresBaseReturn: job.requiresBaseReturn ?? false, isBaseReturn: false, isHq: false,
        cumulativeDurationSeconds: elapsed,
      });
      previous = job.point;
      if (job.requiresBaseReturn) {
        elapsed += legSeconds(previous, pool.hq) + 1200;
        waypointOrder.push({
          label: `Return to HQ: Specimen Quarantine & Handover (${job.pestType ?? 'Wildlife'})`,
          point: pool.hq, status: isDone ? 'Completed' : 'Pending', isCompleted: isDone,
          estimatedEffortMinutes: 20, requiresBaseReturn: true, isBaseReturn: true, isHq: true,
          cumulativeDurationSeconds: elapsed,
        });
        previous = pool.hq;
      }
    }
    if (!jobs.at(-1)?.requiresBaseReturn) {
      elapsed += legSeconds(previous, pool.hq);
      waypointOrder.push({
        label: `Return to HQ: Shift Conclusion (${teamId})`, point: pool.hq,
        status: completedCount === jobs.length ? 'Completed' : 'Pending', isCompleted: completedCount === jobs.length,
        estimatedEffortMinutes: 0, requiresBaseReturn: false, isBaseReturn: false, isHq: true,
        cumulativeDurationSeconds: elapsed,
      });
    }
    const totalDurationSeconds = plan.durationSeconds + this.effort(jobs) + this.lag(pool);
    waypointOrder[waypointOrder.length - 1]!.cumulativeDurationSeconds = totalDurationSeconds;
    const packingList = generatePackingList(jobs, staffCount);
    const load = logisticsLoad(packingList);
    const vehicle = assignment.vehicle;
    return {
      teamId, staffCount, depotLocation: pool.teamId.split('-')[0] ?? 'Central', status: String(pool.status ?? StaffStatus.Available),
      onCallLagHours: this.lag(pool) / 3600, workOrderIds: jobs.map((job) => job.workOrderId), waypointOrder, route: plan,
      totalDurationSeconds, totalTravelSeconds: plan.durationSeconds, totalEffortSeconds: this.effort(jobs),
      capacityUsedPercentage: Math.round(totalDurationSeconds / MAX_DISPATCH_SECONDS * 100),
      isWithinFourHourCap: totalDurationSeconds <= MAX_DISPATCH_SECONDS, completedCount, totalStopsCount: jobs.length,
      progressPercentage: Math.round(completedCount / jobs.length * 100), packingList,
      color: TEAM_COLORS[colorIndex % TEAM_COLORS.length]!,
      vehicleId: vehicle?.id, vehicleRegistration: vehicle?.registration, vehicleName: vehicle?.name,
      vehicleModel: vehicle?.model ?? undefined, vehiclePhotoUrl: vehicle?.photoUrl ?? undefined,
      isDemoVehicle: vehicle?.isDemo, maxPayloadKg: vehicle?.maxPayloadKg, maxCargoVolumeM3: vehicle?.maxCargoVolumeM3,
      loadWeightKg: load.weightKg, loadVolumeM3: load.volumeM3,
      loadWeightPercentage: vehicle ? load.weightKg / vehicle.maxPayloadKg * 100 : undefined,
      loadVolumePercentage: vehicle ? load.volumeM3 / vehicle.maxCargoVolumeM3 * 100 : undefined,
      loadBasis: LOGISTICS_LOAD_BASIS,
    };
  }
}
