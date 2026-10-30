/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DispatchProposalScreen } from '../client/src/screens/operations/DispatchProposalScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { MapTask } from '../client/src/components/SingaporeMap';
import { Role } from '../src/entity/enums';

const planned = { id: 'plan:1', location: 'Bedok North', assignmentState: 'planned', teamLabel: 'Team A', priority: 3,
  latitude: 1.3, longitude: 103.9, scoreExplanation: undefined } as unknown as MapTask;

vi.mock('../client/src/components/SingaporeMap', () => ({
  SingaporeMap: ({ onTaskDetail }: { onTaskDetail: (task: MapTask) => void }) =>
    <button type="button" onClick={() => onTaskDetail(planned)}>Open task</button>,
}));

const seen: Array<{ candidates: Array<{ taskType?: string; pestType?: string }> }> = [];
vi.mock('../client/src/components/DispatchAssignmentEditor', async (original) => ({
  ...(await original<object>()),
  SavedDispatches: (props: { candidates: Array<{ taskType?: string; pestType?: string }> }) => { seen.push(props); return null; },
}));

// jsdom lacks showModal/close; emulate them, including the close event.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
});
afterEach(cleanup);

describe('open task dialog', () => {
  it('opens a modal dialog for a planned task and closes it', async () => {
    const fetcher: Fetcher = async () => ({ ok: true, status: 200, json: async () => ({ proposals: [], plans: [], unassigned: [] }) } as Response);
    const api = new ApiClient('', fetcher);
    api.setToken('t');
    render(<DispatchProposalScreen api={api} params={{}} principal={{ accountId: 'm', role: Role.OperationsManager }} onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('Bedok North');
    fireEvent.click(screen.getByRole('button', { name: 'Close task' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('passes task type and pest to the add-task candidates', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const horizon = { startDate: today, days: 7, planStatus: 'ready', plans: [{ date: today, routes: [],
      unplanned: [{ workOrderId: 'w9', locality: 'Bishan', taskType: 'Fogging', pestType: 'Mosquito', reason: 'x' }] }], unassigned: [] };
    const fetcher: Fetcher = async (url) => ({ ok: true, status: 200,
      json: async () => url.startsWith('/api/ops/dispatch/horizon') ? horizon : { proposals: [] } } as Response);
    const api = new ApiClient('', fetcher);
    api.setToken('t');
    render(<DispatchProposalScreen api={api} params={{}} principal={{ accountId: 'm', role: Role.OperationsManager }} onNavigate={vi.fn()} />);
    await waitFor(() => expect(seen.some((p) => p.candidates.some((c) => c.taskType === 'Fogging' && c.pestType === 'Mosquito'))).toBe(true));
  });
});
