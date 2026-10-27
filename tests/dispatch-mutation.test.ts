import { describe, expect, it } from 'vitest';
import type { Server, AddressInfo } from 'node:net';
import { ExpressApp } from '../src/boundary/http/ExpressApp';
import { RouteHandler, Request, Response } from '../src/boundary/http/RouteHandler';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { InMemoryAuditStore } from '../src/persistence/memory/InMemoryStores';

class Mutations extends RouteHandler {
  routes() { return ['/api/probe/read']; }
  override writeRoutes() { return ['/api/probe/save', '/api/probe/reject', '/api/auth/signin']; }
  async handle(req: Request, res: Response) {
    res.status(req.params.route === '/api/probe/reject' ? 400 : 200).json({ ok: true });
  }
}

describe('Dispatch source-change invalidation over HTTP', () => {
  it('invalidates after successful data writes, excluding reads, authentication and refused writes', async () => {
    const app = new ExpressApp();
    let changes = 0;
    app.onSuccessfulMutation(() => { changes++; });
    app.mount(new Mutations(new AccessControlService(new AccessPolicy(), new InMemoryAuditStore())));
    const express = (app as unknown as { app: { listen: (port: number, callback: () => void) => Server } }).app;
    const server = await new Promise<Server>((done) => { const listening = express.listen(0, () => done(listening)); });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      await fetch(base + '/api/probe/read');
      await fetch(base + '/api/auth/signin', { method: 'POST' });
      await fetch(base + '/api/probe/reject', { method: 'POST' });
      expect(changes).toBe(0);
      await fetch(base + '/api/probe/save', { method: 'POST' });
      expect(changes).toBe(1);
    } finally { await new Promise<void>((done) => server.close(() => done())); }
  });
});
