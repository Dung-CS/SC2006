/** T6 - the dispatch list is linked in server.ts, and both endpoints answer a manager through the real route classes. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AdminRoutes } from '../src/boundary/http/AdminRoutes';
import { WorkOrderRoutes } from '../src/boundary/http/WorkOrderRoutes';
import { Request, Response } from '../src/boundary/http/RouteHandler';
import { principalFor } from '../src/control/DashboardController';
import { Role } from '../src/entity/enums';
import { dispatchFixture } from './helpers/dispatchFixture';

const MANAGER = principalFor(Role.OperationsManager, 'manager-1');
const call = async (routes: AdminRoutes | WorkOrderRoutes, route: string, params: Record<string, string> = {}) => {
  const res = { code: 200, body: undefined as any, status(code: number) { res.code = code; return res; }, json(body: unknown) { res.body = body; }, text() {} };
  const req = { headers: { authorization: 'Bearer mgr' }, params: { route, ...params }, body: undefined } as unknown as Request;
  await routes.handle(req, res as unknown as Response);
  return res;
};

describe('dispatch list wiring', () => {
  it('server.ts links the dispatch list to the staff controller', () => {
    expect(readFileSync('src/server.ts', 'utf8')).toContain('staff.linkDispatches(new DispatchListController(ac, assignmentUnit));');
  });

  it('serves GET /api/ops/dispatches and GET /api/ops/staff/:id to a manager', async () => {
    const f = await dispatchFixture();
    const resolver = { resolve: async (token: string) => (token === 'mgr' ? MANAGER : null) };
    const admin = new AdminRoutes(f.ac, f.staff);
    const orders = new WorkOrderRoutes(f.ac, null as never, null as never, f.staff);
    admin.useResolver(resolver);
    orders.useResolver(resolver);
    const list = await call(orders, '/api/ops/dispatches', { from: '2000-01-01', to: '2100-01-01' });
    expect(list.code).toBe(200);
    expect(list.body.dispatches.map((row: { id: string }) => row.id)).toEqual(['da-new', 'da-old']);
    expect(list.body.dispatches[0].crew.map((member: { id: string }) => member.id)).toEqual(['crew-1', 'crew-2']);
    const detail = await call(admin, '/api/ops/staff/:id', { id: 'crew-2' });
    expect(detail.code).toBe(200);
    expect(detail.body.dispatches.map((row: { id: string }) => row.id)).toContain('da-new');
  });
});
