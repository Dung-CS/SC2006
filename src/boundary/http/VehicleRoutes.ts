import { VehicleController, VehicleNotFound, VehicleRejected } from '../../control/VehicleController';
import { AccessControlService } from '../../control/AccessControlService';
import { Request, Response, RouteHandler } from './RouteHandler';

export class VehicleRoutes extends RouteHandler {
  constructor(ac: AccessControlService, private readonly vehicles: VehicleController) { super(ac); }
  routes(): string[] { return ['/api/ops/vehicles']; }
  override writeRoutes(): string[] { return ['/api/ops/vehicles', '/api/ops/vehicles/:id']; }
  async handle(req: Request, res: Response): Promise<void> {
    try {
      const by = await this.resolvePrincipal(req);
      if (req.params.route === '/api/ops/vehicles/:id') {
        if (!req.params.id) throw new VehicleNotFound('vehicle not found');
        res.json({ vehicle: await this.vehicles.save(req.body, by, req.params.id ?? '') });
      } else if (req.body && Object.keys(req.body as object).length > 0) {
        res.status(201).json({ vehicle: await this.vehicles.save(req.body, by) });
      } else {
        res.json({ vehicles: await this.vehicles.list(by) });
      }
    } catch (error) {
      if (error instanceof VehicleRejected || error instanceof VehicleNotFound) {
        res.status(error instanceof VehicleNotFound ? 404 : 400).json({ error: error.message,
          remedy: error instanceof VehicleNotFound ? 'Refresh the registry and select an existing vehicle.' : 'Correct the vehicle details and try again.' });
        return;
      }
      this.fail(res, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
