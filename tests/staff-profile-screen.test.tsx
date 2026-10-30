/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffAccountsScreen } from '../client/src/screens/operations/StaffAccountsScreen';
import { CrewDetailScreen } from '../client/src/screens/operations/CrewDetailScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { HqLocation, Role, StaffSpecialisation, StaffStatus } from '../src/entity/enums';

afterEach(cleanup);

function setup() {
  let member: any = { id: 'crew-1', email: 'demo-crew-1@example.test', displayName: 'Siti Rahman',
    profileDescription: 'Illustrative staff profile.', role: Role.CleaningCrew, isActive: true,
    hqLocation: HqLocation.Central, specialisation: StaffSpecialisation.Sanitation,
    staffStatus: StaffStatus.Available, onCallLagHours: 0 };
  const calls: Array<{ url: string; body: any }> = [];
  const fetcher: Fetcher = async (url, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body });
      if (url.endsWith('/hq-location')) member = { ...member, hqLocation: body.hqLocation };
      else if (url.endsWith('/status')) member = { ...member, staffStatus: body.status };
      else if (url.endsWith('/specialisation')) member = { ...member, specialisation: body.specialisation };
      else if (url.endsWith('/deactivate')) member = { ...member, isActive: false };
      else if (url.endsWith('/display-name')) member = { ...member, ...body };
      return { ok: true, status: 200, json: async () => ({ sessionsEnded: 0 }) } as Response;
    }
    const body = url.includes('crew-workload') ? { crew: [{ crewId: member.id, openWorkOrders: 0 }] }
      : url === '/api/ops/staff' ? { staff: [member] } : { staff: member, dispatches: [] };
    return { ok: true, status: 200, json: async () => body } as Response;
  };
  const common = { api: new ApiClient('', fetcher), principal: { accountId: 'manager', role: Role.OperationsManager },
    onNavigate: vi.fn(), onPrincipalChange: vi.fn() };
  return { calls, common };
}

describe('Staff card summary and details-page edit controls', () => {
  it('the card shows name, HQ, crew type and status only, with no email, select or button', async () => {
    const { common } = setup();
    render(<StaffAccountsScreen {...common} params={{}} />);
    expect(await screen.findByText('Siti Rahman')).toBeTruthy();
    const card = document.querySelector('article[data-entity-id="crew-1"]') as HTMLElement;
    expect(card.querySelector('a[href="/ops/staff/crew-1"]')?.textContent).toBe('Siti Rahman');
    expect(card.querySelector('[data-part="hq"]')?.textContent).toBe('Central Regional Office');
    expect(card.querySelector('[data-part="crew-type"]')?.textContent).toBe('Sanitation');
    expect(card.querySelector('[data-part="status"]')?.textContent).toBe('Available');
    expect(card.textContent).not.toContain('demo-crew-1@example.test');
    expect(card.querySelectorAll('select, button, input, textarea, details').length).toBe(0);
  });

  it('the details page edits through the existing endpoints and reflects the saved value', async () => {
    const { common, calls } = setup();
    render(<CrewDetailScreen {...common} params={{ id: 'crew-1' }} />);
    const hq = await screen.findByLabelText('HQ location for demo-crew-1@example.test');
    fireEvent.change(hq, { target: { value: HqLocation.SouthWest } });
    await waitFor(() => expect(calls).toEqual([{ url: '/api/ops/staff/crew-1/hq-location', body: { hqLocation: HqLocation.SouthWest } }]));
    await waitFor(() => expect((screen.getByLabelText('HQ location for demo-crew-1@example.test') as HTMLSelectElement).value).toBe(HqLocation.SouthWest));
    fireEvent.change(screen.getByLabelText('Readiness status for demo-crew-1@example.test'), { target: { value: StaffStatus.Unavailable } });
    await waitFor(() => expect(calls[1]).toEqual({ url: '/api/ops/staff/crew-1/status', body: { status: StaffStatus.Unavailable } }));
    fireEvent.change(screen.getByLabelText('Capability for demo-crew-1@example.test'), { target: { value: StaffSpecialisation.VectorControl } });
    await waitFor(() => expect(calls[2]?.url).toBe('/api/ops/staff/crew-1/specialisation'));
    fireEvent.change(screen.getByLabelText('Recorded name for demo-crew-1@example.test'), { target: { value: 'Siti Tan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(calls[3]).toEqual({ url: '/api/ops/staff/crew-1/display-name',
      body: { displayName: 'Siti Tan', profileDescription: 'Illustrative staff profile.' } }));
  });

  it('the details page deactivates after confirmation', async () => {
    const { common, calls } = setup();
    render(<CrewDetailScreen {...common} params={{ id: 'crew-1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Deactivate demo-crew-1/ }));
    expect(screen.getByRole('dialog').textContent).toContain('even if they are recording work right now');
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(calls).toEqual([{ url: '/api/ops/staff/crew-1/deactivate', body: {} }]));
    expect(await screen.findByRole('button', { name: /Reactivate demo-crew-1/ })).toBeTruthy();
  });
});
