/**
 * @vitest-environment jsdom
 *
 * Crew My Dispatch view tests (HANDOVER_AGY_CREW_DISPATCH.md).
 * Covers: route header, crew, vehicle, route metrics, ordered stops in visit order linking
 * to /crew/jobs/:id, checklist toggle, and empty state when no dispatch is assigned.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { MyJobsScreen } from '../client/src/screens/crew/MyJobsScreen';
import { Role } from '../src/entity/enums';

afterEach(() => {
  cleanup();
});

const CREW_PRINCIPAL = { accountId: 'c1', role: Role.CleaningCrew };

const mockDispatch = {
  assignment: {
    id: 'da-123',
    date: '2026-11-07',
    teamId: 'Central Team Alpha',
    status: 'Assigned',
    routeSnapshot: {
      teamId: 'Central Team Alpha',
      depotLocation: 'Central',
      status: 'Assigned',
      color: '#2563EB',
      staffCount: 2,
      crewMembers: [
        { id: 'c1', email: 'siti@example.com', displayName: 'Siti Tan' },
        { id: 'c2', email: 'seng@example.com', displayName: 'Ah Seng' },
      ],
      vehicleModel: 'Toyota Hiace',
      vehicleRegistration: 'GBD 1234 A',
      vehiclePhotoUrl: '/visuals/vehicles/toyota-hiace.jpg',
      totalDurationSeconds: 7200,
      totalTravelSeconds: 1800,
      totalEffortSeconds: 5400,
      capacityUsedPercentage: 50,
      completedCount: 1,
      totalStopsCount: 2,
      progressPercentage: 50,
    },
  },
  checklist: [
    { id: 'chk-1', item: 'ULV Mist Blower', quantity: '1 unit', icon: '💨', checked: true },
    { id: 'chk-2', item: 'BTI Larvicide Granules', quantity: '2 tubs', icon: '🧪', checked: false },
  ],
  stops: [
    {
      workOrderId: 'wo-1',
      location: '123 Ang Mo Kio Ave 4',
      pestType: 'Mosquito',
      taskType: 'Inspection',
      priority: 'High',
      status: 'Completed',
    },
    {
      workOrderId: 'wo-2',
      location: '456 Bedok North St 1',
      pestType: 'Mosquito',
      taskType: 'Fogging',
      priority: 'Medium',
      status: 'InProgress',
    },
  ],
};

const mockJobs = {
  filter: 'Today',
  workOrders: [
    {
      id: 'wo-1',
      clusterId: 'cl-1',
      pestType: 'Mosquito',
      location: '123 Ang Mo Kio Ave 4',
      taskType: 'Inspection',
      status: 'Completed',
      scheduledDate: '2026-11-07',
      priority: 'High',
      issueFlag: false,
    },
    {
      id: 'wo-2',
      clusterId: 'cl-1',
      pestType: 'Mosquito',
      location: '456 Bedok North St 1',
      taskType: 'Fogging',
      status: 'InProgress',
      scheduledDate: '2026-11-07',
      priority: 'Medium',
      issueFlag: false,
    },
  ],
};

function createFetcher(dispatchData = mockDispatch, jobsData = mockJobs, onPost?: (body: any) => void): Fetcher {
  return async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/crew/dispatch/checklist/toggle')) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      onPost?.(body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          checklist: dispatchData.checklist.map((item) =>
            item.id === body.itemId ? { ...item, checked: body.checked } : item,
          ),
        }),
      } as unknown as globalThis.Response;
    }
    if (url.startsWith('/api/crew/dispatch/checklist')) {
      return {
        ok: true,
        status: 200,
        json: async () => dispatchData,
      } as unknown as globalThis.Response;
    }
    if (url.startsWith('/api/crew/work-orders')) {
      return {
        ok: true,
        status: 200,
        json: async () => jobsData,
      } as unknown as globalThis.Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as globalThis.Response;
  };
}

describe('MyJobsScreen — Crew My Dispatch view', () => {
  it('renders the complete dispatch route: header, crew, vehicle, metrics, checklist, and ordered stops linking to /crew/jobs/:id', async () => {
    const toggles: any[] = [];
    const fetcher = createFetcher(mockDispatch, mockJobs, (b) => toggles.push(b));
    const api = new ApiClient('', fetcher);

    render(
      <MyJobsScreen
        api={api}
        params={{}}
        principal={CREW_PRINCIPAL}
        onNavigate={vi.fn()}
        onPrincipalChange={vi.fn()}
      />,
    );

    // Wait for the My Dispatch section to render
    await waitFor(() => {
      expect(document.querySelector('[data-part="my-dispatch"]')).toBeTruthy();
    });

    const dispatchSection = document.querySelector('[data-part="my-dispatch"]')!;

    // 1. Route header: team name, depot, date, status
    expect(dispatchSection.textContent).toContain('Central Team Alpha');
    expect(dispatchSection.textContent).toContain('Central Depot');
    expect(dispatchSection.textContent).toContain('2026-11-07');
    expect(dispatchSection.textContent).toContain('Assigned');

    // 2. Crew: data-part="dispatch-crew"
    const crewEl = dispatchSection.querySelector('[data-part="dispatch-crew"]')!;
    expect(crewEl).toBeTruthy();
    expect(crewEl.textContent).toContain('Siti Tan');
    expect(crewEl.textContent).toContain('Ah Seng');

    // 3. Vehicle: data-part="dispatch-vehicle"
    const vehicleEl = dispatchSection.querySelector('[data-part="dispatch-vehicle"]')!;
    expect(vehicleEl).toBeTruthy();
    expect(vehicleEl.textContent).toContain('Toyota Hiace');
    expect(vehicleEl.textContent).toContain('GBD 1234 A');

    // 4. Route metrics: data-part="dispatch-metrics"
    const metricsEl = dispatchSection.querySelector('[data-part="dispatch-metrics"]')!;
    expect(metricsEl).toBeTruthy();
    expect(metricsEl.textContent).toContain('2h 0m');
    expect(metricsEl.textContent).toContain('50% of 4h cap');
    expect(metricsEl.textContent).toContain('30 min');
    expect(metricsEl.textContent).toContain('90 min');
    expect(metricsEl.textContent).toContain('1 of 2 stops completed');

    // 5. Logistics checklist
    const checklistSection = dispatchSection.querySelector('section[aria-label="Dispatch logistics checklist"]')!;
    expect(checklistSection).toBeTruthy();
    expect(checklistSection.textContent).toContain('ULV Mist Blower');
    expect(checklistSection.textContent).toContain('BTI Larvicide Granules');

    // Toggle checklist checkbox
    const checkboxes = checklistSection.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[1]?.checked).toBe(false);

    fireEvent.click(checkboxes[1]!);
    await waitFor(() => {
      expect(toggles.length).toBe(1);
    });
    expect(toggles[0]).toEqual({
      assignmentId: 'da-123',
      itemId: 'chk-2',
      checked: true,
    });

    // 6. Ordered stops: data-part="dispatch-stops"
    const stopsEl = dispatchSection.querySelector('[data-part="dispatch-stops"]')!;
    expect(stopsEl).toBeTruthy();
    expect(stopsEl.textContent).toContain('Route stops (2)');

    const stopItems = stopsEl.querySelectorAll('li');
    expect(stopItems.length).toBe(2);

    // Stop 1
    const stop1Link = stopItems[0]?.querySelector('a')!;
    expect(stop1Link.getAttribute('href')).toBe('/crew/jobs/wo-1');
    expect(stopItems[0]?.textContent).toContain('123 Ang Mo Kio Ave 4');
    expect(stopItems[0]?.textContent).toContain('Inspection');
    expect(stopItems[0]?.textContent).toContain('High');
    expect(stopItems[0]?.textContent).toContain('Completed');

    // Stop 2
    const stop2Link = stopItems[1]?.querySelector('a')!;
    expect(stop2Link.getAttribute('href')).toBe('/crew/jobs/wo-2');
    expect(stopItems[1]?.textContent).toContain('456 Bedok North St 1');
    expect(stopItems[1]?.textContent).toContain('Fogging');
    expect(stopItems[1]?.textContent).toContain('Medium');
    expect(stopItems[1]?.textContent).toContain('In progress');

    // 7. All my jobs section is still present below
    expect(screen.getByRole('heading', { name: 'All my jobs' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Filter' })).toBeTruthy();
    expect(document.querySelector('[data-part="jobs"]')).toBeTruthy();
  });

  it('renders a short empty state when there is no dispatch today and retains the job list', async () => {
    const emptyDispatch = { assignment: null, checklist: [], stops: [] };
    const fetcher = createFetcher(emptyDispatch as any, mockJobs);
    const api = new ApiClient('', fetcher);

    render(
      <MyJobsScreen
        api={api}
        params={{}}
        principal={CREW_PRINCIPAL}
        onNavigate={vi.fn()}
        onPrincipalChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-part="my-dispatch"]')).toBeTruthy();
    });

    const dispatchSection = document.querySelector('[data-part="my-dispatch"]')!;
    expect(dispatchSection.textContent).toContain('No dispatch route assigned for today.');
    expect(dispatchSection.querySelector('[data-part="dispatch-stops"]')).toBeNull();
    expect(dispatchSection.querySelector('[data-part="dispatch-crew"]')).toBeNull();

    // The All my jobs section and full job list remain intact
    expect(screen.getByRole('heading', { name: 'All my jobs' })).toBeTruthy();
    expect(document.querySelector('[data-part="jobs"]')).toBeTruthy();
    const jobsList = document.querySelector('[data-part="jobs"]')!;
    expect(jobsList.querySelectorAll('li').length).toBe(2);
  });
});
