/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { ScreenProps } from '../client/src/screens/ScreenProps';
import { ReportReviewScreen } from '../client/src/screens/operations/ReportReviewScreen';
import { WorkOrderDetailScreen } from '../client/src/screens/operations/WorkOrderDetailScreen';
import { JobDetailScreen } from '../client/src/screens/crew/JobDetailScreen';
import { MyJobsScreen } from '../client/src/screens/crew/MyJobsScreen';
import { Role } from '../src/entity/enums';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

function screenProps(
  table: Record<string, { status?: number; body: unknown }>,
  role: Role = Role.OperationsManager,
  params: Record<string, string> = {},
): ScreenProps {
  const fetcher: Fetcher = async (url) => {
    const entry = table[url] ?? { status: 404, body: { error: 'not found', remedy: 'retry' } };
    const status = entry.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => entry.body } as Response;
  };
  return {
    api: new ApiClient('', fetcher),
    params,
    principal: { accountId: 'user-1', role },
    onNavigate: vi.fn(),
    onPrincipalChange: vi.fn(),
  };
}

function reportReview(pestType: string): Record<string, { body: unknown }> {
  return {
    '/api/ops/moderation/r1': {
      body: {
        report: {
          id: 'r1', pestType, type: 'StandingWater', description: 'Report details', localityBinding: 'Outside cluster',
          clusterId: null, status: 'Verified', corroborationCount: 1, submittedAt: '2026-10-19T00:00:00.000Z',
        },
        photos: [],
      },
    },
    '/api/pests': {
      body: { pests: [{ pestType, pestClass: pestType === 'HouseCrow' ? 'Nuisance' : 'Structural', authority: pestType === 'HouseCrow' ? 'AVS' : 'Town Council', contactNumber: '1800', referred: false }] },
    },
  };
}

describe('report-only work-order targets', () => {
  it('offers a source-report work order for a verified internal report with no cluster', async () => {
    render(<ReportReviewScreen {...screenProps(reportReview('Rat'), Role.OperationsManager, { id: 'r1' })} />);
    const link = await screen.findByRole('link', { name: /Create work order for this verified Rat report/i });
    expect(link.getAttribute('href')).toBe('/ops/work-orders/new?sourceReportId=r1&pestType=Rat');
  });

  it('keeps external catalogue reports on the referral path', async () => {
    render(<ReportReviewScreen {...screenProps(reportReview('HouseCrow'), Role.OperationsManager, { id: 'r1' })} />);
    expect(await screen.findByRole('link', { name: 'Refer this report' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Create work order/ })).toBeNull();
  });

  it('shows an unscored report target without a cluster-null link or Mosquito fallback', async () => {
    const payload = {
      '/api/ops/work-orders/wo-r': {
        body: { workOrder: {
          id: 'wo-r', clusterId: null, sourceReportId: 'r1', pestType: null, point: { latitude: 1.3, longitude: 103.8 },
          assigneeId: null, taskType: 'Inspection', status: 'Created', scheduledDate: '2026-10-20', priority: 'Medium',
          instructions: '', issueFlag: false, issueReason: null, cancellationReason: null, verifiedAt: null,
        } },
      },
      '/api/ops/work-orders/crew-workload': { body: { crew: [] } },
      '/api/ops/work-orders/wo-r/history': { body: { entries: [] } },
    };
    render(<WorkOrderDetailScreen {...screenProps(payload, Role.OperationsManager, { id: 'wo-r' })} />);
    expect((await screen.findByRole('link', { name: 'View source report' })).getAttribute('href')).toBe('/ops/moderation/r1');
    expect(screen.getByText('Unscored report default')).toBeTruthy();
    expect(screen.getAllByText('1.3, 103.8').length).toBe(2);
    expect(document.body.innerHTML).not.toContain('/ops/clusters/null');
    expect(screen.queryByText(/Mosquito/)).toBeNull();
  });

  it('renders nullable crew targets with their real point and an honest unknown pest', async () => {
    const payload = {
      '/api/crew/work-orders/wo-r': {
        body: { workOrder: {
          id: 'wo-r', clusterId: null, sourceReportId: 'r1', pestType: null, point: { latitude: 1.31, longitude: 103.81 },
          location: 'Yishun Ave 1', taskType: 'Inspection', status: 'Assigned', scheduledDate: '2026-10-20', priority: 'Medium',
          instructions: '', startedAt: null, issueFlag: false, issueReason: null,
        } },
      },
      '/api/crew/work-orders?filter=Today': { body: { filter: 'Today', workOrders: [{
        id: 'wo-r', clusterId: null, sourceReportId: 'r1', pestType: null, point: { latitude: 1.31, longitude: 103.81 },
        location: 'Yishun Ave 1', taskType: 'Inspection', status: 'Assigned', scheduledDate: '2026-10-20', priority: 'Medium', issueFlag: false,
      }] } },
    };
    render(<JobDetailScreen {...screenProps(payload, Role.CleaningCrew, { id: 'wo-r' })} />);
    expect(await screen.findByText('Yishun Ave 1')).toBeTruthy();
    expect(screen.getByText(/Verified report/)).toBeTruthy();
    expect(screen.getByText(/Unknown pest/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /clusters/i })).toBeNull();

    cleanup();
    render(<MyJobsScreen {...screenProps(payload, Role.CleaningCrew)} />);
    expect(await screen.findByText('Verified report target')).toBeTruthy();
    expect(screen.getByText(/Yishun Ave 1/)).toBeTruthy();
  });
});
