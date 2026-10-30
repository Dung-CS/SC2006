/**
 * D-Fence — saved dispatches as one list: by date range, and by crew member.
 * Stereotype: <<control>>. Manager only (`workOrder:readAll`).
 *
 * A row is one `DispatchAssignment` with its crew, vehicle and ordered stops. A work order that was
 * assigned outside a dispatch (legacy single-crew orders) becomes a one-stop row with
 * `inDispatch: false`, so nothing disappears from the manager's view.
 */
import { AccessControlService } from './AccessControlService';
import { Principal } from './Principal';
import { assignmentDetail, type AssignmentUnit } from './DispatchAssignmentService';
import { validDispatchDate } from './DispatchPlanService';
import { WorkOrderStatus } from '../entity/enums';
import { WorkOrder } from '../entity/WorkOrder';
import { DispatchAssignment } from '../ports/DispatchAssignmentStore';

export type DispatchRowStatus = 'Assigned' | 'Completed' | 'Cancelled';

export interface DispatchStop {
  workOrderId: string;
  pestType: string | null;
  taskType: string | null;
  location: string;
  status: string | null;
}

export interface DispatchRow {
  id: string;
  inDispatch: boolean;
  date: string;
  hqLocation: string | null;
  status: DispatchRowStatus;
  crew: Array<{ id: string; email: string; displayName: string | null }>;
  vehicle: { id: string; name: string; model?: string | null; registration: string } | null;
  stops: DispatchStop[];
}

export class DispatchListRejected extends Error {
  constructor(message: string) { super(message); this.name = 'DispatchListRejected'; }
}

const done = [WorkOrderStatus.Completed, WorkOrderStatus.Verified];
const rowStatus = (orders: Array<WorkOrder | null>): DispatchRowStatus =>
  orders.length && orders.every((order) => order?.currentStatus() === WorkOrderStatus.Cancelled) ? 'Cancelled'
    : orders.length && orders.every((order) => order !== null && [...done, WorkOrderStatus.Cancelled].includes(order.currentStatus())) ? 'Completed'
      : 'Assigned';

export class DispatchListController {
  constructor(private readonly ac: AccessControlService, private readonly unit: AssignmentUnit) {}

  /** Dispatches dated `from`..`to` inclusive, plus orders in that range that no dispatch holds. */
  async between(from: string, to: string, by: Principal): Promise<{ dispatches: DispatchRow[]; notInDispatch: DispatchRow[] }> {
    await this.ac.authorise(by, 'workOrder:readAll', { kind: 'workOrder' });
    if (!validDispatchDate(from) || !validDispatchDate(to) || from > to) throw new DispatchListRejected('Choose a valid date range.');
    const context = this.unit.read();
    const [assignments, orders] = await Promise.all([context.assignments.listBetween(from, to), context.workOrders.findAll()]);
    return {
      dispatches: await Promise.all(assignments.map((assignment) => this.row(assignment))),
      notInDispatch: await this.legacy(orders.filter((order) => order.scheduledDate >= from && order.scheduledDate <= to)),
    };
  }

  /** Every dispatch this crew member is on, and their assigned orders that no dispatch holds. */
  async forCrew(accountId: string, by: Principal): Promise<DispatchRow[]> {
    await this.ac.authorise(by, 'workOrder:readAll', { kind: 'workOrder' });
    const context = this.unit.read();
    // ponytail: scans every work order for legacy rows; add a crew index when the table grows large.
    const [assignments, orders] = await Promise.all([context.assignments.listByCrew(accountId), context.workOrders.findAll()]);
    const legacy = await this.legacy(orders.filter((order) => order.assigneeId === accountId || order.assignedCrewIds.includes(accountId)));
    return [...await Promise.all(assignments.map((assignment) => this.row(assignment))), ...legacy]
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  private async row(assignment: DispatchAssignment): Promise<DispatchRow> {
    const context = this.unit.read();
    const { crew, vehicle, orders } = await assignmentDetail(context, assignment);
    const waypoints = new Map(assignment.routeSnapshot.waypointOrder.filter((stop) => !stop.isHq).map((stop) => [stop.workOrderId, stop]));
    return {
      id: assignment.id, inDispatch: true, date: assignment.date, hqLocation: assignment.routeSnapshot.depotLocation ?? null,
      status: assignment.status ?? rowStatus(orders),
      crew,
      vehicle: vehicle ? { id: vehicle.id, name: vehicle.name, model: vehicle.model ?? null, registration: vehicle.registration } : null,
      stops: assignment.workOrderIds.map((id, index) => {
        const order = orders[index], stop = waypoints.get(id);
        return { workOrderId: id, pestType: order?.pestType ?? stop?.pestType ?? null, taskType: order?.taskType ?? stop?.taskType ?? null,
          location: order?.location ?? stop?.label ?? 'Singapore', status: order?.currentStatus() ?? null };
      }),
    };
  }

  /** Assigned orders outside any dispatch, one row each. Unassigned (Created) orders are not dispatches. */
  private async legacy(orders: WorkOrder[]): Promise<DispatchRow[]> {
    const context = this.unit.read();
    return Promise.all(orders.filter((order) => !order.dispatchAssignmentId && (order.assigneeId || order.assignedCrewIds.length))
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)).map(async (order) => {
        const crewIds = [...new Set([...(order.assigneeId ? [order.assigneeId] : []), ...order.assignedCrewIds])];
        const [crew, vehicle] = await Promise.all([Promise.all(crewIds.map((id) => context.accounts.findById(id))),
          order.assignedVehicleId ? context.vehicles.findById(order.assignedVehicleId) : null]);
        return {
          id: order.id, inDispatch: false, date: order.scheduledDate, hqLocation: null, status: rowStatus([order]),
          crew: crew.flatMap((member) => member ? [{ id: member.id, email: member.email, displayName: member.displayName }] : []),
          vehicle: vehicle ? { id: vehicle.id, name: vehicle.name, model: vehicle.model ?? null, registration: vehicle.registration } : null,
          stops: [{ workOrderId: order.id, pestType: order.pestType, taskType: order.taskType, location: order.location ?? 'Singapore',
            status: order.currentStatus() }],
        };
      }));
  }
}
