/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { ScreenProps } from '../client/src/screens/ScreenProps';
import { WorkOrderCreateScreen } from '../client/src/screens/operations/WorkOrderCreateScreen';
import { Role } from '../src/entity/enums';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('work-order creation pest identity', () => {
  it('uses the verified source report as the target and pest authority', async () => {
    window.history.replaceState({}, '', '/ops/work-orders/new?clusterId=c1&sourceReportId=r1&pestType=Termite');
    let payload: Record<string, unknown> | null = null;
    const fetcher: Fetcher = async (_url, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return { ok: true, status: 201, json: async () => ({ id: 'wo1' }) } as Response;
    };
    const props: ScreenProps = {
      api: new ApiClient('', fetcher),
      params: {},
      principal: { accountId: 'manager-1', role: Role.OperationsManager },
      onNavigate: vi.fn(),
      onPrincipalChange: vi.fn(),
    };
    render(<WorkOrderCreateScreen {...props} />);
    expect(screen.getByText('Pest type: Termite.')).toBeTruthy();
    expect(screen.queryByLabelText('Pest')).toBeNull();
    fireEvent.change(screen.getByLabelText('Scheduled date'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create work order' }));
    await waitFor(() => expect(payload).not.toBeNull());
    expect(payload).toMatchObject({ sourceReportId: 'r1', pestType: 'Termite' });
    expect(payload).not.toHaveProperty('clusterId');
  });

  it('creates a report-only target without requiring or inventing a cluster', async () => {
    window.history.replaceState({}, '', '/ops/work-orders/new?sourceReportId=r-outside&pestType=Rat&clusterId=unrelated');
    let payload: Record<string, unknown> | null = null;
    const fetcher: Fetcher = async (_url, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return { ok: true, status: 201, json: async () => ({ id: 'wo-outside' }) } as Response;
    };
    const props: ScreenProps = {
      api: new ApiClient('', fetcher),
      params: {},
      principal: { accountId: 'manager-1', role: Role.OperationsManager },
      onNavigate: vi.fn(),
      onPrincipalChange: vi.fn(),
    };
    render(<WorkOrderCreateScreen {...props} />);
    expect(screen.getByText(/target verified report r-outside/i)).toBeTruthy();
    expect(screen.getByText(/Pest type: Rat/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Scheduled date'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create work order' }));
    await waitFor(() => expect(payload).not.toBeNull());
    expect(payload).toMatchObject({ sourceReportId: 'r-outside', pestType: 'Rat' });
    expect(payload).not.toHaveProperty('clusterId');
  });
});
