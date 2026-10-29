/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DispatchProposalScreen } from '../client/src/screens/operations/DispatchProposalScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { Role } from '../src/entity/enums';

vi.mock('../client/src/components/SingaporeMap', () => ({
  SingaporeMap: ({ clusters, routes, showClusterBadges }: { clusters: Array<{ locality: string }>; routes: Array<{ teamId: string; waypoints: Array<{ point?: { latitude?: number; longitude?: number } }> }>; showClusterBadges: boolean }) =>
    <div data-testid="dispatch-map-targets" data-routes={routes.map((r) => r.teamId).join(',')} data-stops={routes.flatMap((r) => r.waypoints).length} data-points={routes.flatMap((r) => r.waypoints.flatMap((wp) => wp.point ? [`${wp.point.latitude},${wp.point.longitude}`] : [])).join('|')} data-badges={String(showClusterBadges)}>{clusters.map((cluster) => cluster.locality).join(', ')}</div>,
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
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const fetcher: Fetcher = async (url) => ({ ok: true, status: 200, json: async () => {
    if (url.startsWith('/api/ops/dispatch/horizon')) {
      const requestedDate = new URL(url, 'https://example.test').searchParams.get('date') ?? today;
      const dayRoutes = requestedDate === today ? (plan.routes as typeof route[] | undefined) ?? [] :
        ((plan.routes as typeof route[] | undefined) ?? []).map((item) => ({ ...item, teamId: 'Next-Day', waypointOrder: item.waypointOrder.map((wp) => wp.isHq ? wp : { ...wp, label: 'Next day job' }) }));
      const union = (plan.horizonUnassigned as unknown[] | undefined) ?? (plan.unplanned as unknown[] | undefined) ?? [];
      return { startDate: requestedDate, days: 7, planStatus: 'ready', referrals: (plan.referrals as unknown[]) ?? [], unassigned: union, plans: [{ ...plan, date: requestedDate, routes: dayRoutes, unplanned: (plan.unplanned as unknown[]) ?? [], referrals: (plan.referrals as unknown[]) ?? [] }] };
    }
    return url === '/api/map/layers' ? { clusters: [
      { clusterId: 'pest-rat-1', locality: 'Rat report target', tier: 'High', ring: [] },
      { clusterId: 'other', locality: 'Unrelated locality', tier: 'Low', ring: [] },
    ] } : { date: today, proposals: proposals.map((p) => ({ ...(p as object), scheduledDate: today })) };
  } }) as Response;
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

  it('shows an urgent referral without offering an internal allocation', async () => {
    mount({ planStatus: 'ready', referrals: [{ reportId: 'snake-1', pestType: 'Snake', priority: 'Critical',
      locality: 'Snake report', authority: 'NParks', reason: 'Specialist authority response required.' }] });
    await screen.findByRole('heading', { name: /Active Clusters & Multi-Team Road Routes/ });
    expect(screen.queryByRole('heading', { name: /External authority tasks/ })).toBeNull();
    const urgentQueue = screen.getByRole('region', { name: 'High and Critical task queue' });
    expect(within(urgentQueue).getByText(/Critical: Snake report/)).toBeTruthy();
    expect(within(urgentQueue).getByRole('link', { name: 'Review referral' }).getAttribute('href')).toBe('/ops/referrals/snake-1');
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
    const create = (await screen.findAllByRole('link', { name: 'Raise a work order' }))[0]!;
    const query = new URL(create.getAttribute('href')!, 'https://example.test').searchParams;
    expect(query.get('sourceReportId')).toBe('rat-1');
    expect(query.get('pestType')).toBe('Rat');
    expect(query.has('clusterId')).toBe(false);
    expect(screen.getAllByRole('link', { name: 'Raise a work order' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Review referral' }).every((item) => item.getAttribute('href') === '/ops/referrals/snake-1')).toBe(true);
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

  it('shows unassigned reasons and distinguishes committed work', async () => {
    mount({ planStatus: 'ready', unplanned: [
      { workOrderId: 'u1', locality: 'No route task', priority: 'High', reason: 'No qualified crew available.', disposition: 'unassigned' },
      { workOrderId: 'c1', locality: 'Existing task', priority: 'Critical', reason: 'Keep current assignee.', disposition: 'committed', status: 'Assigned' },
    ] });
    fireEvent.click(await screen.findByRole('button', { name: /Horizon unassigned \/ committed \(1 \/ 1\)/ }));
    expect((await screen.findAllByText(/No qualified crew available/)).length).toBe(2);
    expect(screen.getAllByText(/Committed \(Assigned\)/).length).toBe(2);
  });

  it('shows a High existing order in the urgent queue when no proposal exists', async () => {
    const existing = { ...route, waypointOrder: route.waypointOrder.map((wp) => wp.isHq ? wp : { ...wp, workOrderId: 'order-existing' }) };
    mount({ planStatus: 'ready', routes: [existing] }, []);
    const queue = await screen.findByRole('region', { name: 'High and Critical task queue' });
    expect(within(queue).getByText('High: Rat hotspot')).toBeTruthy();
    expect(within(queue).getByRole('link', { name: 'Review work order' }).getAttribute('href')).toBe('/ops/work-orders/order-existing');
  });

  it('does not link a report proposal to a nonexistent lifecycle work order', async () => {
    mount({ planStatus: 'ready', routes: [route] }, []);
    const queue = await screen.findByRole('region', { name: 'High and Critical task queue' });
    expect(within(queue).queryByRole('link', { name: 'Review work order' })).toBeNull();
  });

  it('uses the horizon union for the unassigned tab, not a day queue item scheduled later', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const tomorrow = new Date(`${today}T12:00:00+08:00`); tomorrow.setDate(tomorrow.getDate() + 1);
    const laterDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow);
    mount({ planStatus: 'ready', horizonUnassigned: [], unplanned: [
      { workOrderId: 'later', locality: 'Later planned', priority: 'High', reason: 'Planned for day two.', scheduledDate: laterDate },
    ] });
    fireEvent.click(await screen.findByRole('button', { name: /Horizon unassigned \/ committed/ }));
    expect(await screen.findByRole('heading', { name: /Tasks unassigned across the 7-day horizon \(0\)/ })).toBeTruthy();
    expect(screen.queryByText('Later planned')).toBeNull();
  });

  it('keeps more than ten urgent proposals reachable through the priority filter and pages', async () => {
    const urgent = Array.from({ length: 12 }, (_, i) => ({ clusterId: `urgent-${i}`, locality: `Urgent ${i}`, tier: i === 0 ? 'Critical' : 'High', score: 1, suggestedTaskType: 'Inspection' }));
    mount({ planStatus: 'ready' }, urgent);
    const queue = await screen.findByRole('region', { name: 'High and Critical task queue' });
    expect(within(queue).getAllByRole('listitem')).toHaveLength(12);
    expect(within(queue).getByText(/Urgent 11/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Priority filter:'), { target: { value: 'High' } });
    const proposalsList = document.querySelector<HTMLOListElement>('ol[data-part="proposals"]')!;
    expect(within(proposalsList).getByText('Urgent 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Go to next page/ }));
    expect(within(proposalsList).getByText('Urgent 11')).toBeTruthy();
  });

  it('changes the selected day on both the route map and task route list', async () => {
    mount({ planStatus: 'ready', computedAt: '2026-10-27T09:00:00Z', routes: [route] });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const next = new Date(`${today}T12:00:00+08:00`); next.setDate(next.getDate() + 1);
    const nextDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(next);
    fireEvent.change(screen.getByLabelText('Horizon start:'), { target: { value: nextDate } });
    expect(await screen.findByRole('option', { name: 'Team Next-Day' })).toBeTruthy();
    expect(screen.getByTestId('dispatch-map-targets').getAttribute('data-routes')).toBe('Next-Day');
    fireEvent.click(screen.getByRole('button', { name: /Planned Multi-Team Routes/ }));
    expect(await screen.findByText('Next day job')).toBeTruthy();
  });

  it('labels walking access separately from the driving route', async () => {
    const walkedRoute = { ...route, route: { ...route.route, distanceMetres: 30_000, drivingDurationSeconds: 600, walkingDurationSeconds: 300,
      walkingVisits: [{ stopIndex: 0, targetPoint: { latitude: 1.32, longitude: 103.85 }, accessPoint: { latitude: 1.321, longitude: 103.851 },
        outbound: { coordinates: [{ latitude: 1.321, longitude: 103.851 }, { latitude: 1.32, longitude: 103.85 }], durationSeconds: 150, distanceMetres: 2_500, source: 'onemap', mode: 'walk' },
        return: { coordinates: [{ latitude: 1.32, longitude: 103.85 }, { latitude: 1.321, longitude: 103.851 }], durationSeconds: 150, distanceMetres: 2_500, source: 'onemap', mode: 'walk' } }] } };
    mount({ planStatus: 'ready', routes: [walkedRoute] });
    fireEvent.click(await screen.findByRole('button', { name: /Planned Multi-Team Routes/ }));
    expect((await screen.findAllByText((_text, element) => element?.textContent?.includes('10 min driving') === true)).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_text, element) => element?.textContent?.includes('5 min verified walking access and return') === true).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_text, element) => Boolean(element?.textContent?.includes('30.0 km total travel') && element?.textContent?.includes('25.0 km driving + 5.0 km walking'))).length).toBeGreaterThan(0);
  });

  it('labels a verified service-area road entry and keeps its actual entry point on the map', async () => {
    const entry = { latitude: 1.322, longitude: 103.852 };
    const target = { latitude: 1.32, longitude: 103.85 };
    const areaRoute = { ...route, waypointOrder: route.waypointOrder.map((wp) => wp.isHq ? wp :
      { ...wp, point: entry, targetPoint: target, isAreaAccess: true }) };
    mount({ planStatus: 'ready', routes: [areaRoute] });
    fireEvent.click(await screen.findByRole('button', { name: /Planned Multi-Team Routes/ }));
    expect(await screen.findByText('Area access point')).toBeTruthy();
    const map = screen.getByTestId('dispatch-map-targets');
    expect(map.getAttribute('data-points')).toContain('1.322,103.852');
    expect(map.getAttribute('data-points')).not.toContain('1.32,103.85');
  });

});
