import { RouteHandler, Request, Response } from './RouteHandler';
import { AccessControlService } from '../../control/AccessControlService';
import { DispatchAssignmentRejected, DispatchAssignmentService } from '../../control/DispatchAssignmentService';
import { DuplicateWorkOrder, WorkOrderRejected, WorkOrderNotFound } from '../../control/DispatchController';
import { TransitionRefused } from '../../control/WorkOrderLifecycleController';
import { singaporeDate } from '../../entity/valueTypes';
import type { ChecklistItem } from '../../ports/DispatchAssignmentStore';

export class DispatchAssignmentRoutes extends RouteHandler {
  constructor(ac: AccessControlService, private readonly service: DispatchAssignmentService) { super(ac); }
  routes(): string[] { return ['/api/ops/dispatch/assignment-options', '/api/ops/dispatch/assignments', '/api/crew/dispatch/checklist']; }
  override writeRoutes(): string[] { return ['/api/ops/dispatch/assign', '/api/ops/dispatch/assignment-edit', '/api/ops/dispatch/checklist/item', '/api/ops/dispatch/checklist/item/remove', '/api/crew/dispatch/checklist/toggle']; }
  async handle(req: Request, res: Response): Promise<void> {
    try {
      const by = await this.resolvePrincipal(req);
      switch (req.params.route) {
        case '/api/ops/dispatch/assignment-options':
          res.json(await this.service.options(req.params.date ?? singaporeDate(new Date()), req.params.teamId ?? '', by,
            req.params.assignmentId || undefined)); return;
        case '/api/ops/dispatch/assignments':
          res.json({ assignments: await this.service.list(req.params.date ?? singaporeDate(new Date()), by) }); return;
        case '/api/crew/dispatch/checklist':
          res.json(await this.service.crewDispatch(req.params.date ?? singaporeDate(new Date()), by)); return;
        case '/api/crew/dispatch/checklist/toggle': {
          const body = req.body as Record<string, unknown> | null;
          if (!body || typeof body.assignmentId !== 'string' || typeof body.itemId !== 'string' || typeof body.checked !== 'boolean') {
            throw new DispatchAssignmentRejected('Choose the assignment, item and checked state.', 400);
          }
          res.json({ checklist: await this.service.toggleChecklistItem(body.assignmentId, body.itemId, body.checked, by) }); return;
        }
        case '/api/ops/dispatch/checklist/item': {
          const body = req.body as Record<string, unknown> | null;
          if (!body || typeof body.assignmentId !== 'string' || typeof body.item !== 'string') {
            throw new DispatchAssignmentRejected('Choose the assignment and item name.', 400);
          }
          res.json({ checklist: await this.service.addChecklistItem(body.assignmentId, body.item, typeof body.quantity === 'string' ? body.quantity : undefined, by) }); return;
        }
        case '/api/ops/dispatch/checklist/item/remove': {
          const body = req.body as Record<string, unknown> | null;
          if (!body || typeof body.assignmentId !== 'string' || typeof body.itemId !== 'string') {
            throw new DispatchAssignmentRejected('Choose the assignment and item to remove.', 400);
          }
          res.json({ checklist: await this.service.removeChecklistItem(body.assignmentId, body.itemId, by) }); return;
        }
        case '/api/ops/dispatch/assign': {
          const body = req.body as Record<string, unknown> | null;
          if (!body || typeof body.date !== 'string' || typeof body.teamId !== 'string' || !Array.isArray(body.crewIds) ||
            typeof body.vehicleId !== 'string' || body.computedAt !== undefined && typeof body.computedAt !== 'string' ||
            body.workOrderIds !== undefined && !Array.isArray(body.workOrderIds)) {
            throw new DispatchAssignmentRejected('Choose a dispatch date, crew members and a vehicle.', 400);
          }
          res.json(await this.service.assign({ date: body.date, teamId: body.teamId, crewIds: body.crewIds as string[],
            vehicleId: body.vehicleId, computedAt: body.computedAt as string | undefined,
            ...(body.workOrderIds ? { workOrderIds: body.workOrderIds as string[] } : {}),
            ...(Array.isArray(body.checklist) ? { checklist: body.checklist as ChecklistItem[] } : {}) }, by)); return;
        }
        case '/api/ops/dispatch/assignment-edit': {
          const body = req.body as Record<string, unknown> | null;
          if (!body || typeof body.date !== 'string' || typeof body.assignmentId !== 'string' || !Array.isArray(body.crewIds) ||
            typeof body.vehicleId !== 'string' || !Array.isArray(body.workOrderIds)) {
            throw new DispatchAssignmentRejected('Choose the saved dispatch, its tasks, crew members and a vehicle.', 400);
          }
          res.json(await this.service.edit({ date: body.date, assignmentId: body.assignmentId, crewIds: body.crewIds as string[],
            vehicleId: body.vehicleId, workOrderIds: body.workOrderIds as string[],
            ...(Array.isArray(body.checklist) ? { checklist: body.checklist as ChecklistItem[] } : {}) }, by)); return;
        }
        default: res.status(404).json({ error: 'No such dispatch action.' });
      }
    } catch (error) {
      if (error instanceof DispatchAssignmentRejected || error instanceof DuplicateWorkOrder || error instanceof TransitionRefused ||
        error instanceof WorkOrderRejected || error instanceof WorkOrderNotFound) {
        res.status(error instanceof DispatchAssignmentRejected ? error.status : 409).json({ error: error.message,
          remedy: 'Refresh the dispatch and its assignment choices, then try again.' }); return;
      }
      this.fail(res, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
