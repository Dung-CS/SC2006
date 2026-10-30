import { RouteHandler, Request, Response } from './RouteHandler';
import { AccessControlService } from '../../control/AccessControlService';
import { DispatchAssignmentRejected, DispatchAssignmentService } from '../../control/DispatchAssignmentService';
import { DuplicateWorkOrder, WorkOrderRejected, WorkOrderNotFound } from '../../control/DispatchController';
import { TransitionRefused } from '../../control/WorkOrderLifecycleController';
import { singaporeDate } from '../../entity/valueTypes';

export class DispatchAssignmentRoutes extends RouteHandler {
  constructor(ac: AccessControlService, private readonly service: DispatchAssignmentService) { super(ac); }
  routes(): string[] { return ['/api/ops/dispatch/assignment-options', '/api/ops/dispatch/assignments']; }
  override writeRoutes(): string[] { return ['/api/ops/dispatch/assign', '/api/ops/dispatch/assignment-edit']; }
  async handle(req: Request, res: Response): Promise<void> {
    try {
      const by = await this.resolvePrincipal(req);
      switch (req.params.route) {
        case '/api/ops/dispatch/assignment-options':
          res.json(await this.service.options(req.params.date ?? singaporeDate(new Date()), req.params.teamId ?? '', by,
            req.params.assignmentId || undefined)); return;
        case '/api/ops/dispatch/assignments':
          res.json({ assignments: await this.service.list(req.params.date ?? singaporeDate(new Date()), by) }); return;
        case '/api/ops/dispatch/assign': {
          const body = req.body as Record<string, unknown> | null;
          if (!body || typeof body.date !== 'string' || typeof body.teamId !== 'string' || !Array.isArray(body.crewIds) ||
            typeof body.vehicleId !== 'string' || body.computedAt !== undefined && typeof body.computedAt !== 'string' ||
            body.workOrderIds !== undefined && !Array.isArray(body.workOrderIds)) {
            throw new DispatchAssignmentRejected('Choose a dispatch date, crew members and a vehicle.', 400);
          }
          res.json(await this.service.assign({ date: body.date, teamId: body.teamId, crewIds: body.crewIds as string[],
            vehicleId: body.vehicleId, computedAt: body.computedAt as string | undefined,
            ...(body.workOrderIds ? { workOrderIds: body.workOrderIds as string[] } : {}) }, by)); return;
        }
        case '/api/ops/dispatch/assignment-edit': {
          const body = req.body as Record<string, unknown> | null;
          if (!body || typeof body.date !== 'string' || typeof body.assignmentId !== 'string' || !Array.isArray(body.crewIds) ||
            typeof body.vehicleId !== 'string' || !Array.isArray(body.workOrderIds)) {
            throw new DispatchAssignmentRejected('Choose the saved dispatch, its tasks, crew members and a vehicle.', 400);
          }
          res.json(await this.service.edit({ date: body.date, assignmentId: body.assignmentId, crewIds: body.crewIds as string[],
            vehicleId: body.vehicleId, workOrderIds: body.workOrderIds as string[] }, by)); return;
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
