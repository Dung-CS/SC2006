/**
 * @vitest-environment jsdom
 *
 * T5 item 4 — the Dispatches list replaces the Work Order List: one row per saved dispatch, plus a
 * "Not in a dispatch" section so assigned orders outside any dispatch do not disappear.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { principalFor } from '../src/control/DashboardController';
import { Principal } from '../src/control/Principal';
import { Role } from '../src/entity/enums';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { DispatchListScreen } from '../client/src/screens/operations/DispatchListScreen';
import { WorkOrderListScreen } from '../client/src/screens/operations/WorkOrderListScreen';
import { matchRoute } from '../client/src/app/routes';
import { dispatchFixture } from './helpers/dispatchFixture';

afterEach(() => cleanup());
const MANAGER = principalFor(Role.OperationsManager, 'manager-1');
const screenProps = (fetcher: Fetcher, onNavigate = vi.fn()) => ({ api: new ApiClient('', fetcher), params: {},
  principal: { accountId: 'm', role: Role.OperationsManager }, onNavigate, onPrincipalChange: vi.fn() });

describe('DispatchListController.between', () => {
  it('lists dispatches in the range newest first and keeps assigned orders outside a dispatch', async () => {
    const f = await dispatchFixture();
    const all = await f.list.between('2000-01-01', '2100-01-01', MANAGER);
    expect(all.dispatches.map((row) => row.id)).toEqual(['da-new', 'da-old']);
    expect(all.notInDispatch.map((row) => row.id)).toEqual(['legacy']);
    const future = await f.list.between('2099-01-01', '2099-12-31', MANAGER);
    expect(future.dispatches.map((row) => row.id)).toEqual(['da-new']);
    expect(future.notInDispatch).toEqual([]);
  });

  it('refuses a non-manager and a reversed range', async () => {
    const f = await dispatchFixture();
    await expect(f.list.between('2000-01-01', '2100-01-01', new Principal('crew-1', Role.CleaningCrew, 's'))).rejects.toThrow(/not authorised/);
    await expect(f.list.between('2100-01-01', '2000-01-01', MANAGER)).rejects.toThrow(/valid date range/);
  });
});

describe('DispatchListScreen', () => {
  it('renders rows with crew links, vehicle, stops and the Not in a dispatch section; filters by status', async () => {
    const f = await dispatchFixture();
    const body = await f.list.between('2000-01-01', '2100-01-01', MANAGER);
    const urls: string[] = [];
    const fetcher: Fetcher = async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => body } as Response; };
    render(<DispatchListScreen {...screenProps(fetcher)} />);
    await waitFor(() => expect(document.querySelector('[data-entity-id="da-new"]')).toBeTruthy());
    expect(urls[0]).toMatch(/^\/api\/ops\/dispatches\?from=\d{4}-\d{2}-\d{2}$/);
    const row = document.querySelector('[data-entity-id="da-new"]')!;
    expect(row.textContent).toContain('Toyota Hiace - GBC 4821 K');
    expect(row.querySelector('a[href="/ops/staff/crew-2"]')?.textContent).toBe('Ah Seng');
    expect(row.querySelector('summary')?.textContent).toBe('2 stops');
    expect([...row.querySelectorAll('ol a')].map((a) => a.getAttribute('href'))).toEqual(['/ops/work-orders/b', '/ops/work-orders/a']);
    expect(row.querySelector('[data-part="score-breakdown"]')).toBeNull();
    expect(screen.getByText('Not in a dispatch')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Completed' } });
    expect(document.querySelector('[data-entity-id="da-new"]')).toBeNull();
    expect(document.querySelector('[data-entity-id="da-old"]')).toBeTruthy();
  });

  it('the old work-order list path redirects to dispatches; detail pages stay', () => {
    const onNavigate = vi.fn();
    render(<WorkOrderListScreen {...screenProps(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response, onNavigate)} />);
    expect(onNavigate).toHaveBeenCalledWith('/ops/dispatches');
    expect(matchRoute('/ops/dispatches')?.route.screenId).toBe('DispatchList');
    expect(matchRoute('/ops/work-orders/abc')?.route.screenId).toBe('WODetail');
    expect(matchRoute('/ops/staff/abc')?.route.screenId).toBe('CrewDetail');
  });
});
