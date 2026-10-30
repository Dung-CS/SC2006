/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DispatchAssignmentEditor, SavedDispatches } from '../client/src/components/DispatchAssignmentEditor';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';

afterEach(cleanup);
const options = { crew: [{ id: 'crew-1', email: 'crew-1@example.test' }], vehicles: [{ id: 'van-1', name: 'Van', registration: 'SGX1' }], requiredStaff: 1, computedAt: 'at' };

function api(replies: Record<string, object>) {
  const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetcher: Fetcher = async (url, init) => {
    if (init?.method === 'POST') posts.push({ url, body: JSON.parse(String(init.body)) });
    const key = Object.keys(replies).find((prefix) => url.startsWith(prefix));
    return { ok: true, status: 200, json: async () => (key ? replies[key] : {}) } as Response;
  };
  const client = new ApiClient('', fetcher);
  client.setToken('test-manager');
  return { client, posts };
}

describe('dispatch assignment editor', () => {
  it('sends the reordered, trimmed and extended stop list with the assign request', async () => {
    const { client, posts } = api({ '/api/ops/dispatch/assignment-options': options, '/api/ops/dispatch/assign': { id: 'saved', workOrderIds: ['c', 'b'] } });
    const onAssigned = vi.fn();
    render(<DispatchAssignmentEditor api={client} date="2099-01-01" teamId="Central-VectorControl-Available" proposedCrewIds={['crew-1']} proposedVehicleId="van-1"
      stops={[{ workOrderId: 'a', label: 'Stop A' }, { workOrderId: 'b', label: 'Stop B' }]} candidates={[{ workOrderId: 'c', label: 'Stop C' }]} onAssigned={onAssigned} />);
    fireEvent.click(screen.getByText('Choose crew and vehicle'));
    await screen.findByText('Assign dispatch');
    fireEvent.click(screen.getByLabelText('Remove Stop A'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    fireEvent.click(screen.getByLabelText('Move Stop C up'));
    fireEvent.click(screen.getByText('Assign dispatch'));
    await waitFor(() => expect(onAssigned).toHaveBeenCalledWith({ id: 'saved', workOrderIds: ['c', 'b'] }));
    expect(posts[0]).toMatchObject({ url: '/api/ops/dispatch/assign', body: { workOrderIds: ['c', 'b'], crewIds: ['crew-1'], vehicleId: 'van-1', computedAt: 'at' } });
  });

  it('raises the crew minimum when a Fogging stop is added, using the server rule', async () => {
    const { client } = api({ '/api/ops/dispatch/assignment-options': { ...options, stopStaff: { a: 1, f: 3 } } });
    render(<DispatchAssignmentEditor api={client} date="2099-01-01" teamId="t" proposedCrewIds={['crew-1']} proposedVehicleId="van-1"
      stops={[{ workOrderId: 'a', label: 'Stop A' }]} candidates={[{ workOrderId: 'f', label: 'Fogging F' }]} onAssigned={vi.fn()} />);
    fireEvent.click(screen.getByText('Choose crew and vehicle'));
    await screen.findByText(/at least 1/);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(await screen.findByText(/at least 3/)).toBeTruthy();
    expect((screen.getByText('Assign dispatch') as HTMLButtonElement).disabled).toBe(true);
  });

  it('names a saved dispatch by HQ and crew, not by raw team id', async () => {
    const saved = { id: 'd2', teamId: 'Central-VectorControl-Available', crewIds: ['crew-1'], vehicleId: 'van-1', workOrderIds: ['a'], status: 'Assigned',
      crew: [{ id: 'crew-1', email: 'crew-1@example.test', displayName: 'Ali Tan' }],
      routeSnapshot: { depotLocation: 'Central', waypointOrder: [{ workOrderId: 'a', label: 'Stop 1', locality: 'Bishan' }] } };
    const { client } = api({ '/api/ops/dispatch/assignments': { assignments: [saved] } });
    render(<SavedDispatches api={client} date="2099-01-01" candidates={[]} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText('Show saved dispatches'));
    expect((await screen.findByText(/Central HQ/)).textContent).toMatch(/Ali Tan/);
    expect(screen.queryByText('Central-VectorControl-Available')).toBeNull();
  });

  it('opens a saved dispatch in the same editor and posts the edit; flags a pending road check', async () => {
    const saved = { id: 'd1', teamId: 'Central-VectorControl-Available', crewIds: ['crew-1'], vehicleId: 'van-1', workOrderIds: ['a'], status: 'Assigned', needsRoadCheck: true,
      routeSnapshot: { waypointOrder: [{ isHq: true, label: 'HQ' }, { workOrderId: 'a', label: 'Stop 1', locality: 'Stop A' }] } };
    const { client, posts } = api({ '/api/ops/dispatch/assignments': { assignments: [saved] }, '/api/ops/dispatch/assignment-options': options,
      '/api/ops/dispatch/assignment-edit': { id: 'd1', workOrderIds: ['a'] } });
    render(<SavedDispatches api={client} date="2099-01-01" candidates={[]} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText('Show saved dispatches'));
    expect((await screen.findByRole('note')).textContent).toMatch(/Road check needed/);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit this dispatch'));
    fireEvent.click(await screen.findByText('Save changes'));
    await waitFor(() => expect(posts[0]).toMatchObject({ url: '/api/ops/dispatch/assignment-edit',
      body: { assignmentId: 'd1', workOrderIds: ['a'], crewIds: ['crew-1'], vehicleId: 'van-1' } }));
  });
});
