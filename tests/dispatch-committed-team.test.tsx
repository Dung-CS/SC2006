/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { DispatchProposalScreen } from '../client/src/screens/operations/DispatchProposalScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { MapTask } from '../client/src/components/SingaporeMap';
import { Role } from '../src/entity/enums';

vi.mock('../client/src/components/SingaporeMap', () => ({
  SingaporeMap: ({ tasks = [] }: { tasks: MapTask[] }) =>
    <div>{tasks.map((task) => <p key={task.id} data-task-id={task.id} data-state={task.assignmentState}>{task.teamLabel ?? 'none'}</p>)}</div>,
}));
afterEach(cleanup);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

describe('committed task team', () => {
  it('shows crew names and vehicle for a committed task from its saved dispatch', async () => {
    const route = { teamId: 'T1', depotLocation: 'Central', status: 'Available', onCallLagHours: 0, workOrderIds: [], waypointOrder: [],
      crewMembers: [{ id: 'c1', email: 'ana.tan@x.sg', displayName: 'Ana Tan' }],
      route: { coordinates: [], distanceMetres: 0, durationSeconds: 0, source: 'estimate' }, packingList: [], color: '#000' };
    const fetcher: Fetcher = async (url) => {
      const body = url.startsWith('/api/ops/dispatch/horizon') ? { startDate: today, days: 7, planStatus: 'ready',
          plans: [{ date: today, routes: [route] }],
          unassigned: [{ workOrderId: 'w1', disposition: 'committed', reason: 'x', point: { latitude: 1.3, longitude: 103.8 } }] }
        : url.startsWith('/api/ops/dispatch/assignments') ? { assignments: [{ id: 'a1', teamId: 'T1', crewIds: ['c1'], vehicleId: 'v1', workOrderIds: ['w1'] }] }
        : url.startsWith('/api/ops/vehicles') ? { vehicles: [{ id: 'v1', model: 'Hilux', name: 'Van', registration: 'SGX1234' }] }
        : { date: today, proposals: [] };
      return { ok: true, status: 200, json: async () => body } as Response;
    };
    const api = new ApiClient('', fetcher);
    api.setToken('t');
    render(<DispatchProposalScreen api={api} params={{}} principal={{ accountId: 'm', role: Role.OperationsManager }} onNavigate={vi.fn()} />);
    fireEvent_unassignedTab();
    await waitFor(() => expect(document.querySelector('[data-task-id="w1"]')?.textContent).toContain('Ana Tan'));
    const label = document.querySelector('[data-task-id="w1"]')!;
    expect(label.textContent).toContain('Hilux - SGX1234');
    expect(label.getAttribute('data-state')).toBe('assigned');
  });
});

function fireEvent_unassignedTab(): void {
  screen.getByRole('button', { name: /Unassigned \/ committed/ }).click();
}
