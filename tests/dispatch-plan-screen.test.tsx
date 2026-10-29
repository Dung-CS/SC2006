/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DispatchProposalScreen } from '../client/src/screens/operations/DispatchProposalScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { MapTask, MapRoute } from '../client/src/components/SingaporeMap';
import { Role } from '../src/entity/enums';

vi.mock('../client/src/components/SingaporeMap', () => ({
  SingaporeMap: ({ tasks = [], routes = [], onTaskOpen }: { tasks: MapTask[]; routes: MapRoute[]; onTaskOpen: (task: MapTask) => void }) =>
    <div data-testid="dispatch-map" data-routes={routes.map((route) => route.teamId).join(',')}
      data-geometry={JSON.stringify(routes.map((route) => route.coordinates))}>
      {tasks.map((task) => <button key={task.id} data-task-id={task.id} data-point={`${task.point.latitude},${task.point.longitude}`}
        data-team-state={task.assignmentState} data-photo={task.photoUrl} data-reference={String(task.photoIsReference)}
        onClick={() => onTaskOpen(task)}>{task.location}</button>)}
    </div>,
}));
afterEach(cleanup);
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

const point = { latitude: 1.3, longitude: 103.8 };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function mount(plan: Record<string, unknown>, proposals: object[] = [], photoReply?: (url: string) => Promise<object>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    const body = url.startsWith('/api/reports/') || url.startsWith('/api/images/') ? await photoReply?.(url) ?? {} :
      url.startsWith('/api/ops/dispatch/horizon') ? {
        startDate: today, days: 7, planStatus: 'ready', unassigned: [], ...plan,
        plans: (plan.plans as unknown[]) ?? [{ date: today, routes: [], ...plan }],
      } : { date: today, proposals: proposals.map((proposal) => ({ scheduledDate: today, ...proposal })) };
    return { ok: true, status: 200, json: async () => body } as Response;
  };
  const api = new ApiClient('', fetcher);
  api.setToken('test-manager');
  render(<DispatchProposalScreen api={api} params={{}} principal={{ accountId: 'manager', role: Role.OperationsManager }} onNavigate={vi.fn()} />);
  return calls;
}
const map = () => screen.getByTestId('dispatch-map');
const proposal = { clusterId: 'c1', locality: 'Candidate site', score: 1, tier: 'High', pestType: 'Rat', suggestedTaskType: 'Inspection', mapPoint: point };
const unassigned = { workOrderId: 'u1', locality: 'Unassigned site', taskType: 'Inspection', pestType: 'Rat', priority: 'High', reason: 'No crew.', point };
const tab = (name: RegExp) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Dispatch views' })).getByRole('button', { name }));
const all = (group: string) => within(screen.getByRole('group', { name: group })).getByRole('checkbox', { name: 'All' });
const details = () => { fireEvent.click(screen.getByText('Task details and actions')); document.querySelector<HTMLDetailsElement>('.dispatch-details')!.open = true; };

describe('Dispatch map views and filters', () => {
  it('filters proposals by an explicit selected-day planned team match without claiming assignment', async () => {
    mount({ routes: [route] }, [{ ...proposal, sourceReportId: 'rat-1', mapClusterId: 'pest-rat-1' }, { ...proposal, clusterId: 'other', locality: 'Unmatched' }]);
    await screen.findByRole('checkbox', { name: /Unassigned/ });
    tab(/Proposals/);
    expect(map().querySelector('[data-task-id="proposal:rat-1:Rat"]')?.getAttribute('data-team-state')).toBe('planned');
    fireEvent.click(screen.getByRole('checkbox', { name: /Unassigned/ }));
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(1);
    expect(within(map()).getByText('Candidate site')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Central Sanitation Available' }));
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(0);
  });

  it('switches between verified routes, horizon dispositions and daily candidate pins', async () => {
    const calls = mount({ routes: [route], unassigned: [unassigned, { ...unassigned, workOrderId: 'c1', locality: 'Committed site', disposition: 'committed' }] }, [proposal]);
    await waitFor(() => expect(map().getAttribute('data-routes')).toBe(route.teamId));
    expect(map().querySelector('[data-task-id="report-rat-1"]')).toBeTruthy();
    tab(/Unassigned \/ committed/);
    expect(map().getAttribute('data-routes')).toBe('');
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(2);
    expect(map().querySelector('[data-task-id="c1"]')?.getAttribute('data-team-state')).toBe('unknown');
    tab(/Proposals/);
    expect(map().getAttribute('data-routes')).toBe('');
    expect(within(map()).getByText('Candidate site')).toBeTruthy();
    expect(map().querySelector('[data-task-id="proposal:c1:Rat"]')?.getAttribute('data-point')).toBe('1.3,103.8');
    expect(calls.some((call) => call.url === '/api/map/layers')).toBe(false);
    expect(document.querySelector<HTMLDetailsElement>('.dispatch-details')?.open).toBe(false);
  });

  it('uses Team and Job Type multi-checkboxes, with All and explicit none', async () => {
    mount({ routes: [route, { ...route, teamId: 'Second', waypointOrder: route.waypointOrder.map((wp) => wp.isHq ? wp : { ...wp, workOrderId: 'second', taskType: 'Fogging' }) }] }, [proposal]);
    const second = await screen.findByRole('checkbox', { name: 'Second' });
    fireEvent.click(second);
    expect(map().getAttribute('data-routes')).toBe(route.teamId);
    fireEvent.click(second);
    expect(map().getAttribute('data-routes')).toContain('Second');
    fireEvent.click(all('Team'));
    expect(map().getAttribute('data-routes')).toBe('');
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(0);
    fireEvent.click(all('Team'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inspection' }));
    expect(map().getAttribute('data-routes')).toBe('Second');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fogging' }));
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(0);
    tab(/Proposals/);
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(0);
    fireEvent.click(all('Job Type'));
    expect(within(map()).getByText('Candidate site')).toBeTruthy();
  });

  it('keeps original full road geometry when job filters hide other stops', async () => {
    const mixed = { ...route, waypointOrder: [...route.waypointOrder, { ...route.waypointOrder[1], workOrderId: 'fog', taskType: 'Fogging', label: 'Fog site' }] };
    mount({ routes: [mixed] });
    await screen.findByRole('checkbox', { name: 'Fogging' });
    const geometry = map().getAttribute('data-geometry');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fogging' }));
    expect(map().getAttribute('data-geometry')).toBe(geometry);
    expect(map().querySelector('[data-task-id="fog"]')).toBeNull();
    expect(map().querySelector('[data-task-id="report-rat-1"]')).toBeTruthy();
    details();
    expect(document.querySelector('[data-part="planned-routes"] [data-work-order-id="fog"]')).toBeNull();
  });

  it('uses exact source target points and omits completed, unverified route stops', async () => {
    mount({ routes: [{ ...route, waypointOrder: route.waypointOrder.map((wp) => wp.isHq ? wp : { ...wp, targetPoint: point }) },
      { ...route, teamId: 'Direct', route: { ...route.route, source: 'direct-distance' } },
      { ...route, teamId: 'Finished', waypointOrder: route.waypointOrder.map((wp) => wp.isHq ? wp : { ...wp, status: 'Completed' }) }] });
    await waitFor(() => expect(map().querySelector('[data-task-id="report-rat-1"]')).toBeTruthy());
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(1);
    expect(map().querySelector('[data-task-id]')?.getAttribute('data-point')).toBe('1.3,103.8');
    expect(map().getAttribute('data-routes')).not.toContain('Direct');
  });

  it('reports unavailable source locations without inventing a point', async () => {
    mount({ unassigned: [{ ...unassigned, point: undefined }] }, [{ ...proposal, mapPoint: undefined }]);
    await screen.findByRole('checkbox', { name: /Unassigned/ });
    tab(/Unassigned \/ committed/);
    expect(screen.getByText('1 locations unavailable')).toBeTruthy();
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(0);
    tab(/Proposals/);
    expect(screen.getByText('1 locations unavailable')).toBeTruthy();
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(0);
  });

  it('uses horizon union rather than duplicating a later-day unplanned queue', async () => {
    mount({ unassigned: [], unplanned: [unassigned] });
    await waitFor(() => expect(screen.getByText(/Updated|Task details and actions/)).toBeTruthy());
    tab(/Unassigned \/ committed/);
    expect(map().querySelectorAll('[data-task-id]')).toHaveLength(0);
    expect(screen.queryByText('No crew.')).toBeNull();
    expect(screen.queryByRole('region', { name: /urgent/ })).toBeNull();
  });

  it('selects the requested day and never falls back to another day route', async () => {
    mount({ routes: [route] });
    await waitFor(() => expect(map().getAttribute('data-routes')).toBe(route.teamId));
    const day = screen.getByLabelText('Show day:') as HTMLSelectElement;
    fireEvent.change(day, { target: { value: day.options[1]!.value } });
    expect(map().getAttribute('data-routes')).toBe('');
    expect(document.getElementById('date')).toHaveProperty('type', 'date');
    expect(document.getElementById('horizon-days')).toBeTruthy();
  });

  it('keeps vehicle and packing details behind the collapsed disclosure', async () => {
    mount({ computedAt: '2026-10-27T09:00:00Z', planStatus: 'refreshing', routes: [route] });
    await screen.findByText('Updating');
    expect(document.querySelector<HTMLDetailsElement>('.dispatch-details')?.open).toBe(false);
    details();
    expect(screen.getByText(/Payload: 25.0 \/ 750.0 kg/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Logistics & Equipment Packing List/ }));
    expect(screen.getByText(/Each: 30/)).toBeTruthy();
    expect(screen.getByText('Provisional item values')).toBeTruthy();
  });

  it('keeps proposal source identities in work-order form links without creating records', async () => {
    const calls = mount({}, [{ ...proposal, sourceReportId: 'rat-1', point }]);
    await screen.findByRole('checkbox', { name: /Unassigned/ });
    tab(/Proposals/); details();
    const query = new URL((await screen.findByRole('link', { name: 'Raise a work order' })).getAttribute('href')!, 'https://test').searchParams;
    expect(query.get('sourceReportId')).toBe('rat-1');
    expect(query.get('pestType')).toBe('Rat');
    expect(query.has('clusterId')).toBe(false);
    expect(calls.every((call) => call.init?.method === 'GET')).toBe(true);
  });

  it('loads only the opened report first photo through the authenticated API', async () => {
    const calls = mount({}, [{ ...proposal, sourceReportId: 'rat-1', point }, { ...proposal, clusterId: 'c2', sourceReportId: 'rat-2', locality: 'Other site' }],
      async (url) => url.startsWith('/api/reports/') ? { photos: [{ storageKey: 'first.jpg' }, { storageKey: 'second.jpg' }] } : { url: 'https://images.test/signed-first.jpg' });
    await screen.findByRole('checkbox', { name: /Unassigned/ });
    tab(/Proposals/);
    expect(calls.filter((call) => call.url.startsWith('/api/reports/'))).toHaveLength(0);
    fireEvent.click(within(map()).getByText('Candidate site'));
    await waitFor(() => expect(map().querySelector('[data-task-id="proposal:rat-1:Rat"]')?.getAttribute('data-reference')).toBe('false'));
    expect(calls.filter((call) => call.url.startsWith('/api/reports/')).map((call) => call.url)).toEqual(['/api/reports/rat-1']);
    const imageCall = calls.find((call) => call.url.startsWith('/api/images/'))!;
    expect(imageCall.url).toBe('/api/images/report/rat-1/first.jpg');
    expect((imageCall.init?.headers as Record<string, string>).Authorization).toBe('Bearer test-manager');
  });

  it('keeps a labelled reference when no report photograph is available', async () => {
    const calls = mount({}, [{ ...proposal, sourceReportId: 'rat-1' }], async () => ({ photos: [] }));
    await screen.findByRole('checkbox', { name: /Unassigned/ });
    tab(/Proposals/);
    fireEvent.click(within(map()).getByText('Candidate site'));
    await waitFor(() => expect(calls.some((call) => call.url === '/api/reports/rat-1')).toBe(true));
    expect(map().querySelector('[data-task-id]')?.getAttribute('data-reference')).toBe('true');
    expect(calls.some((call) => call.url.startsWith('/api/images/'))).toBe(false);
  });

  it('discards stale selection results after changing view', async () => {
    let resolve!: (body: object) => void;
    const pending = new Promise<object>((done) => { resolve = done; });
    const calls = mount({}, [{ ...proposal, sourceReportId: 'rat-1' }], () => pending);
    await screen.findByRole('checkbox', { name: /Unassigned/ });
    tab(/Proposals/);
    fireEvent.click(within(map()).getByText('Candidate site'));
    tab(/Routes/);
    resolve({ photos: [{ storageKey: 'first.jpg' }] });
    await waitFor(() => expect(calls.some((call) => call.url === '/api/reports/rat-1')).toBe(true));
    tab(/Proposals/);
    expect(map().querySelector('[data-task-id]')?.getAttribute('data-reference')).toBe('true');
    expect(calls.some((call) => call.url.startsWith('/api/images/'))).toBe(false);
  });
});
