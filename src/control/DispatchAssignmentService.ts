import { randomUUID } from 'node:crypto';
import { AccessControlService } from './AccessControlService';
import { Principal } from './Principal';
import { DispatchController, DuplicateWorkOrder } from './DispatchController';
import { DispatchJob, DispatchPlanService, validDispatchDate, withLocalities } from './DispatchPlanService';
import { PlannedTeamRoute, PlannedWaypoint, RouteOptimizationService, RouteTeam } from './RouteOptimizationService';
import { HQ_COORDINATES } from './DispatchRouteInputs';
import type { WorkOrderLifecycleController } from './WorkOrderLifecycleController';
import type { ReportLifecycleController } from './ReportLifecycleController';
import { generatePackingList, itemFitsCargo, logisticsLoad } from './LogisticsPolicy';
import { ineligibilityReason } from './StaffRoutingPolicy';
import { RoutePlan, isInsideServiceArea, isVerifiedAccessRoute } from './routing/IRouteStrategy';
import { Account } from '../entity/Account';
import { Vehicle } from '../entity/Vehicle';
import { WorkOrder } from '../entity/WorkOrder';
import { ConfigSet } from '../config/ConfigSet';
import { GeoPoint, singaporeDate } from '../entity/valueTypes';
import { HqLocation, PestType, Role, StaffStatus, TaskType, WorkOrderStatus } from '../entity/enums';
import { AccountStore, ClusterStore, WorkOrderStore } from '../ports/Stores';
import { DispatchAssignment, DispatchAssignmentStore } from '../ports/DispatchAssignmentStore';
import { VehicleStore } from '../ports/VehicleStore';

export class DispatchAssignmentRejected extends Error {
  constructor(message: string, readonly status = 409) { super(message); this.name = 'DispatchAssignmentRejected'; }
}

export interface AssignmentContext {
  accounts: AccountStore;
  vehicles: VehicleStore;
  workOrders: WorkOrderStore;
  clusters: ClusterStore;
  assignments: DispatchAssignmentStore;
  dispatch: Pick<DispatchController, 'createWorkOrder' | 'assign' | 'cancel'>;
  lifecycle: Pick<WorkOrderLifecycleController, 'transition'>;
  reportLifecycle: Pick<ReportLifecycleController, 'transition'>;
}

export interface AssignmentUnit {
  read(): AssignmentContext;
  run<T>(work: (context: AssignmentContext) => Promise<T>): Promise<T>;
}

export interface AssignDispatchRequest {
  date: string; teamId: string; crewIds: string[]; vehicleId: string; computedAt?: string;
  /** Manual set: the ordered stop list when the manager changed the planned route. */
  workOrderIds?: string[];
}

export interface EditDispatchRequest {
  date: string; assignmentId: string; crewIds: string[]; vehicleId: string; workOrderIds: string[];
}

/** Road-routes a manager's stop list in the given order with the planner's own strategy and route builder. */
export interface ManualRouting {
  jobs(date: string): Promise<DispatchJob[]>;
  planner: RouteOptimizationService;
}

/** Non-terminal states a removal can cancel. Completed work stays for verification. */
const cancellable = [WorkOrderStatus.Created, WorkOrderStatus.Assigned, WorkOrderStatus.Accepted, WorkOrderStatus.InProgress, WorkOrderStatus.Rejected];
const settled = (order: WorkOrder): boolean => [WorkOrderStatus.Completed, WorkOrderStatus.Verified, WorkOrderStatus.Cancelled].includes(order.currentStatus());
const committed = (order: WorkOrder): boolean => [WorkOrderStatus.Assigned, WorkOrderStatus.Accepted, WorkOrderStatus.InProgress, WorkOrderStatus.Rejected].includes(order.currentStatus());
const stopsOf = (route: PlannedTeamRoute) => route.waypointOrder.filter((stop) => !stop.isHq);
const memberCard = (member: Account) => ({ id: member.id, email: member.email, displayName: member.displayName });

/** The crew cards, vehicle and work orders behind one saved dispatch. The one enrichment shared by every dispatch listing. */
export async function assignmentDetail(context: AssignmentContext, assignment: DispatchAssignment) {
  const [crew, vehicle, orders] = await Promise.all([
    Promise.all(assignment.crewIds.map((id) => context.accounts.findById(id))), context.vehicles.findById(assignment.vehicleId),
    Promise.all(assignment.workOrderIds.map((id) => context.workOrders.findById(id))),
  ]);
  return { crew: crew.filter((member): member is Account => member !== null).map(memberCard), vehicle, orders };
}

export class DispatchAssignmentService {
  /** Waits before each retry of a rate-limited manual route; the 30 s route timer still bounds the total. */
  static rateLimitRetryMs = [5_000, 10_000];
  constructor(private readonly ac: AccessControlService, private readonly plans: Pick<DispatchPlanService, 'findReadyRoute'>,
    private readonly unit: AssignmentUnit, private readonly config: ConfigSet,
    private readonly invalidate: () => void = () => {}, private readonly manual: ManualRouting | null = null) {}

  private async authorise(by: Principal): Promise<void> {
    await this.ac.authorise(by, 'workOrder:write', { kind: 'workOrder' });
  }

  private inferHq(teamId: string): HqLocation {
    for (const hq of Object.values(HqLocation)) {
      if (teamId.toLowerCase().includes(hq.toLowerCase())) return hq;
    }
    return HqLocation.Central;
  }

  private ready(date: string, teamId: string, computedAt?: string) {
    if (!validDispatchDate(date) || !teamId || date < singaporeDate(new Date())) {
      throw new DispatchAssignmentRejected('Choose today or a future dispatch date and a planned crew.', 400);
    }
    const found = this.plans.findReadyRoute(date, teamId);
    if (!found) {
      const hq = this.inferHq(teamId);
      const coord = HQ_COORDINATES[hq] ?? HQ_COORDINATES[HqLocation.Central];
      const emptyRoute: PlannedTeamRoute = {
        teamId,
        color: '#4CC9F0',
        staffCount: 1,
        totalStopsCount: 0,
        totalDurationSeconds: 0,
        totalTravelSeconds: 0,
        totalEffortSeconds: 0,
        capacityUsedPercentage: 0,
        isWithinFourHourCap: true,
        completedCount: 0,
        progressPercentage: 0,
        packingList: [],
        loadWeightKg: 0,
        loadVolumeM3: 0,
        loadBasis: 'Scratch route',
        status: StaffStatus.Available,
        onCallLagHours: 0,
        depotLocation: hq,
        waypointOrder: [],
        workOrderIds: [],
        route: {
          source: 'onemap',
          distanceMetres: 0,
          durationSeconds: 0,
          coordinates: [coord, coord],
        },
      };
      return { route: emptyRoute, computedAt: computedAt ?? new Date().toISOString() };
    }
    if (computedAt !== undefined && computedAt !== found.computedAt) {
      throw new DispatchAssignmentRejected('This dispatch plan changed or is not ready. Refresh the plan and choose the crew again.');
    }
    this.verified(found.route, 'This dispatch does not have a complete verified route. Refresh the plan.');
    return found;
  }

  private verified(route: PlannedTeamRoute, message: string): PlannedTeamRoute {
    if (route.workOrderIds.length === 0) return route;
    if (route.route.source !== 'onemap' || !route.isWithinFourHourCap ||
      !Number.isFinite(route.totalDurationSeconds) || route.totalDurationSeconds > 14_400 ||
      !route.workOrderIds.length || stopsOf(route).length !== route.workOrderIds.length ||
      new Set(route.workOrderIds).size !== route.workOrderIds.length) {
      throw new DispatchAssignmentRejected(message);
    }
    return route;
  }

  /** Fresh road route for an edited stop list, kept in the manager's order. Called outside the write lock. */
  private async manualRoute(base: PlannedTeamRoute, date: string, ids: string[]): Promise<PlannedTeamRoute> {
    if (!this.manual) throw new DispatchAssignmentRejected('Manual dispatch changes are not available on this server.', 503);
    const available = new Map((await this.manual.jobs(date)).map((job) => [job.workOrderId, job]));
    const jobs = ids.map((id) => available.get(id)).filter((job): job is DispatchJob => job !== undefined);
    const hq = HQ_COORDINATES[base.depotLocation as HqLocation];
    if (jobs.length !== ids.length || !hq) throw new DispatchAssignmentRejected('A chosen task is no longer waiting for dispatch. Refresh the plan.');
    // ponytail: reuse the planner's private stop, depot and waypoint builders rather than copying them here.
    const planner = this.manual.planner;
    const stops = planner['stops'](hq, jobs), areas = planner['serviceAreas'](jobs), depots = planner['depotStopIndices'](jobs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let plan: RoutePlan | null = null, rateLimited = false;
    // A reorder needs road legs the planner never fetched. Right after a plan refresh OneMap often
    // answers those with HTTP 429, so wait and retry; cached legs are reused on each attempt.
    try {
      for (const wait of [0, ...DispatchAssignmentService.rateLimitRetryMs]) {
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        try { plan = await planner['strategy'].calculateRoute(stops, controller.signal, areas, depots); rateLimited = false; break; }
        catch (error) {
          if (controller.signal.aborted) break; // timed out: keep the previous attempt's 429 reading
          rateLimited = /\b429\b/.test(String((error as Error)?.message ?? error));
          if (!rateLimited) break;
        }
      }
    } finally { clearTimeout(timer); }
    if (rateLimited) {
      throw new DispatchAssignmentRejected('OneMap is limiting route requests right now, so these stops were not checked. Wait a minute and save again.', 503);
    }
    if (!plan || !isVerifiedAccessRoute(plan, stops, areas, depots)) {
      throw new DispatchAssignmentRejected('The road route for these stops could not be verified. Change the stops or try again.');
    }
    const pool: RouteTeam = { teamId: base.teamId, hq, capabilities: [], status: base.status, onCallLagHours: base.onCallLagHours };
    const staffCount = Math.max(1, ...jobs.map((job) => job.requiredStaff ?? 1));
    const [built] = withLocalities([planner['buildRoute']({ pool, teamId: base.teamId, staffCount, jobs, plan }, 0)], jobs);
    return this.verified({ ...built!,
      depotLocation: base.depotLocation, color: base.color }, 'The edited route exceeds the four-hour shift cap. Remove a task and try again.');
  }

  private selection(request: { crewIds: unknown; vehicleId: unknown; workOrderIds?: unknown }, stopsRequired: boolean): void {
    const ids = request.workOrderIds;
    if (!Array.isArray(request.crewIds) || request.crewIds.length === 0 || request.crewIds.length > 100 ||
      request.crewIds.some((id) => typeof id !== 'string' || !id) || new Set(request.crewIds).size !== request.crewIds.length ||
      typeof request.vehicleId !== 'string' || !request.vehicleId) {
      throw new DispatchAssignmentRejected('Select distinct crew members and one vehicle.', 400);
    }
    if ((ids !== undefined || stopsRequired) && (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 ||
      ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length)) {
      throw new DispatchAssignmentRejected('Keep at least one task, with each task listed once.', 400);
    }
  }

  /** Crew and vehicle checks against the route that will be saved. */
  private chosen(resources: Awaited<ReturnType<DispatchAssignmentService['resources']>>, route: PlannedTeamRoute,
    crewIds: string[], vehicleId: string): { selected: Account[]; vehicle: Vehicle } {
    const requiredStaff = Math.max(route.staffCount, ...stopsOf(route).map((stop) => stop.requiredStaff ?? 1));
    const selected = crewIds.map((id) => resources.crew.find((member) => member.id === id));
    if (selected.length < requiredStaff || selected.some((member) => !member || resources.busyCrew.has(member.id) || !this.eligibleCrew(member, route))) {
      throw new DispatchAssignmentRejected('The selected crew is unavailable, too small, at another HQ or not qualified for every task. Refresh the assignment choices.');
    }
    const vehicle = resources.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle || resources.busyVehicles.has(vehicle.id) || !this.fitsVehicle(vehicle, route, selected.length)) {
      throw new DispatchAssignmentRejected('The selected vehicle is unavailable or cannot carry this crew and task load. Choose another vehicle.');
    }
    return { selected: selected as Account[], vehicle };
  }

  /** The saved snapshot names the real work orders, crew and vehicle. */
  private snapshot(route: PlannedTeamRoute, selected: Account[], vehicle: Vehicle, ids: string[]): PlannedTeamRoute {
    const copy = structuredClone(route);
    if (ids.length) stopsOf(copy).forEach((stop, index) => { stop.workOrderId = ids[index]; });
    return { ...copy, workOrderIds: ids.length ? [...ids] : copy.workOrderIds, staffCount: selected.length, crewMembers: selected.map(memberCard),
      vehicleId: vehicle.id, vehicleName: vehicle.name, vehicleRegistration: vehicle.registration,
      vehicleModel: vehicle.model ?? undefined, vehiclePhotoUrl: vehicle.photoUrl ?? undefined };
  }

  /** Book each stop's order onto the assignment, in route order. */
  private async book(context: AssignmentContext, route: PlannedTeamRoute, assignment: DispatchAssignment, by: Principal, keep?: string): Promise<string[]> {
    const ids: string[] = [];
    for (const stop of stopsOf(route)) {
      const order = await this.resolveOrder(context, stop, assignment.date, by, keep);
      order.dispatchAssignmentId = assignment.id;
      order.assignedCrewIds = [...assignment.crewIds];
      order.assignedVehicleId = assignment.vehicleId;
      await context.workOrders.save(order);
      await context.dispatch.assign(order.id, assignment.crewIds[0]!, by);
      ids.push(order.id);
    }
    return ids;
  }

  /** Editable means every order is still Assigned to this booking: no crew has accepted or started a task. */
  private async editable(context: AssignmentContext, assignment: DispatchAssignment): Promise<void> {
    const orders = await Promise.all(assignment.workOrderIds.map((id) => context.workOrders.findById(id)));
    if (orders.some((order) => !order || order.dispatchAssignmentId !== assignment.id || order.currentStatus() !== WorkOrderStatus.Assigned)) {
      throw new DispatchAssignmentRejected('This dispatch can no longer be edited: a task was accepted, started, finished or changed. Refresh the assignments.');
    }
  }

  private async resources(context: AssignmentContext, date: string, exclude?: string) {
    const [crew, vehicles, orders, assignments] = await Promise.all([context.accounts.findByRole(Role.CleaningCrew),
      context.vehicles.list(), context.workOrders.findAllOpen(), context.assignments.list(date)]);
    const busyCrew = new Set<string>();
    const busyVehicles = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.id === exclude) continue;
      const remaining = await Promise.all(assignment.workOrderIds.map((id) => context.workOrders.findById(id)));
      if (remaining.some((order) => order === null || !settled(order))) {
        assignment.crewIds.forEach((id) => busyCrew.add(id));
        busyVehicles.add(assignment.vehicleId);
      }
    }
    for (const order of orders) if (!(exclude && order.dispatchAssignmentId === exclude) && (order.dispatchAssignmentId ? order.scheduledDate === date : order.scheduledDate <= date) && committed(order)) {
      if (order.assigneeId) busyCrew.add(order.assigneeId);
      order.assignedCrewIds.forEach((id) => busyCrew.add(id));
      if (order.assignedVehicleId) busyVehicles.add(order.assignedVehicleId);
    }
    return { crew, vehicles, busyCrew, busyVehicles, assignments };
  }

  private eligibleCrew(member: Account, route: PlannedTeamRoute): boolean {
    if (member.hqLocation !== route.depotLocation || ![StaffStatus.Available, StaffStatus.OnCall].includes(member.staffStatus)) return false;
    const lag = member.staffStatus === StaffStatus.OnCall ? member.onCallLagHours : 0;
    if (!Number.isFinite(lag) || lag < 0 || (route.onCallLagHours > 0 && lag > route.onCallLagHours)) return false;
    if (stopsOf(route).length === 0) return true;
    return stopsOf(route).every((stop) => !!stop.taskType && !!stop.pestType && ineligibilityReason(member,
      { taskType: stop.taskType as TaskType, pestType: stop.pestType as PestType }, this.config.pestProfiles.get(stop.pestType as PestType) ?? null) === null);
  }

  private fitsVehicle(vehicle: Vehicle, route: PlannedTeamRoute, staffCount: number): boolean {
    const packing = generatePackingList(stopsOf(route), staffCount);
    const load = logisticsLoad(packing);
    return vehicle.isAvailable && vehicle.hqLocation === route.depotLocation && vehicle.seatCapacity >= staffCount &&
      [vehicle.maxPayloadKg, vehicle.maxCargoVolumeM3, vehicle.cargoLengthCm, vehicle.cargoWidthCm, vehicle.cargoHeightCm]
        .every((value) => Number.isFinite(value) && value > 0) &&
      load.weightKg <= vehicle.maxPayloadKg && load.volumeM3 <= vehicle.maxCargoVolumeM3 && packing.every((item) => itemFitsCargo(item, vehicle));
  }

  async options(date: string, teamId: string, by: Principal, assignmentId?: string) {
    await this.authorise(by);
    const saved = assignmentId ? (await this.unit.read().assignments.list(date)).find((item) => item.id === assignmentId) : undefined;
    if (assignmentId && !saved) throw new DispatchAssignmentRejected('This saved dispatch no longer exists. Refresh the assignments.', 404);
    const { route, computedAt } = saved ? { route: saved.routeSnapshot, computedAt: saved.computedAt } : this.ready(date, teamId);
    const resources = await this.resources(this.unit.read(), date, saved?.id);
    const requiredStaff = Math.max(route.staffCount, ...stopsOf(route).map((stop) => stop.requiredStaff ?? 1));
    // Staff each stop needs, for planned stops and addable tasks, so the editor applies the server's crew rule as stops change.
    const jobs = this.manual ? await this.manual.jobs(date).catch(() => []) : [];
    const stopStaff = Object.fromEntries([...jobs.map((job) => [job.workOrderId, job.requiredStaff ?? 1] as const),
      ...stopsOf(route).flatMap((stop) => stop.workOrderId ? [[stop.workOrderId, stop.requiredStaff ?? 1] as const] : [])]);
    return { stopStaff, crew: resources.crew.filter((member) => !resources.busyCrew.has(member.id) && this.eligibleCrew(member, route)).map(memberCard),
      vehicles: resources.vehicles.filter((vehicle) => !resources.busyVehicles.has(vehicle.id) && this.fitsVehicle(vehicle, route, requiredStaff)),
      requiredStaff, computedAt, assignment: saved ?? resources.assignments.find((assignment) => assignment.teamId === teamId && assignment.computedAt === computedAt) ?? null };
  }

  async list(date: string, by: Principal) {
    await this.authorise(by);
    if (!validDispatchDate(date)) throw new DispatchAssignmentRejected('Choose a valid dispatch date.', 400);
    const context = this.unit.read();
    return Promise.all((await context.assignments.list(date)).map((assignment) => this.withStatus(context, assignment)));
  }

  /** Saved dispatches dated `from`..`to` inclusive, enriched exactly like `list`. */
  async listBetween(from: string, to: string, by: Principal) {
    await this.authorise(by);
    if (!validDispatchDate(from) || !validDispatchDate(to) || from > to) throw new DispatchAssignmentRejected('Choose a valid date range.', 400);
    const context = this.unit.read();
    return Promise.all((await context.assignments.listBetween(from, to)).map((assignment) => this.withStatus(context, assignment)));
  }

  private async withStatus(context: AssignmentContext, assignment: DispatchAssignment) {
    const { crew, vehicle, orders } = await assignmentDetail(context, assignment);
    return { ...assignment, crew, vehicle,
      status: assignment.status ?? (orders.length && orders.every((order) => order !== null && settled(order)) ? 'Completed' : 'Assigned') };
  }

  async assign(request: AssignDispatchRequest, by: Principal): Promise<DispatchAssignment> {
    await this.authorise(by);
    if (!validDispatchDate(request.date) || typeof request.teamId !== 'string' || !request.teamId.trim()) {
      throw new DispatchAssignmentRejected('Select distinct crew members and one vehicle.', 400);
    }
    this.selection(request, false);
    // Manual set: route the manager's stop list on roads before taking the write lock.
    const planned = this.ready(request.date, request.teamId, request.computedAt);
    const manual = request.workOrderIds && (planned.route.workOrderIds.length === 0 || request.workOrderIds.join() !== planned.route.workOrderIds.join())
      ? await this.manualRoute(planned.route, request.date, request.workOrderIds) : null;
    const initialRoute = manual ?? planned.route;
    if (initialRoute.workOrderIds.length === 0) {
      throw new DispatchAssignmentRejected('Choose at least one task for this dispatch.', 400);
    }
    const result = await this.unit.run(async (context) => {
      const resources = await this.resources(context, request.date);
      const previous = resources.assignments.find((assignment) => assignment.teamId === request.teamId && assignment.computedAt === request.computedAt);
      if (previous) {
        if (previous.vehicleId === request.vehicleId && [...previous.crewIds].sort().join() === [...request.crewIds].sort().join()) return previous;
        throw new DispatchAssignmentRejected('This dispatch is already assigned. Open its saved assignment.');
      }
      const { computedAt } = this.ready(request.date, request.teamId, request.computedAt);
      const route = initialRoute;
      const { selected, vehicle } = this.chosen(resources, route, request.crewIds, request.vehicleId);
      const assignment: DispatchAssignment = { id: randomUUID(), date: request.date, teamId: request.teamId,
        crewIds: [...request.crewIds], vehicleId: request.vehicleId, workOrderIds: [], computedAt,
        routeSnapshot: this.snapshot(route, selected, vehicle, []), createdBy: by.accountId, createdAt: new Date().toISOString() };
      await context.assignments.save(assignment);
      assignment.workOrderIds = await this.book(context, route, assignment, by);
      assignment.routeSnapshot = this.snapshot(route, selected, vehicle, assignment.workOrderIds);
      await context.assignments.save(assignment);
      return assignment;
    });
    this.invalidate();
    return result;
  }

  /** Edit a saved dispatch while no task has been accepted: crew, vehicle and the ordered stop list. */
  async edit(request: EditDispatchRequest, by: Principal): Promise<DispatchAssignment> {
    await this.authorise(by);
    if (!validDispatchDate(request.date) || request.date < singaporeDate(new Date()) || typeof request.assignmentId !== 'string' || !request.assignmentId) {
      throw new DispatchAssignmentRejected('Choose a saved dispatch for today or a future date.', 400);
    }
    this.selection(request, true);
    const find = async (context: AssignmentContext): Promise<DispatchAssignment> => {
      const found = (await context.assignments.list(request.date)).find((item) => item.id === request.assignmentId);
      if (!found) throw new DispatchAssignmentRejected('This saved dispatch no longer exists. Refresh the assignments.', 404);
      await this.editable(context, found);
      return found;
    };
    const before = await find(this.unit.read());
    const route = await this.manualRoute(before.routeSnapshot, request.date, request.workOrderIds);
    const result = await this.unit.run(async (context) => {
      const saved = await find(context);
      if (saved.workOrderIds.join() !== before.workOrderIds.join()) {
        throw new DispatchAssignmentRejected('This dispatch changed while you were editing it. Refresh the assignments.');
      }
      const resources = await this.resources(context, request.date, saved.id);
      const chosen = this.chosen(resources, route, request.crewIds, request.vehicleId);
      for (const id of saved.workOrderIds.filter((id) => !request.workOrderIds.includes(id))) {
        const order = (await context.workOrders.findById(id))!;
        Object.assign(order, { dispatchAssignmentId: null, assignedCrewIds: [], assignedVehicleId: null, assigneeId: null });
        await context.workOrders.save(order);
        await context.lifecycle.transition(id, WorkOrderStatus.Created, by);
      }
      return this.rebook(context, saved, route, chosen, by);
    });
    this.invalidate();
    return result;
  }

  /** Save an edited assignment on its fresh road route: the one write path shared by edit and removal. */
  private async rebook(context: AssignmentContext, saved: DispatchAssignment, route: PlannedTeamRoute,
    chosen: { selected: Account[]; vehicle: Vehicle }, by: Principal): Promise<DispatchAssignment> {
    Object.assign(saved, { crewIds: chosen.selected.map((member) => member.id), vehicleId: chosen.vehicle.id,
      updatedAt: new Date().toISOString(), updatedBy: by.accountId, needsRoadCheck: false });
    saved.workOrderIds = await this.book(context, route, saved, by, saved.id);
    saved.routeSnapshot = this.snapshot(route, chosen.selected, chosen.vehicle, saved.workOrderIds);
    await context.assignments.save(saved);
    return saved;
  }

  /**
   * Report rejected: cancel each linked work order, take its stop off every saved dispatch and re-route
   * what is left. A dispatch with no stops left is cancelled, which frees its crew and vehicle. Routing
   * never blocks the removal: when the road re-check fails, the remaining stops keep their order and
   * the dispatch is flagged for a fresh road check. `then` runs in the same atomic unit.
   */
  async removeWorkOrders<T>(ids: string[], reason: string, by: Principal, then: (context: AssignmentContext) => Promise<T>): Promise<T> {
    await this.authorise(by);
    const removed = new Set(ids);
    const affected = async (context: AssignmentContext): Promise<DispatchAssignment[]> => {
      const links = new Set<string>();
      for (const id of ids) {
        const link = (await context.workOrders.findById(id))?.dispatchAssignmentId;
        if (link) links.add(link);
      }
      return (await Promise.all([...links].map((id) => context.assignments.findById(id))))
        .filter((item): item is DispatchAssignment => item !== null && item.status !== 'Cancelled');
    };
    // Road re-check outside the write lock. Any failure only means "flag for a fresh road check".
    const routes = new Map<string, { ids: string; route: PlannedTeamRoute }>();
    for (const assignment of await affected(this.unit.read())) {
      const remaining = assignment.workOrderIds.filter((id) => !removed.has(id));
      if (!remaining.length) continue;
      try { routes.set(assignment.id, { ids: remaining.join(), route: await this.manualRoute(assignment.routeSnapshot, assignment.date, remaining) }); }
      catch { /* flagged below */ }
    }
    const result = await this.unit.run(async (context) => {
      const assignments = await affected(context);
      for (const id of ids) {
        const order = await context.workOrders.findById(id);
        if (order && cancellable.includes(order.currentStatus())) await context.dispatch.cancel(id, reason, by);
      }
      for (const saved of assignments) {
        const remaining = saved.workOrderIds.filter((id) => !removed.has(id));
        Object.assign(saved, { workOrderIds: remaining.length ? remaining : saved.workOrderIds, updatedAt: new Date().toISOString(), updatedBy: by.accountId });
        if (!remaining.length) {
          saved.status = 'Cancelled';
          await context.assignments.save(saved);
          continue;
        }
        const fresh = routes.get(saved.id);
        const rebookable = fresh?.ids === remaining.join() && await this.editable(context, saved).then(() => true, () => false);
        const [crew, vehicle] = await Promise.all([Promise.all(saved.crewIds.map((id) => context.accounts.findById(id))), context.vehicles.findById(saved.vehicleId)]);
        if (rebookable && vehicle && crew.every((member) => member !== null)) {
          await this.rebook(context, saved, fresh!.route, { selected: crew as Account[], vehicle }, by);
          continue;
        }
        const stops = saved.routeSnapshot.waypointOrder;
        const gone = (index: number): boolean => removed.has(stops[index]?.workOrderId ?? '');
        saved.routeSnapshot = { ...saved.routeSnapshot, workOrderIds: [...remaining],
          waypointOrder: stops.filter((stop, index) => !gone(index) && !(stop.isBaseReturn && gone(index - 1))) };
        saved.needsRoadCheck = true;
        await context.assignments.save(saved);
      }
      return then(context);
    });
    this.invalidate();
    return result;
  }

  private async resolveOrder(context: AssignmentContext, stop: PlannedWaypoint, date: string, by: Principal, keep?: string): Promise<WorkOrder> {
    // Planned ids (report-/prop-) are not uuids: Postgres rejects them, so they never reach findById.
    const unsaved = !!stop.workOrderId?.startsWith('report-') || !!stop.workOrderId?.startsWith('prop-');
    let order = stop.workOrderId && !unsaved ? await context.workOrders.findById(stop.workOrderId) : null;
    if (!order) {
      if (!unsaved) {
        throw new DispatchAssignmentRejected('A task was removed after this route was planned. Refresh the plan.');
      }
      try {
        order = await context.dispatch.createWorkOrder({ scheduledDate: date, taskType: stop.taskType as TaskType,
          pestType: stop.pestType as PestType, ...(stop.sourceReportId ? { sourceReportId: stop.sourceReportId } : { clusterId: stop.clusterId ?? undefined }) }, by);
      } catch (error) {
        if (error instanceof DuplicateWorkOrder) order = error.existing;
        else throw error;
      }
    }
    const free = order.currentStatus() === WorkOrderStatus.Created && !order.dispatchAssignmentId;
    const kept = !!keep && order.currentStatus() === WorkOrderStatus.Assigned && order.dispatchAssignmentId === keep;
    if (!free && !kept || order.taskType !== stop.taskType ||
      order.pestType !== stop.pestType || order.sourceReportId !== (stop.sourceReportId ?? null) || order.scheduledDate > date) {
      throw new DispatchAssignmentRejected('A task changed or was assigned after this route was planned. Refresh the plan.');
    }
    const cluster = order.clusterId ? await context.clusters.findById(order.clusterId) : null;
    const currentTarget = order.targetPoint ?? (cluster?.boundary?.rings[0]?.length ? cluster.boundary.centroid() : null);
    const planned = stop.targetPoint ?? stop.point;
    if (!currentTarget || currentTarget.distanceTo(new GeoPoint(planned.latitude, planned.longitude)) > 1 ||
      stop.isAreaAccess && (!cluster?.isActive || !isInsideServiceArea(stop.point, cluster.boundary))) {
      throw new DispatchAssignmentRejected('A task location changed after road verification. Refresh the route before assignment.');
    }
    return order;
  }
}
