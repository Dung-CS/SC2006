/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffAccountsScreen } from '../client/src/screens/operations/StaffAccountsScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { HqLocation, Role, StaffSpecialisation, StaffStatus } from '../src/entity/enums';

afterEach(cleanup);

describe('Recorded staff profile', () => {
  it('shows the recorded human name and saves names/notes without changing readiness or login identity', async () => {
    let member = { id: 'crew-1', email: 'demo-crew-1@example.test', displayName: 'Siti Rahman',
      profileDescription: 'Illustrative staff profile.', role: Role.CleaningCrew, isActive: true,
      hqLocation: HqLocation.Central, specialisation: StaffSpecialisation.Sanitation,
      staffStatus: StaffStatus.Available, onCallLagHours: 0 };
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetcher: Fetcher = async (url, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        calls.push({ url, body });
        member = { ...member, ...body };
        return { ok: true, status: 200, json: async () => member } as Response;
      }
      const body = url.includes('crew-workload') ? { crew: [{ crewId: member.id, openWorkOrders: 0 }] } : { staff: [member] };
      return { ok: true, status: 200, json: async () => body } as Response;
    };
    render(<StaffAccountsScreen api={new ApiClient('', fetcher)} params={{}}
      principal={{ accountId: 'manager', role: Role.OperationsManager }} onNavigate={vi.fn()} />);
    expect(await screen.findByText('Siti Rahman')).toBeTruthy();
    const card = document.querySelector('article[data-entity-id="crew-1"]')!;
    expect(card.querySelector('[data-part="entity-title"]')?.textContent).toBe('Siti Rahman');
    fireEvent.click(screen.getByText('Staff record'));
    fireEvent.change(screen.getByLabelText('Recorded name for demo-crew-1@example.test'), { target: { value: 'Siti Tan' } });
    fireEvent.change(screen.getByLabelText('Staff notes for demo-crew-1@example.test'), { target: { value: 'Illustrative named crew profile.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(calls).toEqual([{ url: '/api/ops/staff/crew-1/display-name',
      body: { displayName: 'Siti Tan', profileDescription: 'Illustrative named crew profile.' } }]));
    expect(await screen.findByText('Siti Tan')).toBeTruthy();
    expect(member.email).toBe('demo-crew-1@example.test');
    expect(member.staffStatus).toBe(StaffStatus.Available);
  });
});
