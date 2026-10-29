/**
 * D-Fence — WorkOrderRoutes.
 * Stereotype: <<boundary>>. Traces: 8.1.x, 8.2.x, 8.3.x, 2.3.4, 8.1.12, 10.5.3.
 *
 * Routes:
 *   GET  /api/ops/dispatch                    the proposed daily list, ?date= (8.1.7)
 *   GET  /api/ops/work-orders                 all orders, ?status= ?crewId= (8.2.x)
 *   GET  /api/ops/work-orders/:id             one order with its history (8.3.x)
 *   GET  /api/ops/work-orders/crew-workload   open orders per crew member (8.2.5)
 *   POST /api/ops/work-orders                 create (8.1.1–8.1.6)
 *   POST /api/ops/work-orders/:id/assign      body { crewId } (8.2.1)
 *   POST /api/ops/work-orders/:id/cancel      body { reason } (8.3.19)
 *   POST /api/ops/work-orders/:id/verify      manager confirms a completion (8.4.x)
 *   POST /api/ops/work-orders/:id/reject      body { reason } (8.4.x)
 *
 * 8.1.12 is the one that shapes this file. A duplicate is refused with **the order that blocked
 * it** in the body, not merely with "duplicate": the manager's next action is to open that order,
 * and a refusal that withholds its identifier makes them go and search for it.
 *
 * Assignment and cancellation are separate POSTs rather than a PATCH carrying a status, because
 * 8.3.x makes the transition table the authority on what may change. A general "set these fields"
 * endpoint would let a caller drive a status change past `WorkOrderLifecycleController`, which is
 * the single write path that exists to prevent exactly that.
 */
import { RouteHandler, Request, Response } from './RouteHandler';
import { AccessControlService } from '../../control/AccessControlService';
import {
  DispatchController,
  DuplicateWorkOrder,
  WorkOrderNotFound,
  WorkOrderRejected,
} from '../../control/DispatchController';
import { TransitionRefused, WorkOrderLifecycleController } from '../../control/WorkOrderLifecycleController';
import { StaffAccountController } from '../../control/StaffAccountController';
import { PestType, TaskType, WorkOrderStatus } from '../../entity/enums';
import { singaporeDate } from '../../entity/valueTypes';
import { WorkOrder } from '../../entity/WorkOrder';
import { Account } from '../../entity/Account';
import { RouteJob, RouteOptimizationService, RouteTeam } from '../../control/RouteOptimizationService';
import { WorkOrderSubject } from '../../control/observer/WorkOrderObserver';
import { DispatchPlanService, validDispatchDate } from '../../control/DispatchPlanService';

interface CreateBody {
  clusterId?: string;
  taskType?: string;
  pestType?: string;
  scheduledDate?: string;
  instructions?: string;
  sourceReportId?: string;
}

export class WorkOrderRoutes extends RouteHandler {
  constructor(
    ac: AccessControlService,
    private readonly dispatch: DispatchController,
    private readonly lifecycle: WorkOrderLifecycleController,
    private readonly staff: StaffAccountController,
    private readonly routePlanner: RouteOptimizationService | null = null,
    private readonly routeInputs: ((date: string) => Promise<{ teams: RouteTeam[]; jobs: RouteJob[] }>) | null = null,
    private readonly workOrderEvents: WorkOrderSubject | null = null,
    private readonly precomputedPlans: DispatchPlanService | null = null,
  ) {
    super(ac);
  }

  routes(): string[] {
    return [
      '/api/ops/dispatch',
      '/api/ops/dispatch/routes',
      '/api/ops/dispatch/horizon',
      '/api/ops/work-orders',
      '/api/ops/work-orders/crew-workload',
      '/api/ops/work-orders/:id',
    ];
  }

  override writeRoutes(): string[] {
    return [
      '/api/ops/work-orders',
      '/api/ops/work-orders/:id/assign',
      '/api/ops/work-orders/:id/cancel',
      '/api/ops/work-orders/:id/verify',
      '/api/ops/work-orders/:id/reject',
    ];
  }

  async handle(req: Request, res: Response): Promise<void> {
    const id = req.params.id ?? '';
    try {
      const principal = await this.resolvePrincipal(req);
      switch (req.params.route) {
        case '/api/ops/dispatch': {
          // 8.1.7 — today in Singapore, not in UTC. At 08:00 SGT the two disagree, and the list
          // would be yesterday's for the whole morning.
          const date = req.params.date ?? singaporeDate(new Date());
          res.json({ date, proposals: await this.dispatch.proposeDailyList(date, principal, Infinity) });
          return;
        }

        case '/api/ops/dispatch/horizon': {
          await this.ac.authorise(principal, 'workOrder:write', { kind: 'workOrder' });
          const date = req.params.date ?? singaporeDate(new Date());
          const daysText = req.params.days ?? '1';
          const days = Number(daysText);
          if (!validDispatchDate(date) || !/^[1-7]$/.test(daysText)) {
            res.status(400).json({ error: 'Choose a valid calendar date and one to seven days.', remedy: 'Use date=YYYY-MM-DD and days=1..7.' });
            return;
          }
          if (this.precomputedPlans === null) {
            res.status(503).json({ error: 'background route planning is unavailable' });
            return;
          }
          res.json(this.precomputedPlans.snapshotRange(date, days));
          return;
        }

        case '/api/ops/dispatch/routes': {
          await this.ac.authorise(principal, 'workOrder:write', { kind: 'workOrder' });
          const date = req.params.date ?? singaporeDate(new Date());
          if (!validDispatchDate(date)) {
            res.status(400).json({ error: 'Choose a valid calendar date.', remedy: 'Use YYYY-MM-DD.' });
            return;
          }
          if (this.precomputedPlans !== null) {
            res.json(this.precomputedPlans.snapshot(date));
            return;
          }
          if (this.routePlanner === null || this.routeInputs === null) {
            res.status(503).json({ error: 'route planning is unavailable until crew depots are configured' });
            return;
          }
          const input = await this.routeInputs(date);
          const roadUnverified = new Set<string>();
          const committedStatuses = [WorkOrderStatus.Assigned, WorkOrderStatus.Accepted,
            WorkOrderStatus.InProgress, WorkOrderStatus.Rejected];
          const allocatable = input.jobs.filter((job) => !committedStatuses.includes(job.status as WorkOrderStatus));
          const routes = await this.routePlanner.plan(input.teams, allocatable, undefined, roadUnverified);
          const plannedIds = new Set(routes.flatMap((route) => route.workOrderIds));
          const tierOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          const unplanned = input.jobs.filter((job) => !plannedIds.has(job.workOrderId))
            .sort((a, b) => (tierOrder[a.priority ?? 'Medium'] ?? 2) - (tierOrder[b.priority ?? 'Medium'] ?? 2))
            .map((job) => ({ workOrderId: job.workOrderId, locality: job.locality, priority: job.priority,
              taskType: job.taskType, requiredStaff: job.requiredStaff,
              reason: job.status === WorkOrderStatus.Rejected
                ? 'Committed work is excluded from new allocation; retain/review its existing assignment.'
                : committedStatuses.includes(job.status as WorkOrderStatus)
                  ? 'Already assigned, accepted or in progress; retain existing assignment and exclude from new allocation.'
                  : roadUnverified.has(job.workOrderId)
                    ? 'A complete driving route could not be verified. Road access or the routing service may be unavailable; the task remains unplanned pending a later verification.'
                    : 'No qualified crew with sufficient staff and remaining four-hour capacity in this plan.' }))
          res.json({ date, routes, unplanned });
          return;
        }

        case '/api/ops/work-orders': {
          // The handler sees one path for both verbs, so a create is distinguished by carrying a
          // body — the same convention `LocationRoutes` uses for `/api/locations`.
          if (req.body !== undefined && req.body !== null && Object.keys(req.body as object).length > 0) {
            const body = (req.body ?? {}) as CreateBody;
            // 8.1.3 — the cast below is a promise to the type system that the boundary has to keep.
            // Without this check an unknown task type travelled all the way to Postgres and came
            // back as a check-constraint violation, which the generic handler turned into a 500
            // telling the caller to retry. The valid values are listed, because a rejection that
            // does not say what would have been accepted makes the caller guess.
            const taskType = Object.values(TaskType).find((t) => t === body.taskType);
            if (taskType === undefined) {
              throw new WorkOrderRejected(
                `${String(body.taskType)} is not a task type (8.1.3) — one of: ${Object.values(TaskType).join(', ')}`,
              );
            }
            const pestType =
              body.pestType === undefined ? undefined : Object.values(PestType).find((p) => p === body.pestType);
            if (body.pestType !== undefined && pestType === undefined) {
              throw new WorkOrderRejected(
                `${String(body.pestType)} is not a pest type — one of: ${Object.values(PestType).join(', ')}`,
              );
            }
            const order = await this.dispatch.createWorkOrder(
              {
                // 8.1.2 — optional when a source report is supplied; the controller resolves it.
                ...(body.clusterId === undefined || body.clusterId === '' ? {} : { clusterId: body.clusterId }),
                taskType,
                ...(pestType === undefined ? {} : { pestType }),
                scheduledDate: body.scheduledDate ?? singaporeDate(new Date()),
                ...(body.instructions === undefined ? {} : { instructions: body.instructions }),
                ...(body.sourceReportId === undefined ? {} : { sourceReportId: body.sourceReportId }),
              },
              principal,
            );
            await this.workOrderEvents?.notify({ type: 'created', workOrderId: order.id, occurredAt: new Date() });
            res.status(201).json(WorkOrderRoutes.card(order));
            return;
          }
          // `managerView`, not `crewView`: the latter reads findForAssignee(by.accountId) and
          // would hand a manager the orders assigned to them, which is none of them.
          const status = Object.values(WorkOrderStatus).find((s) => s === req.params.status);
          const crewId = req.params.crewId;
          const all = await this.dispatch.managerView(principal, {
            ...(status === undefined ? {} : { status }),
            ...(crewId === undefined ? {} : { crewId }),
          });
          res.json({ workOrders: all.map((o) => WorkOrderRoutes.card(o)) });
          return;
        }

        case '/api/ops/work-orders/crew-workload': {
          // 8.2.5 — the manager needs the load before choosing, not after. Sourced from the staff
          // list so a crew member with zero open orders still appears; deriving the roster from
          // the work orders themselves would hide exactly the person they should assign to.
          const crew = await this.staff.assignableCrew(principal);
          const workload = await this.dispatch.crewWorkload(crew.map((c) => c.id));
          res.json({
            crew: crew.map((member: Account) => ({
              crewId: member.id,
              email: member.email,
              isActive: member.isActive,
              specialisation: member.specialisation, // null = not recorded, so not dispatchable
              openWorkOrders: workload.find((w) => w.crewId === member.id)?.openWorkOrders ?? 0,
            })),
          });
          return;
        }

        case '/api/ops/work-orders/:id': {
          const order = await this.dispatch.managerDetail(id, principal);
          if (order === null) {
            res.status(404).json({ error: 'no such work order', remedy: 'check the identifier' });
            return;
          }
          // 8.3.x — the audited history lives in the audit trail (2.4.1), not on the entity, so
          // the detail carries the order and the client reads history from the audit endpoint. The
          // entity deliberately keeps no second copy: two records of who moved it would eventually
          // disagree, and the audited one is the one that may not be edited.
          // 8.3.6 — and the evidence, so the screen that verifies a completion can show what is
          // being verified. Fetched here rather than on a second endpoint because a manager who
          // opens this screen always wants it: there is no state in which they would rather see
          // the buttons without the photographs.
          const evidence = await this.dispatch.completionEvidence(id, principal);
          res.json({
            workOrder: WorkOrderRoutes.card(order),
            // Who may take it, ranked by StaffRoutingPolicy, and who may not with the reason. The
            // screen renders this and decides nothing itself.
            routing: await this.dispatch.routingFor(id, principal),
            evidence:
              evidence === null
                ? null
                : {
                    notes: evidence.notes,
                    completedAt: evidence.completedAt,
                    taskPerformed: evidence.taskPerformed,
                    rejectionReason: evidence.rejectionReason,
                    // Keys, not URLs. A link is minted per photograph by `ImageRoutes`, expires,
                    // and is never embedded in a payload that might be logged or cached (10.3.5).
                    photoKeys: evidence.photoKeys,
                  },
          });
          return;
        }

        case '/api/ops/work-orders/:id/assign': {
          const crewId = ((req.body ?? {}) as { crewId?: string }).crewId ?? '';
          // 8.2.1, 8.2.3 — the assignee must be someone who can actually hold the job.
          //
          // `DispatchController.assign` takes an `isActiveAccount` flag that defaults to TRUE, and
          // this route was not passing it — so the deactivation rule was enforced nowhere on the
          // HTTP path. Nor was the role checked at all: assigning to a Resident returned 200 and
          // set `assigneeId`, after which the order was invisible to everyone. The Resident is
          // refused /api/crew/work-orders, so nobody could ever accept it and it would not appear
          // on the workload screen either. It simply stopped existing operationally.
          //
          // Checked against `assignableCrew` rather than by re-deriving the rule here: that is the
          // same list the UI's dropdown is built from, so the API and the form cannot disagree
          // about who is assignable — and it already means "CleaningCrew AND active". Capability
          // is then checked inside `DispatchController.assign` (StaffRoutingPolicy).
          //
          // Refused here with its own message rather than by handing `false` down as
          // `isActiveAccount`: that would report a Resident as "a deactivated account", which is
          // both untrue and unhelpful to whoever has to work out what went wrong.
          const assignable = await this.staff.assignableCrew(principal);
          if (!assignable.some((member: Account) => member.id === crewId)) {
            throw new WorkOrderRejected(
              'the assignee must be an active member of the cleaning crew (8.2.1, 8.2.3)',
            );
          }
          const order = await this.dispatch.assign(id, crewId, principal, true);
          await this.workOrderEvents?.notify({ type: 'dispatched', workOrderId: order.id, occurredAt: new Date() });
          res.json(WorkOrderRoutes.card(order));
          return;
        }

        case '/api/ops/work-orders/:id/cancel': {
          const reason = ((req.body ?? {}) as { reason?: string }).reason ?? '';
          res.json(WorkOrderRoutes.card(await this.dispatch.cancel(id, reason, principal)));
          return;
        }

        case '/api/ops/work-orders/:id/verify': {
          // 8.4.x — verification produces a TreatmentRecord, which is what 4.1.16's
          // days-since-last-treatment driver reads. Returning it makes that visible rather than
          // leaving the manager to wonder whether anything happened.
          const record = await this.lifecycle.verify(id, principal);
          res.json({ workOrderId: id, treatmentRecordId: record.id, completionDate: record.completionDate });
          return;
        }

        case '/api/ops/work-orders/:id/reject': {
          const reason = ((req.body ?? {}) as { reason?: string }).reason ?? '';
          res.json(WorkOrderRoutes.card(await this.lifecycle.rejectCompletion(id, reason, principal)));
          return;
        }

        default:
          res.status(404).json({ error: 'no such route', remedy: 'check the path' });
      }
    } catch (error) {
      if (error instanceof DuplicateWorkOrder) {
        // 8.1.12 — hand back the order that blocked it, so the manager can open it directly.
        res.status(409).json({
          error: error.message,
          remedy: 'open the existing work order, or cancel it before raising another',
          existing: WorkOrderRoutes.card(error.existing),
        });
        return;
      }
      if (error instanceof TransitionRefused) {
        // 8.3.16 — say which rule refused and what state the order is actually in.
        res.status(422).json({ error: error.reason, remedy: `the work order is ${error.from}` });
        return;
      }
      if (error instanceof WorkOrderRejected) {
        // 10.5.3 — the control layer has already phrased this for the manager who typed it.
        res.status(400).json({ error: error.reason, remedy: 'correct the details and try again' });
        return;
      }
      if (error instanceof WorkOrderNotFound) {
        // Not 400: there is nothing to correct in a request that names something which is not there.
        res.status(404).json({ error: error.what, remedy: 'check the identifier, or reload the list' });
        return;
      }
      this.fail(res, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** One shape for a work order wherever it appears, so a list row and a detail agree. */
  private static card(order: WorkOrder): Record<string, unknown> {
    return {
      id: order.id,
      clusterId: order.clusterId, // null for a report-only job (8.1.2)
      location: order.location ?? 'Singapore',
      // The source report's own point; null for a cluster-only job.
      point: WorkOrderRoutes.point(order),
      assigneeId: order.assigneeId,
      taskType: order.taskType,
      pestType: order.pestType, // null = unknown legacy pest; not assignable
      status: order.currentStatus(),
      scheduledDate: order.scheduledDate,
      priority: order.priority,
      priorityBasis: order.priorityBasis(),
      instructions: order.instructions,
      sourceReportId: order.sourceReportId,
      issueFlag: order.issueFlag,
      issueReason: order.issueReason,
      cancellationReason: order.cancellationReason,
      createdAt: order.createdAt,
      verifiedAt: order.verifiedAt,
    };
  }

  /** Shared with `CrewRoutes`, so both cards carry the same point shape. */
  static point(order: WorkOrder): { latitude: number; longitude: number } | null {
    return order.targetPoint === null
      ? null
      : { latitude: order.targetPoint.latitude, longitude: order.targetPoint.longitude };
  }
}
