/**
 * @vitest-environment jsdom
 *
 * T5 — crew member detail: every stored profile field plus every dispatch the person is on
 * (saved DispatchAssignments and legacy single-crew orders), manager only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { principalFor } from '../src/control/DashboardController';
import { Principal } from '../src/control/Principal';
import { AdminRoutes } from '../src/boundary/http/AdminRoutes';
import { Request, Response } from '../src/boundary/http/RouteHandler';
import { HqLocation, Role, StaffSpecialisation, StaffStatus } from '../src/entity/enums';
import { dispatchFixture } from './helpers/dispatchFixture';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { CrewDetailScreen } from '../client/src/screens/operations/CrewDetailScreen';

afterEach(() => cleanup());

const MANAGER = principalFor(Role.OperationsManager, 'manager-1');
const CREW = new Principal('crew-1', Role.CleaningCrew, 'session-crew');

function response(): Response & { code: number; body: any } {
  const res = { code: 200, body: undefined as any, status(code: number) { res.code = code; return res; }, json(body: unknown) { res.body = body; }, text() {} };
  return res;
}
const req = (id: string, token = 'mgr'): Request => ({ headers: { authorization: `Bearer ${token}` }, params: { route: '/api/ops/staff/:id', id }, body: undefined });

describe('GET /api/ops/staff/:id', () => {
  it('returns every stored profile field and both dispatches plus the legacy order, newest first', async () => {
    const f = await dispatchFixture();
    const routes = new AdminRoutes(f.ac, f.staff);
    routes.useResolver({ resolve: async (t) => (t === 'mgr' ? MANAGER : t === 'crew' ? CREW : null) });
    const res = response();
    await routes.handle(req('crew-1'), res);
    expect(res.code).toBe(200);
    expect(res.body.staff).toMatchObject({ id: 'crew-1', email: 'crew-1@example.test', displayName: 'Siti Tan', role: Role.CleaningCrew,
      hqLocation: HqLocation.Central, staffStatus: StaffStatus.Available, onCallLagHours: 1, specialisation: StaffSpecialisation.VectorControl,
      profileDescription: 'Fogging lead', isActive: true });
    expect(res.body.staff.passwordHash).toBeUndefined();
    const rows = res.body.dispatches;
    expect(rows.map((r: any) => [r.id, r.inDispatch, r.status])).toEqual([
      ['da-new', true, 'Assigned'], ['legacy', false, 'Assigned'], ['da-old', true, 'Completed']]);
    expect(rows[0].stops.map((s: any) => s.workOrderId)).toEqual(['b', 'a']);
    expect(rows[0].crew.map((c: any) => c.displayName)).toEqual(['Siti Tan', 'Ah Seng']);
    expect(rows[0].vehicle).toMatchObject({ model: 'Toyota Hiace', registration: 'GBC 4821 K' });
    expect(rows[0].hqLocation).toBe('Central HQ');
  });

  it('refuses a non-manager', async () => {
    const f = await dispatchFixture();
    const routes = new AdminRoutes(f.ac, f.staff);
    routes.useResolver({ resolve: async (t) => (t === 'mgr' ? MANAGER : t === 'crew' ? CREW : null) });
    const res = response();
    await routes.handle(req('crew-1', 'crew'), res);
    expect(res.code).toBe(403);
    expect(res.body.dispatches).toBeUndefined();
    await expect(f.staff.staffDetail('crew-1', CREW)).rejects.toThrow(/not authorised/);
  });
});

describe('CrewDetailScreen', () => {
  it('renders the details, then upcoming and past dispatches with stops linking to work orders', async () => {
    const f = await dispatchFixture();
    const detail = await f.staff.staffDetail('crew-1', MANAGER);
    const body = { staff: { ...detail.account, createdAt: '2026-01-02T00:00:00.000Z' }, dispatches: detail.dispatches };
    const fetcher: Fetcher = async (url) => ({ ok: url === '/api/ops/staff/crew-1', status: url === '/api/ops/staff/crew-1' ? 200 : 404,
      json: async () => body }) as unknown as globalThis.Response;
    render(<CrewDetailScreen api={new ApiClient('', fetcher)} params={{ id: 'crew-1' }} principal={{ accountId: 'm', role: Role.OperationsManager }}
      onNavigate={vi.fn()} onPrincipalChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Upcoming dispatches')).toBeTruthy());
    expect(screen.getByText('Past dispatches')).toBeTruthy();
    expect(screen.getByText('Fogging lead')).toBeTruthy();
    const upcoming = document.querySelector('[data-part="upcoming-dispatches"]')!;
    const past = document.querySelector('[data-part="past-dispatches"]')!;
    expect(upcoming.querySelectorAll('[data-part="dispatch-row"]').length).toBe(2);
    expect(past.querySelector('[data-entity-id="da-old"]')).toBeTruthy();
    expect(upcoming.textContent).toContain('Toyota Hiace - GBC 4821 K');
    expect(upcoming.querySelector('a[href="/ops/staff/crew-2"]')?.textContent).toBe('Ah Seng');
    expect(upcoming.querySelector('a[href="/ops/staff/crew-1"]')).toBeNull();
    expect(upcoming.querySelector('a[href="/ops/work-orders/b"]')).toBeTruthy();
  });
});
