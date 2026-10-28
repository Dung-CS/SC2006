/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DispatchProposalScreen } from '../client/src/screens/operations/DispatchProposalScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { Role } from '../src/entity/enums';

vi.mock('../client/src/components/SingaporeMap', () => ({
  SingaporeMap: ({ clusters, routes, showClusterBadges }: { clusters: Array<{ locality: string }>; routes: Array<{ teamId: string; waypoints: unknown[] }>; showClusterBadges: boolean }) =>
    <div data-testid="dispatch-map-targets" data-routes={routes.map((r) => r.teamId).join(',')} data-stops={routes.flatMap((r) => r.waypoints).length} data-badges={String(showClusterBadges)}>{clusters.map((cluster) => cluster.locality).join(', ')}</div>,
}));
afterEach(() => cleanup());

const route = {
  teamId: 'Central-Sanitation-Available', staffCount: 2, depotLocation: 'Central', status: 'Available',
  onCallLagHours: 0, workOrderIds: ['report-rat-1'], waypointOrder: [{ label: 'HQ', point: { latitude: 1.321, longitude: 103.851 }, isHq: true }, { label: 'Stop 1: Rat hotspot',
    point: { latitude: 1.32, longitude: 103.85 }, workOrderId: 'report-rat-1', mapClusterId: 'pest-rat-1',
    taskType: 'Inspection', pestType: 'Rat', priority: 'High', status: 'Pending', isCompleted: false,
    estimatedEffortMinutes: 30, requiredStaff: 1, isHq: false, cumulativeDurationSeconds: 2000 }],
  route: { coordinates: [{ latitude: 1.32, longitude: 103.85 }, { latitude: 1.321, longitude: 103.851 }], distanceMetres: 2000, durationSeconds: 600, source: 'onemap' },
  totalDurationSeconds: 2400, totalTravelSeconds: 600, totalEffortSeconds: 1800,
  capacityUsedPercentage: 17, isWithinFourHourCap: true, completedCount: 0, totalStopsCount: 1,
  progressPercentage: 0, color: '#2563EB', vehicleId: 'demo-1', vehicleRegistration: 'DEMO-C1',
  vehicleName: 'Demo van', isDemoVehicle: true, maxPayloadKg: 750, maxCargoVolumeM3: 6,
  loadWeightKg: 25, loadVolumeM3: 0.2, loadWeightPercentage: 25 / 750 * 100,
  loadVolumePercentage: 0.2 / 6 * 100, loadBasis: 'Provisional conservative load envelope.',
  packingList: [{ item: 'Inspection kit', quantity: '2 kits', quantityCount: 2, category: 'Safety', icon: '📦',
    reason: 'Inspection tools', unitWeightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10,
    totalWeightKg: 4, totalVolumeM3: 0.012, isProvisional: true }],
};
function mount(plan: Record<string, unknown>, proposals: unknown[] = []) {
  const fetcher: Fetcher = async (url) => ({ ok: true, status: 200, json: async () =>
    url.startsWith('/api/ops/dispatch/routes') ? { date: '2099-01-01', routes: [], unplanned: [], referrals: [], ...plan } :
    url === '/api/map/layers' ? { clusters: [
      { clusterId: 'pest-rat-1', locality: 'Rat report target', tier: 'High', ring: [] },
      { clusterId: 'other', locality: 'Unrelated locality', tier: 'Low', ring: [] },
    ] } : { date: '2099-01-01', proposals },
  }) as Response;
  render(<DispatchProposalScreen api={new ApiClient('', fetcher)} params={{}}
    principal={{ accountId: 'manager', role: Role.OperationsManager }} onNavigate={vi.fn()} onPrincipalChange={vi.fn()} />);
}

describe('Precomputed dispatch and vehicle-load display', () => {
  it('distinguishes initial background computation from a completed empty plan', async () => {
    mount({ planStatus: 'pending', computedAt: null });
    expect(await screen.findByText(/Preparing the first dispatch plan/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Planned Multi-Team Routes/ }));
    expect(screen.queryByText(/No eligible tasks/)).toBeNull();
    expect(screen.queryByText(/No routable work orders/)).toBeNull();
  });

  it('keeps the completed crew and vehicle plan visible while a replacement computes', async () => {
    mount({ planStatus: 'refreshing', computedAt: '2026-10-27T09:00:00Z', planningDurationSeconds: 2.5, routes: [route] });
    expect(await screen.findByText(/The last completed plan remains visible/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Planned Multi-Team Routes/ }));
    expect(screen.getByText('Demo van · DEMO-C1')).toBeTruthy();
    expect(screen.getByText('Demo vehicle — illustrative capacity')).toBeTruthy();
    expect(screen.getByText(/Payload: 25.0 \/ 750.0 kg/)).toBeTruthy();
    expect(screen.getByText(/Cargo volume: 0.200 \/ 6.000 m³/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Logistics & Equipment Packing List/ }));
    expect(screen.getByText(/Each: 30 × 20 × 10 cm/)).toBeTruthy();
    expect(screen.getByText(/Load for 2: 4.00 kg/)).toBeTruthy();
    expect(screen.getByText('Provisional item values')).toBeTruthy();
  });

  it('does not display external authority tasks on dispatch when there are no internal routes', async () => {
    mount({ planStatus: 'ready', referrals: [{ reportId: 'snake-1', pestType: 'Snake', priority: 'Critical',
      locality: 'Snake report', authority: 'NParks', reason: 'Specialist authority response required.' }] });
    await screen.findByRole('heading', { name: /Active Clusters & Multi-Team Road Routes/ });
    expect(screen.queryByRole('heading', { name: /External authority tasks/ })).toBeNull();
    expect(screen.queryByText(/Critical: Snake report/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Review referral' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Planned Multi-Team Routes/ }));
    expect(screen.queryByText(/No eligible tasks/)).toBeNull();
  });

  it('passes report-only pest identity to creation and never offers an internal order for referrals', async () => {
    mount({ planStatus: 'ready' }, [
      { clusterId: 'pest-rat-1', sourceReportId: 'rat-1', pestType: 'Rat', locality: 'Rat task', score: 0,
        tier: 'High', suggestedTaskType: 'Inspection', scheduledDate: '2099-01-01', priorityBasis: 'ReportTriage' },
      { clusterId: 'pest-snake-1', sourceReportId: 'snake-1', pestType: 'Snake', locality: 'Snake task', score: 0,
        tier: 'Critical', suggestedTaskType: 'Inspection', scheduledDate: '2099-01-01', referralAuthority: 'NParks' },
    ]);
    const create = await screen.findByRole('link', { name: 'Raise a work order' });
    const query = new URL(create.getAttribute('href')!, 'https://example.test').searchParams;
    expect(query.get('sourceReportId')).toBe('rat-1');
    expect(query.get('pestType')).toBe('Rat');
    expect(query.has('clusterId')).toBe(false);
    expect(screen.getAllByRole('link', { name: 'Raise a work order' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Review referral' }).getAttribute('href')).toBe('/ops/referrals/snake-1');
  });

  it('filters dispatch map targets by waypoint map identity rather than work-order identifiers', async () => {
    mount({ planStatus: 'ready', routes: [route] });
    await screen.findByRole('button', { name: /Planned Multi-Team Routes \(1 Teams\)/ });
    const map = screen.getByTestId('dispatch-map-targets');
    expect(within(map).getByText('Rat report target')).toBeTruthy();
    expect(within(map).queryByText(/Unrelated locality/)).toBeNull();
  });
  it('excludes unverified proposals, direct estimates and unusable road geometry from the map', async () => {
    mount({ planStatus: 'ready', routes: [
      { ...route, teamId: 'direct', route: { ...route.route, source: 'direct-distance' } },
      { ...route, teamId: 'unverified', route: { ...route.route, coordinates: [] } },
    ] }, [{ clusterId: 'other', locality: 'Unverified proposal', tier: 'Low', score: 1,
      suggestedTaskType: 'Inspection', scheduledDate: '2099-01-01' }]);
    await screen.findByText('Unverified proposal');
    const map = screen.getByTestId('dispatch-map-targets');
    expect(map.textContent).toBe('');
    expect(map.getAttribute('data-routes')).toBe('');
    expect(screen.getByText('Not on the current road-route map')).toBeTruthy();
  });

  it('can isolate one road-accessible team and omits duplicate badges and completed stops', async () => {
    mount({ planStatus: 'ready', routes: [route, { ...route, teamId: 'Second', waypointOrder:
      route.waypointOrder.map((wp) => wp.isHq ? wp : { ...wp, status: 'Completed', isCompleted: true }) }] });
    await screen.findByRole('option', { name: 'Team Second' });
    fireEvent.change(screen.getByLabelText('Map team:'), { target: { value: 'Second' } });
    const map = screen.getByTestId('dispatch-map-targets');
    expect(map.getAttribute('data-routes')).toBe('Second');
    expect(map.getAttribute('data-stops')).toBe('1'); // HQ only.
    expect(map.getAttribute('data-badges')).toBe('false');
    expect(map.textContent).toBe('');
  });

});
